// 盲盒竞拍 · 规则唯一权威（DOM-free 纯函数状态机）
// ------------------------------------------------------------------
// 对标成熟范式：
//  - 仓库盲盒竞拍爆款：公开提示 + 专属私密提示的情报结构、2 倍截胡成交；
//  - For Sale：暗标同时亮价、价高者得、止损直觉；
//  - Skull：高难度 AI "建立模式再打破"伪装（由 ai.mjs 实现）。
// 双轨经济：资金轨（现金硬约束）+ 估值轨（真值 × 行情系数 0.5~1.8）。
// 不变量：
//  - 出价 ∈ [0, cash] 整数；cash 永不为负；
//  - phase 严格流转 bid → reveal → open → (bid | done)；
//  - 终局（done）上一切操作返回 null（no-op）；
//  - 全部随机逻辑注入确定性种子 PRNG（mulberry32），同种子 100% 重放一致。
// ------------------------------------------------------------------

export const ROUNDS = 5;
export const PLAYER_COUNT = 4;
export const START_CASH = 10000;
export const HOARDER_CASH = 12000;
export const MIN_VALUE = 2000;
export const MAX_VALUE = 30000;
export const MIN_COEF = 0.5;
export const MAX_COEF = 1.8;
export const SNIPER_MULT = 2;   // 截胡触发：第一名 ≥ 第二名 × 2
export const SNIPER_PAY = 1.5;  // 截胡支付：第二名出价 × 1.5
export const GUARANTEE_SUM = 6000; // 5 箱真值总和下限（无死局保证）

export const CATEGORIES = ["antique", "art", "misc", "metal", "toy"];
export const DIFFICULTIES = ["easy", "standard", "hard"];
export const CHARACTERS = ["detective", "expert", "gossip", "hoarder"];
export const PHASES = ["bid", "reveal", "open", "done"];
export const ROUND_TYPES = ["hot", "cold", "flat", "hidden"];

// 品类平均真值（无价值线索时的先验）
export const CATEGORY_AVG = { antique: 16000, art: 15000, misc: 8000, metal: 10000, toy: 12000 };

// ---------------------------------------------------------------- PRNG

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 从主种子派生独立的子随机源：同一 (seed, salts) 永远得到同一序列。
export function deriveRng(seed, ...salts) {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const s of salts) {
    h = Math.imul(h ^ (Number(s) >>> 0), 0x85ebca6b);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= h >>> 13;
  return mulberry32(h >>> 0);
}

function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function round5(value) {
  return Math.round(value / 0.05) * 0.05;
}

// ---------------------------------------------------------------- 行情生成

// 每回合行情：5 品类各一个真实系数 [0.5, 1.8]；
// 公开 2 热 1 冷 1 平（公告模糊区间），1 个品类行情隐藏（私密情报才可能揭示）。
export function genMarket(rng) {
  const shuffled = [...CATEGORIES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const [hotA, hotB, cold, flat, hidden] = shuffled;
  const coef = {};
  const publicReport = { hot: [], cold: [], flat: [], hidden };
  const assign = (cat, type) => {
    let value;
    if (type === "hot") value = 1.3 + rng() * 0.5;      // 1.3 ~ 1.8
    else if (type === "cold") value = 0.5 + rng() * 0.3; // 0.5 ~ 0.8
    else if (type === "flat") value = 0.9 + rng() * 0.2; // 0.9 ~ 1.1
    else value = 0.5 + rng() * 1.3;                      // 0.5 ~ 1.8（隐藏）
    value = Math.min(MAX_COEF, Math.max(MIN_COEF, value));
    coef[cat] = value;
    if (type === "hot" || type === "cold" || type === "flat") {
      const lo = Math.min(MAX_COEF, Math.max(MIN_COEF, round5(value - 0.12)));
      const hi = Math.min(MAX_COEF, Math.max(MIN_COEF, round5(value + 0.12)));
      publicReport[type].push({ cat, lo, hi });
    }
    return value;
  };
  assign(hotA, "hot");
  assign(hotB, "hot");
  assign(cold, "cold");
  assign(flat, "flat");
  assign(hidden, "hidden");
  return { coef, publicReport, hot: [hotA, hotB], cold, flat, hidden };
}

// 行情区间中点（AI / UI 用公开情报估计系数）
export function reportMid(report) {
  return (report.lo + report.hi) / 2;
}

// ---------------------------------------------------------------- 仓库生成

// 公开线索 3 条 + 每位玩家 1~2 条私密线索（intelLevel 决定）。
// signal: { cat?: 品类指向, w: 强度 } 或 { value?: {lo,hi}, w }。
function genCategoryHint(rng, crate, isDecoy) {
  const target = isDecoy ? CATEGORIES[Math.floor(rng() * CATEGORIES.length)] : crate.category;
  const kinds = ["weight", "label", "decoration", "seal", "sound"];
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const w = isDecoy ? 0.2 + rng() * 0.2 : 0.4 + rng() * 0.3;
  return { kind, cat: target, w, decoy: isDecoy };
}

function genValueHint(rng, crate) {
  const span = 0.2 + rng() * 0.25; // ±20%~45%
  const lo = Math.max(500, Math.round((crate.trueValue * (1 - span)) / 100) * 100);
  const hi = Math.min(40000, Math.round((crate.trueValue * (1 + span)) / 100) * 100);
  const kinds = ["declared", "scan", "size", "condition"];
  const kind = kinds[Math.floor(rng() * kinds.length)];
  return { kind, value: { lo, hi }, w: 0.7 + rng() * 0.2 };
}

function genCrate(rng, market, players) {
  const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
  const trueValue = Math.round((MIN_VALUE + rng() * (MAX_VALUE - MIN_VALUE)) / 10) * 10;
  const crate = { category, trueValue, publicHints: [], privateHints: [] };
  // 公开线索：2 条品类线索（70% 真实指向、30% 干扰）+ 1 条价值线索
  const catHintCount = 2;
  for (let i = 0; i < catHintCount; i++) {
    crate.publicHints.push(genCategoryHint(rng, crate, rng() < 0.3));
  }
  crate.publicHints.push(genValueHint(rng, crate));
  // 私密线索：每人 intelLevel 条（至少 0 条；detective 预留第 2 条由技能解锁）
  for (const player of players) {
    const list = [];
    const count = Math.max(0, Math.min(2, player.intelLevel || 1));
    for (let i = 0; i < count; i++) {
      if (rng() < 0.55) list.push(genCategoryHint(rng, crate, false));
      else list.push(genValueHint(rng, crate));
    }
    // detective 额外一条更精准的私密线索（技能解锁后才可见）
    if (player.character === "detective" && player.kind === "human") {
      const extra = rng() < 0.5
        ? { kind: "scan", cat: crate.category, w: 0.85, decoy: false }
        : { kind: "declared", value: {
            lo: Math.max(500, Math.round((crate.trueValue * 0.75) / 100) * 100),
            hi: Math.min(40000, Math.round((crate.trueValue * 1.2) / 100) * 100) },
            w: 0.9 };
      list.push({ ...extra, skillLocked: true });
    }
    crate.privateHints.push(list);
  }
  return crate;
}

function genRounds(rng, players) {
  let rounds;
  let attempts = 0;
  do {
    rounds = [];
    for (let r = 0; r < ROUNDS; r++) {
      const market = genMarket(rng);
      rounds.push({ market, crate: genCrate(rng, market, players) });
    }
    const sum = rounds.reduce((acc, rd) => acc + rd.crate.trueValue, 0);
    if (sum >= GUARANTEE_SUM || ++attempts > 50) return rounds;
  } while (true);
}

// ---------------------------------------------------------------- 估值辅助（AI / UI 共用）

// 综合 hints 估计箱子真值：返回 { value, confidence, catGuess }。
// hints 元素：{ cat?, w, value?: {lo,hi} }
export function estimateCrate(crate, hints) {
  let value = 0;
  let wSum = 0;
  const catW = {};
  for (const hint of hints || []) {
    if (hint && hint.value && hint.w > 0) {
      value += ((hint.value.lo + hint.value.hi) / 2) * hint.w;
      wSum += hint.w;
    }
    if (hint && hint.cat && hint.w > 0) {
      catW[hint.cat] = (catW[hint.cat] || 0) + hint.w;
    }
  }
  let catGuess = crate.category;
  let best = 0;
  for (const [cat, w] of Object.entries(catW)) {
    if (w > best) { best = w; catGuess = cat; }
  }
  if (wSum === 0) value = CATEGORY_AVG[catGuess] || 12000;
  const confidence = Math.min(1, 0.25 + (wSum || 0) + best * 0.3);
  return { value: Math.round(value), confidence, catGuess };
}

// 玩家可查看的估值区间（UI 展示）；expert 技能收窄 50%。
export function estimateRange(crate, hints, narrow) {
  const { value, confidence } = estimateCrate(crate, hints);
  const spread = 0.3 + (1 - confidence) * 0.4;
  let lo = Math.max(0, Math.round(value * (1 - spread)));
  let hi = Math.min(40000, Math.round(value * (1 + spread)));
  if (narrow) {
    const mid = (lo + hi) / 2;
    const half = ((hi - lo) / 2) * 0.5;
    lo = Math.round(mid - half);
    hi = Math.round(mid + half);
  }
  return { lo, hi };
}

// ---------------------------------------------------------------- 玩家 / 对局构建

export function createGame(seed, opts = {}, players) {
  const difficulty = DIFFICULTIES.includes(opts.difficulty) ? opts.difficulty : "standard";
  const character = CHARACTERS.includes(opts.character) ? opts.character : "detective";
  const mode = opts.mode === "challenge" ? "challenge" : "free";
  const challengeId = opts.challengeId ?? null;
  const rng = mulberry32(seed >>> 0);
  const rounds = genRounds(rng, players);
  const initial = players.map((p, i) => ({
    id: i,
    kind: p.kind,
    personaId: p.personaId ?? null,
    intelLevel: p.intelLevel ?? 1,
    cash: p.cash,
    initialCash: p.cash,
    character: p.character ?? null,
    skillUsed: false,
    extraHintRevealed: false,
    estimateNarrow: false,
    gossipTarget: null,
    emotion: null,
    dossier: { bids: [], wins: 0, losses: 0 },
  }));
  return {
    seed: seed >>> 0,
    difficulty,
    character,
    mode,
    challengeId,
    roundIndex: 0,
    phase: "bid",
    market: rounds[0].market,
    crate: rounds[0].crate,
    rounds,
    players: initial,
    bids: [null, null, null, null],
    reveal: null,
    open: null,
    log: [],
    result: null,
  };
}

export function currentCrate(state) {
  return state.crate;
}

export function currentMarket(state) {
  return state.market;
}

// ---------------------------------------------------------------- 意图：出价

// 合法：phase === "bid"、amount 为整数、0 ≤ amount ≤ cash。
// 非法返回 null（静默忽略，绝不抛错）。
export function bid(state, playerIndex, amount) {
  if (state.phase !== "bid") return null;
  if (!Number.isInteger(amount)) return null;
  const player = state.players[playerIndex];
  if (!player) return null;
  if (amount < 0 || amount > player.cash) return null;
  const next = clone(state);
  next.bids[playerIndex] = amount;
  next.log.push({ t: "bid", player: playerIndex, amount });
  return next;
}

// 超时未出价：视同出价 0（仅对未出价者生效）。
export function forceBidZero(state, playerIndex) {
  if (state.phase !== "bid") return null;
  if (state.bids[playerIndex] != null) return null;
  const next = clone(state);
  next.bids[playerIndex] = 0;
  next.log.push({ t: "bid", player: playerIndex, amount: 0, timeout: true });
  return next;
}

// ---------------------------------------------------------------- 意图：角色技能（每回合 1 次）

export function useSkill(state, playerIndex, targetIndex) {
  if (state.phase !== "bid") return null;
  const player = state.players[playerIndex];
  if (!player || player.kind !== "human") return null;
  if (player.skillUsed) return null;
  const next = clone(state);
  const p = next.players[playerIndex];
  if (player.character === "detective") {
    const list = next.crate.privateHints[playerIndex] || [];
    const locked = list.find((h) => h.skillLocked);
    if (!locked) return null;
    p.extraHintRevealed = true;
    p.skillUsed = true;
  } else if (player.character === "expert") {
    p.estimateNarrow = true;
    p.skillUsed = true;
  } else if (player.character === "gossip") {
    if (targetIndex == null) return null;
    const target = next.players[targetIndex];
    if (!target || target.kind !== "ai") return null;
    p.gossipTarget = targetIndex;
    p.skillUsed = true;
  } else {
    // hoarder 为被动角色，无主动技能
    return null;
  }
  next.log.push({ t: "skill", player: playerIndex, character: player.character, target: targetIndex ?? null });
  return next;
}

// ---------------------------------------------------------------- 结算：亮价

export function resolveRound(state) {
  if (state.phase !== "bid") return null;
  const next = clone(state);
  const bids = next.bids.map((b) => (b == null ? 0 : b));
  const order = [0, 1, 2, 3].sort((a, b) => bids[b] - bids[a] || a - b);
  const winner = order[0];
  const second = order[1];
  const b1 = bids[winner];
  const b2 = bids[second];
  let pay = b1;
  let snipe = false;
  if (b2 > 0 && b1 >= b2 * SNIPER_MULT) {
    pay = Math.ceil(b2 * SNIPER_PAY);
    snipe = true;
  }
  const ranked = order.map((i) => ({ i, amount: bids[i] }));
  next.players[winner].cash -= pay;
  next.reveal = { winner, second, pay, snipe, ranked };
  // 画像记录：每个 AI 的当回合出价
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const p = next.players[i];
    if (p.kind === "ai") {
      p.dossier.bids.push({ round: next.roundIndex + 1, amount: bids[i], win: i === winner });
    }
  }
  next.phase = "reveal";
  next.log.push({ t: "resolve", winner, pay, snipe, bids });
  return next;
}

// ---------------------------------------------------------------- 结算：开箱

export function openCrate(state) {
  if (state.phase !== "reveal") return null;
  const next = clone(state);
  const crate = next.crate;
  const coef = next.market.coef[crate.category];
  const value = Math.round(crate.trueValue * coef);
  const reveal = next.reveal;
  const winner = reveal.winner;
  const profit = value - reveal.pay;
  next.players[winner].cash += value;
  next.open = { winner, trueValue: crate.trueValue, coef, value, profit, category: crate.category };
  const p = next.players[winner];
  p.emotion = { personaId: p.personaId, kind: profit >= 0 ? "win" : "lose", profit };
  if (p.kind === "ai") {
    if (profit >= 0) p.dossier.wins += 1;
    else p.dossier.losses += 1;
    p.dossier.bids[p.dossier.bids.length - 1].profit = profit;
  }
  next.phase = "open";
  next.log.push({ t: "open", winner, trueValue: crate.trueValue, coef, value, profit });
  return next;
}

// ---------------------------------------------------------------- 下一回合 / 终局

export function computeAssets(state) {
  const assets = state.players
    .map((p, i) => ({ i, asset: p.cash, personaId: p.personaId, kind: p.kind }))
    .sort((a, b) => b.asset - a.asset || a.i - b.i);
  return { rank: assets.map((a) => a.i), assets };
}

export function nextRound(state) {
  if (state.phase !== "open") return null;
  if (state.roundIndex >= ROUNDS - 1) {
    const next = clone(state);
    next.phase = "done";
    next.result = computeAssets(next);
    next.log.push({ t: "done", result: next.result });
    return next;
  }
  const next = clone(state);
  next.roundIndex += 1;
  next.market = next.rounds[next.roundIndex].market;
  next.crate = next.rounds[next.roundIndex].crate;
  next.bids = [null, null, null, null];
  next.reveal = null;
  next.open = null;
  for (const p of next.players) {
    p.skillUsed = false;
    p.extraHintRevealed = false;
    p.estimateNarrow = false;
    p.gossipTarget = null;
    p.emotion = null;
  }
  next.phase = "bid";
  next.log.push({ t: "round", round: next.roundIndex + 1 });
  return next;
}

// ---------------------------------------------------------------- 工具

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

// 人类玩家索引（首个 kind === "human"）
export function humanIndex(state) {
  return state.players.findIndex((p) => p.kind === "human");
}

// 玩家可见的私密线索（detective 解锁后才包含技能锁定的那条）
export function visiblePrivateHints(state, playerIndex) {
  const list = state.crate.privateHints[playerIndex] || [];
  const p = state.players[playerIndex];
  if (p && p.extraHintRevealed) return list;
  return list.filter((h) => !h.skillLocked);
}

// 对手画像摘要（UI 展示 AI 的倾向仪表）
export function dossierSummary(player) {
  const bids = player.dossier.bids || [];
  const spent = bids.reduce((acc, b) => acc + (b.amount || 0), 0);
  const wins = bids.filter((b) => b.win).length;
  return { rounds: bids.length, spent, wins, losses: player.dossier.losses, winRate: bids.length ? wins / bids.length : 0 };
}
