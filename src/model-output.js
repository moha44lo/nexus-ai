export function extractWorkersAIText(result) {
  const candidates = [
    result?.response,
    result?.choices?.[0]?.message?.content,
    result?.result?.response,
    result?.result?.choices?.[0]?.message?.content,
    result?.output_text
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (Array.isArray(candidate)) {
      const text = candidate.map(part => typeof part === "string" ? part : part?.text || "").join("").trim();
      if (text) return text;
    }
  }
  throw new Error("Workers AI lieferte keinen Textinhalt. Antwortformat: " + Object.keys(result || {}).join(", "));
}
