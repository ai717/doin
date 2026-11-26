// game：DOM-free 对局控制器。收 UI 意图 → 调 engine，持有当前 state。
// 规则判定一律不在这里做，页面代码不得直接改 game.state。

import { applyIntent, createState, stepFrame } from "./engine.mjs";

export function createGame(run = {}, { rng = Math.random } = {}) {
  return { rng, state: createState(run, { rng }) };
}

export function dispatch(game, intent) {
  const result = applyIntent(game.state, intent, { rng: game.rng });
  game.state = result.state;
  return result;
}

export function advanceFrame(game) {
  const result = stepFrame(game.state, { rng: game.rng });
  game.state = result.state;
  return result;
}

// 跨关卡携带的资产快照，供 storage 落盘。
export function currentRun(game) {
  const { level, money, dynamite, potion, polish } = game.state;
  return { level, money, dynamite, potion, polish };
}
