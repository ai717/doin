// main：装配层。绑定事件、协调引擎、渲染、UI。

import {
  createState, applyIntent, stepFrame, loadPuzzle, calcPuzzleStars,
  exportCanvas, importCanvas, STEP_DT,
  beginStroke, addStrokePoint, endStroke, cancelStroke, respawn,
} from "./engine.mjs";
import { createRenderer } from "./render.mjs";
import { createAudio } from "./audio.mjs";
import { htmlLang, loadLocale, saveLocale, strings, format } from "./i18n.mjs";
import * as storage from "./storage.mjs";
import { getPuzzle, getPuzzleCount, getChapterInfo } from "./puzzles.mjs";

// —— DOM refs ——
const byId = (id) => document.getElementById(id);

const refs = {
  canvas: byId("game-canvas"),
  title: byId("stage-title"),
  subtitle: byId("stage-subtitle"),
  backHome: byId("back-home"),
  backLabel: byId("back-label"),
  soundBtn: byId("btn-sound"),
  soundLabel: byId("sound-label"),
  langBtn: byId("btn-lang"),
  langLabel: byId("lang-label"),
  helpBtn: byId("btn-help"),
  tools: byId("tool-bar"),
  brushGroup: byId("brush-group"),
  toolNormal: byId("tool-normal"),
  toolBoost: byId("tool-boost"),
  toolSlow: byId("tool-slow"),
  toolScenery: byId("tool-scenery"),
  toolEraser: byId("tool-eraser"),
  toolUndo: byId("tool-undo"),
  btnPlay: byId("btn-play"),
  btnReset: byId("btn-reset"),
  btnZoomIn: byId("btn-zoom-in"),
  btnZoomOut: byId("btn-zoom-out"),
  modeFreestyle: byId("mode-freestyle"),
  modePuzzle: byId("mode-puzzle"),
  puzzlePanel: byId("puzzle-panel"),
  puzzleLevel: byId("puzzle-level"),
  puzzleStars: byId("puzzle-stars"),
  puzzleInk: byId("puzzle-ink"),
  puzzlePrev: byId("puzzle-prev"),
  puzzleNext: byId("puzzle-next"),
  puzzleChapter: byId("puzzle-chapter"),
  btnExport: byId("btn-export"),
  btnImport: byId("btn-import"),
  btnClear: byId("btn-clear"),
  toolsLabel: byId("tools-label"),
  exportLabel: byId("export-label"),
  importLabel: byId("import-label"),
  clearLabel: byId("clear-label"),
  bottomTip: byId("bottom-tip"),
  tipText: byId("tip-text"),
  overlay: byId("overlay"),
  overlayTitle: byId("overlay-title"),
  overlayText: byId("overlay-text"),
  overlayBtn: byId("overlay-btn"),
  noScript: byId("noscript-tip"),
  toast: byId("toast"),
  footerSpace: byId("footer-space"),
};

// —— Init ——
const locale = loadLocale();
const t = strings(locale);
document.documentElement.lang = htmlLang(locale);
document.title = t.docTitle;
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute("content", t.metaDesc);

let persist = storage.load();
const audio = createAudio({ muted: persist.prefs.muted });
const renderer = createRenderer(refs.canvas.getContext("2d"));

// 游戏状态
let state = createState({ rng: Math.random });
let currentPuzzleId = 1;
let lastTime = 0;
let rafId = null;
let drawing = false;
let drawStart = null;
let eraserActive = false;
let midDrag = false;
let dragStart = null;
let dragViewStart = null;

// —— UI Helpers ——

function updateUI() {
  // 模式
  if (state.mode === "puzzle") {
    refs.puzzlePanel.classList.remove("hidden");
    refs.brushGroup.classList.add("hidden");
    refs.modeFreestyle.classList.remove("active");
    refs.modePuzzle.classList.add("active");

    const chapter = Math.ceil(currentPuzzleId / 10);
    const chapInfo = getChapterInfo(chapter, locale);
    refs.puzzleChapter.textContent = format(t.chapter, chapter);
    refs.puzzleChapter.title = chapInfo.name;
    refs.puzzleLevel.textContent = format(t.puzzleLevel, currentPuzzleId);
    refs.puzzlePrev.disabled = currentPuzzleId <= 1;
    refs.puzzleNext.disabled = currentPuzzleId >= getPuzzleCount();

    // 已获星级
    const saved = persist.puzzleProgress[currentPuzzleId] || { stars: 0 };
    refs.puzzleStars.textContent = `⭐ ${saved.stars}/3`;

    // 墨水
    const left = state.inkLimit - state.inkUsed;
    refs.puzzleInk.textContent = format(t.inkLeft, Math.max(0, Math.round(left)));

    refs.tipText.textContent = strings(locale).tipPuzzle;
  } else {
    refs.puzzlePanel.classList.add("hidden");
    refs.tipText.textContent = strings(locale).tipDraw;
    refs.brushGroup.classList.remove("hidden");
    refs.modeFreestyle.classList.add("active");
    refs.modePuzzle.classList.remove("active");
  }

  // 线型工具高亮
  [refs.toolNormal, refs.toolBoost, refs.toolSlow, refs.toolScenery].forEach(el => {
    el.classList.remove("active");
  });
  switch (state.activeLineType) {
    case "normal": refs.toolNormal.classList.add("active"); break;
    case "boost": refs.toolBoost.classList.add("active"); break;
    case "slow": refs.toolSlow.classList.add("active"); break;
    case "scenery": refs.toolScenery.classList.add("active"); break;
  }

  // 播放状态
  if (state.playState === "playing") {
    refs.btnPlay.textContent = "⏸";
    refs.btnPlay.title = "暂停";
  } else {
    refs.btnPlay.textContent = "▶";
    refs.btnPlay.title = "播放";
  }
}

function refreshLocale() {
  const loc = loadLocale();
  const str = strings(loc);
  document.documentElement.lang = htmlLang(loc);
  document.title = str.docTitle;
  refs.title.textContent = str.title;
  refs.subtitle.textContent = str.subtitle;
  refs.backLabel.textContent = str.backHome;
  refs.soundLabel.textContent = audio.isMuted() ? str.soundOff : str.soundOn;
  refs.langLabel.textContent = str.langShort;
  refs.langBtn.setAttribute("aria-label", str.ariaLang);
  refs.soundBtn.setAttribute("aria-label", str.ariaSound);
  refs.toolsLabel.textContent = str.brushLabel;
  refs.exportLabel.textContent = str.exportLabel;
  refs.importLabel.textContent = str.importLabel;
  refs.clearLabel.textContent = str.clearLabel;
  // <noscript> 内部元素在 JS 启用时不会进入 DOM，这里拿到的恒为 null，需判空
  if (refs.noScript) refs.noScript.textContent = str.noscript;
  updateUI();
}

function showToast(msg) {
  refs.toast.textContent = msg;
  refs.toast.classList.add("show");
  clearTimeout(refs.toast._timeout);
  refs.toast._timeout = setTimeout(() => refs.toast.classList.remove("show"), 2000);
}

function showOverlay(title, text, btnText, callback) {
  refs.overlayTitle.textContent = title;
  refs.overlayText.textContent = text;
  refs.overlayBtn.textContent = btnText;
  refs.overlay.classList.add("show");
  refs.overlayBtn.onclick = () => {
    refs.overlay.classList.remove("show");
    if (callback) callback();
  };
}

// —— 游戏循环 ——
function loop(timestamp) {
  rafId = requestAnimationFrame(loop);
  const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : STEP_DT;
  lastTime = timestamp;

  // 推进物理
  stepFrame(state, STEP_DT);

  // 处理事件
  for (const ev of state.events) {
    handleEvent(ev);
  }
  state.events = [];

  // 渲染
  renderer.render(state, dt);

  // 更新拼图墨水显示
  if (state.mode === "puzzle") {
    const left = state.inkLimit - state.inkUsed;
    refs.puzzleInk.textContent = format(strings(locale).inkLeft, Math.max(0, Math.round(left)));
  }
}

function handleEvent(ev) {
  switch (ev.type) {
    case "star-collected":
      audio.star();
      break;
    case "finished":
      audio.win();
      const result = calcPuzzleStars(state);
      persist = storage.savePuzzleProgress(persist, currentPuzzleId, result.stars);
      storage.save(persist);
      showOverlay(
        strings(locale).puzzleComplete,
        format(strings(locale).puzzleStarsEarned, result.stars),
        "OK",
        () => state.playState = "stopped"
      );
      updateUI();
      break;
    case "crashed":
      audio.crash();
      // 回到最近的安全点并暂停，避免"摔了又摔"的死循环
      respawn(state);
      state.playState = "paused";
      showToast(strings(locale).crashToast);
      updateUI();
      break;
  }
}

// —— 拼图模式 ——
function loadCurrentPuzzle() {
  try {
    const pd = getPuzzle(currentPuzzleId);
    state = loadPuzzle(state, pd);
    updateUI();
  } catch (e) {
    console.error("Failed to load puzzle", e);
  }
}

// —— Canvas 事件 ——
function canvasPos(e) {
  const rect = refs.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
}

function viewToWorld(pos) {
  const dpr = window.devicePixelRatio || 1;
  const cx = refs.canvas.width / (2 * dpr);
  const cy = refs.canvas.height / (2 * dpr);
  const wx = (pos.x - cx) / state.viewScale + state.viewOffset.x;
  const wy = (pos.y - cy) / state.viewScale + state.viewOffset.y;
  return { x: wx, y: wy };
}

refs.canvas.addEventListener("pointerdown", (e) => {
  audio.unlock();
  if (e.button === 1) { // 中键平移
    e.preventDefault();
    midDrag = true;
    dragStart = { x: e.clientX, y: e.clientY };
    dragViewStart = { ...state.viewOffset };
    return;
  }
  if (e.button !== 0) return;

  const wp = viewToWorld(canvasPos(e));

  if (eraserActive) {
    if (applyIntent(state, { type: "erase", x: wp.x, y: wp.y, radius: 15 })) {
      audio.erase();
    }
    return;
  }

  // 开始一笔：连续采样，结束时统一平滑
  drawing = true;
  drawStart = wp;
  beginStroke(state, wp.x, wp.y, state.activeLineType);
});

refs.canvas.addEventListener("pointermove", (e) => {
  if (midDrag) {
    const dx = (e.clientX - dragStart.x) / state.viewScale;
    const dy = (e.clientY - dragStart.y) / state.viewScale;
    state.viewOffset.x = dragViewStart.x - dx;
    state.viewOffset.y = dragViewStart.y - dy;
    return;
  }

  if (!drawing || !state.stroke) return;
  const wp = viewToWorld(canvasPos(e));
  if (addStrokePoint(state, wp.x, wp.y)) audio.draw();
});

window.addEventListener("pointerup", (e) => {
  if (midDrag) {
    midDrag = false;
    return;
  }
  if (!drawing) return;
  drawing = false;
  if (!state.stroke) return;

  const result = endStroke(state);
  if (!result.ok && result.reason === "ink-out") {
    showToast(strings(locale).inkOut);
  }
  updateUI();
});

// 指针意外离开窗口：丢弃半截笔画，不留残迹
window.addEventListener("pointercancel", () => {
  if (!drawing) return;
  drawing = false;
  cancelStroke(state);
  updateUI();
});

refs.canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  applyIntent(state, { type: "zoom", factor });
  updateUI();
}, { passive: false });

refs.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// —— 按钮事件 ——

refs.toolNormal.addEventListener("click", () => {
  applyIntent(state, { type: "set-line-type", lineType: "normal" });
  eraserActive = false;
  refs.toolEraser.classList.remove("active");
  refs.canvas.style.cursor = "crosshair";
  audio.switchTool();
  updateUI();
});

refs.toolBoost.addEventListener("click", () => {
  applyIntent(state, { type: "set-line-type", lineType: "boost" });
  eraserActive = false;
  refs.toolEraser.classList.remove("active");
  refs.canvas.style.cursor = "crosshair";
  audio.switchTool();
  updateUI();
});

refs.toolSlow.addEventListener("click", () => {
  applyIntent(state, { type: "set-line-type", lineType: "slow" });
  eraserActive = false;
  refs.toolEraser.classList.remove("active");
  refs.canvas.style.cursor = "crosshair";
  audio.switchTool();
  updateUI();
});

refs.toolScenery.addEventListener("click", () => {
  applyIntent(state, { type: "set-line-type", lineType: "scenery" });
  eraserActive = false;
  refs.toolEraser.classList.remove("active");
  refs.canvas.style.cursor = "crosshair";
  audio.switchTool();
  updateUI();
});

refs.toolEraser.addEventListener("click", () => {
  eraserActive = !eraserActive;
  refs.toolEraser.classList.toggle("active", eraserActive);
  refs.canvas.style.cursor = eraserActive ? "cell" : "crosshair";
});

refs.toolUndo.addEventListener("click", () => {
  applyIntent(state, { type: "undo" });
  audio.undo();
  updateUI();
});

refs.btnPlay.addEventListener("click", () => {
  audio.unlock();
  if (state.playState === "playing") {
    applyIntent(state, { type: "pause" });
    audio.pause();
  } else {
    applyIntent(state, { type: "play" });
    audio.play();
  }
  updateUI();
});

refs.btnReset.addEventListener("click", () => {
  applyIntent(state, { type: "reset-rider" });
  updateUI();
});

refs.btnZoomIn.addEventListener("click", () => {
  applyIntent(state, { type: "zoom", factor: 1.2 });
  updateUI();
});

refs.btnZoomOut.addEventListener("click", () => {
  applyIntent(state, { type: "zoom", factor: 0.8 });
  updateUI();
});

refs.modeFreestyle.addEventListener("click", () => {
  state = createState({ rng: Math.random });
  updateUI();
});

refs.modePuzzle.addEventListener("click", () => {
  // 从已解锁的最高关卡开始
  let maxUnlocked = 1;
  for (let i = 1; i <= getPuzzleCount(); i++) {
    if (persist.puzzleProgress[i]) maxUnlocked = i + 1;
  }
  currentPuzzleId = Math.min(maxUnlocked, getPuzzleCount());
  loadCurrentPuzzle();
});

refs.puzzlePrev.addEventListener("click", () => {
  if (currentPuzzleId > 1) {
    currentPuzzleId--;
    loadCurrentPuzzle();
  }
});

refs.puzzleNext.addEventListener("click", () => {
  // 解锁下一关
  if (persist.puzzleProgress[currentPuzzleId]) {
    currentPuzzleId = Math.min(currentPuzzleId + 1, getPuzzleCount());
    loadCurrentPuzzle();
  }
});

refs.btnExport.addEventListener("click", () => {
  const json = exportCanvas(state);
  navigator.clipboard.writeText(json).then(() => {
    showToast(strings(locale).copySuccess);
  }).catch(() => {
    showToast(json.substring(0, 100) + "...");
  });
});

refs.btnImport.addEventListener("click", () => {
  const json = prompt(strings(locale).importPrompt);
  if (json) {
    const ok = importCanvas(state, json);
    showToast(ok ? strings(locale).importSuccess : strings(locale).importError);
    updateUI();
  }
});

refs.btnClear.addEventListener("click", () => {
  if (confirm(strings(locale).confirmClear)) {
    applyIntent(state, { type: "clear-all" });
    updateUI();
  }
});

// 音效
refs.soundBtn.addEventListener("click", () => {
  const m = audio.setMuted(!audio.isMuted());
  persist = storage.setMuted(persist, m);
  storage.save(persist);
  refs.soundLabel.textContent = m
    ? strings(locale).soundOff
    : strings(locale).soundOn;
});

// 语言
refs.langBtn.addEventListener("click", () => {
  const next = locale === "zh" ? "en" : "zh";
  saveLocale(next);
  location.reload();
});

// 帮助
refs.helpBtn.addEventListener("click", () => {
  showOverlay(strings(locale).helpTitle, strings(locale).helpText, "OK");
});

// 键盘
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  switch (e.key) {
    case "1": refs.toolNormal.click(); break;
    case "2": refs.toolBoost.click(); break;
    case "3": refs.toolSlow.click(); break;
    case "4": refs.toolScenery.click(); break;
    case " ":
      e.preventDefault();
      refs.btnPlay.click();
      break;
    case "z":
    case "Z":
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        applyIntent(state, { type: "undo" });
        audio.undo();
        updateUI();
      }
      break;
    case "r":
    case "R":
      if (!e.ctrlKey && !e.metaKey) {
        applyIntent(state, { type: "reset-rider" });
        updateUI();
      }
      break;
    case "Delete":
    case "Backspace":
      if (eraserActive) e.preventDefault();
      break;
    case "=":
    case "+":
      applyIntent(state, { type: "zoom", factor: 1.2 });
      updateUI();
      break;
    case "-":
      applyIntent(state, { type: "zoom", factor: 0.8 });
      updateUI();
      break;
  }
});

// —— Start ——
function start() {
  updateUI();
  refreshLocale();
  renderer.resize();
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);
}

start();