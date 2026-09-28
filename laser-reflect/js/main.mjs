// 装配层：把存档、音效、控制器、渲染和 DOM 接到一起。
// 规则不在这里判断——只做「读偏好 → 驱动控制器 → 落库」。

import { createGameController } from "./game.mjs";
import { createAudio } from "./audio.mjs";
import { mountUI } from "./ui.mjs";
import { trace } from "./engine.mjs";
import { load, save, isUnlocked, recordClear } from "./storage.mjs";
import { LEVELS, LEVEL_COUNT } from "./levels.mjs";
import { format, htmlLang, loadLocale, saveLocale, strings } from "./i18n.mjs";

const byId = (id) => document.getElementById(id);

const refs = {
  board: byId("board"),
  raysLayer: byId("rays-layer"),
  readoutLevel: byId("readout-level"),
  readoutMoves: byId("readout-moves"),
  readoutPar: byId("readout-par"),
  readoutStars: byId("readout-stars"),
  readoutLevelLabel: byId("readout-level").parentElement.querySelector(".readout-label"),
  levelPanel: byId("level-panel"),
  levelGrid: byId("level-grid"),
  resultLayer: byId("result-layer"),
  resultStars: byId("result-stars"),
  resultTitle: byId("result-title"),
  resultSub: byId("result-sub"),
  helpLayer: byId("help-layer"),
  btnUndo: byId("btn-undo"),
  btnReset: byId("btn-reset"),
  btnSelect: byId("btn-select"),
  btnPanelClose: byId("btn-panel-close"),
  btnNext: byId("btn-next"),
  btnReplay: byId("btn-replay"),
  btnCloseResult: byId("btn-close-result"),
  btnHelp: byId("btn-help"),
  btnHelpClose: byId("btn-help-close"),
  btnSound: byId("btn-sound"),
  btnLang: byId("btn-lang"),
};

// —— i18n ——
let locale = loadLocale();
let t = strings(locale);

const data = load();
const audio = createAudio({ muted: data.prefs.muted });

let currentIndex = 0;
let lastLitTargetCount = -1;

function starText(stars) {
  return "★".repeat(stars) + "☆".repeat(3 - stars);
}

function applyStaticTexts() {
  document.documentElement.lang = htmlLang(locale);
  document.title = t.docTitle;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", t.metaDesc);
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (t[key] !== undefined) el.setAttribute("aria-label", t[key]);
  });
  syncLangButton();
  syncSoundButton();
}

function syncLangButton() {
  refs.btnLang.textContent = t.langShort;
}

function syncSoundButton() {
  const on = !data.prefs.muted;
  refs.btnSound.textContent = on ? "♪" : "×";
  refs.btnSound.setAttribute("aria-label", on ? t.soundOn : t.soundOff);
}

function litTargetCount(view) {
  return trace({ rows: view.rows, cols: view.cols, par: view.par, cells: view.cells }).litTargets.size;
}

const game = createGameController({ onChange: renderFrame });

function renderFrame(view) {
  refs.readoutLevel.textContent = String(view.levelIndex + 1);
  refs.readoutMoves.textContent = String(view.moves);
  refs.readoutPar.textContent = String(view.par);

  const currentStars = game.stars();
  refs.readoutStars.textContent = starText(currentStars);
  refs.readoutStars.className = "readout-stars star-" + currentStars;

  ui.render(view);

  refs.readoutLevelLabel.textContent = format(t.level, view.levelIndex + 1);

  // 命中音效
  const lit = litTargetCount(view);
  if (lit > lastLitTargetCount) {
    audio.hit(Math.max(0, lit - 1));
  }
  lastLitTargetCount = lit;

  // 胜利结算
  if (view.solved) {
    settle(view);
  }
}

// 胜利结算（每关只结算一次）：先让光束流入动画与靶点脉动播完（约 0.95s），
// 再在底部弹出非遮挡结算条——盘面全程可见，用户能看到"光射中靶"的过程。
let settledForIndex = -1;
let settleTimer = null;

function settle(view) {
  if (settledForIndex === view.levelIndex) return;
  settledForIndex = view.levelIndex;

  const idx = view.levelIndex;
  const stars = game.stars();
  data.progress = recordClear(data.progress, idx, LEVEL_COUNT, stars);
  save(data);

  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    settleTimer = null;
    // 延迟期间可能已切关/重置，放弃过期结算
    if (game.view().levelIndex !== idx || !game.isSolved()) return;
    audio.win();
    showResult(game.view());
  }, 950);
}

function showResult(view) {
  const stars = game.stars();
  refs.resultStars.textContent = starText(stars);
  refs.resultStars.className = "result-stars star-" + stars;
  refs.resultTitle.textContent = t.winTitle;
  refs.resultSub.textContent = format(t.winSub, view.moves, view.par);
  const hasNext = view.levelIndex + 1 < LEVEL_COUNT;
  refs.btnNext.style.display = hasNext ? "" : "none";
  refs.resultLayer.classList.remove("hidden");
}

function closeResult() {
  refs.resultLayer.classList.add("hidden");
}

function rebuildLevelGrid() {
  refs.levelGrid.innerHTML = "";
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level-btn";
    const unlocked = isUnlocked(data.progress, i);
    if (!unlocked) btn.classList.add("locked");
    if (i === currentIndex) btn.classList.add("current");
    const stars = data.progress.stars[String(i)];
    btn.innerHTML = `<span class="level-num">${i + 1}</span>${stars ? `<span class="level-stars">${starText(stars)}</span>` : ""}`;
    btn.disabled = !unlocked;
    if (unlocked) {
      btn.addEventListener("click", () => {
        refs.levelPanel.classList.add("hidden");
        startLevel(i);
      });
    }
    refs.levelGrid.appendChild(btn);
  }
}

function startLevel(index) {
  currentIndex = index;
  lastLitTargetCount = -1;
  settledForIndex = -1;
  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
  game.loadLevel(index);
  rebuildLevelGrid();
}

// —— UI 挂载 ——
const ui = mountUI(refs, {
  onRotate(r, c) {
    audio.unlock();
    if (game.rotateAt(r, c)) {
      audio.click();
    }
  },
}, t);

// —— 事件绑定 ——
refs.btnUndo.addEventListener("click", () => {
  audio.unlock();
  if (game.undo()) audio.rewind();
});

refs.btnReset.addEventListener("click", () => {
  audio.unlock();
  game.reset();
  audio.rewind();
});

refs.btnSelect.addEventListener("click", () => {
  rebuildLevelGrid();
  refs.levelPanel.classList.remove("hidden");
});

refs.btnPanelClose.addEventListener("click", () => {
  refs.levelPanel.classList.add("hidden");
});

refs.btnHelp.addEventListener("click", () => {
  refs.helpLayer.classList.remove("hidden");
});

refs.btnHelpClose.addEventListener("click", () => {
  refs.helpLayer.classList.add("hidden");
});

refs.btnNext.addEventListener("click", () => {
  closeResult();
  if (currentIndex + 1 < LEVEL_COUNT) startLevel(currentIndex + 1);
});

refs.btnReplay.addEventListener("click", () => {
  closeResult();
  game.reset();
});

refs.btnCloseResult.addEventListener("click", () => {
  closeResult();
  rebuildLevelGrid();
  refs.levelPanel.classList.remove("hidden");
});

refs.btnSound.addEventListener("click", () => {
  data.prefs.muted = !data.prefs.muted;
  audio.setMuted(data.prefs.muted);
  save(data);
  syncSoundButton();
  if (!data.prefs.muted) {
    audio.unlock();
    audio.click();
  }
});

refs.btnLang.addEventListener("click", () => {
  const next = locale === "zh" ? "en" : "zh";
  saveLocale(next);
  locale = next;
  t = strings(locale);
  // 原地热更新，绝不刷新页面、绝不重置游戏状态
  applyStaticTexts();
  renderFrame(game.view());
  if (!refs.levelPanel.classList.contains("hidden")) rebuildLevelGrid();
  if (!refs.resultLayer.classList.contains("hidden")) showResult(game.view());
});

// —— 初始化 ——
applyStaticTexts();
startLevel(0);

// 音效解锁：首次交互
document.addEventListener("pointerdown", () => audio.unlock(), { once: true });
