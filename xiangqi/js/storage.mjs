// 存档唯一口径：key = doin.xiangqi.v1。集中 try/catch 降级内存，读取必须 normalize。
// 只持久化闯关结果、对战记录与设置，不存进行中局面（对局可随时重开，无中断续局需求）。

const STORAGE_KEY = "doin.xiangqi.v1";
const SAVE_VERSION = 1;

let backend = null;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__probe__", "1");
      localStorage.removeItem("__probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // 隐私模式或存储受限：静默降级内存
  }
  const map = new Map();
  backend = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  return backend;
}

function emptyRecord() {
  return { wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, badges: {} };
}

function normalize(data) {
  const out = {
    version: SAVE_VERSION,
    campaign: { levels: {} },
    duel: emptyRecord(),
    settings: { sound: true, hint: true },
    aiTier: "ai_1",
  };
  if (!data || typeof data !== "object") return out;
  if (data.campaign && typeof data.campaign === "object" && data.campaign.levels && typeof data.campaign.levels === "object") {
    for (const [key, value] of Object.entries(data.campaign.levels)) {
      if (!/^level_\d+$/.test(key) || !value || typeof value !== "object") continue;
      const stars = Number(value.stars);
      const moves = Number(value.moves);
      if (!Number.isInteger(stars) || stars < 1 || stars > 3) continue;
      if (!Number.isInteger(moves) || moves < 1) continue;
      out.campaign.levels[key] = { stars, moves };
    }
  }
  if (data.duel && typeof data.duel === "object") {
    const src = data.duel;
    const int = (v, min = 0) => (Number.isInteger(v) && v >= min ? v : 0);
    out.duel = {
      wins: int(src.wins),
      losses: int(src.losses),
      draws: int(src.draws),
      streak: int(src.streak),
      bestStreak: int(src.bestStreak),
      badges: {},
    };
    if (src.badges && typeof src.badges === "object") {
      for (const [key, value] of Object.entries(src.badges)) {
        if (/^badge_(ai_[1-5]|defender)$/.test(key) && value === true) out.duel.badges[key] = true;
      }
    }
    if (out.duel.bestStreak < out.duel.streak) out.duel.bestStreak = out.duel.streak;
  }
  if (data.settings && typeof data.settings === "object") {
    out.settings = {
      sound: typeof data.settings.sound === "boolean" ? data.settings.sound : true,
      hint: typeof data.settings.hint === "boolean" ? data.settings.hint : true,
    };
  }
  if (typeof data.aiTier === "string" && /^ai_[1-5]$/.test(data.aiTier)) out.aiTier = data.aiTier;
  return out;
}

export function loadSave() {
  let raw = null;
  try {
    raw = storage().getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return normalize(null);
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return normalize(null); // 损坏数据静默重置，绝不白屏
  }
}

export function saveSave(data) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(data)));
    return true;
  } catch {
    return false;
  }
}

// 便捷读写：patch = 部分字段覆盖。
export function updateSave(patch) {
  const current = loadSave();
  const next = { ...current, ...patch };
  saveSave(next);
  return next;
}

export function recordCampaignResult(levelKey, stars, moves) {
  const data = loadSave();
  const prev = data.campaign.levels[levelKey];
  const next = {
    ...data,
    campaign: {
      levels: {
        ...data.campaign.levels,
        [levelKey]: {
          stars: Math.max(prev?.stars ?? 0, stars),
          moves: prev ? Math.min(prev.moves, moves) : moves,
        },
      },
    },
  };
  saveSave(next);
  return next;
}

export function recordDuelResult(win, draw, tierKey) {
  const data = loadSave();
  const duel = { ...data.duel, badges: { ...data.duel.badges } };
  if (draw) {
    duel.draws += 1;
    duel.streak = 0;
  } else if (win) {
    duel.wins += 1;
    duel.streak += 1;
    duel.bestStreak = Math.max(duel.bestStreak, duel.streak);
    if (tierKey) duel.badges[`badge_${tierKey}`] = true;
  } else {
    duel.losses += 1;
    duel.streak = 0;
  }
  saveSave({ ...data, duel });
  return { ...data, duel };
}

export function saveSettings(patch) {
  const data = loadSave();
  const settings = { ...data.settings, ...patch };
  saveSave({ ...data, settings });
  return settings;
}

export function saveAiTier(tierKey) {
  if (!/^ai_[1-5]$/.test(tierKey)) return loadSave();
  const data = loadSave();
  saveSave({ ...data, aiTier: tierKey });
  return { ...data, aiTier: tierKey };
}

export function resetSave() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
  return normalize(null);
}

export { STORAGE_KEY };
