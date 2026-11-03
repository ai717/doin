// solver.test.mjs — 可通关性硬断言：确定性贪心勇者必须能打满 24 层并拿到真结局
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createState, step as applyStep } from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";
import { planOnce, solveTower, towerReport } from "../js/solver.mjs";
import { TOTAL_FLOORS } from "../js/data.mjs";

describe("solver: 全塔可通关", () => {
  const first = solveTower(createState(LEVELS));

  it("24 层打穿并触发真结局", () => {
    assert.equal(first.won, true, `未通关：${first.reason}`);
    assert.equal(first.reason, "true");
    assert.equal(first.state.floor, TOTAL_FLOORS);
    assert.equal(first.state.floor, TOTAL_FLOORS);
    assert.equal(first.state.stats.floorsSeen, TOTAL_FLOORS);
  });

  it("抵达终点时仍存活，且确实经历过战斗与战损", () => {
    assert.ok(first.state.hp > 0, "通关时生命必须为正");
    assert.ok(first.state.hp <= first.state.hpMax);
    assert.ok(first.state.stats.damageTaken > 0, "整座塔必然造成战损");
    assert.ok(first.state.stats.slain > 100, `击杀数异常：${first.state.stats.slain}`);
    assert.ok(first.state.atk > 12 && first.state.def > 10, "成长必须真实生效");
  });

  it("全程无卡死、步数在合理区间", () => {
    assert.ok(first.steps > 500 && first.steps < 6000, `步数异常：${first.steps}`);
  });

  it("同数据两次运行完全一致（零随机）", () => {
    const second = solveTower(createState(LEVELS));
    assert.equal(second.steps, first.steps);
    assert.equal(second.state.hp, first.state.hp);
    assert.equal(second.state.atk, first.state.atk);
    assert.equal(second.state.def, first.state.def);
    assert.equal(second.state.stats.damageTaken, first.state.stats.damageTaken);
  });

  it("逐层战报覆盖 1~24 层且生命单调不爆表", () => {
    const report = towerReport(createState(LEVELS));
    assert.equal(report.rows.length, TOTAL_FLOORS);
    assert.equal(report.rows[0].floor, 1);
    assert.equal(report.rows[report.rows.length - 1].floor, TOTAL_FLOORS);
    for (const row of report.rows) {
      assert.ok(row.hp > 0, `F${row.floor} 生命非正`);
      assert.ok(row.atk >= 12 && row.def >= 10);
    }
  });
});

describe("solver: 单步决策", () => {
  it("开局先捡道具而不是盲目撞门", () => {
    const state = createState(LEVELS);
    const plan = planOnce(state, { bought: 0, limit: 8 });
    assert.ok(plan && plan.intent);
    assert.equal(plan.intent.type, "move");
    assert.ok(["collect", "fight", "open", "stairs"].includes(plan.reason));
  });

  it("决策永不产生非法意图", () => {
    let state = createState(LEVELS);
    let applied = 0;
    for (let i = 0; i < 400; i += 1) {
      const plan = planOnce(state, { bought: 0, limit: 8 });
      if (!plan || !plan.intent) break;
      assert.ok(["move", "buy", "use"].includes(plan.intent.type), `非法意图 ${plan.intent.type}`);
      const result = applyStep(state, plan.intent);
      assert.ok(result.action, `决策落空：${plan.reason}`);
      state = result.state;
      applied += 1;
    }
    assert.ok(applied > 300, `有效决策过少：${applied}`);
    assert.equal(state.status, "playing");
  });
});
