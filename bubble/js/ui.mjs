/**
 * 极简泡泡堂 · 水泡大作战 (Bubble Arena Lite)
 * 交互与 DOM HUD 渲染器 (对战面板、触控摇杆、地图抽屉)
 */

import { translate, t, toggleLocale, updatePageTranslations } from "./i18n.mjs";
import {
  playPlaceBubble,
  playSplashBurst,
  playTrappedSound,
  playPopSound,
  playItemPickup,
  playKickSound,
  setSoundEnabled,
  isSoundEnabled,
} from "./audio.mjs";
import { loadRecord, recordMatchResult } from "./storage.mjs";

export function createUI(controller, container) {
  // DOM Elements
  const elTime = document.getElementById("hud-round-time");
  const elMapName = document.getElementById("hud-map-name");
  const elP1Status = document.getElementById("hud-p1-status");
  const elP2Status = document.getElementById("hud-p2-status");
  const elP1Stats = document.getElementById("hud-p1-stats");
  const elP2Stats = document.getElementById("hud-p2-stats");

  // Modals
  const modalMaps = document.getElementById("modal-maps");
  const modalResults = document.getElementById("modal-results");
  const modalPaused = document.getElementById("modal-paused");
  const modalGuide = document.getElementById("modal-guide");

  // Buttons
  const btnPause = document.getElementById("btn-pause");
  const btnLang = document.getElementById("btn-lang");
  const btnSound = document.getElementById("btn-sound");
  const btnMapDrawer = document.getElementById("btn-map-drawer");
  const btnGuide = document.getElementById("btn-guide");

  // Hook sound events
  controller.onEvent((event) => {
    if (event.type === "bubble_placed") {
      playPlaceBubble();
    } else if (event.type === "trapped") {
      playTrappedSound();
    } else if (event.type === "popped" || event.type === "needle_pop") {
      playPopSound();
    } else if (event.type === "pickup_item") {
      playItemPickup();
    } else if (event.type === "kick_bubble") {
      playKickSound();
    }
  });

  // State Update Subscriber
  controller.subscribe((state, isPaused) => {
    elTime.textContent = Math.ceil(state.roundTimeLeft);
    elMapName.textContent = t(state.mapId);

    const p1 = state.players[0];
    const p2 = state.players[1];

    if (p1) {
      elP1Status.textContent = !p1.alive
        ? t("eliminatedStatus")
        : p1.trapped
        ? t("trappedStatus")
        : t("normalStatus");
      elP1Status.className = `player-tag ${!p1.alive ? "dead" : p1.trapped ? "trapped" : "active"}`;
      elP1Stats.textContent = t("player_stats_format", {
        b: p1.maxBubbles,
        s: p1.splashPower,
        spd: p1.speed.toFixed(1),
      });
    }

    if (p2) {
      elP2Status.textContent = !p2.alive
        ? t("eliminatedStatus")
        : p2.trapped
        ? t("trappedStatus")
        : t("normalStatus");
      elP2Status.className = `player-tag ${!p2.alive ? "dead" : p2.trapped ? "trapped" : "active"}`;
      elP2Stats.textContent = t("player_stats_format", {
        b: p2.maxBubbles,
        s: p2.splashPower,
        spd: p2.speed.toFixed(1),
      });
    }

    btnPause.textContent = isPaused ? t("resume") : t("pause");
    modalPaused.classList.toggle("hidden", !isPaused);

    // Results Modal
    if (state.status !== "playing") {
      showResultsModal(state);
    }
  });

  function showResultsModal(state) {
    modalResults.classList.remove("hidden");
    const titleEl = document.getElementById("results-title");
    const timeEl = document.getElementById("results-time");
    const p1 = state.players[0];

    timeEl.textContent = `${Math.floor(state.timeElapsed)}s`;

    if (state.status === "p1_won") {
      titleEl.textContent = t("result_p1_won");
      titleEl.className = "result-title won";
      recordMatchResult(state.mapId, true);
    } else if (state.status === "p2_won") {
      titleEl.textContent = t("result_p2_won");
      titleEl.className = "result-title lost";
      recordMatchResult(state.mapId, false);
    } else {
      titleEl.textContent = t("result_draw");
      titleEl.className = "result-title draw";
    }
  }

  // Button Bindings
  btnPause.addEventListener("click", () => {
    controller.togglePause();
  });

  btnLang.addEventListener("click", () => {
    toggleLocale();
    btnLang.textContent = t("langToggle");
    updatePageTranslations();
    const st = controller.getState();
    elMapName.textContent = t(st.mapId);
  });

  btnSound.addEventListener("click", () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    btnSound.textContent = next ? t("soundOn") : t("soundOff");
  });

  btnGuide.addEventListener("click", () => {
    modalGuide.classList.remove("hidden");
  });

  document.getElementById("btn-guide-close").addEventListener("click", () => {
    modalGuide.classList.add("hidden");
  });

  btnMapDrawer.addEventListener("click", () => {
    renderMapsModal();
    modalMaps.classList.remove("hidden");
  });

  document.getElementById("btn-maps-close").addEventListener("click", () => {
    modalMaps.classList.add("hidden");
  });

  document.getElementById("btn-restart-paused").addEventListener("click", () => {
    modalPaused.classList.add("hidden");
    controller.startMatch({ mapId: controller.getState().mapId });
  });

  document.getElementById("btn-continue-paused").addEventListener("click", () => {
    controller.resume();
  });

  document.getElementById("btn-results-retry").addEventListener("click", () => {
    modalResults.classList.add("hidden");
    controller.startMatch({ mapId: controller.getState().mapId });
  });

  document.getElementById("btn-results-next").addEventListener("click", () => {
    modalResults.classList.add("hidden");
    const maps = ["map_pool", "map_isles", "map_ice", "map_pirate"];
    const cur = controller.getState().mapId;
    const curIdx = maps.indexOf(cur);
    const nextMap = maps[(curIdx + 1) % maps.length];
    controller.startMatch({ mapId: nextMap });
  });

  function renderMapsModal() {
    const list = document.getElementById("maps-list");
    list.innerHTML = "";
    const record = loadRecord();
    const mapKeys = ["map_pool", "map_isles", "map_ice", "map_pirate"];

    mapKeys.forEach((key) => {
      const isUnlocked = record.unlockedMaps.includes(key);
      const card = document.createElement("div");
      card.className = `map-card ${isUnlocked ? "unlocked" : "locked"}`;

      const title = document.createElement("h4");
      title.textContent = t(key);
      const desc = document.createElement("p");
      desc.textContent = t(`${key}_desc`);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-primary";
      btn.textContent = isUnlocked ? t("switchMap") : t("map_locked");
      btn.disabled = !isUnlocked;

      if (isUnlocked) {
        btn.addEventListener("click", () => {
          modalMaps.classList.add("hidden");
          controller.startMatch({ mapId: key });
        });
      }

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(btn);
      list.appendChild(card);
    });
  }

  // 移动端触控按键绑定
  setupTouchControls(controller);
}

function setupTouchControls(controller) {
  const btnUp = document.getElementById("touch-up");
  const btnDown = document.getElementById("touch-down");
  const btnLeft = document.getElementById("touch-left");
  const btnRight = document.getElementById("touch-right");
  const btnDrop = document.getElementById("touch-drop");
  const btnNeedle = document.getElementById("touch-needle");

  if (!btnUp) return;

  function bindTouchDir(el, dir) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      controller.setPlayerInput(0, dir, true);
    });
    el.addEventListener("pointerup", (e) => {
      e.preventDefault();
      controller.setPlayerInput(0, dir, false);
    });
    el.addEventListener("pointerleave", (e) => {
      e.preventDefault();
      controller.setPlayerInput(0, dir, false);
    });
  }

  bindTouchDir(btnUp, "up");
  bindTouchDir(btnDown, "down");
  bindTouchDir(btnLeft, "left");
  bindTouchDir(btnRight, "right");

  btnDrop.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    controller.drop(0);
  });

  btnNeedle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    controller.needle(0);
  });
}
