// main.mjs - assembly only: preferences in, controller out, pixels on glass.
// No rule decisions and no drawing code live here.

import { hazardShapes } from "./engine.mjs";
import { PHASE, createGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import * as audio from "./audio.mjs";
import { htmlLang, translate } from "./i18n.mjs";
import { isUnlocked, nextLevelId } from "./levels.mjs";
import {
  loadLastLevel,
  loadLocale,
  loadProgress,
  loadSound,
  recordLevel,
  saveLastLevel,
  saveLocale,
  saveSound,
} from "./storage.mjs";

const PORTAL_META_KEY = "doin.meta.v1";
const FAIL_SFX = { dog: audio.bark, wire: audio.slip, laser: audio.slip, spot: audio.slip };

// 音效永远不许打断玩法：任何 WebAudio 异常都在这里被吞掉。
function play(fn, ...args) {
  try {
    if (typeof fn === "function") fn(...args);
  } catch {
    // Audio is a garnish; a broken node must never freeze the stage.
  }
}

function reportSession(payload, { persist }) {
  if (!payload) return;
  if (persist) {
    try {
      const raw = localStorage.getItem(PORTAL_META_KEY);
      const meta = raw ? JSON.parse(raw) : {};
      const stars = Math.max(0, Number(payload.stars) || 0);
      meta.recentlyPlayed = [
        payload.slug,
        ...(Array.isArray(meta.recentlyPlayed) ? meta.recentlyPlayed.filter((slug) => slug !== payload.slug) : []),
      ].slice(0, 8);
      meta.totalStars = Math.max(0, Number(meta.totalStars) || 0) + stars;
      localStorage.setItem(PORTAL_META_KEY, JSON.stringify(meta));
    } catch {
      // Storage may be blocked; the run itself is unaffected.
    }
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload }, "*");
    }
  } catch {
    // Cross-origin sandbox: ignore.
  }
}

export function boot() {
  const canvas = document.getElementById("stage");
  if (!canvas) return null;

  let locale = loadLocale();
  let soundOn = loadSound();
  try {
    audio.setEnabled(soundOn);
  } catch {
    // 音频不可用时整局照玩，只是没有音效。
  }

  const renderer = createRenderer(canvas);
  renderer.resize();

  const effects = { shockT: 0, grabT: 0, shake: 0 };
  let clock = 0;
  let snap = null;
  let ui = null;
  let rafId = 0;
  let lastFrame = 0;
  let stretchAt = 0;
  let lastTravelled = 0;
  let prevPhase = PHASE.AIM;
  let prevWraps = 0;
  let prevLevers = {};

  const t = (key, vars) => translate(locale, key, vars);

  const handlers = {
    click: () => play(audio.click),
    restart: () => {
      ui?.hideResult();
      game.restart();
    },
    resume: () => {
      autoPaused = false;
      game.resume();
    },
    pauseToggle: () => {
      game.togglePause();
      autoPaused = false;
    },
    next: () => {
      const before = game.level?.id ?? 1;
      if (nextLevelId(before) === before) {
        ui?.toast(t("finalLevel"));
        return;
      }
      game.nextLevel();
      const after = game.level?.id ?? before;
      if (after === before) ui?.toast(t("locked"));
      else saveLastLevel(after);
    },
    startLevel: (id) => {
      const progress = loadProgress();
      if (!isUnlocked(id, progress.cleared) && !progress.cleared[id]) {
        ui?.toast(t("locked"));
        return;
      }
      ui?.closeDrawer();
      ui?.hideResult();
      game.start(id);
      saveLastLevel(id);
    },
    toggleSound: () => {
      soundOn = !soundOn;
      try {
        audio.setEnabled(soundOn);
      } catch {
        // 同上：音频坏了不影响静音开关的记忆。
      }
      saveSound(soundOn);
      ui?.setSound(soundOn);
      if (soundOn) play(audio.click);
    },
    toggleLang: () => {
      locale = locale === "zh" ? "en" : "zh";
      saveLocale(locale);
      ui?.setLocale(locale);
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", t("metaDesc"));
      document.documentElement.lang = htmlLang(locale);
      play(audio.click);
    },
  };

  const game = createGame({
    loadProgress,
    recordLevel,
    onChange(next) {
      snap = next;
      ui?.sync(next);
      handleAudioCues(next);
    },
    onWin(result) {
      effects.grabT = 0;
      ui?.showResult(result);
      play(audio.win);
    },
    onEvent(payload) {
      reportSession(payload, { persist: payload?.outcome === "WON" });
    },
  });

  function handleAudioCues(next) {
    if (next.phase === PHASE.RETRACT && prevPhase === PHASE.AIM) {
      effects.grabT = 0;
      play(audio.grab);
    }
    if (next.phase === PHASE.SHOCK && prevPhase !== PHASE.SHOCK) {
      effects.shockT = 0;
      effects.shake = 10;
      play(audio.shock);
      const cue = FAIL_SFX[next.failure?.kind];
      if (cue) window.setTimeout(() => play(cue), 120);
      ui?.showFail(next.failure?.kind);
    }
    if (next.wraps > prevWraps) play(audio.anchor);
    for (const [group, on] of Object.entries(next.levers ?? {})) {
      if (on && !prevLevers[group]) play(audio.lever);
    }
    if (next.dragging && next.phase === PHASE.AIM && clock - stretchAt > 0.1) {
      stretchAt = clock;
      const speed = Math.abs(next.travelled - lastTravelled);
      play(audio.stretch, Math.min(1, speed / 42));
    }
    lastTravelled = next.travelled;
    prevPhase = next.phase;
    prevWraps = next.wraps;
    prevLevers = { ...(next.levers ?? {}) };
  }

  ui = createUI({ game, renderer, handlers, locale });
  ui.setSound(soundOn);
  ui.setLocale(locale);
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", t("metaDesc"));

  const saved = loadLastLevel();
  const progress = loadProgress();
  const startId = saved && (isUnlocked(saved, progress.cleared) || progress.cleared[saved]) ? saved : 1;
  game.start(startId);
  snap = game.snapshot();

  // ---- frame loop ------------------------------------------------------
  function draw(dt) {
    if (!snap) return;
    if (snap.phase === PHASE.SHOCK) effects.shockT += dt;
    if (snap.phase === PHASE.RETRACT || snap.phase === PHASE.WON) effects.grabT += dt;
    const level = snap.level;
    const state = game.engine;
    const hazards = level && state ? hazardShapes(level, state) : null;
    renderer.draw(snap, { time: clock, effects, locale, hazards });
  }

  function frame(now) {
    rafId = window.requestAnimationFrame(frame);
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    if (dt > 0) {
      clock += dt;
      game.tick(dt);
    }
    effects.shake = Math.max(0, effects.shake - dt * 30);
    draw(dt);
  }

  function onResize() {
    renderer.resize();
    draw(0);
  }

  window.requestAnimationFrame((now) => {
    lastFrame = now;
    frame(now);
  });
  window.addEventListener("resize", onResize);
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(onResize).observe(canvas);
  }

  // ---- keyboard --------------------------------------------------------
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "escape") {
      if (ui.resultOpen) ui.hideResult();
      else if (ui.helpOpen) ui.closeHelp();
      else if (ui.drawerOpen) ui.closeDrawer();
      else game.togglePause();
      event.preventDefault();
      return;
    }
    if (key === "p") {
      game.togglePause();
      event.preventDefault();
      return;
    }
    if (key === "r") {
      ui.hideResult();
      game.restart();
      event.preventDefault();
      return;
    }
    if (key === "m") {
      handlers.toggleSound();
      event.preventDefault();
      return;
    }
    if (key === " " || key === "enter") {
      if (ui.resultOpen) {
        ui.hideResult();
        handlers.next();
        event.preventDefault();
      }
    }
  });

  // ---- auto pause ------------------------------------------------------
  // 只有当"是系统把我们按停的"才允许自动恢复：玩家自己点暂停后切走再回来，
  // 不该被强行开回游戏。headless / 内嵌 iframe 常在首帧就发 blur，靠这套
  // autoPaused 标记避免一进页面就卡在暂停层。
  let autoPaused = false;
  const autoPause = () => {
    if (!snap || game.paused) return;
    autoPaused = true;
    game.pause();
  };
  const autoResume = () => {
    if (!autoPaused) return;
    autoPaused = false;
    lastFrame = 0;
    game.resume();
  };
  handlers.autoResume = autoResume;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) autoPause();
    else autoResume();
  });
  window.addEventListener("blur", autoPause);
  window.addEventListener("focus", autoResume);
  // 首次按下就拿回控制权：即便 focus 事件没到，也不会"点了没反应"。
  // 挂在 window 捕获阶段，保证先于画布自己的 pointerdown 处理。
  window.addEventListener(
    "pointerdown",
    () => {
      if (!document.hidden) autoResume();
    },
    { capture: true },
  );

  const api = {
    get game() {
      return game;
    },
    get snapshot() {
      return snap;
    },
    get ui() {
      return ui;
    },
    get renderer() {
      return renderer;
    },
    get locale() {
      return locale;
    },
    handlers,
    stop() {
      window.cancelAnimationFrame(rafId);
    },
  };

  window.__thief = api;
  return api;
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const start = () => {
    try {
      boot();
    } catch (error) {
      if (window.console) console.error("[thief] boot failed", error);
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
