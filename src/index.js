
const MODEL = "@cf/zai-org/glm-4.7-flash";

const PAGE = `<!DOCTYPE html>
<html lang="de">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta charset="UTF-8">
<title>NEXUS AI</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#090d18;color:#f3f5ff;font-family:Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:18px}
main{width:100%;max-width:650px;background:#111827;border:1px solid #26334b;border-radius:20px;padding:22px}
h1{letter-spacing:4px;margin:0;color:#9dbbff}p{color:#9ba9c2}
#chat{height:55vh;overflow:auto;padding:12px 0}
.msg{padding:12px 15px;border-radius:14px;margin:10px 0;white-space:pre-wrap;line-height:1.5;background:#202c40}
.user{background:#263d62}
input,button{font-size:16px;border-radius:10px;padding:13px;border:1px solid #34435c}
input{background:#0b1220;color:white;width:100%;margin:8px 0}
button{background:#769cff;color:#071020;font-weight:bold;cursor:pointer}
#send{width:100%}
#login{max-width:350px;margin:auto}
#app{display:none}


.layout{
 display:grid;
 grid-template-columns:230px minmax(0,1fr);
 max-width:1200px;
 width:100%;
 min-height:720px;
 padding:0;
 overflow:hidden;
}
.sidebar{
 background:#0b1220;
 border-right:1px solid #293750;
 padding:25px 17px;
 display:flex;
 flex-direction:column;
 gap:20px;
}
.brand{font-size:23px;font-weight:800;letter-spacing:3px;color:#fff}
.brand span{color:#8eafff}
.new-chat{background:#182943;color:#dce7ff;border:1px solid #344b70;text-align:left}
.side-label{font-size:10px;letter-spacing:2px;color:#70819e;margin-top:15px}
.history-item{font-size:13px;color:#bdc9df;background:#17243a;padding:12px;border-radius:10px}
.side-bottom{margin-top:auto;font-size:10px;letter-spacing:2px;color:#60718f}
.workspace{min-width:0;padding:25px 30px;display:flex;flex-direction:column}
.topbar{display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:1px solid #293750}
.top-title{font-weight:700;letter-spacing:2px}
.online{font-size:12px;color:#8fa2c1;margin-top:7px}
.online span{display:inline-block;width:7px;height:7px;border-radius:50%;background:#65d6a1;margin-right:7px}
.avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#263d62;color:#b9ceff;font-weight:bold}
.welcome{text-align:center;padding:35px 10px 15px}
.welcome-icon{font-size:35px;color:#9bbaff}
.welcome h2,#login h2{font-size:25px;margin:10px 0}
.welcome p{font-size:13px}
#login{width:100%;max-width:390px;margin:auto;padding:35px 10px}
#app{flex:1;min-height:0}
#chat{height:48vh;min-height:250px}
.composer{display:flex;gap:10px;align-items:center;margin-top:12px}
.composer input{flex:1;min-width:0;margin:0}
.composer button{width:auto;white-space:nowrap}
.disclaimer{text-align:center;font-size:10px;color:#657590;margin-top:12px}
@media(max-width:650px){
 body{padding:0}
 .layout{display:block;min-height:100vh;border-radius:0}
 .sidebar{display:none}
 .workspace{padding:18px 15px;min-height:100vh}
 #chat{height:48vh}
 .welcome{padding-top:28px}
}

*{box-sizing:border-box}
:root{color-scheme:dark}
body{
 margin:0;min-height:100vh;padding:24px;
 display:grid;place-items:center;
 background:radial-gradient(ellipse at 50% 0%,#17294b 0%,#090d18 55%);
 color:#f4f6ff;font-family:Inter,Arial,sans-serif
}
main{
 width:100%;max-width:900px;min-height:650px;
 background:rgba(15,22,37,.94);
 border:1px solid #293750;border-radius:24px;
 padding:30px;box-shadow:0 25px 100px #0009;
}
h1{letter-spacing:5px;font-size:30px;color:#a8c4ff;margin:0}
p{color:#98a8c2}
#login{max-width:390px;margin:100px auto;text-align:center}
#app{display:none}
#chat{
 height:55vh;min-height:300px;max-height:600px;
 overflow:auto;padding:18px 4px;
 border-top:1px solid #293750;
 border-bottom:1px solid #293750;
}
.msg{
 padding:14px 17px;border-radius:16px;
 margin:12px 0;white-space:pre-wrap;
 line-height:1.6;background:#1b2940;
 border:1px solid #2a3c59;
}
.user{background:#263d62;margin-left:12%;border-color:#3d5d8c}
input,button{
 width:100%;font-size:16px;border-radius:13px;
 padding:15px;border:1px solid #344661;
}
input{background:#0a1220;color:white;margin:12px 0}
input:focus{outline:2px solid #729aff;border-color:transparent}
button{
 background:linear-gradient(135deg,#8bb0ff,#6689ef);
 color:#071020;font-weight:700;cursor:pointer;
 transition:.2s;
}
button:hover{filter:brightness(1.12)}
button:disabled{opacity:.5;cursor:wait}
#send{margin-top:8px}
#error{color:#ff8585}
@media(max-width:600px){
 body{padding:0;display:block}
 main{min-height:100vh;border-radius:0;padding:22px 17px}
 #login{margin:100px auto}
 #chat{height:58vh}
 h1{font-size:26px}
}
</style>

</head>
<body>

<main class="layout">
 <aside class="sidebar">
  <div class="brand">NEXUS<span> AI</span></div>
  <button id="newChat" class="new-chat">+ Neuer Chat</button>
  <div class="side-label">DEINE CHATS</div>
  <div class="history-item">◇ Aktuelle Unterhaltung</div>
  <div class="side-bottom">PRIVATE AI EXPERIENCE</div>
 </aside>

 <section class="workspace">
  <header class="topbar">
   <div>
    <div class="top-title">NEXUS AI</div>
    <div class="online"><span></span> KI-Assistent bereit</div>
   </div>
   <div class="avatar">N</div>
  </header>

  <div id="login">
   <h2>Willkommen zurück.</h2>
   <p>Melde dich bei deinem privaten KI-Assistenten an.</p>
   <input id="pin" type="password" placeholder="Deine persönliche PIN">
   <button id="loginBtn">NEXUS öffnen →</button>
   <p id="error"></p>
  </div>

  <div id="app">
   <div class="welcome">
    <div class="welcome-icon">✳</div>
    <h2>Was machen wir heute?</h2>
    <p>Dein persönlicher KI-Assistent. Alles an einem Ort.</p>
   </div>
   <div id="chat">
    <div class="msg">Hallo! Ich bin NEXUS. Was kann ich für dich tun?</div>
   </div>
   <div class="composer">
    <input id="question" placeholder="Frag NEXUS alles …">
    <button id="send">Senden ↑</button>
   </div>
   <div class="disclaimer">NEXUS AI kann Fehler machen. Überprüfe wichtige Informationen.</div>
  </div>
 </section>
</main>

<h1>NEXUS AI</h1>
<p>Dein privater KI-Assistent</p>
<div id="login">
<p>PIN eingeben</p>
<input id="pin" type="password" placeholder="Deine persönliche PIN">
<button id="loginBtn">Anmelden</button>
<p id="error"></p>
</div>
<div id="app">
<div id="chat"><div class="msg">Hallo! Ich bin NEXUS. Was kann ich für dich tun?</div></div>
<input id="question" placeholder="Schreib deine Nachricht …">
<button id="send">Senden</button>
</div>
</main>
<script>
let token="";
const login=document.getElementById("login");
const app=document.getElementById("app");
const chat=document.getElementById("chat");
function add(text,who){const d=document.createElement("div");d.className="msg "+who;d.textContent=text;chat.appendChild(d);chat.scrollTop=chat.scrollHeight;}
document.getElementById("loginBtn").onclick=async()=>{
document.getElementById("newChat").onclick=()=>{
 chat.innerHTML='<div class="msg">Neuer Chat gestartet. Was kann ich für dich tun?</div>';
 document.getElementById("question").value="";
};
const p=document.getElementById("pin").value;
const r=await fetch("/api/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:p})});
if(r.ok){token=p;login.style.display="none";app.style.display="block";}
else document.getElementById("error").textContent="PIN falsch. Bitte erneut versuchen.";
};
async function send(){
const q=document.getElementById("question");
const value=q.value.trim();if(!value)return;
q.value="";add(value,"user");
const b=document.getElementById("send");b.disabled=true;b.textContent="NEXUS denkt …";
try{
const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({message:value})});
if (!r.ok) {
 const data=await r.json();
 add(data.error||"Fehler beim Antworten.","");
 throw new Error(data.error||"Fehler beim Antworten.");
}
const reader=r.body.getReader();
const decoder=new TextDecoder();
let buffer="";
let answer="";
const bubble=document.createElement("div");
bubble.className="msg";
chat.appendChild(bubble);

while(true){
 const {value,done}=await reader.read();
 if(done)break;
 buffer+=decoder.decode(value,{stream:true});
const lines=buffer.split("\\n");
 buffer=lines.pop();
 for(const line of lines){
  if(!line.startsWith("data:"))continue;
  const raw=line.slice(5).trim();
  if(!raw||raw==="[DONE]")continue;
  try{
   const item=JSON.parse(raw);
   answer+=item.response||item.choices?.[0]?.delta?.content||"";
   bubble.textContent=answer;
   chat.scrollTop=chat.scrollHeight;
  }catch(e){}
 }
}
}catch(e){add("Verbindungsfehler. Bitte erneut versuchen.","");}
b.disabled=false;b.textContent="Senden";
}
document.getElementById("send").onclick=send;
document.getElementById("question").addEventListener("keydown",e=>{if(e.key==="Enter")send();});
</script>
</body>
</html>`;

export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  const headers = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};

  if (request.method === "GET" && url.pathname === "/") {
   return new Response(PAGE,{headers:{"Content-Type":"text/html; charset=utf-8"}});
  }

  if (request.method === "POST" && url.pathname === "/api/status") {
   const body = await request.json();
   if (body.pin && body.pin === env.NEXUS_PIN) {
    return Response.json({ok:true},{headers});
   }
   return Response.json({error:"PIN falsch"},{status:401,headers});
  }

  if (request.method === "POST" && url.pathname === "/api/chat") {
   if (!env.NEXUS_PIN || request.headers.get("Authorization") !== "Bearer " + env.NEXUS_PIN) {
    return Response.json({error:"Nicht angemeldet"},{status:401,headers});
   }

   try {
    const body = await request.json();
    const message = String(body.message || "").trim();

    if (!message) {
     return Response.json({error:"Nachricht fehlt"},{status:400,headers});
    }

    const stream = await env.AI.run(MODEL, {
     messages: [
      {role:"system",content:"Du bist NEXUS AI. Antworte auf Deutsch, direkt und verständlich. Halte Antworten möglichst kurz."},
      {role:"user",content:message}
     ],
     stream:true,
     max_tokens:512
    });

    return new Response(stream, {
     headers: {
      "Content-Type":"text/event-stream; charset=utf-8",
      "Cache-Control":"no-cache"
     }
    });

   } catch (e) {
    return Response.json({error:"KI-Fehler: " + e.message},{status:500,headers});
   }
  }

  return new Response("Nicht gefunden",{status:404});
 }
};
