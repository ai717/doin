// 布局模拟器：把 CSS 当数据读，算出真实几何量。
//
// 为什么需要它（项目铁律，见 AGENTS.md 的"视觉回归铁律"）：
//   · DOM 桩的 getBoundingClientRect 恒返零矩形、getComputedStyle 是空壳，
//     任何"视觉对不对"的断言在桩里都会退化成"读常量"。
//   · 因此视觉契约必须另建护栏：这里手工复刻 aspect-ratio 定高 → 百分比定位 → 裁剪盒，
//     让"棋盘会不会溢出视口""底部避让够不够 68px"这类问题变成可实算的断言。
//
// 本文件只做解析与算术，不做断言（断言在 layout.test.mjs）。

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// 深度配对地截出所有 @media 块。朴素 indexOf("}") 会在嵌套规则第一层就截断，
// 把后面的无关规则一起吃进来 —— 那是本项目踩过的坑。
export function mediaBlocks(css, condition) {
  const text = stripComments(css);
  const blocks = [];
  const re = /@media([^{]*)\{/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const header = match[1].trim();
    const start = match.index + match[0].length;
    const body = sliceBlock(text, start);
    if (!condition || header.includes(condition)) blocks.push({ header, body });
  }
  return blocks;
}

// 返回从 openIndex 起、与最近的 "{" 配对的块内容（不含首尾花括号）。
export function sliceBlock(text, openIndex) {
  let depth = 1;
  let i = openIndex;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex, i);
    }
    i += 1;
  }
  return text.slice(openIndex);
}

// 去掉所有 at-rule 块（@media / @keyframes / @supports），留下基础层。
export function baseCss(css) {
  const text = stripComments(css);
  let out = "";
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf("@", i);
    if (at < 0) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, at);
    const brace = text.indexOf("{", at);
    if (brace < 0) break;
    const header = text.slice(at, brace);
    const body = sliceBlock(text, brace + 1);
    if (header.includes("keyframes") || header.includes("@media") || header.includes("@supports")) {
      out += " ";
    } else {
      out += header + "{" + body + "}";
    }
    i = brace + 1 + body.length + 1;
  }
  return out;
}

// 取某个选择器在给定 CSS 文本里的全部声明（支持逗号选择器组；只认最末一级选择器）。
export function ruleOf(cssText, selector) {
  const text = stripComments(cssText);
  const wanted = selector.trim();
  let decls = "";
  let i = 0;
  while (i < text.length) {
    const brace = text.indexOf("{", i);
    if (brace < 0) break;
    const prelude = text.slice(i, brace).trim();
    const body = sliceBlock(text, brace + 1);
    const parts = prelude.split(",").map((part) => part.trim());
    if (parts.includes(wanted)) decls += `;${body}`;
    i = brace + 1 + body.length + 1;
  }
  return decls;
}

export function keyframesBlock(css, name) {
  const text = stripComments(css);
  const at = text.indexOf("@keyframes " + name);
  if (at < 0) return null;
  const brace = text.indexOf("{", at);
  if (brace < 0) return null;
  return `{${sliceBlock(text, brace + 1)}}`;
}

// keyframesBlock 返回的是整段原文（含花括号），不是帧数组 —— 必须显式拆帧。
export function keyframesFrames(block) {
  if (!block) return [];
  return [...block.matchAll(/([\d.]+)%\s*\{([^}]*)\}/g)].map((match) => ({
    at: Number(match[1]),
    decls: match[2],
  }));
}

export function declValue(decls, prop) {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:([^;}]*)`, "i");
  const match = decls.match(re);
  return match ? match[1].trim() : null;
}

export function pxOf(value) {
  if (value == null) return null;
  const match = String(value).match(/(-?[\d.]+)px/);
  return match ? Number(match[1]) : null;
}

// 三次贝塞尔求值：给 x 求 y。手写牛顿迭代即可（浏览器也是这么干的）。
export function bezierY(curve, x) {
  const [x1, y1, x2, y2] = curve;
  const cx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const cy = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  let t = x;
  for (let i = 0; i < 24; i += 1) {
    const err = cx(t) - x;
    if (Math.abs(err) < 1e-6) break;
    const slope = (cx(t + 1e-4) - cx(t - 1e-4)) / 2e-4;
    if (Math.abs(slope) < 1e-9) break;
    t = Math.min(1, Math.max(0, t - err / slope));
  }
  return cy(t);
}

export function parseCubicBezier(text) {
  const match = String(text ?? "").match(/cubic-bezier\(([^)]+)\)/);
  if (!match) return null;
  const nums = match[1].split(",").map((value) => Number(value.trim()));
  return nums.length === 4 && nums.every(Number.isFinite) ? nums : null;
}

// 上下夹持的几何复刻：视口宽 → 棋盘边长 → 单元格边长。
// 层叠顺序：基础层 → 命中的媒体查询层（后者覆盖前者）。
export function simulate(css, viewportWidth) {
  const layers = [baseCss(css)];
  if (viewportWidth <= 768) layers.push(...mediaBlocks(css, "max-width: 768px").map((b) => b.body));
  else if (viewportWidth >= 900) layers.push(...mediaBlocks(css, "min-width: 900px").map((b) => b.body));

  const pick = (selector, prop, fallback) => {
    let value = fallback;
    for (const layer of layers) {
      const found = declValue(ruleOf(layer, selector), prop);
      if (found != null) value = found;
    }
    return value;
  };

  const cabinetMax = pxOf(pick(".cabinet", "max-width", "760px")) ?? 760;
  const cabinetPad = pick(".cabinet", "padding", "10px 12px 36px");
  const frameMax = pxOf(pick(".board-frame", "max-width", "560px")) ?? 560;
  const framePad = pxOf(pick(".board-frame", "padding", "14px")) ?? 14;
  const boardPad = pxOf(pick(".board", "padding", "6px")) ?? 6;
  const gap = pxOf(pick(".board", "gap", "2px")) ?? 2;
  const tpl = pick(".board", "grid-template-columns", null) ?? "repeat(8, 1fr)";
  const columns = Number((tpl.match(/repeat\((\d+)/) ?? [null, "8"])[1]);

  const outer = Math.min(viewportWidth, cabinetMax) - 2 * (pxOf(cabinetPad.split(/\s+/)[1] ?? cabinetPad) ?? 12);
  const frameWidth = Math.min(outer, frameMax);
  const boardWidth = frameWidth - 2 * framePad;
  const contentWidth = boardWidth - 2 * boardPad;
  const cellSize = (contentWidth - (columns - 1) * gap) / columns;

  return {
    viewportWidth,
    cabinetMax,
    cabinetPadBottom: pxOf(cabinetPad.split(/\s+/)[2] ?? "0") ?? null,
    frameWidth,
    boardWidth,
    contentWidth,
    columns,
    gap,
    cellSize,
    overflow: outer > cabinetMax ? "clamped" : "fit",
  };
}
