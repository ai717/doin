import { solvePuzzle, layoutWins, computeBuild, makeEnemy, runBattle } from "../js/engine.mjs";
import { PUZZLES, ITEMS, ENEMIES } from "../js/data.mjs";

const trays = {
  p08: [[{ id: "short_bow", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "leather_armor", qty: 1 }]],
  p09: [[{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "roast", qty: 1 }]],
  p10: [[{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "roast", qty: 1 }, { id: "mana_elixir", qty: 1 }]],
};

for (const poison of [2, 1.5, 1.25]) {
  ITEMS.venom_arrow.adjBonus.poison = poison;
  console.log(`=== venom poison=${poison} ===`);
  for (const [pid, list] of Object.entries(trays)) {
    for (let v = 0; v < list.length; v += 1) {
      const base = PUZZLES.find((p) => p.id === pid);
      const puzzle = { ...base, tray: list[v] };
      const sol = solvePuzzle(puzzle, { beam: 500, rngSeed: 11 });
      if (sol) {
        const r = layoutWins(sol.items, puzzle);
        console.log(`  ${pid} v${v} -> SOLVED hp=${(r.hpPct * 100).toFixed(0)}% t=${r.time.toFixed(1)}`);
      } else {
        console.log(`  ${pid} v${v} -> no`);
      }
    }
  }
}
// 还原
ITEMS.venom_arrow.adjBonus.poison = 2;
