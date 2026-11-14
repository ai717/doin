// levels.mjs —— 单人猎手战役关卡表与 AI 档位（数据层，纯英文 key，严禁裸写中文）

import { MAX_BLEND } from "./engine.mjs";

// 5 档 AI：从侦察新手到伪装大师；blendCeiling 决定其伪装上限——
// 伪装大师也达不到 MAX_BLEND，每回合必留 ≥(MAX_BLEND - blendCeiling) 的可测热度破绽。
export const AI_TIERS = [
  { id: 0, key: "ai_1", moveChance: 0.55, refineChance: 0.2, blendCeiling: 55 },
  { id: 1, key: "ai_2", moveChance: 0.45, refineChance: 0.3, blendCeiling: 62 },
  { id: 2, key: "ai_3", moveChance: 0.32, refineChance: 0.42, blendCeiling: 70 },
  { id: 3, key: "ai_4", moveChance: 0.22, refineChance: 0.55, blendCeiling: 78 },
  { id: 4, key: "ai_5", moveChance: 0.12, refineChance: 0.68, blendCeiling: Math.min(86, MAX_BLEND - 4) },
];

export const TIER_COUNT = AI_TIERS.length;

// 每档 2 张种子棋盘，共 10 关
const TIER_SEEDS = [101, 677];
export const LEVEL_COUNT = TIER_COUNT * TIER_SEEDS.length;

export function levelById(id) {
  if (!Number.isInteger(id) || id < 1 || id > LEVEL_COUNT) return null;
  const zero = id - 1;
  const ai = AI_TIERS[Math.floor(zero / TIER_SEEDS.length)];
  const seed = TIER_SEEDS[zero % TIER_SEEDS.length];
  return { id, ai: ai.id, aiKey: ai.key, seed };
}

export function aiTier(id) {
  return AI_TIERS[id] ?? AI_TIERS[0];
}

export function levelSeed(id) {
  return levelById(id)?.seed ?? TIER_SEEDS[0];
}