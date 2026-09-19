import fs from "node:fs/promises";
import path from "node:path";
import { parseAction } from "./actions.js";
import { chat, defaultModel } from "./ollama.js";
import { clearLabels, labelPage } from "./labels.js";

const SYSTEM = `You operate a web browser. You see a screenshot with red number badges on clickable things, plus a numbered list.

Reply with EXACTLY one command on the first line, nothing else:
GOTO https://example.com
CLICK 3
TYPE Julia Child
ENTER
SCROLL down
BACK
WAIT 800
DONE short answer to the human

Rules:
- Prefer CLICK by number from the list.
- After TYPE, use ENTER to submit a search box.
- When the task is finished, DONE with the answer.
- Do not apologize. Do not explain. One command.`;

export async function runTask(page, task, { maxSteps, artifactsDir } = {}) {
  const steps = maxSteps || Number(process.env.MAX_STEPS) || 20;
  const dir = artifactsDir || path.resolve("artifacts", stamp());
  await fs.mkdir(dir, { recursive: true });

  const history = [];
  let lastUrl = "";

  for (let step = 1; step <= steps; step += 1) {
    const items = await labelPage(page).catch(() => []);
    const shotPath = path.join(dir, `step-${String(step).padStart(2, "0")}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    const png = await fs.readFile(shotPath);
    const image = png.toString("base64");

    const url = page.url();
    const title = await page.title().catch(() => "");
    const catalog = items
      .map((it) => `[${it.id}] ${it.tag}${it.type ? `:${it.type}` : ""} — ${it.label}`)
      .join("\n");

    const user = [
      `TASK: ${task}`,
      `URL: ${url}`,
      `TITLE: ${title}`,
      catalog ? `ELEMENTS:\n${catalog}` : "ELEMENTS: (none labeled)",
      history.length ? `HISTORY:\n${history.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    process.stdout.write(`\nstep ${step}/${steps}  ${url}\n`);

    const { content } = await chat({
      model: defaultModel(),
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user, images: [image] },
      ],
    });

    const action = parseAction(content);
    process.stdout.write(`  model: ${content.split("\n")[0].slice(0, 160)}\n`);
    process.stdout.write(`  action: ${action.type}${action.url || action.text || action.target?.index || action.result ? " " : ""}${action.url || action.text || action.target?.index || (action.result || "").slice(0, 80)}\n`);

    const result = await applyAction(page, action, items);
    await clearLabels(page);
    history.push(`${step}. ${action.type} -> ${result}`);
    lastUrl = page.url();

    if (action.type === "DONE") {
      return { ok: true, result: action.result || result, url: lastUrl, steps: step, artifactsDir: dir };
    }
  }

  return { ok: false, result: "Reached step limit before DONE.", url: lastUrl, steps, artifactsDir: dir };
}

async function applyAction(page, action, items) {
  try {
    switch (action.type) {
      case "GOTO":
        await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        return `opened ${page.url()}`;
      case "CLICK": {
        const handle = await resolveTarget(page, action.target, items);
        if (!handle) return "click target not found";
        await handle.click({ timeout: 5000 });
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        return "clicked";
      }
      case "TYPE": {
        const focused = await page.locator(":focus");
        if (await focused.count()) {
          await focused.first().fill(action.text);
          return `typed "${action.text}"`;
        }
        const box = page.locator('input[type="search"], input[name="search"], input[type="text"], textarea').first();
        await box.fill(action.text, { timeout: 5000 });
        return `typed "${action.text}"`;
      }
      case "ENTER":
        await page.keyboard.press("Enter");
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        return "submitted";
      case "SCROLL":
        await page.mouse.wheel(0, action.direction === "up" ? -700 : 700);
        return `scrolled ${action.direction}`;
      case "WAIT":
        await page.waitForTimeout(action.ms);
        return `waited ${action.ms}ms`;
      case "BACK":
        await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
        return "back";
      case "DONE":
        return action.result || "done";
      default:
        return "unknown action";
    }
  } catch (err) {
    return `error: ${err.message}`;
  }
}

async function resolveTarget(page, target, items) {
  if (!target) return null;
  if (target.kind === "index") {
    const byAttr = page.locator(`[data-cua-id="${target.index}"]`);
    // labels were cleared; re-query by recorded label
    const item = items.find((it) => it.id === target.index);
    if (item?.label) {
      const named = page.getByRole("button", { name: item.label }).or(page.getByRole("link", { name: item.label })).or(page.getByLabel(item.label));
      if (await named.count()) return named.first();
      if (item.tag === "input") {
        const input = page.locator(`input[placeholder="${cssEscape(item.label)}"], input[name="${cssEscape(item.label)}"]`);
        if (await input.count()) return input.first();
      }
    }
    if (await byAttr.count()) return byAttr.first();
    return null;
  }
  const named = page.getByRole("button", { name: target.text }).or(page.getByRole("link", { name: target.text }));
  if (await named.count()) return named.first();
  return page.getByText(target.text, { exact: false }).first();
}

function cssEscape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
