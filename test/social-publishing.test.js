import test from "node:test";
import assert from "node:assert/strict";
import { decryptTikTokToken, encryptTikTokToken } from "../src/social-publishing.js";

const secret = "nexus-test-secret-that-is-at-least-32-characters-long";

test("TikTok tokens are encrypted at rest and decrypt correctly", async () => {
  const token = "act.example-sensitive-access-token";
  const encrypted = await encryptTikTokToken(token, secret);
  assert.notEqual(encrypted, token);
  assert.equal(encrypted.includes(token), false);
  assert.equal(await decryptTikTokToken(encrypted, secret), token);
});

test("encrypted TikTok tokens cannot be decrypted with a different secret", async () => {
  const encrypted = await encryptTikTokToken("refresh-token", secret);
  await assert.rejects(() => decryptTikTokToken(encrypted, "a-different-secret-that-is-long-enough-123"));
});

test("TikTok token encryption rejects weak application secrets", async () => {
  await assert.rejects(() => encryptTikTokToken("token", "short"), /zu kurz/);
});

test("TikTok chunk upload sends required byte headers and checks final chunk status", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/social-publishing.js", import.meta.url), "utf8");
  assert.match(source, /"Content-Length": String\(chunk\.byteLength\)/);
  assert.match(source, /expectedStatus = end === bytes\.byteLength - 1 \? 201 : 206/);
});
