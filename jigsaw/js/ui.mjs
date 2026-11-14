// filepath: games/jigsaw/js/ui.mjs
// UI 层：唯一拥有 DOM 的模块。负责 HUD、选关、玩法、结算、提示与无障碍播报。
// 只读取 game 暴露的状态，绝不直接改 game.state；用户意图通过回调交回给 main.mjs。

import { LEVELS, LEVEL_COUNT, CHAPTERS, dailyLevel, todayKey } from "./levels.mjs";
import { scoreRun, formatTime, perfectScoreFor } from "./score.mjs";
import { artworkRecipe, renderArtwork } from "./artwork.mjs";
import * as storage from "./storage.mjs";
import { t, applyI18n, getLocale, altLabel, htmlLang } from "./i18n.mjs";

const OVERLAY_IDS = ["ov-start", "ov-win", "ov-levels", "ov-help"];
const THUMB_SIZE = 72;

function $(id) {
  return typeof document !== "undefined" ? document.getElementById(id) : null;
}

const recipeCache = new Map();

function thumbRecipe(level) {
  const key = `${level.seed}:${level.art.detail}:${level.art.contrast}`;
  if (!recipeCache.has(key)) recipeCache.set(key, artworkRecipe(level.seed, level.art));
  return recipeCache.get(key);
}

function paintThumb(canvas, level) {
  const ctx = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!ctx) return;
  renderArtwork(ctx, THUMB_SIZE, thumbRecipe(level));
}

export function createUI(overrides = {}) {
  const el = {
    level: $("hud-level"),
    moves: $("hud-moves"),
    par: $("hud-par"),
    score: $("hud-score"),
    time: $("hud-time"),
    levelName: $("level-name"),
    levelChapter: $("level-chapter"),
    levelBadge: $("level-badge"),
    levelBar: $("level-bar"),
    scoreBar: $("hud-score-bar"),
    toast: $("toast"),
    sr: $("sr-status"),
    lang: $("btn-lang"),
    sound: $("btn-sound"),
    soundOn: $("icon-sound-on"),
    soundOff: $("icon-sound-off"),
    levelsGrid: $("levels-grid"),
    levelsTotal: $("levels-total"),
    dailyLabel: $("daily-label"),
    dailyHint: $("daily-hint"),
    btnDaily: $("btn-daily"),
    btnPreview: $("btn-preview"),
    btnShuffle: $("btn-reshuffle"),
    shuffleCount: $("shuffle-count"),
    winTitle: $("win-title"),
    winNewBest: $("win-newbest"),
    winMoves: $("win-moves"),
    winPar: $("win-par"),
    winTime: $("win-time"),
    winScore: $("win-score"),
    winPerfect: $("win-perfect"),
    winBest: $("win-best"),
    btnNext: $("btn-next"),
  };

  const overlays = {};
  for (const id of OVERLAY_IDS) overlays[id] = $(id);

  let toastTimer = 0;
  let lastMoves = -1;
  let lastScore = -1;

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
      }, 1800);
    },

    sr(text) {
      if (el.sr) el.sr.textContent = text;
    },

    bump(node) {
      if (!node || !node.classList || typeof window === "undefined") return;
      node.classList.remove("bump");
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

    syncHud(game) {
      if (el.level) {
        el.level.textContent = game.isDaily
          ? t("levels.daily")
          : `${game.levelIndex + 1}/${LEVEL_COUNT}`;
      }
      if (el.par) el.par.textContent = String(game.par);
      if (el.moves) {
        el.moves.textContent = String(game.moves);
        if (lastMoves >= 0 && game.moves !== lastMoves) ui.bump(el.moves);
        lastMoves = game.moves;
      }
      ui.syncScore(game);
      ui.syncTime(game);
      ui.syncMeta(game);
      if (el.btnShuffle) {
        el.btnShuffle.disabled = game.reshufflesLeft <= 0;
        el.btnShuffle.setAttribute("data-left", String(game.reshufflesLeft));
      }
      if (el.shuffleCount) el.shuffleCount.textContent = String(game.reshufflesLeft);
    },

    syncScore(game) {
      if (!el.score) return;
      const live = scoreRun({
        moves: game.moves,
        timeMs: game.phase === "won" && game.result ? game.result.timeMs : game.timeMs,
        par: game.par,
        isDaily: game.isDaily,
      });
      const value = game.phase === "won" && game.result ? game.result.total : live.total;
      el.score.textContent = `${value}/${game.perfect}`;
      if (lastScore >= 0 && value !== lastScore) ui.bump(el.score);
      lastScore = value;
      if (el.scoreBar) {
        const pct = game.perfect > 0 ? Math.min(100, (value / game.perfect) * 100) : 0;
        el.scoreBar.style.width = `${pct.toFixed(2)}%`;
      }
    },

    syncTime(game) {
      if (el.time) el.time.textContent = formatTime(game.timeMs);
    },

    syncMeta(game) {
      if (el.levelName) {
        el.levelName.textContent = t(`level.${game.level.id}`);
      }
      if (el.levelChapter) {
        el.levelChapter.textContent = t("levels.chapter", {
          n: game.level.chapter,
          name: t(`chapter.${game.level.chapter}`),
        });
      }
      // 主线才有 "n/50" 进度；今日拼图隐藏进度条（CSS 靠 data-daily 判定）
      if (el.levelBadge) el.levelBadge.setAttribute("data-daily", game.isDaily ? "1" : "0");
      if (el.levelBar) {
        const pct = game.isDaily ? 100 : ((game.levelIndex + 1) / LEVEL_COUNT) * 100;
        el.levelBar.style.width = `${pct.toFixed(2)}%`;
      }
    },

    resetCaches() {
      lastMoves = -1;
      lastScore = -1;
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
        if (entry) cleared++;
        total += entry ? entry.bestScore : 0;
      }
      if (el.levelsTotal) {
        el.levelsTotal.textContent = t("levels.total", {
          done: cleared,
          total: LEVEL_COUNT,
          score: total,
        });
      }

      const key = todayKey();
      const daily = dailyLevel(key);
      if (el.dailyLabel) el.dailyLabel.textContent = t("levels.daily");
      if (el.dailyHint) {
        el.dailyHint.textContent = `${t("levels.dailyHint")} · ${t(`level.${daily.id}`)}`;
      }
      if (el.btnDaily) {
        const best = data.daily.dateKey === key ? data.daily.bestScore : 0;
        el.btnDaily.setAttribute("data-best", best ? String(best) : "");
        el.btnDaily.textContent = best
          ? `${t("levels.daily")} · ${best}`
          : t("levels.daily");
        el.btnDaily.setAttribute("aria-label", t("aria.daily", { name: t(`level.${daily.id}`) }));
      }

      let chapter = 0;
      LEVELS.forEach((level, index) => {
        if (level.chapter !== chapter) {
          chapter = level.chapter;
          const divider = document.createElement("p");
          divider.className = "lv-chapter";
          divider.textContent = t("levels.chapter", {
            n: chapter,
            name: t(`chapter.${chapter}`),
          });
          el.levelsGrid.appendChild(divider);
        }

        const entry = data.levels[level.id];
        const unlocked = index < data.unlocked;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "level-card";
        card.setAttribute("data-index", String(index));
        card.setAttribute("data-level", level.id);
        card.disabled = !unlocked;
        card.setAttribute(
          "data-state",
          index === game.levelIndex && !game.isDaily
            ? "current"
            : entry
              ? "cleared"
              : unlocked
                ? "open"
                : "locked"
        );
        card.setAttribute(
          "aria-label",
          unlocked
            ? t("aria.levelCard", { n: index + 1, name: t(`level.${level.id}`) })
            : t("aria.levelLocked", { n: index + 1 })
        );

        const thumb = document.createElement("canvas");
        thumb.className = "lv-thumb";
        thumb.width = THUMB_SIZE;
        thumb.height = THUMB_SIZE;
        thumb.setAttribute("aria-hidden", "true");
        if (unlocked) paintThumb(thumb, level);

        const no = document.createElement("span");
        no.className = "lv-no";
        no.textContent = String(index + 1);

        const name = document.createElement("span");
        name.className = "lv-name";
        name.textContent = unlocked ? t(`level.${level.id}`) : "—";

        const meta = document.createElement("span");
        meta.className = "lv-meta";
        meta.textContent = unlocked
          ? entry
            ? `${entry.bestScore} · ${entry.bestMoves}${t("hud.moves").slice(0, 1)}`
            : `${level.n}×${level.n} · ${t("hud.par")} ${level.par}`
          : t("levels.locked");

        card.append(thumb, no, name, meta);
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
      if (el.winTitle) el.winTitle.textContent = result.isDaily ? t("levels.daily") : t("win.title");
      if (el.winNewBest) el.winNewBest.hidden = !result.isNewBest;
      if (el.winMoves) el.winMoves.textContent = String(result.moves);
      if (el.winPar) el.winPar.textContent = String(result.par);
      if (el.winTime) el.winTime.textContent = formatTime(result.timeMs);
      if (el.winScore) el.winScore.textContent = String(result.total);
      if (el.winPerfect) el.winPerfect.textContent = String(result.perfect ?? perfectScoreFor(result.isDaily));
      if (el.winBest) {
        const saved = result.save;
        if (result.isDaily) {
          el.winBest.textContent = t("win.dailyBest", {
            score: saved?.daily?.bestScore ?? result.total,
          });
        } else {
          const entry = saved?.levels?.[result.levelId];
          el.winBest.textContent = result.isLast
            ? t("win.allClear")
            : t("win.bestLine", {
                score: entry?.bestScore ?? result.total,
                moves: entry?.bestMoves ?? result.moves,
                time: formatTime(entry?.bestTimeMs ?? result.timeMs),
              });
        }
      }
      if (el.btnNext) el.btnNext.textContent = result.isLast || result.isDaily ? t("win.replay") : t("win.next");
      ui.show("ov-win");
      ui.sr(t("sr.win", { moves: result.moves, score: result.total }));
    },

    setPreviewState(active) {
      if (!el.btnPreview) return;
      el.btnPreview.setAttribute("aria-pressed", active ? "true" : "false");
    },
  };

  return ui;
}

/** 供测试与调试：把章节表暴露出去，避免测试硬编码 */
export const CHAPTER_INFO = CHAPTERS;
