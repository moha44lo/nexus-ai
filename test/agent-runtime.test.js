import test from "node:test";
import assert from "node:assert/strict";
import { validateBrowserUrl, createPlan, needsApproval } from "../src/agent-runtime.js";

test("accepts public HTTPS destinations", () => {
  assert.equal(validateBrowserUrl("https://example.com/path"), "https://example.com/path");
});

test("rejects non-web protocols", () => {
  assert.throws(() => validateBrowserUrl("file:///etc/passwd"), /HTTP- und HTTPS/);
});

test("rejects localhost and private IPv4 destinations", () => {
  for (const url of ["http://localhost", "http://127.0.0.1", "http://10.0.0.4", "http://192.168.1.2", "http://172.16.0.1"]) {
    assert.throws(() => validateBrowserUrl(url), /gesperrt/);
  }
});

test("rejects link-local metadata IPs", () => {
  assert.throws(() => validateBrowserUrl("http://169.254.169.254/latest/meta-data"), /gesperrt/);
});

test("normalizes shorthand IPv4 loopback and blocks it", () => {
  assert.throws(() => validateBrowserUrl("http://127.1"), /gesperrt/);
});
test("blocks private IPv6 unique-local destinations", () => {
  assert.throws(() => validateBrowserUrl("http://[fc00::1]/"), /gesperrt/);
});
test("blocks private IPv6 link-local destinations", () => {
  assert.throws(() => validateBrowserUrl("http://[fe80::1]/"), /gesperrt/);
});

test("requires approval for browser clicks and form entry", () => {
  assert.equal(needsApproval({ steps: [{ tool: "browser.click" }] }), true);
  assert.equal(needsApproval({ steps: [{ tool: "browser.fill" }] }), true);
  assert.equal(needsApproval({ steps: [{ tool: "browser.inspect" }] }), false);
});

test("independent reviewer can veto a planner proposal", async () => {
  const replies = [
    { response: JSON.stringify({ goal: "test", summary: "test", steps: [{ id: "s1", tool: "browser.inspect", args: {} }] }) },
    { response: JSON.stringify({ approved: false, reason: "Nicht sicher." }) }
  ];
  const env = { AI: { run: async () => replies.shift() } };
  await assert.rejects(() => createPlan(env, "Prüfe diese Seite", []), /Review-Agent hat den Plan gestoppt/);
});

test("planner accepts safe browser search steps", async () => {
  const replies = [
    { response: JSON.stringify({ goal: "Recherche", summary: "Suche im Web", steps: [{ id: "s1", tool: "browser.search", args: { query: "Cloudflare Workers AI" } }] }) },
    { response: JSON.stringify({ approved: true, reason: "Öffentliche Suche ist zulässig." }) }
  ];
  const env = { AI: { run: async () => replies.shift() } };
  const plan = await createPlan(env, "Recherchiere Cloudflare Workers AI", []);
  assert.equal(plan.steps[0].tool, "browser.search");
  assert.equal(plan.steps[0].args.query, "Cloudflare Workers AI");
});
