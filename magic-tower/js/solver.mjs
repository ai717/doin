// 魔塔：勇者登顶 · 确定性求解器（纯函数，DOM-free）
//
// 用途有两个：
//   1. 单测里跑完整 24 层，把「100% 可通关」变成可执行断言，而不是口头保证；
//   2. 开发期配平数值时输出逐层战报，看勇者曲线是否跟得上怪物曲线。
//
// 它是一套固定优先级的贪心策略（收集 → 清怪 → 开门 → 商店 → 上楼），
// 没有任何随机数，同一份关卡数据永远得到同一条通关路线。

import { GRID, MONSTERS, ITEMS } from "./data.mjs";
import {
  DIRS,
  DIR_BY_KEY,
  battlePreview,
  currentFloor,
  index,
  isMonsterChar,
  isWalkable,
  monsterIdOf,
  pointOf,
  shopOptions,
  step,
} from "./engine.mjs";

const ITEM_CHARS = new Set(Object.keys(ITEMS).filter((ch) => ch !== "M" && ch !== "Z"));
const KEY_CHARS = new Set(["y", "b", "r"]);
const DOOR_CHARS = new Set(["Y", "B", "R"]);
const DOOR_KEY = { Y: "y", B: "b", R: "r" };
const UNREACHABLE_COST = 1e6;

function bfs(state) {
  const floor = currentFloor(state);
  const start = index(state.x, state.y);
  const dist = new Int16Array(GRID * GRID).fill(-1);
  const prev = new Int16Array(GRID * GRID).fill(-1);
  dist[start] = 0;
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    const { x, y } = pointOf(cur);
    for (const dir of DIRS) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const ni = index(nx, ny);
      if (dist[ni] >= 0) continue;
      if (!isWalkable(state, floor.cells, floor.cells[ni])) continue;
      // 楼梯不参与寻路：踩上去就会切层，规划时绕开（除非脚下本来就是楼梯）
      if ((floor.cells[ni] === "^" || floor.cells[ni] === "v") && ni !== start) continue;
      dist[ni] = dist[cur] + 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, prev };
}

function dirBetween(from, to) {
  const a = pointOf(from);
  const b = pointOf(to);
  for (const [key, dir] of Object.entries(DIR_BY_KEY)) {
    if (a.x + dir.dx === b.x && a.y + dir.dy === b.y) return key;
  }
  return null;
}

function firstDirToward(prev, target) {
  const chain = [];
  let cur = target;
  while (cur >= 0) {
    chain.push(cur);
    cur = prev[cur];
  }
  chain.reverse();
  if (chain.length < 2) return null;
  return dirBetween(chain[0], chain[1]);
}

function moveIntent(dirKey) {
  const dir = DIR_BY_KEY[dirKey];
  return dir ? { type: "move", dx: dir.dx, dy: dir.dy } : null;
}

// 朝某个「不可进入但可交互」的格子（门 / 怪物）走一步
function approachIntent(state, dist, prev, target) {
  const { x, y } = pointOf(target);
  let best = -1;
  let bestDist = Infinity;
  for (const dir of DIRS) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
    const ni = index(nx, ny);
    if (dist[ni] < 0) continue;
    if (dist[ni] < bestDist) {
      bestDist = dist[ni];
      best = ni;
    }
  }
  if (best < 0) return null;
  if (bestDist === 0) return moveIntent(dirBetween(index(state.x, state.y), target));
  return moveIntent(firstDirToward(prev, best));
}

function floorDamageBudget(state, atk, def, hp) {
  const floor = currentFloor(state);
  let sum = 0;
  for (const ch of floor.cells) {
    if (!isMonsterChar(floor, ch)) continue;
    const mon = MONSTERS[monsterIdOf(floor, ch)];
    const preview = battlePreview({ atk, def, hp }, mon);
    sum += preview.blocked || !preview.canWin ? UNREACHABLE_COST : preview.damage;
  }
  return sum;
}

// 商店决策：优先买「每金币减伤最多」的选项；都不减伤时按血量缺口补血
function decidePurchase(state, visit) {
  if (visit.bought >= visit.limit) return null;
  const options = shopOptions(state).filter((o) => o.affordable && o.kind !== "hp");
  const hpOption = shopOptions(state).find((o) => o.kind === "hp" && o.affordable);
  const base = floorDamageBudget(state, state.atk, state.def, state.hp);
  let best = null;
  for (const option of options) {
    const atk = option.kind === "atk" ? state.atk + option.amount : state.atk;
    const def = option.kind === "def" ? state.def + option.amount : state.def;
    const after = floorDamageBudget(state, atk, def, state.hp);
    const gain = base - after;
    if (gain <= 0) continue;
    const ratio = gain / option.price;
    if (!best || ratio > best.ratio) best = { kind: option.kind, ratio };
  }
  if (best) return best.kind;
  if (hpOption && state.hp < state.hpMax * 0.55) return "hp";
  // 减伤算不出来（例如全场怪物都还打不动）时，优先堆攻击解锁破防，其次补防御
  const atkOption = shopOptions(state).find((o) => o.kind === "atk" && o.affordable);
  if (atkOption) return "atk";
  const defOption = shopOptions(state).find((o) => o.kind === "def" && o.affordable);
  if (defOption) return "def";
  if (hpOption) return "hp";
  return null;
}

function shopIntent(state, visit) {
  if (currentFloor(state).cells[index(state.x, state.y)] !== "M") return null;
  const kind = decidePurchase(state, visit);
  if (!kind) return null;
  return { intent: { type: "buy", kind }, reason: `buy-${kind}` };
}

// 单步决策：返回 { intent, reason } 或 null（真的无路可走）
export function planOnce(state, visit = { bought: 0, limit: 8 }) {
  const shop = shopIntent(state, visit);
  if (shop) return shop;

  const { dist, prev } = bfs(state);
  const floor = currentFloor(state);
  const cells = floor.cells;
  const here = index(state.x, state.y);

  // 1) 捡所有可达道具（钥匙优先：它决定后面能不能开门）
  let keyTarget = -1;
  let keyDist = Infinity;
  let itemTarget = -1;
  let itemDist = Infinity;
  for (let i = 0; i < cells.length; i += 1) {
    if (dist[i] < 0) continue;
    const ch = cells[i];
    if (KEY_CHARS.has(ch)) {
      if (dist[i] < keyDist) {
        keyDist = dist[i];
        keyTarget = i;
      }
    } else if (ITEM_CHARS.has(ch)) {
      if (dist[i] < itemDist) {
        itemDist = dist[i];
        itemTarget = i;
      }
    }
  }
  const target = keyTarget >= 0 ? keyTarget : itemTarget;
  const targetDist = keyTarget >= 0 ? keyDist : itemDist;
  if (target >= 0 && targetDist > 0) {
    const intent = moveIntent(firstDirToward(prev, target));
    if (intent) return { intent, reason: "collect" };
  }

  // 2) 打可胜怪物（战损低者优先，同战损取近）
  //    残血时不当莽夫：优先找门/楼梯，实在无路可走才硬着头皮打
  const lowHp = state.hp < state.hpMax * 0.22;
  let bestFight = null;
  for (let i = 0; i < cells.length; i += 1) {
    const ch = cells[i];
    if (!isMonsterChar(floor, ch)) continue;
    const mon = MONSTERS[monsterIdOf(floor, ch)];
    const preview = battlePreview(state, mon);
    if (preview.blocked || !preview.canWin) continue;
    const { x, y } = pointOf(i);
    let approachDist = Infinity;
    for (const dir of DIRS) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const ni = index(nx, ny);
      if (dist[ni] >= 0 && dist[ni] < approachDist) approachDist = dist[ni];
    }
    if (approachDist === Infinity) continue;
    const score = preview.damage * 4 + approachDist;
    if (!bestFight || score < bestFight.score) bestFight = { idx: i, score };
  }
  const fightIntent = bestFight ? approachIntent(state, dist, prev, bestFight.idx) : null;

  // 3) 有钥匙就开门（离得最近的先开）
  let bestDoor = -1;
  let bestDoorDist = Infinity;
  for (let i = 0; i < cells.length; i += 1) {
    const ch = cells[i];
    if (!DOOR_CHARS.has(ch)) continue;
    if (state.keys[DOOR_KEY[ch]] <= 0) continue;
    const { x, y } = pointOf(i);
    for (const dir of DIRS) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const ni = index(nx, ny);
      if (dist[ni] >= 0 && dist[ni] < bestDoorDist) {
        bestDoorDist = dist[ni];
        bestDoor = i;
      }
    }
  }
  const doorIntent = bestDoor >= 0 ? approachIntent(state, dist, prev, bestDoor) : null;

  // 4) 上楼（楼梯格不参与寻路，所以走「贴近再迈进去」）
  let stairsIntent = null;
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] !== "^") continue;
    if (dist[i] === 0) {
      stairsIntent = { type: "use" };
    } else {
      stairsIntent = approachIntent(state, dist, prev, i);
    }
    if (stairsIntent) break;
  }

  // 4.5) 终点优先：公主格可达就直接踩上去（第 24 层没有上楼）
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] !== "Z") continue;
    if (dist[i] < 0) continue;
    const intent = moveIntent(firstDirToward(prev, i));
    if (intent) return { intent, reason: "goal" };
  }

  // 优先级：健康时清怪 → 开门 → 上楼；残血时开门/上楼 → 不得已才开打
  if (fightIntent && !lowHp) return { intent: fightIntent, reason: "fight" };
  if (doorIntent) return { intent: doorIntent, reason: "open" };
  if (stairsIntent) return { intent: stairsIntent, reason: "stairs" };
  if (fightIntent) return { intent: fightIntent, reason: "fight" };

  // 5) 兜底：仍站在商店上就再试一次购买（允许超额度）
  const retry = shopIntent(state, { bought: 0, limit: 99 });
  if (retry) return retry;

  return null;
}

// 跑完整座塔。返回终局状态、总步数与失败原因（便于配平）
export function solveTower(startState, options = {}) {
  const maxSteps = options.maxSteps || 80000;
  let state = startState;
  let guard = 0;
  const visit = { bought: 0, limit: 8 };
  const trace = [];
  let lastFloor = state.floor;
  const stuck = new Set();

  while (state.status === "playing" && guard < maxSteps) {
    guard += 1;
    if (state.floor !== lastFloor) {
      lastFloor = state.floor;
      visit.bought = 0;
    }
    const plan = planOnce(state, visit);
    if (!plan || !plan.intent) return { state, steps: guard, won: false, reason: "stuck", trace };
    const result = step(state, plan.intent);
    if (!result.action) {
      // 计划落空（例如同一格反复尝试）：记录下来，避免死循环
      const sig = `${state.floor}:${state.x},${state.y}:${plan.reason}`;
      if (stuck.has(sig)) return { state, steps: guard, won: false, reason: `blocked:${plan.reason}`, trace };
      stuck.add(sig);
      state = { ...state, stats: { ...state.stats, steps: state.stats.steps + 1 } };
      continue;
    }
    if (plan.intent.type === "buy") visit.bought += 1;
    state = result.state;
    trace.push({ floor: state.floor, reason: plan.reason, hp: state.hp, atk: state.atk, def: state.def, gold: state.gold });
  }
  return {
    state,
    steps: guard,
    won: state.status === "victory",
    reason: state.status === "victory" ? state.ending : "timeout",
    trace,
  };
}

// 逐层战报：配平用
export function towerReport(startState) {
  const result = solveTower(startState);
  const rows = [];
  for (const entry of result.trace) {
    const last = rows[rows.length - 1];
    if (!last || last.floor !== entry.floor) rows.push({ ...entry });
    else Object.assign(last, entry);
  }
  return { ...result, rows };
}
