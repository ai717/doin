// game.mjs — State coordinator connecting engine, storage, and UI events
import * as engine from "./engine.mjs";
import * as storage from "./storage.mjs";

export class RamenGame {
  constructor() {
    this.state = storage.load();
    this.listeners = new Set();
    this.timerId = null;
    this.lastTickTime = performance.now();
    this.lastAutoSave = Date.now();
    this.pendingOfflineReward = null;
  }

  init() {
    // Check offline earnings
    const now = Date.now();
    const lastSave = this.state.lastSaveTime || now;
    const elapsedSeconds = Math.max(0, Math.floor((now - lastSave) / 1000));

    if (elapsedSeconds >= 10) {
      const offlineCalc = engine.calculateOfflineEarnings(this.state, elapsedSeconds);
      if (offlineCalc.earnedCoins > 0) {
        this.pendingOfflineReward = offlineCalc;
      }
    }

    this.startLoop();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event = { type: "STATE_CHANGE" }) {
    for (const listener of this.listeners) {
      try {
        listener(this.state, event);
      } catch {}
    }
  }

  startLoop() {
    if (this.timerId) return;
    this.lastTickTime = performance.now();
    this.timerId = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - this.lastTickTime) / 1000, 1.0);
      this.lastTickTime = now;

      const tickResult = engine.tick(this.state, dt);

      // Auto save every 4 seconds
      const wallNow = Date.now();
      if (wallNow - this.lastAutoSave >= 4000) {
        this.save();
        this.lastAutoSave = wallNow;
      }

      this.notify({ type: "TICK", tickResult });
    }, 100);
  }

  stopLoop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  save() {
    storage.save(this.state);
  }

  // User Actions
  rushClick() {
    const res = engine.performAction(this.state, { type: "RUSH_CLICK" });
    if (res.success) {
      this.notify({ type: "RUSH_CLICK", income: res.income, newGuests: res.newGuests });
    }
    return res;
  }

  upgradeStation(stationId) {
    const res = engine.performAction(this.state, { type: "UPGRADE_STATION", stationId });
    if (res.success) {
      this.save();
      this.notify({ type: "UPGRADE_STATION", stationId, newLevel: res.newLevel });
    }
    return res;
  }

  hireWorker(workerId) {
    const res = engine.performAction(this.state, { type: "HIRE_WORKER", workerId });
    if (res.success) {
      this.save();
      this.notify({ type: "UPGRADE_WORKER", workerId, newLevel: res.newLevel });
    }
    return res;
  }

  unlockRecipe(recipeId) {
    const res = engine.performAction(this.state, { type: "UNLOCK_RECIPE", recipeId });
    if (res.success) {
      this.save();
      this.notify({ type: "UNLOCK_RECIPE", recipeId });
    }
    return res;
  }

  upgradeShopTier() {
    const res = engine.performAction(this.state, { type: "UPGRADE_SHOP_TIER" });
    if (res.success) {
      this.save();
      this.notify({ type: "UPGRADE_SHOP_TIER", newTier: res.newTier });
    }
    return res;
  }

  buySpecialUpgrade(upgradeId) {
    const res = engine.performAction(this.state, { type: "BUY_SPECIAL_UPGRADE", upgradeId });
    if (res.success) {
      this.save();
      this.notify({ type: "BUY_SPECIAL_UPGRADE", upgradeId });
    }
    return res;
  }

  prestige() {
    const res = engine.performAction(this.state, { type: "REFURBISH_PRESTIGE" });
    if (res.success) {
      this.save();
      this.notify({ type: "REFURBISH_PRESTIGE", multiplier: res.newPrestigeMultiplier });
    }
    return res;
  }

  claimPendingOffline() {
    if (!this.pendingOfflineReward) return null;
    const reward = this.pendingOfflineReward.earnedCoins;
    const res = engine.performAction(this.state, { type: "CLAIM_OFFLINE", rewardCoins: reward });
    this.pendingOfflineReward = null;
    this.save();
    this.notify({ type: "CLAIM_OFFLINE", rewardCoins: reward });
    return reward;
  }
}
