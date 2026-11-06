// filepath: games/ice-slide/js/main.mjs
// 装配入口：把 engine / game / renderer / ui / audio / storage / i18n 接到一起。
// 首屏零门槛：boot 即载入可玩盘面（无前置弹窗）；状态永远由 game.mjs 持有，DOM 永远由 ui.mjs 持有。
// 滑行是原子回合结算，动画在渲染层补间；动画期间方向盘上锁 + 单槽输入缓冲（连点不吞指令）。

import { PHASE, MODE, createGame } from "./game.mjs";
import { DIRS } from "./engine.mjs";
import { createRenderer, createUI } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import * as storage from "./storage.mjs";
import { starsFor } from "./score.mjs";
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

/** 本地时区日期键 YYYY-MM-DD（每日一局同题口径） */
function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function boot() {
  const canvas = document.getElementById("board");
  if (!canvas) return;

  loadLocale();
  const data = storage.load();
  const today = todayKey();

  const game = createGame();
  const renderer = createRenderer(canvas);
  const ui = createUI({
    onPickLevel: (index) => {
      if (!storage.isUnlocked(index)) {
        ui.toast(t("toast.locked"), "warn");
        return;
      }
      audio.unlock();
      storage.setCurrent(index);
      game.loadLevel(index, MODE.CAMPAIGN);
      game.start();
      afterLevelChange();
      ui.hideAll();
      audio.play("click");
    },
  });

  let muted = data.muted === true;
  const audio = createAudio({ muted });

  // 雪花微尘（环境粒子，reduced-motion 下 CSS 直接隐藏整层）
  const snow = document.getElementById("snow");
  if (snow) {
    for (let i = 0; i < 14; i++) {
      const span = document.createElement("span");
      span.style.left = `${Math.random() * 100}%`;
      span.style.animationDuration = `${7 + Math.random() * 9}s`;
      span.style.animationDelay = `${-Math.random() * 10}s`;
      span.style.opacity = String(0.25 + Math.random() * 0.45);
      const size = 2 + Math.random() * 3;
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      snow.appendChild(span);
    }
  }

  // ---------- 动画 / 输入缓冲 ----------

  let animating = false;
  let animEndAt = 0;
  let bufferedDir = null; // 单槽缓冲：滑行期间的方向意图
  let hint = null;
  let rafId = 0;

  function loop(now) {
    const busy = renderer.frame(now);
    if (animating && now >= animEndAt) {
      animating = false;
      rafId = 0;
      ui.setPadLocked(false);
      renderer.draw(game.state, { hintDir: hint });
      const dir = bufferedDir;
      bufferedDir = null;
      if (dir !== null) tryMove(dir);
      return;
    }
    if (busy || animating) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = 0;
    }
  }

  function ensureLoop() {
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function drawWithState() {
    const view = game.getView();
    ui.syncHud(view);
    renderer.draw(game.state, { hintDir: hint });
  }

  function afterLevelChange() {
    hint = null;
    bufferedDir = null;
    drawWithState();
  }

  game.subscribe((view, reason) => {
    if (reason === "win") {
      const res = finalizeWin(view);
      hint = null;
      renderer.draw(game.state, { hintDir: null });
      ui.showWin(view, res);
      return;
    }
    drawWithState();
    if (reason === "level") {
      ui.syncHud(view);
    }
  });

  function finalizeWin(view) {
    const stars = starsFor(view.moves, view.par);
    const rec = storage.recordResult(view.meta.id, { moves: view.moves, stars });
    if (view.mode === MODE.DAILY) storage.recordDaily(today, view.moves);
    const best = storage.current().levels[view.meta.id];
    const bestLine = best
      ? t("win.bestLine", { moves: best.bestMoves, stars: best.stars })
      : "";
    // 通关：逐箱入标叮铃 + 极光和弦
    const onGoal = view.boxesOnGoal;
    for (let i = 0; i < onGoal; i++) {
      window.setTimeout(() => audio.play("goal"), i * 110);
    }
    window.setTimeout(() => audio.play("win"), 160 + onGoal * 110);
    // 冰晶迸溅
    if (game.state && game.state.last) renderer.burst(game.state.player);
    return { stars, isNewBest: rec.isNewBest, bestLine };
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
    // 原地热更新：不碰 game 状态，仅重绘文本
    ui.syncHud(game.getView());
    ui.renderLevels(game.getView(), storage.current());
    ui.setMode(game.mode);
    audio.play("click");
  });

  bind("btn-sound", () => {
    audio.unlock();
    muted = !muted;
    audio.setMuted(muted);
    storage.setMuted(muted);
    ui.setSoundState(muted);
    if (!muted) audio.play("click");
  });

  // ---------- 模式轨 ----------

  bind("mode-campaign", () => {
    audio.unlock();
    const idx = storage.current().current;
    game.loadLevel(idx, MODE.CAMPAIGN);
    game.start();
    ui.setMode(MODE.CAMPAIGN);
    afterLevelChange();
    ui.hideAll();
    audio.play("click");
  });

  bind("mode-daily", () => {
    audio.unlock();
    if (storage.isDailyDone(today)) {
      ui.toast(t("toast.dailyLocked"), "warn");
      audio.play("click");
      return;
    }
    game.startDaily(today);
    game.start();
    ui.setMode(MODE.DAILY);
    afterLevelChange();
    ui.hideAll();
    ui.toast(t("toast.modeDaily"), "info");
    audio.play("click");
  });

  bind("mode-practice", () => {
    audio.unlock();
    const idx = storage.current().current;
    game.loadLevel(idx, MODE.PRACTICE);
    game.start();
    ui.setMode(MODE.PRACTICE);
    afterLevelChange();
    ui.hideAll();
    ui.toast(t("toast.modePractice"), "info");
    audio.play("click");
  });

  // ---------- 弹层按钮 ----------

  const beginPlay = () => {
    audio.unlock();
    game.start();
    ui.hideAll();
    drawWithState();
    audio.play("click");
  };

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
    if (game.mode === MODE.DAILY || game.levelIndex >= 31) {
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
  bind("btn-help", () => {
    ui.show("ov-help");
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

  // 方向盘（点选方向滑行）
  for (const btn of document.querySelectorAll(".pad-btn")) {
    btn.addEventListener("click", () => {
      audio.unlock();
      tryMove(Number(btn.getAttribute("data-dir")));
    });
  }

  function doUndo() {
    if (!game.undo()) {
      ui.toast(t("toast.noUndo"), "warn");
      return;
    }
    hint = null;
    bufferedDir = null;
    ui.sr(t("sr.undone", { moves: game.getView().moves }));
    audio.play("undo");
    drawWithState();
  }

  function doHint() {
    const view = game.getView();
    if (view.phase !== PHASE.PLAYING) return;
    const res = game.hintDir();
    if (res === null) return; // 保险丝静默
    if (res.dead) {
      ui.toast(t("toast.hintNone"), "warn");
      return;
    }
    if (res.won) return;
    hint = res.dir;
    ui.toast(`${t("toast.hint")} · ${t(`dir.${DIRS[res.dir].name}`)}`, "good");
    ui.sr(t("toast.hint"));
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
    if (animating) {
      // 单槽缓冲：滑行期间的方向意图不吞（动画结束立即执行）
      bufferedDir = dirId;
      return;
    }
    const beforeOnGoal = view.boxesOnGoal;
    const ok = game.move(dirId);
    if (!ok) {
      // 无效意图：冰面轻咚反馈，不惩罚不弹窗
      audio.play("hitWall");
      return;
    }
    hint = null;
    const last = game.state.last;
    const dist = last && last.path ? last.path.length - 1 : 1;
    const pushed = last && last.boxFrom >= 0;
    if (pushed) audio.play("push");
    else audio.play("slide", dist);
    const animMs = renderer.startAnim(last);
    if (animMs > 0) {
      animating = true;
      animEndAt = performance.now() + animMs;
      ui.setPadLocked(true);
      ensureLoop();
      // 撞停瞬间：冰面撞击 + 震动 + （新入标）叮铃（通关音由 finalizeWin 负责，避免双响）
      window.setTimeout(() => {
        if (game.phase !== PHASE.PLAYING) return;
        audio.play("hitWall");
        renderer.bump();
        const nowOnGoal = game.getView().boxesOnGoal;
        if (nowOnGoal > beforeOnGoal) {
          audio.play("goal");
          renderer.burst(game.state.player);
        }
      }, animMs);
    } else {
      const nowOnGoal = game.getView().boxesOnGoal;
      if (nowOnGoal > beforeOnGoal) audio.play("goal");
      drawWithState();
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

    if (key === "z" || key === "Z" || key === "u" || key === "U" || key === "Backspace") {
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

  // 最近一次用户交互时间：防止页面隐藏/焦点抖动误触发自动暂停
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
    if (rafId) cancelAnimationFrame(rafId);
    audio.dispose();
  });

  // ---------- 启动 ----------

  function syncLangButton() {
    const btn = document.getElementById("btn-lang");
    // "中文" 为 check-game 官方白名单字面量（语言切换按钮专用）
    if (btn) btn.textContent = getLocale() === "zh" ? "EN" : "中文";
  }

  function updateTitle() {
    document.title = `${t("app.title")} · DOIN`;
  }

  applyI18n(document);
  syncLangButton();
  updateTitle();
  ui.setSoundState(muted);
  ui.setMode(MODE.CAMPAIGN);
  game.loadLevel(storage.current().current, MODE.CAMPAIGN);
  game.start(); // 首屏零门槛：载入即开局
  afterLevelChange();
  ui.syncHud(game.getView());
  ui.syncTime(game.getView());

  if (!storage.isPersistent()) {
    ui.toast(t("toast.noPersist"), "warn");
  }

  // 调试句柄（门户约定：window.__<slug>，排查与自动化冒烟用；slug 含连字符走下标）
  window["__ice-slide"] = {
    game,
    view: () => game.getView(),
    state: () => game.state,
    locale: getLocale,
    isAnimating: () => animating,
  };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
