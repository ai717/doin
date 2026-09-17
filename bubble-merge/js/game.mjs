// game：DOM-free 对局控制器。持有当前 state 与注入的 rng，收 UI 意图 → 调 engine。
// 规则判定不在这里做；页面 / 渲染层不得旁路改 game.state。

import { applyIntent, createState, stepFrame } from "./engine.mjs?v=35ad794d8cf9";

export function createGame(run = {}, { rng = Math.random, mode = "endless", seed = null } = {}) {
  return { rng, state: createState(run, { rng, mode, seed }) };
}

export function dispatch(game, intent) {
  const result = applyIntent(game.state, intent, { rng: game.rng });
  game.state = result.state;
  return result;
}

// 推进一个固定步 FIXED_DT（帧率无关由 main 的累加器保证）。
export function advanceFrame(game) {
  const result = stepFrame(game.state, { rng: game.rng });
  game.state = result.state;
  return result;
}

// 一局结果快照，供 storage 落盘。
export function snapshot(game) {
  const { score, maxLevel, maxChain, mode, pops } = game.state;
  return { score, maxLevel, maxChain, mode, pops };
}
