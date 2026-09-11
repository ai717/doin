// 无猜求解器：纯函数。提供两类能力
//  1) 生成期保证：pickNoGuessSeed 在首击时挑一个"全程可逻辑推导"的雷布局
//  2) 运行时兜底：findSafeCell 在任意局面下证明一个安全格，
//     若仍有安全格未揭但证明不出 → 由 game.mjs 触发"免费透视"（永不用运气决定胜负）
//
// 采用基础单点规则（1-2-3）：对每格已揭数字，
//   剩余雷数 = 数字 − 已标旗数
//   剩余雷数 === 0        → 所有隐藏邻居安全
//   剩余雷数 === 隐藏邻居数 → 所有隐藏邻居是雷
// 配合"已标雷数 === 总雷数 → 余下隐藏格皆安全"的全局约束，迭代到不动点。
// 该规则集是经典无猜生成器的标准做法：推不出即视为需要猜测，重采样。

import {
  FLAGGED,
  HIDDEN,
  REVEALED,
  STATUS_LOST,
  STATUS_PLAYING,
  STATUS_WON,
  createState,
  neighborTable,
  placeMines,
  reveal,
  toggleFlag,
} from "./engine.mjs";

// 对当前局面做一次推理，返回隐藏格中已证明的 安全/雷 集合。
// 推理是"单调且可靠"的：返回的集合里不会有假阳性。
// 规则分两层：
//   1) 单点（1-2-3）：某数字格的隐藏邻数 == 剩余雷数 → 全安全/全雷
//   2) 子集（1-2-1 / 1-2-2-1 等）：若 A 的隐藏邻集合 ⊆ B 的隐藏邻集合，
//      则 B 的"额外"隐藏邻里恰好含 (countB − countA) 颗雷 → 可整体判定
export function deduce(state) {
  const table = neighborTable(state.rows, state.cols);
  const safe = [];
  const mines = [];
  const seenSafe = new Set();
  const seenMine = new Set();

  const claimSafe = (n) => {
    if (!seenSafe.has(n)) {
      seenSafe.add(n);
      safe.push(n);
    }
  };
  const claimMine = (n) => {
    if (!seenMine.has(n)) {
      seenMine.add(n);
      mines.push(n);
    }
  };

  // 收集每个已揭数字格的隐藏邻集合与剩余雷数
  const clues = [];
  for (let i = 0; i < state.cellState.length; i += 1) {
    if (state.cellState[i] !== REVEALED) continue;
    const count = state.adjacency[i];
    if (count <= 0) continue; // 0 或雷格（-1）不参与推理

    let flags = 0;
    const hiddenNeighbors = [];
    for (const n of table[i]) {
      const cs = state.cellState[n];
      if (cs === FLAGGED) flags += 1;
      else if (cs === HIDDEN) hiddenNeighbors.push(n);
    }
    const remaining = count - flags;
    if (hiddenNeighbors.length === 0) continue;

    // 单点规则
    if (remaining === 0) {
      for (const n of hiddenNeighbors) claimSafe(n);
    } else if (remaining === hiddenNeighbors.length) {
      for (const n of hiddenNeighbors) claimMine(n);
    }
    clues.push({ i, remaining, hidden: hiddenNeighbors });
  }

  // 子集规则：仅在两格隐藏邻集合有包含关系时判定，保证可靠。
  for (let a = 0; a < clues.length; a += 1) {
    for (let b = a + 1; b < clues.length; b += 1) {
      const A = clues[a];
      const B = clues[b];
      if (A.hidden.length === 0 || B.hidden.length === 0) continue;
      const [small, large] = A.hidden.length <= B.hidden.length ? [A, B] : [B, A];
      if (small.hidden.length === large.hidden.length) continue; // 等大小不在此判定
      // 检查 small.hidden ⊆ large.hidden
      let subset = true;
      for (const n of small.hidden) {
        if (!large.hidden.includes(n)) {
          subset = false;
          break;
        }
      }
      if (!subset) continue;

      const extraMines = large.remaining - small.remaining;
      const extra = large.hidden.filter((n) => !small.hidden.includes(n));
      if (extraMines < 0) continue;
      if (extraMines === 0) {
        for (const n of extra) claimSafe(n);
      } else if (extraMines === extra.length) {
        for (const n of extra) claimMine(n);
      }
    }
  }
  return { safe, mines };
}

function countFlagged(state) {
  let n = 0;
  for (let i = 0; i < state.cellState.length; i += 1) {
    if (state.cellState[i] === FLAGGED) n += 1;
  }
  return n;
}

function anyHidden(state) {
  for (let i = 0; i < state.cellState.length; i += 1) {
    if (state.cellState[i] === HIDDEN) return true;
  }
  return false;
}

// 把推理结果应用到状态（标雷 + 揭安全），返回新状态；无进展则原样返回。
function applyDeductions(state, { safe, mines }) {
  let ns = state;
  for (const m of mines) {
    if (ns.cellState[m] !== FLAGGED) ns = toggleFlag(ns, m);
  }
  for (const c of safe) {
    if (ns.cellState[c] === HIDDEN) ns = reveal(ns, c);
  }
  return ns;
}

// 从给定局面出发，纯逻辑迭代求解，直到胜利 / 走入死局 / 矛盾。
// 返回 { solvable, won, stuck, contradict }。
export function analyze(state) {
  let s = state;
  if (s.status === STATUS_WON) return { solvable: true, won: true, stuck: false, contradict: false };
  if (s.status !== STATUS_PLAYING) return { solvable: false, won: false, stuck: false, contradict: false };

  const maxGuard = s.rows * s.cols * 4 + 200;
  let guard = 0;
  while (guard < maxGuard) {
    guard += 1;
    const d = deduce(s);

    // 矛盾：推理出的雷数超过总雷数 → 该布局逻辑不自洽
    if (d.mines.length > s.mines) return { solvable: false, won: false, stuck: false, contradict: true };

    // 全局约束：已标雷数已达上限 → 余下隐藏格都是安全的
    const flagged = countFlagged(s);
    if (flagged >= s.mines && anyHidden(s)) {
      for (let i = 0; i < s.cellState.length; i += 1) {
        if (s.cellState[i] === HIDDEN) s = reveal(s, i);
      }
      if (s.status === STATUS_WON) return { solvable: true, won: true, stuck: false, contradict: false };
      if (s.status === STATUS_LOST) return { solvable: false, won: false, stuck: false, contradict: false };
    }

    const ns = applyDeductions(s, d);
    if (ns === s) return { solvable: false, won: false, stuck: true, contradict: false };

    s = ns;
    if (s.status === STATUS_WON) return { solvable: true, won: true, stuck: false, contradict: false };
    if (s.status === STATUS_LOST) return { solvable: false, won: false, stuck: false, contradict: false };
  }
  return { solvable: false, won: false, stuck: true, contradict: false };
}

// 生成期用：该布局从首击后能否纯逻辑通关。
export function isNoGuessSolvable(state) {
  return analyze(state).solvable;
}

// 运行时用：若存在一个可证明的安全隐藏格，返回其索引；否则 null。
// 在不动点迭代中一旦找到安全格立即返回，避免无谓展开。
export function findSafeCell(state) {
  let s = state;
  if (s.status !== STATUS_PLAYING) return null;

  const maxGuard = s.rows * s.cols * 4 + 200;
  let guard = 0;
  while (guard < maxGuard) {
    guard += 1;
    const d = deduce(s);
    if (d.safe.length) return d.safe[0];

    if (d.mines.length > s.mines) return null; // 矛盾，理论上不该发生在已生成布局

    const flagged = countFlagged(s);
    if (flagged >= s.mines && anyHidden(s)) {
      for (let i = 0; i < s.cellState.length; i += 1) {
        if (s.cellState[i] === HIDDEN) return i;
      }
      return null;
    }

    const ns = applyDeductions(s, d);
    if (ns === s) return null; // 无进展 → 当前无证明得出安全格
    s = ns;
    if (s.status === STATUS_WON || s.status === STATUS_LOST) return null;
  }
  return null;
}

// 首击用：在首击格固定的前提下，挑选一个"无猜可解"的种子。
// 以 baseSeed 为起点线性探测，命中即返回；超过上限则退化为 baseSeed
// （极端密度下可能仍需猜测，但经典三档命中率接近 100%）。
export function pickNoGuessSeed(config, firstIndex, baseSeed = 1) {
  const base = (Number(baseSeed) >>> 0) || 1;
  const LIMIT = 400;
  for (let attempt = 0; attempt < LIMIT; attempt += 1) {
    const seed = (base + attempt * 0x9e3779b1) >>> 0;
    const s0 = createState({ ...config, seed });
    const placed = placeMines(s0, firstIndex);
    if (placed === s0) continue; // 首击索引非法
    const opened = reveal(placed, firstIndex);
    if (opened.status !== STATUS_PLAYING) continue; // 安全区保证不会踩雷，防御性
    if (isNoGuessSolvable(opened)) return seed;
  }
  return base >>> 0;
}
