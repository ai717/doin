// main.mjs —— 装配入口：绑定事件、协调全局

import { createGame, REASON } from "./game.mjs";
import { createUi } from "./ui.mjs";
import * as store from "./storage.mjs";
import * as i18n from "./i18n.mjs";
import * as audio from "./audio.mjs";
import { LEVEL_COUNT, levelById } from "./levels.mjs";

const game = createGame();
let save = store.load();
let locale = i18n.loadLocale();
let dialText = "";
let started = false;

const ui = createUi({
  onDigit: (digit) => pushDigit(digit),
  onDel: () => {
    dialText = dialText.slice(0, -1);
    paintDial();
  },
  onFire: () => fire(),
  onGear: (kind) => useGear(kind),
  onSound: () => toggleSound(),
  onLang: () => toggleLang(),
  onLevels: () => openLevels(),
  onDive: () => startLevel(save.last ?? 1),
  onLevelPick: (id) => startLevel(id),
  onNext: () => startLevel(Math.min(LEVEL_COUNT, (currentLevelId ?? 1) + 1)),
  onRetry: () => startLevel(currentLevelId ?? 1),
});

let currentLevelId = null;

function str() {
  return i18n.strings(locale);
}

function paintDial() {
  ui.setDial(dialText);
}

function maxDigits() {
  const view = game.view();
  return view ? String(view.max).length : 3;
}

function pushDigit(digit) {
  if (dialText.length >= maxDigits()) return;
  if (dialText === "0") dialText = "";
  dialText += digit;
  paintDial();
  audio.unlock();
  audio.playUi();
}

function nudge(delta) {
  const view = game.view();
  if (!view) return;
  const base = dialText ? Number(dialText) : Math.round((view.belief.lo + view.belief.hi) / 2);
  const next = Math.min(view.max, Math.max(view.min, base + delta));
  dialText = String(next);
  paintDial();
}

function fire() {
  const view = game.view();
  if (!view || view.status !== "playing") return;
  if (!dialText) {
    ui.toast(str().toastEmpty);
    audio.playReject();
    return;
  }
  const value = Number(dialText);
  const res = game.fire(value);
  dialText = "";
  paintDial();
  if (!res.ok) {
    audio.playReject();
    if (res.reason === REASON.OUT) ui.toast(i18n.format(str().toastOut, { n: value }));
    else if (res.reason === REASON.REPEAT) ui.toast(i18n.format(str().toastRepeat, { n: value }));
    else if (res.reason === REASON.NO_ROOM) ui.toast(str().toastNoRoom);
    else ui.toast(str().toastNoRoom);
    return;
  }
  audio.unlock();
  audio.playCast();
  const entry = res.entry;
  setTimeout(() => {
    if (entry.silent) ui.toast(str().toastFog);
    audio.playEcho(entry.dir, entry.temp);
  }, 120);
  ui.flashBand(entry.hit ? "hit" : "echo");
  render();
}

function useGear(kind) {
  const view = game.view();
  if (!view || view.status !== "playing") return;
  const res = game.gear(kind);
  if (!res.ok) {
    audio.playReject();
    if (res.reason === REASON.NO_TOOL) ui.toast(str().toastNoTool);
    else if (res.reason === REASON.NO_ROOM) ui.toast(str().toastNoRoom);
    else if (res.reason === REASON.NO_RECALL) ui.toast(str().toastNoRecall);
    return;
  }
  audio.unlock();
  audio.playTool(kind);
  render();
}

function render() {
  const view = game.view();
  if (!view) return;
  const rec = store.levelRecord(save, view.level.id);
  ui.renderAll(view, { best: rec.fewest || 0 });
}

function startLevel(id) {
  const lvl = levelById(id);
  if (!lvl) return;
  currentLevelId = id;
  dialText = "";
  paintDial();
  game.start(id);
  save = store.setLast(save, id);
  started = true;
  ui.hideAllOverlays();
  render();
  audio.unlock();
}

function toggleSound() {
  const muted = !save.muted;
  save = store.setMuted(save, muted);
  audio.setMuted(muted);
  ui.setSoundIcon(muted);
  if (!muted) audio.playUi();
}

function toggleLang() {
  locale = locale === "zh" ? "en" : "zh";
  i18n.saveLocale(locale);
  location.reload();
}

function openLevels() {
  ui.buildLevels(save, (id) => store.isUnlocked(save, id));
  ui.showLevels();
}

game.on((type, payload) => {
  if (type === "win" || type === "lose") {
    const result = payload.result ?? game.result();
    if (result?.won) {
      const rec = store.recordLevel(save, result.levelId, { stars: result.stars, used: result.used, cleared: true });
      save = rec.data;
      audio.playHit();
    } else {
      audio.playLose();
    }
    setTimeout(() => ui.showResult(result ?? game.result(), game.view()), result?.won ? 620 : 420);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;
  if (/^[0-9]$/.test(key)) {
    pushDigit(key);
    event.preventDefault();
    return;
  }
  if (key === "Backspace") {
    dialText = dialText.slice(0, -1);
    paintDial();
    event.preventDefault();
    return;
  }
  if (key === "Enter") {
    fire();
    event.preventDefault();
    return;
  }
  if (key === "ArrowLeft") {
    nudge(-1);
    event.preventDefault();
  } else if (key === "ArrowRight") {
    nudge(1);
    event.preventDefault();
  } else if (key === "ArrowUp") {
    nudge(10);
    event.preventDefault();
  } else if (key === "ArrowDown") {
    nudge(-10);
    event.preventDefault();
  } else if (key === "r" || key === "R") {
    if (currentLevelId) startLevel(currentLevelId);
  } else if (key === "Escape") {
    ui.hideAllOverlays();
    if (started) render();
  }
});

function boot() {
  ui.applyStrings(locale, str(), { docLang: i18n.htmlLang(locale) });
  audio.setMuted(save.muted);
  ui.setSoundIcon(save.muted);
  const view = game.view();
  if (!view) {
    // 先装配一关的画面，开场浮层盖在上面
    game.start(save.last ?? 1);
    started = false;
    render();
  }
  ui.showReady(save);
}

// 只读诊断出口：验收脚本读真值用（含隐藏目标），UI 不展示
window.__guess = {
  view: () => game.view(),
  diagnose: () => game.diagnose(),
  start: (id, seed) => game.start(id, seed),
  fire: (value) => game.fire(value),
  dial: () => dialText,
  save: () => store.load(),
};

boot();
