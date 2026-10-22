// game.test.mjs —— 控制器：意图调度、事件派发、终局结算、视图只读、确定性帧推进、难度切换。
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, FIXED_DT } from "../js/game.mjs";
import { MODE, STATUS, OVER_REASON, pieceCells, canPlace } from "../js/engine.mjs";

/** 找当前视图第一个合法落位（暴力扫描，与 UI 锚点无关，只测控制器调度） */
function firstLegalMove(view) {
  for (let slot = 0; slot < view.queue.length; slot += 1) {
    for (let rot = 0; rot < 4; rot += 1) {
      const cells = pieceCells(view.queue[slot], rot);
      const maxR = Math.max(...cells.map((c) => c[0]));
      const maxC = Math.max(...cells.map((c) => c[1]));
      for (let row = 0; row + maxR < 8; row += 1) {
        for (let col = 0; col + maxC < 8; col += 1) {
          if (canPlace(view.board, view.queue[slot], rot, row, col)) return { slot, rot, row, col };
        }
      }
    }
  }
  return null;
}

/** 随机合法放置直到终局（返回步数） */
function playToEnd(game, maxSteps = 600) {
  let steps = 0;
  while (game.isActive() && steps < maxSteps) {
    const move = firstLegalMove(game.view());
    if (!move) break;
    assert.equal(game.place(move.slot, move.rot, move.row, move.col).ok, true);
    steps += 1;
  }
  return steps;
}

test("game: fresh controller has no view", () => {
  const game = createGame();
  assert.equal(game.view(), null);
  assert.equal(game.result(), null);
  assert.equal(game.diagnose(), null);
  assert.equal(game.isActive(), false);
  assert.equal(game.currentDifficulty(), "normal"); // 默认档
});

test("game: start deals a full queue and accepts legal placements", () => {
  const game = createGame();
  const view = game.startDifficulty("normal", 1234);
  assert.equal(view.mode, MODE.CLASSIC);
  assert.equal(view.difficulty, "normal");
  assert.equal(view.status, STATUS.PLAYING);
  assert.equal(view.queue.length, 3);
  assert.equal(game.currentDifficulty(), "normal");

  const placed = firstLegalMove(view);
  assert.ok(placed, "board must accept the first piece");
  const res = game.place(placed.slot, placed.rot, placed.row, placed.col);
  assert.equal(res.ok, true);
  assert.equal(game.view().piecesPlaced, 1);
  assert.ok(game.view().score >= 1);
  assert.equal(game.view().queue.length, 3); // 自动补块
});

test("game: unknown difficulty falls back to normal", () => {
  const game = createGame();
  const view = game.startDifficulty("nightmare", 99);
  assert.equal(view.difficulty, "normal");
  assert.equal(game.currentDifficulty(), "normal");
});

test("game: illegal placements are rejected without consuming the piece", () => {
  const game = createGame();
  game.startDifficulty("normal", 99);
  const before = JSON.stringify(game.view());
  // 先合法放一块，再尝试覆盖它占据的格（必非法）
  const move = firstLegalMove(game.view());
  assert.equal(game.place(move.slot, move.rot, move.row, move.col).ok, true);
  const mid = JSON.stringify(game.view());
  const v = game.view();
  const occIdx = v.board.findIndex((x) => x !== 0);
  const occR = Math.floor(occIdx / 8);
  const occC = occIdx % 8;
  let rejected = false;
  for (let slot = 0; slot < v.queue.length && !rejected; slot += 1) {
    for (let rot = 0; rot < 4 && !rejected; rot += 1) {
      for (const [dr, dc] of pieceCells(v.queue[slot], rot)) {
        const res = game.place(slot, rot, occR - dr, occC - dc);
        if (!res.ok && res.reason === "illegal") rejected = true;
      }
    }
  }
  assert.ok(rejected, "覆盖已占格的放置必须被拒");
  assert.equal(JSON.stringify(game.view()), mid);
  // 越界同样静默拒绝
  assert.equal(game.place(0, 0, 8, 0).ok, false);
  assert.equal(JSON.stringify(game.view()), mid);
  // 非法 slot
  assert.equal(game.place(7, 0, 3, 3).ok, false);
  assert.equal(game.view().queue.length, 3);
  assert.notEqual(before, mid);
});

test("game: placements after game over are no-ops", () => {
  const game = createGame();
  game.startDifficulty("normal", 5);
  playToEnd(game);
  assert.equal(game.isActive(), false);
  assert.equal(game.view().status, STATUS.OVER);
  assert.equal(game.view().overReason, OVER_REASON.STUCK); // 无尽模式唯一终局
  const after = JSON.stringify(game.view());
  assert.equal(game.place(0, 0, 0, 0).ok, false);
  assert.equal(game.place(0, 0, 0, 0).reason, "over");
  assert.equal(JSON.stringify(game.view()), after);
});

test("game: end event fires exactly once with a settled result", () => {
  const game = createGame();
  const ends = [];
  game.on((type, payload) => {
    if (type === "end") ends.push(payload.result);
  });
  game.startDifficulty("hard", 5);
  playToEnd(game);
  assert.equal(ends.length, 1, "end must fire exactly once");
  const result = ends[0];
  assert.equal(result.mode, MODE.CLASSIC);
  assert.equal(result.difficulty, "hard");
  assert.ok(result.score >= 0);
  assert.equal(result.overReason, OVER_REASON.STUCK);
  // 无 campaign 残留字段
  assert.equal(result.goalMet, undefined);
  assert.equal(result.levelId, undefined);
  assert.equal(result.stars, undefined);
  assert.equal(result.piecesLeft, undefined);
});

test("game: clear events carry truthful row/col/cross payloads", () => {
  const game = createGame();
  const clears = [];
  game.on((type, payload) => {
    if (type === "clear") clears.push(payload);
  });
  game.startDifficulty("normal", 4242);
  // 合法放置直到第一次消除（无尽盘面几十步内必现）
  let guard = 0;
  while (clears.length === 0 && guard < 300) {
    const move = firstLegalMove(game.view());
    if (!move) break;
    game.place(move.slot, move.rot, move.row, move.col);
    guard += 1;
  }
  assert.ok(clears.length > 0, "a normal run must produce clears");
  for (const c of clears) {
    assert.ok(Array.isArray(c.rows) && Array.isArray(c.cols));
    assert.equal(c.cross, c.rows.length > 0 && c.cols.length > 0);
    assert.ok(c.lineCount === c.rows.length + c.cols.length);
    assert.ok(c.scoreGain > 0);
    assert.equal(typeof c.combo, "number");
  }
});

test("game: restart with explicit seed reproduces; without a seed starts fresh", () => {
  const game = createGame();
  game.startDifficulty("hard", 3);
  const before = game.view();
  game.place(0, 0, 0, 0);
  game.restart(3); // 显式同种子：复现同一局
  const after = game.view();
  assert.equal(game.currentDifficulty(), "hard");
  assert.equal(after.difficulty, "hard");
  assert.equal(after.piecesPlaced, 0);
  assert.equal(after.board.join(","), before.board.join(","));
  assert.equal(after.queue.join(","), before.queue.join(","));

  game.place(0, 0, 0, 0);
  game.restart(); // 无参：换新种子开新局
  assert.equal(game.view().piecesPlaced, 0);
  assert.equal(game.view().difficulty, "hard");
});

test("game: switching difficulty resets the run", () => {
  const game = createGame();
  game.startDifficulty("easy", 11);
  assert.equal(game.view().difficulty, "easy");
  assert.equal(game.view().board.reduce((n, v) => (v !== 0 ? n + 1 : n), 0), 0); // 休闲空盘
  game.place(0, 0, 0, 0);
  game.startDifficulty("hard", 11);
  assert.equal(game.view().difficulty, "hard");
  assert.equal(game.view().piecesPlaced, 0);
  assert.ok(game.view().board.reduce((n, v) => (v !== 0 ? n + 1 : n), 0) > 0); // 大师有预填
});

test("game: view snapshots are read-only", () => {
  const game = createGame();
  game.startDifficulty("normal", 77);
  const v1 = game.view();
  const frozen = JSON.stringify(v1);
  v1.board[0] = 99;
  v1.queue.push("mono");
  v1.score = -1;
  assert.equal(JSON.stringify(game.view()), frozen);
});

test("game: tick advances particles and event timers (render reads them raw)", () => {
  // 旧版只断言「两个坏掉的控制器彼此一致」，假绿。render.mjs 的 drawParticles /
  // drawEvents 直读 life/x/y/t，引擎层不推进它们就会粒子冻屏、闪光常亮——
  // 本用例钉死推进确实发生，且确定性不丢。
  const build = () => {
    const game = createGame();
    game.startDifficulty("normal", 4242);
    let guard = 0;
    while (guard < 300) {
      const v = game.view();
      if (v.particles.length > 0 && v.events.some((e) => e.kind === "clear")) break;
      const move = firstLegalMove(v);
      if (!move) break;
      game.place(move.slot, move.rot, move.row, move.col);
      guard += 1;
    }
    return game;
  };

  const a = build();
  const v0 = a.view();
  assert.ok(v0.particles.length > 0, "消除必须产出粒子");
  const ev0 = v0.events.find((e) => e.kind === "clear");
  assert.ok(ev0, "消除必须留下 clear 事件");
  const lifes0 = v0.particles.map((p) => p.life);

  a.tick(FIXED_DT);
  const v1 = a.view();
  const lifes1 = v1.particles.map((p) => p.life);
  assert.equal(lifes1.length, lifes0.length, "一帧之内粒子不该批量消亡（寿命下限 0.5s）");
  for (let i = 0; i < lifes1.length; i += 1) {
    assert.ok(lifes1[i] < lifes0[i], "粒子寿命必须随 tick 衰减");
  }
  assert.ok(
    v1.particles[0].x !== v0.particles[0].x || v1.particles[0].y !== v0.particles[0].y,
    "粒子位置必须随 tick 飘移"
  );
  assert.ok(
    v1.events.find((e) => e.kind === "clear").t < ev0.t,
    "clear 闪光计时必须随 tick 衰减"
  );

  // 确定性不丢：同种子 + 同步进，逐比特一致
  const b = build();
  b.tick(FIXED_DT);
  assert.equal(JSON.stringify(b.view()), JSON.stringify(v1));
});

test("game: listeners can unsubscribe and throwing listeners are isolated", () => {
  const game = createGame();
  const seen = [];
  const off = game.on(() => seen.push("a"));
  game.on(() => {
    throw new Error("bad listener");
  });
  game.on(() => seen.push("c"));
  game.startDifficulty("easy", 1);
  assert.deepEqual(seen, ["a", "c"]);
  off();
  game.startDifficulty("easy", 2);
  assert.deepEqual(seen, ["a", "c", "c"]);
});

test("game: diagnose reports engine truth", () => {
  const game = createGame();
  game.startDifficulty("normal", 31337);
  game.place(0, 0, 0, 0);
  const d = game.diagnose();
  assert.equal(d.mode, MODE.CLASSIC);
  assert.equal(d.difficulty, "normal");
  assert.equal(d.status, STATUS.PLAYING);
  assert.equal(d.piecesPlaced, 1);
  assert.ok(Number.isInteger(d.filled) && d.filled >= 1 && d.filled <= 64);
});
