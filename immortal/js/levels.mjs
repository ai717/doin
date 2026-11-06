/**
 * Immortal Box (摸鱼开箱修仙传) - Bosses & Abyss Scaling
 * Pure math and definitions, DOM-free.
 */

import { TRIBULATION_BOSSES } from './data.mjs';

export { TRIBULATION_BOSSES };

export function getBossById(id) {
  return TRIBULATION_BOSSES.find(b => b.id === id) || TRIBULATION_BOSSES[0];
}

export function calcAbyssBoss(floor) {
  const safeFloor = Math.max(1, Math.floor(floor));
  const baseHp = 1000 * Math.pow(1.18, safeFloor);
  const baseAtk = 120 * Math.pow(1.17, safeFloor);
  const baseDef = 50 * Math.pow(1.16, safeFloor);
  const spd = 20 + safeFloor * 4;

  const affixCycle = ['crit', 'dodge', 'counter', 'combo', 'stun', 'lifesteal'];
  const primaryAffix = affixCycle[safeFloor % affixCycle.length];
  const affixes = {
    [primaryAffix]: Math.min(50, 10 + safeFloor * 2)
  };

  return {
    id: `abyss_${safeFloor}`,
    floor: safeFloor,
    nameZh: `\u8BD5\u70BC\u5C42\u5996\u4ED9 \u7B2C${safeFloor}\u91CD`, // 试炼层妖仙 第N重
    enName: `Abyss Guardian F${safeFloor}`,
    hp: Math.round(baseHp),
    atk: Math.round(baseAtk),
    def: Math.round(baseDef),
    spd: Math.round(spd),
    affixes
  };
}
