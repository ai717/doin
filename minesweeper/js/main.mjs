// 装配层：把难度、控制器、UI、计分、存档与音效接到一起。规则一律不在这里判断。

import { REVEALED, STATUS_PLAYING, STATUS_WON } from "./engine.mjs";
import { applyAction, createGame, isOver, resolveDeadlock, restart } from "./game.mjs";
import { DIFFICULTIES, getDifficulty, resolveConfig } from "./level.mjs";
import { mountUI } from "./ui.mjs";
import { scoreResult } from "./score.mjs";
import { createAudio } from "./audio.mjs";
import * as storage from "./storage.mjs";
import { findSafeCell } from "./solver.mjs";
import { htmlLang, loadLocale, saveLocale, strings } from "./i18n.mjs";

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
  langButton: byId("lang"),
  resultLayer: byId("result-layer"),
  resultBadge: byId("result-badge"),
  resultTitle: byId("result-title"),
  resultSub: byId("result-sub"),
  resultRows: byId("result-rows"),
  resultAgain: byId("result-again"),
  resultClose: byId("result-close"),
};

// —— i18n：统一语言规则（全站共享 doin.lang > 浏览器语言）——
const locale = loadLocale();
const t = strings(locale);
document.documentElement.lang = htmlLang(locale);
document.title = t.docTitle;
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute("content", t.metaDesc);

// 难度 label 不再取 level.mjs 的中文，改由 i18n 提供。
const DIFF_TEXT_KEYS = {
  beginner: "diffBeginner",
  intermediate: "diffIntermediate",
  expert: "diffExpert",
};

function diffText(id) {
  return t[DIFF_TEXT_KEYS[id]] ?? id;
}

// 把 HTML 里的静态文案按当前语言统一刷一遍（HTML 保留中文默认值做 SEO 兜底）。
function applyStaticTexts() {
  const set = (id, text) => {
    const el = byId(id);
    if (el) el.textContent = text;
  };
  const q = (selector) => document.querySelector(selector);

  q(".title").textContent = t.title;
  q(".lede").textContent = t.lede;
  q(".back a").textContent = t.backHome;
  q(".controls > .hud-tag").textContent = t.difficulty;
  q(".controls").setAttribute("aria-label", t.ariaControls);
  q(".hud").setAttribute("aria-label", t.ariaHud);
  q(".board-stage").setAttribute("aria-label", t.ariaBoardStage);
  q(".toolbar").setAttribute("aria-label", t.ariaToolbar);
  q(".footnote p").textContent = t.footnote;
  set("status", t.statusReady);
  set("flag-mode", t.flagMode);
  set("restart", t.newGame);
  set("result-again", t.again);
  set("result-close", t.viewBoard);
  set("difficulty-label", "");
  const hudTags = document.querySelectorAll(".hud-card .hud-tag");
  if (hudTags.length === 3) {
    hudTags[0].textContent = t.hudMines;
    hudTags[1].textContent = t.hudTime;
    hudTags[2].textContent = t.hudProgress;
  }
  refs.board.setAttribute("aria-label", t.boardLabel);
  refs.langButton.setAttribute("aria-label", t.ariaLang);
  refs.langButton.setAttribute("title", t.ariaLang);
}

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
  refs.difficultyLabel.textContent = diffText(active);
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
  refs.muteButton.textContent = muted ? "🔇 " + t.muted : "🔊 " + t.sound;
}

function syncLangButton() {
  // 按钮显示"可切换到的语言"，与当前语言相反。
  refs.langButton.textContent = t.langShort;
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
}, t);

function handleIntent(type, index) {
  const before = game.state;
  // 旗帜模式下，左键/点按一律当作插旗
  const effectiveType = flagMode && type === "reveal" ? "flag" : type;
  const action = applyAction(game, effectiveType, index);

  if (!action) {
    // 无效果 ≠ 报错：只对"速开条件不满足"给出轻提示，其余静默
    if (effectiveType === "reveal" && game.state.status === STATUS_PLAYING) {
      if (before.cellState[index] === REVEALED && before.adjacency[index] > 0) {
        ui.showMessage(t.chordFail, "warn");
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
    ui.showMessage(t.peek, "good");
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

// 语言切换：写入全站共享偏好后刷新，保持所有模块状态一致。
refs.langButton.addEventListener("click", () => {
  saveLocale(locale === "zh" ? "en" : "zh");
  window.location.reload();
});

setFlagMode(flagMode);
syncDifficultyButtons();
syncMuteButton();
syncLangButton();
applyStaticTexts();
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
