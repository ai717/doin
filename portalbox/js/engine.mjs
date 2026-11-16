// 《传送门推箱》核心规则：网格推箱 + 成对传送门非欧拓扑映射 + 出口阻抗。
// 纯函数、DOM-free、完全确定性；同一状态 + 同一操作必然得到同一结果。
// 传送门约定：portal 描述「可站立格 + 墙面方向」，进入需朝该墙面移动；
// 从配对门穿出时落在配对门所在的格，朝向为配对门墙面的外法线方向。

export const COLS = 12;
export const ROWS = 10;
export const CELL = 48;
export const WIDTH = 840;
export const HEIGHT = 560;
export const FIELD_X = (WIDTH - COLS * CELL) / 2;
export const FIELD_Y = (HEIGHT - ROWS * CELL) / 2;
export const FIELD_W = COLS * CELL;
export const FIELD_H = ROWS * CELL;

export const WALL = 0;
export const FLOOR = 1;

export const STATUS_PLAYING = "playing";
export const STATUS_WON = "won";

export const STAR_TOLERANCE = 3;
export const TWO_STAR_TOLERANCE = 9;

export const DIRS = Object.freeze({
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
});
export const DIRECTIONS = ["up", "down", "left", "right"];
export const OPPOSITE = Object.freeze({ up: "down", down: "up", left: "right", right: "left" });

export const PORTAL_COLORS = Object.freeze({
  blue: "#00a8ff",
  orange: "#e84118",
  purple: "#a55eea",
  green: "#2ed573",
});

export const PAIR_COLORS = Object.freeze({
  A: ["blue", "orange"],
  B: ["purple", "green"],
});

export function isInside(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

export function isWall(state, col, row) {
  if (!isInside(col, row)) return true;
  return state.grid[row][col] === WALL;
}

export function boxAt(state, col, row) {
  return state.boxes.find((box) => box.col === col && box.row === row) ?? null;
}

export function goalAt(state, col, row) {
  return state.goals.some((goal) => goal.col === col && goal.row === row);
}

export function portalFor(state, col, row, side) {
  return state.portalMap[`${col},${row},${side}`] ?? null;
}

export function pairedPortal(state, portal) {
  if (!portal) return null;
  return state.portals.find((other) => other.pair === portal.pair && other.index !== portal.index) ?? null;
}

export function portalExit(portal) {
  if (!portal) return null;
  return { col: portal.col, row: portal.row, dir: OPPOSITE[portal.side] };
}

export function activePairs(state) {
  const pairs = new Map();
  for (const portal of state.portals) {
    if (!pairs.has(portal.pair)) pairs.set(portal.pair, []);
    pairs.get(portal.pair).push(portal);
  }
  return Array.from(pairs.entries()).map(([pair, portals]) => ({ pair, portals }));
}

function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    boxes: state.boxes.map((box) => ({ ...box })),
    events: [],
    lastMove: { ...state.lastMove },
  };
}

function blocked(state, dir, reason) {
  const next = cloneState(state);
  next.lastMove = { moved: false, dir, type: reason };
  next.events.push({ type: "blocked", reason, dir });
  return next;
}

function movePlayer(next, col, row, dir) {
  next.player.col = col;
  next.player.row = row;
  next.player.dir = dir;
}

function markMove(next, type, dir, extra = {}) {
  next.steps += 1;
  next.lastMove = { moved: true, dir, type, ...extra };
}

export function isSolved(state) {
  if (!state) return false;
  if (state.boxes.length !== state.goals.length) return false;
  return state.goals.every((goal) => Boolean(boxAt(state, goal.col, goal.row)));
}

function updateSolved(next) {
  if (isSolved(next) && !next.solved) {
    next.solved = true;
    next.status = STATUS_WON;
    next.events.push({ type: "solved", steps: next.steps });
  }
}

function validateLevel(level) {
  if (!level || !Array.isArray(level.map) || level.map.length !== ROWS) return false;
  if (!level.map.every((row) => typeof row === "string" && row.length === COLS)) return false;
  if (!Array.isArray(level.portals)) return false;
  return true;
}

export function createState(level) {
  if (!validateLevel(level)) return null;

  const grid = [];
  const boxes = [];
  const goals = [];
  let player = null;

  for (let row = 0; row < ROWS; row += 1) {
    const line = level.map[row];
    const cells = [];
    for (let col = 0; col < COLS; col += 1) {
      const token = line[col];
      const wall = token === "#";
      cells.push(wall ? WALL : FLOOR);
      if (token === "P") player = { col, row, dir: "down" };
      if (token === "B") boxes.push({ id: `b${boxes.length}`, col, row });
      if (token === "G") goals.push({ col, row });
    }
    grid.push(cells);
  }

  if (!player || boxes.length === 0 || goals.length === 0 || boxes.length !== goals.length) return null;

  const portals = [];
  const portalMap = {};
  const pairCount = new Map();
  for (const raw of level.portals) {
    if (!raw || !DIRS[raw.side] || !isInside(raw.col, raw.row)) return null;
    if (grid[raw.row][raw.col] !== FLOOR) return null;
    const delta = DIRS[raw.side];
    if (!isWall({ grid }, raw.col + delta.dc, raw.row + delta.dr)) return null;
    if (!PORTAL_COLORS[raw.color]) return null;
    const portal = {
      index: portals.length,
      pair: raw.pair,
      color: raw.color,
      col: raw.col,
      row: raw.row,
      side: raw.side,
    };
    portals.push(portal);
    portalMap[`${portal.col},${portal.row},${portal.side}`] = portal;
    pairCount.set(portal.pair, (pairCount.get(portal.pair) ?? 0) + 1);
  }
  if (portals.length === 0 || portals.length % 2 !== 0) return null;
  for (const count of pairCount.values()) if (count !== 2) return null;
  for (const portal of portals) {
    if (!pairedPortal({ portals }, portal)) return null;
    const exit = portalExit(pairedPortal({ portals }, portal));
    if (!isInside(exit.col, exit.row) || grid[exit.row][exit.col] !== FLOOR) return null;
  }

  const state = {
    levelId: level.id,
    chapter: level.chapter ?? 1,
    grid,
    player,
    boxes,
    goals,
    portals,
    portalMap,
    steps: 0,
    status: STATUS_PLAYING,
    solved: false,
    events: [],
    lastMove: { moved: false, dir: null, type: "none" },
  };
  if (isSolved(state)) return null;
  return state;
}

export function step(state, dir) {
  if (!state || state.solved || !DIRS[dir]) return state;
  const delta = DIRS[dir];
  const player = state.player;
  const targetCol = player.col + delta.dc;
  const targetRow = player.row + delta.dr;

  if (isWall(state, targetCol, targetRow)) {
    const portal = portalFor(state, player.col, player.row, dir);
    if (!portal) return blocked(state, dir, "wall");
    const partner = pairedPortal(state, portal);
    const exit = portalExit(partner);
    if (!exit || boxAt(state, exit.col, exit.row)) return blocked(state, dir, "impedance");
    const next = cloneState(state);
    movePlayer(next, exit.col, exit.row, exit.dir);
    markMove(next, "portal", dir, { pair: portal.pair });
    next.events.push({
      type: "portal",
      who: "player",
      pair: portal.pair,
      from: { col: player.col, row: player.row },
      to: { col: exit.col, row: exit.row },
    });
    return next;
  }

  const box = boxAt(state, targetCol, targetRow);
  if (!box) {
    const next = cloneState(state);
    movePlayer(next, targetCol, targetRow, dir);
    markMove(next, "move", dir);
    next.events.push({ type: "move", from: { col: player.col, row: player.row }, to: { col: targetCol, row: targetRow } });
    return next;
  }

  const beyondCol = targetCol + delta.dc;
  const beyondRow = targetRow + delta.dr;

  if (isWall(state, beyondCol, beyondRow)) {
    const portal = portalFor(state, targetCol, targetRow, dir);
    if (!portal) return blocked(state, dir, "box-wall");
    const partner = pairedPortal(state, portal);
    const exit = portalExit(partner);
    if (!exit || boxAt(state, exit.col, exit.row)) return blocked(state, dir, "impedance");
    if (state.player.col === exit.col && state.player.row === exit.row) return blocked(state, dir, "impedance");
    const next = cloneState(state);
    const movedBox = next.boxes.find((item) => item.id === box.id);
    movedBox.col = exit.col;
    movedBox.row = exit.row;
    next.player.dir = dir;
    markMove(next, "portal-box", dir, { pair: portal.pair });
    next.events.push({
      type: "portal",
      who: "box",
      pair: portal.pair,
      from: { col: targetCol, row: targetRow },
      to: { col: exit.col, row: exit.row },
    });
    updateSolved(next);
    return next;
  }

  if (boxAt(state, beyondCol, beyondRow)) return blocked(state, dir, "box-box");

  const next = cloneState(state);
  const movedBox = next.boxes.find((item) => item.id === box.id);
  movedBox.col = beyondCol;
  movedBox.row = beyondRow;
  movePlayer(next, targetCol, targetRow, dir);
  markMove(next, "push", dir);
  next.events.push({
    type: "push",
    from: { col: targetCol, row: targetRow },
    to: { col: beyondCol, row: beyondRow },
  });
  updateSolved(next);
  return next;
}

export function applyMoves(state, directions) {
  let next = state;
  for (const dir of directions) next = step(next, dir);
  return next;
}

export function stateKey(state) {
  const boxes = state.boxes
    .map((box) => `${box.col},${box.row}`)
    .sort()
    .join(";");
  return `${state.player.col},${state.player.row}|${boxes}`;
}

export function snapshot(state) {
  return {
    player: { ...state.player },
    boxes: state.boxes.map((box) => ({ ...box })),
    steps: state.steps,
    solved: state.solved,
    status: state.status,
  };
}

export function restore(state, saved) {
  if (!state || !saved) return state;
  const next = cloneState(state);
  next.player = { ...saved.player };
  next.boxes = saved.boxes.map((box) => ({ ...box }));
  next.steps = saved.steps;
  next.solved = Boolean(saved.solved);
  next.status = saved.status ?? STATUS_PLAYING;
  next.events = [];
  next.lastMove = { moved: false, dir: null, type: "restore" };
  return next;
}
