// Probe a stage against several stock routes so a stage cannot be cleared by
// simply yanking the glove at the loot.
//   node scripts/probe-thief-stage.mjs <id>
import { LEVELS } from "../games/thief/js/levels.mjs";
import { createState, dragTo } from "../games/thief/js/engine.mjs";

const id = Number(process.argv[2] ?? 1);
const level = LEVELS.find((l) => l.id === id);
if (!level) {
  console.error("unknown stage", id);
  process.exit(1);
}
const T = level.target;

const routes = {
  authored: level.solution,
  naive: [T],
  high: [{ x: (level.origin.x + T.x) / 2, y: 120 }, { x: T.x - 40, y: 150 }, T],
  low: [{ x: (level.origin.x + T.x) / 2, y: 470 }, { x: T.x - 40, y: 450 }, T],
  overTop: [{ x: T.x - 220, y: 170 }, T],
  underBottom: [{ x: T.x - 220, y: 460 }, T],
};

for (const [name, points] of Object.entries(routes)) {
  let state = createState(level);
  for (const point of points) {
    state = dragTo(level, state, point);
    if (state.status !== "aim") break;
  }
  const ok = state.status === "retract" || state.status === "won";
  console.log(
    `${name.padEnd(12)} ${ok ? "CLEARS" : "dies:" + (state.failure?.kind ?? state.status)}` +
      `  travel=${Math.round(state.travelled)} wraps=${state.wraps.map((w) => `${w.peg}:${w.side}`).join(",") || "-"}`,
  );
}
