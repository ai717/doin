// ui.mjs —— 唯一碰 DOM 与 Canvas 的层：蜂箱视窗、蜂巢棋盘、块队列、蜜罐计分、弹层。
import { createRenderer, hexToPixel } from "./render.mjs";
import { shapeCells, cellKey, RADIUS } from "./engine.mjs";
import { format } from "./i18n.mjs";

function byId(id) { return document.getElementById(id); }

export function createUi(handlers = {}) {
  const canvas = byId("board-canvas");
  const renderer = createRenderer(canvas);

  const el = {
    stageTitle: byId("stage-title"),
    stageKicker: byId("stage-kicker"),
    boardCanvas: canvas,
    queueBody: byId("queue-body"),
    scoreValue: byId("score-value"),
    rowsValue: byId("rows-value"),
    multValue: byId("mult-value"),
    comboValue: byId("combo-value"),
    rushBadge: byId("rush-badge"),
    piecesValue: byId("pieces-value"),
    goalValue: byId("goal-value"),
    playerBadge: byId("player-badge"),
    btnSound: byId("btn-sound"),
    btnLang: byId("btn-lang"),
    btnHelp: byId("btn-help"),
    btnRotate: byId("btn-rotate"),
    btnReset: byId("btn-reset"),
    btnLevels: byId("btn-levels"),
    btnReadyClose: byId("btn-ready-close"),
    panelReady: byId("panel-ready"),
    panelLevels: byId("panel-levels"),
    panelHelp: byId("panel-help"),
    panelResult: byId("panel-result"),
    levelsBody: byId("levels-body"),
    resultTitle: byId("result-title"),
    resultBody: byId("result-body"),
    btnAgain: byId("btn-again"),
    btnNext: byId("btn-next"),
    btnLevels2: byId("btn-levels2"),
    btnModes: byId("btn-modes"),
    toast: byId("toast"),
  };

  let locale = "zh";
  let strings = {};
  let toastTimer = 0;
  let hoverCell = null;

  // ------------------------------------------------------------ 事件

  el.btnSound.addEventListener("click", () => handlers.onSound?.());
  el.btnLang.addEventListener("click", () => handlers.onLang?.());
  el.btnHelp.addEventListener("click", () => showOverlay(el.panelHelp));
  byId("btn-help-close").addEventListener("click", () => hideOverlay(el.panelHelp));
  el.btnRotate.addEventListener("click", () => { handlers.onRotate?.(1); });
  el.btnReset.addEventListener("click", () => handlers.onReset?.());
  el.btnLevels.addEventListener("click", () => openLevels());
  el.btnReadyClose.addEventListener("click", () => hideAllOverlays());
  byId("btn-mode-campaign").addEventListener("click", () => openLevels());
  byId("btn-mode-survival").addEventListener("click", () => handlers.onMode?.("survival"));
  byId("btn-mode-duel").addEventListener("click", () => handlers.onMode?.("duel"));
  el.btnAgain.addEventListener("click", () => handlers.onAgain?.());
  el.btnNext.addEventListener("click", () => handlers.onNext?.());
  el.btnLevels2.addEventListener("click", () => openLevels());
  el.btnModes.addEventListener("click", () => { hideAllOverlays(); showOverlay(el.panelReady); });

  el.boardCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
  let pressStart = null; // {x,y,t,id}：按下起点，用于区分轻击/拖放与滑动

  el.boardCanvas.addEventListener("pointermove", (e) => {
    hoverCell = renderer.cellAt(e.clientX, e.clientY);
  });
  el.boardCanvas.addEventListener("pointerleave", () => { hoverCell = null; });
  el.boardCanvas.addEventListener("pointerdown", (e) => {
    if (e.button === 2) { handlers.onRotate?.(1); return; }
    if (e.button !== 0 && e.pointerType !== "touch") return;
    pressStart = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    // 按下即吸附预览（触屏无 hover），松手时按最终位置落子
    hoverCell = renderer.cellAt(e.clientX, e.clientY);
  });
  el.boardCanvas.addEventListener("pointerup", (e) => {
    if (e.button === 2) return;
    const start = pressStart;
    pressStart = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const moved = Math.hypot(dx, dy);
    const dt = performance.now() - start.t;
    // 轻击或拖放：位移在容差内（含直接松手）即落子；大幅滑动视为取消
    if (moved > 26 || dt > 900) { hoverCell = renderer.cellAt(e.clientX, e.clientY); return; }
    const cell = renderer.cellAt(e.clientX, e.clientY);
    if (cell) handlers.onPlace?.(cell[0], cell[1]);
  });
  el.boardCanvas.addEventListener("pointercancel", () => { pressStart = null; });
  el.boardCanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    handlers.onRotate?.(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // ------------------------------------------------------------ 尺寸

  function syncSize() { renderer.syncSize(); }

  // ------------------------------------------------------------ 浮层

  function showOverlay(node) { node?.classList.remove("hidden"); }
  function hideOverlay(node) { node?.classList.add("hidden"); }
  function hideAllOverlays() {
    [el.panelReady, el.panelLevels, el.panelHelp, el.panelResult].forEach(hideOverlay);
  }
  function openLevels() {
    buildLevels();
    hideOverlay(el.panelReady);
    showOverlay(el.panelLevels);
  }

  // ------------------------------------------------------------ toast

  function toast(message) {
    if (!el.toast || !message) return;
    el.toast.textContent = message;
    el.toast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 1600);
  }

  // ------------------------------------------------------------ 文案

  function applyStrings(nextLocale, nextStrings, { docLang } = {}) {
    locale = nextLocale;
    strings = nextStrings;
    const root = document;
    for (const node of root.querySelectorAll("[data-i18n]")) {
      const v = strings[node.dataset.i18n];
      if (typeof v === "string" && v) node.textContent = v;
    }
    for (const node of root.querySelectorAll("[data-i18n-title]")) {
      const v = strings[node.dataset.i18nTitle];
      if (typeof v === "string" && v) node.setAttribute("title", v);
    }
    for (const node of root.querySelectorAll("[data-i18n-aria]")) {
      const v = strings[node.dataset.i18nAria];
      if (typeof v === "string" && v) node.setAttribute("aria-label", v);
    }
    if (docLang) document.documentElement.lang = docLang;
  }

  function setSoundIcon(muted) {
    el.btnSound.textContent = muted ? "🔇" : "🔊";
    const label = muted ? strings.soundOff : strings.soundOn;
    el.btnSound.title = label;
    el.btnSound.setAttribute("aria-label", label);
  }

  // ------------------------------------------------------------ 渲染

  function render(view) {
    if (!view) return;
    renderer.render(view, { hoverCell });

    // HUD
    el.scoreValue.textContent = String(Math.round(view.score));
    el.rowsValue.textContent = String(view.rowsCleared);
    el.multValue.textContent = `×${view.multiplier}`;
    el.comboValue.textContent = view.rushCombo > 0 ? String(view.rushCombo) : "–";
    el.rushBadge.classList.toggle("active", view.rushActive);

    if (view.mode === "campaign") {
      el.piecesValue.textContent = String(view.piecesRemaining);
      el.goalValue.textContent = `${view.rowsCleared} / ${view.goalRows}`;
    } else {
      el.piecesValue.textContent = "∞";
      el.goalValue.textContent = "–";
    }

    if (view.mode === "duel") {
      el.playerBadge.classList.remove("hidden");
      el.playerBadge.textContent = `${strings.hudPlayer} ${view.currentPlayer}`;
    } else {
      el.playerBadge.classList.add("hidden");
    }

    renderQueue(view);
  }

  let lastQueueSig = "";
  function renderQueue(view) {
    const list = (view.queue || []).slice(0, 3);
    const sig = list.join(",");
    if (sig === lastQueueSig) return;
    lastQueueSig = sig;
    el.queueBody.innerHTML = "";
    list.forEach((shapeId, idx) => {
      const slot = document.createElement("div");
      slot.className = `queue-slot${idx === 0 ? " current" : ""}`;
      const mini = miniShape(shapeId);
      slot.appendChild(mini);
      el.queueBody.appendChild(slot);
    });
  }

  function miniShape(shapeId) {
    const cells = shapeCells(shapeId, 0);
    const wrap = document.createElement("div");
    wrap.className = "mini-shape";
    const qs = cells.map((c) => c[0]);
    const rs = cells.map((c) => c[1]);
    const minQ = Math.min(...qs), maxQ = Math.max(...qs);
    const minR = Math.min(...rs), maxR = Math.max(...rs);
    const w = maxQ - minQ + 1;
    const h = maxR - minR + 1;
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = `repeat(${w}, 14px)`;
    wrap.style.gridTemplateRows = `repeat(${h}, 14px)`;
    wrap.style.gap = "2px";
    const set = new Set(cells.map(([q, r]) => `${q},${r}`));
    for (let r = minR; r <= maxR; r += 1) {
      for (let q = minQ; q <= maxQ; q += 1) {
        const cell = document.createElement("div");
        cell.className = "mini-cell" + (set.has(`${q},${r}`) ? " filled" : " empty");
        wrap.appendChild(cell);
      }
    }
    return wrap;
  }

  // ------------------------------------------------------------ 关卡列表

  function buildLevels() {
    el.levelsBody.innerHTML = "";
    // 章节标题
    for (let ch = 1; ch <= 4; ch += 1) {
      const head = document.createElement("div");
      head.className = "chapter-head";
      head.textContent = strings[`ch${ch}_title`];
      el.levelsBody.appendChild(head);
      const row = document.createElement("div");
      row.className = "level-row";
      for (let i = 0; i < 6; i += 1) {
        const id = (ch - 1) * 6 + i + 1;
        const card = document.createElement("button");
        card.className = "level-card";
        card.innerHTML = `<span class="lc-num">${id}</span>`;
        card.addEventListener("click", () => handlers.onLevelPick?.(id));
        row.appendChild(card);
      }
      el.levelsBody.appendChild(row);
    }
  }

  function showResult(result) {
    el.resultBody.innerHTML = "";
    if (result.mode === "campaign") {
      el.resultTitle.textContent = result.goalMet ? strings.resultWin : strings.resultLose;
      addRow(strings.resultRows, String(result.rowsCleared));
      addRow(strings.resultScore, String(Math.round(result.score)));
      addRow(strings.resultMaxMult, `×${result.maxMultiplier}`);
      if (result.goalMet) {
        addRow(strings.btnAgain, "★".repeat(result.stars) + "☆".repeat(3 - result.stars));
      }
      el.btnNext.classList.toggle("hidden", !(result.goalMet && result.levelId < 24));
    } else if (result.mode === "duel") {
      el.resultTitle.textContent = result.winner === 1 ? strings.resultP1 : result.winner === 2 ? strings.resultP2 : strings.resultTie;
      addRow(strings.resultRows, String(result.rowsCleared));
      addRow(strings.resultScore, String(Math.round(result.score)));
      el.btnNext.classList.add("hidden");
    } else {
      el.resultTitle.textContent = strings.resultTitle;
      addRow(strings.resultScore, String(Math.round(result.score)));
      addRow(strings.resultRows, String(result.rowsCleared));
      addRow(strings.resultMaxMult, `×${result.maxMultiplier}`);
      el.btnNext.classList.add("hidden");
    }
    showOverlay(el.panelResult);
  }

  function addRow(label, value) {
    const row = document.createElement("div");
    row.className = "rr";
    row.innerHTML = `<span>${label}</span><b>${value}</b>`;
    el.resultBody.appendChild(row);
  }

  return {
    el,
    applyStrings,
    setSoundIcon,
    render,
    syncSize,
    toast,
    buildLevels,
    showResult,
    showLevels: openLevels,
    hideAllOverlays,
  };
}
