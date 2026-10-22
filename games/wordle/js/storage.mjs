// storage.mjs —— 存档唯一口径（Key: doin.wordle.v1）。
// localStorage 不可用或数据损坏时静默降级内存；读取必须 normalize 归一化校验。

import { prevDayKey, MAX_ROWS } from "./engine.mjs";

const KEY = "doin.wordle.v1";
const memory = { ok: true, data: null };

function freshStats() {
  return { played: 0, wins: 0, dist: Array(MAX_ROWS).fill(0), streak: 0, maxStreak: 0, lastDay: "" };
}
function freshTrackState() {
  return {
    stats: freshStats(),
    daily: null, // { day, guesses:[], won: null|bool, recorded }
    practice: { count: 0, wins: 0, best: 0 },
    duelTally: { a: 0, b: 0, draw: 0 },
    duelState: null, // { day, players:[[],[]], active, done, winner }
  };
}
export function defaults() {
  return { v: 1, muted: false, track: "en", mode: "daily", en: freshTrackState(), cn: freshTrackState() };
}

// 归一化：任何字段损坏/缺失都回落到合法默认值，绝不白屏
export function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== "object") return d;
  if (raw.v !== 1) return d;
  d.muted = raw.muted === true;
  d.track = raw.track === "cn" ? "cn" : "en";
  d.mode = ["daily", "practice", "duel"].includes(raw.mode) ? raw.mode : "daily";
  for (const tk of ["en", "cn"]) {
    const src = raw[tk];
    if (!src || typeof src !== "object") continue;
    if (src.stats && typeof src.stats === "object") {
      const s = src.stats;
      d[tk].stats = {
        played: intOf(s.played, 0, 1e9),
        wins: intOf(s.wins, 0, 1e9),
        dist: Array.from({ length: MAX_ROWS }, (_, i) => intOf(Array.isArray(s.dist) ? s.dist[i] : 0, 0, 1e9)),
        streak: intOf(s.streak, 0, 1e9),
        maxStreak: intOf(s.maxStreak, 0, 1e9),
        lastDay: str8(s.lastDay),
      };
    }
    const dl = src.daily;
    if (dl && typeof dl === "object" && str8(dl.day)) {
      d[tk].daily = {
        day: str8(dl.day),
        guesses: Array.isArray(dl.guesses) ? dl.guesses.filter((g) => typeof g === "string").slice(0, MAX_ROWS) : [],
        hint: typeof dl.hint === "string" && [...dl.hint].length === 1 ? dl.hint : null,
        won: typeof dl.won === "boolean" ? dl.won : null,
        recorded: dl.recorded === true,
      };
    }
    const p = src.practice;
    if (p && typeof p === "object") {
      d[tk].practice = { count: intOf(p.count, 0, 1e9), wins: intOf(p.wins, 0, 1e9), best: intOf(p.best, 0, MAX_ROWS) };
    }
    const t = src.duelTally;
    if (t && typeof t === "object") d[tk].duelTally = { a: intOf(t.a, 0, 1e9), b: intOf(t.b, 0, 1e9), draw: intOf(t.draw, 0, 1e9) };
    const du = src.duelState;
    if (du && typeof du === "object" && str8(du.day)) {
      d[tk].duelState = {
        day: str8(du.day),
        players: [0, 1].map((i) => (Array.isArray(du.players) && Array.isArray(du.players[i]) ? du.players[i].filter((g) => typeof g === "string").slice(0, MAX_ROWS) : [])),
        active: du.active === 1 ? 1 : 0,
        done: du.done === true,
        winner: typeof du.winner === "number" ? du.winner : null,
      };
    }
  }
  return d;
}

function intOf(v, min, max) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
function str8(v) {
  return typeof v === "string" && /^\d{8}$/.test(v) ? v : "";
}

function readRaw() {
  if (!memory.ok) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    memory.ok = false;
    return null;
  }
}
function writeRaw(data) {
  if (!memory.ok) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    memory.ok = false;
  }
}

export function load() {
  if (!memory.data) memory.data = normalize(readRaw());
  return memory.data;
}
export function save(data) {
  memory.data = data;
  writeRaw(data);
}

// ---------------------------------------------------------------- 统计口径（唯一计分处）

// 每日结算（每日一轨至多一次，recorded 幂等护栏）
export function recordDaily(data, track, dayKey, won, guesses) {
  const st = data[track];
  const daily = st.daily;
  if (!daily || daily.day !== dayKey || daily.recorded) return false;
  daily.recorded = true;
  daily.won = won;
  const s = st.stats;
  s.played += 1;
  if (won) {
    s.wins += 1;
    const row = Math.min(MAX_ROWS - 1, Math.max(0, guesses - 1));
    s.dist[row] += 1;
    s.streak = s.lastDay === prevDayKey(dayKey) && s.streak > 0 ? s.streak + 1 : 1;
    if (s.streak > s.maxStreak) s.maxStreak = s.streak;
  } else {
    s.streak = 0;
  }
  s.lastDay = dayKey;
  return true;
}

// 每日进行中进度：只接受当日或更旧日子的槽位被覆盖（禁未来日回填），day 不符的旧档由 restoreDaily 的 day 校验兜底
export function saveDailyProgress(data, track, dayKey, guesses, hint = null) {
  const st = data[track];
  const daily = st.daily;
  if (daily && daily.day > dayKey) return false;
  st.daily = { day: dayKey, guesses: guesses.slice(0, MAX_ROWS), hint: typeof hint === "string" ? hint : null, won: null, recorded: false };
  return true;
}
export function clearDaily(data, track) {
  data[track].daily = null;
}

export function recordPractice(data, track, won, guesses) {
  const p = data[track].practice;
  p.count += 1;
  if (won) {
    p.wins += 1;
    p.best = p.best === 0 ? guesses : Math.min(p.best, guesses);
  }
}

export function recordDuel(data, track, winner) {
  const t = data[track].duelTally;
  if (winner === 0) t.a += 1;
  else if (winner === 1) t.b += 1;
  else t.draw += 1;
}

export function saveDuelState(data, track, state) {
  data[track].duelState = {
    day: state.day,
    players: state.players.map((g) => g.slice(0, MAX_ROWS)),
    active: state.active,
    done: state.done,
    winner: state.winner,
  };
}
export function clearDuelState(data, track) {
  data[track].duelState = null;
}
