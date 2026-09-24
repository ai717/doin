import { computeBuild, runBattle, solvePuzzle } from "../js/engine.mjs";
import { PUZZLES, ENEMIES } from "../js/data.mjs";

function gridOf(p) { return { cols: p.grid.cols, rows: p.grid.rows, blocked: new Set((p.grid.blocked ?? []).map((k) => k.split(",").map(Number))) }; }
function evalPuzzle(p, layout) {
  const enemy = ENEMIES[p.enemy];
  const enemySpec = computeBuild(enemy.items.map((it, i) => ({ ...it, uid: i })), null, { cols: enemy.grid.cols, rows: enemy.grid.rows, blocked: new Set() }, { hp: enemy.hp });
  const playerSpec = computeBuild(layout, null, gridOf(p));
  console.log(`${p.id} enemy=${p.enemy} ehp=${enemySpec.maxHp} earmor=${enemySpec.armor} foods=${enemySpec.foods.length} eweapons=${enemySpec.weapons.map((w) => `${w.itemId}${JSON.stringify(w.dmg)}cd${w.cd}${w.onHit ? JSON.stringify(w.onHit) : ""}`)}`);
  console.log(`  player: armor=${playerSpec.armor} foods=${playerSpec.foods.length} weapons=${playerSpec.weapons.map((w) => `${w.itemId}${JSON.stringify(w.dmg)}cd${w.cd}${w.onHit ? JSON.stringify(w.onHit) : ""}`)}`);
  for (const seed of [12345, 1, 3, 42, 777]) {
    const b = runBattle(playerSpec, enemySpec, seed);
    console.log(`  seed ${seed}: winner=${b.winner} t=${b.time.toFixed(1)} ph=${b.sides[0].hp.toFixed(1)} eh=${b.sides[1].hp.toFixed(1)}`);
  }
  const sol = solvePuzzle(p, { beam: 900, rngSeed: 11 });
  console.log(`  solver(beam900): ${sol ? "FOUND" : "null"} ${sol ? JSON.stringify(sol.items) : ""}`);
}

evalPuzzle(PUZZLES.find((p) => p.id === "p17"), [
  { id: "fire_staff", uid: 0, x: 0, y: 1, rot: 0 },
  { id: "oil_flask", uid: 1, x: 1, y: 1, rot: 0 },
  { id: "iron_shield", uid: 2, x: 1, y: 2, rot: 0 },
  { id: "roast", uid: 3, x: 2, y: 1, rot: 0 },
]);

evalPuzzle(PUZZLES.find((p) => p.id === "p21"), [
  { id: "fire_staff", uid: 0, x: 0, y: 1, rot: 0 },
  { id: "oil_flask", uid: 1, x: 1, y: 1, rot: 0 },
  { id: "fireball_scroll", uid: 2, x: 2, y: 1, rot: 0 },
  { id: "iron_shield", uid: 3, x: 0, y: 3, rot: 0 },
]);

evalPuzzle(PUZZLES.find((p) => p.id === "p12"), [
  { id: "battle_axe", uid: 0, x: 0, y: 0, rot: 0 },
  { id: "whetstone", uid: 1, x: 1, y: 0, rot: 0 },
  { id: "iron_shield", uid: 2, x: 2, y: 0, rot: 0 },
  { id: "roast", uid: 3, x: 0, y: 3, rot: 0 },
  { id: "boots", uid: 4, x: 1, y: 3, rot: 0 },
]);
