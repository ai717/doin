// score.mjs — 关卡评价体系（珍珠评级 / 深渊纪录 / 数字格式化）的唯一口径。
// 说清楚分工：*每帧累加的得分* 由 engine 在事件发生的那一刻记账（它才知道连击倍率与
// 当前体型），这里负责“这一局值几颗珍珠 / 破没破纪录 / 怎么显示”。两边都不许越界，
// 也绝不允许在 UI 层再算一遍。
//
// 主线评价体系刻意不用“总分”：每关三颗珍珠（0–3）。
//   ① 通关（达成关卡目标）
//   ② 全程未被吃（hits === 0）
//   ③ 隐藏效率目标：限时关看用时 / 连锁关看双重狂暴 / 鱼群关看满编鱼群
// 深渊无尽另记两项：最深米数 与 最高分。

export const PEARLS_PER_LEVEL = 3;

// 珍珠评级：只有通关才算数，星 2/星 3 都是“锦上添花”的效率目标。
export function levelPearls(level, result = {}) {
  const won = Boolean(result.won);
  if (!won) {
    return { pearls: 0, stars: [false, false, false], labels: ["pass", "noHit", "bonus"] };
  }
  // 严格等于 0：数据缺失（undefined / null）一律视为“拿不到这颗珍珠”。
  // 用 `?? 0` 兜底会让任何漏传 hits 的调用白送一颗星，这种错必须往保守方向倒。
  const noHit = result.hits === 0;
  const bonus = bonusReached(level?.star3, result);
  const stars = [true, noHit, bonus];
  return { pearls: stars.filter(Boolean).length, stars, labels: ["pass", "noHit", bonusLabel(level?.star3, result)] };
}

export function bonusReached(star3, result = {}) {
  if (!star3) return false;
  if (star3.type === "parTime") return (result.time ?? Infinity) <= star3.value;
  if (star3.type === "frenzy") return (result.bestFrenzy ?? 0) >= star3.value;
  if (star3.type === "shoal") return (result.shoalPeak ?? 0) >= star3.value;
  if (star3.type === "eatCount") return (result.eaten ?? 0) >= star3.value;
  return false;
}

function bonusLabel(star3, result) {
  if (!star3) return "bonus";
  if (star3.type === "parTime") return `parTime:${star3.value}`;
  if (star3.type === "frenzy") return `frenzy:${star3.value}`;
  if (star3.type === "shoal") return `shoal:${star3.value}`;
  if (star3.type === "eatCount") return `eatCount:${star3.value}`;
  return `bonus:${result.time ?? 0}`;
}

// 珍珠总数 = 各关最佳评级的求和（存储在 storage，这里是统计口径）。
export function totalPearls(stars = {}) {
  let total = 0;
  for (const key of Object.keys(stars)) total += clampPearls(stars[key]);
  return total;
}

export function pearlsOfZone(stars = {}, levelIds = []) {
  let total = 0;
  for (const id of levelIds) total += clampPearls(stars[id]);
  return total;
}

export function clampPearls(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(PEARLS_PER_LEVEL, Math.trunc(n)));
}

// 非有限值（NaN / ±Infinity / 非数字串）一律归 0。
// 注意不能用 `Number(v) || 0`：Infinity 是真值，会原样穿过去，最后在 UI 上显示成 ∞。
function meters(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function abyssRecord(previous = {}, run = {}) {
  const runMeters = meters(run.meters);
  const runScore = meters(run.score);
  const prevMeters = meters(previous.meters);
  const prevScore = meters(previous.score);
  return {
    best: { meters: Math.max(prevMeters, runMeters), score: Math.max(prevScore, runScore) },
    isRecord: runMeters > prevMeters || runScore > prevScore,
    meters: runMeters,
    score: runScore,
  };
}

export function formatNumber(value) {
  return meters(value).toLocaleString("en-US");
}

export function formatMeters(value) {
  return `${meters(value)} m`;
}

export function formatTime(seconds) {
  const total = Number(seconds);
  const s = Number.isFinite(total) ? Math.max(0, total) : 0;
  const whole = Math.floor(s);
  const tenth = Math.floor((s - whole) * 10);
  return `${whole}.${tenth}s`;
}
