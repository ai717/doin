// main.mjs — Main entry point: event bindings, UI rendering, and language synchronization
import { RamenGame } from "./game.mjs";
import { AtmosphereRenderer } from "./render.mjs";
import * as audio from "./audio.mjs";
import * as i18n from "./i18n.mjs";
import * as engine from "./engine.mjs";

const $ = (id) => document.getElementById(id);

export const TEXT_MAP = {
  "back-text": "backHome",
  "app-title-main": "gameTitle",
  "app-subtitle": "appSubtitle",
  "rush-banner-text": "rushHourBanner",
  "label-rush-btn": "rushButton",
  "label-coins": "labelCoins",
  "label-rps": "labelRps",
  "label-tier": "labelTier",
  "label-shift": "labelShift",
  "tab-btn-kitchen": "tabKitchen",
  "tab-btn-recipes": "tabRecipes",
  "tab-btn-guests": "tabGuests",
  "tab-btn-shop": "tabShop",
  "guide-title": "rulesBtn",
  "offline-title": "offlineTitle",
  "offline-greeting": "offlineGreeting",
  "offline-message": "offlineMessage",
  "btn-claim-offline": "claimBtn",
  "unit-rps": "perSec",
};

let game = null;
let renderer = null;
let currentTab = "kitchen";
let toastTimeout = null;

function showToast(text) {
  const el = $("toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("visible");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.classList.remove("visible");
  }, 2200);
}

function updateStaticTexts(lang) {
  document.documentElement.lang = i18n.htmlLang(lang);
  document.title = i18n.t("docTitle", lang);

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute("content", i18n.t("metaDesc", lang));
  }

  for (const [id, key] of Object.entries(TEXT_MAP)) {
    const el = $(id);
    if (el) {
      el.textContent = i18n.t(key, lang);
    }
  }

  const btnLang = $("btn-lang");
  if (btnLang) {
    btnLang.textContent = i18n.t("langSwitch", lang);
  }

  const guideText = $("guide-text");
  if (guideText) {
    guideText.textContent = i18n.t("guideContent", lang);
  }

  const noren1 = $("noren-1");
  const noren2 = $("noren-2");
  const noren3 = $("noren-3");
  if (noren1) noren1.textContent = i18n.t("norenFlap1", lang);
  if (noren2) noren2.textContent = i18n.t("norenFlap2", lang);
  if (noren3) noren3.textContent = i18n.t("norenFlap3", lang);
}

function updateFinanceBoard(state, lang) {
  const coinsVal = $("coins-val");
  if (coinsVal) coinsVal.textContent = state.coins.toLocaleString();

  const rpsVal = $("rps-val");
  const currentRps = engine.calculateRevenuePerSecond(state);
  if (rpsVal) rpsVal.textContent = currentRps.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const tierBadgeVal = $("tier-badge-val");
  const tierDef = engine.SHOP_TIERS[state.shopTier] || engine.SHOP_TIERS[0];
  if (tierBadgeVal) tierBadgeVal.textContent = i18n.t(tierDef.id, lang);

  const shiftClockVal = $("shift-clock-val");
  const shiftId = engine.SHIFT_IDS[state.shiftIndex] || "shift_dinner";
  if (shiftClockVal) shiftClockVal.textContent = i18n.t(shiftId, lang);

  const rushIncomeVal = $("rush-income-val");
  if (rushIncomeVal) {
    const rushAmount = engine.getRushClickIncome(state);
    rushIncomeVal.textContent = rushAmount.toLocaleString();
  }

  const rushBanner = $("rush-banner");
  const countdownEl = $("rush-countdown");
  const isRushShift = shiftId === "shift_rush" || state.rushRushActive;
  if (rushBanner) {
    if (isRushShift) {
      rushBanner.classList.remove("hidden");
      if (countdownEl) {
        countdownEl.textContent = state.rushRushActive
          ? `${Math.ceil(state.rushRemainingSeconds)}s`
          : "00:00 - 02:00";
      }
    } else {
      rushBanner.classList.add("hidden");
    }
  }
}

function renderKitchenTab(state, lang) {
  const container = $("stations-list");
  if (!container) return;
  container.innerHTML = "";

  for (const sid of engine.STATION_IDS) {
    const sDef = engine.STATION_DEFS[sid];
    const sState = state.stations[sid];
    const sCost = engine.getStationCost(sid, sState.level);
    const canAffordStation = state.coins >= sCost;

    const wDef = engine.WORKER_DEFS[sDef.workerId];
    const wState = state.workers[sDef.workerId];
    const wCost = engine.getWorkerCost(sDef.workerId, wState.level);
    const canAffordWorker = state.coins >= wCost;

    const card = document.createElement("div");
    card.className = "station-card";

    const header = document.createElement("div");
    header.className = "station-header";
    header.innerHTML = `
      <span class="station-name">${i18n.t(`station_${sid}`, lang)}</span>
      <span class="station-level">${i18n.t("level", lang, { lvl: sState.level })}</span>
    `;

    const desc = document.createElement("div");
    desc.className = "station-desc";
    desc.textContent = i18n.t(`stationDesc_${sid}`, lang);

    const actions = document.createElement("div");
    actions.className = "station-actions";

    const btnUpgradeStation = document.createElement("button");
    btnUpgradeStation.className = "action-btn primary-btn";
    btnUpgradeStation.type = "button";
    btnUpgradeStation.disabled = !canAffordStation;
    btnUpgradeStation.innerHTML = `
      <span>${i18n.t("promoteLvl", lang)}</span>
      <span>¥${sCost.toLocaleString()}</span>
    `;
    btnUpgradeStation.addEventListener("click", () => {
      audio.initAudioOnGesture();
      const res = game.upgradeStation(sid);
      if (res.success) {
        audio.playUpgrade();
        showToast(i18n.t("toastUpgrade", lang));
      }
    });

    const btnWorker = document.createElement("button");
    btnWorker.className = "action-btn";
    btnWorker.type = "button";
    btnWorker.disabled = !canAffordWorker;
    btnWorker.innerHTML = `
      <span>${i18n.t(wDef.id, lang)} (${wState.level})</span>
      <span>¥${wCost.toLocaleString()}</span>
    `;
    btnWorker.addEventListener("click", () => {
      audio.initAudioOnGesture();
      const res = game.hireWorker(sDef.workerId);
      if (res.success) {
        audio.playUpgrade();
        showToast(i18n.t("toastHire", lang));
      }
    });

    actions.appendChild(btnUpgradeStation);
    actions.appendChild(btnWorker);

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(actions);

    container.appendChild(card);
  }
}

function renderRecipesTab(state, lang) {
  const container = $("recipes-list");
  if (!container) return;
  container.innerHTML = "";

  for (const rid of engine.RECIPE_IDS) {
    const rDef = engine.RECIPE_DEFS[rid];
    const isUnlocked = state.recipes.includes(rid);

    const card = document.createElement("div");
    card.className = `recipe-card ${isUnlocked ? "unlocked" : "locked"}`;

    const top = document.createElement("div");
    top.className = "recipe-top";
    top.innerHTML = `
      <span class="recipe-title">${i18n.t(rid, lang)}</span>
      <span class="recipe-multiplier">×${rDef.multiplier.toFixed(1)}</span>
    `;

    const story = document.createElement("div");
    story.className = "recipe-story";
    story.textContent = i18n.t(`recipeDesc_${rid.replace("recipe_", "")}`, lang);

    card.appendChild(top);
    card.appendChild(story);

    if (isUnlocked) {
      const tag = document.createElement("span");
      tag.className = "station-level";
      tag.textContent = i18n.t("developed", lang);
      card.appendChild(tag);
    } else {
      const reqMet =
        state.shopTier >= rDef.reqTier &&
        state.bowlsServed >= rDef.reqBowls &&
        (!rDef.reqGuest || state.guests.includes(rDef.reqGuest));
      const canAfford = state.coins >= rDef.cost;

      const reqHint = document.createElement("div");
      reqHint.className = "station-desc";
      const reqTierName = i18n.t(engine.SHOP_TIERS[rDef.reqTier].id, lang);
      reqHint.textContent = `${i18n.t("reqTier", lang, { tier: reqTierName })} · ${i18n.t("reqBowls", lang, { bowls: rDef.reqBowls })}`;

      const btnDev = document.createElement("button");
      btnDev.className = "action-btn primary-btn";
      btnDev.type = "button";
      btnDev.disabled = !reqMet || !canAfford;
      btnDev.innerHTML = `
        <span>${i18n.t("developRecipe", lang)}</span>
        <span>¥${rDef.cost.toLocaleString()}</span>
      `;
      btnDev.addEventListener("click", () => {
        audio.initAudioOnGesture();
        const res = game.unlockRecipe(rid);
        if (res.success) {
          audio.playUnlock();
          showToast(i18n.t("toastRecipe", lang, { name: i18n.t(rid, lang) }));
        }
      });

      card.appendChild(reqHint);
      card.appendChild(btnDev);
    }

    container.appendChild(card);
  }
}

function renderGuestsTab(state, lang) {
  const container = $("guests-list");
  if (!container) return;
  container.innerHTML = "";

  for (const gid of engine.GUEST_IDS) {
    const gDef = engine.GUEST_DEFS[gid];
    const isMet = state.guests.includes(gid);

    const card = document.createElement("div");
    card.className = `guest-card ${isMet ? "unlocked" : "locked"}`;

    const top = document.createElement("div");
    top.className = "guest-top";
    top.innerHTML = `
      <span class="guest-title">${isMet ? i18n.t(gid, lang) : "???"}</span>
      <span class="guest-bonus">${i18n.t("tipBonus", lang, { bonus: Math.round(gDef.tipBonus * 100) })}</span>
    `;

    const story = document.createElement("div");
    story.className = "guest-story";
    story.textContent = isMet
      ? i18n.t(`guestStory_${gid.replace("guest_", "")}`, lang)
      : `${i18n.t("guestLocked", lang)} (${state.bowlsServed}/${gDef.reqBowls})`;

    card.appendChild(top);
    card.appendChild(story);

    if (isMet) {
      const fav = document.createElement("div");
      fav.className = "station-desc";
      fav.textContent = i18n.t("favRecipe", lang, { recipe: i18n.t(gDef.favoriteRecipe, lang) });
      card.appendChild(fav);
    }

    container.appendChild(card);
  }
}

function renderShopTab(state, lang) {
  const container = $("shop-controls");
  if (!container) return;
  container.innerHTML = "";

  // 1. Shop tier expansion
  const currentTier = engine.SHOP_TIERS[state.shopTier];
  const nextTierIndex = state.shopTier + 1;
  const nextTier = engine.SHOP_TIERS[nextTierIndex];

  const tierBlock = document.createElement("div");
  tierBlock.className = "shop-card-block";

  const tierTitle = document.createElement("div");
  tierTitle.className = "block-title";
  tierTitle.textContent = `${i18n.t("expandShop", lang)}: ${i18n.t(currentTier.id, lang)}`;

  const tierDesc = document.createElement("div");
  tierDesc.className = "block-desc";
  tierDesc.textContent = i18n.t(`tierDesc_${currentTier.id.replace("tier_", "")}`, lang);

  tierBlock.appendChild(tierTitle);
  tierBlock.appendChild(tierDesc);

  if (nextTier) {
    const canExpand = state.totalCoinsEarned >= nextTier.reqRevenue && state.coins >= nextTier.upgradeCost;
    const btnExpand = document.createElement("button");
    btnExpand.className = "action-btn primary-btn";
    btnExpand.type = "button";
    btnExpand.disabled = !canExpand;
    btnExpand.innerHTML = `
      <span>${i18n.t("expandShop", lang)} (${i18n.t(nextTier.id, lang)})</span>
      <span>¥${nextTier.upgradeCost.toLocaleString()}</span>
    `;
    btnExpand.addEventListener("click", () => {
      audio.initAudioOnGesture();
      const res = game.upgradeShopTier();
      if (res.success) {
        audio.playUnlock();
        showToast(i18n.t("toastTier", lang, { name: i18n.t(nextTier.id, lang) }));
      }
    });

    const reqLabel = document.createElement("div");
    reqLabel.className = "station-desc";
    reqLabel.textContent = i18n.t("expandReq", lang, { req: nextTier.reqRevenue.toLocaleString() });

    tierBlock.appendChild(reqLabel);
    tierBlock.appendChild(btnExpand);
  } else {
    const maxTag = document.createElement("div");
    maxTag.className = "station-level";
    maxTag.textContent = i18n.t("maxTier", lang);
    tierBlock.appendChild(maxTag);
  }

  // 2. Keep lanterns lit upgrade
  const lanternBlock = document.createElement("div");
  lanternBlock.className = "shop-card-block";
  lanternBlock.innerHTML = `
    <div class="block-title">🏮 ${i18n.t("lanterns_lit", lang)}</div>
    <div class="block-desc">${i18n.t("lanterns_lit_desc", lang)}</div>
  `;
  if (state.upgrades.lanterns_lit) {
    const ownedTag = document.createElement("div");
    ownedTag.className = "station-level";
    ownedTag.textContent = i18n.t("owned", lang);
    lanternBlock.appendChild(ownedTag);
  } else {
    const canBuyLantern = state.shopTier >= 1 && state.coins >= 10000;
    const btnLantern = document.createElement("button");
    btnLantern.className = "action-btn primary-btn";
    btnLantern.type = "button";
    btnLantern.disabled = !canBuyLantern;
    btnLantern.innerHTML = `
      <span>${i18n.t("lanterns_lit", lang)}</span>
      <span>¥10,000</span>
    `;
    btnLantern.addEventListener("click", () => {
      audio.initAudioOnGesture();
      const res = game.buySpecialUpgrade("lanterns_lit");
      if (res.success) {
        audio.playUpgrade();
      }
    });
    lanternBlock.appendChild(btnLantern);
  }

  // 3. Refurbish (Prestige)
  const prestigeBlock = document.createElement("div");
  prestigeBlock.className = "shop-card-block";
  prestigeBlock.innerHTML = `
    <div class="block-title">⭐ ${i18n.t("refurbishTitle", lang)}</div>
    <div class="block-desc">${i18n.t("refurbishDesc", lang)}</div>
    <div class="station-desc">${i18n.t("refurbishCount", lang, { count: state.prestigeCount, mult: state.prestigeMultiplier.toFixed(1) })}</div>
  `;
  const canPrestige = state.shopTier >= 4;
  const btnPrestige = document.createElement("button");
  btnPrestige.className = "action-btn primary-btn";
  btnPrestige.type = "button";
  btnPrestige.disabled = !canPrestige;
  btnPrestige.textContent = i18n.t("refurbishBtn", lang);
  btnPrestige.addEventListener("click", () => {
    audio.initAudioOnGesture();
    const res = game.prestige();
    if (res.success) {
      audio.playPrestige();
      showToast(i18n.t("toastPrestige", lang));
    }
  });
  prestigeBlock.appendChild(btnPrestige);

  // 4. Statistics block
  const statsBlock = document.createElement("div");
  statsBlock.className = "shop-card-block";
  statsBlock.innerHTML = `
    <div class="block-title">📊 ${i18n.t("statsTitle", lang)}</div>
    <div class="station-desc">${i18n.t("statTotalEarned", lang, { val: state.totalCoinsEarned.toLocaleString() })}</div>
    <div class="station-desc">${i18n.t("statBowlsServed", lang, { val: state.bowlsServed.toLocaleString() })}</div>
  `;

  container.appendChild(tierBlock);
  container.appendChild(lanternBlock);
  container.appendChild(prestigeBlock);
  container.appendChild(statsBlock);
}

function renderActiveTab(state, lang) {
  if (currentTab === "kitchen") renderKitchenTab(state, lang);
  else if (currentTab === "recipes") renderRecipesTab(state, lang);
  else if (currentTab === "guests") renderGuestsTab(state, lang);
  else if (currentTab === "shop") renderShopTab(state, lang);
}

function checkOfflineRewardModal(lang) {
  if (!game.pendingOfflineReward) return;
  const reward = game.pendingOfflineReward;
  const modal = $("modal-offline");
  if (!modal) return;

  const earnedText = $("offline-earned-text");
  if (earnedText) earnedText.textContent = `+${reward.earnedCoins.toLocaleString()} ${i18n.t("yenSuffix", lang)}`;

  const effText = $("offline-eff-text");
  if (effText) effText.textContent = i18n.t("offlineEfficiency", lang, { eff: Math.round(reward.efficiency * 100) });

  const milestoneText = $("offline-milestone-text");
  if (milestoneText) milestoneText.textContent = i18n.t("offlineMilestones", lang, { mult: reward.milestones.totalMultiplier });

  modal.classList.remove("hidden");
}

export function init() {
  let lang = i18n.getStoredLang();
  game = new RamenGame();

  const canvas = $("stage-canvas");
  if (canvas) {
    renderer = new AtmosphereRenderer(canvas);
    renderer.start();
  }

  updateStaticTexts(lang);
  game.init();

  checkOfflineRewardModal(lang);

  game.subscribe((state, event) => {
    updateFinanceBoard(state, lang);

    if (event.type === "STATE_CHANGE" || event.type === "UPGRADE_STATION" || event.type === "UPGRADE_WORKER" || event.type === "UNLOCK_RECIPE" || event.type === "UPGRADE_SHOP_TIER" || event.type === "BUY_SPECIAL_UPGRADE" || event.type === "REFURBISH_PRESTIGE") {
      renderActiveTab(state, lang);
    } else if (event.type === "TICK") {
      const btns = document.querySelectorAll(".action-btn");
      if (btns.length > 0 && Math.random() < 0.2) {
        renderActiveTab(state, lang);
      }
    }
  });

  const btnRush = $("btn-rush");
  if (btnRush) {
    btnRush.addEventListener("click", () => {
      audio.initAudioOnGesture();
      const res = game.rushClick();
      if (res.success) {
        audio.playCoin();
        if (renderer && canvas) {
          const rect = canvas.getBoundingClientRect();
          renderer.spawnSteam(rect.width * 0.5, rect.height * 0.55, 3);
          renderer.spawnFloatingYen(rect.width * 0.5, rect.height * 0.5, `+¥${res.income}`);
        }
      }
    });
  }

  const btnClaimOffline = $("btn-claim-offline");
  if (btnClaimOffline) {
    btnClaimOffline.addEventListener("click", () => {
      audio.initAudioOnGesture();
      const amount = game.claimPendingOffline();
      if (amount) {
        audio.playPrestige();
        showToast(`+${amount.toLocaleString()} ${i18n.t("yenSuffix", lang)}`);
      }
      const modal = $("modal-offline");
      if (modal) modal.classList.add("hidden");
    });
  }

  const btnSound = $("btn-sound");
  const soundIcon = $("sound-icon");
  if (btnSound) {
    btnSound.addEventListener("click", () => {
      audio.initAudioOnGesture();
      const muted = audio.toggleMuted();
      if (soundIcon) soundIcon.textContent = muted ? "🔇" : "🔊";
      btnSound.setAttribute("aria-label", muted ? i18n.t("soundOff", lang) : i18n.t("soundOn", lang));
    });
  }

  const btnLang = $("btn-lang");
  if (btnLang) {
    btnLang.addEventListener("click", () => {
      lang = lang === "zh" ? "en" : "zh";
      i18n.setStoredLang(lang);
      updateStaticTexts(lang);
      updateFinanceBoard(game.state, lang);
      renderActiveTab(game.state, lang);
    });
  }

  const btnHelp = $("btn-help");
  const modalGuide = $("modal-guide");
  const btnCloseGuide = $("btn-close-guide");
  if (btnHelp && modalGuide) {
    btnHelp.addEventListener("click", () => {
      modalGuide.classList.remove("hidden");
    });
  }
  if (btnCloseGuide && modalGuide) {
    btnCloseGuide.addEventListener("click", () => {
      modalGuide.classList.add("hidden");
    });
  }

  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.getAttribute("data-tab");

      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      const targetPanel = $(`panel-${currentTab}`);
      if (targetPanel) targetPanel.classList.add("active");

      renderActiveTab(game.state, lang);
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.code === "Space") {
      e.preventDefault();
      audio.initAudioOnGesture();
      const res = game.rushClick();
      if (res.success) {
        audio.playCoin();
        if (renderer && canvas) {
          const rect = canvas.getBoundingClientRect();
          renderer.spawnSteam(rect.width * 0.5, rect.height * 0.55, 3);
          renderer.spawnFloatingYen(rect.width * 0.5, rect.height * 0.5, `+¥${res.income}`);
        }
      }
    } else if (e.key === "1") {
      game.upgradeStation("prep");
    } else if (e.key === "2") {
      game.upgradeStation("stove");
    } else if (e.key === "3") {
      game.upgradeStation("counter");
    } else if (e.key === "4") {
      game.upgradeStation("seats");
    } else if (e.key === "r" || e.key === "R") {
      for (const rid of engine.RECIPE_IDS) {
        if (!game.state.recipes.includes(rid)) {
          const res = game.unlockRecipe(rid);
          if (res.success) {
            audio.playUnlock();
            break;
          }
        }
      }
    } else if (e.key === "e" || e.key === "E") {
      game.upgradeShopTier();
    } else if (e.key === "m" || e.key === "M") {
      audio.toggleMuted();
    }
  });

  renderActiveTab(game.state, lang);
  updateFinanceBoard(game.state, lang);
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", init);
}
