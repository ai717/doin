// filepath: games/sokoban/tests/replay.test.mjs
// 全量重放验证：50 关按 PBD 求解路径（含被推箱位）自动重放通关，推数与 par 一致。
// 覆盖"数学可解 + 最优推数真实可达"的验收线（AGENTS §3）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../js/levels.mjs";
import { parseLevel, isWon } from "../js/engine.mjs";
import { solve } from "../js/solver.mjs";
import { replayToSteps, applySteps } from "../js/replay.mjs";

test("replay: 50 关按求解路径重放全部可通关，推数 == par", () => {
  let solved = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    const meta = LEVELS[i];
    const level = parseLevel(meta.map);
    // IDA* 收敛快且内存小（后段 5-6 箱关 PBD 状态空间大），上限 par 保证最优证明。
    // 新难度曲线后段 par 提升，6 箱密集关"证 par-1 无解"约需 30s，上限放宽到 45s。
    const res = solve(level, { mode: "ida", maxTimeMs: 45_000, maxStates: 50_000_000, upperBound: meta.parPushes + 1 });
    assert.ok(res.solvable, `L${i + 1}: 求解器判定不可解`);
    assert.ok(res.path.length > 0, `L${i + 1}: 空路径`);
    assert.equal(res.pushes, meta.parPushes, `L${i + 1}: 最优推数 ${res.pushes} != par ${meta.parPushes}`);

    const steps = replayToSteps(level, res.path, res.pushedBoxes);
    assert.ok(steps, `L${i + 1}: 推序列无法重放`);
    const final = applySteps(level, steps);
    assert.ok(final, `L${i + 1}: 走步序列非法`);
    assert.ok(isWon(final), `L${i + 1}: 重放未通关`);
    assert.equal(final.pushes, meta.parPushes, `L${i + 1}: 重放推数 ${final.pushes} != par`);
    solved++;
  }
  assert.equal(solved, 50);
});

test("replay: 单关重放中途返回 null 而非抛错（损坏路径防护）", () => {
  const level = parseLevel(LEVELS[0].map);
  const steps = replayToSteps(level, [0, 0, 0], [0, 0, 0]); // 伪造路径
  assert.ok(steps === null);
});
