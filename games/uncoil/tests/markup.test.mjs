// 倒退贪吃蛇 Uncoil · 标记装配契约测试
// 覆盖：语义骨架 / 返回首页 / ?v=dev 缓存占位 / 机台双翼 / 操作台 / 广告避让 / 动效降级 / 模块分层
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css", "style.css"), "utf8");

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("index.html 存在且非空", () => {
  assert.ok(html.length > 1000);
});

test("html lang / viewport / description / favicon / noscript 齐全", () => {
  assert.ok(/<html[^>]+lang="/.test(html));
  assert.ok(/<meta[^>]+name="viewport"/.test(html));
  assert.ok(/<meta[^>]+name="description"/.test(html));
  assert.ok(/rel="icon"/.test(html));
  assert.ok(/<noscript/.test(html));
});

test("返回首页链接 id=back-home + href=/（平台唯一绝对路径）", () => {
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html) || /<a[^>]+id="back-home"[^>]*href="\/"/.test(html));
});

test("本地 css/mjs 资源全部带 ?v=dev 缓存占位", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(local.length >= 2);
  for (const v of local) assert.ok(v.includes("?v=dev"), `缺 ?v=dev: ${v}`);
});

test("零外部网络依赖：无 http(s) 外链、无 CDN、无 webfont", () => {
  const urls = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(urls, [], `发现外链: ${urls.join(", ")}`);
  assert.ok(!/@import/.test(css), "CSS 含 @import");
});

test("入口使用 ES module", () => {
  assert.ok(/<script[^>]+type="module"/.test(html));
});

test("机台骨架：舞台 canvas + 机顶状态栏 + 左右双翼 + 中央机柜", () => {
  assert.ok(/<canvas[^>]+id="board"/.test(html));
  for (const id of ["stage-bar", "panel-left", "panel-right", "stage-cabinet"]) {
    assert.ok(html.includes(`id="${id}"`), `缺骨架节点 ${id}`);
  }
});

test("左翼信息分区：长度 / 丸数 / 步数 / 参考步数", () => {
  for (const id of ["chapter-label", "level-progress", "len-val", "pellets-val", "steps-val", "par-val"]) {
    assert.ok(html.includes(`id="${id}"`), `缺 HUD 节点 ${id}`);
  }
});

test("右翼信息分区：进度条 / 状态 / 最佳 / 撤销 / 每日 / 残局", () => {
  for (const id of ["progress-track", "progress-fill", "status-val", "best-val", "undos-val", "daily-line", "endgame-line"]) {
    assert.ok(html.includes(`id="${id}"`), `缺 HUD 节点 ${id}`);
  }
});

test("实体操作台：摇杆四向 + 撤销 / 重开 / 选关（拒绝四角浮动按钮）", () => {
  assert.ok(html.includes('id="deck"'));
  assert.ok(html.includes('id="dpad"'));
  for (const id of ["btn-up", "btn-down", "btn-left", "btn-right", "btn-undo", "btn-reset", "btn-menu", "btn-replay"]) {
    assert.ok(html.includes(`id="${id}"`), `缺操作台按键 ${id}`);
  }
});

test("浮层齐备：start / help / clear；困毙用浮出条而非弹窗", () => {
  for (const id of ["screen-start", "screen-help", "screen-clear", "stuck-bar", "level-grid", "toast"]) {
    assert.ok(html.includes(`id="${id}"`), `缺节点 ${id}`);
  }
  assert.ok(/id="stuck-bar"[^>]*class="hidden"/.test(html) || /class="hidden"[^>]*id="stuck-bar"/.test(html),
    "困毙条初始必须隐藏");
});

test("移动端 HUD 与广告安全避让（底部 ≥68px + 安全区）", () => {
  assert.ok(html.includes('id="mobile-hud"'));
  assert.ok(css.includes("env(safe-area-inset-bottom)"));
  assert.ok(/padding-bottom:\s*max\(68px/.test(css), "主容器底部必须预留 ≥68px 广告避让");
});

test("画布防拖拽：touch-action 与 overscroll-behavior", () => {
  assert.ok(css.includes("touch-action: none"), "CSS 缺 touch-action: none");
  assert.ok(css.includes("overscroll-behavior: none"), "CSS 缺 overscroll-behavior: none");
});

test("CSS 含 hidden 守卫与 reduced-motion 降级，且降级不隐藏核心交互件", () => {
  assert.ok(css.includes("[hidden]"));
  assert.ok(css.includes("display: none !important"));
  assert.ok(css.includes("prefers-reduced-motion"));
  const block = css.slice(css.indexOf("prefers-reduced-motion"));
  assert.ok(!/display:\s*none/.test(block), "reduced-motion 里禁止 display:none（会藏掉核心交互件）");
});

test("CSS 含糖果亮场渐变背景（页面底色禁死白死黑平铺）", () => {
  const bodyBlock = css.match(/(?:html,\s*body|body)\s*\{([\s\S]*?)\}/);
  assert.ok(bodyBlock, "找不到页面级背景规则");
  assert.ok(/gradient/.test(bodyBlock[1]), "页面底色必须是渐变，不能平铺");
  assert.ok(!/background:\s*(#fff|white|#000|black)\s*;/.test(bodyBlock[1]), "页面底色是死白/死黑");
  assert.ok(css.includes("radial-gradient"));
  assert.ok(css.includes("linear-gradient"));
});

test("配色避开首页薄荷绿 #83ffe7（注释已剥离）", () => {
  assert.ok(!/83ffe7/i.test(stripComments(css)), "CSS 撞上门户首页薄荷绿");
});

test("全站共享语言键 doin.lang", () => {
  const i18n = readFileSync(resolve(root, "js", "i18n.mjs"), "utf8");
  assert.ok(i18n.includes("doin.lang"));
});

test("存档键 doin.uncoil.v1 + try/catch 降级", () => {
  const storage = readFileSync(resolve(root, "js", "storage.mjs"), "utf8");
  assert.ok(storage.includes("doin.uncoil.v1"));
  assert.ok(storage.includes("catch"));
});

test("规则层 DOM-Free：engine.mjs 与 game.mjs 不碰 DOM / 存储（注释已剥离）", () => {
  for (const name of ["engine.mjs", "game.mjs"]) {
    const code = stripComments(readFileSync(resolve(root, "js", name), "utf8"));
    for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
      assert.ok(!code.includes(token), `${name} 混入 ${token}`);
    }
  }
});

test("模块分层齐全：engine/game/levels/score/storage/i18n/audio/render/ui/main", () => {
  for (const name of ["engine", "game", "levels", "score", "storage", "i18n", "audio", "render", "ui", "main"]) {
    assert.ok(statSync(resolve(root, "js", `${name}.mjs`)).isFile(), `缺 js/${name}.mjs`);
  }
});
