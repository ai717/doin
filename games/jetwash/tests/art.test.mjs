import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../js/levels.mjs";
import { drawObject, objectPath } from "../js/art.mjs";

function stubContext() {
  const calls = [];
  const gradient = { addColorStop() {} };
  const target = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const proxy = new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key];
      return (...args) => { calls.push([key, args]); };
    },
    set() { return true; },
  });
  return { c: proxy, calls };
}

const RECT = { x: 12, y: 24, w: 540, h: 338 };

test("every object renders layered detail with finite coordinates", () => {
  for (const level of LEVELS) {
    const { c, calls } = stubContext();
    drawObject(c, level.shape, RECT, level.base);
    const paints = calls.filter(([name]) => name === "fill" || name === "fillRect").length;
    assert.ok(paints >= 1, `${level.shape} should paint something, got ${paints} paint calls`);
    for (const [method, args] of calls) {
      for (const value of args) {
        if (typeof value === "number") {
          assert.ok(Number.isFinite(value), `${level.shape}: ${method} received ${value}`);
        }
      }
    }
  }
});

test("clip path is emitted for every washable shape", () => {
  for (const level of LEVELS) {
    const { c, calls } = stubContext();
    objectPath(c, level.shape, RECT);
    assert.ok(calls.some(([name]) => name === "beginPath"), `${level.shape}: missing path`);
    assert.ok(calls.length >= 2, `${level.shape}: too few path commands`);
  }
});
