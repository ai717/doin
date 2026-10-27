// 《霓虹吃豆》规则引擎 —— 纯逻辑、严格 DOM-free。
//
// 设计契约（后续模块全部依赖，改动前请先读 tests/engine.test.mjs）：
// 1. 位置模型 = 「离散格 + 0..1 进度」：实体永远位于某个格 t=(tx,ty)，并以进度 p 走向相邻格 n=(nx,ny)。
//    p 到 1 时抵达 n 并在该格中心做一次「选向决策」。这样既不会浮点漂移，也让转向天然不减速。
// 2. 只有在格中心才允许改向 —— 这是 Pac-Man 手感与「转角预输入」的地基。
//    唯一的例外是「反向 180°」：任何位置立刻掉头（经典行为）。
// 3. 幽灵四态 = scatter / chase / frightened / eaten，另加两个过渡态 caging（巢中充能）、exiting（出巢途中）。
//    只有 scatter/chase 由全局节拍统一驱动；frightened 由能量豆进入并计时退出；eaten 由碰撞进入。
// 4. 幽灵选向 = 禁止 180° 反向 + 取「到 target 欧氏距离最小」的方向（frightened 除外，见 chooseDirGhost）。
// 5. stepFrame 内部按 MAX_STEP 切子步，保证任意 dt 下都不会穿过彼此。
//
// 所有随机性走 state.rng（mulberry32），同种子必然复现。

// ---------------------------------------------------------------- 方向

export const DIR = { UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3 };
export const DIR_VEC = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];
export const OPPOSITE = [1, 0, 3, 2];
// 幽灵等距时的经典优先级：上 → 左 → 下 → 右
export const GHOST_TIE_ORDER = [DIR.UP, DIR.LEFT, DIR.DOWN, DIR.RIGHT];

// ---------------------------------------------------------------- 常量

export const BASE_PLAYER_SPEED = 8.8; // 格 / 秒
export const BASE_GHOST_SPEED = 8.4; // 必须略慢于玩家，否则无法甩开
export const TUNNEL_MULT = 0.5;
export const FRIGHT_MULT = 0.5;
export const EATEN_MULT = 2.5;
export const SYRUP_MULT = 0.75;
export const ELROY1_SPEED = 9.2;
export const ELROY2_SPEED = 9.6;

/**
 * 正统街机机制：主角走在「豆已吃空」的走廊上会提到全速。
 * 原版 8.8 只是吃豆时的速度（全速 11 的 80%），没有这条补速，
 * 数值再正统也只会被读成「拖」——因为玩家大量时间其实跑在全速段。
 */
export const CORRIDOR_BOOST = 1.25;

/** 速度档：玩家与幽灵同乘一个倍率，8.8 : 8.4 的追逐张力不会被破坏 */
export const SPEED_TIERS = [
  { id: "calm", mult: 0.82 },
  { id: "standard", mult: 1 },
  { id: "surge", mult: 1.22 },
];
export const DEFAULT_SPEED_TIER = "standard";

/**
 * 预输入保鲜距离（格）。
 * 街机原版的 desired 是永久粘着的：走廊里随手按了一个当前不可行的方向，
 * 它会一路挂到几格之后某个毫不相干的路口才自作主张拐进去 —— 实测会飘 3~4 格。
 * 这里改成按「距离」计时的保鲜期：正常提前按键照旧入弯，误按最多带走 2 格就过期。
 * 用距离而不是秒，是为了三档速度下窗口宽度一致（不会因为调快就变短）。
 */
export const INPUT_TTL_TILES = 2;

/**
 * 迟到补偿：越过格心这个比例（格）以内按下，仍退回该格心执行转向。
 * 没有它，「按晚了」就等于这个路口永远抓不住：要么滑到下一个出口，要么一路撞墙停住。
 * 0.35 格 = 2.8 个逻辑像素回拉，比一整个路口的惩罚便宜太多。
 */
export const LATE_TURN_P = 0.35;

/**
 * 回拉的补间时长（秒）。逻辑上这一帧已经退回格心了，但直接跳会看到一次倒退；
 * 这里由 render 按剩余比例把那点位移摊掉，视觉上就变成「顺势拐了个大弯」。
 */
export const SNAP_EASE = 0.07;

export function speedTierMult(id) {
  const hit = SPEED_TIERS.find((t) => t.id === id);
  return hit ? hit.mult : 1;
}
export const ELROY1_DOTS = 20;
export const ELROY2_DOTS = 10;

export const CAGE_TIME = 2.0; // 被吃幽灵回巢后的充能秒数
export const SUPPRESS_STEP = 0.5; // 每 SUPPRESS_DOTS 颗豆的压制增量
export const SUPPRESS_MAX = 3.0; // 单只幽灵的压制总上限
export const SUPPRESS_DOTS = 10;
export const SUPPRESS_DOT_PENALTY = 2; // 尚未过 dot gate 的幽灵改以「豆数」压制
export const SUPPRESS_DOT_PENALTY_MAX = 12;

export const CHAIN_WINDOW = 1.2; // 豆链不断链的窗口（秒）
export const CHAIN_WINDOW_THREAT = 0.6; // 被逼近时窗口收紧，等效「增速减半」
export const THREAT_TILES = 4;
export const CHAIN_STEP = 10; // 每 10 颗升一级
export const CHAIN_MULTS = [1, 1.5, 2, 3];

export const BUMP_STUN = 0.15; // 逆撞单向风道的停顿
export const NO_DOT_RELEASE = 4.0; // 长时间不吃豆则强制放幽灵出巢（防软锁）
export const GATE_PERIOD = 6.0; // 潮汐闸门开合周期
export const GATE_WARN = 1.0;

export const FRUIT_LIFE = 9.0;
export const FRUIT_DOTS = [70, 170];

export const PELLET_SCORE = 10;
export const POWER_SCORE = 50;
export const SYRUP_PELLET_BONUS_MULT = 2;
export const GHOST_SCORE = [200, 400, 800, 1600];

export const MAX_STEP = 1 / 120; // 物理子步上限
export const FRIGHT_PAUSE_BUDGET = 4.0; // 连吃期间 fright 计时暂停的总预算
export const FRIGHT_FLASH = 2.0; // 最后 N 秒开始白闪预警

export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const EXTRA_LIFE_SCORE = 10000;

// Scatter / Chase 节拍表（秒）。最后一段 chase 无限长。
export const MODE_SCHEDULE = [
  { mode: "scatter", sec: 7 },
  { mode: "chase", sec: 20 },
  { mode: "scatter", sec: 7 },
  { mode: "chase", sec: 20 },
  { mode: "scatter", sec: 5 },
  { mode: "chase", sec: 20 },
  { mode: "scatter", sec: 5 },
  { mode: "chase", sec: Infinity },
];

export const GHOST_IDS = ["blinky", "pinky", "inky", "clyde"];

// ---------------------------------------------------------------- 单元格类型

export const CELL = {
  WALL: 0,
  FLOOR: 1,
  HOUSE: 2, // 幽灵巢内部地面，只有幽灵能走
  DOOR: 3, // 巢门，只有回巢 / 出巢的幽灵能通过
};

export const FEATURE = { NONE: 0, SYRUP: 1, ICE: 2, GATE: 3 };

const CHAR_CELL = {
  "#": { cell: CELL.WALL },
  " ": { cell: CELL.FLOOR },
  ".": { cell: CELL.FLOOR, pellet: 1 },
  o: { cell: CELL.FLOOR, pellet: 2 },
  H: { cell: CELL.HOUSE },
  "-": { cell: CELL.DOOR },
  // ★ 机关格同样带豆：否则「糖浆区双倍分」永远触发不了，冰面与闸门也成了白走的死路
  "~": { cell: CELL.FLOOR, feature: FEATURE.SYRUP, pellet: 1 },
  "*": { cell: CELL.FLOOR, feature: FEATURE.ICE, pellet: 1 },
  G: { cell: CELL.FLOOR, feature: FEATURE.GATE, pellet: 1 },
  ">": { cell: CELL.FLOOR, oneway: DIR.RIGHT, pellet: 1 },
  "<": { cell: CELL.FLOOR, oneway: DIR.LEFT, pellet: 1 },
  "^": { cell: CELL.FLOOR, oneway: DIR.UP, pellet: 1 },
  v: { cell: CELL.FLOOR, oneway: DIR.DOWN, pellet: 1 },
};

// ---------------------------------------------------------------- 小工具

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextRandom(state) {
  const rnd = mulberry32(state.rng);
  const value = rnd();
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  return value;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function entityPos(ent) {
  if (ent.nx === null) return { x: ent.tx + 0.5, y: ent.ty + 0.5 };
  return {
    x: ent.tx + 0.5 + (ent.nx - ent.tx) * ent.p,
    y: ent.ty + 0.5 + (ent.ny - ent.ty) * ent.p,
  };
}

// ---------------------------------------------------------------- 迷宫解析

/**
 * 把字符矩阵迷宫解析成适合逐帧查询的扁平数组。
 * 行宽必须一致；非法字符一律当作地板（保持健壮，不抛错）。
 */
export function parseMaze(maze) {
  const rows = maze.cells;
  const h = rows.length;
  const w = rows[0].length;
  const cell = new Uint8Array(w * h);
  const feature = new Uint8Array(w * h);
  const oneway = new Int8Array(w * h).fill(-1);
  const pellets = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    const line = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = line[x] ?? " ";
      const spec = CHAR_CELL[ch] ?? CHAR_CELL[" "];
      const i = y * w + x;
      cell[i] = spec.cell;
      feature[i] = spec.feature ?? FEATURE.NONE;
      oneway[i] = spec.oneway === undefined ? -1 : spec.oneway;
      pellets[i] = spec.pellet ?? 0;
    }
  }
  return {
    id: maze.id,
    sourceRows: rows.slice(), // 供 restartMaze 复原原始豆布局
    cols: w,
    rows: h,
    cell,
    feature,
    oneway,
    pellets: pellets.slice(),
    tunnelRows: maze.tunnelRows ?? [],
    playerStart: maze.playerStart,
    nests: maze.nests ?? [],
    fruitTile: maze.fruitTile,
    parTime: maze.parTime ?? 120,
  };
}

// ---------------------------------------------------------------- 格子查询

function inBounds(g, x, y) {
  return x >= 0 && x < g.cols && y >= 0 && y < g.rows;
}

/** 含隧道环绕的邻格查询；越界且非隧道行返回 null。 */
export function neighborTile(g, x, y, dir) {
  const d = DIR_VEC[dir];
  let nx = x + d.x;
  let ny = y + d.y;
  if (nx < 0) {
    if (!g.tunnelRows.includes(y)) return null;
    nx = g.cols - 1;
  } else if (nx >= g.cols) {
    if (!g.tunnelRows.includes(y)) return null;
    nx = 0;
  }
  if (ny < 0 || ny >= g.rows) return null;
  return { x: nx, y: ny };
}

export function isGateOpen(state) {
  return state.gatesOpen;
}

/** 静态 + 动态可通行判定。from/to 必须是已存在的合法格。 */
export function canPass(state, fromX, fromY, toX, toY, dir, isGhost, mode) {
  const g = state.grid;
  if (!inBounds(g, toX, toY)) return false;
  const i = toY * g.cols + toX;
  const c = g.cell[i];
  if (c === CELL.WALL) return false;
  if (c === CELL.HOUSE) return isGhost;
  if (c === CELL.DOOR) return isGhost && (mode === "eaten" || mode === "exiting");
  if (g.feature[i] === FEATURE.GATE && !state.gatesOpen) return false;

  const ow = g.oneway[i];
  if (ow >= 0 && ow !== dir) return false;
  const owFrom = g.oneway[fromY * g.cols + fromX];
  if (owFrom >= 0 && owFrom !== dir) return false;
  return true;
}

function canMoveTile(state, ent, dir, isGhost) {
  const nb = neighborTile(state.grid, ent.tx, ent.ty, dir);
  if (!nb) return false;
  return canPass(state, ent.tx, ent.ty, nb.x, nb.y, dir, isGhost, ent.mode);
}

function isIce(state, x, y) {
  return state.grid.feature[y * state.grid.cols + x] === FEATURE.ICE;
}

// ---------------------------------------------------------------- 实体选向

function chooseDirPlayer(state, ent) {
  const icy = isIce(state, ent.tx, ent.ty);
  // 冰面上先维持原方向：进入冰区后必须「认了」这条路线直到脱离
  if (!icy) {
    if (canMoveTile(state, ent, ent.desired, false)) return ent.desired;
    if (canMoveTile(state, ent, ent.dir, false)) return ent.dir;
    return null;
  }
  if (canMoveTile(state, ent, ent.dir, false)) return ent.dir;
  if (canMoveTile(state, ent, ent.desired, false)) return ent.desired;
  return null;
}

export function ghostTarget(state, gh) {
  const g = state.grid;
  const pt = state.player;
  if (gh.mode === "eaten") return { x: gh.home.x, y: gh.home.y };
  if (gh.mode === "exiting") return { x: gh.exitTile.x, y: gh.exitTile.y };
  if (gh.mode === "frightened") return null;
  if (gh.mode === "scatter") return gh.corner;

  const pv = DIR_VEC[pt.dir];
  switch (gh.id) {
    case "blinky":
      return { x: pt.tx, y: pt.ty };
    case "pinky":
      return { x: pt.tx + pv.x * 4, y: pt.ty + pv.y * 4 };
    case "inky": {
      const blinky = state.ghosts[0];
      const ix = pt.tx + pv.x * 2;
      const iy = pt.ty + pv.y * 2;
      return { x: ix + (ix - blinky.tx), y: iy + (iy - blinky.ty) };
    }
    case "clyde": {
      if (Math.sqrt(dist2(gh.tx, gh.ty, pt.tx, pt.ty)) > 8) return { x: pt.tx, y: pt.ty };
      return gh.corner;
    }
    default:
      return gh.corner;
  }
}

function chooseDirGhost(state, gh) {
  const opts = [];
  for (const d of GHOST_TIE_ORDER) {
    if (d === OPPOSITE[gh.dir]) continue;
    if (canMoveTile(state, gh, d, true)) opts.push(d);
  }
  if (opts.length === 0) {
    // 死胡同（或尚未成型的关卡）只能掉头；连反向都不通就原地停住，不硬撞墙
    return OPPOSITE[gh.dir];
  }
  if (opts.length === 1) return opts[0];

  const g = state.grid;
  const target = ghostTarget(state, gh);

  if (gh.mode === "frightened") {
    // 逃离：先剔除「最靠近玩家」的那一个方向（只要还剩候选），再按种子随机取。
    const pt = state.player;
    if (opts.length > 2) {
      let worst = opts[0];
      let worstD = Infinity;
      for (const d of opts) {
        const nb = neighborTile(g, gh.tx, gh.ty, d);
        const dd = dist2(nb.x, nb.y, pt.tx, pt.ty);
        if (dd < worstD) {
          worstD = dd;
          worst = d;
        }
      }
      const idx = opts.indexOf(worst);
      if (idx >= 0) opts.splice(idx, 1);
    }
    return opts[Math.floor(nextRandom(state) * opts.length) % opts.length];
  }

  let best = opts[0];
  let bestD = Infinity;
  for (const d of opts) {
    const nb = neighborTile(g, gh.tx, gh.ty, d);
    const dd = dist2(nb.x, nb.y, target.x, target.y);
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

function reverseEntity(ent) {
  if (ent.nx !== null) {
    const tx = ent.tx;
    const ty = ent.ty;
    ent.tx = ent.nx;
    ent.ty = ent.ny;
    ent.nx = tx;
    ent.ny = ty;
    ent.p = 1 - ent.p;
  }
  ent.dir = OPPOSITE[ent.dir];
  // ★ 掉头必须至少持续到抵达下一格：否则恰好停在格心的实体会在同一子步里
  //   重新选向，把这次掉头彻底抵消（节拍切换的经典「全体掉头」就看不出来了）。
  ent.justReversed = true;
}

// ---------------------------------------------------------------- 移动

/**
 * 推进一个实体。返回 true 表示本子步至少进了一格。
 * 抵达格中心时在 onArrive 里吃掉豆（只有玩家有）。
 */
function advanceEntity(state, ent, tiles, isGhost, onArrive) {
  let remaining = tiles;
  let guard = 0;
  while (remaining > 1e-9 && guard++ < 24) {
    if (ent.stun > 0) return false;

    if (ent.nx === null) {
      let d = isGhost ? chooseDirGhost(state, ent) : chooseDirPlayer(state, ent);
      // justReversed 只消费一次：撑过本次选向即可，之后恢复常规寻路
      const keepDir = ent.justReversed;
      ent.justReversed = false;
      if (keepDir && canMoveTile(state, ent, ent.dir, isGhost)) d = ent.dir;
      if (d === null) {
        ent.p = 0;
        return false;
      }
      ent.dir = d;
      const nb = neighborTile(state.grid, ent.tx, ent.ty, d);
      if (!nb) return false;
      if (!canPass(state, ent.tx, ent.ty, nb.x, nb.y, d, isGhost, ent.mode)) {
        if (!isGhost) ent.stun = BUMP_STUN; // 逆撞单向风道
        return false;
      }
      ent.nx = nb.x;
      ent.ny = nb.y;
      ent.p = 0;
      continue;
    }

    const np = ent.p + remaining;
    if (np < 1) {
      ent.p = np;
      remaining = 0;
      break;
    }
    ent.tx = ent.nx;
    ent.ty = ent.ny;
    ent.nx = null;
    ent.ny = null;
    ent.p = 0;
    remaining = np - 1;
    if (onArrive) onArrive(state, ent);
  }
  return true;
}

function entitySpeed(state, ent) {
  const g = state.grid;
  const i = ent.ty * g.cols + ent.tx;
  // ★ 整体倍率对玩家与幽灵一视同仁：只改「这次追赶跑多快」，不改「谁跑得过谁」
  let speed = ent.baseSpeed * (state.speedScale ?? 1);
  const inTunnel = g.tunnelRows.includes(ent.ty) && (ent.tx <= 1 || ent.tx >= g.cols - 2);
  if (inTunnel) speed *= TUNNEL_MULT;
  if (ent.mode === "frightened") speed *= FRIGHT_MULT;
  if (ent.mode === "eaten") speed *= EATEN_MULT;
  // 糖浆只拖慢玩家，幽灵照常 —— 这是「减速换双倍分」的风险面
  if (ent === state.player && g.feature[i] === FEATURE.SYRUP) speed *= SYRUP_MULT;
  if (ent === state.player && !g.pellets[i] && !inTunnel) speed *= CORRIDOR_BOOST;
  return speed;
}

// ---------------------------------------------------------------- 建 state

function makeGhost(id, def) {
  return {
    id,
    tx: def.start.x,
    ty: def.start.y,
    nx: null,
    ny: null,
    p: 0,
    dir: def.dir ?? DIR.LEFT,
    mode: def.mode ?? "caging",
    baseSpeed: def.baseSpeed,
    corner: def.corner,
    home: def.home,
    exitTile: def.exitTile,
    dotGate: def.dotGate ?? 0,
    gatePassed: false,
    releaseTimer: def.releaseTimer ?? 0,
    suppressSeconds: 0,
    suppressDots: 0,
    eatenOnce: false,
  };
}

/**
 * 建立一局游戏状态。
 * @param {object} options.maze   已 parseMaze 的迷宫
 * @param {string} options.modeId 'campaign' | 'arcade' | 'setpiece'
 */
export function createState(options) {
  const grid = options.maze;
  const level = options.level ?? 1;
  const basePlayerSpeed = Math.min(BASE_PLAYER_SPEED * (1 + 0.03 * (level - 1)), 11.5);
  const baseGhostSpeed = Math.min(BASE_GHOST_SPEED * (1 + 0.04 * (level - 1)), 11.2);

  let dotsTotal = 0;
  for (let i = 0; i < grid.pellets.length; i++) if (grid.pellets[i]) dotsTotal++;

  const corners = {
    blinky: { x: grid.cols - 1, y: -2 },
    pinky: { x: 0, y: -2 },
    inky: { x: grid.cols - 1, y: grid.rows + 1 },
    clyde: { x: 0, y: grid.rows + 1 },
  };

  const state = {
    modeId: options.modeId ?? "campaign",
    mazeId: grid.id,
    level,
    grid,
    status: "playing",
    score: 0,
    lives: START_LIVES,
    deaths: 0,
    dotsTotal,
    dotsRemaining: dotsTotal,
    dotsEaten: 0,
    elapsed: 0,
    rng: options.seed ?? 0x9e3779b9,

    playerSpeedBase: basePlayerSpeed,
    ghostSpeedBase: baseGhostSpeed,
    speedScale: options.speedScale ?? 1,
    speedTier: options.speedTier ?? DEFAULT_SPEED_TIER,

    player: {
      tx: grid.playerStart.x,
      ty: grid.playerStart.y,
      nx: null,
      ny: null,
      p: 0,
      dir: grid.playerStart.dir ?? DIR.LEFT,
      desired: grid.playerStart.dir ?? DIR.LEFT,
      desiredTtl: 0,
      snapTiles: 0,
      snapDir: 0,
      snapTimer: 0,
      mode: "chase",
      stun: 0,
      baseSpeed: basePlayerSpeed,
      lastCornerAt: -1,
    },

    ghosts: [],
    globalMode: "scatter",
    modeIndex: 0,
    modeTimer: MODE_SCHEDULE[0].sec,
    frightMax: options.frightSeconds ?? frightForLevel(level),
    frightTimer: 0,
    frightPauseBudget: FRIGHT_PAUSE_BUDGET,
    ghostCombo: 0,

    gatesOpen: false,
    gateTimer: 0,
    gateWarning: false,

    chainCount: 0,
    chainTimer: 0,
    chainLevel: 0,
    chainBest: 0,

    suppressMilestone: 0,
    noDotTimer: 0,
    extraLifeIndex: 0,

    fruit: null,
    fruitIndex: 0,

    fruitsEaten: 0,
    tileSteps: 0,

    setpiece: options.setpiece ?? null,
    steps: 0,
    events: [],
    elroy: 0,
  };

  // 幽灵出生：主巢在第二只以后的按 dot gate 排队，双巢迷宫会把 inky/clyde 分到第二个巢
  const nests = grid.nests;
  GHOST_IDS.forEach((id, idx) => {
    const nestIndex = Math.min(idx < 2 ? 0 : 1, nests.length - 1);
    const nest = nests[nestIndex];
    const local = idx < 2 ? idx : idx - 2;
    const slot = nest.slots[local % nest.slots.length];
    const dotGate = idx === 0 ? 0 : idx === 1 ? 0 : idx === 2 ? 30 : 60;
    const gh = makeGhost(id, {
      start: slot,
      home: slot,
      exitTile: nest.exitTile,
      corner: corners[id],
      baseSpeed: baseGhostSpeed,
      dotGate,
      releaseTimer: dotGate === 0 ? 0 : CAGE_TIME,
      mode: dotGate === 0 ? "exiting" : "caging",
      dir: DIR.LEFT,
    });
    gh.gatePassed = dotGate === 0;
    state.ghosts.push(gh);
  });

  if (options.setpiece) applySetpiece(state, options.setpiece);
  return state;
}

export function frightForLevel(level) {
  if (level <= 1) return 6;
  if (level < 4) return 5;
  if (level < 7) return 4;
  if (level < 10) return 3;
  if (level < 15) return 2;
  if (level < 19) return 1;
  return 0;
}

function applySetpiece(state, sp) {
  // 残局：精确给定剩余豆、幽灵位置与状态、目标与限值
  const g = state.grid;
  const seen = new Set(sp.keep);
  for (let y = 0; y < g.rows; y++) {
    for (let x = 0; x < g.cols; x++) {
      const i = y * g.cols + x;
      if (!g.pellets[i]) continue;
      if (!seen.has(i)) {
        g.pellets[i] = 0;
        state.dotsTotal--;
        state.dotsRemaining--;
      }
    }
  }
  state.player.tx = sp.player.x;
  state.player.ty = sp.player.y;
  state.player.dir = sp.player.dir ?? DIR.LEFT;
  state.player.desired = state.player.dir;
  state.player.desiredTtl = 0;
  state.player.snapTimer = 0;
  state.player.snapTiles = 0;
  if (sp.ghosts) {
    sp.ghosts.forEach((cfg, idx) => {
      const gh = state.ghosts[idx];
      if (!gh) return;
      gh.tx = cfg.x;
      gh.ty = cfg.y;
      gh.dir = cfg.dir ?? DIR.LEFT;
      gh.mode = cfg.mode ?? "chase";
      gh.gatePassed = true;
      gh.dotGate = 0;
    });
  }
  state.lives = sp.lives ?? 1;
  // 与 checkSetpiece 同口径：限时残局看 limitTime，限步残局看 limitSteps
  state.setpieceLeft = sp.limitTime ?? sp.limitSteps ?? 0;
}

// ---------------------------------------------------------------- 节拍 / 计时

function setGlobalMode(state, mode) {
  state.globalMode = mode;
  for (const gh of state.ghosts) {
    if (gh.mode === "scatter" || gh.mode === "chase") {
      gh.mode = mode;
      reverseEntity(gh);
    }
  }
  state.events.push({ type: "modeSwitch", mode });
}

function updateSchedule(state, dt) {
  if (state.modeTimer === Infinity) return;
  state.modeTimer -= dt;
  if (state.modeTimer > 0) return;
  state.modeIndex = Math.min(state.modeIndex + 1, MODE_SCHEDULE.length - 1);
  const step = MODE_SCHEDULE[state.modeIndex];
  state.modeTimer = step.sec;
  setGlobalMode(state, step.mode);
}

function updateGates(state, dt) {
  state.gateTimer += dt;
  const phase = state.gateTimer % GATE_PERIOD;
  const open = phase < GATE_PERIOD / 2;
  if (open !== state.gatesOpen) {
    state.gatesOpen = open;
    state.events.push({ type: "gateToggle", open });
  }
  state.gateWarning = !open && phase > GATE_PERIOD / 2 - GATE_WARN;
}

function updateElroy(state) {
  const remaining = state.dotsRemaining;
  const before = state.elroy;
  state.elroy = remaining <= ELROY2_DOTS ? 2 : remaining <= ELROY1_DOTS ? 1 : 0;
  const blinky = state.ghosts[0];
  blinky.baseSpeed =
    state.elroy === 2 ? ELROY2_SPEED : state.elroy === 1 ? ELROY1_SPEED : state.ghostSpeedBase;
  if (state.elroy === 2 && before !== 2) blinky.mode = state.globalMode;
}

// ---------------------------------------------------------------- 吃豆 / 计分

function chainLevelFor(count) {
  return clamp(Math.floor(count / CHAIN_STEP), 0, CHAIN_MULTS.length - 1);
}

function addScore(state, delta) {
  state.score += delta;
  if (state.score >= EXTRA_LIFE_SCORE * (state.extraLifeIndex + 1) && state.lives < MAX_LIVES) {
    state.lives++;
    state.extraLifeIndex++;
    state.events.push({ type: "extraLife" });
  }
}

function nearestThreatTiles(state) {
  const pt = state.player;
  const ppos = entityPos(pt);
  let best = Infinity;
  for (const gh of state.ghosts) {
    if (gh.mode === "eaten" || gh.mode === "caging") continue;
    if (gh.mode === "frightened") continue;
    const gp = entityPos(gh);
    best = Math.min(best, Math.sqrt(dist2(ppos.x, ppos.y, gp.x, gp.y)));
  }
  return best;
}

function onPlayerArrive(state, ent) {
  state.tileSteps++;
  const g = state.grid;
  const i = ent.ty * g.cols + ent.tx;
  const pellet = g.pellets[i];
  if (!pellet) return;
  g.pellets[i] = 0;
  state.dotsRemaining--;
  state.dotsEaten++;
  state.noDotTimer = 0;

  const mult = CHAIN_MULTS[state.chainLevel];
  const syrup = g.feature[i] === FEATURE.SYRUP;
  const base = pellet === 2 ? POWER_SCORE : PELLET_SCORE;
  const gain = Math.round(base * mult * (syrup ? SYRUP_PELLET_BONUS_MULT : 1));
  addScore(state, gain);

  state.chainCount++;
  state.chainLevel = chainLevelFor(state.chainCount);
  state.chainBest = Math.max(state.chainBest, state.chainLevel);
  state.chainTimer = nearestThreatTiles(state) < THREAT_TILES ? CHAIN_WINDOW_THREAT : CHAIN_WINDOW;
  state.events.push({ type: "pellet", x: ent.tx, y: ent.ty, power: pellet === 2, gain, mult });

  if (pellet === 2) triggerFright(state);

  const milestone = Math.floor(state.dotsEaten / SUPPRESS_DOTS);
  if (milestone > state.suppressMilestone) {
    applyDenSuppression(state);
    state.suppressMilestone = milestone;
  }

  if (state.fruitIndex < FRUIT_DOTS.length && state.dotsEaten >= FRUIT_DOTS[state.fruitIndex]) {
    spawnFruit(state);
  }
}

function spawnFruit(state) {
  const tile = state.grid.fruitTile;
  if (!tile) return;
  state.fruit = { x: tile.x, y: tile.y, timer: FRUIT_LIFE };
  state.fruitIndex++;
  state.events.push({ type: "fruitSpawn" });
}

function applyDenSuppression(state) {
  for (const gh of state.ghosts) {
    if (gh.mode !== "caging") continue;
    if (!gh.gatePassed) {
      gh.suppressDots = Math.min(SUPPRESS_DOT_PENALTY_MAX, gh.suppressDots + SUPPRESS_DOT_PENALTY);
    } else if (gh.suppressSeconds < SUPPRESS_MAX) {
      gh.suppressSeconds = Math.min(SUPPRESS_MAX, gh.suppressSeconds + SUPPRESS_STEP);
    }
  }
  state.events.push({ type: "suppress" });
}

function triggerFright(state) {
  if (state.frightMax <= 0) {
    state.events.push({ type: "frightFizzle" });
    return;
  }
  state.frightTimer = state.frightMax;
  state.frightPauseBudget = FRIGHT_PAUSE_BUDGET;
  state.ghostCombo = 0;
  for (const gh of state.ghosts) {
    if (gh.mode === "scatter" || gh.mode === "chase") {
      gh.mode = "frightened";
      reverseEntity(gh);
    }
  }
  state.events.push({ type: "powerUp" });
}

// ---------------------------------------------------------------- 幽灵更新

function updateGhosts(state, dt) {
  const anyEaten = state.ghosts.some((gh) => gh.mode === "eaten");

  if (state.frightTimer > 0) {
    if (anyEaten && state.frightPauseBudget > 0) {
      // 连吃期间 fright 计时暂停，但有总预算，防拖时间刷分
      const pause = Math.min(dt, state.frightPauseBudget);
      state.frightPauseBudget -= pause;
    } else {
      state.frightTimer -= dt;
      if (state.frightTimer <= 0) {
        state.frightTimer = 0;
        for (const gh of state.ghosts) {
          if (gh.mode === "frightened") gh.mode = state.elroy === 2 ? "chase" : state.globalMode;
        }
        state.events.push({ type: "frightEnd" });
      }
    }
  }

  for (const gh of state.ghosts) {
    if (gh.mode === "caging") {
      if (!gh.gatePassed) {
        const need = gh.dotGate + gh.suppressDots;
        if (state.dotsEaten >= need || state.noDotTimer > NO_DOT_RELEASE) releaseGhost(state, gh);
      } else {
        gh.releaseTimer -= dt;
        if (gh.releaseTimer <= 0) {
          gh.releaseTimer = 0;
          releaseGhost(state, gh);
        }
      }
      continue;
    }

    const tiles = entitySpeed(state, gh) * dt;
    advanceEntity(state, gh, tiles, true, null);

    if (gh.mode === "eaten") {
      if (gh.tx === gh.home.x && gh.ty === gh.home.y && gh.nx === null) {
        gh.mode = "caging";
        gh.releaseTimer = CAGE_TIME;
        gh.suppressSeconds = 0;
        gh.dir = DIR.LEFT;
        state.events.push({ type: "ghostRecaged", id: gh.id });
      }
    } else if (gh.mode === "exiting") {
      if (gh.tx === gh.exitTile.x && gh.ty === gh.exitTile.y && gh.nx === null) {
        gh.mode = state.elroy === 2 ? "chase" : state.globalMode;
      }
    }
  }
}

function releaseGhost(state, gh) {
  gh.mode = "exiting";
  gh.gatePassed = true;
  gh.releaseTimer = CAGE_TIME + gh.suppressSeconds;
  gh.suppressSeconds = 0;
  state.events.push({ type: "ghostRelease", id: gh.id });
}

// ---------------------------------------------------------------- 碰撞

function checkCollisions(state) {
  const ppos = entityPos(state.player);
  for (const gh of state.ghosts) {
    if (gh.mode === "caging") continue;
    const gpos = entityPos(gh);
    const swap =
      state.player.nx !== null &&
      gh.nx !== null &&
      state.player.tx === gh.nx &&
      state.player.ty === gh.ny &&
      gh.tx === state.player.nx &&
      gh.ty === state.player.ny;
    const hit = dist2(ppos.x, ppos.y, gpos.x, gpos.y) < 0.25 || swap;
    if (!hit) continue;

    if (gh.mode === "frightened") {
      gh.mode = "eaten";
      gh.eatenOnce = true;
      state.ghostCombo = Math.min(state.ghostCombo + 1, GHOST_SCORE.length);
      const gain = GHOST_SCORE[state.ghostCombo - 1];
      addScore(state, gain);
      state.events.push({ type: "eatGhost", id: gh.id, gain, combo: state.ghostCombo });
    } else if (gh.mode === "eaten" || gh.mode === "exiting") {
      // 眼睛不具杀伤，穿过即可
    } else {
      killPlayer(state);
      return;
    }
  }
}

function killPlayer(state) {
  state.lives--;
  state.deaths++;
  state.events.push({ type: "death", lives: state.lives });
  if (state.lives <= 0) {
    state.status = "lost";
    state.events.push({ type: "gameOver" });
    return;
  }
  respawnEntities(state);
}

/** 掉一条命：全盘复位但已吃的豆保留。 */
function respawnEntities(state) {
  resetEntities(state);
}

function resetEntities(state) {
  const grid = state.grid;
  const p = state.player;
  p.tx = grid.playerStart.x;
  p.ty = grid.playerStart.y;
  p.nx = null;
  p.ny = null;
  p.p = 0;
  p.dir = grid.playerStart.dir ?? DIR.LEFT;
  p.desired = p.dir;
  p.desiredTtl = 0;
  p.snapTimer = 0;
  p.snapTiles = 0;
  p.stun = 0;

  state.modeIndex = 0;
  state.modeTimer = MODE_SCHEDULE[0].sec;
  state.globalMode = "scatter";
  state.frightTimer = 0;
  state.ghostCombo = 0;
  state.chainCount = 0;
  state.chainTimer = 0;
  state.chainLevel = 0;

  state.ghosts.forEach((gh, idx) => {
    const slot = gh.home;
    gh.tx = slot.x;
    gh.ty = slot.y;
    gh.nx = null;
    gh.ny = null;
    gh.p = 0;
    gh.dir = DIR.LEFT;
    gh.suppressSeconds = 0;
    if (gh.gatePassed) {
      gh.mode = "exiting";
      gh.releaseTimer = CAGE_TIME;
    } else {
      gh.mode = "caging";
      gh.releaseTimer = CAGE_TIME;
    }
    void idx;
  });
}

// ---------------------------------------------------------------- 主循环

/**
 * 固定步长推进。state 原地更新并返回本帧事件数组（调用方负责清空后读取）。
 * 非 playing 状态一律 no-op —— 终局操作静默忽略，绝不 alert。
 */
export function stepFrame(state, dt) {
  state.events = [];
  if (state.status !== "playing") return state.events;
  const clamped = clamp(dt, 0, 0.25);
  let left = clamped;
  while (left > 1e-9) {
    const step = Math.min(MAX_STEP, left);
    subStep(state, step);
    left -= step;
    if (state.status !== "playing") break;
  }
  return state.events;
}

function subStep(state, dt) {
  state.elapsed += dt;
  state.noDotTimer += dt;
  state.steps++;

  updateSchedule(state, dt);
  updateGates(state, dt);
  updateElroy(state);

  if (state.player.stun > 0) state.player.stun -= dt;
  tickInputWindow(state, dt);
  tickSnapEase(state, dt);

  // 豆链窗口
  if (state.chainTimer > 0) {
    state.chainTimer -= dt;
    if (state.chainTimer <= 0) {
      state.chainTimer = 0;
      state.chainCount = 0;
      state.chainLevel = 0;
      state.events.push({ type: "chainBreak" });
    }
  }

  const pSpeed = entitySpeed(state, state.player);
  advanceEntity(state, state.player, pSpeed * dt, false, onPlayerArrive);
  updateGhosts(state, dt);
  checkCollisions(state);
  if (state.status !== "playing") return;

  updateFruit(state, dt);

  if (state.setpiece) {
    checkSetpiece(state, dt);
  } else if (state.dotsRemaining <= 0) {
    state.status = "levelclear";
    state.events.push({ type: "levelClear" });
  }
}

function updateFruit(state, dt) {
  if (!state.fruit) return;
  state.fruit.timer -= dt;
  if (state.fruit.timer <= 0) {
    state.fruit = null;
    state.events.push({ type: "fruitExpire" });
    return;
  }
  const p = state.player;
  if (p.tx === state.fruit.x && p.ty === state.fruit.y) {
    const gain = state.setpiece?.fruitScore ?? FRUIT_SCORE[Math.min(state.level - 1, FRUIT_SCORE.length - 1)];
    addScore(state, gain);
    state.fruit = null;
    state.events.push({ type: "fruitEat", gain });
  }
}

export const FRUIT_SCORE = [100, 300, 500, 700, 1000, 2000, 3000, 5000];

function checkSetpiece(state, dt) {
  const sp = state.setpiece;
  if (sp.limitTime !== undefined) {
    state.setpieceLeft = Math.max(0, sp.limitTime - state.elapsed);
    if (state.setpieceLeft <= 0) {
      state.status = "lost";
      state.events.push({ type: "setpieceFail", reason: "time" });
      return;
    }
  }
  if (sp.limitSteps !== undefined) {
    state.setpieceLeft = Math.max(0, sp.limitSteps - state.tileSteps);
    if (state.setpieceLeft <= 0) {
      state.status = "lost";
      state.events.push({ type: "setpieceFail", reason: "steps" });
      return;
    }
  }

  let done = false;
  if (sp.goal === "clear") {
    done = sp.clearRegion.every((idx) => state.grid.pellets[idx] === 0);
  } else if (sp.goal === "escape") {
    done = state.player.tx === sp.exit.x && state.player.ty === sp.exit.y && state.player.nx === null;
  } else if (sp.goal === "chain") {
    done = state.ghosts.every((gh) => gh.eatenOnce === true);
  }
  if (done) {
    state.status = "setpieceClear";
    state.events.push({ type: "setpieceClear" });
  }
  void dt;
}

// ---------------------------------------------------------------- 玩家输入

/**
 * 设置期望方向。
 * 反向允许任意时刻立即掉头（经典手感，正统规则里这是唯一不受格心约束的操作）。
 * 前向/侧向走「保鲜 + 迟到补偿」双窗口，让每个路口的有效按键区间从 (−∞, 0]
 * 变成 [−2 格, +0.3 格]：抓得住，也不会飘走。
 */
export function setDesired(state, dir) {
  if (state.status !== "playing") return false;
  const p = state.player;
  if (typeof dir !== "number" || !(dir >= 0 && dir <= 3)) return false;
  p.desired = dir;
  // 保鲜期按「距离」折算成秒，三档速度下窗口宽度一致
  const speed = Math.max(entitySpeed(state, p), 1e-6);
  p.desiredTtl = INPUT_TTL_TILES / speed;

  if (dir === OPPOSITE[p.dir] && p.nx !== null) {
    reverseEntity(p);
    p.dir = dir;
    p.desired = dir;
    return true;
  }

  if (tryLateTurn(state, p, dir)) return true;
  return true;
}

/**
 * 迟到补偿：刚越过某个格心就按下，退回去在那个格心拐。
 * 只补「侧向」，不碰掉头（掉头本来就随时可以），也不在冰面上补（冰面规则就是必须认路）。
 */
function tryLateTurn(state, p, dir) {
  if (p.nx === null || dir === p.dir || dir === OPPOSITE[p.dir]) return false;
  if (p.p <= 0 || p.p > LATE_TURN_P) return false;
  if (isIce(state, p.tx, p.ty)) return false;

  const nb = neighborTile(state.grid, p.tx, p.ty, dir);
  if (!nb) return false;
  if (!canPass(state, p.tx, p.ty, nb.x, nb.y, dir, false, p.mode)) return false;

  // 退回刚离开的那个格心重开侧向；已滑出去的 p 格交给 render 补间吃掉
  const rolledBack = p.p;
  const cameFrom = p.dir;
  p.nx = nb.x;
  p.ny = nb.y;
  p.p = 0;
  p.dir = dir;
  p.desired = dir;
  p.desiredTtl = 0;
  p.snapTiles = rolledBack;
  p.snapDir = cameFrom;
  p.snapTimer = SNAP_EASE;
  return true;
}

/** 补间倒计时。逻辑位移早已到位，这一份只是给 render 用来抹平视觉跳变的残量。 */
function tickSnapEase(state, dt) {
  const p = state.player;
  if (p.snapTimer <= 0) return;
  p.snapTimer -= dt;
  if (p.snapTimer > 0) return;
  p.snapTimer = 0;
  p.snapTiles = 0;
}

/** 预输入倒计时。过期就落回当前方向，避免一次误按在几格之后自作主张。 */
function tickInputWindow(state, dt) {
  const p = state.player;
  if (p.desiredTtl <= 0) return;
  p.desiredTtl -= dt;
  if (p.desiredTtl > 0) return;
  p.desiredTtl = 0;
  if (p.desired !== p.dir) p.desired = p.dir;
}

/**
 * 迟到转向后 render 该把主角往回摆多少格（0 表示已摆到位）。
 * 返回值是「沿 snapDir 的偏移」，随时间衰减到 0。
 */
export function snapOffset(p) {
  if (!p || p.snapTimer <= 0 || p.snapTiles <= 0) return 0;
  return p.snapTiles * (p.snapTimer / SNAP_EASE);
}

/**
 * 切换速度档。允许对局中热切换（与语言切换同一条铁律：绝不重置局面），
 * 所以这里只改倍率，不碰 elapsed / lives / 盘面。
 */
export function applySpeedTier(state, tier) {
  const mult = speedTierMult(tier);
  const known = SPEED_TIERS.some((t) => t.id === tier);
  state.speedTier = known ? tier : DEFAULT_SPEED_TIER;
  state.speedScale = mult;
  return state.speedScale;
}

/** 本迷宫从头重开（豆全恢复），用于命数耗尽后的重来。 */
export function restartMaze(state) {
  const fresh = parseMaze({
    id: state.grid.id,
    cells: state.grid.sourceRows,
    tunnelRows: state.grid.tunnelRows,
    playerStart: state.grid.playerStart,
    nests: state.grid.nests,
    fruitTile: state.grid.fruitTile,
    parTime: state.grid.parTime,
  });
  state.grid = fresh;
  state.dotsRemaining = state.dotsTotal;
  state.dotsEaten = 0;
  state.deaths = 0;
  state.lives = START_LIVES;
  state.elapsed = 0;
  state.score = 0;
  state.chainCount = 0;
  state.chainTimer = 0;
  state.chainLevel = 0;
  state.chainBest = 0;
  state.fruit = null;
  state.fruitIndex = 0;
  state.suppressMilestone = 0;
  state.noDotTimer = 0;
  state.steps = 0;
  state.status = "playing";
  state.elroy = 0;
  state.ghosts.forEach((gh) => {
    gh.gatePassed = gh.dotGate === 0;
    gh.suppressSeconds = 0;
    gh.suppressDots = 0;
    gh.eatenOnce = false;
  });
  resetEntities(state);
  return state;
}

/** 幽灵当前是否处于可被吃状态（渲染 / 音频层要用）。 */
export function isGhostEdible(gh) {
  return gh.mode === "frightened";
}

/** fright 剩余秒数，供 UI 画倒计时。 */
export function frightRemaining(state) {
  return state.frightTimer;
}

/** 当前节拍剩余秒数。Infinity 表示最后一段无限 chase。 */
export function modeRemaining(state) {
  return state.modeTimer;
}

export function chainMultiplier(state) {
  return CHAIN_MULTS[state.chainLevel];
}

/** 三星判定：① 清盘 ② 限时 ③ 零死亡。 */
export function evaluateStars(state) {
  return {
    clear: state.status === "levelclear" || state.status === "setpieceClear",
    time: state.elapsed <= state.grid.parTime,
    noDeath: state.deaths === 0,
  };
}

export function starCount(state) {
  const s = evaluateStars(state);
  return (s.clear ? 1 : 0) + (s.time ? 1 : 0) + (s.noDeath ? 1 : 0);
}
