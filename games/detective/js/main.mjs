// 装配入口：把纯逻辑控制器、DOM 层、存档、音效接起来，并处理全局快捷键与失焦暂停。

import { createGame, isUnlocked } from "./game.mjs";
import { createUI } from "./ui.mjs";
import * as storage from "./storage.mjs";
import * as audio from "./audio.mjs";
import { translate } from "./i18n.mjs";

const META_KEY = "doin.meta.v1";

let locale = storage.loadLocale();
let soundOn = storage.loadSound();
let autoPaused = false;
let lastFrame = 0;

const game = createGame({
  loadProgress: storage.loadProgress,
  recordCase: (progress, id, record) => {
    const next = storage.recordCase(progress, id, record);
    storage.saveProgress(next);
    return next;
  },
  onChange: (snapshot) => {
    ui?.sync(snapshot);
    syncPauseLayer(snapshot);
  },
  onWin: (payload) => {
    play(audio.fanfare);
    ui?.showResult(payload);
    ui?.sync(game.snapshotFn());
    reportSession(payload);
  },
  onMistake: (payload) => {
    play(audio.jolt);
    ui?.toast(flawMessage(payload.flaws?.[0], payload.mistakes), "bad");
  },
  onEvent: (payload) => {
    broadcast(payload);
  },
});

const actions = {
  stamp: (who, kind) => {
    const before = game.snapshot.stamps[who];
    game.stamp(who, kind);
    const after = game.snapshot.stamps[who];
    if (before !== after) play(audio.stamp);
    else play(audio.click);
  },
  pickWeapon: (id) => {
    game.setWeapon(id);
    play(audio.clip);
  },
  pickClue: (id) => {
    game.setClue(id);
    play(audio.clip);
  },
  seal: () => {
    const result = game.seal();
    if (result?.blocked) ui?.toast(sealBlockedReason(), "info");
    else if (result?.ok === false && !result.flaws) play(audio.click);
  },
  reset: () => {
    game.restart();
    play(audio.paper);
    ui?.toast(translate(locale, "toastReset"), "info");
  },
  nextCase: () => {
    const moved = game.next();
    if (!moved) ui?.toast(translate(locale, "toastLocked"), "info");
  },
  resume: () => {
    autoPaused = false;
    game.resume();
    ui?.closePause();
  },
  pauseToggle: () => {
    autoPaused = false;
    game.togglePause();
    syncPauseLayer(game.snapshotFn());
  },
  openCase: (id) => {
    if (!isUnlocked(game.progress, id)) {
      ui?.toast(translate(locale, "toastLocked"), "info");
      return;
    }
    game.start(id);
    play(audio.paper);
  },
  toggleLocale: () => {
    locale = locale === "en" ? "zh" : "en";
    storage.saveLocale(locale);
    ui?.setLocale(locale);
  },
  toggleSound: () => {
    soundOn = !soundOn;
    storage.saveSound(soundOn);
    try {
      audio.setEnabled(soundOn);
    } catch {
      // 音效不可用时保持静默，不阻断玩法。
    }
    ui?.setSound(soundOn);
    if (soundOn) play(audio.click);
  },
  onInspect: () => play(audio.clip),
  onInsight: () => play(audio.jolt),
  onPickStamp: () => play(audio.clip),
  onDrawer: (open) => {
    if (open) play(audio.paper);
  },
};

const ui = createUI({ game, actions, locale });

function play(fn, ...args) {
  try {
    if (typeof fn === "function") fn(...args);
  } catch {
    // 音效永远不许打断办案。
  }
}

function syncPauseLayer(snapshot) {
  if (!ui) return;
  if (snapshot.paused) ui.openPause();
  else ui.closePause();
}

function sealBlockedReason() {
  const snapshot = game.snapshot;
  if (!snapshot.guilty) return translate(locale, "lockKiller");
  const remaining = snapshot.total - snapshot.cleared - 1;
  if (remaining > 0) return translate(locale, "lockCleared", { n: remaining });
  if (!snapshot.weapon) return translate(locale, "lockWeapon");
  if (!snapshot.clue) return translate(locale, "lockClue");
  return translate(locale, "seal");
}

function flawMessage(flaw, mistakes) {
  if (!flaw) return translate(locale, "wrongTitle");
  const suffix = `（${translate(locale, "wrongMistake", { n: mistakes ?? 1 })}）`;
  if (flaw.dim === "killer") {
    const who = game.snapshot.guilty ?? "";
    const name = who ? translate(locale, `role_${who}`) : "";
    if (flaw.why) {
      return translate(locale, "wrongKiller", { name, evidence: translate(locale, `ev_${flaw.why}`) });
    }
    return translate(locale, "wrongKillerBare", { name }) + suffix;
  }
  if (flaw.dim === "weapon") {
    return translate(locale, flaw.code === "access" ? "wrongWeaponAccess" : "wrongWeapon") + suffix;
  }
  return translate(locale, "wrongClue") + suffix;
}

function broadcast(payload) {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    meta.recentlyPlayed = [payload.slug, ...(meta.recentlyPlayed || []).filter((slug) => slug !== payload.slug)].slice(0, 8);
    meta.totalStars = (meta.totalStars || 0) + (payload.stars || 0);
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // 存储受限时静默跳过。
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload }, "*");
    }
  } catch {
    // 跨域父级不可达时忽略。
  }
}

function reportSession(payload) {
  broadcast({
    slug: "detective",
    outcome: "WON",
    score: Math.max(0, 30000 - Math.round(payload.timeMs / 10) - payload.mistakes * 800),
    stars: payload.stars,
    timestamp: Date.now(),
    case: payload.caseId,
  });
}

// ---------------------------------------------------------------- 主循环

function frame(now) {
  const dt = lastFrame ? now - lastFrame : 16;
  lastFrame = now;
  game.tick(dt);
  ui?.updateClock(game.snapshot.elapsed);
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- 全局事件

function bindGlobal() {
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
    if (typing) return;
    const key = event.key;
    if (key === "p" || key === "P" || key === "Escape" || key === " " || key === "Spacebar") {
      const modal = ui?.helpOpen || ui?.resultOpen;
      if (modal) {
        if (key === "Escape" || key === " ") {
          event.preventDefault();
          ui.closeHelp();
          ui.hideResult();
        }
        return;
      }
      if (ui?.drawerOpen && (key === "Escape" || key === " ")) {
        event.preventDefault();
        ui.closeDrawer();
        return;
      }
      event.preventDefault();
      actions.pauseToggle();
      return;
    }
    if (key === "r" || key === "R") {
      actions.reset();
      return;
    }
    if (key === "c" || key === "C") {
      if (ui?.drawerOpen) ui.closeDrawer();
      else ui.openDrawer();
    }
  });

  document.addEventListener(
    "pointerdown",
    () => {
      play(audio.unlock);
      if (autoPaused && !document.hidden) {
        autoPaused = false;
        game.resume();
      }
    },
    { capture: true },
  );

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (!game.paused) {
        autoPaused = true;
        game.pause();
      }
    } else {
      lastFrame = 0;
    }
  });

  window.addEventListener("blur", () => {
    if (!game.paused) {
      autoPaused = true;
      game.pause();
    }
  });

  window.addEventListener("focus", () => {
    if (autoPaused && !document.hidden) {
      autoPaused = false;
      game.resume();
    }
  });
}

// ---------------------------------------------------------------- 启动

try {
  audio.setEnabled(soundOn);
} catch {
  // 忽略。
}
ui.setSound(soundOn);
ui.setLocale(locale);
ui.setHeld("clear");
ui.sync(game.snapshotFn());
bindGlobal();
if (typeof requestAnimationFrame === "function") requestAnimationFrame(frame);

window.__detective = {
  get game() {
    return game;
  },
  get ui() {
    return ui;
  },
  get snapshot() {
    return game.snapshot;
  },
  get locale() {
    return locale;
  },
  setLocale: (next) => {
    locale = next;
    storage.saveLocale(next);
    ui.setLocale(next);
  },
  actions,
  storage,
};
