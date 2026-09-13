// ui.mjs: 云朵合成 UI 控制层，唯一更新 DOM 文本 / HUD / 弹窗 / 图鉴。
// 只读 engine 状态，绝不碰规则数据，不自算分。支持中英文实时无缝切换。

import { CLOUD_DEFS, MAX_LEVEL } from "./engine.mjs?v=dev";
import { format } from "./i18n.mjs?v=dev";

const byId = (id) => document.getElementById(id);

function bumpTo(el, value) {
  if (!el) return;
  const s = String(value);
  if (el.textContent === s) return;
  el.textContent = s;
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

export function mountUI(initialT) {
  let curT = initialT;

  const refs = {
    titleText: byId("title-text"),
    backLabel: byId("back-label"),
    soundBtn: byId("sound-btn"),
    soundLabel: byId("sound-label"),
    soundIco: byId("sound-ico"),
    langBtn: byId("lang-btn"),
    langLabel: byId("lang-label"),
    helpBtn: byId("help-btn"),
    helpLabel: byId("help-label"),
    modeTabs: document.querySelector(".mode-tabs"),
    modeEndless: byId("mode-endless"),
    modeDaily: byId("mode-daily"),
    canvas: byId("game-canvas"),
    dangerBanner: byId("danger-banner"),

    codexTitle: byId("codex-title"),
    codex: byId("codex"),
    scoreCap: byId("score-cap"),
    chainCap: byId("chain-cap"),
    levelCap: byId("level-cap"),
    rainbowsCap: byId("rainbows-cap"),
    hudScore: byId("hud-score"),
    hudChain: byId("hud-chain"),
    hudLevel: byId("hud-level"),
    hudRainbows: byId("hud-rainbows"),
    hudBest: byId("hud-best"),

    previewTitle: byId("preview-title"),
    previewCurrent: byId("preview-current"),
    previewNext: byId("preview-next"),
    previewCurrentCap: byId("preview-current-cap"),
    previewNextCap: byId("preview-next-cap"),
    previewHint: byId("preview-hint"),
    controlHint: byId("control-hint"),

    startBtn: byId("start-btn"),
    pauseBtn: byId("pause-btn"),
    pauseLabel: byId("pause-label"),
    restartBtn: byId("restart-btn"),
    restartLabel: byId("restart-label"),

    readyModal: byId("ready-modal"),
    readyKicker: byId("ready-kicker"),
    readyTitle: byId("ready-title"),
    readyDesc: byId("ready-desc"),
    readyModeEndless: byId("ready-mode-endless"),
    readyModeDaily: byId("ready-mode-daily"),
    readyStartBtn: byId("ready-start-btn"),

    pauseModal: byId("pause-modal"),
    pauseTitle: byId("pause-title"),
    pauseDesc: byId("pause-desc"),
    resumeBtn: byId("resume-btn"),

    resultModal: byId("result-modal"),
    resultNewbest: byId("result-newbest"),
    resultTitle: byId("result-title"),
    resultScore: byId("result-score"),
    resultLevel: byId("result-level"),
    resultChain: byId("result-chain"),
    resultRainbows: byId("result-rainbows"),
    resultScoreCap: byId("result-score-cap"),
    resultLevelCap: byId("result-level-cap"),
    resultChainCap: byId("result-chain-cap"),
    resultRainbowsCap: byId("result-rainbows-cap"),
    resultBest: byId("result-best"),
    resultModeTip: byId("result-mode-tip"),
    resultRestartBtn: byId("result-restart-btn"),

    helpModal: byId("help-modal"),
    helpTitle: byId("help-title"),
    helpBody: byId("help-body"),
    helpCloseBtn: byId("help-close-btn"),

    toast: byId("toast"),
  };

  let codexItems = [];
  let toastTimer = null;

  function buildCodex(isEn) {
    if (!refs.codex) return;
    refs.codex.textContent = "";
    for (let lv = 1; lv <= MAX_LEVEL; lv += 1) {
      const def = CLOUD_DEFS[lv - 1];
      const li = document.createElement("li");
      const icon = document.createElement("span");
      icon.className = "codex-cloud";
      icon.style.setProperty("--cloud-color", def.color);
      icon.style.setProperty("--cloud-glow", def.glow);

      const name = document.createElement("span");
      name.className = "codex-name";
      name.textContent = isEn ? def.enName : def.name;

      const num = document.createElement("span");
      num.className = "codex-num";
      num.textContent = format(curT.levelUnit, { n: lv });

      li.append(icon, name, num);
      refs.codex.append(li);
    }
    codexItems = Array.from(refs.codex.children);
  }

  function setSound(muted) {
    if (refs.soundBtn) refs.soundBtn.setAttribute("aria-pressed", String(!muted));
    if (refs.soundIco) refs.soundIco.textContent = muted ? "🔇" : "🔊";
    if (refs.soundLabel) refs.soundLabel.textContent = curT.sound;
    if (refs.soundBtn) refs.soundBtn.setAttribute("aria-label", muted ? curT.soundOff : curT.soundOn);
  }

  return {
    refs,

    applyTexts(state, extra = {}) {
      if (extra.t) {
        curT = extra.t;
      }
      const isEn = extra.locale === "en";

      if (refs.titleText) refs.titleText.textContent = curT.appTitle;
      if (refs.backLabel) refs.backLabel.textContent = curT.back;
      if (refs.langLabel) refs.langLabel.textContent = curT.langSwitch;
      if (refs.helpLabel) refs.helpLabel.textContent = curT.help;
      if (refs.modeTabs) refs.modeTabs.setAttribute("aria-label", curT.modeAria);
      if (refs.modeEndless) refs.modeEndless.textContent = curT.modeEndless;
      if (refs.modeDaily) refs.modeDaily.textContent = curT.modeDaily;
      if (refs.canvas) refs.canvas.setAttribute("aria-label", curT.canvasAria);

      if (refs.codexTitle) refs.codexTitle.textContent = curT.codexTitle;
      if (refs.codex) refs.codex.setAttribute("aria-label", curT.codexAria);
      if (refs.scoreCap) refs.scoreCap.textContent = curT.score;
      if (refs.chainCap) refs.chainCap.textContent = curT.chain;
      if (refs.levelCap) refs.levelCap.textContent = curT.level;
      if (refs.rainbowsCap) refs.rainbowsCap.textContent = curT.rainbows;
      if (refs.previewTitle) refs.previewTitle.textContent = curT.previewTitle;
      if (refs.previewCurrentCap) refs.previewCurrentCap.textContent = curT.previewCurrent;
      if (refs.previewNextCap) refs.previewNextCap.textContent = curT.previewNext;
      if (refs.controlHint) refs.controlHint.textContent = curT.controlHint;
      if (refs.startBtn) {
        refs.startBtn.textContent = curT.start;
        refs.startBtn.hidden = (state && state.status === "playing");
      }
      if (refs.restartLabel) refs.restartLabel.textContent = curT.restart;
      if (refs.pauseLabel) {
        refs.pauseLabel.textContent = state && state.paused ? curT.resume : curT.pause;
      }

      if (refs.readyKicker) refs.readyKicker.textContent = curT.readyKicker;
      if (refs.readyTitle) refs.readyTitle.textContent = curT.readyTitle;
      if (refs.readyDesc) refs.readyDesc.textContent = curT.readyDesc;
      if (refs.readyModeEndless) refs.readyModeEndless.textContent = curT.modeEndless;
      if (refs.readyModeDaily) refs.readyModeDaily.textContent = curT.modeDaily;
      if (refs.readyStartBtn) refs.readyStartBtn.textContent = curT.start;

      if (refs.pauseTitle) refs.pauseTitle.textContent = curT.pauseTitle;
      if (refs.pauseDesc) refs.pauseDesc.textContent = curT.pauseDesc;
      if (refs.resumeBtn) refs.resumeBtn.textContent = curT.resume;

      if (refs.resultTitle) refs.resultTitle.textContent = curT.resultTitle;
      if (refs.resultScoreCap) refs.resultScoreCap.textContent = curT.resultScore;
      if (refs.resultLevelCap) refs.resultLevelCap.textContent = curT.resultLevel;
      if (refs.resultChainCap) refs.resultChainCap.textContent = curT.resultChain;
      if (refs.resultRainbowsCap) refs.resultRainbowsCap.textContent = curT.resultRainbows;
      if (refs.resultRestartBtn) refs.resultRestartBtn.textContent = curT.playAgain;
      if (refs.resultNewbest) refs.resultNewbest.textContent = curT.newBest;

      if (refs.helpTitle) refs.helpTitle.textContent = curT.helpTitle;
      if (refs.helpCloseBtn) refs.helpCloseBtn.textContent = curT.helpClose;
      if (refs.helpBody) {
        const ps = refs.helpBody.querySelectorAll("p");
        const keys = [curT.help1, curT.help2, curT.help3, curT.help4, curT.help5];
        for (let i = 0; i < ps.length && i < keys.length; i += 1) ps[i].textContent = keys[i];
      }

      setSound(!!extra.muted);
      buildCodex(isEn);
      this.renderCodex(state);
      this.renderPreview(state);
    },

    setSoundLabel(muted) {
      setSound(!!muted);
    },

    renderHud(state, info = {}) {
      if (!state) return;
      if (refs.startBtn) {
        refs.startBtn.hidden = (state.status === "playing");
      }
      bumpTo(refs.hudScore, state.score);
      bumpTo(refs.hudChain, state.maxChainCombo || 0);
      bumpTo(refs.hudLevel, state.maxLevelReached || 1);
      bumpTo(refs.hudRainbows, state.rainbowsCollected || 0);
      if (refs.hudBest) {
        const best = Number(info.best) || 0;
        const lv = Number(info.bestLevel) || 0;
        refs.hudBest.textContent =
          lv > 0 ? format(curT.bestLevel, { n: best, lv }) : format(curT.best, { n: best });
      }
    },

    renderCodex(state) {
      const reached = state ? state.maxLevelReached : 1;
      for (let i = 0; i < codexItems.length; i += 1) {
        const lv = i + 1;
        const li = codexItems[i];
        li.classList.toggle("is-reached", lv <= reached);
        li.classList.toggle("is-target", reached >= 1 && lv === reached);
      }
    },

    renderPreview(state) {
      if (!state) return;
      const curDef = CLOUD_DEFS[Math.max(0, Math.min(MAX_LEVEL, state.currentDrop) - 1)];
      const nxtDef = CLOUD_DEFS[Math.max(0, Math.min(MAX_LEVEL, state.nextDrop) - 1)];
      if (refs.previewCurrent && curDef) {
        refs.previewCurrent.style.setProperty("--cloud-color", curDef.color);
        refs.previewCurrent.style.setProperty("--cloud-glow", curDef.glow);
      }
      if (refs.previewNext && nxtDef) {
        refs.previewNext.style.setProperty("--cloud-color", nxtDef.color);
        refs.previewNext.style.setProperty("--cloud-glow", nxtDef.glow);
      }
      if (refs.previewHint) {
        refs.previewHint.textContent = format(curT.previewHint, {
          c: state.currentDrop,
          n: state.nextDrop,
        });
      }
    },

    setModeTabs(mode, playing) {
      const endless = mode !== "daily";
      if (refs.modeEndless) {
        refs.modeEndless.classList.toggle("is-active", endless);
        refs.modeEndless.setAttribute("aria-selected", String(endless));
      }
      if (refs.modeDaily) {
        refs.modeDaily.classList.toggle("is-active", !endless);
        refs.modeDaily.setAttribute("aria-selected", String(!endless));
      }
      const locked = !!playing;
      if (refs.modeEndless) refs.modeEndless.setAttribute("aria-disabled", String(locked));
      if (refs.modeDaily) refs.modeDaily.setAttribute("aria-disabled", String(locked));
    },

    setPauseLabel(paused) {
      if (refs.pauseLabel) refs.pauseLabel.textContent = paused ? curT.resume : curT.pause;
    },

    showReady(on) {
      if (refs.readyModal) refs.readyModal.hidden = !on;
    },

    showPause(on) {
      if (refs.pauseModal) refs.pauseModal.hidden = !on;
    },

    showHelp(on) {
      if (refs.helpModal) refs.helpModal.hidden = !on;
    },

    showResult(state, info = {}) {
      if (refs.resultScore) refs.resultScore.textContent = String(state.score);
      if (refs.resultLevel) refs.resultLevel.textContent = String(state.maxLevelReached);
      if (refs.resultChain) refs.resultChain.textContent = String(state.maxChainCombo);
      if (refs.resultRainbows) refs.resultRainbows.textContent = String(state.rainbowsCollected || 0);
      if (refs.resultBest) {
        refs.resultBest.textContent = format(curT.best, { n: Number(info.best) || 0 });
      }
      if (refs.resultModeTip) refs.resultModeTip.textContent = info.tip || "";
      if (refs.resultNewbest) refs.resultNewbest.hidden = !info.isNewBest;
      if (refs.resultModal) refs.resultModal.hidden = false;
    },

    hideModals() {
      this.showReady(false);
      this.showPause(false);
      this.showResult0();
      this.showHelp(false);
    },

    showResult0() {
      if (refs.resultModal) refs.resultModal.hidden = true;
    },

    setDanger(on) {
      if (refs.dangerBanner) refs.dangerBanner.classList.toggle("is-on", !!on);
    },

    toast(msg) {
      if (!refs.toast || !msg) return;
      refs.toast.textContent = msg;
      refs.toast.hidden = false;
      requestAnimationFrame(() => refs.toast && refs.toast.classList.add("is-on"));
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        if (!refs.toast) return;
        refs.toast.classList.remove("is-on");
        toastTimer = setTimeout(() => {
          if (refs.toast) refs.toast.hidden = true;
        }, 260);
      }, 1800);
    },
  };
}
