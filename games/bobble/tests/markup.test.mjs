// 泡泡射手 · 标记装配契约测试
// 覆盖：语义骨架 / 返回首页 / ?v=dev 缓存占位 / 机台双舷窗 / 操作台 / 广告避让 / 动效降级 / 模块分层
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
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

test("入口使用 ES module", () => {
  assert.ok(/<script[^>]+type="module"/.test(html));
});

test("机台骨架：冰窟舞台 canvas + 机顶状态栏 + 左右双舷窗", () => {
  assert.ok(/<canvas[^>]+id="board"/.test(html));
  assert.ok(html.includes('id="stage-bar"'));
  assert.ok(html.includes('id="panel-left"'));
  assert.ok(html.includes('id="panel-right"'));
  assert.ok(html.includes('id="stage-cabinet"'));
});

test("左右舷窗信息分区齐全（连锁/用弹/下压/道具/最佳记录）", () => {
  for (const id of [
    "chain-val",
    "max-chain-val",
    "shots-val",
    "target-val",
    "press-val",
    "pick-val",
    "prism-val",
    "left-val",
    "best-line",
    "daily-line"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `缺 HUD 节点 ${id}`);
  }
});

test("实体操作台：换弹 / 冰镐弹 / 发射（拒绝四角浮动按钮）", () => {
  assert.ok(html.includes('id="deck"'));
  for (const id of ["btn-swap", "btn-pick", "btn-fire"]) {
    assert.ok(html.includes(`id="${id}"`), `缺操作台按键 ${id}`);
  }
  const buttons = [...html.matchAll(/<button[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(buttons.length > 0);
});

test("四浮层齐备：start / help / clear / over", () => {
  for (const id of ["screen-start", "screen-help", "screen-clear", "screen-over"]) {
    assert.ok(html.includes(`id="${id}"`), `缺浮层 ${id}`);
  }
  assert.ok(html.includes('id="level-grid"'));
  assert.ok(html.includes('id="toast"'));
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

test("CSS 含 [hidden] 强制隐藏守卫与 reduced-motion 降级", () => {
  assert.ok(css.includes("[hidden]"));
  assert.ok(css.includes("display: none !important"));
  assert.ok(css.includes("prefers-reduced-motion"));
});

test("CSS 含极光冰窟沉浸背景与柔光（禁死白死黑平铺）", () => {
  assert.ok(css.includes("radial-gradient"));
  assert.ok(css.includes("linear-gradient"));
  assert.ok(!/background:\s*(#fff|white|#000|black)\s*;/.test(css));
});

test("全站共享语言键 doin.lang", () => {
  const js = readdirSync(resolve(root, "js"))
    .filter((n) => n.endsWith(".mjs"))
    .map((n) => readFileSync(resolve(root, "js", n), "utf8"))
    .join("\n");
  assert.ok(js.includes("doin.lang"));
});

test("存档键 doin.bobble.v1 + try/catch 降级", () => {
  const storage = readFileSync(resolve(root, "js", "storage.mjs"), "utf8");
  assert.ok(storage.includes("doin.bobble.v1"));
  assert.ok(storage.includes("catch"));
});

test("规则层 DOM-Free：engine.mjs 不碰 DOM / 存储（注释已剥离）", () => {
  const engine = stripComments(readFileSync(resolve(root, "js", "engine.mjs"), "utf8"));
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.ok(!engine.includes(token), `engine.mjs 混入 ${token}`);
  }
});

test("模块分层齐全：engine/game/levels/score/storage/i18n/audio/render/ui/main", () => {
  for (const name of ["engine", "game", "levels", "score", "storage", "i18n", "audio", "render", "ui", "main"]) {
    const p = resolve(root, "js", `${name}.mjs`);
    assert.ok(statSync(p).isFile(), `缺 js/${name}.mjs`);
  }
});
