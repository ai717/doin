// DOM and Canvas presentation for Flick Duel: the solid wood table, pucks, aim guides,
// HUD, setup drawer, pause veil and result sheet.

import { WORLD, CENTER_Y, DIVIDER_BAND, gateIndexAt } from "./engine.mjs";
import { t, htmlLang } from "./i18n.mjs";
import { formatTime, seatLabelKey, turnLabelKey, resultTitleKey, reasonKey } from "./score.mjs";
import { bestRecord } from "./storage.mjs";

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makePrng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createUi(refs) {
  let locale = "zh";
  let canvas = null;
  let ctx = null;
  let bgCanvas = null;
  let bgKey = "";
  let gateFlashes = [];
  let toastTimer = 0;

  const reducedMotion = () => Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  // ---------------------------------------------------------------- setup ----

  function setupCanvas() {
    canvas = refs.canvas;
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const cssWidth = Math.max(240, rect.width || 960);
      const scale = Math.min(2, globalThis.devicePixelRatio || 1);
      const cssHeight = (cssWidth * WORLD.height) / WORLD.width;
      canvas.width = Math.round(cssWidth * scale);
      canvas.height = Math.round(cssHeight * scale);
      if (ctx) ctx.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);
      bgCanvas = null;
      bgKey = "";
    };
    resize();
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      new ResizeObserver(resize).observe(canvas.parentElement);
    }
    globalThis.addEventListener("resize", resize);
  }

  // ------------------------------------------------------------ background ----

  function paintWood(c) {
    const w = WORLD.width;
    const h = WORLD.height;
    const base = c.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, "#6e4423");
    base.addColorStop(0.42, "#8b5b31");
    base.addColorStop(0.72, "#7a4a27");
    base.addColorStop(1, "#57331a");
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);

    const rng = makePrng(1977);
    for (let i = 0; i < 52; i += 1) {
      const y = rng() * h;
      const dark = 0.05 + rng() * 0.075;
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) {
        const wave = Math.sin(x * 0.012 + i * 1.7) * 3.4 + Math.sin(x * 0.003 + i) * 6;
        c.lineTo(x, y + wave + (rng() - 0.5) * 1.6);
      }
      c.strokeStyle = `rgba(52, 27, 10, ${dark})`;
      c.lineWidth = 0.7 + rng() * 2.1;
      c.stroke();
    }
    for (let i = 0; i < 16; i += 1) {
      const y = rng() * h;
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= w; x += 46) {
        c.lineTo(x, y + Math.sin(x * 0.008 + i * 2.3) * 5);
      }
      c.strokeStyle = `rgba(255, 213, 158, ${0.03 + rng() * 0.03})`;
      c.lineWidth = 1.2 + rng() * 2;
      c.stroke();
    }

    c.fillStyle = "rgba(30, 74, 68, 0.1)";
    c.fillRect(0, 0, w, CENTER_Y);
    c.fillStyle = "rgba(150, 54, 34, 0.1)";
    c.fillRect(0, CENTER_Y, w, h - CENTER_Y);

    const vignette = c.createRadialGradient(w / 2, h / 2, h * 0.24, w / 2, h / 2, h * 0.8);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(20,9,3,0.5)");
    c.fillStyle = vignette;
    c.fillRect(0, 0, w, h);
  }

  function paintFrame(c, snapshot) {
    const w = WORLD.width;
    const h = WORLD.height;
    const m = WORLD.margin;

    c.strokeStyle = "rgba(22, 10, 4, 0.72)";
    c.lineWidth = 14;
    c.strokeRect(m - 7, m - 7, w - (m - 7) * 2, h - (m - 7) * 2);
    c.strokeStyle = "rgba(255, 220, 170, 0.14)";
    c.lineWidth = 2;
    c.strokeRect(m, m, w - m * 2, h - m * 2);
    c.strokeStyle = "rgba(30, 14, 6, 0.5)";
    c.lineWidth = 2;
    c.strokeRect(m + 5, m + 5, w - (m + 5) * 2, h - (m + 5) * 2);

    for (const [x, y] of [[m - 7, m - 7], [w - m + 7, m - 7], [m - 7, h - m + 7], [w - m + 7, h - m + 7]]) {
      const brass = c.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 6);
      brass.addColorStop(0, "#f0cd8e");
      brass.addColorStop(0.6, "#b07f42");
      brass.addColorStop(1, "#6c4720");
      c.beginPath();
      c.arc(x, y, 5.4, 0, TAU);
      c.fillStyle = brass;
      c.fill();
      c.strokeStyle = "rgba(40,20,8,0.6)";
      c.lineWidth = 1;
      c.stroke();
    }

    c.font = '600 13px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = "rgba(255, 232, 200, 0.5)";
    c.fillText(t(locale, seatLabelKey(snapshot.mode, "south", snapshot.humanSide)), 52, h - 34);
    c.fillText(t(locale, seatLabelKey(snapshot.mode, "north", snapshot.humanSide)), 52, 34);
  }

  function paintSeam(c) {
    const w = WORLD.width;
    const cy = CENTER_Y;
    c.fillStyle = "rgba(24, 12, 5, 0.82)";
    c.fillRect(0, cy - DIVIDER_BAND, w, DIVIDER_BAND * 2);

    const rail = c.createLinearGradient(0, cy - DIVIDER_BAND, 0, cy + DIVIDER_BAND);
    rail.addColorStop(0, "#7c5229");
    rail.addColorStop(0.5, "#4c2d15");
    rail.addColorStop(1, "#7c5229");
    c.fillStyle = rail;
    c.fillRect(0, cy - DIVIDER_BAND, w, 7);
    c.fillRect(0, cy + DIVIDER_BAND - 7, w, 7);
    c.fillStyle = "rgba(255, 224, 178, 0.2)";
    c.fillRect(0, cy - DIVIDER_BAND, w, 1.6);
    c.fillRect(0, cy + DIVIDER_BAND - 1.6, w, 1.6);
  }

  function paintGates(c, snapshot, gateFlashUntil) {
    snapshot.gates.forEach((gate, index) => {
      const r = WORLD.gateRadius;
      const hole = c.createRadialGradient(gate.x, gate.y - 4, 2, gate.x, gate.y, r);
      hole.addColorStop(0, "#0d0703");
      hole.addColorStop(0.7, "#1b0e06");
      hole.addColorStop(1, "#3a2110");
      c.beginPath();
      c.arc(gate.x, gate.y, r, 0, TAU);
      c.fillStyle = hole;
      c.fill();

      const ring = c.createLinearGradient(gate.x - r, gate.y - r, gate.x + r, gate.y + r);
      ring.addColorStop(0, "#e8c189");
      ring.addColorStop(0.4, "#bd8140");
      ring.addColorStop(0.75, "#8d5a26");
      ring.addColorStop(1, "#d9a768");
      c.beginPath();
      c.arc(gate.x, gate.y, r, 0, TAU);
      c.lineWidth = 7;
      c.strokeStyle = ring;
      c.stroke();
      c.beginPath();
      c.arc(gate.x, gate.y, r - 4.2, 0, TAU);
      c.lineWidth = 1.6;
      c.strokeStyle = "rgba(255, 232, 190, 0.5)";
      c.stroke();

      const flash = gateFlashUntil(index);
      if (flash > 0) {
        c.save();
        c.globalAlpha = flash * 0.8;
        c.beginPath();
        c.arc(gate.x, gate.y, r + 8 + (1 - flash) * 14, 0, TAU);
        c.lineWidth = 5;
        c.strokeStyle = "rgba(255, 214, 130, 0.85)";
        c.shadowColor = "rgba(255, 200, 110, 0.9)";
        c.shadowBlur = 18;
        c.stroke();
        c.restore();
      }
    });
  }

  function ensureBackground(snapshot) {
    const key = `${snapshot.boardId}|${snapshot.mode}|${snapshot.humanSide}|${locale}`;
    if (bgCanvas && bgKey === key) return;
    const scale = 2;
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = WORLD.width * scale;
    bgCanvas.height = WORLD.height * scale;
    const c = bgCanvas.getContext("2d");
    c.setTransform(scale, 0, 0, scale, 0, 0);
    paintWood(c);
    paintSeam(c);
    paintFrame(c, snapshot);
    paintGates(c, snapshot, () => 0);
    bgKey = key;
  }

  // ----------------------------------------------------------------- pucks ----

  function drawPuck(c, puck, options = {}) {
    const r = WORLD.puckRadius;
    const south = puck.side === "south";
    c.beginPath();
    c.ellipse(puck.x + 2.6, puck.y + 4.6, r * 0.98, r * 0.82, 0, 0, TAU);
    c.fillStyle = "rgba(18, 9, 3, 0.36)";
    c.fill();

    if (options.moving) {
      const speed = Math.hypot(puck.vx, puck.vy);
      if (speed > 60) {
        const nx = puck.vx / speed;
        const ny = puck.vy / speed;
        c.beginPath();
        c.moveTo(puck.x - nx * r * 0.4, puck.y - ny * r * 0.4);
        c.lineTo(puck.x - nx * (r + 16), puck.y - ny * (r + 16));
        c.lineWidth = 5;
        c.strokeStyle = south ? "rgba(196, 71, 47, 0.18)" : "rgba(47, 143, 134, 0.18)";
        c.stroke();
      }
    }

    if (options.glow) {
      c.save();
      c.beginPath();
      c.arc(puck.x, puck.y, r + 8, 0, TAU);
      c.fillStyle = south ? "rgba(255, 148, 108, 0.17)" : "rgba(122, 226, 214, 0.17)";
      c.shadowColor = south ? "rgba(255, 120, 80, 0.8)" : "rgba(90, 220, 205, 0.8)";
      c.shadowBlur = 16;
      c.fill();
      c.restore();
    }

    const body = c.createRadialGradient(puck.x - r * 0.38, puck.y - r * 0.42, r * 0.15, puck.x, puck.y, r);
    body.addColorStop(0, "#f3e1b8");
    body.addColorStop(0.52, "#d9b880");
    body.addColorStop(1, "#a3773f");
    c.beginPath();
    c.arc(puck.x, puck.y, r, 0, TAU);
    c.fillStyle = body;
    c.fill();

    c.lineWidth = 3.2;
    c.strokeStyle = south ? "#c4472f" : "#2f8f86";
    c.stroke();
    c.beginPath();
    c.arc(puck.x, puck.y, r - 2, 0, TAU);
    c.lineWidth = 1;
    c.strokeStyle = "rgba(60, 34, 12, 0.3)";
    c.stroke();

    c.beginPath();
    c.arc(puck.x, puck.y, r * 0.58, 0, TAU);
    c.lineWidth = 1.4;
    c.strokeStyle = "rgba(96, 60, 26, 0.34)";
    c.stroke();
    c.beginPath();
    c.arc(puck.x, puck.y, r * 0.2, 0, TAU);
    c.fillStyle = south ? "rgba(196, 71, 47, 0.55)" : "rgba(47, 143, 134, 0.55)";
    c.fill();

    c.beginPath();
    c.arc(puck.x, puck.y, r * 0.72, Math.PI * 1.08, Math.PI * 1.46);
    c.lineWidth = 2.2;
    c.strokeStyle = "rgba(255, 248, 226, 0.55)";
    c.stroke();
  }

  // ------------------------------------------------------------------ aim ----

  function dirToNearestGate(snapshot, puck) {
    let best = snapshot.gates[0];
    let bestDistance = Infinity;
    for (const gate of snapshot.gates) {
      const distance = Math.hypot(gate.x - puck.x, gate.y - puck.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = gate;
      }
    }
    return best;
  }

  function drawAim(c, snapshot, view) {
    if (snapshot.phase !== "aim" || snapshot.status !== "playing" || snapshot.paused) return;
    if (!view.humanTurn) return;
    let puck = null;
    let dirX = 0;
    let dirY = 0;
    let power = 0;
    let dragging = false;

    if (view.drag) {
      puck = snapshot.pucks.find((item) => item.id === view.drag.puckId) ?? null;
      if (puck) {
        const dx = puck.x - view.drag.x;
        const dy = puck.y - view.drag.y;
        const length = Math.hypot(dx, dy);
        if (length < 1.5) return;
        dirX = dx / length;
        dirY = dy / length;
        power = clamp(length / WORLD.maxPull, 0, 1);
        dragging = true;
      }
    } else if (view.keyAim) {
      puck = snapshot.pucks.find((item) => item.id === view.keyAim.puckId) ?? null;
      if (puck) {
        dirX = Math.cos(view.keyAim.angle);
        dirY = Math.sin(view.keyAim.angle);
        power = view.keyAim.power;
      }
    }
    if (!puck) return;

    // Highlight a gate that the current line would actually pass through.
    if (Math.abs(dirY) > 1e-4) {
      const crossT = (CENTER_Y - puck.y) / dirY;
      if (crossT > 0 && crossT < 520) {
        const crossX = puck.x + dirX * crossT;
        const gateIndex = gateIndexAt(snapshot, crossX);
        if (gateIndex >= 0) {
          const gate = snapshot.gates[gateIndex];
          c.save();
          c.beginPath();
          c.arc(gate.x, gate.y, WORLD.gateRadius + 6, 0, TAU);
          c.lineWidth = 3;
          c.strokeStyle = "rgba(255, 220, 140, 0.7)";
          c.shadowColor = "rgba(255, 200, 110, 0.85)";
          c.shadowBlur = 14;
          c.stroke();
          c.restore();
        }
      }
    }

    const startX = puck.x + dirX * (WORLD.puckRadius + 2);
    const startY = puck.y + dirY * (WORLD.puckRadius + 2);
    const guideLength = 90 + power * 190;
    const endX = puck.x + dirX * guideLength;
    const endY = puck.y + dirY * guideLength;

    c.save();
    c.setLineDash([8, 8]);
    c.lineDashOffset = reducedMotion() ? 0 : -performance.now() / 55;
    c.beginPath();
    c.moveTo(startX, startY);
    c.lineTo(endX, endY);
    c.lineWidth = 2.4;
    c.strokeStyle = "rgba(255, 238, 205, 0.62)";
    c.stroke();
    c.setLineDash([]);

    const angle = Math.atan2(dirY, dirX);
    c.beginPath();
    c.moveTo(endX, endY);
    c.lineTo(endX - Math.cos(angle - 0.4) * 13, endY - Math.sin(angle - 0.4) * 13);
    c.lineTo(endX - Math.cos(angle + 0.4) * 13, endY - Math.sin(angle + 0.4) * 13);
    c.closePath();
    c.fillStyle = "rgba(255, 238, 205, 0.72)";
    c.fill();

    // Charge ring around the puck.
    const ringR = WORLD.puckRadius + 10;
    c.beginPath();
    c.arc(puck.x, puck.y, ringR, 0, TAU);
    c.lineWidth = 5;
    c.strokeStyle = "rgba(20, 10, 4, 0.45)";
    c.stroke();
    const start = -Math.PI / 2;
    c.beginPath();
    c.arc(puck.x, puck.y, ringR, start, start + TAU * Math.max(0.02, power));
    c.lineWidth = 5;
    c.strokeStyle = power > 0.92 ? "#f0704a" : power > 0.55 ? "#eab55c" : "#8fc79a";
    c.stroke();

    if (dragging && view.drag) {
      c.beginPath();
      c.moveTo(puck.x, puck.y);
      c.lineTo(view.drag.x, view.drag.y);
      c.lineWidth = 2;
      c.strokeStyle = "rgba(255, 210, 160, 0.4)";
      c.stroke();
      c.beginPath();
      c.arc(view.drag.x, view.drag.y, 5, 0, TAU);
      c.fillStyle = "rgba(255, 222, 180, 0.55)";
      c.fill();
    }
    c.restore();
  }

  // --------------------------------------------------------------- render ----

  function render(snapshot, view = {}) {
    if (!ctx) return;
    ensureBackground(snapshot);
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    ctx.drawImage(bgCanvas, 0, 0, WORLD.width, WORLD.height);

    const now = performance.now();
    gateFlashes = gateFlashes.filter((flash) => flash.until > now);
    const gateFlashUntil = (index) => {
      const hit = gateFlashes.find((flash) => flash.index === index);
      return hit ? clamp((hit.until - now) / 600, 0, 1) : 0;
    };
    snapshot.gates.forEach((gate, index) => {
      if (gateFlashUntil(index) <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(gate.x, gate.y, WORLD.gateRadius + 8, 0, TAU);
      ctx.lineWidth = 5;
      ctx.strokeStyle = `rgba(255, 214, 130, ${gateFlashUntil(index) * 0.8})`;
      ctx.shadowColor = "rgba(255, 200, 110, 0.9)";
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();
    });

    drawAim(ctx, snapshot, { ...view, humanTurn: view.humanTurn !== false });

    for (const puck of snapshot.pucks) {
      const selected = view.selectedPuckId === puck.id;
      const ownTurn = view.humanTurn !== false && puck.side === snapshot.turn && snapshot.phase === "aim";
      drawPuck(ctx, puck, { moving: true, glow: selected || ownTurn });
    }
  }

  // ---------------------------------------------------------------- panels ----

  function applyStatic(nextLocale) {
    locale = nextLocale === "en" ? "en" : "zh";
    document.documentElement.lang = htmlLang(locale);
    document.title = t(locale, "docTitle");
    for (const node of document.querySelectorAll("[data-i18n]")) {
      node.textContent = t(locale, node.dataset.i18n);
    }
    for (const node of document.querySelectorAll("[data-i18n-aria]")) {
      node.setAttribute("aria-label", t(locale, node.dataset.i18nAria));
    }
    if (refs.langBtn) refs.langBtn.textContent = t(locale, "langShort");
    if (refs.keyHint) {
      const touch = Boolean(globalThis.matchMedia?.("(max-width: 768px)")?.matches);
      refs.keyHint.textContent = t(locale, touch ? "keyHintTouch" : "keyHint");
    }
    bgCanvas = null;
    bgKey = "";
  }

  function updateHud(snapshot) {
    if (refs.hudTurn) {
      refs.hudTurn.textContent = t(locale, turnLabelKey(snapshot.mode, snapshot.turn, snapshot.humanSide));
      refs.hudTurn.classList.toggle("is-ai", snapshot.mode === "solo" && snapshot.turn !== snapshot.humanSide);
    }
    if (refs.hudSouthKicker) {
      refs.hudSouthKicker.textContent = t(locale, seatLabelKey(snapshot.mode, "south", snapshot.humanSide));
    }
    if (refs.hudNorthKicker) {
      refs.hudNorthKicker.textContent = t(locale, seatLabelKey(snapshot.mode, "north", snapshot.humanSide));
    }
    if (refs.hudSouth) refs.hudSouth.textContent = String(snapshot.counts.south);
    if (refs.hudNorth) refs.hudNorth.textContent = String(snapshot.counts.north);
    if (refs.hudRound) {
      refs.hudRound.textContent = t(locale, "roundRatio", { n: snapshot.round, max: snapshot.maxRounds });
    }
    if (refs.hudTime) refs.hudTime.textContent = formatTime(snapshot.time);
  }

  function markOption(group, value) {
    if (!group) return;
    for (const button of group.querySelectorAll("[data-value]")) {
      button.classList.toggle("is-active", button.dataset.value === value);
      button.setAttribute("aria-pressed", button.dataset.value === value ? "true" : "false");
    }
  }

  function renderModePanel(settings) {
    markOption(refs.modeGroup, settings.mode);
    markOption(refs.diffGroup, settings.difficulty);
    markOption(refs.boardGroup, settings.boardId);
    markOption(refs.sideGroup, settings.humanSide);
    if (refs.diffRow) refs.diffRow.hidden = settings.mode === "duel";
  }

  function setPaused(paused) {
    if (refs.pauseBtn) {
      refs.pauseBtn.textContent = paused ? t(locale, "resume") : t(locale, "pause");
      refs.pauseBtn.setAttribute("aria-label", t(locale, "pauseAria"));
      refs.pauseBtn.classList.toggle("is-paused", paused);
    }
    if (refs.pauseVeil) refs.pauseVeil.hidden = !paused;
  }

  function setSound(muted) {
    if (!refs.soundBtn) return;
    refs.soundBtn.textContent = muted ? "×" : "♪";
    refs.soundBtn.setAttribute("aria-label", t(locale, muted ? "soundOff" : "soundOn"));
  }

  function showResult(snapshot, progress, newBest) {
    if (refs.resultTitle) {
      refs.resultTitle.textContent = t(locale, resultTitleKey(snapshot.mode, snapshot.winner, snapshot.humanSide));
    }
    if (refs.resultRows) {
      refs.resultRows.innerHTML = "";
      const record = bestRecord(progress, snapshot);
      const rows = [
        [t(locale, "resultRounds"), t(locale, "roundRatio", { n: snapshot.round, max: snapshot.maxRounds })],
        [t(locale, "resultTime"), formatTime(snapshot.time)],
        [t(locale, "resultReason"), t(locale, reasonKey(snapshot.reason))],
      ];
      if (record) rows.push([t(locale, "resultBest", { rounds: record.rounds, time: formatTime(record.time) }), ""]);
      for (const [label, value] of rows) {
        const row = document.createElement("div");
        row.className = "result-row";
        const name = document.createElement("span");
        name.className = "result-label";
        name.textContent = label;
        row.append(name);
        if (value) {
          const strong = document.createElement("strong");
          strong.className = "result-value";
          strong.textContent = value;
          row.append(strong);
        }
        refs.resultRows.append(row);
      }
    }
    if (refs.resultNote) {
      refs.resultNote.textContent = newBest ? t(locale, "resultNote") : "";
      refs.resultNote.hidden = !newBest;
    }
    if (refs.resultStats) {
      const stats = progress?.stats ?? { wins: 0, losses: 0, draws: 0 };
      refs.resultStats.textContent = t(locale, "resultStatsValue", {
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
      });
    }
    openPanel("panel-result");
  }

  function openPanel(id) {
    closePanels();
    const node = typeof id === "string" ? document.getElementById(id) : id;
    if (node) node.hidden = false;
  }

  function closePanels() {
    for (const node of document.querySelectorAll(".panel")) node.hidden = true;
  }

  function anyPanelOpen() {
    return Boolean(document.querySelector(".panel:not([hidden])"));
  }

  function showToast(message, duration = 1300) {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.classList.add("is-visible");
    globalThis.clearTimeout(toastTimer);
    toastTimer = globalThis.setTimeout(() => {
      refs.toast.classList.remove("is-visible");
    }, duration);
  }

  function flashGate(index) {
    gateFlashes.push({ index, until: performance.now() + 600 });
    if (gateFlashes.length > 8) gateFlashes.shift();
  }

  function reset() {
    gateFlashes = [];
    globalThis.clearTimeout(toastTimer);
    if (refs.toast) refs.toast.classList.remove("is-visible");
  }

  return {
    setupCanvas,
    render,
    applyStatic,
    updateHud,
    renderModePanel,
    showResult,
    setPaused,
    setSound,
    openPanel,
    closePanels,
    anyPanelOpen,
    showToast,
    flashGate,
    reset,
    dirToNearestGate,
    getLocale() {
      return locale;
    },
  };
}
