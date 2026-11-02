import { NEXUSWorkflow } from "./nexus-workflow.js";
import { createPlan, needsApproval, runBrowserPlan } from "./agent-runtime.js";
import { compileSkill } from "./skill-engine.js";
export { NEXUSWorkflow };

const MODEL = "@cf/zai-org/glm-4.7-flash";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const SYSTEM_PROMPT = `Du bist NEXUS AI, ein sorgfältiger, leistungsfähiger persönlicher KI-Assistent.
Antworte standardmäßig auf Deutsch, außer der Nutzer schreibt klar in einer anderen Sprache.
Sei direkt, hilfreich, strukturiert und ehrlich. Erfinde keine Quellen, Fakten oder ausgeführten Aktionen.
Wenn dir aktuelle Informationen fehlen, sage das offen. Unterscheide klar zwischen Wissen, Schlussfolgerung und Unsicherheit.
Führe keine externen Aktionen aus und behaupte das auch nicht, sofern kein entsprechendes Tool tatsächlich verfügbar ist.`;

const PAGE = String.raw`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#090d18">
<title>NEXUS AI</title>
<style>
:root{color-scheme:dark;--bg:#080c15;--panel:#101827;--panel2:#141f31;--line:#26344b;--muted:#8798b4;--text:#edf3ff;--accent:#9bb8ff;--accent2:#6d8ff0}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 50% -10%,#1a2b4a 0%,#080c15 58%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
button,input,textarea{font:inherit}
button{cursor:pointer}
.shell{width:min(1200px,100%);min-height:100vh;margin:auto;display:grid;grid-template-columns:260px minmax(0,1fr);border-inline:1px solid #1c2940;background:#0b111d}
.sidebar{padding:24px 17px;background:#0a101b;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:18px}
.brand{font-weight:850;font-size:22px;letter-spacing:3px}.brand span{color:var(--accent)}
.tag{font-size:10px;letter-spacing:2px;color:#657895}
.newchat,.sidechat,.mode,.send,.loginbtn,.logout{border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--text);background:var(--panel2)}
.newchat{text-align:left;background:#172640;border-color:#34496c}
#conversations{display:grid;gap:7px}
.sidechat{padding:10px 12px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;background:transparent;color:#b9c7dc}
.sidechat.active{background:#182943;border-color:#3b5277}
.sidebar-foot{margin-top:auto;color:#60728f;font-size:10px;letter-spacing:1.5px}
.main{min-width:0;min-height:100vh;display:flex;flex-direction:column}
.top{height:76px;padding:0 26px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}
.topname{font-weight:750;letter-spacing:2px}.status{font-size:12px;color:var(--muted);margin-top:5px}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#65d6a1;margin-right:7px}
.topright{display:flex;align-items:center;gap:12px}.avatar{height:36px;width:36px;border-radius:50%;display:grid;place-items:center;background:#243858;color:#c8d8ff;font-weight:800}
.logout{padding:8px 10px;font-size:12px}
.content{width:min(850px,100%);margin:0 auto;padding:26px 26px 18px;display:flex;flex:1;min-height:0;flex-direction:column}
.login{width:min(390px,calc(100% - 36px));margin:auto;text-align:center;padding:35px 0}
.login h1{font-size:27px;margin:0 0 10px}.sub{color:var(--muted);line-height:1.6;font-size:14px}
.field{width:100%;border:1px solid #30415c;background:#0a1220;color:var(--text);border-radius:13px;padding:15px;margin:10px 0;outline:none}
.field:focus{border-color:#7f9ff4;box-shadow:0 0 0 3px #789aff20}
.loginbtn,.send{background:linear-gradient(135deg,#a9c2ff,#6f91f1);border:0;color:#071020;font-weight:800}
#error{color:#ff9292;min-height:22px;font-size:13px}
#app{display:none;flex:1;min-height:0;flex-direction:column}
.welcome{text-align:center;padding:12px 10px 20px}
.mark{font-size:31px;color:var(--accent)}.welcome h1{font-size:25px;margin:8px 0}.welcome p{margin:0;color:var(--muted);font-size:13px}
.modes{display:flex;gap:8px;justify-content:center;margin-top:16px}
.mode{padding:8px 14px;font-size:12px;color:#b8c8e4}.mode.active{background:#243858;border-color:#7898e6;color:white}
#chat{flex:1;min-height:260px;max-height:calc(100vh - 310px);overflow:auto;padding:12px 3px 22px;scroll-behavior:smooth}
.msg{max-width:88%;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;padding:13px 16px;margin:11px 0;border-radius:16px;background:#172338;border:1px solid #283a56}
.msg.user{margin-left:auto;background:#203a60;border-color:#3a5b8a}
.msg.system{max-width:100%;background:#101a2a;color:#9eb0cd;font-size:12px}
.composer{display:flex;gap:9px;align-items:end;padding-top:12px;border-top:1px solid var(--line)}
#question{flex:1;min-height:52px;max-height:150px;resize:vertical;margin:0}
.send{min-width:105px;height:52px}
.disclaimer{text-align:center;color:#647591;font-size:10px;padding:12px 0 2px}
.hidden{display:none!important}
@media(max-width:700px){.shell{display:block;border:0}.sidebar{display:none}.top{height:64px;padding:0 16px}.content{padding:18px 14px 12px;min-height:calc(100vh - 64px)}#chat{max-height:none}.msg{max-width:94%}.welcome{padding-top:5px}.send{min-width:82px}.logout{font-size:11px}}
</style>
</head>
<body>
<div class="shell">
<aside class="sidebar">
  <div class="brand">NEXUS<span> AI</span></div>
  <button id="newChat" class="newchat">＋ Neuer Chat</button>
  <div class="tag">DEINE UNTERHALTUNGEN</div>
  <div id="conversations"></div>
  <div class="sidebar-foot">PRIVATE AI WORKSPACE</div>
</aside>
<main class="main">
<header class="top">
  <div><div class="topname">NEXUS AI</div><div class="status"><span class="dot"></span>Dein KI-Assistent</div></div>
  <div class="topright"><button id="logout" class="logout">Abmelden</button><div class="avatar">N</div></div>
</header>
<section id="login" class="login">
  <div class="mark">✳</div><h1>Willkommen zurück.</h1>
  <p class="sub">Dein persönlicher KI-Arbeitsbereich.<br>Gib deine private PIN ein, um fortzufahren.</p>
  <form id="loginForm"><input id="pin" class="field" type="password" autocomplete="current-password" placeholder="Deine PIN" required><button class="loginbtn" type="submit" style="width:100%;padding:15px;border-radius:13px">NEXUS öffnen →</button></form>
  <div id="error"></div>
</section>
<section id="app">
  <div class="welcome"><div class="mark">✳</div><h1>Was machen wir heute?</h1><p>Fragen, Ideen, Planung und komplexe Aufgaben.</p>
    <div class="modes"><button class="mode active" data-mode="chat">Chat</button><button class="mode" data-mode="agent">Agent-Modus</button></div>
  </div>
  <div id="chat"><div class="msg">Hallo! Ich bin NEXUS. Was möchtest du angehen?</div></div>
  <form id="composer" class="composer"><textarea id="question" class="field" rows="1" placeholder="Schreib NEXUS eine Nachricht …"></textarea><button id="send" class="send" type="submit">Senden ↑</button></form>
  <div class="disclaimer">NEXUS kann Fehler machen. Prüfe wichtige Informationen.</div>
</section>
</main>
</div>
<script>
let conversationId=null,mode="chat",busy=false;
const $=id=>document.getElementById(id);
const login=$("login"),app=$("app"),chat=$("chat");
function addMessage(text,who=""){const el=document.createElement("div");el.className="msg "+who;el.textContent=text;chat.appendChild(el);chat.scrollTop=chat.scrollHeight;return el;}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});let data={};try{data=await response.json()}catch{}if(!response.ok)throw new Error(data.error||"Anfrage fehlgeschlagen");return data;}
async function loadConversations(){const data=await api("/api/conversations");const host=$("conversations");host.innerHTML="";for(const item of data.conversations||[]){const b=document.createElement("button");b.className="sidechat"+(item.id===conversationId?" active":"");b.textContent=item.title||"Neuer Chat";b.onclick=()=>openConversation(item.id);host.appendChild(b);}}
async function openConversation(id){conversationId=id;chat.innerHTML="";const data=await api("/api/history?conversationId="+encodeURIComponent(id));for(const m of data.messages||[])addMessage(m.content,m.role==="user"?"user":"");await loadConversations();}
async function createConversation(){const data=await api("/api/conversations",{method:"POST",body:"{}"});conversationId=data.conversation.id;chat.innerHTML="";addMessage("Neuer Chat gestartet. Was kann ich für dich tun?");await loadConversations();}
async function enter(){login.classList.add("hidden");app.style.display="flex";await loadConversations();const list=await api("/api/conversations");if(list.conversations?.length)await openConversation(list.conversations[0].id);else await createConversation();}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("error").textContent="";try{await api("/api/login",{method:"POST",body:JSON.stringify({pin:$("pin").value})});$("pin").value="";await enter();}catch(err){$("error").textContent=err.message;}});
$("logout").onclick=async()=>{try{await api("/api/logout",{method:"POST",body:"{}"});}finally{location.reload();}};
$("newChat").onclick=()=>createConversation().catch(e=>addMessage(e.message,"system"));
document.querySelectorAll(".mode").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll(".mode").forEach(x=>x.classList.toggle("active",x===b));$("question").placeholder=mode==="agent"?"Beschreibe eine komplexe Aufgabe für NEXUS …":"Schreib NEXUS eine Nachricht …";});
$("composer").addEventListener("submit",async e=>{e.preventDefault();if(busy)return;const value=$("question").value.trim();if(!value)return;if(!conversationId)await createConversation();$("question").value="";addMessage(value,"user");busy=true;$("send").disabled=true;$("send").textContent="Denkt …";const pending=addMessage(mode==="agent"?"NEXUS plant und prüft deine Aufgabe …":"NEXUS denkt …","system");try{const data=await api(mode==="agent"?"/api/agent":"/api/chat",{method:"POST",body:JSON.stringify({message:value,conversationId})});pending.className="msg";pending.textContent=mode==="agent"?(("ARBEITSPLAN\n"+(data.plan||"")+"\n\nERGEBNIS\n"+(data.answer||"")+"\n\nQUALITÄTSCHECK\n"+(data.verification||""))):data.answer;if(data.requiresApproval&&data.runId){const approve=document.createElement("button");approve.className="send";approve.style.marginTop="12px";approve.textContent="Aktionen freigeben";approve.onclick=async()=>{approve.disabled=true;approve.textContent="NEXUS führt aus …";try{const result=await api("/api/agent/approve",{method:"POST",body:JSON.stringify({runId:data.runId,approved:true})});pending.textContent=result.answer;}catch(err){pending.textContent="Fehler: "+err.message;}};const reject=document.createElement("button");reject.className="mode";reject.style.margin="12px 0 0 8px";reject.textContent="Ablehnen";reject.onclick=async()=>{reject.disabled=true;try{const result=await api("/api/agent/approve",{method:"POST",body:JSON.stringify({runId:data.runId,approved:false})});pending.textContent=result.answer;}catch(err){pending.textContent="Fehler: "+err.message;}};pending.appendChild(document.createElement("br"));pending.appendChild(approve);pending.appendChild(reject);}await loadConversations();}catch(err){pending.textContent="Fehler: "+err.message;}finally{busy=false;$("send").disabled=false;$("send").textContent="Senden ↑";}});
$("question").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit();}});
</script>
</body>
</html>`;

function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...extra } });
}
function cookieValue(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function createSession(env) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `nexus:${expires}`;
  return `${expires}.${await hmac(env.NEXUS_SESSION_SECRET, payload)}`;
}
async function validSession(request, env) {
  if (!env.NEXUS_SESSION_SECRET) return false;
  const token = cookieValue(request, "nexus_session");
  if (!token) return false;
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = await hmac(env.NEXUS_SESSION_SECRET, `nexus:${expires}`);
  return signature === expected;
}
function cookieHeader(value, secure = true) {
  return `nexus_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
}
function clearCookie() {
  return "nexus_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}
function requireDatabase(env) {
  if (!env.DB) throw new Error("D1-Datenbank fehlt. Richte die DB-Bindung wie in README.md beschrieben ein.");
}
async function getConversation(env, id) {
  return env.DB.prepare("SELECT id, title FROM conversations WHERE id = ?").bind(id).first();
}
async function saveMessage(env, conversationId, role, content) {
  await env.DB.prepare("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), conversationId, role, content, new Date().toISOString()).run();
  await env.DB.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), conversationId).run();
}
async function getContext(env, conversationId) {
  const result = await env.DB.prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20")
    .bind(conversationId).all();
  return (result.results || []).reverse().map(row => ({ role: row.role, content: row.content }));
}
async function askAI(env, messages, maxTokens = 1600) {
  const result = await env.AI.run(MODEL, { messages, max_tokens: maxTokens });
  const answer = result?.response;
  if (typeof answer !== "string" || !answer.trim()) throw new Error("Das KI-Modell hat keine Antwort geliefert.");
  return answer.trim();
}
async function processDueSchedules(env) {
  requireDatabase(env);
  const now = new Date();
  const due = await env.DB.prepare("SELECT * FROM schedules WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at ASC LIMIT 10").bind(now.toISOString()).all();
  for (const schedule of due.results || []) {
    const next = new Date(now.getTime() + Math.max(5, Number(schedule.interval_minutes) || 60) * 60000).toISOString();
    await env.DB.prepare("UPDATE schedules SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?").bind(now.toISOString(), next, now.toISOString(), schedule.id).run();
    const runId = crypto.randomUUID();
    try {
      const memoryResult = await env.DB.prepare("SELECT fact, category FROM memory_facts ORDER BY updated_at DESC LIMIT 40").all();
      const plan = await createPlan(env, schedule.task, memoryResult.results || []);
      const approvalRequired = needsApproval(plan);
      await env.DB.prepare("INSERT INTO agent_runs (id, conversation_id, task, goal, plan_json, status, summary, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)")
        .bind(runId, schedule.task, plan.goal, JSON.stringify(plan), approvalRequired ? "awaiting_approval" : "running", approvalRequired ? "Zeitplan wartet auf Freigabe." : plan.summary, now.toISOString(), now.toISOString()).run();
      if (approvalRequired || plan.steps.length === 0) {
        if (!approvalRequired) await env.DB.prepare("UPDATE agent_runs SET status = 'completed', summary = ?, result_json = ?, updated_at = ? WHERE id = ?").bind("Keine Browser-Aktionen erforderlich.", JSON.stringify({ plan }), new Date().toISOString(), runId).run();
        continue;
      }
      const result = await runBrowserPlan(env, plan, async event => {
        await env.DB.prepare("INSERT INTO agent_run_steps (id, run_id, step_id, tool, status, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), runId, event.stepId || null, event.tool || null, event.status, JSON.stringify(event), new Date().toISOString()).run();
      });
      const status = result.status === "completed" ? "completed" : "failed";
      await env.DB.prepare("UPDATE agent_runs SET status = ?, result_json = ?, summary = ?, error = ?, updated_at = ? WHERE id = ?")
        .bind(status, JSON.stringify(result), status === "completed" ? "Zeitplan-Aufgabe abgeschlossen." : "Zeitplan-Aufgabe fehlgeschlagen.", result.error || null, new Date().toISOString(), runId).run();
    } catch (error) {
      await env.DB.prepare("INSERT INTO agent_runs (id, conversation_id, task, goal, plan_json, status, summary, error, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, 'failed', ?, ?, ?, ?)")
        .bind(runId, schedule.task, schedule.name, "{}", "Zeitplan-Ausführung fehlgeschlagen.", safeError(error), now.toISOString(), new Date().toISOString()).run();
    }
  }
}

function safeError(error) {
  return error instanceof Error ? error.message.slice(0, 300) : "Unbekannter Fehler";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
      try {
        const body = await request.json();
        if (!env.NEXUS_PIN || String(body.pin || "") !== env.NEXUS_PIN) return json({ error: "PIN falsch." }, 401);
        if (!env.NEXUS_SESSION_SECRET || env.NEXUS_SESSION_SECRET.length < 32) {
          return json({ error: "NEXUS_SESSION_SECRET fehlt oder ist zu kurz. Bitte ein Secret mit mindestens 32 Zeichen hinterlegen." }, 503);
        }
        const token = await createSession(env);
        return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(token) });
      } catch (error) { return json({ error: safeError(error) }, 400); }
    }

    if (request.method === "POST" && url.pathname === "/api/logout") {
      return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
    }

    if (!(await validSession(request, env))) return json({ error: "Nicht angemeldet. Bitte erneut anmelden." }, 401);

    try {
      requireDatabase(env);

      if (request.method === "GET" && url.pathname === "/api/memory") {
        const result = await env.DB.prepare("SELECT id, fact, category, created_at FROM memory_facts ORDER BY updated_at DESC LIMIT 100").all();
        return json({ facts: result.results || [] });
      }
      if (request.method === "POST" && url.pathname === "/api/memory") {
        const body = await request.json();
        const fact = String(body.fact || "").trim().slice(0, 1000);
        const category = String(body.category || "general").trim().slice(0, 40) || "general";
        if (!fact) return json({ error: "Memory-Fakt fehlt." }, 400);
        const id = crypto.randomUUID(), now = new Date().toISOString();
        await env.DB.prepare("INSERT INTO memory_facts (id, fact, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
          .bind(id, fact, category, now, now).run();
        return json({ ok: true, id, fact, category });
      }
      if (request.method === "DELETE" && url.pathname.startsWith("/api/memory/")) {
        await env.DB.prepare("DELETE FROM memory_facts WHERE id = ?").bind(url.pathname.split("/").pop()).run();
        return json({ ok: true });
      }
      if (request.method === "GET" && url.pathname === "/api/skills") {
        const result = await env.DB.prepare("SELECT id, name, description, version, enabled, run_count, created_at, updated_at FROM skills ORDER BY updated_at DESC LIMIT 100").all();
        return json({ skills: result.results || [] });
      }
      if (request.method === "POST" && url.pathname === "/api/skills") {
        const body = await request.json();
        const skill = compileSkill(body.definition || body);
        const now = new Date().toISOString();
        await env.DB.prepare("INSERT INTO skills (id, name, description, version, definition_json, enabled, run_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)")
          .bind(skill.id, skill.name, skill.description, skill.version, JSON.stringify(skill), now, now).run();
        return json({ ok: true, skill });
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/skills/") && url.pathname.endsWith("/run")) {
        const skillId = url.pathname.split("/")[3];
        const row = await env.DB.prepare("SELECT * FROM skills WHERE id = ? AND enabled = 1").bind(skillId).first();
        if (!row) return json({ error: "Skill nicht gefunden oder deaktiviert." }, 404);
        const skill = compileSkill(JSON.parse(row.definition_json));
        const plan = { goal: skill.name, summary: skill.description, steps: skill.steps };
        const runId = crypto.randomUUID(), now = new Date().toISOString(), approvalRequired = needsApproval(plan);
        await env.DB.prepare("INSERT INTO agent_runs (id, conversation_id, task, goal, plan_json, status, summary, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)")
          .bind(runId, "Skill: " + skill.name, skill.name, JSON.stringify(plan), approvalRequired ? "awaiting_approval" : "running", skill.description, now, now).run();
        await env.DB.prepare("UPDATE skills SET run_count = run_count + 1, updated_at = ? WHERE id = ?").bind(now, skillId).run();
        if (approvalRequired) return json({ status: "awaiting_approval", runId, plan });
        const result = await runBrowserPlan(env, plan, async event => {
          await env.DB.prepare("INSERT INTO agent_run_steps (id, run_id, step_id, tool, status, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(crypto.randomUUID(), runId, event.stepId || null, event.tool || null, event.status, JSON.stringify(event), new Date().toISOString()).run();
        });
        const status = result.status === "completed" ? "completed" : "failed";
        await env.DB.prepare("UPDATE agent_runs SET status = ?, result_json = ?, summary = ?, error = ?, updated_at = ? WHERE id = ?")
          .bind(status, JSON.stringify(result), status === "completed" ? "Skill ausgeführt." : "Skill fehlgeschlagen.", result.error || null, new Date().toISOString(), runId).run();
        return json({ status, runId, result });
      }

      if (request.method === "GET" && url.pathname === "/api/schedules") {
        const result = await env.DB.prepare("SELECT id, name, task, cron, timezone, interval_minutes, enabled, next_run_at, last_run_at FROM schedules ORDER BY created_at DESC LIMIT 100").all();
        return json({ schedules: result.results || [] });
      }
      if (request.method === "POST" && url.pathname === "/api/schedules") {
        const body = await request.json();
        const name = String(body.name || "").trim().slice(0, 100), task = String(body.task || "").trim().slice(0, 12000);
        const intervalMinutes = Number(body.intervalMinutes || 60);
        if (!name || !task) return json({ error: "Name und Aufgabe sind erforderlich." }, 400);
        if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 10080) return json({ error: "Intervall muss zwischen 5 Minuten und 7 Tagen liegen." }, 400);
        const id = crypto.randomUUID(), now = new Date(), next = new Date(now.getTime() + intervalMinutes * 60000).toISOString();
        await env.DB.prepare("INSERT INTO schedules (id, name, task, cron, timezone, interval_minutes, enabled, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)")
          .bind(id, name, task, "every " + intervalMinutes + " minutes", String(body.timezone || "Europe/Zurich").slice(0, 64), intervalMinutes, next, now.toISOString(), now.toISOString()).run();
        return json({ ok: true, schedule: { id, name, task, intervalMinutes, nextRunAt: next } });
      }
      if (request.method === "PATCH" && url.pathname.startsWith("/api/schedules/")) {
        const id = url.pathname.split("/").pop(), body = await request.json();
        await env.DB.prepare("UPDATE schedules SET enabled = ?, updated_at = ? WHERE id = ?").bind(body.enabled === true ? 1 : 0, new Date().toISOString(), id).run();
        return json({ ok: true });
      }
      if (request.method === "DELETE" && url.pathname.startsWith("/api/schedules/")) {
        await env.DB.prepare("DELETE FROM schedules WHERE id = ?").bind(url.pathname.split("/").pop()).run();
        return json({ ok: true });
      }

      if (request.method === "GET" && url.pathname === "/api/agent/runs") {
        const result = await env.DB.prepare("SELECT id, task, goal, status, summary, error, created_at, updated_at FROM agent_runs ORDER BY created_at DESC LIMIT 50").all();
        return json({ runs: result.results || [] });
      }
      if (request.method === "POST" && url.pathname === "/api/agent/approve") {
        const body = await request.json();
        const runId = String(body.runId || "");
        const run = await env.DB.prepare("SELECT * FROM agent_runs WHERE id = ?").bind(runId).first();
        if (!run) return json({ error: "Agent-Lauf nicht gefunden." }, 404);
        if (run.status !== "awaiting_approval") return json({ error: "Dieser Lauf wartet nicht auf Freigabe." }, 409);
        const now = new Date().toISOString();
        if (body.approved !== true) {
          await env.DB.prepare("UPDATE agent_runs SET status = 'rejected', summary = ?, updated_at = ? WHERE id = ?").bind("Vom Nutzer abgelehnt.", now, runId).run();
          const answer = "Abgelehnt. Es wurden keine Browser-Aktionen ausgeführt.";
          if (run.conversation_id) await saveMessage(env, run.conversation_id, "assistant", answer);
          return json({ status: "rejected", answer });
        }
        const plan = JSON.parse(run.plan_json);
        await env.DB.prepare("UPDATE agent_runs SET status = 'running', updated_at = ? WHERE id = ?").bind(now, runId).run();
        const result = await runBrowserPlan(env, plan, async event => {
          await env.DB.prepare("INSERT INTO agent_run_steps (id, run_id, step_id, tool, status, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(crypto.randomUUID(), runId, event.stepId || null, event.tool || null, event.status, JSON.stringify(event), new Date().toISOString()).run();
        });
        const status = result.status === "completed" ? "completed" : "failed";
        await env.DB.prepare("UPDATE agent_runs SET status = ?, result_json = ?, summary = ?, error = ?, updated_at = ? WHERE id = ?")
          .bind(status, JSON.stringify(result), status === "completed" ? "Browser-Aufgabe abgeschlossen." : "Browser-Aufgabe fehlgeschlagen.", result.error || null, new Date().toISOString(), runId).run();
        const answer = status === "completed" ? "Browser-Aufgabe abgeschlossen. Ergebnis:\\n" + JSON.stringify(result, null, 2).slice(0, 9000) : "Browser-Aufgabe fehlgeschlagen: " + (result.error || "Unbekannter Fehler");
        if (run.conversation_id) await saveMessage(env, run.conversation_id, "assistant", answer);
        return json({ status, answer, result });
      }

      if (request.method === "GET" && url.pathname === "/api/conversations") {
        const result = await env.DB.prepare("SELECT id, title, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 50").all();
        return json({ conversations: result.results || [] });
      }

      if (request.method === "POST" && url.pathname === "/api/conversations") {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare("INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
          .bind(id, "Neuer Chat", now, now).run();
        return json({ conversation: { id, title: "Neuer Chat" } });
      }

      if (request.method === "GET" && url.pathname === "/api/history") {
        const id = url.searchParams.get("conversationId");
        if (!id) return json({ error: "conversationId fehlt." }, 400);
        const conversation = await getConversation(env, id);
        if (!conversation) return json({ error: "Unterhaltung nicht gefunden." }, 404);
        const result = await env.DB.prepare("SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100")
          .bind(id).all();
        return json({ messages: result.results || [] });
      }

      if (request.method === "POST" && (url.pathname === "/api/chat" || url.pathname === "/api/agent")) {
        const body = await request.json();
        const message = String(body.message || "").trim().slice(0, 12000);
        const conversationId = String(body.conversationId || "");
        if (!message) return json({ error: "Bitte gib eine Nachricht ein." }, 400);
        const conversation = await getConversation(env, conversationId);
        if (!conversation) return json({ error: "Unterhaltung nicht gefunden. Starte bitte einen neuen Chat." }, 404);

        const history = await getContext(env, conversationId);
        await saveMessage(env, conversationId, "user", message);
        const context = [...history, { role: "user", content: message }].slice(-20);

        if (url.pathname === "/api/agent") {
          const memoryResult = await env.DB.prepare("SELECT fact, category FROM memory_facts ORDER BY updated_at DESC LIMIT 40").all();
          const plan = await createPlan(env, message, memoryResult.results || []);
          const runId = crypto.randomUUID(), now = new Date().toISOString();
          const approvalRequired = needsApproval(plan);
          await env.DB.prepare("INSERT INTO agent_runs (id, conversation_id, task, goal, plan_json, status, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(runId, conversationId, message, plan.goal, JSON.stringify(plan), approvalRequired ? "awaiting_approval" : "running", plan.summary, now, now).run();
          if (approvalRequired) {
            const planText = plan.steps.map((step, i) => (i + 1) + ". " + step.tool + " — " + (step.reason || step.id)).join("\\n");
            return json({ mode: "agent", runId, requiresApproval: true, plan: plan.summary + (planText ? "\\n" + planText : ""), answer: "NEXUS wartet auf deine Freigabe. Noch wurde nichts ausgeführt.", verification: "Vor Ausführung angehalten." });
          }
          if (plan.steps.length === 0) {
            const answer = await askAI(env, [{ role: "system", content: SYSTEM_PROMPT + "\\nBeantworte die Aufgabe direkt. Du hast keine Browser-Tools ausgeführt." }, ...context], 1800);
            await env.DB.prepare("UPDATE agent_runs SET status = 'completed', result_json = ?, summary = ?, updated_at = ? WHERE id = ?")
              .bind(JSON.stringify({ answer }), "Textantwort; keine Browser-Aktion erforderlich.", new Date().toISOString(), runId).run();
            await saveMessage(env, conversationId, "assistant", answer);
            return json({ mode: "agent", runId, plan: plan.summary || "Keine Browser-Schritte erforderlich.", answer, verification: "Keine externen Aktionen ausgeführt." });
          }
          const result = await runBrowserPlan(env, plan, async event => {
            await env.DB.prepare("INSERT INTO agent_run_steps (id, run_id, step_id, tool, status, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
              .bind(crypto.randomUUID(), runId, event.stepId || null, event.tool || null, event.status, JSON.stringify(event), new Date().toISOString()).run();
          });
          const status = result.status === "completed" ? "completed" : "failed";
          await env.DB.prepare("UPDATE agent_runs SET status = ?, result_json = ?, summary = ?, error = ?, updated_at = ? WHERE id = ?")
            .bind(status, JSON.stringify(result), status === "completed" ? "Browser-Aufgabe abgeschlossen." : "Browser-Aufgabe fehlgeschlagen.", result.error || null, new Date().toISOString(), runId).run();
          const answer = status === "completed" ? JSON.stringify(result, null, 2).slice(0, 9000) : "Browser-Aufgabe fehlgeschlagen: " + (result.error || "Unbekannter Fehler");
          await saveMessage(env, conversationId, "assistant", answer);
          return json({ mode: "agent", runId, plan: plan.summary, answer, verification: status === "completed" ? "Browser-Schritte abgeschlossen; Ergebnisse bitte prüfen." : "Ausführung fehlgeschlagen.", result });
        }

        const memoryResult = await env.DB.prepare("SELECT fact FROM memory_facts ORDER BY updated_at DESC LIMIT 40").all();
        const memoryPrompt = (memoryResult.results || []).map(row => "- " + row.fact).join("\\n");
        const answer = await askAI(env, [{ role: "system", content: SYSTEM_PROMPT + (memoryPrompt ? "\\n\\nVom Nutzer ausdrücklich gespeicherte Fakten:\\n" + memoryPrompt : "") }, ...context], 1800);
        await saveMessage(env, conversationId, "assistant", answer);
        await env.DB.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND title = ?")
          .bind(message.slice(0, 54), new Date().toISOString(), conversationId, "Neuer Chat").run();
        return json({ mode: "chat", answer });
      }

      return new Response("Nicht gefunden", { status: 404 });
    } catch (error) {
      return json({ error: safeError(error) }, 500);
    }
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(processDueSchedules(env));
  }
};