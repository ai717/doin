// DOM 交互与 HUD：方向输入、撤销、重置、选关/结算弹层、文本热更新。
// Canvas 绘制交给 render.mjs；这里只转发玩家意图。

import { CHAPTERS, LEVELS } from "./levels.mjs";
import { format, htmlLang, strings } from "./i18n.mjs";
import { bestScoreFor, bestStepsFor, starsFor, totalStars } from "./storage.mjs";

const byId = (id) => document.getElementById(id);
const DIR_KEYS = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};

export function createUI(options = {}) {
  const handlers = options.handlers ?? {};
  let locale = options.locale ?? "zh";
  let t = strings(locale);
  let view = null;
  let store = null;
  let toastTimer = null;

  const refs = {
    canvas: byId("stage"),
    chamberTag: byId("chamber-tag"),
    levelLabel: byId("level-label"),
    levelPlate: byId("level-plate"),
    steps: byId("steps-value"),
    bestSteps: byId("best-steps-value"),
    cores: byId("cores-value"),
    pips: byId("core-pips"),
    optimal: byId("optimal-value"),
    best: byId("best-value"),
    status: byId("status-line"),
    pairA: byId("pair-a"),
    pairB: byId("pair-b"),
    pairAState: byId("pair-a-state"),
    pairBState: byId("pair-b-state"),
    sound: byId("sound-btn"),
    lang: byId("lang-btn"),
    help: byId("help-btn"),
    undo: byId("undo-btn"),
    reset: byId("reset-btn"),
    levels: byId("levels-btn"),
    movePad: byId("move-pad"),
    levelsLayer: byId("levels-layer"),
    levelsGrid: byId("levels-grid"),
    levelsTotal: byId("levels-total"),
    resultLayer: byId("result-layer"),
    resultBadge: byId("result-badge"),
    resultTitle: byId("result-title"),
    resultStars: byId("result-stars"),
    resultSteps: byId("result-steps"),
    resultOptimal: byId("result-optimal"),
    resultScore: byId("result-score"),
    resultBest: byId("result-best"),
    resultNext: byId("result-next"),
    resultAgain: byId("result-again"),
    resultClose: byId("result-close"),
    helpLayer: byId("help-layer"),
    helpBody: byId("help-body"),
    helpKeys: byId("help-keys"),
    helpPortals: byId("help-portals"),
    helpUndo: byId("help-undo"),
    toast: byId("toast"),
  };

  function applyStaticTexts() {
    document.documentElement.lang = htmlLang(locale);
    document.title = t.docTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t.metaDesc);
    for (const el of document.querySelectorAll("[data-i18n]")) {
      const key = el.getAttribute("data-i18n");
      if (typeof t[key] === "string") el.textContent = t[key];
    }
    for (const el of document.querySelectorAll("[data-i18n-aria]")) {
      const key = el.getAttribute("data-i18n-aria");
      if (typeof t[key] === "string") el.setAttribute("aria-label", t[key]);
    }
    refs.lang.textContent = t.langShort;
    refs.lang.setAttribute("aria-label", t.langLabel);
    refs.helpBody.textContent = t.helpBody;
    refs.helpKeys.textContent = t.helpKeys;
    refs.helpPortals.textContent = t.helpPortals;
    refs.helpUndo.textContent = t.helpUndo;
    refs.resultNext.textContent = t.next;
    refs.resultAgain.textContent = t.again;
    refs.resultClose.textContent = t.close;
    refs.canvas.setAttribute("aria-label", t.ariaCanvas);
    buildLevels();
  }

  function setLocale(next) {
    locale = next;
    t = strings(locale);
    applyStaticTexts();
  }

  function setMuted(muted) {
    refs.sound.setAttribute("aria-pressed", String(!muted));
    refs.sound.textContent = muted ? "×" : "♪";
    refs.sound.setAttribute("aria-label", muted ? t.soundOff : t.soundOn);
    refs.sound.setAttribute("title", muted ? t.soundOff : t.soundOn);
  }

  function isBlockedMove(state) {
    const type = state.lastMove?.type;
    return type === "blocked" || type === "impedance" || type === "wall" || type === "box-wall" || type === "box-box";
  }

  function statusText(state) {
    if (!view) return "";
    if (state.solved) return t.statusSolved;
    const last = state.lastMove?.type;
    if (last === "portal" || last === "portal-box") return t.statusPortal;
    if (isBlockedMove(state)) return t.statusBlocked;
    return t.statusReady;
  }

  function renderPips(state) {
    if (refs.pips.children.length !== state.goals.length) {
      refs.pips.textContent = "";
      for (let i = 0; i < state.goals.length; i += 1) {
        const pip = document.createElement("span");
        pip.className = "core-pip";
        refs.pips.append(pip);
      }
    }
    const filled = state.goals.filter((goal) =>
      state.boxes.some((box) => box.col === goal.col && box.row === goal.row),
    ).length;
    Array.from(refs.pips.children).forEach((pip, index) => {
      pip.classList.toggle("full", index < filled);
    });
    refs.cores.textContent = `${filled}/${state.goals.length}`;
  }

  function renderPairs(state) {
    for (const [key, ref, stateRef] of [
      ["A", refs.pairA, refs.pairAState],
      ["B", refs.pairB, refs.pairBState],
    ]) {
      const active = state.portals.some((portal) => portal.pair === key);
      ref.classList.toggle("offline", !active);
      stateRef.textContent = active ? t.pairActive : t.pairIdle;
    }
  }

  function render(nextView, nextStore) {
    view = nextView;
    store = nextStore ?? store;
    const state = view.state;
    const level = view.level;
    if (!state || !level) return;

    const chapter = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, state.chapter - 1))];
    refs.chamberTag.textContent = t[chapter.tagKey] ?? "";
    refs.levelLabel.textContent = format(t.levelName, level.index + 1);
    refs.levelPlate.textContent = `CHAMBER ${String(level.index + 1).padStart(2, "0")}`;
    refs.steps.textContent = String(state.steps);
    const bestSteps = store ? bestStepsFor(store, level.id) : 0;
    refs.bestSteps.textContent = bestSteps > 0 ? format(t.levelOptimal, bestSteps) : "—";
    refs.optimal.textContent = String(level.optimal);
    refs.best.textContent = String(store ? bestScoreFor(store, level.id) : 0);
    refs.status.textContent = statusText(state);
    refs.status.dataset.state = state.solved
      ? "solved"
      : state.lastMove?.type === "portal" || state.lastMove?.type === "portal-box"
        ? "portal"
        : isBlockedMove(state)
          ? "blocked"
          : "ready";
    refs.undo.disabled = !view.canUndo;
    renderPips(state);
    renderPairs(state);
  }

  function buildLevels() {
    if (!refs.levelsGrid) return;
    const fragment = document.createDocumentFragment();
    const currentId = view?.state?.levelId ?? null;
    CHAPTERS.forEach((chapter, chapterIndex) => {
      const group = document.createElement("section");
      group.className = "chapter";
      const heading = document.createElement("h3");
      heading.textContent = t[chapter.key] ?? "";
      group.append(heading);
      const grid = document.createElement("div");
      grid.className = "chapter-grid";
      for (const level of LEVELS.filter((item) => item.chapter === chapterIndex + 1)) {
        const stars = store ? starsFor(store, level.id) : 0;
        const bestSteps = store ? bestStepsFor(store, level.id) : 0;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "level-card";
        if (level.id === currentId) card.classList.add("current");
        card.dataset.level = level.id;
        card.setAttribute(
          "aria-label",
          `${format(t.levelName, level.index + 1)} · ${format(t.levelStars, stars)} · ${format(t.levelOptimal, bestSteps || level.optimal)}`,
        );
        const name = document.createElement("span");
        name.className = "level-name";
        name.textContent = format(t.levelName, level.index + 1);
        const starLine = document.createElement("span");
        starLine.className = "level-stars";
        starLine.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
        const score = document.createElement("span");
        score.className = "level-score";
        score.textContent = bestSteps > 0 ? String(bestSteps) : String(level.optimal);
        card.append(name, starLine, score);
        card.addEventListener("click", () => {
          closeLayer("levels");
          handlers.onPickLevel?.(level.id);
        });
        grid.append(card);
      }
      group.append(grid);
      fragment.append(group);
    });
    refs.levelsGrid.textContent = "";
    refs.levelsGrid.append(fragment);
    refs.levelsTotal.textContent = format(t.levelsTotal, store ? totalStars(store) : 0, LEVELS.length);
  }

  const layerMap = () => ({
    levels: refs.levelsLayer,
    result: refs.resultLayer,
    help: refs.helpLayer,
  });

  function openLayer(name) {
    const layer = layerMap()[name];
    if (!layer) return;
    if (name === "levels") buildLevels();
    layer.hidden = false;
    handlers.onLayerOpen?.(name);
    (layer.querySelector("button") ?? layer).focus?.();
  }

  function closeLayer(name) {
    const layer = layerMap()[name];
    if (!layer) return;
    layer.hidden = true;
    if (layer.contains(document.activeElement)) document.activeElement.blur();
    handlers.onLayerClose?.(name);
  }

  function anyLayerOpen() {
    return Object.values(layerMap()).some((layer) => !layer.hidden);
  }

  function showResult(payload) {
    refs.resultBadge.textContent = t.resultClear;
    refs.resultTitle.textContent = t.resultClear;
    refs.resultStars.textContent = "★".repeat(payload.stars) + "☆".repeat(3 - payload.stars);
    refs.resultSteps.textContent = String(payload.steps);
    refs.resultOptimal.textContent = String(payload.optimal);
    refs.resultScore.textContent = String(payload.score);
    refs.resultBest.textContent = String(payload.best);
    refs.resultNext.hidden = !payload.canNext;
    refs.resultLayer.hidden = false;
    refs.resultAgain.focus();
  }

  function hideResult() {
    refs.resultLayer.hidden = true;
    if (refs.resultLayer.contains(document.activeElement)) document.activeElement.blur();
  }

  function toast(text) {
    refs.toast.textContent = text;
    refs.toast.hidden = false;
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      refs.toast.hidden = true;
      toastTimer = null;
    }, 1800);
  }

  function hideToast() {
    refs.toast.hidden = true;
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  function bind() {
    refs.sound.addEventListener("click", () => handlers.onSound?.());
    refs.lang.addEventListener("click", () => handlers.onLang?.());
    refs.help.addEventListener("click", () => openLayer("help"));
    refs.undo.addEventListener("click", () => handlers.onUndo?.());
    refs.reset.addEventListener("click", () => handlers.onReset?.());
    refs.levels.addEventListener("click", () => handlers.onLevels?.());
    byId("levels-close").addEventListener("click", () => closeLayer("levels"));
    byId("help-close").addEventListener("click", () => closeLayer("help"));
    refs.resultNext.addEventListener("click", () => handlers.onNext?.());
    refs.resultAgain.addEventListener("click", () => handlers.onRestart?.());
    refs.resultClose.addEventListener("click", () => hideResult());

    for (const layer of [refs.levelsLayer, refs.helpLayer]) {
      layer.addEventListener("click", (event) => {
        if (event.target === layer) closeLayer(layer === refs.levelsLayer ? "levels" : "help");
      });
    }

    for (const button of refs.movePad.querySelectorAll("[data-dir]")) {
      const dir = button.dataset.dir;
      const start = (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        button.classList.add("held");
        handlers.onMove?.(dir);
      };
      const stop = () => button.classList.remove("held");
      button.addEventListener("pointerdown", start);
      button.addEventListener("pointerup", stop);
      button.addEventListener("pointercancel", stop);
      button.addEventListener("pointerleave", stop);
    }

    window.addEventListener("keydown", (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const layerOpen = anyLayerOpen();
      if (event.key === "Escape") {
        closeLayer("levels");
        closeLayer("help");
        return;
      }
      if (layerOpen) return;
      const key = event.key.toLowerCase();
      const dir = DIR_KEYS[key];
      if (dir) {
        event.preventDefault();
        if (!event.repeat) handlers.onMove?.(dir);
        return;
      }
      if (key === "z" || key === "u") {
        event.preventDefault();
        handlers.onUndo?.();
      } else if (key === "r") {
        event.preventDefault();
        handlers.onReset?.();
      }
    });

    window.addEventListener("resize", () => handlers.onResize?.());
  }

  bind();
  applyStaticTexts();

  return {
    render,
    setLocale,
    setMuted,
    toast,
    hideToast,
    buildLevels,
    openLayer,
    closeLayer,
    showResult,
    hideResult,
    anyLayerOpen,
    getLocale: () => locale,
    t: () => t,
    canvas: refs.canvas,
  };
}
