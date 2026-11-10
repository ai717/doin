// Tuning aid: sweeps candidate walls around a stage, keeps only the layouts
// where the "just drag at the loot" route dies but the stage stays solvable.
//   node scripts/thief-tune-stage.mjs <id> [id...]
import { LEVELS } from "../games/thief/js/levels.mjs";
import { createState, dragTo, dist, pathClearance } from "../games/thief/js/engine.mjs";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function solve(stage, maxDepth = 8) {
  const rng = mulberry32(20261110);
  const grid = [];
  for (let x = 70; x <= 790; x += 36) for (let y = 60; y <= 520; y += 36) grid.push({ x, y });
  const key = (state) =>
    `${Math.round(state.hand.x / 24)}:${Math.round(state.hand.y / 24)}:${state.wraps.map((w) => `${w.peg}${w.side}`).join("")}`;
  const score = (state, n) => dist(state.hand, stage.target) + 0.28 * state.travelled + 26 * n;
  let beam = [{ state: createState(stage), route: [], score: 0 }];
  const seen = new Set([key(beam[0].state)]);
  for (let d = 0; d < maxDepth; d += 1) {
    const pool = [];
    for (const node of beam) {
      const options = grid
        .filter((p) => {
          const dd = dist(node.state.hand, p);
          return dd > 24 && dd < 170;
        })
        .sort((a, b) => dist(a, stage.target) - dist(b, stage.target))
        .slice(0, 26);
      for (let i = 0; i < 6; i += 1) options.push(grid[Math.floor(rng() * grid.length)]);
      for (const p of options) {
        if (dist(node.state.hand, p) <= 24) continue;
        const next = dragTo(stage, node.state, p);
        if (next.status === "shock") continue;
        const route = [...node.route, p];
        if (next.status === "retract" || next.status === "won") return { route, state: next };
        const k = key(next);
        if (seen.has(k)) continue;
        seen.add(k);
        pool.push({ state: next, route, score: score(next, route.length) });
      }
    }
    pool.sort((a, b) => a.score - b.score);
    beam = pool.slice(0, 14);
    if (!beam.length) return null;
  }
  return null;
}

const ok = (state) => state.status === "retract" || state.status === "won";

for (const id of process.argv.slice(2).map(Number)) {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) continue;
  const naive = dragTo(level, createState(level), level.target);
  console.log(`\n== stage ${id} (naive ${ok(naive) ? "CLEARS" : "dies:" + naive.failure?.kind}) ==`);
  const results = [];
  const T = level.target;
  for (let x = 240; x <= 700; x += 60) {
    for (const gapAt of ["top", "bottom"]) {
      const beam =
        gapAt === "top"
          ? { x1: x, y1: 56, x2: x, y2: 340 }
          : { x1: x, y1: 240, x2: x, y2: 528 };
      const stage = { ...level, lasers: [...level.lasers, beam] };
      if (ok(dragTo(stage, createState(stage), T))) continue;
      const found = solve(stage);
      if (!found) continue;
      const clear = pathClearance(stage, found.state);
      if (!Number.isFinite(clear) || clear < 12) continue;
      results.push({ gapAt, beam, route: found.route, clear: Number(clear.toFixed(1)) });
    }
  }
  results.sort((a, b) => b.clear - a.clear);
  for (const r of results.slice(0, 5)) {
    console.log(`  ${r.gapAt.padEnd(6)} wall x=${r.beam.x1} y=${r.beam.y1}..${r.beam.y2} clear=${r.clear}`);
    console.log(`     route: ${r.route.map((p) => `{ x: ${Math.round(p.x)}, y: ${Math.round(p.y)} }`).join(", ")}`);
  }
  if (!results.length) console.log("  no wall keeps the stage solvable");
}
