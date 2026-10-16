// 恶魔迷途 · 存档唯一口径
// Key: doin.devil-run.v1
// localStorage 不可用或数据损坏时静默降级内存；读取严格归一化，绝不白屏。
//
// 本作没有「分数」，评价体系是**恶魔印章**：
//   clear    通关印  —— 本关通关即点亮（永久）
//   candle   蜡烛印  —— 拿到隐藏蜡烛通关才点亮（永久）
//   flawless 无伤印  —— 本关零死亡通关才点亮（永久）
// 另记录最佳用时、死亡账本（用于状态栏的机械翻轴计数器）与嘲讽表情进度。

import { LEVEL_COUNT, NODES } from "./levels.mjs";

export const STORAGE_KEY = "doin.devil-run.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: false
    },
    progress: {
      unlocked: 1,            // 已解锁关卡数（1 起）
      // 每关的印章明细：{ [levelIndex]: { clear, candle, flawless } }
      seals: {},
      // 每关最佳用时（秒）
      bestTime: {},
      // 每关累计死亡次数（恶魔账本）
      deaths: {},
      // 全局累计死亡（状态栏翻轴用）
      totalDeaths: 0
    }
  };
}

function createMemoryFallback() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

let backend;

function getStorage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__doin_devil_run_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch {
    // 隐私模式 / 配额不足 → 静默降级
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

// 整数归一化。
// 注意：负值必须原样保留（截断），不能钳到 0 —— 调用方用 -1 之类当作
// 「非法」哨兵，若在这里把 -1 变成 0，越界索引就会被静默当成第 1 关。
// 需要非负语义的调用方（如死亡计数）自行用 max(0, ...) 兜底。
function int(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

// 关卡索引解析：只接受真数字或数字字符串，其余（含 null/undefined/NaN/对象）
// 一律返回 -1 表示非法。不能用 int() 代劳 —— Number(null) === 0 会把
// 缺失的 levelIndex 静默当成第 1 关。
function levelIndexOr(val) {
  if (typeof val === "number") {
    return Number.isFinite(val) ? Math.trunc(val) : -1;
  }
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    return Number.isFinite(n) ? Math.trunc(n) : -1;
  }
  return -1;
}

function finite(val, fallback = null) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizeSeal(raw) {
  if (!raw || typeof raw !== "object") return null;
  const seal = {
    clear: Boolean(raw.clear),
    candle: Boolean(raw.candle),
    flawless: Boolean(raw.flawless)
  };
  // 无通关则其余两印无意义，强制归零（避免脏数据造出"没通关却有蜡烛印"）
  if (!seal.clear) return { clear: false, candle: false, flawless: false };
  return seal;
}

function normalizeProgress(progress) {
  const seals = {};
  const bestTime = {};
  const deaths = {};
  let totalDeaths = 0;

  if (progress && typeof progress === "object") {
    const s = progress.seals ?? {};
    const t = progress.bestTime ?? {};
    const d = progress.deaths ?? {};

    for (let i = 0; i < LEVEL_COUNT; i++) {
      const seal = normalizeSeal(s[i]);
      if (seal) seals[i] = seal;

      const bt = finite(t[i]);
      if (bt !== null) bestTime[i] = bt;

      const dc = Math.max(0, int(d[i], 0));
      if (dc > 0) deaths[i] = dc;
    }
    totalDeaths = Math.max(0, int(progress.totalDeaths, 0));
  }

  const unlocked = int(progress?.unlocked ?? 1, 1);
  return {
    unlocked: Math.max(1, Math.min(LEVEL_COUNT, unlocked)),
    seals,
    bestTime,
    deaths,
    totalDeaths
  };
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: Boolean(raw.prefs?.muted)
    },
    progress: normalizeProgress(raw.progress)
  };
}

export function load() {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function save(state) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    return true;
  } catch {
    return false;
  }
}

export function reset() {
  try {
    getStorage().removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
  return defaultState();
}

// ---- 印章读写 ----

// 通关结算：合并三枚印章、刷新最佳用时、解锁下一关
// result: { levelIndex, seal: { clear, candle, flawless }, elapsed }
export function recordClear(store, result) {
  const next = normalize(store);
  const idx = levelIndexOr(result.levelIndex);
  if (idx < 0 || idx >= LEVEL_COUNT) return next;

  const prev = next.progress.seals[idx] ?? { clear: false, candle: false, flawless: false };
  const inc = normalizeSeal(result.seal ?? { clear: true }) ?? {
    clear: true, candle: false, flawless: false
  };

  // 印章只增不减：一旦点亮永久保留
  next.progress.seals[idx] = {
    clear: prev.clear || inc.clear,
    candle: prev.candle || inc.candle,
    flawless: prev.flawless || inc.flawless
  };

  const time = finite(result.elapsed);
  if (time !== null) {
    const before = next.progress.bestTime[idx];
    if (before === undefined || time < before) next.progress.bestTime[idx] = time;
  }

  // 解锁：通关第 N 关则开放第 N+1 关；通关最后一关则视为全部解锁完毕
  next.progress.unlocked = Math.min(
    LEVEL_COUNT,
    Math.max(next.progress.unlocked, idx + 2)
  );
  return next;
}

// 记录本关死亡（用于恶魔账本与状态栏翻轴）
export function recordDeath(store, levelIndex, count = 1) {
  const next = normalize(store);
  const idx = levelIndexOr(levelIndex);
  const n = int(count, 0);
  if (idx < 0 || idx >= LEVEL_COUNT || n <= 0) return next;
  next.progress.deaths[idx] = (next.progress.deaths[idx] ?? 0) + n;
  next.progress.totalDeaths += n;
  return next;
}

export function getSeal(store, levelIndex) {
  const prog = normalize(store).progress;
  return prog.seals[levelIndexOr(levelIndex)] ?? { clear: false, candle: false, flawless: false };
}

export function getBestTime(store, levelIndex) {
  const v = normalize(store).progress.bestTime[levelIndexOr(levelIndex)];
  return v === undefined ? null : v;
}

export function getDeaths(store, levelIndex) {
  return normalize(store).progress.deaths[levelIndexOr(levelIndex)] ?? 0;
}

export function getTotalDeaths(store) {
  return normalize(store).progress.totalDeaths;
}

// ---- 派生统计 ----

// 某节点的印章盘点：{ clear, candle, flawless, total, perfect }
export function nodeSeals(store, node) {
  const prog = normalize(store).progress;
  const sums = { clear: 0, candle: 0, flawless: 0 };
  let total = 0;
  for (let i = node.from; i <= node.to; i++) {
    const s = prog.seals[i];
    if (!s) { total++; continue; }
    if (s.clear) sums.clear++;
    if (s.candle) sums.candle++;
    if (s.flawless) sums.flawless++;
    total++;
  }
  return { ...sums, total, perfect: sums.flawless === total && total > 0 };
}

// 全站印章总览
export function overallSeals(store) {
  const prog = normalize(store).progress;
  let clear = 0, candle = 0, flawless = 0;
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const s = prog.seals[i];
    if (!s) continue;
    if (s.clear) clear++;
    if (s.candle) candle++;
    if (s.flawless) flawless++;
  }
  return { clear, candle, flawless, total: LEVEL_COUNT };
}

export function isNodeUnlocked(store, node) {
  return node.from < normalize(store).progress.unlocked;
}

export function isLevelUnlocked(store, levelIndex) {
  return int(levelIndex, 0) < normalize(store).progress.unlocked;
}

export { LEVEL_COUNT, NODES };
