// Idiom Cross · standalone offline level generator (alternative 4x5 data route).
//   node scripts/idiom-offline/gen-idiom-levels.mjs
// Builds crossing grids with a seeded greedy+restart search, then proves each puzzle
// has exactly one solution by enumerating fillings against the FULL lexicon.
// Outputs stay inside this folder as ASCII-only files (Chinese escaped as \uXXXX).
// This tool is self-contained and does NOT touch games/idiom/.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ZH_BOARDS, ZH_IDIOMS } from "./idiom-lexicon-zh.mjs";
import { EN_BOARDS, EN_WORDS } from "./idiom-lexicon-en.mjs";

const outDir = resolve(import.meta.dirname);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Enumerate fillings where every slot is a lexicon word, crossings agree, and
// every non-given cell consumes one tile from the rack (a multiset with decoys).
function countSolutions(level, lexicon, limit = 2) {
  const { cells, slots, givens, tiles } = level;
  if (!slots.length) return 0;
  const givenSet = new Set(givens);
  const byLen = new Map();
  for (const text of new Set(lexicon)) {
    const chars = Array.from(text);
    if (!byLen.has(chars.length)) byLen.set(chars.length, []);
    byLen.get(chars.length).push(chars);
  }
  const pool = new Map();
  for (const slot of slots) pool.set(slot.id, (byLen.get(slot.len) ?? []).slice());

  const grid = new Map();
  for (const idx of givens) grid.set(idx, cells[idx].ch);
  const rack = new Map();
  for (const ch of tiles) rack.set(ch, (rack.get(ch) ?? 0) + 1);
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
    if (assigned.size === slots.length) { found += 1; return; }
    let best = null;
    let bestList = null;
    for (const slot of slots) {
      if (assigned.has(slot.id)) continue;
      const list = candidatesFor(slot);
      if (bestList === null || list.length < bestList.length) {
        best = slot; bestList = list;
        if (list.length === 0) break;
      }
    }
    if (!best || bestList.length === 0) return;
    for (const chars of bestList) {
      const added = [];
      const spent = [];
      let ok = true;
      for (let k = 0; k < best.cells.length; k += 1) {
        const idx = best.cells[k];
        const ch = chars[k];
        const cur = grid.get(idx);
        if (cur !== undefined) {
          if (cur !== ch) { ok = false; break; }
          continue;
        }
        if (!givenSet.has(idx)) {
          const left = rack.get(ch) ?? 0;
          if (left <= 0) { ok = false; break; }
          rack.set(ch, left - 1);
          spent.push(ch);
        }
        grid.set(idx, ch);
        added.push(idx);
      }
      if (ok) {
        assigned.add(best.id);
        search();
        assigned.delete(best.id);
      }
      for (const idx of added) grid.delete(idx);
      for (const ch of spent) rack.set(ch, (rack.get(ch) ?? 0) + 1);
      if (found >= limit) return;
    }
  }

  search();
  return found;
}

const LANGS = {
  zh: { boards: ZH_BOARDS, entries: ZH_IDIOMS },
  en: { boards: EN_BOARDS, entries: EN_WORDS },
};

const PLAN = [
  { words: 4, size: 5, decoys: 2, givenRatio: 0.34, clueMode: "full" },
  { words: 5, size: 6, decoys: 2, givenRatio: 0.28, clueMode: "full" },
  { words: 6, size: 7, decoys: 3, givenRatio: 0.16, clueMode: "definition" },
  { words: 7, size: 8, decoys: 3, givenRatio: 0.12, clueMode: "definition" },
  { words: 8, size: 9, decoys: 3, givenRatio: 0.1, clueMode: "definition" },
];

function key(r, c) { return `${r},${c}`; }

// A Chinese idiom crossword does not use letter-run word boundaries: slots are
// explicit (numbered clues), and only the shared crossing cells must agree.
// Therefore we require a crossing with a perpendicular word, forbid collinear
// overlap, and require at least one fresh cell - but no run-to-word matching.
function canPlace(grid, placements, size, entry, dir, r, c) {
  const text = entry.text;
  const chars = Array.from(text);
  const len = chars.length;
  if (r < 0 || c < 0) return null;
  if (dir === "across" && (r >= size || c + len > size)) return null;
  if (dir === "down" && (c >= size || r + len > size)) return null;

  const next = new Map(grid);
  const cells = [];
  const crossingCells = [];
  for (let k = 0; k < len; k += 1) {
    const rr = dir === "across" ? r : r + k;
    const cc = dir === "across" ? c + k : c;
    const cur = grid.get(key(rr, cc));
    if (cur !== undefined) {
      if (cur !== chars[k]) return null;
      crossingCells.push([rr, cc]);
    } else {
      next.set(key(rr, cc), chars[k]);
    }
    cells.push([rr, cc]);
  }
  if (crossingCells.length === 0 || crossingCells.length === len) return null;

  let perpendicular = false;
  for (const [rr, cc] of crossingCells) {
    for (const p of placements) {
      if (p.dir !== dir && p.cells.some(([pr, pc]) => pr === rr && pc === cc)) {
        perpendicular = true;
        break;
      }
    }
    if (perpendicular) break;
  }
  if (!perpendicular) return null;

  const start = dir === "across" ? c : r;
  for (const p of placements) {
    if (p.dir !== dir) continue;
    if ((dir === "across" ? p.r : p.c) !== (dir === "across" ? r : c)) continue;
    const otherStart = dir === "across" ? p.c : p.r;
    if (start <= otherStart + p.text.length - 1 && otherStart <= start + len - 1) return null;
  }

  const placement = { entryId: entry.id, text, dir, r, c, cells };
  return { next, crossings: crossingCells.length, placement };
}

function buildGrid(pool, target, size, seed, allowPartial = false, preferredBoard = "") {
  const rng = mulberry32(seed);
  const byChar = new Map();
  pool.forEach((entry) => {
    Array.from(entry.text).forEach((ch, pos) => {
      if (!byChar.has(ch)) byChar.set(ch, []);
      byChar.get(ch).push({ entry, pos });
    });
  });

  const shuffled = pool
    .filter((entry) => entry.board === preferredBoard)
    .map((entry) => ({ entry, jitter: rng() }))
    .sort((a, b) => a.jitter - b.jitter);
  const first = shuffled.find(({ entry }) => Array.from(entry.text).length <= size);
  if (!first) return null;
  const firstLen = Array.from(first.entry.text).length;
  const r0 = Math.floor(size / 2);
  const c0 = Math.floor((size - firstLen) / 2);
  let grid = new Map();
  Array.from(first.entry.text).forEach((ch, k) => grid.set(key(r0, c0 + k), ch));
  let placements = [{
    entryId: first.entry.id,
    text: first.entry.text,
    dir: "across",
    r: r0,
    c: c0,
    cells: Array.from(first.entry.text).map((_, k) => [r0, c0 + k]),
  }];
  const used = new Set([first.entry.id]);

  while (placements.length < target) {
    const candidates = [];
    const seen = new Set();
    for (const [cellKey, ch] of grid) {
      const [ar, ac] = cellKey.split(",").map(Number);
      for (const { entry, pos } of byChar.get(ch) ?? []) {
        if (used.has(entry.id)) continue;
        for (const dir of ["across", "down"]) {
          const r = dir === "across" ? ar : ar - pos;
          const c = dir === "across" ? ac - pos : ac;
          const tag = `${entry.id}/${dir}/${r}/${c}`;
          if (seen.has(tag)) continue;
          seen.add(tag);
          const result = canPlace(grid, placements, size, entry, dir, r, c);
          if (result) {
            const theme = entry.board === preferredBoard ? 1.6 : 0;
            candidates.push({ ...result, entry, dir, r, c, theme, jitter: rng() });
          }
        }
      }
    }
    if (!candidates.length) return allowPartial ? { grid, placements } : null;
    candidates.sort((a, b) => (b.crossings + b.theme + b.jitter) - (a.crossings + a.theme + a.jitter));
    const chosen = candidates[0];
    grid = chosen.next;
    placements = [...placements, chosen.placement];
    used.add(chosen.entry.id);
  }
  return { grid, placements };
}

function cellCrossCount(cellList, slots) {
  return cellList.map((_, idx) => slots.filter((slot) => slot.cells.includes(idx)).length);
}

function buildTiles(cellList, givens, decoys, seed) {
  const givenSet = new Set(givens);
  const needed = cellList.filter((_, idx) => !givenSet.has(idx)).map((cell) => cell.ch);
  const rack = needed.concat(decoys);
  const rng = mulberry32(seed ^ 0x5bf03635);
  for (let i = rack.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [rack[i], rack[j]] = [rack[j], rack[i]];
  }
  return rack;
}

function makeLevel(lang, boardIndex, levelIndex, plan) {
  const { boards, entries } = LANGS[lang];
  const board = boards[boardIndex];
  const pool = entries;
  const boardOf = new Map(entries.map((entry) => [entry.id, entry.board]));
  const lexicon = entries.map((entry) => entry.text);
  const allChars = [...new Set(entries.flatMap((entry) => Array.from(entry.text)))];

  const stats = { gridFail: 0, decoyFail: 0, uniqueFail: 0, givenCap: 0, themeFail: 0 };
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const seed = 7919 + boardIndex * 10007 + levelIndex * 1009 + attempt * 37;
    const built = buildGrid(pool, plan.words, plan.size, seed, false, board.id);
    if (!built) { stats.gridFail += 1; continue; }

    const cellList = [...built.grid.entries()]
      .map(([cellKey, ch]) => {
        const [r, c] = cellKey.split(",").map(Number);
        return { r, c, ch };
      })
      .sort((a, b) => a.r - b.r || a.c - b.c);
    const index = new Map(cellList.map((cell, idx) => [key(cell.r, cell.c), idx]));
    const slots = built.placements.map((p, i) => ({
      id: `s${i}`,
      dir: p.dir,
      r: p.r,
      c: p.c,
      len: Array.from(p.text).length,
      entryId: p.entryId,
      cells: p.cells.map(([r, c]) => index.get(key(r, c))),
    }));
    const themeCount = slots.filter((slot) => boardOf.get(slot.entryId) === board.id).length;
    if (themeCount < Math.ceil(plan.words * 0.6)) { stats.themeFail += 1; continue; }

    const rng = mulberry32(seed ^ 0x1b873593);
    const answerChars = new Set(cellList.map((cell) => cell.ch));
    const decoyPool = allChars.filter((ch) => !answerChars.has(ch));
    const decoys = decoyPool
      .map((ch) => ({ ch, jitter: rng() }))
      .sort((a, b) => a.jitter - b.jitter)
      .slice(0, plan.decoys)
      .map((item) => item.ch);
    if (decoys.length < plan.decoys) { stats.decoyFail += 1; continue; }

    const crossCount = cellCrossCount(cellList, slots);
    const order = cellList
      .map((_, idx) => ({ idx, weight: crossCount[idx] * 10 + rng() }))
      .sort((a, b) => b.weight - a.weight)
      .map((item) => item.idx);
    let givens = order.slice(0, Math.max(1, Math.round(cellList.length * plan.givenRatio))).sort((a, b) => a - b);
    const maxGivens = Math.floor(cellList.length * 0.55);

    for (let step = 0; step <= cellList.length; step += 1) {
      const tiles = buildTiles(cellList, givens, decoys, seed);
      const level = { cells: cellList, slots, givens, tiles, size: plan.size };
      if (countSolutions(level, lexicon, 2) === 1) {
        return {
          id: `${lang}_${boardIndex + 1}_${levelIndex + 1}`,
          board: board.id,
          boardIndex,
          index: levelIndex + 1,
          size: plan.size,
          clueMode: plan.clueMode,
          cells: cellList,
          slots,
          givens,
          tiles,
        };
      }
      if (givens.length >= maxGivens) { stats.givenCap += 1; break; }
      const next = order.find((idx) => !givens.includes(idx));
      if (next === undefined) { stats.uniqueFail += 1; break; }
      givens = [...givens, next].sort((a, b) => a - b);
    }
    stats.uniqueFail += 1;
  }
  throw new Error(`cannot build ${lang} board ${boardIndex + 1} level ${levelIndex + 1}: ${JSON.stringify(stats)}`);
}

function esc(str) {
  let out = '"';
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp === 0x22) out += '\\"';
    else if (cp === 0x5c) out += "\\\\";
    else if (cp === 0x0a) out += "\\n";
    else if (cp < 0x20 || cp > 0x7e) {
      if (cp <= 0xffff) out += `\\u${cp.toString(16).padStart(4, "0")}`;
      else {
        const v = cp - 0x10000;
        out += `\\u${(0xd800 + (v >> 10)).toString(16)}\\u${(0xdc00 + (v & 0x3ff)).toString(16)}`;
      }
    } else out += ch;
  }
  return `${out}"`;
}

function entryLine(id, obj, lang) {
  const fields = lang === "zh"
    ? `t:${esc(obj.text)},d:${esc(obj.def)},s:${esc(obj.source)},st:${esc(obj.story)},e:${esc(obj.example)},b:${esc(obj.board)}`
    : `t:${esc(obj.text)},d:${esc(obj.def)},o:${esc(obj.origin)},e:${esc(obj.example)},b:${esc(obj.board)}`;
  return `  ${esc(id)}: { ${fields} },`;
}

function writeData(lang) {
  const { boards, entries } = LANGS[lang];
  const prefix = lang === "zh" ? "ZH" : "EN";
  const lines = [
    `// GENERATED by scripts/gen-idiom-levels.mjs - do not edit by hand.`,
    `// ${lang} lexicon. All Chinese text is \\uXXXX escaped so game source stays ASCII-only.`,
    `export const ${prefix}_BOARDS = [`,
    ...boards.map((board) => `  { id: ${esc(board.id)}, name: ${esc(board.name)} },`),
    `];`,
    ``,
    `export const ${prefix}_ENTRIES = {`,
    ...entries.map((entry) => entryLine(entry.id, entry, lang)),
    `};`,
    ``,
    `export const ${prefix}_LEXICON = Object.values(${prefix}_ENTRIES).map((entry) => entry.t);`,
    ``,
  ];
  writeFileSync(resolve(outDir, `data-${lang}.mjs`), lines.join("\n"), "utf8");
}

function levelLiteral(level, lang) {
  const q = lang === "zh" ? esc : JSON.stringify;
  return [
    `    { id: ${JSON.stringify(level.id)}, board: ${JSON.stringify(level.board)}, boardIndex: ${level.boardIndex}, index: ${level.index}, size: ${level.size}, clueMode: ${JSON.stringify(level.clueMode)},`,
    `      cells: [${level.cells.map((cell) => `[${cell.r},${cell.c},${q(cell.ch)}]`).join(",")}],`,
    `      slots: [${level.slots.map((slot) => `[${JSON.stringify(slot.id)},${JSON.stringify(slot.dir)},${slot.r},${slot.c},${slot.len},${JSON.stringify(slot.entryId)},[${slot.cells.join(",")}]]`).join(",")}],`,
    `      givens: [${level.givens.join(",")}], tiles: [${level.tiles.map(q).join(",")}] },`,
  ].join("\n");
}

function writeLevels(levels) {
  const lines = [
    `// GENERATED by scripts/gen-idiom-levels.mjs - do not edit by hand.`,
    `// Every puzzle is proven to have exactly one solution (see tests/levels.test.mjs).`,
    `const RAW = {`,
    `  zh: [`,
    ...levels.zh.map((level) => levelLiteral(level, "zh")),
    `  ],`,
    `  en: [`,
    ...levels.en.map((level) => levelLiteral(level, "en")),
    `  ],`,
    `};`,
    ``,
    `function expand(raw) {`,
    `  return {`,
    `    id: raw.id, board: raw.board, boardIndex: raw.boardIndex, index: raw.index,`,
    `    size: raw.size, clueMode: raw.clueMode, givens: raw.givens.slice(), tiles: raw.tiles.slice(),`,
    `    cells: raw.cells.map(([r, c, ch]) => ({ r, c, ch })),`,
    `    slots: raw.slots.map(([id, dir, r, c, len, entryId, cells]) => ({ id, dir, r, c, len, entryId, cells: cells.slice() })),`,
    `  };`,
    `}`,
    ``,
    `export const LEVELS = { zh: RAW.zh.map(expand), en: RAW.en.map(expand) };`,
    `export const BOARD_COUNT = 4;`,
    `export const LEVELS_PER_BOARD = 5;`,
    `export function getLevel(lang, boardIndex, index) {`,
    `  return LEVELS[lang].find((level) => level.boardIndex === boardIndex && level.index === index) ?? null;`,
    `}`,
    ``,
  ];
  writeFileSync(resolve(outDir, "levels.mjs"), lines.join("\n"), "utf8");
}

if (process.argv.includes("--probe")) {
  for (const lang of ["zh", "en"]) {
    const { boards, entries } = LANGS[lang];
    for (let boardIndex = 0; boardIndex < boards.length; boardIndex += 1) {
      const row = [];
      for (let size = 5; size <= 12; size += 1) {
        let best = 0;
        for (let s = 0; s < 30; s += 1) {
          const built = buildGrid(entries, 10, size, 1000 + s * 37, true, boards[boardIndex].id);
          if (built) best = Math.max(best, built.placements.length);
        }
        row.push(`${size}:${best}`);
      }
      console.log(`${lang} board${boardIndex + 1} ${row.join(" ")}`);
    }
  }
  process.exit(0);
}

const levels = { zh: [], en: [] };
for (const lang of ["zh", "en"]) {
  for (let boardIndex = 0; boardIndex < 4; boardIndex += 1) {
    for (let levelIndex = 0; levelIndex < PLAN.length; levelIndex += 1) {
      const level = makeLevel(lang, boardIndex, levelIndex, PLAN[levelIndex]);
      levels[lang].push(level);
      console.log(
        `${lang} ${level.id.padEnd(10)} size=${level.size} words=${level.slots.length}`
        + ` cells=${level.cells.length} givens=${level.givens.length} tiles=${level.tiles.length}`,
      );
    }
  }
  writeData(lang);
}
writeLevels(levels);
console.log(`\nwrote data-zh.mjs, data-en.mjs, levels.mjs (${levels.zh.length + levels.en.length} levels)`);
