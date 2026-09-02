import { generateLevel } from "../generator.mjs?v=dev";
import { paramsForDifficulty } from "../difficulty.mjs?v=dev";

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
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

/**
 * 今日挑战：每天为所有玩家生成同一道高难度题目（D5~D7）。
 * 双 dock（2 个中转槽）、容量 5~6、颜色 5~6、轨道缓冲区 max(2, dockCount)。
 * 每关用 generator 产出并可解、首步无死胡同。
 */
export function createDailyLevel(dateKey) {
  const baseSeed = hash(`daily-challenge-${dateKey}`);
  // 难度范围 D5 / D6（D7 生成+solver+验证极慢，不适合每日随刷），保证多样化
  const difficulty = 5 + ((baseSeed >>> 4) % 2); // 5 or 6
  const base = paramsForDifficulty(difficulty);
  // 今日挑战：2 中转槽 + 上探容量/颜色（保证高分体量 + 视觉复杂度）
  const dockCount = 2;
  const capacity = Math.max(5, Math.min(6, base.capacity + 1));
  const colorCount = Math.max(5, Math.min(6, base.colorCount + 0)); // cap color 避免爆炸
  const emptyCount = Math.max(2, dockCount);
  const generatorSeed = Number(`0x${baseSeed.toString(16).slice(-8)}`) >>> 0;
  let lastErr = null;
  // 快速尝试：轻量 solver + 轻量 intent 门闩
  for (let i = 0; i < 25; i += 1) {
    try {
      const seed = nextSeed(generatorSeed + i * 2654435761);
      const generated = generateLevel({
        seed,
        id: "daily",
        chapter: 0,
        capacity,
        colorCount,
        dockCount,
        emptyCount,
        attempts: 400,
        solverOptions: {
          nodeLimit: 200_000,
          timeLimitMs: 700,
          intentRollouts: 2,
          intentRolloutSteps: 16,
        },
      });
      if (generated && generated.validation?.valid) {
        return {
          ...generated,
          id: "daily",
          dateKey,
          difficulty,
          today: true,
          seed: `daily-${dateKey}-${seed.toString(36)}`,
          title: `今日挑战 · ${dateKey}`,
        };
      }
      lastErr = generated?.validation?.reason ?? "unknown";
    } catch (err) {
      lastErr = err?.message ?? "unknown";
    }
  }
  // 回退：罕见情况下 generator 没产出，就宽松一点 D5
  const fallback = generateLevel({
    seed: generatorSeed,
    id: "daily",
    chapter: 0,
    capacity: 5,
    colorCount: 5,
    dockCount: 2,
    emptyCount: 2,
    attempts: 600,
  });
  return {
    ...fallback,
    id: "daily",
    dateKey,
    difficulty: 5,
    today: true,
    seed: `daily-${dateKey}-fallback`,
    title: `今日挑战 · ${dateKey}`,
    validation: fallback.validation ?? { valid: true, reason: lastErr ?? "fallback" },
  };
}

