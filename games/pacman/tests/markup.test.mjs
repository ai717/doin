// markup.test.mjs —— 页面契约验收：门户铁律（返回链接 / noscript / ?v=dev / 零外链）+ 静态文本全量 i18n 覆盖。
//
// 坑（照抄前务必看）：
//   1) "中文必须带 data-i18n" 这条最容易漏：新增一行中文而忘了挂键，英文站就会漏出汉字。
//      这里用「标签属性 + 文本」配对扫描，比全文搜汉字精确得多。
//   2) title / meta 的中文是特例：它们由 JS 在切语言时改，不挂 data-i18n。
//   3) 零外链要区分「资源引用」与「首页链接」：href="/" 是门户返回，不算外链。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { strings, LOCALES } from "../js/i18n.mjs";
import { SPEED_TIER_IDS } from "../js/storage.mjs";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const CSS = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
const CJK = /[㐀-䶿一-鿿豈-﫿]/;

/** 剥掉注释，避免注释里的示例文本触发误报 */
const BODY = HTML.replace(/<!--[\s\S]*?-->/g, "");

test("门户铁律：返回首页链接、noscript、?v=dev 缓存占位", () => {
  assert.match(BODY, /<a[^>]+id="back-home"[^>]+href="\/"/, "必须有 id=back-home 且指向 / 的返回链接");
  assert.match(BODY, /<noscript>/, "必须有 noscript 提示");
  assert.match(BODY, /href="css\/style\.css\?v=dev"/, "样式必须带 ?v=dev 且用相对路径");
  assert.match(BODY, /src="js\/main\.mjs\?v=dev"/, "入口脚本必须带 ?v=dev 且用相对路径");
  assert.doesNotMatch(BODY, /href="https?:\/\//, "不得引用任何外链资源（零 CDN / 零 webfont）");
  assert.doesNotMatch(BODY, /src="https?:\/\//, "不得引用任何外链脚本");
  assert.doesNotMatch(CSS, /@import|url\(\s*['"]?https?:/, "CSS 里不得出现外链资源");
});

test("页面里每个 data-i18n* 键都能在两份表里查到", () => {
  const hits = [...BODY.matchAll(/data-i18n(-title|-aria)?="([^"]+)"/g)].map((m) => m[2]);
  assert.ok(hits.length >= 40, `页面挂的翻译键太少（${hits.length}），像是正则没扫到`);
  for (const locale of LOCALES) {
    const dict = strings(locale);
    for (const k of new Set(hits)) {
      assert.ok(k in dict, `${locale} 表缺页面引用的键：${k}`);
    }
  }
});

test("静态中文必须全量挂 data-i18n（防英文站漏汉字）", () => {
  const leaks = [];
  for (const m of BODY.matchAll(/<([a-zA-Z][\w-]*)\s*([^>]*)>([^<]*)</g)) {
    const tag = m[1];
    if (["title", "meta", "script", "style"].includes(tag)) continue;
    const text = m[3];
    if (!text || !CJK.test(text)) continue;
    if (/data-i18n="/.test(m[2])) continue;
    leaks.push(`<${tag}> ${text.trim().slice(0, 30)}`);
  }
  assert.deepEqual(leaks, [], `以下静态中文没有挂 data-i18n：${leaks.join(" | ")}`);
});

test("玩法说明的序号归 <ol> 管，文案里不许再手写（否则渲染成「1. 1.」）", () => {
  assert.match(BODY, /<ol class="help-list">/, "玩法说明必须是 ol，序号由列表本身给");
  for (const loc of LOCALES) {
    const t = strings(loc);
    for (let i = 1; i <= 8; i += 1) {
      assert.ok(t[`help${i}`], `${loc} 缺 help${i}`);
      assert.doesNotMatch(t[`help${i}`], /^\s*\d+\s*[.、)]\s*/, `${loc}.help${i} 开头带了手写序号，会和 ol 的标记叠成「1. 1.」`);
    }
  }
});

test("关键交互件齐备：拨盘、节拍轨、计分窗、CREDIT 灯、弹层", () => {
  for (const id of [
    "stage",
    "btn-start",
    "btn-pause",
    "btn-sound",
    "btn-lang",
    "btn-help",
    "score-val",
    "best-val",
    "level-val",
    "beat",
    "beat-name",
    "beat-fill",
    "beat-left",
    "credit-lamps",
    "pad",
    "mode-row",
    "level-grid",
    "setpiece-grid",
    "star-row",
    "ov-ready",
    "ov-pause",
    "ov-result",
    "ov-levels",
    "ov-setpieces",
    "ov-help",
    "ov-settings",
  ]) {
    assert.match(BODY, new RegExp(`id="${id}"`), `页面缺少 #${id}`);
  }
  for (const dir of ["0", "1", "2", "3"]) {
    assert.match(BODY, new RegExp(`data-dir="${dir}"`), `拨盘缺少方向 ${dir}`);
  }
});

test("弹性与降级：canvas 禁手势滚动、底部留广告避让、reduced-motion 只去动画", () => {
  assert.match(CSS, /touch-action:\s*none/, "画布必须禁掉浏览器手势，否则拖动会滚页面");
  assert.match(CSS, /overscroll-behavior:\s*none/);
  assert.match(CSS, /env\(safe-area-inset-bottom\)/, "移动端底部必须预留安全区");
  assert.match(CSS, /prefers-reduced-motion/);
  // 降级里出现 display:none 会把核心交互件变没，用户会以为功能坏了
  const rm = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion"));
  assert.doesNotMatch(rm, /display:\s*none/, "reduced-motion 里禁止隐藏任何元素");
  assert.match(CSS, /aspect-ratio:\s*28\s*\/\s*31/, "招牌框必须按迷宫比例定高");
});

test("拨盘可见性铁律：默认可见，只有精细指针才隐藏（触屏笔记本两不沾时不许消失）", () => {
  // 踩过的坑：CSS 里把可见性写成 (hover:hover) and (pointer:fine) 才显示，
  // 触屏笔记本（主指针 fine 但支持触摸）与外接鼠标的平板会「两不沾」，拨盘凭空消失。
  // 正解：基础规则就是可见，隐藏只挂在指针条件上。
  const base = CSS.match(/\.pad\s*\{([^}]*)\}/);
  assert.ok(base, "样式里必须有 .pad 基础规则");
  assert.match(base[1], /display:\s*grid/, ".pad 必须默认可见，不能只在某个媒体查询里才显示");

  const medias = [...CSS.matchAll(/@media([^{]*)\{/g)].map((m) => ({ at: m.index, cond: m[1] }));
  const hides = [];
  for (const m of CSS.matchAll(/\.pad\s*\{([^}]*)\}/g)) {
    if (!/display:\s*none/.test(m[1])) continue;
    const enclosing = medias.filter((x) => x.at < m.index).pop();
    hides.push(enclosing ? enclosing.cond.trim() : "<top-level>");
  }
  assert.equal(hides.length, 1, `只允许一条隐藏 .pad 的规则，实际 ${hides.length} 条：${hides.join(" / ")}`);
  assert.match(hides[0], /pointer:\s*fine/, "隐藏条件必须挂在 pointer:fine 上，绝不能拿 coarse 去隐藏拨盘");
});

test("严禁四角散落浮空按钮与右侧表单堆：控制项都在铭牌条或控制台内", () => {
  const plate = BODY.slice(BODY.indexOf('class="nameplate"'), BODY.indexOf("</header>"));
  for (const id of ["btn-sound", "btn-lang", "btn-help"]) {
    assert.ok(plate.includes(`id="${id}"`), `${id} 必须熔铸在铭牌条里，不许浮空四散`);
  }
  const console_ = BODY.slice(BODY.indexOf('class="console"'));
  for (const id of ["btn-start-2", "btn-pause", "pad"]) {
    assert.ok(console_.includes(`id="${id}"`), `${id} 必须在控制台面板里`);
  }
});

// ---------------------------------------------------------------- 触屏手感与速度档

test("拨盘热区够大：触屏点不中比什么都毁手感", () => {
  const key = CSS.match(/\.pad-key\s*\{([^}]*)\}/);
  assert.ok(key, "必须有 .pad-key 规则");
  const px = (prop) => {
    const m = key[1].match(new RegExp(`${prop}:\\s*(\\d+)px`));
    return m ? Number(m[1]) : 0;
  };
  assert.ok(px("width") >= 44, `.pad-key 宽至少 44px，实际 ${px("width")}px`);
  assert.ok(px("height") >= 44, `.pad-key 高至少 44px，实际 ${px("height")}px`);

  const pad = CSS.match(/\.pad\s*\{([^}]*)\}/);
  assert.match(pad[1], /touch-action:\s*none/, "拨盘必须禁掉浏览器手势，否则推拉会滚页面");
  assert.match(CSS, /\.pad-key(?:\.is-down|:\s*active)?[\s\S]{0,40}?\{[^}]*\}/, "必须有按下态");
  assert.match(CSS, /\.pad-key:active,\s*\.pad-key\.is-down/, "按下反馈要同时覆盖 :active 与 .is-down（脚本点亮）");
});

test("速度档三选一：档位 id 必须与 engine 对齐，文本必须挂 i18n", () => {
  const seg = BODY.match(/<div class="seg" id="opt-speed"[\s\S]*?<\/div>/);
  assert.ok(seg, "控制台里必须有速度档拨杆");
  const ids = [...seg[0].matchAll(/data-speed="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, SPEED_TIER_IDS, "HTML 里的档位必须正好等于 engine 的合法档位");
  for (const m of seg[0].matchAll(/data-speed="[^"]+"/g)) {
    const tag = seg[0].slice(seg[0].lastIndexOf("<", m.index), seg[0].indexOf(">", m.index));
    assert.match(tag, /data-i18n="/, "每个档位按钮的文案都要挂 i18n 键");
  }
  assert.match(seg[0], /role="radiogroup"/);
  assert.match(seg[0], /data-i18n-aria="/, "拨杆整体要有一个可读的 aria 名称");
});
