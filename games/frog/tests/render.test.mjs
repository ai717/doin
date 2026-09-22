// 渲染层回归测试：用「近似浏览器行为」的 mock Canvas 2D 上下文跑真实 draw()，
// 验证在 40 关 × 连续相位推进下不会因「边缘换行切出亚像素碎片 → 负半径」而抛异常。
// 背景：drawLogAt/drawVehicle 曾因边缘换行产生窄碎片，w/2 - pad 变负，触发
// ctx.ellipse / ctx.arcTo 的 IndexSizeError，异常抛穿 draw() 导致主循环中断、
// 车/荷叶/青蛙全部不再绘制（表现为「游戏未加载成功」）。
import test from "node:test";
import assert from "node:assert";
import { createRenderer } from "../js/render.mjs";
import { createState } from "../js/engine.mjs";
import { buildLevel } from "../js/level.mjs";

// mock CanvasRenderingContext2D：梯度与圆/椭圆半径一旦非有限或为负即抛错（对齐真实浏览器）。
function makeCtx() {
  const grad = { addColorStop() {} };
  const finiteOrThrow = (name) => (...args) => {
    for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) {
      throw new Error(`${name} 收到非有限值`);
    }
    return grad;
  };
  const nonNegative = (name) => (...args) => {
    // arc(x,y,r,...) / arcTo(x1,y1,x2,y2,r) / ellipse(cx,cy,rx,ry,...) 中的半径参数
    const radii = name === "arc" ? [args[2]] : name === "arcTo" ? [args[4]] : [args[2], args[3]];
    for (const r of radii) if (typeof r === "number" && r < 0) {
      throw new Error(`${name} 负半径 ${r}`);
    }
  };
  return new Proxy({}, {
    get(_t, p) {
      if (p === "createLinearGradient" || p === "createRadialGradient") return finiteOrThrow(String(p));
      if (p === "arc" || p === "arcTo" || p === "ellipse") return nonNegative(String(p));
      return () => {};
    },
    set() { return true; },
  });
}

function makeRenderer() {
  return createRenderer({ getContext: () => makeCtx(), style: {} });
}

test("renderer.draw 在 40 关连续推进下不抛负半径/非有限值异常", () => {
  const renderer = makeRenderer();
  renderer.resize(559, 559);
  for (let id = 1; id <= 40; id += 1) {
    const state = createState(buildLevel(id));
    renderer.reset();
    for (let t = 0; t < 480; t += 1) {
      state.time = t / 20; // 0 ~ 24 秒，跨多个相位循环与多次边缘换行
      assert.doesNotThrow(() => renderer.draw(state), `level ${id} @ t=${t / 20} draw 抛异常`);
    }
  }
});

test("renderer.draw 边缘换行时不产生窄碎片负半径（针对性帧）", () => {
  const renderer = makeRenderer();
  renderer.resize(559, 559);
  // 用扫频覆盖不同相位，确保换行临界点（sx 逼近 13）都被命中且不抛错
  const state = createState(buildLevel(1));
  for (let i = 0; i < 5000; i += 1) {
    state.time = i * 0.013; // 覆盖大量小数相位，密集命中换行临界
    assert.doesNotThrow(() => renderer.draw(state), `扫频 t=${state.time} 抛异常`);
  }
});