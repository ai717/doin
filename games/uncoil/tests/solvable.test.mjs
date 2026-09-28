import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STATUS,
  createState,
  step,
  legalDirs,
  validateLevel,
  totalShrink
} from "../js/engine.mjs";
import {
  RAW_LEVELS,
  LEVELS,
  CHAPTERS,
  ENDGAME,
  SOLUTION_DIRS,
  levelById,
  levelsOfChapter,
  expandLevel
} from "../js/levels.mjs";
import { buildPath, planDeltas, generate } from "../tools/gen-levels.mjs";

// ---------- 关卡数据体检 ----------
test("关卡规模：5 章 × 8 关主线 + 12 道残局", () => {
  assert.equal(LEVELS.length, 52);
  for (const ch of CHAPTERS) assert.equal(levelsOfChapter(ch).length, 8, `${ch} 应有 8 关`);
  assert.equal(ENDGAME.length, 12);
  assert.equal(CHAPTERS.length, 5);
});

test("每一关都通过 validateLevel 数据体检", () => {
  for (const lv of LEVELS) {
    const problems = validateLevel(lv);
    assert.deepEqual(problems, [], `${lv.id}: ${problems.join(",")}`);
  }
});

test("每一关的丸总减量都足以把蛇削到 1 节", () => {
  for (const lv of LEVELS) {
    assert.ok(
      totalShrink(lv) >= lv.snake.length - 1,
      `${lv.id} 减量 ${totalShrink(lv)} < 需削减 ${lv.snake.length - 1}`
    );
  }
});

test("每一关开局都不是困毙状态（至少一步可走）", () => {
  for (const lv of LEVELS) {
    const s = createState(lv);
    assert.notEqual(s.status, STATUS.ENTOMBED, `${lv.id} 开局即困毙`);
    assert.ok(legalDirs(s).length > 0, `${lv.id} 开局无合法方向`);
  }
});

test("关卡 id 唯一，章节归属正确", () => {
  const ids = new Set(LEVELS.map((l) => l.id));
  assert.equal(ids.size, LEVELS.length);
  for (const lv of LEVELS) {
    assert.ok(lv.id.startsWith("level_") || lv.id.startsWith("endgame_"));
    assert.ok(levelById(lv.id));
  }
});

test("数据层零中文：关卡文件不含任何汉字", () => {
  const raw = RAW_LEVELS.map((l) => JSON.stringify(l)).join("");
  assert.equal(/[一-龥]/.test(raw), false, "关卡数据出现中文字符串");
});

// ---------- 核心：全关回放校验 ----------
// 这是「100% 可解」红线的落地证明：把关卡自带的 solution 喂给纯净 engine 逐 tick 回放，
// 每一步都必须被执行（action 非 null），且终局必须是 won。
test("★ 全 52 关逐 tick 回放：每一步合法，终点必为通关", () => {
  for (const lv of LEVELS) {
    let s = createState(lv);
    const dirs = lv.solution.map((ch) => SOLUTION_DIRS[ch]);
    assert.equal(dirs.length, lv.par, `${lv.id} par 与 solution 长度不符`);
    assert.equal(dirs.some((d) => !d), false, `${lv.id} solution 含非法方向字母`);

    for (let i = 0; i < dirs.length; i++) {
      const { action, state } = step(s, dirs[i]);
      assert.ok(action, `${lv.id} 第 ${i + 1} 步 ${dirs[i]} 被判非法（合法操作不得被拦截）`);
      assert.notEqual(state.status, STATUS.ENTOMBED, `${lv.id} 第 ${i + 1} 步困毙`);
      s = state;
    }
    assert.equal(s.status, STATUS.WON, `${lv.id} 回放结束未通关（${s.status}，剩 ${s.snake.length} 节）`);
    assert.equal(s.snake.length, 1);
    assert.equal(s.steps, lv.par);
  }
});

test("回放过程中长度单调不增，且每次吃到丸都正好扣掉 delta", () => {
  const lv = levelById("level_3_4");
  let s = createState(lv);
  let prev = s.snake.length;
  for (const ch of lv.solution) {
    const { action, state } = step(s, SOLUTION_DIRS[ch]);
    s = state;
    assert.ok(s.snake.length <= prev, "长度出现回升");
    if (action.ate) {
      assert.equal(prev - s.snake.length, action.ate.delta);
      // 尾部脱落的节数 = 1 + delta
      assert.equal(action.ate.shed.length, action.ate.delta + 1);
    }
    prev = s.snake.length;
  }
});

test("★ 关卡不是线性管道：回放路径上存在可分支的岔路口", () => {
  // 若每一步都只有一个合法方向，玩家就没有任何决策，解谜性为零。
  // 沿基底推进是保底解，但盘面上必须存在跨行/跨列的捷径供玩家选择。
  let totalSteps = 0;
  let branchSteps = 0;
  for (const lv of LEVELS) {
    let s = createState(lv);
    for (const ch of lv.solution) {
      const options = legalDirs(s).length;
      totalSteps++;
      if (options >= 2) branchSteps++;
      s = step(s, SOLUTION_DIRS[ch]).state;
    }
  }
  const ratio = branchSteps / totalSteps;
  assert.ok(ratio > 0.35, `可分支步数占比仅 ${(ratio * 100).toFixed(1)}%，关卡过于线性`);
});

test("旗舰关兑现「百节长蛇」：第 5 章后段存在 ≥ 100 节的关卡", () => {
  const big = LEVELS.filter((l) => l.snake.length >= 100);
  assert.ok(big.length >= 4, `仅 ${big.length} 关达到百节`);
  for (const l of big) assert.equal(l.chapter, "chapter_5");
});

test("难度单调递增：各章平均初始长度逐章上升", () => {
  const avg = CHAPTERS.map((ch) => {
    const xs = levelsOfChapter(ch);
    return xs.reduce((s, l) => s + l.snake.length, 0) / xs.length;
  });
  for (let i = 1; i < avg.length; i++) {
    assert.ok(avg[i] > avg[i - 1], `第 ${i + 1} 章平均长度未超过上一章`);
  }
});

test("拥挤度随章节推进而收紧（第 5 章最窒息）", () => {
  // 网格大小逐章变化，比绝对值没意义，比「自由格占比」才准
  const ratio = (l) => (l.cols * l.rows - l.snake.length - l.walls.length) / (l.cols * l.rows);
  const worst = (ch) => Math.min(...levelsOfChapter(ch).map(ratio));
  assert.ok(worst("chapter_5") < worst("chapter_1"), "第 5 章最难关未比第 1 章更挤");
  assert.ok(worst("chapter_3") < worst("chapter_2"), "第 3 章未比第 2 章更挤");
  assert.ok(worst("chapter_5") < 0.35, `第 5 章最难关自由格占比 ${worst("chapter_5").toFixed(2)}，不够窒息`);
});

// ---------- 生成器自身的性质 ----------
test("哈密顿路径基底：三种变体都覆盖全部格子且首尾相连", () => {
  for (const [cols, rows] of [[7, 7], [8, 8], [9, 9], [11, 11], [13, 13]]) {
    for (const variant of [0, 1, 2]) {
      const H = buildPath(cols, rows, variant);
      assert.equal(H.length, cols * rows, `基底 ${variant} 未覆盖全部格子`);
      assert.equal(new Set(H).size, H.length, `基底 ${variant} 有重复格`);
      for (let i = 1; i < H.length; i++) {
        const [ar, ac] = [Math.floor(H[i - 1] / cols), H[i - 1] % cols];
        const [br, bc] = [Math.floor(H[i] / cols), H[i] % cols];
        assert.equal(Math.abs(ar - br) + Math.abs(ac - bc), 1, `基底 ${variant} 在第 ${i} 处断裂`);
      }
    }
  }
});

test("planDeltas：总和严格等于目标且每份 ≥ 2", () => {
  for (const total of [9, 15, 29, 85, 111]) {
    for (const d of [2, 3, 4, 6, 8]) {
      const out = planDeltas(total, d);
      assert.equal(out.reduce((s, x) => s + x, 0), total, `total=${total} delta=${d} 总和不符`);
      for (const x of out) assert.ok(x >= 2, `出现 < 2 的减量 ${x}`);
    }
  }
});

test("生成器确定性：同一 seed 产出同一关卡", () => {
  const spec = {
    cols: 9, rows: 9, targetLen: 30, delta: 3, variant: 1, wallCount: 3, dir: "back"
  };
  const a = generate(spec, 424242);
  const b = generate(spec, 424242);
  assert.deepEqual(a, b);
});

test("生成器产出的关卡直接通过回放校验（抽样）", () => {
  const specs = [
    { cols: 7, rows: 7, targetLen: 14, delta: 2, variant: 0, wallCount: 0 },
    { cols: 9, rows: 9, targetLen: 34, delta: 3, variant: 2, wallCount: 3, dir: "back" },
    { cols: 11, rows: 11, targetLen: 68, delta: 5, variant: 1, wallCount: 4, portals: 1 },
    { cols: 13, rows: 13, targetLen: 104, delta: 6, variant: 0, wallCount: 8, portals: 1 }
  ];
  for (const spec of specs) {
    const got = generate(spec, 777);
    assert.ok(got, "生成失败");
    const lv = expandLevel({
      id: "probe",
      chapter: "chapter_1",
      cols: spec.cols,
      rows: spec.rows,
      snake: got.snake,
      walls: got.walls,
      portals: got.portals,
      pellets: got.pellets,
      solution: got.solution,
      par: got.par
    });
    assert.deepEqual(validateLevel(lv), []);
    let s = createState(lv);
    for (const ch of lv.solution) {
      const { action, state } = step(s, SOLUTION_DIRS[ch]);
      assert.ok(action, "生成器的解在 engine 上被判非法");
      s = state;
    }
    assert.equal(s.status, STATUS.WON);
  }
});

test("岩层与回环门绝不落在保底解的必经之路上", () => {
  for (const lv of LEVELS) {
    const wallKeys = new Set(lv.walls.map((p) => p.r * lv.cols + p.c));
    const snakeKeys = new Set(lv.snake.map((p) => p.r * lv.cols + p.c));
    for (const k of wallKeys) {
      assert.equal(snakeKeys.has(k), false, `${lv.id} 岩层压在初始蛇身上`);
    }
    for (const pair of lv.portals) {
      for (const p of pair) {
        assert.equal(wallKeys.has(p.r * lv.cols + p.c), false, `${lv.id} 回环门与岩层重叠`);
      }
    }
  }
});
