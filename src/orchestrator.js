import { extractWorkersAIText } from "./model-output.js";
import { inspectAnswer } from "./quality-control.js";

const META_MODEL = "@cf/zai-org/glm-5.3";
const REVIEW_MODEL = "@cf/deepseek-ai/deepseek-v4-flash-0731";
const REFINER_MODEL = "@cf/moonshotai/kimi-k2.6";
const QUALITY_MODEL = "@cf/openai/gpt-oss-120b";
const MAX_IMPROVEMENT_ROUNDS = 2;
const ROLES = [
  { id: "strategist", model: "@cf/moonshotai/kimi-k2.6", name: "Strategist", title: "Strategie-Architekt", symbol: "S", prompt: "Du bist der Strategie-Architekt. Zerlege das Ziel, definiere messbare Erfolgskriterien, priorisiere und erkenne Abhängigkeiten." },
  { id: "researcher", model: "@cf/meta/llama-4-scout-17b-16e-instruct", name: "Researcher", title: "Recherche-Spezialist", symbol: "R", prompt: "Du bist der Recherche-Spezialist. Trenne gesicherte Fakten, Kontext, Hypothesen und offene Fragen. Erfinde niemals Quellen oder Rechercheergebnisse. Wenn keine Quellen mitgeliefert wurden, sage ausdrücklich, dass keine externe Recherche stattgefunden hat." },
  { id: "specialist", model: "@cf/google/gemma-4-26b-a4b-it", name: "Specialist", title: "Fach-Experte", symbol: "F", prompt: "Du bist der Fach-Experte. Entwickle die fachlich stärkste konkrete Lösung mit Beispielen, Prioritäten und umsetzbaren Schritten." },
  { id: "analyst", model: "@cf/openai/gpt-oss-120b", name: "Analyst", title: "Daten-Analyst", symbol: "A", prompt: "Du bist der Daten-Analyst. Prüfe Zahlen, Logik, Kosten, Nutzen, Annahmen und Unsicherheiten. Rechne nachvollziehbar und kennzeichne Schätzungen." },
  { id: "critic", model: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "Critic", title: "Kritik-Instanz", symbol: "C", prompt: "Du bist die kompromisslose Kritik-Instanz. Suche Widersprüche, Lücken, schwache Argumente, unbelegte Behauptungen und bessere Alternativen." },
  { id: "red_team", model: "@cf/qwen/qwq-32b", name: "Red Team", title: "Red-Team-Prüfer", symbol: "X", prompt: "Du bist das Red Team. Versuche die Lösung zu widerlegen. Suche Randfälle, Risiken, Sicherheitsprobleme, Fehlannahmen und Gründe, warum der Plan scheitern könnte." },
  { id: "architect", model: "@cf/nvidia/nemotron-3-120b-a12b", name: "Architect", title: "System-Architekt", symbol: "◇", prompt: "Du bist der System-Architekt. Verbinde die Erkenntnisse zu einem klaren, effizienten Gesamtplan. Achte auf Reihenfolge, Abhängigkeiten und Wartbarkeit." },
  { id: "optimizer", model: "@cf/zai-org/glm-4.7-flash", name: "Optimizer", title: "Performance-Optimierer", symbol: "↗", prompt: "Du bist der Performance-Optimierer. Verbessere Klarheit, Effizienz, Wirkung und Umsetzbarkeit. Entferne unnötige Komplexität." }
];

const TRANSIENT_AI_ERROR = /(?:\\b429\\b|\\b500\\b|\\b502\\b|\\b503\\b|\\b504\\b|rate.?limit|overload|temporarily unavailable|internal server error|timed? ?out|timeout)/i;

async function invoke(env, model, messages, maxTokens = 900) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await env.AI.run(model, { messages, max_tokens: maxTokens, chat_template_kwargs: { enable_thinking: false } });
      return extractWorkersAIText(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 2 || !TRANSIENT_AI_ERROR.test(message)) throw error;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error("Workers AI request failed after retry.");
}
async function emit(onAgent, agent, name, title, status, output = "") {
  await onAgent({ agent, name, title, status, output: String(output).slice(0, 5000), model: ROLES.find(item => item.id === agent)?.model || null, createdAt: new Date().toISOString() });
}
function parseJson(text) {
  const first = text.indexOf("{"), last = text.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Prüf-Agent lieferte kein gültiges JSON.");
  return JSON.parse(text.slice(first, last + 1));
}

export async function runCrew(env, task, context = "", onAgent = async () => {}) {
  const shared = "Nutzeraufgabe:\n" + String(task).slice(0, 10000) +
    (context ? "\n\nKontext und bereitgestellte Belege:\n" + String(context).slice(0, 7000) : "") +
    "\n\nWICHTIG: Du hast in diesem Lauf keine externen Websites, Dateien oder Konten geöffnet. Behaupte keine externe Recherche oder ausgeführten Aktionen. Fehlende Belege müssen als offen markiert werden.";
  const started = new Date().toISOString();
  const reports = await Promise.all(ROLES.map(async role => {
    await emit(onAgent, role.id, role.name, role.title, "running");
    try {
      const output = await invoke(env, role.model, [
        { role: "system", content: role.prompt + " Antworte auf Deutsch, präzise, kritisch und mit belastbaren Begründungen." },
        { role: "user", content: shared }
      ], 800);
      if (!output.trim()) throw new Error("Leere Agentenantwort.");
      await emit(onAgent, role.id, role.name, role.title, "completed", output);
      return { agent: role.id, name: role.name, title: role.title, model: role.model, status: "completed", output, createdAt: started };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agentenfehler";
      await emit(onAgent, role.id, role.name, role.title, "failed", message);
      return { agent: role.id, name: role.name, title: role.title, status: "failed", output: message, createdAt: started };
    }
  }));
  const usable = reports.filter(item => item.status === "completed");
  if (usable.length < 3) throw new Error("Zu wenige Agenten konnten eine belastbare Antwort liefern (mindestens 3 erforderlich).");

  let draft = await invoke(env, META_MODEL, [
    { role: "system", content: "Du bist NEXUS, der leitende Meta-Orchestrator. Führe alle Agentenberichte zu einer präzisen, vollständigen Antwort zusammen. Beantworte die Nutzeraufgabe. Trenne Fakten, Annahmen und offene Punkte. Erfinde keine Quellen, Belege oder ausgeführten Aktionen. Nutze klare Überschriften und konkrete nächste Schritte." },
    { role: "user", content: shared + "\n\nAgentenberichte:\n" + usable.map(x => "## " + x.title + "\n" + x.output).join("\n\n") }
  ], 1800);
  if (!draft.trim()) throw new Error("NEXUS konnte die Agentenberichte nicht zusammenführen.");

  const improvementRounds = [];
  for (let round = 1; round <= MAX_IMPROVEMENT_ROUNDS; round++) {
    await emit(onAgent, "improvement_" + round, "Evolution Loop", "Verbesserungsrunde " + round, "running", draft);
    try {
      const review = await invoke(env, REVIEW_MODEL, [
        { role: "system", content: 'Du bist ein unabhängiger Qualitätsrichter. Prüfe den Entwurf auf Aufgabenabdeckung, Beleglage, Logik, Risiken und Umsetzbarkeit. Sei streng. Gib ausschließlich JSON zurück: {"score":0,"must_fix":["..."],"keep":["..."],"verdict":"improve|ready"}. 0-100. Wenn externe Belege fehlen, fordere eine klare Kennzeichnung statt Fakten zu erfinden.' },
        { role: "user", content: JSON.stringify({ task: String(task).slice(0, 5000), draft: draft.slice(0, 10000), reports: usable.map(x => ({ role: x.title, output: x.output.slice(0, 2200) })) }) }
      ], 650);
      const verdict = parseJson(review);
      const issues = Array.isArray(verdict.must_fix) ? verdict.must_fix.filter(x => typeof x === "string").slice(0, 8) : [];
      const score = Number(verdict.score);
      if (verdict.verdict === "ready" && Number.isFinite(score) && score >= 92 && !issues.length) {
        improvementRounds.push({ round, score, verdict: "ready", issues: [] });
        await emit(onAgent, "improvement_" + round, "Evolution Loop", "Verbesserungsrunde " + round, "completed", "Qualitätsurteil " + score + "/100: keine zwingenden Korrekturen.");
        break;
      }
      const revised = await invoke(env, REFINER_MODEL, [
        { role: "system", content: "Du bist der NEXUS Evolution-Refiner. Verbessere den Entwurf anhand der Kritik. Behebe alle konkreten Mängel, bewahre korrekte Inhalte, erfinde keine Fakten und mache Unsicherheit sichtbar. Gib nur die vollständige verbesserte Antwort aus." },
        { role: "user", content: JSON.stringify({ task: String(task).slice(0, 5000), draft, score, must_fix: issues, keep: verdict.keep || [] }) }
      ], 1800);
      if (revised.trim()) draft = revised.trim().slice(0, 14000);
      improvementRounds.push({ round, score: Number.isFinite(score) ? score : null, verdict: "revised", issues });
      await emit(onAgent, "improvement_" + round, "Evolution Loop", "Verbesserungsrunde " + round, "completed", "Entwurf überarbeitet · " + (Number.isFinite(score) ? score + "/100" : "Score nicht verfügbar") + " · " + issues.length + " Kritikpunkte.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prüfung fehlgeschlagen";
      improvementRounds.push({ round, score: null, verdict: "review_unavailable", issues: [message] });
      await emit(onAgent, "improvement_" + round, "Evolution Loop", "Verbesserungsrunde " + round, "failed", message);
      break;
    }
  }

  await emit(onAgent, "quality_gate", "Quality Gate", "Finale Qualitätsprüfung", "running");
  let finalAnswer = draft;
  let quality = { score: null, issues: [], passed: false, note: "Zusätzliche Qualitätsprüfung nicht verfügbar." };
  try {
    const gateRaw = await invoke(env, QUALITY_MODEL, [
      { role: "system", content: 'Du bist das finale Quality Gate von NEXUS. Prüfe Vollständigkeit, Widersprüche, unbelegte Behauptungen, Quellenwahrheit, Umsetzbarkeit und klare Sprache. Verbessere die Antwort direkt. Erfinde keine Fakten oder Aktionen. Antworte ausschließlich als JSON: {"score":0,"issues":["..."],"answer":"vollständige finale Antwort"}. answer darf nicht leer sein.' },
      { role: "user", content: JSON.stringify({ task: String(task).slice(0, 6000), draft: draft.slice(0, 12000), rounds: improvementRounds }) }
    ], 1800);
    const checked = parseJson(gateRaw);
    if (typeof checked.answer !== "string" || !checked.answer.trim()) throw new Error("Quality Gate lieferte keine finale Antwort.");
    const score = Number(checked.score);
    finalAnswer = checked.answer.trim().slice(0, 14000);
    const issues = Array.isArray(checked.issues) ? checked.issues.filter(x => typeof x === "string").slice(0, 5).map(x => x.slice(0, 240)) : [];
    const deterministic = inspectAnswer(finalAnswer, task);
    quality = {
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score - (deterministic.length ? 25 : 0)))) : null,
      issues: [...issues, ...deterministic].slice(0, 8),
      passed: Number.isFinite(score) && score >= 85 && deterministic.length === 0,
      note: Number.isFinite(score) && score >= 85 && deterministic.length === 0 ? "Agenten-Schwarm, Verbesserungsrunden und finale Qualitätsprüfung abgeschlossen." : "Quality Gate erkennt noch Prüfbedarf."
    };
    await emit(onAgent, "quality_gate", "Quality Gate", "Finale Qualitätsprüfung", "completed", JSON.stringify(quality));
  } catch (error) {
    quality.note += " " + (error instanceof Error ? error.message.slice(0, 160) : "Prüffehler");
    await emit(onAgent, "quality_gate", "Quality Gate", "Finale Qualitätsprüfung", "failed", quality.note);
  }
  const completedAgents = reports.filter(x => x.status === "completed").length;
  return {
    answer: finalAnswer,
    agents: [...reports, ...improvementRounds.map(item => ({ agent: "improvement_" + item.round, name: "Evolution Loop", title: "Verbesserungsrunde " + item.round, status: item.verdict === "review_unavailable" ? "failed" : "completed", output: JSON.stringify(item) })),
      { agent: "quality_gate", name: "Quality Gate", title: "Finale Qualitätsprüfung", status: quality.score === null ? "failed" : "completed", output: JSON.stringify(quality) }],
    evolution: { rounds: improvementRounds, maxRounds: MAX_IMPROVEMENT_ROUNDS, agentsConfigured: ROLES.length, agentsCompleted: completedAgents, models: ROLES.map(({ id, name, model }) => ({ id, name, model })) },
    verification: {
      passed: completedAgents >= 6 && quality.passed,
      note: completedAgents + "/" + ROLES.length + " Spezialagenten abgeschlossen. " + improvementRounds.length + " Verbesserungsrunde(n). " + quality.note,
      qualityScore: quality.score,
      issues: quality.issues
    }
  };
}
