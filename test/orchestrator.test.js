import test from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../src/orchestrator.js";

test("delegates work to three parallel specialist agents and synthesizes their reports", async () => {
  const calls = [];
  const env = { AI: { run: async (_model, input) => {
    const system = input.messages[0].content;
    calls.push(system);
    if (system.includes("leitende Orchestrator")) return { response: "Zusammengeführte Antwort." };
    if (system.includes("Strategist")) return { response: "Strategie-Bericht." };
    if (system.includes("spezialisierte Problemlöser")) return { response: "Fach-Bericht." };
    if (system.includes("Kritik- und Risiko-Agent")) return { response: "Risiko-Bericht." };
    throw new Error("Unexpected role");
  } } };
  const events = [];
  const result = await runCrew(env, "Erstelle einen Plan", "Kontext", event => events.push(event));
  assert.equal(result.answer, "Zusammengeführte Antwort.");
  assert.equal(result.agents.filter(agent => agent.status === "completed").length, 3);
  assert.equal(events.filter(event => event.status === "running").length, 3);
  assert.equal(calls.length, 4);
  assert.equal(result.verification.passed, true);
});

test("continues with available agents if one specialist fails", async () => {
  const env = { AI: { run: async (_model, input) => {
    const system = input.messages[0].content;
    if (system.includes("leitende Orchestrator")) return { response: "Teilantwort." };
    if (system.includes("Strategist")) throw new Error("offline");
    return { response: "Bericht." };
  } } };
  const result = await runCrew(env, "Test");
  assert.equal(result.answer, "Teilantwort.");
  assert.equal(result.agents.filter(agent => agent.status === "completed").length, 2);
  assert.equal(result.verification.passed, true);
});


test("treats empty model output as a failed specialist instead of a successful report", async () => {
  const env = { AI: { run: async (_model, input) => {
    const system = input.messages[0].content;
    if (system.includes("leitende Orchestrator")) return { response: "Synthetische Antwort." };
    if (system.includes("Strategist")) return { response: "   " };
    return { response: "Nutzbarer Bericht." };
  } } };
  const result = await runCrew(env, "Test");
  assert.equal(result.agents.find(agent => agent.agent === "strategist").status, "failed");
  assert.equal(result.agents.filter(agent => agent.status === "completed").length, 2);
});

test("fails clearly when every specialist returns empty output", async () => {
  const env = { AI: { run: async () => ({ response: "" }) } };
  await assert.rejects(() => runCrew(env, "Test"), /Keiner der NEXUS-Spezialagenten/);
});
