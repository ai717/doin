// 纵横网格生成器：从榜单词库逆向拼出交叉网格，确定性种子，100% 有解。
import { BOARDS, MIN_GRID, MAX_GRID_ZH, MAX_GRID_EN, ENTRIES_ZH, ENTRIES_EN, DISTRACTOR_COUNT } from "./boards.mjs";
import { FACTIONS_ZH } from "./zh.data.mjs";
import { FACTIONS_EN } from "./en.data.mjs";

const ZHCACHE = new Map();
const ENCACHE = new Map();

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffle(list, rand) {
  const array = list.slice();
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function factionsFor(lang) {
  return lang === "en" ? FACTIONS_EN : FACTIONS_ZH;
}

export function poolFor(lang, boardId) {
  const factions = factionsFor(lang);
  return factions.find((faction) => faction.boardId === boardId) ?? factions[0];
}

function entryText(entry, lang) {
  return lang === "en" ? entry.en : entry.zh;
}

function clueFor(entry, lang, levelIndex) {
  if (lang === "en") {
    const letters = entry.en.length;
    const base = `${entry.enDef} (${letters})`;
    if (levelIndex > 2) return base;
    return `${entry.enDef} (${letters}, starts with ${entry.en[0]})`;
  }
  if (levelIndex > 2) return entry.zhDef;
  return `${entry.zhDef} ${entry.zhStory}`;
}

function placeAt(grid, word, dir, row, col, needIntersect) {
  let intersections = 0;
  const cells = [];
  for (let i = 0; i < word.length; i += 1) {
    const r = row + (dir === "down" ? i : 0);
    const c = col + (dir === "across" ? i : 0);
    const key = `${r},${c}`;
    const at = grid.get(key);
    if (at) {
      if (at !== word[i]) return null;
      intersections += 1;
      continue;
    }
    if (dir === "across") {
      if (grid.has(`${r - 1},${c}`) || grid.has(`${r + 1},${c}`)) return null;
    } else if (grid.has(`${r},${c - 1}`) || grid.has(`${r},${c + 1}`)) {
      return null;
    }
    cells.push({ r, c });
  }
  if (needIntersect && intersections === 0) return null;
  const before = dir === "across" ? `${row},${col - 1}` : `${row - 1},${col}`;
  const after = dir === "across" ? `${row},${col + word.length}` : `${row + word.length},${col}`;
  if (grid.has(before) || grid.has(after)) return null;
  return { intersections, cells };
}

function pack(words, rand, maxSize) {
  const grid = new Map();
  const placed = [];
  const bounds = { minR: 0, maxR: 0, minC: 0, maxC: 0 };
  let intersections = 0;
  const put = (word, dir, row, col, placement) => {
    for (let i = 0; i < word.length; i += 1) {
      const r = row + (dir === "down" ? i : 0);
      const c = col + (dir === "across" ? i : 0);
      grid.set(`${r},${c}`, word[i]);
    }
    intersections += placement.intersections ?? 0;
    placed.push({ word, dir, row, col, intersections: placement.intersections ?? 0 });
    bounds.minR = Math.min(bounds.minR, row);
    bounds.minC = Math.min(bounds.minC, col);
    bounds.maxR = Math.max(bounds.maxR, row + (dir === "down" ? word.length - 1 : 0));
    bounds.maxC = Math.max(bounds.maxC, col + (dir === "across" ? word.length - 1 : 0));
  };

  const first = words[0];
  put(first, "across", 0, 0, { cells: [], intersections: 0 });

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    const options = [];
    for (const [key, char] of grid) {
      const [r, c] = key.split(",").map(Number);
      for (let i = 0; i < word.length; i += 1) {
        if (word[i] !== char) continue;
        const across = placeAt(grid, word, "across", r, c - i, true);
        if (across) options.push({ dir: "across", row: r, col: c - i, ...across });
        const down = placeAt(grid, word, "down", r - i, c, true);
        if (down) options.push({ dir: "down", row: r - i, col: c, ...down });
      }
    }
    let choice = null;
    if (options.length) {
      options.sort((a, b) => b.intersections - a.intersections);
      const best = options.filter((option) => option.intersections === options[0].intersections);
      // 交叉数相同时，挑增长最小的位置，网格更紧凑。
      const scored = best.map((option) => {
        const maxR = Math.max(bounds.maxR, option.row + (option.dir === "down" ? word.length - 1 : 0));
        const maxC = Math.max(bounds.maxC, option.col + (option.dir === "across" ? word.length - 1 : 0));
        const minR = Math.min(bounds.minR, option.row);
        const minC = Math.min(bounds.minC, option.col);
        return { option, span: Math.max(maxR - minR + 1, maxC - minC + 1) };
      });
      scored.sort((a, b) => a.span - b.span);
      const compact = scored.filter((item) => item.span === scored[0].span);
      choice = compact[Math.floor(rand() * compact.length)].option;
    } else {
      // 无法交叉时，允许作为独立小岛落在主网格周围，仍保证全部成语可填。
      const spots = [];
      for (let r = bounds.minR - 2; r <= bounds.maxR + 2; r += 1) {
        for (let c = bounds.minC - 2; c <= bounds.maxC + 2; c += 1) {
          const across = placeAt(grid, word, "across", r, c, false);
          if (across) spots.push({ dir: "across", row: r, col: c, ...across });
          const down = placeAt(grid, word, "down", r, c, false);
          if (down) spots.push({ dir: "down", row: r, col: c, ...down });
        }
      }
      if (!spots.length) return null;
      const scored = spots
        .map((spot) => {
          const maxR = Math.max(bounds.maxR, spot.row + (spot.dir === "down" ? word.length - 1 : 0));
          const maxC = Math.max(bounds.maxC, spot.col + (spot.dir === "across" ? word.length - 1 : 0));
          const minR = Math.min(bounds.minR, spot.row);
          const minC = Math.min(bounds.minC, spot.col);
          return { spot, span: maxR - minR + 1 + (maxC - minC + 1) };
        })
        .filter((item) => item.span <= maxSize * 2)
        .sort((a, b) => a.span - b.span);
      if (!scored.length) return null;
      const tight = scored.filter((item) => item.span === scored[0].span);
      choice = tight[Math.floor(rand() * tight.length)].spot;
    }
    const nextMaxR = Math.max(bounds.maxR, choice.row + (choice.dir === "down" ? word.length - 1 : 0));
    const nextMaxC = Math.max(bounds.maxC, choice.col + (choice.dir === "across" ? word.length - 1 : 0));
    if (nextMaxR - Math.min(bounds.minR, choice.row) + 1 > maxSize) return null;
    if (nextMaxC - Math.min(bounds.minC, choice.col) + 1 > maxSize) return null;
    put(word, choice.dir, choice.row, choice.col, choice);
  }
  return { grid, placed, bounds, intersections };
}

function finalize(layout, meta) {
  const { grid, placed, bounds } = layout;
  const width = bounds.maxC - bounds.minC + 1;
  const height = bounds.maxR - bounds.minR + 1;
  const rows = Math.max(MIN_GRID, height);
  const cols = Math.max(MIN_GRID, width);
  const offsetR = Math.floor((rows - height) / 2) - bounds.minR;
  const offsetC = Math.floor((cols - width) / 2) - bounds.minC;

  const entries = placed.map((item, index) => {
    const clue = meta.resolveClue(item.word);
    return {
      index,
      dir: item.dir,
      row: item.row + offsetR,
      col: item.col + offsetC,
      len: item.word.length,
      answer: item.word,
      clue,
      entryId: meta.resolveId(item.word),
    };
  });

  const cells = new Map();
  for (const [key, char] of grid) {
    const [r, c] = key.split(",").map(Number);
    cells.set(`${r + offsetR},${c + offsetC}`, char);
  }

  // 交叉格同时属于横竖两词，优先作为预填种子。
  const usage = new Map();
  for (const entry of entries) {
    for (let i = 0; i < entry.len; i += 1) {
      const key = `${entry.row + (entry.dir === "down" ? i : 0)},${entry.col + (entry.dir === "across" ? i : 0)}`;
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }
  }

  const cellList = [...cells.entries()]
    .map(([key, answer]) => {
      const [r, c] = key.split(",").map(Number);
      return { r, c, answer, uses: usage.get(key) ?? 1, locked: false };
    })
    .sort((a, b) => a.r - b.r || a.c - b.c);

  const prefillPool = cellList.filter((cell) => cell.uses > 1);
  const ordered = prefillPool.length >= meta.prefill ? prefillPool : cellList;
  const picked = new Set();
  let guard = 0;
  while (picked.size < Math.min(meta.prefill, ordered.length) && guard < 200) {
    const cell = ordered[Math.floor(meta.rand() * ordered.length)];
    picked.add(`${cell.r},${cell.c}`);
    guard += 1;
  }
  for (const cell of cellList) {
    if (picked.has(`${cell.r},${cell.c}`)) cell.locked = true;
  }

  const needed = [...new Set([...cellList.map((cell) => cell.answer)])];
  const distractors = [...new Set(meta.distractors.split(""))].filter((char) => !needed.includes(char));
  const rack = shuffle(needed, meta.rand).concat(distractors.slice(0, DISTRACTOR_COUNT));

  return {
    lang: meta.lang,
    boardId: meta.boardId,
    levelIndex: meta.levelIndex,
    rows,
    cols,
    cells: cellList,
    entries,
    rack,
    seed: meta.seed,
    intersections: layout.intersections,
  };
}

function buildOnce(pool, meta) {
  const rand = mulberry32(meta.seed);
  const ordered = shuffle(pool.entries, rand);
  const chosen = [ordered[0]];
  const textOf = (entry) => (meta.lang === "en" ? entry.en : entry.zh);
  while (chosen.length < meta.count && chosen.length < ordered.length) {
    const remaining = ordered.filter((entry) => !chosen.includes(entry));
    const scored = remaining.map((entry) => {
      const text = textOf(entry);
      let shared = 0;
      for (const other of chosen) {
        const otherText = textOf(other);
        for (const char of new Set(text)) if (otherText.includes(char)) shared += 1;
      }
      return { entry, shared };
    });
    scored.sort((a, b) => b.shared - a.shared);
    const shortlist = scored.slice(0, Math.max(3, Math.ceil(scored.length / 2)));
    chosen.push(shortlist[Math.floor(rand() * shortlist.length)].entry);
  }
  const words = chosen.slice(0, meta.count);
  if (words.length < meta.count) return null;
  const items = words.map((entry) => ({ entry, text: meta.lang === "en" ? entry.en : entry.zh }));
  if (items.some((item) => !item.text)) return null;
  const texts = items.map((item) => item.text);
  // 首词优先取最长的一条，织出的网格更紧凑。
  texts.sort((a, b) => b.length - a.length);
  const layout = pack(texts, rand, meta.maxSize);
  if (!layout) return null;
  const byText = new Map(items.map((item) => [item.text, item.entry]));
  return finalize(layout, {
    ...meta,
    prefill: meta.levelIndex < 3 ? 2 : meta.levelIndex < 6 ? 1 : 0,
    resolveClue: (text) => clueFor(byText.get(text), meta.lang, meta.levelIndex),
    resolveId: (text) => byText.get(text)?.id ?? "",
    rand,
    distractors: pool.distractors,
  });
}

export function buildLevel(lang, boardId, levelIndex) {
  const pool = poolFor(lang, boardId);
  const table = lang === "en" ? ENTRIES_EN : ENTRIES_ZH;
  const count = table[Math.max(0, Math.min(table.length - 1, levelIndex))];
  const maxSize = lang === "en" ? MAX_GRID_EN : MAX_GRID_ZH;
  const seed = hashSeed(`${lang}:${boardId}:${levelIndex}:${count}`);
  let best = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const puzzle = buildOnce(pool, {
      lang,
      boardId,
      levelIndex,
      count,
      maxSize,
      seed: (seed + attempt * 7919) >>> 0,
    });
    if (!puzzle) continue;
    // 优先交叉充分、grid 紧凑的排布，避免稀疏散点。
    const score = puzzle.intersections * 8 - puzzle.rows * puzzle.cols * 0.4;
    if (score > bestScore) {
      best = puzzle;
      bestScore = score;
    }
    if (puzzle.intersections >= count - 1 && puzzle.rows <= MIN_GRID + 1 && puzzle.cols <= MIN_GRID + 2) break;
  }
  return best;
}

export function getPuzzle(lang, boardId, levelIndex) {
  const cache = lang === "en" ? ENCACHE : ZHCACHE;
  const key = `${boardId}:${levelIndex}`;
  if (!cache.has(key)) cache.set(key, buildLevel(lang, boardId, Math.max(0, Math.min(9, levelIndex))));
  return cache.get(key);
}

export function allPuzzles(lang) {
  const list = [];
  for (const board of BOARDS) {
    for (let level = 0; level < 10; level += 1) {
      list.push({ boardId: board.id, levelIndex: level, puzzle: getPuzzle(lang, board.id, level) });
    }
  }
  return list;
}

export function resetPuzzleCacheForTests() {
  ZHCACHE.clear();
  ENCACHE.clear();
}
