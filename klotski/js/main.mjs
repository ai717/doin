// filepath: games/klotski/js/main.mjs
// 装配入口：把 engine / game / render / ui / audio / storage / i18n 接到一起。
// 只在这里绑定事件与启动主循环；状态永远由 game.mjs 持有，DOM 永远由 ui.mjs 持有。

import { PHASE } from "./game.mjs";
import { createGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import * as audio from "./audio.mjs";
import * as storage from "./storage.mjs";
import {
  applyI18n,
  loadLocale,
  saveLocale,
  toggleLocale,
  t,
} from "./i18n.mjs";

const KEY_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  a: "left",
  A: "left",
  s: "down",
  S: "down",
  d: "right",
  D: "right",
};

const DIR_LABEL = { up: "dir.up", down: "dir.down", left: "dir.left", right: "dir.right" };

/** 棋子刻字随语言切换（中英都要有字，不能只在中文下显示） */
const pieceLabels = () => ({
  caocao: t("piece.caocao"),
  guanyu: t("piece.guanyu"),
  general: t("piece.general"),
  soldier: t("piece.soldier"),
});

function boot() {
  const canvas = document.getElementById("board");
  if (!canvas) return;

  loadLocale();
  const data = storage.load();

  const game = createGame();
  const renderer = createRenderer(canvas, { labelMap: pieceLabels() });
  const ui = createUI({
    onPickLevel: (index, unlocked) => {
      if (!unlocked) {
        ui.toast(t("toast.locked"), "warn");
        audio.play("blocked");
        return;
      }
      game.loadLevel(index);
      game.start();
      afterLevelChange();
      ui.hideAll();
      audio.play("click");
    },
  });

  let muted = data.muted === true;
  audio.setMuted(muted);

  function afterLevelChange() {
    renderer.setLevel(game.level.id);
    renderer.setState(game.state);
    renderer.setSelected(null);
    ui.resetMovesCache();
    ui.syncHud(game);
  }

  function syncAll() {
    ui.syncHud(game);
  }

  game.subscribe((g, reason) => {
    if (reason === "win") {
      renderer.setSelected(null);
      renderer.setState(g.state);
      renderer.burst([{ r: 3, c: 1, big: true }]);
      ui.syncHud(g);
      ui.showWin(g);
      audio.playWin(g.result ? g.result.stars : 1);
      return;
    }
    renderer.setState(g.state);
    renderer.setSelected(g.selectedId);
    ui.syncHud(g);
    if (reason === "level") afterLevelChange();
  });

  // ---------- 语言 / 音效 ----------

  const langBtn = document.getElementById("btn-lang");
  if (langBtn) {
    langBtn.addEventListener("click", () => {
      toggleLocale();
      applyI18n(document);
      ui.applyText();
      renderer.setLabelMap(pieceLabels());
      ui.syncMeta(game);
      ui.renderLevels(game);
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

  const beginPlay = () => {
    audio.unlock();
    game.start();
    ui.hideAll();
    ui.syncHud(game);
    audio.play("click");
  };

  bind("btn-start", beginPlay);
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

  bind("btn-resume", () => {
    game.resume();
    ui.hide("ov-pause");
    audio.play("click");
  });
  bind("btn-pause-restart", () => {
    game.restart();
    afterLevelChange();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-pause-levels", () => {
    ui.renderLevels(game);
    ui.show("ov-levels");
    audio.play("click");
  });
  bind("btn-pause-help", () => {
    ui.show("ov-help");
    audio.play("click");
  });

  bind("btn-next", () => {
    if (game.result && game.result.isLast) {
      game.restart();
    } else {
      game.nextLevel();
    }
    afterLevelChange();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-replay", () => {
    game.restart();
    afterLevelChange();
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

  bind("btn-undo", () => doUndo());
  bind("btn-restart", () => {
    if (ui.anyOpen() && !ui.isOpen("ov-win")) return;
    game.restart();
    afterLevelChange();
    ui.hideAll();
    audio.play("click");
  });
  bind("btn-pause", () => doPause());
  bind("btn-levels", () => {
    ui.renderLevels(game);
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
    ui.sr(t("sr.undone", { moves: game.moves }));
    audio.play("undo");
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

  // ---------- 指针拖拽 ----------

  let drag = null;

  function dragTarget(id) {
    return { id, axis: "x", offset: 0 };
  }

  function updateDrag(clientX, clientY) {
    if (!drag) return;
    const dx = (clientX - drag.startX) / renderer.metrics().cell;
    const dy = (clientY - drag.startY) / renderer.metrics().cell;
    const axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    const delta = axis === "x" ? dx : dy;
    if (delta === 0) {
      renderer.setDrag(null);
      drag.offset = 0;
      return;
    }
    const dir =
      axis === "x" ? (delta > 0 ? "right" : "left") : delta > 0 ? "down" : "up";
    const range = renderer.slideRange(drag.id, dir);
    const clamped = Math.max(-range, Math.min(range, delta));
    drag.axis = axis;
    drag.dir = dir;
    drag.offset = clamped;
    renderer.setDrag({ id: drag.id, axis, offset: clamped });
  }

  function endDrag(commit) {
    if (!drag) return;
    const info = drag;
    drag = null;
    renderer.setDrag(null);
    if (!commit || !info.dir || !info.offset) return;
    const steps = Math.round(Math.abs(info.offset));
    if (steps <= 0) return;
    const moved = game.slide(info.id, info.dir, steps);
    if (moved > 0) {
      audio.play(moved > 1 ? "slide" : "move");
      ui.sr(
        t("sr.moved", { id: info.id, dir: t(DIR_LABEL[info.dir]), moves: game.moves })
      );
    }
  }

  if (canvas.addEventListener) {
    canvas.addEventListener("pointerdown", (event) => {
      audio.unlock();
      if (ui.anyOpen()) return;
      const id = renderer.pieceAt(event.clientX, event.clientY);
      if (!id) return;
      game.select(id);
      renderer.setSelected(id);
      drag = { id, startX: event.clientX, startY: event.clientY, axis: "x", offset: 0, dir: null };
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* 不支持捕获时退化为基础事件 */
      }
      event.preventDefault();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drag) return;
      updateDrag(event.clientX, event.clientY);
      event.preventDefault();
    });

    canvas.addEventListener("pointerup", (event) => {
      endDrag(true);
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* 忽略 */
      }
    });

    canvas.addEventListener("pointercancel", () => endDrag(false));
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("blur", () => renderer.setSelected(null));
  }

  // ---------- 键盘 ----------

  const onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;

    if (key === "Escape") {
      if (ui.isOpen("ov-levels")) ui.hide("ov-levels");
      else if (ui.isOpen("ov-help")) ui.hide("ov-help");
      return;
    }

    if (ui.anyOpen()) {
      if (key === " " || key === "Enter") return; // 交给按钮自己处理
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

    if (key === "z" || key === "Z") {
      doUndo();
      event.preventDefault();
      return;
    }
    if (key === "r" || key === "R") {
      game.restart();
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

    // 切换选中的方块：键盘玩家必须能选中任意一块，否则会被堵死
    if (key === "[" || key === "]") {
      const ids = game.state.pieces.map((piece) => piece.id);
      if (ids.length) {
      const at = ids.indexOf(game.selectedId);
      const step = key === "]" ? 1 : -1;
      const nextId = ids[(at + step + ids.length) % ids.length];
      game.select(nextId);
        renderer.setSelected(nextId);
        ui.sr(t("sr.selected", { id: nextId }));
        audio.play("click");
      }
      event.preventDefault();
      return;
    }

    const dir = KEY_DIR[key];
    if (!dir) return;
    let id = game.selectedId;
    if (!id) {
      const goal = game.state.pieces.find((piece) => piece.kind === "caocao");
      id = goal ? goal.id : game.state.pieces[0]?.id;
      if (id) {
        game.select(id);
        renderer.setSelected(id);
      }
    }
    if (!id) return;
    if (game.move(id, dir)) {
      audio.play("move");
      ui.sr(t("sr.moved", { id, dir: t(DIR_LABEL[dir]), moves: game.moves }));
    } else {
      audio.play("blocked");
      ui.toast(t("toast.blocked"), "warn");
    }
    event.preventDefault();
  };

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("keydown", onKeyDown);
    // 切走标签页时自动暂停：计时不该在玩家看不见的时候继续走
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && game.phase === PHASE.PLAYING) doPause();
    });
  }

  // ---------- HUD 计时 ----------

  let timerId = 0;
  if (typeof window !== "undefined" && window.setInterval) {
    timerId = window.setInterval(() => {
      if (game.phase === PHASE.PLAYING) ui.syncTime(game);
    }, 250);
  }
  window.addEventListener("beforeunload", () => {
    if (timerId) window.clearInterval(timerId);
    audio.dispose();
  });

  // ---------- 首屏 ----------

  ui.applyText();
  ui.setSoundState(muted);
  afterLevelChange();
  ui.syncHud(game);
  renderer.mount();
  renderer.setState(game.state);
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
