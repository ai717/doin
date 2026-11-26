// 入口装配：键盘/触控意图 → DuelGame，事件 → 音效与特效，快照 → Canvas + HUD。
// 语言切换只做原地热更新；任何面板开关都不 reload、不重建对局（除明确开新局）。

import { createGame, MODE, PHASE } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import * as audio from "./audio.mjs";
import * as store from "./storage.mjs";
import { applyI18n, getLang, setLang, toggleLang, t, stageName } from "./i18n.mjs";

const META_KEY = "doin.meta.v1";

let save = store.loadSave();
let autoPaused = false;
let resultSuppressed = false;
let lastResultFactory = null;
let resultTimer = 0;

const params = new URLSearchParams(window.location.search);
const mode = save.mode === "versus" ? MODE.VERSUS : MODE.SOLO;
const startIndex = Math.max(0, Math.min(21, Math.min(save.lastStage, save.bestStage)));
const seedParam = Number(params.get("seed"));

const game = createGame({
  mode,
  stage: startIndex,
  bestOf: save.bestOf,
  seed: Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Date.now(),
});

const canvas = document.getElementById("arena-canvas");
const renderer = createRenderer(canvas);

audio.setEnabled(save.sound);

let reduceMotion = false;
try {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduceMotion = mq.matches;
  mq.addEventListener?.("change", (event) => {
    reduceMotion = event.matches;
  });
} catch {
  reduceMotion = false;
}

const ui = createUI({
  game,
  actions: {
    onMode: (nextMode) => launch({ mode: nextMode, stage: game.stageIndex }),
    onBestOf: () => {
      const next = game.bestOf === 3 ? 5 : 3;
      save = store.writeSave(store.setPreferences(save, { bestOf: next }));
      withResultClosed(() => {
        game.setBestOf(next);
        game.togglePause(false);
      });
      ui.setBestOf(next);
      ui.toast(t("toastBestOf", undefined, { n: next }));
      audio.play("ui");
    },
    onPause: () => togglePause(),
    onSound: () => toggleSound(),
    onLang: () => switchLanguage(),
    onResume: () => resumeFromPanel(),
    onRestart: () => {
      launch({ mode: game.mode, stage: game.stageIndex });
      audio.play("ui");
    },
    onResetSave: () => resetProgress(),
    onPanel: (open) => handlePanel(open),
    onRequestLevels: () => refreshLevels(),
  },
});

// ---------------------------------------------------------- 对局生命周期

function launch(options = {}) {
  const targetMode = options.mode ?? game.mode;
  const targetStage = Math.max(0, Math.min(21, options.stage ?? game.stageIndex));
  window.clearTimeout(resultTimer);
  autoPaused = false;
  lastResultFactory = null;
  resultSuppressed = true;
  ui.hideResult();
  resultSuppressed = false;
  game.togglePause(false);
  if (game.mode !== targetMode) game.setMode(targetMode);
  if (game.stageIndex !== targetStage) game.setStage(targetStage);
  game.resetSeries();
  save = store.writeSave(store.setPreferences(save, { mode: targetMode }));
  if (targetMode === MODE.SOLO) {
    save.lastStage = targetStage;
    save = store.writeSave(save);
  }
  ui.refresh(game.snapshot());
}

function withResultClosed(fn) {
  resultSuppressed = true;
  ui.hideResult();
  try {
    fn();
  } finally {
    resultSuppressed = false;
  }
}

function presentResult(factory) {
  lastResultFactory = factory;
  ui.showResult(factory());
}

function handlePanel(open) {
  if (open) {
    game.togglePause(true);
    ui.setPaused(true);
    return;
  }
  if (resultSuppressed) return;
  if (game.phase !== PHASE.PLAYING) {
    if (lastResultFactory) {
      window.setTimeout(() => {
        if (!resultSuppressed && !ui.isPanelOpen() && game.phase !== PHASE.PLAYING) {
          presentResult(lastResultFactory);
        }
      }, 0);
    }
    return;
  }
  if (!autoPaused) {
    game.togglePause(false);
    ui.setPaused(false);
    audio.play("unpause");
  } else {
    ui.openPanel("pause");
  }
}

function togglePause() {
  if (ui.panels.result && !ui.panels.result.hidden) return;
  if (ui.isPanelOpen()) {
    autoPaused = false;
    ui.closePanels();
    return;
  }
  if (game.paused) {
    game.togglePause(false);
    ui.setPaused(false);
    audio.play("unpause");
    return;
  }
  game.togglePause(true);
  ui.setPaused(true);
  ui.openPanel("pause");
  audio.play("pause");
}

function resumeFromPanel() {
  autoPaused = false;
  ui.closePanels();
  game.togglePause(false);
  ui.setPaused(false);
  audio.play("unpause");
}

function toggleSound() {
  const next = !audio.isEnabled();
  save = store.writeSave(store.setPreferences(save, { sound: next }));
  audio.setEnabled(next);
  ui.setSound(next);
  if (next) audio.play("ui");
}

function switchLanguage() {
  const lang = toggleLang();
  applyI18n(document, lang);
  ui.setLangButton();
  ui.setSound(audio.isEnabled());
  if (ui.panels.levels && !ui.panels.levels.hidden) refreshLevels();
  if (lastResultFactory && ui.panels.result && !ui.panels.result.hidden) {
    ui.showResult(lastResultFactory());
  }
  ui.refresh(game.snapshot());
}

function resetProgress() {
  const confirmed = window.confirm(t("resetSaveConfirm"));
  if (!confirmed) return;
  save = store.resetSave();
  refreshLevels();
  if (game.mode === MODE.SOLO) launch({ mode: MODE.SOLO, stage: 0 });
  ui.toast(t("resetSaveDone"));
  audio.play("ui");
}

function refreshLevels() {
  ui.buildLevels(save, save.bestStage, (index) => {
    if (index > save.bestStage) {
      ui.toast(t("toastLocked"));
      return;
    }
    launch({ mode: MODE.SOLO, stage: index });
    audio.play("ui");
  }, getLang());
}

// ---------------------------------------------------------- 事件 → 音效/特效

function handleClear(event) {
  if (event.lines === 4) {
    audio.play("tetris");
    ui.flash(t("bannerTetris"), "gold", 5, 1000);
    renderer.burst(event.player, 28, event.player === 0 ? "#ffd166" : "#7cc4ff");
  } else if (event.tspin) {
    audio.play("tspin");
    ui.flash(t("bannerTSpin"), "gold", 4, 900);
  } else {
    audio.play("clear", { lines: event.lines });
  }
  if (event.b2b) ui.flash(t("bannerB2B"), "gold", 3, 820);
  if (event.combo >= 2) ui.flash(t("bannerCombo", undefined, { n: event.combo + 1 }), "gold", 2, 760);
}

game.subscribe((event) => {
  switch (event.type) {
    case "move":
      audio.play("move");
      break;
    case "rotate":
      audio.play("rotate");
      break;
    case "hold":
      audio.play("hold");
      break;
    case "lock":
      audio.play("lock");
      break;
    case "clear":
      handleClear(event);
      break;
    case "attack":
      if (event.sent > 0) {
        renderer.addLaser(event.player);
        audio.play("laser");
        if (event.sent >= 4) {
          ui.flash(t("bannerAttack", undefined, { n: event.sent }), event.player === 0 ? "red" : "blue", 2, 820);
        }
      }
      if (event.cancelled > 0) {
        audio.play("cancel");
        ui.flash(t("bannerCounter", undefined, { n: event.cancelled }), "gold", 2, 700);
      }
      break;
    case "garbage":
      audio.play("garbage");
      renderer.addImpact(event.player, event.rows);
      break;
    case "alarm":
      audio.play("alarm");
      break;
    case "ko":
      audio.play("ko");
      ui.flash(t("bannerKo"), "ko", 6, 1200);
      renderer.burst(event.loser, 32, event.loser === 0 ? "#ff4757" : "#3b9dff");
      break;
    case "round_end":
      scheduleRoundResult(event);
      break;
    case "series_end":
      scheduleSeriesResult(event);
      break;
    default:
      break;
  }
});

function scheduleRoundResult(event) {
  window.clearTimeout(resultTimer);
  const round = game.round;
  resultTimer = window.setTimeout(() => {
    if (game.phase !== PHASE.ROUND_END || game.round !== round) return;
    presentResult(() => ({
      eyebrow: `${t("roundCount", undefined, { n: round })} · ${t("seriesLabel")} ${event.seriesWins[0]} : ${event.seriesWins[1]}`,
      title: event.winner === 0 ? t("resultRedWins") : t("resultBlueWins"),
      detail: t("bestOfShort", undefined, { n: game.bestOf }),
      tone: event.winner === 0 ? "red" : "blue",
      primaryLabel: t("resumeGame"),
      onPrimary: () => {
        withResultClosed(() => {
          game.togglePause(false);
          game.nextRound();
        });
        ui.setPaused(false);
      },
      secondaryLabel: t("btnToLevels"),
      onSecondary: () => {
        ui.openLevels();
      },
    }));
  }, 1150);
}

function scheduleSeriesResult(event) {
  window.clearTimeout(resultTimer);
  resultTimer = window.setTimeout(() => {
    if (game.phase !== PHASE.SERIES_END) return;
    showSeriesResult(event);
  }, 900);
}

function showSeriesResult(event) {
  const snapshot = game.snapshot();
  const player = snapshot.boards[0];
  if (game.mode === MODE.SOLO) {
    const index = game.stageIndex;
    const won = event.winner === 0;
    const alreadyCleared = save.cleared.includes(index);
    const oldBest = save.bestStage;
    save = store.writeSave(store.recordStageResult(save, index, won));
    const stars = won && !alreadyCleared ? 1 : 0;
    reportGameSession({ won, score: player.score, stars });
    if (won && save.bestStage > oldBest && index < 21) {
      ui.toast(t("toastNewStage", undefined, { n: index + 2 }));
    }
    presentResult(() => ({
      eyebrow: `${t("modeTagSolo")} · ${t("stageOf", undefined, { n: index + 1 })}`,
      title: won ? t("resultStageClear") : t("resultStageFail"),
      detail: won
        ? t("resultDetailStage", undefined, { n: index + 1, name: stageName(index) })
        : t("resultDetailFail", undefined, { n: index + 1, name: stageName(index) }),
      tone: won ? "gold" : "red",
      primaryLabel: won && index < 21 ? t("btnNextStage") : won ? t("btnRematch") : t("btnRetryStage"),
      onPrimary: () => {
        if (won && index < 21) launch({ mode: MODE.SOLO, stage: index + 1 });
        else if (won) launch({ mode: MODE.SOLO, stage: index });
        else launch({ mode: MODE.SOLO, stage: index });
        audio.play("ui");
      },
      secondaryLabel: won && index < 21 ? t("btnRetryStage") : t("btnToLevels"),
      onSecondary: () => {
        if (won && index < 21) {
          launch({ mode: MODE.SOLO, stage: index });
        } else {
          ui.openLevels();
        }
        audio.play("ui");
      },
    }));
    ui.setMode(MODE.SOLO);
    return;
  }

  const won = event.winner === 0;
  save = store.writeSave(store.recordSeries(save, MODE.VERSUS, won));
  reportGameSession({ won, score: player.score, stars: 0 });
  presentResult(() => ({
    eyebrow: `${t("modeTagVersus")} · ${t("bestOfShort", undefined, { n: game.bestOf })}`,
    title: event.winner === 0 ? t("resultRedWins") : t("resultBlueWins"),
    detail: t("resultDetailSeries", undefined, {
      a: event.seriesWins[0],
      b: event.seriesWins[1],
      mode: t("modeTagVersus"),
    }),
    tone: event.winner === 0 ? "red" : "blue",
    primaryLabel: t("btnRematch"),
    onPrimary: () => {
      launch({ mode: MODE.VERSUS, stage: game.stageIndex });
      audio.play("ui");
    },
    secondaryLabel: t("btnToLevels"),
    onSecondary: () => {
      ui.openLevels();
    },
  }));
}

function reportGameSession(outcome) {
  const payload = {
    slug: "blockduel",
    outcome: outcome.won ? "WON" : "LOST",
    score: outcome.score || 0,
    stars: outcome.stars || 0,
    timestamp: Date.now(),
  };
  try {
    const raw = localStorage.getItem(META_KEY) || "{}";
    const meta = JSON.parse(raw);
    const list = Array.isArray(meta.recentlyPlayed) ? meta.recentlyPlayed : [];
    meta.recentlyPlayed = [payload.slug, ...list.filter((slug) => slug !== payload.slug)].slice(0, 8);
    meta.totalStars = (Number(meta.totalStars) || 0) + (payload.stars || 0);
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* 存档不可用时忽略 */
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload }, "*");
    }
  } catch {
    /* 父级不可达时忽略 */
  }
}

// ---------------------------------------------------------- 键盘

const P1_KEYS = {
  KeyA: "left",
  KeyD: "right",
  KeyS: "soft",
  KeyW: "rotateCW",
  KeyQ: "rotateCCW",
  Space: "hard",
  KeyC: "hold",
};
const P2_KEYS = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowDown: "soft",
  ArrowUp: "rotateCW",
  Digit0: "rotateCCW",
  Numpad0: "rotateCCW",
  Enter: "hard",
  ShiftRight: "hold",
};

function keyAction(event) {
  const code = event.code;
  if (game.mode === MODE.SOLO) {
    if (P1_KEYS[code]) return [0, P1_KEYS[code]];
    if (P2_KEYS[code]) return [0, P2_KEYS[code]];
    return null;
  }
  if (P1_KEYS[code]) return [0, P1_KEYS[code]];
  if (P2_KEYS[code]) return [1, P2_KEYS[code]];
  return null;
}

function isTypingTarget(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

window.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || isTypingTarget(event.target)) return;
  if (event.code === "KeyP" || event.key === "Escape") {
    if (ui.panels.result && !ui.panels.result.hidden) return;
    event.preventDefault();
    autoPaused = false;
    togglePause();
    return;
  }
  const mapping = keyAction(event);
  if (!mapping) return;
  if (ui.isPanelOpen()) return;
  event.preventDefault();
  const [player, action] = mapping;
  if (action === "soft") {
    game.setSoft(player, true);
    return;
  }
  if (event.repeat && (action === "rotateCW" || action === "rotateCCW" || action === "hard" || action === "hold")) {
    return;
  }
  game.input(player, action);
});

window.addEventListener("keyup", (event) => {
  const mapping = keyAction(event);
  if (!mapping) return;
  if (mapping[1] === "soft") game.setSoft(mapping[0], false);
});

window.addEventListener("blur", () => {
  game.setSoft(0, false);
  game.setSoft(1, false);
  if (document.hidden) return;
  triggerAutoPause();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) triggerAutoPause();
});

function triggerAutoPause() {
  if (game.phase !== PHASE.PLAYING || autoPaused) return;
  autoPaused = true;
  game.togglePause(true);
  ui.setPaused(true);
  if (!ui.isPanelOpen()) {
    ui.openPanel("pause");
    audio.play("pause");
  }
  ui.toast(t("toastAutoPause"));
}

// ---------------------------------------------------------- 音频解锁

function unlockAudio() {
  audio.unlock();
  window.removeEventListener("pointerdown", unlockAudio, true);
  window.removeEventListener("keydown", unlockAudio, true);
}

window.addEventListener("pointerdown", unlockAudio, true);
window.addEventListener("keydown", unlockAudio, true);

// ---------------------------------------------------------- 渲染循环

let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (!game.paused) game.step(dt);
  const snapshot = game.snapshot();
  renderer.draw(snapshot, dt, { labels: ui.labels(), reduceMotion });
  ui.refresh(snapshot);
  requestAnimationFrame(frame);
}

applyI18n(document, getLang());
ui.setLangButton();
ui.setSound(audio.isEnabled());
ui.setMode(game.mode);
ui.setBestOf(game.bestOf);
refreshLevels();
ui.refresh(game.snapshot());
requestAnimationFrame(frame);

// 调试句柄：便于浏览器控制台观察对局与测试事件。
window.__blockduel = { game, renderer, ui, save: () => save };
