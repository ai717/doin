// 对局控制器：DOM-free。持有当前引擎 state、计时戳与操作计数，
// UI 永远只读 game.state，不自行推导棋盘。

import { STATUS_LOST, STATUS_PLAYING, STATUS_READY, STATUS_WON, applyIntent, createState, reveal } from "./engine.mjs";
import { resolveConfig } from "./level.mjs";
import { findSafeCell, pickNoGuessSeed } from "./solver.mjs";

export function createGame(config = {}) {
  // 走 resolveConfig：{difficulty} 能正确解析成预设，裸参数也能被夹取
  const normalized = resolveConfig(config);
  return {
    config: normalized,
    state: createState(normalized),
    startedAt: 0,
    finishedAt: 0,
    actionCount: 0,
  };
}

// 重开：可传新配置切难度。原地复用同一个 game 对象，UI 引用不失效。
export function restart(game, config = game.config) {
  game.config = resolveConfig(config);
  game.state = createState(game.config);
  game.startedAt = 0;
  game.finishedAt = 0;
  game.actionCount = 0;
  return game;
}

// 返回 action 字符串（reveal/flag/unflag/chord），无效果返回 null。
// 计时规则：第一次有效操作开始计时，终局冻结。
export function applyAction(game, type, index, now = Date.now()) {
  // 首击：先挑一个"全程无猜可解"的雷布局种子，再交给引擎布雷。
  // base 用 game.state.seed（createState 已随机化），保证每局布局不同。
  if (type === "reveal" && game.state.status === STATUS_READY) {
    const seed = pickNoGuessSeed(game.config, index, game.state.seed || 1);
    game.state = { ...game.state, seed };
  }
  const { state, action } = applyIntent(game.state, { type, index });
  if (!action) return null;
  game.state = state;
  game.actionCount += 1;
  if (!game.startedAt) game.startedAt = now;
  if (state.status === STATUS_WON || state.status === STATUS_LOST) game.finishedAt = now;
  return action;
}

// 运行时兜底：若走入"仍有安全格未揭但逻辑已穷尽"的死局，
// 免费透视揭示一个可证明安全格，永不让胜负由运气决定。
// 返回被揭示的索引；无需透视则返回 -1。
export function resolveDeadlock(game, now = Date.now()) {
  if (game.state.status !== STATUS_PLAYING) return -1;
  const safe = findSafeCell(game.state);
  if (safe === null) return -1; // 仍有可证明的安全步，等玩家自己走
  const next = reveal(game.state, safe);
  if (next === game.state) return -1;
  game.state = next;
  game.actionCount += 1;
  if (!game.startedAt) game.startedAt = now;
  return safe;
}

export function isOver(game) {
  return game.state.status === STATUS_WON || game.state.status === STATUS_LOST;
}

export function elapsedMs(game, now = Date.now()) {
  if (!game.startedAt) return 0;
  return (game.finishedAt || now) - game.startedAt;
}
