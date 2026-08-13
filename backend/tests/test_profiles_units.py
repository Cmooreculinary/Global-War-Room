"""Character sheet tests.

The sheets exist to stop five commanders producing one answer, so these check
the differentiating parts are actually present and actually reach the prompts.
"""
import pytest

from personas import CHAMBERS, find_team, team_ids, war_room_prompt
from profiles import FIDELITY_RULE, PROFILES, render_profile
from war_scenarios import projection_prompt, render_assignments, render_team, scenario_year_prompt

LEADERS = ["alexander", "genghis", "napoleon", "churchill_war", "eisenhower"]
CONSULS = [
    "parmenion", "aristotle", "subutai", "yelu_chucai", "berthier",
    "talleyrand", "alanbrooke", "rvjones", "marshall", "kennan",
]


def _all_figures():
    for member in CHAMBERS["warroom"]["council"]:
        yield member
        yield from member.get("consuls", [])


# ---- Coverage ------------------------------------------------------------- #

def test_every_figure_in_the_war_room_has_a_character_sheet():
    missing = [f["name"] for f in _all_figures() if not f.get("profile")]
    assert not missing, f"no character sheet for: {missing}"


def test_profiles_cover_exactly_the_war_room_roster():
    assert set(PROFILES) == set(LEADERS + CONSULS)


def test_leaders_carry_the_full_sheet():
    required = (
        "formation", "temperament", "heuristics", "signature_move", "reads_first",
        "blind_spots", "breaking_point", "updates_when", "tell", "hard_truth",
    )
    for fid in LEADERS:
        for field in required:
            assert PROFILES[fid].get(field), f"{fid} is missing {field}"


def test_consuls_carry_at_least_the_differentiating_fields():
    for fid in CONSULS:
        p = PROFILES[fid]
        for field in ("temperament", "heuristics", "reads_first"):
            assert p.get(field), f"{fid} is missing {field}"


# ---- The parts that do the work ------------------------------------------- #

def test_every_leader_has_documented_failure_modes():
    """A commander with no blind spots is a generic good general."""
    for fid in LEADERS:
        assert len(PROFILES[fid]["blind_spots"]) >= 3, f"{fid} needs more than a token flaw"


def test_every_leader_has_several_decision_rules():
    for fid in LEADERS:
        assert len(PROFILES[fid]["heuristics"]) >= 4, f"{fid} needs enough rules to reason with"


def test_no_two_figures_share_what_they_notice_first():
    """If two men notice the same thing first, they will not diverge."""
    reads = [PROFILES[f]["reads_first"] for f in PROFILES if PROFILES[f].get("reads_first")]
    assert len(set(reads)) == len(reads), "two figures notice the same thing first"


def test_no_two_figures_share_a_decision_rule_verbatim():
    seen = {}
    for fid, p in PROFILES.items():
        for rule in p.get("heuristics", []):
            assert rule not in seen, f"{fid} and {seen[rule]} share a rule verbatim: {rule[:60]}"
            seen[rule] = fid


def test_the_hard_truths_are_not_softened():
    """These are the facts a flattering portrait drops first."""
    expectations = {
        "alexander": ("thebes", "tyre", "slavery"),
        "genghis": ("nishapur", "merv", "urgench"),
        "napoleon": ("slavery", "saint-domingue"),
        "churchill_war": ("bengal", "imperialist"),
        "eisenhower": ("iran", "guatemala"),
    }
    for fid, words in expectations.items():
        truth = PROFILES[fid]["hard_truth"].lower()
        assert any(w in truth for w in words), f"{fid}'s hard truth has been sanitised"


# ---- Rendering ------------------------------------------------------------ #

def test_full_render_includes_the_failure_modes_and_the_hard_truth():
    rendered = render_profile("napoleon", "Napoleon Bonaparte", depth="full")
    assert "Documented failure modes" in rendered
    assert "Cannot stop" in rendered
    assert "Not to be sanitised" in rendered
    assert "Formation:" in rendered


def test_brief_render_keeps_what_differentiates_and_drops_the_biography():
    brief = render_profile("napoleon", "Napoleon Bonaparte", depth="brief")
    full = render_profile("napoleon", "Napoleon Bonaparte", depth="full")
    assert len(brief) < len(full) / 2, "brief should be substantially shorter"
    assert "Notices first:" in brief and "Fails by:" in brief
    assert "Formation:" not in brief, "the biography is the part worth dropping"


def test_render_is_empty_for_a_figure_with_no_sheet():
    assert render_profile("hannibal", "Hannibal") == ""


def test_render_labels_the_figure_by_name():
    assert render_profile("kennan", "George F. Kennan").startswith("  George F. Kennan — character:")


# ---- Reaching the prompts ------------------------------------------------- #

def test_the_board_prompt_carries_every_commanders_sheet():
    prompt = war_room_prompt("What happens next?")
    for fid in LEADERS:
        marker = PROFILES[fid]["reads_first"][:40]
        assert marker in prompt, f"{fid}'s sheet did not reach the board prompt"
    assert FIDELITY_RULE.splitlines()[0] in prompt


def test_the_fidelity_rule_forbids_correcting_the_blind_spots():
    """The instruction is load-bearing: without it the sheets read as warnings."""
    assert "failure modes are characterisation, not warnings" in FIDELITY_RULE
    assert "do not sanitise" in FIDELITY_RULE.lower()


def test_a_projection_prompt_carries_all_three_of_its_team():
    prompt = projection_prompt(find_team("churchill_war"), 5)
    assert "Winston Churchill — character:" in prompt
    assert "Alan Brooke — character:" in prompt
    assert "R. V. Jones — character:" in prompt
    assert "Bengal" in prompt, "the full sheet should reach a three-figure prompt"


def test_a_projection_prompt_excludes_other_teams():
    prompt = projection_prompt(find_team("genghis"), 5)
    assert "Genghis Khan — character:" in prompt
    assert "Napoleon Bonaparte — character:" not in prompt


def test_a_crowded_table_falls_back_to_brief_sheets():
    crowded = [{"actor": "United States", "teams": team_ids()}]
    rendered = render_assignments(crowded)
    assert "Notices first:" in rendered
    assert "Formation:" not in rendered, "fifteen full sheets would bury the brief"


def test_a_small_table_gets_the_full_sheets():
    small = [{"actor": "United States", "teams": ["eisenhower"]}]
    rendered = render_assignments(small)
    assert "Formation:" in rendered


def test_a_two_team_confrontation_stays_full_depth():
    two = [
        {"actor": "United States", "teams": ["eisenhower"]},
        {"actor": "China", "teams": ["genghis"]},
    ]
    assert "Formation:" in render_assignments(two)


def test_render_team_depth_is_passed_through_to_consuls():
    brief = render_team(find_team("eisenhower"), depth="brief")
    assert "George C. Marshall — character:" in brief
    assert "Formation:" not in brief


def test_scenario_year_prompt_stays_within_a_sane_size():
    """Five teams on one actor is the worst case; it must not crowd out the brief."""
    crowded = [{"actor": "United States", "teams": team_ids()}]
    prompt = scenario_year_prompt(3, 5, crowded, "MODE: single actor.")
    approx_tokens = len(prompt) / 4
    assert approx_tokens < 12000, f"year prompt is {approx_tokens:.0f} tokens before the brief is added"


@pytest.mark.parametrize("fid", LEADERS)
def test_each_leaders_sheet_is_substantive(fid):
    rendered = render_profile(fid, depth="full")
    assert len(rendered) > 1200, f"{fid}'s sheet is too thin to differentiate him"
