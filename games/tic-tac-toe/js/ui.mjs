// DOM 层：渲染棋盘、驱动动画、绑定交互。
// 只负责"把 view 画出来"和"把用户意图翻译成 onPlay 回调"，不持有任何规则判断。

import { EMPTY, PLAYER_O, PLAYER_X, STATUS_DRAW, STATUS_PLAYING, STATUS_WON } from "./engine.mjs";
import { DIFFICULTY_META } from "./ai.mjs";
import { MODES } from "./storage.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const MARK_X = "红 X";
const MARK_O = "蓝 O";

function stroke(kind, d, length, delayed) {
  const node = document.createElementNS(SVG_NS, kind);
  if (d) node.setAttribute("d", d);
  node.setAttribute("class", "mark-stroke" + (delayed ? " delay" : ""));
  node.style.setProperty("--len", String(length));
  return node;
}

function buildMark(player) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "mark " + (player === PLAYER_X ? "mark-x" : "mark-o"));
  svg.setAttribute("aria-hidden", "true");
  if (player === PLAYER_X) {
    svg.appendChild(stroke("path", "M22 22 L78 78", 85, false));
    svg.appendChild(stroke("path", "M78 22 L22 78", 85, true));
  } else {
    const circle = stroke("circle", null, 189, false);
    circle.setAttribute("cx", "50");
    circle.setAttribute("cy", "50");
    circle.setAttribute("r", "30");
    svg.appendChild(circle);
  }
  return svg;
}

export function mountUI(refs, handlers) {
  let cellCount = 0;
  let lastMarks = [];
  const hudCache = {};

  function buildBoard(size) {
    refs.board.style.setProperty("--size", String(size));
    refs.board.textContent = "";
    for (let index = 0; index < size * size; index += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = String(index);
      cell.setAttribute("role", "gridcell");
      refs.board.appendChild(cell);
    }
    cellCount = size * size;
    lastMarks = new Array(cellCount).fill(EMPTY);
  }

  function paintMarks(view) {
    const { state, lastMove } = view;
    for (let index = 0; index < cellCount; index += 1) {
      const cell = refs.board.children[index];
      const value = state.board[index];
      if (lastMarks[index] !== value) {
        cell.textContent = "";
        if (value === EMPTY) {
          cell.removeAttribute("data-mark");
        } else {
          cell.dataset.mark = value === PLAYER_X ? "x" : "o";
          cell.appendChild(buildMark(value));
        }
        lastMarks[index] = value;
      }
      // 可落子状态每帧都要刷新：AI 走完一轮后，空格必须重新可点
      cell.disabled = value !== EMPTY || !view.humanTurn;
      if (index === lastMove && value !== EMPTY) {
        cell.classList.remove("is-fresh");
        void cell.offsetWidth;
        cell.classList.add("is-fresh");
      }
      const row = Math.floor(index / state.size) + 1;
      const col = (index % state.size) + 1;
      cell.setAttribute(
        "aria-label",
        "第 " + row + " 行第 " + col + " 列，" + (value === PLAYER_X ? MARK_X : value === PLAYER_O ? MARK_O : "空"),
      );
    }
  }

  function paintWinLine(view) {
    refs.winLine.textContent = "";
    for (const cell of refs.board.children) cell.classList.remove("is-win");
    refs.board.classList.toggle("is-draw", view.state.status === STATUS_DRAW);

    const line = view.state.winLine;
    if (!line) return;

    const box = refs.board.getBoundingClientRect();
    const cells = refs.board.children;
    const first = cells[line[0]].getBoundingClientRect();
    const last = cells[line[line.length - 1]].getBoundingClientRect();
    const x1 = first.left - box.left + first.width / 2;
    const y1 = first.top - box.top + first.height / 2;
    const x2 = last.left - box.left + last.width / 2;
    const y2 = last.top - box.top + last.height / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const pad = first.width * 0.16;
    const ax = x1 - (dx / length) * pad;
    const ay = y1 - (dy / length) * pad;
    const bx = x2 + (dx / length) * pad;
    const by = y2 + (dy / length) * pad;
    const total = length + pad * 2;

    refs.winLine.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M" + ax + " " + ay + " L" + bx + " " + by);
    path.style.setProperty("--len", String(total));
    refs.winLine.appendChild(path);

    for (const index of line) refs.board.children[index].classList.add("is-win");
  }

  function setHud(id, value) {
    const node = refs[id];
    if (!node) return;
    const text = String(value);
    if (hudCache[id] === text) return;
    hudCache[id] = text;
    node.textContent = text;
    const host = node.classList.contains("hud-value") ? node : node.parentElement;
    host.classList.remove("is-bump");
    void host.offsetWidth;
    host.classList.add("is-bump");
  }

  function statusText(view) {
    const { config, state, thinking } = view;
    const isPvp = config.mode === MODES.PVP;
    if (state.status === STATUS_WON) {
      const winner = state.winner === PLAYER_X ? MARK_X : MARK_O;
      if (isPvp) return winner + " 获胜";
      return state.winner === config.humanMark ? "你赢了！" : "AI 赢了";
    }
    if (state.status === STATUS_DRAW) return "平局，势均力敌";
    if (thinking) return "AI 正在思考";
    if (isPvp) return "轮到" + (state.current === PLAYER_X ? MARK_X : MARK_O);
    return "轮到你 · 你是" + MARK_X;
  }

  function paintSegments(view, meta) {
    const { config } = view;
    for (const button of refs.modeGroup.querySelectorAll(".seg")) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === config.mode));
    }
    for (const button of refs.sizeGroup.querySelectorAll(".seg")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.size) === config.size));
    }
    for (const button of refs.difficultyGroup.querySelectorAll(".seg")) {
      button.setAttribute("aria-pressed", String(button.dataset.difficulty === config.difficulty));
    }
    refs.difficultyWrap.hidden = config.mode === MODES.PVP;
    refs.hudLeftTag.textContent = config.mode === MODES.PVP ? MARK_X : "你";
    refs.hudRightTag.textContent = config.mode === MODES.PVP ? MARK_O : "AI";
    refs.themeButton.setAttribute("aria-pressed", String(meta.prefs.theme === "dark"));
    refs.soundButton.setAttribute("aria-pressed", String(!meta.prefs.muted));
  }

  let currentView = null;

  function render(view, meta) {
    currentView = view;
    const size = view.config.size;
    if (cellCount !== size * size) buildBoard(size);
    paintSegments(view, meta);
    paintMarks(view);
    paintWinLine(view);

    refs.status.textContent = statusText(view);
    refs.status.classList.toggle("is-thinking", view.thinking);

    const pvp = view.config.mode === MODES.PVP;
    setHud("hudLeft", meta.stats.wins);
    setHud("hudDraw", meta.stats.draws);
    setHud("hudRight", meta.stats.losses);
    setHud("hudStreak", meta.stats.streak);
    setHud("hudBest", meta.stats.bestStreak);

    refs.scoreLine.textContent = pvp
      ? "双人同屏不计入战绩与连胜"
      : "难度 " + DIFFICULTY_META[view.config.difficulty].label + " · 总积分 " + meta.stats.totalScore;

    refs.undoButton.disabled = !view.canUndo;
  }

  refs.board.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    handlers.onPlay(Number(cell.dataset.index));
  });

  // 方向键在格子间移动焦点，保持原生 Tab 可用的同时支持键盘对弈
  refs.board.addEventListener("keydown", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    const size = Number(refs.board.style.getPropertyValue("--size")) || 3;
    const index = Number(cell.dataset.index);
    let next = -1;
    if (event.key === "ArrowLeft") next = index - 1;
    else if (event.key === "ArrowRight") next = index + 1;
    else if (event.key === "ArrowUp") next = index - size;
    else if (event.key === "ArrowDown") next = index + size;
    if (next < 0 || next >= cellCount) return;
    event.preventDefault();
    refs.board.children[next].focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key >= "1" && event.key <= "9") {
      const index = Number(event.key) - 1;
      if (index < cellCount) handlers.onPlay(index);
      return;
    }
    if (event.key === "z" || event.key === "Z") handlers.onUndo();
    else if (event.key === "r" || event.key === "R") handlers.onRestart();
  });

  for (const button of refs.modeGroup.querySelectorAll(".seg")) {
    button.addEventListener("click", () => handlers.onMode(button.dataset.mode));
  }
  for (const button of refs.sizeGroup.querySelectorAll(".seg")) {
    button.addEventListener("click", () => handlers.onSize(Number(button.dataset.size)));
  }
  for (const button of refs.difficultyGroup.querySelectorAll(".seg")) {
    button.addEventListener("click", () => handlers.onDifficulty(button.dataset.difficulty));
  }
  refs.undoButton.addEventListener("click", () => handlers.onUndo());
  refs.restartButton.addEventListener("click", () => handlers.onRestart());
  refs.soundButton.addEventListener("click", () => handlers.onSound());
  refs.themeButton.addEventListener("click", () => handlers.onTheme());

  window.addEventListener("resize", () => {
    if (currentView && currentView.state.winLine) paintWinLine(currentView);
  });

  return { render };
}
