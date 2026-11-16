// difficulty.mjs —— 三档难度定义：起手预填障碍 + 块序袋强。纯数据 + 选择函数，DOM-free。
// storage 的 normalize 与 engine 的 createState 共用本文件，杜绝两套难度口径漂移。
// 描述 key 走 i18n（diffEasyDesc / diffNormalDesc / diffHardDesc），本文件零中文。

export const DIFFICULTY_IDS = ["easy", "normal", "hard"];

export const DIFFICULTIES = [
  { id: "easy", prefills: 0, dupMin: 3, dupMax: 5 },
  { id: "normal", prefills: 6, dupMin: 5, dupMax: 7 },
  { id: "hard", prefills: 12, dupMin: 7, dupMax: 9 },
];

const BY_ID = new Map(DIFFICULTIES.map((d) => [d.id, d]));

export const DEFAULT_DIFFICULTY = "normal";

export function difficultyById(id) {
  return BY_ID.get(id) ?? null;
}

/** 非法/缺失难度回退默认档（坏数据静默降级，绝不抛错） */
export function pickDifficulty(value) {
  return BY_ID.has(value) ? value : DEFAULT_DIFFICULTY;
}
