// Independent verifier for the shipped puzzles. Test-only, pure, DOM-free.
//
// Rules mirror the live engine: locked cells are pre-filled, rack is a reusable
// SET of allowed characters (not consumable), every entry must be a lexicon word,
// and crossing cells must agree.
//
// A crossword is clue-driven: the clue is part of the puzzle, so the correct
// uniqueness domain is "every word in the full lexicon whose clue matches",
// not "every word of the same length". Both enumerators are exposed:
//   countCluedSolutions  -> proof of uniqueness under the printed clues
//   countSolutions       -> stricter diagnostic that ignores clues

import { FACTIONS_ZH } from "../js/zh.data.mjs";
import { FACTIONS_EN } from "../js/en.data.mjs";

export function allEntries(lang) {
  const factions = lang === "en" ? FACTIONS_EN : FACTIONS_ZH;
  return factions.flatMap((faction) => faction.entries.map((entry) => ({ ...entry, boardId: faction.boardId })));
}

export function wordOf(entry, lang) {
  return lang === "en" ? entry.en : entry.zh;
}

export function lexiconFor(lang) {
  return [...new Set(allEntries(lang).map((entry) => wordOf(entry, lang)).filter(Boolean))];
}

// Mirrors clueFor() in js/puzzles.mjs so verification is independent but identical.
export function clueFor(entry, lang, levelIndex) {
  if (lang === "en") {
    const base = `${entry.enDef} (${entry.en.length})`;
    if (levelIndex > 2) return base;
    return `${entry.enDef} (${entry.en.length}, starts with ${entry.en[0]})`;
  }
  if (levelIndex > 2) return entry.zhDef;
  return `${entry.zhDef} ${entry.zhStory}`;
}

export function clueDomains(puzzle, lang) {
  const byClue = new Map();
  for (const entry of allEntries(lang)) {
    const clue = clueFor(entry, lang, puzzle.levelIndex);
    if (!byClue.has(clue)) byClue.set(clue, []);
    const word = wordOf(entry, lang);
    if (!byClue.get(clue).includes(word)) byClue.get(clue).push(word);
  }
  return puzzle.entries.map((entry) => byClue.get(entry.clue) ?? []);
}

export function puzzleToLevel(puzzle) {
  const index = new Map(puzzle.cells.map((cell, idx) => [`${cell.r},${cell.c}`, idx]));
  const givens = [];
  puzzle.cells.forEach((cell, idx) => { if (cell.locked) givens.push(idx); });
  const slots = puzzle.entries.map((entry) => {
    const cells = [];
    for (let k = 0; k < entry.len; k += 1) {
      const r = entry.row + (entry.dir === "down" ? k : 0);
      const c = entry.col + (entry.dir === "across" ? k : 0);
      cells.push(index.get(`${r},${c}`));
    }
    return { id: `e${entry.index}`, dir: entry.dir, len: entry.len, cells };
  });
  return {
    cells: puzzle.cells.map((cell) => ({ r: cell.r, c: cell.c, ch: cell.answer })),
    slots,
    givens,
    rack: [...puzzle.rack],
  };
}

// Returns min(number of solutions, limit). `domains` optionally restricts the
// candidate words per slot (array parallel to slots).
export function countSolutions(puzzle, lexicon, limit = 2, domains = null) {
  const level = puzzle.cells && puzzle.slots ? puzzle : puzzleToLevel(puzzle);
  const { cells, slots, givens, rack } = level;
  if (!slots.length) return 0;
  if (slots.some((slot) => slot.cells.some((idx) => idx === undefined))) return 0;

  const givenSet = new Set(givens);
  const allowed = new Set(rack);
  const byLen = new Map();
  for (const text of new Set(lexicon)) {
    const chars = Array.from(text);
    if (!byLen.has(chars.length)) byLen.set(chars.length, []);
    byLen.get(chars.length).push(chars);
  }
  const pool = new Map();
  slots.forEach((slot, i) => {
    const source = domains ? domains[i].map((text) => Array.from(text)) : (byLen.get(slot.len) ?? []);
    const words = source
      .filter((chars) => chars.length === slot.len)
      .filter((chars) => chars.every((ch, k) => {
        const idx = slot.cells[k];
        if (givenSet.has(idx)) return ch === cells[idx].ch;
        return allowed.has(ch);
      }));
    pool.set(slot.id, words);
  });

  const grid = new Map();
  for (const idx of givens) grid.set(idx, cells[idx].ch);
  const assigned = new Set();
  let found = 0;

  function candidatesFor(slot) {
    return pool.get(slot.id).filter((chars) => chars.every((ch, k) => {
      const cur = grid.get(slot.cells[k]);
      return cur === undefined || cur === ch;
    }));
  }

  function search() {
    if (found >= limit) return;
    if (assigned.size === slots.length) {
      if (grid.size === cells.length) found += 1;
      return;
    }
    let best = null;
    let bestList = null;
    for (const slot of slots) {
      if (assigned.has(slot.id)) continue;
      const list = candidatesFor(slot);
      if (bestList === null || list.length < bestList.length) {
        best = slot;
        bestList = list;
        if (list.length === 0) break;
      }
    }
    if (!best || bestList.length === 0) return;
    for (const chars of bestList) {
      const added = [];
      for (let k = 0; k < best.cells.length; k += 1) {
        const idx = best.cells[k];
        if (!grid.has(idx)) {
          grid.set(idx, chars[k]);
          added.push(idx);
        }
      }
      assigned.add(best.id);
      search();
      assigned.delete(best.id);
      for (const idx of added) grid.delete(idx);
      if (found >= limit) return;
    }
  }

  search();
  return found;
}

export function countCluedSolutions(puzzle, lang, limit = 2) {
  return countSolutions(puzzle, lexiconFor(lang), limit, clueDomains(puzzle, lang));
}

export function verifyPuzzle(puzzle, lang) {
  const issues = [];
  const lexicon = new Set(lexiconFor(lang));
  const cellByKey = new Map(puzzle.cells.map((cell) => [`${cell.r},${cell.c}`, cell]));
  const rack = new Set(puzzle.rack);
  const covered = new Set();

  puzzle.entries.forEach((entry, i) => {
    const chars = Array.from(entry.answer);
    if (!lexicon.has(entry.answer)) issues.push(`entry${i}: answer not in lexicon`);
    if (chars.length !== entry.len) issues.push(`entry${i}: len mismatch`);
    for (let k = 0; k < entry.len; k += 1) {
      const r = entry.row + (entry.dir === "down" ? k : 0);
      const c = entry.col + (entry.dir === "across" ? k : 0);
      const key = `${r},${c}`;
      const cell = cellByKey.get(key);
      if (!cell) issues.push(`entry${i}: missing cell ${key}`);
      else {
        covered.add(key);
        if (cell.answer !== chars[k]) issues.push(`entry${i}: crossing mismatch at ${key}`);
      }
    }
  });

  puzzle.cells.forEach((cell) => {
    const key = `${cell.r},${cell.c}`;
    if (!covered.has(key)) issues.push(`orphan cell ${key}`);
    if (!cell.locked && !rack.has(cell.answer)) issues.push(`unfillable cell ${key}`);
  });

  clueDomains(puzzle, lang).forEach((domain, i) => {
    if (domain.length !== 1 || domain[0] !== puzzle.entries[i].answer) {
      issues.push(`entry${i}: clue not unique (${domain.length} candidates)`);
    }
  });

  return { ok: issues.length === 0, issues };
}
