// 渲染与交互层：唯一碰 DOM 的模块。规则合法性只问 engine，分数只读 score。
// 语言切换走全量文本热更新 + 当前帧重绘，绝不重置对局。

import {
  EMPTY, MARK_O, MARK_X, STATUS_DRAW, STATUS_PLAYING, STATUS_WON,
  isClosed, isLegal, markOf, smallOf,
} from "./engine.mjs";
import { CHAPTERS, PUZZLES, PUZZLE_BY_ID } from "./puzzles.mjs";
import { starsFor, totalStars } from "./storage.mjs";
import { format, htmlLang, strings } from "./i18n.mjs";

const BREAKDOWN_KEYS = {
  base: "rowBase",
  bigs: "rowBigs",
  efficiency: "rowEfficiency",
  streak: "rowStreak",
  total: "rowTotal",
};

const CHAPTER_KEYS = ["chapter_ch1", "chapter_ch2", "chapter_ch3", "chapter_ch4", "chapter_ch5"];

const byId = (id) => document.getElementById(id);

export function createUI(options = {}) {
  const handlers = options.handlers ?? {};
  let locale = options.locale ?? "zh";
  let t = strings(locale);
  let hovered = -1;
  let hintIndex = -1;
  let hintTimer = null;
  let toastTimer = null;
  let view = null;
  let ctx = { stats: { wins: 0, losses: 0, draws: 0 }, campaign: {}, prefs: {} };

  const refs = {
    board: byId("board"),
    radar: byId("radar"),
    turnPlate: byId("turn-plate"),
    turnMark: byId("turn-mark"),
    turnName: byId("turn-name"),
    moves: byId("moves-value"),
    boards: byId("boards-value"),
    stats: byId("stats-value"),
    status: byId("status"),
    campaignLine: byId("campaign-line"),
    wildcardTag: byId("wildcard-tag"),
    soundBtn: byId("sound-btn"),
    langBtn: byId("lang-btn"),
    helpBtn: byId("help-btn"),
    undoBtn: byId("undo-btn"),
    hintBtn: byId("hint-btn"),
    levelsBtn: byId("levels-btn"),
    restartBtn: byId("restart-btn"),
    settingsBtn: byId("settings-btn"),
    modeDuel: byId("mode-duel"),
    modeCampaign: byId("mode-campaign"),
    tierGroup: byId("tier-group"),
    pvpToggle: byId("pvp-toggle"),
    recordLine: byId("record-line"),
    clearBtn: byId("clear-btn"),
    levelsLayer: byId("levels-layer"),
    levelsGrid: byId("levels-grid"),
    levelsTotal: byId("levels-total"),
    settingsLayer: byId("settings-layer"),
    helpLayer: byId("help-layer"),
    resultLayer: byId("result-layer"),
    confirmLayer: byId("confirm-layer"),
    resultBadge: byId("result-badge"),
    resultTitle: byId("result-title"),
    resultStars: byId("result-stars"),
    resultReport: byId("result-report"),
    reportUsedLabel: byId("report-used-label"),
    reportUsed: byId("report-used"),
    reportParLabel: byId("report-par-label"),
    reportPar: byId("report-par"),
    resultBreakdown: byId("result-breakdown"),
    resultAgain: byId("result-again"),
    resultNext: byId("result-next"),
    resultClose: byId("result-close"),
    helpBody: byId("help-body"),
    helpKeys: byId("help-keys"),
    helpWildcard: byId("help-wildcard"),
    toast: byId("toast"),
  };

  buildBoard();
  buildRadar();
  bind();

  function buildBoard() {
    const fragment = document.createDocumentFragment();
    for (let big = 0; big < 9; big += 1) {
      const sector = document.createElement("div");
      sector.className = "sector";
      sector.dataset.big = String(big);
      sector.setAttribute("role", "group");
      const mini = document.createElement("div");
      mini.className = "mini";
      for (let small = 0; small < 9; small += 1) {
        const index = big * 9 + small;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.index = String(index);
        cell.setAttribute("role", "gridcell");
        const glyph = document.createElement("span");
        glyph.className = "glyph";
        cell.append(glyph);
        mini.append(cell);
      }
      const stamp = document.createElement("span");
      stamp.className = "stamp";
      stamp.setAttribute("aria-hidden", "true");
      const stampMark = document.createElement("span");
      stampMark.className = "stamp-mark";
      stamp.append(stampMark);
      sector.append(mini, stamp);
      fragment.append(sector);
    }
    refs.board.append(fragment);
  }

  function buildRadar() {
    for (let big = 0; big < 9; big += 1) {
      const cell = document.createElement("span");
      cell.className = "radar-cell";
      cell.dataset.big = String(big);
      refs.radar.append(cell);
    }
  }

  function bind() {
    refs.board.addEventListener("click", (event) => {
      const cell = event.target.closest(".cell");
      if (!cell) return;
      handlers.onCell?.(Number(cell.dataset.index));
    });
    refs.board.addEventListener("pointerover", (event) => {
      const cell = event.target.closest(".cell");
      if (cell) setHover(Number(cell.dataset.index));
    });
    refs.board.addEventListener("pointerleave", () => setHover(-1));

    refs.soundBtn.addEventListener("click", () => handlers.onSound?.());
    refs.langBtn.addEventListener("click", () => handlers.onLang?.());
    refs.helpBtn.addEventListener("click", () => openLayer("help"));
    refs.undoBtn.addEventListener("click", () => handlers.onUndo?.());
    refs.hintBtn.addEventListener("click", () => handlers.onHint?.());
    refs.levelsBtn.addEventListener("click", () => openLevels());
    refs.restartBtn.addEventListener("click", () => handlers.onRestart?.());
    refs.settingsBtn.addEventListener("click", () => openSettings());
    refs.modeDuel.addEventListener("click", () => handlers.onMode?.("duel"));
    refs.modeCampaign.addEventListener("click", () => handlers.onMode?.("campaign"));

    refs.tierGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tier]");
      if (button) handlers.onTier?.(button.dataset.tier);
    });
    refs.pvpToggle.addEventListener("change", () => handlers.onPvp?.(refs.pvpToggle.checked));
    refs.clearBtn.addEventListener("click", () => openLayer("confirm"));

    byId("levels-close").addEventListener("click", () => closeLayer("levels"));
    byId("settings-close").addEventListener("click", () => closeLayer("settings"));
    byId("help-close").addEventListener("click", () => closeLayer("help"));
    byId("confirm-yes").addEventListener("click", () => {
      handlers.onClearRecords?.();
      closeLayer("confirm");
    });
    byId("confirm-no").addEventListener("click", () => closeLayer("confirm"));

    refs.resultAgain.addEventListener("click", () => handlers.onRestart?.());
    refs.resultNext.addEventListener("click", () => handlers.onNext?.());
    refs.resultClose.addEventListener("click", () => hideResult());

    for (const layer of [refs.levelsLayer, refs.settingsLayer, refs.helpLayer, refs.resultLayer, refs.confirmLayer]) {
      layer.addEventListener("click", (event) => {
        if (event.target === layer) {
          layer.hidden = true;
          if (layer === refs.resultLayer) handlers.onResultClose?.();
        }
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        const top = [refs.confirmLayer, refs.resultLayer, refs.helpLayer, refs.settingsLayer, refs.levelsLayer]
          .find((layer) => !layer.hidden);
        if (top) {
          top.hidden = true;
          if (top === refs.resultLayer) handlers.onResultClose?.();
          else if (top === refs.settingsLayer) handlers.onSettingsClose?.();
          event.preventDefault();
        }
        return;
      }
      if (key === "z") {
        handlers.onUndo?.();
        event.preventDefault();
      } else if (key === "h") {
        handlers.onHint?.();
        event.preventDefault();
      } else if (key === "r") {
        handlers.onRestart?.();
        event.preventDefault();
      }
    });
  }

  function applyStaticTexts() {
    document.documentElement.lang = htmlLang(locale);
    document.title = t.docTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", t.metaDesc);

    for (const el of document.querySelectorAll("[data-i18n]")) {
      const key = el.getAttribute("data-i18n");
      if (typeof t[key] === "string") el.textContent = t[key];
    }
    for (const el of document.querySelectorAll("[data-i18n-aria]")) {
      const key = el.getAttribute("data-i18n-aria");
      if (typeof t[key] === "string") el.setAttribute("aria-label", t[key]);
    }

    refs.langBtn.textContent = t.langShort;
    refs.langBtn.setAttribute("aria-label", t.langLabel);
    refs.helpBody.textContent = t.helpBody;
    refs.helpKeys.textContent = t.helpKeys;
    refs.helpWildcard.textContent = t.helpWildcard;
    refs.reportUsedLabel.textContent = t.resultUsed;
    refs.reportParLabel.textContent = t.resultPar;
    refs.resultAgain.textContent = t.resultAgain;
    refs.resultNext.textContent = t.resultNext;
    refs.resultClose.textContent = t.resultClose;
    if (view) render(view, ctx);
  }

  function setLocale(next) {
    locale = next;
    t = strings(locale);
    applyStaticTexts();
    buildLevels();
    updateSettingsControls();
  }

  function setMuted(muted) {
    refs.soundBtn.setAttribute("aria-pressed", String(!muted));
    refs.soundBtn.textContent = muted ? "×" : "♪";
    refs.soundBtn.setAttribute("aria-label", muted ? t.soundOff : t.soundOn);
    refs.soundBtn.setAttribute("title", muted ? t.soundOff : t.soundOn);
  }

  function markName(mark) {
    return mark === MARK_X ? t.markX : mark === MARK_O ? t.markO : t.markEmpty;
  }

  function render(nextView, nextCtx) {
    if (!nextView) return;
    view = nextView;
    ctx = nextCtx ?? ctx;
    const state = view.state;
    const playing = state.status === STATUS_PLAYING;
    const activeSector = playing ? state.active : -2;

    for (const sector of refs.board.children) {
      const big = Number(sector.dataset.big);
      const owned = state.bigs[big];
      const closed = isClosed(state.bigs, state.cells, big);
      sector.classList.toggle("active", activeSector === big);
      sector.classList.toggle("wild", playing && activeSector === -1 && !closed);
      sector.classList.toggle("closed", closed);
      sector.classList.toggle("won", owned !== EMPTY);
      sector.classList.toggle("won-x", owned === MARK_X);
      sector.classList.toggle("won-o", owned === MARK_O);
      sector.classList.toggle("preview", hovered >= 0 && smallOf(hovered) === big);
      sector.setAttribute("aria-label", format(t.sectorAria, big + 1));
      sector.querySelector(".stamp-mark").textContent = owned === EMPTY ? "" : markOf(owned);

      const cells = sector.querySelectorAll(".cell");
      for (const cell of cells) {
        const index = Number(cell.dataset.index);
        const value = state.cells[index];
        const legal = playing && isLegal(state, index);
        const glyph = cell.querySelector(".glyph");
        const ghost = hovered === index && legal && value === EMPTY;
        cell.classList.toggle("x", value === MARK_X);
        cell.classList.toggle("o", value === MARK_O);
        cell.classList.toggle("playable", legal);
        cell.classList.toggle("last", view.lastMove === index);
        cell.classList.toggle("ghost", ghost);
        cell.classList.toggle("hint", hintIndex === index);
        cell.setAttribute("aria-disabled", String(!legal));
        glyph.textContent = value === EMPTY ? (ghost ? markOf(state.current) : "") : markOf(value);
        cell.setAttribute("aria-label", format(t.cellAria, big + 1, (index % 9) + 1, markName(value)));
      }
    }

    for (const dot of refs.radar.children) {
      const big = Number(dot.dataset.big);
      dot.classList.toggle("x", state.bigs[big] === MARK_X);
      dot.classList.toggle("o", state.bigs[big] === MARK_O);
      dot.classList.toggle("closed", isClosed(state.bigs, state.cells, big));
      dot.classList.toggle("active", activeSector === big);
      dot.classList.toggle("wild", playing && activeSector === -1);
    }

    const current = state.current;
    refs.turnPlate.dataset.side = current === MARK_X ? "x" : "o";
    refs.turnMark.textContent = view.thinking ? "…" : markOf(current);
    refs.turnName.textContent = view.thinking
      ? t.thinking
      : current === MARK_X ? t.turnX : t.turnO;

    let xBoards = 0;
    let oBoards = 0;
    for (const value of state.bigs) {
      if (value === MARK_X) xBoards += 1;
      else if (value === MARK_O) oBoards += 1;
    }
    refs.moves.textContent = String(state.moves.length);
    refs.boards.textContent = `${xBoards} : ${oBoards}`;
    refs.stats.textContent = `${ctx.stats.wins} - ${ctx.stats.losses} - ${ctx.stats.draws}`;
    refs.wildcardTag.hidden = !(playing && state.active === -1);

    let statusText;
    if (state.status === STATUS_DRAW) statusText = t.statusDraw;
    else if (state.status === STATUS_WON) statusText = state.winner === MARK_X ? t.statusWon : t.statusLost;
    else if (view.thinking && !view.humanTurn) statusText = t.statusThinking;
    else if (state.active === -1) statusText = t.statusWildcard;
    else if (view.config.pvp) statusText = format(t.statusPvpTurn, markName(current));
    else statusText = format(t.statusTurn, markName(current), state.active + 1);
    refs.status.textContent = statusText;
    refs.status.dataset.state = state.status;

    const campaign = view.config.mode === "campaign" && view.puzzle;
    refs.campaignLine.hidden = !campaign;
    if (campaign) {
      refs.campaignLine.textContent = format(
        t.statusCampaign,
        String(view.puzzle.index + 1),
        String(view.used),
        String(view.puzzle.par),
      );
    }

    refs.undoBtn.disabled = !view.canUndo;
    refs.hintBtn.disabled = !view.humanTurn || Boolean(view.config.pvp);
    refs.modeDuel.setAttribute("aria-pressed", String(view.config.mode === "duel"));
    refs.modeCampaign.setAttribute("aria-pressed", String(view.config.mode === "campaign"));
    updateSettingsControls();
  }

  function updateTierPressed() {
    for (const button of refs.tierGroup.querySelectorAll("[data-tier]")) {
      button.setAttribute("aria-pressed", String(button.dataset.tier === ctx.prefs.tier));
    }
  }

  function updateSettingsControls() {
    if (!refs.pvpToggle) return;
    refs.pvpToggle.checked = Boolean(ctx.prefs.pvp);
    updateTierPressed();
    refs.recordLine.textContent = `${ctx.stats.wins} - ${ctx.stats.losses} - ${ctx.stats.draws} · ${totalStars(ctx.campaign)}/${PUZZLES.length}★`;
  }

  function buildLevels() {
    if (!refs.levelsGrid) return;
    const fragment = document.createDocumentFragment();
    CHAPTERS.forEach((chapter, chapterIndex) => {
      const group = document.createElement("section");
      group.className = "chapter";
      const heading = document.createElement("h3");
      heading.textContent = t[CHAPTER_KEYS[chapterIndex]] ?? chapter.key;
      group.append(heading);
      const grid = document.createElement("div");
      grid.className = "chapter-grid";
      for (const puzzle of PUZZLES.filter((item) => item.chapter === chapterIndex + 1)) {
        const stars = starsFor(ctx.campaign, puzzle.id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "level-card";
        button.dataset.level = puzzle.id;
        button.setAttribute(
          "aria-label",
          `${format(t.levelName, puzzle.index + 1)} · ${format(t.parLabel, puzzle.par)} · ${format(t.starsAria, stars)}`,
        );
        const name = document.createElement("span");
        name.className = "level-name";
        name.textContent = format(t.levelName, puzzle.index + 1);
        const par = document.createElement("span");
        par.className = "level-par";
        par.textContent = format(t.parLabel, puzzle.par);
        const starLine = document.createElement("span");
        starLine.className = "level-stars";
        starLine.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
        button.append(name, par, starLine);
        button.addEventListener("click", () => {
          closeLayer("levels");
          handlers.onPickPuzzle?.(puzzle.id);
        });
        grid.append(button);
      }
      group.append(grid);
      fragment.append(group);
    });
    refs.levelsGrid.textContent = "";
    refs.levelsGrid.append(fragment);
    const earned = totalStars(ctx.campaign);
    refs.levelsTotal.textContent = format(t.levelsTotal, earned, PUZZLES.length);
  }

  function updateCtx(nextCtx) {
    ctx = nextCtx ?? ctx;
    buildLevels();
    updateSettingsControls();
  }

  function setHover(index) {
    if (hovered === index) return;
    const previous = hovered;
    hovered = index;
    if (view) {
      const state = view.state;
      if (previous >= 0) {
        const cell = refs.board.querySelector(`.cell[data-index="${previous}"]`);
        if (cell) {
          cell.classList.remove("ghost");
          const glyph = cell.querySelector(".glyph");
          const value = state.cells[previous];
          glyph.textContent = value === EMPTY ? "" : markOf(value);
        }
      }
      const sectorOfHover = previous >= 0 ? refs.board.children[smallOf(previous)] : null;
      if (sectorOfHover) sectorOfHover.classList.remove("preview");
      if (index >= 0) {
        const cell = refs.board.querySelector(`.cell[data-index="${index}"]`);
        if (cell && isLegal(state, index)) {
          cell.classList.add("ghost");
          cell.querySelector(".glyph").textContent = markOf(state.current);
          refs.board.children[smallOf(index)]?.classList.add("preview");
        }
      }
    }
  }

  function clearHover() {
    setHover(-1);
  }

  function pulse(index) {
    hintIndex = index;
    if (hintTimer !== null) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hintIndex = -1;
      hintTimer = null;
      if (view) render(view, ctx);
    }, 1800);
    if (view) render(view, ctx);
  }

  function openLayer(name) {
    const layers = {
      levels: refs.levelsLayer,
      settings: refs.settingsLayer,
      help: refs.helpLayer,
      result: refs.resultLayer,
      confirm: refs.confirmLayer,
    };
    const layer = layers[name];
    if (!layer) return;
    if (name === "levels") buildLevels();
    if (name === "settings") {
      ctx = { ...ctx, prefs: ctx.prefs };
      updateSettingsControls();
    }
    layer.hidden = false;
    const focusable = layer.querySelector("button, input");
    focusable?.focus();
  }

  function closeLayer(name) {
    const layers = {
      levels: refs.levelsLayer,
      settings: refs.settingsLayer,
      help: refs.helpLayer,
      result: refs.resultLayer,
      confirm: refs.confirmLayer,
    };
    const layer = layers[name];
    if (layer) layer.hidden = true;
    if (name === "settings") handlers.onSettingsClose?.();
  }

  function openLevels() {
    buildLevels();
    openLayer("levels");
  }

  function openSettings() {
    updateSettingsControls();
    openLayer("settings");
  }

  function showResult(payload) {
    const { kind, outcome, stars, used, par, rows, winner, canNext } = payload;
    refs.resultBadge.textContent = t.resultBadge;
    refs.resultStars.hidden = true;
    refs.resultReport.hidden = true;
    refs.resultBreakdown.hidden = false;
    refs.resultNext.hidden = true;
    refs.resultAgain.textContent = t.resultAgain;

    if (kind === "campaign") {
      const won = stars > 0;
      refs.resultTitle.textContent = won ? t.resultCampaignWin : t.resultCampaignFail;
      refs.resultStars.hidden = false;
      refs.resultStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
      refs.resultStars.setAttribute("aria-label", format(t.starsAria, stars));
      refs.resultReport.hidden = false;
      refs.reportUsed.textContent = String(used);
      refs.reportPar.textContent = String(par);
      refs.resultBreakdown.hidden = true;
      refs.resultNext.hidden = !(won && canNext);
    } else {
      if (winner === MARK_X) refs.resultTitle.textContent = t.resultWinX;
      else if (winner === MARK_O) refs.resultTitle.textContent = t.resultWinO;
      else refs.resultTitle.textContent = t.resultDraw;
      if (outcome === null) {
        refs.resultBadge.textContent = t.resultPvpNote;
        refs.resultBreakdown.hidden = true;
      } else {
        fillBreakdown(rows ?? []);
      }
    }

    refs.resultLayer.hidden = false;
    refs.resultAgain.focus();
  }

  function fillBreakdown(rows) {
    refs.resultBreakdown.textContent = "";
    for (const row of rows) {
      const line = document.createElement("div");
      line.className = "breakdown-row" + (row.key === "total" ? " total" : "");
      const name = document.createElement("span");
      name.textContent = t[BREAKDOWN_KEYS[row.key]] ?? row.key;
      const value = document.createElement("b");
      value.textContent = (row.key === "total" ? "" : "+") + row.value;
      line.append(name, value);
      refs.resultBreakdown.append(line);
    }
  }

  function hideResult() {
    refs.resultLayer.hidden = true;
    handlers.onResultClose?.();
  }

  function toast(text) {
    refs.toast.textContent = text;
    refs.toast.hidden = false;
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      refs.toast.hidden = true;
      toastTimer = null;
    }, 2200);
  }

  applyStaticTexts();
  setMuted(Boolean(options.muted));
  buildLevels();

  return {
    render,
    setLocale,
    setMuted,
    setHover,
    clearHover,
    pulse,
    toast,
    openLevels,
    openSettings,
    closeLayer,
    showResult,
    hideResult,
    updateCtx,
    buildLevels,
    getLocale: () => locale,
    t: () => t,
  };
}
