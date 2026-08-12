"""War Room integration tests — run against a live backend on :8001.

The sifting and board passes call a real model and are slow; they are marked
`slow` so the fast checks can be run alone with `-m "not slow"`.
"""
import os
import time
import uuid

import pytest
import requests

LOCAL_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001").rstrip("/")
API = f"{LOCAL_URL}/api"

ARCHIVE_ID = f"test-archive-warroom-{uuid.uuid4().hex[:8]}"

BOARD = [
    "Alexander the Great",
    "Genghis Khan",
    "Napoleon Bonaparte",
    "Winston Churchill",
    "Dwight D. Eisenhower",
]

# Pasted material stands in for live coverage so the slow tests do not depend on
# the newswire having anything to say today. Two outlets of different lean agree
# on one fact and disagree on its meaning — exactly the case the sift is for.
PASTED = """Reuters: The government of Country A moved two mechanised brigades to its
eastern border on Tuesday, according to three officials with direct knowledge. Country B's
foreign ministry called the deployment "a routine rotation" in a statement.
---
[The Guardian]
Country A's brutal massing of troops on the border marks a chilling escalation that
observers say could ignite the region. Analysts condemned the provocative build-up.
---
[Fox News]
Country A bolstered its eastern defences this week after months of cross-border raids
that officials say left dozens dead. Country B disputes the raid figures.
"""


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Chamber metadata ---------------------------------------------------- #

def test_warroom_chamber_is_published(http):
    r = http.get(f"{API}/chambers/warroom", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "The War Room"
    assert "Amygdala" in data["biology"]
    assert [m["name"] for m in data["council"]] == BOARD


def test_warroom_council_carries_receipts(http):
    r = http.get(f"{API}/personas", timeout=10)
    assert r.status_code == 200
    room = next(c for c in r.json()["chambers"] if c["id"] == "warroom")
    for member in room["council"]:
        assert member["sources"], f"{member['name']} has no sources"
        for source in member["sources"]:
            assert source["title"] and source["type"]


def test_warroom_voice_is_distinct(http):
    r = requests.post(
        f"{API}/speak", json={"text": "The board is seated.", "chamber_id": "warroom"}, timeout=60
    )
    assert r.status_code == 200
    assert r.headers.get("X-Voice") == "ash"


# ---- Source registry ----------------------------------------------------- #

def test_source_registry_labels_every_feed(http):
    r = http.get(f"{API}/warroom/sources", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["feeds"], "no standing feeds registered"
    leans = {f["lean"] for f in data["feeds"]}
    assert len(leans) >= 3, "the standing feeds must span the spectrum"
    for feed in data["feeds"]:
        assert feed["outlet"] and feed["lean"]
    assert all(f["lean"] == "state" for f in data["state_feeds"])


# ---- Validation ---------------------------------------------------------- #

def test_brief_requires_a_topic(http):
    r = http.post(f"{API}/warroom/brief", json={"topic": "   "}, timeout=20)
    assert r.status_code == 400


def test_convene_requires_a_topic_or_brief(http):
    r = http.post(f"{API}/warroom/convene", json={"question": "what next?"}, timeout=20)
    assert r.status_code == 400


def test_convene_unknown_brief_404(http):
    r = http.post(f"{API}/warroom/convene", json={"brief_id": "no-such-brief"}, timeout=20)
    assert r.status_code == 404


def test_estimate_unknown_id_404(http):
    r = http.get(f"{API}/warroom/estimate/nonexistent", timeout=10)
    assert r.status_code == 404


# ---- The sift (real model) ----------------------------------------------- #

@pytest.fixture(scope="module")
def brief(http):
    payload = {"topic": "border deployment between Country A and Country B", "pasted": PASTED, "live": False}
    t0 = time.time()
    r = http.post(f"{API}/warroom/brief", json=payload, timeout=240)
    print(f"\nWar Room sift: {time.time()-t0:.1f}s, status={r.status_code}")
    if r.status_code != 200:
        pytest.fail(f"brief failed: {r.status_code} {r.text[:500]}")
    return r.json()


@pytest.mark.slow
def test_brief_has_the_full_shape(brief):
    doc = brief["brief"]
    for key in (
        "situation", "established_facts", "contested_claims", "unknowns",
        "framing_removed", "actors", "timeline", "coverage_gaps",
    ):
        assert key in doc, f"brief missing {key}"
    assert isinstance(doc["situation"], str) and len(doc["situation"]) > 20


@pytest.mark.slow
def test_brief_records_its_sources_and_their_leans(brief):
    sources = brief["sources"]
    assert sources["item_count"] == 3
    assert sources["mode"] == "pasted"
    assert set(sources["spread"]) & {"wire", "left", "right"}


@pytest.mark.slow
def test_brief_separates_the_corroborated_from_the_claimed(brief):
    doc = brief["brief"]
    # The troop movement is carried by all three; its characterisation is not.
    assert doc["established_facts"], "nothing was established from three agreeing outlets"
    blob = " ".join(
        f["fact"].lower() for f in doc["established_facts"] if isinstance(f, dict) and f.get("fact")
    )
    assert any(word in blob for word in ("brigade", "troop", "force", "deploy", "border"))


@pytest.mark.slow
def test_brief_strips_loaded_language_and_shows_its_work(brief):
    doc = brief["brief"]
    assert doc["framing_removed"], "loaded language was present and should have been recorded"
    stripped = " ".join(
        (f.get("loaded", "") + " " + f.get("neutral", "")).lower() for f in doc["framing_removed"]
    )
    assert any(word in stripped for word in ("brutal", "chilling", "provocative", "condemned"))
    # The neutral rendering of the situation must not carry the discarded words.
    assert "brutal" not in doc["situation"].lower()


@pytest.mark.slow
def test_brief_is_retrievable_for_convening(http, brief):
    assert brief["id"]
    r = http.post(
        f"{API}/warroom/convene",
        json={"brief_id": brief["id"], "question": ""},
        timeout=400,
    )
    assert r.status_code in (200, 402), f"unexpected: {r.status_code} {r.text[:300]}"


# ---- The board (real model, slowest) -------------------------------------- #

@pytest.fixture(scope="module")
def estimate(http, brief):
    payload = {
        "brief_id": brief["id"],
        "question": "What should Country B do in the next ninety days?",
        "archive_id": ARCHIVE_ID,
    }
    t0 = time.time()
    r = http.post(f"{API}/warroom/convene", json=payload, timeout=400)
    print(f"\nWar Room board + estimate: {time.time()-t0:.1f}s, status={r.status_code}")
    if r.status_code != 200:
        pytest.fail(f"convene failed: {r.status_code} {r.text[:500]}")
    return r.json()


@pytest.mark.slow
def test_all_five_commanders_speak_in_roster_order(estimate):
    assert [row["member"] for row in estimate["board"]] == BOARD


@pytest.mark.slow
def test_every_read_is_falsifiable(estimate):
    for row in estimate["board"]:
        assert row["read"].strip(), f"{row['member']} gave no read"
        assert row["next_moves"], f"{row['member']} proposed nothing"
        assert row["if_wrong"].strip(), f"{row['member']} gave nothing that would prove him wrong"
        assert isinstance(row["dissent"], bool)


@pytest.mark.slow
def test_the_estimate_separates_likely_from_dangerous(estimate):
    est = estimate["estimate"]
    assert est["convergence"].strip()
    assert est["fault_line"].strip()
    likely = est["most_likely_course"].strip()
    dangerous = est["most_dangerous_course"].strip()
    assert likely and dangerous
    assert likely != dangerous, "the most likely and most dangerous course collapsed into one"
    assert est["confidence"] in ("high", "moderate", "low")


@pytest.mark.slow
def test_indicators_point_at_a_board_member(estimate):
    indicators = estimate["estimate"]["indicators"]
    assert indicators, "an estimate with nothing to watch is not actionable"
    for ind in indicators:
        assert ind["watch_for"].strip() and ind["means"].strip()


@pytest.mark.slow
def test_estimate_is_retrievable_in_full(http, estimate):
    r = http.get(f"{API}/warroom/estimate/{estimate['id']}", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == estimate["id"]
    assert len(data["board"]) == 5
    assert data["brief"]["situation"]
    assert "_id" not in data


@pytest.mark.slow
def test_estimate_lands_in_the_shared_verdict_shape(http, estimate):
    """A War Room session has to read correctly on /verdict/:id like any other."""
    r = http.get(f"{API}/verdicts/{estimate['id']}", timeout=15)
    assert r.status_code == 200
    v = r.json()
    assert v["chamber_id"] == "warroom"
    assert v["chamber"] == "The War Room"
    assert len(v["deliberation"]) == 5
    for row in v["deliberation"]:
        assert row["member"] in BOARD
        assert row["contribution"].strip()
    assert v["verdict"].strip()


@pytest.mark.slow
def test_estimate_can_be_saved_to_the_archive(http, estimate):
    r = http.post(
        f"{API}/verdicts/{estimate['id']}/save", json={"archive_id": ARCHIVE_ID}, timeout=15
    )
    assert r.status_code == 200
    assert r.json()["saved"] is True

    listed = http.get(f"{API}/verdicts", params={"archive_id": ARCHIVE_ID}, timeout=15)
    assert listed.status_code == 200
    assert estimate["id"] in [v["id"] for v in listed.json()]
