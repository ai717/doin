// main.mjs —— 装配入口：加载语言/存档，创建 game 与 ui，绑定事件，协调音效与记录。
import * as i18n from "./i18n.mjs";
import * as storage from "./storage.mjs";
import * as audio from "./audio.mjs";
import { createGame } from "./game.mjs";
import { createUI, bindMenuAndDialogs } from "./ui.mjs";
import { STATUS_READY, STATUS_WON, STATUS_LOST } from "./engine.mjs";

const locale = i18n.loadLocale();
const t = i18n.strings(locale);
document.documentElement.lang = i18n.htmlLang(locale);
document.title = t.docTitle;
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute("content", t.metaDesc);

const DIFF_LABEL = { beginner: () => t.beginner, intermediate: () => t.intermediate, expert: () => t.expert };
const DIFF_IDS = ["beginner", "intermediate", "expert"];

const el = (id) => document.getElementById(id);

// 把 data-i18n 标记的静态文本替换为当前语言，保证英文模式下界面不再残留中文。
function applyStaticTexts() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const text = t[node.getAttribute("data-i18n")];
    if (typeof text === "string") node.textContent = text;
  });
}

let saved = storage.load();
const game = createGame();
const ui = createUI(t);
const dom = bindMenuAndDialogs(t, { onNewGame: newGame });

let pendingRecord = null;

function play() {
  audio.setMuted(saved.prefs.muted);
  syncSoundBtn();
}

function syncSoundBtn() {
  el("btn-sound").textContent = saved.prefs.muted ? "🔇" : "🔊";
}

function syncDifficultyUI() {
  const d = game.currentDifficulty();
  for (const id of DIFF_IDS) {
    const m = el("menu-" + id);
    if (m) m.setAttribute("aria-checked", String(id === d));
    const w = el("diff-" + id);
    if (w) {
      w.setAttribute("aria-checked", String(id === d));
      w.classList.toggle("is-active", id === d);
    }
  }
  el("diff-custom")?.classList.toggle("is-active", d === "custom");
}

function fmtSec(ms) {
  return (ms / 1000).toFixed(1);
}

function bestListHTML() {
  const d = game.currentDifficulty();
  const list = saved.records?.[d] ?? [];
  const title = el("best-title");
  if (title) title.textContent = DIFF_LABEL[d] ? `${t.bestTimesTitle} · ${DIFF_LABEL[d]()}` : t.bestTimesTitle;
  const empty = el("best-empty");
  const ol = el("best-list");
  ol.innerHTML = "";
  if (list.length === 0) {
    ol.hidden = true;
    empty.hidden = false;
    empty.textContent = t.rankEmpty;
    return;
  }
  ol.hidden = false;
  empty.hidden = true;
  for (const rec of list) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = rec.name || t.recordNamePlaceholder;
    const time = document.createElement("b");
    time.textContent = fmtSec(rec.timeMs) + " " + t.sec;
    li.append(name, time);
    ol.appendChild(li);
  }
}

function syncAll() {
  ui.sync(game.state());
  ui.syncTime(game.elapsedMs());
  syncDifficultyUI();
  bestListHTML();
}

function statusText() {
  const s = game.state().status;
  if (s === STATUS_WON) return t.statusWon;
  if (s === STATUS_LOST) return t.statusLost;
  return t.statusReady;
}

function newGame() {
  game.newGame(game.currentDifficulty());
  ui.buildBoard(game.state());
  ui.setStatusText(t.statusReady);
  pendingRecord = null;
  syncAll();
}

function applyDifficulty(id) {
  if (id === "custom") { openCustom(); return; }
  game.newGame(id);
  saved.prefs.difficulty = id;
  storage.save(saved);
  ui.buildBoard(game.state());
  ui.setStatusText(t.statusReady);
  pendingRecord = null;
  syncAll();
}

function doIntent(intent) {
  const res = game.intent(intent);
  if (!res.changed) return;
  switch (res.effect) {
    case "reveal": audio.sfx.reveal(); break;
    case "flag": audio.sfx.flag(); break;
    case "question": audio.sfx.question(); break;
    case "unmark": audio.sfx.question(); break;
    case "chord": audio.sfx.chord(); break;
    default: break;
  }
  const s = game.state().status;
  ui.sync(game.state());
  if (s === STATUS_WON) {
    audio.sfx.win();
    onWin();
  } else if (s === STATUS_LOST) {
    audio.sfx.explode();
    ui.setStatusText(t.statusLost);
  } else {
    ui.setStatusText(statusText());
  }
}

function onWin() {
  ui.setStatusText(t.statusWon);
  const diff = game.currentDifficulty();
  const timeMs = game.elapsedMs();
  if (diff !== "custom" && storage.qualifies(saved.records?.[diff] ?? [], timeMs)) {
    pendingRecord = { difficulty: diff, timeMs, date: new Date().toISOString().slice(0, 10) };
    el("record-body").textContent = i18n.format(t.recordBody, DIFF_LABEL[diff](), fmtSec(timeMs));
    el("record-name").value = "";
    dom.closeAllDialogs();
    dom.openDialog(el("dlg-record"));
    setTimeout(() => el("record-name").focus(), 30);
  }
  bestListHTML();
}

// ── 事件绑定 ─────────────────────────────────────

function cellFromEvent(e) {
  const cell = e.target.closest(".cell");
  return cell ? Number(cell.dataset.index) : -1;
}

const board = el("board");

// 桌面：左键翻开，右键插旗
board.addEventListener("mousedown", (e) => {
  if (e.button === 0 && cellFromEvent(e) >= 0) {
    ui.setPress(true);
    ui.sync(game.state());
  }
});
board.addEventListener("mouseup", (e) => {
  if (e.button !== 0) return;
  ui.setPress(false);
  const i = cellFromEvent(e);
  if (i < 0) return;
  doIntent({ type: "reveal", index: i });
});
board.addEventListener("mouseleave", () => {
  ui.setPress(false);
  ui.sync(game.state());
});
board.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const i = cellFromEvent(e);
  if (i < 0) return;
  doIntent({ type: "flag", index: i });
});

// 触屏：短按翻开，长按插旗
let touchStart = null;
let touchTimer = null;
let longPressed = false;
board.addEventListener("touchstart", (e) => {
  const i = cellFromEvent(e);
  if (i < 0) return;
  longPressed = false;
  ui.setPress(true);
  ui.sync(game.state());
  touchStart = e;
  touchTimer = setTimeout(() => {
    longPressed = true;
    ui.setPress(false);
    doIntent({ type: "flag", index: i });
  }, 300);
}, { passive: true });
board.addEventListener("touchend", (e) => {
  clearTimeout(touchTimer);
  ui.setPress(false);
  if (!longPressed) {
    const i = cellFromEvent(e);
    if (i >= 0) doIntent({ type: "reveal", index: i });
  }
  ui.sync(game.state());
});
board.addEventListener("touchmove", () => {
  clearTimeout(touchTimer);
  ui.setPress(false);
  ui.sync(game.state());
}, { passive: true });

// 笑脸 = 新一局
el("smiley").addEventListener("click", newGame);
el("menu-new").addEventListener("click", () => { dom.closeMenus(); newGame(); });

// 难度（两翼 + 菜单共用）
for (const id of DIFF_IDS) {
  el("diff-" + id).addEventListener("click", () => applyDifficulty(id));
  el("menu-" + id).addEventListener("click", () => { dom.closeMenus(); applyDifficulty(id); });
}
el("diff-custom").addEventListener("click", openCustom);
el("menu-custom").addEventListener("click", () => { dom.closeMenus(); openCustom(); });

// 自定义弹窗
function openCustom() {
  el("custom-width").value = "9";
  el("custom-height").value = "9";
  el("custom-mines").value = "10";
  el("custom-err").hidden = true;
  dom.closeAllDialogs();
  dom.openDialog(el("dlg-custom"));
}
el("custom-ok").addEventListener("click", () => {
  const rows = Number(el("custom-height").value);
  const cols = Number(el("custom-width").value);
  const mines = Number(el("custom-mines").value);
  if (!game.newCustom({ rows, cols, mines })) {
    el("custom-err").hidden = false;
    el("custom-err").textContent = t.customInvalid;
    return;
  }
  dom.closeAllDialogs();
  ui.buildBoard(game.state());
  ui.setStatusText(t.statusReady);
  pendingRecord = null;
  syncAll();
});

// 快榜
el("menu-best").addEventListener("click", () => {
  dom.closeMenus();
  el("best-title")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

// 帮助
el("btn-help").addEventListener("click", () => {
  el("rules-body").textContent = t.rulesBody;
  dom.closeAllDialogs();
  dom.openDialog(el("dlg-rules"));
});
el("menu-rules").addEventListener("click", () => {
  dom.closeMenus();
  el("rules-body").textContent = t.rulesBody;
  dom.closeAllDialogs();
  dom.openDialog(el("dlg-rules"));
});
el("menu-about").addEventListener("click", () => {
  dom.closeMenus();
  el("about-body").textContent = t.aboutBody;
  dom.closeAllDialogs();
  dom.openDialog(el("dlg-about"));
});

// 记录弹窗
el("record-save").addEventListener("click", () => {
  if (pendingRecord) {
    const name = el("record-name").value.trim().slice(0, 20);
    const res = storage.recordResult(saved, { won: true, ...pendingRecord, name });
    saved = res.state;
    storage.save(saved);
  }
  pendingRecord = null;
  dom.closeAllDialogs();
  bestListHTML();
});
el("record-skip").addEventListener("click", () => {
  pendingRecord = null;
  dom.closeAllDialogs();
  bestListHTML();
});

// 音效 / 语言
el("btn-sound").addEventListener("click", () => {
  saved.prefs.muted = !saved.prefs.muted;
  storage.save(saved);
  audio.setMuted(saved.prefs.muted);
  syncSoundBtn();
});
el("btn-lang").addEventListener("click", () => {
  i18n.saveLocale(locale === "zh" ? "en" : "zh");
  location.reload();
});

// 键盘：F2 新游戏
document.addEventListener("keydown", (e) => {
  if (e.key === "F2") { e.preventDefault(); newGame(); }
});

// 首次手势解锁音频
function unlockOnce() {
  audio.unlock();
  window.removeEventListener("pointerdown", unlockOnce);
}
window.addEventListener("pointerdown", unlockOnce);

// ── 启动 ───────────────────────────────────────
applyStaticTexts();
play();
ui.buildBoard(game.state());
syncAll();

// 计时器走字（仅在局中刷新 LED 秒数）
setInterval(() => {
  if (game.state().status !== STATUS_READY) {
    ui.syncTime(game.elapsedMs());
  }
}, 200);