// ui.mjs — 唯一碰 DOM 的层：HUD 同步、浮层调度、选关渲染、locale 全量重绘。
// 不持有规则状态，只接收 game/main 传入的快照。

import { format } from "./i18n.mjs";
import { LEVEL_COUNT } from "./levels.mjs";
import { CHAPTERS } from "./levels.mjs";

const PLATFORM_KEY = {
  start: "platStart",
  plain: "platPlain",
  trampoline: "platTrampoline",
  vinyl: "platVinyl",
  moving: "platMoving",
  thin: "platThin",
  goal: "platGoal",
};

const PLATFORM_GLYPH = {
  start: "◆",
  plain: "■",
  trampoline: "⤴",
  vinyl: "◉",
  moving: "⇄",
  thin: "▭",
  goal: "⚑",
};

export function createUI(handlers = {}) {
  const el = (id) => document.getElementById(id);
  const dom = {
    backHome: el("back-home"),
    backText: el("back-text"),
    appTitleMain: el("app-title-main"),
    appSubtitle: el("app-subtitle"),
    btnSound: el("btn-sound"),
    btnLang: el("btn-lang"),
    btnHelp: el("btn-help"),
    modeBar: el("mode-bar"),
    modeChips: [...document.querySelectorAll(".mode-chip")],
    valScore: el("val-score"),
    valCombo: el("val-combo"),
    plaqueCombo: el("plaque-combo"),
    valExtra: el("val-extra"),
    labelExtra: el("label-extra"),
    valBest: el("val-best"),
    labelBest: el("label-best"),
    labelScore: el("label-score"),
    labelCombo: el("label-combo"),
    canvas: el("stage-canvas"),
    gaugeFill: el("gauge-fill"),
    plaqueGauge: el("plaque-gauge"),
    gaugeHint: el("gauge-hint"),
    labelGauge: el("label-gauge"),
    nextIcon: el("next-icon"),
    nextName: el("next-name"),
    labelNext: el("label-next"),
    keyHint: el("key-hint"),
    toast: el("toast"),
    panelReady: el("panel-ready"),
    panelLevels: el("panel-levels"),
    panelResult: el("panel-result"),
    panelHelp: el("panel-help"),
    readyKicker: el("ready-kicker"),
    readyTitle: el("ready-title"),
    readyDesc: el("ready-desc"),
    btnStart: el("btn-start"),
    btnLevels: el("btn-levels"),
    levelsTitle: el("levels-title"),
    levelsProgress: el("levels-progress"),
    levelsGrid: el("levels-grid"),
    btnLevelsClose: el("btn-levels-close"),
    resultTitle: el("result-title"),
    resultStars: el("result-stars"),
    resultStarsNodes: [...el("result-stars").querySelectorAll(".star")],
    labelResultScore: el("label-result-score"),
    resScore: el("res-score"),
    resultBadge: el("result-badge"),
    rowCombo: el("row-combo"),
    rowAccuracy: el("row-accuracy"),
    rowJumps: el("row-jumps"),
    rowLongest: el("row-longest"),
    rowRank: el("row-rank"),
    labelResCombo: el("label-res-combo"),
    labelResAccuracy: el("label-res-accuracy"),
    labelResJumps: el("label-res-jumps"),
    labelResLongest: el("label-res-longest"),
    labelResRank: el("label-res-rank"),
    resCombo: el("res-combo"),
    resAccuracy: el("res-accuracy"),
    resJumps: el("res-jumps"),
    resLongest: el("res-longest"),
    resRank: el("res-rank"),
    resultHint: el("result-hint"),
    btnRetry: el("btn-retry"),
    btnNext: el("btn-next"),
    btnAgain: el("btn-again"),
    btnBackLevels: el("btn-back-levels"),
    helpTitle: el("help-title"),
    helpList: el("help-list"),
    btnHelpClose: el("btn-help-close"),
  };

  let lastScore = -1;
  let lastCombo = -1;
  let gaugeLen = 0;
  let toastTimer = 0;

  try {
    gaugeLen = dom.gaugeFill.getTotalLength ? dom.gaugeFill.getTotalLength() : 150.8;
  } catch {
    gaugeLen = 150.8;
  }
  dom.gaugeFill.style.strokeDasharray = `${gaugeLen}`;
  dom.gaugeFill.style.strokeDashoffset = `${gaugeLen}`;

  function bump(node) {
    if (!node) return;
    node.classList.remove("is-bump");
    // 强制重排以便重复触发同一动画
    void node.offsetWidth;
    node.classList.add("is-bump");
  }

  /* ---------------- 事件绑定 ---------------- */
  dom.btnStart.addEventListener("click", () => handlers.start?.());
  dom.btnLevels.addEventListener("click", () => handlers.openLevels?.());
  dom.btnLevelsClose.addEventListener("click", () => handlers.closeLevels?.());
  dom.btnHelp.addEventListener("click", () => handlers.toggleHelp?.());
  dom.btnHelpClose.addEventListener("click", () => handlers.closeHelp?.());
  dom.btnSound.addEventListener("click", () => handlers.toggleSound?.());
  dom.btnLang.addEventListener("click", () => handlers.toggleLang?.());
  dom.btnRetry.addEventListener("click", () => handlers.retry?.());
  dom.btnNext.addEventListener("click", () => handlers.next?.());
  dom.btnAgain.addEventListener("click", () => handlers.again?.());
  dom.btnBackLevels.addEventListener("click", () => handlers.openLevels?.());
  for (const chip of dom.modeChips) {
    chip.addEventListener("click", () => handlers.setMode?.(chip.dataset.mode));
  }

  /* ---------------- HUD ---------------- */
  function setScore(value) {
    const n = Math.round(value);
    if (n === lastScore) return;
    lastScore = n;
    dom.valScore.textContent = String(n);
    bump(dom.valScore);
  }

  function setCombo(value) {
    const n = Math.round(value);
    if (n === lastCombo) return;
    lastCombo = n;
    dom.valCombo.textContent = `×${n}`;
    const lit = Math.min(1, n / 5);
    dom.plaqueCombo.style.setProperty("--lit", String(lit));
    dom.plaqueCombo.classList.toggle("is-hot", n > 0);
    if (n > 0) bump(dom.valCombo);
  }

  function setBest(value) {
    dom.valBest.textContent = String(Math.round(value));
  }

  function setExtra(label, value) {
    dom.labelExtra.textContent = label;
    dom.valExtra.textContent = value;
  }

  function setNextPlatform(type) {
    dom.nextIcon.textContent = PLATFORM_GLYPH[type] || PLATFORM_GLYPH.plain;
    if (currentStrings) dom.nextName.textContent = currentStrings[PLATFORM_KEY[type] || "platPlain"];
  }

  function setGauge(ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    dom.gaugeFill.style.strokeDashoffset = `${gaugeLen * (1 - r)}`;
    dom.plaqueGauge.classList.toggle("is-max", r >= 0.999);
  }

  function showToast(text, ms = 1500) {
    if (!text) return;
    dom.toast.textContent = text;
    dom.toast.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("is-show"), ms);
  }

  /* ---------------- 浮层 ---------------- */
  const panels = {
    ready: dom.panelReady,
    levels: dom.panelLevels,
    result: dom.panelResult,
    help: dom.panelHelp,
  };

  function openPanel(name) {
    for (const [key, node] of Object.entries(panels)) {
      node.classList.toggle("is-open", key === name);
    }
  }

  function closePanels() {
    for (const node of Object.values(panels)) node.classList.remove("is-open");
  }

  function isPanelOpen(name) {
    return !!panels[name]?.classList.contains("is-open");
  }

  function anyPanelOpen() {
    return Object.values(panels).some((node) => node.classList.contains("is-open"));
  }

  /* ---------------- 选关 ---------------- */
  function renderLevels(progress, t, currentLevel, bestStars) {
    dom.levelsGrid.textContent = "";
    for (const chapter of CHAPTERS) {
      const wrap = document.createElement("div");
      wrap.className = "level-chapter";
      const name = document.createElement("span");
      name.className = "level-chapter-name";
      name.textContent = format(t.chapterLabel, { n: chapter.id }) + " · " + t[`chapter${chapter.id}`];
      wrap.appendChild(name);

      const cells = document.createElement("div");
      cells.className = "level-chapter-cells";
      for (let k = 1; k <= 5; k += 1) {
        const id = (chapter.id - 1) * 5 + k;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "level-cell";
        cell.dataset.level = String(id);
        const stars = bestStars?.[String(id)] ?? 0;
        const locked = id > progress.unlocked;
        cell.disabled = locked;
        if (stars > 0) cell.classList.add("is-cleared");
        if (id === currentLevel) cell.classList.add("is-current");
        cell.title = locked ? t.levelsLocked : format(t.levelLabel, { n: id }) + " · " + format(t.starCount, { n: stars });
        cell.setAttribute("aria-label", cell.title);

        const num = document.createElement("span");
        num.textContent = locked ? "🔒" : String(id);
        cell.appendChild(num);

        if (stars > 0) {
          const st = document.createElement("span");
          st.className = "cell-stars";
          st.textContent = "★".repeat(stars);
          cell.appendChild(st);
        }

        cell.addEventListener("click", () => handlers.selectLevel?.(id));
        cells.appendChild(cell);
      }
      wrap.appendChild(cells);
      dom.levelsGrid.appendChild(wrap);
    }
    const total = Object.values(bestStars || {}).reduce((a, b) => a + b, 0);
    dom.levelsProgress.textContent = `${total} / ${LEVEL_COUNT * 3} ★`;
  }

  /* ---------------- 结算 ---------------- */
  function showResult(summary, t, opts = {}) {
    const { mode = "odyssey", won = false, isNewBest = false, canNext = false } = opts;

    if (mode === "odyssey") {
      dom.resultTitle.textContent = won ? t.resultWinTitle : t.resultLoseTitle;
    } else if (mode === "sniper") {
      dom.resultTitle.textContent = t.resultSniperTitle;
    } else {
      dom.resultTitle.textContent = t.resultEndlessTitle;
    }

    const stars = mode === "odyssey" ? (summary.stars || 0) : 0;
    dom.resultStars.style.display = mode === "odyssey" ? "flex" : "none";
    dom.resultStarsNodes.forEach((node, i) => node.classList.toggle("is-on", i < stars));

    dom.resScore.textContent = String(Math.round(summary.score ?? 0));
    dom.resultBadge.hidden = !isNewBest;
    dom.resultBadge.textContent = t.newBest;

    dom.resCombo.textContent = `×${Math.round(summary.bestCombo ?? 0)}`;
    dom.resAccuracy.textContent = `${Math.round((summary.accuracy ?? 0) * 100)}%`;
    dom.resJumps.textContent = String(Math.round(summary.jumps ?? 0));
    dom.resLongest.textContent = format(t.hudDistanceUnit, { n: Math.round(summary.maxDistance ?? 0) });

    dom.rowRank.style.display = mode === "sniper" ? "flex" : "none";
    if (mode === "sniper") {
      const rank = opts.rank || "C";
      dom.resRank.textContent = `${rank} · ${t[`rank${rank}`] || rank}`;
    }

    dom.resultHint.textContent = mode === "odyssey" ? `${t.starHint1} · ${t.starHint2} · ${t.starHint3}` : "";

    dom.btnRetry.hidden = mode !== "odyssey";
    dom.btnNext.hidden = mode !== "odyssey" || !won || !canNext;
    dom.btnAgain.hidden = mode === "odyssey";
    dom.btnBackLevels.hidden = mode === "odyssey" ? false : false;
    dom.btnBackLevels.textContent = t.btnBackLevels;
    dom.btnRetry.textContent = won ? t.btnRetry : t.btnRetry;

    openPanel("result");
  }

  /* ---------------- locale ---------------- */
  let currentStrings = null;

  function applyLocale(t) {
    currentStrings = t;
    document.title = t.docTitle;
    dom.appTitleMain.textContent = t.appTitle;
    dom.appSubtitle.textContent = t.appSubtitle;
    dom.backText.textContent = t.back;
    dom.btnLang.textContent = t.langSwitch;
    dom.btnLang.setAttribute("aria-label", t.langSwitch);
    dom.btnSound.setAttribute("aria-label", t.sound);
    dom.btnSound.setAttribute("title", t.sound);
    dom.btnHelp.setAttribute("aria-label", t.help);
    dom.btnHelp.setAttribute("title", t.help);
    dom.modeBar.setAttribute("aria-label", t.modeAria);

    const byMode = { odyssey: t.modeOdyssey, endless: t.modeEndless, sniper: t.modeSniper };
    for (const chip of dom.modeChips) chip.textContent = byMode[chip.dataset.mode] || chip.textContent;

    dom.labelScore.textContent = t.hudScore;
    dom.labelCombo.textContent = t.hudCombo;
    dom.labelGauge.textContent = t.gaugeTitle;
    dom.gaugeHint.textContent = t.gaugeHint;
    dom.labelNext.textContent = t.nextTitle;
    dom.keyHint.textContent = t.keyHint;
    dom.canvas.setAttribute("aria-label", t.canvasAria);

    dom.readyKicker.textContent = t.readyKicker;
    dom.readyTitle.textContent = t.readyTitle;
    dom.readyDesc.textContent = t.readyDesc;
    dom.btnStart.textContent = t.btnStart;
    dom.btnLevels.textContent = t.btnLevels;

    dom.levelsTitle.textContent = t.levelsTitle;
    dom.btnLevelsClose.textContent = t.back;
    dom.labelResultScore.textContent = t.resultScore;
    dom.labelResCombo.textContent = t.resultCombo;
    dom.labelResAccuracy.textContent = t.resultAccuracy;
    dom.labelResJumps.textContent = t.resultJumps;
    dom.labelResLongest.textContent = t.resultLongest;
    dom.labelResRank.textContent = t.resultRank;
    dom.btnRetry.textContent = t.btnRetry;
    dom.btnNext.textContent = t.btnNext;
    dom.btnAgain.textContent = t.btnAgain;

    dom.helpTitle.textContent = t.helpTitle;
    const items = dom.helpList.querySelectorAll("li");
    items.forEach((li, i) => {
      li.textContent = t[`help${i + 1}`] || "";
    });
    dom.btnHelpClose.textContent = t.helpClose;
  }

  function setMode(mode) {
    for (const chip of dom.modeChips) {
      const active = chip.dataset.mode === mode;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-selected", active ? "true" : "false");
    }
  }

  function setSound(on) {
    dom.btnSound.setAttribute("aria-pressed", on ? "true" : "false");
    dom.btnSound.querySelector(".bar-glyph").textContent = on ? "🔊" : "🔇";
  }

  function setExtraByMode(mode, t, state, bestValue) {
    if (mode === "odyssey") {
      setExtra(t.hudStage, format(t.hudLevelValue, { n: state.level }));
    } else if (mode === "sniper") {
      const shots = state.state?.sniper?.shots ?? 0;
      setExtra(t.hudShot.replace(" / {total}", ""), format(t.hudShot, { n: Math.min(shots + 1, 10), total: 10 }));
    } else {
      setExtra(t.hudLongest, format(t.hudDistanceUnit, { n: Math.round(state.state?.maxDistance ?? 0) }));
    }
    if (typeof bestValue === "number") setBest(bestValue);
  }

  return {
    dom,
    setScore,
    setCombo,
    setBest,
    setExtra,
    setExtraByMode,
    setNextPlatform,
    setGauge,
    showToast,
    openPanel,
    closePanels,
    isPanelOpen,
    anyPanelOpen,
    renderLevels,
    showResult,
    applyLocale,
    setMode,
    setSound,
    get strings() {
      return currentStrings;
    },
  };
}
