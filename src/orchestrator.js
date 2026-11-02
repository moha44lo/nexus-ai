import { extractWorkersAIText } from "./model-output.js";

const MODEL = "@cf/zai-org/glm-4.7-flash";
const ROLES = [
  { id: "strategist", name: "Strategist", title: "Strategie-Agent", prompt: "Du bist der Strategist im NEXUS-Agententeam. Zerlege das Ziel in klare Teilprobleme, definiere Erfolgskriterien und nenne Abhängigkeiten. Liefere eine prägnante strukturierte Analyse." },
  { id: "specialist", name: "Specialist", title: "Fach-Agent", prompt: "Du bist der spezialisierte Problemlöser im NEXUS-Agententeam. Entwickle eine konkrete, umsetzbare Lösung mit Beispielen, Prioritäten und klaren nächsten Schritten. Erfinde keine ausgeführten Aktionen." },
  { id: "critic", name: "Critic", title: "Kritik-Agent", prompt: "Du bist der unabhängige Kritik- und Risiko-Agent. Suche Lücken, falsche Annahmen, technische Risiken und bessere Alternativen. Sei konkret und konstruktiv." }
];

async function invoke(env, messages, maxTokens = 900) {
  const result = await env.AI.run(MODEL, {
    messages,
    max_tokens: maxTokens,
    chat_template_kwargs: { enable_thinking: false }
  });
  return extractWorkersAIText(result);
}

export async function runCrew(env, task, context = "", onAgent = async () => {}) {
  const shared = "Nutzeraufgabe:\n" + String(task).slice(0, 10000) +
    (context ? "\n\nRelevanter Kontext:\n" + String(context).slice(0, 5000) : "") +
    "\n\nGrenze: Du hast in diesem Lauf keine externen Websites, Dateien oder Konten geöffnet. Behaupte keine externe Recherche oder ausgeführten Aktionen.";
  const started = new Date().toISOString();
  const results = await Promise.all(ROLES.map(async role => {
    await onAgent({ agent: role.id, name: role.name, title: role.title, status: "running", createdAt: started });
    try {
      const output = await invoke(env, [
        { role: "system", content: role.prompt + " Antworte auf Deutsch, präzise und mit belastbaren Begründungen." },
        { role: "user", content: shared }
      ], 850);
      if (typeof output !== "string" || !output.trim()) throw new Error("Agent lieferte eine leere Antwort.");
      const item = { agent: role.id, name: role.name, title: role.title, status: "completed", output, createdAt: started };
      await onAgent(item);
      return item;
    } catch (error) {
      const item = { agent: role.id, name: role.name, title: role.title, status: "failed", output: error instanceof Error ? error.message : "Agentenfehler", createdAt: started };
      await onAgent(item);
      return item;
    }
  }));
  const usable = results.filter(item => item.status === "completed");
  if (!usable.length) throw new Error("Keiner der NEXUS-Spezialagenten konnte eine Antwort liefern.");
  const synthesis = await invoke(env, [
    { role: "system", content: "Du bist NEXUS, der leitende Orchestrator. Führe die Ergebnisse des Strategists, Fach-Agenten und Kritik-Agenten zu einer einzigen exzellenten Antwort zusammen. Beantworte die eigentliche Nutzerfrage zuerst. Sei konkret, klar und ehrlich. Trenne Fakten, Annahmen und offene Punkte. Behaupte niemals, externe Aktionen seien ausgeführt worden, wenn das nicht in den Ergebnissen steht. Antworte auf Deutsch." },
    { role: "user", content: shared + "\n\nAgentenberichte:\n" + usable.map(x => "## " + x.title + "\n" + x.output).join("\n\n") }
  ], 1800);
  if (typeof synthesis !== "string" || !synthesis.trim()) throw new Error("NEXUS konnte die Agentenberichte nicht zuverlässig zusammenführen.");
  return {
    answer: synthesis,
    agents: results.map(({ agent, name, title, status, output }) => ({ agent, name, title, status, output })),
    verification: {
      passed: usable.length >= 2,
      note: usable.length === 3 ? "Drei spezialisierte Agenten haben unabhängig gearbeitet; ihre Ergebnisse wurden zusammengeführt." : "Teilweise Agentenverfügbarkeit: Antwort aus den verfügbaren Agenten erstellt."
    }
  };
}
