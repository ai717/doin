// 恶魔迷途 · 黄金路径重放测试
// 这是全项目最强的正确性保证：
//   50 个关卡各有一条已被求解器验证过的真实通关轨迹（共 11802 帧输入）。
//   只要重放这些轨迹仍能通关，就说明「关卡可解 + 物理确定 + 陷阱时序未漂移」三者同时成立。
// 任何改动（物理常量、陷阱时序、关卡数据）一旦破坏可解性，这里会立刻爆红。

import test from "node:test";
import assert from "node:assert/strict";

import { replayTrace, createInitialState } from "../js/engine.mjs";
import { getLevel, LEVEL_COUNT } from "../js/levels.mjs";
import GOLDEN from "../js/golden.mjs";

// 黄金数据把每帧压成 [t, left, right, jump]，这里还原成 engine 需要的对象形式
function toTrace(rows) {
  return rows.map((r) => ({
    t: r[0],
    left: Boolean(r[1]),
    right: Boolean(r[2]),
    jump: Boolean(r[3])
  }));
}

// replayTrace 返回 { state, events }，通关与否看 state.status
function play(i) {
  const r = replayTrace(getLevel(i), toTrace(GOLDEN[i]), { maxSec: 120 });
  return {
    won: r.state.status === "won",
    deaths: r.state.stats.deaths,
    elapsed: r.state.elapsed,
    gotCandle: r.state.gotCandle,
    events: r.events
  };
}

test("黄金数据覆盖全部 50 关，且每关都有非空轨迹", () => {
  const keys = Object.keys(GOLDEN);
  assert.equal(keys.length, LEVEL_COUNT, `黄金数据应覆盖 ${LEVEL_COUNT} 关`);
  for (let i = 0; i < LEVEL_COUNT; i++) {
    assert.ok(GOLDEN[i], `L${i + 1} 缺黄金轨迹`);
    assert.ok(GOLDEN[i].length > 0, `L${i + 1} 轨迹为空`);
  }
});

test("黄金数据总帧数与预期一致（8123 帧）", () => {
  let total = 0;
  for (const k of Object.keys(GOLDEN)) total += GOLDEN[k].length;
  assert.equal(total, 8123, "总帧数变化意味着关卡或物理被改动，需重新求解");
});

test("50 关黄金路径全部可复现通关（可解性 + 确定性铁证）", () => {
  const failures = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    let r;
    try {
      r = play(i);
    } catch (err) {
      failures.push(`L${i + 1} 重放抛错: ${err.message}`);
      continue;
    }
    if (!r.won) {
      failures.push(
        `L${i + 1} 未通关 (死亡 ${r.deaths} 次, ${r.elapsed.toFixed(2)}s)`
      );
    }
  }
  assert.deepEqual(
    failures,
    [],
    `以下关卡黄金路径失效，说明改动破坏了可解性:\n${failures.join("\n")}`
  );
});

test("黄金路径通关耗时均在合理区间（不为空跑）", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const r = play(i);
    assert.ok(r.won, `L${i + 1} 应通关`);
    assert.ok(
      r.elapsed > 0.1,
      `L${i + 1} 通关耗时 ${r.elapsed}s 过短，轨迹可能无效`
    );
    assert.ok(
      r.elapsed < 60,
      `L${i + 1} 通关耗时 ${r.elapsed}s 过长，违背微关卡体量定位`
    );
  }
});

test("黄金路径可含死亡但仍须通关（零惩罚重生语义）", () => {
  // 说明：黄金轨迹的求解目标是「抵达终点门」，而非「零死亡走法」。
  // 本作设计上死亡零惩罚（自动重生 ≤0.38s、陷阱复位、地图还原），
  // 因此轨迹中途死去再重生是合法的通关方式。这里只约束「不得死到失控」。
  const excessive = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const r = play(i);
    assert.ok(r.won, `L${i + 1} 应通关`);
    if (r.deaths > 20) {
      excessive.push(`L${i + 1} 死亡 ${r.deaths} 次`);
    }
  }
  assert.deepEqual(
    excessive,
    [],
    `以下关卡黄金路径死亡次数失控，轨迹可能已发散:\n${excessive.join("\n")}`
  );
});

test("至少 40 关存在零死亡通关路径（难度曲线健康）", () => {
  let flawlessRuns = 0;
  for (let i = 0; i < LEVEL_COUNT; i++) {
    if (play(i).deaths === 0) flawlessRuns++;
  }
  assert.ok(
    flawlessRuns >= 40,
    `仅 ${flawlessRuns} 关可零死亡通关，低于预期的 40 关`
  );
});

test("重放不产生副作用：同一轨迹重放两次结果完全一致", () => {
  const lv = getLevel(19);
  const trace = toTrace(GOLDEN[19]);
  const a = replayTrace(lv, trace, { maxSec: 120 });
  const b = replayTrace(lv, trace, { maxSec: 120 });
  assert.equal(a.state.status, b.state.status);
  assert.equal(a.state.stats.deaths, b.state.stats.deaths);
  assert.equal(a.state.elapsed, b.state.elapsed);
});

test("空轨迹必然不通关（负向对照，避免测试假阳性）", () => {
  const r = replayTrace(getLevel(9), [], { maxSec: 5 });
  assert.equal(
    r.state.status === "won",
    false,
    "空轨迹不应通关，否则测试失去意义"
  );
});
