// 计分唯一口径测试：评级、趣味徽章、战绩累计。
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRating, computeBadges, applyOutcome, RATING_ORDER } from "../js/score.mjs";

// 构造名次一致的对局：4 人资产按名次降序，人类排 humanRank（0=冠军）。
// players 固定按 id 顺序 [0,1,2,3]（人类恒为 0），rank/assets 表达名次。
function stateFor(humanRank, humanAsset, log = []) {
  const aiAssets = [14000, 11000, 9000, 7000];
  const aiOrder = [1, 2, 3];
  const rank = [];
  const assets = [];
  let cursor = 0;
  for (let pos = 0; pos < 4; pos++) {
    if (pos === humanRank) {
      rank.push(0);
      assets.push({ i: 0, asset: humanAsset, personaId: null, kind: "human" });
    } else {
      const ai = aiOrder[cursor++];
      rank.push(ai);
      assets.push({ i: ai, asset: aiAssets[pos], personaId: "cautious", kind: "ai" });
    }
  }
  const players = [0, 1, 2, 3].map((i) => {
    const a = assets.find((x) => x.i === i);
    return { id: i, kind: i === 0 ? "human" : "ai", cash: a ? a.asset : 0, initialCash: 10000 };
  });
  return { result: { rank, assets }, players, log };
}

test("评级：第一且资产 ≥ 初始×1.8 → S", () => {
  assert.equal(computeRating(stateFor(0, 20000)), "S");
});

test("评级：第一但资产不足 → A", () => {
  assert.equal(computeRating(stateFor(0, 15000)), "A");
});

test("评级：第二 → B，第三四 → C", () => {
  assert.equal(computeRating(stateFor(1, 12000)), "B");
  assert.equal(computeRating(stateFor(2, 9000)), "C");
  assert.equal(computeRating(stateFor(3, 7000)), "C");
});

test("评级：未终局返回 null", () => {
  assert.equal(computeRating({ players: [] }), null);
});

test("徽章：捡漏王（以低于真值一半拿下）", () => {
  // 出价 3000，开箱价值 8000（coef=1）→ profit 5000，ratio = 5000/8000 = 0.625 ≥ 0.5
  const log = [
    { t: "resolve", winner: 0, bids: [3000, 500, 100, 0] },
    { t: "open", winner: 0, trueValue: 8000, profit: 5000 },
  ];
  const badges = computeBadges(stateFor(0, 15000, log));
  assert.ok(badges.includes("snip"));
});

test("徽章：接盘侠（单箱亏 ≥ $3000）", () => {
  const log = [
    { t: "resolve", winner: 0, bids: [9000, 200, 100, 0] },
    { t: "open", winner: 0, trueValue: 5000, profit: -4000 },
  ];
  const badges = computeBadges(stateFor(3, 6000, log));
  assert.ok(badges.includes("bag"));
});

test("徽章：铁公鸡（零买入且现金保留）", () => {
  const log = [
    { t: "resolve", winner: 2, bids: [0, 0, 300, 0] },
    { t: "open", winner: 2, trueValue: 8000, profit: 0 },
  ];
  const badges = computeBadges(stateFor(2, 10000, log));
  assert.ok(badges.includes("tight"));
});

test("徽章：抬轿人（≥2 次第二且对手接盘）", () => {
  const log = [
    { t: "resolve", winner: 1, bids: [4000, 5000, 100, 0] },
    { t: "open", winner: 1, trueValue: 3000, profit: -2000 },
    { t: "resolve", winner: 2, bids: [3000, 100, 3500, 0] },
    { t: "open", winner: 2, trueValue: 2000, profit: -1500 },
  ];
  const badges = computeBadges(stateFor(1, 12000, log));
  assert.ok(badges.includes("sedan"));
});

test("徽章：普通对局无徽章", () => {
  const log = [
    { t: "resolve", winner: 0, bids: [5000, 300, 100, 0] },
    { t: "open", winner: 0, trueValue: 6000, profit: 1000 },
  ];
  assert.deepEqual(computeBadges(stateFor(1, 13000, log)), []);
});

test("applyOutcome: 累计战绩并保留最佳", () => {
  const base = { gamesPlayed: 1, bestAsset: 5000, bestRating: "B", badges: ["snip"] };
  const next = applyOutcome(base, { asset: 20000, rating: "A", badges: ["bag"] });
  assert.equal(next.gamesPlayed, 2);
  assert.equal(next.bestAsset, 20000);
  assert.equal(next.bestRating, "A");
  assert.deepEqual([...next.badges].sort(), ["bag", "snip"]);
  // 更差结果不降级
  const worse = applyOutcome(next, { asset: 3000, rating: "C", badges: [] });
  assert.equal(worse.bestAsset, 20000);
  assert.equal(worse.bestRating, "A");
});

test("applyOutcome: 坏输入回默认", () => {
  const next = applyOutcome(null, { asset: -5, rating: "X", badges: "bad" });
  assert.equal(next.gamesPlayed, 1);
  assert.equal(next.bestAsset, 0);
  assert.equal(next.bestRating, null);
  assert.deepEqual(next.badges, []);
});

test("RATING_ORDER 顺序", () => {
  assert.deepEqual(RATING_ORDER, ["C", "B", "A", "S"]);
});
