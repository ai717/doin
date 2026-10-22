// wordlist.test.mjs —— 词库数据不变量：格式、去重、可解性（答案字符 ⊆ 字盘）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { EN_ANSWERS, EN_EXTRA, CN_IDIOMS, CN_EXTRA, CN_TRAY } from "../js/wordlists.mjs";

test("EN 答案与扩展词均为 5 字母小写", () => {
  for (const w of [...EN_ANSWERS, ...EN_EXTRA]) assert.match(w, /^[a-z]{5}$/, w);
});

test("EN 答案与扩展词各自去重且互斥", () => {
  assert.equal(new Set(EN_ANSWERS).size, EN_ANSWERS.length);
  assert.equal(new Set(EN_EXTRA).size, EN_EXTRA.length);
  assert.equal(EN_ANSWERS.filter((w) => EN_EXTRA.includes(w)).length, 0);
});

test("CN 成语均为四字且去重", () => {
  for (const w of CN_IDIOMS) assert.equal([...w].length, 4, w);
  assert.equal(new Set(CN_IDIOMS).size, CN_IDIOMS.length);
});

test("CN 扩展词为四字、去重且不与答案重叠", () => {
  for (const w of CN_EXTRA) assert.equal([...w].length, 4, w);
  assert.equal(new Set(CN_EXTRA).size, CN_EXTRA.length);
  assert.equal(CN_EXTRA.filter((w) => CN_IDIOMS.includes(w)).length, 0);
});

test("可解性不变量：每个 CN 答案/扩展词的全部字符都在字盘内", () => {
  const tray = new Set([...CN_TRAY]);
  for (const w of CN_IDIOMS) for (const ch of w) assert.ok(tray.has(ch), `答案 ${w} 含字盘外字符 ${ch}`);
  for (const w of CN_EXTRA) for (const ch of w) assert.ok(tray.has(ch), `扩展词 ${w} 含字盘外字符 ${ch}`);
});

test("字盘无废键：每个字盘字符都属于某候选词", () => {
  const used = new Set([...CN_IDIOMS.join(""), ...CN_EXTRA.join("")]);
  for (const ch of CN_TRAY) assert.ok(used.has(ch), `字盘字符 ${ch} 不属于任何候选词`);
});

test("字盘本身无重复字符且规模合理", () => {
  assert.equal(new Set([...CN_TRAY]).size, CN_TRAY.length);
  assert.ok(CN_TRAY.length >= 250 && CN_TRAY.length <= 1200, `tray=${CN_TRAY.length}`);
});

test("词库规模达到策划案门槛（EN ≥1200 答案，CN ≥240 答案）", () => {
  assert.ok(EN_ANSWERS.length >= 1200, `EN=${EN_ANSWERS.length}`);
  assert.ok(CN_IDIOMS.length >= 240, `CN=${CN_IDIOMS.length}`);
});
