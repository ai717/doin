// ui：唯一更新 DOM 文本 / HUD / 弹窗 / 图鉴的层。只读 engine state，绝不改规则数据，不自算分。
// 静态文案在 applyTexts 一次性刷；动态数值在 renderHud / renderCodex / renderPreview 增量刷。
// 弹窗显隐统一用 hidden 属性（CSS 已配 [hidden]{display:none}），不用内联 display。

import { FRUIT_STYLE, LEVEL_VALUES, MAX_LEVEL } from "./engine.mjs?v=dev";
import { format } from "./i18n.mjs?v=dev";

const byId = (id) => document.getElementById(id);

function bumpTo(el, value) {
  if (!el) return;
  const s = String(value);
  if (el.textContent === s) return;
  el.textContent = s;
  el.classList.remove("bump");
  // 强制 reflow 以重启动画
  void el.offsetWidth;
  el.classList.add("bump");
}

export function mountUI(t) {
  const refs = {
    titleText: byId("title-text"),
    backLabel: byId("back-label"),
    soundBtn: byId("sound-btn"),
    soundLabel: byId("sound-label"),
    soundIco: byId("sound-ico"),
    langLabel: byId("lang-label"),
    helpLabel: byId("help-label"),
    modeTabs: document.querySelector(".mode-tabs"),
    modeEndless: byId("mode-endless"),
    modeDaily: byId("mode-daily"),
    canvas: byId("game-canvas"),
    dangerBanner: byId("danger-banner"),
    goldFlash: byId("gold-flash"),

    codexTitle: byId("codex-title"),
    codex: byId("codex"),
    codexHint: byId("codex-hint"),
    scoreCap: byId("score-cap"),
    chainCap: byId("chain-cap"),
    harvestedCap: byId("harvested-cap"),
    hudScore: byId("hud-score"),
    hudChain: byId("hud-chain"),
    hudHarvested: byId("hud-harvested"),
    hudBest: byId("hud-best"),
    previewTitle: byId("preview-title"),
    previewCurrent: byId("preview-current"),
    previewNext: byId("preview-next"),
    previewCurrentNum: byId("preview-current-num"),
    previewNextNum: byId("preview-next-num"),
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
    resultMedal: byId("result-medal"),
    resultTitle: byId("result-title"),
    resultScore: byId("result-score"),
    resultMax: byId("result-max"),
    resultChain: byId("result-chain"),
    resultHarvested: byId("result-harvested"),
    resultScoreCap: byId("result-score-cap"),
    resultMaxCap: byId("result-max-cap"),
    resultChainCap: byId("result-chain-cap"),
    resultHarvestedCap: byId("result-harvested-cap"),
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
  let flashTimer = null;

  // 图鉴骨架只建一次（11 级固定），之后仅切 is-reached / is-target 类。
  function buildCodex() {
    if (!refs.codex) return;
    refs.codex.textContent = "";
    for (let lv = 1; lv <= MAX_LEVEL; lv += 1) {
      const li = document.createElement("li");
      const style = FRUIT_STYLE[lv - 1];
      li.style.setProperty("--f1", style.color);
      li.style.setProperty("--f2", style.glow);
      const fruit = document.createElement("span");
      fruit.className = "codex-fruit";
      const val = document.createElement("span");
      val.className = "codex-val";
      val.textContent = String(LEVEL_VALUES[lv - 1]);
      li.append(fruit, val);
      refs.codex.append(li);
    }
    codexItems = Array.from(refs.codex.children);
  }

  function setSound(muted) {
    if (refs.soundBtn) refs.soundBtn.setAttribute("aria-pressed", String(!muted));
    if (refs.soundIco) refs.soundIco.textContent = muted ? "🔇" : "🔊";
    if (refs.soundLabel) refs.soundLabel.textContent = t.sound;
    if (refs.soundBtn) refs.soundBtn.setAttribute("aria-label", muted ? t.soundOff : t.soundOn);
  }

  return {
    refs,

    // 一次性刷新全部静态文案（语言切换后调用）。
    applyTexts(state, extra = {}) {
      if (refs.titleText) refs.titleText.textContent = t.appTitle;
      if (refs.backLabel) refs.backLabel.textContent = t.back;
      if (refs.langLabel) refs.langLabel.textContent = t.langSwitch;
      if (refs.helpLabel) refs.helpLabel.textContent = t.help;
      if (refs.modeTabs) refs.modeTabs.setAttribute("aria-label", t.modeAria);
      if (refs.modeEndless) refs.modeEndless.textContent = t.modeEndless;
      if (refs.modeDaily) refs.modeDaily.textContent = t.modeDaily;
      if (refs.canvas) refs.canvas.setAttribute("aria-label", t.canvasAria);

      if (refs.codexTitle) refs.codexTitle.textContent = t.codexTitle;
      if (refs.codex) refs.codex.setAttribute("aria-label", t.codexAria);
      if (refs.scoreCap) refs.scoreCap.textContent = t.score;
      if (refs.chainCap) refs.chainCap.textContent = t.chain;
      if (refs.harvestedCap) refs.harvestedCap.textContent = t.harvested;
      if (refs.previewTitle) refs.previewTitle.textContent = t.previewTitle;
      if (refs.previewCurrentCap) refs.previewCurrentCap.textContent = t.previewCurrent;
      if (refs.previewNextCap) refs.previewNextCap.textContent = t.previewNext;
      if (refs.controlHint) refs.controlHint.textContent = t.controlHint;
      if (refs.dangerBanner) refs.dangerBanner.textContent = t.danger;
      if (refs.startBtn) refs.startBtn.textContent = t.start;
      if (refs.restartLabel) refs.restartLabel.textContent = t.restart;
      if (refs.pauseLabel) {
        refs.pauseLabel.textContent = state && state.paused ? t.resume : t.pause;
      }

      if (refs.readyKicker) refs.readyKicker.textContent = t.readyKicker;
      if (refs.readyTitle) refs.readyTitle.textContent = t.readyTitle;
      if (refs.readyDesc) refs.readyDesc.textContent = t.readyDesc;
      if (refs.readyModeEndless) refs.readyModeEndless.textContent = t.modeEndless;
      if (refs.readyModeDaily) refs.readyModeDaily.textContent = t.modeDaily;
      if (refs.readyStartBtn) refs.readyStartBtn.textContent = t.start;

      if (refs.pauseTitle) refs.pauseTitle.textContent = t.pauseTitle;
      if (refs.pauseDesc) refs.pauseDesc.textContent = t.pauseDesc;
      if (refs.resumeBtn) refs.resumeBtn.textContent = t.resume;

      if (refs.resultTitle) refs.resultTitle.textContent = t.resultTitle;
      if (refs.resultScoreCap) refs.resultScoreCap.textContent = t.resultScore;
      if (refs.resultMaxCap) refs.resultMaxCap.textContent = t.resultMax;
      if (refs.resultChainCap) refs.resultChainCap.textContent = t.resultChain;
      if (refs.resultHarvestedCap) refs.resultHarvestedCap.textContent = t.resultHarvested;
      if (refs.resultRestartBtn) refs.resultRestartBtn.textContent = t.playAgain;
      if (refs.resultNewbest) refs.resultNewbest.textContent = t.newBest;
      if (refs.resultMedal) refs.resultMedal.textContent = t.medal2048;

      if (refs.helpTitle) refs.helpTitle.textContent = t.helpTitle;
      if (refs.helpCloseBtn) refs.helpCloseBtn.textContent = t.helpClose;
      if (refs.helpBody) {
        const ps = refs.helpBody.querySelectorAll("p");
        const keys = [t.help1, t.help2, t.help3, t.help4, t.help5];
        for (let i = 0; i < ps.length && i < keys.length; i += 1) ps[i].textContent = keys[i];
      }

      setSound(!!extra.muted);
      buildCodex();
      this.renderCodex(state);
      this.renderPreview(state);
    },

    setSoundLabel(muted) {
      setSound(!!muted);
    },

    renderHud(state, info = {}) {
      bumpTo(refs.hudScore, state.score);
      bumpTo(refs.hudChain, state.maxChain);
      bumpTo(refs.hudHarvested, state.harvested);
      if (refs.hudBest) {
        const best = Number(info.best) || 0;
        const time = Number(info.bestTime) || 0;
        const base = format(t.best, { n: best });
        refs.hudBest.textContent = time > 0 ? `${base} · ${format(t.bestTime, { t: time })}` : base;
      }
    },

    renderCodex(state) {
      const reached = state ? state.maxLevel : 0;
      for (let i = 0; i < codexItems.length; i += 1) {
        const lv = i + 1;
        const li = codexItems[i];
        li.classList.toggle("is-reached", lv <= reached);
        li.classList.toggle("is-target", lv === reached + 1);
      }
      if (refs.codexHint) {
        if (reached >= MAX_LEVEL) refs.codexHint.textContent = t.codexDone;
        else refs.codexHint.textContent = format(t.codexRemain, { n: MAX_LEVEL - reached });
      }
    },

    renderPreview(state) {
      if (!state) return;
      const applySlot = (slot, numEl, level) => {
        const style = FRUIT_STYLE[Math.max(0, Math.min(MAX_LEVEL, level) - 1)];
        if (slot) {
          slot.style.setProperty("--f1", style.color);
          slot.style.setProperty("--f2", style.glow);
        }
        if (numEl) numEl.textContent = String(LEVEL_VALUES[Math.max(0, Math.min(MAX_LEVEL, level) - 1)]);
      };
      applySlot(refs.previewCurrent, refs.previewCurrentNum, state.current);
      applySlot(refs.previewNext, refs.previewNextNum, state.next);
      if (refs.previewHint) {
        refs.previewHint.textContent = format(t.previewHint, {
          c: LEVEL_VALUES[state.current - 1],
          n: LEVEL_VALUES[state.next - 1],
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
      if (refs.pauseLabel) refs.pauseLabel.textContent = paused ? t.resume : t.pause;
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
      if (refs.resultMax) refs.resultMax.textContent = state.maxLevel > 0 ? String(LEVEL_VALUES[state.maxLevel - 1]) : "0";
      if (refs.resultChain) refs.resultChain.textContent = String(state.maxChain);
      if (refs.resultHarvested) refs.resultHarvested.textContent = String(state.harvested);
      if (refs.resultBest) {
        const best = Number(info.best) || 0;
        const time = Number(info.bestTime) || 0;
        const base = format(t.best, { n: best });
        refs.resultBest.textContent = time > 0 ? `${base} · ${format(t.bestTime, { t: time })}` : base;
      }
      if (refs.resultModeTip) refs.resultModeTip.textContent = info.tip || "";
      if (refs.resultNewbest) refs.resultNewbest.hidden = !info.isNewBest;
      if (refs.resultMedal) refs.resultMedal.hidden = (state.maxLevel || 0) < MAX_LEVEL;
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

    // 摘瓜全屏丰收金光一闪。
    goldFlash() {
      if (!refs.goldFlash) return;
      refs.goldFlash.classList.remove("is-on");
      void refs.goldFlash.offsetWidth;
      refs.goldFlash.classList.add("is-on");
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        if (refs.goldFlash) refs.goldFlash.classList.remove("is-on");
      }, 620);
    },

    toast(msg) {
      if (!refs.toast || !msg) return;
      refs.toast.textContent = msg;
      refs.toast.hidden = false;
      // 下一帧再加 is-on，确保过渡触发
      requestAnimationFrame(() => refs.toast && refs.toast.classList.add("is-on"));
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        if (!refs.toast) return;
        refs.toast.classList.remove("is-on");
        toastTimer = setTimeout(() => {
          if (refs.toast) refs.toast.hidden = true;
        }, 260);
      }, 1700);
    },

    vibrate(pattern) {
      try {
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          navigator.vibrate(pattern);
        }
      } catch {
        // 不支持震动：静默
      }
    },
  };
}
