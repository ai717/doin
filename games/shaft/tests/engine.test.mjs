import test from "node:test";
import assert from "node:assert/strict";

import {
  createState,
  stepFrame,
  setInput,
  drainEvents,
  buildRoute,
  mulberry32,
  VIEW_W,
  VIEW_H,
  WALL_L,
  WALL_R,
  PLAYER_W,
  PLAYER_H,
  START_Y,
  SPACING,
  CEILING_H,
  MAX_HP,
  VOID_MARGIN,
  PLATFORM_TYPES,
} from "../js/engine.mjs";
import { buildConfig, LEVELS, CLASSIC_FLOORS } from "../js/levels.mjs";

function campaign(level = 1, extra = {}) {
  return buildConfig({ mode: "campaign", level, ...extra });
}

function forcedState(type) {
  return createState({
    ...buildConfig({ mode: "campaign", level: 1 }),
    safeCount: 2,
    weights: { [type]: 100 },
  });
}

function firstOfType(state, type) {
  return state.platforms.find((platform) => platform.type === type && platform.id !== 0);
}

function dropOnto(state, platform, frames = 60) {
  const p = state.player;
  p.grounded = null;
  p.x = platform.x;
  p.y = platform.worldY - 16;
  p.vy = 180;
  p.vx = 0;
  p.dropId = null;
  p.dropTimer = 0;
  for (let i = 0; i < frames && state.phase === "playing"; i += 1) {
    stepFrame(state, 1 / 120);
    if (p.grounded === platform.id || p.vy < -40) break;
  }
  return p;
}

test("engine: state construction is deterministic and starts playable", () => {
  const a = createState(campaign(1));
  const b = createState(campaign(1));
  assert.equal(a.player.hp, MAX_HP);
  assert.equal(a.player.maxHp, MAX_HP);
  assert.equal(a.player.grounded, 0, "开局必须直接站在起始岩板上");
  assert.equal(a.phase, "playing");
  assert.ok(a.platforms.length >= 5, "首屏下方必须已经铺好可落脚的跳板");
  assert.deepEqual(
    a.platforms.map((p) => [p.id, p.worldY, Math.round(p.x), p.width, p.type]),
    b.platforms.map((p) => [p.id, p.worldY, Math.round(p.x), p.width, p.type]),
    "同一种子必须生成完全一致的路线"
  );
  assert.ok(a.goalWorldY > START_Y + SPACING, "关卡必须有金盾升降机终点");
});

test("engine: random walk 1000 steps keeps every invariant (three seeds)", () => {
  const configs = [
    buildConfig({ mode: "campaign", level: 1 }),
    buildConfig({ mode: "classic", seed: 4242 }),
    buildConfig({ mode: "endless", seed: 9090 }),
  ];
  for (const config of configs) {
    const state = createState(config);
    const rng = mulberry32(777);
    for (let i = 0; i < 1000; i += 1) {
      const roll = rng();
      if (roll < 0.22) setInput(state, { left: true, right: false });
      else if (roll < 0.44) setInput(state, { left: false, right: true });
      else if (roll < 0.55) setInput(state, { left: false, right: false });
      if (roll > 0.7) setInput(state, { dive: true });
      else setInput(state, { dive: false });
      stepFrame(state, 1 / 120);
      drainEvents(state);

      const p = state.player;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), "坐标不得出现 NaN");
      assert.ok(p.x >= WALL_L + PLAYER_W / 2 - 0.05 && p.x <= WALL_R - PLAYER_W / 2 + 0.05, "玩家不得穿出井壁");
      assert.ok(p.hp >= 0 && p.hp <= p.maxHp, "生命必须夹在合法区间");
      assert.ok(state.platforms.length >= 1 && state.platforms.length <= 90, "平台数量不得失控");
      assert.ok(["playing", "won", "lost"].includes(state.phase), "阶段必须为合法值");
    }
    // 1000 步内必须真的发生过推进（不是全程 no-op）
    assert.ok(state.time > 1, "固定步长时钟必须推进");
    assert.ok(state.scrollY >= 0 && Number.isFinite(state.scrollSpeed));
  }
});

test("engine: identical seeds and inputs replay bit-for-bit", () => {
  const run = () => {
    const state = createState(buildConfig({ mode: "classic", seed: 12345 }));
    const rng = mulberry32(555);
    for (let i = 0; i < 500; i += 1) {
      const roll = rng();
      setInput(state, { left: roll < 0.3, right: roll >= 0.3 && roll < 0.6, dive: roll > 0.8 });
      stepFrame(state, 1 / 120);
      drainEvents(state);
    }
    return {
      x: state.player.x,
      y: state.player.y,
      hp: state.player.hp,
      depth: state.depth,
      scrollY: state.scrollY,
      phase: state.phase,
      route: state.platforms.map((p) => [p.id, p.worldY, Math.round(p.x)]),
    };
  };
  assert.deepEqual(run(), run(), "确定性重放必须完全一致");
});

test("engine: normal rock ledge heals exactly once per board", () => {
  const state = createState(campaign(1));
  const platform = firstOfType(state, "normal");
  assert.ok(platform, "首关必须铺有普通岩板");
  state.player.hp = 5;
  platform.healed = false;
  dropOnto(state, platform);
  assert.equal(state.player.grounded, platform.id, "必须落到岩板上");
  assert.equal(state.player.hp, 6, "普通板首次踩踏回复 1 点");
  assert.equal(platform.healed, true);

  dropOnto(state, platform);
  assert.equal(state.player.hp, 6, "同一块板不得反复回血");
});

test("engine: spike board costs 5 life and can end the run", () => {
  const state = forcedState("spike");
  const spike = firstOfType(state, "spike");
  assert.ok(spike, "权重配置必须能生成尖刺板");
  state.player.hp = MAX_HP;
  dropOnto(state, spike);
  assert.equal(state.player.hp, MAX_HP - 5, "尖刺固定扣 5 点");
  assert.equal(state.phase, "playing");

  const lethal = forcedState("spike");
  const spike2 = firstOfType(lethal, "spike");
  lethal.player.hp = 4;
  dropOnto(lethal, spike2);
  assert.equal(lethal.player.hp, 0);
  assert.equal(lethal.phase, "lost");
  assert.equal(lethal.endReason, "hp");
});

test("engine: spring launches upward and detaches from the board", () => {
  const state = forcedState("spring");
  const spring = firstOfType(state, "spring");
  assert.ok(spring);
  dropOnto(state, spring);
  assert.equal(state.player.grounded, null, "弹簧必须脱离板面");
  assert.ok(state.player.vy < -400, "弹簧必须给出强向上速度");
});

test("engine: crumble board collapses after 0.25s", () => {
  const state = forcedState("crumble");
  const crumble = firstOfType(state, "crumble");
  assert.ok(crumble);
  dropOnto(state, crumble);
  assert.equal(state.player.grounded, crumble.id);
  for (let i = 0; i < 40; i += 1) stepFrame(state, 1 / 120);
  assert.equal(crumble.broken, true, "碎裂板必须在 0.25 秒后失效");
  assert.equal(state.player.grounded, null, "板碎后玩家必须失去支撑");
});

test("engine: ceiling spikes drain life while crushed", () => {
  const state = createState(campaign(1));
  state.scrollY = START_Y - PLAYER_H - CEILING_H + 6;
  const before = state.player.hp;
  for (let i = 0; i < 120; i += 1) stepFrame(state, 1 / 120);
  assert.ok(state.player.hp < before, "顶刺必须持续扣血");
  assert.ok(state.player.hp >= 0);
  assert.equal(state.player.ceiling, true);
});

test("engine: falling below the viewport is an instant loss", () => {
  const state = createState(campaign(1));
  state.player.grounded = null;
  state.player.y = state.scrollY + VIEW_H + VOID_MARGIN + 20;
  state.player.vy = 400;
  stepFrame(state, 1 / 120);
  assert.equal(state.phase, "lost");
  assert.equal(state.endReason, "void");
});

test("engine: landing on the golden lift wins at the target depth", () => {
  const config = campaign(1);
  const state = createState(config);
  const goal = buildRoute(config, 40).find((platform) => platform.type === "goal");
  assert.ok(goal, "关卡路线必须包含金盾升降机");
  state.scrollY = Math.max(0, goal.worldY - 470);
  state.player.grounded = null;
  state.player.x = VIEW_W / 2;
  state.player.y = goal.worldY - 12;
  state.player.vy = 120;

  let landed = false;
  for (let i = 0; i < 90 && !landed; i += 1) {
    stepFrame(state, 1 / 120);
    if (state.phase === "won") landed = true;
  }
  assert.equal(state.phase, "won", "踩上金盾升降机必须即时通关");
  assert.equal(state.depth, config.goalFloors, "通关深度等于关卡目标层数");
});

test("engine: input is rejected outside the playing phase", () => {
  const state = createState(campaign(1));
  state.phase = "lost";
  state.ended = true;
  assert.equal(setInput(state, { left: true }), null);
});

test("engine: every generated route is geometrically reachable and trap-safe", () => {
  const configs = LEVELS.map((spec) => buildConfig({ mode: "campaign", level: spec.id }));
  configs.push(buildConfig({ mode: "classic", seed: 20261103 }));

  for (const config of configs) {
    const route = buildRoute(config, 120);
    assert.ok(route.length >= 8, `关卡 ${config.level} 路线过短`);
    let previous = null;
    for (const platform of route) {
      assert.ok(PLATFORM_TYPES.includes(platform.type), `非法平台类型 ${platform.type}`);
      if (platform.type === "goal") {
        assert.equal(platform.width, 260, "终点升降机必须足够宽");
      } else {
        assert.ok(platform.width >= 52 && platform.width <= 132, "平台宽度必须夹在 52..132");
      }
      if (previous) {
        const gap = platform.worldY - previous.worldY;
        assert.ok(gap >= 80 && gap <= 140, `层间距 ${gap} 越界（关卡 ${config.level}）`);
        if (platform.type !== "goal" && previous.type !== "goal") {
          assert.ok(Math.abs(platform.x - previous.x) <= 132, `横向落差 ${Math.abs(platform.x - previous.x)} 超出可达范围`);
        }
        const pair = `${previous.type}->${platform.type}`;
        assert.ok(pair !== "spike->spike", "严禁连续尖刺必死墙");
        assert.ok(pair !== "crumble->crumble", "严禁连续碎裂导致无支撑");
        assert.ok(pair !== "spring->spring", "严禁连续弹簧无限弹射");
      }
      previous = platform;
    }
    if (config.goalFloors > 0) {
      const last = route[route.length - 1];
      assert.equal(last.type, "goal", "关卡终点必须是金盾升降机");
      assert.equal(last.width, 260, "终点升降机必须足够宽");
      const expected = START_Y + config.goalFloors * SPACING;
      assert.ok(
        Math.abs(last.worldY - expected) <= SPACING,
        `终点必须落在目标深度一层以内（实际 ${last.worldY}，目标 ${expected}）`
      );
    }
  }
});

test("engine: classic mode target is floor 100", () => {
  const config = buildConfig({ mode: "classic", seed: 1 });
  assert.equal(config.goalFloors, CLASSIC_FLOORS);
  const state = createState(config);
  assert.equal(state.goalWorldY, START_Y + CLASSIC_FLOORS * SPACING);
  assert.ok(VIEW_W > 0 && VIEW_H > 0);
});

test("engine: endless mode overheats once past floor 100", () => {
  const state = createState(buildConfig({ mode: "endless", seed: 99 }));
  state.depth = 99;
  state.player.grounded = null;
  state.player.y = START_Y + 100 * SPACING;
  state.scrollY = state.player.y - 300;
  stepFrame(state, 1 / 120);
  const events = drainEvents(state);
  assert.equal(state.overheated, true, "破百层必须进入红温");
  assert.ok(events.some((event) => event.type === "overheat"), "必须派发红温事件");
});
