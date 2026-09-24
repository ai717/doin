import { solvePuzzle, layoutWins } from "../js/engine.mjs";
import { PUZZLES } from "../js/data.mjs";

const targets = ["p12", "p13", "p14", "p20", "p25", "p27", "p28", "p29", "p30"];
for (const p of PUZZLES) {
  if (!targets.includes(p.id)) continue;
  let found = null;
  for (const rngSeed of [7, 11, 13, 17, 23]) {
    const sol = solvePuzzle(p, { beam: 1200, rngSeed });
    if (sol) { found = sol; break; }
  }
  if (found) {
    const r = layoutWins(found.items, p);
    console.log(`${p.id} SOLVED beam1200 rngSeed? hp=${(r.hpPct * 100).toFixed(0)}% time=${r.time.toFixed(1)}s`);
  } else {
    console.log(`${p.id} NO (beam1200 ×5 seeds)`);
  }
}
