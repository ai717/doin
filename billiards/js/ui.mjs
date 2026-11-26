// DOM layer: scoreboard, tray, overlays and every pointer / key gesture.
// Nothing here re-implements rules; it only forwards intents to the controller.

import { format, t, htmlLang, otherLang } from "./i18n.mjs";
import { BALL_R } from "./engine.mjs";

const PULL_RANGE = 7.5;      // world units of pull for full power
const MIN_SHOT_PULL = 0.45;  // ignore taps that were meant purely as aim
const KEY_AIM_STEP = 0.012;
const KEY_POWER_STEP = 0.045;
const CHARGE_RATE = 1.15;

export function createUI(hooks) {
  const byId = (id) => document.getElementById(id);
  const el = {
    title: byId("stage-title") ?? document.querySelector(".club-title"),
    backHome: byId("back-home"),
    sound: byId("btn-sound"),
    lang: byId("btn-lang"),
    help: byId("btn-help"),
    flag: byId("turn-flag"),
    chipTable: byId("chip-table"),
    chipPar: byId("chip-par"),
    chipShots: byId("chip-shots"),
    chipRun: byId("chip-run"),
    chipFouls: byId("chip-fouls"),
    chipGroup: byId("chip-group"),
    canvas: byId("felt"),
    toast: byId("toast"),
    placeBar: byId("place-bar"),
    placeDone: byId("btn-place-done"),
    placeAuto: byId("btn-place-auto"),
    powerFill: byId("power-fill"),
    powerRange: byId("power-range"),
    spinSet: byId("spin-set"),
    tables: byId("btn-tables"),
    restart: byId("btn-restart"),
    pause: byId("btn-pause"),
    menu: byId("ov-menu"),
    tablesOv: byId("ov-tables"),
    helpOv: byId("ov-help"),
    resultOv: byId("ov-result"),
    pauseOv: byId("ov-pause"),
    resultTitle: byId("result-title"),
    resultStars: byId("result-stars"),
    resShots: byId("res-shots"),
    resPar: byId("res-par"),
    resFouls: byId("res-fouls"),
    resRun: byId("res-run"),
    startBtn: byId("btn-start"),
    openTables: byId("btn-open-tables"),
    tablesClose: byId("btn-tables-close"),
    helpClose: byId("btn-help-close"),
    resultNext: byId("btn-result-next"),
    resultRetry: byId("btn-result-retry"),
    resultManual: byId("btn-result-manual"),
    resume: byId("btn-resume"),
    pauseRestart: byId("btn-pause-restart"),
    pauseMenu: byId("btn-pause-menu"),
    tableGrid: byId("table-grid"),
    optAim: byId("opt-aim"),
    optSpin: byId("opt-spin"),
    optSound: byId("opt-sound"),
  };

  let overlay = "none";
  let toastTimer = 0;
  let charging = false;
  let chargePower = 0;
  let drag = null;
  let pointerAim = null;

  const OVERLAYS = { menu: el.menu, tables: el.tablesOv, help: el.helpOv, result: el.resultOv, pause: el.pauseOv };

  function applyLocale(lang) {
    document.documentElement.lang = htmlLang(lang);
    const title = t("docTitle", lang);
    if (title) document.title = title;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      node.textContent = t(key, lang);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      const key = node.getAttribute("data-i18n-aria");
      node.setAttribute("aria-label", t(key, lang));
    });
    const langBtn = el.lang;
    if (langBtn) langBtn.textContent = lang === "en" ? t("langName", "zh") : "EN";
    document.querySelectorAll(".spin-btn").forEach((btn) => {
      const tip = btn.dataset.spin ? `spinTip_${btn.dataset.spin}` : null;
      if (tip) btn.title = t(tip, lang);
    });
  }

  function setOverlay(name) {
    overlay = OVERLAYS[name] ? name : "none";
    for (const [key, node] of Object.entries(OVERLAYS)) {
      if (!node) continue;
      node.hidden = key !== overlay;
    }
    return overlay;
  }

  function currentOverlay() {
    return overlay;
  }

  function setPowerBar(power) {
    const pct = Math.round(Math.max(0, Math.min(1, power)) * 100);
    if (el.powerFill) el.powerFill.style.width = `${pct}%`;
    if (el.powerRange && document.activeElement !== el.powerRange) el.powerRange.value = String(Math.max(5, pct));
  }

  function setSpinButtons(spin) {
    if (!el.spinSet) return;
    for (const btn of el.spinSet.querySelectorAll(".spin-btn")) {
      btn.classList.toggle("active", btn.dataset.spin === spin && spin !== "center");
    }
  }

  function setFlag(snapshot, lang) {
    if (!el.flag) return;
    if (snapshot.mode === "duel") {
      const name = snapshot.playerTurn === 0 ? t("player_a", lang) : t("player_b", lang);
      el.flag.textContent = format("turnFlag", lang, { p: name });
      el.flag.classList.toggle("p2", snapshot.playerTurn === 1);
    } else {
      el.flag.textContent = snapshot.tableId ? t(snapshot.tableId, lang) : t("gameTitle", lang);
      el.flag.classList.remove("p2");
    }
  }

  function groupLabel(snapshot, lang) {
    if (snapshot.mode === "clear") {
      const left = snapshot.objectLeft + snapshot.groupRemain.eight;
      return `${left}`;
    }
    const own = snapshot.groups[snapshot.playerTurn];
    if (!own) return `${snapshot.groupRemain.solid} / ${snapshot.groupRemain.stripe}`;
    const remain = own === "solid" ? snapshot.groupRemain.solid : snapshot.groupRemain.stripe;
    const label = own === "solid" ? t("group_solids", lang) : t("group_stripes", lang);
    const eightReady = remain === 0 && snapshot.groupRemain.eight === 1;
    return eightReady ? t("group_eight", lang) : `${label} ${remain}`;
  }

  function renderHud(snapshot, lang) {
    setFlag(snapshot, lang);
    const chips = [
      [el.chipTable, snapshot.mode === "clear" ? String(snapshot.tableIndex + 1) : "-"],
      [el.chipPar, snapshot.par != null ? String(snapshot.par) : "-"],
      [el.chipShots, String(snapshot.mode === "clear" ? snapshot.shots[0] : snapshot.shots[snapshot.playerTurn])],
      [el.chipRun, String(snapshot.run)],
      [el.chipFouls, String(snapshot.mode === "clear" ? snapshot.fouls[0] : snapshot.fouls[snapshot.playerTurn])],
      [el.chipGroup, groupLabel(snapshot, lang)],
    ];
    for (const [node, value] of chips) {
      if (node) node.textContent = value;
    }
    if (el.placeBar) el.placeBar.hidden = !(snapshot.ballInHand && snapshot.phase === "placing");
  }

  function toast(key, lang, vars, warn = false) {
    if (!el.toast) return;
    el.toast.textContent = key ? format(key, lang, vars ?? {}) : "";
    el.toast.classList.toggle("warn", warn);
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1900);
  }

  function buildTables(list, lang, currentId) {
    if (!el.tableGrid) return;
    el.tableGrid.textContent = "";
    for (const entry of list) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `table-card${entry.locked ? " locked" : ""}${entry.id === currentId ? " current" : ""}`;
      const title = document.createElement("b");
      title.textContent = t(entry.id, lang);
      const meta = document.createElement("span");
      meta.textContent = entry.locked
        ? t("lockedHint", lang)
        : `${t("ui_par", lang)} ${entry.par} · ${t("ui_left", lang)} ${entry.count}`;
      const stars = document.createElement("span");
      stars.className = "st";
      stars.textContent = entry.locked ? "" : "★".repeat(entry.stars) + "☆".repeat(3 - entry.stars);
      card.append(title, meta, stars);
      card.addEventListener("click", () => {
        if (entry.locked) {
          toast("lockedHint", lang, {}, true);
          return;
        }
        hooks.onPickTable?.(entry.id);
      });
      el.tableGrid.append(card);
    }
  }

  function showResult(payload, lang) {
    if (!el.resultOv) return;
    if (el.resultTitle) el.resultTitle.textContent = payload.title;
    if (el.resultStars) {
      const stars = el.resultStars.querySelectorAll("i");
      stars.forEach((star, i) => star.classList.toggle("on", i < (payload.stars ?? 0)));
    }
    if (el.resShots) el.resShots.textContent = String(payload.shots ?? 0);
    if (el.resPar) el.resPar.textContent = String(payload.par ?? 0);
    if (el.resFouls) el.resFouls.textContent = String(payload.fouls ?? 0);
    if (el.resRun) el.resRun.textContent = String(payload.bestRun ?? 0);
    if (el.resultNext) el.resultNext.hidden = !payload.hasNext;
    setOverlay("result");
  }

  function setOptions(options) {
    if (el.optAim) el.optAim.checked = Boolean(options.aimAssist);
    if (el.optSpin) el.optSpin.checked = Boolean(options.spinPreview);
    if (el.optSound) el.optSound.checked = Boolean(options.soundEnabled);
    if (el.sound) el.sound.classList.toggle("muted", !options.soundEnabled);
  }

  function setModeSelection(mode) {
    document.querySelectorAll(".mode-card").forEach((card) => {
      card.classList.toggle("active", card.dataset.mode === mode);
    });
  }

  // ------------------------------------------------------- gestures ----

  el.canvas?.addEventListener("pointerdown", (event) => {
    if (overlay !== "none") return;
    event.preventDefault();
    try { el.canvas.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointer */ }
    const state = hooks.getState();
    const p = hooks.toWorld(event.clientX, event.clientY);
    if (state.canPlace && state.cue) {
      drag = { mode: "place" };
      hooks.onPlace?.(p.x, p.y);
      return;
    }
    if (!state.canShoot) return;
    // Mouse: the hover aim is already settled, so pressing FREEZES the
    // direction. From then on dragging only charges power - the aim cannot
    // change until release, no matter where the pointer wanders.
    // Touch has no hover phase, so it slingshots: the ball fires away from
    // the drag and the aim follows the pull live.
    const touch = event.pointerType === "touch" || event.pointerType === "pen";
    drag = {
      mode: "pull",
      pull: 0,
      locked: !touch,
      startX: p.x,
      startY: p.y,
    };
    hooks.onPullStart?.();
  });

  el.canvas?.addEventListener("pointermove", (event) => {
    if (overlay !== "none") return;
    const state = hooks.getState();
    if (drag?.mode === "place") {
      const p = hooks.toWorld(event.clientX, event.clientY);
      hooks.onPlace?.(p.x, p.y);
      return;
    }
    if (!state.cue) return;
    const p = hooks.toWorld(event.clientX, event.clientY);
    if (drag?.mode === "pull") {
      if (drag.locked) {
        // Direction is frozen: any drag away from the press point charges.
        const dx = p.x - drag.startX;
        const dy = p.y - drag.startY;
        drag.pull = Math.min(1, Math.hypot(dx, dy) / PULL_RANGE);
        hooks.onPull?.(drag.pull);
        return;
      }
      // Slingshot (touch): shoot away from the drag, aim follows live.
      const vx = state.cue.x - p.x;
      const vy = state.cue.y - p.y;
      const len = Math.hypot(vx, vy);
      const angle = Math.atan2(vy, vx);
      pointerAim = angle;
      hooks.onAim?.(angle);
      drag.pull = Math.min(1, Math.max(0, (len - BALL_R * 2) / PULL_RANGE));
      hooks.onPull?.(drag.pull);
      return;
    }
    // Hover aiming (mouse only, never while charging). Dead zone around the
    // cue ball keeps the line from spinning when the cursor sits close.
    if (state.canShoot) {
      const vx = p.x - state.cue.x;
      const vy = p.y - state.cue.y;
      if (Math.hypot(vx, vy) > BALL_R * 3) {
        const angle = Math.atan2(vy, vx);
        pointerAim = angle;
        hooks.onAim?.(angle);
      }
    }
  });

  function endDrag(event) {
    if (!drag) return;
    const mode = drag.mode;
    const releasedPull = drag.pull;
    drag = null;
    hooks.onPullEnd?.();
    if (!event) return;
    if (mode === "pull" && releasedPull > 0.06) hooks.onShoot?.();
    if (mode === "place") hooks.onConfirmPlace?.();
  }

  el.canvas?.addEventListener("pointerup", endDrag);
  el.canvas?.addEventListener("pointercancel", endDrag);
  el.canvas?.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    hooks.onCycleSpin?.(1);
  });
  el.canvas?.addEventListener("wheel", (event) => {
    if (overlay !== "none") return;
    event.preventDefault();
    hooks.onPowerDelta?.(-Math.sign(event.deltaY) * KEY_POWER_STEP);
  }, { passive: false });

  document.addEventListener("keydown", (event) => {
    const key = event.key;
    if (key === "Escape") {
      if (overlay === "none") hooks.onPause?.(true);
      else hooks.onCloseOverlay?.();
      return;
    }
    if (overlay !== "none") return;
    if (key === "ArrowLeft" || key === "a" || key === "A") {
      hooks.onAimDelta?.(-KEY_AIM_STEP);
      event.preventDefault();
    } else if (key === "ArrowRight" || key === "d" || key === "D") {
      hooks.onAimDelta?.(KEY_AIM_STEP);
      event.preventDefault();
    } else if (key === "ArrowUp" || key === "w" || key === "W") {
      hooks.onPowerDelta?.(KEY_POWER_STEP);
      event.preventDefault();
    } else if (key === "ArrowDown" || key === "s" || key === "S") {
      hooks.onPowerDelta?.(-KEY_POWER_STEP);
      event.preventDefault();
    } else if (key === "Tab" || key === "q" || key === "Q") {
      hooks.onCycleSpin?.(1);
      event.preventDefault();
    } else if (key === "f" || key === "F") {
      hooks.onCycleSpin?.(-1);
      event.preventDefault();
    } else if (key === "Enter") {
      hooks.onConfirmPlace?.();
      event.preventDefault();
    } else if (key === " ") {
      if (!charging) {
        charging = true;
        chargePower = 0;
        hooks.onPullStart?.();
        hooks.onPull?.(0);
      }
      event.preventDefault();
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.key !== " " || !charging) return;
    charging = false;
    hooks.onPullEnd?.();
    if (chargePower <= 0.05) {
      hooks.onPower?.(hooks.getState().power);
      return;
    }
    hooks.onPower?.(chargePower);
    hooks.onShoot?.();
  });

  function tick(dt) {
    if (charging) {
      chargePower = Math.min(1, chargePower + dt * CHARGE_RATE);
      hooks.onPull?.(chargePower);
    }
  }

  // --------------------------------------------------------- buttons ----

  el.backHome?.addEventListener("click", (event) => {
    if (hooks.onNavigateHome?.() === false) event.preventDefault();
  });
  el.sound?.addEventListener("click", () => hooks.onToggleSound?.());
  el.lang?.addEventListener("click", () => hooks.onToggleLang?.());
  el.help?.addEventListener("click", () => hooks.onOpenOverlay?.("help"));
  el.tables?.addEventListener("click", () => hooks.onOpenOverlay?.("tables"));
  el.restart?.addEventListener("click", () => hooks.onRestart?.());
  el.pause?.addEventListener("click", () => hooks.onPause?.(true));
  el.resume?.addEventListener("click", () => hooks.onResume?.());
  el.pauseRestart?.addEventListener("click", () => hooks.onRestart?.());
  el.pauseMenu?.addEventListener("click", () => hooks.onOpenOverlay?.("tables"));
  el.helpClose?.addEventListener("click", () => hooks.onCloseOverlay?.());
  el.tablesClose?.addEventListener("click", () => hooks.onCloseOverlay?.());
  el.resultManual?.addEventListener("click", () => hooks.onOpenOverlay?.("tables"));
  el.resultRetry?.addEventListener("click", () => hooks.onRestart?.());
  el.resultNext?.addEventListener("click", () => hooks.onNext?.(false));
  el.startBtn?.addEventListener("click", () => hooks.onStart?.());
  el.openTables?.addEventListener("click", () => hooks.onOpenOverlay?.("tables"));
  el.placeDone?.addEventListener("click", () => hooks.onConfirmPlace?.());
  el.placeAuto?.addEventListener("click", () => hooks.onAutoPlace?.());
  el.powerRange?.addEventListener("input", () => {
    const value = Number(el.powerRange.value) / 100;
    hooks.onPower?.(value);
  });
  el.optAim?.addEventListener("change", () => hooks.onOption?.("aimAssist", el.optAim.checked));
  el.optSpin?.addEventListener("change", () => hooks.onOption?.("spinPreview", el.optSpin.checked));
  el.optSound?.addEventListener("change", () => hooks.onOption?.("soundEnabled", el.optSound.checked));
  el.spinSet?.addEventListener("click", (event) => {
    const btn = event.target.closest?.(".spin-btn");
    if (!btn) return;
    hooks.onSpin?.(btn.dataset.spin === hooks.getState().aim.spin ? "center" : btn.dataset.spin);
  });
  document.querySelectorAll(".mode-card").forEach((card) => {
    card.addEventListener("click", () => hooks.onMode?.(card.dataset.mode));
  });

  return {
    el,
    applyLocale,
    renderHud,
    toast,
    showResult,
    setOverlay,
    currentOverlay,
    setPowerBar,
    setSpinButtons,
    setOptions,
    setModeSelection,
    buildTables,
    tick,
    get pointerAngle() { return pointerAim; },
    otherLangOf: otherLang,
  };
}
