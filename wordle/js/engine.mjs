// engine.mjs —— 规则唯一权威：纯函数、DOM-free。
// 依据 docs/plans/wordle-prd.md：Wordle 反馈算法（重复字配额制）、日期种子词、六行回合状态机。

export const TRACKS = { EN: "en", CN: "cn" };
export const MODES = { DAILY: "daily", PRACTICE: "practice", DUEL: "duel" };
export const STATUS = { PLAYING: "playing", WON: "won", LOST: "lost" };
export const FB = { CORRECT: "correct", PRESENT: "present", ABSENT: "absent" };
export const MAX_ROWS = 7;

import { EN_ANSWERS, EN_EXTRA, CN_IDIOMS, CN_EXTRA, CN_TRAY } from "./wordlists.mjs";

// ---------------------------------------------------------------- PRNG 与日期种子

// xmur3 风格字符串散列 -> uint32（对 YYYYMMDD 短串分布良好）
export function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

// mulberry32 确定性 PRNG：随机逻辑必须可注入种子重放
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 全站同日同题：以 UTC+8 日历日为准（平台用户主体在东八区，跨时区玩家当日一致）
export function dayKeyOf(now = new Date(), tzHours = 8) {
  const shifted = new Date(now.getTime() + tzHours * 3600e3);
  return shifted.toISOString().slice(0, 10).replaceAll("-", "");
}

// 上一日历日（连胜判定用），dayKey 形如 "20261018"
export function prevDayKey(dayKey) {
  const y = Number(dayKey.slice(0, 4));
  const m = Number(dayKey.slice(4, 6));
  const d = Number(dayKey.slice(6, 8));
  const t = new Date(Date.UTC(y, m - 1, d) - 86400e3);
  const p = String(t.getUTCFullYear()).padStart(4, "0") + String(t.getUTCMonth() + 1).padStart(2, "0") + String(t.getUTCDate()).padStart(2, "0");
  return p;
}

// 期号：自 2026-01-01（第 1 期）起的天数
export const ISSUE_EPOCH = "20260101";
export function issueNoOf(dayKey) {
  const y = Number(dayKey.slice(0, 4));
  const m = Number(dayKey.slice(4, 6));
  const d = Number(dayKey.slice(6, 8));
  const e = Date.UTC(2026, 0, 1);
  return Math.round((Date.UTC(y, m - 1, d) - e) / 86400e3) + 1;
}

// PRD 公式：mulberry32(hash(YYYYMMDD)) -> [0,1) -> floor * 词库长度 —— 全站同日同题
export function pickDaily(list, dayKey) {
  return list[Math.floor(mulberry32(hashString(dayKey))() * list.length)];
}

export function pickBySeed(list, seed) {
  return list[Math.floor(mulberry32(seed >>> 0)() * list.length)];
}

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

// ---------------------------------------------------------------- 词库合法性

export const EN_VALID = new Set([...EN_ANSWERS, ...EN_EXTRA]);
export const CN_VALID = new Set([...CN_IDIOMS, ...CN_EXTRA]);
export const CN_TRAY_CHARS = [...CN_TRAY];

export function isValidWord(track, word) {
  return track === TRACKS.CN ? CN_VALID.has(word) : EN_VALID.has(word);
}

export function isTrayChar(track, ch) {
  return track === TRACKS.CN ? CN_TRAY_CHARS.includes(ch) : /^[a-z]$/.test(ch);
}

export function randomAnswer(track, seed) {
  const list = track === TRACKS.CN ? CN_IDIOMS : EN_ANSWERS;
  return seed === undefined ? list[(Math.random() * list.length) | 0] : pickBySeed(list, seed);
}

// ---------------------------------------------------------------- 反馈算法（经典 Wordle 重复字配额制）

// guess/answer 均为等长字符数组；返回 FB 数组：correct（绿）> present（黄）> absent（灰）。
// 同一字母的 present 配额 = answer 中未被 correct 占用的出现次数（重复字不虚报）。
export function judge(guess, answer) {
  const n = answer.length;
  const result = new Array(n).fill(FB.ABSENT);
  const quota = new Map();
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) result[i] = FB.CORRECT;
    else quota.set(answer[i], (quota.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < n; i++) {
    if (result[i] === FB.CORRECT) continue;
    const left = quota.get(guess[i]) ?? 0;
    if (left > 0) {
      result[i] = FB.PRESENT;
      quota.set(guess[i], left - 1);
    }
  }
  return result;
}

// ---------------------------------------------------------------- 回合状态机

// round = { track, answer, answerChars, length, rows:[{guess,fb}], draft, status, hint }
// hint：本局提示揭示的答案字符（每局至多一次，null = 未用）
export function createRound({ track, answer }) {
  const answerChars = [...answer];
  if (answerChars.length !== 5 && answerChars.length !== 4) throw new Error("bad answer length");
  return { track, answer, answerChars, length: answerChars.length, rows: [], draft: [], status: STATUS.PLAYING, hint: null };
}

// 单字输入：终局 / 超长 / 非法字符一律拒绝（返回 false，调用方静默忽略）
export function typeChar(round, ch) {
  if (round.status !== STATUS.PLAYING) return false;
  if (typeof ch !== "string" || [...ch].length !== 1) return false;
  if (round.draft.length >= round.length) return false;
  if (round.track === TRACKS.EN && !/^[a-z]$/.test(ch)) return false;
  round.draft.push(ch);
  return true;
}

export function backspace(round) {
  if (round.status !== STATUS.PLAYING) return false;
  if (round.draft.length === 0) return false;
  round.draft.pop();
  return true;
}

export function canSubmit(round) {
  return round.status === STATUS.PLAYING && round.draft.length === round.length;
}

// 提交：词不在库 / 未满行 / 已终局 -> null（不消耗机会）；否则锁定一行并推进状态
export function submit(round) {
  if (!canSubmit(round)) return null;
  const word = round.draft.join("");
  if (!isValidWord(round.track, word)) return null;
  const guess = round.draft.slice();
  const fb = judge(guess, round.answerChars);
  const rowIndex = round.rows.length;
  round.rows.push({ guess, fb });
  round.draft = [];
  const won = fb.every((f) => f === FB.CORRECT);
  if (won) round.status = STATUS.WON;
  else if (round.rows.length >= MAX_ROWS) round.status = STATUS.LOST;
  return { guess, fb, rowIndex, status: round.status };
}

export function chancesLeft(round) {
  return Math.max(0, MAX_ROWS - round.rows.length);
}

// 提示：揭示答案中一个尚未变绿的字符（按位序取第一个未命中字）。
// 每局至多一次；终局 / 已用 / 全部命中 -> null。确定性选择，存档只需存字符本身。
export function useHint(round) {
  if (round.status !== STATUS.PLAYING) return null;
  if (round.hint) return null;
  const green = new Set();
  for (const row of round.rows) {
    for (let i = 0; i < row.guess.length; i++) {
      if (row.fb[i] === FB.CORRECT) green.add(row.guess[i]);
    }
  }
  const ch = round.answerChars.find((c) => !green.has(c));
  if (ch === undefined) return null;
  round.hint = ch;
  return ch;
}

// 键盘染色合并（多板共享键盘）：correct > present > absent
const FB_RANK = { [FB.CORRECT]: 3, [FB.PRESENT]: 2, [FB.ABSENT]: 1 };
export function keyStates(rounds) {
  const map = new Map();
  for (const round of rounds ?? []) {
    for (const row of round.rows) {
      for (let i = 0; i < row.guess.length; i++) {
        const ch = row.guess[i];
        const rank = FB_RANK[row.fb[i]];
        if ((map.get(ch) ?? 0) < rank) map.set(ch, rank);
      }
    }
  }
  return map;
}

// 从已提交词列重建回合（存档恢复：确定性重放，不存引擎内部态）；hint 随档恢复
export function replayRound({ track, answer, guesses, hint }) {
  const round = createRound({ track, answer });
  for (const word of guesses ?? []) {
    for (const ch of word) typeChar(round, ch);
    submit(round);
  }
  if (typeof hint === "string" && [...hint].length === 1 && round.answerChars.includes(hint)) round.hint = hint;
  return round;
}
