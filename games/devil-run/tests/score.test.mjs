// 恶魔迷途 · 计分/评价层测试
// 本作没有分数，评价体系是「恶魔印章」。这一层是界面唯一可信的印章口径。

import test from "node:test";
import assert from "node:assert/strict";

import {
  SEAL_KEYS,
  SEALS_PER_LEVEL,
  emptySeals,
  sealsFromState,
  countSeals,
  isLevelPerfect,
  mergeSeals,
  hasNewSeal,
  nodeTally,
  overallTally,
  levelLabel,
  clock,
  isNewBestTime
} from "../js/score.mjs";
import { createInitialState } from "../js/engine.mjs";
import { getLevel, LEVEL_COUNT, NODES } from "../js/levels.mjs";

// ---------------------------------------------------------------- 基本契约

test("印章体系为三枚（通关 / 蜡烛 / 无伤）", () => {
  assert.deepEqual([...SEAL_KEYS], ["clear", "candle", "flawless"]);
  assert.equal(SEALS_PER_LEVEL, 3);
  assert.deepEqual(emptySeals(), { clear: false, candle: false, flawless: false });
});

test("emptySeals 每次返回新对象（避免共享引用被污染）", () => {
  const a = emptySeals();
  const b = emptySeals();
  a.clear = true;
  assert.equal(b.clear, false, "两枚印章对象不应共享引用");
});

// ---------------------------------------------------------------- 状态推导

test("未通关（cleared 为假）推不出任何印章", () => {
  const s = createInitialState(getLevel(0));
  s.cleared = false;
  s.status = "playing";
  s.gotCandle = true;         // 就算拿了蜡烛
  s.stats.deathsThisRun = 0;  // 就算没死
  const seals = sealsFromState(s);
  assert.equal(countSeals(seals), 0, "未通关不应产生印章");
});

test("通关印以 cleared 为准；拿了蜡烛且零死则三印全亮", () => {
  const s = createInitialState(getLevel(0));
  s.cleared = true;
  s.gotCandle = true;
  s.stats.deathsThisRun = 0;
  const seals = sealsFromState(s);
  assert.deepEqual(seals, { clear: true, candle: true, flawless: true });
});

test("通关 + 零死亡 + 拿蜡烛 → 三印全亮", () => {
  const s = createInitialState(getLevel(0));
  s.status = "won";
  s.cleared = true;
  s.gotCandle = true;
  s.stats.deathsThisRun = 0;
  const seals = sealsFromState(s);
  assert.deepEqual(seals, { clear: true, candle: true, flawless: true });
  assert.equal(countSeals(seals), 3);
  assert.equal(isLevelPerfect(seals), true);
});

test("通关但死亡过 → 无伤印不亮（蜡烛印仍可亮）", () => {
  const s = createInitialState(getLevel(0));
  s.status = "won";
  s.cleared = true;
  s.gotCandle = true;
  s.stats.deathsThisRun = 2;
  const seals = sealsFromState(s);
  assert.equal(seals.clear, true);
  assert.equal(seals.candle, true);
  assert.equal(seals.flawless, false);
  assert.equal(countSeals(seals), 2);
  assert.equal(isLevelPerfect(seals), false);
});

test("通关但没拿蜡烛 → 蜡烛印不亮", () => {
  const s = createInitialState(getLevel(0));
  s.status = "won";
  s.cleared = true;
  s.gotCandle = false;
  s.stats.deathsThisRun = 0;
  const seals = sealsFromState(s);
  assert.equal(seals.candle, false);
  assert.equal(seals.flawless, true);
  assert.equal(countSeals(seals), 2);
});

test("sealsFromState 对 null / 垃圾状态安全返回空印章", () => {
  for (const bad of [null, undefined, {}, 0, "x"]) {
    assert.doesNotThrow(() => sealsFromState(bad));
    assert.equal(countSeals(sealsFromState(bad)), 0);
  }
});

// ---------------------------------------------------------------- 合并语义

test("mergeSeals 取并集：印章只增不减", () => {
  const a = { clear: true, candle: false, flawless: false };
  const b = { clear: false, candle: true, flawless: true };
  assert.deepEqual(mergeSeals(a, b), { clear: true, candle: true, flawless: true });
  // 反向合并结果相同（幂等交换）
  assert.deepEqual(mergeSeals(b, a), { clear: true, candle: true, flawless: true });
});

test("mergeSeals 对缺失字段按 false 处理，不产生 undefined", () => {
  const merged = mergeSeals({ clear: true }, { candle: true });
  assert.equal(merged.flawless, false);
  assert.equal(typeof merged.flawless, "boolean");
});

test("hasNewSeal 正确识别新点亮的印章", () => {
  const before = { clear: true, candle: false, flawless: false };
  assert.equal(hasNewSeal(before, { clear: true, candle: true, flawless: false }), true);
  assert.equal(hasNewSeal(before, { clear: true, candle: false, flawless: false }), false);
  assert.equal(hasNewSeal(null, { clear: true }), true, "首次通关应算新印章");
});

// ---------------------------------------------------------------- 盘点

test("nodeTally 统计单节点印章，不超过该节点关卡数 × 3", () => {
  const node = NODES[0];
  const sealsByLevel = {};
  for (let i = node.from; i <= node.to; i++) {
    sealsByLevel[i] = { clear: true, candle: true, flawless: false };
  }
  const tally = nodeTally(sealsByLevel, node);
  const expectedClear = node.to - node.from + 1;
  assert.equal(tally.clear, expectedClear);
  assert.equal(tally.candle, expectedClear);
  assert.equal(tally.flawless, 0);
  const levelCount = node.to - node.from + 1;
  assert.ok(tally.total <= levelCount * SEALS_PER_LEVEL, "印章总数不得超过上限");
});

test("nodeTally 对空盘点 / 非法节点安全无操作", () => {
  assert.doesNotThrow(() => nodeTally({}, NODES[0]));
  assert.doesNotThrow(() => nodeTally(null, NODES[0]));
  const t = nodeTally({}, NODES[0]);
  assert.equal(t.clear, 0);
  assert.equal(t.candle, 0);
  assert.equal(t.flawless, 0);
});

test("overallTally 全局盘点上限为 关卡数 × 3", () => {
  const sealsByLevel = {};
  for (let i = 0; i < LEVEL_COUNT; i++) {
    sealsByLevel[i] = { clear: true, candle: true, flawless: true };
  }
  const tally = overallTally(sealsByLevel);
  assert.equal(tally.clear, LEVEL_COUNT);
  assert.equal(tally.candle, LEVEL_COUNT);
  assert.equal(tally.flawless, LEVEL_COUNT);
  assert.ok(
    tally.total <= LEVEL_COUNT * SEALS_PER_LEVEL,
    `印章总数 ${tally.total} 超过理论上限`
  );
});

test("overallTally 对 null / 空对象返回全 0，绝不抛错", () => {
  for (const bad of [null, undefined, {}, 0, "x"]) {
    assert.doesNotThrow(() => overallTally(bad));
    assert.equal(overallTally(bad).clear, 0);
  }
});

// ---------------------------------------------------------------- 显示口径

test("levelLabel 返回 { node, step, name }，把 0 基索引换算为 1 基显示", () => {
  // 第 1 关 → 节点 1 第 1 关
  const first = levelLabel(0);
  assert.equal(first.node, 1);
  assert.equal(first.step, 1);
  assert.ok(typeof first.name === "string" && first.name.length > 0);

  // 第 5 关 → 节点 1 第 5 关
  const fifth = levelLabel(4);
  assert.equal(fifth.node, 1);
  assert.equal(fifth.step, 5);

  // 第 6 关 → 节点 2 第 1 关（每节点 5 关）
  const sixth = levelLabel(5);
  assert.equal(sixth.node, 2);
  assert.equal(sixth.step, 1);

  // 第 50 关 → 节点 10 第 5 关
  const last = levelLabel(LEVEL_COUNT - 1);
  assert.equal(last.node, 10);
  assert.equal(last.step, 5);
});

test("levelLabel 对非法索引安全返回结构完整的对象", () => {
  for (const bad of [-1, 999, NaN, null, undefined, "x"]) {
    assert.doesNotThrow(() => levelLabel(bad));
    const out = levelLabel(bad);
    assert.equal(typeof out, "object");
    assert.equal(typeof out.step, "number");
    assert.equal(Number.isFinite(out.step), true, `step 应为有限数，实得 ${out.step}`);
  }
});

test("clock 输出 M:SS 格式且对异常输入兜底", () => {
  assert.equal(clock(0), "0:00");
  assert.equal(clock(65), "1:05");
  assert.equal(clock(600), "10:00");
  assert.equal(clock(NaN), "0:00");
  assert.equal(clock(-5), "0:00");
  assert.doesNotMatch(clock(NaN), /NaN/);
});

test("isNewBestTime 只在更快时判定为新纪录", () => {
  assert.equal(isNewBestTime(null, 10), true, "首次通关即新纪录");
  assert.equal(isNewBestTime(undefined, 10), true);
  assert.equal(isNewBestTime(10, 8), true, "更快应刷新");
  assert.equal(isNewBestTime(10, 12), false, "更慢不算");
  assert.equal(isNewBestTime(10, 10), false, "持平不算新纪录");
});

test("isNewBestTime 对非法输入安全（不产生误判）", () => {
  assert.equal(isNewBestTime(NaN, NaN), false);
  assert.equal(isNewBestTime(undefined, 5), true, "无历史纪录时首次通关算新纪录");
  assert.equal(isNewBestTime(null, 5), true);
  // 历史值非法时，比较结果不应抛出，且不得输出 NaN 之类的判断
  assert.doesNotThrow(() => isNewBestTime("x", 5));
  assert.equal(typeof isNewBestTime("x", 5), "boolean");
  // elapsed 非法一律不算新纪录
  assert.equal(isNewBestTime(10, NaN), false);
  assert.equal(isNewBestTime(10, "abc"), false);
  assert.equal(isNewBestTime(10, -3), false, "负用时不算新纪录");
});
