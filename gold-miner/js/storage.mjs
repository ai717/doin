// 存档唯一口径：key doin.gold-miner.v1，localStorage 不可用时静默降级内存。
// 结构 { version, prefs:{muted}, progress:{level,money,record,dynamite,potion,polish} }。

export const STORAGE_KEY = "doin.gold-miner.v1";
export const SCHEMA_VERSION = 1;
export const START_DYNAMITE = 3;
export const START_LEVEL = 1;

export function defaultProgress() {
  return {
    level: START_LEVEL,
    money: 0,
    record: 0,
    dynamite: START_DYNAMITE,
    potion: false,
    polish: false,
  };
}

export function defaultState() {
  return { version: SCHEMA_VERSION, prefs: { muted: false }, progress: defaultProgress() };
}

function createMemoryFallback() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__doin_gm__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
    // 隐私模式或存储被禁用
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

function int(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

function bool(value) {
  return value === true || value === "true" || value === 1;
}

// 任何字段缺失或被手改坏都退回默认值，绝不把异常抛给 UI。
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const money = int(progress.money);
  const record = Math.max(int(progress.record), money);
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: bool(prefs.muted) },
    progress: {
      level: int(progress.level, START_LEVEL) || START_LEVEL,
      money,
      record,
      dynamite: int(progress.dynamite, START_DYNAMITE),
      potion: bool(progress.potion),
      polish: bool(progress.polish),
    },
  };
}

export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return defaultState();
  }
}

export function save(state) {
  const next = normalize(state);
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // 写失败不影响本局游戏
  }
  return next;
}

// 最高纪录只增不减：record = 历史持有过的最多现金。
export function recordRound(state, { money }) {
  const next = normalize(state);
  const cash = int(money);
  const isRecord = cash > next.progress.record;
  if (isRecord) next.progress.record = cash;
  return { state: next, isRecord };
}

// 破产重来：清掉本局现金 / 关卡 / 道具，保留最高纪录与偏好。
export function clearRun(state) {
  const next = normalize(state);
  return {
    ...next,
    progress: { ...defaultProgress(), record: next.progress.record },
  };
}

export function setMuted(state, muted) {
  const next = normalize(state);
  next.prefs.muted = Boolean(muted);
  return next;
}

export function resetAll() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch (error) {
    // 忽略
  }
  return defaultState();
}
