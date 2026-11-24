// Assembly entry: wiring, DOM rendering, i18n hot update, timer and overlays.
// Game rules stay in engine/game; this file never computes puzzle logic.

import { CHAPTERS, LEVELS, levelById } from "./levels.mjs";
import { format, htmlLang, loadLocale, saveLocale, strings } from "./i18n.mjs";
import { createController } from "./game.mjs";
import { createAudio } from "./audio.mjs";
import { load as loadStore, save as saveStore, recordClear } from "./storage.mjs";
import { reportSession } from "./portal.mjs";

const $ = (id) => document.getElementById(id);
const store = loadStore();
const audio = createAudio();
const controller = createController({ levelId: store.progress.lastLevel, hint: store.prefs.hint });
audio.setMuted(store.prefs.muted);

let locale = loadLocale();
let drawerOpen = false;
let autoPaused = false; // only resume what the system paused
let resultShown = false;
let lastTick = 0;
let lastStatus = "statusReady";

function t(key, ...args) {
  return format(strings(locale)[key] ?? key, ...args);
}

function levelName(level) {
  return t(`chapter${level.rings}`) + " · " + (level.kind === "mid" ? t("midLevel") : t("fullLevel"));
}

function modeName(mode) {
  return t(mode === "link" ? "linkShort" : "unlinkShort");
}

function applyLocale(next) {
  locale = next;
  saveLocale(locale);
  const table = strings(locale);
  document.documentElement.lang = htmlLang(locale);
  document.title = table.docTitle;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (table[key] !== undefined) el.textContent = table[key];
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (table[key] !== undefined) el.setAttribute("aria-label", table[key]);
  });
  const langBtn = $("btn-lang");
  if (langBtn) langBtn.textContent = table.langShort;
  render(); // in-place repaint only; controller state untouched
}

function renderRings(snap) {
  const wrap = $("rings");
  const total = wrap.childElementCount;
  if (total !== snap.ringCount) {
    wrap.replaceChildren();
    for (let i = 0; i < snap.ringCount; i += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ring";
      btn.dataset.index = String(i);
      wrap.appendChild(btn);
    }
  }
  const legal = new Set(snap.legal);
  [...wrap.children].forEach((btn, i) => {
    const on = snap.rings[i] === 1;
    btn.classList.toggle("off", !on);
    btn.classList.toggle("legal", legal.has(i));
    btn.classList.toggle("hint-first", Boolean(snap.hintPath.length) && snap.hintPath[0] === i);
    btn.setAttribute("aria-label", t("ariaRingBtn", i + 1));
  });
}

function renderLevels(snap) {
  const list = $("chapter-list");
  list.replaceChildren();
  const best = store.progress.bestMoves;
  for (const chapter of CHAPTERS) {
    const block = document.createElement("div");
    block.className = "chapter-block";
    const title = document.createElement("h3");
    title.className = "chapter-title";
    title.textContent = t(`chapter${chapter.rings}`);
    block.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "level-grid";
    for (const level of LEVELS.filter((lv) => lv.chapter === chapter.id)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "level-btn" + (level.id === snap.levelId ? " current" : "");
      const stars = store.progress.bestStars[level.id] ?? 0;
      const bestText = best[level.id] ? `${t("best")} ${best[level.id]}` : "";
      btn.innerHTML = `<span>${modeName(level.mode)} · ${level.kind === "mid" ? t("midLevel") : t("fullLevel")}</span>` +
        `<span class="lv-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>` +
        (bestText ? `<span class="lv-best">${bestText}</span>` : "");
      btn.addEventListener("click", () => {
        controller.loadLevel(level.id);
        store.progress.lastLevel = level.id;
        store.prefs.mode = level.mode;
        saveStore(store);
        resultShown = false;
        closeDrawer();
        setStatus("statusReady");
        render();
      });
      grid.appendChild(btn);
    }
    block.appendChild(grid);
    list.appendChild(block);
  }
}

function fmtTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function setStatus(key) {
  lastStatus = key;
  $("status-text").textContent = t(key);
}

function render() {
  const snap = controller.snapshot();
  renderRings(snap);
  $("stat-moves").textContent = String(snap.moves);
  $("stat-optimal").textContent = String(snap.optimal);
  $("stat-time").textContent = fmtTime(snap.elapsedMs);
  $("stat-rings").textContent = `${snap.ringCount} · ${modeName(snap.mode)}`;
  const best = store.progress.bestMoves[snap.levelId];
  $("stat-best").textContent = best ? String(best) : "—";
  $("level-name").textContent = levelName(snap.level);
  $("btn-hint").textContent = snap.hint ? t("hintOn") : t("hintOff");
  $("btn-pause").textContent = snap.paused ? t("resume") : t("pause");
  $("status-text").textContent = t(lastStatus);
  if (drawerOpen) renderLevels(snap);
}

function openDrawer() {
  drawerOpen = true;
  $("level-drawer").hidden = false;
  controller.setPaused(true);
  render();
}

function closeDrawer() {
  drawerOpen = false;
  $("level-drawer").hidden = true;
  if (!autoPaused && !resultShown) controller.setPaused(false);
  render();
}

function showResult(snap) {
  resultShown = true;
  const cleared = recordClear(store, snap.levelId, snap.moves, snap.stars);
  Object.assign(store, { progress: cleared.state.progress });
  saveStore(store);
  reportSession({ outcome: "WON", score: snap.optimal * 100, stars: snap.stars });
  $("result-stars").textContent = "★".repeat(snap.stars) + "☆".repeat(3 - snap.stars);
  $("result-sub").textContent = t("resultSub", snap.moves, snap.optimal);
  $("result-rating").textContent = t(["starsOne", "starsTwo", "starsThree"][snap.stars - 1]);
  $("result-badge").hidden = !cleared.isBestMoves;
  $("btn-next").hidden = snap.levelId === LEVELS[LEVELS.length - 1].id;
  $("result-layer").hidden = false;
  setStatus("statusDone");
  render();
}

function hideResult() {
  $("result-layer").hidden = true;
  resultShown = false;
  render();
}

function doMove(index) {
  const result = controller.moveRing(index);
  if (result.event === "illegal") {
    audio.reject();
    setStatus("statusLocked");
    render();
    return;
  }
  if (!result.changed) return;
  const down = controller.snapshot().rings[index] === 0;
  audio[down ? "linkDown" : "linkUp"](controller.moves);
  setStatus("statusMove");
  render();
  if (result.event === "win") {
    audio.win(controller.snapshot().ringCount);
    window.setTimeout(() => showResult(controller.snapshot()), 480);
  }
}

function play(fn) {
  try { fn(); } catch (error) { /* audio must never break control flow */ }
}

function bind() {
  $("rings").addEventListener("click", (event) => {
    const btn = event.target.closest(".ring");
    if (!btn) return;
    play(() => doMove(Number(btn.dataset.index)));
  });
  $("btn-levels").addEventListener("click", () => (drawerOpen ? closeDrawer() : openDrawer()));
  $("btn-levels-close").addEventListener("click", closeDrawer);
  $("level-drawer").addEventListener("click", (event) => {
    if (event.target === $("level-drawer")) closeDrawer();
  });
  $("btn-mode").addEventListener("click", () => openDrawer());
  $("btn-hint").addEventListener("click", () => {
    const on = controller.setHint(!controller.snapshot().hint);
    store.prefs.hint = on;
    saveStore(store);
    setStatus(on ? "hintTip" : "statusReady");
    render();
  });
  $("btn-undo").addEventListener("click", () => play(() => {
    if (controller.undo().changed) audio.paper();
    render();
  }));
  $("btn-reset").addEventListener("click", () => play(() => {
    if (controller.reset().changed) audio.paper();
    resultShown = false;
    $("result-layer").hidden = true;
    setStatus("statusReady");
    render();
  }));
  const togglePause = () => {
    if (drawerOpen || resultShown) return;
    const paused = controller.togglePause();
    autoPaused = false;
    $("pause-layer").hidden = !paused;
    render();
  };
  $("btn-pause").addEventListener("click", togglePause);
  $("btn-resume").addEventListener("click", togglePause);
  $("btn-sound").addEventListener("click", () => {
    const muted = audio.setMuted(!audio.isMuted());
    store.prefs.muted = muted;
    saveStore(store);
    render();
  });
  $("btn-lang").addEventListener("click", () => applyLocale(locale === "zh" ? "en" : "zh"));
  $("btn-next").addEventListener("click", () => {
    controller.loadNext();
    store.progress.lastLevel = controller.levelId;
    saveStore(store);
    hideResult();
    setStatus("statusReady");
    render();
  });
  $("btn-replay").addEventListener("click", () => {
    controller.reset();
    hideResult();
    setStatus("statusReady");
    render();
  });
  $("btn-result-levels").addEventListener("click", () => { hideResult(); openDrawer(); });
  $("btn-result-close").addEventListener("click", hideResult);
  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.toLowerCase();
    if (/^[1-9]$/.test(key)) { play(() => doMove(Number(key) - 1)); return; }
    if (key === "z") { play(() => { if (controller.undo().changed) audio.paper(); render(); }); return; }
    if (key === "r") { play(() => { controller.reset(); hideResult(); setStatus("statusReady"); render(); }); return; }
    if (key === "h") { $("btn-hint").click(); return; }
    if (key === "p" || key === "escape" || key === " ") {
      event.preventDefault();
      if (!drawerOpen && !resultShown) togglePause();
    }
  });

  const pauseForSystem = () => {
    if (!controller.paused && !resultShown && !drawerOpen) {
      controller.setPaused(true);
      autoPaused = true;
      $("pause-layer").hidden = false;
      render();
    }
  };
  const resumeFromSystem = () => {
    if (autoPaused) {
      autoPaused = false;
      controller.setPaused(false);
      $("pause-layer").hidden = true;
      render();
    }
  };
  document.addEventListener("visibilitychange", () => (document.hidden ? pauseForSystem() : resumeFromSystem()));
  window.addEventListener("blur", pauseForSystem);
  window.addEventListener("focus", resumeFromSystem);

  window.setInterval(() => {
    const now = performance.now();
    const dt = lastTick ? now - lastTick : 0;
    lastTick = now;
    const before = controller.snapshot().elapsedMs;
    controller.tick(dt);
    if (controller.snapshot().elapsedMs !== before) {
      $("stat-time").textContent = fmtTime(controller.snapshot().elapsedMs);
    }
  }, 250);
}

applyLocale(locale);
bind();
render();
window.__rings = { controller, get snapshot() { return controller.snapshot(); }, get locale() { return locale; } };
