import test from "node:test";
import assert from "node:assert/strict";

import {
  createSession,
  select,
  step,
  setPaused,
  cancelSelection,
  drainEvents,
  debugSolveAll,
  debugSolvePair,
  snapshot,
  PICK_LOCK,
} from "../js/engine.mjs";

function charIndexFor(session, oracleIndex) {
  return session.charOrder.indexOf(session.oracleOrder[oracleIndex]);
}

function wrongCharIndexFor(session, oracleIndex) {
  const target = session.oracleOrder[oracleIndex];
  return session.charOrder.findIndex((pair) => pair !== target);
}

function solveAll(session) {
  for (let pairIndex = 0; pairIndex < session.pairs.length; pairIndex += 1) {
    if (session.status !== "playing") break;
    const oracleIndex = session.oracleOrder.indexOf(pairIndex);
    const charIndex = session.charOrder.indexOf(pairIndex);
    select(session, "oracle", oracleIndex);
    select(session, "char", charIndex);
    step(session, 0.2);
  }
}

function makeWrong(session, oracleIndex = 0) {
  select(session, "oracle", oracleIndex);
  select(session, "char", wrongCharIndexFor(session, oracleIndex));
  step(session, 0.2);
}

test("引擎：开局是可玩状态且双列均为乱序", () => {
  const session = createSession({ levelIndex: 0, seed: 42 });
  assert.equal(session.status, "playing");
  assert.equal(session.pairs.length, 4);
  assert.equal(session.matches.length, 0);
  assert.equal(session.errors, 0);
  assert.equal(session.time, 0);
  assert.deepEqual([...session.oracleOrder].sort(), [0, 1, 2, 3]);
  assert.deepEqual([...session.charOrder].sort(), [0, 1, 2, 3]);
  for (let index = 0; index < session.pairs.length; index += 1) {
    assert.notEqual(session.oracleOrder[index], session.charOrder[index], "同一位置不应直接对齐");
  }
});

test("引擎：同种子完全确定，换种子打乱顺序", () => {
  const a = createSession({ levelIndex: 5, seed: 777 });
  const b = createSession({ levelIndex: 5, seed: 777 });
  const c = createSession({ levelIndex: 5, seed: 778 });
  assert.deepEqual(a.oracleOrder, b.oracleOrder);
  assert.deepEqual(a.charOrder, b.charOrder);
  assert.notDeepEqual([a.oracleOrder, a.charOrder], [c.oracleOrder, c.charOrder]);
});

test("引擎：正确配对点亮并锁定，错误只记一次且不惩罚", () => {
  const session = createSession({ levelIndex: 0, seed: 42 });
  const oracleIndex = 0;
  const first = select(session, "oracle", oracleIndex);
  assert.equal(first.type, "pick");
  assert.deepEqual(session.selected, { side: "oracle", index: oracleIndex });

  const matched = select(session, "char", charIndexFor(session, oracleIndex));
  assert.equal(matched.type, "match");
  assert.equal(session.matches.length, 1);
  assert.equal(session.errors, 0);
  assert.equal(session.selected, null);
  assert.ok(session.lock > 0);

  const wrongSession = createSession({ levelIndex: 0, seed: 42 });
  makeWrong(wrongSession, 0);
  assert.equal(wrongSession.errors, 1);
  assert.equal(wrongSession.matches.length, 0);
  assert.ok(wrongSession.wrong);
  assert.equal(wrongSession.status, "playing");
});

test("引擎：同卡再点取消，换卡切换选择，顺序可反", () => {
  const session = createSession({ levelIndex: 0, seed: 9 });
  assert.equal(select(session, "oracle", 0).type, "pick");
  assert.equal(select(session, "oracle", 0).type, "cancel");
  assert.equal(session.selected, null);
  assert.equal(select(session, "oracle", 1).type, "pick");
  assert.equal(select(session, "oracle", 2).type, "pick");
  assert.deepEqual(session.selected, { side: "oracle", index: 2 });
  assert.equal(cancelSelection(session).type, "cancel");

  const reverse = createSession({ levelIndex: 0, seed: 9 });
  const oracleIndex = 1;
  select(reverse, "char", charIndexFor(reverse, oracleIndex));
  const event = select(reverse, "oracle", oracleIndex);
  assert.equal(event.type, "match");
});

test("引擎：判定后 120ms 内忽略连点", () => {
  const session = createSession({ levelIndex: 0, seed: 42 });
  select(session, "oracle", 0);
  select(session, "char", charIndexFor(session, 0));
  assert.equal(session.lock, PICK_LOCK);
  assert.equal(select(session, "oracle", 1), null);
  step(session, PICK_LOCK / 2);
  assert.equal(select(session, "oracle", 1), null);
  step(session, PICK_LOCK / 2 + 0.01);
  assert.equal(select(session, "oracle", 1).type, "pick");
});

test("引擎：零误配三星、一至二次二星、三次以上一星", () => {
  const perfect = createSession({ levelIndex: 1, seed: 2 });
  solveAll(perfect);
  assert.equal(perfect.status, "cleared");
  assert.equal(perfect.stars, 3);

  const twoMiss = createSession({ levelIndex: 1, seed: 2 });
  makeWrong(twoMiss, 0);
  makeWrong(twoMiss, 1);
  solveAll(twoMiss);
  assert.equal(twoMiss.status, "cleared");
  assert.equal(twoMiss.stars, 2);

  const threeMiss = createSession({ levelIndex: 1, seed: 2 });
  makeWrong(threeMiss, 0);
  makeWrong(threeMiss, 1);
  makeWrong(threeMiss, 2);
  solveAll(threeMiss);
  assert.equal(threeMiss.status, "cleared");
  assert.equal(threeMiss.stars, 1);
});

test("引擎：暂停冻结计时，继续恢复", () => {
  const session = createSession({ levelIndex: 0, seed: 3 });
  step(session, 1.5);
  const before = session.time;
  setPaused(session, true);
  step(session, 5);
  assert.equal(session.time, before);
  setPaused(session, false);
  step(session, 1);
  assert.ok(session.time > before);
});

test("引擎：调试接口可逐对或整关完成", () => {
  const pairSession = createSession({ levelIndex: 2, seed: 5 });
  const event = debugSolvePair(pairSession, 0);
  assert.equal(event.type, "match");
  assert.equal(pairSession.matches.length, 1);

  const allSession = createSession({ levelIndex: 2, seed: 5 });
  allSession.errors = 2;
  debugSolveAll(allSession);
  assert.equal(allSession.status, "cleared");
  assert.equal(allSession.matches.length, allSession.pairs.length);
  assert.equal(allSession.stars, 2);
});

test("引擎：事件队列可排空且快照与内部状态隔离", () => {
  const session = createSession({ levelIndex: 0, seed: 4 });
  select(session, "oracle", 0);
  const events = drainEvents(session);
  assert.equal(events.length, 1);
  assert.equal(drainEvents(session).length, 0);

  const shot = snapshot(session);
  shot.oracleOrder[0] = 99;
  shot.pairs.length = 0;
  assert.notEqual(session.oracleOrder[0], 99);
  assert.ok(session.pairs.length > 0);
});

test("引擎：非法输入不抛错且返回空事件", () => {
  const session = createSession({ levelIndex: 0, seed: 4 });
  assert.equal(select(session, "nope", 0), null);
  assert.equal(select(session, "oracle", -1), null);
  assert.equal(select(session, "oracle", 99), null);
  assert.equal(select(null, "oracle", 0), null);
  assert.equal(debugSolvePair(session, 99), null);
  assert.equal(debugSolvePair(session, -1), null);
});

test("引擎：1200 步随机游走不抛错且不变量成立", () => {
  let session = createSession({ levelIndex: 0, seed: 12345 });
  let state = 0x9e3779b9;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 0; i < 1200; i += 1) {
    step(session, 1 / 60);
    if (rand() < 0.38) {
      const side = rand() < 0.5 ? "oracle" : "char";
      const index = Math.floor(rand() * session.pairs.length);
      select(session, side, index);
      step(session, 1 / 60);
    }
    if (session.status === "cleared" && rand() < 0.08) {
      session = createSession({ levelIndex: Math.floor(rand() * 24), seed: i + 1 });
    }
    assert.ok(session.matches.length <= session.pairs.length);
    assert.ok(session.errors >= 0);
    assert.ok(session.time >= 0);
    if (session.selected) {
      const order = session.selected.side === "oracle" ? session.oracleOrder : session.charOrder;
      assert.ok(session.selected.index >= 0 && session.selected.index < order.length);
    }
  }
});
