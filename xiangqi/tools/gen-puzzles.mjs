// 残局产线工具：生成候选残局 → 求解器校验 → 过滤 → 产出 js/puzzles.mjs。
//
// 准入铁律（PRD §3.4）：
//   1. solvable：存在强制杀棋线；
//   2. mateIn ∈ [2,5]：过滤平凡一步杀，也拒绝超纲；
//   3. 唯一首着：最速杀距下 winningMoves 恰好 1 个（可背谱）；
//   4. 起始局面：黑不被将军、红不被将军、将帅不照面、黑方至少一步可动。
//
// 产物为纯数据（棋谱字母 + 坐标数字），零中文、零 DOM，测试每次重跑求解器复核。
//
// 用法：node games/xiangqi/tools/gen-puzzles.mjs [--keep]（--keep 保留现有 puzzles.mjs 已过关目，仅补缺口）

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RED, BLACK, CELLS,
  parseBoard, serializeBoard,
  legalMoves, isAttacked, generalIndex, idx,
} from "../js/engine.mjs";
import { solve } from "../js/solver.mjs";
import { mulberry32, shuffle, pick } from "../js/rng.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "..", "js", "puzzles.mjs");

export const CHAPTER_KEYS = ["ch_chariots", "ch_cannon_horse", "ch_chariot_horse", "ch_classic"];

// ─── 手写经典候选（求解器说了算，不过关就淘汰）────────────────────
const HAND_CANDIDATES = [
  // 双车错：底线双车错将
  { chapter: "ch_chariots", board: "....k...." + "........." + "........." + "........." + "R........" + "........." + "........." + "........." + "....R...." + "....K...." },
  // 马后炮雏形
  { chapter: "ch_cannon_horse", board: "..A.k...." + "........." + "....N...." + "........." + "...C....." + "........." + "........." + "........." + "........." + "....K...." },
  // 车马冷着
  { chapter: "ch_chariot_horse", board: "....k...." + "...A....." + "........." + "........." + "....R...." + "........." + "..N......" + "........." + "........." + "....K...." },
  // 经典名局：炮辗丹沙
  { chapter: "ch_classic", board: "..A.kA..." + "....p...." + "..B......" + "........." + "....C...." + "........." + "......N.." + "........." + "....R...." + "....K...." },
];

// ─── 结构化随机候选生成器 ─────────────────────────────────────────
const BLACK_PALACE = [[0, 3], [0, 4], [0, 5], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5]];
const ADVISOR_CELLS = [[0, 3], [0, 5], [1, 4], [2, 3], [2, 5]];
const ELEPHANT_CELLS = [[0, 2], [0, 6], [2, 4], [4, 2], [4, 6]];
const RED_PALACE = [[9, 3], [9, 4], [9, 5], [8, 3], [8, 4], [8, 5], [7, 3], [7, 4], [7, 5]];

// 章节兵种配方：红方进攻子力 + 可选护卫。黑方统一 K + 仕象 + 随机杂子。
const RECIPES = {
  ch_chariots: { attack: ["R", "R"], extra: ["C", "P", null], guard: ["A", "E", null] },
  ch_cannon_horse: { attack: ["H", "C"], extra: ["R", "P", null], guard: ["A", "E", null] },
  ch_chariot_horse: { attack: ["R", "H"], extra: ["C", "P", null], guard: ["A", "E", null] },
  ch_classic: { attack: ["R", "C", "H"], extra: ["P", null], guard: ["A", "E", null] },
};

function charToPiece(ch) {
  return "KABNRCP".indexOf(ch) + 1; // 红方为正
}

function placeAt(board, placed, row, col, piece) {
  const i = idx(row, col);
  if (board[i] !== 0) return false;
  board[i] = piece;
  placed.add(i);
  return true;
}

function randomEmptyCell(rng, occupied, rowWeighter) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const row = rowWeighter(rng);
    const col = Math.floor(rng() * 9);
    const i = idx(row, col);
    if (!occupied.has(i)) return [row, col, i];
  }
  return null;
}

function makeRowPicker(rows) {
  return (rng) => rows[Math.floor(rng() * rows.length)];
}

// 攻击子力偏向黑方腹地（row 0-5），护卫子力留守红方（row 6-9）。
const ATTACK_ROWS = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6];
const HOME_ROWS = [6, 7, 7, 8, 8, 9, 9, 9];

function randomCandidate(chapter, rng) {
  const recipe = RECIPES[chapter];
  const board = new Array(CELLS).fill(0);
  const occupied = new Set();

  // 黑方将帅班子
  const bPalace = pick(rng, shuffle(rng, BLACK_PALACE));
  placeAt(board, occupied, bPalace[0], bPalace[1], -1);
  const advisorCount = pick(rng, [1, 2, 2, 2]);
  const elephantCount = pick(rng, [0, 1, 2, 2]);
  const groups = [
    [ADVISOR_CELLS, advisorCount, -2],
    [ELEPHANT_CELLS, elephantCount, -3],
  ];
  for (const [cells, count, piece] of groups) {
    let remain = count;
    for (const cell of shuffle(rng, cells)) {
      if (remain <= 0) break;
      if (placeAt(board, occupied, cell[0], cell[1], piece)) remain -= 1;
    }
  }
  // 黑方杂子（0~1 个，守子太多会压低出题率）
  const blackExtras = pick(rng, [["p"], ["p"], ["h"], ["c"], []]);
  for (const ch of blackExtras) {
    const cell = randomEmptyCell(rng, occupied, makeRowPicker([0, 1, 2, 3, 3, 4, 4]));
    if (!cell) break;
    placeAt(board, occupied, cell[0], cell[1], -(("KABNRCP".indexOf(ch.toUpperCase()) + 1)));
  }

  // 红方主帅
  const rPalace = pick(rng, shuffle(rng, RED_PALACE));
  placeAt(board, occupied, rPalace[0], rPalace[1], 1);

  // 红方进攻子力
  for (const ch of recipe.attack) {
    const cell = randomEmptyCell(rng, occupied, makeRowPicker(ATTACK_ROWS));
    if (!cell) return null;
    placeAt(board, occupied, cell[0], cell[1], charToPiece(ch));
  }
  // 红方附加与护卫
  const extra = pick(rng, recipe.extra);
  if (extra) {
    const cell = randomEmptyCell(rng, occupied, makeRowPicker(ATTACK_ROWS));
    if (cell) placeAt(board, occupied, cell[0], cell[1], charToPiece(extra));
  }
  const guard = pick(rng, recipe.guard);
  if (guard) {
    const cell = randomEmptyCell(rng, occupied, makeRowPicker(HOME_ROWS));
    if (cell) placeAt(board, occupied, cell[0], cell[1], charToPiece(guard));
  }

  return serializeBoard(board);
}

// ─── 起始局面合法性 ───────────────────────────────────────────────
function startValid(board, turn) {
  const redK = generalIndex(board, RED);
  const blackK = generalIndex(board, BLACK);
  if (redK < 0 || blackK < 0) return false;
  if (isAttacked(board, blackK, RED)) return false; // 黑已被将军
  if (isAttacked(board, redK, BLACK)) return false; // 红已被将军
  if (legalMoves(board, BLACK).length === 0) return false; // 黑方须有应对
  if (legalMoves(board, turn).length === 0) return false;
  return true;
}

// ─── 渐进求解（先浅后深，节点预算兜底）──────────────────────────
function progressiveSolve(board, turn) {
  for (const maxPar of [2, 3, 4, 5]) {
    const result = solve(board, turn, maxPar, { nodeBudget: maxPar <= 3 ? 120000 : 260000 });
    if (result.exceeded) return null;
    if (!result.solvable) continue;
    if (result.mateIn < 2 || result.mateIn > 5) return null;
    if (result.winningMoves.length !== 1) return null;
    return result;
  }
  return null;
}

// ─── 产线主流程 ───────────────────────────────────────────────────
function generateChapter(chapter, rng, keep) {
  const collected = (keep ?? []).slice();
  const seen = new Set(collected.map((p) => p.board));
  const handQueue = prepareHandQueue(chapter, seen);
  const slots = [
    { par: 2, count: 2, maxTries: 900 },
    { par: 3, count: 2, maxTries: 1400 },
    { par: 4, count: 1, maxTries: 1200 },
    { par: 5, count: 1, maxTries: 900 },
  ];

  const needOf = (par) => {
    const slot = slots.find((s) => s.par === par);
    if (!slot) return 0;
    return slot.count - collected.filter((p) => p.mateIn === par).length;
  };
  const missing = () => 6 - collected.length;
  const takeFrom = (queue, par) => {
    const at = queue.findIndex((item) => item.mateIn === par);
    if (at < 0) return false;
    collected.push(queue.splice(at, 1)[0]);
    return true;
  };

  for (const slot of slots) {
    let tries = 0;
    while (needOf(slot.par) > 0 && tries < slot.maxTries) {
      if (takeFrom(handQueue, slot.par)) continue;
      tries += 1;
      const boardStr = tryCandidate(chapter, rng, seen);
      if (!boardStr) continue;
      const result = solveResultCache.get(boardStr);
      if (result && result.mateIn === slot.par) {
        collected.push({ chapter, board: boardStr, mateIn: result.mateIn, first: result.first });
      }
    }
    if (missing() <= 0) break;
  }
  // 放宽补缺：任意 par ∈ [2,5]
  let relaxTries = 0;
  while (missing() > 0 && relaxTries < 2200) {
    if (handQueue.length > 0) {
      collected.push(handQueue.shift());
      continue;
    }
    relaxTries += 1;
    if (relaxTries % 250 === 0) console.log(`  [${chapter}] relax try ${relaxTries}, have ${collected.length}/6`);
    const boardStr = tryCandidate(chapter, rng, seen);
    if (!boardStr) continue;
    const result = solveResultCache.get(boardStr);
    if (result && result.mateIn >= 2 && result.mateIn <= 5) {
      collected.push({ chapter, board: boardStr, mateIn: result.mateIn, first: result.first });
      console.log(`  [${chapter}] accepted relax par${result.mateIn} (${collected.length}/6)`);
    }
  }
  return { collected, tries: relaxTries };
}

const solveResultCache = new Map();

function evaluateCandidate(boardStr, seen) {
  if (!boardStr || seen.has(boardStr)) return null;
  seen.add(boardStr);
  const board = parseBoard(boardStr);
  if (!board || !startValid(board, RED)) return null;
  const result = progressiveSolve(board, RED);
  if (!result) return null;
  solveResultCache.set(boardStr, result);
  return result;
}

function tryCandidate(chapter, rng, seen) {
  const boardStr = randomCandidate(chapter, rng);
  return evaluateCandidate(boardStr, seen) ? boardStr : null;
}

// 手写经典候选先评估入队，产线按 par 匹配优先采用。
function prepareHandQueue(chapter, seen) {
  const queue = [];
  for (const cand of HAND_CANDIDATES) {
    if (cand.chapter !== chapter) continue;
    const result = evaluateCandidate(cand.board, seen);
    if (result) queue.push({ chapter, board: cand.board, mateIn: result.mateIn, first: result.first });
  }
  return queue;
}

function parseArg(name) {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : null;
}

// 单章模式：--chapter <key> --out <file> [--keep]
// 独立进程只跑一章并写出分章 JSON，供 --merge 合成 puzzles.mjs（章间并行加速产线）。
function runSingleChapter() {
  const chapter = parseArg("--chapter");
  if (!CHAPTER_KEYS.includes(chapter)) {
    console.error(`unknown chapter: ${chapter}`);
    process.exit(2);
  }
  const out = parseArg("--out");
  let keep = [];
  if (process.argv.includes("--keep") && out && existsSync(out)) {
    try {
      keep = JSON.parse(readFileSync(out, "utf8"));
    } catch {
      keep = [];
    }
  }
  // 章名盐化种子：各章独立 rng 序列，互不拖累。
  const salt = [...chapter].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rng = mulberry32((0x20261019 ^ salt) >>> 0);
  const { collected } = generateChapter(chapter, rng, keep);
  collected.sort((a, b) => a.mateIn - b.mateIn || a.first.from - b.first.from);
  const picked = collected.slice(0, 6);
  const dist = {};
  for (const item of picked) dist[item.mateIn] = (dist[item.mateIn] ?? 0) + 1;
  console.log(`${chapter}: ${picked.length}/6  parDist ${JSON.stringify(dist)}`);
  if (picked.length < 6) {
    console.error(`FAILED: ${chapter} short of 6 puzzles`);
    process.exit(1);
  }
  writeFileSync(out, JSON.stringify(picked), "utf8");
  console.log(`written: ${out}`);
}

// 合并模式：--merge <dir>，读取 4 份分章 JSON 按 CHAPTER_KEYS 顺序合成 puzzles.mjs。
function mergeChapters() {
  const dir = parseArg("--merge");
  const all = {};
  for (const chapter of CHAPTER_KEYS) {
    const file = resolve(dir, `chapter-${chapter}.json`);
    all[chapter] = JSON.parse(readFileSync(file, "utf8"));
    if (all[chapter].length !== 6) {
      console.error(`FAILED: ${file} has ${all[chapter].length}/6`);
      process.exit(1);
    }
  }
  const lines = [];
  lines.push("// 残局题库：由 tools/gen-puzzles.mjs 产线生成，勿手改。");
  lines.push("// 每关均通过求解器校验：mateIn ∈ [2,5]、唯一首着、起始无将军。tests 重跑复核。");
  lines.push("");
  lines.push("export const PUZZLE_CHAPTERS = [");
  let levelNo = 0;
  for (const chapter of CHAPTER_KEYS) {
    const levels = [];
    for (let n = 1; n <= 6; n += 1) {
      levelNo += 1;
      levels.push(`"level_${levelNo}"`);
    }
    lines.push(`  { key: "${chapter}", levels: [${levels.join(", ")}] },`);
  }
  lines.push("];");
  lines.push("");
  lines.push("export const PUZZLES = {");
  levelNo = 0;
  for (const chapter of CHAPTER_KEYS) {
    for (const item of all[chapter]) {
      levelNo += 1;
      lines.push(`  "level_${levelNo}": { chapter: "${chapter}", board: "${item.board}", par: ${item.mateIn}, first: [${item.first.from}, ${item.first.to}] },`);
    }
  }
  lines.push("};");
  lines.push("");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`written: ${outPath} (${levelNo} puzzles)`);
}

function main() {
  if (parseArg("--merge")) return mergeChapters();
  if (parseArg("--chapter")) return runSingleChapter();

  const keepArg = process.argv.includes("--keep");
  let keepByChapter = {};
  if (keepArg && existsSync(outPath)) {
    try {
      const text = readFileSync(outPath, "utf8");
      const levels = [...text.matchAll(/"(level_\d+)": \{[^}]*chapter: "([^"]+)", board: "([^"]+)", par: (\d+), first: \[(\d+), (\d+)\]/g)];
      keepByChapter = {};
      for (const [, level, chapter, board, par, from, to] of levels) {
        (keepByChapter[chapter] ??= []).push({ chapter, board, mateIn: Number(par), first: { from: Number(from), to: Number(to) } });
      }
    } catch {
      keepByChapter = {};
    }
  }

  const rng = mulberry32(0x20261019);
  const all = {};
  let report = [];
  for (const chapter of CHAPTER_KEYS) {
    const { collected } = generateChapter(chapter, rng, keepByChapter[chapter]);
    collected.sort((a, b) => a.mateIn - b.mateIn || (a.first.from - b.first.from));
    all[chapter] = collected.slice(0, 6);
    const dist = {};
    for (const item of all[chapter]) dist[item.mateIn] = (dist[item.mateIn] ?? 0) + 1;
    report.push(`${chapter}: ${all[chapter].length}/6  parDist ${JSON.stringify(dist)}`);
  }

  const shortfall = CHAPTER_KEYS.filter((c) => all[c].length < 6);
  for (const line of report) console.log(line);
  if (shortfall.length > 0) {
    console.error(`FAILED: chapters short of 6 puzzles: ${shortfall.join(", ")}`);
    process.exit(1);
  }

  const lines = [];
  lines.push("// 残局题库：由 tools/gen-puzzles.mjs 产线生成，勿手改。");
  lines.push("// 每关均通过求解器校验：mateIn ∈ [2,5]、唯一首着、起始无将军。tests 重跑复核。");
  lines.push("");
  lines.push("export const PUZZLE_CHAPTERS = [");
  let levelNo = 0;
  for (const chapter of CHAPTER_KEYS) {
    const levels = [];
    for (let n = 1; n <= 6; n += 1) {
      levelNo += 1;
      levels.push(`"level_${levelNo}"`);
    }
    lines.push(`  { key: "${chapter}", levels: [${levels.join(", ")}] },`);
  }
  lines.push("];");
  lines.push("");
  lines.push("export const PUZZLES = {");
  levelNo = 0;
  for (const chapter of CHAPTER_KEYS) {
    for (const item of all[chapter]) {
      levelNo += 1;
      lines.push(`  "level_${levelNo}": { chapter: "${chapter}", board: "${item.board}", par: ${item.mateIn}, first: [${item.first.from}, ${item.first.to}] },`);
    }
  }
  lines.push("};");
  lines.push("");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`written: ${outPath} (${levelNo} puzzles)`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
