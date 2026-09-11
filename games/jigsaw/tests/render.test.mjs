// filepath: games/jigsaw/tests/render.test.mjs
// 渲染层最关键的一条契约：**格子 (r,c) 画的必须是"当前放在这一格的那块碎片"的原位切片**，
// 而不是这一格自身位置的切片。
//
// 为什么单独守这条：取错成自身位置时，棋盘会永远渲染成一张完整未打乱的图 ——
// 状态机完全正确、交换也真的生效了，但玩家看到的是"这局一开始就是拼好的，
// 而且怎么点都没反应"。纯状态测试与"每格有没有内容"的像素测试都抓不到它，
// 所以用桩 2D 上下文把 drawImage 的**源矩形**记录下来直接断言。
import test from "node:test";
import assert from "node:assert/strict";

import { createRenderer } from "../js/render.mjs";
import { createState, applyMove } from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";

/** 记录 drawImage 调用的桩 2D 上下文；其它方法一律 no-op（未知方法用 Proxy 兜住） */
function stubCtx(log) {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === "createLinearGradient" || prop === "createRadialGradient" || prop === "createPattern") {
        return () => gradient;
      }
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (prop === "drawImage") {
        return (...args) => {
          if (log) log.push(args);
        };
      }
      return () => undefined;
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
  });
}

function stubCanvas(log, cssWidth = 300) {
  return {
    width: 0,
    height: 0,
    clientWidth: cssWidth,
    clientHeight: cssWidth,
    dataset: {},
    getBoundingClientRect: () => ({ width: cssWidth, height: cssWidth, left: 0, top: 0 }),
    getContext: () => stubCtx(log),
  };
}

/** 在桩 DOM 下渲染一次，返回棋盘上的 drawImage 调用序列 */
function renderOnce(state, level) {
  const log = [];
  const board = stubCanvas(log);
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => stubCanvas(null) };
  try {
    // reducedMotion: true 跳过补间，位置直接落在最终格上，断言更干净
    const renderer = createRenderer(board, { reducedMotion: true });
    assert.ok(renderer, "渲染器应能在桩画布上创建");
    renderer.setLevel(level);
    renderer.mount();
    renderer.setState(state, "init");
    // mount/setState 内部也会各渲染一次；只保留最后这一次的调用序列
    log.length = 0;
    renderer.render();
    assert.equal(log.length, state ? state.n * state.n : level.n * level.n, "最后一次渲染应每格一次 drawImage");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
  return log;
}

test("每格画的是该格碎片的原位切片（不是格子自身位置的切片）", () => {
  const level = LEVELS[0];
  const state = createState(level.n, level.seed);
  const n = state.n;
  const calls = renderOnce(state, level);

  assert.equal(calls.length, n * n, `应每格一次 drawImage，实际 ${calls.length} 次`);

  const art = calls[0][0];
  const slice = calls[0][3]; // 源矩形宽 = 艺术图边长 / n
  assert.ok(slice > 0, `切片尺寸应 > 0，实际 ${slice}`);

  let index = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const piece = state.grid[r][c];
      const call = calls[index++];
      assert.equal(call[0], art, "所有切片应来自同一张离屏艺术图");
      assert.equal(
        call[1],
        piece.c * slice,
        `格 (${r},${c}) 的切片源 x 应为碎片原位列 ${piece.c}（=${piece.c * slice}），实际 ${call[1]}`
      );
      assert.equal(
        call[2],
        piece.r * slice,
        `格 (${r},${c}) 的切片源 y 应为碎片原位行 ${piece.r}（=${piece.r * slice}），实际 ${call[2]}`
      );
    }
  }
});

test("初始局面在画面上确实是打乱的（不是完整原图）", () => {
  for (const level of LEVELS) {
    const state = createState(level.n, level.seed);
    const n = state.n;
    const calls = renderOnce(state, level);
    const slice = calls[0][3];

    // 德兰热（derangement）保证每块都不在原位 —— 那么每一格画的都不该是它自己的位置
    let sameAsOwn = 0;
    let index = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const call = calls[index++];
        if (call[1] === c * slice && call[2] === r * slice) sameAsOwn++;
      }
    }
    assert.equal(
      sameAsOwn,
      0,
      `${level.id}：有 ${sameAsOwn} 格画的是自己位置的切片 —— 棋盘会看起来像"已经拼好了"`
    );
  }
});

test("交换后两格互换切片源（渲染跟随状态）", () => {
  const level = LEVELS[0];
  const state = createState(level.n, level.seed);
  const n = state.n;

  // 找一块没在原位的碎片，把它换到它的原位去
  let from = null;
  let to = null;
  for (let r = 0; r < n && !from; r++) {
    for (let c = 0; c < n && !from; c++) {
      const p = state.grid[r][c];
      if (p.r !== r || p.c !== c) from = { r, c };
    }
  }
  for (let r = 0; r < n && !to; r++) {
    for (let c = 0; c < n && !to; c++) {
      if (r === from.r && c === from.c) continue;
      const p = state.grid[r][c];
      if (p.r === from.r && p.c === from.c) to = { r, c };
    }
  }

  const outcome = applyMove(state, { from, to });
  assert.equal(outcome.action, "swap", "这一对应当可交换");

  const before = renderOnce(state, level);
  const after = renderOnce(outcome.state, level);
  const slice = after[0][3];
  const srcAt = (calls, r, c) => {
    const call = calls[r * n + c];
    return { x: call[1], y: call[2] };
  };

  // from 格现在放着 from 原位的那块 -> 切片源应为 from 自己的位置
  assert.deepEqual(srcAt(after, from.r, from.c), { x: from.c * slice, y: from.r * slice });
  // to 格换走了那块 -> 切片源应变成原来 from 格的碎片原位
  const moved = outcome.state.grid[to.r][to.c];
  assert.deepEqual(srcAt(after, to.r, to.c), { x: moved.c * slice, y: moved.r * slice });
  // 交换确实改变了渲染（这两格前后不同）
  assert.notDeepEqual(srcAt(before, from.r, from.c), srcAt(after, from.r, from.c));
});

test("已拼好的局面每格画自己位置的切片（完成态渲染正确）", () => {
  const level = LEVELS[0];
  const n = level.n;
  const identity = {
    n,
    grid: Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => ({ r, c }))),
    locked: Array.from({ length: n }, () => new Array(n).fill(true)),
    moves: 0,
  };
  const calls = renderOnce(identity, level);
  const slice = calls[0][3];
  let index = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const call = calls[index++];
      assert.equal(call[1], c * slice, `完成态格 (${r},${c}) 源 x 应为自身列`);
      assert.equal(call[2], r * slice, `完成态格 (${r},${c}) 源 y 应为自身行`);
    }
  }
});

test("state 为空时退化为按格自身位置绘制，不抛错", () => {
  const level = LEVELS[0];
  const n = level.n;
  const log = [];
  const board = stubCanvas(log);
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => stubCanvas(null) };
  try {
    const renderer = createRenderer(board, { reducedMotion: true });
    renderer.setLevel(level);
    renderer.mount();
    renderer.setState(null, "init");
    log.length = 0;
    renderer.render();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
  assert.equal(log.length, n * n);
});
