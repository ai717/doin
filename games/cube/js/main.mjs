// 入口装配：绑定指针/键盘/按钮意图，驱动状态机与 Canvas 渲染。语言切换只热更新，绝不重置魔方。

import { createAudio } from "./audio.mjs";
import { moveToTurn } from "./engine.mjs";
import * as Game from "./game.mjs";
import { loadLocale, saveLocale, strings } from "./i18n.mjs";
import { LEVEL_BY_ID, nextLevelId } from "./levels.mjs";
import { CubeRenderer, dragAngle, resolveDragTurn } from "./render.mjs";
import { scoreRound, starsFor } from "./score.mjs";
import {
  bestMsFor,
  levelRecord,
  load,
  recordSolve,
  rememberMode,
  save,
} from "./storage.mjs";
import {
  anyLayerOpen,
  applyStaticLocale,
  closeLayer,
  collectElements,
  openLayer,
  renderDeck,
  renderHud,
  renderLevels,
  renderModeButtons,
  renderModeTag,
  renderResult,
  showToast,
} from "./ui.mjs";

const els = collectElements();
const canvas = els.canvas;
const audio = createAudio();
const renderer = new CubeRenderer(canvas);

let locale = loadLocale();
let store = load();
let game = bootGame();
let anim = null;
let animating = false;
let drag = null;
let hintSpec = null;
let drawScheduled = false;
let lastOrbitSound = 0;
let lastResult = null;

audio.setMuted(store.prefs.muted);
applyStaticLocale(locale);
updateSoundButton();
renderer.resize();

function bootGame() {
  if (store.prefs.mode === "academy") return Game.createAcademyGame(store.prefs.lastLevel);
  if (store.prefs.size === 3) return Game.createDailyGame(3, todayKey());
  return Game.createFreeGame({ size: 2 });
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function t() {
  return strings(locale);
}

function requestDraw() {
  if (drawScheduled) return;
  drawScheduled = true;
  requestAnimationFrame(() => {
    drawScheduled = false;
    renderer.draw(game.cube, {
      layerTurn: anim,
      hint: hintSpec,
      solved: game.status === "solved",
    });
  });
}

function refresh() {
  renderHud(els, { state: game, locale, store, elapsed: Game.elapsedOf(game, nowMs()) });
  renderDeck(els, { state: game, locale, store });
  renderModeTag(els, { state: game, locale });
  renderModeButtons(els, game);
  requestDraw();
}

function refreshHudOnly() {
  renderHud(els, { state: game, locale, store, elapsed: Game.elapsedOf(game, nowMs()) });
}

function hintFromState() {
  const move = game.hint?.move;
  if (!move) return null;
  const spec = moveToTurn(game.cube, move);
  return { axis: spec.axis, layer: spec.layer };
}

function clearHint() {
  hintSpec = null;
}

function updateSoundButton() {
  const muted = audio.isMuted();
  els.soundBtn.setAttribute("aria-pressed", muted ? "false" : "true");
  els.soundBtn.textContent = muted ? "×" : "♪";
  els.soundBtn.setAttribute("aria-label", muted ? t().soundOff : t().soundOn);
}

function toggleSound() {
  audio.ensure();
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  store = { ...store, prefs: { ...store.prefs, muted } };
  save(store);
  updateSoundButton();
}

function switchMode(mode) {
  if (mode === "academy") {
    game = Game.createAcademyGame(store.prefs.lastLevel);
  } else if (mode === "3") {
    game = Game.createDailyGame(3, todayKey());
  } else {
    game = Game.createFreeGame({ size: 2 });
  }
  store = rememberMode(store, { size: game.size, mode: game.mode, levelId: game.levelId });
  save(store);
  anim = null;
  animating = false;
  hintSpec = null;
  lastResult = null;
  closeLayer(els.resultLayer);
  refresh();
  audio.ensure();
  audio.scrambleTick(2);
}

function doScramble() {
  if (game.mode === "academy") {
    doReset();
    return;
  }
  const seed = ((Date.now() >>> 0) ^ (game.size * 2654435761)) >>> 0;
  game = Game.scrambleGame(game, { size: game.size, seed });
  hintSpec = null;
  lastResult = null;
  closeLayer(els.resultLayer);
  playScrambleTicks();
  refresh();
  showToast(els, t().statusScramble);
}

function playScrambleTicks() {
  for (let i = 0; i < 7; i += 1) {
    setTimeout(() => audio.scrambleTick(i), i * 55);
  }
}

function doReset() {
  game = Game.resetGame(game);
  hintSpec = null;
  lastResult = null;
  anim = null;
  animating = false;
  closeLayer(els.resultLayer);
  refresh();
  showToast(els, t().statusReset);
  audio.ensure();
  audio.snap(0.8);
}

function doUndo() {
  if (animating) {
    showToast(els, t().statusLocked);
    return;
  }
  const { state, event } = Game.undo(game, nowMs());
  if (event === "ignored") {
    showToast(els, t().statusNoUndo);
    return;
  }
  game = state;
  clearHint();
  refresh();
  showToast(els, t().statusUndo);
  audio.snap(0.7);
}

function doHint() {
  if (game.status === "solved") {
    showToast(els, t().statusHintSolved);
    return;
  }
  const { state, hint } = Game.requestHint(game);
  game = state;
  hintSpec = hintFromState();
  if (!hint) {
    showToast(els, t().statusHintSolved);
    return;
  }
  showToast(els, t().statusHint.replace("{0}", moveLabel(hint.move)));
  audio.ensure();
  audio.hint();
  requestDraw();
}

function moveLabel(move) {
  if (!move) return "";
  return `${move.face}${move.amount === 2 ? "2" : move.amount === 3 ? "'" : ""}`;
}

function animateTurn(spec, { fromAngle = 0, onDone = null } = {}) {
  if (animating) return;
  animating = true;
  const target = (spec.quarters * Math.PI) / 2;
  const startAngle = Number.isFinite(fromAngle) ? fromAngle : 0;
  const duration = Math.max(60, 190);
  const started = nowMs();
  anim = { axis: spec.axis, layer: spec.layer, angle: startAngle };

  function frame() {
    const progress = Math.min(1, (nowMs() - started) / duration);
    const eased = 1 - (1 - progress) ** 3;
    anim = { axis: spec.axis, layer: spec.layer, angle: startAngle + (target - startAngle) * eased };
    requestDraw();
    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }
    anim = null;
    animating = false;
    const outcome = Game.playTurn(game, spec, nowMs());
    game = outcome.state;
    clearHint();
    audio.snap(Math.abs(spec.quarters) === 2 ? 1.4 : 1);
    if (outcome.event === "solved") onSolved();
    refresh();
    if (onDone) onDone();
  }

  requestAnimationFrame(frame);
}

function onSolved() {
  const ms = Math.max(1, game.elapsedMs);
  const level = game.mode === "academy" ? LEVEL_BY_ID[game.levelId] : null;
  const previousBest = game.mode === "academy"
    ? (levelRecord(store, game.levelId)?.bestMs ?? 0)
    : bestMsFor(store, game.size);
  const score = scoreRound({ size: game.size, moves: game.moveCount, ms });
  const stars = level ? starsFor({ moves: game.moveCount, par: level.par }) : 0;
  const isRecord = previousBest <= 0 || ms < previousBest;

  store = recordSolve(store, {
    outcome: "clear",
    size: game.size,
    mode: game.mode,
    levelId: game.levelId,
    dailyKey: game.dailyKey,
    ms,
    moves: game.moveCount,
    score,
    stars,
  });
  save(store);

  lastResult = {
    ms,
    moves: game.moveCount,
    score,
    stars,
    isRecord,
    best: game.mode === "academy"
      ? (levelRecord(store, game.levelId)?.bestMs ?? ms)
      : bestMsFor(store, game.size),
  };
  els.resultNext.hidden = !(game.mode === "academy" && nextLevelId(game.levelId));
  renderResult(els, { locale, ...lastResult });
  openLayer(els.resultLayer);
  audio.win();
  showToast(els, t().statusSolvedToast, 2200);
}

function pickLevel(levelId) {
  game = Game.createAcademyGame(levelId);
  store = rememberMode(store, { size: 3, mode: "academy", levelId });
  save(store);
  hintSpec = null;
  lastResult = null;
  closeLayer(els.levelsLayer);
  closeLayer(els.resultLayer);
  refresh();
  if (game.status === Game.STATUS.READY) resumeIfIdle();
}

function nextAcademyLevel() {
  const next = nextLevelId(game.levelId);
  if (!next) {
    closeLayer(els.resultLayer);
    return;
  }
  pickLevel(next);
}

function openLevels() {
  game = Game.pauseTimer(game, nowMs());
  renderLevels(els, { locale, store, state: game });
  openLayer(els.levelsLayer);
  refreshHudOnly();
}

function closeLevels() {
  closeLayer(els.levelsLayer);
  resumeIfIdle();
}

function openHelp() {
  game = Game.pauseTimer(game, nowMs());
  openLayer(els.helpLayer);
  refreshHudOnly();
}

function closeHelp() {
  closeLayer(els.helpLayer);
  resumeIfIdle();
}

function resumeIfIdle() {
  if (anyLayerOpen(els)) return;
  if (game.status === Game.STATUS.RUNNING && game.paused) {
    game = Game.resumeTimer(game, nowMs());
    refreshHudOnly();
  }
}

function switchLanguage() {
  locale = locale === "zh" ? "en" : "zh";
  saveLocale(locale);
  applyStaticLocale(locale);
  updateSoundButton();
  if (!els.levelsLayer.hidden) renderLevels(els, { locale, store, state: game });
  if (lastResult && !els.resultLayer.hidden) renderResult(els, { locale, ...lastResult });
  refresh();
}

function closeAllLayers() {
  if (!els.levelsLayer.hidden) closeLevels();
  if (!els.helpLayer.hidden) closeHelp();
  if (!els.resultLayer.hidden) closeLayer(els.resultLayer);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onPointerDown(event) {
  audio.ensure();
  event.preventDefault();
  try {
    canvas.setPointerCapture?.(event.pointerId);
  } catch {
    // 指针捕获失败时仍可在画布内拖动
  }
  if (event.button === 2 || event.altKey) {
    drag = { mode: "orbit", lastX: event.clientX, lastY: event.clientY };
    return;
  }
  const point = canvasPoint(event);
  const hit = renderer.pick(point.x, point.y);
  if (!hit) {
    drag = { mode: "orbit", lastX: event.clientX, lastY: event.clientY };
    return;
  }
  if (animating || game.status === Game.STATUS.SOLVED) return;
  drag = {
    mode: "layer",
    startX: point.x,
    startY: point.y,
    hit,
    active: false,
    turn: null,
    angle: 0,
  };
}

function onPointerMove(event) {
  if (!drag) return;
  if (drag.mode === "orbit") {
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    renderer.orbit(dx, dy);
    requestDraw();
    const stamp = nowMs();
    if (stamp - lastOrbitSound > 150) {
      lastOrbitSound = stamp;
      audio.orbit();
    }
    return;
  }

  const point = canvasPoint(event);
  const dx = point.x - drag.startX;
  const dy = point.y - drag.startY;

  if (!drag.active) {
    if (Math.hypot(dx, dy) < 7) return;
    const dirs = [0, 1, 2].map((axis) => renderer.screenAxis(drag.hit.cubie, axis));
    const turn = resolveDragTurn({
      normal: drag.hit.normal,
      dirs,
      point: drag.hit.cubie.p,
      dx,
      dy,
      pxPerQuarter: Math.max(58, Math.min(150, renderer.width * 0.17)),
    });
    if (!turn) return;

    drag.active = true;
    drag.turn = turn;
  }

  drag.angle = dragAngle(drag.turn, dx, dy);
  anim = { axis: drag.turn.axis, layer: drag.turn.layer, angle: drag.angle };
  requestDraw();
}

function onPointerUp() {
  if (!drag) return;
  if (drag.mode === "layer" && drag.active) {
    const from = drag.angle;
    const spec = { axis: drag.turn.axis, layer: drag.turn.layer, quarters: 0 };
    const turns = Math.max(-1, Math.min(1, Math.round(from / (Math.PI / 2))));
    spec.quarters = turns;
    drag = null;
    anim = null;
    if (turns === 0) {
      animating = true;
      const started = nowMs();
      const duration = 150;
      const step = () => {
        const progress = Math.min(1, (nowMs() - started) / duration);
        const eased = 1 - (1 - progress) ** 3;
        anim = { axis: spec.axis, layer: spec.layer, angle: from * (1 - eased) };
        requestDraw();
        if (progress < 1) requestAnimationFrame(step);
        else {
          anim = null;
          animating = false;
          requestDraw();
        }
      };
      requestAnimationFrame(step);
      return;
    }
    animateTurn(spec, { fromAngle: from });
    return;
  }
  drag = null;
}

function onKeyDown(event) {
  if (event.key === "Escape") {
    closeAllLayers();
    return;
  }
  const target = event.target;
  if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
  if (anyLayerOpen(els)) return;

  if (event.key === "z" || event.key === "Z") {
    doUndo();
    return;
  }
  const face = event.key.toUpperCase();
  if (!"URFDLB".includes(face) || face.length !== 1) return;
  if (animating || (drag && drag.active)) return;
  const move = { face, amount: event.shiftKey ? 3 : 1 };
  const spec = moveToTurn(game.cube, move);
  event.preventDefault();
  animateTurn(spec);
}

// ---------- 事件绑定 ----------

els.modeButtons.forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.mode));
});
els.scrambleBtn.addEventListener("click", doScramble);
els.resetBtn.addEventListener("click", doReset);
els.undoBtn.addEventListener("click", doUndo);
els.hintBtn.addEventListener("click", doHint);
els.soundBtn.addEventListener("click", toggleSound);
els.langBtn.addEventListener("click", switchLanguage);
els.helpBtn.addEventListener("click", openHelp);
els.levelsBtn.addEventListener("click", openLevels);
els.levelsBtn2.addEventListener("click", openLevels);
els.levelsClose.addEventListener("click", closeLevels);
els.levelsDone.addEventListener("click", closeLevels);
els.levelsLayer.addEventListener("click", (event) => {
  if (event.target === els.levelsLayer) closeLevels();
});
els.helpClose.addEventListener("click", closeHelp);
els.helpDone.addEventListener("click", closeHelp);
els.helpLayer.addEventListener("click", (event) => {
  if (event.target === els.helpLayer) closeHelp();
});
els.resultClose.addEventListener("click", () => {
  closeLayer(els.resultLayer);
});
els.resultAgain.addEventListener("click", doReset);
els.resultNext.addEventListener("click", nextAcademyLevel);
els.freeRow.addEventListener("click", (event) => {
  const card = event.target.closest("[data-free-mode]");
  if (!card) return;
  closeLayer(els.levelsLayer);
  switchMode(card.dataset.freeMode);
});
els.academyList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-level]");
  if (!card) return;
  pickLevel(card.dataset.level);
});

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("keydown", onKeyDown);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game = Game.pauseTimer(game, nowMs());
    refreshHudOnly();
  } else {
    resumeIfIdle();
  }
});
window.addEventListener("blur", () => {
  game = Game.pauseTimer(game, nowMs());
  refreshHudOnly();
});
window.addEventListener("focus", () => {
  resumeIfIdle();
});

const observer = new ResizeObserver(() => {
  renderer.resize();
  requestDraw();
});
observer.observe(canvas);

setInterval(() => {
  const running = game.status === Game.STATUS.RUNNING && !game.paused;
  if (running) refreshHudOnly();
}, 50);

function start() {
  renderer.resize();
  refresh();
}

requestAnimationFrame(start);
window.addEventListener("resize", () => {
  renderer.resize();
  requestDraw();
});
