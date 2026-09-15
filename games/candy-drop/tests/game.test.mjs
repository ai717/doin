// game.test.mjs: 控制层 —— 意图转发、终局结算、存档写入、解锁推进

import test from "node:test";
import assert from "node:assert/strict";

import { createGame } from "../js/game.mjs";
import * as store from "../js/storage.mjs";
import { levelById } from "../js/levels.mjs";
import { FIXED_DT } from "../js/engine.mjs";

/** 内存存档：复用真实 storage 的纯逻辑，避免依赖浏览器 localStorage */
function memDb() {
  let data = store.defaults();
  return {
    load: () => data,
    save: (d) => {
      data = store.normalize(d);
      return data;
    },
    clear: () => {
      data = store.defaults();
      return data;
    },
    recordResult: (d, id, r) => {
      const out = store.recordResult(d, id, r);
      data = out.data;
      return out;
    },
    setMuted: (d, m) => {
      data = store.setMuted(d, m);
      return data;
    },
    setLast: (d, id) => {
      data = store.setLast(d, id);
      return data;
    },
    isBoxUnlocked: store.isBoxUnlocked,
    isLevelUnlocked: store.isLevelUnlocked,
  };
}

function newGame() {
  const db = memDb();
  const game = createGame({ storage: db });
  return { game, db };
}

/** 横穿第 index 根绳中部的一刀 */
function sliceRope(game, index) {
  const st = game.get().state;
  const rope = st.ropes[index];
  const anchor = rope.rail
    ? { x: rope.rail.from[0], y: rope.rail.from[1] }
    : { x: rope.anchor[0], y: rope.anchor[1] };
  const mx = (anchor.x + st.candy.x) / 2;
  const my = (anchor.y + st.candy.y) / 2;
  return game.slice(mx - 30, my, mx + 30, my);
}

function advance(game, seconds) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i += 1) {
    if (!game.isPlaying()) break;
    game.tick(FIXED_DT);
  }
}

test("start：未解锁的关卡拒绝开始，已解锁的可以开始", () => {
  const { game } = newGame();
  assert.equal(game.start(1), true);
  assert.equal(game.get().screen, "playing");
  game.openLevels();
  assert.equal(game.start(3), false, "第 3 关在前一关未通关时应锁定");
  assert.equal(game.start(999), false, "越界关卡应被拒绝");
});

test("第 1 关：一刀切绳 → 三星进嘴 → 结算写入存档", () => {
  const { game, db } = newGame();
  const events = [];
  game.on((e) => events.push(e.type));
  assert.equal(game.start(1), true);

  const res = sliceRope(game, 0);
  assert.equal(res.ok, true, "划刀必须切中绳子");
  advance(game, 4);

  const snap = game.get();
  assert.equal(snap.screen, "result");
  assert.equal(snap.result.won, true);
  assert.equal(snap.result.stars, 3, `应三星通关，实际 ${snap.result.stars}`);
  assert.equal(snap.result.score, 500);
  assert.equal(snap.result.improved, true);
  assert.equal(db.load().levels[1].stars, 3);
  assert.equal(db.load().levels[1].cleared, true);
  assert.ok(events.includes("result"));
  assert.ok(events.includes("fx"), "应派发过特效事件");
});

test("通关后第 2 关解锁，next() 直接进入", () => {
  const { game } = newGame();
  game.start(1);
  sliceRope(game, 0);
  advance(game, 4);
  assert.equal(game.get().result.won, true);
  assert.equal(game.next(), true);
  assert.equal(game.get().levelId, 2);
  assert.equal(game.get().screen, "playing");
});

test("失败结算：不解锁下一关，也不记分", () => {
  const { game, db } = newGame();
  // 解锁到第 5 关（三星弧线：嘴在左下角，直接剪断所有绳会掉出盒外）
  const save = db.load();
  for (let i = 1; i <= 4; i += 1) save.levels[i] = { stars: 3, cleared: true, score: 500, best: 500 };
  db.save(save);
  assert.equal(game.start(5), true);

  // 四刀覆盖全场，把所有绳都割断
  game.slice(0, 0, 900, 620);
  game.slice(900, 0, 0, 620);
  game.slice(0, 310, 900, 310);
  game.slice(450, 0, 450, 620);
  advance(game, 10);
  const snap = game.get();
  assert.equal(snap.screen, "result");
  assert.equal(snap.result.won, false);
  assert.equal(snap.result.score, 0);
  assert.equal(db.load().levels[5].cleared, false, "失败不得标记为通关");
  assert.equal(db.load().levels[5].score, 0);
  assert.equal(game.next(), false, "失败不应解锁下一关");
});

test("终局后所有玩家意图被拒绝（no-op，不抛错）", () => {
  const { game } = newGame();
  game.start(1);
  sliceRope(game, 0);
  advance(game, 4);
  assert.equal(game.isPlaying(), false);
  for (const intent of [
    () => game.slice(0, 0, 900, 620),
    () => game.popBubble(),
    () => game.puff(0),
    () => game.slide(0, 0.5),
  ]) {
    const res = intent();
    assert.equal(res.ok, false);
    assert.equal(res.detail, "not-playing");
  }
});

test("未开始游戏时的意图被安全忽略", () => {
  const { game } = newGame();
  assert.equal(game.slice(0, 0, 100, 100).ok, false);
  assert.equal(game.puff(0).ok, false);
  assert.doesNotThrow(() => game.tick(1));
  assert.equal(game.isPlaying(), false);
});

test("retry 重置本关：切绳数归零、星归零", () => {
  const { game } = newGame();
  game.start(1);
  sliceRope(game, 0);
  assert.equal(game.get().state.cuts, 1);
  assert.equal(game.retry(), true);
  assert.equal(game.get().state.cuts, 0);
  assert.equal(game.get().state.starsTaken, 0);
  assert.equal(game.get().screen, "playing");
});

test("气泡关：popBubble 只在附着时生效", () => {
  const { game } = newGame();
  game.start(1);
  assert.equal(game.popBubble().ok, false, "无气泡时戳破应被忽略");
  assert.equal(game.hasBubble(), false);
  assert.equal(game.ropesLeft(), 1);
});

test("setMuted 写入存档并派发变更", () => {
  const { game, db } = newGame();
  let changed = 0;
  game.on((e) => {
    if (e.type === "change") changed += 1;
  });
  game.setMuted(true);
  assert.equal(db.load().muted, true);
  assert.ok(changed > 0);
});

test("resetSave 回到全新存档", () => {
  const { game, db } = newGame();
  game.start(1);
  sliceRope(game, 0);
  advance(game, 4);
  assert.equal(db.load().levels[1]?.cleared, true);
  game.resetSave();
  assert.deepEqual(game.getSave(), store.defaults());
  assert.equal(game.get().screen, "ready");
  assert.equal(game.start(2), false, "重置后第 2 关重新上锁");
});

test("每关都能被控制器装载（createState 不抛错、初始为 playing）", () => {
  const { game } = newGame();
  const db = memDb();
  const g2 = createGame({ storage: db });
  for (const id of [1, 9, 17, 25, 33, 40]) {
    // 逐关解锁：直接放行到目标关
    const save = db.load();
    for (let i = 1; i < id; i += 1) save.levels[i] = { stars: 3, cleared: true, score: 500, best: 500 };
    db.save(save);
    assert.equal(g2.start(id), true, `第 ${id} 关应可开始`);
    assert.equal(g2.get().levelId, id);
    assert.ok(g2.get().level === levelById(id));
    assert.equal(g2.isPlaying(), true);
  }
});
