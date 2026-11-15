// Volley Bombard — persistence layer. Key doin.volley.v1.
// Single save authority: normalize on read, centralized try/catch with silent
// in-memory fallback; corrupted data never breaks the page.

export const SAVE_KEY = "doin.volley.v1";

let memory = null;

export function defaultSave() {
  return {
    mode: "2p",
    aiLevel: "veteran",
    terrain: "hill",
    sound: true,
    matches: 0,
    p1Wins: 0,
    p2Wins: 0,
    lastWinner: 0,
    bestHitRate: 0,
    bestSingle: 0,
  };
}

function toInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function normalize(raw) {
  const base = defaultSave();
  if (!raw || typeof raw !== "object") return base;
  return {
    mode: raw.mode === "ai" ? "ai" : "2p",
    aiLevel: ["rookie", "veteran", "master"].includes(raw.aiLevel) ? raw.aiLevel : base.aiLevel,
    terrain: ["hill", "peak", "twin"].includes(raw.terrain) ? raw.terrain : base.terrain,
    sound: raw.sound === false ? false : true,
    matches: toInt(raw.matches, 0, 0, Number.MAX_SAFE_INTEGER),
    p1Wins: toInt(raw.p1Wins, 0, 0, Number.MAX_SAFE_INTEGER),
    p2Wins: toInt(raw.p2Wins, 0, 0, Number.MAX_SAFE_INTEGER),
    lastWinner: toInt(raw.lastWinner, 0, 0, 2),
    bestHitRate: toInt(raw.bestHitRate, 0, 0, 100),
    bestSingle: toInt(raw.bestSingle, 0, 0, 999),
  };
}

export function loadSave() {
  let raw = null;
  let corrupted = false;
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (text) {
      try {
        raw = JSON.parse(text);
      } catch (err) {
        corrupted = true;
      }
    }
  } catch (err) {
    raw = null;
  }
  if (corrupted) {
    const safe = defaultSave();
    memory = safe;
    return safe;
  }
  if (!raw && memory) return normalize(memory);
  const save = normalize(raw);
  memory = save;
  return save;
}

export function writeSave(save) {
  const normalized = normalize(save);
  memory = normalized;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(normalized));
  } catch (err) {
    /* privacy mode / quota full: keep memory state only */
  }
  return normalized;
}

export function updateSave(mutator) {
  const next = normalize(mutator(loadSave()));
  return writeSave(next);
}

export function resetSave() {
  return writeSave(defaultSave());
}

export function setPreferences(prefs = {}) {
  const next = normalize(loadSave());
  if (prefs.mode === "ai" || prefs.mode === "2p") next.mode = prefs.mode;
  if (["rookie", "veteran", "master"].includes(prefs.aiLevel)) next.aiLevel = prefs.aiLevel;
  if (["hill", "peak", "twin"].includes(prefs.terrain)) next.terrain = prefs.terrain;
  if (typeof prefs.sound === "boolean") next.sound = prefs.sound;
  return writeSave(next);
}

export function recordMatch(winnerSide, hitRatePct, bestSingle) {
  const next = normalize(loadSave());
  next.matches += 1;
  if (winnerSide === 1) next.p1Wins += 1;
  else if (winnerSide === 2) next.p2Wins += 1;
  next.lastWinner = toInt(winnerSide, 0, 0, 2);
  if (Number.isFinite(hitRatePct)) next.bestHitRate = Math.max(next.bestHitRate, toInt(hitRatePct, 0, 0, 100));
  if (Number.isFinite(bestSingle)) next.bestSingle = Math.max(next.bestSingle, toInt(bestSingle, 0, 0, 999));
  return writeSave(next);
}
