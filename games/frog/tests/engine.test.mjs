import { test } from "node:test";
import assert from "node:assert/strict";
import * as engine from "../js/engine.mjs";
import { buildLevel } from "../js/level.mjs";

// 无障碍场地：公路无车、河流全浮木，用于验证归巢/胜利等纯流程。
function openConfig() {
  const lanes = engine.ROAD_ROWS.map((row) => ({
    row, dir: 1, speed: 0, periodLen: 13, pattern: new Array(13).fill(0),
  }));
  const rivers = engine.RIVER_ROWS.map((row) => ({
    row, dir: 1, speed: 0, periodLen: 13, pattern: new Array(13).fill(1), still: [],
  }));
  return { lanes, rivers, lives: 3, timerMax: 60, seed: 1 };
}

const DIRS = ["up", "down", "left", "right"];

test("初始状态：青蛙在起点、5 家未填", () => {
  const s = engine.createState(openConfig());
  assert.equal(s.status, engine.STATUS_PLAYING);
  assert.equal(s.frog.row, engine.START_ROW);
  assert.equal(s.frog.col, engine.START_COL);
  assert.equal(s.homes.length, 5);
  assert.equal(s.homesFilled, 0);
  assert.equal(s.lives, 3);
  assert.equal(s.cols, 13);
  assert.equal(s.rows, 13);
});

test("applyIntent 四向移动与起点向下 no-op", () => {
  const s0 = engine.createState(openConfig());
  const right = engine.applyIntent(s0, "right");
  assert.notEqual(right.state, s0);
  assert.equal(right.action, "move");
  assert.equal(right.state.frog.col, 7);

  const left = engine.applyIntent(right.state, "left");
  assert.equal(left.state.frog.col, 6);

  const down = engine.applyIntent(s0, "down");
  assert.equal(down.state, s0); // 不能向下越过起点
  assert.equal(down.action, null);
});

test("撞左右边缘即死", () => {
  let s = engine.createState(openConfig());
  // 起点行一路右移至 col 12，再右移撞边缘
  for (let c = 6; c < 12; c += 1) s = engine.applyIntent(s, "right").state;
  const r = engine.applyIntent(s, "right");
  assert.equal(r.action, engine.EV_EDGE);
  assert.equal(r.state.lives, 2); // 损失 1 命
  assert.equal(r.state.status, engine.STATUS_PLAYING);
});

test("归巢填满 5 家即胜利", () => {
  let s = engine.createState(openConfig());
  const cols = [2, 4, 6, 8, 10];
  for (let t = 0; t < cols.length; t += 1) {
    while (s.frog.col < cols[t]) s = engine.applyIntent(s, "right").state;
    while (s.frog.col > cols[t]) s = engine.applyIntent(s, "left").state;
    for (let i = 0; i < engine.START_ROW; i += 1) s = engine.applyIntent(s, "up").state;
  }
  assert.equal(s.status, engine.STATUS_WON);
  assert.equal(s.homesFilled, 5);
});

test("归巢命中飞虫槽会续命", () => {
  let s = engine.createState(openConfig());
  s.flyHome = 0; // 强制飞虫在槽 0（列 2）
  while (s.frog.col > 2) s = engine.applyIntent(s, "left").state;
  for (let i = 0; i < engine.START_ROW; i += 1) s = engine.applyIntent(s, "up").state;
  assert.equal(s.lives, 4); // 3 + 1 续命
  assert.equal(s.flyCount, 1);
  assert.equal(s.status, engine.STATUS_PLAYING);
});

test("撞已占家槽即死", () => {
  let s = engine.createState(openConfig());
  s.homes[2] = true; // 列 6 槽已占（与起点同列）
  for (let i = 0; i < engine.START_ROW; i += 1) s = engine.applyIntent(s, "up").state;
  assert.equal(s.lastEvent, engine.EV_EDGE);
  assert.equal(s.lives, 2);
});

test("stepFrame 推进时间并递减计时器", () => {
  let s = engine.createState(openConfig());
  const s1 = engine.stepFrame(s, 5);
  assert.equal(s1.time, 5);
  assert.equal(s1.timer, 55);
});

test("站在公路上被驶来的车撞死", () => {
  const lane = { row: 7, dir: 1, speed: 2, periodLen: 13, pattern: new Array(13).fill(0) };
  lane.pattern[6] = 1; // 车会在随时间漂移到青蛙所在列
  const lanes = engine.ROAD_ROWS.map((row) => (row === 7
    ? lane
    : { row, dir: 1, speed: 0, periodLen: 13, pattern: new Array(13).fill(0) }));
  const rivers = engine.RIVER_ROWS.map((row) => ({
    row, dir: 1, speed: 0, periodLen: 13, pattern: new Array(13).fill(1),
  }));
  const cfg = { lanes, rivers, lives: 3, timerMax: 60, seed: 1 };
  let s = engine.createState(cfg);
  s.frog = { row: 7, col: 6 };
  // 逐步推进，车终将撞上青蛙
  let hit = false;
  for (let i = 0; i < 60 && !hit; i += 1) {
    s = engine.stepFrame(s, 0.2);
    if (s.lastEvent === engine.EV_HIT) hit = true;
  }
  assert.ok(hit, "车辆应最终撞上静止在车道的青蛙");
  assert.ok(s.lives < 3);
});

test("站在河流上因浮木漂走而落水", () => {
  const river = { row: 1, dir: 1, speed: 1, periodLen: 13, pattern: new Array(13).fill(0), still: [] };
  river.pattern[6] = 1; // 浮木会漂走
  const rivers = engine.RIVER_ROWS.map((row) => (row === 1
    ? river
    : { row, dir: 1, speed: 0, periodLen: 13, pattern: new Array(13).fill(1), still: [] }));
  const lanes = engine.ROAD_ROWS.map((row) => ({
    row, dir: 1, speed: 0, periodLen: 13, pattern: new Array(13).fill(0),
  }));
  const cfg = { lanes, rivers, lives: 3, timerMax: 60, seed: 1 };
  let s = engine.createState(cfg);
  s.frog = { row: 1, col: 6 };
  let drowned = false;
  for (let i = 0; i < 60 && !drowned; i += 1) {
    s = engine.stepFrame(s, 0.2);
    if (s.lastEvent === engine.EV_DROWN) drowned = true;
  }
  assert.ok(drowned, "浮木漂走后青蛙应落水");
});

test("连续相位：车移过格心后不再误撞（无离散 floor 滞后）", () => {
  const lane = { row: 7, dir: 1, speed: 1, periodLen: 13, pattern: new Array(13).fill(0) };
  lane.pattern[6] = 1; // 车从 col 6 向右平滑漂移
  // t=0：车中心压在 col6 → 撞
  assert.equal(engine.laneHits(lane, 6, 0), true);
  // t=0.3：车已右移 0.3，col6 中心仍被覆盖 → 撞
  assert.equal(engine.laneHits(lane, 6, 0.3), true);
  // t=0.6：车左边缘已越过 col6 中心(col6.5) → 安全，不再误撞
  assert.equal(engine.laneHits(lane, 6, 0.6), false);
  // 同时 col7 已被车头覆盖 → 撞
  assert.equal(engine.laneHits(lane, 7, 0.6), true);
  // t=1.6：车已离开 col7，col7 安全
  assert.equal(engine.laneHits(lane, 7, 1.6), false);
});

test("命尽则整局失败", () => {
  let s = engine.createState(openConfig());
  s.lives = 1;
  s.frog = { row: 12, col: 12 };
  const r = engine.applyIntent(s, "right"); // 撞边缘
  assert.equal(r.state.status, engine.STATUS_LOST);
  assert.equal(r.state.lives, 0);
});

test("终止态操作 no-op 不抛错", () => {
  const cfg = buildLevel(1);
  let s = engine.createState(cfg);
  s.status = engine.STATUS_WON;
  for (const d of DIRS) {
    const r = engine.applyIntent(s, d);
    assert.equal(r.state, s);
    assert.equal(r.action, null);
  }
  assert.equal(engine.stepFrame(s, 1), s);
});

test("无死局：车道任意时刻存在安全列、河流任意时刻存在浮木", () => {
  for (let lv = 1; lv <= 40; lv += 1) {
    const cfg = buildLevel(lv);
    let s = engine.createState(cfg);
    for (let t = 0; t < 8; t += 1) {
      s = engine.stepSeconds(s, 1);
      for (const lane of s.lanes) {
        let safeCol = false;
        for (let c = 0; c < 13; c += 1) if (!engine.laneHits(lane, c, s.time)) safeCol = true;
        assert.ok(safeCol, `关卡 ${lv} 车道 row=${lane.row} 在 t=${s.time} 无安全列`);
      }
      for (const river of s.rivers) {
        let solidCol = false;
        for (let c = 0; c < 13; c += 1) if (engine.riverSolid(river, c, s.time)) solidCol = true;
        assert.ok(solidCol, `关卡 ${lv} 河流 row=${river.row} 在 t=${s.time} 无浮木`);
      }
    }
  }
});

test("确定性随机游走 1000+ 步不抛错、不变式不破", () => {
  const rng = engine.mulberry32(20260923);
  for (let lv = 1; lv <= 40; lv += 1) {
    const cfg = buildLevel(lv);
    let s = engine.createState({ ...cfg, seed: lv });
    for (let i = 0; i < 1200; i += 1) {
      const d = DIRS[Math.floor(rng() * DIRS.length)];
      if (s.status === engine.STATUS_PLAYING) {
        s = engine.applyIntent(s, d).state;
      }
      s = engine.stepFrame(s, 0.1);
      assert.ok(s.lives >= 0, "生命不能为负");
      assert.equal(s.rows, 13);
      assert.equal(s.cols, 13);
    }
  }
});

test("关卡生成确定性：同关同 seed 两次 buildLevel 一致", () => {
  const a = buildLevel(7);
  const b = buildLevel(7);
  assert.deepEqual(a.lanes, b.lanes);
  assert.deepEqual(a.rivers, b.rivers);
  assert.equal(a.timerMax, b.timerMax);
});