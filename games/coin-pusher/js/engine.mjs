// 推币机 · 规则唯一权威（纯函数，严格 DOM-free，禁碰 DOM / 存储）
//
// 核心契约：
//   1. 120Hz 固定步长 stepFrame(state, dt, inputs) —— 纯函数帧步进，同种子同输入逐帧一致；
//   2. 俯视 2D 推币物理：等质量圆盘刚体、动量守恒弹性碰撞、台面摩擦阻尼、
//      往复推板（梯形速度曲线）、球心越过边缘线即落袋、堆叠挤压；
//   3. 高速金币自适应子步进（CCD），杜绝穿币穿板；
//   4. 确定性种子 PRNG（mulberry32）注入投币抖动 / 挡杆阵 / 奖励物摆放 / 机关触发；
//   5. 街机真实投币：**固定投币口 + 挡杆阵**（玩家不可选落点），金币经挡杆随机弹跳后落台；
//   6. 账户制：投币 −1、前方落袋 +1、两侧沟槽丢失 0（真实机台的 house edge）；
//   7. 无尽机台：无章节无关卡目标，每 TOKEN_INTERVAL 枚补投一个随机机关，账户归零才收工；
//   8. 边缘连锁翻倍：波内第 m 枚得 base × 2^(m-1)，封顶 2^18 = 262144。
//   9. 账户守恒：coins + drops + lostCoins + cleared === initial + inserted + towers

import { ENDLESS_LAYOUT, CARD_EFFECTS, TOKEN_TABLE, TOKEN_AREA } from "./levels.mjs";
import { cascadeMult, coinValue, CASCADE_WINDOW, JACKPOT_MULT } from "./score.mjs";

export const FIXED_DT = 1 / 120;

// ---- 几何（单位 = 金币直径，金币半径 0.5）----
export const COIN_R = 0.5;
export const FIELD_W = 13;
export const FIELD_H = 11;

// 推板行程铁律：推板前缘的**最远位置**必须真正越过首行铺币的球心，
// 否则推板只能擦到币缘、一帧都推不动（clampToPusher 的 `coin.y < plateFront + r`
// 永不成立），"推动"机制静默失效 —— 实测整堆币在 2.5 个推板周期后位移仅 0.00001。
// 这里把整段行程前移（保持行程长度与推进速度基本不变），使最远 minY = 4.60
// 真正压进首行铺币（4.15）以内 0.45。
export const PUSHER_RETRACT = 3.20;
export const PUSHER_EXTEND = 4.10;
export const PUSH_STROKE = PUSHER_EXTEND - PUSHER_RETRACT;
export const PUSH_FWD_TIME = 1.2;
export const PUSH_BACK_TIME = 1.2;
export const PUSH_CYCLE = PUSH_FWD_TIME + PUSH_BACK_TIME;

// ---- 物理常数 ----
export const FRICTION = 3.0;
export const RESTITUTION = 0.42;
export const MAX_SPEED = 14;
export const MAX_SUBSTEP = 4;
export const SOLVER_ITERATIONS = 4;
export const SOLVER_RELAX = 0.55;
// 圆盘可压缩系数：金币堆在推板压力下允许 20% 互叠，形成真实"挤压成堆"的手感。
// 若不允许压缩，整堆会像刚体一样整体平移，一次投币就推落一整排（严重失衡）。
export const PACK_FACTOR = 0.8;
export const CELL = 2.8;
export const SPEED_EPS = 0.02;
// 边缘悬垂（Overhang）：球心越过悬垂带起点后，有效支撑面积随悬垂量线性减少，
// 外倾加速度随之线性增强 —— 这是"金币在边缘微微颤动、随时坠落"的唯一来源。
// 铁律：带外必须严格零力。曾经 TIP_ZONE = 0.5（= 一个币半径），意味着币心距边缘
// 还有半个币、整枚币仍完全压在台面上时就被持续外推 —— 静止币会自己爬出去
// （实测 0.68s 自行落袋，属"无人推动的自动移动"）。真实倾覆临界在币心越过边缘线
// 附近，故收窄到 0.22 并改为线性权重。
export const TIP_ZONE = 0.22;
export const TIP_ACCEL = 8.0;

// ---- 投币通道（固定投币口，玩家不可选落点）----
// 真实街机推币机只有一个投币口：币从机顶落入，穿过遮挡杆阵随机弹跳，
// 落点由物理决定而非玩家指定。这里用「通道内自由落体 + 挡杆圆-圆弹性碰撞」实现。
export const CHUTE_X = FIELD_W / 2;   // 投币口中心（世界 x）
export const CHUTE_Y0 = 0.40;         // 投币口出口的世界 y
export const CHUTE_SPEED = 4.0;       // 出口初速（沿 +y）
export const CHUTE_SPREAD = 0.34;     // 出口横向抖动 ±
export const CHUTE_SIDE = 0.45;       // 出口横向初速 ±
export const DROP_GRAVITY = 10.0;     // 通道内沿 +y 的重力加速度
export const DROP_MAX_AIR = 2.4;      // 通道内最长飞行时长（秒）：超时即放弃挡杆直落，绝不瞬移
export const CHUTE_DAMP = 4.2;        // 通道内横向阻尼：金属滑道，币被杆弹开后很快停止横滑
export const DROP_SPREAD_BONUS = 0.0; // 预留：投币口磨损导致的额外散布

// ---- 遮挡杆阵（挡杆：币下落随机轨迹与位置）----
// 几何铁律：相邻两排的净空必须大于「币心到杆心的碰撞距离」，
// 否则币会被两排杆同时顶住、永远悬在杆阵里（表现为落点退化成投币口抖动）。
//   minD = PEG_R + COIN_R = 0.60；PEG_ROW_GAP = 1.05 > 2 × 0.60 ✓
export const PEG_R = 0.10;
export const PEG_ROWS = 3;
export const PEG_Y0 = 0.80;
export const PEG_ROW_GAP = 1.05;
export const PEG_COLS = 6;
export const PEG_COL_GAP = 2.30;
// 逐排横向错位（单位 = PEG_COL_GAP 的比例）。刻意不用 0.5 的规整错位：
// 0.5 错位会让"上一排的缝隙"正对"下一排的杆心"，币必然正心命中、弹道退化。
export const PEG_ROW_OFFSET = [0, 0.42, 0.21];
export const PEG_JITTER = 0.34;       // 每根杆的确定性位置抖动（破对称，避免固定弹道）
export const PEG_BOUNCE = 0.45;       // 杆体弹性
// 近正心命中是不稳定平衡：真实机台上币会从任一侧滑开，这里按 (币 id + 杆序号) 确定性择向。
export const PEG_DEAD_ZONE = 0.24;
// 多杆夹持（币同时顶住两根杆）时的脱困横速：杆缝净空小于币径本身就是病态几何，
// 币必须能被挤出来而不是悬死在缝里。
export const PEG_SLIDE = 1.6;

// ---- 两侧丢币沟槽（真实机台 house edge 的主要来源）----
// 台面左右各留一条沟槽带：币心进入带内后只受一条"低挡边"的软回推，
// 一旦被挤出去（币心出界）即落进侧仓——不计分、不回账户。
export const GUTTER = 0.85;
export const GUTTER_PUSH = 18.0;      // 低挡边弹簧强度
// 低挡边是「被动障碍」而不是「持续吹风」：只有弹簧、没有阻尼时，币会以稳态速度
// 自己滑出沟槽带（实测静止币 2 秒滑 0.63 单位并过冲到 0.93，视觉上就是"金币无人
// 推动却自己往中间飘"）。阻尼吸收回弹动能，使币快速归位且不过冲；带外严格零力。
export const GUTTER_DAMP = 9.0;

// ---- 计分：边缘连锁翻倍（唯一口径见 score.mjs）----
export const COIN_VALUES = { norm: 10, gold: 50, gem: 100, tower: 0 };

// ---- 增益与机关 ----
export const EFFECT_TIME = 3;
export const SPEED_BOOST = 1.5;
export const CARD_W = 1.7;
export const CARD_H = 0.7;
export const CARD_PAD = 0.05;
export const LAUNCHER_R = 0.85;
export const LAUNCH_SPEED = 4.2;
// 腾空时长必须与抛掷抛物线自洽：从出手到落回台面 t = 2·v/g。
// 曾经写死 0.6s（短于抛物线周期），币在"还在上升"时就被按回台面 → 一次可见的位置突跳。
export const LAUNCH_AIR = (2 * LAUNCH_SPEED) / DROP_GRAVITY;
export const LAUNCH_COOLDOWN = 2.2;
// 弹射器必须被"正在被推动的金币"撞到才触发：静置在弹射器上的初始铺币不得凭空弹射，
// 否则开局静置就能白拿落袋分（也破坏了"开局台面静止"这一不变量）。
export const LAUNCH_TRIGGER_VY = 0.35;
export const LAUNCH_TRIGGER_SPEED = 0.5;
export const MAGNET_R = 1.15;
export const MAGNET_RADIUS = 3.4;
export const MAGNET_FORCE = 4.6;
export const TOWER_R = 1.25;
export const TOWER_MASS = 2.0;
export const TOWER_BONUS = 2000;
export const TOWER_CREDITS = 15;      // 金塔落袋的账户回币（大奖）
export const MAX_COINS = 260;
export const SETTLE_TIME = 2.2;

// ---- 账户 ----
export const CREDIT_OPTIONS = [20, 50, 100];
export const DEFAULT_CREDITS = 50;
export const MAX_CREDITS = 999;
export const TOKEN_INTERVAL = 14;     // 每投入多少枚币补投一个机关
export const MAX_TOKENS = 10;         // 台面同时存在的机关上限（超限时挤掉最早的，防堆砌成灾）

// ---- 模式 / 状态 ----
export const MODE = { ENDLESS: "endless" };
export const STATUS = { READY: "ready", PLAYING: "playing", WON: "won", LOST: "lost" };

// ---------------------------------------------------------------- PRNG

// mulberry32：确定性种子 PRNG，状态保存在 state.rngState 内，可逐帧重放。
export function nextRandom(state) {
  const a = (state.rngState + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  state.rngState = a;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function mulberry32(seed) {
  const holder = { rngState: seed >>> 0 };
  return () => nextRandom(holder);
}

// ---------------------------------------------------------------- 小工具

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// 梯形速度曲线：加速 18% / 匀速 64% / 减速 18%，面积归一化为 1。
export function trapezoid(u) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const a = 0.18;
  const c = 1 - 2 * a;
  const vmax = 1 / (1 - a);
  if (u < a) return (0.5 * vmax * u * u) / a;
  if (u < a + c) return 0.5 * vmax * a + vmax * (u - a);
  const w = u - a - c;
  return 0.5 * vmax * a + vmax * c + vmax * (w - (0.5 * w * w) / a);
}

export function plateFrontAt(phase, cycleScale = 1) {
  const fwd = PUSH_FWD_TIME / cycleScale;
  const back = PUSH_BACK_TIME / cycleScale;
  const cycle = fwd + back;
  const t = ((phase % 1) + 1) % 1 * cycle;
  const s = t < fwd ? trapezoid(t / fwd) : 1 - trapezoid((t - fwd) / back);
  return PUSHER_RETRACT + s * PUSH_STROKE;
}

function cycleScaleOf(state) {
  return state.effects.speed > 0 ? SPEED_BOOST : 1;
}

// ---------------------------------------------------------------- 状态构造

// coin.chute > 0 ：正在投币通道内下落（受通道重力 + 挡杆阵 + 通道侧壁约束，
//                 越过推板前缘才落地）。落点完全由物理决定，玩家不可指定。
// coin.air   > 0 ：一般性腾空（弹射器抛出），只做视觉抬升与"不参与台面碰撞"。
function makeCoin(id, x, y, kind) {
  const r = kind === "tower" ? TOWER_R : COIN_R;
  const mass = kind === "tower" ? TOWER_MASS : 1;
  return { id, x, y, vx: 0, vy: 0, r, mass, kind, air: 0, chute: 0, chuteTimer: 0, pegFree: false };
}

function makeToken(id, spec) {
  const type = spec.t;
  if (type === "card") {
    return {
      id, type: "card", effect: spec.e, x: spec.x, y: spec.y,
      w: CARD_W, h: CARD_H, r: 0, used: false, cooldown: 0, pulse: 0
    };
  }
  if (type === "launcher") {
    return { id, type: "launcher", effect: "", x: spec.x, y: spec.y, w: 0, h: 0, r: LAUNCHER_R, used: false, cooldown: 0, pulse: 0 };
  }
  if (type === "magnet") {
    return { id, type: "magnet", effect: "", x: spec.x, y: spec.y, w: 0, h: 0, r: MAGNET_R, used: false, cooldown: 0, pulse: 0 };
  }
  return null;
}

// 金塔是实体刚体（重、大），作为一枚特殊金币直接进入物理台面。
function isTowerSpec(spec) {
  return spec.t === "tower";
}

// 台面铺币：六方最密堆积（交错行），保证初始即为最密排布，
// 不会在开局后因重新排列而额外吸收投币量（那会让推币机的出币率失真）。
export const PACK_COL = 0.82;
export const PACK_ROW = 0.7;

function buildField(state, layout) {
  const coins = [];
  const rows = Math.max(0, layout.rows | 0);
  const colGap = PACK_COL;
  const rowGap = PACK_ROW;
  const startY = layout.startY;
  const startX = GUTTER + 0.12;
  const endX = FIELD_W - GUTTER - 0.12;
  for (let r = 0; r < rows; r++) {
    const y = startY + r * rowGap;
    const x0 = startX + (r % 2) * (colGap / 2);
    for (let x = x0; x <= endX + 1e-6; x += colGap) {
      if (coins.length >= MAX_COINS) break;
      if (nextRandom(state) < 0.04) continue;
      const jx = (nextRandom(state) - 0.5) * 0.05;
      const jy = (nextRandom(state) - 0.5) * 0.05;
      const roll = nextRandom(state);
      let kind = "norm";
      if (roll < layout.gemRatio) kind = "gem";
      else if (roll < layout.gemRatio + layout.goldRatio) kind = "gold";
      coins.push(makeCoin(state.nextCoinId++, x + jx, y + jy, kind));
    }
  }
  return coins;
}

// 初始铺币松弛：六方堆积间距（PACK_COL / PACK_ROW）与碰撞求解器的最小净距
// （2r × PACK_FACTOR）之间只留了 0.011 的余量，而每枚币还带 ±0.025 的位置抖动，
// 于是开局台面本身就存在一批"重叠"币对。求解器会在开局后把这些重叠逐一推开，
// 整片币网随之自行松开 —— 表现为「无人推动时金币自己浮动」
// （实测 117 枚中 102 枚自发位移，最大 0.063）。
// 这里在开局前做一次确定性的纯位置松弛（零速度、零随机），
// 使台面一开始就处于"无重叠 + 静止"的静力平衡态。
function settleField(coins) {
  const minD = 2 * COIN_R * PACK_FACTOR;
  const minD2 = minD * minD;
  for (let iter = 0; iter < 16; iter++) {
    let worst = 0;
    for (let i = 0; i < coins.length; i++) {
      const a = coins[i];
      for (let j = i + 1; j < coins.length; j++) {
        const b = coins[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD2) continue;
        const d = Math.sqrt(d2);
        let nx;
        let ny;
        if (d < 1e-6) {
          const ang = (a.id * 2.399963) % (Math.PI * 2);
          nx = Math.cos(ang);
          ny = Math.sin(ang);
        } else {
          nx = dx / d;
          ny = dy / d;
        }
        const push = (minD - d) * 0.5;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        if (minD - d > worst) worst = minD - d;
      }
    }
    // 每轮把越界的币夹回合法区（边界是硬约束，优先级高于分离）
    for (const coin of coins) {
      if (coin.x < GUTTER + 0.05) coin.x = GUTTER + 0.05;
      else if (coin.x > FIELD_W - GUTTER - 0.05) coin.x = FIELD_W - GUTTER - 0.05;
      if (coin.y < PUSHER_RETRACT + coin.r) coin.y = PUSHER_RETRACT + coin.r;
      else if (coin.y > FIELD_H - 0.06) coin.y = FIELD_H - 0.06;
    }
    if (worst < 1e-4) break;
  }
}

// 挡杆阵：机顶投币口下方三排交错的金属挡杆，位置带确定性抖动。
// 抖动是必要的——完全对称的杆阵会让金币弹道退化（永远往同一侧弹），
// 随机轨迹就成了摆设；抖动由 seed 决定，仍然可逐帧重放。
function buildPegs(state) {
  const pegs = [];
  const span = (PEG_COLS - 1) * PEG_COL_GAP;
  const x0 = CHUTE_X - span / 2;
  for (let r = 0; r < PEG_ROWS; r++) {
    const y = PEG_Y0 + r * PEG_ROW_GAP;
    const off = (PEG_ROW_OFFSET[r % PEG_ROW_OFFSET.length] || 0) * PEG_COL_GAP;
    for (let c = 0; c < PEG_COLS; c++) {
      const x = x0 + c * PEG_COL_GAP + off;
      if (x < 0.4 || x > FIELD_W - 0.4) continue;
      const jx = (nextRandom(state) - 0.5) * PEG_JITTER;
      const jy = (nextRandom(state) - 0.5) * PEG_JITTER * 0.6;
      pegs.push({ i: pegs.length, row: r, x: x + jx, y: y + jy, r: PEG_R });
    }
  }
  return pegs;
}

// 无尽机台：一套固定的初始台面（无章节、无目标），机关由投币数动态补投。
function populate(state) {
  state.tokens = [];
  state.coins = buildField(state, ENDLESS_LAYOUT);
  settleField(state.coins);
}

function normalizeCredits(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CREDITS;
  return clamp(n, 1, MAX_CREDITS);
}

export function createInitialState(options = {}) {
  const seed = Number.isFinite(options.seed) ? options.seed >>> 0 : 20261008;
  const credits = normalizeCredits(options.credits ?? DEFAULT_CREDITS);
  const state = {
    mode: MODE.ENDLESS,
    seed,
    rngState: seed,
    status: STATUS.READY,
    time: 0,
    score: 0,
    credits,
    startCredits: credits,
    inserted: 0,
    dropped: 0,
    lostCoins: 0,
    cleared: 0,     // 被机关挤掉的金币（金塔落场时为腾出空间而移除的币）
    towers: 0,      // 累计投放的金塔数（账户守恒式的一项）
    nextCoinId: 1,
    nextTokenId: 1,
    plateFront: PUSHER_RETRACT,
    pusherVel: 0,
    pusherPhase: 0,
    coins: [],
    tokens: [],
    pegs: [],
    effects: { double: 0, speed: 0, magnet: 0 },
    cascadeCount: 0,
    cascadeMult: 1,
    cascadeTimer: 0,
    bestCascade: 0,
    maxMult: 1,
    drops: 0,
    cardsCollected: 0,
    towerDown: false,
    tray: [0, 0],
    idleTimer: 0
  };
  // 顺序固定：先杆阵后铺币，保证同 seed 的 PRNG 消耗序列稳定。
  state.pegs = buildPegs(state);
  populate(state);
  return state;
}

export function cloneState(state) {
  return {
    ...state,
    coins: state.coins.map((coin) => ({ ...coin })),
    tokens: state.tokens.map((token) => ({ ...token })),
    pegs: state.pegs,
    effects: { ...state.effects },
    tray: state.tray.slice()
  };
}

// ---------------------------------------------------------------- 投币意图

export function canInsert(state) {
  if (state.status !== STATUS.PLAYING && state.status !== STATUS.READY) return false;
  if (state.credits <= 0) return false;
  if (state.coins.length >= MAX_COINS) return false;
  return true;
}

// 机关随机补投：每投入 TOKEN_INTERVAL 枚币，在台面后段随机补一个机关/奖励物。
// 位置与类型都走确定性 PRNG，同 seed 完全可重放。
function maybeSpawnToken(state, events) {
  if (state.inserted <= 0 || state.inserted % TOKEN_INTERVAL !== 0) return;
  const roll = nextRandom(state);
  let spec = TOKEN_TABLE[TOKEN_TABLE.length - 1];
  for (const entry of TOKEN_TABLE) {
    if (roll < entry.upto) { spec = entry; break; }
  }
  const x = TOKEN_AREA.x0 + nextRandom(state) * (TOKEN_AREA.x1 - TOKEN_AREA.x0);
  const y = TOKEN_AREA.y0 + nextRandom(state) * (TOKEN_AREA.y1 - TOKEN_AREA.y0);
  const type = spec.t;

  if (type === "tower") {
    const tower = makeCoin(state.nextCoinId++, x, y, "tower");
    // 金塔是实心重物，必须为其让出空间，否则求解器会把压在里面的金币弹飞。
    const kept = [];
    for (const coin of state.coins) {
      const dx = coin.x - x;
      const dy = coin.y - y;
      const minD = (TOWER_R + coin.r) * PACK_FACTOR + 0.03;
      if (dx * dx + dy * dy >= minD * minD) kept.push(coin);
    }
    state.cleared += state.coins.length - kept.length;
    state.coins = kept;
    state.coins.push(tower);
    state.towers += 1;
    events.push({ type: "token_spawn", token: "tower", x, y });
    return;
  }

  const effect = type === "card"
    ? CARD_EFFECTS[Math.floor(nextRandom(state) * CARD_EFFECTS.length) % CARD_EFFECTS.length]
    : "";
  const token = makeToken(state.nextTokenId++, { t: type, e: effect, x, y });
  if (!token) return;
  state.tokens.push(token);
  // 机关不会自行离场，不设上限会在长局里堆满整个台面。
  while (state.tokens.length > MAX_TOKENS) state.tokens.shift();
  events.push({ type: "token_spawn", token: type, effect, x, y });
}

// 投币：落点完全由投币口 + 挡杆阵决定，玩家不能指定位置或力度。
export function insertCoin(state) {
  if (!canInsert(state)) return { state, events: [] };
  const s = cloneState(state);
  const events = [];
  if (s.status === STATUS.READY) s.status = STATUS.PLAYING;

  s.credits -= 1;
  s.inserted += 1;

  const jitter = (nextRandom(s) - 0.5) * 2 * (CHUTE_SPREAD + DROP_SPREAD_BONUS);
  const coin = makeCoin(s.nextCoinId++, CHUTE_X + jitter, CHUTE_Y0, "norm");
  coin.vy = CHUTE_SPEED;
  coin.vx = (nextRandom(s) - 0.5) * 2 * CHUTE_SIDE;
  coin.chute = 1;
  coin.chuteTimer = 0;
  s.coins.push(coin);
  s.idleTimer = 0;

  maybeSpawnToken(s, events);

  events.push({ type: "insert", x: coin.x, credits: s.credits });
  return { state: s, events };
}

// ---------------------------------------------------------------- 物理

function applyFriction(state, dt) {
  const damp = Math.exp(-FRICTION * dt);
  const airDamp = Math.exp(-0.25 * dt);
  for (const coin of state.coins) {
    const k = coin.chute > 0 || coin.air > 0 ? airDamp : damp;
    coin.vx *= k;
    coin.vy *= k;
    if (Math.abs(coin.vx) < SPEED_EPS) coin.vx = 0;
    if (Math.abs(coin.vy) < SPEED_EPS) coin.vy = 0;
  }
}

// 通道内下落：沿 +y 的重力加速（投币口的自由落体）
// 横向单独强阻尼：真实投币滑道是金属管，币被挡杆弹开后很快就会停止横滑。
// 曾经只给 0.25/s 的"空气阻尼"，币被杆弹一下能横漂 3 秒、净偏移最多 4 个单位
// （13 宽的台面 = 30%）——这就是用户看到的"金币左右漂移、投币位置不准"。
function applyDropGravity(state, dt) {
  const k = Math.exp(-CHUTE_DAMP * dt);
  for (const coin of state.coins) {
    if (coin.chute > 0) {
      coin.vx *= k;
      if (Math.abs(coin.vx) < SPEED_EPS) coin.vx = 0;
      coin.vy += DROP_GRAVITY * dt;
    } else if (coin.air > 0) {
      // 腾空币同样受重力：弹射是"抛掷"，不是无重力的平移漂浮。
      coin.vy += DROP_GRAVITY * dt;
    }
  }
}

// 边缘悬垂：只有球心真正进入悬垂带的币才受外倾力，且强度随悬垂量线性增长。
// 带外（币心距边缘 > TIP_ZONE）严格零力 —— 这是"无人推动绝不自行移动"的保证。
function applyEdgeTip(state, dt) {
  const line = FIELD_H - TIP_ZONE;
  for (const coin of state.coins) {
    if (coin.chute > 0 || coin.air > 0) continue;
    if (coin.y <= line) continue;
    const t = Math.min(1, (coin.y - line) / TIP_ZONE);
    coin.vy += TIP_ACCEL * t * dt;
  }
}

// 两侧低挡边：币心进入沟槽带后受到向内的弹簧回推 + 侧向阻尼（弹簧-阻尼器模型）。
// 被推板挤压得足够狠的币会突破挡边掉进侧仓——这就是真实机台的 house edge。
// 阻尼是必需的：只有弹簧时币被推回后会带着动能冲过边界，且整个过程缓慢可见。
function applyGutter(state, dt) {
  for (const coin of state.coins) {
    if (coin.chute > 0 || coin.air > 0) continue;
    if (coin.x < GUTTER) {
      const t = 1 - coin.x / GUTTER;
      coin.vx += (GUTTER_PUSH * t - GUTTER_DAMP * coin.vx) * dt;
    } else if (coin.x <= FIELD_W && coin.x > FIELD_W - GUTTER) {
      const t = 1 - (FIELD_W - coin.x) / GUTTER;
      coin.vx -= (GUTTER_PUSH * t - GUTTER_DAMP * coin.vx) * dt;
    }
  }
}

function applyMagnet(state, dt) {
  const pullCenterX = state.effects.magnet > 0;
  for (const token of state.tokens) {
    if (token.type !== "magnet") continue;
    for (const coin of state.coins) {
      const dx = token.x - coin.x;
      const dy = token.y - coin.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > MAGNET_RADIUS * MAGNET_RADIUS || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const strength = MAGNET_FORCE * (1 - d / MAGNET_RADIUS) * dt * (coin.mass > 1 ? 0.35 : 1);
      coin.vx += (dx / d) * strength;
      coin.vy += (dy / d) * strength;
    }
  }
  if (pullCenterX) {
    const mid = FIELD_W / 2;
    for (const coin of state.coins) {
      const dx = mid - coin.x;
      if (Math.abs(dx) < 0.05) continue;
      coin.vx += Math.sign(dx) * MAGNET_FORCE * 0.7 * dt * (coin.mass > 1 ? 0.35 : 1);
    }
  }
}

// 挡杆碰撞：只作用于通道内下落的币（chute > 0）。杆体不动，币按弹性反射。
// 这是「币下落随机轨迹与位置」的唯一来源——完全由几何与初速决定，可重放。
function resolvePegs(state) {
  if (state.pegs.length === 0) return;
  for (const coin of state.coins) {
    if (coin.chute <= 0 || coin.pegFree) continue;
    // 先收集本帧全部接触点：币完全可能同时顶住两根杆。
    // 逐个修正时后一根杆的修正会精确抵消前一根 —— 币就悬死在杆缝里
    // （实测最长静止 1.8s，直到 DROP_MAX_AIR 超时才直落）。这就是
    // 「金币莫名悬停、又突然消失」的来源，必须按多接触点一起解。
    const hits = [];
    for (const peg of state.pegs) {
      const dx = coin.x - peg.x;
      const dy = coin.y - peg.y;
      const minD = peg.r + coin.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD) continue;
      let d = Math.sqrt(d2);
      let nx;
      let ny;
      if (d < 1e-6) {
        nx = 0;
        ny = -1;
        d = 0;
      } else {
        nx = dx / d;
        ny = dy / d;
      }
      // 近正心命中 = 不稳定平衡。真实机台上币会从任一侧滑开，
      // 这里按 (币 id + 杆序号) 确定性择向——否则币会永远悬在杆顶（弹道退化）。
      if (Math.abs(nx) < PEG_DEAD_ZONE) {
        const side = ((coin.id + peg.i) & 1) ? 1 : -1;
        nx = side * PEG_DEAD_ZONE;
        ny = -Math.sqrt(1 - nx * nx);
      }
      hits.push({ peg, nx, ny, d, minD });
    }
    if (hits.length === 0) continue;

    if (hits.length === 1) {
      const h = hits[0];
      coin.x = h.peg.x + h.nx * h.minD;
      coin.y = h.peg.y + h.ny * h.minD;
      const vn = coin.vx * h.nx + coin.vy * h.ny;
      if (vn < 0) {
        coin.vx -= (1 + PEG_BOUNCE) * vn * h.nx;
        coin.vy -= (1 + PEG_BOUNCE) * vn * h.ny;
      }
      continue;
    }

    // 多杆夹持：沿各接触法线的合力把币推出杆缝，并给一个确定性横向速度让它滑出来。
    // 真实机台的杆缝必然大于币径（否则币根本过不去），所以"卡住"本身就是病态几何，
    // 这里按确定性方向脱困，与"近正心命中"同一套择向原则。
    let sx = 0;
    let sy = 0;
    let idxSum = 0;
    let deepest = 0;
    for (const h of hits) {
      sx += h.nx;
      sy += h.ny;
      idxSum += h.peg.i;
      deepest = Math.max(deepest, h.minD - h.d);
    }
    let nx;
    let ny;
    const len = Math.hypot(sx, sy);
    if (len < 1e-6) {
      const side = ((coin.id + idxSum) & 1) ? 1 : -1;
      nx = side;
      ny = -0.35;
    } else {
      nx = sx / len;
      ny = sy / len;
    }
    coin.x += nx * (deepest + 1e-3);
    coin.y += ny * (deepest + 1e-3);
    const side = ((coin.id + idxSum) & 1) ? 1 : -1;
    coin.vx += side * PEG_SLIDE;
    // 顺手压一下下落速度：先横着滑出杆缝，再继续落
    coin.vy = Math.min(coin.vy, 0.8);
  }
}

// 通道侧壁：币在通道内不会飞出机箱（真实投币通道是一根竖管）。
function resolveChuteWalls(state) {
  const lo = COIN_R;
  const hi = FIELD_W - COIN_R;
  for (const coin of state.coins) {
    if (coin.chute <= 0) continue;
    if (coin.x < lo) {
      coin.x = lo;
      if (coin.vx < 0) coin.vx = -coin.vx * PEG_BOUNCE;
    } else if (coin.x > hi) {
      coin.x = hi;
      if (coin.vx > 0) coin.vx = -coin.vx * PEG_BOUNCE;
    }
  }
}

function collidePair(a, b) {
  if (a.chute > 0 || b.chute > 0 || a.air > 0 || b.air > 0) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minD = (a.r + b.r) * PACK_FACTOR;
  let d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD) return;
  let d = Math.sqrt(d2);
  let nx;
  let ny;
  if (d < 1e-6) {
    // 完全重合：按 id 的黄金角确定性拆开，绝不引入随机
    const ang = (a.id * 2.399963) % (Math.PI * 2);
    nx = Math.cos(ang);
    ny = Math.sin(ang);
    d = 0;
  } else {
    nx = dx / d;
    ny = dy / d;
  }
  const invA = 1 / a.mass;
  const invB = 1 / b.mass;
  const invSum = invA + invB;
  const overlap = minD - d;
  const corr = (overlap * SOLVER_RELAX) / invSum;
  a.x -= nx * corr * invA;
  a.y -= ny * corr * invA;
  b.x += nx * corr * invB;
  b.y += ny * corr * invB;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const j = (-(1 + RESTITUTION) * vn) / invSum;
    a.vx -= j * nx * invA;
    a.vy -= j * ny * invA;
    b.vx += j * nx * invB;
    b.vy += j * ny * invB;
  }
}

function resolveCoinCollisions(coins) {
  for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
    const grid = new Map();
    for (let i = 0; i < coins.length; i++) {
      const coin = coins[i];
      const key = (Math.floor(coin.x / CELL) + 64) * 512 + (Math.floor(coin.y / CELL) + 64);
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(i);
    }
    for (let i = 0; i < coins.length; i++) {
      const a = coins[i];
      const gx = Math.floor(a.x / CELL) + 64;
      const gy = Math.floor(a.y / CELL) + 64;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = grid.get((gx + ox) * 512 + (gy + oy));
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k++) {
            const j = bucket[k];
            if (j <= i) continue;
            collidePair(a, coins[j]);
          }
        }
      }
    }
  }
}

function clampToPusher(coins, plateFront, pusherVel) {
  const limit = plateFront + COIN_R;
  for (const coin of coins) {
    if (coin.chute > 0 || coin.air > 0) continue;
    const minY = plateFront + coin.r;
    if (coin.y < minY) {
      coin.y = minY;
      if (pusherVel > 0 && coin.vy < pusherVel) coin.vy = pusherVel;
      else if (coin.vy < 0) coin.vy = 0;
    } else if (coin.y < limit && coin.vy < 0) {
      coin.vy = 0;
    }
  }
}

function clampSpeed(coins) {
  for (const coin of coins) {
    const sp2 = coin.vx * coin.vx + coin.vy * coin.vy;
    if (sp2 > MAX_SPEED * MAX_SPEED) {
      const scale = MAX_SPEED / Math.sqrt(sp2);
      coin.vx *= scale;
      coin.vy *= scale;
    }
  }
}

function maxSpeedOf(coins) {
  let max = 0;
  for (const coin of coins) {
    const sp2 = coin.vx * coin.vx + coin.vy * coin.vy;
    if (sp2 > max) max = sp2;
  }
  return Math.sqrt(max);
}

// ---------------------------------------------------------------- 落袋 / 侧沟 / 计分

function dropCoin(state, coin, events) {
  const doubleActive = state.effects.double > 0;
  const base = coinValue(coin.kind, doubleActive);

  if (coin.kind === "tower") {
    // 金塔落袋 = 大奖：一笔分数 + 一笔账户回币。它是一枚"币"，本身也从台面消失，
    // 因此计入 cleared（而不是 drops——它不落进玩家托盘）。
    state.towerDown = true;
    state.score += TOWER_BONUS;
    state.credits = clamp(state.credits + TOWER_CREDITS, 0, MAX_CREDITS);
    state.cleared += 1;
    events.push({ type: "tower_down", bonus: TOWER_BONUS, credits: state.credits });
    return;
  }

  state.cascadeCount += 1;
  state.cascadeTimer = 0;
  state.idleTimer = 0;
  const mult = cascadeMult(state.cascadeCount);
  state.cascadeMult = mult;
  if (state.cascadeCount > state.bestCascade) state.bestCascade = state.cascadeCount;
  const firstJackpot = mult >= JACKPOT_MULT && state.maxMult < JACKPOT_MULT;
  if (mult > state.maxMult) state.maxMult = mult;
  const gained = base * mult;
  state.score += gained;
  state.drops += 1;
  // 账户制：掉进托盘的币回到玩家账户，可以继续投
  state.credits = clamp(state.credits + 1, 0, MAX_CREDITS);
  state.dropped += 1;

  events.push({
    type: "drop", kind: coin.kind, base, mult, gained, cascade: state.cascadeCount,
    x: coin.x, credits: state.credits
  });

  if (firstJackpot) events.push({ type: "jackpot", mult });
}

// 落袋阈值：普通金币球心越过边缘线即落；金塔是大圆盘，球心越过"半径一半"即已整体倾覆。
function dropThreshold(coin) {
  return coin.kind === "tower" ? FIELD_H - coin.r * 0.5 : FIELD_H;
}

function resolveDrops(state, events) {
  if (state.coins.length === 0) return false;
  const fallen = [];
  const rest = [];
  for (const coin of state.coins) {
    if (coin.chute > 0) rest.push(coin);
    else if (coin.y > dropThreshold(coin)) fallen.push(coin);
    else rest.push(coin);
  }
  if (fallen.length === 0) return false;
  state.coins = rest;
  for (const coin of fallen) dropCoin(state, coin, events);
  return true;
}

// 侧沟：球心出界的币掉进侧仓——不计分、不回账户。真实机台的主要"输"就发生在这里。
function resolveGutters(state, events) {
  if (state.coins.length === 0) return false;
  const lost = [];
  const rest = [];
  for (const coin of state.coins) {
    const onField = !(coin.chute > 0) && !(coin.air > 0);
    if (onField && (coin.x < 0 || coin.x > FIELD_W)) lost.push(coin);
    else rest.push(coin);
  }
  if (lost.length === 0) return false;
  state.coins = rest;
  state.lostCoins += lost.length;
  for (const coin of lost) {
    events.push({ type: "lost_coin", kind: coin.kind, x: coin.x < 0 ? 0 : FIELD_W, count: 1 });
  }
  return true;
}

// ---------------------------------------------------------------- 机关触发

function tokenOverlap(token, coin) {
  if (token.type === "card") {
    return Math.abs(coin.x - token.x) < token.w / 2 + CARD_PAD
      && Math.abs(coin.y - token.y) < token.h / 2 + CARD_PAD;
  }
  const dx = coin.x - token.x;
  const dy = coin.y - token.y;
  const reach = token.r + coin.r;
  return dx * dx + dy * dy < reach * reach;
}

function resolveTokens(state, events, dt) {
  for (const token of state.tokens) {
    if (token.cooldown > 0) token.cooldown = Math.max(0, token.cooldown - dt);
    if (token.pulse > 0) token.pulse = Math.max(0, token.pulse - dt);
  }
  for (const token of state.tokens) {
    if (token.type === "magnet" || token.type === "tower") continue;
    if (token.type === "card" && token.used) continue;
    if (token.type === "launcher" && token.cooldown > 0) continue;
    let hit = null;
    for (const coin of state.coins) {
      if (coin.kind === "tower" || coin.air > 0) continue;
      if (tokenOverlap(token, coin)) {
        hit = coin;
        break;
      }
    }
    if (!hit) continue;
    if (token.type === "launcher"
      && (hit.vy < LAUNCH_TRIGGER_VY || Math.hypot(hit.vx, hit.vy) < LAUNCH_TRIGGER_SPEED)) {
      continue;
    }
    token.pulse = 0.5;

    if (token.type === "card") {
      token.used = true;
      state.cardsCollected += 1;
      if (token.effect === "double") state.effects.double = EFFECT_TIME;
      else if (token.effect === "speed") state.effects.speed = EFFECT_TIME;
      else if (token.effect === "magnet") state.effects.magnet = EFFECT_TIME;
      events.push({ type: "card", effect: token.effect, x: token.x, y: token.y });
    } else if (token.type === "launcher") {
      token.cooldown = LAUNCH_COOLDOWN;
      const angle = (nextRandom(state) - 0.5) * 1.1;
      const side = nextRandom(state) - 0.5;
      hit.air = LAUNCH_AIR;
      hit.chute = 0;
      hit.vx = side * 2.4;
      // 向上抛（−y 是朝机头方向）：币先升后落，腾空时长 = 2v/g 的完整抛物线。
      // 曾经是 +y 直着往前推，且腾空期没有重力 —— 币像在冰面上平移，完全不合理。
      hit.vy = -Math.abs(Math.cos(angle)) * LAUNCH_SPEED;
      events.push({ type: "launch", x: token.x, y: token.y, coinX: hit.x, coinY: hit.y });
    }
  }
  state.tokens = state.tokens.filter((token) => !(token.type === "card" && token.used));
}

// ---------------------------------------------------------------- 收工判定

// 无尽机台：账户币数归零且台面静置 → 收工结算。
export function outOfCredits(state) {
  return state.credits <= 0;
}

// 收工事件的唯一口径（结算层只认这一份 payload）
function lostPayload(state) {
  return {
    type: "lost",
    score: state.score,
    dropped: state.dropped,
    inserted: state.inserted,
    lostCoins: state.lostCoins,
    bestCascade: state.bestCascade
  };
}

function evaluate(state, events) {
  if (state.status !== STATUS.PLAYING) return;
  // 通道里还有币在往下掉 = 机台还在工作，不算静置（否则刚投完就被判收工）
  if (state.coins.some((coin) => coin.chute > 0)) state.idleTimer = 0;
  if (state.idleTimer < SETTLE_TIME) return;
  // 收工两种情况：账户见底；或机台被塞满且彻底静置（插不进也推不动，只能收工）。
  const jammed = state.coins.length >= MAX_COINS;
  if (state.credits > 0 && !jammed) return;
  state.status = STATUS.LOST;
  events.push({ ...lostPayload(state), jammed });
}

// ---------------------------------------------------------------- 帧步进

export function stepFrame(state, dt = FIXED_DT, _inputs = {}) {
  if (state.status !== STATUS.PLAYING) {
    // 账户在开局前就被清空（正常 UI 走不到，但状态机必须自洽）：
    // 此时玩家既插不进币、也等不到结算，会永久卡死在 READY —— 直接收工，绝不制造死局。
    if (state.status === STATUS.READY && outOfCredits(state)) {
      const dead = cloneState(state);
      dead.status = STATUS.LOST;
      return { state: dead, events: [{ ...lostPayload(dead), jammed: false }] };
    }
    return { state, events: [] };
  }
  const s = cloneState(state);
  const events = [];

  s.time += dt;
  s.idleTimer += dt;

  // 0. 投币通道下落：越过推板前缘才落地（纯几何判定，绝不瞬移）。
  //    超时只做一件事——放弃挡杆阵直落，防止币被杆阵卡住时永久悬空。
  for (const coin of s.coins) {
    if (coin.chute > 0) {
      if (coin.y >= s.plateFront + coin.r) {
        coin.chute = 0;
        coin.chuteTimer = 0;
        coin.pegFree = false;
      } else {
        coin.chuteTimer += dt;
        if (coin.chuteTimer > DROP_MAX_AIR) coin.pegFree = true;
      }
    }
    if (coin.air > 0) coin.air = Math.max(0, coin.air - dt);
  }

  // 1. 增益计时
  for (const key of Object.keys(s.effects)) {
    if (s.effects[key] > 0) s.effects[key] = Math.max(0, s.effects[key] - dt);
  }

  // 2. 推板推进（梯形速度曲线；加速增益按倍率缩短周期）
  const scale = cycleScaleOf(s);
  const prevFront = s.plateFront;
  s.pusherPhase = (s.pusherPhase + (dt * scale) / PUSH_CYCLE) % 1;
  s.plateFront = plateFrontAt(s.pusherPhase, scale);
  s.pusherVel = (s.plateFront - prevFront) / dt;

  // 3. 受力
  applyFriction(s, dt);
  applyDropGravity(s, dt);
  applyEdgeTip(s, dt);
  applyGutter(s, dt);
  applyMagnet(s, dt);
  clampSpeed(s.coins);

  // 4. 自适应子步进积分（CCD：单步位移不超过 0.2 单位）
  const fastest = maxSpeedOf(s.coins);
  const substeps = clamp(Math.ceil((fastest * dt) / 0.2), 1, MAX_SUBSTEP);
  const h = dt / substeps;
  for (let sub = 0; sub < substeps; sub++) {
    for (const coin of s.coins) {
      coin.x += coin.vx * h;
      coin.y += coin.vy * h;
    }
    resolvePegs(s);
    resolveChuteWalls(s);
    clampToPusher(s.coins, s.plateFront, s.pusherVel);
    resolveCoinCollisions(s.coins);
  }
  clampToPusher(s.coins, s.plateFront, s.pusherVel);
  clampSpeed(s.coins);

  // 5. 落袋 / 侧沟结算
  resolveDrops(s, events);
  resolveGutters(s, events);

  // 6. 机关触发
  resolveTokens(s, events, dt);

  // 7. 连锁计时
  if (s.cascadeCount > 0) {
    s.cascadeTimer += dt;
    if (s.cascadeTimer > CASCADE_WINDOW) {
      if (s.cascadeCount >= 4) events.push({ type: "cascade_end", count: s.cascadeCount, mult: s.cascadeMult });
      s.cascadeCount = 0;
      s.cascadeMult = 1;
      s.cascadeTimer = 0;
    }
  } else {
    s.cascadeMult = 1;
  }

  // 8. 收工判定
  evaluate(s, events);

  return { state: s, events };
}

// ---------------------------------------------------------------- 重开

export function restartStage(state) {
  return createInitialState({ credits: state.startCredits, seed: state.seed });
}

export function startEndless(credits, seed) {
  return createInitialState({ credits, seed: seed ?? 20261008 });
}
