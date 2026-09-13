# Global War Room

A deliberation app. The **War Room** is the principal experience: it takes the
day's coverage of a situation, strips it of everyone's framing into a neutral
intelligence brief, then hands that brief to five commanders (Alexander,
Genghis, Napoleon, Churchill, Eisenhower) who each read it and argue toward an
estimate. A secondary **Cerebral Cortex** mode routes a question to deliberation
chambers (Senate, Boardroom, Court Room, Council) and The Forge.

- **Backend:** FastAPI, all routes under `/api`, persistence in MongoDB.
- **Frontend:** React 19 + Tailwind + shadcn/ui (CRA/CRACO).
- **AI:** Claude Sonnet 4.5 via the Anthropic SDK; voice via the OpenAI SDK;
  billing via the Stripe SDK.

## Layout

```
backend/    FastAPI app (server.py), services, tests
frontend/   React app (src/), built to frontend/build
```

## Prerequisites

- Python 3.12
- Node 22 + Yarn 1.x
- MongoDB 6+ running locally (or a reachable `MONGO_URL`)

## Configure

```bash
cp backend/.env.example backend/.env      # set MONGO_URL, DB_NAME, and API keys
cp frontend/.env.example frontend/.env    # set REACT_APP_BACKEND_URL
```

Live deliberations, the War Room, and voice require `ANTHROPIC_API_KEY` and
`OPENAI_API_KEY`. The rest of the UI runs without them.

## Backend

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

Run the tests:

```bash
cd backend && . .venv/bin/activate && pytest
```

## Frontend (dev)

With the backend on `:8001` and `REACT_APP_BACKEND_URL=http://localhost:8001`:

```bash
cd frontend
yarn install
yarn start          # http://localhost:3000
```

## Single URL (one server)

Serve the compiled frontend and the API from one origin — handy for a single
shareable URL.

```bash
# Build the frontend against the same origin (relative /api):
cd frontend && REACT_APP_BACKEND_URL='' yarn build

# Serve build + /api together:
cd ../backend && . .venv/bin/activate
uvicorn serve_gwr:app --host 0.0.0.0 --port 8080   # http://localhost:8080
```

## Routes

- `/` — the War Room (principal app)
- `/cortex` — Cerebral Cortex deliberation
- `/forge` — The Forge
- `/chamber/:id` — a single chamber
- `/verdict/:id`, `/archive`, `/receipts`, `/about`, `/pricing`
- `/welcome` — the cinematic splash
