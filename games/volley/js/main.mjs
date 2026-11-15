// Volley Bombard — entry point. Wires engine, controller, UI, audio,
// storage and i18n together; owns the rAF loop, input bindings and overlays.

import * as E from "./engine.mjs";
import { createGame } from "./game.mjs";
import { createUi } from "./ui.mjs";
import * as Audio from "./audio.mjs";
import { STRINGS, t, getLang, setLang, toggleLang, applyI18n } from "./i18n.mjs";
import { loadSave, setPreferences, recordMatch } from "./storage.mjs";

const RECOMMENDED = [
  { slug: "blockduel", icon: "🧨" },
  { slug: "bomber", icon: "💣" },
  { slug: "tilestack", icon: "🧱" },
];

const $ = (sel) => document.querySelector(sel);

let save = loadSave();
let game = null;
// ui 在 createUi 时就闭包捕获了这个对象，而真正的 controller 要到 boot() 才创建，
// 所以这里用惰性转发，避免 ui 拿到 null。
const gameRef = {
  get raw() {
    return game.raw();
  },
  view() {
    return game.view();
  },
};
const ui = createUi({ game: gameRef, onIntent: handleIntent });
let rafId = null;
let lastTime = null;
let closed = false;

// ---------- boot ----------

function boot() {
  ui.init();
  Audio.setEnabled(save.sound !== false);
  game = createGame({
    mode: save.mode,
    aiLevel: save.aiLevel,
    terrain: save.terrain,
    onEvents: handleEngineEvents,
  });
  ui.setMode({ mode: save.mode, aiLevel: save.aiLevel, terrain: save.terrain });
  applyI18n(document, getLang());
  ui.setLang(getLang());
  bindUi();
  renderStats();
  ui.showToast(t(save.mode === "ai" ? "toastModeAi" : "toastMode2p", getLang()));
  startLoop();
}

function startLoop() {
  lastTime = performance.now();
  const frame = (now) => {
    if (closed) return;
    const dt = now - (lastTime ?? now);
    lastTime = now;
    if (!ui.overlayOpen() || isPauseOverlay()) {
      game.tick(dt);
    }
    ui.renderFrame(game.view());
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);
}

function isPauseOverlay() {
  return !ui.el.ovPause.hidden;
}

// ---------- intents from UI ----------

function handleIntent(type, payload) {
  switch (type) {
    case "angle":
    case "power":
    case "weapon":
    case "fire":
      if (type === "fire") Audio.play("fire");
      game.intent(type, payload);
      ui.renderAll();
      break;
    case "pause":
      togglePause();
      break;
    case "resume":
      togglePause();
      break;
    case "restart":
      ui.closeOverlays();
      restartMatch();
      break;
    case "mode":
      ui.openOverlay("mode");
      break;
    case "help":
      ui.openOverlay("help");
      break;
    case "sound":
      flipSound();
      break;
    case "lang":
      flipLang();
      break;
    case "applyMode":
      applyModeSelection();
      break;
    case "close":
      // closing mode/help panels is safe anytime
      ui.closeOverlays();
      break;
    default:
      break;
  }
}

// Events that change what the sand table / HUD must show. The render loop only
// repaints shells and particles, so these must trigger a full match re-render.
const DIRTY_EVENTS = new Set([
  "turnStart",
  "windChange",
  "explode",
  "blockDamage",
  "blockDestroy",
  "collapse",
  "flagDown",
  "matchOver",
]);

function handleEngineEvents(events) {
  ui.handleEvents(events);
  let dirty = false;
  for (const ev of events) {
    if (ev.type === "matchOver") onMatchOver(ev);
    if (DIRTY_EVENTS.has(ev.type)) dirty = true;
  }
  if (dirty) ui.renderAll();
}

// ---------- pause ----------

function togglePause() {
  if (game.isOver()) return;
  const paused = game.togglePause();
  ui.setPausePressed(paused);
  if (paused) {
    ui.openOverlay("pause");
    Audio.play("pause");
  } else {
    ui.el.ovPause.hidden = true;
    Audio.play("unpause");
  }
}

// ---------- mode panel ----------

function modeSelection() {
  const sel2p = ui.el.seg2p.getAttribute("aria-pressed") === "true";
  let aiLevel = save.aiLevel;
  [...ui.el.segAiLevel.children].forEach((b) => {
    if (b.getAttribute("aria-pressed") === "true") aiLevel = b.dataset.level;
  });
  let terrain = save.terrain;
  [...ui.el.segTerrain.children].forEach((b) => {
    if (b.getAttribute("aria-pressed") === "true") terrain = b.dataset.terrain;
  });
  return { mode: sel2p ? "2p" : "ai", aiLevel, terrain };
}

function applyModeSelection() {
  const sel = modeSelection();
  save.mode = sel.mode;
  save.aiLevel = sel.aiLevel;
  save.terrain = sel.terrain;
  setPreferences(sel);
  ui.setMode(sel);
  ui.closeOverlays();
  restartMatch(sel);
  ui.showToast(t(sel.mode === "ai" ? "toastModeAi" : "toastMode2p", getLang()));
}

function restartMatch(next = {}) {
  game.restart(next);
  ui.setTags(game.view());
  ui.renderAll();
}

// ---------- sound & language ----------

function flipSound() {
  const on = !Audio.isEnabled();
  Audio.setEnabled(on);
  save.sound = on;
  setPreferences({ sound: on });
  ui.setSoundPressed(on);
  if (on) Audio.play("ui");
}

function flipLang() {
  const next = toggleLang();
  ui.setLang(next);
  renderStats();
  ui.setTags(game.view());
  Audio.play("ui");
}

// ---------- match over ----------

function onMatchOver(ev) {
  const lang = getLang();
  const hitRate = bestHitRate();
  // storage 的胜场口径是 1-based（1=P1 / 2=P2），engine 的 side 是 0-based
  const statSide = ev.winner === "draw" ? 0 : ev.winner + 1;
  recordMatch(statSide, hitRate, bestSingle());
  renderStats();
  setTimeout(() => {
    buildRecommendations();
    ui.el.ovResult.hidden = false;
    void lang;
  }, 900);
}

// 玩家所在方：AI 模式下西军归 AI，玩家在东军
function humanSide() {
  return game.meta.mode === "ai" ? 1 : 0;
}

function bestHitRate() {
  const p = game.raw().players[humanSide()];
  return p.shots ? Math.round((p.hits / p.shots) * 100) : 0;
}

function bestSingle() {
  return game.raw().players[humanSide()].bestDamage;
}

function renderStats() {
  ui.el.statMatches.textContent = save.matches;
  ui.el.statP1.textContent = save.p1Wins;
  ui.el.statP2.textContent = save.p2Wins;
  ui.el.statHit.textContent = `${save.bestHitRate || 0}%`;
  ui.el.statSingle.textContent = save.bestSingle || 0;
}

function buildRecommendations() {
  const host = ui.el.resultRecs;
  host.innerHTML = "";
  const title = document.createElement("span");
  title.className = "recs-title";
  title.dataset.i18n = "suggestTitle";
  title.textContent = t("suggestTitle", getLang());
  host.appendChild(title);
  RECOMMENDED.forEach((r) => {
    const a = document.createElement("a");
    a.className = "rec";
    a.href = `/${r.slug}/`;
    a.innerHTML = `<span class="rec-ico">${r.icon}</span><span class="rec-name"></span>`;
    a.querySelector(".rec-name").textContent = r.slug;
    host.appendChild(a);
  });
}

// ---------- input bindings ----------

function bindUi() {
  ui.el.btnMode.addEventListener("click", () => handleIntent("mode"));
  ui.el.btnHelp.addEventListener("click", () => handleIntent("help"));
  ui.el.btnPause.addEventListener("click", () => handleIntent("pause"));
  ui.el.btnSound.addEventListener("click", () => handleIntent("sound"));
  ui.el.btnLang.addEventListener("click", () => handleIntent("lang"));
  ui.el.btnResume.addEventListener("click", () => handleIntent("resume"));
  ui.el.btnRestart.addEventListener("click", () => handleIntent("restart"));
  ui.el.btnPauseMode.addEventListener("click", () => {
    ui.el.ovPause.hidden = true;
    handleIntent("mode");
  });
  ui.el.btnApplyMode.addEventListener("click", () => handleIntent("applyMode"));
  ui.el.btnResultPrimary.addEventListener("click", () => {
    ui.el.ovResult.hidden = true;
    restartMatch();
  });
  ui.el.btnResultSecondary.addEventListener("click", () => {
    ui.el.ovResult.hidden = true;
    handleIntent("mode");
  });
  ui.el.btnResultMode.addEventListener("click", () => {
    ui.el.ovResult.hidden = true;
    handleIntent("mode");
  });

  document.querySelectorAll("[data-close]").forEach((b) => {
    b.addEventListener("click", () => {
      ui.closeOverlays();
      if (game.isPaused()) togglePause();
    });
  });

  // seg groups toggle inside the mode panel
  ui.el.seg2p.addEventListener("click", () => setSeg(ui.el.seg2p, true));
  ui.el.segAi.addEventListener("click", () => setSeg(ui.el.seg2p, false));
  [...ui.el.segAiLevel.children].forEach((b) => {
    b.addEventListener("click", () => {
      [...ui.el.segAiLevel.children].forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
    });
  });
  [...ui.el.segTerrain.children].forEach((b) => {
    b.addEventListener("click", () => {
      [...ui.el.segTerrain.children].forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
    });
  });

  // console pads
  for (let side = 0; side < 2; side++) {
    $(`#btn-angle-inc-${side}`).addEventListener("click", () => nudgeAngle(side, +1));
    $(`#btn-angle-dec-${side}`).addEventListener("click", () => nudgeAngle(side, -1));
    $(`#btn-fire-${side}`).addEventListener("click", () => handleIntent("fire", { side }));
  }

  // keyboard
  window.addEventListener("keydown", onKeydown);

  // auto-pause when the tab loses focus
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !game.isPaused() && !game.isOver()) {
      togglePause();
      ui.showToast(t("toastAutoPause", getLang()));
    }
  });
  window.addEventListener("blur", () => {
    if (!game.isPaused() && !game.isOver()) togglePause();
  });

  // drag on the sand table aims for the active human side
  const table = ui.el.tabletop;
  let dragging = null;
  table.addEventListener("pointerdown", (e) => {
    if (ui.overlayOpen()) return;
    const side = game.raw().turn;
    if (game.meta.mode === "ai" && side === 0) return;
    dragging = { side, x: e.clientX, angle: game.raw().players[side].angle };
    table.setPointerCapture(e.pointerId);
  });
  table.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x;
    const angle = clamp(dragging.angle + dx * 0.12, E.MIN_ANGLE, E.MAX_ANGLE);
    game.intent("angle", { side: dragging.side, angle });
    ui.renderAll();
  });
  const endDrag = () => {
    dragging = null;
  };
  table.addEventListener("pointerup", endDrag);
  table.addEventListener("pointercancel", endDrag);

  // audio unlock on first interaction
  window.addEventListener(
    "pointerdown",
    () => Audio.unlock(),
    { once: true, capture: true }
  );
}

function setSeg(seg, pressed) {
  seg.setAttribute("aria-pressed", pressed ? "true" : "false");
}

function nudgeAngle(side, dir) {
  handleIntent("angle", { side, delta: dir * 2 });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function onKeydown(e) {
  const key = e.key;
  if (key === "p" || key === "P" || key === "Escape" || key === " ") {
    if (key === "Escape" && ui.overlayOpen()) {
      // let overlays close via Escape without pausing underneath
      const anyOpen = [ui.el.ovHelp, ui.el.ovMode, ui.el.ovResult].some((n) => !n.hidden);
      if (anyOpen) {
        ui.closeOverlays();
        ui.el.ovResult.hidden = true;
        e.preventDefault();
        return;
      }
    }
    if (key === " " && !ui.overlayOpen() && game.raw().phase === "aim") {
      // space fires for the active human side when allowed
      const side = game.raw().turn;
      if (!(game.meta.mode === "ai" && side === 0)) {
        e.preventDefault();
        handleIntent("fire", { side });
        return;
      }
    }
    e.preventDefault();
    togglePause();
    return;
  }
  if (ui.overlayOpen()) return;
  const side = game.raw().turn;
  if (game.meta.mode === "ai" && side === 0) return;
  if (side === 0) {
    if (key === "a" || key === "A") nudgeAngle(0, -1);
    else if (key === "d" || key === "D") nudgeAngle(0, +1);
    else if (key === "w" || key === "W") handleIntent("power", { side: 0, delta: +4 });
    else if (key === "s" || key === "S") handleIntent("power", { side: 0, delta: -4 });
  } else {
    if (key === "ArrowLeft") nudgeAngle(1, -1);
    else if (key === "ArrowRight") nudgeAngle(1, +1);
    else if (key === "ArrowUp") handleIntent("power", { side: 1, delta: +4 });
    else if (key === "ArrowDown") handleIntent("power", { side: 1, delta: -4 });
  }
}

// Debug handle (platform contract): window.__volley
window.__volley = {
  get game() {
    return game;
  },
  get ui() {
    return ui;
  },
  get save() {
    return save;
  },
  intent: handleIntent,
  restart: restartMatch,
};

boot();
