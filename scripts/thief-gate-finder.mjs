// Design aid: find a vertical beam that blocks the "just yank it" route while
// the authored route still slips through.
//   node scripts/thief-gate-finder.mjs <id> [ids...]
import { LEVELS } from "../games/thief/js/levels.mjs";
import { createState, dragTo, playSolution, pathClearance } from "../games/thief/js/engine.mjs";

function run(level, points) {
  let state = createState(level);
  for (const point of points) {
    state = dragTo(level, state, point);
    if (state.status !== "aim") break;
  }
  return state;
}

const ok = (state) => state.status === "retract" || state.status === "won";

for (const arg of process.argv.slice(2).map(Number)) {
  const level = LEVELS.find((l) => l.id === arg);
  if (!level) continue;
  const O = level.origin;
  const T = level.target;
  const naive = run(level, [T]);
  const candidate = [];
  for (let x = 220; x <= 780; x += 20) {
    const t = (x - O.x) / (T.x - O.x);
    if (t <= 0.15 || t >= 0.95) continue;
    const y = O.y + (T.y - O.y) * t;
    for (const dir of ["up", "down"]) {
      const beam =
        dir === "up"
          ? { x1: x, y1: 56, x2: x, y2: Math.round(y - 28) }
          : { x1: x, y1: Math.round(y + 28), x2: x, y2: 528 };
      if (Math.abs(beam.y2 - beam.y1) < 70) continue;
      const probe = { ...level, lasers: [...level.lasers, beam] };
      if (ok(run(probe, [T]))) continue;
      const solved = playSolution(probe);
      if (!ok(solved)) continue;
      const clear = pathClearance(probe, solved);
      if (!Number.isFinite(clear) || clear < 10) continue;
      candidate.push({ dir, x, beam, clear: Number(clear.toFixed(1)) });
    }
  }
  candidate.sort((a, b) => b.clear - a.clear);
  console.log(`\n== stage ${level.id} (naive ${ok(naive) ? "CLEARS" : "dies"}) ==`);
  for (const c of candidate.slice(0, 6)) {
    console.log(`  ${c.dir.padEnd(4)} x=${c.x} beam=(${c.beam.x1},${c.beam.y1})-(${c.beam.x2},${c.beam.y2}) clearance=${c.clear}`);
  }
  if (!candidate.length) console.log("  no single beam works");
}
