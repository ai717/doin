// markup.test.mjs — 语义标记 / 资源缓存占位 / DOM 与 JS 双向闭合 / 已删除元素零残留 / CSS 降级与移动端避让
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { viewAspect } from "../js/render.mjs";
import { LOCALES } from "../js/i18n.mjs";

const gameDir = join(import.meta.dirname, "..");
const html = readFileSync(join(gameDir, "index.html"), "utf8");
const jsDir = join(gameDir, "js");
const cssDir = join(gameDir, "css");
const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith(".mjs"));
const css = readdirSync(cssDir).filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(cssDir, f), "utf8")).join("\n");

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const jsSources = jsFiles.map((f) => stripComments(readFileSync(join(jsDir, f), "utf8")));
const allJs = jsSources.join("\n");
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

// 玩法重构中删掉的旧交互件：标记、样式、脚本里都不许再有引用
const REMOVED = [
  "rail-track", "rail-knob", "power-gauge", "power-fill", "mode-row", "mode-card",
  "level-grid", "lv-btn", "stars-line", "duel-panel", "duel-score", "duel-turn",
  "key-row", "mini-btn", "aim-line", "charge-bar"
];

describe("markup: 文档骨架", () => {
  it("DOCTYPE / lang / charset / viewport 齐全", () => {
    assert.ok(/^<!DOCTYPE html>/i.test(html.trim()));
    assert.match(html, /<html[^>]+lang="[^"]+"/);
    assert.match(html, /<meta[^>]+charset="UTF-8"/i);
    assert.match(html, /<meta[^>]+name="viewport"[^>]+viewport-fit=cover/);
    assert.match(html, /<meta[^>]+name="description"/);
  });

  it("favicon 与样式表存在", () => {
    assert.match(html, /rel="icon"/);
    assert.ok(existsSync(join(gameDir, "favicon.svg")), "favicon.svg 缺失");
    assert.ok(existsSync(join(cssDir, "style.css")), "css/style.css 缺失");
  });

  it("入口脚本是 ES module 且带缓存占位", () => {
    assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/);
  });

  it("noscript 兜底存在", () => {
    assert.match(html, /<noscript>[\s\S]*<\/noscript>/);
  });

  it("返回门户链接指向站点根", () => {
    assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/);
  });

  it("id 全局唯一", () => {
    const dupes = htmlIds.filter((id, i) => htmlIds.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `重复 id：${dupes.join(",")}`);
  });

  it("零外部网络依赖（无 CDN / webfont / 外链资源）", () => {
    const externals = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
    assert.deepEqual(externals, [], `存在外链资源：${externals.join(",")}`);
  });
});

describe("markup: 资源缓存占位（T1 v-dev）", () => {
  it("所有本地 js/css 资源都带 ?v=dev", () => {
    const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
    assert.ok(assets.length > 0);
    const bad = assets.filter((v) => !v.includes("?v=dev"));
    assert.deepEqual(bad, [], `缺 ?v=dev：${bad.join(",")}`);
  });

  it("引用的本地文件真实存在", () => {
    const local = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1].split("?")[0])
      .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && v.includes("."));
    for (const rel of local) {
      assert.ok(existsSync(join(gameDir, rel)), `引用了不存在的文件 ${rel}`);
    }
  });
});

describe("markup: DOM 与 JS 双向闭合", () => {
  it("ui.mjs 取用的每个 id 都在 HTML 里存在", () => {
    const uiSrc = stripComments(readFileSync(join(jsDir, "ui.mjs"), "utf8"));
    const block = uiSrc.match(/for \(const id of \[([\s\S]*?)\]\)/);
    assert.ok(block, "未找到 ui.mjs 的 id 清单");
    const listed = [...block[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.ok(listed.length > 25, `id 清单过短：${listed.length}`);
    for (const id of listed) {
      assert.ok(htmlIds.includes(id), `ui.mjs 引用了 HTML 中不存在的 id：${id}`);
    }
  });

  it("ui.mjs 每个 el[...] 取用项都进了初始化清单（防「用了但没登记」）", () => {
    const uiSrc = stripComments(readFileSync(join(jsDir, "ui.mjs"), "utf8"));
    const block = uiSrc.match(/for \(const id of \[([\s\S]*?)\]\)/);
    assert.ok(block, "未找到 ui.mjs 的 id 清单");
    const listed = new Set([...block[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));
    const used = new Set([...uiSrc.matchAll(/\bel\[["']([a-z0-9-]+)["']\]/g)].map((m) => m[1]));
    assert.ok(used.size > 20, `el[...] 取用项过少：${used.size}`);
    const missing = [...used].filter((id) => !listed.has(id));
    assert.deepEqual(missing, [], `ui.mjs 用了但没登记的 id（运行时会 undefined 抛错）：${missing.join(",")}`);
  });

  it("main.mjs 不得把 saveSave()/clearSave() 的返回值（布尔）当存档对象用", () => {
    const src = stripComments(readFileSync(join(jsDir, "main.mjs"), "utf8"));
    const bad = src.split("\n")
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /^save\s*=\s*save(?:Save|Load)\s*\(/.test(line))
      .map(({ line, n }) => `L${n}: ${line}`);
    assert.deepEqual(bad, [], `saveSave/loadSave 返回的不是存档对象，不能赋回 save：${bad.join(" | ")}`);
  });

  it("main.mjs 直接取用的 id 也存在", () => {
    for (const m of allJs.matchAll(/getElementById\(\s*"([^"]+)"\s*\)/g)) {
      assert.ok(htmlIds.includes(m[1]), `getElementById("${m[1]}") 在 HTML 中不存在`);
    }
  });

  it("HTML 里声明的按钮都被 JS 绑定", () => {
    const interactive = [...html.matchAll(/<button\s([^>]*)id="([^"]+)"/g)].map((m) => m[2]);
    assert.ok(interactive.length >= 12, `交互件过少：${interactive.length}`);
    const unbound = interactive.filter((id) => !allJs.includes(`"${id}"`));
    assert.deepEqual(unbound, [], `声明了却没接线：${unbound.join(",")}`);
  });

  it("画布有初始尺寸与无障碍标注", () => {
    const canvas = html.match(/<canvas([^>]*)/);
    assert.ok(canvas, "缺 canvas");
    assert.match(canvas[1], /width="\d+"/);
    assert.match(canvas[1], /height="\d+"/);
    assert.match(canvas[1], /aria-label="[^"]+"/);
    assert.match(html, /id="table"/);
  });

  it("浮层：菜单默认可见，其余默认隐藏", () => {
    for (const id of ["ov-help", "ov-result", "ov-pause"]) {
      const tag = html.match(new RegExp(`<div class="overlay" id="${id}"([^>]*)>`));
      assert.ok(tag, `缺浮层 ${id}`);
      assert.match(tag[1], /\bhidden\b/, `${id} 必须默认 hidden`);
    }
    const menu = html.match(/<div class="overlay" id="ov-menu"([^>]*)>/);
    assert.ok(menu && !/\bhidden\b/.test(menu[1]), "菜单应默认可见");
  });
});

describe("markup: 无尽机台的信息架构", () => {
  it("机箱三块分区齐备（左操作盘 / 中玻璃观察窗 / 右掉落记录）", () => {
    for (const id of ["rail-panel", "glass-stage", "prize-panel"]) {
      assert.ok(htmlIds.includes(id), `缺机箱分区 ${id}`);
    }
    assert.match(html, /id="prize-list"/);
    assert.match(html, /id="drop-log"/);
  });

  it("投币口示意图与两侧沟槽说明在左盘", () => {
    assert.match(html, /id="chute-diagram"/);
    assert.match(html, /data-i18n="chuteLabel"/);
    assert.match(html, /data-i18n="chuteDesc"/);
    assert.match(html, /data-i18n="gutterLabel"/);
    assert.match(html, /data-i18n="gutterDesc"/);
  });

  it("HUD 四格是 账户 / 得分 / 倍率 / 本波连锁（得分不进画布）", () => {
    for (const id of ["hud-credits", "hud-score", "hud-mult", "hud-cascade"]) {
      assert.match(html, new RegExp(`id="${id}"`), `缺 HUD 格 ${id}`);
    }
    assert.match(html, /data-i18n="credits"/);
    assert.match(html, /data-i18n="score"/);
    assert.match(html, /data-i18n="chainNow"/);
  });

  it("主菜单提供初始币数选择与开始按钮", () => {
    assert.match(html, /id="credit-grid"/);
    assert.match(html, /id="btn-start"/);
    assert.match(html, /data-i18n="creditPick"/);
  });

  it("奖品陈列柜覆盖三类金币 + 四类机关说明", () => {
    for (const key of ["coinNorm", "coinGold", "coinGem", "tokenCard", "objLauncher", "objMagnet", "objTower"]) {
      assert.ok(html.includes(`data-i18n="${key}"`), `陈列柜缺 ${key}`);
    }
  });

  it("最高分 / 最高连锁 / 最多落袋三个纪录位齐备", () => {
    for (const id of ["best-score", "best-cascade", "best-drops"]) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
  });

  it("HTML 里 data-i18n 用到的 key 都在词典里（防拼错 key 导致文案空掉）", () => {
    const keys = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(keys.length > 30, `data-i18n 数量过少：${keys.length}`);
    for (const key of keys) {
      assert.ok(key in LOCALES.zh, `HTML 用了词典里没有的 key：${key}`);
    }
  });

  it("带内联占位文本的 data-i18n 元素，文本必须与 zh 词典一致（防占位漂移）", () => {
    const mismatches = [];
    for (const m of html.matchAll(/<([a-z0-9]+)([^>]*data-i18n="([^"]+)"[^>]*)>([^<]*)<\/\1>/g)) {
      const key = m[3];
      const text = m[4].trim();
      if (!text) continue;
      const expected = LOCALES.zh[key];
      if (text !== expected) mismatches.push(`${key}: HTML="${text}" vs zh="${expected}"`);
    }
    assert.deepEqual(mismatches, [], `占位文本与词典不一致：\n${mismatches.join("\n")}`);
  });
});

describe("markup: 玩法重构后旧交互件零残留", () => {
  it("HTML 里不再有瞄准 / 力度 / 选关 / 双人 / 模式切换的标记", () => {
    const found = REMOVED.filter((id) => htmlIds.includes(id));
    assert.deepEqual(found, [], `HTML 仍残留：${found.join(",")}`);
    assert.equal(htmlIds.includes("mode-tag") && !html.includes("modeEndless"), false);
  });

  it("CSS 里不再有旧交互件的选择器", () => {
    const found = REMOVED.filter((id) => cssNoComments.includes(`#${id}`) || cssNoComments.includes(`.${id}`));
    assert.deepEqual(found, [], `CSS 仍残留：${found.join(",")}`);
  });

  it("JS 里不再引用旧交互件", () => {
    const found = REMOVED.filter((id) => allJs.includes(`"${id}"`) || allJs.includes(`'${id}'`));
    assert.deepEqual(found, [], `JS 仍残留：${found.join(",")}`);
  });

  it("引擎与控制器不再暴露瞄准 / 力度 / 选关 / 双人接口", () => {
    const engineSrc = stripComments(readFileSync(join(jsDir, "engine.mjs"), "utf8"));
    for (const gone of ["setAim", "nudgeAim", "startCharge", "releaseCharge", "loadLevelState", "startArcade", "startDuel", "goalMet", "computeStarsFor", "duelWinner", "coinsLeft", "DUEL_TARGET"]) {
      assert.equal(engineSrc.includes(gone), false, `engine.mjs 仍残留 ${gone}`);
    }
    const gameSrc = stripComments(readFileSync(join(jsDir, "game.mjs"), "utf8"));
    for (const gone of ["setAim", "setPower", "startCharge", "releaseCharge", "repeat(", "loadLevel", "loadArcade", "loadDuel"]) {
      assert.equal(gameSrc.includes(gone), false, `game.mjs 仍残留 ${gone}`);
    }
  });

  it("音频层不再有双人模式专属音效分支", () => {
    const audioSrc = stripComments(readFileSync(join(jsDir, "audio.mjs"), "utf8"));
    assert.equal(audioSrc.includes("duel_turn"), false);
    assert.equal(audioSrc.includes("duel_win"), false);
  });
});

describe("markup: CSS 降级与移动端避让", () => {
  it("尊重 prefers-reduced-motion", () => {
    assert.ok(css.includes("prefers-reduced-motion"));
    const block = css.match(/@media[^{]*prefers-reduced-motion[^{]*\{([\s\S]*?)\n\}/);
    assert.ok(block, "缺 reduced-motion 媒体块");
    assert.equal(/display\s*:\s*none/.test(block[1]), false, "降级不得隐藏核心交互件");
  });

  it("有移动端断点与单列重排", () => {
    assert.match(css, /@media[^{]*max-width/);
    const mobile = css.match(/@media \(max-width: 768px\) \{([\s\S]*?)\n\}/);
    assert.ok(mobile, "缺 768px 断点");
    assert.match(mobile[1], /flex-direction:\s*column/);
    assert.match(mobile[1], /order:\s*1/);
  });

  it("底部预留广告安全间距（移动端 ≥68px）", () => {
    assert.match(css, /env\(\s*safe-area-inset-bottom/);
    assert.match(css, /max\(68px/);
  });

  it("画布禁用浏览器手势并声明触控动作", () => {
    assert.match(css, /touch-action\s*:\s*none/);
    assert.match(css, /overscroll-behavior\s*:\s*none/);
  });

  it("hidden 属性有强制定位守卫（防 display:flex 覆盖）", () => {
    assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  });

  it("画布按可用高度反推宽度，且比例与渲染器投影包围盒一致", () => {
    const table = css.match(/#table \{([\s\S]*?)\n\}/);
    assert.ok(table, "缺 #table 样式块");
    const aspect = viewAspect();
    const ratio = table[1].match(/aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/);
    assert.ok(ratio, "缺 aspect-ratio");
    const cssAspect = Number(ratio[1]) / Number(ratio[2]);
    assert.ok(Math.abs(cssAspect - aspect) < 0.02, `CSS 比例 ${cssAspect.toFixed(4)} 与投影 ${aspect.toFixed(4)} 不一致`);
    // 竖向拉高后比例贴近 1.13，只要求仍偏横向（> 1）。
    assert.ok(aspect > 1.0, `投影比例应偏横向，实际 ${aspect.toFixed(4)}`);
    const w = table[1].match(/width:\s*min\(100%,\s*calc\(\(100dvh - (\d+)px\)\s*\*\s*([\d.]+)\)\)/);
    assert.ok(w, "缺「按可用高度反推宽度」的 width 规则");
    assert.ok(Math.abs(Number(w[2]) - aspect) < 0.02, `宽度系数 ${w[2]} 与投影比例 ${aspect.toFixed(4)} 不一致`);
    assert.equal(/(^|\n)\s*height:\s*\d/.test(table[1]), false, "不得与 aspect-ratio 同时写死 height");
  });

  it("CSS 大括号配对", () => {
    let depth = 0;
    for (const ch of cssNoComments) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      assert.ok(depth >= 0, "多余的 }");
    }
    assert.equal(depth, 0, "CSS 大括号不配对");
  });
});

describe("markup: 模块清单与分层", () => {
  it("分层模块齐备", () => {
    for (const file of ["engine.mjs", "game.mjs", "levels.mjs", "score.mjs", "storage.mjs", "i18n.mjs", "audio.mjs", "render.mjs", "ui.mjs", "main.mjs"]) {
      assert.ok(existsSync(join(jsDir, file)), `缺 ${file}`);
    }
  });

  it("engine / game / levels / score / storage 不碰 DOM 与存储（可在 Node 直接跑）", () => {
    for (const file of ["engine.mjs", "game.mjs", "levels.mjs", "score.mjs"]) {
      const src = stripComments(readFileSync(join(jsDir, file), "utf8"));
      for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
        assert.equal(src.includes(token), false, `${file} 混入 ${token}`);
      }
    }
  });

  it("engine 不 import 任何渲染 / DOM 层（单向依赖）", () => {
    const src = readFileSync(join(jsDir, "engine.mjs"), "utf8");
    for (const banned of ["render.mjs", "ui.mjs", "main.mjs", "audio.mjs", "storage.mjs"]) {
      assert.equal(src.includes(banned), false, `engine.mjs 不应依赖 ${banned}`);
    }
  });

  it("localStorage 只出现在 storage.mjs 与 i18n.mjs，且均有 try/catch 降级", () => {
    const users = jsFiles.filter((f) => readFileSync(join(jsDir, f), "utf8").includes("localStorage"));
    assert.deepEqual(users.sort(), ["i18n.mjs", "storage.mjs"]);
    for (const file of users) {
      assert.ok(readFileSync(join(jsDir, file), "utf8").includes("catch"), `${file} 缺少 try/catch 降级`);
    }
  });

  it("tests/ 至少覆盖 engine / storage / i18n / markup / score / levels / game / render 八类", () => {
    const names = readdirSync(join(gameDir, "tests")).filter((f) => f.endsWith(".test.mjs"));
    for (const want of [
      "engine.test.mjs", "storage.test.mjs", "i18n.test.mjs", "markup.test.mjs",
      "score.test.mjs", "levels.test.mjs", "game.test.mjs", "render.test.mjs"
    ]) {
      assert.ok(names.includes(want), `缺 ${want}`);
    }
  });
});
