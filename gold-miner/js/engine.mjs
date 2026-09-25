// engine：黄金矿工规则唯一权威，DOM-free。
// 每帧调用 stepFrame，离散操作走 applyIntent；两者都返回 { state, events, action }。
// action === null 表示"这一步没生效"，合法操作永不抛错。
// rng 可注入（默认 Math.random），关卡生成与神秘袋因此可测。
// 状态为就地修改：引擎是唯一写入方，页面/渲染层不得旁路改 state。

import { bagPrize, diamondValue, isRoundWon, shopCost, targetForLevel } from "./score.mjs";
import { START_DYNAMITE, START_LEVEL } from "./storage.mjs";

export const CANVAS = Object.freeze({ width: 800, height: 600 });
export const ORIGIN = Object.freeze({ x: 400, y: 52 });
export const BOUNDS = Object.freeze({ minX: 15, maxX: 785, maxY: 585 });
export const PATROL = Object.freeze({ minX: 80, maxX: 720 });

export const MIN_HOOK_LENGTH = 42;
export const SWING_SPEED = 0.025;
export const SWING_LIMIT = 1.25;
export const SHOOT_STEP = 6.5;
export const GRAB_PAD = 8;
export const EMPTY_RETRACT_SPEED = 12;
export const REEL_FACTOR = 8.5;
export const POTION_MULTIPLIER = 3;
export const TNT_BLAST_RADIUS = 110;
export const ROUND_SECONDS = 60;

export const HOOK_STATES = Object.freeze(["SWINGING", "SHOOTING", "RETRACTING"]);
export const ITEM_TYPES = Object.freeze(["GOLD", "DIAMOND", "BAG", "TNT", "ROCK"]);
export const STATUS = Object.freeze({ playing: "playing", won: "won", lost: "lost" });

// 每关固定基础矿脉（价值/重量/半径照搬原版，钻石价值按亮油加成在生成时决定）。
const BASE_LAYOUT = Object.freeze([
  Object.freeze({ x: 180, y: 220, type: "GOLD", value: 250, radius: 22, weight: 1.2 }),
  Object.freeze({ x: 620, y: 280, type: "GOLD", value: 500, radius: 32, weight: 2.6 }),
  Object.freeze({ x: 360, y: 460, type: "GOLD", value: 100, radius: 16, weight: 0.8 }),
  Object.freeze({ x: 680, y: 480, type: "GOLD", value: 350, radius: 26, weight: 1.8 }),
  Object.freeze({ x: 450, y: 210, type: "DIAMOND", radius: 12, weight: 0.3 }),
  Object.freeze({ x: 220, y: 380, type: "BAG", value: 0, radius: 18, weight: 1 }),
  Object.freeze({ x: 310, y: 310, type: "TNT", value: 0, radius: 18, weight: 0.5 }),
  Object.freeze({ x: 260, y: 360, type: "ROCK", value: 20, radius: 28, weight: 3.8 }),
  Object.freeze({ x: 490, y: 420, type: "ROCK", value: 30, radius: 36, weight: 5 }),
  Object.freeze({ x: 130, y: 450, type: "ROCK", value: 25, radius: 32, weight: 4.4 }),
]);

// 第 2 关起追加：更值钱的巨金、第二颗钻石、第二桶炸药与第二个神秘袋。
const DEEP_LAYOUT = Object.freeze([
  Object.freeze({ x: 200, y: 520, type: "DIAMOND", radius: 12, weight: 0.3 }),
  Object.freeze({ x: 530, y: 220, type: "GOLD", value: 750, radius: 40, weight: 3.8 }),
  Object.freeze({ x: 590, y: 440, type: "TNT", value: 0, radius: 18, weight: 0.5 }),
  Object.freeze({ x: 390, y: 360, type: "BAG", value: 0, radius: 18, weight: 1 }),
]);

export function layoutForLevel(level) {
  return level >= 2 ? [...BASE_LAYOUT, ...DEEP_LAYOUT] : [...BASE_LAYOUT];
}

// 不规则多边形轮廓：6 个顶点，半径在 0.8~1.2 倍之间抖动。
export function createRandomShape(baseRadius, rng = Math.random) {
  const points = 6;
  const shape = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const r = baseRadius * (0.8 + rng() * 0.4);
    shape.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return shape;
}

export function createItem(spec, index, { level, rng = Math.random, polish = false } = {}) {
  const isDiamond = spec.type === "DIAMOND";
  return {
    id: index,
    x: spec.x,
    y: spec.y,
    radius: spec.radius,
    type: spec.type,
    value: isDiamond ? diamondValue(polish) : (spec.value ?? 0),
    weight: spec.weight,
    shape: createRandomShape(spec.radius, rng),
    collected: false,
    // 钻石有一半概率是会左右巡逻的"矿精"
    creature: isDiamond && rng() > 0.5,
    vx: (rng() > 0.5 ? 1 : -1) * (0.8 + level * 0.1),
  };
}

export function createHook() {
  return {
    x: ORIGIN.x,
    y: ORIGIN.y,
    angle: Math.PI / 2,
    swingSpeed: SWING_SPEED,
    length: MIN_HOOK_LENGTH,
    state: "SWINGING",
    caughtId: null,
  };
}

function placeHook(hook) {
  hook.x = ORIGIN.x + Math.cos(hook.angle) * hook.length;
  hook.y = ORIGIN.y + Math.sin(hook.angle) * hook.length;
}

export function createLevel(level, { rng = Math.random, polish = false } = {}) {
  const layout = layoutForLevel(level);
  return {
    items: layout.map((spec, index) => createItem(spec, index, { level, rng, polish })),
    target: targetForLevel(level),
    timeLeft: ROUND_SECONDS,
  };
}

// 一局的可变状态。run = 跨关卡携带的资产（现金 / 炸药 / 道具）。
export function createState(run = {}, { rng = Math.random } = {}) {
  const level = Math.max(START_LEVEL, Math.trunc(Number(run.level) || START_LEVEL));
  const money = Math.max(0, Math.trunc(Number(run.money) || 0));
  const dynamite = Math.max(0, Math.trunc(Number.isFinite(run.dynamite) ? run.dynamite : START_DYNAMITE));
  const potion = Boolean(run.potion);
  const polish = Boolean(run.polish);
  const { items, target, timeLeft } = createLevel(level, { rng, polish });
  const hook = createHook();
  placeHook(hook);
  return {
    level,
    money,
    dynamite,
    potion,
    polish,
    target,
    timeLeft,
    items,
    hook,
    status: STATUS.playing,
    paused: false,
  };
}

export function caughtItem(state) {
  if (state.hook.caughtId === null) return null;
  return state.items.find((item) => item.id === state.hook.caughtId) ?? null;
}

export function uncollectedItems(state) {
  return state.items.filter((item) => !item.collected);
}

export function isFieldCleared(state) {
  return state.items.every((item) => item.collected);
}

export function isRunning(state) {
  return state.status === STATUS.playing && !state.paused;
}

function endRound(state, events) {
  if (state.status !== STATUS.playing) return;
  state.status = isRoundWon(state.money, state.target) ? STATUS.won : STATUS.lost;
  state.hook.caughtId = null;
  events.push({ type: "roundEnd", status: state.status, money: state.money, target: state.target });
}

// 时间归零，或矿脉清空且钢爪已回到摆动位 → 结算本关。
function checkRoundEnd(state, events) {
  if (state.status !== STATUS.playing) return;
  if (state.timeLeft <= 0 || (isFieldCleared(state) && state.hook.state === "SWINGING")) endRound(state, events);
}

function patrolCreatures(state) {
  for (const item of state.items) {
    if (!item.creature || item.collected) continue;
    item.x += item.vx;
    if (item.x < PATROL.minX || item.x > PATROL.maxX) {
      item.vx *= -1;
      item.x = Math.min(PATROL.maxX, Math.max(PATROL.minX, item.x));
    }
  }
}

function explodeTNT(state, tnt, events) {
  tnt.collected = true;
  events.push({ type: "explosion", x: tnt.x, y: tnt.y, power: 60 });
  for (const item of state.items) {
    if (item.collected || item.id === tnt.id) continue;
    if (Math.hypot(item.x - tnt.x, item.y - tnt.y) < TNT_BLAST_RADIUS) {
      item.collected = true;
      events.push({ type: "explosion", x: item.x, y: item.y, power: 25 });
    }
  }
  state.hook.caughtId = null;
  state.hook.state = "RETRACTING";
}

function settleCatch(state, { rng }, events) {
  const item = caughtItem(state);
  if (!item) return;
  if (item.type === "BAG") {
    const prize = bagPrize(rng);
    if (prize.kind === "money") state.money += prize.amount;
    else if (prize.kind === "dynamite") state.dynamite += prize.amount;
    else state.potion = true;
    events.push({ type: "bag", prize, money: state.money, dynamite: state.dynamite });
  } else {
    state.money += item.value;
    events.push({ type: "score", amount: item.value, money: state.money, itemType: item.type });
  }
  item.collected = true;
  state.hook.caughtId = null;
  events.push({ type: "celebrate" });
}

// 每帧推进：巡逻生物 → 钢爪状态机 → 结算判定。暂停或已结算时原样返回。
export function stepFrame(state, { rng = Math.random } = {}) {
  const events = [];
  if (!isRunning(state)) return { state, events, action: null };

  patrolCreatures(state);

  const hook = state.hook;
  const previous = hook.state;

  if (hook.state === "SWINGING") {
    hook.angle += hook.swingSpeed;
    if (Math.abs(hook.angle - Math.PI / 2) > SWING_LIMIT) hook.swingSpeed = -hook.swingSpeed;
    placeHook(hook);
  } else if (hook.state === "SHOOTING") {
    hook.length += SHOOT_STEP;
    placeHook(hook);
    if (hook.x < BOUNDS.minX || hook.x > BOUNDS.maxX || hook.y > BOUNDS.maxY) {
      hook.state = "RETRACTING";
    } else {
      for (const item of state.items) {
        if (item.collected) continue;
        if (Math.hypot(hook.x - item.x, hook.y - item.y) >= item.radius + GRAB_PAD) continue;
        if (item.type === "TNT") {
          explodeTNT(state, item, events);
        } else {
          hook.caughtId = item.id;
          hook.state = "RETRACTING";
          events.push({
            type: "grab",
            itemType: item.type,
            precious: item.type === "GOLD" || item.type === "DIAMOND",
          });
        }
        break;
      }
    }
  } else if (hook.state === "RETRACTING") {
    const carried = caughtItem(state);
    const multiplier = state.potion ? POTION_MULTIPLIER : 1;
    const speed = carried ? Math.max(1, (REEL_FACTOR / carried.weight) * multiplier) : EMPTY_RETRACT_SPEED;
    hook.length -= speed;
    if (carried) {
      carried.x = hook.x;
      carried.y = hook.y;
      events.push({ type: "reelDirt", x: hook.x, y: hook.y, boosted: state.potion });
    }
    placeHook(hook);
    if (hook.length <= MIN_HOOK_LENGTH) {
      hook.length = MIN_HOOK_LENGTH;
      hook.state = "SWINGING";
      settleCatch(state, { rng }, events);
    }
  }

  if (previous === "RETRACTING" && hook.state !== "RETRACTING") events.push({ type: "reelStop" });
  if (previous !== "RETRACTING" && hook.state === "RETRACTING") events.push({ type: "reelStart" });

  checkRoundEnd(state, events);
  return { state, events, action: "step" };
}

export function applyIntent(state, intent, { rng = Math.random } = {}) {
  const events = [];
  const type = intent?.type;

  if (type === "pause" || type === "resume" || type === "togglePause") {
    if (state.status !== STATUS.playing) return { state, events, action: null };
    const next = type === "togglePause" ? !state.paused : type === "pause";
    if (next === state.paused) return { state, events, action: null };
    state.paused = next;
    events.push({ type: next ? "paused" : "resumed" });
    if (next) events.push({ type: "reelStop" });
    return { state, events, action: type };
  }

  // 商店只在通关结算后开放；资金不足不报错，交给 UI 提示。
  if (type === "buy") {
    if (state.status !== STATUS.won) return { state, events, action: null };
    const cost = shopCost(intent.item);
    if (!Number.isFinite(cost) || state.money < cost) {
      events.push({ type: "deny", reason: "noMoney", item: intent.item });
      return { state, events, action: null };
    }
    state.money -= cost;
    if (intent.item === "dynamite") state.dynamite += 1;
    else if (intent.item === "potion") state.potion = true;
    else if (intent.item === "polish") state.polish = true;
    events.push({ type: "buy", item: intent.item, cost, money: state.money, dynamite: state.dynamite });
    return { state, events, action: "buy" };
  }

  if (type === "nextLevel") {
    if (state.status !== STATUS.won) return { state, events, action: null };
    const next = beginLevel(state, state.level + 1, { rng });
    events.push({ type: "levelStart", level: next.level, target: next.target });
    return { state: next, events, action: "nextLevel" };
  }

  if (type === "restart") {
    if (state.status !== STATUS.lost) return { state, events, action: null };
    const fresh = createState(
      { level: START_LEVEL, money: 0, dynamite: START_DYNAMITE, potion: false, polish: false },
      { rng },
    );
    events.push({ type: "levelStart", level: fresh.level, target: fresh.target });
    return { state: fresh, events, action: "restart" };
  }

  if (!isRunning(state)) return { state, events, action: null };

  if (type === "drop") {
    if (state.hook.state !== "SWINGING") return { state, events, action: null };
    state.hook.state = "SHOOTING";
    events.push({ type: "shoot" });
    return { state, events, action: "drop" };
  }

  // 炸药只在"拉着东西回收"时可用：炸掉重物换回空爪速度。
  if (type === "blast") {
    if (state.hook.state !== "RETRACTING" || state.hook.caughtId === null) return { state, events, action: null };
    if (state.dynamite <= 0) {
      events.push({ type: "deny", reason: "noDynamite" });
      return { state, events, action: null };
    }
    state.dynamite -= 1;
    const carried = caughtItem(state);
    if (carried) carried.collected = true;
    state.hook.caughtId = null;
    state.hook.state = "RETRACTING";
    events.push({ type: "explosion", x: state.hook.x, y: state.hook.y, power: 45 });
    events.push({ type: "blast", dynamite: state.dynamite });
    return { state, events, action: "blast" };
  }

  if (type === "tickSecond") {
    if (state.status !== STATUS.playing || state.paused) return { state, events, action: null };
    if (state.timeLeft > 0) {
      state.timeLeft -= 1;
      events.push({ type: "tick", timeLeft: state.timeLeft });
      if (state.timeLeft <= 10 && state.timeLeft > 0) events.push({ type: "heartbeat", timeLeft: state.timeLeft });
    }
    checkRoundEnd(state, events);
    return { state, events, action: "tickSecond" };
  }

  return { state, events, action: null };
}

// 进入下一关：保留现金 / 炸药 / 道具，重铺矿脉与计时。
export function beginLevel(state, level, { rng = Math.random } = {}) {
  const next = createState(
    { level, money: state.money, dynamite: state.dynamite, potion: state.potion, polish: state.polish },
    { rng },
  );
  return next;
}
