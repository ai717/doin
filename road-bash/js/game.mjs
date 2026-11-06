// game.mjs — DOM-free 状态控制器。收 UI 意图，调度 engine，不碰 document / window / localStorage。

import { applyIntent, createRace, drainEvents, isTerminal, stepFrame, summarize } from "./engine.mjs";
import { BRAWL_COUNT, GETAWAY_COUNT, LEAGUE_COUNT, nextBrawlId, nextGetawayId, nextLeagueId } from "./levels.mjs";

export function createGame() {
  return {
    scene: "garage",
    mode: "league",
    raceId: 0,
    bikeId: 0,
    race: null,
    lastResult: null,
    cruise: true,
  };
}

export function selectMode(game, mode) {
  if (mode === "brawl" || mode === "getaway" || mode === "league") game.mode = mode;
  if (game.mode === "league") game.raceId = Math.min(game.raceId, LEAGUE_COUNT - 1);
  if (game.mode === "brawl") game.raceId = Math.min(game.raceId, BRAWL_COUNT - 1);
  if (game.mode === "getaway") game.raceId = Math.min(game.raceId, GETAWAY_COUNT - 1);
  return game;
}

export function selectRace(game, raceId) {
  game.raceId = Math.max(0, Math.trunc(Number(raceId) || 0));
  selectMode(game, game.mode);
  return game;
}

export function selectBike(game, bikeId) {
  game.bikeId = Math.max(0, Math.trunc(Number(bikeId) || 0));
  return game;
}

export function startRace(game, { seed } = {}) {
  game.race = createRace({
    mode: game.mode,
    raceId: game.raceId,
    bikeId: game.bikeId,
    seed,
  });
  if (game.cruise) {
    applyIntent(game.race, { type: "set-input", cruise: true });
  }
  game.scene = "race";
  game.lastResult = null;
  return game.race;
}

export function restartRace(game) {
  return startRace(game);
}

export function toGarage(game) {
  game.scene = "garage";
  game.race = null;
  return game;
}

export function dispatch(game, intent) {
  if (!game.race) return { state: null, action: null, events: [] };
  const result = applyIntent(game.race, intent);
  game.race = result.state;
  return result;
}

export function tick(game, dt) {
  if (!game.race) return [];
  const result = stepFrame(game.race, dt);
  game.race = result.state;
  if (isTerminal(game.race) && !game.lastResult) {
    game.lastResult = summarize(game.race);
  }
  return drainEvents(game.race);
}

export function nextRaceId(game) {
  if (game.mode === "brawl") return nextBrawlId(game.raceId);
  if (game.mode === "getaway") return nextGetawayId(game.raceId);
  return nextLeagueId(game.raceId);
}
