// bot.mjs —— 影子玩家：确定性 BFS 贪吃 + 避影权重。用于第五道验收（跑图通过率）与编辑台预演。
// 纯逻辑，通过 engine.intent 走真实操作通道，DOM-free。

import {
  createState,
  stepFrame,
  intent,
  buildField,
  charAt,
  isWalkableTile,
  DIRS,
  NONE,
  dirIndex,
  reverseDir,
  isTerminal,
} from "./engine.mjs";

const TICK_MS = 1000 / 60;

function liveGoals(state) {
  const L = state.layout;
  const out = [];
  for (let y = 0; y < L.height; y += 1) {
    for (let x = 0; x < L.width; x += 1) {
      const k = y * L.width + x;
      if (state.pearlGrid[k] || state.dotGrid[k]) out.push({ x, y });
    }
  }
  return out;
}

function frightenedGhosts(state) {
  return state.ghosts.filter((g) => g.st === "fright").map((g) => ({ x: Math.round(g.x), y: Math.round(g.y) }));
}

/** 在场影魅的多源距离场：value = 到最近一只伤人影魅的步数（匣中/归巢影魅不伤人，故不入源） */
function ghostField(state) {
  const src = state.ghosts
    .filter((g) => g.st === "normal" || g.st === "fright")
    .map((g) => ({ x: Math.round(g.x), y: Math.round(g.y) }));
  if (!src.length) return null;
  return buildField(state.layout, src, "player");
}

/** 实体沿当前方向前进后即将到达的那一格（含暗巷跨界） */
function nextTile(layout, ent) {
  if (ent.dirIdx === NONE) return { x: ent.x, y: ent.y };
  const d = DIRS[ent.dirIdx];
  let nx = ent.x + d.x;
  const ny = ent.y + d.y;
  if (!isWalkableTile(charAt(layout, nx, ny))) return { x: ent.x, y: ent.y };
  if (nx < 0) nx = layout.wrapRows.includes(ent.y) ? layout.width - 1 : ent.x;
  else if (nx >= layout.width) nx = layout.wrapRows.includes(ent.y) ? 0 : ent.x;
  return { x: nx, y: ny };
}

/** 决策锚点格：wantIdx 在下一格到达时才生效，所以必须提前那一格来选路 */
function anchorTile(state) {
  const p = state.player;
  return p.prog > 0 ? nextTile(state.layout, p) : { x: p.x, y: p.y };
}

/** 单源 BFS 找「最近的一口」：多源会把梯度抹平成一片 0，所以必须锁定单个目标 */
function nearestTarget(state, from, tiles) {
  const L = state.layout;
  if (!tiles.length) return null;
  const field = buildField(L, [from], "player");
  let best = null;
  let bestD = Infinity;
  for (const t of tiles) {
    const d = field[t.y * L.width + t.x];
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best ?? tiles[0];
}

function nearestCrumb(state, from, danger) {
  const L = state.layout;
  const tiles = liveGoals(state);
  if (!tiles.length) return null;
  const field = buildField(L, [from], "player");
  let best = null;
  let bestScore = Infinity;
  for (const t of tiles) {
    const k = t.y * L.width + t.x;
    const d = field[k];
    if (d < 0) continue;
    const raw = danger ? danger[k] : 99;
    const near = raw < 0 ? 99 : raw;
    const score = d + (near < 5 ? (5 - near) * 6 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best ?? tiles[0];
}

function tileHasCrumb(state, t) {
  if (!t) return false;
  const k = t.y * state.layout.width + t.x;
  return state.dotGrid[k] === 1 || state.pearlGrid[k] === 2;
}

/** 避险默认口径（七张手作巷子实测最优）：影魅 5 步内开始绕道，2 步内逃命，惊吓只剩 35% 时长就不再追杀 */
export const AVOID = { radius: 5, weight: 60, flee: 2, huntTail: 0.35 };

/** 影子玩家的下一步方向：目标场取最优，撞鬼则回避 */
export function botChooseDir(state, ctx) {
  const p = state.player;
  const avoid = { ...AVOID, ...(ctx.avoid ?? {}) };
  const huntTail = (state.cfg?.frightMs ?? 6000) * avoid.huntTail;
  const hunting = state.frightMs > huntTail;
  const anchor = anchorTile(state);
  ctx.tick = (ctx.tick ?? 0) + 1;
  const crumbGone = !hunting && !tileHasCrumb(state, ctx.goal);
  const goalStale = !ctx.goal || ctx.fieldHunt !== hunting || crumbGone;
  if (goalStale || ctx.tick % 12 === 0) {
    ctx.danger = hunting ? null : ghostField(state);
    const goal = hunting ? nearestTarget(state, anchor, frightenedGhosts(state)) : nearestCrumb(state, anchor, ctx.danger);
    ctx.goal = goal;
    ctx.field = goal ? buildField(state.layout, [goal], "player") : null;
    ctx.fieldHunt = hunting;
  } else if (!hunting) {
    ctx.danger = ghostField(state);
  }
  const L = state.layout;
  const opts = [];
  for (let d = 0; d < 4; d += 1) {
    const dd = DIRS[d];
    const nx = anchor.x + dd.x;
    const ny = anchor.y + dd.y;
    if (!isWalkableTile(charAt(L, nx, ny))) continue;
    opts.push({ d, x: nx, y: ny });
  }
  if (!opts.length) return -1;
  const back = reverseDir(p.dirIdx);
  const fwd = opts.filter((o) => o.d !== back);
  const pool = fwd.length ? fwd : opts;
  const hereRaw = ctx.danger ? ctx.danger[anchor.y * L.width + anchor.x] : -1;
  const fleeing = !hunting && hereRaw >= 0 && hereRaw <= avoid.flee;
  let best = null;
  let bestScore = Infinity;
  for (const o of pool) {
    const k = o.y * L.width + o.x;
    const reach = ctx.field ? ctx.field[k] : -1;
    const dist = reach < 0 ? 9999 : reach;
    const raw = ctx.danger ? ctx.danger[k] : -1;
    const safe = raw < 0 ? 99 : raw;
    let score;
    if (hunting) score = dist - 20;
    else if (fleeing) score = -safe * 40 + dist * 0.2 + (safe <= 0 ? 1e6 : 0);
    else score = dist + (safe <= avoid.radius ? (avoid.radius + 1 - safe) * avoid.weight : 0);
    if (score < bestScore - 0.05) {
      bestScore = score;
      best = o;
    }
  }
  return best ? best.d : -1;
}

/**
 * 跑一局：返回是否清巷、用时与熄灯数。maxMs 是「巷内时钟」上限。
 */
export function simulate({ rows, cfg, seed = 7, maxMs = 160000, mode = "campaign", bot }) {
  const state = createState({ rows, cfg, seed, mode });
  if (!state) return { ok: false, error: "unbuildable", cleared: false, timeMs: 0, deaths: 0 };
  const total = state.dotLeft + state.pearlLeft;
  const ctx = { field: null, fieldHunt: false, tick: 0, goal: null, danger: null, avoid: bot };
  let lastLeft = state.dotLeft + state.pearlLeft;
  let staleMs = 0;
  while (state.clock < maxMs && !isTerminal(state)) {
    if (state.status === "running") {
      const d = botChooseDir(state, ctx);
      if (d >= 0) intent(state, { type: "turn", dir: dirIndex(d) });
      stepFrame(state, TICK_MS);
      const left = state.dotLeft + state.pearlLeft;
      if (left === lastLeft) staleMs += TICK_MS;
      else {
        staleMs = 0;
        lastLeft = left;
      }
      if (staleMs > 20000) break;
    } else {
      ctx.goal = null;
      ctx.field = null;
      stepFrame(state, TICK_MS);
    }
  }
  return {
    ok: true,
    cleared: state.status === "cleared",
    lost: state.status === "lost",
    stuck: staleMs > 20000,
    timeMs: Math.round(state.clock),
    deaths: state.deaths,
    score: state.score,
    dotLeft: state.dotLeft + state.pearlLeft,
    total,
    longestTrain: state.stats.longestTrain,
  };
}

/** 第五道验收的探测口径：给足命，只看「巷子能不能被吃净」，不看影子玩家的本事 */
export const BOT_PROBE_CFG = { startLives: 99, frightMs: 5000 };

/** 探测阈值：低于 failEatRate 判 FAIL（巷子会在游戏里追着人打），低于 warnEatRate 只提示 */
export const BOT_GATE = { runs: 8, failEatRate: 0.55, warnEatRate: 0.75 };

/**
 * 第五道验收：注入种子跑 N 局，看影子玩家能把巷子吃净到什么程度。
 * 判据用吃净率而不是通关率——影魅进入「夜行决意」后比提灯人更快，贪心一步博弈的影子玩家
 * 注定收不了尾（真人可以），但「大片光尘根本吃不到」一定是巷子在追着人打，属于结构问题。
 */
export function botGate({
  rows,
  cfg = BOT_PROBE_CFG,
  bot,
  runs = BOT_GATE.runs,
  seed = 1234,
  minEatRate = BOT_GATE.failEatRate,
  warnEatRate = BOT_GATE.warnEatRate,
}) {
  let cleared = 0;
  let stuck = 0;
  let sumMs = 0;
  const eats = [];
  const lefts = [];
  for (let i = 0; i < runs; i += 1) {
    const r = simulate({ rows, cfg, bot, seed: (seed + i * 7919) >>> 0 });
    if (!r.ok) return { pass: false, reason: "unbuildable", runs: i };
    if (r.cleared) cleared += 1;
    if (r.stuck) stuck += 1;
    eats.push((r.total - r.dotLeft) / Math.max(1, r.total));
    lefts.push(r.dotLeft);
    sumMs += r.timeMs;
  }
  const eatRate = eats.reduce((s, e) => s + e, 0) / runs;
  const worstEatRate = Math.min(...eats);
  const clearRate = cleared / runs;
  const stuckRate = stuck / runs;
  const avgMs = Math.round(sumMs / runs);
  lefts.sort((a, b) => a - b);
  return {
    pass: eatRate >= minEatRate,
    warn: eatRate < warnEatRate,
    reason: eatRate >= minEatRate ? "ok" : `eatRate:${eatRate.toFixed(2)}`,
    eatRate: Number(eatRate.toFixed(3)),
    worstEatRate: Number(worstEatRate.toFixed(3)),
    clearRate: Number(clearRate.toFixed(3)),
    stuckRate: Number(stuckRate.toFixed(3)),
    avgMs,
    medianLeft: lefts[Math.floor(lefts.length / 2)],
    worstLeft: lefts[lefts.length - 1],
    runs,
    minEatRate,
    warnEatRate,
  };
}
