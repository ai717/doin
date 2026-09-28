// main.mjs — Cat Cafe 入口：事件绑定 + 语言热更新 + 主循环订阅
import { CatCafeGame } from "./game.mjs";
import * as ui from "./ui.mjs";
import * as audio from "./audio.mjs";
import * as i18n from "./i18n.mjs";
import * as engine from "./engine.mjs";

const $ = (id) => document.getElementById(id);

let game = null;
let lang = "zh";
let currentTab = "stations";

function setLang(newLang) {
  lang = newLang;
  i18n.setStoredLang(lang);
  ui.updateStaticTexts(lang);
  if (game) {
    ui.renderHud(game.state, lang);
    ui.renderActiveTab(currentTab, game.state, lang, game);
  }
}

function openModal(id) {
  const m = $(id);
  if (m) m.classList.remove("hidden");
}

function closeModal(id) {
  const m = $(id);
  if (m) m.classList.add("hidden");
}

function bindEvents() {
  // 语言切换
  const btnLang = $("btn-lang");
  if (btnLang) {
    btnLang.addEventListener("click", () => {
      audio.initAudioOnGesture();
      setLang(lang === "zh" ? "en" : "zh");
    });
  }

  // 音效切换
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

  // 指南浮层
  const btnHelp = $("btn-help");
  const btnCloseGuide = $("btn-close-guide");
  if (btnHelp) btnHelp.addEventListener("click", () => openModal("modal-guide"));
  if (btnCloseGuide) btnCloseGuide.addEventListener("click", () => closeModal("modal-guide"));

  // 想念桶认领
  const btnClaim = $("btn-claim-offline");
  if (btnClaim) {
    btnClaim.addEventListener("click", () => {
      audio.initAudioOnGesture();
      const amount = game.claimPendingOffline();
      if (amount) {
        audio.playCoin();
        ui.showToast(`+${amount} ${i18n.t("coinSuffix", lang)}`);
      }
      closeModal("modal-offline");
    });
  }

  // Tab 切换
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.getAttribute("data-tab");

      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      const targetPanel = $(`panel-${currentTab}`);
      if (targetPanel) targetPanel.classList.add("active");

      ui.renderActiveTab(currentTab, game.state, lang, game);
    });
  });

  // 键盘快捷键
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    audio.initAudioOnGesture();

    if (e.key === "1") game.upgradeStation("roast");
    else if (e.key === "2") game.upgradeStation("grind");
    else if (e.key === "3") game.upgradeStation("extract");
    else if (e.key === "4") game.upgradeStation("latte");
    else if (e.key === "5") game.upgradeStation("serve");
    else if (e.key === "c" || e.key === "C") {
      const owned = engine.CAT_IDS.filter((cid) => game.state.cats[cid]?.unlocked);
      const next = owned[(owned.indexOf(game.state.activeCat) + 1) % owned.length];
      if (next) game.switchActiveCat(next);
    } else if (e.key === "r" || e.key === "R") {
      for (const did of engine.DRINK_IDS) {
        if (!game.state.drinks.includes(did)) {
          game.researchDrink(did);
          break;
        }
      }
    } else if (e.key === "e" || e.key === "E") {
      game.upgradeStage();
    } else if (e.key === "m" || e.key === "M") {
      audio.toggleMuted();
    }
  });
}

export function init() {
  lang = i18n.getStoredLang();
  game = new CatCafeGame();

  ui.updateStaticTexts(lang);
  game.init();

  // 想念桶弹窗
  if (game.pendingOfflineBuckets) {
    ui.renderOfflineModal(lang, game.pendingOfflineBuckets);
    openModal("modal-offline");
  }

  // 订阅状态变化
  game.subscribe((state, event) => {
    ui.renderHud(state, lang);

    if (event.type !== "TICK") {
      ui.renderActiveTab(currentTab, state, lang, game);
    }

    // 关键操作播放音效 + Toast
    switch (event.type) {
      case "UPGRADE_STATION":
        audio.playSteam();
        break;
      case "UPGRADE_CAT":
        audio.playPurr();
        break;
      case "UNLOCK_CAT":
        audio.playCoin();
        ui.showToast(i18n.t("toastCat", lang, { name: i18n.t(event.catId, lang) }));
        break;
      case "SWITCH_ACTIVE_CAT":
        audio.playMilk();
        break;
      case "UNLOCK_WINDOW":
        audio.playWindow();
        ui.showToast(i18n.t("toastWindow", lang, { name: i18n.t(event.windowId, lang) }));
        break;
      case "UPGRADE_STAGE":
        const stageDef = engine.REPUTATION_STAGES[event.newStage];
        ui.showToast(i18n.t("toastStage", lang, { name: i18n.t(stageDef.id, lang) }));
        break;
      case "RESEARCH_DRINK":
        audio.playMilk();
        ui.showToast(i18n.t("toastRecipe", lang, { name: i18n.t(event.drinkId, lang) }));
        break;
      case "SERVE_GUEST_DRINK":
        if (event.isFavorite) {
          audio.playCoin();
          ui.showToast(i18n.t("toastGuest", lang, { name: i18n.t(event.guestId, lang) }));
        }
        break;
    }
  });

  bindEvents();

  // 初次渲染
  ui.renderHud(game.state, lang);
  ui.renderActiveTab(currentTab, game.state, lang, game);
}

// 在浏览器中通过 DOMContentLoaded 触发；测试中跳过
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", init);
}

// 导出供测试使用
export { game, lang, currentTab, setLang };