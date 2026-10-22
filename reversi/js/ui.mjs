// 渲染与交互层：全项目唯一碰 DOM 的模块。
//
// 铁律：
//   · 只读 snapshot、只写 DOM；绝不自己造 action、绝不改存档。
//   · 所有展示文案经 i18n 查表，本文件零裸写中文（check-game 的 i18n-clean 会扫这里）。
//   · 语言切换是全量热更新，绝不 location.reload，也不许动游戏状态。
//   · 一次性反馈类（得角闪光 / 踩陷阱闪光 / 横梁抖动）**谁加谁收**：
//     全部经 record() 登记定时器，由同一个出口清掉。同步函数绝不顺手清理。
//   · 翻转波次的视觉延迟与音效延迟共用 FLIP_STEP_MS 一个常量：
//     视觉走这里登记的主线程定时器，音效走音频时钟（audio.flip 内部自带延迟）。

import {
  FLIP_MS, CLS, createBoard, paintBoard, paintMarks, setDisc, flashCell,
  clearFlash, paintScale, paintGraph, beamAngle, beamSign,
} from "./render.mjs";
import { cascadeDelayMs } from "./audio.mjs";
import {
  BLACK, WHITE, EMPTY, STATUS_PLAYING, SIZE, CELL_COUNT,
  flipLines, cellName, squareKind,
} from "./engine.mjs";
import { strings, format, htmlLang, chapterTitleKey, chapterDescKey } from "./i18n.mjs";
import { CHAPTERS, PUZZLES, chapterPuzzles } from "./puzzles.mjs";
import {
  OUTCOME_WIN, OUTCOME_LOSS, OUTCOME_DRAW, CHAPTER_UNLOCK_NEED, PUZZLE_STARS_MAX,
  recordStars, solvedCount, starTotal, chapterCleared, allStarred,
} from "./score.mjs";
import { MODES } from "./storage.mjs";

export const LAYERS = Object.freeze(["settings", "result", "help", "levels", "confirm"]);

const STAR_ON = "\u2605";
const STAR_OFF = "\u2606";

export function createUI(options) {
  const doc = options.doc ?? globalThis.document;
  const audio = options.audio;
  const handlers = options.handlers ?? {};
  const page = doc.getElementById("game-app") ?? doc;

  let locale = options.locale ?? "zh";
  let view = null;
  let ctx = { records: null, showMobility: true };
  let currentLayer = null;
  let settingsReturn = null;
  let resultShown = false;
  let lastLean = null;
  let animating = 0;

  // ── 元素索引（一次查齐；桩环境只认单一简单选择器，所以逐个查）──────
  const q = (id) => doc.getElementById(id);
  const els = {
    langBtn: q("lang-btn"),
    soundBtn: q("sound-btn"),
    status: q("status"),
    beam: q("beam"),
    blackCount: q("black-count"),
    whiteCount: q("white-count"),
    movePlate: q("move-plate"),
    turnPlate: q("turn-plate"),
    tierPlate: q("tier-plate"),
    rushPlate: q("rush-plate"),
    forecastPlate: q("forecast-plate"),
    graph: q("graph"),
    helpText: q("help-text"),
    toast: q("toast"),
    board: q("board"),
    undoBtn: q("undo-btn"),
    hintBtn: q("hint-btn"),
    levelsBtn: q("levels-btn"),
    resignBtn: q("resign-btn"),
    recordLine: q("record-line"),
    levelsTotal: q("levels-total"),
    levelsGrid: q("levels-grid"),
    volumeRange: q("volume-range"),
    pvpToggle: q("pvp-toggle"),
    blitzToggle: q("blitz-toggle"),
    classicToggle: q("classic-toggle"),
    mobilityToggle: q("mobility-toggle"),
    resultBadge: q("result-badge"),
    resultTitle: q("result-title"),
    resultScore: q("result-score"),
    resultStars: q("result-stars"),
    resultReport: q("result-report"),
    reportMoves: q("report-moves"),
    reportMaxflip: q("report-maxflip"),
    reportSwing: q("report-swing"),
    reportNote: q("report-note"),
    resultNext: q("result-next"),
  };

  const layerEls = {};
  for (const name of LAYERS) layerEls[name] = q(`${name}-layer`);

  const cells = createBoard(els.board, (index) => squareKind(index));

  // ── 定时器唯一出口 ────────────────────────────────────────────────
  const timers = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, Math.max(0, ms));
    timers.add(id);
    return id;
  }
  function cancelAll() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  // 一次性反馈类的收尾登记表：同一格上有新反馈时先撤旧的，避免类叠加
  const flashTimers = new WeakMap();
  function flashOnce(cell, kind, ms) {
    if (!cell) return;
    const prev = flashTimers.get(cell);
    if (prev) clearTimeout(prev);
    flashCell(cell, kind);
    const id = later(() => {
      clearFlash(cell);
      flashTimers.delete(cell);
    }, ms);
    flashTimers.set(cell, id);
  }

  function mql(query) {
    try {
      return doc.defaultView?.matchMedia?.(query) ?? null;
    } catch (error) {
      return null;
    }
  }
  const reducedQuery = mql("(prefers-reduced-motion: reduce)");
  const coarseQuery = mql("(hover: none) and (pointer: coarse)");
  const isReduced = () => Boolean(reducedQuery?.matches);
  // 触屏（含触屏笔记本的触控模式）要二次点按确认；混合设备用运行时 pointerType 兜底。
  const wantsConfirm = (pointerType) => pointerType === "touch" || pointerType === "pen" || Boolean(coarseQuery?.matches);

  // ── i18n ─────────────────────────────────────────────────────────
  function t(key) {
    const table = strings(locale);
    return table[key] ?? key;
  }
  function tf(key, vars) {
    return format(t(key), vars);
  }
  function discName(player) {
    return t(player === WHITE ? "disc_white" : "disc_black");
  }
  function sideName(player) {
    return t(player === WHITE ? "res_whiteWins" : "res_blackWins");
  }
  function coord(index) {
    return cellName(index);
  }

  function applyText() {
    doc.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      const text = strings(locale)[key];
      if (text !== undefined) el.textContent = text;
    });
    doc.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.dataset.i18nAria;
      const text = strings(locale)[key];
      if (text !== undefined) el.setAttribute("aria-label", text);
    });
    doc.documentElement.lang = htmlLang(locale);
    doc.title = t("docTitle");
    if (els.langBtn) els.langBtn.textContent = t("langShort");
    if (els.helpText) els.helpText.textContent = t("rulesText");
    for (let i = 0; i < cells.length; i += 1) {
      const row = Math.floor(i / SIZE) + 1;
      const col = (i % SIZE) + 1;
      cells[i].setAttribute("aria-label", tf("ariaCell", { r: row, c: col }));
    }
  }

  // ── 弹层 ─────────────────────────────────────────────────────────
  function openLayer(name) {
    if (name === "settings") settingsReturn = currentLayer;
    for (const key of LAYERS) {
      const el = layerEls[key];
      if (el) el.hidden = key !== name;
    }
    currentLayer = name;
  }
  function closeLayers() {
    const back = currentLayer === "settings" ? settingsReturn : null;
    if (back) {
      openLayer(back);
      return;
    }
    for (const key of LAYERS) {
      const el = layerEls[key];
      if (el) el.hidden = true;
    }
    settingsReturn = null;
    currentLayer = null;
  }
  function isOpen(name) {
    return currentLayer === name;
  }

  function toast(text, ms = 1900) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.hidden = false;
    later(() => {
      els.toast.hidden = true;
    }, ms);
  }

  // ── 棋盘绘制 ─────────────────────────────────────────────────────
  function humanTurn() {
    if (!view || view.over || view.status !== STATUS_PLAYING) return false;
    if (view.pvp) return true;
    return view.current === view.human;
  }

  function paintMobility() {
    const marks = {
      legal: humanTurn() ? view.legal : [],
      threat: ctx.showMobility && view.status === STATUS_PLAYING ? view.threat : [],
      preview: previewSet,
      hint: peekHint >= 0 ? peekHint : view.hint,
    };
    paintMarks(cells, marks);
  }

  let previewSet = new Set();
  let peekHint = -1; // 终局预报点按后高亮的那一手（与"提示"互不覆盖）
  let cursor = -1; // 键盘准星
  let generation = 0; // 换局代次：让挂起的动画收尾不会污染新一局

  function setPreview(index) {
    if (!view || !humanTurn()) return clearPreview();
    if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) return clearPreview();
    if (!view.legal.includes(index)) return clearPreview();
    previewSet = new Set(flipLines(view.board, index, view.current).flat());
    paintMobility();
  }
  function clearPreview() {
    if (previewSet.size === 0) return;
    previewSet = new Set();
    paintMobility();
  }
  // 终局预报：点按后把最优首手钉在盘面上（-1 = 撤下）
  function peek(index) {
    peekHint = Number.isInteger(index) && index >= 0 ? index : -1;
    if (peekHint >= 0) previewSet = new Set(flipLines(view.board, peekHint, view.current).flat());
    paintMobility();
  }

  function paintBeam() {
    const black = view.report ? view.report.black : countOnBoard(BLACK);
    const white = view.report ? view.report.white : countOnBoard(WHITE);
    const angle = beamAngle(black, white);
    if (els.beam) els.beam.style.setProperty("--beam-deg", `${round2(angle)}deg`);
    const forecast = view.forecast
      ? {
        text: view.forecast.side === EMPTY
          ? t("forecastDraw")
          : tf("forecastReady", { side: discName(view.forecast.side), n: view.forecast.lead }),
      }
      : null;
    paintScale(
      {
        beam: els.beam,
        blackDigit: els.blackCount,
        whiteDigit: els.whiteCount,
        movePlate: els.movePlate,
        forecastPlate: els.forecastPlate,
      },
      {
        black,
        white,
        moveText: tf("moveNo", { n: view.moveCount }),
        forecast,
      },
    );

    const sign = beamSign(black, white);
    if (lastLean !== null && sign !== lastLean) {
      // 跨越中点：横梁抖一下 + 一记黄铜音（归位是"叮"，彻底倾覆追加低音下潜）
      if (els.beam) {
        els.beam.classList.add("is-bump");
        later(() => els.beam?.classList.remove("is-bump"), 460);
      }
      if (audio) {
        if (sign === 0) audio.balance();
        else audio.tilt();
      }
    }
    lastLean = sign;
  }

  function countOnBoard(player) {
    let n = 0;
    for (const cell of view.board) if (cell === player) n += 1;
    return n;
  }

  function paintTags() {
    if (els.turnPlate) {
      els.turnPlate.textContent = view.status === STATUS_PLAYING
        ? discName(view.current)
        : t("st_end");
    }
    if (els.tierPlate) {
      els.tierPlate.textContent = view.pvp ? t("pvpLabel") : t(`ai_${view.tier}`);
      els.tierPlate.hidden = view.mode === MODES.PUZZLE;
    }
    if (els.rushPlate) {
      const rush = view.rush;
      els.rushPlate.hidden = !rush || view.mode !== MODES.RUSH;
      if (rush) {
        els.rushPlate.textContent = [
          `${t("stat_score")} ${Math.round(rush.score)}`,
          `${t("stat_combo")} ${rush.combo} x${round2(rush.multiplier)}`,
          `${t("stat_time")} ${Math.ceil(rush.timeLeftMs / 1000)}s`,
        ].join("  ·  ");
      }
    }
  }

  function paintStatus() {
    if (!els.status) return;
    if (view.over) {
      if (view.mode === MODES.PUZZLE) {
        els.status.textContent = view.puzzle && view.puzzle.status === "solved" ? t("pz_solved") : t("st_end");
        return;
      }
      if (view.mode === MODES.RUSH) {
        els.status.textContent = tf("rush_timeUp", { n: Math.round(view.rush?.score ?? 0) });
        return;
      }
      const winner = view.report?.winner ?? EMPTY;
      els.status.textContent = winner === EMPTY ? t("st_draw") : tf("st_p2Turn", { side: sideName(winner) });
      return;
    }
    if (view.thinking) {
      els.status.textContent = t("st_thinking");
      return;
    }
    if (view.pvp) {
      els.status.textContent = tf("st_p2Turn", { side: discName(view.current) });
      return;
    }
    els.status.textContent = `${humanTurn() ? t("st_yourTurn") : t("st_aiTurn")} · ${discName(view.current)}`;
  }

  function paintButtons() {
    const spend = view.spend ?? {};
    const canUndo = view.mode === MODES.PLAY && !view.over && view.moveCount > 0 && (spend.undo ?? 0) > 0;
    const canHint = !view.over && spend.hint !== 0 && (spend.hint === null || spend.hint > 0);
    if (els.undoBtn) {
      els.undoBtn.disabled = !canUndo;
      els.undoBtn.textContent = spend.undo === null
        ? t("undo")
        : tf("undoLeft", { n: spend.undo ?? 0, total: spend.undoLimit ?? 0 });
    }
    if (els.hintBtn) {
      els.hintBtn.disabled = !canHint;
      els.hintBtn.textContent = spend.hint === null
        ? t("hint")
        : tf("hintLeft", { n: spend.hint ?? 0, total: spend.hintLimit ?? 0 });
    }
    if (els.levelsBtn) {
      els.levelsBtn.hidden = view.mode !== MODES.PUZZLE;
    }
    if (els.resignBtn) {
      els.resignBtn.disabled = view.mode !== MODES.PLAY || view.over || view.pvp;
    }
    if (els.forecastPlate) {
      els.forecastPlate.disabled = !view.forecast;
    }
  }

  function paintSettingsPanel() {
    const prefs = ctx.prefs;
    for (const button of doc.querySelectorAll("#tier-group .seg")) {
      button.setAttribute("aria-pressed", String(button.dataset.tier === view.tier));
    }
    for (const button of doc.querySelectorAll("#side-group .seg")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.side) === view.human));
    }
    for (const button of doc.querySelectorAll("#opening-group .seg")) {
      button.setAttribute("aria-pressed", String(button.dataset.opening === view.opening));
    }
    for (const button of doc.querySelectorAll("#mode-group .seg")) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === view.mode));
    }
    if (prefs) {
      if (els.pvpToggle) els.pvpToggle.checked = Boolean(prefs.pvp);
      if (els.blitzToggle) els.blitzToggle.checked = view.blitz;
      if (els.classicToggle) els.classicToggle.checked = Boolean(prefs.classic);
      if (els.mobilityToggle) els.mobilityToggle.checked = ctx.showMobility;
    }
    if (els.recordLine && ctx.records) {
      const puzzleRecords = ctx.records.puzzle ?? {};
      const bucket = ctx.records.vs?.[view.tier] ?? { w: 0, d: 0, l: 0 };
      const highlights = ctx.records.highlights ?? { maxFlip: 0, bestSwing: 0 };
      const rush = ctx.records.rush ?? { bestScore: 0, bestCombo: 0 };
      const ids = PUZZLES.map((puzzle) => puzzle.id);
      els.recordLine.textContent = [
        `${t(`ai_${view.tier}`)} ${tf("recordLine", { w: bucket.w, d: bucket.d, l: bucket.l })}`,
        `${t("stat_maxflip")} ${highlights.maxFlip}`,
        `${t("stat_swing")} ${highlights.bestSwing}`,
        tf("pz_starTotal", { n: starTotal(puzzleRecords, ids), total: ids.length * PUZZLE_STARS_MAX }),
        tf("rush_best", { n: rush.bestScore }),
      ].join("  ·  ");
    }
    if (els.volumeRange && audio && !els.volumeRange.dataset.bound) {
      els.volumeRange.dataset.bound = "1";
      els.volumeRange.value = String(Math.round(audio.getVolume() * 100));
    }
    if (els.soundBtn) els.soundBtn.setAttribute("aria-pressed", String(!(audio && audio.isMuted())));
  }

  function paintBoardIfIdle() {
    if (animating > 0) return; // 波次翻转正在播：绝不整体重绘，否则动画瞬间跳到终态
    paintBoard(cells, view.board, { lastMove: view.lastMove });
    paintMobility();
  }

  // ── 对外渲染 ─────────────────────────────────────────────────────
  function render(nextView, nextCtx = {}) {
    if (!nextView) return;
    view = nextView;
    ctx = { ...ctx, ...nextCtx };
    paintBoardIfIdle();
    paintBeam();
    if (els.graph) paintGraph(els.graph, view.graph);
    paintTags();
    paintStatus();
    paintButtons();
    paintSettingsPanel();
    if (view.over && !resultShown) showResult();
  }

  // 计时推进只刷新会跳动的读数，不重建棋盘（避免每 200ms 一次无谓 DOM 写）
  function paintClock(nextView) {
    view = nextView;
    paintTags();
  }

  // ── 动画与音效：事件流的唯一消费者 ────────────────────────────────
  async function animate(events) {
    const jobs = [];
    for (const event of events) collect(event, jobs);
    if (jobs.length === 0) return;
    const gen = generation;
    animating += 1;
    const span = jobs.reduce((max, job) => Math.max(max, job.at), 0) + Math.round(FLIP_MS * 0.6);
    // ★ 每个 job 都要真正排进定时器。只算 span 而不注册 run，动画就永远不会发生
    //   —— 盘面会在下一次 render 时"瞬移"到终态，波次翻转整个消失（这是实测踩到的坑）。
    for (const job of jobs) later(job.run, job.at);
    await new Promise((resolve) => later(resolve, span));
    if (gen === generation) animating -= 1;
  }

  function collect(event, jobs) {
    if (!event || typeof event !== "object") return;
    switch (event.type) {
      case "moved": {
        // 落子声与翻转琶音同时排程：翻转的第 k 枚由音频时钟自己延后 (k−1)×45ms，
        // 因此这里必须**一次把所有 k 都交给音频**，绝不能用 setTimeout 排队（主线程抖动会打散琶音）。
        if (audio) {
          audio.place();
          for (let k = 1; k <= (event.flips?.length ?? 0); k += 1) audio.flip(k);
        }
        const owner = event.player;
        // 落点必须立刻落定：动画期间不整体重绘，若这里也不画，落子会一直等到下一帧才出现。
        jobs.push({ at: 0, run: () => setDisc(cells[event.index], owner) });
        const flat = event.flips ?? [];
        for (let i = 0; i < flat.length; i += 1) {
          const cell = cells[flat[i]];
          // 视觉延迟与音频延迟共用 FLIP_STEP_MS 同一个常量
          jobs.push({
            at: isReduced() ? 0 : cascadeDelayMs(i + 1),
            run: () => setDisc(cell, owner),
          });
        }
        break;
      }
      case "corner":
        flashOnce(cells[event.index], "corner", 950);
        if (audio) audio.corner();
        break;
      case "trap":
        flashOnce(cells[event.index], "trap", 900);
        if (audio) audio.trap();
        break;
      case "hint":
        if (audio) audio.hint();
        break;
      case "pass":
        toast(event.player === view?.human ? t("st_youPass") : t("st_opponentPass"));
        if (audio) audio.passTurn();
        break;
      case "forecast":
        if (audio) audio.press();
        break;
      case "puzzle":
        if (event.phase === "wrong") {
          toast(tf("pz_wrong", { n: Math.round(event.value ?? 0) }));
          if (audio) audio.trap();
        }
        break;
      case "rush":
        if (event.phase === "broken") {
          toast(t("rush_broken"), 1200);
          if (audio) audio.comboBreak();
        }
        break;
      default:
        break;
    }
  }

  // ── 结算 ─────────────────────────────────────────────────────────
  function showResult() {
    resultShown = true;
    const report = view.report ?? {};
    if (els.resultStars) els.resultStars.hidden = true;
    if (els.resultReport) els.resultReport.hidden = true;
    if (els.reportNote) els.reportNote.hidden = true;
    if (els.resultNext) els.resultNext.hidden = true;

    if (view.mode === MODES.PUZZLE) {
      showPuzzleResult();
    } else if (view.mode === MODES.RUSH) {
      showRushResult();
    } else {
      showPlayResult(report);
    }
    openLayer("result");
  }

  function showPlayResult(report) {
    const outcome = report.winner === EMPTY
      ? OUTCOME_DRAW
      : report.winner === view.human ? OUTCOME_WIN : OUTCOME_LOSS;
    const resigned = Boolean(report.resigned);
    if (els.resultBadge) els.resultBadge.textContent = outcome === OUTCOME_WIN ? "\u25C6" : outcome === OUTCOME_DRAW ? "\u25C7" : "\u25C6";
    if (els.resultTitle) {
      els.resultTitle.textContent = resigned
        ? t("res_lose")
        : outcome === OUTCOME_WIN ? t("res_win") : outcome === OUTCOME_DRAW ? t("res_draw") : t("res_lose");
    }
    if (els.resultScore) {
      els.resultScore.textContent = tf("res_yourScore", { b: report.black ?? 0, w: report.white ?? 0 });
    }
    if (els.resultReport) {
      els.resultReport.hidden = false;
      if (els.reportMoves) els.reportMoves.textContent = String(report.moves ?? view.moveCount);
      if (els.reportMaxflip) els.reportMaxflip.textContent = describeMove(report.maxFlip, "flips");
      if (els.reportSwing) els.reportSwing.textContent = describeMove(report.swing, "swing");
    }
    if (els.reportNote) {
      els.reportNote.hidden = !report.perfect;
      els.reportNote.textContent = report.perfect ? t("res_perfect") : "";
    }
    if (audio) {
      audio.settle(outcome === OUTCOME_WIN);
      if (report.perfect) audio.perfect();
    }
  }

  function describeMove(entry, field) {
    if (!entry) return t("res_none");
    const value = field === "flips" ? entry.flips : entry.swing;
    return `${tf("moveNo", { n: entry.moveNo })} · ${coord(entry.index)} · ${value}`;
  }

  function showPuzzleResult() {
    const puzzle = view.puzzle ?? {};
    const stars = puzzle.stars ?? 0;
    const solved = puzzle.status === "solved";
    if (els.resultBadge) els.resultBadge.textContent = solved ? STAR_ON + STAR_ON + STAR_ON : STAR_OFF;
    if (els.resultTitle) els.resultTitle.textContent = solved ? t("pz_solved") : t("st_end");
    if (els.resultStars) {
      els.resultStars.hidden = !solved;
      els.resultStars.textContent = STAR_ON.repeat(stars) + STAR_OFF.repeat(PUZZLE_STARS_MAX - stars);
    }
    if (els.resultScore) {
      els.resultScore.textContent = tf("pz_target", { n: puzzle.target ?? 0 });
    }
    if (els.resultReport) {
      els.resultReport.hidden = false;
      if (els.reportMoves) els.reportMoves.textContent = String(view.moveCount);
      if (els.reportMaxflip) els.reportMaxflip.textContent = describeMove(view.report?.maxFlip, "flips");
      if (els.reportSwing) els.reportSwing.textContent = describeMove(view.report?.swing, "swing");
    }
    if (els.reportNote) {
      els.reportNote.hidden = false;
      els.reportNote.textContent = t("pz_hintFree");
    }
    const next = nextPuzzleId(puzzle.id);
    if (els.resultNext) {
      els.resultNext.hidden = !next;
      els.resultNext.dataset.puzzle = next ?? "";
    }
    if (audio) audio.settle(solved);
  }

  function showRushResult() {
    const rush = view.rush ?? {};
    if (els.resultBadge) els.resultBadge.textContent = "\u23F1";
    if (els.resultTitle) els.resultTitle.textContent = t("rush_over");
    if (els.resultScore) els.resultScore.textContent = tf("rush_timeUp", { n: Math.round(rush.score ?? 0) });
    if (els.resultStars) {
      els.resultStars.hidden = false;
      els.resultStars.textContent = `${t("stat_combo")} ${rush.combo ?? 0}`;
    }
    if (els.resultReport) {
      els.resultReport.hidden = true;
    }
    if (els.reportNote) {
      els.reportNote.hidden = false;
      const best = ctx.records?.rush?.bestScore ?? 0;
      els.reportNote.textContent = (rush.score ?? 0) >= best && (rush.score ?? 0) > 0
        ? t("rush_newRecord")
        : tf("rush_best", { n: Math.max(best, Math.round(rush.score ?? 0)) });
    }
    if (audio) audio.settle(true);
  }

  function nextPuzzleId(id) {
    if (!id) return null;
    const index = PUZZLES.findIndex((puzzle) => puzzle.id === id);
    if (index < 0 || index + 1 >= PUZZLES.length) return null;
    return PUZZLES[index + 1].id;
  }

  // ── 选关面板 ─────────────────────────────────────────────────────
  // ★ 计分层的 recordStars / solvedCount / chapterCleared / allStarred 吃的都是
  //   "题目 id → 记录" 这一个子表（records.puzzle），不是整个 records。
  //   传错一层会导致所有题目永远显示 0 星、章节永远不解锁。
  function buildLevels(records) {
    if (!els.levelsGrid) return;
    const puzzleRecords = records?.puzzle ?? {};
    const allIds = PUZZLES.map((puzzle) => puzzle.id);
    if (els.levelsTotal) {
      els.levelsTotal.textContent = allStarred(puzzleRecords, allIds)
        ? t("pz_allDone")
        : tf("pz_starTotal", { n: starTotal(puzzleRecords, allIds), total: allIds.length * PUZZLE_STARS_MAX });
    }
    els.levelsGrid.textContent = "";
    let open = true;
    for (const chapter of CHAPTERS) {
      const list = chapterPuzzles(chapter.number);
      const ids = list.map((puzzle) => puzzle.id);
      const done = solvedCount(puzzleRecords, ids);

      const block = doc.createElement("div");
      block.className = "chapter-block";

      const head = doc.createElement("div");
      head.className = "chapter-head";
      const name = doc.createElement("span");
      name.className = "chapter-name";
      name.textContent = `${chapter.number}. ${t(chapterTitleKey(chapter.key))}`;
      const progress = doc.createElement("span");
      progress.className = "chapter-progress";
      progress.textContent = tf("pz_progress", { c: chapter.number, done, total: ids.length });
      head.appendChild(name);
      head.appendChild(progress);
      block.appendChild(head);

      const desc = doc.createElement("p");
      desc.className = "chapter-desc";
      desc.textContent = open ? t(chapterDescKey(chapter.key)) : tf("pz_locked", { n: CHAPTER_UNLOCK_NEED });
      block.appendChild(desc);

      const row = doc.createElement("div");
      row.className = "cells-row";
      list.forEach((puzzle, index) => {
        const stars = recordStars(puzzleRecords, puzzle.id);
        const button = doc.createElement("button");
        button.setAttribute("type", "button");
        button.className = `level-cell${stars > 0 ? " is-solved" : ""}${open ? "" : " is-locked"}`;
        button.dataset.puzzle = puzzle.id;
        button.disabled = !open;
        const id = doc.createElement("span");
        id.className = "lv-id";
        id.textContent = String(index + 1).padStart(2, "0");
        const mark = doc.createElement("span");
        mark.className = "lv-stars";
        mark.textContent = STAR_ON.repeat(stars) + STAR_OFF.repeat(PUZZLE_STARS_MAX - stars);
        button.appendChild(id);
        button.appendChild(mark);
        button.addEventListener("click", () => handlers.onPickPuzzle?.(puzzle.id));
        row.appendChild(button);
      });
      block.appendChild(row);
      els.levelsGrid.appendChild(block);

      if (open) open = chapterCleared(puzzleRecords, ids);
    }
  }

  // ── 事件绑定（DOM 交互全部收在这一处）────────────────────────────
  function bind() {
    els.board.addEventListener("click", (event) => {
      const cell = event.target?.closest?.(".cell") ?? event.target;
      if (!cell || celluleIndex(cell) < 0) return;
      const index = celluleIndex(cell);
      handlers.onCell?.(index, "mouse");
    });

    els.board.addEventListener("pointerover", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      const index = celluleIndex(event.target);
      if (index >= 0) setPreview(index);
    });
    els.board.addEventListener("pointerleave", () => clearPreview());

    els.board.addEventListener("contextmenu", (event) => event.preventDefault());

    for (const button of doc.querySelectorAll("#mode-group .seg")) {
      button.addEventListener("click", () => handlers.onMode?.(button.dataset.mode));
    }
    for (const button of doc.querySelectorAll("#tier-group .seg")) {
      button.addEventListener("click", () => handlers.onPref?.("tier", button.dataset.tier));
    }
    for (const button of doc.querySelectorAll("#side-group .seg")) {
      button.addEventListener("click", () => handlers.onPref?.("side", Number(button.dataset.side)));
    }
    for (const button of doc.querySelectorAll("#opening-group .seg")) {
      button.addEventListener("click", () => handlers.onPref?.("opening", button.dataset.opening));
    }

    els.undoBtn?.addEventListener("click", () => handlers.onUndo?.());
    els.hintBtn?.addEventListener("click", () => handlers.onHint?.());
    els.resignBtn?.addEventListener("click", () => handlers.onResign?.());
    q("restart-btn")?.addEventListener("click", () => handlers.onRestart?.());
    els.levelsBtn?.addEventListener("click", () => handlers.onLevels?.());
    q("settings-btn")?.addEventListener("click", () => openLayer("settings"));
    q("settings-close")?.addEventListener("click", () => closeLayers());
    q("help-btn")?.addEventListener("click", () => openLayer("help"));
    q("help-close")?.addEventListener("click", () => closeLayers());
    q("levels-close")?.addEventListener("click", () => closeLayers());
    q("result-close")?.addEventListener("click", () => closeLayers());
    q("result-again")?.addEventListener("click", () => handlers.onRestart?.());
    els.resultNext?.addEventListener("click", () => handlers.onPickPuzzle?.(els.resultNext.dataset.puzzle));
    els.forecastPlate?.addEventListener("click", () => handlers.onForecast?.());

    q("clear-btn")?.addEventListener("click", () => openLayer("confirm"));
    q("confirm-no")?.addEventListener("click", () => closeLayers());
    q("confirm-yes")?.addEventListener("click", () => {
      handlers.onClearRecords?.();
      closeLayers();
    });

    els.soundBtn?.addEventListener("click", () => handlers.onToggleSound?.());
    els.langBtn?.addEventListener("click", () => handlers.onToggleLang?.());
    els.volumeRange?.addEventListener("input", () => handlers.onVolume?.(Number(els.volumeRange.value) / 100));
    els.pvpToggle?.addEventListener("change", () => handlers.onPref?.("pvp", els.pvpToggle.checked));
    els.blitzToggle?.addEventListener("change", () => handlers.onPref?.("blitz", els.blitzToggle.checked));
    els.classicToggle?.addEventListener("change", () => handlers.onPref?.("classic", els.classicToggle.checked));
    els.mobilityToggle?.addEventListener("change", () => handlers.onPref?.("showMobility", els.mobilityToggle.checked));

    doc.addEventListener("keydown", onKeyDown);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      if (currentLayer) closeLayers();
      else clearPreview();
      return;
    }
    if (currentLayer) return;
    const key = event.key.toLowerCase();
    if (key === "u" || key === "z") {
      event.preventDefault();
      handlers.onUndo?.();
      return;
    }
    if (key === "h") {
      event.preventDefault();
      handlers.onHint?.();
      return;
    }
    if (key === "r") {
      event.preventDefault();
      handlers.onRestart?.();
      return;
    }
    if (key === "m") {
      event.preventDefault();
      handlers.onToggleSound?.();
      return;
    }
    const step = { arrowup: -SIZE, w: -SIZE, arrowdown: SIZE, s: SIZE, arrowleft: -1, a: -1, arrowright: 1, d: 1 }[key];
    if (step !== undefined) {
      event.preventDefault();
      const from = cursor >= 0 ? cursor : firstLegal();
      const to = clampStep(from, step);
      cursor = to;
      handlers.onArm?.(to);
      focusCell(to);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const index = cursor >= 0 ? cursor : firstLegal();
      if (index >= 0) handlers.onCell?.(index, "keyboard");
    }
  }

  function firstLegal() {
    if (view?.legal?.length) return view.legal[0];
    return 0;
  }

  function clampStep(from, step) {
    const size = SIZE;
    if (step === -1 && from % size === 0) return from;
    if (step === 1 && from % size === size - 1) return from;
    const next = from + step;
    if (next < 0 || next >= CELL_COUNT) return from;
    return next;
  }

  function focusCell(index) {
    const cell = cells[index];
    if (cell && typeof cell.focus === "function" && !coarseQuery?.matches) cell.focus();
  }

  function celluleIndex(node) {
    let el = node;
    let guard = 0;
    while (el && guard < 4) {
      if (el.dataset && el.dataset.index !== undefined) return Number(el.dataset.index);
      el = el.parentElement;
      guard += 1;
    }
    return -1;
  }

  // ── 生命周期 ─────────────────────────────────────────────────────
  function resetRound() {
    cancelAll();
    generation += 1;
    // 一次性反馈类是"谁加谁收"：收尾定时器已被 cancelAll 清掉，所以这里必须亲手撤掉，
    // 否则上一局的得角/陷阱柔光会永久留在新一局的棋盘上。
    for (const cell of cells) clearFlash(cell);
    if (els.beam) els.beam.classList.remove("is-bump");
    previewSet = new Set();
    peekHint = -1;
    cursor = -1;
    animating = 0;
    resultShown = false;
    lastLean = null;
    closeLayers();
    if (els.toast) els.toast.hidden = true;
  }

  return {
    els,
    cells,
    bind,
    render,
    paintClock,
    animate,
    applyText,
    openLayer,
    closeLayers,
    isOpen,
    toast,
    buildLevels,
    resetRound,
    setLocale(next) {
      locale = next;
      applyText();
    },
    getLocale: () => locale,
    t,
    tf,
    setPreview,
    clearPreview,
    peek,
    wantsConfirm,
    isReduced,
    isAnimating: () => animating > 0,
    setCtx(patch) {
      ctx = { ...ctx, ...patch };
    },
    markResultShown(value) {
      resultShown = Boolean(value);
    },
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
