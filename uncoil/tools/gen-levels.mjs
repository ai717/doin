// 倒退贪吃蛇 Uncoil · 离线关卡生成器（不参与运行时，仅产出 js/levels.mjs）
//
// ★ 可解性来自「哈密顿路径基底」，而不是生成后再求解：
//   1. 先在网格上铺一条覆盖全部格子的自避路径 H（行蛇形 / 列蛇形 / 螺旋，三种基底轮换）；
//   2. 初始蛇 = H 上连续的一段（占 L 格），头落在该段的端点；
//   3. 正向解 = 头沿 H 单调推进一格一格往前拱。每走一步尾巴同步退出一格，
//      蛇占据的始终是 H 上的一个滑动窗口，因此**永远不会撞到自己**；
//   4. 蜕身丸直接放在头这一步的落点上 —— 它必然吃得到，且吃的位置与时机写进关卡数据，
//      运行时不做任何随机投放，可解性证明保持完整。
//
// ★ 解谜性从哪来：H 只是「网格上的一条路径」，并不等于「网格上的唯一走法」。
//   头所在的格子往往还有跨行/跨列的邻居（不在 H 的相邻位置上），
//   那些就是玩家的抄近路与走错路。沿 H 推进是保底解，玩家要拿三星必须自己找更短的。
//
// 运行：node games/uncoil/tools/gen-levels.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mulberry32 } from "../js/engine.mjs";

const rc = (i, cols) => [Math.floor(i / cols), i % cols];

function dirFromTo(from, to, cols) {
  const [ar, ac] = rc(from, cols);
  const [br, bc] = rc(to, cols);
  if (br === ar - 1 && bc === ac) return "U";
  if (br === ar + 1 && bc === ac) return "D";
  if (bc === ac - 1 && br === ar) return "L";
  if (bc === ac + 1 && br === ar) return "R";
  return null;
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// ---------- 哈密顿路径基底 ----------
// variant 0 行蛇形 / 1 列蛇形 / 2 螺旋（由外向内）
export function buildPath(cols, rows, variant) {
  const H = [];
  if (variant === 1) {
    for (let c = 0; c < cols; c++) {
      for (let i = 0; i < rows; i++) {
        const r = c % 2 === 0 ? i : rows - 1 - i;
        H.push(r * cols + c);
      }
    }
  } else if (variant === 2) {
    let top = 0;
    let bottom = rows - 1;
    let left = 0;
    let right = cols - 1;
    while (top <= bottom && left <= right) {
      for (let c = left; c <= right; c++) H.push(top * cols + c);
      top++;
      for (let r = top; r <= bottom; r++) H.push(r * cols + right);
      right--;
      if (top <= bottom) {
        for (let c = right; c >= left; c--) H.push(bottom * cols + c);
        bottom--;
      }
      if (left <= right) {
        for (let r = bottom; r >= top; r--) H.push(r * cols + left);
        left++;
      }
    }
  } else {
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cols; i++) {
        const c = r % 2 === 0 ? i : cols - 1 - i;
        H.push(r * cols + c);
      }
    }
  }
  return H;
}

// 把 total 拆成 k 份，每份 ≥ 2 且总和严格等于 total
export function planDeltas(total, delta) {
  let k = Math.max(1, Math.min(Math.round(total / delta), Math.floor(total / 2)));
  while (k > 1 && Math.floor(total / k) < 2) k--;
  const base = Math.floor(total / k);
  const rem = total - base * k;
  const out = new Array(k).fill(base);
  for (let i = 0; i < rem; i++) out[i] += 1;
  return out;
}

// 步数预算：头最多只能走 N − L 步（再多就没有新格子可进了）。
// delta 尽量贴近设计值，只在预算装不下 / 丸太碎时才上调。
function autoTune(len, budget, wantDelta) {
  const safe = Math.max(2, budget);
  let delta = Math.max(2, wantDelta);
  let k = planDeltas(len - 1, delta).length;
  while ((k * 2 > safe || k > 20) && delta < 40) {
    delta++;
    k = planDeltas(len - 1, delta).length;
  }
  const avgGap = Math.max(0, Math.min(6, Math.floor(safe / k) - 1));
  const maxGap = Math.max(0, Math.min(6, avgGap));
  const minGap = Math.max(0, Math.min(maxGap, Math.max(0, avgGap - 1)));
  return { delta, minGap, maxGap, k };
}

// ---------- 单关构造 ----------
// 返回 null 表示当前 seed 不可用（几乎不会，除非格子预算为负）
export function generate(spec, seed) {
  const { cols, rows, targetLen } = spec;
  const N = cols * rows;
  const rng = mulberry32(seed);
  const L = targetLen;
  const avail = N - L;
  if (avail < 4) return null;

  const H = buildPath(cols, rows, spec.variant ?? 0);
  if (H.length !== N) return null;

  // 岩层只能放在头走不到的格子上，否则会挡死保底解
  const wallCap = Math.max(0, Math.floor(avail * 0.35));
  const wallCount = Math.min(spec.wallCount ?? 0, wallCap);
  const tune = autoTune(L, avail - wallCount - 1, spec.delta ?? 3);
  const deltas = planDeltas(L - 1, tune.delta);
  const K = deltas.length;

  // back = 头沿 H 递减推进（与递增对称，用来换一种盘面形态）
  const back = spec.dir === "back";
  const stepDir = back ? -1 : 1;
  const startIdx = back ? N - L : L - 1;

  const ops = [];
  const pellets = [];
  let idx = startIdx;
  let pi = 0;
  let since = 0;
  let gap = 0;

  while (pi < K) {
    const next = idx + stepDir;
    if (next < 0 || next >= N) return null;
    const d = dirFromTo(H[idx], H[next], cols);
    if (!d) return null; // 基底路径断裂，属构造 bug
    ops.push(d);
    idx = next;

    const remaining = back ? idx : N - 1 - idx;
    const need = K - pi;
    // 步数将将够吃剩下的丸时必须连吃，不能再空走
    if (since >= gap || remaining <= need) {
      pellets.push([H[idx], deltas[pi]]);
      pi++;
      since = 0;
      gap = randInt(rng, tune.minGap, tune.maxGap);
    } else {
      since++;
    }
  }

  const T = ops.length;
  // 初始蛇 = H 上的一段，头必须落在推进方向的那一端：
  //   forward → 头在 H[L-1]（沿 H 递增）；back → 头在 H[N-L]（沿 H 递减）
  const snake = back ? H.slice(N - L) : H.slice(0, L).reverse();
  if (snake[0] !== H[startIdx]) return null; // 构造自检：头必须就是推进起点

  // 头轨迹之外的格子 → 岩层与回环门的候选池（绝不会破坏保底解）
  const pool = [];
  if (back) for (let i = 0; i <= N - L - 1 - T; i++) pool.push(H[i]);
  else for (let i = L + T; i < N; i++) pool.push(H[i]);

  const walls = [];
  for (let i = 0; i < wallCount && pool.length; i++) {
    walls.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }

  const portals = [];
  const pairs = spec.portals ?? 0;
  for (let p = 0; p < pairs && pool.length >= 2; p++) {
    let a = -1;
    let b = -1;
    for (let t = 0; t < 120; t++) {
      const x = pool[Math.floor(rng() * pool.length)];
      const y = pool[Math.floor(rng() * pool.length)];
      if (x === y) continue;
      const [xr, xc] = rc(x, cols);
      const [yr, yc] = rc(y, cols);
      if (Math.abs(xr - yr) + Math.abs(xc - yc) < 5) continue;
      a = x;
      b = y;
      break;
    }
    if (a < 0) break;
    portals.push([a, b]);
    pool.splice(pool.indexOf(a), 1);
    pool.splice(pool.indexOf(b), 1);
  }

  return {
    snake,
    walls,
    portals,
    pellets,
    solution: ops.join(""),
    par: T
  };
}

export function buildLevel(spec, seedBase = 1) {
  // 目标长度超出网格承载时逐级退让，保证每关都能产出
  for (let relax = 0; relax < 4; relax++) {
    const len = Math.max(4, Math.round(spec.targetLen * (1 - relax * 0.08)));
    const tuned = { ...spec, targetLen: len };
    for (let t = 0; t < (spec.tries ?? 40); t++) {
      const seed = seedBase * 100003 + t * 7717 + relax * 500009;
      const got = generate({ ...tuned, seed }, seed);
      if (!got) continue;
      return {
        id: spec.id,
        chapter: spec.chapter,
        cols: spec.cols,
        rows: spec.rows,
        snake: got.snake,
        walls: got.walls,
        portals: got.portals,
        pellets: got.pellets,
        solution: got.solution,
        par: got.par,
        relaxed: len !== spec.targetLen ? len : 0
      };
    }
  }
  return null;
}

// ---------- 关卡规格表 ----------
// 难度旋钮：网格 / 初始长度 / 每颗丸减量 / 岩层数 / 回环门数 / 基底形态。
// 真正的难度只有一个量：自由格 = cols*rows − L − 岩层。越少越逼近 In-the-Box 极限。
function chapterSpecs() {
  const specs = [];
  const push = (ch, i, o) => specs.push({
    id: `level_${ch}_${i}`,
    chapter: `chapter_${ch}`,
    tries: 60,
    ...o
  });

  // 第一章 · 初蜕：7×7 → 8×8，纯身体腾挪，教追尾与撤销
  const ch1 = [
    { cols: 7, rows: 7, targetLen: 10, delta: 2, variant: 0 },
    { cols: 7, rows: 7, targetLen: 12, delta: 2, variant: 1 },
    { cols: 7, rows: 7, targetLen: 14, delta: 2, variant: 2 },
    { cols: 7, rows: 7, targetLen: 16, delta: 2, variant: 0, dir: "back" },
    { cols: 8, rows: 8, targetLen: 16, delta: 2, variant: 1 },
    { cols: 8, rows: 8, targetLen: 20, delta: 2, variant: 2 },
    { cols: 8, rows: 8, targetLen: 22, delta: 3, variant: 0, dir: "back" },
    { cols: 8, rows: 8, targetLen: 24, delta: 3, variant: 1 }
  ];
  ch1.forEach((o, i) => push(1, i + 1, { ...o, wallCount: 0 }));

  // 第二章 · 岩隙：9×9，岩层入场
  const ch2 = [24, 26, 28, 30, 32, 34, 36, 38];
  ch2.forEach((L, i) => push(2, i + 1, {
    cols: 9, rows: 9, targetLen: L, delta: 3,
    variant: i % 3, wallCount: 2 + (i % 5), dir: i % 2 ? "back" : "fwd"
  }));

  // 第三章 · 紧咬：9×9，自由格逼近极限
  const ch3 = [36, 38, 40, 42, 44, 46, 48, 50];
  ch3.forEach((L, i) => push(3, i + 1, {
    cols: 9, rows: 9, targetLen: L, delta: 4,
    variant: (i + 1) % 3, wallCount: 3 + (i % 5), dir: i % 2 ? "fwd" : "back"
  }));

  // 第四章 · 回环：11×11，回环门打破邻接拓扑
  const ch4 = [56, 60, 64, 68, 70, 72, 74, 76];
  ch4.forEach((L, i) => push(4, i + 1, {
    cols: 11, rows: 11, targetLen: L, delta: 5,
    variant: i % 3, wallCount: 4, portals: i < 6 ? 1 : 2
  }));

  // 第五章 · 无隙：13×13，全机制混合 + 四关百节长蛇旗舰关
  const ch5 = [96, 100, 102, 104, 106, 108, 110, 112];
  ch5.forEach((L, i) => push(5, i + 1, {
    cols: 13, rows: 13, targetLen: L, delta: 6,
    variant: (i + 2) % 3, wallCount: 6 + (i % 4), portals: i % 2,
    dir: i % 2 ? "back" : "fwd", tries: 90
  }));

  return specs;
}

// 残局精选：小盘面、追求最少步数（Endgame Puzzles）
function endgameSpecs() {
  const out = [];
  const L = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
  L.forEach((len, i) => {
    const cols = i < 4 ? 6 : i < 8 ? 7 : 8;
    out.push({
      id: `endgame_${i + 1}`,
      chapter: "endgame",
      cols,
      rows: cols,
      targetLen: len,
      delta: i < 6 ? 2 : 3,
      variant: i % 3,
      wallCount: i < 3 ? 0 : 1 + (i % 3),
      dir: i % 2 ? "back" : "fwd",
      tries: 60
    });
  });
  return out;
}

// ---------- 序列化 ----------
const NUM = (arr) => `[${arr.join(",")}]`;

export function serialize(levels) {
  const body = levels
    .map((l) => {
      const portals = l.portals.length ? NUM(l.portals.map((p) => `[${p[0]},${p[1]}]`)) : "[]";
      return `  {
    id: "${l.id}",
    chapter: "${l.chapter}",
    cols: ${l.cols},
    rows: ${l.rows},
    snake: ${NUM(l.snake)},
    walls: ${NUM(l.walls)},
    portals: ${portals},
    pellets: ${NUM(l.pellets.map((p) => `[${p[0]},${p[1]}]`))},
    solution: "${l.solution}",
    par: ${l.par}
  }`;
    })
    .join(",\n");

  return `// 倒退贪吃蛇 Uncoil · 关卡数据（由 tools/gen-levels.mjs 生成，请勿手改）
// snake 为格子索引序列（头 → 尾）；pellets 为 [格子索引, 减量]；solution 为方向串 U/D/L/R。
// ★ 每一关都携带一条由哈密顿路径基底直接得出的合法解（solution），
//   tests/solvable.test.mjs 会对全关卡做逐 tick 回放校验，确保 100% 可解。

export const RAW_LEVELS = [
${body}
];

const DIR_VEC = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };

// 把紧凑索引数据展开成 engine 期望的坐标结构
export function expandLevel(raw) {
  const cols = raw.cols;
  const pt = (i) => ({ r: Math.floor(i / cols), c: i % cols });
  return {
    id: raw.id,
    chapter: raw.chapter,
    cols,
    rows: raw.rows,
    snake: raw.snake.map(pt),
    walls: raw.walls.map(pt),
    portals: raw.portals.map((p) => [pt(p[0]), pt(p[1])]),
    pellets: raw.pellets.map((p) => ({ ...pt(p[0]), delta: p[1] })),
    par: raw.par,
    solution: [...raw.solution]
  };
}

// solution 用单字母紧凑存储，回放时映射成 engine 的方向名
export const SOLUTION_DIRS = { U: "up", D: "down", L: "left", R: "right" };
export const DIRS_BY_LETTER = DIR_VEC;

export const LEVELS = RAW_LEVELS.map(expandLevel);

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) ?? null;
}

export function levelsOfChapter(chapter) {
  return LEVELS.filter((l) => l.chapter === chapter);
}

export const CHAPTERS = ["chapter_1", "chapter_2", "chapter_3", "chapter_4", "chapter_5"];
export const ENDGAME = LEVELS.filter((l) => l.chapter === "endgame");
`;
}

// ---------- 主流程 ----------
const here = dirname(fileURLToPath(import.meta.url));

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const specs = [...chapterSpecs(), ...endgameSpecs()];
  const levels = [];
  const failed = [];
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const t0 = Date.now();
    const lv = buildLevel(spec, i + 1);
    if (!lv) {
      failed.push(spec.id);
      console.error(`x ${spec.id} FAILED (${spec.cols}x${spec.rows} L=${spec.targetLen})`);
      continue;
    }
    levels.push(lv);
    const free = spec.cols * spec.rows - lv.snake.length - lv.walls.length;
    console.error(
      `ok ${lv.id.padEnd(12)} seg=${String(lv.snake.length).padStart(3)}  ` +
      `pellets=${String(lv.pellets.length).padStart(2)}  par=${String(lv.par).padStart(3)}  ` +
      `free=${String(free).padStart(3)}  ${lv.relaxed ? `(relaxed from ${spec.targetLen}) ` : ""}${Date.now() - t0}ms`
    );
  }
  if (failed.length) {
    console.error(`\n${failed.length} level(s) failed: ${failed.join(", ")}`);
    process.exit(1);
  }
  const out = resolve(here, "..", "js", "levels.mjs");
  writeFileSync(out, serialize(levels), "utf8");
  console.error(`\nwrote ${levels.length} levels -> ${out}`);
}
