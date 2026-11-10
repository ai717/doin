// 计分唯一口径：评级只看「用时」与「误判次数」，UI 不得自算。

export const RANKS = [
  { stars: 3, key: "rank3" },
  { stars: 2, key: "rank2" },
  { stars: 1, key: "rank1" },
];

/** 案卷越大，允许的思考时间越长：每名嫌疑人 35 秒拿三星，70 秒拿二星。 */
export function starBudget(suspectCount) {
  const size = Math.max(1, Number(suspectCount) || 1);
  return { quick: size * 35000, patient: size * 70000 };
}

export function starsFor({ suspectCount, timeMs, mistakes }) {
  const { quick, patient } = starBudget(suspectCount);
  const used = Math.max(0, Number(timeMs) || 0);
  const errors = Math.max(0, Number(mistakes) || 0);
  if (errors === 0 && used <= quick) return 3;
  if (errors <= 1 && used <= patient) return 2;
  return 1;
}

export function rankKey(stars) {
  return (RANKS.find((rank) => rank.stars === stars) ?? RANKS[1]).key;
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** 存档只保留更好的成绩：更少的误判优先，其次更短用时。 */
export function betterRecord(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  if (next.mistakes !== prev.mistakes) return next.mistakes < prev.mistakes ? next : prev;
  if (next.timeMs !== prev.timeMs) return next.timeMs < prev.timeMs ? next : prev;
  return prev;
}

export function totalStars(progress) {
  return Object.values(progress?.cases ?? {}).reduce((sum, record) => sum + (record?.stars ?? 0), 0);
}

export function clearedCount(progress) {
  return Object.values(progress?.cases ?? {}).filter((record) => record && record.stars > 0).length;
}
