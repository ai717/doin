import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BAG_DYNAMITE,
  BAG_MONEY,
  BASE_TARGET,
  DIAMOND_VALUE,
  DIAMOND_VALUE_POLISHED,
  SHOP_ITEMS,
  bagPrize,
  canAfford,
  diamondValue,
  isRoundWon,
  shopCost,
  targetForLevel,
} from "../js/score.mjs";

const rngOf = (value) => () => value;

test("目标配额：第 1 关 1000，之后每关 ×1.65 并四舍五入", () => {
  assert.equal(BASE_TARGET, 1000);
  assert.equal(targetForLevel(1), 1000);
  assert.equal(targetForLevel(2), 1650);
  assert.equal(targetForLevel(3), 2722, "1.65² 浮点为 2.72249…，四舍五入即 2722");
  assert.equal(targetForLevel(4), 4492);
});

test("目标配额：随关卡严格递增，坏输入退回第 1 关", () => {
  let previous = 0;
  for (let level = 1; level <= 30; level += 1) {
    const target = targetForLevel(level);
    assert.ok(target > previous, `第 ${level} 关目标应高于前一关`);
    assert.ok(Number.isInteger(target));
    previous = target;
  }
  for (const bad of [0, -3, NaN, undefined, null, "x"]) {
    assert.equal(targetForLevel(bad), BASE_TARGET);
  }
  assert.equal(targetForLevel(2.9), targetForLevel(2), "小数关卡向下取整");
});

test("钻石亮油：600 → 900（+50%）", () => {
  assert.equal(DIAMOND_VALUE, 600);
  assert.equal(DIAMOND_VALUE_POLISHED, 900);
  assert.equal(diamondValue(false), 600);
  assert.equal(diamondValue(true), 900);
  assert.equal(Math.round((diamondValue(true) / diamondValue(false) - 1) * 100), 50);
});

test("商店价格：炸药 200 / 生力水 280 / 钻石亮油 320，未知商品买不到", () => {
  assert.deepEqual(
    SHOP_ITEMS.map((item) => [item.type, item.cost]),
    [
      ["dynamite", 200],
      ["potion", 280],
      ["polish", 320],
    ],
  );
  assert.equal(shopCost("dynamite"), 200);
  assert.equal(shopCost("polish"), 320);
  assert.equal(shopCost("cheat"), Infinity);
  assert.equal(canAfford(200, "dynamite"), true);
  assert.equal(canAfford(199, "dynamite"), false);
  assert.equal(canAfford(Number.MAX_SAFE_INTEGER, "cheat"), false);
});

test("神秘袋：40% 现金 / 30% 炸药 / 30% 生力水，边界值归入后一档", () => {
  assert.equal(BAG_MONEY, 500);
  assert.equal(BAG_DYNAMITE, 2);
  assert.deepEqual(bagPrize(rngOf(0)), { kind: "money", amount: BAG_MONEY });
  assert.deepEqual(bagPrize(rngOf(0.399)), { kind: "money", amount: BAG_MONEY });
  assert.deepEqual(bagPrize(rngOf(0.4)), { kind: "dynamite", amount: BAG_DYNAMITE });
  assert.deepEqual(bagPrize(rngOf(0.699)), { kind: "dynamite", amount: BAG_DYNAMITE });
  assert.deepEqual(bagPrize(rngOf(0.7)), { kind: "potion", amount: 1 });
  assert.deepEqual(bagPrize(rngOf(0.999)), { kind: "potion", amount: 1 });
});

test("神秘袋：默认 rng 下大量抽样落在 4:3:3 附近", () => {
  const tally = { money: 0, dynamite: 0, potion: 0 };
  for (let i = 0; i < 20000; i += 1) tally[bagPrize().kind] += 1;
  assert.ok(Math.abs(tally.money / 20000 - 0.4) < 0.02);
  assert.ok(Math.abs(tally.dynamite / 20000 - 0.3) < 0.02);
  assert.ok(Math.abs(tally.potion / 20000 - 0.3) < 0.02);
});

test("胜负判定：现金达到配额即通关", () => {
  assert.equal(isRoundWon(1000, 1000), true);
  assert.equal(isRoundWon(1001, 1000), true);
  assert.equal(isRoundWon(999, 1000), false);
  assert.equal(isRoundWon(0, 1000), false);
});
