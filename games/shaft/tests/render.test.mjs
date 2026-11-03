import test from "node:test";
import assert from "node:assert/strict";

import {
  ZONES,
  PLATFORM_COLORS,
  zoneIndexForDepth,
  zonePalette,
  mixColor,
  createRenderer,
} from "../js/render.mjs";
import { PLATFORM_TYPES } from "../js/engine.mjs";

test("render: depth bands map into the five geological zones", () => {
  assert.equal(zoneIndexForDepth(0), 0);
  assert.equal(zoneIndexForDepth(21), 0);
  assert.equal(zoneIndexForDepth(22), 1);
  assert.equal(zoneIndexForDepth(43), 1);
  assert.equal(zoneIndexForDepth(44), 2);
  assert.equal(zoneIndexForDepth(66), 3);
  assert.equal(zoneIndexForDepth(88), 4);
  assert.equal(zoneIndexForDepth(500), 4, "超出最深区仍停留在核心熔炉");
  assert.equal(zoneIndexForDepth(-5), 0);
  assert.equal(zoneIndexForDepth(NaN), 0);
});

test("render: palette starts at the surface and interpolates toward the next zone", () => {
  const surface = zonePalette(0);
  const zone = ZONES[0];
  assert.equal(surface.top, zone.top);
  assert.equal(surface.bottom, zone.bottom);
  assert.equal(surface.accent, zone.accent);

  const mid = zonePalette(11);
  assert.notEqual(mid.top, surface.top, "区间中点必须与起点不同");
  assert.ok(mid.top.startsWith("#") && mid.top.length === 7);

  const deep = zonePalette(500);
  assert.equal(deep.top, ZONES[ZONES.length - 1].top);
});

test("render: mixColor clamps and blends deterministically", () => {
  assert.equal(mixColor("#000000", "#ffffff", 0), "#000000");
  assert.equal(mixColor("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(mixColor("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mixColor("#000000", "#ffffff", -1), "#000000");
  assert.equal(mixColor("#000000", "#ffffff", 2), "#ffffff");
  assert.equal(mixColor("#123456", "#654321", 0.5).length, 7);
});

test("render: every platform type has a material palette", () => {
  for (const type of PLATFORM_TYPES) {
    const colors = PLATFORM_COLORS[type];
    assert.ok(colors, `缺少 ${type} 的材质色板`);
    for (const key of ["base", "light", "dark", "edge"]) {
      assert.ok(/^#[0-9a-f]{6}$/i.test(colors[key]), `${type}.${key} 必须是十六进制色`);
    }
  }
});

test("render: createRenderer without a canvas degrades silently", () => {
  const renderer = createRenderer(null, { reducedMotion: true });
  assert.equal(typeof renderer.draw, "function");
  assert.equal(typeof renderer.onEvent, "function");
  renderer.draw();
  renderer.onEvent({ type: "spike", x: 10, y: 10 });
  renderer.setReducedMotion(true);
  renderer.resize();
  assert.equal(renderer.camera.scale, 1);
});
