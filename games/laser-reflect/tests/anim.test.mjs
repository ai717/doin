// anim.test.mjs：动效契约护栏（style.css 解析断言）。
// headless 浏览器默认 prefers-reduced-motion: reduce，动画路径无法真机断言，
// 按 mole/pacman 视觉回归范式：用 CSS 解析断言钉住关键动效规则。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(gameDir, "css", "style.css"), "utf8");

// 去注释，避免注释里的示例文字干扰匹配
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

// 提取某选择器的规则体（不跨嵌套；本文件无嵌套规则）。
// 选择器与 { 之间允许空白；跳过作为更长选择器一部分的命中（如 .cell .piece.rotatable 里的 .piece.rotatable）。
function ruleBody(selector) {
  let idx = -1;
  while ((idx = stripped.indexOf(selector, idx + 1)) >= 0) {
    // 回溯空白，若前一字符仍是选择器组成字符（如 .cell .piece.rotatable 的前缀），跳过
    let p = idx - 1;
    while (p >= 0 && /\s/.test(stripped[p])) p--;
    if (p >= 0 && /[A-Za-z0-9\-_.#]/.test(stripped[p])) continue;
    let j = idx + selector.length;
    while (j < stripped.length && /\s/.test(stripped[j])) j++;
    if (stripped[j] !== "{") continue;
    let depth = 1;
    let k = j + 1;
    while (k < stripped.length && depth > 0) {
      if (stripped[k] === "{") depth++;
      else if (stripped[k] === "}") depth--;
      k++;
    }
    return stripped.slice(j + 1, k - 1);
  }
  return null;
}

// 提取 @keyframes 块原文
function keyframesBlock(name) {
  const re = new RegExp(`@keyframes\\s+${name}\\s*\\{`);
  const m = re.exec(stripped);
  if (!m) return null;
  const open = stripped.indexOf("{", m.index);
  let depth = 1;
  let i = open + 1;
  while (i < stripped.length && depth > 0) {
    if (stripped[i] === "{") depth++;
    else if (stripped[i] === "}") depth--;
    i++;
  }
  return stripped.slice(open + 1, i - 1);
}

test("镜子旋转：transition 绑定 transform 且有时长", () => {
  const body = ruleBody(".piece.rotatable");
  assert.ok(body, "缺 .piece.rotatable 规则");
  assert.match(body, /transition:\s*transform\s+0\.2\ds/, "旋转 transition 应 ≥0.2s");
  // 旧规则不得残留（避免低特异性覆盖）
  assert.doesNotMatch(stripped, /\.cell \.piece\.rotatable\s*\{[^}]*transition:\s*transform\s+0\.1s/);
});

test("光路层级：SVG 必须压在格子之上", () => {
  const layer = ruleBody(".rays-layer");
  assert.ok(layer, "缺 .rays-layer 规则");
  const z = /z-index:\s*(\d+)/.exec(layer);
  assert.ok(z && Number(z[1]) >= 2, `光路 z-index 应 ≥2（否则被不透明格底吞掉），实际 ${z && z[1]}`);
});

test("光束流入：beam 主/晕层从 dashoffset 1 画到 0", () => {
  for (const cls of [".beam-main", ".beam-glow"]) {
    const body = ruleBody(".rays-layer " + cls);
    assert.ok(body, `缺 .rays-layer ${cls} 规则`);
    assert.match(body, /stroke-dasharray:\s*1/);
    assert.match(body, /stroke-dashoffset:\s*1/);
    assert.match(body, /animation:[^;]*beam-draw/);
  }
  const kf = keyframesBlock("beam-draw");
  assert.ok(kf, "缺 @keyframes beam-draw");
  assert.match(kf, /stroke-dashoffset:\s*0/);
});

test("能量流动：白色亮段沿光路无限循环奔跑", () => {
  const body = ruleBody(".rays-layer .ray-flow");
  assert.ok(body, "缺 .rays-layer .ray-flow 规则");
  assert.match(body, /animation:[^;]*beam-flow[^;]*infinite/);
  const kf = keyframesBlock("beam-flow");
  assert.ok(kf, "缺 @keyframes beam-flow");
  assert.match(kf, /stroke-dashoffset:\s*-\d+/);
});

test("抵达冲击波：光环扩散消散，both 填充保证到达前不可见", () => {
  const body = ruleBody(".rays-layer .ray-impact");
  assert.ok(body, "缺 .rays-layer .ray-impact 规则");
  assert.match(body, /animation:[^;]*ray-impact[^;]*both/);
  const kf = keyframesBlock("ray-impact");
  assert.ok(kf, "缺 @keyframes ray-impact");
  assert.match(kf, /0%\s*\{[^}]*opacity:\s*0/);
  assert.match(kf, /100%\s*\{[^}]*opacity:\s*0/);
});

test("感光核命中：延迟至光抵达才 pop，辉光淡入 forwards", () => {
  const body = ruleBody(".piece-target.hit");
  assert.ok(body, "缺 .piece-target.hit 规则");
  assert.match(body, /target-pop[^;]*0\.4\ds[^;]*backwards/);
  assert.match(body, /target-glow[^;]*forwards/);
  const kf = keyframesBlock("target-pop");
  assert.ok(kf, "缺 @keyframes target-pop");
  assert.match(kf, /35%\s*\{[^}]*scale\(1\.[23]\)/, "35% 帧应有放大");
  assert.match(kf, /100%\s*\{[^}]*scale\(1\)/, "100% 帧应回位");
  assert.match(keyframesBlock("target-glow") ?? "", /drop-shadow/, "缺辉光 keyframes");
});

test("胜利双闪：.board.win 下靶点 pop 播两轮 + 辉光保持", () => {
  const body = ruleBody(".board.win .piece-target.hit");
  assert.ok(body, "缺 .board.win .piece-target.hit 规则");
  assert.match(body, /target-pop[^;}]*\s2\s/, "pop 次数应为 2");
  assert.match(body, /target-glow[^;]*forwards/, "辉光应 forwards 保持");
});

test("感光核充能：内芯熄灭态 → 光抵达后充能点亮 → 常亮呼吸", () => {
  // 熄灭态：内芯不可见
  const off = ruleBody(".piece-target .target-core");
  assert.ok(off, "缺 .piece-target .target-core 熄灭态规则");
  assert.match(off, /opacity:\s*0/, "未点亮内芯必须不可见");
  assert.match(off, /transform:\s*scale\(0\.2\)/, "未点亮内芯应缩成一点");
  // 点亮态：延迟充能 + 无限呼吸（状态持续变化）
  const on = ruleBody(".piece-target.hit .target-core");
  assert.ok(on, "缺 .piece-target.hit .target-core 点亮态规则");
  assert.match(on, /target-charge[^;]*0\.4\ds[^;]*forwards/, "内芯充能应延迟到光抵达且 forwards 保持");
  assert.match(on, /target-breathe[^;]*infinite/, "点亮后应有常亮呼吸脉动");
  const kf = keyframesBlock("target-charge");
  assert.ok(kf, "缺 @keyframes target-charge");
  assert.match(kf, /0%\s*\{[^}]*opacity:\s*0/, "充能应从熄灭开始");
  assert.match(kf, /55%\s*\{[^}]*scale\(1\.3/, "充能中段应过冲放大");
  assert.match(kf, /100%\s*\{[^}]*opacity:\s*1/, "充能结束必须常亮");
  assert.match(keyframesBlock("target-breathe") ?? "", /drop-shadow/, "呼吸应动辉光强弱");
});

test("结算条非遮挡：无全屏遮罩、无模糊、条外可点", () => {
  const layer = ruleBody(".result-layer");
  assert.ok(layer, "缺 .result-layer 规则");
  assert.match(layer, /pointer-events:\s*none/, "结算层自身必须 pointer-events:none");
  assert.doesNotMatch(layer, /backdrop-filter/, "结算层禁止 backdrop 模糊遮罩");
  assert.doesNotMatch(layer, /background:\s*rgba\(\s*5,\s*8,\s*20/, "结算层禁止全屏暗遮罩");
  assert.match(layer, /position:\s*fixed/);
  const card = ruleBody(".result-card");
  assert.ok(card, "缺 .result-card 规则");
  assert.match(card, /pointer-events:\s*auto/, "卡片本身必须可点");
  assert.match(card, /animation:[^;]*banner-rise/, "结算条应有入场动画");
  // help 层保留模态遮罩
  const help = ruleBody(".help-layer");
  assert.ok(help, "缺 .help-layer 规则");
  assert.match(help, /backdrop-filter/, "help 层应保留遮罩模糊");
});

test("reduced-motion 降级：光路完整显示、装饰动效隐藏、辉光静态保留", () => {
  const m = stripped.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/);
  assert.ok(m, "缺 reduced-motion 媒体查询");
  const open = stripped.indexOf("{", m.index);
  let depth = 1;
  let i = open + 1;
  while (i < stripped.length && depth > 0) {
    if (stripped[i] === "{") depth++;
    else if (stripped[i] === "}") depth--;
    i++;
  }
  const block = stripped.slice(open + 1, i - 1);
  assert.match(block, /\.beam-main[^{]*\{[^}]*animation:\s*none/, "光束动画应关闭");
  assert.match(block, /\.beam-main[^{]*\{[^}]*stroke-dashoffset:\s*0/, "降级后光路必须完整显示（offset 0）");
  assert.match(block, /\.ray-flow[^{]*\{[^}]*animation:\s*none/, "流动亮段应关闭");
  assert.match(block, /\.ray-impact[^{]*\{[^}]*animation:\s*none/, "冲击波应关闭");
  assert.match(block, /\.piece\.rotatable\s*\{[^}]*transition:\s*none/, "旋转 transition 应关闭");
  assert.match(block, /\.piece-target\.hit[\s\S]*?animation:\s*none/, "靶点 pop 应关闭");
  assert.match(block, /\.piece-target\.hit[\s\S]*?drop-shadow/, "降级下静态辉光应保留");
  assert.match(block, /\.piece-target\.hit \.target-core\s*\{[^}]*animation:\s*none/, "内芯充能应关闭");
  assert.match(block, /\.piece-target\.hit \.target-core\s*\{[^}]*opacity:\s*1/, "降级下已点亮内芯必须静态常亮");
  assert.match(block, /\.result-card\s*\{[^}]*animation:\s*none/, "结算条入场动画应关闭");
});
