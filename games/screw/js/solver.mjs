/**
 * @file games/screw/js/solver.mjs
 * 拧螺丝解谜 · 确定性拓扑求解器（DOM-free）
 *
 * 在给定收纳盒队列与备用孔容量下，用带记忆化的深度优先搜索验证：
 * 是否存在一条把所有螺栓全部装箱的合法顺序。
 * 求解器的状态键 = 已拆除螺栓位图 + 当前盒序号 + 当前盒已收集数；
 * 备用孔内容由前两者唯一推导，因此无需额外状态。
 */

import { BOX_SIZE, COLORS, createState, unscrew, screwKey } from './engine.mjs';

function plateCoversCell(plate, cell) {
  return plate.cells.some((owned) => owned.c === cell.c && owned.r === cell.r);
}

function buildModel(level) {
  const plates = level.plates.map((plate, index) => ({
    index,
    id: plate.id,
    layer: plate.layer,
    cells: plate.cells.map(([c, r]) => ({ c, r })),
  }));

  const screws = [];
  const plateOf = [];
  const colors = [];
  const cellOf = [];
  const ids = [];
  const plateScrewIndices = plates.map(() => []);

  level.plates.forEach((plate, plateIndex) => {
    plate.holes.forEach(([c, r, color], holeIndex) => {
      const screwIndex = screws.length;
      screws.push({ c, r, color, plateIndex });
      plateOf.push(plateIndex);
      colors.push(color);
      cellOf.push({ c, r });
      ids.push(screwKey(plate.id, holeIndex));
      plateScrewIndices[plateIndex].push(screwIndex);
    });
  });

  const blockers = screws.map((screw, screwIndex) =>
    plates
      .filter((plate) => plate.layer > plates[plateOf[screwIndex]].layer && plateCoversCell(plate, screw))
      .map((plate) => plate.index),
  );

  return { plates, screws, plateOf, colors, cellOf, ids, plateScrewIndices, blockers };
}

function colorIndexMap() {
  const map = new Map();
  COLORS.forEach((color, index) => map.set(color, index));
  return map;
}

/**
 * 求解关卡。
 * @param {object} level
 * @param {object} options { seed, maxNodes, preferBuffer }
 * @returns {{solution:number[]|null, bufferMoves:number, swings:number, falls:number, nodes:number, aborted:boolean}}
 */
export function solveLevel(level, options = {}) {
  const model = buildModel(level);
  const n = model.screws.length;
  const totalBoxes = level.boxQueue.length;
  const cap = level.bufferCapacity;
  const colorIndex = colorIndexMap();
  const colorCount = COLORS.length;
  const seeds = options.seed === undefined ? 1 : options.seed;
  const maxNodes = options.maxNodes === undefined ? 400000 : options.maxNodes;
  const preferBuffer = Boolean(options.preferBuffer);

  // 每块板材初始螺栓数
  const rem = model.plateScrewIndices.map((list) => list.length);
  const removedColorCounts = new Array(colorCount).fill(0);

  // boxesBefore[color][k] = 前 k 个收纳盒中该颜色的盒数
  const boxesBefore = COLORS.map(() => new Array(totalBoxes + 1).fill(0));
  for (let k = 0; k < totalBoxes; k += 1) {
    for (let ci = 0; ci < colorCount; ci += 1) {
      boxesBefore[ci][k + 1] = boxesBefore[ci][k];
    }
    const ci = colorIndex.get(level.boxQueue[k]);
    if (ci !== undefined) boxesBefore[ci][k + 1] += 1;
  }

  const failed = new Set();
  let nodes = 0;
  let aborted = false;

  function bufferedTotal(boxIndex, collected) {
    let total = 0;
    for (let ci = 0; ci < colorCount; ci += 1) {
      const activeColorIndex = boxIndex < totalBoxes ? colorIndex.get(level.boxQueue[boxIndex]) : -1;
      const boxed = BOX_SIZE * boxesBefore[ci][boxIndex] + (activeColorIndex === ci ? collected : 0);
      const buffered = removedColorCounts[ci] - boxed;
      if (buffered > 0) total += buffered;
    }
    return total;
  }

  function bufferedOf(ci, boxIndex, collected) {
    const boxed = BOX_SIZE * boxesBefore[ci][boxIndex] + (boxIndex < totalBoxes && colorIndex.get(level.boxQueue[boxIndex]) === ci ? collected : 0);
    return removedColorCounts[ci] - boxed;
  }

  function autoInflow(boxIndex, collected) {
    let nb = boxIndex;
    let nc = collected;
    let guard = 0;
    while (nb < totalBoxes && guard < 128) {
      guard += 1;
      const ci = colorIndex.get(level.boxQueue[nb]);
      if (ci === undefined) break;
      const buffered = bufferedOf(ci, nb, nc);
      if (buffered <= 0) break;
      const room = BOX_SIZE - nc;
      if (room <= 0) {
        nb += 1;
        nc = 0;
        continue;
      }
      const take = Math.min(room, buffered);
      nc += take;
      if (nc >= BOX_SIZE) {
        nb += 1;
        nc = 0;
      } else {
        break;
      }
    }
    return { boxIndex: nb, collected: nc };
  }

  function accessible(screwIndex, removedMask) {
    if ((removedMask & (1 << screwIndex)) !== 0) return false;
    const plateIndex = model.plateOf[screwIndex];
    if (rem[plateIndex] <= 0) return false;
    for (const blocker of model.blockers[screwIndex]) {
      if (rem[blocker] >= 2) return false;
    }
    return true;
  }

  function shuffledCandidates(list, seedValue) {
    const rng = mulberry32(seedValue);
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function dfs(removedMask, boxIndex, collected, depth, path, bufferMoves, swings, falls) {
    nodes += 1;
    if (nodes > maxNodes) {
      aborted = true;
      return null;
    }
    if (depth === n) {
      if (boxIndex >= totalBoxes) {
        return { solution: [...path], bufferMoves, swings, falls };
      }
      return null;
    }

    const key = `${removedMask}|${boxIndex}|${collected}`;
    if (failed.has(key)) return null;

    const activeColor = boxIndex < totalBoxes ? level.boxQueue[boxIndex] : null;
    const buffered = bufferedTotal(boxIndex, collected);

    const candidates = [];
    for (let i = 0; i < n; i += 1) {
      if (accessible(i, removedMask)) candidates.push(i);
    }

    shuffledCandidates(candidates, seeds + depth * 131 + removedMask * 17 + boxIndex * 7 + collected);

    candidates.sort((a, b) => {
      const am = activeColor && model.colors[a] === activeColor ? 0 : 1;
      const bm = activeColor && model.colors[b] === activeColor ? 0 : 1;
      if (preferBuffer) return bm - am;
      return am - bm;
    });

    for (const screwIndex of candidates) {
      const color = model.colors[screwIndex];
      const matching = Boolean(activeColor && color === activeColor);
      if (!matching && buffered >= cap) continue;

      const plateIndex = model.plateOf[screwIndex];
      const beforeRemaining = rem[plateIndex];
      removedMask |= 1 << screwIndex;
      rem[plateIndex] -= 1;
      const ci = colorIndex.get(color);
      if (ci !== undefined) removedColorCounts[ci] += 1;
      path.push(screwIndex);

      let nb = boxIndex;
      let nc = collected;
      if (matching) {
        nc += 1;
        if (nc >= BOX_SIZE) {
          const inflow = autoInflow(nb + 1, 0);
          nb = inflow.boxIndex;
          nc = inflow.collected;
        }
      }

      const nextSwings = swings + (beforeRemaining === 2 ? 1 : 0);
      const nextFalls = falls + (beforeRemaining === 1 ? 1 : 0);
      const nextBufferMoves = bufferMoves + (matching ? 0 : 1);

      const solved = dfs(
        removedMask,
        nb,
        nc,
        depth + 1,
        path,
        nextBufferMoves,
        nextSwings,
        nextFalls,
      );
      if (solved) return solved;

      path.pop();
      if (ci !== undefined) removedColorCounts[ci] -= 1;
      rem[plateIndex] = beforeRemaining;
      removedMask &= ~(1 << screwIndex);
    }

    failed.add(key);
    return null;
  }

  const solved = dfs(0, 0, 0, 0, [], 0, 0, 0);
  return {
    solution: solved ? solved.solution : null,
    bufferMoves: solved ? solved.bufferMoves : 0,
    swings: solved ? solved.swings : 0,
    falls: solved ? solved.falls : 0,
    nodes,
    aborted,
  };
}

/**
 * 用真实引擎逐指令回放求解结果，验证求解器与引擎口径完全一致。
 * @returns {{ok:boolean, screwIds:string[], problem:string|null}}
 */
export function replaySolution(level, solution) {
  const model = buildModel(level);
  let state = createState(level);
  const screwIds = [];

  for (const screwIndex of solution) {
    const id = model.ids[screwIndex];
    screwIds.push(id);
    const result = unscrew(state, id);
    if (!result.action) {
      return { ok: false, screwIds, problem: `illegal:${id}` };
    }
    state = result.state;
  }

  if (state.status !== 'won') {
    return { ok: false, screwIds, problem: `status:${state.status}` };
  }
  return { ok: true, screwIds, problem: null };
}

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
