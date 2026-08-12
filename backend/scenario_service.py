"""Team modes for The War Room: projections and played-out scenarios.

Both run on top of the same neutral brief the board reads, and both are slow —
a projection is one call per team, a scenario is one call per year plus an
opening and a debrief. Callers are expected to run these in the background and
poll, which is why every stage writes its result as soon as it lands rather
than at the end.
"""
import logging
from typing import Callable, Optional

from cortex_service import _ask_json
from personas import find_team, team_ids, team_label
from war_scenarios import (
    mode_note,
    projection_compare_prompt,
    projection_prompt,
    scenario_debrief_prompt,
    scenario_opening_prompt,
    scenario_year_prompt,
)
from warroom_service import render_brief_for_board

logger = logging.getLogger(__name__)

MIN_HORIZON, MAX_HORIZON = 1, 10
MAX_ACTORS = 4
ESCALATION_LEVELS = ("easing", "steady", "rising", "acute", "open conflict")

# An async no-op, so callers that do not care about progress need not pass one.
async def _noop(*_args, **_kwargs) -> None:
    return None


# --------------------------------------------------------------------------- #
# Assignments                                                                 #
# --------------------------------------------------------------------------- #

def sanitize_assignments(raw: list) -> list:
    """Normalise caller-supplied assignments into something playable.

    Drops unknown team ids and unnamed actors, dedupes teams within an actor,
    and refuses to seat the same team on two sides at once — a team advising
    both parties to a confrontation would be playing itself.
    """
    known = set(team_ids())
    seen_teams: set = set()
    cleaned = []

    for entry in raw or []:
        if not isinstance(entry, dict):
            continue
        actor = str(entry.get("actor", "")).strip()[:80]
        if not actor:
            continue
        teams = []
        for tid in entry.get("teams") or []:
            if tid in known and tid not in seen_teams and tid not in teams:
                teams.append(tid)
        if not teams:
            continue
        seen_teams.update(teams)
        cleaned.append({"actor": actor, "teams": teams})
        if len(cleaned) >= MAX_ACTORS:
            break

    return cleaned


def clamp_horizon(years) -> int:
    try:
        years = int(years)
    except (TypeError, ValueError):
        return 5
    return max(MIN_HORIZON, min(MAX_HORIZON, years))


def describe_assignments(assignments: list) -> str:
    return "; ".join(
        f"{a['actor']} ({', '.join(team_label(t) for t in a['teams'])})" for a in assignments
    )


# --------------------------------------------------------------------------- #
# Mode one — projections                                                      #
# --------------------------------------------------------------------------- #

def _normalize_projection(raw: dict, team: dict, horizon: int) -> dict:
    def rows(key):
        value = raw.get(key)
        return [r for r in value if isinstance(r, dict)] if isinstance(value, list) else []

    def strings(key):
        value = raw.get(key)
        return [str(v) for v in value if str(v).strip()] if isinstance(value, list) else []

    return {
        "team": team["id"],
        "leader": team["leader"]["name"],
        "trajectory": str(raw.get("trajectory", "")).strip(),
        "phases": [
            {
                "window": str(p.get("window") or f"Year {i + 1}"),
                "expect": str(p.get("expect", "")),
                "why": str(p.get("why", "")),
            }
            for i, p in enumerate(rows("phases")[:horizon])
        ],
        "flashpoints": [
            {
                "where": str(f.get("where", "")),
                "trigger": str(f.get("trigger", "")),
                "odds": str(f.get("odds", "possible")),
            }
            for f in rows("flashpoints")
        ],
        "wildcards": strings("wildcards"),
        "internal_dissent": [
            {"who": str(d.get("who", "")), "objection": str(d.get("objection", ""))}
            for d in rows("internal_dissent")
        ],
        "signature": str(raw.get("signature", "")).strip(),
    }


def _render_projection(p: dict) -> str:
    phases = "\n".join(f"    {ph['window']}: {ph['expect']} ({ph['why']})" for ph in p["phases"])
    flash = "; ".join(f"{f['where']} — {f['trigger']} [{f['odds']}]" for f in p["flashpoints"])
    dissent = "; ".join(f"{d['who']}: {d['objection']}" for d in p["internal_dissent"])
    return "\n".join([
        f"TEAM {p['leader'].upper()}",
        f"  Trajectory: {p['trajectory']}",
        phases or "    (no phases given)",
        f"  Flashpoints: {flash or 'none named'}",
        f"  Wildcards: {'; '.join(p['wildcards']) or 'none named'}",
        f"  Internal dissent: {dissent or 'none recorded'}",
        f"  Signature: {p['signature']}",
    ])


async def run_projections(
    brief: dict,
    horizon: int = 5,
    teams: Optional[list] = None,
    on_progress: Callable = _noop,
) -> dict:
    """Every team forecasts the horizon, then the forecasts are read together."""
    horizon = clamp_horizon(horizon)
    wanted = [t for t in (teams or team_ids()) if find_team(t)] or team_ids()
    brief_text = render_brief_for_board(brief)

    projections = []
    for i, team_id in enumerate(wanted):
        team = find_team(team_id)
        await on_progress(stage="projection", team=team_id, done=i, total=len(wanted))
        try:
            raw = await _ask_json(
                projection_prompt(team, horizon),
                f"THE INTELLIGENCE BRIEF:\n\n{brief_text}",
                max_tokens=3500,
            )
            projections.append(_normalize_projection(raw, team, horizon))
        except Exception as e:
            logger.warning("Projection failed for team %s: %s", team_id, e)

    if not projections:
        raise RuntimeError("No team could produce a projection")

    await on_progress(stage="comparison", done=len(wanted), total=len(wanted))
    comparison = await _compare_projections(projections, brief_text, horizon)
    return {"horizon": horizon, "projections": projections, "comparison": comparison}


async def _compare_projections(projections: list, brief_text: str, horizon: int) -> dict:
    user_text = (
        f"THE BRIEF:\n{brief_text}\n\n"
        f"THE PROJECTIONS:\n\n" + "\n\n".join(_render_projection(p) for p in projections)
    )
    try:
        raw = await _ask_json(projection_compare_prompt(horizon), user_text, max_tokens=3000)
    except Exception as e:
        logger.warning("Projection comparison failed: %s", e)
        return {
            "consensus": "The comparison pass failed; read the projections individually.",
            "divergences": [],
            "lone_signals": [],
            "hinge_question": "",
            "if_you_watch_one_thing": "",
        }

    divergences = raw.get("divergences")
    lone = raw.get("lone_signals")
    return {
        "consensus": str(raw.get("consensus", "")),
        "divergences": [
            {
                "question": str(d.get("question", "")),
                "positions": [
                    {"team": str(p.get("team", "")), "holds": str(p.get("holds", ""))}
                    for p in (d.get("positions") or []) if isinstance(p, dict)
                ],
                "root": str(d.get("root", "")),
            }
            for d in (divergences or []) if isinstance(d, dict)
        ],
        "lone_signals": [
            {
                "team": str(s.get("team", "")),
                "saw": str(s.get("saw", "")),
                "worth_taking_seriously_because": str(s.get("worth_taking_seriously_because", "")),
            }
            for s in (lone or []) if isinstance(s, dict)
        ],
        "hinge_question": str(raw.get("hinge_question", "")),
        "if_you_watch_one_thing": str(raw.get("if_you_watch_one_thing", "")),
    }


# --------------------------------------------------------------------------- #
# Mode two — the scenario                                                     #
# --------------------------------------------------------------------------- #

def _actor_names(assignments: list) -> list:
    return [a["actor"] for a in assignments]


def _normalize_opening(raw: dict, assignments: list) -> list:
    by_actor = {}
    for row in (raw.get("actors") or []):
        if not isinstance(row, dict):
            continue
        name = str(row.get("actor", "")).strip()
        match = next((a for a in _actor_names(assignments) if a.lower() == name.lower()), None)
        if match and match not in by_actor:
            by_actor[match] = {
                "actor": match,
                "doctrine": str(row.get("doctrine", "")),
                "objectives": [str(o) for o in (row.get("objectives") or []) if str(o).strip()],
                "red_lines": [str(r) for r in (row.get("red_lines") or []) if str(r).strip()],
                "assets": str(row.get("assets", "")),
                "constraints": str(row.get("constraints", "")),
                "opening_posture": str(row.get("opening_posture", "")),
                "council_split": str(row.get("council_split", "")),
            }
    # Never silently drop an actor the caller asked to play.
    for a in assignments:
        by_actor.setdefault(a["actor"], {
            "actor": a["actor"],
            "doctrine": "",
            "objectives": [],
            "red_lines": [],
            "assets": "",
            "constraints": "",
            "opening_posture": "",
            "council_split": "",
        })
    return [by_actor[a["actor"]] for a in assignments]


def _normalize_year(raw: dict, year: int, assignments: list) -> dict:
    moves = [m for m in (raw.get("moves") or []) if isinstance(m, dict)]
    scores = [s for s in (raw.get("scorecard") or []) if isinstance(s, dict)]
    escalation = str(raw.get("escalation", "steady")).lower().strip()
    return {
        "year": year,
        "moves": [
            {
                "actor": str(m.get("actor", "")),
                "move": str(m.get("move", "")),
                "pushed_by": str(m.get("pushed_by", "")),
                "opposed_by": str(m.get("opposed_by", "")),
                "rationale": str(m.get("rationale", "")),
                "cost": str(m.get("cost", "")),
            }
            for m in moves
        ],
        "friction": str(raw.get("friction", "")),
        "interaction": str(raw.get("interaction", "")),
        "world_state": str(raw.get("world_state", "")),
        "escalation": escalation if escalation in ESCALATION_LEVELS else "steady",
        "scorecard": [
            {
                "actor": str(s.get("actor", "")),
                "gained": str(s.get("gained", "")),
                "lost": str(s.get("lost", "")),
            }
            for s in scores
        ],
    }


def _render_opening(opening: list) -> str:
    return "\n\n".join(
        "\n".join([
            f"{o['actor']}:",
            f"  Doctrine: {o['doctrine']}",
            f"  Objectives: {'; '.join(o['objectives']) or 'none set'}",
            f"  Red lines: {'; '.join(o['red_lines']) or 'none set'}",
            f"  Assets: {o['assets']}",
            f"  Constraints: {o['constraints']}",
            f"  Opening posture: {o['opening_posture']}",
            f"  Council split: {o['council_split']}",
        ])
        for o in opening
    )


def _render_years(years: list) -> str:
    if not years:
        return "(no years played yet)"
    blocks = []
    for y in years:
        moves = "\n".join(
            f"    {m['actor']}: {m['move']} (pushed by {m['pushed_by']}; cost: {m['cost']})"
            for m in y["moves"]
        )
        blocks.append("\n".join([
            f"YEAR {y['year']} — escalation: {y['escalation']}",
            moves or "    (no moves recorded)",
            f"    Friction: {y['friction']}",
            f"    Result: {y['interaction']}",
            f"    End state: {y['world_state']}",
        ]))
    return "\n\n".join(blocks)


async def run_scenario(
    brief: dict,
    assignments: list,
    horizon: int = 5,
    on_progress: Callable = _noop,
) -> dict:
    """Play the horizon out year by year.

    Each year is its own call, given everything that has already happened, so
    the exercise can actually escalate and surprise rather than being a plan
    written all at once.
    """
    assignments = sanitize_assignments(assignments)
    if not assignments:
        raise ValueError("No playable assignments: every actor needs a name and at least one team")
    horizon = clamp_horizon(horizon)
    note = mode_note(assignments)
    brief_text = render_brief_for_board(brief)

    await on_progress(stage="opening", year=0, total=horizon)
    opening_raw = await _ask_json(
        scenario_opening_prompt(assignments, horizon, note),
        f"THE INTELLIGENCE BRIEF:\n\n{brief_text}",
        max_tokens=4000,
    )
    opening = _normalize_opening(opening_raw, assignments)
    await on_progress(stage="opening_done", year=0, total=horizon, opening=opening)

    years: list = []
    for year in range(1, horizon + 1):
        await on_progress(stage="year", year=year, total=horizon)
        user_text = "\n\n".join([
            f"THE INTELLIGENCE BRIEF:\n{brief_text}",
            f"OPENING POSTURES (turn zero):\n{_render_opening(opening)}",
            f"PLAY SO FAR:\n{_render_years(years)}",
            f"Now play year {year}.",
        ])
        try:
            raw = await _ask_json(
                scenario_year_prompt(year, horizon, assignments, note),
                user_text,
                max_tokens=4000,
            )
            played = _normalize_year(raw, year, assignments)
        except Exception as e:
            # A lost year should not void the run; record it and keep playing.
            logger.warning("Scenario year %s failed: %s", year, e)
            played = _normalize_year({}, year, assignments)
            played["world_state"] = "This year could not be played; the exercise continues from the prior state."
        years.append(played)
        await on_progress(stage="year_done", year=year, total=horizon, played=played)

    await on_progress(stage="debrief", year=horizon, total=horizon)
    debrief = await _build_debrief(brief_text, opening, years, horizon)

    return {
        "horizon": horizon,
        "assignments": assignments,
        "mode": "confrontation" if len(assignments) > 1 else "single_actor",
        "opening": opening,
        "years": years,
        "debrief": debrief,
    }


async def _build_debrief(brief_text: str, opening: list, years: list, horizon: int) -> dict:
    user_text = "\n\n".join([
        f"THE INTELLIGENCE BRIEF:\n{brief_text}",
        f"OPENING POSTURES (turn zero):\n{_render_opening(opening)}",
        f"THE {horizon} YEARS AS PLAYED:\n{_render_years(years)}",
    ])
    try:
        raw = await _ask_json(scenario_debrief_prompt(horizon), user_text, max_tokens=3500)
    except Exception as e:
        logger.warning("Scenario debrief failed: %s", e)
        return {
            "outcome": "The debrief pass failed; the years as played above still stand.",
            "objectives_scored": [],
            "turning_point": "",
            "doctrine_held": [],
            "cost_ledger": [],
            "transferable_lesson": "",
            "load_bearing_assumption": "",
        }

    def rows(key):
        value = raw.get(key)
        return [r for r in value if isinstance(r, dict)] if isinstance(value, list) else []

    return {
        "outcome": str(raw.get("outcome", "")),
        "objectives_scored": [
            {
                "actor": str(r.get("actor", "")),
                "objective": str(r.get("objective", "")),
                "result": str(r.get("result", "")),
                "note": str(r.get("note", "")),
            }
            for r in rows("objectives_scored")
        ],
        "turning_point": str(raw.get("turning_point", "")),
        "doctrine_held": [
            {"team": str(r.get("team", "")), "verdict": str(r.get("verdict", "")), "why": str(r.get("why", ""))}
            for r in rows("doctrine_held")
        ],
        "cost_ledger": [
            {"who": str(r.get("who", "")), "paid": str(r.get("paid", ""))}
            for r in rows("cost_ledger")
        ],
        "transferable_lesson": str(raw.get("transferable_lesson", "")),
        "load_bearing_assumption": str(raw.get("load_bearing_assumption", "")),
    }


__all__ = [
    "MAX_ACTORS",
    "MAX_HORIZON",
    "clamp_horizon",
    "describe_assignments",
    "run_projections",
    "run_scenario",
    "sanitize_assignments",
]
