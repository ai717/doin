// Session controller: fixed-step driving, pause, level flow and mode switching.
// Strictly DOM-free so it can be exercised in plain Node.

import {
  createSession,
  step,
  pause as pauseSession,
  resume as resumeSession,
  togglePause as toggleSessionPause,
  drainEvents as drainSessionEvents,
  debugClearEnemies,
  debugSetPlayer,
  FIXED_DT,
} from "./engine.mjs";
import { TOTAL_LEVELS } from "./levels.mjs";

export function createGame(options = {}) {
  let session = createSession(options);
  let accumulator = 0;
  let input = { axis: 0, spray: false, jumpPressed: false };

  function tick(dt = FIXED_DT) {
    if (session.status !== "playing" || session.paused) return;
    accumulator += Math.min(0.12, Math.max(0, Number(dt) || 0));
    let steps = 0;
    while (accumulator + 1e-9 >= FIXED_DT && steps < 8) {
      const frameInput = {
        axis: input.axis,
        spray: input.spray,
        jumpPressed: input.jumpPressed,
      };
      input.jumpPressed = false;
      step(session, frameInput, FIXED_DT);
      accumulator -= FIXED_DT;
      steps += 1;
      if (session.status !== "playing") {
        accumulator = 0;
        break;
      }
    }
  }

  function setInput(next = {}) {
    if (typeof next.axis === "number") input.axis = Math.max(-1, Math.min(1, next.axis));
    if (typeof next.spray === "boolean") input.spray = next.spray;
    if (next.jumpPressed) input.jumpPressed = true;
  }

  function pressJump() {
    input.jumpPressed = true;
  }

  function pause() {
    pauseSession(session);
  }

  function resume() {
    resumeSession(session);
  }

  function togglePause() {
    toggleSessionPause(session);
  }

  function cursor() {
    return { mode: session.mode, levelIndex: session.levelIndex };
  }

  function carry() {
    return {
      lives: session.lives,
      score: session.score,
      levelIndex: session.levelIndex,
    };
  }

  function loadLevel(index, options = {}) {
    const carried = options.keepRun ? carry() : { lives: 3, score: 0 };
    session = createSession({
      mode: "level",
      levelIndex: index,
      lives: carried.lives,
      score: carried.score,
    });
    accumulator = 0;
    input = { axis: 0, spray: false, jumpPressed: false };
    return session;
  }

  function nextLevel() {
    if (session.mode !== "level") return loadLevel(session.levelIndex);
    if (session.levelIndex >= TOTAL_LEVELS - 1) return session;
    return loadLevel(session.levelIndex + 1, { keepRun: true });
  }

  function restart() {
    return loadLevel(session.levelIndex);
  }

  function setMode(mode) {
    const nextMode = mode === "rush" ? "rush" : "level";
    session = createSession({
      mode: nextMode,
      levelIndex: session.levelIndex,
      lives: 3,
      score: 0,
    });
    accumulator = 0;
    input = { axis: 0, spray: false, jumpPressed: false };
    return session;
  }

  function debugClear() {
    debugClearEnemies(session);
  }

  function debugTeleport(x, y) {
    debugSetPlayer(session, x, y);
  }

  function drainEvents() {
    return drainSessionEvents(session);
  }

  function snapshot() {
    const world = session.world;
    const player = world.player;
    return {
      mode: session.mode,
      status: session.status,
      paused: session.paused,
      levelIndex: session.levelIndex,
      levelId: session.level.id,
      levelNumber: session.levelIndex + 1,
      chapter: session.chapter,
      par: session.par,
      lives: session.lives,
      score: session.score,
      elapsed: session.elapsed,
      chain: session.chain,
      maxChain: session.maxChain,
      kills: session.kills,
      damaged: session.damaged,
      stars: session.stars,
      completed: session.completed,
      rushTime: session.rushTime,
      rushKills: session.rushKills,
      enemies: world.enemies.filter((enemy) => enemy.alive).length,
      snowballs: world.snowballs.length,
      rollingBalls: world.snowballs.filter((ball) => ball.rolling).length,
      ball: world.snowballs[0]
        ? {
            x: Math.round(world.snowballs[0].x),
            y: Math.round(world.snowballs[0].y),
            r: Math.round(world.snowballs[0].r),
            rolling: world.snowballs[0].rolling,
            vx: Math.round(world.snowballs[0].vx),
          }
        : null,
      player: {
        x: Math.round(player.x * 10) / 10,
        y: Math.round(player.y * 10) / 10,
        onGround: player.onGround,
        spraying: player.spray,
        invuln: Math.round(player.invuln * 10) / 10,
        respawn: Math.round(player.respawn * 10) / 10,
      },
      bossHp: world.enemies.find((enemy) => enemy.type === "boss" && enemy.alive)?.hp ?? 0,
      bossMax: world.enemies.find((enemy) => enemy.type === "boss" && enemy.alive)?.maxHp ?? 0,
    };
  }

  return {
    tick,
    setInput,
    pressJump,
    pause,
    resume,
    togglePause,
    loadLevel,
    nextLevel,
    restart,
    setMode,
    cursor,
    drainEvents,
    snapshot,
    debugClear,
    debugTeleport,
    get session() {
      return session;
    },
  };
}
