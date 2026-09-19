import fs from "node:fs";
import { chromium } from "playwright";

export async function launchBrowser() {
  const headed = process.env.HEADLESS === "0" || process.env.HEADLESS === "false";
  const executablePath = resolveChromium();
  const browser = await chromium.launch({
    headless: !headed,
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });
  const page = await context.newPage();
  return { browser, context, page };
}

function resolveChromium() {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const guesses = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  return guesses.find((p) => fs.existsSync(p));
}
