// ui.mjs —— 唯一触碰 DOM 的渲染层：棋盘、LED、笑脸、菜单、弹窗。
// 不参与规则计算；所有状态都来自 engine state，通过 sync 全量刷到 DOM。
import { REVEALED, FLAG, QUESTION, STATUS_LOST, STATUS_WON } from "./engine.mjs";

// ── 矢量素材（零外部资源）────────────────────────────
const MINE_SVG = '<svg viewBox="0 0 16 16" width="16" height="16"><g fill="#000" stroke="#000" stroke-width="0.8"><circle cx="8" cy="8" r="4.2"/><path d="M8 1.4 L8 4 M8 12 L8 14.6 M1.4 8 L4 8 M12 8 L14.6 8 M3.3 3.3 L5.2 5.2 M10.8 10.8 L12.7 12.7 M12.7 3.3 L10.8 5.2 M5.2 10.8 L3.3 12.7" stroke-width="1.4"/></g></svg>';

const FLAG_SVG = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 2 L4 14" stroke="#000" stroke-width="1.4"/><path d="M4 2.4 L13 4.6 L4 7 Z" fill="#f00" stroke="#700" stroke-width="0.6"/><path d="M2 13 L6 13" stroke="#000" stroke-width="1.6"/></svg>';

const MISFLAG_SVG = '<svg viewBox="0 0 16 16" width="16" height="16"><g fill="#000" stroke="#000" stroke-width="0.8"><circle cx="8" cy="8" r="4.2"/><path d="M8 1.4 L8 4 M8 12 L8 14.6 M1.4 8 L4 8 M12 8 L14.6 8 M3.3 3.3 L5.2 5.2 M10.8 10.8 L12.7 12.7 M12.7 3.3 L10.8 5.2 M5.2 10.8 L3.3 12.7" stroke-width="1.2"/></g><g stroke="#f00" stroke-width="1.8"><path d="M4 4 L12 12"/><path d="M12 4 L4 12"/></g></svg>';

const FACE_NORMAL = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#ffd500" stroke="#000" stroke-width="1.2"/><circle cx="8.2" cy="9.5" r="1.1" fill="#000"/><circle cx="15.8" cy="9.5" r="1.1" fill="#000"/><path d="M7.5 15.5 Q12 19.5 16.5 15.5" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"/></svg>';
const FACE_OH = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#ffd500" stroke="#000" stroke-width="1.2"/><circle cx="8.2" cy="9.5" r="1.6" fill="#000"/><circle cx="15.8" cy="9.5" r="1.6" fill="#000"/><ellipse cx="12" cy="15.5" rx="2.4" ry="2.8" fill="#000"/></svg>';
const FACE_DEAD = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#ffd500" stroke="#000" stroke-width="1.2"/><g stroke="#000" stroke-width="1.6" stroke-linecap="round"><path d="M7 7.5 L9.6 10.1 M9.6 7.5 L7 10.1"/><path d="M14.4 7.5 L17 10.1 M17 7.5 L14.4 10.1"/></g><path d="M7.5 17.5 Q12 14 16.5 17.5" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"/></svg>';
const FACE_COOL = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#ffd500" stroke="#000" stroke-width="1.2"/><path d="M5.5 9.5 H11 L5.5 13.5 H11" fill="none" stroke="#000" stroke-width="1.5"/><path d="M13 9.5 H18.5 L13 13.5 H18.5" fill="none" stroke="#000" stroke-width="1.5"/><path d="M16.5 12 H19" stroke="#000" stroke-width="1.5"/><path d="M7.5 16 Q12 20 16.5 16" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"/></svg>';

function led(n) {
  if (n < 0) return "-" + String(Math.min(99, -n)).padStart(2, "0");
  return String(Math.min(999, Math.max(0, n))).padStart(3, "0");
}

function el(id) {
  return document.getElementById(id);
}

export function createUI(t) {
  const boardEl = el("board");
  const ledMines = el("led-mines");
  const ledTime = el("led-time");
  const smiley = el("smiley");

  let cells = [];
  let cellCache = []; // 每格签名，用于仅刷新变化格
  let press = false;

  function svgFace(status) {
    if (status === STATUS_LOST) return FACE_DEAD;
    if (status === STATUS_WON) return FACE_COOL;
    if (press) return FACE_OH;
    return FACE_NORMAL;
  }

  function setPress(value) {
    press = value;
  }

  function cellSignature(state, i) {
    const cs = state.cellState[i];
    const isMine = state.mineField[i] === 1;
    const lost = state.status === STATUS_LOST;
    if (lost && isMine && cs !== FLAG) return i === state.explodedIndex ? "bm" : "mi";
    if (lost && !isMine && cs === FLAG) return "mf";
    if (cs === FLAG) return "fl";
    if (cs === QUESTION) return "qu";
    if (cs === REVEALED) return "r" + (isMine ? -1 : state.adjacency[i]);
    return "h";
  }

  function renderCell(cell, state, i) {
    const cs = state.cellState[i];
    const isMine = state.mineField[i] === 1;
    const lost = state.status === STATUS_LOST;
    let cls = "cell";
    let html = "";

    if (lost && isMine && cs !== FLAG) {
      cls += i === state.explodedIndex ? " cell--revealed cell--boom" : " cell--revealed";
      html = MINE_SVG;
    } else if (lost && !isMine && cs === FLAG) {
      cls += " cell--revealed cell--misflag";
      html = MISFLAG_SVG;
    } else if (cs === FLAG) {
      cls += " cell--hidden";
      html = FLAG_SVG;
    } else if (cs === QUESTION) {
      cls += " cell--hidden cell--question";
      html = "?";
    } else if (cs === REVEALED) {
      cls += " cell--revealed";
      if (isMine) {
        html = MINE_SVG;
      } else {
        const n = state.adjacency[i];
        if (n > 0) { cls += " cell--n" + n; html = String(n); }
      }
    } else {
      cls += " cell--hidden";
    }

    if (cell.className !== cls) cell.className = cls;
    if (cell.innerHTML !== html) cell.innerHTML = html;
  }

  // 按列数与视口宽度自适应格子尺寸：小盘放大（初级/中级更醒目），
  // 高级 30 列宽板自动收缩，避免在桌面横向溢出。
  function cellFor(cols) {
    const vw = document.documentElement.clientWidth || 1200;
    const cap = vw > 768 ? 660 : Math.min(320, vw - 24);
    const cell = Math.floor(cap / cols);
    return Math.max(13, Math.min(38, cell));
  }

  function buildBoard(state) {
    boardEl.style.setProperty("--cols", state.cols);
    boardEl.style.setProperty("--rows", state.rows);
    boardEl.style.setProperty("--cell", cellFor(state.cols) + "px");
    boardEl.innerHTML = "";
    cells = new Array(state.rows * state.cols);
    cellCache = new Array(state.rows * state.cols).fill("");
    const frag = document.createDocumentFragment();
    for (let i = 0; i < state.rows * state.cols; i += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell cell--hidden";
      button.dataset.index = String(i);
      button.setAttribute("aria-label", "格子");
      cells[i] = button;
      frag.appendChild(button);
    }
    boardEl.appendChild(frag);
  }

  function sync(state) {
    ledMines.textContent = led(state.mines - state.flagCount);
    ledTime.textContent = led(0);
    smiley.innerHTML = svgFace(state.status);
    for (let i = 0; i < cells.length; i += 1) {
      const sig = cellSignature(state, i);
      if (cellCache[i] !== sig) {
        cellCache[i] = sig;
        renderCell(cells[i], state, i);
      }
    }
  }

  function syncTime(ms) {
    ledTime.textContent = led(Math.floor(ms / 1000));
  }

  function setStatusText(text) {
    const elStatus = el("status");
    if (elStatus) elStatus.textContent = text;
  }

  return { buildBoard, sync, syncTime, setPress, setStatusText };
}

// ── 菜单 / 弹窗辅助 ───────────────────────────────
export function bindMenuAndDialogs(t, handlers) {
  function openMenu(id) {
    const drop = el(id);
    if (!drop) return;
    const btn = el(id === "menu-game-drop" ? "menu-game" : "menu-help");
    const rect = btn.getBoundingClientRect();
    drop.style.top = rect.bottom + "px";
    drop.style.left = rect.left + "px";
    drop.hidden = false;
  }
  function closeMenus() {
    el("menu-game-drop").hidden = true;
    el("menu-help-drop").hidden = true;
  }
  function openDialog(dlg) {
    el("overlay").hidden = false;
    dlg.hidden = false;
  }
  function closeDialog(dlg) {
    dlg.hidden = true;
    if (![...el("overlay").querySelectorAll(".dialog")].some((d) => !d.hidden)) {
      el("overlay").hidden = true;
    }
  }
  function closeAllDialogs() {
    for (const id of ["dlg-rules", "dlg-about", "dlg-custom", "dlg-record"]) el(id).hidden = true;
    el("overlay").hidden = true;
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu-item")) closeMenus();
  });

  // 菜单项
  const bind = (id, fn) => el(id)?.addEventListener("click", fn);

  el("menu-game")?.addEventListener("click", () => {
    closeMenus();
    if (el("menu-game-drop").hidden) openMenu("menu-game-drop");
    else el("menu-game-drop").hidden = true;
  });
  el("menu-help")?.addEventListener("click", () => {
    closeMenus();
    if (el("menu-help-drop").hidden) openMenu("menu-help-drop");
    else el("menu-help-drop").hidden = true;
  });

  bind("menu-new", () => { closeMenus(); handlers.onNewGame(); });

  el("overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "overlay") closeAllDialogs();
  });
  document.addEventListener("click", (e) => {
    const closer = e.target.closest && e.target.closest("[data-close]");
    if (closer) {
      const dlg = closer.closest(".dialog");
      if (dlg) closeDialog(dlg);
    }
  });

  return {
    openDialog,
    closeDialog,
    closeAllDialogs,
    closeMenus,
    el,
  };
}