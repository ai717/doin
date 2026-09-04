// 装配层：把难度、控制器、UI、计分、存档与音效接到一起。规则一律不在这里判断。

import { REVEALED, STATUS_PLAYING, STATUS_WON } from "./engine.mjs";
import { applyAction, createGame, isOver, resolveDeadlock, restart } from "./game.mjs";
import { DIFFICULTIES, getDifficulty, resolveConfig } from "./level.mjs";
import { mountUI } from "./ui.mjs";
import { scoreResult } from "./score.mjs";
import { createAudio } from "./audio.mjs";
import * as storage from "./storage.mjs";
import { findSafeCell } from "./solver.mjs";

const byId = (id) => document.getElementById(id);

const refs = {
  board: byId("board"),
  status: byId("status"),
  message: byId("message"),
  hudMines: byId("hud-mines"),
  hudTime: byId("hud-time"),
  hudProgress: byId("hud-progress"),
  difficultyGroup: byId("difficulty-group"),
  difficultyLabel: byId("difficulty-label"),
  flagModeButton: byId("flag-mode"),
  muteButton: byId("mute"),
  restartButton: byId("restart"),
  resultLayer: byId("result-layer"),
  resultBadge: byId("result-badge"),
  resultTitle: byId("result-title"),
  resultSub: byId("result-sub"),
  resultRows: byId("result-rows"),
  resultAgain: byId("result-again"),
  resultClose: byId("result-close"),
};

// 持久化统一走 storage 模块：难度/静音偏好 + 各难度最佳战绩。
let persist = storage.load();
if (!getDifficulty(persist.prefs.difficulty)) persist.prefs.difficulty = DIFFICULTIES[0].id;

const audio = createAudio({ muted: persist.prefs.muted });

let game = createGame(resolveConfig({ difficulty: persist.prefs.difficulty }));
let flagMode = false;

function currentDifficultyId() {
  const found = DIFFICULTIES.find((d) => d.id === persist.prefs.difficulty);
  return (found || DIFFICULTIES[0]).id;
}

function syncDifficultyButtons() {
  const active = currentDifficultyId();
  for (const button of refs.difficultyGroup.querySelectorAll(".seg")) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === active));
  }
  refs.difficultyLabel.textContent = (
    DIFFICULTIES.find((d) => d.id === active) || DIFFICULTIES[0]
  ).label;
}

function setFlagMode(value) {
  flagMode = value;
  refs.flagModeButton.classList.toggle("active", flagMode);
  refs.flagModeButton.setAttribute("aria-pressed", String(flagMode));
}

function syncMuteButton() {
  const muted = audio.isMuted();
  refs.muteButton.setAttribute("aria-pressed", String(muted));
  refs.muteButton.dataset.muted = String(muted);
  refs.muteButton.textContent = muted ? "🔇 静音" : "🔊 音效";
}

function playActionSound(action) {
  if (!audio.isMuted() && typeof audio.unlock === "function") audio.unlock();
  if (action === "flag") audio.flag();
  else if (action === "unflag") audio.unflag();
  else if (action === "chord") audio.chord();
  else if (action === "reveal") audio.reveal(game.state.lastRevealed.length);
}

function finishGame() {
  const won = game.state.status === STATUS_WON;
  if (won) audio.win();
  else audio.lose();
  ui.vibrate(won ? [30, 60, 30] : 90);

  const elapsedMs = game.finishedAt - game.startedAt;
  const score = scoreResult({
    outcome: won ? "win" : "loss",
    difficulty: persist.prefs.difficulty,
    elapsedMs,
  });
  const { state: nextPersist, isBestScore, isBestTime } = storage.recordResult(persist, {
    difficulty: persist.prefs.difficulty,
    won,
    score: score.total,
    timeMs: elapsedMs,
  });
  persist = nextPersist;
  storage.save(persist);

  ui.showResult(game, {
    score,
    best: persist.best[persist.prefs.difficulty],
    isBestScore,
    isBestTime,
    elapsedMs,
  });
}

const ui = mountUI(refs, {
  onIntent: handleIntent,
});

function handleIntent(type, index) {
  const before = game.state;
  // 旗帜模式下，左键/点按一律当作插旗
  const effectiveType = flagMode && type === "reveal" ? "flag" : type;
  const action = applyAction(game, effectiveType, index);

  if (!action) {
    // 无效果 ≠ 报错：只对"速开条件不满足"给出轻提示，其余静默
    if (effectiveType === "reveal" && game.state.status === STATUS_PLAYING) {
      if (before.cellState[index] === REVEALED && before.adjacency[index] > 0) {
        ui.showMessage("旗数和数字不符，没法速开", "warn");
      }
    }
    return;
  }

  playActionSound(action);
  ui.render(game);

  if (isOver(game)) {
    finishGame();
    return;
  }

  // 免费透视兜底：逻辑已穷尽时自动揭示一个安全格（无猜保证）
  const peek = resolveDeadlock(game);
  if (peek >= 0) {
    audio.peek();
    ui.render(game);
    ui.showMessage("逻辑已穷尽 · 免费透视 +1", "good");
    ui.vibrate(20);
    if (isOver(game)) finishGame();
  }
}

function newGame() {
  restart(game, resolveConfig({ difficulty: persist.prefs.difficulty }));
  ui.hideResult();
  ui.render(game);
}

refs.difficultyGroup.addEventListener("click", (event) => {
  const button = event.target.closest(".seg");
  if (!button || button.dataset.difficulty === currentDifficultyId()) return;
  persist.prefs.difficulty = button.dataset.difficulty;
  storage.save(persist);
  syncDifficultyButtons();
  newGame();
});

refs.restartButton.addEventListener("click", newGame);
refs.resultAgain.addEventListener("click", newGame);
refs.resultClose.addEventListener("click", ui.hideResult);
refs.flagModeButton.addEventListener("click", () => setFlagMode(!flagMode));

refs.muteButton.addEventListener("click", () => {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  persist.prefs.muted = muted;
  storage.save(persist);
  syncMuteButton();
  if (!muted) audio.click();
});

setFlagMode(flagMode);
syncDifficultyButtons();
syncMuteButton();
ui.render(game);

window.setInterval(() => ui.updateTimer(game), 250);
ui.updateTimer(game);

// 端到端测试钩子：仅当 URL 带 ?e2e 时暴露，生产路径完全不受影响。
if (typeof location !== "undefined" && new URLSearchParams(location.search).has("e2e")) {
  window.__ms = {
    state: () => game.state,
    intent: handleIntent,
    findSafeCell,
  };
}
