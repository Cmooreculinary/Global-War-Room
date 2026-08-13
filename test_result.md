#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Turn the app into a military strategy agent with a board of five great military
  leaders. Take what is happening in the world today, sift it into unbiased,
  purely factual form, give the board those facts, and let each member give an
  educated read on what the next steps would or should be, each according to his
  own strategy.

  Board agreed with the user: Alexander the Great, Genghis Khan, Napoleon
  Bonaparte, Winston Churchill, Dwight D. Eisenhower. Eisenhower was chosen over
  MacArthur for political judgement. Hitler was raised and left off — he fails
  the user's own "saved or expanded their country" criterion; Napoleon covers the
  expansionist-autocrat perspective instead. News intake: both live pull and
  paste-in.

backend:
  - task: "War Room chamber + five-commander roster"
    implemented: true
    working: "NA"
    file: "backend/personas.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          Added the `warroom` chamber (Amygdala) to CHAMBERS with five members,
          each with voice_notes and 3–5 verifiable sources. Flows automatically
          into /api/chambers, /api/personas and the Receipts page.
          NOTE: test_cortex_backend.py::test_list_chambers asserted an exact set
          of five chamber ids; updated to include "warroom".

  - task: "Intelligence intake — live pull + paste, with lean labelling"
    implemented: true
    working: "NA"
    file: "backend/intel.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          GDELT DOC 2.0 topic search plus ten standing RSS feeds spanning the
          spectrum; two state outlets available but off by default. Every item
          carries an outlet and a declared lean so the sift can audit framing.
          Pasted material is split on --- and reads an optional `Outlet:` label.
          Individual source failures are absorbed and reported, never raised.
          Verified locally: 11 unit tests over parsing (RSS 2.0 / Atom / RDF /
          GDELT JSON and its HTML error page) via httpx.MockTransport.
          NOT verified: real outbound fetching — the dev sandbox proxy returns
          403 for these hosts. Needs one live run in an environment with egress.
          Set WARROOM_LIVE_SOURCES=0 to disable live pulling entirely.

  - task: "Three-pass pipeline — sift, board, estimate"
    implemented: true
    working: "NA"
    file: "backend/warroom_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          Pass 1 (Cartographer) reduces coverage to established / contested /
          unknown, and records every phrase of loaded language it removed.
          Pass 2 seats the five commanders against that brief ONLY — they never
          see the raw coverage, which is what keeps an outlet's framing out of
          the deliberation. Pass 3 draws the estimate: convergence, fault line,
          decision point, most-likely vs most-dangerous course, and indicators.
          Degrades honestly: no sources -> an empty brief that says so rather
          than a confident one; a failed estimate falls back to the reads.

  - task: "War Room endpoints"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          GET /api/warroom/sources, POST /api/warroom/brief,
          POST /api/warroom/convene, GET /api/warroom/estimate/{id}.
          Sessions persist to db.verdicts in the shared Verdict shape (plus the
          richer board/estimate fields), so /verdict/:id, save and the Archive
          all keep working. Paywall gate deduplicated into _enforce_paywall()
          and reused by /deliberate, /court/create and /warroom/convene —
          identical semantics, three call sites collapsed to one.

  - task: "Consuls — two per commander, five teams of three"
    implemented: true
    working: "NA"
    file: "backend/personas.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          Each War Room commander now carries a `consuls` list of two, picked as
          that leader would pick — mostly his real inner circle, each paired as
          one operational counterweight plus one political/economic/intelligence
          brain: Alexander/Parmenion+Aristotle, Genghis/Subutai+Yelü Chucai,
          Napoleon/Berthier+Talleyrand, Churchill/Alanbrooke+R.V. Jones,
          Eisenhower/Marshall+Kennan. Every consul has sources and a
          `chosen_because` explaining the pick. Flows into /personas and the
          Receipts page; other chambers leave the field empty.
          NOTE: CouncilMember gained an optional `consuls` field — without it
          pydantic would have silently dropped them from every response.

  - task: "Projections — one five-year forecast per team, then compared"
    implemented: true
    working: "NA"
    file: "backend/scenario_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          One call per team against the shared brief, then a comparison pass
          that traces divergence to doctrine rather than summarising. A team
          that fails is dropped and the rest still run; only a total failure
          raises. Each projection carries internal dissent between the leader
          and his own consuls.

  - task: "Scenario engine — assignments, year-by-year play, debrief"
    implemented: true
    working: "NA"
    file: "backend/scenario_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          One primitive covers every mode the user asked for: a list of actors,
          each with the teams advising it. Play the US = one actor, five teams.
          US vs China = two actors, teams split. Anything else = same engine.
          There is deliberately no US-specific or China-specific code path.
          Each year is its own model call given everything already played, so
          the exercise escalates and can surprise; every year forces a cost per
          move and one unplanned development. A failed year is recorded and
          play continues rather than voiding the run. Sanitiser refuses to seat
          one team on two sides — it would be playing itself.

  - task: "Run endpoints with progress streaming"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          GET /api/warroom/teams, POST /api/warroom/projection, POST
          /api/warroom/scenario (both 202 + run_id, background), GET
          /api/warroom/run/{id}. Runs are minutes long — a 5-year two-sided
          scenario is 7 model calls — so each stage writes to db.warroom_runs
          as it lands and the client polls. Paywalled like every other
          convening.

  - task: "Character sheets — the anti-convergence layer"
    implemented: true
    working: "NA"
    file: "backend/profiles.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          Structured character sheets for all 15 figures, aimed squarely at the
          risk flagged last pass: five commanders described as "brilliant"
          converge on one competent answer. A prose biography does not fix
          that. Each sheet carries decision rules in the figure's own terms,
          what he notices before he has an opinion, his documented repeated
          failure modes, what changed his mind, his tell, and a hard_truth that
          must not be sanitised.

          The blind spots are the load-bearing part and the first thing a
          flattering portrait drops. FIDELITY_RULE instructs the model to treat
          them as characterisation rather than warnings — explicitly forbidding
          a figure from pre-emptively acknowledging his own blind spot and
          correcting for it, since that is exactly what he did not do. Another
          voice at the table names it instead.

          Two render depths, because a scenario can seat 15 figures: `full` for
          the board and single-team projections, `brief` for crowded tables,
          chosen automatically by how many teams are seated.

          Prompt sizes measured: board 5.4k tokens, projection 2.8k, scenario
          year 2.9k (one team, full sheets) to 7.0k (five teams, brief). Input
          tokens per scenario rose by roughly 4-5k per year-call; worth
          watching alongside the existing cost note.

frontend:
  - task: "Character sheets in the UI"
    implemented: true
    working: "NA"
    file: "frontend/src/components/TeamRoster.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          CharacterSheet is collapsible and exported for reuse; it renders on
          the War Room roster and on the Receipts page, where the consuls and
          their sources now appear too. "How he fails" is shown as prominently
          as "How he decides", and hard_truth gets its own boxed callout —
          consistent with the app's existing claim that it does not sanitise.

  - task: "Team modes UI — builder, projections, scenario timeline"
    implemented: true
    working: "NA"
    file: "frontend/src/components/ScenarioBuilder.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          Step three on /warroom, available once a brief exists. Presets
          (Projection / Play the US / Play China / US vs China / Custom) all
          write the same assignments primitive, and Custom exposes it directly
          — name any actors, deal the teams out, up to four actors. Selecting a
          team for one actor removes it from the others, mirroring the server
          rule. Results stream in: ProjectionView tabs per team, ScenarioView
          renders turn zero then a year at a time as they land, then the
          debrief. Polling stops on unmount; the run continues server-side.
          Verified: `yarn build` clean under CI=true. NOT verified in a browser.

  - task: "War Room page and flow"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/WarRoomPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          /warroom — topic + optional question + optional pasted material, with
          live/state/window controls. The brief renders BEFORE the board is
          convened so the facts can be checked first. Then five reads and the
          estimate. Deliberately not wired into the Landing brain: the hero has
          five hard-coded lobes and the War Room needs source material, not just
          a question. Reached via the header nav instead.
          Verified: `yarn build` compiles clean, no lint warnings.
          NOT verified: rendering against a live backend (no backend deps in the
          dev sandbox). Needs a browser pass.

  - task: "Brief, board and estimate components"
    implemented: true
    working: "NA"
    file: "frontend/src/components/SituationBrief.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
          SituationBrief renders the fact sheet including the framing-removed
          audit table (as published / source + lean / as recorded) — the part
          that earns the word "unbiased". BoardRead shows each commander's read,
          proposed moves, decisive factor, falsifier and risk. WarEstimate shows
          the estimate and the indicators table.

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Scenario engine — assignments, year-by-year play, debrief"
    - "Run endpoints with progress streaming"
    - "Projections — one five-year forecast per team, then compared"
    - "Team modes UI — builder, projections, scenario timeline"
    - "Intelligence intake — live pull + paste, with lean labelling"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Added The War Room. Two test suites are new:

        backend/tests/test_warroom_units.py   — 30 unit tests, no network/model
        backend/tests/test_intel_parsing.py   — 11 parsing tests via MockTransport
        backend/tests/test_warroom_backend.py — integration, needs :8001 + model

      Run the fast ones with `cd backend && pytest -m "not slow"` (41 passing
      locally). The integration file marks the model-dependent tests `slow`; it
      feeds pasted material rather than live news so it does not depend on what
      the wire happens to carry today.

      Two things I could not verify in the dev sandbox and that need a real run:
      1. Live fetching. The sandbox proxy 403s every news host. The failure path
         is tested and degrades cleanly, but one real pull should be eyeballed:
         POST /api/warroom/brief {"topic":"Taiwan Strait","live":true} and check
         sources.spread spans more than one lean.
      2. The /warroom page against a live backend.

      One bug found and fixed while testing: `lstrip("www.")` strips characters
      rather than a prefix, so wsj.com resolved to sj.com and lost its lean
      label. Test added. A second bug the tests caught: RDF/RSS-1.0 feeds
      (Deutsche Welle) dropped every item because the title lookup was missing
      the RSS 1.0 namespace.

    -agent: "main"
    -message: |
      Second pass: consuls, projections and playable scenarios.

      Test suites now:
        backend/tests/test_warroom_units.py     — 30 units
        backend/tests/test_intel_parsing.py     — 11 parsing, MockTransport
        backend/tests/test_scenarios_units.py   — 33 units (teams, assignments,
                                                  projections, scenario play)
        backend/tests/test_warroom_backend.py   — integration, slow
        backend/tests/test_scenarios_backend.py — integration, slow

      `cd backend && pytest -m "not slow"` — 74 passing locally, no network or
      model needed.

      Priorities for a live pass, in order:
      1. A two-sided scenario end to end. Three years, Country A vs Country B,
         and read whether the years actually escalate or just restate. The
         year-by-year call chain is the part most likely to drift.
      2. Whether the five projections genuinely differ. There is a test
         asserting the trajectories are not string-identical, but the real
         question is qualitative — if Genghis and Eisenhower forecast the same
         world, the personas are too weak and the prompts need sharpening.
      3. The scenario UI mid-run, watching years land one at a time.

      Cost note: a 5-year two-actor scenario is 7 model calls at up to 4000
      output tokens. The horizon selector goes to 10, which would be 12 calls.
      Worth watching before this is priced.

      Still unverified from the first pass: live news fetching (sandbox proxy
      403s every news host) and any browser rendering.

    -agent: "main"
    -message: |
      Third pass: character sheets, aimed at the convergence risk flagged above.

      backend/tests/test_profiles_units.py — 27 tests. Beyond coverage, these
      assert the properties that make the sheets work: no two figures notice
      the same thing first, no decision rule is shared verbatim between two
      figures, every leader has at least three documented failure modes, and
      each hard_truth still contains the specific fact a flattering portrait
      would drop (Bengal, Nishapur, Saint-Domingue, Iran/Guatemala, Tyre).
      Also asserts the sheets actually reach the prompts, that a projection
      prompt carries its own three figures and not the other teams', and that
      the worst-case year prompt stays under 12k tokens before the brief.

      Test ergonomics fixed: the *_backend.py integration files now skip
      themselves when nothing is listening on :8001, instead of producing 30
      connection errors on a plain `pytest`. Set WARROOM_REQUIRE_BACKEND=1 to
      make that a failure in CI. Plain `pytest` is now 101 passed, 63 skipped.

      The live question this pass is meant to settle, and can only be settled
      live: run the same brief through projections before and after and see
      whether the five futures actually diverge now. If Genghis and Eisenhower
      still forecast the same world, the next lever is fewer figures per prompt
      rather than more text per figure.