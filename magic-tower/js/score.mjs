// 魔塔：勇者登顶 · 计分与段位（唯一口径，UI 不得自算）

import { RANKS, TOTAL_FLOORS } from "./data.mjs";

// 段位判定：先看战损，再看步数；两条都达标才升档
export function rankOf(state) {
  const damage = state.stats.damageTaken;
  const steps = state.stats.steps;
  const hit = RANKS.find((r) => damage <= r.maxDamage && steps <= r.maxSteps);
  return hit ? hit.id : RANKS[RANKS.length - 1].id;
}

export function summarize(state) {
  const cleared = state.status === "victory";
  return {
    won: cleared,
    ending: state.ending,
    floor: state.floor,
    floorsSeen: state.stats.floorsSeen,
    totalFloors: TOTAL_FLOORS,
    steps: state.stats.steps,
    damage: state.stats.damageTaken,
    slain: state.stats.slain,
    goldEarned: state.stats.goldEarned,
    hpLeft: cleared ? state.hp : 0,
    hpMax: state.hpMax,
    atk: state.atk,
    def: state.def,
    rank: rankOf(state),
    // 综合评分：通关基础分 + 剩余生命 + 战损折扣；未通关只给探索分
    score: cleared
      ? Math.max(0, Math.round(1000 + state.hp / Math.max(1, state.hpMax) * 800 - state.stats.damageTaken * 0.02))
      : Math.round(state.stats.floorsSeen * 25),
  };
}

export function progressPercent(state) {
  return Math.min(100, Math.round((state.stats.floorsSeen / TOTAL_FLOORS) * 100));
}

export function formatNumber(value) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
