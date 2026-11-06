// main.mjs —— 装配入口：把 game/engine 的状态机接到 canvas、WebAudio 与 DOM，编排四种玩法与扎巷坊。
// 这一层只做输入路由与存档提交；玩法判定一律在 engine，视图刷新一律在 ui。

import { LAYOUTS, LEVEL_COUNT } from "./levels.mjs";
import { createGame, hudOf } from "./game.mjs";
import { createRenderer, drawBench } from "./render.mjs";
import { createUi } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import { createBench } from "./bench.mjs";
import { decodeRows } from "./code.mjs";
import { dirIndex } from "./engine.mjs";
import { loadLocale, saveLocale } from "./i18n.mjs";
import * as store from "./storage.mjs";

const STEP = 1000 / 60;
/** 主线与自定义巷固定种子：layout 本身已定，种子只影响影魅抖动，锁死让同一条巷子可复现 */
const SEED = 20260915;
/** 第⑤道验收要真跑整局（一轮数百毫秒），只在点「影子试跑 / 保存 / 进巷子」时按这个档数跑 */
const PROBE_RUNS = 4;

const REDUCED = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)").matches : false;

const ui = createUi(document);
const audio = createAudio({ muted: false });
const renderer = createRenderer(ui.el.board, { reducedMotion: REDUCED });
const el = ui.el;
const tr = (key, params) => ui.tr(key, params);

let data = store.load();
let game = null;
let offEvents = null;
const bench = createBench();
let report = bench.check();
let gate = null;
/** menu = 灯棚待机（纸巷当背景）· play = 走巷 · result = 结算幕布 · bench = 扎巷坊 */
let phase = "menu";
let helpReturn = "ready";
let lastSettleView = null;

audio.setMuted(data.muted);

// ---------------------------------------------------------------- 开局与换场

function startGame(spec) {
  if (offEvents) offEvents();
  lastSettleView = null;
  const seed = spec.mode === "campaign" || spec.mode === "workshop" ? SEED : (Date.now() >>> 0);
  game = createGame({ layoutTable: LAYOUTS, assist: data.assist, seed, ...spec });
  offEvents = game.on(onEvent);
  phase = "play";
  ui.setWorkshop(false);
  ui.showVeil(null);
  ui.setPhaseButtons({ paused: false, over: false });
  renderer.reset();
  audio.resetDotScale();
  audio.curtain();
  paintHud();
}

function paintMenu() {
  ui.paintHud({
    hud: hudOf(game),
    mode: "campaign",
    levelId: data.last,
    records: data.records,
    stars: store.totalStars(data),
  });
}

function prepareMenu() {
  if (offEvents) offEvents();
  offEvents = null;
  phase = "menu";
  game = createGame({ mode: "campaign", levelId: data.last, layoutTable: LAYOUTS, assist: data.assist, seed: SEED });
  ui.setWorkshop(false);
  el.btnStart.textContent = tr(data.last > 1 ? "btnContinue" : "btnStart");
  ui.showVeil("ready");
  renderer.reset();
  paintMenu();
}

function openModes() {
  ui.buildModes({
    current: game?.mode ?? "campaign",
    unlocked: {
      campaign: true,
      timed: store.modeUnlocked(data, "timed"),
      survival: store.modeUnlocked(data, "survival"),
      workshop: true,
    },
    onPick: pickMode,
  });
  ui.showVeil("modes");
}

function pickMode(mode) {
  if (mode === "workshop") openBench();
  else startGame({ mode });
}

function openLevels() {
  ui.buildLevels({
    current: game?.mode === "campaign" ? game.levelId : data.last,
    data,
    onPick: (id) => {
      audio.click();
      startGame({ mode: "campaign", levelId: id });
    },
  });
  ui.showVeil("levels");
}

// ---------------------------------------------------------------- HUD 与事件派发

function paintHud() {
  if (phase !== "play") return;
  const hud = hudOf(game);
  if (!hud) return;
  ui.paintHud({ hud, mode: game.mode, levelId: game.levelId, records: data.records, stars: store.totalStars(data) });
  ui.setPhaseButtons({ paused: hud.status === "paused", over: game.over });
  if (hud.status === "paused") ui.showVeil("paused");
  else if (!game.over) ui.showVeil(null);
}

const AUDIO_FX = {
  dot: "dot",
  pearl: "pearl",
  fright: "frightStart",
  frightWarn: "frightWarn",
  frightEnd: "frightEnd",
  dash: "dash",
  release: "release",
  phase: "phase",
  fruitIn: "fruitIn",
  fruit: "fruit",
  caught: "caught",
  respawn: "respawn",
  cleared: "cleared",
  lost: "lost",
  extraLife: "extraLife",
  time: "timeAdd",
  round: "round",
  refill: "refill",
  paused: "curtain",
  resumed: "curtain",
};

const RENDER_FX = new Set([
  "dot",
  "pearl",
  "eatGhost",
  "caught",
  "dash",
  "fright",
  "frightWarn",
  "cleared",
  "round",
  "release",
]);

function onEvent(e, g) {
  if (e.type === "eatGhost") audio.eatGhost(e.chain);
  else if (AUDIO_FX[e.type]) audio[AUDIO_FX[e.type]]();
  if (RENDER_FX.has(e.type)) renderer.fx(e.type, g.state, e);
}

function showSettle(view) {
  const local = { ...view };
  if (!local.cleared) local.note = tr(local.reason === "time" ? "lostTimeUp" : "lostExtinguished");
  ui.showResult(local, resultActions(local));
}

function settle(r) {
  if (!r) return;
  const prevHigh = data.records.highScore;
  data = commitResult(r);
  const view = { ...r };
  view.newBest = view.score > prevHigh;
  if (view.won) audio.won();
  lastSettleView = view;
  showSettle(view);
}

function commitResult(r) {
  if (r.mode === "campaign") {
    return store.recordLevel(data, r.levelId, {
      stars: r.stars,
      score: r.score,
      timeMs: r.timeMs,
      cleared: r.cleared,
      noDeath: r.detail?.noDeath === true,
    }).data;
  }
  if (r.mode === "timed") return store.recordTimed(data, { chain: r.lanesCleared, score: r.score, leftMs: r.leftMs });
  if (r.mode === "survival") {
    return store.recordSurvival(data, {
      rounds: r.round,
      score: r.score,
      longestTrain: r.longestTrain,
      ghostsEaten: r.ghostsEaten,
    });
  }
  if (r.mode === "workshop" && r.code) {
    return store.saveLane(data, {
      code: r.code,
      name: laneName(),
      dots: r.total,
      score: r.score,
      eaten: r.eaten,
      timeMs: r.timeMs,
      cleared: r.cleared,
    }).data;
  }
  return data;
}

function resultActions(r) {
  const acts = [];
  if (r.mode === "campaign") {
    if (r.cleared && r.levelId < LEVEL_COUNT) {
      acts.push({
        label: tr("btnNextWatch"),
        cls: "lit",
        on: () => startGame({ mode: "campaign", levelId: r.levelId + 1 }),
      });
      acts.push({ label: tr("btnLevels"), cls: "ghost", on: openLevels });
    } else {
      acts.push({ label: tr("btnRetry"), cls: "lit", on: () => startGame({ mode: "campaign", levelId: r.levelId }) });
    }
    acts.push({ label: tr("btnBackStage"), cls: "ghost", on: prepareMenu });
    return acts;
  }
  if (r.mode === "workshop") {
    acts.push({
      label: tr("btnRetry"),
      cls: "lit",
      on: () => startGame({ mode: "workshop", rows: bench.rows.slice(), code: r.code }),
    });
    acts.push({ label: tr("btnBackBench"), cls: "ghost", on: openBench });
    acts.push({ label: tr("btnBackStage"), cls: "ghost", on: prepareMenu });
    return acts;
  }
  acts.push({ label: tr("btnRetry"), cls: "lit", on: () => startGame({ mode: r.mode }) });
  acts.push({ label: tr("btnBackStage"), cls: "ghost", on: prepareMenu });
  return acts;
}

// ---------------------------------------------------------------- 主循环

let acc = 0;
let lastTs = 0;

function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(250, lastTs ? ts - lastTs : STEP);
  lastTs = ts;
  if (phase === "play" || phase === "result") {
    if (!game?.state) return;
    if (phase === "result" || game.over) {
      renderer.draw(game.state, dt);
      return;
    }
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 6) {
      game.step(STEP);
      acc -= STEP;
      guard += 1;
    }
    if (guard >= 6) acc = 0;
    renderer.draw(game.state, dt);
    paintHud();
    if (game.over) {
      phase = "result";
      settle(game.result ?? game.settle());
    }
    return;
  }
  if (phase === "bench") {
    paintBench();
    return;
  }
  if (game?.state) renderer.draw(game.state, dt);
}

// ---------------------------------------------------------------- 走巷输入

const KEY_DIR = {
  arrowup: "up",
  w: "up",
  arrowleft: "left",
  a: "left",
  arrowdown: "down",
  s: "down",
  arrowright: "right",
  d: "right",
};

function turn(name) {
  if (phase !== "play" || !game) return;
  if (!game.turn(dirIndex(name))?.applied) audio.deny();
}

function togglePause() {
  if (phase !== "play" || !game || game.over) return;
  const wasPaused = game.state.status === "paused";
  const r = wasPaused ? game.resume() : game.pause();
  if (!r?.applied) {
    audio.deny();
    return;
  }
  ui.showVeil(wasPaused ? null : "paused");
  audio.click();
}

function restartRun() {
  if (!game) return;
  game.restart();
  renderer.reset();
  audio.resetDotScale();
  phase = "play";
  ui.showVeil(null);
  ui.setPhaseButtons({ paused: false, over: false });
  audio.click();
  paintHud();
}

function onKey(ev) {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const tag = ev.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  const key = String(ev.key ?? "").toLowerCase();
  audio.unlock();
  if (KEY_DIR[key]) {
    ev.preventDefault();
    turn(KEY_DIR[key]);
    return;
  }
  if (key === " ") {
    // 焦点落在实体键上时把空格留给按钮本身（键盘可访问性）
    if (tag === "BUTTON" || tag === "A") return;
    ev.preventDefault();
    if (phase === "play") game?.dash();
    return;
  }
  if (key === "p" || key === "escape") {
    ev.preventDefault();
    if (!el.veilHelp.hidden) closeHelp();
    else if (key === "escape") openHelp();
    else if (phase === "play") togglePause();
    return;
  }
  if (key === "r") {
    ev.preventDefault();
    if (phase === "play" || phase === "result") restartRun();
    return;
  }
  if (key === "enter") {
    ev.preventDefault();
    if (phase === "menu") startGame({ mode: "campaign", levelId: data.last });
    else if (phase === "result") el.veilResult.querySelector(".veil-actions .knob")?.click();
  }
}

/** 触屏四向滑动：起手与放手够远才算一次转向，轻点不做任何事（免得误耗灯芯） */
let swipe = null;

function bindBoardGestures() {
  el.board.addEventListener("pointerdown", (ev) => {
    audio.unlock();
    swipe = phase === "play" ? { x: ev.clientX, y: ev.clientY } : null;
  });
  el.board.addEventListener("pointerup", (ev) => {
    if (!swipe) return;
    const dx = ev.clientX - swipe.x;
    const dy = ev.clientY - swipe.y;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  });
  el.board.addEventListener("pointercancel", () => {
    swipe = null;
  });
  el.dpad.addEventListener("click", (ev) => {
    const flute = ev.target.closest?.("[data-dir]");
    if (!flute) return;
    audio.unlock();
    turn(flute.dataset.dir);
  });
}

// ---------------------------------------------------------------- 扎巷坊

function openBench() {
  phase = "bench";
  if (offEvents) offEvents();
  offEvents = null;
  gate = null;
  ui.setWorkshop(true);
  ui.showVeil(null);
  ui.setNow(tr("modeWorkshop"));
  buildBrushes();
  buildSheets();
  buildLanes();
  refreshChecks();
  ui.showCode(bench.code(), laneName());
}

function buildBrushes() {
  ui.buildBrushes({
    current: bench.brush,
    onPick: (brush) => {
      bench.setBrush(brush);
      audio.brush();
      buildBrushes();
    },
  });
}

function buildSheets() {
  ui.buildSheets((id) => {
    bench.loadSheet(id);
    gate = null;
    audio.click();
    refreshChecks();
    ui.showCode(bench.code());
  });
}

function buildLanes() {
  ui.buildLanes(data.lanes, {
    onOpen: (code) => loadCode(code),
    onDrop: (code) => {
      data = store.dropLane(data, code).data;
      audio.click();
      buildLanes();
    },
  });
}

function laneName() {
  return (el.laneName.value ?? "").trim().slice(0, 24);
}

function refreshChecks() {
  report = bench.check();
  ui.showChecks(ui.checkRows(report, gate));
  ui.setBenchButtons({ canUndo: bench.canUndo, canRedo: bench.canRedo });
}

/** ①~④ 随编辑实时刷；⑤ 要真跑图，只在明按按钮（或保存/进巷子前）跑一次 */
function runProbe(then) {
  el.btnRehearse.disabled = true;
  ui.note(tr("btnRehearse"));
  requestAnimationFrame(() => {
    window.setTimeout(() => {
      gate = bench.probe(PROBE_RUNS);
      el.btnRehearse.disabled = false;
      refreshChecks();
      ui.note(gate.pass ? (gate.warn ? tr("vWarn") : tr("vOK")) : tr("vBad"));
      if (then && gate.pass) then();
    }, 0);
  });
}

function loadCode(input) {
  const decoded = decodeRows(input);
  if (!decoded.ok) {
    audio.deny();
    ui.note(tr("codeBad"));
    return;
  }
  bench.loadRows(decoded.rows);
  gate = null;
  refreshChecks();
  ui.showCode(bench.code());
  ui.note(report.ok ? tr("codeLoaded") : tr("codeLoadFail"));
}

async function copyCode() {
  const code = bench.code();
  try {
    if (!navigator.clipboard?.writeText || !code) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(code);
    ui.note(tr("codeCopied"));
  } catch {
    ui.note(tr("codeCopyFail"));
  }
}

function saveLane() {
  refreshChecks();
  if (!report.ok || (gate && !gate.pass)) {
    audio.deny();
    ui.note(tr("savedFail"));
    return;
  }
  if (!gate) {
    runProbe(saveLane);
    return;
  }
  const stats = report.stats ?? {};
  data = store.saveLane(data, {
    code: bench.code(),
    name: laneName(),
    dots: (stats.dots ?? 0) + (stats.pearls ?? 0),
  }).data;
  audio.click();
  ui.note(tr("savedOK"));
  buildLanes();
}

function playLane() {
  refreshChecks();
  if (!report.ok) {
    audio.deny();
    ui.note(tr("vBad"));
    return;
  }
  if (!gate) {
    runProbe(playLane);
    return;
  }
  if (!gate.pass) {
    audio.deny();
    ui.note(tr("vBad"));
    return;
  }
  startGame({ mode: "workshop", rows: bench.rows.slice(), code: bench.code() });
}

let benchBox = { ts: 20, ox: 0, oy: 0, width: 19, height: 21 };
let hover = null;
let painting = false;

function paintBench() {
  benchBox = drawBench(el.benchCanvas, {
    rows: bench.rows,
    problems: report.problems ?? [],
    hover,
    grid: bench.grid,
    reducedMotion: REDUCED,
    locale: ui.locale,
  });
}

function benchTile(ev) {
  const rect = el.benchCanvas.getBoundingClientRect();
  const x = Math.floor((ev.clientX - rect.left - benchBox.ox) / benchBox.ts);
  const y = Math.floor((ev.clientY - rect.top - benchBox.oy) / benchBox.ts);
  if (x < 0 || y < 0 || x >= benchBox.width || y >= benchBox.height) return null;
  return { x, y };
}

function bindBench() {
  const canvas = el.benchCanvas;
  canvas.addEventListener("pointerdown", (ev) => {
    if (phase !== "bench") return;
    ev.preventDefault();
    canvas.setPointerCapture?.(ev.pointerId);
    painting = true;
    bench.beginStroke();
    const t = benchTile(ev);
    hover = t;
    if (t) {
      bench.strokeTo(t.x, t.y);
      audio.brush();
      refreshChecks();
    }
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (phase !== "bench") return;
    const t = benchTile(ev);
    hover = t;
    if (!painting || !t) return;
    if (bench.strokeTo(t.x, t.y)) {
      audio.brush();
      refreshChecks();
    }
  });
  const lift = () => {
    if (!painting) return;
    painting = false;
    if (bench.endStroke()) {
      gate = null;
      refreshChecks();
      ui.showCode(bench.code());
    }
  };
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("pointerleave", () => {
    hover = null;
  });
}

// ---------------------------------------------------------------- 绑定与启动

function openHelp() {
  if (phase === "play" && game?.state?.status === "running") togglePause();
  helpReturn =
    phase === "menu"
      ? "ready"
      : phase === "result"
        ? "result"
        : phase === "bench" || game?.state?.status !== "paused"
          ? null
          : "paused";
  ui.showVeil("help");
  audio.click();
}

function closeHelp() {
  ui.showVeil(helpReturn);
}

function bindControls() {
  el.btnSound.addEventListener("click", () => {
    data = store.setMuted(data, !data.muted);
    audio.setMuted(data.muted);
    ui.setSound(!data.muted);
    audio.unlock();
    if (!data.muted) audio.click();
  });
  el.btnLang.addEventListener("click", () => {
    ui.setLocale(saveLocale(ui.locale === "zh" ? "en" : "zh"));
    audio.click();
    el.btnStart.textContent = tr(data.last > 1 ? "btnContinue" : "btnStart");
    if (phase === "bench") {
      buildBrushes();
      buildSheets();
      buildLanes();
      refreshChecks();
    } else if (!el.veilModes.hidden) openModes();
    else if (!el.veilLevels.hidden) openLevels();
    else if (phase === "result" && lastSettleView) showSettle(lastSettleView);
    else if (phase === "menu") paintMenu();
    else paintHud();
  });
  el.btnHelp.addEventListener("click", openHelp);
  el.btnCloseHelp.addEventListener("click", closeHelp);

  el.btnStart.addEventListener("click", () => startGame({ mode: "campaign", levelId: data.last }));
  el.btnModes.addEventListener("click", openModes);
  el.btnLevels.addEventListener("click", openLevels);
  el.btnCloseModes.addEventListener("click", () => ui.showVeil(phase === "menu" ? "ready" : null));
  el.btnCloseLevels.addEventListener("click", () => ui.showVeil(phase === "menu" ? "ready" : null));
  el.btnVeilResume.addEventListener("click", togglePause);
  el.btnVeilRestart.addEventListener("click", restartRun);

  el.btnDash.addEventListener("click", () => {
    audio.unlock();
    if (phase === "play") game?.dash();
  });
  el.btnPause.addEventListener("click", togglePause);
  el.btnRestart.addEventListener("click", restartRun);
  el.btnOpenLevels.addEventListener("click", openLevels);

  el.btnUndo.addEventListener("click", () => {
    if (!bench.undo()) return;
    gate = null;
    audio.click();
    refreshChecks();
    ui.showCode(bench.code());
  });
  el.btnRedo.addEventListener("click", () => {
    if (!bench.redo()) return;
    gate = null;
    audio.click();
    refreshChecks();
    ui.showCode(bench.code());
  });
  el.btnMirror.addEventListener("click", () => {
    if (!bench.mirrorAll()) return;
    gate = null;
    audio.brush();
    refreshChecks();
    ui.showCode(bench.code());
  });
  el.btnGrid.addEventListener("click", () => {
    ui.toggleBtn(el.btnGrid, bench.toggleGrid());
    audio.click();
  });
  el.btnClearSheet.addEventListener("click", () => {
    bench.clearSheet();
    gate = null;
    audio.click();
    refreshChecks();
    ui.showCode(bench.code());
  });
  el.btnLeaveBench.addEventListener("click", () => {
    audio.click();
    prepareMenu();
  });
  el.btnRehearse.addEventListener("click", () => runProbe(null));
  el.btnSaveLane.addEventListener("click", saveLane);
  el.btnPlayLane.addEventListener("click", playLane);
  el.btnCopyCode.addEventListener("click", copyCode);
  el.btnLoadCode.addEventListener("click", () => loadCode(el.codeInput.value));
  el.codeInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") loadCode(el.codeInput.value);
  });
  el.laneName.addEventListener("input", () => ui.showCode(bench.code(), laneName()));

  window.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", () => audio.unlock(), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && phase === "play" && game && !game.over) {
      game.pause();
      acc = 0;
    }
  });
}

ui.setLocale(loadLocale());
ui.setSound(!data.muted);
ui.toggleBtn(el.btnGrid, bench.grid);
ui.toggleBtn(el.btnMirror, bench.mirror);
bindControls();
bindBoardGestures();
bindBench();
prepareMenu();
requestAnimationFrame(frame);
