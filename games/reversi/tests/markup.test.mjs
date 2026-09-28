import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const gameRoot = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(gameRoot, "index.html"), "utf8");

function sourceFiles() {
  const out = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.isDirectory()) {
        if (name.name === "tests" || name.name === "node_modules") continue;
        walk(resolve(dir, name.name), `${prefix}${name.name}/`);
      } else if (/\.(mjs|js)$/.test(name.name)) {
        out.push({ path: `${prefix}${name.name}`, src: readFileSync(resolve(dir, name.name), "utf8") });
      }
    }
  };
  walk(resolve(gameRoot, "js"), "js/");
  walk(resolve(gameRoot, "tools"), "tools/");
  return out;
}

test("index.html 存在且非空", () => {
  assert.ok(html.length > 2000, "index.html 内容过短");
});

test("html lang 属性存在", () => {
  assert.ok(/<html[^>]+lang="/.test(html), "缺 <html lang=...>");
});

test("meta viewport 存在且含 viewport-fit=cover", () => {
  assert.ok(/<meta[^>]+name="viewport"/.test(html), "缺 meta viewport");
  assert.ok(html.includes("viewport-fit=cover"), "viewport 缺 viewport-fit=cover");
});

test("meta description 与 og/twitter 社交卡片齐备", () => {
  assert.ok(/<meta[^>]+name="description"/.test(html), "缺 meta description");
  assert.ok(html.includes("og:title"), "缺 og:title");
  assert.ok(html.includes("twitter:card"), "缺 twitter:card");
  assert.ok(html.includes('rel="canonical"'), "缺 canonical");
});

test("返回门户首页链接 id=back-home + href=/", () => {
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html), "缺返回首页链接");
});

test("favicon 以独立 svg 文件外链", () => {
  assert.ok(/rel="icon"[^>]+href="favicon\.svg/.test(html), "缺 favicon.svg 外链");
  const svg = readFileSync(resolve(gameRoot, "favicon.svg"), "utf8");
  assert.ok(svg.includes("<svg") && svg.includes("viewBox"), "favicon.svg 不是合法 SVG");
  assert.ok(!/[\u4e00-\u9fa5]/.test(svg), "favicon.svg 里出现汉字");
});

test("所有本地 css/mjs 资源带 ?v=dev 缓存占位", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(local.length >= 2, "未发现本地资源引用");
  for (const v of local) assert.ok(v.includes("?v=dev"), `资源缺 ?v=dev 占位: ${v}`);
});

test("入口是 ES module，且 index.html 不含任何内联实现代码", () => {
  assert.ok(/<script[^>]+type="module"[^>]+src=/.test(html), "缺外链 ES module 入口");
  const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>/g)];
  assert.equal(inline.length, 0, "index.html 里出现了内联脚本，实现代码必须留在 js/ 内");
});

test("noscript 兜底存在", () => {
  assert.ok(/<noscript/.test(html), "缺 <noscript>");
});

// ── 专属视窗结构：上下夹持（没有侧栏）────────────────────────────
test("上下夹持三件套齐备：顶部天平 / 中央棋盘 / 底部仪表条", () => {
  assert.ok(html.includes('class="beam-panel"'), "缺顶部黄铜天平横梁");
  assert.ok(html.includes('class="board-frame"') && html.includes('id="board"'), "缺中央棋盘");
  assert.ok(html.includes('class="instrument-bar"'), "缺底部黄铜仪表条");
  const order = ["beam-panel", "board-stage", "instrument-bar"].map((token) => html.indexOf(token));
  assert.ok(order.every((index) => index > 0), "三件套有缺失");
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "三件套顺序必须是仪表在上、棋盘居中、操作在下");
});

test("严禁侧栏（与 gomoku 左右双牌匾的差异化硬约束）", () => {
  for (const token of ["plaque", "side-panel", "side-left", "side-right", "aside"]) {
    assert.ok(!html.includes(token), `index.html 出现了侧栏痕迹: ${token}`);
  }
});

test("天平装置元素齐全：横梁 / 两侧砝码数字 / 子数曲线双线", () => {
  assert.ok(html.includes('id="beam"'), "缺横梁元素");
  assert.ok(html.includes('id="black-count"'), "缺黑子砝码读数");
  assert.ok(html.includes('id="white-count"'), "缺白子砝码读数");
  assert.ok(html.includes('class="graph-black"') && html.includes('class="graph-white"'), "子数曲线缺双色折线");
  assert.ok(html.includes('preserveAspectRatio="none"'), "曲线 SVG 未声明 preserveAspectRatio=none");
});

test("终局预报铜牌初值为 off（空位 > 14 时绝不出现）", () => {
  assert.ok(html.includes('id="forecast-plate"'), "缺终局预报铜牌");
  assert.ok(/id="forecast-plate"[^>]*data-state="off"/.test(html), "铜牌初始状态必须是 off");
});

test("三种模式按钮：play / puzzle / rush（不含 1.1 的摆盘）", () => {
  for (const mode of ["play", "puzzle", "rush"]) {
    assert.ok(html.includes(`data-mode="${mode}"`), `缺 ${mode} 模式按钮`);
  }
  assert.ok(!html.includes('data-mode="setup"'), "摆盘求助属于 1.1 范围，首版不得出现");
});

test("四档 AI 按钮齐全", () => {
  for (const tier of ["novice", "duelist", "virtuoso", "infallible"]) {
    assert.ok(html.includes(`data-tier="${tier}"`), `缺 ${tier} 档按钮`);
  }
});

test("执子与五种开局可选", () => {
  assert.ok(html.includes('data-side="1"') && html.includes('data-side="2"'), "缺执子按钮");
  for (const opening of ["standard", "diagonal", "perpendicular", "parallel", "random"]) {
    assert.ok(html.includes(`data-opening="${opening}"`), `缺 ${opening} 开局按钮`);
  }
});

test("核心操作与顶部工具按钮齐全", () => {
  for (const id of ["undo-btn", "hint-btn", "resign-btn", "restart-btn", "levels-btn", "settings-btn"]) {
    assert.ok(html.includes(`id="${id}"`), `缺 ${id}`);
  }
  for (const id of ["sound-btn", "lang-btn", "help-btn"]) {
    assert.ok(html.includes(`id="${id}"`), `缺 ${id}`);
  }
  assert.ok(html.includes('id="back-home"'), "缺返回键");
});

test("设置抽屉含全部偏好开关", () => {
  for (const id of ["pvp-toggle", "blitz-toggle", "classic-toggle", "mobility-toggle", "volume-range"]) {
    assert.ok(html.includes(`id="${id}"`), `缺 ${id}`);
  }
  assert.ok(html.includes('id="clear-btn"'), "缺清空战绩按钮");
});

test("五层弹层齐全且带 hidden", () => {
  for (const id of ["settings-layer", "result-layer", "help-layer", "levels-layer", "confirm-layer"]) {
    assert.ok(html.includes(`id="${id}"`), `缺 ${id}`);
    assert.ok(new RegExp(`id="${id}"[^>]*hidden`).test(html), `${id} 未带 hidden 初值`);
  }
});

test("结算卡元素齐全：比分 / 星评 / 档案三行 / 下一题", () => {
  for (const id of ["result-badge", "result-title", "result-score", "result-stars", "result-report",
    "report-moves", "report-maxflip", "report-swing", "result-next"]) {
    assert.ok(html.includes(`id="${id}"`), `缺 ${id}`);
  }
});

test("toast 与选关容器存在", () => {
  assert.ok(html.includes('id="toast"'), "缺 toast");
  assert.ok(html.includes('id="levels-grid"'), "缺选关网格");
  assert.ok(html.includes('id="levels-total"'), "缺星数汇总");
});

test("棋盘格由 JS 注入，HTML 里不得写死 64 个 cell", () => {
  const cells = (html.match(/class="cell"/g) ?? []).length;
  assert.equal(cells, 0, "index.html 里出现了静态棋盘格，盘面必须由 render.createBoard 注入");
});

// ── i18n 纯净性：把门禁规则在测试里复刻一份 ───────────────────────
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("JS 运行源码零裸写中文（tools/ 也在扫描范围内）", () => {
  const offenders = [];
  for (const file of sourceFiles()) {
    // i18n.mjs 是双语表的合法住所，由 i18n.test.mjs 单独把守（en 表零汉字）
    if (file.path === "js/i18n.mjs") continue;
    const code = stripComments(file.src).replace(/(["'`])中文\1/g, '""');
    const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (matches) offenders.push(`${file.path}: ${matches.slice(0, 2).join(", ")}`);
  }
  assert.deepEqual(offenders, [], `源码硬编码中文:\n${offenders.join("\n")}`);
});

test("index.html 中含汉字的文本节点必须挂 data-i18n 或在 JS 中被引用", () => {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const jsCode = sourceFiles().map((file) => file.src).join("\n");
  const offenders = [];
  for (const match of clean.matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)) {
    const [, tag, attrs, rawText] = match;
    if (tag.toLowerCase() === "title" || tag.toLowerCase() === "script") continue;
    if (attrs.includes("data-i18n")) continue;
    const id = (attrs.match(/id="([^"]+)"/) ?? [])[1];
    if (id && (jsCode.includes(`"${id}"`) || jsCode.includes(`'${id}'`))) continue;
    offenders.push(`<${tag}> ${rawText.trim().slice(0, 15)}`);
  }
  assert.deepEqual(offenders, [], `index.html 未覆盖中文节点: ${offenders.join(", ")}`);
});

test("index.html 的可热更新文本都声明了 data-i18n / data-i18n-aria", () => {
  const declared = (html.match(/data-i18n="/g) ?? []).length;
  assert.ok(declared >= 25, `data-i18n 声明过少（${declared}），热更新会留下中文残留`);
  assert.ok(/data-i18n-aria="/.test(html), "缺 data-i18n-aria 声明");
  // 属性里的中文不能被漏掉：带中文 aria-label 的元素必须同时声明 data-i18n-aria
  for (const match of html.matchAll(/<[^>]*aria-label="([^"]*[\u4e00-\u9fa5]+[^"]*)"[^>]*>/g)) {
    assert.ok(match[0].includes("data-i18n-aria"), `aria-label 含中文但未声明 data-i18n-aria: ${match[1]}`);
  }
});

test("CSS 覆盖契约：降级 / 避让 / 触摸拦截 / 隐藏守卫都在 style.css 里", () => {
  const css = readFileSync(resolve(gameRoot, "css", "style.css"), "utf8");
  assert.ok(css.includes("[hidden]") && css.includes("display: none !important"), "缺 [hidden] 强制隐藏守卫");
  assert.ok(css.includes("prefers-reduced-motion"), "缺动效降级");
  assert.ok(css.includes("env(safe-area-inset-bottom)"), "缺移动端安全区避让");
  assert.ok(css.includes("touch-action: none"), "缺 touch-action 拦截");
  assert.ok(css.includes("radial-gradient"), "标记应当使用径向柔光");
});

test("js/ 分层齐全：engine / game / ui / storage / i18n / audio / main", () => {
  const jsDir = resolve(gameRoot, "js");
  const names = readdirSync(jsDir);
  for (const file of ["engine.mjs", "game.mjs", "ui.mjs", "storage.mjs", "i18n.mjs", "audio.mjs", "main.mjs"]) {
    assert.ok(names.includes(file), `缺 js/${file}`);
  }
});
