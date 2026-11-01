import { WorkflowEntrypoint } from "cloudflare:workers";

export class NEXUSWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const task = String(event.payload?.task || "").trim();

    if (!task) {
      throw new Error("Kein Auftrag angegeben.");
    }

    const plan = await step.do("Auftrag analysieren", async () => {
      const result = await this.env.AI.run("@cf/zai-org/glm-4.7-flash", {
        messages: [
          {
            role: "system",
            content: "Du bist NEXUS BRAIN. Analysiere den Auftrag und erstelle einen klaren Arbeitsplan auf Deutsch."
          },
          {
            role: "user",
            content: task
          }
        ],
        max_tokens: 700
      });

      return result.response || "Kein Arbeitsplan erstellt.";
    });

    const result = await step.do("Auftrag bearbeiten", async () => {
      const answer = await this.env.AI.run("@cf/zai-org/glm-4.7-flash", {
        messages: [
          {
            role: "system",
            content: "Du bist NEXUS. Arbeite den Auftrag sorgfältig ab. Behaupte niemals, externe Aktionen ausgeführt zu haben, wenn das nicht geschehen ist."
          },
          {
            role: "user",
            content: "Auftrag:\n" + task + "\n\nArbeitsplan:\n" + plan
          }
        ],
        max_tokens: 1500
      });

      return answer.response || "Kein Ergebnis erstellt.";
    });

    return {
      status: "completed",
      task,
      plan,
      result,
      completedAt: new Date().toISOString()
    };
  }
}
