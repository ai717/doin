// UI 层：唯一负责语义 DOM、HUD、面板与横幅。不碰规则，只读 snapshot。

import { t, stageName, getLang } from "./i18n.mjs";

const PANEL_IDS = ["ov-help", "ov-pause", "ov-levels", "ov-result"];

function q(id) {
  return document.getElementById(id);
}

export function createUI({ game, actions }) {
  const els = {
    p1Score: q("p1-score"),
    p1Lines: q("p1-lines"),
    p1Combo: q("p1-combo"),
    p1Garbage: q("p1-garbage"),
    p2Score: q("p2-score"),
    p2Lines: q("p2-lines"),
    p2Combo: q("p2-combo"),
    p2Garbage: q("p2-garbage"),
    chipStage: q("chip-stage"),
    chipRound: q("chip-round"),
    scoreP1: q("score-p1"),
    scoreP2: q("score-p2"),
    pipsP1: q("pips-p1"),
    pipsP2: q("pips-p2"),
    tagP1: q("tag-p1"),
    tagP2: q("tag-p2"),
    banner: q("banner"),
    bannerText: q("banner-text"),
    toast: q("toast"),
    btnModeSolo: q("btn-mode-solo"),
    btnModeVersus: q("btn-mode-versus"),
    btnBestOf: q("btn-bestof"),
    btnLevels: q("btn-levels"),
    btnPause: q("btn-pause"),
    btnSound: q("btn-sound"),
    btnLang: q("btn-lang"),
    btnHelp: q("btn-help"),
    btnResume: q("btn-resume"),
    btnRestart: q("btn-restart"),
    btnPauseLevels: q("btn-pause-levels"),
    levelGrid: q("level-grid"),
    levelProgress: q("level-progress"),
    btnResetSave: q("btn-reset-save"),
    resultEyebrow: q("result-eyebrow"),
    resultTitle: q("result-title"),
    resultDetail: q("result-detail"),
    btnResultPrimary: q("btn-result-primary"),
    btnResultSecondary: q("btn-result-secondary"),
    btnResultLevels: q("btn-result-levels"),
  };

  const panels = {
    help: q("ov-help"),
    pause: q("ov-pause"),
    levels: q("ov-levels"),
    result: q("ov-result"),
  };

  const state = {
    flashTimer: 0,
    flashUntil: 0,
    flashPriority: 0,
    toastTimer: 0,
    resultConfig: null,
    levelPick: null,
  };

  function openPanel(name) {
    PANEL_IDS.forEach((id) => {
      const el = q(id);
      if (!el) return;
      if (el === panels[name]) {
        el.hidden = false;
        requestAnimationFrame(() => el.classList.add("show"));
      } else {
        el.classList.remove("show");
        el.hidden = true;
      }
    });
    actions.onPanel?.(true);
  }

  function closePanels() {
    PANEL_IDS.forEach((id) => {
      const el = q(id);
      if (!el) return;
      el.classList.remove("show");
      el.hidden = true;
    });
    actions.onPanel?.(false);
  }

  function isPanelOpen() {
    return PANEL_IDS.some((id) => {
      const el = q(id);
      return el && !el.hidden;
    });
  }

  function labels() {
    return {
      hold: t("hold"),
      next: t("next"),
      garbage: t("garbage"),
      p1: t("player1"),
      p2: t("player2"),
      ai: t("aiLabel"),
    };
  }

  function refresh(snapshot) {
    const [p1, p2] = snapshot.boards;
    els.p1Score.textContent = String(p1.score);
    els.p1Lines.textContent = String(p1.lines);
    els.p1Combo.textContent = String(p1.combo);
    els.p1Garbage.textContent = String(p1.pending);
    els.p2Score.textContent = String(p2.score);
    els.p2Lines.textContent = String(p2.lines);
    els.p2Combo.textContent = String(p2.combo);
    els.p2Garbage.textContent = String(p2.pending);

    els.scoreP1.textContent = String(snapshot.seriesWins[0]);
    els.scoreP2.textContent = String(snapshot.seriesWins[1]);
    els.chipRound.textContent = t("roundLabel", undefined, { n: snapshot.round });
    if (snapshot.mode === "solo") {
      const index = snapshot.stage;
      els.chipStage.textContent = `${t("stageLabel", undefined, { n: index + 1 })} · ${stageName(index)}`;
    } else {
      els.chipStage.textContent = `${t("modeTagVersus")} · ${t("bestOfShort", undefined, { n: snapshot.bestOf })}`;
    }
    renderPips(els.pipsP1, snapshot.seriesWins[0], snapshot.targetWins);
    renderPips(els.pipsP2, snapshot.seriesWins[1], snapshot.targetWins);
    setMode(snapshot.mode);
    setBestOf(snapshot.bestOf);
    setPaused(snapshot.paused);

    els.tagP1.textContent = t("you");
    els.tagP2.textContent = snapshot.mode === "solo" ? t("aiLabel") : t("player2Tag");
  }

  function renderPips(root, wins, target) {
    if (!root) return;
    let html = "";
    for (let i = 0; i < target; i += 1) {
      html += `<i class="pip${i < wins ? " on" : ""}"></i>`;
    }
    if (root.dataset.pips === html) return;
    root.dataset.pips = html;
    root.innerHTML = html;
  }

  function flash(text, tone = "gold", priority = 1, duration = 720) {
    if (!els.banner) return;
    const now = performance.now();
    if (now < state.flashUntil && state.flashPriority > priority) return;
    state.flashText = text;
    state.flashPriority = priority;
    state.flashUntil = now + duration;
    els.bannerText.textContent = text;
    els.banner.className = `banner show tone-${tone}`;
    window.clearTimeout(state.flashTimer);
    state.flashTimer = window.setTimeout(() => {
      els.banner.classList.remove("show");
    }, duration);
  }

  function toast(text, duration = 1800) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.hidden = false;
    els.toast.classList.add("show");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("show");
      window.setTimeout(() => {
        els.toast.hidden = true;
      }, 220);
    }, duration);
  }

  function setPaused(paused) {
    els.btnPause.textContent = paused ? t("resume") : t("pause");
    els.btnPause.classList.toggle("is-on", paused);
  }

  function setMode(mode) {
    const solo = mode === "solo";
    els.btnModeSolo.classList.toggle("is-on", solo);
    els.btnModeVersus.classList.toggle("is-on", !solo);
    els.tagP2.textContent = solo ? t("aiLabel") : t("player2Tag");
  }

  function setBestOf(bestOf) {
    els.btnBestOf.textContent = t("bestOfShort", undefined, { n: bestOf });
    els.btnBestOf.classList.toggle("is-off", game.mode === "solo");
  }

  function setSound(on) {
    els.btnSound.textContent = on ? "♪" : "♪̸";
    els.btnSound.classList.toggle("is-off", !on);
    els.btnSound.title = on ? t("soundOn") : t("soundOff");
  }

  function setLangButton() {
    els.btnLang.textContent = t("langBtn");
  }

  function buildLevels(save, unlocked, onPick, lang = getLang()) {
    state.levelPick = onPick;
    els.levelGrid.innerHTML = "";
    const cleared = new Set(save.cleared ?? []);
    for (let i = 0; i < 22; i += 1) {
      const locked = i > unlocked;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `level-cell${locked ? " locked" : ""}${cleared.has(i) ? " cleared" : ""}`;
      button.disabled = locked;
      button.dataset.stage = String(i);
      const tier = ["bronze", "silver", "gold", "platinum", "diamond"][Math.min(4, Math.floor(i / 5))];
      button.innerHTML = `
        <span class="level-no">${String(i + 1).padStart(2, "0")}</span>
        <span class="level-name">${escapeHtml(stageName(i, lang))}</span>
        <span class="level-meta tier-${tier}">${locked ? escapeHtml(t("lockedTag", lang)) : escapeHtml(t("tier" + tier[0].toUpperCase() + tier.slice(1), lang))}</span>
        <span class="level-state">${cleared.has(i) ? "✓" : locked ? "·" : "›"}</span>
      `;
      if (!locked) {
        button.addEventListener("click", () => {
          closePanels();
          onPick(i);
        });
      }
      els.levelGrid.appendChild(button);
    }
    els.levelProgress.textContent = t("levelProgress", lang, { done: cleared.size, total: 22 });
  }

  function showResult(config) {
    state.resultConfig = config;
    els.resultEyebrow.textContent = config.eyebrow ?? "";
    els.resultTitle.textContent = config.title ?? "";
    els.resultTitle.className = `result-title tone-${config.tone ?? "gold"}`;
    els.resultDetail.textContent = config.detail ?? "";
    els.btnResultPrimary.textContent = config.primaryLabel ?? "";
    els.btnResultPrimary.hidden = !config.onPrimary;
    els.btnResultSecondary.textContent = config.secondaryLabel ?? "";
    els.btnResultSecondary.hidden = !config.onSecondary;
    openPanel("result");
  }

  function hideResult() {
    state.resultConfig = null;
    closePanels();
  }

  // ---------------------------------------------------------- 绑定

  els.btnModeSolo.addEventListener("click", () => actions.onMode?.("solo"));
  els.btnModeVersus.addEventListener("click", () => actions.onMode?.("versus"));
  els.btnBestOf.addEventListener("click", () => actions.onBestOf?.());
  els.btnLevels.addEventListener("click", () => openLevels());
  els.btnPause.addEventListener("click", () => actions.onPause?.());
  els.btnSound.addEventListener("click", () => actions.onSound?.());
  els.btnLang.addEventListener("click", () => actions.onLang?.());
  els.btnHelp.addEventListener("click", () => openPanel("help"));
  els.btnResume.addEventListener("click", () => actions.onResume?.());
  els.btnRestart.addEventListener("click", () => actions.onRestart?.());
  els.btnPauseLevels.addEventListener("click", () => openLevels());
  els.btnResetSave.addEventListener("click", () => actions.onResetSave?.());
  els.btnResultPrimary.addEventListener("click", () => {
    const config = state.resultConfig;
    if (config?.onPrimary) config.onPrimary();
  });
  els.btnResultSecondary.addEventListener("click", () => {
    const config = state.resultConfig;
    if (config?.onSecondary) config.onSecondary();
  });
  els.btnResultLevels.addEventListener("click", () => openLevels());

  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => closePanels());
  });

  PANEL_IDS.forEach((id) => {
    const el = q(id);
    if (!el) return;
    el.addEventListener("click", (event) => {
      if (event.target !== el) return;
      if (id === "ov-result") return;
      closePanels();
    });
  });

  document.querySelectorAll(".pad-key").forEach((button) => {
    const act = button.dataset.act;
    const player = Number(button.dataset.player);
    const press = (event) => {
      event.preventDefault();
      if (act === "pause") {
        actions.onPause?.();
        return;
      }
      game.input(player, act);
    };
    const release = (event) => {
      if (act === "soft") {
        event.preventDefault();
        game.setSoft(player, false);
      }
    };
    button.addEventListener("pointerdown", (event) => {
      press(event);
      if (act === "soft") game.setSoft(player, true);
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        /* 忽略 */
      }
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  });

  function openLevels() {
    openPanel("levels");
    actions.onRequestLevels?.();
  }

  return {
    els,
    panels,
    labels,
    refresh,
    flash,
    toast,
    setPaused,
    setMode,
    setBestOf,
    setSound,
    setLangButton,
    buildLevels,
    showResult,
    hideResult,
    openPanel,
    closePanels,
    isPanelOpen,
    openLevels,
    get resultConfig() {
      return state.resultConfig;
    },
  };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
