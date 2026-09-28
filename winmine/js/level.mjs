// 难度预设：严格对齐原版 WinMine 三档 + 自定义。
// 初级 9×9/10、中级 16×16/40、高级 30×16/99。
// 自定义：宽 9–30、高 9–24、雷 10–(宽-1)×(高-1)。

export const DIFFICULTY_IDS = ["beginner", "intermediate", "expert"];

export const PRESETS = {
  beginner: { name: "beginner", rows: 9, cols: 9, mines: 10 },
  intermediate: { name: "intermediate", rows: 16, cols: 16, mines: 40 },
  expert: { name: "expert", rows: 16, cols: 30, mines: 99 },
};

export function presetOf(difficulty) {
  return DIFFICULTY_IDS.includes(difficulty) ? PRESETS[difficulty] : null;
}

export function boardConfig(difficulty) {
  const p = presetOf(difficulty);
  return p ? { rows: p.rows, cols: p.cols, mines: p.mines } : null;
}

// 自定义参数归一化：越界回退到初级。返回可直接交给 engine 的 config。
export function customConfig({ rows, cols, mines }) {
  const r = Number(rows);
  const c = Number(cols);
  const m = Number(mines);
  if (!Number.isInteger(r) || !Number.isInteger(c) || !Number.isInteger(m)) return null;
  if (r < 9 || r > 24 || c < 9 || c > 30) return null;
  const max = (r - 1) * (c - 1);
  if (m < 10 || m > max) return null;
  return { rows: r, cols: c, mines: m };
}