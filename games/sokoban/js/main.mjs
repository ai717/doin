// filepath: games/sokoban/js/main.mjs
// 装配入口：把 engine / game / renderer / ui / audio / storage / i18n 接到一起。
// 只在这里绑定事件与启动计时；状态永远由 game.mjs 持有，DOM 永远由 ui.mjs 持有。

import { PHASE, createGame } from "./game.mjs";
import { DIRS } from "./engine.mjs";
import { createRenderer, createUI } from "./ui.mjs";
import * as audio from "./audio.mjs";
import * as storage from "./storage.mjs";
import { scoreRun, starsFor, formatTime } from "./score.mjs";
import { hintDir } from "./solver.mjs";
import {
  applyI18n,
  loadLocale,
  toggleLocale,
  getLocale,
  t,
} from "./i18n.mjs";

const KEY_DIR = {
  ArrowUp: 0,
  ArrowDown: 2,
  ArrowLeft: 3,
  ArrowRight: 1,
  w: 0, W: 0,
  a: 3, A: 3,
  s: 2, S: 2,
  d: 1, D: 1,
};

function boot() {
  const canvas = document.getElementById("board");
  if (!canvas) return;

  loadLocale();
  const data = storage.load();

  const game = createGame();
  const renderer = createRenderer(canvas);
  const ui = createUI({
    onPickLevel: (index) => {
      if (!storage.isUnlocked(index)) {
        ui.toast(t("toast.locked"), "warn");
        audio.play("blocked");
        return;
      }
      audio.unlock();
      storage.setCurrent(index);
      game.loadLevel(index);
      game.start();
      afterLevelChange();
      ui.hideAll();
      audio.play("click");
    },
  });

  let muted = data.muted === true;
  audio.setMuted(muted);

  // 渲染提示状态
  let hint = null;
  let justPushed = -1;

  function drawWithState(opts = {}) {
    const view = game.getView();
    ui.syncHud(view);
    ui.syncTime(view);
    renderer.draw(game.state, { hintDir: hint, justPushed: opts.justPushed ?? justPushed });
  }

  function afterLevelChange() {
    hint = null;
    justPushed = -1;
    drawWithState();
  }

  game.subscribe((view, reason) => {
    if (reason === "win") {
      const res = finalizeWin(view);
      hint = null;
      drawWithState();
      ui.showWin(view, res);
      audio.playWin(res.stars);
      return;
    }
    drawWithState();
    if (reason === "level") {
      ui.syncHud(view);
      ui.syncTime(view);
    }
  });

  function finalizeWin(view) {
    const score = scoreRun({ pushes: view.pushes, timeMs: view.timeMs, par: view.par });
    const stars = starsFor(score.total);
    const rec = storage.recordResult(view.meta.id, {
      score: score.total,
      pushes: view.pushes,
      timeMs: view.timeMs,
      stars,
    });
    const best = storage.current().levels[view.meta.id];
    const bestLine = best
      ? t("win.bestLine", {
          score: best.bestScore,
          pushes: best.bestPushes,
          time: formatTime(best.bestTimeMs),
        })
      : "";
    return {
      stars,
      score: score.total,
      isNewBest: rec.isNewBest,
      bestLine,
    };
  }

  function bind(id, handler) {
    const node = document.getElementById(id);
    if (node) node.addEventListener("click", handler);
    return node;
  }

  // ---------- 语言 / 音效 ----------

  bind("btn-lang", () => {
    toggleLocale();
    applyI18n(document);
    syncLangButton();
    updateTitle();
    ui.syncHud(game.getView());
    ui.renderLevels(game.getView(), storage.current());
    audio.play("click");
  });

  bind("btn-sound", () => {
    if (!muted) audio.unlock();
    muted = !muted;
    audio.setMuted(muted);
    storage.setMuted(muted);
    ui.setSoundState(muted);
    if (!muted) audio.play("click");
  });

  // ---------- 弹层按钮 ----------

  const beginPlay = () => {
    audio.unlock();
    game.start();
    ui.hideAll();
    drawWithState();
    audio.play("click");
  };

  bind("btn-start", beginPlay);
  bind("btn-start-levels", () => {
    audio.unlock();
    ui.renderLevels(game.getView(), storage.current());
    ui.show("ov-levels");
    audio.play("click");
  });
  bind("btn-start-help", () => {
    audio.unlock();
    ui.show("ov-help");
    audio.play("click");
  });

  bind("btn-resume", () => {
    game.resume();
    ui.hide("ov-pause");
    audio.play("click");
  });
  bind("btn-pause-restart", () => {
    game.restart();
    game.start();
    afterLevelChange();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-pause-levels", () => {
    ui.renderLevels(game.getView(), storage.current());
    ui.show("ov-levels");
    audio.play("click");
  });
  bind("btn-pause-help", () => {
    ui.show("ov-help");
    audio.play("click");
  });

  bind("btn-next", () => {
    if (game.levelIndex >= 49) {
      game.restart();
    } else {
      game.nextLevel();
    }
    game.start();
    afterLevelChange();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-replay", () => {
    game.restart();
    game.start();
    afterLevelChange();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-win-levels", () => {
    ui.renderLevels(game.getView(), storage.current());
    ui.show("ov-levels");
    audio.play("click");
  });

  bind("btn-levels-close", () => {
    ui.hide("ov-levels");
    audio.play("click");
  });
  bind("btn-help-close", () => {
    ui.hide("ov-help");
    audio.play("click");
  });

  // ---------- 工具栏 ----------

  bind("btn-undo", () => doUndo());
  bind("btn-hint", () => doHint());
  bind("btn-restart", () => {
    if (ui.anyOpen() && !ui.isOpen("ov-win")) return;
    game.restart();
    game.start();
    afterLevelChange();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-pause", () => doPause());
  bind("btn-levels", () => {
    ui.renderLevels(game.getView(), storage.current());
    ui.show("ov-levels");
    audio.play("click");
  });
  bind("btn-help", () => {
    ui.show("ov-help");
    audio.play("click");
  });

  function doUndo() {
    if (!game.undo()) {
      ui.toast(t("toast.noUndo"), "warn");
      audio.play("blocked");
      return;
    }
    hint = null;
    ui.sr(t("sr.undone", { moves: game.getView().moves }));
    audio.play("undo");
    drawWithState();
  }

  function doHint() {
    const view = game.getView();
    if (view.phase !== PHASE.PLAYING) return;
    const dir = hintDir(game.state, { maxTimeMs: 1200, maxStates: 150_000 });
    if (dir === null) {
      ui.toast(t("toast.hintNone"), "warn");
      audio.play("blocked");
      return;
    }
    hint = dir;
    ui.toast(t("toast.hint") + " · " + t(`dir.${DIRS[dir].name}`), "good");
    ui.sr(t("toast.hint"));
    audio.play("hint");
    drawWithState();
  }

  // ---------- 画布交互：滑动 ----------

  let swipe = null;

  if (canvas.addEventListener) {
    canvas.addEventListener("pointerdown", (event) => {
      audio.unlock();
      if (ui.anyOpen()) return;
      swipe = { x: event.clientX, y: event.clientY };
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* 忽略 */
      }
      event.preventDefault();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (swipe) event.preventDefault();
    });

    canvas.addEventListener("pointerup", (event) => {
      if (!swipe) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      swipe = null;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* 忽略 */
      }
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      const dirId = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      tryMove(dirId);
    });

    canvas.addEventListener("pointercancel", () => {
      swipe = null;
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  function tryMove(dirId) {
    const view = game.getView();
    if (view.phase !== PHASE.PLAYING) return;
    const before = view.pushes;
    const ok = game.move(dirId);
    if (!ok) {
      audio.play("blocked");
      ui.toast(t("toast.blocked"), "warn");
      return;
    }
    justPushed = -1;
    if (game.getView().pushes > before) {
      // 被推的箱位置 = 当前玩家位置（applyMove 后人站在箱原位置）
      justPushed = game.state.player;
      audio.play("push");
    } else {
      audio.play("move");
    }
    ui.sr(
      t("sr.moved", {
        level: view.index + 1,
        moves: game.getView().moves,
        pushes: game.getView().pushes,
      })
    );
  }

  // ---------- 键盘 ----------

  const onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;

    if (key === "Escape") {
      if (ui.isOpen("ov-levels")) ui.hide("ov-levels");
      else if (ui.isOpen("ov-help")) ui.hide("ov-help");
      else if (ui.isOpen("ov-pause")) {
        game.resume();
        ui.hide("ov-pause");
      }
      return;
    }

    if (ui.anyOpen()) {
      if (key === " " || key === "Enter") return;
      if (key === "h" || key === "H") {
        ui.hide("ov-help");
        return;
      }
      if (key === "p" || key === "P") {
        if (ui.isOpen("ov-pause")) {
          game.resume();
          ui.hide("ov-pause");
        }
        return;
      }
      return;
    }

    audio.unlock();

    if (key === "z" || key === "Z" || key === "Backspace") {
      doUndo();
      event.preventDefault();
      return;
    }
    if (key === "r" || key === "R") {
      game.restart();
      game.start();
      afterLevelChange();
      audio.play("click");
      event.preventDefault();
      return;
    }
    if (key === " " || key === "p" || key === "P") {
      doPause();
      event.preventDefault();
      return;
    }
    if (key === "h" || key === "H") {
      ui.show("ov-help");
      audio.play("click");
      event.preventDefault();
      return;
    }
    if (key === "?") {
      doHint();
      event.preventDefault();
      return;
    }

    const dirId = KEY_DIR[key];
    if (dirId === undefined) return;
    tryMove(dirId);
    event.preventDefault();
  };

  // 最近一次用户交互时间：防止"开始后瞬时页面隐藏/焦点抖动"误触发自动暂停
  let lastInteractionAt = 0;
  const markInteraction = () => {
    lastInteractionAt = performance.now();
  };

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", markInteraction);
    document.addEventListener("pointerdown", markInteraction, true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && game.phase === PHASE.PLAYING && performance.now() - lastInteractionAt > 400) {
        doPause();
      }
    });
  }

  function doPause() {
    if (game.pause()) {
      ui.show("ov-pause");
      ui.toast(t("toast.paused"), "info");
      audio.play("click");
    } else if (game.resume()) {
      ui.hide("ov-pause");
      ui.toast(t("toast.resumed"), "good");
      audio.play("click");
    }
  }

  // ---------- HUD 计时 ----------

  let timerId = 0;
  if (typeof window !== "undefined" && window.setInterval) {
    timerId = window.setInterval(() => {
      if (game.phase === PHASE.PLAYING) ui.syncTime(game.getView());
    }, 250);
  }
  window.addEventListener("beforeunload", () => {
    if (timerId) window.clearInterval(timerId);
    audio.dispose();
  });

  // ---------- 启动 ----------

  function syncLangButton() {
    const btn = document.getElementById("btn-lang");
    if (btn) btn.textContent = getLocale() === "zh" ? "EN" : "中";
  }

  function updateTitle() {
    document.title = getLocale() === "zh" ? "推箱子 · Sokoban · DOIN" : "Sokoban · DOIN";
  }

  applyI18n(document);
  syncLangButton();
  updateTitle();
  ui.setSoundState(muted);
  game.loadLevel(storage.current().current);
  afterLevelChange();
  ui.syncHud(game.getView());
  ui.syncTime(game.getView());
  ui.show("ov-start");

  if (!storage.isPersistent()) {
    ui.toast(t("toast.noPersist"), "warn");
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
