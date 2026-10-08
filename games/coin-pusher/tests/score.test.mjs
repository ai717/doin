// score.test.mjs — 计分唯一口径：币值 / 连锁翻倍与封顶 / 档位 / 格式化
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COIN_VALUES, coinValue, cascadeMult, cascadeTierKey, isJackpot,
  formatScore, formatMult,
  JACKPOT_DOUBLINGS, JACKPOT_MULT, JACKPOT_CASCADE, CASCADE_WINDOW, CASCADE_TIERS
} from "../js/score.mjs";

describe("score: 币值口径", () => {
  it("三类币的基值固定", () => {
    assert.equal(COIN_VALUES.norm, 10);
    assert.equal(COIN_VALUES.gold, 50);
    assert.equal(COIN_VALUES.gem, 100);
    assert.equal(COIN_VALUES.tower, 0, "金塔不计入普通币值（走 TOWER_BONUS）");
  });

  it("双倍增益把基值翻倍", () => {
    assert.equal(coinValue("norm", false), 10);
    assert.equal(coinValue("norm", true), 20);
    assert.equal(coinValue("gem", true), 200);
    assert.equal(coinValue("tower", true), 0);
  });

  it("未知币种返回 0 而不是 NaN", () => {
    assert.equal(coinValue("nope", false), 0);
    assert.equal(coinValue(undefined, true), 0);
  });
});

describe("score: 连锁翻倍", () => {
  it("波内第 m 枚得 2^(m-1)", () => {
    assert.equal(cascadeMult(0), 1);
    assert.equal(cascadeMult(1), 1);
    assert.equal(cascadeMult(2), 2);
    assert.equal(cascadeMult(4), 8);
    assert.equal(cascadeMult(8), 128);
    assert.equal(cascadeMult(12), 2 ** 11);
  });

  it("封顶 2^18，绝不无限增长", () => {
    assert.equal(JACKPOT_DOUBLINGS, 18);
    assert.equal(JACKPOT_MULT, 262144);
    assert.equal(JACKPOT_CASCADE, 19);
    assert.equal(cascadeMult(19), JACKPOT_MULT);
    assert.equal(cascadeMult(40), JACKPOT_MULT);
    assert.equal(cascadeMult(1e6), JACKPOT_MULT);
  });

  it("倍率单调不减", () => {
    let prev = 0;
    for (let m = 0; m <= 60; m++) {
      const v = cascadeMult(m);
      assert.ok(v >= prev, `m=${m} 倍率回落`);
      prev = v;
    }
  });

  it("isJackpot 只在触顶时为真", () => {
    assert.equal(isJackpot(cascadeMult(18)), false);
    assert.equal(isJackpot(cascadeMult(19)), true);
    assert.equal(isJackpot(JACKPOT_MULT * 2), true);
  });

  it("连锁窗口被收紧到街机量级（1.5s 会让连锁永不中断）", () => {
    assert.ok(CASCADE_WINDOW > 0);
    assert.ok(CASCADE_WINDOW <= 0.5, `连锁窗口 ${CASCADE_WINDOW}s 过宽，满载台面会恒在封顶`);
  });
});

describe("score: 档位", () => {
  it("四档常规 + 疯狂档，边界归入正确档位", () => {
    assert.equal(CASCADE_TIERS.length, 5);
    assert.equal(cascadeTierKey(0), "tier1");
    assert.equal(cascadeTierKey(4), "tier1");
    assert.equal(cascadeTierKey(5), "tier2");
    assert.equal(cascadeTierKey(8), "tier2");
    assert.equal(cascadeTierKey(9), "tier3");
    assert.equal(cascadeTierKey(12), "tier3");
    assert.equal(cascadeTierKey(13), "tier4");
    assert.equal(cascadeTierKey(16), "tier4");
    assert.equal(cascadeTierKey(17), "tierMad");
    assert.equal(cascadeTierKey(999), "tierMad");
  });

  it("档位边界严格单调递增", () => {
    let prev = 0;
    for (const tier of CASCADE_TIERS) {
      assert.ok(tier.upto > prev);
      prev = tier.upto;
    }
    assert.equal(CASCADE_TIERS[CASCADE_TIERS.length - 1].upto, Infinity);
  });
});

describe("score: 显示格式化", () => {
  it("千分位分组", () => {
    assert.equal(formatScore(0), "0");
    assert.equal(formatScore(999), "999");
    assert.equal(formatScore(1000), "1,000");
    assert.equal(formatScore(1234567), "1,234,567");
    assert.equal(formatScore(262144), "262,144");
  });

  it("负数 / NaN / 小数一律落到合法显示值", () => {
    assert.equal(formatScore(-5), "0");
    assert.equal(formatScore(NaN), "0");
    assert.equal(formatScore(undefined), "0");
    assert.equal(formatScore(1234.9), "1,234");
  });

  it("倍率显示带 ×，且不小于 1", () => {
    assert.equal(formatMult(1), "×1");
    assert.equal(formatMult(2048), "×2,048");
    assert.equal(formatMult(0), "×1");
    assert.equal(formatMult(NaN), "×1");
  });
});
