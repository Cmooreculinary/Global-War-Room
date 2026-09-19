/** Parse a small-model computer-use reply into one action. */

const ACTIONS = new Set([
  "GOTO",
  "CLICK",
  "TYPE",
  "ENTER",
  "SCROLL",
  "WAIT",
  "BACK",
  "DONE",
]);

export function parseAction(text) {
  const raw = String(text || "").trim();
  if (!raw) return { type: "WAIT", ms: 500, raw };

  const json = tryJson(raw);
  if (json) return normalizeJson(json, raw);

  const line = firstCommandLine(raw);
  const [verb, ...rest] = line.split(/\s+/);
  const kind = (verb || "").toUpperCase().replace(/:$/, "");
  const arg = rest.join(" ").trim();

  switch (kind) {
    case "GOTO":
    case "NAVIGATE":
    case "OPEN":
      return { type: "GOTO", url: normalizeUrl(arg), raw };
    case "CLICK":
      return { type: "CLICK", target: parseTarget(arg), raw };
    case "TYPE":
    case "INPUT":
      return { type: "TYPE", text: stripQuotes(arg), raw };
    case "ENTER":
    case "SUBMIT":
      return { type: "ENTER", raw };
    case "SCROLL":
      return { type: "SCROLL", direction: /up/i.test(arg) ? "up" : "down", raw };
    case "WAIT":
      return { type: "WAIT", ms: Math.min(10000, Math.max(200, parseInt(arg, 10) || 800)), raw };
    case "BACK":
      return { type: "BACK", raw };
    case "DONE":
    case "ANSWER":
    case "FINISH":
      return { type: "DONE", result: arg || raw, raw };
    default:
      if (/^https?:\/\//i.test(line)) return { type: "GOTO", url: line, raw };
      return { type: "DONE", result: raw, raw };
  }
}

export function formatCatalog(actions) {
  return ACTIONS;
}

function firstCommandLine(text) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const hit = lines.find((l) => {
    const verb = l.split(/\s+/)[0].toUpperCase().replace(/:$/, "");
    return ACTIONS.has(verb) || verb === "NAVIGATE" || verb === "OPEN" || verb === "INPUT" || verb === "SUBMIT" || verb === "ANSWER" || verb === "FINISH";
  });
  return hit || lines[0] || text;
}

function tryJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeJson(obj, raw) {
  const type = String(obj.action || obj.type || obj.verb || "").toUpperCase();
  if (type === "GOTO" || type === "NAVIGATE") return { type: "GOTO", url: normalizeUrl(obj.url || obj.target || ""), raw };
  if (type === "CLICK") return { type: "CLICK", target: parseTarget(obj.target ?? obj.id ?? obj.n ?? obj.index), raw };
  if (type === "TYPE") return { type: "TYPE", text: String(obj.text || obj.value || ""), raw };
  if (type === "ENTER") return { type: "ENTER", raw };
  if (type === "SCROLL") return { type: "SCROLL", direction: obj.direction === "up" ? "up" : "down", raw };
  if (type === "WAIT") return { type: "WAIT", ms: Number(obj.ms) || 800, raw };
  if (type === "BACK") return { type: "BACK", raw };
  if (type === "DONE") return { type: "DONE", result: String(obj.result || obj.answer || obj.text || ""), raw };
  return { type: "DONE", result: raw, raw };
}

function parseTarget(arg) {
  if (arg == null) return { kind: "index", index: 1 };
  if (typeof arg === "number") return { kind: "index", index: arg };
  const s = String(arg).trim();
  const n = parseInt(s.replace(/^#/, ""), 10);
  if (Number.isFinite(n)) return { kind: "index", index: n };
  return { kind: "text", text: stripQuotes(s) };
}

function stripQuotes(s) {
  return String(s || "").replace(/^['"]|['"]$/g, "");
}

function normalizeUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "https://wikipedia.org";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}
