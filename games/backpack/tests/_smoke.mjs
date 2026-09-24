// 临时冒烟测试：战斗确定性 + 开局可胜 + 残局可解性
import { computeBuild, runBattle, createBattle, stepBattle, solvePuzzle, makeEnemy, mulberry32, generateShop } from "../js/engine.mjs";
import { CLASSES, PUZZLES, ITEMS, ENEMIES } from "../js/data.mjs";

// 1. 战斗确定性：同种子同布局 → 同结果
const pSpec = computeBuild([
  { id: "wooden_sword", uid: 0, x: 0, y: 0, rot: 0 },
  { id: "leather_armor", uid: 1, x: 2, y: 0, rot: 0 },
  { id: "banana", uid: 2, x: 0, y: 2, rot: 0 },
], "berserker", { cols: 5, rows: 4, blocked: new Set() });
const eSpec = makeEnemy("novice", 1).spec;
const b1 = runBattle(pSpec, eSpec, 123);
const b2 = runBattle(pSpec, eSpec, 123);
console.log("determinism:", JSON.stringify({ w1: b1.winner, w2: b2.winner, h1: Math.round(b1.sides[0].hp), h2: Math.round(b2.sides[0].hp) }), b1.winner === b2.winner && Math.round(b1.sides[0].hp) === Math.round(b2.sides[0].hp) ? "OK" : "FAIL");

// 2. 三职业开局 vs 新手（轮 1）
for (const cls of Object.keys(CLASSES)) {
  const starters = CLASSES[cls].startersA;
  const items = starters.map((id, i) => {
    // 简单横排摆放（网格 cols x rows）
    const { w, h } = { w: ITEMS[id].w, h: ITEMS[id].h };
    return { id, uid: i, x: 0, y: i * h, rot: 0 };
  });
  const grid = { cols: 8, rows: 12, blocked: new Set() };
  const spec = computeBuild(items, cls, grid);
  const battle = runBattle(spec, eSpec, 777);
  console.log(`class ${cls} vs novice r1: winner=${battle.winner} time=${Math.round(battle.time)} hp=${Math.round(battle.sides[0].hp)}/${spec.maxHp} ${battle.winner === 0 ? "OK" : "CHECK"}`);
}

// 3. 商店生成确定性 + 保底
const rng1 = mulberry32(42);
const rng2 = mulberry32(42);
const s1 = generateShop("berserker", 3, rng1, [{ id: "iron_sword", uid: 0, x: 0, y: 0, rot: 0 }]);
const s2 = generateShop("berserker", 3, rng2, [{ id: "iron_sword", uid: 0, x: 0, y: 0, rot: 0 }]);
console.log("shop deterministic:", JSON.stringify(s1) === JSON.stringify(s2) ? "OK" : "FAIL", s1.join(","));

// 4. 残局可解性（全部 30 关）
let solved = 0;
const failed = [];
for (const p of PUZZLES) {
  const start = Date.now();
  const sol = solvePuzzle(p, { beam: 220 });
  const ms = Date.now() - start;
  if (sol) {
    solved += 1;
    console.log(`puzzle ${p.id} SOLVED (${ms}ms) items=${sol.items.length}`);
  } else {
    failed.push(p.id);
    console.log(`puzzle ${p.id} NO SOLUTION (${ms}ms) FAIL`);
  }
}
console.log(`puzzles: ${solved}/${PUZZLES.length} solved. failed: ${failed.join(",") || "none"}`);
