// ui.mjs — HUD、选关抽屉、暂停/结算/续关/帮助面板。语言切换只原地更新文本。

import { CHAPTERS, LEVELS, LEVEL_BY_ID, chapterOf } from "./levels.mjs";
import { htmlLang, t } from "./i18n.mjs";

function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function starRow(count, total = 3) {
  const wrapper = document.createElement("span");
  wrapper.className = "level-stars";
  for (let i = 0; i < total; i += 1) {
    const star = document.createElement("i");
    star.className = i < count ? "is-on" : "level-star-slot";
    star.textContent = "★";
    wrapper.appendChild(star);
  }
  return wrapper;
}

export function createUi(refs, handlers = {}) {
  let locale = "zh";
  let lastKo = -1;
  let bannerTimer = 0;
  let currentLevelId = null;
  let levelRecords = {};
  let arcadeBest = { bestKo: 0, bestScore: 0, bestBossKills: 0 };

  function $(id) {
    return document.getElementById(id);
  }

  const hud = {
    chapter: $("hud-chapter"),
    levelName: $("hud-level-name"),
    levelNum: $("hud-level-num"),
    hpRow1: $("hp-row-p1"),
    hpRow2: $("hp-row-p2"),
    hpFill1: $("hp-fill-p1"),
    hpFill2: $("hp-fill-p2"),
    hpNum1: $("hp-num-p1"),
    hpNum2: $("hp-num-p2"),
    ko: $("hud-ko"),
    wave: $("hud-wave"),
    time: $("hud-time"),
  };

  const levelsPanel = refs.levelsPanel;
  const pausePanel = refs.pausePanel;
  const resultPanel = refs.resultPanel;
  const continuePanel = refs.continuePanel;
  const helpPanel = refs.helpPanel;

  function setLocale(localeNext) {
    locale = localeNext === "en" ? "en" : "zh";
  }

  function applyStatic(localeNext) {
    setLocale(localeNext);
    document.documentElement.lang = htmlLang(locale);
    document.title = t(locale, "docTitle");
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (key) node.textContent = t(locale, key);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      const key = node.getAttribute("data-i18n-aria");
      if (key) node.setAttribute("aria-label", t(locale, key));
    });
    const langBtn = $("btn-lang");
    if (langBtn) langBtn.textContent = t(locale, "langShort");
    if (levelsPanel.hidden === false) renderLevels();
  }

  function setHud(state, game) {
    if (!state) return;
    const isArcade = state.mode === "arcade";
    const spec = state.spec ?? LEVEL_BY_ID[state.levelId];
    if (isArcade) {
      hud.chapter.textContent = t(locale, "arcadeLabel");
      hud.levelName.textContent = t(locale, "modeArcade");
      hud.levelNum.textContent = formatTime(state.timeLeft);
    } else if (spec) {
      hud.chapter.textContent = t(locale, chapterOf(spec).nameKey);
      hud.levelName.textContent = t(locale, spec.nameKey);
      hud.levelNum.textContent = t(locale, "levelLabel", spec.num);
    }

    hud.hpRow1.hidden = false;
    hud.hpRow1.classList.toggle("is-low", state.players[0] && state.players[0].hp <= 30);
    if (state.players[0]) {
      hud.hpFill1.style.width = `${Math.max(0, (state.players[0].hp / state.players[0].maxHp) * 100)}%`;
      hud.hpNum1.textContent = String(Math.max(0, Math.round(state.players[0].hp)));
    }
    const second = state.players[1];
    hud.hpRow2.hidden = !second;
    if (second) {
      hud.hpRow2.classList.toggle("is-low", second.hp <= 30);
      hud.hpFill2.style.width = `${Math.max(0, (second.hp / second.maxHp) * 100)}%`;
      hud.hpNum2.textContent = String(Math.max(0, Math.round(second.hp)));
    }

    if (state.ko !== lastKo) {
      hud.ko.textContent = String(state.ko);
      if (state.ko > lastKo && lastKo >= 0) {
        const box = hud.ko.parentElement;
        box.classList.remove("is-pop");
        void box.offsetWidth;
        box.classList.add("is-pop");
      }
      lastKo = state.ko;
    }

    if (isArcade) {
      hud.wave.textContent = "∞";
      hud.time.textContent = formatTime(state.timeLeft);
    } else {
      const total = state.spec?.waves?.length ?? 3;
      const index = state.phase === "boss" ? total : Math.min(total, state.waveIndex + 1);
      hud.wave.textContent = `${index} / ${total}`;
      hud.time.textContent = formatTime(state.time);
    }

    const coop = Boolean(state.players[1]);
    const hint = $("key-hint");
    if (hint) hint.textContent = t(locale, coop ? "keyHintCoop" : "keyHintP1");
    if (game?.mode === "arcade") hud.wave.textContent = "∞";
  }

  function showBanner(text, variant = "", small = false) {
    if (!text) return;
    refs.bannerText.textContent = text;
    refs.banner.className = "";
    void refs.banner.offsetWidth;
    refs.banner.classList.add("is-show");
    if (variant) refs.banner.classList.add(`is-${variant}`);
    if (small) refs.banner.classList.add("is-small");
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => {
      refs.banner.className = "";
    }, 1450);
  }

  function setMode(mode) {
    document.querySelectorAll(".mode-chip").forEach((chip) => {
      const active = chip.dataset.mode === mode;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function openLevels() {
    levelsPanel.hidden = false;
    renderLevels();
  }

  function closeLevels() {
    levelsPanel.hidden = true;
  }

  function renderLevels() {
    const body = $("levels-body");
    body.textContent = "";
    const chapterStars = CHAPTERS.map(() => 0);
    let total = 0;
    for (const level of LEVELS) {
      const record = levelRecords[level.id];
      if (record) {
        chapterStars[level.chapter] += record.stars;
        total += record.stars;
      }
    }

    CHAPTERS.forEach((chapter, index) => {
      const block = document.createElement("section");
      block.className = "chapter-block";
      const head = document.createElement("div");
      head.className = "chapter-head";
      const name = document.createElement("span");
      name.className = "chapter-name";
      name.textContent = t(locale, chapter.nameKey);
      const stars = document.createElement("span");
      stars.className = "chapter-stars";
      stars.textContent = t(locale, "chapterStars", chapterStars[index], 9);
      head.appendChild(name);
      head.appendChild(stars);

      const grid = document.createElement("div");
      grid.className = "level-grid";
      for (const level of LEVELS.filter((entry) => entry.chapter === index)) {
        grid.appendChild(buildLevelCard(level, levelRecords[level.id]));
      }
      block.appendChild(head);
      block.appendChild(grid);
      body.appendChild(block);
    });

    const arcade = document.createElement("div");
    arcade.className = "arcade-row";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = t(locale, "arcadeCard");
    const best = document.createElement("span");
    best.textContent = t(locale, "arcadeBest", arcadeBest.bestKo);
    info.appendChild(title);
    info.appendChild(document.createElement("br"));
    info.appendChild(best);
    const button = document.createElement("button");
    button.className = "btn";
    button.type = "button";
    button.textContent = t(locale, "modeArcade");
    button.addEventListener("click", () => {
      if (handlers.onArcade) handlers.onArcade();
    });
    arcade.appendChild(info);
    arcade.appendChild(button);
    body.appendChild(arcade);

    $("levels-total").textContent = t(locale, "starsTotal", total, LEVELS.length * 3);
  }

  function buildLevelCard(level, record) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "level-card";
    card.dataset.level = level.id;
    if (level.id === currentLevelId) card.classList.add("is-current");
    if (record?.cleared) card.classList.add("is-cleared");

    const num = document.createElement("span");
    num.className = "level-num";
    num.textContent = t(locale, "levelLabel", level.num);
    const name = document.createElement("span");
    name.className = "level-name";
    name.textContent = t(locale, level.nameKey);
    card.appendChild(num);
    card.appendChild(name);
    card.appendChild(starRow(record?.stars ?? 0));
    const best = document.createElement("span");
    best.className = "level-best";
    best.textContent = t(locale, "levelBestKo", record?.bestKo ?? 0);
    card.appendChild(best);
    card.addEventListener("click", () => {
      if (handlers.onSelectLevel) handlers.onSelectLevel(level.id);
    });
    return card;
  }

  function setProgress(store, levelId) {
    levelRecords = store?.progress ?? {};
    arcadeBest = store?.arcade ?? arcadeBest;
    currentLevelId = levelId ?? currentLevelId;
  }

  function showPause() {
    pausePanel.hidden = false;
  }

  function hidePause() {
    pausePanel.hidden = true;
  }

  function showHelp() {
    helpPanel.hidden = false;
  }

  function hideHelp() {
    helpPanel.hidden = true;
  }

  function showContinue(remaining) {
    $("continue-desc").textContent = t(locale, "continueDesc", remaining);
    continuePanel.hidden = false;
  }

  function hideContinue() {
    continuePanel.hidden = true;
  }

  function showResult(result, options = {}) {
    if (!result) return;
    const isArcade = result.mode === "arcade";
    const fail = result.outcome === "lose";
    $("result-kicker").textContent = isArcade
      ? t(locale, "arcadeLabel")
      : (result.levelNum ? t(locale, "levelLabel", result.levelNum) : t(locale, "modeStory"));
    $("result-title").textContent = isArcade
      ? t(locale, "resultArcadeTitle")
      : fail ? t(locale, "resultFailTitle") : t(locale, "resultClearTitle");
    const stars = Math.max(0, Math.min(3, result.stars ?? 0));
    const starNodes = document.querySelectorAll("#result-stars .star");
    starNodes.forEach((node, index) => {
      node.classList.toggle("is-on", !isArcade && index < stars);
    });
    $("res-ko").textContent = String(result.ko ?? 0);
    $("res-time").textContent = formatTime(result.time ?? 0);
    $("res-hp").textContent = `${Math.round((result.hpRatio ?? 0) * 100)}%`;
    $("res-score").textContent = String(result.score ?? 0);
    $("res-boss").textContent = String(result.bossKills ?? 0);
    $("res-continue").textContent = String(result.continuesUsed ?? 0);
    $("row-continue").hidden = isArcade;
    $("row-boss").hidden = isArcade;

    const sub = $("result-sub");
    if (options.newBest) sub.textContent = t(locale, "resultNewBest");
    else if (options.best) sub.textContent = t(locale, "resultBest", options.best);
    else sub.textContent = "";

    const next = $("btn-next");
    const isLast = !isArcade && result.levelNum >= LEVELS.length;
    next.hidden = isArcade || isLast || fail;
    resultPanel.hidden = false;
  }

  function hideResult() {
    resultPanel.hidden = true;
  }

  function anyPanelOpen() {
    return !levelsPanel.hidden || !pausePanel.hidden || !resultPanel.hidden || !helpPanel.hidden || !continuePanel.hidden;
  }

  function closeAll() {
    closeLevels();
    hidePause();
    hideResult();
    hideHelp();
    hideContinue();
  }

  return {
    applyStatic,
    setLocale,
    setHud,
    setMode,
    showBanner,
    openLevels,
    closeLevels,
    renderLevels,
    setProgress,
    showPause,
    hidePause,
    showHelp,
    hideHelp,
    showContinue,
    hideContinue,
    showResult,
    hideResult,
    anyPanelOpen,
    closeAll,
    get locale() {
      return locale;
    },
  };
}
