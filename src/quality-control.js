const FOREIGN_SCRIPT = /[\\u0400-\\u052F\\u4E00-\\u9FFF\\u3040-\\u30FF\\uAC00-\\uD7AF]/g;

export function inspectAnswer(answer, task = "") {
  const text = typeof answer === "string" ? answer.trim() : "";
  const issues = [];
  if (!text) return ["Die finale Antwort ist leer."];
  if (text.includes("\uFFFD")) issues.push("Die Antwort enthält beschädigte Unicode-Zeichen.");
  const latinTask = /[A-Za-zÄÖÜäöüß]/.test(task) && !/[\\u0600-\\u06FF\\u0400-\\u052F]/.test(task);
  if (latinTask) {
    const foreign = text.match(FOREIGN_SCRIPT) || [];
    const letters = (text.match(/[\\p{L}]/gu) || []).length;
    if (letters > 0 && foreign.length / letters > 0.005) {
      issues.push("Die Antwort enthält unerwartete fremde Schriftsysteme innerhalb eines lateinischen Textes.");
    }
  }
  if (/[ÃÂ][\\w]/.test(text)) issues.push("Die Antwort enthält mögliche Zeichenkodierungsfehler.");
  if (/[,;:]\\s*$/.test(text)) issues.push("Die Antwort endet möglicherweise mitten in einem Satz oder einer Aufzählung.");
  const repeated = text.match(/\\b([\\p{L}]{3,})\\s+\\1\\b/iu);
  if (repeated) issues.push("Die Antwort enthält ein direkt wiederholtes Wort: " + repeated[1] + ".");
  if (text.length < 45 && String(task).trim().length > 100) {
    issues.push("Die Antwort ist für die Länge und Komplexität der Aufgabe ungewöhnlich kurz.");
  }
  return issues;
}
