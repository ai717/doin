// 叠叠乐 · 存档测试
//   1. 脏数据 / 损坏数据一律归一化，绝不白屏
//   2. localStorage 不可用时静默降级内存
//   3. 星级白名单、解锁推进、"上次关卡 ≤ 已解锁" 越狱防护
//   4. recordClear 解锁并记录星级；recordRun 只更新最好成绩

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  STORAGE_KEY, defaultSave, normalize, loadSave, saveSave, clearSave,
  recordClear, recordRun, totalStars
} from "../js/storage.mjs";
import { LEVELS, TOTAL_LEVELS } from "../js/levels.mjs";
import { STREAK_CAP } from "../js/score.mjs";

test("存储 key 为全站约定的 doin.jenga.v1", () => {
  assert.equal(STORAGE_KEY, "doin.jenga.v1");
});

test("默认存档字段齐备", () => {
  const save = defaultSave();
  assert.equal(save.sound, true);
  assert.equal(save.mode, "spire");
  assert.equal(save.unlocked, 1);
  assert.equal(save.lastLevel, 1);
  assert.deepEqual(save.stars, {});
  assert.equal(save.bestLayers, 18);
});

test("脏数据归一化：垃圾输入全部回落到默认值", () => {
  const cases = [null, undefined, 42, "oops", [], {}, { sound: "yes" }, { unlocked: -9 }, { unlocked: 1e9 }];
  for (const raw of cases) {
    const out = normalize(raw);
    assert.equal(out.sound, true, "非 boolean 的 sound 一律回落 true");
    assert.ok(out.unlocked >= 1 && out.unlocked <= TOTAL_LEVELS);
    assert.ok(out.lastLevel >= 1 && out.lastLevel <= TOTAL_LEVELS);
    assert.ok(out.lastLevel <= out.unlocked, "上次关卡不得越狱到未解锁关卡");
    assert.ok(out.bestStreak >= 0 && out.bestStreak <= STREAK_CAP);
  }
  // 模式白名单
  assert.equal(normalize({ mode: "duel" }).mode, "duel");
  assert.equal(normalize({ mode: "riddle" }).mode, "riddle");
  assert.equal(normalize({ mode: "hack" }).mode, "spire");
});

test("星级只接受 0..3，非法键一律丢弃", () => {
  const out = normalize({
    stars: { level_1: 3, level_2: 9, level_3: -2, level_99: 2, junk: 1 },
    unlocked: TOTAL_LEVELS,
    lastLevel: TOTAL_LEVELS
  });
  assert.equal(out.stars.level_1, 3);
  assert.equal(out.stars.level_2, 3, "越界星级夹到 3");
  assert.equal(out.stars.level_3, 0, "负星级夹到 0");
  assert.equal(out.stars.level_99, undefined, "不存在的关卡键丢弃");
  assert.equal(out.stars.junk, undefined);
  assert.equal(totalStars(out), 6);
});

test("读写往返稳定，且第二次读到的内容与写入等价", () => {
  clearSave();
  const fresh = loadSave();
  assert.deepEqual(fresh, defaultSave(), "无存档时回落默认");

  const saved = normalize({ ...loadSave(), unlocked: 5, lastLevel: 4, bestScore: 1234, bestLayers: 21, bestStreak: 4 });
  assert.equal(saveSave(saved), true);
  const back = loadSave();
  assert.equal(back.unlocked, 5);
  assert.equal(back.lastLevel, 4);
  assert.equal(back.bestScore, 1234);
  assert.equal(back.bestLayers, 21);
  assert.equal(back.bestStreak, 4);
  clearSave();
  assert.deepEqual(loadSave(), defaultSave());
});

test("recordClear：推进解锁、取最高星级、刷新最好成绩", () => {
  clearSave();
  let save = loadSave();
  const level1 = LEVELS[0];
  save = recordClear(save, level1, 2, { score: 900, layers: 19, streak: 2 });
  assert.equal(save.unlocked, 2, "通过第 1 关解锁第 2 关");
  assert.equal(save.lastLevel, 1);
  assert.equal(save.stars.level_1, 2);
  assert.equal(save.clears, 1);
  assert.equal(save.bestScore, 900);

  // 重打同一关不得降低星级，也不得多加通关数以外的东西
  save = recordClear(save, level1, 1, { score: 100, layers: 18, streak: 1 });
  assert.equal(save.stars.level_1, 2, "回放低星不覆盖高星");
  assert.equal(save.bestScore, 900, "最好成绩不得倒退");
  assert.equal(save.bestLayers, 19);
  assert.equal(save.bestStreak, 2);

  save = recordClear(save, level1, 3, { score: 2000, layers: 20, streak: STREAK_CAP });
  assert.equal(save.stars.level_1, 3);
  assert.equal(save.bestStreak, STREAK_CAP, "最高连击夹到 3^18 档");

  const last = LEVELS[TOTAL_LEVELS - 1];
  save = recordClear({ ...save, unlocked: TOTAL_LEVELS }, last, 3, { score: 1, layers: 25, streak: 3 });
  assert.equal(save.unlocked, TOTAL_LEVELS, "最后一关不得把解锁数顶出范围");
  assert.equal(save.lastLevel, TOTAL_LEVELS);
  clearSave();
});

test("recordRun：只更新最好成绩，不解锁不写星", () => {
  clearSave();
  let save = loadSave();
  save = recordRun(save, { score: 500, layers: 20, streak: 3, attempts: 1 });
  assert.equal(save.unlocked, 1, "未达标不得解锁");
  assert.deepEqual(save.stars, {});
  assert.equal(save.bestScore, 500);
  assert.equal(save.bestLayers, 20);
  assert.equal(save.bestStreak, 3);
  assert.equal(save.clears, 1);

  save = recordRun(save, { score: 100, layers: 18, streak: 1 });
  assert.equal(save.bestScore, 500, "最好成绩不得倒退");
  assert.equal(save.bestLayers, 20);
  assert.equal(save.clears, 1);
  clearSave();
});

test("存储层必须带 try/catch 降级（localStorage 不可用时也不抛）", () => {
  const src = readFileSync(new URL("../js/storage.mjs", import.meta.url), "utf8");
  assert.ok(src.includes("catch"), "storage.mjs 必须有 catch 降级");
  // 无论底层是否可用，下列调用都不许抛异常
  assert.doesNotThrow(() => {
    const s = recordRun(defaultSave(), { score: 1, layers: 18, streak: 0 });
    saveSave(s);
    loadSave();
    clearSave();
  });
});
