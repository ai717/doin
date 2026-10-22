// game.mjs — Cat Cafe 状态协调器：连接 engine + storage + UI 事件
import * as engine from "./engine.mjs";
import * as storage from "./storage.mjs";
import * as i18n from "./i18n.mjs";

export class CatCafeGame {
  constructor() {
    this.state = storage.load();
    this.listeners = new Set();
    this.timerId = null;
    this.lastTickTime = 0;
    this.tickIndex = 0;
    this.lastAutoSave = 0;
    this.pendingOfflineBuckets = null;
  }

  init() {
    const now = Date.now();
    const lastSave = this.state.lastSaveTime || now;
    const elapsedSeconds = Math.max(0, Math.floor((now - lastSave) / 1000));

    if (elapsedSeconds >= 10) {
      const offlineCalc = engine.calculateOfflineEarnings(this.state, elapsedSeconds);
      if (offlineCalc.earnedCoins > 0) {
        const messageFn = (catId, visitIndex) => i18n.getCatMessage(catId, visitIndex, i18n.getStoredLang());
        const buckets = engine.generateOfflineBuckets(this.state, elapsedSeconds, messageFn);
        if (buckets.length > 0) {
          this.pendingOfflineBuckets = {
            buckets,
            earnedCoins: offlineCalc.earnedCoins,
            multiplier: offlineCalc.multiplier,
            efficiency: offlineCalc.efficiency,
            offlineSeconds: offlineCalc.offlineSeconds,
          };
        }
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

      engine.tick(this.state, dt, this.tickIndex);
      this.tickIndex += 1;

      const wallNow = Date.now();
      if (wallNow - this.lastAutoSave >= 4000) {
        this.save();
        this.lastAutoSave = wallNow;
      }

      this.notify({ type: "TICK" });
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

  // =========================================================================
  // 玩家合法操作分发
  // =========================================================================

  upgradeStation(stationId) {
    const res = engine.performAction(this.state, { type: "UPGRADE_STATION", stationId });
    if (res.success) {
      this.save();
      this.notify({ type: "UPGRADE_STATION", stationId, newLevel: res.newLevel });
    }
    return res;
  }

  upgradeCat(catId) {
    const res = engine.performAction(this.state, { type: "UPGRADE_CAT", catId });
    if (res.success) {
      this.save();
      this.notify({ type: "UPGRADE_CAT", catId, newLevel: res.newLevel });
    }
    return res;
  }

  unlockCat(catId) {
    const res = engine.performAction(this.state, { type: "UNLOCK_CAT", catId });
    if (res.success) {
      this.save();
      this.notify({ type: "UNLOCK_CAT", catId });
    }
    return res;
  }

  switchActiveCat(catId) {
    const res = engine.performAction(this.state, { type: "SWITCH_ACTIVE_CAT", catId });
    if (res.success) {
      this.save();
      this.notify({ type: "SWITCH_ACTIVE_CAT", catId });
    }
    return res;
  }

  unlockWindow(windowId) {
    const res = engine.performAction(this.state, { type: "UNLOCK_WINDOW", windowId });
    if (res.success) {
      this.save();
      this.notify({ type: "UNLOCK_WINDOW", windowId });
    }
    return res;
  }

  upgradeStage() {
    const res = engine.performAction(this.state, { type: "UPGRADE_STAGE" });
    if (res.success) {
      this.save();
      this.notify({ type: "UPGRADE_STAGE", newStage: res.newStage });
    }
    return res;
  }

  researchDrink(drinkId) {
    const res = engine.performAction(this.state, { type: "RESEARCH_DRINK", drinkId });
    if (res.success) {
      this.save();
      this.notify({ type: "RESEARCH_DRINK", drinkId });
    }
    return res;
  }

  switchActiveDrink(drinkId) {
    const res = engine.performAction(this.state, { type: "SWITCH_ACTIVE_DRINK", drinkId });
    if (res.success) {
      this.save();
      this.notify({ type: "SWITCH_ACTIVE_DRINK", drinkId });
    }
    return res;
  }

  serveGuest(guestId, drinkId) {
    const res = engine.performAction(this.state, { type: "SERVE_GUEST_DRINK", guestId, drinkId });
    if (res.success) {
      this.save();
      this.notify({ type: "SERVE_GUEST_DRINK", guestId, drinkId, isFavorite: res.isFavorite });
    }
    return res;
  }

  awakenCat(catId, currentTick, awakenTicks = 30) {
    const res = engine.performAction(this.state, { type: "AWAKEN_CAT", catId, currentTick, awakenTicks });
    if (res.success) {
      this.save();
      this.notify({ type: "AWAKEN_CAT", catId });
    }
    return res;
  }

  claimPendingOffline() {
    if (!this.pendingOfflineBuckets) return null;
    const buckets = this.pendingOfflineBuckets.buckets;
    const res = engine.performAction(this.state, { type: "CLAIM_OFFLINE", buckets });
    this.pendingOfflineBuckets = null;
    if (res.success) {
      this.save();
      this.notify({ type: "CLAIM_OFFLINE", rewardCoins: res.rewardCoins });
    }
    return res.success ? res.rewardCoins : null;
  }

  addStars(amount) {
    const res = engine.performAction(this.state, { type: "ADD_STARS", amount });
    if (res.success) {
      this.save();
      this.notify({ type: "ADD_STARS", amount });
    }
    return res;
  }
}