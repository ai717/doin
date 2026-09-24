import { solvePuzzle, layoutWins } from "../js/engine.mjs";
import { PUZZLES } from "../js/data.mjs";

const trays = {
  p08: [
    [{ id: "short_bow", qty: 2 }, { id: "venom_arrow", qty: 1 }, { id: "wooden_shield", qty: 1 }],
    [{ id: "short_bow", qty: 2 }, { id: "venom_arrow", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "short_bow", qty: 2 }, { id: "venom_arrow", qty: 1 }, { id: "leather_armor", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "wooden_shield", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "hunt_bow", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "wooden_shield", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "short_bow", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "leather_armor", qty: 1 }],
  ],
  p09: [
    [{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "hunt_bow", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "clover", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "roast", qty: 1 }],
  ],
};

for (const [pid, list] of Object.entries(trays)) {
  for (let v = 0; v < list.length; v += 1) {
    const base = PUZZLES.find((p) => p.id === pid);
    const puzzle = { ...base, tray: list[v] };
    const sol = solvePuzzle(puzzle, { beam: 500, rngSeed: 11 });
    if (sol) {
      const r = layoutWins(sol.items, puzzle);
      console.log(`${pid} v${v} ${list[v].map((t) => (t.qty > 1 ? t.id + "x" + t.qty : t.id)).join("+")} -> SOLVED hp=${(r.hpPct * 100).toFixed(0)}% t=${r.time.toFixed(1)}`);
    } else {
      console.log(`${pid} v${v} ${list[v].map((t) => (t.qty > 1 ? t.id + "x" + t.qty : t.id)).join("+")} -> no`);
    }
  }
}
