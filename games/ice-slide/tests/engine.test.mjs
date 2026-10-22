// filepath: games/ice-slide/tests/engine.test.mjs
// 规则引擎单元测试：解析、滑至停、推箱三态（同步滑/箱堵死/链式停）、
// 灯标判定、终局 no-op、序列化、随机游走不变量、确定性重放。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseLevel,
  slide,
  previewSlide,
  isWon,
  countBoxes,
  boxesOnGoal,
  legalDirs,
  fingerprint,
  serialize,
  deserialize,
  blockedAhead,
  idx,
  DIRS,
  DIR_BY_ID,
} from "../js/engine.mjs";

// 确定性 PRNG（与全站约定一致的 mulberry32）
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const L1 = ["#######", "#@$  .#", "#######"]; // 一推通关：箱顺墙滑至灯标
const L2 = ["#########", "#@    $#", "#########"]; // 人远距离滑向撞墙即堵死的箱
const L3 = ["###########", "#@  $  $  #", "###########"]; // 链式停箱
const L4 = ["#######", "#@$ . #", "#######"]; // 箱滑过灯标不停（灯标未贴刹车点）
const L5 = ["#######", "#@* $.#", "#######"]; // 双箱：把箱推离灯标

test("parseLevel: 字符口径与 sokoban 一致（* 箱在灯标 / + 人在灯标）", () => {
  const m = parseLevel(["#####", "#+* #", "# $ #", "#####"]);
  assert.equal(m.cols, 5);
  assert.equal(m.h, 4);
  assert.equal(m.player, idx(m, 1, 1));
  assert.equal(countBoxes(m), 2);
  assert.equal(boxesOnGoal(m), 1);
  assert.equal(m.goal[idx(m, 1, 1)], 1);
  assert.equal(m.wall[idx(m, 0, 0)], 1);
  assert.throws(() => parseLevel(["###", "# #", "###"]), /no player/);
  assert.throws(() => parseLevel([]), /empty level/);
});

test("slide: 沿冰面滑行，撞墙才停（中途无法刹车）", () => {
  const m = parseLevel(["########", "#@     #", "# $  . #", "########"]);
  const nx = slide(m, 1); // 右
  assert.ok(nx);
  assert.equal(nx.player, idx(nx, 6, 1)); // 一路滑到右墙前
  assert.equal(nx.moves, 1);
  assert.equal(nx.pushes, 0);
  assert.equal(nx.last.boxFrom, -1);
  assert.equal(nx.last.path[0], m.player);
  assert.equal(nx.last.path.at(-1), nx.player);
  assert.equal(nx.last.path.length, 6); // 连走过的 6 格
  assert.ok(blockedAhead(nx, nx.player, 1)); // 滑行停驻：前方必堵死
  assert.equal(countBoxes(nx), countBoxes(m)); // 没碰箱
});

test("slide: 紧贴墙的方向是无效意图，返回 null 静默忽略", () => {
  const m = parseLevel(L1);
  assert.equal(slide(m, 3), null); // 左：左边就是墙
  assert.equal(slide(m, 0), null); // 上
  assert.equal(slide(m, 2), null); // 下
  assert.equal(m.moves, 0); // 原状态不被污染
});

test("slide: 推箱——人箱同步滑行至箱撞停，人停在箱后一格", () => {
  const m = parseLevel(L1);
  const nx = slide(m, 1); // 右推
  assert.ok(nx);
  assert.equal(nx.last.boxFrom, idx(m, 2, 1));
  assert.equal(nx.last.boxTo, idx(m, 5, 1)); // 箱滑到右墙前（灯标位）
  assert.equal(nx.player, idx(m, 4, 1)); // 人停在箱后一格
  assert.equal(nx.moves, 1);
  assert.equal(nx.pushes, 1);
  assert.equal(boxesOnGoal(nx), 1);
  assert.equal(isWon(nx), true); // 一推通关
});

test("slide: 箱前方堵死——人滑到箱前相邻格即停，步数照算（P0 规则修复）", () => {
  const m = parseLevel(L2); // 箱 (6,1) 右边是墙，完全推不动
  const nx = slide(m, 1); // 右
  assert.ok(nx); // 不是无效意图：人确实滑过来了
  assert.equal(nx.player, idx(m, 5, 1)); // 停在箱前相邻格
  assert.equal(nx.moves, 1); // 步数照算
  assert.equal(nx.pushes, 0); // 但没有推动
  assert.equal(nx.last.boxFrom, -1);
  assert.equal(countBoxes(nx), 1);
  assert.equal(nx.box[idx(m, 6, 1)], 1); // 箱纹丝未动
  assert.equal(isWon(nx), false);
  // 已贴箱再朝箱滑：人纹丝不动 -> null
  assert.equal(slide(nx, 1), null);
});

test("slide: 推箱链——前箱撞停后箱即停，人停在第二箱后", () => {
  const m = parseLevel(L3); // 箱 A (4,1)，箱 B (7,1)
  const nx = slide(m, 1); // 右推 A
  assert.ok(nx);
  assert.equal(nx.last.boxFrom, idx(m, 4, 1));
  assert.equal(nx.last.boxTo, idx(m, 6, 1)); // A 停在 B 前相邻格
  assert.equal(nx.player, idx(m, 5, 1)); // 人贴在 A 后
  assert.equal(nx.box[idx(m, 7, 1)], 1); // B 未动
  assert.equal(countBoxes(nx), 2);
});

test("slide: 箱可滑过灯标不停——灯标必须贴刹车点（关卡设计约束）", () => {
  const m = parseLevel(L4); // 灯标 (4,1) 在滑道中，箱只会停在 (5,1)
  const nx = slide(m, 1);
  assert.ok(nx);
  assert.equal(nx.last.boxTo, idx(m, 5, 1));
  assert.equal(boxesOnGoal(nx), 0); // 滑过了，没停上
  assert.equal(isWon(nx), false);
});

test("slide: 终局后一切操作 no-op", () => {
  const m = parseLevel(L1);
  const won = slide(m, 1);
  assert.equal(isWon(won), true);
  for (const d of DIRS) assert.equal(slide(won, d.id), null);
});

test("slide: 箱被推离灯标即熄灭", () => {
  const m = parseLevel(L5); // 箱1在灯标 (2,1)，箱2 (4,1)，灯标 (5,1)
  assert.equal(boxesOnGoal(m), 1);
  assert.equal(isWon(m), false);
  const nx = slide(m, 1); // 右推：箱1滑到 (3,1)（撞箱2即停），离开灯标
  assert.ok(nx);
  assert.equal(nx.last.boxTo, idx(m, 3, 1));
  assert.equal(boxesOnGoal(nx), 0);
  assert.equal(isWon(nx), false);
});

test("serialize/deserialize: 存档往返等价，指纹一致", () => {
  const m = parseLevel(L1);
  const nx = slide(m, 1);
  const str = serialize(nx);
  const back = deserialize(m, str);
  assert.ok(back);
  assert.equal(back.player, nx.player);
  assert.equal(back.moves, nx.moves);
  assert.equal(back.pushes, nx.pushes);
  assert.equal(fingerprint(back), fingerprint(nx));
  assert.equal(deserialize(m, "{broken"), null); // 损坏数据静默降级
});

test("legalDirs 与 previewSlide 口径一致", () => {
  const m = parseLevel(L1);
  assert.deepEqual(legalDirs(m), [1]); // 只有右能移动
  const nx = slide(m, 1);
  assert.equal(legalDirs(nx).length, 0); // 已通关
});

// ---- 随机游走与确定性重放 ----

const WALK_LEVELS = [
  L1,
  ["#######", "#     #", "#@$   #", "#    .#", "#######"], // S3：可解
  ["#########", "#   @   #", "#       #", "#     $.#", "#########"], // S2：可解
  ["#######", "#@* $.#", "#   $  #", "#######"], // 双箱单灯标：永不通关，专走长路
];

function walk(rows, seed, steps) {
  const rand = mulberry32(seed);
  let st = parseLevel(rows);
  const fps = [fingerprint(st)];
  const dirSeq = [];
  for (let i = 0; i < steps; i++) {
    const dir = Math.floor(rand() * 4); // 含无效方向，覆盖 no-op 路径
    dirSeq.push(dir);
    const nx = slide(st, dir);
    if (!nx) continue;
    assert.notEqual(nx.player, st.player, "非 null 的滑行必须使人移动");
    assert.equal(nx.moves, st.moves + 1, "每次有效滑行记 1 步");
    assert.equal(countBoxes(nx), countBoxes(st), "箱数守恒");
    // 滑至停：沿滑行方向前方必被墙/箱/边界堵死
    assert.ok(blockedAhead(nx, nx.player, dir), "滑行必须停在被堵方向");
    const last = nx.last;
    const d = DIR_BY_ID[dir];
    if (last.boxFrom >= 0) {
      // 推箱：人恒停在箱最终位置后一格，箱滑行路径连续
      assert.equal(nx.player, last.boxTo - d.dy * nx.cols - d.dx, "人停在箱后一格");
      assert.equal(last.boxPath[0], last.boxFrom);
      assert.equal(last.boxPath.at(-1), last.boxTo);
      assert.equal(nx.pushes, st.pushes + 1);
    } else {
      assert.equal(nx.pushes, st.pushes);
    }
    // 无重叠：箱不压墙、不压人
    for (let c = 0; c < nx.box.length; c++) {
      if (nx.box[c]) {
        assert.equal(nx.wall[c], 0, "箱不能压墙");
        assert.notEqual(c, nx.player, "箱不能压人");
      }
    }
    st = nx;
    fps.push(fingerprint(st));
    if (st.won) break; // 通关即换下一局
  }
  return { fps, dirSeq };
}

test("随机游走 >=1000 步/局：不崩、箱数守恒、滑至停、无重叠", () => {
  for (let li = 0; li < WALK_LEVELS.length; li++) {
    const { fps } = walk(WALK_LEVELS[li], 0x5eed + li, 1200);
    assert.ok(fps.length > 1, "游走应产生状态推进");
  }
});

test("确定性重放：同种子 + 同输入序列 -> 指纹序列逐帧一致", () => {
  for (let li = 0; li < WALK_LEVELS.length; li++) {
    const rows = WALK_LEVELS[li];
    const a = walk(rows, 0xc0de + li, 800);
    // 用记录下的方向序列从头重放
    let st = parseLevel(rows);
    const replay = [fingerprint(st)];
    for (const dir of a.dirSeq) {
      const nx = slide(st, dir);
      if (!nx) continue; // no-op 帧不产生新指纹（与 walk 口径一致）
      st = nx;
      replay.push(fingerprint(st));
    }
    assert.deepEqual(replay, a.fps, "同种子同输入必须逐帧一致");
  }
});
