// 连连看 link-up · 存档唯一口径 · Key: doin.link-up.v1
// localStorage 不可用 / 数据损坏 → 静默降级内存默认值，绝不白屏

const KEY = "doin.link-up.v1";
const MAX_LEVEL = 50;
const MAX_SCORE = 800;

function defaults() {
  return { unlocked: 1, best: {}, daily: null, sound: true };
}

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
    // 隐私模式或存储被禁用
  }
  const map = new Map();
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return backend;
}

function toScore(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.round(v)));
}

function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== "object") return d;
  const out = { ...d };

  if (Number.isFinite(raw.unlocked)) {
    out.unlocked = Math.max(1, Math.min(MAX_LEVEL, Math.round(raw.unlocked)));
  }
  if (typeof raw.sound === "boolean") out.sound = raw.sound;

  if (raw.best && typeof raw.best === "object" && !Array.isArray(raw.best)) {
    const best = {};
    for (const k of Object.keys(raw.best)) {
      const lv = Number(k);
      if (Number.isInteger(lv) && lv >= 1 && lv <= MAX_LEVEL) {
        best[k] = toScore(raw.best[k]);
      }
    }
    out.best = best;
  }

  if (raw.daily && typeof raw.daily === "object") {
    const dd = raw.daily;
    if (typeof dd.date === "string" && dd.date.length === 10) {
      out.daily = {
        date: dd.date,
        score: toScore(dd.score),
        steps: Math.max(0, Math.round(Number.isFinite(dd.steps) ? dd.steps : 0)),
        elapsedMs: Math.max(0, Math.round(Number.isFinite(dd.elapsedMs) ? dd.elapsedMs : 0)),
      };
    }
  }

  return out;
}

export function load() {
  try {
    const raw = storage().getItem(KEY);
    if (!raw) return defaults();
    return normalize(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

export function save(data) {
  const safe = normalize(data);
  try {
    storage().setItem(KEY, JSON.stringify(safe));
  } catch {
    // 静默
  }
  return safe;
}

// 记录一局结果，返回 { data, isNewBest }
export function recordResult(data, result) {
  const next = { ...data, best: { ...(data.best || {}) } };

  if (result.kind === "level") {
    const key = String(result.levelIndex);
    const prev = typeof next.best[key] === "number" ? next.best[key] : 0;
    const score = toScore(result.score);
    const isNewBest = score > prev;
    next.best[key] = Math.max(prev, score);
    if (isNewBest && result.levelIndex === next.unlocked && next.unlocked < MAX_LEVEL) {
      next.unlocked += 1;
    }
    return { data: next, isNewBest };
  }

  if (result.kind === "daily") {
    const prev = next.daily;
    const resultDate = result.date ?? result.dailyDate;
    const better =
      !prev ||
      prev.date !== resultDate ||
      result.score > prev.score ||
      (result.score === prev.score && result.steps < prev.steps);
    const isNewBest = !!prev && prev.date === resultDate && result.score > prev.score;
    if (better) {
      next.daily = {
        date: resultDate,
        score: toScore(result.score),
        steps: Math.max(0, Math.round(result.steps)),
        elapsedMs: Math.max(0, Math.round(result.elapsedMs)),
      };
    }
    return { data: next, isNewBest };
  }

  return { data: next, isNewBest: false };
}

export function setSound(enabled) {
  const data = load();
  data.sound = !!enabled;
  return save(data);
}
