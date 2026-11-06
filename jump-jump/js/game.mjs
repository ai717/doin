// game.mjs — DOM-free 状态控制器：接收 UI 意图，调度 engine，派发事件。
// 不碰 document / window，只做模式编排与结果汇总；持久化由 main.mjs 注入的回调完成。

import {
  createState,
  startCharge,
  releaseCharge,
  stepFrame,
  drainEvents,
  computeStars,
  accuracy,
  hashSeed,
  MODES,
} from "./engine.mjs";
import { buildLevelRoute, levelSpec, LEVEL_COUNT } from "./levels.mjs";

export function createGame() {
  return {
    mode: "odyssey",
    level: 1,
    state: null,
    lastResult: null,
  };
}

function clampLevel(levelId) {
  const n = Math.round(Number(levelId) || 1);
  return Math.max(1, Math.min(LEVEL_COUNT, n));
}

export function startOdyssey(game, levelId) {
  const id = clampLevel(levelId);
  game.mode = "odyssey";
  game.level = id;
  game.state = createState({
    mode: "odyssey",
    level: id,
    seed: levelSpec(id).seed,
    route: buildLevelRoute(id),
  });
  game.lastResult = null;
  return game.state;
}

export function startEndless(game, seed) {
  game.mode = "endless";
  game.level = 0;
  const s = Number.isFinite(seed) ? seed >>> 0 : hashSeed(`jump-jump:endless:${Date.now()}`) >>> 0;
  game.state = createState({ mode: "endless", seed: s });
  game.lastResult = null;
  return game.state;
}

export function startSniper(game) {
  game.mode = "sniper";
  game.level = 0;
  game.state = createState({ mode: "sniper", seed: hashSeed("jump-jump:sniper") });
  game.lastResult = null;
  return game.state;
}

export function restart(game) {
  if (game.mode === "odyssey") return startOdyssey(game, game.level);
  if (game.mode === "sniper") return startSniper(game);
  return startEndless(game);
}

export function press(game) {
  if (!game.state) return null;
  return startCharge(game.state);
}

export function release(game) {
  if (!game.state) return null;
  return releaseCharge(game.state);
}

export function tick(game, dt) {
  if (!game.state) return [];
  stepFrame(game.state, dt);
  return drainEvents(game.state);
}

/** 汇总本局结果（不写盘，写盘由 main 通过 storage 完成）。 */
export function summarize(game) {
  const s = game.state;
  if (!s) return null;
  const base = {
    mode: game.mode,
    level: game.level,
    score: s.score,
    jumps: s.jumps,
    bullseyes: s.bullseyes,
    bestCombo: s.bestCombo,
    wobbles: s.wobbles,
    lands: s.lands,
    maxDistance: Math.round(s.maxDistance),
    accuracy: accuracy(s),
  };
  if (game.mode === "odyssey") {
    return { ...base, won: s.phase === "won", stars: computeStars(s) };
  }
  if (game.mode === "sniper") {
    return {
      ...base,
      won: s.phase === "won",
      total: s.sniper ? s.sniper.total : 0,
      shots: s.sniper ? s.sniper.shots : 0,
      rings: s.sniper ? s.sniper.rings.slice() : [],
    };
  }
  return { ...base, won: false };
}

export { MODES, LEVEL_COUNT };
