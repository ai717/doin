// Level geometry inspector: node scripts/verify-thief-levels.mjs [id]
// Prints, per stage, whether the authored route actually grabs the loot,
// how much cord travel it costs, and the closest the arm ever gets to a
// hazard. Also reports whether simply dragging straight at the loot dies,
// so a stage can never silently collapse into a one-move no-brainer.
import { LEVELS } from "../games/thief/js/levels.mjs";
import {
  createState,
  dragTo,
  playSolution,
  pathClearance,
  buildPath,
  detectHazard,
} from "../games/thief/js/engine.mjs";

const only = Number(process.argv[2] ?? 0);
const rows = [];

for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  const solved = playSolution(level);
  const naive = dragTo(level, createState(level), level.target);
  const clearance = pathClearance(level, solved);
  const wrapInfo = solved.wraps.map((w) => `${w.peg}:${w.side}`).join(",") || "-";
  const path = buildPath(level, solved.hand, solved.wraps);
  rows.push({
    id: level.id,
    ch: level.chapter,
    status: solved.status === "retract" ? "grabbed" : solved.status,
    fail: solved.failure?.kind ?? "-",
    travelled: Math.round(solved.travelled),
    par: level.par,
    wraps: wrapInfo,
    clearance: Number.isFinite(clearance) ? clearance.toFixed(1) : "inf",
    naive: naive.status === "retract" || naive.status === "won" ? "CLEARS" : naive.failure?.kind ?? naive.status,
    points: path.points.length,
    ok: solved.status === "retract" || solved.status === "won",
  });
}

const width = [3, 3, 8, 6, 9, 4, 8, 9, 10, 6];
const head = ["id", "ch", "status", "fail", "travel", "par", "wraps", "clear", "naive", "pts"];
console.log(head.map((h, i) => h.padEnd(width[i])).join(" "));
for (const row of rows) {
  const values = [row.id, row.ch, row.status, row.fail, row.travelled, row.par, row.wraps, row.clearance, row.naive, row.points];
  console.log(values.map((v, i) => String(v).padEnd(width[i])).join(" "));
}

const broken = rows.filter((row) => !row.ok);
console.log(`\n${rows.length - broken.length}/${rows.length} solvable${broken.length ? ` | broken: ${broken.map((b) => `${b.id}(${b.fail})`).join(", ")}` : ""}`);

if (only) {
  const level = LEVELS.find((l) => l.id === only);
  const naiveState = dragTo(level, createState(level), level.target);
  const straight = buildPath(level, level.target, []);
  console.log("\nnaive cord samples:");
  for (const p of straight.points) console.log(`  ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
  console.log("naive hazard:", detectHazard(level, naiveState)?.kind ?? "none");
  const solved = playSolution(level);
  console.log("solution cord samples:");
  const path = buildPath(level, solved.hand, solved.wraps);
  for (const p of path.points) console.log(`  ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
}
