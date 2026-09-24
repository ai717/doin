// 手动实测 8 个失败关卡的关键布局（验证 math 假设）
import { computeBuild, runBattle, layoutWins, solvePuzzle } from "../js/engine.mjs";
import { PUZZLES, ENEMIES, ITEMS } from "../js/data.mjs";

function gridOf(p) { return { cols: p.grid.cols, rows: p.grid.rows, blocked: new Set((p.grid.blocked ?? []).map((k) => k.split(",").map(Number))) }; }
function evalPuzzle(p, layout) {
  const enemy = ENEMIES[p.enemy];
  const enemySpec = computeBuild(enemy.items.map((it, i) => ({ ...it, uid: i })), null, { cols: enemy.grid.cols, rows: enemy.grid.rows, blocked: new Set() });
  const playerSpec = computeBuild(layout, null, gridOf(p));
  console.log(`${p.id} vs ${p.enemy}: enemy hp=${enemySpec.maxHp} armor=${enemySpec.armor} weapons=${enemySpec.weapons.map((w) => `${w.itemId}${JSON.stringify(w.dmg)}cd${w.cd}${w.onHit ? "hit:" + JSON.stringify(w.onHit) : ""}`)}`);
  console.log(`   player: armor=${playerSpec.armor} weapons=${playerSpec.weapons.map((w) => `${w.itemId}${JSON.stringify(w.dmg)}cd${w.cd}${w.onHit ? "hit:" + JSON.stringify(w.onHit) : ""}`)} foods=${playerSpec.foods.length}`);
  for (const seed of [12345, 1, 42, 777]) {
    const b = runBattle(playerSpec, enemySpec, seed);
    console.log(`   seed ${seed}: winner=${b.winner} t=${b.time.toFixed(1)} ph=${b.sides[0].hp.toFixed(1)} eh=${b.sides[1].hp.toFixed(1)}`);
  }
}

evalPuzzle(PUZZLES.find((p) => p.id === "p13"), [
  { id: "fire_staff", uid: 0, x: 0, y: 1, rot: 0 },
  { id: "oil_flask", uid: 1, x: 1, y: 1, rot: 0 },
  { id: "iron_shield", uid: 2, x: 0, y: 3, rot: 0 },
  { id: "roast", uid: 3, x: 2, y: 1, rot: 0 },
]);

evalPuzzle(PUZZLES.find((p) => p.id === "p20"), [
  { id: "hunt_bow", uid: 0, x: 0, y: 0, rot: 0 },
  { id: "hunt_bow", uid: 1, x: 0, y: 2, rot: 0 },
  { id: "venom_arrow", uid: 2, x: 2, y: 0, rot: 0 },
  { id: "iron_shield", uid: 3, x: 2, y: 1, rot: 0 },
  { id: "roast", uid: 4, x: 2, y: 3, rot: 0 },
]);

evalPuzzle(PUZZLES.find((p) => p.id === "p21"), [
  { id: "fire_staff", uid: 0, x: 0, y: 1, rot: 0 },
  { id: "oil_flask", uid: 1, x: 1, y: 1, rot: 0 },
  { id: "fireball_scroll", uid: 2, x: 2, y: 1, rot: 0 },
  { id: "iron_shield", uid: 3, x: 0, y: 3, rot: 0 },
]);

evalPuzzle(PUZZLES.find((p) => p.id === "p22"), [
  { id: "fire_staff", uid: 0, x: 0, y: 1, rot: 0 },
  { id: "oil_flask", uid: 1, x: 1, y: 1, rot: 0 },
  { id: "fireball_scroll", uid: 2, x: 2, y: 1, rot: 0 },
  { id: "roast", uid: 3, x: 2, y: 3, rot: 0 },
  { id: "leather_armor", uid: 4, x: 0, y: 3, rot: 0 },
]);

evalPuzzle(PUZZLES.find((p) => p.id === "p26"), [
  { id: "fire_staff", uid: 0, x: 1, y: 1, rot: 0 },
  { id: "oil_flask", uid: 1, x: 2, y: 1, rot: 0 },
  { id: "fireball_scroll", uid: 2, x: 1, y: 0, rot: 0 },
  { id: "iron_shield", uid: 3, x: 0, y: 1, rot: 0 },
]);

evalPuzzle(PUZZLES.find((p) => p.id === "p27"), [
  { id: "fireball_scroll", uid: 0, x: 1, y: 0, rot: 0 },
  { id: "oil_flask", uid: 1, x: 2, y: 0, rot: 0 },
  { id: "big_axe", uid: 2, x: 1, y: 1, rot: 0 },
  { id: "iron_shield", uid: 3, x: 3, y: 0, rot: 0 },
  { id: "roast", uid: 4, x: 3, y: 2, rot: 0 },
]);

evalPuzzle(PUZZLES.find((p) => p.id === "p28"), [
  { id: "fireball_scroll", uid: 0, x: 1, y: 0, rot: 0 },
  { id: "oil_flask", uid: 1, x: 2, y: 0, rot: 0 },
  { id: "hunt_bow", uid: 2, x: 0, y: 1, rot: 0 },
  { id: "venom_arrow", uid: 3, x: 2, y: 1, rot: 0 },
  { id: "iron_shield", uid: 4, x: 3, y: 1, rot: 0 },
]);

evalPuzzle(PUZZLES.find((p) => p.id === "p30"), [
  { id: "fire_staff", uid: 0, x: 0, y: 0, rot: 0 },
  { id: "oil_flask", uid: 1, x: 1, y: 0, rot: 0 },
  { id: "hunt_bow", uid: 2, x: 0, y: 2, rot: 0 },
  { id: "iron_shield", uid: 3, x: 2, y: 0, rot: 0 },
  { id: "roast", uid: 4, x: 2, y: 2, rot: 0 },
]);
