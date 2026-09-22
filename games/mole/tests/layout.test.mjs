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

/** 去掉 /* … *\/ 注释，避免注释里提到的旧写法被误判成实际代码 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * 取出指定 @media 条件的完整规则体（按花括号深度配对）。
 * 朴素的 indexOf("}") 会在嵌套规则的第一层就截断，
 * 把后面无关媒体查询的内容也吃进来 —— 这就是之前误报的原因。
 */
function mediaBlocks(text, condition) {
  const out = [];
  const re = new RegExp(`@media\\s*\\(?[^{]*${escapeRe(condition)}[^{]*\\{`, "g");
  for (let m; (m = re.exec(text)); ) {
    let i = m.index + m[0].length;
    let depth = 1;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
    out.push(text.slice(start, i - 1));
  }
  return out;
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
  assert.equal(pct(clip, "height"), 0.73, "活动区高度应使上沿正好落在洞位顶端（27+73=100）");
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
  assert.match(rule('.hole[data-phase="up"] .mole'),
    /transform:\s*translate\(-50%,\s*0\)/, "冒出态应回到 translate(-50%, 0)");
});

test("CSS: 冒头是一段可见动画，不是瞬移（bob 不得在 rise 阶段抢跑）", () => {
  const rise = rule('.hole[data-phase="rise"] .mole');
  // 必须用 animation：同时要跑挤压拉伸，且 animation 优先级高于 transition
  assert.match(rise, /animation:\s*mole-rise/, "rise 应绑定 mole-rise 动画");
  assert.match(css, /@keyframes\s+mole-rise/, "缺少 @keyframes mole-rise");
  // 关键回归：rise 规则里绝不能出现 mole-bob —— 一旦共用，bob 会立刻覆盖
  // transform，把整段冒头过程吃掉，表现就是"地鼠突然出现"。
  assert.ok(!/mole-bob/.test(rise),
    "rise 规则不得包含 mole-bob（会覆盖 transform 导致瞬移）");
  const up = rule('.hole[data-phase="up"] .mole');
  assert.match(up, /mole-bob/, "bob 应只在 up 阶段跑");
});

test("CSS: 冒头关键帧是一段真实的爬升过程", () => {
  // 关键：必须把切片夹在 mole-rise 的花括号块内。
  // 只 indexOf("@keyframes mole-rise") 会让正则一路吃到后面的 mole-bob，
  // 末帧就变成了 bob 的 0% { translate(-50%, -50%) } —— 会得到假的失败。
  const kfStart = css.indexOf("@keyframes mole-rise");
  assert.ok(kfStart >= 0, "缺少 @keyframes mole-rise");
  const block = css.slice(kfStart);
  // @keyframes 内部还有每帧自己的花括号，必须按深度配对取完整块，
  // 否则会在第一帧的 `}` 就截断，只剩 1 个关键帧。
  const open = block.indexOf("{");
  let i = open + 1;
  let depth = 1;
  while (i < block.length && depth > 0) {
    if (block[i] === "{") depth++;
    else if (block[i] === "}") depth--;
    i++;
  }
  const stop = block.slice(open + 1, i - 1);
  assert.ok(stop.includes("100%"), `mole-rise 块内应含 100% 帧（实际切片：${stop.slice(0, 60)}）`);
  // 注意 100% 帧写成 `translate(-50%, 0)`（不带 %），正则要容忍
  const stops = [...stop.matchAll(/([\d.]+)%\s*\{[^}]*translate\(-50%,\s*(-?[\d.]+)%?\)/g)]
    .map((m) => ({ at: Number(m[1]), y: Number(m[2]) }));
  assert.ok(stops.length >= 3, `mole-rise 至少需要 3 个关键帧，实际 ${stops.length}`);
  assert.ok(stops[0].y > 50, `首帧应还在洞里（y=${stops[0].y}%）`);
  const last = stops[stops.length - 1];
  assert.equal(last.at, 100, "末帧应在 100%");
  assert.equal(last.y, 0, "末帧应回到 0");
  assert.ok(stops.some((s) => s.y < -1), "中途应有轻微过冲，否则没有弹跳感");
  // 至少一帧带 scale，构成挤压拉伸
  assert.match(stop, /scale\(/);

  // ★ 关键回归：位移必须均匀铺满整段时长，不能"前腔被抽空"。
  // 曾经 45% 处就已经跑到 26%（越过了地平线 0 以上），前段占比过大 ——
  // 配合 cubic-bezier(.3,1,.5,1) 的缓动，55% 的位移挤在头 20% 时间里，
  // 观感就是"啪一下弹出来然后僵住"。这里直接约束分布：
  //   · 半程（50%）时位移不应超过全程的 70%（留出可见的后半段）
  //   · 25% 时不应超过 45%（头段别抢跑）
  const pctAt = (frac) => {
    // 在关键帧之间线性插值求进度（简化：只用于分布断言，不求精确缓动）
    const target = frac * 100;
    let a = stops[0];
    let b = last;
    for (let k = 0; k < stops.length - 1; k += 1) {
      if (stops[k].at <= target && stops[k + 1].at >= target) {
        [a, b] = [stops[k], stops[k + 1]];
        break;
      }
    }
    const span = b.at - a.at || 1;
    const r = (target - a.at) / span;
    return a.y + (b.y - a.y) * r;
  };
  // y 从 100 走到 0，进度 = (100 - y) / 100
  const prog50 = (100 - pctAt(0.5)) / 100;
  const prog25 = (100 - pctAt(0.25)) / 100;
  assert.ok(prog50 <= 0.72,
    `半程时就已完成 ${(prog50 * 100).toFixed(0)}% 的位移，后段会显得僵住（应 ≤72%）`);
  assert.ok(prog25 <= 0.46,
    `25% 时就已完成 ${(prog25 * 100).toFixed(0)}% 的位移，头段抢跑太狠（应 ≤46%）`);
});

test("CSS 冒头的缓动不能抢跑（禁止前腔被抽空的贝塞尔）", () => {
  // cubic-bezier(.3,1,.5,1) 这类曲线：20% 时间就吃掉 55% 位移 → 看上去是瞬移。
  // 判据是"曲线在头段是否过陡"，而不是简单看某个参数大小：
  //   y1 接近 1 = 起手就是最高速（抢跑），这才是元凶；
  //   y2=1 只是"末段平缓收尾"，本身没问题，不该被禁。
  const rise = rule('.hole[data-phase="rise"] .mole');
  const bez = rise.match(/cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  assert.ok(bez, "rise 应显式声明缓动曲线");
  const [x1, y1, x2, y2] = bez.slice(1, 5).map(Number);
  assert.ok(y1 <= 0.8, `缓动 y1=${y1} 太靠前，起手即最高速会抢跑（应 ≤0.8）`);
  // 用真实贝塞尔求值确认：一半时间内的位移不超过 75%
  const evalBez = (t, p1, p2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * p1, by = 3 * (p2 - p1) - cy, ay = 1 - cy - by;
    const sx = (u) => ((ax * u + bx) * u + cx) * u;
    const sy = (u) => ((ay * u + by) * u + cy) * u;
    let u = t;
    for (let k = 0; k < 40; k += 1) {
      const e = sx(u) - t;
      const d = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(e) < 1e-7 || Math.abs(d) < 1e-7) break;
      u -= e / d;
    }
    return sy(u);
  };
  const half = evalBez(0.5, y1, y2);
  assert.ok(half <= 0.78, `一半时间就跑了 ${(half * 100).toFixed(0)}% 的位移，后段会僵住（应 ≤78%）`);
  const quarter = evalBez(0.25, y1, y2);
  assert.ok(quarter <= 0.5, `25% 时间跑了 ${(quarter * 100).toFixed(0)}% 的位移，抢跑过狠（应 ≤50%）`);
});

test("CSS 时长与 engine 的 RISE_MS / DUCK_MS 一致", async () => {
  const { RISE_MS, DUCK_MS, DUCK_RANGE_MS } = await import("../js/engine.mjs");
  const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
  const rise = root.match(/--rise-ms:\s*(\d+)ms/);
  const duck = root.match(/--duck-ms:\s*(\d+)ms/);
  assert.ok(rise, ":root 缺少 --rise-ms");
  assert.ok(duck, ":root 缺少 --duck-ms");
  assert.equal(Number(rise[1]), RISE_MS, `--rise-ms 应等于 engine.RISE_MS(${RISE_MS})`);
  // --duck-ms 现在是兜底值：正常游玩时每只鼠的随机 duckMs 会内联覆盖它
  assert.equal(Number(duck[1]), DUCK_MS, `--duck-ms 兜底值应等于 engine.DUCK_MS(${DUCK_MS})`);
  // 兜底值必须落在随机区间内，否则"没拿到内联值"时观感会跳脱
  assert.ok(DUCK_MS >= DUCK_RANGE_MS[0] && DUCK_MS <= DUCK_RANGE_MS[1],
    `DUCK_MS(${DUCK_MS}) 应落在 DUCK_RANGE_MS 区间内`);
  // 冒头时长必须够长，肉眼才看得出过程
  assert.ok(RISE_MS >= 180, `RISE_MS=${RISE_MS} 太短，冒头会像瞬移`);
});

test("CSS: 木槌默认可见（不得再用 hover/pointer 媒体查询才显示）", () => {
  assert.match(rule(".hammer"), /opacity:\s*1/, "木槌应默认可见");
  // .garden 有多条规则，不能只查第一条
  assert.match(css, /\.garden\s*\{[^}]*cursor:\s*none/, "默认应由木槌接管光标");
  // 曾经过度收紧成 (hover:hover) and (pointer:fine) 才显示，触屏笔记本上直接消失。
  // 注意：只允许出现在注释里，不允许出现在实际选择器/媒体查询中。
  const code = stripComments(css);
  assert.ok(!/\(hover:\s*hover\)\s+and\s+\(pointer:\s*fine\)/.test(code),
    "不得再用 (hover:hover) and (pointer:fine) 门槛，触屏笔记本会匹配不上");
  // 纯触屏才隐藏
  const coarse = code.match(/@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)/);
  assert.ok(coarse, "缺少纯触屏设备的隐藏规则");
  // 窄窗口（≤768px）不得隐藏木槌 —— 桌面浏览器缩窄后指针仍是鼠标。
  // 必须按花括号深度切片，否则会误取到后面 prefers-reduced-motion 块里的规则。
  for (const body of mediaBlocks(code, "max-width: 768px")) {
    assert.ok(!/\.hammer\s*\{[^}]*display:\s*none/.test(body),
      "max-width:768px 内不得隐藏 .hammer（桌面窄窗口会失去木槌）");
  }
});

test("CSS: 地鼠有完整的形象构件（耳/爪/肚皮/牙/高光）", () => {
  for (const sel of [".mole-ear", ".mole-paw", ".mole-belly", ".mole-eye-glint", ".mole-blush"]) {
    assert.ok(new RegExp(`\\${sel}\\s*\\{`).test(css), `缺少构件样式 ${sel}`);
  }
  // 门牙是独立伪元素规则，不能拿 .mole-snout 的规则体去找 ::after
  assert.ok(/\.mole-snout::after\s*\{/.test(css), "吻部应有门牙（独立 ::after 规则）");
  assert.ok(/\.mole-snout::before\s*\{/.test(css), "吻部应有鼻子（独立 ::before 规则）");
  // 鼠种只改毛色变量，构件自动跟随
  assert.match(css, /--fur-1:/, "应使用毛色变量 --fur-1");
  assert.match(css, /--fur-2:/, "应使用毛色变量 --fur-2");
  assert.match(css, /--fur-3:/, "应使用毛色变量 --fur-3");
  for (const sp of ["gold", "bomb"]) {
    assert.ok(new RegExp(`\\.hole\\[data-species="${sp}"\\]\\s+\\.mole\\s*\\{[^}]*--fur-1`).test(css),
      `${sp} 鼠应通过毛色变量换色`);
  }
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

test("CSS: 活动区裁剪盒不越出洞位顶边（否则会把地鼠的头削平）", () => {
  // bottom + height <= 100%  ⇔  裁剪盒上沿不高于洞位顶端。
  // 曾经写成 bottom 27% / height 78%（合计 105%），上沿越出洞位，
  // 冒出就位的地鼠头顶被 overflow:hidden 削成一条平线。
  const clip = rule(".mole-clip");
  const bottom = pct(clip, "bottom");
  const height = pct(clip, "height");
  assert.ok(bottom + height <= 1 + 1e-6,
    `bottom(${bottom * 100}%) + height(${height * 100}%) = ${(bottom + height) * 100}% 超过 100%，会削掉地鼠的头`);
  assert.ok(height >= 0.6, `活动区高度 ${height * 100}% 太矮，地鼠藏不住`);
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
