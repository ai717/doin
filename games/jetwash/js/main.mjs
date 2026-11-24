// Entry assembly. Wires the DOM shell to the DOM-free controller and renderer.
// Locale switching is a pure in-place text refresh: the controller and canvas
// state are never reset. Pause freezes the clock and the spray bed.

import { createController } from "./game.mjs";
import { createUI } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import { LEVELS, LEVEL_IDS, CHAPTERS, TOOLS } from "./levels.mjs";
import { levelName, loadLocale, applyLocale, strings } from "./i18n.mjs";
import { formatTime } from "./score.mjs";
import * as storage from "./storage.mjs";
import { reportWash } from "./portal.mjs";

const $ = (id) => document.getElementById(id);
const canvas = $("stage");
const ui = createUI(canvas);
const audio = createAudio();
let store = storage.load();
const controller = createController({ levelId: store.levelId });
let locale = loadLocale();
let drawerOpen = false;
let resultShown = false;
let lastFrame = performance.now();

function refreshStatic() {
  applyLocale(locale, () => {});
  const t = strings(locale);
  $("hud-level").textContent = levelName(locale, controller.levelId);
  $("result-grade").textContent = `${3} ★`;
  if ($("btn-sound")) $("btn-sound").textContent = t[store.muted ? "muted" : "mute"];
}

function updateHud() {
  const snap = controller.snapshot();
  $("hud-clean").textContent = `${Math.round(snap.progress * 100)}%`;
  $("clean-fill").style.width = `${Math.round(snap.progress * 100)}%`;
  $("hud-time").textContent = formatTime(snap.state.elapsed);
  $("hud-level").textContent = levelName(locale, controller.levelId);
}

function syncToolButtons() {
  const tool = controller.snapshot().tool;
  document.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.tool === tool));
  });
  const nozzle = controller.snapshot().nozzle;
  $("btn-nozzle").textContent = strings(locale)[nozzle === "wide" ? "nozzleWide" : "nozzleNarrow"];
}

function buildDrawer() {
  const t = strings(locale);
  const host = $("drawer-groups");
  host.textContent = "";
  CHAPTERS.forEach((chapter) => {
    const section = document.createElement("section");
    section.className = "chapter";
    const title = document.createElement("h3");
    title.textContent = t[chapter.id === "chapter_car" ? "chapterCar" : "chapterHome"];
    section.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "level-grid";
    LEVELS.filter((lv) => lv.chapter === chapter.id).forEach((lv) => {
      const btn = document.createElement("button");
      btn.className = "level-btn";
      btn.dataset.level = lv.id;
      const unlocked = storage.isUnlocked(store, lv.id);
      const name = document.createElement("b");
      name.textContent = levelName(locale, lv.id);
      btn.appendChild(name);
      const stars = document.createElement("small");
      stars.textContent = unlocked ? "★".repeat(store.stars[lv.id] || 0) || "·" : t.locked;
      btn.appendChild(stars);
      btn.disabled = !unlocked;
      btn.setAttribute("aria-current", String(lv.id === controller.levelId));
      btn.addEventListener("click", () => {
        controller.loadLevel(lv.id);
        store = storage.save({ ...store, levelId: lv.id }) ? storage.load() : store;
        ui.clearParticles();
        resultShown = false;
        $("result-layer").hidden = true;
        closeDrawer();
        audio.jet(false);
        updateHud();
      });
      grid.appendChild(btn);
    });
    section.appendChild(grid);
    host.appendChild(section);
  });
}

function openDrawer() {
  if (resultShown) return;
  drawerOpen = true;
  buildDrawer();
  $("drawer").hidden = false;
  if (!controller.snapshot().complete) setPause(true);
  audio.jet(false);
}

function closeDrawer() {
  drawerOpen = false;
  $("drawer").hidden = true;
}

function setPause(value) {
  const paused = controller.setPaused(value);
  $("pause-layer").hidden = !paused;
  $("btn-pause").textContent = strings(locale)[paused ? "resume" : "pause"];
  if (paused) audio.jet(false);
  return paused;
}

function showResult(snap) {
  if (resultShown || !snap.result) return;
  resultShown = true;
  const t = strings(locale);
  $("result-layer").hidden = false;
  $("result-time").textContent = formatTime(snap.result.time);
  $("result-grade").textContent = `${snap.result.stars} ★`;
  const stars = $("result-stars");
  stars.textContent = "";
  for (let i = 0; i < 3; i += 1) {
    const s = document.createElement("span");
    s.textContent = "★";
    if (i < snap.result.stars) s.className = "on";
    stars.appendChild(s);
  }
  const idx = LEVEL_IDS.indexOf(snap.levelId);
  const hasNext = idx >= 0 && idx + 1 < LEVEL_IDS.length;
  $("btn-next").hidden = !hasNext;
  $("btn-next").textContent = hasNext ? t.nextLevel : t.noNext;
  store = storage.recordFinish(store, snap.levelId, snap.result.stars, snap.result.time);
  reportWash(snap.levelId, snap.result.stars);
  audio.jet(false);
  audio.finish();
}

function handleEvents(events, snap) {
  for (const event of events) {
    if (event.type === "sparkle") {
      ui.emitSparkles(event.cells, snap.state);
      audio.droplet();
    } else if (event.type === "complete") {
      showResult(snap);
    }
  }
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const snap = controller.snapshot();
  const result = controller.tick(dt);
  const after = controller.snapshot();

  if (result.spray) audio.jet(true, result.speed ?? 0);
  else audio.jet(false);
  if (result.events.length) handleEvents(result.events, after);

  ui.render(after, dt);
  updateHud();
  requestAnimationFrame(frame);
}

function pointerPos(event) {
  return ui.pointerToNorm(event.clientX, event.clientY);
}

canvas.addEventListener("pointerdown", (event) => {
  if (controller.paused || resultShown || drawerOpen) return;
  const pos = pointerPos(event);
  ui.setPointer(pos);
  controller.beginPointer(pos);
  try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
  event.preventDefault();
});
canvas.addEventListener("pointermove", (event) => {
  const pos = pointerPos(event);
  ui.setPointer(pos);
  if (!controller.paused) event.preventDefault();
});
const releasePointer = () => { controller.endPointer(); ui.setPointer(null); };
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);
canvas.addEventListener("pointerleave", () => { ui.setPointer(null); });

document.querySelectorAll("[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (controller.chooseTool(btn.dataset.tool)) {
      syncToolButtons();
      if (btn.dataset.tool === "tool_foam") audio.foam();
      else if (btn.dataset.tool === "tool_brush") audio.brush();
      else if (btn.dataset.tool === "tool_squeegee") audio.squeegee();
    }
  });
});

$("btn-nozzle").addEventListener("click", () => {
  if (controller.switchNozzle()) syncToolButtons();
});
$("btn-pause").addEventListener("click", () => setPause(!controller.paused));
$("btn-resume").addEventListener("click", () => setPause(false));
$("btn-restart").addEventListener("click", () => {
  controller.rewash();
  resultShown = false;
  $("result-layer").hidden = true;
  $("pause-layer").hidden = true;
  ui.clearParticles();
  updateHud();
});
$("btn-levels").addEventListener("click", () => { drawerOpen ? closeDrawer() : openDrawer(); });
$("btn-close-drawer").addEventListener("click", closeDrawer);
$("btn-next").addEventListener("click", () => {
  if (!controller.nextLevel()) return;
  resultShown = false;
  $("result-layer").hidden = true;
  store = storage.save({ ...store, levelId: controller.levelId }) ? storage.load() : store;
  ui.clearParticles();
  updateHud();
});
$("btn-replay").addEventListener("click", () => {
  controller.rewash();
  resultShown = false;
  $("result-layer").hidden = true;
  ui.clearParticles();
});
$("btn-sound").addEventListener("click", () => {
  store = storage.save({ ...store, muted: audio.setMuted(!audio.muted) }) ? storage.load() : store;
  $("btn-sound").textContent = strings(locale)[store.muted ? "muted" : "mute"];
});
$("btn-lang").addEventListener("click", () => {
  locale = locale === "zh" ? "en" : "zh";
  applyLocale(locale, () => {});
  refreshStatic();
  syncToolButtons();
  buildDrawer();
  updateHud();
});

$("btn-tip").addEventListener("click", () => {
  $("tip-layer").hidden = false;
  if (!controller.snapshot().complete) setPause(true);
});
$("btn-got-it").addEventListener("click", () => {
  $("tip-layer").hidden = true;
  if (!resultShown && !drawerOpen) setPause(false);
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "p" || key === "escape" || (key === " " && !controller.snapshot().pointerDown)) {
    event.preventDefault();
    if (!$("tip-layer").hidden) {
      $("btn-got-it").click();
    } else if (!resultShown && !drawerOpen) {
      setPause(!controller.paused);
    }
    return;
  }
  if (key === "r") { $("btn-restart").click(); return; }
  if (key === "n") { $("btn-nozzle").click(); return; }
  const index = Number(key) - 1;
  if (index >= 0 && index < TOOLS.length) {
    const btn = document.querySelector(`[data-tool="${TOOLS[index]}"]`);
    if (btn) btn.click();
  }
});

let resumedByFocus = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !controller.paused && !resultShown) {
    resumedByFocus = true;
    setPause(true);
  } else if (!document.hidden && resumedByFocus) {
    resumedByFocus = false;
    setPause(false);
  }
});
window.addEventListener("blur", () => {
  if (!controller.paused && !resultShown) {
    resumedByFocus = true;
    setPause(true);
  }
});
window.addEventListener("focus", () => {
  if (resumedByFocus) {
    resumedByFocus = false;
    setPause(false);
  }
});

function boot() {
  audio.setMuted(Boolean(store.muted));
  ui.resize();
  refreshStatic();
  syncToolButtons();
  buildDrawer();
  updateHud();
  lastFrame = performance.now();
  requestAnimationFrame(frame);
  window.__jetwash = {
    snapshot: () => controller.snapshot(),
    ui,
    controller,
    get locale() { return locale; },
    get store() { return store; },
    reportWash,
  };
}
window.addEventListener("resize", () => ui.resize());
boot();
