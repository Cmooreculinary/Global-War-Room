#!/usr/bin/env node
import { spawn } from "node:child_process";
import { loadEnv } from "./loadEnv.js";
import { launchBrowser } from "./browser.js";
import { runTask } from "./agent.js";
import { defaultModel, ollamaHost, waitForOllama, ensureModel } from "./ollama.js";

loadEnv();

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "--help" || cmd === "-h") {
  printHelp();
  process.exit(0);
}

if (cmd === "doctor") {
  const child = spawn(process.execPath, [new URL("./doctor.js", import.meta.url).pathname], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
} else if (cmd === "run") {
  const task = args.slice(1).join(" ").trim();
  if (!task) {
    console.error('Usage: cua run "Open wikipedia.org and search for Julia Child"');
    process.exit(2);
  }
  main(task).catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
} else {
  // `node src/index.js "the task"` — same as run
  main([cmd, ...args.slice(1)].join(" ").trim()).catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
}

async function main(task) {
  console.log(`host     ${ollamaHost()}`);
  console.log(`model    ${defaultModel()}`);
  console.log(`task     ${task}`);

  await waitForOllama();
  const model = await ensureModel(defaultModel());
  if (model.missing) {
    throw new Error(
      `Model ${defaultModel()} is not installed. Run: ollama pull ${defaultModel()}`
    );
  }

  const { browser, page } = await launchBrowser();
  console.log("browser  opened. Ctrl+C stops the agent.");
  try {
    const result = await runTask(page, task);
    console.log("");
    console.log(result.ok ? "DONE" : "STOPPED");
    console.log(result.result);
    console.log(`url      ${result.url}`);
    console.log(`artifacts ${result.artifactsDir}`);
    process.exit(result.ok ? 0 : 3);
  } finally {
    await browser.close().catch(() => {});
  }
}

function printHelp() {
  console.log(`Computer-use agent — local Chromium + Ollama

  ./scripts/run.sh "Open wikipedia.org and search for Julia Child"
  node src/index.js run "…"
  node src/index.js doctor

Fixes vs the Downloads copy:
  • talks to http://127.0.0.1:11434 (not localhost) so fetch does not fail
  • retries and waits while the vision model loads
  • numbers on-screen controls so a 3B model can click
  • install/run scripts live next to the code — no find ~/Downloads
`);
}
