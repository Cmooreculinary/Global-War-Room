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
    """Cross-chamber committee flow:
    1. Classify whether this question crosses chamber domains.
    2. If only home chamber needed → run single-chamber multi-persona deliberation.
    3. If committee needed → gather witness contributions from each chamber, then
       have the home chamber chair the synthesis.
    """
    if chamber_id not in CHAMBERS or chamber_id == "forge":
        raise ValueError(f"Unknown chamber for committee: {chamber_id}")

    valid = {"senate", "boardroom", "courtroom", "council"}

    # Step 1 — committee relevance
    try:
        classification = await _ask_json(
            committee_classifier_prompt(chamber_id), question
        )
        chambers_to_call = classification.get("chambers", [chamber_id])
    except Exception as e:
        logger.warning("Committee classifier failed: %s — falling back to home only", e)
        chambers_to_call = [chamber_id]

    # Sanitize: home must be first, only valid ids, max 3 total
    chambers_to_call = [c for c in chambers_to_call if c in valid]
    if chamber_id not in chambers_to_call:
        chambers_to_call = [chamber_id] + chambers_to_call
    chambers_to_call = [chamber_id] + [c for c in chambers_to_call if c != chamber_id]
    chambers_to_call = chambers_to_call[:3]

    # Step 2 — if only home chamber is needed, single-call multi-persona path
    if len(chambers_to_call) == 1:
        return await deliberate_chamber(chamber_id, question)

    # Step 3 — gather witness contributions per chamber
    witnesses = []
    for cid in chambers_to_call:
        try:
            w = await _ask_json(forge_witness_prompt(cid), question)
            witnesses.append({
                "chamber": w.get("chamber", CHAMBERS[cid]["name"]),
                "chamber_id": cid,
                "contribution": w.get("contribution", ""),
            })
        except Exception as e:
            logger.warning("Committee witness call failed for %s: %s", cid, e)

    if not witnesses:
        # All witness calls failed — fall back to single-chamber flow so the user gets *something*
        logger.warning("All committee witnesses failed for %s; falling back to single chamber", chamber_id)
        return await deliberate_chamber(chamber_id, question)

    # Step 4 — home chamber chairs the synthesis
    synthesis_system = committee_chair_synthesis_prompt(chamber_id, witnesses)
    synthesis = await _ask_json(synthesis_system, question)
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
