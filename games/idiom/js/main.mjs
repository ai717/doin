// 装配层：把引擎、存档、音效、双语与书页渲染接起来，并暴露只读诊断出口。
import { BOARDS, boardOf, LEVELS_PER_BOARD } from "./boards.mjs";
import { factionsFor } from "./puzzles.mjs";
import { createGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUi, formatTime } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import * as storage from "./storage.mjs";
import { t, loadLocale, saveLocale, otherLocale } from "./i18n.mjs";
import { STATUS } from "./engine.mjs";

const refs = {
  backHome: document.getElementById("back-home"),
  brandMain: document.getElementById("brand-main"),
  brandSub: document.getElementById("brand-sub"),
  boardsBtn: document.getElementById("btn-boards"),
  atlasBtn: document.getElementById("btn-atlas"),
  soundBtn: document.getElementById("btn-sound"),
  langBtn: document.getElementById("btn-lang"),
  helpBtn: document.getElementById("btn-help"),
  hudBoard: document.getElementById("hud-board"),
  hudNumeral: document.getElementById("hud-numeral"),
  hudLevel: document.getElementById("hud-level"),
  hudStars: document.getElementById("hud-stars"),
  hudTime: document.getElementById("hud-time"),
  grid: document.getElementById("grid"),
  gridTitle: document.getElementById("grid-title"),
  gridProgress: document.getElementById("grid-progress"),
  clueList: document.getElementById("clue-list"),
  clueCurrent: document.getElementById("clue-current"),
  hintBtn: document.getElementById("btn-hint"),
  eraseBtn: document.getElementById("btn-erase"),
  rack: document.getElementById("rack"),
  keyHint: document.getElementById("key-hint"),
  toast: document.getElementById("toast"),
  boardCards: document.getElementById("board-cards"),
  atlasTabs: document.getElementById("atlas-tabs"),
  atlasProgress: document.getElementById("atlas-progress"),
  atlasGrid: document.getElementById("atlas-grid"),
  cardWord: document.getElementById("card-word"),
  cardBody: document.getElementById("card-body"),
  copyBtn: document.getElementById("btn-copy"),
  resultStars: document.getElementById("result-stars"),
  resultRows: document.getElementById("result-rows"),
  nextBtn: document.getElementById("btn-next"),
  replayBtn: document.getElementById("btn-replay"),
  resultBoardsBtn: document.getElementById("btn-result-boards"),
  fx: document.getElementById("fx"),
};

let locale = loadLocale();
let progress = storage.load();
const controller = createGame({ locale, current: progress.current });
const audio = createAudio();
let atlasOpen = false;
let atlasBoard = controller.cursor().boardId;
let lastSolvedWords = [];
let clearTimer = 0;

const ui = createUi(refs, {});
const renderer = createRenderer({
  grid: refs.grid,
  clueList: refs.clueList,
  clueCurrent: refs.clueCurrent,
  rack: refs.rack,
  gridProgress: refs.gridProgress,
  fx: refs.fx,
  t: (key, vars) => t(locale, key, vars),
});

renderer.registerDispatch(dispatchIntent, () => controller.state());

// 中文输入法需要一个真实输入框才能上屏，隐藏但可聚焦。
const ime = document.createElement("input");
ime.type = "text";
ime.autocomplete = "off";
ime.autocapitalize = "off";
ime.spellcheck = false;
ime.tabIndex = -1;
ime.setAttribute("aria-hidden", "true");
ime.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;border:0;padding:0";
document.body.appendChild(ime);
let composing = false;

function finePointer() {
  return Boolean(globalThis.matchMedia?.("(pointer: fine)")?.matches);
}

function focusInput() {
  if (!finePointer()) return;
  try {
    ime.focus({ preventScroll: true });
  } catch {
    ime.focus();
  }
}

function currentPanelId() {
  const panel = [...document.querySelectorAll(".panel")].find((node) => !node.hidden);
  return panel?.id ?? null;
}

function syncCurrent() {
  const cursor = controller.cursor();
  storage.remember(progress, locale, cursor.boardId, cursor.levelIndex);
  storage.save(progress);
}

function updateHud() {
  const cursor = controller.cursor();
  const board = boardOf(cursor.boardId);
  const record = storage.levelRecord(progress, locale, cursor.boardId, cursor.levelIndex);
  const summary = controller.summary();
  ui.setHud({
    boardName: t(locale, board.nameKey),
    numeral: board.numeral,
    levelLabel: t(locale, "levelLabel", { n: cursor.levelIndex + 1 }),
    stars: record?.stars ?? 0,
    time: formatTime(summary.elapsed),
    best: record ? t(locale, "bestTime", { time: formatTime(record.ms) }) : "",
  });
  ui.setHintState({
    hintsLeft: controller.state().hintsLeft,
    disabled: controller.state().status !== STATUS.PLAYING,
  });
}

function renderPuzzle() {
  clearTimeout(clearTimer);
  const state = controller.state();
  renderer.setLocale(locale);
  renderer.render(state, state.puzzle);
  lastSolvedWords = [];
  updateHud();
  ui.hideToast();
}

function poolEntries(lang, boardId) {
  const faction = factionsFor(lang).find((item) => item.boardId === boardId);
  if (!faction) return [];
  return faction.entries.map((entry) =>
    lang === "en"
      ? { id: entry.id, text: entry.en, def: entry.enDef, source: entry.enOrigin, story: entry.enDef, example: "" }
      : { id: entry.id, text: entry.zh, def: entry.zhDef, source: entry.zhSource, story: entry.zhStory, example: entry.zhExample },
  );
}

refs.poolFor = poolEntries;

function finishLevel() {
  const state = controller.state();
  if (state.status !== STATUS.CLEARED) return;
  const summary = controller.summary();
  const cursor = controller.cursor();
  const entries = controller.clearedEntryIds();
  storage.recordClear(progress, {
    lang: locale,
    boardId: cursor.boardId,
    levelIndex: cursor.levelIndex,
    stars: summary.stars,
    hintsUsed: summary.hintsUsed,
    ms: summary.elapsed,
    entries,
  });
  storage.save(progress);
  updateHud();
  ui.showResult({
    stars: summary.stars,
    hintsUsed: summary.hintsUsed,
    elapsed: summary.elapsed,
    cards: lastSolvedWords.slice(0, 4),
  });
  ui.setNextLabel(t(locale, cursor.levelIndex >= LEVELS_PER_BOARD - 1 ? "resultNextBoard" : "resultNext"));
  ui.openPanel("panel-result");
  audio.play("guqin");
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === "fill") {
      audio.play("ink");
    } else if (event.type === "wrong") {
      audio.play("wood");
      renderer.pulse("wrong", event.r, event.c);
      ui.showToast(t(locale, "wrongBanner"), 1200);
    } else if (event.type === "erase") {
      audio.play("erase");
    } else if (event.type === "hint") {
      audio.play("hint");
      renderer.pulse("hint", event.r, event.c);
      ui.showToast(t(locale, "hintBanner"), 1200);
    } else if (event.type === "word") {
      lastSolvedWords.push(event.answer);
      audio.play("chime", lastSolvedWords.length);
      renderer.flashEntry(event.index);
      ui.showToast(t(locale, "solvedBanner", { word: event.answer }), 1400);
      if (event.entryId) {
        const cursor = controller.cursor();
        storage.unlockCard(progress, locale, cursor.boardId, event.entryId);
        storage.save(progress);
      }
    } else if (event.type === "cleared") {
      clearTimeout(clearTimer);
      clearTimer = globalThis.setTimeout(finishLevel, 900);
    }
  }
}

function dispatchIntent(intent) {
  const gameplay = intent && ["cell", "entry", "fill", "erase", "hint"].includes(intent.type);
  if (gameplay && ui.anyPanelOpen()) return { action: null, events: [] };
  const result = controller.dispatch(intent);
  if (result.action === "level") {
    syncCurrent();
    renderPuzzle();
    audio.play("page");
    return result;
  }
  handleEvents(result.events);
  renderer.update(controller.state());
  updateHud();
  if (result.action === "select" || result.action === "fill" || result.action === "erase" || result.action === "hint") {
    focusInput();
  }
  return result;
}

function closeAll() {
  ui.closePanels();
  atlasOpen = false;
  ui.hideToast();
}

function openBoards() {
  atlasOpen = false;
  const cursor = controller.cursor();
  ui.renderBoards({
    progress,
    current: cursor,
    onPick: (boardId, levelIndex) => {
      closeAll();
      dispatchIntent({ type: "level", boardId, levelIndex });
    },
    onPlay: (boardId) => {
      closeAll();
      dispatchIntent({ type: "level", boardId, levelIndex: 0 });
    },
  });
  ui.openPanel("panel-boards");
  audio.play("page");
}

function renderAtlas() {
  ui.renderAtlas({
    progress,
    boardId: atlasBoard,
    onTab: (boardId) => {
      atlasBoard = boardId;
      renderAtlas();
      audio.play("click");
    },
    onOpenCard: (entryId) => {
      const entry = poolEntries(locale, atlasBoard).find((item) => item.id === entryId);
      if (!entry) return;
      ui.showCard({ entry, lang: locale, onCopy: copyCard });
      ui.openPanel("panel-card");
      audio.play("click");
    },
  });
}

function openAtlas() {
  atlasBoard = controller.cursor().boardId;
  atlasOpen = true;
  renderAtlas();
  ui.openPanel("panel-atlas");
  audio.play("page");
}

function copyCard(entry) {
  const labels = locale === "en"
    ? [t(locale, "cardStory"), t(locale, "cardOrigin")]
    : [t(locale, "cardSource"), t(locale, "cardStory"), t(locale, "cardExample")];
  const values = locale === "en" ? [entry.story, entry.source] : [entry.source, entry.story, entry.example];
  const text = [`${entry.text}`, ...labels.map((label, index) => `${label}: ${values[index] ?? ""}`).filter((line) => !line.endsWith(": "))].join("\n");
  const done = () => ui.showToast(t(locale, "copied"));
  const failed = () => ui.showToast(t(locale, "copyFailed"), 2400);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(failed);
    return;
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(area);
    area.select();
    const okay = document.execCommand("copy");
    document.body.removeChild(area);
    if (okay) done();
    else failed();
  } catch {
    failed();
  }
}

function switchLocale() {
  const next = otherLocale(locale);
  closeAll();
  storage.save(progress);
  saveLocale(next);
  locale = next;
  controller.setLocale(next);
  ui.applyStatic(locale);
  renderer.setLocale(locale);
  renderPuzzle();
  syncCurrent();
  ui.showToast(t(locale, next === "en" ? "switchedLang" : "switchedLangBack"), 2000);
  audio.play("page");
}

function toggleSound() {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  ui.setSoundButton(muted);
  if (!muted) audio.play("click");
}

// 顶栏与面板事件
refs.boardsBtn.addEventListener("click", openBoards);
refs.atlasBtn.addEventListener("click", openAtlas);
refs.soundBtn.addEventListener("click", toggleSound);
refs.langBtn.addEventListener("click", switchLocale);
refs.helpBtn.addEventListener("click", () => {
  ui.openPanel("panel-help");
  audio.play("page");
});
refs.hintBtn.addEventListener("click", () => dispatchIntent({ type: "hint" }));
refs.eraseBtn.addEventListener("click", () => dispatchIntent({ type: "erase" }));
refs.nextBtn.addEventListener("click", () => {
  closeAll();
  dispatchIntent({ type: "next" });
});
refs.replayBtn.addEventListener("click", () => {
  closeAll();
  dispatchIntent({ type: "retry" });
});
refs.resultBoardsBtn.addEventListener("click", () => {
  closeAll();
  openBoards();
});

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => {
    if (currentPanelId() === "panel-card" && atlasOpen) {
      renderAtlas();
      ui.openPanel("panel-atlas");
      return;
    }
    closeAll();
  });
}

// 键盘与输入法
ime.addEventListener("compositionstart", () => {
  composing = true;
});
ime.addEventListener("compositionend", () => {
  composing = false;
  const value = ime.value;
  ime.value = "";
  const char = [...value].pop();
  if (char) dispatchIntent({ type: "fill", char: locale === "en" ? char.toUpperCase() : char });
});
ime.addEventListener("input", () => {
  if (composing) return;
  const value = ime.value;
  ime.value = "";
  const char = [...value].pop();
  if (char) dispatchIntent({ type: "fill", char: locale === "en" ? char.toUpperCase() : char });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (ui.anyPanelOpen()) {
      if (currentPanelId() === "panel-card" && atlasOpen) {
        renderAtlas();
        ui.openPanel("panel-atlas");
      } else {
        closeAll();
      }
    }
    return;
  }
  if (event.target === ime || composing) {
    if (event.key === "Backspace") {
      event.preventDefault();
      dispatchIntent({ type: "erase" });
    }
    return;
  }
  if (ui.anyPanelOpen()) return;
  if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    dispatchIntent({ type: "erase" });
  } else if ((event.key === "h" || event.key === "H") && !event.metaKey && !event.ctrlKey) {
    dispatchIntent({ type: "hint" });
  }
});

document.addEventListener("pointerdown", () => audio.unlock(), { once: true });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") storage.save(progress);
});

// 计时器：只在对局可见且无面板时推进。
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(1000, now - lastTick);
  lastTick = now;
  if (ui.anyPanelOpen()) return;
  const state = controller.state();
  if (state.status !== STATUS.PLAYING) return;
  controller.tick(dt);
  ui.setTime(formatTime(controller.summary().elapsed));
}, 200);

// 启动
ui.applyStatic(locale);
ui.setSoundButton(audio.isMuted());
syncCurrent();
renderPuzzle();

// 诊断出口：冒烟只读这里，不复刻玩法逻辑。
globalThis.__idiom = {
  version: 1,
  locale: () => locale,
  reset: () => {
    storage.resetBackendForTests();
    progress = storage.defaultProgress();
    controller.startLevel(controller.cursor().boardId, controller.cursor().levelIndex);
    renderPuzzle();
  },
  snapshot: () => {
    const state = controller.state();
    const cursor = controller.cursor();
    const puzzle = state.puzzle;
    return {
      lang: locale,
      status: state.status,
      boardId: cursor.boardId,
      levelIndex: cursor.levelIndex,
      rows: puzzle.rows,
      cols: puzzle.cols,
      entries: state.entries.length,
      solvedEntries: state.entries.filter((entry) => entry.solved).length,
      totalCells: state.cells.size,
      filledCells: [...state.cells.values()].filter((cell) => cell.value === cell.answer).length,
      hintsLeft: state.hintsLeft,
      hintsUsed: state.hintsUsed,
      stars: state.stars,
      elapsed: Math.round(state.elapsed),
      selected: state.selected,
      panel: currentPanelId(),
      rack: puzzle.rack.slice(),
      entriesDetail: state.entries.map((entry) => ({
        dir: entry.dir,
        row: entry.row,
        col: entry.col,
        len: entry.len,
        answer: entry.answer,
        clue: entry.clue,
        solved: entry.solved,
      })),
      cells: puzzle.cells.map((cell) => ({ r: cell.r, c: cell.c, answer: cell.answer, locked: cell.locked })),
    };
  },
  dispatch: dispatchIntent,
  solveLevel: () => {
    const state = controller.state();
    for (const cell of state.cells.values()) {
      if (cell.value === cell.answer) continue;
      dispatchIntent({ type: "cell", r: cell.r, c: cell.c });
      dispatchIntent({ type: "fill", char: cell.answer });
      if (controller.state().status === STATUS.CLEARED) break;
    }
    return controller.summary();
  },
  progress: () => progress,
  boardList: () => BOARDS.map((board) => board.id),
};
