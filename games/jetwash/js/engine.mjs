// Pure washing rules. DOM-free, deterministic: same level seed + same pointer
// path with the same dt sequence -> same state. Cleaning is dwell-time based:
// a cell loses grime in proportion to how long the tool stays over it, not how
// fast the pointer moves. Every tool removes every stain layer at a positive
// rate, so no cell is unwashable. Foam is a temporary softening buff.

import { levelById, TOOLS, STAINS } from "./levels.mjs";

export const GRID_W = 48;
export const GRID_H = 30;
export const COMPLETE_REMAINING = 0.005;

// Shape primitives are shared by the engine mask and the Canvas renderer, so
// the washable area always matches the visible object silhouette.
export const SHAPES = {
  sedan: [
    { kind: "poly", pts: [[0.06, 0.56], [0.14, 0.43], [0.36, 0.34], [0.62, 0.34], [0.79, 0.45], [0.93, 0.51], [0.95, 0.65], [0.86, 0.69], [0.13, 0.69], [0.05, 0.65]] },
    { kind: "ellipse", cx: 0.26, cy: 0.69, rx: 0.075, ry: 0.075 },
    { kind: "ellipse", cx: 0.75, cy: 0.69, rx: 0.075, ry: 0.075 },
  ],
  suv: [
    { kind: "poly", pts: [[0.07, 0.40], [0.14, 0.23], [0.82, 0.23], [0.92, 0.34], [0.95, 0.61], [0.87, 0.68], [0.12, 0.68], [0.05, 0.60]] },
    { kind: "ellipse", cx: 0.25, cy: 0.68, rx: 0.08, ry: 0.08 },
    { kind: "ellipse", cx: 0.77, cy: 0.68, rx: 0.08, ry: 0.08 },
  ],
  van: [
    { kind: "poly", pts: [[0.05, 0.34], [0.11, 0.20], [0.84, 0.20], [0.95, 0.30], [0.96, 0.64], [0.89, 0.69], [0.10, 0.69], [0.04, 0.63]] },
    { kind: "ellipse", cx: 0.24, cy: 0.69, rx: 0.08, ry: 0.08 },
    { kind: "ellipse", cx: 0.78, cy: 0.69, rx: 0.08, ry: 0.08 },
  ],
  sports: [
    { kind: "poly", pts: [[0.04, 0.59], [0.20, 0.47], [0.39, 0.39], [0.58, 0.39], [0.75, 0.50], [0.94, 0.57], [0.96, 0.65], [0.86, 0.69], [0.14, 0.69], [0.03, 0.65]] },
    { kind: "ellipse", cx: 0.27, cy: 0.69, rx: 0.07, ry: 0.07 },
    { kind: "ellipse", cx: 0.74, cy: 0.69, rx: 0.07, ry: 0.07 },
  ],
  pickup: [
    { kind: "poly", pts: [[0.04, 0.43], [0.18, 0.31], [0.40, 0.31], [0.49, 0.42], [0.96, 0.42], [0.96, 0.63], [0.88, 0.68], [0.10, 0.68], [0.03, 0.62]] },
    { kind: "ellipse", cx: 0.25, cy: 0.68, rx: 0.08, ry: 0.08 },
    { kind: "ellipse", cx: 0.77, cy: 0.68, rx: 0.08, ry: 0.08 },
  ],
  bus: [
    { kind: "poly", pts: [[0.03, 0.24], [0.10, 0.16], [0.90, 0.16], [0.97, 0.25], [0.97, 0.63], [0.90, 0.70], [0.10, 0.70], [0.03, 0.63]] },
    { kind: "ellipse", cx: 0.23, cy: 0.70, rx: 0.08, ry: 0.08 },
    { kind: "ellipse", cx: 0.79, cy: 0.70, rx: 0.08, ry: 0.08 },
  ],
  sofa: [
    { kind: "rect", x: 0.09, y: 0.27, w: 0.82, h: 0.27 },
    { kind: "rect", x: 0.07, y: 0.50, w: 0.86, h: 0.25 },
    { kind: "rect", x: 0.04, y: 0.42, w: 0.09, h: 0.33 },
    { kind: "rect", x: 0.87, y: 0.42, w: 0.09, h: 0.33 },
  ],
  carpet: [{ kind: "rect", x: 0.07, y: 0.22, w: 0.86, h: 0.58 }],
  stove: [
    { kind: "rect", x: 0.10, y: 0.24, w: 0.80, h: 0.54 },
    { kind: "ellipse", cx: 0.30, cy: 0.40, rx: 0.10, ry: 0.08 },
    { kind: "ellipse", cx: 0.70, cy: 0.40, rx: 0.10, ry: 0.08 },
    { kind: "ellipse", cx: 0.30, cy: 0.62, rx: 0.10, ry: 0.08 },
    { kind: "ellipse", cx: 0.70, cy: 0.62, rx: 0.10, ry: 0.08 },
  ],
  bathtub: [
    { kind: "poly", pts: [[0.10, 0.39], [0.90, 0.39], [0.86, 0.69], [0.14, 0.69]] },
    { kind: "ellipse", cx: 0.50, cy: 0.52, rx: 0.33, ry: 0.11 },
  ],
  table: [
    { kind: "rect", x: 0.07, y: 0.33, w: 0.86, h: 0.13 },
    { kind: "rect", x: 0.13, y: 0.46, w: 0.11, h: 0.33 },
    { kind: "rect", x: 0.76, y: 0.46, w: 0.11, h: 0.33 },
  ],
  window: [{ kind: "rect", x: 0.12, y: 0.14, w: 0.76, h: 0.72 }],
};

export const NOZZLES = ["wide", "narrow"];

// Removal per second at stamp centre. All entries > 0 (washability guarantee).
const EFFICIENCY = {
  tool_jet: { stain_dust: 1.7, stain_grease: 0.38, stain_stubborn: 0.14, foam: 0.30 },
  tool_foam: { stain_dust: 0.55, stain_grease: 0.28, stain_stubborn: 0.12, foam: -1.25 },
  tool_brush: { stain_dust: 0.75, stain_grease: 1.15, stain_stubborn: 1.55, foam: 0.18 },
  tool_squeegee: { stain_dust: 1.00, stain_grease: 0.78, stain_stubborn: 0.55, foam: 1.90 },
};

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

export function defaultSeed(levelId) {
  return hashSeed(String(levelId));
}

function insidePrimitive(prim, u, v) {
  if (prim.kind === "rect") {
    return u >= prim.x && u <= prim.x + prim.w && v >= prim.y && v <= prim.y + prim.h;
  }
  if (prim.kind === "ellipse") {
    const dx = (u - prim.cx) / prim.rx;
    const dy = (v - prim.cy) / prim.ry;
    return dx * dx + dy * dy <= 1;
  }
  const pts = prim.pts;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isInside(shape, u, v) {
  const prims = SHAPES[shape];
  if (!prims) return false;
  return prims.some((prim) => insidePrimitive(prim, u, v));
}

function valueField(rng, cols, rows) {
  const grid = new Float32Array((cols + 1) * (rows + 1));
  for (let i = 0; i < grid.length; i += 1) grid[i] = rng();
  return (u, v) => {
    const gx = Math.min(cols - 1, Math.max(0, Math.floor(u * cols)));
    const gy = Math.min(rows - 1, Math.max(0, Math.floor(v * rows)));
    const tx = Math.min(1, Math.max(0, u * cols - gx));
    const ty = Math.min(1, Math.max(0, v * rows - gy));
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const row = rows + 1;
    const a = grid[gy * row + gx];
    const b = grid[gy * row + gx + 1];
    const c = grid[(gy + 1) * row + gx];
    const d = grid[(gy + 1) * row + gx + 1];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}

function cloneArrays(state) {
  return {
    ...state,
    dust: state.dust.slice(),
    grease: state.grease.slice(),
    stubborn: state.stubborn.slice(),
    foam: state.foam.slice(),
  };
}

export function createGame(levelId, seed = defaultSeed(levelId)) {
  const def = levelById(levelId);
  if (!def) return null;
  const rng = mulberry32(seed >>> 0);
  const fields = {
    stain_dust: valueField(rng, 7, 5),
    stain_grease: valueField(rng, 5, 4),
    stain_stubborn: valueField(rng, 4, 3),
  };
  const n = GRID_W * GRID_H;
  const mask = new Array(n).fill(0);
  const dust = new Array(n).fill(0);
  const grease = new Array(n).fill(0);
  const stubborn = new Array(n).fill(0);
  const foam = new Array(n).fill(0);
  let total = 0;

  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const i = y * GRID_W + x;
      const u = (x + 0.5) / GRID_W;
      const v = (y + 0.5) / GRID_H;
      if (!isInside(def.shape, u, v)) continue;
      mask[i] = 1;
      let cellTotal = 0;
      for (const stain of STAINS) {
        const coverage = def.layers[stain];
        if (coverage <= 0) continue;
        const field = fields[stain](u, v);
        // Dust is a thin pale veil over the whole object. Grease and stubborn
        // stains are thresholded into distinct dark patches so peeling layer
        // by layer is visible to the eye, not just in the numbers.
        let shape;
        if (stain === "stain_dust") shape = 0.22 + 0.72 * field;
        else if (stain === "stain_grease") shape = Math.min(1, Math.max(0, (field - 0.42) * 2.4));
        else shape = Math.min(1, Math.max(0, (field - 0.52) * 2.9));
        const amount = Math.min(1, Math.max(0, coverage * shape));
        if (stain === "stain_dust") dust[i] = amount;
        else if (stain === "stain_grease") grease[i] = amount;
        else stubborn[i] = amount;
        cellTotal += amount;
      }
      total += cellTotal;
    }
  }

  return {
    levelId: def.id,
    shape: def.shape,
    base: def.base,
    seed: seed >>> 0,
    w: GRID_W,
    h: GRID_H,
    mask,
    dust,
    grease,
    stubborn,
    foam,
    totalInitial: total,
    totalRemaining: total,
    elapsed: 0,
    tool: TOOLS[0],
    nozzle: NOZZLES[0],
    complete: false,
    strokes: 0,
    cleanedCells: 0,
    lastClean: [],
  };
}

function fail(state, event) {
  return { ok: false, state, event, cleaned: 0, cells: [] };
}

export function setTool(state, tool) {
  if (!TOOLS.includes(tool)) return fail(state, "noop");
  if (state.tool === tool) return { ok: false, state, event: "noop", cleaned: 0, cells: [] };
  return { ok: true, state: { ...state, tool }, event: "tool", cleaned: 0, cells: [] };
}

export function setNozzle(state, nozzle) {
  if (!NOZZLES.includes(nozzle)) return fail(state, "noop");
  if (state.nozzle === nozzle) return fail(state, "noop");
  return { ok: true, state: { ...state, nozzle }, event: "nozzle", cleaned: 0, cells: [] };
}

export function toggleNozzle(state) {
  return setNozzle(state, state.nozzle === "wide" ? "narrow" : "wide");
}

function layerAmount(state, stain, i) {
  if (stain === "stain_dust") return state.dust[i];
  if (stain === "stain_grease") return state.grease[i];
  return state.stubborn[i];
}

function reduceLayer(next, stain, i, amount) {
  if (stain === "stain_dust") next.dust[i] = Math.max(0, next.dust[i] - amount);
  else if (stain === "stain_grease") next.grease[i] = Math.max(0, next.grease[i] - amount);
  else next.stubborn[i] = Math.max(0, next.stubborn[i] - amount);
}

// Pointer is in normalized [0,1] canvas coordinates. dt is seconds.
export function applyWash(state, pointer, dt) {
  if (state.complete || !pointer) return fail(state, "noop");
  const step = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
  if (step <= 0) return fail(state, "noop");
  const eff = EFFICIENCY[state.tool];
  if (!eff) return fail(state, "noop");

  const radius = state.nozzle === "wide" ? 0.085 : 0.036;
  const power = state.nozzle === "wide" ? 1 : 2.3;
  const next = cloneArrays(state);
  const cells = [];
  let cleaned = 0;

  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const i = y * GRID_W + x;
      if (!state.mask[i]) continue;
      const u = (x + 0.5) / GRID_W;
      const v = (y + 0.5) / GRID_H;
      const dx = u - pointer.x;
      const dy = v - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > radius * radius) continue;
      const falloff = 1 - d2 / (radius * radius);
      const foam = state.foam[i];
      const soften = foam > 0 ? 1 + 1.2 * foam : 1;

      for (const stain of STAINS) {
        const before = layerAmount(state, stain, i);
        if (before <= 0) continue;
        let rate = eff[stain];
        if (stain !== "stain_dust") rate *= soften;
        const remove = Math.min(before, rate * power * falloff * step);
        reduceLayer(next, stain, i, remove);
        cleaned += remove;
      }

      let foamDelta = 0;
      if (state.tool === "tool_foam") {
        foamDelta = (d2 < (radius * 0.7) * (radius * 0.7) ? 1.25 : 0.8) * step;
      } else if (eff.foam > 0) {
        // Water/brush/squeegee scrub away the softening layer.
        foamDelta = -eff.foam * falloff * step;
      }
      next.foam[i] = Math.min(1, Math.max(0, foam + foamDelta));

      const after = next.dust[i] + next.grease[i] + next.stubborn[i];
      const beforeTotal = state.dust[i] + state.grease[i] + state.stubborn[i];
      if (beforeTotal > 0 && after <= 0.0001) {
        cells.push(i);
        next.cleanedCells += 1;
      }
    }
  }

  // Natural foam decay everywhere, independent of the stamp.
  for (let i = 0; i < next.foam.length; i += 1) {
    if (next.foam[i] > 0) next.foam[i] = Math.max(0, next.foam[i] - 0.11 * step);
  }

  next.elapsed = state.elapsed + step;
  next.totalRemaining = Math.max(0, state.totalRemaining - cleaned);
  next.lastClean = cells;
  if (next.totalRemaining <= state.totalInitial * COMPLETE_REMAINING) {
    next.totalRemaining = 0;
    next.dust.fill(0);
    next.grease.fill(0);
    next.stubborn.fill(0);
    next.complete = true;
    return { ok: true, state: next, event: "complete", cleaned, cells };
  }
  return { ok: true, state: next, event: "wash", cleaned, cells };
}

export function cleanliness(state) {
  if (!state || state.totalInitial <= 0) return 1;
  if (state.complete) return 1;
  return Math.min(1, Math.max(0, 1 - state.totalRemaining / state.totalInitial));
}

export function resetGame(state) {
  return createGame(state.levelId, state.seed);
}

export function checkInvariants(state) {
  if (!state) return "missing state";
  const n = GRID_W * GRID_H;
  for (const key of ["mask", "dust", "grease", "stubborn", "foam"]) {
    if (!Array.isArray(state[key]) || state[key].length !== n) return `bad ${key}`;
  }
  if (state.totalRemaining < -1e-6 || state.totalRemaining > state.totalInitial + 1e-6) return "bad remaining";
  if (!TOOLS.includes(state.tool) || !NOZZLES.includes(state.nozzle)) return "bad tool";
  if (state.elapsed < 0) return "bad elapsed";
  for (let i = 0; i < n; i += 1) {
    if (state.foam[i] < 0 || state.foam[i] > 1) return `bad foam at ${i}`;
    if (state.dust[i] < 0 || state.grease[i] < 0 || state.stubborn[i] < 0) return `bad stain at ${i}`;
  }
  if (state.complete && state.totalRemaining !== 0) return "complete with residue";
  return null;
}
