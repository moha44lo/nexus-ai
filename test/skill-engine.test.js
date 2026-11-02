import test from "node:test";
import assert from "node:assert/strict";
import { compileSkill, executeSkill } from "../src/skill-engine.js";

const definition = (steps) => ({
  id: "demo.skill",
  name: "Demo",
  description: "Test skill",
  version: "1.0.0",
  steps
});

test("compiler rejects duplicate step ids", () => {
  assert.throws(() => compileSkill(definition([
    { id: "same", tool: "notes.read" },
    { id: "same", tool: "notes.write" }
  ])), /doppelte Schritt-ID/);
});

test("approval gate stops before protected tool execution", async () => {
  let called = false;
  const skill = compileSkill(definition([
    { id: "write", tool: "notes.write", requiresApproval: true }
  ]));
  const result = await executeSkill(skill, {
    tools: { "notes.write": { execute: async () => { called = true; } } }
  });
  assert.equal(result.status, "awaiting_approval");
  assert.equal(called, false);
});

test("approved steps receive prior outputs and complete", async () => {
  const skill = compileSkill(definition([
    { id: "first", tool: "demo.first" },
    { id: "second", tool: "demo.second" }
  ]));
  const result = await executeSkill(skill, {
    tools: {
      "demo.first": { execute: async () => "one" },
      "demo.second": { execute: async ({ outputs }) => outputs.first + "-two" }
    }
  });
  assert.equal(result.status, "completed");
  assert.equal(result.outputs.second, "one-two");
});

test("retry is limited to explicitly safe idempotent tools", async () => {
  const skill = compileSkill(definition([
    { id: "read", tool: "demo.read", retrySafe: true, maxAttempts: 2 }
  ]));
  let calls = 0;
  const result = await executeSkill(skill, {
    tools: {
      "demo.read": {
        idempotent: true,
        execute: async () => {
          calls += 1;
          if (calls === 1) throw new Error("temporary");
          return "ok";
        }
      }
    }
  });
  assert.equal(result.status, "completed");
  assert.equal(calls, 2);
});
