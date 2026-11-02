import test from "node:test";
import assert from "node:assert/strict";
import { inspectAnswer } from "../src/quality-control.js";

test("accepts clean German output", () => {
  assert.deepEqual(inspectAnswer("Hier ist ein klarer Plan mit konkreten Schritten und einem nachvollziehbaren Ergebnis.", "Erstelle einen Plan auf Deutsch."), []);
});

test("detects unexpected CJK characters in a Latin-language answer", () => {
  assert.match(inspectAnswer("Hier ist dein Plan 积蓄 mit konkreten Schritten.", "Erstelle einen Plan auf Deutsch.")[0], /fremde Schriftsysteme/);
});

test("detects encoding damage and unfinished endings", () => {
  const issues = inspectAnswer("Das ist ein beschädigter Text mit \uFFFD und endet hier:", "Erkläre ausführlich, wie das funktioniert.");
  assert.ok(issues.some(issue => /beschädigte Unicode-Zeichen/.test(issue)));
  assert.ok(issues.some(issue => /mitten in einem Satz/.test(issue)));
});

test("detects duplicated words and unusually short complex answers", () => {
  const issues = inspectAnswer("Das ist ein ein kurzer Text.", "Erstelle eine ausführliche und umfassende Analyse mit mehreren konkreten Handlungsschritten, Risiken, Gegenmaßnahmen, Prioritäten und nachvollziehbaren Beispielen.");
  assert.ok(issues.some(issue => /wiederholtes Wort/.test(issue)));
  assert.ok(issues.some(issue => /ungewöhnlich kurz/.test(issue)));
});
