// game.mjs — DOM-free 状态控制器。收 UI 意图调度 engine，不碰 document / window / localStorage。

import {
  applyIntent,
  createMatch,
  drainEvents,
  isTerminal,
  stepFrame,
  summarize,
} from "./engine.mjs";
import { LEVEL_BY_ID, firstLevelId } from "./levels.mjs";

export function createGame(options = {}) {
  return {
    mode: options.mode === "arcade" ? "arcade" : "story",
    players: Number(options.players) === 2 ? 2 : 1,
    levelId: LEVEL_BY_ID[options.levelId] ? options.levelId : firstLevelId(),
    match: null,
    paused: false,
    lastResult: null,
    resultFresh: false,
    session: 0,
  };
}

export function selectMode(game, mode) {
  if (mode === "story" || mode === "arcade") game.mode = mode;
  return game.mode;
}

export function selectPlayers(game, players) {
  game.players = Number(players) === 2 ? 2 : 1;
  return game.players;
}

export function selectLevel(game, levelId) {
  if (LEVEL_BY_ID[levelId]) game.levelId = levelId;
  return game.levelId;
}

export function start(game, options = {}) {
  if (options.mode !== undefined) selectMode(game, options.mode);
  if (options.players !== undefined) selectPlayers(game, options.players);
  if (options.levelId !== undefined) selectLevel(game, options.levelId);
  if (game.mode === "story" && !LEVEL_BY_ID[game.levelId]) game.levelId = firstLevelId();
  const isArcade = game.mode === "arcade";
  game.match = createMatch({
    mode: isArcade ? "arcade" : "story",
    levelId: game.levelId,
    players: isArcade ? 1 : game.players,
    seed: options.seed,
  });
  game.paused = false;
  game.lastResult = null;
  game.resultFresh = false;
  game.session += 1;
  return game.match;
}

export function restart(game) {
  return start(game, { seed: undefined });
}

export function setPaused(game, value) {
  if (!game.match || isTerminal(game.match) || game.match.status === "continue") {
    game.paused = false;
    return false;
  }
  game.paused = Boolean(value);
  return game.paused;
}

export function togglePaused(game) {
  return setPaused(game, !game.paused);
}

export function dispatch(game, intent) {
  if (!game.match) return { state: null, action: null, events: [] };
  const bypassPause = intent?.type === "continue" || intent?.type === "input";
  if (game.paused && !bypassPause) {
    return { state: game.match, action: null, events: [] };
  }
  const result = applyIntent(game.match, intent);
  game.match = result.state;
  return result;
}

export function tick(game, dt) {
  if (!game.match) return { events: [], result: null, fresh: false };
  if (game.paused) return { events: [], result: game.lastResult, fresh: false };
  const result = stepFrame(game.match, dt);
  game.match = result.state;
  const events = drainEvents(game.match);
  let fresh = false;
  if (isTerminal(game.match) && !game.lastResult) {
    game.lastResult = summarize(game.match);
    game.resultFresh = true;
    fresh = true;
  }
  return { events, result: game.lastResult, fresh };
}

export function currentMatch(game) {
  return game.match;
}

export function currentStatus(game) {
  return game.match?.status ?? null;
}
