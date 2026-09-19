# Computer-use agent (local)

A headed Chromium agent that looks at the page and acts, using **Ollama** on your machine. No cloud API keys.

This replaces the `~/Downloads/omarchy-ollama-browser-agent` copy that installed, opened a browser, then died with `TypeError: fetch failed`.

## What was broken

From the install/run log:

1. **Launch path** — `find ~/Downloads` hit three folders, `ash` vs `bash`, and chmod on the wrong tree.
2. **`TypeError: fetch failed`** — Node `fetch("http://localhost:11434")` often tries IPv6 first. `curl` to `127.0.0.1` worked; the agent did not.
3. **Vision probe** — a one-line `node -e` with a pasted JPEG was invalid JavaScript (`Unexpected identifier 'action'`).
4. **No wait/retry** — the first `qwen2.5vl:3b` call after a 3.2 GB pull can take a minute. One failed fetch aborted the run.

## Launch (on the Omarchy machine)

```bash
git clone https://github.com/Cmooreculinary/Agent_Factory.git
cd Agent_Factory
chmod +x scripts/install.sh scripts/run.sh
./scripts/install.sh
./scripts/run.sh "Open wikipedia.org and search for Julia Child"
```

Doctor (same checks the old `check.js` printed):

```bash
node src/index.js doctor
```

You should see Node, Chromium, Ollama at `http://127.0.0.1:11434`, and `qwen2.5vl:3b`.

## Requirements

- Node 20+
- [Ollama](https://ollama.com) running locally
- A vision model: `ollama pull qwen2.5vl:3b` (already on the machine that pulled the 3.2 GB manifest)
- Chromium (`/usr/bin/chromium` or Playwright’s browser)

Show the window:

```bash
HEADLESS=0 ./scripts/run.sh "Open wikipedia.org and search for Julia Child"
```

## How it acts

Each step: screenshot with numbered badges → Ollama vision → one command (`GOTO`, `CLICK n`, `TYPE`, `ENTER`, `DONE`). Artifacts land in `artifacts/`.

## Safety

The agent can click and type in a real browser. Run it only on sites you intend. It does not send traffic to a hosted LLM.
