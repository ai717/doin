// tests/render.test.mjs —— 假 canvas 烟雾测试：渲染层在任何状态下都必须不抛错
//
// 运行前置：项目无构建步骤，Node >= 20 直接执行本文件即可。
//   命令：node --test games/lantern-maze/tests/render.test.mjs
//   （或 npm run test:lantern-maze 跑全套）
// 产物：仅终端 TAP 输出，不落盘、不启动浏览器。
// 坑位：createRenderer 会调用 document.createElement("canvas") 预渲染屏风，
//       所以这里必须同时伪造 globalThis.document 与 globalThis.window。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createState,
  stepFrame,
  intent,
  mulberry32,
  DOT,
  PEARL,
} from "../js/engine.mjs";
import { createRenderer, drawBench, TILE } from "../js/render.mjs";
import { LAYOUTS, levelById, rowsForLevel, ARENA_LAYOUT, TIME_POOL } from "../js/levels.mjs";
import { createGame, hudOf } from "../js/game.mjs";

const DIRS4 = ["up", "left", "down", "right"];

// ---------------------------------------------------------------- 假 2D 上下文

function makeCtx() {
  const calls = { fill: 0, stroke: 0, text: 0, gradient: 0, image: 0 };
  const grad = { addColorStop() {} };
  const ctx = {
    canvas: null,
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: null,
    shadowBlur: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    calls,
    createLinearGradient() {
      calls.gradient += 1;
      return grad;
    },
    createRadialGradient() {
      calls.gradient += 1;
      return grad;
    },
    drawImage() {
      calls.image += 1;
    },
    measureText: () => ({ width: 10 }),
    fillText() {
      calls.text += 1;
    },
    strokeText() {
      calls.text += 1;
    },
  };
  for (const m of [
    "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo", "ellipse",
    "rect", "roundRect", "quadraticCurveTo", "bezierCurveTo", "fill", "stroke",
    "clip", "fillRect", "strokeRect", "clearRect", "save", "restore",
    "translate", "rotate", "scale", "setTransform", "resetTransform", "setLineDash",
  ]) {
    ctx[m] = () => {};
  }
  return ctx;
}

function makeCanvas(w = 560, h = 620) {
  const ctx = makeCtx();
  const canvas = {
    width: w,
    height: h,
    clientWidth: w,
    clientHeight: h,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: w, height: h, left: 0, top: 0 }),
  };
  ctx.canvas = canvas;
  return canvas;
}

function installDom() {
  const prevWindow = globalThis.window;
  const prevDocument = globalThis.document;
  globalThis.window = { devicePixelRatio: 2 };
  globalThis.document = {
    createElement: (tag) => (tag === "canvas" ? makeCanvas(280, 310) : {}),
  };
  return () => {
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;
  };
}

// ---------------------------------------------------------------- 用例

test("主舞台在整局各状态下逐帧绘制不抛错", () => {
  const canvas = makeCanvas();
  const restore = installDom();
  try {
    const r = createRenderer(canvas, { reducedMotion: false });
    const lvl = levelById(1);
    const state = createState({ rows: rowsForLevel(1), cfg: lvl, seed: 3, mode: "campaign" });
    const rnd = mulberry32(31);
    for (let i = 0; i < 900; i += 1) {
      r.draw(state, 16.7);
      if (rnd() < 0.06) intent(state, { type: "turn", dir: DIRS4[Math.floor(rnd() * 4)] });
      if (rnd() < 0.02) intent(state, { type: "dash" });
      stepFrame(state, 1000 / 12);
    }
    assert.ok(canvas.width > 0 && canvas.height > 0);
    assert.equal(canvas.getContext().calls.image > 0, true, "屏风墙应当被合成进画布");
  } finally {
    restore();
  }
});

test("四种模式都能出画", () => {
  const canvas = makeCanvas(500, 560);
  const restore = installDom();
  try {
    const r = createRenderer(canvas);
    const games = [
      createGame({ mode: "campaign", levelId: 1 }),
      createGame({ mode: "timed", layoutTable: LAYOUTS }),
      createGame({ mode: "survival", layoutTable: LAYOUTS }),
      createGame({ mode: "workshop", rows: LAYOUTS[ARENA_LAYOUT] }),
      createGame({ mode: "campaign", levelId: 20 }),
    ];
    for (const g of games) {
      assert.ok(g.state, `${g.mode} 应当成功建局`);
      for (let i = 0; i < 260; i += 1) {
        r.draw(g.state, 16.7);
        g.step(1000 / 12);
        if (i % 41 === 0) g.turn(DIRS4[(i / 41) % 4]);
      }
      assert.ok(hudOf(g).score >= 0);
      r.reset();
    }
    assert.ok(TIME_POOL.length >= 3);
  } finally {
    restore();
  }
});

test("fx 事件映射对未知事件与缺字段事件保持静默", () => {
  const canvas = makeCanvas();
  const restore = installDom();
  try {
    const r = createRenderer(canvas);
    const state = createState({ rows: rowsForLevel(3), cfg: levelById(3), seed: 5 });
    r.draw(state);
    const types = [
      "dot", "pearl", "eatGhost", "caught", "dash", "fright", "frightWarn",
      "cleared", "round", "release", "毫无意义的事件", undefined, "phase", "time",
    ];
    for (const t of types) {
      r.fx(t, state, { id: 99, chain: 3 });
      r.fx(t, state, null);
    }
    r.fx("dot", null, {});
    assert.ok(r.particles > 0, "吃尘与吞影应当撒下粒子");
  } finally {
    restore();
  }
});

test("减弱动效下不产生粒子，屏震退化为白闪", () => {
  const canvas = makeCanvas();
  const restore = installDom();
  try {
    const r = createRenderer(canvas, { reducedMotion: true });
    const state = createState({ rows: rowsForLevel(1), cfg: levelById(1), seed: 9 });
    r.draw(state);
    r.burst(10, 10, { count: 40 });
    r.quake(400, 9);
    assert.equal(r.particles, 0, "reducedMotion 下 burst 不应撒粒子");
    r.fx("caught", state, {});
    r.draw(state, 16.7);
    assert.equal(r.particles, 0);
  } finally {
    restore();
  }
});

test("画布缺失时安全空转", () => {
  const restore = installDom();
  try {
    for (const r of [createRenderer(null), createRenderer(undefined)]) {
      r.draw(null);
      r.draw({});
      r.fx("dot", null, null);
      r.reset();
      r.resize();
    }
    assert.equal(createRenderer(makeCanvas()).particles, 0);
  } finally {
    restore();
  }
});

test("编辑台画出纸样并返回命中测试用的换算", () => {
  const canvas = makeCanvas(460, 500);
  const restore = installDom();
  try {
    const rows = rowsForLevel(4);
    const box = drawBench(canvas, {
      rows,
      problems: [{ rule: "reach", tiles: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }],
      hover: { x: 3, y: 3 },
      grid: true,
      locale: "zh",
    });
    assert.equal(box.width, rows[0].length);
    assert.equal(box.height, rows.length);
    assert.ok(box.ts >= 8, "格宽必须落到可点击尺寸");
    assert.ok(box.ox >= 0 && box.oy >= 0);

    drawBench(canvas, { rows, hover: { x: -1, y: 999 }, reducedMotion: true });
    assert.equal(drawBench(canvas, { rows: [] }).width, 0);
    assert.equal(drawBench(null, { rows }).width, 0);
  } finally {
    restore();
  }
});

test("空盘与无影魅的极端状态不会崩掉渲染", () => {
  const canvas = makeCanvas(320, 420);
  const restore = installDom();
  try {
    const r = createRenderer(canvas);
    const state = createState({ rows: rowsForLevel(19), cfg: { ...levelById(19), fog: 1 }, seed: 11 });
    for (let y = 0; y < state.layout.height; y += 1) {
      for (let x = 0; x < state.layout.width; x += 1) {
        const k = y * state.layout.width + x;
        if (state.dotGrid[k] === 1) {
          state.dotGrid[k] = 0;
          state.dotLeft -= 1;
        } else if (state.pearlGrid[k] === 2) {
          state.pearlGrid[k] = 0;
          state.pearlLeft -= 1;
        }
      }
    }
    state.status = "running";
    r.draw(state);
    stepFrame(state, 1000 / 12);
    r.draw(state);

    const mid = createState({ rows: rowsForLevel(1), cfg: levelById(1), seed: 12 });
    for (const g of mid.ghosts) g.st = "eyes";
    r.draw(mid);
    mid.ghosts.length = 0;
    r.draw(mid);
    mid.status = "lost";
    r.draw(mid);
    assert.notEqual(DOT, PEARL);
  } finally {
    restore();
  }
});

test("影魅五种状态与濒死帧路径覆盖", () => {
  const canvas = makeCanvas(560, 620);
  const restore = installDom();
  try {
    const r = createRenderer(canvas);
    const state = createState({ rows: rowsForLevel(30), cfg: levelById(30), seed: 13 });
    const rnd = mulberry32(21);
    const kinds = ["normal", "fright", "eyes", "house", "exiting"];
    for (let i = 0; i < 900; i += 1) {
      if (rnd() < 0.05) intent(state, { type: "turn", dir: DIRS4[Math.floor(rnd() * 4)] });
      for (let k = 0; k < state.ghosts.length; k += 1) state.ghosts[k].st = kinds[(i + k) % kinds.length];
      r.draw(state, 16.7);
      stepFrame(state, 1000 / 12);
      if (state.status === "dying") r.draw(state, 16.7);
    }
    assert.ok(canvas.width >= 1);
  } finally {
    restore();
  }
});
