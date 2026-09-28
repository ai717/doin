// 黑白棋 AI：四档阶梯。纯函数、DOM-free、确定性（随机只来自注入的 rng）。
//
// 分档（与 PRD §3.3 逐行对齐）：
//   见习 Novice      1 层，只数"这一手翻了几子"，35% 概率随机走次优
//   棋手 Duelist     3 层 + Alpha-Beta，空位 ≤ 6 完美求解，评估 = 棋格表 + 机动性各半
//   名手 Virtuoso    6 层 + 迭代加深 + 置换表，空位 ≤ 10 完美，五要素阶段化加权
//   无谬 Infallible  10 层 + NegaScout(PVS) + 置换表，空位 ≤ 14 完美，零失误
//
// ── 时间切片铁律（PRD §3.3：每段 ≤ 12ms，主线程绝不允许被长段阻塞）────────
// 搜索写成**生成器**，每到一个"切片边界"（一个根着法子树的边界）就 yield 一次；
// 同步驱动直接榨干，异步驱动在 yield 处 await 让步。一份搜索逻辑两个驱动，
// 因此绝不会出现"异步版和同步版算出不同的棋"这种最坏情况。
//
// 段内硬顶（hardMs）触发时置 abort，**本层作废、回退上一层结论**，然后带着刚攒下的
// 置换表**同层重试**（重试时已算完的子树直接从表里取，真实进展是单调的）。
// 已被完整算完的子树结论始终有效，所以 abort 只在写表之前拦截 —— 绝不写半个节点的值。
//
// 完美求解区间（空位 ≤ perfectEmpties）**不允许 abort**：精确性优先，
// 改为按根着法切片，把单次阻塞压到"一棵子树"的量级。

import {
  BLACK, EMPTY, CELL_COUNT, SIZE,
  other, legalMoves, countDiscs, indexOf,
  stableCounts, flipsFor,
} from "./engine.mjs";
import { INF, finalDiff, orderedMoves } from "./solver.mjs";

// ─── 档位配置 ─────────────────────────────────────────────────────
export const TIER_NOVICE = "novice";
export const TIER_DUELIST = "duelist";
export const TIER_VIRTUOSO = "virtuoso";
export const TIER_INFALLIBLE = "infallible";

// thinkMin / thinkMax 是"演出时长"，由 game.mjs 负责等待，ai.mjs 只声明并据此限定
// 搜索总预算；搜索跑完就返回，绝不空转烧 CPU。
export const TIERS = Object.freeze([
  { key: TIER_NOVICE, depth: 1, perfectEmpties: 0, evaluator: "flips", blunderRate: 0.35, thinkMin: 300, thinkMax: 600 },
  { key: TIER_DUELIST, depth: 3, perfectEmpties: 6, evaluator: "simple", blunderRate: 0.15, thinkMin: 600, thinkMax: 1200 },
  { key: TIER_VIRTUOSO, depth: 6, perfectEmpties: 10, evaluator: "full", blunderRate: 0.03, thinkMin: 1200, thinkMax: 2500 },
  { key: TIER_INFALLIBLE, depth: 10, perfectEmpties: 14, evaluator: "full", blunderRate: 0, thinkMin: 1800, thinkMax: 4000 },
]);

export const TIER_KEYS = TIERS.map((tier) => tier.key);

export function tierConfig(key) {
  return TIERS.find((tier) => tier.key === key) ?? TIERS[0];
}

// ─── ① 加权棋格表（Iago 公开权重，X 位按 PRD 取 −80）──────────────
//   角 100 / X 位 −80 / C 位 −20 / 边 10（近角）| 5（远角） / 第二圈 −2 / 内圈 1
// 这张表是黑白棋新手教学的黄金素材，也直接作为"棋手档"的评估核心。
export const SQUARE_TABLE = Object.freeze([
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -80, -2, -2, -2, -2, -80, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 1, 1, 1, -2, 5,
  5, -2, 1, 1, 1, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -80, -2, -2, -2, -2, -80, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
]);

// ─── 阶段化权重（本作 AI 的灵魂）─────────────────────────────────
// ★ 中局绝不给"当前子数领先"正权重 —— 中盘领先子数是负资产，这是新手 AI 与成熟 AI
//   的分水岭。子数对等（Coin Parity）仅在全局手数 ≥ 46 或空位 ≤ 18 时才计入。
// 各因子都已归一到 ±100，权重只表达"这个阶段里谁说话更响"。
const BASE_WEIGHTS = Object.freeze({
  opening: { square: 18, mobility: 42, stability: 8, corner: 26, parity: 0 },
  midgame: { square: 20, mobility: 28, stability: 26, corner: 26, parity: 10 },
  endgame: { square: 10, mobility: 16, stability: 34, corner: 22, parity: 18 },
});

// 子数项的权重**只看放行闸门**，不跟随阶段基底 —— 闸门打开就一定有正权重。
// "手数 ≥ 46 或 空位 ≤ 18"这两条一旦命中，说明已经进入可数的区间（前终局）。
const DISC_WEIGHT_WHEN_ALLOWED = Object.freeze({ opening: 0, midgame: 6, endgame: 10 });

export function phaseOf(movesPlayed) {
  if (movesPlayed <= 20) return "opening";
  if (movesPlayed <= 45) return "midgame";
  return "endgame";
}

// 稳定子是唯一昂贵因子（泛洪 + 不动点），空位多时算它纯属浪费、权重也低。
// 阈值由 benchmark 实测确定（见 tests/ai.test.mjs 的性能断言），不靠猜。
export const STABILITY_EMPTY_LIMIT = 34;

export function phaseWeights(movesPlayed, empties) {
  const phase = phaseOf(movesPlayed);
  const base = BASE_WEIGHTS[phase];
  const discAllowed = movesPlayed >= 46 || empties <= 18;
  return {
    phase,
    discAllowed,
    square: base.square,
    mobility: base.mobility,
    stability: base.stability,
    corner: base.corner,
    parity: base.parity,
    disc: discAllowed ? DISC_WEIGHT_WHEN_ALLOWED[phase] : 0,
  };
}

function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

// ─── ② 机动性 ─────────────────────────────────────────────────────
// 己方合法着法数 − 对手合法着法数。黑白棋的胜负主要由"谁把对方逼到无路可走"决定，
// 因此这一项在中局权重最高。实境幅度约 ±12，×8 归一到 ±100。
export function mobilityValue(board, player) {
  const mine = legalMoves(board, player).length;
  const foe = legalMoves(board, other(player)).length;
  return clamp((mine - foe) * 8, -100, 100);
}

// ─── ③ 加权棋格表 ─────────────────────────────────────────────────
// 满盘极端约 ±400，÷4 归一到 ±100。
export function squareValue(board, player) {
  let raw = 0;
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const cell = board[i];
    if (cell === EMPTY) continue;
    raw += cell === player ? SQUARE_TABLE[i] : -SQUARE_TABLE[i];
  }
  return clamp(Math.round(raw / 4), -100, 100);
}

// ─── ④ 稳定子（泛洪）─────────────────────────────────────────────
// 复用 engine 的保守实现：只漏判不误判，因此"稳定子被翻转"永远不会发生。
// 实境幅度约 ±40，×2.5 归一到 ±100。
export function stabilityValue(board, player, empties) {
  if (empties > STABILITY_EMPTY_LIMIT) return 0;
  const { black, white } = stableCounts(board);
  const diff = player === BLACK ? black - white : white - black;
  return clamp(Math.round(diff * 2.5), -100, 100);
}

// ─── ⑤ 角保有 ─────────────────────────────────────────────────────
// 角本体 10 分，两条邻边各最多 3 格、每格 2 分（护卫边）。
// 单角满分 22，四角满分 88 → 归一到 ±100。
const CORNER_EDGES = [
  { corner: indexOf(0, 0), dirs: [[0, 1], [1, 0]] },
  { corner: indexOf(0, 7), dirs: [[0, -1], [1, 0]] },
  { corner: indexOf(7, 0), dirs: [[0, 1], [-1, 0]] },
  { corner: indexOf(7, 7), dirs: [[0, -1], [-1, 0]] },
];

export function cornerValue(board, player) {
  let score = 0;
  for (const { corner, dirs } of CORNER_EDGES) {
    const owner = board[corner];
    if (owner === EMPTY) continue;
    const sign = owner === player ? 1 : -1;
    let unit = 10;
    for (const [dr, dc] of dirs) {
      let r = Math.floor(corner / SIZE) + dr;
      let c = (corner % SIZE) + dc;
      let run = 0;
      while (run < 3 && r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[indexOf(r, c)] === owner) {
        run += 1;
        unit += 2;
        r += dr;
        c += dc;
      }
    }
    score += sign * unit;
  }
  return clamp(Math.round((score * 100) / 88), -100, 100);
}

// ─── ⑥ 奇偶性 & 子数对等 ─────────────────────────────────────────
// 空位为奇数 ⇒ 行棋方拿到全局最后一手，+1；偶数 ⇒ −1。
// 天然只有 ±1，靠权重放大，不做归一化。
export function parityValue(empties) {
  return empties % 2 === 1 ? 1 : -1;
}

// 子数差。仅在 phaseWeights 放行（手数 ≥ 46 或空位 ≤ 18）时才会被乘上非零权重。
export function discValue(board, player) {
  const { black, white } = countDiscs(board);
  const diff = player === BLACK ? black - white : white - black;
  return clamp(Math.round(diff * 1.5), -100, 100);
}

// ─── 评估函数总装 ─────────────────────────────────────────────────
// 五要素全开 + 阶段化加权（名手 / 无谬档）。
export function evaluate(board, player, options = {}) {
  const empties = options.empties ?? countDiscs(board).empty;
  const weights = phaseWeights(60 - empties, empties);
  return (
    weights.square * squareValue(board, player) +
    weights.mobility * mobilityValue(board, player) +
    weights.stability * stabilityValue(board, player, empties) +
    weights.corner * cornerValue(board, player) +
    weights.parity * parityValue(empties) +
    weights.disc * discValue(board, player)
  );
}

// 棋手档：只开棋格表 + 机动性，各 50%。
export function evaluateSimple(board, player) {
  return Math.round((squareValue(board, player) + mobilityValue(board, player)) / 2);
}

// 见习档：完全不看五要素，只认"这一手翻了几枚子"。
export function evaluateFlips(board, player, move) {
  return flipsFor(board, move, player).length;
}

export function evaluatorFor(name) {
  return name === "simple" ? evaluateSimple : evaluate;
}

// ─── 置换表 & 时钟 ────────────────────────────────────────────────
const FLAG_EXACT = 0;
const FLAG_LOWER = 1;
const FLAG_UPPER = 2;

// 每隔多少节点看一次时钟。256 是"时钟调用开销 vs abort 响应速度"的实测平衡点。
const CLOCK_EVERY = 256;

// 默认段内硬顶（毫秒）。段 = 一棵根着法子树，边界处异步驱动会让出主线程。
export const DEFAULT_SEGMENT_MS = 60;

function shouldAbort(ctx) {
  if (ctx.abort) return true;
  const elapsed = ctx.now() - ctx.segStart;
  const total = ctx.now() - ctx.started;
  if (Number.isFinite(ctx.totalMs) && total > ctx.totalMs) {
    // 总预算耗尽：比段顶更硬，直接终止整档搜索（保留已完成层）
    ctx.abort = true;
    ctx.outOfBudget = true;
    return true;
  }
  if (!Number.isFinite(ctx.hardMs)) return false;
  if ((ctx.nodes & (CLOCK_EVERY - 1)) !== 0) return false;
  if (elapsed > ctx.hardMs) {
    ctx.abort = true;
    return true;
  }
  return false;
}

// ─── Negamax + Alpha-Beta + 置换表 + PVS(NegaScout) ───────────────
function negamax(board, player, depth, alpha, beta, ctx) {
  ctx.nodes += 1;
  if (shouldAbort(ctx)) return 0;

  if (depth <= 0) {
    // 满盘 → 真实终局子差；否则用评估函数。
    // 完美区间里 depth 与空位数恒等（每手各减 1，Pass 不减），所以"depth 见底 ⟺
    // 盘面已满"必然成立 —— 精确性由此成立，评估函数一次都不会被调用。
    return board.includes(EMPTY) ? ctx.evalFn(board, player) : finalDiff(board, player);
  }

  const key = `${board.join("")}|${player}|${depth}`;
  const hit = ctx.table.get(key);
  let hintedMove = -1;
  if (hit) {
    ctx.ttHits += 1;
    if (hit.flag === FLAG_EXACT) return hit.value;
    if (hit.flag === FLAG_LOWER && hit.value >= beta) return hit.value;
    if (hit.flag === FLAG_UPPER && hit.value <= alpha) return hit.value;
    hintedMove = hit.move;
  }

  const moves = legalMoves(board, player);
  if (moves.length === 0) {
    // 自己无子可下：对手也无可下 → 终局；否则让位（Pass 不消耗层数，因为盘面没变）
    if (legalMoves(board, other(player)).length === 0) return finalDiff(board, player);
    return -negamax(board, other(player), depth, -beta, -alpha, ctx);
  }

  const alphaOrig = alpha;
  const ordered = orderedMoves(board, player, moves);
  if (hintedMove >= 0) {
    const at = ordered.findIndex((item) => item.move === hintedMove);
    if (at > 0) ordered.unshift(ordered.splice(at, 1)[0]);
  }

  let best = -INF;
  let bestMove = ordered[0].move;
  let searched = 0;

  for (const item of ordered) {
    if (item.child === null) continue;
    let value;
    if (searched === 0) {
      value = -negamax(item.child, other(player), depth - 1, -beta, -alpha, ctx);
    } else {
      // NegaScout：先用空窗试探，fail-high 才用真窗口重搜
      value = -negamax(item.child, other(player), depth - 1, -alpha - 1, -alpha, ctx);
      if (!ctx.abort && value > alpha && value < beta) {
        value = -negamax(item.child, other(player), depth - 1, -beta, -alpha, ctx);
      }
    }
    searched += 1;
    if (ctx.abort) return 0; // 中止：绝不把半个节点的值写进表
    if (value > best) {
      best = value;
      bestMove = item.move;
    }
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }

  if (ctx.abort) return 0;
  const flag = best <= alphaOrig ? FLAG_UPPER : best >= beta ? FLAG_LOWER : FLAG_EXACT;
  ctx.table.set(key, { value: best, flag, move: bestMove, depth });
  return best;
}

// ─── 根节点搜索（生成器：每个根着法子树之间是一个切片边界）────────
function* rootSteps(board, player, depth, ctx) {
  const moves = legalMoves(board, player);
  if (moves.length === 0) {
    // 根节点让位：分数由对手行动决定
    if (legalMoves(board, other(player)).length === 0) {
      return { move: -1, score: finalDiff(board, player), scored: [], passed: true, aborted: false };
    }
    const score = -negamax(board, other(player), depth, -INF, INF, ctx);
    return { move: -1, score, scored: [], passed: true, aborted: ctx.abort };
  }

  const ordered = orderedMoves(board, player, moves);
  let alpha = -INF;
  let best = -INF;
  let bestMove = ordered[0].move;
  const scored = [];

  for (const item of ordered) {
    if (item.child === null) continue;
    yield null; // ← 切片边界：驱动方在这里决定"继续算"还是"先让出主线程"
    const value = -negamax(item.child, other(player), depth - 1, -INF, -alpha, ctx);
    if (ctx.abort) return { move: bestMove, score: best, scored, passed: false, aborted: true };
    scored.push({ move: item.move, score: value });
    if (value > best) {
      best = value;
      bestMove = item.move;
      alpha = value;
    }
  }
  return { move: bestMove, score: best, scored, passed: false, aborted: false };
}

// ─── 整档搜索（生成器）：迭代加深 + 中止同层重试 + 完美区间直落 ────
function* tierSteps(board, player, tier, ctx, settings) {
  const empties = countDiscs(board).empty;
  const exact = empties > 0 && empties <= tier.perfectEmpties;
  // 完美区间：搜索深度 ≥ 空位数，评估函数永远碰不到 → 结果就是**精确终局值**
  const maxDepth = exact ? empties : tier.depth;
  const minDepth = exact || tier.depth <= 1 ? maxDepth : 1;

  let result = null;
  let completedDepth = 0;
  let aborts = 0;

  for (let depth = minDepth; depth <= maxDepth; ) {
    if (ctx.outOfBudget) break;
    ctx.depth = depth;
    ctx.abort = false;
    ctx.segStart = ctx.now();
    const attempt = yield* rootSteps(board, player, depth, ctx);

    if (attempt.aborted) {
      aborts += 1;
      if (ctx.outOfBudget) break;
      if (attempt.scored.length === 0) {
        // 第一个根着法的子树就超顶 → 寸步难行，抬高段顶再试（否则会死循环）
        ctx.hardMs = Math.min(ctx.hardMs * 2, 960);
      }
      continue; // 同层重试：刚攒下的置换表会把已算完的子树直接喂回来
    }

    result = attempt;
    completedDepth = depth;
    ctx.hardMs = settings.baseHardMs;
    if (exact) break;
    if (minDepth === maxDepth) break;
    depth += 1;
  }

  return {
    tier: tier.key,
    evaluator: tier.evaluator,
    move: result ? result.move : -1,
    score: result ? result.score : 0,
    scored: result ? result.scored : [],
    passed: result ? result.passed : false,
    depth: completedDepth,
    exact,
    empties,
    nodes: ctx.nodes,
    ttHits: ctx.ttHits,
    yields: ctx.yields,
    aborts,
    budgetExhausted: Boolean(ctx.outOfBudget),
  };
}

// ─── 失误注入 ─────────────────────────────────────────────────────
// "随机选一个次优着法"：候选集 = 所有非最优根着法。抽样顺序写死
// （先判是否失误，再抽候选），保证同种子必然同结果。
function applyBlunder(result, tier, rng) {
  if (!rng || tier.blunderRate <= 0) return result;
  if (result.passed || result.move < 0) return result;
  const suboptimal = result.scored.filter((item) => item.move !== result.move && item.score < result.score);
  if (suboptimal.length === 0) return result;
  if (!(rng() < tier.blunderRate)) return result;
  const index = Math.floor(rng() * suboptimal.length);
  return { ...result, move: suboptimal[index].move, blundered: true };
}

// ─── 对外入口 ─────────────────────────────────────────────────────
function buildContext(settings) {
  const started = settings.now();
  return {
    nodes: 0,
    abort: false,
    outOfBudget: false,
    depth: 1,
    table: new Map(),
    yieldMs: settings.yieldMs,
    hardMs: settings.baseHardMs,
    totalMs: settings.totalMs,
    now: settings.now,
    started,
    segStart: started,
    ttHits: 0,
    yields: 0,
    evalFn: settings.evalFn,
  };
}

// 见习档：1 层、只看翻转数。并列时按 rng 取一（未注入 rng 时取索引最小者）。
function noviceResult(board, player, tier, rng) {
  const moves = legalMoves(board, player);
  if (moves.length === 0) {
    const blocked = countDiscs(board).empty === 0 || legalMoves(board, other(player)).length === 0;
    return {
      tier: tier.key, evaluator: "flips", move: -1,
      score: blocked ? finalDiff(board, player) : 0,
      scored: [], passed: true, depth: 0, exact: false,
      empties: countDiscs(board).empty, nodes: 0, ttHits: 0, yields: 0, aborts: 0,
      budgetExhausted: false,
    };
  }
  const scored = moves.map((move) => ({ move, score: evaluateFlips(board, player, move) }));
  const best = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === best);
  const chosen = rng ? winners[Math.floor(rng() * winners.length)] : winners[0];
  return {
    tier: tier.key, evaluator: "flips", move: chosen.move, score: best,
    scored: scored.slice().sort((a, b) => a.move - b.move),
    passed: false, depth: 1, exact: false,
    empties: countDiscs(board).empty, nodes: moves.length, ttHits: 0, yields: 0, aborts: 0,
    budgetExhausted: false,
  };
}

// 同步：榨干生成器。用于单元测试、题库产线与离线校验 —— 不设让步、不设硬顶、不限预算，
// 因此结果与异步版在"未触发中止"时逐位相同。
export function chooseMove(board, player, tierKey, options = {}) {
  const tier = tierConfig(tierKey);
  const rng = options.rng ?? null;
  if (tier.evaluator === "flips") return applyBlunder(noviceResult(board, player, tier, rng), tier, rng);

  const now = options.now ?? (() => Date.now());
  const settings = {
    now,
    yieldMs: Infinity,
    baseHardMs: Infinity,
    totalMs: Infinity,
    evalFn: evaluatorFor(options.evaluator ?? tier.evaluator),
  };
  const ctx = buildContext(settings);
  const drivers = tierSteps(board, player, tier, ctx, settings);
  let step = drivers.next();
  while (!step.done) step = drivers.next();
  return applyBlunder(step.value, tier, rng);
}

// 异步分块：每个切片边界检查是否该让出主线程，让天平与曲线动画保持 60fps。
export async function think(board, player, tierKey, options = {}) {
  const tier = tierConfig(tierKey);
  const rng = options.rng ?? null;
  if (tier.evaluator === "flips") return applyBlunder(noviceResult(board, player, tier, rng), tier, rng);

  const empties = countDiscs(board).empty;
  const inPerfectZone = empties > 0 && empties <= tier.perfectEmpties;
  const now = options.now ?? (() => Date.now());
  const settings = {
    now,
    yieldMs: options.yieldMs ?? 12,
    // 完美区间不设段顶：精确性优先，靠"按根着法切片"把阻塞压到一棵子树的量级
    baseHardMs: options.hardMs ?? (inPerfectZone ? Infinity : DEFAULT_SEGMENT_MS),
    // 中局用整档思考时长做总预算：段顶到了就同层重试，预算到了就停在最深的完成层
    totalMs: options.totalMs ?? (inPerfectZone ? Infinity : tier.thinkMax),
    evalFn: evaluatorFor(options.evaluator ?? tier.evaluator),
  };
  const ctx = buildContext(settings);
  const yielder = options.yielder ?? (() => new Promise((resolve) => setTimeout(resolve, 0)));
  const drivers = tierSteps(board, player, tier, ctx, settings);
  let step = drivers.next();
  while (!step.done) {
    if (now() - ctx.segStart >= settings.yieldMs) {
      await yielder();
      ctx.segStart = now();
      ctx.yields += 1;
    }
    step = drivers.next();
  }
  return applyBlunder({ ...step.value, yields: ctx.yields }, tier, rng);
}
