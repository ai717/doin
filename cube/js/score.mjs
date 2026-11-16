// 计分唯一口径：用时、TPS、星评与个人最佳，UI 不得自算。

export const NO_VALUE = "—";

export function formatTime(ms) {
  const value = Math.max(0, Math.round(Number(ms) || 0));
  const minutes = Math.floor(value / 60000);
  const seconds = Math.floor((value % 60000) / 1000);
  const hundredths = Math.floor((value % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

export function formatClock(ms) {
  return formatTime(ms);
}

export function tps(moves, ms) {
  const seconds = Math.max(0, Number(ms) || 0) / 1000;
  if (!seconds || seconds < 0.001) return 0;
  return Math.round((Math.max(0, Number(moves) || 0) / seconds) * 100) / 100;
}

export function scoreRound({ size, moves, ms }) {
  const base = size === 2 ? 1200 : 3000;
  const movePenalty = Math.max(0, Number(moves) || 0) * (size === 2 ? 14 : 8);
  const timePenalty = Math.floor(Math.max(0, Number(ms) || 0) / 1000) * (size === 2 ? 7 : 4);
  return Math.max(100, base - movePenalty - timePenalty);
}

export function starsFor({ moves, par }) {
  const target = Math.max(1, Number(par) || 1);
  const used = Math.max(0, Number(moves) || 0);
  if (used <= target) return 3;
  if (used <= target * 2) return 2;
  return 1;
}

export function bestOf(values) {
  const list = (values ?? []).filter((value) => Number.isFinite(value) && value > 0);
  return list.length ? Math.min(...list) : 0;
}

export function pushTime(list, ms, limit = 5) {
  const value = Math.max(0, Math.round(Number(ms) || 0));
  if (!value) return [...(list ?? [])];
  return [...(list ?? []), value].slice(-limit);
}

export function averageOf(list) {
  const values = (list ?? []).filter((value) => Number.isFinite(value) && value > 0);
  if (values.length < 5) return 0;
  const trimmed = [...values].sort((a, b) => a - b).slice(1, -1);
  return Math.round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length);
}
