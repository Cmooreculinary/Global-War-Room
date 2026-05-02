"""Court session orchestration — invite-witness courtroom flow."""
import logging
from typing import Optional

from cortex_service import (
    _ask_json,
    deliberate_forge,
    deliberate_with_committee,
    route_question,
)
from personas import CHAMBERS

logger = logging.getLogger(__name__)


def panel_for_chamber(chamber_id: str) -> list:
    """The expert panel seated at the bench for this chamber."""
    if chamber_id not in CHAMBERS:
        return []
    members = CHAMBERS[chamber_id].get("council", [])
    return [
        {
            "name": m.get("name"),
            "dates": m.get("dates"),
            "lineage": m.get("lineage"),
            "glyph": m.get("glyph"),
        }
        for m in members
    ]


async def route_and_panel(question: str) -> dict:
    """Route the question and return chamber_id, witnesses_called, panel."""
    routing = await route_question(question)
    chamber_id = routing["chamber_id"]
    witnesses = routing.get("witnesses", [])
    panel = panel_for_chamber(chamber_id)
    return {
        "chamber_id": chamber_id,
        "witnesses_called": witnesses,
        "panel": panel,
        "reasoning": routing.get("reasoning", ""),
    }


async def run_deliberation(chamber_id: str, question: str) -> dict:
    """Run the deliberation for the court session — same engine as solo flow."""
    if chamber_id == "forge":
        return await deliberate_forge(question)
    return await deliberate_with_committee(chamber_id, question)


def _amend_prompt(chamber_id: str) -> str:
    chamber_name = CHAMBERS.get(chamber_id, {}).get("name", "the chamber")
    return f"""You are the chair of {chamber_name}, presiding over a court in session.

The bench has rendered a verdict. A witness in the gallery has risen to object.
Your task: weigh the objection on its merits, decide what stands and what must
be amended, and issue the AMENDED VERDICT of the court.

Respond with JSON only, in this shape:
{{
  "amended_verdict": "<the revised verdict — full prose, plainspoken, the chair's voice. \
Acknowledge the objection by name, state what you concede, what you do not, and the \
final ruling that stands>",
  "concession": "<one sentence summary of what the objection moved>",
  "ruling": "uphold" | "amend" | "reverse"
}}

Do not pad. Do not break character. Render the verdict as a chair would speak it from the bench.
"""


async def amend_verdict(
    chamber_id: str,
    question: str,
    original_verdict: str,
    objector_name: str,
    objection_content: str,
) -> dict:
    """Re-deliberate after an objection and return the amended ruling."""
    user_text = (
        f"THE QUESTION:\n{question}\n\n"
        f"THE COURT'S ORIGINAL VERDICT:\n{original_verdict}\n\n"
        f"THE OBJECTION (raised by {objector_name}):\n{objection_content}\n\n"
        "Render the amended verdict."
    )
    return await _ask_json(_amend_prompt(chamber_id), user_text)


def make_share_path(session_id: str) -> str:
    return f"/court/{session_id}"


def public_session(session: dict) -> dict:
    """Strip the session for public clients (drop _id, host markers, etc.)."""
    if not session:
        return session
    out = {k: v for k, v in session.items() if k != "_id"}
    return out


__all__ = [
    "amend_verdict",
    "make_share_path",
    "panel_for_chamber",
    "public_session",
    "route_and_panel",
    "run_deliberation",
]
