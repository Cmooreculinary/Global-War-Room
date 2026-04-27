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
- **AI:** Anthropic `claude-sonnet-4-5-20250929` via emergentintegrations + EMERGENT_LLM_KEY. Single-call multi-persona for chambers; multi-call witness-and-synthesize for The Forge.

## Decisions (v1)
- Council = **hybrid archetypes** (titles inspired by real lineages, not impersonations).
- Council member representation = **symbolic SVG glyphs**, not photoreal portraits.
- Persistence = **MongoDB** (per-browser archive_id from localStorage).
- LLM provider = **Emergent Universal LLM Key** (Claude Sonnet 4.5).

## Implemented (Feb 2026)
- ✅ Anatomical SVG cortex landing — 4 lobes + Forge at center, breathing animation, hover descend, click-through routing
- ✅ All 5 chambers (Senate, Boardroom, Court Room, Council) — full visual identity, atmospheric overlays, council member cards with archetype glyphs and lineages
- ✅ The Forge with 4-quadrant chamber-witness preview (live keyword classification) and "called witnesses" indicator after deliberation
- ✅ Question submission → deliberation → verdict flow with sequential 200ms-stagger reveal
- ✅ Verdict layout with dropped capital, dissent markers, chamber-color treatment
- ✅ Archive (MongoDB-persisted, per-browser id) with bento grid, save/share/remove
- ✅ Shareable verdict URLs (`/verdict/:id`)
- ✅ About page with editorial long-form
- ✅ Backend: `/api/chambers`, `/api/chambers/:id`, `/api/deliberate`, `/api/verdicts/:id`, `/api/verdicts/:id/save`, `DELETE /api/verdicts/:id`, `GET /api/verdicts`
- ✅ Cortex design system: CSS variables, Cormorant Garamond / Source Serif 4 / DM Sans, judicial-anatomical palette

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
