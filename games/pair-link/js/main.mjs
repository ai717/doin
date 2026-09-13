// 入口装配：绑定指针 / 触摸 / 键盘 / 按钮，协调 i18n、storage、audio、game、render、ui。
// 不绕过 engine 修改任何规则状态。

import { createAudio } from "./audio.mjs";
import { COLS, ROWS, createState } from "./engine.mjs";
import { createGame } from "./game.mjs";
import { format, loadLocale, saveLocale, t } from "./i18n.mjs";
import { createRenderer } from "./render.mjs";
import { endBonus } from "./score.mjs";
import {
  levelStat,
  loadProgress,
  recordEndless,
  recordLevel,
  saveProgress
} from "./storage.mjs";
import { createUi } from "./ui.mjs";

const LEVEL_COUNT = 36;

const ui = createUi();
if (ui) {
  boot(ui);
}

function boot(view) {
  const audio = createAudio();
  const renderer = createRenderer(view.el.fx, view.el.board);

  let progress = loadProgress();
  let locale = loadLocale();
  let dragFromBoard = false;

  view.applyStaticI18n(locale);
  audio.setMuted(progress.muted === true);
  if (view.el.btnSound) view.el.btnSound.setAttribute("aria-pressed", String(progress.muted === true));

  const startLevel = Math.min(progress.unlocked, progress.lastLevel || 1);
  const game = createGame(createState(startLevel, { mode: "level" }), {
    onState: handleState,
    onTick: (payload) => view.renderClocks(payload.state),
    onAction: handleAction,
    onEnd: handleEnd,
    onRefused: handleRefused
  });

  renderer.setState(game.getState());
  view.render(game.getState(), hudMeta(game.getState()));
  view.setStartProgress(progress);
  view.openPanel("start");

  /* ------------------------------------------------------------ 事件处理 */

  function hudMeta(state) {
    if (state.mode === "endless") {
      return { best: progress.endlessBest, stars: 0 };
    }
    const record = levelStat(progress, state.level);
    return { best: record.score, stars: record.stars };
  }

  function handleState({ state, source }) {
    renderer.setState(state);
    view.render(state, hudMeta(state));
    if (source === "pause") view.openPanel("pause");
    else if (source === "resume" || source === "start" || source === "restart" || source === "newGame") {
      view.closePanel();
    }
  }

  function handleRefused({ reason }) {
    if (reason === "hint") view.toast("toastNoHints");
    else if (reason === "shuffle") view.toast("toastNoShuffles");
  }

  function handleAction({ action, state }) {
    switch (action.type) {
      case "select":
        audio.play("select");
        view.announce(format(t(locale, "selectedTile"), { r: action.cell.r, c: action.cell.c }));
        break;
      case "deselect":
        audio.play("deselect");
        break;
      case "invalid":
      case "reselect":
        view.flash(action.cell, "invalid");
        audio.play("invalid");
        view.toast("toastInvalid");
        break;
      case "hint":
        audio.play("hint");
        view.toast("toastHint");
        break;
      case "shuffle":
        renderer.playShuffle();
        audio.play("shuffle");
        view.toast("toastShuffle");
        break;
      case "clear": {
        renderer.playLink(action.cells, action.folds);
        renderer.playClear(action.cells);
        audio.play("link", { folds: action.folds });
        window.setTimeout(() => audio.play("clear"), 240);
        if (action.combo >= 1) {
          audio.play("combo", { combo: action.combo });
        }
        if (action.combo >= 3) {
          view.flashComboLamp();
          renderer.playBoardGlow();
        }
        if (action.autoShuffles > 0) view.toast("toastAutoShuffle");
        if (action.boardCleared && state.phase === "playing") {
          view.toast("toastBoardCleared", { n: state.clearedBoards + 1 });
        }
        break;
      }
      default:
        break;
    }
  }

  function handleEnd({ state, reason }) {
    const isEndless = state.mode === "endless";
    const won = reason === "win";

    if (isEndless) {
      const previousBest = progress.endlessBest;
      const record = state.score > previousBest;
      progress = recordEndless(progress, state.score);
      saveProgress(progress);
      audio.play(record ? "record" : "lose");
      view.render(state, hudMeta(state));
      view.showResult({
        mode: "endless",
        phase: state.phase,
        score: state.score,
        stars: 0,
        clearedBoards: state.clearedBoards,
        comboPeak: state.comboPeak,
        best: progress.endlessBest,
        record: record,
        failReason: state.failReason
      });
      return;
    }

    const previousUnlocked = progress.unlocked;
    const previous = levelStat(progress, state.level);
    const timeBonus = won ? endBonus({ remainingMs: state.remainingMs }) : 0;
    const itemBonus = won ? endBonus({ hintsLeft: state.hintsLeft, shufflesLeft: state.shufflesLeft }) : 0;
    const record = won && (state.score > previous.score || state.stars > previous.stars);

    if (won) {
      progress = recordLevel(progress, state.level, { score: state.score, stars: state.stars });
      saveProgress(progress);
    }

    audio.play(won ? "win" : "lose");
    if (record) window.setTimeout(() => audio.play("record"), 420);
    if (progress.unlocked > previousUnlocked && progress.unlocked <= LEVEL_COUNT) {
      window.setTimeout(
        () => view.toast("toastLevelUnlocked", { n: progress.unlocked }),
        1400
      );
    }

    view.setStartProgress(progress);
    view.render(state, hudMeta(state));
    view.showResult({
      mode: "level",
      phase: state.phase,
      score: state.score,
      stars: state.stars,
      clearedPairs: state.clearedPairs,
      comboPeak: state.comboPeak,
      timeBonus: timeBonus,
      itemBonus: itemBonus,
      best: hudMeta(state).best,
      record: record,
      failReason: state.failReason
    });
  }

  /* ------------------------------------------------------------ 棋盘输入 */

  view.el.board.addEventListener("click", (event) => {
    const node = event.target.closest ? event.target.closest(".cell") : null;
    if (!node || !node.dataset || node.dataset.r === undefined) return;
    const r = Number(node.dataset.r);
    const c = Number(node.dataset.c);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return;
    if (r < 1 || r > ROWS - 2 || c < 1 || c > COLS - 2) {
      // 外圈格：点空白取消选中
      const current = game.getState();
      if (current.selected) game.dispatch({ type: "pick", cell: { r: 0, c: 0 } });
      return;
    }
    game.dispatch({ type: "pick", cell: { r: r, c: c } });
  });

  view.el.board.addEventListener("pointerdown", () => {
    dragFromBoard = true;
  });

  window.addEventListener("pointerup", (event) => {
    if (!dragFromBoard) return;
    dragFromBoard = false;
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    if (
      target.closest("#board") ||
      target.closest("#overlay") ||
      target.closest("#hud") ||
      target.closest("#topbar")
    ) {
      return;
    }
    const current = game.getState();
    if (current.selected) game.dispatch({ type: "pick", cell: current.selected });
  });

  /* ------------------------------------------------------------ 键盘 */

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (view.panelOpen()) {
      if (event.key === "Escape") view.closePanel();
      return;
    }
    const state = game.getState();
    const key = event.key;
    const lower = typeof key === "string" ? key.toLowerCase() : "";

    if (key === "ArrowUp" || lower === "w") {
      event.preventDefault();
      view.moveFocus(-1, 0, state.board);
    } else if (key === "ArrowDown" || lower === "s") {
      event.preventDefault();
      view.moveFocus(1, 0, state.board);
    } else if (key === "ArrowLeft" || lower === "a") {
      event.preventDefault();
      view.moveFocus(0, -1, state.board);
    } else if (key === "ArrowRight" || lower === "d") {
      event.preventDefault();
      view.moveFocus(0, 1, state.board);
    } else if (key === "Escape") {
      if (state.selected) game.dispatch({ type: "pick", cell: state.selected });
    } else if (lower === "h") {
      game.dispatch({ type: "hint" });
    } else if (lower === "r") {
      game.dispatch({ type: "shuffle" });
    } else if (lower === "p") {
      if (state.phase === "playing") game.dispatch({ type: "pause" });
      else if (state.phase === "paused") game.dispatch({ type: "resume" });
    }
  });

  /* ------------------------------------------------------------ 按钮 */

  function on(id, handler) {
    const node = document.getElementById(id);
    if (node) node.addEventListener("click", handler);
  }

  function openLevels() {
    const state = game.getState();
    view.buildLevels(progress, state.mode === "level" ? state.level : 0, (level) => {
      progress = { ...progress, lastLevel: level };
      saveProgress(progress);
      view.closePanel();
      game.dispatch({ type: "newGame", level: level, mode: "level" });
    });
    view.openPanel("levels");
  }

  on("btn-continue", () => {
    audio.unlock();
    view.closePanel();
    game.dispatch({ type: "start" });
  });

  on("btn-open-levels", openLevels);
  on("btn-pause-levels", openLevels);
  on("btn-result-levels", openLevels);

  on("btn-endless", () => {
    audio.unlock();
    view.closePanel();
    game.dispatch({ type: "newGame", level: 1, mode: "endless" });
  });

  on("btn-resume", () => game.dispatch({ type: "resume" }));
  on("btn-pause", () => {
    const state = game.getState();
    if (state.phase === "playing") game.dispatch({ type: "pause" });
    else if (state.phase === "paused") game.dispatch({ type: "resume" });
  });

  function retry() {
    view.closePanel();
    game.dispatch({ type: "restart" });
  }

  on("btn-restart", retry);
  on("btn-pause-restart", retry);
  on("btn-retry", retry);

  on("btn-next", () => {
    const state = game.getState();
    view.closePanel();
    if (state.mode === "endless" || state.level >= LEVEL_COUNT) {
      openLevels();
      return;
    }
    progress = { ...progress, lastLevel: state.level + 1 };
    saveProgress(progress);
    game.dispatch({ type: "newGame", level: state.level + 1, mode: "level" });
  });

  on("btn-hint", () => {
    audio.unlock();
    game.dispatch({ type: "hint" });
  });

  on("btn-shuffle", () => {
    audio.unlock();
    game.dispatch({ type: "shuffle" });
  });

  on("btn-help", () => view.openPanel("help"));
  on("btn-help-close", () => view.closePanel());
  on("btn-levels-close", () => view.closePanel());

  on("btn-sound", () => {
    const muted = !audio.isMuted();
    audio.setMuted(muted);
    if (!muted) audio.unlock();
    progress = { ...progress, muted: muted };
    saveProgress(progress);
    if (view.el.btnSound) view.el.btnSound.setAttribute("aria-pressed", String(muted));
  });

  on("btn-lang", () => {
    const next = locale === "zh" ? "en" : "zh";
    saveLocale(next);
    window.location.reload();
  });

  /* ------------------------------------------------------------ 生命周期 */

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.getState().phase === "playing") {
      game.dispatch({ type: "pause" });
    }
  });

  window.addEventListener("pagehide", () => {
    renderer.destroy();
    game.destroy();
  });
}
