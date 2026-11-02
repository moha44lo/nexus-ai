import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("embedded NEXUS dashboard JavaScript parses successfully", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const scripts = [...source.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
  assert.ok(scripts.length > 0, "Dashboard must contain an executable script.");
  for (const script of scripts) new vm.Script(script[1]);
});

test("mission control exposes real health and execution-history controls", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  for (const id of ["systemPulse", "systemLabel", "systemDetails", "runList", "recentRuns"]) {
    assert.match(source, new RegExp('id="' + id + '"'));
  }
  assert.match(source, /api\("\/api\/agent\/runs\/"\+/);
  assert.match(source, /refreshHealth\(\)/);
});
