// 叠叠乐 · 计分测试
//   1. 连击倍率 ×3^n（Power of 3 恒等式）+ 3^18 封顶
//   2. 单次得分 = 10 × 3^n，累加法与一并相符、不越安全整数
//   3. 封神金标 / ×27 判据
//   4. 三星评级（target / par / 连击 / 封神）四路组合
//   5. 引擎驱动 ≥1000 步随机游走：倍率恒为 3 的幂次、总分单调不减、封顶后不再涨

import test from "node:test";
import assert from "node:assert/strict";

import {
  BASE_PER_BLOCK,
  STREAK_CAP,
  MAX_MULTIPLIER,
  TRIPLE_STREAK,
  WARN_DANGER,
  TOTAL_CAP,
  streakTier,
  multiplierFor,
  blockScore,
  addScore,
  isTripling,
  isSpire,
  isBrink,
  multiplierTable,
  rateRun
} from "../js/score.mjs";

import {
  STATUS,
  mulberry32,
  createInitialState,
  pullBlock,
  canStack,
  stackBlock,
  stepFrame,
  towerStats,
  pullableBlocks
} from "../js/engine.mjs";

// 倍率必须是 3 的幂次：n ≤ 3^18 → 反复除以 3 必须正好落到 1。
function assertPowerOf3(value, label) {
  assert.ok(Number.isInteger(value), `${label} 不是整数：${value}`);
  assert.ok(value >= 1, `${label} 越下界：${value}`);
  assert.ok(value <= MAX_MULTIPLIER, `${label} 超过 3^18：${value}`);
  let v = value;
  while (v > 1) {
    assert.equal(v % 3, 0, `${label} 不是 3 的幂次：${value}`);
    v /= 3;
  }
}

test("连击倍率 ×3^n：n=0 归 1，前 18 次逐项精确", () => {
  assert.equal(MAX_MULTIPLIER, 387420489);
  assert.equal(multiplierFor(0), 1, "未成功过 → 倍率归 1");
  assert.equal(multiplierFor(1), 3);
  assert.equal(multiplierFor(2), 9);
  assert.equal(multiplierFor(3), 27, "第三次成功 = ×27（三星门槛）");
  assert.equal(multiplierFor(TRIPLE_STREAK), 27);
  assert.equal(multiplierFor(17), 129140163);
  assert.equal(multiplierFor(STREAK_CAP), MAX_MULTIPLIER);
  // 逐项复核 3^n
  for (let n = 0; n <= STREAK_CAP; n += 1) {
    assert.equal(multiplierFor(n), 3 ** n, `第 ${n} 次倍率不符`);
  }
});

test("3^18 封顶：超过基准盘的连击一律不再涨，且恒为 3 的幂次", () => {
  for (const streak of [STREAK_CAP + 1, STREAK_CAP + 2, 19, 50, 100, 9999]) {
    assert.equal(multiplierFor(streak), MAX_MULTIPLIER, `连击 ${streak} 突破封顶`);
    assert.equal(blockScore(streak), BASE_PER_BLOCK * MAX_MULTIPLIER);
  }
  assert.equal(streakTier(1e9), STREAK_CAP);
  assert.equal(streakTier(-5), 0, "负数连击夹到 0");
  assert.equal(streakTier(3.9), 3, "小数连击向下取整");
  assert.equal(streakTier(NaN), 0, "脏值不得渗进倍率");
  assert.equal(multiplierFor(undefined), 1);
  // 全域扫描：0..400 每一档都得是 3 的幂次
  for (let n = 0; n <= 400; n += 1) assertPowerOf3(multiplierFor(n), `n=${n}`);
});

test("单次得分 = 10 × 3^n，倍率与基础分严格分离", () => {
  assert.equal(blockScore(0), 10);
  assert.equal(blockScore(1), 30);
  assert.equal(blockScore(3), 270);
  assert.equal(blockScore(STREAK_CAP), 3874204890);
  for (let n = 0; n <= STREAK_CAP; n += 1) {
    assert.equal(blockScore(n), BASE_PER_BLOCK * 3 ** n);
  }
});

test("总分累加：单调不减、精确对账、越界夹到安全整数", () => {
  let total = 0;
  let expect = 0;
  for (let streak = 1; streak <= STREAK_CAP; streak += 1) {
    const before = total;
    total = addScore(total, blockScore(streak));
    expect += BASE_PER_BLOCK * 3 ** streak;
    assert.equal(total, expect, `第 ${streak} 次后总分不符`);
    assert.ok(total >= before, "总分倒退");
  }
  // 封神后继续打：倍率不再涨，但仍按封顶值结算
  total = addScore(total, blockScore(STREAK_CAP + 10));
  assert.equal(total, expect + BASE_PER_BLOCK * MAX_MULTIPLIER);
  // 越界防御
  assert.equal(addScore(TOTAL_CAP, 1), TOTAL_CAP);
  assert.equal(addScore(NaN, 100), 100, "脏起点按 0 处理");
  assert.equal(addScore(0, undefined), 0);
  assert.ok(total < TOTAL_CAP, "正常局不该逼近安全整数上限");
});

test("封神金标（×3^18）与 ×27 判据", () => {
  assert.ok(!isSpire(STREAK_CAP - 1), "差一次不到封神");
  assert.ok(isSpire(STREAK_CAP));
  assert.ok(isSpire(STREAK_CAP + 100), "终身成就，超了仍算");
  assert.ok(!isTripling(2));
  assert.ok(isTripling(3));
  assert.ok(isTripling(STREAK_CAP), "封神必然已过 ×27");
});

test("判危阈值：0.55 起算吃掉容错额度", () => {
  assert.ok(!isBrink(WARN_DANGER - 1e-6));
  assert.ok(isBrink(WARN_DANGER));
  assert.ok(isBrink(1));
  assert.ok(!isBrink(undefined), "脏 danger 不算判危");
});

test("倍率表：长度 19、逐项 ×3、末项封顶", () => {
  const table = multiplierTable();
  assert.equal(table.length, STREAK_CAP + 1);
  for (let i = 0; i < table.length; i += 1) {
    assert.equal(table[i].streak, i);
    assert.equal(table[i].mult, 3 ** i);
    assert.equal(table[i].score, BASE_PER_BLOCK * 3 ** i);
  }
  assert.equal(table[table.length - 1].mult, MAX_MULTIPLIER);
});

test("三星评级：未达标 0 星，三档条件逐层叠加", () => {
  // 目标没达成 → 一律 0 星（再好的容错与连击也不给）
  assert.equal(rateRun({ goalMet: false, cleanMoves: 99, par: 3, bestStreak: 18, spire: true }), 0);
  // 只达成目标
  assert.equal(rateRun({ goalMet: true, cleanMoves: 0, par: 5, bestStreak: 0 }), 1);
  // cleanMoves 边界：等于 par 算达标，少一次不算
  assert.equal(rateRun({ goalMet: true, cleanMoves: 5, par: 5 }), 2);
  assert.equal(rateRun({ goalMet: true, cleanMoves: 4, par: 5 }), 1);
  // 第三星：连击 ≥ 3（×27）或封神，二者任一
  assert.equal(rateRun({ goalMet: true, cleanMoves: 0, par: 9, bestStreak: 2 }), 1);
  assert.equal(rateRun({ goalMet: true, cleanMoves: 0, par: 9, bestStreak: 3 }), 2);
  assert.equal(rateRun({ goalMet: true, cleanMoves: 9, par: 9, bestStreak: 3 }), 3);
  assert.equal(rateRun({ goalMet: true, cleanMoves: 9, par: 9, bestStreak: 1, spire: true }), 3);
  // par = 0 → 第二星白送（关卡没设容错要求）
  assert.equal(rateRun({ goalMet: true, cleanMoves: 0, par: 0 }), 2);
  // 星数恒在 0..3
  for (const r of [
    {},
    { goalMet: true },
    { goalMet: true, cleanMoves: -3, par: -1, bestStreak: -9 },
    { goalMet: true, cleanMoves: 1e6, par: 1, bestStreak: 1e6, spire: true }
  ]) {
    const s = rateRun(r);
    assert.ok(s >= 0 && s <= 3, `星级越界 ${s}`);
    assert.ok(Number.isInteger(s));
  }
});

test("实例局面：连续 7 次成功 + 最后一次判危，数值对账", () => {
  // 假想一局：连着成功 6 次，第 7 次判危但没倒，最后一次塌了。
  let total = 0;
  let clean = 0;
  const sequence = [1, 2, 3, 4, 5, 6, 7];
  sequence.forEach((n, i) => {
    total = addScore(total, blockScore(n));
    if (!isBrink(i === 6 ? 0.8 : 0.2)) clean += 1;
  });
  assert.equal(total, 10 * (3 + 9 + 27 + 81 + 243 + 729 + 2187));
  assert.equal(clean, 6);
  assert.equal(rateRun({ goalMet: true, cleanMoves: clean, par: 6, bestStreak: 7 }), 3);
});

test("引擎驱动 ≥1000 步随机合法操作游走：倍率恒为 3 的幂次、总分单调不减", () => {
  // 用真实的抽叠链路喂分，验证「连击状态 → 计分」这条接缝不出错。
  let steps = 0;
  let attempts = 0;
  let total = 0;
  let bestStreak = 0;
  let everSpire = false;
  let collapses = 0;
  let lastTotal = 0;

  let s = createInitialState({ seed: 424242 });
  const rnd = mulberry32(90210);

  while (steps < 1200 && attempts < 20000) {
    attempts += 1;
    if (s.status === STATUS.COLLAPSE || s.status === STATUS.LOST) {
      // 塌了就等它落定，再重摆一座新塔（连击必须由引擎清零）
      for (let i = 0; i < 600 && s.status !== STATUS.LOST; i += 1) stepFrame(s);
      assert.equal(s.streak, 0, "塌落定局后连击应清零");
      s = createInitialState({ seed: 1000 + collapses });
      collapses += 1;
      continue;
    }
    const cands = pullableBlocks(s);
    if (cands.length === 0) {
      s = createInitialState({ seed: 2000 + collapses });
      collapses += 1;
      continue;
    }
    const pick = cands[Math.floor(rnd() * cands.length)];
    const p = pullBlock(s, pick.layer, pick.slot);
    if (!p.ok) continue;
    const slots = [0, 1, 2].filter((x) => canStack(s, x));
    if (slots.length === 0) continue;
    const st = stackBlock(s, slots[Math.floor(rnd() * slots.length)]);
    steps += 1;

    // 不变量：多劳多得，最好连击单调不减，总分只增不减
    const stats = towerStats(s);
    if (stats.bestStreak > bestStreak) bestStreak = stats.bestStreak;

    if (st.collapsed || s.status === STATUS.COLLAPSE || s.status === STATUS.LOST) {
      // 判倒当帧：连击已由引擎清零 → 计分侧不得再按旧连击结算
      assert.equal(s.streak, 0, "判倒后连击应清零");
      continue;
    }
    const mult = multiplierFor(stats.streak);
    assertPowerOf3(mult, `第 ${steps} 步倍率`);
    assert.equal(blockScore(stats.streak), BASE_PER_BLOCK * mult, "单次得分必须 = 10 × 倍率");
    total = addScore(total, blockScore(stats.streak));
    assert.ok(total >= lastTotal, `总分倒退：第 ${steps} 步`);
    lastTotal = total;
    if (isSpire(stats.streak)) everSpire = true;
    // advance 一点点物理，模拟真实操作间隔
    for (let i = 0; i < 12; i += 1) stepFrame(s);
  }

  assert.ok(steps >= 1000, `游走步数不足：${steps}`);
  assert.ok(total > 0, "总分不该为 0");
  assert.ok(Number.isSafeInteger(total), `总分越过安全整数：${total}`);
  assert.ok(bestStreak >= 1, "至少要成功过一次");
  assert.equal(isTripling(bestStreak), bestStreak >= TRIPLE_STREAK);
  assert.equal(everSpire, bestStreak >= STREAK_CAP, "封神标记须与最好连击一致");
});

test("连击清零后下一次成功从 ×3 重开（换手 / 塔倒同源）", () => {
  const s = createInitialState({ seed: 77 });
  const cands = pullableBlocks(s);
  pullBlock(s, cands[0].layer, cands[0].slot);
  stackBlock(s, 0);
  assert.equal(multiplierFor(s.streak), 3);

  // 复入塌落：连击清零 → 倍率归 1
  s.streak = 0;
  assert.equal(multiplierFor(s.streak), 1);
  assert.equal(blockScore(s.streak), BASE_PER_BLOCK);
  // 再成功一次 → 又是 ×3，不存在「斜线续分母」
  s.streak += 1;
  assert.equal(blockScore(s.streak), 30);
});
