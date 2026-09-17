// 连连看 link-up · 规则唯一权威 · 纯函数，不接触任何浏览器全局对象

export const LEVEL_COUNT = 50;
export const DAILY_SECONDS = 240;

// ---------- 确定性 PRNG ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleArray(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// ---------- 关卡配置 ----------
const CHAPTERS = [
  // pairCount controls board density; every pair is placed by the reverse
  // construction below, so the opening position remains provably solvable.
  { chapter: 1, nameKey: "chapterName_1", rows: 6, cols: 6, symbols: 8, pairCount: 12, variant: "rect" },
  { chapter: 2, nameKey: "chapterName_2", rows: 7, cols: 7, symbols: 10, pairCount: 16, variant: "rect" },
  { chapter: 3, nameKey: "chapterName_3", rows: 8, cols: 8, symbols: 12, pairCount: 20, variant: "corners" },
  { chapter: 4, nameKey: "chapterName_4", rows: 9, cols: 8, symbols: 12, pairCount: 24, variant: "rect", four: true },
  { chapter: 5, nameKey: "chapterName_5", rows: 10, cols: 8, symbols: 16, pairCount: 28, variant: "notch" },
];

export function chapterOf(levelIndex) {
  return Math.min(5, Math.max(1, Math.floor((levelIndex - 1) / 10) + 1));
}

export function levelConfig(levelIndex) {
  const i = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(levelIndex)));
  const chapter = Math.floor((i - 1) / 10);
  const base = CHAPTERS[chapter];
  const within = (i - 1) % 10;
  return {
    level: i,
    chapter: base.chapter,
    chapterNameKey: base.nameKey,
    rows: base.rows,
    cols: base.cols,
    symbolCount: base.symbols,
    pairCount: base.pairCount,
    variant: base.variant,
    // 章内波浪式递进：后段启用“同图 4 块”变体与更远配对
    four: base.four === true && within >= 5,
    minDist: within >= 6 ? 2 : 0,
  };
}

// ---------- 异形棋盘 ----------
export function isHoleAt(rows, cols, r, c, variant) {
  if (variant === "corners") {
    const corner = (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
    return corner;
  }
  if (variant === "notch") {
    const cMid = Math.floor(cols / 2);
    const nearTop = r === 0 || r === 1;
    const nearBot = r === rows - 1 || r === rows - 2;
    return (nearTop || nearBot) && (c === cMid - 1 || c === cMid || c === cMid + 1);
  }
  return false;
}

export function isHole(state, r, c) {
  return isHoleAt(state.rows, state.cols, r, c, state.variant);
}

// ---------- 状态 ----------
function makeState(cfg, multiset, seed, kind, dailyDate) {
  const rng = mulberry32(seed);
  const grid = generateBoard(cfg, multiset, rng);
  return {
    version: 1,
    kind,
    levelIndex: cfg.level,
    dailyDate,
    rows: cfg.rows,
    cols: cfg.cols,
    variant: cfg.variant,
    symbolCount: cfg.symbolCount,
    pairCount: cfg.pairCount,
    four: cfg.four,
    minDist: cfg.minDist,
    seed,
    grid,
    totalPieces: multiset.length,
    selected: null,
    eliminated: 0,
    steps: 0,
    combo: 0,
    longestCombo: 0,
    comboBonus: 0,
    shuffleCount: 0,
    status: "playing",
    hintPair: null,
  };
}

export function createGame({ levelIndex, seed } = {}) {
  const cfg = levelConfig(levelIndex);
  const s = seed === undefined ? hashString("link-up-level-" + cfg.level) : seed;
  const multiset = pieceMultiset(cfg);
  return makeState(cfg, multiset, s, "level", null);
}

export function createDaily({ dateStr, seed } = {}) {
  const cfg = {
    level: 41, // 每日按第 5 章基础分口径计分
    rows: 9,
    cols: 8,
    symbolCount: 14,
    pairCount: 28,
    variant: "corners",
    four: true,
    minDist: 1,
  };
  const s = seed === undefined ? hashString("link-up-daily:" + dateStr) : seed;
  const multiset = pieceMultiset(cfg);
  return makeState(cfg, multiset, s, "daily", dateStr || null);
}

export function pieceMultiset({ symbolCount, pairCount, four }) {
  const mult = [];
  const groups = four ? Math.max(1, Math.floor((pairCount ?? symbolCount * 2) / 2)) : Math.max(1, pairCount ?? symbolCount);
  if (four) {
    // A four-set is two matching pairs. Distribute complete sets so every
    // symbol still has exactly four tiles and the pair count stays auditable.
    for (let group = 0; group < groups; group++) {
      const symbol = group % symbolCount;
      mult.push(symbol, symbol, symbol, symbol);
    }
  } else {
    for (let pair = 0; pair < groups; pair++) {
      const symbol = pair % symbolCount;
      mult.push(symbol, symbol);
    }
  }
  return mult;
}

export function getCell(state, r, c) {
  if (!state || !state.grid || !state.grid[r]) return null;
  const v = state.grid[r][c];
  return v === undefined ? null : v;
}

// ---------- 路径合法性（拐点 ≤ 2，允许出界绕行） ----------
function passable(grid, rows, cols, variant, r, c) {
  if (r < 0 || r > rows + 1 || c < 0 || c > cols + 1) return false;
  // 出界绕行：外围一圈恒可通行
  if (r === 0 || r === rows + 1 || c === 0 || c === cols + 1) return true;
  const br = r - 1;
  const bc = c - 1;
  if (isHoleAt(rows, cols, br, bc, variant)) return false;
  return grid[br][bc] === null;
}

export function findPath(state, a, b) {
  return findPathGrid(state.grid, state.rows, state.cols, state.variant, a, b);
}

export function canConnect(state, a, b) {
  return findPathGrid(state.grid, state.rows, state.cols, state.variant, a, b) !== null;
}

function searchPath(grid, rows, cols, variant, a, b, checkSymbol) {
  if (!grid || !a || !b) return null;
  if (a.r === b.r && a.c === b.c) return null;
  if (checkSymbol) {
    const va = grid[a.r] && grid[a.r][a.c];
    const vb = grid[b.r] && grid[b.r][b.c];
    if (va === null || va === undefined || vb === null || vb === undefined || va !== vb) return null;
  }

  const R = rows + 2;
  const C = cols + 2;
  const sr = a.r + 1;
  const sc = a.c + 1;
  const tr = b.r + 1;
  const tc = b.c + 1;
  const DIRS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const best = Array.from({ length: R }, () => Array.from({ length: C }, () => [5, 5, 5, 5]));
  const parent = Array.from({ length: R }, () => Array.from({ length: C }, () => [null, null, null, null]));
  best[sr][sc][0] = 0;
  best[sr][sc][1] = 0;
  best[sr][sc][2] = 0;
  best[sr][sc][3] = 0;
  const q = [[sr, sc, -1, 0]];
  let qi = 0;

  while (qi < q.length) {
    const [r, c, dir, turns] = q[qi++];
    if (r === tr && c === tc) {
      return reconstruct(parent, sr, sc, r, c, dir);
    }
    for (let d = 0; d < 4; d++) {
      const nt = dir === -1 || dir === d ? turns : turns + 1;
      if (nt > 2) continue;
      const dr = DIRS[d][0];
      const dc = DIRS[d][1];
      let nr = r + dr;
      let nc = c + dc;
      while (nr >= 0 && nr < R && nc >= 0 && nc < C) {
        const isTarget = nr === tr && nc === tc;
        if (!isTarget && !passable(grid, rows, cols, variant, nr, nc)) break;
        if (nt < best[nr][nc][d]) {
          best[nr][nc][d] = nt;
          parent[nr][nc][d] = { r, c, dir };
          q.push([nr, nc, d, nt]);
        }
        nr += dr;
        nc += dc;
      }
    }
  }
  return null;
}

function reconstruct(parent, sr, sc, r, c, dir) {
  const pts = [];
  let cr = r;
  let cc = c;
  let cd = dir;
  for (;;) {
    pts.push({ r: cr, c: cc });
    if (cr === sr && cc === sc) break;
    const p = parent[cr][cc][cd];
    if (!p) break;
    cr = p.r;
    cc = p.c;
    cd = p.dir;
  }
  pts.reverse();
  return pts;
}

function findPathGrid(grid, rows, cols, variant, a, b) {
  return searchPath(grid, rows, cols, variant, a, b, true);
}

// 生成期连通检查：两端点可为空格（即将回填），只要求路径中间为空或可绕行
function pathExistsBetween(grid, rows, cols, variant, a, b) {
  return searchPath(grid, rows, cols, variant, a, b, false) !== null;
}

// ---------- 反向构建生成器（数学可解保证） ----------
function collectCells(rows, cols, variant) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isHoleAt(rows, cols, r, c, variant)) cells.push({ r, c });
    }
  }
  return cells;
}

function placePair(grid, rows, cols, variant, pool, symbol, rng, minDist) {
  const order = pool.map((_, i) => i);
  const idx = shuffleArray(order, rng);
  const limit = Math.min(idx.length * 4, 600);
  for (let t = 0; t < limit; t++) {
    const ia = idx[t % idx.length];
    const ib = idx[Math.floor(rng() * idx.length)];
    if (ia === ib) continue;
    const a = pool[ia];
    const b = pool[ib];
    if (minDist > 0) {
      const d = Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
      if (d < minDist) continue;
    }
    if (pathExistsBetween(grid, rows, cols, variant, a, b)) {
      grid[a.r][a.c] = symbol;
      grid[b.r][b.c] = symbol;
      const hi = Math.max(ia, ib);
      const lo = Math.min(ia, ib);
      pool.splice(hi, 1);
      pool.splice(lo, 1);
      return true;
    }
  }
  return false;
}

function generateBoard(cfg, multiset, rng) {
  const { rows, cols, variant, minDist = 0 } = cfg;
  for (let attempt = 0; attempt < 40; attempt++) {
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
    const pool = collectCells(rows, cols, variant);
    // 按“对”打乱再摊平：保证每种符号恰好 per 块（同一对必须相邻）
    const pairs = [];
    for (let i = 0; i < multiset.length; i += 2) pairs.push([multiset[i], multiset[i + 1]]);
    shuffleArray(pairs, rng);
    const order = pairs.flat();
    let ok = true;
    for (let i = 0; i < order.length; i += 2) {
      if (!placePair(grid, rows, cols, variant, pool, order[i], rng, minDist)) {
        ok = false;
        break;
      }
    }
    if (ok) return grid;
  }
  // 极端兜底：同一多集尽量铺（稀疏棋盘下基本不会走到）
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
  const pool = collectCells(rows, cols, variant);
  const pairs = [];
  for (let i = 0; i < multiset.length; i += 2) pairs.push([multiset[i], multiset[i + 1]]);
  shuffleArray(pairs, rng);
  for (const pair of pairs) {
    placePair(grid, rows, cols, variant, pool, pair[0], rng, 0);
  }
  return grid;
}

function remainingMultiset(state) {
  const remaining = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const value = state.grid[r][c];
      if (value !== null && value !== undefined) remaining.push(value);
    }
  }
  return remaining;
}

// 洗牌使用“随机铺放 + 强制保留一对相邻牌”，避免稀疏残局因启发式放置
// 失败而漏牌，同时保证洗牌后至少存在一手合法操作。
function generateShuffleBoard(cfg, multiset, rng) {
  const { rows, cols, variant } = cfg;
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
  const pool = shuffleArray(collectCells(rows, cols, variant), rng);
  if (multiset.length === 0) return grid;

  const first = pool.shift();
  const adjacentIndex = pool.findIndex((cell) =>
    Math.abs(cell.r - first.r) + Math.abs(cell.c - first.c) === 1
  );
  const second = adjacentIndex >= 0 ? pool.splice(adjacentIndex, 1)[0] : pool.shift();
  grid[first.r][first.c] = multiset[0];
  grid[second.r][second.c] = multiset[1];

  const rest = shuffleArray(multiset.slice(2), rng);
  for (let i = 0; i < rest.length; i++) {
    const cell = pool[i];
    grid[cell.r][cell.c] = rest[i];
  }
  return grid;
}

// ---------- 玩家意图 ----------
export function validateMatch(state, a, b) {
  if (state.status !== "playing") return { ok: false, reason: "ended" };
  const path = findPathGrid(state.grid, state.rows, state.cols, state.variant, a, b);
  if (!path) return { ok: false, reason: "blocked" };
  return { ok: true, path };
}

export function handleSelect(state, r, c) {
  if (state.status !== "playing") return { action: null };
  if (isHole(state, r, c)) return { action: null };
  const v = getCell(state, r, c);
  if (v === null) return { action: null }; // 点错已消除格：无反应
  const sel = state.selected;
  if (sel && sel.r === r && sel.c === c) {
    state.selected = null;
    return { action: "deselect", cell: { r, c } };
  }
  if (!sel) {
    state.selected = { r, c };
    return { action: "select", cell: { r, c } };
  }
  if (v === getCell(state, sel.r, sel.c)) {
    const res = validateMatch(state, sel, { r, c });
    if (res.ok) {
      return { action: "match", a: { r: sel.r, c: sel.c }, b: { r, c }, path: res.path };
    }
    // 同图案但被阻挡：保持选中，反馈抖动，绝不吞操作
    return { action: "reject", cell: { r, c }, reason: res.reason };
  }
  state.selected = { r, c };
  return { action: "select", cell: { r, c } };
}

export function commitEliminate(state, a, b) {
  state.grid[a.r][a.c] = null;
  state.grid[b.r][b.c] = null;
  state.eliminated += 2;
  state.steps += 1;
  state.combo += 1;
  if (state.combo > state.longestCombo) state.longestCombo = state.combo;
  state.comboBonus += 10 * (state.combo - 1); // 第 2 连起每连 +10 递增
  state.selected = null;
  if (state.eliminated >= state.totalPieces) state.status = "won";
  return { a, b, combo: state.combo };
}

export function findHint(state) {
  const { rows, cols, grid } = state;
  for (let r1 = 0; r1 < rows; r1++) {
    for (let c1 = 0; c1 < cols; c1++) {
      const v = grid[r1][c1];
      if (v === null) continue;
      for (let r2 = r1; r2 < rows; r2++) {
        for (let c2 = r2 === r1 ? c1 + 1 : 0; c2 < cols; c2++) {
          if (grid[r2][c2] !== v) continue;
          if (findPathGrid(grid, rows, cols, state.variant, { r: r1, c: c1 }, { r: r2, c: c2 })) {
            return { a: { r: r1, c: c1 }, b: { r: r2, c: c2 } };
          }
        }
      }
    }
  }
  return null;
}

export function hasMove(state) {
  return findHint(state) !== null;
}

export function handleHint(state) {
  if (state.status !== "playing") return { action: null };
  const pair = findHint(state);
  if (!pair) return { action: "noHint" };
  state.hintPair = pair;
  return { action: "hint", a: pair.a, b: pair.b };
}

export function handleShuffle(state, rng) {
  if (state.status !== "playing") return { action: null };
  const cfg = {
    rows: state.rows,
    cols: state.cols,
    variant: state.variant,
    minDist: state.minDist,
  };
  // 只洗牌当前尚未消除的牌。重新铺满完整牌组会把已消除的牌复活，
  // 进而让 eliminated / totalPieces 与棋盘实际内容失去一致性。
  const multiset = remainingMultiset(state);
  state.grid = generateShuffleBoard(cfg, multiset, rng);
  state.selected = null;
  state.hintPair = null;
  state.combo = 0; // 洗牌打断连击
  state.shuffleCount = (state.shuffleCount || 0) + 1;
  return { action: "shuffle", remaining: multiset.length, shuffleCount: state.shuffleCount };
}

export function finishEnded(state) {
  if (state.status === "playing") state.status = "ended";
}
