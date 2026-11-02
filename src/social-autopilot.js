import { extractWorkersAIText } from "./model-output.js";

const ALLOWED_PLATFORMS = new Set(["tiktok", "instagram", "youtube"]);
const ALLOWED_OBJECTIVES = new Set(["growth", "education", "entertainment", "traffic", "sales"]);

export function normalizeSocialInput(input = {}) {
  const platform = String(input.platform || "tiktok").toLowerCase();
  if (!ALLOWED_PLATFORMS.has(platform)) throw new Error("Plattform muss tiktok, instagram oder youtube sein.");
  const niche = String(input.niche || "").trim().slice(0, 180);
  if (!niche) throw new Error("Bitte gib eine Content-Nische an.");
  const objective = String(input.objective || "growth").toLowerCase();
  if (!ALLOWED_OBJECTIVES.has(objective)) throw new Error("Ungültiges Content-Ziel.");
  const duration = Number(input.duration_seconds || 25);
  if (!Number.isFinite(duration) || duration < 8 || duration > 180) throw new Error("Videolänge muss zwischen 8 und 180 Sekunden liegen.");
  return {
    platform, niche, objective,
    language: String(input.language || "de").slice(0, 12),
    audience: String(input.audience || "Menschen mit Interesse an diesem Thema").trim().slice(0, 180),
    tone: String(input.tone || "hochwertig, originell und aufmerksamkeitsstark").trim().slice(0, 180),
    duration_seconds: Math.round(duration),
    account_context: String(input.account_context || "").trim().slice(0, 500)
  };
}

export function parseSocialPackage(raw) {
  const text = String(raw || "").trim();
  const candidate = text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("Die KI hat kein gültiges Content-Paket geliefert.");
  let value;
  try { value = JSON.parse(candidate); }
  catch { throw new Error("Das Content-Paket konnte nicht als JSON gelesen werden."); }
  const scenes = Array.isArray(value.scenes) ? value.scenes.slice(0, 12).map(scene => ({
    time: String(scene.time || "").slice(0, 24),
    visual: String(scene.visual || "").slice(0, 500),
    voiceover: String(scene.voiceover || "").slice(0, 500),
    on_screen_text: String(scene.on_screen_text || "").slice(0, 180)
  })) : [];
  const hashtags = Array.isArray(value.hashtags) ? value.hashtags.slice(0, 12).map(tag => String(tag).replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 40)).filter(Boolean) : [];
  const result = {
    title: String(value.title || "").trim().slice(0, 120),
    hook: String(value.hook || "").trim().slice(0, 240),
    script: String(value.script || "").trim().slice(0, 5000),
    scenes,
    caption: String(value.caption || "").trim().slice(0, 2200),
    hashtags,
    cta: String(value.cta || "").trim().slice(0, 240),
    cover_text: String(value.cover_text || "").trim().slice(0, 80)
  };
  if (!result.title || !result.hook || !result.script || !result.caption || !scenes.length) throw new Error("Das Content-Paket ist unvollständig. Bitte erneut generieren.");
  return result;
}

export async function generateSocialPackage(env, input) {
  if (!env?.AI?.run) throw new Error("Workers AI ist nicht verfügbar.");
  const prompt = `Du bist Creative Director, TikTok-Strategist und Short-Form-Video-Producer.
Erstelle ein originelles, sofort produzierbares Content-Paket. Keine kopierten Creator-Skripte, keine erfundenen Trend- oder Performance-Daten, keine unbelegten Fakten.
Plattform: ${input.platform}
Nische: ${input.niche}
Ziel: ${input.objective}
Zielgruppe: ${input.audience}
Sprache: ${input.language}
Ton: ${input.tone}
Videolänge: ${input.duration_seconds} Sekunden
Account-Kontext: ${input.account_context || "Keiner"}
Liefere ausschließlich valides JSON mit exakt diesen Feldern:
{"title":"...","hook":"...","script":"...","scenes":[{"time":"0-3s","visual":"konkrete Bildanweisung","voiceover":"gesprochener Text","on_screen_text":"kurzer Einblender"}],"caption":"...","hashtags":["..."],"cta":"...","cover_text":"..."}
Erstelle 4 bis 8 Szenen mit Zeitangaben, konkreten visuellen Anweisungen und passendem Voiceover. Hook muss in den ersten 2 Sekunden funktionieren. Caption soll natürlich klingen. Hashtags spezifisch statt generisch. Keine Markdown-Codeblöcke.`;
  const response = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
    messages: [{ role: "system", content: "Du lieferst strukturierte, kreative Short-Form-Content-Pakete. Antworte ausschließlich mit validem JSON." }, { role: "user", content: prompt }],
    max_tokens: 2200,
    chat_template_kwargs: { enable_thinking: false }
  });
  return parseSocialPackage(extractWorkersAIText(response));
}
