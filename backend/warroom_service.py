"""The War Room — three-pass strategic estimation.

    raw coverage  ──sift──▶  neutral brief  ──board──▶  five reads  ──estimate──▶  product

The passes are deliberately separate calls. The sifter never sees the council,
so it cannot shade the facts toward a strategic conclusion; the board never sees
the raw coverage, so it cannot pick up an outlet's framing. That separation is
the whole point of the room, not an implementation detail — keep it.
"""
import logging
from typing import Optional

from cortex_service import _ask_json
from intel import (
    fetch_live,
    gather_summary,
    normalize_pasted,
    public_items,
    render_source_block,
)
from personas import (
    CHAMBERS,
    estimate_prompt,
    situation_sift_prompt,
    war_room_prompt,
)

logger = logging.getLogger(__name__)

BOARD_MEMBERS = [m["name"] for m in CHAMBERS["warroom"]["council"]]

BRIEF_ARRAYS = (
    "established_facts",
    "contested_claims",
    "unknowns",
    "framing_removed",
    "actors",
    "timeline",
    "coverage_gaps",
)

EMPTY_BRIEF_NOTE = (
    "No source material was available, so the board is reasoning from the topic "
    "alone. Treat every read as speculative until facts are supplied."
)


# --------------------------------------------------------------------------- #
# Pass 1 — gather and sift                                                    #
# --------------------------------------------------------------------------- #

async def gather_sources(
    topic: str,
    pasted: str = "",
    live: bool = True,
    window_hours: int = 24,
    include_state: bool = False,
) -> tuple:
    """Collect source material from whichever intakes are in play.

    Returns (items, mode, notes). Pasted material is kept ahead of live items so
    that a document the user cared enough to supply survives the length budget.
    """
    pasted_items = normalize_pasted(pasted)
    live_items, notes, live_ok = [], [], False

    if live:
        result = await fetch_live(topic, window_hours=window_hours, include_state=include_state)
        live_items = result["items"]
        live_ok = result["reachable"]
        notes = list(result["notes"])

    if pasted_items and live_items:
        mode = "live+pasted"
    elif pasted_items:
        mode = "pasted"
        if live and not live_ok:
            notes.append("Fell back to your pasted material only.")
    elif live_items:
        mode = "live"
    else:
        mode = "none"
        notes.append(EMPTY_BRIEF_NOTE)

    return pasted_items + live_items, mode, notes


def _empty_brief(topic: str, notes: list) -> dict:
    """An honest brief for the case where nothing could be gathered."""
    return {
        "situation": (
            f"No source material could be gathered on: {topic}. Nothing below is "
            "established; the board is working from the topic alone."
        ),
        "as_of": "unspecified",
        "established_facts": [],
        "contested_claims": [],
        "unknowns": [
            "Everything. No coverage was supplied or reachable.",
            "Whether the situation has changed since the model's training data.",
        ],
        "framing_removed": [],
        "actors": [],
        "timeline": [],
        "coverage_gaps": notes or [EMPTY_BRIEF_NOTE],
    }


def _normalize_brief(brief: dict, topic: str) -> dict:
    """Guarantee the shape the frontend and the board pass both rely on."""
    out = dict(brief or {})
    out.setdefault("situation", f"Situation: {topic}")
    out.setdefault("as_of", "unspecified")
    for key in BRIEF_ARRAYS:
        value = out.get(key)
        out[key] = value if isinstance(value, list) else []
    return out


async def build_brief(
    topic: str,
    pasted: str = "",
    live: bool = True,
    window_hours: int = 24,
    include_state: bool = False,
) -> dict:
    """Gather coverage and sift it into a neutral, sourced fact sheet."""
    items, mode, notes = await gather_sources(
        topic, pasted=pasted, live=live, window_hours=window_hours, include_state=include_state
    )
    provenance = gather_summary(items, mode, notes)

    if not items:
        return {
            "topic": topic,
            "brief": _empty_brief(topic, notes),
            "sources": provenance,
            "items": [],
        }

    user_text = (
        f"TOPIC: {topic}\n\n"
        f"SOURCE MATERIAL ({len(items)} items across {len(provenance['spread'])} lean categories — "
        f"{', '.join(f'{k}: {v}' for k, v in provenance['spread'].items())}):\n\n"
        f"{render_source_block(items)}"
    )
    try:
        raw = await _ask_json(situation_sift_prompt(topic), user_text, max_tokens=4000)
        brief = _normalize_brief(raw, topic)
    except Exception:
        logger.exception("Situation sift failed for topic %r", topic)
        raise

    return {
        "topic": topic,
        "brief": brief,
        "sources": provenance,
        "items": public_items(items),
    }


# --------------------------------------------------------------------------- #
# Pass 2 — the board reads the brief                                          #
# --------------------------------------------------------------------------- #

def render_brief_for_board(brief: dict) -> str:
    """Flatten the fact sheet into the only input the board is allowed."""
    def bullets(rows, fmt):
        return "\n".join(f"  - {fmt(r)}" for r in rows) or "  - (none recorded)"

    return "\n".join([
        f"SITUATION (as of {brief.get('as_of', 'unspecified')}):",
        f"  {brief.get('situation', '')}",
        "",
        "ESTABLISHED FACTS:",
        bullets(
            brief.get("established_facts", []),
            lambda r: f"{r.get('fact', '')} [corroborated by: {', '.join(r.get('corroboration') or []) or 'unspecified'}"
                      f"; confidence: {r.get('confidence', 'unspecified')}]",
        ),
        "",
        "CONTESTED CLAIMS — do not treat these as facts:",
        bullets(
            brief.get("contested_claims", []),
            lambda r: f"{r.get('claim', '')} [asserted by {r.get('asserted_by', 'unknown')}; "
                      f"disputed by {r.get('disputed_by', 'unknown')}]",
        ),
        "",
        "UNKNOWNS:",
        bullets(brief.get("unknowns", []), lambda r: r if isinstance(r, str) else str(r)),
        "",
        "ACTORS:",
        bullets(
            brief.get("actors", []),
            lambda r: f"{r.get('name', '')} — states it wants: {r.get('stated_aim', 'unstated')}; "
                      f"actions suggest (inference): {r.get('inferred_aim', 'unclear')}; "
                      f"can bring: {r.get('capabilities', 'unclear')}; constrained by: {r.get('constraints', 'unclear')}",
        ),
        "",
        "TIMELINE:",
        bullets(brief.get("timeline", []), lambda r: f"{r.get('when', '')}: {r.get('what', '')}"),
        "",
        "GAPS IN THE COVERAGE:",
        bullets(brief.get("coverage_gaps", []), lambda r: r if isinstance(r, str) else str(r)),
    ])


def _normalize_board(raw: dict) -> list:
    """Keep one entry per seated member, in roster order, with the full shape."""
    rows = raw.get("board") if isinstance(raw, dict) else None
    by_name = {}
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        name = (row.get("member") or "").strip()
        match = next((m for m in BOARD_MEMBERS if m.lower() == name.lower()), None)
        # tolerate "Churchill" or "Alexander" where the roster is more formal
        if match is None:
            match = next(
                (m for m in BOARD_MEMBERS if name and (name in m or m.split()[-1] == name.split()[-1])),
                None,
            )
        if match and match not in by_name:
            moves = row.get("next_moves")
            by_name[match] = {
                "member": match,
                "read": (row.get("read") or "").strip(),
                "next_moves": [str(m).strip() for m in moves if str(m).strip()] if isinstance(moves, list) else [],
                "decisive_factor": (row.get("decisive_factor") or "").strip(),
                "if_wrong": (row.get("if_wrong") or "").strip(),
                "risk": (row.get("risk") or "").strip(),
                "dissent": bool(row.get("dissent", False)),
            }
    return [by_name[m] for m in BOARD_MEMBERS if m in by_name]


async def convene_board(brief: dict, question: str = "") -> list:
    """Five commanders read the same brief and give their reads."""
    user_text = (
        "THE INTELLIGENCE BRIEF — this is the entirety of what the board knows:\n\n"
        f"{render_brief_for_board(brief)}"
    )
    raw = await _ask_json(war_room_prompt(question), user_text, max_tokens=6000)
    board = _normalize_board(raw)
    if not board:
        raise ValueError("The board returned no usable reads")
    return board


# --------------------------------------------------------------------------- #
# Pass 3 — the estimate                                                       #
# --------------------------------------------------------------------------- #

def _render_board(board: list) -> str:
    return "\n\n".join(
        "\n".join([
            f"{row['member']}:",
            f"  READ: {row['read']}",
            f"  PROPOSED MOVES: {'; '.join(row['next_moves']) or '(none given)'}",
            f"  DECISIVE FACTOR: {row['decisive_factor']}",
            f"  WOULD BE WRONG IF: {row['if_wrong']}",
            f"  PRIMARY RISK: {row['risk']}",
            f"  DISSENTS FROM THE ROOM: {'yes' if row['dissent'] else 'no'}",
        ])
        for row in board
    )


def _fallback_estimate(board: list, note: str) -> dict:
    dissenters = [r["member"] for r in board if r["dissent"]]
    return {
        "convergence": "The estimate could not be generated; read the board's individual reads above.",
        "fault_line": (
            f"Recorded dissent from: {', '.join(dissenters)}." if dissenters
            else "No dissent was recorded on the board."
        ),
        "decision_point": "",
        "most_likely_course": "",
        "most_dangerous_course": "",
        "indicators": [],
        "confidence": "low",
        "confidence_note": note,
    }


async def build_estimate(brief: dict, board: list, question: str = "") -> dict:
    """Turn five diverging reads into a decision product."""
    user_text = "\n\n".join(filter(None, [
        f"THE QUESTION: {question}" if question.strip() else "",
        f"THE BRIEF:\n{render_brief_for_board(brief)}",
        f"THE BOARD'S READS:\n{_render_board(board)}",
    ]))
    try:
        raw = await _ask_json(estimate_prompt(), user_text, max_tokens=3000)
    except Exception as e:
        logger.warning("Estimate synthesis failed: %s", e)
        return _fallback_estimate(board, "The synthesis pass failed; only the individual reads are reliable.")

    indicators = raw.get("indicators")
    return {
        "convergence": raw.get("convergence", ""),
        "fault_line": raw.get("fault_line", ""),
        "decision_point": raw.get("decision_point", ""),
        "most_likely_course": raw.get("most_likely_course", ""),
        "most_dangerous_course": raw.get("most_dangerous_course", ""),
        "indicators": [
            {
                "watch_for": str(i.get("watch_for", "")),
                "means": str(i.get("means", "")),
                "confirms": str(i.get("confirms", "")),
            }
            for i in (indicators or []) if isinstance(i, dict)
        ],
        "confidence": raw.get("confidence", "moderate"),
        "confidence_note": raw.get("confidence_note", ""),
    }


# --------------------------------------------------------------------------- #
# Full run                                                                    #
# --------------------------------------------------------------------------- #

def verdict_prose(estimate: dict) -> str:
    """A single prose verdict, so a War Room session reads correctly in the
    Archive and on the shared /verdict/:id page alongside every other chamber."""
    parts = [
        estimate.get("convergence", ""),
        estimate.get("fault_line", ""),
        estimate.get("decision_point", ""),
    ]
    likely = estimate.get("most_likely_course", "")
    dangerous = estimate.get("most_dangerous_course", "")
    if likely:
        parts.append(f"Most likely: {likely}")
    if dangerous:
        parts.append(f"Most dangerous: {dangerous}")
    return " ".join(p.strip() for p in parts if p and p.strip())


def board_as_deliberation(board: list) -> list:
    """Map the board onto the {member, contribution, dissent} shape the rest of
    the app already renders."""
    out = []
    for row in board:
        contribution = row["read"]
        if row["next_moves"]:
            contribution += " Next moves: " + "; ".join(row["next_moves"]) + "."
        if row["risk"]:
            contribution += f" Chief risk: {row['risk']}"
        out.append({
            "member": row["member"],
            "contribution": contribution.strip(),
            "dissent": row["dissent"],
        })
    return out


async def run_war_room(
    topic: str,
    question: str = "",
    pasted: str = "",
    live: bool = True,
    window_hours: int = 24,
    include_state: bool = False,
    prebuilt: Optional[dict] = None,
) -> dict:
    """Sift → board → estimate. `prebuilt` skips the sift when the user has
    already reviewed (and possibly corrected) the brief."""
    gathered = prebuilt or await build_brief(
        topic, pasted=pasted, live=live, window_hours=window_hours, include_state=include_state
    )
    brief = gathered["brief"]
    board = await convene_board(brief, question)
    estimate = await build_estimate(brief, board, question)

    return {
        "topic": topic,
        "question": question,
        "brief": brief,
        "sources": gathered.get("sources", {}),
        "items": gathered.get("items", []),
        "board": board,
        "estimate": estimate,
        "deliberation": board_as_deliberation(board),
        "verdict": verdict_prose(estimate),
        "chamber": CHAMBERS["warroom"]["name"],
        "chamber_id": "warroom",
        "committee": False,
        "witnesses_called": None,
    }


__all__ = [
    "BOARD_MEMBERS",
    "board_as_deliberation",
    "build_brief",
    "build_estimate",
    "convene_board",
    "gather_sources",
    "render_brief_for_board",
    "run_war_room",
    "verdict_prose",
]
