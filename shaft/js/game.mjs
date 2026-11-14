// game.mjs — DOM-free 状态控制器：组装模式、调度引擎、汇总结果。
// 不碰 document / window / localStorage；持久化由 main 通过 storage 完成。

import {
  createState,
  stepFrame,
  drainEvents,
  setInput,
  releaseAll,
  hashSeed,
  goalProgress,
  radarScan,
} from "./engine.mjs";
import { buildConfig, levelSpec, LEVEL_COUNT, MODES } from "./levels.mjs";
import { computeStars, computeScore } from "./score.mjs";

let runCounter = 0;

export function createGame() {
  return {
    mode: "campaign",
    level: 1,
    seed: 0,
    state: null,
    result: null,
  };
}

function freshSeed(tag) {
  runCounter += 1;
  return hashSeed(`shaft:${tag}:${Date.now()}:${runCounter}`) >>> 0;
}

export function startCampaign(game, levelId) {
  const level = Math.max(1, Math.min(LEVEL_COUNT, Math.round(Number(levelId) || 1)));
  const spec = levelSpec(level);
  game.mode = "campaign";
  game.level = level;
  game.seed = spec.seed;
  game.state = createState(buildConfig({ mode: "campaign", level, seed: spec.seed }));
  game.result = null;
  return game.state;
}

export function startClassic(game, seed) {
  const s = Number.isFinite(seed) ? Number(seed) >>> 0 : freshSeed("classic");
  game.mode = "classic";
  game.level = 0;
  game.seed = s;
  game.state = createState(buildConfig({ mode: "classic", seed: s }));
  game.result = null;
  return game.state;
}

export function startEndless(game, seed) {
  const s = Number.isFinite(seed) ? Number(seed) >>> 0 : freshSeed("endless");
  game.mode = "endless";
  game.level = 0;
  game.seed = s;
  game.state = createState(buildConfig({ mode: "endless", seed: s }));
  game.result = null;
  return game.state;
}

export function startMode(game, mode, level = 1, seed = null) {
  if (mode === "classic") return startClassic(game, seed);
  if (mode === "endless") return startEndless(game, seed);
  return startCampaign(game, level);
}

export function restart(game) {
  return startMode(game, game.mode, game.level);
}

export function press(game, patch) {
  if (!game.state) return null;
  return setInput(game.state, patch);
}

export function releaseAllInputs(game) {
  if (!game.state) return null;
  return releaseAll(game.state);
}

export function tick(game, dt) {
  if (!game.state) return [];
  stepFrame(game.state, dt);
  if (!game.result && game.state.ended) game.result = summarize(game);
  return drainEvents(game.state);
}

export { goalProgress, radarScan };

/** 汇总本局战报（不写盘）。 */
export function summarize(game) {
  const state = game.state;
  if (!state) return null;
  const cfg = state.config;
  const won = state.phase === "won";
  const floors = Math.max(0, Math.round(state.depth));
  const hp = Math.max(0, Math.round(state.player.hp));
  const maxHp = state.player.maxHp;
  const elapsed = Math.max(0, state.elapsed);
  const score = computeScore({ floors, hp, elapsed, parTime: cfg.parTime });
  const stars = game.mode === "campaign" ? computeStars({ won, hp, maxHp, elapsed, parTime: cfg.parTime }) : 0;
  return {
    mode: game.mode,
    level: game.level,
    seed: game.seed,
    won,
    lost: state.phase === "lost",
    reason: state.endReason,
    floors,
    hp,
    maxHp,
    elapsed,
    score,
    stars,
    goalFloors: cfg.goalFloors,
    parTime: cfg.parTime,
    stats: { ...state.stats },
  };
}

export { MODES, LEVEL_COUNT };
