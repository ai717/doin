// 倒退贪吃蛇 Uncoil · 规则引擎（唯一权威 / 纯函数 / 严格 DOM-free）
//
// 盘面：rows × cols 正交网格，四周为界（越界即不可进入）。
// 蛇：位置序列 snake[0] = 头，snake[len-1] = 尾；相邻两节正交相邻，同一时刻互不重叠。
// 目标：吞下蜕身丸逐节缩短，长度降为 1 即完成蜕皮；头部四周无处可去即「困毙」。
//
// ★ 本作成立的地基（改动前务必先读）：
//   判定下一步时，尾巴所在格视为**可进入**——开局蛇几乎占满全盘，
//   若禁止「头追着自己的尾巴走」，绝大多数关卡在第 1 步就会锁死。

export const DIRS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1]
};

export const DIR_NAMES = ["up", "down", "left", "right"];

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

export const STATUS = {
  PLAYING: "playing",
  WON: "won",
  ENTOMBED: "entombed"
};

export const PELLET = {
  SHRINK: "pellet_shrink",
  MEGA: "pellet_mega"
};

// ---------- 确定性 PRNG ----------
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 索引工具 ----------
export function toIndex(state, r, c) {
  return r * state.cols + c;
}

export function fromIndex(state, i) {
  return { r: Math.floor(i / state.cols), c: i % state.cols };
}

export function inBounds(state, r, c) {
  return r >= 0 && r < state.rows && c >= 0 && c < state.cols;
}

// ---------- 状态构造 ----------
export function createState(level) {
  const state = {
    cols: level.cols,
    rows: level.rows,
    snake: level.snake.map((p) => ({ r: p.r, c: p.c })),
    wallSet: new Set((level.walls || []).map((p) => p.r * level.cols + p.c)),
    portalExit: buildPortalMap(level),
    pellets: (level.pellets || []).map((p) => ({ r: p.r, c: p.c, delta: p.delta, kind: p.kind || PELLET.SHRINK })),
    pelletIndex: level.pellets && level.pellets.length ? 0 : -1,
    dir: null,
    steps: 0,
    status: STATUS.PLAYING
  };
  // 开局即已无处可去的关卡是设计事故，此处照实反映（生成器/校验器负责杜绝）。
  if (state.snake.length <= 1) state.status = STATUS.WON;
  else if (legalDirs(state).length === 0) state.status = STATUS.ENTOMBED;
  return state;
}

function buildPortalMap(level) {
  const map = new Map();
  for (const pair of level.portals || []) {
    if (!pair || pair.length !== 2) continue;
    const a = pair[0];
    const b = pair[1];
    map.set(a.r * level.cols + a.c, b.r * level.cols + b.c);
    map.set(b.r * level.cols + b.c, a.r * level.cols + a.c);
  }
  return map;
}

export function cloneState(state) {
  return {
    cols: state.cols,
    rows: state.rows,
    snake: state.snake.map((p) => ({ r: p.r, c: p.c })),
    wallSet: new Set(state.wallSet),
    portalExit: new Map(state.portalExit),
    pellets: state.pellets.map((p) => ({ ...p })),
    pelletIndex: state.pelletIndex,
    dir: state.dir,
    steps: state.steps,
    status: state.status
  };
}

// ---------- 查询 ----------
export function length(state) {
  return state.snake.length;
}

export function head(state) {
  return { ...state.snake[0] };
}

export function activePellet(state) {
  if (state.pelletIndex < 0 || state.pelletIndex >= state.pellets.length) return null;
  return { ...state.pellets[state.pelletIndex] };
}

// 蛇身占据的格子集合。excludeTail = true 时排除尾巴（尾巴这一 tick 会让位）。
export function bodySet(state, excludeTail = false) {
  const s = new Set();
  const n = state.snake.length;
  const lim = excludeTail ? n - 1 : n;
  for (let i = 0; i < lim; i++) s.add(state.snake[i].r * state.cols + state.snake[i].c);
  return s;
}

// 解析「朝 dir 走一格」的最终落点。传送门只对头生效：踏入 A 门即从 B 门射出。
export function resolveTarget(state, dir) {
  const d = DIRS[dir];
  if (!d) return null;
  const h = state.snake[0];
  let r = h.r + d[0];
  let c = h.c + d[1];
  if (!inBounds(state, r, c)) return null;

  let from = null;
  let to = null;
  const gate = state.portalExit.get(r * state.cols + c);
  if (gate !== undefined) {
    from = { r, c };
    r = Math.floor(gate / state.cols);
    c = gate % state.cols;
    to = { r, c };
  }
  return { r, c, from, to };
}

export function isLegalDir(state, dir) {
  if (!DIRS[dir]) return false;
  const t = resolveTarget(state, dir);
  if (!t) return false;
  if (state.wallSet.has(t.r * state.cols + t.c)) return false;

  const blocked = bodySet(state, true); // 尾巴会让位，不计入阻挡
  // 洞口本身若被蛇身压住，头也进不去（身体堵住了门）
  const entry = t.from || t;
  if (blocked.has(entry.r * state.cols + entry.c)) return false;
  if (t.to && blocked.has(t.to.r * state.cols + t.to.c)) return false;

  // 禁止 180° 反向；长度 ≤ 2 时放开，否则会因无处可转而误判困毙
  if (state.dir && state.snake.length > 2 && dir === OPPOSITE[state.dir]) return false;
  return true;
}

export function legalDirs(state) {
  return DIR_NAMES.filter((d) => isLegalDir(state, d));
}

// ---------- 推进 ----------
// 返回 { action, state }。action 为 null 表示无效意图（终局或非法方向）→ 静默忽略，不报错。
export function step(state, dir) {
  if (state.status !== STATUS.PLAYING) return { action: null, state };
  if (!isLegalDir(state, dir)) return { action: null, state };

  const t = resolveTarget(state, dir);
  const pellet = activePellet(state);
  const ate = !!pellet && pellet.r === t.r && pellet.c === t.c;
  const oldLen = state.snake.length;
  const delta = ate ? pellet.delta : 0;
  const newLen = ate ? Math.max(1, oldLen - delta) : oldLen;

  // 新蛇 = [落点] + 旧蛇前 newLen-1 节；被剥离的就是旧蛇第 newLen-1 节起的部分
  const shed = state.snake.slice(newLen - 1).map((p) => ({ r: p.r, c: p.c }));
  const snake = [{ r: t.r, c: t.c }];
  for (let i = 0; i < newLen - 1; i++) snake.push({ r: state.snake[i].r, c: state.snake[i].c });

  const next = cloneState(state);
  next.snake = snake;
  next.dir = dir;
  next.steps = state.steps + 1;
  if (ate) {
    next.pelletIndex = state.pelletIndex + 1;
    if (next.pelletIndex >= next.pellets.length) next.pelletIndex = -1;
  }

  if (newLen <= 1) next.status = STATUS.WON;
  else if (legalDirs(next).length === 0) next.status = STATUS.ENTOMBED;
  else next.status = STATUS.PLAYING;

  const action = {
    dir,
    landing: { r: t.r, c: t.c },
    teleport: t.from ? { from: t.from, to: t.to } : null,
    ate: ate ? { pos: { r: t.r, c: t.c }, delta, shed } : null,
    spawned: next.pelletIndex >= 0 ? { ...next.pellets[next.pelletIndex] } : null,
    steps: next.steps,
    status: next.status
  };
  return { action, state: next };
}

// ---------- 关卡数据校验 ----------
// 返回问题列表（空数组 = 数据健康）。生成器与 tests 均依赖它守住数据底线。
export function validateLevel(level) {
  const problems = [];
  if (!level || !level.cols || !level.rows) {
    problems.push("missing_grid");
    return problems;
  }
  const cols = level.cols;
  const cellCount = cols * level.rows;
  const seen = new Set();
  const at = (p) => p.r * cols + p.c;

  for (const p of level.snake || []) {
    if (p.r < 0 || p.r >= level.rows || p.c < 0 || p.c >= cols) problems.push("snake_out_of_bounds");
    const k = at(p);
    if (seen.has(k)) problems.push("snake_overlap");
    seen.add(k);
  }
  const snake = level.snake || [];
  for (let i = 1; i < snake.length; i++) {
    const d = Math.abs(snake[i].r - snake[i - 1].r) + Math.abs(snake[i].c - snake[i - 1].c);
    if (d !== 1) problems.push("snake_not_connected");
  }

  const wallSet = new Set((level.walls || []).map(at));
  for (const k of wallSet) if (seen.has(k)) problems.push("wall_on_snake");

  if (snake.length + wallSet.size > cellCount) problems.push("grid_over_capacity");

  const pellets = level.pellets || [];
  if (!pellets.length) problems.push("no_pellets");
  if (pellets[0] && wallSet.has(at(pellets[0]))) problems.push("first_pellet_on_wall");
  if (pellets[0] && seen.has(at(pellets[0]))) problems.push("first_pellet_on_snake");

  for (const p of pellets) {
    if (!(p.delta >= 1)) problems.push("bad_pellet_delta");
  }
  // 总缩减量必须足以把蛇削到 1 节，否则玩家吃完所有丸也赢不了
  const total = pellets.reduce((s, p) => s + (p.delta || 0), 0);
  if (total < snake.length - 1) problems.push("insufficient_shrink");

  return problems;
}

export function totalShrink(level) {
  return (level.pellets || []).reduce((s, p) => s + (p.delta || 0), 0);
}
