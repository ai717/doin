// score.test.mjs — 三星评级、连击档位、解锁链（UI 不得自行算星）
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_STARS, parOf, rateClear, clearSummary, runTier, duelScoreLine, unlockedThrough, isTableUnlocked,
} from "../js/score.mjs";
import { TABLES, getTable } from "../js/tables.mjs";

describe("score: 三星评级", () => {
  it("未清台零星", () => {
    const r = rateClear({ cleared: false, shots: 1, par: 20, fouls: 0 });
    assert.deepEqual(r, { stars: 0, withinPar: false, flawless: false });
  });
  it("清台即保底一星", () => {
    assert.equal(rateClear({ cleared: true, shots: 99, par: 20, fouls: 9 }).stars, 1);
  });
  it("压标准杆两星，零犯规三星", () => {
    assert.equal(rateClear({ cleared: true, shots: 20, par: 20, fouls: 3 }).stars, 2);
    assert.equal(rateClear({ cleared: true, shots: 19, par: 20, fouls: 1 }).stars, 2);
    assert.equal(rateClear({ cleared: true, shots: 20, par: 20, fouls: 0 }).stars, 3);
    assert.equal(rateClear({ cleared: true, shots: 1, par: 20, fouls: 0 }).stars, 3);
  });
  it("星级永不超过 MAX_STARS 也不为负", () => {
    for (const args of [
      { cleared: true, shots: 0, par: 0, fouls: 0 },
      { cleared: true, shots: -5, par: -1, fouls: -2 },
      { cleared: false, shots: 3, par: 2, fouls: 1 },
    ]) {
      const { stars } = rateClear(args);
      assert.ok(stars >= 0 && stars <= MAX_STARS, `越界 ${stars}`);
    }
  });
  it("parOf 取表 par，缺表回落 0", () => {
    assert.equal(parOf(getTable(TABLES[0].id)), getTable(TABLES[0].id).par);
    assert.equal(parOf(null), 0);
    assert.equal(parOf({}), 0);
  });
});

describe("score: 结算摘要", () => {
  it("汇总字段齐全", () => {
    const s = clearSummary({ cleared: true, shots: 24, par: 20, fouls: 2, bestRun: 4 });
    assert.equal(s.cleared, true);
    assert.equal(s.overPar, 4);
    assert.equal(s.stars, 1);
    assert.equal(s.bestRun, 4);
    assert.equal(s.withinPar, false);
    assert.equal(s.flawless, false);
  });
  it("未清台不计超杆", () => {
    assert.equal(clearSummary({ cleared: false, shots: 30, par: 20, fouls: 0 }).overPar, 0);
  });
  it("bestRun 缺失补 0", () => {
    assert.equal(clearSummary({ cleared: true, shots: 20, par: 20, fouls: 0 }).bestRun, 0);
  });
});

describe("score: 连击档位", () => {
  it("0/1 无档，2 起档，3 与 5 升级", () => {
    assert.equal(runTier(0), 0);
    assert.equal(runTier(1), 0);
    assert.equal(runTier(2), 1);
    assert.equal(runTier(3), 2);
    assert.equal(runTier(4), 2);
    assert.equal(runTier(5), 3);
    assert.equal(runTier(99), 3);
  });
});

describe("score: 双人战绩与解锁链", () => {
  it("duelScoreLine 汇总场次", () => {
    assert.deepEqual(duelScoreLine(3, 2), { wins: 3, losses: 2, played: 5 });
  });
  it("unlockedThrough 只随连续通关推进", () => {
    const ids = TABLES.map((t) => t.id);
    assert.equal(unlockedThrough(ids, {}), 0);
    assert.equal(unlockedThrough(ids, { [ids[0]]: { cleared: true } }), 1);
    assert.equal(unlockedThrough(ids, { [ids[0]]: { cleared: true }, [ids[1]]: { cleared: true } }), 2);
    // 第 3 局未通，第 4 局通了也不算
    assert.equal(unlockedThrough(ids, {
      [ids[0]]: { cleared: true }, [ids[1]]: { cleared: true }, [ids[3]]: { cleared: true },
    }), 2);
    // 全通时钉在最后一局
    const all = Object.fromEntries(ids.map((id) => [id, { cleared: true }]));
    assert.equal(unlockedThrough(ids, all), ids.length - 1);
  });
  it("isTableUnlocked 与 unlockedThrough 一致", () => {
    const ids = TABLES.map((t) => t.id);
    const results = { [ids[0]]: { cleared: true }, [ids[1]]: { cleared: true } };
    const through = unlockedThrough(ids, results);
    for (let i = 0; i < ids.length; i += 1) {
      assert.equal(isTableUnlocked(ids, results, ids[i]), i <= through, `第 ${i + 1} 局解锁判定不一致`);
    }
  });
  it("首局永远解锁，未知局回落 false", () => {
    const ids = TABLES.map((t) => t.id);
    assert.equal(isTableUnlocked(ids, {}, ids[0]), true);
    assert.equal(isTableUnlocked(ids, {}, "nope"), true, "indexOf<0 视为首局");
    assert.equal(isTableUnlocked(ids, {}, ids[1]), false);
  });
});
