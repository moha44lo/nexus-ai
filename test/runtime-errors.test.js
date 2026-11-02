import test from "node:test";
import assert from "node:assert/strict";
import { formatRuntimeError } from "../src/runtime-errors.js";

test("turns Cloudflare free AI quota errors into an actionable German message", () => {
  const result = formatRuntimeError(new Error("4006: you have used up your daily free allocation of 10,000 neurons"));
  assert.match(result, /Tageskontingent aufgebraucht/);
  assert.match(result, /Reset/);
});

test("preserves useful provider diagnostics for other errors", () => {
  assert.equal(formatRuntimeError(new Error("Model unavailable")), "Model unavailable");
});
