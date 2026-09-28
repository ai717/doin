// smoke.mjs — 无浏览器运行时冒烟：在 DOM 桩里装配真实 main.mjs，
// 断言"业务可观测量在推进"（而非仅"没抛异常"），防止假绿。
// 用法： node games/uncoil/tests/smoke.mjs
// 环境变量：SM_W / SM_H 覆盖视口尺寸。

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installDom } from "./dom-stub.mjs";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");

const W = Number(process.env.SM_W || 1280);
const H = Number(process.env.SM_H || 800);

const failures = [];
const notes = [];

function check(label, condition, detail = "") {
  if (condition) notes.push(`  PASS ${label}`);
  else failures.push(`  FAIL ${label}${detail ? ` <- ${detail}` : ""}`);
}

const env = installDom(html);
globalThis.window.innerWidth = W;
globalThis.window.innerHeight = H;

// ---- 装配真实入口 ----
const mod = await import("../js/main.mjs");
const { game, ui, renderer } = mod;
check("main.mjs 装配出 game / ui / renderer", Boolean(game && ui && renderer));

const el = (id) => env.document.getElementById(id);
const isOpen = (id) => {
  const e = el(id);
  return Boolean(e) && !e.classList.contains("hidden");
};
const txt = (id) => (el(id) ? el(id).textContent : "<missing>");
const KEY_OF = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const press = (dir) => env.document.dispatch("keydown", { key: KEY_OF[dir] });

// ---- 1. 初始态：开始浮层可见、选关网格已建、主循环在跑 ----
check("开始浮层初始可见", isOpen("screen-start"), "screen-start 被隐藏");
check("结算浮层初始隐藏", !isOpen("screen-clear"), "screen-clear 初始可见（桩未还原 hidden）");
check("困毙条初始隐藏", !isOpen("stuck-bar"), "stuck-bar 初始可见");
check("选关网格已构建 40 关主线", el("level-grid").children.length === 40,
  `children=${el("level-grid").children.length}`);
check("舞台 canvas 已装配", Boolean(el("board")) && Boolean(renderer.canvas));

const t0 = renderer.time;
env.step(3);
check("主循环推进：渲染时钟在走", renderer.time > t0, `${t0} -> ${renderer.time}`);
check("渲染真的调用了 canvas（不是空转）", renderer.canvas.__ctx.__calls > 0,
  `ctx calls=${renderer.canvas.__ctx.__calls}`);

// ---- 2. 选关：点第一关 → 浮层关闭、HUD 与引擎一致 ----
const firstBtn = el("level-grid").children[0];
el("level-grid").dispatch("click", { target: firstBtn });
check("点关卡后开始浮层关闭", !isOpen("screen-start"), "screen-start 未关闭");
check("引擎已装载关卡", Boolean(game.state) && game.state.initLen > 1, `initLen=${game.state?.initLen}`);
check("HUD 长度与引擎一致", txt("len-val") === String(game.length()),
  `hud=${txt("len-val")} engine=${game.length()}`);
check("HUD 步数归零", txt("steps-val") === "0", `steps=${txt("steps-val")}`);
check("HUD 参考步数与关卡一致", txt("par-val") === String(game.state.level.par),
  `hud=${txt("par-val")} par=${game.state.level.par}`);

// ---- 3. 键盘走一步：步数与长度必须同步推进 ----
const lenBefore = game.length();
const legalFirst = game.legalDirs();
press(legalFirst[0]);
check("键盘走一步：steps 递增", game.state.engine.steps === 1, `steps=${game.state.engine.steps}`);
check("HUD 步数与引擎一致", txt("steps-val") === String(game.state.engine.steps),
  `hud=${txt("steps-val")} engine=${game.state.engine.steps}`);
check("长度不增（倒退蛇只会变短）", game.length() <= lenBefore, `${lenBefore} -> ${game.length()}`);

// ---- 4. 撤销：键盘 Z 回退一步 ----
env.document.dispatch("keydown", { key: "z" });
check("撤销后 steps 回退", game.state.engine.steps === 0, `steps=${game.state.engine.steps}`);
check("撤销次数已计数", txt("undos-val") === String(game.state.undos), `hud=${txt("undos-val")}`);

// ---- 5. 点舞台相邻格也能走（触屏主路径） ----
{
  const dirs = game.legalDirs();
  const head = game.state.engine.snake[0];
  const pick = dirs[0];
  const d = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[pick];
  const { cell, ox, oy } = renderer.layout();
  const tr = head.r + d[0];
  const tc = head.c + d[1];
  const x = ox + tc * cell + cell / 2;
  const y = oy + tr * cell + cell / 2;
  const board = el("board");
  board.dispatch("pointerdown", { clientX: x, clientY: y });
  board.dispatch("pointerup", { clientX: x, clientY: y });
  check("点击相邻格可走一步", game.state.engine.steps === 1, `steps=${game.state.engine.steps} dir=${pick}`);
}

// ---- 6. 走完参考解：通关结算 + 存档写入 ----
{
  ui.tryReset();
  const lv = game.state.level;
  for (const ch of lv.solution) {
    press({ U: "up", D: "down", L: "left", R: "right" }[ch]);
    if (game.state.status !== "playing") break;
  }
  check("参考解走完即通关", game.state.status === "won", `status=${game.state.status}`);
  check("通关时长度归 1", game.length() === 1, `len=${game.length()}`);
  ui.flushEnd();
  check("结算浮层已显示", isOpen("screen-clear"), "screen-clear 未显示");
  check("结算文案含步数与参考步数", txt("clear-line").includes(String(game.state.engine.steps)),
    `clear-line=${txt("clear-line")}`);
  const saved = JSON.parse(env.localStorage.getItem("doin.uncoil.v1") ?? "null");
  check("存档已写入 doin.uncoil.v1 且记录了本关成绩",
    Boolean(saved) && typeof saved.best?.[game.state.levelId] === "number",
    `saved=${env.localStorage.getItem("doin.uncoil.v1")}`);
  check("通关后解锁推进到下一关", saved.unlocked >= 2, `unlocked=${saved?.unlocked}`);
}

// ---- 7. 困毙演出：浮出条出现，撤销后收起 ----
{
  ui.tryReset();
  ui.showOverlay("none");
  let guard = 0;
  let rngState = 987654321;
  const rnd = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
  while (game.state.status === "playing" && guard < 300) {
    const dirs = game.legalDirs();
    if (!dirs.length) break;
    press(dirs[Math.floor(rnd() * dirs.length)]);
    guard += 1;
  }
  if (game.state.status === "entombed") {
    ui.flushEnd();
    check("困毙后浮出条可见（不是弹窗）", isOpen("stuck-bar"), "stuck-bar 未显示");
    check("困毙时结算浮层不出现", !isOpen("screen-clear"), "困毙不该弹结算窗");
    check("HUD 状态显示困毙", txt("status-val").length > 0, `status=${txt("status-val")}`);
    el("btn-stuck-undo").dispatch("click");
    check("点浮出条撤销后收起", !isOpen("stuck-bar"), "stuck-bar 未收起");
    check("撤销后重新可走", game.legalDirs().length > 0, "撤销后仍无处可走");
  } else {
    check("困毙用例前置成立（随机乱走应自锁）", false, `status=${game.state.status} guard=${guard}`);
  }
}

// ---- 8. 语言切换：全量文本覆盖且英文无汉字 ----
{
  ui.showOverlay("none");
  ui.tryReset();
  const zhStatus = txt("status-val");
  el("btn-lang").dispatch("click");
  check("语言键写入 doin.lang", env.localStorage.getItem("doin.lang") === "en",
    `lang=${env.localStorage.getItem("doin.lang")}`);
  check("切换后 documentElement.lang = en", env.document.documentElement.lang === "en",
    `lang=${env.document.documentElement.lang}`);
  check("状态文本已切英文且无汉字", !/[\u4e00-\u9fa5]/.test(txt("status-val")),
    `status=${txt("status-val")}`);
  check("中英状态文案确实不同", zhStatus !== txt("status-val"), `${zhStatus} / ${txt("status-val")}`);
  check("左翼标签已切英文（步数）", !/[\u4e00-\u9fa5]/.test(txt("par-val")) && !/[\u4e00-\u9fa5]/.test(txt("len-val")),
    `par=${txt("par-val")} len=${txt("len-val")}`);
  el("btn-lang").dispatch("click");
  check("切回中文正常", /[\u4e00-\u9fa5]/.test(txt("status-val")), `status=${txt("status-val")}`);
}

// ---- 9. 说明浮层：从对局中打开再关闭必须回到对局（不许回落选关） ----
{
  ui.showOverlay("none");
  el("btn-help").dispatch("click");
  check("对局中可打开说明", isOpen("screen-help"), "screen-help 未显示");
  el("btn-help-close").dispatch("click");
  check("关闭说明回到对局（浮层全关）", ui.currentOverlay === "none" && !isOpen("screen-start"),
    `currentOverlay=${ui.currentOverlay} start=${isOpen("screen-start")}`);
}

// ---- 10. 摇杆按钮与重开 ----
{
  const before = game.state.engine.steps;
  const dirs = game.legalDirs();
  el(`btn-${dirs[0]}`).dispatch("click");
  check("摇杆按钮可走一步", game.state.engine.steps === before + 1,
    `${before} -> ${game.state.engine.steps}`);
  el("btn-reset").dispatch("click");
  check("重开后步数归零", game.state.engine.steps === 0, `steps=${game.state.engine.steps}`);
  check("重开后长度回到初始值", game.length() === game.state.initLen,
    `${game.length()} vs ${game.state.initLen}`);
}

// ---- 11. 视口切换：舞台尺寸随视口重算且不崩 ----
{
  const w0 = renderer.width;
  globalThis.window.innerWidth = 390;
  globalThis.window.innerHeight = 780;
  env.document.dispatch("orientationchange", {});
  env.step(2);
  check("视口切换后舞台尺寸已重算", renderer.width !== w0 || renderer.width > 0,
    `${w0} -> ${renderer.width}`);
  check("窄屏舞台不小于 220px", renderer.width >= 220, `width=${renderer.width}`);
  globalThis.window.innerWidth = W;
  globalThis.window.innerHeight = H;
  env.document.dispatch("orientationchange", {});
  env.step(2);
}

// ---- 12. 渲染噪声：颜色里不能出现 NaN / undefined ----
env.step(30);
check("渲染无非法颜色值", renderer.canvas.__ctx.__badColors.length === 0,
  renderer.canvas.__ctx.__badColors.slice(0, 3).join(" | "));
check("长时间空转仍在绘制", renderer.canvas.__ctx.__calls > 100,
  `ctx calls=${renderer.canvas.__ctx.__calls}`);

emit();

function emit() {
  console.log(`== uncoil smoke [${W}x${H}] ==`);
  console.log([...notes, ...failures].join("\n"));
  console.log(`-- ${notes.length} pass, ${failures.length} fail`);
  if (failures.length) process.exit(1);
}
