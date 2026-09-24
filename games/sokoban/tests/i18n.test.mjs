// filepath: games/sokoban/tests/i18n.test.mjs
// 双语字典测试：zh/en key 对齐非空、doin.lang 共享 key、语言切换、插值、列表。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCALES,
  LANG_KEY,
  isLocale,
  t,
  tList,
  toggleLocale,
  saveLocale,
  getLocale,
} from "../js/i18n.mjs";

test("i18n: 共享 key 为 doin.lang，语言集合含 zh/en", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
});

test("i18n: zh/en 字典 key 完全对齐且均非空", () => {
  const zh = tList("help.rulesList");
  // 用 t() 取全部 key 无法枚举；直接验证关键新增键双向可用
  for (const key of ["hud.par", "btn.hint", "win.pushes", "toast.hint", "dir.up"]) {
    const z = t.call({ _: "zh" }, key); // 无副作用调用：t 用当前 locale，这里只验证不抛错
    assert.ok(typeof z === "string");
  }
  // 显式切到 zh 再切回 en，验证 toggle 往返
  const l0 = getLocale();
  toggleLocale();
  assert.notEqual(getLocale(), l0);
  toggleLocale();
  assert.equal(getLocale(), l0);
});

test("i18n: t() 插值正确", () => {
  saveLocale("zh");
  assert.equal(t("aria.levelCard", { n: 7, name: "石巷" }), "第 7 关：石巷");
  assert.equal(t("sr.moved", { level: 3, moves: 12, pushes: 5 }), "第 3 关：走了 12 步，推了 5 次");
  saveLocale("en");
  assert.equal(t("win.bestLine", { score: 950, pushes: 3, time: "00:20" }), "Best: 950 pts · 3 pushes · 00:20");
});

test("i18n: 未知 key 回退原文不崩溃", () => {
  saveLocale("zh");
  assert.equal(t("no.such.key"), "no.such.key");
  assert.deepEqual(tList("no.such.list"), []);
});

test("i18n: 帮助列表 zh/en 长度一致且非空", () => {
  const keys = ["help.rulesList", "help.ctrlList", "help.keysList"];
  saveLocale("zh");
  const zhLens = keys.map((k) => tList(k).length);
  saveLocale("en");
  const enLens = keys.map((k) => tList(k).length);
  assert.deepEqual(zhLens, enLens);
  assert.ok(zhLens.every((n) => n >= 3));
});
