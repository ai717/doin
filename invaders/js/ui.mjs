// DOM layer: radar strip, fire console gauges, overlays and language hot update.
import { t, applyStaticTexts } from "./i18n.mjs";
import { LEVELS, TRAINING, TOTAL_LEVELS } from "./levels.mjs";
import { STATUS, MODES, comboMultiplier } from "./engine.mjs";
import { formatScore, totalStars } from "./score.mjs";

const OVERLAY_IDS = {
  menu: "menu-layer",
  report: "report-layer",
  help: "help-layer",
  pause: "pause-layer",
};

export function createUI(handlers = {}) {
  const el = (id) => document.getElementById(id);
  const refs = {
    radarWave: el("radar-wave"),
    radarAlive: el("radar-alive"),
    radarAlert: el("radar-alert"),
    heatFill: el("heat-fill"),
    hullCells: el("hull-cells"),
    comboVal: el("combo-val"),
    scoreVal: el("score-val"),
    modChip: el("mod-chip"),
    modName: el("mod-name"),
    modTimer: el("mod-timer"),
    hintStrip: el("hint-strip"),
    levelPanel: el("level-panel"),
    menuStats: el("menu-stats"),
    reportStars: el("report-stars"),
    reportStats: el("report-stats"),
    reportTitle: el("report-title"),
    btnNext: el("btn-next"),
    btnSound: el("btn-sound"),
    btnLang: el("btn-lang"),
    btnPause: el("btn-pause"),
    btnContinue: el("btn-continue"),
  };

  let lang = "zh";
  let overlay = "menu";
  let menuMode = MODES.CAMPAIGN;
  let lastReport = null;

  // ------------------------------------------------------------ overlays

  function showOverlay(name) {
    overlay = name;
    for (const [key, id] of Object.entries(OVERLAY_IDS)) {
      const node = el(id);
      if (!node) continue;
      node.classList.toggle("hidden", key !== name);
    }
    if (refs.btnPause) refs.btnPause.textContent = name === "pause" ? t("btnResume", lang) : t("btnPause", lang);
  }

  function currentOverlay() {
    return overlay;
  }

  // The hangar doubles as the level picker and as the pause screen, so it needs
  // a way back into a sortie that is still in progress.
  function setResumable(visible) {
    if (refs.btnContinue) refs.btnContinue.classList.toggle("hidden", !visible);
  }

  // ------------------------------------------------------------- hud

  function updateHud(state, force = false) {
    if (!state) return;
    const alive = state.aliens.reduce((sum, alien) => sum + (alien.alive ? 1 : 0), 0);
    const waves = state.mode === MODES.SURVIVAL ? `${state.waveIndex + 1}` : `${state.waveIndex + 1}/${state.waveCount}`;
    if (refs.radarWave) refs.radarWave.textContent = waves;
    if (refs.radarAlive) refs.radarAlive.textContent = String(alive);
    if (refs.radarAlert) {
      const hot = Boolean(state.mothership) || (state.pending && state.pending.count > 0);
      refs.radarAlert.classList.toggle("is-hot", hot);
      refs.radarAlert.textContent = hot ? t("radarAlert", lang) : t("radarCalm", lang);
    }

    const heat = state.turret.overheated ? 1 : state.turret.heat;
    if (refs.heatFill) {
      refs.heatFill.style.width = `${Math.round(heat * 100)}%`;
      refs.heatFill.classList.toggle("is-locked", state.turret.overheated);
    }
    if (refs.hullCells) {
      const cells = refs.hullCells.children;
      for (let i = 0; i < cells.length; i += 1) {
        cells[i].classList.toggle("is-lost", i >= state.hull);
      }
    }
    if (refs.comboVal) refs.comboVal.textContent = `x${comboMultiplier(state).toFixed(1)}`;
    if (refs.scoreVal) refs.scoreVal.textContent = formatScore(state.score);

    if (refs.modChip) {
      const active = Boolean(state.mod.key);
      refs.modChip.classList.toggle("hidden", !active);
      if (active) {
        refs.modName.textContent = t(state.mod.key, lang);
        refs.modTimer.textContent = `${Math.max(0, state.mod.timer).toFixed(1)}s`;
      }
    }
    if (refs.hintStrip) {
      const hint = state.hint ? t(state.hint, lang) : "";
      refs.hintStrip.classList.toggle("hidden", !hint);
      if (hint) refs.hintStrip.textContent = hint;
    }
    if (force) applyStaticTexts(document, lang);
  }

  function buildHullCells(maxHull) {
    if (!refs.hullCells) return;
    refs.hullCells.textContent = "";
    for (let i = 0; i < maxHull; i += 1) {
      const cell = document.createElement("span");
      cell.className = "hull-cell";
      refs.hullCells.appendChild(cell);
    }
  }

  // ------------------------------------------------------------- menu

  function renderMenu(progress, mode = menuMode) {
    menuMode = mode;
    for (const key of Object.keys(MODES)) {
      const value = MODES[key];
      const node = el(`btn-mode-${value}`);
      if (node) node.classList.toggle("is-active", value === mode);
    }
    if (!refs.levelPanel) return;
    refs.levelPanel.textContent = "";
    if (mode === MODES.SURVIVAL) {
      const note = document.createElement("p");
      note.className = "mode-desc";
      note.style.gridColumn = "1 / -1";
      note.textContent = `${t("survivalBest", lang)} ${progress.survival?.wave ?? 0} · ${t("survivalCombo", lang)} ${progress.survival?.combo ?? 0}`;
      refs.levelPanel.appendChild(note);
      const start = document.createElement("button");
      start.type = "button";
      start.className = "level-btn level-btn-wide";
      start.textContent = t("btnStartSurvival", lang);
      start.addEventListener("click", () => handlers.onStart?.(MODES.SURVIVAL, 1));
      refs.levelPanel.appendChild(start);
    } else {
      const list = mode === MODES.TRAINING ? TRAINING : LEVELS;
      for (const level of list) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "level-btn";
        const locked = mode === MODES.CAMPAIGN && level.id > (progress.unlocked ?? 1);
        button.classList.toggle("is-locked", locked);
        if (locked) button.disabled = true;
        const label = document.createElement("span");
        label.textContent = mode === MODES.TRAINING ? String(level.id - 100) : String(level.id);
        button.appendChild(label);
        const stars = document.createElement("span");
        stars.className = "level-stars";
        const count = progress.stars?.[level.id] ?? 0;
        stars.textContent = mode === MODES.TRAINING
          ? (progress.training?.[level.id] ? "✓" : "")
          : "★".repeat(count) + "☆".repeat(3 - count);
        button.appendChild(stars);
        button.addEventListener("click", () => handlers.onStart?.(mode, level.id));
        refs.levelPanel.appendChild(button);
      }
    }
    if (refs.menuStats) {
      const stars = totalStars(progress);
      refs.menuStats.textContent = `${t("totalStars", lang)} ${stars}/${TOTAL_LEVELS * 3} · ${t("survivalBest", lang)} ${progress.survival?.wave ?? 0}`;
    }
  }

  // ----------------------------------------------------------- report

  function statRow(labelKey, value) {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = t(labelKey, lang);
    const dd = document.createElement("dd");
    dd.textContent = value;
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    return wrap;
  }

  function showReport(report, state) {
    lastReport = report;
    const won = state.status === STATUS.WON;
    if (refs.reportTitle) {
      refs.reportTitle.textContent = won ? t("winTitle", lang) : t("loseTitle", lang);
    }
    if (refs.reportStars) {
      const filled = "★".repeat(report.stars) + "☆".repeat(Math.max(0, 3 - report.stars));
      refs.reportStars.textContent = report.stars > 0 || won ? filled : "☆☆☆";
    }
    if (refs.reportStats) {
      refs.reportStats.textContent = "";
      refs.reportStats.appendChild(statRow("statScore", formatScore(report.score)));
      refs.reportStats.appendChild(statRow("statAccuracy", `${report.accuracy}%`));
      refs.reportStats.appendChild(statRow("statCombo", `${report.bestCombo}`));
      refs.reportStats.appendChild(statRow("statHeadon", `${report.headons}`));
      refs.reportStats.appendChild(statRow("statHull", `${report.hull}/${report.maxHull}`));
      refs.reportStats.appendChild(statRow("statTime", `${report.seconds}s`));
    }
    if (refs.btnNext) {
      const canNext = won && state.mode === MODES.CAMPAIGN && report.levelId < TOTAL_LEVELS;
      refs.btnNext.classList.toggle("hidden", !canNext);
    }
    showOverlay("report");
  }

  // ----------------------------------------------------------- language

  function setLang(next) {
    lang = next === "en" ? "en" : "zh";
    applyStaticTexts(document, lang);
    if (refs.btnLang) refs.btnLang.textContent = t("langBtn", lang);
    return lang;
  }

  function getLang() {
    return lang;
  }

  function setSoundIcon(muted) {
    if (refs.btnSound) refs.btnSound.textContent = muted ? t("soundOff", lang) : t("soundOn", lang);
  }

  function setPaused(paused) {
    showOverlay(paused ? "pause" : "none");
  }

  return {
    refs,
    showOverlay,
    currentOverlay,
    setResumable,
    updateHud,
    buildHullCells,
    renderMenu,
    showReport,
    setLang,
    getLang,
    setSoundIcon,
    setPaused,
    get lastReport() {
      return lastReport;
    },
  };
}

export { OVERLAY_IDS };
