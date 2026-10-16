// 泡泡射手 · 规则引擎（唯一权威 / 纯函数 / 严格 DOM-free）
// 坐标系：逻辑像素舞台（360 × 640），六边形错位网格（8 列 / 7 列交替）。

export const R = 21;                       // 泡泡半径
export const D = R * 2;                    // 直径
export const COLS = 8;                     // 偶数行格数
export const WALL_L = 12;                  // 左内壁
export const WALL_R = WALL_L + COLS * D;   // 右内壁 = 348
export const STAGE_W = 360;
export const STAGE_H = 640;
export const TOP_Y = 12;                   // 冰盖下沿（第 0 行顶边）
export const DEATH_Y = 544;                // 冰封线
export const CANNON_X = (WALL_L + WALL_R) / 2;
export const CANNON_Y = 600;
export const ROW_H = R * Math.sqrt(3);     // 行高 ≈ 36.37
export const DEATH_ROW = 14;               // 占据该行即触线判负
export const MAX_ANGLE = 1.31;              // 炮台左右各约 75°
export const MAX_BOUNCES = 24;
export const MAX_ROWS = 24;
export const PAD_ROWS = 18;                // 棋盘下方预留空行，保证落点始终可吸附
export const EMPTY = -1;
export const CRYSTAL = 9;                  // 目标冰晶：不可消除，只能靠断柱坠落
export const PRISM = 8;                    // 棱镜泡：万能色
export const STEP = 2;                     // 飞行子步长（固定步长，防穿模）
export const MAX_FLIGHT = 9000;            // 飞行像素上限（兜底防死循环）

export const MODE = {
  STAGE: "stage",
  PUZZLE: "puzzle",
  ENDLESS: "endless",
  DAILY: "daily"
};

export const AIM = {
  CLASSIC: "classic",
  EXTENDED: "extended",
  PRO: "pro"
};

// ---------- 确定性 PRNG ----------
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

// ---------- 网格几何 ----------
export function rowWidth(parity) {
  return parity === 1 ? COLS - 1 : COLS;
}

export function cellX(parity, col) {
  return WALL_L + R + col * D + (parity ? R : 0);
}

export function cellY(row) {
  return TOP_Y + R + row * ROW_H;
}

export function rowAt(y) {
  return Math.round((y - TOP_Y - R) / ROW_H);
}

// ---------- 棋盘构造 ----------
export function createBoard(rowCount = 6, parity = 0) {
  const rows = [];
  for (let r = 0; r < rowCount; r += 1) {
    const p = (parity + r) % 2;
    rows.push({ parity: p, cells: new Array(rowWidth(p)).fill(EMPTY) });
  }
  return padRows(rows);
}

// 补齐下方空行（奇偶交替），保证任何落点都有可吸附格
export function padRows(board, min = PAD_ROWS) {
  const out = board;
  while (out.length < min) {
    const p = out.length ? (out[out.length - 1].parity === 0 ? 1 : 0) : 0;
    out.push({ parity: p, cells: new Array(rowWidth(p)).fill(EMPTY) });
  }
  return out;
}

export function cloneBoard(board) {
  return board.map((row) => ({ parity: row.parity, cells: row.cells.slice() }));
}

export function countBubbles(board) {
  let n = 0;
  for (const row of board) {
    for (const v of row.cells) if (v !== EMPTY) n += 1;
  }
  return n;
}

export function isOccupied(board, row, col) {
  const r = board[row];
  if (!r) return false;
  if (col < 0 || col >= r.cells.length) return false;
  return r.cells[col] !== EMPTY;
}

export function getCell(board, row, col) {
  const r = board[row];
  if (!r || col < 0 || col >= r.cells.length) return EMPTY;
  return r.cells[col];
}

export function setCell(board, row, col, value) {
  const r = board[row];
  if (!r || col < 0 || col >= r.cells.length) return false;
  r.cells[col] = value;
  return true;
}

export function topOccupiedRow(board) {
  for (let r = 0; r < board.length; r += 1) {
    if (board[r].cells.some((v) => v !== EMPTY)) return r;
  }
  return -1;
}

export function lowestOccupiedRow(board) {
  for (let r = board.length - 1; r >= 0; r -= 1) {
    if (board[r].cells.some((v) => v !== EMPTY)) return r;
  }
  return -1;
}

// 六邻域（按相邻行各自 parity 推导，保证几何一致）
export function neighbors(board, row, col) {
  const cur = board[row];
  if (!cur) return [];
  const out = [];
  const push = (r, c) => {
    const target = board[r];
    if (!target) return;
    if (c < 0 || c >= target.cells.length) return;
    out.push([r, c]);
  };
  push(row, col - 1);
  push(row, col + 1);
  const up = board[row - 1];
  const down = board[row + 1];
  if (up) {
    const shift = cur.parity === up.parity ? 0 : cur.parity === 0 ? -1 : 0;
    // 本行未偏移(p=0) / 上行偏移(1)：左上 = c-1，右上 = c
    // 本行偏移(p=1) / 上行未偏移(0)：左上 = c，右上 = c+1
    if (cur.parity === 0 && up.parity === 1) {
      push(row - 1, col - 1);
      push(row - 1, col);
    } else if (cur.parity === 1 && up.parity === 0) {
      push(row - 1, col);
      push(row - 1, col + 1);
    } else {
      push(row - 1, col - 1);
      push(row - 1, col + 1);
    }
    void shift;
  }
  if (down) {
    if (cur.parity === 0 && down.parity === 1) {
      push(row + 1, col - 1);
      push(row + 1, col);
    } else if (cur.parity === 1 && down.parity === 0) {
      push(row + 1, col);
      push(row + 1, col + 1);
    } else {
      push(row + 1, col - 1);
      push(row + 1, col + 1);
    }
  }
  return out;
}

// ---------- 颜色池（绝不发死牌） ----------
export function activeColors(board, palette) {
  const present = new Set();
  for (const row of board) {
    for (const v of row.cells) {
      if (v !== EMPTY && v !== CRYSTAL && v !== PRISM) present.add(v);
    }
  }
  const out = palette.filter((c) => present.has(c) || present.size === 0);
  return present.size === 0 ? palette.slice() : out;
}

export function nextColor(board, palette, rng) {
  const pool = activeColors(board, palette);
  return pool.length ? pick(rng, pool) : pick(rng, palette);
}

// ---------- 消除与坠落 ----------
export function matchGroup(board, row, col) {
  const start = getCell(board, row, col);
  if (start === EMPTY || start === CRYSTAL) return [];
  const seen = new Set([`${row},${col}`]);
  const stack = [[row, col]];
  const group = [];
  while (stack.length) {
    const [r, c] = stack.pop();
    group.push([r, c]);
    for (const [nr, nc] of neighbors(board, r, c)) {
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      const v = getCell(board, nr, nc);
      const same = v === start || (start === PRISM && v !== EMPTY && v !== CRYSTAL) || (v === PRISM && start !== CRYSTAL);
      if (!same) continue;
      seen.add(key);
      stack.push([nr, nc]);
    }
  }
  return group;
}

export function floatingCells(board) {
  const top = topOccupiedRow(board);
  if (top < 0) return [];
  const seen = new Set();
  const stack = [];
  for (let c = 0; c < board[top].cells.length; c += 1) {
    if (board[top].cells[c] !== EMPTY) {
      seen.add(`${top},${c}`);
      stack.push([top, c]);
    }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [nr, nc] of neighbors(board, r, c)) {
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      if (getCell(board, nr, nc) === EMPTY) continue;
      seen.add(key);
      stack.push([nr, nc]);
    }
  }
  const loose = [];
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].cells.length; c += 1) {
      if (board[r].cells[c] !== EMPTY && !seen.has(`${r},${c}`)) loose.push([r, c]);
    }
  }
  return loose;
}

// 落地结算：返回新棋盘与被消除 / 被震落的格子
export function resolveLanding(board, row, col, color) {
  const next = cloneBoard(board);
  setCell(next, row, col, color);
  const popped = [];
  const group = matchGroup(next, row, col);
  const isWild = color === PRISM;
  const realGroup = isWild ? group : group;
  if (realGroup.length >= 3) {
    for (const [r, c] of realGroup) {
      next[r].cells[c] = EMPTY;
      popped.push([r, c]);
    }
  }
  const dropped = floatingCells(next);
  for (const [r, c] of dropped) next[r].cells[c] = EMPTY;
  return { board: next, popped, dropped };
}

// ---------- 反弹飞行模拟（固定子步长，确定性可重放） ----------
export function shotVector(angle) {
  return { vx: Math.sin(angle), vy: -Math.cos(angle) };
}

function hitTest(board, x, y) {
  const r0 = rowAt(y);
  for (let r = r0 - 1; r <= r0 + 1; r += 1) {
    const row = board[r];
    if (!row) continue;
    for (let c = 0; c < row.cells.length; c += 1) {
      if (row.cells[c] === EMPTY) continue;
      const dx = x - cellX(row.parity, c);
      const dy = y - cellY(r);
      if (dx * dx + dy * dy <= D * D) return [r, c];
    }
  }
  return null;
}

// 选择落点：命中格的空邻居（或顶行空格）中离碰撞点最近者
export function attachCell(board, x, y, hit) {
  const candidates = [];
  if (hit) {
    for (const [r, c] of neighbors(board, hit[0], hit[1])) {
      if (getCell(board, r, c) === EMPTY) candidates.push([r, c]);
    }
  } else {
    const row = board[0];
    if (row) {
      for (let c = 0; c < row.cells.length; c += 1) {
        if (row.cells[c] === EMPTY) candidates.push([0, c]);
      }
    }
  }
  if (!candidates.length) {
    for (let r = 0; r < board.length; r += 1) {
      for (let c = 0; c < board[r].cells.length; c += 1) {
        if (board[r].cells[c] !== EMPTY) continue;
        const near = neighbors(board, r, c).some(([nr, nc]) => getCell(board, nr, nc) !== EMPTY);
        if (near || r === 0) candidates.push([r, c]);
      }
    }
  }
  let best = null;
  let bestDist = Infinity;
  for (const [r, c] of candidates) {
    const dx = x - cellX(board[r].parity, c);
    const dy = y - cellY(r);
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = [r, c];
    }
  }
  return best;
}

export function simulateShot(board, angle, opts = {}) {
  const step = opts.step ?? STEP;
  const startX = opts.x ?? CANNON_X;
  const startY = opts.y ?? CANNON_Y;
  const base = shotVector(angle);
  let vx = base.vx;
  const vy = base.vy;
  let x = startX;
  let y = startY;
  let bounces = 0;
  let travelled = 0;
  const points = [{ x, y }];
  while (travelled < MAX_FLIGHT) {
    x += vx * step;
    y += vy * step;
    travelled += step;
    // 左右内壁镜面反弹（速度分量取反，位置镜像折返）
    if (x < WALL_L + R) {
      x = WALL_L + R + (WALL_L + R - x);
      vx = -vx;
      bounces += 1;
      points.push({ x, y });
      if (bounces > MAX_BOUNCES) return { points, bounces, land: null, reason: "bounce_limit" };
    } else if (x > WALL_R - R) {
      x = WALL_R - R - (x - (WALL_R - R));
      vx = -vx;
      bounces += 1;
      points.push({ x, y });
      if (bounces > MAX_BOUNCES) return { points, bounces, land: null, reason: "bounce_limit" };
    }
    if (y - R <= TOP_Y) {
      const land = attachCell(board, x, TOP_Y + R, null);
      points.push({ x: land ? cellX(board[land[0]].parity, land[1]) : x, y: TOP_Y + R });
      return { points, bounces, land, reason: "ceiling" };
    }
    const hit = hitTest(board, x, y);
    if (hit) {
      const land = attachCell(board, x, y, hit);
      points.push({ x: land ? cellX(board[land[0]].parity, land[1]) : x, y: land ? cellY(land[0]) : y });
      return { points, bounces, land, reason: "bubble" };
    }
    if (y > STAGE_H + R) return { points, bounces, land: null, reason: "out" };
  }
  return { points, bounces, land: null, reason: "distance" };
}

// 预测轨迹（供瞄准线使用，含反弹与落点）
export function predictPath(board, angle, tier = AIM.EXTENDED) {
  const full = simulateShot(board, angle);
  if (tier === AIM.CLASSIC) {
    const pts = [];
    const limit = Math.min(full.points[0] ? 999 : 0, 0);
    void limit;
    let acc = 0;
    let last = full.points[0];
    pts.push(last);
    for (let i = 1; i < full.points.length; i += 1) {
      const p = full.points[i];
      acc += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
      if (acc >= 150) break;
      pts.push(p);
    }
    // 经典档：只画一段等距虚线
    const a = full.points[0];
    const dir = shotVector(angle);
    const out = [];
    for (let d = 24; d <= 150; d += 26) out.push({ x: a.x + dir.vx * d, y: a.y + dir.vy * d });
    return { dots: out, land: null, bounces: 0, full: pts };
  }
  if (tier === AIM.PRO) {
    const dir = shotVector(angle);
    return { dots: [{ x: full.points[0].x + dir.vx * 46, y: full.points[0].y + dir.vy * 46 }], land: null, bounces: 0, full: [] };
  }
  const dots = [];
  let acc = 0;
  let last = full.points[0];
  for (let i = 1; i < full.points.length; i += 1) {
    const p = full.points[i];
    const seg = Math.hypot(p.x - last.x, p.y - last.y);
    const dirX = (p.x - last.x) / (seg || 1);
    const dirY = (p.y - last.y) / (seg || 1);
    let walked = 0;
    while (walked + 18 <= seg) {
      acc += 18;
      walked += 18;
      dots.push({ x: last.x + dirX * walked, y: last.y + dirY * walked });
    }
    last = p;
  }
  return { dots, land: full.land, bounces: full.bounces, full: full.points };
}

// ---------- 冰压下压 ----------
export function pressRow(board, cells) {
  const topParity = board.length ? board[0].parity : 0;
  const parity = topParity === 0 ? 1 : 0;
  const width = rowWidth(parity);
  const row = { parity, cells: new Array(width).fill(EMPTY) };
  if (cells) {
    for (let c = 0; c < Math.min(width, cells.length); c += 1) row.cells[c] = cells[c];
  }
  const next = padRows([row, ...cloneBoard(board)]);
  while (next.length > MAX_ROWS) next.pop();
  return next;
}

export function makeRow(parity, palette, rng, density = 1) {
  const width = rowWidth(parity);
  const cells = new Array(width).fill(EMPTY);
  for (let c = 0; c < width; c += 1) {
    cells[c] = rng() <= density ? pick(rng, palette) : EMPTY;
  }
  return cells;
}

// 下压间隔：场上每消失一种颜色，间隔减 1（下限 4）
export function pressInterval(paletteSize, activeCount) {
  const gone = Math.max(0, paletteSize - activeCount);
  return Math.max(4, 8 - gone);
}

export function isDead(board) {
  return lowestOccupiedRow(board) >= DEATH_ROW;
}

// ---------- 盘面生成（形状模板 + 种子化配色） ----------
// mask: 行字符串数组，'#' 占位 / '.' 空 / 'C' 冰晶
export function boardFromMask(mask, palette, rng, startParity = 0) {
  const rows = [];
  for (let r = 0; r < mask.length; r += 1) {
    const parity = (startParity + r) % 2;
    const width = rowWidth(parity);
    const line = mask[r] ?? "";
    const cells = new Array(width).fill(EMPTY);
    for (let c = 0; c < width && c < line.length; c += 1) {
      const ch = line[c];
      if (ch === "#") cells[c] = pick(rng, palette);
      else if (ch === "C") cells[c] = CRYSTAL;
      else if (ch >= "0" && ch <= "5") cells[c] = Number(ch);
      else cells[c] = EMPTY;
    }
    rows.push({ parity, cells });
  }
  return padRows(rows);
}

// 冰镐弹：沿弹道穿透凿碎至多 3 颗（不计分，仅开辟通道）
export function applyIcePick(board, angle) {
  const base = shotVector(angle);
  let vx = base.vx;
  const vy = base.vy;
  let x = CANNON_X;
  let y = CANNON_Y;
  let bounces = 0;
  const hit = [];
  const seen = new Set();
  const reach = D * 0.92;
  for (let travelled = 0; travelled < MAX_FLIGHT; travelled += STEP) {
    x += vx * STEP;
    y += vy * STEP;
    if (x < WALL_L + R) {
      x = WALL_L + R + (WALL_L + R - x);
      vx = -vx;
      bounces += 1;
    } else if (x > WALL_R - R) {
      x = WALL_R - R - (x - (WALL_R - R));
      vx = -vx;
      bounces += 1;
    }
    if (bounces > MAX_BOUNCES || y - R <= TOP_Y) break;
    const r0 = rowAt(y);
    for (let r = r0 - 1; r <= r0 + 1; r += 1) {
      const row = board[r];
      if (!row) continue;
      for (let c = 0; c < row.cells.length; c += 1) {
        if (row.cells[c] === EMPTY) continue;
        const dx = x - cellX(row.parity, c);
        const dy = y - cellY(r);
        if (dx * dx + dy * dy <= reach * reach) {
          const key = `${r},${c}`;
          if (!seen.has(key)) {
            seen.add(key);
            hit.push([r, c]);
          }
        }
      }
    }
    if (hit.length >= 3) break;
  }
  const next = cloneBoard(board);
  for (const [r, c] of hit) setCell(next, r, c, EMPTY);
  const dropped = floatingCells(next);
  for (const [r, c] of dropped) setCell(next, r, c, EMPTY);
  return { board: next, cleared: hit, dropped };
}

// 生成盘面后剪去悬空泡（保证初始盘面必然连通顶部）
export function pruneFloating(board) {
  const next = cloneBoard(board);
  const loose = floatingCells(next);
  for (const [r, c] of loose) next[r].cells[c] = EMPTY;
  return next;
}

export function boardKey(board) {
  return board.map((row) => row.cells.join(",")).join("|");
}

export function boardToMask(board) {
  return board.map((row) =>
    row.cells
      .map((v) => (v === EMPTY ? "." : v === CRYSTAL ? "C" : "#"))
      .join("")
  );
}

// ---------- 启发式求解器（无死局校验用：定向枚举 + 定向搜索） ----------
export function evaluateShot(board, angle, palette) {
  const shot = simulateShot(board, angle);
  if (!shot.land) return null;
  const [row, col] = shot.land;
  if (row >= DEATH_ROW) return null;
  const before = countBubbles(board);
  const { board: after, popped, dropped } = resolveLanding(board, row, col, PRISM);
  const gain = popped.length + dropped.length * 2;
  return { angle, row, col, after, gain, before, popped, dropped };
}

// 用 PRISM 试射等价于“颜色最有利”的上界评估；再按真实颜色复核一次
export function bestShotFor(board, palette, rng, samples = 120) {
  let best = null;
  const pool = activeColors(board, palette);
  const color = pool.length ? pick(rng, pool) : palette[0];
  for (let i = 0; i < samples; i += 1) {
    const angle = -MAX_ANGLE + (2 * MAX_ANGLE * i) / (samples - 1);
    const shot = simulateShot(board, angle);
    if (!shot.land) continue;
    const [row, col] = shot.land;
    const { popped, dropped } = resolveLanding(board, row, col, color);
    const gain = popped.length + dropped.length * 2;
    const height = lowestOccupiedRow(board);
    const score = gain * 10 - height * 2;
    if (!best || score > best.score) best = { angle, row, col, gain, dropped: dropped.length, score };
  }
  return best;
}

// 定向搜索：在给定发数预算内能否达成目标（清盘 / 冰晶坠落）
export function solve(board, opts = {}) {
  const budget = opts.budget ?? 20;
  const palette = opts.palette ?? [0, 1, 2, 3, 4, 5];
  const goal = opts.goal ?? "clear";           // clear | crystal
  const samples = opts.samples ?? 96;
  const beam = opts.beam ?? 4;
  const colorSamples = opts.colorSamples ?? 6;
  let frontier = [{ board: cloneBoard(board), shots: 0, popped: 0, dropped: 0, crystals: 0, path: [] }];
  for (let step = 0; step < budget; step += 1) {
    const next = [];
    for (const node of frontier) {
      if (isSolved(node.board, goal)) return { ok: true, shots: node.shots, node };
      const pool = activeColors(node.board, palette);
      const colors = pool.slice(0, Math.max(1, colorSamples));
      const tries = [];
      for (const color of colors) {
        for (let i = 0; i < samples; i += 1) {
          const angle = -MAX_ANGLE + (2 * MAX_ANGLE * i) / (samples - 1);
          const shot = simulateShot(node.board, angle);
          if (!shot.land) continue;
          const [row, col] = shot.land;
          if (row >= DEATH_ROW) continue;
          const res = resolveLanding(node.board, row, col, color);
          const crystals = countCrystal(res.dropped, node.board);
          const gain = res.popped.length + res.dropped.length;
          const height = lowestOccupiedRow(res.board) + 1;
          const left = countBubbles(res.board);
          // 未消除时奖励“同色靠拢”，保证终局能靠铺垫凑三连
          const setup = res.popped.length ? 0 : matchGroup(res.board, row, col).length * 3;
          const score = crystals * 100 + gain * 12 + setup - left * 4 - height * 2;
          tries.push({ score, board: res.board, popped: res.popped.length, dropped: res.dropped.length, crystals, setup, angle, color });
        }
      }
      if (!tries.length) continue;
      tries.sort((a, b) => b.score - a.score);
      const used = new Set();
      for (const t of tries) {
        const key = boardKey(t.board);
        if (used.has(key)) continue;
        used.add(key);
        next.push({
          board: t.board,
          shots: node.shots + 1,
          popped: node.popped + t.popped,
          dropped: node.dropped + t.dropped,
          crystals: node.crystals + t.crystals,
          setup: (node.setup ?? 0) + t.setup,
          path: [...node.path, { angle: t.angle, color: t.color }]
        });
        if (used.size >= beam) break;
      }
    }
    if (!next.length) break;
    const rank = (n) => n.crystals * 100 + n.popped + n.dropped * 2 + (n.setup ?? 0) * 0.4 - countBubbles(n.board) * 0.05;
    next.sort((a, b) => rank(b) - rank(a));
    const dedup = new Set();
    const picked = [];
    for (const n of next) {
      const key = boardKey(n.board);
      if (dedup.has(key)) continue;
      dedup.add(key);
      picked.push(n);
      if (picked.length >= beam) break;
    }
    frontier = picked;
  }
  const bestNode = frontier[0];
  return { ok: !!bestNode && isSolved(bestNode.board, goal), shots: bestNode ? bestNode.shots : budget, node: bestNode };
}

// 按给定发弹颜色序列定向搜索（残局题板可解性校验：100% 非运气）
export function solveWithLoad(board, load, opts = {}) {
  const samples = opts.samples ?? 120;
  const beam = opts.beam ?? 6;
  const goal = opts.goal ?? "crystal";
  let frontier = [{ board: cloneBoard(board), crystals: 0, cleared: 0, path: [] }];
  for (let i = 0; i < load.length; i += 1) {
    const color = load[i];
    const next = [];
    for (const node of frontier) {
      for (let s = 0; s < samples; s += 1) {
        const angle = -MAX_ANGLE + (2 * MAX_ANGLE * s) / (samples - 1);
        const shot = simulateShot(node.board, angle);
        if (!shot.land) continue;
        const [r, c] = shot.land;
        if (r >= DEATH_ROW) continue;
        const res = resolveLanding(node.board, r, c, color);
        const crystals = node.crystals + countCrystal(res.dropped, node.board);
        next.push({
          board: res.board,
          crystals,
          cleared: node.cleared + res.popped.length + res.dropped.length,
          path: [...node.path, { angle, color }],
          score: crystals * 100 + res.popped.length + res.dropped.length * 2 - (lowestOccupiedRow(res.board) + 1)
        });
      }
    }
    if (!next.length) break;
    next.sort((a, b) => b.score - a.score);
    frontier = next.slice(0, beam);
    const win = frontier.find((n) => isSolved(n.board, goal));
    if (win) return { ok: true, path: win.path, node: win, shots: i + 1 };
  }
  return { ok: false, shots: load.length, node: frontier[0] ?? null };
}

function countCrystal(dropped, board) {
  let n = 0;
  for (const [r, c] of dropped) if (getCell(board, r, c) === CRYSTAL) n += 1;
  return n;
}

export function isSolved(board, goal = "clear") {
  if (goal === "crystal") {
    for (const row of board) if (row.cells.includes(CRYSTAL)) return false;
    return true;
  }
  return countBubbles(board) === 0;
}

// ---------- 随机游走（测试用：断言不变式守恒） ----------
export function randomWalk(board, steps, seed, palette) {
  const rng = mulberry32(seed);
  let cur = cloneBoard(board);
  let moves = 0;
  let color = pick(rng, palette);
  for (let i = 0; i < steps; i += 1) {
    if (isSolved(cur) || isDead(cur)) {
      cur = cloneBoard(board);
      color = pick(rng, palette);
    }
    const angle = -MAX_ANGLE + rng() * 2 * MAX_ANGLE;
    const shot = simulateShot(cur, angle);
    if (!shot.land) continue;
    const res = resolveLanding(cur, shot.land[0], shot.land[1], color);
    cur = res.board;
    moves += 1;
    const pool = activeColors(cur, palette);
    color = pool.length ? pick(rng, pool) : pick(rng, palette);
    if (i % 8 === 7) cur = pressRow(cur, makeRow(cur[0].parity === 0 ? 1 : 0, palette, rng, 0.85));
  }
  return { board: cur, moves };
}
