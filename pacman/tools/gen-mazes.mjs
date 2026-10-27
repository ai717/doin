// 7 张主题迷宫 + 10 张残局的确定性产线。
//   node tools/gen-mazes.mjs  ->  覆写 games/pacman/js/mazes.mjs
//
// 为什么不手写 28×31：手写迷宫极易出现「某颗豆不可达 / 单向风道把某段走廊锁死 /
// 没有可绕圈的回路」这类致命问题，肉眼根本查不出来。改成
//   「对称生成 → 消死胡同 → 放机关 → 有向可达性 + SCC 回路 + 围堵点 三重校验」
// 通不过就换种子重来，最后把通过校验的结果**固化成静态数据**。
// 运行时零随机：游戏只读 js/mazes.mjs，tests/mazes.test.mjs 会现场重跑校验再验一遍。

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const COLS = 28;
const ROWS = 31;
const TUNNEL_ROW = 17;
const PLAYER_START = { x: 13, y: 23, dir: 2 }; // 2 = LEFT
const FRUIT_TILE = { x: 13, y: 19 };
const HOUSE = { x0: 11, y0: 15, x1: 16, y1: 16 };
const HOUSE2 = { x0: 11, y0: 24, x1: 16, y1: 25 };
const DOOR_ROW_OFFSET = -1;
const EXIT_OFFSET = -2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEALED = new Set(); // 巢体封边所在格，任何修复逻辑都不得凿穿

const idx = (x, y) => y * COLS + x;
const inBounds = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;

// ------------------------------------------------------------------ 图工具

const DIRS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

function buildPassMatrix(cells, tunnelRows) {
  // pass[i][d] = 从格 i 沿方向 d 是否可走（已含单向风道与隧道环绕）
  const pass = new Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = idx(x, y);
      if (cells[i] === "#") {
        pass[i] = [false, false, false, false];
        continue;
      }
      const arr = [];
      for (const d of DIRS) {
        let nx = x + d.x;
        let ny = y + d.y;
        if (nx < 0) {
          nx = COLS - 1;
        } else if (nx >= COLS) {
          nx = 0;
        }
        if (ny < 0 || ny >= ROWS) {
          arr.push(false);
          continue;
        }
        const ni = idx(nx, ny);
        if (nx === 0 && x === COLS - 1 && tunnelRows.includes(y)) {
          arr.push(cells[ni] !== "#");
          continue;
        }
        if (nx === COLS - 1 && x === 0 && tunnelRows.includes(y)) {
          arr.push(cells[ni] !== "#");
          continue;
        }
        if (Math.abs(nx - x) > 1 && !tunnelRows.includes(y)) {
          arr.push(false);
          continue;
        }
        arr.push(cells[ni] !== "#");
      }
      pass[i] = arr;
    }
  }
  // 单向风道：进入 / 离开都必须顺着箭头方向
  for (let i = 0; i < cells.length; i++) {
    const ch = cells[i];
    const ow = ch === ">" ? 3 : ch === "<" ? 2 : ch === "^" ? 0 : ch === "v" ? 1 : -1;
    if (ow < 0) continue;
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    for (let d = 0; d < 4; d++) if (d !== ow) pass[i][d] = false;
    // 逆向进入本格同样禁止
    for (let d = 0; d < 4; d++) {
      if (d === ow) continue;
      const bx = x - DIRS[d].x;
      const by = y - DIRS[d].y;
      if (!inBounds(bx, by)) continue;
      if (Math.abs(bx - x) > 1) continue;
      pass[idx(bx, by)][d] = false;
    }
  }
  return pass;
}

function reachableFrom(pass, startId) {
  const seen = new Uint8Array(COLS * ROWS);
  const stack = [startId];
  seen[startId] = 1;
  while (stack.length) {
    const cur = stack.pop();
    const x = cur % COLS;
    const y = Math.floor(cur / COLS);
    for (let d = 0; d < 4; d++) {
      if (!pass[cur][d]) continue;
      let nx = x + DIRS[d].x;
      let ny = y + DIRS[d].y;
      if (nx < 0) nx = COLS - 1;
      if (nx >= COLS) nx = 0;
      const ni = idx(nx, ny);
      if (seen[ni]) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}

/** Tarjan：返回最大强连通分量的节点数。>=12 说明存在可供玩家绕圈摆脱围堵的回路区。 */
function largestScc(pass) {
  let index = 0;
  const num = new Int32Array(COLS * ROWS).fill(-1);
  const low = new Int32Array(COLS * ROWS);
  const onStack = new Uint8Array(COLS * ROWS);
  const stack = [];
  const sizes = [];
  const dfs = (v) => {
    num[v] = low[v] = index++;
    stack.push(v);
    onStack[v] = 1;
    const x = v % COLS;
    const y = Math.floor(v / COLS);
    for (let d = 0; d < 4; d++) {
      if (!pass[v][d]) continue;
      let nx = x + DIRS[d].x;
      let ny = y + DIRS[d].y;
      if (nx < 0) nx = COLS - 1;
      if (nx >= COLS) nx = 0;
      const ni = idx(nx, ny);
      if (num[ni] === -1) {
        dfs(ni);
        low[v] = Math.min(low[v], low[ni]);
      } else if (onStack[ni]) {
        low[v] = Math.min(low[v], num[ni]);
      }
    }
    if (low[v] === num[v]) {
      let size = 0;
      for (;;) {
        const w = stack.pop();
        onStack[w] = 0;
        size++;
        if (w === v) break;
      }
      sizes.push(size);
    }
  };
  for (let i = 0; i < COLS * ROWS; i++) if (num[i] === -1) dfs(i);
  return sizes.length ? Math.max(...sizes) : 0;
}

/** 返回最大「唯一出口 + 深度」的死胡同深度。 */
function maxDeadEndDepth(pass, cells, reserved) {
  let worst = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = idx(x, y);
      if (cells[i] === "#" || reserved.has(i)) continue;
      if (degree(pass, i) !== 1) continue;
      // 从叶子往里走
      let depth = 1;
      let cur = i;
      const visited = new Set([i]);
      for (;;) {
        const nbs = [];
        const cx = cur % COLS;
        const cy = Math.floor(cur / COLS);
        for (let d = 0; d < 4; d++) {
          if (!pass[cur][d]) continue;
          let nx = cx + DIRS[d].x;
          let ny = cy + DIRS[d].y;
          if (nx < 0) nx = COLS - 1;
          if (nx >= COLS) nx = 0;
          const ni = idx(nx, ny);
          if (visited.has(ni)) continue;
          nbs.push(ni);
        }
        if (nbs.length !== 1) break;
        cur = nbs[0];
        visited.add(cur);
        depth++;
        if (degree(pass, cur) > 2) break;
        if (depth > 40) break;
      }
      worst = Math.max(worst, depth);
    }
  }
  return worst;
}

function degree(pass, i) {
  let d = 0;
  for (let k = 0; k < 4; k++) if (pass[i][k]) d++;
  return d;
}

// ------------------------------------------------------------------ 生成

// key 是 i18n 语义键（js/i18n.mjs 里对应 mazeName_* / mazeTip_*），数据层不得裸写中文
const THEMES = [
  { id: "maze_1", key: "classic", tips: [], secondNest: false },
  { id: "maze_2", key: "duct", tips: ["oneway"], secondNest: false },
  { id: "maze_3", key: "gate", tips: ["gate"], secondNest: false },
  { id: "maze_4", key: "syrup", tips: ["syrup"], secondNest: false },
  { id: "maze_5", key: "frost", tips: ["ice"], secondNest: false },
  { id: "maze_6", key: "twin", tips: [], secondNest: true },
  { id: "maze_7", key: "master", tips: ["oneway", "gate", "syrup", "ice"], secondNest: true },
];

function emptyGrid() {
  const cells = new Array(COLS * ROWS).fill(".");
  for (let x = 0; x < COLS; x++) {
    cells[idx(x, 0)] = "#";
    cells[idx(x, ROWS - 1)] = "#";
  }
  for (let y = 0; y < ROWS; y++) {
    cells[idx(0, y)] = "#";
    cells[idx(COLS - 1, y)] = "#";
  }
  return cells;
}

function reserveRect(cells, reserved, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (ch) cells[idx(x, y)] = ch;
      reserved.add(idx(x, y));
    }
}

function carveReserved(cells, reserved, secondNest) {
  // 隧道
  reserveRect(cells, reserved, 0, TUNNEL_ROW, COLS - 1, TUNNEL_ROW, " ");

  // 幽灵巢：内部 H + 上方巢门 - + 巢门外两格必须留空，否则幽灵出不来
  const placeHouse = (h) => {
    reserveRect(cells, reserved, h.x0, h.y0, h.x1, h.y1, "H");
    const dy = h.y0 + DOOR_ROW_OFFSET;
    reserveRect(cells, reserved, 13, dy, 14, dy, "-");
    const ey = h.y0 + EXIT_OFFSET;
    reserveRect(cells, reserved, 13, ey, 14, ey, " ");
    // 巢门外再留一层缓冲，保证出巢后一定站在通路上
    reserveRect(cells, reserved, 13, ey - 1, 14, ey - 1, " ");
    reserveRect(cells, reserved, 13, Math.max(1, ey - 2), 14, Math.max(1, ey - 2), " ");
  };
  placeHouse(HOUSE);
  if (secondNest) placeHouse(HOUSE2);

  reserveRect(cells, reserved, PLAYER_START.x - 1, PLAYER_START.y, PLAYER_START.x + 1, PLAYER_START.y, " ");
  reserveRect(cells, reserved, FRUIT_TILE.x, FRUIT_TILE.y - 1, FRUIT_TILE.x, FRUIT_TILE.y + 1, " ");
  return { placeHouse };
}

function addSymmetricBlocks(cells, reserved, rnd, attempts) {
  for (let n = 0; n < attempts; n++) {
    const w = 2 + Math.floor(rnd() * 5);
    const h = 1 + Math.floor(rnd() * 4);
    const x = 1 + Math.floor(rnd() * (14 - w));
    const y = 1 + Math.floor(rnd() * (ROWS - 1 - h));
    let ok = true;
    for (let yy = y; yy < y + h && ok; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const i = idx(xx, yy);
        const mi = idx(27 - xx, yy);
        if (reserved.has(i) || reserved.has(mi) || cells[i] === "#" || cells[mi] === "#") {
          ok = false;
          break;
        }
      }
    // 预留 factor：留出 8% 的缝隙，避免把隧道口周围堵死
    if (ok && rnd() < 0.08) ok = false;
    if (!ok) continue;
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        cells[idx(xx, yy)] = "#";
        cells[idx(27 - xx, yy)] = "#";
      }
  }
}

/**
 * 无向连通修复：随机墙块可能把某块地板彻底封死，这里把每个孤立区域
 * 用最短的直线朝新生儿 `/ 保持对称的` 方向凿开连到主区，保证「一格不多、一格不少」地修好。
 */
function repairConnectivity(cells, startId, tunnelRows) {
  const sx = startId % COLS;
  const sy = Math.floor(startId / COLS);
  for (let guard = 0; guard < 400; guard++) {
    const seen = reachableFrom(buildPassMatrix(cells, tunnelRows), startId);
    let orphan = -1;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === "#" || seen[i]) continue;
      const ch = cells[i];
      if (ch === "H" || ch === "-") continue; // 幽灵专用区不必与玩家区相连
      orphan = i;
      break;
    }
    if (orphan < 0) return true;

    let ox = orphan % COLS;
    let oy = Math.floor(orphan / COLS);
    for (let step = 0; step < 200; step++) {
      const reach = reachableFrom(buildPassMatrix(cells, tunnelRows), startId);
      if (reach[idx(ox, oy)]) break;
      const dx = Math.sign(sx - ox);
      const dy = Math.sign(sy - oy);
      let nx = ox;
      let ny = oy;
      if (Math.abs(sx - ox) >= Math.abs(sy - oy) && dx !== 0) nx = ox + dx;
      else if (dy !== 0) ny = oy + dy;
      else if (dx !== 0) nx = ox + dx;
      if (nx < 1) nx = 1;
      if (nx > COLS - 2) nx = COLS - 2;
      if (ny < 1) ny = 1;
      if (ny > ROWS - 2) ny = ROWS - 2;
      if (nx === ox && ny === oy) nx = Math.min(COLS - 2, ox + 1);
      const ni = idx(nx, ny);
      if (SEALED.has(ni)) {
        // 不能凿穿巢体封边，改为纵向绕行
        ny = Math.min(ROWS - 2, Math.max(1, oy + (sy > oy ? 1 : -1)));
        if (SEALED.has(idx(nx, ny))) return false;
      }
      if (cells[idx(nx, ny)] === "#") {
        cells[idx(nx, ny)] = ".";
        cells[idx(27 - nx, ny)] = ".";
      }
      ox = nx;
      oy = ny;
    }
  }
  return false;
}

function pruneDeadEnds(cells, reserved, tunnelRows, maxDepth) {
  for (let pass = 0; pass < 200; pass++) {
    const pm = buildPassMatrix(cells, tunnelRows);
    let changed = false;
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const i = idx(x, y);
        if (cells[i] === "#" || reserved.has(i)) continue;
        if (degree(pm, i) !== 1) continue;
        const mi = idx(27 - x, y);
        cells[i] = "#";
        if (cells[mi] !== "#" && !reserved.has(mi)) cells[mi] = "#";
        changed = true;
      }
    }
    if (!changed) break;
    const d = maxDeadEndDepth(buildPassMatrix(cells, tunnelRows), cells, reserved);
    if (d <= maxDepth) break;
  }
  return cells;
}

/**
 * ★ 巢体封边：把巢外层一圈（含底部隧道行）强行砌成墙，只留两枚巢门。
 * 少了这一步，幽灵会从巢底 / 巢侧的地板直接溜出去，卡在 exiting 永远出不来。
 */
function sealHouses(cells, houses) {
  for (const h of houses) {
    for (let y = h.y0 - 1; y <= h.y1 + 1; y++) {
      for (let x = h.x0 - 1; x <= h.x1 + 1; x++) {
        if (!inBounds(x, y)) continue;
        const inside = y >= h.y0 && y <= h.y1 && x >= h.x0 && x <= h.x1;
        if (inside) continue;
        SEALED.add(idx(x, y));
        if (y === h.y0 - 1 && (x === 13 || x === 14)) continue; // 巢门
        cells[idx(x, y)] = "#";
      }
    }
    cells[idx(13, h.y0 - 1)] = "-";
    cells[idx(14, h.y0 - 1)] = "-";
  }
}

function placeFeature(cells, rnd, ch, count) {
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 3000) {
    const x = 2 + Math.floor(rnd() * (COLS - 4));
    const y = 2 + Math.floor(rnd() * (ROWS - 3));
    const i = idx(x, y);
    const mi = idx(27 - x, y);
    if (cells[i] !== "." || cells[mi] !== ".") continue;
    if (y === TUNNEL_ROW) continue;
    cells[i] = ch;
    cells[mi] = ch;
    placed += 2;
  }
  return placed;
}

/** 单向风道只放在「直线走廊」上，避免把拐角锁死。 */
function placeOnewayRuns(cells, rnd, count) {
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 5000) {
    const horizontal = rnd() < 0.5;
    const len = 2 + Math.floor(rnd() * 3);
    const x = 3 + Math.floor(rnd() * (COLS - 7));
    const y = 2 + Math.floor(rnd() * (ROWS - 4));
    if (y === TUNNEL_ROW) continue;
    const cellsIdx = [];
    for (let k = 0; k < len; k++) {
      const xx = x + (horizontal ? k : 0);
      const yy = y + (horizontal ? 0 : k);
      if (xx >= COLS - 3 || yy >= ROWS - 2) break;
      cellsIdx.push(idx(xx, yy));
    }
    if (cellsIdx.length !== len) continue;
    const mirrorCells = cellsIdx.map((i) => idx(27 - (i % COLS), Math.floor(i / COLS)));
    if (!cellsIdx.every((i) => cells[i] === ".")) continue;
    if (!mirrorCells.every((i) => cells[i] === ".")) continue;
    const ch = horizontal ? (rnd() < 0.5 ? ">" : "<") : rnd() < 0.5 ? "v" : "^";
    const ch2 = horizontal ? (ch === ">" ? "<" : ">") : ch === "v" ? "^" : "v";
    cellsIdx.forEach((i) => (cells[i] = ch));
    mirrorCells.forEach((i) => (cells[i] = ch2));
    placed += len;
  }
  return placed;
}

function placePowerPellets(cells, reserved) {
  const spots = [
    { x: 3, y: 3 },
    { x: 24, y: 3 },
    { x: 3, y: 27 },
    { x: 24, y: 27 },
  ];
  for (const s of spots) {
    let found = null;
    for (let r = 0; r < 8 && !found; r++) {
      const cand = [
        { x: s.x, y: s.y },
        { x: s.x + (s.x < 14 ? r : -r), y: s.y },
        { x: s.x, y: s.y + (s.y < 15 ? r : -r) },
      ];
      for (const c of cand) {
        if (!inBounds(c.x, c.y)) continue;
        const i = idx(c.x, c.y);
        if (cells[i] === "." && !reserved.has(i)) {
          found = c;
          break;
        }
      }
    }
    if (found) cells[idx(found.x, found.y)] = "o";
  }
}

/**
 * 出生点动态选取：下半区里「离两个巢门都最远」的通行格。
 * 固定写死一个坐标会撞上第二巢的巢门行（双巢迷宫里那一行全是巢门/封边，玩家会卡死）。
 */
function pickPlayerStart(cells, exits) {
  let best = null;
  for (let y = ROWS - 8; y <= ROWS - 2; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      const i = idx(x, y);
      if (cells[i] !== ".") continue;
      let deg = 0;
      for (const d of DIRS) {
        const nx = x + d.x;
        const ny = y + d.y;
        if (!inBounds(nx, ny)) continue;
        if (cells[idx(nx, ny)] !== "#") deg++;
      }
      if (deg < 2) continue;
      let score = Infinity;
      for (const e of exits) score = Math.min(score, Math.abs(x - e.x) + Math.abs(y - e.y));
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (!best) return { x: 13, y: ROWS - 4 };
  cells[idx(best.x, best.y)] = " ";
  return { x: best.x, y: best.y, dir: 2 };
}

function pickFruitTile(cells) {
  const want = { x: 13, y: HOUSE.y1 + 2 };
  let best = null;
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++) {
      const i = idx(x, y);
      if (cells[i] !== ".") continue;
      const d = Math.abs(x - want.x) + Math.abs(y - want.y);
      if (!best || d < best.d) best = { x, y, d };
    }
  if (!best) return { x: 13, y: HOUSE.y1 + 2 };
  cells[idx(best.x, best.y)] = " ";
  return { x: best.x, y: best.y };
}

function finalizeLayout(cells, secondNest) {
  if (secondNest) {
    for (let y = HOUSE2.y0; y <= HOUSE2.y1; y++)
      for (let x = HOUSE2.x0; x <= HOUSE2.x1; x++) cells[idx(x, y)] = "H";
    cells[idx(13, HOUSE2.y0 + DOOR_ROW_OFFSET)] = "-";
    cells[idx(14, HOUSE2.y0 + DOOR_ROW_OFFSET)] = "-";
    cells[idx(13, HOUSE2.y0 + EXIT_OFFSET)] = " ";
    cells[idx(14, HOUSE2.y0 + EXIT_OFFSET)] = " ";
  }
  return cells;
}

function toRows(cells) {
  const rows = [];
  for (let y = 0; y < ROWS; y++) rows.push(cells.slice(y * COLS, (y + 1) * COLS).join(""));
  return rows;
}

function attemptMaze(theme, seed) {
  const rnd = mulberry32(seed);
  const cells = emptyGrid();
  const reserved = new Set();
  carveReserved(cells, reserved, theme.secondNest);

  const tunnels = [TUNNEL_ROW];
  // 先用几何中心当锚点做一次整体连通修复；真正的出生点确定后会再修一次
  const startId = idx(PLAYER_START.x, PLAYER_START.y);
  addSymmetricBlocks(cells, reserved, rnd, 300);
  sealHouses(cells, theme.secondNest ? [HOUSE, HOUSE2] : [HOUSE]);
  pruneDeadEnds(cells, reserved, tunnels, 4);
  repairConnectivity(cells, startId, tunnels);

  // 纵向利用率：底部不能缩成一条带子。双巢迷宫要把第二巢所在的行段排除在外。
  const utilFrom = theme.secondNest ? HOUSE2.y1 + 2 : ROWS - 5;
  const utilMin = theme.secondNest ? 8 : 10;
  for (let y = utilFrom; y <= ROWS - 2; y++) {
    let open = 0;
    for (let x = 1; x < COLS - 1; x++) if (cells[idx(x, y)] !== "#") open++;
    if (open < utilMin) return { ok: false, reason: `rowUtil row${y}=${open}` };
  }

  if (theme.tips.includes("oneway")) placeOnewayRuns(cells, rnd, 5);
  if (theme.tips.includes("gate")) placeFeature(cells, rnd, "G", 6);
  if (theme.tips.includes("syrup")) placeFeature(cells, rnd, "~", 10);
  if (theme.tips.includes("ice")) placeFeature(cells, rnd, "*", 10);
  finalizeLayout(cells, theme.secondNest);

  const exits = theme.secondNest
    ? [
        { x: 13, y: HOUSE.y0 + EXIT_OFFSET },
        { x: 13, y: HOUSE2.y0 + EXIT_OFFSET },
      ]
    : [{ x: 13, y: HOUSE.y0 + EXIT_OFFSET }];
  const playerStart = pickPlayerStart(cells, exits);
  const fruitTile = pickFruitTile(cells);
  // 出生点确定后以它为锚再修一次，保证开局所在的连通域覆盖整张盘
  repairConnectivity(cells, idx(playerStart.x, playerStart.y), tunnels);
  placePowerPellets(cells, reserved);

  const rows = toRows(cells);
  const flat = rows.join("").split("");
  void startId;
  const pm = buildPassMatrix(flat, tunnels);
  const reach = reachableFrom(pm, idx(playerStart.x, playerStart.y));

  let floorCount = 0;
  let pelletCount = 0;
  for (let i = 0; i < flat.length; i++) {
    if (flat[i] === "#") continue;
    floorCount++;
    if (flat[i] === "." || flat[i] === "o") pelletCount++;
  }
  if (pelletCount < 180 || pelletCount > 330) return { ok: false, reason: `pellets=${pelletCount}` };

  // ① 所有豆必须在「有向」意义上可达
  for (let i = 0; i < flat.length; i++) {
    if (flat[i] === "." || flat[i] === "o") {
      if (!reach[i]) return { ok: false, reason: `pellet unreachable @${i % COLS},${Math.floor(i / COLS)}` };
    }
  }
  // ② 存在 >=12 格的回路区
  const scc = largestScc(pm);
  if (scc < 12) return { ok: false, reason: `scc=${scc}` };
  // ③ 无深死胡同
  const depth = maxDeadEndDepth(pm, flat, reserved);
  if (depth > 4) return { ok: false, reason: `deadEnd=${depth}` };

  return { ok: true, rows, scc, depth, pelletCount, floorCount, playerStart, fruitTile };
}

function generateMaze(theme) {
  const tally = new Map();
  for (let seed = 1; seed < 4000; seed++) {
    const res = attemptMaze(theme, seed);
    if (res.ok) return { ...res, seed };
    const key = String(res.reason).replace(/\d+/g, "N");
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  console.error(`  [diag] ${theme.id} failures:`, [...tally.entries()].slice(0, 8));
  for (let seed = 1; seed < 4000; seed++) {
    const res = attemptMaze(theme, seed);
    if (res.ok) return { ...res, seed };
  }
  throw new Error(`cannot generate ${theme.id}`);
}

// ------------------------------------------------------------------ 残局

function buildSetpieces(mazes) {
  const list = [];
  const used = [];
  const push = (sp) => list.push(sp);

  // clear：清空一小片区域的豆
  const clearSpecs = [
    { maze: "maze_1", box: { x0: 3, y0: 8, x1: 10, y1: 13 }, limit: 55 },
    { maze: "maze_2", box: { x0: 17, y0: 8, x1: 24, y1: 13 }, limit: 55 },
    { maze: "maze_3", box: { x0: 3, y0: 19, x1: 11, y1: 25 }, limit: 60 },
    { maze: "maze_4", box: { x0: 16, y0: 19, x1: 24, y1: 26 }, limit: 60 },
  ];
  // escape：从起点安全抵达远端出口。出口坐标绝不硬编码——各张迷宫的墙体不同，
  // 写死坐标迟早落在墙里；改从出生点 BFS，取可达集合里最远的一格。
  const escapeSpecs = [
    { maze: "maze_1", limit: 50 },
    { maze: "maze_2", limit: 60 },
    { maze: "maze_5", limit: 60 },
  ];
  // chain：连吃全部 4 只
  const chainSpecs = [
    { maze: "maze_1", limit: 60 },
    { maze: "maze_3", limit: 65 },
    { maze: "maze_6", limit: 65 },
  ];

  for (const [i, spec] of clearSpecs.entries()) {
    const maze = mazes.find((m) => m.id === spec.maze);
    const keep = [];
    for (let y = spec.box.y0; y <= spec.box.y1; y++)
      for (let x = spec.box.x0; x <= spec.box.x1; x++) {
        const i2 = idx(x, y);
        const ch = maze.cells[y][x];
        if (ch === "." ) keep.push(i2);
      }
    if (keep.length < 12) continue;
    const ghosts = pickGhostTiles(maze, spec.box.y0, 4);
    push({
      id: `sp_clear_${i + 1}`,
      mazeId: spec.maze,
      goal: "clear",
      keep,
      ghosts,
      limitTime: spec.limit,
      player: maze.playerStart,
      lives: 1,
    });
  }
  for (const [i, spec] of escapeSpecs.entries()) {
    const maze = mazes.find((m) => m.id === spec.maze);
    const exit = pickEscapeTile(maze);
    if (!exit) throw new Error(`escape: no reachable exit tile in ${spec.maze}`);
    const keep = keepOuterRing(maze, exit);
    const ghosts = pickGhostTilesNear(maze, exit, 4, 7);
    push({
      id: `sp_escape_${i + 1}`,
      mazeId: spec.maze,
      goal: "escape",
      exit,
      keep,
      ghosts,
      limitTime: spec.limit,
      player: maze.playerStart,
      lives: 1,
    });
  }
  for (const [i, spec] of chainSpecs.entries()) {
    const maze = mazes.find((m) => m.id === spec.maze);
    const keep = powerPelletIndices(maze);
    const ghosts = pickGhostTilesNear(maze, { x: 13, y: 13 }, 4, 6);
    push({
      id: `sp_chain_${i + 1}`,
      mazeId: spec.maze,
      goal: "chain",
      keep,
      ghosts,
      limitTime: spec.limit,
      player: maze.playerStart,
      lives: 1,
    });
  }
  void used;
  return list;
}

function powerPelletIndices(maze) {
  const out = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) if (maze.cells[y][x] === "o") out.push(idx(x, y));
  return out;
}

/**
 * 出口 = 从出生点 BFS 可达集合里「最远」的一格（BFS 层数最大的那一层里 idx 最小的点）。
 * 绝不用欧氏距离挑：绕路才是迷宫的常态，直线最远的那格很可能是墙后的死区。
 */
function pickEscapeTile(maze) {
  const cells = maze.cells;
  const start = maze.playerStart;
  const walk = (x, y) => {
    const ch = cells[y][x];
    return ch !== "#" && ch !== "H" && ch !== "-";
  };
  let frontier = [start];
  const seen = new Set([idx(start.x, start.y)]);
  let deepest = null;
  while (frontier.length) {
    const next = [];
    const layer = [];
    for (const cur of frontier) {
      layer.push(cur);
      for (const d of DIRS) {
        const nx = cur.x + d.x;
        const ny = cur.y + d.y;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        const ni = idx(nx, ny);
        if (seen.has(ni) || !walk(nx, ny)) continue;
        seen.add(ni);
        next.push({ x: nx, y: ny });
      }
    }
    // 取本层里 idx 最小的点，保证确定性
    layer.sort((a, b) => idx(a.x, a.y) - idx(b.x, b.y));
    deepest = layer[0];
    frontier = next;
  }
  return deepest;
}

function keepOuterRing(maze, goal) {
  // 沿 A 点到出口之间保留一条稀疏的豆作为路线暗示
  const keep = [];
  for (let x = 1; x < COLS - 1; x += 3)
    for (let y = 1; y < ROWS - 1; y += 5) {
      const i = idx(x, y);
      const ch = maze.cells[y][x];
      if (ch === ".") keep.push(i);
    }
  const gi = idx(goal.x, goal.y);
  if (maze.cells[goal.y][goal.x] === "." && !keep.includes(gi)) keep.push(gi);
  return keep;
}

function pickGhostTiles(maze, avoidRow, count) {
  const out = [];
  for (let y = 1; y < ROWS - 1 && out.length < count; y++) {
    if (Math.abs(y - avoidRow) < 4 && y < ROWS / 2) continue;
    for (let x = 1; x < COLS - 1 && out.length < count; x++) {
      const ch = maze.cells[y][x];
      if (ch !== "." && ch !== " ") continue;
      if (y >= HOUSE.y0 - 1 && y <= HOUSE.y1 + 1 && x >= HOUSE.x0 - 1 && x <= HOUSE.x1 + 1) continue;
      out.push({ x, y, dir: 2, mode: "chase" });
      break;
    }
  }
  return out;
}

function pickGhostTilesNear(maze, center, count, minDist) {
  const out = [];
  let best = [];
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++) {
      const ch = maze.cells[y][x];
      if (ch !== "." && ch !== " ") continue;
      if (y >= HOUSE.y0 - 1 && y <= HOUSE.y1 + 1 && x >= HOUSE.x0 - 1 && x <= HOUSE.x1 + 1) continue;
      const d = Math.abs(x - center.x) + Math.abs(y - center.y);
      if (d < minDist) continue;
      best.push({ x, y, d });
    }
  best.sort((a, b) => a.d - b.d);
  const step = Math.max(1, Math.floor(best.length / (count * 2)));
  for (let i = 0; i < best.length && out.length < count; i += step)
    out.push({ x: best[i].x, y: best[i].y, dir: 2, mode: "chase" });
  while (out.length < count && best.length) {
    const b = best[(out.length * 7) % best.length];
    out.push({ x: b.x, y: b.y, dir: 2, mode: "chase" });
  }
  return out;
}

// ------------------------------------------------------------------ 输出

function main() {
  const mazes = THEMES.map((theme) => {
    const res = generateMaze(theme);
    const tunnels = [TUNNEL_ROW];
    const nests = [
      {
        exitTile: { x: 13, y: HOUSE.y0 + EXIT_OFFSET },
        slots: [
          { x: 12, y: HOUSE.y1 },
          { x: 15, y: HOUSE.y1 },
          { x: 13, y: HOUSE.y1 },
          { x: 14, y: HOUSE.y1 },
        ],
      },
    ];
    if (theme.secondNest) {
      nests.push({
        exitTile: { x: 13, y: HOUSE2.y0 + EXIT_OFFSET },
        slots: [
          { x: 12, y: HOUSE2.y1 },
          { x: 15, y: HOUSE2.y1 },
        ],
      });
    }
    return {
      id: theme.id,
      cells: res.rows,
      tunnelRows: tunnels,
      playerStart: res.playerStart,
      fruitTile: res.fruitTile,
      nests,
      parTime: 95 + THEMES.indexOf(theme) * 8,
      meta: {
        key: theme.key,
        tips: theme.tips.slice(),
        seed: res.seed,
        scc: res.scc,
        depth: res.depth,
        pellets: res.pelletCount,
      },
    };
  });

  const setpieces = buildSetpieces(mazes);

  const lines = [];
  lines.push("// AUTO-GENERATED by tools/gen-mazes.mjs —— 请勿手改，改参数后重跑产线。");
  lines.push("// 所有迷宫均已通过：① 有向可达性（全部豆）② 最大 SCC >= 12（可绕圈摆脱围堵）③ 死胡同深度 <= 4。");
  lines.push("// 数据层零中文：展示文本统一由 UI 查 js/i18n.mjs。");
  lines.push("");
  lines.push("export const PLAYER_START_CHAR = { x: 13, y: 23, dir: 2 };");
  lines.push("");
  lines.push("export const MAZES = [");
  for (const m of mazes) {
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(m.id)},`);
    lines.push(`    tunnelRows: ${JSON.stringify(m.tunnelRows)},`);
    lines.push(`    playerStart: ${JSON.stringify(m.playerStart)},`);
    lines.push(`    fruitTile: ${JSON.stringify(m.fruitTile)},`);
    lines.push(`    parTime: ${m.parTime},`);
    lines.push(`    meta: ${JSON.stringify(m.meta)},`);
    lines.push("    nests: [");
    for (const n of m.nests) {
      lines.push(
        `      { exitTile: ${JSON.stringify(n.exitTile)}, slots: ${JSON.stringify(n.slots)} },`
      );
    }
    lines.push("    ],");
    lines.push("    cells: [");
    for (const row of m.cells) lines.push(`      ${JSON.stringify(row)},`);
    lines.push("    ],");
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");
  lines.push("export const SETPIECES = [");
  for (const sp of setpieces) {
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(sp.id)},`);
    lines.push(`    mazeId: ${JSON.stringify(sp.mazeId)},`);
    lines.push(`    goal: ${JSON.stringify(sp.goal)},`);
    if (sp.exit) lines.push(`    exit: ${JSON.stringify(sp.exit)},`);
    lines.push(`    keep: ${JSON.stringify(sp.keep)},`);
    lines.push(`    ghosts: ${JSON.stringify(sp.ghosts)},`);
    lines.push(`    player: ${JSON.stringify(sp.player)},`);
    lines.push(`    limitTime: ${sp.limitTime},`);
    lines.push(`    lives: ${sp.lives},`);
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");
  lines.push('export const SETPIECE_GOALS = ["clear", "escape", "chain"];');
  lines.push("");

  const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "js", "mazes.mjs");
  writeFileSync(out, lines.join("\n"), "utf8");
  console.log(
    `generated ${mazes.length} mazes, ${setpieces.length} setpieces -> ${out}`
  );
  for (const m of mazes) {
    console.log(
      `  ${m.id}: seed=${m.meta.seed} pellets=${m.meta.pellets} scc=${m.meta.scc} deadEnd=${m.meta.depth}`
    );
  }
  for (const sp of setpieces) {
    console.log(`  ${sp.id}: maze=${sp.mazeId} goal=${sp.goal} keep=${sp.keep.length} limit=${sp.limitTime}`);
  }
}

main();
