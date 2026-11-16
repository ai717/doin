// 计分口径唯一权威：纯函数、DOM-free，只依赖 engine 的规则常量与结算函数。
//
// 本作不用"总分"这一套（棋类的核心指标是胜负、星级与纪录），因此这里并列三套互相独立的度量：
//   · 对弈 —— outcomeOf 判胜负；gameReport 产"对局档案卡"（终局比分 / 最大单步翻转 / 最大反转幅度）
//   · 残局 —— puzzleStars 三星制；starTotal / solvedCount / allStarred 汇总量化进度
//   · 冲刺 —— rushAdvance 连击倍率流水账；rushWinBonus 终局胜方红利
// UI 层严禁自行加总、取整或改写其中任何一项，一切经此处，
// 保证同一个局面在任何入口（结算卡、战绩、存档）算出的都是同一个数。

import {
  BLACK, WHITE, EMPTY, CELL_COUNT, STATUS_OVER,
  countDiscs, finalScore, RULES_WOF,
} from "./engine.mjs";

// ─── 对弈：胜负与对局档案 ─────────────────────────────────────────
export const OUTCOME_WIN = "win";
export const OUTCOME_LOSS = "loss";
export const OUTCOME_DRAW = "draw";

// 终局比分取 state.finalScore（由引擎按 state.rules 结算），不在此处重算规则。
// humanPlayer 非法（观战 / 未指定）返回 null，调用方必须显式处理"未结束"与"无法判定"。
export function outcomeOf(state, humanPlayer) {
  if (!state || state.status !== STATUS_OVER) return null;
  if (humanPlayer !== BLACK && humanPlayer !== WHITE) return null;
  const { black, white } = state.finalScore ?? finalScore(state.board, state.rules ?? RULES_WOF);
  if (black === white) return OUTCOME_DRAW;
  return (black > white ? BLACK : WHITE) === humanPlayer ? OUTCOME_WIN : OUTCOME_LOSS;
}

// 子数曲线：索引 0 = 起始盘面，其后每手一点。绘制层按序连线即可，不要在 UI 层重算。
//
// 起始点由第一手反推：行棋方净增 1 + 翻转数，对手净减翻转数。
// 手数为 0 时退化为当前盘面单点（此时 start === 当前，仍然自洽）。
export function discGraph(state) {
  const moves = state.moves ?? [];
  if (moves.length === 0) {
    const now = countDiscs(state.board);
    return [{ moveNo: 0, black: now.black, white: now.white, player: EMPTY, index: -1, flips: 0 }];
  }

  const first = moves[0];
  const gain = 1 + first.flips.length;
  const black = first.player === BLACK ? first.black - gain : first.black + first.flips.length;
  const white = first.player === WHITE ? first.white - gain : first.white + first.flips.length;

  const points = [{ moveNo: 0, black, white, player: EMPTY, index: -1, flips: 0 }];
  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    points.push({
      moveNo: i + 1,
      black: move.black,
      white: move.white,
      player: move.player,
      index: move.index,
      flips: move.flips.length,
    });
  }
  return points;
}

// 最大单步翻转：本局翻得最狠的一手。并列取先发生者（确定性，绝不留随机）。
export function maxFlipOf(state) {
  let best = null;
  const moves = state.moves ?? [];
  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    const flips = move.flips.length;
    if (best && flips <= best.flips) continue;
    best = { moveNo: i + 1, index: move.index, player: move.player, flips, black: move.black, white: move.white };
  }
  return best;
}

// 最大反转幅度（Biggest Swing）—— 档案卡第三行的精确定义。
//
// 直接取"子数曲线斜率最陡的一手"会退化：任何一手的斜率绝对值恒为 `1 + 翻转数`
// （自己必 +1，翻转的 k 枚再加 k，对手同步 −k），于是"最陡"与"翻得最多"永远是同一手，
// 档案卡第二三行会重复打印同一步，指标彻底失去意义。
// 因此改取"逆风翻得最狠的一手"：swing = (1 + 翻转数) + 落子前本方落后的子数。
// 同样翻 8 枚，从 20 子深坑里打出来的戏剧性远高于均势时的同一翻 —— 这才是档案卡要讲的故事。
export function biggestSwingOf(state) {
  let best = null;
  const moves = state.moves ?? [];
  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    const flips = move.flips.length;
    const mine = move.player === BLACK ? move.black : move.white;
    const theirs = move.player === BLACK ? move.white : move.black;
    // 落子前本方视角的子数差：mine − theirs − (1 + 2k)
    const deficitBefore = Math.max(0, -(mine - theirs - 1 - 2 * flips));
    const swing = 1 + flips + deficitBefore;
    if (best && swing <= best.swing) continue;
    best = {
      moveNo: i + 1,
      index: move.index,
      player: move.player,
      flips,
      deficitBefore,
      after: mine - theirs,
      swing,
    };
  }
  return best;
}

// 对局档案卡：结算页与战绩纪录的唯一数据源。
export function gameReport(state) {
  const score = state.finalScore ?? finalScore(state.board, state.rules ?? RULES_WOF);
  const { black, white } = score;
  const winner = black === white ? EMPTY : black > white ? BLACK : WHITE;
  return {
    moves: (state.moves ?? []).length,
    black,
    white,
    winner,
    diff: Math.abs(black - white),
    // 64:0 是黑白棋唯一允许"铺张"的终局（PRD §3.6 完美局）。总数必须落满，
    // 否则 0:0 的空盘也会被判成 perfect。
    perfect: black + white === CELL_COUNT && (black === 0 || white === 0),
    maxFlip: maxFlipOf(state),
    swing: biggestSwingOf(state),
    graph: discGraph(state),
  };
}

// 历史最佳纪录：只升不降，且不因中途失败而清零。
export function recordHighlights(highlights, report) {
  const prev = highlights && typeof highlights === "object" ? highlights : {};
  return {
    maxFlip: Math.max(numberOr(prev.maxFlip, 0), report?.maxFlip ? report.maxFlip.flips : 0),
    bestSwing: Math.max(numberOr(prev.bestSwing, 0), report?.swing ? report.swing.swing : 0),
  };
}

// ─── 残局：三星制与进度 ───────────────────────────────────────────
export const PUZZLE_STARS_MAX = 3;
export const CHAPTER_UNLOCK_NEED = 6; // PRD §3.5 模式 B：解出本章 ≥ 6 题方可进入下一章

// 一星 = 解出（达成最优）；二星 = 全程无错着重选；三星 = 首手即最优且全程零错着。
// 提示不影响星级（PRD §3.5：每关可点提示，不影响星级）。
export function puzzleStars(result) {
  if (!result || !result.solved) return 0;
  const optimal = Boolean(result.firstMoveOptimal);
  const clean = !result.hadWrongRetry;
  if (optimal && clean) return PUZZLE_STARS_MAX;
  if (clean) return 2;
  return 1;
}

export function clampStars(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(PUZZLE_STARS_MAX, Math.trunc(n)));
}

// 合并一次通关结果进存档。星级只升不降；星级相同时保留"更干净"的那一次，
// 保证 {stars, hadWrongRetry, firstMoveOptimal} 三元组永远是同一次通关的真实记录，
// 而不会出现"三星 + 有错着重选"这种自相矛盾的数据。
export function mergePuzzleResult(previous, result) {
  const prev = previous && typeof previous === "object"
    ? {
      stars: clampStars(previous.stars),
      hadWrongRetry: Boolean(previous.hadWrongRetry),
      firstMoveOptimal: Boolean(previous.firstMoveOptimal),
    }
    : null;
  const next = {
    stars: clampStars(result?.stars),
    hadWrongRetry: Boolean(result?.hadWrongRetry),
    firstMoveOptimal: Boolean(result?.firstMoveOptimal),
  };
  if (!prev || next.stars > prev.stars) return next;
  if (next.stars < prev.stars) return prev;
  const rank = (r) => (r.hadWrongRetry ? 0 : 2) + (r.firstMoveOptimal ? 1 : 0);
  return rank(prev) >= rank(next) ? prev : next;
}

export function recordStars(records, id) {
  const rec = records?.[id];
  return clampStars(rec?.stars);
}

export function solvedCount(records, ids) {
  return (ids ?? []).filter((id) => recordStars(records, id) > 0).length;
}

export function starTotal(records, ids) {
  let sum = 0;
  for (const id of ids ?? []) sum += recordStars(records, id);
  return sum;
}

// 章节放行：本章解出题数 ≥ CHAPTER_UNLOCK_NEED。空章（ids 为空）一律不放行。
export function chapterCleared(records, ids) {
  if (!ids || ids.length === 0) return false;
  return solvedCount(records, ids) >= CHAPTER_UNLOCK_NEED;
}

// 总成就「翻转之眼 / The Flip Eye」：60 题全三星。
export function allStarred(records, ids) {
  if (!ids || ids.length === 0) return false;
  return ids.every((id) => recordStars(records, id) === PUZZLE_STARS_MAX);
}

// ─── 翻转冲刺（Flip Rush）────────────────────────────────────────
export const RUSH_DURATION_MS = 90_000; // 一局 90 秒
export const RUSH_TURN_MS = 6_000; // 每手 6 秒软倒计时（超时不判负，只是断连击）
export const RUSH_COMBO_STEP = 3; // 连击每累加 3 级
export const RUSH_COMBO_BONUS = 0.5; // 倍率 +0.5
export const RUSH_MAX_MULTIPLIER = 4; // 倍率上限 ×4
export const RUSH_WIN_BONUS_PER_DISC = 50; // 终局获胜额外 +50 × 子差

// 连击等级 → 倍率。0-2 级 ×1.0，3-5 级 ×1.5 …… 18 级起封顶 ×4。
export function rushMultiplier(combo) {
  const level = Math.floor(Math.max(0, numberOr(combo, 0)) / RUSH_COMBO_STEP);
  return Math.min(RUSH_MAX_MULTIPLIER, 1 + level * RUSH_COMBO_BONUS);
}

export function rushStart() {
  return { score: 0, combo: 0, multiplier: 1, moves: 0 };
}

// 单步流水：先结算连击再计分（"连击每累加 3 级，倍率 +0.5"）。
// 翻转数 ≥ 2 连击 +1；翻转数 1 断连击；超时（timedOut）强制归零且本手不再累积连击。
export function rushAdvance(state, flips, options = {}) {
  const count = Math.max(0, Math.trunc(numberOr(flips, 0)));
  const combo = options.timedOut || count < 2 ? 0 : numberOr(state?.combo, 0) + 1;
  const multiplier = rushMultiplier(combo);
  const gained = count * multiplier;
  return {
    combo,
    multiplier,
    gained,
    score: numberOr(state?.score, 0) + gained,
    moves: numberOr(state?.moves, 0) + 1,
  };
}

// 终局红利：仅玩家获胜时结算，子差取绝对值（不会为负）。
export function rushWinBonus(playerWon, discDiff) {
  if (!playerWon) return 0;
  return RUSH_WIN_BONUS_PER_DISC * Math.max(0, Math.trunc(numberOr(discDiff, 0)));
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
