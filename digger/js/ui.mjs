// DOM 交互与 HUD：方向输入、打气、选关/暂停/结算弹层、文本热更新。
// Canvas 绘制交给 render.mjs；这里只转发玩家意图。

import { CHAPTERS, LEVELS } from "./levels.mjs";
import { format, htmlLang, strings } from "./i18n.mjs";
import { bestScoreFor, starsFor, totalStars } from "./storage.mjs";

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
  let pumpTimer = null;
  let mutedState = false;

  const refs = {
    canvas: byId("stage"),
    era: byId("era-value"),
    pooka: byId("pooka-count"),
    fygar: byId("fygar-count"),
    lives: byId("lives-dots"),
    score: byId("score-value"),
    best: byId("best-value"),
    status: byId("status-line"),
    levelPlate: byId("level-plate"),
    fossilSlots: Array.from(document.querySelectorAll(".fossil-slot")),
    fossilCount: byId("fossil-count"),
    pause: byId("pause-btn"),
    sound: byId("sound-btn"),
    lang: byId("lang-btn"),
    help: byId("help-btn"),
    levels: byId("levels-btn"),
    restart: byId("restart-btn"),
    pump: byId("pump-btn"),
    movePad: byId("move-pad"),
    levelsLayer: byId("levels-layer"),
    levelsGrid: byId("levels-grid"),
    levelsTotal: byId("levels-total"),
    pauseLayer: byId("pause-layer"),
    pauseResume: byId("pause-resume"),
    pauseRestart: byId("pause-restart"),
    pauseSound: byId("pause-sound"),
    pauseLevels: byId("pause-levels"),
    resultLayer: byId("result-layer"),
    resultBadge: byId("result-badge"),
    resultTitle: byId("result-title"),
    resultStars: byId("result-stars"),
    resultScore: byId("result-score"),
    resultFossils: byId("result-fossils"),
    resultBest: byId("result-best"),
    resultNext: byId("result-next"),
    resultAgain: byId("result-again"),
    resultClose: byId("result-close"),
    helpLayer: byId("help-layer"),
    helpBody: byId("help-body"),
    helpKeys: byId("help-keys"),
    helpMonsters: byId("help-monsters"),
    helpRocks: byId("help-rocks"),
    helpFossils: byId("help-fossils"),
    toast: byId("toast"),
  };

  for (let i = 0; i < 3; i += 1) {
    const hat = document.createElement("span");
    hat.className = "hat";
    refs.lives.append(hat);
  }

  function applyStaticTexts() {
    document.documentElement.lang = htmlLang(locale);
    document.title = t.docTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t.metaDesc);
    for (const el of document.querySelectorAll("[data-i18n]")) {
      const key = el.getAttribute("data-i18n");
      if (typeof t[key] !== "string") continue;
      const args = el.getAttribute("data-i18n-args");
      el.textContent = args ? format(t[key], ...args.split(",")) : t[key];
    }
    for (const el of document.querySelectorAll("[data-i18n-aria]")) {
      const key = el.getAttribute("data-i18n-aria");
      if (typeof t[key] === "string") el.setAttribute("aria-label", t[key]);
    }
    refs.lang.textContent = t.langShort;
    refs.lang.setAttribute("aria-label", t.langLabel);
    refs.helpBody.textContent = t.helpBody;
    refs.helpKeys.textContent = t.helpKeys;
    refs.helpMonsters.textContent = t.helpMonsters;
    refs.helpRocks.textContent = t.helpRocks;
    refs.helpFossils.textContent = t.helpFossils;
    refs.resultNext.textContent = t.next;
    refs.resultAgain.textContent = t.again;
    refs.resultClose.textContent = t.close;
    refs.pauseSound.textContent = mutedState ? t.soundOff : t.soundOn;
    refs.pauseSound.setAttribute("aria-label", mutedState ? t.soundOff : t.soundOn);
    buildLevels();
  }

  function setLocale(next) {
    locale = next;
    t = strings(locale);
    applyStaticTexts();
  }

  function setMuted(muted) {
    mutedState = Boolean(muted);
    refs.sound.setAttribute("aria-pressed", String(!mutedState));
    refs.sound.textContent = mutedState ? "×" : "♪";
    refs.sound.setAttribute("aria-label", mutedState ? t.soundOff : t.soundOn);
    refs.sound.setAttribute("title", mutedState ? t.soundOff : t.soundOn);
    refs.pauseSound.textContent = mutedState ? t.soundOff : t.soundOn;
    refs.pauseSound.setAttribute("aria-label", mutedState ? t.soundOff : t.soundOn);
  }

  function statusText(state) {
    if (!view) return "";
    if (view.paused) return t.pausedHint;
    if (state.status === "won") return t.statusClear;
    if (state.status === "lost") return t.statusFail;
    const danger = state.monsters.some((monster) => {
      if (!monster.alive) return false;
      if (monster.charge > 0 || monster.flameLeft > 0) return true;
      return Math.abs(monster.col - state.player.col) + Math.abs(monster.row - state.player.row) <= 3;
    });
    return danger ? t.statusDanger : t.statusDig;
  }

  function render(nextView, nextStore) {
    view = nextView;
    store = nextStore ?? store;
    const state = view.state;
    if (!state) return;

    const chapter = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, state.chapter - 1))];
    refs.era.textContent = t[chapter.eraKey] ?? "";
    refs.pooka.textContent = String(state.monsters.filter((monster) => monster.alive && monster.type === "pooka").length);
    refs.fygar.textContent = String(state.monsters.filter((monster) => monster.alive && monster.type === "fygar").length);
    refs.score.textContent = String(state.score);
    refs.best.textContent = String(store ? bestScoreFor(store, state.levelId) : 0);
    refs.status.textContent = statusText(state);
    refs.status.dataset.state = view.paused
      ? "paused"
      : state.status === "won"
        ? "won"
        : state.status === "lost"
          ? "lost"
          : statusText(state) === t.statusDanger
            ? "danger"
            : "dig";

    Array.from(refs.lives.children).forEach((hat, index) => {
      hat.classList.toggle("spent", index >= state.player.lives);
    });

    refs.fossilSlots.forEach((slot, index) => {
      const got = index < state.fossilsGot;
      slot.classList.toggle("collected", got);
      slot.setAttribute("aria-label", format(t.fossilSlot, index + 1));
    });
    refs.fossilCount.textContent = `${state.fossilsGot} / 3`;

    const level = view.level;
    if (level) refs.levelPlate.textContent = format(t.levelName, level.index + 1);
    refs.pause.setAttribute("aria-label", view.paused ? t.resume : t.pause);
    refs.pause.textContent = view.paused ? "▶" : "⏸";
    refs.pump.disabled = !view.canPump;
    refs.canvas.setAttribute("aria-label", t.ariaCanvas);
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
        const best = store ? bestScoreFor(store, level.id) : 0;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "level-card";
        if (level.id === currentId) card.classList.add("current");
        card.dataset.level = level.id;
        card.setAttribute("aria-label", `${format(t.levelName, level.index + 1)} · ${format(t.levelStars, stars)}`);
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

  const layerMap = () => ({
    levels: refs.levelsLayer,
    pause: refs.pauseLayer,
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
    refs.resultBadge.textContent = payload.clear ? t.resultClear : t.resultFail;
    refs.resultTitle.textContent = payload.clear ? t.resultClear : t.resultFail;
    refs.resultStars.textContent = payload.clear
      ? "★".repeat(payload.stars) + "☆".repeat(3 - payload.stars)
      : "☆☆☆";
    refs.resultScore.textContent = String(payload.score);
    refs.resultFossils.textContent = `${payload.fossils} / 3`;
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
    }, 2000);
  }

  function bind() {
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
    refs.pauseSound.addEventListener("click", () => handlers.onSound?.());
    refs.pauseLevels.addEventListener("click", () => handlers.onLevels?.());
    refs.resultNext.addEventListener("click", () => handlers.onNext?.());
    refs.resultAgain.addEventListener("click", () => handlers.onRestart?.());
    refs.resultClose.addEventListener("click", () => hideResult());

    for (const layer of [refs.levelsLayer, refs.helpLayer]) {
      layer.addEventListener("click", (event) => {
        if (event.target === layer) closeLayer(layer === refs.levelsLayer ? "levels" : "help");
      });
    }

    // 方向十字键：按下即走，抬起即停。
    for (const button of refs.movePad.querySelectorAll("[data-dir]")) {
      const dir = button.dataset.dir;
      const start = (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        button.classList.add("held");
        handlers.onMove?.(dir);
      };
      const stop = () => {
        button.classList.remove("held");
        handlers.onStop?.(dir);
      };
      button.addEventListener("pointerdown", start);
      button.addEventListener("pointerup", stop);
      button.addEventListener("pointercancel", stop);
      button.addEventListener("pointerleave", stop);
    }

    // 打气：点按一次；按住则以稳定节奏连续打气。
    const pump = (event) => {
      event.preventDefault();
      handlers.onPump?.();
    };
    refs.pump.addEventListener("pointerdown", (event) => {
      pump(event);
      refs.pump.classList.add("pumping");
      if (pumpTimer !== null) clearInterval(pumpTimer);
      pumpTimer = setInterval(() => handlers.onPump?.(), 150);
    });
    const stopPump = () => {
      refs.pump.classList.remove("pumping");
      if (pumpTimer !== null) {
        clearInterval(pumpTimer);
        pumpTimer = null;
      }
    };
    refs.pump.addEventListener("pointerup", stopPump);
    refs.pump.addEventListener("pointercancel", stopPump);
    refs.pump.addEventListener("pointerleave", stopPump);
    window.addEventListener("pointerup", stopPump);
    window.addEventListener("blur", stopPump);
    refs.pump.addEventListener("click", (event) => {
      if (event.detail === 0) handlers.onPump?.();
    });

    refs.canvas.addEventListener("pointerdown", (event) => {
      if (!view || view.paused || view.result) return;
      event.preventDefault();
      handlers.onPump?.();
    });

    window.addEventListener("keydown", (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const layerOpen = anyLayerOpen();
      if (event.key === "Escape") {
        if (layerOpen) {
          if (!refs.pauseLayer.hidden) handlers.onPause?.();
          closeLayer("levels");
          closeLayer("help");
        } else {
          handlers.onPause?.();
        }
        return;
      }
      if (layerOpen) return;
      if (event.code === "Space") {
        if (tag === "button" || tag === "a") return;
        event.preventDefault();
        if (!event.repeat) handlers.onPump?.();
        return;
      }
      const key = event.key.toLowerCase();
      const dir = DIR_KEYS[key];
      if (dir) {
        event.preventDefault();
        if (!event.repeat) handlers.onMove?.(dir);
        return;
      }
      if (key === "p") {
        event.preventDefault();
        handlers.onPause?.();
      } else if (key === "r") {
        event.preventDefault();
        handlers.onRestart?.();
      }
    });

    window.addEventListener("keyup", (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const dir = DIR_KEYS[event.key.toLowerCase()];
      if (dir) handlers.onStop?.(dir);
    });

    window.addEventListener("resize", () => handlers.onResize?.());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) handlers.onAutoPause?.();
    });
    window.addEventListener("blur", () => handlers.onAutoPause?.());
  }

  bind();
  applyStaticTexts();

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
