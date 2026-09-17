// main.mjs — 装配入口：绑定事件、驱动固定步长主循环、协调 game / render / ui / storage / audio。

import {
  createState,
  startCharge,
  releaseCharge,
  stepFrame,
  drainEvents,
  charPos,
  platformPos,
  sniperRank,
  SNIPER_SHOTS,
} from "./engine.mjs";
import { LEVEL_COUNT } from "./levels.mjs";
import * as store from "./storage.mjs";
import * as i18n from "./i18n.mjs";
import { createAudio } from "./audio.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { createGame, startOdyssey, startEndless, startSniper, restart, press, release, tick, summarize } from "./game.mjs";

const STEP = 1 / 120;
const MAX_STEPS = 24;

let locale = i18n.loadLocale();
let t = i18n.strings(locale);
let data = store.load();
let mode = data.mode;
let currentLevel = Math.max(1, Math.min(LEVEL_COUNT, data.odyssey.unlocked));
let game = createGame();
let pendingResult = null;
let running = true;

const canvas = document.getElementById("stage-canvas");
const motionQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
const renderer = createRenderer(canvas, { reducedMotion: !!motionQuery?.matches });
const audio = createAudio();

const ui = createUI({
  start: () => {
    audio.unlock();
    audio.click();
    ui.closePanels();
  },
  openLevels: () => {
    audio.click();
    ui.renderLevels(data.odyssey, t, currentLevel, data.odyssey.stars);
    ui.openPanel("levels");
  },
  closeLevels: () => {
    audio.click();
    if (game.state && !game.state.ended && game.state.jumps > 0) ui.closePanels();
    else ui.openPanel("ready");
  },
  selectLevel: (id) => {
    audio.click();
    currentLevel = id;
    mode = "odyssey";
    data = store.setMode("odyssey");
    ui.setMode(mode);
    beginRun();
    ui.closePanels();
  },
  toggleHelp: () => {
    audio.click();
    if (ui.isPanelOpen("help")) ui.closePanels();
    else ui.openPanel("help");
  },
  closeHelp: () => {
    audio.click();
    ui.closePanels();
  },
  toggleSound: () => {
    data = store.setSound(!data.sound);
    audio.setEnabled(data.sound);
    ui.setSound(data.sound);
    if (data.sound) audio.click();
  },
  toggleLang: () => {
    const next = locale === "zh" ? "en" : "zh";
    i18n.saveLocale(next);
    try {
      window.location.reload();
    } catch {
      locale = next;
      t = i18n.strings(locale);
      repaintLocale();
    }
  },
  retry: () => {
    audio.click();
    beginRun();
    ui.closePanels();
  },
  next: () => {
    audio.click();
    // 以刚打完的关卡为基准 +1，不要基于 currentLevel 再自增（会被重复计数）
    currentLevel = Math.min(LEVEL_COUNT, (game.level || currentLevel) + 1);
    beginRun();
    ui.closePanels();
  },
  again: () => {
    audio.click();
    beginRun();
    ui.closePanels();
  },
  setMode: (next) => switchMode(next),
});

/* ---------------- 模式与开局 ---------------- */
function switchMode(next) {
  if (!next || next === mode) return;
  if (game.state && !game.state.ended && game.state.jumps > 0) {
    ui.showToast(t.toastModeLocked);
    audio.deny();
    return;
  }
  mode = next;
  data = store.setMode(mode);
  ui.setMode(mode);
  audio.click();
  beginRun();
  if (mode === "odyssey") ui.openPanel("ready");
  else ui.closePanels();
}

function beginRun() {
  if (mode === "odyssey") startOdyssey(game, currentLevel);
  else if (mode === "sniper") startSniper(game);
  else startEndless(game);
  pendingResult = null;
  renderer.setReducedMotion(!!motionQuery?.matches);
  syncHud(true);
}

/* ---------------- HUD ---------------- */
function bestValue() {
  if (mode === "endless") return data.endless.best;
  if (mode === "sniper") return data.sniper.best;
  return store.totalStars(data);
}

function syncHud(force = false) {
  const s = game.state;
  if (!s) return;
  ui.setScore(s.score);
  ui.setCombo(s.combo);
  ui.setGauge(s.phase === "charging" ? Math.min(1, s.charge / 1.8) : 0);

  const next = s.platforms[s.index + 1];
  if (next) ui.setNextPlatform(next.type);

  ui.setExtraByMode(mode, t, game, bestValue());
  ui.dom.labelBest.textContent = mode === "odyssey" ? t.hudStars : t.hudBest;
  if (force) ui.setBest(bestValue());
}

/* ---------------- 事件派发 ---------------- */
function landingToast(evt) {
  if (evt.kind === "perfect") return i18n.format(t.landPerfect, { n: evt.gain });
  if (evt.kind === "trampoline") return i18n.format(t.landTrampoline, { n: evt.gain });
  if (evt.kind === "wobble") return i18n.format(t.landWobble, { n: evt.gain });
  return i18n.format(t.landSafe, { n: evt.gain });
}

function handleEvents(events) {
  for (const evt of events) {
    renderer.onEvent(evt, game.state);
    switch (evt.type) {
      case "charge-start":
        audio.startCharge();
        break;
      case "launch":
        audio.stopCharge();
        audio.jump();
        break;
      case "landed":
        if (evt.kind === "perfect") audio.perfect(evt.combo);
        else if (evt.kind === "wobble") audio.wobble();
        else if (evt.kind === "trampoline") audio.trampoline();
        else audio.land();
        if (mode === "sniper") {
          ui.showToast(`${i18n.format(t.hudShot, { n: game.state.sniper.shots, total: SNIPER_SHOTS })} · +${evt.gain}`);
        } else {
          ui.showToast(landingToast(evt), 1200);
          if (evt.combo >= 3) setTimeout(() => ui.showToast(i18n.format(t.comboToast, { n: evt.combo }), 1400), 260);
        }
        break;
      case "vinyl":
        audio.vinyl();
        ui.showToast(i18n.format(t.vinylToast, { n: evt.gain }));
        break;
      case "trampoline":
        audio.trampoline();
        break;
      case "fall":
        audio.fall();
        ui.showToast(t.landMiss, 1600);
        break;
      case "recover":
        // 靶心试炼脱靶：本轮记 0，棋子被托举回台面
        audio.click();
        ui.showToast(t.sniperMiss, 1500);
        break;
      case "win":
        audio.win();
        queueResult(0.65);
        break;
      case "lose":
        queueResult(0.35);
        break;
      case "sniper-end":
        audio.win();
        queueResult(0.5);
        break;
      default:
        break;
    }
  }
}

function queueResult(delay) {
  if (pendingResult) return;
  pendingResult = { delay };
}

function commitResult() {
  const summary = summarize(game);
  if (!summary) return;
  let isNewBest = false;
  let rank = "";

  if (mode === "odyssey") {
    const rec = store.recordLevel(data, game.level, summary.stars);
    data = rec.data;
    isNewBest = rec.improved && summary.stars > 0;
    // 不在此处推进 currentLevel：结算面板同时提供「再挑战一次」（重玩本关）与「下一关」（+1）。
    // 提前推进会让两个按钮一起错位 —— 点再挑战进了下一关，点下一关直接跳两关（第 2 关被跳过）。
  } else if (mode === "endless") {
    const rec = store.recordEndless(data, summary);
    data = rec.data;
    isNewBest = rec.isNewBest;
  } else if (mode === "sniper") {
    rank = sniperRank(summary.total);
    const rec = store.recordSniper(data, summary.total, rank);
    data = rec.data;
    isNewBest = rec.isNewBest;
  }

  ui.showResult(summary, t, {
    mode,
    won: summary.won,
    isNewBest,
    canNext: game.level < LEVEL_COUNT,
    rank,
  });
}

/* ---------------- 输入 ---------------- */
function canPlay() {
  return running && game.state && !game.state.ended && !ui.anyPanelOpen();
}

function onPress() {
  if (!canPlay()) return;
  audio.unlock();
  if (press(game)) handleEvents(drainEvents(game.state));
}

function onRelease() {
  if (!game.state) return;
  if (game.state.phase !== "charging") return;
  if (release(game)) handleEvents(drainEvents(game.state));
}

const arena = document.getElementById("arena");
arena.addEventListener("pointerdown", (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  onPress();
});
window.addEventListener("pointerup", () => onRelease());
window.addEventListener("pointercancel", () => onRelease());

window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" && e.key !== " ") return;
  if (e.target && /^(INPUT|TEXTAREA|BUTTON|A)$/.test(e.target.tagName)) return;
  e.preventDefault();
  if (e.repeat) return;
  onPress();
});
window.addEventListener("keyup", (e) => {
  if (e.code !== "Space" && e.key !== " ") return;
  e.preventDefault();
  onRelease();
});

window.addEventListener("blur", () => onRelease());

/* ---------------- 主循环 ---------------- */
let last = 0;
let acc = 0;

function frame(now) {
  if (!last) last = now;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (game.state) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      const events = tick(game, STEP);
      if (events.length) handleEvents(events);
      acc -= STEP;
      steps += 1;
    }
    if (steps >= MAX_STEPS) acc = 0;

    if (game.state.phase === "charging") audio.updateCharge(Math.min(1, game.state.charge / 1.5));

    if (pendingResult) {
      pendingResult.delay -= dt;
      if (pendingResult.delay <= 0) {
        pendingResult = null;
        commitResult();
      }
    }

    syncHud();
  }

  renderer.draw(game.state || createState({ mode: "endless", seed: 1 }), dt);
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
  if (ui.isPanelOpen("levels")) ui.renderLevels(data.odyssey, t, currentLevel, data.odyssey.stars);
}

repaintLocale();
audio.setEnabled(data.sound);
beginRun();
ui.openPanel("ready");
resize();
requestAnimationFrame(frame);

// 供无头验收断言读取（只读快照，不开放任何写操作）
window.__jump = {
  get state() {
    return game.state;
  },
  get mode() {
    return mode;
  },
  get level() {
    return currentLevel;
  },
  press: onPress,
  release: onRelease,
  charge(value) {
    if (!game.state || game.state.phase !== "charging") return false;
    game.state.charge = Math.max(0, Math.min(1.8, value));
    return true;
  },
  charPos: () => (game.state ? charPos(game.state) : null),
  platformPos: (i) => (game.state ? platformPos(game.state.platforms[i], game.state.time) : null),
  camera: () => renderer.camera,
  ready: true,
};
