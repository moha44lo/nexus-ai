import puppeteer from "@cloudflare/puppeteer";

const MAX_STEPS = 12;
const MAX_TEXT = 12000;
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export function validateBrowserUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error("Ungültige URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Nur HTTP- und HTTPS-Seiten sind erlaubt.");
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") ||
      /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host) || host === "[::1]" || host.startsWith("fc") || host.startsWith("fd")) {
    throw new Error("Lokale und private Netzwerkziele sind gesperrt.");
  }
  return url.toString();
}

function extractJson(text) {
  const source = String(text || "").trim().replace(/^\u0060\u0060\u0060(?:json)?\s*/i, "").replace(/\s*\u0060\u0060\u0060$/, "");
  const start = source.indexOf("{"), end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Der Agent hat keinen gültigen Aufgabenplan geliefert.");
  return JSON.parse(source.slice(start, end + 1));
}

export async function createPlan(env, task, memory = []) {
  const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
    messages: [
      { role: "system", content: `Du bist NEXUS, ein autonomer Browser-Agent. Antworte ausschließlich mit gültigem JSON: {"goal":"...","summary":"...","steps":[{"id":"s1","tool":"browser.navigate|browser.inspect|browser.click|browser.fill|browser.extract","args":{...},"reason":"..."}]}. Maximal ${MAX_STEPS} Schritte. Nutze navigate mit {"url":"https://..."}; inspect mit {}; click mit {"selector":"CSS"}; fill mit {"selector":"CSS","value":"..."}; extract mit {"selector":"CSS"} oder {}. Wenn die Aufgabe keine Browseraktion benötigt, liefere steps:[] und erkläre das in summary. Erfinde keine bereits erfolgten Aktionen. Browser-Klicks und Formulareingaben gelten als externe Aktionen und benötigen Freigabe. Verwende niemals Zahlungs-, Kauf-, Lösch-, Veröffentlichungs-, Nachrichtenversand- oder Kontoänderungsaktionen; diese werden als nicht unterstützt markiert.` },
      { role: "system", content: "Relevante gespeicherte Fakten:\n" + memory.map(x => "- " + x.fact).join("\n").slice(0, 5000) },
      { role: "user", content: String(task).slice(0, MAX_TEXT) }
    ],
    max_tokens: 1600
  });
  const plan = extractJson(result?.response);
  if (!Array.isArray(plan.steps) || plan.steps.length > MAX_STEPS) throw new Error("Ungültige oder zu lange Schrittfolge.");
  const allowed = new Set(["browser.navigate", "browser.inspect", "browser.click", "browser.fill", "browser.extract"]);
  for (const [index, step] of plan.steps.entries()) {
    if (!allowed.has(step.tool)) throw new Error("Nicht erlaubtes Tool im Plan: " + String(step.tool));
    if (!step.id) step.id = "s" + (index + 1);
    if (!step.args || typeof step.args !== "object" || Array.isArray(step.args)) step.args = {};
    if (step.tool === "browser.navigate") step.args.url = validateBrowserUrl(step.args.url);
    if (["browser.click", "browser.fill"].includes(step.tool) && !step.args.selector) throw new Error("CSS-Selektor fehlt.");
    if (step.tool === "browser.fill" && typeof step.args.value !== "string") throw new Error("Eingabewert fehlt.");
  }
  return { goal: String(plan.goal || task).slice(0, 300), summary: String(plan.summary || "").slice(0, 1200), steps: plan.steps };
}

export function needsApproval(plan) {
  return plan.steps.some(step => ["browser.click", "browser.fill"].includes(step.tool));
}

export async function runBrowserPlan(env, plan, onStep = async () => {}) {
  if (!env.BROWSER) throw new Error("Browser Run ist noch nicht aktiviert. Aktiviere den BROWSER-Binding in Cloudflare.");
  const browser = await puppeteer.launch(env.BROWSER);
  const results = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    for (const step of plan.steps) {
      let output;
      if (step.tool === "browser.navigate") {
        await page.goto(validateBrowserUrl(step.args.url), { waitUntil: "domcontentloaded", timeout: 30000 });
        output = { url: page.url(), title: await page.title() };
      } else if (step.tool === "browser.inspect") {
        output = await page.evaluate(() => ({
          url: location.href, title: document.title,
          text: (document.body?.innerText || "").slice(0, 9000),
          links: [...document.querySelectorAll("a[href]")].slice(0, 30).map(a => ({ text: (a.innerText || "").trim().slice(0, 120), href: a.href })),
          inputs: [...document.querySelectorAll("input,textarea,select,button")].slice(0, 40).map(e => ({ tag: e.tagName.toLowerCase(), type: e.type || "", name: e.name || "", placeholder: e.placeholder || "", text: (e.innerText || "").trim().slice(0, 80) }))
        }));
      } else if (step.tool === "browser.click") {
        await page.click(step.args.selector);
        output = { clicked: step.args.selector, url: page.url() };
      } else if (step.tool === "browser.fill") {
        await page.locator(step.args.selector).fill(String(step.args.value).slice(0, 2000));
        output = { filled: step.args.selector };
      } else if (step.tool === "browser.extract") {
        const selector = step.args.selector || "body";
        output = await page.$eval(selector, el => (el.innerText || el.textContent || "").slice(0, 9000));
      }
      const record = { stepId: step.id, tool: step.tool, status: "completed", output };
      results.push(record);
      await onStep(record);
    }
    return { status: "completed", url: page.url(), title: await page.title(), results };
  } catch (error) {
    const record = { status: "failed", error: error instanceof Error ? error.message.slice(0, 300) : "Browser-Fehler" };
    await onStep(record);
    return record;
  } finally {
    await browser.close();
  }
}
