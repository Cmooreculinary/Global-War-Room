import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ollamaHost } from "../src/ollama.js";

describe("ollamaHost", () => {
  it("rewrites localhost to 127.0.0.1 so Node fetch does not hit IPv6", () => {
    process.env.OLLAMA_HOST = "http://localhost:11434";
    assert.equal(ollamaHost(), "http://127.0.0.1:11434");
    delete process.env.OLLAMA_HOST;
  });

  it("defaults to 127.0.0.1", () => {
    delete process.env.OLLAMA_HOST;
    assert.equal(ollamaHost(), "http://127.0.0.1:11434");
  });
});
