/* filepath: games/one-line/js/engine.mjs */

// 每个规格下的关卡数量（小盘多、大盘少）
export const LEVELS_PER_SIZE = { 4: 20, 5: 20, 6: 15, 7: 15, 8: 10 };

// 取某规格的关卡数，未知规格回退到 6
export function levelsForSize(size) {
  return LEVELS_PER_SIZE[size] || 6;
}

// 可选盘面规格（小 → 大）
export const SIZES = [4, 5, 6, 7, 8];

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/**
 * 难度旋钮：t ∈ [0,1]，0 最易、1 最难。
 * - obstacleRatio：撒下的守护小动物占比，越高盘面越破碎
 * - windRate：走路径时"不按 Warnsdorff 最优走"的概率，越高路径越曲折
 * - targetTurnRatio：期望的转弯占比（转弯数 / 路径长度-2），越高越烧脑
 */
export function difficultyParams(t) {
  const d = Math.max(0, Math.min(1, t));
  return {
    // 目标障碍占比（撒下的 + 走不到的合计），是主线难度的主要旋钮
    targetObstacle: 0.06 + 0.14 * d,
    // 只影响路径风格（越绕越不像蛇形），不保证转弯占比
    windRate: 0.05 + 0.25 * d
  };
}

/** 主线关卡难度：随关卡号与盘面规格双升，且大盘面整体更难 */
export function levelDifficulty(size, levelNum) {
  const idx = Math.max(0, SIZES.indexOf(size));
  const maxLevels = levelsForSize(size);
  const within = (levelNum - 1) / Math.max(1, maxLevels - 1);
  return Math.max(0, Math.min(1, idx * 0.15 + within * 0.4));
}

/**
 * 无尽模式第 n 关（n 从 1 开始，无上限）：
 * 每关随机选一个盘面规格，按进度加权——越往后越大盘概率越高；seed 由 n 派生，
 * 确定性保证刷新/续接同一关号拿到的题完全一致（回到同一关号不会换题）。
 */
const ENDLESS_HORIZON = 50; // 约 50 关后几乎全是最大盘面
const ENDLESS_BIAS = 1.6;   // 前期对小规格的偏好强度
const ENDLESS_GROW = 1.3;   // 后期对大规格的放大强度

function endlessSizeWeights(n) {
  const progress = Math.min(1, (n - 1) / ENDLESS_HORIZON);
  return SIZES.map((sz, idx) =>
    Math.exp(-ENDLESS_BIAS * (1 - progress) * idx + ENDLESS_GROW * progress * idx)
  );
}

export function endlessSpec(n) {
  const rng = createPRNG(mixSeed(7, 13, n));
  const weights = endlessSizeWeights(n);
  const totalW = weights.reduce((a, b) => a + b, 0);
  let r = rng() * totalW;
  let size = SIZES[0];
  for (let i = 0; i < SIZES.length; i++) {
    r -= weights[i];
    if (r <= 0) { size = SIZES[i]; break; }
  }
  const idx = SIZES.indexOf(size);
  const difficulty = Math.min(1, 0.08 + (n - 1) * 0.011 + idx * 0.07);
  const seed = 1000003 + n * 7919 + idx * 104729;
  return { size, difficulty, seed };
}

/** 关卡画像：给测试与调试用的可量化指标 */
export function analyzeLevel(level) {
  const cells = level.solution.length;
  let turns = 0;
  for (let i = 2; i < cells; i++) {
    const [r0, c0] = level.solution[i - 2];
    const [r1, c1] = level.solution[i - 1];
    const [r2, c2] = level.solution[i];
    if (r1 - r0 !== r2 - r1 || c1 - c0 !== c2 - c1) turns++;
  }
  const total = level.rows * level.cols;
  return {
    cells,
    turns,
    turnRatio: cells >= 3 ? turns / (cells - 2) : 0,
    obstacleRatio: (total - cells) / total
  };
}

// 一次拖拽允许补齐的中间格上限，超过则判定为无效划动
const MAX_BRIDGE = 6;

// 确定性 PRNG（mulberry32）：同一 (rows, cols, seed) 永远产出同一道题
function createPRNG(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cellDegree(rows, cols, blocked, idx) {
  const r = (idx / cols) | 0;
  const c = idx % cols;
  let n = 0;
  for (let d = 0; d < 4; d++) {
    const nr = r + DIRS[d][0];
    const nc = c + DIRS[d][1];
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
    if (!blocked[nr * cols + nc]) n++;
  }
  return n;
}

/**
 * 把度数 ≤1 的自由格并入障碍：这种格子只可能是路径的首尾，留着必然走不满，
 * 反而会在盘面上留下无解的孤洞。剪完再走，覆盖率明显更高、题面更完整。
 */
function pruneDeadCells(rows, cols, blocked) {
  const total = rows * cols;
  for (;;) {
    let changed = false;
    for (let i = 0; i < total; i++) {
      if (blocked[i]) continue;
      if (cellDegree(rows, cols, blocked, i) <= 1) {
        blocked[i] = 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return blocked;
}

/** 兜底：蛇形满通路，任何参数下都保证有题可玩 */
function snakePath(rows, cols) {
  const path = [];
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) for (let c = 0; c < cols; c++) path.push(r * cols + c);
    else for (let c = cols - 1; c >= 0; c--) path.push(r * cols + c);
  }
  return path;
}

/** 路径转弯占比：转弯数 / (长度 - 2)，衡量路径有多绕 */
function turnRatioOfFlat(path) {
  if (path.length < 3) return 0;
  let turns = 0;
  for (let i = 2; i < path.length; i++) {
    if (Math.sign(path[i - 1] - path[i - 2]) !== Math.sign(path[i] - path[i - 1])) turns++;
  }
  return turns / (path.length - 2);
}

function mixSeed(rows, cols, seed) {
  let h = (rows * 374761393 + cols * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * 从随机起点走一条自避路径：每一步按 Warnsdorff（优先走"出路最少"的格子）
 * 并混入一定比例的纯随机选择，走出蛇形之外的折线风格。
 */
function longestPath(rows, cols, blocked, rng, start, budget, windRate = 0.05) {
  const total = rows * cols;
  const visited = new Uint8Array(total);
  const path = [];
  let best = [];
  let nodes = 0;

  function isFree(idx) {
    return !blocked[idx] && !visited[idx];
  }

  function onwardCount(idx) {
    const r = (idx / cols) | 0;
    const c = idx % cols;
    let n = 0;
    for (let d = 0; d < 4; d++) {
      const nr = r + DIRS[d][0];
      const nc = c + DIRS[d][1];
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (isFree(nr * cols + nc)) n++;
    }
    return n;
  }

  function dfs() {
    if (++nodes > budget) return;
    if (path.length > best.length) best = path.slice();

    const head = path[path.length - 1];
    const hr = (head / cols) | 0;
    const hc = head % cols;

    const cands = [];
    for (let d = 0; d < 4; d++) {
      const nr = hr + DIRS[d][0];
      const nc = hc + DIRS[d][1];
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const ni = nr * cols + nc;
      if (isFree(ni)) cands.push(ni);
    }
    if (cands.length === 0) return;

    if (cands.length > 1) {
      const scored = cands.map((i) => ({ i, deg: onwardCount(i), jitter: rng() }));
      scored.sort((x, y) => (x.deg - y.deg) || (x.jitter - y.jitter));
      for (let k = 0; k < cands.length; k++) cands[k] = scored[k].i;

      // 以 windRate 的概率把非最优候选提到最前：路径更曲折，转弯更多
      if (rng() < windRate) {
        const pick = 1 + Math.floor(rng() * (cands.length - 1));
        const first = cands[pick];
        cands[pick] = cands[0];
        cands[0] = first;
      }
    }

    for (let k = 0; k < cands.length; k++) {
      const ni = cands[k];
      visited[ni] = 1;
      path.push(ni);
      dfs();
      path.pop();
      visited[ni] = 0;
      if (nodes > budget) return;
    }
  }

  visited[start] = 1;
  path.push(start);
  dfs();
  return best;
}

/**
 * 保证可解的随机关卡生成：
 * 随机走一条自避路径作为真解，没走到的格子直接变成守护小动物（障碍）。
 * 解与题同时生成 —— 必定有解、必定连通、每一关形状都不同，且是 O(N) 的。
 */
export function generateGuaranteedLevel(rows, cols, seed = 1, difficulty = 0.5) {
  const total = rows * cols;
  const params = difficultyParams(difficulty);
  const rng = createPRNG(mixSeed(rows, cols, seed));

  // 总障碍 = 撒下的 + 路径走不到的。后者不可预知，所以用负反馈动态调整撒多少。
  // 小盘面上一格就是好几个百分点，撒 0 会让难度曲线塌掉，所以保留下限 1。
  const minScatter = total >= 9 ? 1 : 0;
  let kScatter = Math.max(minScatter, Math.round(total * params.targetObstacle));
  let bestPath = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < 6; attempt++) {
    const blocked = new Uint8Array(total);
    let placed = 0;
    while (placed < kScatter) {
      const i = Math.floor(rng() * total);
      if (!blocked[i]) {
        blocked[i] = 1;
        placed++;
      }
    }

    // 小盘面上剪枝会连锁吃掉一大片，剪掉超过四成就回滚
    const beforePrune = total - kScatter;
    const pruned = pruneDeadCells(rows, cols, blocked);
    let freeCount = 0;
    for (let i = 0; i < total; i++) if (!pruned[i]) freeCount++;
    if (freeCount < beforePrune * 0.6) {
      blocked.fill(0);
      let redo = 0;
      while (redo < kScatter) {
        const i = Math.floor(rng() * total);
        if (!blocked[i]) {
          blocked[i] = 1;
          redo++;
        }
      }
    }

    const free = [];
    for (let i = 0; i < total; i++) if (!blocked[i]) free.push(i);
    if (free.length < 6) {
      kScatter = Math.max(minScatter, kScatter - 1);
      continue;
    }

    // 每次尝试抖动曲折度，保证同难度下的题面也不重样
    const wind = Math.max(0, Math.min(0.5, params.windRate + ((attempt % 3) - 1) * 0.06));
    const start = free[Math.floor(rng() * free.length)];
    const path = longestPath(rows, cols, blocked, rng, start, 20000, wind);
    if (path.length < 4) {
      kScatter = Math.max(minScatter, kScatter - 1);
      continue;
    }

    const actual = (total - path.length) / total;
    const score = Math.abs(actual - params.targetObstacle);
    if (score < bestScore) {
      bestScore = score;
      bestPath = path;
    }
    if (score < 0.025) break;

    kScatter = Math.max(minScatter, Math.round(kScatter + (params.targetObstacle - actual) * total));
  }

  if (!bestPath) bestPath = snakePath(rows, cols);

  // 路径没走到的自由格同样变成小动物
  const finalBlocked = new Uint8Array(total).fill(1);
  for (const i of bestPath) finalBlocked[i] = 0;

  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const i of bestPath) grid[(i / cols) | 0][i % cols] = 1;

  const startCell = bestPath[0];
  return {
    id: seed,
    rows,
    cols,
    start: [(startCell / cols) | 0, startCell % cols],
    grid,
    solution: bestPath.map((i) => [(i / cols) | 0, i % cols])
  };
}

export class OneLineEngine {
  constructor(levelData) {
    this.init(levelData || generateGuaranteedLevel(4, 4, 1));
  }

  init(levelData) {
    this.levelId = levelData.id || 1;
    this.rows = levelData.rows;
    this.cols = levelData.cols;
    this.grid = levelData.grid.map((r) => [...r]);
    this.start = [...levelData.start];
    this.solution = levelData.solution ? levelData.solution.map((p) => [...p]) : [];

    this.targetCount = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === 1) this.targetCount++;
      }
    }

    this.path = [[...this.start]];
    this.pathIndex = new Map();
    this.pathIndex.set(`${this.start[0]},${this.start[1]}`, 0);

    // 评星口径：forwardCount 只增不减，走满 targetCount-1 步即完美路线
    this.forwardCount = 0;
    this.backtrackCount = 0;
    this.hintCount = 0;
    this.status = 'playing'; // 'playing' | 'clearing' | 'deadend' | 'won'
  }

  getCurrentNode() {
    if (this.path.length === 0) return null;
    return this.path[this.path.length - 1];
  }

  isAdjacent([r1, c1], [r2, c2]) {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  isValidCell(r, c) {
    return (
      r >= 0 &&
      r < this.rows &&
      c >= 0 &&
      c < this.cols &&
      this.grid[r][c] === 1
    );
  }

  checkDeadEnd() {
    if (this.status === 'won' || this.status === 'clearing') return false;
    if (this.path.length >= this.targetCount) return false;

    const current = this.getCurrentNode();
    if (!current) return false;

    const [cr, cc] = current;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (this.isValidCell(nr, nc) && !this.pathIndex.has(`${nr},${nc}`)) {
        return false;
      }
    }

    return true;
  }

  pushCell(r, c) {
    this.path.push([r, c]);
    this.pathIndex.set(`${r},${c}`, this.path.length - 1);
  }

  popCell() {
    const removed = this.path.pop();
    this.pathIndex.delete(`${removed[0]},${removed[1]}`);
    return removed;
  }

  /** 向前走一格，并同步状态机 */
  advanceTo(r, c) {
    this.pushCell(r, c);
    this.forwardCount++;

    if (this.path.length === this.targetCount) {
      this.status = 'clearing';
      return { success: true, kind: 'advance', clearing: true };
    }

    if (this.checkDeadEnd()) {
      this.status = 'deadend';
      return { success: true, kind: 'advance', deadEnd: true };
    }

    this.status = 'playing';
    return { success: true, kind: 'advance' };
  }

  /** 回退若干格。回退本身不计刻薄惩罚，但重走的步数会计入 forwardCount */
  backtrack(steps = 1) {
    const n = Math.min(steps, Math.max(0, this.path.length - 1));
    if (n === 0) return { success: false, reason: 'at_start_node' };

    for (let i = 0; i < n; i++) this.popCell();
    this.backtrackCount += n;
    this.status = this.checkDeadEnd() ? 'deadend' : 'playing';

    return { success: true, kind: 'back', steps: n };
  }

  /** 沿直线走一段，要求全程落在未走过的可走格上 */
  walkStraight([fr, fc], [tr, tc]) {
    const dr = Math.sign(tr - fr);
    const dc = Math.sign(tc - fc);
    if (dr !== 0 && dc !== 0) return null;

    const steps = Math.abs(tr - fr) + Math.abs(tc - fc);
    if (steps === 0 || steps > MAX_BRIDGE) return null;

    const line = [];
    let r = fr;
    let c = fc;
    for (let i = 0; i < steps; i++) {
      r += dr;
      c += dc;
      if (!this.isValidCell(r, c) || this.pathIndex.has(`${r},${c}`)) return null;
      line.push([r, c]);
    }
    return line;
  }

  /** 补齐中间格：优先直线，其次 L 形，总长度超过 MAX_BRIDGE 视为无效拖拽 */
  buildBridge(from, to) {
    const straight = this.walkStraight(from, to);
    if (straight) return straight;

    const corners = [[from[0], to[1]], [to[0], from[1]]];
    for (const corner of corners) {
      const head = this.walkStraight(from, corner);
      if (!head) continue;
      const tail = this.walkStraight(corner, to);
      if (!tail) continue;
      if (head.length + tail.length > MAX_BRIDGE) continue;
      return [...head, ...tail];
    }
    return null;
  }

  /**
   * 输入层唯一入口：把"玩家碰到哪个格子"翻译成引擎动作。
   * 覆盖四种意图：向前走 / 退回上一步 / 点已有路径跳退 / 快速滑动时补齐中间格。
   */
  moveToCell(r, c) {
    if (this.status === 'won' || this.status === 'clearing') {
      return { success: false, reason: 'game_already_completed' };
    }

    const current = this.getCurrentNode();
    if (!current) return { success: false, reason: 'no_current_node' };
    if (current[0] === r && current[1] === c) return { success: false, reason: 'same_cell' };

    if (!this.isValidCell(r, c)) {
      return { success: false, reason: 'animal_shelter_or_void' };
    }

    const key = `${r},${c}`;
    if (this.pathIndex.has(key)) {
      const idx = this.pathIndex.get(key);
      const steps = this.path.length - 1 - idx;
      if (steps === 0) return { success: false, reason: 'same_cell' };
      return this.backtrack(steps);
    }

    if (this.isAdjacent(current, [r, c])) return this.advanceTo(r, c);

    const route = this.buildBridge(current, [r, c]);
    if (!route) return { success: false, reason: 'not_adjacent' };

    for (let i = 0; i < route.length; i++) {
      this.advanceTo(route[i][0], route[i][1]);
      if (this.status === 'clearing' || this.status === 'deadend') break;
    }

    return {
      success: true,
      kind: 'bridge',
      length: route.length,
      clearing: this.status === 'clearing',
      deadEnd: this.status === 'deadend'
    };
  }

  setWon() {
    this.status = 'won';
  }

  /** 点击撤销按钮：与滑动回退共用 backtrack，保证评星口径一致 */
  undo() {
    if (this.status === 'won' || this.status === 'clearing') {
      return { success: false, reason: 'locked' };
    }
    return this.backtrack(1);
  }

  reset() {
    this.path = [[...this.start]];
    this.pathIndex.clear();
    this.pathIndex.set(`${this.start[0]},${this.start[1]}`, 0);
    this.forwardCount = 0;
    this.backtrackCount = 0;
    this.hintCount = 0;
    this.status = 'playing';
    return { success: true };
  }

  getState() {
    return {
      levelId: this.levelId,
      rows: this.rows,
      cols: this.cols,
      grid: this.grid,
      start: [...this.start],
      path: this.path.map((node) => [...node]),
      targetCount: this.targetCount,
      stepCount: this.path.length,
      forwardCount: this.forwardCount,
      backtrackCount: this.backtrackCount,
      hintCount: this.hintCount,
      status: this.status,
      solution: this.solution
    };
  }
}
