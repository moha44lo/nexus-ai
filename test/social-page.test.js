import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("embedded NEXUS browser script parses", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const match = source.match(/<script>([\\s\\S]*?)<\\/script>/);
  assert.ok(match, "inline application script must exist");
  assert.doesNotThrow(() => new Function(match[1]));
});

test("Social Autopilot workspace exposes its primary controls", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  for (const marker of ['id="socialView"', 'id="socialForm"', 'id="socialGenerate"', 'id="socialPosts"', 'data-view="social"']) {
    assert.ok(source.includes(marker), "missing UI marker: " + marker);
  }
});
