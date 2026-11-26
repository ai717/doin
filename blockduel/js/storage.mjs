// 唯一存档口径：Key 固定 doin.blockduel.v1。读取必须归一化，写入集中 try/catch，
// 任何损坏数据都静默降级为内存态，绝不白屏。

export const SAVE_KEY = "doin.blockduel.v1";
export const TOTAL_STAGES = 22;

let memory = null;

export function defaultSave() {
  return {
    cleared: [],
    bestStage: 0,
    lastStage: 0,
    mode: "solo",
    bestOf: 3,
    sound: true,
    wins: 0,
    losses: 0,
    played: 0,
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
  const cleared = Array.isArray(raw.cleared)
    ? Array.from(
        new Set(
          raw.cleared
            .map((value) => toInt(value, -1, 0, TOTAL_STAGES - 1))
            .filter((value) => value >= 0),
        ),
      ).sort((a, b) => a - b)
    : [];
  const bestStage = toInt(raw.bestStage, 0, 0, TOTAL_STAGES - 1);
  return {
    cleared,
    bestStage,
    lastStage: toInt(raw.lastStage, 0, 0, TOTAL_STAGES - 1),
    mode: raw.mode === "versus" ? "versus" : "solo",
    bestOf: raw.bestOf === 5 ? 5 : 3,
    sound: raw.sound === false ? false : true,
    wins: toInt(raw.wins, 0, 0, Number.MAX_SAFE_INTEGER),
    losses: toInt(raw.losses, 0, 0, Number.MAX_SAFE_INTEGER),
    played: toInt(raw.played, 0, 0, Number.MAX_SAFE_INTEGER),
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
      } catch {
        corrupted = true;
      }
    }
  } catch {
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
  } catch {
    /* 隐私模式 / 配额满：仅保留内存态 */
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

export function recordStageResult(save, stageIndex, won) {
  const next = normalize(save);
  const index = toInt(stageIndex, 0, 0, TOTAL_STAGES - 1);
  next.played += 1;
  if (won) {
    next.wins += 1;
    if (!next.cleared.includes(index)) next.cleared.push(index);
    next.cleared.sort((a, b) => a - b);
    next.bestStage = Math.max(next.bestStage, Math.min(TOTAL_STAGES - 1, index + 1));
    next.lastStage = Math.min(TOTAL_STAGES - 1, index + 1);
  } else {
    next.losses += 1;
  }
  return next;
}

export function recordSeries(save, mode, won) {
  const next = normalize(save);
  next.played += 1;
  if (won) next.wins += 1;
  else next.losses += 1;
  if (mode === "versus") next.mode = "versus";
  return next;
}

export function setPreferences(save, prefs = {}) {
  const next = normalize(save);
  if (prefs.mode === "solo" || prefs.mode === "versus") next.mode = prefs.mode;
  if (prefs.bestOf === 3 || prefs.bestOf === 5) next.bestOf = prefs.bestOf;
  if (typeof prefs.sound === "boolean") next.sound = prefs.sound;
  return next;
}

export function highestUnlocked(save) {
  return Math.max(0, Math.min(TOTAL_STAGES - 1, normalize(save).bestStage));
}
