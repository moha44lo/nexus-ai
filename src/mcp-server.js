import { createPlan, needsApproval } from "./agent-runtime.js";
const PROTOCOL_VERSION = "2025-03-26";
const TOOLS = [
  { name: "nexus.memory.list", description: "List explicitly saved NEXUS memory facts.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "nexus.memory.save", description: "Save a user-approved memory fact.", inputSchema: { type: "object", properties: { fact: { type: "string", minLength: 1, maxLength: 1000 }, category: { type: "string", maxLength: 40 } }, required: ["fact"], additionalProperties: false } },
  { name: "nexus.skills.list", description: "List reusable NEXUS browser skills.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "nexus.schedules.list", description: "List recurring NEXUS automations.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "nexus.schedules.create", description: "Create a recurring NEXUS task. Browser clicks and form submissions still pause for approval.", inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 100 }, task: { type: "string", minLength: 1, maxLength: 12000 }, intervalMinutes: { type: "integer", minimum: 5, maximum: 10080 } }, required: ["name", "task"], additionalProperties: false } },
  { name: "nexus.agent.plan", description: "Create and independently review a browser automation plan without executing it.", inputSchema: { type: "object", properties: { task: { type: "string", minLength: 1, maxLength: 12000 } }, required: ["task"], additionalProperties: false } },
  { name: "nexus.runs.list", description: "List recent agent execution runs.", inputSchema: { type: "object", properties: {}, additionalProperties: false } }
];

function rpc(id, result) { return { jsonrpc: "2.0", id, result }; }
function error(id, code, message) { return { jsonrpc: "2.0", id, error: { code, message } }; }
function resultText(value) { return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }; }

export async function handleMcpRequest(request, env) {
  const denied = () => Response.json({ error: "Unauthorized MCP client." }, { status: 401 });
  const expected = env.NEXUS_MCP_TOKEN;
  const authorization = request.headers.get("Authorization") || "";
  if (!expected || expected.length < 32 || authorization !== "Bearer " + expected) return denied();
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  if (!env.DB) return Response.json({ error: "D1 binding missing." }, { status: 503 });
  let message;
  try { message = await request.json(); } catch { return Response.json(error(null, -32700, "Parse error"), { status: 400 }); }
  const id = message?.id ?? null;
  if (message?.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return Response.json(error(id, -32600, "Invalid Request"), { status: 400 });
  }
  try {
    if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") return new Response(null, { status: 202 });
    if (message.method === "initialize") {
      return Response.json(rpc(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "nexus-ai", version: "1.0.0" },
        instructions: "NEXUS MCP server. Saved memory is user-approved context; scheduled browser clicks and form submissions require in-app approval."
      }));
    }
    if (message.method === "ping") return Response.json(rpc(id, {}));
    if (message.method === "tools/list") return Response.json(rpc(id, { tools: TOOLS }));
    if (message.method !== "tools/call") return Response.json(error(id, -32601, "Method not found"));
    const name = message.params?.name;
    const args = message.params?.arguments || {};
    let data;
    switch (name) {
      case "nexus.memory.list": {
        const rows = await env.DB.prepare("SELECT id, fact, category, created_at FROM memory_facts ORDER BY updated_at DESC LIMIT 100").all();
        data = rows.results || []; break;
      }
      case "nexus.memory.save": {
        const fact = String(args.fact || "").trim().slice(0, 1000);
        if (!fact) return Response.json(error(id, -32602, "fact is required"));
        const now = new Date().toISOString(), memoryId = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO memory_facts (id, fact, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
          .bind(memoryId, fact, String(args.category || "general").slice(0, 40), now, now).run();
        data = { id: memoryId, fact }; break;
      }
      case "nexus.skills.list": {
        const rows = await env.DB.prepare("SELECT id, name, description, version, enabled, run_count, updated_at FROM skills ORDER BY updated_at DESC LIMIT 100").all();
        data = rows.results || []; break;
      }
      case "nexus.schedules.list": {
        const rows = await env.DB.prepare("SELECT id, name, task, interval_minutes, enabled, next_run_at, last_run_at FROM schedules ORDER BY created_at DESC LIMIT 100").all();
        data = rows.results || []; break;
      }
      case "nexus.schedules.create": {
        const name = String(args.name || "").trim().slice(0, 100), task = String(args.task || "").trim().slice(0, 12000);
        const interval = Number(args.intervalMinutes || 60);
        if (!name || !task || !Number.isInteger(interval) || interval < 5 || interval > 10080) return Response.json(error(id, -32602, "Invalid name, task or interval"));
        const now = new Date(), iso = now.toISOString(), next = new Date(now.getTime() + interval * 60000).toISOString(), scheduleId = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO schedules (id, name, task, cron, timezone, interval_minutes, enabled, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'Europe/Zurich', ?, 1, ?, ?, ?)")
          .bind(scheduleId, name, task, "every " + interval + " minutes", interval, next, iso, iso).run();
        data = { id: scheduleId, name, intervalMinutes: interval, nextRunAt: next }; break;
      }
      case "nexus.agent.plan": {
        const task = String(args.task || "").trim().slice(0, 12000);
        if (!task) return Response.json(error(id, -32602, "task is required"));
        const memory = await env.DB.prepare("SELECT fact, category FROM memory_facts ORDER BY updated_at DESC LIMIT 40").all();
        const plan = await createPlan(env, task, memory.results || []);
        data = { plan, approvalRequired: needsApproval(plan), executed: false };
        break;
      }
      case "nexus.runs.list": {
        const rows = await env.DB.prepare("SELECT id, task, goal, status, summary, error, created_at, updated_at FROM agent_runs ORDER BY created_at DESC LIMIT 50").all();
        data = rows.results || []; break;
      }
      default: return Response.json(error(id, -32602, "Unknown tool: " + String(name)));
    }
    return Response.json(rpc(id, resultText(data)));
  } catch (caught) {
    return Response.json(error(id, -32603, caught instanceof Error ? caught.message.slice(0, 300) : "Internal error"), { status: 500 });
  }
}
