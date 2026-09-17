// 连连看 link-up · DOM 层（唯一碰 DOM 的地方）：棋盘网格 / HUD / 弹窗 / Toast / 键盘

import { strings, format, htmlLang } from "./i18n.mjs?v=35ad794d8cf9";
import { saveLocale } from "./i18n.mjs?v=35ad794d8cf9";
import { isHoleAt } from "./engine.mjs?v=35ad794d8cf9";
import * as audio from "./audio.mjs?v=35ad794d8cf9";

const TILE_ICONS = [
  '<path d="M20 25h24v25H20z" fill="currentColor"/><path d="M16 24h32M24 17h16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M25 29v17M39 29v17" stroke="#fff" stroke-opacity=".45" stroke-width="2"/><path d="M32 50v8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
  '<path d="M32 10l5 9 10 2-7 7 2 10-10-5-10 5 2-10-7-7 10-2z" fill="currentColor"/><path d="M32 17v21M22 26h20" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>',
  '<path d="M10 35c8-16 27-18 44-5-7 16-24 22-44 5z" fill="currentColor"/><path d="M10 35c12 3 23 1 36-8M49 28l7-5-3 9" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M12 37c8-14 18-14 20-3 2-11 12-11 20 3-6 8-14 11-20 4-6 7-14 4-20-4z" fill="currentColor"/><path d="M18 43h28" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>',
  '<ellipse cx="32" cy="33" rx="20" ry="15" fill="currentColor"/><path d="M20 27h24M24 39h16" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/><path d="M32 18v30" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>',
  '<path d="M32 52C18 43 12 34 18 25c4-6 10-5 14 2 4-7 10-8 14-2 6 9 0 18-14 27z" fill="currentColor"/><path d="M32 25v20M23 34h18" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>',
  '<path d="M12 20h40v28H12z" fill="currentColor"/><path d="M12 20c8 7 32 7 40 0M18 48c5-8 23-8 28 0" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/><path d="M25 28v12M39 28v12" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>',
  '<path d="M14 27h36v20H14z" fill="currentColor"/><path d="M18 27c2-12 26-12 28 0M22 35h20M22 41h20" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>',
  '<path d="M32 12c5 8 17 11 17 23a17 17 0 1 1-34 0c0-12 12-15 17-23z" fill="currentColor"/><path d="M32 25c-3 6-3 10 0 17 3-7 3-11 0-17z" fill="#fff" fill-opacity=".55"/>',
  '<path d="M32 10c5 8 13 11 13 20a13 13 0 1 1-26 0c0-9 8-12 13-20z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M21 49h22" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
  '<path d="M32 9l5 16 16 5-16 5-5 20-5-20-16-5 16-5z" fill="currentColor"/><circle cx="32" cy="30" r="5" fill="#fff" fill-opacity=".55"/>',
  '<path d="M13 42c15-4 22-13 27-28 6 9 9 20 11 31-14-1-26-2-38-3z" fill="currentColor"/><path d="M18 40c10-7 16-13 22-23" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>',
  '<path d="M18 40l14-28 14 28-14 12z" fill="currentColor"/><path d="M18 40h28M32 12v40" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>',
  '<path d="M16 27c0-8 7-14 16-14s16 6 16 14v18H16z" fill="currentColor"/><path d="M24 45v7h16v-7M24 27h16" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>',
  '<path d="M13 36c7-13 17-13 19 0 2-13 12-13 19 0-7 13-17 13-19 0-2 13-12 13-19 0z" fill="currentColor"/><path d="M13 36h38" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>',
  '<circle cx="32" cy="32" r="20" fill="currentColor"/><circle cx="32" cy="32" r="10" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/><path d="M32 16v32M16 32h32" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>',
];
const LEVEL_COUNT = 50;

function tileName(index) {
  return strings[locale].tileNames?.[index % TILE_ICONS.length] || `Tile ${index + 1}`;
}

function tileArt(index) {
  const span = document.createElement("span");
  span.className = "tile-art tile-art-" + (index % TILE_ICONS.length);
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 64 64" focusable="false">${TILE_ICONS[index % TILE_ICONS.length]}</svg>`;
  return span;
}

let game = null;
let storage = null;
let locale = "zh";

let board = null;
let cells = [];
let curRows = 0;
let curCols = 0;
let focused = null;
let prevSnap = null;
let lastTickSec = -1;
let lastLevel = 1;
let lastDailyDate = null;
let timerId = 0;
let toastTimer = 0;
let openModal = null;
let modalReturnFocus = null;

const $ = (id) => document.getElementById(id);

// ---------- 初始化 ----------
export function init(cfg) {
  game = cfg.game;
  storage = cfg.storage;
  locale = cfg.locale;
  board = $("board");

  const els = {
    audio: $("btn-audio-toggle"),
    lang: $("btn-lang-toggle"),
    help: $("btn-help"),
    help2: $("btn-help-2"),
    levels: $("btn-levels"),
    restart: $("btn-restart"),
    pause: $("btn-pause"),
    hint: $("btn-hint"),
    shuffle: $("btn-shuffle"),
  };

  els.audio.addEventListener("click", toggleSound);
  els.lang.addEventListener("click", toggleLang);
  els.help.addEventListener("click", () => showModal($("modal-help")));
  els.help2.addEventListener("click", () => showModal($("modal-help")));
  els.levels.addEventListener("click", () => showLevels());
  els.restart.addEventListener("click", restartCurrent);
  els.pause.addEventListener("click", () => game.togglePause());
  els.hint.addEventListener("click", () => game.intentHint());
  els.shuffle.addEventListener("click", () => game.intentShuffle());

  $("btn-close-help").addEventListener("click", () => hideModal($("modal-help")));
  $("btn-confirm-help").addEventListener("click", () => hideModal($("modal-help")));
  $("btn-close-levels").addEventListener("click", () => hideModal($("modal-levels")));
  $("btn-daily").addEventListener("click", () => {
    hideModal($("modal-levels"));
    lastDailyDate = todayStr();
    game.startDaily(lastDailyDate);
  });
  $("btn-win-replay").addEventListener("click", () => {
    hideModal($("modal-win"));
    if (lastDailyDate) game.startDaily(lastDailyDate);
    else game.startLevel(lastLevel);
  });
  $("btn-win-next").addEventListener("click", () => {
    hideModal($("modal-win"));
    game.startLevel(Math.min(LEVEL_COUNT, lastLevel + 1));
  });
  $("btn-win-levels").addEventListener("click", () => {
    hideModal($("modal-win"));
    showLevels();
  });

  document.addEventListener("keydown", onKeydown);

  applyI18n(locale);
  updateSoundIcon(storage.load().sound);

  // 视口改变时重新计算牌面字号。桌面端切换到移动端（或旋转手机）
  // 若沿用旧字号，会让小棋盘上的民俗字样挤出牌面。
  window.addEventListener("resize", applyCellFont, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", applyCellFont, { passive: true });
  }

  timerId = setInterval(timerTick, 250);
}

export function showLevels() {
  buildLevelList();
  showModal($("modal-levels"));
}

// 重玩当前关 / 当前每日挑战
function restartCurrent() {
  hideModal($("modal-win"));
  if (game.phase === "menu") {
    showLevels();
    return;
  }
  if (lastDailyDate) game.startDaily(lastDailyDate);
  else game.startLevel(lastLevel);
}

export function onStart(snap) {
  hideModal($("modal-levels"));
  hideModal($("modal-win"));
  hideModal($("modal-help"));
  lastLevel = snap.levelIndex;
  lastDailyDate = snap.dailyDate || null;
  prevSnap = null;
  focused = null;
  buildBoard(snap.rows, snap.cols);
  focused = firstFilledCell(snap);
  onState(snap);
  // 进入棋盘后把键盘焦点放到第一张牌，避免焦点停留在已关闭的选关按钮。
  queueMicrotask(focusFocusedCell);
}

export function onState(snap) {
  if (!snap) return;
  if (!focused || !isFilledCell(focused.r, focused.c, snap)) focused = firstFilledCell(snap);
  updateCells(snap);
  updateHud(snap);
  syncPause(snap.paused);
  prevSnap = snap;
}

export function onWin(result) {
  $("val-win-score").textContent = result.score;
  $("val-win-steps").textContent = result.steps;
  $("val-win-combo").textContent = result.longestCombo;
  $("val-win-time").textContent = fmtTime(result.elapsedMs);
  $("win-title").textContent = strings[locale][result.timedOut ? "timeoutTitle" : "winTitle"];
  $("win-subtitle").textContent = strings[locale][result.timedOut ? "timeoutSubtitle" : "winSubtitle"];
  $("badge-newbest").classList.toggle("hidden", !result.isNewBest);
  const rating = result.timedOut ? 0 : result.score >= result.max * 0.9 ? 3 : result.score >= result.max * 0.72 ? 2 : 1;
  document.querySelectorAll(".rank-star").forEach((star) => {
    star.classList.toggle("is-lit", Number(star.dataset.star) <= rating);
  });
  $("btn-win-next").classList.toggle("hidden", result.kind === "daily" || result.levelIndex >= LEVEL_COUNT);
  showModal($("modal-win"));
}

export function onReject(cell) {
  const btn = cells[cell.r] && cells[cell.r][cell.c];
  if (!btn) return;
  btn.classList.remove("shake");
  void btn.offsetWidth;
  btn.classList.add("shake");
  setTimeout(() => btn.classList.remove("shake"), 320);
}

export function onHint(pair) {
  glowCell(pair.a);
  glowCell(pair.b);
}

export function onShuffle() {
  // 棋盘状态已由 onState 同步，这里仅做提示动画兜底
}

export function onNoMove() {
  toast("noMove");
}

export function onToast(msg) {
  toast(msg.key || "noHint");
}

export function onPaused() {
  syncPause(true);
  toast("pausedToast");
}

export function onResumed() {
  syncPause(false);
}

function syncPause(paused) {
  const overlay = $("pause-overlay");
  const pauseButton = $("btn-pause");
  if (overlay) {
    overlay.classList.toggle("hidden", !paused);
    overlay.setAttribute("aria-hidden", String(!paused));
  }
  if (pauseButton) pauseButton.setAttribute("aria-pressed", String(Boolean(paused)));
}

// ---------- 棋盘 ----------
function buildBoard(rows, cols) {
  curRows = rows;
  curCols = cols;
  // --cols/--rows 设到 board-frame（宽度计算容器），网格经继承同样生效
  if (board.parentElement) {
    board.parentElement.style.setProperty("--cols", cols);
    board.parentElement.style.setProperty("--rows", rows);
  }
  board.style.setProperty("--cols", cols);
  board.style.setProperty("--rows", rows);
  board.textContent = "";
  cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.dataset.filled = "0";
      btn.tabIndex = -1;
      btn.addEventListener("click", () => {
        if (btn.classList.contains("empty") || btn.classList.contains("removed") || btn.classList.contains("hole")) return;
        focused = { r, c };
        game.intentSelect(r, c);
      });
      board.appendChild(btn);
      row.push(btn);
    }
    cells.push(row);
  }
  applyCellFont();
}

function applyCellFont() {
  if (!board || !curCols) return;
  const w = board.clientWidth;
  if (!w) return;
  const fs = Math.max(10, Math.round((w / curCols) * 0.52));
  board.style.setProperty("--cell-fs", fs + "px");
}

function isFilledCell(r, c, snap) {
  return Boolean(
    snap &&
    snap.grid?.[r]?.[c] !== null &&
    snap.grid?.[r]?.[c] !== undefined &&
    !isHoleAt(snap.rows, snap.cols, r, c, snap.variant)
  );
}

function firstFilledCell(snap) {
  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      if (isFilledCell(r, c, snap)) return { r, c };
    }
  }
  return null;
}

function focusFocusedCell() {
  if (!focused) return;
  const btn = cells[focused.r]?.[focused.c];
  if (!btn || btn.disabled) return;
  refreshFocusRing();
  btn.focus({ preventScroll: true });
}

function updateCells(snap) {
  for (let r = 0; r < curRows; r++) {
    for (let c = 0; c < curCols; c++) {
      const btn = cells[r][c];
      const v = snap.grid[r][c];
      const wasFilled = btn.dataset.filled === "1";

      // 异形棋盘缺口：占位但不可见，保留网格轨道
      if (isHoleAt(curRows, curCols, r, c, snap.variant)) {
        btn.className = "cell hole";
        btn.disabled = true;
        btn.tabIndex = -1;
        btn.setAttribute("aria-hidden", "true");
        btn.removeAttribute("aria-label");
        btn.removeAttribute("aria-pressed");
        btn.replaceChildren();
        continue;
      }

      if (v === null) {
        btn.replaceChildren();
        btn.classList.remove("selected", "hint-glow", "shake", "kb-focus");
        btn.className = "cell " + (wasFilled ? "removed" : "empty");
        btn.disabled = true;
        btn.tabIndex = -1;
        btn.dataset.filled = "0";
        delete btn.dataset.symbol;
        // 清除旧牌面的可访问名称，避免消除后读屏仍播报已不存在的图案。
        btn.removeAttribute("aria-label");
        btn.removeAttribute("aria-pressed");
        btn.setAttribute("aria-hidden", "true");
        continue;
      }

      btn.className = "cell";
      btn.disabled = false;
      btn.removeAttribute("aria-hidden");
      btn.replaceChildren(tileArt(v));
      btn.dataset.filled = "1";
      btn.dataset.symbol = String(v);
      const isFocused = Boolean(focused && focused.r === r && focused.c === c);
      btn.tabIndex = isFocused ? 0 : -1;
      btn.setAttribute("aria-label", format(strings[locale].cellLabel, { s: tileName(v) }));
      btn.setAttribute("aria-pressed", String(Boolean(snap.selected && snap.selected.r === r && snap.selected.c === c)));

      if (snap.selected && snap.selected.r === r && snap.selected.c === c) btn.classList.add("selected");
      if (isFocused) btn.classList.add("kb-focus");
    }
  }
  applyCellFont();
}

function glowCell(cell) {
  const btn = cells[cell.r] && cells[cell.r][cell.c];
  if (!btn) return;
  btn.classList.add("hint-glow");
  setTimeout(() => btn.classList.remove("hint-glow"), 1800);
}

// ---------- HUD ----------
function updateHud(snap) {
  const scoreEl = $("val-score");
  const prevScore = prevSnap ? prevSnap.score : null;
  scoreEl.textContent = snap.score;
  $("val-score-max").textContent = "/" + snap.max;
  if (prevScore !== null && snap.score !== prevScore) bump(scoreEl);

  const comboEl = $("val-combo");
  const prevCombo = prevSnap ? prevSnap.combo : null;
  comboEl.textContent = "×" + snap.combo;
  if (prevCombo !== null && snap.combo !== prevCombo) bump(comboEl);

  $("val-steps").textContent = snap.steps;

  if (snap.kind === "daily") {
    $("val-chapter").textContent = strings[locale].daily;
    $("val-level").textContent = "";
  } else {
    const ch = Math.floor((snap.levelIndex - 1) / 10) + 1;
    $("val-chapter").textContent = format(strings[locale].chapterLabel, {
      ch,
      name: strings[locale]["chapterName_" + ch],
    });
    $("val-level").textContent = format(strings[locale].levelProgress, {
      level: snap.levelIndex,
      total: LEVEL_COUNT,
    });
  }

  $("btn-pause").textContent = snap.paused ? strings[locale].resume : strings[locale].pause;
}

function bump(el) {
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function timerTick() {
  if (!game || !game.state) return;
  game.tick(Date.now());
  if (game.phase !== "playing") return;
  const remain = game.dailyRemainMs();
  const ms = remain !== null ? remain : game.elapsedMs();
  $("val-time").textContent = fmtTime(ms);
  if (remain !== null) {
    const sec = Math.ceil(remain / 1000);
    if (sec <= 10 && sec >= 0 && sec !== lastTickSec) {
      audio.sfx.tick();
      lastTickSec = sec;
    }
  } else {
    lastTickSec = -1;
  }
}

function fmtTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

// ---------- 选关 ----------
function buildLevelList() {
  const data = storage.load();
  const wrap = $("level-list");
  wrap.textContent = "";
  for (let i = 1; i <= LEVEL_COUNT; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level-btn";
    const locked = i > data.unlocked;
    if (locked) btn.classList.add("locked");
    btn.dataset.level = String(i);
    btn.appendChild(document.createTextNode(String(i)));
    const tag = document.createElement("span");
    tag.className = "best-tag";
    const best = data.best && typeof data.best[String(i)] === "number" ? data.best[String(i)] : 0;
    if (best > 0) {
      tag.textContent = format(strings[locale].dailyBest, { score: best });
    } else if (locked) {
      tag.textContent = strings[locale].locked;
    }
    btn.appendChild(tag);
    btn.addEventListener("click", () => {
      if (locked) return;
      hideModal($("modal-levels"));
      lastDailyDate = null;
      game.startLevel(i);
    });
    wrap.appendChild(btn);
  }
  const daily = data.daily;
  $("val-daily-best").textContent = format(strings[locale].dailyBest, {
    score: daily ? daily.score : 0,
  });
}

// ---------- 弹窗 / Toast ----------
function showModal(modal) {
  if (!modal) return;
  if (openModal && openModal !== modal) hideModal(openModal, false);
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.classList.remove("hidden");
  openModal = modal;
  const focusable = modal.querySelector(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  queueMicrotask(() => focusable?.focus());
}
function hideModal(modal, restoreFocus = true) {
  if (!modal) return;
  modal.classList.add("hidden");
  if (openModal === modal) {
    openModal = null;
    if (restoreFocus && modalReturnFocus instanceof HTMLElement && document.contains(modalReturnFocus)) {
      modalReturnFocus.focus();
    }
    modalReturnFocus = null;
  }
}

let toastTimerHandle = 0;
function toast(key) {
  const el = $("toast");
  el.textContent = strings[locale][key] || key;
  el.classList.remove("hidden");
  clearTimeout(toastTimerHandle);
  toastTimerHandle = setTimeout(() => el.classList.add("hidden"), 1800);
}

// ---------- 声音 / 语言 ----------
function toggleSound() {
  const data = storage.load();
  const next = !data.sound;
  storage.setSound(next);
  audio.setEnabled(next);
  updateSoundIcon(next);
}

function updateSoundIcon(on) {
  $("icon-sound-on").classList.toggle("hidden", !on);
  $("icon-sound-off").classList.toggle("hidden", on);
}

function toggleLang() {
  const next = locale === "zh" ? "en" : "zh";
  saveLocale(next);
  // 全量重渲染：切换后刷新页面，保持 doin.lang 全局偏好
  location.reload();
}

export function applyI18n(l) {
  locale = l;
  document.documentElement.lang = htmlLang(l);
  document.title = strings[l].appTitle + " · DOIN.WIN";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (strings[l] && strings[l][key] !== undefined) el.textContent = strings[l][key];
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.dataset.i18nAriaLabel;
    if (strings[l] && strings[l][key] !== undefined) el.setAttribute("aria-label", strings[l][key]);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (strings[l] && strings[l][key] !== undefined) el.setAttribute("title", strings[l][key]);
  });
  $("btn-lang-toggle").textContent = strings[l].switchLang;
  $("board").setAttribute("aria-label", strings[l].boardAria);
}

// ---------- 键盘 ----------
function onKeydown(e) {
  if (openModal) {
    if (e.key === "Escape") {
      e.preventDefault();
      hideModal(openModal);
      return;
    }
    if (e.key === "Tab") {
      const focusable = [...openModal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((el) => !el.closest(".hidden") && el.getClientRects().length > 0);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !openModal.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    return;
  }
  if (!game || game.phase !== "playing" || game.paused) return;
  if (!curRows || !curCols) return;

  const key = e.key;
  if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
    e.preventDefault();
    if (!focused) focused = { r: Math.floor(curRows / 2), c: Math.floor(curCols / 2) };
    let nr = focused.r;
    let nc = focused.c;
    if (key === "ArrowUp") nr -= 1;
    if (key === "ArrowDown") nr += 1;
    if (key === "ArrowLeft") nc -= 1;
    if (key === "ArrowRight") nc += 1;
    const next = nextPlayableCell(nr, nc, key);
    if (next) {
      nr = next.r;
      nc = next.c;
      focused = { r: nr, c: nc };
      refreshFocusRing();
      cells[nr][nc].focus({ preventScroll: true });
    }
  } else if (key === "Enter" || key === " ") {
    e.preventDefault();
    if (!focused) focused = { r: Math.floor(curRows / 2), c: Math.floor(curCols / 2) };
    const btn = cells[focused.r] && cells[focused.r][focused.c];
    if (btn && !btn.classList.contains("hole") && !btn.classList.contains("removed") && !btn.classList.contains("empty")) {
      game.intentSelect(focused.r, focused.c);
    }
  } else if (key === "Escape") {
    const st = game.state;
    if (st && st.selected) {
      game.intentSelect(st.selected.r, st.selected.c);
    }
  }
}

function nextPlayableCell(r, c, key) {
  const dr = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
  const dc = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
  while (r >= 0 && r < curRows && c >= 0 && c < curCols) {
    const btn = cells[r]?.[c];
    if (btn && !btn.classList.contains("hole") && !btn.classList.contains("empty") && !btn.classList.contains("removed")) {
      return { r, c };
    }
    r += dr;
    c += dc;
  }
  return null;
}

function refreshFocusRing() {
  for (const row of cells) {
    for (const btn of row) {
      btn.classList.remove("kb-focus");
      if (!btn.classList.contains("hole") && !btn.classList.contains("empty") && !btn.classList.contains("removed")) {
        btn.tabIndex = -1;
      }
    }
  }
  if (focused && cells[focused.r] && cells[focused.r][focused.c]) {
    const btn = cells[focused.r][focused.c];
    if (!btn.disabled && !btn.classList.contains("empty") && !btn.classList.contains("removed") && !btn.classList.contains("hole")) {
      btn.classList.add("kb-focus");
      btn.tabIndex = 0;
    }
  }
}

export function todayStr(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
