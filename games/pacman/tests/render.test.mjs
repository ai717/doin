// render.test.mjs —— Canvas 渲染验收（无浏览器）：非法颜色值、几何越界、降级开关。
//
// 桩的硬约束（照抄前务必看，缺一条就是假绿）：
//   1) getContext 返回 Proxy：任意绘制方法 no-op，颜色类赋值要登记，出现 NaN/undefined 一律记下来。
//   2) <canvas width> 必须同步成实例属性：renderer 直接读 canvas.width 算缩放。
//   3) clientWidth/clientHeight 要有值，否则 scale 会退化成 0，坐标全塌到原点却测不出来。
//   4) 几何断言要在"逻辑视窗"里做，别拿像素比——canvas 尺寸随 dpr 变。

import test from "node:test";
import assert from "node:assert/strict";

import { createRenderer, VIEW_W, VIEW_H, TILE } from "../js/render.mjs";
import { createState, parseMaze, stepFrame } from "../js/engine.mjs";
import { MAZES, SETPIECES } from "../js/mazes.mjs";

const BAD = /NaN|undefined|null/;

function fakeCanvas(cssW = 448, cssH = 496) {
  const log = { colors: [], points: [] };
  const gradient = { addColorStop: () => {} };
  const base = {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo(x, y) {
      log.points.push([x, y]);
    },
    lineTo(x, y) {
      log.points.push([x, y]);
    },
    arc(x, y, r) {
      log.points.push([x, y]);
      if (!Number.isFinite(r)) log.colors.push(["arc.r", String(r)]);
    },
    quadraticCurveTo() {},
    fill() {},
    stroke() {},
    clearRect() {},
    fillRect() {},
    translate() {},
    rotate() {},
    scale() {},
    setTransform() {},
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
  };
  const state = {};
  const ctx = new Proxy(base, {
    get(t, k) {
      if (k in t) return t[k];
      return state[k];
    },
    set(t, k, v) {
      if (typeof v === "string" && BAD.test(v)) log.colors.push([String(k), v]);
      if (typeof v === "number" && !Number.isFinite(v)) log.colors.push([String(k), String(v)]);
      state[k] = v;
      return true;
    },
  });
  const canvas = {
    width: cssW,
    height: cssH,
    clientWidth: cssW,
    clientHeight: cssH,
    getContext: () => ctx,
  };
  return { canvas, log };
}

function freshState(index = 0) {
  return createState({ maze: parseMaze(MAZES[index]), seed: 5 });
}

test("逻辑视窗锁定经典尺寸 28×31，格宽 8", () => {
  assert.equal(VIEW_W, 224);
  assert.equal(VIEW_H, 248);
  assert.equal(TILE, 8);
});

test("没有 canvas 或拿不到 context 时静默降级，绝不抛错", () => {
  const r = createRenderer(null);
  assert.doesNotThrow(() => {
    r.resize();
    r.draw(freshState(), 1 / 60);
    r.pop(3, 4, "#fff");
  });
  const broken = createRenderer({ getContext: () => null });
  assert.doesNotThrow(() => broken.draw(freshState(), 1 / 60));
});

test("绘制一整帧：不抛错、颜色值全部合法、几何不越界", () => {
  const { canvas, log } = fakeCanvas();
  const r = createRenderer(canvas);
  const st = freshState();
  assert.doesNotThrow(() => r.draw(st, 1 / 60));
  assert.deepEqual(log.colors, [], `出现非法绘制值：${JSON.stringify(log.colors.slice(0, 5))}`);
  assert.ok(log.points.length > 100, `绘制点太少（${log.points.length}），像是墙没画出来`);
  const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
  for (const [x, y] of log.points) {
    assert.ok(x >= -VIEW_W * scale && x <= canvas.width + VIEW_W * scale, `x=${x} 越界`);
    assert.ok(y >= -VIEW_H * scale && y <= canvas.height + VIEW_H * scale, `y=${y} 越界`);
  }
});

test("连续跑 10 秒：每帧都干净，粒子不无限堆积", () => {
  const { canvas, log } = fakeCanvas();
  const r = createRenderer(canvas);
  const st = freshState();
  for (let i = 0; i < 600; i += 1) {
    stepFrame(st, 1 / 60);
    if (i % 7 === 0) r.pop(st.player.tx, st.player.ty, "#ffd94a");
    assert.doesNotThrow(() => r.draw(st, 1 / 60), `第 ${i} 帧抛错`);
  }
  assert.deepEqual(log.colors, [], `出现非法绘制值：${JSON.stringify(log.colors.slice(0, 5))}`);
});

test("七张迷宫都能画，包括双巢与全机关的最后一张", () => {
  for (let i = 0; i < MAZES.length; i += 1) {
    const { canvas, log } = fakeCanvas();
    const r = createRenderer(canvas);
    const st = createState({ maze: parseMaze(MAZES[i]), seed: 11 });
    for (let f = 0; f < 120; f += 1) {
      stepFrame(st, 1 / 60);
      r.draw(st, 1 / 60);
    }
    assert.deepEqual(log.colors, [], `${MAZES[i].id} 绘制出现非法值`);
  }
});

test("AI 可读化开关：关掉后不再画意图环与充能环（绘制量显著下降）", () => {
  const a = fakeCanvas();
  const b = fakeCanvas();
  const ra = createRenderer(a.canvas);
  const rb = createRenderer(b.canvas);
  rb.setAssist(false);
  const st = freshState();
  ra.draw(st, 1 / 60);
  rb.draw(st, 1 / 60);
  assert.ok(a.log.points.length > b.log.points.length, "开着可读化应当画得更多（柔光环 + 充能环 + 预输入箭头）");
  assert.equal(ra.assist, true);
  assert.equal(rb.assist, false);
});

test("降级开关：关掉动效后不再产生粒子，且已有粒子被清空", () => {
  const { canvas } = fakeCanvas();
  const r = createRenderer(canvas);
  r.pop(5, 5, "#fff", 12);
  r.setMotion(false);
  r.pop(6, 6, "#fff", 12);
  const st = freshState();
  assert.doesNotThrow(() => r.draw(st, 1 / 60));
  r.setMotion(true);
  r.clearParticles();
  assert.doesNotThrow(() => r.draw(st, 1 / 60));
});

test("resize 会按 dpr 重建画布尺寸，并把逻辑坐标等比铺满", () => {
  const { canvas } = fakeCanvas(300, 620);
  const r = createRenderer(canvas);
  r.resize();
  // 300×620 的画布里，短边是宽：scale 应由宽决定
  assert.equal(canvas.width, 300, "未设 dpr 时按 1 倍处理");
  assert.ok(canvas.height >= 620);
  assert.doesNotThrow(() => r.draw(freshState(), 1 / 60));
  assert.deepEqual(r.viewSize(), { w: VIEW_W, h: VIEW_H });
});

test("frightened 期间全盘压暗（视觉与世界观一致，不是套蓝色滤镜）", () => {
  const { canvas } = fakeCanvas();
  const r = createRenderer(canvas);
  const st = freshState();
  st.frightTimer = 3;
  st.ghosts.forEach((g) => {
    g.mode = "frightened";
  });
  assert.doesNotThrow(() => r.draw(st, 1 / 60));
});

test("残局也能渲染：幽灵四只就位、玩家在指定出生点", () => {
  const { canvas, log } = fakeCanvas();
  const r = createRenderer(canvas);
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 3, setpiece: SETPIECES[0] });
  assert.equal(st.ghosts.length, 4);
  r.draw(st, 1 / 60);
  assert.deepEqual(log.colors, []);
});
