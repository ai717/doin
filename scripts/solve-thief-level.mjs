// Route finder: proves a stage is beatable and prints a waypoint list that the
// level file can ship as its authored solution.
//   node scripts/solve-thief-level.mjs <id> [--depth 8]
// Beam search over glove positions; each expansion is replayed through the real
// engine, so a returned route is a genuine playthrough.
import { LEVELS } from "../games/thief/js/levels.mjs";
import { createState, dragTo, dist } from "../games/thief/js/engine.mjs";

const id = Number(process.argv[2] ?? 1);
const depthArg = process.argv.indexOf("--depth");
const maxDepth = depthArg > -1 ? Number(process.argv[depthArg + 1]) : 8;
const level = LEVELS.find((l) => l.id === id);
if (!level) {
  console.error("unknown stage", id);
  process.exit(1);
}

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
const rng = mulberry32(20261110);

const grid = [];
for (let x = 70; x <= 790; x += 36) for (let y = 60; y <= 520; y += 36) grid.push({ x, y });

const BEAM = 14;
const SPREAD = 26;
const STEP = 170;

const key = (state) => {
  const h = state.hand;
  const wraps = state.wraps.map((w) => `${w.peg}${w.side}`).join("");
  return `${Math.round(h.x / 24)}:${Math.round(h.y / 24)}:${wraps}`;
};

function score(state, routeLength) {
  const d = dist(state.hand, level.target);
  return d + 0.28 * state.travelled + 26 * routeLength;
}

let beam = [{ state: createState(level), route: [], score: score(createState(level), 0) }];
const seen = new Set([key(beam[0].state)]);
let solution = null;

for (let d = 0; d < maxDepth && !solution; d += 1) {
  const pool = [];
  for (const node of beam) {
    const options = grid
      .filter((p) => {
        const dd = dist(node.state.hand, p);
        return dd > 24 && dd < STEP;
      })
      .map((p) => ({ p, d: dist(p, level.target) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, SPREAD);

    for (let i = 0; i < 6; i += 1) {
      const pick = grid[Math.floor(rng() * grid.length)];
      if (dist(node.state.hand, pick) > 24 && dist(node.state.hand, pick) < STEP) options.push({ p: pick, d: dist(pick, level.target) });
    }

    for (const { p } of options) {
      const next = dragTo(level, node.state, p);
      if (next.status === "shock") continue;
      const route = [...node.route, p];
      if (next.status === "retract" || next.status === "won") {
        solution = route;
        break;
      }
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      pool.push({ state: next, route, score: score(next, route.length) });
    }
    if (solution) break;
  }
  if (solution) break;
  pool.sort((a, b) => a.score - b.score);
  beam = pool.slice(0, BEAM);
  if (!beam.length) break;
}

if (!solution) {
  console.log(`stage ${id}: no route within ${maxDepth} moves`);
  process.exit(1);
}

let state = createState(level);
for (const p of solution) {
  state = dragTo(level, state, p);
}
console.log(`stage ${id}: solved in ${solution.length} moves, travel ${Math.round(state.travelled)}, wraps ${state.wraps.map((w) => `${w.peg}:${w.side}`).join(",") || "-"}`);
console.log("solution: [");
for (const p of solution) console.log(`  { x: ${Math.round(p.x)}, y: ${Math.round(p.y)} },`);
console.log("],");
