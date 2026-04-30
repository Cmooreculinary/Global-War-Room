"""
Deliberation orchestrator for Cerebral Cortex.
Uses emergentintegrations + Claude Sonnet 4.5 for chamber and Forge deliberations.
"""
import json
import logging
import os
import re
import uuid
from typing import Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

from personas import (
    CHAMBERS,
    auto_router_prompt,
    chamber_system_prompt,
    committee_chair_synthesis_prompt,
    committee_classifier_prompt,
    forge_classifier_prompt,
    forge_synthesis_prompt,
    forge_witness_prompt,
)

logger = logging.getLogger(__name__)

ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"


def _api_key() -> str:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")
    return key


def _build_chat(system_message: str, session_id: Optional[str] = None) -> LlmChat:
    return (
        LlmChat(
            api_key=_api_key(),
            session_id=session_id or str(uuid.uuid4()),
            system_message=system_message,
        )
        .with_model("anthropic", ANTHROPIC_MODEL)
        .with_params(max_tokens=2500)
    )


def _strip_json(raw: str) -> str:
    """Pull JSON object out of a response that might have stray prose or fences."""
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    # If still has prose, try to grab the largest {...} block
    if not s.startswith("{"):
        match = re.search(r"\{.*\}", s, re.DOTALL)
        if match:
            s = match.group(0)
    return s.strip()


async def _ask_json(system_message: str, user_text: str) -> dict:
    chat = _build_chat(system_message)
    response = await chat.send_message(UserMessage(text=user_text))
    cleaned = _strip_json(response)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse JSON. Raw: %s", response[:1000])
        raise ValueError(f"LLM returned non-JSON: {e}") from e


VALID_LOBE_CHAMBERS = {"senate", "boardroom", "courtroom", "council"}
ALL_CHAMBERS = VALID_LOBE_CHAMBERS | {"forge"}


async def route_question(question: str) -> dict:
    """Decide which chamber should chair a question. Used by the one-page UX
    so the brain can light up before the slow deliberation begins.
    Returns: {chamber_id, witnesses, reasoning}
    """
    try:
        result = await _ask_json(auto_router_prompt(), question)
    except Exception as e:
        logger.warning("Auto-router failed: %s — defaulting to forge", e)
        return {"chamber_id": "forge", "witnesses": [], "reasoning": "Router unavailable; default integration."}

    home = result.get("home", "forge")
    if home not in ALL_CHAMBERS:
        home = "forge"

    raw_witnesses = result.get("witnesses") or []
    witnesses = [
        cid for cid in raw_witnesses
        if cid in VALID_LOBE_CHAMBERS and cid != home
    ][:3]

    return {
        "chamber_id": home,
        "witnesses": witnesses,
        "reasoning": result.get("reasoning", ""),
    }


def _sanitize_committee(home_chamber: str, raw_chambers) -> list:
    """Normalise a classifier response into a clean ordered list:
    home chamber first, only valid lobe ids, max 3 total, no duplicates.
    """
    cleaned = [c for c in (raw_chambers or []) if c in VALID_LOBE_CHAMBERS]
    if home_chamber not in cleaned:
        cleaned = [home_chamber, *cleaned]
    cleaned = [home_chamber, *[c for c in cleaned if c != home_chamber]]
    return cleaned[:3]


async def _classify_committee(home_chamber: str, question: str) -> list:
    """Ask the LLM whether this question requires a cross-chamber committee."""
    try:
        classification = await _ask_json(
            committee_classifier_prompt(home_chamber), question
        )
        return _sanitize_committee(home_chamber, classification.get("chambers"))
    except Exception as e:
        logger.warning("Committee classifier failed: %s — falling back to home only", e)
        return [home_chamber]


async def _gather_witnesses(chamber_ids: list, question: str) -> list:
    """Run a witness call per chamber, collecting whatever succeeds."""
    witnesses = []
    for cid in chamber_ids:
        try:
            w = await _ask_json(forge_witness_prompt(cid), question)
            witnesses.append({
                "chamber": w.get("chamber", CHAMBERS[cid]["name"]),
                "chamber_id": cid,
                "contribution": w.get("contribution", ""),
            })
        except Exception as e:
            logger.warning("Witness call failed for %s: %s", cid, e)
    return witnesses


async def deliberate_chamber(chamber_id: str, question: str) -> dict:
    """Run a single-call multi-persona deliberation for one chamber."""
    if chamber_id not in CHAMBERS or chamber_id == "forge":
        raise ValueError(f"Unknown chamber: {chamber_id}")
    system = chamber_system_prompt(chamber_id)
    payload = await _ask_json(system, question)
    payload.setdefault("chamber", CHAMBERS[chamber_id]["name"])
    payload["chamber_id"] = chamber_id
    payload["question"] = question
    payload["committee"] = False
    payload["witnesses_called"] = None
    return payload


async def deliberate_with_committee(chamber_id: str, question: str) -> dict:
    """Cross-chamber committee orchestrator.

    1. Classify whether the question crosses chamber domains.
    2. If only the home chamber is needed → single-chamber multi-persona deliberation.
    3. Else → gather witness contributions per chamber, then have the home chamber
       chair the synthesis.
    """
    if chamber_id not in CHAMBERS or chamber_id == "forge":
        raise ValueError(f"Unknown chamber for committee: {chamber_id}")

    chambers_to_call = await _classify_committee(chamber_id, question)
    if len(chambers_to_call) == 1:
        return await deliberate_chamber(chamber_id, question)

    witnesses = await _gather_witnesses(chambers_to_call, question)
    if not witnesses:
        logger.warning(
            "All committee witnesses failed for %s; falling back to single chamber",
            chamber_id,
        )
        return await deliberate_chamber(chamber_id, question)

    synthesis = await _ask_json(
        committee_chair_synthesis_prompt(chamber_id, witnesses), question
    )
    synthesis["chamber_id"] = chamber_id
    synthesis.setdefault("chamber", CHAMBERS[chamber_id]["name"])
    synthesis["question"] = question
    synthesis["committee"] = True
    synthesis["witnesses_called"] = [w["chamber_id"] for w in witnesses]
    return synthesis


async def deliberate_forge(question: str) -> dict:
    """Multi-call Forge deliberation:
    1. Classify which chambers to call as witnesses.
    2. For each, get a witness contribution.
    3. Synthesize via The Integrator.
    """
    # Step 1 — classification
    try:
        classification = await _ask_json(forge_classifier_prompt(), question)
        chamber_ids = classification.get("chambers", [])
    except Exception as e:
        logger.warning("Forge classifier failed: %s — defaulting to all four", e)
        chamber_ids = ["senate", "boardroom", "courtroom", "council"]

    # Sanitize
    chamber_ids = [
        cid for cid in chamber_ids
        if cid in {"senate", "boardroom", "courtroom", "council"}
    ]
    if not chamber_ids:
        chamber_ids = ["senate", "boardroom", "courtroom", "council"]
    if len(chamber_ids) > 4:
        chamber_ids = chamber_ids[:4]

    # Step 2 — gather witness contributions sequentially (each is a fresh chat)
    witnesses = []
    for cid in chamber_ids:
        try:
            w = await _ask_json(forge_witness_prompt(cid), question)
            witnesses.append({
                "chamber": w.get("chamber", CHAMBERS[cid]["name"]),
                "chamber_id": cid,
                "contribution": w.get("contribution", ""),
            })
        except Exception as e:
            logger.warning("Witness call failed for %s: %s", cid, e)

    if not witnesses:
        raise RuntimeError("No witnesses could be gathered for the Forge")

    # Step 3 — synthesis
    synthesis_system = forge_synthesis_prompt(witnesses)
    synthesis = await _ask_json(synthesis_system, question)
    synthesis["chamber_id"] = "forge"
    synthesis.setdefault("chamber", "The Forge")
    synthesis["question"] = question
    synthesis["committee"] = True
    synthesis["witnesses_called"] = [w["chamber_id"] for w in witnesses]
    return synthesis
