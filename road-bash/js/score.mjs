// score.mjs — 计分 / 星级 / 奖金唯一口径。UI 不得自算。叶子模块，不 import 兄弟。

export const STAR_MAX = 3;
export const KNOCKOUT_BONUS = 40;
export const CLUB_HITS = 5;

export const TIER_QUALIFY = [4, 3, 3, 1];

export const PLACE_PRIZE = [
  [400, 250, 160, 80, 40, 20, 10],
  [480, 300, 190, 90, 45, 22, 12],
  [560, 360, 220, 110, 50, 24, 14],
  [720, 420, 260, 130, 60, 28, 16],
];

export function clampStars(n) {
  const v = Math.trunc(Number(n) || 0);
  if (v < 0) return 0;
  if (v > STAR_MAX) return STAR_MAX;
  return v;
}

export function prizeForPlace(place, tier) {
  const t = Math.max(0, Math.min(3, Math.trunc(Number(tier) || 0)));
  const p = Math.max(1, Math.trunc(Number(place) || 99));
  const row = PLACE_PRIZE[t];
  return row[p - 1] ?? 0;
}

export function knockoutCash(count) {
  return Math.max(0, Math.trunc(Number(count) || 0)) * KNOCKOUT_BONUS;
}

export function raceCash({ mode, place, tier, knockouts, won }) {
  if (!won) return 0;
  if (mode === "league") return prizeForPlace(place, tier) + knockoutCash(knockouts);
  if (mode === "brawl") return 180 + knockoutCash(knockouts);
  if (mode === "getaway") return 220 + knockoutCash(knockouts);
  return 0;
}

/** 联赛：★ 录取通关；★★ 领奖台（前 3）；★★★ 冠军且至少 3 次击倒。 */
export function leagueStars({ place, qualify, knockouts, won }) {
  if (!won) return 0;
  const p = Math.trunc(Number(place) || 99);
  const q = Math.max(1, Math.trunc(Number(qualify) || 4));
  if (p > q) return 0;
  if (p === 1 && (knockouts || 0) >= 3) return 3;
  if (p <= 3) return 2;
  return 1;
}

/** 群殴：完成配额通关；超额击倒第二星；零摔车第三星。 */
export function brawlStars({ won, knockouts, quota, crashes }) {
  if (!won) return 0;
  const ko = Math.trunc(Number(knockouts) || 0);
  const need = Math.max(1, Math.trunc(Number(quota) || 1));
  if (ko < need) return 0;
  const extra = ko >= need + 2;
  const clean = Math.trunc(Number(crashes) || 0) === 0;
  if (extra && clean) return 3;
  if (extra || clean) return 2;
  return 1;
}

/** 冲刺：通关一星；无摔车二星；全程未被贴停（bust 从未满）三星。 */
export function getawayStars({ won, crashes, maxBust }) {
  if (!won) return 0;
  const clean = Math.trunc(Number(crashes) || 0) === 0;
  const neverStuck = Number(maxBust) < 0.85;
  if (clean && neverStuck) return 3;
  if (clean || neverStuck) return 2;
  return 1;
}

export function starsForResult(result) {
  if (!result || typeof result !== "object") return 0;
  if (result.mode === "league") return leagueStars(result);
  if (result.mode === "brawl") return brawlStars(result);
  if (result.mode === "getaway") return getawayStars(result);
  return 0;
}
