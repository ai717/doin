// tools/build-mazes.mjs —— 开发期工具：段式雕刻 + 镜像生成巷弄，跑校验与影子玩家验收，产出 js/levels.mjs。
//
// 【前提】Node ≥20，零依赖、零构建步骤；tools/tune-bot.mjs 会 import 本文件取 LAYOUTS，
//         所以顶部 `isMain` 守卫是必要的——只有直接 node 执行才打印报告/落盘 levels.mjs。
// 【命令】在项目根执行：
//         node games/lantern-maze/tools/build-mazes.mjs            # 七张巷弄逐条 JSON 验收报告
//         node games/lantern-maze/tools/build-mazes.mjs --dump     # 额外打印 ASCII 瓦片图（带行号，便于对格）
//         node games/lantern-maze/tools/build-mazes.mjs --emit     # 重写 games/lantern-maze/js/levels.mjs
//         两个开关可叠加：--dump --emit
// 【产物】stdout：每张巷弄一行 JSON（ok/dots/pearls/houses/wrap/cycles/problems/bot/codeLen/roundtrip）；
//         --emit 时写 js/levels.mjs（LAYOUTS + TEMPLATES + ROSTERS + LEVELS 30 关表），并打印 "-- levels.mjs written"。
// 【坑】1) js/levels.mjs 里的瓦片串是生成物，**勿手改**；要改图就改本文件的 carve/paint/finish，再 --emit。
//      2) --emit 之后必须重跑 `node --test "games/lantern-maze/tests/*.test.mjs"`：关卡表有契约测试守着。
//      3) bot 字段吃豆人式贪心 AI 只判 **吃净率**（clear0%/stuck100% 属正常，不表示图坏了）；
//         阈值在 js/bot.mjs 的 BOT_GATE（runs 8 / failEatRate .55 / warnEatRate .75），要调手感去 tune-bot.mjs。
//      4) roundtrip:false 说明 encodeRows/decodeRows 与本图不匹配（多半是新增了图例字符），先修 code.mjs。
//      5) W/H 是硬编码常量（19×21），改尺寸要连带校验 js/engine.mjs 的越界与传送带假设。
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseLayout } from "../js/engine.mjs";
import { validateRows } from "../js/validate.mjs";
import { botGate } from "../js/bot.mjs";
import { encodeRows, decodeRows } from "../js/code.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const W = 19;
const H = 21;

function paint(g, segs, ch, { only = null } = {}) {
  for (const [axis, a, b, c] of segs) {
    const from = Math.min(b, c);
    const to = Math.max(b, c);
    for (let i = from; i <= to; i += 1) {
      const x = axis === "h" ? i : a;
      const y = axis === "h" ? a : i;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      if (only !== null && g[y][x] !== only) continue;
      g[y][x] = ch;
    }
  }
  return g;
}

function mirrorGrid(g) {
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x <= Math.floor((W - 1) / 2); x += 1) {
      const m = W - 1 - x;
      if (g[y][x] !== "#" && g[y][m] === "#") g[y][m] = g[y][x];
      else if (g[y][m] !== "#" && g[y][x] === "#") g[y][x] = g[y][m];
    }
  }
  return g;
}

function carve(segs, mirror = true) {
  const g = Array.from({ length: H }, () => Array(W).fill("#"));
  paint(g, segs, "-");
  if (mirror) {
    for (let y = 0; y < H; y += 1) for (let x = 0; x <= Math.floor((W - 1) / 2); x += 1) g[y][W - 1 - x] = g[y][x];
  }
  return g;
}

function stamp(g, x, y, ch) {
  if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch;
}

function houseBlock(g, cx, topY, h = 2) {
  for (let dy = 0; dy < h; dy += 1) for (let dx = -1; dx <= 1; dx += 1) stamp(g, cx + dx, topY + dy, "H");
  stamp(g, cx, topY - 1, "D");
}

function finish(g, { spawn, pearls, fruits = [], noUp = [] }) {
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) if (g[y][x] === "-") g[y][x] = ".";
  }
  for (const [x, y] of pearls) stamp(g, x, y, "*");
  for (const [x, y] of fruits) stamp(g, x, y, "F");
  for (const [x, y] of noUp) stamp(g, x, y, "u");
  stamp(g, spawn[0], spawn[1], "P");
  return g.map((row) => row.join(""));
}

const MIRROR_X = (x) => W - 1 - x;

/** 标准夜巷：上下两层梯子巷 + 中间大街 + 影匣居中 */
function alley() {
  const g = carve([
    ["h", 1, 1, 9],
    ["v", 1, 1, 8],
    ["h", 3, 3, 5],
    ["v", 3, 1, 3],
    ["v", 5, 3, 8],
    ["h", 5, 1, 9],
    ["h", 7, 7, 9],
    ["v", 7, 5, 7],
    ["v", 9, 5, 8],
    ["h", 8, 0, 9],
    ["v", 1, 8, 12],
    ["h", 12, 0, 9],
    ["v", 3, 12, 15],
    ["h", 15, 1, 9],
    ["v", 5, 12, 17],
    ["h", 17, 3, 7],
    ["v", 7, 15, 19],
    ["h", 19, 1, 9],
    ["v", 9, 12, 19],
    ["v", 1, 15, 19],
  ]);
  houseBlock(g, 9, 10);
  return finish(g, {
    spawn: [9, 12],
    pearls: [[1, 1], [17, 1], [1, 19], [17, 19]],
    fruits: [
      [7, 12],
      [11, 12],
    ],
    noUp: [
      [7, 8],
      [11, 8],
    ],
  });
}

/** 双环巷：中央多开两条竖巷，绕圈空间更大 */
function rings() {
  const base = alley();
  const g = base.map((r) => [...r]);
  paint(
    g,
    [
      ["v", 3, 8, 12],
      ["v", 7, 8, 12],
      ["h", 10, 3, 6],
      ["h", 11, 12, 15],
      ["v", 6, 3, 5],
    ],
    ".",
    { only: "#" }
  );
  return mirrorGrid(g).map((r) => r.join(""));
}

/** 回字巷：同心环，长直线少拐角 */
function square() {
  const g = carve([
    ["h", 1, 1, 9],
    ["v", 1, 1, 19],
    ["h", 19, 1, 9],
    ["h", 3, 3, 9],
    ["v", 3, 3, 8],
    ["h", 8, 0, 9],
    ["v", 5, 5, 8],
    ["h", 5, 5, 9],
    ["h", 12, 0, 9],
    ["v", 5, 12, 15],
    ["h", 15, 5, 9],
    ["v", 3, 12, 17],
    ["h", 17, 3, 9],
    ["v", 7, 15, 17],
    ["v", 9, 15, 19],
  ]);
  houseBlock(g, 9, 10);
  return finish(g, {
    spawn: [9, 12],
    pearls: [[1, 1], [17, 1], [1, 19], [17, 19]],
    fruits: [
      [7, 8],
      [11, 8],
    ],
    noUp: [
      [7, 8],
      [11, 8],
    ],
  });
}

/** 十字街：四条主街 + 口袋巷，视野开阔 */
function cross() {
  const g = carve([
    ["h", 1, 1, 9],
    ["v", 1, 1, 19],
    ["h", 10, 1, 4],
    ["v", 4, 1, 10],
    ["h", 4, 4, 9],
    ["v", 7, 1, 4],
    ["h", 7, 1, 7],
    ["v", 9, 1, 10],
    ["h", 8, 0, 9],
    ["v", 3, 12, 15],
    ["h", 12, 0, 9],
    ["h", 15, 3, 9],
    ["v", 6, 12, 15],
    ["h", 17, 1, 9],
    ["v", 9, 12, 19],
    ["h", 19, 1, 9],
    ["v", 5, 17, 19],
    ["v", 1, 15, 19],
    ["h", 15, 1, 3],
  ]);
  houseBlock(g, 9, 10);
  return finish(g, {
    spawn: [9, 12],
    pearls: [[1, 1], [17, 1], [1, 19], [17, 19]],
    fruits: [
      [9, 15],
      [9, 5],
    ],
  });
}

/** 长巷：少环路多直巷，尾盘压迫感强（第 3 更用） */
function lanes() {
  const g = carve([
    ["h", 1, 1, 9],
    ["h", 4, 1, 9],
    ["h", 8, 0, 9],
    ["h", 12, 0, 9],
    ["h", 16, 1, 9],
    ["h", 19, 1, 9],
    ["v", 1, 1, 19],
    ["v", 3, 1, 8],
    ["v", 5, 4, 12],
    ["v", 7, 8, 19],
    ["v", 9, 12, 19],
    ["v", 4, 12, 16],
    ["h", 16, 4, 9],
    ["v", 6, 1, 4],
  ]);
  houseBlock(g, 9, 10);
  return finish(g, {
    spawn: [9, 12],
    pearls: [
      [1, 1],
      [17, 1],
      [1, 19],
      [17, 19],
    ],
    fruits: [
      [5, 8],
      [13, 12],
    ],
  });
}

/** 双匣：第二座影匣在左侧，六影同夜的终章场地 */
function twinHouse() {
  const g = alley().map((r) => [...r]);
  houseBlock(g, 4, 15);
  paint(
    g,
    [
      ["h", 13, 3, 5],
      ["v", 4, 12, 14],
    ],
    ".",
    { only: "#" }
  );
  return mirrorGrid(g).map((r) => r.join(""));
}

/** 擂台环巷：百鬼夜巷生存模式场地，环多路宽 */
function arena() {
  const g = carve([
    ["h", 1, 1, 9],
    ["v", 1, 1, 19],
    ["h", 19, 1, 9],
    ["h", 6, 1, 9],
    ["h", 14, 1, 9],
    ["h", 8, 0, 9],
    ["h", 12, 0, 9],
    ["v", 4, 1, 6],
    ["v", 4, 8, 12],
    ["v", 4, 14, 19],
    ["v", 7, 1, 8],
    ["v", 7, 12, 19],
    ["v", 9, 1, 6],
    ["v", 9, 8, 12],
    ["v", 9, 14, 19],
    ["h", 4, 4, 9],
    ["h", 16, 4, 9],
    ["h", 2, 7, 9],
    ["h", 18, 7, 9],
  ]);
  houseBlock(g, 9, 10);
  return finish(g, {
    spawn: [9, 12],
    pearls: [
      [1, 1],
      [17, 1],
      [1, 19],
      [17, 19],
      [1, 10],
      [17, 10],
    ],
    fruits: [
      [7, 12],
      [11, 12],
    ],
  });
}

export const LAYOUTS = {
  alley: alley(),
  rings: rings(),
  square: square(),
  cross: cross(),
  lanes: lanes(),
  twin: twinHouse(),
  arena: arena(),
};

const TEMPLATES = {
  "tpl-ring": alley(),
  "tpl-lanes": lanes(),
  "tpl-square": square(),
};

function report(name, rows) {
  const v = validateRows(rows);
  const g = botGate({ rows });
  const lay = parseLayout(rows);
  return {
    name,
    ok: v.ok,
    dots: lay?.dots,
    pearls: lay?.pearls,
    houses: lay?.houses.length,
    wrap: lay?.wrapRows.join(","),
    cycles: v.stats?.cycles,
    problems: v.problems.map((p) => `${p.rule}:${p.code}:${p.msg}@${p.tiles.map((t) => `${t.x},${t.y}`).join("|")}`),
    bot: `${g.pass ? "PASS" : "FAIL"}${g.warn ? "!" : ""} eat${(g.eatRate * 100) | 0}% worst${(g.worstEatRate * 100) | 0}% clear${(g.clearRate * 100) | 0}% stuck${(g.stuckRate * 100) | 0}% left${g.medianLeft}/${g.worstLeft}`,
    codeLen: encodeRows(rows).length,
    roundtrip: decodeRows(encodeRows(rows)).rows?.join("|") === rows.join("|"),
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(here, "build-mazes.mjs");
if (isMain) main();

function main() {
  for (const [name, rows] of Object.entries(LAYOUTS)) {
    if (process.argv.includes("--dump")) {
      console.log(`\n== ${name} (w=${rows[0].length} h=${rows.length})`);
      rows.forEach((r, i) => console.log(String(i).padStart(2, "0") + " " + r + " |"));
    }
    const r = report(name, rows);
    console.log(JSON.stringify(r));
  }
}

if (isMain && process.argv.includes("--emit")) {
  const body = `// levels.mjs —— 手作巷弄与一夜五更关卡表（由 tools/build-mazes.mjs 生成，勿手改瓦片串）
/** 图例：# 墙 . 光尘 * 日曜珠 - 空巷 H 影匣 D 匣门 P 出生点 F 流明灯 u 匣口禁上转
 */

export const LAYOUTS = ${JSON.stringify(LAYOUTS, null, 2)};

export const TEMPLATES = ${JSON.stringify(TEMPLATES, null, 2)};

/** 影魅花名册：beh 见 engine.GHOST_BEH */
export const ROSTERS = {
  solo: [{ name: "赤影", beh: "chaser", color: "red", scatter: "tr", house: 0 }],
  classic: [
    { name: "赤影", beh: "chaser", color: "red", scatter: "tr", house: 0 },
    { name: "桃影", beh: "ambush", color: "pink", scatter: "tl", house: 0 },
    { name: "青影", beh: "flanker", color: "cyan", scatter: "br", house: 0 },
    { name: "橘影", beh: "dither", color: "orange", scatter: "bl", house: 0 },
  ],
  hunt: [
    { name: "赤影", beh: "chaser", color: "red", scatter: "tr", house: 0 },
    { name: "桃影", beh: "ambush", color: "pink", scatter: "tl", house: 0 },
    { name: "青影", beh: "flanker", color: "cyan", scatter: "br", house: 0 },
    { name: "直影", beh: "dart", color: "violet", scatter: "bl", house: 0 },
  ],
  fog: [
    { name: "赤影", beh: "chaser", color: "red", scatter: "tr", house: 0 },
    { name: "巡影", beh: "patrol", color: "lime", scatter: "tl", house: 0 },
    { name: "桃影", beh: "ambush", color: "pink", scatter: "br", house: 0 },
    { name: "直影", beh: "dart", color: "violet", scatter: "bl", house: 0 },
  ],
  night: [
    { name: "赤影", beh: "chaser", color: "red", scatter: "tr", house: 0 },
    { name: "桃影", beh: "ambush", color: "pink", scatter: "tl", house: 1 },
    { name: "青影", beh: "flanker", color: "cyan", scatter: "br", house: 0 },
    { name: "橘影", beh: "dither", color: "orange", scatter: "bl", house: 1 },
    { name: "哑影", beh: "silent", color: "gray", scatter: "tl", house: 1 },
    { name: "直影", beh: "dart", color: "violet", scatter: "br", house: 1 },
  ],
};

export const PHASES = (chase, scatter, rounds) => {
  const out = [];
  for (let i = 0; i < rounds; i += 1) out.push([chase, "chase"], [scatter, "scatter"]);
  out.push([chase, "chase"]);
  return out;
};

export const WATCH_NAMES = {
  zh: ["一更 · 上灯", "二更 · 巡巷", "三更 · 风起", "四更 · 雾合", "五更 · 破晓"],
  en: ["Watch I · Lighting", "Watch II · Rounds", "Watch III · Rising Wind", "Watch IV · Fog", "Watch V · Daybreak"],
};

const watchBase = {
  1: { frightMs: 6000, ghostSpeedMul: 0.9, playerSpeedMul: 1, phases: PHASES(7000, 20000, 2) },
  2: { frightMs: 5000, ghostSpeedMul: 0.95, playerSpeedMul: 1, phases: PHASES(8000, 18000, 2) },
  3: { frightMs: 4000, ghostSpeedMul: 1, playerSpeedMul: 1, phases: PHASES(9000, 16000, 2) },
  4: { frightMs: 3000, ghostSpeedMul: 1.03, playerSpeedMul: 0.98, phases: PHASES(10000, 14000, 2) },
  5: { frightMs: 2200, ghostSpeedMul: 1.06, playerSpeedMul: 0.96, phases: PHASES(12000, 12000, 2) },
};

const L = (id, watch, layout, roster, extra = {}) => ({ id, watch, layout, roster, ...extra });

const SPEC = [
${[
    "L(1, 1, 'alley', 'solo', { teach: 1, release: [0] })",
    "L(2, 1, 'alley', 'solo', { teach: 1, release: [0, 6000] })",
    "L(3, 1, 'rings', 'classic', { release: [0, 5000, 12000, 18000] })",
    "L(4, 1, 'square', 'classic', { pearlCount: 4 })",
    "L(5, 1, 'alley', 'classic', {})",
    "L(6, 1, 'rings', 'classic', { ghostSpeedMul: 0.95 })",
    "L(7, 2, 'cross', 'classic', {})",
    "L(8, 2, 'alley', 'classic', { fruitValue: 300 })",
    "L(9, 2, 'lanes', 'classic', {})",
    "L(10, 2, 'rings', 'classic', { ghostSpeedMul: 0.97 })",
    "L(11, 2, 'square', 'classic', {})",
    "L(12, 2, 'cross', 'classic', { fruitValue: 300, ghostSpeedMul: 1 })",
    "L(13, 3, 'alley', 'hunt', {})",
    "L(14, 3, 'lanes', 'hunt', {})",
    "L(15, 3, 'rings', 'hunt', { trainCap: 4 })",
    "L(16, 3, 'cross', 'hunt', {})",
    "L(17, 3, 'square', 'hunt', { ghostSpeedMul: 1.02 })",
    "L(18, 3, 'lanes', 'hunt', { fruitValue: 500 })",
    "L(19, 4, 'alley', 'fog', { fog: 0.75 })",
    "L(20, 4, 'square', 'fog', { fog: 0.8 })",
    "L(21, 4, 'cross', 'fog', { fog: 0.85 })",
    "L(22, 4, 'rings', 'fog', { fog: 0.9 })",
    "L(23, 4, 'lanes', 'fog', { fog: 0.95 })",
    "L(24, 4, 'alley', 'fog', { fog: 1, ghostSpeedMul: 1.04 })",
    "L(25, 5, 'twin', 'night', { frightMs: 1800, pearlCount: 3 })",
    "L(26, 5, 'twin', 'night', { frightMs: 1700 })",
    "L(27, 5, 'cross', 'night', { frightMs: 1600 })",
    "L(28, 5, 'lanes', 'night', { frightMs: 1500 })",
    "L(29, 5, 'twin', 'night', { frightMs: 1400, ghostSpeedMul: 1.08 })",
    "L(30, 5, 'arena', 'night', { frightMs: 1300, ghostSpeedMul: 1.1, final: 1 })",
  ]
    .map((s) => `  ${s},`)
    .join("\n")}
];

export const LEVELS = SPEC.map((s) => {
  const wb = watchBase[s.watch] ?? watchBase[1];
  const { roster, ...rest } = s;
  return {
    ...wb,
    parMs: 78000 + (s.watch - 1) * 6000,
    fruitValue: [100, 300, 500, 700, 1000, 2000, 3000, 5000][Math.min(7, (s.watch - 1) * 2)],
    ...rest,
    rosterKey: roster,
    roster: (ROSTERS[roster] ?? ROSTERS.classic).map((r) => ({ ...r })),
  };
});

export const LEVEL_COUNT = LEVELS.length;
export const LEVELS_PER_WATCH = 6;
export const ARENA_LAYOUT = "arena";
export const TIME_POOL = ["alley", "rings", "square", "cross", "lanes"];

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) ?? null;
}

export function levelsByWatch(watch) {
  return LEVELS.filter((l) => l.watch === watch);
}

export function rowsForLevel(id) {
  const lvl = levelById(id);
  return lvl ? LAYOUTS[lvl.layout] ?? LAYOUTS.alley : LAYOUTS.alley;
}
`;
  writeFileSync(resolve(here, "..", "js", "levels.mjs"), body, "utf8");
  console.log("-- levels.mjs written");
}
