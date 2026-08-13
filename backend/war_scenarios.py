"""Prompts for the War Room's team modes.

Three products, one primitive underneath. A *team* is a commander plus the two
consuls he would actually seat. An *assignment* binds one or more teams to an
actor — a state, a bloc, whoever is being played. Every mode the user can pick
is just a different shape of assignment:

    play the United States   -> one actor, every team advising it
    play China               -> one actor, every team advising it
    United States vs China   -> two actors, teams split between them
    anything else            -> any actors, any split

So there is no "US mode" and no "China mode" in this file. There is one
scenario engine that takes assignments, and presets in the UI that fill them in.
"""
from personas import CHAMBERS, WARROOM_ANALYSIS_BOUNDARY, find_team
from profiles import FIDELITY_RULE, render_profile


# --------------------------------------------------------------------------- #
# Rendering                                                                   #
# --------------------------------------------------------------------------- #

def render_team(team: dict, indent: str = "", depth: str = "full") -> str:
    """A team's three voices, for a prompt.

    `depth` controls how much of each character sheet comes along. A scenario
    can have fifteen figures at the table; full sheets for all of them would
    crowd out the situation they are supposed to be reasoning about.
    """
    leader = team["leader"]
    lines = [
        f"{indent}TEAM {leader['name'].upper()} — led by {leader['name']} ({leader['dates']}), {leader['lineage']}",
        f"{indent}  {leader['voice_notes']}",
        render_profile(leader["id"], leader["name"], depth=depth, indent=indent + "  "),
    ]
    for consul in team["consuls"]:
        lines.append(
            f"{indent}  Consul — {consul['name']} ({consul['dates']}), {consul['lineage']}. "
            f"Seated because: {consul['chosen_because']} {consul['voice_notes']}"
        )
        lines.append(render_profile(consul["id"], consul["name"], depth=depth, indent=indent + "    "))
    return "\n".join(line for line in lines if line.strip())


def render_assignments(assignments: list, depth: str = "auto") -> str:
    """Who is playing whom.

    Depth adapts to how crowded the table is: a two-team exercise can afford
    full character sheets, a five-team one cannot without burying the brief.
    """
    if depth == "auto":
        seated = sum(len(a["teams"]) for a in assignments)
        depth = "full" if seated <= 2 else "brief"

    blocks = []
    for a in assignments:
        teams = "\n\n".join(
            render_team(find_team(tid), indent="    ", depth=depth)
            for tid in a["teams"] if find_team(tid)
        )
        blocks.append(f"ACTOR: {a['actor']}\n  Advised by:\n\n{teams}")
    return "\n\n".join(blocks)


TEAM_RULES = """Rules for every team:
- The three voices are not interchangeable. The leader decides, but a consul who merely agrees with his principal is a wasted seat — each was chosen for the thing he tells his leader that his leader does not want to hear.
- Reason only from the brief and from what has already happened in this scenario. If you need a fact you do not have, say what you would need to know.
- No anachronism games. Each figure translates his own doctrine to present conditions and names the modern instrument that does the work his old one did.
- Concrete over grand. "Move the carrier group" beats "project strength".

""" + FIDELITY_RULE


# --------------------------------------------------------------------------- #
# Mode one — the Projection                                                   #
# --------------------------------------------------------------------------- #

def projection_prompt(team: dict, horizon: int = 5) -> str:
    """One team forecasts the world over the horizon."""
    return f"""You are a team in The War Room of Cerebral Cortex, working from a neutral intelligence brief.

{render_team(team)}

{WARROOM_ANALYSIS_BOUNDARY}

{TEAM_RULES}

Your task is the PROJECTION: how the next {horizon} years run, if nobody in this room intervenes. Not what should be done — what happens. You are forecasting, and you will be graded against events.

The projection must be this team's, visibly. A projection any of the other four teams could have written is a failure. Where your leader and his consuls disagree about the future, record the disagreement rather than averaging it away; the consuls were seated to argue.

Be specific enough to be wrong. Name actors, name the pressure that moves them, name roughly when. Vague forecasts are worthless because they cannot fail.

Respond as STRICT JSON ONLY (no prose before or after, no markdown fences):
{{
  "trajectory": "<3–5 sentences. The through-line of the next {horizon} years as this team reads it.>",
  "phases": [
    {{ "window": "Year 1", "expect": "<what happens in this window>", "why": "<the pressure driving it, in this team's doctrine>" }}
  ],
  "flashpoints": [
    {{ "where": "<place or relationship>", "trigger": "<the specific thing that sets it off>", "odds": "likely|possible|unlikely" }}
  ],
  "wildcards": ["<a low-probability development that would rewrite this projection>"],
  "internal_dissent": [
    {{ "who": "<the leader or one of his consuls>", "objection": "<where he breaks with his own team's projection and why>" }}
  ],
  "signature": "<one sentence: what this team saw that the others will miss.>"
}}

Give exactly {horizon} phases, one per year, in order. Give 2–4 flashpoints, 1–3 wildcards, and at least one internal dissent — if the three of you agreed about everything, you have written them wrong."""


def projection_compare_prompt(horizon: int = 5) -> str:
    """Read the teams' projections against each other."""
    return f"""You are the chief of staff of The War Room. Every team has projected the next {horizon} years from the same brief. Their projections are below.

Your task is to read them against each other. Not to summarise — to find where five different doctrines, given identical facts, produced different futures, and to say what that difference is actually about.

Rules:
- Consensus across genuinely different doctrine is the strongest signal available here. Where four or five teams independently expect the same thing, say so and say why it is overdetermined.
- A lone dissenter is not automatically wrong. Where one team sees something the others missed, name what in its doctrine let it see that.
- The divergences must be traced to method, not mood. Teams differ because one reads intentions and another reads capabilities, because one counts logistics and another counts legitimacy.
- Name the single question on which the projections most depend — the fact that, if known, would collapse most of the disagreement.

Respond as STRICT JSON ONLY (no prose, no markdown):
{{
  "consensus": "<2–4 sentences. What the teams agree on despite different doctrine, and why that agreement is hard to dismiss.>",
  "divergences": [
    {{ "question": "<the thing they disagree about>", "positions": [{{ "team": "<leader's name>", "holds": "<their position in a phrase>" }}], "root": "<the doctrinal reason for the split>" }}
  ],
  "lone_signals": [
    {{ "team": "<leader's name>", "saw": "<what only this team flagged>", "worth_taking_seriously_because": "<one sentence>" }}
  ],
  "hinge_question": "<the one unknown that most of the disagreement depends on.>",
  "if_you_watch_one_thing": "<the single most informative observable over the next year.>"
}}

Give 2–4 divergences and 0–3 lone signals."""


# --------------------------------------------------------------------------- #
# Mode two — the scenario: teams take the wheel                               #
# --------------------------------------------------------------------------- #

def scenario_opening_prompt(assignments: list, horizon: int, mode_note: str) -> str:
    """Each actor's council sets doctrine, objectives and opening posture."""
    return f"""You are running a strategic exercise in The War Room of Cerebral Cortex, in the tradition of Eisenhower's Project Solarium — competing teams, identical intelligence, different strategies.

{mode_note}

THE TABLE:

{render_assignments(assignments)}

{WARROOM_ANALYSIS_BOUNDARY}

{TEAM_RULES}

This is turn zero. Before anyone moves, each actor's council must settle what it is actually trying to achieve over the next {horizon} years, and what it will not do.

The councils are not unanimous and must not pretend to be. Where an actor is advised by several teams, the split between those teams is the most important thing you can record — a government advised by both Genghis Khan and Dwight Eisenhower is a government at war with itself before it faces anyone else.

Objectives must be things that can be achieved or missed, not aspirations. "Keep the strait open to commercial traffic" is an objective. "Maintain regional stability" is a wish.

Respond as STRICT JSON ONLY (no prose, no markdown):
{{
  "actors": [
    {{
      "actor": "<actor name exactly as given above>",
      "doctrine": "<2–4 sentences. How this council will approach the next {horizon} years, in the voice of the teams advising it.>",
      "objectives": ["<a concrete, checkable objective>"],
      "red_lines": ["<what this actor will not accept, and what it does if that line is crossed>"],
      "assets": "<what this actor is actually bringing, per the brief>",
      "constraints": "<what limits it — domestic, economic, alliance, geographic>",
      "opening_posture": "<2–3 sentences. Where it stands as year one begins.>",
      "council_split": "<the real disagreement among this actor's advisers, named with the team that holds each side. If a single team advises alone, the split between the leader and his consuls.>"
    }}
  ]
}}

Include every actor listed above, in that order. Give 2–4 objectives and 1–3 red lines each."""


def scenario_year_prompt(year: int, horizon: int, assignments: list, mode_note: str) -> str:
    """One year of play: everyone moves, the moves collide, the world shifts."""
    return f"""You are adjudicating year {year} of {horizon} in a War Room exercise.

{mode_note}

THE TABLE:

{render_assignments(assignments)}

{WARROOM_ANALYSIS_BOUNDARY}

{TEAM_RULES}

The brief, the opening postures, and every year already played are below. Play year {year}.

How to adjudicate:
- Each actor moves once per year — a small number of real decisions, not a wish list. Two to four moves.
- Attribute each move. Say which team pushed for it and which team lost that argument. The internal fight is half the exercise.
- Moves interact. An actor does not get its intended effect merely by intending it; the other side responds, third parties react, and markets and publics have votes. Adjudicate honestly, including against the team you might find most persuasive.
- Every move costs something — money, casualties, credibility, an alliance, domestic support, optionality. Name the cost. A year in which nobody pays anything has been played wrong.
- Include one development nobody planned. Friction is real: a death, a weather event, an election, an accident at sea, a leak, a market break. It must be plausible given the brief and it must complicate somebody's plan.
- Do not let the exercise drift into fantasy. No miracle technologies, no actor behaving out of character, no five-year problem solved in one year.

Respond as STRICT JSON ONLY (no prose, no markdown):
{{
  "year": {year},
  "moves": [
    {{
      "actor": "<actor name>",
      "move": "<what it actually does — concrete>",
      "pushed_by": "<the team or voice that argued for it>",
      "opposed_by": "<the team or voice that argued against, or 'unopposed'>",
      "rationale": "<why the council went this way>",
      "cost": "<what it costs, named plainly>"
    }}
  ],
  "friction": "<the development nobody planned, and who it hurts.>",
  "interaction": "<2–4 sentences. How the moves collide — what actually results rather than what was intended.>",
  "world_state": "<2–4 sentences. Where things stand at the end of year {year}.>",
  "escalation": "easing|steady|rising|acute|open conflict",
  "scorecard": [
    {{ "actor": "<actor name>", "gained": "<what it got>", "lost": "<what it paid>" }}
  ]
}}

Every actor must move and appear in the scorecard."""


def scenario_debrief_prompt(horizon: int) -> str:
    """After the last year: what happened, who read it right, what it cost."""
    return f"""You are the chief of staff of The War Room. The {horizon}-year exercise has run its course. The brief, the opening postures and every year of play are below.

Write the debrief. This is the part a decision-maker keeps.

Rules:
- Say what actually happened, including whether anyone achieved the objectives they set in turn zero. Score them against their own stated goals, not against a standard you invent now.
- Name the turning point — the specific year and move after which the rest followed. There is usually one.
- Say which commander's doctrine held up and which did not, and be willing to conclude that the boldest team lost. Several of these men were destroyed by their own signature move; if that happened here, say so.
- Count the cost honestly, including to people who were never at the table. A strategy that achieves its objectives at ruinous cost has not succeeded.
- End with what a real decision-maker should take from this. Not "it depends" — the actual transferable lesson, and the one assumption in this exercise that, if wrong, would void it.

Respond as STRICT JSON ONLY (no prose, no markdown):
{{
  "outcome": "<3–5 sentences. Where the world ended up after {horizon} years.>",
  "objectives_scored": [
    {{ "actor": "<actor>", "objective": "<as set in turn zero>", "result": "achieved|partial|missed", "note": "<one sentence>" }}
  ],
  "turning_point": "<the year and the move after which the rest was largely determined, and why.>",
  "doctrine_held": [
    {{ "team": "<leader's name>", "verdict": "vindicated|mixed|refuted", "why": "<one or two sentences>" }}
  ],
  "cost_ledger": [ {{ "who": "<actor, population or third party>", "paid": "<what it cost them>" }} ],
  "transferable_lesson": "<2–4 sentences. What a decision-maker facing this situation should actually take away.>",
  "load_bearing_assumption": "<the one assumption this whole exercise rests on. If it is wrong, none of the above holds.>"
}}

Score every objective set in turn zero, and give a verdict on every team that played."""


# --------------------------------------------------------------------------- #
# Mode notes                                                                  #
# --------------------------------------------------------------------------- #

def mode_note(assignments: list) -> str:
    """One line telling the model what shape of exercise this is."""
    if len(assignments) == 1:
        a = assignments[0]
        n = len(a["teams"])
        return (
            f"MODE: single actor. All {n} team{'s' if n != 1 else ''} sit as one war council "
            f"advising {a['actor']}. They do not agree, and {a['actor']} must act anyway. "
            "There is no opposing council at this table — the rest of the world is played "
            "as it would realistically behave, not as a passive backdrop."
        )
    sides = " versus ".join(a["actor"] for a in assignments)
    return (
        f"MODE: confrontation. {sides}. Each actor is advised by its own teams and acts in "
        "its own interest. Play each side as hard as its advisers would play it; do not "
        "let one side win because its commanders are more famous."
    )


__all__ = [
    "mode_note",
    "projection_compare_prompt",
    "projection_prompt",
    "render_assignments",
    "render_team",
    "scenario_debrief_prompt",
    "scenario_opening_prompt",
    "scenario_year_prompt",
]
