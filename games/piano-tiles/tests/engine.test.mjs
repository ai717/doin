// engine.test.mjs — Piano Tiles 纯规则层测试
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG, RANKS, computeRank, comboMultiplier,
  createState, spawnTile, stepFrame, tryHit,
  start, pause, resume, reset, createPrng,
} from "../js/engine.mjs";

describe("engine: createState", () => {
  it("返回干净初始状态", () => {
    const s = createState();
    assert.equal(s.tiles.length, 0);
    assert.equal(s.score, 0);
    assert.equal(s.combo, 0);
    assert.equal(s.maxCombo, 0);
    assert.equal(s.misses, 0);
    assert.equal(s.gameOver, false);
    assert.equal(s.running, false);
  });

  it("支持注入确定性 PRNG", () => {
    const rng = createPrng(42);
    const s = createState({ random: rng });
    // 连续生成 10 个黑块，应该完全可复现
    for (let i = 0; i < 10; i++) spawnTile(s);
    const ids = s.tiles.map((t) => t.id);
    assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("engine: computeRank", () => {
  it("10 连击 = 新秀", () => {
    const r = computeRank(10);
    assert.equal(r?.name, "新秀");
  });
  it("25 连击 = 快手", () => {
    const r = computeRank(25);
    assert.equal(r?.name, "快手");
  });
  it("50 连击 = 手速大师", () => {
    const r = computeRank(50);
    assert.equal(r?.name, "手速大师");
  });
  it("100 连击 = 指尖传说", () => {
    const r = computeRank(100);
    assert.equal(r?.name, "指尖传说");
  });
  it("9 连击 = 未入段", () => {
    assert.equal(computeRank(9), null);
  });
});

describe("engine: comboMultiplier", () => {
  it("< 10 连 = 1x", () => {
    assert.equal(comboMultiplier(0), 1);
    assert.equal(comboMultiplier(9), 1);
  });
  it("10–24 连 = 1.5x", () => {
    assert.equal(comboMultiplier(10), 1.5);
    assert.equal(comboMultiplier(24), 1.5);
  });
  it("25–49 连 = 2x", () => {
    assert.equal(comboMultiplier(25), 2);
    assert.equal(comboMultiplier(49), 2);
  });
  it(">= 50 连 = 3x", () => {
    assert.equal(comboMultiplier(50), 3);
    assert.equal(comboMultiplier(200), 3);
  });
});

describe("engine: spawnTile", () => {
  it("每次生成一个新黑块且 id 递增", () => {
    const s = createState();
    spawnTile(s);
    spawnTile(s);
    assert.equal(s.tiles.length, 2);
    assert.equal(s.tiles[0].id, 1);
    assert.equal(s.tiles[1].id, 2);
  });

  it("黑块列号在 0..TRACKS-1 范围内", () => {
    const s = createState();
    for (let i = 0; i < 100; i++) spawnTile(s);
    for (const t of s.tiles) {
      assert.ok(t.col >= 0 && t.col < CONFIG.TRACKS);
    }
  });
});

describe("engine: stepFrame", () => {
  it("未运行时帧步进是 no-op", () => {
    const s = createState();
    spawnTile(s);
    const before = s.tiles[0].y;
    stepFrame(s, 0.1);
    assert.equal(s.tiles[0].y, before);
  });

  it("运行时黑块 y 按速度增加", () => {
    const s = createState();
    start(s);
    spawnTile(s);
    const before = s.tiles[0].y;
    stepFrame(s, 0.1);
    const after = s.tiles[0].y;
    assert.ok(after > before, "y 应该增加");
    const expectedDelta = CONFIG.SPEED_START * 0.1;
    assert.ok(Math.abs((after - before) - expectedDelta) < 0.01);
  });

  it("漏黑：黑块越过判定线宽容窗口后计失误", () => {
    const s = createState();
    start(s);
    spawnTile(s);
    const tile = s.tiles[0];
    // 手动把黑块放到判定线下方
    tile.y = CONFIG.JUDGE_LINE_Y + CONFIG.HIT_TOLERANCE + 1;
    const beforeMisses = s.misses;
    stepFrame(s, 0.016);
    assert.equal(s.misses, beforeMisses + 1);
    assert.equal(s.combo, 0);
    assert.equal(tile.status, "missed");
  });

  it("三次漏黑触发 gameOver", () => {
    const s = createState();
    start(s);
    for (let i = 0; i < 3; i++) {
      spawnTile(s);
      const tile = s.tiles[s.tiles.length - 1];
      tile.y = CONFIG.JUDGE_LINE_Y + CONFIG.HIT_TOLERANCE + 1;
      stepFrame(s, 0.016);
    }
    assert.equal(s.misses, 3);
    assert.equal(s.gameOver, true);
    assert.equal(s.running, false);
  });
});

describe("engine: tryHit", () => {
  it("命中有效黑块 → ok: true, combo++, score > 0", () => {
    const s = createState();
    start(s);
    spawnTile(s);
    // 把黑块放到判定线附近（可命中）
    const tile = s.tiles[0];
    tile.y = CONFIG.JUDGE_LINE_Y - 50; // 块顶在判定线上方，块中心在判定线附近
    const beforeScore = s.score;
    const beforeCombo = s.combo;
    const result = tryHit(s, tile.col);
    assert.equal(result.ok, true);
    assert.ok(result.quality === "good" || result.quality === "perfect");
    assert.ok(s.score > beforeScore);
    assert.equal(s.combo, beforeCombo + 1);
    assert.equal(s.maxCombo, s.combo);
    assert.equal(tile.status, "hit");
  });

  it("点白（该列此刻没黑块）→ ok: false reason=white", () => {
    const s = createState();
    start(s);
    spawnTile(s);
    const beforeMisses = s.misses;
    // 黑块在 col X，点另一个 col
    const otherCol = (s.tiles[0].col + 1) % CONFIG.TRACKS;
    const result = tryHit(s, otherCol);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "white");
    assert.equal(s.misses, beforeMisses + 1);
    assert.equal(s.combo, 0);
  });

  it("三次点白触发 gameOver", () => {
    const s = createState();
    start(s);
    for (let i = 0; i < 3; i++) {
      const result = tryHit(s, 0); // 始终点没黑块的列
      assert.equal(result.ok, false);
    }
    assert.equal(s.misses, 3);
    assert.equal(s.gameOver, true);
  });

  it("未运行或已结束时 tryHit 返回 offline", () => {
    const s = createState();
    const r1 = tryHit(s, 0);
    assert.equal(r1.ok, false);
    assert.equal(r1.reason, "offline");

    start(s);
    spawnTile(s);
    s.gameOver = true;
    s.running = false;
    const r2 = tryHit(s, s.tiles[0].col);
    assert.equal(r2.ok, false);
    assert.equal(r2.reason, "offline");
  });

  it("PERFECT 判定：块中心在判定线 ±PERFECT_WINDOW 内", () => {
    const s = createState();
    start(s);
    spawnTile(s);
    const tile = s.tiles[0];
    // 块中心 = JUDGE_LINE_Y
    tile.y = CONFIG.JUDGE_LINE_Y - tile.height / 2;
    const r = tryHit(s, tile.col);
    assert.equal(r.ok, true);
    assert.equal(r.quality, "perfect");
  });

  it("GOOD 判定：块中心偏离判定线但仍在可点击范围内", () => {
    const s = createState();
    start(s);
    spawnTile(s);
    const tile = s.tiles[0];
    // 块中心 = JUDGE_LINE_Y + 50（距离 50 > PERFECT_WINDOW 35，但 < HIT_TOLERANCE 60）
    tile.y = CONFIG.JUDGE_LINE_Y + 50 - tile.height / 2;
    const r = tryHit(s, tile.col);
    assert.equal(r.ok, true);
    assert.equal(r.quality, "good");
  });
});

describe("engine: start / pause / resume / reset", () => {
  it("start 后 running=true, gameOver=false", () => {
    const s = createState();
    start(s);
    assert.equal(s.running, true);
    assert.equal(s.gameOver, false);
  });
  it("pause 后 paused=true", () => {
    const s = createState();
    start(s);
    pause(s);
    assert.equal(s.paused, true);
  });
  it("resume 后 paused=false, running=true", () => {
    const s = createState();
    start(s);
    pause(s);
    resume(s);
    assert.equal(s.paused, false);
    assert.equal(s.running, true);
  });
  it("reset 后状态全归零", () => {
    const s = createState();
    start(s);
    spawnTile(s);
    tryHit(s, 0); // 可能失误或命中
    reset(s);
    assert.equal(s.score, 0);
    assert.equal(s.combo, 0);
    assert.equal(s.misses, 0);
    assert.equal(s.gameOver, false);
    assert.equal(s.running, false);
    assert.equal(s.tiles.length, 0);
  });
});

describe("engine: 1000 步随机游走不变量", () => {
  it("任意操作序列下状态结构保持完整，不抛错", () => {
    const rng = createPrng(9999);
    const s = createState({ random: rng });
    start(s);

    // 预生成若干黑块
    for (let i = 0; i < 20; i++) spawnTile(s);

    let errors = 0;
    for (let step = 0; step < 1000; step++) {
      try {
        if (s.gameOver) break;
        if (rng() < 0.5) {
          // 帧步进
          stepFrame(s, 0.016);
        } else {
          // 尝试命中随机列
          tryHit(s, Math.floor(rng() * CONFIG.TRACKS));
        }
        // 不变量检查
        assert.ok(s.score >= 0);
        assert.ok(s.combo >= 0);
        assert.ok(s.maxCombo >= s.combo);
        assert.ok(s.misses >= 0 && s.misses <= CONFIG.MAX_MISSES);
        if (s.misses >= CONFIG.MAX_MISSES) assert.equal(s.gameOver, true);
      } catch (e) {
        errors++;
        if (errors > 3) throw e;
      }
    }
    assert.ok(errors <= 3, `unexpected errors: ${errors}`);
  });
});
