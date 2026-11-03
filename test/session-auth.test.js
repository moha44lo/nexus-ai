import test from "node:test";
import assert from "node:assert/strict";
import { hasValidSession } from "../src/session-auth.js";

const sign = async (_secret, payload) => "sig:" + payload;
const tokenFor = expires => expires + ".sig:nexus:" + expires;

test("valid cookie survives a stale bearer token from sessionStorage", async () => {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const request = new Request("https://nexus.test/api/chat", {
    headers: {
      Authorization: "Bearer 1.expired-token",
      Cookie: "nexus_session=" + tokenFor(expires)
    }
  });
  assert.equal(await hasValidSession(request, "test-secret", sign), true);
});

test("valid bearer token is accepted without a cookie", async () => {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const request = new Request("https://nexus.test/api/social/generate", {
    headers: { Authorization: "Bearer " + tokenFor(expires) }
  });
  assert.equal(await hasValidSession(request, "test-secret", sign), true);
});

test("expired or invalid tokens are rejected", async () => {
  const request = new Request("https://nexus.test/api/chat", {
    headers: {
      Authorization: "Bearer 1.expired-token",
      Cookie: "nexus_session=2.also-expired"
    }
  });
  assert.equal(await hasValidSession(request, "test-secret", sign), false);
  assert.equal(await hasValidSession(request, "", sign), false);
});
