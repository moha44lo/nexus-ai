import test from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../src/orchestrator.js";

function mockAI({ failRole = null, score = 96, issues = [] } = {}) {
  const calls = [];
  const modelCalls = [];
  return {
    calls,
    modelCalls,
    env: { AI: { run: async (model, input) => {
      modelCalls.push(model);
      const system = input.messages[0].content;
      calls.push(system);
      if (system.includes("leitende Meta-Orchestrator")) return { response: "Entwurf mit Fakten, Annahmen und offenen Punkten." };
      if (system.includes("unabhängiger Qualitätsrichter")) return { response: JSON.stringify({ score, must_fix: issues, keep: [], verdict: issues.length ? "improve" : "ready" }) };
      if (system.includes("Evolution-Refiner")) return { response: "Verbesserter Entwurf mit klaren Belegen und Grenzen." };
      if (system.includes("finale Quality Gate")) return { response: JSON.stringify({ score, issues: [], answer: "Geprüfte finale Antwort mit konkreten Schritten." }) };
      const role = ["Strategie-Architekt","Recherche-Spezialist","Fach-Experte","Daten-Analyst","Kritik-Instanz","Red Team","System-Architekt","Performance-Optimierer"].find(name => system.includes(name));
      if (failRole && role === failRole) throw new Error("offline");
      if (role) return { response: role + " Bericht." };
      throw new Error("Unexpected role: " + system.slice(0, 100));
    } } }
  };
}

test("runs eight specialist agents, an improvement loop and final quality gate", async () => {
  const mock = mockAI();
  const events = [];
  const result = await runCrew(mock.env, "Erstelle einen Plan", "Kontext", event => events.push(event));
  assert.equal(result.answer, "Geprüfte finale Antwort mit konkreten Schritten.");
  assert.equal(result.evolution.agentsConfigured, 8);
  assert.equal(new Set(result.evolution.models.map(item => item.model)).size, 8, "each specialist must use a distinct model");
  assert.equal(new Set(mock.modelCalls.slice(0, 8)).size, 8, "the eight parallel agent calls must target eight different models");
  assert.equal(result.evolution.agentsCompleted, 8);
  assert.equal(result.evolution.rounds.length, 1);
  assert.equal(result.verification.passed, true);
  assert.equal(result.verification.qualityScore, 96);
  assert.equal(result.agents.filter(agent => agent.status === "completed").length, 10);
  assert.equal(events.filter(event => event.status === "running").length, 10);
});

test("revises a draft when the judge finds issues", async () => {
  const mock = mockAI({ issues: ["Belege fehlen.", "Risiken konkreter machen."] });
  const result = await runCrew(mock.env, "Bewerte einen Markt");
  assert.equal(result.evolution.rounds[0].verdict, "revised");
  assert.match(result.answer, /Geprüfte finale Antwort/);
  assert.ok(mock.calls.some(system => system.includes("Evolution-Refiner")));
});

test("continues with available agents but requires six successful specialists", async () => {
  const mock = mockAI({ failRole: "Strategie-Architekt" });
  const result = await runCrew(mock.env, "Test");
  assert.equal(result.evolution.agentsCompleted, 7);
  assert.equal(result.verification.passed, true);
});

test("fails clearly when fewer than three agents can produce a report", async () => {
  const env = { AI: { run: async () => ({ response: "" }) } };
  await assert.rejects(() => runCrew(env, "Test"), /Zu wenige Agenten/);
});
