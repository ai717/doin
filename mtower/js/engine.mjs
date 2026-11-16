/**
 * @file games/mtower/js/engine.mjs
 * 纯数学确定性零随机状态机，严格 DOM-Free。
 * 驱动绝对战损计算、攻防临界值推演、无限时光撤销栈、法宝系统与 50 层无死锁流转。
 */

import { GRID, CH, ITEMS, MONSTERS, START_STATS } from './data.mjs';
import { buildClassic50Floors, buildFast25Floors } from './levels.mjs';

/**
 * 计算与怪物的战损与回合数
 */
export function calculateBattle(hero, monster) {
  if (!monster) {
    return { canWin: true, damage: 0, turns: 0 };
  }

  const isDragon = Boolean(monster.isDragon);
  const effectiveAtk = isDragon && hero.relics?.dragonSlayer ? hero.atk * 2 : hero.atk;

  // 无法破防
  if (effectiveAtk <= monster.def) {
    return {
      canWin: false,
      damage: Infinity,
      turns: Infinity,
      heroDmgPerHit: 0,
      monDmgPerHit: Math.max(0, monster.atk - hero.def),
      reason: 'cannot_pierce',
    };
  }

  const heroDmgPerHit = Math.max(1, effectiveAtk - monster.def);
  const monDmgPerHit = Math.max(0, monster.atk - hero.def);

  // 特殊怪异能：开战先手吸血 25% 当前血量
  let preLoss = 0;
  if (monster.ability === 'drain') {
    preLoss = Math.floor(hero.hp * 0.25);
  }

  const turns = Math.ceil(monster.hp / heroDmgPerHit);

  let monAttacks = turns - 1;
  if (monster.ability === 'double') {
    monAttacks = (turns - 1) * 2;
  }

  const totalDamage = preLoss + monAttacks * monDmgPerHit;
  const canWin = hero.hp > totalDamage;

  return {
    canWin,
    damage: totalDamage,
    turns,
    heroDmgPerHit,
    monDmgPerHit,
    preLoss,
  };
}

/**
 * 攻防临界值智能解析器（计算跨越下一质变点所需攻防数值与省血点数）
 */
export function calculateThresholds(hero, monster) {
  const currentBattle = calculateBattle(hero, monster);
  if (!currentBattle.canWin && currentBattle.damage === Infinity) {
    // 无法破防：计算破防所需最小攻击力
    const neededAtk = monster.def + 1 - hero.atk;
    return {
      atkThreshold: { deltaAtk: Math.max(1, neededAtk), turnsReduced: 0, savedHp: 0, unlocksPierce: true },
      defThreshold: null,
    };
  }

  // 1. 攻击临界值：寻找减少 1 回合所需的最小额外攻击力
  let atkThreshold = null;
  const curTurns = currentBattle.turns;
  if (curTurns > 1) {
    const isDragon = Boolean(monster.isDragon) && hero.relics?.dragonSlayer;
    for (let extra = 1; extra <= 100; extra++) {
      const simHero = { ...hero, atk: hero.atk + extra };
      const simBattle = calculateBattle(simHero, monster);
      if (simBattle.turns < curTurns) {
        const saved = currentBattle.damage - simBattle.damage;
        atkThreshold = {
          deltaAtk: extra,
          turnsReduced: curTurns - simBattle.turns,
          savedHp: saved,
          unlocksPierce: false,
        };
        break;
      }
    }
  }

  // 2. 防御临界值：寻找将怪物单击伤害降为 0 或大幅省血的额外防御力
  let defThreshold = null;
  const curMonDmg = currentBattle.monDmgPerHit;
  if (curMonDmg > 0) {
    const neededDef = monster.atk - hero.def;
    if (neededDef > 0) {
      const saved = currentBattle.damage;
      defThreshold = {
        deltaDef: neededDef,
        savedHp: saved,
        zeroDamage: true,
      };
    }
  }

  return {
    atkThreshold,
    defThreshold,
  };
}

/**
 * 初始化游戏状态
 */
export function createInitialState(options = {}) {
  const mode = options.mode || 'classic50';
  const rawFloors = mode === 'fast25' ? buildFast25Floors() : buildClassic50Floors();

  // 深度复制地图网格
  const floors = rawFloors.map((f) => ({
    ...f,
    map: f.map.map((r) => r.split('')),
    visited: f.floor === 1,
  }));

  const startFloor = floors[0];
  // 寻觅 1 层的初始出生点 (优先下楼梯口 'v' 前方或中心空地)
  let heroX = 5;
  let heroY = 9;
  let found = false;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (startFloor.map[y][x] === 'v') {
        heroX = x;
        heroY = y;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  return {
    mode,
    floors,
    currentFloor: 1,
    maxFloorReached: 1,
    hero: {
      x: heroX,
      y: heroY,
      hp: START_STATS.hp,
      atk: START_STATS.atk,
      def: START_STATS.def,
      gold: START_STATS.gold,
      exp: START_STATS.exp,
      keys: { ...START_STATS.keys },
      relics: { ...START_STATS.relics },
    },
    status: 'playing', // 'playing' | 'won' | 'dead'
    steps: 0,
    elapsedTime: 0,
    undoStack: [],
    floorSnapshots: {},
    events: [{ type: 'game_start' }],
  };
}

/**
 * 纯函数物理帧步进与操作调度
 */
export function step(state, action) {
  if (!action || typeof action !== 'object') {
    return { ...state, events: [] };
  }

  // 1. 无限撤销 (Undo)
  if (action.type === 'undo') {
    if (state.undoStack.length === 0) {
      return { ...state, events: [{ type: 'undo_failed', reason: 'empty_stack' }] };
    }
    const previousSnapshot = state.undoStack[state.undoStack.length - 1];
    const newStack = state.undoStack.slice(0, -1);
    return {
      ...previousSnapshot,
      undoStack: newStack,
      events: [{ type: 'undo_success' }],
    };
  }

  // 2. 楼层时光快照回溯 (Rewind Floor)
  if (action.type === 'rewind_floor') {
    const targetF = action.floor;
    const snap = state.floorSnapshots[targetF];
    if (!snap) {
      return { ...state, events: [{ type: 'rewind_failed', reason: 'no_snapshot' }] };
    }
    return {
      ...snap,
      undoStack: [...state.undoStack, createSnapshot(state)],
      events: [{ type: 'rewind_success', floor: targetF }],
    };
  }

  // 3. 楼层瞬移 (Wings)
  if (action.type === 'fly') {
    const targetF = action.floor;
    if (!state.hero.relics?.wings) {
      return { ...state, events: [{ type: 'fly_failed', reason: 'no_wings' }] };
    }
    if (targetF < 1 || targetF > state.floors.length || targetF > state.maxFloorReached) {
      return { ...state, events: [{ type: 'fly_failed', reason: 'invalid_floor' }] };
    }

    const nextFloors = state.floors.map((f) => ({ ...f, visited: f.visited || f.floor === targetF }));
    const targetFloorObj = nextFloors.find((f) => f.floor === targetF);

    // 找到目标层的楼梯坐标
    let tx = 5, ty = 5;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (targetFloorObj.map[y][x] === '^' || targetFloorObj.map[y][x] === 'v' || targetFloorObj.map[y][x] === '.') {
          tx = x; ty = y; break;
        }
      }
    }

    return {
      ...state,
      currentFloor: targetF,
      floors: nextFloors,
      hero: { ...state.hero, x: tx, y: ty },
      undoStack: [...state.undoStack, createSnapshot(state)],
      events: [{ type: 'fly_success', floor: targetF }],
    };
  }

  // 4. 使用圣水 (Holy Water)
  if (action.type === 'use_water') {
    if ((state.hero.relics?.holyWater || 0) <= 0) {
      return { ...state, events: [{ type: 'water_failed', reason: 'no_water' }] };
    }
    const doubledHp = state.hero.hp * 2;
    return {
      ...state,
      hero: {
        ...state.hero,
        hp: doubledHp,
        relics: { ...state.hero.relics, holyWater: state.hero.relics.holyWater - 1 },
      },
      undoStack: [...state.undoStack, createSnapshot(state)],
      events: [{ type: 'use_water_success', newHp: doubledHp }],
    };
  }

  // 5. 使用地震卷轴 (Earthquake Scroll)
  if (action.type === 'use_quake') {
    if ((state.hero.relics?.earthquake || 0) <= 0) {
      return { ...state, events: [{ type: 'quake_failed', reason: 'no_quake' }] };
    }
    const curFIdx = state.currentFloor - 1;
    const curMap = state.floors[curFIdx].map.map((row) =>
      row.map((cell) => (cell === '#' ? '.' : cell))
    );

    const nextFloors = [...state.floors];
    nextFloors[curFIdx] = { ...nextFloors[curFIdx], map: curMap };

    return {
      ...state,
      floors: nextFloors,
      hero: {
        ...state.hero,
        relics: { ...state.hero.relics, earthquake: state.hero.relics.earthquake - 1 },
      },
      undoStack: [...state.undoStack, createSnapshot(state)],
      events: [{ type: 'use_quake_success' }],
    };
  }

  // 6. 勇者基础移动与交互 (Move)
  if (action.type === 'move') {
    if (state.status !== 'playing') {
      return { ...state, events: [] };
    }

    const { dx, dy } = action;
    const nx = state.hero.x + dx;
    const ny = state.hero.y + dy;

    // 越界检查
    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
      return { ...state, events: [{ type: 'bump_wall' }] };
    }

    const curFIdx = state.currentFloor - 1;
    const floorObj = state.floors[curFIdx];
    const cell = floorObj.map[ny][nx];

    // A. 遭遇坚固石墙
    if (cell === '#') {
      return { ...state, events: [{ type: 'bump_wall' }] };
    }

    // B. 遭遇可破石墙 (Crack Wall)
    if (cell === 'X') {
      const curMap = floorObj.map.map((r) => [...r]);
      curMap[ny][nx] = '.';
      const nextFloors = [...state.floors];
      nextFloors[curFIdx] = { ...floorObj, map: curMap };
      return {
        ...state,
        floors: nextFloors,
        undoStack: [...state.undoStack, createSnapshot(state)],
        events: [{ type: 'break_wall', x: nx, y: ny }],
      };
    }

    // C. 遭遇有色门或铁门
    if (cell === 'Y' || cell === 'B' || cell === 'R' || cell === 'M') {
      const keyType = cell === 'Y' ? 'y' : cell === 'B' ? 'b' : cell === 'R' ? 'r' : null;

      if (keyType) {
        if (state.hero.keys[keyType] > 0) {
          const curMap = floorObj.map.map((r) => [...r]);
          curMap[ny][nx] = '.';
          const nextFloors = [...state.floors];
          nextFloors[curFIdx] = { ...floorObj, map: curMap };
          const nextKeys = { ...state.hero.keys, [keyType]: state.hero.keys[keyType] - 1 };

          return {
            ...state,
            floors: nextFloors,
            hero: { ...state.hero, keys: nextKeys },
            undoStack: [...state.undoStack, createSnapshot(state)],
            events: [{ type: 'open_door', door: cell, x: nx, y: ny }],
          };
        } else {
          return { ...state, events: [{ type: 'no_key', door: cell }] };
        }
      } else if (cell === 'M') {
        // 铁门检查：若击败了守门怪则自动敞开
        return { ...state, events: [{ type: 'iron_door_locked' }] };
      }
    }

    // D. 遭遇楼梯 (Up / Down)
    if (cell === '^' || cell === 'v') {
      const isUp = cell === '^';
      const targetF = isUp ? state.currentFloor + 1 : state.currentFloor - 1;
      if (targetF < 1 || targetF > state.floors.length) {
        return { ...state, events: [{ type: 'stairs_blocked' }] };
      }

      const nextFloors = state.floors.map((f) => ({
        ...f,
        visited: f.visited || f.floor === targetF,
      }));
      const targetFloorObj = nextFloors[targetF - 1];

      // 寻觅目标层对应的楼梯落点
      const landingCh = isUp ? 'v' : '^';
      let lx = 5, ly = 5;
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (targetFloorObj.map[y][x] === landingCh) {
            lx = x; ly = y; break;
          }
        }
      }

      const nextMaxFloor = Math.max(state.maxFloorReached, targetF);
      const nextSnapshots = { ...state.floorSnapshots };
      if (!nextSnapshots[targetF]) {
        nextSnapshots[targetF] = createSnapshot(state);
      }

      return {
        ...state,
        currentFloor: targetF,
        maxFloorReached: nextMaxFloor,
        floors: nextFloors,
        hero: { ...state.hero, x: lx, y: ly },
        floorSnapshots: nextSnapshots,
        steps: state.steps + 1,
        undoStack: [...state.undoStack, createSnapshot(state)],
        events: [{ type: 'floor_change', from: state.currentFloor, to: targetF }],
      };
    }

    // E. 遭遇怪物战斗 (Monster)
    const monId = floorObj.monsters[cell];
    if (monId) {
      const monster = MONSTERS[monId];
      const battle = calculateBattle(state.hero, monster);

      if (!battle.canWin) {
        return { ...state, events: [{ type: 'cannot_fight', monster, damage: battle.damage }] };
      }

      // 扣除战损并收割经验金币
      const nextHp = state.hero.hp - battle.damage;
      const nextGold = state.hero.gold + (monster.gold || 0);

      const curMap = floorObj.map.map((r) => [...r]);
      curMap[ny][nx] = '.';

      // 若消灭了特定 Boss，同时解开铁门
      if (monster.isBoss) {
        for (let y = 0; y < GRID; y++) {
          for (let x = 0; x < GRID; x++) {
            if (curMap[y][x] === 'M') curMap[y][x] = '.';
          }
        }
      }

      const nextFloors = [...state.floors];
      nextFloors[curFIdx] = { ...floorObj, map: curMap };

      const isFinalBoss = monster.id === 'boss_true_demon';
      const nextStatus = isFinalBoss ? 'won' : 'playing';

      return {
        ...state,
        status: nextStatus,
        floors: nextFloors,
        hero: {
          ...state.hero,
          x: nx,
          y: ny,
          hp: nextHp,
          gold: nextGold,
        },
        steps: state.steps + 1,
        undoStack: [...state.undoStack, createSnapshot(state)],
        events: [
          { type: 'combat', monster, damage: battle.damage, turns: battle.turns },
          ...(isFinalBoss ? [{ type: 'victory' }] : []),
        ],
      };
    }

    // F. 遭遇道具 / 钥匙 / 宝石 / 神装法宝
    const item = ITEMS[cell];
    if (item) {
      const nextHero = { ...state.hero, x: nx, y: ny };

      if (item.type === 'key') {
        nextHero.keys = {
          ...nextHero.keys,
          [item.keyType]: nextHero.keys[item.keyType] + 1,
        };
      } else if (item.type === 'gem') {
        nextHero[item.stat] += item.val;
      } else if (item.type === 'potion') {
        nextHero.hp += item.val;
      } else if (item.type === 'gold') {
        nextHero.gold += item.val;
      } else if (item.type === 'equip') {
        nextHero[item.stat] += item.val;
      } else if (item.type === 'relic') {
        if (item.relicKey === 'holyCross') {
          nextHero.relics.holyCross = true;
          nextHero.hp = Math.round(nextHero.hp * 1.33);
          nextHero.atk = Math.round(nextHero.atk * 1.33);
          nextHero.def = Math.round(nextHero.def * 1.33);
        } else if (item.relicKey === 'holyWater') {
          nextHero.relics.holyWater = (nextHero.relics.holyWater || 0) + 1;
        } else if (item.relicKey === 'earthquake') {
          nextHero.relics.earthquake = (nextHero.relics.earthquake || 0) + 1;
        } else if (item.relicKey === 'pickaxe') {
          nextHero.relics.pickaxe = (nextHero.relics.pickaxe || 0) + 1;
        } else if (item.relicKey === 'dragonSlayer') {
          nextHero.relics.dragonSlayer = true;
        } else if (item.relicKey === 'wings') {
          nextHero.relics.wings = true;
        }
      }

      const curMap = floorObj.map.map((r) => [...r]);
      curMap[ny][nx] = '.';
      const nextFloors = [...state.floors];
      nextFloors[curFIdx] = { ...floorObj, map: curMap };

      return {
        ...state,
        floors: nextFloors,
        hero: nextHero,
        steps: state.steps + 1,
        undoStack: [...state.undoStack, createSnapshot(state)],
        events: [{ type: 'pickup', item, x: nx, y: ny }],
      };
    }

    // G. 普通空地前进 (Floor)
    if (cell === '.') {
      return {
        ...state,
        hero: { ...state.hero, x: nx, y: ny },
        steps: state.steps + 1,
        undoStack: [...state.undoStack, createSnapshot(state)],
        events: [{ type: 'move', x: nx, y: ny }],
      };
    }
  }

  return { ...state, events: [] };
}

/**
 * 创建轻量快照（用于撤销栈与楼层时光锚点）
 */
function createSnapshot(state) {
  return {
    mode: state.mode,
    currentFloor: state.currentFloor,
    maxFloorReached: state.maxFloorReached,
    hero: {
      ...state.hero,
      keys: { ...state.hero.keys },
      relics: { ...state.hero.relics },
    },
    status: state.status,
    steps: state.steps,
    elapsedTime: state.elapsedTime,
    // 楼层网格走深层复制
    floors: state.floors.map((f) => ({
      ...f,
      map: f.map.map((r) => [...r]),
      monsters: { ...f.monsters },
    })),
  };
}
