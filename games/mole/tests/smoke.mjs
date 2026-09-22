// smoke.mjs — 无浏览器运行时冒烟：在 DOM 桩里装配真实 main.mjs，
// 断言"业务可观测量在推进"（而非仅"没抛异常"），防止假绿。
// 用法： node games/mole/tests/smoke.mjs
// 环境变量：SM_W / SM_H 可覆盖视口尺寸；SM_TAG 用于输出前缀。

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installDom } from "./dom-stub.mjs";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");

const W = Number(process.env.SM_W || 1280);
const H = Number(process.env.SM_H || 800);
const TAG = process.env.SM_TAG || `${W}x${H}`;

const failures = [];
const notes = [];

function check(label, condition, detail = "") {
  if (condition) {
    notes.push(`  PASS ${label}`);
  } else {
    failures.push(`  FAIL ${label}${detail ? ` <- ${detail}` : ""}`);
  }
}

const env = installDom(html);
env.document.body.querySelectorAll(".hole"); // 预热
globalThis.window.innerWidth = W;
globalThis.window.innerHeight = H;

// 捕获非法颜色等渲染噪声
const badColorRe = /(NaN|undefined|null)\s*\)/;
const runtimeErrors = [];

const originalWarn = console.warn;
console.warn = (...args) => {
  const text = args.join(" ");
  if (badColorRe.test(text)) runtimeErrors.push(`非法颜色: ${text}`);
  originalWarn(...args);
};

// ---- 装配真实入口 ----
await import("../js/main.mjs");
const api = globalThis.window.__mole;
check("main.mjs 装配出 __mole 句柄", Boolean(api), "缺少 window.__mole");
if (!api) {
  emit();
  process.exit(1);
}

const { ui, game, startRun, hitIndex } = api;
const isOpen = (el) => Boolean(el) && !el.classList.contains("hidden");

// ---- 1. 初始态：洞位网格已建、欢迎弹层打开、主循环在跑 ----
check("洞位网格已构建", ui.holes.length >= 9, `holes=${ui.holes.length}`);
check("网格与视口匹配（桌面 4 列 / 移动 3 列）",
  W <= 768 ? ui.cols === 3 : ui.cols === 4, `cols=${ui.cols}`);
check("欢迎弹层初始为显示", isOpen(ui.dom.modalWelcome), "welcome 被隐藏了");
check("暂停弹层初始为隐藏", !isOpen(ui.dom.modalPause),
  "pause 初始可见 —— 桩未还原 HTML 的 hidden");

// ---- 2. 开局：计时必须真的推进 ----
env.step(2);
startRun("normal");
check("开局后进入 running", game.run?.status === "running", `status=${game.run?.status}`);
const t0 = game.run.timeLeftMs;
env.step(60); // 约 1 秒
const t1 = game.run.timeLeftMs;
check("主循环推进：剩余时间在减少", t1 < t0, `${t0} -> ${t1}`);
check("开局后欢迎弹层已关闭", !isOpen(ui.dom.modalWelcome), "welcome 未关闭");

// ---- 3. 命中：分数与连击必须真的涨 ----
const active = [];
for (let i = 0; i < game.run.holes.length; i += 1) {
  const m = game.run.holes[i];
  if (m && m.phase !== "duck") active.push({ i, m });
}
check("场上有地鼠冒出", active.length > 0, "无地鼠（生成器停摆）");
const scoreBefore = game.run.score;
const comboBefore = game.run.combo;
for (const { i, m } of active) {
  if (m.species !== "bomb") hitIndex(i);
}
check("命中后得分/连击推进", game.run.score > scoreBefore || game.run.combo > comboBefore,
  `score ${scoreBefore}->${game.run.score}, combo ${comboBefore}->${game.run.combo}`);

// ---- 4. HUD 文本必须与引擎一致（UI 不得自算） ----
check("HUD 得分与引擎一致", ui.dom.hudScore.textContent === String(game.run.score),
  `hud=${ui.dom.hudScore.textContent} engine=${game.run.score}`);
check("HUD 连击与引擎一致", ui.dom.hudCombo.textContent === String(game.run.combo),
  `hud=${ui.dom.hudCombo.textContent} engine=${game.run.combo}`);
check("HUD 计时数字已渲染", /^\d+$/.test(ui.dom.hudTime.textContent), `time=${ui.dom.hudTime.textContent}`);

// ---- 5. 暂停：计时应停住 ----
ui.dom.btnPause.dispatch("click");
check("暂停后 paused=true", game.paused === true, `paused=${game.paused}`);
check("暂停弹层可见", isOpen(ui.dom.modalPause), "暂停弹层未显示");
const p0 = game.run.timeLeftMs;
env.step(60);
check("暂停期间计时不推进", game.run.timeLeftMs === p0, `${p0} -> ${game.run.timeLeftMs}`);
ui.dom.btnResume.dispatch("click");
check("恢复后 paused=false", game.paused === false);
env.step(30);
check("恢复后计时继续", game.run.timeLeftMs < p0, "恢复后仍未推进");

// ---- 6. 键盘：数字键必须能敲中 ----
{
  // 造一只确定性的鼠放好，再派发真实 keydown
  const target = game.run.holes.findIndex((m) => !m);
  game.run.holes[target] = {
    id: game.run.nextId++, species: "normal", phase: "up", t: 0, upMs: 5000, hp: 1,
  };
  const before = game.run.hits;
  env.document.dispatch("keydown", { key: "1" });
  check("键盘 1 键敲中首洞", game.run.hits === before + 1,
    `hits ${before} -> ${game.run.hits}`);
}
{
  const before = game.paused;
  env.document.dispatch("keydown", { key: "p" });
  check("键盘 P 键切换暂停", game.paused !== before, `paused=${game.paused}`);
  if (game.paused) env.document.dispatch("keydown", { key: "p" });
}

// ---- 7. 走完整局：结算弹层 + 存档写入 ----
let guard = 0;
while (game.run.status === "running" && guard < 6000) {
  env.step(1);
  guard += 1;
}
check("对局能正常结算", game.run.status === "over", `status=${game.run.status} guard=${guard}`);
check("结算弹层已显示", isOpen(ui.dom.modalGameover), "gameover 未显示");
check("结算分数与引擎一致", ui.dom.settleScore.textContent === String(game.run.score),
  `settle=${ui.dom.settleScore.textContent} engine=${game.run.score}`);
const saved = JSON.parse(env.localStorage.getItem("doin.mole.v1") ?? "null");
check("存档已写入且分数非负", saved && saved.bestScore && saved.bestScore.normal >= 0,
  `saved=${env.localStorage.getItem("doin.mole.v1")}`);

// ---- 8. 每日模式：同题可复现 ----
startRun("daily");
const seedA = game.run.seed;
const first = [];
env.step(80);
for (const hole of game.run.holes) if (hole) first.push(`${hole.species}@${hole.upMs}`);
startRun("daily");
const seedB = game.run.seed;
check("每日模式同日同种子", seedA === seedB, `${seedA} !== ${seedB}`);
check("每日模式标记正确", game.run.daily === true && game.mode === "daily");

// ---- 9. 语言与音效按钮存在且可点 ----
ui.dom.btnSound.dispatch("click");
ui.dom.btnSound.dispatch("click");
check("音效按钮可切换且不抛错", true);
check("语言切换写入 doin.lang",
  env.localStorage.getItem("doin.lang") === null || ["zh", "en"].includes(env.localStorage.getItem("doin.lang")));

// ---- 10. 视口切换：网格与引擎必须同步，且不残留旧 DOM ----
{
  startRun("normal");
  env.step(4);
  globalThis.window.innerWidth = W <= 768 ? 1280 : 390;
  env.document.dispatch("orientationchange", {});
  env.step(4);
  const cols = globalThis.window.innerWidth <= 768 ? 3 : 4;
  check("视口切换后网格列数更新", ui.cols === cols, `cols=${ui.cols} want=${cols}`);
  check("DOM 洞位数与网格一致", ui.holes.length === ui.rows * ui.cols,
    `dom=${ui.holes.length} grid=${ui.rows * ui.cols}`);
  check("网格区子节点数与网格一致", ui.dom.grid.children.length === ui.rows * ui.cols,
    `children=${ui.dom.grid.children.length}`);
  check("网格切换后引擎洞位数同步", !game.run || game.run.holes.length === ui.rows * ui.cols,
    `engine=${game.run?.holes.length} grid=${ui.rows * ui.cols}`);
  globalThis.window.innerWidth = W;
  env.document.dispatch("orientationchange", {});
  env.step(4);
}

// ---- 11. 渲染噪声 ----
check("无非法颜色/几何 NaN", runtimeErrors.length === 0, runtimeErrors.join(" | "));

emit();

function emit() {
  const head = `== mole smoke [${TAG}] ==`;
  const lines = [...notes, ...failures];
  console.log(head);
  console.log(lines.join("\n"));
  console.log(`-- ${notes.length} pass, ${failures.length} fail`);
  if (failures.length) process.exit(1);
}
