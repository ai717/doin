// 恶魔迷途 · 控制器层测试
// 重点：固定步长累积器的确定性、暂停语义、事件派发、关卡流转。

import test from "node:test";
import assert from "node:assert/strict";

import { DevilRunGame, FIXED_DT, MAX_STEPS_FRAME } from "../js/game.mjs";
import { LEVEL_COUNT } from "../js/levels.mjs";
import GOLDEN from "../js/golden.mjs";

function toTrace(rows) {
  return rows.map((r) => ({ t: r[0], left: Boolean(r[1]), right: Boolean(r[2]), jump: Boolean(r[3]) }));
}

// 用某个基准帧长跑 n 次，返回玩家最终位置
function runFrames(game, frameDt, frames) {
  for (let f = 0; f < frames; f++) game.tick(frameDt);
  return { x: game.state.player.x, y: game.state.player.y };
}

// ---------------------------------------------------------------- 构造

test("构造时载入第 1 关，处于可玩状态", () => {
  const g = new DevilRunGame();
  assert.equal(g.levelIndex, 0);
  assert.equal(g.phase, "playing");
  assert.equal(g.isPaused, false);
  assert.ok(g.state, "应有初始状态");
  assert.equal(g.isWon, false);
});

test("静态属性暴露关卡总数与节点表", () => {
  assert.equal(DevilRunGame.levelCount, LEVEL_COUNT);
  assert.equal(DevilRunGame.nodes.length, 10);
});

test("固定步长常量符合 60Hz 设计", () => {
  assert.equal(FIXED_DT, 1 / 60);
  assert.ok(MAX_STEPS_FRAME >= 2, "追帧上限至少 2 才可能追上掉帧");
  assert.ok(MAX_STEPS_FRAME <= 10, "追帧上限过高会导致卡顿后瞬移");
});

// ---------------------------------------------------------------- 输入语义

test("setInput 只接受已知输入名，未知名称被忽略", () => {
  const g = new DevilRunGame();
  g.setInput("right", true);
  assert.equal(g.inputs.right, true);
  g.setInput("fly", true);
  assert.equal("fly" in g.inputs, false, "未知输入不应被写入");
});

test("setInput 把值强制转为布尔", () => {
  const g = new DevilRunGame();
  g.setInput("jump", 1);
  assert.equal(g.inputs.jump, true);
  g.setInput("jump", 0);
  assert.equal(g.inputs.jump, false);
});

test("clearInputs 把所有输入复位", () => {
  const g = new DevilRunGame();
  g.setInput("left", true);
  g.setInput("right", true);
  g.setInput("jump", true);
  g.clearInputs();
  assert.deepEqual(g.inputs, { left: false, right: false, jump: false, restart: false });
});

// ---------------------------------------------------------------- 确定性

test("固定步长累积器：均匀帧与抖动帧的物理结果一致", () => {
  // 严格对齐总时长：两边都跑 2.0 秒。
  // 均匀：120 × 1/60
  // 抖动：40 组 (1/30 + 1/120 + 1/120 + 1/240×?) —— 这里用 40 × (1/30 + 1/60)
  //       即 40 × 0.05 = 2.0 秒，共 80 次 tick
  const a = new DevilRunGame({ levelIndex: 2 });
  a.setInput("right", true);
  for (let f = 0; f < 120; f++) a.tick(1 / 60);

  const b = new DevilRunGame({ levelIndex: 2 });
  b.setInput("right", true);
  for (let f = 0; f < 40; f++) {
    b.tick(1 / 30);  // 0.0333...
    b.tick(1 / 60);  // 0.0166...
  }
  // 总时长一致 = 2.0s

  assert.ok(
    Math.abs(a.state.player.x - b.state.player.x) < 1.5,
    `均匀 ${a.state.player.x.toFixed(2)} vs 抖动 ${b.state.player.x.toFixed(2)} 偏差过大`
  );
});

test("相同输入序列两次运行结果完全一致", () => {
  const mk = () => {
    const g = new DevilRunGame({ levelIndex: 7 });
    g.setInput("right", true);
    for (let f = 0; f < 200; f++) {
      if (f % 25 === 0) g.setInput("jump", true);
      if (f % 25 === 4) g.setInput("jump", false);
      g.tick(1 / 60);
    }
    return g;
  };
  const a = mk();
  const b = mk();
  assert.equal(a.state.player.x, b.state.player.x);
  assert.equal(a.state.player.y, b.state.player.y);
  assert.equal(a.state.stats.deaths, b.state.stats.deaths);
});

test("单帧超大 dt 不会让物理暴走（追帧上限 + 积压丢弃）", () => {
  const g = new DevilRunGame({ levelIndex: 2 });
  g.setInput("right", true);
  const before = g.state.player.x;
  g.tick(5); // 5 秒的巨大帧
  const moved = Math.abs(g.state.player.x - before);
  assert.ok(moved < 30, `单帧位移 ${moved.toFixed(1)} 过大，追帧兜底失效`);
  assert.equal(g.accumulator, 0, "触发追帧上限后应丢弃积压");
});

test("dt 为 0 / 负数 / NaN 时按单步处理，不破坏状态", () => {
  for (const bad of [0, -1, NaN, Infinity, "x", null]) {
    const g = new DevilRunGame({ levelIndex: 0 });
    g.setInput("right", true);
    assert.doesNotThrow(() => g.tick(bad), `dt=${bad} 不应抛错`);
    assert.equal(Number.isFinite(g.state.player.x), true);
  }
});

// ---------------------------------------------------------------- 事件派发

test("死亡时 tick 返回 death 与 deaths_added 事件，且计数器同步", () => {
  const g = new DevilRunGame({ levelIndex: 10 }); // 地刺关
  g.setInput("right", true);
  let deathsEvents = 0;
  let addedTotal = 0;
  for (let f = 0; f < 60 * 20; f++) {
    const evs = g.tick(1 / 60);
    for (const ev of evs) {
      if (ev.type === "death") deathsEvents++;
      if (ev.type === "deaths_added") addedTotal += ev.count;
    }
    if (g.isWon) break;
  }
  assert.ok(g.state.stats.deaths > 0, "该关一路右跑应触发死亡");
  assert.equal(deathsEvents, g.state.stats.deaths, "death 事件数应等于死亡数");
  assert.equal(addedTotal, g.state.stats.deaths, "deaths_added 累计应等于死亡数");
  assert.equal(g.runDeaths, g.state.stats.deaths, "runDeaths 应与死亡数同步");
});

test("通关时 emit win 事件，且带齐结算数据", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  const wins = [];
  g.subscribe((ev) => { if (ev.type === "win") wins.push(ev); });
  const trace = toTrace(GOLDEN[0]);
  // 按黄金轨迹的输入逐帧驱动控制器
  for (let f = 0; f < 60 * 20 && !g.isWon; f++) {
    const cur = trace[Math.min(f, trace.length - 1)];
    g.setInput("left", cur.left);
    g.setInput("right", cur.right);
    g.setInput("jump", cur.jump);
    g.tick(1 / 60);
  }
  assert.equal(g.isWon, true, "应能通关");
  assert.equal(wins.length, 1, "应恰好派发一次 win");
  const w = wins[0];
  assert.equal(w.levelIndex, 0);
  assert.ok(w.seals && typeof w.seals.clear === "boolean");
  assert.equal(typeof w.elapsed, "number");
  assert.equal(typeof w.deaths, "number");
});

test("通关后 tick 不再产生事件，也不推进时间（终局冻结）", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  const trace = toTrace(GOLDEN[0]);
  for (let f = 0; f < 60 * 20 && !g.isWon; f++) {
    const cur = trace[Math.min(f, trace.length - 1)];
    g.setInput("left", cur.left);
    g.setInput("right", cur.right);
    g.setInput("jump", cur.jump);
    g.tick(1 / 60);
  }
  assert.equal(g.isWon, true);
  const frozen = g.state.elapsed;
  const after = g.tick(1 / 60);
  assert.deepEqual(after, [], "通关后不应再有事件");
  assert.equal(g.state.elapsed, frozen, "通关后时间应冻结");
});

test("订阅者抛错不影响游戏推进（监听者隔离）", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  g.subscribe(() => { throw new Error("listener boom"); });
  g.setInput("right", true);
  assert.doesNotThrow(() => {
    for (let f = 0; f < 60; f++) g.tick(1 / 60);
  });
  assert.equal(Number.isFinite(g.state.player.x), true);
});

test("subscribe 返回退订函数，退订后不再收到事件", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  let count = 0;
  const off = g.subscribe(() => { count++; });
  g.startLevel(3);
  assert.equal(count, 1);
  off();
  g.startLevel(4);
  assert.equal(count, 1, "退订后不应再计数");
});

// ---------------------------------------------------------------- 暂停

test("暂停时 tick 不推进物理与时间", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  g.setInput("right", true);
  for (let f = 0; f < 30; f++) g.tick(1 / 60);
  const x = g.state.player.x;
  const t = g.state.elapsed;
  g.setPaused(true);
  for (let f = 0; f < 60; f++) g.tick(1 / 60);
  assert.equal(g.state.player.x, x, "暂停时位置不应变化");
  assert.equal(g.state.elapsed, t, "暂停时时间不应推进");
  assert.deepEqual(g.tick(1 / 60), [], "暂停时不应产生事件");
});

test("恢复时清空积压，避免补帧暴走", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  g.setInput("right", true);
  for (let f = 0; f < 30; f++) g.tick(1 / 60);
  g.setPaused(true);
  const x = g.state.player.x;
  g.setPaused(false);
  assert.equal(g.accumulator, 0, "恢复时应清空累积器");
  // 恢复后第一帧只推进一个物理步，不应瞬移
  g.tick(1 / 60);
  assert.ok(
    Math.abs(g.state.player.x - x) < 1,
    `恢复首帧位移 ${Math.abs(g.state.player.x - x).toFixed(2)} 过大`
  );
});

test("暂停切换派发 pause_toggled 事件，且重复设置不重复派发", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  const events = [];
  g.subscribe((ev) => { if (ev.type === "pause_toggled") events.push(ev); });
  g.setPaused(true);
  g.setPaused(true); // 重复
  g.setPaused(false);
  assert.equal(events.length, 2, "重复设置同值不应重复派发");
  assert.equal(events[0].isPaused, true);
  assert.equal(events[1].isPaused, false);
});

test("togglePause 正确翻转暂停状态", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  g.togglePause();
  assert.equal(g.isPaused, true);
  g.togglePause();
  assert.equal(g.isPaused, false);
});

// ---------------------------------------------------------------- 关卡流转

test("startLevel 切关并重置本次运行统计", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  g.setInput("right", true);
  for (let f = 0; f < 300; f++) g.tick(1 / 60);
  g.startLevel(5);
  assert.equal(g.levelIndex, 5);
  assert.equal(g.runDeaths, 0, "切关应重置本次死亡计数");
  assert.equal(g.runCandle, false);
  assert.equal(g.phase, "playing");
  assert.equal(g.accumulator, 0);
});

test("startLevel 派发 level_started 且带关卡索引", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  const started = [];
  g.subscribe((ev) => { if (ev.type === "level_started") started.push(ev.levelIndex); });
  g.startLevel(11);
  assert.deepEqual(started, [11]);
});

test("startLevel 拒绝越界与非法索引，保持当前关不变", () => {
  const g = new DevilRunGame({ levelIndex: 3 });
  for (const bad of [-1, LEVEL_COUNT, 999, NaN, 2.5, "x", null, undefined]) {
    g.startLevel(bad);
    assert.equal(g.levelIndex, 3, `非法索引 ${bad} 不应切关`);
  }
});

test("restartLevel 保持当前关并重置玩家到出生点", () => {
  const g = new DevilRunGame({ levelIndex: 4 });
  g.setInput("right", true);
  for (let f = 0; f < 120; f++) g.tick(1 / 60);
  const moved = g.state.player.x;
  g.restartLevel();
  assert.equal(g.levelIndex, 4);
  assert.notEqual(g.state.player.x, moved, "重玩应回到出生点");
  assert.ok(Math.abs(g.state.player.x - g.state.spawn.x) < 0.01);
});

test("restartLevel 保留当前按键（长按右跑重玩不会松开）", () => {
  const g = new DevilRunGame({ levelIndex: 4 });
  g.setInput("right", true);
  g.restartLevel();
  assert.equal(g.inputs.right, true, "重玩应保留按键状态");
});

test("R 键重玩：restart 输入被消费并派发 manual_restart", () => {
  const g = new DevilRunGame({ levelIndex: 4 });
  g.setInput("right", true);
  for (let f = 0; f < 60; f++) g.tick(1 / 60);
  g.setInput("restart", true);
  const evs = g.tick(1 / 60);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].type, "manual_restart");
  assert.equal(g.inputs.restart, false, "restart 应被消费，避免连触");
});

test("goNextLevel 推进到下一关，最后一关时无操作", () => {
  const g = new DevilRunGame({ levelIndex: 0 });
  g.goNextLevel();
  assert.equal(g.levelIndex, 1);
  g.startLevel(LEVEL_COUNT - 1);
  g.goNextLevel();
  assert.equal(g.levelIndex, LEVEL_COUNT - 1, "最后一关不应越界");
});

// ---------------------------------------------------------------- 只读快照

test("getSummary 返回界面所需的完整只读字段", () => {
  const g = new DevilRunGame({ levelIndex: 12 });
  const s = g.getSummary();
  assert.equal(s.levelIndex, 12);
  assert.equal(s.levelNumber, 13);
  assert.ok(typeof s.name === "string" && s.name.length > 0);
  assert.ok(typeof s.clock === "string");
  assert.match(s.clock, /^\d+:\d{2}$/, `计时格式异常: ${s.clock}`);
  assert.equal(typeof s.deaths, "number");
  assert.equal(typeof s.gotCandle, "boolean");
  assert.equal(typeof s.gravityDir, "number");
  assert.ok(s.player && Number.isFinite(s.player.x));
  assert.ok(s.goal && Number.isFinite(s.goal.x));
  assert.ok(Array.isArray(s.traps));
  assert.ok(Array.isArray(s.marks));
});

test("getSummary 不含引擎内部可变引用（防止 UI 绕过控制器改状态）", () => {
  // 用一个确实带陷阱的关卡，否则数组为空看不出引用是否被共享
  const g = new DevilRunGame({ levelIndex: 5 });
  const engineTrapCount = g.state.traps.length;
  assert.ok(engineTrapCount > 0, "L6 应有陷阱，测试前提不成立");

  const s = g.getSummary();
  assert.equal(s.traps.length, engineTrapCount);

  // 篡改快照不应影响引擎状态
  s.traps.length = 0;
  s.traps.push({ kind: "hacked" });
  s.marks.push({ x: 999, y: 999, index: 99 });

  assert.equal(
    g.state.traps.length,
    engineTrapCount,
    "快照不应与引擎共享 traps 数组引用"
  );
  assert.equal(g.state.marks.length, 0, "快照不应与引擎共享 marks 数组引用");
});

test("快照中的陷阱元素本身也是独立副本（改字段不污染引擎）", () => {
  const g = new DevilRunGame({ levelIndex: 5 });
  const s = g.getSummary();
  const originalKind = g.state.traps[0].kind;
  s.traps[0].kind = "tampered";
  s.traps[0].state = "gone";
  assert.equal(g.state.traps[0].kind, originalKind, "陷阱字段不应被快照改动影响");
  assert.notEqual(g.state.traps[0].state, "gone");
});

test("getSummary 的 traps 快照至少覆盖数组本身（浅拷贝语义）", () => {
  const g = new DevilRunGame({ levelIndex: 5 });
  const a = g.getSummary();
  const b = g.getSummary();
  assert.notEqual(a.traps, b.traps, "两次快照不应返回同一个数组实例");
});

// ---------------------------------------------------------------- 全关卡冒烟

test("50 关逐一构造控制器不抛错，且都能推进若干帧", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    assert.doesNotThrow(() => {
      const g = new DevilRunGame({ levelIndex: i });
      g.setInput("right", true);
      for (let f = 0; f < 120; f++) g.tick(1 / 60);
      assert.equal(Number.isFinite(g.state.player.x), true, `L${i + 1} 状态异常`);
    }, `L${i + 1} 构造/推进失败`);
  }
});
