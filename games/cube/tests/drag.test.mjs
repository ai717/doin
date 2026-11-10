// 拖动换算回归测试：屏幕位移 -> 层转轴/层/角度（曾因方向向量未归一化导致角度瞬间饱和、层"瞬移"）
import assert from "node:assert/strict";
import test from "node:test";
import { dragAngle, resolveDragTurn } from "../js/render.mjs";

const PI = Math.PI;
const PQ = 100; // 100px 拖动 = 90°

// 正视前面（法线 +z）时的屏幕轴方向：+x 向右、+y 向上（屏幕 y 向下）、+z 冲向观察者（退化）
const FRONT_DIRS = [
  { x: 56, y: 0 },
  { x: 0, y: -56 },
  { x: 0, y: 0 },
];

function dragFront(dx, dy, dirs = FRONT_DIRS) {
  return resolveDragTurn({ normal: [0, 0, 1], dirs, point: [1, 1, 2], dx, dy, pxPerQuarter: PQ });
}

test("前面向右拖：绕 y 轴转，层为命中格所在的 y 层，正转向", () => {
  const turn = dragFront(50, 0);
  assert.equal(turn.axis, 1);
  assert.equal(turn.layer, 1);
  assert.equal(turn.sign, 1);
  assert.ok(Math.abs(turn.ux - 1) < 1e-9 && Math.abs(turn.uy) < 1e-9);
  assert.ok(Math.abs(dragAngle(turn, 50, 0) - PI / 4) < 1e-9, "50px 应只转 45°");
});

test("前面向下拖：绕 x 轴转且转向朝下（旧实现方向相反）", () => {
  const turn = dragFront(0, 50);
  assert.equal(turn.axis, 0);
  assert.equal(turn.layer, 1);
  assert.equal(turn.sign, 1);
  assert.ok(Math.abs(turn.ux) < 1e-9 && Math.abs(turn.uy - 1) < 1e-9);
  assert.ok(Math.abs(dragAngle(turn, 0, 50) - PI / 4) < 1e-9);
});

test("前面向上拖：同一旋转轴但反向", () => {
  const up = dragFront(0, -50);
  const down = dragFront(0, 50);
  assert.equal(up.axis, down.axis);
  assert.equal(up.sign, -down.sign);
  assert.ok(dragAngle(up, 0, -50) < 0 && dragAngle(down, 0, 50) > 0);
});

test("角度随拖动线性增长，不再瞬间饱和（方向向量需先归一化）", () => {
  const turn = dragFront(5, 0);
  const angle = dragAngle(turn, 5, 0);
  assert.ok(Math.abs(angle - (5 / PQ) * (PI / 2)) < 1e-9, `5px 应只转 ${(5 / PQ) * 90}°，实际 ${(angle * 180) / PI}°`);
  assert.ok(Math.abs(angle) < PI / 20, "小位移不得跳到半圈");
});

test("拖动方向反转后角度翻符号（层与轴在起手时锁定）", () => {
  const turn = dragFront(30, 0);
  assert.ok(dragAngle(turn, 30, 0) > 0);
  assert.ok(dragAngle(turn, -30, 0) < 0);
});

test("满 180° 截断，不越过半圈", () => {
  const turn = dragFront(10, 0);
  assert.equal(dragAngle(turn, 1000, 0), PI);
  assert.equal(dragAngle(turn, -1000, 0), -PI);
});

test("微动与法线轴退化都不产生层转", () => {
  assert.equal(dragFront(1, 1), null, "位移过小返回 null");
  assert.equal(resolveDragTurn({ normal: [0, 0, 1], dirs: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], point: [0, 0, 0], dx: 40, dy: 0, pxPerQuarter: PQ }), null);
});
