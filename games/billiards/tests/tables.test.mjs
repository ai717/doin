// Layout contract: determinism, legality and the solvability audit.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  TABLES, DEFAULT_TABLE, getTable, buildLayout, auditLayout, firstContactSet,
  pottableShots, nextTableId, tableIndex, versusLayout,
} from "../js/tables.mjs";
import {
  BALL_R, MIN_X, MAX_X, MIN_Y, MAX_Y, insidePocketMouth, makeBall, createWorld,
  strike, settle, POCKETS,
} from "../js/engine.mjs";
import { pocketPoint } from "../js/tables.mjs";

describe("table manifest", () => {
  it("ships a progression of tables with unique ids", () => {
    assert.ok(TABLES.length >= 8);
    assert.equal(new Set(TABLES.map((t) => t.id)).size, TABLES.length);
    assert.equal(getTable(DEFAULT_TABLE).id, TABLES[0].id);
    assert.equal(getTable("__missing__").id, TABLES[0].id);
  });

  it("every table declares a par and a ball count", () => {
    for (const t of TABLES) {
      assert.ok(t.par >= 8 && t.par <= 40, `${t.id} par ${t.par}`);
      assert.ok(t.count >= 5 && t.count <= 15, `${t.id} count ${t.count}`);
      assert.equal(typeof t.seed, "number");
    }
  });

  it("walks forward through the list and stops at the end", () => {
    assert.equal(nextTableId(TABLES[0].id), TABLES[1].id);
    assert.equal(nextTableId(TABLES[TABLES.length - 1].id), null);
    assert.equal(tableIndex("__missing__"), 0);
  });
});

describe("layout generation", () => {
  it("is deterministic for a given id", () => {
    for (const t of TABLES) {
      const a = buildLayout(t.id);
      const b = buildLayout(t.id);
      assert.equal(a.layout.balls.length, b.layout.balls.length, `${t.id} ball count`);
      for (let i = 0; i < a.layout.balls.length; i += 1) {
        assert.ok(Math.abs(a.layout.balls[i].x - b.layout.balls[i].x) < 1e-12, `${t.id} x`);
        assert.ok(Math.abs(a.layout.balls[i].y - b.layout.balls[i].y) < 1e-12, `${t.id} y`);
      }
    }
  });

  it("never stacks balls or leaves the rails", () => {
    for (const t of TABLES) {
      const { layout } = buildLayout(t.id);
      for (const b of layout.balls) {
        assert.ok(b.x >= MIN_X && b.x <= MAX_X, `${t.id} x in bounds`);
        assert.ok(b.y >= MIN_Y && b.y <= MAX_Y, `${t.id} y in bounds`);
        assert.equal(insidePocketMouth(b.x, b.y, 0.1), false, `${t.id} not in a pocket`);
      }
      for (let i = 0; i < layout.balls.length; i += 1) {
        for (let j = i + 1; j < layout.balls.length; j += 1) {
          const d = Math.hypot(layout.balls[i].x - layout.balls[j].x, layout.balls[i].y - layout.balls[j].y);
          assert.ok(d >= BALL_R * 2 - 1e-9, `${t.id} gap ${d}`);
        }
      }
    }
  });

  it("always contains the cue ball, the 8 and the requested count", () => {
    for (const t of TABLES) {
      const { layout } = buildLayout(t.id);
      assert.equal(layout.balls.filter((b) => b.number === 0).length, 1, `${t.id} cue ball`);
      assert.equal(layout.balls.filter((b) => b.number === 8).length, 1, `${t.id} eight ball`);
      assert.equal(layout.balls.length, t.count + 1, `${t.id} total balls`);
    }
  });

  it("leaves the cue ball room to play", () => {
    for (const t of TABLES) {
      const { layout } = buildLayout(t.id);
      const cue = layout.balls.find((b) => b.number === 0);
      for (const b of layout.balls) {
        if (b === cue) continue;
        assert.ok(Math.hypot(b.x - cue.x, b.y - cue.y) > 2.5, `${t.id} cue has space`);
      }
    }
  });
});

describe("solvability audit", () => {
  it("every layout offers a legal first contact", () => {
    for (const t of TABLES) {
      const { layout, audit } = buildLayout(t.id);
      assert.ok(audit.contact > 0, `${t.id} has a legal first contact`);
      assert.ok(firstContactSet(layout, 360).length > 0, `${t.id} contact scan`);
    }
  });

  it("every layout except the rack offers a straight pot line", () => {
    for (const t of TABLES) {
      if (t.kind === "rack") continue;
      const { layout, audit } = buildLayout(t.id);
      assert.ok(audit.pots > 0, `${t.id} has a pottable ball`);
      assert.ok(pottableShots(layout).length > 0, `${t.id} pot scan`);
    }
  });

  it("the audit agrees with the generator output", () => {
    for (const t of TABLES) {
      const { layout } = buildLayout(t.id);
      const audit = auditLayout(layout);
      assert.equal(audit.ok, audit.contact > 0 && audit.pots > 0);
    }
  });

  it("a straight pot line actually drops when played", () => {
    const { layout } = buildLayout("table_2");
    const plan = pottableShots(layout).sort((a, b) => b.cut - a.cut)[0];
    assert.ok(plan, "a plan exists");
    const cue = layout.balls.find((b) => b.id === 0);
    const ball = layout.balls.find((b) => b.id === plan.ball);
    const point = pocketPoint(POCKETS.find((p) => p.id === plan.pocket));
    const angle = Math.atan2(point.y - ball.y, point.x - ball.x);
    const ghost = { x: ball.x - Math.cos(angle) * BALL_R * 2, y: ball.y - Math.sin(angle) * BALL_R * 2 };
    const world = createWorld(layout.balls);
    strike(world, Math.atan2(ghost.y - cue.y, ghost.x - cue.x), 0.6, "draw");
    settle(world, 9000);
    assert.equal(world.balls.find((b) => b.id === plan.ball).potted, true, "the planned ball drops");
  });
});

describe("versus layout", () => {
  it("builds a full rack with all fifteen object balls", () => {
    const balls = versusLayout(70001);
    assert.equal(balls.length, 16);
    assert.equal(new Set(balls.map((b) => b.number)).size, 16);
    assert.equal(balls.filter((b) => b.number === 0).length, 1);
  });

  it("the break shot sends balls to the rails", () => {
    const world = createWorld(versusLayout(70001));
    strike(world, -0.02, 1, "center");
    settle(world, 12000);
    const railBalls = new Set(world.events.filter((e) => e.type === "rail").map((e) => e.id));
    assert.ok(railBalls.size >= 4, `break drives balls to rails (${railBalls.size})`);
  });

  it("a rack with only the cue has no pottable scan", () => {
    const layout = { balls: [makeBall(0, 14, 14)] };
    assert.equal(pottableShots(layout).length, 0);
  });
});
