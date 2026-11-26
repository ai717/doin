// 22 关单人天梯：5 / 4 / 4 / 5 / 4 五段递进。
// 只描述 AI 行为参数与 i18n 键，不写任何展示用中文（纯净语言铁律）。

export const TIERS = Object.freeze([
  Object.freeze({ id: "bronze", from: 0, count: 5, key: "tierBronze" }),
  Object.freeze({ id: "silver", from: 5, count: 4, key: "tierSilver" }),
  Object.freeze({ id: "gold", from: 9, count: 4, key: "tierGold" }),
  Object.freeze({ id: "platinum", from: 13, count: 5, key: "tierPlatinum" }),
  Object.freeze({ id: "diamond", from: 18, count: 4, key: "tierDiamond" }),
]);

const stage = (index, tier, nameKey, dropMs, moveMs, mistake, holdSkill, tetrisBias, garbageAware) =>
  Object.freeze({ id: index + 1, index, tier, nameKey, dropMs, moveMs, mistake, holdSkill, tetrisBias, garbageAware });

// 参数含义：dropMs 每次自然下落间隔；moveMs AI 每步操作间隔；mistake 乱走概率；
// holdSkill 保留长条的倾向；tetrisBias 蓄力四行倾向；garbageAware 受到攻击时优先消行抵消的倾向。
export const STAGES = Object.freeze([
  stage(0, "bronze", "stage1", 800, 210, 0.42, 0.0, 0.0, 0.15),
  stage(1, "bronze", "stage2", 770, 200, 0.38, 0.05, 0.0, 0.2),
  stage(2, "bronze", "stage3", 740, 190, 0.34, 0.1, 0.05, 0.25),
  stage(3, "bronze", "stage4", 710, 180, 0.3, 0.15, 0.08, 0.3),
  stage(4, "bronze", "stage5", 680, 175, 0.26, 0.2, 0.1, 0.35),
  stage(5, "silver", "stage6", 640, 165, 0.23, 0.3, 0.15, 0.4),
  stage(6, "silver", "stage7", 610, 158, 0.2, 0.36, 0.2, 0.45),
  stage(7, "silver", "stage8", 580, 150, 0.17, 0.42, 0.25, 0.5),
  stage(8, "silver", "stage9", 550, 145, 0.14, 0.48, 0.3, 0.55),
  stage(9, "gold", "stage10", 500, 135, 0.12, 0.55, 0.36, 0.6),
  stage(10, "gold", "stage11", 470, 128, 0.1, 0.6, 0.4, 0.65),
  stage(11, "gold", "stage12", 440, 122, 0.08, 0.64, 0.44, 0.7),
  stage(12, "gold", "stage13", 410, 116, 0.07, 0.68, 0.48, 0.72),
  stage(13, "platinum", "stage14", 380, 110, 0.06, 0.72, 0.52, 0.75),
  stage(14, "platinum", "stage15", 355, 104, 0.05, 0.75, 0.55, 0.78),
  stage(15, "platinum", "stage16", 330, 98, 0.04, 0.78, 0.58, 0.8),
  stage(16, "platinum", "stage17", 310, 92, 0.03, 0.8, 0.6, 0.82),
  stage(17, "platinum", "stage18", 290, 88, 0.02, 0.82, 0.62, 0.84),
  stage(18, "diamond", "stage19", 260, 82, 0.015, 0.85, 0.65, 0.86),
  stage(19, "diamond", "stage20", 235, 76, 0.01, 0.88, 0.68, 0.88),
  stage(20, "diamond", "stage21", 210, 70, 0.005, 0.9, 0.7, 0.9),
  stage(21, "diamond", "stage22", 185, 62, 0.0, 0.94, 0.72, 0.92),
]);

export const TOTAL_STAGES = STAGES.length;

// 同屏双人：双方共用一档手感基线，节奏比天梯中段稍快，保证对决不拖沓。
export const VERSUS_GRAVITY = 600;
export const SOLO_PLAYER_GRAVITY = 780;

export function findStage(index) {
  if (!Number.isFinite(index)) return STAGES[0];
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, Math.floor(index)))] ?? STAGES[0];
}

export function tierOf(index) {
  const id = findStage(index).tier;
  return TIERS.find((tier) => tier.id === id) ?? TIERS[0];
}

// 单人天梯只打 1 个 KO 即过关；双人按 BO3 / BO5 抢二 / 抢三。
export function winsNeeded(bestOf) {
  const value = bestOf === 5 ? 5 : 3;
  return Math.floor(value / 2) + 1;
}
