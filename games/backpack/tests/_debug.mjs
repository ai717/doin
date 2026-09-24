// 手动实测：p13 特定布局 vs 火焰修士；p10 布局 vs 毒药师
import { computeBuild, runBattle, layoutWins, makeEnemy, solvePuzzle } from "../js/engine.mjs";
import { PUZZLES, ENEMIES, ITEMS } from "../js/data.mjs";

const p13 = PUZZLES.find((p) => p.id === "p13");
const enemy = ENEMIES[p13.enemy];
const enemySpec = computeBuild(enemy.items.map((it, i) => ({ ...it, uid: i })), null, { cols: 4, rows: 5, blocked: new Set() });
console.log("flame_monk spec: hp", enemySpec.maxHp, "armor", enemySpec.armor, "weapons", enemySpec.weapons.map((w) => `${w.itemId}[${w.dmg}]cd${w.cd}onHit${JSON.stringify(w.onHit)}`));

const layout = [
  { id: "fire_staff", uid: 0, x: 0, y: 1, rot: 0 },
  { id: "oil_flask", uid: 1, x: 1, y: 1, rot: 0 },
  { id: "roast", uid: 2, x: 2, y: 1, rot: 0 },
  { id: "leather_armor", uid: 3, x: 0, y: 3, rot: 0 },
];
const playerSpec = computeBuild(layout, null, { cols: 4, rows: 5, blocked: new Set() });
console.log("player spec: hp", playerSpec.maxHp, "armor", playerSpec.armor, "weapons", playerSpec.weapons.map((w) => `${w.itemId}[${w.dmg}]cd${w.cd}onHit${JSON.stringify(w.onHit)}`), "foods", playerSpec.foods.length);

for (const seed of [12345, 1, 2, 3, 42, 777]) {
  const b = runBattle(playerSpec, enemySpec, seed);
  console.log(`seed ${seed}: winner=${b.winner} time=${b.time.toFixed(1)} playerHp=${b.sides[0].hp.toFixed(1)} enemyHp=${b.sides[1].hp.toFixed(1)} reason=${b.endReason}`);
}

// p10: fire_staff+oil+mana_elixir vs poisoner
const p10 = PUZZLES.find((p) => p.id === "p10");
const e10 = ENEMIES[p10.enemy];
const e10Spec = computeBuild(e10.items.map((it, i) => ({ ...it, uid: i })), null, { cols: 4, rows: 5, blocked: new Set() });
console.log("\npoisoner spec: hp", e10Spec.maxHp, "weapons", e10Spec.weapons.map((w) => `${w.itemId}[${w.dmg}]cd${w.cd}onHit${JSON.stringify(w.onHit)}`));
const layout10 = [
  { id: "fire_staff", uid: 0, x: 0, y: 1, rot: 0 },
  { id: "oil_flask", uid: 1, x: 1, y: 1, rot: 0 },
  { id: "mana_elixir", uid: 2, x: 2, y: 1, rot: 0 },
];
const p10Spec = computeBuild(layout10, null, { cols: 4, rows: 5, blocked: new Set() });
console.log("player10 spec: hp", p10Spec.maxHp, "weapons", p10Spec.weapons.map((w) => `${w.itemId}[${w.dmg}]cd${w.cd}onHit${JSON.stringify(w.onHit)}`), "resRegen", p10Spec.resRegen);
for (const seed of [12345, 1, 2, 3, 42]) {
  const b = runBattle(p10Spec, e10Spec, seed);
  console.log(`p10 seed ${seed}: winner=${b.winner} time=${b.time.toFixed(1)} playerHp=${b.sides[0].hp.toFixed(1)} enemyHp=${b.sides[1].hp.toFixed(1)}`);
}

// p15: iron_sword+iron_shield+roast×2 vs ironclad
const p15 = PUZZLES.find((p) => p.id === "p15");
const e15 = ENEMIES[p15.enemy];
const e15Spec = computeBuild(e15.items.map((it, i) => ({ ...it, uid: i })), null, { cols: 4, rows: 5, blocked: new Set() });
console.log("\nironclad spec: hp", e15Spec.maxHp, "armor", e15Spec.armor, "weapons", e15Spec.weapons.map((w) => `${w.itemId}[${w.dmg}]cd${w.cd}`));
const layout15 = [
  { id: "iron_sword", uid: 0, x: 0, y: 0, rot: 0 },
  { id: "iron_shield", uid: 1, x: 1, y: 0, rot: 0 },
  { id: "roast", uid: 2, x: 0, y: 3, rot: 0 },
  { id: "roast", uid: 3, x: 1, y: 3, rot: 0 },
];
const p15Spec = computeBuild(layout15, null, { cols: 4, rows: 5, blocked: new Set() });
console.log("player15 spec: hp", p15Spec.maxHp, "armor", p15Spec.armor, "weapons", p15Spec.weapons.map((w) => `${w.itemId}[${w.dmg}]cd${w.cd}`), "foods", p15Spec.foods.length);
for (const seed of [12345, 1, 2, 3, 42]) {
  const b = runBattle(p15Spec, e15Spec, seed);
  console.log(`p15 seed ${seed}: winner=${b.winner} time=${b.time.toFixed(1)} playerHp=${b.sides[0].hp.toFixed(1)} enemyHp=${b.sides[1].hp.toFixed(1)}`);
}
