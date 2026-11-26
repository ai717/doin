// DOM presentation layer: HUD, level book, pause / result panels and toasts.

import { t, htmlLang } from "./i18n.mjs";
import { CHAPTERS, LEVELS_PER_CHAPTER, TOTAL_LEVELS } from "./levels.mjs";
import { formatTime } from "./score.mjs";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createUi(refs) {
  let locale = "zh";
  let toastTimer = 0;
  let bannerTimer = 0;

  function applyStatic(nextLocale) {
    locale = nextLocale === "en" ? "en" : "zh";
    document.documentElement.lang = htmlLang(locale);
    document.title = t(locale, "docTitle");
    for (const node of document.querySelectorAll("[data-i18n]")) {
      node.textContent = t(locale, node.dataset.i18n);
    }
    for (const node of document.querySelectorAll("[data-i18n-aria]")) {
      node.setAttribute("aria-label", t(locale, node.dataset.i18nAria));
    }
    if (refs.langBtn) refs.langBtn.textContent = t(locale, "langShort");
    if (refs.keyHint) {
      const touch = globalThis.matchMedia?.("(max-width: 768px)")?.matches;
      refs.keyHint.textContent = t(locale, touch ? "keyHintTouch" : "keyHint");
    }
  }

  function setHud({ levelText, chapter, lives = 3, score = 0, time = 0, chain = 0, bossHp = 0, bossMax = 0 }) {
    if (refs.hudLevel) refs.hudLevel.textContent = levelText;
    if (refs.hudChapter) refs.hudChapter.textContent = chapter;
    if (refs.hudScore) refs.hudScore.textContent = String(score);
    if (refs.hudTime) refs.hudTime.textContent = formatTime(time);
    if (refs.hudHearts) {
      refs.hudHearts.innerHTML = "";
      for (let i = 0; i < 5; i += 1) {
        const heart = el("span", i < lives ? "heart" : "heart dim", "♥");
        refs.hudHearts.append(heart);
      }
      refs.hudHearts.setAttribute("aria-label", t(locale, "lives"));
    }
    if (refs.hudChain) {
      refs.hudChain.textContent = t(locale, "chainShort", { n: chain });
      refs.hudChain.classList.toggle("is-live", chain >= 2);
    }
    if (refs.hudBoss) {
      refs.hudBoss.hidden = bossHp <= 0;
      if (bossHp > 0) {
        refs.hudBoss.innerHTML = "";
        refs.hudBoss.append(el("span", "boss-name", t(locale, "bossLabel")));
        for (let i = 0; i < bossMax; i += 1) {
          refs.hudBoss.append(el("span", i < bossHp ? "boss-pip" : "boss-pip dim", "◆"));
        }
      }
    }
  }

  function setPause(paused) {
    if (!refs.pauseBtn) return;
    refs.pauseBtn.textContent = t(locale, paused ? "resume" : "pause");
    refs.pauseBtn.setAttribute("aria-label", t(locale, "pauseAria"));
  }

  function setSound(muted) {
    if (!refs.soundBtn) return;
    refs.soundBtn.textContent = muted ? "×" : "♪";
    refs.soundBtn.setAttribute("aria-label", t(locale, muted ? "soundOff" : "soundOn"));
  }

  function setMode(mode) {
    if (!refs.modeBtn) return;
    refs.modeBtn.textContent = t(locale, mode === "rush" ? "modeShortRush" : "modeShortLevel");
  }

  function openPanel(id) {
    closePanels();
    const node = typeof id === "string" ? document.getElementById(id) : id;
    if (node) node.hidden = false;
  }

  function closePanels() {
    for (const node of document.querySelectorAll(".panel")) node.hidden = true;
  }

  function anyPanelOpen() {
    return Boolean(document.querySelector(".panel:not([hidden])"));
  }

  function showToast(message, duration = 1800) {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.classList.add("is-visible");
    globalThis.clearTimeout(toastTimer);
    toastTimer = globalThis.setTimeout(() => {
      refs.toast.classList.remove("is-visible");
      globalThis.setTimeout(() => {
        if (!refs.toast.classList.contains("is-visible")) refs.toast.textContent = "";
      }, 260);
    }, duration);
  }

  function hideToast() {
    refs.toast?.classList.remove("is-visible");
  }

  function showBanner(text, duration = 1900) {
    if (!refs.banner) return;
    refs.banner.textContent = text;
    refs.banner.classList.add("is-visible");
    globalThis.clearTimeout(bannerTimer);
    bannerTimer = globalThis.setTimeout(() => {
      refs.banner.classList.remove("is-visible");
      globalThis.setTimeout(() => {
        if (!refs.banner.classList.contains("is-visible")) refs.banner.textContent = "";
      }, 280);
    }, duration);
  }

  function updateLevels({ progress, current, onPick }) {
    const host = refs.levelGroups;
    if (!host) return;
    host.innerHTML = "";
    for (let chapter = 0; chapter < CHAPTERS.length; chapter += 1) {
      const block = el("section", "level-chapter");
      const head = el("div", "chapter-head");
      head.append(el("h3", "", t(locale, CHAPTERS[chapter].nameKey)));
      let done = 0;
      for (let i = 0; i < LEVELS_PER_CHAPTER; i += 1) {
        const record = progress?.stars?.[`snow_${String(chapter * LEVELS_PER_CHAPTER + i + 1).padStart(2, "0")}`];
        if (record?.stars) done += 1;
      }
      head.append(el("span", "chapter-count", t(locale, "chapterProgress", { done })));
      block.append(head);
      const grid = el("div", "level-grid");
      for (let i = 0; i < LEVELS_PER_CHAPTER; i += 1) {
        const index = chapter * LEVELS_PER_CHAPTER + i;
        const id = `snow_${String(index + 1).padStart(2, "0")}`;
        const record = progress?.stars?.[id];
        const stars = record?.stars ?? 0;
        const button = el("button", "level-chip");
        button.type = "button";
        button.dataset.index = String(index);
        if (index === current) button.classList.add("is-current");
        if (i === LEVELS_PER_CHAPTER - 1) button.classList.add("is-boss");
        button.append(el("span", "level-num", String(index + 1).padStart(2, "0")));
        const starRow = el("span", "level-stars");
        for (let s = 0; s < 3; s += 1) starRow.append(el("span", s < stars ? "star" : "star dim", "★"));
        button.append(starRow);
        button.setAttribute("aria-label", t(locale, "levelCardAria", { n: index + 1, stars }));
        button.addEventListener("click", () => onPick?.(index));
        grid.append(button);
      }
      block.append(grid);
      host.append(block);
    }
    const total = Object.values(progress?.stars ?? {}).reduce((sum, record) => sum + (record.stars || 0), 0);
    if (refs.levelTotal) {
      refs.levelTotal.textContent = t(locale, "totalStars", { n: total, total: TOTAL_LEVELS * 3 });
    }
  }

  function showResult({ snapshot, isNewBest = false }) {
    if (!refs.resultPanel) return;
    const titleKey = snapshot.status === "gameover"
      ? "resultGameOver"
      : snapshot.mode === "rush"
        ? "resultRush"
        : snapshot.completed
          ? "resultBoss"
          : "resultTitle";
    if (refs.resultTitle) refs.resultTitle.textContent = t(locale, titleKey);
    if (refs.resultStars) {
      refs.resultStars.innerHTML = "";
      for (let i = 0; i < 3; i += 1) {
        refs.resultStars.append(el("span", i < snapshot.stars ? "result-star" : "result-star dim", "★"));
      }
      refs.resultStars.hidden = snapshot.status === "gameover";
    }
    if (refs.resultRows) {
      refs.resultRows.innerHTML = "";
      const rows = snapshot.mode === "rush"
        ? [
            [t(locale, "rushScore"), String(snapshot.score)],
            [t(locale, "resultKills"), String(snapshot.rushKills)],
            [t(locale, "resultChain"), String(snapshot.maxChain)],
          ]
        : [
            [t(locale, "resultStars"), t(locale, "starCount", { n: snapshot.stars })],
            [t(locale, "resultTime"), formatTime(snapshot.elapsed * 1000)],
            [t(locale, "resultChain"), String(snapshot.maxChain)],
            [t(locale, "resultScore"), String(snapshot.score)],
          ];
      for (const [label, value] of rows) {
        const row = el("div", "result-row");
        row.append(el("span", "result-label", label));
        row.append(el("strong", "result-value", value));
        refs.resultRows.append(row);
      }
      const note = el("p", "result-note");
      if (snapshot.completed && snapshot.mode === "level") note.textContent = t(locale, "resultCompleted");
      if (isNewBest) note.textContent = t(locale, "newRecord");
      if (note.textContent) refs.resultRows.append(note);
    }
    openPanel(refs.resultPanel);
  }

  function setResultNext(label, disabled = false) {
    if (!refs.resultNext) return;
    refs.resultNext.textContent = label;
    refs.resultNext.disabled = Boolean(disabled);
  }

  return {
    applyStatic,
    setHud,
    setPause,
    setSound,
    setMode,
    openPanel,
    closePanels,
    anyPanelOpen,
    showToast,
    hideToast,
    showBanner,
    updateLevels,
    showResult,
    setResultNext,
    get locale() {
      return locale;
    },
  };
}
