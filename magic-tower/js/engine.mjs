// 魔塔：勇者登顶 · 规则引擎（唯一权威，纯函数，严格 DOM-free）
//
// 设计要点：
// 1. 状态不可变：所有 step 返回新 state，楼层贴图走 copy-on-write（只克隆被改动的那一层），
//    因此撤销栈可以低成本保存整份状态引用。
// 2. 零随机：不存在任何 PRNG 调用，同种子同输入的「确定性」在这里退化为纯函数性。
// 3. 合法操作必执行；不可执行的动作返回 action:null 并给出原因，绝不抛错。

import { GRID, MONSTERS, ITEMS, SHOP, START_STATS } from "./data.mjs";

export const CH = Object.freeze({
  WALL: "#",
  FLOOR: ".",
  UP: "^",
  DOWN: "v",
  SEALED: "x",
  DOOR_Y: "Y",
  DOOR_B: "B",
  DOOR_R: "R",
});

const DIRS = Object.freeze([
  { dx: 0, dy: -1, key: "up" },
  { dx: 0, dy: 1, key: "down" },
  { dx: -1, dy: 0, key: "left" },
  { dx: 1, dy: 0, key: "right" },
]);

export const DIR_BY_KEY = Object.freeze({
  up: DIRS[0],
  down: DIRS[1],
  left: DIRS[2],
  right: DIRS[3],
});

const KEY_BY_DOOR = Object.freeze({ Y: "y", B: "b", R: "r" });
const KEY_CHARS = new Set(["y", "b", "r"]);
const COLLECT = new Set(Object.keys(ITEMS));

export function index(x, y) {
  return y * GRID + x;
}

export function pointOf(i) {
  return { x: i % GRID, y: Math.floor(i / GRID) };
}

export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < GRID && y < GRID;
}

export function isMonsterChar(floor, ch) {
  return Object.prototype.hasOwnProperty.call(floor.monsters, ch);
}

export function monsterAt(floor, ch) {
  const id = floor.monsters[ch];
  return id ? MONSTERS[id] : null;
}

export function monsterIdOf(floor, ch) {
  return floor.monsters[ch] || null;
}

// ---------- 建局 ----------

export function createState(levels) {
  const floors = levels.map((level) => ({
    id: level.id,
    zone: level.zone,
    gate: Boolean(level.gate),
    monsters: level.monsters,
    cells: level.rows.join("").split(""),
    visited: level.id === 1,
  }));
  const startIdx = entryIndex(floors[0].cells, CH.DOWN);
  const start = startIdx >= 0 ? pointOf(startIdx) : firstFloorTile(floors[0].cells);
  return {
    floors,
    floor: 1,
    x: start.x,
    y: start.y,
    hp: START_STATS.hp,
    hpMax: START_STATS.hp,
    atk: START_STATS.atk,
    def: START_STATS.def,
    gold: START_STATS.gold,
    keys: { ...START_STATS.keys },
    flags: { thief: false, cross: false, compass: false },
    shopBuys: {},
    stats: { steps: 0, battles: 0, damageTaken: 0, goldEarned: 0, slain: 0, floorsSeen: 1 },
    status: "playing",
    ending: null,
  };
}

function firstFloorTile(cells) {
  const i = cells.indexOf(CH.FLOOR);
  return pointOf(i < 0 ? index(5, 5) : i);
}

export function entryIndex(cells, ch) {
  return cells.indexOf(ch);
}

export function currentFloor(state) {
  return state.floors[state.floor - 1];
}

export function cellAt(state, x, y) {
  if (!inBounds(x, y)) return CH.WALL;
  return currentFloor(state).cells[index(x, y)];
}

// ---------- 战斗数学 ----------

// 透明伤害公式（唯一口径）：
//   勇者每击 = atk - monDef（<=0 视为无法破防）
//   回合数   = ceil(monHp / perHit)
//   战损     = (回合数 - 1) * max(0, monAtk - def)      —— 勇者先攻，一击必杀零战损
export function battlePreview(hero, monster) {
  if (!monster) return null;
  const perHit = hero.atk - monster.def;
  if (perHit <= 0) {
    return { blocked: true, perHit: 0, turns: Infinity, perHitTaken: Math.max(0, monster.atk - hero.def), damage: Infinity, canWin: false };
  }
  const turns = Math.ceil(monster.hp / perHit);
  const perHitTaken = Math.max(0, monster.atk - hero.def);
  const damage = (turns - 1) * perHitTaken;
  return { blocked: false, perHit, turns, perHitTaken, damage, canWin: damage < hero.hp };
}

// 雷达分级：clear(零战损) / hurt(可打) / fatal(不可打)
export function threatOf(preview) {
  if (!preview || !preview.canWin) return "fatal";
  if (preview.damage <= 0) return "clear";
  return "hurt";
}

// ---------- 可通行性 ----------

export function isWalkable(state, cells, ch) {
  if (ch === CH.WALL) return false;
  if (ch === CH.SEALED) return state.flags.thief;
  if (KEY_BY_DOOR[ch]) return false;
  if (KEY_CHARS.has(ch)) return true;
  if (COLLECT.has(ch)) return true;
  return ch === CH.FLOOR || ch === CH.UP || ch === CH.DOWN;
}

// 从勇者脚下 BFS 可达区域（只穿过空地/道具/楼梯），返回 Uint8Array(121)
export function reachableMask(state, floorNo = state.floor) {
  const floor = state.floors[floorNo - 1];
  const start = floorNo === state.floor ? index(state.x, state.y) : entryIndex(floor.cells, CH.DOWN);
  const mask = new Uint8Array(GRID * GRID);
  if (start < 0) return mask;
  const queue = [start];
  mask[start] = 1;
  while (queue.length) {
    const cur = queue.shift();
    const { x, y } = pointOf(cur);
    for (const dir of DIRS) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (!inBounds(nx, ny)) continue;
      const ni = index(nx, ny);
      if (mask[ni]) continue;
      if (!isWalkable(state, floor.cells, floor.cells[ni])) continue;
      mask[ni] = 1;
      queue.push(ni);
    }
  }
  return mask;
}

// 单步方向 → 结果判定，供 UI 悬停提示与引擎共用
export function probe(state, dx, dy) {
  const nx = state.x + dx;
  const ny = state.y + dy;
  if (!inBounds(nx, ny)) return { kind: "wall" };
  const floor = currentFloor(state);
  const ch = floor.cells[index(nx, ny)];
  if (ch === CH.WALL) return { kind: "wall" };
  if (ch === CH.SEALED && !state.flags.thief) return { kind: "sealed" };
  if (KEY_BY_DOOR[ch]) {
    const color = KEY_BY_DOOR[ch];
    const has = state.keys[color] > 0;
    return { kind: "door", color, open: has };
  }
  if (isMonsterChar(floor, ch)) {
    const id = monsterIdOf(floor, ch);
    const preview = battlePreview(state, MONSTERS[id]);
    return { kind: "monster", id, preview, threat: threatOf(preview) };
  }
  if (ch === "Z") return { kind: "princess" };
  if (ch === "M") return { kind: "shop" };
  return { kind: "walk" };
}

// ---------- 路径 ----------

// BFS 最短路径（只穿可行走格），返回方向 key 数组；目标不可达返回 null
export function findPath(state, tx, ty) {
  if (!inBounds(tx, ty)) return null;
  const floor = currentFloor(state);
  const target = index(tx, ty);
  if (!isWalkable(state, floor.cells, floor.cells[target])) return null;
  const from = index(state.x, state.y);
  if (from === target) return [];
  const prev = new Int16Array(GRID * GRID).fill(-1);
  const seen = new Uint8Array(GRID * GRID);
  seen[from] = 1;
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === target) break;
    const { x, y } = pointOf(cur);
    for (const dir of DIRS) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (!inBounds(nx, ny)) continue;
      const ni = index(nx, ny);
      if (seen[ni]) continue;
      if (ni !== target && !isWalkable(state, floor.cells, floor.cells[ni])) continue;
      if (ni === target && !isWalkable(state, floor.cells, floor.cells[ni])) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  if (!seen[target]) return null;
  const steps = [];
  let cur = target;
  while (cur !== from) {
    const p = prev[cur];
    if (p < 0) return null;
    const a = pointOf(p);
    const b = pointOf(cur);
    const dir = DIRS.find((d) => a.x + d.dx === b.x && a.y + d.dy === b.y);
    if (!dir) return null;
    steps.push(dir.key);
    cur = p;
  }
  return steps.reverse();
}

// ---------- 状态迁移 ----------

function cloneCells(state, floorNo, changes) {
  const floors = state.floors.slice();
  const floor = floors[floorNo - 1];
  const cells = floor.cells.slice();
  for (const [i, ch] of changes) cells[i] = ch;
  floors[floorNo - 1] = { ...floor, cells, visited: true };
  return floors;
}

function shopKey(floorNo) {
  return `f${floorNo}`;
}

export function shopPurchaseCount(state, floorNo, kind) {
  const row = state.shopBuys[shopKey(floorNo)];
  return row ? row[kind] || 0 : 0;
}

export function shopPrice(state, floorNo, kind) {
  const conf = SHOP[kind];
  if (!conf) return Infinity;
  return conf.base + conf.step * shopPurchaseCount(state, floorNo, kind);
}

export function shopOptions(state, floorNo = state.floor) {
  return ["hp", "atk", "def"].map((kind) => ({
    kind,
    amount: SHOP[kind].amount,
    price: shopPrice(state, floorNo, kind),
    affordable: state.gold >= shopPrice(state, floorNo, kind),
    bought: shopPurchaseCount(state, floorNo, kind),
  }));
}

const EMPTY = Object.freeze({ state: null, action: null, events: [] });

function fail(state, reason) {
  return { state, action: null, events: [{ type: "blocked", reason }] };
}

function gainItem(state, ch) {
  const effect = ITEMS[ch];
  const events = [];
  const next = { ...state };
  if (effect.gold) {
    next.gold = state.gold + effect.gold;
    next.stats = { ...state.stats, goldEarned: state.stats.goldEarned + effect.gold };
    events.push({ type: "pickup", item: "g", kind: "gold", amount: effect.gold });
  }
  if (effect.hp) {
    next.hp = state.hp + effect.hp;
    next.hpMax = state.hpMax + effect.hp;
    events.push({ type: "pickup", item: "p", kind: "hp", amount: effect.hp });
  }
  if (effect.atk) {
    next.atk = state.atk + effect.atk;
    events.push({ type: "pickup", item: "a", kind: "atk", amount: effect.atk });
  }
  if (effect.def) {
    next.def = state.def + effect.def;
    events.push({ type: "pickup", item: "d", kind: "def", amount: effect.def });
  }
  if (effect.cross) {
    next.flags = { ...state.flags, cross: true };
    events.push({ type: "flag", flag: "cross" });
  }
  if (effect.compass) {
    next.flags = { ...state.flags, compass: true };
    events.push({ type: "flag", flag: "compass" });
  }
  if (effect.thief) {
    next.flags = { ...state.flags, thief: true };
    events.push({ type: "flag", flag: "thief" });
  }
  return { state: next, events };
}

// 勇者落到某格后的结算：拾取 / 上楼 / 下楼 / 公主 / 商店
function resolveLanding(state, floorNo, cellIndex) {
  const floor = state.floors[floorNo - 1];
  const ch = floor.cells[cellIndex];
  let s = state;
  const events = [];

  if (KEY_CHARS.has(ch)) {
    const color = ch;
    const s2 = {
      ...s,
      keys: { ...s.keys, [color]: s.keys[color] + 1 },
      floors: cloneCells(s, floorNo, [[cellIndex, CH.FLOOR]]),
    };
    return { state: s2, events: [{ type: "pickup", item: "k", kind: "key", color, amount: 1 }] };
  }

  if (COLLECT.has(ch) && ch !== "M" && ch !== "Z") {
    const gained = gainItem(s, ch);
    s = { ...gained.state, floors: cloneCells(s, floorNo, [[cellIndex, CH.FLOOR]]) };
    events.push(...gained.events);
    return { state: s, events };
  }

  if (ch === "Z") {
    s = { ...s, status: "victory", ending: "true" };
    events.push({ type: "victory", ending: "true" });
    return { state: s, events };
  }

  if (ch === CH.UP) {
    const target = floorNo + 1;
    if (target > s.floors.length) return fail(s, "top");
    const upFloor = s.floors[target - 1];
    const entry = entryIndex(upFloor.cells, CH.DOWN);
    if (entry < 0) return fail(s, "top");
    const p = pointOf(entry);
    const s2 = {
      ...s,
      floor: target,
      x: p.x,
      y: p.y,
      floors: markVisited(s.floors, target),
      stats: { ...s.stats, floorsSeen: Math.max(s.stats.floorsSeen, target) },
    };
    events.push({ type: "stairs", dir: "up", to: target });
    return { state: s2, events };
  }

  if (ch === CH.DOWN) {
    const target = floorNo - 1;
    if (target < 1) return fail(s, "bottom");
    const downFloor = s.floors[target - 1];
    const entry = entryIndex(downFloor.cells, CH.UP);
    if (entry < 0) return fail(s, "bottom");
    const p = pointOf(entry);
    events.push({ type: "stairs", dir: "down", to: target });
    return { state: { ...s, floor: target, x: p.x, y: p.y, floors: markVisited(s.floors, target) }, events };
  }

  return { state: s, events };
}

function markVisited(floors, floorNo) {
  const floor = floors[floorNo - 1];
  if (floor.visited) return floors;
  const next = floors.slice();
  next[floorNo - 1] = { ...floor, visited: true };
  return next;
}

export function step(state, intent) {
  if (!state || state.status !== "playing" || !intent) return { state, action: null, events: [] };
  switch (intent.type) {
    case "move":
      return moveBy(state, intent.dx, intent.dy);
    case "buy":
      return buy(state, intent.kind);
    case "travel":
      return travel(state, intent.floor);
    case "use": {
      // 站在楼梯/公主格上主动使用（例如刚落地还没抬脚，想立刻再上/下一层）
      const landed = resolveLanding(state, state.floor, index(state.x, state.y));
      if (!landed.state) return fail(state, landed.events[0]?.reason || "blocked");
      return { state: landed.state, action: { type: "use" }, events: landed.events };
    }
    default:
      return { state, action: null, events: [] };
  }
}

function moveBy(state, dx, dy) {
  const nx = state.x + dx;
  const ny = state.y + dy;
  if (!inBounds(nx, ny)) return fail(state, "wall");
  const floorNo = state.floor;
  const floor = state.floors[floorNo - 1];
  const i = index(nx, ny);
  const ch = floor.cells[i];
  const base = { ...state, stats: { ...state.stats, steps: state.stats.steps + 1 } };

  if (ch === CH.WALL) return fail(state, "wall");
  if (ch === CH.SEALED && !state.flags.thief) return fail(state, "sealed");
  if (KEY_BY_DOOR[ch]) {
    const color = KEY_BY_DOOR[ch];
    if (state.keys[color] <= 0) return fail(state, "locked");
    const s = {
      ...base,
      keys: { ...state.keys, [color]: state.keys[color] - 1 },
      floors: cloneCells(state, floorNo, [[i, CH.FLOOR]]),
    };
    return { state: s, action: { type: "open", color }, events: [{ type: "door", color }] };
  }
  if (isMonsterChar(floor, ch)) {
    const id = monsterIdOf(floor, ch);
    const mon = MONSTERS[id];
    const preview = battlePreview(state, mon);
    if (preview.blocked) return fail(state, "armor");
    if (!preview.canWin) return fail(state, "mortal");
    const s = {
      ...base,
      hp: state.hp - preview.damage,
      gold: state.gold + mon.gold,
      x: nx,
      y: ny,
      floors: cloneCells(state, floorNo, [[i, CH.FLOOR]]),
      stats: {
        ...base.stats,
        battles: state.stats.battles + 1,
        damageTaken: state.stats.damageTaken + preview.damage,
        goldEarned: state.stats.goldEarned + mon.gold,
        slain: state.stats.slain + 1,
      },
    };
    const events = [{ type: "battle", id, damage: preview.damage, gold: mon.gold, turns: preview.turns }];
    if (floor.gate && !state.flags.cross) {
      const s2 = { ...s, status: "victory", ending: "normal" };
      events.push({ type: "victory", ending: "normal" });
      return { state: s2, action: { type: "battle", id }, events };
    }
    return { state: s, action: { type: "battle", id }, events };
  }

  const landed = resolveLanding({ ...base, x: nx, y: ny }, floorNo, i);
  if (!landed.state) return fail(state, landed.events[0]?.reason || "blocked");
  return { state: landed.state, action: { type: "walk" }, events: landed.events };
}

function buy(state, kind) {
  const conf = SHOP[kind];
  if (!conf) return { state, action: null, events: [] };
  const floorNo = state.floor;
  const price = shopPrice(state, floorNo, kind);
  if (state.gold < price) return fail(state, "poor");
  const key = shopKey(floorNo);
  const row = { ...(state.shopBuys[key] || {}) };
  row[kind] = (row[kind] || 0) + 1;
  const next = {
    ...state,
    gold: state.gold - price,
    shopBuys: { ...state.shopBuys, [key]: row },
    stats: { ...state.stats },
  };
  if (kind === "hp") {
    next.hp = state.hp + conf.amount;
    next.hpMax = state.hpMax + conf.amount;
  } else if (kind === "atk") {
    next.atk = state.atk + conf.amount;
  } else {
    next.def = state.def + conf.amount;
  }
  return { state: next, action: { type: "buy", kind, price }, events: [{ type: "buy", kind, price, amount: conf.amount }] };
}

function travel(state, floorNo) {
  if (!state.flags.compass) return fail(state, "no-compass");
  if (!Number.isInteger(floorNo) || floorNo < 1 || floorNo > state.floors.length) return fail(state, "invalid");
  const floor = state.floors[floorNo - 1];
  if (!floor.visited) return fail(state, "unvisited");
  if (floorNo === state.floor) return { state, action: null, events: [] };
  const entry = entryIndex(floor.cells, floorNo === 1 ? CH.DOWN : CH.UP) >= 0
    ? entryIndex(floor.cells, floorNo === 1 ? CH.DOWN : CH.UP)
    : entryIndex(floor.cells, floorNo === 1 ? CH.UP : CH.DOWN);
  const p = entry >= 0 ? pointOf(entry) : pointOf(firstFloorTileIndex(floor.cells));
  const next = {
    ...state,
    floor: floorNo,
    x: p.x,
    y: p.y,
    stats: { ...state.stats, steps: state.stats.steps + 1 },
  };
  return { state: next, action: { type: "travel", floor: floorNo }, events: [{ type: "stairs", dir: "travel", to: floorNo }] };
}

function firstFloorTileIndex(cells) {
  const i = cells.indexOf(CH.FLOOR);
  return i < 0 ? index(5, 5) : i;
}

// ---------- 查询辅助（UI / 测试共用） ----------

export function floorMonsters(state, floorNo = state.floor) {
  const floor = state.floors[floorNo - 1];
  const counts = new Map();
  for (const ch of floor.cells) {
    if (!isMonsterChar(floor, ch)) continue;
    const id = monsterIdOf(floor, ch);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()].map(([id, count]) => {
    const mon = MONSTERS[id];
    const preview = battlePreview(state, mon);
    return { id, count, mon, preview, threat: threatOf(preview) };
  });
}

export function floorItemCount(state, floorNo = state.floor) {
  const floor = state.floors[floorNo - 1];
  const tally = { gold: 0, hp: 0, atk: 0, def: 0, keys: 0 };
  for (const ch of floor.cells) {
    const eff = ITEMS[ch];
    if (!eff) {
      if (ch === "y" || ch === "b" || ch === "r") tally.keys += 1;
      continue;
    }
    if (eff.gold) tally.gold += eff.gold;
    if (eff.hp) tally.hp += eff.hp;
    if (eff.atk) tally.atk += eff.atk;
    if (eff.def) tally.def += eff.def;
  }
  return tally;
}

export function hasRemainingGoal(state) {
  return state.status === "playing";
}

// ---------- 存档快照 ----------

export function toSnapshot(state) {
  return {
    floor: state.floor,
    x: state.x,
    y: state.y,
    hp: state.hp,
    hpMax: state.hpMax,
    atk: state.atk,
    def: state.def,
    gold: state.gold,
    keys: { ...state.keys },
    flags: { ...state.flags },
    shopBuys: { ...state.shopBuys },
    stats: { ...state.stats },
    status: state.status,
    ending: state.ending,
    floors: state.floors.map((f) => ({ cells: f.cells.join(""), visited: f.visited })),
  };
}

export function fromSnapshot(snap, levels) {
  if (!snap || !Array.isArray(snap.floors) || snap.floors.length !== levels.length) return null;
  const fresh = createState(levels);
  const floors = snap.floors.map((f, i) => ({
    ...fresh.floors[i],
    cells: String(f.cells || "").length === GRID * GRID ? String(f.cells).split("") : fresh.floors[i].cells,
    visited: Boolean(f.visited),
  }));
  const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
  const floor = Math.min(Math.max(Math.round(num(snap.floor, 1)), 1), levels.length);
  const p = { x: Math.round(num(snap.x, 1)), y: Math.round(num(snap.y, 1)) };
  const safe = inBounds(p.x, p.y) ? p : { x: 1, y: 1 };
  return {
    ...fresh,
    floors,
    floor,
    x: safe.x,
    y: safe.y,
    hp: Math.max(1, Math.round(num(snap.hp, fresh.hp))),
    hpMax: Math.max(1, Math.round(num(snap.hpMax, fresh.hpMax))),
    atk: Math.max(1, Math.round(num(snap.atk, fresh.atk))),
    def: Math.max(0, Math.round(num(snap.def, fresh.def))),
    gold: Math.max(0, Math.round(num(snap.gold, 0))),
    keys: {
      y: Math.max(0, Math.round(num(snap.keys?.y, 0))),
      b: Math.max(0, Math.round(num(snap.keys?.b, 0))),
      r: Math.max(0, Math.round(num(snap.keys?.r, 0))),
    },
    flags: { thief: Boolean(snap.flags?.thief), cross: Boolean(snap.flags?.cross), compass: Boolean(snap.flags?.compass) },
    shopBuys: snap.shopBuys && typeof snap.shopBuys === "object" ? { ...snap.shopBuys } : {},
    stats: {
      steps: Math.max(0, Math.round(num(snap.stats?.steps, 0))),
      battles: Math.max(0, Math.round(num(snap.stats?.battles, 0))),
      damageTaken: Math.max(0, Math.round(num(snap.stats?.damageTaken, 0))),
      goldEarned: Math.max(0, Math.round(num(snap.stats?.goldEarned, 0))),
      slain: Math.max(0, Math.round(num(snap.stats?.slain, 0))),
      floorsSeen: Math.min(levels.length, Math.max(1, Math.round(num(snap.stats?.floorsSeen, 1)))),
    },
    status: snap.status === "victory" || snap.status === "defeat" ? snap.status : "playing",
    ending: snap.ending === "true" || snap.ending === "normal" ? snap.ending : null,
  };
}

export { DIRS, KEY_BY_DOOR };
