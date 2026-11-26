// main.mjs — 装配入口：事件绑定、固定步长主循环、HUD 与结算编排。
// 语言切换只做原地热更新，绝不 reload，也绝不重置当前对局。

import { radarScan, goalProgress, setInput, releaseAll } from "./engine.mjs";
import { LEVEL_COUNT, MODES } from "./levels.mjs";
import * as store from "./storage.mjs";
import * as i18n from "./i18n.mjs";
import { createAudio } from "./audio.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { createGame, startCampaign, startMode, tick } from "./game.mjs";

const STEP = 1 / 120;
const MAX_STEPS = 24;

let locale = i18n.loadLocale();
let t = i18n.strings(locale);
let data = store.load();
let mode = MODES.includes(data.mode) ? data.mode : "campaign";
let currentLevel = Math.max(1, Math.min(LEVEL_COUNT, data.lastLevel || 1));
let game = createGame();
let pendingResult = null;
let lastHudSync = 0;
let levelsFromPause = false;

const canvas = document.getElementById("stage-canvas");
const motionQuery =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
const renderer = createRenderer(canvas, { reducedMotion: !!motionQuery?.matches });
const audio = createAudio();

const ui = createUI({
  openLevels: () => {
    audio.unlock();
    audio.click();
    levelsFromPause = false;
    ui.renderLevels(data.campaign, t, currentLevel);
    ui.openPanel("levels");
  },
  closeLevels: () => closeLevelsPanel(),
  toggleHelp: () => {
    audio.click();
    if (ui.isPanelOpen("help")) ui.closePanels();
    else ui.openPanel("help");
  },
  closeHelp: () => {
    audio.click();
    if (game.state && game.state.ended && game.result) ui.refreshResult();
    else ui.closePanels();
  },
  toggleSound: () => {
    data = store.setSound(!data.sound);
    audio.setEnabled(data.sound);
    ui.setSound(data.sound);
    if (data.sound) audio.click();
  },
  toggleLang: () => {
    locale = locale === "zh" ? "en" : "zh";
    i18n.saveLocale(locale);
    t = i18n.strings(locale);
    repaintLocale();
    audio.click();
  },
  togglePause: () => togglePause(),
  resume: () => resumeGame(),
  pauseRestart: () => {
    audio.click();
    beginRun();
    ui.closePanels();
  },
  pauseLevels: () => {
    audio.click();
    levelsFromPause = true;
    ui.renderLevels(data.campaign, t, currentLevel);
    ui.openPanel("levels");
  },
  restart: () => {
    audio.click();
    beginRun();
    ui.closePanels();
  },
  retry: () => {
    audio.click();
    beginRun();
    ui.closePanels();
  },
  next: () => {
    audio.click();
    if (game.mode !== "campaign") {
      beginRun();
      ui.closePanels();
      return;
    }
    currentLevel = Math.min(LEVEL_COUNT, (game.level || currentLevel) + 1);
    data = store.setMode("campaign");
    data = store.setLastLevel(currentLevel);
    beginRun();
    ui.closePanels();
  },
  again: () => {
    audio.click();
    beginRun();
    ui.closePanels();
  },
  setMode: (next) => switchMode(next),
  hold: (dir, on) => {
    if (!canPlay()) return;
    audio.unlock();
    if (dir === "left") setInput(game.state, { left: on });
    else if (dir === "right") setInput(game.state, { right: on });
    else if (dir === "dive") setInput(game.state, { dive: on });
  },
});

/* ---------------- 暂停 ---------------- */
function pauseGame() {
  if (!game.state || game.state.ended || ui.anyPanelOpen()) return;
  releaseAll(game.state);
  audio.wind(false);
  audio.click();
  ui.openPanel("pause");
}

function resumeGame() {
  audio.click();
  ui.closePanels();
}

function togglePause() {
  if (ui.isPanelOpen("pause")) resumeGame();
  else pauseGame();
}

function closeLevelsPanel() {
  audio.click();
  if (levelsFromPause) {
    levelsFromPause = false;
    ui.openPanel("pause");
    return;
  }
  if (game.state && game.state.ended && game.result) {
    ui.refreshResult();
    return;
  }
  ui.closePanels();
}

/* ---------------- 模式与开局 ---------------- */
function switchMode(next) {
  if (!MODES.includes(next) || next === mode) return;
  mode = next;
  data = store.setMode(mode);
  ui.setMode(mode);
  audio.click();
  beginRun();
  ui.closePanels();
}

function beginRun() {
  pendingResult = null;
  levelsFromPause = false;
  if (mode === "campaign") startCampaign(game, currentLevel);
  else if (mode === "classic") startMode(game, "classic");
  else startMode(game, "endless");
  game.mode = mode === "campaign" ? "campaign" : mode;
  ui.hideResult();
  renderer.setReducedMotion(!!motionQuery?.matches);
  syncHud(true);
  ui.dom.valBest.textContent = bestText();
}

function bestText() {
  if (mode === "campaign") return `${store.totalStars(data)} / ${LEVEL_COUNT * 3}`;
  if (mode === "classic") {
    return data.classic.bestDepth > 0 ? String(data.classic.bestDepth) : "—";
  }
  return data.endless.bestDepth > 0 ? String(data.endless.bestDepth) : "—";
}

function syncHud(force = false) {
  const state = game.state;
  if (!state) return;
  ui.setDepth(state.depth);
  ui.setHp(state.player.hp, state.player.maxHp);
  ui.setSpeed(Math.abs(state.player.vy));

  if (mode === "campaign") {
    ui.setGoal(goalProgress(state), i18n.format(t.hudGoalValue, { n: state.depth, total: state.config.goalFloors }), "hudGoal");
  } else if (mode === "classic") {
    ui.setGoal(
      state.config.goalFloors > 0 ? state.depth / state.config.goalFloors : 0,
      i18n.format(t.hudGoalValue, { n: state.depth, total: state.config.goalFloors }),
      "hudClassicGoal"
    );
  } else {
    const best = Math.max(state.depth, data.endless.bestDepth);
    ui.setGoal(state.depth / Math.max(20, best), String(best), "hudBestDepth");
  }

  if (force) ui.setBest(bestText());

  const bestLabel = mode === "campaign" ? t.hudStars : mode === "classic" ? t.hudBest : t.hudBestDepth;
  if (ui.dom.labelBest.textContent !== bestLabel) ui.dom.labelBest.textContent = bestLabel;

  const now = performance.now();
  if (force || now - lastHudSync > 120) {
    lastHudSync = now;
    ui.setRadar(radarScan(state));
  }
}

/* ---------------- 事件派发 ---------------- */
function handleEvent(event) {
  const state = game.state;
  renderer.onEvent(event, state);
  switch (event.type) {
    case "land":
      if (event.platformType !== "spike") audio.land();
      audio.wind(false);
      break;
    case "heal":
      audio.heal();
      ui.showToast(t.toastHeal, 900);
      break;
    case "spike":
      audio.spike();
      audio.wind(false);
      ui.showToast(t.toastSpike, 1200);
      break;
    case "spring":
      audio.spring();
      ui.showToast(t.toastSpring, 1100);
      break;
    case "crumble":
      audio.crumble();
      ui.showToast(t.toastCrumble, 1000);
      break;
    case "collapse":
      audio.crumble();
      break;
    case "conveyor":
      audio.conveyor();
      break;
    case "ceiling":
      audio.ceiling();
      ui.showToast(t.toastCeiling, 1000);
      break;
    case "floor":
      audio.floorTick();
      if (event.floor > 0 && event.floor % 10 === 0) {
        ui.showToast(i18n.format(t.toastFloor, { n: event.floor }), 900);
      }
      break;
    case "dive-on":
      audio.wind(true);
      break;
    case "dive-off":
      audio.wind(false);
      break;
    case "overheat":
      audio.ceiling();
      ui.showToast(t.toastHeat, 1800);
      break;
    case "win":
      audio.wind(false);
      audio.win();
      ui.showToast(t.toastGoal, 1500);
      queueResult(0.7);
      break;
    case "lose":
      audio.wind(false);
      audio.lose();
      if (event.reason === "void") ui.showToast(t.toastVoid, 1500);
      queueResult(0.55);
      break;
    default:
      break;
  }
}

function queueResult(delay) {
  if (pendingResult) return;
  pendingResult = { delay };
}

function commitResult() {
  const summary = game.result;
  if (!summary) return;
  let isNewBest = false;

  if (summary.mode === "campaign") {
    const rec = store.recordCampaign(data, game.level, summary);
    data = rec.data;
    isNewBest = rec.improved;
  } else if (summary.mode === "classic") {
    const rec = store.recordClassic(data, summary);
    data = rec.data;
    isNewBest = rec.isNewBest;
  } else {
    const rec = store.recordEndless(data, summary);
    data = rec.data;
    isNewBest = rec.isNewBest;
  }

  ui.setBest(bestText());
  ui.showResult(summary, t, {
    mode: summary.mode,
    won: summary.won,
    isNewBest,
    canNext: summary.mode === "campaign" && game.level < LEVEL_COUNT,
  });
}

/* ---------------- 输入 ---------------- */
function canPlay() {
  return !!game.state && !game.state.ended && !ui.anyPanelOpen();
}

function press(patch) {
  if (!canPlay()) return;
  audio.unlock();
  setInput(game.state, patch);
}

const KEYS = {
  ArrowLeft: { left: true },
  KeyA: { left: true },
  ArrowRight: { right: true },
  KeyD: { right: true },
  ArrowDown: { dive: true },
  KeyS: { dive: true },
};

const RELEASE_KEYS = {
  ArrowLeft: { left: false },
  KeyA: { left: false },
  ArrowRight: { right: false },
  KeyD: { right: false },
  ArrowDown: { dive: false },
  KeyS: { dive: false },
};

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

  if (event.code === "KeyP" || event.key === "Escape") {
    event.preventDefault();
    if (event.repeat) return;
    if (ui.isPanelOpen("pause")) {
      resumeGame();
      return;
    }
    if (event.key === "Escape" && ui.isPanelOpen("levels")) {
      closeLevelsPanel();
      return;
    }
    if (event.key === "Escape" && ui.isPanelOpen("help")) {
      audio.click();
      ui.closePanels();
      return;
    }
    if (!game.state || game.state.ended || ui.anyPanelOpen()) return;
    pauseGame();
    return;
  }

  const action = KEYS[event.code];
  if (!action) return;
  event.preventDefault();
  if (event.repeat) return;
  press(action);
});

window.addEventListener("keyup", (event) => {
  const action = RELEASE_KEYS[event.code];
  if (!action) return;
  event.preventDefault();
  if (!game.state) return;
  setInput(game.state, action);
});

/* ---------------- 指针 / 触屏 ---------------- */
let pointerDown = false;
function pointerDirection(event) {
  if (!canPlay()) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
  const p = game.state;
  if (ratio < 0.5) {
    setInput(p, { left: true, right: false });
  } else {
    setInput(p, { right: true, left: false });
  }
}

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  audio.unlock();
  pointerDown = true;
  pointerDirection(event);
});
canvas.addEventListener("pointermove", (event) => {
  if (!pointerDown) return;
  event.preventDefault();
  pointerDirection(event);
});
window.addEventListener("pointerup", () => {
  if (!pointerDown) return;
  pointerDown = false;
  if (!game.state) return;
  setInput(game.state, { left: false, right: false });
});
window.addEventListener("pointercancel", () => {
  pointerDown = false;
  if (!game.state) return;
  setInput(game.state, { left: false, right: false });
});

window.addEventListener("blur", () => {
  pointerDown = false;
  if (game.state) releaseAll(game.state);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  if (game.state && !game.state.ended && !ui.anyPanelOpen()) pauseGame();
});

/* ---------------- 主循环 ---------------- */
let last = 0;
let acc = 0;

function frame(now) {
  if (!last) last = now;
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;

  if (game.state && !ui.anyPanelOpen()) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      const events = tick(game, STEP);
      for (const event of events) handleEvent(event);
      acc -= STEP;
      steps += 1;
    }
    if (steps >= MAX_STEPS) acc = 0;

    if (pendingResult) {
      pendingResult.delay -= dt;
      if (pendingResult.delay <= 0) {
        pendingResult = null;
        commitResult();
      }
    }

    syncHud();
  } else {
    acc = 0;
  }

  renderer.draw(game.state, dt);
  requestAnimationFrame(frame);
}

/* ---------------- 尺寸与降级 ---------------- */
function resize() {
  renderer.resize();
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);

if (motionQuery) {
  const onChange = () => renderer.setReducedMotion(motionQuery.matches);
  if (motionQuery.addEventListener) motionQuery.addEventListener("change", onChange);
  else if (motionQuery.addListener) motionQuery.addListener(onChange);
}

/* ---------------- 启动 ---------------- */
function repaintLocale() {
  document.documentElement.lang = i18n.htmlLang(locale);
  ui.applyLocale(t);
  ui.setMode(mode);
  ui.setSound(data.sound);
  syncHud(true);
  if (ui.isPanelOpen("levels")) ui.renderLevels(data.campaign, t, currentLevel);
  if (ui.isPanelOpen("result")) ui.refreshResult();
}

repaintLocale();
audio.setEnabled(data.sound);
ui.setMode(mode);
ui.setSound(data.sound);
beginRun();
resize();
requestAnimationFrame(frame);

// 只读验收出口：供无头冒烟读取状态，不开放写操作。
window.__shaft = {
  get state() {
    return game.state;
  },
  get mode() {
    return mode;
  },
  get level() {
    return currentLevel;
  },
  get result() {
    return game.result;
  },
  start(modeName = "campaign", level = 1) {
    if (MODES.includes(modeName)) mode = modeName;
    if (modeName === "campaign") currentLevel = Math.max(1, Math.min(LEVEL_COUNT, level));
    beginRun();
    return game.state;
  },
  input: (patch) => setInput(game.state, patch),
  release: () => releaseAll(game.state),
  radar: () => radarScan(game.state),
  renderer,
};
