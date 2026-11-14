// 传送门推箱 BFS 求解器：在「人物位置 + 箱子坐标集合」的有限状态空间上做最短路搜索。
// 仅用于关卡验证、官方最优步数与测试，不参与实时渲染。

import { DIRECTIONS, createState, stateKey, step } from "./engine.mjs";

export function solve(level, options = {}) {
  const start = createState(level);
  if (!start) return { solvable: false, optimal: null, moves: [], states: 0, reason: "invalid" };
  const limit = Math.max(1000, Math.trunc(options.limit ?? 400000));
  const startKey = stateKey(start);
  if (start.solved) return { solvable: true, optimal: 0, moves: [], states: 1 };

  const depth = new Map([[startKey, 0]]);
  const parent = new Map();
  const action = new Map();
  const queue = [start];
  let head = 0;

  while (head < queue.length && depth.size < limit) {
    const current = queue[head];
    head += 1;
    const currentKey = stateKey(current);
    const currentDepth = depth.get(currentKey);
    for (const dir of DIRECTIONS) {
      const next = step(current, dir);
      if (!next || !next.lastMove?.moved) continue;
      const key = stateKey(next);
      if (depth.has(key)) continue;
      depth.set(key, currentDepth + 1);
      parent.set(key, currentKey);
      action.set(key, dir);
      if (next.solved) {
        const moves = [];
        let cursor = key;
        while (action.has(cursor)) {
          moves.push(action.get(cursor));
          cursor = parent.get(cursor);
        }
        moves.reverse();
        return { solvable: true, optimal: currentDepth + 1, moves, states: depth.size };
      }
      queue.push(next);
    }
  }

  return {
    solvable: false,
    optimal: null,
    moves: [],
    states: depth.size,
    reason: depth.size >= limit ? "limit" : "exhausted",
  };
}

export function replay(level, moves) {
  let state = createState(level);
  if (!state) return null;
  for (const dir of moves) state = step(state, dir);
  return state;
}

export function solveAll(levels, options = {}) {
  return levels.map((level) => ({ level: level.id, ...solve(level, options) }));
}
