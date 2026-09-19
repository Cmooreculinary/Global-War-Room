import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAction } from "../src/actions.js";

describe("parseAction", () => {
  it("parses GOTO with a bare domain", () => {
    const a = parseAction("GOTO wikipedia.org");
    assert.equal(a.type, "GOTO");
    assert.equal(a.url, "https://wikipedia.org");
  });

  it("parses CLICK by index", () => {
    const a = parseAction("CLICK 3");
    assert.equal(a.type, "CLICK");
    assert.deepEqual(a.target, { kind: "index", index: 3 });
  });

  it("parses TYPE and DONE from a noisy model reply", () => {
    const typed = parseAction("Sure.\nTYPE Julia Child\nI will search next.");
    assert.equal(typed.type, "TYPE");
    assert.equal(typed.text, "Julia Child");

    const done = parseAction("DONE Julia Child was an American chef.");
    assert.equal(done.type, "DONE");
    assert.match(done.result, /Julia Child/);
  });

  it("parses JSON actions", () => {
    const a = parseAction('{"action":"click","target":2}');
    assert.equal(a.type, "CLICK");
    assert.equal(a.target.index, 2);
  });

  it("treats a bare URL as GOTO", () => {
    const a = parseAction("https://en.wikipedia.org/wiki/Julia_Child");
    assert.equal(a.type, "GOTO");
  });
});
