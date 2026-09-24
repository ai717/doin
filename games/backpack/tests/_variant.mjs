import { solvePuzzle, layoutWins } from "../js/engine.mjs";
import { PUZZLES } from "../js/data.mjs";

const variants = {
  p12: [
    [{ id: "battle_axe", qty: 1 }, { id: "whetstone", qty: 2 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "war_mace", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }, { id: "boots", qty: 1 }],
  ],
  p13: [
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }],
  ],
  p14: [
    [{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }, { id: "clover", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }, { id: "clover", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "boots", qty: 1 }],
  ],
  p20: [
    [{ id: "hunt_bow", qty: 2 }, { id: "venom_arrow", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }],
    [{ id: "hunt_bow", qty: 2 }, { id: "venom_arrow", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
  ],
  p25: [
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "clover", qty: 1 }],
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
  ],
  p27: [
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "big_axe", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "big_axe", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "clover", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
  ],
  p28: [
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "iron_shield", qty: 1 }],
  ],
  p29: [
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "clover", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
  ],
  p30: [
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "clover", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
  ],
};

for (const [pid, trays] of Object.entries(variants)) {
  const base = PUZZLES.find((p) => p.id === pid);
  for (let v = 0; v < trays.length; v += 1) {
    const puzzle = { ...base, tray: trays[v] };
    const sol = solvePuzzle(puzzle, { beam: 700, rngSeed: 11 });
    if (sol) {
      const r = layoutWins(sol.items, puzzle);
      console.log(`${pid} v${v} ${trays[v].map((t) => (t.qty > 1 ? `${t.id}x${t.qty}` : t.id)).join("+")} -> SOLVED hp=${(r.hpPct * 100).toFixed(0)}% time=${r.time.toFixed(1)}s`);
    } else {
      console.log(`${pid} v${v} ${trays[v].map((t) => (t.qty > 1 ? `${t.id}x${t.qty}` : t.id)).join("+")} -> no`);
    }
  }
}
