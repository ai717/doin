// 诊断：对失败关卡加大求解，输出最优战果
import { solvePuzzle, layoutWins, computeBuild, runBattle, makeEnemy, mulberry32, generateShop } from "../js/engine.mjs";
import { PUZZLES, ENEMIES, CLASSES, ITEMS } from "../js/data.mjs";

const targets = process.argv[2] ? process.argv[2].split(",") : null;
for (const p of PUZZLES) {
  if (targets && !targets.includes(p.id)) continue;
  const sol = solvePuzzle(p, { beam: 700, rngSeed: 7 });
  if (sol) {
    const res = layoutWins(sol.items, p);
    console.log(`${p.id} SOLVED hp=${(res.hpPct * 100).toFixed(0)}% time=${res.time.toFixed(1)}s starT=${p.starTime}`);
  } else {
    // 找最接近胜利的布局：评估 frontier 里对手掉血最多的
    console.log(`${p.id} STILL NO SOLUTION`);
  }
}
console.log("---class starters vs novice (smart placement)---");
for (const cls of Object.keys(CLASSES)) {
  const c = CLASSES[cls];
  const grid = { cols: c.grid.cols, rows: c.grid.rows, blocked: new Set() };
  // 智能摆放：武器+增益相邻，食物/护甲次之
  const items = [];
  const ids = c.startersA;
  // 简化：把前两个相邻放，其余顺排
  const placements = [
    { id: ids[0], x: 0, y: 0, rot: 0 },
    { id: ids[1], x: 0, y: 2, rot: 0 },
    { id: ids[2], x: 2, y: 0, rot: 0 },
  ];
  const withUid = placements.map((it, i) => ({ ...it, uid: i }));
  // 检查与网格
  const spec = computeBuild(withUid, cls, grid);
  const enemy = makeEnemy("novice", 1).spec;
  const b = runBattle(spec, enemy, 777);
  console.log(`${cls}: winner=${b.winner} time=${Math.round(b.time)} hp=${Math.round(b.sides[0].hp)} weapons=${spec.weapons.length} foods=${spec.foods.length} armor=${spec.armor}`);
}
