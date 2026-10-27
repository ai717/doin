// filepath: games/ice-slide/js/solver.mjs
// 冰面推箱最优求解器：BFS，状态 = 箱位 BigInt bitset + 玩家位，每个方向一条边。
// 与 sokoban solver 的本质差异：冰面规则没有"推数/步数"之分——每次方向即一次完整滑行，
// 因此 BFS 层数就是最优步数（par），无需 push-number 分层，也无需层内玩家可达区归一。
// 剪枝：角落死局（非灯标箱被两面正交墙封死 -> 永不可动，与 sokoban 同理且可证安全）。
//       冻结传播在冰面语义下安全性不同（贴墙箱仍可沿墙滑行），暂不引入。
// DOM-free 纯函数模块，供关卡开发期批量验证与运行时提示共用。

import { DIRS, slide, isWon } from "./engine.mjs";

function boxBits(map) {
  let bits = 0n;
  for (let i = 0; i < map.box.length; i++) if (map.box[i]) bits |= 1n << BigInt(i);
  return bits;
}

function bitsToBox(bits, size) {
  const box = new Uint8Array(size);
  for (let i = 0; i < size; i++) if ((bits >> BigInt(i)) & 1n) box[i] = 1;
  return box;
}

// 角落死局格：非灯标格且存在两个正交方向均被墙封死（该格上的箱永不可动）
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

function isDeadlocked(bits, corner, goal, size) {
  for (let i = 0; i < size; i++) {
    if ((bits >> BigInt(i)) & 1n) {
      if (corner[i] && !goal[i]) return true;
    }
  }
  return false;
}

// 求解关卡。返回 { solvable, optimal, dirs, states }：
//   solvable = true  -> optimal 为最优步数，dirs 为一条最优方向序列（dirId 数组）
//   solvable = false -> BFS 耗尽，确实无解
//   solvable = null  -> 触发 maxStates 保险丝（状态数异常，调用方应视为未知而非无解）
export function solve(level, opts = {}) {
  const maxStates = opts.maxStates ?? 3_000_000;
  const corner = cornerDeadlockCells(level);
  const size = level.cols * level.h;
  const span = BigInt(size);
  const startBits = boxBits(level);
  if (isWon(level)) return { solvable: true, optimal: 0, dirs: [], states: 1 };
  const startKey = startBits * span + BigInt(level.player);
  const visited = new Set([startKey]);
  const parent = new Map();
  const queue = [{ bits: startBits, player: level.player }];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (visited.size > maxStates) {
      return { solvable: null, optimal: null, dirs: null, states: visited.size, reason: "state-limit" };
    }
    const st = {
      cols: level.cols,
      h: level.h,
      wall: level.wall,
      goal: level.goal,
      box: bitsToBox(cur.bits, size),
      player: cur.player,
      won: false,
    };
    const curKey = cur.bits * span + BigInt(cur.player);
    for (const d of DIRS) {
      const nx = slide(st, d.id);
      if (!nx) continue;
      const nb = boxBits(nx);
      if (isDeadlocked(nb, corner, level.goal, size)) continue;
      const k = nb * span + BigInt(nx.player);
      if (visited.has(k)) continue;
      visited.add(k);
      parent.set(k, { prev: curKey, dir: d.id });
      if (nx.won) {
        const dirs = [];
        let kk = k;
        while (kk !== startKey) {
          const link = parent.get(kk);
          dirs.push(link.dir);
          kk = link.prev;
        }
        dirs.reverse();
        return { solvable: true, optimal: dirs.length, dirs, states: visited.size };
      }
      queue.push({ bits: nb, player: nx.player });
    }
  }
  return { solvable: false, optimal: null, dirs: null, states: visited.size };
}

// 便捷封装：只取最优步数（关卡 par）
export function par(level, opts) {
  const r = solve(level, opts);
  return r.solvable === true ? r.optimal : null;
}

// 运行时提示：从任意当前局面（初始局或游戏中局）求最优下一步。
// 返回：
//   { won: false, dir, optimal, dirs }      -> 有解，dir 为最优方向序列首方向（游戏内 dirId）
//   { won: false, dir: null, solvable: false, reason } -> 死局（箱入死角等），UI 应提示撤销/重开
//   { won: false, dir: null, solvable: null }          -> 触发状态数保险丝，静默不提示
//   { won: true, dir: null, optimal: 0, dirs: [] }     -> 已通关
// 依赖字段与 solve 相同：{ cols, h, wall, goal, box, player }，engine 产出的任意状态均可直接传入。
export function hint(state, opts = {}) {
  if (isWon(state)) return { won: true, dir: null, optimal: 0, dirs: [] };
  const r = solve(state, opts);
  if (r.solvable === true) {
    return { won: false, dir: r.dirs[0], optimal: r.optimal, dirs: r.dirs };
  }
  if (r.solvable === null) {
    return { won: false, dir: null, solvable: null, reason: r.reason };
  }
  return { won: false, dir: null, solvable: false, reason: r.reason ?? "exhausted" };
}
