import { LEVELS } from "../levels.mjs?v=dev";

function hash(value) {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function nextSeed(seed) {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function colorMap(colorCount, seed) {
  const colors = Array.from({ length: colorCount }, (_, index) => index);
  let current = seed;
  for (let index = colors.length - 1; index > 0; index -= 1) {
    current = nextSeed(current);
    const target = current % (index + 1);
    [colors[index], colors[target]] = [colors[target], colors[index]];
  }
  return colors;
}

export function todayKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function createDailyLevel(dateKey) {
  const seed = hash(dateKey);
  const source = LEVELS[seed % LEVELS.length];
  const colorCount = Math.max(...source.tracks.flat()) + 1;
  const mapping = colorMap(colorCount, seed);
  return {
    ...source,
    id: "daily",
    dateKey,
    sourceLevelId: source.id,
    seed: `daily-${dateKey}-${source.id}`,
    tracks: source.tracks.map((track) => track.map((color) => mapping[color])),
    modifiers: source.modifiers.map((modifier) => ({
      ...modifier,
      ...(modifier.frozenUntilColor === undefined ? {} : { frozenUntilColor: mapping[modifier.frozenUntilColor] }),
    })),
  };
}
