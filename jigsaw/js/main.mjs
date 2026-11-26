// filepath: games/jigsaw/js/main.mjs
// 装配入口：把 engine / game / render / ui / audio / storage / i18n 接到一起。
// 只在这里绑定事件与启动定时器；状态永远由 game.mjs 持有，DOM 永远由 ui.mjs 持有。

import { createGame, PHASE } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { LEVEL_COUNT, todayKey } from "./levels.mjs";
import * as audio from "./audio.mjs";
import * as storage from "./storage.mjs";
import { applyI18n, loadLocale, toggleLocale, t } from "./i18n.mjs";

const DRAG_THRESHOLD = 10;
const PREVIEW_HOLD_MS = 2000;

function haptic(ms) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch {
    /* 不支持触感时静默忽略 */
  }
}

function boot() {
  const canvas = document.getElementById("board");
  if (!canvas) return;

  loadLocale();
  const data = storage.load();

  const game = createGame();
  const renderer = createRenderer(canvas);
  if (!renderer) return;

  const ui = createUI({
    onPickLevel: (index, unlocked) => {
      audio.unlock();
      if (!unlocked) {
        ui.toast(t("toast.locked"), "warn");
        audio.play("blocked");
        return;
      }
      game.loadLevel(index);
      game.start();
      ui.hideAll();
      audio.play("click");
    },
  });

  let muted = data.prefs?.muted === true;
  audio.setMuted(muted);

  let previewTimer = 0;

  // ---------- 渲染同步 ----------

  function afterLevelChange() {
    renderer.setLevel(game.level);
    renderer.setState(game.state, "init");
    renderer.setSelected(null);
    renderer.setCursor(game.cursor);
    ui.resetCaches();
    ui.syncHud(game);
  }

  function scheduleHint() {
    if (game.isDaily || game.levelIndex !== 0 || game.moves > 0) return;
    if (game.lockedCount > 0) return;
    const target = { r: 0, c: 0 };
    const from = renderer.findPieceCell(target);
    if (!from || (from.r === target.r && from.c === target.c)) return;
    renderer.setHint(from, target, 3000);
  }

  game.subscribe((g, reason) => {
    if (reason === "win") {
      renderer.setSelected(null);
      renderer.setHint(null, null);
      renderer.setState(g.state, "swap");
      renderer.playWin();
      ui.syncHud(g);
      ui.showWin(g);
      audio.playWin({ isNewBest: g.result ? g.result.isNewBest : false });
      haptic(25);
      return;
    }
    if (reason === "level" || reason === "restart") {
      renderer.clearWin();
      afterLevelChange();
      return;
    }
    if (reason === "shuffle") {
      renderer.setState(g.state, "shuffle");
      renderer.setSelected(null);
      ui.syncHud(g);
      return;
    }
    if (reason === "cursor") {
      renderer.setCursor(g.cursor);
      return;
    }
    if (reason === "select") {
      renderer.setSelected(g.selected);
      return;
    }
    if (reason === "start") {
      renderer.setState(g.state, "init");
      ui.resetCaches();
      ui.syncHud(g);
      scheduleHint();
      return;
    }
    renderer.setState(g.state, "swap");
    renderer.setSelected(g.selected);
    ui.syncHud(g);
  });

  // ---------- 操作反馈 ----------

  function reportSwap(outcome, target) {
    if (!outcome.action) {
      if (outcome.reason === "locked") {
        renderer.setShake(target);
        ui.toast(t("toast.lockedPiece"), "warn");
        audio.play("blocked");
      }
      return false;
    }
    if (outcome.locked.length) {
      audio.play("lock");
      haptic(10);
      ui.sr(t("sr.locked", { n: outcome.locked.length }));
    } else {
      audio.play("swap");
    }
    ui.sr(t("sr.swapped", { moves: game.moves }));
    return true;
  }

  function doSwap(from, to) {
    if (game.phase !== PHASE.PLAYING) return;
    reportSwap(game.swap(from, to), to);
  }

  function doTap(cell) {
    if (game.phase !== PHASE.PLAYING) return;
    const outcome = game.tap(cell);
    if (outcome.action === "select") {
      audio.play("pick");
      ui.sr(t("sr.picked", { r: cell.r + 1, c: cell.c + 1 }));
      return;
    }
    if (outcome.action === "deselect") {
      audio.play("click");
      return;
    }
    reportSwap(outcome, cell);
  }

  function doReshuffle() {
    if (game.phase !== PHASE.PLAYING) return;
    const outcome = game.reshuffle();
    if (!outcome.ok) {
      ui.toast(t("toast.noShuffle"), "warn");
      audio.play("blocked");
      return;
    }
    audio.play("reshuffle");
    ui.toast(t("toast.shuffled", { n: outcome.left }), "info");
    ui.sr(t("sr.reshuffled", { n: outcome.left }));
  }

  function setPreview(active) {
    if (typeof window !== "undefined" && window.clearTimeout) window.clearTimeout(previewTimer);
    renderer.setPreview(active);
    ui.setPreviewState(active);
    if (active) {
      previewTimer = window.setTimeout(() => {
        renderer.setPreview(false);
        ui.setPreviewState(false);
      }, PREVIEW_HOLD_MS);
    }
  }

  // ---------- 语言 / 音效 ----------

  const langBtn = document.getElementById("btn-lang");
  if (langBtn) {
    langBtn.addEventListener("click", () => {
      toggleLocale();
      applyI18n(document);
      ui.applyText();
      ui.renderLevels(game);
      ui.syncHud(game);
      audio.play("click");
    });
  }

  const soundBtn = document.getElementById("btn-sound");
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      if (!muted) audio.unlock();
      muted = !muted;
      audio.setMuted(muted);
      storage.setMuted(muted);
      ui.setSoundState(muted);
      if (!muted) audio.play("click");
    });
  }

  // ---------- 弹层按钮 ----------

  const bind = (id, handler) => {
    const node = document.getElementById(id);
    if (node) node.addEventListener("click", handler);
    return node;
  };

  bind("btn-start", () => {
    audio.unlock();
    game.start();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-start-daily", () => {
    audio.unlock();
    game.loadDaily(todayKey());
    game.start();
    ui.hideAll();
    ui.toast(t("toast.daily", { name: t(`level.${game.level.id}`) }), "info");
    audio.play("click");
  });
  bind("btn-start-levels", () => {
    audio.unlock();
    ui.renderLevels(game);
    ui.show("ov-levels");
    audio.play("click");
  });
  bind("btn-start-help", () => {
    audio.unlock();
    ui.show("ov-help");
    audio.play("click");
  });

  bind("btn-daily", () => {
    audio.unlock();
    game.loadDaily(todayKey());
    game.start();
    ui.hideAll();
    ui.toast(t("toast.daily", { name: t(`level.${game.level.id}`) }), "info");
    audio.play("click");
  });

  bind("btn-next", () => {
    if (game.result && (game.result.isLast || game.result.isDaily)) {
      game.restart();
    } else {
      game.nextLevel();
    }
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-replay", () => {
    game.restart();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-win-levels", () => {
    ui.renderLevels(game);
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

  bind("btn-restart", () => {
    if (ui.anyOpen() && !ui.isOpen("ov-win")) return;
    game.restart();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-reshuffle", () => doReshuffle());
  bind("btn-levels", () => {
    ui.renderLevels(game);
    ui.show("ov-levels");
    audio.play("click");
  });
  bind("btn-help", () => {
    ui.show("ov-help");
    audio.play("click");
  });

  const previewBtn = document.getElementById("btn-preview");
  if (previewBtn) {
    previewBtn.addEventListener("pointerdown", (event) => {
      audio.unlock();
      setPreview(true);
      try {
        previewBtn.setPointerCapture(event.pointerId);
      } catch {
        /* 不支持指针捕获时靠 pointerleave 兜底 */
      }
      event.preventDefault();
    });
    previewBtn.addEventListener("pointerup", () => setPreview(false));
    previewBtn.addEventListener("pointercancel", () => setPreview(false));
    previewBtn.addEventListener("pointerleave", () => setPreview(false));
    previewBtn.addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") {
        setPreview(true);
        event.preventDefault();
      }
    });
    previewBtn.addEventListener("keyup", (event) => {
      if (event.key === " " || event.key === "Enter") setPreview(false);
    });
  }

  // ---------- 指针拖拽 ----------

  let drag = null;

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width ? renderer.size / rect.width : 1;
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
  }

  if (canvas.addEventListener) {
    canvas.addEventListener("pointerdown", (event) => {
      audio.unlock();
      if (ui.anyOpen() || game.phase !== PHASE.PLAYING) return;
      const cell = renderer.cellAt(event.clientX, event.clientY);
      if (!cell) return;
      if (game.state.locked[cell.r][cell.c]) {
        renderer.setShake(cell);
        ui.toast(t("toast.lockedPiece"), "warn");
        audio.play("blocked");
        return;
      }
      drag = {
        cell,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        pointerId: event.pointerId,
      };
      const point = localPoint(event);
      renderer.setDrag({ cell, x: point.x, y: point.y });
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* 退化为基础事件 */
      }
      event.preventDefault();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      const point = localPoint(event);
      renderer.setDrag({ cell: drag.cell, x: point.x, y: point.y });
      renderer.setHover(renderer.cellAt(event.clientX, event.clientY));
      event.preventDefault();
    });

    const finishDrag = (event, commit) => {
      if (!drag) return;
      const info = drag;
      drag = null;
      renderer.setDrag(null);
      renderer.setHover(null);
      try {
        canvas.releasePointerCapture(info.pointerId);
      } catch {
        /* 忽略 */
      }
      if (!commit) return;
      if (!info.moved) {
        doTap(info.cell);
        return;
      }
      const target = renderer.cellAt(event.clientX, event.clientY);
      if (!target || (target.r === info.cell.r && target.c === info.cell.c)) return;
      doSwap(info.cell, target);
    };

    canvas.addEventListener("pointerup", (event) => finishDrag(event, true));
    canvas.addEventListener("pointercancel", (event) => finishDrag(event, false));
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("blur", () => renderer.setCursor(null));
    canvas.addEventListener("focus", () => renderer.setCursor(game.cursor));
  }

  // ---------- 键盘 ----------

  const onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;

    if (key === "Escape") {
      if (ui.isOpen("ov-levels")) ui.hide("ov-levels");
      else if (ui.isOpen("ov-help")) ui.hide("ov-help");
      else if (game.selected) game.select(null);
      return;
    }

    if (ui.anyOpen()) {
      if (key === "h" || key === "H") {
        ui.hide("ov-help");
        event.preventDefault();
      }
      return;
    }

    audio.unlock();

    const dirs = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (dirs[key]) {
      game.moveCursor(dirs[key][0], dirs[key][1]);
      event.preventDefault();
      return;
    }

    if (key === " " || key === "Enter") {
      doTap(game.cursor);
      event.preventDefault();
      return;
    }
    if (key === "r" || key === "R") {
      game.restart();
      ui.hideAll();
      audio.play("click");
      event.preventDefault();
      return;
    }
    if (key === "s" || key === "S") {
      doReshuffle();
      event.preventDefault();
      return;
    }
    if (key === "l" || key === "L") {
      ui.renderLevels(game);
      ui.show("ov-levels");
      audio.play("click");
      event.preventDefault();
      return;
    }
    if (key === "h" || key === "H") {
      ui.show("ov-help");
      audio.play("click");
      event.preventDefault();
      return;
    }
    if (key === "v" || key === "V") {
      setPreview(true);
      event.preventDefault();
    }
  };

  const onKeyUp = (event) => {
    if (event.key === "v" || event.key === "V") setPreview(false);
  };

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) game.pauseTimer();
      else game.resumeTimer();
    });
  }

  // ---------- HUD 计时 ----------

  let timerId = 0;
  if (typeof window !== "undefined" && window.setInterval) {
    timerId = window.setInterval(() => {
      if (game.phase === PHASE.PLAYING) {
        ui.syncTime(game);
        ui.syncScore(game);
      }
    }, 250);
  }
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("beforeunload", () => {
      if (timerId) window.clearInterval(timerId);
      audio.dispose();
    });
  }

  // ---------- 首屏 ----------

  ui.applyText();
  ui.setSoundState(muted);
  afterLevelChange();
  renderer.mount();
  renderer.setState(game.state, "init");
  ui.show("ov-start");

  if (!storage.isPersistent()) {
    ui.toast(t("toast.noPersist"), "warn");
  }

  if (typeof window !== "undefined") {
    window.__jigsaw = { game, renderer, ui, levelCount: LEVEL_COUNT };
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
