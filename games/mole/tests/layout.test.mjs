// layout.test.mjs — 洞的视觉契约测试（无浏览器）。
//
// 分两层：
//  A. CSS 解析断言：确认 style.css 里的几何数字与 layout.mjs 模拟器一致，
//     防止"改了 CSS 但模拟器没跟着改"导致假绿（模拟器与 CSS 脱钩 = 测试失效）。
//  B. 几何断言：在真实视口宽度下实算洞口 / 地鼠 / 地平线的位置关系，
//     钉死两类真实出现过的视觉 bug：
//       · 地鼠藏不住 —— "很多地鼠默认在外面"
//       · 洞上盖了个实心遮罩 —— "为什么洞有个盖子"
//     外加两条数学约束，防止未来又被改回错误形状：
//       · 洞口椭圆不能拿来当地鼠的裁剪容器（装不下，会把地鼠削成只剩一个头）
//       · 洞口不能用径向 mask 收窄（站直的地鼠必被削头）
//
// 桩环境量不到真实像素，但几何算法可以 —— 这套测试是视觉回归护栏。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { holeMetrics, moleGeometry, stageWidthFor, groundLineMatchesPitCenter } from "./layout.mjs";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(gameDir, "css", "style.css"), "utf8");

/** 取一条规则（支持 .a .b,\n.c .d 这种逗号选择器组） */
function rule(selector) {
  const idx = css.search(new RegExp(escapeRe(selector).replace(/,\s*/g, ",\\s*") + "\\s*(,|\\{)"));
  assert.ok(idx >= 0, `style.css 缺少规则 ${selector}`);
  return css.slice(idx, css.indexOf("}", idx));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 取百分比；CSS 里写 `0`（无单位）视为 0% */
function pct(text, prop) {
  const m = text.match(new RegExp(`${prop}:\\s*(-?[\\d.]+)%`));
  if (m) return Number(m[1]) / 100;
  const zero = text.match(new RegExp(`${prop}:\\s*0(?!\\.|\\d)`));
  assert.ok(zero, `规则里缺少百分比属性 ${prop}（原文：${text.slice(0, 80)}）`);
  return 0;
}

// 列数必须与 ui.mjs 的 gridForWidth 一致（<=768 才是 3 列）
const VIEWPORTS = [
  { w: 1280, rows: 3, cols: 4 },
  { w: 1024, rows: 3, cols: 4 },
  { w: 900, rows: 3, cols: 4 },
  { w: 834, rows: 3, cols: 4 },
  { w: 768, rows: 3, cols: 3 },
  { w: 390, rows: 3, cols: 3 },
];

test("视口列数与 ui.mjs 的 gridForWidth 一致", async () => {
  const { gridForWidth } = await import("../js/ui.mjs");
  for (const vp of VIEWPORTS) {
    const g = gridForWidth(vp.w);
    assert.equal(g.cols, vp.cols, `${vp.w}px 的列数应为 ${g.cols}`);
    assert.equal(g.rows, vp.rows, `${vp.w}px 的行数应为 ${g.rows}`);
  }
});

/* ============ A. CSS 与模拟器一致性 ============ */

test("CSS: 洞与洞口的几何百分比与模拟器一致", () => {
  assert.match(rule(".hole"), /aspect-ratio:\s*1\s*\/\s*0\.94/, ".hole 宽高比应为 1/0.94");

  const pit = rule(".hole-pit");
  assert.equal(pct(pit, "left"), 0.03);
  assert.equal(pct(pit, "right"), 0.03);
  assert.equal(pct(pit, "top"), 0.46);
  assert.equal(pct(pit, "bottom"), 0);
  assert.match(pit, /border-radius:\s*50%/, "洞口应是椭圆");
  // 洞口绝不能是地鼠的裁剪容器
  assert.ok(!/overflow:\s*hidden/.test(pit), "洞口不应 overflow:hidden（它会把地鼠削成只剩一个头）");
});

test("CSS: 地鼠活动区的百分比与模拟器一致", () => {
  const clip = rule(".mole-clip");
  assert.equal(pct(clip, "bottom"), 0.27, "活动区底边应压在地平线上（27%）");
  assert.equal(pct(clip, "height"), 0.78);
  assert.equal(pct(clip, "left"), 0.03);
  assert.equal(pct(clip, "right"), 0.03);
  assert.match(clip, /overflow:\s*hidden/, "活动区必须裁剪，否则隐藏态地鼠会露在洞外");
});

test("CSS: 地鼠尺寸与位移百分比与模拟器一致", () => {
  const mole = rule(".mole");
  assert.equal(pct(mole, "width"), 0.66, ".mole 宽度应取活动区的 66%");
  assert.equal(pct(mole, "height"), 1, ".mole 高度应等于活动区高度");
  assert.equal(pct(mole, "bottom"), 0);
  const hidden = mole.match(/transform:\s*translate\(-50%,\s*(-?[\d.]+)%\)/);
  assert.ok(hidden, ".mole 缺少默认 transform");
  assert.equal(Number(hidden[1]) / 100, 1, "隐藏态应整只沉下去（100%）");
});

test("CSS: 冒出态回到 translate(-50%, 0)", () => {
  assert.match(rule('.hole[data-phase="rise"] .mole'),
    /transform:\s*translate\(-50%,\s*0\)/, "冒出态应回到 translate(-50%, 0)");
});

test("CSS: 不存在盖子式实心遮罩，也不存在椭圆径向收窄", () => {
  assert.ok(!/\.hole-rim\s*\{/.test(css), "不应再存在 .hole-rim 实心椭圆（它就是那个'盖子'）");
  assert.ok(!/\.hole\s*\{[^}]*border-radius:\s*50%/.test(css), ".hole 不应是实心椭圆");
  assert.ok(!/mask-image/.test(rule(".hole-pit")), "洞口不应再用 radial mask 收窄（会削掉地鼠的头）");
  assert.ok(!/mask-image/.test(rule(".mole-clip")), "活动区不应收窄（会削掉地鼠的头）");
});

test("CSS: 洞口与地鼠活动区的层级正确（地鼠遮住洞口后半圈）", () => {
  assert.match(rule(".hole-pit"), /z-index:\s*1/);
  assert.match(rule(".mole-clip"), /z-index:\s*2/);
});

/* ============ B. 几何断言（真实视口宽度） ============ */

for (const vp of VIEWPORTS) {
  const tag = `${vp.w}px`;

  test(`${tag}: 洞口完整落在洞位内、地平线与椭圆中心重合`, () => {
    const m = holeMetrics(vp.w, vp.rows, vp.cols);
    assert.ok(m.holeWidth > 20, `洞位宽过小: ${m.holeWidth}`);
    assert.ok(m.pitX >= 0 && m.pitX + m.pitWidth <= m.holeWidth + 0.01, "洞口横向溢出");
    assert.ok(m.pitTop >= 0 && m.pitBottom <= m.holeHeight + 0.01, "洞口纵向溢出");
    assert.ok(groundLineMatchesPitCenter(m), "地平线应等于洞口椭圆中心");
  });

  test(`${tag}: 隐藏态地鼠完全不可见（钻回土里，洞里只剩黑坑）`, () => {
    const g = moleGeometry(vp.w, vp.rows, vp.cols, "none");
    assert.equal(g.visible, 0, `隐藏态仍露出 ${g.visible.toFixed(1)}px —— 这就是"地鼠默认在外面"`);
    // 且必须确实沉到地平线以下，而不是停在半路
    assert.ok(g.moleTop >= g.clipBottom - 0.01,
      `隐藏态未完全沉下: moleTop=${g.moleTop.toFixed(1)} clipBottom=${g.clipBottom.toFixed(1)}`);
  });

  test(`${tag}: 冒出态地鼠从地平线升起并遮住洞口后半圈`, () => {
    const up = moleGeometry(vp.w, vp.rows, vp.cols, "up");
    assert.equal(up.dy, 0, "冒出态不应有下移");
    // 底边正好落在地平线上
    assert.ok(Math.abs(up.moleBottom - up.groundLine) < 0.01,
      `地鼠底边应贴地平线: ${up.moleBottom.toFixed(1)} vs ${up.groundLine.toFixed(1)}`);
    // 整只可见（不被自己的活动区裁掉）
    assert.ok(up.visible >= up.moleHeight - 0.01,
      `冒出态被裁: visible=${up.visible.toFixed(1)} moleH=${up.moleHeight.toFixed(1)}`);
    // 头部明显探出洞口椭圆顶边之上
    assert.ok(up.moleTop < up.pitTop,
      `冒出态未探出洞口: moleTop=${up.moleTop.toFixed(1)} pitTop=${up.pitTop.toFixed(1)}`);
    // 遮住洞口后半圈（这是"从洞里钻出来"的视觉来源）
    assert.ok(up.pitOverlap > up.pitHeight * 0.4,
      `未遮住洞口后半圈: overlap=${up.pitOverlap.toFixed(1)}/${up.pitHeight.toFixed(1)}`);
  });

  test(`${tag}: 冒出幅度足够，且头顶不会越界压到上一行`, () => {
    const hidden = moleGeometry(vp.w, vp.rows, vp.cols, "none");
    const up = moleGeometry(vp.w, vp.rows, vp.cols, "up");
    assert.ok(hidden.moleTop - up.moleTop >= up.moleHeight - 0.01, "冒出幅度应为整只身长");
    // 头顶探出洞位顶边的量必须小于网格行间距，否则会盖住上一行
    assert.ok(-up.moleTop < up.gap,
      `头顶溢出 ${(-up.moleTop).toFixed(1)}px 超过行间距 ${up.gap}px`);
  });

  test(`${tag}: 地鼠比例合理（站立姿态，不是矮团子也不是细长条）`, () => {
    const m = holeMetrics(vp.w, vp.rows, vp.cols);
    const ar = m.moleHeight / m.moleWidth;
    assert.ok(ar > 1.1 && ar < 1.7, `地鼠长宽比 ${ar.toFixed(2)} 不合理`);
    // 地鼠必须比洞口椭圆高，否则"冒头"看不出来
    assert.ok(m.moleHeight > m.pitHeight, "地鼠比洞口还矮，冒出来也不显眼");
  });

  test(`${tag}: 舞台宽度与网格列数自洽`, () => {
    const s = stageWidthFor(vp.w);
    const m = holeMetrics(vp.w, vp.rows, vp.cols);
    assert.ok(s.gardenWidth > 0 && m.gridWidth > 0, "舞台/网格宽度应为正");
    const cells = m.holeWidth * vp.cols + m.gap * (vp.cols - 1);
    assert.ok(cells <= m.gridWidth + 0.01, `网格溢出: cells=${cells} gridWidth=${m.gridWidth}`);
  });
}

test("移动端与桌面的洞位宽高比不同（1/1 vs 1/0.94）", () => {
  assert.equal(holeMetrics(390, 3, 3).ratio, 1, "移动端应为正方形");
  assert.equal(holeMetrics(1280, 3, 4).ratio, 0.94, "桌面端应为 1/0.94");
});

test("几何是比例制而非硬编码像素（各视口观感一致）", () => {
  const big = moleGeometry(1280, 3, 4, "up");
  const small = moleGeometry(390, 3, 3, "up");
  assert.notEqual(Math.round(big.moleHeight), Math.round(small.moleHeight),
    "尺寸应随视口缩放，不能是硬编码像素");
  // 但比例关系必须一致：地鼠高/洞口高、地鼠高/洞位高
  for (const key of ["pitHeight", "holeHeight"]) {
    const rb = big.moleHeight / big[key];
    const rs = small.moleHeight / small[key];
    assert.ok(Math.abs(rb - rs) < 0.02,
      `${key} 比例不一致: 桌面=${rb.toFixed(3)} 移动=${rs.toFixed(3)}`);
  }
});
