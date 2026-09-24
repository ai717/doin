import { solvePuzzle, layoutWins, computeBuild, makeEnemy } from "../js/engine.mjs";
import { PUZZLES, ENEMIES } from "../js/data.mjs";

// 探针：毒药师变体 × 关卡托盘变体 → 是否可解
const trays = {
  p08: [
    [{ id: "big_axe", qty: 1 }, { id: "wooden_shield", qty: 1 }, { id: "apple", qty: 2 }],
    [{ id: "big_axe", qty: 1 }, { id: "whetstone", qty: 1 }, { id: "wooden_shield", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "big_axe", qty: 1 }, { id: "whetstone", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "war_hammer", qty: 1 }, { id: "whetstone", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
  ],
  p09: [
    [{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "wooden_shield", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "roast", qty: 1 }],
    [{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }, { id: "clover", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }],
  ],
  p10: [
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "roast", qty: 1 }, { id: "mana_elixir", qty: 1 }],
    [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }],
    [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "roast", qty: 1 }, { id: "mana_elixir", qty: 1 }],
  ],
};

for (const hp of [100, 90, 85]) {
  console.log(`=== poisoner hp=${hp} ===`);
  for (const [pid, list] of Object.entries(trays)) {
    for (let v = 0; v < list.length; v += 1) {
      const base = PUZZLES.find((p) => p.id === pid);
      const puzzle = { ...base, tray: list[v] };
      const enemy = { ...ENEMIES.poisoner, hp };
      // 直接改 ENEMIES 副本做求解（solvePuzzle 内部读 ENEMIES 原始对象）
      const orig = ENEMIES.poisoner;
      ENEMIES.poisoner = enemy;
      const sol = solvePuzzle(puzzle, { beam: 400, rngSeed: 11 });
      ENEMIES.poisoner = orig;
      if (sol) {
        const r = layoutWins(sol.items, puzzle);
        console.log(`  ${pid} v${v} ${list[v].map((t) => (t.qty > 1 ? t.id + "x" + t.qty : t.id)).join("+")} -> SOLVED hp=${(r.hpPct * 100).toFixed(0)}% t=${r.time.toFixed(1)}`);
      } else {
        console.log(`  ${pid} v${v} ${list[v].map((t) => (t.qty > 1 ? t.id + "x" + t.qty : t.id)).join("+")} -> no`);
      }
    }
  }
}
