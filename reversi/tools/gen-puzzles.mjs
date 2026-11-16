// tools/gen-puzzles.mjs —— 开发期工具：60 道残局题库的四步产线，产出 js/puzzles.mjs。
//
// 【前提】Node ≥20，零依赖、零构建。只需 engine / solver / rng，不需要任何第三方求解器。
// 【命令】在项目根执行：
//         node games/reversi/tools/gen-puzzles.mjs                  # 只出报告，不落盘
//         node games/reversi/tools/gen-puzzles.mjs --emit           # 报告 + 重写 js/puzzles.mjs
//         node games/reversi/tools/gen-puzzles.mjs 2400             # 候选预算（默认 900）
//         node games/reversi/tools/gen-puzzles.mjs --emit 2400
// 【产物】stdout：候选数 / 通过硬指标数 / 六章各自的供给量 / 每章入选题一行指标；
//         --emit 时写 js/puzzles.mjs（CHAPTERS + PUZZLES 60 题）。
// 【流水线】① 随机游走切片出候选（黑先，空位 6-14）
//           ② 每个候选交给完美求解器穷举 → bestDiff 与 winningMoves[]（唯一的权威来源）
//           ③ 硬指标过滤：唯一最优首手 + bestDiff ≥ 6
//           ④ 按六章教学重点分别打标，按"越稀缺的章越先挑"配齐每章 10 题，补全最优线
// 【坑】1) js/puzzles.mjs 是生成物，**勿手改**；要调题就改 CHAPTER_RULES / 阈值再 --emit。
//      2) --emit 之后必须重跑 `node --test games/reversi/tests/puzzles.test.mjs`：
//         那边会用求解器逐题复核 bestDiff / winningMoves / bestLine，是题库正确性的唯一护栏。
//      3) 每章的供给量差异极大（"连环翻（多方向 ≥8 子）"最稀缺、"绝地逆转"满地都是），
//         报告里某章供给掉到 10 以下就说明谓词太紧，该放宽阈值而不是硬凑。
//      4) 求解结果缓存在 .workbuddy/tmp/reversi-puzzle-cache.json；调阈值时命中缓存，
//         整轮产线从几分钟降到几十秒。改过 solver 之后记得删掉缓存再跑。
//      5) 本工具产出的数据层只允许数字、英文 key 与 64 字符三态串；章节名/题面文案由 i18n 查表。
//      6) 本文件也在 check-game 的 i18n-clean 扫描范围内（它扫整个 games/reversi/，含 tools/），
//         所以**运行期的字符串字面量一律用英文**，日志文案别再写回中文（中文只允许出现在注释里）。

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BLACK, WHITE,
  other, legalMoves, countDiscs, isCorner, isXSquare, isCSquare,
  flipLines, placeDisc, formatBoard, createState, applyMove,
  STATUS_PLAYING,
} from "../js/engine.mjs";
import { solveExact } from "../js/solver.mjs";
import { mulberry32, randBetween } from "../js/rng.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export const PER_CHAPTER = 10;
export const MIN_DIFF = 6;

// 六章：key 只是 i18n 的查表键，显示名（得角 / 避坑 / …）全部由 UI 层提供。
export const CHAPTER_KEYS = ["cornerstone", "edge-trap", "starve", "cascade", "comeback", "perfect-endgame"];

// 候选空位池。求解代价随空位数指数增长（空位 12 约 90ms，空位 14 约 400ms），
// 而第五、六章才需要 12-14，所以把便宜的 6-11 排满两轮，12-14 只占 1/5。
const TARGET_POOL = [6, 7, 8, 9, 10, 11, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// 求解结果的磁盘缓存：调阈值时要反复重跑产线，没有缓存每次都要重算上千个局面。
const CACHE_PATH = `${here}/../../../.workbuddy/tmp/reversi-puzzle-cache.json`;

// ─── ① 候选局面：随机游走切片 ─────────────────────────────────────
export function walkToTarget(seed, target) {
  const rng = mulberry32(seed);
  let state = createState();
  let guard = 0;
  while (state.status === STATUS_PLAYING && countDiscs(state.board).empty > target && guard < 200) {
    guard += 1;
    const moves = legalMoves(state.board, state.current);
    state = applyMove(state, moves[randBetween(rng, [0, moves.length - 1])]);
  }
  return state;
}

export function collectCandidates(budget = 900) {
  const seen = new Set();
  const out = [];
  for (let seed = 1; seed <= budget && out.length < 6000; seed += 1) {
    const target = TARGET_POOL[seed % TARGET_POOL.length];
    const state = walkToTarget(seed * 7919, target);
    if (state.status !== STATUS_PLAYING) continue;
    if (state.current !== BLACK) continue; // 题面统一"黑先"，与 PRD 六章一致
    const empties = countDiscs(state.board).empty;
    if (empties !== target) continue;
    const moves = legalMoves(state.board, BLACK);
    // 可下点太少没有选择难度，太多则唯一解失去教学意义
    if (moves.length < 4 || moves.length > 14) continue;
    const key = state.board.join("");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(state.board);
  }
  return out;
}

// ─── ② 求解 + ③ 硬指标过滤 ────────────────────────────────────────
// 求解结果缓存（board 串 → { score, winningMoves }）：完美求解是这里唯一的昂贵操作，
// 调章节阈值时重跑产线不该把上千个局面重算一遍。
export function createSolveCache() {
  let data = {};
  if (existsSync(CACHE_PATH)) {
    try {
      data = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    } catch {
      data = {};
    }
  }
  let hits = 0;
  let misses = 0;
  return {
    solve(board) {
      const key = board.join("");
      const cached = data[key];
      if (cached) {
        hits += 1;
        return cached;
      }
      misses += 1;
      const solved = solveExact(board, BLACK);
      data[key] = { score: solved.score, winningMoves: solved.moves.slice() };
      return data[key];
    },
    flush() {
      mkdirSync(dirname(CACHE_PATH), { recursive: true });
      writeFileSync(CACHE_PATH, JSON.stringify(data), "utf8");
      return { hits, misses, size: Object.keys(data).length };
    },
  };
}

export function analyze(board, cache) {
  const empties = countDiscs(board).empty;
  const moves = legalMoves(board, BLACK);
  const solved = cache ? cache.solve(board) : solveExact(board, BLACK);
  const winning = solved.winningMoves ?? solved.moves;
  if (winning.length !== 1) return null; // 硬指标：唯一最优首手
  if (solved.score < MIN_DIFF) return null; // 硬指标：分差足够大

  const best = winning[0];
  const lines = flipLines(board, best, BLACK);
  const flips = lines.reduce((sum, line) => sum + line.length, 0);
  const child = placeDisc(board, best, BLACK);
  const opponentMovesAfter = legalMoves(child, WHITE).length;
  const discs = countDiscs(board);
  const deficit = discs.white - discs.black; // 行棋方落后多少子（≤0 表示领先）
  const trapMoves = moves.filter((move) => isXSquare(move) || isCSquare(move));

  const difficulty = 1
    + (empties - 6) * 0.35
    + Math.min(moves.length, 12) * 0.12
    + Math.min(flips, 14) * 0.06
    + Math.min(trapMoves.length, 4) * 0.18
    + Math.max(0, deficit) * 0.09;

  return {
    board, empties, moveCount: moves.length,
    bestDiff: solved.score, winningMoves: winning.slice(), best,
    flips, directions: lines.length, opponentMovesAfter, deficit, trapMoves,
    difficulty: Math.round(difficulty * 100) / 100,
  };
}

// ─── ④ 六章的教学重点谓词 ─────────────────────────────────────────
// 每一章都必须让"正解"真的落在该章的概念上，不允许第 1 章混进奇偶性题。
//
// 两条横切约束：
//   ① 前四章要求"局面大体均衡（|子数差| ≤ 10）"—— 随机游走产出的盘面几乎全是大幅落后局面，
//      不加这条会让每一章都长得像"绝地逆转"，教学重点被淹没；
//   ② 空位上限逐章放宽（★ → ★★★★★）—— 空位数是"求解代价"与"题目难度"的同一个量。
//      第 1 章压到 7 是刻意的：那一章的教学重点只是"认出这一步能拿下角"，
//      若给它 12 空位 + 12 手精确收官，星标就成了谎话。
const BALANCED = (a) => Math.abs(a.deficit) <= 10;
export const MAX_EMPTIES = [7, 9, 10, 11, 14, 14]; // 第 1-6 章（必须非递减，测试会钉住）

export const CHAPTER_RULES = {
  // 得角：正解就是拿下角 —— 理解角是永久锚点
  cornerstone: (a, cap) => isCorner(a.best) && a.empties <= cap && BALANCED(a),
  // 避坑：盘面有 ≥2 个看着更香的 X/C 位，正解偏偏不碰它 —— 理解"角旁的诱惑"
  "edge-trap": (a, cap) => !isCorner(a.best) && !isXSquare(a.best) && !isCSquare(a.best) && a.trapMoves.length >= 2 && a.empties <= cap && BALANCED(a),
  // 断机动：走完让对手只剩 0-1 个合法落点
  starve: (a, cap) => a.opponentMovesAfter <= 1 && a.moveCount >= 4 && a.empties <= cap && BALANCED(a),
  // 连环翻：多方向同时夹击，一子翻得最狠的那一手
  cascade: (a, cap) => a.directions >= 2 && a.flips >= 8 && a.empties <= cap,
  // 绝地逆转：行棋方大幅落后却终局获胜 —— 理解"中盘领先子数是负资产"
  comeback: (a, cap) => a.deficit >= 8 && a.empties <= cap,
  // 终局精算：空位最多、可选点最多的精确终局 —— 纯计算力
  "perfect-endgame": (a, cap) => a.empties >= 12 && a.empties <= cap && a.moveCount >= 6,
};

export function chapterFits(key, info, chapterIndex) {
  const rule = CHAPTER_RULES[key];
  return Boolean(rule) && rule(info, MAX_EMPTIES[chapterIndex]);
}

// 分差敏感度：**最优首手之外**最好的一手会输多少（题面最怕的"看着也行其实致命"）。
// 每个候选着法要一次精确求解，60 题全量算下来要几分钟，因此**不进产线**，
// 只作为手工分析单个局面的工具导出（想给某道题做教学解说时调用它）。
// 注意必须显式跳过最优集合，否则 max 会取到最优手本身、敏感度恒为 0（已踩过）。
export function sensitivity(board, winningMoves) {
  const optimal = solveExact(board, BLACK).score;
  let bestOther = -Infinity;
  for (const move of legalMoves(board, BLACK)) {
    if (winningMoves.includes(move)) continue;
    const child = placeDisc(board, move, BLACK);
    if (child === null) continue;
    const value = -solveExact(child, WHITE).score;
    if (value > bestOther) bestOther = value;
  }
  return { optimal, secondBestLoss: bestOther === -Infinity ? 0 : optimal - bestOther };
}

// 最优线：双方都走最优，一路铺到满盘（残局的"正解回放"直接吃这条线）。
// Pass 不入线，但会换手，因此空位会照常减少。
export function buildBestLine(board) {
  const line = [];
  let current = board;
  let side = BLACK;
  for (let guard = 0; guard < 80; guard += 1) {
    if (countDiscs(current).empty === 0) break;
    const solved = solveExact(current, side);
    if (solved.moves.length === 0) {
      if (legalMoves(current, other(side)).length === 0) break; // 双方均无子可下 = 终局
      side = other(side); // 让位
      continue;
    }
    const move = solved.moves[0];
    line.push(move);
    current = placeDisc(current, move, side);
    side = other(side);
  }
  return { line, finalBoard: current };
}

// ─── 选题 ─────────────────────────────────────────────────────────
export function selectPuzzles(budget = 900, log = () => {}, cache = createSolveCache()) {
  const candidates = collectCandidates(budget);
  log(`candidates (black to move, empties 6-14): ${candidates.length}`);

  const analyzed = [];
  for (const board of candidates) {
    const info = analyze(board, cache);
    if (info) analyzed.push(info);
  }
  const stats = cache.flush();
  log(`passed hard filters (unique best + bestDiff >= ${MIN_DIFF}): ${analyzed.length} (cache hit ${stats.hits} / new ${stats.misses})`);

  const picked = [];
  const used = new Set();

  // 按稀缺度分章：先让"料少"的章挑（第 4 章最稀缺），否则前两章会把稀有章节能用
  // 的局面吃光，出现"第 5 章凑不满 10 题却看到一堆符合条件的好料"的怪现象。
  const order = CHAPTER_KEYS
    .map((key, index) => ({
      key,
      chapter: index + 1,
      index,
      fits: analyzed
        .filter((a) => chapterFits(key, a, index))
        .sort((a, b) => b.difficulty - a.difficulty || a.bestDiff - b.bestDiff),
    }))
    .sort((a, b) => a.fits.length - b.fits.length || a.index - b.index);

  for (const pool of order) {
    const fresh = pool.fits.filter((a) => !used.has(a.board.join("")));
    log(`  ch${pool.chapter} ${pool.key}: fits ${pool.fits.length} (unclaimed by earlier chapters ${fresh.length})${fresh.length < PER_CHAPTER ? "  <- supply short" : ""}`);
    for (const item of fresh.slice(0, PER_CHAPTER)) {
      used.add(item.board.join(""));
      picked.push({ ...item, chapter: pool.chapter, chapterKey: pool.key });
    }
  }
  for (const item of picked) {
    item.bestLine = buildBestLine(item.board).line;
    item.difficulty = Math.round((item.difficulty + item.bestLine.length * 0.05) * 100) / 100;
  }
  // 补完最优线后 difficulty 会再动一次，所以排序必须放在这一步之后
  picked.sort((a, b) => a.chapter - b.chapter || b.difficulty - a.difficulty);

  return { candidates: candidates.length, analyzed: analyzed.length, picked, cache: stats };
}

// ─── 落盘 ─────────────────────────────────────────────────────────
export const DATA_HEADER = [
  "// 60 道残局题库（离线产线 tools/gen-puzzles.mjs 生成，请勿手改）。",
  "//",
  "// 每题 bestDiff / winningMoves 都由完美求解器穷举得到；tests/puzzles.test.mjs 会重跑",
  "// 求解器逐题复核，题库因此不可能悄悄写错。",
  "//",
  "// 字段：id / chapter / chapterKey / side / board / empties / legalMoves /",
  "//       bestDiff / winningMoves / bestLine / difficulty。",
  "//   side         行棋方（1 = 黑，2 = 白，engine 的常量口径）",
  "//   board        64 字符三态串，索引 = row * 8 + col（B 黑 / W 白 / . 空）",
  "//   bestDiff     最优终局分差（行棋方视角，正数 = 赢）",
  "//   winningMoves 全部达到最优的首手（本题恒为单元素 = 唯一解）",
  "//   bestLine     双方都走最优的完整线（正解回放用；Pass 不入线）",
  "//",
  "// 数据层铁律：本文件只含数字、英文 key 与 64 字符三态串，",
  "// 严禁任何中文字符串 —— 章节名与题面文案全部由 i18n 按 key 查表。",
  "",
].join("\n");

export function renderPuzzlesModule(picked) {
  const lines = [DATA_HEADER];
  lines.push(`export const CHAPTERS = Object.freeze(${JSON.stringify(
    CHAPTER_KEYS.map((key, i) => ({ number: i + 1, key, count: PER_CHAPTER })), null, 2,
  )});`);
  lines.push("");
  lines.push("export const PUZZLES = Object.freeze([");
  const counters = new Map();
  for (const item of picked) {
    const index = (counters.get(item.chapter) ?? 0) + 1;
    counters.set(item.chapter, index);
    const id = `p${String(item.chapter).padStart(2, "0")}${String(index).padStart(2, "0")}`;
    lines.push(`  ${JSON.stringify({
      id,
      chapter: item.chapter,
      chapterKey: item.chapterKey,
      side: BLACK,
      board: formatBoard(item.board),
      empties: item.empties,
      legalMoves: item.moveCount,
      bestDiff: item.bestDiff,
      winningMoves: item.winningMoves,
      bestLine: item.bestLine,
      difficulty: item.difficulty,
    })},`);
  }
  lines.push("]);");
  lines.push("");
  lines.push("export const PUZZLE_COUNT = PUZZLES.length;");
  lines.push("");
  lines.push("export function chapterPuzzles(chapter) {");
  lines.push("  return PUZZLES.filter((puzzle) => puzzle.chapter === chapter);");
  lines.push("}");
  lines.push("");
  lines.push("export function puzzleById(id) {");
  lines.push("  return PUZZLES.find((puzzle) => puzzle.id === id) ?? null;");
  lines.push("}");
  return lines.join("\n");
}

// ─── 直接执行时才跑产线（被 import 时只导出函数）──────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const started = Date.now();
  const args = process.argv.slice(2);
  const emit = args.includes("--emit");
  const budget = Number(args.find((arg) => /^\d+$/.test(arg)) ?? 900);

  const { candidates, analyzed, picked, cache } = selectPuzzles(budget, (message) => console.log(message));
  console.log(`picked ${picked.length} puzzles`);
  for (const item of picked) {
    console.log(
      `  ch${item.chapter} ${item.chapterKey.padEnd(15)} e=${String(item.empties).padStart(2)}`
      + ` diff=${String(item.bestDiff).padStart(3)} flips=${String(item.flips).padStart(2)}`
      + ` dirs=${item.directions} opp=${item.opponentMovesAfter}`
      + ` deficit=${String(item.deficit).padStart(3)} traps=${item.trapMoves.length}`
      + ` line=${String(item.bestLine.length).padStart(2)} score=${item.difficulty}`,
    );
  }
  console.log(`candidates ${candidates} / analyzed ${analyzed} / picked ${picked.length} in ${Date.now() - started}ms`);
  console.log(`solve cache: hit ${cache.hits} / new ${cache.misses} / size ${cache.size}`);

  if (emit) {
    writeFileSync(`${here}/../js/puzzles.mjs`, renderPuzzlesModule(picked), "utf8");
    console.log("wrote games/reversi/js/puzzles.mjs");
  } else {
    console.log("(no --emit, nothing written)");
  }
}
