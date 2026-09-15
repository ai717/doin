import test from "node:test";
import assert from "node:assert/strict";

import {
  CAM_BACK,
  DRAW_DIST,
  HORIZON,
  ROAD_NEAR_W,
  VH,
  VW,
  projectSway,
  projectWorld,
} from "../js/render.mjs";

const cam = { z: 100, x: 0, sway: 0 };

test("projection puts the player near the bottom, not the sky", () => {
  const player = projectWorld(cam, 0, cam.z + CAM_BACK, 0);
  assert.ok(player, "玩家必须能投影");
  assert.ok(player.y > VH * 0.72, `玩家屏幕 y=${player.y} 应贴近屏幕底部`);
  assert.ok(player.y < VH - 8, `玩家不得画出屏幕外 y=${player.y}`);
  assert.ok(player.w > 200, `近处路宽应可读 w=${player.w}`);
});

test("far segments sit just below the horizon and are narrower", () => {
  const near = projectWorld(cam, 0, cam.z + CAM_BACK, 0);
  const far = projectWorld(cam, 0, cam.z + DRAW_DIST - 4, 0);
  assert.ok(far);
  assert.ok(far.y > HORIZON, `远处应在地平线下方 y=${far.y} horizon=${HORIZON}`);
  assert.ok(far.y < HORIZON + 40, `远处不得掉到画面中下部 y=${far.y}`);
  assert.ok(near.y - far.y > 180, "近远之间必须有足够的纵向透视差");
  assert.ok(near.w > far.w * 8, "近处路面必须明显宽于远处");
});

test("points behind the camera are rejected", () => {
  assert.equal(projectWorld(cam, 0, cam.z, 0), null);
  assert.equal(projectWorld(cam, 0, cam.z + 0.4, 0), null);
});

test("lateral x maps onto the road width and stays on canvas near the player", () => {
  const left = projectWorld(cam, -1.5, cam.z + CAM_BACK, 0);
  const right = projectWorld(cam, 1.5, cam.z + CAM_BACK, 0);
  const mid = projectWorld(cam, 0, cam.z + CAM_BACK, 0);
  assert.ok(Math.abs(mid.x - VW / 2) < 8);
  assert.ok(left.x < mid.x - 180);
  assert.ok(right.x > mid.x + 180);
  assert.ok(left.x > 80 && right.x < VW - 80);
  assert.ok(Math.abs(right.x - left.x - mid.w * 2) < 12);
});

test("road half-width at the player matches ROAD_NEAR_W", () => {
  const p = projectWorld(cam, 0, cam.z + CAM_BACK, 0);
  assert.ok(Math.abs(p.w - ROAD_NEAR_W) < 1);
});

test("nearer segments sit lower so the road fill is not skipped", () => {
  const nearer = projectWorld(cam, 0, cam.z + 18, 0);
  const farther = projectWorld(cam, 0, cam.z + 24, 0);
  assert.ok(farther.y < nearer.y - 0.5, `far y=${farther.y} near y=${nearer.y} 画路条件要求远处更高`);
});

test("sway is bounded so the road cannot fly off-screen", () => {
  const track = { curveFreq: 0.003 };
  let max = 0;
  for (let z = 0; z < 4000; z += 17) {
    max = Math.max(max, Math.abs(projectSway(z, track)));
  }
  assert.ok(max < 160, `弯道屏幕偏移过大 ${max}`);
});
