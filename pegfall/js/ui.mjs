// DOM 交互与 HUD：指针瞄准、快捷键、选关/暂停/结算弹层、文本热更新。
// Canvas 绘制交给 render.mjs；这里只把指针换算成瞄准角度并转发意图。

import { CANNON_X, CANNON_Y, STATUS_AIM, STATUS_FEVER, STATUS_FLIGHT, STATUS_LOST, STATUS_WON } from "./engine.mjs";
import { CHAPTERS, LEVELS } from "./levels.mjs";
import { starsFor, bestScoreFor, totalStars } from "./storage.mjs";
import { format, htmlLang, strings } from "./i18n.mjs";

const CHAPTER_KEYS = ["chapter_ch1", "chapter_ch2", "chapter_ch3", "chapter_ch4", "chapter_ch5"];
const MAX_DOTS = 10;

const byId = (id) => document.getElementById(id);

export function createUI(options = {}) {
  const handlers = options.handlers ?? {};
  let locale = options.locale ?? "zh";
  let t = strings(locale);
  let view = null;
  let store = null;
  let aiming = false;
  let toastTimer = null;

  const refs = {
    canvas: byId("stage"),
    balls: byId("balls-value"),
    dots: byId("ball-dots"),
    orange: byId("orange-value"),
    bar: byId("orange-bar"),
    combo: byId("combo-value"),
    power: byId("power-value"),
    score: byId("score-value"),
    best: byId("best-value"),
    status: byId("status-line"),
    aimHint: byId("aim-hint"),
    fire: byId("fire-btn"),
    levels: byId("levels-btn"),
    restart: byId("restart-btn"),
    pause: byId("pause-btn"),
    sound: byId("sound-btn"),
    lang: byId("lang-btn"),
    help: byId("help-btn"),
    levelsLayer: byId("levels-layer"),
    levelsGrid: byId("levels-grid"),
    levelsTotal: byId("levels-total"),
    pauseLayer: byId("pause-layer"),
    pauseResume: byId("pause-resume"),
    pauseRestart: byId("pause-restart"),
    pauseLevels: byId("pause-levels"),
    resultLayer: byId("result-layer"),
    resultBadge: byId("result-badge"),
    resultTitle: byId("result-title"),
    resultStars: byId("result-stars"),
    resultScore: byId("result-score"),
    resultBalls: byId("result-balls"),
    resultBest: byId("result-best"),
    resultNext: byId("result-next"),
    resultAgain: byId("result-again"),
    resultClose: byId("result-close"),
    helpLayer: byId("help-layer"),
    helpBody: byId("help-body"),
    helpKeys: byId("help-keys"),
    helpPegs: byId("help-pegs"),
    helpFever: byId("help-fever"),
    helpBucket: byId("help-bucket"),
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
    refs.helpPegs.textContent = t.helpPegs;
    refs.helpFever.textContent = t.helpFever;
    refs.helpBucket.textContent = t.helpBucket;
    refs.resultNext.textContent = t.next;
    refs.resultAgain.textContent = t.again;
    refs.resultClose.textContent = t.close;
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

  function ballDots(count) {
    const total = Math.max(MAX_DOTS, count);
    if (refs.dots.children.length !== total) {
      refs.dots.textContent = "";
      for (let i = 0; i < total; i += 1) {
        const dot = document.createElement("span");
        dot.className = "ball-dot";
        refs.dots.append(dot);
      }
    }
    Array.from(refs.dots.children).forEach((dot, index) => {
      dot.classList.toggle("full", index < Math.min(count, total));
    });
  }

  function powerText(state) {
    if (state.status === STATUS_WON || state.status === STATUS_LOST) return t.powerSpent;
    if (state.guideArmed) return t.powerGuide;
    if (!state.splitUsed) return t.powerNone;
    return t.powerSplit;
  }

  function statusText(state) {
    if (!view) return "";
    if (view.paused) return t.pausedHint;
    if (state.status === STATUS_WON) return t.resultClear;
    if (state.status === STATUS_LOST) return t.resultFail;
    if (state.status === STATUS_FEVER) return t.feverToast;
    if (state.status === STATUS_FLIGHT) return t.flightHint;
    return t.fireReady;
  }

  function render(nextView, nextStore) {
    view = nextView;
    store = nextStore ?? store;
    const state = view.state;
    if (!state) return;

    refs.balls.textContent = String(state.ballsLeft);
    ballDots(state.ballsLeft);
    const cleared = state.orangeTotal - state.orangeLeft;
    refs.orange.textContent = `${cleared} / ${state.orangeTotal}`;
    refs.bar.style.width = `${state.orangeTotal ? (cleared / state.orangeTotal) * 100 : 0}%`;
    refs.combo.textContent = String(state.shotCombo);
    refs.power.textContent = powerText(state);
    refs.power.dataset.state = state.guideArmed ? "guide" : state.splitUsed ? "split" : "idle";
    refs.score.textContent = String(state.score);
    refs.best.textContent = String(store ? bestScoreFor(store, state.levelId) : 0);
    refs.status.textContent = statusText(state);
    refs.status.dataset.state = view.paused ? "paused" : state.status;
    refs.aimHint.textContent = state.status === STATUS_AIM ? t.aimHint : t.flightHint;
    refs.fire.disabled = !view.canFire;
    refs.pause.setAttribute("aria-label", view.paused ? t.resume : t.pause);
    refs.pause.textContent = view.paused ? "▶" : "⏸";
    refs.canvas.classList.toggle("fever", state.status === STATUS_FEVER);
  }

  function buildLevels() {
    if (!refs.levelsGrid) return;
    const fragment = document.createDocumentFragment();
    CHAPTERS.forEach((chapter, chapterIndex) => {
      const group = document.createElement("section");
      group.className = "chapter";
      const heading = document.createElement("h3");
      heading.textContent = t[CHAPTER_KEYS[chapterIndex]] ?? chapter.key;
      group.append(heading);
      const grid = document.createElement("div");
      grid.className = "chapter-grid";
      for (const level of LEVELS.filter((item) => item.chapter === chapterIndex + 1)) {
        const stars = store ? starsFor(store, level.id) : 0;
        const best = store ? bestScoreFor(store, level.id) : 0;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "level-card";
        card.dataset.level = level.id;
        card.setAttribute(
          "aria-label",
          `${format(t.levelName, level.index + 1)} · ${format(t.levelStars, stars)}`,
        );
        const name = document.createElement("span");
        name.className = "level-name";
        name.textContent = format(t.levelName, level.index + 1);
        const starLine = document.createElement("span");
        starLine.className = "level-stars";
        starLine.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
        const score = document.createElement("span");
        score.className = "level-score";
        score.textContent = best ? String(best) : "—";
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

  function openLayer(name) {
    const layers = { levels: refs.levelsLayer, pause: refs.pauseLayer, result: refs.resultLayer, help: refs.helpLayer };
    const layer = layers[name];
    if (!layer) return;
    if (name === "levels") buildLevels();
    layer.hidden = false;
    handlers.onLayerOpen?.(name);
    (layer.querySelector("button") ?? layer).focus?.();
  }

  function closeLayer(name) {
    const layers = { levels: refs.levelsLayer, pause: refs.pauseLayer, result: refs.resultLayer, help: refs.helpLayer };
    const layer = layers[name];
    if (layer) layer.hidden = true;
    handlers.onLayerClose?.(name);
  }

  function anyLayerOpen() {
    return [refs.levelsLayer, refs.pauseLayer, refs.resultLayer, refs.helpLayer].some((layer) => !layer.hidden);
  }

  function showResult(payload) {
    refs.resultBadge.textContent = payload.clear ? t.resultClear : t.resultFail;
    refs.resultTitle.textContent = payload.clear ? t.resultClear : t.resultFail;
    refs.resultStars.textContent = payload.clear
      ? "★".repeat(payload.stars) + "☆".repeat(3 - payload.stars)
      : "☆☆☆";
    refs.resultScore.textContent = String(payload.score);
    refs.resultBalls.textContent = String(payload.ballsLeft);
    refs.resultBest.textContent = String(payload.best);
    refs.resultNext.hidden = !payload.canNext;
    refs.resultLayer.hidden = false;
    refs.resultAgain.focus();
  }

  function hideResult() {
    refs.resultLayer.hidden = true;
  }

  function toast(text) {
    refs.toast.textContent = text;
    refs.toast.hidden = false;
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      refs.toast.hidden = true;
      toastTimer = null;
    }, 2000);
  }

  function pointerAim(event) {
    const rect = refs.canvas.getBoundingClientRect();
    if (!rect.width) return 0;
    const x = ((event.clientX - rect.left) / rect.width) * 840;
    const y = ((event.clientY - rect.top) / rect.height) * 560;
    const degrees = (Math.atan2(x - CANNON_X, y - CANNON_Y) * 180) / Math.PI;
    return Math.max(-80, Math.min(80, degrees));
  }

  function bind() {
    refs.canvas.addEventListener("pointerdown", (event) => {
      if (!view || view.paused) return;
      refs.canvas.setPointerCapture?.(event.pointerId);
      if (view.state.status === STATUS_AIM) {
        aiming = true;
        handlers.onAim?.(pointerAim(event));
      } else {
        handlers.onFast?.(true);
      }
      event.preventDefault();
    });
    refs.canvas.addEventListener("pointermove", (event) => {
      if (!view || view.paused) return;
      if (view.state.status === STATUS_AIM) handlers.onAim?.(pointerAim(event));
    });
    const release = (event) => {
      if (!view || view.paused) return;
      if (aiming && view.state.status === STATUS_AIM) {
        aiming = false;
        handlers.onAim?.(pointerAim(event));
        handlers.onFire?.();
      } else {
        aiming = false;
        handlers.onFast?.(false);
      }
    };
    refs.canvas.addEventListener("pointerup", release);
    refs.canvas.addEventListener("pointercancel", () => {
      aiming = false;
      handlers.onFast?.(false);
    });
    refs.canvas.addEventListener("pointerleave", () => {
      if (aiming) aiming = false;
      handlers.onFast?.(false);
    });

    refs.fire.addEventListener("click", () => handlers.onFire?.());
    refs.levels.addEventListener("click", () => handlers.onLevels?.());
    refs.restart.addEventListener("click", () => handlers.onRestart?.());
    refs.pause.addEventListener("click", () => handlers.onPause?.());
    refs.sound.addEventListener("click", () => handlers.onSound?.());
    refs.lang.addEventListener("click", () => handlers.onLang?.());
    refs.help.addEventListener("click", () => openLayer("help"));
    byId("levels-close").addEventListener("click", () => closeLayer("levels"));
    byId("help-close").addEventListener("click", () => closeLayer("help"));
    refs.pauseResume.addEventListener("click", () => handlers.onPause?.());
    refs.pauseRestart.addEventListener("click", () => handlers.onRestart?.());
    refs.pauseLevels.addEventListener("click", () => handlers.onLevels?.());
    refs.resultNext.addEventListener("click", () => handlers.onNext?.());
    refs.resultAgain.addEventListener("click", () => handlers.onRestart?.());
    refs.resultClose.addEventListener("click", () => hideResult());

    for (const layer of [refs.levelsLayer, refs.pauseLayer, refs.resultLayer, refs.helpLayer]) {
      layer.addEventListener("click", (event) => {
        if (event.target === layer && layer !== refs.pauseLayer && layer !== refs.resultLayer) layer.hidden = true;
      });
    }

    window.addEventListener("keydown", (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.code === "Space") {
        event.preventDefault();
        if (event.repeat) return;
        if (view?.state.status === STATUS_AIM && !view.paused) handlers.onFire?.();
        else handlers.onFast?.(true);
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        event.preventDefault();
        handlers.onNudge?.(-0.5);
      } else if (key === "arrowright" || key === "d") {
        event.preventDefault();
        handlers.onNudge?.(0.5);
      } else if (key === "p" || key === "escape") {
        event.preventDefault();
        handlers.onPause?.();
      } else if (key === "r") {
        event.preventDefault();
        handlers.onRestart?.();
      }
    });
    window.addEventListener("keyup", (event) => {
      if (event.code === "Space") handlers.onFast?.(false);
    });
    window.addEventListener("resize", () => handlers.onResize?.());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) handlers.onAutoPause?.();
    });
    window.addEventListener("blur", () => handlers.onAutoPause?.());
  }

  bind();
  applyStaticTexts();
  ballDots(0);

  return {
    render,
    setLocale,
    setMuted,
    toast,
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
