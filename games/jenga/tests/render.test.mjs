// 叠叠乐 · 渲染层回归（Canvas 录制桩，跑真实 render.mjs）
//
// 三个真实发生过的 bug 的护栏：
//   1) 面的顶点排成"蝴蝶结"序 → Canvas nonzero 只填两个瓣，塔顶看起来"碎掉"；
//   2) 深度排序漏掉高度项 → 低处块盖住高处块；
//   3) 纯深度排序缺层序优先 → 同层邻块的 x/z 差跨层反转遮挡，侧面被别块的顶面
//      盖掉，塔身满布"面残缺"（z-buffer 逐像素实测 9.99% 错像素）；
//   4) 悬停柔光不裁剪 → 半径 1.5× 外接圆整片糊上去，把相邻木块与塔外背景一起照亮，
//      被照的那层起雾发白像"缺了一块"（用户反馈：视觉残缺）。
//   5) 落位区与 canStack 语义不一致 → topLineBoxes 对"顶层已满"返回空数组，画布上零个
//      落位点，玩家点塔顶永远命中实体块，卡在 HOLDING 抽不了第二块（用户反馈：第 7 关
//      「抽了一个就不能抽了」；第 2 章起 18 个手动选位关全中招）。
// 断言方式：把 render.mjs 真实画出来的多边形全部录下来，逐条做几何检查，
// 而不是只断言"没抛错"。

import test from "node:test";
import assert from "node:assert/strict";
import { createRenderer, faceRects } from "../js/render.mjs";
import {
  createInitialState, cloneState, STATUS, BLOCK_H, BLOCK_L, BLOCK_W, layerCount, towerBlocks, pullBlock, stackBlock, canStack, pullableBlocks, layerBox
} from "../js/engine.mjs";

// ---------------------------------------------------------------- Canvas 录制桩

function makeRecordingCanvas(w = 720, h = 560) {
  const paths = [];
  const gradient = { addColorStop: () => {} };
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
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 0 }),
    beginPath() { current = []; },
    moveTo(x, y) { current.push({ x, y }); },
    lineTo(x, y) { current.push({ x, y }); },
    closePath() { /* noop */ },
    fill() { if (current.length >= 3) paths.push({ op: "fill", style: String(this.fillStyle), path: current.slice() }); },
    stroke() { if (current.length >= 3) paths.push({ op: "stroke", style: String(this.strokeStyle), path: current.slice() }); },
    save() {}, restore() {}, translate() {}, scale() {}, setTransform() {}, clearRect() {},
    clip() { if (current.length >= 3) paths.push({ op: "clip", style: "", path: current.slice() }); },
    ellipse() {}, arc() {}, fillRect() {}, fillText() {}
  };
  const canvas = {
    width: w,
    height: h,
    clientWidth: w,
    clientHeight: h,
    getBoundingClientRect: () => ({ width: w, height: h }),
    getContext: () => ctx
  };
  return { canvas, paths };
}

// ---------------------------------------------------------------- 几何断言

function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// 两条线段是否"真正交叉"（端点接触不算，本项目里不会出现共线重叠）
function segmentsCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  const ab = ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0));
  const cd = ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  return ab && cd;
}

// 四边形是否自交（蝴蝶结）。正常四边形的两组对边永不相交。
function isSelfIntersecting(quad) {
  if (quad.length !== 4) return false;
  const [a, b, c, d] = quad;
  if (segmentsCross(a, b, c, d)) return true;
  if (segmentsCross(b, c, d, a)) return true;
  return false;
}

function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function quadArea(quad) {
  let s = 0;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i, i += 1) {
    s += (quad[j].x * quad[i].y - quad[i].x * quad[j].y);
  }
  return Math.abs(s) / 2;
}

function centroid(quad) {
  return {
    x: quad.reduce((s, p) => s + p.x, 0) / quad.length,
    y: quad.reduce((s, p) => s + p.y, 0) / quad.length
  };
}

function sameQuad(a, b, eps = 0.51) {
  if (a.length !== b.length) return false;
  const used = new Array(b.length).fill(false);
  return a.every((p) => {
    const idx = b.findIndex((q, i) => !used[i] && Math.abs(q.x - p.x) < eps && Math.abs(q.y - p.y) < eps);
    if (idx < 0) return false;
    used[idx] = true;
    return true;
  });
}

// ---------------------------------------------------------------- 用例

// 起一个渲染器并把自适应取景跑到完全收敛（dt=10 时平滑系数为 1，直接吸附到目标），
// 否则 scale 每帧还在漂，预期面算出来和录下来的对不上。
function bootRenderer(yaw, state, w = 720, h = 560) {
  const { canvas, paths } = makeRecordingCanvas(w, h);
  const renderer = createRenderer(canvas);
  renderer.resize();
  renderer.setYaw(yaw);
  for (let i = 0; i < 60; i += 1) renderer.draw(state, { dt: 1 / 60 });
  renderer.draw(state, { dt: 10 });
  paths.length = 0;
  renderer.draw(state, { dt: 1 / 60 });
  return { renderer, paths };
}

test("faceRects：三个面都是简单四边形，且互不相同", () => {
  // 规范立方体的 8 个角（与 cornersOf 的 local 顺序一致），再做一个等轴投影落到 2D
  const hx = BLOCK_L / 2;
  const hy = BLOCK_H / 2;
  const hz = BLOCK_W / 2;
  const iso = (p) => ({ x: p.x - p.z, y: (p.x + p.z) * 0.5 - p.y });
  const pts = [];
  for (const [sx, sy, sz] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) {
    pts.push(iso({ x: sx * hx, y: sy * hy, z: sz * hz }));
  }
  const seen = [];
  for (const visX of [1, -1]) {
    for (const visZ of [1, -1]) {
      const faces = faceRects(pts, visX, visZ);
      for (const [name, quad] of Object.entries(faces)) {
        assert.equal(quad.length, 4, `${name} 应有 4 个顶点`);
        assert.ok(quadArea(quad) > 0.1, `${name} 面积应 > 0`);
        assert.ok(!isSelfIntersecting(quad), `${name} 顶点绕序错误（蝴蝶结）visX=${visX} visZ=${visZ}`);
        seen.push(quad);
      }
    }
  }
  // faceRects 只返回朝向相机的三个面（顶 + 两侧），底面按定义永远不画，
  // 所以 4 种 vis 组合去重后应恰好是 5 个面（顶 + 4 个侧）。
  const unique = [];
  for (const q of seen) if (!unique.some((u) => sameQuad(u, q, 1e-6))) unique.push(q);
  assert.equal(unique.length, 5, "应覆盖顶面与 4 个侧面（底面不画）");
});

test("渲染整塔：所有四边形填充都不是蝴蝶结", () => {
  for (const yaw of [0, 0.4, 1.2, 2.5, -0.9, Math.PI]) {
    const state = createInitialState({ seed: 4242 });
    const { paths } = bootRenderer(yaw, state);
    const quads = paths.filter((p) => p.op === "fill" && p.path.length === 4);
    assert.ok(quads.length >= 3 * state.blocks.length, `yaw=${yaw} 至少应有 3×${state.blocks.length} 个块面，实得 ${quads.length}`);
    for (const q of quads) {
      assert.ok(!isSelfIntersecting(q.path), `yaw=${yaw} 出现自交四边形：${JSON.stringify(q.path)}`);
    }
  }
});

test("遮挡顺序：顶层面不会被后画的多边形侵入", () => {
  for (const yaw of [0, 0.7, 1.9, 3.4, -1.4]) {
    const state = createInitialState({ seed: 77 });
    const { renderer, paths } = bootRenderer(yaw, state);
    const quads = paths.filter((p) => p.op === "fill" && p.path.length === 4);
    const topLayer = layerCount(state) - 1;
    const topBlocks = towerBlocks(state).filter((b) => b.layer === topLayer);
    assert.ok(topBlocks.length > 0);

    for (const block of topBlocks) {
      const box = layerBox(state, block.layer, block.slot);
      const y = box.y + BLOCK_H; // 顶面高度
      const face = [
        renderer.project(box.x0, y, box.z0),
        renderer.project(box.x1, y, box.z0),
        renderer.project(box.x1, y, box.z1),
        renderer.project(box.x0, y, box.z1)
      ];
      const idx = quads.findIndex((q) => sameQuad(q.path, face));
      assert.ok(idx >= 0, `yaw=${yaw} 找不到顶块 ${block.id} 的顶面多边形`);
      // 顶面是最高表面：任何后画的多边形，其质心都不该落进顶面内部。
      // （用质心而不是顶点——同层邻块共享角点、低位块的侧面会贴边，都属于合法情形。）
      for (let i = idx + 1; i < quads.length; i += 1) {
        const c = centroid(quads[i].path);
        assert.ok(
          !pointInPolygon(c, face),
          `yaw=${yaw} 后画的多边形盖住了顶块 ${block.id} 的顶面（深度排序漏了高度项？）`
        );
      }
    }
  }
});

// 每块的顶面在录制流里的下标：层序优先 ⇒ 低层的下标必须处处小于高层。
function topFaceIndices(renderer, paths, state) {
  const quads = paths.filter((p) => p.op === "fill" && p.path.length === 4);
  const order = [];
  for (const block of towerBlocks(state)) {
    const box = layerBox(state, block.layer, block.slot);
    const y = box.y + BLOCK_H; // 顶面高度
    const face = [
      renderer.project(box.x0, y, box.z0),
      renderer.project(box.x1, y, box.z0),
      renderer.project(box.x1, y, box.z1),
      renderer.project(box.x0, y, box.z1)
    ];
    const idx = quads.findIndex((q) => sameQuad(q.path, face));
    assert.ok(idx >= 0, `找不到块 ${block.id}（层 ${block.layer}）的顶面多边形`);
    order.push({ id: block.id, layer: block.layer, idx });
  }
  return order;
}

function assertLayerFirst(order, yaw) {
  for (const a of order) {
    for (const b of order) {
      if (a.layer < b.layer) {
        assert.ok(
          a.idx < b.idx,
          `yaw=${yaw} 层 ${a.layer} 的块画在了层 ${b.layer} 之后——层序优先被破坏，塔身会出现"面残缺"`
        );
      }
    }
  }
}

test("遮挡顺序：层序优先——低层永远先于高层绘制", () => {
  // 历史 bug：orderedBlocks 曾用纯深度键排序，同层邻块的 x/z 差会跨层反转遮挡，
  // 下层块的侧面被别块的顶面盖掉（z-buffer 逐像素实测 9.99% 错像素，层序优先 0%）。
  for (const yaw of [0, 0.6, 1.7, -1.1, Math.PI]) {
    const state = createInitialState({ seed: 4242 });
    const { renderer, paths } = bootRenderer(yaw, state);
    assertLayerFirst(topFaceIndices(renderer, paths, state), yaw);
  }
});

test("遮挡顺序：层序优先在有空档的中局塔上同样成立", () => {
  // 抽一块再落位：塔身留下空档、顶上多一层——空档让跨层可见面变多，排序更不能错。
  const state = createInitialState({ seed: 77 });
  const piece = pullableBlocks(state).find((p) => p.layer > 0 && p.layer < layerCount(state) - 2);
  assert.ok(piece, "应找得到可抽的块");
  pullBlock(state, piece.layer, piece.slot);
  assert.equal(state.status, STATUS.HOLDING);
  // 初始塔顶是满的，落位会自动起新层（canStack：顶层已满时三个槽位都合法）
  assert.ok(canStack(state, 0), "抽块后应能落位");
  stackBlock(state, 0);
  assert.equal(state.status, STATUS.IDLE);
  for (const yaw of [0, 1.2, -0.9]) {
    const { renderer, paths } = bootRenderer(yaw, state);
    assertLayerFirst(topFaceIndices(renderer, paths, state), yaw);
  }
});

test("命中测试：点顶块中心能选中，点空白处返回 null", () => {
  const state = createInitialState({ seed: 9 });
  const { renderer } = bootRenderer(0, state);
  const topLayer = layerCount(state) - 1;
  const block = towerBlocks(state).find((b) => b.layer === topLayer);
  const y = (topLayer + 1) * BLOCK_H;
  const p = renderer.project(block.px, y, block.pz);
  // IDLE 态不显示落位槽（alwaysSlots 只在 HOLDING 传，见 main.mjs）——点顶块命中块本身
  const hit = renderer.hitTest(p.x, p.y, state);
  assert.ok(hit && hit.kind === "block" && hit.id === block.id, `应命中顶块，实得 ${JSON.stringify(hit)}`);
  assert.equal(renderer.hitTest(-9999, -9999, state), null);
});

test("HOLDING 落位区必须与 canStack 语义一致（顶层满 → 新层三槽可命中）", () => {
  // bug 护栏：topLineBoxes 曾对"顶层已满"返回空数组——画布上零个落位点。玩家按
  // touchTip 提示点塔顶落位永远命中实体块（「非法」toast + blocked），卡在 HOLDING
  // 再抽全被拒，即「抽了一个就不能抽了」。第 2 章起 18 个手动选位关抽底层端头
  // （顶层仍满）必踩，实测全中招。矩阵：24 关 × 3 策略 × 连抽 + 24 关安全连抽 12 轮。
  const state = createInitialState({ seed: 101037 });
  const { renderer } = bootRenderer(0, state);
  // 扫画布收集命中的槽位号（drawTopSlots 与 hitTest 共用 topLineBoxes，几何一致）
  const scanSlots = () => {
    const hits = new Set();
    for (let y = 2; y < renderer.getView().h - 2; y += 4) {
      for (let x = 2; x < renderer.getView().w - 2; x += 4) {
        const h = renderer.hitTest(x, y, state, { alwaysSlots: true });
        if (h && h.kind === "slot") hits.add(h.slot);
      }
    }
    return [...hits].sort();
  };

  // ① 顶层满：抽一块不会塌的 → HOLDING，引擎三槽全合法，画布必须三个都命中得了
  let first = null;
  for (const cand of pullableBlocks(state)) {
    const probe = cloneState(state);
    const r = pullBlock(probe, cand.layer, cand.slot);
    if (r.ok && !r.collapsed) { first = cand; break; }
  }
  assert.ok(first, "必须找得到不会塌的首抽块");
  assert.ok(first.layer < layerCount(state) - 1, "预置：抽非顶层，顶层保持满");
  pullBlock(state, first.layer, first.slot);
  assert.equal(state.status, STATUS.HOLDING);
  const legalFull = [0, 1, 2].filter((s) => canStack(state, s));
  assert.deepEqual(legalFull, [0, 1, 2], "顶层满时 canStack 三槽全合法（落位自动起新层）");
  const hitsFull = scanSlots();
  assert.deepEqual(hitsFull, [0, 1, 2], `顶层满时三槽必须全部可命中，实得 ${JSON.stringify(hitsFull)}`);
  // 落位后必须起新层且回到 IDLE（链条闭环，不卡死）
  stackBlock(state, 1);
  assert.equal(state.status, STATUS.IDLE);
  assert.equal(layerCount(state), 19, "往满层顶落位必须起新层");

  // ② 顶层未满：只应命中空槽，已占槽不得可命中（防止把块叠进已占位置）
  let second = null;
  for (const cand of pullableBlocks(state)) {
    if (cand.layer >= layerCount(state) - 1) continue; // 顶层不可抽
    const probe = cloneState(state);
    const r = pullBlock(probe, cand.layer, cand.slot);
    if (r.ok && !r.collapsed) { second = cand; break; }
  }
  assert.ok(second, "新层之下必须还有不会塌的可抽块");
  pullBlock(state, second.layer, second.slot);
  assert.equal(state.status, STATUS.HOLDING);
  const legalPart = [0, 1, 2].filter((s) => canStack(state, s));
  assert.deepEqual(legalPart, [0, 2], "新层已占 slot 1，只剩两个空槽合法");
  const hitsPart = scanSlots();
  assert.deepEqual(hitsPart, [0, 2], `未满时必须恰好命中两个空槽，实得 ${JSON.stringify(hitsPart)}`);
});

test("自适应取景：18 层与 27 层都不削顶、不出框", () => {
  const state18 = createInitialState({ layers: 18, seed: 5 });
  const state27 = createInitialState({ layers: 27, seed: 5 });
  const { renderer } = bootRenderer(0, state18, 720, 560);
  for (const [layers, state] of [[18, state18], [27, state27]]) {
    for (let i = 0; i < 90; i += 1) renderer.draw(state, { dt: 1 / 60 });
    renderer.draw(state, { dt: 10 });
    const view = renderer.getView();
    const top = layers * BLOCK_H;
    const padBottom = renderer.project(0, 0, 0);
    const topPoint = renderer.project(0, top, 0);
    assert.ok(topPoint.y > 0, `${layers} 层时塔顶被削（y=${topPoint.y.toFixed(1)}）`);
    assert.ok(padBottom.y < view.h, `${layers} 层时塔垫出框（y=${padBottom.y.toFixed(1)} > ${view.h}）`);
    const widest = [
      renderer.project(BLOCK_L / 2, 0, 0),
      renderer.project(-BLOCK_L / 2, 0, 0)
    ];
    assert.ok(Math.max(widest[0].x, widest[1].x) < view.w, `${layers} 层时横向出框`);
    assert.ok(Math.min(widest[0].x, widest[1].x) > 0, `${layers} 层时横向出框（左）`);
  }
});

test("抽块后手持块按立方体三面绘制，且不含蝴蝶结", () => {
  const state = createInitialState({ seed: 11 });
  const { renderer, paths } = bootRenderer(0, state);
  const topLayer = layerCount(state) - 1;
  const target = towerBlocks(state).find((b) => b.layer === topLayer - 1);
  assert.equal(state.status, STATUS.IDLE);
  pullBlock(state, target.layer, target.slot);
  assert.equal(state.status, STATUS.HOLDING);
  paths.length = 0;
  renderer.draw(state, { dt: 1 / 60 });
  const quads = paths.filter((p) => p.op === "fill" && p.path.length === 4);
  for (const q of quads) assert.ok(!isSelfIntersecting(q.path), "手持块或塔体出现蝴蝶结");
  // 手持块在塔顶之上：塔体少一块（-3 面）+ 手持块 3 面
  assert.ok(quads.length >= 3 * (state.blocks.length - 1) + 3, `面数不足：${quads.length}`);
});

test("悬停柔光必须裁进木块自身轮廓（不得糊到相邻块与塔外背景）", () => {
  const state = createInitialState({ seed: 5 });
  const { canvas, paths } = makeRecordingCanvas();
  const renderer = createRenderer(canvas);
  renderer.resize();
  for (let i = 0; i < 60; i += 1) renderer.draw(state, { dt: 1 / 60 });
  renderer.draw(state, { dt: 10 });

  const mid = towerBlocks(state).find((b) => b.layer === Math.floor(layerCount(state) / 2));
  assert.ok(mid, "应有中层木块");

  // 先确认"没悬停就不裁剪"——裁剪只属于柔光，不该平白多出来
  paths.length = 0;
  renderer.draw(state, { dt: 1 / 60 });
  assert.equal(paths.filter((p) => p.op === "clip").length, 0, "无悬停时不应出现裁剪");

  paths.length = 0;
  renderer.draw(state, { hoverId: mid.id, dt: 1 / 60 });

  const clips = paths.filter((p) => p.op === "clip");
  assert.equal(clips.length, 1, `悬停一块应恰有 1 次裁剪，实得 ${clips.length}`);
  const clip = clips[0];
  // 裁剪域 = 该块三个可见面（3×4 = 12 个顶点），不是整块外接圆
  assert.equal(clip.path.length, 12, `裁剪路径应为 3 面共 12 顶点，实得 ${clip.path.length}`);

  const idx = paths.indexOf(clip);
  const faces = paths.slice(0, idx).filter((p) => p.op === "fill" && p.path.length === 4).slice(-3);
  assert.equal(faces.length, 3, "裁剪前应有该块 3 个面填色");
  const bounds = (pts) => pts.reduce((b, p) => ({
    x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y),
    x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y)
  }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const cb = bounds(clip.path);
  const fb = bounds(faces.flatMap((f) => f.path));
  for (const k of ["x0", "y0", "x1", "y1"]) {
    assert.ok(Math.abs(cb[k] - fb[k]) < 0.01, `柔光裁剪域必须与木块三面完全重合（${k}: ${cb[k].toFixed(2)} vs ${fb[k].toFixed(2)}）`);
  }
});
