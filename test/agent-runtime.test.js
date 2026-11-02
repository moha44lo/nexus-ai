import test from "node:test";
import assert from "node:assert/strict";
import { validateBrowserUrl, createPlan, needsApproval, classifyBrowserPage, searchWithFallback } from "../src/agent-runtime.js";

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


test("rejects embedded credentials in browser URLs", () => {
  assert.throws(() => validateBrowserUrl("https://user:secret@example.com"), /Zugangsdaten/);
});

test("blocks additional non-public IPv4 ranges", () => {
  for (const ip of ["0.1.2.3", "100.64.0.1", "198.18.0.1", "198.51.100.7", "203.0.113.9", "224.0.0.1"]) {
    assert.throws(() => validateBrowserUrl("http://" + ip), /gesperrt/);
  }
});

test("blocks IPv6 unspecified, multicast and documentation ranges", () => {
  for (const ip of ["[::]", "[ff02::1]", "[2001:db8::1]"]) {
    assert.throws(() => validateBrowserUrl("http://" + ip), /gesperrt/);
  }
});

test("blocks internal-only hostnames", () => {
  assert.throws(() => validateBrowserUrl("http://vault.internal"), /gesperrt/);
});

test("classifies CAPTCHA, login walls, 404 and public pages separately", () => {
  assert.equal(classifyBrowserPage({ title: "DuckDuckGo", text: "Select all squares containing a duck" }), "captcha");
  assert.equal(classifyBrowserPage({ status: 401, title: "Sign in" }), "login_or_restricted");
  assert.equal(classifyBrowserPage({ status: 404, title: "Page not found" }), "not_found");
  assert.equal(classifyBrowserPage({ status: 200, title: "Documentation", text: "Public documentation" }), "public");
});

test("reviewer false positives about general research do not block read-only plans", async () => {
  const replies = [
    { response: JSON.stringify({ goal: "Recherche", summary: "Öffentliche Quellen prüfen", steps: [{ id: "s1", tool: "browser.search", args: { query: "öffentliche Browser-Fehlerbehandlung" } }] }) },
    { response: JSON.stringify({ approved: false, reason: "Allgemeine Recherche oder Training im künstlichen Sinne." }) }
  ];
  const env = { AI: { run: async () => replies.shift() } };
  const plan = await createPlan(env, "Analysiere den letzten Recherche-Workflow und finde alternative öffentliche Quellen.", []);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.review.approved, true);
  assert.match(plan.review.reason, /Fehlalarm/);
});

test("search falls back to Bing when DuckDuckGo presents a CAPTCHA", async () => {
  let currentUrl = "";
  const page = {
    goto: async url => { currentUrl = url; return { status: () => 200 }; },
    title: async () => currentUrl.includes("duckduckgo") ? "DuckDuckGo" : "Bing",
    url: () => currentUrl,
    evaluate: async (_fn, providerId) => {
      if (!providerId) return currentUrl.includes("duckduckgo") ? "Select all squares containing a duck" : "Search results";
      if (providerId === "bing") return [{ title: "Browser reliability", url: "https://example.com/reliability", snippet: "A public result" }];
      return [];
    }
  };
  const result = await searchWithFallback(page, "browser reliability");
  assert.equal(result.provider, "bing");
  assert.equal(result.results.length, 1);
  assert.equal(result.attempts[0].classification, "captcha");
});
