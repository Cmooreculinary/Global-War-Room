"""Team-mode integration tests — run against a live backend on :8001.

Projections and scenarios cost one model call per stage, so the runs
themselves are marked `slow` and use a short horizon.
"""
import os
import time
import uuid

import pytest
import requests

LOCAL_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001").rstrip("/")
API = f"{LOCAL_URL}/api"

ARCHIVE_ID = f"test-archive-scenario-{uuid.uuid4().hex[:8]}"

TEAM_IDS = ["alexander", "genghis", "napoleon", "churchill_war", "eisenhower"]

PASTED = """Reuters: Country A moved two mechanised brigades to its eastern border on Tuesday,
according to three officials. Country B called the deployment a routine rotation.
---
[The Guardian]
Country A's brutal massing of troops marks a chilling escalation, analysts said.
---
[Fox News]
Country A bolstered its eastern defences after months of cross-border raids.
"""


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _poll(http, run_id, timeout=900, interval=5):
    """Wait for a run to finish, returning the final document."""
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        r = http.get(f"{API}/warroom/run/{run_id}", timeout=20)
        assert r.status_code == 200, f"poll failed: {r.status_code} {r.text[:300]}"
        last = r.json()
        if last["status"] in ("complete", "error"):
            return last
        time.sleep(interval)
    pytest.fail(f"run {run_id} did not finish in {timeout}s; last stage={last and last.get('progress')}")


# ---- Rosters -------------------------------------------------------------- #

def test_teams_endpoint_returns_five_teams_of_three(http):
    r = http.get(f"{API}/warroom/teams", timeout=10)
    assert r.status_code == 200
    teams = r.json()["teams"]
    assert [t["id"] for t in teams] == TEAM_IDS
    for team in teams:
        assert team["leader"]["name"]
        assert len(team["consuls"]) == 2
        for consul in team["consuls"]:
            assert consul["chosen_because"].strip()
            assert consul["sources"]


def test_consuls_are_published_on_the_personas_endpoint(http):
    """The Receipts page reads /personas — the consuls must carry sources there too."""
    r = http.get(f"{API}/personas", timeout=10)
    assert r.status_code == 200
    room = next(c for c in r.json()["chambers"] if c["id"] == "warroom")
    for member in room["council"]:
        assert len(member["consuls"]) == 2
        for consul in member["consuls"]:
            assert consul["sources"] and consul["chosen_because"]


def test_other_chambers_seat_no_consuls(http):
    r = http.get(f"{API}/personas", timeout=10)
    senate = next(c for c in r.json()["chambers"] if c["id"] == "senate")
    for member in senate["council"]:
        assert not member.get("consuls")


# ---- Validation ----------------------------------------------------------- #

def test_scenario_rejects_an_assignment_with_no_teams(http):
    r = http.post(f"{API}/warroom/scenario", json={
        "topic": "x", "assignments": [{"actor": "United States", "teams": []}],
    }, timeout=30)
    assert r.status_code == 400


def test_scenario_rejects_an_unnamed_actor(http):
    r = http.post(f"{API}/warroom/scenario", json={
        "topic": "x", "assignments": [{"actor": "  ", "teams": ["genghis"]}],
    }, timeout=30)
    assert r.status_code == 400


def test_projection_requires_a_topic_or_brief(http):
    r = http.post(f"{API}/warroom/projection", json={"horizon_years": 3}, timeout=30)
    assert r.status_code == 400


def test_horizon_outside_the_range_is_rejected(http):
    r = http.post(f"{API}/warroom/projection", json={"topic": "x", "horizon_years": 40}, timeout=30)
    assert r.status_code == 422


def test_unknown_run_404(http):
    r = http.get(f"{API}/warroom/run/nonexistent", timeout=10)
    assert r.status_code == 404


# ---- A brief to run the modes against ------------------------------------- #

@pytest.fixture(scope="module")
def brief(http):
    r = http.post(f"{API}/warroom/brief", json={
        "topic": "border deployment between Country A and Country B",
        "pasted": PASTED,
        "live": False,
    }, timeout=240)
    if r.status_code != 200:
        pytest.fail(f"brief failed: {r.status_code} {r.text[:400]}")
    return r.json()


# ---- Projections ---------------------------------------------------------- #

@pytest.mark.slow
def test_projection_run_completes_for_every_team(http, brief):
    r = http.post(f"{API}/warroom/projection", json={
        "brief_id": brief["id"], "horizon_years": 3, "archive_id": ARCHIVE_ID,
    }, timeout=60)
    assert r.status_code == 202
    run = _poll(http, r.json()["run_id"])
    assert run["status"] == "complete", run.get("error")

    assert len(run["projections"]) == 5
    assert {p["team"] for p in run["projections"]} == set(TEAM_IDS)
    for p in run["projections"]:
        assert p["trajectory"].strip()
        assert len(p["phases"]) == 3, "one phase per year of the horizon"
        assert p["signature"].strip()


@pytest.mark.slow
def test_projections_differ_between_teams(http, brief):
    """Five doctrines given one brief should not produce one forecast."""
    r = http.post(f"{API}/warroom/projection", json={
        "brief_id": brief["id"], "horizon_years": 3, "teams": ["genghis", "eisenhower"],
    }, timeout=60)
    run = _poll(http, r.json()["run_id"])
    assert run["status"] == "complete"
    trajectories = [p["trajectory"] for p in run["projections"]]
    assert len(set(trajectories)) == len(trajectories), "two teams produced the same trajectory"


@pytest.mark.slow
def test_projection_comparison_names_the_hinge(http, brief):
    r = http.post(f"{API}/warroom/projection", json={
        "brief_id": brief["id"], "horizon_years": 3, "teams": ["genghis", "eisenhower", "churchill_war"],
    }, timeout=60)
    run = _poll(http, r.json()["run_id"])
    comparison = run["comparison"]
    assert comparison["consensus"].strip()
    assert comparison["hinge_question"].strip()


# ---- Scenarios ------------------------------------------------------------ #

@pytest.mark.slow
def test_single_actor_scenario_plays_the_horizon(http, brief):
    r = http.post(f"{API}/warroom/scenario", json={
        "brief_id": brief["id"],
        "horizon_years": 3,
        "assignments": [{"actor": "Country B", "teams": TEAM_IDS}],
        "archive_id": ARCHIVE_ID,
    }, timeout=60)
    assert r.status_code == 202
    run = _poll(http, r.json()["run_id"])
    assert run["status"] == "complete", run.get("error")

    assert len(run["opening"]) == 1
    assert run["opening"][0]["objectives"], "an actor must set objectives at turn zero"
    assert run["opening"][0]["council_split"], "five teams advising one actor cannot be unanimous"
    assert [y["year"] for y in run["years"]] == [1, 2, 3]
    for year in run["years"]:
        assert year["moves"], f"year {year['year']} has no moves"
        assert year["world_state"].strip()
        for move in year["moves"]:
            assert move["cost"].strip(), "every move must name what it cost"


@pytest.mark.slow
def test_confrontation_plays_both_sides(http, brief):
    r = http.post(f"{API}/warroom/scenario", json={
        "brief_id": brief["id"],
        "horizon_years": 3,
        "assignments": [
            {"actor": "Country A", "teams": ["genghis", "napoleon"]},
            {"actor": "Country B", "teams": ["eisenhower", "churchill_war"]},
        ],
    }, timeout=60)
    assert r.status_code == 202
    run = _poll(http, r.json()["run_id"])
    assert run["status"] == "complete", run.get("error")

    assert [a["actor"] for a in run["opening"]] == ["Country A", "Country B"]
    for year in run["years"]:
        actors = {m["actor"] for m in year["moves"]}
        assert len(actors) == 2, f"year {year['year']} only moved one side"
        assert year["escalation"] in ("easing", "steady", "rising", "acute", "open conflict")


@pytest.mark.slow
def test_debrief_scores_the_objectives_it_started_with(http, brief):
    r = http.post(f"{API}/warroom/scenario", json={
        "brief_id": brief["id"],
        "horizon_years": 2,
        "assignments": [{"actor": "Country B", "teams": ["eisenhower", "genghis"]}],
    }, timeout=60)
    run = _poll(http, r.json()["run_id"])
    debrief = run["debrief"]
    assert debrief["outcome"].strip()
    assert debrief["transferable_lesson"].strip()
    assert debrief["load_bearing_assumption"].strip()
    assert debrief["objectives_scored"], "the debrief must score turn zero's objectives"
    for scored in debrief["objectives_scored"]:
        assert scored["result"] in ("achieved", "partial", "missed")


@pytest.mark.slow
def test_partial_results_stream_while_a_run_is_going(http, brief):
    """A client polling mid-run should see years land one at a time."""
    r = http.post(f"{API}/warroom/scenario", json={
        "brief_id": brief["id"],
        "horizon_years": 3,
        "assignments": [{"actor": "Country B", "teams": ["genghis"]}],
    }, timeout=60)
    run_id = r.json()["run_id"]

    saw_running = False
    deadline = time.time() + 900
    while time.time() < deadline:
        doc = http.get(f"{API}/warroom/run/{run_id}", timeout=20).json()
        if doc["status"] == "running" and doc.get("progress", {}).get("stage"):
            saw_running = True
        if doc["status"] in ("complete", "error"):
            break
        time.sleep(4)

    assert saw_running, "the run never reported an in-progress stage"
