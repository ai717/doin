// unravel engine — rules authority. Pure functions, strictly DOM-free.
// Core model: a tangled yarn object made of strands. Each strand carries one or
// two color chips. A strand is free (collectable) only when every strand that
// visually crosses over it is already collected. Collecting a strand pushes its
// chips into the slot rack; three chips of the same color merge and clear.
// Boards are reverse-generated from a feasible solution order, then verified by
// a solver, so every level is guaranteed solvable.

export const SLOT_CAP_LEVEL = 6;
export const SLOT_CAP_RELAX = 99;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(next) {
  return {
    next,
    int(n) {
      return Math.floor(next() * n);
    },
    pick(list) {
      return list[this.int(list.length)];
    },
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = this.int(i + 1);
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}

// ---- strand geometry (shared math for engine coverage + ui painting) ----

export const STAGE = { w: 100, h: 62, hubX: 50, hubY: 30, hubR: 23 };

function sampleChord(rng) {
  const theta = rng.next() * Math.PI * 2;
  const span = ((60 + rng.next() * 90) / 2) * (Math.PI / 180);
  const radius = STAGE.hubR * (0.78 + rng.next() * 0.34);
  const jitterX = (rng.next() - 0.5) * 3;
  const jitterY = (rng.next() - 0.5) * 3;
  const x1 = STAGE.hubX + Math.cos(theta - span) * radius + jitterX;
  const y1 = STAGE.hubY + Math.sin(theta - span) * radius + jitterY;
  const x2 = STAGE.hubX + Math.cos(theta + span) * radius + jitterX;
  const y2 = STAGE.hubY + Math.sin(theta + span) * radius + jitterY;
  const bow = (7 + rng.next() * 11) * (rng.next() < 0.5 ? -1 : 1);
  return { x1, y1, x2, y2, bow };
}

export function pathControl(p) {
  const dx = p.x2 - p.x1;
  const dy = p.y2 - p.y1;
  const len = Math.hypot(dx, dy) || 1;
  return {
    cx: (p.x1 + p.x2) / 2 + (-dy / len) * p.bow,
    cy: (p.y1 + p.y2) / 2 + (dx / len) * p.bow,
  };
}

export function pathD(p) {
  const c = pathControl(p);
  return `M ${p.x1.toFixed(2)} ${p.y1.toFixed(2)} Q ${c.cx.toFixed(2)} ${c.cy.toFixed(2)} ${p.x2.toFixed(2)} ${p.y2.toFixed(2)}`;
}

function chordPoints(p) {
  const c = pathControl(p);
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const u = 1 - t;
    pts.push([
      u * u * p.x1 + 2 * u * t * c.cx + t * t * p.x2,
      u * u * p.y1 + 2 * u * t * c.cy + t * t * p.y2,
    ]);
  }
  return pts;
}

function chordDistance(a, b) {
  const pa = chordPoints(a);
  const pb = chordPoints(b);
  let best = Infinity;
  for (const p of pa) {
    for (const q of pb) {
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d < best) best = d;
      if (best < 2.7) return best;
    }
  }
  return best;
}

function chordsCross(a, b) {
  return chordDistance(a, b) < 2.7;
}

// ---- board generation (reverse generation, 100% solvable) ----

export function strandChips(strand) {
  return strand.dual ? [strand.color, strand.dual] : [strand.color];
}

export function resolveMerges(slots) {
  const out = slots.slice();
  const merges = [];
  let changed = true;
  while (changed) {
    changed = false;
    const counts = new Map();
    for (const chip of out) counts.set(chip, (counts.get(chip) || 0) + 1);
    for (const color of counts.keys()) {
      if ((counts.get(color) || 0) >= 3) {
        let removed = 0;
        for (let i = out.length - 1; i >= 0 && removed < 3; i--) {
          if (out[i] === color) {
            out.splice(i, 1);
            removed++;
          }
        }
        merges.push({ color });
        changed = true;
      }
    }
  }
  return { slots: out, merges };
}

function simulateOrder(order, cap) {
  let slots = [];
  for (const strand of order) {
    const chips = strandChips(strand);
    if (slots.length + chips.length > cap) return false;
    slots = slots.concat(chips);
    const res = resolveMerges(slots);
    slots = res.slots;
    if (slots.length >= cap) return false;
  }
  return true;
}

function pickFeasibleOrder(strands, cap, rng, attempts) {
  for (let t = 0; t < attempts; t++) {
    const order = rng.shuffle(strands);
    if (simulateOrder(order, cap)) return order;
  }
  const dualList = strands.filter((s) => s.dual);
  const singleList = strands.filter((s) => !s.dual);
  const groups = new Map();
  for (const s of singleList) {
    if (!groups.has(s.color)) groups.set(s.color, []);
    groups.get(s.color).push(s);
  }
  const grouped = [];
  for (const list of groups.values()) grouped.push(...list);
  const arrangements = [
    grouped.concat(dualList),
    dualList.concat(grouped),
    rng.shuffle(strands),
  ];
  for (const order of arrangements) {
    if (simulateOrder(order, cap)) return order;
  }
  return null;
}

function pickChord(rng, placed, needClean) {
  let fallback = null;
  let fallbackCrossings = Infinity;
  for (let attempt = 0; attempt < 60; attempt++) {
    const chord = sampleChord(rng);
    let crossings = 0;
    for (const other of placed) {
      if (chordsCross(chord, other)) crossings++;
    }
    if (crossings === 0) return chord;
    if (crossings < fallbackCrossings) {
      fallbackCrossings = crossings;
      fallback = chord;
    }
    if (!needClean && attempt > 12 && fallback) return fallback;
  }
  return fallback || sampleChord(rng);
}

function tryGenerate(params, seed, duals, mode, cap, shuffleAttempts) {
  const rng = makeRng(mulberry32(seed));
  const chips = [];
  for (const color of params.colors) {
    for (let i = 0; i < params.triplets * 3; i++) chips.push({ color });
  }
  const dualStrands = [];
  for (let d = 0; d < duals; d++) {
    let a = -1;
    let b = -1;
    for (let tries = 0; tries < 60 && a < 0; tries++) {
      const i = rng.int(chips.length);
      const j = rng.int(chips.length);
      if (i !== j && chips[i].color !== chips[j].color) {
        a = i;
        b = j;
      }
    }
    if (a < 0) break;
    dualStrands.push({ color: chips[a].color, dual: chips[b].color, knot: false });
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    chips.splice(hi, 1);
    chips.splice(lo, 1);
  }
  const singles = chips.map((c) => ({ color: c.color, dual: null, knot: false }));
  const strands = rng.shuffle(singles.concat(dualStrands));
  strands.forEach((s, i) => {
    s.id = "k" + (i + 1);
  });
  const n = strands.length;
  if (n < 3) return null;

  const order = pickFeasibleOrder(strands, cap, rng, shuffleAttempts ?? 240);
  if (!order) return null;

  const knotCount = Math.min(params.knots ?? 0, Math.floor(n / 3));
  const knotIds = rng.shuffle(strands.map((s) => s.id)).slice(0, knotCount);

  // geometry: assigned in solution order; the first minFree strands are kept
  // uncrossed so at least minFree strands are free on the open board.
  const minFree = Math.min(params.minFree ?? 2, n - 1);
  const paths = [];
  for (let j = 0; j < n; j++) {
    paths.push(pickChord(rng, paths, j < minFree));
  }

  // coverage: every earlier strand whose path crosses becomes a blocker, so the
  // picture always tells the truth about what presses on what.
  const byId = new Map();
  order.forEach((strand, j) => {
    const covers = [];
    for (let k = j - 1; k >= 0 && covers.length < 6; k--) {
      if (chordsCross(paths[k], paths[j])) covers.push(order[k].id);
    }
    byId.set(strand.id, covers);
  });
  knotIds.forEach((id) => {
    const s = strands.find((x) => x.id === id);
    if (s) s.knot = true;
  });

  const strandList = strands.map((s, i) => {
    const j = order.indexOf(s);
    return {
      id: s.id,
      color: s.color,
      dual: s.dual || null,
      knot: !!s.knot,
      layer: j,
      coveredBy: byId.get(s.id) || [],
      path: paths[j],
    };
  });

  return {
    id: params.id,
    mode,
    cap,
    object: params.object,
    colors: params.colors.slice(),
    parMs: params.parMs,
    strands: strandList,
    solution: order.map((s) => s.id),
  };
}

export function generateBoard(params, seed, mode = "level") {
  const cap = mode === "relax" ? SLOT_CAP_RELAX : SLOT_CAP_LEVEL;
  for (let duals = params.duals ?? 0; duals >= 0; duals--) {
    const board = tryGenerate(params, seed, duals, mode, cap);
    if (board) return board;
  }
  const board = tryGenerate(params, seed, 0, mode, cap, 2000);
  if (!board) throw new Error("unravel: board generation failed");
  return board;
}

// ---- game state ----

export function createGame(board) {
  return {
    id: board.id,
    mode: board.mode,
    cap: board.cap,
    collected: [],
    untied: {},
    slots: [],
    status: "playing",
    stats: { collects: 0, unties: 0, slotPeak: 0 },
  };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function findStrand(board, id) {
  return board.strands.find((s) => s.id === id) || null;
}

export function isFree(board, state, id) {
  const strand = findStrand(board, id);
  if (!strand) return false;
  return strand.coveredBy.every((c) => state.collected.includes(c));
}

export function isColorDone(board, state, color) {
  const remaining = board.strands.some(
    (s) => (s.color === color || s.dual === color) && !state.collected.includes(s.id),
  );
  if (remaining) return false;
  return !state.slots.includes(color);
}

function countColor(slots, color) {
  let n = 0;
  for (const chip of slots) if (chip === color) n++;
  return n;
}

function applyChips(board, state, strand) {
  const chips = strandChips(strand);
  state.slots = state.slots.concat(chips);
  const res = resolveMerges(state.slots);
  state.slots = res.slots;
  const completed = [];
  for (const merge of res.merges) {
    if (isColorDone(board, state, merge.color)) completed.push(merge.color);
  }
  return { chips, merges: res.merges, completed };
}

export function tryCollect(board, state, id) {
  if (!state || state.status !== "playing") return { state, event: null };
  const strand = findStrand(board, id);
  if (!strand || state.collected.includes(id)) return { state, event: null };
  if (!isFree(board, state, id)) return { state, event: null };
  if (strand.knot && !state.untied[id]) return { state, event: null };
  if (state.slots.length + strandChips(strand).length > board.cap) {
    return { state, event: null };
  }
  const next = cloneState(state);
  next.collected.push(id);
  const outcome = applyChips(board, next, strand);
  next.stats.collects += 1;
  if (next.slots.length > next.stats.slotPeak) next.stats.slotPeak = next.slots.length;
  let status = "playing";
  if (next.collected.length === board.strands.length) {
    status = "won";
  } else if (board.mode === "level" && next.slots.length >= board.cap) {
    status = "lost";
  }
  next.status = status;
  return {
    state: next,
    event: {
      type: "collect",
      id,
      chips: outcome.chips,
      merges: outcome.merges,
      completed: outcome.completed,
      status,
    },
  };
}

export function tryUntie(board, state, id) {
  if (!state || state.status !== "playing") return { state, event: null };
  const strand = findStrand(board, id);
  if (!strand || !strand.knot || state.untied[id]) return { state, event: null };
  if (!isFree(board, state, id)) return { state, event: null };
  const next = cloneState(state);
  next.untied[id] = true;
  next.stats.unties += 1;
  return { state: next, event: { type: "untie", id } };
}

export function freeStrands(board, state) {
  return board.strands
    .filter((s) => !state.collected.includes(s.id) && isFree(board, state, s.id))
    .sort((a, b) => a.layer - b.layer);
}

// One-step hint: prefer a strand that completes or extends a slot color.
export function hint(board, state) {
  if (!state || state.status !== "playing") return null;
  let best = null;
  let untieCandidate = null;
  for (const strand of freeStrands(board, state)) {
    if (strand.knot && !state.untied[strand.id]) {
      if (!untieCandidate) untieCandidate = { kind: "untie", id: strand.id };
      continue;
    }
    const colors = strandChips(strand);
    if (state.slots.length + colors.length > state.cap) continue;
    let score = 0;
    for (const color of colors) score = Math.max(score, countColor(state.slots, color));
    if (!best || score > best.score) best = { kind: "collect", id: strand.id, score };
  }
  if (best) return { kind: best.kind, id: best.id };
  return untieCandidate;
}

// ---- solver (verifies solvability; slots are a pure function of the collected
// set because merges always reduce each color count modulo three) ----

export function solveBoard(board, nodeBudget = 120000) {
  const n = board.strands.length;
  const idx = new Map(board.strands.map((s, i) => [s.id, i]));
  const rank = new Map(board.solution.map((id, i) => [id, i]));
  const chips = board.strands.map(strandChips);
  const covers = board.strands.map((s) => s.coveredBy.map((c) => idx.get(c)));
  const full = (1 << n) - 1;
  const failed = new Set();
  let nodes = 0;

  function dfs(mask, slots, out) {
    if (mask === full) return true;
    if (nodes++ > nodeBudget) return false;
    if (failed.has(mask)) return false;
    const cands = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) continue;
      let free = true;
      for (const c of covers[i]) {
        if (!(mask & (1 << c))) {
          free = false;
          break;
        }
      }
      if (free) cands.push(i);
    }
    cands.sort((a, b) => rank.get(board.strands[a].id) - rank.get(board.strands[b].id));
    for (const i of cands) {
      if (slots.length + chips[i].length > board.cap) continue;
      const res = resolveMerges(slots.concat(chips[i]));
      if (res.slots.length >= board.cap) continue;
      out.push(i);
      if (dfs(mask | (1 << i), res.slots, out)) return true;
      out.pop();
    }
    failed.add(mask);
    return false;
  }

  const out = [];
  if (!dfs(0, [], out)) return null;
  return out.map((i) => board.strands[i].id);
}
