// main.mjs — 装配入口：绑定事件、固定步长主循环、协调 game / render / ui / storage / audio。

import { isTerminal, playerOf } from "./engine.mjs";
import {
  createGame,
  dispatch,
  nextRaceId,
  restartRace,
  selectBike,
  selectMode,
  selectRace,
  startRace,
  tick,
  toGarage,
} from "./game.mjs";
import * as store from "./storage.mjs";
import * as i18n from "./i18n.mjs";
import { createAudio } from "./audio.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";


const STEP = 1 / 60;
const MAX_STEPS = 8;

let locale = i18n.loadLocale();
let t = i18n.strings(locale);
let data = store.load();
const game = createGame();
game.bikeId = data.progress.selectedBike;
game.cruise = data.prefs.cruise;

const canvas = document.getElementById("stage-canvas");
const motionQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
const renderer = createRenderer(canvas, { reducedMotion: !!motionQuery?.matches });
const audio = createAudio();
audio.setEnabled(!data.prefs.muted);

const keys = { accel: false, brake: false, left: false, right: false };

function steerDir() {
  if (keys.left && !keys.right) return -1;
  if (keys.right && !keys.left) return 1;
  return 0;
}

function pushInput() {
  if (!game.race) return;
  dispatch(game, {
    type: "set-input",
    accel: keys.accel,
    brake: keys.brake,
    steer: steerDir(),
    cruise: data.prefs.cruise,
  });
}

const ui = createUI({
  toggleSound() {
    data = store.setMuted(data, !data.prefs.muted);
    audio.setEnabled(!data.prefs.muted);
    ui.setSound(!data.prefs.muted);
    if (!data.prefs.muted) audio.click();
  },
  toggleLang() {
    const next = locale === "zh" ? "en" : "zh";
    i18n.saveLocale(next);
    location.reload();
  },
  toggleHelp() {
    audio.click();
    if (ui.isHelpOpen()) ui.closeHelp();
    else ui.openHelp();
  },
  closeHelp() {
    audio.click();
    ui.closeHelp();
  },
  setMode(mode) {
    if (game.scene === "race" && game.race && !isTerminal(game.race)) {
      ui.toast(t.toastLocked);
      return;
    }
    audio.click();
    selectMode(game, mode);
    ui.setMode(game.mode);
    ui.renderGarage(data, game);
    ui.openGarage();
  },
  pickBike(id, owned) {
    audio.unlock();
    audio.click();
    if (owned) {
      selectBike(game, id);
      data = store.selectBike(data, id);
      ui.renderGarage(data, game);
      return;
    }
    const bought = store.buyBike(data, id);
    data = bought.state;
    if (!bought.ok) {
      ui.toast(t.toastPoor);
      return;
    }
    selectBike(game, id);
    ui.toast(t.toastBought);
    ui.renderGarage(data, game);
  },
  pickRace(id, unlocked) {
    audio.unlock();
    audio.click();
    if (!unlocked) {
      ui.toast(t.toastLocked);
      return;
    }
    selectRace(game, id);
    startRace(game);
    lastBeep = 4;
    ui.closeGarage();
    ui.closeResult();
    ui.closePause();
    audio.countdown(3);
  },
  start() {
    audio.unlock();
    audio.click();
    const unlocked =
      game.mode === "brawl"
        ? store.isBrawlUnlocked(data, game.raceId)
        : game.mode === "getaway"
          ? store.isGetawayUnlocked(data, game.raceId)
          : store.isLeagueUnlocked(data, game.raceId);
    if (!unlocked) {
      ui.toast(t.toastLocked);
      return;
    }
    startRace(game);
    lastBeep = 4;
    ui.closeGarage();
    ui.closeResult();
    ui.closePause();
    audio.countdown(3);
  },
  resume() {
    audio.click();
    dispatch(game, { type: "resume" });
    ui.closePause();
  },
  retry() {
    audio.click();
    restartRace(game);
    ui.closePause();
    ui.closeResult();
    ui.closeGarage();
  },
  next() {
    audio.click();
    const nid = nextRaceId(game);
    if (nid == null) {
      toGarage(game);
      ui.openGarage();
      ui.closeResult();
      ui.renderGarage(data, game);
      return;
    }
    const unlocked =
      game.mode === "brawl"
        ? store.isBrawlUnlocked(data, nid)
        : game.mode === "getaway"
          ? store.isGetawayUnlocked(data, nid)
          : store.isLeagueUnlocked(data, nid);
    if (!unlocked) {
      toGarage(game);
      ui.openGarage();
      ui.closeResult();
      ui.renderGarage(data, game);
      return;
    }
    selectRace(game, nid);
    startRace(game);
    ui.closeResult();
  },
  garage() {
    audio.click();
    toGarage(game);
    ui.closePause();
    ui.closeResult();
    ui.openGarage();
    ui.renderGarage(data, game);
  },
  setCruise(on) {
    data = store.setCruise(data, on);
    game.cruise = on;
    pushInput();
  },
  hold(which, down) {
    audio.unlock();
    if (which === "accel") keys.accel = down;
    if (which === "brake") keys.brake = down;
    if (which === "left") keys.left = down;
    if (which === "right") keys.right = down;
    pushInput();
  },
  punch() {
    audio.unlock();
    dispatch(game, { type: "punch" });
  },
  kick() {
    audio.unlock();
    dispatch(game, { type: "kick" });
  },
  pause() {
    if (!game.race || isTerminal(game.race)) return;
    dispatch(game, { type: "toggle-pause" });
    if (game.race.paused) ui.openPause();
    else ui.closePause();
  },
});

ui.applyLocale(t);
ui.setSound(!data.prefs.muted);
ui.setCruise(data.prefs.cruise);
ui.setMode(game.mode);
ui.renderGarage(data, game);
document.documentElement.lang = i18n.htmlLang(locale);

function onKey(ev, down) {
  const code = ev.code;
  const map = {
    KeyW: "accel",
    ArrowUp: "accel",
    KeyS: "brake",
    ArrowDown: "brake",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
  };
  if (map[code]) {
    ev.preventDefault();
    keys[map[code]] = down;
    pushInput();
  }
  if (!down) return;
  if (code === "Space" || code === "KeyJ") {
    ev.preventDefault();
    dispatch(game, { type: "punch" });
  } else if (code === "KeyK") {
    ev.preventDefault();
    dispatch(game, { type: "kick" });
  } else if (code === "KeyP") {
    ev.preventDefault();
    if (game.race && !isTerminal(game.race)) {
      dispatch(game, { type: "toggle-pause" });
      if (game.race.paused) ui.openPause();
      else ui.closePause();
    }
  } else if (code === "KeyR") {
    if (game.scene === "race") restartRace(game);
  }
}

window.addEventListener("keydown", (ev) => onKey(ev, true));
window.addEventListener("keyup", (ev) => onKey(ev, false));
window.addEventListener("blur", () => {
  keys.accel = keys.brake = keys.left = keys.right = false;
  pushInput();
});

if (motionQuery) {
  const onMotion = () => renderer.setReduced(!!motionQuery.matches);
  motionQuery.addEventListener?.("change", onMotion);
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === "swing") {
      if (ev.move === "kick") audio.kick();
      else if (ev.move === "club") audio.clubSwing();
      else audio.punch();
    } else if (ev.type === "hit") audio.hit();
    else if (ev.type === "knockout") audio.knockout();
    else if (ev.type === "steal") audio.steal();
    else if (ev.type === "crash") audio.crash();
    else if (ev.type === "remount") audio.remount();
    else if (ev.type === "nearMiss") audio.nearMiss();
    else if (ev.type === "go") audio.countdown(0);
    else if (ev.type === "finish") {
      audio.finish();
      const applied = store.applyResult(data, game.lastResult || ev);
      data = applied.state;
      ui.showResult(game.lastResult);
      ui.renderGarage(data, game);
    } else if (ev.type === "fail") {
      audio.fail();
      const applied = store.applyResult(data, game.lastResult || ev);
      data = applied.state;
      ui.showResult(game.lastResult);
    }
  }
}

let acc = 0;
let last = performance.now();
let lastBeep = 4;
let lastSkid = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < MAX_STEPS) {
    const events = tick(game, STEP);
    handleEvents(events);
    if (game.race) {
      if (game.race.status === "countdown") {
        const n = Math.ceil(game.race.countdown);
        if (n !== lastBeep && n >= 1 && n <= 3) {
          audio.countdown(n);
          lastBeep = n;
        }
      }
    }
    acc -= STEP;
    steps += 1;
  }
  if (game.race && !isTerminal(game.race) && !game.race.paused) {
    const p = playerOf(game.race);
    audio.engine(p.speed / Math.max(1, p.bike.maxSpeed));
    if (Math.abs(steerDir()) && p.speed > 16 && p.mounted && now - lastSkid > 220) {
      audio.skid();
      lastSkid = now;
    }
    ui.syncRace(game.race, data);
  } else {
    audio.engine(0);
  }
  renderer.draw(game.race, { time: now / 1000, reducedMotion: !!motionQuery?.matches });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
