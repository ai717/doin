// Shared portal bridge: recently played feed and cross-game star total.

const META_KEY = "doin.meta.v1";

export function reportWash(levelId, stars = 0) {
  const payload = {
    slug: "jetwash",
    outcome: "WON",
    levelId: String(levelId || ""),
    stars: Math.max(0, Math.floor(stars || 0)),
    timestamp: Date.now(),
  };
  try {
    if (typeof localStorage !== "undefined") {
      const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
      meta.recentlyPlayed = [payload.slug, ...(meta.recentlyPlayed || []).filter((s) => s !== payload.slug)].slice(0, 8);
      meta.totalStars = (meta.totalStars || 0) + payload.stars;
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    }
  } catch (error) { /* shared meta is best-effort */ }
  try {
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload }, "*");
    }
  } catch (error) { /* iframe bridge is best-effort */ }
  return payload;
}
