// engine.mjs —— 规则唯一权威：纯函数式回合状态机与连续物理，严格 DOM-free
//
// 心智模型：一只变色龙混进 5x5 萤光集会，向所在邻域平均色收敛伪装；猎手闭眼后，
// 变色龙在幕布内移动/换色/精调，睁眼后猎手扫探有限侦察点、交叉验证、指认。
// 全部数值 clamp 0–100，状态守恒：变色龙 1 只、居民数不变、回合数守恒；幕布阶段输入锁定；无 alert()。
//
// 连续量（融合度收敛 / 波纹渐隐 / 阶段计时）由固定步长 stepFrame(state, dt) 推进，
// 保证同种子逐帧一致、可重放。

import { mulberry32, hash32 } from "./rng.mjs";

export const GRID = 5;
export const CELL_COUNT = GRID * GRID;
export const COLOR_COUNT = 5;

export const PALETTE = [
  { id: 0, key: "warmYellow", hue: 48, css: "#f4c14b" },
  { id: 1, key: "mint", hue: 156, css: "#4fd49a" },
  { id: 2, key: "violet", hue: 272, css: "#9a6bff" },
  { id: 3, key: "coral", hue: 16, css: "#ff7a56" },
  { id: 4, key: "iceBlue", hue: 204, css: "#5cc8ff" },
];

export const MAX_BLEND = 90; // 融合度上限：藏得再好也留 ≥10 的破绽热度，杜绝 100% 隐身死局
export const BLEND_MIN = 0;
export const BLEND_RATE = 2.6; // 融合度向目标收敛的速率（每秒）
export const FINE_TUNE_GAIN = 15; // 精调原地收敛 +15（clamp 后）
export const MOVE_BLEND_PENALTY = 12; // 移动打断收敛，一次折损 12
export const NOISE_AMPLITUDE = 8; // 扫探噪声 ±8（确定性）
export const TELL_MIN = 0.22; // 兜底破绽幅度：融合度即使拉满 90，轮廓呼吸破绽也仍有 ≥22%，杜绝"完美隐身"死局

export const PROBES_PER_ROUND = 2;
export const ROUNDS_PER_HALF = 6;
export const RIPPLE_LIFE = 4.0; // 波纹显影总时长（秒），跨伪装与观察阶段渐隐

export const TURN = {
  REVEAL: "reveal", // 揭幕观察（1.5s，显示残留波纹）
  LIGHT: "light", //   光相位轮转（0.3s，全场漂移一档）
  CAMO: "camo", //     伪装阶段（3s 幕布，变色龙行动）
  OBSERVE: "observe", // 观察阶段（猎手行动，事件驱动）
  SETTLE: "settle", // 回合结算（0.5s，记分后进下一回合）
  OVER: "over", //     整局终止
};

export const TIMERS = {
  [TURN.REVEAL]: 1.5,
  [TURN.LIGHT]: 0.3,
  [TURN.CAMO]: 3.0,
  [TURN.SETTLE]: 0.55,
};

export const OUTCOME = {
  RUNNING: null,
  CAUGHT: "caught", // 猎手指认命中
  SURVIVED: "survived", // 变色龙存活 / 猎手放弃
};

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function clampBlend(value) {
  return clamp(Math.round(value), BLEND_MIN, MAX_BLEND);
}

/** 5 色轮上的环形距离（0 / 1 / 2） */
export function colorDistance(a, b) {
  const d = Math.abs(((a % COLOR_COUNT) + COLOR_COUNT) % COLOR_COUNT - ((b % COLOR_COUNT) + COLOR_COUNT) % COLOR_COUNT);
  return Math.min(d, COLOR_COUNT - d);
}

/** 世界色：居民基色随光相位漂移后的当前位置 */
export function worldColor(residents, cell, phase) {
  return ((residents[cell] + phase) % COLOR_COUNT + COLOR_COUNT) % COLOR_COUNT;
}

export function rowOf(cell) {
  return Math.floor(cell / GRID);
}
export function colOf(cell) {
  return cell % GRID;
}

const DIRS = [
  { dx: 0, dy: -1 }, // 0 up
  { dx: 1, dy: 0 }, // 1 right
  { dx: 0, dy: 1 }, // 2 down
  { dx: -1, dy: 0 }, // 3 left
];

/** 四邻格（含方向），越界者剔除 */
export function neighborsOf(cell) {
  const row = rowOf(cell);
  const col = colOf(cell);
  const out = [];
  DIRS.forEach((d, dir) => {
    const r = row + d.dy;
    const c = col + d.dx;
    if (r >= 0 && r < GRID && c >= 0 && c < GRID) out.push({ cell: r * GRID + c, dir });
  });
  return out;
}

/** 3x3 邻域（含自身），越界者剔除 */
export function neighborhoodOf(cell) {
  const row = rowOf(cell);
  const col = colOf(cell);
  const out = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const r = row + dy;
      const c = col + dx;
      if (r >= 0 && r < GRID && c >= 0 && c < GRID) out.push(r * GRID + c);
    }
  }
  return out;
}

export function isAdjacent(a, b) {
  return neighborsOf(a).some((n) => n.cell === b);
}

/** 众数色：返回出现次数最多的颜色（平局取轮上更小者，保证确定性） */
export function dominantColor(colors) {
  const counts = new Array(COLOR_COUNT).fill(0);
  for (const c of colors) counts[((c % COLOR_COUNT) + COLOR_COUNT) % COLOR_COUNT] += 1;
  let best = 0;
  let bestCount = -1;
  for (let i = 0; i < COLOR_COUNT; i += 1) {
    if (counts[i] > bestCount) {
      bestCount = counts[i];
      best = i;
    }
  }
  return best;
}

/**
 * 邻域匹配度：变色龙颜色与邻域（不含自身）居民世界色一致的比例 → 0..MAX_BLEND。
 * 比值即融合度目标值；精调会把颜色设为邻域众数并抬升融合度。
 */
export function neighborhoodMatch(residents, phase, chameleonCell, chameleonColor) {
  const nb = neighborhoodOf(chameleonCell);
  let same = 0;
  let total = 0;
  for (const c of nb) {
    if (c === chameleonCell) continue;
    total += 1;
    if (worldColor(residents, c, phase) === ((chameleonColor % COLOR_COUNT) + COLOR_COUNT) % COLOR_COUNT) same += 1;
  }
  if (total === 0) return 0;
  return clampBlend((same / total) * 100);
}

/**
 * 确定性扫探噪声 ±8：完全由种子与格位、扫描序号决定，不推进任何 PRNG 状态。
 */
export function heatNoise(seed, cell, scanIndex) {
  const h = hash32((seed >>> 0) ^ (cell * 0x9e3779b9) ^ (scanIndex * 0x85ebca6b));
  return (h % (NOISE_AMPLITUDE * 2 + 1)) - NOISE_AMPLITUDE;
}

/** 生成合法棋盘：每色至少 3 只，且变色龙初始格的邻域至少含 2 只同色盘居民（无色盲死局） */
export function createBoard(seed) {
  const rng = mulberry32((seed >>> 0) || 1);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const residents = new Array(CELL_COUNT);
    // 先每色铺 3 只（15 只），其余 10 只按 seed 随机
    let idx = 0;
    for (let color = 0; color < COLOR_COUNT; color += 1) {
      for (let k = 0; k < 3; k += 1) {
        residents[idx] = color;
        idx += 1;
      }
    }
    for (let i = idx; i < CELL_COUNT; i += 1) residents[i] = Math.floor(rng() * COLOR_COUNT);
    // Fisher–Yates 无不动点打乱（derangement），保证初始全打乱
    for (let i = CELL_COUNT - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [residents[i], residents[j]] = [residents[j], residents[i]];
    }
    if (residents.every((c, i) => c === i)) continue; // 极罕见：不打回原样
    // 随机选变色龙初始格
    const chameleonCell = Math.floor(rng() * CELL_COUNT);
    const nbColors = neighborhoodOf(chameleonCell)
      .filter((c) => c !== chameleonCell)
      .map((c) => residents[c]);
    const mode = dominantColor(nbColors);
    const modeCount = nbColors.filter((c) => c === mode).length;
    if (modeCount >= 2) {
      return { residents, chameleonCell, initialColor: mode };
    }
  }
  // 兜底（几乎不可达）
  const residents = new Array(CELL_COUNT).fill(0);
  for (let i = 0; i < CELL_COUNT; i += 1) residents[i] = i % COLOR_COUNT;
  return { residents, chameleonCell: 12, initialColor: 1 };
}

/** 生成一局（半局内的一回合内幕布状态）的初始态 */
export function createState(seed, board = null) {
  const b = board ?? createBoard(seed);
  return {
    mode: "duel",
    seed: (seed >>> 0) || 1,
    residents: b.residents,
    phase: 0,
    chameleonCell: b.chameleonCell,
    chameleonColor: b.initialColor,
    blend: MAX_BLEND, // 开局已完美融入
    ripples: [],
    round: 1,
    half: 1,
    turn: TURN.REVEAL,
    turnTimer: TIMERS[TURN.REVEAL],
    probes: PROBES_PER_ROUND,
    scans: [],
    scanCount: 0,
    accuse: null,
    outcome: null,
    moved: false,
    recolored: false,
    refined: false,
    lastOutcome: null,
    lastAccuse: null,
  };
}

export function blendTarget(state) {
  return neighborhoodMatch(state.residents, state.phase, state.chameleonCell, state.chameleonColor);
}

/** 光相位轮转：全场漂移一档；变色龙旧色不再匹配，融合度自然衰减由 stepFrame 收敛完成 */
function applyLightPhase(state) {
  state.phase = (state.phase + 1) % COLOR_COUNT;
}

/** 固定步长帧推进：阶段计时、融合度收敛、波纹渐隐（纯确定性，同 seed 逐帧一致） */
export function stepFrame(state, dt) {
  const d = Number(dt);
  if (!Number.isFinite(d) || d <= 0) return state;
  state.turnTimer -= d;
  // 波纹渐隐
  for (const r of state.ripples) r.t = clamp(r.t - d, 0, RIPPLE_LIFE);
  state.ripples = state.ripples.filter((r) => r.t > 0);
  // 融合度向目标收敛（移动打断由 -penalty 表达，这里只做渐进逼近）
  const target = blendTarget(state);
  const k = 1 - Math.exp(-BLEND_RATE * d);
  state.blend = clampBlend(state.blend + (target - state.blend) * k);
  // 计时器到时，自动流转工程师序
  if (state.turnTimer <= 0 && state.turn !== TURN.OBSERVE && state.turn !== TURN.OVER) {
    advancePhase(state);
  }
  return state;
}

/** 阶段流转：揭幕 → 光相位 → 伪装（幕布）→ 观察 → 结算 → 下一回合 / 终局 */
export function advancePhase(state) {
  switch (state.turn) {
    case TURN.REVEAL:
      state.turn = TURN.LIGHT;
      state.turnTimer = TIMERS[TURN.LIGHT];
      break;
    case TURN.LIGHT:
      applyLightPhase(state);
      state.turn = TURN.CAMO;
      state.turnTimer = TIMERS[TURN.CAMO];
      state.moved = false;
      state.recolored = false;
      state.refined = false;
      break;
    case TURN.CAMO:
      // 幕布收起，进入观察：准备侦察点，波纹已就位
      state.turn = TURN.OBSERVE;
      state.turnTimer = 0;
      state.probes = PROBES_PER_ROUND;
      state.scans = [];
      state.scanCount = 0;
      state.accuse = null;
      state.outcome = OUTCOME.RUNNING;
      break;
    case TURN.SETTLE:
      // 结算结束后进入下一回合
      state.turn = TURN.REVEAL;
      state.turnTimer = TIMERS[TURN.REVEAL];
      state.round += 1;
      state.probes = PROBES_PER_ROUND;
      state.scans = [];
      state.scanCount = 0;
      state.accuse = null;
      state.outcome = OUTCOME.RUNNING;
      state.blend = clampBlend(blendTarget(state)); // 揭幕瞬间按当前匹配度定格
      break;
    default:
      break;
  }
  return state;
}

/** 是否处于伪装阶段（幕布），此时只有变色龙可行动 */
export function isCamouflage(state) {
  return state.turn === TURN.CAMO;
}
/** 是否处于观察阶段，猎手可行动 */
export function isObserve(state) {
  return state.turn === TURN.OBSERVE;
}

function ripplesAt(state, cell) {
  return state.ripples.filter((r) => r.cell === cell && r.t > 0);
}

/** 破绽强度 0..1：融合度越低呼吸破绽越明显，但恒不低于 TELL_MIN（肉眼可捕捉的兜底轮廓） */
export function tellStrength(state) {
  const exposed = 1 - clampBlend(state.blend) / MAX_BLEND; // blend=MAX_BLEND → 0，blend=0 → 1
  return TELL_MIN + (1 - TELL_MIN) * exposed;
}

/** 异常热度 0–100：融合度越低热度越高；移动波纹会顶高热度；噪声让单点不可实锤 */
export function heatFor(state, cell) {
  let base = 0;
  if (cell === state.chameleonCell) base = 100 - state.blend;
  for (const r of ripplesAt(state, cell)) {
    const puff = Math.round((55 + (r.t / RIPPLE_LIFE) * 45) * (r.hot ?? 1)); // 波纹显影更热
    base = Math.max(base, puff);
  }
  const noise = heatNoise(state.seed, cell, state.scanCount);
  return clamp(base + noise, 0, 100);
}

// ---------------------------------------------------------------- 变色龙行动

function leaveRipple(state, cell, hot = 1) {
  // hot：波纹强度。移动=1（强，55~100）；精调/换色=0.5（轻，约一半热度）。
  // 「想藏就必须跟着光相位动，动就留痕」——堵住站桩精调的零成本破绽。
  state.ripples.push({ cell, t: RIPPLE_LIFE, hot });
}

/** 移动一格（幕布内）：每回合限 1 步，起落点各留波纹，融合度被打断 */
export function chameleonMove(state, dir) {
  if (!isCamouflage(state) || state.outcome !== OUTCOME.RUNNING || state.moved) return { ok: false };
  const n = neighborsOf(state.chameleonCell).find((x) => x.dir === dir);
  if (!n) return { ok: false };
  leaveRipple(state, state.chameleonCell);
  state.chameleonCell = n.cell;
  leaveRipple(state, n.cell);
  state.blend = clampBlend(state.blend - MOVE_BLEND_PENALTY);
  state.moved = true;
  return { ok: true, cell: n.cell };
}

/** 换色：5 色轮上移一档（dir +1 / -1） */
export function chameleonRecolor(state, dir) {
  if (!isCamouflage(state) || state.outcome !== OUTCOME.RUNNING) return { ok: false };
  const step = dir === -1 ? -1 : 1;
  state.chameleonColor = ((state.chameleonColor + step) % COLOR_COUNT + COLOR_COUNT) % COLOR_COUNT;
  state.recolored = true;
  leaveRipple(state, state.chameleonCell, 0.5);
  return { ok: true, color: state.chameleonColor };
}

/** 精调：原地向邻域众数收敛，融合度 +15（每回合限 1 次；若已在众数色也仍抬升，表达“更贴服”） */
export function chameleonFineTune(state) {
  if (!isCamouflage(state) || state.outcome !== OUTCOME.RUNNING || state.refined) return { ok: false };
  const nbColors = neighborhoodOf(state.chameleonCell)
    .filter((c) => c !== state.chameleonCell)
    .map((c) => worldColor(state.residents, c, state.phase));
  state.chameleonColor = dominantColor(nbColors);
  state.blend = clampBlend(state.blend + FINE_TUNE_GAIN);
  state.refined = true;
  leaveRipple(state, state.chameleonCell, 0.5);
  return { ok: true, color: state.chameleonColor };
}

// ---------------------------------------------------------------- 猎手行动

/** 扫探：消耗 1 侦察点，返回该格异常热度（含确定性噪声） */
export function hunterScan(state, cell) {
  if (!isObserve(state) || state.outcome !== OUTCOME.RUNNING) return null;
  if (state.probes <= 0) return null;
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return null;
  state.probes -= 1;
  const heat = heatFor(state, cell);
  state.scans.push({ cell, heat });
  state.scanCount += 1;
  return { cell, heat, probes: state.probes };
}

/** 指认：消耗 1 侦察点；正确 = 抓获，错误 = 变色龙 +1 且猎手失去剩余侦察点 */
export function hunterAccuse(state, cell) {
  if (!isObserve(state) || state.outcome !== OUTCOME.RUNNING) return null;
  if (state.probes <= 0) return null;
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return null;
  state.probes = 0;
  state.scanCount += 1;
  const correct = cell === state.chameleonCell;
  state.accuse = { cell, correct };
  state.outcome = correct ? OUTCOME.CAUGHT : OUTCOME.SURVIVED;
  finishRound(state);
  return { cell, correct };
}

/** 放弃：不指认，回合自然结束，变色龙存活 */
export function hunterPass(state) {
  if (!isObserve(state) || state.outcome !== OUTCOME.RUNNING) return null;
  state.outcome = OUTCOME.SURVIVED;
  finishRound(state);
  return { ok: true };
}

function finishRound(state) {
  state.turn = TURN.SETTLE;
  state.turnTimer = TIMERS[TURN.SETTLE];
  state.lastOutcome = state.outcome;
  state.lastAccuse = state.accuse;
}

/** 是否整局走完（半局 6 回合 + 角色轮换由 game.mjs 决策，engine 只标记回合推进） */
export function isRoundFinished(state) {
  return state.turn === TURN.SETTLE && state.turnTimer <= 0;
}

/** 供测试只读的守恒不变量审计 */
export function invariants(state) {
  return {
    oneChameleon: Number.isInteger(state.chameleonCell) && state.chameleonCell >= 0 && state.chameleonCell < CELL_COUNT,
    residentCount: state.residents.length === CELL_COUNT,
    roundPositive: state.round >= 1,
    blendInRange: state.blend >= BLEND_MIN && state.blend <= MAX_BLEND,
    phaseInRange: state.phase >= 0 && state.phase < COLOR_COUNT,
  };
}