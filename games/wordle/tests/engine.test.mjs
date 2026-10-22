// engine.test.mjs —— 反馈算法（含重复字配额）、日期种子、回合状态机、键盘合并。
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";
import { EN_ANSWERS, CN_IDIOMS } from "../js/wordlists.mjs";

const F = { c: E.FB.CORRECT, p: E.FB.PRESENT, a: E.FB.ABSENT };
const j = (g, ans) => E.judge([...g], [...ans]);
const sig = (fb) => fb.map((x) => (x === F.c ? "c" : x === F.p ? "p" : "a")).join("");

test("judge：全对 / 全错 / 部分位置反馈", () => {
  assert.equal(sig(j("sauce", "sauce")), "ccccc");
  assert.equal(sig(j("crate", "sauce")), "papac");
  assert.equal(sig(j("sauce", "crate")), "apapc");
});

test("judge：重复字配额制（经典 Wordle 语义）", () => {
  // guess=allee answer=eager：e 在位 3 正确，余下一个未配对 e 只报一个 present
  assert.equal(sig(j("allee", "eager")), "paacp");
  assert.equal(sig(j("speed", "eager")), "aapca");
  // 多余的重复字不得虚报
  assert.equal(sig(j("geese", "eager")), "pppaa");
  assert.equal(sig(j("broom", "mimic")), "aaaap");
});

test("judge：中文成语同规则", () => {
  assert.equal(sig(j("一心一意", "一心一意")), "cccc");
  assert.equal(sig(j("一心一德", "一心一意")), "ccca");
  // 重复字配额：「人山人海」vs「海人海人」：无一位相同，但 人/海 各报两个 present
  assert.equal(sig(j("人山人海", "海人海人")), "papp");
});

test("judge：guess/answer 长度必须一致", () => {
  assert.notEqual(sig(j("abcde", "abcd")), "ccccc");
});

test("dayKey/prevDay/issueNo：东八区日历日", () => {
  assert.equal(E.dayKeyOf(new Date("2026-10-18T10:00:00Z")), "20261018");
  assert.equal(E.dayKeyOf(new Date("2026-10-18T16:00:00Z")), "20261019"); // UTC 16:00 = 东八次日 0 点
  assert.equal(E.prevDayKey("20260101"), "20251231");
  assert.equal(E.prevDayKey("20260301"), "20260228"); // 非闰年
  assert.equal(E.prevDayKey("20260102"), "20260101");
  assert.equal(E.issueNoOf("20260101"), 1);
  assert.equal(E.issueNoOf("20261018"), 291);
});

test("pickDaily：同日稳定、跨轨独立、覆盖率合理", () => {
  const a = E.pickDaily(EN_ANSWERS, "20261018");
  assert.equal(a, E.pickDaily(EN_ANSWERS, "20261018"));
  assert.ok(EN_ANSWERS.includes(a));
  const c = E.pickDaily(CN_IDIOMS, "20261018");
  assert.ok(CN_IDIOMS.includes(c));
  // 自 2026-01-01 起 300 天种子分布至少命中 200 个不同词（防退化映射）
  const picks = new Set();
  for (let i = 0; i < 300; i++) {
    const t = new Date(Date.UTC(2026, 0, 1) + i * 86400e3);
    const key = t.toISOString().slice(0, 10).replaceAll("-", "");
    picks.add(E.pickDaily(EN_ANSWERS, key));
  }
  assert.ok(picks.size >= 200, `300 天仅命中 ${picks.size} 词`);
});

test("createRound/typeChar/backspace：草稿与拒绝规则", () => {
  const r = E.createRound({ track: "en", answer: "crate" });
  assert.equal(r.length, 5);
  assert.ok(E.typeChar(r, "c") && E.typeChar(r, "r"));
  assert.deepEqual(r.draft, ["c", "r"]);
  assert.ok(E.backspace(r));
  assert.deepEqual(r.draft, ["c"]);
  assert.equal(E.typeChar(r, "1"), false); // EN 轨拒绝非字母
  assert.equal(E.typeChar(r, "A"), false); // 拒绝大写
  assert.equal(E.typeChar(r, "ab"), false); // 拒绝多字符
  for (let i = 0; i < 5; i++) E.typeChar(r, "a");
  assert.equal(E.typeChar(r, "a"), false); // 满行拒绝
});

test("submit：不在库/未满行返回 null 且不消耗机会", () => {
  const r = E.createRound({ track: "en", answer: "crate" });
  for (const c of "qzqzq") E.typeChar(r, c);
  const res = E.submit(r);
  assert.equal(res, null);
  assert.equal(r.rows.length, 0);
  assert.equal(r.draft.length, 5, "非法词保留草稿供修改");
  for (let i = 0; i < 5; i++) E.backspace(r);
  for (const c of "cra") E.typeChar(r, c);
  assert.equal(E.submit(r), null);
  for (const c of "ne") E.typeChar(r, c);
  const res2 = E.submit(r);
  assert.equal(res2.rowIndex, 0);
  assert.equal(r.rows.length, 1);
});

test("submit：终局转移与终局后 no-op", () => {
  const r = E.createRound({ track: "en", answer: "crate" });
  for (const c of "crate") E.typeChar(r, c);
  assert.equal(E.submit(r).status, E.STATUS.WON);
  assert.equal(r.status, E.STATUS.WON);
  assert.equal(E.submit(r), null);
  assert.equal(E.typeChar(r, "a"), false);
  assert.equal(E.backspace(r), false);

  const r2 = E.createRound({ track: "en", answer: "crate" });
  for (let row = 0; row < 7; row++) {
    for (const c of "sauce") E.typeChar(r2, c);
    const s = E.submit(r2);
    if (row < 6) assert.equal(s.status, E.STATUS.PLAYING);
    else assert.equal(s.status, E.STATUS.LOST);
  }
  assert.equal(r2.rows.length, 7);
  assert.equal(E.chancesLeft(r2), 0);
});

test("useHint：每局一次、揭示未命中字符、终局/全绿不可用、重放可恢复", () => {
  const r = E.createRound({ track: "en", answer: "crate" });
  for (const c of "sauce") E.typeChar(r, c); // e 已命中（correct）
  E.submit(r);
  const ch = E.useHint(r);
  assert.ok(E.FB && ch !== null && "crate".includes(ch) && ch !== "e", `揭示 ${ch} 属于答案且未命中`);
  assert.equal(E.useHint(r), null, "已用过的局提示返回 null");
  // 重放恢复
  const r2 = E.replayRound({ track: "en", answer: "crate", guesses: ["sauce"], hint: ch });
  assert.equal(r2.hint, ch);
  // 全绿：无未命中字符可揭
  const r3 = E.createRound({ track: "en", answer: "crate" });
  for (const c of "crate") E.typeChar(r3, c);
  E.submit(r3);
  assert.equal(E.useHint(r3), null);
  // 终局后不可用
  const r4 = E.createRound({ track: "en", answer: "crate" });
  for (let row = 0; row < 7; row++) {
    for (const c of "sauce") E.typeChar(r4, c);
    E.submit(r4);
  }
  assert.equal(E.useHint(r4), null);
});

test("keyStates：多回合合并取最高优先级（correct > present > absent）", () => {
  const r1 = E.createRound({ track: "en", answer: "crate" });
  for (const c of "sauce") E.typeChar(r1, c); // a=absent? sauce vs crate: a present, s/u absent, c present, e correct
  E.submit(r1);
  const ks = E.keyStates([r1]);
  assert.equal(ks.get("e"), 3); // correct
  assert.equal(ks.get("a"), 2); // present
  assert.equal(ks.get("s"), 1); // absent
  assert.equal(ks.has("z"), false);
});

test("replayRound：从词列确定性重建（存档恢复契约）", () => {
  const answer = "crate";
  const r = E.replayRound({ track: "en", answer, guesses: ["sauce", "spite", "crate"] });
  assert.equal(r.rows.length, 3);
  assert.equal(r.status, E.STATUS.WON);
  assert.deepEqual(r.rows[0].guess, [..."sauce"]);
  const r2 = E.replayRound({ track: "en", answer, guesses: [] });
  assert.equal(r2.rows.length, 0);
});

test("随机答案可注入种子复现", () => {
  assert.equal(E.randomAnswer("en", 12345), E.randomAnswer("en", 12345));
  assert.ok(EN_ANSWERS.includes(E.randomAnswer("en", 1)));
  assert.ok(CN_IDIOMS.includes(E.randomAnswer("cn", 1)));
});

test("hashString/mulberry32：确定性且分布非退化", () => {
  assert.equal(E.hashString("20261018"), E.hashString("20261018"));
  const next = E.mulberry32(42);
  const vals = new Set(Array.from({ length: 100 }, () => next()));
  assert.equal(vals.size, 100);
});
