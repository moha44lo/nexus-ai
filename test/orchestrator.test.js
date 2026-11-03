import test from "node:test";
import assert from "node:assert/strict";
import { runCrew, AGENT_ROSTER } from "../src/orchestrator.js";

function mockAI({ failRole = null, transientRole = null, score = 96, issues = [] } = {}) {
  const calls = [];
  const modelCalls = [];
  const roleAttempts = new Map();
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
      const role = AGENT_ROSTER.find(item => system.includes(item.prompt));
      if (failRole && role?.title === failRole) throw new Error("offline");
      if (role) {
        const attempts = (roleAttempts.get(role.id) || 0) + 1;
        roleAttempts.set(role.id, attempts);
        if (transientRole === role.title && attempts === 1) throw new Error("503 temporarily unavailable");
        return { response: role.title + " Bericht." };
      }
      throw new Error("Unexpected role: " + system.slice(0, 100));
    } } }
  };
}

test("routes a 62-agent roster through the core and six selected specialists", async () => {
  const mock = mockAI();
  const events = [];
  const result = await runCrew(mock.env, "Erstelle einen Plan", "Kontext", event => events.push(event));
  assert.equal(result.answer, "Geprüfte finale Antwort mit konkreten Schritten.");
  assert.equal(result.evolution.agentsConfigured, 62);
  assert.equal(result.evolution.agentsSelected, 18);
  assert.equal(new Set(result.evolution.models.map(item => item.id)).size, 62, "each specialist role must be unique");
  assert.equal(mock.modelCalls.length >= 18, true, "all eighteen routed specialist roles must invoke Workers AI");
  assert.equal(result.evolution.agentsCompleted, 18);
  assert.equal(result.evolution.rounds.length, 1);
  assert.equal(result.verification.passed, true);
  assert.equal(result.verification.qualityScore, 96);
  assert.equal(result.agents.filter(agent => agent.status === "completed").length, 20);
  assert.equal(events.filter(event => event.status === "running").length, 20);
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
  assert.equal(result.evolution.agentsCompleted, 17);
  assert.equal(result.verification.passed, true);
});

test("returns a reviewed partial answer when only two specialists are available", async () => {
  let specialistCalls = 0;
  const env = { AI: { run: async (_model, input) => {
    const system = input.messages[0].content;
    if (system.includes("leitende Meta-Orchestrator")) return { response: "Zusammengeführte Teilantwort." };
    if (system.includes("unabhängiger Qualitätsrichter")) return { response: JSON.stringify({ score: 95, must_fix: [], keep: [], verdict: "ready" }) };
    if (system.includes("finale Quality Gate")) return { response: JSON.stringify({ score: 95, issues: [], answer: "NEXUS liefert die verfügbare Teilantwort." }) };
    specialistCalls += 1;
    if (specialistCalls <= 2) return { response: "Verifizierter Teilbericht." };
    throw new Error("provider offline");
  } } };
  const result = await runCrew(env, "Test");
  assert.equal(result.answer, "NEXUS liefert die verfügbare Teilantwort.");
  assert.equal(result.evolution.agentsCompleted, 2);
  assert.equal(result.verification.passed, false);
  assert.match(result.verification.note, /Teillauf/);
});

test("uses the NEXUS Core fallback when every specialist fails", async () => {
  const env = { AI: { run: async (_model, input) => {
    const system = input.messages[0].content;
    if (system.includes("Du bist NEXUS AI.")) return { response: "Direkte NEXUS-Antwort." };
    if (system.includes("unabhängiger Qualitätsrichter")) return { response: JSON.stringify({ score: 90, must_fix: [], keep: [], verdict: "ready" }) };
    if (system.includes("finale Quality Gate")) return { response: JSON.stringify({ score: 90, issues: [], answer: "Geprüfte Fallback-Antwort." }) };
    throw new Error("provider offline");
  } } };
  const result = await runCrew(env, "Test");
  assert.equal(result.answer, "Geprüfte Fallback-Antwort.");
  assert.equal(result.evolution.agentsCompleted, 0);
  assert.equal(result.verification.passed, false);
  assert.ok(result.agents.some(agent => agent.agent === "nexus_fallback" && agent.status === "completed"));
});

test("fails with the actionable error when the NEXUS Core fallback is unavailable", async () => {
  const env = { AI: { run: async () => ({ response: "" }) } };
  await assert.rejects(() => runCrew(env, "Test"), /NEXUS Core lieferte eine leere Antwort/);
});

test("retries a transient Workers AI 503 once and continues the swarm", async () => {
  const mock = mockAI({ transientRole: "Recherche-Spezialist" });
  const result = await runCrew(mock.env, "Erstelle einen Plan");
  assert.equal(result.evolution.agentsCompleted, 18);
  assert.equal(result.verification.passed, true);
  assert.ok(mock.modelCalls.filter(model => model === "@cf/meta/llama-4-scout-17b-16e-instruct").length >= 2);
});
