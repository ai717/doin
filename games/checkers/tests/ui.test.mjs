// ui.test.mjs - pure board geometry: projection, star contour, hop arcs.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DIRS, HOLES, HOLE_COUNT } from "../js/engine.mjs";
import {
  STEP, HOLE_R, VIEW_BOX, STAR_OUTER, STAR_INNER,
  POSITIONS, project, holePosition, starPoints, starPolygon, pointInPolygon,
  classifyTarget, arcGeometry, chainPath, nearestHole,
} from "../js/ui.mjs";

function distToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

describe("geometry: cube projection", () => {
  it("all six unit directions are exactly one STEP apart", () => {
    const origin = project([0, 0, 0]);
    for (const d of DIRS) {
      const p = project(d);
      assert.ok(Math.abs(Math.hypot(p[0] - origin[0], p[1] - origin[1]) - STEP) < 1e-9,
        `direction ${d.join(",")} drifted`);
    }
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < HOLE_COUNT; i += 1) {
      for (let j = i + 1; j < HOLE_COUNT; j += 1) {
        const d = Math.hypot(POSITIONS[i][0] - POSITIONS[j][0], POSITIONS[i][1] - POSITIONS[j][1]);
        if (d < min) min = d;
        if (d > max) max = d;
      }
    }
    assert.ok(Math.abs(min - STEP) < 1e-9, `closest holes are ${min} apart, expected ${STEP}`);
    assert.ok(max < 2 * STEP * 9, "board diameter is out of control");
  });

  it("121 distinct hole centres all fit inside the viewBox with room for the rim", () => {
    assert.equal(POSITIONS.length, 121);
    assert.equal(HOLES.length, 121);
    const keys = new Set(POSITIONS.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`));
    assert.equal(keys.size, 121, "two holes share a pixel centre");
    for (const [x, y] of POSITIONS) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x - HOLE_R >= VIEW_BOX.x && x + HOLE_R <= VIEW_BOX.x + VIEW_BOX.w, `x out of view: ${x}`);
      assert.ok(y - HOLE_R >= VIEW_BOX.y && y + HOLE_R <= VIEW_BOX.y + VIEW_BOX.h, `y out of view: ${y}`);
    }
  });

  it("holePosition is a safe lookup", () => {
    assert.deepEqual(holePosition(0), POSITIONS[0]);
    assert.equal(holePosition(-1), null);
    assert.equal(holePosition(121), null);
    assert.equal(holePosition("3"), null);
  });
});

describe("geometry: star contour", () => {
  it("12 vertices: six tips and six notches, alternating", () => {
    const pts = starPoints();
    assert.equal(pts.length, 12);
    for (let i = 0; i < 12; i += 1) {
      const radius = Math.hypot(...pts[i]);
      const expected = i % 2 === 0 ? STAR_OUTER : STAR_INNER;
      assert.ok(Math.abs(radius - expected) < 1e-9, `vertex ${i} radius ${radius}`);
    }
    const pairs = starPolygon().trim().split(/\s+/);
    assert.equal(pairs.length, 12);
    for (const pair of pairs) {
      const [x, y] = pair.split(",").map(Number);
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
    }
  });

  it("every hole sits inside the wooden star with clearance for its rim", () => {
    const poly = starPoints();
    let minEdge = Infinity;
    for (const p of POSITIONS) {
      assert.ok(pointInPolygon(p, poly), `hole at ${p} fell outside the plate`);
      for (let i = 0; i < poly.length; i += 1) {
        minEdge = Math.min(minEdge, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
      }
    }
    assert.ok(minEdge >= HOLE_R, `closest hole is only ${minEdge.toFixed(1)}px from the edge`);
    assert.equal(pointInPolygon([0, 0], poly), true);
    assert.equal(pointInPolygon([900, 900], poly), false);
  });
});

describe("geometry: hop arcs and targets", () => {
  const stepMove = { from: 0, to: 1, hops: 0, path: [0, 1] };
  const chainMove = { from: 61, to: 80, hops: 3, path: [61, 70, 75, 80] };

  it("classifies landings by hop count", () => {
    assert.equal(classifyTarget(stepMove), "step");
    assert.equal(classifyTarget({ hops: 1 }), "hop");
    assert.equal(classifyTarget({ hops: 2 }), "grand");
    assert.equal(classifyTarget({ hops: 6 }), "grand");
    assert.equal(classifyTarget(null), "step");
  });

  it("each arc bows upward and starts/ends exactly on hole centres", () => {
    const g = arcGeometry(0, 1, 18);
    assert.ok(g);
    assert.deepEqual(g.a, POSITIONS[0]);
    assert.deepEqual(g.b, POSITIONS[1]);
    const mid = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2];
    assert.ok(g.c[1] <= mid[1] + 1e-9, "control point must not dip below the chord");
    const far = arcGeometry(0, 1, 40);
    assert.ok(Math.hypot(far.c[0] - mid[0], far.c[1] - mid[1])
      > Math.hypot(g.c[0] - mid[0], g.c[1] - mid[1]), "a bigger lift must bow further");
    assert.equal(arcGeometry(0, 999), null);
  });

  it("one quadratic segment per hop, and no path for a broken move", () => {
    assert.equal((chainPath(stepMove).match(/Q/g) || []).length, 1);
    assert.equal((chainPath(chainMove).match(/Q/g) || []).length, 3);
    assert.match(chainPath(chainMove), /^M /);
    assert.equal(chainPath(null), "");
    assert.equal(chainPath({ path: [0] }), "");
    assert.equal(chainPath({ path: [0, 999] }), "");
  });

  it("nearestHole snaps to the tapped hole and rejects empty space", () => {
    for (const i of [0, 30, 60, 90, 120]) {
      assert.equal(nearestHole(POSITIONS[i][0], POSITIONS[i][1]), i);
    }
    const [x, y] = POSITIONS[60];
    assert.equal(nearestHole(x + STEP * 0.25, y - STEP * 0.2), 60);
    assert.equal(nearestHole(290, 290), -1);
  });
});
