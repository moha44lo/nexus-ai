
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
</style>
</head>
<body>
<main>
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
