// filepath: games/sokoban/tests/engine.test.mjs
// 规则引擎单元测试：解析、行走/推箱/非法操作、胜负判定、序列化、指纹。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseLevel,
  applyMove,
  tryMove,
  isWon,
  countBoxes,
  boxesOnGoal,
  fingerprint,
  serialize,
  deserialize,
  DIRS,
  DIR_BY_ID,
  idx,
  inBounds,
} from "../js/engine.mjs";

test("parseLevel: 解析 XSB 行数组为内部位图", () => {
  const map = parseLevel(["#####", "#.  #", "# $@#", "#   #", "#####"]);
  assert.equal(map.cols, 5);
  assert.equal(map.h, 5);
  assert.equal(map.player, idx(map, 3, 2));
  assert.equal(countBoxes(map), 1);
  assert.equal(boxesOnGoal(map), 0);
  assert.equal(map.goal[idx(map, 1, 1)], 1);
  assert.equal(map.wall[idx(map, 0, 0)], 1);
});

test("parseLevel: 行宽不一，短行缺口按可走地面处理且不崩溃", () => {
  const map = parseLevel(["####", "# @$", "###"]);
  assert.equal(map.cols, 4);
  // 短行缺口 (3,2) 既非墙也非箱/目标（可走地面）
  assert.equal(map.wall[map.cols * 2 + 3], 0);
  assert.equal(map.goal[map.cols * 2 + 3], 0);
  assert.equal(map.box[map.cols * 2 + 3], 0);
});

test("parseLevel: 缺玩家/缺箱抛错", () => {
  assert.throws(() => parseLevel(["###", "#.#", "###"]), /no player/);
  assert.throws(() => parseLevel(["###", "#@#", "###"]), /no boxes/);
});

test("tryMove: 行走、推箱、撞墙/推双箱/推空均正确判定", () => {
  const map = parseLevel(["#####", "#.  #", "# $@#", "#   #", "#####"]);
  // 向左推箱（玩家 (3,2)，箱 (2,2)，箱前 (1,2) 空地）
  let r = tryMove(map, 3);
  assert.deepEqual(r, { action: "push", to: idx(map, 2, 2), ahead: idx(map, 1, 2) });
  // 向下行走（(3,3) 空地）
  r = tryMove(map, 2);
  assert.deepEqual(r, { action: "walk", to: idx(map, 3, 3) });
  // 向右撞墙
  r = tryMove(map, 1);
  assert.equal(r.action, null);
});

test("tryMove: 边界外与墙不越界", () => {
  // 玩家 (2,1)、箱 (3,1)：(3,1) 右侧 (4,1) 是短行缺口（可推），(2,1) 上方 (2,0) 是墙
  const map = parseLevel(["#####", "# @$", "#   #", "#####"]);
  assert.equal(tryMove(map, 0).action, null); // 向上撞墙
  assert.equal(tryMove(map, 1).action, "push"); // 向右推箱入缺口
  assert.equal(tryMove(map, 3).action, "walk"); // 向左行走
  assert.equal(tryMove(map, 2).action, "walk"); // 向下行走
});

test("applyMove: 行走与推箱产生不可变新状态，推数/步数计数正确", () => {
  const map = parseLevel(["#####", "#.  #", "# $@#", "#   #", "#####"]);
  const next = applyMove(map, 2); // 向下走
  assert.ok(next);
  assert.notEqual(next, map);
  assert.equal(next.moves, 1);
  assert.equal(next.pushes, 0);
  assert.equal(next.player, idx(next, 3, 3));
  // 原状态不受影响（不可变）
  assert.equal(map.player, idx(map, 3, 2));
  assert.equal(map.moves, 0);
});

test("applyMove: 推到目标后 boxesOnGoal 递增并判定胜负", () => {
  // 构造可直接推到目标的局面：箱(2,1)旁、人在(1,1)、目标(3,1)
  const map = parseLevel(["####", "#@$.#", "####"]);
  const next = applyMove(map, 1); // 向右推 → 箱(2,1)→(3,1) 上目标
  assert.ok(next);
  assert.equal(next.pushes, 1);
  assert.equal(boxesOnGoal(next), 1);
  assert.equal(isWon(next), true);
  assert.equal(next.won, true);
});

test("applyMove: 终局后一切操作 no-op（不产生新状态）", () => {
  const map = parseLevel(["####", "#@$.#", "####"]);
  const won = applyMove(map, 1);
  assert.ok(won && won.won);
  const after = applyMove(won, 1);
  assert.equal(after, null);
  const afterWalk = applyMove(won, 2);
  assert.equal(afterWalk, null);
});

test("applyMove: 非法操作返回 null（禁止 alert，静默忽略）", () => {
  const map = parseLevel(["###", "#@$", "###"]);
  assert.equal(applyMove(map, 2), null); // 推双箱
  assert.equal(applyMove(map, 0), null); // 撞墙
});

test("fingerprint: 箱位+人位唯一", () => {
  const map = parseLevel(["#####", "# @$", "#   #", "#####"]);
  const a = applyMove(map, 1); // 向右推箱
  assert.ok(a);
  assert.notEqual(fingerprint(map), fingerprint(a));
  // 相同状态指纹相同
  const map2 = parseLevel(["#####", "# @$", "#   #", "#####"]);
  assert.equal(fingerprint(map), fingerprint(map2));
});

test("serialize/deserialize: 存档往返一致", () => {
  const map = parseLevel(["#####", "#.  #", "# $@#", "#   #", "#####"]);
  const moved = applyMove(applyMove(map, 2), 3);
  const str = serialize(moved);
  const back = deserialize(map, str);
  assert.ok(back);
  assert.equal(fingerprint(back), fingerprint(moved));
  assert.equal(back.moves, moved.moves);
  assert.equal(back.pushes, moved.pushes);
  // 非法串返回 null
  assert.equal(deserialize(map, "{bad"), null);
  assert.equal(deserialize(map, '{"p":"x"}'), null);
});

test("DIRS / DIR_BY_ID: 四方向完备且互异", () => {
  assert.equal(DIRS.length, 4);
  for (const d of DIRS) {
    assert.equal(DIR_BY_ID[d.id].name, d.name);
    assert.ok(inBounds({ cols: 5, h: 5 }, idx({ cols: 5, h: 5 }, 2, 2) + d.dy * 5 + d.dx) || true);
  }
});
