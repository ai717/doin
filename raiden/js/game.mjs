// DOM-free state controller: fixed-step ticking, intent buffering and stage flow.

import {
  FIXED_DT,
  createSession,
  debugCharge,
  debugClearStage,
  debugSpawnBoss,
  debugTeleport,
  drainEvents,
  nudgePlayer,
  pause as pauseSession,
  resume as resumeSession,
  step,
  togglePause as toggleSessionPause,
} from "./engine.mjs";
import { STAGES, TRAINING } from "./levels.mjs";

export function createGame(options = {}) {
  let stageIndex = Math.max(0, Math.min(STAGES.length - 1, Math.floor(Number(options.stageIndex) || 0)));
  let mode = options.mode === "training" ? "training" : "stage";
  let session = createSession({
    mode,
    stageIndex,
    lives: options.lives,
    bombs: options.bombs,
    weapon: options.weapon,
  });
  let stageStartScore = 0;
  let accumulator = 0;
  let bombPulse = false;
  const input = { axisX: 0, axisY: 0, slow: false, charge: false };

  function resetSession(nextMode, nextIndex, carried = null) {
    mode = nextMode === "training" ? "training" : "stage";
    stageIndex = Math.max(0, Math.min(STAGES.length - 1, Math.floor(Number(nextIndex) || 0)));
    session = createSession({
      mode,
      stageIndex,
      lives: carried?.lives ?? 3,
      bombs: carried?.bombs ?? 2,
      weapon: carried?.weapon ?? 1,
      score: carried?.score ?? 0,
    });
    stageStartScore = carried?.score ?? 0;
    accumulator = 0;
    bombPulse = false;
    input.axisX = 0;
    input.axisY = 0;
    input.charge = false;
  }

  function tick(dt) {
    if (session.status !== "playing" || session.paused) {
      accumulator = 0;
      return;
    }
    accumulator += Math.min(Number(dt) || 0, 0.25);
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 8) {
      const frameInput = {
        axisX: input.axisX,
        axisY: input.axisY,
        slow: input.slow,
        charge: input.charge,
        bombPressed: bombPulse,
      };
      bombPulse = false;
      step(session, frameInput, FIXED_DT);
      accumulator -= FIXED_DT;
      steps += 1;
      if (session.status !== "playing") break;
    }
    if (steps === 8) accumulator = 0;
  }

  function snapshot() {
    const world = session.world;
    return {
      mode: session.mode,
      status: session.status,
      paused: session.paused,
      stageIndex: session.stageIndex,
      stageNumber: session.mode === "training" ? 0 : session.stageIndex + 1,
      stageId: session.stage.id,
      lives: session.lives,
      bombs: session.bombs,
      bombEnergy: Math.round(session.bombEnergy),
      bombsUsed: session.bombsUsed,
      weapon: session.weapon,
      score: session.score,
      kills: session.kills,
      graze: session.graze,
      maxGraze: session.maxGraze,
      damaged: session.damaged,
      stars: session.stars,
      completed: session.completed,
      time: session.time,
      stageTime: session.stageTime,
      trainingLeft: session.mode === "training" ? Math.max(0, TRAINING.duration - session.stageTime) : 0,
      charge: session.world.player.charge,
      charging: session.world.player.charging,
      bossHp: session.boss?.hp ?? 0,
      bossMax: session.boss?.maxHp ?? 0,
      bossActive: Boolean(session.boss && !session.boss.enter),
      enemies: world.enemies.length,
      playerBullets: world.bullets.length,
      enemyBullets: world.enemyBullets.length,
      items: world.items.length,
      player: {
        x: Math.round(world.player.x * 10) / 10,
        y: Math.round(world.player.y * 10) / 10,
        invuln: Math.round(world.player.invuln * 10) / 10,
        hits: world.player.hits,
      },
    };
  }

  return {
    tick,
    setAxis(x, y = 0) {
      input.axisX = Math.max(-1, Math.min(1, Number(x) || 0));
      input.axisY = Math.max(-1, Math.min(1, Number(y) || 0));
    },
    setSlow(active) {
      input.slow = Boolean(active);
    },
    setCharge(active) {
      input.charge = Boolean(active);
    },
    pressBomb() {
      bombPulse = true;
    },
    dragBy(dx, dy) {
      if (session.status !== "playing" || session.paused) return;
      nudgePlayer(session, dx, dy);
    },
    pause() {
      pauseSession(session);
    },
    resume() {
      resumeSession(session);
    },
    togglePause() {
      toggleSessionPause(session);
    },
    loadStage(index) {
      resetSession("stage", index);
    },
    loadTraining() {
      resetSession("training", 0);
    },
    nextStage() {
      if (session.mode !== "stage" || session.stageIndex >= STAGES.length - 1) return false;
      resetSession("stage", session.stageIndex + 1, {
        lives: session.lives,
        bombs: session.bombs,
        weapon: session.weapon,
        score: session.score,
      });
      return true;
    },
    restart() {
      resetSession(session.mode, session.stageIndex, {
        lives: 3,
        bombs: 2,
        weapon: 1,
        score: stageStartScore,
      });
    },
    setMode(nextMode) {
      resetSession(nextMode, stageIndex);
    },
    drainEvents() {
      return drainEvents(session);
    },
    snapshot,
    debugWin() {
      debugClearStage(session);
    },
    debugTeleport(x, y) {
      debugTeleport(session, x, y);
    },
    debugSpawnBoss() {
      debugSpawnBoss(session);
    },
    debugCharge(value) {
      debugCharge(session, value);
    },
    get session() {
      return session;
    },
    get mode() {
      return mode;
    },
    get stageIndex() {
      return stageIndex;
    },
  };
}
