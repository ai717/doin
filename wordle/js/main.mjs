// main.mjs —— 入口装配：绑定事件、协调 game/storage/ui/i18n/audio；语言热更新不触碰游戏状态。

import * as engine from "./engine.mjs";
import { createGame } from "./game.mjs";
import * as storage from "./storage.mjs";
import * as i18n from "./i18n.mjs";
import * as audio from "./audio.mjs";
import * as ui from "./ui.mjs";

const $ = (id) => document.getElementById(id);
const dayKey = engine.dayKeyOf();

const store = { data: storage.load() };
audio.setMuted(store.data.muted === true);

const game = createGame();
game.state.track = store.data.track;
game.state.mode = store.data.mode;

// ---------------------------------------------------------------- 局面装配

// 惰性建局 + 每日/双人存档恢复（day 匹配才恢复，绝不旧盖新）
function ensureFor(track, mode) {
  if (mode === engine.MODES.DAILY) {
    const saved = store.data[track].daily;
    if (saved && saved.day === dayKey) return game.restoreDaily(track, dayKey, saved);
    return game.ensureCore(track, mode, dayKey);
  }
  if (mode === engine.MODES.DUEL) {
    const saved = store.data[track].duelState;
    if (saved && saved.day === dayKey) return game.restoreDuel(track, dayKey, saved);
    return game.ensureCore(track, mode, dayKey);
  }
  return game.coreOf(track, mode) ?? game.ensureCore(track, mode);
}

function boot() {
  ui.init();
  i18n.applyTexts();
  const seedParam = new URLSearchParams(window.location.search).get("seed");
  const seedNum = /^\d+$/.test(seedParam ?? "") ? Number(seedParam) % 4294967296 : null;
  if (game.state.mode === engine.MODES.PRACTICE) {
    game.newPractice(game.state.track, seedNum);
  } else {
    ensureFor(game.state.track, game.state.mode);
  }
  persistPrefs();
  refresh();
  updateSoundBtn();
  // 历史遗留：当日已结束的每日局恢复成结果面板（重进页面可看战绩）
  const core = game.core();
  const daily = store.data[game.track()].daily;
  if (core.kind === engine.MODES.DAILY && core.done && daily && daily.day === dayKey) {
    const finished = { kind: engine.MODES.DAILY, won: daily.won === true, guesses: core.players[0].rows.length, answer: core.answer };
    ui.showResult(game, store, finished, { shareText: buildShare(finished) });
  }
}

function persistPrefs() {
  store.data.track = game.track();
  store.data.mode = game.mode();
  storage.save(store.data);
}

function refresh(reveal = null) {
  const ms = ui.render(game, store, reveal ? { reveal } : {});
  ui.renderBanner(game, store, dayKey);
  return ms;
}

function lightRefresh() {
  ui.refreshLight(game, store);
  ui.renderBanner(game, store, dayKey);
}

// ---------------------------------------------------------------- 动作与输入缓冲

let busy = false; // 翻色动画期间锁定，输入进队列缓冲
const pending = [];

function enqueue(intent) {
  if (ui.anyPanelOpen()) return;
  pending.push(intent);
  flush();
}
function flush() {
  if (busy) return;
  const intent = pending.shift();
  if (!intent) return;
  if (intent.ch !== undefined) doType(intent.ch);
  else if (intent.submit) doSubmit();
  else if (intent.backspace) doBackspace();
}

function doType(ch) {
  const res = game.typeChar(ch);
  if (res.ok) {
    audio.playKey(ch.codePointAt(0) ?? 0);
    lightRefresh();
  }
  flush();
}

function doBackspace() {
  const res = game.backspace();
  if (res.ok) {
    audio.playUi();
    lightRefresh();
  }
  flush();
}

// 提示：揭示一个未命中字符（每局一次，双人禁用）；用后立即随每日进度落盘
function doHint() {
  if (busy || ui.anyPanelOpen()) return;
  const ch = game.useHint();
  if (!ch) {
    ui.toast(i18n.t("hintUsed"));
    return;
  }
  audio.playUi();
  persistProgress(game.core());
  refresh();
}

function doSubmit() {
  const round = game.activeRound();
  if (round.status !== engine.STATUS.PLAYING) {
    flush();
    return;
  }
  if (round.draft.length < round.length) {
    audio.playBad();
    ui.toast(i18n.t("toastNotEnough"));
    ui.shakeRow(game);
    flush();
    return;
  }
  const playerIdx = game.core().active;
  const res = game.submitGuess();
  if (!res) {
    audio.playBad();
    ui.toast(i18n.t("toastNotInList"));
    ui.shakeRow(game);
    flush();
    return;
  }
  busy = true;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  res.core.players[playerIdx].rows[res.rowIndex].fb.forEach((fb, i) => {
    window.setTimeout(() => audio.playFlip(fb), reduced ? 0 : i * 90 + 250);
  });
  const ms = refresh({ player: playerIdx, rowIndex: res.rowIndex });
  window.setTimeout(() => {
    busy = false;
    if (res.finished) {
      finishGame(res);
    } else {
      persistProgress(res.core);
      refresh();
      if (res.core.kind === engine.MODES.DUEL) audio.playTurn();
      flush();
    }
  }, Math.max(ms, 60));
}

function finishGame(res) {
  const finished = res.finished;
  const track = game.track();
  if (finished.kind === engine.MODES.DAILY) {
    storage.recordDaily(store.data, track, dayKey, finished.won, finished.guesses);
  } else if (finished.kind === engine.MODES.PRACTICE) {
    storage.recordPractice(store.data, track, finished.won, finished.guesses);
  } else {
    storage.recordDuel(store.data, track, finished.winner);
    storage.clearDuelState(store.data, track);
  }
  storage.save(store.data);
  if (finished.kind === engine.MODES.DUEL) {
    finished.winner === -1 ? audio.playLose() : audio.playWin();
  } else {
    finished.won ? audio.playWin() : audio.playLose();
  }
  refresh();
  ui.showResult(game, store, finished, { shareText: buildShare(finished) });
  flush();
}

function persistProgress(core) {
  if (core.kind === engine.MODES.DAILY) {
    const words = core.players[0].rows.map((r) => r.guess.join(""));
    storage.saveDailyProgress(store.data, game.track(), dayKey, words, core.players[0].hint);
  } else if (core.kind === engine.MODES.DUEL) {
    storage.saveDuelState(store.data, game.track(), {
      day: dayKey,
      players: core.players.map((r) => r.rows.map((row) => row.guess.join(""))),
      active: core.active,
      done: false,
      winner: null,
    });
  }
  storage.save(store.data);
}

// ---------------------------------------------------------------- 分享文本

function buildShare(finished) {
  const core = game.core();
  const lines = [];
  const emoji = { correct: "\u{1F7E9}", present: "\u{1F7E8}", absent: "\u2B1B" };
  if (finished.kind === engine.MODES.DUEL) {
    const tally = store.data[game.track()].duelTally;
    lines.push(`${i18n.t("appTitle")} \u00B7 ${i18n.t("modeDuel")}`);
    lines.push(i18n.t("duelRecord", { a: tally.a, b: tally.b }));
    core.players.forEach((r, p) => {
      lines.push(`${p === 0 ? i18n.t("playerA") : i18n.t("playerB")}: ${r.rows.length}/${engine.MAX_ROWS}`);
      for (const row of r.rows) lines.push([...row.fb].map((f) => emoji[f]).join(""));
    });
    return lines.join("\n");
  }
  const issueNo = core.kind === engine.MODES.DAILY ? engine.issueNoOf(dayKey) : null;
  const head =
    core.kind === engine.MODES.PRACTICE
      ? `${i18n.t("appTitle")} \u00B7 ${i18n.t("modePractice")}`
      : finished.won
        ? i18n.t("shareScore", { n: issueNo, x: finished.guesses })
        : i18n.t("shareMiss", { n: issueNo });
  lines.push(head);
  for (const row of core.players[0].rows) lines.push([...row.fb].map((f) => emoji[f]).join(""));
  if (core.kind === engine.MODES.PRACTICE && core.seed !== null) lines.push(`seed=${core.seed}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- 事件绑定

function switchTo(track, mode = game.mode()) {
  if (busy) return;
  if (!game.switchTrack(track)) return;
  if (mode !== game.mode()) game.switchMode(mode);
  ensureFor(game.track(), game.mode());
  persistPrefs();
  refresh();
  ui.closePanels();
  audio.playUi();
}

function bind() {
  $("kb").addEventListener("click", (e) => {
    const key = e.target.closest("[data-ch]");
    if (!key) return;
    const ch = key.dataset.ch;
    if (ch === "\n") enqueue({ submit: true });
    else if (ch === "\b") enqueue({ backspace: true });
    else enqueue({ ch });
  });

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") {
      ui.closePanels();
      return;
    }
    if (ui.anyPanelOpen()) return;
    if (e.key === "Enter") {
      e.preventDefault();
      enqueue({ submit: true });
    } else if (e.key === "Backspace") {
      e.preventDefault();
      enqueue({ backspace: true });
    } else if (e.key === "1") {
      switchTo(engine.TRACKS.EN);
    } else if (e.key === "2") {
      switchTo(engine.TRACKS.CN);
    } else if (/^[a-zA-Z]$/.test(e.key) && game.track() === engine.TRACKS.EN) {
      enqueue({ ch: e.key.toLowerCase() });
    }
  });

  $("btn-mode").addEventListener("click", () => {
    ui.highlightModes(game);
    ui.openPanel("modes");
    audio.playUi();
  });
  $("btn-track").addEventListener("click", () => {
    switchTo(game.track() === engine.TRACKS.EN ? engine.TRACKS.CN : engine.TRACKS.EN);
  });
  $("btn-help").addEventListener("click", () => {
    ui.openPanel("help");
    audio.playUi();
  });
  $("btn-sound").addEventListener("click", () => {
    store.data.muted = !audio.isMuted();
    audio.setMuted(store.data.muted);
    storage.save(store.data);
    updateSoundBtn();
    if (!store.data.muted) audio.playUi();
  });
  $("btn-lang").addEventListener("click", () => {
    i18n.setLang(i18n.getLang() === "zh" ? "en" : "zh");
    i18n.applyTexts();
    ui.applyLocale(game);
    updateSoundBtn();
    ui.renderBanner(game, store, dayKey);
    if (!$("panel-stats").hidden) ui.showStats(game, store);
    audio.playUi();
  });
  $("btn-hint").addEventListener("click", doHint);

  $("help-close").addEventListener("click", () => ui.closePanels());
  $("stats-close").addEventListener("click", () => ui.closePanels());
  $("modes-close").addEventListener("click", () => ui.closePanels());
  $("ws-issue").closest(".plaque").addEventListener("click", () => {
    ui.showStats(game, store);
    ui.openPanel("stats");
    audio.playUi();
  });

  $("mode-daily").addEventListener("click", () => switchTo(game.track(), engine.MODES.DAILY));
  $("mode-practice").addEventListener("click", () => {
    if (!busy) {
      game.switchMode(engine.MODES.PRACTICE);
      if (!game.coreOf(game.track(), engine.MODES.PRACTICE)) game.newPractice(game.track());
      persistPrefs();
      refresh();
      ui.closePanels();
      audio.playUi();
    }
  });
  $("mode-duel").addEventListener("click", () => switchTo(game.track(), engine.MODES.DUEL));
  $("track-en").addEventListener("click", () => switchTo(engine.TRACKS.EN));
  $("track-cn").addEventListener("click", () => switchTo(engine.TRACKS.CN));

  $("btn-share").addEventListener("click", () => {
    const text = $("share-text").value;
    const done = () => {
      ui.toast(i18n.t("shareCopied"));
      audio.playUi();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(done)
        .catch(() => {
          ui.fillShareText(text);
          ui.toast(i18n.t("shareFallback"));
        });
    } else {
      ui.fillShareText(text);
      ui.toast(i18n.t("shareFallback"));
    }
  });
  $("btn-again").addEventListener("click", () => {
    game.newPractice(game.track());
    persistPrefs();
    refresh();
    ui.closePanels();
    audio.playUi();
  });
  $("btn-modes2").addEventListener("click", () => {
    ui.closePanels();
    ui.highlightModes(game);
    ui.openPanel("modes");
    audio.playUi();
  });

  for (const overlay of document.querySelectorAll(".overlay")) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && overlay.id !== "panel-result") ui.closePanels();
    });
  }
}

function updateSoundBtn() {
  const btn = $("btn-sound");
  btn.classList.toggle("off", store.data.muted === true);
  btn.setAttribute("aria-label", i18n.t(store.data.muted ? "soundOff" : "soundOn"));
}

bind();
boot();

// 调试句柄（项目硬约定）：game 走 getter，永远拿得到最新控制器
window.__wordle = {
  get game() {
    return game;
  },
  core: () => game.core(),
  state: () => game.state,
  track: () => game.track(),
  mode: () => game.mode(),
  type: (ch) => game.typeChar(ch),
  backspace: () => game.backspace(),
  submit: () => game.submitGuess(),
  hint: () => game.useHint(),
  newPractice: (track, seed) => game.newPractice(track, seed),
  save: () => store.data,
};
