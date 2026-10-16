// Tank Assault - entry assembly: input, loop, view wiring.
import { TankGame, MODE_CAMPAIGN } from "./game.mjs";
import { Renderer } from "./render.mjs";
import { UI } from "./ui.mjs";
import * as audio from "./audio.mjs";
import { normalizeLang, otherLang, readLang, writeLang, langLabel } from "./i18n.mjs";

const KEY_DIRS = {
  ArrowUp: 0,
  ArrowRight: 1,
  ArrowDown: 2,
  ArrowLeft: 3,
  KeyW: 0,
  KeyD: 1,
  KeyS: 2,
  KeyA: 3,
};

function getStorageSafe() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function boot() {
  const root = document.getElementById("game-root");
  if (!root) return null;

  const game = new TankGame();
  const renderer = new Renderer(null);
  const ui = new UI({ root, game, renderer, audio });
  const store = getStorageSafe();
  let lang = normalizeLang(readLang(store) ?? "zh");

  audio.setMuted(game.data.muted);
  renderer.hints = game.data.hints !== false;
  ui.setLang(lang);

  const langBtn = document.getElementById("btn-lang");
  if (langBtn) langBtn.textContent = langLabel(lang);
  const soundBtn = document.getElementById("btn-sound");
  if (soundBtn) soundBtn.textContent = game.data.muted ? "🔇" : "🔊";

  /* ------------------------------------------------------------- game events */

  game.on((type, payload) => {
    if (type === "start") {
      renderer.setState(game.state);
      ui.clearTape();
      ui.showPlay();
    } else if (type === "finish") {
      ui.showResult(payload);
    }
  });

  /* ------------------------------------------------------------------- loop */

  let last = 0;
  let hudTick = 0;
  const step = (now) => {
    const dt = last === 0 ? 16 : Math.min(64, now - last);
    last = now;
    let scale = 1;
    if (game.slowMo > 0) {
      game.slowMo = Math.max(0, game.slowMo - dt / 1000);
      scale = 0.35;
    }
    const events = game.update(dt * scale);
    if (events) {
      for (const ev of events) {
        audio.playForEvent(ev);
        ui.describe(ev);
      }
      renderer.handleEvents(events);
    }
    renderer.update(dt);
    renderer.draw();
    if (game.state && ++hudTick % 5 === 0) ui.updateHud();
    globalThis.requestAnimationFrame(step);
  };
  globalThis.requestAnimationFrame(step);

  /* ----------------------------------------------------------------- clicks */

  const helpBtn = document.getElementById("btn-help");
  helpBtn?.addEventListener("click", () => {
    audio.initAudioOnGesture();
    audio.play("click");
    ui.showHelp();
  });

  langBtn?.addEventListener("click", () => {
    lang = otherLang(lang);
    writeLang(store, lang);
    ui.setLang(lang); // in-place swap: the running battle is untouched
    langBtn.textContent = langLabel(lang);
  });

  soundBtn?.addEventListener("click", () => {
    const muted = audio.toggleMuted();
    game.setMuted(muted);
    soundBtn.textContent = muted ? "🔇" : "🔊";
    if (!muted) audio.play("click");
  });

  /* --------------------------------------------------------------- keyboard */

  const held = new Set();
  const syncMove = () => {
    for (const code of held) {
      const dir = KEY_DIRS[code];
      if (dir !== undefined) {
        game.move(dir);
        return;
      }
    }
    game.stop();
  };

  const onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const dir = KEY_DIRS[event.code];
    if (dir !== undefined) {
      event.preventDefault?.();
      held.add(event.code);
      syncMove();
      return;
    }
    if (event.code === "Space" || event.code === "KeyJ") {
      event.preventDefault?.();
      audio.initAudioOnGesture();
      game.fire();
    } else if (event.code === "KeyK" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
      event.preventDefault?.();
      audio.initAudioOnGesture();
      game.order();
    } else if (event.code === "KeyP" || event.code === "Escape") {
      event.preventDefault?.();
      if (game.state && !game.paused) ui.showPause();
      else if (game.paused && ui.overlay === "pause") ui.showOverlay("none");
    } else if (event.code === "KeyR") {
      if (game.state) {
        ui.showOverlay("none");
        game.restart();
      }
    }
  };

  const onKeyUp = (event) => {
    if (KEY_DIRS[event.code] !== undefined) {
      held.delete(event.code);
      syncMove();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    held.clear();
    game.stop();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state && !game.paused) ui.showPause();
  });

  document.addEventListener("pointerdown", () => audio.initAudioOnGesture(), { once: true });

  window.addEventListener("resize", () => renderer.resize());
  window.addEventListener("orientationchange", () => renderer.resize());

  ui.showMenu();
  const app = { game, renderer, ui, audio, setLang: (value) => ui.setLang(value) };
  globalThis.__tank = app;
  return app;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

export { MODE_CAMPAIGN };
