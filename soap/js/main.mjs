// Assembly: DOM events, i18n live update, storage, audio lifecycle.
// Language switching updates text in place and never resets the cutting state.

import { createController } from "./game.mjs";
import { createUI } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import * as storage from "./storage.mjs";
import { loadLocale, saveLocale, strings, format, htmlLang, LANG_KEY } from "./i18n.mjs";
import { SOAPS, TOOL_IDS, TOOLS, MATERIALS } from "./soaps.mjs";
import { remainingRatio, shapeRatio, hasCore } from "./engine.mjs";
import { reportSession } from "./portal.mjs";

const $ = (id) => document.getElementById(id);
const board = $("board");
const controller = createController();
const ui = createUI(board);
const audio = createAudio();

let locale = loadLocale();
let t = strings(locale);
let pointer = { visible: false, px: 0, py: 0, angle: -0.5 };
let cutting = false;
let lastCell = null;
let lastMove = 0;
let raf = 0;
let lastFrame = 0;
let drawerOpen = false;
let resultShown = false;
let autoPaused = false;
let store = storage.load();

const TOOL_TEXT = { tool_knife: "toolKnife", tool_scraper: "toolScraper", tool_peeler: "toolPeeler" };
const MATERIAL_TEXT = { mat_hard: "matHard", mat_soft: "matSoft", mat_jelly: "matJelly" };
const FAMILY_TEXT = { classic: "familyClassic", jelly: "familyJelly", shape: "familyShape" };

function isCompleteEnough(view) {
  return remainingRatio(view.state) <= 0.1 || (hasCore(view.state) && shapeRatio(view.state) >= 0.9);
}

function renderSoapList() {
  const list = $("soap-list");
  list.replaceChildren();
  const groups = ["classic", "jelly", "shape"];
  for (const family of groups) {
    const title = document.createElement("p");
    title.className = "drawer-group-title";
    title.textContent = t[FAMILY_TEXT[family]];
    list.appendChild(title);
    for (const def of SOAPS.filter((item) => item.family === family)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "soap-entry";
      button.dataset.soap = def.id;
      if (def.id === controller.soapId) button.classList.add("selected");
      const swatch = document.createElement("span");
      swatch.className = "soap-swatch";
      swatch.style.background = `linear-gradient(145deg, ${def.tint}, ${def.accent})`;
      const body = document.createElement("span");
      body.textContent = t[def.nameKey] ?? def.nameKey;
      const detail = document.createElement("small");
      detail.textContent = t[MATERIAL_TEXT[def.material]] ?? def.material;
      body.appendChild(detail);
      button.append(swatch, body);
      list.appendChild(button);
    }
  }
}

function applyLocale(nextLocale, persist = true) {
  if (!["zh", "en"].includes(nextLocale)) return;
  locale = nextLocale;
  t = strings(locale);
  if (persist) saveLocale(locale);
  document.documentElement.lang = htmlLang(locale);
  document.title = t.docTitle;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", t.metaDesc);

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (t[key] !== undefined) el.setAttribute("aria-label", t[key]);
  });
  const langBtn = $("btn-lang");
  langBtn.textContent = t.langShort;
  langBtn.setAttribute("aria-label", t.langLabel);

  renderSoapList();
  updateHud();
  const view = controller.snapshot();
  if (!cutting) updateStatus(view);
  if (resultShown) updateResultText();
}

function updateHud() {
  const view = controller.snapshot();
  $("hud-progress").textContent = `${Math.round((view.progress || 0) * 100)}%`;
  $("hud-tool").textContent = t[TOOL_TEXT[view.tool]] ?? view.tool;
  const coreCard = $("hud-core-card");
  coreCard.hidden = !view.hasCore;
  if (view.hasCore) $("hud-core").textContent = `${Math.round((view.shape || 0) * 100)}%`;
  $("btn-finish").hidden = view.complete || !isCompleteEnough(view);
  $("btn-pause").textContent = view.paused ? t.resume : t.pause;
  $("btn-sound").textContent = audio.isMuted() ? t.muted : t.mute;
  document.querySelectorAll(".tool").forEach((button) => {
    const active = button.dataset.tool === view.tool;
    button.setAttribute("aria-pressed", String(active));
    const name = button.querySelector(".tool-name");
    if (name) name.textContent = t[TOOL_TEXT[button.dataset.tool]] ?? button.dataset.tool;
  });
}

function updateStatus(view) {
  const status = $("status");
  if (view.complete) status.textContent = t.statusDone;
  else if (cutting) status.textContent = t.statusCutting;
  else status.textContent = t.statusReady;
}

function showResult() {
  if (resultShown) return;
  resultShown = true;
  ui.clearParticles();
  updateResultText();
  $("result-veil").hidden = false;
  const view = controller.snapshot();
  store = storage.recordFinish(store, view.soapId, view.finesse).state;
  storage.save(store);
  reportSession({
    slug: "soap",
    outcome: "WON",
    score: Math.round(view.progress * 100),
    stars: view.result?.stars ?? 0,
  });
}

function updateResultText() {
  const view = controller.snapshot();
  const stars = view.result?.stars ?? 0;
  $("result-stars").textContent = "★".repeat(stars) + "☆".repeat(Math.max(0, 5 - stars));
  $("result-sub").textContent = format(t.resultSub, `${Math.round(view.progress * 100)}%`, `${Math.round(view.finesse * 100)}%`);
}

function processEvents(events) {
  if (!events || !events.length) return;
  const view = controller.snapshot();
  for (const event of events) {
    if (event.type === "cut") {
      ui.spawnChips(event.chips, view);
      if (event.chips.length) audio.chip(event.chips[0].style);
    } else if (event.type === "core") {
      audio.coreReveal();
      $("status").textContent = t.coreFound;
    } else if (event.type === "complete") {
      audio.complete();
      showResult();
    } else if (event.type === "cleanup") {
      audio.complete();
      showResult();
    }
  }
}

function setPause(value, automatic = false) {
  autoPaused = automatic && value;
  const paused = controller.setPaused(value);
  if (paused) {
    audio.pause();
    cutting = false;
    lastCell = null;
    $("pause-veil").hidden = false;
  } else {
    audio.resume();
    $("pause-veil").hidden = true;
  }
  updateHud();
  return paused;
}

function closeDrawer() {
  drawerOpen = false;
  $("soap-drawer").classList.remove("open");
  $("soap-drawer").setAttribute("aria-hidden", "true");
  $("scrim").hidden = true;
}

function openDrawer() {
  drawerOpen = true;
  renderSoapList();
  $("soap-drawer").classList.add("open");
  $("soap-drawer").setAttribute("aria-hidden", "false");
  $("scrim").hidden = false;
}

function newSoap(id, seed) {
  controller.loadSoap(id, seed);
  ui.clearParticles();
  resultShown = false;
  $("result-veil").hidden = true;
  $("pause-veil").hidden = true;
  store.prefs.lastSoap = id;
  storage.save(store);
  renderSoapList();
  updateHud();
  updateStatus(controller.snapshot());
}

board.addEventListener("pointerdown", (event) => {
  if (controller.paused || controller.snapshot().complete) return;
  audio.unlock();
  board.setPointerCapture(event.pointerId);
  cutting = true;
  lastCell = ui.pointerToCell(event.clientX, event.clientY);
  pointer = { visible: true, px: lastCell.px, py: lastCell.py, angle: -0.5 };
  lastMove = performance.now();
  audio.startScrape(controller.snapshot().material, 300);
  audio.bladeIn();
  updateStatus(controller.snapshot());
  event.preventDefault();
});

board.addEventListener("pointermove", (event) => {
  const cell = ui.pointerToCell(event.clientX, event.clientY);
  const dx = cell.px - pointer.px;
  const dy = cell.py - pointer.py;
  if (Math.abs(dx) + Math.abs(dy) > 1) {
    pointer.angle = Math.atan2(dy, dx) - Math.PI / 4;
  }
  pointer.px = cell.px;
  pointer.py = cell.py;
  pointer.visible = true;
  if (!cutting || controller.paused || controller.snapshot().complete) return;
  const now = performance.now();
  const dt = Math.max(8, now - lastMove);
  lastMove = now;
  const speed = (Math.hypot(dx, dy) / dt) * 1000;
  const result = controller.cut({ x: lastCell.x, y: lastCell.y }, { x: cell.x, y: cell.y }, speed);
  lastCell = cell;
  if (result.changed) {
    audio.updateScrape(speed, TOOLS[controller.toolId].depth);
    processEvents(result.events);
    updateHud();
  }
  event.preventDefault();
});

function endStroke(event) {
  if (!cutting) return;
  cutting = false;
  lastCell = null;
  audio.stopScrape();
  updateStatus(controller.snapshot());
  if (event && board.hasPointerCapture?.(event.pointerId)) board.releasePointerCapture(event.pointerId);
}

board.addEventListener("pointerup", endStroke);
board.addEventListener("pointercancel", endStroke);
board.addEventListener("pointerleave", (event) => {
  pointer.visible = false;
  endStroke(event);
});
board.addEventListener("pointerenter", () => { pointer.visible = true; });

document.querySelectorAll(".tool").forEach((button) => {
  button.addEventListener("click", () => {
    if (controller.setTool(button.dataset.tool)) {
      store.prefs.tool = controller.toolId;
      storage.save(store);
      updateHud();
    }
  });
});

$("btn-soaps").addEventListener("click", openDrawer);
$("drawer-close").addEventListener("click", closeDrawer);
$("scrim").addEventListener("click", closeDrawer);
$("soap-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-soap]");
  if (!button) return;
  newSoap(button.dataset.soap);
  closeDrawer();
});

$("btn-restart").addEventListener("click", () => newSoap(controller.soapId));
$("btn-next").addEventListener("click", () => {
  controller.nextSoap();
  ui.clearParticles();
  resultShown = false;
  $("result-veil").hidden = true;
  store.prefs.lastSoap = controller.soapId;
  storage.save(store);
  renderSoapList();
  updateHud();
  updateStatus(controller.snapshot());
});
$("btn-result-close").addEventListener("click", () => {
  resultShown = false;
  $("result-veil").hidden = true;
});
$("btn-finish").addEventListener("click", () => {
  const result = controller.finish();
  if (result.changed) {
    updateHud();
    processEvents(result.events);
  }
});
$("btn-pause").addEventListener("click", () => setPause(!controller.paused));
$("btn-resume").addEventListener("click", () => setPause(false));
$("btn-sound").addEventListener("click", () => {
  const muted = audio.setMuted(!audio.isMuted());
  store.prefs.muted = muted;
  storage.save(store);
  updateHud();
});
$("btn-lang").addEventListener("click", () => applyLocale(locale === "zh" ? "en" : "zh"));

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const key = event.key.toLowerCase();
  if (key >= "1" && key <= "3") {
    const id = TOOL_IDS[Number(key) - 1];
    if (controller.setTool(id)) {
      store.prefs.tool = id;
      storage.save(store);
      updateHud();
    }
  } else if (key === "r") {
    newSoap(controller.soapId);
  } else if (key === "p" || key === "escape" || key === " ") {
    event.preventDefault();
    setPause(!controller.paused);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && !controller.paused) setPause(true, true);
  else if (!document.hidden && autoPaused) setPause(false);
});
window.addEventListener("blur", () => {
  if (!controller.paused) setPause(true, true);
});
window.addEventListener("focus", () => {
  if (autoPaused) setPause(false);
});
window.addEventListener("resize", () => ui.resize());

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  ui.draw(controller.snapshot(), pointer, cutting, dt);
  raf = requestAnimationFrame(frame);
}

// Debug handle. `game` stays a getter so tests can inspect the live controller.
window.__soap = {
  get game() { return controller; },
  get state() { return controller.snapshot(); },
  ui,
  audio,
  locale: () => locale,
  setLocale: applyLocale,
  get langKey() { return LANG_KEY; },
};

controller.setTool(store.prefs.tool);
audio.setMuted(store.prefs.muted);
if (SOAPS.some((item) => item.id === store.prefs.lastSoap)) controller.loadSoap(store.prefs.lastSoap);
applyLocale(locale, false);
ui.resize();
updateHud();
updateStatus(controller.snapshot());
raf = requestAnimationFrame(frame);
