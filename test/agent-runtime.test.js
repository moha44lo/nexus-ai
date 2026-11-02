import test from "node:test";
import assert from "node:assert/strict";
import { validateBrowserUrl } from "../src/agent-runtime.js";

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
