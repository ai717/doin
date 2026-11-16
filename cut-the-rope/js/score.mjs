// 割绳子计分与评级统一计算口径（UI 与 Engine 不得自造计分规则）

export function calcStars(starsCollected) {
  return Math.min(3, Math.max(1, starsCollected));
}

export function getTotalStars(levelsProgress) {
  let sum = 0;
  for (const lvl of Object.values(levelsProgress || {})) {
    if (lvl && typeof lvl.stars === "number") {
      sum += lvl.stars;
    }
  }
  return sum;
}

export function getChapterStats(chapter, levelsProgress) {
  const [start, end] = chapter.range;
  let earned = 0;
  const total = (end - start + 1) * 3;
  let cleared = 0;

  for (let id = start; id <= end; id++) {
    const data = levelsProgress[id];
    if (data && data.stars > 0) {
      earned += data.stars;
      cleared++;
    }
  }

  return { earned, total, cleared, count: end - start + 1 };
}

export function isLevelUnlocked(levelId, levelsProgress) {
  if (levelId === 1 || levelId === 33) return true;
  // 前一关已通关（获得至少 1 星）即可解锁
  const prev = levelsProgress[levelId - 1];
  return Boolean(prev && prev.stars > 0);
}
