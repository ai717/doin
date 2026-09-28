// 青蛙过河（Frogger）规则引擎：纯函数、零依赖，不触碰 DOM / storage / 计时器。
//
// 模型：俯视网格 COLS×ROWS，自上而下依次为「归巢行 → 5 行河流 → 安全岛 → 5 行公路 → 起点行」。
// 青蛙是离散格点 (row, col)；车辆与浮木按「每行一个方向 + 速度」循环漂移，
// 其占用用纯函数 laneHits / riverSolid 由时间 t 确定，无内存态、可复现。
//
// 推进策略（固定步长）：stepFrame(state, dt) 累加 state.time（秒）。
// 车辆/浮木的占用改用「格中心点 + 连续相位 time*speed」判定，与渲染层的平滑子格插值
// 严格共享同一时间函数，从根本上消除「离散 floor 相位滞后 —— 车已移开仍被撞」的误判。
// 所有状态转换不可变：操作无效果时原样返回传入的同一对象引用，绝不抛错。

export const COLS = 13;
export const ROWS = 13;

export const HOME_ROW = 0;     // 归巢行（5 个家槽）
export const MEDIAN_ROW = 6;   // 中央安全岛
export const START_ROW = 12;   // 起点草地
export const RIVER_ROWS = [1, 2, 3, 4, 5];
export const ROAD_ROWS = [7, 8, 9, 10, 11];
export const HOME_COLS = [2, 4, 6, 8, 10];
export const START_COL = 6;

export const STATUS_PLAYING = "playing";
export const STATUS_WON = "won";
export const STATUS_LOST = "lost";

// 事件类型（供 UI/score 层做反馈与计分，引擎本身不管理分数口径）
export const EV_HOME = "home";     // 归巢成功
export const EV_FLY = "fly";       // 归巢命中飞虫槽（+1 命 + bonus）
export const EV_HIT = "hit";       // 被车撞
export const EV_DROWN = "drown";   // 落水
export const EV_EDGE = "edge";     // 撞屏幕左右边缘 / 撞归巢槽壁
export const EV_TIMEOUT = "timeout"; // 倒计时归零

// 确定性 PRNG：同一 seed 必得同一序列，关卡生成与测试都依赖它。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function posmod(a, n) {
  return ((a % n) + n) % n;
}

export function isRiverRow(row) {
  return row >= RIVER_ROWS[0] && row <= RIVER_ROWS[RIVER_ROWS.length - 1];
}

export function isRoadRow(row) {
  return row >= ROAD_ROWS[0] && row <= ROAD_ROWS[ROAD_ROWS.length - 1];
}

export function isSafeRow(row) {
  return row === MEDIAN_ROW || row === START_ROW;
}

// 用「格中心点」映射到 pattern 索引：青蛙碰撞/承托以其身体中心 col+0.5 为准，
// 相位为连续 time*speed（与渲染平滑插值一致），杜绝整格 floor 带来的相位滞后。
function centerIndex(col, time, speed, dir, periodLen) {
  const x = col + 0.5 - dir * time * speed;
  return posmod(Math.floor(x), periodLen);
}

// 该格中心是否被车辆覆盖（连续相位，与渲染所见严格一致）。
export function laneHits(lane, col, time) {
  if (!lane) return false;
  return lane.pattern[centerIndex(col, time, lane.speed, lane.dir, lane.periodLen)] === 1;
}

// 该格中心是否有浮木/荷叶承托（连续相位，与渲染所见严格一致）。
export function riverSolid(river, col, time) {
  if (!river) return false;
  if (river.still && river.still.includes(col)) return true;
  return river.pattern[centerIndex(col, time, river.speed, river.dir, river.periodLen)] === 1;
}

function buildIndexMap(rows, list) {
  const map = {};
  for (const item of list) map[item.row] = item;
  return map;
}

function normalizeLane(lane) {
  return {
    row: Math.trunc(lane.row),
    dir: lane.dir >= 0 ? 1 : -1,
    speed: Math.max(0, Number(lane.speed) || 0),
    periodLen: Math.max(1, Math.trunc(lane.periodLen) || 1),
    pattern: Array.isArray(lane.pattern) ? lane.pattern.map((v) => (v ? 1 : 0)) : [0],
  };
}

function normalizeRiver(river) {
  return {
    row: Math.trunc(river.row),
    dir: river.dir >= 0 ? 1 : -1,
    speed: Math.max(0, Number(river.speed) || 0),
    periodLen: Math.max(1, Math.trunc(river.periodLen) || 1),
    pattern: Array.isArray(river.pattern) ? river.pattern.map((v) => (v ? 1 : 0)) : [0],
    still: Array.isArray(river.still) ? river.still.map((v) => Math.trunc(v)) : [],
  };
}

// 从 level 配置组装运行态（config 由 level.mjs 生成并传入）。
export function createState(config = {}) {
  const lanes = (config.lanes ?? []).map(normalizeLane);
  const rivers = (config.rivers ?? []).map(normalizeRiver);
  const timerMax = Math.max(5, Number(config.timerMax) || 60);
  const lives = Math.max(1, Math.trunc(config.lives) || 3);
  const seed = (config.seed ?? 1) >>> 0;
  const state = {
    cols: COLS,
    rows: ROWS,
    time: 0,
    status: STATUS_PLAYING,
    lives,
    totalLostLives: 0,
    flyCount: 0,
    homesFilled: 0,
    timerMax,
    timer: timerMax,
    homes: [false, false, false, false, false],
    homeCols: HOME_COLS.slice(),
    frog: { row: START_ROW, col: START_COL },
    spawnCount: 0,
    seed,
    laneByRow: buildIndexMap(null, lanes),
    riverByRow: buildIndexMap(null, rivers),
    lanes,
    rivers,
    lastEvent: null,
  };
  state.flyHome = pickFlyHome(state);
  return state;
}

// 选出当前青蛙的「飞虫槽」：优先选空槽，确定性哈希使结果可复现。
function pickFlyHome(state) {
  const empty = [];
  for (let i = 0; i < state.homes.length; i += 1) {
    if (!state.homes[i]) empty.push(i);
  }
  if (empty.length === 0) return -1;
  const idx = (state.seed + state.spawnCount * 7) % empty.length;
  return empty[idx];
}

function resetFrog(state, lastEvent) {
  const next = {
    ...state,
    frog: { row: START_ROW, col: START_COL },
    timer: state.timerMax,
    spawnCount: state.spawnCount + 1,
    lastEvent,
  };
  next.flyHome = pickFlyHome(next);
  return next;
}

// 失去一条命：命尽则整局失败；否则重生到起点（不扣已填的家槽）。
function loseLife(state, lastEvent) {
  const lives = state.lives - 1;
  const totalLostLives = state.totalLostLives + 1;
  if (lives <= 0) {
    return { ...state, lives: 0, totalLostLives, lastEvent, status: STATUS_LOST };
  }
  return resetFrog({ ...state, lives, totalLostLives }, lastEvent);
}

// 归巢判定：落入空槽填满；命中飞虫槽加分续命；撞壁/撞占位则死亡。
function reachHome(state, col) {
  const slot = state.homeCols.indexOf(col);
  if (slot < 0 || state.homes[slot]) {
    return loseLife(state, EV_EDGE);
  }
  const homes = state.homes.slice();
  homes[slot] = true;
  let flyCount = state.flyCount;
  let lives = state.lives;
  let event = EV_HOME;
  if (slot === state.flyHome) {
    flyCount += 1;
    lives += 1; // 飞虫续命
    event = EV_FLY;
  }
  const homesFilled = state.homesFilled + 1;
  const base = { ...state, homes, flyCount, lives, homesFilled, lastEvent: event };
  if (homesFilled >= state.homes.length) {
    return { ...base, status: STATUS_WON };
  }
  return resetFrog(base, event);
}

// 四向跳跃意图。dir ∈ up/down/left/right。无效/终止态返回原 state 引用。
export function applyIntent(state, dir) {
  if (state.status !== STATUS_PLAYING) return { state, action: null };
  const f = state.frog;
  let row = f.row;
  let col = f.col;
  if (dir === "up") row -= 1;
  else if (dir === "down") row += 1;
  else if (dir === "left") col -= 1;
  else if (dir === "right") col += 1;
  else return { state, action: null };

  // 不能向下越过起点。
  if (row > START_ROW) return { state, action: null };
  if (row < HOME_ROW) return { state, action: null };

  // 撞左右边缘即死。
  if (col < 0 || col >= state.cols) {
    return { state: loseLife(state, EV_EDGE), action: EV_EDGE };
  }

  // 到达归巢行。
  if (row === HOME_ROW) {
    const next = reachHome(state, col);
    return { state: next, action: next.lastEvent };
  }

  const moved = { ...state, frog: { row, col } };

  // 落点安全判定（复用同一套占用函数，保证与持续推进一致）。
  if (isRoadRow(row)) {
    if (laneHits(state.laneByRow[row], col, state.time)) {
      return { state: loseLife(moved, EV_HIT), action: EV_HIT };
    }
  } else if (isRiverRow(row)) {
    if (!riverSolid(state.riverByRow[row], col, state.time)) {
      return { state: loseLife(moved, EV_DROWN), action: EV_DROWN };
    }
  }

  return { state: moved, action: "move" };
}

// 固定步长推进：车辆/浮木随时间漂移，青蛙脚下的安全性会随时间变化。
// 终止态 no-op；其余时刻由时间唯一确定结果，可重放。
export function stepFrame(state, dt) {
  if (state.status !== STATUS_PLAYING) return state;
  const time = state.time + Math.max(0, Number(dt) || 0);
  const f = state.frog;
  const base = { ...state, time };

  // 持续安全判定：站在公路上可能被驶来的车撞上，站在河流上可能因浮木漂走而落水。
  if (isRoadRow(f.row) && laneHits(state.laneByRow[f.row], f.col, time)) {
    return loseLife(base, EV_HIT);
  }
  if (isRiverRow(f.row) && !riverSolid(state.riverByRow[f.row], f.col, time)) {
    return loseLife(base, EV_DROWN);
  }

  const timer = state.timer - Math.max(0, Number(dt) || 0);
  if (timer <= 0) {
    return loseLife({ ...base, timer: 0, frog: state.frog }, EV_TIMEOUT);
  }

  return { ...base, timer, frog: state.frog };
}

// 便捷：以固定 1 秒推进 n 步（测试用确定性整数时步）。
export function stepSeconds(state, n = 1) {
  let next = state;
  for (let i = 0; i < n; i += 1) next = stepFrame(next, 1);
  return next;
}