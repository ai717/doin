// smoke.test.mjs - boots the real main.mjs against a stub DOM parsed from the
// real index.html. This is the only test that proves the wiring exists:
// pointer -> controller -> engine -> overlay -> storage -> portal handshake.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createDocument, createWindow, installGlobals } from "./dom-stub.mjs";
import { strings } from "../js/i18n.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const doc = createDocument({ html });
const win = createWindow(doc);
const restore = installGlobals(doc, win);

const { boot } = await import("../js/main.mjs");
const api = win.__thief;

function byId(id) {
  return doc.getElementById(id);
}

function stagePoint(node, x, y) {
  node.dispatch("pointerdown", { clientX: x, clientY: y, pointerId: 1 });
}

test("装配: main.mjs 自举出调试句柄，开局停在第 1 关", () => {
  assert.ok(api, "缺 window.__thief 调试句柄");
  assert.equal(typeof boot, "function");
  assert.equal(api.game.level.id, 1);
  assert.equal(api.snapshot.phase, "aim");
  assert.equal(api.renderer.ctx.calls > 0, true, "首帧应已经画过");
  assert.equal(win.pendingFrames() > 0, true, "主循环应已排下一帧");
});

test("装配: 主循环可以连续推帧而不抛错", () => {
  assert.ok(win.step(6) >= 1);
  assert.ok(api.renderer.ctx.calls > 0);
});

test("指针: 画布上的拖动驱动手掌移动", () => {
  const canvas = byId("stage");
  const before = { ...api.snapshot.hand };
  stagePoint(canvas, before.x, before.y);
  canvas.dispatch("pointermove", { clientX: before.x + 40, clientY: before.y - 24, pointerId: 1 });
  const moved = api.snapshot.hand;
  assert.ok(Math.abs(moved.x - (before.x + 40)) < 1e-6);
  assert.ok(Math.abs(moved.y - (before.y - 24)) < 1e-6);
  canvas.dispatch("pointerup", { pointerId: 1 });
  assert.equal(api.snapshot.dragging, false);
});

test("暂停: P 键暂停，暂停层显形，再按继续", () => {
  win.dispatch("keydown", { key: "p" });
  assert.equal(api.snapshot.paused, true);
  assert.equal(byId("pause-layer").hidden, false);
  win.dispatch("keydown", { key: "p" });
  assert.equal(api.snapshot.paused, false);
  assert.equal(byId("pause-layer").hidden, true);
});

test("暂停: R 键重开，手臂与臂展归零", () => {
  const hand = api.snapshot.hand;
  api.game.pointerDown(hand);
  api.game.pointerMove({ x: hand.x + 60, y: hand.y });
  api.game.pointerUp();
  assert.ok(api.snapshot.travelled > 0);
  win.dispatch("keydown", { key: "r" });
  assert.equal(api.snapshot.travelled, 0);
  assert.deepEqual(api.snapshot.hand, api.game.level.handStart);
});

test("通关: 走完作者路线，结算弹窗与战利品架同时更新", () => {
  for (const waypoint of api.game.level.solution) {
    const hand = api.snapshot.hand;
    api.game.pointerDown(hand);
    api.game.pointerMove(waypoint);
    api.game.pointerUp();
    if (api.snapshot.phase !== "aim") break;
  }
  assert.equal(api.snapshot.phase, "retract");
  for (let i = 0; i < 400 && api.snapshot.phase === "retract"; i += 1) api.game.tick(1 / 60);
  assert.equal(api.snapshot.phase, "won");
  assert.equal(byId("result").hidden, false, "结算弹窗应显形");
  assert.match(byId("result-stars").textContent, /^[★☆]{3}$/);
  assert.ok(Number(byId("result-travel").textContent) > 0);

  const shelf = byId("loot-shelf");
  assert.equal(shelf.children.length, 1, "战利品架上应出现第 1 件藏品");
  assert.ok(shelf.children[0].textContent.length > 0, "藏品应有图标");

  const meta = JSON.parse(globalThis.localStorage.getItem("doin.meta.v1"));
  assert.deepEqual(meta.recentlyPlayed, ["thief"]);
  assert.ok(meta.totalStars >= 1);
});

function gridCells() {
  return byId("level-grid").children.filter((child) => String(child.className).includes("level-cell"));
}

test("关卡抽屉: 20 格分 5 卷渲染，锁定格不可点", () => {
  byId("btn-levels").dispatch("click");
  assert.equal(byId("drawer").hidden, false);
  const heads = byId("level-grid").children.filter((child) => String(child.className).includes("grid-chapter"));
  assert.equal(heads.length, 5, "应按 5 卷分组");
  assert.ok(heads[0].textContent.includes(strings.zh.chapter1));
  const cells = gridCells();
  assert.equal(cells.length, 20);
  assert.equal(cells[0].disabled, false);
  assert.equal(cells[1].disabled, false, "刚通关第 1 关，第 2 关应已解锁");
  assert.equal(cells[2].disabled, true, "第 3 关未解锁");
  assert.equal(cells[2].dataset.locked, "true");
  byId("btn-drawer-close").dispatch("click");
  assert.equal(byId("drawer").hidden, true);
});

test("关卡抽屉: 已通关的关卡可以点进去", () => {
  byId("btn-levels").dispatch("click");
  gridCells()[1].dispatch("click");
  assert.equal(api.game.level.id, 2);
  assert.equal(byId("drawer").hidden, true, "选关后抽屉应自动收起");
  assert.equal(api.snapshot.phase, "aim");
});

test("语言: 切换按钮把整页文案换成英文再换回来", () => {
  const zhLabel = byId("btn-levels").textContent;
  byId("btn-lang").dispatch("click");
  assert.equal(doc.documentElement.lang, "en");
  assert.equal(byId("btn-levels").textContent, strings.en.btnLevels);
  assert.equal(byId("app-title").textContent, strings.en.appTitle);
  byId("btn-lang").dispatch("click");
  assert.equal(doc.documentElement.lang, "zh-CN");
  assert.equal(byId("btn-levels").textContent, zhLabel);
});

test("音效: 开关按钮翻转图标并落库", () => {
  const button = byId("btn-sound");
  const first = button.textContent;
  byId("btn-sound").dispatch("click");
  assert.notEqual(button.textContent, first);
  byId("btn-sound").dispatch("click");
  assert.equal(button.textContent, first);
});

test("帮助: 手册可以开关，Esc 只关最上层", () => {
  byId("btn-help").dispatch("click");
  assert.equal(byId("help").hidden, false);
  win.dispatch("keydown", { key: "Escape" });
  assert.equal(byId("help").hidden, true);
  assert.equal(api.snapshot.paused, false, "关帮助不应顺带暂停");
});

test("失败: 撞上激光会弹出提示并自动重开", () => {
  api.game.start(5);
  const level = api.game.level;
  assert.ok(level.lasers.length > 0, "第 5 关应有激光");
  const hand = api.snapshot.hand;
  api.game.pointerDown(hand);
  api.game.pointerMove({ x: level.target.x, y: level.target.y });
  api.game.pointerUp();
  assert.equal(api.snapshot.phase, "shock");
  assert.equal(api.snapshot.failure.kind, "laser");
  assert.equal(byId("toast").hidden, false);
  for (let i = 0; i < 120 && api.snapshot.phase === "shock"; i += 1) api.game.tick(1 / 60);
  assert.equal(api.snapshot.phase, "aim");
});

test("收尾: 卸载全局桩，别污染其它测试", () => {
  restore();
  assert.equal(globalThis.document, undefined);
});
