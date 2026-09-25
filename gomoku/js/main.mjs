// 装配入口：连接 storage / i18n / audio / game / render / review。
// DOM 事件绑定，全站共享语言偏好，纯键盘方向键瞄准，AI 复盘点评与正解路线回放。

import { createGameController } from "./game.mjs";
import { createAudio } from "./audio.mjs";
import { createRenderer } from "./render.mjs";
import { analyzeGame } from "./review.mjs";
import {
  loadLocale, saveLocale, htmlLang, strings, format, DEFAULT_LOCALE,
} from "./i18n.mjs";
import {
  load, save, normalize, applyOutcome, MODES, defaultState,
} from "./storage.mjs";
import { DIFFICULTIES, DIFFICULTY_BEGINNER, DIFFICULTY_INTERMEDIATE } from "./ai.mjs";
import { BLACK, WHITE, STATUS_PLAYING, STATUS_WON, STATUS_FORBIDDEN, STATUS_DRAW, SIZE } from "./engine.mjs";
import { TSUMEGO, listChapters, getTsumego } from "./tsumego.mjs";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let locale = loadLocale();
let store = load();
let audio = createAudio({ muted: store.prefs.muted });
const canvas = $("#board");
const renderer = createRenderer(canvas);
const controller = createGameController({
  onChange: (view) => render(view),
});

let keyCursor = 112; // 默认中心天元 (7*15+7)
let animFrameId = null;
let showingSolution = false;

function t(key) { return strings(locale)[key] ?? key; }
function tf(key, vars) { return format(strings(locale)[key] ?? key, vars); }

function applyLocale(next) {
  locale = next;
  saveLocale(next);
  document.documentElement.lang = htmlLang(next);
  document.title = `${t("title")} · DOIN 在线小游戏`;
  $("#title").textContent = t("title");
  $$("[data-i18n]").forEach((el) => {
    const k = el.dataset.i18n;
    if (t(k)) el.textContent = t(k);
  });
  $("#lang-btn").textContent = next === "zh" ? "EN" : "中";
  $("#rules-text").textContent = t("rulesText");
  refreshUI();
}

function refreshUI() {
  const view = controller.view();
  render(view);
}

function render(view) {
  const s = view.state;
  if (!s) return;

  // 棋盘渲染参数
  const opts = {};
  if (view.thinking && view.thinkingProgress?.candidates) {
    opts.candidates = view.thinkingProgress.candidates;
  }
  if (s.status === STATUS_WON || s.status === STATUS_FORBIDDEN) {
    opts.winLine = s.winLine;
  }
  opts.thinking = view.thinking;
  renderer.setLastMove(s.lastMove);
  renderer.render(s.board, opts);

  // 思考中驱动平滑呼吸微动画
  if (view.thinking) {
    if (!animFrameId) {
      const loop = () => {
        const v = controller.view();
        if (v.thinking) {
          renderer.render(v.state.board, {
            thinking: true,
            candidates: v.thinkingProgress?.candidates,
          });
          animFrameId = requestAnimationFrame(loop);
        } else {
          animFrameId = null;
        }
      };
      animFrameId = requestAnimationFrame(loop);
    }
  } else if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  // 状态显示
  let statusText = "";
  if (showingSolution) {
    statusText = `${t("viewSolution")} · ${t("closeSolution")}`;
  } else if (view.thinking) {
    statusText = t("aiTurn") + " · " + t("thinking");
  } else if (s.status === STATUS_PLAYING) {
    const sideName = s.current === BLACK ? t("black") : t("white");
    statusText = view.humanTurn ? `${t("yourTurn")} · ${sideName}` : t("aiTurn");
  } else if (s.status === STATUS_WON) {
    const winName = s.winner === BLACK ? t("black") : t("white");
    statusText = `${winName} ${t("youWin")}`;
  } else if (s.status === STATUS_FORBIDDEN) {
    statusText = t("forbiddenLoss");
  } else if (s.status === STATUS_DRAW) {
    statusText = t("draw");
  }
  $("#status").textContent = statusText;

  // 当前棋石指示
  const stoneEl = $("#current-stone");
  if (s.current === BLACK) {
    stoneEl.className = "stone stone-black";
    $("#current-meta").textContent = t("black");
  } else if (s.current === WHITE) {
    stoneEl.className = "stone stone-white";
    $("#current-meta").textContent = t("white");
  } else {
    if (s.winner === BLACK) {
      stoneEl.className = "stone stone-black";
      $("#current-meta").textContent = t("black") + " " + t("youWin");
    } else if (s.winner === WHITE) {
      stoneEl.className = "stone stone-white";
      $("#current-meta").textContent = t("white") + " " + t("youWin");
    }
  }

  // 战绩双语标签
  const winLbl = $("#stat-wins-lbl");
  const drawLbl = $("#stat-draws-lbl");
  const lossLbl = $("#stat-losses-lbl");
  if (winLbl) winLbl.textContent = t("statWin");
  if (drawLbl) drawLbl.textContent = t("statDraw");
  if (lossLbl) lossLbl.textContent = t("statLoss");

  // 思考光斑区域指示
  if (view.thinking) {
    $("#thinking-zone").hidden = false;
    const dots = $("#thinking-dots");
    if (dots.childElementCount === 0) {
      for (let i = 0; i < 3; i += 1) {
        const d = document.createElement("span");
        d.className = "thinking-dot";
        dots.appendChild(d);
      }
    }
  } else {
    $("#thinking-zone").hidden = true;
  }

  // 残局专属信息
  if (view.config?.mode === MODES.TSUMEGO && view.currentPuzzle) {
    const p = view.currentPuzzle;
    $("#tsumego-info").hidden = false;
    if (p.target === "win") {
      $("#tsumego-target").textContent = tf("winInMoves", { n: p.parMoves });
    } else {
      $("#tsumego-target").textContent = tf("drawInMoves", { n: p.parMoves });
    }
    const hintText = (locale === "en" ? p.hintEn : p.hint) || p.hint || "";
    $("#tsumego-hint").textContent = hintText;
    const stars = store.tsumego.stars[p.id]?.stars || 0;
    const starStr = "★".repeat(stars) + "☆".repeat(3 - stars);
    $("#tsumego-stars").textContent = starStr;

    $("#mode-group").style.opacity = 0.4;
    $("#difficulty-group-wrap").style.display = "none";
    $("#side-group-wrap").style.display = "none";
    $("#undo-btn").style.display = "none";
    $("#resign-btn").style.display = "none";
    $("#level-btn").hidden = false;
  } else {
    $("#tsumego-info").hidden = true;
    $("#mode-group").style.opacity = 1;
    $("#difficulty-group-wrap").style.display = "";
    $("#side-group-wrap").style.display = "";
    $("#undo-btn").style.display = "";
    $("#resign-btn").style.display = "";
    $("#level-btn").hidden = true;
  }

  // 棋谱
  const movesList = $("#moves-list");
  movesList.innerHTML = "";
  for (let i = 0; i < s.moves.length; i += 1) {
    const li = document.createElement("li");
    const moveIdx = s.moves[i];
    const [r, c] = [Math.floor(moveIdx / 15), moveIdx % 15];
    const player = i % 2 === 0 ? BLACK : WHITE;
    const cls = player === BLACK ? "move-black" : "move-white";
    const colLetter = String.fromCharCode(65 + c);
    const rowNum = 15 - r;
    li.innerHTML = `<span class="move-num">${i + 1}.</span><span class="${cls}"></span><span class="move-coord">${colLetter}${rowNum}</span>`;
    movesList.appendChild(li);
  }
  movesList.scrollTop = movesList.scrollHeight;

  // 战绩
  if (view.config?.mode === MODES.PVE) {
    $("#stats-zone").hidden = false;
    $("#stat-wins").textContent = store.stats.wins;
    $("#stat-draws").textContent = store.stats.draws;
    $("#stat-losses").textContent = store.stats.losses;
  } else {
    $("#stats-zone").hidden = true;
  }

  // 悔棋可用性
  $("#undo-btn").disabled = !view.canUndo;

  // 终局结算弹层
  if (view.finished && !view._resultShown) {
    view._resultShown = true;
    showResult(view);
  }
}

function showResult(view) {
  const r = view.finished;
  const layer = $("#result-layer");
  const nextBtn = $("#result-next");
  const solutionBtn = $("#result-solution");
  nextBtn.hidden = true;
  solutionBtn.hidden = true;

  if (r.mode === "tsumego") {
    solutionBtn.hidden = false;
    solutionBtn.onclick = () => {
      layer.hidden = true;
      showingSolution = true;
      const sol = controller.getSolution();
      renderer.setSolution(sol);
      refreshUI();
    };

    if (r.solved) {
      $("#result-badge").textContent = t("puzzleComplete");
      $("#result-title").textContent = t("solvedCorrectly");
      $("#result-sub").textContent = `${r.movesUsed} / ${r.par} ${t("moveCount")}`;
      const stars = controller.result().stars;
      $("#result-breakdown").innerHTML = `<p style="font-size:20px;margin:4px 0;">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</p>`;
      audio.puzzleSolved();

      const p = view.currentPuzzle;
      if (p) {
        const prev = store.tsumego.stars[p.id] || { stars: 0, bestMoves: 999, firstSolve: false };
        const newStars = Math.max(prev.stars, stars);
        const newBest = Math.min(prev.bestMoves, r.movesUsed);
        store.tsumego.stars[p.id] = { stars: newStars, bestMoves: newBest, firstSolve: prev.firstSolve || stars === 3 };
        if (!store.tsumego.unlocked.includes(p.id + 1) && p.id < 30) {
          store.tsumego.unlocked.push(p.id + 1);
        }
        save(store);
      }
      if (view.currentPuzzle?.id < 30) {
        nextBtn.hidden = false;
        nextBtn.onclick = () => {
          layer.hidden = true;
          controller.start({ mode: MODES.TSUMEGO, puzzleId: view.currentPuzzle.id + 1 });
        };
      }
    } else {
      $("#result-badge").textContent = t("puzzle");
      $("#result-title").textContent = t("retry");
      $("#result-sub").textContent = `${r.movesUsed} / ${r.par} ${t("moveCount")}`;
      $("#result-breakdown").textContent = "";
    }
  } else if (r.mode === "pve") {
    if (r.outcome === "win") {
      $("#result-badge").textContent = t("youWin");
      $("#result-title").textContent = t("youWin");
      audio.winBlack();
    } else if (r.outcome === "loss") {
      $("#result-badge").textContent = t("youLose");
      $("#result-title").textContent = t("youLose");
      audio.winWhite();
    } else {
      $("#result-badge").textContent = t("draw");
      $("#result-title").textContent = t("draw");
    }
    $("#result-sub").textContent = "";

    // 🌟 AI 复盘点评分析
    const moves = view.state?.moves || [];
    const winner = view.state?.winner || null;
    const humanMark = view.config.humanMark;
    const reviews = analyzeGame(moves, winner, humanMark);

    if (reviews.length > 0) {
      let html = `<div style="font-weight:600;margin-bottom:6px;">${t("reviewAI")}</div><ul class="review-list">`;
      for (const item of reviews) {
        const text = tf(item.key, { n: item.step, coord: item.coord });
        const cls = item.type === "win" ? "review-win" : item.type === "double_threat" ? "review-double" : "";
        html += `<li class="review-item ${cls}">${text}</li>`;
      }
      html += `</ul>`;
      $("#result-breakdown").innerHTML = html;
    } else {
      $("#result-breakdown").textContent = "";
    }

    store.stats = applyOutcome(store.stats, r.outcome, view.config.difficulty);
    save(store);
  } else {
    // PVP
    const winner = view.state?.winner;
    const winSide = winner === BLACK ? t("black") : t("white");
    $("#result-badge").textContent = `${winSide} ${t("youWin")}`;
    $("#result-title").textContent = `${winSide} ${t("youWin")}`;
    $("#result-sub").textContent = "";
    $("#result-breakdown").textContent = "";
    audio.winBlack();
  }

  layer.hidden = false;
}

function startNewGame(opts = {}) {
  showingSolution = false;
  renderer.setSolution(null);

  const mode = opts.mode ?? store.prefs.mode;
  const difficulty = opts.difficulty ?? store.prefs.difficulty;
  const side = opts.side ?? BLACK;
  const puzzleId = opts.puzzleId;

  store.prefs.mode = mode;
  store.prefs.difficulty = difficulty;
  save(store);

  $$("#mode-group .seg").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.mode === mode ? "true" : "false");
  });
  $$("#difficulty-group .seg").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.difficulty === difficulty ? "true" : "false");
  });
  $$("#side-group .seg").forEach((b) => {
    b.setAttribute("aria-pressed", Number(b.dataset.side) === side ? "true" : "false");
  });

  if (mode === MODES.TSUMEGO) {
    controller.start({ mode, puzzleId: puzzleId ?? 1 });
  } else {
    controller.start({ mode, difficulty, humanMark: side });
  }
}

function handlePlayMove(idx) {
  if (idx < 0 || idx >= 225) return;
  if (showingSolution) {
    showingSolution = false;
    renderer.setSolution(null);
    refreshUI();
    return;
  }
  audio.unlock();
  const result = controller.play(idx);
  if (result === "wrong") {
    renderer.showWrong(idx);
    audio.wrongMove();
    $("#wrong-toast").hidden = false;
    setTimeout(() => { $("#wrong-toast").hidden = true; }, 1600);
  } else if (result === true) {
    const view = controller.view();
    const isBlack = view.state.moves.length % 2 === 1;
    if (isBlack) audio.placeBlack();
    else audio.placeWhite();
  }
}

// ── 事件绑定 ──────────────────────────────────────
function bindEvents() {
  // 棋盘鼠标点击
  canvas.addEventListener("click", (e) => {
    const idx = renderer.hitTest(e.clientX, e.clientY);
    if (idx >= 0) {
      keyCursor = idx;
      renderer.setCursor(keyCursor);
      handlePlayMove(idx);
    }
  });

  // 鼠标移动时更新焦点准星
  canvas.addEventListener("mousemove", (e) => {
    const idx = renderer.hitTest(e.clientX, e.clientY);
    if (idx >= 0 && idx !== keyCursor) {
      keyCursor = idx;
      renderer.setCursor(keyCursor);
      render(controller.view());
    }
  });

  canvas.addEventListener("mouseleave", () => {
    renderer.setCursor(-1);
    render(controller.view());
  });

  // 模式切换
  $$("#mode-group .seg").forEach((b) => {
    b.addEventListener("click", () => {
      startNewGame({ mode: b.dataset.mode, side: BLACK });
    });
  });

  // 难度切换
  $$("#difficulty-group .seg").forEach((b) => {
    b.addEventListener("click", () => {
      startNewGame({ difficulty: b.dataset.difficulty });
    });
  });

  // 执子切换
  $$("#side-group .seg").forEach((b) => {
    b.addEventListener("click", () => {
      startNewGame({ side: Number(b.dataset.side) });
    });
  });

  // 操作按钮
  $("#undo-btn").addEventListener("click", () => {
    if (controller.undo()) refreshUI();
  });
  $("#resign-btn").addEventListener("click", () => {
    if (controller.resign()) refreshUI();
  });
  $("#restart-btn").addEventListener("click", () => {
    startNewGame({});
  });
  $("#level-btn").addEventListener("click", () => showLevelDialog());

  // 顶边工具
  $("#sound-btn").addEventListener("click", () => {
    store.prefs.muted = !store.prefs.muted;
    save(store);
    audio = createAudio({ muted: store.prefs.muted });
    $("#sound-btn").setAttribute("aria-pressed", !store.prefs.muted ? "true" : "false");
  });
  $("#lang-btn").addEventListener("click", () => {
    applyLocale(locale === "zh" ? "en" : "zh");
  });
  $("#rules-btn").addEventListener("click", () => {
    $("#rules-text").textContent = t("rulesText");
    $("#rules-layer").hidden = false;
  });
  $("#rules-close").addEventListener("click", () => {
    $("#rules-layer").hidden = true;
  });

  // 结果弹层
  $("#result-again").addEventListener("click", () => {
    $("#result-layer").hidden = true;
    startNewGame({});
  });
  $("#result-close").addEventListener("click", () => {
    $("#result-layer").hidden = true;
  });

  // 选关弹层
  $("#level-close").addEventListener("click", () => {
    $("#level-layer").hidden = true;
  });

  // 键盘与准星导航（方向键 + WASD + Enter/Space）
  document.addEventListener("keydown", (e) => {
    // 弹层关闭
    if (e.key === "Escape") {
      $("#rules-layer").hidden = true;
      $("#level-layer").hidden = true;
      if (showingSolution) {
        showingSolution = false;
        renderer.setSolution(null);
        refreshUI();
      }
      return;
    }

    if (e.key === "r" || e.key === "R") {
      startNewGame({});
      return;
    }
    if (e.key === "z" || e.key === "Z") {
      if (controller.undo()) refreshUI();
      return;
    }

    let r = Math.floor(keyCursor / SIZE);
    let c = keyCursor % SIZE;
    let moved = false;

    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      r = Math.max(0, r - 1);
      moved = true;
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      r = Math.min(SIZE - 1, r + 1);
      moved = true;
    } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      c = Math.max(0, c - 1);
      moved = true;
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      c = Math.min(SIZE - 1, c + 1);
      moved = true;
    }

    if (moved) {
      e.preventDefault();
      keyCursor = r * SIZE + c;
      renderer.setCursor(keyCursor);
      render(controller.view());
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePlayMove(keyCursor);
    }
  });
}

function showLevelDialog() {
  const grid = $("#level-grid");
  grid.innerHTML = "";
  for (let i = 1; i <= 30; i += 1) {
    const p = getTsumego(i);
    if (!p) continue;
    const unlocked = store.tsumego.unlocked.includes(i);
    const stars = store.tsumego.stars[i]?.stars || 0;
    const pName = locale === "en" && p.nameEn ? p.nameEn : p.name;
    const cell = document.createElement("button");
    cell.className = "level-cell" + (unlocked ? "" : " locked") + (stars > 0 ? " solved" : "");
    cell.innerHTML = `<div class="level-id">${i}</div><div class="level-name" style="font-size:10px;opacity:0.85;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${pName}</div><div class="level-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>`;
    cell.disabled = !unlocked;
    cell.title = pName;
    cell.addEventListener("click", () => {
      if (!unlocked) return;
      $("#level-layer").hidden = true;
      startNewGame({ mode: MODES.TSUMEGO, puzzleId: i });
    });
    grid.appendChild(cell);
  }
  $("#level-title").textContent = t("levelTitle");
  $("#level-close").textContent = t("levelClose");
  $("#level-layer").hidden = false;
}

// ── 初始化 ──────────────────────────────────────────
function init() {
  applyLocale(locale);
  bindEvents();
  if (store.session) {
    controller.restore(store.session);
  } else {
    startNewGame({});
  }
  renderer.setCursor(keyCursor);
  refreshUI();
}

init();
