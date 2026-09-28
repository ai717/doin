import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  stripComments, mediaBlocks, baseCss, ruleOf, keyframesBlock, keyframesFrames,
  declValue, pxOf, bezierY, parseCubicBezier, simulate,
} from "./layout.mjs";

const gameRoot = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(gameRoot, "css", "style.css"), "utf8");

// ═══ A 层：模拟器自身可信（它若与 CSS 脱钩，B 层全是假绿）══════════

test("A · mediaBlocks 深度配对，不会把后续规则一起吃进来", () => {
  const mobile = mediaBlocks(css, "max-width: 768px");
  assert.ok(mobile.length >= 1, "未找到移动端媒体查询");
  for (const block of mobile) {
    const inner = (block.body.match(/@media/g) ?? []).length;
    const open = (block.body.match(/\{/g) ?? []).length;
    const close = (block.body.match(/\}/g) ?? []).length;
    assert.equal(open, close, "媒体查询块内花括号不配对");
    assert.equal(inner, 0, "媒体查询块里混入了另一个 @media，说明截块没有按深度配对");
  }
});

test("A · baseCss 确实剥离了媒体查询与关键帧", () => {
  const base = baseCss(css);
  assert.ok(!base.includes("max-width: 768px"), "基础层仍残留媒体查询条件");
  assert.ok(!base.includes("@keyframes"), "基础层仍残留关键帧");
  assert.ok(base.includes(".cabinet"), "基础层丢失了普通规则");
  // 基础层剥离后括号总量仍必须平衡（否则说明拼接逻辑吃掉了规则体）
  const open = (base.match(/\{/g) ?? []).length;
  const close = (base.match(/\}/g) ?? []).length;
  assert.equal(open, close, "baseCss 输出的花括号不配对");
});

test("A · ruleOf 支持逗号选择器组", () => {
  const decls = ruleOf(css, ".beam-panel");
  assert.ok(declValue(decls, "border-radius") !== null, "取不到 .beam-panel 的圆角");

  const guard = ruleOf(css, "[hidden]");
  assert.ok(guard.includes("display"), "[hidden] 守卫没取到 display 声明");
});

test("A · keyframesFrames 返回帧数组而不是整段原文", () => {
  const block = keyframesBlock(css, "beamBump");
  assert.ok(block, "缺 beamBump 关键帧");
  const frames = keyframesFrames(block);
  assert.ok(frames.length >= 3, "beamBump 帧数过少");
  assert.notEqual(frames.at(-1).decls.trim(), "}", "末帧取成了花括号，说明没有按帧正则拆解");
  assert.equal(frames.at(-1).at, 100);
});

test("A · bezierY 与解析器可用（线性曲线在中点必须等于 0.5）", () => {
  assert.ok(Math.abs(bezierY([0, 0, 1, 1], 0.5) - 0.5) < 1e-3, "线性曲线求值错误");
  const curve = parseCubicBezier("cubic-bezier(0.3, 0.35, 0.4, 0.85)");
  assert.deepEqual(curve, [0.3, 0.35, 0.4, 0.85]);
  assert.equal(parseCubicBezier("ease-in-out"), null, "非 cubic-bezier 必须返回 null");
});

// ═══ B 层：真实几何与视觉契约的实算 ═══════════════════════════════

test("B · 缓动契约：一半时间完成的位移必须 ≤72%（防抢跑）", () => {
  const curve = parseCubicBezier(declValue(ruleOf(baseCss(css), ":root"), "--ease-key"));
  assert.ok(curve, "取不到 --ease-key 的 cubic-bezier");
  const half = bezierY(curve, 0.5);
  assert.ok(half <= 0.72, `一半时间已完成 ${(half * 100).toFixed(1)}% 的位移，属于抢跑`);
  assert.ok(half >= 0.4, `一半时间只完成 ${(half * 100).toFixed(1)}% 的位移，起手过于迟钝`);
});

test("B · 移动端底部预留 ≥68px 广告避让并考虑安全区", () => {
  const mobile = mediaBlocks(css, "max-width: 768px").map((b) => b.body).join("\n");
  const pad = declValue(ruleOf(mobile, ".cabinet"), "padding");
  assert.ok(pad, "移动端未覆写 .cabinet 的 padding");
  assert.ok(pad.includes("env(safe-area-inset-bottom)"), "移动端底部未考虑安全区");
  const safe = Number((pad.match(/max\((\d+)px/) ?? [])[1]);
  assert.ok(safe >= 68, `移动端底部避让只有 ${safe}px，低于 68px 红线`);
});

test("B · 底部仪表条在移动端仍处于文档流（不得 fixed 遮挡）", () => {
  const base = baseCss(css);
  assert.notEqual(declValue(ruleOf(base, ".instrument-bar"), "position"), "fixed");
  assert.notEqual(declValue(ruleOf(base, ".stage"), "position"), "fixed");
});

test("B · 窄屏（360px）下棋盘可用且单元格不至于小到点不中", () => {
  const geo = simulate(css, 360);
  assert.ok(geo.boardWidth > 0, "棋盘宽度算成了非正数");
  assert.ok(geo.cellSize >= 28, `360px 视口下单元格只有 ${geo.cellSize.toFixed(1)}px`);
  assert.ok(geo.contentWidth <= geo.boardWidth, "内容宽超过棋盘外框");
});

test("B · 桌面端棋盘被 max-width 夹住，不会随视口无限拉长", () => {
  const wide = simulate(css, 1440);
  const ultra = simulate(css, 2560);
  assert.ok(wide.boardWidth <= 620, `桌面棋盘 ${wide.boardWidth}px 超出夹持宽度`);
  assert.equal(ultra.boardWidth, wide.boardWidth, "超宽视口下棋盘仍在放大，说明 max-width 没生效");
});

test("B · 棋盘是 8×8 方块：aspect-ratio 与列数必须同时钉住", () => {
  const base = baseCss(css);
  const board = ruleOf(base, ".board");
  assert.ok(/aspect-ratio:\s*1\s*\/\s*1/.test(board) || /aspect-ratio:\s*1\s*;/.test(board), "棋盘缺 aspect-ratio: 1 / 1");
  assert.ok(/repeat\(8,/.test(declValue(board, "grid-template-columns") ?? ""), "棋盘不是 8 列");
  assert.ok(/repeat\(8,/.test(declValue(board, "grid-template-rows") ?? ""), "棋盘不是 8 行");
  assert.equal(simulate(css, 900).columns, 8);
});

test("B · 绝对定位的装饰件都有初始 left/top（否则会被裁剪盒吃掉）", () => {
  const base = baseCss(css);
  // 四条包角共用 .corner 的 position，各自的方位偏移写在变体里 —— 模拟器不做继承，
  // 所以要分别断言"父规则给了绝对定位"与"变体给了两轴偏移"。
  assert.equal(declValue(ruleOf(base, ".corner"), "position"), "absolute", ".corner 不是绝对定位");
  const pairs = [
    [".corner-tl", "left", "top"],
    [".corner-tr", "right", "top"],
    [".corner-bl", "left", "bottom"],
    [".corner-br", "right", "bottom"],
    [".balance-post", "left", "bottom"],
    [".balance-arc", "left", "top"],
    [".beam", "left", "top"],
    [".beam-pivot", "left", "top"],
  ];
  for (const [selector, a, b] of pairs) {
    const decls = ruleOf(base, selector);
    assert.ok(
      declValue(decls, "position") === "absolute" || declValue(ruleOf(base, ".corner"), "position") === "absolute",
      `${selector} 既无绝对定位也不属于 .corner`,
    );
    assert.ok(declValue(decls, a) !== null, `${selector} 缺 ${a}`);
    assert.ok(declValue(decls, b) !== null, `${selector} 缺 ${b}`);
  }
  // 圆片用 inset 贴合格子，同样不能零偏移
  assert.ok(declValue(ruleOf(base, ".disc"), "inset") !== null, ".disc 缺 inset");
});

test("B · 圆片翻面必须有明确的终点姿态（黑 0° / 白 180°）", () => {
  const base = baseCss(css);
  assert.ok(declValue(ruleOf(base, ".disc"), "transform")?.includes("var(--deg"), "圆片未用 --deg 承载翻面角");
  const black = declValue(ruleOf(base, '.cell[data-disc="black"] .disc'), "--deg");
  const white = declValue(ruleOf(base, '.cell[data-disc="white"] .disc'), "--deg");
  assert.equal(black, "0deg");
  assert.equal(white, "180deg");
  assert.ok(/backface-visibility:\s*hidden/.test(ruleOf(base, ".face")), "双面圆片缺 backface-visibility");
});

test("B · prefers-reduced-motion 只去动画，绝不隐藏任何核心件", () => {
  const blocks = mediaBlocks(css, "prefers-reduced-motion");
  assert.ok(blocks.length >= 1, "缺 prefers-reduced-motion 降级");
  for (const block of blocks) {
    assert.ok(!/display\s*:\s*none/.test(block.body), "降级块里出现 display:none —— 玩家会以为功能没了");
    assert.ok(!/visibility\s*:\s*hidden/.test(block.body), "降级块里出现 visibility:hidden");
    // 有动画的核心件必须显式降级：圆片翻转、横梁倾斜、提示脉冲、一次性闪光
    for (const selector of [".disc", ".beam", ".cell", ".beam.is-bump", ".cell.flash-corner"]) {
      assert.ok(block.body.includes(selector), `降级块未覆盖 ${selector}`);
    }
    assert.ok(block.body.includes("transition-duration"), "降级块未压平过渡时长");
    assert.ok(block.body.includes("animation: none"), "降级块未关掉关键帧动画");
  }
});

test("B · 任何媒体查询里都不得隐藏核心交互件", () => {
  const core = [".board", ".cell", ".key", ".seg", ".instrument-bar", ".beam-panel"];
  for (const block of mediaBlocks(css, "")) {
    const rules = block.body.split("}");
    for (const rule of rules) {
      if (!/display\s*:\s*none/.test(rule)) continue;
      for (const selector of core) {
        assert.ok(!rule.includes(selector), `媒体查询 ${block.header} 隐藏了核心件 ${selector}`);
      }
    }
  }
});

test("B · 一次性反馈的末帧回到静止姿态（不得停在中段）", () => {
  const corner = keyframesFrames(keyframesBlock(css, "flashCorner"));
  const trap = keyframesFrames(keyframesBlock(css, "flashTrap"));
  assert.ok(corner.at(-1).decls.includes("0 0 0"), "得角闪光末帧没有回到零柔光");
  assert.ok(trap.at(-1).decls.includes("0 0 0"), "陷阱闪光末帧没有回到零柔光");
  assert.equal(corner.at(-1).at, 100);
  assert.equal(trap.at(-1).at, 100);

  // 横梁抖动结束必须回到当前倾角，否则会姿态跳变
  const bump = keyframesFrames(keyframesBlock(css, "beamBump"));
  assert.ok(bump.at(0).decls.includes("var(--beam-deg"), "横梁抖动首帧未对齐静止倾角");
  assert.ok(bump.at(-1).decls.includes("var(--beam-deg"), "横梁抖动末帧未回到静止倾角");
});

test("B · [hidden] 有强制隐藏守卫（弹层关了不能还挡着画面）", () => {
  const base = baseCss(css);
  assert.ok(base.includes("[hidden]"), "CSS 缺 [hidden] 选择器");
  assert.ok(/display:\s*none\s*!important/.test(ruleOf(base, "[hidden]")), "缺 display: none !important 守卫");
});

test("B · 棋盘与舞台声明 touch-action/overscroll 拦截（防误触与回弹）", () => {
  const base = baseCss(css);
  for (const selector of [".board", ".board-stage"]) {
    const decls = ruleOf(base, selector);
    assert.equal(declValue(decls, "touch-action"), "none", `${selector} 缺 touch-action: none`);
    assert.equal(declValue(decls, "overscroll-behavior"), "none", `${selector} 缺 overscroll-behavior: none`);
  }
});

test("B · 标记一律径向柔光，绝不用描边圈", () => {
  const base = baseCss(css);
  const legal = declValue(ruleOf(base, ".cell.is-legal::after"), "background");
  const threat = declValue(ruleOf(base, ".cell.is-threat::before"), "background");
  const hint = declValue(ruleOf(base, ".cell.is-hint"), "background-image");
  for (const value of [legal, threat, hint]) {
    assert.ok(/radial-gradient/.test(value ?? ""), "标记未使用 radial-gradient 柔光");
  }
  // 合法落点与对手落点分别占用 ::after / ::before，才可能同格共存
  assert.ok(declValue(ruleOf(base, ".cell.is-legal::after"), "background") !== null);
  assert.ok(declValue(ruleOf(base, ".cell.is-threat::before"), "background") !== null);
});

test("B · CSS 全文花括号配对（少一个 } 会静默吞掉后面整块规则）", () => {
  const text = stripComments(css);
  let depth = 0;
  let line = 1;
  for (const ch of text) {
    if (ch === "\n") line += 1;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      assert.ok(depth >= 0, `第 ${line} 行出现多余的 }`);
    }
  }
  assert.equal(depth, 0, "CSS 花括号不配对");
});

test("B · 上下夹持：不存在任何侧栏类名（与 gomoku 的差异化硬约束）", () => {
  const files = readdirSync(gameRoot).filter((name) => name.endsWith(".html") || name.endsWith(".css"));
  const jsDir = resolve(gameRoot, "js");
  for (const extra of readdirSync(jsDir)) {
    if (extra.endsWith(".mjs")) files.push(`js/${extra}`);
  }
  const banned = ["plaque-left", "plaque-right", "side-panel", "side-left", "side-right"];
  for (const rel of files) {
    const text = readFileSync(resolve(gameRoot, rel), "utf8");
    for (const token of banned) {
      assert.ok(!text.includes(token), `${rel} 出现了侧栏类名 ${token}，违反"上下夹持"结构约束`);
    }
  }
});

test("B · pxOf 对 max(68px, calc(...)) 这类嵌套函数能取出首个像素值", () => {
  assert.equal(pxOf("max(68px, calc(16px + env(safe-area-inset-bottom)))"), 68);
  assert.equal(pxOf("14px"), 14);
  assert.equal(pxOf("auto"), null);
});
