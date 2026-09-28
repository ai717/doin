import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIR_NAMES,
  STATUS,
  PELLET,
  createState,
  cloneState,
  step,
  isLegalDir,
  legalDirs,
  bodySet,
  resolveTarget,
  activePellet,
  validateLevel,
  totalShrink,
  mulberry32
} from "../js/engine.mjs";

// ---------- 构造工具 ----------
function mk(level) {
  return createState({ walls: [], portals: [], pellets: [], ...level });
}

// 3×3 / 蛇长 3 / 单颗 delta=2 的丸在 (1,0)：一步吃掉即完成蜕皮
const TINY = {
  cols: 3,
  rows: 3,
  snake: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }],
  pellets: [{ r: 1, c: 0, delta: 2, kind: PELLET.SHRINK }]
};

// 7×7 蛇形盘踞、蛇长 12 的合法关卡（自由格 37）
function serpentineLevel(len = 12) {
  const cols = 7;
  const rows = 7;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const c = r % 2 === 0 ? i : cols - 1 - i;
      cells.push({ r, c });
    }
  }
  return {
    cols,
    rows,
    snake: cells.slice(0, len),
    walls: [],
    portals: [],
    pellets: [
      { r: 2, c: 0, delta: 2, kind: PELLET.SHRINK },
      { r: 2, c: 2, delta: 2, kind: PELLET.SHRINK },
      { r: 2, c: 4, delta: 2, kind: PELLET.SHRINK },
      { r: 2, c: 6, delta: 2, kind: PELLET.SHRINK },
      { r: 3, c: 1, delta: 2, kind: PELLET.SHRINK },
      { r: 3, c: 3, delta: 1, kind: PELLET.SHRINK }
    ]
  };
}

test("createState 初始化字段与派生结构正确", () => {
  const s = mk(TINY);
  assert.equal(s.snake.length, 3);
  assert.equal(s.steps, 0);
  assert.equal(s.status, STATUS.PLAYING);
  assert.equal(s.pelletIndex, 0);
  assert.equal(s.dir, null);
  assert.equal(s.wallSet.size, 0);
  assert.equal(s.portalExit.size, 0);
});

test("createState 深拷贝关卡数据，改 state 不污染原始 level", () => {
  const level = mk(TINY) && TINY;
  const s = createState(level);
  s.snake[0].r = 99;
  assert.equal(level.snake[0].r, 0);
});

test("基本移动：头进一格、尾退一格、长度不变", () => {
  const s0 = mk({ cols: 5, rows: 5, snake: [{ r: 2, c: 2 }, { r: 2, c: 1 }, { r: 2, c: 0 }] });
  const { action, state } = step(s0, "right");
  assert.ok(action);
  assert.equal(state.snake.length, 3);
  assert.deepEqual(state.snake[0], { r: 2, c: 3 });
  assert.deepEqual(state.snake[1], { r: 2, c: 2 });
  assert.deepEqual(state.snake[2], { r: 2, c: 1 });
  assert.equal(state.steps, 1);
});

test("长度 > 2 时禁止 180° 直反向", () => {
  const s0 = mk({ cols: 5, rows: 5, snake: [{ r: 2, c: 2 }, { r: 2, c: 3 }, { r: 2, c: 4 }] });
  s0.dir = "right";
  assert.equal(isLegalDir(s0, "left"), false);
  assert.equal(step(s0, "left").action, null);
});

test("长度 ≤ 2 时放开反向限制，避免误判困毙", () => {
  const s0 = mk({ cols: 5, rows: 5, snake: [{ r: 2, c: 2 }, { r: 2, c: 3 }] });
  s0.dir = "right";
  assert.equal(isLegalDir(s0, "left"), true);
});

test("越界方向非法", () => {
  const s0 = mk({ cols: 3, rows: 3, snake: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }] });
  assert.equal(isLegalDir(s0, "up"), false);
  assert.equal(isLegalDir(s0, "left"), false);
});

test("撞自己身体非法（尾巴以外的所有节）", () => {
  // 头 (1,1)；身体盘住 (0,1) 与 (1,0)，尾在 (2,0)
  const s0 = mk({
    cols: 4, rows: 4,
    snake: [{ r: 1, c: 1 }, { r: 0, c: 1 }, { r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }]
  });
  assert.equal(isLegalDir(s0, "up"), false);   // (0,1) 是第 2 节
  assert.equal(isLegalDir(s0, "left"), false); // (1,0) 是第 4 节
});

test("★ 追尾合法：头可以走进尾巴这一 tick 让出的格子", () => {
  // 头 (1,1)，尾 (1,0) 正好在头的左边；尾巴同步让位，故 left 合法
  const s0 = mk({
    cols: 5, rows: 5,
    snake: [{ r: 1, c: 1 }, { r: 0, c: 1 }, { r: 0, c: 0 }, { r: 1, c: 0 }]
  });
  assert.deepEqual(s0.snake[3], { r: 1, c: 0 });
  assert.equal(isLegalDir(s0, "left"), true);
  const { state } = step(s0, "left");
  assert.deepEqual(state.snake[0], { r: 1, c: 0 });
  assert.equal(state.snake.length, 4);
  // 追尾后蛇身依然连续无重叠
  const seen = new Set(state.snake.map((p) => p.r * 5 + p.c));
  assert.equal(seen.size, 4);
});

test("bodySet(excludeTail) 精确排除最后一节", () => {
  const s0 = mk({ cols: 5, rows: 5, snake: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }] });
  assert.equal(bodySet(s0, true).has(0 * 5 + 2), false);
  assert.equal(bodySet(s0, false).has(0 * 5 + 2), true);
});

test("吃到蜕身丸：长度按 delta 缩短，尾部脱落 delta+1 节", () => {
  // 蛇长 5，delta = 2 → newLen = 3，尾部应脱落 3 节（1 + delta）
  const s0 = mk({
    cols: 6, rows: 3,
    snake: [
      { r: 1, c: 1 }, { r: 0, c: 1 }, { r: 0, c: 2 },
      { r: 0, c: 3 }, { r: 0, c: 4 }
    ],
    pellets: [{ r: 1, c: 0, delta: 2, kind: PELLET.SHRINK }]
  });
  const { action, state } = step(s0, "left");
  assert.ok(action.ate);
  assert.equal(action.ate.delta, 2);
  assert.equal(state.snake.length, 3);
  assert.deepEqual(action.ate.shed, [
    { r: 0, c: 2 }, { r: 0, c: 3 }, { r: 0, c: 4 }
  ]);
  assert.deepEqual(state.snake, [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 0, c: 1 }]);
});

test("吃到蜕身丸：delta 足以把整条蛇削到 1 节时，旧蛇全部崩解", () => {
  const s0 = mk(TINY);
  const { action, state } = step(s0, "down");
  assert.equal(state.snake.length, 1);
  assert.deepEqual(action.ate.shed, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]);
  assert.deepEqual(state.snake, [{ r: 1, c: 0 }]);
});

test("吃丸后 pelletIndex 前进并报告下一颗丸（spawned）", () => {
  const s0 = mk({
    cols: 5, rows: 5,
    snake: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }],
    pellets: [{ r: 1, c: 0, delta: 1 }, { r: 3, c: 3, delta: 2, kind: PELLET.MEGA }]
  });
  const { action, state } = step(s0, "down");
  assert.equal(state.pelletIndex, 1);
  assert.deepEqual(action.spawned, { r: 3, c: 3, delta: 2, kind: PELLET.MEGA });
  assert.equal(state.snake.length, 3);
});

test("吃掉最后一颗丸后 pelletIndex 归 -1 且 spawned 为 null", () => {
  const s0 = mk({
    cols: 5, rows: 5,
    snake: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }],
    pellets: [{ r: 1, c: 0, delta: 1 }]
  });
  const { action, state } = step(s0, "down");
  assert.equal(state.pelletIndex, -1);
  assert.equal(action.spawned, null);
  assert.equal(activePellet(state), null);
});

test("长度降为 1 → WON", () => {
  const { state } = step(mk(TINY), "down");
  assert.equal(state.snake.length, 1);
  assert.equal(state.status, STATUS.WON);
});

test("delta 大于当前长度时钳制到 1，不会变成长度 0 或负数", () => {
  const s0 = mk({
    cols: 5, rows: 5,
    snake: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }],
    pellets: [{ r: 1, c: 0, delta: 99 }]
  });
  const { state } = step(s0, "down");
  assert.equal(state.snake.length, 1);
  assert.equal(state.status, STATUS.WON);
});

test("困毙：头部四周全部不可进入 → ENTOMBED", () => {
  // 3×3 里一条长 6 的蛇，按既定轨迹走 5 步后头被彻底封死
  const s0 = mk({
    cols: 3, rows: 3,
    snake: [
      { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 },
      { r: 1, c: 2 }, { r: 2, c: 2 }, { r: 2, c: 1 }
    ]
  });
  let s = s0;
  // 前 3 步钻进左下角，此时还剩 left / right 两个出口
  for (const d of ["down", "right", "down"]) {
    s = step(s, d).state;
    assert.equal(s.status, STATUS.PLAYING, `走 ${d} 之后不应提前结束`);
  }
  assert.deepEqual(legalDirs(s).slice().sort(), ["left", "right"]);
  // 第 4 步钻进 (2,0) 死角 → 头四周全被自己封死
  s = step(s, "left").state;
  assert.equal(s.status, STATUS.ENTOMBED);
  assert.equal(legalDirs(s).length, 0);
  assert.equal(s.steps, 4);
});

test("开局即无路可走的局面被如实标记为 ENTOMBED", () => {
  // 3×3 盘踞 8 格，头被自己的身体完全围死
  const s = mk({
    cols: 3, rows: 3,
    snake: [
      { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 2 },
      { r: 1, c: 1 }, { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 2, c: 1 }
    ]
  });
  assert.equal(s.status, STATUS.ENTOMBED);
});

test("终局后 step 一律 no-op（won 与 entombed 都是）", () => {
  const won = step(mk(TINY), "down").state;
  const r1 = step(won, "down");
  assert.equal(r1.action, null);
  assert.equal(r1.state, won);

  const dead = mk({
    cols: 3, rows: 3,
    snake: [
      { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 2 },
      { r: 1, c: 1 }, { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 2, c: 1 }
    ]
  });
  const r2 = step(dead, "down");
  assert.equal(r2.action, null);
  assert.equal(r2.state, dead);
});

test("非法方向静默忽略：action 为 null 且原 state 引用不变", () => {
  const s0 = mk(TINY);
  const res = step(s0, "up");
  assert.equal(res.action, null);
  assert.equal(res.state, s0);
  assert.equal(s0.steps, 0);
});

test("step 是纯函数：不修改传入的 state", () => {
  const s0 = mk({ cols: 5, rows: 5, snake: [{ r: 2, c: 2 }, { r: 2, c: 1 }, { r: 2, c: 0 }] });
  const snapshot = JSON.stringify(s0.snake);
  const n = s0.snake.length;
  step(s0, "right");
  assert.equal(s0.snake.length, n);
  assert.equal(JSON.stringify(s0.snake), snapshot);
  assert.equal(s0.steps, 0);
  assert.equal(s0.dir, null);
});

test("cloneState 产出深拷贝，改副本不影响原状态", () => {
  const s0 = mk(TINY);
  const c = cloneState(s0);
  c.snake[0].r = 42;
  c.wallSet.add(1);
  c.portalExit.set(1, 2);
  assert.equal(s0.snake[0].r, 0);
  assert.equal(s0.wallSet.size, 0);
  assert.equal(s0.portalExit.size, 0);
});

test("岩层阻挡：墙不可进入", () => {
  const s0 = mk({
    cols: 5, rows: 5,
    snake: [{ r: 2, c: 2 }, { r: 2, c: 1 }, { r: 2, c: 0 }],
    walls: [{ r: 2, c: 3 }]
  });
  assert.equal(isLegalDir(s0, "right"), false);
  assert.equal(s0.wallSet.has(2 * 5 + 3), true);
});

test("回环门：踏入 A 门即从 B 门射出，并在 action 里报告 teleport", () => {
  const s0 = mk({
    cols: 6, rows: 3,
    snake: [{ r: 1, c: 1 }, { r: 1, c: 0 }],
    portals: [[{ r: 1, c: 2 }, { r: 1, c: 5 }]]
  });
  const t = resolveTarget(s0, "right");
  assert.deepEqual(t.from, { r: 1, c: 2 });
  assert.deepEqual(t.to, { r: 1, c: 5 });
  const { action, state } = step(s0, "right");
  assert.deepEqual(action.teleport, { from: { r: 1, c: 2 }, to: { r: 1, c: 5 } });
  assert.deepEqual(state.snake[0], { r: 1, c: 5 });
});

test("回环门出口被蛇身压住时该方向非法", () => {
  const s0 = mk({
    cols: 6, rows: 3,
    snake: [{ r: 1, c: 1 }, { r: 1, c: 5 }, { r: 1, c: 4 }],
    portals: [[{ r: 1, c: 2 }, { r: 1, c: 5 }]]
  });
  assert.equal(isLegalDir(s0, "right"), false);
});

test("回环门洞口被蛇身压住时该方向非法", () => {
  const s0 = mk({
    cols: 6, rows: 3,
    snake: [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 0 }],
    portals: [[{ r: 1, c: 2 }, { r: 1, c: 5 }]]
  });
  assert.equal(isLegalDir(s0, "right"), false);
});

test("validateLevel：健康关卡零问题", () => {
  const level = serpentineLevel(12);
  level.par = 40;
  assert.deepEqual(validateLevel(level), []);
  assert.equal(totalShrink(level), 11);
});

test("validateLevel：能抓出各类坏数据", () => {
  const base = serpentineLevel(12);
  assert.ok(validateLevel({ ...base, snake: [{ r: 99, c: 0 }] }).includes("snake_out_of_bounds"));
  assert.ok(validateLevel({
    ...base, snake: [{ r: 0, c: 0 }, { r: 0, c: 0 }]
  }).includes("snake_overlap"));
  assert.ok(validateLevel({
    ...base, snake: [{ r: 0, c: 0 }, { r: 0, c: 2 }]
  }).includes("snake_not_connected"));
  assert.ok(validateLevel({ ...base, walls: [{ r: 0, c: 0 }] }).includes("wall_on_snake"));
  assert.ok(validateLevel({ ...base, pellets: [] }).includes("no_pellets"));
  assert.ok(validateLevel({
    ...base, pellets: [{ r: 0, c: 0, delta: 2 }]
  }).includes("first_pellet_on_snake"));
  assert.ok(validateLevel({
    ...base, pellets: [{ r: 3, c: 3, delta: 0 }]
  }).includes("bad_pellet_delta"));
  assert.ok(validateLevel({
    ...base, pellets: [{ r: 3, c: 3, delta: 1 }]
  }).includes("insufficient_shrink"));
});

test("≥1000 步随机游走：不变式守恒、不抛错、不卡死", () => {
  const rng = mulberry32(20260928);
  const level = serpentineLevel(12);
  let s = mk(level);
  let moved = 0;
  let restarts = 0;

  while (moved < 1000) {
    const dirs = legalDirs(s);
    assert.ok(dirs.length > 0, "playing 状态下必须至少有一个合法方向");
    const dir = dirs[Math.floor(rng() * dirs.length)];
    const { action, state } = step(s, dir);

    assert.ok(action, "合法方向必须被执行（合法操作不得被拦截）");
    s = state;

    // 不变式 1：蛇身互不重叠
    const seen = new Set();
    for (const p of s.snake) {
      const k = p.r * s.cols + p.c;
      assert.equal(seen.has(k), false, "蛇身出现自重叠");
      seen.add(k);
    }
    // 不变式 2：蛇身首尾相连
    for (let i = 1; i < s.snake.length; i++) {
      const d = Math.abs(s.snake[i].r - s.snake[i - 1].r) + Math.abs(s.snake[i].c - s.snake[i - 1].c);
      assert.equal(d, 1, "蛇身出现断裂");
    }
    // 不变式 3：长度单调不增，且始终 ≥ 1
    assert.ok(s.snake.length >= 1 && s.snake.length <= 12);
    // 不变式 4：长度归 1 ⟺ WON
    assert.equal(s.snake.length === 1, s.status === STATUS.WON);
    // 不变式 5：全部格子在界内
    for (const p of s.snake) {
      assert.ok(p.r >= 0 && p.r < s.rows && p.c >= 0 && p.c < s.cols);
    }
    // 不变式 6：蛇身不会压在墙上
    for (const p of s.snake) assert.equal(s.wallSet.has(p.r * s.cols + p.c), false);

    moved++;
    if (s.status !== STATUS.PLAYING) {
      s = mk(level);
      restarts++;
    }
  }
  assert.ok(moved >= 1000);
  assert.ok(restarts >= 0);
});

test("随机游走中四个方向名与解析结果保持一致", () => {
  const s = mk(serpentineLevel(12));
  for (const d of DIR_NAMES) {
    const t = resolveTarget(s, d);
    if (!t) continue;
    assert.ok(t.r >= -1 && t.c >= -1);
  }
  assert.equal(DIR_NAMES.length, 4);
});
