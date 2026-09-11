// filepath: games/jigsaw/tests/artwork.test.mjs
// 艺术图生成回归：同 seed 必得同图、不同 seed 必得不同图、配方取值全部在合法范围内。
// node 环境没有 Canvas，因此用"记录型假上下文"验证绘制调用序列的确定性 ——
// 调用序列完全由配方决定，序列一致即像素一致。
import test from "node:test";
import assert from "node:assert/strict";

import { artworkRecipe, recipeHash, renderArtwork, createArtworkCanvas, hsla } from "../js/artwork.mjs";
import { LEVELS } from "../js/levels.mjs";

/** 记录所有绘制调用的假 2D 上下文 */
function stubCtx() {
  const calls = [];
  const gradient = { addColorStop: (...args) => calls.push(["addColorStop", ...args]) };
  const record =
    (name) =>
    (...args) => {
      calls.push([name, ...args]);
    };
  return {
    calls,
    save: record("save"),
    restore: record("restore"),
    clearRect: record("clearRect"),
    fillRect: record("fillRect"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    arc: record("arc"),
    fill: record("fill"),
    stroke: record("stroke"),
    translate: record("translate"),
    rotate: record("rotate"),
    createLinearGradient: (...args) => {
      calls.push(["createLinearGradient", ...args]);
      return gradient;
    },
    createRadialGradient: (...args) => {
      calls.push(["createRadialGradient", ...args]);
      return gradient;
    },
  };
}

const logOf = (recipe, size = 96) => {
  const ctx = stubCtx();
  renderArtwork(ctx, size, recipe);
  return JSON.stringify(ctx.calls);
};

test("同一 seed 必得同一配方与同一指纹", () => {
  for (const seed of [1, "jigsaw", 4294967295, "l1"]) {
    const a = artworkRecipe(seed);
    const b = artworkRecipe(seed);
    assert.equal(recipeHash(a), recipeHash(b), `seed=${seed} 配方不确定`);
    assert.deepEqual(a, b);
  }
});

test("不同 seed 得到不同配方（抽样 60 个）", () => {
  const seen = new Map();
  for (let i = 0; i < 60; i++) {
    const hash = recipeHash(artworkRecipe(`seed-${i}`));
    assert.ok(!seen.has(hash), `seed-${i} 与 seed-${seen.get(hash)} 撞图`);
    seen.set(hash, i);
  }
});

test("50 关的 seed 两两不撞图", () => {
  const seen = new Map();
  for (const level of LEVELS) {
    const hash = recipeHash(artworkRecipe(level.seed, level.art));
    assert.ok(!seen.has(hash), `${level.id} 与 ${seen.get(hash)} 图相同`);
    seen.set(hash, level.id);
  }
});

test("同一 seed 的绘制调用序列完全一致（像素一致的充分条件）", () => {
  const recipe = artworkRecipe("stable");
  assert.equal(logOf(recipe), logOf(recipe));
  assert.equal(logOf(artworkRecipe("stable")), logOf(artworkRecipe("stable")));
});

test("不同 seed 的绘制调用序列不同", () => {
  assert.notEqual(logOf(artworkRecipe("alpha")), logOf(artworkRecipe("beta")));
});

test("配方取值全部落在合法区间", () => {
  for (const level of LEVELS) {
    const recipe = artworkRecipe(level.seed, level.art);
    assert.equal(recipe.bg.stops.length, 3);
    for (const stop of recipe.bg.stops) {
      assert.ok(stop.sat >= 0 && stop.sat <= 100, `饱和度越界: ${stop.sat}`);
      assert.ok(stop.light >= 0 && stop.light <= 100, `亮度越界: ${stop.light}`);
    }
    assert.ok(recipe.bg.angle >= 0 && recipe.bg.angle < 360);
    assert.ok(recipe.shapes.length >= 3 && recipe.shapes.length <= 14, `形状数量异常: ${recipe.shapes.length}`);
    for (const shape of recipe.shapes) {
      assert.ok(shape.x >= 0 && shape.x <= 1, `x 越界: ${shape.x}`);
      assert.ok(shape.y >= 0 && shape.y <= 1, `y 越界: ${shape.y}`);
      assert.ok(shape.r > 0 && shape.r <= 0.5, `半径越界: ${shape.r}`);
      assert.ok(shape.alpha > 0 && shape.alpha <= 1, `透明度越界: ${shape.alpha}`);
      assert.ok(shape.sat >= 0 && shape.sat <= 100);
      assert.ok(shape.light >= 0 && shape.light <= 100);
      assert.ok(shape.sides >= 3 && shape.sides <= 7);
    }
    assert.ok(recipe.strokes.length >= 2 && recipe.strokes.length <= 6);
    for (const stroke of recipe.strokes) {
      assert.ok(stroke.width > 0 && stroke.width < 0.1, `线宽越界: ${stroke.width}`);
      assert.ok(stroke.alpha > 0 && stroke.alpha < 1);
    }
    assert.ok(recipe.grain.points.length >= 30, "细噪点数量不足");
    for (const point of recipe.grain.points) {
      assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
      assert.ok(point.r > 0);
    }
  }
});

test("detail 越高形状与噪点越多（第 5 章比第 1 章细腻）", () => {
  const low = artworkRecipe("detail-probe", { detail: 0, contrast: 0.5 });
  const high = artworkRecipe("detail-probe", { detail: 1, contrast: 0.5 });
  assert.ok(high.shapes.length > low.shapes.length, "高细节应有更多形状");
  assert.ok(high.grain.points.length > low.grain.points.length, "高细节应有更多噪点");
  assert.ok(high.strokes.length >= low.strokes.length);
});

test("contrast 影响形状透明度与明度（高对比更实、更暗）", () => {
  const soft = artworkRecipe("contrast-probe", { detail: 0.5, contrast: 0 });
  const hard = artworkRecipe("contrast-probe", { detail: 0.5, contrast: 1 });
  const alphaSum = (recipe) => recipe.shapes.reduce((sum, shape) => sum + shape.alpha, 0);
  const lightSum = (recipe) => recipe.shapes.reduce((sum, shape) => sum + shape.light, 0);
  assert.ok(alphaSum(hard) > alphaSum(soft), "高对比应更实");
  assert.ok(lightSum(hard) < lightSum(soft), "高对比应更暗");
});

// ---- 切片可辨认性：这两条守的是"拼图能不能玩"，不是美术好不好看 ----
// PRD §3.3 要求第 1 章"高对比渐变（易辨认）"，§8 风险 3 要求 5×5 也有视觉锚点。
// 底色明暗跨度是"每格亮度互不相同"的前提；特征铺满是"每格附近都有锚点"的前提。

test("底色明暗跨度随 contrast 增大（第 1 章必须拉开明暗）", () => {
  const span = (contrast) => {
    const lights = artworkRecipe("span-probe", { detail: 0.5, contrast }).bg.stops.map((s) => s.light);
    return Math.max(...lights) - Math.min(...lights);
  };
  const soft = span(0);
  const hard = span(1);
  assert.ok(hard > soft, `高对比章的明暗跨度应更大: hard=${hard} soft=${soft}`);
  assert.ok(hard >= 40, `contrast=1 的明暗跨度应 ≥ 40（当前 ${hard}），否则切片后无法靠亮度区分`);
  assert.ok(soft <= 20, `contrast=0 应保持柔和（跨度 ≤ 20，当前 ${soft}）`);
});

test("50 关的几何特征铺满四个象限（不挤在一角）", () => {
  for (const level of LEVELS) {
    const recipe = artworkRecipe(level.seed, level.art);
    const quads = new Set(recipe.shapes.map((s) => `${s.x < 0.5 ? 0 : 1}${s.y < 0.5 ? 0 : 1}`));
    assert.equal(
      quads.size,
      4,
      `${level.id} 有象限没有任何几何特征（形状 ${recipe.shapes.length} 个），切片后该区域无法辨认`
    );
  }
});

test("几何特征数量随 detail 上升，且足以覆盖 5×5 的 25 格", () => {
  const countAt = (detail) => artworkRecipe("cover-probe", { detail, contrast: 0.5 }).shapes.length;
  assert.ok(countAt(1) > countAt(0.5) && countAt(0.5) > countAt(0), "特征数应随 detail 单调上升");
  const chapter5 = LEVELS.filter((l) => l.chapter === 5);
  for (const level of chapter5) {
    const recipe = artworkRecipe(level.seed, level.art);
    assert.ok(recipe.shapes.length >= 9, `${level.id} 只有 ${recipe.shapes.length} 个特征，5×5 会出现空白格`);
  }
});

test("detail / contrast 越界时被钳制，不会污染配方", () => {
  const recipe = artworkRecipe("clamp", { detail: 5, contrast: -3 });
  assert.equal(recipe.detail, 1);
  assert.equal(recipe.contrast, 0);
  const nan = artworkRecipe("clamp-nan", { detail: Number.NaN, contrast: "x" });
  assert.equal(nan.detail, 0);
  assert.equal(nan.contrast, 0);
});

test("renderArtwork：参数非法时返回 false 而不抛错", () => {
  const ctx = stubCtx();
  const recipe = artworkRecipe("guard");
  assert.equal(renderArtwork(null, 64, recipe), false);
  assert.equal(renderArtwork(ctx, 64, null), false);
  assert.equal(renderArtwork(ctx, 0, recipe), false);
  assert.equal(renderArtwork(ctx, Number.NaN, recipe), false);
  assert.equal(ctx.calls.length, 0);
});

test("renderArtwork：任意尺寸都能画完（缩略图与棋盘切片共用配方）", () => {
  const recipe = artworkRecipe("sizes");
  for (const size of [32, 72, 96, 512, 1024]) {
    const ctx = stubCtx();
    assert.equal(renderArtwork(ctx, size, recipe), true);
    assert.ok(ctx.calls.length > 10, `size=${size} 绘制调用过少`);
    const rect = ctx.calls.find((call) => call[0] === "fillRect");
    assert.deepEqual(rect.slice(1), [0, 0, size, size]);
  }
});

test("hsla：色相归一化，其余分量钳制", () => {
  assert.equal(hsla(0, 50, 50, 1), "hsla(0, 50%, 50%, 1)");
  assert.equal(hsla(-90, 50, 50, 1), "hsla(270, 50%, 50%, 1)");
  assert.equal(hsla(720, 50, 50, 1), "hsla(0, 50%, 50%, 1)");
  assert.equal(hsla(10, 200, -5, 9), "hsla(10, 100%, 0%, 1)");
});

test("createArtworkCanvas：无 DOM 环境返回 null（不抛错）", () => {
  assert.equal(typeof document, "undefined", "node 环境不应有 document");
  assert.equal(createArtworkCanvas("no-dom", 64), null);
});
