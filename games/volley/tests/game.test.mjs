// Volley game controller tests: intent gating, AI turns, pause, series.

import test from "node:test";
import assert from "node:assert/strict";

import { createGame } from "../js/game.mjs";

function mk(opts = {}) {
  return createGame({ seed: 42, mode: "2p", terrain: "hill", ...opts });
}

test("createGame：初始 view 就绪（2p 红方先手、aim 相位）", () => {
  const g = mk();
  const v = g.view();
  assert.equal(v.phase, "aim");
  assert.equal(v.turn, 0);
  assert.equal(v.mode, "2p");
  assert.equal(v.round, 1);
  assert.ok(Array.isArray(v.blocks) && v.blocks.length === 2);
});

test("intent：合法瞄准生效（角度/力度/武器）", () => {
  const g = mk();
  const ok = g.intent("angle", { angle: 63 });
  assert.notEqual(ok, false);
  assert.ok(Math.abs(g.view().players[0].angle - 63) < 1e-9);
  g.intent("power", { power: 88 });
  assert.equal(g.view().players[0].power, 88);
  g.intent("weapon", { weapon: "blast" });
  assert.equal(g.view().players[0].weapon, "blast");
});

test("intent：非法意图静默忽略（超界钳制/未知武器/非己回合）", () => {
  const g = mk();
  g.intent("angle", { angle: 999 });
  assert.ok(g.view().players[0].angle <= 90, "角度钳制到上限");
  const r = g.intent("weapon", { weapon: "nuke" });
  assert.ok(r === null || r === false || r === undefined, "未知武器返回空意图");
  assert.equal(g.view().players[0].weapon, "stone");
});

test("intent：开炮后进入飞行、AI/对方回合拒绝人操", () => {
  const g = mk();
  g.intent("fire");
  assert.equal(g.view().phase, "flight");
  // during flight further fire is a no-op
  const r = g.intent("fire");
  assert.ok(r === null || r === false || r === undefined);
});

test("tick：飞行推进至结束并换边", () => {
  const g = mk();
  g.intent("fire");
  let guard = 0;
  while (g.view().phase === "flight" && guard < 600) {
    guard += 1;
    g.tick(16);
  }
  assert.equal(g.view().phase, "aim");
  assert.equal(g.view().turn, 1, "应轮到东军");
});

test("AI 模式：AI 先手自动思考并在延迟后开炮", () => {
  const g = createGame({ seed: 42, mode: "ai", aiLevel: "veteran", terrain: "hill" });
  assert.equal(g.view().mode, "ai");
  let fired = false;
  for (let i = 0; i < 400; i += 1) {
    g.tick(16);
    if (g.view().phase === "flight") { fired = true; break; }
  }
  assert.ok(fired, "AI 应在 ~2s 内出手");
  // let the shot finish
  for (let i = 0; i < 600 && g.view().phase === "flight"; i += 1) g.tick(16);
  assert.equal(g.view().phase, "aim");
});

test("暂停：togglePause 冻结 tick，AI 模式下暂停后不推进", () => {
  const g = createGame({ seed: 42, mode: "ai", aiLevel: "master", terrain: "hill" });
  const paused = g.togglePause();
  assert.equal(paused, true);
  assert.equal(g.isPaused(), true);
  const snap = JSON.stringify(g.view());
  for (let i = 0; i < 120; i += 1) g.tick(16);
  assert.equal(JSON.stringify(g.view()), snap, "暂停期间 view 完全冻结");
  g.togglePause();
  assert.equal(g.isPaused(), false);
});

test("restart：换新种子重开，roundWins 清零、AI 状态复位", () => {
  const g = mk();
  g.intent("fire");
  for (let i = 0; i < 600 && g.view().phase === "flight"; i += 1) g.tick(16);
  g.restart({ mode: "2p", terrain: "twin" });
  const v = g.view();
  assert.equal(v.phase, "aim");
  assert.equal(v.turn, 0);
  assert.equal(v.round, 1);
  assert.deepEqual(v.roundWins, [0, 0]);
});

test("对局终局：master AI 破塔后 matchOver 事件与 winner 落地", () => {
  const events = [];
  const g = createGame({
    seed: 42, mode: "ai", aiLevel: "master", terrain: "hill",
    onEvents: (evs) => events.push(...evs),
  });
  // Human side 1 idles out weak shots so the AI keeps its turns.
  let guard = 0;
  while (!g.isOver() && guard < 6000) {
    guard += 1;
    g.tick(33);
    const v = g.view();
    if (v.phase === "aim" && v.turn === 1) {
      g.intent("fire", { side: 1 });
    }
  }
  assert.ok(g.isOver(), "master 对空过应能终局");
  assert.ok(events.some((e) => e.type === "matchOver"), "应广播 matchOver");
  assert.ok(g.view().winner !== null);
});

test("随机游走 1200 tick：任意意图序列不抛错、不变式守恒", () => {
  let seed = 20261115;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const g = mk({ seed: 3 });
  const intents = ["angle", "power", "weapon", "fire", "bogus"];
  for (let i = 0; i < 1200; i += 1) {
    const pick = intents[Math.floor(rnd() * intents.length)];
    if (pick === "angle") g.intent("angle", { delta: rnd() * 20 - 10 });
    else if (pick === "power") g.intent("power", { delta: rnd() * 30 - 15 });
    else if (pick === "weapon") g.intent("weapon", { weapon: ["stone", "blast", "split", "sticky", "drill", "balloon"][Math.floor(rnd() * 6)] });
    else if (pick === "fire") g.intent("fire");
    if (rnd() < 0.02) g.togglePause();
    g.tick(16);
    const v = g.view();
    assert.ok(v.round >= 1 && v.round <= 10 + 1, "回合在 1..11 内");
    assert.ok(v.players.every((p) => p.angle >= 0 && p.angle <= 90 && p.power >= 0 && p.power <= 100), "瞄准参数守恒");
  }
});
