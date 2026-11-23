// unravel ui — the only layer that touches DOM/SVG. Renders the yarn workshop:
// a single warm wooden bench with the tangled object on a loom, spool heads in
// an arc below it, and a recessed slot rack at the bottom.

import { freeStrands, pathD, STAGE } from "./engine.mjs";
import { getLang, htmlLang, setLang, translate } from "./i18n.mjs";

const COLOR_HEX = {
  red: "#d9534f",
  amber: "#e2a23c",
  teal: "#3aa79d",
  indigo: "#5f6fc4",
  rose: "#d16b9f",
  moss: "#7ca24f",
};

const $ = (id) => document.getElementById(id);

function el(id) {
  const node = $(id);
  if (!node) throw new Error(`unravel: missing #${id}`);
  return node;
}

function yarnVars(strand) {
  const a = COLOR_HEX[strand.color] || "#999";
  if (!strand.dual) return `--yarn:${a}`;
  return `--yarn:${a};--yarn2:${COLOR_HEX[strand.dual] || "#999"}`;
}

function starsDots(n) {
  let html = "";
  for (let i = 0; i < 3; i++) {
    html += `<span class="star-dot${i < n ? " lit" : ""}"></span>`;
  }
  return html;
}

function silhouetteSvg(object) {
  const shadow = '<ellipse class="sil-shadow" cx="50" cy="55.5" rx="27" ry="3.6"></ellipse>';
  if (object === "sweater") {
    return `${shadow}
      <g class="sil">
        <path d="M38 15 L62 15 Q70 15 74 21 L83 34 Q85 38 81 41 L74 44 L70 38 L70 50 Q70 55 65 55 L35 55 Q30 55 30 50 L30 38 L26 44 L19 41 Q15 38 17 34 L26 21 Q30 15 38 15 Z"></path>
        <path class="sil-line" d="M43 15 Q50 21 57 15"></path>
        <path class="sil-line" d="M35 49 L65 49"></path>
        <path class="sil-line" d="M35 52 L65 52"></path>
      </g>`;
  }
  if (object === "doll") {
    return `${shadow}
      <g class="sil">
        <circle cx="50" cy="20" r="9"></circle>
        <path d="M50 29 Q64 31 64 43 L64 52 Q64 56 60 56 L40 56 Q36 56 36 52 L36 43 Q36 31 50 29 Z"></path>
        <circle class="sil-line-fill" cx="30" cy="42" r="5"></circle>
        <circle class="sil-line-fill" cx="70" cy="42" r="5"></circle>
        <path class="sil-line" d="M44 52 L56 52"></path>
      </g>`;
  }
  if (object === "garden") {
    return `${shadow}
      <g class="sil">
        <path class="sil-stem" d="M38 55 Q36 44 40 36"></path>
        <path class="sil-stem" d="M55 55 Q56 42 52 30"></path>
        <path class="sil-stem" d="M68 55 Q70 46 66 40"></path>
        <g class="sil-flower"><circle cx="40" cy="30" r="4"></circle><circle cx="35.5" cy="26.5" r="3.4"></circle><circle cx="44.5" cy="26.5" r="3.4"></circle><circle cx="37.2" cy="23.5" r="3.4"></circle><circle cx="42.8" cy="23.5" r="3.4"></circle></g>
        <g class="sil-flower"><circle cx="52" cy="22" r="4"></circle><circle cx="47.5" cy="18.5" r="3.4"></circle><circle cx="56.5" cy="18.5" r="3.4"></circle><circle cx="49.2" cy="15.5" r="3.4"></circle><circle cx="54.8" cy="15.5" r="3.4"></circle></g>
        <g class="sil-flower"><circle cx="66" cy="35" r="4"></circle><circle cx="61.5" cy="31.5" r="3.4"></circle><circle cx="70.5" cy="31.5" r="3.4"></circle><circle cx="63.2" cy="28.5" r="3.4"></circle><circle cx="68.8" cy="28.5" r="3.4"></circle></g>
        <path class="sil-line" d="M60 52 Q64 49 68 52"></path>
      </g>`;
  }
  return `${shadow}
    <g class="sil">
      <circle cx="50" cy="30" r="23"></circle>
      <path class="sil-line" d="M30 24 Q50 12 68 26"></path>
      <path class="sil-line" d="M27 34 Q50 44 73 30"></path>
      <path class="sil-line" d="M36 47 Q52 55 66 44"></path>
    </g>`;
}

function strandSvg(strand) {
  const d = pathD(strand.path);
  const vars = yarnVars(strand);
  const dualPaths = strand.dual
    ? `<path class="s-core" d="${d}" pathLength="100" style="stroke:${COLOR_HEX[strand.color]};stroke-dasharray:6 6"></path>
       <path class="s-core" d="${d}" pathLength="100" style="stroke:${COLOR_HEX[strand.dual]};stroke-dasharray:6 6;stroke-dashoffset:6"></path>`
    : `<path class="s-core" d="${d}" pathLength="100"></path>`;
  return `<g class="strand" data-id="${strand.id}" style="${vars}">
    <path class="s-under" d="${d}" pathLength="100"></path>
    ${dualPaths}
    <path class="s-sheen" d="${d}" pathLength="100"></path>
  </g>`;
}

function spoolButton(strand, state, kind, freeIndex) {
  const untied = !!state.untied[strand.id];
  const knotted = strand.knot && !untied;
  const colorName = translate(`color_${strand.color}`);
  let stateKey = "spoolFree";
  if (kind === "blocked") stateKey = "spoolBlocked";
  else if (knotted) stateKey = "spoolKnot";
  const aria = translate("spoolAria", { color: colorName, state: translate(stateKey) });
  const classes = ["spool"];
  if (kind === "collected") classes.push("is-emptied");
  else if (kind === "blocked") classes.push("is-blocked");
  else classes.push("is-free");
  if (knotted) classes.push("is-knotted");
  const badge = knotted ? '<span class="spool-knot"></span>' : "";
  const num = kind === "free" && freeIndex >= 0 && freeIndex < 9
    ? `<span class="spool-num">${freeIndex + 1}</span>`
    : "";
  const disabled = kind === "collected" || kind === "blocked" ? "disabled" : "";
  return `<button type="button" class="${classes.join(" ")}" data-id="${strand.id}"
    style="${yarnVars(strand)}" aria-label="${aria}" ${disabled}>
    <span class="spool-disc"></span>${badge}${num}</button>`;
}

function chipHtml(chip) {
  const strand = { color: chip, dual: null };
  return `<span class="chip" style="${yarnVars(strand)}"></span>`;
}

export function colorHexOf(color) {
  return COLOR_HEX[color] || "#999";
}

export function createUi(hooks) {
  const refs = {};
  let board = null;
  let state = null;
  let undoCountVal = 0;
  let timerText = "";
  let toastTimer = null;

  function cache() {
    refs.title = $("stage-title");
    refs.modeChip = $("hud-mode");
    refs.hudLevel = $("hud-level");
    refs.hudTime = $("hud-time");
    refs.hudUndos = $("hud-undos");
    refs.hudSlots = $("hud-slots");
    refs.stage = $("yarn-stage");
    refs.float = $("float-layer");
    refs.spoolArc = $("spool-arc");
    refs.slotRack = $("slot-rack");
    refs.toast = $("toast");
    refs.endOverlay = $("end-overlay");
    refs.endPanel = $("end-panel");
    refs.endTitle = $("end-title");
    refs.endStars = $("end-stars");
    refs.endStats = $("end-stats");
    refs.endActions = $("end-actions");
    refs.drawer = $("levels-drawer");
    refs.drawerBody = $("levels-body");
    refs.help = $("help-modal");
    refs.btnLang = $("btn-lang");
    refs.btnSound = $("btn-sound");
    refs.btnMode = $("btn-mode");
  }

  function applyStaticText() {
    const lang = getLang();
    document.documentElement.lang = htmlLang(lang);
    document.title = translate("docTitle");
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = translate(node.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      node.setAttribute("aria-label", translate(node.getAttribute("data-i18n-aria")));
    });
    if (refs.btnLang) refs.btnLang.textContent = lang === "en" ? "中文" : "EN";
    if (refs.btnSound) {
      refs.btnSound.textContent = hooks.soundMuted() ? "🔇" : "🔊";
    }
  }

  function renderBoard() {
    if (!board || !refs.stage) return;
    const strands = board.strands.slice().sort((a, b) => b.layer - a.layer);
    refs.stage.innerHTML = `${silhouetteSvg(board.object)}${strands.map(strandSvg).join("")}`;
    renderState();
  }

  function renderSpools() {
    if (!board || !state) return;
    const ordered = board.strands.slice().sort((a, b) => a.layer - b.layer);
    const freeIds = new Set(freeStrands(board, state).map((s) => s.id));
    let freeIndex = 0;
    const n = ordered.length;
    const parts = ordered.map((strand, i) => {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const arcY = (-20 * Math.sin(Math.PI * t)).toFixed(1);
      let kind;
      let idx = -1;
      if (state.collected.includes(strand.id)) {
        kind = "collected";
      } else if (!freeIds.has(strand.id)) {
        kind = "blocked";
      } else if (strand.knot && !state.untied[strand.id]) {
        kind = "knot";
      } else {
        kind = "free";
        idx = freeIndex++;
      }
      return spoolButton(strand, state, kind, idx).replace(
        "<button ",
        `<button data-arc="${arcY}" `,
      );
    });
    refs.spoolArc.innerHTML = parts.join("");
    refs.spoolArc.querySelectorAll(".spool").forEach((node) => {
      node.style.setProperty("--arc-y", `${node.dataset.arc}px`);
      node.addEventListener("click", () => onSpoolClick(node.dataset.id, node));
    });
  }

  function onSpoolClick(id, node) {
    const strand = board.strands.find((s) => s.id === id);
    if (!strand || state.collected.includes(id)) return;
    const free = freeStrands(board, state).some((s) => s.id === id);
    if (!free) {
      node.classList.remove("shake");
      void node.offsetWidth;
      node.classList.add("shake");
      hooks.reject();
      return;
    }
    if (strand.knot && !state.untied[id]) {
      hooks.untie(id);
      return;
    }
    hooks.collect(id);
  }

  function renderSlots() {
    if (!board || !state) return;
    if (board.mode === "relax") {
      refs.slotRack.classList.add("is-relax");
      refs.slotRack.innerHTML = state.slots.map(chipHtml).join("");
      refs.slotRack.scrollTop = refs.slotRack.scrollHeight;
    } else {
      refs.slotRack.classList.remove("is-relax");
      let html = "";
      for (let i = 0; i < board.cap; i++) {
        const chip = state.slots[i];
        html += `<span class="slot-cell${chip ? " filled" : ""}">${chip ? chipHtml(chip) : ""}</span>`;
      }
      refs.slotRack.innerHTML = html;
    }
  }

  function renderHud() {
    if (!state || !refs.hudLevel) return;
    refs.hudLevel.textContent = state.mode === "relax"
      ? translate("hudRelax")
      : translate("hudLevel", { n: state.id });
    refs.hudUndos.textContent = translate("hudUndos", { n: undoCountVal });
    refs.hudSlots.textContent = translate("hudSlots", {
      n: state.slots.length,
      c: state.cap > 9 ? "∞" : state.cap,
    });
    refs.hudTime.textContent = timerText;
    if (refs.modeChip) refs.modeChip.textContent = translate(state.mode === "relax" ? "modeRelax" : "modeLevel");
    if (refs.btnMode) refs.btnMode.textContent = translate(state.mode === "relax" ? "btnLevel" : "btnRelax");
  }

  function renderState() {
    if (!board || !state || !refs.stage || !refs.spoolArc || !refs.slotRack) return;
    const strands = board.strands.slice().sort((a, b) => b.layer - a.layer);
    for (const strand of strands) {
      const node = refs.stage.querySelector(`.strand[data-id="${strand.id}"]`);
      if (node && state.collected.includes(strand.id)) node.classList.add("is-pulled");
    }
    renderSpools();
    renderSlots();
    renderHud();
  }

  function chipFly(id, chips) {
    if (!refs.spoolArc || !refs.slotRack) return;
    const spool = refs.spoolArc.querySelector(`.spool[data-id="${id}"]`);
    if (!spool || !chips.length) return;
    const from = spool.getBoundingClientRect();
    const rack = refs.slotRack.getBoundingClientRect();
    chips.forEach((chip, i) => {
      const node = document.createElement("span");
      node.className = "chip fly";
      node.style.setProperty("--yarn", colorHexOf(chip));
      node.style.left = `${from.left + from.width / 2}px`;
      node.style.top = `${from.top + from.height / 2}px`;
      const targetX = rack.left + Math.min(rack.width - 18, (state.slots.length - chips.length + i + 1) * 40);
      document.body.appendChild(node);
      requestAnimationFrame(() => {
        node.style.transform = `translate(${targetX - from.left - from.width / 2}px, ${rack.top - from.top}px) scale(0.5)`;
        node.style.opacity = "0.15";
      });
      setTimeout(() => node.remove(), 480);
    });
  }

  function rollBall(color, big) {
    if (!refs.float) return;
    const node = document.createElement("span");
    node.className = big ? "roll-ball big" : "roll-ball";
    node.style.setProperty("--yarn", colorHexOf(color));
    refs.float.appendChild(node);
    setTimeout(() => node.remove(), 1900);
  }

  function onEvent(event) {
    if (!event || !refs.stage) return;
    if (event.type === "collect") {
      const node = refs.stage.querySelector(`.strand[data-id="${event.id}"]`);
      if (node) node.classList.add("is-pulled");
      chipFly(event.id, event.chips);
      if (event.merges && event.merges.length) {
        refs.slotRack.classList.remove("merged");
        void refs.slotRack.offsetWidth;
        refs.slotRack.classList.add("merged");
        const mergeColor = event.merges[event.merges.length - 1].color;
        rollBall(mergeColor, false);
      }
      if (event.completed && event.completed.length) {
        rollBall(event.completed[event.completed.length - 1], true);
      }
      renderState();
      if (event.status === "won") {
        refs.stage.classList.add("unraveled");
      }
    } else if (event.type === "untie") {
      renderState();
    } else if (event.type === "undo") {
      refs.stage.classList.remove("unraveled");
      renderState();
    }
  }

  function showEnd(kind, payload) {
    if (!refs.endPanel) return;
    const isWin = kind === "won";
    const isRelax = kind === "relax";
    refs.endStars.innerHTML = isWin ? starsDots(payload.stars || 0) : "";
    refs.endTitle.textContent = translate(isWin ? "winTitle" : isRelax ? "winRelaxTitle" : "loseTitle");
    let stats = "";
    if (isWin || isRelax) {
      stats = `<div class="end-stat"><span>${translate("statTime")}</span><b>${payload.timeText}</b></div>
        <div class="end-stat"><span>${translate("statUndos")}</span><b>${payload.undos}</b></div>
        <div class="end-stat"><span>${translate("statPeak")}</span><b>${payload.peak}</b></div>`;
    } else {
      stats = `<p class="end-body">${translate("loseBody")}</p>`;
    }
    refs.endStats.innerHTML = stats;
    let actions = "";
    if (isWin) {
      actions = `<button type="button" id="end-next" class="bench-btn primary" data-i18n="btnNext">${translate("btnNext")}</button>
        <button type="button" id="end-replay" class="bench-btn" data-i18n="btnReplay">${translate("btnReplay")}</button>
        <button type="button" id="end-levels" class="bench-btn" data-i18n="btnLevels">${translate("btnLevels")}</button>`;
    } else if (isRelax) {
      actions = `<button type="button" id="end-next" class="bench-btn primary" data-i18n="btnStart">${translate("btnStart")}</button>
        <button type="button" id="end-levels" class="bench-btn" data-i18n="btnLevels">${translate("btnLevels")}</button>`;
    } else {
      actions = `<button type="button" id="end-replay" class="bench-btn primary" data-i18n="btnRestart">${translate("btnRestart")}</button>
        <button type="button" id="end-undo" class="bench-btn" data-i18n="btnUndo">${translate("btnUndo")}</button>`;
    }
    refs.endActions.innerHTML = actions;
    refs.endOverlay.classList.add("open");
    const next = $("end-next");
    const replay = $("end-replay");
    const levels = $("end-levels");
    const undoBtn = $("end-undo");
    if (next) next.addEventListener("click", hooks.next);
    if (replay) replay.addEventListener("click", hooks.replay);
    if (levels) levels.addEventListener("click", hooks.openLevels);
    if (undoBtn) undoBtn.addEventListener("click", hooks.undoFromEnd);
  }

  function hideEnd() {
    if (refs.endOverlay) refs.endOverlay.classList.remove("open");
  }

  function renderLevels(currentId, unlockedMax, stars) {
    if (!refs.drawerBody) return;
    const sections = [1, 2, 3, 4].map((ch) => {
      const levels = [];
      for (let i = (ch - 1) * 10 + 1; i <= ch * 10; i++) {
        const locked = i > unlockedMax;
        const starCount = stars[i] || 0;
        const classes = ["level-card"];
        if (locked) classes.push("locked");
        if (i === currentId) classes.push("current");
        levels.push(`<button type="button" class="${classes.join(" ")}" data-level="${i}" ${locked ? "disabled" : ""}
          aria-label="${translate("levelNum", { n: i })}${locked ? " · " + translate("levelLocked") : ""}">
          <b>${i}</b><span class="lvl-stars">${starsDots(starCount)}</span></button>`);
      }
      return `<h3 class="drawer-chapter" data-i18n="chapter${ch}">${translate(`chapter${ch}`)}</h3>
        <div class="level-grid">${levels.join("")}</div>`;
    });
    refs.drawerBody.innerHTML = sections.join("");
    refs.drawerBody.querySelectorAll(".level-card").forEach((node) => {
      node.addEventListener("click", () => hooks.selectLevel(Number(node.dataset.level)));
    });
  }

  function showLevels() {
    if (refs.drawer) refs.drawer.classList.add("open");
  }

  function hideLevels() {
    if (refs.drawer) refs.drawer.classList.remove("open");
  }

  function showHelp() {
    if (refs.help) refs.help.classList.add("open");
  }

  function hideHelp() {
    if (refs.help) refs.help.classList.remove("open");
  }

  function toast(key) {
    if (!refs.toast) return;
    refs.toast.textContent = translate(key);
    refs.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => refs.toast.classList.remove("show"), 1800);
  }

  function glowHint(hintData) {
    if (!hintData || !refs.stage) return;
    const spool = refs.spoolArc.querySelector(`.spool[data-id="${hintData.id}"]`);
    const strand = refs.stage.querySelector(`.strand[data-id="${hintData.id}"]`);
    for (const node of [spool, strand]) {
      if (!node) continue;
      node.classList.remove("hint-glow");
      void node.offsetWidth;
      node.classList.add("hint-glow");
      setTimeout(() => node.classList.remove("hint-glow"), 2200);
    }
  }

  function setTimerText(text) {
    timerText = text;
    if (refs.hudTime) refs.hudTime.textContent = text;
  }

  function toggleLang() {
    setLang(getLang() === "en" ? "zh" : "en");
    applyStaticText();
    if (refs.stage) renderState();
    if (refs.drawer && refs.drawer.classList.contains("open") && board) {
      hooks.refreshLevels();
    }
  }

  function bind() {
    $("btn-levels").addEventListener("click", hooks.openLevels);
    $("drawer-close").addEventListener("click", hooks.closeLevels);
    $("help-close").addEventListener("click", hooks.closeHelp);
    $("btn-help").addEventListener("click", hooks.openHelp);
    $("btn-undo").addEventListener("click", hooks.undo);
    $("btn-hint").addEventListener("click", hooks.hint);
    $("btn-restart").addEventListener("click", hooks.restart);
    $("btn-mode").addEventListener("click", hooks.toggleMode);
    refs.btnLang.addEventListener("click", () => {
      toggleLang();
      hooks.afterLangChange();
    });
    refs.btnSound.addEventListener("click", hooks.toggleSound);
    refs.endOverlay.addEventListener("click", (e) => {
      if (e.target === refs.endOverlay) hooks.closeEnd();
    });
    $("drawer-close").textContent = translate("btnClose");
  }

  function init(payload) {
    board = payload.board;
    state = payload.state;
    cache();
    bind();
    applyStaticText();
    renderBoard();
  }

  return {
    init,
    setContext(nextBoard, nextState, undoCount) {
      const boardChanged = !board || board !== nextBoard;
      board = nextBoard;
      state = nextState;
      if (undoCount !== undefined) undoCountVal = undoCount;
      if (!refs.stage) return;
      if (boardChanged) {
        refs.stage.classList.remove("unraveled");
        renderBoard();
      } else {
        renderState();
      }
    },
    onEvent,
    showEnd,
    hideEnd,
    renderLevels,
    showLevels,
    hideLevels,
    showHelp,
    hideHelp,
    toast,
    glowHint,
    setTimerText,
    applyStaticText,
    toggleLang,
    refreshState: renderState,
    isDrawerOpen: () => !!refs.drawer && refs.drawer.classList.contains("open"),
  };
}
