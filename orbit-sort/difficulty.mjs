// orbit-sort 难度模型 (用户参数边界 2026-09-02)
//
// 硬边界（任何生成不得逾越）：
//   capacity  ∈ 3..7     容量最低3，最多7
//   colorCount ∈ 3..6    颜色最低3，最多6（渲染调色板只提供 6 色）
//   dockCount  ∈ 1..2    中转槽常规 1，仅在增难度缓冲时给 2
//   emptyCount = 1       空轨道只能有 1 条
//   totalTracks = colorCount + 1 ≤ 8 → colorCount ≤ 7（结合调色板上限实际 ≤ 6）
//   totalOrbs = capacity × colorCount  最低 6（最小 3×3=9 满足）
//
// 难度度量：缓冲比 bufferRatio = (dockCount×capacity + empty×capacity) / (cap×colorCount)
//                                   = (dockCount + 1) / colorCount
//   dock=1  dock=2
//   col=3    67%    100%
//   col=4    50%     75%
//   col=5    40%     60%
//   col=6    33%     50%
//
// 主线 7 关渐进策略：
//   * 新参数(容量或颜色)首次出现 → dock=2 给玩家缓冲过渡
//   * 下一关 → dock=1 收回缓冲，真正加压
//
//   D1  3×3  dock=2  → 入门：r=100%，从容
//   D2  3×3  dock=1  → 收回 dock，r=67%
//   D3  4×3  dock=2  → 首次 cap=4，给 2dock
//   D4  4×3  dock=1  → 收回 dock
//   D5  4×4  dock=2  → 首次 col=4，给 2dock
//   D6  5×4  dock=1  → 首次 cap=5 + 收回 dock
//   D7  5×5  dock=2  → 首次 col=5，给 2dock
//
// 8 关及以上按 D1..D7 模式线性外推：

export function paramsForDifficulty(difficultyLevel) {
  const D = Math.max(1, Number.isFinite(difficultyLevel) ? difficultyLevel : 1);
  const P = (p) => ({ ...p, emptyCount: 1, difficulty: D });

  // Explicit mainline table.
  if (D === 1) return P({ capacity: 3, colorCount: 3, dockCount: 2 });
  if (D === 2) return P({ capacity: 3, colorCount: 3, dockCount: 1 });
  if (D === 3) return P({ capacity: 4, colorCount: 3, dockCount: 2 });
  if (D === 4) return P({ capacity: 4, colorCount: 3, dockCount: 1 });
  if (D === 5) return P({ capacity: 4, colorCount: 4, dockCount: 2 });
  if (D === 6) return P({ capacity: 5, colorCount: 4, dockCount: 1 });
  if (D === 7) return P({ capacity: 5, colorCount: 5, dockCount: 2 });

  // D8+: 外推。每 2 级：升容量；再 2 级：升颜色。dock 在 2/1 之间交替。
  // capacity 封顶 7，colorCount 封顶 6（调色板物理上限）。
  const steps = D - 7;
  const baseCap = Math.min(7, 5 + Math.floor(steps / 3));
  const baseCol = Math.min(6, 5 + Math.floor((steps + 1) / 3));
  const dock = (steps % 2 === 0) ? 1 : 2;
  const colorCount = Math.min(baseCol, baseCap + 2);
  const capacity = Math.min(7, Math.max(3, baseCap));
  return { capacity, colorCount, dockCount: dock, emptyCount: 1, difficulty: D };
}

export function totalOrbs(p)     { return p.capacity * p.colorCount; }
export function totalTracks(p)   { return p.colorCount + 1; /* emptyCount=1 */ }
export function bufferOrbs(p)    { return (p.dockCount + 1) * p.capacity; }
export function bufferRatio(p)   { return bufferOrbs(p) / totalOrbs(p); }
export const HARD_LIMITS = Object.freeze({
  minCapacity: 3, maxCapacity: 7,
  minColorCount: 3, maxColorCount: 6,
  dockCounts: [1, 2],
  emptyCount: 1,
  maxTracks: 8,
});
