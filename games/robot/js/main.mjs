// main.mjs - wiring only: preferences, controller, view, persistence and the
// portal handshake. No game rules and no rendering logic live here.

import { createGameController, isUnlocked } from "./game.mjs";
import { createUi } from "./ui.mjs";
import { DEFAULT_LOCALE, errorText, htmlLang, normalizeLocale, translate } from "./i18n.mjs";
import { setMuted, sfx } from "./audio.mjs";
import {
  clearDraft, loadDraft, loadLastLevel, loadLocale, loadProgress, loadSound,
  recordLevel, saveDraft, saveLastLevel, saveLocale, saveSound,
} from "./storage.mjs";
import { getLevel, LEVELS } from "./levels.mjs";

const PORTAL_META_KEY = "doin.meta.v1";

function reportClear(view, outcome) {
  const payload = {
    slug: "robot",
    outcome: "WON",
    score: view.stars * 100 + (view.lines <= view.par ? 50 : 0),
    stars: view.stars,
    timestamp: Date.now(),
  };
  try {
    const raw = localStorage.getItem(PORTAL_META_KEY);
    const meta = raw ? JSON.parse(raw) : {};
    meta.recentlyPlayed = [
      payload.slug,
      ...(Array.isArray(meta.recentlyPlayed) ? meta.recentlyPlayed.filter((s) => s !== payload.slug) : []),
    ].slice(0, 8);
    if (outcome?.improved) meta.totalStars = (Number(meta.totalStars) || 0) + payload.stars;
    localStorage.setItem(PORTAL_META_KEY, JSON.stringify(meta));
  } catch {
    // Storage may be blocked; the game itself is unaffected.
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload }, "*");
    }
  } catch {
    // Cross-origin sandbox: ignore.
  }
}

// A draft saved before a level's palette changed must not smuggle in tiles the
// player cannot pick any more.
function sanitize(program, entry) {
  if (!program || typeof program !== "object") return null;
  const allowed = new Set(entry.palette);
  const keep = (list) => (Array.isArray(list) ? list.map((c) => (allowed.has(c) ? c : "")) : []);
  return { main: keep(program.main), proc1: keep(program.proc1) };
}

export function boot(doc = globalThis.document) {
  let locale = normalizeLocale(loadLocale() || DEFAULT_LOCALE);
  let soundOn = loadSound();
  setMuted(!soundOn);

  let ui = null;
  let resultShown = false;
  let lastDraftKey = "";
  let ready = false;

  const controller = createGameController({
    schedule: (fn, ms) => setTimeout(fn, ms),
    cancel: (id) => clearTimeout(id),
    onChange(view) {
      ui?.render(view);
      if (view.status === "running" || view.status === "idle" || view.status === "paused") {
        resultShown = false;
      }
      const key = `${view.levelId}:${view.program.main.join(",")}|${view.program.proc1.join(",")}`;
      // The controller emits once during construction, before any draft has
      // been loaded; saving then would wipe the stored draft for level 1.
      if (ready && key !== lastDraftKey) {
        lastDraftKey = key;
        saveDraft(view.levelId, view.program);
      }
      if (view.settled && !resultShown) settle(view);
    },
  });

  function settle(view) {
    resultShown = true;
    if (view.status === "won") {
      const outcome = recordLevel(view.levelId, view.lines);
      ui.showResult(view, outcome);
      reportClear(view, outcome);
      for (let i = 0; i < Math.max(1, view.stars); i += 1) sfx.star(i);
      return;
    }
    if (view.status === "error") {
      ui.toast(errorText(locale, view.state.error));
      sfx.error();
      return;
    }
    ui.toast(translate(locale, "failShortHint"));
  }

  function startLevel(id, opts = {}) {
    const target = getLevel(id) ? id : LEVELS[0].id;
    if (!isUnlocked(loadProgress(), target) && !opts.force) {
      ui.toast(translate(locale, "toastLocked"));
      sfx.error();
      return false;
    }
    const entry = getLevel(target);
    const draft = opts.program ?? sanitize(loadDraft(target), entry);
    resultShown = false;
    lastDraftKey = "";
    ui.hideResult?.();
    ui.hideLevels?.();
    controller.start(target, { program: draft ?? {} });
    saveLastLevel(target);
    if (opts.toast !== false) sfx.run();
    return true;
  }

  function onAction(name, value) {
    switch (name) {
      case "run":
        if (controller.view().status === "running") {
          controller.pause();
        } else if (!controller.run()) {
          ui.toast(translate(locale, "toastRunFirst"));
        } else {
          sfx.run();
        }
        break;
      case "step":
        if (controller.step()) sfx.step();
        break;
      case "reset":
        controller.reset();
        break;
      case "clear":
        if (controller.clear()) {
          ui.toast(translate(locale, "toastCleared"));
          sfx.remove();
        }
        break;
      case "speed":
        controller.cycleSpeed();
        break;
      case "levels":
        ui.showLevels(loadProgress());
        break;
      case "closeLevels":
        ui.hideLevels();
        break;
      case "level":
        startLevel(Number(value));
        break;
      case "nextLevel": {
        const next = controller.view().levelId + 1;
        if (getLevel(next)) startLevel(next);
        else ui.hideResult();
        break;
      }
      case "again":
        if (controller.view().status === "won" && getLevel(controller.view().levelId + 1)) {
          startLevel(controller.view().levelId + 1);
        } else {
          startLevel(controller.view().levelId, { force: true });
        }
        break;
      case "sound":
        soundOn = !soundOn;
        setMuted(!soundOn);
        saveSound(soundOn);
        ui.syncSound(soundOn);
        if (soundOn) sfx.pick();
        break;
      case "lang":
        locale = locale === "en" ? "zh" : "en";
        saveLocale(locale);
        ui.applyLocale(locale);
        ui.syncSound(soundOn);
        break;
      case "help":
        ui.showHelp();
        break;
      case "closeHelp":
        ui.hideHelp();
        break;
      default:
        break;
    }
  }

  ui = createUi({
    doc,
    controller,
    onAction,
    onSfx(name, arg) {
      const fn = sfx[name];
      if (typeof fn === "function") fn(arg);
    },
  });

  ui.start();
  ui.applyLocale(locale);
  ui.syncSound(soundOn);

  const saved = loadLastLevel();
  const startId = isUnlocked(loadProgress(), saved) ? saved : LEVELS[0].id;
  ready = true;
  startLevel(startId, { toast: false });

  // Portal debug handle. `game` must be a getter so it never points at a
  // stale controller instance.
  const handle = {
    get game() { return controller; },
    ui,
    view: () => controller.view(),
    state: () => controller.view().state,
    startLevel: (id) => startLevel(Number(id), { force: true }),
    openLevels: () => ui.showLevels(loadProgress()),
    progress: () => loadProgress(),
    place: (proc, slot, code) => controller.place(proc, slot, code),
    fill: (code) => ui.fillFromPalette(code),
    run: () => controller.run(),
    step: () => controller.step(),
    reset: () => controller.reset(),
    clear: () => controller.clear(),
    overlay: () => ui.currentOverlay(),
    applyLocale(next) {
      locale = normalizeLocale(next);
      saveLocale(locale);
      ui.applyLocale(locale);
      ui.syncSound(soundOn);
      return locale;
    },
    htmlLang: () => htmlLang(locale),
    clearDraft: (id) => clearDraft(Number(id)),
  };
  globalThis.__robot = handle;
  return handle;
}

if (globalThis.document?.querySelector?.("#workbench")) {
  boot(globalThis.document);
}
