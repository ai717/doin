/**
 * Immortal Box (摸鱼开箱修仙传) - Pure Game Engine
 * 100% Deterministic, DOM-free.
 * Gear Generation, Hex-Synergy Combat Simulator, Offline Spirit Yield.
 */

import {
  SLOTS,
  SLOT_INFO,
  QUALITIES,
  QUALITY_INFO,
  AFFIXES,
  CAULDRON_TIERS,
  REALMS
} from './data.mjs';

export function createPRNG(seed = 123456789) {
  let s = Math.floor(seed) >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let uidCount = 1;
export function generateUid() {
  return `eq_${Date.now().toString(36)}_${uidCount++}`;
}

/**
 * Generate a random piece of equipment based on cauldron tier and player realm
 */
export function generateEquipment(cauldronLevel = 1, realmId = 1, rand = Math.random) {
  const safeCauldron = Math.max(1, Math.min(15, cauldronLevel));
  const tierConfig = CAULDRON_TIERS[safeCauldron - 1];
  const safeRealm = Math.max(1, Math.min(21, realmId));

  // Determine quality via probability table
  const roll = rand();
  let acc = 0;
  let qualityKey = QUALITIES.COMMON;
  const qualityKeys = [
    QUALITIES.COMMON,
    QUALITIES.FINE,
    QUALITIES.RARE,
    QUALITIES.EPIC,
    QUALITIES.LEGENDARY,
    QUALITIES.MYTHIC
  ];

  for (let i = 0; i < qualityKeys.length; i++) {
    acc += tierConfig.rates[i];
    if (roll <= acc) {
      qualityKey = qualityKeys[i];
      break;
    }
  }

  const qInfo = QUALITY_INFO[qualityKey];

  // Pick slot randomly
  const allSlots = Object.values(SLOTS);
  const slot = allSlots[Math.floor(rand() * allSlots.length)];
  const sInfo = SLOT_INFO[slot];

  // Base stats scaled by realm and quality
  const realmScale = 1 + (safeRealm - 1) * 0.45;
  const qMult = qInfo.statMult;

  const baseHp = Math.round((120 + safeRealm * 55) * qMult * (slot === SLOTS.HAT || slot === SLOTS.PENDANT ? 1.8 : 0.8));
  const baseAtk = Math.round((25 + safeRealm * 12) * qMult * (slot === SLOTS.SWORD || slot === SLOTS.WHISK || slot === SLOTS.MIRROR ? 1.8 : 0.7));
  const baseDef = Math.round((14 + safeRealm * 7) * qMult * (slot === SLOTS.ROBE || slot === SLOTS.BAG ? 1.8 : 0.7));
  const baseSpd = Math.round((8 + safeRealm * 3) * qMult * (slot === SLOTS.BOOTS ? 2.0 : 0.8));

  // Secondary Affixes
  const availableAffixes = Object.values(AFFIXES);
  const pickedAffixes = {};
  const affixCount = qInfo.affixCount;

  // Shuffle affixes
  const shuffled = [...availableAffixes].sort(() => rand() - 0.5);
  for (let a = 0; a < affixCount; a++) {
    const aff = shuffled[a];
    // Affix value: 2% to 6% per quality tier
    const baseVal = 2.0 + qInfo.tier * 1.5;
    const variation = (rand() * 2.0) - 1.0;
    pickedAffixes[aff] = Math.round((baseVal + variation) * 10) / 10;
  }

  // Calculate score/CP
  const cp = Math.round(baseHp * 0.2 + baseAtk * 1.8 + baseDef * 1.4 + baseSpd * 1.2 +
    Object.values(pickedAffixes).reduce((sum, v) => sum + v * 35, 0));

  return {
    uid: generateUid(),
    slot,
    quality: qualityKey,
    level: safeRealm,
    hp: baseHp,
    atk: baseAtk,
    def: baseDef,
    spd: baseSpd,
    affixes: pickedAffixes,
    cp,
    nameZh: `${qInfo.nameZh}·${sInfo.nameZh}`,
    enName: `${qInfo.enName} ${sInfo.enName}`,
    icon: sInfo.icon,
    color: qInfo.color
  };
}

/**
 * Calculate aggregate stats for player given realm and equipped items
 */
export function calculatePlayerStats(realmId = 1, equipment = {}) {
  const safeRealm = Math.max(1, Math.min(21, realmId));
  const rInfo = REALMS[safeRealm - 1];

  let hp = 150 + rInfo.bonusHp;
  let atk = 25 + rInfo.bonusAtk;
  let def = 10 + rInfo.bonusDef;
  let spd = 12 + safeRealm * 2;

  const affixes = {
    [AFFIXES.CRIT]: 5.0, // Base 5% crit
    [AFFIXES.DODGE]: 5.0, // Base 5% dodge
    [AFFIXES.COUNTER]: 0.0,
    [AFFIXES.COMBO]: 0.0,
    [AFFIXES.STUN]: 0.0,
    [AFFIXES.LIFESTEAL]: 0.0,
  };

  for (const item of Object.values(equipment)) {
    if (!item) continue;
    hp += item.hp || 0;
    atk += item.atk || 0;
    def += item.def || 0;
    spd += item.spd || 0;

    if (item.affixes) {
      for (const [k, v] of Object.entries(item.affixes)) {
        if (typeof affixes[k] === 'number') {
          affixes[k] += v;
        }
      }
    }
  }

  // Cap dodge at 75% to prevent infinite stalemates
  affixes[AFFIXES.DODGE] = Math.min(75.0, affixes[AFFIXES.DODGE]);
  affixes[AFFIXES.CRIT] = Math.min(85.0, affixes[AFFIXES.CRIT]);
  affixes[AFFIXES.STUN] = Math.min(50.0, affixes[AFFIXES.STUN]);

  // Aggregate Combat Power (战力 CP)
  const cp = Math.round(
    hp * 0.25 +
    atk * 2.2 +
    def * 1.8 +
    spd * 1.5 +
    affixes.crit * 45 +
    affixes.dodge * 50 +
    affixes.counter * 40 +
    affixes.combo * 42 +
    affixes.stun * 55 +
    affixes.lifesteal * 45
  );

  return {
    realmId: safeRealm,
    hp,
    maxHp: hp,
    atk,
    def,
    spd,
    affixes,
    cp
  };
}

/**
 * Hex-Synergy Turn-based Combat Simulator
 */
export function simulateCombat(pStats, bStats, rand = Math.random) {
  let playerHp = pStats.hp;
  let bossHp = bStats.hp;

  const logs = [];
  let playerStunned = false;
  let bossStunned = false;

  // Determine initiative
  const playerFirst = pStats.spd >= bStats.spd;
  const maxTurns = 30;

  for (let turn = 1; turn <= maxTurns; turn++) {
    if (playerHp <= 0 || bossHp <= 0) break;

    const roundOrder = playerFirst ? ['player', 'boss'] : ['boss', 'player'];

    for (const actor of roundOrder) {
      if (playerHp <= 0 || bossHp <= 0) break;

      if (actor === 'player') {
        if (playerStunned) {
          logs.push({ turn, actor: 'player', action: 'stunned', textKey: 'combat_player_stunned' });
          playerStunned = false;
          continue;
        }

        // Player attacks Boss
        const attackResult = executeAttack(pStats, bStats, rand, 'player');
        bossHp -= attackResult.damage;
        playerHp += attackResult.lifesteal;
        if (attackResult.stun) bossStunned = true;

        logs.push({
          turn,
          actor: 'player',
          ...attackResult,
          targetHp: Math.max(0, bossHp)
        });

        // Boss counter attack?
        if (bossHp > 0 && attackResult.damage > 0 && bStats.affixes?.counter) {
          if (rand() * 100 < bStats.affixes.counter) {
            const counterDmg = Math.max(1, Math.round(attackResult.damage * 0.45));
            playerHp -= counterDmg;
            logs.push({
              turn,
              actor: 'boss',
              action: 'counter',
              damage: counterDmg,
              targetHp: Math.max(0, playerHp)
            });
          }
        }

        // Player combo attack?
        if (bossHp > 0 && pStats.affixes?.combo && rand() * 100 < pStats.affixes.combo) {
          const comboResult = executeAttack(pStats, bStats, rand, 'player', true);
          bossHp -= comboResult.damage;
          playerHp += comboResult.lifesteal;
          logs.push({
            turn,
            actor: 'player',
            ...comboResult,
            action: 'combo',
            targetHp: Math.max(0, bossHp)
          });
        }
      } else {
        if (bossStunned) {
          logs.push({ turn, actor: 'boss', action: 'stunned', textKey: 'combat_boss_stunned' });
          bossStunned = false;
          continue;
        }

        // Boss attacks Player
        const attackResult = executeAttack(bStats, pStats, rand, 'boss');
        playerHp -= attackResult.damage;
        bossHp += attackResult.lifesteal;
        if (attackResult.stun) playerStunned = true;

        logs.push({
          turn,
          actor: 'boss',
          ...attackResult,
          targetHp: Math.max(0, playerHp)
        });

        // Player counter attack?
        if (playerHp > 0 && attackResult.damage > 0 && pStats.affixes?.counter) {
          if (rand() * 100 < pStats.affixes.counter) {
            const counterDmg = Math.max(1, Math.round(attackResult.damage * 0.45));
            bossHp -= counterDmg;
            logs.push({
              turn,
              actor: 'player',
              action: 'counter',
              damage: counterDmg,
              targetHp: Math.max(0, bossHp)
            });
          }
        }

        // Boss combo attack?
        if (playerHp > 0 && bStats.affixes?.combo && rand() * 100 < bStats.affixes.combo) {
          const comboResult = executeAttack(bStats, pStats, rand, 'boss', true);
          playerHp -= comboResult.damage;
          bossHp += comboResult.lifesteal;
          logs.push({
            turn,
            actor: 'boss',
            ...comboResult,
            action: 'combo',
            targetHp: Math.max(0, playerHp)
          });
        }
      }
    }
  }

  const winner = playerHp > 0 && bossHp <= 0 ? 'player' : 'boss';

  return {
    winner,
    won: winner === 'player',
    remainingPlayerHp: Math.max(0, playerHp),
    remainingBossHp: Math.max(0, bossHp),
    logs
  };
}

function executeAttack(attacker, defender, rand, attackerType, isCombo = false) {
  const defDodge = defender.affixes?.dodge || 0;
  if (rand() * 100 < defDodge) {
    return {
      action: 'miss',
      damage: 0,
      crit: false,
      lifesteal: 0,
      stun: false
    };
  }

  // Base damage formula
  let baseDmg = Math.max(1, attacker.atk - Math.round(defender.def * 0.65));
  let isCrit = false;
  const atkCrit = attacker.affixes?.crit || 0;
  if (rand() * 100 < atkCrit) {
    isCrit = true;
    baseDmg = Math.round(baseDmg * 2.0);
  }

  if (isCombo) {
    baseDmg = Math.round(baseDmg * 0.75);
  }

  // Stun roll
  let isStun = false;
  const atkStun = attacker.affixes?.stun || 0;
  if (rand() * 100 < atkStun) {
    isStun = true;
  }

  // Lifesteal
  let lifestealHp = 0;
  const atkLifesteal = attacker.affixes?.lifesteal || 0;
  if (atkLifesteal > 0) {
    lifestealHp = Math.round(baseDmg * (atkLifesteal / 100));
  }

  return {
    action: isCrit ? 'crit' : 'hit',
    damage: baseDmg,
    crit: isCrit,
    lifesteal: lifestealHp,
    stun: isStun
  };
}

/**
 * Offline Spirit Yield Calculation
 */
export function calcOfflineGains(lastTime, currentTime, realmId = 1) {
  if (!lastTime || !currentTime || currentTime <= lastTime) {
    return { spiritStones: 0, cauldronStones: 0, elapsedSeconds: 0 };
  }

  const maxOfflineSeconds = 24 * 3600; // 24 hours cap
  const elapsedSeconds = Math.min(maxOfflineSeconds, Math.floor((currentTime - lastTime) / 1000));

  if (elapsedSeconds < 10) {
    return { spiritStones: 0, cauldronStones: 0, elapsedSeconds: 0 };
  }

  // Rate: 1..21 realm gives scaled yield
  const baseRateStones = 0.5 + realmId * 0.25; // stones per second
  const baseRateCauldron = 0.05 + realmId * 0.02; // cauldron stones per second

  const spiritStones = Math.round(elapsedSeconds * baseRateStones);
  const cauldronStones = Math.round(elapsedSeconds * baseRateCauldron);

  return {
    spiritStones,
    cauldronStones,
    elapsedSeconds
  };
}
