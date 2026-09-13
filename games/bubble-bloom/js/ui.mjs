// filepath: games/bubble-bloom/js/ui.mjs

// DOM HUD / 弹层 / toast / 语言切换。规则状态只读，不自行计分。

import { PULSE_MAX } from "./engine.mjs?v=dev";
import { format, htmlLang, strings } from "./i18n.mjs?v=dev";
import { tierColor } from "./palette.mjs?v=dev";
import { rankKey } from "./score.mjs?v=dev";

export function createUI(handlers) {
  const h = handlers || {};
  const byId = (id) => document.getElementById(id);

  const nodes = {
    board: byId("board"),
    chainPop: byId("chain-pop"),
    overlay: byId("overlay"),
    overlayTitle: byId("overlay-title"),
    overlayText: byId("overlay-text"),
    overlayBtn: byId("overlay-btn"),
    modeStandard: byId("btn-mode-standard"),
    modeDaily: byId("btn-mode-daily"),
    dailyNote: byId("daily-note"),
    score: byId("stat-score"),
    best: byId("stat-best"),
    tier: byId("stat-tier"),
    chain: byId("stat-chain"),
    txtCurrent: byId("txt-current"),
    txtNext: byId("txt-next"),
    pulse: byId("btn-pulse"),
    pulseCount: byId("pulse-count"),
    pause: byId("btn-pause"),
    restart: byId("btn-restart"),
    help: byId("btn-help"),
    sound: byId("btn-sound"),
    lang: byId("btn-lang"),
    codex: byId("codex"),
    hint: byId("hint"),
    modal: byId("modal"),
    modalTitle: byId("modal-title"),
    modalBody: byId("modal-body"),
    modalPrimary: byId("modal-primary"),
    modalSecondary: byId("modal-secondary"),
    toast: byId("toast")
  };

  let locale = "zh";
  let modalKind = null;
  let toastTimer = 0;
  let popTimer = 0;
  const prev = { score: -1, best: -1, tier: -1, chain: -1, current: 0, next: 0 };
  const dots = [];

  function tr(key, vars) {
    const table = strings[locale] || strings.en;
    const value = table[key];
    return format(typeof value === "string" ? value : key, vars);
  }

  function bump(el) {
    if (!el) return;
    el.classList.remove("is-bump");
    void el.offsetWidth;
    el.classList.add("is-bump");
  }

  function applyStatic() {
    const list = document.querySelectorAll("[data-i18n]");
    for (let i = 0; i < list.length; i += 1) {
      const el = list[i];
      const key = el.getAttribute("data-i18n");
      const table = strings[locale] || strings.en;
      if (typeof table[key] === "string") el.textContent = table[key];
    }
    if (document.documentElement) document.documentElement.lang = htmlLang(locale);
    if (nodes.lang) {
      nodes.lang.textContent = tr("app.langOther");
      nodes.lang.setAttribute("aria-label", tr("aria.lang"));
    }
    if (nodes.sound) nodes.sound.setAttribute("aria-label", tr("aria.sound"));
    if (nodes.board) nodes.board.setAttribute("aria-label", tr("aria.board"));
    if (nodes.pulse) nodes.pulse.disabled = false;
    prev.score = -1;
    prev.best = -1;
    prev.tier = -1;
    prev.chain = -1;
  }

  function buildCodex() {
    if (!nodes.codex || dots.length) return;
    for (let i = 1; i <= 10; i += 1) {
      const dot = document.createElement("span");
      dot.className = "codex-dot";
      dot.dataset.tier = String(i);
      nodes.codex.appendChild(dot);
      dots.push(dot);
    }
  }

  function renderCodex(codex) {
    buildCodex();
    const list = Array.isArray(codex) ? codex : [];
    for (let i = 0; i < dots.length; i += 1) {
      const on = Boolean(list[i]);
      dots[i].classList.toggle("is-unlocked", on);
      if (on) {
        const c = tierColor(i + 1);
        dots[i].style.background = `radial-gradient(circle at 34% 30%, ${c.lite}, ${c.base} 62%, ${c.deep})`;
        dots[i].style.color = c.base;
      } else {
        dots[i].style.background = "rgba(255,255,255,0.05)";
        dots[i].style.color = "transparent";
      }
    }
  }

  function setLocale(next) {
    locale = next === "en" ? "en" : "zh";
    applyStatic();
    buildCodex();
  }

  function setMode(mode, dateText) {
    const daily = mode === "daily";
    if (nodes.modeStandard) {
      nodes.modeStandard.classList.toggle("is-active", !daily);
      nodes.modeStandard.setAttribute("aria-pressed", String(!daily));
    }
    if (nodes.modeDaily) {
      nodes.modeDaily.classList.toggle("is-active", daily);
      nodes.modeDaily.setAttribute("aria-pressed", String(daily));
    }
    if (nodes.dailyNote) {
      if (daily && dateText) {
        nodes.dailyNote.textContent = tr("mode.dailyNote", { date: dateText });
        nodes.dailyNote.hidden = false;
      } else {
        nodes.dailyNote.hidden = true;
      }
    }
  }

  function setSound(on) {
    if (!nodes.sound) return;
    nodes.sound.setAttribute("aria-pressed", String(Boolean(on)));
    nodes.sound.title = on ? tr("app.soundOn") : tr("app.soundOff");
  }

  function updateHud(state, bestScore) {
    if (!state) return;

    if (state.score !== prev.score) {
      nodes.score.textContent = String(state.score);
      if (prev.score >= 0 && state.score > prev.score) bump(nodes.score);
      prev.score = state.score;
    }

    const best = Number.isFinite(bestScore) ? bestScore : 0;
    if (best !== prev.best) {
      nodes.best.textContent = String(best);
      if (prev.best >= 0 && best > prev.best) bump(nodes.best);
      prev.best = best;
    }

    if (state.maxTier !== prev.tier) {
      nodes.tier.textContent = state.maxTier ? tr(`tier.${state.maxTier}`) : "—";
      if (prev.tier >= 0 && state.maxTier > prev.tier) bump(nodes.tier);
      prev.tier = state.maxTier;
    }

    if (state.maxChain !== prev.chain) {
      nodes.chain.textContent = String(state.maxChain);
      if (prev.chain >= 0 && state.maxChain > prev.chain) bump(nodes.chain);
      prev.chain = state.maxChain;
    }

    if (nodes.pulseCount) nodes.pulseCount.textContent = String(state.pulses);
    if (nodes.pulse) nodes.pulse.disabled = state.phase !== "playing" || state.pulses <= 0 || state.pulseCooldown > 0;

    if (nodes.pause) nodes.pause.textContent = state.phase === "paused" ? tr("tool.resume") : tr("tool.pause");

    if (state.current !== prev.current) prev.current = state.current;
    if (state.next !== prev.next) prev.next = state.next;
  }

  function setSpecimenText(current, next) {
    if (nodes.txtCurrent) nodes.txtCurrent.textContent = current ? tr(`tier.${current}`) : "—";
    if (nodes.txtNext) nodes.txtNext.textContent = next ? tr(`tier.${next}`) : "—";
  }

  function showOverlay(kind) {
    if (!nodes.overlay) return;
    nodes.overlay.hidden = false;
    if (kind === "pause") {
      nodes.overlayTitle.textContent = tr("overlay.pauseTitle");
      nodes.overlayText.textContent = tr("overlay.pauseText");
      nodes.overlayBtn.textContent = tr("overlay.pauseBtn");
    } else {
      nodes.overlayTitle.textContent = tr("overlay.readyTitle");
      nodes.overlayText.textContent = tr("overlay.readyText");
      nodes.overlayBtn.textContent = tr("overlay.readyBtn");
    }
    nodes.overlayBtn.onclick = () => {
      if (h.onStart) h.onStart();
    };
  }

  function hideOverlay() {
    if (nodes.overlay) nodes.overlay.hidden = true;
  }

  function showChain(n) {
    if (!nodes.chainPop || n < 2) return;
    nodes.chainPop.textContent = tr("chain.pop", { n });
    nodes.chainPop.classList.remove("is-on");
    void nodes.chainPop.offsetWidth;
    nodes.chainPop.classList.add("is-on");
    if (popTimer) clearTimeout(popTimer);
    popTimer = setTimeout(() => {
      nodes.chainPop.classList.remove("is-on");
    }, 950);
  }

  function row(labelKey, value) {
    return `<div class="result-row"><dt>${tr(labelKey)}</dt><dd>${value}</dd></div>`;
  }

  function showResult(result, options) {
    const opts = options || {};
    modalKind = "result";
    const rank = tr(rankKey(result.score));
    const record = opts.isRecord ? `<span class="result-new">${tr("result.record")}</span>` : "";
    nodes.modalTitle.textContent = tr("result.title");
    nodes.modalBody.innerHTML =
      `<div class="result-rows">` +
      row("result.score", result.score) +
      row("result.tier", result.maxTier ? tr(`tier.${result.maxTier}`) : "—") +
      row("result.chain", result.maxChain) +
      row("result.drops", result.drops) +
      `</div>` +
      `<p class="result-rank"><b>${rank}</b>${record}</p>`;
    nodes.modalPrimary.textContent = tr("result.again");
    nodes.modalSecondary.textContent = tr("result.close");
    nodes.modalSecondary.hidden = false;
    nodes.modal.hidden = false;
    nodes.modalPrimary.focus();
  }

  function showHelp() {
    modalKind = "help";
    nodes.modalTitle.textContent = tr("help.title");
    nodes.modalBody.innerHTML =
      `<p>${tr("help.intro")}</p>` +
      `<ul class="help-list">` +
      `<li>${tr("help.r1")}</li><li>${tr("help.r2")}</li><li>${tr("help.r3")}</li>` +
      `<li>${tr("help.r4")}</li><li>${tr("help.r5")}</li>` +
      `</ul>` +
      `<p><b>${tr("help.keysTitle")}</b></p>` +
      `<div class="help-keys">` +
      `<kbd>← →</kbd><span>${tr("help.kMove")}</span>` +
      `<kbd>Space</kbd><span>${tr("help.kDrop")}</span>` +
      `<kbd>T</kbd><span>${tr("help.kPulse")}</span>` +
      `<kbd>P</kbd><span>${tr("help.kPause")}</span>` +
      `<kbd>R</kbd><span>${tr("help.kRestart")}</span>` +
      `</div>`;
    nodes.modalPrimary.textContent = tr("help.close");
    nodes.modalSecondary.hidden = true;
    nodes.modal.hidden = false;
    nodes.modalPrimary.focus();
  }

  function hideModal() {
    if (!nodes.modal) return;
    nodes.modal.hidden = true;
    modalKind = null;
  }

  function isModalOpen() {
    return Boolean(nodes.modal) && !nodes.modal.hidden;
  }

  function toast(key, vars) {
    if (!nodes.toast) return;
    nodes.toast.textContent = tr(key, vars);
    nodes.toast.classList.add("is-on");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      nodes.toast.classList.remove("is-on");
    }, 1900);
  }

  function bind() {
    if (nodes.modeStandard) {
      nodes.modeStandard.addEventListener("click", () => {
        if (h.onMode) h.onMode("standard");
      });
    }
    if (nodes.modeDaily) {
      nodes.modeDaily.addEventListener("click", () => {
        if (h.onMode) h.onMode("daily");
      });
    }
    if (nodes.pulse) {
      nodes.pulse.addEventListener("click", () => {
        if (h.onPulse) h.onPulse();
      });
    }
    if (nodes.pause) {
      nodes.pause.addEventListener("click", () => {
        if (h.onPauseToggle) h.onPauseToggle();
      });
    }
    if (nodes.restart) {
      nodes.restart.addEventListener("click", () => {
        if (h.onRestart) h.onRestart();
      });
    }
    if (nodes.help) {
      nodes.help.addEventListener("click", () => {
        if (h.onHelp) h.onHelp();
      });
    }
    if (nodes.sound) {
      nodes.sound.addEventListener("click", () => {
        if (h.onSound) h.onSound();
      });
    }
    if (nodes.lang) {
      nodes.lang.addEventListener("click", () => {
        if (h.onLang) h.onLang();
      });
    }
    if (nodes.modalPrimary) {
      nodes.modalPrimary.addEventListener("click", () => {
        if (modalKind === "result" && h.onRestart) h.onRestart();
        hideModal();
      });
    }
    if (nodes.modalSecondary) {
      nodes.modalSecondary.addEventListener("click", () => {
        hideModal();
      });
    }
  }

  bind();
  buildCodex();

  return {
    setLocale,
    applyStatic,
    updateHud,
    setSpecimenText,
    setMode,
    setSound,
    renderCodex,
    showOverlay,
    hideOverlay,
    showResult,
    showHelp,
    hideModal,
    isModalOpen,
    showChain,
    toast,
    nodes,
    PULSE_MAX
  };
}
