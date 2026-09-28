// ui.mjs — DOM 渲染与语言热更新（碰 DOM，但不存业务状态）
import * as engine from "./engine.mjs";
import * as i18n from "./i18n.mjs";
import * as score from "./score.mjs";

const $ = (id) => document.getElementById(id);

// 卡片 emoji 视觉锚点（纯装饰，与 i18n 文案解耦）
const GLYPHS = {
  station: { roast: "🔥", grind: "⚙️", extract: "☕", latte: "🥛", serve: "🪟" },
  drink: {
    espresso: "☕", americano: "🥤", latte: "🥛", cappuccino: "🧋",
    mocha: "🍫", macchiato: "🍮", matcha: "🍵", sunset: "🌅",
  },
  cat: { cat_orange: "🐈", cat_calico: "🐱", cat_british: "😺", cat_ragdoll: "😸" },
  guest: {
    guest_officecat: "💼", guest_writercat: "✍️", guest_retiredcat: "🎣", guest_yogacat: "🧘",
    guest_bloggercat: "📱", guest_studentcat: "🎒", guest_couplecat: "💞", guest_raincat: "☔",
    guest_kidcat: "🧒", guest_doctorncat: "🩺", guest_pianocat: "🎹", guest_straycat: "🐾",
  },
};

function glyphSpan(kind, id) {
  const span = document.createElement("span");
  span.className = "card-glyph";
  span.setAttribute("aria-hidden", "true");
  span.textContent = GLYPHS[kind]?.[id] || "🐾";
  return span;
}

let toastTimeout = null;

export function showToast(text) {
  const el = $("toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("visible");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.classList.remove("visible");
  }, 2200);
}

// =========================================================================
// 静态文本热更新（[data-i18n] 占位）
// =========================================================================

export function updateStaticTexts(lang) {
  document.documentElement.lang = i18n.htmlLang(lang);
  document.title = i18n.t("docTitle", lang);

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute("content", i18n.t("metaDesc", lang));
  }

  const nodes = document.querySelectorAll("[data-i18n]");
  for (const node of nodes) {
    const key = node.getAttribute("data-i18n");
    node.textContent = i18n.t(key, lang);
  }

  const guideText = $("guide-text");
  if (guideText) {
    guideText.textContent = i18n.t("guideContent", lang);
  }
}

// =========================================================================
// HUD 实时更新
// =========================================================================

export function renderHud(state, lang) {
  const coinsVal = $("coins-val");
  if (coinsVal) coinsVal.textContent = score.formatCoins(state.coins);

  const rpsVal = $("rps-val");
  if (rpsVal) {
    const rps = engine.calculateRevenuePerSecond(state, 0);
    rpsVal.textContent = rps.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  const starsVal = $("stars-val");
  if (starsVal) starsVal.textContent = score.formatStars(state.stars);

  const stageBadge = $("stage-badge-val");
  if (stageBadge) {
    const stageDef = engine.REPUTATION_STAGES[state.stage] || engine.REPUTATION_STAGES[0];
    stageBadge.textContent = i18n.t(stageDef.id, lang);
  }

  const bowlsVal = $("bowls-val");
  if (bowlsVal) bowlsVal.textContent = score.formatBowls(state.bowlsServed);

  const activeCatName = $("active-cat-name");
  if (activeCatName && state.activeCat) {
    activeCatName.textContent = i18n.t(state.activeCat, lang);
  }

  // 场景同步：解锁的窗口才出现轮换客人（stage 装饰随经营进度点亮）
  if (typeof document !== "undefined" && document.querySelectorAll) {
    const spots = document.querySelectorAll(".customer-spot");
    for (const spot of spots) {
      const wid = spot.getAttribute && spot.getAttribute("data-window");
      if (wid) spot.classList.toggle("unlocked", !!state.windows[wid]);
    }
  }
}

// =========================================================================
// Tab 1: 工位
// =========================================================================

export function renderStationsTab(state, lang, game) {
  const container = $("stations-list");
  if (!container) return;
  container.innerHTML = "";

  for (const sid of engine.STATION_IDS) {
    const sDef = engine.STATION_DEFS[sid];
    const sState = state.stations[sid];
    const cost = engine.getStationCost(sid, sState.level);
    const canAfford = state.coins >= cost;

    const catId = sDef.workerCat;
    const cState = catId ? state.cats[catId] : null;
    const catUnlocked = cState?.unlocked;

    const card = document.createElement("div");
    card.className = "station-card";
    card.appendChild(glyphSpan("station", sid));

    const header = document.createElement("div");
    header.className = "station-card-header";
    const titleSpan = document.createElement("span");
    titleSpan.className = "station-card-title";
    titleSpan.textContent = i18n.t(`station_${sid}`, lang);
    const levelSpan = document.createElement("span");
    levelSpan.className = "station-card-level";
    levelSpan.textContent = i18n.t("level", lang, { lvl: sState.level });
    header.appendChild(titleSpan);
    header.appendChild(levelSpan);

    const desc = document.createElement("div");
    desc.className = "station-card-desc";
    desc.textContent = i18n.t(`stationDesc_${sid}`, lang);

    const upgradeBtn = document.createElement("button");
    upgradeBtn.className = "action-btn primary-btn";
    upgradeBtn.type = "button";
    upgradeBtn.disabled = !canAfford;
    upgradeBtn.innerHTML = `<span>${i18n.t("upgradeStation", lang)}</span><span>${score.formatCoins(cost)} ${i18n.t("coinSuffix", lang)}</span>`;
    upgradeBtn.addEventListener("click", () => game.upgradeStation(sid));

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(upgradeBtn);

    // 猫掌柜区段（如果是绑定工位）
    if (catId) {
      const catSection = document.createElement("div");
      catSection.className = "station-card-cat";

      if (!catUnlocked) {
        const catDef = engine.CAT_DEFS[catId];
        const lockedTag = document.createElement("span");
        lockedTag.className = "cat-status-locked";
        lockedTag.textContent = `${i18n.t("locked", lang)} · ${i18n.t("reqStars", lang, { stars: catDef.unlockStars })}`;
        catSection.appendChild(lockedTag);
      } else {
        const catCost = engine.getCatCost(catId, cState.level);
        const canAffordCat = state.coins >= catCost;
        const upgradeCatBtn = document.createElement("button");
        upgradeCatBtn.className = "action-btn";
        upgradeCatBtn.type = "button";
        upgradeCatBtn.disabled = !canAffordCat;
        upgradeCatBtn.innerHTML = `<span>${i18n.t(catId, lang)} ${i18n.t("level", lang, { lvl: cState.level })}</span><span>${score.formatCoins(catCost)} ${i18n.t("coinSuffix", lang)}</span>`;
        upgradeCatBtn.addEventListener("click", () => game.upgradeCat(catId));

        if (state.activeCat === catId) {
          const activeTag = document.createElement("span");
          activeTag.className = "cat-status-active";
          activeTag.textContent = "▶";
          catSection.appendChild(activeTag);
        } else {
          const switchBtn = document.createElement("button");
          switchBtn.className = "cat-switch-btn";
          switchBtn.type = "button";
          switchBtn.textContent = i18n.t("switchCat", lang);
          switchBtn.addEventListener("click", () => game.switchActiveCat(catId));
          catSection.appendChild(switchBtn);
        }

        catSection.appendChild(upgradeCatBtn);

        // 摇小铃铛
        const awakenBtn = document.createElement("button");
        awakenBtn.className = "awaken-btn";
        awakenBtn.type = "button";
        awakenBtn.textContent = i18n.t("awakenCat", lang);
        awakenBtn.addEventListener("click", () => game.awakenCat(catId, game.tickIndex));
        catSection.appendChild(awakenBtn);
      }

      card.appendChild(catSection);
    }

    container.appendChild(card);
  }
}

// =========================================================================
// Tab 2: 饮品
// =========================================================================

export function renderDrinksTab(state, lang, game) {
  const container = $("drinks-list");
  if (!container) return;
  container.innerHTML = "";

  for (const did of engine.DRINK_IDS) {
    const dDef = engine.DRINK_DEFS[did];
    const isUnlocked = state.drinks.includes(did);
    const isActive = state.activeDrink === did;

    const card = document.createElement("div");
    card.className = `drink-card ${isUnlocked ? "unlocked" : "locked"} ${isActive ? "active" : ""}`;
    card.appendChild(glyphSpan("drink", did.replace("drink_", "")));

    const top = document.createElement("div");
    top.className = "drink-card-top";
    const title = document.createElement("span");
    title.className = "drink-card-title";
    title.textContent = i18n.t(did, lang);
    const mult = document.createElement("span");
    mult.className = "drink-card-mult";
    mult.textContent = `×${dDef.multiplier.toFixed(1)}`;
    top.appendChild(title);
    top.appendChild(mult);

    const desc = document.createElement("div");
    desc.className = "drink-card-desc";
    desc.textContent = i18n.t(`drinkDesc_${did.replace("drink_", "")}`, lang);

    card.appendChild(top);
    card.appendChild(desc);

    if (isUnlocked) {
      if (isActive) {
        const activeTag = document.createElement("span");
        activeTag.className = "drink-status-active";
        activeTag.textContent = i18n.t("activeDrink", lang, { drink: i18n.t(did, lang) });
        card.appendChild(activeTag);
      } else {
        const switchBtn = document.createElement("button");
        switchBtn.className = "action-btn";
        switchBtn.type = "button";
        switchBtn.textContent = i18n.t("switchDrink", lang);
        switchBtn.addEventListener("click", () => game.switchActiveDrink(did));
        card.appendChild(switchBtn);
      }
    } else {
      const reqMet = state.bowlsServed >= dDef.reqBowls;
      const canAfford = state.coins >= dDef.cost;
      const req = document.createElement("div");
      req.className = "drink-card-req";
      req.textContent = `${i18n.t("reqBowls", lang, { bowls: dDef.reqBowls })}`;
      card.appendChild(req);

      const btn = document.createElement("button");
      btn.className = "action-btn primary-btn";
      btn.type = "button";
      btn.disabled = !reqMet || !canAfford;
      btn.innerHTML = `<span>${i18n.t("researchDrink", lang)}</span><span>${score.formatCoins(dDef.cost)} ${i18n.t("coinSuffix", lang)}</span>`;
      btn.addEventListener("click", () => game.researchDrink(did));
      card.appendChild(btn);
    }

    container.appendChild(card);
  }
}

// =========================================================================
// Tab 3: 喵掌柜领养
// =========================================================================

export function renderCatsTab(state, lang, game) {
  const container = $("cats-list");
  if (!container) return;
  container.innerHTML = "";

  for (const cid of engine.CAT_IDS) {
    const cDef = engine.CAT_DEFS[cid];
    const cState = state.cats[cid];
    const isUnlocked = cState.unlocked;

    const card = document.createElement("div");
    card.className = `cat-card ${isUnlocked ? "unlocked" : "locked"} ${state.activeCat === cid ? "active" : ""}`;
    card.appendChild(glyphSpan("cat", cid));

    const top = document.createElement("div");
    top.className = "cat-card-top";
    const title = document.createElement("span");
    title.className = "cat-card-title";
    title.textContent = isUnlocked ? i18n.t(cid, lang) : "???";
    const stationTag = document.createElement("span");
    stationTag.className = "cat-station-tag";
    stationTag.textContent = i18n.t(`catStation_${cDef.stationId}`, lang);
    top.appendChild(title);
    top.appendChild(stationTag);

    const desc = document.createElement("div");
    desc.className = "cat-card-desc";
    desc.textContent = isUnlocked ? i18n.t(`catDesc_${cid.replace("cat_", "")}`, lang) : `???`;

    card.appendChild(top);
    card.appendChild(desc);

    if (!isUnlocked) {
      const canAfford = state.stars >= cDef.unlockStars;
      const btn = document.createElement("button");
      btn.className = "action-btn primary-btn";
      btn.type = "button";
      btn.disabled = !canAfford;
      btn.innerHTML = `<span>${i18n.t("hireCat", lang)}</span><span>${cDef.unlockStars} ⭐</span>`;
      btn.addEventListener("click", () => game.unlockCat(cid));
      card.appendChild(btn);
    } else if (state.activeCat !== cid) {
      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.type = "button";
      btn.textContent = i18n.t("switchCat", lang);
      btn.addEventListener("click", () => game.switchActiveCat(cid));
      card.appendChild(btn);
    } else {
      const tag = document.createElement("span");
      tag.className = "cat-status-active";
      tag.textContent = "▶";
      card.appendChild(tag);
    }

    container.appendChild(card);
  }
}

// =========================================================================
// Tab 4: 常客图鉴
// =========================================================================

export function renderGuestsTab(state, lang, game) {
  const container = $("guests-list");
  if (!container) return;
  container.innerHTML = "";

  for (const gid of engine.GUEST_IDS) {
    const gDef = engine.GUEST_DEFS[gid];
    const isMet = state.guests.includes(gid);

    const card = document.createElement("div");
    card.className = `guest-card ${isMet ? "unlocked" : "locked"}`;
    card.appendChild(glyphSpan("guest", gid));

    const top = document.createElement("div");
    top.className = "guest-card-top";
    const title = document.createElement("span");
    title.className = "guest-card-title";
    title.textContent = isMet ? i18n.t(gid, lang) : "???";
    const bonus = document.createElement("span");
    bonus.className = "guest-card-bonus";
    bonus.textContent = i18n.t("tipBonus", lang, { bonus: Math.round(gDef.tipBonus * 100) });
    top.appendChild(title);
    top.appendChild(bonus);

    const story = document.createElement("div");
    story.className = "guest-card-story";
    if (isMet) {
      story.textContent = i18n.t(`guestStory_${gid.replace("guest_", "")}`, lang);
    } else {
      story.textContent = `${i18n.t("guestLocked", lang)} (${state.bowlsServed}/${gDef.reqBowls})`;
    }

    card.appendChild(top);
    card.appendChild(story);

    if (isMet) {
      const fav = document.createElement("div");
      fav.className = "guest-card-fav";
      fav.textContent = i18n.t("favDrink", lang, { drink: i18n.t(gDef.favoriteDrink, lang) });
      card.appendChild(fav);
    } else if (state.drinks.includes(gDef.favoriteDrink)) {
      // 已研制偏好饮品 → 提供"喂一杯"按钮
      const btn = document.createElement("button");
      btn.className = "action-btn primary-btn";
      btn.type = "button";
      btn.textContent = i18n.t("feedDrink", lang);
      btn.addEventListener("click", () => game.serveGuest(gid, gDef.favoriteDrink));
      card.appendChild(btn);
    }

    container.appendChild(card);
  }
}

// =========================================================================
// Tab 5: 扩建（窗口 + 声誉）
// =========================================================================

export function renderShopTab(state, lang, game) {
  const container = $("shop-controls");
  if (!container) return;
  container.innerHTML = "";

  // 声誉升级
  const currentStage = engine.REPUTATION_STAGES[state.stage];
  const nextStage = engine.REPUTATION_STAGES[state.stage + 1];

  const stageBlock = document.createElement("div");
  stageBlock.className = "shop-block";

  const stageTitle = document.createElement("div");
  stageTitle.className = "shop-block-title";
  stageTitle.textContent = `${i18n.t("labelStage", lang)}: ${i18n.t(currentStage.id, lang)}`;

  const stageDesc = document.createElement("div");
  stageDesc.className = "shop-block-desc";
  stageDesc.textContent = i18n.t(`reputationDesc_${currentStage.id.replace("reputation_", "")}`, lang);

  stageBlock.appendChild(stageTitle);
  stageBlock.appendChild(stageDesc);

  if (nextStage) {
    const canUpgrade = state.totalRevenue >= nextStage.reqRevenue;
    const btn = document.createElement("button");
    btn.className = "action-btn primary-btn";
    btn.type = "button";
    btn.disabled = !canUpgrade;
    btn.innerHTML = `<span>${i18n.t("upgradeStage", lang)}: ${i18n.t(nextStage.id, lang)}</span>`;
    btn.addEventListener("click", () => game.upgradeStage());
    stageBlock.appendChild(btn);
  }

  container.appendChild(stageBlock);

  // 窗口扩张
  for (const wid of engine.WINDOW_IDS) {
    const wDef = engine.WINDOW_DEFS[wid];
    const isUnlocked = state.windows[wid];
    const canUnlock = state.stage >= wDef.reqStage && state.coins >= wDef.reqCoins;

    const block = document.createElement("div");
    block.className = `shop-block ${isUnlocked ? "unlocked" : "locked"}`;

    const title = document.createElement("div");
    title.className = "shop-block-title";
    title.textContent = i18n.t(wid, lang);
    const desc = document.createElement("div");
    desc.className = "shop-block-desc";
    desc.textContent = i18n.t(`windowDesc_${wid.replace("window_", "")}`, lang);
    block.appendChild(title);
    block.appendChild(desc);

    if (isUnlocked) {
      const tag = document.createElement("span");
      tag.className = "shop-block-tag";
      tag.textContent = i18n.t("unlocked", lang);
      block.appendChild(tag);
    } else {
      const btn = document.createElement("button");
      btn.className = "action-btn primary-btn";
      btn.type = "button";
      btn.disabled = !canUnlock;
      btn.innerHTML = `<span>${i18n.t("unlockWindow", lang)}</span><span>${score.formatCoins(wDef.reqCoins)} ${i18n.t("coinSuffix", lang)}</span>`;
      btn.addEventListener("click", () => game.unlockWindow(wid));
      block.appendChild(btn);
    }

    container.appendChild(block);
  }
}

// =========================================================================
// Tab 调度
// =========================================================================

export function renderActiveTab(tabName, state, lang, game) {
  if (tabName === "stations") renderStationsTab(state, lang, game);
  else if (tabName === "drinks") renderDrinksTab(state, lang, game);
  else if (tabName === "cats") renderCatsTab(state, lang, game);
  else if (tabName === "guests") renderGuestsTab(state, lang, game);
  else if (tabName === "shop") renderShopTab(state, lang, game);
}

// =========================================================================
// 想念桶弹窗
// =========================================================================

export function renderOfflineModal(lang, reward) {
  const bucketsContainer = $("offline-buckets");
  if (bucketsContainer) {
    bucketsContainer.innerHTML = "";
    for (const b of reward.buckets) {
      const row = document.createElement("div");
      row.className = "offline-bucket";
      const catGlyph = document.createElement("span");
      catGlyph.className = "offline-bucket-cat";
      catGlyph.textContent = i18n.t(b.catId, lang).charAt(0);
      const msg = document.createElement("span");
      msg.className = "offline-bucket-msg";
      msg.textContent = b.message;
      const amount = document.createElement("span");
      amount.className = "offline-bucket-amount";
      amount.textContent = `+${score.formatCoins(b.amount)}`;
      row.appendChild(catGlyph);
      row.appendChild(msg);
      row.appendChild(amount);
      bucketsContainer.appendChild(row);
    }
  }

  const earned = $("offline-earned-text");
  if (earned) earned.textContent = i18n.t("offlineEarned", lang, { amount: score.formatCoins(reward.earnedCoins) });

  const eff = $("offline-eff-text");
  if (eff) eff.textContent = i18n.t("offlineEfficiency", lang, { eff: Math.round(reward.efficiency * 100) });

  const ms = $("offline-milestone-text");
  if (ms) ms.textContent = i18n.t("offlineMilestones", lang, { mult: reward.multiplier });
}