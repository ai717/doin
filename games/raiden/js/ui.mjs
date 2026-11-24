// DOM presentation for Raiden Lite: HUD, route selector, pause and result panels.

import { t, htmlLang } from "./i18n.mjs";
import { STAGES, TRAINING } from "./levels.mjs";
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
  let lastLives = -1;
  let lastBombs = -1;

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
    lastLives = -1;
    lastBombs = -1;
  }

  function renderPips(host, count, total, className) {
    if (!host) return;
    host.innerHTML = "";
    for (let i = 0; i < total; i += 1) host.append(el("span", i < count ? className : `${className} dim`, className === "life-pip" ? "▲" : "◆"));
  }

  function setHud(snap) {
    if (refs.hudStage) {
      refs.hudStage.textContent = snap.mode === "training"
        ? t(locale, "modeTraining")
        : t(locale, "stageLabel", { n: snap.stageNumber });
    }
    if (refs.hudName) {
      refs.hudName.textContent = snap.mode === "training"
        ? t(locale, "trainingLeftShort", { n: Math.ceil(snap.trainingLeft) })
        : t(locale, STAGES[snap.stageIndex]?.nameKey ?? "stageCloud");
    }
    if (refs.hudScore) refs.hudScore.textContent = String(snap.score);
    if (refs.hudGraze) refs.hudGraze.textContent = String(snap.graze);
    if (refs.hudWeapon) refs.hudWeapon.textContent = String(snap.weapon);
    if (snap.lives !== lastLives) {
      renderPips(refs.hudLives, snap.lives, 3, "life-pip");
      lastLives = snap.lives;
    }
    if (snap.bombs !== lastBombs) {
      renderPips(refs.hudBombs, snap.bombs, 3, "bomb-pip");
      lastBombs = snap.bombs;
    }
    if (refs.hudBombEnergy) refs.hudBombEnergy.style.width = `${Math.max(0, Math.min(100, snap.bombEnergy))}%`;
    if (refs.hudCharge) {
      refs.hudCharge.style.width = `${Math.round(Math.max(0, Math.min(1, snap.charge)) * 100)}%`;
      refs.hudCharge.classList.toggle("is-full", snap.charge >= 0.999);
    }
    if (refs.hudBoss) {
      refs.hudBoss.hidden = !(snap.bossMax > 0);
      if (snap.bossMax > 0 && refs.hudBossFill) {
        refs.hudBossFill.style.width = `${Math.max(0, Math.min(100, (snap.bossHp / snap.bossMax) * 100))}%`;
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
      }, 240);
    }, duration);
  }

  function showBanner(text, duration = 1700) {
    if (!refs.banner) return;
    refs.banner.textContent = text;
    refs.banner.classList.add("is-visible");
    globalThis.clearTimeout(bannerTimer);
    bannerTimer = globalThis.setTimeout(() => {
      refs.banner.classList.remove("is-visible");
      globalThis.setTimeout(() => {
        if (!refs.banner.classList.contains("is-visible")) refs.banner.textContent = "";
      }, 260);
    }, duration);
  }

  function setBannerText(text) {
    if (refs.banner) refs.banner.textContent = text;
  }

  function updateStages({ progress, current, mode, onPick }) {
    const host = refs.stageGrid;
    if (!host) return;
    host.innerHTML = "";
    let stars = 0;
    for (let i = 0; i < STAGES.length; i += 1) {
      const stage = STAGES[i];
      const record = progress?.stages?.[stage.id];
      const earned = record?.stars ?? 0;
      stars += earned;
      const button = el("button", "stage-chip");
      button.type = "button";
      button.dataset.index = String(i);
      if (mode !== "training" && i === current) button.classList.add("is-current");
      button.append(el("span", "stage-num", String(i + 1)));
      button.append(el("span", "stage-name", t(locale, stage.nameKey)));
      const starRow = el("span", "stage-stars");
      for (let s = 0; s < 3; s += 1) starRow.append(el("span", s < earned ? "star" : "star dim", "★"));
      button.append(starRow);
      if (record?.best) button.append(el("span", "stage-best", t(locale, "stageBest", { n: record.best })));
      button.setAttribute("aria-label", t(locale, "stageCardAria", { n: i + 1, name: t(locale, stage.nameKey), stars: earned }));
      button.addEventListener("click", () => onPick?.(i));
      host.append(button);
    }
    if (refs.stageTotal) refs.stageTotal.textContent = t(locale, "totalStars", { n: stars, total: STAGES.length * 3 });
    if (refs.trainingBest) {
      refs.trainingBest.textContent = t(locale, "trainingBest", { n: progress?.training?.bestGraze ?? 0 });
    }
    if (refs.trainingCard) {
      refs.trainingCard.classList.toggle("is-current", mode === "training");
      refs.trainingCard.hidden = false;
    }
    if (refs.trainingStars) {
      refs.trainingStars.innerHTML = "";
      const earned = progress?.training?.bestStars ?? 0;
      for (let s = 0; s < 3; s += 1) refs.trainingStars.append(el("span", s < earned ? "star" : "star dim", "★"));
    }
  }

  function showResult({ snapshot, isNewBest = false, best = 0 }) {
    if (!refs.resultPanel) return;
    const titleKey = snapshot.status === "gameover"
      ? "resultGameOver"
      : snapshot.mode === "training"
        ? "resultTraining"
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
      const rows = snapshot.mode === "training"
        ? [
            [t(locale, "resultStars"), t(locale, "starCount", { n: snapshot.stars })],
            [t(locale, "resultGraze"), String(snapshot.graze)],
            [t(locale, "resultScore"), String(snapshot.score)],
            [t(locale, "resultBest"), String(best)],
          ]
        : [
            [t(locale, "resultStars"), t(locale, "starCount", { n: snapshot.stars })],
            [t(locale, "resultGraze"), String(snapshot.graze)],
            [t(locale, "resultTime"), formatTime(snapshot.time * 1000)],
            [t(locale, "resultBombs"), String(snapshot.bombsUsed)],
            [t(locale, "resultScore"), String(snapshot.score)],
          ];
      for (const [label, value] of rows) {
        const row = el("div", "result-row");
        row.append(el("span", "result-label", label));
        row.append(el("strong", "result-value", value));
        refs.resultRows.append(row);
      }
      const note = el("p", "result-note");
      if (snapshot.completed && snapshot.status !== "gameover") note.textContent = t(locale, "resultCompleted");
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
    openPanel,
    closePanels,
    anyPanelOpen,
    showToast,
    showBanner,
    setBannerText,
    updateStages,
    showResult,
    setResultNext,
    get locale() {
      return locale;
    },
  };
}
