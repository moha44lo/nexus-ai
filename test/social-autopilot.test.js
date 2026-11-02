import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSocialInput, parseSocialPackage } from "../src/social-autopilot.js";

test("normalizes valid TikTok brief and applies safe defaults", () => {
  const brief = normalizeSocialInput({ niche: "cinematic travel", platform: "tiktok" });
  assert.equal(brief.platform, "tiktok");
  assert.equal(brief.duration_seconds, 25);
  assert.equal(brief.objective, "growth");
});

test("rejects unsupported platforms and missing niche", () => {
  assert.throws(() => normalizeSocialInput({ niche: "travel", platform: "x" }), /Plattform/);
  assert.throws(() => normalizeSocialInput({}), /Nische/);
});

test("parses and bounds generated content package", () => {
  const parsed = parseSocialPackage(JSON.stringify({
    title: "Hidden coast", hook: "This place looks unreal", script: "Voiceover",
    scenes: [{ time: "0-3s", visual: "Aerial coastline", voiceover: "Look at this", on_screen_text: "Hidden coast" }],
    caption: "Save this place", hashtags: ["#travel", "#HiddenPlaces"], cta: "Follow for more", cover_text: "Hidden coast"
  }));
  assert.deepEqual(parsed.hashtags, ["travel", "HiddenPlaces"]);
  assert.equal(parsed.scenes.length, 1);
});
