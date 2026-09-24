import { solvePuzzle, layoutWins } from "../js/engine.mjs";
import { PUZZLES, ITEMS } from "../js/data.mjs";

ITEMS.venom_arrow.adjBonus.poison = 1.5;

const trays = {
  p10: [
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "mana_elixir", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "wooden_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
  ],
};

for (const [pid, list] of Object.entries(trays)) {
  for (let v = 0; v < list.length; v += 1) {
    const base = PUZZLES.find((p) => p.id === pid);
    const puzzle = { ...base, tray: list[v] };
    const sol = solvePuzzle(puzzle, { beam: 600, rngSeed: 11 });
    if (sol) {
      const r = layoutWins(sol.items, puzzle);
      console.log(`p10 v${v} ${list[v].map((t) => (t.qty > 1 ? t.id + "x" + t.qty : t.id)).join("+")} -> SOLVED hp=${(r.hpPct * 100).toFixed(0)}% t=${r.time.toFixed(1)}`);
    } else {
      console.log(`p10 v${v} ${list[v].map((t) => (t.qty > 1 ? t.id + "x" + t.qty : t.id)).join("+")} -> no`);
    }
  }
}
ITEMS.venom_arrow.adjBonus.poison = 2;
