// tools/tune-bot.mjs —— 开发期：标定影子玩家的避险口径与验收阈值
//
// 【前提】Node ≥20，零依赖。LAYOUTS 从 build-mazes.mjs import（那边有 isMain 守卫，
//         所以本工具只读图、绝不会顺手重写 js/levels.mjs）。
// 【命令】在项目根执行：
//         node games/lantern-maze/tools/tune-bot.mjs            # 七张巷弄 × 五种避险档位对照表
//         node games/lantern-maze/tools/tune-bot.mjs lanes      # 只看一张（参数 = LAYOUTS 的键名）
// 【产物】stdout 纯文本：每张巷弄一段 `== name (糖粒 N)`，下面五行分别给出
//         r3w90 / r2w40 / r4w160 / r5w60 / r4w90 五档的
//         `清x% 吃x% d<平均死亡数> <平均秒数>`（rNxwY = 避险视野 radius、避影权重 weight）。
// 【坑】1) 每档跑 8 局注入种子（seed = 1000 + i*7919），startLives:99 让 AI 撞死不中断，
//         所以 d 列是"趟雷次数"而不是玩家体验；要看真实通关表现得把 startLives 改回 1。
//      2) 生产门禁只看吃净率：阈值在 js/bot.mjs 的 BOT_GATE（runs 8 / failEatRate .55 / warnEatRate .75），
//         清场率在本工具里注定偏低（贪心一层前瞻绕不开夜巡速度的影魅），不要照抄成 FAIL 条件。
//      3) 这里改档位只是试跑；要换线上口径必须同步 js/bot.mjs 的默认 radius/weight，并重跑
//         `node --test "games/lantern-maze/tests/*.test.mjs"`（校验器与工坊测试都吃这套阈值）。
//         线上探测用的 cfg 已收敛成 js/bot.mjs 的 BOT_PROBE_CFG（startLives:99 + frightMs:5000），
//         本工具的五个变体就是在它之上叠加 radius/weight，别另起炉灶。
//      4) 参数拼错会直接 `未知巷弄 xxx` 退 1（不再打一张全 0 的假表糊人）。
import { simulate } from "../js/bot.mjs";
import { LAYOUTS } from "./build-mazes.mjs";

const names = process.argv[2] ? [process.argv[2]] : Object.keys(LAYOUTS);
const unknown = names.filter((n) => !LAYOUTS[n]);
if (unknown.length) {
  console.error(`未知巷弄 ${unknown.join(", ")}；可选：${Object.keys(LAYOUTS).join(" / ")}`);
  process.exit(1);
}
const variants = [
  { label: "r3w90 ", bot: {}, cfg: { startLives: 99 } },
  { label: "r2w40 ", bot: { radius: 2, weight: 40 }, cfg: { startLives: 99 } },
  { label: "r4w160", bot: { radius: 4, weight: 160 }, cfg: { startLives: 99 } },
  { label: "r5w60 ", bot: { radius: 5, weight: 60 }, cfg: { startLives: 99 } },
  { label: "r4w90 ", bot: { radius: 4, weight: 90 }, cfg: { startLives: 99 } },
];

for (const name of names) {
  const rows = LAYOUTS[name];
  const total = simulate({ rows, cfg: { startLives: 1 }, seed: 1 }).total;
  const out = [];
  for (const v of variants) {
    let cleared = 0;
    let eat = 0;
    let ms = 0;
    let deaths = 0;
    const runs = 8;
    for (let i = 0; i < runs; i += 1) {
      const r = simulate({ rows, seed: (1000 + i * 7919) >>> 0, cfg: { frightMs: 5000, ...v.cfg }, bot: v.bot });
      if (r.cleared) cleared += 1;
      eat += (r.total - r.dotLeft) / r.total;
      ms += r.timeMs;
      deaths += r.deaths;
    }
    out.push(`${v.label} 清${((cleared / runs) * 100) | 0}% 吃${((eat / runs) * 100) | 0}% d${(deaths / runs).toFixed(1)} ${(ms / runs / 1000) | 0}s`);
  }
  console.log(`== ${name} (糖粒 ${total})`);
  for (const line of out) console.log("   " + line);
}
