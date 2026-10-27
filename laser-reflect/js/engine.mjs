// laser-reflect engine.mjs
// 光学折射解谜：规则唯一权威，纯函数，严格 DOM-free。
// 数据模型：网格 grid[rows][cols]，每格一个元件 id 或 null。
// 光束在格子间沿四条轴向（N/E/S/W）传播，用队列做 BFS 光线追踪（防环 + 防爆）。

// —— 颜色 ——
export const WHITE = "white";
export const RED = "red";
export const GREEN = "green";
export const BLUE = "blue";
export const COLORS = Object.freeze([WHITE, RED, GREEN, BLUE]);

// —— 元件类型 ——
export const EMPTY = null;
export const EMITTER = "emitter"; // 激光发射器：固定，向指定方向射出白光
export const MIRROR = "mirror"; // 平面镜：两态 "/" 与 "\"，反射 90°
export const SPLITTER = "splitter"; // 分光器：两态 "/" 与 "\"，一路直行 + 一路按镜面反射
export const FILTER = "filter"; // 滤色片：固定，白光被染色直行 / 同色直行 / 异色吸收
export const SPECTRO = "spectro"; // 分色棱镜：固定，白光拆成 R(直行)/G(左偏90)/B(右偏90)
export const TARGET = "target"; // 感光核：只被同色光点亮（WHITE 靶可被任意光点亮）
export const WALL = "wall"; // 遮光墙：光束终止

// 可旋转元件（玩家可转 90°）：只有 MIRROR 与 SPLITTER，均为两态 mirror。
export const ROTATABLE = Object.freeze([MIRROR, SPLITTER]);

// 方向（顺时针）：N=0, E=1, S=2, W=3
export const DIRS = Object.freeze([
  Object.freeze([-1, 0]), // N
  Object.freeze([0, 1]), // E
  Object.freeze([1, 0]), // S
  Object.freeze([0, -1]), // W
]);
const N = 0, E = 1, S = 2, W = 3;

// 镜像反射表：mirrorOrientation: "/"=0, "\"=1
// 入射方向 -> 出射方向
const REFLECT = {
  0: { [N]: E, [E]: N, [S]: W, [W]: S }, // "/" 型（左上-右下）
  1: { [N]: W, [W]: N, [S]: E, [E]: S }, // "\" 型（右上-左下）
};

// 分色棱镜：白光拆成 R/G/B 三个方向（相对入射方向，固定映射，与自身朝向无关）
// 约定：红光沿入射方向继续，绿光右偏 90°，蓝光左偏 90°
const SPECTRO_RGB = {
  [N]: { red: N, green: E, blue: W },
  [E]: { red: E, green: S, blue: N },
  [S]: { red: S, green: W, blue: E },
  [W]: { red: W, green: N, blue: S },
};

const TURN = { [N]: E, [E]: S, [S]: W, [W]: N };

export function turnDir(dir) {
  return TURN[dir];
}

// —— 关卡数据 ——
// 每关：rows/cols、发射器、元件初始布局（含可旋转元件的初始朝向）、目标（靶列表）、par。
// 元件对象：{ type, r, c, dir?, mirror?, color?, targetColor? }
//   dir：发射方向（EMITTER）或元件的当前朝向（可旋转元件）
//   mirror：MIRROR 的 "/"(0) 或 "\"(1)
//   color：FILTER 的过滤色 / SPECTRO 忽略
//   targetColor：TARGET 需要的颜色（WHITE 表示任意）
export function makeLevel(spec) {
  return {
    rows: spec.rows,
    cols: spec.cols,
    par: spec.par,
    cells: spec.cells.map((cell) => ({ ...cell })),
  };
}

function cellAt(level, r, c) {
  if (r < 0 || r >= level.rows || c < 0 || c >= level.cols) return null;
  return level.cells.find((cell) => cell.r === r && cell.c === c) ?? null;
}

// 旋转一个可旋转元件 90°（返回新 cells 数组；不可旋转或无元件则原样返回）
// MIRROR 与 SPLITTER 均为两态，在 "/"(0) 与 "\"(1) 间切换。
export function rotate(level, r, c) {
  const idx = level.cells.findIndex((cell) => cell.r === r && cell.c === c);
  if (idx < 0) return level.cells;
  const cell = level.cells[idx];
  if (!ROTATABLE.includes(cell.type)) return level.cells;
  const next = level.cells.map((x) => ({ ...x }));
  const piece = { ...next[idx] };
  piece.mirror = (piece.mirror ?? 0) === 0 ? 1 : 0;
  next[idx] = piece;
  return next;
}

// —— 光线追踪 ——
// 返回 { lit: Set("r,c"), rays: [ {color, cells:[{r,c}]} ] }
// lit：被照亮的格子（含元件所在格）；rays：每条独立光束经过的格子序列（含颜色），供渲染画光路。
export function trace(level) {
  const rows = level.rows;
  const cols = level.cols;
  const cells = level.cells;

  const emitters = cells.filter((c) => c.type === EMITTER);
  const targets = cells.filter((c) => c.type === TARGET);

  // visited 按 (r,c,dir,color) 去重，防止环导致死循环
  const seen = new Set();
  const lit = new Set();
  const litTargets = new Set();
  const rays = [];
  const queue = [];

  function push(r, c, dir, color, path) {
    const key = `${r},${c},${dir},${color}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({ r, c, dir, color, path });
  }

  for (const emitter of emitters) {
    const dir = emitter.dir ?? E;
    push(emitter.r, emitter.c, dir, WHITE, [{ r: emitter.r, c: emitter.c }]);
  }

  while (queue.length) {
    const beam = queue.shift();
    const { r, c, dir, color, path } = beam;
    const nr = r + DIRS[dir][0];
    const nc = c + DIRS[dir][1];
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
      // 出界：记录这条光束的完整路径供渲染
      if (path.length >= 2) rays.push({ color, cells: path });
      continue;
    }
    const cell = cellAt(level, nr, nc);
    const steppedPath = [...path, { r: nr, c: nc }];

    if (!cell) {
      lit.add(`${nr},${nc}`);
      push(nr, nc, dir, color, steppedPath);
      continue;
    }

    lit.add(`${nr},${nc}`);

    switch (cell.type) {
      case WALL:
      case EMITTER:
        if (steppedPath.length >= 2) rays.push({ color, cells: steppedPath });
        break;
      case MIRROR: {
        const out = REFLECT[cell.mirror ?? 0][dir];
        push(nr, nc, out, color, steppedPath);
        break;
      }
      case SPLITTER: {
        // 一路直行 + 一路按镜面反射
        const straight = dir;
        const out = REFLECT[cell.mirror ?? 0][dir];
        push(nr, nc, straight, color, steppedPath);
        push(nr, nc, out, color, steppedPath);
        break;
      }
      case FILTER: {
        const filterColor = cell.color ?? RED;
        if (color === WHITE) {
          push(nr, nc, dir, filterColor, steppedPath);
        } else if (color === filterColor) {
          push(nr, nc, dir, color, steppedPath);
        } else {
          rays.push({ color, cells: steppedPath }); // 被吸收，路径终止于此
        }
        break;
      }
      case SPECTRO: {
        if (color === WHITE) {
          const mapping = SPECTRO_RGB[dir];
          push(nr, nc, mapping.red, RED, steppedPath);
          push(nr, nc, mapping.green, GREEN, steppedPath);
          push(nr, nc, mapping.blue, BLUE, steppedPath);
        } else {
          // 彩色光：直行通过（棱镜不再二次分光）
          push(nr, nc, dir, color, steppedPath);
        }
        break;
      }
      case TARGET: {
        const targetColor = cell.targetColor ?? WHITE;
        if (targetColor === WHITE || targetColor === color) {
          const idx = targets.indexOf(cell);
          if (idx >= 0) litTargets.add(idx);
        }
        rays.push({ color, cells: steppedPath });
        break;
      }
      default:
        break;
    }
  }

  return {
    lit,
    litTargets,
    targetCount: targets.length,
    rays,
  };
}

// —— 胜负判定 ——
export function isSolved(level) {
  const result = trace(level);
  return result.litTargets.size === result.targetCount && result.targetCount > 0;
}

// 步数/星级：按转动次数，<=par 三星，<=2*par 二星，否则一星。
export function starRating(moves, par) {
  if (moves <= par) return 3;
  if (moves <= par * 2) return 2;
  return 1;
}

// —— 确定性求解器验证（关卡 100% 可解 + par 内存在解）——
// 可旋转元件均为两态（mirror 0/1），暴力枚举 2^n 组合，
// 返回「从初始朝向转到该组合」的最小总转动次数。
export function verifySolvable(level) {
  const rotatables = level.cells
    .filter((c) => ROTATABLE.includes(c.type))
    .map((c) => ({ r: c.r, c: c.c }));

  const n = rotatables.length;
  const total = 1 << n; // 2^n 组合

  const initialOrient = rotatables.map((rc) => {
    const cell = cellAt(level, rc.r, rc.c);
    return cell.mirror ?? 0;
  });

  let anySolution = false;
  let minMoves = Infinity;

  for (let code = 0; code < total; code++) {
    const applied = level.cells.map((c) => ({ ...c }));
    let cost = 0;
    for (let i = 0; i < n; i++) {
      const bit = (code >> i) & 1;
      const cell = applied.find((c) => c.r === rotatables[i].r && c.c === rotatables[i].c);
      cell.mirror = bit;
      if (bit !== initialOrient[i]) cost += 1; // 两态：不同即 1 次转动
    }
    const testLevel = { ...level, cells: applied };
    if (isSolved(testLevel)) {
      anySolution = true;
      if (cost < minMoves) minMoves = cost;
    }
  }

  return { solvable: anySolution, minMoves: anySolution ? minMoves : null };
}

// 供测试使用的随机游走：随机旋转合法元件 1000 步不抛错。
export function randomWalk(level, rng, steps = 1000) {
  const rotatables = level.cells
    .filter((c) => ROTATABLE.includes(c.type))
    .map((c) => ({ r: c.r, c: c.c }));
  let cells = level.cells.map((c) => ({ ...c }));
  let current = { ...level, cells };
  for (let i = 0; i < steps; i++) {
    if (rotatables.length === 0) break;
    const rc = rotatables[Math.floor(rng() * rotatables.length)];
    current = { ...current, cells: rotate(current, rc.r, rc.c) };
    // 每次旋转后都 trace，断言不抛错
    trace(current);
  }
  return current;
}
