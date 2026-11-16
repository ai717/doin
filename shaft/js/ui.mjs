// ui.mjs — 唯一碰 DOM 的层：HUD、浮层、选关与全量热更新。
// 不持有规则状态，只渲染 main / game 传入的快照，绝不重置引擎。

import { format } from "./i18n.mjs";
import { LEVEL_COUNT, CHAPTERS } from "./levels.mjs";

const RADAR_MAP = {
  normal: { key: "radarNormal", glyph: "▬" },
  spring: { key: "radarSpring", glyph: "⌁" },
  spike: { key: "radarSpike", glyph: "▲" },
  crumble: { key: "radarCrumble", glyph: "✕" },
  conveyorL: { key: "radarConveyor", glyph: "⇄" },
  conveyorR: { key: "radarConveyor", glyph: "⇄" },
  goal: { key: "radarGoal", glyph: "⛨" },
};

export function createUI(handlers = {}) {
  const el = (id) => document.getElementById(id);
  const dom = {
    backHome: el("back-home"),
    backText: el("back-text"),
    appTitleMain: el("app-title-main"),
    appSubtitle: el("app-subtitle"),
    btnLevels: el("btn-levels"),
    btnPause: el("btn-pause"),
    btnRestart: el("btn-restart"),
    btnSound: el("btn-sound"),
    btnLang: el("btn-lang"),
    btnHelp: el("btn-help"),
    modeBar: el("mode-bar"),
    modeChips: [...document.querySelectorAll(".mode-chip")],
    labelDepth: el("label-depth"),
    unitDepth: el("unit-depth"),
    valDepth: el("val-depth"),
    labelLife: el("label-life"),
    hearts: el("hearts"),
    valHp: el("val-hp"),
    labelGoal: el("label-goal"),
    goalTrack: el("goal-track"),
    goalFill: el("goal-fill"),
    valGoal: el("val-goal"),
    labelBest: el("label-best"),
    valBest: el("val-best"),
    labelRadar: el("label-radar"),
    radarIcon: el("radar-icon"),
    radarText: el("radar-text"),
    labelSpeed: el("label-speed"),
    unitSpeed: el("unit-speed"),
    valSpeed: el("val-speed"),
    speedFill: el("speed-fill"),
    keyHint: el("key-hint"),
    canvas: el("stage-canvas"),
    toast: el("toast"),
    btnLeft: el("btn-left"),
    btnRight: el("btn-right"),
    btnDive: el("btn-dive"),
    panelLevels: el("panel-levels"),
    panelPause: el("panel-pause"),
    panelResult: el("panel-result"),
    panelHelp: el("panel-help"),
    btnResume: el("btn-resume"),
    btnPauseRestart: el("btn-pause-restart"),
    btnPauseLevels: el("btn-pause-levels"),
    levelsTitle: el("levels-title"),
    levelsProgress: el("levels-progress"),
    levelsGrid: el("levels-grid"),
    btnLevelsClose: el("btn-levels-close"),
    resultTitle: el("result-title"),
    resultStars: el("result-stars"),
    resultStarNodes: [...el("result-stars").querySelectorAll(".star")],
    resultBadge: el("result-badge"),
    labelResDepth: el("label-res-depth"),
    resDepth: el("res-depth"),
    labelResHp: el("label-res-hp"),
    resHp: el("res-hp"),
    labelResTime: el("label-res-time"),
    resTime: el("res-time"),
    labelResScore: el("label-res-score"),
    resScore: el("res-score"),
    labelResStars: el("label-res-stars"),
    resStars: el("res-stars"),
    resultHint: el("result-hint"),
    btnRetry: el("btn-retry"),
    btnNext: el("btn-next"),
    btnAgain: el("btn-again"),
    btnLevelsResult: el("btn-levels-result"),
    helpTitle: el("help-title"),
    helpList: el("help-list"),
    btnHelpClose: el("btn-help-close"),
  };

  const heartNodes = [];
  for (let i = 0; i < 6; i += 1) {
    const node = document.createElement("span");
    node.className = "heart";
    node.textContent = "♥";
    dom.hearts.appendChild(node);
    heartNodes.push(node);
  }

  let t = null;
  let lastDepth = -1;
  let lastHp = -1;
  let lastGoal = -1;
  let lastBest = "";
  let lastSpeed = -1;
  let lastRadar = "";
  let lastSummary = null;
  let lastResultOpts = null;
  let currentLevelId = 1;
  let toastTimer = 0;

  /* ---------------- 事件绑定 ---------------- */
  dom.btnLevels.addEventListener("click", () => handlers.openLevels?.());
  dom.btnPause.addEventListener("click", () => handlers.togglePause?.());
  dom.btnResume.addEventListener("click", () => handlers.resume?.());
  dom.btnPauseRestart.addEventListener("click", () => handlers.pauseRestart?.());
  dom.btnPauseLevels.addEventListener("click", () => handlers.pauseLevels?.());
  dom.btnLevelsClose.addEventListener("click", () => handlers.closeLevels?.());
  dom.btnRestart.addEventListener("click", () => handlers.restart?.());
  dom.btnSound.addEventListener("click", () => handlers.toggleSound?.());
  dom.btnLang.addEventListener("click", () => handlers.toggleLang?.());
  dom.btnHelp.addEventListener("click", () => handlers.toggleHelp?.());
  dom.btnHelpClose.addEventListener("click", () => handlers.closeHelp?.());
  dom.btnRetry.addEventListener("click", () => handlers.retry?.());
  dom.btnNext.addEventListener("click", () => handlers.next?.());
  dom.btnAgain.addEventListener("click", () => handlers.again?.());
  dom.btnLevelsResult.addEventListener("click", () => handlers.openLevels?.());
  for (const chip of dom.modeChips) {
    chip.addEventListener("click", () => handlers.setMode?.(chip.dataset.mode));
  }

  const holdKey = (button, dir) => {
    if (!button) return;
    const press = (event) => {
      event.preventDefault();
      button.classList.add("is-down");
      handlers.hold?.(dir, true);
    };
    const release = (event) => {
      event.preventDefault();
      button.classList.remove("is-down");
      handlers.hold?.(dir, false);
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  };
  holdKey(dom.btnLeft, "left");
  holdKey(dom.btnRight, "right");
  holdKey(dom.btnDive, "dive");

  /* ---------------- HUD ---------------- */
  function setDepth(value) {
    const n = Math.max(0, Math.round(value));
    if (n !== lastDepth) {
      lastDepth = n;
      dom.valDepth.textContent = String(n);
      dom.valDepth.classList.remove("is-bump");
      void dom.valDepth.offsetWidth;
      dom.valDepth.classList.add("is-bump");
    }
  }

  function setHp(hp, max = 12) {
    const value = Math.max(0, Math.round(hp));
    lastHp = value;
    dom.valHp.textContent = t ? format(t.hudHpValue, { hp: value, max }) : `${value} / ${max}`;
    heartNodes.forEach((node, index) => {
      const full = value >= (index + 1) * 2;
      const half = !full && value >= index * 2 + 1;
      node.classList.toggle("is-full", full);
      node.classList.toggle("is-half", half);
      node.classList.toggle("is-empty", !full && !half);
    });
  }

  function setGoal(ratio, text, labelKey = "hudGoal") {
    const r = Math.max(0, Math.min(1, Number(ratio) || 0));
    if (r !== lastGoal) {
      lastGoal = r;
      dom.goalFill.style.width = `${Math.round(r * 100)}%`;
    }
    dom.valGoal.textContent = text;
    if (t) dom.labelGoal.textContent = t[labelKey] || t.hudGoal;
  }

  function setBest(text) {
    if (text === lastBest) return;
    lastBest = text;
    dom.valBest.textContent = text;
  }

  function setSpeed(value) {
    const n = Math.max(0, Math.round(value));
    if (n === lastSpeed) return;
    lastSpeed = n;
    dom.valSpeed.textContent = String(n);
    dom.speedFill.style.width = `${Math.min(100, Math.round((n / 760) * 100))}%`;
  }

  function setRadar(scan) {
    if (!t) return;
    if (!scan) {
      dom.radarIcon.textContent = "◎";
      dom.radarText.textContent = t.radarClear;
      lastRadar = "clear";
      return;
    }
    const entry = RADAR_MAP[scan.type] || RADAR_MAP.normal;
    const key = `${scan.type}:${scan.distance}`;
    if (key === lastRadar) return;
    lastRadar = key;
    dom.radarIcon.textContent = entry.glyph;
    dom.radarText.textContent = `${t[entry.key]} · ${format(t.radarDistance, { n: scan.distance })}`;
    dom.radarText.classList.toggle("is-warn", scan.type === "spike" || scan.type === "crumble");
  }

  function showToast(text, ms = 1300) {
    if (!text) return;
    dom.toast.textContent = text;
    dom.toast.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("is-show"), ms);
  }

  function bump() {
    dom.valDepth.classList.remove("is-bump");
    void dom.valDepth.offsetWidth;
    dom.valDepth.classList.add("is-bump");
  }

  /* ---------------- 浮层 ---------------- */
  const panels = {
    levels: dom.panelLevels,
    pause: dom.panelPause,
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
  function renderLevels(progress, currentT, level) {
    const copy = currentT || t;
    if (!copy) return;
    currentLevelId = level;
    dom.levelsGrid.textContent = "";
    let total = 0;
    for (const chapter of CHAPTERS) {
      const wrap = document.createElement("div");
      wrap.className = "level-chapter";
      const name = document.createElement("span");
      name.className = "level-chapter-name";
      name.textContent = `${format(copy.chapterLabel, { n: chapter.id })} · ${copy[`chapter${chapter.id}`]}`;
      wrap.appendChild(name);

      const cells = document.createElement("div");
      cells.className = "level-chapter-cells";
      for (let index = chapter.from; index <= chapter.to; index += 1) {
        const id = index;
        const stars = progress?.stars?.[String(id)] ?? 0;
        total += stars;
        const locked = id > (progress?.unlocked ?? 1);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "level-cell";
        cell.dataset.level = String(id);
        cell.disabled = locked;
        if (stars > 0) cell.classList.add("is-cleared");
        if (id === currentLevelId) cell.classList.add("is-current");
        cell.title = locked
          ? copy.levelLocked
          : `${format(copy.levelLabel, { n: id })} · ${format(copy.starCount, { n: stars })}`;
        cell.setAttribute("aria-label", cell.title);

        const num = document.createElement("span");
        num.className = "level-num";
        num.textContent = locked ? "🔒" : String(id);
        cell.appendChild(num);

        const starRow = document.createElement("span");
        starRow.className = "cell-stars";
        starRow.textContent = "★".repeat(stars) || "·";
        cell.appendChild(starRow);

        cell.addEventListener("click", () => handlers.selectLevel?.(id));
        cells.appendChild(cell);
      }
      wrap.appendChild(cells);
      dom.levelsGrid.appendChild(wrap);
    }
    dom.levelsProgress.textContent = `${total} / ${LEVEL_COUNT * 3} ★`;
  }

  /* ---------------- 结算 ---------------- */
  function showResult(summary, currentT, opts = {}) {
    const copy = currentT || t;
    if (!copy || !summary) return;
    t = copy;
    lastSummary = summary;
    lastResultOpts = opts;
    const { mode = "campaign", won = false, isNewBest = false, canNext = false } = opts;

    if (mode === "campaign") {
      dom.resultTitle.textContent = won
        ? copy.resultWinTitle
        : summary.reason === "void"
          ? copy.resultLostVoidTitle
          : copy.resultLostHpTitle;
    } else if (mode === "classic") {
      dom.resultTitle.textContent = won
        ? copy.resultClassicTitle
        : summary.reason === "void"
          ? copy.resultLostVoidTitle
          : copy.resultLostHpTitle;
    } else {
      dom.resultTitle.textContent = copy.resultEndlessTitle;
    }

    const stars = mode === "campaign" ? (summary.stars || 0) : 0;
    dom.resultStars.hidden = mode !== "campaign";
    dom.resultStarNodes.forEach((node, index) => node.classList.toggle("is-on", index < stars));
    dom.resStars.textContent = mode === "campaign" ? format(copy.starCount, { n: stars }) : "—";

    dom.resDepth.textContent = format(copy.resultDepthValue, { n: Math.round(summary.floors || 0) });
    dom.resHp.textContent = format(copy.hudHpValue, { hp: summary.hp ?? 0, max: summary.maxHp ?? 12 });
    dom.resTime.textContent = format(copy.resultTimeValue, { n: Math.round(summary.elapsed || 0) });
    dom.resScore.textContent = String(Math.round(summary.score || 0));
    dom.resultBadge.hidden = !isNewBest;
    dom.resultBadge.textContent = copy.resultBest;

    dom.resultHint.textContent =
      mode === "campaign"
        ? `${copy.starHint1} · ${copy.starHint2} · ${format(copy.starHint3, { n: Math.round(summary.parTime || 0) })}`
        : "";

    dom.btnRetry.hidden = mode !== "campaign";
    dom.btnNext.hidden = mode !== "campaign" || !won || !canNext;
    dom.btnAgain.hidden = mode === "campaign";
    dom.btnLevelsResult.textContent = copy.btnLevelsResult;

    openPanel("result");
  }

  function hideResult() {
    lastSummary = null;
    lastResultOpts = null;
    closePanels();
  }

  /* ---------------- locale 全量热更新 ---------------- */
  function applyLocale(nextStrings) {
    if (!nextStrings) return;
    t = nextStrings;
    document.title = t.docTitle;

    // 声明式全量热更新：静态标签、标题与 aria 一次覆盖
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (t[key] !== undefined) node.textContent = t[key];
    });
    document.querySelectorAll("[data-i18n-title]").forEach((node) => {
      const key = node.getAttribute("data-i18n-title");
      if (t[key] !== undefined) node.setAttribute("title", t[key]);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      const key = node.getAttribute("data-i18n-aria");
      if (t[key] !== undefined) node.setAttribute("aria-label", t[key]);
    });

    dom.appTitleMain.textContent = t.appTitle;
    dom.appSubtitle.textContent = t.appSubtitle;
    dom.backText.textContent = t.back;
    dom.btnLang.textContent = t.langSwitch;
    dom.btnLang.setAttribute("aria-label", t.langSwitch);
    dom.btnLevels.setAttribute("title", t.levelsBtn);
    dom.btnLevels.querySelector(".bar-text").textContent = t.levelsBtn;
    dom.btnRestart.setAttribute("title", t.restart);
    dom.btnSound.setAttribute("title", t.sound);
    dom.btnSound.setAttribute("aria-label", t.sound);
    dom.btnHelp.setAttribute("title", t.help);
    dom.btnHelp.setAttribute("aria-label", t.help);
    dom.modeBar.setAttribute("aria-label", t.modeAria);
    dom.canvas.setAttribute("aria-label", t.canvasAria);
    dom.btnLeft.setAttribute("aria-label", t.touchLeft);
    dom.btnRight.setAttribute("aria-label", t.touchRight);
    dom.btnDive.setAttribute("aria-label", t.touchDive);

    const byMode = { campaign: t.modeCampaign, classic: t.modeClassic, endless: t.modeEndless };
    for (const chip of dom.modeChips) chip.textContent = byMode[chip.dataset.mode] || chip.textContent;

    dom.labelDepth.textContent = t.hudDepth;
    dom.unitDepth.textContent = t.hudDepthUnit;
    dom.labelLife.textContent = t.hudLife;
    dom.labelGoal.textContent = t.hudGoal;
    dom.labelBest.textContent = t.hudBest;
    dom.labelRadar.textContent = t.hudRadar;
    dom.labelSpeed.textContent = t.hudSpeed;
    dom.unitSpeed.textContent = t.hudSpeedUnit;
    dom.keyHint.textContent = t.keyHint;
    dom.levelsTitle.textContent = t.levelsTitle;
    dom.levelsGrid.setAttribute("aria-label", t.levelsAria);
    dom.btnLevelsClose.textContent = t.btnClose;
    dom.labelResDepth.textContent = t.resultDepth;
    dom.labelResHp.textContent = t.resultHp;
    dom.labelResTime.textContent = t.resultTime;
    dom.labelResScore.textContent = t.resultScore;
    dom.labelResStars.textContent = t.resultStars;
    dom.btnRetry.textContent = t.btnRetry;
    dom.btnNext.textContent = t.btnNext;
    dom.btnAgain.textContent = t.btnAgain;
    dom.btnLevelsResult.textContent = t.btnLevelsResult;
    dom.helpTitle.textContent = t.helpTitle;
    dom.helpList.querySelectorAll("li").forEach((li, index) => {
      li.textContent = t[`help${index + 1}`] || "";
    });
    dom.btnHelpClose.textContent = t.helpClose;

    // 动态文本按当前语言重算（不触碰任何游戏状态）
    lastDepth = -1;
    lastHp = -1;
    lastGoal = -1;
    lastBest = "";
    lastSpeed = -1;
    lastRadar = "";
    dom.radarText.classList.remove("is-warn");
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

  function refreshResult() {
    if (lastSummary && isPanelOpen("result")) showResult(lastSummary, t, lastResultOpts || {});
  }

  return {
    dom,
    setDepth,
    setHp,
    setGoal,
    setBest,
    setSpeed,
    setRadar,
    showToast,
    bump,
    openPanel,
    closePanels,
    hideResult,
    isPanelOpen,
    anyPanelOpen,
    renderLevels,
    showResult,
    refreshResult,
    applyLocale,
    setMode,
    setSound,
    get strings() {
      return t;
    },
  };
}
