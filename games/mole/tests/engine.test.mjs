// engine.test.mjs — 规则引擎用例（确定性 / 状态机 / 公平性 / 随机游走）
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SPECIES, SPECIES_LIST, PHASE, MIN_UP_MS, DIFFICULTIES, DIFFICULTY_IDS,
  mulberry32, dailySeed, todayKey, difficultyConfig, pickSpecies,
  createRun, stepRun, hitHole, activeMoles, hasHittableTarget,
  secondsLeft, currentMultiplier,
} from "../js/engine.mjs";
import { BASE_POINTS, comboMultiplier, hitPoints, applyBombPenalty } from "../js/score.mjs";

function runToFirstMole(difficulty = "normal", seed = 42) {
  const run = createRun({ difficulty, seed, rows: 3, cols: 4 });
  for (let i = 0; i < 400 && activeMoles(run).length === 0; i += 1) stepRun(run, 16);
  return run;
}

function putMole(run, index, species = SPECIES.NORMAL, upMs = 5000) {
  run.holes[index] = {
    id: run.nextId++,
    species,
    phase: PHASE.UP,
    t: 0,
    upMs,
    hp: species === SPECIES.HELMET ? 2 : 1,
  };
  return run.holes[index];
}

describe("engine: 确定性随机", () => {
  it("同种子序列一致、异种子不同", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const c = mulberry32(124);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    const seqC = Array.from({ length: 8 }, () => c());
    assert.deepEqual(seqA, seqB);
    assert.notDeepEqual(seqA, seqC);
    for (const v of seqA) assert.ok(v >= 0 && v < 1);
  });

  it("每日种子同日同值、跨日不同", () => {
    assert.equal(dailySeed("2026-09-23"), dailySeed("2026-09-23"));
    assert.notEqual(dailySeed("2026-09-23"), dailySeed("2026-09-24"));
    assert.ok(Number.isInteger(dailySeed("2026-09-23")));
  });

  it("todayKey 输出 YYYY-MM-DD", () => {
    assert.match(todayKey(new Date(2026, 8, 23)), /^2026-09-23$/);
  });
});

describe("engine: 难度配置", () => {
  it("三档难度齐备且渐强", () => {
    assert.deepEqual([...DIFFICULTY_IDS], ["easy", "normal", "crazy"]);
    const [easy, normal, crazy] = DIFFICULTY_IDS.map((id) => DIFFICULTIES[id]);
    assert.ok(easy.upMs[0] > normal.upMs[0]);
    assert.ok(normal.upMs[0] > crazy.upMs[0]);
    assert.ok(easy.maxUp <= normal.maxUp && normal.maxUp <= crazy.maxUp);
  });

  it("露头时长下限不低于公平红线（含金鼠 0.7 缩放）", () => {
    for (const id of DIFFICULTY_IDS) {
      const cfg = DIFFICULTIES[id];
      const worst = cfg.upMs[0] * 0.7;
      assert.ok(worst >= MIN_UP_MS, `${id} 露头过短: ${worst}`);
    }
  });

  it("非法难度 id 回退 normal", () => {
    assert.equal(difficultyConfig("nope").id, "normal");
  });

  it("权重覆盖全部鼠种且合计为 1", () => {
    for (const id of DIFFICULTY_IDS) {
      const w = DIFFICULTIES[id].weights;
      const sum = SPECIES_LIST.reduce((s, k) => s + (w[k] ?? 0), 0);
      assert.ok(Math.abs(sum - 1) < 1e-6, `${id} 权重合计 ${sum}`);
    }
  });
});

describe("engine: 开局状态", () => {
  it("洞位数与网格一致，maxUp 留出空位", () => {
    const run = createRun({ difficulty: "crazy", seed: 1, rows: 3, cols: 4 });
    assert.equal(run.holeCount, 12);
    assert.equal(run.holes.length, 12);
    assert.ok(run.maxUp <= run.holeCount - 2);
    assert.equal(run.status, "running");
    assert.equal(run.score, 0);
  });

  it("非法网格参数被兜底", () => {
    const run = createRun({ difficulty: "easy", seed: 1, rows: 0, cols: -3 });
    assert.ok(run.holeCount >= 1);
  });
});

describe("engine: 命中与计分", () => {
  it("命中普通鼠得分并累加连击", () => {
    const run = createRun({ difficulty: "normal", seed: 5, rows: 3, cols: 4 });
    putMole(run, 3);
    const res = hitHole(run, 3);
    assert.equal(res.ok, true);
    assert.equal(res.kind, "hit");
    assert.equal(run.combo, 1);
    assert.equal(run.hits, 1);
    assert.equal(run.score, res.points);
    assert.ok(res.points >= 1);
  });

  it("金鼠分数高于普通鼠", () => {
    const a = createRun({ seed: 5, rows: 3, cols: 4 });
    putMole(a, 0, SPECIES.GOLD);
    const ra = hitHole(a, 0);
    const b = createRun({ seed: 5, rows: 3, cols: 4 });
    putMole(b, 0, SPECIES.NORMAL);
    const rb = hitHole(b, 0);
    assert.ok(ra.points > rb.points);
    assert.equal(ra.kind, "gold");
  });

  it("铁盔鼠需两击：第一击掀盔、第二击命中", () => {
    const run = createRun({ difficulty: "normal", seed: 5, rows: 3, cols: 4 });
    const mole = putMole(run, 6, SPECIES.HELMET);
    assert.equal(mole.hp, 2);
    const first = hitHole(run, 6);
    assert.equal(first.ok, true);
    assert.equal(first.kind, "helmetBlock");
    assert.equal(run.holes[6].species, SPECIES.HELMET, "掀盔后仍在场");
    assert.equal(run.holes[6].hp, 1);
    const second = hitHole(run, 6);
    assert.equal(second.kind, "helmet");
    assert.equal(run.holes[6].phase, PHASE.DUCK);
    assert.ok(second.points > first.points);
  });

  it("误击炸弹：扣分清连击且分数不为负", () => {
    const run = createRun({ difficulty: "crazy", seed: 5, rows: 3, cols: 4 });
    run.score = 2;
    run.combo = 9;
    putMole(run, 2, SPECIES.BOMB);
    const res = hitHole(run, 2);
    assert.equal(res.kind, "bomb");
    assert.equal(run.combo, 0);
    assert.equal(run.score, 0);
    assert.equal(run.bombs, 1);
  });

  it("空洞与越界返回 ok:false 且不改状态", () => {
    const run = createRun({ seed: 5, rows: 3, cols: 4 });
    const before = { ...run, holes: [...run.holes], rng: null, events: null };
    assert.equal(hitHole(run, 0).ok, false);
    assert.equal(hitHole(run, 99).ok, false);
    assert.equal(hitHole(run, -1).ok, false);
    assert.equal(run.score, before.score);
    assert.equal(run.combo, before.combo);
    assert.equal(run.hits, before.hits);
  });

  it("终局后敲击是 no-op", () => {
    const run = createRun({ seed: 5, rows: 3, cols: 4, durationMs: 16 });
    stepRun(run, 32);
    assert.equal(run.status, "over");
    const res = hitHole(run, 0);
    assert.equal(res.ok, false);
    assert.equal(res.kind, "idle");
  });
});

describe("engine: 状态机推进", () => {
  it("时间耗尽判定终局，剩余时间不为负", () => {
    const run = createRun({ seed: 5, rows: 3, cols: 4, durationMs: 100 });
    for (let i = 0; i < 20; i += 1) stepRun(run, 16);
    assert.equal(run.status, "over");
    assert.equal(run.timeLeftMs, 0);
    assert.equal(secondsLeft(run), 0);
  });

  it("漏掉普通鼠计一次失误并清连击", () => {
    const run = createRun({ seed: 5, rows: 3, cols: 4 });
    run.combo = 5;
    putMole(run, 4, SPECIES.NORMAL, 100);
    stepRun(run, 16);
    stepRun(run, 120);
    assert.equal(run.misses, 1);
    assert.equal(run.combo, 0);
    assert.equal(run.holes[4].phase, PHASE.DUCK);
  });

  it("炸弹鼠自行缩回不算失误", () => {
    const run = createRun({ seed: 5, rows: 3, cols: 4 });
    putMole(run, 4, SPECIES.BOMB, 100);
    stepRun(run, 16);
    stepRun(run, 120);
    assert.equal(run.misses, 0);
  });

  it("已缩回（duck）的地鼠不可再打", () => {
    const run = createRun({ seed: 5, rows: 3, cols: 4 });
    putMole(run, 1, SPECIES.NORMAL, 60);
    stepRun(run, 100);
    assert.equal(run.holes[1].phase, PHASE.DUCK);
    assert.equal(hitHole(run, 1).ok, false);
  });

  it("大 dt 被钳制，单帧不会一次性结算整局", () => {
    const run = createRun({ seed: 5, rows: 3, cols: 4, durationMs: 5000 });
    stepRun(run, 100000);
    assert.ok(run.timeLeftMs >= 4000);
  });
});

describe("engine: 狂热与公平性", () => {
  it("连击满 20 触发狂热，到期自动结束", () => {
    const run = createRun({ seed: 5, rows: 3, cols: 4 });
    run.combo = 19;
    putMole(run, 0, SPECIES.GOLD);
    hitHole(run, 0);
    assert.equal(run.combo, 20);
    assert.ok(run.frenzyLeftMs > 0);
    assert.equal(run.frenzyCount, 1);
    for (let i = 0; i < 300; i += 1) stepRun(run, 16);
    assert.equal(run.frenzyLeftMs, 0);
  });

  it("狂热期地鼠计时变慢（更久才缩回）", () => {
    const slow = createRun({ seed: 5, rows: 3, cols: 4 });
    slow.frenzyLeftMs = 4000;
    putMole(slow, 0, SPECIES.NORMAL, 500);
    const fast = createRun({ seed: 5, rows: 3, cols: 4 });
    putMole(fast, 0, SPECIES.NORMAL, 500);
    for (let i = 0; i < 30; i += 1) {
      stepRun(slow, 16);
      stepRun(fast, 16);
    }
    assert.ok(slow.holes[0].t < fast.holes[0].t, "狂热期地鼠更慢");
  });

  it("pickSpecies 在 banBomb 时不会出炸弹", () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 200; i += 1) {
      assert.notEqual(pickSpecies(rng, DIFFICULTIES.crazy.weights, true), SPECIES.BOMB);
    }
  });

  it("场上无非炸弹目标时不会生成炸弹（绝不出现只能挨罚的帧）", () => {
    const run = createRun({ difficulty: "crazy", seed: 7, rows: 3, cols: 4 });
    putMole(run, 0, SPECIES.BOMB, 100000);
    assert.equal(hasHittableTarget(run), false);
    run.spawnTimerMs = 0;
    stepRun(run, 16);
    const spawn = run.events.find((e) => e.type === "spawn");
    assert.ok(spawn, "应触发生成");
    assert.notEqual(spawn.species, SPECIES.BOMB);
    assert.equal(hasHittableTarget(run), true);
  });
});

describe("engine: 随机游走不变量（5000 步）", () => {
  it("任意合法操作序列下不抛错、不卡死、不变量不破", () => {
    const rng = mulberry32(20260923);
    for (const id of DIFFICULTY_IDS) {
      const run = createRun({ difficulty: id, seed: 20260923, rows: 3, cols: 4 });
      let steps = 0;
      while (run.status === "running" && steps < 5000) {
        stepRun(run, 16);
        steps += 1;
        // 随机敲击 1~3 个洞
        const taps = 1 + Math.floor(rng() * 3);
        for (let k = 0; k < taps; k += 1) {
          hitHole(run, Math.floor(rng() * run.holeCount));
        }
        assert.ok(run.score >= 0, "分数不得为负");
        assert.ok(run.combo >= 0 && run.combo <= 100000, "连击异常");
        assert.ok(run.timeLeftMs >= 0, "剩余时间不得为负");
        assert.ok(run.hits >= 0 && run.misses >= 0 && run.bombs >= 0);
        assert.ok(activeMoles(run).length <= run.maxUp, "同屏数超上限");
        for (const hole of run.holes) {
          if (!hole) continue;
          assert.ok(Object.values(PHASE).includes(hole.phase), "非法 phase");
          assert.ok(hole.upMs >= MIN_UP_MS, "露头时长低于公平红线");
        }
      }
      assert.equal(run.status, "over", `${id} 未能正常结算`);
      assert.ok(steps > 100, `${id} 过早结束`);
    }
  });

  it("同种子两局完全一致（可复现）", () => {
    const play = () => {
      const rng = mulberry32(777);
      const run = createRun({ difficulty: "normal", seed: 777, rows: 3, cols: 4 });
      while (run.status === "running") {
        stepRun(run, 16);
        hitHole(run, Math.floor(rng() * run.holeCount));
      }
      return { score: run.score, hits: run.hits, misses: run.misses };
    };
    assert.deepEqual(play(), play());
  });
});

describe("score: 计分口径", () => {
  it("基础分覆盖全部鼠种", () => {
    for (const s of SPECIES_LIST) {
      assert.ok(Number.isFinite(BASE_POINTS[s]), `缺 ${s} 基础分`);
    }
  });

  it("连击倍率阶梯正确", () => {
    assert.equal(comboMultiplier(0), 1);
    assert.equal(comboMultiplier(7), 1);
    assert.equal(comboMultiplier(8), 1.5);
    assert.equal(comboMultiplier(16), 2);
    assert.equal(comboMultiplier(24), 3);
    assert.equal(comboMultiplier(999), 3);
  });

  it("狂热翻倍且取整", () => {
    assert.equal(hitPoints(SPECIES.NORMAL, 24, { frenzy: true }), 6);
    assert.equal(hitPoints(SPECIES.NORMAL, 0), 1);
  });

  it("扣分钳制在 0", () => {
    assert.equal(applyBombPenalty(0), 0);
    assert.equal(applyBombPenalty(2), 0);
    assert.equal(applyBombPenalty(10), 7);
  });

  it("currentMultiplier 转发 score 口径", () => {
    const run = createRun({ seed: 1, rows: 3, cols: 4 });
    run.combo = 16;
    assert.equal(currentMultiplier(run), 2);
  });
});
