// ui.mjs - DOM layer: plaque, instrument rail, drawer, help, results.
// It never mutates game rules; it renders snapshots and forwards intent.

import { htmlLang, translate } from "./i18n.mjs";
import { CHAPTERS, LEVELS, chapterLevels } from "./levels.mjs";

const LOOT_GLYPHS = {
  pie: "◕",
  donut: "◎",
  ring: "◯",
  crown: "▲",
  gold: "▤",
  sapphire: "◆",
  key: "⚿",
  mask: "☺",
  goblet: "♆",
  boots: "⬒",
  watch: "◷",
  cat: "◠",
  statue: "⛨",
  violin: "♪",
  codex: "▥",
  tiara: "✦",
  painting: "▢",
  mona: "▣",
  ledger: "▦",
  diamond: "◈",
};

const FAIL_KEYS = {
  laser: "failLaser",
  wire: "failWire",
  dog: "failDog",
  spot: "failSpot",
};

export function createUI({ game, renderer, handlers, locale = "zh" }) {
  const t = (key, vars) => translate(locale, key, vars);
  const refs = {
    canvas: document.getElementById("stage"),
    target: document.getElementById("target-name"),
    alarmLamps: document.getElementById("alarm-lamps"),
    alarmText: document.getElementById("alarm-text"),
    travel: document.getElementById("travel-value"),
    stageStars: document.getElementById("stage-stars"),
    shelf: document.getElementById("loot-shelf"),
    toast: document.getElementById("toast"),
    pauseLayer: document.getElementById("pause-layer"),
    drawer: document.getElementById("drawer"),
    grid: document.getElementById("level-grid"),
    result: document.getElementById("result"),
    resultTitle: document.getElementById("result-title"),
    resultNote: document.getElementById("result-note"),
    resultStars: document.getElementById("result-stars"),
    resultTravel: document.getElementById("result-travel"),
    sound: document.getElementById("btn-sound"),
    lang: document.getElementById("btn-lang"),
    pauseBtn: document.getElementById("btn-pause"),
  };

  let toastTimer = 0;
  let lastSnapshot = null;
  let shelfKey = "";

  function toast(message, ms = 2200) {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      refs.toast.hidden = true;
    }, ms);
  }

  function stars(n) {
    return "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));
  }

  function glyphFor(key) {
    return LOOT_GLYPHS[key] ?? "◆";
  }

  function buildGrid(snap) {
    if (!refs.grid) return;
    refs.grid.innerHTML = "";
    const cleared = snap?.progress?.cleared ?? {};
    const current = snap?.levelId ?? 1;
    for (const chapter of CHAPTERS) {
      const head = document.createElement("div");
      head.className = "grid-chapter";
      head.textContent = `${t("chapterLabel", { n: chapter.id })} · ${t(chapter.key)}`;
      refs.grid.appendChild(head);
      for (const level of chapterLevels(chapter.id)) {
        const unlocked = level.id === 1 || Boolean(cleared[level.id - 1]) || Boolean(cleared[level.id]);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "level-cell";
        button.dataset.level = String(level.id);
        button.dataset.locked = String(!unlocked);
        button.dataset.current = String(level.id === current);
        button.disabled = !unlocked;
        const name = t(`loot_${level.target.key}`);
        button.title = `${t("levelTag", { n: level.id })} · ${name}`;
        button.setAttribute("aria-label", `${t("levelTag", { n: level.id })} ${name}`);
        button.innerHTML = [
          `<span class="cell-index">${level.id}</span>`,
          `<span class="cell-loot">${glyphFor(level.target.key)}</span>`,
          `<span class="cell-stars">${stars(cleared[level.id] ?? 0)}</span>`,
        ].join("");
        if (!unlocked) {
          const lock = document.createElement("span");
          lock.className = "cell-lock";
          lock.textContent = t("locked");
          button.appendChild(lock);
        }
        button.addEventListener("click", () => handlers.startLevel?.(level.id));
        refs.grid.appendChild(button);
      }
    }
  }

  function renderShelf(snap) {
    const cleared = snap?.progress?.cleared ?? {};
    const keys = LEVELS.filter((level) => cleared[level.id]).map((level) => `${level.id}:${level.target.key}`);
    const signature = keys.join("|");
    if (!refs.shelf || signature === shelfKey) return;
    shelfKey = signature;
    refs.shelf.innerHTML = "";
    if (!keys.length) {
      const empty = document.createElement("span");
      empty.className = "shelf-empty";
      empty.textContent = t("lootEmpty");
      refs.shelf.appendChild(empty);
      return;
    }
    for (const entry of keys) {
      const [id, key] = entry.split(":");
      const badge = document.createElement("span");
      badge.className = "loot-badge";
      badge.textContent = glyphFor(key);
      badge.title = `${t(`loot_${key}`)} · ${t("starsOf", { n: cleared[id] ?? 0 })}`;
      refs.shelf.appendChild(badge);
    }
  }

  function sync(snap) {
    lastSnapshot = snap;
    if (!snap) return;
    if (refs.target) refs.target.textContent = `${glyphFor(snap.level?.target?.key)} ${t(`loot_${snap.level?.target?.key ?? "diamond"}`)}`;
    if (refs.travel) refs.travel.textContent = String(Math.round(snap.travelled ?? 0));
    if (refs.stageStars) refs.stageStars.textContent = stars(snap.stars ?? 0);
    if (refs.alarmLamps) refs.alarmLamps.dataset.level = String(snap.alarm ?? 0);
    if (refs.alarmText) {
      const key = snap.alarm === 2 ? "alarmHot" : snap.alarm === 1 ? "alarmWarm" : "alarmCalm";
      refs.alarmText.textContent = t(key);
    }
    if (refs.pauseLayer) refs.pauseLayer.hidden = !snap.paused || Boolean(snap.result);
    if (refs.pauseBtn) refs.pauseBtn.textContent = snap.paused ? t("btnResume") : t("btnPause");
    renderShelf(snap);
  }

  function setLocale(next) {
    locale = next;
    document.documentElement.lang = htmlLang(locale);
    document.title = t("docTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      el.setAttribute("aria-label", t(key));
    });
    if (refs.lang) refs.lang.textContent = locale === "en" ? "中文" : "EN";
    if (refs.sound) refs.sound.title = t("btnSound");
    if (lastSnapshot) {
      lastSnapshot = { ...lastSnapshot };
      shelfKey = "";
      sync(lastSnapshot);
    }
    buildGrid(lastSnapshot);
  }

  function setSound(on) {
    if (!refs.sound) return;
    refs.sound.classList.toggle("off", !on);
    refs.sound.textContent = on ? "♪" : "×";
    refs.sound.setAttribute("aria-label", t(on ? "soundOn" : "soundOff"));
  }

  function openDrawer() {
    if (!refs.drawer) return;
    buildGrid(lastSnapshot);
    refs.drawer.hidden = false;
  }

  function closeDrawer() {
    if (refs.drawer) refs.drawer.hidden = true;
  }

  function openHelp() {
    const el = document.getElementById("help");
    if (el) el.hidden = false;
  }

  function closeHelp() {
    const el = document.getElementById("help");
    if (el) el.hidden = true;
  }

  function showResult(result) {
    if (!refs.result || !result) return;
    refs.result.hidden = false;
    refs.resultTitle.textContent = t("winTitle");
    refs.resultNote.textContent = result.improved ? t("winNewBest") : "";
    refs.resultStars.textContent = stars(result.stars ?? 1);
    refs.resultTravel.textContent = String(result.travel ?? 0);
    const nextBtn = document.getElementById("btn-next");
    if (nextBtn) nextBtn.hidden = !result.hasNext;
  }

  function hideResult() {
    if (refs.result) refs.result.hidden = true;
  }

  function showFail(kind) {
    toast(t(FAIL_KEYS[kind] ?? "failTitle"), 1600);
  }

  // ---- pointer wiring -------------------------------------------------
  const canvas = refs.canvas;
  let activePointer = null;

  function stagePoint(event) {
    return renderer.toStage(event.clientX, event.clientY);
  }

  canvas?.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === "mouse") return;
    const point = stagePoint(event);
    if (!game.pointerDown(point)) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add("dragging");
    event.preventDefault();
  });

  canvas?.addEventListener("pointermove", (event) => {
    if (activePointer === null || event.pointerId !== activePointer) return;
    game.pointerMove(stagePoint(event));
    event.preventDefault();
  });

  const endDrag = (event) => {
    if (activePointer === null || (event && event.pointerId !== activePointer)) return;
    activePointer = null;
    canvas.classList.remove("dragging");
    game.pointerUp();
  };

  canvas?.addEventListener("pointerup", endDrag);
  canvas?.addEventListener("pointercancel", endDrag);
  canvas?.addEventListener("lostpointercapture", endDrag);
  canvas?.addEventListener("contextmenu", (event) => event.preventDefault());

  // ---- static controls ------------------------------------------------
  document.getElementById("btn-levels")?.addEventListener("click", () => {
    handlers.click?.();
    openDrawer();
  });
  document.getElementById("btn-drawer-close")?.addEventListener("click", () => {
    handlers.click?.();
    closeDrawer();
  });
  document.getElementById("btn-help")?.addEventListener("click", () => {
    handlers.click?.();
    openHelp();
  });
  document.getElementById("btn-help-close")?.addEventListener("click", () => {
    handlers.click?.();
    closeHelp();
  });
  document.getElementById("btn-retry")?.addEventListener("click", () => {
    handlers.click?.();
    handlers.restart?.();
  });
  document.getElementById("btn-restart-pause")?.addEventListener("click", () => {
    handlers.click?.();
    handlers.restart?.();
  });
  document.getElementById("btn-resume")?.addEventListener("click", () => {
    handlers.click?.();
    handlers.resume?.();
  });
  document.getElementById("btn-pause")?.addEventListener("click", () => {
    handlers.click?.();
    handlers.pauseToggle?.();
  });
  document.getElementById("btn-sound")?.addEventListener("click", () => handlers.toggleSound?.());
  document.getElementById("btn-lang")?.addEventListener("click", () => handlers.toggleLang?.());
  document.getElementById("btn-next")?.addEventListener("click", () => {
    handlers.click?.();
    hideResult();
    handlers.next?.();
  });
  document.getElementById("btn-replay")?.addEventListener("click", () => {
    handlers.click?.();
    hideResult();
    handlers.restart?.();
  });
  document.getElementById("btn-result-levels")?.addEventListener("click", () => {
    handlers.click?.();
    hideResult();
    openDrawer();
  });

  refs.drawer?.addEventListener("click", (event) => {
    if (event.target === refs.drawer) closeDrawer();
  });
  document.getElementById("help")?.addEventListener("click", (event) => {
    if (event.target.id === "help") closeHelp();
  });
  refs.result?.addEventListener("click", (event) => {
    if (event.target === refs.result) hideResult();
  });

  return {
    sync,
    setLocale,
    setSound,
    toast,
    openDrawer,
    closeDrawer,
    openHelp,
    closeHelp,
    showResult,
    hideResult,
    showFail,
    buildGrid,
    get drawerOpen() {
      return refs.drawer ? !refs.drawer.hidden : false;
    },
    get helpOpen() {
      const el = document.getElementById("help");
      return el ? !el.hidden : false;
    },
    get resultOpen() {
      return refs.result ? !refs.result.hidden : false;
    },
  };
}
