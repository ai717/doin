// engine.test.mjs —— 规则层验收：手作巷可建、状态机任意操作序列不崩、经典手感（贴角预输入 / 原地掉头 / 暗巷跨界）、
// 一珠吞多鬼的 200→400→800→1600 与影列倍率、灯芯与提灯账、更漏节拍、破晓冲刺续时、种子可复现。
//
// 用法（在项目根跑）：
//   node --test games/lantern-maze/tests/engine.test.mjs
//   npm run test:lantern-maze        # 四套一起跑
// 坑：本文件绝不碰 DOM / localStorage，只 import engine / levels / bot（三者同为 DOM-free 逻辑层）。
//     两条最容易被断言写错的引擎口径：
//     1) 光尘只在「踏上新一格」时结算，摆在玩家脚下不算吃 → 测试用 placeAhead 把目标塞到正前方；
//     2) ready（上灯/重生倒计时）阶段 stepOnce 直接返回，节拍与碰撞都不推进 → 用 launch() 跳过。

import test from "node:test";
import assert from "node:assert/strict";

import {
  createState,
  stepFrame,
  intent,
  drainEvents,
  isTerminal,
  addTime,
  loseTime,
  parseLayout,
  buildField,
  charAt,
  isWalkableTile,
  ghostStateKey,
  entPos,
  dirIndex,
  reverseDir,
  DOT,
  PEARL,
  SPAWN,
  WALL,
  DIRS,
  NONE,
  WICK,
  DASH,
  SPEED,
  mulberry32,
} from "../js/engine.mjs";
import { LAYOUTS, LEVELS, levelById, rowsForLevel, TIME_POOL, ARENA_LAYOUT } from "../js/levels.mjs";
import { botChooseDir } from "../js/bot.mjs";
import { GHOST_VALUES, EXTRA_LIFE_AT } from "../js/score.mjs";

const TICK = 1000 / 60;
const ONE_TILE_MS = 160; // 7.6 瓦/秒 → 一格约 132ms，留点余量
const CFG = { startLives: 3, frightMs: 6000, phases: [[9000, "chase"], [15000, "scatter"]] };

function make(rows = LAYOUTS.alley, opts = {}) {
  return createState({ rows, cfg: { ...CFG, ...(opts.cfg ?? {}) }, seed: opts.seed ?? 7, mode: opts.mode ?? "campaign" });
}

function run(state, ms, tick = TICK) {
  for (let t = 0; t < ms; t += tick) stepFrame(state, tick);
  return state;
}

/** 跳过「上灯」倒计时：引擎在 ready 阶段不推进任何规则，测试想直接跑中局时用这个 */
function launch(state) {
  state.status = "running";
  state.readyMs = 0;
  return state;
}

/** 定住玩家与影魅，只留下被考察的那一条规则在跑 */
function freeze(state, { ghosts = true, player = true } = {}) {
  if (player) {
    state.player.dirIdx = NONE;
    state.player.wantIdx = NONE;
    state.player.prog = 0;
    state.player.stunMs = 0;
  }
  if (ghosts) {
    for (const g of state.ghosts) {
      g.stunMs = 9e6;
      g.dartLeft = 0;
      g.dartWindMs = 0;
    }
  }
  return state;
}

/** 把某张纸片塞到玩家正前方那格，并让玩家朝它走（光尘只在踏上新格时结算） */
function placeAhead(state, ch) {
  const L = state.layout;
  const p = state.player;
  const order = [p.dirIdx === NONE ? 3 : p.dirIdx, 1, 2, 3, 0];
  for (const d of order) {
    const nx = p.x + DIRS[d].x;
    const ny = p.y + DIRS[d].y;
    if (!isWalkableTile(charAt(L, nx, ny))) continue;
    setTile(state, nx, ny, ch);
    p.dirIdx = d;
    p.wantIdx = NONE;
    p.prog = 0;
    return { x: nx, y: ny, dir: d };
  }
  return null;
}

function setTile(state, x, y, ch) {
  const L = state.layout;
  const k = y * L.width + x;
  const had = state.dotGrid[k] ? DOT : state.pearlGrid[k] ? PEARL : null;
  if (had === DOT) state.dotLeft -= 1;
  else if (had === PEARL) state.pearlLeft -= 1;
  L.rows[y][x] = ch;
  state.dotGrid[k] = ch === DOT ? 1 : 0;
  state.pearlGrid[k] = ch === PEARL ? 2 : 0;
  if (ch === DOT) state.dotLeft += 1;
  else if (ch === PEARL) state.pearlLeft += 1;
}

/** 影魅在 house / exiting / eyes 三态合法地踩在匣壁与闸门上，通行口径与引擎一致 */
function entKind(state, ent) {
  if (ent.kind === "player") return "player";
  if (ent.st === "eyes" || ent.st === "house" || ent.st === "exiting") return "eye";
  return "ghost";
}

function assertInvariants(state, where) {
  const L = state.layout;
  assert.ok(state.score >= 0, `${where}: 分数不为负`);
  assert.ok(state.dotLeft >= 0 && state.pearlLeft >= 0, `${where}: 剩余光尘不为负`);
  assert.ok(state.dotLeft + state.pearlLeft <= state.dotTotal + L.pearlTiles.length, `${where}: 剩余量不超初始`);
  assert.ok(state.wick >= 0 && state.wick <= WICK.max, `${where}: 灯芯在 0..${WICK.max} 内`);
  assert.ok(state.lives >= 0, `${where}: 余灯不为负`);
  assert.ok(["ready", "running", "paused", "dying", "cleared", "lost", "won"].includes(state.status), `${where}: 状态合法`);
  for (const ent of [state.player, ...state.ghosts]) {
    const ch = charAt(L, ent.x, ent.y);
    assert.ok(isWalkableTile(ch, entKind(state, ent)), `${where}: 实体落在可通行格上 (${ent.name ?? "灯灯"} x=${ent.x},y=${ent.y},ch=${ch},st=${ent.st})`);
    assert.ok(ent.prog >= 0 && ent.prog <= 1, `${where}: 行程在 0..1`);
    assert.ok(Number.isFinite(entPos(state, ent).x), `${where}: 坐标不 NaN`);
  }
}

test("手作巷库：每张图都能建局，且带出生点与影匣", () => {
  for (const name of [...Object.keys(LAYOUTS), ...TIME_POOL, ARENA_LAYOUT]) {
    const rows = LAYOUTS[name];
    assert.ok(rows, `缺图集 ${name}`);
    const state = make(rows);
    assert.ok(state, `${name} 建局失败`);
    assert.ok(state.layout.spawn, `${name} 没有出生点`);
    assert.ok(state.layout.houses.length >= 1, `${name} 没有影匣`);
    assert.ok(state.dotLeft > 0, `${name} 没有光尘`);
    assert.equal(state.dotTotal, state.dotLeft, `${name}: dotTotal 口径`);
  }
});

test("缺出生点或缺影匣的纸样直接拒绝建局（返回 null 而非崩）", () => {
  assert.equal(createState({ rows: ["###", "#.#", "###"], cfg: CFG }), null);
  assert.equal(createState({ rows: null, cfg: CFG }), null);
  assert.equal(createState({ rows: [], cfg: CFG }), null);
});

test("每一更都能按自己的 cfg 建局", () => {
  for (const lvl of LEVELS) {
    const state = createState({ rows: rowsForLevel(lvl.id), cfg: lvl, seed: 11, mode: "campaign" });
    assert.ok(state, `第 ${lvl.id} 更建局失败`);
    assert.equal(state.ghosts.length, lvl.roster.length, `第 ${lvl.id} 更影魅数`);
    assert.ok(state.cfg.parMs > 0, `第 ${lvl.id} 更缺标准线，三星无法评级`);
    if (lvl.pearlCount) {
      assert.ok(state.pearlLeft <= lvl.pearlCount, `第 ${lvl.id} 更日曜珠未被 cfg 裁到 ${lvl.pearlCount}`);
    }
  }
});

test("同种子同图完全可复现（注入式 PRNG）", () => {
  const a = make(LAYOUTS.rings, { seed: 2026 });
  const b = make(LAYOUTS.rings, { seed: 2026 });
  assert.deepEqual(b.ghosts.map((g) => g.bob), a.ghosts.map((g) => g.bob));
  for (let i = 0; i < 600; i += 1) {
    stepFrame(a, TICK);
    stepFrame(b, TICK);
  }
  assert.equal(b.score, a.score);
  assert.equal(b.dotLeft, a.dotLeft);
  assert.equal(Math.round(b.clock), Math.round(a.clock));
  assert.deepEqual(b.ghosts.map((g) => [g.x, g.y, g.st]), a.ghosts.map((g) => [g.x, g.y, g.st]));
});

test("mulberry32 落在 [0,1) 且同种子同序列", () => {
  const r1 = mulberry32(9);
  const r2 = mulberry32(9);
  for (let i = 0; i < 500; i += 1) {
    const v = r1();
    assert.ok(v >= 0 && v < 1, `第 ${i} 个随机数越界: ${v}`);
    assert.equal(r2(), v);
  }
});

test("随机游走 3000 步：任意合法意图序列下不抛错、不变式不破", () => {
  const rnd = mulberry32(4242);
  const state = make(LAYOUTS.lanes, { cfg: { startLives: 99 } });
  let prevScore = 0;
  let steps = 0;
  for (let i = 0; i < 3000; i += 1) {
    steps += 1;
    const roll = rnd();
    if (roll < 0.55) intent(state, { type: "turn", dir: Math.floor(rnd() * 4) });
    else if (roll < 0.65) intent(state, { type: "dash" });
    else if (roll < 0.7) intent(state, { type: "nonsense", junk: 1 });
    else if (roll < 0.74) {
      intent(state, { type: "pause" });
      intent(state, { type: "resume" });
    }
    stepFrame(state, rnd() < 0.02 ? 180 : TICK);
    assert.ok(state.score >= prevScore, `第 ${i} 步分数倒退`);
    prevScore = state.score;
    assertInvariants(state, `第 ${i} 步`);
    if (isTerminal(state)) break;
  }
  assert.ok(steps >= 1000, `随机游走步数须 ≥1000，实际 ${steps}`);
});

test("三种非主线模式各跑 40 秒不崩", () => {
  for (const [mode, rows] of [
    ["timed", LAYOUTS[TIME_POOL[0]]],
    ["survival", LAYOUTS[ARENA_LAYOUT]],
    ["custom", LAYOUTS.square],
  ]) {
    const cfg = {
      ...CFG,
      startLives: 9,
      timed: mode === "timed" ? 120000 : 0,
      timedMax: 180000,
      respawnDots: mode === "survival",
      roundMs: mode === "survival" ? 4000 : 0,
      maxGhosts: 8,
    };
    const state = createState({ rows, cfg, seed: 31, mode });
    assert.ok(state, `${mode} 建局失败`);
    for (let i = 0; i < 2400; i += 1) {
      if (i % 40 === 0) intent(state, { type: "turn", dir: (i / 40) % 4 });
      stepFrame(state, TICK);
      assertInvariants(state, `${mode} 第 ${i} 帧`);
      if (mode === "survival" && state.round > 3) break;
    }
    if (mode === "survival") assert.ok(state.ghosts.length >= 4, "百鬼夜巷应随轮次增援");
  }
});

test("暗巷跨界：巷腰行可以从一头穿到另一头", () => {
  const state = make(LAYOUTS.rings);
  const L = state.layout;
  assert.ok(L.wrapRows.length >= 1, "rings 图应有暗巷行");
  launch(state);
  freeze(state);
  const y = L.wrapRows[0];
  const p = state.player;
  p.x = L.width - 1;
  p.y = y;
  p.prog = 0;
  p.dirIdx = 3;
  run(state, ONE_TILE_MS * 2);
  assert.ok(p.x < L.width - 1, `右端应穿到左端，实际 x=${p.x}`);
  assert.equal(p.y, y, "跨界只换列不换行");

  const solid = L.rows.findIndex(
    (row, rowY) => !L.wrapRows.includes(rowY) && isWalkableTile(row[L.width - 2]) && !isWalkableTile(row[L.width - 1])
  );
  assert.ok(solid > 0, "该图找不到尽头是墙的普通巷子");
  p.x = L.width - 2;
  p.y = solid;
  p.prog = 0;
  p.dirIdx = 3;
  run(state, ONE_TILE_MS * 2);
  assert.equal(p.x, L.width - 2, "非暗巷行的尽头是墙，不该假跨界");
});

test("贴角预输入：到口才生效，绝不「按了左却撞墙」", () => {
  const state = make(LAYOUTS.alley);
  launch(state);
  const p = state.player;
  p.dirIdx = 3;
  p.wantIdx = NONE;
  const r = intent(state, { type: "turn", dir: dirIndex("up") });
  assert.equal(r.applied, true);
  assert.equal(p.wantIdx, dirIndex("up"), "预输入应暂存到 wantIdx");
  assert.equal(p.dirIdx, 3, "本帧不得立刻改向（那是撞墙）");
});

test("原地掉头：随时可退回来源格", () => {
  const state = make(LAYOUTS.alley);
  launch(state);
  const p = state.player;
  p.dirIdx = 3;
  p.prog = 0.5;
  const x0 = p.x;
  const r = intent(state, { type: "turn", dir: dirIndex("left") });
  assert.equal(r.applied, true);
  assert.equal(p.dirIdx, dirIndex("left"));
  assert.equal(p.x, x0 + 1, "掉头应把身子翻回来源格");
  assert.ok(Math.abs(p.prog - 0.5) < 1e-9, "掉头后行程镜像");
});

test("非法方向与终局意图一律静默拒绝（返回 action:null）", () => {
  const state = make(LAYOUTS.alley);
  assert.equal(intent(state, { type: "turn", dir: 99 }).applied, false);
  assert.equal(intent(null, { type: "turn", dir: 0 }).applied, false);
  assert.equal(intent(state, null).applied, false);
  state.status = "lost";
  state.player.wantIdx = NONE;
  intent(state, { type: "turn", dir: 0 });
  assert.equal(state.player.wantIdx, NONE, "终局后不再接受操作");
});

test("吃满整巷即清场，且清场分含结余灯奖励", () => {
  const state = make(LAYOUTS.square);
  launch(state);
  const total = state.dotLeft + state.pearlLeft;
  const ctx = { field: null, fieldHunt: false, tick: 0, goal: null, danger: null };
  let guard = 0;
  while (!isTerminal(state) && guard < 30000) {
    guard += 1;
    for (const g of state.ghosts) {
      g.st = "house";
      g.releaseAt = 1e9;
    }
    if (state.status === "ready") launch(state);
    const d = botChooseDir(state, ctx);
    if (d >= 0) intent(state, { type: "turn", dir: d });
    stepFrame(state, TICK);
  }
  const eaten = total - (state.dotLeft + state.pearlLeft);
  assert.ok(eaten / total >= 0.5, `影子玩家实测吃净率偏低：${eaten}/${total}`);
  assert.ok(state.score > 0);

  // 收尾交给确定性走法：贪心一步博弈的影子玩家收不了尾（botGate 因此按吃净率验收），
  // 这里只验「吃净即清场」这条状态机与结余灯奖励口径。
  state.dotGrid.fill(0);
  state.pearlGrid.fill(0);
  state.dotLeft = 0;
  state.pearlLeft = 0;
  launch(state);
  freeze(state);
  const scoreBefore = state.score;
  assert.ok(placeAhead(state, DOT), "玩家面前该有一格可走");
  assert.equal(state.dotLeft + state.pearlLeft, 1);
  run(state, ONE_TILE_MS * 2);
  assert.equal(state.dotLeft + state.pearlLeft, 0, "踏上新格即结算，吃净即清场");
  assert.equal(state.status, "cleared");
  assert.ok(isTerminal(state));
  const ev = drainEvents(state).find((e) => e.type === "cleared");
  assert.ok(ev, "清场要派发 cleared 事件");
  assert.equal(ev.bonus, state.lives * 500, "结余灯奖励 = 余灯 × 500");
  assert.equal(state.score, scoreBefore + 10 + ev.bonus, "清场分 = 最后一口 + 结余灯奖励");
  const frozen = state.score;
  run(state, 2000);
  assert.equal(state.score, frozen, "终局后引擎一律冻结");
});

test("日曜珠 → 惊惶 → 200/400/800/1600 连吞翻倍", () => {
  const state = make(LAYOUTS.rings);
  launch(state);
  state.lives = 9;
  const p = state.player;
  freeze(state, { ghosts: false });
  assert.ok(placeAhead(state, PEARL), "出生点四周该有可走格");
  run(state, ONE_TILE_MS * 2);
  assert.ok(state.frightMs > 0, "吞珠后应进入惊惶");
  assert.equal(state.frightChain, 0);
  const seen = [];
  for (let i = 0; i < 5; i += 1) {
    state.frightMs = state.cfg.frightMs;
    const g = state.ghosts[i % state.ghosts.length];
    g.st = "fright";
    g.x = p.x;
    g.y = p.y;
    g.prog = 0;
    freeze(state);
    const before = state.score;
    run(state, 40);
    const gain = state.score - before;
    assert.equal(gain, GHOST_VALUES[Math.min(3, i)], `第 ${i + 1} 次吞影的分`);
    if (gain > 0) seen.push(gain);
    assert.equal(g.st, "eyes", "被吞的影魅应化作归巢眼");
  }
  assert.equal(seen.length, 5);
  assert.deepEqual(seen.slice(0, 4), GHOST_VALUES);
  assert.equal(state.stats.bestChain, 5, "连吞计数一路累加");
  assert.equal(state.trainBonus, 1, "无人跟随时影列倍率为 ×1");
});

test("影列倍率：一珠身后拖着的影魅越多，吞影分越高", () => {
  const state = make(LAYOUTS.rings);
  launch(state);
  state.lives = 9;
  const p = state.player;
  p.dirIdx = NONE;
  p.wantIdx = NONE;
  p.prog = 0;
  const spot = placeAhead(state, PEARL);
  assert.ok(spot, "出生点四周该有可走格");
  const d = DIRS[spot.dir];
  for (let i = 0; i < 3; i += 1) {
    const g = state.ghosts[i];
    g.st = "normal";
    g.x = p.x - d.x * (1 + i);
    g.y = p.y - d.y * (1 + i);
    g.prog = 0;
    g.dirIdx = spot.dir;
    g.stunMs = 9e6;
    g.dartLeft = 0;
    g.dartWindMs = 0;
  }
  run(state, ONE_TILE_MS * 2);
  assert.ok(state.frightMs > 0, "应已吞珠进入惊惶");
  assert.ok(state.trainBonus >= 2, `身后三影应攒出影列倍率，实际 ×${state.trainBonus}`);
  assert.ok(state.stats.longestTrain >= state.trainBonus);
  const first = state.ghosts.find((g) => g.st === "fright");
  first.x = p.x;
  first.y = p.y;
  first.prog = 0;
  p.dirIdx = NONE;
  const before = state.score;
  run(state, 40);
  assert.equal(state.score - before, GHOST_VALUES[0] * state.trainBonus, "首吞即为 200 × 影列倍率");
});

test("惊惶结束自动复原，且归巢眼回匣后重新出匣", () => {
  const state = make(LAYOUTS.rings);
  launch(state);
  state.frightMs = 800;
  for (const g of state.ghosts) {
    g.st = "fright";
  }
  run(state, 1600);
  assert.equal(state.frightMs, 0);
  for (const g of state.ghosts) assert.notEqual(g.st, "fright", "惊惶到点后必须复原");
  const eyes = state.ghosts.find((g) => g.st === "eyes");
  if (eyes) {
    run(state, 9000);
    assert.notEqual(eyes.st, "eyes", "归巢眼最终要回匣");
  }
});

test("被碰到熄灯 → 原地重生 → 三盏灯尽方判负", () => {
  const state = make(LAYOUTS.alley);
  launch(state);
  const p = state.player;
  const kill = () => {
    const g = state.ghosts[0];
    g.st = "normal";
    g.x = p.x;
    g.y = p.y;
    g.prog = 0;
    run(state, 40);
  };
  for (let round = 0; round < 3; round += 1) {
    launch(state);
    const livesBefore = state.lives;
    const wickBefore = state.wick;
    kill();
    assert.equal(state.lives, livesBefore - 1, `第 ${round + 1} 次被碰应熄一盏灯`);
    assert.equal(state.status, "dying");
    assert.ok(state.wick <= wickBefore, "被碰会大扣灯芯");
    const ev = drainEvents(state).find((e) => e.type === "caught");
    assert.ok(ev, "被碰要派发 caught 事件");
    run(state, 1300); // 走尸动画 1150ms 后 respawn
    if (state.lives > 0) {
      assert.equal(state.status, "ready", "重生前先上灯倒计时");
      assert.equal(p.x, state.layout.spawn.x, "重生应回到巷口");
      assert.ok(state.dotLeft > 0, "重生不清光尘");
    }
  }
  assert.equal(state.lives, 0);
  assert.equal(state.status, "lost");
  assert.ok(isTerminal(state));
  assert.ok(drainEvents(state).some((e) => e.type === "lost" && e.reason === "lives"));
});

test("提灯：消耗灯芯、进冷却、灯芯不足时静默不响应", () => {
  const state = make(LAYOUTS.alley);
  launch(state);
  state.wick = DASH.cost;
  const r = intent(state, { type: "dash" });
  assert.equal(r.applied, true);
  assert.equal(state.wick, 0);
  assert.equal(state.dashCoolMs, DASH.coolMs);
  assert.equal(intent(state, { type: "dash" }).applied, false, "冷却中不可再提");
  state.wick = 1;
  state.dashCoolMs = 0;
  assert.equal(intent(state, { type: "dash" }).applied, false, "灯芯不足不可提");
  state.wick = WICK.max;
  run(state, DASH.activeMs + 40);
  assert.equal(state.dashMs, 0, "爆亮时长过后应收起");
});

test("灯芯：随时间烧减、吃光尘回补、撞影大扣", () => {
  const state = make(LAYOUTS.alley);
  launch(state);
  state.wick = 40;
  freeze(state);
  run(state, 2000);
  assert.ok(state.wick < 40, "灯芯应持续烧减");
  assert.ok(state.wick > 40 - 3, `烧减速率约 ${WICK.decay}/秒，不该暴烈`);

  const wickBefore = state.wick;
  freeze(state, { ghosts: false });
  assert.ok(placeAhead(state, DOT));
  run(state, ONE_TILE_MS * 2);
  assert.ok(state.wick > wickBefore, "吃一颗光尘回补 WICK.dot");

  const g = state.ghosts[0];
  freeze(state);
  g.st = "normal";
  g.x = state.player.x;
  g.y = state.player.y;
  g.prog = 0;
  const beforeHit = state.wick;
  run(state, 40);
  assert.equal(state.status, "dying");
  assert.equal(state.deaths, 1);
  assert.ok(
    Math.abs(beforeHit - WICK.hitCost - state.wick) < 1,
    `撞影一次性扣掉 WICK.hitCost=${WICK.hitCost}，实际 ${beforeHit} → ${state.wick}`
  );
});

test("更漏节拍：追猎与巡游按时互换", () => {
  const state = make(LAYOUTS.alley, { cfg: { phases: [[1000, "chase"], [1000, "scatter"]] } });
  launch(state);
  freeze(state);
  assert.equal(state.phaseKind, "chase");
  assert.equal(state.phaseMs, 1000);
  run(state, 1200);
  assert.equal(state.phaseKind, "scatter");
  run(state, 1200);
  assert.equal(state.phaseKind, "chase", "尾档不是追猎的阶梯要正常轮回，否则影魅会一路躲到死");
  run(state, 1200);
  assert.equal(state.phaseKind, "scatter");
});

test("阶梯尾档是追猎时：一轮回落后常驻长追（经典尾段）", () => {
  const state = make(LAYOUTS.alley, { cfg: { phases: [[1000, "chase"], [1000, "scatter"], [1000, "chase"]] } });
  launch(state);
  freeze(state);
  run(state, 1200);
  assert.equal(state.phaseKind, "scatter");
  run(state, 1200);
  assert.equal(state.phaseKind, "chase");
  assert.ok(state.phaseMs > 3600000, "尾档追猎应变成常驻档");
  run(state, 3000);
  assert.equal(state.phaseKind, "chase");
  assert.equal(state.phaseIdx, 2);
});

test("破晓冲刺的时间账：钳上限、归零判负", () => {
  const state = make(LAYOUTS.alley, { mode: "timed", cfg: { timed: 5000, timedMax: 60000 } });
  launch(state);
  addTime(state, 90000);
  assert.equal(state.timeLeftMs, 60000, "续时应被上限钳住");
  const events = drainEvents(state);
  assert.ok(events.some((e) => e.type === "time"), "续时要派发事件");
  loseTime(state, 60000);
  assert.equal(state.timeLeftMs, 0);
  assert.equal(state.status, "lost");
  run(state, 500);
  assert.equal(state.status, "lost", "终局后不再推进");
});

test("非限时模式对时间账免疫", () => {
  const state = make(LAYOUTS.alley);
  const before = state.clock;
  addTime(state, 5000);
  loseTime(state, 5000);
  assert.equal(state.status, "ready");
  run(state, 100);
  assert.ok(state.clock >= before);
});

test("万灯赐一灯：额外命只发一次", () => {
  const state = make(LAYOUTS.alley);
  launch(state);
  freeze(state);
  state.score = EXTRA_LIFE_AT - 10;
  const lives = state.lives;

  assert.ok(placeAhead(state, DOT));
  run(state, ONE_TILE_MS * 2);
  assert.ok(state.score >= EXTRA_LIFE_AT, "应已越过万灯线");
  assert.equal(state.extraLifeGiven, true);
  assert.equal(state.lives, lives + 1);
  assert.ok(drainEvents(state).some((e) => e.type === "extraLife"));

  const frozen = state.lives;
  assert.ok(placeAhead(state, DOT));
  run(state, ONE_TILE_MS * 2);
  assert.equal(state.lives, frozen, "额外命只发一次");
});

test("影魅出匣有序，且 release 事件按 cfg 时点派发", () => {
  const state = make(LAYOUTS.rings, { cfg: { release: [0, 4000, 12000, 20000] } });
  launch(state);
  run(state, 6000);
  const out = state.ghosts.filter((g) => g.st !== "house").length;
  assert.ok(out >= 2, `六秒后至少两只出匣，实际 ${out}`);
  for (const g of state.ghosts) {
    assert.ok(["house", "exiting", "normal", "eyes", "fright"].includes(g.st), `未知影魅状态 ${g.st}`);
    assert.ok(ghostStateKey(state, g));
  }
});

test("影魅从不穿墙：连续八秒巡逻后仍在可行走格上", () => {
  const state = make(LAYOUTS.cross, { cfg: { startLives: 99, release: [0, 0, 0, 0] } });
  launch(state);
  const rnd = mulberry32(5);
  for (let i = 0; i < 600; i += 1) {
    if (i % 30 === 0) intent(state, { type: "turn", dir: Math.floor(rnd() * 4) });
    stepFrame(state, TICK);
    for (const g of state.ghosts) {
      assert.ok(isWalkableTile(charAt(state.layout, g.x, g.y)) || g.st === "house" || g.st === "exiting", "影魅卡进了墙里");
    }
  }
});

test("BFS 距离场：源点为 0，孤岛为 -1，梯度每步最多差 1", () => {
  const state = make(LAYOUTS.alley);
  const L = state.layout;
  const field = buildField(L, [L.spawn], "player");
  assert.equal(field[L.spawn.y * L.width + L.spawn.x], 0);
  let reachable = 0;
  for (let y = 0; y < L.height; y += 1) {
    for (let x = 0; x < L.width; x += 1) {
      const k = y * L.width + x;
      if (!isWalkableTile(charAt(L, x, y))) continue;
      const d = field[k];
      if (d < 0) continue;
      reachable += 1;
      let minN = Infinity;
      for (const dir of DIRS) {
        const nk = (y + dir.y) * L.width + (x + dir.x);
        if (x + dir.x < 0 || x + dir.x >= L.width) continue;
        if (isWalkableTile(charAt(L, x + dir.x, y + dir.y)) && field[nk] >= 0) minN = Math.min(minN, field[nk]);
      }
      if (d > 0 && Number.isFinite(minN)) assert.ok(d - minN <= 1, `梯度断裂 (x=${x},y=${y})`);
    }
  }
  assert.ok(reachable > 60, "纸巷应有一大片可达格");
});

test("parseLayout 量出的图与原始纸样一致，脏行不崩", () => {
  const parsed = parseLayout(LAYOUTS.alley);
  assert.equal(parsed.width, LAYOUTS.alley[0].length);
  assert.equal(parsed.height, LAYOUTS.alley.length);
  assert.equal(parsed.rows.length, LAYOUTS.alley.length);
  assert.ok(parsed.dots > 0);
  assert.equal(parsed.rows.every((r) => r.length === parsed.width), true);
  assert.equal(charAt(parsed, -3, 99), WALL, "越界取样按墙处理");
  assert.equal(parseLayout([""]), null);
});

test("entPos 是格心加行程，供渲染与碰撞共用同一口径", () => {
  const state = make(LAYOUTS.alley);
  const p = state.player;
  p.x = 4;
  p.y = 6;
  p.prog = 0;
  p.dirIdx = NONE;
  assert.deepEqual(entPos(state, p), { x: 4.5, y: 6.5 });
  p.dirIdx = 3;
  p.prog = 0.5;
  assert.deepEqual(entPos(state, p), { x: 5, y: 6.5 });
});

test("影魅速度低于提灯人，惊惶时更慢：逃跑在数学上成立", () => {
  assert.ok(SPEED.ghostMul < 1);
  assert.ok(SPEED.frightMul < SPEED.ghostMul);
  assert.equal(SPEED.tunnelMul < SPEED.ghostMul, true);
});
