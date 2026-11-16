// ui.mjs - board geometry (pure) + DOM/SVG rendering (the only DOM layer).
// The star board is SVG: 121 holes, 20 glass marbles, target halos and a
// single flyer that walks the whole chain-hop path in one click.

import {
  HOLES, HOLE_COUNT, RED, BLUE, RED_HOME, BLUE_HOME,
} from "./engine.mjs";
import { MODES } from "./game.mjs";
import { htmlLang, lookup, strings, translate } from "./i18n.mjs";
import { PUZZLES, CHAPTERS } from "./puzzles.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

export const STEP = 34;
export const HOLE_R = 12;
export const MARBLE_R = 10.5;
export const VIEW_BOX = Object.freeze({ x: -300, y: -300, w: 600, h: 600 });
export const STAR_OUTER = 278;
export const STAR_INNER = 165;

// Standard cube-to-pixel projection. Every one of the six unit directions
// lands exactly STEP pixels away, so holes never collide visually.
export function project(cube) {
  return [STEP * (cube[0] + cube[2] / 2), STEP * (Math.sqrt(3) / 2) * cube[2]];
}

export const POSITIONS = Object.freeze(HOLES.map((c) => Object.freeze(project(c))));

export function holePosition(id) {
  return Number.isInteger(id) && id >= 0 && id < HOLE_COUNT ? POSITIONS[id] : null;
}

export function starPoints(outer = STAR_OUTER, inner = STAR_INNER) {
  const pts = [];
  for (let k = 0; k < 6; k += 1) {
    const tip = ((-90 + k * 60) * Math.PI) / 180;
    const notch = ((-60 + k * 60) * Math.PI) / 180;
    pts.push([outer * Math.cos(tip), outer * Math.sin(tip)]);
    pts.push([inner * Math.cos(notch), inner * Math.sin(notch)]);
  }
  return pts;
}

export function starPolygon(outer = STAR_OUTER, inner = STAR_INNER) {
  return starPoints(outer, inner).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

export function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function classifyTarget(move) {
  if (!move || !move.hops) return "step";
  return move.hops >= 2 ? "grand" : "hop";
}

// A quadratic arc bowing toward the top of the board (smaller y).
export function arcGeometry(fromId, toId, lift = 16) {
  const a = holePosition(fromId);
  const b = holePosition(toId);
  if (!a || !b) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const sign = ny <= 0 ? 1 : -1;
  const amount = Math.max(0, lift);
  return {
    a,
    b,
    c: [(a[0] + b[0]) / 2 + nx * amount * sign, (a[1] + b[1]) / 2 + ny * amount * sign],
  };
}

// One SVG path for the whole chain: M start, then one Q per hop.
export function chainPath(move, lift = 16) {
  const path = move && Array.isArray(move.path) ? move.path : [];
  if (path.length < 2) return "";
  const [x0, y0] = holePosition(path[0]) || [0, 0];
  let d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`;
  for (let i = 1; i < path.length; i += 1) {
    const g = arcGeometry(path[i - 1], path[i], lift + (i - 1) * 3);
    if (!g) return "";
    d += ` Q ${g.c[0].toFixed(2)} ${g.c[1].toFixed(2)} ${g.b[0].toFixed(2)} ${g.b[1].toFixed(2)}`;
  }
  return d;
}

export function nearestHole(x, y, maxDist = STEP * 0.62) {
  let best = -1;
  let bestDist = maxDist;
  for (let i = 0; i < HOLE_COUNT; i += 1) {
    const d = Math.hypot(POSITIONS[i][0] - x, POSITIONS[i][1] - y);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

const RED_HOME_SET = new Set(RED_HOME);
const BLUE_HOME_SET = new Set(BLUE_HOME);

function sideKey(player) {
  return player === BLUE ? "blue" : "red";
}

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function textFor(locale, key) {
  const dot = key.indexOf(".");
  if (dot > 0) return lookup(locale, key.slice(0, dot), key.slice(dot + 1));
  return translate(locale, key);
}

export function createUi(options = {}) {
  const doc = options.doc ?? globalThis.document;
  const controller = options.controller;
  const onAction = options.onAction ?? (() => {});
  const onSfx = options.onSfx ?? (() => {});
  const $ = (id) => doc.getElementById(id);

  const svg = $("board");
  const holeLayer = $("hole-layer");
  const targetLayer = $("target-layer");
  const trailLayer = $("trail-layer");
  const marbleLayer = $("marble-layer");
  const flyerLayer = $("flyer-layer");

  let locale = "zh";
  let selected = null;
  let targets = new Map();
  let animating = false;
  let overlay = "none";
  let lastView = null;
  let lastResult = null;
  let lastBest = null;
  let lastProgress = null;
  let lastPly = null;
  let toastTimer = null;
  let bannerTimer = null;

  function reducedMotion() {
    try {
      return Boolean(doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    } catch {
      return false;
    }
  }

  function isPuzzle(view) {
    return view?.config?.mode === MODES.PUZZLE;
  }

  function hintKey() {
    return isPuzzle(lastView) ? "puzzleHint" : "hintSelect";
  }

  function buildBoard() {
    $("star-plate").setAttribute("points", starPolygon());
    $("star-inlay").setAttribute("points", starPolygon(STAR_OUTER - 10, STAR_INNER - 7));
    holeLayer.replaceChildren();
    for (let i = 0; i < HOLE_COUNT; i += 1) {
      const [x, y] = POSITIONS[i];
      let cls = "hole";
      if (RED_HOME_SET.has(i)) cls += " home-red";
      else if (BLUE_HOME_SET.has(i)) cls += " home-blue";
      holeLayer.appendChild(svgEl("circle", { class: cls, cx: x, cy: y, r: HOLE_R, "data-hole": i }));
    }
  }

  function marbleNode(player, hole) {
    const [x, y] = POSITIONS[hole];
    const g = svgEl("g", { class: "marble", transform: `translate(${x} ${y})`, "data-hole": hole });
    if (player === BLUE) g.classList.add("is-blue");
    g.appendChild(svgEl("circle", { class: "marble-glow", r: 17, fill: "url(#gold-glow)" }));
    const shell = svgEl("g", { class: "marble-shell" });
    shell.appendChild(svgEl("circle", {
      class: "marble-body", r: MARBLE_R,
      fill: player === RED ? "url(#red-glass)" : "url(#blue-glass)",
    }));
    shell.appendChild(svgEl("ellipse", {
      cx: -3.2, cy: -4.2, rx: 3.3, ry: 2.1, fill: "rgba(255,255,255,0.72)",
    }));
    shell.appendChild(svgEl("circle", {
      r: MARBLE_R, fill: "none", stroke: "rgba(255,255,255,0.24)", "stroke-width": 1,
    }));
    g.appendChild(shell);
    return g;
  }

  function renderMarbles(view) {
    const board = view.state?.board ?? [];
    const nodes = [];
    for (let i = 0; i < HOLE_COUNT; i += 1) {
      if (board[i] === RED || board[i] === BLUE) nodes.push(marbleNode(board[i], i));
    }
    marbleLayer.replaceChildren(...nodes);
    if (selected !== null) {
      const node = marbleLayer.querySelector(`[data-hole="${selected}"]`);
      if (node) node.classList.add("is-selected");
    }
  }

  function clearTrail() { trailLayer.replaceChildren(); }

  function renderTrail(move) {
    clearTrail();
    const d = chainPath(move);
    if (!d) return;
    trailLayer.appendChild(svgEl("path", { class: "trail", d }));
  }

  function renderTargets() {
    targetLayer.replaceChildren();
    for (const move of targets.values()) {
      const [x, y] = POSITIONS[move.to];
      const kind = classifyTarget(move);
      const g = svgEl("g", {
        class: `target is-${kind}`,
        transform: `translate(${x} ${y})`,
        "data-hole": move.to,
        "data-target": 1,
      });
      g.appendChild(svgEl("circle", { class: "target-halo", r: 20 }));
      g.appendChild(svgEl("circle", { class: "target-ring", r: HOLE_R + 2 }));
      targetLayer.appendChild(g);
    }
  }

  function renderGoal(view) {
    for (const node of holeLayer.querySelectorAll(".is-goal")) node.classList.remove("is-goal");
    const goal = view?.puzzle?.goal;
    if (!Number.isInteger(goal)) return;
    const node = holeLayer.querySelector(`[data-hole="${goal}"]`);
    if (node) node.classList.add("is-goal");
  }

  function renderPuzzleHud(view) {
    const on = isPuzzle(view);
    $("puzzle-info").hidden = !on;
    $("ticks-row").hidden = on;
    if (!on) return;
    const info = view.puzzle;
    $("puzzle-level").textContent = String(info.id);
    $("puzzle-par").textContent = String(info.par);
    $("puzzle-left").textContent = String(info.left);
    if (selected === null) $("hint").textContent = textFor(locale, hintKey());
  }

  function renderLevels(progress, currentId) {
    const cleared = progress?.cleared ?? {};
    $("level-progress").textContent = translate(locale, "puzzleProgress", {
      n: progress?.clearedCount ?? 0,
      total: PUZZLES.length,
      stars: progress?.totalStars ?? 0,
    });
    const nodes = [];
    for (const chapter of CHAPTERS) {
      const head = doc.createElement("h3");
      head.className = "level-chapter";
      head.textContent = lookup(locale, "chapter", chapter.id);
      nodes.push(head);
      for (const level of PUZZLES.filter((item) => item.chapter === chapter.id)) {
        const stars = cleared[level.id] ?? 0;
        const btn = doc.createElement("button");
        btn.className = "level-btn";
        if (stars) btn.classList.add("is-cleared");
        if (level.id === currentId) btn.classList.add("is-current");
        btn.setAttribute("type", "button");
        btn.setAttribute("data-level", String(level.id));
        const num = doc.createElement("span");
        num.className = "level-num";
        num.textContent = String(level.id).padStart(2, "0");
        const star = doc.createElement("span");
        star.className = "level-stars";
        star.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
        const par = doc.createElement("span");
        par.className = "level-par";
        par.textContent = `${textFor(locale, "puzzlePar")} ${level.par}`;
        btn.appendChild(num);
        btn.appendChild(star);
        btn.appendChild(par);
        nodes.push(btn);
      }
    }
    $("level-grid").replaceChildren(...nodes);
  }

  function showLevels(progress) {
    lastProgress = progress ?? { cleared: {}, clearedCount: 0, totalStars: 0 };
    renderLevels(lastProgress, lastView?.puzzle?.id);
    setOverlay("levels");
  }

  function hideLevels() {
    if (overlay === "levels") setOverlay("none");
  }

  function renderProgress(progress) {
    if (progress) lastProgress = progress;
    if (overlay === "levels") renderLevels(lastProgress, lastView?.puzzle?.id);
  }

  function clearSelection() {
    selected = null;
    targets = new Map();
    targetLayer.replaceChildren();
    clearTrail();
    for (const node of marbleLayer.querySelectorAll(".is-selected")) node.classList.remove("is-selected");
    $("hint").textContent = textFor(locale, hintKey());
  }

  function selectHole(hole) {
    const moves = controller.targetsFrom(hole);
    if (!moves.length) return false;
    clearSelection();
    selected = hole;
    targets = new Map(moves.map((m) => [m.to, m]));
    renderTargets();
    const node = marbleLayer.querySelector(`[data-hole="${hole}"]`);
    if (node) node.classList.add("is-selected");
    $("hint").textContent = textFor(locale, "hintTarget");
    return true;
  }

  function flyerNode(player, hole) {
    const node = marbleNode(player, hole);
    node.removeAttribute("transform");
    node.removeAttribute("data-hole");
    node.setAttribute("class", reducedMotion() ? "flyer is-instant" : "flyer");
    node.style.transform = `translate(${POSITIONS[hole][0]}px, ${POSITIONS[hole][1]}px)`;
    return node;
  }

  // The animation plays BEFORE controller.play(), so the board still shows the
  // starting position while the marble flies. Input is locked for the whole
  // flight; the only exit is the tail of this function.
  async function animateMove(move, player) {
    animating = true;
    clearSelection();
    const instant = reducedMotion();
    const hops = Math.max(1, move.path.length - 1);
    const ms = instant ? 0 : (move.hops ? 165 : 130);
    if (instant) {
      onSfx(move.hops ? "land" : "step");
      animating = false; // release the render guard BEFORE the commit emits
      controller.play(move);
      return;
    }

    const origin = marbleLayer.querySelector(`[data-hole="${move.from}"]`);
    if (origin) origin.style.opacity = "0";
    const flyer = flyerNode(player, move.from);
    flyerLayer.replaceChildren(flyer);
    await wait(20); // let the browser commit the starting transform

    for (let i = 0; i < hops; i += 1) {
      const to = move.path[i + 1];
      const [x, y] = POSITIONS[to];
      onSfx(move.hops ? "hop" : "step", i);
      flyer.style.transform = `translate(${x}px, ${y}px)`;
      await wait(ms);
    }
    onSfx("land");
    flyerLayer.replaceChildren();
    animating = false;
    controller.play(move);
  }

  function onBoardClick(evt) {
    if (animating || overlay !== "none") return;
    const view = controller.view();
    if (!view.humanTurn) return;
    const node = evt.target && typeof evt.target.closest === "function"
      ? evt.target.closest("[data-hole]") : null;
    if (!node) return;
    const hole = Number(node.getAttribute("data-hole"));
    if (!Number.isInteger(hole)) return;

    if (selected !== null && targets.has(hole)) {
      const move = targets.get(hole);
      void animateMove(move, view.state.turn);
      return;
    }
    if (view.state.board[hole] === view.state.turn && selectHole(hole)) {
      onSfx("select");
      return;
    }
    if (selected !== null) {
      clearSelection();
      return;
    }
    onSfx("blocked");
  }

  function onBoardHover(evt) {
    if (animating || selected === null || overlay !== "none") return;
    const node = evt.target && typeof evt.target.closest === "function"
      ? evt.target.closest("[data-target]") : null;
    if (!node) {
      clearTrail();
      return;
    }
    const move = targets.get(Number(node.getAttribute("data-hole")));
    if (move) renderTrail(move);
  }

  function renderControls(view) {
    const config = view.config;
    if (!config) return;
    for (const btn of doc.querySelectorAll("[data-mode]")) {
      btn.classList.toggle("is-on", btn.getAttribute("data-mode") === config.mode);
    }
    for (const btn of doc.querySelectorAll("[data-difficulty]")) {
      btn.classList.toggle("is-on", btn.getAttribute("data-difficulty") === config.difficulty);
      btn.disabled = config.mode !== MODES.PVE;
    }
    for (const btn of doc.querySelectorAll("[data-side]")) {
      const side = btn.getAttribute("data-side") === "blue" ? BLUE : RED;
      btn.classList.toggle("is-on", side === config.humanSide);
      btn.disabled = config.mode !== MODES.PVE;
    }
    $("btn-undo").disabled = !view.canUndo;
  }

  function renderStats(view) {
    const s = view.stats ?? {};
    const turn = view.state?.turn ?? RED;
    const side = $("turn-side");
    side.textContent = textFor(locale, `side.${sideKey(turn)}`);
    side.classList.toggle("is-blue", turn === BLUE);
    $("red-camp").textContent = `${s.redInCamp ?? 0}/10`;
    $("blue-camp").textContent = `${s.blueInCamp ?? 0}/10`;
    $("red-bar").style.width = `${(s.redInCamp ?? 0) * 10}%`;
    $("blue-bar").style.width = `${(s.blueInCamp ?? 0) * 10}%`;
    $("plies-value").textContent = String(s.plies ?? 0);
    $("max-hops-value").textContent = String(s.maxHops ?? 0);
    $("thinking").hidden = !view.thinking;
    const progress = Array.isArray(view.thinkingProgress) ? view.thinkingProgress.length : 0;
    $("thinking-sub").textContent = progress
      ? `${textFor(locale, "thinkingSub")} · ${progress}`
      : textFor(locale, "thinkingSub");
  }

  function renderLog() {
    const log = controller.getMoveLog();
    const list = $("log-list");
    if (!log.length) {
      const li = doc.createElement("li");
      li.className = "log-empty";
      li.setAttribute("data-i18n", "logEmpty");
      li.textContent = textFor(locale, "logEmpty");
      list.replaceChildren(li);
      return;
    }
    const rows = log.slice(-18).map((m) => {
      const li = doc.createElement("li");
      if (m.hops > 0) li.className = "is-jump";
      const label = m.hops
        ? translate(locale, "logJump", { n: m.hops })
        : translate(locale, "logStep");
      li.textContent = `#${m.ply} ${label}`;
      return li;
    });
    list.replaceChildren(...rows);
    list.scrollTop = list.scrollHeight;
  }

  function showBanner(n) {
    const node = $("hop-banner");
    node.textContent = translate(locale, "hopBanner", { n });
    node.hidden = false;
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      node.hidden = true;
      bannerTimer = null;
    }, 2400);
  }

  function render(view) {
    const prevPly = lastPly;
    lastPly = view.stats?.plies ?? 0;
    lastView = view;
    if (animating) return; // deferred until the flight finishes
    renderMarbles(view);
    renderGoal(view);
    renderControls(view);
    renderPuzzleHud(view);
    renderStats(view);
    renderLog();
    if (selected !== null) {
      if (!view.humanTurn || view.state.board[selected] !== view.state.turn) clearSelection();
      else {
        targets = new Map(controller.targetsFrom(selected).map((m) => [m.to, m]));
        renderTargets();
      }
    }
    renderRecords(lastBest);
    if (overlay === "levels") renderLevels(lastProgress, view.puzzle?.id);
    // Only a real ply advance triggers the banner. Locale switches and AI
    // progress emits reuse the same ply, so they never re-show it.
    if (prevPly !== null && lastPly > prevPly && view.stats?.lastHops >= 2) {
      showBanner(view.stats.lastHops);
    }
  }

  function renderRecords(meta) {
    lastBest = meta ?? null;
    const best = meta?.best ?? { wins: 0, fewestPlies: null, maxHops: 0 };
    $("best-wins").textContent = String(best.wins ?? 0);
    $("best-plies").textContent = best.fewestPlies ?? translate(locale, "noRecord");
    $("best-hops").textContent = String(best.maxHops ?? 0);
  }

  function applyLocale(next) {
    locale = next === "en" ? "en" : "zh";
    doc.documentElement.lang = htmlLang(locale);
    doc.title = textFor(locale, "docTitle");
    for (const node of doc.querySelectorAll("[data-i18n]")) {
      const key = node.getAttribute("data-i18n");
      if (key) node.textContent = textFor(locale, key);
    }
    for (const node of doc.querySelectorAll("[data-i18n-aria]")) {
      const key = node.getAttribute("data-i18n-aria");
      if (key) node.setAttribute("aria-label", textFor(locale, key));
    }
    $("btn-lang").textContent = strings[locale].langBtn;
    $("btn-lang").setAttribute("aria-label", textFor(locale, "langName"));
    if (lastView) {
      renderPuzzleHud(lastView);
      renderStats(lastView);
      renderLog();
      $("hint").textContent = selected !== null
        ? textFor(locale, "hintTarget") : textFor(locale, hintKey());
      renderRecords(lastBest);
    }
    if (overlay === "result" && lastResult) fillResult(lastResult, lastBest);
    if (overlay === "levels") renderLevels(lastProgress, lastView?.puzzle?.id);
  }

  function syncSound(on) {
    $("btn-sound").textContent = textFor(locale, on ? "soundOn" : "soundOff");
    $("btn-sound").setAttribute("aria-label", textFor(locale, "sound"));
  }

  function setOverlay(name) {
    overlay = name;
    $("help-panel").hidden = name !== "help";
    $("result-panel").hidden = name !== "result";
    $("level-panel").hidden = name !== "levels";
  }

  function showHelp() { setOverlay("help"); }
  function hideHelp() { if (overlay === "help") setOverlay("none"); }

  function fillResult(finished, meta) {
    const cfg = lastView?.config ?? {};
    const winner = finished.winner;
    const title = $("result-title");
    if (cfg.mode === MODES.PUZZLE) {
      const info = finished.puzzle ?? {};
      title.textContent = textFor(locale, info.solved ? "puzzleWinTitle" : "puzzleLoseTitle");
      $("result-line").textContent = translate(locale, "puzzleResultLine", {
        n: info.id, plies: finished.plies, stars: info.stars,
      });
      $("result-plies").textContent = String(finished.plies);
      $("result-hops").textContent = String(finished.maxHops);
      $("result-best").hidden = !meta?.improved;
      $("result-next").hidden = !info.solved;
      $("result-again").textContent = textFor(locale, "retryLevel");
      return;
    }
    $("result-next").hidden = true;
    $("result-again").textContent = textFor(locale, "playAgain");
    if (cfg.mode === "pvp") {
      title.textContent = translate(locale, "pvpWinTitle", {
        side: textFor(locale, `side.${sideKey(winner)}`),
      });
    } else {
      title.textContent = textFor(locale, finished.humanOutcome === "win" ? "winTitle" : "loseTitle");
    }
    $("result-line").textContent = translate(locale, "resultLine", {
      side: textFor(locale, `side.${sideKey(winner)}`),
      plies: finished.plies,
    });
    $("result-plies").textContent = String(finished.plies);
    $("result-hops").textContent = String(finished.maxHops);
    $("result-best").hidden = !meta?.improved;
  }

  function showResult(finished, meta) {
    lastResult = finished;
    lastBest = meta ?? null;
    fillResult(finished, meta);
    setOverlay("result");
    if (finished.humanOutcome === "win" || cfgIsPvp()) onSfx("win");
    else onSfx("lose");
  }

  function cfgIsPvp() {
    return lastView?.config?.mode === MODES.PVP;
  }

  function toast(text) {
    const node = $("toast");
    node.textContent = text;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      node.hidden = true;
      toastTimer = null;
    }, 1800);
  }

  function onKeydown(evt) {
    const key = typeof evt.key === "string" ? evt.key.toLowerCase() : "";
    if (key === "escape") {
      if (overlay === "help") hideHelp();
      else if (overlay === "levels") hideLevels();
      else clearSelection();
      return;
    }
    if (key === "z" && !evt.ctrlKey && !evt.metaKey && overlay === "none") onAction("undo");
  }

  function bind() {
    svg.addEventListener("click", onBoardClick);
    svg.addEventListener("pointerover", onBoardHover);
    doc.addEventListener("keydown", onKeydown);
    for (const btn of doc.querySelectorAll("[data-mode]")) {
      btn.addEventListener("click", () => onAction("mode", btn.getAttribute("data-mode")));
    }
    for (const btn of doc.querySelectorAll("[data-difficulty]")) {
      btn.addEventListener("click", () => onAction("difficulty", btn.getAttribute("data-difficulty")));
    }
    for (const btn of doc.querySelectorAll("[data-side]")) {
      btn.addEventListener("click", () => onAction("side", btn.getAttribute("data-side")));
    }
    $("btn-undo").addEventListener("click", () => onAction("undo"));
    $("btn-restart").addEventListener("click", () => onAction("restart"));
    $("btn-sound").addEventListener("click", () => onAction("sound"));
    $("btn-lang").addEventListener("click", () => onAction("lang"));
    $("btn-help").addEventListener("click", () => onAction("help"));
    $("help-close").addEventListener("click", () => onAction("closeHelp"));
    $("help-panel").addEventListener("click", (evt) => {
      if (evt.target === $("help-panel")) onAction("closeHelp");
    });
    $("result-again").addEventListener("click", () => onAction("again"));
    $("result-next").addEventListener("click", () => onAction("nextLevel"));
    $("level-close").addEventListener("click", () => onAction("closeLevels"));
    $("level-grid").addEventListener("click", (evt) => {
      const node = evt.target && typeof evt.target.closest === "function"
        ? evt.target.closest("[data-level]") : null;
      if (node) onAction("puzzle", node.getAttribute("data-level"));
    });
  }

  function start() {
    buildBoard();
    bind();
    const view = controller.view();
    render(view);
    return view;
  }

  return {
    start,
    render,
    applyLocale,
    syncSound,
    renderRecords,
    showResult,
    hideResult: () => { if (overlay === "result") setOverlay("none"); },
    showHelp,
    hideHelp,
    showLevels,
    hideLevels,
    renderProgress,
    toast,
    currentOverlay: () => overlay,
    select: (hole) => selectHole(hole),
    playMove: (move) => controller.play(move),
    clearSelection,
    state: () => ({
      selected,
      animating,
      overlay,
      targets: [...targets.keys()],
      trail: trailLayer.childNodes.length,
    }),
  };
}
