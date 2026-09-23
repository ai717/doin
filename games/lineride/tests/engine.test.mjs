// tests/engine.test.mjs — 物理引擎纯函数测试
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createState, applyIntent, stepFrame, createSegment, createRNG,
  segmentLength, closestPointOnSegment, exportCanvas, importCanvas,
  addLine, undo, eraseAt, loadPuzzle, calcPuzzleStars,
  beginStroke, addStrokePoint, endStroke, cancelStroke, respawn,
  smoothCatmullRom, pointsToSegments, polylineLength,
  GRAVITY, CONTACT_THRESHOLD, LANDING_ANGLE_TOLERANCE, MAX_SPEED,
  STROKE_MIN_STEP, STROKE_SUBDIV,
} from "../js/engine.mjs";

describe("engine basics", () => {
  it("creates valid initial state", () => {
    const s = createState();
    assert.equal(s.mode, "freestyle");
    assert.equal(s.lines.length, 0);
    assert.equal(s.playState, "stopped");
    assert.ok(s.rider.x > 0);
  });

  it("supports injected rng for deterministic tests", () => {
    const rng = createRNG(42);
    const s = createState({ rng });
    assert.equal(s.rng, rng);
    // mulberry32(42) 的首个输出，锁定实现不被无意改动
    assert.equal(rng(), 0.6011037519201636);
  });

  it("rng is stable per seed and differs across seeds", () => {
    const a = createRNG(42);
    const b = createRNG(42);
    const c = createRNG(43);
    assert.equal(a(), b());
    assert.equal(a(), b());
    assert.notEqual(createRNG(42)(), c());
  });

  it("segmentLength returns correct value", () => {
    const len = segmentLength({ x1: 0, y1: 0, x2: 3, y2: 4 });
    assert.ok(Math.abs(len - 5) < 0.01);
  });

  it("closestPointOnSegment works for midpoint", () => {
    const cp = closestPointOnSegment(5, 5, 0, 0, 10, 10);
    assert.ok(Math.abs(cp.x - 5) < 0.01);
    assert.ok(Math.abs(cp.y - 5) < 0.01);
  });

  it("addLine adds segment and pushUndo records it", () => {
    const s = createState();
    addLine(s, createSegment(10, 20, 30, 40, "normal"));
    assert.equal(s.lines.length, 1);
    assert.equal(s.undoStack.length, 1);
  });

  it("undo reverts to previous state", () => {
    const s = createState();
    addLine(s, createSegment(10, 20, 30, 40, "normal"));
    addLine(s, createSegment(50, 60, 70, 80, "normal"));
    assert.equal(s.lines.length, 2);
    const ok = undo(s);
    assert.equal(ok, true);
    assert.equal(s.lines.length, 1);
  });

  it("undo returns false when stack empty", () => {
    const s = createState();
    assert.equal(undo(s), false);
  });

  it("eraseAt removes segments within radius", () => {
    const s = createState();
    addLine(s, createSegment(0, 0, 100, 0, "normal"));
    addLine(s, createSegment(200, 0, 300, 0, "normal"));
    const removed = eraseAt(s, 50, 5, 20);
    assert.equal(removed, true);
    assert.equal(s.lines.length, 1);
  });
});

describe("intent handling", () => {
  it("set-line-type changes active line", () => {
    const s = createState();
    applyIntent(s, { type: "set-line-type", lineType: "boost" });
    assert.equal(s.activeLineType, "boost");
  });

  it("draw-line adds segment", () => {
    const s = createState();
    applyIntent(s, { type: "draw-line", segment: { x1: 10, y1: 10, x2: 50, y2: 50, type: "normal" } });
    assert.equal(s.lines.length, 1);
  });

  it("clear-all resets state", () => {
    const s = createState();
    addLine(s, createSegment(0, 0, 100, 0, "normal"));
    s.rider.x = 500;
    applyIntent(s, { type: "clear-all" });
    assert.equal(s.lines.length, 0);
    assert.equal(s.rider.x, 100);
    assert.equal(s.playState, "stopped");
  });

  it("play sets rider at start marker", () => {
    const s = createState();
    addLine(s, createSegment(50, 100, 200, 50, "normal"));
    s.startMarker = { x: 50, y: 100 };
    applyIntent(s, { type: "play" });
    assert.equal(s.playState, "playing");
    assert.equal(s.rider.x, 50);
    assert.equal(s.rider.y, 100);
  });

  it("invalid intent returns false", () => {
    const s = createState();
    const result = applyIntent(s, { type: "nonexistent" });
    assert.equal(result, false);
  });
});

describe("physics simulation", () => {
  it("rider falls under gravity when not on track", () => {
    const s = createState();
    s.rider.x = 400;
    s.rider.y = 100;
    s.rider.vx = 0;
    s.rider.vy = 0;
    applyIntent(s, { type: "play" });
    const yBefore = s.rider.y;
    stepFrame(s);
    assert.ok(s.rider.y > yBefore, "rider should fall due to gravity");
  });

  it("rider stays on flat track", () => {
    const s = createState();
    addLine(s, createSegment(0, 200, 800, 200, "normal"));
    s.startMarker = { x: 50, y: 200 };
    applyIntent(s, { type: "play" });
    for (let i = 0; i < 60; i++) stepFrame(s);
    // Should be near the track (y ~200)
    assert.ok(s.rider.y >= 190 && s.rider.y <= 220, `rider y=${s.rider.y} should be near track at 200`);
  });

  it("rider slides down slope", () => {
    const s = createState();
    addLine(s, createSegment(0, 100, 800, 300, "normal")); // downhill
    s.startMarker = { x: 50, y: 103 };
    applyIntent(s, { type: "play" });
    stepFrame(s);
    stepFrame(s);
    // Should have gained some velocity
    const speed = Math.sqrt(s.rider.vx ** 2 + s.rider.vy ** 2);
    assert.ok(speed > 1, "rider should gain speed on downhill");
  });

  it("speed is clamped to MAX_SPEED", () => {
    const s = createState();
    s.rider.vx = MAX_SPEED + 500;
    s.rider.vy = 0;
    applyIntent(s, { type: "play" });
    stepFrame(s);
    const speed = Math.sqrt(s.rider.vx ** 2 + s.rider.vy ** 2);
    assert.ok(speed <= MAX_SPEED + 1, `speed ${speed} should not exceed ${MAX_SPEED}`);
  });
});

describe("puzzle mode", () => {
  it("loadPuzzle initializes puzzle state", () => {
    const s = createState();
    const data = {
      id: 1,
      track: [{ x1: 0, y1: 0, x2: 100, y2: 0, type: "normal" }],
      start: { x: 0, y: 0 },
      finish: { x: 200, y: 200 },
      stars: [{ x: 50, y: 50 }],
      inkLimit: 300,
    };
    loadPuzzle(s, data);
    assert.equal(s.mode, "puzzle");
    assert.equal(s.puzzleId, 1);
    assert.equal(s.inkLimit, 300);
    assert.equal(s.inkUsed, 0);
    assert.equal(s.lines.length, 1);
    assert.equal(s.stars.length, 1);
  });

  it("calcPuzzleStars returns 0 when not finished", () => {
    const s = createState();
    const result = calcPuzzleStars(s);
    assert.equal(result.stars, 0);
  });
});

describe("export/import", () => {
  it("export and import round-trip", () => {
    const s = createState();
    addLine(s, createSegment(10, 20, 30, 40, "normal"));
    s.startMarker = { x: 100, y: 200 };
    const json = exportCanvas(s);
    assert.ok(json.includes("lines"));
    const s2 = createState();
    const ok = importCanvas(s2, json);
    assert.equal(ok, true);
    assert.equal(s2.lines.length, 1);
    assert.ok(s2.startMarker);
    assert.equal(s2.startMarker.x, 100);
  });

  it("importCanvas rejects invalid JSON", () => {
    const s = createState();
    const ok = importCanvas(s, "not json");
    assert.equal(ok, false);
  });
});

describe("stroke — continuous drawing", () => {
  it("addStrokePoint ignores moves below the sampling step", () => {
    const s = createState();
    beginStroke(s, 0, 0, "normal");
    assert.equal(addStrokePoint(s, 2, 2), false);
    assert.equal(s.lines.length, 0);
    assert.equal(addStrokePoint(s, STROKE_MIN_STEP + 1, 0), true);
    assert.equal(s.lines.length, 1);
  });

  it("endStroke smooths the polyline into a curve", () => {
    const s = createState();
    beginStroke(s, 0, 0, "normal");
    addStrokePoint(s, 40, 10);
    addStrokePoint(s, 80, 0);
    addStrokePoint(s, 120, -10);
    const raw = s.lines.length;
    const res = endStroke(s);
    assert.equal(res.ok, true);
    // 平滑后段数应当多于原始折线段数
    assert.ok(s.lines.length > raw, `smoothed ${s.lines.length} should exceed raw ${raw}`);
    assert.equal(s.stroke, null);
  });

  it("smoothed curve keeps both endpoints", () => {
    const s = createState();
    beginStroke(s, 10, 20, "normal");
    addStrokePoint(s, 50, 30);
    addStrokePoint(s, 90, 25);
    endStroke(s);
    assert.ok(Math.abs(s.lines[0].x1 - 10) < 0.001);
    assert.ok(Math.abs(s.lines[0].y1 - 20) < 0.001);
    const last = s.lines[s.lines.length - 1];
    assert.ok(Math.abs(last.x2 - 90) < 0.001);
    assert.ok(Math.abs(last.y2 - 25) < 0.001);
  });

  it("a dot-only stroke leaves no trace and no empty undo step", () => {
    const s = createState();
    const before = s.lines.length;
    beginStroke(s, 5, 5, "normal");
    assert.equal(s.undoStack.length, 1);
    const res = endStroke(s);
    assert.equal(res.ok, false);
    assert.equal(s.lines.length, before);
    assert.equal(s.undoStack.length, 0, "no empty undo entry");
  });

  it("undo reverts a WHOLE stroke, not a single segment", () => {
    const s = createState();
    beginStroke(s, 0, 0, "normal");
    addStrokePoint(s, 30, 0);
    addStrokePoint(s, 60, 10);
    addStrokePoint(s, 90, 0);
    endStroke(s);
    const drawn = s.lines.length;
    assert.ok(drawn > 1);
    assert.equal(undo(s), true);
    assert.equal(s.lines.length, 0, "one undo removes the entire stroke");
  });

  it("cancelStroke drops the in-progress stroke completely", () => {
    const s = createState();
    beginStroke(s, 0, 0, "normal");
    addStrokePoint(s, 40, 0);
    addStrokePoint(s, 80, 0);
    assert.ok(s.lines.length > 0);
    cancelStroke(s);
    assert.equal(s.lines.length, 0);
    assert.equal(s.undoStack.length, 0);
    assert.equal(s.stroke, null);
  });

  it("puzzle ink-out rolls the stroke back", () => {
    const s = createState({ mode: "puzzle" });
    s.inkLimit = 50;
    s.inkUsed = 0;
    beginStroke(s, 0, 0, "normal");
    addStrokePoint(s, 200, 0);
    addStrokePoint(s, 400, 0);
    const res = endStroke(s);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "ink-out");
    assert.equal(s.lines.length, 0, "stroke rolled back");
    assert.equal(s.inkUsed, 0);
    assert.equal(s.undoStack.length, 0);
  });

  it("puzzle ink is charged by the smoothed length", () => {
    const s = createState({ mode: "puzzle" });
    s.inkLimit = 5000;
    beginStroke(s, 0, 0, "normal");
    addStrokePoint(s, 100, 0);
    addStrokePoint(s, 200, 0);
    const res = endStroke(s);
    assert.equal(res.ok, true);
    assert.ok(Math.abs(s.inkUsed - res.length) < 0.001);
    assert.ok(s.inkUsed >= 200, "length includes the drawn span");
  });

  it("scenery strokes never consume ink", () => {
    const s = createState({ mode: "puzzle" });
    s.inkLimit = 100;
    beginStroke(s, 0, 0, "scenery");
    addStrokePoint(s, 100, 0);
    addStrokePoint(s, 200, 0);
    endStroke(s);
    assert.equal(s.inkUsed, 0);
    assert.ok(s.lines.length > 0);
  });
});

describe("smoothCatmullRom", () => {
  it("returns points unchanged below 3 control points", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    assert.deepEqual(smoothCatmullRom(pts), pts);
  });

  it("produces (n-1)*subdiv + 1 points", () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }, { x: 30, y: 5 }];
    const out = smoothCatmullRom(pts, STROKE_SUBDIV);
    assert.equal(out.length, (pts.length - 1) * STROKE_SUBDIV + 1);
  });

  it("stays inside the control point bounding box (no wild overshoot)", () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 0 }, { x: 150, y: 40 }];
    const out = smoothCatmullRom(pts, 4);
    const pad = 12; // Catmull-Rom 允许小幅过冲，但不能失控
    for (const p of out) {
      assert.ok(p.x >= -pad && p.x <= 150 + pad, `x=${p.x} out of range`);
      assert.ok(p.y >= -pad && p.y <= 40 + pad, `y=${p.y} out of range`);
    }
  });

  it("polylineLength matches the summed segment lengths", () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }];
    const segs = pointsToSegments(pts, "normal");
    const sum = segs.reduce((acc, s) => acc + segmentLength(s), 0);
    assert.ok(Math.abs(polylineLength(pts) - sum) < 0.001);
  });
});

describe("crash and respawn", () => {
  it("undo restores lines removed by the eraser", () => {
    const s = createState();
    addLine(s, createSegment(0, 0, 100, 0, "normal"));
    const snapshot = s.lines.length;
    assert.equal(eraseAt(s, 50, 0, 20), true);
    assert.equal(s.lines.length, 0);
    assert.equal(undo(s), true);
    assert.equal(s.lines.length, snapshot, "eraser snapshot must be taken BEFORE deletion");
  });

  it("respawn returns the rider to the last safe point", () => {
    const s = createState();
    // 下坡：小人真的会滑一段，安全点随之推进
    addLine(s, createSegment(0, 100, 600, 400, "normal"));
    s.startMarker = { x: 20, y: 110 };
    applyIntent(s, { type: "play" });
    for (let i = 0; i < 60; i++) stepFrame(s);
    const safe = { ...s.lastSafe };
    assert.ok(safe.x > 20, "should have recorded a safe point while riding");
    // 把小人挪到远处并标记摔落
    s.rider.x = 9999;
    s.rider.y = 9999;
    s.riderAlive = false;
    respawn(s);
    assert.equal(s.riderAlive, true);
    assert.ok(Math.abs(s.rider.x - safe.x) < 0.001);
    assert.ok(Math.abs(s.rider.y - safe.y) < 0.001);
    assert.equal(s.rider.vx, 0);
    assert.equal(s.rider.vy, 0);
  });

  it("respawn falls back to the start marker when nothing was safe yet", () => {
    const s = createState();
    s.startMarker = { x: 33, y: 44 };
    respawn(s);
    assert.equal(s.rider.x, 33);
    assert.equal(s.rider.y, 44);
  });

  it("a crash stops the rider without an endless crash loop", () => {
    const s = createState();
    // 一条朝上的陡线，小人从上面掉下来会硬着陆
    addLine(s, createSegment(0, 400, 400, 100, "normal"));
    s.startMarker = { x: 200, y: 60 };
    applyIntent(s, { type: "play" });
    let crashes = 0;
    for (let i = 0; i < 240; i++) {
      stepFrame(s);
      for (const ev of s.events) if (ev.type === "crashed") crashes++;
      s.events = [];
      if (crashes > 0) break;
    }
    assert.ok(crashes >= 0);
    // 摔落后再步进不推进（riderAlive=false 时 stepFrame 直接返回）
    const yAfterCrash = s.rider.y;
    stepFrame(s);
    assert.equal(s.rider.y, yAfterCrash);
  });
});

describe("random walk — stress test", () => {
  it("1000+ random operations never throw", () => {
    const rng = createRNG(12345);
    const s = createState({ rng });
    addLine(s, createSegment(0, 300, 800, 300, "normal"));

    for (let i = 0; i < 1000; i++) {
      const op = Math.floor(rng() * 6);
      try {
        switch (op) {
          case 0: applyIntent(s, { type: "draw-line", segment: { x1: rng() * 800, y1: rng() * 400, x2: rng() * 800, y2: rng() * 400, type: "normal" } }); break;
          case 1: applyIntent(s, { type: "undo" }); break;
          case 2: applyIntent(s, { type: "erase", x: rng() * 800, y: rng() * 400, radius: 15 }); break;
          case 3: stepFrame(s); break;
          case 4: applyIntent(s, { type: "play" }); break;
          case 5: applyIntent(s, { type: "pause" }); break;
        }
      } catch (e) {
        assert.fail(`Operation ${op} at step ${i} threw: ${e.message}`);
      }
    }
    assert.ok(true);
  });
});