#!/usr/bin/env bash
# Install from THIS directory. Do not find ~/Downloads — that is what broke the first copy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Installing omarchy-computer-use-agent in $ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required." >&2
  exit 1
fi

npm install
npx playwright install chromium

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Wrote .env from .env.example"
fi

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
source .env
set +a

MODEL="${OLLAMA_MODEL:-qwen2.5vl:3b}"

if command -v ollama >/dev/null 2>&1; then
  if ! curl -fsS --max-time 2 "${OLLAMA_HOST:-http://127.0.0.1:11434}/api/tags" >/dev/null; then
    echo "Starting ollama serve in the background…"
    nohup ollama serve >/tmp/ollama-cua.log 2>&1 &
    sleep 2
  fi
  echo "Pulling $MODEL (one-time, may take several minutes)…"
  ollama pull "$MODEL"
else
  echo "Ollama is not on PATH. Install it from https://ollama.com then re-run:"
  echo "  ollama pull $MODEL"
fi

echo
echo "Install complete."
node src/doctor.js || true
echo
echo "Run a task with:"
echo "  ./scripts/run.sh \"Open wikipedia.org and search for Julia Child\""
