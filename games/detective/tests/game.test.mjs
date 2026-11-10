import test from "node:test";
import assert from "node:assert/strict";

import { CASES } from "../js/cases.mjs";
import { STAMP } from "../js/engine.mjs";
import { MAX_FRAME_MS, createGame, isUnlocked } from "../js/game.mjs";
import { emptyProgress } from "../js/storage.mjs";

function harness(options = {}) {
  const wins = [];
  const mistakes = [];
  const events = [];
  let progress = options.progress ?? emptyProgress();
  const game = createGame({
    loadProgress: () => progress,
    recordCase: (current, id, record) => {
      const next = { version: 1, lastCase: id, cases: { ...current.cases, [id]: record } };
      progress = next;
      return next;
    },
    onWin: (payload) => wins.push(payload),
    onMistake: (payload) => mistakes.push(payload),
    onEvent: (payload) => events.push(payload),
    onChange: options.onChange,
    startCaseId: options.startCaseId ?? null,
  });
  return { game, wins, mistakes, events, getProgress: () => progress };
}

function solve(game, caseData) {
  for (const who of caseData.suspects) {
    game.stamp(who, who === caseData.solution.killer ? STAMP.GUILTY : STAMP.CLEAR);
  }
  game.setWeapon(caseData.solution.weapon);
  game.setClue(caseData.solution.clue);
}

test("即开即玩：不传起点时直接落在第 1 案", () => {
  const { game } = harness();
  assert.equal(game.snapshot.caseId, 1);
  assert.equal(game.snapshot.time, "00:00");
  assert.equal(game.snapshot.paused, false);
  assert.equal(game.snapshot.sealed, false);
});

test("存档记忆：重新进入回到上次在办的案卷", () => {
  const progress = { version: 1, lastCase: 4, cases: { 1: { timeMs: 1000, mistakes: 0, stars: 2 }, 2: { timeMs: 1000, mistakes: 0, stars: 2 }, 3: { timeMs: 1000, mistakes: 0, stars: 2 } } };
  const { game } = harness({ progress });
  assert.equal(game.snapshot.caseId, 4);
});

test("未解锁案件：start 返回 false 且不改动当前盘面", () => {
  const { game } = harness();
  assert.equal(isUnlocked({ cases: {} }, 1), true);
  assert.equal(isUnlocked({ cases: {} }, 2), false);
  assert.equal(game.start(5), false);
  assert.equal(game.snapshot.caseId, 1);
});

test("印章：同色再点即撤回，异色直接覆盖", () => {
  const { game } = harness();
  const who = game.snapshot.caseData.suspects[0];
  game.stamp(who, STAMP.CLEAR);
  assert.equal(game.snapshot.stamps[who], STAMP.CLEAR);
  game.stamp(who, STAMP.CLEAR);
  assert.equal(game.snapshot.stamps[who], STAMP.UNSET);
  game.stamp(who, STAMP.GUILTY);
  assert.equal(game.snapshot.stamps[who], STAMP.GUILTY);
  game.stamp(who, STAMP.CLEAR);
  assert.equal(game.snapshot.stamps[who], STAMP.CLEAR);
});

test("判词：重复点同一件即取消选择", () => {
  const { game } = harness();
  const weapon = game.snapshot.caseData.weapons[0];
  game.setWeapon(weapon);
  assert.equal(game.snapshot.weapon, weapon);
  game.setWeapon(weapon);
  assert.equal(game.snapshot.weapon, null);
  const clue = game.snapshot.caseData.evidence[0].id;
  game.setClue(clue);
  assert.equal(game.snapshot.clue, clue);
});

test("时机未到：未填齐时盖章被拦下，不消耗误判", () => {
  const { game, mistakes, wins } = harness();
  const result = game.seal();
  assert.equal(result.blocked, true);
  assert.equal(game.snapshot.mistakes, 0);
  assert.equal(mistakes.length, 0);
  assert.equal(wins.length, 0);
});

test("正确结案：写入存档、触发 onWin 与门户事件，并冻结时钟", () => {
  const { game, wins, events, getProgress } = harness();
  const caseData = game.snapshot.caseData;
  game.tick(42_000);
  solve(game, caseData);
  const result = game.seal();
  assert.equal(result.ok, true);
  assert.equal(result.stars, 3, "零误判且用时在快档内");
  assert.equal(game.snapshot.sealed, true);
  assert.equal(wins.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, "WON");
  assert.equal(events[0].slug, "detective");
  assert.equal(getProgress().cases[1].stars, 3);
  assert.equal(getProgress().lastCase, 1);

  const before = game.snapshot.elapsed;
  game.tick(5000);
  assert.equal(game.snapshot.elapsed, before, "结案后计时必须停住");
});

test("错判：扣信誉星、盘面保留、可继续修正", () => {
  const { game, mistakes, wins } = harness();
  const caseData = game.snapshot.caseData;
  solve(game, { ...caseData, solution: { ...caseData.solution, killer: caseData.suspects[1] } });
  const result = game.seal();
  assert.equal(result.ok, false);
  assert.ok(result.flaws.length > 0);
  assert.equal(game.snapshot.mistakes, 1);
  assert.equal(game.snapshot.sealed, false);
  assert.equal(mistakes.length, 1);
  assert.equal(wins.length, 0);
  assert.equal(game.snapshot.stamps[caseData.suspects[1]], STAMP.GUILTY, "指认不被清空");

  game.stamp(caseData.suspects[1], STAMP.CLEAR);
  game.stamp(caseData.solution.killer, STAMP.GUILTY);
  const second = game.seal();
  assert.equal(second.ok, true);
  assert.equal(second.stars, 2, "一次误判封顶二星");
});

test("时钟：暂停不计时，单帧增量被夹住，重置归零", () => {
  const { game } = harness();
  game.tick(200);
  game.tick(300);
  assert.equal(game.snapshot.elapsed, 200 + MAX_FRAME_MS, "超过上限的帧增量被夹住");
  const base = game.snapshot.elapsed;
  game.pause();
  game.tick(5000);
  assert.equal(game.snapshot.elapsed, base, "暂停时计时器冻结");
  game.resume();
  game.tick(9000);
  assert.equal(game.snapshot.elapsed, base + MAX_FRAME_MS);
  game.tick(-100);
  assert.equal(game.snapshot.elapsed, base + MAX_FRAME_MS, "负增量被忽略");
  game.restart();
  assert.equal(game.snapshot.elapsed, 0);
  assert.equal(game.snapshot.mistakes, 0);
});

test("换案：通关后 next 前进，未解锁与末案都停在原地", () => {
  const { game } = harness();
  assert.equal(game.next(), false, "第 2 案尚未解锁，不允许跳关");
  solve(game, game.snapshot.caseData);
  game.seal();
  assert.equal(game.next(), true);
  assert.equal(game.snapshot.caseId, 2);
  const last = harness({ progress: { version: 1, lastCase: 12, cases: Object.fromEntries(CASES.slice(0, 11).map((item) => [item.id, { timeMs: 1000, mistakes: 0, stars: 3 }])) } });
  assert.equal(last.game.snapshot.caseId, 12);
  assert.equal(last.game.next(), false);
});

test("通关一案后自动解锁下一案", () => {
  const progress = emptyProgress();
  const { game, getProgress } = harness({ progress });
  solve(game, game.snapshot.caseData);
  game.seal();
  assert.equal(isUnlocked(getProgress(), 2), true);
  assert.equal(game.start(2), true);
});

test("快照可序列化，且不含函数或循环引用", () => {
  const { game } = harness();
  const snapshot = game.snapshot;
  assert.doesNotThrow(() => JSON.stringify(snapshot));
  assert.equal(typeof snapshot.caseData, "object");
  assert.equal(snapshot.total, snapshot.caseData.suspects.length);
});

test("随机意图轰炸：控制器不抛错且不变式守恒", () => {
  const { game } = harness();
  let seed = 99;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const stamps = [STAMP.CLEAR, STAMP.GUILTY, STAMP.UNSET];
  for (let i = 0; i < 600; i += 1) {
    const snapshot = game.snapshot;
    const who = snapshot.caseData.suspects[Math.floor(random() * snapshot.caseData.suspects.length)];
    const roll = random();
    if (roll < 0.4) game.stamp(who, stamps[Math.floor(random() * 3)]);
    else if (roll < 0.5) game.cycle(who);
    else if (roll < 0.6) game.setWeapon(snapshot.caseData.weapons[Math.floor(random() * 3)]);
    else if (roll < 0.7) game.setClue(snapshot.caseData.evidence[Math.floor(random() * snapshot.caseData.evidence.length)].id);
    else if (roll < 0.8) game.seal();
    else if (roll < 0.85) game.tick(random() * 400);
    else if (roll < 0.9) game.togglePause();
    else game.restart();

    assert.ok(game.snapshot.mistakes < 600);
    assert.equal(typeof game.snapshot.ready, "boolean");
    assert.doesNotThrow(() => JSON.stringify(game.snapshot));
  }
});
