// 叠叠乐 · 关卡与机关数据层（纯数据：只允许字符串 key 与数值，严禁裸写中文）
//
// 层数换算铁律：初始 18 层且顶层已满 → 第 1 次落位即起第 19 层，
// 于是 layers(layers 目标) = 18 + ceil(moves / 3)，即「目标 L 层」等价于「moves ≥ 3×(L-18)」。
// 54 块、每层至少 2 块 ⇒ 层数物理上限 MAX_LAYERS = 27，关卡目标绝不可越过这条线。
//
// 机关（逐章引入，PRD 拍板项 3 选项 A）：
//   autoStack —— 第 1 章自动落位（替新手挑质心最稳的槽），第 2 章起解锁「堆叠选位」；
//   loadMarks —— 承重块标记：中文 chalk 圈标出的块抽了必倒，考验绕行；
//   gust      —— 阵风机：每 gustPeriod 秒一阵侧风，塔身微晃。

export const MAX_LAYERS = 27;
export const CHAPTER_COUNT = 4;
export const LEVELS_PER_CHAPTER = 6;
export const TOTAL_LEVELS = CHAPTER_COUNT * LEVELS_PER_CHAPTER;
export const RIDDLE_QUESTIONS = 10;
export const DUEL_WIN_TARGET = 2; // 三局两胜

export const GOAL_MOVES = "moves";
export const GOAL_LAYERS = "layers";

export const HAZARD_GUST = "gust";
export const HAZARD_LOAD = "load";

const SPEC = [
  // 第 1 章 · 入门抽块（自动落位，先学会读塔找端头安全块）
  { goal: GOAL_MOVES, target: 5, streak: 0, par: 3 },
  { goal: GOAL_MOVES, target: 6, streak: 0, par: 3 },
  { goal: GOAL_MOVES, target: 7, streak: 0, par: 4 },
  { goal: GOAL_MOVES, target: 8, streak: 0, par: 4 },
  { goal: GOAL_MOVES, target: 9, streak: 0, par: 5 },
  { goal: GOAL_MOVES, target: 10, streak: 0, par: 5 },
  // 第 2 章 · 重心博弈（解锁堆叠选位：槽位决定质心，目标是越垒越高）
  { goal: GOAL_LAYERS, target: 20, streak: 0, par: 4 },
  { goal: GOAL_LAYERS, target: 21, streak: 0, par: 4 },
  { goal: GOAL_LAYERS, target: 21, streak: 0, par: 5 },
  { goal: GOAL_LAYERS, target: 22, streak: 0, par: 5 },
  { goal: GOAL_LAYERS, target: 22, streak: 0, par: 6 },
  { goal: GOAL_LAYERS, target: 23, streak: 0, par: 6 },
  // 第 3 章 · 结构微操（承重块标记 + 阵风机）
  { goal: GOAL_MOVES, target: 8, streak: 0, par: 4, gust: 0.02, loadMarks: 2 },
  { goal: GOAL_MOVES, target: 10, streak: 0, par: 5, gust: 0.02, loadMarks: 2 },
  { goal: GOAL_MOVES, target: 11, streak: 0, par: 5, gust: 0.024, loadMarks: 3 },
  { goal: GOAL_MOVES, target: 12, streak: 0, par: 6, gust: 0.024, loadMarks: 3 },
  { goal: GOAL_MOVES, target: 13, streak: 0, par: 6, gust: 0.028, loadMarks: 4 },
  { goal: GOAL_MOVES, target: 14, streak: 0, par: 7, gust: 0.028, loadMarks: 4 },
  // 第 4 章 · 通天塔（高塔 + 强制打出 ×27 连击）
  { goal: GOAL_LAYERS, target: 22, streak: 3, par: 6, gust: 0.03, loadMarks: 3 },
  { goal: GOAL_LAYERS, target: 23, streak: 3, par: 6, gust: 0.03, loadMarks: 4 },
  { goal: GOAL_LAYERS, target: 23, streak: 3, par: 7, gust: 0.032, loadMarks: 4 },
  { goal: GOAL_LAYERS, target: 24, streak: 3, par: 7, gust: 0.032, loadMarks: 5 },
  { goal: GOAL_LAYERS, target: 24, streak: 3, par: 8, gust: 0.036, loadMarks: 5 },
  { goal: GOAL_LAYERS, target: 25, streak: 3, par: 8, gust: 0.036, loadMarks: 5 }
];

const AUTO_STACK_CHAPTER = 1;

export const LEVELS = SPEC.map((spec, i) => {
  const chapter = Math.floor(i / LEVELS_PER_CHAPTER) + 1;
  const hazards = [];
  if (spec.gust) hazards.push(HAZARD_GUST);
  if (spec.loadMarks) hazards.push(HAZARD_LOAD);
  return {
    id: `level_${i + 1}`,
    chapter,
    index: i + 1,
    seed: 101000 + (i + 1) * 37,
    autoStack: chapter <= AUTO_STACK_CHAPTER,
    hazards,
    gustAmp: spec.gust ?? 0,
    gustPeriod: 5,
    loadMarks: spec.loadMarks ?? 0,
    goal: { type: spec.goal, target: spec.target, streak: spec.streak ?? 0 },
    par: spec.par
  };
});

export const CHAPTERS = Array.from({ length: CHAPTER_COUNT }, (_, c) => {
  const id = c + 1;
  const levels = LEVELS.filter((lv) => lv.chapter === id);
  const hazards = [...new Set(levels.flatMap((lv) => lv.hazards))];
  return {
    id: `chapter_${id}`,
    index: id,
    levels: levels.map((lv) => lv.id),
    hazards
  };
});

export function findLevel(index) {
  const n = Math.floor(Number(index));
  if (!Number.isFinite(n)) return null;
  return LEVELS.find((lv) => lv.index === n) ?? null;
}

export function levelById(id) {
  return LEVELS.find((lv) => lv.id === id) ?? null;
}

export function chapterOf(level) {
  if (!level) return null;
  return CHAPTERS.find((ch) => ch.index === level.chapter) ?? null;
}

// 目标换算：把 layers 目标折叠成等价的 move 数，供 UI 画进度条与 bookkeeping 复用。
export function goalMoves(goal) {
  if (!goal) return 0;
  if (goal.type === GOAL_MOVES) return goal.target;
  return (goal.target - 18) * 3;
}

// 双人对决用一个固定配置的塔（标准 18 层、无机括），三局两胜。
export const DUEL_LEVEL = {
  id: "level_duel",
  chapter: 0,
  index: 0,
  seed: 20261009,
  autoStack: false,
  hazards: [],
  gustAmp: 0,
  gustPeriod: 5,
  loadMarks: 0,
  goal: { type: GOAL_MOVES, target: 0, streak: 0 },
  par: 0
};

// 残局解谜：每题给一组候选块，其中恰好 1 块「抽了不倒」。
export const RIDDLE_LEVEL = {
  id: "level_riddle",
  chapter: 0,
  index: 0,
  seed: 30261009,
  autoStack: false,
  hazards: [],
  gustAmp: 0,
  gustPeriod: 5,
  loadMarks: 0,
  goal: { type: GOAL_MOVES, target: RIDDLE_QUESTIONS, streak: 0 },
  par: 0
};

export const RIDDLE_CANDIDATES = 4;
