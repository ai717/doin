/**
 * @file games/screw/js/score.mjs
 * 计分与星级唯一口径：UI 不得自行计算星级或最佳时间。
 */

export function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** 目标用时：每颗螺栓约 7 秒 + 20 秒观察余量 */
export function parTimeMs(level) {
  const screws = (level.plates || []).reduce((sum, plate) => sum + plate.holes.length, 0);
  return (20 + screws * 7) * 1000;
}

export function calculateStars({ status, elapsedMs, undos, level }) {
  if (status !== 'won') return 0;
  let stars = 3;
  if (undos > 0) stars -= 1;
  if (elapsedMs > parTimeMs(level)) stars -= 1;
  return Math.max(1, stars);
}

export function isNewBest(previous, result) {
  if (!previous || !previous.cleared) return true;
  if (result.stars > previous.stars) return true;
  if (result.stars === previous.stars && result.timeMs < previous.bestTimeMs) return true;
  return false;
}

export function recordLabel(record, t) {
  if (!record || !record.cleared) return t('noRecord');
  return `${'★'.repeat(record.stars)}${'☆'.repeat(3 - record.stars)}  ${formatTime(record.bestTimeMs)}`;
}
