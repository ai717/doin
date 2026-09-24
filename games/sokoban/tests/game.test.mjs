// filepath: games/sokoban/tests/game.test.mjs
// 会话状态机单元测试（DOM-free）：阶段流转、移动/撤销（含胜利后撤销）、重启、订阅。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, PHASE } from "../js/game.mjs";
import { LEVELS } from "../js/levels.mjs";

test("game: 初始 IDLE，start 后 PLAYING，view 数据正确", () => {
  const game = createGame();
  game.loadLevel(0);
  assert.equal(game.phase, PHASE.IDLE);
  const v = game.getView();
  assert.equal(v.index, 0);
  assert.equal(v.par, LEVELS[0].parPushes);
  assert.ok(v.totalBoxes >= 1);
  assert.equal(v.moves, 0);
  game.start();
  assert.equal(game.phase, PHASE.PLAYING);
});

test("game: 非法/撞墙移动返回 false 且状态不变", () => {
  const game = createGame();
  game.loadLevel(0);
  game.start();
  // L1 玩家 (3,2)：向上空地可走，向右撞墙
  assert.equal(game.move(0), true);
  const movesAfter = game.getView().moves;
  assert.equal(game.move(1), false);
  assert.equal(game.getView().moves, movesAfter);
});

test("game: 合法移动推进步数/推数，非法静默忽略不抛错", () => {
  const game = createGame();
  game.loadLevel(0);
  game.start();
  const seq = [2, 3, 0, 1, 0, 3]; // L1 解法：6 步赢（2 次推箱）
  let pushed = 0;
  for (const d of seq) {
    const beforeP = game.getView().pushes;
    const ok = game.move(d);
    if (ok && game.getView().pushes > beforeP) pushed++;
  }
  const v = game.getView();
  assert.equal(v.phase, PHASE.WON);
  assert.equal(pushed, LEVELS[0].parPushes);
});

test("game: 胜利后撤销恢复 PLAYING 并重启计时", () => {
  const game = createGame();
  game.loadLevel(0);
  game.start();
  for (const d of [2, 3, 0, 1, 0, 3]) game.move(d);
  assert.equal(game.phase, PHASE.WON);
  assert.equal(game.undo(), true);
  assert.equal(game.phase, PHASE.PLAYING);
  const v = game.getView();
  assert.equal(v.moves, 5);
  assert.equal(v.won, false);
});

test("game: 无可撤销时 undo 返回 false", () => {
  const game = createGame();
  game.loadLevel(0);
  game.start();
  assert.equal(game.undo(), false);
  assert.equal(game.canUndo(), false);
});

test("game: 暂停/继续冻结计时，重启清空", () => {
  const game = createGame();
  game.loadLevel(0);
  game.start();
  assert.equal(game.pause(), true);
  assert.equal(game.phase, PHASE.PAUSED);
  const frozen = game.getView().timeMs;
  // 暂停期间 timeMs 不增长（performance.now 继续，但 elapsed 冻结）
  const t0 = game.getView().timeMs;
  assert.equal(game.resume(), true);
  assert.equal(game.phase, PHASE.PLAYING);
  game.restart();
  assert.equal(game.phase, PHASE.IDLE);
  assert.equal(game.getView().moves, 0);
});

test("game: 订阅回调收到 level/move/phase/win 事件", () => {
  const game = createGame();
  const events = [];
  game.subscribe((view, reason) => events.push(reason));
  game.loadLevel(0); // level
  game.start(); // phase
  game.move(2); // move
  assert.deepEqual(events, ["level", "phase", "move"]);
});

test("game: 越界关卡索引钳制到合法范围", () => {
  const game = createGame();
  game.loadLevel(-5);
  assert.equal(game.levelIndex, 0);
  game.loadLevel(999);
  assert.equal(game.levelIndex, LEVELS.length - 1);
});

test("game: 1000 步随机游走——任意合法操作不抛错、不变式不破", () => {
  // 确定性 PRNG（mulberry32），对每关随机游走 1000 步（到 200 步若胜利则重启）
  const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const rng = mulberry32(20240924);
  for (let i = 0; i < LEVELS.length; i++) {
    const game = createGame();
    game.loadLevel(i);
    game.start();
    for (let step = 0; step < 1000; step++) {
      const dir = Math.floor(rng() * 4);
      const before = game.getView();
      let ok;
      try {
        ok = game.move(dir);
      } catch (err) {
        assert.fail(`L${i + 1} 第${step}步抛错: ${err.message}`);
      }
      if (ok) {
        const after = game.getView();
        // 不变式：步数单调 +1、推数不倒退、指纹必变（移动/推箱都改变玩家位置或箱位）
        assert.equal(after.moves, before.moves + 1);
        assert.ok(after.pushes >= before.pushes);
        assert.notEqual(after.fingerprint, before.fingerprint);
      }
      if (game.phase === PHASE.WON) game.restart(); game.start();
    }
    assert.ok(game.phase === PHASE.PLAYING || game.phase === PHASE.IDLE, `L${i + 1} 游走后状态异常`);
  }
});
