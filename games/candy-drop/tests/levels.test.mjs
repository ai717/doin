// levels.test.mjs: 关卡数据与可解性 —— 40 关每关都重放一条「三星进嘴」的已知解

import test from "node:test";
import assert from "node:assert/strict";

import { createState, stepFrame, applyIntent, FIXED_DT, WORLD, CANDY_R } from "../js/engine.mjs";
import { LEVELS, BOXES, LEVEL_COUNT, LEVELS_PER_BOX, levelById, levelsOfBox } from "../js/levels.mjs";
import { LEVEL_MAX, scoreOf, boxStars } from "../js/score.mjs";

const MAX_SIM = 13;

function replay(level) {
  const state = createState(level);
  const actions = [...level.plan].sort((a, b) => a.t - b.t);
  let next = 0;
  const steps = Math.round(MAX_SIM / FIXED_DT);
  for (let i = 0; i < steps; i += 1) {
    while (next < actions.length && state.t >= actions[next].t) {
      const a = actions[next];
      if (a.cut) applyIntent(state, { type: "cutRopes", indices: a.cut });
      else if (a.pop) applyIntent(state, { type: "popBubble" });
      else if (a.puff !== undefined) applyIntent(state, { type: "puff", index: a.puff });
      else if (a.slide) applyIntent(state, { type: "slide", index: a.slide[0], t: a.slide[1] });
      next += 1;
    }
    stepFrame(state, FIXED_DT);
    if (state.status !== "playing") break;
  }
  return state;
}

test("关卡总量：5 盒 × 8 关 = 40 关，编号连续", () => {
  assert.equal(LEVEL_COUNT, 40);
  assert.equal(BOXES.length, 5);
  LEVELS.forEach((lvl, i) => {
    assert.equal(lvl.id, i + 1, `第 ${i} 项 id 应为 ${i + 1}`);
    assert.equal(lvl.box, Math.floor(i / LEVELS_PER_BOX) + 1, `第 ${lvl.id} 关盒号不符`);
  });
  for (const box of BOXES) {
    assert.equal(levelsOfBox(box.box).length, LEVELS_PER_BOX, `第 ${box.box} 盒关数不符`);
  }
});

test("每关数据形状合法：双语名/提示、三颗星、绳、坐标在世界内", () => {
  for (const lvl of LEVELS) {
    assert.ok(lvl.name?.zh && lvl.name?.en, `第 ${lvl.id} 关缺双语名`);
    assert.ok(lvl.hint?.zh && lvl.hint?.en, `第 ${lvl.id} 关缺双语提示`);
    assert.equal(lvl.stars.length, 3, `第 ${lvl.id} 关星数不是 3`);
    assert.ok(lvl.ropes?.length > 0, `第 ${lvl.id} 关没有绳`);
    assert.ok(Array.isArray(lvl.plan) && lvl.plan.length > 0, `第 ${lvl.id} 关缺解法`);
    const inWorld = (x, y) => x >= -40 && x <= WORLD.w + 40 && y >= -40 && y <= WORLD.h + 40;
    assert.ok(inWorld(lvl.candy[0], lvl.candy[1]), `第 ${lvl.id} 关糖起点越界`);
    assert.ok(inWorld(lvl.monster.at[0], lvl.monster.at[1]), `第 ${lvl.id} 关小兽越界`);
    for (const s of lvl.stars) assert.ok(inWorld(s[0], s[1]), `第 ${lvl.id} 关星越界`);
    for (const [i, r] of lvl.ropes.entries()) {
      // 合法绳：普通/自动绳要有锚点与长度；滑轨绳要有轨道；弹性绳要有 elastic 参数
      const ok = (r.a && (r.len > 0 || r.elastic)) || r.rail;
      assert.ok(ok, `第 ${lvl.id} 关第 ${i} 根绳不合法：${JSON.stringify(r)}`);
      if (r.elastic) {
        assert.ok(
          r.elastic.rest > 0 && r.elastic.stretch > 0,
          `第 ${lvl.id} 关弹性绳参数缺失：${JSON.stringify(r)}`
        );
      }
    }
  }
});

test("机关分布符合策划：盒 1 只有普通绳与尖刺，机关逐盒解锁", () => {
  const box1 = levelsOfBox(1);
  for (const lvl of box1) {
    for (const r of lvl.ropes) {
      assert.ok(!r.elastic && !r.auto && !r.rail, `第 ${lvl.id} 关（盒 1）不应有高级绳`);
    }
    assert.ok(!lvl.bubbles?.length, `第 ${lvl.id} 关（盒 1）不应有气泡`);
    assert.ok(!lvl.cushions?.length, `第 ${lvl.id} 关（盒 1）不应有气垫`);
  }
  const has = (box, pred) => levelsOfBox(box).some(pred);
  assert.ok(has(2, (l) => l.ropes.some((r) => r.elastic)), "盒 2 应引入弹性绳");
  assert.ok(has(2, (l) => l.walls?.length), "盒 2 应引入撞板/墙");
  assert.ok(has(3, (l) => l.bubbles?.length), "盒 3 应引入气泡");
  assert.ok(has(4, (l) => l.cushions?.length), "盒 4 应引入气垫");
  assert.ok(has(4, (l) => l.ropes.some((r) => r.auto)), "盒 4 应引入自动绳");
  assert.ok(has(5, (l) => l.ropes.some((r) => r.rail)), "盒 5 应引入滑动锚轨");
});

test("无死局：40 关每一关都能用关卡自带的解法三星进嘴", () => {
  const fails = [];
  for (const lvl of LEVELS) {
    const state = replay(lvl);
    if (state.status !== "won" || state.starsTaken !== 3) {
      fails.push(`#${lvl.id} ${lvl.name.zh}: status=${state.status} 星=${state.starsTaken} reason=${state.reason}`);
    }
  }
  assert.equal(fails.length, 0, `以下关卡无三星解：\n${fails.join("\n")}`);
});

test("解法可重放两次结果完全一致（物理确定性）", () => {
  for (const lvl of LEVELS.slice(0, 12)) {
    const a = replay(lvl);
    const b = replay(lvl);
    assert.equal(a.status, b.status, `第 ${lvl.id} 关状态不一致`);
    assert.equal(a.starsTaken, b.starsTaken, `第 ${lvl.id} 关星数不一致`);
    assert.ok(Math.abs(a.t - b.t) < 1e-9, `第 ${lvl.id} 关用时不一致`);
  }
});

test("三星必须在解法经过的弹道上，且不与尖刺/小兽重叠", () => {
  for (const lvl of LEVELS) {
    const m = lvl.monster;
    for (const s of lvl.stars) {
      // 星不能压在嘴上（否则无意义）
      const dm = Math.hypot(s[0] - m.at[0], s[1] - m.at[1]);
      assert.ok(dm > m.r * 0.5, `第 ${lvl.id} 关有星压在小兽身上 (d=${dm.toFixed(1)})`);
      // 星不能扎在尖刺里
      for (const sp of lvl.spikes ?? []) {
        const d = pointSegDist(s[0], s[1], sp.from[0], sp.from[1], sp.to[0], sp.to[1]);
        assert.ok(d > 26, `第 ${lvl.id} 关有星贴在尖刺上 (d=${d.toFixed(1)})`);
      }
      // 星不能生成在糖的起始位置里
      const dc = Math.hypot(s[0] - lvl.candy[0], s[1] - lvl.candy[1]);
      assert.ok(dc > CANDY_R + 8, `第 ${lvl.id} 关有星压在糖的起点 (d=${dc.toFixed(1)})`);
    }
  }
});

function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

test("计分口径：三星通关拿满 LEVEL_MAX，未进嘴为 0", () => {
  assert.equal(scoreOf(3, true), LEVEL_MAX);
  assert.equal(scoreOf(0, false), 0);
  assert.equal(scoreOf(3, false), 0, "只收星不算通关分");
  assert.equal(scoreOf(0, true), 200);
  const full = {};
  for (const lvl of LEVELS) full[lvl.id] = { stars: 3 };
  assert.equal(boxStars(full, 1), 24);
  assert.equal(levelById(41), null);
  assert.equal(levelById(1).id, 1);
});
