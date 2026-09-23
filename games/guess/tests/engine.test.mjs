// engine.test.mjs —— 规则层单测：回波语义、噪声有界、包围圈恒含真值、道具与回溯、终止态 no-op

import test from "node:test";
import assert from "node:assert/strict";

import {
  createRun,
  submitGuess,
  useTool,
  recall,
  beliefOf,
  remainingOf,
  isLegalGuess,
  temperatureOf,
  hotRadius,
  warmRadius,
  STATUS,
  DIR,
  TOOL,
} from "../js/engine.mjs";
import { LEVELS, LEVEL_COUNT, levelById, parOf } from "../js/levels.mjs";
import { mulberry32 } from "../js/rng.mjs";
import { starsFor, starThresholds } from "../js/score.mjs";

function runOf(levelId, seed, target) {
  const run = createRun(levelById(levelId), mulberry32(seed));
  if (Number.isInteger(target)) run.target = target;
  return run;
}

test("温度半径随猎场缩放，且烫 < 温", () => {
  assert.ok(hotRadius(100) < warmRadius(100));
  assert.equal(temperatureOf(0, 100), "hot");
  assert.equal(temperatureOf(hotRadius(100), 100), "hot");
  assert.equal(temperatureOf(hotRadius(100) + 1, 100), "warm");
  assert.equal(temperatureOf(warmRadius(100) + 1, 100), "cold");
});

test("第一章温度回波更保守，减少开局一次命中距离就大幅锁定范围", () => {
  const level = levelById(1);
  assert.ok(hotRadius(level.range, level.temperaturePrecision) > hotRadius(level.range));
  assert.ok(warmRadius(level.range, level.temperaturePrecision) > warmRadius(level.range));

  const run = runOf(1, 11, 25);
  const echo = submitGuess(run, 26);
  assert.equal(echo.temp, "hot");
  const band = beliefOf(run);
  assert.equal(band.lo, 21);
  assert.equal(band.hi, 25);
});

test("回波方向与目标一致：目标更大报 higher，更小报 lower", () => {
  const run = runOf(4, 11, 70);
  const up = submitGuess(run, 30);
  assert.equal(up.dir, DIR.HIGHER);
  const down = submitGuess(run, 90);
  assert.equal(down.dir, DIR.LOWER);
  const hit = submitGuess(run, 70);
  assert.equal(hit.hit, true);
  assert.equal(run.status, STATUS.WON);
});

test("非法意图返回 null，绝不抛错；终止态上的操作是 no-op", () => {
  const run = runOf(4, 3, 55);
  assert.equal(submitGuess(run, 0), null);
  assert.equal(submitGuess(run, 101), null);
  assert.equal(submitGuess(run, 3.5), null);
  assert.equal(submitGuess(run, NaN), null);
  assert.equal(run.used, 0);
  submitGuess(run, 50);
  assert.equal(isLegalGuess(run, 50), false);
  assert.equal(submitGuess(run, 50), null, "重复投掷必须静默忽略");
  assert.equal(run.used, 1);
  const won = runOf(4, 5, 12);
  submitGuess(won, 12);
  assert.equal(won.status, STATUS.WON);
  assert.equal(submitGuess(won, 30), null, "终局操作一律 no-op");
  assert.equal(useTool(won, TOOL.PROBE), null);
  assert.equal(recall(won), false);
});

test("鱼雷耗尽即判负，且不会再多扣一次", () => {
  const run = runOf(1, 9, 40);
  for (let v = 1; v <= run.max && run.status === STATUS.PLAYING; v += 1) {
    if (v === 40) continue; // 别打中，专门测耗尽
    submitGuess(run, v);
  }
  assert.equal(run.status, STATUS.LOST);
  assert.equal(run.used, run.budget);
  assert.equal(remainingOf(run), 0);
  assert.equal(submitGuess(run, 39), null);
});

test("谎灯：整局恰有一次方向被倒置，且绝不发生在第一投", () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const run = createRun(levelById(14), mulberry32(seed));
    assert.ok(run.lieTurn >= 2 && run.lieTurn <= run.budget, "谎灯回合必须落在 2..budget");
    let lies = 0;
    for (let i = 0; i < run.budget && run.status === STATUS.PLAYING; i += 1) {
      const v = run.min + ((i * 7) % run.range);
      if (run.guessed.has(v)) continue;
      const e = submitGuess(run, v);
      if (!e) continue;
      if (e.liar) lies += 1;
      if (e.hit) break;
    }
    assert.ok(lies <= 1, `谎灯最多出现一次（seed ${seed} 出现 ${lies} 次）`);
  }
});

test("谎灯的回波仍带真温度（交叉验证的入口）", () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const run = createRun(levelById(14), mulberry32(seed));
    for (let i = 0; i < run.budget && run.status === STATUS.PLAYING; i += 1) {
      const v = run.min + ((i * 13) % run.range);
      if (run.guessed.has(v)) continue;
      const e = submitGuess(run, v);
      if (!e) continue;
      if (e.liar && !e.hit) {
        assert.equal(e.temp, temperatureOf(run.target - v, run.range, run.level.temperaturePrecision), "谎灯只翻方向，温度必须为真");
      }
      if (e.hit) break;
    }
  }
});

test("暗流：只在前 driftTurns 投发生，且绝不把猎物推到已投过的刻度（无死局不变量）", () => {
  for (const lv of LEVELS.filter((l) => l.drift > 0)) {
    for (let seed = 1; seed <= 12; seed += 1) {
      const run = createRun(lv, mulberry32(seed * 31));
      for (let i = 0; i < lv.budget && run.status === STATUS.PLAYING; i += 1) {
        const v = run.min + ((i * 5 + 3) % run.range);
        if (run.guessed.has(v)) continue;
        submitGuess(run, v);
        assert.ok(!run.guessed.has(run.target) || run.status === STATUS.WON, "target 绝不能落在已投过的刻度上");
        const driftCount = run.drifts.length;
        assert.ok(driftCount <= lv.driftTurns, "漂移次数不超过 driftTurns");
      }
    }
  }
});

test("包围圈恒为真值的超集（无谎灯时）", () => {
  for (const lv of LEVELS.filter((l) => l.liars === 0)) {
    for (let seed = 1; seed <= 8; seed += 1) {
      const run = createRun(lv, mulberry32(seed * 17));
      for (let i = 0; i < lv.budget && run.status === STATUS.PLAYING; i += 1) {
        const b = beliefOf(run);
        assert.ok(b.lo <= run.target && run.target <= b.hi, `包围圈漏掉了真值 lv${lv.id} seed${seed}`);
        const v = run.min + ((i * 11 + 1) % run.range);
        if (run.guessed.has(v)) continue;
        submitGuess(run, v);
      }
    }
  }
});

test("包围圈收窄：每投单调不增，命中后宽度为 1", () => {
  const run = runOf(4, 21, 63);
  let width = beliefOf(run).width;
  for (const v of [50, 56, 60, 62]) {
    submitGuess(run, v);
    const next = beliefOf(run).width;
    assert.ok(next <= width, "包围圈只能收紧不能变宽");
    width = next;
  }
  submitGuess(run, 63);
  assert.equal(beliefOf(run).width, 1);
});

test("谎灯把区间压成空集时，包围圈报冲突并给出重建区间", () => {
  const run = createRun(levelById(14), mulberry32(5));
  run.target = 80;
  run.lieTurn = 2;
  submitGuess(run, 90); // 真 lower -> 报 lower
  submitGuess(run, 70); // 真 higher，但第 2 投是谎灯 -> 报 lower（矛盾）
  const b = beliefOf(run);
  assert.equal(b.conflict, true, "两条回波互相矛盾时必须报冲突");
  assert.ok(b.lo <= run.target && run.target <= b.hi, "冲突重建后仍须包含真值");
});

test("浊流：雾区内的投掷方向静默，但仍给温度", () => {
  const run = runOf(21, 4, 150);
  run.fog = [{ lo: 40, hi: 60 }];
  const e = submitGuess(run, 50);
  assert.equal(e.silent, true);
  assert.equal(e.dir, null);
  assert.ok(e.temp, "雾区仍回温度");
  const clear = submitGuess(run, 100);
  assert.equal(clear.silent, false);
});

test("道具：探针回报奇偶、扫描线点亮半区、按标价扣鱼雷", () => {
  const run = runOf(25, 6, 137);
  const before = remainingOf(run);
  const probe = useTool(run, TOOL.PROBE);
  assert.equal(probe.parity, "odd");
  assert.equal(remainingOf(run), before - 1);
  assert.ok(useTool(run, TOOL.PROBE), "第 25 关配了两枚探针");
  assert.equal(useTool(run, TOOL.PROBE), null, "探针用完后必须返回 null");

  const run2 = runOf(19, 6, 40); // 无暗流关卡，便于直接断言半区
  const scan = useTool(run2, TOOL.SCAN);
  assert.equal(scan.half, "lower");
  assert.equal(run2.used, 2);
  const b = beliefOf(run2);
  assert.ok(b.hi <= scan.mid);
});

test("暗流：使用工具消耗机会但不触发目标漂移", () => {
  const run = runOf(8, 29, 100);
  assert.ok(run.drift > 0 && run.driftTurns > 0);
  const targetBefore = run.target;
  const driftsBefore = run.drifts.length;

  assert.ok(useTool(run, TOOL.PROBE));
  assert.equal(run.target, targetBefore);
  assert.equal(run.drifts.length, driftsBefore);
  assert.equal(run.used, 1);
});
test("回溯：撤销上一投并还原状态，不消耗鱼雷，且每关限一次", () => {
  const run = runOf(4, 33, 42);
  submitGuess(run, 20);
  const usedAfter = run.used;
  const targetAfter = run.target;
  assert.equal(recall(run), true);
  assert.equal(run.used, usedAfter - 1);
  assert.equal(run.target, targetAfter, "回溯须还原当次暗流位移");
  assert.equal(run.log.length, 0);
  assert.equal(run.guessed.has(20), false);
  assert.equal(recall(run), false, "每关只有一次回溯");
});

test("关卡表：预算恒大于理论最优，且噪声配置有界", () => {
  for (const lv of LEVELS) {
    assert.ok(lv.budget > parOf(lv.range) + 1, `lv${lv.id} 预算必须留出余量`);
    assert.ok(lv.min === 1 && lv.max > lv.min);
    if (lv.fogSegs > 0) {
      const width = Math.max(6, Math.round(lv.range * lv.fogPct));
      assert.ok((width * lv.fogSegs) / lv.range <= 0.2, "雾区总遮蔽不得超过 20%");
    }
    if (lv.blind) assert.equal(lv.fogSegs, 0, "盲猎关不得叠加雾区（无温度时雾内无法定位）");
  }
  assert.equal(LEVELS.length, LEVEL_COUNT);
});

test("星级：三星锚定理论最优，二星留出预算，未命中 0 星", () => {
  const lv = levelById(4);
  const th = starThresholds(lv);
  assert.equal(starsFor(lv, th.par), 3);
  assert.equal(starsFor(lv, th.three), 3);
  assert.equal(starsFor(lv, th.three + 1), 2);
  assert.equal(starsFor(lv, lv.budget), 1);
  assert.equal(starsFor(lv, 0), 0);
});
