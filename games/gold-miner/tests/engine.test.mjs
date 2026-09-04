import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BOUNDS,
  EMPTY_RETRACT_SPEED,
  GRAB_PAD,
  MIN_HOOK_LENGTH,
  ORIGIN,
  PATROL,
  POTION_MULTIPLIER,
  REEL_FACTOR,
  ROUND_SECONDS,
  SHOOT_STEP,
  STATUS,
  SWING_LIMIT,
  TNT_BLAST_RADIUS,
  applyIntent,
  caughtItem,
  createItem,
  createLevel,
  createState,
  isFieldCleared,
  layoutForLevel,
  stepFrame,
} from "../js/engine.mjs";
import { START_DYNAMITE } from "../js/storage.mjs";

// 可注入 rng：按序返回给定值，用尽后循环。
function rngOf(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}

const stable = { rng: rngOf(0.5) };

function makeState(overrides = {}, options = stable) {
  return createState({ level: 1, money: 0, dynamite: START_DYNAMITE, ...overrides }, options);
}

// 把钢爪摆到正下方并进入指定状态，便于构造抓取场景。
function aimDown(state, hookState) {
  state.hook.angle = Math.PI / 2;
  state.hook.swingSpeed = 0.025;
  state.hook.state = hookState;
  return state;
}

function itemById(state, id) {
  return state.items.find((item) => item.id === id);
}

test("createState：第 1 关铺 10 件矿、目标 1000、60 秒、3 桶炸药", () => {
  const state = makeState();
  assert.equal(state.items.length, 10);
  assert.equal(state.target, 1000);
  assert.equal(state.timeLeft, ROUND_SECONDS);
  assert.equal(state.dynamite, START_DYNAMITE);
  assert.equal(state.status, STATUS.playing);
  assert.equal(state.hook.state, "SWINGING");
  assert.equal(state.hook.length, MIN_HOOK_LENGTH);
  assert.equal(state.hook.caughtId, null);
});

test("layoutForLevel：第 2 关起追加 4 件深层矿", () => {
  assert.equal(layoutForLevel(1).length, 10);
  assert.equal(layoutForLevel(2).length, 14);
  assert.equal(layoutForLevel(9).length, 14);
  assert.equal(createLevel(2, stable).items.length, 14);
});

test("钻石价值：亮油加成 600 → 900，其余类型不受影响", () => {
  const plain = createLevel(1, stable).items;
  const polished = createLevel(1, { rng: rngOf(0.5), polish: true }).items;
  const diamond = (items) => items.find((item) => item.type === "DIAMOND");
  assert.equal(diamond(plain).value, 600);
  assert.equal(diamond(polished).value, 900);
  const gold = (items) => items.find((item) => item.type === "GOLD");
  assert.equal(gold(plain).value, gold(polished).value);
});

test("createItem：形状 6 个顶点，巡逻判定与速度都来自注入的 rng", () => {
  let calls = 0;
  const rng = () => (calls++ < 6 ? 0.5 : 0.9);
  const item = createItem({ x: 100, y: 200, type: "DIAMOND", radius: 12, weight: 0.3 }, 7, {
    level: 3,
    rng,
  });
  assert.equal(item.shape.length, 6);
  assert.equal(item.creature, true);
  assert.ok(item.vx > 0);
  assert.equal(item.id, 7);
  assert.equal(item.collected, false);
});

test("摆动：角度按 swingSpeed 推进，触及摆幅上限即反向", () => {
  const state = makeState();
  state.hook.angle = Math.PI / 2 + SWING_LIMIT - 0.03;
  const before = state.hook.swingSpeed;
  stepFrame(state, stable);
  assert.ok(state.hook.swingSpeed > 0);
  stepFrame(state, stable);
  assert.notEqual(state.hook.swingSpeed, before, "越过上限必须反向");
  assert.ok(state.hook.swingSpeed < 0);
  // 爪尖始终落在锚点极坐标上
  const expectedX = ORIGIN.x + Math.cos(state.hook.angle) * state.hook.length;
  assert.ok(Math.abs(state.hook.x - expectedX) < 1e-9);
});

test("放爪：SWINGING → SHOOTING 并发出 shoot；重复放爪不报错、无效果", () => {
  const state = makeState();
  const first = applyIntent(state, { type: "drop" }, stable);
  assert.equal(first.action, "drop");
  assert.equal(state.hook.state, "SHOOTING");
  assert.deepEqual(first.events.map((e) => e.type), ["shoot"]);

  const second = applyIntent(state, { type: "drop" }, stable);
  assert.equal(second.action, null);
  assert.deepEqual(second.events, []);
});

test("出爪：每帧伸长 SHOOT_STEP，触壁或越界自动转回收", () => {
  const state = aimDown(makeState(), "SHOOTING");
  const length0 = state.hook.length;
  stepFrame(state, stable);
  assert.ok(Math.abs(state.hook.length - (length0 + SHOOT_STEP)) < 1e-9);

  state.hook.length = 700; // 直逼下边界
  const lengthBefore = state.hook.length;
  stepFrame(state, stable);
  assert.ok(Math.abs(state.hook.length - (lengthBefore + SHOOT_STEP)) < 1e-9);
  assert.ok(state.hook.y > BOUNDS.maxY, "爪尖已越过下边界");
  assert.equal(state.hook.state, "RETRACTING");
});

test("抓取：爪尖进入 radius + GRAB_PAD 即 hooked，金矿报 precious", () => {
  const state = aimDown(makeState(), "SHOOTING");
  const gold = state.items.find((item) => item.type === "GOLD");
  gold.x = ORIGIN.x;
  gold.y = 200;
  state.items.forEach((item) => {
    if (item.id !== gold.id) item.x = -999;
  });

  let grabbed = null;
  for (let i = 0; i < 80 && !grabbed; i += 1) {
    const { events } = stepFrame(state, stable);
    grabbed = events.find((event) => event.type === "grab") ?? null;
  }
  assert.ok(grabbed, "钢爪应当抓到金矿");
  assert.equal(grabbed.precious, true);
  assert.equal(state.hook.caughtId, gold.id);
  assert.equal(state.hook.state, "RETRACTING");
  assert.equal(caughtItem(state), gold);
  assert.ok(Math.abs(state.hook.y - gold.y) < gold.radius + GRAB_PAD + SHOOT_STEP);
});

test("TNT：撞上即爆，波及半径内的矿一并清掉，钢爪空手回收", () => {
  const state = aimDown(makeState(), "SHOOTING");
  const tnt = state.items.find((item) => item.type === "TNT");
  const nearby = state.items.find((item) => item.type === "ROCK");
  tnt.x = ORIGIN.x;
  tnt.y = 200;
  nearby.x = ORIGIN.x + TNT_BLAST_RADIUS - 5;
  nearby.y = 200;
  state.items.forEach((item) => {
    if (item.id !== tnt.id && item.id !== nearby.id) item.x = -999;
  });

  let events = [];
  for (let i = 0; i < 80 && state.hook.state === "SHOOTING"; i += 1) {
    events = events.concat(stepFrame(state, stable).events);
  }
  assert.ok(events.some((event) => event.type === "explosion"));
  assert.equal(tnt.collected, true);
  assert.equal(nearby.collected, true, "爆炸半径内的矿应被连锁清掉");
  assert.equal(state.hook.caughtId, null);
  assert.equal(state.hook.state, "RETRACTING");
});

test("回收速度：空爪固定 12，重载 = 8.5 / 重量，生力水再 ×3", () => {
  const state = aimDown(makeState(), "RETRACTING");
  const gold = state.items.find((item) => item.type === "GOLD" && item.weight > 2);
  state.hook.length = 300;
  state.hook.caughtId = gold.id;

  stepFrame(state, stable);
  const plainSpeed = 300 - state.hook.length;
  assert.ok(Math.abs(plainSpeed - REEL_FACTOR / gold.weight) < 1e-9);

  state.potion = true;
  state.hook.length = 300;
  stepFrame(state, stable);
  assert.ok(Math.abs(300 - state.hook.length - (REEL_FACTOR / gold.weight) * POTION_MULTIPLIER) < 1e-9);

  state.hook.caughtId = null;
  state.hook.length = 300;
  stepFrame(state, stable);
  assert.ok(Math.abs(300 - state.hook.length - EMPTY_RETRACT_SPEED) < 1e-9);
});

test("重物跟随爪尖，并抛出扬尘事件", () => {
  const state = aimDown(makeState(), "RETRACTING");
  const gold = state.items.find((item) => item.type === "GOLD");
  state.hook.length = 300;
  state.hook.x = ORIGIN.x;
  state.hook.y = ORIGIN.y + 300;
  state.hook.caughtId = gold.id;

  const { events } = stepFrame(state, stable);
  assert.equal(gold.x, ORIGIN.x, "重物吸附到爪尖移动前的位置");
  assert.equal(gold.y, ORIGIN.y + 300);
  assert.ok(state.hook.length < 300, "爪绳已回收");
  assert.ok(events.some((event) => event.type === "reelDirt"));
});

test("结算入袋：现金累加、矿标记已收、发出 celebrate", () => {
  const state = aimDown(makeState(), "RETRACTING");
  const gold = state.items.find((item) => item.type === "GOLD" && item.value === 250);
  state.hook.length = MIN_HOOK_LENGTH + 1;
  state.hook.caughtId = gold.id;
  const { events } = stepFrame(state, stable);
  assert.equal(state.money, 250);
  assert.equal(gold.collected, true);
  assert.equal(state.hook.caughtId, null);
  assert.equal(state.hook.state, "SWINGING");
  assert.equal(state.hook.length, MIN_HOOK_LENGTH);
  assert.ok(events.some((event) => event.type === "score" && event.amount === 250));
  assert.ok(events.some((event) => event.type === "celebrate"));
  assert.ok(events.some((event) => event.type === "reelStop"));
});

test("神秘袋：40% 现金 / 30% 炸药 / 30% 生力水", () => {
  const setup = () => {
    const state = aimDown(makeState(), "RETRACTING");
    const bag = state.items.find((item) => item.type === "BAG");
    state.hook.length = MIN_HOOK_LENGTH + 1;
    state.hook.caughtId = bag.id;
    return { state, bag };
  };

  const cash = setup();
  stepFrame(cash.state, { rng: rngOf(0.1) });
  assert.equal(cash.state.money, 500);
  assert.equal(cash.bag.collected, true);

  const powder = setup();
  const dynamiteBefore = powder.state.dynamite;
  stepFrame(powder.state, { rng: rngOf(0.55) });
  assert.equal(powder.state.dynamite, dynamiteBefore + 2);
  assert.equal(powder.state.money, 0);

  const potion = setup();
  stepFrame(potion.state, { rng: rngOf(0.9) });
  assert.equal(potion.state.potion, true);
});

test("炸药：仅在拉着东西回收时可用，炸掉重物并扣库存", () => {
  const state = aimDown(makeState(), "RETRACTING");
  const rock = state.items.find((item) => item.type === "ROCK");
  state.hook.caughtId = rock.id;
  const dynamiteBefore = state.dynamite;

  const result = applyIntent(state, { type: "blast" }, stable);
  assert.equal(result.action, "blast");
  assert.equal(state.dynamite, dynamiteBefore - 1);
  assert.equal(rock.collected, true);
  assert.equal(state.hook.caughtId, null);
  assert.ok(result.events.some((event) => event.type === "explosion"));

  // 空爪时按炸药无效但不报错
  const idle = applyIntent(state, { type: "blast" }, stable);
  assert.equal(idle.action, null);

  // 没炸药时给出 deny 事件，交给 UI 提示
  state.hook.caughtId = rock.id;
  state.dynamite = 0;
  rock.collected = false;
  const denied = applyIntent(state, { type: "blast" }, stable);
  assert.equal(denied.action, null);
  assert.deepEqual(denied.events, [{ type: "deny", reason: "noDynamite" }]);
});

test("计时：每秒递减，最后 10 秒发心跳，归零即结算", () => {
  const state = makeState();
  const first = applyIntent(state, { type: "tickSecond" }, stable);
  assert.equal(state.timeLeft, ROUND_SECONDS - 1);
  assert.deepEqual(first.events.map((e) => e.type), ["tick"]);

  state.timeLeft = 11;
  applyIntent(state, { type: "tickSecond" }, stable);
  assert.equal(state.timeLeft, 10);
  const urgent = applyIntent(state, { type: "tickSecond" }, stable);
  assert.ok(urgent.events.some((event) => event.type === "heartbeat"));

  state.timeLeft = 1;
  const last = applyIntent(state, { type: "tickSecond" }, stable);
  assert.equal(state.timeLeft, 0);
  assert.equal(state.status, STATUS.lost, "没凑够目标就是破产");
  assert.ok(last.events.some((event) => event.type === "roundEnd"));
});

test("结算口径：现金达标判 won，未达标判 lost", () => {
  const won = makeState({ money: 1000 });
  applyIntent(won, { type: "tickSecond" }, stable);
  won.timeLeft = 1;
  const result = applyIntent(won, { type: "tickSecond" }, stable);
  assert.equal(won.status, STATUS.won);
  assert.deepEqual(result.events.find((e) => e.type === "roundEnd").status, STATUS.won);

  const lost = makeState({ money: 999 });
  lost.timeLeft = 1;
  applyIntent(lost, { type: "tickSecond" }, stable);
  assert.equal(lost.status, STATUS.lost);
});

test("矿脉清空且钢爪回到摆动位 → 提前结算", () => {
  const state = makeState({ money: 5000 });
  state.items.forEach((item) => {
    item.collected = true;
  });
  assert.equal(isFieldCleared(state), true);
  state.hook.state = "RETRACTING";
  state.hook.length = 300;
  assert.equal(stepFrame(state, stable).events.some((e) => e.type === "roundEnd"), false, "回收途中不结算");
  assert.equal(state.status, STATUS.playing);
  state.hook.state = "SWINGING";
  const { events } = stepFrame(state, stable);
  assert.equal(state.status, STATUS.won);
  assert.ok(events.some((event) => event.type === "roundEnd"));
});

test("暂停：冻结物理与放爪，恢复后继续", () => {
  const state = makeState();
  const paused = applyIntent(state, { type: "togglePause" }, stable);
  assert.equal(state.paused, true);
  assert.deepEqual(paused.events.map((e) => e.type), ["paused", "reelStop"], "暂停要顺带停掉绞盘嗡鸣");

  const angle = state.hook.angle;
  stepFrame(state, stable);
  assert.equal(state.hook.angle, angle, "暂停时钢爪不动");
  assert.equal(applyIntent(state, { type: "drop" }, stable).action, null);
  assert.equal(applyIntent(state, { type: "tickSecond" }, stable).action, null);
  assert.equal(applyIntent(state, { type: "pause" }, stable).action, null, "已暂停时重复 pause 无效果");

  const toggled = applyIntent(state, { type: "togglePause" }, stable);
  assert.equal(state.paused, false, "togglePause 应恢复游戏");
  assert.deepEqual(toggled.events.map((e) => e.type), ["resumed"]);

  applyIntent(state, { type: "pause" }, stable);
  const resumed = applyIntent(state, { type: "resume" }, stable);
  assert.equal(state.paused, false);
  assert.deepEqual(resumed.events.map((e) => e.type), ["resumed"]);
  stepFrame(state, stable);
  assert.notEqual(state.hook.angle, angle);
});

test("商店：只在通关后开放，资金不足给 deny，买到的道具立即生效", () => {
  const state = makeState();
  assert.equal(applyIntent(state, { type: "buy", item: "dynamite" }, stable).action, null, "对局中不开店");

  state.status = STATUS.won;
  state.money = 100;
  const poor = applyIntent(state, { type: "buy", item: "dynamite" }, stable);
  assert.equal(poor.action, null);
  assert.deepEqual(poor.events, [{ type: "deny", reason: "noMoney", item: "dynamite" }]);

  state.money = 1000;
  const dynamiteBefore = state.dynamite;
  const bought = applyIntent(state, { type: "buy", item: "dynamite" }, stable);
  assert.equal(bought.action, "buy");
  assert.equal(state.money, 800);
  assert.equal(state.dynamite, dynamiteBefore + 1);

  applyIntent(state, { type: "buy", item: "potion" }, stable);
  assert.equal(state.potion, true);
  assert.equal(state.money, 520);
  applyIntent(state, { type: "buy", item: "polish" }, stable);
  assert.equal(state.polish, true);
  assert.equal(state.money, 200);

  const unknown = applyIntent(state, { type: "buy", item: "cheat" }, stable);
  assert.equal(unknown.action, null, "未知商品不报错");
});

test("下一关：保留现金与道具，重铺矿脉并重置计时", () => {
  const state = makeState({ money: 4200, dynamite: 7, potion: true, polish: true });
  assert.equal(applyIntent(state, { type: "nextLevel" }, stable).action, null, "未通关不能跳关");

  state.status = STATUS.won;
  const result = applyIntent(state, { type: "nextLevel" }, stable);
  const next = result.state;
  assert.notEqual(next, state, "换关是全新 state");
  assert.equal(next.level, 2);
  assert.equal(next.money, 4200);
  assert.equal(next.dynamite, 7);
  assert.equal(next.potion, true);
  assert.equal(next.polish, true);
  assert.equal(next.timeLeft, ROUND_SECONDS);
  assert.equal(next.target, 1650);
  assert.equal(next.items.length, 14);
  assert.equal(next.status, STATUS.playing);
  assert.ok(result.events.some((event) => event.type === "levelStart" && event.level === 2));
});

test("破产重开：回到第 1 关、现金归零、道具清空", () => {
  const state = makeState({ money: 10, dynamite: 9, potion: true, polish: true, level: 5 });
  assert.equal(applyIntent(state, { type: "restart" }, stable).action, null, "未破产不能重开");

  state.status = STATUS.lost;
  const result = applyIntent(state, { type: "restart" }, stable);
  assert.equal(result.state.level, 1);
  assert.equal(result.state.money, 0);
  assert.equal(result.state.dynamite, START_DYNAMITE);
  assert.equal(result.state.potion, false);
  assert.equal(result.state.polish, false);
  assert.equal(result.state.status, STATUS.playing);
  assert.ok(result.events.some((event) => event.type === "levelStart" && event.level === 1));
});

test("巡逻矿精：在 PATROL 边界内往返，不会跑出矿区", () => {
  let calls = 0;
  const rng = () => (calls++ < 6 ? 0.5 : 0.9); // 让钻石必定成为巡逻生物
  const state = createState({ level: 1 }, { rng });
  const creature = state.items.find((item) => item.creature);
  assert.ok(creature, "应至少生成一只巡逻矿精");

  creature.vx = 5;
  creature.x = PATROL.maxX - 1;
  for (let i = 0; i < 5; i += 1) stepFrame(state, stable);
  assert.ok(creature.vx < 0, "撞到右边界必须反向");
  assert.ok(creature.x <= PATROL.maxX);
  assert.ok(creature.x >= PATROL.minX);
});

test("终局后一切意图都不再改状态，且永不抛错", () => {
  const state = makeState();
  state.status = STATUS.won;
  const intents = [
    { type: "drop" },
    { type: "blast" },
    { type: "tickSecond" },
    { type: "pause" },
    { type: "resume" },
    { type: "togglePause" },
    { type: "restart" },
    { type: "unknown" },
    null,
    undefined,
  ];
  const angle = state.hook.angle;
  for (const intent of intents) {
    const result = applyIntent(state, intent, stable);
    assert.equal(result.action, null);
    assert.equal(result.state, state);
  }
  assert.equal(stepFrame(state, stable).action, null);
  assert.equal(state.hook.angle, angle);
});

test("合法操作永不报错：任意状态 × 全部意图都不抛异常", () => {
  const states = [makeState(), makeState({ money: 5000 }), makeState({ level: 3, dynamite: 0 })];
  const intents = [
    { type: "drop" },
    { type: "blast" },
    { type: "tickSecond" },
    { type: "togglePause" },
    { type: "buy", item: "dynamite" },
    { type: "nextLevel" },
    { type: "restart" },
  ];
  for (const state of states) {
    for (const status of [STATUS.playing, STATUS.won, STATUS.lost]) {
      state.status = status;
      for (const paused of [false, true]) {
        state.paused = paused;
        for (const hookState of ["SWINGING", "SHOOTING", "RETRACTING"]) {
          state.hook.state = hookState;
          for (const intent of intents) {
            assert.doesNotThrow(() => applyIntent(state, intent, stable));
            assert.doesNotThrow(() => stepFrame(state, stable));
          }
        }
      }
    }
  }
});
