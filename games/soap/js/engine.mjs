// Pure cutting rules. DOM-free, deterministic: same seed + same stroke sequence -> same state.
// The bar is a height-map grid: each cell holds the remaining depth (layers above the board).
// A stroke stamps a soft-edged disc along its segment and removes depth from covered cells.
// Core cells expose the hidden figure once their depth drops to CORE_EXPOSE_DEPTH.

import { getSoap, corePattern, GRID_W, GRID_H, TOOLS } from "./soaps.mjs";

export const CORE_EXPOSE_DEPTH = 1;
export const COMPLETE_REMAINING = 0.05;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function defaultSeed(soapId) {
  return hashSeed(String(soapId));
}

export function createGame(soapId, seed = defaultSeed(soapId)) {
  const def = getSoap(soapId);
  const pattern = corePattern(def.core);
  const cells = new Array(GRID_W * GRID_H).fill(def.layers);
  const core = new Array(GRID_W * GRID_H).fill(0);
  if (pattern) {
    for (let y = 0; y < GRID_H; y += 1) {
      const row = pattern[y] ?? "";
      for (let x = 0; x < GRID_W; x += 1) {
        if (row[x] === "#") core[y * GRID_W + x] = 1;
      }
    }
  }
  const totalDepth = cells.length * def.layers;
  return {
    soapId: def.id,
    material: def.material,
    layers: def.layers,
    w: GRID_W,
    h: GRID_H,
    cells,
    core,
    coreExposed: false,
    totalDepth,
    removedDepth: 0,
    cuts: 0,
    strokes: 0,
    seed: seed >>> 0,
    rngState: seed >>> 0,
    complete: false,
    won: false,
  };
}

export function remainingRatio(state) {
  if (!state || state.totalDepth <= 0) return 1;
  return Math.max(0, 1 - state.removedDepth / state.totalDepth);
}

export function shapeRatio(state) {
  if (!state) return 1;
  let total = 0;
  let revealed = 0;
  for (let i = 0; i < state.core.length; i += 1) {
    if (state.core[i] !== 1) continue;
    total += 1;
    if (state.cells[i] <= CORE_EXPOSE_DEPTH) revealed += 1;
  }
  return total === 0 ? 1 : revealed / total;
}

export function hasCore(state) {
  return Boolean(state && state.core.some((value) => value === 1));
}

function markComplete(state, won) {
  return { ...state, complete: true, won };
}

export function isComplete(state) {
  if (!state || state.complete) return Boolean(state?.complete);
  if (remainingRatio(state) <= COMPLETE_REMAINING) return true;
  if (hasCore(state) && shapeRatio(state) >= 1) return true;
  return false;
}

// Manual cleanup: sweep the last few crumbs off the board. Pure, no-op after completion.
export function finishCleanup(state) {
  if (!state || state.complete) return { state, events: [] };
  if (remainingRatio(state) > 0.1 && !(hasCore(state) && shapeRatio(state) >= 0.9)) {
    return { state, events: [] };
  }
  const cells = state.cells.map(() => 0);
  return {
    state: markComplete({ ...state, cells, removedDepth: state.totalDepth }, true),
    events: [{ type: "cleanup" }],
  };
}

function nextRandom(state) {
  const value = mulberry32(state.rngState)();
  return { value, rngState: (state.rngState + 0x9e3779b9) >>> 0 };
}

function speedFactor(speed) {
  const s = Number.isFinite(speed) ? Math.max(0, Math.min(3000, speed)) : 300;
  return Math.max(0.55, Math.min(1.2, 1.18 - s / 2600));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// stroke: { from: {x,y}, to: {x,y}, speed: px/s (optional), tool: tool id, intensity (optional) }
// Coordinates are in grid cells (cell centers at integer x/y), blade radius comes from the tool.
export function applyStroke(state, stroke) {
  if (!state || state.complete || !stroke || !stroke.from || !stroke.to) {
    return { state, events: [] };
  }
  const tool = TOOLS[stroke.tool] ?? TOOLS.tool_knife;
  const from = stroke.from;
  const to = stroke.to;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const radius = tool.width / 2;
  const intensity = Number.isFinite(stroke.intensity) ? Math.max(0.2, Math.min(2, stroke.intensity)) : 1;
  const removeBase = tool.depth * speedFactor(stroke.speed) * intensity;
  const step = Math.max(0.18, Math.min(0.5, radius * 0.5));
  const samples = Math.max(1, Math.ceil(length / step));
  const reach = Math.ceil(radius) + 1;

  const cells = state.cells.slice();
  const chips = [];
  let rngState = state.rngState;
  let removedDepth = 0;
  let cuts = 0;
  let coreNowExposed = state.coreExposed;

  const stamp = (cx, cy) => {
    const x0 = Math.max(0, Math.floor(cx - reach));
    const x1 = Math.min(state.w - 1, Math.ceil(cx + reach));
    const y0 = Math.max(0, Math.floor(cy - reach));
    const y1 = Math.min(state.h - 1, Math.ceil(cy + reach));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const index = y * state.w + x;
        const depth = cells[index];
        if (depth <= 0) continue;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > radius) continue;
        const falloff = clamp01(1 - (dist / radius) * 0.55);
        const amount = Math.min(depth, removeBase * falloff);
        if (amount <= 0) continue;
        cells[index] = Math.max(0, depth - amount);
        removedDepth += amount;
        cuts += 1;

        const roll = nextRandom({ rngState });
        rngState = roll.rngState;
        chips.push({
          x,
          y,
          depth: amount,
          style: tool.chip,
          scatter: roll.value,
        });

        if (state.core[index] === 1 && !coreNowExposed && cells[index] <= CORE_EXPOSE_DEPTH) {
          coreNowExposed = true;
        }
      }
    }
  };

  stamp(from.x, from.y);
  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    stamp(from.x + dx * t, from.y + dy * t);
  }

  const next = {
    ...state,
    cells,
    removedDepth: state.removedDepth + removedDepth,
    cuts: state.cuts + cuts,
    strokes: state.strokes + 1,
    rngState,
    coreExposed: coreNowExposed,
  };
  const events = [];
  if (chips.length) events.push({ type: "cut", chips, tool: tool.id, speed: stroke.speed ?? 300 });
  if (!state.coreExposed && coreNowExposed) events.push({ type: "core" });

  let final = next;
  if (isComplete(next)) {
    final = markComplete(next, true);
    events.push({ type: "complete" });
  }
  return { state: final, events };
}

export function snapshotCells(state) {
  return state ? state.cells.slice() : [];
}
