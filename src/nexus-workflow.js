import { WorkflowEntrypoint } from "cloudflare:workers";
import { runCrew } from "./orchestrator.js";

export class NEXUSWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const task = String(event.payload?.task || "").trim();
    const context = String(event.payload?.context || "").slice(0, 8000);
    if (!task) throw new Error("Kein Auftrag angegeben.");
    const result = await step.do("NEXUS Multi-Agent Orchestrierung", async () => {
      return runCrew(this.env, task, context);
    });
    return {
      status: "completed",
      task,
      answer: result.answer,
      agents: result.agents,
      verification: result.verification,
      completedAt: new Date().toISOString()
    };
  }
}
