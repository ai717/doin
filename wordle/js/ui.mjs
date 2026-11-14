// ui.mjs —— 唯一碰 DOM/渲染的层：盘面铅字、字架键盘、工作单、弹层与动效。
// 文本一律取自 i18n；本文件源码不含任何硬编码界面文案。

import * as i18n from "./i18n.mjs";
import { CN_TRAY } from "./wordlists.mjs";
import * as engine from "./engine.mjs";

const $ = (id) => document.getElementById(id);

let els = null;
let toastTimer = 0;
const REDUCED = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function init() {
  els = {
    particles: $("particles"),
    boards: $("boards"),
    kb: $("kb"),
    wsIssue: $("ws-issue"),
    wsWinrate: $("ws-winrate"),
    wsStreak: $("ws-streak"),
    wsDist: $("ws-dist"),
    wsChances: $("ws-chances"),
    btnHint: $("btn-hint"),
    duelTurn: $("duel-turn"),
    banner: $("banner"),
    toast: $("toast"),
    panelHelp: $("panel-help"),
    panelStats: $("panel-stats"),
    panelResult: $("panel-result"),
    panelModes: $("panel-modes"),
    statsBody: $("stats-body"),
    resultKicker: $("result-kicker"),
    resultTitle: $("result-title"),
    resultGrid: $("result-grid"),
    resultBadge: $("result-badge"),
    resultNote: $("result-note"),
    btnAgain: $("btn-again"),
    shareText: $("share-text"),
    btnMode: $("btn-mode"),
    btnTrack: $("btn-track"),
    trackEn: $("track-en"),
    trackCn: $("track-cn"),
    modeDaily: $("mode-daily"),
    modePractice: $("mode-practice"),
    modeDuel: $("mode-duel"),
  };
  spawnParticles(16);
}

function spawnParticles(n) {
  for (let i = 0; i < n; i++) {
    const dot = document.createElement("i");
    dot.style.left = `${(Math.random() * 100).toFixed(2)}%`;
    dot.style.animationDuration = `${(9 + Math.random() * 14).toFixed(2)}s`;
    dot.style.animationDelay = `${(-Math.random() * 18).toFixed(2)}s`;
    dot.style.opacity = String(0.3 + Math.random() * 0.5);
    const s = (0.6 + Math.random() * 0.9).toFixed(2);
    dot.style.transform = `scale(${s})`;
    els.particles.appendChild(dot);
  }
}

// ---------------------------------------------------------------- 渲染

// opts.reveal = { player, rowIndex } 时对该行铅字执行翻色动画，返回动画总时长 ms（reduced-motion 为 0）
export function render(game, store, opts = {}) {
  const ms = buildBoards(game, opts);
  renderKb(game);
  updateWorksheet(game, store);
  renderDuelTurn(game);
  return ms;
}

// 轻刷新：仅重绘盘面与工作单（打字/删字高频路径，不重建字架键盘）
export function refreshLight(game, store) {
  buildBoards(game, null);
  updateWorksheet(game, store);
  renderDuelTurn(game);
}

function buildBoards(game, opts) {
  const core = game.core();
  const duel = core.kind === engine.MODES.DUEL;
  els.boards.classList.toggle("duel", duel);
  els.boards.innerHTML = "";
  let revealMs = 0;
  core.players.forEach((round, p) => {
    const built = buildBoard(game, round, p, duel, opts ? opts.reveal : null);
    els.boards.appendChild(built.el);
    if (built.revealMs > revealMs) revealMs = built.revealMs;
  });
  return revealMs;
}

function buildBoard(game, round, playerIdx, duel, reveal) {
  const core = game.core();
  const board = document.createElement("div");
  board.className = "board" + (duel && playerIdx === core.active && !core.done ? " active-player" : "");
  board.dataset.player = String(playerIdx);
  if (duel) {
    const tag = document.createElement("div");
    tag.className = "board-tag" + (playerIdx === core.active && !core.done ? "" : " wait");
    tag.textContent = playerIdx === 0 ? i18n.t("playerA") : i18n.t("playerB");
    board.appendChild(tag);
  }
  const target = reveal && reveal.player === playerIdx ? reveal.rowIndex : -1;
  let revealMs = 0;
  for (let r = 0; r < engine.MAX_ROWS; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.dataset.row = String(r);
    const committed = round.rows[r];
    const draft = committed ? [] : r === round.rows.length ? round.draft : [];
    const revealing = r === target;
    for (let c = 0; c < round.length; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.player = String(playerIdx);
      tile.dataset.row = String(r);
      tile.dataset.col = String(c);
      if (committed) {
        tile.textContent = committed.guess[c];
        // 被揭示行暂不上色，交给翻色动画在中途换色（reduced-motion 下立即上色）
        if (!revealing || REDUCED()) tile.classList.add(committed.fb[c]);
      } else if (draft[c]) {
        tile.textContent = draft[c];
        tile.classList.add("filled");
      }
      rowEl.appendChild(tile);
    }
    board.appendChild(rowEl);
    if (revealing && !REDUCED()) revealMs = animateReveal(rowEl, committed);
  }
  return { el: board, revealMs };
}

// 翻色动画：错峰翻转，在 90 度侧面时换色；返回总时长（reduced-motion 下 0）
function animateReveal(rowEl, committed) {
  const tiles = [...rowEl.children];
  if (REDUCED()) {
    return 0;
  }
  tiles.forEach((tile, i) => {
    tile.style.animationDelay = `${i * 90}ms`;
    tile.classList.add("flip");
    setTimeout(() => tile.classList.add(committed.fb[i]), i * 90 + 250);
  });
  return tiles.length * 90 + 520;
}

export function shakeRow(game, playerIdx = null) {
  const core = game.core();
  const p = playerIdx ?? core.active;
  const board = els.boards.querySelector(`.board[data-player="${p}"]`);
  const rowEl = board && board.querySelector(`.row[data-row="${core.players[p].rows.length}"]`);
  if (rowEl) {
    rowEl.classList.add("shake");
    setTimeout(() => rowEl.classList.remove("shake"), 420);
  }
}

// 键盘：EN 三行 QWERTY；CN 铅字字架（高频段置顶 + 分隔线 + 低频段滚动）
const EN_ROWS = ["qwertyuiop", "asdfghjkl", "+zxcvbnm-"];
const TRAY_HOT = 120;

function renderKb(game) {
  const core = game.core();
  const rounds = core.players;
  const states = engine.keyStates(rounds);
  const hint = core.kind !== engine.MODES.DUEL && !core.done ? rounds[core.active].hint : null;
  els.kb.innerHTML = "";
  els.kb.classList.toggle("cn", game.track() === engine.TRACKS.CN);
  const cls = (ch) => {
    const rank = states.get(ch) ?? 0;
    if (rank === 0 && hint && ch === hint) return " k-hint";
    return rank === 3 ? " k-correct" : rank === 2 ? " k-present" : rank === 1 ? " k-absent" : "";
  };
  let hintKey = null;
  if (game.track() === engine.TRACKS.EN) {
    for (const rowStr of EN_ROWS) {
      const row = document.createElement("div");
      row.className = "kb-row";
      for (const ch of rowStr) {
        const key = document.createElement("button");
        key.type = "button";
        if (ch === "+") {
          key.className = "kb-key wide";
          key.dataset.ch = "\n";
          key.textContent = "\u21B5";
        } else if (ch === "-") {
          key.className = "kb-key wide";
          key.dataset.ch = "\b";
          key.textContent = "\u232B";
        } else {
          key.className = "kb-key" + cls(ch);
          if (hint && ch === hint) hintKey = key;
          key.dataset.ch = ch;
          key.textContent = ch.toUpperCase();
        }
        row.appendChild(key);
      }
      els.kb.appendChild(row);
    }
  } else {
    const scroll = document.createElement("div");
    scroll.className = "tray-scroll";
    const grid = document.createElement("div");
    grid.className = "tray-grid";
    [...CN_TRAY].forEach((ch, i) => {
      if (i === TRAY_HOT) {
        const gap = document.createElement("span");
        gap.className = "tray-gap";
        grid.appendChild(gap);
      }
      const key = document.createElement("button");
      key.type = "button";
      key.className = "kb-key tray-key" + cls(ch);
      if (hint && ch === hint) hintKey = key;
      key.dataset.ch = ch;
      key.textContent = ch;
      grid.appendChild(key);
    });
    scroll.appendChild(grid);
    els.kb.appendChild(scroll);
    const actions = document.createElement("div");
    actions.className = "kb-row";
    for (const [ch, glyph] of [["\n", "\u21B5"], ["\b", "\u232B"]]) {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "kb-key wide";
      key.dataset.ch = ch;
      key.textContent = glyph;
      actions.appendChild(key);
    }
    els.kb.appendChild(actions);
  }
  // 提示字符可能在低频段，滚动字架把它带进视野
  if (hintKey) hintKey.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// ---------------------------------------------------------------- 工作单 / 状态条

export function updateWorksheet(game, store) {
  const core = game.core();
  const st = store.data[game.track()].stats;
  els.wsIssue.textContent = core.kind === engine.MODES.DAILY && core.day ? String(engine.issueNoOf(core.day)) : "-";
  const rate = st.played > 0 ? Math.round((st.wins / st.played) * 100) : 0;
  els.wsWinrate.textContent = st.played > 0 ? `${rate}%` : "-";
  els.wsStreak.textContent = String(st.streak);
  const round = core.players[core.active];
  els.wsChances.textContent = String(engine.chancesLeft(round));
  // 提示按钮：双人对抗 / 终局 / 已用提示时隐藏
  els.btnHint.hidden = core.kind === engine.MODES.DUEL || core.done || round.status !== engine.STATUS.PLAYING || Boolean(round.hint);
  const max = Math.max(1, ...st.dist);
  [...els.wsDist.children].forEach((bar, i) => {
    bar.style.height = `${Math.max(15, Math.round((st.dist[i] / max) * 100))}%`;
    bar.classList.toggle("hot", st.dist[i] > 0 && st.dist[i] === max);
    bar.classList.toggle("gap", st.dist[i] === 0 && max === 1);
  });
}

function renderDuelTurn(game) {
  const core = game.core();
  if (core.kind !== engine.MODES.DUEL || core.done) {
    els.duelTurn.hidden = true;
    return;
  }
  els.duelTurn.hidden = false;
  const name = core.active === 0 ? i18n.t("playerA") : i18n.t("playerB");
  els.duelTurn.textContent = i18n.t("duelTurn", { name });
}

export function renderBanner(game, store, dayKey) {
  const core = game.core();
  const daily = store.data[game.track()].daily;
  const show = core.kind === engine.MODES.DAILY && core.done && daily && daily.day === dayKey;
  if (!show) {
    els.banner.hidden = true;
    return;
  }
  els.banner.hidden = false;
  els.banner.classList.toggle("lose", daily.won !== true);
  els.banner.textContent = daily.won === true ? i18n.t("bannerWin") : i18n.t("bannerLose", { word: core.answer });
}

// ---------------------------------------------------------------- 弹层

export function openPanel(name) {
  const el = { help: els.panelHelp, stats: els.panelStats, modes: els.panelModes, result: els.panelResult }[name];
  if (el) el.hidden = false;
}
export function closePanels() {
  for (const el of [els.panelHelp, els.panelStats, els.panelModes, els.panelResult]) el.hidden = true;
}
export function anyPanelOpen() {
  return [els.panelHelp, els.panelStats, els.panelModes, els.panelResult].some((el) => !el.hidden);
}

export function highlightModes(game) {
  const mode = game.mode();
  els.modeDaily.classList.toggle("on", mode === engine.MODES.DAILY);
  els.modePractice.classList.toggle("on", mode === engine.MODES.PRACTICE);
  els.modeDuel.classList.toggle("on", mode === engine.MODES.DUEL);
  els.trackEn.classList.toggle("on", game.track() === engine.TRACKS.EN);
  els.trackCn.classList.toggle("on", game.track() === engine.TRACKS.CN);
  els.btnMode.textContent = i18n.t({ daily: "modeDaily", practice: "modePractice", duel: "modeDuel" }[mode]);
  els.btnTrack.textContent = i18n.t(game.track() === engine.TRACKS.CN ? "trackShortZh" : "trackShortEn");
  els.btnMode.classList.toggle("lit", mode !== engine.MODES.DAILY);
}

export function showStats(game, store) {
  const st = store.data[game.track()].stats;
  const rate = st.played > 0 ? Math.round((st.wins / st.played) * 100) : 0;
  const trackName = i18n.t(game.track() === engine.TRACKS.CN ? "trackCn" : "trackEn");
  els.statsBody.innerHTML = "";
  const rows = document.createElement("div");
  rows.className = "stats-rows";
  for (const [label, val] of [[i18n.t("statsPlayed"), st.played], [i18n.t("statsWins"), st.wins], [i18n.t("statsWinrate"), `${rate}%`], [i18n.t("statsMaxStreak"), st.maxStreak]]) {
    const cell = document.createElement("div");
    cell.className = "stats-cell";
    const b = document.createElement("b");
    b.textContent = String(val);
    const s = document.createElement("span");
    s.textContent = label;
    cell.append(b, s);
    rows.appendChild(cell);
  }
  const distTitle = document.createElement("div");
  distTitle.style.cssText = "font-size:12px;letter-spacing:0.1em;color:#8a744d;margin-bottom:6px;";
  distTitle.textContent = `${trackName} \u00B7 ${i18n.t("statsDist")}`;
  const dist = document.createElement("div");
  dist.className = "dist-rows";
  const max = Math.max(1, ...st.dist);
  for (let i = 0; i < engine.MAX_ROWS; i++) {
    const row = document.createElement("div");
    row.className = "dist-row";
    const no = document.createElement("span");
    no.className = "no";
    no.textContent = String(i + 1);
    const bar = document.createElement("div");
    bar.className = "bar" + (st.dist[i] === max && st.dist[i] > 0 ? " hot" : "");
    bar.style.width = `${Math.max(12, Math.round((st.dist[i] / max) * 100))}%`;
    bar.textContent = String(st.dist[i]);
    row.append(no, bar);
    dist.appendChild(row);
  }
  els.statsBody.append(rows, distTitle, dist);
}

// 结果面板：finished = { kind, won?, guesses?, winner?, turns? }；shareText 由 main 组装传入
export function showResult(game, store, finished, extra = {}) {
  const core = game.core();
  els.resultKicker.textContent = i18n.t({ daily: "modeDaily", practice: "modePractice", duel: "modeDuel" }[core.kind]);
  if (finished.kind === engine.MODES.DUEL) {
    els.resultTitle.textContent = finished.winner === 0 ? i18n.t("duelWinA") : finished.winner === 1 ? i18n.t("duelWinB") : i18n.t("duelDraw");
    const tally = store.data[game.track()].duelTally;
    els.resultNote.textContent = i18n.t("duelRecord", { a: tally.a, b: tally.b });
    els.resultGrid.innerHTML = "";
    els.resultBadge.hidden = true;
  } else {
    els.resultTitle.textContent = finished.won ? i18n.t("resultWin") : i18n.t("resultLose");
    els.resultNote.textContent = finished.won
      ? i18n.t("resultTurns", { n: finished.guesses })
      : `${i18n.t("resultAnswer")}: ${core.answer}`;
    // 用了提示的胜局在结果页标注（不计入战绩口径）
    const hinted = finished.won && Boolean(core.players[0].hint);
    els.resultBadge.hidden = !hinted;
    if (hinted) els.resultBadge.textContent = i18n.t("resultHinted");
    buildShareGrid(core);
  }
  els.btnAgain.hidden = core.kind !== engine.MODES.PRACTICE;
  els.shareText.hidden = true;
  els.shareText.value = extra.shareText ?? "";
  if (extra.note) els.resultNote.textContent = extra.note;
  openPanel("result");
}

function buildShareGrid(core) {
  els.resultGrid.innerHTML = "";
  for (const row of core.players[0].rows) {
    const line = document.createElement("div");
    line.className = "sg-row";
    for (let i = 0; i < row.guess.length; i++) {
      const cell = document.createElement("span");
      cell.className = `sg-cell ${row.fb[i]}`;
      cell.textContent = row.guess[i];
      line.appendChild(cell);
    }
    els.resultGrid.appendChild(line);
  }
}

export function fillShareText(text) {
  els.shareText.value = text;
  els.shareText.hidden = false;
  els.shareText.select();
}

export function toast(text) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = text;
  els.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 1500);
}

export function applyLocale(game) {
  highlightModes(game);
  renderDuelTurn(game);
  const core = game.core();
  if (core.kind === engine.MODES.DUEL && !core.done) {
    els.boards.querySelectorAll(".board-tag").forEach((tag, i) => {
      tag.textContent = i === 0 ? i18n.t("playerA") : i18n.t("playerB");
    });
  }
}
