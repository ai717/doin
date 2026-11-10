// ui.test.mjs - pure isometric geometry and presentation helpers
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  METRICS, glyphFor, isoPoint, polyPoints, tileClass, topFace, viewBoxFor,
} from "../js/ui.mjs";
import { compileLevel, heightAt, COLOR } from "../js/engine.mjs";
import { buildLevel, getLevel, LEVELS } from "../js/levels.mjs";

describe("ui: isometric projection", () => {
  it("maps the origin to (0,0) and shifts half a tile per axis", () => {
    assert.deepEqual(isoPoint(0, 0, 0), { sx: 0, sy: 0 });
    assert.deepEqual(isoPoint(1, 0, 0), { sx: METRICS.tileW / 2, sy: METRICS.tileH / 2 });
    assert.deepEqual(isoPoint(0, 1, 0), { sx: -METRICS.tileW / 2, sy: METRICS.tileH / 2 });
    assert.deepEqual(isoPoint(2, 2, 0), { sx: 0, sy: 2 * METRICS.tileH });
  });

  it("raises the screen position by one level per z step", () => {
    const ground = isoPoint(2, 1, 0);
    const raised = isoPoint(2, 1, 2);
    assert.equal(raised.sx, ground.sx);
    assert.equal(raised.sy, ground.sy - 2 * METRICS.zH);
    assert.equal(isoPoint(2, 1, -5).sy, ground.sy, "negative z is clamped to the floor");
  });

  it("topFace is a diamond around the tile centre", () => {
    const [north, east, south, west] = topFace(100, 50);
    assert.deepEqual(north, [100, 50 - METRICS.tileH / 2]);
    assert.deepEqual(east, [100 + METRICS.tileW / 2, 50]);
    assert.deepEqual(south, [100, 50 + METRICS.tileH / 2]);
    assert.deepEqual(west, [100 - METRICS.tileW / 2, 50]);
  });

  it("polyPoints rounds to two decimals and joins with spaces", () => {
    assert.equal(polyPoints([[1, 2], [3.14159, -1.234]]), "1,2 3.14,-1.23");
  });
});

describe("ui: view box", () => {
  it("wraps every walkable tile with padding", () => {
    const level = buildLevel(getLevel(1));
    const box = viewBoxFor(level);
    assert.ok(box.width > METRICS.tileW * 2);
    assert.ok(box.height > METRICS.tileH * 2);
    for (let y = 0; y < level.rows; y += 1) {
      for (let x = 0; x < level.cols; x += 1) {
        const h = heightAt(level, x, y);
        if (h < 0) continue;
        const { sx, sy } = isoPoint(x, y, h);
        assert.ok(sx > box.x && sx < box.x + box.width, `tile ${x},${y} escapes horizontally`);
        assert.ok(sy > box.y && sy < box.y + box.height, `tile ${x},${y} escapes vertically`);
      }
    }
  });

  it("keeps every stage of the campaign inside its own box", () => {
    for (const entry of LEVELS) {
      const level = buildLevel(entry);
      const box = viewBoxFor(level);
      for (let y = 0; y < level.rows; y += 1) {
        for (let x = 0; x < level.cols; x += 1) {
          const h = heightAt(level, x, y);
          if (h < 0) continue;
          const { sx } = isoPoint(x, y, h);
          assert.ok(sx - METRICS.tileW / 2 >= box.x - 0.01, `stage ${entry.id} clips the left edge`);
          assert.ok(sx + METRICS.tileW / 2 <= box.x + box.width + 0.01, `stage ${entry.id} clips the right edge`);
        }
      }
    }
  });

  it("falls back to a finite box for an empty grid", () => {
    const empty = compileLevel({ grid: ["___"], rows: 1, cols: 3 });
    const box = viewBoxFor(empty);
    assert.ok(Number.isFinite(box.width) && box.width > 0);
    assert.ok(Number.isFinite(box.height) && box.height > 0);
  });
});

describe("ui: tile presentation", () => {
  it("void cells have no class, floors do, heights are marked", () => {
    const level = compileLevel({ grid: ["_1.", "rbg"], cols: 3, rows: 2 });
    assert.equal(tileClass(level, 0, 0), null, "void tile");
    assert.match(tileClass(level, 1, 0), /is-raised/);
    assert.equal(tileClass(level, 2, 0), "tile");
    assert.match(tileClass(level, 0, 1), /tint-red/);
    assert.match(tileClass(level, 1, 1), /tint-blue/);
    assert.match(tileClass(level, 2, 1), /tint-green/);
    assert.equal(level.colors[3], COLOR.RED);
    assert.equal(level.colors[4], COLOR.BLUE);
  });

  it("glyphs cover every op and ignore the colour suffix", () => {
    assert.equal(glyphFor("F"), "↑");
    assert.equal(glyphFor("J"), "⇡");
    assert.equal(glyphFor("A:r"), "✦");
    assert.equal(glyphFor("P"), "ƒ");
    assert.equal(glyphFor("f:g"), "↑");
    assert.equal(glyphFor(""), "");
    assert.equal(glyphFor(null), "");
    assert.equal(glyphFor("Q"), "");
  });
});
