// 倒退贪吃蛇 Uncoil · DOM 层（唯一碰 DOM 的位置；规则与存档一律走 game / storage）
//
// ★ 浮层可见性以 classList 为唯一真相源：所有开关都必须经 showOverlay()，
//   否则 UI 的 currentOverlay 会与真实 DOM 脱钩（关闭说明浮层时按陈旧值回落）。

import { t, loadLocale, saveLocale, htmlLang } from "./i18n.mjs";
import { STATUS } from "./engine.mjs";
import { MODE, dateKeyOf } from "./game.mjs";
import { LEVELS, ENDGAME, CHAPTERS, levelsOfChapter } from "./levels.mjs";
import { starMarks } from "./score.mjs";
import {
  loadSave,
  saveSave,
  clearSave,
  recordClear,
  totalStars,
  solvedEndgames,
  STAGE_COUNT,
  ENDGAME_COUNT
} from "./storage.mjs";

const CHAPTER_KEY = {
  chapter_1: "chapter1",
  chapter_2: "chapter2",
  chapter_3: "chapter3",
  chapter_4: "chapter4",
  chapter_5: "chapter5",
  endgame: "chapterEndgame"
};

const OVERLAYS = {
  none: null,
  start: "screen-start",
  help: "screen-help",
  clear: "screen-clear"
};

const KEY_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right"
};

const DIRS = ["up", "down", "left", "right"];

export class UncoilUI {
  constructor(doc) {
    this.doc = doc ?? globalThis.document;
    this.locale = loadLocale();
    this.save = loadSave();
    this.game = null;
    this.renderer = null;
    this.audio = null;
    this.currentOverlay = "start";
    this.helpReturn = "start";
    this.mode = MODE.STAGE;
    this.endTimer = null;
    this.replayTimer = null;
    this.resetArmed = false;
    this.pointerStart = null;
  }

  el(id) {
    return this.doc.getElementById(id);
  }

  // ---------- 装配 ----------
  attach({ game, renderer, audio }) {
    this.game = game;
    this.renderer = renderer;
    this.audio = audio;
    this.bindGame();
    this.bindControls();
    this.applyLocale();
    this.buildLevelGrid();
    this.showOverlay("start");
    this.syncHud();
  }

  bindGame() {
    const game = this.game;
    game.subscribe((evt) => {
      if (evt.type === "loaded") {
        const st = game.state;
        this.renderer.setLevel(st.level);
        this.renderer.setView(st.engine, 0);
        this.stopReplay();
        this.setStuck(false);
        this.clearEnd();
        this.syncHud();
        this.resize();
      } else if (evt.type === "move") {
        this.renderer.playMove(evt.prev, game.state.engine, evt.action);
        this.audio.step();
        this.syncHud();
      } else if (evt.type === "eat") {
        this.audio.eat();
      } else if (evt.type === "blocked") {
        this.audio.blocked();
      } else if (evt.type === "undo") {
        this.renderer.setView(game.state.engine, game.progress());
        this.audio.undo();
        this.setStuck(false);
        this.syncHud();
      } else if (evt.type === "win") {
        this.audio.win();
        this.syncHud();
        this.scheduleEnd(() => this.finishWin(evt));
      } else if (evt.type === "entombed") {
        this.audio.stuck();
        this.syncHud();
        this.scheduleEnd(() => this.setStuck(true));
      }
    });
  }

  // 终局演出统一走这里：真实环境靠 setTimeout，测试可用 flushEnd() 立即推进
  scheduleEnd(fn, delay = 620) {
    this.clearEnd();
    this.endFn = fn;
    if (typeof setTimeout === "function") {
      this.endTimer = setTimeout(() => {
        this.endTimer = null;
        this.flushEnd();
      }, delay);
    }
  }

  clearEnd() {
    if (this.endTimer && typeof clearTimeout === "function") clearTimeout(this.endTimer);
    this.endTimer = null;
    this.endFn = null;
  }

  flushEnd() {
    const fn = this.endFn;
    this.clearEnd();
    if (fn) fn();
  }

  finishWin(evt) {
    const game = this.game;
    const st = game.state;
    const id = st.levelId;
    const prevBest = st.mode === MODE.STAGE ? this.save.best[id] : st.mode === MODE.ENDGAME ? this.save.endgameBest[id] : undefined;
    const wasRecord = prevBest === undefined || evt.steps < prevBest;
    this.save = recordClear(this.save, {
      id,
      mode: st.mode,
      steps: evt.steps,
      stars: evt.stars,
      index: st.index,
      dateKey: st.dateKey ?? dateKeyOf()
    });
    saveSave(this.save);

    this.el("clear-stars").textContent = `${starMarks(evt.stars)}  ${t(this.locale, "starsLine", { n: evt.stars })}`;
    this.el("clear-line").textContent = t(this.locale, "clearStats", { s: evt.steps, t: st.level.par });
    this.el("clear-record").textContent = wasRecord ? t(this.locale, "newRecord") : "";
    const nextBtn = this.el("btn-next-level");
    if (nextBtn) {
      const hasNext = !!game.nextLevelId();
      nextBtn.classList.toggle("hidden", !hasNext);
    }
    this.showOverlay("clear");
    this.buildLevelGrid();
    this.syncHud();
  }

  setStuck(on) {
    const bar = this.el("stuck-bar");
    if (bar) bar.classList.toggle("hidden", !on);
  }

  // ---------- 浮层 ----------
  showOverlay(name) {
    const target = OVERLAYS[name] ?? null;
    for (const key of Object.keys(OVERLAYS)) {
      const id = OVERLAYS[key];
      if (!id) continue;
      const el = this.el(id);
      if (el) el.classList.toggle("hidden", id !== target);
    }
    this.currentOverlay = name;
  }

  // ---------- 事件绑定 ----------
  bindControls() {
    const on = (id, evt, fn) => {
      const el = this.el(id);
      if (el) el.addEventListener(evt, fn);
      return el;
    };

    on("btn-sound", "click", () => {
      this.save.sound = !this.save.sound;
      this.audio.setEnabled(this.save.sound);
      saveSave(this.save);
      this.applyLocale();
    });
    on("btn-lang", "click", () => {
      this.locale = this.locale === "zh" ? "en" : "zh";
      saveLocale(this.locale);
      this.applyLocale();
      this.buildLevelGrid();
      this.syncHud();
    });
    // ★ 借屏浮层：从哪来回哪去。对局中打开说明（currentOverlay === "none"）
    //   就必须回到对局，不能回落选关 —— 否则玩家体感是"看个说明就重开了"。
    on("btn-help", "click", () => {
      this.helpReturn = this.currentOverlay;
      this.showOverlay("help");
    });
    on("btn-help-close", "click", () => {
      this.showOverlay(this.helpReturn);
    });
    on("btn-reset-save", "click", () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        const btn = this.el("btn-reset-save");
        if (btn) btn.textContent = t(this.locale, "saveResetConfirm");
        return;
      }
      this.save = clearSave() ? loadSave() : loadSave();
      this.resetArmed = false;
      this.buildLevelGrid();
      this.syncHud();
      this.toast(t(this.locale, "saveCleared"));
    });

    for (const dir of DIRS) {
      const id = `btn-${dir}`;
      on(id, "click", () => this.tryMove(dir));
    }
    on("btn-undo", "click", () => this.tryUndo());
    on("btn-stuck-undo", "click", () => this.tryUndo());
    on("btn-reset", "click", () => this.tryReset());
    on("btn-stuck-reset", "click", () => this.tryReset());
    on("btn-menu", "click", () => {
      this.stopReplay();
      this.buildLevelGrid();
      this.showOverlay("start");
    });
    on("btn-replay", "click", () => this.startReplay());
    on("btn-retry", "click", () => {
      this.tryReset();
      this.showOverlay("none");
    });
    on("btn-to-select", "click", () => {
      this.buildLevelGrid();
      this.showOverlay("start");
    });
    on("btn-next-level", "click", () => {
      const id = this.game.nextLevelId();
      if (id) {
        this.game.loadLevel(id, this.game.state.mode);
        this.showOverlay("none");
      } else {
        this.buildLevelGrid();
        this.showOverlay("start");
      }
    });

    on("btn-mode-stage", "click", () => this.switchMode(MODE.STAGE));
    on("btn-mode-endgame", "click", () => this.switchMode(MODE.ENDGAME));
    on("btn-mode-daily", "click", () => {
      this.stopReplay();
      this.game.loadDaily(dateKeyOf());
      this.showOverlay("none");
    });

    // 选关网格（事件委托：桩不冒泡，测试需 parent.dispatch(evt, {target: child})）
    const grid = this.el("level-grid");
    if (grid) {
      grid.addEventListener("click", (ev) => {
        const btn = ev.target && ev.target.dataset ? ev.target : null;
        if (!btn || !btn.dataset.level) return;
        const id = btn.dataset.level;
        const mode = btn.dataset.mode === "endgame" ? MODE.ENDGAME : MODE.STAGE;
        this.game.loadLevel(id, mode);
        this.showOverlay("none");
      });
    }

    // 舞台交互：点相邻格 / 滑动
    const board = this.el("board");
    if (board) {
      board.addEventListener("pointerdown", (ev) => {
        this.pointerStart = { x: ev.clientX, y: ev.clientY };
      });
      board.addEventListener("pointerup", (ev) => {
        const start = this.pointerStart;
        this.pointerStart = null;
        if (!start) return;
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
          const dir = this.dirOfCell(ev.clientX, ev.clientY);
          if (dir) this.tryMove(dir);
          return;
        }
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        this.tryMove(dir);
      });
    }

    const doc = this.doc;
    if (doc && doc.addEventListener) {
      doc.addEventListener("keydown", (ev) => {
        const key = ev.key;
        if (key === "z" || key === "Z") {
          this.tryUndo();
          return;
        }
        if (key === "r" || key === "R") {
          this.tryReset();
          return;
        }
        const dir = KEY_DIR[key];
        if (dir) this.tryMove(dir);
      });
    }

    const win = globalThis.window;
    if (win && win.addEventListener) {
      win.addEventListener("resize", () => this.resize());
    }
    if (doc && doc.addEventListener) {
      doc.addEventListener("orientationchange", () => this.resize());
    }
  }

  dirOfCell(clientX, clientY) {
    const board = this.el("board");
    if (!board || !this.renderer) return null;
    const rect = board.getBoundingClientRect ? board.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    // rect 是 CSS 像素，renderer 用的是舞台逻辑像素；两者通常相等，
    // 但 canvas 的 CSS 尺寸被外部样式改过时就会分叉，这里统一归一化。
    const sx = rect.width ? this.renderer.width / rect.width : 1;
    const sy = rect.height ? this.renderer.height / rect.height : 1;
    const cell = this.renderer.cellAt((clientX - rect.left) * sx, (clientY - rect.top) * sy);
    if (!cell) return null;
    const head = this.game.state.engine.snake[0];
    const dr = cell.r - head.r;
    const dc = cell.c - head.c;
    if (dr === -1 && dc === 0) return "up";
    if (dr === 1 && dc === 0) return "down";
    if (dr === 0 && dc === -1) return "left";
    if (dr === 0 && dc === 1) return "right";
    return null;
  }

  switchMode(mode) {
    this.mode = mode;
    this.stopReplay();
    this.buildLevelGrid();
    const first = mode === MODE.ENDGAME ? ENDGAME[0] : LEVELS.find((l) => l.chapter === "chapter_1");
    if (first) {
      this.game.loadLevel(first.id, mode);
      this.showOverlay("none");
    }
  }

  // ---------- 操作意图（一律交给 game 裁决，UI 不自造规则） ----------
  tryMove(dir) {
    if (!this.game || !this.game.state) return false;
    if (this.currentOverlay !== "none") return false;
    this.stopReplay();
    const action = this.game.move(dir);
    if (!action) this.toast(t(this.locale, "blocked"));
    return !!action;
  }

  tryUndo() {
    if (!this.game) return false;
    this.stopReplay();
    const ok = this.game.undo();
    if (!ok && this.game.state && this.game.state.status !== STATUS.WON) return false;
    if (this.currentOverlay === "clear") this.showOverlay("none");
    return true;
  }

  tryReset() {
    if (!this.game) return false;
    this.stopReplay();
    this.game.restart();
    this.showOverlay("none");
    return true;
  }

  // ---------- 演示解法 ----------
  startReplay() {
    if (!this.game || this.replayTimer) return;
    if (this.currentOverlay !== "none") this.showOverlay("none");
    const delay = 200;
    const tick = () => {
      const dir = this.game.solveDir();
      if (!dir) {
        this.stopReplay();
        this.toast(t(this.locale, "replayDone"));
        return;
      }
      this.game.move(dir);
      this.replayTimer = setTimeout(tick, delay);
    };
    tick();
  }

  stopReplay() {
    if (this.replayTimer && typeof clearTimeout === "function") clearTimeout(this.replayTimer);
    this.replayTimer = null;
  }

  // ---------- 文本 / HUD ----------
  applyLocale() {
    const set = (id, key, values) => {
      const el = this.el(id);
      if (el) el.textContent = t(this.locale, key, values);
    };
    const doc = this.doc;
    if (doc && doc.querySelectorAll) {
      for (const el of doc.querySelectorAll("[data-i18n]")) {
        const key = el.dataset ? el.dataset.i18n : null;
        if (key) el.textContent = t(this.locale, key);
      }
    }
    if (doc && doc.documentElement) doc.documentElement.lang = htmlLang();
    set("btn-sound", this.save.sound ? "soundOn" : "soundOff");
    set("btn-lang", "langBtn");
    set("btn-reset-save", "saveReset");
    for (let i = 1; i <= 6; i += 1) set(`help-body-${i}`, `helpBody${i}`);
    set("stuck-line", "stuckLine");
    set("stuck-hint", "stuckHint");
    set("chapter-label", CHAPTER_KEY[this.game && this.game.state ? this.game.state.level.chapter : "chapter_1"] ?? "chapter1");
    this.syncHud();
  }

  syncHud() {
    const game = this.game;
    if (!game || !game.state) return;
    const st = game.state;
    const engine = st.engine;
    const set = (id, value) => {
      const el = this.el(id);
      if (el) el.textContent = String(value);
    };

    const chKey = CHAPTER_KEY[st.level.chapter] ?? "chapter1";
    set("chapter-label", t(this.locale, chKey));
    if (st.mode === MODE.STAGE) {
      set("level-progress", `${st.index + 1} / ${STAGE_COUNT}`);
    } else if (st.mode === MODE.ENDGAME) {
      const i = ENDGAME.findIndex((l) => l.id === st.levelId);
      set("level-progress", `${i + 1} / ${ENDGAME_COUNT}`);
    } else {
      set("level-progress", t(this.locale, "modeDaily"));
    }

    set("len-val", engine.snake.length);
    set("pellets-val", game.pelletsLeft());
    set("steps-val", engine.steps);
    set("par-val", st.level.par);
    set("mh-len", engine.snake.length);
    set("mh-steps", engine.steps);
    set("mh-pellets", game.pelletsLeft());
    set("undos-val", st.undos);

    const pct = Math.round(game.progress() * 100);
    const fill = this.el("progress-fill");
    if (fill) fill.style.width = `${pct}%`;
    set("progress-val", `${pct}%`);
    if (this.renderer) this.renderer.progress = game.progress();

    set("status-val", t(this.locale, engine.status === STATUS.WON ? "statusWon" : engine.status === STATUS.ENTOMBED ? "statusStuck" : "statusPlaying"));

    const best = st.mode === MODE.STAGE ? this.save.best[st.levelId] : st.mode === MODE.ENDGAME ? this.save.endgameBest[st.levelId] : null;
    set("best-val", best ? String(best) : "-");
    set("daily-line", this.save.dailyDone && this.save.dailyDate === dateKeyOf() ? String(this.save.dailySteps) : "-");
    set("endgame-line", `${solvedEndgames(this.save)} / ${ENDGAME_COUNT}`);
    const total = this.el("stars-total");
    if (total) total.textContent = t(this.locale, "starsTotal", { n: totalStars(this.save) });

    const undoBtn = this.el("btn-undo");
    if (undoBtn) undoBtn.classList.toggle("is-off", !game.canUndo());
  }

  buildLevelGrid() {
    const grid = this.el("level-grid");
    if (!grid || !this.doc.createElement) return;
    grid.innerHTML = "";
    const doc = this.doc;
    if (this.mode === MODE.ENDGAME) {
      ENDGAME.forEach((lv, i) => {
        const btn = doc.createElement("button");
        btn.className = "lv-cell";
        btn.dataset.level = lv.id;
        btn.dataset.mode = "endgame";
        const best = this.save.endgameBest[lv.id];
        btn.textContent = best ? `${i + 1}·${best}` : String(i + 1);
        if (best) btn.classList.add("is-clear");
        grid.appendChild(btn);
      });
      return;
    }
    let n = 0;
    for (const ch of CHAPTERS) {
      for (const lv of levelsOfChapter(ch)) {
        n += 1;
        const btn = doc.createElement("button");
        btn.className = "lv-cell";
        btn.dataset.level = lv.id;
        btn.dataset.mode = "stage";
        const locked = n > this.save.unlocked;
        btn.textContent = String(n);
        if (locked) btn.classList.add("is-locked");
        const stars = this.save.stars[lv.id] ?? 0;
        if (stars > 0) btn.classList.add("is-clear");
        grid.appendChild(btn);
      }
    }
  }

  toast(msg) {
    const el = this.el("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-on");
    if (typeof setTimeout === "function") {
      setTimeout(() => el.classList.remove("is-on"), 900);
    }
  }

  resize() {
    if (!this.renderer || !this.game || !this.game.state) return;
    const win = globalThis.window ?? { innerWidth: 1024, innerHeight: 768 };
    const w = win.innerWidth || 1024;
    const h = win.innerHeight || 768;
    const narrow = w < 900;
    const raw = narrow
      ? Math.min(w - 28, h - 320, 460)
      : Math.min(h - 190, w - 620, 660);
    const size = Math.max(220, Math.floor(raw));
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.renderer.resize(size, size, dpr);
    const board = this.el("board");
    if (board && board.style) {
      board.style.width = `${size}px`;
      board.style.height = `${size}px`;
    }
    this.renderer.setView(this.game.state.engine, this.game.progress());
  }
}
