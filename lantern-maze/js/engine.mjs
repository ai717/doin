// engine.mjs —— 《灯笼巷》规则唯一权威：网格巷弄、四影魅人格 AI、更漏节拍、日曜反杀。
// 纯数据 + 固定步长 stepFrame，供 node:test 直接驱动。

import {
  SCORE_MAX,
  dotScore,
  pearlScore,
  ghostScore,
  fruitScore,
  clearBonus,
  EXTRA_LIFE_AT,
} from "./score.mjs";

// ---------------------------------------------------------------- 常量

export const DIR_NAMES = ["up", "left", "down", "right"];
export const DIRS = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
];
export const NONE = -1;

export const WALL = "#";
export const DOT = ".";
export const PEARL = "*";
export const PATH = "-";
export const HOUSE = "H";
export const DOOR = "D";
export const SPAWN = "P";
export const FRUIT = "F";
export const NOUP = "u";

/** 编辑器笔刷 → 瓦片字符 */
export const BRUSH_TILE = {
  wall: WALL,
  path: PATH,
  dot: DOT,
  pearl: PEARL,
  house: HOUSE,
  door: DOOR,
  spawn: SPAWN,
  fruit: FRUIT,
  noup: NOUP,
};
export const TILE_BRUSH = Object.fromEntries(
  Object.entries(BRUSH_TILE).map(([brush, tile]) => [tile, brush])
);
export const BRUSHES = Object.keys(BRUSH_TILE);

const WALK = new Set([DOT, PEARL, PATH, SPAWN, FRUIT, NOUP]);
const GHOST_WALK = new Set([DOT, PEARL, PATH, SPAWN, FRUIT, NOUP]);
const EYE_WALK = new Set([DOT, PEARL, PATH, SPAWN, FRUIT, NOUP, HOUSE, DOOR]);

export const GHOST_BEH = ["chaser", "ambush", "flanker", "dither", "dart", "patrol", "silent"];
export const SCATTER_KEYS = ["tr", "tl", "br", "bl"];

const STEP_MS = 1000 / 120;
const EPS = 1e-6;

export const SPEED = {
  player: 7.6, // 瓦片 / 秒
  ghostMul: 0.94,
  frightMul: 0.55,
  tunnelMul: 0.5,
  eyeMul: 1.9,
  houseMul: 0.7,
  dashMul: 1.75,
  dartMul: 1.9,
  dartTiles: 3,
  dartWindMs: 800,
  dartEveryMs: 6000,
};

export const WICK = {
  start: 26,
  max: 100,
  dot: 1,
  pearl: 8,
  decay: 0.9, // 每秒
  dashCost: 12,
  hitCost: 34,
  stunMs: 420,
};

export const DASH = { cost: 12, activeMs: 400, coolMs: 6000, radius: 2.6 };

/** 碰撞判定：半格内算撞上 */
export const HIT_R2 = 0.25;

// ---------------------------------------------------------------- 工具

/** 可注入的确定性 PRNG：随机性全部走这里，测试可复现 */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dirIndex(name) {
  if (typeof name === "number") return name >= 0 && name < 4 ? name : NONE;
  const i = DIR_NAMES.indexOf(name);
  return i < 0 ? NONE : i;
}

export function reverseDir(d) {
  if (d === NONE) return NONE;
  return d ^ 2; // up/left/down/right → 0^2=2, 1^2=3, 2^2=0, 3^2=1
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function charAt(layout, x, y) {
  if (y < 0 || y >= layout.height) return WALL;
  const row = layout.rows[y];
  if (x < 0 || x >= layout.width) return WALL;
  return row[x];
}

export function isWalkableTile(ch, kind = "player") {
  if (kind === "eye") return EYE_WALK.has(ch);
  if (kind === "ghost") return GHOST_WALK.has(ch);
  return WALK.has(ch);
}

// ---------------------------------------------------------------- 巷弄解析

/** 把 ASCII 行解析成结构化巷弄：影匣、暗巷、出生点、光尘分布 */
export function parseLayout(rowsIn) {
  const rows = (rowsIn ?? []).map((r) => String(r));
  const height = rows.length;
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (!width || !height) return null;
  const pad = " ".repeat(width);
  const grid = rows.map((r) => (r + pad).slice(0, width).split(""));

  let spawn = null;
  let dots = 0;
  let pearls = 0;
  const pearlTiles = [];
  const fruitTiles = [];
  const noUp = new Set();
  const wrapRows = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ch = grid[y][x];
      if (ch === " ") grid[y][x] = WALL;
      const t = grid[y][x];
      if (t === DOT) dots += 1;
      else if (t === PEARL) {
        pearls += 1;
        pearlTiles.push({ x, y });
      } else if (t === SPAWN) spawn = { x, y };
      else if (t === FRUIT) fruitTiles.push({ x, y });
      else if (t === NOUP) noUp.add(y * width + x);
    }
    if (isWalkableTile(grid[y][0]) && isWalkableTile(grid[y][width - 1])) wrapRows.push(y);
  }

  // 影匣：连通的 H 块 + 其上方的 D 门
  const seen = new Set();
  const houses = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[y][x] !== HOUSE || seen.has(y * width + x)) continue;
      const cells = [];
      const stack = [{ x, y }];
      seen.add(y * width + x);
      while (stack.length) {
        const c = stack.pop();
        cells.push(c);
        for (const d of DIRS) {
          const nx = c.x + d.x;
          const ny = c.y + d.y;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          const k = ny * width + nx;
          if (seen.has(k) || grid[ny][nx] !== HOUSE) continue;
          seen.add(k);
          stack.push({ x: nx, y: ny });
        }
      }
      cells.sort((a, b) => a.y - b.y || a.x - b.x);
      const minX = Math.min(...cells.map((c) => c.x));
      const maxX = Math.max(...cells.map((c) => c.x));
      const minY = Math.min(...cells.map((c) => c.y));
      let door = null;
      for (let dx = minX; dx <= maxX; dx += 1) {
        const ch = charAt({ rows: grid, width, height }, dx, minY - 1);
        if (ch === DOOR) {
          if (!door || Math.abs(dx - (minX + maxX) / 2) < Math.abs(door.x - (minX + maxX) / 2)) {
            door = { x: dx, y: minY - 1 };
          }
        }
      }
      if (!door) continue;
      grid[door.y][door.x] = DOOR;
      let exit = { x: door.x, y: door.y - 1 };
      if (!isWalkableTile(charAt({ rows: grid, width, height }, exit.x, exit.y))) exit = { ...door };
      houses.push({ door, exit, cells, slots: cells.slice() });
    }
  }

  const layout = { width, height, rows: grid, spawn, dots, pearls, pearlTiles, fruitTiles, noUp, wrapRows, houses };
  layout.corners = cornerSpawns(layout);
  layout.eyeFields = houses.map((h) => buildField(layout, [h.exit], "eye"));
  return layout;
}

/** 四个角落附近的可走格：供额外影魅直接在巷中现身 */
function cornerSpawns(layout) {
  const pts = [
    { x: 1, y: 1 },
    { x: layout.width - 2, y: 1 },
    { x: 1, y: layout.height - 2 },
    { x: layout.width - 2, y: layout.height - 2 },
  ];
  const field = buildField(layout, pts.filter((p) => isWalkableTile(charAt(layout, p.x, p.y))), "player");
  const out = [];
  for (const start of pts) {
    let best = null;
    let bestD = Infinity;
    for (let y = 0; y < layout.height; y += 1) {
      for (let x = 0; x < layout.width; x += 1) {
        const d = field[y * layout.width + x];
        if (d >= 0 && d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    out.push(best ?? { ...start });
  }
  return out; // [tl, tr, bl, br]
}

/** 广度优先距离场（静态图，创建时算一次，供残瞳归巢与影子玩家复用） */
export function buildField(layout, starts, kind = "player") {
  const { width, height } = layout;
  const size = width * height;
  const field = new Int32Array(size).fill(-1);
  const queue = [];
  for (const s of starts ?? []) {
    if (!s) continue;
    const k = s.y * width + s.x;
    if (field[k] === -1) {
      field[k] = 0;
      queue.push(k);
    }
  }
  const wrapSet = new Set(layout.wrapRows ?? []);
  let head = 0;
  while (head < queue.length) {
    const k = queue[head++];
    const x = k % width;
    const y = (k - x) / width;
    for (const d of DIRS) {
      let nx = x + d.x;
      const ny = y + d.y;
      if (nx < 0 && wrapSet.has(y)) nx = width - 1;
      else if (nx >= width && wrapSet.has(y)) nx = 0;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nk = ny * width + nx;
      if (field[nk] !== -1) continue;
      if (!isWalkableTile(charAt(layout, nx, ny), kind)) continue;
      field[nk] = field[k] + 1;
      queue.push(nk);
    }
  }
  return field;
}

// ---------------------------------------------------------------- 状态工厂

export const DEFAULT_CFG = {
  roster: [
    { name: "赤影", beh: "chaser", color: "red", scatter: "tr", house: 0 },
    { name: "桃影", beh: "ambush", color: "pink", scatter: "tl", house: 0 },
    { name: "青影", beh: "flanker", color: "cyan", scatter: "br", house: 0 },
    { name: "橘影", beh: "dither", color: "orange", scatter: "bl", house: 0 },
  ],
  phases: [
    [7000, "chase"],
    [20000, "scatter"],
    [7000, "chase"],
    [20000, "scatter"],
    [5000, "chase"],
    [20000, "scatter"],
    [5000, "chase"],
  ],
  frightMs: 6000,
  frightFlashMs: 1500,
  release: [0, 4000, 12000, 20000],
  fruitAt: [70, 170],
  fruitMs: 8000,
  fruitValue: 500,
  parMs: 80000,
  fog: 0,
  startLives: 3,
  timed: 0,
  respawnDots: false,
  roundMs: 0,
  maxGhosts: 8,
  elroy: [0.2, 0.08],
  elroyMul: [1.05, 1.1],
  dotSlow: 0.955,
  trainCap: 4,
  watch: 1,
  level: 1,
  ghostSpeedMul: 1,
  playerSpeedMul: 1,
  pearlCount: 0, // 0 = 不限制；>0 时把这张图的日曜珠裁到该数量（五更稀有化）
};

function normalizeCfg(cfg) {
  const out = { ...DEFAULT_CFG, ...(cfg ?? {}) };
  out.phases = (out.phases ?? DEFAULT_CFG.phases).map((p) => [Number(p[0]) || 0, p[1] === "scatter" ? "scatter" : "chase"]);
  out.roster = (out.roster ?? DEFAULT_CFG.roster).map((r, i) => ({
    name: r.name ?? `影${i + 1}`,
    beh: GHOST_BEH.includes(r.beh) ? r.beh : "chaser",
    color: r.color ?? "red",
    scatter: SCATTER_KEYS.includes(r.scatter) ? r.scatter : "tr",
    house: Math.max(0, Number(r.house) || 0),
  }));
  out.release = (out.release ?? DEFAULT_CFG.release).map((n) => Math.max(0, Number(n) || 0));
  return out;
}

function scatterPoint(layout, key) {
  const { width, height } = layout;
  const wanted = {
    tr: { x: width - 2, y: 1 },
    tl: { x: 1, y: 1 },
    br: { x: width - 2, y: height - 2 },
    bl: { x: 1, y: height - 2 },
  }[key];
  if (isWalkableTile(charAt(layout, wanted.x, wanted.y))) return wanted;
  const field = buildField(layout, layout.spawn ? [layout.spawn] : [], "player");
  let best = null;
  let bestD = Infinity;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isWalkableTile(charAt(layout, x, y))) continue;
      const d = dist2(x, y, wanted.x, wanted.y) + (field[y * width + x] < 0 ? 1e6 : 0);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best ?? wanted;
}

function makeMover(x, y, dirIdx) {
  return { x, y, dirIdx, wantIdx: NONE, prog: 0, speed: 0, stunMs: 0 };
}

/** 建一局：cfg 决定更次规则，seed 决定确定性随机 */
export function createState({ rows, cfg, seed = 1, mode = "campaign" }) {
  const layout = typeof rows === "string" ? parseLayout(rows.split("\n")) : parseLayout(rows);
  if (!layout || !layout.spawn || !layout.houses.length) return null;
  const conf = normalizeCfg(cfg);
  const rng = mulberry32(seed);
  const L = layout;
  const width = L.width;

  const dotGrid = new Uint8Array(width * L.height);
  let dotLeft = 0;
  const pearlGrid = new Uint8Array(width * L.height);
  let pearlLeft = 0;
  for (let y = 0; y < L.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ch = L.rows[y][x];
      const k = y * width + x;
      if (ch === DOT) {
        dotGrid[k] = 1;
        dotLeft += 1;
      } else if (ch === PEARL) {
        pearlGrid[k] = 2;
        pearlLeft += 1;
      }
    }
  }
  // 日曜珠稀有化：图上多给了就按行主序降级成空巷，保证 cfg 是唯一的数量口径
  const pearlCap = Number(conf.pearlCount) > 0 ? Math.floor(conf.pearlCount) : 0;
  if (pearlCap > 0 && pearlLeft > pearlCap) {
    for (const t of L.pearlTiles) {
      if (pearlLeft <= pearlCap) break;
      const k = t.y * width + t.x;
      if (!pearlGrid[k]) continue;
      pearlGrid[k] = 0;
      L.rows[t.y][t.x] = PATH;
      pearlLeft -= 1;
    }
  }

  const player = makeMover(L.spawn.x, L.spawn.y, 1);
  player.kind = "player";
  player.speed = SPEED.player * conf.playerSpeedMul;

  const ghosts = conf.roster.map((r, i) => {
    const houseIdx = Math.min(r.house, L.houses.length - 1);
    const house = L.houses[houseIdx];
    const slot = house.slots[i % house.slots.length] ?? house.exit;
    const g = makeMover(slot.x, slot.y, NONE);
    Object.assign(g, {
      kind: "ghost",
      id: i,
      name: r.name,
      beh: r.beh,
      color: r.color,
      scatterKey: r.scatter,
      scatter: scatterPoint(L, r.scatter),
      houseIdx,
      slot,
      st: i < conf.release.length ? "house" : "normal",
      releaseAt: conf.release[i] ?? 0,
      bob: rng() * Math.PI * 2,
      eaten: 0,
      dartMs: rng() * SPEED.dartEveryMs,
      dartWindMs: 0,
      dartLeft: 0,
      patrolIdx: i % 4,
      silent: r.beh === "silent",
    });
    if (g.st === "normal") {
      const corner = L.corners[i % L.corners.length];
      g.x = corner.x;
      g.y = corner.y;
      g.dirIdx = 1;
    }
    return g;
  });

  return {
    layout: L,
    cfg: conf,
    mode,
    seed,
    rng,
    player,
    ghosts,
    dotGrid,
    pearlGrid,
    dotLeft,
    dotTotal: dotLeft,
    pearlLeft,
    clock: 0,
    readyMs: 2600,
    status: "ready",
    statusMs: 0,
    lives: conf.startLives,
    score: 0,
    eatenTotal: 0,
    extraLifeGiven: false,
    wick: WICK.start,
    dashMs: 0,
    dashCoolMs: 0,
    phaseIdx: 0,
    phaseMs: conf.phases[0]?.[0] ?? 7000,
    phaseKind: conf.phases[0]?.[1] ?? "chase",
    frightMs: 0,
    frightChain: 0,
    trainBonus: 1,
    fruit: null,
    fruitIdx: 0,
    timeLeftMs: conf.timed || 0,
    round: 1,
    deaths: 0,
    stats: { longestTrain: 0, bestChain: 0, ghostsEaten: 0, pearlsEaten: 0, fruits: 0 },
    events: [],
  };
}

function emit(state, type, payload) {
  state.events.push(payload ? { type, ...payload } : { type });
  if (state.events.length > 96) state.events.splice(0, state.events.length - 96);
}

export function drainEvents(state) {
  const out = state.events;
  state.events = [];
  return out;
}

// ---------------------------------------------------------------- 巷弄通行

function wrapX(layout, y, x) {
  if (x < 0) return layout.wrapRows.includes(y) ? layout.width - 1 : null;
  if (x >= layout.width) return layout.wrapRows.includes(y) ? 0 : null;
  return x;
}

function ahead(state, ent, dirIdx) {
  if (dirIdx === NONE) return null;
  const L = state.layout;
  const d = DIRS[dirIdx];
  const nx = wrapX(L, ent.y, ent.x + d.x);
  const ny = ent.y + d.y;
  if (nx === null || nx === undefined || ny < 0 || ny >= L.height) return null;
  const ch = charAt(L, nx, ny);
  const kind = ent.kind === "player" ? "player" : ent.st === "eyes" ? "eye" : ent.st === "house" || ent.st === "exiting" ? "eye" : "ghost";
  if (!isWalkableTile(ch, kind)) return null;
  return { x: nx, y: ny, ch };
}

function atWrapRow(state, ent) {
  return state.layout.wrapRows.includes(ent.y);
}

// ---------------------------------------------------------------- 影魅大脑

function playerVector(state, ahead3) {
  const p = state.player;
  const d = p.dirIdx === NONE ? DIRS[3] : DIRS[p.dirIdx];
  return { x: p.x + d.x * ahead3, y: p.y + d.y * ahead3 };
}

function ghostTarget(state, g) {
  const p = state.player;
  if (g.beh === "patrol") {
    return state.layout.corners[g.patrolIdx % 4] ?? g.scatter;
  }
  if (state.phaseKind === "scatter" && g.beh !== "patrol") return g.scatter;
  const dd = Math.sqrt(dist2(g.x, g.y, p.x, p.y));
  switch (g.beh) {
    case "ambush":
    case "silent": {
      const v = playerVector(state, 4);
      return v;
    }
    case "flanker": {
      const leader = state.ghosts.find((o) => o.beh === "chaser" && o !== g) ?? state.ghosts[0];
      const v = playerVector(state, 2);
      return { x: v.x * 2 - leader.x, y: v.y * 2 - leader.y };
    }
    case "dither":
      return dd > 8 ? { x: p.x, y: p.y } : g.scatter;
    case "chaser":
    case "dart":
    default:
      return { x: p.x, y: p.y };
  }
}

function ghostSpeedMul(state, g) {
  let mul = SPEED.ghostMul * state.cfg.ghostSpeedMul;
  if (g.st === "fright") mul = SPEED.frightMul;
  else if (g.st === "eyes") mul = SPEED.eyeMul;
  else if (g.st === "house" || g.st === "exiting") mul = SPEED.houseMul;
  else {
    if (atWrapRow(state, g)) mul *= SPEED.tunnelMul;
    const ratio = state.dotTotal ? state.dotLeft / state.dotTotal : 1;
    if (g.beh === "chaser") {
      const [t1, t2] = state.cfg.elroy;
      if (ratio <= t2) mul *= state.cfg.elroyMul[1] ?? 1.1;
      else if (ratio <= t1) mul *= state.cfg.elroyMul[0] ?? 1.05;
    }
    if (g.st === "normal" && g.dartLeft > 0) mul *= SPEED.dartMul;
  }
  return mul;
}

/** 影魅在瓦片中心的选路：不许回头（除被迫）、受匣口禁上转约束、按目标格欧氏距离取最优 */
function chooseGhostDir(state, g) {
  if (g.st === "house" || g.st === "exiting") return ghostHouseDir(state, g);
  if (g.st === "eyes") return ghostEyeDir(state, g);

  const opts = [];
  for (let d = 0; d < 4; d += 1) {
    if (!ahead(state, { ...g, st: g.st === "fright" ? "normal" : g.st }, d)) continue;
    if (g.st !== "fright" && state.layout.noUp.has(g.y * state.layout.width + g.x) && d === 0) continue;
    opts.push(d);
  }
  if (!opts.length) return NONE;
  const back = reverseDir(g.dirIdx);
  let pool = opts.filter((d) => d !== back);
  if (!pool.length) pool = opts;

  if (g.st === "fright") {
    return pool[Math.floor(state.rng() * pool.length) % pool.length];
  }
  const target = ghostTarget(state, g);
  let best = pool[0];
  let bestD = Infinity;
  for (const d of pool) {
    const n = { x: g.x + DIRS[d].x, y: g.y + DIRS[d].y };
    const dd = dist2(n.x, n.y, target.x, target.y);
    if (dd < bestD - EPS) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

function ghostEyeDir(state, g) {
  const house = state.layout.houses[g.houseIdx];
  const L = state.layout;
  const field = state.layout.eyeFields[g.houseIdx];
  if (!field) return NONE;
  const homeK = house.exit.y * L.width + house.exit.x;
  if (field[g.y * L.width + g.x] === 0) {
    // 已到家门口：钻进匣内转成正常
    const inDir = DIRS.findIndex((d) => charAt(L, g.x + d.x, g.y + d.y) === HOUSE || charAt(L, g.x + d.x, g.y + d.y) === DOOR);
    if (inDir >= 0 && ahead(state, g, inDir)) return inDir;
    g.st = "normal";
    g.dirIdx = state.rng() < 0.5 ? 1 : 3;
    return g.dirIdx;
  }
  let best = NONE;
  let bestD = field[g.y * L.width + g.x];
  for (let d = 0; d < 4; d += 1) {
    const n = ahead(state, g, d);
    if (!n) continue;
    const nd = field[n.y * L.width + n.x];
    if (nd >= 0 && nd < bestD) {
      bestD = nd;
      best = d;
    }
  }
  if (best === NONE) {
    for (let d = 0; d < 4; d += 1) {
      const n = ahead(state, g, d);
      if (!n) continue;
      const nd = field[n.y * L.width + n.x];
      if (nd >= 0 && (bestD < 0 || nd < bestD)) {
        bestD = nd;
        best = d;
      }
    }
  }
  void homeK;
  return best === NONE ? g.dirIdx : best;
}

function ghostHouseDir(state, g) {
  const house = state.layout.houses[g.houseIdx];
  const L = state.layout;
  const atDoorCol = g.x === house.door.x;
  if (g.st === "house") {
    if (g.y !== g.slot.y) {
      const ty = g.slot.y;
      return ty < g.y ? 0 : 2;
    }
    if (!atDoorCol) return g.slot.x < house.door.x ? 3 : 1;
    return NONE;
  }
  // exiting：先横移到门列，再向上穿过门与出口
  if (!atDoorCol) {
    const d = g.slot.x <= house.door.x && g.x < house.door.x ? 3 : g.x > house.door.x ? 1 : g.x < house.door.x ? 3 : 1;
    if (ahead(state, g, d)) return d;
    return ahead(state, g, 3) ? 3 : ahead(state, g, 1) ? 1 : NONE;
  }
  if (g.y > house.exit.y) {
    if (ahead(state, g, 0)) return 0;
    return ahead(state, g, 3) ? 3 : ahead(state, g, 1) ? 1 : NONE;
  }
  g.st = "normal";
  g.dirIdx = state.rng() < 0.5 ? 1 : 3;
  void L;
  return g.dirIdx;
}

// ---------------------------------------------------------------- 移动积分

function advanceMover(state, ent, distTiles, chooseDir, onArrive) {
  let remain = distTiles;
  let guard = 0;
  while (remain > EPS && guard < 10) {
    guard += 1;
    if (ent.dirIdx === NONE) {
      const d0 = chooseDir(state, ent);
      if (d0 === NONE) {
        ent.prog = 0;
        return;
      }
      ent.dirIdx = d0;
    }
    const step = ahead(state, ent, ent.dirIdx);
    if (!step) {
      const d1 = chooseDir(state, ent);
      ent.dirIdx = d1;
      if (d1 === NONE || !ahead(state, ent, d1)) {
        ent.prog = 0;
        return;
      }
    }
    const toCenter = 1 - ent.prog;
    if (remain < toCenter) {
      ent.prog += remain;
      return;
    }
    remain -= toCenter;
    const n = ahead(state, ent, ent.dirIdx);
    ent.x = n.x;
    ent.y = n.y;
    ent.prog = 0;
    if (onArrive) onArrive(state, ent);
    const nd = chooseDir(state, ent);
    if (nd === NONE) {
      ent.dirIdx = NONE;
      return;
    }
    ent.dirIdx = nd;
  }
}

// ---------------------------------------------------------------- 帧步进

export function stepFrame(state, dtMs) {
  let left = Math.max(0, Math.min(250, Number(dtMs) || 0));
  while (left > 0) {
    const use = Math.min(STEP_MS, left);
    left -= use;
    stepOnce(state, use);
  }
  return state;
}

function stepOnce(state, dt) {
  const dtSec = dt / 1000;
  if (!state || typeof state !== "object") return state;
  if (state.status === "paused" || state.status === "lost" || state.status === "won" || state.status === "cleared") return state;

  if (state.status === "ready") {
    state.readyMs -= dt;
    if (state.readyMs <= 0) {
      state.status = "running";
      emit(state, "go");
    }
    return state;
  }

  if (state.status === "dying") {
    state.statusMs -= dt;
    if (state.statusMs <= 0) respawn(state);
    return state;
  }

  state.clock += dt;
  if (state.cfg.timed) {
    state.timeLeftMs -= dt;
    if (state.timeLeftMs <= 0) {
      state.timeLeftMs = 0;
      failNight(state, "time");
      return state;
    }
  }
  if (state.cfg.respawnDots && state.dotLeft + state.pearlLeft === 0) refillAlley(state);
  if (state.cfg.roundMs) tickRounds(state);

  tickWick(state, dtSec);
  tickDash(state, dt);
  tickScheduler(state, dt);
  tickFright(state, dt);
  tickFruit(state, dt);
  tickRelease(state);

  movePlayer(state, dtSec);
  for (const g of state.ghosts) moveGhost(state, g, dtSec);
  collide(state);
  return state;
}

function tickWick(state, dtSec) {
  state.wick = Math.max(0, Math.min(WICK.max, state.wick - WICK.decay * dtSec));
}

function tickDash(state, dt) {
  if (state.dashMs > 0) state.dashMs = Math.max(0, state.dashMs - dt);
  if (state.dashCoolMs > 0) state.dashCoolMs = Math.max(0, state.dashCoolMs - dt);
}

function tickScheduler(state, dt) {
  if (state.frightMs > 0) return; // 惊吓态冻结更漏（经典行为）
  const ph = state.cfg.phases;
  if (!ph.length) return;
  state.phaseMs -= dt;
  if (state.phaseMs > 0) return;
  const last = ph.length - 1;
  const lastChase = ph[last][1] === "chase";
  state.phaseIdx = (state.phaseIdx + 1) % ph.length;
  // 尾档是追猎时：一轮回落后常驻长追，不再巡游（原作尾段）
  if (state.phaseIdx === 0 && lastChase && last > 0) state.phaseIdx = last;
  const [ms, kind] = ph[state.phaseIdx];
  state.phaseKind = kind;
  state.phaseMs = state.phaseIdx === last && lastChase ? 24 * 3600 * 1000 : ms;
  for (const g of state.ghosts) {
    if (g.st !== "normal") continue;
    if (g.dirIdx !== NONE) g.dirIdx = reverseDir(g.dirIdx);
    if (g.beh === "patrol") g.patrolIdx = (g.patrolIdx + 1) % 4;
  }
  emit(state, "phase", { kind, idx: state.phaseIdx });
}

function startFright(state) {
  const ms = frightMs(state);
  state.frightMs = ms;
  state.frightChain = 0;
  state.trainBonus = Math.max(1, Math.min(state.cfg.trainCap, state.trainBonus));
  for (const g of state.ghosts) {
    if (g.st !== "normal") continue;
    g.st = "fright";
    if (g.dirIdx !== NONE) g.dirIdx = reverseDir(g.dirIdx);
  }
  emit(state, "fright", { ms });
}

function frightMs(state) {
  const base = state.cfg.frightMs;
  if (!state.cfg.roundMs) return base;
  return Math.max(900, base - (state.round - 1) * 500);
}

function tickFright(state, dt) {
  if (state.frightMs <= 0) return;
  const was = state.frightMs;
  state.frightMs = Math.max(0, state.frightMs - dt);
  if (was > state.cfg.frightFlashMs && state.frightMs <= state.cfg.frightFlashMs) emit(state, "frightWarn");
  if (state.frightMs === 0) {
    for (const g of state.ghosts) {
      if (g.st !== "fright") continue;
      g.st = "normal";
      if (g.dirIdx !== NONE) g.dirIdx = reverseDir(g.dirIdx);
    }
    state.frightChain = 0;
    state.trainBonus = 1;
    emit(state, "frightEnd");
  }
}

function tickRelease(state) {
  for (const g of state.ghosts) {
    if (g.st !== "house") continue;
    if (state.clock < g.releaseAt) continue;
    g.st = "exiting";
    g.dirIdx = NONE;
    emit(state, "release", { id: g.id, name: g.name });
  }
}

function fruitSlots(state) {
  return state.layout.fruitTiles.length ? state.layout.fruitTiles : [state.player];
}

function tickFruit(state, dt) {
  const at = state.cfg.fruitAt;
  if (state.fruit) {
    state.fruit.ms -= dt;
    if (state.fruit.ms <= 0) {
      state.fruit = null;
      emit(state, "fruitOut");
    }
  }
  while (state.fruitIdx < at.length && state.eatenTotal >= at[state.fruitIdx]) {
    state.fruitIdx += 1;
    const slots = fruitSlots(state);
    const s = slots[(state.fruitIdx - 1) % slots.length];
    state.fruit = { x: s.x, y: s.y, ms: state.cfg.fruitMs, value: state.cfg.fruitValue };
    emit(state, "fruitIn", { x: s.x, y: s.y });
  }
  if (!at.length && state.fruit && state.fruit.ms <= 0) state.fruit = null;
}

function addScore(state, amount, reason) {
  const gain = Math.max(0, Math.round(amount));
  const before = state.score;
  state.score = Math.min(SCORE_MAX, before + gain);
  if (!state.extraLifeGiven && state.score >= EXTRA_LIFE_AT) {
    state.extraLifeGiven = true;
    if (state.lives < 5) {
      state.lives += 1;
      emit(state, "extraLife");
    }
  }
  emit(state, "score", { gain, total: state.score, reason });
}

function movePlayer(state, dtSec) {
  const p = state.player;
  if (p.stunMs > 0) {
    p.stunMs = Math.max(0, p.stunMs - dtSec * 1000);
    return;
  }
  let mul = 1;
  if (state.dashMs > 0) mul = SPEED.dashMul;
  const nearDot = isWalkableTile(charAt(state.layout, p.x, p.y)) && p.prog > 0.2 && p.prog < 0.85;
  if (nearDot && state.wick >= 0) mul *= state.cfg.dotSlow;
  p.speed = SPEED.player * state.cfg.playerSpeedMul * mul;
  advanceMover(state, p, p.speed * dtSec, choosePlayerDir, (s, ent) => consumeTile(s, ent));
}

function choosePlayerDir(state, ent) {
  const want = ent.wantIdx;
  if (want !== NONE && ahead(state, ent, want)) return want;
  if (ent.dirIdx !== NONE && ahead(state, ent, ent.dirIdx)) return ent.dirIdx;
  return NONE;
}

function consumeTile(state, ent) {
  const L = state.layout;
  const k = ent.y * L.width + ent.x;
  const val = state.dotGrid[k] + state.pearlGrid[k] * 2;
  if (val === 1) {
    state.dotGrid[k] = 0;
    state.dotLeft -= 1;
    state.eatenTotal += 1;
    state.wick = Math.min(WICK.max, state.wick + WICK.dot);
    addScore(state, dotScore(state.cfg), "dot");
    emit(state, "dot", { x: ent.x, y: ent.y, left: state.dotLeft });
    checkClear(state);
  } else if (val > 1) {
    state.pearlGrid[k] = 0;
    state.dotGrid[k] = 0;
    state.pearlLeft -= 1;
    state.dotLeft = Math.max(0, state.dotLeft);
    state.eatenTotal += 1;
    state.stats.pearlsEaten += 1;
    state.wick = Math.min(WICK.max, state.wick + WICK.pearl);
    state.trainBonus = trailSize(state);
    state.stats.longestTrain = Math.max(state.stats.longestTrain, state.trainBonus);
    addScore(state, pearlScore(state.cfg), "pearl");
    emit(state, "pearl", { x: ent.x, y: ent.y, left: state.pearlLeft });
    startFright(state);
    checkClear(state);
  }
  if (state.fruit && state.fruit.x === ent.x && state.fruit.y === ent.y) {
    const v = fruitScore(state.cfg, state.stats.fruits);
    state.fruit = null;
    state.stats.fruits += 1;
    state.wick = Math.min(WICK.max, state.wick + 6);
    addScore(state, v, "fruit");
    emit(state, "fruit", { value: v });
  }
}

/** 影列：面向后方、离你很近的影魅数量 —— 决定一珠吞多鬼的倍率 */
function trailSize(state) {
  const p = state.player;
  const d = p.dirIdx === NONE ? DIRS[3] : DIRS[p.dirIdx];
  let n = 0;
  for (const g of state.ghosts) {
    if (g.st !== "normal") continue;
    const vx = g.x - p.x;
    const vy = g.y - p.y;
    const dd = Math.sqrt(vx * vx + vy * vy);
    if (dd > 5) continue;
    if (vx * d.x + vy * d.y <= 0.6) n += 1;
  }
  return Math.max(1, Math.min(state.cfg.trainCap, n || 1));
}

function moveGhost(state, g, dtSec) {
  if (g.st === "house") {
    g.bob += dtSec * 4;
  }
  if (g.stunMs > 0) {
    g.stunMs = Math.max(0, g.stunMs - dtSec * 1000);
    return;
  }
  tickDart(state, g, dtSec);
  g.speed = SPEED.player * ghostSpeedMul(state, g);
  if (g.dartLeft > 0) {
    const step = g.speed * dtSec;
    const n = ahead(state, g, g.dirIdx);
    if (n) {
      g.dartLeft -= step;
      advanceMover(state, g, step, () => g.dirIdx);
    } else {
      g.dartLeft = 0;
    }
    return;
  }
  advanceMover(state, g, g.speed * dtSec, chooseGhostDir, (s, ent) => {
    if (ent.st === "eyes") {
      const house = s.layout.houses[ent.houseIdx];
      if (ent.x === house.exit.x && ent.y === house.exit.y) {
        ent.st = "exiting";
        ent.dirIdx = NONE;
        ent.slot = house.slots[ent.id % house.slots.length] ?? house.exit;
      }
    }
  });
}

function tickDart(state, g, dtSec) {
  if (g.beh !== "dart") return;
  if (g.dartLeft > 0) return;
  g.dartMs += dtSec * 1000;
  if (g.dartWindMs > 0) {
    g.dartWindMs -= dtSec * 1000;
    if (g.dartWindMs <= 0) {
      g.dartWindMs = 0;
      g.dirIdx = facingPlayer(state, g);
      g.dartLeft = SPEED.dartTiles;
    }
    return;
  }
  if (g.dartMs >= SPEED.dartEveryMs && g.st === "normal") {
    g.dartMs = 0;
    g.dartWindMs = SPEED.dartWindMs;
    emit(state, "dartWind", { id: g.id, name: g.name });
  }
}

function facingPlayer(state, g) {
  const p = state.player;
  const cand = [
    { d: g.x < p.x ? 3 : g.x > p.x ? 1 : NONE },
    { d: g.y < p.y ? 2 : g.y > p.y ? 0 : NONE },
  ];
  for (const c of cand) if (c.d !== NONE && ahead(state, g, c.d)) return c.d;
  return g.dirIdx === NONE ? 3 : g.dirIdx;
}

function collide(state) {
  if (state.status !== "running") return;
  const pp = entPos(state, state.player);
  for (const g of state.ghosts) {
    if (g.st === "house" || g.st === "eyes" || g.st === "exiting") continue;
    const gp = entPos(state, g);
    if (dist2(gp.x, gp.y, pp.x, pp.y) > HIT_R2) continue;
    if (g.st === "fright") eatGhost(state, g);
    else {
      killPlayer(state);
      return;
    }
  }
}

function eatGhost(state, g) {
  const idx = Math.min(3, state.frightChain);
  const base = ghostScore(idx);
  const value = base * Math.max(1, state.trainBonus);
  state.frightChain += 1;
  state.stats.bestChain = Math.max(state.stats.bestChain, state.frightChain);
  state.stats.ghostsEaten += 1;
  g.st = "eyes";
  g.dirIdx = NONE;
  g.eaten += 1;
  if (g.dartLeft) g.dartLeft = 0;
  addScore(state, value, "ghost");
  emit(state, "eatGhost", { id: g.id, name: g.name, value, chain: state.frightChain, train: state.trainBonus });
  if (state.mode === "timed") state.timeLeftMs += 2000;
}

function killPlayer(state) {
  if (state.status !== "running") return;
  state.deaths += 1;
  state.lives -= 1;
  state.wick = Math.max(0, state.wick - WICK.hitCost);
  state.status = "dying";
  state.statusMs = 1150;
  emit(state, "caught", { lives: state.lives });
}

function respawn(state) {
  const L = state.layout;
  state.player.x = L.spawn.x;
  state.player.y = L.spawn.y;
  state.player.dirIdx = 1;
  state.player.wantIdx = NONE;
  state.player.prog = 0;
  state.player.stunMs = 0;
  if (state.lives <= 0) {
    failNight(state, "lives");
    return;
  }
  for (const g of state.ghosts) {
    const house = L.houses[g.houseIdx];
    g.slot = house.slots[g.id % house.slots.length] ?? house.exit;
    g.x = g.slot.x;
    g.y = g.slot.y;
    g.prog = 0;
    g.dirIdx = NONE;
    g.st = "house";
    g.dartLeft = 0;
    g.dartWindMs = 0;
    g.releaseAt = state.clock + 1200 + g.id * 2200;
  }
  state.frightMs = 0;
  state.frightChain = 0;
  state.trainBonus = 1;
  state.phaseIdx = 0;
  state.phaseKind = state.cfg.phases[0]?.[1] ?? "chase";
  state.phaseMs = state.cfg.phases[0]?.[0] ?? 7000;
  state.dashMs = 0;
  state.dashCoolMs = 0;
  state.status = "ready";
  state.readyMs = 1500;
  emit(state, "respawn", { lives: state.lives });
}

function failNight(state, reason) {
  state.status = "lost";
  emit(state, "lost", { reason });
}

function checkClear(state) {
  if (state.dotLeft + state.pearlLeft > 0) return;
  if (state.status !== "running") return;
  state.status = "cleared";
  const bonus = clearBonus(state.lives, state.cfg);
  state.score = Math.min(SCORE_MAX, state.score + bonus);
  emit(state, "cleared", { bonus, score: state.score, timeMs: Math.round(state.clock) });
}

/** 百鬼夜巷：整巷清空即重撒光尘 */
function refillAlley(state) {
  const L = state.layout;
  for (let y = 0; y < L.height; y += 1) {
    for (let x = 0; x < L.width; x += 1) {
      const k = y * L.width + x;
      const ch = L.rows[y][x];
      if (ch === DOT) {
        state.dotGrid[k] = 1;
        state.dotLeft += 1;
      } else if (ch === PEARL) {
        state.pearlGrid[k] = 2;
        state.pearlLeft += 1;
      }
    }
  }
  emit(state, "refill");
}

function tickRounds(state) {
  const r = Math.floor(state.clock / state.cfg.roundMs) + 1;
  if (r <= state.round) return;
  state.round = r;
  if (state.ghosts.length < state.cfg.maxGhosts) addWanderingGhost(state);
  emit(state, "round", { round: r, ghosts: state.ghosts.length });
}

function addWanderingGhost(state) {
  const L = state.layout;
  const i = state.ghosts.length;
  const corner = L.corners[i % L.corners.length] ?? L.spawn;
  const beh = ["dart", "patrol", "silent", "ambush", "flanker"][i % 5];
  const g = makeMover(corner.x, corner.y, 1);
  Object.assign(g, {
    kind: "ghost",
    id: i,
    name: beh === "dart" ? "直影" : beh === "patrol" ? "巡影" : beh === "silent" ? "哑影" : "游影",
    beh,
    color: ["violet", "lime", "gray", "pink", "cyan"][i % 5],
    scatterKey: SCATTER_KEYS[i % 4],
    scatter: scatterPoint(L, SCATTER_KEYS[i % 4]),
    houseIdx: i % L.houses.length,
    slot: L.houses[i % L.houses.length].slots[0] ?? L.spawn,
    st: "normal",
    releaseAt: 0,
    bob: 0,
    eaten: 0,
    dartMs: 0,
    dartWindMs: 0,
    dartLeft: 0,
    patrolIdx: i % 4,
    silent: beh === "silent",
  });
  state.ghosts.push(g);
}

// ---------------------------------------------------------------- 意图

/** UI 只能发意图；非法意图静默返回 applied:false，绝不抛错 */
export function intent(state, action) {
  if (!state || !action || typeof action !== "object") return { applied: false, action: null };
  const type = action.type;

  if (type === "turn") {
    const d = dirIndex(action.dir);
    if (d === NONE) return { applied: false, action: null };
    if (state.status !== "running" && state.status !== "ready") return { applied: false, action: null };
    const p = state.player;
    if (state.status === "ready") {
      p.wantIdx = d;
      return { applied: true, action: "turn" };
    }
    if (p.dirIdx !== NONE && reverseDir(p.dirIdx) === d && p.prog > EPS) {
      // 原地掉头：立刻反向，把行程翻回来源格
      const old = DIRS[p.dirIdx];
      const nx = wrapX(state.layout, p.y, p.x + old.x);
      const ny = p.y + old.y;
      if (nx !== null && ny >= 0 && ny < state.layout.height) {
        p.x = nx;
        p.y = ny;
        p.prog = 1 - p.prog;
      }
      p.dirIdx = d;
      p.wantIdx = NONE;
      return { applied: true, action: "turn" };
    }
    p.wantIdx = d;
    return { applied: true, action: "turn" };
  }

  if (type === "dash") {
    if (state.status !== "running") return { applied: false, action: null };
    if (state.dashCoolMs > 0 || state.dashMs > 0 || state.wick < DASH.cost) return { applied: false, action: null };
    state.wick = Math.max(0, state.wick - DASH.cost);
    state.dashMs = DASH.activeMs;
    state.dashCoolMs = DASH.coolMs;
    let pushed = 0;
    for (const g of state.ghosts) {
      if (g.st !== "normal") continue;
      if (Math.sqrt(dist2(g.x, g.y, state.player.x, state.player.y)) > DASH.radius) continue;
      if (g.dirIdx !== NONE) g.dirIdx = reverseDir(g.dirIdx);
      g.stunMs = Math.max(g.stunMs, 260);
      pushed += 1;
    }
    emit(state, "dash", { pushed });
    return { applied: true, action: "dash" };
  }

  if (type === "pause") {
    if (state.status !== "running") return { applied: false, action: null };
    state.prevStatus = state.status;
    state.status = "paused";
    emit(state, "paused");
    return { applied: true, action: "pause" };
  }

  if (type === "resume") {
    if (state.status !== "paused") return { applied: false, action: null };
    state.status = "running";
    emit(state, "resumed");
    return { applied: true, action: "resume" };
  }

  return { applied: false, action: null };
}

// ---------------------------------------------------------------- 只读查询（渲染 / HUD 用）

export function entPos(state, ent) {
  const d = ent.dirIdx === NONE ? { x: 0, y: 0 } : DIRS[ent.dirIdx];
  return { x: ent.x + 0.5 + d.x * ent.prog, y: ent.y + 0.5 + d.y * ent.prog };
}

export function tileAt(state, x, y) {
  return charAt(state.layout, x, y);
}

export function dotAt(state, x, y) {
  const L = state.layout;
  if (x < 0 || y < 0 || x >= L.width || y >= L.height) return 0;
  const k = y * L.width + x;
  if (state.pearlGrid[k]) return 2;
  return state.dotGrid[k] ? 1 : 0;
}

export function visionRadius(state) {
  const fog = state.cfg.fog || 0;
  if (!fog) return 99;
  const base = 2.4 + (state.wick / WICK.max) * 4.2;
  return state.dashMs > 0 ? base * 1.6 : base * (0.55 + 0.45 * fog + 0.45);
}

/** 影魅当前状态的口径键，交给 i18n 层出文案（引擎不产出人类语言） */
export function ghostStateKey(state, g) {
  if (g.st === "eyes") return "eyes";
  if (g.st === "fright") return "fright";
  if (g.st === "house") return "house";
  if (g.st === "exiting") return "exiting";
  return state.phaseKind === "scatter" ? "scatter" : "chase";
}

export function isTerminal(state) {
  return state.status === "lost" || state.status === "won" || state.status === "cleared";
}

/** 加时（破晓冲刺用）：由控制器调用，引擎负责钳制 */
export function addTime(state, ms) {
  if (!state.cfg.timed) return state;
  state.timeLeftMs = Math.min(state.cfg.timedMax ?? 120000, Math.max(0, state.timeLeftMs + ms));
  emit(state, "time", { left: state.timeLeftMs, gained: ms });
  return state;
}

export function loseTime(state, ms) {
  if (!state.cfg.timed) return state;
  state.timeLeftMs = Math.max(0, state.timeLeftMs - ms);
  if (state.timeLeftMs === 0) failNight(state, "time");
  return state;
}
