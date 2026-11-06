// Bomber - entry assembly: input, loop, view wiring.
import { BomberGame } from "./game.mjs";
import { Renderer } from "./render.mjs";
import { UI } from "./ui.mjs";
import * as audio from "./audio.mjs";
import { LANG_KEY, normalizeLang, otherLang, readLang, writeLang } from "./i18n.mjs";

const KEY_DIRS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};

function getStorageSafe() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function boot() {
  const root = document.getElementById("game-root");
  if (!root) return;

  const game = new BomberGame();
  const renderer = new Renderer(null);
  const ui = new UI({ root, game, renderer, audio });
  const store = getStorageSafe();
  let lang = normalizeLang(readLang(store) ?? "zh");
  audio.setMuted(game.data.muted);
  renderer.skin = game.data.skin;

  ui.setLang(lang);

  const eventSounds = {
    place: () => audio.play("place"),
    explode: () => audio.play("explode"),
    brick: () => audio.play("brick"),
    crack: () => audio.play("brick"),
    death: () => audio.play("death"),
    win: () => audio.play("win"),
    curse: () => audio.play("curse"),
    reveal_exit: () => audio.play("win"),
  };

  game.audioHook = (events) => {
    for (const event of events) {
      if (event.type === "pickup") audio.play("pickup", event.kind);
      else if (event.type === "kill") audio.play("kill", game.state?.chain ?? 0);
      else eventSounds[event.type]?.();
    }
    renderer.handleEvents(events);
  };

  game.on((type, payload) => {
    if (type === "start") {
      ui.showPlay();
    } else if (type === "finish") {
      ui.showResult(payload);
    } else if (type === "pause") {
      if (payload.paused) ui.showPause();
      else ui.closeOverlay();
    }
  });

  // ---------------------------------------------------------------- clicks

  const ACTIONS = {
    campaign: () => ui.showCampaign(),
    puzzle: () => ui.showPuzzle(),
    menu: () => ui.showMenu(),
    workshop: () => ui.showWorkshop(),
    close: () => ui.closeOverlay(),
    resume: () => game.setPaused(false),
    restart: () => {
      ui.closeOverlay();
      game.restart();
    },
    map: () => {
      ui.closeOverlay();
      ui.showCampaign();
    },
    next: () => {
      ui.closeOverlay();
      game.nextLevel();
    },
    retry: () => {
      ui.closeOverlay();
      game.restart();
    },
    pause: () => game.togglePause(),
    assist: () => {
      game.setAssist(!game.data.assist);
      renderer.assist = game.data.assist;
      ui.render();
    },
    bomb: () => game.drop(),
    remote: () => game.detonate(),
  };

  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const stage = target.closest("[data-stage]");
    if (stage) {
      audio.play("click");
      game.start("campaign", Number(stage.getAttribute("data-stage")));
      return;
    }
    const puzzle = target.closest("[data-puzzle]");
    if (puzzle) {
      audio.play("click");
      game.start("puzzle", Number(puzzle.getAttribute("data-puzzle")));
      return;
    }
    const actionBtn = target.closest("[data-action]");
    if (actionBtn) {
      const action = actionBtn.getAttribute("data-action");
      if (action !== "close") audio.play("click");
      ACTIONS[action]?.();
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (!target.closest("#overlay-layer")) return;
    if (target.classList.contains("overlay-backdrop")) {
      if (ui.overlay === "pause") game.setPaused(false);
      else ui.closeOverlay();
      return;
    }
    const unlock = target.closest("[data-unlock]");
    if (unlock) return; // handled inside the workshop overlay
    const actionBtn = target.closest("[data-action]");
    if (actionBtn) {
      const action = actionBtn.getAttribute("data-action");
      if (action !== "close") audio.play("click");
      ACTIONS[action]?.();
    }
  });

  // ---------------------------------------------------------------- top bar

  const langBtn = document.getElementById("btn-lang");
  langBtn?.addEventListener("click", () => {
    lang = otherLang(lang);
    writeLang(store, lang);
    ui.setLang(lang); // in-place text swap: the running board is untouched
  });

  const soundBtn = document.getElementById("btn-sound");
  soundBtn?.addEventListener("click", () => {
    const muted = audio.toggleMuted();
    game.setMuted(muted);
    soundBtn.textContent = muted ? "🔇" : "🔊";
  });
  if (soundBtn) soundBtn.textContent = game.data.muted ? "🔇" : "🔊";

  const helpBtn = document.getElementById("btn-help");
  helpBtn?.addEventListener("click", () => {
    audio.play("click");
    ui.showHelp();
  });

  // ---------------------------------------------------------------- keyboard

  // Press order matters: the most recent direction wins. A plain Set iterates in
  // insertion order, so holding Left and then tapping Up used to keep walking
  // Left until Left was released - which reads as "the keys are not responsive".
  const held = [];
  const syncInput = () => {
    for (let i = held.length - 1; i >= 0; i--) {
      const dir = KEY_DIRS[held[i]];
      if (dir) {
        game.move(dir[0], dir[1]);
        return;
      }
    }
    game.move(0, 0);
  };

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (KEY_DIRS[event.code]) {
      event.preventDefault();
      // auto-repeat must not reshuffle the priority stack
      if (!held.includes(event.code)) held.push(event.code);
      syncInput();
      return;
    }
    if (event.code === "Space" || event.code === "KeyJ") {
      event.preventDefault();
      audio.initAudioOnGesture();
      game.drop();
    } else if (event.code === "KeyK") {
      audio.initAudioOnGesture();
      game.detonate();
    } else if (event.code === "KeyP" || event.code === "Escape") {
      if (game.state && game.state.status === "playing") game.togglePause();
    } else if (event.code === "KeyR") {
      game.restart();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (KEY_DIRS[event.code]) {
      const index = held.indexOf(event.code);
      if (index >= 0) held.splice(index, 1);
      syncInput();
    }
  });

  window.addEventListener("blur", () => {
    held.length = 0;
    game.move(0, 0);
  });

  document.addEventListener("pointerdown", () => audio.initAudioOnGesture(), { once: true });

  window.addEventListener("resize", () => {
    renderer.resize();
  });
  window.addEventListener("orientationchange", () => renderer.resize());

  // ---------------------------------------------------------------- loop

  let last = performance.now();
  let hudTick = 0;
  const frame = (now) => {
    const dt = Math.min(64, now - last);
    last = now;
    if (game.state && !game.paused) game.update(dt);
    renderer.update(dt);
    renderer.draw();
    if (game.state && ++hudTick % 6 === 0) ui.updateHud();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  ui.showMenu();
  globalThis.__bomber = { game, renderer, ui, audio };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

export { LANG_KEY };
