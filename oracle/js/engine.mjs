// Deterministic, DOM-free matching engine for Oracle Glyph Match.
// A level is a set of oracle glyphs paired with modern characters; the player links the two sides.

import { LEVELS, getLevel } from "./levels.mjs";
import { starsFor } from "./score.mjs";

export const PICK_LOCK = 0.12;
export const EVOLUTION_TIME = 2.4;
export const WRONG_TIME = 0.45;

function clampIndex(value, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(max, number));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

// Guarantee every oracle card sits opposite a different character card, so no pair lines up trivially.
function derangedOrder(source, rand) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const candidate = shuffle(source, rand);
    if (candidate.every((value, index) => value !== source[index])) return candidate;
  }
  if (source.length < 2) return [...source];
  return [...source.slice(1), source[0]];
}

function emit(session, type, data = {}) {
  session.events.push({ type, ...data });
}

function makeEvent(session, type, data = {}) {
  emit(session, type, data);
  return session.events[session.events.length - 1];
}

export function createSession(options = {}) {
  const levelIndex = clampIndex(options.levelIndex, LEVELS.length - 1);
  const level = getLevel(levelIndex);
  const seed = (options.seed ?? 9100 + levelIndex * 137) >>> 0;
  const rand = mulberry32(seed);
  const pairIndexes = level.glyphs.map((_, index) => index);
  const oracleOrder = shuffle(pairIndexes, rand);
  const charOrder = derangedOrder(oracleOrder, rand);
  return {
    levelIndex,
    levelId: level.id,
    chapterIndex: level.chapterIndex,
    chapterId: level.chapterId,
    levelInChapter: level.levelInChapter,
    seed,
    status: "playing",
    paused: false,
    pairs: [...level.glyphs],
    oracleOrder,
    charOrder,
    matches: [],
    selected: null,
    wrong: null,
    evolution: null,
    errors: 0,
    attempts: 0,
    time: 0,
    stars: 0,
    lock: 0,
    events: [],
  };
}

export function isPairMatched(session, pairIndex) {
  return session.matches.some((match) => match.pairIndex === pairIndex);
}

export function isCleared(session) {
  return Boolean(session) && session.status === "cleared";
}

function completeIfDone(session) {
  if (session.matches.length < session.pairs.length) return false;
  session.status = "cleared";
  session.paused = false;
  session.selected = null;
  session.stars = starsFor(session.errors);
  session.lock = 0;
  makeEvent(session, "clear", {
    stars: session.stars,
    errors: session.errors,
    time: session.time,
    levelIndex: session.levelIndex,
  });
  return true;
}

export function select(session, side, index) {
  if (!session || session.status !== "playing" || session.paused) return null;
  if (session.lock > 0) return null;
  if (side !== "oracle" && side !== "char") return null;
  const order = side === "oracle" ? session.oracleOrder : session.charOrder;
  const position = Math.floor(Number(index));
  if (!Number.isInteger(position) || position < 0 || position >= order.length) return null;
  const pairIndex = order[position];
  if (isPairMatched(session, pairIndex)) return null;

  if (!session.selected) {
    session.selected = { side, index: position };
    return makeEvent(session, "pick", { side, index: position, pairIndex });
  }

  if (session.selected.side === side) {
    if (session.selected.index === position) {
      session.selected = null;
      return makeEvent(session, "cancel", { side, index: position });
    }
    session.selected = { side, index: position };
    return makeEvent(session, "pick", { side, index: position, pairIndex });
  }

  const oracleIndex = side === "oracle" ? position : session.selected.index;
  const charIndex = side === "char" ? position : session.selected.index;
  const oraclePair = session.oracleOrder[oracleIndex];
  const charPair = session.charOrder[charIndex];
  session.selected = null;
  session.attempts += 1;
  session.lock = PICK_LOCK;

  if (oraclePair === charPair) {
    const match = { pairIndex: oraclePair, oracleIndex, charIndex, glyphId: session.pairs[oraclePair] };
    session.matches.push(match);
    session.evolution = { glyphId: match.glyphId, pairIndex: oraclePair, elapsed: 0, duration: EVOLUTION_TIME };
    makeEvent(session, "match", { ...match });
    completeIfDone(session);
    return session.events[session.events.length - 1];
  }

  session.errors += 1;
  session.wrong = { oracleIndex, charIndex, ttl: WRONG_TIME };
  return makeEvent(session, "mismatch", { oracleIndex, charIndex });
}

export function cancelSelection(session) {
  if (!session || !session.selected) return null;
  session.selected = null;
  return makeEvent(session, "cancel", {});
}

export function setPaused(session, paused) {
  if (!session || session.status !== "playing") return;
  session.paused = Boolean(paused);
}

export function togglePaused(session) {
  if (!session || session.status !== "playing") return;
  session.paused = !session.paused;
}

export function step(session, dt) {
  if (!session || session.paused || session.status !== "playing") return;
  const delta = Math.max(0, Math.min(0.25, Number(dt) || 0));
  session.time += delta;
  if (session.lock > 0) session.lock = Math.max(0, session.lock - delta);
  if (session.wrong) {
    session.wrong.ttl -= delta;
    if (session.wrong.ttl <= 0) session.wrong = null;
  }
  if (session.evolution) {
    session.evolution.elapsed += delta;
    if (session.evolution.elapsed >= session.evolution.duration) session.evolution = null;
  }
}

export function drainEvents(session) {
  if (!session) return [];
  const events = session.events;
  session.events = [];
  return events;
}

function addMatch(session, pairIndex) {
  if (isPairMatched(session, pairIndex)) return null;
  const oracleIndex = session.oracleOrder.indexOf(pairIndex);
  const charIndex = session.charOrder.indexOf(pairIndex);
  if (oracleIndex < 0 || charIndex < 0) return null;
  const match = { pairIndex, oracleIndex, charIndex, glyphId: session.pairs[pairIndex] };
  session.matches.push(match);
  session.selected = null;
  return match;
}

export function debugSolvePair(session, pairIndex) {
  if (!session || session.status !== "playing") return null;
  const index = Math.floor(Number(pairIndex));
  if (!Number.isInteger(index) || index < 0 || index >= session.pairs.length) return null;
  const match = addMatch(session, index);
  if (!match) return null;
  session.evolution = { glyphId: match.glyphId, pairIndex: index, elapsed: 0, duration: EVOLUTION_TIME };
  makeEvent(session, "match", { ...match });
  completeIfDone(session);
  return session.events[session.events.length - 1];
}

export function debugSolveAll(session) {
  if (!session || session.status !== "playing") return null;
  for (let pairIndex = 0; pairIndex < session.pairs.length; pairIndex += 1) {
    const match = addMatch(session, pairIndex);
    if (match) makeEvent(session, "match", { ...match });
  }
  session.selected = null;
  session.evolution = null;
  session.status = "cleared";
  session.stars = starsFor(session.errors);
  session.lock = 0;
  makeEvent(session, "clear", {
    stars: session.stars,
    errors: session.errors,
    time: session.time,
    levelIndex: session.levelIndex,
  });
  return session.events[session.events.length - 1];
}

export function snapshot(session) {
  return {
    levelIndex: session.levelIndex,
    levelId: session.levelId,
    chapterIndex: session.chapterIndex,
    chapterId: session.chapterId,
    levelInChapter: session.levelInChapter,
    pairCount: session.pairs.length,
    status: session.status,
    paused: session.paused,
    stars: session.stars,
    time: session.time,
    errors: session.errors,
    attempts: session.attempts,
    matched: session.matches.length,
    lock: session.lock,
    selected: session.selected ? { ...session.selected } : null,
    wrong: session.wrong ? { ...session.wrong } : null,
    evolution: session.evolution ? { ...session.evolution } : null,
    pairs: [...session.pairs],
    oracleOrder: [...session.oracleOrder],
    charOrder: [...session.charOrder],
    matches: session.matches.map((match) => ({ ...match })),
  };
}
