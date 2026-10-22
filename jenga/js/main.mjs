// 叠叠乐 · 入口装配（唯一允许触碰 DOM 的装配层）
// rAF 主循环 → 控制器 step（内部 120Hz 固定步长）→ 事件分发（音效 / 渲染 / 黑板 / 浮层）→ 存档。
//
// 语言切换只走 ui.applyLocale + 重画：不 reload、不重建控制器，当前这座塔毫秒不差地活着。

import { JengaGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { loadSave, saveSave, clearSave, recordClear, recordRun } from "./storage.mjs";
import { loadLocale, saveLocale, strings, format } from "./i18n.mjs";
import { initAudio, setAudioEnabled, playEvent } from "./audio.mjs";
import { pullableBlocks, STATUS, MODE, PER_LAYER } from "./engine.mjs";
import { LEVELS, TOTAL_LEVELS, RIDDLE_QUESTIONS, findLevel } from "./levels.mjs";
import { multiplierFor } from "./score.mjs";

const RESULT_DELAY = 0.85; // 塌落定局到弹结算的缓冲（秒）
const ROUND_DELAY = 1.6; // 对决换局缓冲
const RIDDLE_DELAY = 1.2; // 解谜换题缓冲

function boot() {
  const canvas = document.getElementById("tower");
  if (!canvas) return null;

  let save = loadSave();
  let lang = loadLocale();
  const renderer = createRenderer(canvas);
  const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setReduced(reduceMotion);

  const game = new JengaGame({ mode: save.mode ?? MODE.SPIRE, levelIndex: save.lastLevel });
  let delayTimer = 0;
  let delayTask = null;
  let audioReady = false;
  let hover = null;
  let focusIndex = 0;
  let hudKey = "";
  let pendingReset = 0;

  // ------------------------------------------------------------ 影子 bookkeeping

  function pullables() {
    return pullableBlocks(game.state);
  }

  function focused() {
    const list = pullables();
    if (!list.length) return null;
    if (focusIndex >= list.length) focusIndex = 0;
    return list[focusIndex];
  }

  function cycleFocus(dir) {
    const list = pullables();
    if (!list.length) return;
    focusIndex = (focusIndex + dir + list.length) % list.length;
  }

  // ------------------------------------------------------------ UI 装配

  const ui = createUI({
    getSave: () => save,
    onOpenHelp: () => {
      ui.setOverlay("help");
      playEvent("ui_click");
    },
    onCloseHelp: () => {
      ui.setOverlay("none");
      playEvent("ui_click");
    },
    onOpenLevels: () => {
      game.paused = true;
      ui.refreshLevels();
      ui.setOverlay("levels");
      playEvent("ui_click");
    },
    onCloseLevels: () => {
      ui.setOverlay("none");
      syncFreeze();
      playEvent("ui_click");
    },
    onPickLevel: (index) => {
      const level = findLevel(index);
      if (!level || index > save.unlocked) {
        ui.toast("toastLocked", {}, true);
        return;
      }
      unlockAudio();
      game.startLevel(index);
      save.lastLevel = index;
      saveSave(save);
      ui.setOverlay("none");
      syncFreeze();
      renderer.clearDust();
      playEvent("ui_click");
    },
    onMode: (mode) => {
      unlockAudio();
      game.setMode(mode);
      save.mode = mode;
      saveSave(save);
      ui.setOverlay("none");
      syncFreeze();
      renderer.clearDust();
      playEvent("ui_click");
    },
    onStack: (slot) => {
      unlockAudio();
      game.stack(slot);
    },
    onCancel: () => {
      game.cancelPull();
      playEvent("ui_click");
    },
    onRestart: () => {
      unlockAudio();
      game.restart();
      ui.setOverlay("none");
      syncFreeze();
      renderer.clearDust();
      hover = null;
      playEvent("ui_click");
    },
    onRotate: (dir) => {
      renderer.rotate(dir * 0.26);
      playEvent("ui_click");
    },
    onZoom: (dir) => {
      renderer.zoomBy(dir > 0 ? 1.12 : 0.89);
      playEvent("ui_click");
    },
    onPause: () => togglePause(),
    onResume: () => {
      ui.setOverlay("none");
      syncFreeze();
      playEvent("ui_click");
    },
    onNextLevel: () => {
      unlockAudio();
      const next = Math.min(TOTAL_LEVELS, (game.level?.index ?? 1) + 1);
      if (next > save.unlocked) {
        ui.toast("toastLocked", {}, true);
        ui.setOverlay("levels");
        return;
      }
      game.startLevel(next);
      save.lastLevel = next;
      saveSave(save);
      ui.setOverlay("none");
      syncFreeze();
      renderer.clearDust();
      playEvent("ui_click");
    },
    onToggleSound: () => {
      save.sound = !save.sound;
      setAudioEnabled(save.sound);
      ui.setSound(save.sound);
      saveSave(save);
      if (save.sound) {
        unlockAudio();
        playEvent("ui_click");
      }
    },
    onToggleLang: () => {
      lang = lang === "zh" ? "en" : "zh";
      saveLocale(lang);
      ui.applyLocale(lang);
      ui.setSound(save.sound);
      syncHud(true);
      playEvent("ui_click");
    },
    onOverlayChange: () => syncFreeze(),
    onResetSave: () => {
      const now = Date.now();
      if (now - pendingReset < 3200) {
        pendingReset = 0;
        clearSave();
        save = loadSave();
        setAudioEnabled(save.sound);
        ui.setSound(save.sound);
        ui.refreshLevels();
        syncHud(true);
        ui.toast("saveCleared");
      } else {
        pendingReset = now;
        ui.toast("saveResetConfirm", {}, true);
      }
      playEvent("ui_click");
    }
  });

  // ------------------------------------------------------------ 浮层冻结

  function syncFreeze() {
    const freeze = ui.isFreezing(ui.currentOverlay());
    if (freeze) {
      game.paused = true;
    } else if (ui.currentOverlay() !== "pause") {
      game.paused = false;
    }
  }

  function togglePause() {
    unlockAudio();
    const next = ui.currentOverlay() === "pause" ? "none" : "pause";
    ui.setOverlay(next);
    game.paused = next === "pause";
    playEvent("ui_click");
    return game.paused;
  }

  // ------------------------------------------------------------ 事件分发

  function schedule(delay, task) {
    delayTimer = delay;
    delayTask = task;
  }

  game.subscribe((ev) => {
    switch (ev.type) {
      case "pull":
        playEvent("pull", { intensity: ev.intensity });
        break;
      case "stack":
        playEvent("stack", { slot: ev.slot });
        break;
      case "cancel":
        playEvent("ui_click");
        break;
      case "creak":
        playEvent("creak", { danger: ev.danger });
        break;
      case "gust":
        playEvent("gust");
        ui.toast("toastGust");
        break;
      case "streak":
        playEvent("streak", { streak: ev.streak });
        if (ev.streak >= 2) ui.toast("toastStreak", { n: ev.streak, m: multiplierFor(ev.streak) });
        break;
      case "spire":
        playEvent("spire");
        ui.toast("toastSpire");
        break;
      case "load_pull":
        ui.toast("toastLoad", {}, true);
        break;
      case "collapse":
        playEvent("collapse");
        break;
      case "handover":
        playEvent("ui_click");
        break;
      case "round_end":
        ui.toast("duelRoundWin", { n: ev.winner + 1 });
        if (!game.duel?.seriesOver) schedule(ROUND_DELAY, () => game.nextDuelRound());
        break;
      case "series_end":
        playEvent("win");
        schedule(ROUND_DELAY, () => {
          saveSave(recordRun(save, { score: game.score, layers: game.maxLayers, streak: 0, attempts: 1 }));
          ui.showResult({ won: true, score: game.score, layers: game.maxLayers, streak: 0, level: { index: 0 } });
        });
        break;
      case "riddle_answer":
        if (ev.correct) playEvent("correct");
        else playEvent("wrong");
        schedule(RIDDLE_DELAY, () => {
          const more = game.nextRiddle();
          if (!more) return;
          renderer.clearDust();
        });
        break;
      case "riddle_done":
        playEvent("win");
        save.riddlePlayed += 1;
        save.riddleBest = Math.max(save.riddleBest, ev.correct);
        saveSave(save);
        ui.showResult({ won: true, score: game.score, correct: ev.correct, level: { index: 0 } });
        break;
      case "finished":
        onFinished(ev);
        break;
      case "blocked":
        playEvent("blocked");
        break;
      default:
        break;
    }
  });

  function onFinished(res) {
    if (res.won) {
      playEvent("win");
      save = recordClear(save, res.level, res.stars, { score: res.score, layers: res.layers, streak: res.streak });
    } else {
      save = recordRun(save, { score: res.score, layers: res.layers, streak: res.streak, attempts: 1 });
    }
    saveSave(save);
    ui.refreshLevels();
    schedule(RESULT_DELAY, () => ui.showResult(res));
  }

  // ------------------------------------------------------------ HUD

  function hudPayload() {
    const snap = game.snapshot();
    return {
      ...snap,
      bestLayers: save.bestLayers,
      slots: game.availableSlots(),
      hasNext: Boolean(snap.level?.index) && snap.level.index < TOTAL_LEVELS
    };
  }

  function syncHud(force = false) {
    const payload = hudPayload();
    const key = [
      payload.score, payload.streak, payload.mult, payload.layers, Math.round(payload.danger * 40),
      payload.held, payload.status, (payload.slots ?? []).join(""), payload.mode, payload.duel?.round,
      payload.riddle?.index, payload.level?.index, lang, payload.bestLayers
    ].join("|");
    if (!force && key === hudKey) return;
    hudKey = key;
    ui.renderHud(payload);
  }

  // ------------------------------------------------------------ 输入

  function unlockAudio() {
    if (audioReady) return;
    audioReady = initAudio();
    setAudioEnabled(save.sound);
  }

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function viewOptions() {
    const list = pullables();
    const focus = focused();
    const ids = new Set();
    for (const piece of list) ids.add(piece.id);
    return {
      marked: game.marked,
      pullableIds: ids,
      hoverId: hover?.kind === "block" ? hover.id : null,
      hoverSlot: hover?.kind === "slot" ? hover.slot : null,
      focusId: focus ? focus.id : null,
      slotIds: game.state.status === STATUS.HOLDING ? game.availableSlots() : [],
      danger: game.state.danger,
      spire: game.spire
    };
  }

  const pointers = new Map();
  let dragging = false; // 正在拖拽转视角（抓空起手才允许）
  let rotateArmed = false; // 按下点抓空 → 随后的拖动才转视角
  let dragStart = { x: 0, y: 0 };
  let dragDist = 0; // 距按下点的最大位移：区分"点选"与"拖动"
  let pinchDist = 0;

  canvas.addEventListener("pointerdown", (event) => {
    unlockAudio();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture?.(event.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      dragging = false;
      rotateArmed = false;
      dragDist = Infinity; // 捏合结束后不补一次点击
      return;
    }
    dragStart = { x: event.clientX, y: event.clientY };
    dragDist = 0;
    dragging = false;
    // 转视角只认"抓空"：按在木块/槽位上时，拖动永远不转视角——否则点选时手一抖
    // 塔就跟着鼠标乱转，抽块的手感全毁（用户反馈：一直跟随鼠标旋转，不合理）。
    // 想转视角：拖空白处、用 ◀▶ 按钮或方向键。
    const p = localPoint(event);
    rotateArmed = !renderer.hitTest(p.x, p.y, game.state, {
      alwaysSlots: game.state.status === STATUS.HOLDING
    });
  });

  canvas.addEventListener("pointermove", (event) => {
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) renderer.zoomBy(d / pinchDist);
      pinchDist = d;
      return;
    }
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    dragDist = Math.max(dragDist, Math.abs(dx) + Math.abs(dy));
    if (!dragging && rotateArmed && dragDist > 7) dragging = true;
    if (dragging) {
      renderer.rotate(dx * 0.008);
      dragStart = { x: event.clientX, y: event.clientY };
      return;
    }
    updateHover(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    pointers.delete(event.pointerId);
    // 只有"按住没动"才算点选：从木块上起手拖开（误拖）不抽块，也不转视角。
    if (!dragging && dragDist <= 7) {
      updateHover(event);
      handleClick(hover);
    }
    dragging = false;
    rotateArmed = false;
    pinchDist = 0;
  });

  canvas.addEventListener("pointercancel", () => {
    pointers.clear();
    dragging = false;
    rotateArmed = false;
    pinchDist = 0;
  });

  canvas.addEventListener("pointerleave", () => {
    hover = null;
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    renderer.zoomBy(event.deltaY < 0 ? 1.08 : 0.93);
  }, { passive: false });

  function updateHover(event) {
    const p = localPoint(event);
    hit = renderer.hitTest(p.x, p.y, game.state, {
      alwaysSlots: game.state.status === STATUS.HOLDING
    });
    hover = hit;
    canvas.style.cursor = hit ? "pointer" : "grab";
  }

  let hit = null;

  function handleClick(target) {
    if (!target || ui.currentOverlay() !== "none") return;
    if (target.kind === "slot") {
      game.stack(target.slot);
      return;
    }
    const piece = pullables().find((p) => p.layer === target.layer && p.slot === target.slot);
    if (!piece) {
      ui.toast("toastIllegal", {}, true);
      playEvent("blocked");
      return;
    }
    focusIndex = Math.max(0, pullables().findIndex((p) => p.id === piece.id));
    game.pull(piece.layer, piece.slot);
  }

  function onKeyDown(event) {
    unlockAudio();
    const key = event.key;
    if (key === "ArrowLeft" || key === "a" || key === "A") {
      renderer.rotate(-0.22);
      event.preventDefault();
      return;
    }
    if (key === "ArrowRight" || key === "d" || key === "D") {
      renderer.rotate(0.22);
      event.preventDefault();
      return;
    }
    if (key === "ArrowUp" || key === "w" || key === "W") {
      renderer.zoomBy(1.08);
      event.preventDefault();
      return;
    }
    if (key === "ArrowDown" || key === "s" || key === "S") {
      renderer.zoomBy(0.93);
      event.preventDefault();
      return;
    }
    if (key === "1" || key === "2" || key === "3") {
      game.stack(Number(key) - 1);
      return;
    }
    if (key === "Tab") {
      event.preventDefault();
      cycleFocus(event.shiftKey ? -1 : 1);
      return;
    }
    if (key === " ") {
      event.preventDefault();
      if (game.state.status === STATUS.HOLDING) {
        const slots = game.availableSlots();
        game.stack(slots.includes(1) ? 1 : slots[0] ?? 0);
      } else {
        const piece = focused();
        if (piece) game.pull(piece.layer, piece.slot);
      }
      return;
    }
    if (key === "Escape") {
      if (ui.currentOverlay() === "help") ui.setOverlay("none");
      else if (ui.currentOverlay() === "levels") {
        ui.setOverlay("none");
        syncFreeze();
      } else if (game.state.status === STATUS.HOLDING) game.cancelPull();
      else togglePause();
      return;
    }
    if (key === "r" || key === "R") {
      game.restart();
      hover = null;
      renderer.clearDust();
      return;
    }
    if (key === "p" || key === "P") togglePause();
    if (key === "h" || key === "H") ui.setOverlay(ui.currentOverlay() === "help" ? "none" : "help");
  }

  globalThis.addEventListener?.("keydown", onKeyDown);
  globalThis.addEventListener?.("resize", () => renderer.resize());
  if (typeof ResizeObserver === "function") new ResizeObserver(() => renderer.resize()).observe(canvas);

  // ------------------------------------------------------------ 主循环

  let last = 0;

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;

    if (delayTimer > 0) {
      delayTimer -= dt;
      if (delayTimer <= 0 && delayTask) {
        const task = delayTask;
        delayTask = null;
        task();
      }
    }

    game.step(dt);
    syncHud();
    renderer.draw(game.state, { dt: game.paused ? 0 : dt, ...viewOptions() });
    requestAnimationFrame(frame);
  }

  ui.applyLocale(lang);
  ui.setSound(save.sound);
  setAudioEnabled(save.sound);
  ui.refreshLevels();
  syncHud(true);
  renderer.resize();
  requestAnimationFrame(frame);

  const handle = {
    get game() {
      return game;
    },
    get ui() {
      return ui;
    },
    renderer,
    getSave: () => save,
    getLang: () => lang,
    setLang: (next) => {
      lang = next;
      saveLocale(next);
      ui.applyLocale(next);
      syncHud(true);
    },
    getView: () => renderer.getView(),
    getHud: () => hudPayload(),
    tr: (key, values) => format(lang, key, values ?? {}),
    strings: () => strings(lang),
    startLevel: (index) => game.startLevel(index),
    restart: () => game.restart(),
    setMode: (mode) => game.setMode(mode),
    pullables,
    levels: LEVELS,
    totalLevels: TOTAL_LEVELS,
    riddleTotal: RIDDLE_QUESTIONS,
    perLayer: PER_LAYER
  };
  globalThis.__jenga = handle;
  return handle;
}

const handle = typeof document !== "undefined" && document.getElementById("tower") ? boot() : null;

export { boot };
export default handle;
