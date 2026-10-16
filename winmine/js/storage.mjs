// 本地持久化：难度偏好、静音偏好与各档"最快成绩榜"（前 N 名，带名字 + 日期）。
// localStorage 在隐私模式 / 禁用 Cookie 下会抛异常，这里统一降级到内存，
// 保证游戏永远能玩，只是关掉页面后不留痕。

export const STORAGE_KEY = "doin.winmine.v1";
export const SCHEMA_VERSION = 1;
export const MAX_RECORDS = 10; // 每档保留前 10 名

const DIFFICULTY_IDS = ["beginner", "intermediate", "expert"];

export function defaultRecords() {
  const o = {};
  for (const d of DIFFICULTY_IDS) o[d] = [];
  return o;
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { difficulty: "beginner", muted: false },
    records: defaultRecords(),
  };
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
      const probe = "__doin_wm__";
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

function pickDifficulty(value) {
  return DIFFICULTY_IDS.includes(value) ? value : "beginner";
}

function intTime(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.max(0, Math.trunc(n)) : fallback;
}

function normalizeName(value) {
  if (typeof value !== "string") return "";
  const name = value.trim().slice(0, 20);
  if (name.length === 0) return "";
  // 紧凑的日子字符串，用于成绩榜展示
  return name;
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const timeMs = intTime(raw.timeMs);
  if (timeMs == null) return null;
  return {
    name: normalizeName(raw.name),
    timeMs,
    date: typeof raw.date === "string" ? raw.date : "",
  };
}

function normalizeRecords(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const r of raw) {
    const rec = normalizeRecord(r);
    if (rec) out.push(rec);
  }
  // 去负去坏后按用时升序，截断到前 N 名
  out.sort((a, b) => a.timeMs - b.timeMs);
  return out.slice(0, MAX_RECORDS);
}

// 任何字段缺失或被手改坏都退回默认值，绝不把异常抛给 UI。
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const difficulty = pickDifficulty(prefs.difficulty);
  const muted = Boolean(prefs.muted);
  const records = defaultRecords();
  if (raw.records && typeof raw.records === "object") {
    for (const d of DIFFICULTY_IDS) records[d] = normalizeRecords(raw.records[d]);
  }
  return { version: SCHEMA_VERSION, prefs: { difficulty, muted }, records };
}

export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch (error) {
    return defaultState();
  }
}

export function save(state) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    return true;
  } catch (error) {
    return false;
  }
}

// 成绩榜操作（纯函数，不改动入参）。

// 该用时是否能进榜（比榜尾快，或榜未满）。
export function qualifies(records, timeMs) {
  const list = Array.isArray(records) ? records : [];
  if (list.length < MAX_RECORDS) return true;
  return timeMs < list[list.length - 1].timeMs;
}

// 插入一条成绩并返回插入后的名字（若未进榜则返回 null 表示无需弹名）。
export function recordResult(state, params = {}) {
  const difficulty = pickDifficulty(params.difficulty);
  const won = Boolean(params.won);
  const timeMs = intTime(params.timeMs);
  if (!won || timeMs == null) { return { state, isNewRecord: false }; }

  const list = Array.isArray(state.records?.[difficulty]) ? state.records[difficulty] : [];
  if (!qualifies(list, timeMs)) return { state, isNewRecord: false };

  const rec = normalizeRecord({
    name: params.name ?? "",
    timeMs,
    date: params.date ?? "",
  });
  const next = [...list, rec].sort((a, b) => a.timeMs - b.timeMs).slice(0, MAX_RECORDS);
  return {
    state: { ...state, records: { ...state.records, [difficulty]: next } },
    isNewRecord: true,
  };
}

// 某档的最快成绩（榜首），无记录返回 null。
export function bestRecord(state, difficulty) {
  const list = state.records?.[pickDifficulty(difficulty)];
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}