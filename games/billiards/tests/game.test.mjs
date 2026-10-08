// Controller contract: turn flow, ball in hand, solo rescue and a long walk.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createGame, restart, loadTable, advanceTable, update, shoot, setAim, nudgeAim,
  setPower, nudgePower, cycleSpin, placeCueBall, moveCueBall, commitCueBall,
  autoPlaceCue, canShoot, canPlaceCue, legalTargetsOf, snapshot, drainEvents,
  randomViableShot, runUntilRest,
} from "../js/game.mjs";
import { mulberry32, PHYS, BALL_R, MIN_X, MAX_X, MIN_Y, MAX_Y, SPINS } from "../js/engine.mjs";
import { TABLES } from "../js/tables.mjs";

const step = (game, frames = 6000) => {
  let n = 0;
  while (game.phase === "resolving" && n < frames) {
    update(game, PHYS.dt);
    n += 1;
  }
  return n;
};

describe("controller lifecycle", () => {
  it("starts aiming and resolves back to aiming after a shot", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    assert.equal(game.phase, "aim");
    assert.equal(canShoot(game), true);
    shoot(game, { angle: 0.2, power: 0.5, spin: "center" });
    assert.equal(game.phase, "resolving");
    assert.equal(canShoot(game), false);
    const frames = step(game);
    assert.ok(frames > 10, "the shot actually simulated");
    assert.ok(["aim", "placing", "over"].includes(game.phase), `phase ${game.phase}`);
  });

  it("reports the shot outcome", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    shoot(game, { angle: 0.2, power: 0.5, spin: "center" });
    step(game);
    assert.ok(game.report, "a report exists");
    assert.equal(typeof game.report.foul, "boolean");
    assert.ok(Array.isArray(game.report.potted));
    assert.equal(game.rules.shots[0], 1);
  });

  it("keeps aim, power and spin inside their ranges", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    nudgeAim(game, -10);
    assert.ok(game.aim.angle >= 0 && game.aim.angle <= Math.PI * 2);
    nudgePower(game, 5);
    assert.equal(game.aim.power, 1);
    nudgePower(game, -20);
    assert.equal(game.aim.power, 0);
    setPower(game, 0.4);
    assert.equal(game.aim.power, 0.4);
    setAim(game, 1.2);
    assert.ok(Math.abs(game.aim.angle - 1.2) < 1e-9, `angle ${game.aim.angle}`);
    setAim(game, -0.5);
    assert.ok(Math.abs(game.aim.angle - (Math.PI * 2 - 0.5)) < 1e-9, `wrap ${game.aim.angle}`);
    assert.ok(SPINS.includes(cycleSpin(game, 1)));
    assert.ok(SPINS.includes(cycleSpin(game, -1)));
  });
});

describe("ball in hand", () => {
  it("drags the cue ball and commits on confirm", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    game.rules.ballInHand = true;
    game.phase = "placing";
    assert.equal(canPlaceCue(game), true);
    assert.equal(canShoot(game), false, "must place before shooting");
    assert.equal(moveCueBall(game, 20, 12), true);
    assert.equal(game.rules.ballInHand, true, "still holding until committed");
    assert.equal(commitCueBall(game), true);
    assert.equal(game.rules.ballInHand, false);
    assert.equal(game.phase, "aim");
    assert.equal(canShoot(game), true);
  });

  it("refuses illegal spots and offers an auto placement", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    game.rules.ballInHand = true;
    const occupied = game.world.balls.find((b) => b.id !== 0);
    assert.equal(moveCueBall(game, occupied.x, occupied.y), false);
    assert.equal(autoPlaceCue(game), true);
    assert.equal(game.rules.ballInHand, false);
  });

  it("placeCueBall places and commits in one call", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    game.rules.ballInHand = true;
    assert.equal(placeCueBall(game, 18, 12), true);
    assert.equal(game.rules.ballInHand, false);
  });
});

describe("solo trial flow", () => {
  it("reloads and walks through layouts", () => {
    const game = createGame({ mode: "clear", tableId: "table_1" });
    assert.equal(game.tableId, "table_1");
    loadTable(game, "table_4");
    assert.equal(game.tableId, "table_4");
    assert.equal(advanceTable(game), true);
    assert.equal(game.tableId, "table_5");
    loadTable(game, TABLES[TABLES.length - 1].id);
    assert.equal(advanceTable(game), false, "no table after the last one");
  });

  it("restart clears the board state", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    shoot(game, { angle: 0.2, power: 0.7, spin: "center" });
    step(game);
    restart(game);
    assert.equal(game.phase, "aim");
    assert.equal(game.rules.shots[0], 0);
    assert.equal(game.rules.fouls[0], 0);
    assert.equal(game.world.balls.filter((b) => b.potted).length, 0);
  });

  it("respots the 8 instead of dead ending the trial", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    const eight = game.world.balls.find((b) => b.id === 8);
    // drive the 8 into a pocket by hand, then run an empty shot through resolve
    eight.potted = true;
    game.shotEvents = [{ type: "pocket", id: 8, kind: "eight" }, { type: "clack", a: 0, b: 8, speed: 10 }];
    game.phase = "resolving";
    update(game, PHYS.dt);
    assert.equal(game.rules.phase === "over", false, "the trial keeps going");
    assert.equal(game.world.balls.find((b) => b.id === 8).potted, false, "the 8 is back on the table");
  });

  it("legal targets cover every object ball until only the 8 is left", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    const ids = legalTargetsOf(game).map((b) => b.id);
    assert.ok(ids.length >= 5);
    assert.equal(ids.includes(8), false);
  });
});

describe("versus mode", () => {
  it("hands the table over after a miss", () => {
    const game = createGame({ mode: "duel", seed: 70001 });
    game.rules.breakPending = false;
    shoot(game, { angle: Math.PI, power: 0.2, spin: "center" });
    step(game);
    const snap = snapshot(game);
    assert.ok(snap.shots[0] >= 1);
    if (!game.report?.foul && game.report?.potted?.length === 0) {
      assert.equal(snap.playerTurn, 1, "clean miss hands over");
    }
  });

  it("snapshot exposes everything the HUD needs", () => {
    const game = createGame({ mode: "duel", seed: 70001 });
    const snap = snapshot(game);
    assert.equal(snap.mode, "duel");
    assert.equal(snap.groupRemain.solid, 7);
    assert.equal(snap.groupRemain.stripe, 7);
    assert.equal(snap.groupRemain.eight, 1);
    assert.ok(Array.isArray(snap.groups));
  });
});

describe("event plumbing", () => {
  it("drains queued events exactly once", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    shoot(game, { angle: 0.2, power: 0.6, spin: "center" });
    step(game);
    const first = drainEvents(game);
    const second = drainEvents(game);
    assert.ok(first.length > 0, "events were produced");
    assert.equal(second.length, 0, "the queue is cleared");
  });

  it("runUntilRest never overruns the frame budget", () => {
    const game = createGame({ mode: "clear", tableId: "table_2" });
    shoot(game, { angle: 0.2, power: 1, spin: "follow" });
    const frames = runUntilRest(game, 6000);
    assert.ok(frames > 0 && frames <= 6000);
    assert.notEqual(game.phase, "resolving");
  });
});

describe("random walk", () => {
  it("drives 1000 randomised shots through the controller", () => {
    const rng = mulberry32(0x8A11);
    const game = createGame({ mode: "clear", tableId: "table_1" });
    let shots = 0;
    let problems = 0;
    let fouls = 0;
    let potted = 0;
    while (shots < 1000 && problems === 0) {
      if (game.rules.ballInHand) {
        if (!autoPlaceCue(game)) problems += 1;
        commitCueBall(game);
      }
      if (game.rules.phase === "over") {
        restart(game);
        continue;
      }
      const plan = randomViableShot(rng, game);
      if (!plan) {
        restart(game);
        continue;
      }
      if (!shoot(game, plan)) problems += 1;
      const frames = step(game);
      if (frames >= 6000) problems += 1;
      shots += 1;
      if (game.report?.foul) fouls += 1;
      potted += game.report?.potted?.length ?? 0;

      for (const b of game.world.balls) {
        if (b.potted) continue;
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) problems += 1;
        if (b.x < MIN_X - 1e-6 || b.x > MAX_X + 1e-6) problems += 1;
        if (b.y < MIN_Y - 1e-6 || b.y > MAX_Y + 1e-6) problems += 1;
      }
      const live = game.world.balls.filter((b) => !b.potted);
      for (let i = 0; i < live.length; i += 1) {
        for (let j = i + 1; j < live.length; j += 1) {
          if (Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y) < BALL_R * 2 - 0.1) problems += 1;
        }
      }
    }
    assert.equal(problems, 0, `problems detected: ${problems}`);
    assert.equal(shots, 1000, "the walk completed");
    assert.ok(fouls > 0, "random play does commit fouls");
    assert.ok(potted > 0, "random play does pot balls");
  });
});
