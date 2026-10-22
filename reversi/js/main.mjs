// 装配入口：把 storage / i18n / audio / game / ui 接起来，并驱动唯一的主循环。
//
// 边界：
//   · 这里只做"装配 + 意图转发 + 主循环 + 入档"，绝不碰 DOM 细节（全在 ui.mjs）、
//     绝不写规则（全在 engine / game）。
//   · 语言切换是热更新：切完立刻重绘文本，**绝不重开对局**。
//   · 影响盘面的偏好（档位 / 执子 / 开局 / 双人 / 闪电战 / 口径）改动即开新局；
//     纯显示类偏好（对手落点 / 静音 / 音量）只刷新，不动棋局。

import { createGame } from "./game.mjs";
import { createAudio } from "./audio.mjs";
import { createUI } from "./ui.mjs";
import {
  load, save, patchPrefs, applyOutcome, applyHighlights, applyPuzzleResult,
  applyRushResult, clearRecords, MODES,
} from "./storage.mjs";
import { loadLocale, saveLocale } from "./i18n.mjs";
import { OUTCOME_WIN, OUTCOME_LOSS, OUTCOME_DRAW, recordStars } from "./score.mjs";
import { BLACK, WHITE, EMPTY, RULES_WOF, RULES_CLASSIC } from "./engine.mjs";
import { PUZZLES } from "./puzzles.mjs";

const TICK_MS = 200;
// 改动即开新局的偏好（其余偏好只刷新显示）
const REBUILD_PREFS = ["tier", "side", "opening", "pvp", "blitz", "classic"];

let locale = loadLocale();
let store = load();
let roundConfig = null;
let armed = -1;
let drawing = false;
let recordedRound = false;

const audio = createAudio({ muted: store.prefs.muted });
const game = createGame();

const ui = createUI({
  audio,
  locale,
  handlers: {
    onCell: (index, pointerType) => handleCell(index, pointerType),
    onArm: (index) => {
      armed = index;
      ui.setPreview(index);
    },
    onMode: (mode) => startRound({ mode }),
    onPref: (key, value) => setPref(key, value),
    onUndo: () => handleUndo(),
    onHint: () => handleHint(),
    onResign: () => handleResign(),
    onRestart: () => startRound({}),
    onLevels: () => openLevels(),
    onPickPuzzle: (id) => startRound({ mode: MODES.PUZZLE, puzzleId: id }),
    onForecast: () => handleForecast(),
    onClearRecords: () => {
      store = clearRecords(store);
      persist();
      ui.buildLevels(store.records);
      draw();
    },
    onToggleSound: () => toggleSound(),
    onToggleLang: () => toggleLang(),
    onVolume: (value) => audio.setVolume(value),
  },
});

function currentCtx() {
  return {
    prefs: store.prefs,
    records: store.records,
    showMobility: store.prefs.showMobility,
  };
}

function persist() {
  save(store);
}

// 唯一的绘制出口：先入档再渲染，保证结算卡读到的是刚写下的纪录。
function draw() {
  const view = game.snapshot();
  if (view.over && !recordedRound) {
    recordedRound = true;
    recordRound(view);
  }
  ui.render(view, currentCtx());
}

// ── 开局 ─────────────────────────────────────────────────────────
function startRound(config = {}) {
  const mode = config.mode ?? roundConfig?.mode ?? store.prefs.mode;
  const prefs = store.prefs;
  const pvp = mode === MODES.PLAY ? Boolean(prefs.pvp) : false;
  const classic = pvp && Boolean(prefs.classic); // 经典口径仅本地双人可选（PRD 定案 4A）
  roundConfig = {
    mode,
    tier: prefs.tier,
    side: prefs.side,
    opening: prefs.opening,
    pvp,
    blitz: mode === MODES.PLAY ? Boolean(prefs.blitz) : false,
    rules: classic ? RULES_CLASSIC : RULES_WOF,
    puzzleId: config.puzzleId ?? null,
  };
  if (mode === MODES.PUZZLE && !roundConfig.puzzleId) roundConfig.puzzleId = firstOpenPuzzle();

  store = patchPrefs(store, { mode });
  persist();

  armed = -1;
  recordedRound = false;
  ui.resetRound();
  ui.setCtx(currentCtx());
  game.start(roundConfig);
  draw();
  driveAndDraw();
}

function firstOpenPuzzle() {
  // 计分层的 recordStars 吃的是"题目 id → 记录"子表，不是整个 records
  const unsolved = PUZZLES.find((puzzle) => recordStars(store.records.puzzle, puzzle.id) === 0);
  return (unsolved ?? PUZZLES[0]).id;
}

// ── 推进与动画 ───────────────────────────────────────────────────
async function driveAndDraw() {
  if (drawing) return;
  drawing = true;
  game.setVisualBusy(true);
  try {
    await game.advance();
    await ui.animate(game.drainEvents());
  } finally {
    game.setVisualBusy(false);
    drawing = false;
  }
  draw();
  // 动画期间玩家又点了一手（缓冲里最多压一手）：动画播完立即接上
  if (game.snapshot().pending !== null) await driveAndDraw();
}

function handleCell(index, pointerType) {
  audio.unlock();
  const view = game.snapshot();
  if (view.over) return;
  // 触屏 / 触控笔：第一下只瞄准，第二下才落子（PRD §3.2 的二次点按确认）
  const confirmMode = ui.wantsConfirm(pointerType);
  if (confirmMode && armed !== index) {
    armed = index;
    ui.setPreview(index);
    return;
  }
  armed = -1;
  const result = game.placement(index);
  if (result === "ignored" || result === "queued") return;
  driveAndDraw();
}

async function handleHint() {
  audio.unlock();
  const before = game.snapshot();
  const ok = await game.hint();
  await ui.animate(game.drainEvents());
  if (!ok) {
    // 区分"次数用完了"与"这局面没有可用提示"——两者给玩家的下一步完全不同
    const spent = before.spend?.hint === 0;
    ui.toast(spent ? ui.t("hintUsed") : ui.t("hintNoMove"));
  }
  draw();
}

// 终局预报铜牌：点按把最优首手钉在盘面上（并列最优时同时给出个数）
function handleForecast() {
  const view = game.snapshot();
  const best = view.forecast?.best ?? [];
  if (best.length === 0) {
    ui.toast(ui.t("forecastNotFound"));
    return;
  }
  ui.peek(best[0]);
  ui.toast(best.length === 1 ? ui.t("pz_unique") : ui.tf("pz_optimalCount", { n: best.length }));
}

function handleUndo() {
  const ok = game.undo();
  if (!ok) return;
  audio.press();
  ui.clearPreview();
  armed = -1;
  ui.markResultShown(false);
  draw();
}

function handleResign() {
  if (!game.resign()) return;
  ui.animate(game.drainEvents());
  draw();
}

// ── 偏好 ─────────────────────────────────────────────────────────
function setPref(key, value) {
  const before = store.prefs[key];
  store = patchPrefs(store, { [key]: value });
  persist();
  if (REBUILD_PREFS.includes(key) && before !== store.prefs[key]) {
    startRound({});
    return;
  }
  ui.setCtx(currentCtx());
  draw();
}

function toggleSound() {
  audio.setMuted(!audio.isMuted());
  store = patchPrefs(store, { muted: audio.isMuted() });
  persist();
  draw();
}

function toggleLang() {
  locale = locale === "zh" ? "en" : "zh";
  saveLocale(locale);
  ui.setLocale(locale); // 全量热更新：只换文本，盘面与进度原封不动
  draw();
}

function openLevels() {
  ui.buildLevels(store.records);
  ui.openLayer("levels");
}

// ── 入档 ─────────────────────────────────────────────────────────
function recordRound(view) {
  if (view.mode === MODES.PLAY && !view.pvp) {
    const winner = view.report?.winner ?? EMPTY;
    const outcome = winner === EMPTY
      ? OUTCOME_DRAW
      : winner === view.human ? OUTCOME_WIN : OUTCOME_LOSS;
    store = applyOutcome(store, outcome, view.tier);
    store = applyHighlights(store, game.highlights(store.records.highlights));
  } else if (view.mode === MODES.PUZZLE && view.puzzle) {
    store = applyPuzzleResult(store, view.puzzle.id, {
      stars: view.puzzle.stars,
      hadWrongRetry: view.puzzle.wrongRetry,
      firstMoveOptimal: view.puzzle.firstMoveOptimal,
    });
  } else if (view.mode === MODES.RUSH) {
    const result = game.rushResult();
    if (result) store = applyRushResult(store, result);
  }
  persist();
  ui.buildLevels(store.records);
}

// ── 主循环 ───────────────────────────────────────────────────────
function startLoop() {
  const step = () => {
    setTimeout(step, TICK_MS);
    const view = game.snapshot();
    if (view.over) return;
    const event = game.tick(TICK_MS);
    if (!event) {
      if (view.mode === MODES.RUSH) ui.paintClock(game.snapshot());
      return;
    }
    if (event === "rush-timeout" || event === "blitz-timeout") {
      game.autoMove()
        .then(() => ui.animate(game.drainEvents()))
        .then(() => draw());
      return;
    }
    draw();
  };
  setTimeout(step, TICK_MS);
}

// ── 启动 ─────────────────────────────────────────────────────────
function init() {
  ui.bind();
  ui.setLocale(locale);
  ui.setCtx(currentCtx());
  startRound({ mode: store.prefs.mode });
  startLoop();
}

// 只在真实浏览器里自启动：node 侧（测试、工具脚本）import 本模块时不该拉起主循环。
if (typeof document !== "undefined") init();
