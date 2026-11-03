import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_ROSTER } from "../src/orchestrator.js";
import { EXTRA_AGENTS, CAPABILITY_CATALOG } from "../src/agent-catalog.js";

test("NEXUS exposes 50 unique specialist agents and 50 mapped capability modes", () => {
  assert.equal(EXTRA_AGENTS.length, 50);
  assert.equal(CAPABILITY_CATALOG.length, 50);
  assert.equal(AGENT_ROSTER.length, 62);
  assert.equal(new Set(AGENT_ROSTER.map(agent => agent.id)).size, 62);
  assert.equal(new Set(CAPABILITY_CATALOG.map(capability => capability.id)).size, 50);
  assert.ok(CAPABILITY_CATALOG.every(capability => EXTRA_AGENTS.some(agent => agent.id === capability.agentId)));
});
