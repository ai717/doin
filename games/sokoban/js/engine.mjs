// filepath: games/sokoban/js/engine.mjs
// 推箱子规则唯一权威。DOM-free 纯函数模块：地图解析、移动/推动合法性、胜负判定、计数。
// 规则口径：人只能推不能拉；一次只能推一个箱子；箱子前方必须是空地或目标；
// 目标格可站立、可放箱；全部箱子就位即获胜；终局后一切操作 no-op。

export const DIRS = Object.freeze([
  { id: 0, dx: 0, dy: -1, name: "up" },
  { id: 1, dx: 1, dy: 0, name: "right" },
  { id: 2, dx: 0, dy: 1, name: "down" },
  { id: 3, dx: -1, dy: 0, name: "left" },
]);

export const DIR_BY_ID = Object.freeze(Object.fromEntries(DIRS.map((d) => [d.id, d])));

// 解析 XSB 字符串行数组 -> 内部地图对象（Uint8Array 位图，index = y*cols+x）
export function parseLevel(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("empty level");
  const h = rows.length;
  const cols = Math.max(...rows.map((r) => r.length));
  const wall = new Uint8Array(h * cols);
  const goal = new Uint8Array(h * cols);
  const box = new Uint8Array(h * cols);
  let player = -1;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const i = y * cols + x;
      switch (ch) {
        case "#": wall[i] = 1; break;
        case "$": box[i] = 1; break;
        case ".": goal[i] = 1; break;
        case "*": box[i] = 1; goal[i] = 1; break;
        case "@": player = i; break;
        case "+": player = i; goal[i] = 1; break;
        default: break; // 空格与未知字符一律视为可走地面
      }
    }
  }
  if (player < 0) throw new Error("level has no player");
  if (!countBoxes({ box, goal, wall, cols, h })) throw new Error("level has no boxes");
  return { rows, cols, h, wall, goal, box, player, moves: 0, pushes: 0, won: false };
}

export function inBounds(map, i) {
  return i >= 0 && i < map.cols * map.h;
}

export function idx(map, x, y) {
  return y * map.cols + x;
}

export function countBoxes(map) {
  let n = 0;
  for (let i = 0; i < map.box.length; i++) if (map.box[i]) n++;
  return n;
}

// 已在目标上的箱子数（用于进度展示）
export function boxesOnGoal(map) {
  let n = 0;
  for (let i = 0; i < map.box.length; i++) if (map.box[i] && map.goal[i]) n++;
  return n;
}

// 试探一步：返回 { action: "walk", to } | { action: "push", to, ahead } | { action: null }
export function tryMove(map, dirId) {
  if (map.won) return { action: null };
  const dir = DIR_BY_ID[dirId];
  if (!dir) return { action: null };
  const to = map.player + dir.dy * map.cols + dir.dx;
  if (!inBounds(map, to) || map.wall[to]) return { action: null };
  if (!map.box[to]) return { action: "walk", to };
  const ahead = to + dir.dy * map.cols + dir.dx;
  if (!inBounds(map, ahead) || map.wall[ahead] || map.box[ahead]) return { action: null };
  return { action: "push", to, ahead };
}

// 执行一步：不可变地返回新地图；非法操作返回 null（调用方静默忽略，禁止 alert）
export function applyMove(map, dirId) {
  const res = tryMove(map, dirId);
  if (!res || !res.action) return null;
  const next = {
    ...map,
    rows: map.rows,
    wall: map.wall,
    goal: map.goal,
    box: map.box.slice(),
    player: res.to,
    moves: map.moves + 1,
    pushes: map.pushes + (res.action === "push" ? 1 : 0),
    won: false,
  };
  if (res.action === "push") {
    next.box[res.to] = 0;
    next.box[res.ahead] = 1;
  }
  next.won = isWon(next);
  return next;
}

export function isWon(map) {
  for (let i = 0; i < map.box.length; i++) {
    if (map.box[i] && !map.goal[i]) return false;
  }
  return true;
}

// 地图指纹（用于去重/存档校验）：箱位 bitset 的十进制字符串 + 玩家位置
export function fingerprint(map) {
  let bits = 0n;
  for (let i = 0; i < map.box.length; i++) if (map.box[i]) bits |= 1n << BigInt(i);
  return `${bits.toString()}|${map.player}`;
}

// 将内部地图序列化为紧凑存档字符串（wall/goal 来自关卡定义，只需记录箱位+人位）
export function serialize(map) {
  let bits = 0n;
  for (let i = 0; i < map.box.length; i++) if (map.box[i]) bits |= 1n << BigInt(i);
  return JSON.stringify({ p: map.player, b: bits.toString(), m: map.moves, u: map.pushes });
}

export function deserialize(map, str) {
  try {
    const data = JSON.parse(str);
    const bits = BigInt(data.b);
    const box = new Uint8Array(map.box.length);
    for (let i = 0; i < box.length; i++) if ((bits >> BigInt(i)) & 1n) box[i] = 1;
    return {
      ...map,
      box,
      player: Number(data.p),
      moves: Number(data.m) || 0,
      pushes: Number(data.u) || 0,
      won: false,
    };
  } catch {
    return null;
  }
}

// 每格在四个方向上是否邻墙（用于渲染/求解器 deadlock 判定）
export function neighborWalls(map, i) {
  const { cols } = map;
  return DIRS.map((d) => {
    const j = i + d.dy * cols + d.dx;
    return !inBounds(map, j) || map.wall[j] ? 1 : 0;
  });
}
