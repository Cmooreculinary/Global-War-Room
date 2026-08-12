"""War Room unit tests — gathering, sifting shape, and board normalisation.

No network and no model. These cover the logic that decides what the board is
allowed to see, which is the part of the room worth protecting with tests.
"""
import asyncio

import pytest

import intel
import warroom_service as wr
from personas import CHAMBERS


# ---- Chamber definition -------------------------------------------------- #

def test_war_room_seats_five_named_commanders():
    council = CHAMBERS["warroom"]["council"]
    assert len(council) == 5
    assert [m["name"] for m in council] == [
        "Alexander the Great",
        "Genghis Khan",
        "Napoleon Bonaparte",
        "Winston Churchill",
        "Dwight D. Eisenhower",
    ]
    for member in council:
        assert member["voice_notes"].strip()
        assert len(member["sources"]) >= 3, f"{member['name']} needs receipts"
        for source in member["sources"]:
            assert source["title"] and source["type"]


def test_war_room_chamber_has_the_shared_chamber_shape():
    room = CHAMBERS["warroom"]
    for key in ("id", "name", "domain", "biology", "tagline", "placeholder", "cta", "loading", "error"):
        assert room.get(key), f"warroom missing {key}"


# ---- Source labelling ---------------------------------------------------- #

def test_domain_lean_lookup_handles_subdomains_and_unknowns():
    assert intel._outlet_for_domain("apnews.com") == ("Associated Press", "wire")
    assert intel._outlet_for_domain("edition.cnn.com")[1] == "center-left"
    assert intel._outlet_for_domain("foxnews.com")[1] == "right"
    outlet, lean = intel._outlet_for_domain("some-blog.example")
    assert lean == "unlabeled", "an unknown outlet must not be assigned a lean"
    assert outlet


def test_domain_lean_lookup_strips_only_a_real_www_prefix():
    """A character-wise strip would eat the leading letters of wsj.com."""
    assert intel._outlet_for_domain("www.bbc.co.uk") == ("BBC News", "center")
    assert intel._outlet_for_domain("wsj.com") == ("The Wall Street Journal", "center-right")
    assert intel._outlet_for_domain("washingtonpost.com")[1] == "center-left"


def test_topic_terms_drop_stopwords():
    terms = intel.topic_terms("What will happen in the Taiwan Strait")
    assert "taiwan" in terms and "strait" in terms
    assert "the" not in terms and "will" not in terms


def test_dedupe_collapses_wire_copy_across_outlets():
    items = [
        intel._item("Talks collapse in Geneva", "Reuters", "wire", "https://reuters.com/a"),
        intel._item("Talks collapse in Geneva", "BBC News", "center", "https://bbc.co.uk/b"),
        intel._item("Markets open lower", "Fox News", "right", "https://foxnews.com/c"),
    ]
    assert len(intel._dedupe(items)) == 2


def test_dedupe_treats_same_url_as_one_item():
    items = [
        intel._item("A headline", "BBC News", "center", "https://bbc.co.uk/x?utm=1"),
        intel._item("A different headline", "BBC News", "center", "https://bbc.co.uk/x?utm=2"),
    ]
    assert len(intel._dedupe(items)) == 1


def test_balance_spreads_across_leans_rather_than_taking_the_loudest_feed():
    items = [intel._item(f"left {i}", "The Guardian", "left") for i in range(10)]
    items += [intel._item("right 1", "Fox News", "right")]
    items += [intel._item("wire 1", "Reuters", "wire")]
    balanced = intel._balance(items, cap=6)
    leans = {i["lean"] for i in balanced}
    assert len(balanced) == 6
    assert {"right", "wire"} <= leans, "a minority lean must survive the cap"


def test_source_spread_counts_by_lean():
    items = [
        intel._item("a", "The Guardian", "left"),
        intel._item("b", "Fox News", "right"),
        intel._item("c", "Reuters", "wire"),
        intel._item("d", "Reuters", "wire"),
    ]
    assert intel.source_spread(items) == {"wire": 2, "left": 1, "right": 1}


# ---- Pasted material ----------------------------------------------------- #

def test_normalize_pasted_splits_blocks_and_reads_outlet_labels():
    pasted = (
        "Reuters: Officials confirmed the shipment arrived Tuesday.\n"
        "---\n"
        "[The Guardian]\nThe move was condemned by neighbouring states.\n"
        "---\n"
        "An unattributed note from a colleague."
    )
    items = intel.normalize_pasted(pasted)
    assert len(items) == 3
    assert items[0]["outlet"] == "Reuters" and items[0]["lean"] == "wire"
    assert items[1]["outlet"] == "The Guardian" and items[1]["lean"] == "left"
    assert items[2]["lean"] == "unlabeled", "unattributed text must not gain a lean"


def test_normalize_pasted_is_empty_for_blank_input():
    assert intel.normalize_pasted("") == []
    assert intel.normalize_pasted("   \n  ") == []


def test_normalize_pasted_truncates_oversized_input():
    huge = "x" * (intel.MAX_PASTED_CHARS + 5000)
    items = intel.normalize_pasted(huge)
    assert sum(len(i["summary"]) for i in items) <= intel.MAX_PASTED_CHARS


def test_render_source_block_labels_every_item_with_outlet_and_lean():
    items = [intel._item("Headline", "Al Jazeera", "international", summary="Body text.")]
    block = intel.render_source_block(items)
    assert "OUTLET: Al Jazeera" in block
    assert "LEAN: international" in block


def test_render_source_block_respects_the_char_budget():
    items = [intel._item(f"Headline {i}", "BBC News", "center", summary="x" * 400) for i in range(50)]
    block = intel.render_source_block(items, char_budget=2000)
    assert len(block) < 3000
    assert "further items omitted" in block


# ---- Gathering ----------------------------------------------------------- #

def test_gather_sources_falls_back_to_pasted_when_live_is_unreachable(monkeypatch):
    async def dead_network(*_args, **_kwargs):
        return {"items": [], "reachable": False, "notes": ["No live source could be reached."]}

    monkeypatch.setattr(wr, "fetch_live", dead_network)
    items, mode, notes = asyncio.run(
        wr.gather_sources("a topic", pasted="Reuters: something happened.", live=True)
    )
    assert mode == "pasted"
    assert len(items) == 1
    assert any("pasted" in n.lower() for n in notes)


def test_gather_sources_reports_none_when_there_is_nothing_at_all(monkeypatch):
    async def dead_network(*_args, **_kwargs):
        return {"items": [], "reachable": False, "notes": []}

    monkeypatch.setattr(wr, "fetch_live", dead_network)
    items, mode, notes = asyncio.run(wr.gather_sources("a topic", pasted="", live=True))
    assert items == [] and mode == "none"
    assert notes, "an empty gather must explain itself"


def test_build_brief_returns_an_honest_empty_brief_without_calling_the_model(monkeypatch):
    async def dead_network(*_args, **_kwargs):
        return {"items": [], "reachable": False, "notes": []}

    async def explode(*_args, **_kwargs):
        raise AssertionError("must not sift when there is nothing to sift")

    monkeypatch.setattr(wr, "fetch_live", dead_network)
    monkeypatch.setattr(wr, "_ask_json", explode)
    result = asyncio.run(wr.build_brief("quiet topic", live=True))
    assert result["brief"]["established_facts"] == []
    assert result["brief"]["unknowns"], "an empty brief must still name what is unknown"
    assert result["sources"]["item_count"] == 0


def test_build_brief_normalizes_a_partial_model_response(monkeypatch):
    async def one_item(*_args, **_kwargs):
        return {"items": [intel._item("H", "Reuters", "wire", summary="B")], "reachable": True, "notes": []}

    async def partial_sift(*_args, **_kwargs):
        return {"situation": "Something is happening.", "established_facts": [{"fact": "A thing."}]}

    monkeypatch.setattr(wr, "fetch_live", one_item)
    monkeypatch.setattr(wr, "_ask_json", partial_sift)
    brief = asyncio.run(wr.build_brief("topic", live=True))["brief"]
    for key in wr.BRIEF_ARRAYS:
        assert isinstance(brief[key], list), f"{key} must always be a list"
    assert brief["as_of"] == "unspecified"


# ---- The board ----------------------------------------------------------- #

def _board_row(name, **overrides):
    row = {
        "member": name,
        "read": f"{name} reads the situation.",
        "next_moves": ["Hold the line.", "Open a channel."],
        "decisive_factor": "Time.",
        "if_wrong": "The opposite happens.",
        "risk": "Overreach.",
        "dissent": False,
    }
    row.update(overrides)
    return row


def test_normalize_board_orders_by_roster_and_keeps_one_entry_each():
    raw = {"board": [_board_row(n) for n in reversed(wr.BOARD_MEMBERS)]}
    board = wr._normalize_board(raw)
    assert [r["member"] for r in board] == wr.BOARD_MEMBERS


def test_normalize_board_matches_surnames_and_drops_intruders():
    raw = {"board": [
        _board_row("Alexander"),
        _board_row("Churchill"),
        _board_row("Julius Caesar"),  # never seated in this room
    ]}
    board = wr._normalize_board(raw)
    names = [r["member"] for r in board]
    assert "Alexander the Great" in names
    assert "Winston Churchill" in names
    assert not any("Caesar" in n for n in names)


def test_normalize_board_deduplicates_a_repeated_member():
    raw = {"board": [_board_row("Genghis Khan"), _board_row("Genghis Khan", read="again")]}
    board = wr._normalize_board(raw)
    assert len(board) == 1
    assert board[0]["read"] != "again", "the first read wins"


def test_normalize_board_coerces_a_malformed_row():
    raw = {"board": [
        {"member": "Napoleon Bonaparte", "read": "Terse.", "next_moves": "not a list", "dissent": "yes"},
    ]}
    board = wr._normalize_board(raw)
    assert board[0]["next_moves"] == []
    assert board[0]["dissent"] is True
    assert board[0]["risk"] == ""


def test_convene_board_rejects_an_empty_board(monkeypatch):
    async def nothing(*_args, **_kwargs):
        return {"board": []}

    monkeypatch.setattr(wr, "_ask_json", nothing)
    with pytest.raises(ValueError):
        asyncio.run(wr.convene_board({"situation": "x"}, "what next?"))


# ---- What the board is allowed to see ------------------------------------ #

def test_the_board_never_receives_the_raw_coverage():
    """The separation between sifting and deliberating is the point of the room."""
    brief = {
        "situation": "Forces moved to the border.",
        "as_of": "12 August",
        "established_facts": [{"fact": "Troops moved.", "corroboration": ["Reuters", "BBC News"], "confidence": "high"}],
        "contested_claims": [{"claim": "It is an invasion force.", "asserted_by": "State A", "disputed_by": "State B"}],
        "unknowns": ["Intent."],
        "framing_removed": [{"loaded": "brutal massing", "outlet": "The Guardian", "lean": "left", "neutral": "movement of forces"}],
        "actors": [{"name": "State A", "stated_aim": "Exercise", "inferred_aim": "Pressure"}],
        "timeline": [{"when": "Monday", "what": "Movement observed."}],
        "coverage_gaps": ["No reporting from inside State A."],
    }
    rendered = wr.render_brief_for_board(brief)

    assert "Forces moved to the border." in rendered
    assert "do not treat these as facts" in rendered
    assert "It is an invasion force." in rendered
    # The stripped framing stays with the audit trail; it must not leak onward.
    assert "brutal massing" not in rendered


def test_render_brief_for_board_survives_a_sparse_brief():
    rendered = wr.render_brief_for_board({"situation": "Thin."})
    assert "(none recorded)" in rendered
    assert "Thin." in rendered


# ---- The estimate -------------------------------------------------------- #

def test_build_estimate_degrades_to_a_usable_shape_when_synthesis_fails(monkeypatch):
    async def explode(*_args, **_kwargs):
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(wr, "_ask_json", explode)
    board = [_board_row("Genghis Khan", dissent=True)]
    estimate = asyncio.run(wr.build_estimate({"situation": "x"}, wr._normalize_board({"board": board})))
    assert estimate["confidence"] == "low"
    assert "Genghis Khan" in estimate["fault_line"]
    assert estimate["indicators"] == []


def test_build_estimate_drops_malformed_indicators(monkeypatch):
    async def loose(*_args, **_kwargs):
        return {
            "convergence": "They agree on the timing.",
            "indicators": [{"watch_for": "A port closure", "means": "Escalation", "confirms": "Genghis Khan"}, "junk"],
            "confidence": "moderate",
        }

    monkeypatch.setattr(wr, "_ask_json", loose)
    estimate = asyncio.run(wr.build_estimate({}, []))
    assert len(estimate["indicators"]) == 1
    assert estimate["indicators"][0]["watch_for"] == "A port closure"
    assert estimate["most_dangerous_course"] == ""


# ---- Shared-shape compatibility ------------------------------------------ #

def test_board_maps_onto_the_shared_deliberation_shape():
    board = wr._normalize_board({"board": [_board_row(n) for n in wr.BOARD_MEMBERS]})
    deliberation = wr.board_as_deliberation(board)
    assert len(deliberation) == 5
    for row in deliberation:
        assert set(row) == {"member", "contribution", "dissent"}
        assert row["contribution"].strip()
    assert "Next moves:" in deliberation[0]["contribution"]


def test_verdict_prose_keeps_likely_and_dangerous_distinct():
    prose = wr.verdict_prose({
        "convergence": "All five agree the window is closing.",
        "fault_line": "They split on whether to move first.",
        "decision_point": "Reinforce or negotiate.",
        "most_likely_course": "A frozen standoff.",
        "most_dangerous_course": "A miscalculated intercept.",
    })
    assert "Most likely: A frozen standoff." in prose
    assert "Most dangerous: A miscalculated intercept." in prose


def test_verdict_prose_tolerates_an_empty_estimate():
    assert wr.verdict_prose({}) == ""
