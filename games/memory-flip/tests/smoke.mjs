// smoke.mjs — 无浏览器冒烟测试
// 范式：直接驱动 createUI，断言业务可观测量推进（mode/status/faceUp/misses）
// 不依赖 render.mjs 的 DOM 输出（render 走 innerHTML 字符串，桩不解析）
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "./dom-stub.mjs";
import { createUI } from "../js/ui.mjs";
import { flipAt, isLevelUnlocked } from "../js/game.mjs";
import { LEVELS } from "../js/levels.mjs";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");

let env;
let ui;

describe("smoke: 装配与控制器推进", () => {
  before(() => {
    env = installDom(HTML);
    const root = env.document.getElementById("game-root");
    ui = createUI(root);
  });

  after(() => {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.navigator;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
    delete globalThis.location;
  });

  it("createUI 初始 mode=menu 且 controller 就绪", () => {
    assert.equal(ui.mode, "menu");
    assert.ok(ui.controller, "controller 存在");
    assert.ok(ui.storage, "storage 加载成功");
  });

  it("startCampaign 切到 campaign 模式并开局", () => {
    ui.startCampaign("level_1_1");
    assert.equal(ui.mode, "campaign");
    assert.ok(ui.controller.state, "state 已创建");
    assert.equal(ui.controller.state.status, "playing");
    assert.ok(ui.controller.level, "level 已绑定");
  });

  it("flipAt 翻开第一张牌（faceUp 推进）", () => {
    const s = ui.controller.state;
    // 找一个非空位翻开
    let idx = -1;
    for (let i = 0; i < s.grid.length; i += 1) {
      if (s.grid[i] !== null) { idx = i; break; }
    }
    assert.ok(idx >= 0, "盘面有非空位");
    const before = s.faceUp[idx];
    const r = flipAt(ui.controller, idx);
    assert.equal(r.action, "flip-one");
    assert.equal(s.faceUp[idx], true, "翻开后 faceUp=true");
    assert.notEqual(s.faceUp[idx], before);
  });

  it("flipAt 同一张牌再翻 = 取消", () => {
    // 新建一局确保 flipped 为空
    ui.startCampaign("level_1_1");
    const s = ui.controller.state;
    let idx = -1;
    for (let i = 0; i < s.grid.length; i += 1) {
      if (s.grid[i] !== null && !s.faceUp[i]) { idx = i; break; }
    }
    const r1 = flipAt(ui.controller, idx);
    assert.equal(r1.action, "flip-one");
    assert.equal(s.faceUp[idx], true);
    assert.equal(s.flipped.length, 1);
    // 再翻同一张 = 取消
    const r2 = flipAt(ui.controller, idx);
    assert.equal(r2.action, "cancel");
    assert.equal(s.faceUp[idx], false, "取消后盖回");
    assert.equal(s.flipped.length, 0);
  });

  it("startDaily 切到 daily 模式", () => {
    ui.startDailyRun();
    assert.equal(ui.mode, "daily");
    assert.equal(ui.controller.mode, "daily");
    assert.equal(ui.controller.state.status, "playing");
  });

  it("startSandbox 切到 sandbox 模式且自定盘面生效", () => {
    // 用偶数盘面（UI select 已过滤奇数组合，测试模拟合法路径）
    ui.startSandboxRun({ rows: 6, cols: 6, mech: "ring8", seed: 42 });
    assert.equal(ui.mode, "sandbox");
    assert.equal(ui.controller.mode, "sandbox");
    assert.equal(ui.controller.state.rows, 6);
    assert.equal(ui.controller.state.cols, 6);
    assert.equal(ui.controller.state.mech, "ring8");
  });

  it("setLocale 不触发 location.reload（热更新铁律）", () => {
    globalThis.__reloaded = false;
    ui.setLocale("en");
    assert.equal(ui.locale, "en");
    assert.equal(globalThis.__reloaded, false, "严禁 location.reload");
    // 切回 zh 保持一致
    ui.setLocale("zh");
    assert.equal(ui.locale, "zh");
  });

  it("setLocale 不重置当前游戏状态（语言切换零副作用）", () => {
    ui.startCampaign("level_2_1");
    const s = ui.controller.state;
    const beforeMisses = s.misses;
    // 翻一张牌制造"进行中"状态
    let idx = -1;
    for (let i = 0; i < s.grid.length; i += 1) {
      if (s.grid[i] !== null && !s.faceUp[i]) { idx = i; break; }
    }
    flipAt(ui.controller, idx);
    const afterFlip = [...s.faceUp];
    // 切语言
    ui.setLocale("en");
    ui.setLocale("zh");
    // 状态毫秒不差原样保持
    assert.equal(ui.controller.state.misses, beforeMisses);
    assert.deepEqual([...ui.controller.state.faceUp], afterFlip);
  });

  it("初始仅第 1 章第 1 关解锁", () => {
    assert.equal(isLevelUnlocked(ui.storage, "level_1_1"), true);
    assert.equal(isLevelUnlocked(ui.storage, "level_2_1"), false);
  });
});
