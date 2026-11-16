// DOM 渲染层：只负责把状态写进语义化 DOM 与 HUD，不计算规则、不改动游戏状态。

import { format, strings } from "./i18n.mjs";
import { NO_VALUE, averageOf, formatTime, tps } from "./score.mjs";
import { CHAPTERS, LEVELS, LEVEL_BY_ID, levelsOfChapter } from "./levels.mjs";
import { ao5For, bestMsFor, levelRecord, totalStars } from "./storage.mjs";

export function collectElements(root = document) {
  const byId = (id) => root.getElementById(id);
  return {
    root,
    canvas: byId("stage"),
    timer: byId("timer-value"),
    timerState: byId("timer-state"),
    moves: byId("moves-value"),
    tps: byId("tps-value"),
    pb: byId("pb-value"),
    ao5: byId("ao5-value"),
    modeTag: byId("mode-tag"),
    scramble: byId("scramble-value"),
    scrambleNote: byId("scramble-note"),
    tip: byId("chapter-tip"),
    langBtn: byId("lang-btn"),
    soundBtn: byId("sound-btn"),
    helpBtn: byId("help-btn"),
    levelsBtn: byId("levels-btn"),
    levelsBtn2: byId("levels-btn-2"),
    hintBtn: byId("hint-btn"),
    undoBtn: byId("undo-btn"),
    resetBtn: byId("reset-btn"),
    scrambleBtn: byId("scramble-btn"),
    modeButtons: Array.from(root.querySelectorAll("[data-mode]")),
    levelsLayer: byId("levels-layer"),
    levelsClose: byId("levels-close"),
    levelsDone: byId("levels-done"),
    freeRow: byId("free-row"),
    academyList: byId("academy-list"),
    academyStars: byId("academy-stars"),
    resultLayer: byId("result-layer"),
    resultClock: byId("result-title"),
    resultStars: byId("result-stars"),
    resultMoves: byId("result-moves"),
    resultTps: byId("result-tps"),
    resultScore: byId("result-score"),
    resultBest: byId("result-best"),
    resultNew: byId("result-new"),
    resultNext: byId("result-next"),
    resultAgain: byId("result-again"),
    resultClose: byId("result-close"),
    helpLayer: byId("help-layer"),
    helpClose: byId("help-close"),
    helpDone: byId("help-done"),
    helpBody: byId("help-body"),
    toast: byId("toast"),
  };
}

export function applyStaticLocale(locale) {
  const t = strings(locale);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = t.docTitle;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", t.metaDesc);
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (t[key] !== undefined) element.textContent = t[key];
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    const key = element.getAttribute("data-i18n-aria");
    if (t[key] !== undefined) element.setAttribute("aria-label", t[key]);
  });
  const langBtn = document.getElementById("lang-btn");
  if (langBtn) langBtn.textContent = t.langShort;
  const helpBody = document.getElementById("help-body");
  if (helpBody) helpBody.textContent = t.helpBody;
  const soundBtn = document.getElementById("sound-btn");
  if (soundBtn) {
    const muted = soundBtn.getAttribute("aria-pressed") === "false";
    soundBtn.textContent = muted ? "×" : "♪";
    soundBtn.setAttribute("aria-label", muted ? t.soundOff : t.soundOn);
  }
}

export function modeOfState(state) {
  if (state.mode === "academy") return "academy";
  return state.size === 3 ? "3" : "2";
}

export function renderModeButtons(els, state) {
  const active = modeOfState(state);
  for (const button of els.modeButtons) {
    button.classList.toggle("is-active", button.dataset.mode === active);
  }
}

function bestLabel(store, state) {
  if (state.mode === "academy") {
    const record = levelRecord(store, state.levelId);
    return record?.bestMs > 0 ? formatTime(record.bestMs) : NO_VALUE;
  }
  const best = bestMsFor(store, state.size);
  return best > 0 ? formatTime(best) : NO_VALUE;
}

function ao5Label(store, state) {
  if (state.mode === "academy") return NO_VALUE;
  const value = averageOf(ao5For(store, state.size));
  return value > 0 ? formatTime(value) : NO_VALUE;
}

export function renderHud(els, { state, locale, store, elapsed }) {
  const t = strings(locale);
  const time = Math.max(0, elapsed);
  els.timer.textContent = formatTime(time);
  els.moves.textContent = String(state.moveCount);
  els.tps.textContent = time > 0 ? tps(state.moveCount, time).toFixed(2) : "0.00";
  els.pb.textContent = bestLabel(store, state);
  els.ao5.textContent = ao5Label(store, state);

  els.timer.classList.toggle("is-hot", state.status === "running" && !state.paused);
  els.timer.classList.toggle("is-done", state.status === "solved");

  let stateKey = "readyHint";
  if (state.status === "solved") stateKey = "solvedHint";
  else if (state.status === "running" && state.paused) stateKey = "pausedHint";
  else if (state.status === "running") stateKey = "runningHint";
  els.timerState.textContent = t[stateKey];
}

export function renderDeck(els, { state, locale, store }) {
  const t = strings(locale);
  els.scramble.textContent = state.scrambleText || t.scrambleEmpty;

  if (state.mode === "academy") {
    const level = LEVEL_BY_ID[state.levelId] ?? LEVELS[0];
    els.scrambleNote.textContent = `${t.levelCard.replace("{0}", String(level.index))} · ${format(t.levelMeta, String(level.scramble.split(/\s+/).filter(Boolean).length), String(level.par))}`;
  } else if (state.dailyKey) {
    const done = store.stats.daily.key === state.dailyKey && store.stats.daily.bestMs > 0;
    const seed = String(state.seed ?? "").slice(-6);
    els.scrambleNote.textContent = done
      ? `${format(t.dailyHint, seed)} · ${format(t.dailyDone, formatTime(store.stats.daily.bestMs))}`
      : format(t.dailyHint, seed);
  } else {
    const seed = String(state.seed ?? "").slice(-6);
    els.scrambleNote.textContent = `${format(t.seedLabel, seed)} · ${format(t.hashLabel, String(state.scramble.length))}`;
  }

  if (state.mode === "academy") {
    const level = LEVEL_BY_ID[state.levelId] ?? LEVELS[0];
    const chapter = CHAPTERS.find((item) => item.id === level.chapter);
    els.tip.hidden = false;
    els.tip.textContent = `${t[chapter.titleKey]} · ${t[level.goalKey]} — ${t[chapter.tipKey]}`;
  } else {
    els.tip.hidden = true;
    els.tip.textContent = "";
  }
}

export function renderModeTag(els, { state, locale }) {
  const t = strings(locale);
  if (state.mode === "academy") {
    const level = LEVEL_BY_ID[state.levelId] ?? LEVELS[0];
    els.modeTag.textContent = format(t.tagAcademy, String(level.index).padStart(2, "0"));
    return;
  }
  if (state.dailyKey) els.modeTag.textContent = t.tagDaily;
  else els.modeTag.textContent = state.size === 3 ? t.tag3 : t.tag2;
}

export function renderLevels(els, { locale, store, state }) {
  const t = strings(locale);
  els.freeRow.replaceChildren();

  const freeOptions = [
    { mode: "2", size: 2, title: t.mode2, sub: bestMsFor(store, 2) > 0 ? formatTime(bestMsFor(store, 2)) : t.levelsFree },
    { mode: "3", size: 3, title: t.mode3, sub: bestMsFor(store, 3) > 0 ? formatTime(bestMsFor(store, 3)) : t.levelsFree },
  ];
  for (const option of freeOptions) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "free-card";
    card.dataset.freeMode = option.mode;
    if (modeOfState(state) === option.mode) card.classList.add("is-current");
    const title = document.createElement("b");
    title.textContent = option.title;
    const sub = document.createElement("span");
    sub.textContent = `${t.levelsFree} · ${t.pbLabel} ${option.sub}`;
    card.append(title, sub);
    els.freeRow.append(card);
  }

  els.academyStars.textContent = format(t.levelsTotal, String(totalStars(store)));
  els.academyList.replaceChildren();

  for (const chapter of CHAPTERS) {
    const levels = levelsOfChapter(chapter.id);
    const block = document.createElement("section");
    block.className = "chapter";

    const heading = document.createElement("h4");
    heading.className = "chapter-title";
    heading.textContent = t[chapter.titleKey];
    const count = document.createElement("span");
    const cleared = levels.filter((level) => levelRecord(store, level.id)?.cleared).length;
    count.textContent = `${cleared}/${levels.length}`;
    heading.append(count);

    const tip = document.createElement("p");
    tip.className = "chapter-tip";
    tip.textContent = t[chapter.tipKey];

    const grid = document.createElement("div");
    grid.className = "level-grid";

    for (const level of levels) {
      const record = levelRecord(store, level.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "level-card";
      card.dataset.level = level.id;
      card.title = `${t.levelCard.replace("{0}", String(level.index))} · ${t[level.goalKey]}`;
      if (record?.cleared) card.classList.add("is-cleared");
      if (state.mode === "academy" && state.levelId === level.id) card.classList.add("is-current");

      const number = document.createElement("span");
      number.className = "level-num";
      number.textContent = String(level.index).padStart(2, "0");
      const stars = document.createElement("span");
      stars.className = "level-stars";
      stars.textContent = record?.cleared ? "★".repeat(record.stars || 1) : "—";
      card.append(number, stars);
      grid.append(card);
    }

    block.append(heading, tip, grid);
    els.academyList.append(block);
  }
}

export function renderResult(els, { locale, ms, moves, score, best, isRecord, stars }) {
  els.resultClock.textContent = formatTime(ms);
  els.resultMoves.textContent = String(moves);
  els.resultTps.textContent = tps(moves, ms).toFixed(2);
  els.resultScore.textContent = String(score);
  els.resultBest.textContent = best > 0 ? formatTime(best) : NO_VALUE;
  els.resultNew.hidden = !isRecord;
  if (stars > 0) {
    els.resultStars.textContent = `${"★".repeat(stars)}${"☆".repeat(Math.max(0, 3 - stars))}`;
    els.resultStars.hidden = false;
  } else {
    els.resultStars.textContent = "";
    els.resultStars.hidden = true;
  }
}

let toastTimer = 0;

export function showToast(els, text, duration = 1700) {
  if (!els.toast) return;
  els.toast.textContent = text;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, duration);
}

export function openLayer(layer) {
  if (!layer) return;
  layer.hidden = false;
}

export function closeLayer(layer) {
  if (!layer) return;
  layer.hidden = true;
}

export function anyLayerOpen(els) {
  return Boolean(
    (els.levelsLayer && !els.levelsLayer.hidden)
    || (els.resultLayer && !els.resultLayer.hidden)
    || (els.helpLayer && !els.helpLayer.hidden),
  );
}
