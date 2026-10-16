// engine.mjs — 背包竞技场规则唯一权威（纯函数，DOM-free）
// 职责：网格摆放校验、布局→战力推导、确定性战斗模拟、合成结算、商店/对手生成、残局求解

import {
  ITEMS, RECIPES, CLASSES, ENEMIES, EXPEDITION, GEM_MAX, gemRecipeTarget,
} from "./data.mjs";

// ---------------- 确定性 PRNG（mulberry32） ----------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// ---------------- 网格与摆放 ----------------
export function makeGrid(cols, rows, blocked = []) {
  const set = new Set(blocked.map((c) => String(c)));
  return { cols, rows, blocked: set };
}

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function inBounds(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
}

export function getShape(item, rot = 0) {
  const data = ITEMS[item.id];
  return rot % 2 === 0 ? { w: data.w, h: data.h } : { w: data.h, h: data.w };
}

export function itemCells(item) {
  const { w, h } = getShape(item, item.rot);
  const cells = [];
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      cells.push([item.x + dx, item.y + dy]);
    }
  }
  return cells;
}

export function canPlaceAt(grid, placed, item, x, y, rot) {
  const { w, h } = getShape(item, rot);
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const cx = x + dx;
      const cy = y + dy;
      if (!inBounds(grid, cx, cy) || grid.blocked.has(cellKey(cx, cy))) return false;
      for (const other of placed) {
        if (other.uid === item.uid) continue;
        for (const [ox, oy] of itemCells(other)) {
          if (ox === cx && oy === cy) return false;
        }
      }
    }
  }
  return true;
}

// 合法操作铁律：返回新 items 数组或 null（意图无效时静默忽略）
export function tryMove(grid, items, uid, x, y, rot) {
  const idx = items.findIndex((it) => it.uid === uid);
  if (idx < 0) return null;
  const item = { ...items[idx], x, y, rot: rot % 4 };
  const rest = items.filter((it) => it.uid !== uid);
  if (!canPlaceAt(grid, rest, item, x, y, rot)) return null;
  return [...rest, item];
}

// 拖到另一物品上：交换（两物都必须能落入对方位置）；失败返回 null
export function trySwap(grid, items, aUid, bUid) {
  const a = items.find((it) => it.uid === aUid);
  const b = items.find((it) => it.uid === bUid);
  if (!a || !b || a.uid === b.uid) return null;
  const withoutA = items.filter((it) => it.uid !== aUid);
  const withoutB = withoutA.filter((it) => it.uid !== bUid);
  const aAtB = { ...a, x: b.x, y: b.y, rot: b.rot };
  const bAtA = { ...b, x: a.x, y: a.y, rot: a.rot };
  if (!canPlaceAt(grid, withoutB, aAtB, aAtB.x, aAtB.y, aAtB.rot)) return null;
  if (!canPlaceAt(grid, withoutA, bAtA, bAtA.x, bAtA.y, bAtA.rot)) return null;
  return [...withoutB, aAtB, bAtA];
}

export function tryRemove(items, uid) {
  if (!items.some((it) => it.uid === uid)) return null;
  return items.filter((it) => it.uid !== uid);
}

// 扩容：交替加列/加行，返回新 grid
export function expandGrid(grid, expansionIndex) {
  const blocked = [...grid.blocked].map((c) => c.split(",").map(Number));
  return makeGrid(
    expansionIndex % 2 === 0 ? grid.cols + 1 : grid.cols,
    expansionIndex % 2 === 0 ? grid.rows : grid.rows + 1,
    blocked,
  );
}

// ---------------- 布局 → 战力推导 ----------------
function neighborItems(grid, placed, item) {
  const own = new Set(itemCells(item).map(([x, y]) => cellKey(x, y)));
  const result = new Set();
  for (const other of placed) {
    if (other.uid === item.uid) continue;
    for (const [ox, oy] of itemCells(other)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (own.has(cellKey(ox + dx, oy + dy))) {
          result.add(other);
          break;
        }
      }
    }
  }
  return [...result];
}

function emptyCellsRight(grid, placed, item) {
  const { w } = getShape(item, item.rot);
  const top = item.y;
  const bottom = item.y + getShape(item, item.rot).h - 1;
  let count = 0;
  const occupied = new Set();
  for (const other of placed) {
    if (other.uid === item.uid) continue;
    for (const [x, y] of itemCells(other)) occupied.add(cellKey(x, y));
  }
  for (let y = top; y <= bottom; y += 1) {
    for (let x = item.x + w; x < grid.cols; x += 1) {
      if (!grid.blocked.has(cellKey(x, y)) && !occupied.has(cellKey(x, y))) count += 1;
    }
  }
  return count;
}

function addStat(bonus, key, value) {
  if (key === "dmg") bonus.dmg += value;
  else if (key === "crit") bonus.crit += value;
  else if (key === "hit") bonus.hit += value;
  else if (key === "attackSpeed") bonus.attackSpeed += value;
  else if (key === "armor") bonus.armor += value;
  else if (key === "critDmg") bonus.critDmg += value;
  else if (key === "staminaRegen") bonus.staminaRegen += value;
  else if (key === "hpRegen") bonus.hpRegen += value;
  else if (key === "manaRegen") bonus.manaRegen += value;
  else if (key === "lifesteal") bonus.lifesteal += value;
  else if (key === "rageGain") bonus.rageGain += value;
  else if (key === "burn") bonus.burn += value;
  else if (key === "poison") bonus.poison += value;
  else if (key === "burnDmg") bonus.burnDmg += value;
}

function itemBonus(grid, placed, item, neighbors) {
  const bonus = { dmg: 0, crit: 0, hit: 0, attackSpeed: 0, armor: 0, critDmg: 0, staminaRegen: 0, hpRegen: 0, manaRegen: 0, lifesteal: 0, rageGain: 0, burn: 0, poison: 0, burnDmg: 0 };
  const data = ITEMS[item.id];
  // 被相邻增益件（aura）加成
  for (const nb of neighbors) {
    const nbData = ITEMS[nb.id];
    if (nbData.aura && nbData.aura.to && data.tags.includes(nbData.aura.to)) {
      addStat(bonus, nbData.aura.stat, nbData.aura.value);
    }
  }
  // 相邻赋能件（油瓶/毒箭）对本件的加成：加成定义在邻件的 adjBonus 上
  for (const nb of neighbors) {
    const nbData = ITEMS[nb.id];
    if (nbData.adjBonus) {
      const matches = nbData.adjBonus.needs.some((need) => data.tags.includes(need));
      if (matches) {
        for (const key of ["burn", "poison", "burnDmg"]) {
          if (nbData.adjBonus[key]) addStat(bonus, key, nbData.adjBonus[key]);
        }
      }
    }
  }
  // 行位加成
  if (data.rowBonus) {
    const { h } = getShape(item, item.rot);
    const onTop = item.y === 0;
    const onBottom = item.y + h - 1 === grid.rows - 1;
    const hitRow = data.rowBonus.row === "top" ? onTop : onBottom;
    if (hitRow) addStat(bonus, data.rowBonus.stat, data.rowBonus.value);
  }
  // 空位加成
  if (data.openBonus) {
    const count = Math.min(data.openBonus.max, emptyCellsRight(grid, placed, item));
    if (count > 0) addStat(bonus, data.openBonus.stat, data.openBonus.per * count);
  }
  return bonus;
}

// 被 铁砧/轻羽符 影响：同列紧邻下方/上方物品
function columnGrants(grid, placed, item) {
  const data = ITEMS[item.id];
  const result = [];
  const occupied = new Map();
  for (const other of placed) {
    if (other.uid === item.uid) continue;
    for (const [x, y] of itemCells(other)) occupied.set(cellKey(x, y), other);
  }
  if (data.colBelowBonus) {
    for (const [x, y] of itemCells(item)) {
      const other = occupied.get(cellKey(x, y + 1));
      if (other) result.push({ uid: other.uid, stat: "armor", value: data.colBelowBonus.value });
    }
  }
  if (data.colAboveBonus) {
    for (const [x, y] of itemCells(item)) {
      const other = occupied.get(cellKey(x, y - 1));
      if (other) result.push({ uid: other.uid, stat: "attackSpeed", value: data.colAboveBonus.value });
    }
  }
  return result;
}

// 推导完整战力（玩家与对手共用）；grid 用于行位/空位判定
export function computeBuild(items, classId = null, grid = { cols: 40, rows: 40, blocked: new Set() }, opts = {}) {
  const placed = items.map((it, index) => ({ ...it, uid: it.uid ?? index }));
  const cls = classId ? CLASSES[classId] : null;
  const useMana = cls?.perk === "mana";

  const passive = { hpRegen: 0, staminaRegen: 1, manaRegen: useMana ? 1.5 : 0, attackSpeed: 0, crit: 0, critDmg: 0, hitBonus: 0, armor: 0, block: 0, dodge: 0, lifesteal: 0, dmgFlat: 0, rageGain: 0, enemyResReduction: 0 };
  const weapons = [];
  const foods = [];
  const battleStart = [];
  const perItem = new Map(); // uid → bonus

  for (const item of placed) {
    const neighbors = neighborItems(grid, placed, item);
    perItem.set(item.uid, itemBonus(grid, placed, item, neighbors));
  }
  for (const item of placed) {
    for (const grant of columnGrants(grid, placed, item)) {
      const bonus = perItem.get(grant.uid);
      if (bonus) addStat(bonus, grant.stat, grant.value);
    }
  }

  for (const item of placed) {
    const data = ITEMS[item.id];
    const bonus = perItem.get(item.uid);
    if (data.type === "weapon") {
      const w = data.weapon;
      const eff = {
        uid: item.uid,
        itemId: item.id,
        name: data.name, icon: data.icon,
        dmg: [w.dmg[0] + bonus.dmg, w.dmg[1] + bonus.dmg],
        cd: w.cd,
        resource: w.resource,
        hit: w.hit + bonus.hit,
        crit: Math.min(80, w.crit + bonus.crit),
        critDmg: 1.5 + bonus.critDmg,
        range: w.range,
        shots: w.shots ?? 1,
        tags: data.tags,
        burnBonus: bonus.burn,
        burnDmgBonus: bonus.burnDmg,
        poisonBonus: bonus.poison,
      };
      // 赋能件（油瓶/毒箭）加成：武器已有或没有对应状态都生效
      if (bonus.burn > 0 || bonus.burnDmg > 0 || bonus.poison > 0) {
        const onHit = w.onHit ? { ...w.onHit } : {};
        if (bonus.burn > 0) onHit.burn = (onHit.burn ?? 0) + bonus.burn;
        if (bonus.burnDmg > 0) onHit.burnDmg = (onHit.burnDmg ?? 0) + bonus.burnDmg;
        if (bonus.poison > 0) onHit.poison = (onHit.poison ?? 0) + bonus.poison;
        eff.onHit = onHit;
      } else {
        eff.onHit = w.onHit ? { ...w.onHit } : null;
      }
      weapons.push(eff);
    } else if (data.type === "food") {
      foods.push({ uid: item.uid, itemId: item.id, name: data.name, icon: data.icon, food: { ...data.food } });
    } else if (data.type === "armor" || data.type === "shield") {
      passive.armor += (data.armor.armor ?? 0) + bonus.armor;
      passive.block += data.armor.block ?? 0;
      passive.dodge += data.armor.dodge ?? 0;
      passive.enemyResReduction += data.armor.enemyStaminaReduction ?? 0;
    } else if (data.type === "trinket") {
      const t = data.trinket ?? {};
      passive.crit += (t.crit ?? 0) + bonus.crit;
      passive.hitBonus += (t.hit ?? 0) + bonus.hit;
      passive.attackSpeed += (t.attackSpeed ?? 0) + bonus.attackSpeed;
      passive.armor += (t.armor ?? 0) + bonus.armor;
      passive.staminaRegen += (t.staminaRegen ?? 0) + bonus.staminaRegen;
      passive.manaRegen += (t.manaRegen ?? 0) + bonus.manaRegen;
      passive.hpRegen += (t.hpRegen ?? 0) + bonus.hpRegen;
      passive.lifesteal += (t.lifesteal ?? 0) + bonus.lifesteal;
      passive.rageGain += (t.rageGain ?? 0) + bonus.rageGain;
      if (data.battleStart) battleStart.push({ ...data.battleStart });
    } else if (data.type === "gem") {
      const g = data.gem;
      if (g.stat === "dmg") passive.dmgFlat += g.value;
      else if (g.stat === "staminaRegen") passive.staminaRegen += g.value;
      else if (g.stat === "hpRegen") passive.hpRegen += g.value;
    }
  }

  // 职业天赋
  if (cls?.perk === "luck") {
    passive.crit += 10;
    passive.hitBonus += 5;
  }
  if (useMana) {
    passive.manaRegen += Math.max(0, passive.staminaRegen - 1); // 耐力系增益折算为魔力
  }

  return {
    classId,
    useMana,
    maxHp: opts.hp ?? 100,
    hpRegen: passive.hpRegen,
    armor: Math.max(0, passive.armor),
    block: Math.min(60, passive.block),
    dodge: Math.min(40, passive.dodge),
    maxRes: useMana ? 10 : 6,
    resRegen: useMana ? passive.manaRegen : passive.staminaRegen,
    attackSpeed: passive.attackSpeed,
    crit: Math.min(80, passive.crit),
    critDmg: 1.5 + passive.critDmg,
    hitBonus: passive.hitBonus,
    lifesteal: passive.lifesteal,
    dmgFlat: passive.dmgFlat,
    rageGain: passive.rageGain,
    enemyResReduction: passive.enemyResReduction,
    weapons,
    foods,
    battleStart,
    itemCount: placed.length,
  };
}

// 对手战力缩放（按轮次）
export function scaleSpec(spec, { hpMul = 1, dmgMul = 1, armorMul = 1 } = {}) {
  return {
    ...spec,
    maxHp: Math.round(spec.maxHp * hpMul),
    armor: Math.round(spec.armor * armorMul),
    weapons: spec.weapons.map((w) => ({
      ...w,
      dmg: [Math.round(w.dmg[0] * dmgMul), Math.round(w.dmg[1] * dmgMul)],
    })),
  };
}

export function makeEnemy(archetypeId, round = 1) {
  const base = ENEMIES[archetypeId];
  const grid = makeGrid(base.grid.cols, base.grid.rows);
  const items = base.items.map((it, index) => ({ ...it, uid: index }));
  const spec = computeBuild(items, null, grid, { hp: base.hp ?? 100 });
  let hpMul = 1 + (round - 1) * 0.1;
  let dmgMul = 1 + (round - 1) * 0.05;
  let armorMul = 1 + (round - 1) * 0.04;
  if (archetypeId === "legend" && round >= 16) {
    hpMul *= 1.5;
    dmgMul *= 1.35;
  }
  return {
    archetype: base,
    items,
    grid,
    spec: scaleSpec(spec, { hpMul, dmgMul, armorMul }),
    hpMul,
    dmgMul,
  };
}

// ---------------- 战斗模拟（确定性） ----------------
export function createBattle(playerSpec, enemySpec, seed = 1) {
  const rng = mulberry32(seed);
  const mkSide = (spec, tag) => ({
    tag,
    spec,
    hp: spec.maxHp,
    res: spec.maxRes,
    rage: 0,
    status: { burn: 0, burnDmg: 0, burnTimer: 0, poison: 0, poisonTimer: 0, stunUntil: 0 },
    buffs: [],
    weapons: spec.weapons.map((w) => ({ ...w, baseCd: w.cd, cd: w.cd * 0.5 + rng() * w.cd * 0.5 })),
    foods: spec.foods.map((f) => ({ ...f, baseCd: f.food.interval, cd: f.food.interval * (0.3 + rng() * 0.5) })),
    battleStartDone: false,
    dealt: 0,
  });
  const state = {
    seed,
    rng,
    time: 0,
    sides: [mkSide(playerSpec, "player"), mkSide(enemySpec, "enemy")],
    ended: false,
    winner: null,
    endReason: "",
  };
  return state;
}

function attackSpeedOf(side, state) {
  const rageBonus = side.spec.classId === "berserker" ? Math.min(0.6, side.rage * 0.05) : 0;
  let buff = 0;
  for (const b of side.buffs) {
    if (b.stat === "attackSpeed" && b.until > state.time) buff += b.value;
  }
  return Math.max(-0.6, side.spec.attackSpeed + rageBonus + buff);
}

export function stepBattle(state, dt) {
  const events = [];
  if (state.ended) return { state, events, ended: true };
  state.time += dt;

  // 疲劳：30 秒后双方每秒受递增伤害，保证必分胜负
  if (state.time > EXPEDITION.fatigueAfter) {
    const dps = (state.time - EXPEDITION.fatigueAfter) * EXPEDITION.fatigueRate;
    for (const side of state.sides) {
      if (side.hp > 0) {
        const dmg = dps * dt;
        side.hp -= dmg;
        events.push({ t: state.time, side: side.tag, kind: "fatigue", value: dmg });
      }
    }
  }

  for (const [idx, side] of state.sides.entries()) {
    const opp = state.sides[1 - idx];
    if (side.hp <= 0) continue;
    // 怒气衰减
    if (side.spec.classId === "berserker") side.rage = Math.max(0, side.rage - 4 * dt);
    // 燃烧 / 中毒持续伤害
    if (side.status.burn > 0) {
      const dps = side.status.burn * 1.5 + side.status.burnDmg;
      side.hp -= dps * dt;
      side.status.burnTimer += dt;
      if (side.status.burnTimer >= 2) {
        side.status.burn = Math.max(0, side.status.burn - 1);
        side.status.burnTimer = 0;
      }
    }
    if (side.status.poison > 0) {
      side.hp -= side.status.poison * 1.5 * dt;
      side.status.poisonTimer += dt;
      if (side.status.poisonTimer >= 2) {
        side.status.poison = Math.max(0, side.status.poison - 1);
        side.status.poisonTimer = 0;
      }
    }
    // 生命回复
    if (side.spec.hpRegen > 0 && side.hp < side.spec.maxHp) {
      side.hp = Math.min(side.spec.maxHp, side.hp + side.spec.hpRegen * dt);
    }
    // 资源回复（受对手盾牌压制）
    const resRegen = Math.max(0, side.spec.resRegen - opp.spec.enemyResReduction);
    side.res = Math.min(side.spec.maxRes, side.res + resRegen * dt);

    // 开局压制（陷阱夹）
    if (!side.battleStartDone && side.spec.battleStart.length) {
      side.battleStartDone = true;
      for (const bs of side.spec.battleStart) {
        opp.hp -= bs.dmg;
        events.push({ t: state.time, side: side.tag, kind: "trap", value: bs.dmg });
        opp.buffs.push({ stat: "attackSpeed", value: -bs.slow, until: state.time + bs.dur });
      }
    }

    // 武器
    const as = attackSpeedOf(side, state);
    for (const w of side.weapons) {
      if (state.ended || side.hp <= 0) break;
      w.cd -= dt;
      if (w.cd > 0) continue;
      if (state.time < side.status.stunUntil) {
        w.cd = 0.1;
        continue;
      }
      if (side.res < w.resource) {
        w.cd = 0.25; // 资源耗尽：短暂重试间隔
        continue;
      }
      side.res -= w.resource;
      w.cd = Math.max(0.2, w.baseCd / (1 + Math.max(0, as)));
      for (let shot = 0; shot < w.shots; shot += 1) {
        if (opp.hp <= 0) break;
        const hitChance = Math.min(98, w.hit + side.spec.hitBonus);
        if (state.rng() * 100 >= hitChance) {
          events.push({ t: state.time, side: side.tag, kind: "miss", itemId: w.itemId });
          continue;
        }
        let dmg = rngInt(state.rng, w.dmg[0], w.dmg[1]) + side.spec.dmgFlat;
        const crit = state.rng() * 100 < w.crit;
        if (crit) dmg = Math.round(dmg * w.critDmg);
        const blocked = state.rng() * 100 < opp.spec.block;
        const reduced = Math.max(1, dmg - opp.spec.armor);
        const final = blocked ? Math.max(1, Math.round(reduced * 0.5)) : reduced;
        opp.hp -= final;
        side.dealt += final;
        if (side.spec.lifesteal > 0) side.hp = Math.min(side.spec.maxHp, side.hp + final * side.spec.lifesteal);
        events.push({ t: state.time, side: side.tag, kind: crit ? "crit" : "hit", value: final, itemId: w.itemId, blocked });
        if (w.onHit) {
          if (w.onHit.burn) {
            opp.status.burn += w.onHit.burn;
            opp.status.burnDmg += w.onHit.burnDmg ?? 0;
            events.push({ t: state.time, side: side.tag, kind: "burn", value: w.onHit.burn, itemId: w.itemId });
          }
          if (w.onHit.poison) {
            opp.status.poison += w.onHit.poison;
            events.push({ t: state.time, side: side.tag, kind: "poison", value: w.onHit.poison, itemId: w.itemId });
          }
          if (w.onHit.stun && state.rng() * 100 < w.onHit.stun * 100) {
            opp.status.stunUntil = state.time + 0.8;
            events.push({ t: state.time, side: side.tag, kind: "stun", itemId: w.itemId });
          }
        }
      }
    }

    // 食物
    for (const f of side.foods) {
      if (state.ended || side.hp <= 0) break;
      f.cd -= dt;
      if (f.cd > 0) continue;
      f.cd = Math.max(0.2, f.baseCd / (1 + Math.max(0, as)));
      if (f.food.heal) {
        const heal = f.food.heal;
        side.hp = Math.min(side.spec.maxHp, side.hp + heal);
        events.push({ t: state.time, side: side.tag, kind: "heal", value: heal, itemId: f.itemId });
      }
      if (f.food.stamina || f.food.mana) {
        const gain = f.food.stamina ?? f.food.mana;
        side.res = Math.min(side.spec.maxRes, side.res + gain);
        events.push({ t: state.time, side: side.tag, kind: "res", value: gain, itemId: f.itemId });
      }
      if (f.food.buff) {
        side.buffs.push({ stat: f.food.buff.stat, value: f.food.buff.value, until: state.time + f.food.buff.dur });
        events.push({ t: state.time, side: side.tag, kind: "buff", value: f.food.buff.value, itemId: f.itemId });
      }
    }
  }

  // 终局判定
  const [p0, p1] = state.sides;
  if (p0.hp <= 0 && p1.hp <= 0) {
    state.ended = true;
    state.winner = 1; // 同归于尽：玩家判负
    state.endReason = "mutual";
  } else if (p0.hp <= 0) {
    state.ended = true;
    state.winner = 1;
    state.endReason = "dead";
  } else if (p1.hp <= 0) {
    state.ended = true;
    state.winner = 0;
    state.endReason = "dead";
  } else if (state.time >= EXPEDITION.hardCap) {
    state.ended = true;
    state.winner = p0.hp / p0.spec.maxHp > p1.hp / p1.spec.maxHp ? 0 : 1;
    state.endReason = "time";
  }
  return { state, events: events.slice(0, 60), ended: state.ended };
}

// 一把打完（供求解器 / 测试）
export function runBattle(playerSpec, enemySpec, seed = 1, maxTime = EXPEDITION.hardCap) {
  const battle = createBattle(playerSpec, enemySpec, seed);
  let guard = 0;
  while (!battle.ended && battle.time < maxTime && guard < 6000) {
    stepBattle(battle, 0.1);
    guard += 1;
  }
  return battle;
}

// ---------------- 合成结算 ----------------
function areAdjacent(placed, a, b) {
  if (a.uid === b.uid) return false;
  const cellsA = itemCells(a);
  const cellsB = new Set(itemCells(b).map(([x, y]) => cellKey(x, y)));
  for (const [ax, ay] of cellsA) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (cellsB.has(cellKey(ax + dx, ay + dy))) return true;
    }
  }
  return false;
}

export function findRecipes(items) {
  const placed = items.map((it, index) => ({ ...it, uid: it.uid ?? index }));
  const results = [];
  const used = new Set();
  for (const it of placed) {
    if (used.has(it.uid)) continue;
    const data = ITEMS[it.id];
    // 宝石家族：同色同阶两枚相邻
    for (const nb of placed) {
      if (nb.uid === it.uid || used.has(nb.uid)) continue;
      const target = gemRecipeTarget(data, ITEMS[nb.id]);
      if (target && areAdjacent(placed, it, nb)) {
        results.push({ kind: "gem", aUid: it.uid, bUid: nb.uid, into: target });
        used.add(it.uid);
        used.add(nb.uid);
        break;
      }
    }
    if (used.has(it.uid)) continue;
    // 固定配方：两件来源物品相邻且未被使用
    for (const recipe of RECIPES) {
      if (!recipe.sources.some((s) => s.id === it.id)) continue;
      const partnerCandidates = [];
      let ok = true;
      for (const source of recipe.sources) {
        if (source.id === it.id) {
          if (source.qty === 2) {
            const twin = placed.find((p) => p.id === it.id && p.uid !== it.uid && !used.has(p.uid));
            if (!twin) { ok = false; break; }
            partnerCandidates.push(twin);
          }
          // qty 为 1 时本件即所需物品
        } else {
          const found = placed.find((p) => p.id === source.id && !used.has(p.uid));
          if (!found) { ok = false; break; }
          partnerCandidates.push(found);
        }
      }
      if (!ok || partnerCandidates.length !== 1) continue;
      const partner = partnerCandidates[0];
      if (!areAdjacent(placed, it, partner)) continue;
      results.push({ kind: "recipe", recipeId: recipe.id, aUid: it.uid, bUid: partner.uid, into: recipe.into });
      used.add(it.uid);
      used.add(partner.uid);
      break;
    }
  }
  return results;
}

// 应用一条合成结果：两物合并为新物，占据包围盒
export function applyRecipe(items, recipe) {
  const a = items.find((it) => it.uid === recipe.aUid);
  const b = items.find((it) => it.uid === recipe.bUid);
  if (!a || !b) return null;
  const cells = [...itemCells(a), ...itemCells(b)];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const target = ITEMS[recipe.into];
  let rot = 0;
  if (target.w === w && target.h === h) rot = 0;
  else if (target.w === h && target.h === w) rot = 1;
  const result = { id: recipe.into, x: minX, y: minY, rot };
  const rest = items.filter((it) => it.uid !== recipe.aUid && it.uid !== recipe.bUid);
  const probe = [...rest.map((it) => ({ ...it })), result];
  const occupied = new Map();
  for (const it of probe) {
    for (const [x, y] of itemCells(it)) {
      const key = cellKey(x, y);
      if (occupied.has(key) && occupied.get(key) !== it.id) return null;
      occupied.set(key, it.id);
    }
  }
  // 新 uid：取最大 uid + 1
  const nextUid = Math.max(-1, ...rest.map((it) => it.uid)) + 1;
  result.uid = nextUid;
  return probe;
}

// 结算：顺序应用所有可合成配方，直到无配方可合
export function settleCrafts(items) {
  let current = items.map((it) => ({ ...it }));
  let crafted = 0;
  let guard = 0;
  while (guard < 20) {
    guard += 1;
    const recipes = findRecipes(current);
    if (!recipes.length) break;
    const next = applyRecipe(current, recipes[0]);
    if (!next) break;
    current = next;
    crafted += 1;
  }
  return { items: current, crafted };
}

// ---------------- 商店生成（种子可复现 + 联动保底） ----------------
function rarityWeight(rarity, round) {
  if (rarity === 0) return 10;
  if (rarity === 1) return round >= 2 ? 6 : 2;
  if (rarity === 2) return round >= 5 ? 3 : 0.6;
  return round >= 10 ? 1.6 : 0.2;
}

export function generateShop(classId, round, rng, backpackItems = []) {
  const pool = Object.values(ITEMS).filter((it) => !it.class || it.class === classId);
  const weighted = [];
  for (const item of pool) {
    const w = rarityWeight(item.rarity, round);
    if (w > 0) weighted.push({ item, w });
  }
  const presentTags = new Set();
  for (const it of backpackItems) {
    const data = ITEMS[it.id];
    if (data) for (const t of data.tags) presentTags.add(t);
  }
  const synergyPool = weighted.filter(({ item }) => {
    if (!presentTags.size) return true;
    if (item.tags.some((t) => presentTags.has(t))) return true;
    if (item.adjBonus && item.adjBonus.needs.some((n) => presentTags.has(n))) return true;
    return false;
  });
  const chosen = [];
  const used = new Set();
  const pick = (list) => {
    const viable = list.filter(({ item }) => !used.has(item.id));
    if (!viable.length) return null;
    const total = viable.reduce((s, e) => s + e.w, 0);
    let roll = rng() * total;
    for (const entry of viable) {
      roll -= entry.w;
      if (roll <= 0) return entry.item;
    }
    return viable[viable.length - 1].item;
  };
  for (let i = 0; i < 5; i += 1) {
    const item = pick(i < 2 && synergyPool.length >= 2 ? synergyPool : weighted);
    if (!item) break;
    chosen.push(item.id);
    used.add(item.id);
  }
  return chosen;
}

export function expansionCost(expansionCount) {
  if (expansionCount >= EXPEDITION.expansionCost.length) return null;
  return EXPEDITION.expansionCost[expansionCount];
}

// ---------------- 残局求解器（beam search，纯函数） ----------------
// 返回必胜摆法 { items: [{id,x,y,rot}] } 或 null
export function solvePuzzle(puzzle, { beam = 260, seed = 4242, rngSeed = 7 } = {}) {
  const grid = makeGrid(puzzle.grid.cols, puzzle.grid.rows, puzzle.grid.blocked ?? []);
  const enemy = ENEMIES[puzzle.enemy];
  const enemyItems = enemy.items.map((it, index) => ({ ...it, uid: index }));
  const enemySpec = computeBuild(enemyItems, null, makeGrid(enemy.grid.cols, enemy.grid.rows), { hp: enemy.hp ?? 100 });
  const tray = [];
  for (const entry of puzzle.tray) {
    for (let i = 0; i < entry.qty; i += 1) tray.push({ id: entry.id });
  }
  tray.sort((a, b) => ITEMS[b.id].w * ITEMS[b.id].h - ITEMS[a.id].w * ITEMS[a.id].h);
  const rng = mulberry32(rngSeed);

  let frontier = [[]];
  for (const entry of tray) {
    const data = ITEMS[entry.id];
    const rotations = data.w === data.h ? [0] : [0, 1];
    const nextMap = new Map();
    for (const layout of frontier) {
      const candidates = [];
      for (let y = 0; y < grid.rows; y += 1) {
        for (let x = 0; x < grid.cols; x += 1) {
          for (const rot of rotations) {
            const item = { id: entry.id, uid: -1, x, y, rot };
            if (canPlaceAt(grid, layout, item, x, y, rot)) candidates.push(item);
          }
        }
      }
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const t = candidates[i]; candidates[i] = candidates[j]; candidates[j] = t;
      }
      const cap = Math.min(candidates.length, 10);
      for (let i = 0; i < cap; i += 1) {
        const nextLayout = [...layout, { ...candidates[i], uid: layout.length }];
        const key = nextLayout.map((it) => `${it.id}@${it.x},${it.y},${it.rot}`).sort().join("|");
        if (!nextMap.has(key)) nextMap.set(key, nextLayout);
      }
    }
    frontier = [...nextMap.values()].slice(0, beam);
    if (!frontier.length) return null;
  }

  let best = null;
  let bestScore = -Infinity;
  for (const layout of frontier) {
    if (layout.length !== tray.length) continue;
    const playerSpec = computeBuild(layout, null, grid);
    const battle = runBattle(playerSpec, enemySpec, 12345);
    if (battle.winner !== 0) continue;
    const hpPct = battle.sides[0].hp / battle.sides[0].spec.maxHp;
    const score = hpPct * 100 - battle.time;
    if (score > bestScore) {
      bestScore = score;
      best = layout;
    }
  }
  return best ? { items: best.map((it) => ({ id: it.id, x: it.x, y: it.y, rot: it.rot })) } : null;
}

// 布局合法性 + 必胜判定（残局关卡门禁与提示校验）
export function layoutWins(items, puzzle, seed = 12345) {
  const enemy = ENEMIES[puzzle.enemy];
  const enemyItems = enemy.items.map((it, index) => ({ ...it, uid: index }));
  const enemySpec = computeBuild(enemyItems, null, makeGrid(enemy.grid.cols, enemy.grid.rows), { hp: enemy.hp ?? 100 });
  const grid = makeGrid(puzzle.grid.cols, puzzle.grid.rows, puzzle.grid.blocked ?? []);
  const playerSpec = computeBuild(items, null, grid);
  const battle = runBattle(playerSpec, enemySpec, seed);
  return { won: battle.winner === 0, hpPct: battle.sides[0].hp / battle.sides[0].spec.maxHp, time: battle.time };
}

// 单件物品的联动高亮信息（UI 用）
export function synergyOf(grid, placed, item) {
  const neighbors = neighborItems(grid, placed, item);
  const data = ITEMS[item.id];
  const bonus = itemBonus(grid, placed, item, neighbors);
  const hasAdj = bonus.burn > 0 || bonus.poison > 0 || bonus.burnDmg > 0 ||
    neighbors.some((nb) => ITEMS[nb.id].aura && data.tags.includes(ITEMS[nb.id].aura.to));
  const hasRow = data.rowBonus && (item.y === 0 || item.y + getShape(item, item.rot).h - 1 === grid.rows - 1);
  const open = data.openBonus ? Math.min(data.openBonus.max, emptyCellsRight(grid, placed, item)) : 0;
  const grants = columnGrants(grid, placed, item).length > 0;
  return { adj: hasAdj || grants, row: Boolean(hasRow), open };
}
