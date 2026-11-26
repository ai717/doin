// Portal bridge: write shared meta through the guarded storage module and notify the parent frame.
import { recordMeta } from "./storage.mjs";

export function reportSession(outcome = {}) {
  const payload = {
    slug: String(outcome.slug ?? "soap"),
    outcome: outcome.outcome === "WON" ? "WON" : "LOST",
    score: Math.max(0, Math.trunc(outcome.score ?? 0)),
    stars: Math.max(0, Math.trunc(outcome.stars ?? 0)),
    timestamp: Date.now(),
  };
  recordMeta(payload);
  try {
    if (globalThis.parent && globalThis.parent !== globalThis) {
      globalThis.parent.postMessage?.({ type: "DOIN_GAME_EVENT", payload }, "*");
    }
  } catch (error) {
    // ignore cross-origin failures
  }
  return payload;
}
