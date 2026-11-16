// 计分口径的唯一来源。UI 与结算面板只准读这里的数字，不许自己算。
//
// 单局得分 = 基础分 + 时间分（仅通关时计入）
//   基础分：按难度固定，越难越高 —— 反映雷区规模与求解复杂度。
//   时间分：越快越高，超过 par 归零，但绝不拉低基础分（基础分是保底）。
// 失败（踩雷）得 0 分，不入库计分、不破纪录。
//
// 注：combo（连击倍率）是后续独立特性，不在此模块内；本模块只负责
// "base + time" 这一稳定口径，保证任何 UI 拿到的分数口径一致。

export const DIFFICULTY_BASE = {
  beginner: 120,
  intermediate: 280,
  expert: 560,
};

// 各难度的"宽裕 par"：在此时间内清完拿满时间分，超出则线性衰减到 0。
export const DIFFICULTY_PAR_MS = {
  beginner: 30000,
  intermediate: 120000,
  expert: 300000,
};

export function baseFor(difficulty) {
  return DIFFICULTY_BASE[difficulty] ?? DIFFICULTY_BASE.beginner;
}

export function parMs(difficulty) {
  return DIFFICULTY_PAR_MS[difficulty] ?? DIFFICULTY_PAR_MS.beginner;
}

// 时间分单调递增于"越快"：ratio 1（瞬清）→ 满额，ratio 0（超过 par）→ 0。
// 用基础分的 0.6 倍作为时间分上限，保证总分区间稳定且不会盖过难度差异。
export function timeScore(elapsedMs, difficulty) {
  const par = parMs(difficulty);
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, (par - elapsedMs) / par));
  return Math.round(baseFor(difficulty) * 0.6 * ratio);
}

export function scoreResult(options = {}) {
  const outcome = options.outcome ?? "loss";
  const won = outcome === "win";
  const difficulty = options.difficulty ?? "beginner";
  const elapsedMs = Math.max(0, Math.trunc(options.elapsedMs ?? 0));
  const base = won ? baseFor(difficulty) : 0;
  const time = won ? timeScore(elapsedMs, difficulty) : 0;
  return { base, time, total: base + time };
}

// 结算面板的明细行：基础分 / 时间分 / 合计。
export function breakdown(options = {}) {
  const score = scoreResult(options);
  return [
    { key: "base", label: "基础分", value: score.base },
    { key: "time", label: "时间分", value: score.time },
    { key: "total", label: "合计得分", value: score.total },
  ];
}
