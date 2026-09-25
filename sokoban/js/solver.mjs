// filepath: games/sokoban/js/solver.mjs
// 推箱子最优求解器（PBD：Push-number-first 分层 BFS + 层内玩家可达区 BFS）。
// DOM-free 纯函数模块，双向用途：
//   1) 关卡开发期批量验证可解性并实算最优推数；
//   2) 运行时"提示"功能：给出当前局面的最优推箱方向。
// 状态 = 箱位 BigInt bitset；同推数层内每箱位布局维护单锚点（推后玩家位置），
// 推数最优精确，步数近似最优；parent 链按箱位布局记录，可回溯完整推箱方向序列。
// 剪枝：角落死局 + 全局冻结传播 + 已访问按推数松弛。
import { DIRS, inBounds } from "./engine.mjs";

function goalBits(level) {
  let g = 0n;
  for (let i = 0; i < level.goal.length; i++) if (level.goal[i]) g |= 1n << BigInt(i);
  return g;
}

function boxBits(level) {
  let b = 0n;
  for (let i = 0; i < level.box.length; i++) if (level.box[i]) b |= 1n << BigInt(i);
  return b;
}

// 角落死局格：非目标格且存在两个正交方向均被墙封死
export function cornerDeadlockCells(level) {
  const cells = new Uint8Array(level.cols * level.h);
  for (let i = 0; i < cells.length; i++) {
    if (level.goal[i]) continue;
    const up = level.wall[i - level.cols] || i < level.cols;
    const down = level.wall[i + level.cols] || i >= level.cols * (level.h - 1);
    const left = level.wall[i - 1] || i % level.cols === 0;
    const right = level.wall[i + 1] || i % level.cols === level.cols - 1;
    if ((up && left) || (up && right) || (down && left) || (down && right)) cells[i] = 1;
  }
  return cells;
}

function countBits(b) {
  let n = 0;
  for (; b; b &= b - 1n) n++;
  return n;
}

// 单一位的索引（调用方保证 b 恰好一位）
function bitIndex(b) {
  let i = 0;
  while (!(b & 1n)) { b >>= 1n; i++; }
  return i;
}

// 全局冻结检测：对给定箱布局做角落→冻结传播，任一非目标箱被冻结即认为该状态必死
function freezeDeadState(boxes, level, corner) {
  const { cols, h, wall, goal } = level;
  const list = [];
  let bb = boxes;
  for (let i = 0; i < cols * h; i++) if ((bb >> BigInt(i)) & 1n) list.push(i);
  if (list.length > 12) return false; // 超多箱时传播开销大，角落剪枝已足够
  const dead = new Set();
  for (const b of list) if (!goal[b] && corner[b]) dead.add(b);
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of list) {
      if (goal[b] || dead.has(b)) continue;
      let stuck = true;
      for (const d of DIRS) {
        const j = b + d.dy * cols + d.dx;
        if (!inBounds(level, j) || wall[j]) continue;
        if (!((boxes >> BigInt(j)) & 1n)) { stuck = false; break; }
        if (!dead.has(j)) { stuck = false; break; }
      }
      if (stuck) { dead.add(b); changed = true; }
    }
  }
  for (const b of list) if (!goal[b] && dead.has(b)) return true;
  return false;
}

/**
 * 求解。level 为 parseLevel 结果。
 * @returns {{ solvable: boolean, pushes: number, moves: number, path: number[], states: number, timedOut: boolean }}
 *          path 为最优推箱方向序列（每项为 DIRS 下标，对应一次推箱）。
 *          推数最优精确；moves 为步数近似最优（层内单锚点 BFS，跨状态行走按松弛合并）。
 */
export function solve(level, opts = {}) {
  if (opts.mode === "ida") return solveIDA(level, opts);
  const maxPushes = opts.maxPushes ?? 120;
  const maxStates = opts.maxStates ?? 8_000_000;
  const timeLimit = opts.maxTimeMs ?? 30000;
  const startTime = Date.now();

  const goals = goalBits(level);
  const startBoxes = boxBits(level);
  const startPlayer = level.player;
  const corner = cornerDeadlockCells(level);
  const { cols, h, wall, goal } = level;
  const keyOf = (b) => b.toString();

  // visited: Set<boxesKey>（同一箱位布局只在首次（最小推数）出现时入队）
  const visited = new Set();
  // parent: Map<boxesKey, { boxes, dir }>（每个箱位布局的直接前驱唯一，无需玩家维度）
  const parent = new Map();

  // layer: Map<boxesKey, { anchor, moves }>——每箱位布局单锚点（推后玩家位置）
  let layer = new Map();
  layer.set(keyOf(startBoxes), { anchor: startPlayer, moves: 0 });
  visited.add(keyOf(startBoxes));

  let states = 0;
  let win = null; // { pushes, moves, boxes, player }

  outer: for (let pushes = 0; pushes <= maxPushes; pushes++) {
    if (layer.size === 0) break;
    const next = new Map(); // boxesKey -> { anchor, moves }
    let layerWin = null;

    for (const [bk, st] of layer) {
      if (Date.now() - startTime > timeLimit) break outer;
      if (++states > maxStates) break outer;
      const boxes = BigInt(bk);

      // 玩家可达区：单源 BFS（锚点为推后玩家位置，可站立性由上次推保证）
      const reach = new Uint8Array(cols * h);
      const dist = new Int32Array(cols * h).fill(-1);
      const q = [st.anchor];
      dist[st.anchor] = 0;
      let regionBits = 0n;
      for (let qi = 0; qi < q.length; qi++) {
        const p = q[qi];
        if (reach[p]) continue;
        reach[p] = 1;
        regionBits |= 1n << BigInt(p);
        for (const d of DIRS) {
          const n = p + d.dy * cols + d.dx;
          if (!inBounds(level, n) || wall[n] || ((boxes >> BigInt(n)) & 1n) || reach[n]) continue;
          if (dist[n] === -1) {
            dist[n] = dist[p] + 1;
            q.push(n);
          }
        }
      }
      if (regionBits === 0n) continue;

      // 胜利态检查（本层入队状态即可能已全在目标）
      if ((boxes & goals) === goals) {
        if (!layerWin || st.moves < layerWin.moves) layerWin = { boxes, player: st.anchor, moves: st.moves };
        continue;
      }

      // push 扩展
      const boxList = [];
      let bb = boxes;
      for (let i = 0; i < cols * h; i++) if ((bb >> BigInt(i)) & 1n) boxList.push(i);
      for (const b of boxList) {
        for (let d = 0; d < 4; d++) {
          const dir = DIRS[d];
          const front = b + dir.dy * cols + dir.dx;
          const behind = b - dir.dy * cols - dir.dx;
          if (!inBounds(level, front) || wall[front] || ((boxes >> BigInt(front)) & 1n)) continue;
          if (dist[behind] === -1) continue; // 人到不了推点
          if (!goal[front] && corner[front]) continue;
          const newBoxes = boxes ^ (1n << BigInt(b)) | (1n << BigInt(front));
          if (!goal[front] && freezeDeadState(newBoxes, level, corner)) continue;
          const nKey = keyOf(newBoxes);
          if (visited.has(nKey)) continue; // 更早层已探索（更小推数），跳过绕回
          visited.add(nKey);
          const newMoves = dist[behind] + 1;
          const old = next.get(nKey);
          if (!old || newMoves < old.moves) {
            next.set(nKey, { anchor: b, moves: newMoves });
            parent.set(nKey, { boxes, dir: d });
          }
          if ((newBoxes & goals) === goals) {
            if (!layerWin || newMoves < layerWin.moves) layerWin = { boxes: newBoxes, player: b, moves: newMoves };
          }
        }
      }
    }

    if (layerWin) {
      win = { pushes: pushes + 1, moves: layerWin.moves, boxes: layerWin.boxes, player: layerWin.player };
      break;
    }
    layer = next;
  }

  if (!win) {
    return { solvable: false, pushes: 0, moves: 0, path: [], states, timedOut: Date.now() - startTime > timeLimit };
  }

  // 回溯推箱方向序列（箱位布局链：每个布局的唯一直接前驱）
  const path = [];
  const pushedBoxes = []; // 每步被推箱的原位置（旧布局有、新布局无的位）
  let b = win.boxes;
  for (;;) {
    const rec = parent.get(keyOf(b));
    if (!rec) break;
    path.push(rec.dir);
    pushedBoxes.push(bitIndex(rec.boxes & ~b));
    b = rec.boxes;
  }
  path.reverse();
  pushedBoxes.reverse();
  return { solvable: true, pushes: win.pushes, moves: win.moves, path, pushedBoxes, states, timedOut: false };
}

// ============ IDA* 模式（验证/生成期最优推数证明） ============
// 适用于状态空间大、只需推数最优证明的场景（生成器批量验证）。
// 启发 h = 各箱到最近目标的曼哈顿距离之和（乐观下界：每推一次箱动一格，曼哈顿减 <=1）。
// bound 从 h(start) 递增；upperBound 给出已知解推数上界时收敛更快。
// 返回与 solve 同构；moves 为近似（= 推数），path 为推箱方向序列。
function solveIDA(level, opts = {}) {
  const timeLimit = opts.maxTimeMs ?? 90000;
  const upperBound = opts.upperBound ?? 300;
  const startTime = Date.now();
  const goals = goalBits(level);
  const startBoxes = boxBits(level);
  const startPlayer = level.player;
  const corner = cornerDeadlockCells(level);
  const { cols, h, wall, goal } = level;

  const goalCoords = [];
  for (let i = 0; i < cols * h; i++) if (goal[i]) goalCoords.push([i % cols, Math.floor(i / cols)]);
  const manhattan = new Int32Array(cols * h);
  for (let i = 0; i < cols * h; i++) {
    const x = i % cols, y = Math.floor(i / cols);
    let bd = 1e9;
    for (const [gx, gy] of goalCoords) bd = Math.min(bd, Math.abs(x - gx) + Math.abs(y - gy));
    manhattan[i] = bd;
  }
  const hOf = (boxes) => {
    let s = 0;
    for (let i = 0; i < cols * h; i++) if ((boxes >> BigInt(i)) & 1n) s += manhattan[i];
    return s;
  };
  const boxListOf = (boxes) => {
    const l = [];
    for (let i = 0; i < cols * h; i++) if ((boxes >> BigInt(i)) & 1n) l.push(i);
    return l;
  };

  const tt = new Map(); // key -> minDepth
  const keyOf = (b, p) => b.toString() + "|" + p;
  let states = 0;
  let found = null;

  function dfs(boxes, player, depth, path, pushed, bound) {
    if (Date.now() - startTime > timeLimit) return false;
    if ((boxes & goals) === goals) { found = { boxes, player, path: path.slice(), pushed: pushed.slice(), depth }; return true; }
    const k = keyOf(boxes, player);
    const prev = tt.get(k);
    if (prev !== undefined && prev <= depth) return false;
    tt.set(k, depth);
    if (++states > (opts.maxStates ?? 100_000_000)) return false;
    if (depth + hOf(boxes) > bound) return false;
    // 人可达区
    const reach = new Uint8Array(cols * h);
    const q = [player];
    reach[player] = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const p = q[qi];
      for (const d of DIRS) {
        const n = p + d.dy * cols + d.dx;
        if (!inBounds(level, n) || wall[n] || ((boxes >> BigInt(n)) & 1n) || reach[n]) continue;
        reach[n] = 1;
        q.push(n);
      }
    }
    for (const b of boxListOf(boxes)) {
      for (let d = 0; d < 4; d++) {
        const dir = DIRS[d];
        const front = b + dir.dy * cols + dir.dx;
        const behind = b - dir.dy * cols - dir.dx;
        if (!inBounds(level, front) || wall[front] || ((boxes >> BigInt(front)) & 1n)) continue;
        if (!reach[behind]) continue;
        if (!goal[front] && corner[front]) continue;
        const nb = boxes ^ (1n << BigInt(b)) | (1n << BigInt(front));
        if (!goal[front] && freezeDeadState(nb, level, corner)) continue;
        if (dfs(nb, b, depth + 1, path.concat(d), pushed.concat(bitIndex(boxes & ~nb)), bound)) return true;
      }
    }
    return false;
  }

  const h0 = hOf(startBoxes);
  for (let bound = h0; bound <= upperBound; bound++) {
    tt.clear();
    if (dfs(startBoxes, startPlayer, 0, [], [], bound)) break;
    if (Date.now() - startTime > timeLimit) break;
  }

  if (!found) {
    return { solvable: false, pushes: 0, moves: 0, path: [], states, timedOut: Date.now() - startTime > timeLimit };
  }
  return { solvable: true, pushes: found.depth, moves: found.depth, path: found.path, pushedBoxes: found.pushed, states, timedOut: false };
}

/**
 * 提示：返回当前局面的最优下一步推箱方向；不可解/超时返回 null。
 */
export function hintDir(level, opts = {}) {
  const res = solve(level, { maxTimeMs: opts.maxTimeMs ?? 2500, maxStates: opts.maxStates ?? 300_000 });
  if (!res.solvable || res.path.length === 0) return null;
  return res.path[0];
}
