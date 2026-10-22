// 积木爆破 · 渲染层回归（Canvas 录制桩，跑真实 render.mjs）
//
// 三类静默失败的护栏：
//   1) 非法颜色：rgba(...,NaN) / undefined 被 Canvas 静默忽略，图形凭空消失；
//   2) 几何飞出视口：参数量级错误 → 画面空白，而控制台干干净净；
//   3) draw call 预算：每帧过量绘制 → 移动端掉帧。
// 外加两条业务契约：
//   4) 锚点契约：anchorFor 必须让「光标恒落在块体真实格上」——跟手预览的根基；
//   5) ghost 三态：合法位径向柔光 / 非法位变暗灰 / 将消行霓虹描边，与 canPlace 一致。

import test from "node:test";
import assert from "node:assert/strict";
import { createRenderer } from "../js/render.mjs";
import {
  GRID, PIECES, canPlace, pieceCells, createState, snapshot, applyIntent
} from "../js/engine.mjs";

// ---------------------------------------------------------------- Canvas 录制桩
// 记录每次 fill/stroke 的路径点与样式、fillRect/strokeRect 的矩形，带完整 2D 仿射栈
// （粒子/吸附动画走 translate+rotate，不记变换的话几何断言会误报）。

function makeRecordingCanvas(w = 720, h = 560) {
  const paths = [];
  const calls = { fill: 0, stroke: 0, fillRect: 0, strokeRect: 0, drawImage: 0, fillText: 0 };
  const badColors = [];

  function checkColor(prop, v) {
    if (typeof v !== "string") return; // 渐变对象跳过
    if (v.includes("NaN") || v.includes("undefined") || !/^(rgba?\(|#|[a-z]+$)/.test(v)) {
      badColors.push(`${prop} = ${v}`);
    }
  }

  const gradient = {
    addColorStop: (_o, c) => checkColor("gradient", c)
  };

  let m = [1, 0, 0, 1, 0, 0]; // a b c d e f
  const stack = [];
  const apply = (x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

  let current = [];
  const ctx = {
    canvas: null,
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    font: "10px sans-serif",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowBlur: 0,
    shadowColor: "#000",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalCompositeOperation: "source-over",
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: () => ({ width: 0 }),
    beginPath() { current = []; },
    moveTo(x, y) { current.push(apply(x, y)); },
    lineTo(x, y) { current.push(apply(x, y)); },
    arc(x, y) { current.push(apply(x, y)); },
    arcTo(x1, y1, x2, y2) { current.push(apply(x2, y2)); },
    ellipse(x, y) { current.push(apply(x, y)); },
    closePath() {},
    fill() {
      calls.fill += 1;
      if (current.length >= 3) paths.push({ op: "fill", style: String(ctx.fillStyle), path: current.slice() });
    },
    stroke() {
      calls.stroke += 1;
      if (current.length >= 3) paths.push({ op: "stroke", style: String(ctx.strokeStyle), path: current.slice() });
    },
    fillRect(x, y, rw, rh) {
      calls.fillRect += 1;
      paths.push({
        op: "fillRect",
        style: String(ctx.fillStyle),
        path: [apply(x, y), apply(x + rw, y), apply(x + rw, y + rh), apply(x, y + rh)]
      });
    },
    strokeRect(x, y, rw, rh) {
      calls.strokeRect += 1;
      paths.push({
        op: "strokeRect",
        style: String(ctx.strokeStyle),
        path: [apply(x, y), apply(x + rw, y), apply(x + rw, y + rh), apply(x, y + rh)]
      });
    },
    save() { stack.push(m.slice()); },
    restore() { const prev = stack.pop(); if (prev) m = prev; },
    translate(dx, dy) { m = [m[0], m[1], m[2], m[3], m[4] + dx * m[0] + dy * m[2], m[5] + dx * m[1] + dy * m[3]]; },
    rotate(a) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      m = [c * m[0] + s * m[2], c * m[1] + s * m[3], -s * m[0] + c * m[2], -s * m[1] + c * m[3], m[4], m[5]];
    },
    scale(sx, sy) { m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]]; },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
    clearRect() {},
    clip() {
      if (current.length >= 3) paths.push({ op: "clip", style: "", path: current.slice() });
    },
    drawImage() { calls.drawImage += 1; },
    fillText() { calls.fillText += 1; },
    setLineDash() {}
  };

  // fillStyle / strokeStyle setter 校验颜色字符串（Canvas 对非法值静默忽略）
  let fill = "#000";
  let stroke = "#000";
  Object.defineProperty(ctx, "fillStyle", {
    get: () => fill,
    set: (v) => {
      checkColor("fillStyle", v);
      fill = v;
    }
  });
  Object.defineProperty(ctx, "strokeStyle", {
    get: () => stroke,
    set: (v) => {
      checkColor("strokeStyle", v);
      stroke = v;
    }
  });

  const canvas = {
    width: w,
    height: h,
    clientWidth: w,
    clientHeight: h,
    getBoundingClientRect: () => ({ width: w, height: h }),
    getContext: () => ctx
  };
  return { canvas, paths, calls, badColors };
}

function allPoints(paths) {
  const pts = [];
  for (const p of paths) for (const pt of p.path) pts.push(pt);
  return pts;
}

const IDLE_UI = { selected: null, rotations: [0, 0, 0], cursor: null };

// ---------------------------------------------------------------- 用例

test("render: 空盘首帧——无非法颜色、几何在视口内、draw call 有预算", () => {
  const { canvas, paths, calls, badColors } = makeRecordingCanvas();
  const renderer = createRenderer(canvas);
  renderer.syncSize();
  const view = snapshot(createState({ seed: 20261018, difficulty: "easy" })); // 休闲 = 空盘
  renderer.render(view, IDLE_UI, 0.016);

  assert.deepEqual(badColors, [], "不得出现 NaN/undefined/非法格式颜色");
  assert.ok(paths.length > 50, `绘制路径太少（${paths.length}），可能画面空白`);
  for (const pt of allPoints(paths)) {
    assert.ok(
      pt.x >= -8 && pt.x <= 728 && pt.y >= -8 && pt.y <= 568,
      `几何点飞出视口：${JSON.stringify(pt)}`
    );
  }
  const total = calls.fill + calls.stroke + calls.fillRect + calls.strokeRect;
  assert.ok(total > 100, `draw call 太少（${total}），渲染可能没跑`);
  assert.ok(total < 900, `draw call 过量（${total}），有掉帧风险`);
});

test("render: 落子后——占格、吸附动画都画出来，颜色与几何仍健全", () => {
  const { canvas, paths, badColors } = makeRecordingCanvas();
  const renderer = createRenderer(canvas);
  renderer.syncSize();
  // 钉死队列三块都是 mono，空盘 (0,0) 必合法（与种子无关）
  const state = { ...createState({ seed: 20261018, difficulty: "easy" }), queue: ["mono", "mono", "mono"] };
  const next = applyIntent(state, { type: "place", slot: 0, rotation: 0, row: 0, col: 0 });
  assert.ok(next.action, "mono 空盘 (0,0) 必须可放");
  renderer.render(snapshot(next.state), IDLE_UI, 0.016);
  renderer.render(snapshot(next.state), IDLE_UI, 0.016); // 第二帧：吸附动画推进

  assert.deepEqual(badColors, []);
  assert.ok(paths.length > 50, "落子后必须有绘制");
  for (const pt of allPoints(paths)) {
    assert.ok(pt.x >= -8 && pt.x <= 728 && pt.y >= -8 && pt.y <= 568, `几何点飞出视口：${JSON.stringify(pt)}`);
  }
});

test("render: 消行——clear 闪光与彩纸粒子都画出来", () => {
  const { canvas, paths, badColors } = makeRecordingCanvas();
  const renderer = createRenderer(canvas);
  renderer.syncSize();

  // 脚本化构造消行：第 3 行填 7 格，队列钉死 mono，落 (3,7) 即消行（与种子无关）
  const base = { ...createState({ seed: 20261018, difficulty: "easy" }), queue: ["mono", "mono", "mono"] };
  const board = base.board.slice();
  for (let c = 0; c < GRID - 1; c += 1) board[3 * GRID + c] = 5;
  const state = { ...base, board };
  const res = applyIntent(state, { type: "place", slot: 0, rotation: 0, row: 3, col: 7 });
  assert.ok(res.action, "补缺口必须合法");
  assert.equal(res.state.rowsCleared, 1, "必须触发消行");

  const view = snapshot(res.state);
  assert.ok(view.events.some((e) => e.kind === "clear"), "必须留下 clear 事件");
  assert.ok(view.particles.length > 0, "消除必须产出粒子");

  renderer.render(view, IDLE_UI, 0.016);
  assert.deepEqual(badColors, []);

  // clear 闪光：消除带上的 fillRect，霓虹青或品红
  const flash = paths.filter(
    (p) => p.op === "fillRect" && /rgba\((77, 243, 255|255, 79, 216)/.test(p.style)
  );
  assert.ok(flash.length > 0, "消除闪光必须绘制");
  // 粒子：fillRect + 糖果 hex 色（块体面是 path fill，不会进这个桶）
  const particleRects = paths.filter((p) => p.op === "fillRect" && /^#[0-9a-f]{6}$/i.test(p.style));
  assert.ok(particleRects.length > 0, "彩纸粒子必须绘制");
});

test("render: 锚点契约——光标恒落块体真实格，锚点在引擎坐标系内合法", () => {
  const { canvas } = makeRecordingCanvas();
  const renderer = createRenderer(canvas);
  renderer.syncSize();
  const empty = new Array(GRID * GRID).fill(0);

  for (const piece of PIECES) {
    for (let rot = 0; rot < 4; rot += 1) {
      for (const [r, c] of [[0, 0], [3, 3], [7, 7], [4, 2], [1, 6], [5, 5]]) {
        const anchor = renderer.anchorFor(piece.id, rot, r, c);
        const occ = pieceCells(piece.id, rot).map(([dr, dc]) => [anchor.row + dr, anchor.col + dc]);
        assert.ok(
          occ.some(([rr, cc]) => rr === r && cc === c),
          `${piece.id} rot${rot} 光标 (${r},${c}) 必须落在块体真实格上（跟手锚定）`
        );
        // 锚点用引擎坐标系表达：界内时对空盘必然合法（预览==落子的前提）
        const inBoard = occ.every(([rr, cc]) => rr >= 0 && rr < GRID && cc >= 0 && cc < GRID);
        if (inBoard) {
          assert.ok(
            canPlace(empty, piece.id, rot, anchor.row, anchor.col),
            `${piece.id} rot${rot} 锚点 (${anchor.row},${anchor.col}) 在空盘上必须合法`
          );
        }
      }
    }
  }
});

test("render: ghost 三态——合法柔光 / 非法变暗 / 将消行霓虹描边", () => {
  const { canvas, paths } = makeRecordingCanvas();
  const renderer = createRenderer(canvas);
  renderer.syncSize();

  // 构造：第 3 行已填 7 格，队列头三块都是 mono
  const base = { ...createState({ seed: 7, difficulty: "easy" }), queue: ["mono", "mono", "mono"] };
  const board = base.board.slice();
  for (let c = 0; c < GRID - 1; c += 1) board[3 * GRID + c] = 5;
  const view = snapshot({ ...base, board });

  // 合法 + 将消：光标落在缺口 (3,7)
  renderer.render(view, { selected: 0, rotations: [0, 0, 0], cursor: { row: 3, col: 7 } }, 0.016);
  assert.ok(
    paths.some((p) => p.op === "fillRect" && p.style === "[object Object]"),
    "合法预览必须有无边界径向柔光"
  );
  assert.ok(
    paths.some((p) => p.op === "strokeRect" && p.style === "rgba(255, 79, 216, 0.85)"),
    "将消行必须有霓虹描边预告"
  );

  // 非法：plus 拖到 (7,7) 必越界 → 变暗灰块
  const view2 = snapshot({ ...base, board, queue: ["pento-plus", "mono", "mono"] });
  paths.length = 0;
  renderer.render(view2, { selected: 0, rotations: [0, 0, 0], cursor: { row: 7, col: 7 } }, 0.016);
  assert.ok(
    paths.some((p) => p.op === "fill" && p.style === "rgba(120, 130, 150, 0.5)"),
    "非法预览必须变暗"
  );
  assert.ok(
    !paths.some((p) => p.op === "fillRect" && p.style === "[object Object]"),
    "非法预览不得出现合法柔光"
  );
});

test("render: 选中但无光标——棋盘区零幽灵（托盘交互不得点亮网格）", () => {
  const { canvas, paths } = makeRecordingCanvas();
  const renderer = createRenderer(canvas);
  renderer.syncSize();
  const view = snapshot(createState({ seed: 20261018, difficulty: "easy" })); // 空盘

  // 用户反馈：点击或旋转顶部拼块时棋盘曾亮出幽灵，被误认为已经落子。
  // 契约：selected 非空但 cursor 为 null 时，棋盘区域（y>110，托盘在 y<106）不得绘制任何块体。
  const hexFillsInBoard = () =>
    paths.filter((p) => p.op === "fill" && /^#[0-9a-f]{6}$/i.test(p.style) && p.path.some((pt) => pt.y > 110));

  renderer.render(view, { selected: 0, rotations: [1, 0, 0], cursor: null }, 0.016);
  assert.equal(hexFillsInBoard().length, 0, "无光标时棋盘区不得绘制幽灵块");

  // 对照组：同状态给了光标，棋盘区必须出现预览块（证明过滤器有效，防假绿）
  paths.length = 0;
  renderer.render(view, { selected: 0, rotations: [1, 0, 0], cursor: { row: 3, col: 3 } }, 0.016);
  assert.ok(hexFillsInBoard().length > 0, "对照组：有光标时棋盘区必须画出预览块");
});

test("render: hitTest 命中区域与 layout 自洽", () => {
  const { canvas } = makeRecordingCanvas();
  const renderer = createRenderer(canvas);
  renderer.syncSize();
  const L = renderer.layout();

  assert.deepEqual(renderer.hitTest(L.slots[0].x + 2, L.slots[0].y + 2), { type: "queue", slot: 0 });
  assert.deepEqual(renderer.hitTest(L.slots[2].x + 2, L.slots[2].y + 2), { type: "queue", slot: 2 });
  const mid = renderer.hitTest(L.board.x + L.board.cell * 3.5, L.board.y + L.board.cell * 4.5);
  assert.deepEqual(mid, { type: "board", row: 4, col: 3 });
  assert.equal(renderer.hitTest(2, 2), null, "柜体外必须返回 null");
  assert.equal(renderer.hitTest(L.board.x - 30, L.board.y + 10), null, "棋盘左侧外必须返回 null");
});
