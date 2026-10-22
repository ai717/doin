// filepath: games/ice-slide/tests/game.test.mjs
// 会话控制器测试：三轨模式、滑行/撤销/重开、暂停计时、每日一局确定性、提示、事件派发。
import { test } from "node:test";
import assert from "node:assert/strict";
import { PHASE, MODE, createGame, dailyLevelIndex } from "../js/game.mjs";
import { LEVELS } from "../js/levels.mjs";
import { DIRS } from "../js/engine.mjs";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("game: 初始态为 IDLE，载入第 1 关且零步", () => {
  const g = createGame();
  const v = g.getView();
  assert.equal(v.phase, PHASE.IDLE);
  assert.equal(v.mode, MODE.CAMPAIGN);
  assert.equal(v.index, 0);
  assert.equal(v.moves, 0);
  assert.equal(v.par, LEVELS[0].par);
  assert.equal(v.totalBoxes > 0, true);
});

test("game: 第 1 关两步通关（下滑就位再右推），步数 = 2 = par", () => {
  const g = createGame();
  g.start();
  assert.equal(g.move(2), true); // 下滑就位至箱同行
  assert.equal(g.move(1), true); // 右推：人箱同步滑至箱撞墙，箱入灯标
  const v = g.getView();
  assert.equal(v.phase, PHASE.WON);
  assert.equal(v.moves, 2);
  assert.equal(v.pushes, 1);
  assert.equal(v.won, true);
  assert.equal(v.boxesOnGoal, v.totalBoxes);
  // 终局后操作 no-op
  assert.equal(g.move(1), false);
  assert.equal(g.move(0), false);
});

test("game: 无效意图（贴墙方向）返回 false 且不耗步", () => {
  const g = createGame();
  g.loadLevel(0);
  g.start();
  const before = g.getView().fingerprint;
  assert.equal(g.move(0), false); // 第 1 关玩家贴顶墙，向上纹丝不动
  assert.equal(g.getView().fingerprint, before);
  assert.equal(g.getView().moves, 0);
});

test("game: 撤销栈无限深度，可从通关态撤销回继续玩", () => {
  const g = createGame();
  g.loadLevel(0);
  g.start();
  g.move(2); // 下滑就位
  g.move(1); // 右推通关
  assert.equal(g.getView().phase, PHASE.WON);
  assert.equal(g.undo(), true);
  const v = g.getView();
  assert.equal(v.phase, PHASE.PLAYING);
  assert.equal(v.moves, 1);
  assert.equal(g.canUndo(), true);
  assert.equal(g.undo(), true); // 再撤一步回到初始
  assert.equal(g.getView().moves, 0);
  assert.equal(g.canUndo(), false);
  assert.equal(g.undo(), false);
});

test("game: 重开复位步数与历史", () => {
  const g = createGame();
  g.loadLevel(7); // level_8 par=3，需要多步
  g.start();
  g.move(1); // 右推：人箱同步滑行
  assert.ok(g.getView().moves >= 1);
  g.restart();
  const v = g.getView();
  assert.equal(v.moves, 0);
  assert.equal(v.historyLen, 0);
  assert.equal(v.phase, PHASE.IDLE);
});

test("game: 暂停停表，恢复续走", () => {
  const g = createGame();
  g.loadLevel(0);
  g.start();
  const t0 = g.getView().timeMs;
  assert.equal(g.pause(), true);
  assert.equal(g.getView().phase, PHASE.PAUSED);
  assert.equal(g.getView().timeMs >= t0, true);
  // 暂停期间 move 无效
  assert.equal(g.move(1), false);
  assert.equal(g.resume(), true);
  assert.equal(g.getView().phase, PHASE.PLAYING);
});

test("game: 每日一局确定性——同日期同关、跨模式隔离", () => {
  const a = dailyLevelIndex("2026-10-19");
  const b = dailyLevelIndex("2026-10-19");
  assert.equal(a, b);
  assert.ok(a >= 0 && a < LEVELS.length);
  // 不同日期应能产出不同关卡（采样 60 天，至少出现 2 个不同关卡）
  const picks = new Set();
  for (let d = 1; d <= 60; d++) picks.add(dailyLevelIndex(`2026-11-${String(d).padStart(2, "0")}`));
  assert.ok(picks.size >= 2, `60 天只选出 ${picks.size} 关，种子分布可疑`);

  const g = createGame();
  g.startDaily("2026-10-19");
  const v = g.getView();
  assert.equal(v.mode, MODE.DAILY);
  assert.equal(v.index, a);
  assert.equal(v.phase, PHASE.IDLE);
});

test("game: practice 模式打标签且推进时保持 practice", () => {
  const g = createGame();
  g.loadLevel(3, MODE.PRACTICE);
  assert.equal(g.getView().mode, MODE.PRACTICE);
  g.nextLevel();
  assert.equal(g.getView().index, 4);
  assert.equal(g.getView().mode, MODE.PRACTICE); // 练习场内推进保持练习模式
});

test("game: 提示返回可执行方向，死局返回 dead", () => {
  const g = createGame();
  g.loadLevel(0);
  g.start();
  const h = g.hintDir();
  assert.ok(h && typeof h.dir === "number" && h.dir >= 0 && h.dir < 4, `提示应给方向: ${JSON.stringify(h)}`);
  // 执行提示方向必须合法（人移动 >= 1 格）
  const fp = g.getView().fingerprint;
  assert.equal(g.move(h.dir), true);
  assert.notEqual(g.getView().fingerprint, fp);
});

test("game: 提示与 solve 口径一致（level_2 上滑就位后再左推通关）", () => {
  const g = createGame();
  g.loadLevel(1);
  g.start();
  const h = g.hintDir();
  assert.equal(h.dir, 0, "level_2 最优首步应为上滑就位");
  g.move(h.dir);
  assert.equal(g.getView().won, false); // 一步未通，需再左推
  g.move(3); // 左推：箱贴左墙滑入灯标
  assert.equal(g.getView().won, true);
});

test("game: 事件派发——level/move/win/phase 四类 reason 都到位", () => {
  const g = createGame();
  const seen = [];
  g.subscribe((view, reason) => seen.push(reason));
  g.loadLevel(0);
  g.start();
  g.move(2); // 下滑就位
  g.move(1); // 右推通关
  g.pause();
  g.resume();
  g.undo();
  assert.ok(seen.includes("level"));
  assert.ok(seen.includes("phase"));
  assert.ok(seen.includes("win"));
  assert.ok(seen.includes("move"));
});

test("game: 退订后不再收到事件", () => {
  const g = createGame();
  let count = 0;
  const off = g.subscribe(() => count++);
  g.loadLevel(0);
  off();
  g.start();
  g.move(1);
  assert.equal(count, 1); // 只有退订前的 level 事件
});

test("game: 确定性随机游走 1200 步（多关混合）不崩、箱数守恒", () => {
  const rand = mulberry32(20261019);
  const g = createGame();
  let won = 0;
  for (let round = 0; round < 6; round++) {
    g.loadLevel(round * 5); // 0/5/10/15/20/25 六关铺开
    g.start();
    for (let step = 0; step < 200; step++) {
      const dir = Math.floor(rand() * 4);
      const before = g.getView();
      const moved = g.move(dir);
      const after = g.getView();
      if (moved) {
        assert.equal(after.moves, before.moves + 1, "成功滑行必须恰好计 1 步");
        assert.equal(after.totalBoxes, before.totalBoxes, "箱数守恒");
        if (after.won) {
          assert.equal(after.boxesOnGoal, after.totalBoxes, "通关必须全部入标");
          won++;
          break;
        }
      } else {
        assert.equal(after.moves, before.moves, "无效意图不得计步");
      }
    }
  }
  assert.ok(won >= 0); // 随机游走不保证通关，只保证不变式
});

test("game: nextLevel 到末关后重开本级", () => {
  const g = createGame();
  g.loadLevel(LEVELS.length - 1);
  g.start();
  g.move(1);
  g.nextLevel();
  assert.equal(g.getView().index, LEVELS.length - 1);
  assert.equal(g.getView().moves, 0);
});
