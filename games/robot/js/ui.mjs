// ui.mjs - the only DOM layer for the robot puzzle.
//
// Geometry is exported as pure functions so the isometric projection can be
// unit-tested without a browser. Everything else builds and updates SVG/DOM
// nodes from the controller's view; no rule lives here.

import {
  COLOR, heightAt, indexOf,
} from "./engine.mjs";
import { LEVELS, CHAPTERS, getLevel } from "./levels.mjs";
import {
  chapterName, errorText, htmlLang, instructionName, lessonText, levelName,
  normalizeLocale, translate,
} from "./i18n.mjs";

export const METRICS = Object.freeze({ tileW: 54, tileH: 31, zH: 22, wall: 9, pad: 26 });

const SVG_NS = "http://www.w3.org/2000/svg";
const PROC_KEYS = ["main", "proc1"];
const GLYPHS = Object.freeze({ F: "↑", L: "↺", R: "↻", J: "⇡", A: "✦", P: "ƒ" });
const DIR_CLASS = Object.freeze(["east", "south", "west", "north"]);

// ---------------------------------------------------------------------------
// Pure isometric geometry
// ---------------------------------------------------------------------------

export function isoPoint(x, y, z = 0, metrics = METRICS) {
  return {
    sx: (x - y) * (metrics.tileW / 2),
    sy: (x + y) * (metrics.tileH / 2) - Math.max(0, z) * metrics.zH,
  };
}

// Diamond top face, clockwise from the north corner.
export function topFace(sx, sy, metrics = METRICS) {
  const hw = metrics.tileW / 2;
  const hh = metrics.tileH / 2;
  return [
    [sx, sy - hh],
    [sx + hw, sy],
    [sx, sy + hh],
    [sx - hw, sy],
  ];
}

export function polyPoints(points) {
  return points.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");
}

function round(n) {
  return Math.round(n * 100) / 100;
}

// Bounding box of every visible floor tile plus wall depth and robot headroom.
export function viewBoxFor(level, metrics = METRICS) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < level.rows; y += 1) {
    for (let x = 0; x < level.cols; x += 1) {
      const h = heightAt(level, x, y);
      if (h < 0) continue;
      const { sx, sy } = isoPoint(x, y, h, metrics);
      minX = Math.min(minX, sx - metrics.tileW / 2);
      maxX = Math.max(maxX, sx + metrics.tileW / 2);
      minY = Math.min(minY, sy - metrics.tileH / 2);
      maxY = Math.max(maxY, sy + metrics.tileH / 2 + metrics.wall);
    }
  }
  if (!Number.isFinite(minX)) {
    return { x: -120, y: -90, width: 240, height: 180 };
  }
  minX -= metrics.pad;
  maxX += metrics.pad;
  minY -= metrics.pad;
  maxY += metrics.pad;
  return {
    x: round(minX),
    y: round(minY),
    width: round(maxX - minX),
    height: round(maxY - minY),
  };
}

export function glyphFor(code) {
  if (typeof code !== "string") return "";
  return GLYPHS[code.split(":")[0].toUpperCase()] ?? "";
}

export function tileClass(level, x, y) {
  const h = heightAt(level, x, y);
  if (h < 0) return null;
  const color = level.colors[indexOf(level, x, y)] ?? COLOR.ANY;
  const tint = color === COLOR.RED ? "tint-red" : color === COLOR.BLUE ? "tint-blue" : color === COLOR.GREEN ? "tint-green" : "";
  return ["tile", h > 0 ? "is-raised" : "", tint].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// UI factory
// ---------------------------------------------------------------------------

export function createUi({ doc, controller, onAction, onSfx }) {
  let locale = "zh";
  let overlayName = "none";
  let lastView = null;
  let builtLevelId = -1;
  let selected = null; // { proc, slot } armed empty slot
  let progress = null;
  let lastResult = null;
  let lastOutcome = null;
  let traceCursor = -1;
  let traceKey = "";
  let paletteKey = "";
  let robotNode = null;

  const nodes = new Map();
  const slotNodes = { main: [], proc1: [] };
  const lampNodes = new Map();
  const crateNodes = new Map();
  const switchNodes = new Map();
  const gateNodes = new Map();

  const $ = (id) => {
    let node = nodes.get(id);
    if (!node) {
      node = doc.getElementById(id);
      if (node) nodes.set(id, node);
    }
    return node;
  };

  const t = (key, vars) => translate(locale, key, vars);

  function el(tag, attrs = {}, className) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    if (className) node.setAttribute("class", className);
    return node;
  }

  function svg(tag, attrs = {}, className) {
    const node = doc.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    if (className) node.setAttribute("class", className);
    return node;
  }

  function clear(node) {
    if (!node) return;
    node.replaceChildren();
  }

  function reducedMotion() {
    try {
      return Boolean(doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Board
  // ------------------------------------------------------------------

  function buildBoard(view) {
    builtLevelId = view.levelId;
    const level = view.level;
    const tileLayer = $("tile-layer");
    const objectLayer = $("object-layer");
    const robotLayer = $("robot-layer");
    clear(tileLayer);
    clear(objectLayer);
    clear(robotLayer);
    lampNodes.clear();
    crateNodes.clear();
    switchNodes.clear();
    gateNodes.clear();

    const box = viewBoxFor(level);
    $("board").setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);

    const lampSet = new Set(level.lamps);
    const crateSet = new Set(level.boxes);
    const switchSet = new Set(level.switches);
    const gateSet = new Set(level.gates);

    // Painter order: larger x + y is nearer the viewer.
    const cells = [];
    for (let y = 0; y < level.rows; y += 1) {
      for (let x = 0; x < level.cols; x += 1) {
        if (heightAt(level, x, y) >= 0) cells.push({ x, y, key: x + y });
      }
    }
    cells.sort((a, b) => a.key - b.key || a.x - b.x);

    for (const { x, y } of cells) {
      const h = heightAt(level, x, y);
      const { sx, sy } = isoPoint(x, y, h);
      const cls = tileClass(level, x, y);
      const index = indexOf(level, x, y);
      const g = svg("g", { "data-cell": `${x},${y}`, "data-index": index }, "cell");

      const hw = METRICS.tileW / 2;
      const hh = METRICS.tileH / 2;
      const wall = METRICS.wall;
      g.appendChild(svg("polygon", {
        points: polyPoints([[sx - hw, sy], [sx, sy + hh], [sx, sy + hh + wall], [sx - hw, sy + wall]]),
      }, "tile-side side-left"));
      g.appendChild(svg("polygon", {
        points: polyPoints([[sx, sy + hh], [sx + hw, sy], [sx + hw, sy + wall], [sx, sy + hh + wall]]),
      }, "tile-side side-right"));
      g.appendChild(svg("polygon", { points: polyPoints(topFace(sx, sy)) }, cls));
      g.appendChild(svg("polygon", {
        points: polyPoints(topFace(sx, sy).map(([px, py]) => [px, py + 1])),
      }, "tile-vent"));
      tileLayer.appendChild(g);

      if (lampSet.has(index)) {
        const lamp = svg("g", { "data-lamp": index, transform: `translate(${sx} ${sy - 2})` }, "lamp");
        lamp.appendChild(svg("circle", { r: 15 }, "lamp-glow"));
        lamp.appendChild(svg("circle", { r: 6 }, "lamp-body"));
        objectLayer.appendChild(lamp);
        lampNodes.set(index, lamp);
      }
      if (switchSet.has(index)) {
        const sw = svg("g", { "data-switch": index, transform: `translate(${sx} ${sy + 2})` }, "switch");
        sw.appendChild(svg("polygon", { points: polyPoints([[-7, 0], [0, 4], [7, 0], [0, -4]]) }, "switch-plate"));
        objectLayer.appendChild(sw);
        switchNodes.set(index, sw);
      }
      if (gateSet.has(index)) {
        const gate = svg("g", { "data-gate": index, transform: `translate(${sx} ${sy})` }, "gate");
        for (const dx of [-16, -5, 6]) {
          gate.appendChild(svg("polygon", {
            points: polyPoints([[dx, -14], [dx + 8, -18], [dx + 8, 12], [dx, 16]]),
          }, "gate-bar"));
        }
        objectLayer.appendChild(gate);
        gateNodes.set(index, gate);
      }
      if (crateSet.has(index)) {
        const crate = svg("g", { "data-crate": index, transform: `translate(${sx} ${sy - 12})` }, "crate");
        crate.appendChild(svg("polygon", {
          points: polyPoints([[-13, -7], [0, 0], [13, -7], [0, -14]]),
        }, "crate-top"));
        crate.appendChild(svg("polygon", { points: polyPoints([[-13, -7], [0, 0], [0, 12], [-13, 5]]) }, "crate-left"));
        crate.appendChild(svg("polygon", { points: polyPoints([[0, 0], [13, -7], [13, 5], [0, 12]]) }, "crate-right"));
        objectLayer.appendChild(crate);
        crateNodes.set(index, crate);
      }
    }

    buildRobot();
  }

  function buildRobot() {
    const robot = svg("g", {}, "robot");
    robot.appendChild(svg("ellipse", { rx: 15, ry: 6, cy: 8 }, "robot-shadow"));
    robot.appendChild(svg("ellipse", { rx: 12, ry: 9 }, "robot-foot"));
    robot.appendChild(svg("circle", { r: 12, cy: -13 }, "robot-body"));
    robot.appendChild(svg("rect", { x: -8, y: -24, width: 16, height: 6, rx: 3 }, "robot-visor"));
    robot.appendChild(svg("circle", { r: 2.2, cx: -4, cy: -21 }, "robot-eye"));
    robot.appendChild(svg("circle", { r: 2.2, cx: 4, cy: -21 }, "robot-eye"));
    robot.appendChild(svg("polygon", { points: "-4,-25 4,-25 0,-31" }, "robot-antenna"));
    robot.appendChild(svg("polygon", { points: "-4,2 4,2 0,-3" }, "robot-nose"));
    $("robot-layer").appendChild(robot);
    robotNode = robot;
    return robot;
  }

  function updateBoard(view) {
    const level = view.level;
    const state = view.state;
    const lit = new Set(state.lit);
    for (const [index, node] of lampNodes) {
      node.classList.toggle("is-lit", lit.has(index));
    }
    const boxes = new Set(state.boxes);
    for (const [index, node] of crateNodes) {
      node.classList.toggle("is-missing", !boxes.has(index));
    }
    const pressed = level.switches.filter((s) => boxes.has(s)
      || (s === indexOf(level, state.x, state.y)));
    for (const [index, node] of switchNodes) {
      node.classList.toggle("is-pressed", pressed.includes(index));
    }
    for (const node of gateNodes.values()) node.classList.toggle("is-open", view.gateOpen);

    const robot = robotNode;
    if (robot) {
      const { sx, sy } = isoPoint(state.x, state.y, state.z);
      robot.style.transform = `translate(${round(sx)}px, ${round(sy - 2)}px)`;
      robot.setAttribute("class", `robot dir-${DIR_CLASS[state.dir] ?? "east"}`);
      robot.classList.toggle("is-lit", view.litCount > 0);
      robot.classList.toggle("is-jumping", view.meta?.code === "J");
      robot.classList.toggle("is-pushing", view.meta?.event === "push");
    }
  }

  // ------------------------------------------------------------------
  // HUD + program tape
  // ------------------------------------------------------------------

  function updateHud(view) {
    $("hud-chapter").textContent = t("chapterLabel");
    $("hud-level").textContent = `${t("levelLabel")} ${view.levelId} · ${levelName(locale, view.levelId)}`;
    $("hud-chapter-name").textContent = chapterName(locale, view.chapter);
    $("hud-par").textContent = String(view.par);
    $("hud-lines").textContent = String(view.lines);
    $("hud-steps").textContent = String(view.state.steps ?? 0);
    $("hud-energy").textContent = `${view.litCount}/${view.lamps}`;
    $("hud-mission").textContent = lessonText(locale, view.chapter);
    const statusLabel = {
      idle: "statusIdle", running: "statusRunning", paused: "statusPaused",
      won: "statusWon", error: "statusError", halted: "statusHalted",
    }[view.status] ?? "statusIdle";
    $("hud-status").textContent = t(statusLabel);
    $("hud-status").setAttribute("data-state", view.status);
  }

  function buildTape(view) {
    for (const proc of PROC_KEYS) {
      const row = $(proc === "main" ? "slots-main" : "slots-proc1");
      clear(row);
      slotNodes[proc] = [];
      const cap = proc === "main" ? view.slots.main : view.slots.proc1;
      for (let i = 0; i < cap; i += 1) {
        const btn = el("button", { type: "button", "data-proc": proc, "data-slot": i }, "slot");
        btn.addEventListener("click", () => onSlotClick(proc, i));
        row.appendChild(btn);
        slotNodes[proc].push(btn);
      }
    }
    $("proc-block").hidden = view.slots.proc1 === 0;
  }

  function buildPalette(view) {
    paletteKey = view.palette.join(",");
    const row = $("palette-row");
    clear(row);
    for (const code of view.palette) {
      const btn = el("button", { type: "button", "data-code": code }, `tile-btn tile-${code.split(":")[0].toLowerCase()}`);
      const glyph = el("span", {}, "tile-glyph");
      glyph.textContent = glyphFor(code);
      const label = el("span", {}, "tile-name");
      btn.appendChild(glyph);
      btn.appendChild(label);
      btn.addEventListener("click", () => fillFromPalette(code));
      row.appendChild(btn);
    }
  }

  function updateTape(view) {
    const program = view.program;
    for (const proc of PROC_KEYS) {
      const row = slotNodes[proc];
      const cap = proc === "main" ? view.slots.main : view.slots.proc1;
      if (!row.length && cap > 0) continue;
      program[proc].forEach((code, i) => {
        const btn = row[i];
        if (!btn) return;
        btn.textContent = code ? glyphFor(code) : "";
        btn.setAttribute("data-code", code);
        btn.setAttribute("aria-label", code
          ? instructionName(locale, code)
          : t("slotAria", { proc: t(proc === "main" ? "mainName" : "procName"), n: i + 1 }));
        btn.classList.toggle("is-filled", Boolean(code));
        btn.classList.toggle("is-armed", Boolean(selected && selected.proc === proc && selected.slot === i));
        btn.classList.toggle("is-pointer", Boolean(view.meta && view.meta.proc === proc && view.meta.ip === i && view.status !== "idle"));
        btn.style.setProperty("--tile-hue", code ? `var(--hue-${code.split(":")[0].toLowerCase()})` : "transparent");
      });
    }
    for (const btn of $("palette-row").children) {
      const code = btn.getAttribute("data-code");
      btn.setAttribute("aria-label", instructionName(locale, code));
      const name = btn.querySelector?.(".tile-name");
      if (name) name.textContent = instructionName(locale, code);
    }
    $("line-count").textContent = String(view.lines);
    $("line-par").textContent = String(view.par);
    const over = view.lines - view.par;
    $("line-flag").textContent = view.lines === 0
      ? ""
      : over <= 0 ? t("onPar") : t("overPar", { n: over });
    $("line-flag").setAttribute("data-over", over > 0 ? "yes" : "no");
  }

  function updateControls(view) {
    const runBtn = $("btn-run");
    runBtn.textContent = t(view.status === "running" ? "pause" : "run");
    runBtn.setAttribute("aria-label", t("ariaRun"));
    runBtn.classList.toggle("is-running", view.status === "running");
    runBtn.disabled = !view.canRun && view.status !== "running";
    $("btn-step").disabled = !view.canStep;
    $("btn-speed").textContent = `${view.speed}×`;
  }

  function updateTrace(view) {
    const key = `${view.levelId}:${view.cursor}:${view.status}:${locale}`;
    if (key === traceKey) return;
    traceKey = key;
    traceCursor = view.cursor;
    const list = $("trace-list");
    if (!list) return;
    clear(list);
    if (!view.frameCount) {
      const empty = el("li", {}, "trace-empty");
      empty.textContent = t("traceEmpty");
      list.appendChild(empty);
      return;
    }
    const frames = controller.frames();
    const start = Math.max(0, view.cursor - 18);
    for (const frame of frames.slice(start, view.cursor + 1)) {
      list.appendChild(traceRow(frame, view));
    }
    list.scrollTop = list.scrollHeight;
  }

  function traceRow(frame, view) {
    const li = el("li", {}, "trace-line");
    const step = el("span", {}, "trace-step");
    step.textContent = String(frame ? frame.index : view.cursor);
    const code = el("span", {}, "trace-code");
    const meta = frame ? frame.meta : view.meta;
    const raw = meta?.code ?? "";
    code.textContent = raw ? `${glyphFor(raw)} ${instructionName(locale, raw)}` : (meta?.event ?? "");
    li.appendChild(step);
    li.appendChild(code);
    if (frame && frame.index === view.cursor) li.classList.add("is-now");
    return li;
  }

  // ------------------------------------------------------------------
  // Interaction
  // ------------------------------------------------------------------

  function armSlot(proc, slot) {
    const filled = lastView?.program?.[proc]?.[slot];
    if (filled) {
      selected = null;
      controller.erase(proc, slot);
      onSfx("remove");
      return true;
    }
    selected = selected && selected.proc === proc && selected.slot === slot ? null : { proc, slot };
    if (lastView) updateTape(lastView);
    onSfx("pick");
    return true;
  }

  function onSlotClick(proc, slot) {
    armSlot(proc, slot);
  }

  function fillFromPalette(code) {
    if (!lastView) return false;
    let proc = "main";
    let slot = -1;
    if (selected) {
      proc = selected.proc;
      slot = selected.slot;
    }
    if (slot < 0 || lastView.program[proc][slot] !== "") {
      slot = lastView.program.main.indexOf("");
      proc = "main";
      if (slot < 0 && lastView.slots.proc1 > 0) {
        slot = lastView.program.proc1.indexOf("");
        proc = "proc1";
      }
    }
    if (slot < 0) {
      onSfx("error");
      return false;
    }
    const ok = controller.place(proc, slot, code);
    if (ok) {
      selected = { proc, slot: slot + 1 < lastView.program[proc].length ? slot + 1 : slot };
      if (lastView.program[proc][selected.slot] !== "") selected = null;
      onSfx("pick");
      updateTape(controller.view());
    }
    return ok;
  }

  function setOverlay(name) {
    overlayName = name;
    $("help-panel").hidden = name !== "help";
    $("result-panel").hidden = name !== "result";
    $("level-panel").hidden = name !== "levels";
  }

  function currentOverlay() {
    return overlayName;
  }

  function showHelp() { setOverlay("help"); }
  function hideHelp() { if (overlayName === "help") setOverlay("none"); }
  function hideResult() { if (overlayName === "result") setOverlay("none"); }
  function hideLevels() { if (overlayName === "levels") setOverlay("none"); }

  function toast(text) {
    const node = $("toast");
    if (!node) return;
    node.textContent = text;
    node.hidden = false;
    const view = doc.defaultView;
    if (view?.setTimeout) {
      view.clearTimeout?.(toast._t);
      toast._t = view.setTimeout(() => { node.hidden = true; }, 1900);
    }
  }

  function starString(stars) {
    const filled = Math.max(0, Math.min(3, stars | 0));
    return "★".repeat(filled) + "☆".repeat(3 - filled);
  }

  function fillResult() {
    if (!lastResult) return;
    const view = lastResult;
    const won = view.status === "won";
    const title = $("result-title");
    title.textContent = won
      ? (view.stars >= 3 ? t("winOptimal") : t("winTitle"))
      : t("failTitle");
    title.setAttribute("data-tone", won ? "win" : "fail");
    $("result-line").textContent = t("resultLines", { lines: view.lines, par: view.par });
    $("result-stars").textContent = starString(won ? view.stars : 0);
    $("result-stars").setAttribute("aria-label", t("resultStars", { stars: won ? view.stars : 0 }));
    $("result-hint").textContent = won
      ? (view.stars >= 3 ? t("onPar") : t("overPar", { n: Math.max(0, view.lines - view.par) }))
      : (view.status === "error"
        ? (lastView?.state?.error ? errorText(locale, lastView.state.error) : t("failBlockedHint"))
        : t("failShortHint"));
    $("result-best").hidden = !(won && lastOutcome?.improved);
    const next = getLevel(view.levelId + 1);
    $("result-next").hidden = !won || !next;
    $("result-again").textContent = t(won ? "nextLevel" : "retryLevel");
    $("result-again").hidden = Boolean(won && next);
  }

  function showResult(view, outcome) {
    lastResult = view;
    lastOutcome = outcome ?? null;
    fillResult();
    setOverlay("result");
  }

  // ------------------------------------------------------------------
  // Level book
  // ------------------------------------------------------------------

  function renderLevels(data) {
    progress = data ?? progress;
    if (!progress) return;
    $("level-progress").textContent = t("progress", {
      n: progress.clearedCount,
      total: LEVELS.length,
      stars: progress.totalStars,
    });
    const grid = $("level-grid");
    clear(grid);
    for (const chapter of CHAPTERS) {
      const group = el("section", {}, "level-chapter");
      const head = el("h3", {}, "level-chapter-head");
      const name = el("span");
      name.textContent = chapterName(locale, chapter.id);
      const tally = el("b");
      const ids = LEVELS.filter((l) => l.chapter === chapter.id);
      const got = ids.reduce((sum, l) => sum + (progress.cleared[l.id] ?? 0), 0);
      tally.textContent = t("chapterStars", { stars: got, max: ids.length * 3 });
      head.appendChild(name);
      head.appendChild(tally);
      group.appendChild(head);
      const row = el("div", {}, "level-row");
      for (const level of ids) {
        const stars = progress.cleared[level.id] ?? 0;
        const unlocked = level.id === 1 || Boolean(progress.cleared[level.id - 1]);
        const btn = el("button", {
          type: "button",
          "data-level": level.id,
          "data-stars": stars,
          "aria-label": `${t("levelLabel")} ${level.id} ${levelName(locale, level.id)}`,
        }, "level-btn");
        btn.disabled = !unlocked;
        btn.classList.toggle("is-cleared", stars > 0);
        btn.classList.toggle("is-locked", !unlocked);
        const num = el("b", {}, "level-num");
        num.textContent = String(level.id);
        const name2 = el("span", {}, "level-name");
        name2.textContent = levelName(locale, level.id);
        const star = el("i", {}, "level-stars");
        star.textContent = unlocked ? starString(stars) : t("lockedLevel");
        btn.appendChild(num);
        btn.appendChild(name2);
        btn.appendChild(star);
        btn.addEventListener("click", () => onAction("level", level.id));
        row.appendChild(btn);
      }
      group.appendChild(row);
      grid.appendChild(group);
    }
  }

  function showLevels(data) {
    renderLevels(data);
    setOverlay("levels");
  }

  // ------------------------------------------------------------------
  // Render entry points
  // ------------------------------------------------------------------

  function render(view) {
    if (!view) return;
    lastView = view;
    if (view.levelId !== builtLevelId || view.slots.main !== slotNodes.main.length || view.slots.proc1 !== slotNodes.proc1.length) {
      buildBoard(view);
      buildTape(view);
    }
    if (paletteKey !== view.palette.join(",")) buildPalette(view);
    updateBoard(view);
    updateHud(view);
    updateTape(view);
    updateControls(view);
    updateTrace(view);
    if (overlayName === "result" && lastResult) fillResult();
  }

  function applyLocale(next) {
    locale = normalizeLocale(next);
    try {
      doc.documentElement.setAttribute("lang", htmlLang(locale));
    } catch {
      // Document stub without documentElement: harmless.
    }
    for (const node of doc.querySelectorAll("[data-i18n]")) {
      const key = node.getAttribute("data-i18n");
      const text = translate(locale, key);
      if (text !== key) node.textContent = text;
    }
    for (const node of doc.querySelectorAll("[data-i18n-aria]")) {
      const key = node.getAttribute("data-i18n-aria");
      const text = translate(locale, key);
      if (text !== key) node.setAttribute("aria-label", text);
    }
    $("btn-lang").textContent = t("langBtn");
    traceKey = "";
    if (lastView) {
      updateHud(lastView);
      updateTape(lastView);
      updateControls(lastView);
      updateTrace(lastView);
    }
    if (progress) renderLevels(progress);
    if (overlayName === "result") fillResult();
  }

  function syncSound(on) {
    const btn = $("btn-sound");
    btn.textContent = on ? t("soundOn") : t("soundOff");
    btn.setAttribute("aria-label", t("sound"));
  }

  function start() {
    const speed = $("btn-speed");
    speed.addEventListener("click", () => onAction("speed"));
    $("btn-run").addEventListener("click", () => onAction("run"));
    $("btn-step").addEventListener("click", () => onAction("step"));
    $("btn-reset").addEventListener("click", () => onAction("reset"));
    $("btn-clear").addEventListener("click", () => onAction("clear"));
    $("btn-levels").addEventListener("click", () => onAction("levels"));
    $("btn-sound").addEventListener("click", () => onAction("sound"));
    $("btn-lang").addEventListener("click", () => onAction("lang"));
    $("btn-help").addEventListener("click", () => onAction("help"));
    $("help-close").addEventListener("click", () => onAction("closeHelp"));
    $("level-close").addEventListener("click", () => onAction("closeLevels"));
    $("result-next").addEventListener("click", () => onAction("nextLevel"));
    $("result-again").addEventListener("click", () => onAction("again"));
    if (reducedMotion()) doc.body?.classList?.add("reduced-motion");
    doc.addEventListener?.("keydown", (event) => {
      if (event.key === "Escape") {
        if (overlayName !== "none") setOverlay("none");
        else if (selected) {
          selected = null;
          if (lastView) updateTape(lastView);
        }
      }
      if (event.key === "Enter" && overlayName === "none") onAction("run");
    });
  }

  return {
    start,
    render,
    applyLocale,
    syncSound,
    showHelp,
    hideHelp,
    showResult,
    hideResult,
    showLevels,
    hideLevels,
    renderLevels,
    toast,
    currentOverlay,
    fillFromPalette,
    armSlot,
    selectSlot: armSlot,
    starString,
    get locale() { return locale; },
    get selected() { return selected ? { ...selected } : null; },
  };
}
