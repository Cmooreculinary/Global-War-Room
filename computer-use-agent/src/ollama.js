/** Resilient Ollama client. The original agent died with TypeError: fetch failed. */

const DEFAULT_HOST = "http://127.0.0.1:11434";

export function ollamaHost() {
  const raw = (process.env.OLLAMA_HOST || DEFAULT_HOST).trim().replace(/\/$/, "");
  // Node's fetch follows IPv6 first for "localhost" and often fails while curl works.
  return raw.replace("://localhost", "://127.0.0.1");
}

export function defaultModel() {
  return process.env.OLLAMA_MODEL || "qwen2.5vl:3b";
}

export async function waitForOllama({ timeoutMs = 20000 } = {}) {
  const host = ollamaHost();
  const start = Date.now();
  let last = "not tried";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return await res.json();
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = causeMessage(err);
    }
    await sleep(800);
  }
  throw new Error(
    `Cannot reach Ollama at ${host} (${last}). Start it with: ollama serve`
  );
}

export async function ensureModel(model) {
  const tags = await waitForOllama();
  const names = (tags.models || []).map((m) => m.name || m.model);
  if (names.some((n) => n === model || n.startsWith(`${model}:`) || n.split(":")[0] === model.split(":")[0])) {
    return { pulled: false, names };
  }
  return { pulled: false, names, missing: true };
}

export async function chat({ model, messages, timeoutMs }) {
  const host = ollamaHost();
  const ms = timeoutMs || Number(process.env.STEP_TIMEOUT_MS) || 180000;
  const body = {
    model: model || defaultModel(),
    stream: false,
    messages: messages.map(toOllamaMessage),
    options: { temperature: 0.1 },
  };

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${host}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ms),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Ollama chat failed (${res.status}): ${text.slice(0, 400)}`);
      }
      const data = JSON.parse(text);
      const content = data?.message?.content;
      if (typeof content !== "string") {
        throw new Error("Ollama returned no message content");
      }
      return { content, raw: data };
    } catch (err) {
      lastErr = err;
      const msg = causeMessage(err);
      if (attempt === 3 || /timeout|abort/i.test(msg)) break;
      await sleep(1200 * attempt);
    }
  }
  throw new Error(`Ollama request failed: ${causeMessage(lastErr)}`);
}

function toOllamaMessage(m) {
  const out = { role: m.role, content: m.content || "" };
  if (Array.isArray(m.images) && m.images.length) out.images = m.images;
  return out;
}

export function causeMessage(err) {
  if (!err) return "unknown error";
  if (err.name === "TimeoutError" || err.name === "AbortError") {
    return "timed out waiting for the model (first load can take a minute)";
  }
  const cause = err.cause?.message || err.cause?.code;
  return cause ? `${err.message} (${cause})` : err.message;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
