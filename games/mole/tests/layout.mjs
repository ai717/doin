// layout.mjs — 纯函数布局模拟器：把 CSS 的几何契约在 Node 里实算一遍。
//
// 为什么必须存在：DOM 桩无法计算真实盒模型，任何"视觉是否正确"的断言在桩里
// 都会退化成"读常量"。本模块只吃数字（视口宽、网格行列、以及从 CSS 抽出的
// 百分比规则），复刻浏览器 layout 的运算顺序：
//   1) 百分比高度靠父级定高解析（宽高比容器 → 洞位高度）
//   2) transform 的 translateY 百分比取元素自身"变换前"边框盒尺寸
//   3) overflow 裁剪区 = 裁剪容器自身的 padding box
// 不再依赖浏览器即可断言"地鼠冒出多少、看到多少、洞在哪里"。
//
// ── 坑的形状约定（一次真实 UI 事故换来的结论，勿改回）────────────────
// 经典打地鼠的正确模型不是"地鼠在洞里上下滑动"，而是：
//   · 洞口是地面上**永远可见的深色椭圆**；
//   · 地鼠的活动区底边压在**地平线**（洞口椭圆的垂直中心）上，向上生长；
//   · 隐藏态 = 整只沉到地平线以下，被 overflow 裁掉（洞里只剩黑坑）；
//   · 冒出态 = 地鼠从地平线升起，顺带遮住洞口椭圆的**后半圈** —— 这正是
//     "从洞里钻出来"的视觉来源。
// 两个踩过的坑，别再犯：
//   (a) 把地鼠塞进洞口椭圆里裁剪（overflow 只有 88px 高，装不下 128px 的地鼠，
//       结果整只鼠被削成只剩一个头）；
//   (b) 洞口用 radial mask 做椭圆收窄 —— 数学上等价于要求地鼠变成"矮团子 +
//       超宽头"才能在冒头时全宽可见，站着的地鼠必被削头。
// layout.test.mjs 会把这两条钉死。
// ────────────────────────────────────────────────────────────────

/** 视口 → 中央舞台宽度（对应 style.css 的媒体查询与 max-width） */
export function stageWidthFor(viewportWidth) {
  const appPad = viewportWidth <= 768 ? 10 : viewportWidth <= 900 ? 22 : 28;
  const appInner = Math.min(viewportWidth, 1240) - appPad * 2;

  // .cabinet-body：>900px 三栏；<=900px 单栏
  let bodyInner;
  if (viewportWidth <= 900) {
    bodyInner = appInner;
  } else {
    const side = 190; // minmax(150px,190px) 在 1160 内容宽下取上限
    const gap = viewportWidth <= 1000 ? 12 : 18;
    bodyInner = Math.min(appInner, 1160) - side * 2 - gap * 2;
  }

  const gardenMax = viewportWidth <= 768 ? 560 : 720;
  const gardenBorder = viewportWidth <= 768 ? 5 : 6;
  const gardenWidth = Math.min(bodyInner, gardenMax);
  return { gardenWidth, gardenBorder, appInner, bodyInner };
}

/** 单个洞位的像素字面量（百分比相对洞位盒，或相对地鼠活动区盒） */
export function holeMetrics(viewportWidth, rows, cols) {
  const { gardenWidth, gardenBorder } = stageWidthFor(viewportWidth);
  const gardenPad = viewportWidth <= 900 ? (viewportWidth <= 420 ? 12 : 16) : 22;
  const gap = viewportWidth <= 1000 ? 9 : 16;

  const gridWidth = gardenWidth - gardenBorder * 2 - gardenPad * 2;
  const holeWidth = (gridWidth - gap * (cols - 1)) / cols;
  const ratio = viewportWidth <= 768 ? 1 : 0.94; // .hole aspect-ratio
  const holeHeight = holeWidth / ratio;

  // .hole-pit：top 46% / bottom 0（地面上永远可见的深色椭圆洞口）
  const pitX = holeWidth * 0.03;
  const pitWidth = holeWidth * 0.94;
  const pitTop = holeHeight * 0.46;
  const pitBottom = holeHeight;
  const pitHeight = pitBottom - pitTop;

  // 地平线 = 洞口椭圆垂直中心
  const groundLine = (pitTop + pitBottom) / 2;

  // .mole-clip：bottom 27% / height 73%（底边压地平线，向上生长）
  // 27 + 73 = 100，即裁剪盒上沿正好落在洞位顶端 —— 不可再高，
  // 否则上沿越出洞位会把站直的地鼠头削平。
  const clipBottomOffset = holeHeight * 0.27;
  const clipBottom = holeHeight - clipBottomOffset;
  const clipHeight = holeHeight * 0.73;
  const clipTop = clipBottom - clipHeight;

  // .mole：width 66% of clip(=62% holeW) / height 100% of clip
  const moleWidth = pitWidth * 0.66;
  const moleHeight = clipHeight;

  return {
    holeWidth, holeHeight, ratio,
    pitX, pitWidth, pitTop, pitBottom, pitHeight, groundLine,
    clipTop, clipBottom, clipHeight,
    moleWidth, moleHeight,
    gardenWidth, gardenBorder, gardenPad, gap, gridWidth,
  };
}

/**
 * 某 phase 下地鼠的几何（y 相对洞位顶边）。
 * hidden = translateY(100%)，up = translateY(0)。
 */
export function moleGeometry(viewportWidth, rows, cols, phase) {
  const m = holeMetrics(viewportWidth, rows, cols);
  const pct = phase === "rise" || phase === "up" ? 0 : 1;
  const dy = m.moleHeight * pct;
  const moleTop = m.clipBottom - m.moleHeight + dy; // bottom:0 时底边贴 clip 底边
  const moleBottom = moleTop + m.moleHeight;

  // 裁剪区 = clip 盒；与 clip 相交的部分才可见
  const visTop = Math.max(moleTop, m.clipTop);
  const visBottom = Math.min(moleBottom, m.clipBottom);
  const visible = Math.max(0, visBottom - visTop);

  // 与洞口椭圆相交：冒出时地鼠应遮住椭圆后半圈
  const pitOverlap = Math.max(0, Math.min(moleBottom, m.pitBottom) - Math.max(moleTop, m.pitTop));

  return { ...m, dy, moleTop, moleBottom, visible, pitOverlap, phase };
}

/** 地平线与洞口椭圆中心是否重合（几何自洽性检查） */
export function groundLineMatchesPitCenter(m) {
  return Math.abs(m.groundLine - (m.pitTop + m.pitBottom) / 2) < 0.01;
}
