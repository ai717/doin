// UI 层：唯一 DOM 拥有者。渲染永远以引擎 state 为准逐格同步，
// 不在 DOM 里缓存"上一次的状态"，也不自行推导棋盘 —— 沿用 §5.2 铁律。

import {
  FLAGGED,
  REVEALED,
  STATUS_LOST,
  STATUS_READY,
  STATUS_WON,
  remainingMines,
} from "./engine.mjs";
import { format } from "./i18n.mjs";

const FLAG_SVG =
  '<svg class="icon" viewBox="0 0 10 12" aria-hidden="true"><path d="M3 1.4v9.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3 2.2l4.6 1.5L3 5.2z" fill="currentColor"/></svg>';
const MINE_SVG =
  '<svg class="icon" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="2.8" fill="currentColor"/><path d="M6 .8v2M6 9.2v2M.8 6h2M9.2 6h2M2.2 2.2l1.4 1.4M8.4 8.4l1.4 1.4M9.8 2.2L8.4 3.6M3.6 8.4L2.2 9.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

function statusText(t) {
  return {
    [STATUS_READY]: t.statusReady,
    playing: t.statusPlaying,
    [STATUS_WON]: t.statusWon,
    [STATUS_LOST]: t.statusLost,
  };
}

function fmtTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + String(s).padStart(2, "0");
}

// t：i18n 字符串包（strings(locale)），由 main 装配层传入。
export function mountUI(refs, hooks = {}, t) {
  const board = refs.board;
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let cells = [];
  let layout = null;
  let messageTimer = 0;
  let longPressFired = false;
  let pressTimer = 0;

  function buildBoard(state) {
    layout = { rows: state.rows, cols: state.cols };
    board.style.setProperty("--cols", String(state.cols));
    const frag = document.createDocumentFragment();
    cells = new Array(state.rows * state.cols);
    for (let i = 0; i < cells.length; i += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = String(i);
      cells[i] = cell;
      frag.appendChild(cell);
    }
    board.replaceChildren(frag);
  }

  function paintCell(game, index) {
    const state = game.state;
    const cell = cells[index];
    const cs = state.cellState[index];
    cell.textContent = "";

    if (cs === REVEALED) {
      cell.classList.add("open");
      const n = state.adjacency[index];
      if (n > 0) {
        cell.dataset.n = String(n);
        cell.textContent = String(n);
      }
    } else if (cs === FLAGGED) {
      cell.classList.add("flagged");
      cell.innerHTML = FLAG_SVG;
      if (state.status === STATUS_LOST && state.mineField[index] !== 1) {
        cell.classList.add("wrong");
        cell.textContent = "✕";
      }
    } else if (state.status === STATUS_LOST && state.mineField[index] === 1) {
      cell.classList.add("mine");
      cell.innerHTML = MINE_SVG;
    }

    if (index === state.explodedIndex) cell.classList.add("boom");
  }

  function render(game) {
    const state = game.state;
    if (!layout || layout.rows !== state.rows || layout.cols !== state.cols) buildBoard(state);

    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      cell.className = "cell";
      cell.dataset.n = "";
      cell.style.animationDelay = "";
      paintCell(game, i);
    }

    // 波纹：按 BFS 顺序由近及远展开
    if (!reducedMotion && state.lastRevealed.length > 1) {
      state.lastRevealed.forEach((index, order) => {
        const cell = cells[index];
        cell.classList.add("pop");
        cell.style.animationDelay = Math.min(order * 14, 360) + "ms";
      });
    }

    refs.hudMines.textContent = String(Math.max(0, remainingMines(state)));
    refs.hudProgress.textContent =
      Math.round((state.revealedCount / (state.rows * state.cols - state.mines)) * 100) + "%";
    refs.status.textContent = statusText(t)[state.status] || "";
    refs.status.dataset.tone = state.status === STATUS_LOST ? "bad" : state.status === STATUS_WON ? "good" : "info";
    board.dataset.status = state.status;
  }

  function updateTimer(game, now = Date.now()) {
    const end = game.finishedAt || (game.startedAt ? now : 0);
    refs.hudTime.textContent = fmtTime(end ? end - game.startedAt : 0);
  }

  function showMessage(text, tone = "info") {
    refs.message.textContent = text;
    refs.message.dataset.tone = tone;
    refs.message.hidden = false;
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
      refs.message.hidden = true;
    }, 2200);
  }

  function vibrate(pattern) {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
    } catch (error) {
      // 触感不可用就跳过，不影响游戏
    }
  }

  function showResult(game, summary = {}) {
    const state = game.state;
    if (state.status !== STATUS_WON && state.status !== STATUS_LOST) return;
    const won = state.status === STATUS_WON;
    const elapsedMs = summary.elapsedMs ?? game.finishedAt - game.startedAt;

    refs.resultBadge.textContent = won ? "CLEARED" : "BOOM";
    refs.resultBadge.dataset.tone = won ? "good" : "bad";
    refs.resultTitle.textContent = won ? t.resultWon : t.resultLost;
    refs.resultSub.textContent = format(
      t.resultSub,
      fmtTime(elapsedMs),
      String(game.actionCount),
      refs.difficultyLabel.textContent
    );

    const rows = refs.resultRows;
    if (rows) {
      rows.replaceChildren();
      const addRow = (label, valueText, record = false) => {
        const row = document.createElement("div");
        row.className = "result-row";
        const value = document.createElement("b");
        value.textContent = valueText;
        if (record) {
          const tag = document.createElement("em");
          tag.className = "rec";
          tag.textContent = t.rowNewRecord;
          value.appendChild(tag);
        }
        const span = document.createElement("span");
        span.textContent = label;
        row.appendChild(span);
        row.appendChild(value);
        rows.appendChild(row);
      };

      if (won && summary.score) {
        const s = summary.score;
        addRow(t.rowScore, String(s.total), summary.isBestScore);
        addRow(t.rowBase, String(s.base));
        addRow(t.rowTime, String(s.time));
      }
      const best = summary.best || {};
      addRow(t.rowBestScore, String(best.bestScore ?? 0));
      addRow(t.rowBestTime, best.bestTimeMs == null ? "—" : fmtTime(best.bestTimeMs));
    }

    refs.resultLayer.hidden = false;
  }

  function hideResult() {
    refs.resultLayer.hidden = true;
  }

  board.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    event.preventDefault();
    // 触屏长按已插过旗，随后的 contextmenu 不再二次切换
    if (longPressFired) return;
    hooks.onIntent("flag", Number(cell.dataset.index));
  });

  // 触屏长按 = 插旗（鼠标走右键）
  board.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    const cell = event.target.closest(".cell");
    if (!cell) return;
    const index = Number(cell.dataset.index);
    longPressFired = false;
    window.clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      longPressFired = true;
      vibrate(24);
      hooks.onIntent("flag", index);
    }, 320);
  });

  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    board.addEventListener(type, () => window.clearTimeout(pressTimer));
  }

  board.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    if (longPressFired) {
      longPressFired = false;
      return;
    }
    hooks.onIntent("reveal", Number(cell.dataset.index));
  });

  return { render, updateTimer, showMessage, showResult, hideResult, vibrate };
}

export { fmtTime };
