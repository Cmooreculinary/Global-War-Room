# Cerebral Cortex — PRD

**Tagline:** Real wisdom is never one voice. It's a whole mind at work.

## Original Problem Statement
A judicial-anatomical AI judgment system modeled on the human brain. Five chambers — four mapped to the cortical lobes (Senate=Frontal, Boardroom=Parietal, Court Room=Temporal, Council=Occipital), plus The Forge as the corpus callosum integrator. Founders, CEOs, pastors, and leaders submit hard questions to chambered councils of master voices; verdicts are deliberated and rendered. NOT a chatbot, NOT a search engine — a deliberation engine.

## User Personas
- **Founders / CEOs** — bringing strategic and people decisions to the Senate / Boardroom.
- **Pastors / Conscience-led leaders** — bringing faith and moral questions to the Council.
- **Heads of households** — bringing covenant and family questions to the Court Room.
- **Anyone with a tangled cross-domain question** — bringing it to The Forge.

## Architecture
- **Frontend:** React 19 + Tailwind + Framer Motion + shadcn/ui + sonner. Routes: `/`, `/chamber/{id}`, `/forge`, `/verdict/:id`, `/archive`, `/about`.
- **Backend:** FastAPI on `:8001`, all routes prefixed `/api`. MongoDB `verdicts` collection.
- **AI:** Anthropic `claude-sonnet-4-5-20250929` via `ANTHROPIC_API_KEY`. Single-call multi-persona for chambers; multi-call witness-and-synthesize for The Forge. Voice uses OpenAI Whisper/TTS via `OPENAI_API_KEY`.

## Decisions (v1)
- Council = **named real figures, reconstructed from the public record** (v2 pivot from archetypes — Feb 2026).
- Council member representation = **symbolic SVG glyphs**, not photoreal portraits.
- Persistence = **MongoDB** (per-browser archive_id from localStorage).
- LLM provider = **Anthropic Claude Sonnet 4.5**.

## The Councils (v2 — Feb 2026)
- **Senate**: Abraham Lincoln, Winston Churchill, Marcus Aurelius, Edmund Burke
- **Boardroom**: Warren Buffett, Charlie Munger, Steve Jobs, Peter Drucker
- **Court Room**: Wendell Berry, Brené Brown, Viktor Frankl
- **Council**: Thomas Aquinas, C.S. Lewis, Dietrich Bonhoeffer, Mother Teresa
- **Forge**: The Integrator (in the lineage of Aristotle)

Each persona carries a `sources` ledger (books, speeches, letters, biographies) surfaced on `/receipts`. System prompt is explicit: "These voices are reconstructions, not channelings." The Receipts page shows the disclaimer + every voice + every source we reasoned from.

## Implemented (Feb 2026)
- ✅ Anatomical cortex landing — real brain image with 5 lobes + Forge hotspots, breathing animation, hover descend
- ✅ All 5 chambers (Senate, Boardroom, Court Room, Council, Forge) — real-figure personas with `/receipts` credentials
- ✅ Question submission → deliberation → verdict flow with sequential stagger reveal, committee banner when witnesses > 1
- ✅ Verdict layout with dropped capital, dissent markers, chamber-color treatment
- ✅ Archive (MongoDB-persisted, per-browser id) with bento grid, save/share/remove
- ✅ Shareable verdict URLs (`/verdict/:id`), About page with long-form editorial
- ✅ Backend: `/api/chambers`, `/api/chambers/:id`, `/api/deliberate`, `/api/route`, `/api/transcribe`, `/api/speak`, `/api/verdicts/:id`, `/api/verdicts/:id/save`, `DELETE /api/verdicts/:id`, `GET /api/verdicts`
- ✅ Cortex design system: CSS variables, Cormorant Garamond / Source Serif 4 / DM Sans, judicial-anatomical palette
- ✅ **Single-page app pivot (Feb 2026)** — `Landing.jsx` holds the whole experience; `/api/route` auto-selects the chair + witnesses; brain lights up the routed lobes
- ✅ **Voice-to-Text (Feb 2026)** — `MicButton.jsx` + OpenAI Whisper via `/api/transcribe`
- ✅ **Text-to-Speech (Feb 2026)** — `VerdictAudio.jsx` + OpenAI TTS via `/api/speak`, per-chamber voice mapping (senate=onyx, boardroom=sage, courtroom=fable, council=echo, forge=nova)
- ✅ **Compact landing layout (Feb 2026)** — 1-2-3 How-it-works strip ABOVE input, narrow (`max-w-xl`) scrollable textarea, standalone "Review our Experts →" link directly below input
- ✅ **End-to-end test sweep (Feb 2026)** — 22/22 backend pytest + full frontend Playwright pass (iteration_2)

## Backlog
### P1 — Polish
- Mobile responsive review of chamber pages (probably acceptable; verify)
- Council member portraits as v2 (photoreal or AI-generated)
- Voice-of-each-member fan-out (one API call per persona) instead of single-call multi-persona
- Stripe subscription gating for unlimited deliberations

### P2 — Expansion
- User accounts + cross-device archive sync
- Audio readback of verdicts (ElevenLabs)
- Named real-figure councils (curated, with citations)
- Verdict export to PDF
- Embed verdict on third-party sites

## Routes
| Route | Purpose |
|---|---|
| `/` | Anatomical cortex landing |
| `/chamber/:id` | Senate/Boardroom/Courtroom/Council chamber |
| `/forge` | The Forge — cross-chamber integrator |
| `/verdict/:id` | Standalone shareable verdict |
| `/archive` | Saved verdicts grid |
| `/about` | Philosophy and biological metaphor |
