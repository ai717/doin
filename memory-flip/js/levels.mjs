// 盲盒记忆牌 — 章节配置（数据层，禁止裸写中文）
// 每关字段说明：
//   id           关卡键（字符串）
//   chapter      章节序号 1..5
//   rows / cols  盘面尺寸
//   totemCount  本关用到的图腾种类数（必须 = rows*cols/2）
//   mech         "none" | "ring4" | "ring8" | "gear" | "endgame"
//   missBudget   null = 无限；number = 残局限定翻错次数
//   parMisses   三星参考最少错数（评分用，可被实际成绩刷新）
//   parSeconds   三星参考用时秒（评分用）
//   parCombo     三星参考最长连击（评分用）

export const CHAPTERS = Object.freeze({
  ch_1: { id: "ch_1", enName: "First Pop", order: 1 },
  ch_2: { id: "ch_2", enName: "Tick-Tock", order: 2 },
  ch_3: { id: "ch_3", enName: "Carousel", order: 3 },
  ch_4: { id: "ch_4", enName: "Gearbox", order: 4 },
  ch_5: { id: "ch_5", enName: "Mastermind", order: 5 },
});

export const LEVELS = Object.freeze([
  // 第 1 章 · 入门：纯经典翻牌，无位移
  { id: "level_1_1", chapter: 1, rows: 4, cols: 4, totemCount: 8,  mech: "none",   missBudget: null, parMisses: 1, parSeconds: 90,  parCombo: 2 },
  { id: "level_1_2", chapter: 1, rows: 4, cols: 4, totemCount: 8,  mech: "none",   missBudget: null, parMisses: 1, parSeconds: 80,  parCombo: 2 },
  { id: "level_1_3", chapter: 1, rows: 4, cols: 4, totemCount: 8,  mech: "none",   missBudget: null, parMisses: 0, parSeconds: 70,  parCombo: 3 },
  { id: "level_1_4", chapter: 1, rows: 4, cols: 4, totemCount: 8,  mech: "none",   missBudget: null, parMisses: 0, parSeconds: 60,  parCombo: 4 },
  // 第 2 章 · 4 邻顺时针轮转 1 格
  { id: "level_2_1", chapter: 2, rows: 4, cols: 4, totemCount: 8,  mech: "ring4",  missBudget: null, parMisses: 2, parSeconds: 120, parCombo: 2 },
  { id: "level_2_2", chapter: 2, rows: 4, cols: 4, totemCount: 8,  mech: "ring4",  missBudget: null, parMisses: 2, parSeconds: 110, parCombo: 3 },
  { id: "level_2_3", chapter: 2, rows: 4, cols: 5, totemCount: 10, mech: "ring4",  missBudget: null, parMisses: 2, parSeconds: 130, parCombo: 3 },
  { id: "level_2_4", chapter: 2, rows: 4, cols: 5, totemCount: 10, mech: "ring4",  missBudget: null, parMisses: 2, parSeconds: 120, parCombo: 4 },
  // 第 3 章 · 8 邻（含四角）一并轮转
  { id: "level_3_1", chapter: 3, rows: 4, cols: 5, totemCount: 10, mech: "ring8",  missBudget: null, parMisses: 3, parSeconds: 150, parCombo: 2 },
  { id: "level_3_2", chapter: 3, rows: 4, cols: 5, totemCount: 10, mech: "ring8",  missBudget: null, parMisses: 3, parSeconds: 140, parCombo: 3 },
  { id: "level_3_3", chapter: 3, rows: 5, cols: 6, totemCount: 15, mech: "ring4",  missBudget: null, parMisses: 3, parSeconds: 200, parCombo: 3 },
  { id: "level_3_4", chapter: 3, rows: 5, cols: 6, totemCount: 15, mech: "ring8",  missBudget: null, parMisses: 4, parSeconds: 220, parCombo: 3 },
  { id: "level_3_5", chapter: 3, rows: 5, cols: 6, totemCount: 15, mech: "ring8",  missBudget: null, parMisses: 3, parSeconds: 210, parCombo: 4 },
  // 第 4 章 · 象限整体旋转 90°
  { id: "level_4_1", chapter: 4, rows: 4, cols: 4, totemCount: 8,  mech: "gear",   missBudget: null, parMisses: 3, parSeconds: 110, parCombo: 2 },
  { id: "level_4_2", chapter: 4, rows: 4, cols: 6, totemCount: 12, mech: "gear",   missBudget: null, parMisses: 3, parSeconds: 150, parCombo: 3 },
  { id: "level_4_3", chapter: 4, rows: 4, cols: 6, totemCount: 12, mech: "gear",   missBudget: null, parMisses: 3, parSeconds: 140, parCombo: 3 },
  { id: "level_4_4", chapter: 4, rows: 6, cols: 6, totemCount: 18, mech: "gear",   missBudget: null, parMisses: 4, parSeconds: 200, parCombo: 4 },
  // 第 5 章 · 残局 + 限定翻错次数
  { id: "level_5_1", chapter: 5, rows: 4, cols: 4, totemCount: 8,  mech: "ring4", missBudget: 3, parMisses: 1, parSeconds: 90,  parCombo: 3 },
  { id: "level_5_2", chapter: 5, rows: 4, cols: 5, totemCount: 10, mech: "ring8", missBudget: 3, parMisses: 2, parSeconds: 120, parCombo: 3 },
  { id: "level_5_3", chapter: 5, rows: 4, cols: 6, totemCount: 12, mech: "gear",  missBudget: 3, parMisses: 1, parSeconds: 110, parCombo: 4 },
  { id: "level_5_4", chapter: 5, rows: 5, cols: 6, totemCount: 15, mech: "ring8", missBudget: 4, parMisses: 2, parSeconds: 160, parCombo: 3 },
  { id: "level_5_5", chapter: 5, rows: 6, cols: 6, totemCount: 18, mech: "gear",  missBudget: 4, parMisses: 2, parSeconds: 200, parCombo: 4 },
]);

export const DEFAULT_LEVEL_ID = "level_1_1";

export function levelById(id) {
  return LEVELS.find((lv) => lv.id === id) ?? null;
}

export function levelsByChapter(ch) {
  return LEVELS.filter((lv) => lv.chapter === ch);
}

/** 沙盒模式可选配置上限（默认上限） */
export const SANDBOX_LIMITS = Object.freeze({
  rows: { min: 4, max: 6 },
  cols: { min: 4, max: 6 },
  mechs: Object.freeze(["none", "ring4", "ring8", "gear"]),
});