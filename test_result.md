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

frontend:
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
    - "Intelligence intake — live pull + paste, with lean labelling"
    - "Three-pass pipeline — sift, board, estimate"
    - "War Room endpoints"
    - "War Room page and flow"
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