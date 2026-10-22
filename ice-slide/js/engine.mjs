// filepath: games/ice-slide/js/engine.mjs
// 冰面滑行推箱规则唯一权威。DOM-free 纯函数模块：地图解析、滑行结算、胜负判定、序列化。
// 规则口径（与 sokoban 的本质差异——惯性滑行，拍板项 3 = A 纯冰面，无雪地/机关格）：
//   1) 人与箱沿选定方向持续滑行，撞墙/撞箱/边界才停，中途无法刹车；
//   2) 人顶到箱时箱沿同方向继续滑：箱前方通畅则人箱同步滑至箱撞停（人停在箱最终位置后一格）；
//      箱前方即时堵死（一格都滑不动）则人滑到箱前相邻格即停，该步照常计数；
//   3) 任一方向只要人移动了 >=1 格即记 1 步；人紧贴墙纹丝不动的方向为无效意图，返回 null 静默忽略；
//   4) 全部箱子位于灯标即获胜；终局后一切操作 no-op。

export const DIRS = Object.freeze([
  { id: 0, dx: 0, dy: -1, name: "up" },
  { id: 1, dx: 1, dy: 0, name: "right" },
  { id: 2, dx: 0, dy: 1, name: "down" },
  { id: 3, dx: -1, dy: 0, name: "left" },
]);

export const DIR_BY_ID = Object.freeze(Object.fromEntries(DIRS.map((d) => [d.id, d])));

// 解析 XSB 字符串行数组 -> 内部地图对象（Uint8Array 位图，index = y*cols+x）。
// 字符口径与 sokoban 完全一致：'#' 墙 | ' ' 冰面 | '.' 灯标 | '$' 箱 | '*' 箱在灯标 | '@' 人 | '+' 人在灯标。
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
        default: break; // 空格与未知字符一律视为可滑行冰面
      }
    }
  }
  if (player < 0) throw new Error("level has no player");
  if (!countBoxes({ box, goal, wall, cols, h })) throw new Error("level has no boxes");
  return { rows, cols, h, wall, goal, box, player, moves: 0, pushes: 0, won: false, last: null };
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

// 已在灯标上的箱子数（用于进度展示）
export function boxesOnGoal(map) {
  let n = 0;
  for (let i = 0; i < map.box.length; i++) if (map.box[i] && map.goal[i]) n++;
  return n;
}

// 某格在 dirId 方向上是否被墙/箱/边界堵死（滑行停驻判据）
export function blockedAhead(map, i, dirId) {
  const dir = DIR_BY_ID[dirId];
  const j = i + dir.dy * map.cols + dir.dx;
  return !inBounds(map, j) || map.wall[j] === 1 || map.box[j] === 1;
}

// 预演某方向的完整滑行结算（不产生新状态，ui 轨迹预览与求解器共用）。
// 返回 null = 无效意图（人纹丝不动）；否则：
//   { dir, playerFrom, playerTo, path: 人经过的单元格（含起点终点，供冰晶轨迹）,
//     boxFrom, boxTo, boxPath: 箱滑行路径（无推箱时 boxFrom = -1） }
export function previewSlide(map, dirId) {
  if (map.won) return null;
  const dir = DIR_BY_ID[dirId];
  if (!dir) return null;
  const step = dir.dy * map.cols + dir.dx;
  let p = map.player;
  let boxFrom = -1;
  let boxTo = -1;
  for (;;) {
    const ahead = p + step;
    if (!inBounds(map, ahead) || map.wall[ahead]) break; // 撞墙/边界 -> 停
    if (map.box[ahead]) {
      // 顶到箱：箱沿同方向继续滑，直至前方堵死
      let b = ahead;
      for (;;) {
        const bAhead = b + step;
        if (!inBounds(map, bAhead) || map.wall[bAhead] || map.box[bAhead]) break;
        b = bAhead;
      }
      if (b === ahead) break; // 箱一格都滑不动 -> 人停在箱前相邻格
      boxFrom = ahead;
      boxTo = b;
      p = b - step; // 人最终停在箱最终位置的后一格
      break;
    }
    p = ahead;
  }
  if (p === map.player) return null; // 人未移动 = 无效意图
  const path = [];
  for (let c = map.player; ; c += step) {
    path.push(c);
    if (c === p) break;
  }
  const boxPath = [];
  if (boxFrom >= 0) {
    for (let c = boxFrom; ; c += step) {
      boxPath.push(c);
      if (c === boxTo) break;
    }
  }
  return { dir: dir.id, playerFrom: map.player, playerTo: p, path, boxFrom, boxTo, boxPath };
}

// 执行一次方向滑行：不可变地返回新地图；无效意图返回 null（调用方静默忽略，禁止 alert）。
export function slide(map, dirId) {
  const res = previewSlide(map, dirId);
  if (!res) return null;
  const box = map.box.slice();
  if (res.boxFrom >= 0) {
    box[res.boxFrom] = 0;
    box[res.boxTo] = 1;
  }
  const next = {
    ...map,
    box,
    player: res.playerTo,
    moves: map.moves + 1,
    pushes: map.pushes + (res.boxFrom >= 0 ? 1 : 0),
    won: false,
    last: res,
  };
  next.won = isWon(next);
  return next;
}

export function isWon(map) {
  for (let i = 0; i < map.box.length; i++) {
    if (map.box[i] && !map.goal[i]) return false;
  }
  return true;
}

// 合法方向列表：滑行后人至少移动一格的方向（随机游走测试与求解器展开用）
export function legalDirs(map) {
  const out = [];
  for (const d of DIRS) if (previewSlide(map, d.id)) out.push(d.id);
  return out;
}

// 地图指纹（去重/存档校验）：箱位 bitset 的十进制字符串 + 玩家位置
export function fingerprint(map) {
  let bits = 0n;
  for (let i = 0; i < map.box.length; i++) if (map.box[i]) bits |= 1n << BigInt(i);
  return `${bits.toString()}|${map.player}`;
}

// 将内部地图序列化为紧凑存档字符串（wall/goal 来自关卡定义，只需记录箱位+人位+计数）
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
      last: null,
    };
  } catch {
    return null;
  }
}
