// 叠叠乐（Jenga Tower）· 规则唯一权威（纯函数，严格 DOM-free，禁碰 DOM / 存储）
//
// 核心契约：
//   1. 120Hz 固定步长 stepFrame(state, dt) —— 纯函数帧步进，同种子同输入逐帧一致；
//   2. 标准 Jenga 塔：3 块/层 × 18 层 = 54 块，层间 90° 正交交错（偶层长边沿 X、奇层沿 Z）；
//   3. 抽 ≠ 堆双轴博弈：抽块削支撑（塔底风险）、堆叠移质心（塔顶风险），抽 1 块必叠 1 块；
//   4. 四档判倒（4/4/3/4）：
//        档 1 —— 每块底部 4 角支撑采样，支撑角 < 2 判危（上方有压重则判倒）；
//        档 2 —— 整塔质心投影越出底层基座包围盒判倒；
//        档 3 —— 整体倾角 ≥ 3° 且当帧无回落趋势判倒；
//        档 4 —— 单块悬空 > 自身长度 40% 且上方压重 < 2 块判倒；
//   5. 确定性种子 PRNG（mulberry32）注入初始塔摆放抖动 / 抽叠冲击 / 阵风扰动；
//   6. 块数守恒：inTower + held === TOTAL_BLOCKS（抽 N 块必叠 N 块）。

export const FIXED_DT = 1 / 120;

// ---- 几何（单位 = 木块短边宽度）----
// 标准 Jenga 木块长宽比 3:1，层高取 0.6（实体块 1.5 × 2.5 × 7.5cm 的比例）。
export const BLOCK_W = 1;
export const BLOCK_L = 3;
export const BLOCK_H = 0.6;
export const PER_LAYER = 3;
export const START_LAYERS = 18;
export const TOTAL_BLOCKS = PER_LAYER * START_LAYERS;
// 塔垫（塔的落地基座）：半宽 = 一块木板的长度之半，塔垫 4 角是档 2 的判倒基准。
export const PAD_HALF = BLOCK_L / 2;

export const AXIS = { X: 0, Z: 1 };
export const SLOT_OFFSET = [-BLOCK_W, 0, BLOCK_W];

export const MODE = { SPIRE: "spire", DUEL: "duel", RIDDLE: "riddle" };
export const STATUS = {
  READY: "ready",
  IDLE: "idle",
  HOLDING: "holding",
  COLLAPSE: "collapse",
  WON: "won",
  LOST: "lost"
};

// ---- 四档判倒阈值（4 / 4 / 3 / 4）----
export const SUPPORT_CORNERS = 4; // 档 1：底面 4 角采样
export const MIN_SUPPORT = 2; // 档 1：支撑角 < 2 判危
export const LEAN_DEG = 3; // 档 3：倾角阈值
export const LEAN_LIMIT = (LEAN_DEG * Math.PI) / 180;
export const OVERHANG_RATIO = 0.4; // 档 4：悬空长度 / 自身长度
export const OVERHANG_LOAD = 2; // 档 4：上压 ≥ 2 块不判倒
// 悬臂危险度基准线：任何一次抽块都会在被抽层上方留下一个块宽（BLOCK_W/BLOCK_L = 1/3）
// 的缺口，这是正常堆叠的固有悬臂而非危险。危险度必须从这条基准起算、到判倒阈值拉满，
// 否则每抽一块，上层的悬臂都会把危险度钉在 ~0.8（舞台常振、判危灯长亮）。
export const OVERHANG_BASE = BLOCK_W / BLOCK_L;

// ---- 摆动动力学（档 3 的倾角来源）----
// 塔被视为绕基座的受迫阻尼摆：平衡点 = 质心偏移角，抽叠冲击与阵风为外界激励。
// 高塔 comH 更大 → 自然频率更低、阻尼更小 → 晃得更久也更难回落，这就是"越高越险"。
export const GRAVITY = 9.8;
export const SWAY_ZETA = 0.14;
export const SWAY_TOL = 1e-4;
export const PULL_IMPULSE = 0.0035; // 抽块：木质摩擦拖拽给塔的横向冲量
export const STACK_IMPULSE = 0.0065; // 落位：木块砸顶的冲击比抽块重
export const HEIGHT_EXP = 1.5; // 冲击随塔高放大指数
// 警戒半径：质心偏到塔垫半宽的一半（0.75）即视为"塔已站到临界"，配合塔高增益逼近 3°。
// 用 PAD_HALF 本身当分母的话要 55 次同向堆叠才可能倾覆，一局只有 54 块 —— 档 3 形同虚设。
// ---- 层间手工错位（塔会自己长歪 · 档 3 倾角的唯一真实来源）----
// 关键洞察：块数守恒 + 每层必填满 3 块 ⇒ 整塔质心几乎恒定（抽走一块再叠回去净位移为 0），
// 纯"质心偏移"永远推不动倾角，档 3 会变成死判据。真实 Jenga 塔倒是因为**越往上堆得越歪**：
// 每层相对下层有个同向的手工错位，且上层手臂更不稳 → 错位随层号放大，塔的倾斜随高度加剧。
export const STACK_DRIFT = 0.006; // 每层的系统性错位基数（块宽的比例）
export const DRIFT_GROWTH = 9; // 错位随层号放大的分母：drift(i) = STACK_DRIFT × (1 + i / DRIFT_GROWTH)
export const STACK_JITTER = 0.006; // 每层的随机扰动（破坏单调直线，让塔歪得自然）
// 高度增益：塔越高，同样的几何歪斜换算成的倾角越大（倒立摆越高越难回正）。
// 没有它，18 层 0.95° 到 26 层也只有 1.6°，档 3 的 3° 永远够不着。
export const LEAN_HEIGHT_GAIN = 2.2;

// ---- 塌落 ----
export const COLLAPSE_TIME = 3.2;
export const REST_SPEED = 0.06;
export const GROUND_RESTITUTION = 0.26;
// 落地滑移阻力（每秒指数衰减）。旧实现是"每帧 ×0.62"，在 120Hz 固定步长下等于
// 每秒 ×0.62^120 ≈ 0 —— 触地即冻住，既不帧率无关也谈不上滑移。改成显式速率。
// 取 3.2：14 太黏（块全堆在塔基 narrow band 里堆成针塔），5.5 能把大部队摊到
// 半径 10，但塔顶会冻成一根 16 块的刚性小塔（承接链把相对层高原样保留），
// 收尾打包在 6 单位内找不到空地，只能把小塔原样留下——就是"最后散落很凌乱"。
// 3.2 让塌落波把塔真正打散，打包时才摊得平。
export const GROUND_DRAG = 3.2;
// 收尾打包的螺旋搜索参数：步长与最大环数（环 = 方环，环上点距原点 ≥ 环×步长）。
// 步长必须细：0.6 的粗网格在碎片化空地上根本落不下 3×1 的足迹，只能往上叠——
// 实测粗网格把泡沫态叠出 15 层塔。0.25 配 24 环 = 6 个单位搜索半径：塔顶冻成的
// 刚性小塔旁边往往没有空地，但 6 单位内必有（塌落波把 debris 摊到半径 10）。
// worst case 每块扫 1+8×(1+…+24)=2353 个点，54 块总共几百万次格子判定（<30ms）。
export const DEBRIS_PACK_STEP = 0.25;
export const DEBRIS_PACK_RINGS = 24;
// 空间哈希格子边长。足迹重叠 ⟺ 两块所占格子范围相交（floor 单调），
// 所以格子判定对"能不能搁这儿"是精确的，只会保守不会漏判。
export const DEBRIS_PACK_CELL = 0.25;
// 收尾整姿到 LOST 之间的"落位"阶段：块从物理落点插值到打包目标位，而不是
// 一帧之内拍过去（实测直接拍会改动 16% 的画布像素，肉眼是个明显的"跳"）。
// 线性匀速：每块时长 = 位移 / SETTLE_SPEED（封顶 1.2s），所以不管远近，所有块
// 的滑行速度一致——指数插值会让 10 单位的远块在 0.5s 内冲出 60 单位/秒，
// 看着像碎屑乱飞。逐块延迟 = 序号 × SETTLE_STAGGER，从底部往上波浪式落位。
export const SETTLE_STAGGER = 0.006;
export const SETTLE_SPEED = 14;
export const SETTLE_MAX_TIME = 1.6;
// 每块初速相对倒塌方向的随机扇面角（弧度，±63°）。塔倒下去是一条线，块弹
// 开是一片扇形——扇面越宽，塌落波越能把塔打散（冻不成刚性小塔），收尾时也
// 越容易摊平。±49° 实测还能冻出 16 块的整根小塔。
export const COLLAPSE_FAN = 1.1;
export const EPS = 1e-6;
// 支撑角判定容差：必须大于初始摆放抖动的最大值（HAND_JITTER），
// 否则手工摆放的微小错位会把标准塔判成悬空。
export const SUPPORT_TOL = 0.06;
export const OVERHANG_SAMPLES = 60;

// ---------------------------------------------------------------- 基础工具

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 状态内 PRNG：种子是 state 上的普通数字，clone 后仍逐帧一致。
export function nextRandom(state) {
  state.rngSeed = (state.rngSeed + 0x6d2b79f5) >>> 0;
  let t = state.rngSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  state.rngCalls += 1;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(state, min, max) {
  return min + nextRandom(state) * (max - min);
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function axisOfLayer(layer) {
  return layer % 2 === 0 ? AXIS.X : AXIS.Z;
}

export function slotOffset(slot) {
  return SLOT_OFFSET[slot] ?? 0;
}

// ---------------------------------------------------------------- 塔几何

export function layerBox(state, layer, slot) {
  const entry = state.layers[layer];
  if (!entry) return null;
  const axis = axisOfLayer(layer);
  const off = slotOffset(slot);
  const ox = entry.ox || 0;
  const oz = entry.oz || 0;
  const y = layer * BLOCK_H;
  if (axis === AXIS.X) {
    return {
      x0: ox - BLOCK_L / 2,
      x1: ox + BLOCK_L / 2,
      z0: off + oz - BLOCK_W / 2,
      z1: off + oz + BLOCK_W / 2,
      y
    };
  }
  return {
    x0: off + ox - BLOCK_W / 2,
    x1: off + ox + BLOCK_W / 2,
    z0: oz - BLOCK_L / 2,
    z1: oz + BLOCK_L / 2,
    y
  };
}

function boxOfBlock(state, block) {
  return layerBox(state, block.layer, block.slot);
}

function bottomCorners(box) {
  return [
    [box.x0, box.z0],
    [box.x0, box.z1],
    [box.x1, box.z0],
    [box.x1, box.z1]
  ];
}

// 某个底面角点在下层是否落到了木块上（layer 0 直接坐在塔垫上）。
function supportedAt(state, layer, px, pz) {
  if (layer <= 0) return true;
  const below = state.layers[layer - 1];
  if (!below) return false;
  for (let slot = 0; slot < PER_LAYER; slot += 1) {
    if (below.slots[slot] == null) continue;
    const b = layerBox(state, layer - 1, slot);
    if (px >= b.x0 - SUPPORT_TOL && px <= b.x1 + SUPPORT_TOL && pz >= b.z0 - SUPPORT_TOL && pz <= b.z1 + SUPPORT_TOL) {
      return true;
    }
  }
  return false;
}

// 悬空长度：沿长轴方向做定长采样，统计未被下层木块托住的部分。
function overhangOf(state, block) {
  if (block.layer <= 0) return 0;
  const box = boxOfBlock(state, block);
  if (!box) return 0;
  const alongX = axisOfLayer(block.layer) === AXIS.X;
  const a0 = alongX ? box.x0 : box.z0;
  const a1 = alongX ? box.x1 : box.z1;
  const len = a1 - a0;
  let hit = 0;
  for (let i = 0; i < OVERHANG_SAMPLES; i += 1) {
    const a = a0 + ((i + 0.5) * len) / OVERHANG_SAMPLES;
    const px = alongX ? a : (box.x0 + box.x1) / 2;
    const pz = alongX ? (box.z0 + box.z1) / 2 : a;
    if (supportedAt(state, block.layer, px, pz)) hit += 1;
  }
  return (len * (OVERHANG_SAMPLES - hit)) / OVERHANG_SAMPLES;
}

// 上方压重：直接压在本块之上（layer + 1）且水平投影有重叠的木块数。
function loadOf(state, block) {
  const above = state.layers[block.layer + 1];
  if (!above) return 0;
  const box = boxOfBlock(state, block);
  if (!box) return 0;
  let count = 0;
  for (let slot = 0; slot < PER_LAYER; slot += 1) {
    if (above.slots[slot] == null) continue;
    const b = layerBox(state, block.layer + 1, slot);
    const overlapX = Math.min(box.x1, b.x1) - Math.max(box.x0, b.x0);
    const overlapZ = Math.min(box.z1, b.z1) - Math.max(box.z0, b.z0);
    if (overlapX > EPS && overlapZ > EPS) count += 1;
  }
  return count;
}

export function towerBlocks(state) {
  return state.blocks.filter((b) => b.inTower);
}

export function layerCount(state) {
  return state.layers.length;
}

export function isTopLayer(state, layer) {
  return layer === state.layers.length - 1;
}

// ---------------------------------------------------------------- 质心与基座

export function centerOfMass(state) {
  const live = towerBlocks(state);
  if (live.length === 0) return { x: 0, z: 0, y: 0, n: 0 };
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const b of live) {
    sx += b.cx;
    sy += b.py;
    sz += b.cz;
  }
  return { x: sx / live.length, z: sz / live.length, y: sy / live.length, n: live.length };
}

// 有效基座 = 底层现存木块的外接包围盒。底层被抽空 → 基座变窄 → 档 2 立刻收紧，
// 这就是"抽块伤在塔底"的数值来源。底层全空时回落到塔垫。
export function baseBox(state) {
  const ground = state.layers[0];
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  let found = false;
  if (ground) {
    for (let slot = 0; slot < PER_LAYER; slot += 1) {
      if (ground.slots[slot] == null) continue;
      const b = layerBox(state, 0, slot);
      x0 = Math.min(x0, b.x0);
      x1 = Math.max(x1, b.x1);
      z0 = Math.min(z0, b.z0);
      z1 = Math.max(z1, b.z1);
      found = true;
    }
  }
  if (!found) return { x0: -PAD_HALF, x1: PAD_HALF, z0: -PAD_HALF, z1: PAD_HALF };
  return { x0, x1, z0, z1 };
}

// ---------------------------------------------------------------- 四档判倒审计

// 纯计算：写回 state.geomDanger / state.danger / state.com / state.audit，不判倒。
// 判倒由 pull / stack / stepFrame 依据 audit 结果决定（档 3 需要逐帧监测）。
export function audit(state) {
  const com = centerOfMass(state);
  state.com = com;
  const base = baseBox(state);
  state.base = base;

  let worstSupport = { gear: 1, block: null, corners: SUPPORT_CORNERS, center: true, load: 0 };
  let worstOverhang = { gear: 4, block: null, ratio: 0, load: 0 };
  // 危险度专用的悬臂口径：只统计"上面压了东西"的块。最顶层刚叠上去的块搭在缺口上
  // 是正常堆叠（既压不塌什么，也不会翻），若按同一口径计数，危险度会被永久钉在
  // ~0.8 高位，连带舞台常振、判危度指示灯长亮。
  let worstOverhangLoaded = { gear: 4, block: null, ratio: 0, load: 0 };

  for (const b of towerBlocks(state)) {
    const box = boxOfBlock(state, b);
    if (!box) continue;
    let corners = 0;
    for (const [px, pz] of bottomCorners(box)) {
      if (supportedAt(state, b.layer, px, pz)) corners += 1;
    }
    // 中心托底：正交交错结构里 4 角天然落在下层窄边之外（下层块宽 1、上层块长 3），
    // 所以"4 角是否接触"不能单独当判据 —— 关键是有没有东西托在块的重心正下方。
    const center = supportedAt(state, b.layer, b.cx, b.cz);
    const load = loadOf(state, b);
    const rank = (entry) => (entry.center ? 0 : 100) + (SUPPORT_CORNERS - entry.corners);
    const cand = { gear: 1, block: b.id, corners, center, load };
    if (rank(cand) > rank(worstSupport)) worstSupport = cand;
    const oh = overhangOf(state, b);
    const ratio = oh / BLOCK_L;
    if (ratio > worstOverhang.ratio) worstOverhang = { gear: 4, block: b.id, ratio, load };
    if (load >= 1 && ratio > worstOverhangLoaded.ratio) {
      worstOverhangLoaded = { gear: 4, block: b.id, ratio, load };
    }
  }
  const baseBlocks = state.layers[0] ? state.layers[0].slots.filter((id) => id != null).length : 0;

  // 档 2 的判倒基准是**塔垫**（固定 4 角包围盒，中心 0、半宽 PAD_HALF），不是底层包围盒：
  // 底层盒的中心会随抽块瞬移半个块宽，用它当基准会让"抽掉底层一块"等价于质心凭空偏移 0.5，
  // 档 2 抢在档 3 之前判倒，四档模型退化成两档。抽底层的代价交给档 1/档 4（结构性判据），
  // 重心漂移的代价交给档 3（倾角）—— 这样四档各司其职、都能在实测中命中。
  const comOffset = Math.max(Math.abs(com.x) / PAD_HALF, Math.abs(com.z) / PAD_HALF);

  const d1 = worstSupport.center
    ? clamp(1 - worstSupport.corners / MIN_SUPPORT, 0, 1) * 0.6
    : worstSupport.corners === 0
      ? 1
      : 0.8;
  const d2 = clamp(comOffset, 0, 1);
  // 从固有悬臂基准起算：抽一块 → 上层缺 1/3 → 危险度 0；逼近判倒阈值才拉满
  const d4 = clamp((worstOverhangLoaded.ratio - OVERHANG_BASE) / (OVERHANG_RATIO - OVERHANG_BASE), 0, 1);

  state.geomDanger = Math.max(d1, d2, d4);
  state.audit = { worstSupport, worstOverhang, worstOverhangLoaded, comOffset, base, baseBlocks };
  state.danger = Math.max(state.geomDanger, tiltOf(state) / LEAN_LIMIT);
  return state.audit;
}

export function tiltOf(state) {
  return Math.hypot(state.sway.tx, state.sway.tz);
}

// 逐档判定：返回命中的档位（0 = 未命中）。几何三档 + 摆动档分开，便于逐档断言。
export function verdictOf(state) {
  const a = state.audit;
  if (!a) return null;
  const support = a.worstSupport;
  // 档 1：重心正下方完全失去托底（连一个接触角都没有）才判倒 —— 也就是整层被抽光。
  // 只掏掉两层中的两块（重心还搭在剩下那块的窄边上）属于"惊险但站得住"，交给档 4 与 danger 提示：
  // 放宽到 corners < 2 会让随机乱抽平均只能撑 13.8 步，整局读塔的策略深度被抹平。
  if (!support.center && support.corners === 0) {
    return { gear: 1, corners: support.corners, load: support.load, block: support.block };
  }
  // 档 2：质心越出有效基座，或基座本身被掏到只剩一根独木（塔已无处可站）。
  if (a.comOffset >= 1) {
    return { gear: 2, comOffset: a.comOffset, com: { x: state.com.x, z: state.com.z } };
  }
  if (a.baseBlocks <= 1 && layerCount(state) > 1) {
    return { gear: 2, baseBlocks: a.baseBlocks, comOffset: a.comOffset };
  }
  if (tiltOf(state) >= LEAN_LIMIT) {
    return { gear: 3, lean: tiltOf(state) };
  }
  const oh = a.worstOverhang;
  if (oh.ratio > OVERHANG_RATIO && oh.load < OVERHANG_LOAD) {
    return { gear: 4, ratio: oh.ratio, load: oh.load, block: oh.block };
  }
  return null;
}

// ---------------------------------------------------------------- 初始塔

export function createInitialState(options = {}) {
  const layers = Math.max(4, options.layers ?? START_LAYERS);
  const seed = (options.seed ?? 20261009) >>> 0;
  const state = {
    seed,
    rngSeed: seed,
    rngCalls: 0,
    mode: options.mode ?? MODE.SPIRE,
    status: STATUS.IDLE,
    layers: [],
    blocks: [],
    held: null,
    pullCount: 0,
    stackCount: 0,
    streak: 0,
    bestStreak: 0,
    time: 0,
    danger: 0,
    geomDanger: 0,
    verdict: null,
    audit: null,
    com: { x: 0, z: 0, y: 0, n: 0 },
    base: null,
    sway: { tx: 0, tz: 0, vx: 0, vz: 0 },
    collapse: null,
    gust: {
      enabled: options.gust === true,
      period: options.gustPeriod ?? 5,
      duration: 0.9,
      amp: options.gustAmp ?? 0.02,
      t: 0,
      dirX: 1,
      dirZ: 0
    }
  };
  buildTower(state, layers);
  audit(state);
  return state;
}

function buildTower(state, layers) {
  let id = 0;
  // 每局一个固定的"歪斜朝向"：塔会朝这个方向越堆越歪（同种子完全一致）。
  // 必须是**单位向量**而非 (±1, ±1) —— 后者模长 1.41，塔一开局就歪到 1.9°，
  // 三步之内必倒（实测 avgMoves 掉到 3.1）。
  const angle = randRange(state, 0, Math.PI * 2);
  state.drift = { x: Math.cos(angle), z: Math.sin(angle) };
  let ox = 0;
  let oz = 0;
  for (let layer = 0; layer < layers; layer += 1) {
    if (layer > 0) {
      ox += state.drift.x * STACK_DRIFT * (1 + layer / DRIFT_GROWTH) + randRange(state, -STACK_JITTER, STACK_JITTER);
      oz += state.drift.z * STACK_DRIFT * (1 + layer / DRIFT_GROWTH) + randRange(state, -STACK_JITTER, STACK_JITTER);
    }
    const entry = { ox, oz, slots: [null, null, null] };
    state.layers.push(entry);
    for (let slot = 0; slot < PER_LAYER; slot += 1) {
      const block = makeBlock(state, id, layer, slot);
      state.blocks.push(block);
      entry.slots[slot] = id;
      id += 1;
    }
  }
}

function makeBlock(state, id, layer, slot) {
  const entry = state.layers[layer];
  const axis = axisOfLayer(layer);
  const off = slotOffset(slot);
  const ox = entry ? entry.ox || 0 : 0;
  const oz = entry ? entry.oz || 0 : 0;
  const cx = axis === AXIS.X ? ox : off + ox;
  const cz = axis === AXIS.X ? off + oz : oz;
  const y = layer * BLOCK_H;
  return {
    id,
    layer,
    slot,
    axis,
    cx,
    cz,
    y,
    // 物理分量（仅塌落阶段使用）：中心位置、速度、翻滚角
    px: cx,
    py: y + BLOCK_H / 2,
    pz: cz,
    vx: 0,
    vy: 0,
    vz: 0,
    rx: 0,
    rz: 0,
    spinX: 0,
    spinZ: 0,
    inTower: true,
    resting: false,
    landed: false, // 塌落中是否已触地/压到别的块（决定何时开始吃落地阻力）
    support: -1 // 正下方托着本块的那块在 state.blocks 里的下标（-1 = 没有/待定）
  };
}

export function cloneState(state) {
  return {
    ...state,
    layers: state.layers.map((entry) => ({ ...entry, slots: entry.slots.slice() })),
    blocks: state.blocks.map((b) => ({ ...b })),
    held: state.held == null ? null : state.held,
    sway: { ...state.sway },
    com: { ...state.com },
    base: state.base ? { ...state.base } : null,
    audit: state.audit ? cloneAudit(state.audit) : null,
    verdict: state.verdict ? { ...state.verdict } : null,
    collapse: state.collapse ? { ...state.collapse } : null,
    gust: { ...state.gust }
  };
}

function cloneAudit(audit) {
  return {
    ...audit,
    worstSupport: { ...audit.worstSupport },
    worstOverhang: { ...audit.worstOverhang }
  };
}

// ---------------------------------------------------------------- 动作：抽块 / 堆叠

export function canPull(state, layer, slot) {
  if (state.status !== STATUS.IDLE) return false;
  const entry = state.layers[layer];
  if (!entry) return false;
  if (entry.slots[slot] == null) return false;
  // 端头是**动态的**：夹在两块中间的那块没有抓手，但一旦某个邻居被抽走，它的一端就露了出来
  // （真实 Jenga 就是这么玩的）。写成固定 slot ∈ {0,2} 会让每层永远保住中间那块，
  // 上层重心下方始终有托底 —— 档 1「重心失去托底」将永远命中不了，四档模型少一档。
  const leftOpen = slot === 0 || entry.slots[slot - 1] == null;
  const rightOpen = slot === PER_LAYER - 1 || entry.slots[slot + 1] == null;
  if (!leftOpen && !rightOpen) return false;
  // 正在施工的最顶层永远不可抽：否则"抽顶层端头 → 叠回同一空位"可以原地空转，
  // 塔既不长高也不失稳，连击能无限刷（实测 200 步存活）。
  if (isTopLayer(state, layer)) return false;
  return true;
}

export function pullBlock(state, layer, slot) {
  if (!canPull(state, layer, slot)) return { ok: false, reason: "illegal" };
  const entry = state.layers[layer];
  const id = entry.slots[slot];
  const block = state.blocks[id];
  entry.slots[slot] = null;
  block.inTower = false;
  block.prev = { layer, slot }; // 供"取消抽块"原位塞回
  state.held = id;
  state.pullCount += 1;
  state.status = STATUS.HOLDING;

  // 抽块冲击：沿抽出方向拖拽塔身（端头 slot 0 → 负向，slot 2 → 正向）。
  const dir = slot === 0 ? -1 : 1;
  const scale = (layerCount(state) / START_LAYERS) ** HEIGHT_EXP;
  const mag = PULL_IMPULSE * scale;
  const jitter = randRange(state, -0.15, 0.15) * mag;
  if (axisOfLayer(layer) === AXIS.X) state.sway.vz += dir * mag + jitter;
  else state.sway.vx += dir * mag + jitter;

  audit(state);
  const verdict = verdictOf(state);
  if (verdict) {
    state.verdict = verdict;
    startCollapse(state);
    return { ok: true, collapsed: true, verdict };
  }
  return { ok: true, collapsed: false, block: id };
}

export function canStack(state, slot) {
  if (state.status !== STATUS.HOLDING) return false;
  if (slot < 0 || slot >= PER_LAYER) return false;
  const top = state.layers[state.layers.length - 1];
  // 顶层已满 → 落位会自动起新层，所以三个槽位都合法。
  if (top.slots.every((id) => id != null)) return true;
  return top.slots[slot] == null;
}

export function stackBlock(state, slot) {
  if (!canStack(state, slot)) return { ok: false, reason: "illegal" };
  let top = state.layers[state.layers.length - 1];
  if (top.slots.every((id) => id != null)) {
    // 新层延续本局的歪斜朝向：越往上堆、手臂越不稳，错位越大 —— 塔顶就是这样慢慢长歪的。
    const layer = state.layers.length;
    const grow = 1 + layer / DRIFT_GROWTH;
    const ox = (top.ox || 0) + state.drift.x * STACK_DRIFT * grow + randRange(state, -STACK_JITTER, STACK_JITTER);
    const oz = (top.oz || 0) + state.drift.z * STACK_DRIFT * grow + randRange(state, -STACK_JITTER, STACK_JITTER);
    top = { ox, oz, slots: [null, null, null] };
    state.layers.push(top);
  }
  const id = state.held;
  const block = state.blocks[id];
  const layer = state.layers.length - 1;
  block.layer = layer;
  block.slot = slot;
  block.axis = axisOfLayer(layer);
  const entry = state.layers[layer];
  block.cx = block.axis === AXIS.X ? entry.ox || 0 : slotOffset(slot) + (entry.ox || 0);
  block.cz = block.axis === AXIS.X ? slotOffset(slot) + (entry.oz || 0) : entry.oz || 0;
  block.y = layer * BLOCK_H;
  block.px = block.cx;
  block.py = block.y + BLOCK_H / 2;
  block.pz = block.cz;
  block.inTower = true;
  top.slots[slot] = id;
  state.held = null;
  state.stackCount += 1;
  state.status = STATUS.IDLE;

  // 落位冲击：向下砸顶 + 槽位偏心带来的横向冲量。
  const scale = (layerCount(state) / START_LAYERS) ** HEIGHT_EXP;
  const mag = STACK_IMPULSE * scale;
  const ecc = slotOffset(slot) * 0.5;
  if (block.axis === AXIS.X) {
    state.sway.vz += ecc * mag + randRange(state, -0.15, 0.15) * mag;
    state.sway.vx += randRange(state, -0.15, 0.15) * mag;
  } else {
    state.sway.vx += ecc * mag + randRange(state, -0.15, 0.15) * mag;
    state.sway.vz += randRange(state, -0.15, 0.15) * mag;
  }

  audit(state);
  const verdict = verdictOf(state);
  if (verdict) {
    state.verdict = verdict;
    startCollapse(state);
    return { ok: true, collapsed: true, verdict };
  }
  state.streak += 1;
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;
  return { ok: true, collapsed: false, streak: state.streak };
}

// 取消抽块：把木块原位塞回塔里（块数守恒铁律下，"取消"只能是放回原处）。
// 不计一次抽叠、不涨连击也不清连击 —— 玩家抽到危险块时可以收手，但塔的结构要原样恢复。
export function cancelPull(state) {
  if (state.status !== STATUS.HOLDING || state.held == null) return { ok: false, reason: "illegal" };
  const block = state.blocks[state.held];
  const prev = block.prev;
  if (!prev) return { ok: false, reason: "illegal" };
  state.layers[prev.layer].slots[prev.slot] = block.id;
  block.layer = prev.layer;
  block.slot = prev.slot;
  block.axis = axisOfLayer(prev.layer);
  block.inTower = true;
  block.prev = null;
  state.held = null;
  state.pullCount = Math.max(0, state.pullCount - 1);
  state.status = STATUS.IDLE;
  audit(state);
  return { ok: true, block: block.id };
}

// ---------------------------------------------------------------- 塌落

export function startCollapse(state) {
  if (state.status === STATUS.COLLAPSE) return state;
  const live = towerBlocks(state);
  const lean = tiltOf(state);
  let dirX = state.sway.tx;
  let dirZ = state.sway.tz;
  if (lean < EPS) {
    const dx = state.com.x;
    const dz = state.com.z;
    const len = Math.hypot(dx, dz) || 1;
    dirX = dx / len;
    dirZ = dz / len;
  } else {
    dirX /= lean;
    dirZ /= lean;
  }
  const maxH = Math.max(...live.map((b) => b.py), BLOCK_H);
  for (const b of live) {
    const h = b.py / maxH;
    b.inTower = false;
    b.resting = false;
    b.landed = false;
    // 倒塌方向 + 每块一个随机扇面角：整座塔朝 lean 方向翻，但块与块、块与地
    // 碰撞后会向两侧弹开。旧实现所有块共用同一方向（只加 ±0.25 直线抖动），
    // 54 块排成一条 12 单位长的线，沿线首尾相接全被贪心堆叠成针塔。
    const fan = randRange(state, -COLLAPSE_FAN, COLLAPSE_FAN);
    const cs = Math.cos(fan);
    const sn = Math.sin(fan);
    const fx = dirX * cs - dirZ * sn;
    const fz = dirX * sn + dirZ * cs;
    const speed = (1.1 + 3.6 * h) * randRange(state, 0.75, 1.25);
    b.vx = fx * speed + randRange(state, -0.2, 0.2);
    b.vz = fz * speed + randRange(state, -0.2, 0.2);
    b.vy = randRange(state, -0.15, 0.25);
    // 整座塔朝同一个方向翻过去，而不是每块各转各的：绕"垂直于倒塌方向的水平轴"
    // 给同一个角速度。倒下 +x ⇒ 绕 z 轴正向翻（顶朝 +x 走），倒下 +z ⇒ 绕 x 轴正向翻。
    // 旧实现 spinX/spinZ 各自独立 ±3.2 rad/s，塌完 54 块没有一块还是轴对齐的，
    // 其中十几块竖着立在半空——"最后散落的状态很凌乱"主要就是这个。
    const tumble = randRange(state, 1.1, 2.0) + randRange(state, -0.15, 0.15);
    b.spinZ = dirX * tumble;
    b.spinX = dirZ * tumble;
  }
  if (state.held != null) {
    const hb = state.blocks[state.held];
    const fan = randRange(state, -COLLAPSE_FAN, COLLAPSE_FAN);
    const cs = Math.cos(fan);
    const sn = Math.sin(fan);
    hb.vx = (dirX * cs - dirZ * sn) * 1.4 + randRange(state, -0.25, 0.25);
    hb.vz = (dirX * sn + dirZ * cs) * 1.4 + randRange(state, -0.25, 0.25);
    hb.vy = 0.3;
    const tumble = randRange(state, 1.0, 1.6);
    hb.spinZ = dirX * tumble;
    hb.spinX = dirZ * tumble;
  }
  state.streak = 0;
  state.status = STATUS.COLLAPSE;
  state.collapse = { t: 0, dirX, dirZ, done: false, pack: null, settleT: 0 };
  return state;
}

// 塌落中每块的水平占地（保留原层级的朝向：交错层的块本来就一横一竖）。
// 全按同一个朝向画会让同层三块互相嵌成一块，视觉上直接"糊"掉。
function blockSpan(block) {
  const long = axisOfLayer(block.layer ?? 0) === 0;
  return long
    ? { hx: BLOCK_L / 2, hz: BLOCK_W / 2 }
    : { hx: BLOCK_W / 2, hz: BLOCK_L / 2 };
}

function stepCollapse(state, dt) {
  const col = state.collapse;
  col.t += dt;
  state.time += dt;
  // 收尾落位阶段：物理已经结束，块正逐块插值到打包目标位，不再跑重力/承接
  if (col.pack) return settleStep(state, dt);
  const bodies = state.blocks;
  for (const b of bodies) {
    if (b.resting) continue;
    b.vy -= GRAVITY * dt;
    b.px += b.vx * dt;
    b.py += b.vy * dt;
    b.pz += b.vz * dt;
    b.rx += b.spinX * dt;
    b.rz += b.spinZ * dt;
  }
  // 承接：只有"上面那块正落向下面那块"时才把它放到下层块顶、并停下落速度。
  // 并排下落的块（dy≈0、速度接近）一律不碰。
  //
  // ⚠ 两块历史坑都在这段循环里：
  // 1) 旧实现让同一块在一帧内被多个下方块连续承接。密堆里存在"逐级低 0.1 的
  //    楼梯"，每承接一次就把 a 往上顶最多 0.55，实测最高 py 从 5.2 一路泵到
  //    7.5 且三秒还在泵。现在每块每帧只承接一次（snapped 旗标）。
  // 2) 更旧的实现对"相距 1 个块宽以内的每一对"都做竖向分离并把竖向速度对半
  //    衰减，18 层密堆积塔里每块每帧都被切一次速度：整座塔既不往下掉还往上膨胀。
  for (let i = 0; i < bodies.length; i += 1) {
    const a = bodies[i];
    if (a.resting) continue;
    const sa = blockSpan(a);
    let snapped = false;
    for (let j = i + 1; j < bodies.length && !snapped; j += 1) {
      const c = bodies[j];
      if (c.resting) continue;
      const sc = blockSpan(c);
      if (Math.abs(a.px - c.px) >= sa.hx + sc.hx) continue;
      if (Math.abs(a.pz - c.pz) >= sa.hz + sc.hz) continue;
      const dy = a.py - c.py;
      if (dy <= 0.05 || dy >= BLOCK_H) continue; // a 不在 c 正上方一层内
      if (a.vy >= c.vy - 0.05) continue;         // a 没有在落向 c
      a.py = c.py + BLOCK_H;
      a.vy = 0;
      a.landed = true;
      a.support = j;
      snapped = true;
    }
  }
  const drag = Math.exp(-GROUND_DRAG * dt);
  let moving = 0;
  let drift = 0;
  let lift = 0;
  let airborne = 0;
  for (const b of bodies) {
    if (b.resting) continue;
    const floor = BLOCK_H / 2;
    if (b.py <= floor + EPS) {
      b.py = floor;
      b.landed = true;
      if (Math.abs(b.vy) < REST_SPEED * 4) {
        b.vy = 0;
      } else {
        b.vy = -b.vy * GROUND_RESTITUTION;
      }
    }
    // 触地/压到别的块之后才开始吃阻力；空中段保持惯性，塔才散得开
    if (b.landed) {
      b.vx *= drag;
      b.vz *= drag;
      b.spinX *= drag;
      b.spinZ *= drag;
    }
    // 安家条件：贴地静止，或"压在已静止的块背上且自身不再动弹"。
    // 只认贴地的话，搭在堆上的块永远拿不到 resting——支撑块每次从地面反弹
    // （GROUND_RESTITUTION）都会把背上的块上顶一次，整堆永远在动，早退条件
    // 永远不满足，3.2s 超时后留给收尾的是一摊高低不一的泡沫。
    // 静止块本身不会再动，所以"支撑已静止"是安全的递归基；高度差与 footprint
    // 双重校验防止支撑滑走后的块被粘在半空。
    // ⚠ 竖向阈值必须跟贴地路径一样用 REST_SPEED*4：一帧重力就有 0.08，卡着
    //   REST_SPEED(0.06) 会让背上的块永远差一点、永远安不了家（实测空转）。
    let supported = b.py <= floor + EPS;
    if (!supported && b.support >= 0) {
      const c = bodies[b.support];
      if (c.resting) {
        const sb = blockSpan(b);
        const sc = blockSpan(c);
        supported = Math.abs(b.px - c.px) < sb.hx + sc.hx
          && Math.abs(b.pz - c.pz) < sb.hz + sc.hz
          && Math.abs(b.py - (c.py + BLOCK_H)) < 0.05;
      }
    }
    if (supported && Math.abs(b.vy) < REST_SPEED * 4 && Math.hypot(b.vx, b.vz) < REST_SPEED) {
      b.vy = 0;
      b.vx = 0;
      b.vz = 0;
      settlePose(b);
      b.resting = true;
      continue;
    }
    moving += 1;
    drift = Math.max(drift, Math.hypot(b.vx, b.vz));
    lift = Math.max(lift, Math.abs(b.vy));
    if (!b.landed && b.py > floor + EPS) airborne += 1;
  }
  // 收尾：全部安家（贴地或压在静止块背上）；或每一块都已经落到地面/压到别的块上
  // 且不再漂移也不再起跳；否则空转到 3.2s 超时。
  // 超时路径也会走到这里——打包（planPack）保证终态干净，落位阶段只是让过渡可见。
  if (moving === 0 || (airborne === 0 && drift < REST_SPEED && lift < REST_SPEED * 4)
      || col.t >= COLLAPSE_TIME) {
    startSettle(state);
    return settleStep(state, dt);
  }
  return state;
}

// 落定姿态吸附：rx/rz 收到最近的 π 倍数 —— 一律躺平。
// 竖着立在场地上的块最扎眼，也最不像真的塌落；翻滚中停在任意角度的块同理。
function settlePose(b) {
  b.rx = Math.round(b.rx / Math.PI) * Math.PI;
  b.rz = Math.round(b.rz / Math.PI) * Math.PI;
  b.spinX = 0;
  b.spinZ = 0;
}

// 收尾整姿。旧版三种做法都失败过：
// ① 贪心按 py 往上叠——物理阶段被承接而压在别的块背上的块依次搁到已放置
//    块的顶上，54 块沿倒塌方向一块搭一块，实测搭出 32 层针塔（比原塔还高一倍）；
// ② 纯水平松弛——塔基密堆核心（54 块挤在约 25 平方单位里，密度 2.2）永远
//    收敛不了，残差照样叠成针塔；
// ③ 粗网格（0.6）代价搜索——"代价 = 堆高层数×3 + 位移"在碎片化空地上找不到
//    能容下 3×1 足迹的空位，泡沫态照样叠出 15 层塔（实测）。
// 现在按"物理落点高度"排序（先放原本就贴地的，再收半空中的），每块先用空间
// 哈希由近及远螺旋找空地躺平，找不到才叠到最高顶——密堆核心逐块向外摊开，
// 堆高有界，针塔结构上就叠不出来。
// 打包只算目标位姿（不发生修改），随后由 settleStep 逐块插值落位——直接一帧
// 拍过去会改动 16% 的画布像素，肉眼是个明显的"跳"。
function startSettle(state) {
  const col = state.collapse;
  const bodies = state.blocks;
  const order = bodies.map((_, i) => i).sort((i, j) =>
    (bodies[i].py - bodies[j].py)
    || (bodies[i].px - bodies[j].px)
    || (bodies[i].pz - bodies[j].pz));
  col.pack = planPack(bodies, order);
  col.settleT = 0;
  return state;
}

// 逐块打包。placed 里任何一块与本块水平相交时，本块必须垫在它上面至少一个
// BLOCK_H——top 取所有相交块的最高顶，因此打完包任何两块都不相交、没有悬空。
//
// 分两级，优先躺平：
// ① 螺旋扫周围候选点，第一个"足迹不撞任何已放置块"的环上取最近点——那就是
//    空地，直接搁地面（py = BLOCK_H/2）。判定用空间哈希（DEBRIS_PACK_CELL），
//    精确且 O(1)。密堆核心因此逐块向外摊开，而不是原地往上叠。
// ② 搜索半径内实在没有空地（极端密堆）才叠：取当前脚印下所有相交已放置块
//    的最高顶。因为①已经把能摊开的都摊开了，②只是兜底，堆不高也形不成针塔。
function planPack(bodies, order) {
  const spans = bodies.map(blockSpan);
  // 网格范围 = 所有块足迹并集外扩（搜索半径 + 一个块长），候选足迹必在界内
  let gx0 = Infinity;
  let gx1 = -Infinity;
  let gz0 = Infinity;
  let gz1 = -Infinity;
  for (const b of bodies) {
    const sb = blockSpan(b);
    gx0 = Math.min(gx0, b.px - sb.hx);
    gx1 = Math.max(gx1, b.px + sb.hx);
    gz0 = Math.min(gz0, b.pz - sb.hz);
    gz1 = Math.max(gz1, b.pz + sb.hz);
  }
  const pad = DEBRIS_PACK_RINGS * DEBRIS_PACK_STEP + BLOCK_L;
  gx0 -= pad;
  gx1 += pad;
  gz0 -= pad;
  gz1 += pad;
  const W = Math.ceil((gx1 - gx0) / DEBRIS_PACK_CELL) + 1;
  const H = Math.ceil((gz1 - gz0) / DEBRIS_PACK_CELL) + 1;
  const occ = new Int16Array(W * H);
  const stamp = (px, pz, sb, delta) => {
    const x0 = Math.floor((px - sb.hx - gx0) / DEBRIS_PACK_CELL);
    const x1 = Math.floor((px + sb.hx - gx0) / DEBRIS_PACK_CELL);
    const z0 = Math.floor((pz - sb.hz - gz0) / DEBRIS_PACK_CELL);
    const z1 = Math.floor((pz + sb.hz - gz0) / DEBRIS_PACK_CELL);
    for (let cx = x0; cx <= x1; cx += 1) {
      const row = cx * H;
      for (let cz = z0; cz <= z1; cz += 1) occ[row + cz] += delta;
    }
  };
  const freeAt = (px, pz, sb) => {
    const x0 = Math.floor((px - sb.hx - gx0) / DEBRIS_PACK_CELL);
    const x1 = Math.floor((px + sb.hx - gx0) / DEBRIS_PACK_CELL);
    const z0 = Math.floor((pz - sb.hz - gz0) / DEBRIS_PACK_CELL);
    const z1 = Math.floor((pz + sb.hz - gz0) / DEBRIS_PACK_CELL);
    for (let cx = x0; cx <= x1; cx += 1) {
      const row = cx * H;
      for (let cz = z0; cz <= z1; cz += 1) {
        if (occ[row + cz] > 0) return false;
      }
    }
    return true;
  };
  const out = new Array(bodies.length);
  const placed = [];
  for (let seq = 0; seq < order.length; seq += 1) {
    const idx = order[seq];
    const b = bodies[idx];
    const sb = spans[idx];
    // ① 由近及远找空地：同一环上取距原位最近的点，找到即止（环 r 的点全比环 r-1 远）
    let bx = b.px;
    let bz = b.pz;
    let py = -1;
    let bestD2 = Infinity;
    for (let ring = 0; ring <= DEBRIS_PACK_RINGS && py < 0; ring += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        for (let dz = -ring; dz <= ring; dz += 1) {
          if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
          const px = b.px + dx * DEBRIS_PACK_STEP;
          const pz = b.pz + dz * DEBRIS_PACK_STEP;
          if (!freeAt(px, pz, sb)) continue;
          const d2 = dx * dx + dz * dz;
          if (d2 < bestD2) {
            bestD2 = d2;
            bx = px;
            bz = pz;
            py = BLOCK_H / 2;
          }
        }
      }
    }
    // ② 密堆残差：原地叠到相交已放置块的最高顶上
    if (py < 0) {
      let top = BLOCK_H / 2;
      for (const c of placed) {
        if (Math.abs(b.px - c.px) >= sb.hx + c.span.hx) continue;
        if (Math.abs(b.pz - c.pz) >= sb.hz + c.span.hz) continue;
        if (c.py + BLOCK_H > top) top = c.py + BLOCK_H;
      }
      py = top;
    }
    const fx = b.px;
    const fy = b.py;
    const fz = b.pz;
    const frx = b.rx;
    const frz = b.rz;
    out[idx] = {
      fx,
      fy,
      fz,
      frx,
      frz,
      px: bx,
      py,
      pz: bz,
      rx: Math.round(b.rx / Math.PI) * Math.PI,
      rz: Math.round(b.rz / Math.PI) * Math.PI,
      delay: seq * SETTLE_STAGGER,
      dur: Math.min(1.2, Math.max(0.08, Math.hypot(bx - fx, py - fy, bz - fz) / SETTLE_SPEED)),
    };
    stamp(bx, bz, sb, 1);
    placed.push({ px: bx, py, pz: bz, span: sb });
  }
  return out;
}

// 落位阶段：每块延迟一点出发，以恒定速度滑向目标位姿；全部到位（或 SETTLE_MAX_TIME
// 兜底）后落精确值、置 resting、翻 LOST。这期间 status 仍是 COLLAPSE，UI 不受影响。
function settleStep(state, dt) {
  const col = state.collapse;
  col.settleT += dt;
  let done = true;
  for (let i = 0; i < state.blocks.length; i += 1) {
    const b = state.blocks[i];
    const t = col.pack[i];
    const local = col.settleT - t.delay;
    if (local <= 0) {
      done = false;
      continue;
    }
    const k = Math.min(1, local / t.dur);
    b.px = t.fx + (t.px - t.fx) * k;
    b.py = t.fy + (t.py - t.fy) * k;
    b.pz = t.fz + (t.pz - t.fz) * k;
    b.rx = t.frx + (t.rx - t.frx) * k;
    b.rz = t.frz + (t.rz - t.frz) * k;
    b.vx = 0;
    b.vy = 0;
    b.vz = 0;
    b.spinX = 0;
    b.spinZ = 0;
    if (k < 1) done = false;
  }
  if ((done && col.settleT > 0.05) || col.settleT >= SETTLE_MAX_TIME) {
    for (let i = 0; i < state.blocks.length; i += 1) {
      const b = state.blocks[i];
      const t = col.pack[i];
      b.px = t.px;
      b.py = t.py;
      b.pz = t.pz;
      b.rx = t.rx;
      b.rz = t.rz;
      b.vx = 0;
      b.vy = 0;
      b.vz = 0;
      b.spinX = 0;
      b.spinZ = 0;
      b.resting = true;
    }
    col.pack = null;
    col.done = true;
    state.status = STATUS.LOST;
  }
  return state;
}

// ---------------------------------------------------------------- 帧步进

function gustForce(state) {
  if (!state.gust.enabled) return { x: 0, z: 0 };
  const g = state.gust;
  const phase = g.t % g.period;
  if (phase >= g.duration) return { x: 0, z: 0 };
  const env = Math.sin((Math.PI * phase) / g.duration);
  return { x: g.amp * env * g.dirX, z: g.amp * env * g.dirZ };
}

function stepSway(state, dt) {
  const comH = Math.max(state.com.y, BLOCK_H);
  const omega = Math.sqrt(GRAVITY / comH);
  const heightRatio = clamp(START_LAYERS / Math.max(layerCount(state), 1), 0.5, 2);
  const zeta = SWAY_ZETA * heightRatio;
  // 平衡倾角 = 质心相对塔垫中心的偏移，用「警戒半径 LEAN_REF」归一化后映射到倾角。
  // 铁律：绝不能用底层包围盒中心当基准 —— 抽掉底层一块会让盒中心瞬移 0.5（半个块宽），
  // eq 一帧内跳到 5°，开局第二次操作必塌（实测）。塔垫中心固定，eq 只随质心单调漂移：
  // 塔底被掏空的风险交给档 1/档 2，塔顶堆叠的重心风险交给档 3 —— 正是"抽伤塔底、堆险塔顶"。
  // 基准取**底层的固有摆放偏移**（layers[0].ox/oz），不是底层包围盒中心：
  // 后者会随"抽掉底层一块"瞬移半个块宽，eq 一帧内跳到 5°（实测开局第二次操作必塌）。
  const baseX = state.layers[0]?.ox || 0;
  const baseZ = state.layers[0]?.oz || 0;
  const gain = (layerCount(state) / START_LAYERS) ** LEAN_HEIGHT_GAIN;
  const eqX = Math.atan2(state.com.x - baseX, comH) * gain;
  const eqZ = Math.atan2(state.com.z - baseZ, comH) * gain;
  const g = state.gust;
  if (g.enabled) {
    const prev = g.t % g.period;
    g.t += dt;
    if (g.t % g.period < prev) {
      const ang = randRange(state, 0, Math.PI * 2);
      g.dirX = Math.cos(ang);
      g.dirZ = Math.sin(ang);
    }
  }
  const gust = gustForce(state);
  const s = state.sway;
  const ax = -omega * omega * (s.tx - eqX) - 2 * zeta * omega * s.vx + gust.x;
  const az = -omega * omega * (s.tz - eqZ) - 2 * zeta * omega * s.vz + gust.z;
  s.vx += ax * dt;
  s.vz += az * dt;
  const prevTilt = tiltOf(state);
  s.tx += s.vx * dt;
  s.tz += s.vz * dt;
  const tilt = tiltOf(state);

  state.danger = Math.max(state.geomDanger, clamp(tilt / LEAN_LIMIT, 0, 1));

  // 档 3：倾角 ≥ 3° 且当帧无回落趋势（径向速度未指向回正方向）→ 判倒。
  if (tilt >= LEAN_LIMIT) {
    const radial = tilt > EPS ? (s.tx * s.vx + s.tz * s.vz) / tilt : 0;
    if (radial >= -SWAY_TOL) {
      state.verdict = { gear: 3, lean: tilt, prevTilt };
      startCollapse(state);
    }
  }
  return state;
}

export function stepFrame(state, dt = FIXED_DT) {
  if (state.status === STATUS.COLLAPSE) return stepCollapse(state, dt);
  if (state.status !== STATUS.IDLE && state.status !== STATUS.HOLDING) return state;
  state.time += dt;
  return stepSway(state, dt);
}

export function isOver(state) {
  return state.status === STATUS.LOST || state.status === STATUS.WON;
}

// ---------------------------------------------------------------- 供 UI / 计分读取的快照

export function towerStats(state) {
  const live = towerBlocks(state);
  return {
    status: state.status,
    layers: layerCount(state),
    blocks: live.length,
    held: state.held,
    height: layerCount(state) * BLOCK_H,
    danger: clamp(state.danger, 0, 1),
    leanDeg: (tiltOf(state) * 180) / Math.PI,
    com: { x: state.com.x, z: state.com.z, y: state.com.y },
    streak: state.streak,
    bestStreak: state.bestStreak,
    pullCount: state.pullCount,
    stackCount: state.stackCount,
    topSlots: state.layers[state.layers.length - 1]?.slots.slice() ?? []
  };
}

// 可抽块列表（UI 高亮端头柔光用）
export function pullableBlocks(state) {
  const list = [];
  for (let layer = 0; layer < state.layers.length; layer += 1) {
    for (let slot = 0; slot < PER_LAYER; slot += 1) {
      if (canPull(state, layer, slot)) list.push({ layer, slot, id: state.layers[layer].slots[slot] });
    }
  }
  return list;
}
