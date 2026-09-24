// engine.test.mjs — 规则唯一权威的纯逻辑验证。
// 注意：stepFrame 将 dt 钳制在 0~1/20s，测试一律用 ≤0.05s 步长；手推敌人必须补全字段。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  applyIntent,
  stepFrame,
  drainEvents,
  resultOf,
  mulberry32,
  hashSeed,
  PHASES,
  WEAPONS,
  PASSIVES,
  EVOLUTIONS,
  ENEMIES,
  CHARACTERS,
  SCORE_CAP,
  MOW_MAX,
  BOSS_TIME,
  WEAPON_MAX_LEVEL,
  PASSIVE_MAX_LEVEL,
  WEAPON_SLOTS,
  PASSIVE_SLOTS,
  ARENA_W,
  ARENA_H,
} from "../js/engine.mjs";

function fresh(mode = "standard", character = "mower") {
  const state = createGame({ mode, character, rng: mulberry32(42) });
  applyIntent(state, "start");
  return state;
}

/** 构造一个合法的测试敌人（补全引擎需要的全部字段） */
function enemy(type, x, y, over = {}) {
  const meta = ENEMIES[type];
  return {
    alive: true,
    type,
    x,
    y,
    r: meta.r,
    hp: over.hp ?? 60,
    maxHp: over.hp ?? 60,
    spawnT: over.spawnT ?? 0,
    elite: Boolean(meta.elite),
    xp: meta.xp,
    dmg: meta.dmg,
    speed: over.speed ?? meta.speed,
    angle: 0,
    steer: 1,
    bounce: Boolean(meta.bounce),
    dirX: 0,
    dirY: 1,
    hitFlash: 0,
    ...over,
  };
}

test("createGame 默认值与角色差异", () => {
  const state = createGame({ rng: mulberry32(1) });
  assert.equal(state.mode, "standard");
  assert.equal(state.character, "mower");
  assert.equal(state.phase, PHASES.ready);
  assert.equal(state.weapons.length, 1);
  assert.equal(state.weapons[0].id, CHARACTERS.mower.weapon);
  assert.ok(state.player.maxHp > 0);
  const ladybug = createGame({ character: "ladybug", rng: mulberry32(1) });
  assert.equal(ladybug.weapons[0].id, "bouncy-pod");
  assert.ok(ladybug.player.maxHp < state.player.maxHp, "瓢虫血少");
});

test("applyIntent：合法/非法/终局 no-op", () => {
  const state = fresh();
  assert.equal(applyIntent(state, "start"), null, "已开局的 start 无效");
  assert.equal(applyIntent(state, "burst"), null, "割草槽未满不能爆");
  assert.equal(applyIntent(state, "nonsense"), null, "未知意图返回 null");
  assert.equal(applyIntent(state, "pause"), "pause");
  assert.equal(applyIntent(state, "pause"), null, "重复暂停无效");
  assert.equal(applyIntent(state, "resume"), "resume");
  state.mow = MOW_MAX;
  state.mowReady = true;
  assert.equal(applyIntent(state, "burst"), "burst");
  assert.equal(state.mow, 0);
  assert.equal(state.burstCount, 1);
  assert.equal(state.scoreMult, 2);
  // 终局 no-op
  state.phase = PHASES.won;
  assert.equal(applyIntent(state, "burst"), null);
  assert.equal(applyIntent(state, "pause"), null);
  assert.equal(applyIntent(state, "choose", 0), null);
});

test("stepFrame：固定步长推进与暂停/升级冻结", () => {
  const state = fresh();
  const t0 = state.time;
  stepFrame(state, 1 / 60, { dx: 1, dy: 0 });
  assert.ok(state.time > t0);
  applyIntent(state, "pause");
  const t1 = state.time;
  stepFrame(state, 1 / 60, {});
  assert.equal(state.time, t1, "暂停时时间冻结");
  applyIntent(state, "resume");
  state.xp = state.xpNext;
  stepFrame(state, 1 / 60, {});
  assert.equal(state.phase, PHASES.upgrading, "经验满进入三选一");
  const t2 = state.time;
  stepFrame(state, 1 / 60, {});
  assert.equal(state.time, t2, "三选一期间时间冻结");
});

test("升级三选一：被动满级时必含武器，选择生效且槽位封顶", () => {
  // 塞满 6 个被动槽且全部满级 → 候选只剩武器与经验补给
  const state = fresh();
  for (const id of Object.keys(PASSIVES).slice(0, PASSIVE_SLOTS)) {
    state.passives.push({ id, level: PASSIVE_MAX_LEVEL });
  }
  state.xp = state.xpNext;
  stepFrame(state, 1 / 60, {});
  assert.equal(state.phase, PHASES.upgrading);
  assert.ok(state.choices.length >= 3, "至少三选");
  const weaponChoice = state.choices.find((c) => c.kind === "weapon");
  assert.ok(weaponChoice, "候选必含武器");
  const idx = state.choices.indexOf(weaponChoice);
  applyIntent(state, "choose", idx);
  assert.equal(state.phase, PHASES.playing);
  assert.ok(state.weapons.some((w) => w.id === weaponChoice.id), "选择应用到构筑");
  // 槽位上限：手动塞满 6 把后，候选武器只能是升级
  const state2 = fresh();
  const existing = state2.weapons.map((w) => w.id);
  for (const id of Object.keys(WEAPONS).filter((wid) => !existing.includes(wid)).slice(0, WEAPON_SLOTS - 1)) {
    state2.weapons.push({ id, level: 1, evolved: false, cd: 0, aux: {} });
  }
  assert.equal(state2.weapons.length, WEAPON_SLOTS);
  state2.xp = state2.xpNext;
  stepFrame(state2, 1 / 60, {});
  for (const c of state2.choices) {
    if (c.kind === "weapon") assert.ok(c.level > 1, "武器槽满后只出现已有武器升级");
  }
});

test("进化合成：武器满级 + 对应被动 + 宝箱 → 超武", () => {
  const state = fresh();
  state.weapons[0].level = WEAPON_MAX_LEVEL;
  state.passives.push({ id: "steel-disk", level: 1 });
  state.drops.push({ kind: "chest", x: state.player.x, y: state.player.y, life: 2 });
  stepFrame(state, 1 / 60, {});
  const evs = drainEvents(state);
  assert.ok(evs.some((e) => e.type === "evolve"), "触发进化事件");
  assert.equal(state.weapons[0].id, "gold-disk");
  assert.equal(state.weapons[0].evolved, true);
  assert.ok(state.codex.evolutions.includes("gold-disk"));
});

test("花粉爆发：清场 + 不伤精英 + 倍率窗口", () => {
  const state = fresh();
  state.mow = MOW_MAX;
  state.mowReady = true;
  state.enemies.push(enemy("caterpillar", state.player.x + 80, state.player.y));
  state.enemies.push(enemy("caterpillar", state.player.x - 90, state.player.y));
  state.enemies.push(enemy("elite", state.player.x, state.player.y + 120));
  stepFrame(state, 1 / 60, { burst: true });
  const alive = state.enemies.filter((e) => e.alive);
  assert.equal(alive.length, 1, "普通怪清空、精英存活");
  assert.equal(alive[0].type, "elite");
  assert.equal(state.scoreMult, 2);
});

test("无死局①：出生淡入期间不造成伤害", () => {
  const state = fresh("standard", "sprinkler"); // 花洒不会误杀贴脸测试怪
  state.enemies.push(enemy("caterpillar", state.player.x, state.player.y, { hp: 500, spawnT: 0.4 }));
  for (let i = 0; i < 4; i += 1) stepFrame(state, 0.05, {});
  assert.ok(state.enemies[0].spawnT > 0, "淡入期未结束");
  assert.equal(state.player.hp, state.player.maxHp, "淡入期不受伤");
  for (let i = 0; i < 9; i += 1) stepFrame(state, 0.05, {});
  assert.ok(state.enemies[0].spawnT === 0, "淡入结束");
  assert.ok(state.player.hp < state.player.maxHp, "淡入结束后接触伤害");
});

test("无死局②：360° 被围自动免费花粉脱困", () => {
  const state = fresh();
  state.emergencyCd = 0;
  state.enemies = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    state.enemies.push(enemy("beetle", state.player.x + Math.cos(a) * 150, state.player.y + Math.sin(a) * 150));
  }
  state.events = [];
  for (let i = 0; i < 140; i += 1) stepFrame(state, 1 / 60, {});
  const evs = drainEvents(state);
  assert.ok(evs.some((e) => e.type === "emergencyBurst"), "触发应急脱困");
  assert.ok(state.player.hp > 0, "脱困后仍存活");
  assert.ok(state.emergencyCd > 0, "进入冷却");
});

test("Boss 战：7:30 清场回血登场，击杀即通关", () => {
  const state = fresh("standard");
  state.time = BOSS_TIME - 1;
  state.player.hp = 30;
  state.enemies.push(enemy("beetle", 100, 100));
  state.events = [];
  for (let i = 0; i < 70 && !state.boss; i += 1) stepFrame(state, 1 / 60, {});
  const evs = drainEvents(state);
  assert.ok(evs.some((e) => e.type === "bossSpawn"), "Boss 登场");
  assert.ok(state.boss, "Boss 存在");
  assert.equal(state.player.hp, state.player.maxHp, "Boss 前满血补给");
  assert.equal(state.enemies.filter((e) => e.alive).length, 0, "Boss 前清场");
  // 贴脸输出：刀盘斩杀
  state.player.x = state.boss.x;
  state.player.y = state.boss.y + 60;
  state.boss.hp = 1;
  state.events = [];
  for (let i = 0; i < 240 && state.phase !== PHASES.won; i += 1) stepFrame(state, 1 / 60, {});
  assert.equal(state.phase, PHASES.won, "Boss 击破通关");
  const r = resultOf(state);
  assert.equal(r.won, true);
  assert.equal(r.bossKilled, true);
});

test("耐力：1200 步随机游走不抛错、不变式不破", () => {
  const rng = mulberry32(20260925);
  const state = createGame({ rng });
  applyIntent(state, "start");
  let upgrades = 0;
  for (let i = 0; i < 1200; i += 1) {
    const input = {
      dx: rng() * 2 - 1,
      dy: rng() * 2 - 1,
      burst: rng() < 0.03,
    };
    stepFrame(state, 1 / 60, input);
    if (state.phase === PHASES.upgrading) {
      const idx = Math.floor(rng() * state.choices.length);
      applyIntent(state, "choose", idx);
      upgrades += 1;
    }
    if (i % 120 === 0) {
      assert.ok(state.score <= SCORE_CAP, "得分不越上限");
      assert.ok(state.mow <= MOW_MAX, "割草槽不越上限");
      assert.ok(state.player.hp <= state.player.maxHp && state.player.hp >= 0, "生命合法");
      assert.ok(state.weapons.length <= WEAPON_SLOTS, "武器槽不越界");
      assert.ok(state.passives.length <= PASSIVE_SLOTS, "被动槽不越界");
      assert.ok(state.player.x >= 0 && state.player.x <= ARENA_W && state.player.y >= 0 && state.player.y <= ARENA_H, "玩家不越界");
    }
  }
  assert.ok(upgrades > 0, "游走中触发了升级");
  assert.ok([PHASES.playing, PHASES.upgrading, PHASES.won, PHASES.lost].includes(state.phase), "阶段合法");
});

test("确定性：同种子轨迹一致，异种子随机流不同", () => {
  const run = (seed) => {
    const state = createGame({ rng: mulberry32(seed) });
    applyIntent(state, "start");
    for (let i = 0; i < 300; i += 1) {
      stepFrame(state, 1 / 60, { dx: 0.4, dy: -0.3, burst: i === 150 });
      if (state.phase === PHASES.upgrading) applyIntent(state, "choose", 0);
      if (state.phase !== PHASES.playing) break;
    }
    return `${state.time.toFixed(3)}:${state.kills}:${state.score}:${state.mow.toFixed(3)}`;
  };
  assert.equal(run(99), run(99), "同种子轨迹一致");
  const a = mulberry32(99);
  const b = mulberry32(100);
  assert.ok(a() !== b(), "不同种子随机流不同");
});

test("数据表完整性：武器/被动/进化/敌人引用闭合", () => {
  for (const [evolvedId, recipe] of Object.entries(EVOLUTIONS)) {
    assert.ok(WEAPONS[recipe.base], `进化 ${evolvedId} 的基底武器存在`);
    assert.ok(PASSIVES[recipe.passive], `进化 ${evolvedId} 的被动存在`);
  }
  for (const [id, meta] of Object.entries(WEAPONS)) {
    assert.ok(meta.maxLevel > 0 && meta.unlock >= 0, `武器 ${id} 数值合法`);
  }
  for (const [id, meta] of Object.entries(ENEMIES)) {
    assert.ok(meta.hp > 0 && meta.speed > 0 && meta.dmg > 0, `敌人 ${id} 数值合法`);
  }
  assert.ok(ARENA_W > 0 && ARENA_H > 0);
  assert.ok(hashSeed("abc") !== hashSeed("abd"), "种子哈希有区分度");
});
