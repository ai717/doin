// 评级与收集进度的唯一口径：UI 不得自算。
export function starsFor(hintsUsed) {
  const used = Math.max(0, Number(hintsUsed) || 0);
  if (used === 0) return 3;
  if (used === 1) return 2;
  return 1;
}

export function levelScore({ entries = 0, hintsUsed = 0, elapsedMs = 0 } = {}) {
  const base = Math.max(0, entries) * 120;
  const hintPenalty = Math.max(0, hintsUsed) * 45;
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  const timeBonus = Math.max(0, 260 - seconds * 2);
  return Math.max(120, base + timeBonus - hintPenalty);
}

export function boardStars(progress, lang, boardId) {
  const levels = progress?.boards?.[lang]?.[boardId]?.levels ?? {};
  return Object.values(levels).reduce((sum, record) => sum + (record?.stars ?? 0), 0);
}

export function totalStars(progress, lang) {
  const boards = progress?.boards?.[lang] ?? {};
  return Object.keys(boards).reduce((sum, boardId) => sum + boardStars(progress, lang, boardId), 0);
}

export function clearedLevels(progress, lang, boardId) {
  const levels = progress?.boards?.[lang]?.[boardId]?.levels ?? {};
  return Object.keys(levels).filter((key) => (levels[key]?.stars ?? 0) > 0).length;
}

export function atlasIds(progress, lang, boardId) {
  const atlas = progress?.boards?.[lang]?.[boardId]?.atlas ?? {};
  return Object.keys(atlas).filter((id) => atlas[id]);
}

export function atlasTotal(progress, lang) {
  const boards = progress?.boards?.[lang] ?? {};
  return Object.keys(boards).reduce((sum, boardId) => sum + atlasIds(progress, lang, boardId).length, 0);
}

export function bestMs(progress, lang, boardId, levelIndex) {
  return progress?.boards?.[lang]?.[boardId]?.levels?.[String(levelIndex)]?.ms ?? null;
}
