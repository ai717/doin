// filepath: games/sokoban/js/replay.mjs
// 测试辅助：把 solver 的"推箱方向序列"重放为完整可执行走步序列。
// 每步推前，从当前玩家位置 BFS 走到某只可推箱的推位（箱后一格），再执行推。
// 用于测试中验证 50 关按求解路径可通关、推数与 par 一致。
import { DIRS, inBounds, applyMove } from "./engine.mjs";

function walkable(map, i) {
  return inBounds(map, i) && !map.wall[i] && !map.box[i];
}

/** 返回当前局面下所有可推箱：{ boxIdx, playerStand, ahead } */
function pushCandidates(map) {
  const out = [];
  for (const d of DIRS) {
    for (let i = 0; i < map.box.length; i++) {
      if (!map.box[i]) continue;
      const stand = i - d.dy * map.cols - d.dx; // 玩家应站格
      const ahead = i + d.dy * map.cols + d.dx; // 箱将去的格
      if (!walkable(map, stand)) continue;
      if (!inBounds(map, ahead) || map.wall[ahead] || map.box[ahead]) continue;
      out.push({ dir: d.id, boxIdx: i, stand, ahead });
    }
  }
  return out;
}

/** BFS 从 from 到 to 的最短走步序列（不穿箱墙）；不可达返回 null */
function shortestWalk(map, from, to) {
  if (from === to) return [];
  const prev = new Int32Array(map.box.length).fill(-2);
  prev[from] = -1;
  const queue = [from];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (cur === to) break;
    for (const d of DIRS) {
      const j = cur + d.dy * map.cols + d.dx;
      if (!inBounds(map, j) || map.wall[j] || map.box[j]) continue;
      if (prev[j] !== -2) continue;
      prev[j] = cur;
      queue.push(j);
    }
  }
  if (prev[to] === -2) return null;
  // 回溯
  const steps = [];
  let cur = to;
  while (cur !== from) {
    const p = prev[cur];
    const dx = (cur % map.cols) - (p % map.cols);
    const dy = Math.floor(cur / map.cols) - Math.floor(p / map.cols);
    const d = DIRS.find((dd) => dd.dx === dx && dd.dy === dy);
    steps.unshift(d.id);
    cur = p;
  }
  return steps;
}

/**
 * 按推序列重放：返回完整走步序列；任何一步失败返回 null。
 * @param {*} level   parseLevel 初始地图
 * @param {number[]} pushPath solver 输出的推方向序列
 * @param {number[]} [pushedBoxes] 每步被推箱原位置（可选；缺省时按 dir 任选可推箱）
 * @returns {number[]|null} 完整走步序列（含推步），重放失败返回 null
 */
export function replayToSteps(level, pushPath, pushedBoxes) {
  let map = level;
  const steps = [];
  for (let k = 0; k < pushPath.length; k++) {
    const pushDir = pushPath[k];
    const targetBox = pushedBoxes ? pushedBoxes[k] : -1;
    // 选"方向匹配 + 箱位精确（若指定）"的最短可达推位
    let best = null;
    let bestWalk = null;
    for (const c of pushCandidates(map)) {
      if (c.dir !== pushDir) continue;
      if (targetBox >= 0 && c.boxIdx !== targetBox) continue;
      const walk = shortestWalk(map, map.player, c.stand);
      if (walk === null) continue;
      if (best === null || walk.length < bestWalk.length) {
        best = c;
        bestWalk = walk;
      }
    }
    if (!best) return null;
    for (const s of bestWalk) {
      steps.push(s);
      map = applyMove(map, s);
      if (!map) return null;
    }
    steps.push(pushDir);
    map = applyMove(map, pushDir);
    if (!map) return null;
  }
  return steps;
}

/** 执行走步序列，返回最终 map；非法返回 null */
export function applySteps(level, steps) {
  let map = level;
  for (const s of steps) {
    map = applyMove(map, s);
    if (!map) return null;
  }
  return map;
}
