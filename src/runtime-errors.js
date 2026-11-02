export function formatRuntimeError(error) {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  if (/(?:\\b4006\\b|daily free allocation|free allocation of \\d+ neurons)/i.test(message)) {
    return "Cloudflare Workers AI Tageskontingent aufgebraucht (Code 4006). Warte auf den täglichen Reset oder aktiviere einen kostenpflichtigen Workers-Plan.";
  }
  return message.slice(0, 300);
}
