#!/usr/bin/env node
import fs from "node:fs";
import { defaultModel, ollamaHost, waitForOllama } from "./ollama.js";

const ok = (label, detail = "") => console.log(`ok       ${label}${detail ? `  ${detail}` : ""}`);
const bad = (label, detail) => console.log(`FAIL     ${label}  ${detail}`);

async function main() {
  let failed = 0;

  ok("node", process.version);

  const guesses = [
    process.env.CHROMIUM_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  const chrome = guesses.find((p) => fs.existsSync(p));
  if (chrome) ok("browser", chrome);
  else {
    bad("browser", "no system Chromium — Playwright will download one on npm install");
  }

  const host = ollamaHost();
  try {
    const tags = await waitForOllama({ timeoutMs: 8000 });
    const names = (tags.models || []).map((m) => m.name || m.model);
    ok("ollama", host);
    const model = defaultModel();
    const has = names.some((n) => n === model || n.startsWith(`${model.split(":")[0]}:`));
    if (has) ok("model", model);
    else {
      failed += 1;
      bad("model", `${model} is not installed. Run: ollama pull ${model}`);
      if (names.length) console.log(`         have: ${names.join(", ")}`);
    }
  } catch (err) {
    failed += 1;
    bad("ollama", err.message);
  }

  process.exit(failed ? 1 : 0);
}

main();
