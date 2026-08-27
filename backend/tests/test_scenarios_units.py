"""Team, projection and scenario unit tests. No network, no model."""
import asyncio

import pytest

import scenario_service as ss
from personas import CHAMBERS, find_team, team_ids, team_label
from war_scenarios import mode_note, render_assignments, render_team

ALL_TEAMS = ["alexander", "genghis", "napoleon", "churchill_war", "eisenhower"]


# ---- Rosters -------------------------------------------------------------- #

def test_every_commander_seats_exactly_two_consuls():
    for member in CHAMBERS["warroom"]["council"]:
        consuls = member.get("consuls")
        assert consuls and len(consuls) == 2, f"{member['name']} does not have two consuls"


def test_consuls_carry_receipts_and_a_reason_for_being_there():
    for member in CHAMBERS["warroom"]["council"]:
        for consul in member["consuls"]:
            assert consul["chosen_because"].strip(), f"{consul['name']} has no stated reason"
            assert consul["voice_notes"].strip()
            assert len(consul["sources"]) >= 3, f"{consul['name']} needs receipts"
            for source in consul["sources"]:
                assert source["title"] and source["type"]


def test_no_consul_is_seated_twice_and_none_duplicates_a_leader():
    leaders = {m["name"] for m in CHAMBERS["warroom"]["council"]}
    seen = []
    for member in CHAMBERS["warroom"]["council"]:
        for consul in member["consuls"]:
            seen.append(consul["name"])
            assert consul["name"] not in leaders, f"{consul['name']} already has a seat"
    assert len(seen) == len(set(seen)), "a consul is seated on two teams"


def test_team_ids_match_the_roster():
    assert team_ids() == ALL_TEAMS
    assert team_label("genghis") == "Genghis Khan"
    assert team_label("nobody") == "nobody"


def test_find_team_returns_a_leader_and_two_consuls():
    team = find_team("eisenhower")
    assert team["leader"]["name"] == "Dwight D. Eisenhower"
    assert [c["name"] for c in team["consuls"]] == ["George C. Marshall", "George F. Kennan"]
    assert "consuls" not in team["leader"], "the leader blob should not nest its own consuls"


def test_find_team_is_none_for_an_unknown_id():
    assert find_team("hannibal") is None


def test_render_team_names_all_three_voices():
    rendered = render_team(find_team("napoleon"))
    for name in ("Napoleon Bonaparte", "Louis-Alexandre Berthier", "Charles-Maurice de Talleyrand"):
        assert name in rendered
    assert "Seated because" in rendered


# ---- Assignments ---------------------------------------------------------- #

def test_sanitize_keeps_a_well_formed_single_actor_assignment():
    cleaned = ss.sanitize_assignments([{"actor": "United States", "teams": ALL_TEAMS}])
    assert cleaned == [{"actor": "United States", "teams": ALL_TEAMS}]


def test_sanitize_drops_unknown_teams_and_unnamed_actors():
    cleaned = ss.sanitize_assignments([
        {"actor": "China", "teams": ["genghis", "sun_tzu"]},
        {"actor": "   ", "teams": ["napoleon"]},
        {"actor": "India", "teams": []},
        "not a dict",
    ])
    assert cleaned == [{"actor": "China", "teams": ["genghis"]}]


def test_a_team_cannot_advise_both_sides():
    cleaned = ss.sanitize_assignments([
        {"actor": "United States", "teams": ["eisenhower", "churchill_war"]},
        {"actor": "China", "teams": ["churchill_war", "genghis"]},
    ])
    assert cleaned[0]["teams"] == ["eisenhower", "churchill_war"]
    assert cleaned[1]["teams"] == ["genghis"], "the duplicated team must be dropped from the second side"


def test_an_actor_left_with_no_teams_after_dedupe_is_dropped():
    cleaned = ss.sanitize_assignments([
        {"actor": "United States", "teams": ["eisenhower"]},
        {"actor": "China", "teams": ["eisenhower"]},
    ])
    assert [a["actor"] for a in cleaned] == ["United States"]


def test_sanitize_dedupes_a_team_repeated_within_one_actor():
    cleaned = ss.sanitize_assignments([{"actor": "US", "teams": ["genghis", "genghis"]}])
    assert cleaned[0]["teams"] == ["genghis"]


def test_sanitize_caps_the_number_of_actors():
    raw = [{"actor": f"Actor {i}", "teams": [t]} for i, t in enumerate(ALL_TEAMS)]
    assert len(ss.sanitize_assignments(raw)) == ss.MAX_ACTORS


def test_horizon_is_clamped_to_a_playable_range():
    assert ss.clamp_horizon(5) == 5
    assert ss.clamp_horizon(0) == ss.MIN_HORIZON
    assert ss.clamp_horizon(99) == ss.MAX_HORIZON
    assert ss.clamp_horizon("nonsense") == 5
    assert ss.clamp_horizon(None) == 5


# ---- Mode selection ------------------------------------------------------- #

def test_one_actor_is_a_single_actor_exercise():
    note = mode_note([{"actor": "United States", "teams": ALL_TEAMS}])
    assert "single actor" in note
    assert "United States" in note


def test_several_actors_is_a_confrontation():
    note = mode_note([
        {"actor": "United States", "teams": ["eisenhower"]},
        {"actor": "China", "teams": ["genghis"]},
    ])
    assert "confrontation" in note
    assert "United States versus China" in note


def test_render_assignments_shows_each_actors_advisers():
    rendered = render_assignments([
        {"actor": "United States", "teams": ["eisenhower"]},
        {"actor": "China", "teams": ["genghis"]},
    ])
    assert "ACTOR: United States" in rendered and "George C. Marshall" in rendered
    assert "ACTOR: China" in rendered and "Subutai" in rendered


def test_describe_assignments_is_human_readable():
    described = ss.describe_assignments([
        {"actor": "United States", "teams": ["eisenhower", "churchill_war"]},
    ])
    assert described == "United States (Dwight D. Eisenhower, Winston Churchill)"


# ---- Projections ---------------------------------------------------------- #

BRIEF = {"situation": "Two states are massing on a shared border.", "established_facts": []}


def _projection_payload(n_phases=5):
    return {
        "trajectory": "It hardens.",
        "phases": [{"window": f"Year {i+1}", "expect": "x", "why": "y"} for i in range(n_phases)],
        "flashpoints": [{"where": "the strait", "trigger": "a closure", "odds": "possible"}],
        "wildcards": ["a succession crisis"],
        "internal_dissent": [{"who": "Parmenion", "objection": "too fast"}],
        "signature": "distance kills.",
    }


def test_run_projections_covers_every_team_and_compares_them(monkeypatch):
    calls = []

    async def fake_ask(system, _user, **_kw):
        calls.append(system)
        if "read them against each other" in system:
            return {"consensus": "They agree the window closes.", "divergences": [], "hinge_question": "q"}
        return _projection_payload()

    monkeypatch.setattr(ss, "_ask_json", fake_ask)
    result = asyncio.run(ss.run_projections(BRIEF, horizon=5))

    assert len(result["projections"]) == 5
    assert [p["team"] for p in result["projections"]] == ALL_TEAMS
    assert result["comparison"]["consensus"]
    assert len(calls) == 6, "one call per team plus the comparison"


def test_run_projections_honours_a_team_subset(monkeypatch):
    async def fake_ask(system, _user, **_kw):
        return {"consensus": "x"} if "read them against each other" in system else _projection_payload()

    monkeypatch.setattr(ss, "_ask_json", fake_ask)
    result = asyncio.run(ss.run_projections(BRIEF, teams=["genghis", "eisenhower"]))
    assert [p["team"] for p in result["projections"]] == ["genghis", "eisenhower"]


def test_run_projections_survives_one_team_failing(monkeypatch):
    async def fake_ask(system, _user, **_kw):
        if "read them against each other" in system:
            return {"consensus": "x"}
        if "Genghis Khan" in system:
            raise RuntimeError("model hiccup")
        return _projection_payload()

    monkeypatch.setattr(ss, "_ask_json", fake_ask)
    result = asyncio.run(ss.run_projections(BRIEF))
    assert len(result["projections"]) == 4
    assert "genghis" not in [p["team"] for p in result["projections"]]


def test_run_projections_raises_only_when_every_team_fails(monkeypatch):
    async def dead(*_a, **_kw):
        raise RuntimeError("down")

    monkeypatch.setattr(ss, "_ask_json", dead)
    with pytest.raises(RuntimeError):
        asyncio.run(ss.run_projections(BRIEF))


def test_projection_phases_are_capped_to_the_horizon(monkeypatch):
    async def fake_ask(system, _user, **_kw):
        return {"consensus": "x"} if "read them against each other" in system else _projection_payload(n_phases=9)

    monkeypatch.setattr(ss, "_ask_json", fake_ask)
    result = asyncio.run(ss.run_projections(BRIEF, horizon=3, teams=["alexander"]))
    assert len(result["projections"][0]["phases"]) == 3


def test_comparison_failure_leaves_the_projections_intact(monkeypatch):
    async def fake_ask(system, _user, **_kw):
        if "read them against each other" in system:
            raise RuntimeError("synthesis down")
        return _projection_payload()

    monkeypatch.setattr(ss, "_ask_json", fake_ask)
    result = asyncio.run(ss.run_projections(BRIEF, teams=["alexander"]))
    assert result["projections"], "a failed comparison must not void the projections"
    assert result["comparison"]["divergences"] == []


# ---- Scenarios ------------------------------------------------------------ #

def _opening_payload(actors):
    return {"actors": [
        {
            "actor": a,
            "doctrine": "hold",
            "objectives": ["keep the strait open"],
            "red_lines": ["a blockade"],
            "assets": "fleet",
            "constraints": "elections",
            "opening_posture": "watchful",
            "council_split": "Genghis wants to move first.",
        }
        for a in actors
    ]}


def _year_payload(actors, year):
    return {
        "year": year,
        "moves": [
            {"actor": a, "move": "reinforce", "pushed_by": "Napoleon Bonaparte",
             "opposed_by": "Dwight D. Eisenhower", "rationale": "tempo", "cost": "money"}
            for a in actors
        ],
        "friction": "a collision at sea",
        "interaction": "both sides harden",
        "world_state": f"end of year {year}",
        "escalation": "rising",
        "scorecard": [{"actor": a, "gained": "position", "lost": "goodwill"} for a in actors],
    }


def _scenario_stub(actors):
    async def fake_ask(system, _user, **_kw):
        if "turn zero" in system and "Before anyone moves" in system:
            return _opening_payload(actors)
        if "Write the debrief" in system:
            return {
                "outcome": "a frozen standoff",
                "objectives_scored": [{"actor": actors[0], "objective": "keep the strait open",
                                       "result": "partial", "note": "at cost"}],
                "turning_point": "year 2",
                "doctrine_held": [{"team": "Genghis Khan", "verdict": "mixed", "why": "reach exceeded grasp"}],
                "cost_ledger": [{"who": "shipping", "paid": "insurance"}],
                "transferable_lesson": "do not start what you cannot sustain",
                "load_bearing_assumption": "no third party intervenes",
            }
        year = int(system.split("adjudicating year ")[1].split(" ")[0])
        return _year_payload(actors, year)

    return fake_ask


def test_single_actor_scenario_plays_every_year(monkeypatch):
    monkeypatch.setattr(ss, "_ask_json", _scenario_stub(["United States"]))
    result = asyncio.run(ss.run_scenario(
        BRIEF, [{"actor": "United States", "teams": ALL_TEAMS}], horizon=5
    ))
    assert result["mode"] == "single_actor"
    assert [y["year"] for y in result["years"]] == [1, 2, 3, 4, 5]
    assert result["opening"][0]["objectives"] == ["keep the strait open"]
    assert result["debrief"]["turning_point"] == "year 2"


def test_confrontation_scenario_plays_both_sides(monkeypatch):
    actors = ["United States", "China"]
    monkeypatch.setattr(ss, "_ask_json", _scenario_stub(actors))
    result = asyncio.run(ss.run_scenario(BRIEF, [
        {"actor": "United States", "teams": ["eisenhower", "churchill_war"]},
        {"actor": "China", "teams": ["genghis", "napoleon"]},
    ], horizon=3))
    assert result["mode"] == "confrontation"
    assert len(result["years"]) == 3
    assert {m["actor"] for m in result["years"][0]["moves"]} == set(actors)


def test_scenario_reports_progress_year_by_year(monkeypatch):
    seen = []

    async def on_progress(**kw):
        seen.append((kw.get("stage"), kw.get("year")))

    monkeypatch.setattr(ss, "_ask_json", _scenario_stub(["United States"]))
    asyncio.run(ss.run_scenario(
        BRIEF, [{"actor": "United States", "teams": ["genghis"]}], horizon=2, on_progress=on_progress
    ))
    stages = [s for s, _ in seen]
    assert stages[0] == "opening"
    assert ("year_done", 1) in seen and ("year_done", 2) in seen
    assert "debrief" in stages


def test_a_failed_year_does_not_void_the_run(monkeypatch):
    base = _scenario_stub(["United States"])

    async def flaky(system, user, **kw):
        if "adjudicating year 2" in system:
            raise RuntimeError("model hiccup")
        return await base(system, user, **kw)

    monkeypatch.setattr(ss, "_ask_json", flaky)
    result = asyncio.run(ss.run_scenario(
        BRIEF, [{"actor": "United States", "teams": ["genghis"]}], horizon=3
    ))
    assert len(result["years"]) == 3
    assert result["years"][1]["moves"] == []
    assert "could not be played" in result["years"][1]["world_state"]
    assert result["years"][2]["moves"], "play must resume after a lost year"


def test_scenario_refuses_to_run_with_no_playable_assignment(monkeypatch):
    monkeypatch.setattr(ss, "_ask_json", _scenario_stub(["x"]))
    with pytest.raises(ValueError):
        asyncio.run(ss.run_scenario(BRIEF, [{"actor": "", "teams": []}]))


def test_an_actor_the_model_forgets_is_restored(monkeypatch):
    async def forgetful(system, _user, **_kw):
        if "Before anyone moves" in system:
            return _opening_payload(["United States"])  # China omitted
        if "Write the debrief" in system:
            return {"outcome": "x"}
        return _year_payload(["United States"], 1)

    monkeypatch.setattr(ss, "_ask_json", forgetful)
    result = asyncio.run(ss.run_scenario(BRIEF, [
        {"actor": "United States", "teams": ["eisenhower"]},
        {"actor": "China", "teams": ["genghis"]},
    ], horizon=1))
    assert [o["actor"] for o in result["opening"]] == ["United States", "China"]


def test_escalation_is_constrained_to_known_levels(monkeypatch):
    async def odd(system, _user, **_kw):
        if "Before anyone moves" in system:
            return _opening_payload(["US"])
        if "Write the debrief" in system:
            return {"outcome": "x"}
        payload = _year_payload(["US"], 1)
        payload["escalation"] = "thermonuclear armageddon"
        return payload

    monkeypatch.setattr(ss, "_ask_json", odd)
    result = asyncio.run(ss.run_scenario(BRIEF, [{"actor": "US", "teams": ["genghis"]}], horizon=1))
    assert result["years"][0]["escalation"] == "steady"


def test_debrief_failure_still_returns_the_played_years(monkeypatch):
    base = _scenario_stub(["US"])

    async def no_debrief(system, user, **kw):
        if "Write the debrief" in system:
            raise RuntimeError("down")
        return await base(system, user, **kw)

    monkeypatch.setattr(ss, "_ask_json", no_debrief)
    result = asyncio.run(ss.run_scenario(BRIEF, [{"actor": "US", "teams": ["genghis"]}], horizon=2))
    assert len(result["years"]) == 2
    assert result["debrief"]["objectives_scored"] == []


def test_later_years_are_given_the_earlier_ones(monkeypatch):
    """Year three must be able to see what happened in years one and two."""
    prompts = {}
    base = _scenario_stub(["US"])

    async def capture(system, user, **kw):
        if "adjudicating year" in system:
            year = int(system.split("adjudicating year ")[1].split(" ")[0])
            prompts[year] = user
        return await base(system, user, **kw)

    monkeypatch.setattr(ss, "_ask_json", capture)
    asyncio.run(ss.run_scenario(BRIEF, [{"actor": "US", "teams": ["genghis"]}], horizon=3))

    assert "no years played yet" in prompts[1]
    assert "YEAR 1" in prompts[2]
    assert "YEAR 1" in prompts[3] and "YEAR 2" in prompts[3]
    assert "keep the strait open" in prompts[3], "the opening objectives must travel with every year"
