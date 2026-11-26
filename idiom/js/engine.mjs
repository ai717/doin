// 填字规则唯一权威：纯函数、DOM-free、可脱离浏览器运行。
import { HINTS_PER_LEVEL } from "./boards.mjs";
import { starsFor } from "./score.mjs";

export const STATUS = {
  PLAYING: "playing",
  CLEARED: "cleared",
};

const keyOf = (r, c) => `${r},${c}`;

function pushEvent(state, event) {
  state.events.push(event);
}

function cell(state, r, c) {
  return state.cells.get(keyOf(r, c)) ?? null;
}

function entryCells(state, entry) {
  const keys = [];
  for (let i = 0; i < entry.len; i += 1) {
    const r = entry.row + (entry.dir === "down" ? i : 0);
    const c = entry.col + (entry.dir === "across" ? i : 0);
    keys.push(keyOf(r, c));
  }
  return keys;
}

function isEntrySolved(state, entry) {
  return entryKeys(state, entry).every((key) => {
    const target = state.cells.get(key);
    return target && target.value === target.answer;
  });
}

const entryKeysCache = new WeakMap();
function entryKeys(state, entry) {
  let map = entryKeysCache.get(state);
  if (!map) {
    map = new Map();
    entryKeysCache.set(state, map);
  }
  if (!map.has(entry)) map.set(entry, entryCells(state, entry));
  return map.get(entry);
}

function refreshEntries(state) {
  state.entries.forEach((entry, index) => {
    const solved = isEntrySolved(state, entry);
    if (solved && !entry.solved) {
      entry.solved = true;
      pushEvent(state, { type: "word", index, entryId: entry.entryId, dir: entry.dir, answer: entry.answer });
    } else if (!solved) {
      entry.solved = false;
    }
  });
}

function firstEmptyInEntry(state, entry) {
  for (const key of entryKeys(state, entry)) {
    const target = state.cells.get(key);
    if (target && target.value !== target.answer) return key;
  }
  return entryKeys(state, entry)[0] ?? null;
}

function selectEntryInternal(state, index, preferredKey = null) {
  const entry = state.entries[index];
  if (!entry) return null;
  const keys = entryKeys(state, entry);
  const key = preferredKey && keys.includes(preferredKey) ? preferredKey : firstEmptyInEntry(state, entry);
  if (!key) return null;
  state.selected = { entryIndex: index, cellKey: key, dir: entry.dir };
  return state.selected;
}

function nextUnsolvedEntry(state, fromIndex) {
  const total = state.entries.length;
  for (let offset = 1; offset <= total; offset += 1) {
    const index = (fromIndex + offset) % total;
    if (!state.entries[index].solved) return index;
  }
  return -1;
}

function checkCleared(state) {
  if (state.status !== STATUS.PLAYING) return false;
  const done = state.entries.every((entry) => entry.solved);
  if (!done) return false;
  state.status = STATUS.CLEARED;
  state.stars = starsFor(state.hintsUsed);
  pushEvent(state, { type: "cleared", stars: state.stars, hintsUsed: state.hintsUsed });
  return true;
}

export function createSession({ puzzle, hintsLeft = HINTS_PER_LEVEL, elapsed = 0 } = {}) {
  const cells = new Map();
  for (const item of puzzle.cells) {
    cells.set(keyOf(item.r, item.c), {
      r: item.r,
      c: item.c,
      answer: item.answer,
      value: item.locked ? item.answer : null,
      locked: Boolean(item.locked),
      uses: item.uses,
    });
  }
  const state = {
    puzzle,
    rows: puzzle.rows,
    cols: puzzle.cols,
    cells,
    entries: puzzle.entries.map((entry) => ({ ...entry, solved: false })),
    rack: puzzle.rack,
    hintsLeft,
    hintsUsed: 0,
    status: STATUS.PLAYING,
    stars: 0,
    elapsed,
    selected: null,
    events: [],
  };
  for (const entry of state.entries) {
    entry.solved = isEntrySolved(state, entry);
  }
  const first = nextUnsolvedEntry(state, state.entries.length - 1);
  if (first >= 0) selectEntryInternal(state, first);
  else checkCleared(state);
  return state;
}

export function selectCell(state, r, c) {
  if (!state || state.status !== STATUS.PLAYING) return { action: null, events: [] };
  const key = keyOf(r, c);
  if (!state.cells.has(key)) return { action: null, events: [] };
  const owners = state.entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entryKeys(state, entry).includes(key));
  if (!owners.length) return { action: null, events: [] };
  const current = state.selected;
  if (current && owners.length > 1) {
    const at = owners.findIndex((owner) => owner.index === current.entryIndex);
    if (at >= 0) {
      const next = owners[(at + 1) % owners.length];
      selectEntryInternal(state, next.index, key);
      return { action: "select", events: [] };
    }
  }
  const preferred = owners.find((owner) => !owner.entry.solved) ?? owners[0];
  selectEntryInternal(state, preferred.index, key);
  return { action: "select", events: [] };
}

export function selectEntry(state, index) {
  if (!state || state.status !== STATUS.PLAYING) return { action: null, events: [] };
  if (!state.entries[index]) return { action: null, events: [] };
  selectEntryInternal(state, index);
  return { action: "select", events: [] };
}

export function fillCell(state, char) {
  if (!state || state.status !== STATUS.PLAYING) return { action: null, events: [] };
  if (!state.selected) return { action: null, events: [] };
  const cellKey = state.selected.cellKey;
  const target = state.cells.get(cellKey);
  if (!target || target.locked) return { action: null, events: [] };
  if (target.value === target.answer) return { action: null, events: [] };
  const value = String(char ?? "");
  if (!value || !state.rack.includes(value)) return { action: null, events: [] };
  const start = state.events.length;
  const okay = value === target.answer;
  target.value = value;
  pushEvent(state, { type: okay ? "fill" : "wrong", r: target.r, c: target.c, char: value });
  refreshEntries(state);
  const entry = state.entries[state.selected.entryIndex];
  if (entry && !entry.solved) {
    const nextKey = entryKeys(state, entry).find((key) => {
      const item = state.cells.get(key);
      return item && item.value !== item.answer;
    });
    if (nextKey) state.selected = { entryIndex: state.selected.entryIndex, cellKey: nextKey, dir: entry.dir };
  }
  if (checkCleared(state)) return { action: "cleared", events: state.events.slice(start) };
  if (entry?.solved) {
    const next = nextUnsolvedEntry(state, state.selected.entryIndex);
    if (next >= 0) selectEntryInternal(state, next);
  }
  return { action: okay ? "fill" : "wrong", events: state.events.slice(start) };
}

export function eraseCell(state) {
  if (!state || state.status !== STATUS.PLAYING) return { action: null, events: [] };
  if (!state.selected) return { action: null, events: [] };
  const target = state.cells.get(state.selected.cellKey);
  if (!target || target.locked || target.value === null) return { action: null, events: [] };
  if (target.value === target.answer) return { action: null, events: [] };
  const start = state.events.length;
  target.value = null;
  pushEvent(state, { type: "erase", r: target.r, c: target.c });
  refreshEntries(state);
  return { action: "erase", events: state.events.slice(start) };
}

export function useHint(state) {
  if (!state || state.status !== STATUS.PLAYING) return { action: null, events: [] };
  if (state.hintsLeft <= 0) return { action: null, events: [] };
  const start = state.events.length;
  const candidates = [];
  if (state.selected) {
    const selectedCell = state.cells.get(state.selected.cellKey);
    if (selectedCell && selectedCell.value !== selectedCell.answer) candidates.push(selectedCell);
  }
  for (const entry of state.entries) {
    if (entry.solved) continue;
    for (const key of entryKeys(state, entry)) {
      const target = state.cells.get(key);
      if (target && target.value !== target.answer) candidates.push(target);
    }
  }
  if (!candidates.length) return { action: null, events: [] };
  const target = candidates[0];
  target.value = target.answer;
  target.locked = true;
  state.hintsLeft -= 1;
  state.hintsUsed += 1;
  pushEvent(state, { type: "hint", r: target.r, c: target.c, char: target.answer, hintsLeft: state.hintsLeft });
  refreshEntries(state);
  const entry = state.entries[state.selected?.entryIndex ?? 0];
  if (entry?.solved) {
    const next = nextUnsolvedEntry(state, state.selected?.entryIndex ?? 0);
    if (next >= 0) selectEntryInternal(state, next);
  }
  checkCleared(state);
  return { action: "hint", events: state.events.slice(start) };
}

export function tick(state, dtMs) {
  if (!state || state.status !== STATUS.PLAYING) return;
  const dt = Number(dtMs);
  if (!Number.isFinite(dt) || dt <= 0) return;
  state.elapsed += dt;
}

export function drainEvents(state) {
  if (!state) return [];
  const events = state.events.slice();
  state.events.length = 0;
  return events;
}

export function isTerminal(state) {
  return Boolean(state) && state.status === STATUS.CLEARED;
}

export function summarize(state) {
  const total = state.entries.length;
  const solved = state.entries.filter((entry) => entry.solved).length;
  return {
    lang: state.puzzle.lang,
    boardId: state.puzzle.boardId,
    levelIndex: state.puzzle.levelIndex,
    cleared: state.status === STATUS.CLEARED,
    stars: state.status === STATUS.CLEARED ? state.stars : 0,
    hintsUsed: state.hintsUsed,
    hintsLeft: state.hintsLeft,
    elapsed: Math.round(state.elapsed),
    solved,
    total,
  };
}

export function cellAt(state, r, c) {
  return cell(state, r, c);
}

export function entryAt(state, index) {
  return state.entries[index] ?? null;
}

export function selectedEntryIndex(state) {
  return state.selected?.entryIndex ?? -1;
}

export function selectedCellKey(state) {
  return state.selected?.cellKey ?? null;
}
