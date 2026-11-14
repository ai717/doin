// 恶魔迷途 · 计分/评价唯一口径
// UI 层绝对不得自算印章或用时；一切评价口径都在这里。
//
// 本作没有「分数」。评价体系是**恶魔印章**（3 枚/关）：
//   clear    通关印
//   candle   蜡烛印（拿到隐藏蜡烛并通关）
//   flawless 无伤印（零死亡通关）
// 另提供「节点大印章」判定：一个节点的 5 关全部点亮 3 印。

import { computeSeals, sealCount, formatClock } from "./engine.mjs";
import { LEVEL_COUNT, NODES } from "./levels.mjs";

export const SEAL_KEYS = Object.freeze(["clear", "candle", "flawless"]);
export const SEALS_PER_LEVEL = SEAL_KEYS.length;

export function emptySeals() {
  return { clear: false, candle: false, flawless: false };
}

// 从引擎状态结算本次通关得到的印章（唯一入口）
export function sealsFromState(state) {
  const raw = computeSeals(state);
  // 未通关则不产生任何印章
  if (!raw.clear) return emptySeals();
  return {
    clear: true,
    candle: Boolean(raw.candle),
    flawless: Boolean(raw.flawless)
  };
}

export function countSeals(seals) {
  return sealCount(seals);
}

export function isLevelPerfect(seals) {
  return countSeals(seals) === SEALS_PER_LEVEL;
}

// 合并两次印章（用于「历史最亮」显示）
export function mergeSeals(a, b) {
  const x = a ?? emptySeals();
  const y = b ?? emptySeals();
  return {
    clear: Boolean(x.clear || y.clear),
    candle: Boolean(x.candle || y.candle),
    flawless: Boolean(x.flawless || y.flawless)
  };
}

// 本次结算相对历史是否刷新了任何印章（用于「新纪录」提示）
export function hasNewSeal(prev, now) {
  const p = prev ?? emptySeals();
  const n = now ?? emptySeals();
  return SEAL_KEYS.some((k) => n[k] && !p[k]);
}

// 某节点的印章盘点
export function nodeTally(sealsByLevel, node) {
  const tally = { clear: 0, candle: 0, flawless: 0, total: 0, perfect: false };
  if (!node) return tally;
  for (let i = node.from; i <= node.to; i++) {
    tally.total++;
    const s = sealsByLevel?.[i];
    if (!s) continue;
    if (s.clear) tally.clear++;
    if (s.candle) tally.candle++;
    if (s.flawless) tally.flawless++;
  }
  tally.perfect = tally.total > 0 && tally.flawless === tally.total;
  return tally;
}

// 全站印章总览
export function overallTally(sealsByLevel) {
  const t = { clear: 0, candle: 0, flawless: 0, total: LEVEL_COUNT, perfectNodes: 0 };
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const s = sealsByLevel?.[i];
    if (!s) continue;
    if (s.clear) t.clear++;
    if (s.candle) t.candle++;
    if (s.flawless) t.flawless++;
  }
  for (const node of NODES) {
    if (nodeTally(sealsByLevel, node).perfect) t.perfectNodes++;
  }
  return t;
}

// 本关的关卡编号显示（节点内序号）
// 非法索引一律安全降级，绝不让 NaN / undefined 流到界面上。
export function levelLabel(levelIndex) {
  const idx = Math.trunc(Number(levelIndex));
  if (!Number.isFinite(idx)) return { node: 0, step: 0, name: "" };
  const node = NODES.find((n) => idx >= n.from && idx <= n.to);
  if (!node) {
    const safeStep = Math.max(0, idx + 1);
    return { node: 0, step: safeStep, name: "" };
  }
  return {
    node: node.id,
    step: idx - node.from + 1,
    name: node.name
  };
}

// 计时显示（统一口径，UI 不得自算）
export function clock(seconds) {
  return formatClock(seconds);
}

// 状态栏对比：本次用时是否刷新了最佳
export function isNewBestTime(prevBest, elapsed) {
  const t = Number(elapsed);
  if (!Number.isFinite(t) || t < 0) return false;
  if (prevBest === null || prevBest === undefined) return true;
  return t < Number(prevBest);
}

export { LEVEL_COUNT, NODES };
