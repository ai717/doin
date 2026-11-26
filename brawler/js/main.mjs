// main.mjs — 唯一装配层：DOM 引用、输入、循环、音效、语言热更新与持久化。

import { createAudio } from "./audio.mjs";
import {
  createGame,
  dispatch,
  setPaused as setGamePaused,
  start,
  tick,
} from "./game.mjs";
import { ENEMY_TYPES, ITEM_KINDS, nextLevelId } from "./levels.mjs";
import { detectLocale, loadLocale, saveLocale, t } from "./i18n.mjs";
import { createRenderer } from "./render.mjs";
import {
  arcadeBest,
  levelRecord,
  load,
  recordArcade,
  recordLevel,
  remember,
  save,
} from "./storage.mjs";
import { createUi } from "./ui.mjs";

function must(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing node: ${id}`);
  return node;
}

const refs = {
  stage: must("stage"),
  scaler: must("scaler"),
  camera: must("camera"),
  skyline: must("skyline"),
  props: must("props"),
  actors: must("actors"),
  items: must("items"),
  canvas: must("fx"),
  flash: must("flash"),
  banner: must("banner"),
  bannerText: must("banner-text"),
  levelsPanel: must("panel-levels"),
  pausePanel: must("panel-pause"),
  resultPanel: must("panel-result"),
  continuePanel: must("panel-continue"),
  helpPanel: must("panel-help"),
};

let store = load();
let locale = loadLocale() || detectLocale();
const audio = createAudio({ muted: store.prefs.muted });
const game = createGame({
  mode: store.prefs.mode,
  players: store.prefs.players,
  levelId: store.prefs.lastLevel,
});

const ui = createUi(refs, {
  onSelectLevel: (levelId) => selectLevel(levelId),
  onArcade: () => startArcade(),
});

const renderer = createRenderer(
  {
    stage: refs.stage,
    scaler: refs.scaler,
    camera: refs.camera,
    skyline: refs.skyline,
    props: refs.props,
    actors: refs.actors,
    items: refs.items,
    canvas: refs.canvas,
    flash: refs.flash,
  },
  { locale },
);

let lastResultView = null;
let resumeAfterLevels = false;
let resumeAfterHelp = false;
let panelReturn = null;
let lastFrame = performance.now();
const held = new Set();

ui.applyStatic(locale);
ui.setProgress(store, game.levelId);
updateSoundGlyph();
resizeStage();
startCurrent({ seed: undefined });

function chipKey() {
  if (game.mode === "arcade") return "arcade";
  return game.players === 2 ? "coop" : "story";
}

function persist() {
  store = remember(store, {
    muted: audio.isMuted(),
    mode: game.mode,
    players: game.players,
    lastLevel: game.levelId,
  });
  save(store);
}

function startCurrent(options = {}) {
  resumeAfterLevels = false;
  resumeAfterHelp = false;
  panelReturn = null;
  ui.closeAll();
  start(game, { ...options, levelId: game.levelId, mode: game.mode, players: game.players });
  ui.setMode(chipKey());
  lastResultView = null;
  persist();
  ui.setProgress(store, game.levelId);
  ui.setHud(game.match, game);
}

function startArcade() {
  game.levelId = game.levelId;
  game.mode = "arcade";
  game.players = 1;
  startCurrent({ mode: "arcade", players: 1 });
}

function selectLevel(levelId) {
  game.mode = "story";
  game.levelId = levelId;
  if (game.players !== 2) game.players = 1;
  startCurrent({ mode: "story", levelId });
}

function selectMode(mode) {
  if (mode === "arcade") {
    startArcade();
    return;
  }
  game.mode = "story";
  game.players = mode === "coop" ? 2 : 1;
  startCurrent({ mode: "story", players: game.players });
}

function canPause() {
  return Boolean(game.match) && !(game.match.status === "cleared" || game.match.status === "lost")
    && game.match.status !== "continue";
}

function pauseGame() {
  if (!canPause() || game.paused) return;
  setGamePaused(game, true);
  ui.showPause();
  audio.pause();
}

function resumeGame() {
  setGamePaused(game, false);
  ui.hidePause();
}

function togglePause() {
  if (!refs.levelsPanel.hidden) {
    closeLevelsPanel();
    return;
  }
  if (!refs.helpPanel.hidden) {
    closeHelpPanel();
    return;
  }
  if (!refs.resultPanel.hidden || !refs.continuePanel.hidden) return;
  if (game.paused) resumeGame();
  else pauseGame();
}

function openLevelsPanel() {
  panelReturn = !refs.resultPanel.hidden
    ? "result"
    : (!refs.pausePanel.hidden || game.paused ? "pause" : "play");
  ui.hideResult();
  ui.hidePause();
  if (panelReturn === "play" && canPause()) {
    setGamePaused(game, true);
    resumeAfterLevels = true;
  }
  ui.setProgress(store, game.levelId);
  ui.openLevels();
}

function closeLevelsPanel() {
  ui.closeLevels();
  if (!game.match) {
    startCurrent();
    return;
  }
  if (panelReturn === "result" && lastResultView) {
    ui.showResult(lastResultView.result, lastResultView.options);
  } else if (panelReturn === "pause") {
    ui.showPause();
  } else if (resumeAfterLevels) {
    setGamePaused(game, false);
  }
  resumeAfterLevels = false;
  panelReturn = null;
}

function openHelpPanel() {
  if (refs.resultPanel.hidden && refs.continuePanel.hidden && refs.levelsPanel.hidden) {
    if (canPause() && !game.paused) {
      setGamePaused(game, true);
      resumeAfterHelp = true;
    }
    ui.showHelp();
  }
}

function closeHelpPanel() {
  ui.hideHelp();
  if (resumeAfterHelp) {
    setGamePaused(game, false);
    resumeAfterHelp = false;
  }
}

function updateSoundGlyph() {
  const glyph = document.getElementById("sound-glyph");
  const button = document.getElementById("btn-sound");
  if (glyph) glyph.textContent = audio.isMuted() ? "🔇" : "🔊";
  if (button) button.setAttribute("aria-label", t(locale, audio.isMuted() ? "soundOff" : "soundOn"));
}

function toggleSound() {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  audio.unlock();
  if (!muted) audio.click();
  store = remember(store, { muted });
  save(store);
  updateSoundGlyph();
}

function toggleLocale() {
  locale = locale === "zh" ? "en" : "zh";
  saveLocale(locale);
  ui.applyStatic(locale);
  renderer.setLocale(locale);
  ui.setProgress(store, game.levelId);
  ui.setMode(chipKey());
  if (!refs.levelsPanel.hidden) ui.renderLevels();
  if (!refs.resultPanel.hidden && lastResultView) {
    ui.showResult(lastResultView.result, lastResultView.options);
  }
  if (!refs.continuePanel.hidden && game.match) ui.showContinue(game.match.continues);
  if (game.match) ui.setHud(game.match, game);
  updateSoundGlyph();
}

function onResult(result) {
  if (!result) return;
  ui.hideContinue();
  const previousBest = result.mode === "arcade"
    ? arcadeBest(store).bestScore
    : (levelRecord(store, result.levelId)?.bestScore ?? 0);
  const previousKo = result.mode === "arcade"
    ? arcadeBest(store).bestKo
    : (levelRecord(store, result.levelId)?.bestKo ?? 0);
  if (result.outcome === "clear") {
    store = result.mode === "arcade" ? recordArcade(store, result) : recordLevel(store, result);
    save(store);
  }
  const newBest = result.outcome === "clear"
    && (result.mode === "arcade" ? result.ko > previousKo : result.score > previousBest);
  lastResultView = {
    result,
    options: {
      best: result.mode === "arcade" ? previousKo : previousBest,
      newBest,
    },
  };
  ui.setProgress(store, game.levelId);
  ui.showResult(result, lastResultView.options);
}

function handleEvents(events) {
  let hitLight = 0;
  let hitHeavy = 0;
  let landed = 0;
  for (const event of events) {
    switch (event.type) {
      case "hit":
        if (event.power === "heavy") {
          if (hitHeavy === 0) audio.heavy();
          hitHeavy += 1;
        } else {
          if (hitLight === 0) audio.light();
          hitLight += 1;
        }
        break;
      case "land":
        if (landed === 0) audio.land();
        landed += 1;
        break;
      case "ko":
        audio.ko(event.ko ?? 1);
        break;
      case "star":
        audio.star();
        ui.showBanner(t(locale, "starBanner"), "gold");
        break;
      case "special":
        audio.special();
        break;
      case "pickup": {
        audio.pickup();
        const definition = ITEM_KINDS[event.kind];
        if (definition) {
          ui.showBanner(t(locale, "itemPick", t(locale, definition.nameKey)), "", true);
        }
        break;
      }
      case "heal":
        audio.heal();
        ui.showBanner(t(locale, "itemHeal", event.amount ?? 0), "gold", true);
        break;
      case "throw":
        audio.launch();
        break;
      case "wave":
        if (event.total > 0) ui.showBanner(t(locale, "waveBanner", event.index), "", true);
        break;
      case "boss":
        audio.boss();
        ui.showBanner(t(locale, "bossBanner", t(locale, event.nameKey ?? "bossTitle")), "danger");
        break;
      case "bossDown": {
        const nameKey = ENEMY_TYPES[event.kind]?.nameKey ?? "bossTitle";
        ui.showBanner(t(locale, "bossDownBanner", t(locale, nameKey)), "gold");
        audio.star();
        break;
      }
      case "clear":
        audio.clear();
        break;
      case "lost":
        audio.lose();
        break;
      case "continue":
        audio.lose();
        break;
      case "revive":
        audio.pickup();
        break;
      default:
        break;
    }
  }
}

function syncMovement() {
  if (!game.match) return;
  const mx1 = (held.has("KeyD") ? 1 : 0) - (held.has("KeyA") ? 1 : 0);
  const mz1 = (held.has("KeyS") ? 1 : 0) - (held.has("KeyW") ? 1 : 0);
  dispatch(game, { type: "input", playerId: 0, mx: mx1, mz: mz1 });
  if (game.match.players.length > 1) {
    const mx2 = (held.has("ArrowRight") ? 1 : 0) - (held.has("ArrowLeft") ? 1 : 0);
    const mz2 = (held.has("ArrowDown") ? 1 : 0) - (held.has("ArrowUp") ? 1 : 0);
    dispatch(game, { type: "input", playerId: 1, mx: mx2, mz: mz2 });
  }
}

function actionFor(code) {
  if (game.match?.players?.length > 1) {
    if (code === "KeyF") return { action: "light", playerId: 0 };
    if (code === "KeyG") return { action: "heavy", playerId: 0 };
    if (code === "KeyH") return { action: "jump", playerId: 0 };
    if (code === "KeyT") return { action: "use", playerId: 0 };
    if (code === "KeyR") return { action: "special", playerId: 0 };
    if (code === "Numpad1" || code === "KeyJ") return { action: "light", playerId: 1 };
    if (code === "Numpad2" || code === "KeyK") return { action: "heavy", playerId: 1 };
    if (code === "Numpad3" || code === "KeyL") return { action: "jump", playerId: 1 };
    if (code === "Numpad0" || code === "KeyI") return { action: "use", playerId: 1 };
    if (code === "Numpad9" || code === "KeyO") return { action: "special", playerId: 1 };
    return null;
  }
  if (code === "KeyJ") return { action: "light", playerId: 0 };
  if (code === "KeyK") return { action: "heavy", playerId: 0 };
  if (code === "Space") return { action: "jump", playerId: 0 };
  if (code === "KeyL") return { action: "use", playerId: 0 };
  if (code === "KeyU") return { action: "special", playerId: 0 };
  return null;
}

const MOVE_CODES = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" || event.code === "KeyP") {
    event.preventDefault();
    togglePause();
    return;
  }
  if (!refs.levelsPanel.hidden || !refs.helpPanel.hidden) return;
  if (MOVE_CODES.has(event.code)) {
    event.preventDefault();
    if (!held.has(event.code)) {
      held.add(event.code);
      syncMovement();
    }
    audio.unlock();
    return;
  }
  const mapped = actionFor(event.code);
  if (!mapped) return;
  event.preventDefault();
  audio.unlock();
  if (event.repeat) return;
  dispatch(game, { type: "action", action: mapped.action, playerId: mapped.playerId });
});

window.addEventListener("keyup", (event) => {
  if (!held.has(event.code)) return;
  held.delete(event.code);
  syncMovement();
});

window.addEventListener("blur", () => {
  if (!game.paused && canPause() && refs.levelsPanel.hidden && refs.helpPanel.hidden) {
    setGamePaused(game, true);
    ui.showPause();
  }
  held.clear();
  syncMovement();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && !game.paused && canPause() && refs.levelsPanel.hidden && refs.helpPanel.hidden) {
    setGamePaused(game, true);
    ui.showPause();
  }
});

document.getElementById("btn-levels").addEventListener("click", () => {
  audio.click();
  openLevelsPanel();
});
document.getElementById("levels-close").addEventListener("click", () => closeLevelsPanel());
document.getElementById("btn-pause").addEventListener("click", () => {
  audio.click();
  togglePause();
});
document.getElementById("act-pause").addEventListener("click", () => togglePause());
document.getElementById("btn-sound").addEventListener("click", () => toggleSound());
document.getElementById("btn-lang").addEventListener("click", () => {
  audio.click();
  toggleLocale();
});
document.getElementById("btn-help").addEventListener("click", () => {
  audio.click();
  openHelpPanel();
});
document.getElementById("btn-help-close").addEventListener("click", () => closeHelpPanel());
document.getElementById("btn-resume").addEventListener("click", () => {
  audio.click();
  resumeGame();
});
document.getElementById("btn-restart").addEventListener("click", () => {
  audio.click();
  startCurrent({ seed: undefined });
});
document.getElementById("btn-pause-levels").addEventListener("click", () => {
  audio.click();
  openLevelsPanel();
});
document.getElementById("btn-continue").addEventListener("click", () => {
  audio.click();
  ui.hideContinue();
  dispatch(game, { type: "continue" });
});
document.getElementById("btn-give-up").addEventListener("click", () => {
  audio.click();
  ui.hideContinue();
  game.match = null;
  game.paused = false;
  openLevelsPanel();
});
document.getElementById("btn-next").addEventListener("click", () => {
  if (!lastResultView) return;
  audio.click();
  const result = lastResultView.result;
  if (result.mode === "arcade") {
    startArcade();
    return;
  }
  game.levelId = nextLevelId(result.levelId);
  startCurrent({ mode: "story", levelId: game.levelId });
});
document.getElementById("btn-retry").addEventListener("click", () => {
  audio.click();
  if (lastResultView?.result.mode === "arcade") startArcade();
  else startCurrent({ seed: undefined });
});
document.getElementById("btn-result-levels").addEventListener("click", () => {
  audio.click();
  openLevelsPanel();
});
document.getElementById("mode-story").addEventListener("click", () => selectMode("story"));
document.getElementById("mode-coop").addEventListener("click", () => selectMode("coop"));
document.getElementById("mode-arcade").addEventListener("click", () => selectMode("arcade"));

const actionButtons = [
  ["act-light", "light"],
  ["act-heavy", "heavy"],
  ["act-jump", "jump"],
  ["act-use", "use"],
  ["act-special", "special"],
];
for (const [id, action] of actionButtons) {
  const button = document.getElementById(id);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    audio.unlock();
    button.classList.add("is-pressed");
    dispatch(game, { type: "action", action, playerId: 0 });
  });
  const release = () => button.classList.remove("is-pressed");
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

const stickPad = document.getElementById("stick-pad");
const stickKnob = document.getElementById("stick-knob");
let stickPointer = null;
let stickRadius = 38;

function updateStick(clientX, clientY) {
  const rect = stickPad.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const distance = Math.hypot(dx, dy);
  if (distance > stickRadius) {
    dx = (dx / distance) * stickRadius;
    dy = (dy / distance) * stickRadius;
  }
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  const mx = Math.max(-1, Math.min(1, dx / stickRadius));
  const mz = Math.max(-1, Math.min(1, dy / stickRadius));
  dispatch(game, { type: "input", playerId: 0, mx, mz });
}

stickPad.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  stickPointer = event.pointerId;
  stickRadius = stickPad.getBoundingClientRect().width * 0.34;
  stickPad.setPointerCapture(event.pointerId);
  audio.unlock();
  updateStick(event.clientX, event.clientY);
});
stickPad.addEventListener("pointermove", (event) => {
  if (stickPointer !== event.pointerId) return;
  updateStick(event.clientX, event.clientY);
});
function releaseStick(event) {
  if (stickPointer !== event.pointerId) return;
  stickPointer = null;
  stickKnob.style.transform = "translate(0, 0)";
  dispatch(game, { type: "input", playerId: 0, mx: 0, mz: 0 });
}
stickPad.addEventListener("pointerup", releaseStick);
stickPad.addEventListener("pointercancel", releaseStick);

function resizeStage() {
  const width = refs.stage.clientWidth || 0;
  if (width <= 0) return;
  renderer.setStageScale(width / 960);
}
if (typeof ResizeObserver === "function") {
  const observer = new ResizeObserver(() => resizeStage());
  observer.observe(refs.stage);
}
window.addEventListener("resize", resizeStage);

function syncOverlays() {
  if (!game.match) return;
  if (game.match.status === "continue") {
    if (refs.continuePanel.hidden) ui.showContinue(game.match.continues);
  } else if (!refs.continuePanel.hidden) {
    ui.hideContinue();
  }
}

function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (game.match) {
    syncMovement();
    let events = [];
    if (!game.paused) {
      const outcome = tick(game, dt);
      events = outcome.events;
      if (events.length) handleEvents(events);
      if (outcome.fresh) onResult(outcome.result);
    }
    renderer.frame(game.match, events, game.paused ? 0 : dt);
    ui.setHud(game.match, game);
    syncOverlays();
  }
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

window.addEventListener("beforeunload", () => {
  persist();
});

window.__brawler = {
  get game() {
    return game;
  },
  get store() {
    return store;
  },
  startArcade,
  selectLevel,
  togglePause,
  toggleLocale,
};
