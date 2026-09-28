// filepath: games/klotski/js/ui.mjs
// UI 层：唯一拥有 DOM 的模块。负责 HUD、选关、玩法、结算、提示与无障碍播报。
// 只读取 game 暴露的状态，绝不直接改 game.state；用户意图通过回调交回给 main.mjs。

import { LEVELS, LEVEL_COUNT, difficultyOf } from "./levels.mjs";
import { formatTime, PERFECT } from "./score.mjs";
import * as storage from "./storage.mjs";
import { t, applyI18n, getLocale, altLabel, htmlLang } from "./i18n.mjs";

const OVERLAY_IDS = ["ov-start", "ov-pause", "ov-win", "ov-levels", "ov-help"];

function $(id) {
  return typeof document !== "undefined" ? document.getElementById(id) : null;
}

function starsText(count) {
  const n = Math.max(0, Math.min(3, count | 0));
  return "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);
}

export function createUI(overrides = {}) {
  const el = {
    level: $("hud-level"),
    moves: $("hud-moves"),
    par: $("hud-par"),
    time: $("hud-time"),
    levelName: $("level-name"),
    levelDiff: $("level-diff"),
    toast: $("toast"),
    sr: $("sr-status"),
    lang: $("btn-lang"),
    sound: $("btn-sound"),
    soundOn: $("icon-sound-on"),
    soundOff: $("icon-sound-off"),
    levelsGrid: $("levels-grid"),
    levelsTotal: $("levels-total"),
    winStars: $("win-stars"),
    winNewBest: $("win-newbest"),
    winMoves: $("win-moves"),
    winPar: $("win-par"),
    winTime: $("win-time"),
    winScore: $("win-score"),
    winBest: $("win-best"),
    btnNext: $("btn-next"),
    btnUndo: $("btn-undo"),
  };

  const overlays = {};
  for (const id of OVERLAY_IDS) overlays[id] = $(id);

  let toastTimer = 0;
  let lastMoves = -1;

  const ui = {
    el,
    overlays,

    /** 全量刷新文案（语言切换后调用） */
    applyText() {
      applyI18n(document);
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.lang = htmlLang(getLocale());
      }
      if (el.lang) el.lang.textContent = altLabel();
      if (el.sound) el.sound.setAttribute("aria-label", t("aria.sound"));
    },

    setSoundState(muted) {
      if (!el.sound) return;
      el.sound.setAttribute("aria-pressed", muted ? "false" : "true");
      if (el.soundOn) el.soundOn.hidden = muted;
      if (el.soundOff) el.soundOff.hidden = !muted;
    },

    // ---------- 提示 ----------

    toast(text, tone = "info") {
      if (!el.toast) return;
      el.toast.textContent = text;
      el.toast.setAttribute("data-tone", tone);
      el.toast.classList.add("show");
      if (typeof window !== "undefined" && window.clearTimeout) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        if (el.toast) el.toast.classList.remove("show");
      }, 1700);
    },

    sr(text) {
      if (el.sr) el.sr.textContent = text;
    },

    bump(node) {
      if (!node || !node.classList) return;
      node.classList.remove("bump");
      // 强制回流以重启动画
      void node.offsetWidth;
      node.classList.add("bump");
      window.setTimeout(() => node.classList.remove("bump"), 320);
    },

    // ---------- 弹层 ----------

    show(id) {
      const node = overlays[id];
      if (node) node.hidden = false;
    },

    hide(id) {
      const node = overlays[id];
      if (node) node.hidden = true;
    },

    hideAll() {
      for (const id of OVERLAY_IDS) ui.hide(id);
    },

    isOpen(id) {
      const node = overlays[id];
      return !!node && !node.hidden;
    },

    anyOpen() {
      return OVERLAY_IDS.some((id) => ui.isOpen(id));
    },

    // ---------- HUD ----------

    syncMeta(game) {
      const level = game.level;
      if (el.level) el.level.textContent = String(game.levelIndex + 1);
      if (el.par) el.par.textContent = String(level.par);
      if (el.levelName) el.levelName.textContent = t(`level.${level.id}`);
      if (el.levelDiff) {
        const diff = difficultyOf(level.par);
        el.levelDiff.textContent = t(`diff.${diff}`);
        el.levelDiff.setAttribute("data-d", diff);
      }
    },

    syncMoves(game) {
      if (!el.moves) return;
      if (game.moves !== lastMoves) {
        el.moves.textContent = String(game.moves);
        if (lastMoves >= 0) ui.bump(el.moves);
        lastMoves = game.moves;
      }
    },

    syncTime(game) {
      if (el.time) el.time.textContent = formatTime(game.timeMs);
    },

    syncHud(game) {
      ui.syncMeta(game);
      ui.syncMoves(game);
      ui.syncTime(game);
      if (el.btnUndo) el.btnUndo.disabled = !game.state.history.length;
    },

    resetMovesCache() {
      lastMoves = -1;
    },

    // ---------- 选关 ----------

    renderLevels(game) {
      if (!el.levelsGrid) return;
      const data = storage.current();
      el.levelsGrid.textContent = "";

      let cleared = 0;
      let total = 0;
      for (const level of LEVELS) {
        const entry = data.levels[level.id];
        if (entry && entry.cleared) cleared++;
        total += entry ? entry.bestScore : 0;
      }
      if (el.levelsTotal) {
        el.levelsTotal.textContent = t("levels.total", { done: cleared, total: LEVEL_COUNT, score: total });
      }

      LEVELS.forEach((level, index) => {
        const entry = data.levels[level.id];
        const unlocked = index < data.unlocked;
        const diff = difficultyOf(level.par);
        const card = document.createElement("button");
        card.type = "button";
        card.className = "level-card";
        card.setAttribute("data-index", String(index));
        card.setAttribute("data-level", level.id);
        card.disabled = !unlocked;
        card.setAttribute(
          "data-state",
          index === game.levelIndex ? "current" : entry && entry.cleared ? "cleared" : "locked"
        );
        card.setAttribute(
          "aria-label",
          unlocked
            ? t("aria.levelCard", { n: index + 1, name: t(`level.${level.id}`) })
            : t("aria.levelLocked", { n: index + 1 })
        );

        const no = document.createElement("span");
        no.className = "lv-no";
        no.textContent = String(index + 1);

        const name = document.createElement("span");
        name.className = "lv-name";
        name.textContent = unlocked ? t(`level.${level.id}`) : "—";

        const meta = document.createElement("span");
        meta.className = "lv-meta";
        meta.textContent = unlocked
          ? `${t("hud.par")} ${level.par} · ${t(`diff.${diff}`)}`
          : t("levels.locked");

        const stars = document.createElement("span");
        stars.className = "lv-stars";
        stars.textContent = entry && entry.cleared ? starsText(entry.stars) : "";

        card.append(no, name, meta, stars);
        if (typeof overrides.onPickLevel === "function") {
          card.addEventListener("click", () => overrides.onPickLevel(index, unlocked));
        }
        el.levelsGrid.appendChild(card);
      });
    },

    // ---------- 结算 ----------

    showWin(game) {
      const result = game.result;
      if (!result) return;
      const starNodes = el.winStars ? el.winStars.querySelectorAll(".star") : [];
      starNodes.forEach((node, index) => {
        node.classList.toggle("on", index < result.stars);
      });
      if (el.winNewBest) el.winNewBest.hidden = !result.isNewBest;
      if (el.winMoves) el.winMoves.textContent = String(result.moves);
      if (el.winPar) el.winPar.textContent = String(result.par);
      if (el.winTime) el.winTime.textContent = formatTime(result.timeMs);
      if (el.winScore) el.winScore.textContent = String(result.total);
      if (el.winBest) {
        el.winBest.textContent = result.isLast
          ? t("win.allClear")
          : t("win.bestLine", {
              score: Math.min(PERFECT, result.save?.levels?.[result.levelId]?.bestScore ?? result.total),
              moves: result.save?.levels?.[result.levelId]?.bestMoves ?? result.moves,
              time: formatTime(result.save?.levels?.[result.levelId]?.bestTimeMs ?? result.timeMs),
            });
      }
      if (el.btnNext) {
        el.btnNext.textContent = result.isLast ? t("win.replay") : t("win.next");
      }
      ui.show("ov-win");
      ui.sr(t("sr.win", { moves: result.moves, score: result.total }));
    },
  };

  return ui;
}
