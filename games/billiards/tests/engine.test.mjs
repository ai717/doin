// Engine contract: geometry, spin physics, CCD, determinism, invariants.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BALL_R, TABLE_W, TABLE_H, MIN_X, MAX_X, MIN_Y, MAX_Y, POCKETS, PHYS, SPINS,
  mulberry32, makeBall, createWorld, cloneWorld, strike, settle, stepWorld,
  isMoving, buildRack, rackPositions, traceShot, placeBall, strikePowerToSpeed,
  liveBalls, overlapsAny, insidePocketMouth, CENTRE_SLOT, CORNER_SLOTS,
} from "../js/engine.mjs";
import { pocketPoint } from "../js/tables.mjs";

const settleDown = (world) => settle(world, 8000);

function straightShot(distance = 6, power = 0.55, spin = "center") {
  // cue at x=14 travelling along +x into an object ball `distance` ahead
  const world = createWorld([makeBall(0, 14, 14), makeBall(3, 14 + distance, 14)]);
  strike(world, 0, power, spin);
  let frames = 0;
  let objectReach = 0;
  while (isMoving(world) && frames < 8000) {
    stepWorld(world, PHYS.dt);
    frames += 1;
    objectReach = Math.max(objectReach, world.balls[1].x);
  }
  return { world, cue: world.balls[0], object: world.balls[1], objectReach };
}

describe("table geometry", () => {
  it("plays surface keeps the classic 2:1 shape", () => {
    assert.equal(TABLE_W, TABLE_H * 2);
    assert.equal(MIN_X, BALL_R);
    assert.equal(MAX_Y, TABLE_H - BALL_R);
  });

  it("carries six pockets: four corners and two middles", () => {
    assert.equal(POCKETS.length, 6);
    assert.equal(POCKETS.filter((p) => p.kind === "corner").length, 4);
    assert.equal(POCKETS.filter((p) => p.kind === "middle").length, 2);
  });

  it("pocket helpers describe the same target the renderer uses", () => {
    for (const p of POCKETS) {
      const point = pocketPoint(p);
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    }
  });
});

describe("rack", () => {
  it("holds 16 balls with the 8 on the centre slot", () => {
    const rack = buildRack(20250101);
    assert.equal(rack.length, 16);
    assert.equal(rack[0].number, 0, "cue leads the list");
    assert.equal(rack[CENTRE_SLOT + 1].number, 8, "the 8 sits on the triangle centre");
  });

  it("never overlaps and stays inside the rails", () => {
    for (const seed of [1, 77, 4096, 90210]) {
      const rack = buildRack(seed);
      for (let i = 0; i < rack.length; i += 1) {
        assert.ok(rack[i].x >= MIN_X && rack[i].x <= MAX_X, `x in bounds (${seed})`);
        assert.ok(rack[i].y >= MIN_Y && rack[i].y <= MAX_Y, `y in bounds (${seed})`);
        for (let j = i + 1; j < rack.length; j += 1) {
          const d = Math.hypot(rack[i].x - rack[j].x, rack[i].y - rack[j].y);
          assert.ok(d >= BALL_R * 2 - 1e-9, `rack gap ${d} (${seed})`);
        }
      }
    }
  });

  it("keeps the traditional mixed back corners", () => {
    for (const seed of [3, 31, 313, 3131]) {
      const rack = buildRack(seed);
      const [a, b] = CORNER_SLOTS.map((slot) => rack[slot + 1].number);
      const isSolid = (n) => n > 0 && n < 8;
      assert.notEqual(isSolid(a), isSolid(b), `corners mixed (${seed})`);
    }
  });

  it("rack slots form a triangle of 15 positions", () => {
    assert.equal(rackPositions().length, 15);
  });
});

describe("spin physics", () => {
  it("centre hit stops the cue ball just past the contact point", () => {
    const { cue } = straightShot(6, 0.55, "center");
    assert.ok(Math.abs(cue.x - 19) < 3, `cue stops near contact, got ${cue.x}`);
  });

  it("follow drives the cue ball forward past the contact", () => {
    const follow = straightShot(6, 0.55, "follow").cue;
    const draw = straightShot(6, 0.55, "draw").cue;
    assert.ok(follow.x > draw.x + 4, "follow travels further than draw");
    assert.ok(follow.x > 21, `follow runs past the contact, got ${follow.x}`);
  });

  it("draw pulls the cue ball back behind the contact", () => {
    const center = straightShot(6, 0.55, "center").cue;
    const draw = straightShot(6, 0.55, "draw").cue;
    assert.ok(draw.x < center.x - 2, "draw comes back");
  });

  it("every spin still drives the object ball down the line", () => {
    for (const spin of SPINS) {
      const shot = straightShot(6, 0.55, spin);
      assert.ok(shot.objectReach > 34, `${spin} drives the object down table (${shot.objectReach})`);
    }
  });

  it("power maps monotonically to strike speed", () => {
    const slow = strikePowerToSpeed(0.1);
    const fast = strikePowerToSpeed(1);
    assert.ok(fast > slow);
    assert.ok(slow >= PHYS.minShotSpeed && fast <= PHYS.maxShotSpeed);
  });
});

describe("aim tracing", () => {
  it("reports the first ball on the line", () => {
    const world = createWorld([makeBall(0, 10, 14), makeBall(5, 30, 14), makeBall(2, 40, 14)]);
    const hit = traceShot(world, 0);
    assert.ok(hit);
    assert.equal(hit.type, "ball");
    assert.equal(hit.ball.id, 5);
  });

  it("reports the rail when the path is clear", () => {
    const world = createWorld([makeBall(0, 10, 14)]);
    const hit = traceShot(world, 0);
    assert.equal(hit.type, "rail");
    assert.ok(Math.abs(hit.x - MAX_X) < 1e-6);
  });
});

describe("continuous collision", () => {
  it("resolves contact at the separation boundary, not late", () => {
    const world = createWorld([makeBall(0, 14, 14), makeBall(9, 40, 14)]);
    strike(world, 0, 1, "center");
    let worst = Infinity;
    let frames = 0;
    while (isMoving(world) && frames < 6000) {
      stepWorld(world, PHYS.dt);
      const [a, b] = world.balls;
      worst = Math.min(worst, Math.hypot(a.x - b.x, a.y - b.y));
      frames += 1;
    }
    assert.ok(worst > BALL_R * 2 - 0.05, `no deep overlap, worst gap ${worst}`);
    assert.ok(world.balls[1].vx !== 0 || world.balls[1].x !== 40, "object ball was struck");
  });

  it("does not tunnel through a packed row at full power", () => {
    const balls = [makeBall(0, 4, 14)];
    for (let i = 0; i < 6; i += 1) balls.push(makeBall(i + 1, 14 + i * 1.02, 14));
    const world = createWorld(balls);
    strike(world, 0, 1, "center");
    let frames = 0;
    let firstClack = null;
    while (isMoving(world) && frames < 8000) {
      stepWorld(world, PHYS.dt);
      frames += 1;
      if (!firstClack) firstClack = world.events.find((e) => e.type === "clack") ?? null;
    }
    const row = world.balls.slice(1).sort((a, b) => a.x - b.x);
    const packed = row.filter((b) => !b.potted);
    for (let i = 1; i < packed.length; i += 1) {
      const order = packed[i].x >= packed[i - 1].x;
      assert.equal(order, true, "row keeps its order, nothing slipped through");
    }
    assert.ok(firstClack, "a collision was recorded");
    assert.equal(Math.min(firstClack.a, firstClack.b), 0, "the cue opens the exchange");
    assert.equal(Math.max(firstClack.a, firstClack.b), 1, "the leading ball is hit first");
  });

  it("clamps speed to the configured ceiling", () => {
    const world = createWorld([makeBall(0, 14, 14)]);
    strike(world, 0, 1, "follow");
    let frames = 0;
    let peak = 0;
    while (isMoving(world) && frames < 4000) {
      stepWorld(world, PHYS.dt);
      frames += 1;
      const c = world.balls[0];
      peak = Math.max(peak, Math.hypot(c.vx, c.vy), Math.hypot(c.rvx, c.rvy));
    }
    assert.ok(peak <= PHYS.maxSpeed + 1e-6, `peak ${peak}`);
  });
});

describe("determinism", () => {
  it("replays the same frame by frame", () => {
    const build = () => {
      const w = createWorld(buildRack(4242), { seed: 4242 });
      strike(w, -0.7, 0.92, "follow");
      return w;
    };
    const a = build();
    const b = build();
    let frames = 0;
    while ((isMoving(a) || isMoving(b)) && frames < 6000) {
      stepWorld(a, PHYS.dt);
      stepWorld(b, PHYS.dt);
      frames += 1;
      for (let i = 0; i < a.balls.length; i += 1) {
        assert.equal(a.balls[i].x, b.balls[i].x, `ball ${i} x at frame ${frames}`);
        assert.equal(a.balls[i].y, b.balls[i].y, `ball ${i} y at frame ${frames}`);
        assert.equal(a.balls[i].vx, b.balls[i].vx);
      }
    }
    assert.equal(a.balls.length, b.balls.length);
    assert.ok(frames > 60, "the break actually ran");
  });

  it("clone snapshots detach from further simulation", () => {
    const world = createWorld([makeBall(0, 10, 10), makeBall(1, 30, 10)]);
    strike(world, 0, 0.6, "center");
    const snapshot = cloneWorld(world);
    settleDown(world);
    assert.notEqual(snapshot.balls[0].x, world.balls[0].x);
  });
});

describe("pockets", () => {
  it("captures a ball rolling into a corner", () => {
    const world = createWorld([makeBall(0, 20, 14), makeBall(4, 30, 14)]);
    // aim the object straight at the top-right corner
    const point = pocketPoint(POCKETS.find((p) => p.id === "tr"));
    const angle = Math.atan2(point.y - world.balls[1].y, point.x - world.balls[1].x);
    const ghost = {
      x: world.balls[1].x - Math.cos(angle) * BALL_R * 2,
      y: world.balls[1].y - Math.sin(angle) * BALL_R * 2,
    };
    strike(world, Math.atan2(ghost.y - 14, ghost.x - 20), 0.6, "draw");
    settleDown(world);
    assert.equal(world.balls[1].potted, true, "object ball drops");
  });

  it("never captures a ball parked mid table", () => {
    const world = createWorld([makeBall(0, 28, 14)]);
    strike(world, 0, 0.2, "center");
    settleDown(world);
    assert.equal(world.balls[0].potted, false);
  });

  it("counts potted balls only once", () => {
    const world = createWorld([makeBall(0, 20, 14), makeBall(4, 30, 14)]);
    const point = pocketPoint(POCKETS.find((p) => p.id === "tr"));
    const angle = Math.atan2(point.y - 14, point.x - 30);
    const ghost = { x: 30 - Math.cos(angle) * BALL_R * 2, y: 14 - Math.sin(angle) * BALL_R * 2 };
    strike(world, Math.atan2(ghost.y - 14, ghost.x - 20), 0.6, "draw");
    settleDown(world);
    const drops = world.events.filter((e) => e.type === "pocket" && e.id === 4);
    assert.equal(drops.length, 1);
  });
});

describe("ball placement", () => {
  it("refuses spots inside a pocket mouth or on another ball", () => {
    const world = createWorld([makeBall(0, 20, 14), makeBall(5, 30, 14)]);
    assert.equal(placeBall(world, 0, 30, 14), false, "occupied");
    assert.equal(placeBall(world, 0, 28, MIN_Y + 0.1), false, "pocket mouth");
    assert.equal(placeBall(world, 0, 24, 14), true);
  });

  it("clamps into the rails instead of escaping", () => {
    const world = createWorld([makeBall(0, 20, 14)]);
    placeBall(world, 0, -50, 14);
    assert.ok(world.balls[0].x >= MIN_X);
  });

  it("helpers agree with the geometry they police", () => {
    const world = createWorld([makeBall(0, 20, 14), makeBall(7, 21, 14)]);
    assert.equal(overlapsAny(world.balls, 20.5, 14, null, 0), true);
    assert.equal(overlapsAny(world.balls, 40, 14, null, 0), false);
    assert.equal(insidePocketMouth(28, MIN_Y + 0.2, 0.2), true);
  });
});

describe("random walk invariants", () => {
  it("survives 1200 randomised steps without breaking physics", () => {
    const rng = mulberry32(0xB17A);
    const world = createWorld(buildRack(99127), { seed: 99127 });
    let shots = 0;
    let violations = 0;
    while (shots < 1200) {
      const cue = world.balls.find((b) => b.number === 0 && !b.potted);
      if (!cue) {
        const spot = { x: 14, y: 14 };
        const placeholder = world.balls.find((b) => b.number === 0);
        if (placeholder) placeBall(world, 0, spot.x, spot.y);
        placeholder.potted = false;
        continue;
      }
      const targets = world.balls.filter((b) => !b.potted && b.number !== 0);
      const angle = targets.length
        ? Math.atan2(targets[Math.floor(rng() * targets.length)].y - cue.y,
          targets[Math.floor(rng() * targets.length)].x - cue.x)
        : rng() * Math.PI * 2;
      strike(world, angle + (rng() - 0.5) * 0.6, 0.2 + rng() * 0.8, SPINS[Math.floor(rng() * SPINS.length)]);
      settleDown(world);
      shots += 1;

      for (const b of world.balls) {
        if (b.potted) continue;
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) violations += 1;
        if (b.x < MIN_X - 1e-9 || b.x > MAX_X + 1e-9) violations += 1;
        if (b.y < MIN_Y - 1e-9 || b.y > MAX_Y + 1e-9) violations += 1;
      }
      const live = liveBalls(world);
      for (let i = 0; i < live.length; i += 1) {
        for (let j = i + 1; j < live.length; j += 1) {
          const d = Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y);
          if (d < BALL_R * 2 - 0.08) violations += 1;
        }
      }
      if (isMoving(world)) violations += 1;
    }
    assert.equal(violations, 0, `invariant violations: ${violations}`);
    assert.equal(world.balls.length, 16, "ball count is conserved");
  });
});
