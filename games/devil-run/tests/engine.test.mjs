// 恶魔迷途 · 引擎规则测试
// 覆盖：确定性、陷阱状态机、死亡/重生不变量、边界安全、随机游走不崩溃。

import test from "node:test";
import assert from "node:assert/strict";

import {
  T,
  TRAP,
  ALL_TRAPS,
  TRAP_TIMING,
  createInitialState,
  stepFrame,
  tileAt,
  computeSeals,
  sealCount,
  formatClock,
  COYOTE_TIME,
  JUMP_BUFFER,
  RESPAWN_TOTAL
} from "../js/engine.mjs";
import { LEVELS, LEVEL_COUNT, getLevel, NODES } from "../js/levels.mjs";

const NO_INPUT = { left: false, right: false, jump: false, restart: false };
const RIGHT = { ...NO_INPUT, right: true };
const LEFT = { ...NO_INPUT, left: true };

// 确定性 PRNG，测试内自用
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(level, frames, inputs, opts) {
  let s = createInitialState(level, opts);
  for (let f = 0; f < frames; f++) {
    s = stepFrame(s, 1 / 60, inputs).state;
  }
  return s;
}

// ---------------------------------------------------------------- 常量契约

test("陷阱工具箱为 12 类且与 ALL_TRAPS 一致", () => {
  const kinds = Object.values(TRAP);
  assert.equal(kinds.length, 12, "陷阱种类应为 12");
  assert.equal(ALL_TRAPS.length, 12);
  for (const k of kinds) {
    assert.ok(ALL_TRAPS.includes(k), `${k} 应在 ALL_TRAPS 中`);
  }
});

test("陷阱时序常量齐全且为正", () => {
  const required = [
    "telegraph", "collapseDelay", "fakeDelay", "spikeDelay", "spikeRise",
    "ceilingDelay", "ceilingFall", "vanishDelay", "springDelay", "springVel",
    "fakeDoorDelay", "runDoorSpeed", "runDoorRange", "flipDelay",
    "revealRadius", "revealWindow", "portalCooldown"
  ];
  for (const key of required) {
    assert.ok(key in TRAP_TIMING, `TRAP_TIMING.${key} 缺失`);
    assert.ok(Number.isFinite(TRAP_TIMING[key]), `TRAP_TIMING.${key} 非有限数`);
  }
  assert.ok(TRAP_TIMING.springVel < 0, "弹簧应为向上（负）速度");
});

test("手感常量在合理区间（Coyote / 跳跃缓冲 / 重生）", () => {
  assert.ok(COYOTE_TIME >= 0.05 && COYOTE_TIME <= 0.15, "Coyote 应 0.05~0.15s");
  assert.ok(JUMP_BUFFER >= 0.08 && JUMP_BUFFER <= 0.2, "跳跃缓冲应 0.08~0.2s");
  assert.ok(RESPAWN_TOTAL <= 0.45, "重生总时长应 ≤0.45s（零惩罚体验）");
});

// ---------------------------------------------------------------- 关卡数据

test("关卡数量为 50，节点为 10 × 5", () => {
  assert.equal(LEVEL_COUNT, 50);
  assert.equal(LEVELS.length, 50);
  assert.equal(NODES.length, 10);
});

test("每关网格形状均为 13 行 × 20 列", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    assert.equal(lv.map.length, 13, `L${i + 1} 行数应为 13`);
    for (let r = 0; r < 13; r++) {
      assert.equal(lv.map[r].length, 20, `L${i + 1} row${r} 列数应为 20`);
    }
  }
});

test("每关都有出生点与终点门，且出生点不致死", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    assert.equal(typeof lv.spawnX, "number", `L${i + 1} 缺 spawnX`);
    assert.equal(typeof lv.spawnY, "number", `L${i + 1} 缺 spawnY`);
    assert.ok(lv.goal && typeof lv.goal.x === "number", `L${i + 1} 缺 goal`);

    // spawnX/spawnY 是世界坐标（col+0.5 / row），取整后才能索引地图
    const sc = Math.floor(lv.spawnX);
    const sr = Math.floor(lv.spawnY);
    const under = lv.map[sr][sc];
    assert.ok(
      under === T.SOLID || under === T.EMPTY,
      `L${i + 1} 出生点脚下是致死地形 (${under})`
    );

    const gc = Math.floor(lv.goal.x);
    const gr = Math.floor(lv.goal.y);
    const gUnder = lv.map[gr][gc];
    assert.ok(
      gUnder === T.SOLID || gUnder === T.EMPTY,
      `L${i + 1} 终点门脚下是致死地形`
    );
  }
});

test("所有关卡陷阱的 kind 都在 12 类工具箱内", () => {
  const known = new Set(ALL_TRAPS);
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    for (const tr of lv.traps) {
      assert.ok(known.has(tr.kind), `L${i + 1} 出现未知陷阱 ${tr.kind}`);
      assert.ok(Number.isInteger(tr.col), `L${i + 1} 陷阱 col 非整数`);
      assert.ok(Number.isInteger(tr.row), `L${i + 1} 陷阱 row 非整数`);
    }
  }
});

// ---------------------------------------------------------------- 确定性

test("相同输入序列 → 完全相同结果（与帧率无关的确定性）", () => {
  const a = run(getLevel(3), 240, RIGHT);
  const b = run(getLevel(3), 240, RIGHT);
  assert.deepEqual(a.player, b.player, "两次同输入轨迹应逐帧一致");
  assert.equal(a.stats.deaths, b.stats.deaths);
});

test("stepFrame 不修改传入的 prev 状态（纯函数）", () => {
  const s0 = createInitialState(getLevel(0));
  const snapshot = JSON.stringify(s0);
  stepFrame(s0, 1 / 60, RIGHT);
  assert.equal(JSON.stringify(s0), snapshot, "prev 不应被就地修改");
});

test("win 之后 stepFrame 为 no-op（终局冻结）", () => {
  let s = createInitialState(getLevel(0));
  s.status = "won";
  const before = JSON.stringify(s);
  const r = stepFrame(s, 1 / 60, RIGHT);
  assert.equal(r.events.length, 0);
  assert.equal(JSON.stringify(r.state), before);
});

// ---------------------------------------------------------------- 死亡与重生

test("掉出世界边界触发死亡（phase → dying）", () => {
  let s = createInitialState(getLevel(0));
  s.player.y = 40;
  s = stepFrame(s, 1 / 60, NO_INPUT).state;
  assert.equal(s.phase, "dying");
  assert.equal(s.stats.deaths, 1);
});

test("死亡时派发 death 事件且留下恶魔脚印，flawless 被破", () => {
  let s = createInitialState(getLevel(0));
  s.player.y = 40;
  const r = stepFrame(s, 1 / 60, NO_INPUT);
  const ev = r.events.find((e) => e.type === "death");
  assert.ok(ev, "应派发 death 事件");
  assert.equal(r.state.flawless, false);
  assert.equal(r.state.marks.length, 1, "应留下 1 个恶魔脚印");
  assert.equal(ev.hazard, "fall");
});

test("死亡后自动重生回出生点，且陷阱复位为 idle（无死局铁律）", () => {
  const lv = getLevel(5); // 塌陷砖关
  let s = createInitialState(lv);
  // 先踩上第一个陷阱让它触发
  const t0 = lv.traps[0];
  s.player.x = t0.col + 0.5;
  s = run(lv, 1, NO_INPUT);
  s.player.x = t0.col + 0.5;
  for (let f = 0; f < 40; f++) s = stepFrame(s, 1 / 60, NO_INPUT).state;
  const firedState = s.traps[0].state;
  assert.notEqual(firedState, "idle", "陷阱应先被触发");

  // 制造死亡并等待重生
  s.player.y = 40;
  s = stepFrame(s, 1 / 60, NO_INPUT).state;
  assert.equal(s.phase, "dying");
  for (let f = 0; f < 120; f++) s = stepFrame(s, 1 / 60, NO_INPUT).state;

  assert.equal(s.phase, "playing", "应已重生");
  assert.equal(s.traps[0].state, "idle", "重生后陷阱应复位");
  assert.equal(
    s.map[12].join(""),
    lv.map[12].join(""),
    "重生后地图应恢复原状"
  );
});

test("重生耗时不超过 RESPAWN_TOTAL（零惩罚）", () => {
  let s = createInitialState(getLevel(0));
  s.player.y = 40;
  s = stepFrame(s, 1 / 60, NO_INPUT).state;
  let frames = 0;
  while (s.phase === "dying" && frames < 600) {
    s = stepFrame(s, 1 / 60, NO_INPUT).state;
    frames++;
  }
  const seconds = frames / 60;
  assert.ok(
    seconds <= RESPAWN_TOTAL + 1 / 60,
    `重生耗时 ${seconds.toFixed(3)}s 应 ≤ ${RESPAWN_TOTAL}s`
  );
});

test("dying 阶段不接受操作（玩家位置冻结，只推进计时）", () => {
  let s = createInitialState(getLevel(0));
  s.player.y = 40;
  s = stepFrame(s, 1 / 60, NO_INPUT).state;
  const xAtDeath = s.player.x;
  const after = stepFrame(s, 1 / 60, RIGHT).state;
  assert.equal(after.player.x, xAtDeath, "dying 中不应响应右移");
});

// ---------------------------------------------------------------- 陷阱状态机

test("运行时状态里的陷阱均为合法 state，且数量与关卡定义一致", () => {
  const valid = new Set(["idle", "armed", "active", "spent", "gone"]);
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    const s = createInitialState(lv);
    assert.equal(
      s.traps.length,
      lv.traps.length,
      `L${i + 1} 运行时陷阱数与定义不一致`
    );
    for (const tr of s.traps) {
      assert.ok(valid.has(tr.state), `L${i + 1} 陷阱状态非法: ${tr.state}`);
    }
  }
});

test("固定可复现：同一关同输入，陷阱触发帧完全一致", () => {
  const lv = getLevel(5);
  const trace = (seedIgnored) => {
    let s = createInitialState(lv);
    const fireFrames = [];
    for (let f = 0; f < 180; f++) {
      const before = s.traps.map((t) => t.state);
      s = stepFrame(s, 1 / 60, RIGHT).state;
      s.traps.forEach((t, idx) => {
        if (before[idx] !== t.state && t.state === "active") fireFrames.push([f, idx]);
      });
    }
    return JSON.stringify(fireFrames);
  };
  assert.equal(trace(1), trace(2), "陷阱触发应完全可复现，绝不随机致死");
});

// ---------------------------------------------------------------- 边界安全

test("tileAt 对越界与非法输入安全返回 EMPTY", () => {
  const s = createInitialState(getLevel(0));
  assert.equal(tileAt(s, -1, 5), T.EMPTY);
  assert.equal(tileAt(s, 999, 5), T.EMPTY);
  assert.equal(tileAt(s, 5, -10), T.EMPTY);
  assert.equal(tileAt(s, NaN, 5), T.EMPTY);
  assert.equal(tileAt(s, 5, Infinity), T.EMPTY);
});

test("1000 步随机游走：50 关全部不抛错、不变式不破", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    const rnd = mulberry32(0xdeadbeef + i);
    let s = createInitialState(lv);
    let maxDeaths = 0;
    for (let f = 0; f < 1000; f++) {
      const inputs = {
        left: rnd() < 0.3,
        right: rnd() < 0.4,
        jump: rnd() < 0.3,
        restart: false
      };
      const r = stepFrame(s, 1 / 60, inputs);
      s = r.state;

      // 不变式
      assert.equal(Number.isFinite(s.player.x), true, `L${i + 1} f${f} x 非有限`);
      assert.equal(Number.isFinite(s.player.y), true, `L${i + 1} f${f} y 非有限`);
      assert.equal(Number.isFinite(s.player.vx), true, `L${i + 1} f${f} vx 非有限`);
      assert.equal(Number.isFinite(s.player.vy), true, `L${i + 1} f${f} vy 非有限`);
      assert.ok(["playing", "dying"].includes(s.phase), `L${i + 1} f${f} phase 非法`);
      assert.ok(["playing", "won"].includes(s.status), `L${i + 1} f${f} status 非法`);
      assert.ok(s.stats.deaths >= 0);
      maxDeaths = Math.max(maxDeaths, s.stats.deaths);

      // 一旦通关就冻结，避免无意义后续
      if (s.status === "won") break;
    }
    assert.ok(maxDeaths <= 1000, `L${i + 1} 死亡次数异常`);
  }
});

test("大 dt 不产生瞬移穿透（单步过大应被限制）", () => {
  let s = createInitialState(getLevel(0));
  const x0 = s.player.x;
  s = stepFrame(s, 5, RIGHT).state; // 5 秒一步
  assert.ok(
    Math.abs(s.player.x - x0) < 40,
    `单步位移 ${Math.abs(s.player.x - x0).toFixed(1)} 过大，可能穿透地形`
  );
});

// ---------------------------------------------------------------- 评价体系

test("computeSeals 未通关时全灭，通关且零死且拿蜡烛时全亮", () => {
  const s = createInitialState(getLevel(0));
  let seals = computeSeals(s);
  assert.deepEqual(seals, { clear: false, candle: false, flawless: false });
  assert.equal(sealCount(seals), 0);

  s.cleared = true;
  s.gotCandle = true;
  s.stats.deathsThisRun = 0;
  seals = computeSeals(s);
  assert.deepEqual(seals, { clear: true, candle: true, flawless: true });
  assert.equal(sealCount(seals), 3);
});

test("有死亡记录则无伤印不亮（flawless 依赖 deathsThisRun === 0）", () => {
  const s = createInitialState(getLevel(0));
  s.cleared = true;
  s.gotCandle = true;
  s.stats.deathsThisRun = 1;
  const seals = computeSeals(s);
  assert.equal(seals.flawless, false);
  assert.equal(sealCount(seals), 2);
});

test("formatClock 输出稳定且对异常输入兜底", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(65), "1:05");
  assert.equal(formatClock(65.9), "1:05");
  assert.equal(formatClock(600), "10:00");
  assert.doesNotThrow(() => formatClock(NaN));
  assert.doesNotThrow(() => formatClock(-5));
  // 异常输入不得输出 NaN，且负数应被钳到 0
  assert.equal(formatClock(NaN), "0:00");
  assert.equal(formatClock(-5), "0:00");
});
