// 盲盒竞拍 · 残局挑战预设（12 局手工精编：固定种子 + 指定 AI 池 + 指定角色）
// 每关 seed 固定 → 行情走向、仓库内容、AI 出价全部确定，可重放、可同题比较。
// 星级：1★ 完成五回合 / 2★ 终局前二 / 3★ 终局第一。

export const CHALLENGES = [
  { id: 1, seed: 1001, difficulty: "easy", character: "detective", personas: ["rookie", "scavenger", "cautious"] },
  { id: 2, seed: 1002, difficulty: "standard", character: "detective", personas: ["shark", "gambler", "cautious"] },
  { id: 3, seed: 1003, difficulty: "standard", character: "gossip", personas: ["collector", "oracle", "speculator"] },
  { id: 4, seed: 1004, difficulty: "standard", character: "detective", personas: ["speculator", "gambler", "oracle"] },
  { id: 5, seed: 1005, difficulty: "hard", character: "hoarder", personas: ["shark", "collector", "oracle"] },
  { id: 6, seed: 1006, difficulty: "hard", character: "detective", personas: ["oracle", "oracle", "oracle"] },
  { id: 7, seed: 1007, difficulty: "hard", character: "gossip", personas: ["shark", "shark", "gambler"] },
  { id: 8, seed: 1008, difficulty: "standard", character: "expert", personas: ["cautious", "scavenger", "oracle"] },
  { id: 9, seed: 1009, difficulty: "easy", character: "detective", personas: ["rookie", "rookie", "rookie"] },
  { id: 10, seed: 1010, difficulty: "standard", character: "expert", personas: ["scavenger", "speculator", "cautious"] },
  { id: 11, seed: 1011, difficulty: "hard", character: "hoarder", personas: ["collector", "oracle", "shark"] },
  { id: 12, seed: 1012, difficulty: "hard", character: "gossip", personas: ["oracle", "collector", "gambler"] },
];

export function getChallenge(id) {
  return CHALLENGES.find((c) => c.id === id) ?? null;
}

export function challengeStars(rankPos) {
  // 0 → 3★，1 → 2★，其他 → 1★
  if (rankPos === 0) return 3;
  if (rankPos === 1) return 2;
  return 1;
}
