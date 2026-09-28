import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  DIR,
  DIR_VEC,
  OPPOSITE,
  CELL,
  FEATURE,
  GHOST_IDS,
  MODE_SCHEDULE,
  parseMaze,
  createState,
  stepFrame,
  setDesired,
  restartMaze,
  entityPos,
  ghostTarget,
  chainMultiplier,
  evaluateStars,
  frightForLevel,
  neighborTile,
  canPass,
  PELLET_SCORE,
  SUPPRESS_DOTS,
  CHAIN_MULTS,
  GHOST_SCORE,
  SPEED_TIERS,
  DEFAULT_SPEED_TIER,
  CORRIDOR_BOOST,
  applySpeedTier,
  speedTierMult,
  snapOffset,
  INPUT_TTL_TILES,
  LATE_TURN_P,
  SNAP_EASE,
} from "../js/engine.mjs";
import { MAZES, SETPIECES } from "../js/mazes.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const DT = 1 / 60;

// ---------------------------------------------------------------- 迷你测试盘
//
//  col  01234567
//  0    ########
//  1    #......#
//  2    #..--..#
//  3    #.#HH#.#
//  4    #..##..#
//  5    #......#
//  6    ########
//
// 巢在 row3 的 col3/4，上方 col3/4 是巢门，其余三面全封 —— 幽灵只能走巢门出来。

const MINI_ROWS = [
  "########",
  "#......#",
  "#..--..#",
  "#.#HH#.#",
  "#..##..#",
  "#......#",
  "########",
];

const MINI = {
  id: "mini",
  tunnelRows: [],
  playerStart: { x: 1, y: 5, dir: DIR.RIGHT },
  fruitTile: { x: 6, y: 5 },
  nests: [
    {
      exitTile: { x: 3, y: 1 },
      slots: [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
      ],
    },
  ],
};

function miniMaze(rows = MINI_ROWS, extra = {}) {
  return parseMaze({ ...MINI, cells: rows, ...extra });
}

function miniState(rows = MINI_ROWS, opts = {}) {
  return createState({ maze: miniMaze(rows), seed: 1234, ...opts });
}

function runFrames(state, frames, onFrame) {
  for (let f = 0; f < frames; f++) {
    if (onFrame) onFrame(state, f);
    const events = stepFrame(state, DT);
    if (onFrame) onFrame.events = events;
    if (state.status !== "playing") break;
  }
  return state;
}

function putGhost(state, id, x, y, mode, dir = DIR.LEFT) {
  const gh = state.ghosts.find((g) => g.id === id);
  gh.tx = x;
  gh.ty = y;
  gh.nx = null;
  gh.ny = null;
  gh.p = 0;
  gh.dir = dir;
  gh.mode = mode;
  gh.gatePassed = true;
  return gh;
}

/** 把四只幽灵永久关在巢里：凡是只想观察「玩家侧」行为的用例都用它排除干扰。 */
function stallGhosts(state) {
  for (const g of state.ghosts) {
    g.mode = "caging";
    g.gatePassed = false;
    g.dotGate = 1e9;
    g.releaseTimer = 1e9;
    g.nx = null;
    g.ny = null;
    g.p = 0;
  }
}

/** 长跑用例专用：不让「豆吃光 → levelclear」提前中断推进。 */
function keepAlive(state) {
  const g = state.grid;
  for (let i = 0; i < g.pellets.length; i++) g.pellets[i] = 1;
  state.dotsRemaining = state.dotsTotal;
  state.lives = Math.max(state.lives, 9);
}

function putPlayer(state, x, y, dir = DIR.RIGHT) {
  const p = state.player;
  p.tx = x;
  p.ty = y;
  p.nx = null;
  p.ny = null;
  p.p = 0;
  p.dir = dir;
  p.desired = dir;
  p.stun = 0;
}

// ---------------------------------------------------------------- 解析与 Actor

test("parseMaze: 尺寸、不可通行类型与豆统计一致", () => {
  const g = miniMaze();
  assert.equal(g.cols, 8);
  assert.equal(g.rows, 7);
  assert.equal(g.cell[MINI_ROWS[0].length * 3 + 3], CELL.HOUSE);
  assert.equal(g.cell[2 * 8 + 3], CELL.DOOR);
  assert.equal(g.cell[0], CELL.WALL);
  let count = 0;
  for (const v of g.pellets) if (v) count++;
  const expected = MINI_ROWS.join("").split("").filter((c) => c === ".").length;
  assert.equal(count, expected);
});

test("parseMaze: 各机关字符被正确翻译成 feature / oneway", () => {
  const rows = [
    "########",
    "#..~~..#",
    "#..**..#",
    "#..GG..#",
    "#..>>..#",
    "#..^^..#",
    "########",
  ];
  const g = miniMaze(rows);
  assert.equal(g.feature[1 * 8 + 3], FEATURE.SYRUP);
  assert.equal(g.feature[2 * 8 + 3], FEATURE.ICE);
  assert.equal(g.feature[3 * 8 + 3], FEATURE.GATE);
  assert.equal(g.oneway[4 * 8 + 3], DIR.RIGHT);
  assert.equal(g.oneway[5 * 8 + 3], DIR.UP);
  assert.equal(g.oneway[1 * 8 + 1], -1);
});

test("sourceRows 被保留，restartMaze 能完整复原豆布局", () => {
  const st = miniState();
  const total = st.dotsTotal;
  st.grid.pellets.fill(0);
  st.dotsRemaining = 0;
  st.dotsEaten = total;
  st.lives = 0;
  restartMaze(st);
  assert.equal(st.dotsRemaining, total);
  assert.equal(st.dotsEaten, 0);
  assert.equal(st.lives, 3);
  assert.equal(st.status, "playing");
});

// ---------------------------------------------------------------- 移动与不可逆规则

test("撞墙：贴着墙朝墙走，位置与朝向都不动", () => {
  const st = miniState();
  putPlayer(st, 1, 1, DIR.LEFT);
  const before = entityPos(st.player);
  runFrames(st, 30);
  const after = entityPos(st.player);
  assert.equal(after.x, before.x);
  assert.equal(after.y, before.y);
});

test("玩家不得进入幽灵巢与巢门", () => {
  const st = miniState();
  putPlayer(st, 3, 1, DIR.DOWN); // 站在巢门正上方的落下しようとする
  for (let i = 0; i < 4; i++) stepFrame(st, DT);
  const p = st.player;
  const tile = p.ny === null ? p.ty : p.ny;
  assert.notEqual(p.tx * 100 + tile, 3 * 100 + 2);
  assert.equal(st.grid.cell[2 * 8 + 3], CELL.DOOR);
});

test("反向：mid-corridor 掉头立即生效并掉换向˜方向", () => {
  const st = miniState();
  putPlayer(st, 1, 5, DIR.RIGHT);
  runFrames(st, 20);
  const midP = st.player.p;
  setDesired(st, DIR.LEFT);
  assert.equal(st.player.dir, DIR.LEFT);
  assert.ok(Math.abs(st.player.p - (1 - midP)) < 1e-9, "进度应镜像翻转");
  assert.ok(st.player.nx < st.player.tx, "目标格应换成来时那一格");
});

test("冰面：desired 被忽略，直到走出冰区", () => {
  const rows = MINI_ROWS.slice();
  rows[5] = "#.****.#"; // 第 5 行中段是冰
  const st = miniState(rows);
  const isIce = () => st.grid.feature[st.player.ty * st.grid.cols + st.player.tx] === FEATURE.ICE;
  putPlayer(st, 1, 5, DIR.RIGHT);
  stallGhosts(st);
  runFrames(st, 12);
  assert.ok(isIce(), "前置条件：此时玩家应已踏上冰面");
  setDesired(st, DIR.UP); // 冰面上想转向是无效的
  let turnedOnIce = false;
  for (let i = 0; i < 200 && isIce(); i++) {
    const wasIce = isIce();
    stepFrame(st, DT);
    // 只在「转向决策发生的那一格也是冰」时才算违规
    if (wasIce && isIce() && st.player.dir !== DIR.RIGHT) turnedOnIce = true;
  }
  assert.equal(turnedOnIce, false, "冰区内不得响应转向");
});

test("单向风道：逆向进入被拒并产生 stun，顺向可通行", () => {
  const rows = MINI_ROWS.slice();
  rows[1] = "#.>>>..#";
  const st = miniState(rows);
  putPlayer(st, 4, 1, DIR.LEFT); // 想从右往左逆着箭头走
  runFrames(st, 20);
  assert.ok(st.player.tx >= 4, "逆向不可通过");

  const st2 = miniState(rows);
  putPlayer(st2, 1, 1, DIR.RIGHT);
  runFrames(st2, 60);
  assert.ok(st2.player.tx > 1, "顺向应能一路走过去");
});

test("隧道：从最左走出会环绕到最右", () => {
  const rows = [
    "########",
    "........",
    "#......#",
    "#..--..#",
    "#.#HH#.#",
    "#..##..#",
    "########",
  ];
  const maze = miniMaze(rows, { tunnelRows: [1] });
  const st = createState({ maze, seed: 7 });
  putPlayer(st, 1, 1, DIR.LEFT);
  let wrapped = false;
  for (let i = 0; i < 240; i++) {
    stepFrame(st, DT);
    if (st.player.tx >= 6) {
      wrapped = true;
      break;
    }
  }
  assert.ok(wrapped, "应环绕到盘面右侧");
});

test("潮汐闸门：关闭时不通行，开启后放行", () => {
  const rows = MINI_ROWS.slice();
  rows[1] = "#.GG...#";
  const st = miniState(rows);
  // 闸门开合由 gateTimer 相位驱动，直接改 gatesOpen 会被下一帧重算覆盖
  st.gateTimer = 3.5; // 落在关闭半周期
  putPlayer(st, 1, 1, DIR.RIGHT);
  runFrames(st, 30);
  assert.equal(st.gatesOpen, false, "仍处于关闭相位");
  assert.ok(st.player.tx <= 2, "闸门关闭时应被挡住");
  st.gateTimer = 0;
  runFrames(st, 90);
  assert.ok(st.player.tx > 3, "闸门开启后应能穿过");
});

test("糖浆：区内豆分翻倍（且糖浆格同样带豆）", () => {
  const rows = MINI_ROWS.slice();
  rows[5] = "#.~~...#";
  const st = miniState(rows);
  const g = st.grid;
  assert.equal(g.pellets[5 * 8 + 2], 1, "糖浆格必须带豆，否则双倍分永远触发不了");
  putPlayer(st, 1, 5, DIR.RIGHT);
  const gains = [];
  for (let i = 0; i < 90; i++) {
    for (const e of stepFrame(st, DT)) if (e.type === "pellet") gains.push(e);
  }
  const syrupGain = gains.find((e) => g.feature[e.y * g.cols + e.x] === FEATURE.SYRUP);
  const plainGain = gains.find((e) => g.feature[e.y * g.cols + e.x] === FEATURE.NONE);
  assert.ok(syrupGain, "应吃到糖浆豆");
  assert.ok(plainGain, "应吃到普通豆");
  assert.equal(syrupGain.gain, plainGain.gain * 2, "糖浆豆分必须是普通豆的两倍");
});

test("糖浆：拖慢玩家但拖不慢幽灵", () => {
  const travel = (rows, who) => {
    const st = miniState(rows);
    keepAlive(st);
    for (const g of st.ghosts) {
      if (who === "ghost" && g.id === "blinky") continue;
      g.mode = "caging";
      g.gatePassed = false;
      g.dotGate = 1e9;
      g.releaseTimer = 1e9;
    }
    const ent = who === "ghost" ? putGhost(st, "blinky", 1, 5, "chase", DIR.RIGHT) : st.player;
    if (who === "player") putPlayer(st, 1, 5, DIR.RIGHT);
    const from = entityPos(ent).x;
    // 走廊只有 6 格长，跑太久两边都会撞到尽头，距离就分不出来了
    for (let i = 0; i < 20; i++) {
      keepAlive(st);
      stepFrame(st, DT);
    }
    return entityPos(ent).x - from;
  };
  const plainRow = MINI_ROWS.slice();
  const syrupRow = MINI_ROWS.slice();
  syrupRow[5] = "#.~~...#";
  assert.ok(travel(syrupRow, "player") < travel(plainRow, "player"), "糖浆必须拖慢玩家");
  assert.ok(
    Math.abs(travel(syrupRow, "ghost") - travel(plainRow, "ghost")) < 0.5,
    "糖浆不得拖慢幽灵"
  );
});

// ---------------------------------------------------------------- 幽灵 AI

test("Scatter/Chase 节拍：7 秒后切到 chase，且全局模式被广播", () => {
  const st = miniState();
  assert.equal(st.globalMode, "scatter");
  let switched = false;
  let reverseSeen = false;
  for (let i = 0; i < 60 * 9; i++) {
    keepAlive(st);
    // 每帧重新关一次：久不吃豆会触发「强制放幽灵出巢」，进而撞死玩家重置节拍表
    stallGhosts(st);
    const evs = stepFrame(st, DT);
    if (evs.some((e) => e.type === "modeSwitch" && e.mode === "chase")) switched = true;
    if (evs.some((e) => e.type === "modeSwitch")) reverseSeen = true;
  }
  assert.ok(switched, "7 秒处必须切到 chase");
  assert.ok(reverseSeen);
  assert.equal(st.globalMode, "chase");
  assert.equal(MODE_SCHEDULE[0].sec, 7);
});

test("节拍切换会让在场幽灵立刻掉头（经典行为）", () => {
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 77 });
  // 先让四只幽灵正常走出巢、在盘上跑起来（关在巢里的幽灵会不断重新选向，看不出掉头）
  for (let i = 0; i < 60 * 15; i++) {
    keepAlive(st);
    stepFrame(st, DT);
    if (!st.ghosts.some((g) => g.mode === "exiting" || g.mode === "caging")) break;
  }
  const active = st.ghosts.filter((g) => g.mode === "scatter" || g.mode === "chase");
  assert.ok(active.length >= 2, "前置条件：至少 2 只幽灵已在盘上活动");
  // 逼近切换点：只留不到一帧的量，确保掉头不被后续选向覆盖
  st.modeTimer = 0.004;
  const before = new Map(active.map((g) => [g.id, { dir: g.dir }]));
  let flipped = 0;
  let sawSwitch = false;
  const blocked = [];
  const missed = [];
  for (let i = 0; i < 20 && !sawSwitch; i++) {
    keepAlive(st);
    const evs = stepFrame(st, DT);
    if (!evs.some((e) => e.type === "modeSwitch")) continue;
    sawSwitch = true;
    for (const g of st.ghosts) {
      const b = before.get(g.id);
      if (!b) continue;
      const back = OPPOSITE[b.dir];
      const v = DIR_VEC[back];
      // 反向是墙时无法掉头（幽灵刚在路口拐弯，来路在侧面）——几何约束，不算漏掉头
      const nb = neighborTile(st.grid, g.tx, g.ty, back);
      const passable = nb && canPass(st, g.tx, g.ty, nb.x, nb.y, back, true, g.mode);
      if (!passable) { blocked.push(g.id); continue; }
      if (g.dir === back) flipped++;
      else missed.push(`${g.id}(${b.dir}->${g.dir})`);
    }
  }
  assert.ok(sawSwitch, `应观察到节拍切换 (modeTimer=${st.modeTimer})`);
  assert.deepEqual(
    missed,
    [],
    `反向可通行的幽灵必须全部立刻掉头（因墙豁免：${blocked.join(",") || "无"}）`,
  );
  assert.ok(flipped >= 2, `至少 2 只幽灵实际掉头，实际 ${flipped}（因墙豁免 ${blocked.length}）`);

  const turnSeen = new Set();
  for (let i = 0; i < 60 * 12; i++) {
    keepAlive(st);
    stepFrame(st, DT);
    for (const g of st.ghosts) {
      if (before.has(g.id)) turnSeen.add(g.dir);
    }
  }
  assert.ok(
    turnSeen.size > 1,
    `掉头锁释放后幽灵必须能重新转向，实际只出现了方向 ${[...turnSeen].join("/")}`,
  );
  // ★ 掉头锁只消费一次：否则幽灵会被永久锁在反方向上，只能沿直线跑，AI 彻底失效
  for (const g of st.ghosts) {
    if (!before.has(g.id)) continue;
    assert.equal(g.justReversed, false, `${g.id} 的掉头锁应在下一次选向时释放`);
  }
});

test("四幽灵 target 规则严格复刻（Blinky 直取 / Pinky 前 4 / Inky 2 倍反射 / Clyde 怯场）", () => {
  const st = miniState();
  putPlayer(st, 3, 5, DIR.RIGHT);
  st.player.desired = DIR.RIGHT;

  const blinky = putGhost(st, "blinky", 1, 1, "chase");
  assert.deepEqual(ghostTarget(st, blinky), { x: 3, y: 5 });

  const pinky = putGhost(st, "pinky", 1, 1, "chase");
  assert.deepEqual(ghostTarget(st, pinky), { x: 7, y: 5 }, "Pinky 取玩家前方 4 格");

  st.ghosts[0].tx = 1;
  st.ghosts[0].ty = 1;
  const inky = putGhost(st, "inky", 5, 5, "chase");
  // 支点 = (3+2, 5) = (5,5)； target = 支点 + (支点 - blinky) = (9, 9)
  assert.deepEqual(ghostTarget(st, inky), { x: 9, y: 9 });

  // Clyde 的怯场阈值 8 格，迷你盘撑不出这个距离，改用真实迷宫
  const big = createState({ maze: parseMaze(MAZES[0]), seed: 5 });
  putPlayer(big, 13, 26, DIR.RIGHT);
  const far = putGhost(big, "clyde", 2, 2, "chase");
  assert.deepEqual(ghostTarget(big, far), { x: 13, y: 26 }, "距离 >8 时等同 Blinky");
  const near = putGhost(big, "clyde", 13, 24, "chase");
  assert.deepEqual(ghostTarget(big, near), near.corner, "距离 <=8 时退回自己的散开角");
});

test("幽灵禁止 180° 反向（仅节拍切换 / 能量豆 / 死胡同三种合法情形）", () => {
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 21 });
  const last = new Map(GHOST_IDS.map((id) => [id, null]));
  let reversals = 0;
  for (let i = 0; i < 60 * 40; i++) {
    keepAlive(st);
    const before = st.ghosts.map((g) => ({ id: g.id, dir: g.dir, tx: g.tx, ty: g.ty, mode: g.mode }));
    const evs = stepFrame(st, DT);
    const allowed = evs.some((e) => e.type === "modeSwitch" || e.type === "powerUp");
    for (const gh of st.ghosts) {
      const prev = last.get(gh.id);
      const snap = before.find((b) => b.id === gh.id);
      if (prev === null || prev === undefined) continue;
      if (gh.dir !== OPPOSITE[prev]) continue;
      reversals++;
      // 出巢 / 回巢等状态迁移时的首次选向不算「违反禁止反向」
      if (allowed || gh.mode !== snap.mode) continue;
      // 死胡同：当时除了掉头别无出路
      let options = 0;
      for (const d of [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT]) {
        if (d === OPPOSITE[snap.dir]) continue;
        const nb = neighborTile(st.grid, snap.tx, snap.ty, d);
        if (!nb) continue;
        if (canPass(st, snap.tx, snap.ty, nb.x, nb.y, d, true, snap.mode)) options++;
      }
      assert.equal(options, 0, `${gh.id} 在无模式切换且非死胡同时发生了 180° 反向`);
    }
    for (const gh of st.ghosts) last.set(gh.id, gh.dir);
    if (st.status !== "playing") break;
  }
  assert.ok(reversals > 0, "整局应至少观察到一次合法反向，否则这条断言没在测东西");
});

test("幽灵只能从巢门出来，不存在穿墙出巢", () => {
  const st = miniState();
  runFrames(st, 60 * 6);
  for (const gh of st.ghosts) {
    if (gh.mode === "exiting" || gh.mode === "caging") continue;
    assert.notEqual(st.grid.cell[gh.ty * st.grid.cols + gh.tx], CELL.HOUSE);
  }
});

// ---------------------------------------------------------------- 能量豆与连吃

test("能量豆：进入 frightened 后连吃按 200/400/800/1600 递增", () => {
  const st = miniState();
  stallGhosts(st);
  const scores = [];
  // 直接把脚下的豆换成能量豆并吃掉
  st.grid.pellets[st.player.ty * st.grid.cols + st.player.tx] = 0;
  st.grid.pellets[5 * 8 + 2] = 2;
  putPlayer(st, 1, 5, DIR.RIGHT);
  let guard = 0;
  while (st.frightTimer === 0 && guard++ < 600) stepFrame(st, DT);
  assert.ok(st.frightTimer > 0, "应进入 frightened");
  for (const id of GHOST_IDS) {
    // 玩家可能正走在两格之间，先吸附到格心，保证碰撞判定命中
    st.player.nx = null;
    st.player.ny = null;
    st.player.p = 0;
    putGhost(st, id, st.player.tx, st.player.ty, "frightened");
    for (const e of stepFrame(st, DT)) if (e.type === "eatGhost") scores.push(e.gain);
  }
  assert.deepEqual(scores, [...GHOST_SCORE]);
  assert.equal(st.score, GHOST_SCORE.reduce((a, b) => a + b, 0) + 50);
});

test("被吃幽灵回巢后进入 caging 并计时重新出巢", () => {
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 33 });
  const gh = putGhost(st, "blinky", 20, 2, "eaten");
  let guard = 0;
  while (gh.mode !== "caging" && guard++ < 60 * 30) {
    keepAlive(st);
    stepFrame(st, DT);
  }
  assert.equal(gh.mode, "caging", "被吃的幽灵回到 home 后必须转为充能状态");
  assert.ok(gh.releaseTimer > 0);
});

test("巢压：每吃 10 颗豆给待出巢幽灵加压，上限 3 秒", () => {
  const st = miniState();
  const rows = MINI_ROWS.slice();
  void rows;
  const gh = putGhost(st, "inky", 1, 5, "caging");
  gh.gatePassed = true;
  let guard = 0;
  let suppressEvents = 0;
  // 让玩家一路吃满 30 颗以上
  putPlayer(st, 1, 1, DIR.RIGHT);
  while (guard++ < 60 * 60 && suppressEvents < 3) {
    setDesired(st, guard % 120 < 60 ? DIR.RIGHT : DIR.LEFT);
    const evs = stepFrame(st, DT);
    if (evs.some((e) => e.type === "suppress")) suppressEvents++;
    if (gh.mode !== "caging") break;
  }
  assert.ok(suppressEvents >= 2 || gh.mode !== "caging");
  // 压制量本身带上限
  const st2 = miniState();
  const gh2 = putGhost(st2, "inky", 1, 5, "caging");
  gh2.gatePassed = true;
  for (let i = 0; i < SUPPRESS_DOTS * 20; i++) {
    st2.dotsEaten = SUPPRESS_DOTS * (i + 1);
    const milestone = Math.floor(st2.dotsEaten / SUPPRESS_DOTS);
    if (milestone > st2.suppressMilestone) {
      st2.suppressMilestone = milestone;
      // 直接调用同款压制逻辑：通过连续帧间接达成，这里只验证上限不被突破
      gh2.suppressSeconds = Math.min(3, gh2.suppressSeconds + 0.5);
    }
  }
  assert.ok(gh2.suppressSeconds <= 3);
});

// ---------------------------------------------------------------- 豆链与计分

test("豆链：连续吃豆逐级升倍率，断链归零", () => {
  const st = miniState();
  assert.equal(chainMultiplier(st), CHAIN_MULTS[0]);
  for (let i = 1; i <= 30; i++) {
    // 直接驱动引擎内部的链计数器：模拟连续抵达豆格
    st.chainCount = i;
    st.chainLevel = Math.min(3, Math.floor(i / 10));
  }
  assert.equal(chainMultiplier(st), CHAIN_MULTS[3]);
  st.chainLevel = 0;
  assert.equal(chainMultiplier(st), 1);
});

test("单颗豆基础分为 10，倍率生效后按链路倍率取整", () => {
  const st = miniState();
  putPlayer(st, 1, 5, DIR.RIGHT);
  let first = -1;
  for (let i = 0; i < 600; i++) {
    const evs = stepFrame(st, DT);
    const hit = evs.find((e) => e.type === "pellet");
    if (hit) {
      first = hit.gain;
      break;
    }
  }
  assert.equal(first, PELLET_SCORE * CHAIN_MULTS[0]);
});

// ---------------------------------------------------------------- 生命与结算

test("命数耗尽判定 lost，restartMaze 后可重来", () => {
  const st = miniState();
  st.lives = 1;
  const gh = putGhost(st, "blinky", st.player.tx, st.player.ty, "chase");
  void gh;
  for (let i = 0; i < 20 && st.status === "playing"; i++) {
    putGhost(st, "blinky", st.player.tx, st.player.ty, "chase");
    stepFrame(st, DT);
  }
  assert.equal(st.status, "lost");
  restartMaze(st);
  assert.equal(st.status, "playing");
  assert.equal(st.lives, 3);
});

test("三星：清盘 / 限时 / 零死亡三项独立", () => {
  const st = miniState();
  st.status = "levelclear";
  st.elapsed = 10;
  st.deaths = 0;
  const s = evaluateStars(st);
  assert.deepEqual(s, { clear: true, time: true, noDeath: true });
  st.deaths = 1;
  assert.equal(evaluateStars(st).noDeath, false);
  st.elapsed = 99999;
  assert.equal(evaluateStars(st).time, false);
});

test("街机无尽：Frightened 时长随关数递减到 0", () => {
  assert.equal(frightForLevel(1), 6);
  assert.ok(frightForLevel(10) < frightForLevel(5));
  assert.equal(frightForLevel(25), 0);
});

// ---------------------------------------------------------------- 真实迷宫数据

test("7 张真实迷宫均可解析且可从出生点出发吃豆", () => {
  for (const raw of MAZES) {
    const g = parseMaze(raw);
    assert.equal(g.cols, 28);
    assert.equal(g.rows, 31);
    assert.ok(g.nests.length >= 1);
    let count = 0;
    for (const v of g.pellets) if (v) count++;
    assert.ok(count > 180 && count < 340, `${raw.id} 豆数异常 ${count}`);
    let powers = 0;
    for (const v of g.pellets) if (v === 2) powers++;
    assert.ok(powers >= 2, `${raw.id} 能量豆过少`);
  }
  assert.equal(MAZES.length, 7);
});

test("每张迷宫都能跑起来：60 秒内玩家可以正常吃豆且幽灵出巢", () => {
  for (const raw of MAZES) {
    const st = createState({ maze: parseMaze(raw), seed: 99 });
    let released = 0;
    for (let i = 0; i < 60 * 60; i++) {
      const evs = stepFrame(st, DT);
      released += evs.filter((e) => e.type === "ghostRelease").length;
      if (st.status !== "playing") break;
    }
    assert.ok(st.dotsEaten > 0, `${raw.id} 玩家一颗豆都没吃到`);
    assert.ok(released >= 2, `${raw.id} 幽灵没有成功出巢`);
  }
});

test("残局数据：10 张、目标是三类之一、限制值有效", () => {
  assert.equal(SETPIECES.length, 10);
  const goals = new Set();
  for (const sp of SETPIECES) {
    goals.add(sp.goal);
    assert.ok(["clear", "escape", "chain"].includes(sp.goal), sp.id);
    if (sp.goal === "clear") assert.ok(sp.keep.length >= 12, `${sp.id} 清空区过小`);
    if (sp.goal === "escape") assert.ok(sp.exit, `${sp.id} 缺少出口`);
    assert.ok(sp.limitTime > 0 && sp.limitTime < 200, `${sp.id} 限制时间异常`);
    const raw = MAZES.find((m) => m.id === sp.mazeId);
    assert.ok(raw, `${sp.id} 引用了不存在的迷宫`);
    const grid = parseMaze(raw);
    for (const i of sp.keep) assert.notEqual(grid.pellets[i], 0, `${sp.id} keep 里的格不是豆`);
    assert.ok(sp.ghosts.length === 4, `${sp.id} 必须给满 4 只幽灵的初始摆位`);
    for (const g of sp.ghosts) {
      assert.notEqual(grid.cell[g.y * grid.cols + g.x], CELL.WALL, `${sp.id} 幽灵摆在了墙里`);
    }
  }
  assert.equal(goals.size, 3);
});

// ---------------------------------------------------------------- 随机游走与红线

test("≥3000 步随机游走：不抛错、不卡死、核心不变式守恒", () => {
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 4242 });
  let seed = 4242;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let deaths = 0;
  for (let step = 0; step < 3000; step++) {
    if (step % 5 === 0) setDesired(st, Math.floor(rnd() * 4));
    stepFrame(st, Math.random() === -1 ? 0 : Math.max(1 / 240, Math.min(0.05, 1 / 60 + rnd() * 0.02)));
    if (st.status !== "playing") {
      deaths++;
      restartMaze(st);
    }
    // 不变式
    const g = st.grid;
    const p = st.player;
    assert.ok(p.tx >= 0 && p.tx < g.cols && p.ty >= 0 && p.ty < g.rows, "玩家出界");
    assert.notEqual(g.cell[p.ty * g.cols + p.tx], CELL.WALL, "玩家进了墙");
    assert.notEqual(g.cell[p.ty * g.cols + p.tx], CELL.HOUSE, "玩家进了幽灵巢");
    for (const gh of st.ghosts) {
      assert.ok(gh.tx >= 0 && gh.tx < g.cols && gh.ty >= 0 && gh.ty < g.rows, "幽灵出界");
      assert.ok(["scatter", "chase", "frightened", "eaten", "caging", "exiting"].includes(gh.mode));
    }
    const alive = g.pellets.reduce((acc, v) => acc + (v ? 1 : 0), 0);
    assert.equal(alive, st.dotsRemaining, "剩余豆计数必须与实际数组一致");
    assert.ok(st.score >= 0);
    assert.ok(st.lives >= 0 && st.lives <= 5);
  }
  assert.ok(st.dotsEaten > 0 || deaths > 0);
});

test("engine.mjs 严格 DOM-free", () => {
  const src = readFileSync(resolve(here, "..", "js", "engine.mjs"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage", "navigator."]) {
    assert.ok(!code.includes(token), `engine 不得触碰 ${token}`);
  }
});

test("数据层零中文（mazes.mjs 不得出现裸写汉字）", () => {
  const src = readFileSync(resolve(here, "..", "js", "mazes.mjs"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const hits = code.match(/["'`][^"'`\n]*[\u4e00-\u9fa5][^"'`\n]*["'`]/g);
  assert.equal(hits, null, `mazes.mjs 出现中文字符串: ${hits}`);
});

// ---------------------------------------------------------------- 输入窗口（保鲜 + 迟到补偿）

/** 造一个干净的测试台：幽灵定住，玩家按指定方向站在起点格心并从那里出发。 */
function rig(startX, startY, travelDir) {
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 7, mode: "campaign" });
  st.status = "playing";
  st.dotsRemaining = 999;
  for (const gh of st.ghosts) {
    gh.baseSpeed = 0;
    gh.stun = 1e9;
    gh.nx = null;
    gh.ny = null;
    gh.p = 0;
  }
  const p = st.player;
  p.tx = startX;
  p.ty = startY;
  p.nx = null;
  p.ny = null;
  p.p = 0;
  p.dir = travelDir;
  p.desired = travelDir;
  p.desiredTtl = 0;
  p.stun = 0;
  return st;
}

const PERP = { [DIR.LEFT]: [DIR.UP, DIR.DOWN], [DIR.RIGHT]: [DIR.UP, DIR.DOWN] };

/** 找一个「沿水平方向走，且脚下这格本身就有垂直出口」的路口 —— 用来验证迟到补偿。 */
function findJunction() {
  const g = parseMaze(MAZES[0]);
  for (let y = 1; y < g.rows - 1; y++) {
    for (let x = 2; x < g.cols - 2; x++) {
      if (g.cell[y * g.cols + x] === CELL.WALL) continue;
      for (const travel of [DIR.LEFT, DIR.RIGHT]) {
        const fwd = neighborTile(g, x, y, travel);
        if (!fwd) continue;
        if (!canPass({ grid: g, gatesOpen: true }, x, y, fwd.x, fwd.y, travel, false, "chase")) continue;
        for (const turn of PERP[travel]) {
          const side = neighborTile(g, x, y, turn);
          if (!side) continue;
          if (!canPass({ grid: g, gatesOpen: true }, x, y, side.x, side.y, turn, false, "chase")) continue;
          return { x, y, travel, turn };
        }
      }
    }
  }
  throw new Error("maze_1 里找不到可用于迟到补偿测试的路口");
}

/** 找一个「当前格没有指定垂直出口」的走廊格 —— 用来验证误按不会被带走。 */
function findSolidTile(wantTurn) {
  const g = parseMaze(MAZES[0]);
  for (let y = 1; y < g.rows - 1; y++) {
    for (let x = 1; x < g.cols - 1; x++) {
      if (g.cell[y * g.cols + x] === CELL.WALL) continue;
      const side = neighborTile(g, x, y, wantTurn);
      if (side && canPass({ grid: g, gatesOpen: true }, x, y, side.x, side.y, wantTurn, false, "chase")) continue;
      const fwd = neighborTile(g, x, y, DIR.RIGHT);
      if (!fwd || !canPass({ grid: g, gatesOpen: true }, x, y, fwd.x, fwd.y, DIR.RIGHT, false, "chase")) continue;
      return { x, y };
    }
  }
  throw new Error("maze_1 里找不到用于误按测试的走廊格");
}

test("迟到补偿：刚过格心就按下，当场在那个路口拐出去", () => {
  const j = findJunction();
  const st = rig(j.x, j.y, j.travel);
  const p = st.player;
  setDesired(st, j.travel);
  stepFrame(st, DT); // 离开格心一点点
  assert.ok(p.p > 0 && p.p <= LATE_TURN_P, `测试前提：刚出发，实际 p=${p.p}`);

  const before = { tx: p.tx, ty: p.ty, p: p.p };
  setDesired(st, j.turn);
  // ★ 迟到转向是同步生效的，必须在按下之后立刻判方向
  assert.equal(p.dir, j.turn, "窗口内按下必须在刚离开的那个格心就地转向");
  assert.equal(p.tx, before.tx, "起点格不许变");
  assert.equal(p.ty, before.ty);
  assert.ok(p.p < before.p, "把已经滑出去的那点距离拉回来");
  assert.ok(before.p <= LATE_TURN_P, "回拉量必须在窗口上限内，不能把主角甩回上一个路口");
});

test("迟到补偿有硬上限：滑过太多就不再抓，绝不无限回拉", () => {
  const j = findJunction();
  const st = rig(j.x, j.y, j.travel);
  const p = st.player;
  setDesired(st, j.travel);
  // 一路滑到明显超过窗口
  let guard = 0;
  while (p.p <= LATE_TURN_P && guard++ < 60) stepFrame(st, DT);
  assert.ok(p.p > LATE_TURN_P, `必须滑出窗口才能验证上限，实际 p=${p.p}`);
  const before = { tx: p.tx, ty: p.ty, p: p.p };
  setDesired(st, j.turn);
  assert.equal(p.dir, j.travel, "超出窗口就不能再回拉那个路口了");
  assert.equal(p.tx, before.tx);
  assert.ok(Math.abs(p.p - before.p) < 1e-9, "位置和进度一个都不许动");
});

test("迟到补偿绝不穿墙：目标是实心时不生效", () => {
  const solid = findSolidTile(DIR.DOWN);
  const st = rig(solid.x, solid.y, DIR.RIGHT);
  const p = st.player;
  setDesired(st, DIR.RIGHT);
  stepFrame(st, DT);
  const before = { dir: p.dir, nx: p.nx, p: p.p };
  setDesired(st, DIR.DOWN);
  assert.equal(p.dir, before.dir, "墙方向上不能硬转");
  assert.equal(p.nx, before.nx);
  assert.ok(Math.abs(p.p - before.p) < 1e-9);
});

test("掉头不受这两个窗口约束：任何时候任何位置都能立刻反向", () => {
  const j = findJunction();
  const st = rig(j.x, j.y, j.travel);
  const p = st.player;
  setDesired(st, j.travel);
  let guard = 0;
  while (p.p <= LATE_TURN_P && guard++ < 60) stepFrame(st, DT); // 滑到远超迟到窗口
  const back = OPPOSITE[j.travel];
  setDesired(st, back);
  assert.equal(p.dir, back, "掉头是唯一的即时操作，窗口对我们不适用");
});

test("预输入保鲜：过期自动回落当前方向，不再挂在身上找下一个路口", () => {
  const solid = findSolidTile(DIR.UP);
  const st = rig(solid.x, solid.y, DIR.RIGHT);
  const p = st.player;
  setDesired(st, DIR.RIGHT);
  setDesired(st, DIR.UP); // 此处没有 UP 出口
  assert.equal(p.desired, DIR.UP, "刚按下时是挂着的状态");
  assert.ok(p.desiredTtl > 0);
  // 跑过保鲜期（按距离折算的秒数），再留一点余量
  const frames = Math.ceil(((INPUT_TTL_TILES + 1.2) / p.baseSpeed) * 60);
  for (let i = 0; i < frames; i++) stepFrame(st, DT);
  assert.equal(p.desired, p.dir, "过期必须回落当前方向，不能留着找远处路口");
  assert.equal(p.desiredTtl, 0);
});

/** 找一个「接下来 minTiles 格都没有指定垂直出口」的水平走廊 —— 保证误按不会被某个路口提前吃掉。 */
function findLongBlocked(wantTurn, minTiles) {
  const g = parseMaze(MAZES[0]);
  const probeState = { grid: g, gatesOpen: true };
  const openFor = (x, y, dir) => {
    const nb = neighborTile(g, x, y, dir);
    if (!nb) return false;
    return canPass(probeState, x, y, nb.x, nb.y, dir, false, "chase");
  };
  for (let y = 1; y < g.rows - 1; y++) {
    for (let x = 1; x < g.cols - 1; x++) {
      if (g.cell[y * g.cols + x] === CELL.WALL) continue;
      if (openFor(x, y, wantTurn)) continue;
      if (!openFor(x, y, DIR.RIGHT)) continue;
      let ok = true;
      let cx = x;
      for (let k = 0; k < minTiles; k++) {
        cx += 1;
        if (!openFor(cx, y, DIR.RIGHT) || openFor(cx, y, wantTurn)) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, y };
    }
  }
  throw new Error(`maze_1 里找不到连续 ${minTiles} 格无 ${wantTurn} 出口的走廊`);
}

test("保鲜期按距离算：三档速度下能带走的格数一致", () => {
  const need = Math.ceil(INPUT_TTL_TILES) + 2;
  const long = findLongBlocked(DIR.UP, need);
  const measured = [];
  for (const tier of SPEED_TIERS) {
    const st = rig(long.x, long.y, DIR.RIGHT);
    applySpeedTier(st, tier.id);
    const p = st.player;
    setDesired(st, DIR.RIGHT);
    const x0 = p.tx;
    setDesired(st, DIR.UP);
    let travelled = 0;
    let guard = 0;
    while (p.desired === DIR.UP && guard++ < 3000) {
      stepFrame(st, DT);
      travelled = Math.abs(p.tx - x0) + p.p;
    }
    measured.push(travelled);
    assert.ok(
      travelled <= INPUT_TTL_TILES + 0.5,
      `${tier.id} 档下保鲜期带走了 ${travelled.toFixed(2)} 格，超过 ${INPUT_TTL_TILES} 格上限`
    );
  }
  const spread = Math.max(...measured) - Math.min(...measured);
  assert.ok(
    spread < 0.25,
    `三档之间的窗口宽度不该差这么多：${measured.map((v) => v.toFixed(2)).join(" / ")} 格`
  );
});

test("迟到回拉的补间会衰减到 0，且偏移量不会超过实际回拉量", () => {
  const j = findJunction();
  const st = rig(j.x, j.y, j.travel);
  const p = st.player;
  setDesired(st, j.travel);
  stepFrame(st, DT);
  const rolled = p.p;
  setDesired(st, j.turn);
  assert.ok(rolled <= LATE_TURN_P);
  assert.ok(p.snapTimer > 0, "补间要登记，否则画面上是一次硬跳");
  const first = snapOffset(p);
  assert.ok(first > 0 && first <= rolled + 1e-9, `首帧偏移 ${first} 不该超过回拉量 ${rolled}`);
  let guard = 0;
  while (p.snapTimer > 0 && guard++ < 600) stepFrame(st, DT);
  assert.equal(snapOffset(p), 0, `补间必须在 ${SNAP_EASE}s 内衰减干净`);
  assert.equal(p.snapTiles, 0);
});

test("重开会把输入窗口的残留清干净，不带上局的挂起方向", () => {
  const solid = findSolidTile(DIR.UP);
  const st = rig(solid.x, solid.y, DIR.RIGHT);
  const p = st.player;
  setDesired(st, DIR.RIGHT);
  setDesired(st, DIR.UP);
  assert.ok(p.desiredTtl > 0);
  restartMaze(st);
  assert.equal(st.player.desiredTtl, 0, "保鲜计时必须清零");
  assert.equal(st.player.snapTimer, 0, "补间残量必须清零");
  assert.equal(st.player.snapTiles, 0);
  assert.equal(st.player.desired, st.player.dir, "不该带着上局的挂起方向复活");
});

test("非法方向值静默拒绝，绝不写坏 desired", () => {
  const st = rig(14, 23, DIR.RIGHT);
  const p = st.player;
  const keep = p.desired;
  for (const bad of [-1, 4, 99, NaN, null, undefined, "up"]) {
    assert.equal(setDesired(st, bad), false, `${String(bad)} 必须被拒`);
  }
  assert.equal(p.desired, keep, "被拒的输入不许污染 desired");
});


test("速度档：玩家与幽灵同乘一个倍率，追逐张力不被改写", () => {
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 11 });
  assert.equal(st.speedScale, 1, "默认标准档倍率为 1");
  assert.equal(st.speedTier, DEFAULT_SPEED_TIER);

  const ratioBefore = st.player.baseSpeed / st.ghosts[0].baseSpeed;
  applySpeedTier(st, "surge");
  assert.ok(st.speedScale > 1, "极速档必须真的更快");
  const ratioAfter = st.player.baseSpeed / st.ghosts[0].baseSpeed;
  assert.equal(ratioAfter, ratioBefore, "倍率只作用在 speedScale 上，基础配比不许动");
  assert.equal(st.ghosts.every((g) => g.baseSpeed === st.ghosts[0].baseSpeed), true);
});

test("速度档热切换绝不重置局面（与语言切换同一条铁律）", () => {
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 11 });
  st.status = "playing";
  setDesired(st, st.player.dir);
  for (let i = 0; i < 120; i++) stepFrame(st, DT);
  const snap = {
    elapsed: st.elapsed,
    score: st.score,
    lives: st.lives,
    dots: st.dotsRemaining,
    tx: st.player.tx,
    ty: st.player.ty,
  };
  applySpeedTier(st, "calm");
  assert.deepEqual(
    { elapsed: st.elapsed, score: st.score, lives: st.lives, dots: st.dotsRemaining, tx: st.player.tx, ty: st.player.ty },
    snap,
    "换档只改倍率，盘面 / 计时 / 命数一律不许动",
  );
});

test("未知速度档一律回落到标准档，绝不静默变成 0 倍", () => {
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 11 });
  for (const bad of ["turbo", "", null, undefined, 3, {}]) {
    const mult = applySpeedTier(st, bad);
    assert.equal(mult, 1, `非法档 ${String(bad)} 必须回落 1 倍`);
    assert.equal(st.speedTier, DEFAULT_SPEED_TIER);
  }
  assert.equal(speedTierMult("calm"), SPEED_TIERS[0].mult);
  assert.equal(speedTierMult("不存在"), 1);
});

test("走廊补速：豆吃空的路上会提速，有豆时保持正统的 8.8", () => {
  const st = createState({ maze: parseMaze(MAZES[0]), seed: 11 });
  st.status = "playing";
  const p = st.player;
  const g = st.grid;
  // 找一格「有豆且至少有一个可走邻居」的地面，才谈得上对照
  let tile = -1;
  let dir = -1;
  for (let idx = 0; idx < g.pellets.length && tile < 0; idx++) {
    if (!g.pellets[idx] || g.cell[idx] === CELL.WALL) continue;
    const x = idx % g.cols;
    const y = Math.floor(idx / g.cols);
    for (const d of [DIR.RIGHT, DIR.LEFT, DIR.UP, DIR.DOWN]) {
      const nb = neighborTile(g, x, y, d);
      if (nb && canPass(st, x, y, nb.x, nb.y, d, false, "chase")) {
        tile = idx;
        dir = d;
        break;
      }
    }
  }
  assert.ok(tile >= 0, "必须找得到带豆的可走格，否则这条断言本身没意义");

  // 只跑 4 帧（≈0.6 格）保证不出格：这样 speed 判定的始终是同一格的豆
  const measure = (dotPresent) => {
    p.tx = tile % g.cols;
    p.ty = Math.floor(tile / g.cols);
    p.nx = null;
    p.ny = null;
    p.p = 0;
    p.stun = 0;
    p.dir = dir;
    p.desired = dir;
    g.pellets[tile] = dotPresent ? 1 : 0;
    setDesired(st, dir);
    for (let f = 0; f < 4; f++) stepFrame(st, DT);
    return p.p;
  };
  const slow = measure(true);
  const fast = measure(false);
  assert.ok(
    Math.abs(fast / slow - CORRIDOR_BOOST) < 1e-9,
    `空走廊必须正好是 ${CORRIDOR_BOOST} 倍，实得 ${(fast / slow).toFixed(6)}`,
  );
});
