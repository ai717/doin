// 关卡与难度参数。经典三档 + 预留自定义入口（P2 关卡制复用 resolveConfig）。
import { normalizeConfig } from "./engine.mjs";

export const DIFFICULTIES = [
  { id: "beginner", label: "初级", rows: 9, cols: 9, mines: 10 },
  { id: "intermediate", label: "中级", rows: 16, cols: 16, mines: 40 },
  { id: "expert", label: "高级", rows: 16, cols: 30, mines: 99 },
];

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) || null;
}

// 统一出口：传入 {difficulty} 走预设，传入 {rows, cols, mines} 走自定义。
// 一律经 normalizeConfig 夹取，非法参数不会产生越界棋盘。
export function resolveConfig(options = {}) {
  const preset = getDifficulty(options.difficulty);
  if (preset) return normalizeConfig(preset);
  return normalizeConfig(options);
}
