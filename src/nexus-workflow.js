import { WorkflowEntrypoint } from "cloudflare:workers";
import { runCrew } from "./orchestrator.js";

export class NEXUSWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const task = String(event.payload?.task || "").trim();
    const context = String(event.payload?.context || "").slice(0, 12000);
    const runId = String(event.payload?.runId || "");
    if (!task) throw new Error("Kein Auftrag angegeben.");

    const result = await step.do("NEXUS Multi-Agent Orchestrierung", async () => {
      const now = new Date().toISOString();
      if (this.env.DB && runId) {
        await this.env.DB.prepare("UPDATE agent_runs SET status = 'running', summary = ?, updated_at = ? WHERE id = ?")
          .bind("Hintergrund-Workflow wird ausgeführt.", now, runId).run();
      }
      try {
        const crew = await runCrew(this.env, task, context, async agentEvent => {
          if (!this.env.DB || !runId) return;
          await this.env.DB.prepare("INSERT INTO agent_run_steps (id, run_id, step_id, tool, status, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(crypto.randomUUID(), runId, agentEvent.agent || null, "agent:" + String(agentEvent.agent || "unknown"), agentEvent.status || "unknown", JSON.stringify(agentEvent), new Date().toISOString()).run();
        });
        const executionStatus = crew.verification?.passed === true ? "completed" : "needs_review";
        if (this.env.DB && runId) {
          await this.env.DB.prepare("UPDATE agent_runs SET status = ?, summary = ?, result_json = ?, error = NULL, updated_at = ? WHERE id = ?")
            .bind(executionStatus, executionStatus === "completed" ? "Hintergrund-Workflow abgeschlossen und Qualitätsprüfung bestanden." : "Workflow ausgeführt; Ergebnis benötigt eine zusätzliche Prüfung.", JSON.stringify(crew), new Date().toISOString(), runId).run();
        }
        return { ...crew, executionStatus };
      } catch (error) {
        if (this.env.DB && runId) {
          await this.env.DB.prepare("UPDATE agent_runs SET status = 'failed', summary = ?, error = ?, updated_at = ? WHERE id = ?")
            .bind("Hintergrund-Workflow fehlgeschlagen.", error instanceof Error ? error.message.slice(0, 300) : "Unbekannter Fehler", new Date().toISOString(), runId).run();
        }
        throw error;
      }
    });

    return {
      status: "completed",
      executionStatus: result.executionStatus,
      task,
      answer: result.answer,
      agents: result.agents,
      evolution: result.evolution,
      verification: result.verification,
      completedAt: new Date().toISOString()
    };
  }
}
