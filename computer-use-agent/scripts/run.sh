#!/usr/bin/env bash
# Always run from the repo that contains this script.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -eq 0 ]]; then
  echo "Usage: ./scripts/run.sh \"Open wikipedia.org and search for Julia Child\"" >&2
  exit 2
fi

if [[ ! -d node_modules ]]; then
  echo "Dependencies missing. Run ./scripts/install.sh first." >&2
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
HOST="${HOST/localhost/127.0.0.1}"

if ! curl -fsS --max-time 2 "$HOST/api/tags" >/dev/null; then
  if command -v ollama >/dev/null 2>&1; then
    echo "Ollama is not responding at $HOST — starting ollama serve…"
    nohup ollama serve >/tmp/ollama-cua.log 2>&1 &
    for _ in 1 2 3 4 5 6 7 8; do
      curl -fsS --max-time 1 "$HOST/api/tags" >/dev/null && break
      sleep 1
    done
  fi
fi

exec node src/index.js run "$@"
