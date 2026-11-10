import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { installGlobals } from "./dom-stub.mjs";

const gameDir = resolve(import.meta.dirname, "..");

function bodyMarkup() {
  const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
  const start = html.indexOf("<body>") + 6;
  const end = html.lastIndexOf("</body>");
  return html
    .slice(start, end)
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/g, "");
}

test("端到端冒烟：真标记 + 真控制器走完一局", async (t) => {
  const env = installGlobals(bodyMarkup());
  t.after(() => env.restore());

  await import("../js/main.mjs");

  const api = globalThis.window.__detective;
  assert.ok(api, "应挂载 window.__detective 调试句柄");
  assert.equal(api.snapshot.caseId, 1, "即开即玩：直接落在第 1 案");

  const cards = env.byId("lineup").children;
  assert.equal(cards.length, 3, "第 1 案应有 3 张嫌疑人卡");
  assert.ok(cards[0].querySelector(".role").textContent.length > 0);
  assert.ok(cards[0].querySelector(".claim").textContent.length > 0);

  const tags = env.byId("evidence-rail").children;
  assert.equal(tags.length, 8, "第 1 案应有 8 件物证");

  assert.equal(env.byId("seal-btn").disabled, true, "未填齐时印章不可按");
  assert.equal(env.byId("case-no").textContent, "案卷 #01");

  // ---- 落印：先点清白，再换凶手印章 ----------------------------------
  const guiltyIndex = 0;
  cards[guiltyIndex].dispatch("click");
  assert.equal(api.snapshot.stamps.butler, "clear", "默认执起的是清白印章");
  assert.equal(cards[guiltyIndex].dataset.stamp, "clear");
  assert.equal(cards[guiltyIndex].querySelector(".stamp-badge").textContent, "清白");

  for (const index of [1, 2]) cards[index].dispatch("click");
  assert.equal(api.snapshot.cleared, 3);

  const guiltyTool = env.document.querySelectorAll(".stamp-tool").find((node) => node.dataset.stamp === "guilty");
  guiltyTool.dispatch("click");
  assert.equal(api.ui.heldStamp, "guilty");
  assert.match(env.byId("tray-hint").textContent, /真凶/);

  cards[guiltyIndex].dispatch("click");
  assert.equal(api.snapshot.stamps.butler, "guilty");
  assert.equal(api.snapshot.cleared, 2, "指认凶手会占掉一张清白");

  // ---- 判词：凶器与关键证据 ------------------------------------------
  env.byId("slot-weapon").dispatch("click");
  assert.equal(env.byId("picker").hidden, false, "点凶器槽应弹出选择器");
  const weaponButton = env.byId("picker-list").children.find((node) => node.dataset.id === "letter_opener");
  assert.ok(weaponButton, "凶器列表应包含黄铜拆信刀");
  weaponButton.dispatch("click");
  assert.equal(api.snapshot.weapon, "letter_opener");
  assert.equal(env.byId("picker").hidden, true, "选完自动收起");

  env.byId("slot-clue").dispatch("click");
  const clueButton = env.byId("picker-list").children.find((node) => node.dataset.id === "bent_tip");
  assert.ok(clueButton, "证据列表应包含弯折的刀尖");
  clueButton.dispatch("click");
  assert.equal(api.snapshot.clue, "bent_tip");
  assert.equal(env.byId("seal-btn").disabled, false, "三项齐备后印章应亮起");

  // ---- 结案 ----------------------------------------------------------
  env.byId("seal-btn").dispatch("click");
  assert.equal(api.snapshot.sealed, true);
  assert.equal(env.byId("result").hidden, false, "结案应弹出结案公告书");
  assert.equal(env.byId("result-rank").textContent, "传奇神探");
  assert.equal(env.byId("case-flag").textContent, "已结案");
  assert.equal(env.localStorage.getItem("doin.detective.v1") !== null, true, "战绩应写入存档");

  // ---- 语言热切换：文案变英文，盘面原样保留 ---------------------------
  const before = JSON.stringify(api.snapshot.stamps);
  api.actions.toggleLocale();
  assert.equal(env.document.documentElement.lang, "en");
  assert.equal(env.byId("app-title").textContent, "Detective Deduction");
  assert.equal(env.byId("lineup").children[0].querySelector(".role").textContent, "Butler");
  assert.equal(JSON.stringify(api.snapshot.stamps), before, "切语言绝不重置盘面");
  assert.equal(api.snapshot.sealed, true, "已结案状态也不被重置");
  assert.equal(env.localStorage.getItem("doin.lang"), "en");

  api.actions.toggleLocale();
  assert.equal(env.document.documentElement.lang, "zh-CN");
});

test("冒烟：暂停层、快捷键与失焦自动暂停都在真实标记上生效", async (t) => {
  const env = installGlobals(bodyMarkup());
  t.after(() => env.restore());
  (await import("../js/storage.mjs")).resetBackendForTests();
  await import("../js/main.mjs?pause");

  const api = globalThis.window.__detective;
  assert.equal(env.byId("pause").hidden, true, "默认不该有暂停遮罩");

  env.document.dispatchEvent({ type: "keydown", key: "p" });
  assert.equal(api.snapshot.paused, true);
  assert.equal(env.byId("pause").hidden, false, "按 P 应抬起暂停遮罩");
  assert.equal(env.byId("btn-pause").textContent, "▶");

  env.document.dispatchEvent({ type: "keydown", key: "p" });
  assert.equal(api.snapshot.paused, false);
  assert.equal(env.byId("pause").hidden, true);

  api.game.tick(300);
  const elapsed = api.snapshot.elapsed;
  assert.ok(elapsed > 0);
  env.window.dispatch("blur");
  assert.equal(api.snapshot.paused, true, "失焦必须自动暂停");
  api.game.tick(300);
  assert.equal(api.snapshot.elapsed, elapsed, "暂停期间时钟不前进");

  env.document.dispatchEvent({ type: "pointerdown" });
  assert.equal(api.snapshot.paused, false, "回到页面动手即恢复");

  env.document.dispatchEvent({ type: "keydown", key: "r" });
  assert.equal(api.snapshot.elapsed, 0, "R 重置本案");
});

test("冒烟：卷宗抽屉列出 12 案，未解锁的格点不可用", async (t) => {
  const env = installGlobals(bodyMarkup());
  t.after(() => env.restore());
  (await import("../js/storage.mjs")).resetBackendForTests();
  await import("../js/main.mjs?drawer");

  env.byId("btn-cases").dispatch("click");
  assert.equal(env.byId("drawer").hidden, false);
  const groups = env.byId("case-groups").children;
  assert.equal(groups.length, 3, "应按三卷分组");
  const cells = env.byId("case-groups").querySelectorAll(".case-cell");
  assert.equal(cells.length, 12);
  assert.equal(cells[0].disabled, false);
  assert.equal(cells[1].disabled, true, "第 2 案尚未解锁");
  assert.equal(cells[1].dataset.state, "locked");

  env.byId("drawer-close").dispatch("click");
  assert.equal(env.byId("drawer").hidden, true);
});

test("冒烟：物证检验能打开并直接设为关键证据", async (t) => {
  const env = installGlobals(bodyMarkup());
  t.after(() => env.restore());
  (await import("../js/storage.mjs")).resetBackendForTests();
  await import("../js/main.mjs?inspect");

  const tag = env.byId("evidence-rail").children.find((node) => node.dataset.evidence === "bent_tip");
  tag.dispatch("click");
  assert.equal(env.byId("inspector").hidden, false);
  assert.equal(env.byId("inspect-title").textContent, "弯折的刀尖");
  assert.match(env.byId("inspect-body").textContent, /拆信刀/);

  env.byId("inspect-pick").dispatch("click");
  assert.equal(globalThis.window.__detective.snapshot.clue, "bent_tip");
  assert.equal(env.byId("inspector").hidden, true);
});
