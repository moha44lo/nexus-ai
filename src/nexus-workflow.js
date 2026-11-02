import { WorkflowEntrypoint } from "cloudflare:workers";

const MODEL = "@cf/zai-org/glm-4.7-flash";

export class NEXUSWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const task = String(event.payload?.task || "").trim();
    if (!task) throw new Error("Kein Auftrag angegeben.");

    const plan = await step.do("Auftrag analysieren", async () => {
      const result = await this.env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "Du bist NEXUS PLANER. Erstelle einen realistischen, nummerierten Arbeitsplan auf Deutsch. Behaupte keine externen Aktionen." },
          { role: "user", content: task }
        ],
        max_tokens: 900
      });
      return result.response || "Kein Arbeitsplan erstellt.";
    });

    const answer = await step.do("Auftrag bearbeiten", async () => {
      const result = await this.env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "Du bist NEXUS AI. Arbeite den Auftrag anhand des Plans sorgfältig aus. Sei transparent über Grenzen und behaupte niemals externe Aktionen, die nicht ausgeführt wurden." },
          { role: "user", content: `Auftrag:\n${task}\n\nArbeitsplan:\n${plan}` }
        ],
        max_tokens: 2200
      });
      return result.response || "Kein Ergebnis erstellt.";
    });

    const verification = await step.do("Ergebnis prüfen", async () => {
      const result = await this.env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "Prüfe das Ergebnis auf Widersprüche, unbelegte Behauptungen und ausgelassene Anforderungen. Nenne kurz konkrete Grenzen." },
          { role: "user", content: `Auftrag:\n${task}\n\nPlan:\n${plan}\n\nErgebnis:\n${answer}` }
        ],
        max_tokens: 700
      });
      return result.response || "Kein Qualitätscheck verfügbar.";
    });

    return { status: "completed", task, plan, answer, verification, completedAt: new Date().toISOString() };
  }
}
