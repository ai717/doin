/**
 * Immortal Box (摸鱼开箱修仙传) - State Machine Controller
 * Pure DOM-free Game Controller.
 */

import {
  generateEquipment,
  calculatePlayerStats,
  simulateCombat,
  calcOfflineGains
} from './engine.mjs';
import { loadGameData, saveGameData } from './storage.mjs';
import { getBossById, calcAbyssBoss } from './levels.mjs';
import { CAULDRON_TIERS, REALMS, QUALITY_INFO } from './data.mjs';

export class GameController {
  constructor() {
    this.data = null;
    this.currentDrop = null;
    this.playerStats = null;
    this.isAutoOpening = false;
    this.offlineYield = null;
    this.combatState = null;
    this.onStateChange = null;
    this.onDrop = null;
    this.onCombatEnd = null;
  }

  init() {
    this.data = loadGameData();

    // Check offline gains
    const now = Date.now();
    const gains = calcOfflineGains(this.data.lastSaveTime, now, this.data.realmId);
    if (gains.elapsedSeconds >= 10 && gains.spiritStones > 0) {
      this.offlineYield = gains;
    }

    this._refreshStats();
  }

  claimOfflineGains() {
    if (!this.offlineYield) return;
    this.data.spiritStones += this.offlineYield.spiritStones;
    this.data.cauldronStones += this.offlineYield.cauldronStones;
    this.offlineYield = null;
    this._save();
    this._notify();
  }

  openCauldron() {
    if (this.data.cauldronStones < 1) {
      this.isAutoOpening = false;
      return { success: false, reason: 'no_cauldron_stones' };
    }

    this.data.cauldronStones -= 1;
    const newEquip = generateEquipment(this.data.cauldronLevel, this.data.realmId);
    this.currentDrop = newEquip;

    this._save();
    if (typeof this.onDrop === 'function') {
      this.onDrop(newEquip);
    }
    this._notify();

    return { success: true, drop: newEquip };
  }

  equipCurrentDrop() {
    if (!this.currentDrop) return { success: false };
    const item = this.currentDrop;
    const oldItem = this.data.equipment[item.slot] || null;

    this.data.equipment[item.slot] = item;
    this.currentDrop = null;

    // Add some EXP for equipping
    const qInfo = QUALITY_INFO[item.quality];
    this.data.exp += qInfo.tier * 10;
    this._checkRealmExp();

    this._refreshStats();
    this._save();
    this._notify();

    return { success: true, item, oldItem };
  }

  smeltCurrentDrop() {
    if (!this.currentDrop) return { success: false };
    const item = this.currentDrop;
    const qInfo = QUALITY_INFO[item.quality];

    const expGain = qInfo.tier * 15;
    const stoneGain = qInfo.tier * 25;

    this.data.exp += expGain;
    this.data.spiritStones += stoneGain;
    this.currentDrop = null;

    this._checkRealmExp();
    this._save();
    this._notify();

    return { success: true, expGain, stoneGain };
  }

  upgradeCauldron() {
    if (this.data.cauldronLevel >= 15) return { success: false, reason: 'max_level' };
    const currentTier = CAULDRON_TIERS[this.data.cauldronLevel - 1];
    if (this.data.spiritStones < currentTier.cost) {
      return { success: false, reason: 'insufficient_spirit_stones' };
    }

    this.data.spiritStones -= currentTier.cost;
    this.data.cauldronLevel += 1;

    this._save();
    this._notify();
    return { success: true, newLevel: this.data.cauldronLevel };
  }

  startTribulation() {
    if (this.data.realmId >= 21) {
      return { success: false, reason: 'already_ascended' };
    }

    const boss = getBossById(this.data.realmId);
    const combatRes = simulateCombat(this.playerStats, boss);
    this.combatState = {
      type: 'tribulation',
      boss,
      result: combatRes
    };

    if (combatRes.won) {
      this.data.realmId = Math.min(21, this.data.realmId + 1);
      this.data.exp = 0;
      this.data.spiritStones += 1000 * this.data.realmId;
      this.data.cauldronStones += 20;
      this._refreshStats();
    }

    this._save();
    this._notify();

    if (typeof this.onCombatEnd === 'function') {
      this.onCombatEnd(this.combatState);
    }

    return { success: true, result: combatRes };
  }

  startAbyssCombat(floor) {
    const targetFloor = floor || (this.data.highestAbyssFloor + 1);
    const boss = calcAbyssBoss(targetFloor);
    const combatRes = simulateCombat(this.playerStats, boss);

    this.combatState = {
      type: 'abyss',
      floor: targetFloor,
      boss,
      result: combatRes
    };

    if (combatRes.won && targetFloor > this.data.highestAbyssFloor) {
      this.data.highestAbyssFloor = targetFloor;
      this.data.spiritStones += targetFloor * 500;
      this.data.cauldronStones += 15;
    }

    this._save();
    this._notify();

    if (typeof this.onCombatEnd === 'function') {
      this.onCombatEnd(this.combatState);
    }

    return { success: true, result: combatRes };
  }

  _checkRealmExp() {
    const curRealm = REALMS[this.data.realmId - 1];
    if (this.data.exp >= curRealm.maxExp && this.data.realmId < 21) {
      // Ready to trigger tribulation
      this.data.exp = curRealm.maxExp;
    }
  }

  _refreshStats() {
    this.playerStats = calculatePlayerStats(this.data.realmId, this.data.equipment);
  }

  _save() {
    saveGameData(this.data);
  }

  _notify() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }

  getState() {
    return {
      data: this.data,
      playerStats: this.playerStats,
      currentDrop: this.currentDrop,
      isAutoOpening: this.isAutoOpening,
      offlineYield: this.offlineYield,
      combatState: this.combatState
    };
  }
}
