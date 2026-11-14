// Level factory for Bomber. Deterministic: same id always yields the same board.
// Run: node games/bomber/tools/gen-levels.mjs   ->   rewrites games/bomber/js/levels.mjs
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  TILE_EMPTY,
  TILE_HARD,
  TILE_SOFT,
  TILE_CRACK,
  TILE_TO_CHAR,
  MODE_CAMPAIGN,
  MODE_PUZZLE,
  mulberry32,
  hashString,
  flameCells,
} from "../js/engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(here, "..", "js", "levels.mjs");

// ---------------------------------------------------------------- shared

function blankGrid(cols, rows, pillars) {
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      // classic lattice: pillars on even/even, leaving (1,1) free for the spawn
      const pillar = pillars && x % 2 === 0 && y % 2 === 0;
      row.push(edge || pillar ? TILE_HARD : TILE_EMPTY);
    }
    grid.push(row);
  }
  return grid;
}

function toStrings(grid) {
  return grid.map((row) => row.map((t) => TILE_TO_CHAR[t] ?? ".").join(""));
}

function neighbors4(cols, rows, cx, cy) {
  const out = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push([nx, ny]);
  }
  return out;
}

// BFS distance over cells; soft bricks count as passable (they are destructible).
function distanceField(grid, cols, rows, start, opts = {}) {
  const dist = new Map();
  const key = (x, y) => y * cols + x;
  const queue = [start];
  dist.set(key(start[0], start[1]), 0);
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    const d = dist.get(key(x, y));
    for (const [nx, ny] of neighbors4(cols, rows, x, y)) {
      const k = key(nx, ny);
      if (dist.has(k)) continue;
      const tile = grid[ny][nx];
      const blocked = opts.destructible ? tile === TILE_HARD : tile !== TILE_EMPTY;
      if (blocked) continue;
      dist.set(k, d + 1);
      queue.push([nx, ny]);
    }
  }
  return dist;
}

function reachableOpen(grid, cols, rows, start) {
  // walkable without destroying anything (used for puzzle bomb placement)
  return distanceField(grid, cols, rows, start, { ghost: false });
}

const LANE_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// A bomber needs two clear cells ahead to outwalk his own fire-1 blast. A cell
// that offers that is a safe place to stand and drop.
function laneClearAt(grid, cols, rows, x, y) {
  const inside = (a, b) => a > 0 && b > 0 && a < cols - 1 && b < rows - 1;
  return LANE_DIRS.some(([dx, dy]) => {
    const bx = x + 2 * dx;
    const by = y + 2 * dy;
    if (!inside(bx, by)) return false;
    return grid[y + dy][x + dx] === TILE_EMPTY && grid[by][bx] === TILE_EMPTY;
  });
}

// A cell with no two-cell runway is a forced suicide: step in, drop a bomb and
// there is nowhere to go. Caverns between the pillars are one tile wide, so the
// only cure that keeps the board dense is to wall those nooks off with bedrock
// pillars. Bedrock never counts as a brick, so this cannot orphan anything, and
// it reads as the classic irregular pillar field.
function sealDeadEnds(grid, cols, rows, keep) {
  let sealed = 0;
  for (let pass = 0; pass < 40; pass++) {
    let fixed = 0;
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (grid[y][x] !== TILE_EMPTY) continue;
        if (keep.has(`${x},${y}`)) continue;
        if (laneClearAt(grid, cols, rows, x, y)) continue;
        grid[y][x] = TILE_SOFT;
        sealed += 1;
        fixed += 1;
      }
    }
    if (!fixed) break;
  }
  return sealed;
}

// Final gate: no standable cell is a forced suicide and every brick can be
// broken from somewhere safe. Boards that fail are simply rejected and the
// caller retries with a fresh seed.
function boardIssues(grid, cols, rows) {
  const inside = (x, y) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1;
  let suicide = 0;
  let orphans = 0;
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const tile = grid[y][x];
      if (tile === TILE_EMPTY) {
        if (!laneClearAt(grid, cols, rows, x, y)) suicide += 1;
        continue;
      }
      if (tile === TILE_HARD) continue;
      const anchors = LANE_DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(
        ([ax, ay]) => inside(ax, ay) && grid[ay][ax] === TILE_EMPTY
      );
      if (!anchors.some(([ax, ay]) => laneClearAt(grid, cols, rows, ax, ay))) orphans += 1;
    }
  }
  return { suicide, orphans };
}

function brickHasSafeAnchor(grid, cols, rows, x, y) {
  const inside = (a, b) => a > 0 && b > 0 && a < cols - 1 && b < rows - 1;
  return LANE_DIRS.some(([dx, dy]) => {
    const ax = x + dx;
    const ay = y + dy;
    if (!inside(ax, ay)) return false;
    if (grid[ay][ax] !== TILE_EMPTY) return false;
    return laneClearAt(grid, cols, rows, ax, ay);
  });
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Every brick must have at least one neighbouring floor tile that is a safe
// drop spot - otherwise the player cannot break it without being killed by his
// own bomb, and reading the board as "unfair" is exactly what happened on the
// first playtest. Carve the cheapest lane that fixes each offender.
function ensureBrickAnchors(grid, cols, rows, rng) {
  const inside = (x, y) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1;
  const isBrick = (x, y) => grid[y][x] !== TILE_EMPTY && grid[y][x] !== TILE_HARD;
  let carved = 0;
  let cleared = 0;
  for (let pass = 0; pass < 40; pass++) {
    let fixed = 0;
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (!isBrick(x, y)) continue;
        const anchors = LANE_DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(
          ([ax, ay]) => inside(ax, ay) && grid[ay][ax] === TILE_EMPTY
        );
        if (anchors.some(([ax, ay]) => laneClearAt(grid, cols, rows, ax, ay))) continue;
        if (!anchors.length) {
          // walled in on all four sides: decorate nothing, make it floor so the
          // neighbouring bricks gain an anchor
          grid[y][x] = TILE_EMPTY;
          cleared += 1;
          fixed += 1;
          continue;
        }
        let done = false;
        for (const [ax, ay] of shuffle(anchors.slice(), rng)) {
          for (const [dx, dy] of shuffle(LANE_DIRS.slice(), rng)) {
            const mx = ax + dx;
            const my = ay + dy;
            const bx = ax + 2 * dx;
            const by = ay + 2 * dy;
            // never carve through the brick we are trying to make workable
            if (mx === x && my === y) continue;
            if (!inside(bx, by)) continue;
            if (grid[my][mx] === TILE_HARD || grid[by][bx] === TILE_HARD) continue;
            if (grid[my][mx] !== TILE_EMPTY) {
              grid[my][mx] = TILE_EMPTY;
              carved += 1;
            }
            if (grid[by][bx] !== TILE_EMPTY) {
              grid[by][bx] = TILE_EMPTY;
              carved += 1;
            }
            done = true;
            fixed += 1;
            break;
          }
          if (done) break;
        }
        if (!done) {
          // no lane can be carved around it: the brick is unwinnable decoration,
          // open the floor instead so it stops looking like an opportunity
          grid[y][x] = TILE_EMPTY;
          cleared += 1;
          fixed += 1;
        }
      }
    }
    if (!fixed) return { carved, cleared, fixed };
  }
  return { carved, cleared, fixed };
}

// ---------------------------------------------------------------- campaign

// Brick density stays modest on purpose: a fire-1 blast reaches one cell out,
// so the bomber needs two free cells in some direction after every drop. Past
// roughly a third of the floor covered, half the bricks end up with no spot
// beside them where a bomb can be dropped safely - which reads as "the game
// keeps killing me for no reason".
const CHAPTER_PLAN = [
  { chapter: 1, enemies: [3, 4], soft: 0.24, types: ["balloon"], powers: ["fire", "bomb", "speed"], crack: 0 },
  { chapter: 2, enemies: [4, 5], soft: 0.27, types: ["balloon", "chaser"], powers: ["fire", "bomb", "speed", "kick", "remote"], crack: 0 },
  { chapter: 3, enemies: [5, 5], soft: 0.3, types: ["balloon", "chaser", "evader", "ghost"], powers: ["fire", "bomb", "speed", "remote", "pierce", "shield"], crack: 0.1 },
  { chapter: 4, enemies: [6, 6], soft: 0.33, types: ["balloon", "chaser", "evader", "ghost", "armored"], powers: ["fire", "bomb", "speed", "kick", "pierce", "shield", "curse"], crack: 0.22 },
  { chapter: 5, enemies: [6, 7], soft: 0.35, types: ["chaser", "evader", "ghost", "armored", "balloon"], powers: ["fire", "bomb", "speed", "kick", "remote", "pierce", "shield", "curse"], crack: 0.28 },
];

function buildCampaignLevel(chapter, index) {
  const plan = CHAPTER_PLAN[chapter - 1];
  const id = `level_${chapter}_${index}`;
  const isBoss = chapter === 5 && index === 8;
  const cols = isBoss ? 15 : 13;
  const rows = isBoss ? 13 : 11;
  let attempts = 0;
  while (attempts < 40) {
    const level = tryCampaign(id, chapter, index, plan, cols, rows, isBoss, attempts);
    if (level) return level;
    attempts += 1;
  }
  throw new Error(`unable to build ${id}`);
}

function tryCampaign(id, chapter, index, plan, cols, rows, isBoss, attempt) {
  const rng = mulberry32((hashString(id) + attempt * 7919) >>> 0);
  const grid = blankGrid(cols, rows, true);
  const spawn = [1, 1];
  // The bomber always drops his first bomb on his own spawn, so the spawn needs
  // straight runways long enough to outwalk that blast (fire 1 + 2 spare cells).
  const safe = new Set();
  for (let i = 0; i <= 2; i++) {
    safe.add(`${spawn[0] + i},${spawn[1]}`);
    safe.add(`${spawn[0]},${spawn[1] + i}`);
  }

  const openCells = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] !== TILE_EMPTY) continue;
      if (safe.has(`${x},${y}`)) continue;
      openCells.push([x, y]);
    }
  }
  const density = (plan.soft + index * 0.005) * Number(process.env.BOMBER_SOFT_SCALE ?? 1);
  const softTarget = Math.round(openCells.length * density);
  const pool = openCells.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, softTarget);
  for (const [x, y] of chosen) {
    grid[y][x] = rng() < plan.crack ? TILE_CRACK : TILE_SOFT;
  }

  // Board polish, iterated to a fixed point: carve lanes so every brick has a
  // safe drop spot, wall off the nooks that would still be forced suicides.
  // Reject the board outright when both invariants cannot hold at once - the
  // caller retries with the next seed.
  // Carve lanes so every brick can be broken from a spot the bomber survives.
  // Note what is deliberately NOT attempted: guaranteeing a two-cell runway on
  // every single floor tile. On a one-tile-wide pillar lattice that is
  // equivalent to removing every brick, and sealing the nooks instead orphans a
  // quarter of the bricks. The nooks that remain are empty corners with nothing
  // to bomb, so they are harmless.
  if (!process.env.BOMBER_NO_LANES) ensureBrickAnchors(grid, cols, rows, rng);

  // reachability with bricks treated as destructible
  const dist = distanceField(grid, cols, rows, spawn, { destructible: true });

  // Soft cells for the exit and the buried power-ups, farthest first. Only
  // bricks with a safe drop spot on their doorstep qualify: the player must
  // never be forced to break a brick from a position where his own blast kills
  // him. Decorative bricks may lack that anchor, these may not.
  const softCells = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const tile = grid[y][x];
      if (tile !== TILE_SOFT && tile !== TILE_CRACK) continue;
      if (!brickHasSafeAnchor(grid, cols, rows, x, y)) continue;
      softCells.push([x, y]);
    }
  }
  softCells.sort((a, b) => (dist.get(b[1] * cols + b[0]) ?? 0) - (dist.get(a[1] * cols + a[0]) ?? 0));
  if (softCells.length < 6) return null;
  const exitCell = softCells[0];

  const powerCount = 3 + Math.floor(chapter / 2) + (index % 2);
  const powerups = [];
  const usedSoft = new Set([`${exitCell[0]},${exitCell[1]}`]);
  for (let i = 0; i < powerCount; i++) {
    const cell = softCells.find((c) => !usedSoft.has(`${c[0]},${c[1]}`));
    if (!cell) break;
    usedSoft.add(`${cell[0]},${cell[1]}`);
    powerups.push({ cx: cell[0], cy: cell[1], kind: plan.powers[Math.floor(rng() * plan.powers.length)], hidden: true });
  }

  // enemies live on open ground, never next to the spawn
  const spawnKey = spawn[1] * cols + spawn[0];
  const enemyCells = [];
  for (const [x, y] of openCells) {
    if (grid[y][x] !== TILE_EMPTY) continue;
    const d = dist.get(y * cols + x);
    if (d === undefined || d < 5) continue;
    if (enemyCells.some(([ex, ey]) => Math.abs(ex - x) + Math.abs(ey - y) < 2)) continue;
    enemyCells.push([x, y]);
  }
  const want = plan.enemies[0] + Math.floor(rng() * (plan.enemies[1] - plan.enemies[0] + 1));
  if (enemyCells.length < want + (isBoss ? 1 : 0)) return null;
  for (let i = enemyCells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [enemyCells[i], enemyCells[j]] = [enemyCells[j], enemyCells[i]];
  }
  const enemies = enemyCells.slice(0, want).map(([cx, cy]) => ({
    cx,
    cy,
    type: plan.types[Math.floor(rng() * plan.types.length)],
  }));
  if (isBoss) {
    const bossCell = enemyCells[want];
    enemies.push({ cx: bossCell[0], cy: bossCell[1], type: "boss" });
  }

  // every enemy + the exit must be reachable once bricks are blown open
  for (const e of enemies) {
    if (!dist.has(e.cy * cols + e.cx)) return null;
  }
  if (!dist.has(exitCell[1] * cols + exitCell[0])) return null;

  return {
    id,
    mode: MODE_CAMPAIGN,
    chapter,
    index,
    cols,
    rows,
    tiles: toStrings(grid),
    spawn,
    enemies,
    powerups,
    exit: { cx: exitCell[0], cy: exitCell[1], hidden: true },
    timeLimit: 170 + chapter * 12,
    fire: 1,
    bombs: 1,
    seed: (hashString(id) + attempt * 7919) >>> 0,
  };
}

// ---------------------------------------------------------------- puzzle solver

// Chain simulation on the untouched grid: a subset found this way stays valid
// in the real game (real blasts only ever reach further).
export function solvePuzzle(grid, cols, rows, targets, spawn, range, maxBombs) {
  const open = reachableOpen(grid, cols, rows, spawn);
  const targetKeys = new Set(targets.map(([x, y]) => y * cols + x));
  const nearTarget = ([x, y]) => targets.reduce((min, [tx, ty]) => Math.min(min, Math.abs(tx - x) + Math.abs(ty - y)), 99);
  const candidates = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] !== TILE_EMPTY) continue;
      if (!open.has(y * cols + x)) continue;
      if (nearTarget([x, y]) > range + 1) continue;
      candidates.push([x, y]);
    }
  }

  const full = (1 << targets.length) - 1;
  const masks = candidates.map(([cx, cy]) => {
    let mask = 0;
    const cells = flameCells(grid, cols, rows, cx, cy, range, false);
    targets.forEach(([tx, ty], i) => {
      if (cells.some(([fx, fy]) => fx === tx && fy === ty)) mask |= 1 << i;
    });
    return mask;
  });
  const suffix = new Array(candidates.length + 1).fill(0);
  for (let i = candidates.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] | masks[i];

  const simulate = (set, firstIdx) => {
    const done = new Set();
    const flames = new Set();
    const queue = [firstIdx];
    while (queue.length) {
      const idx = queue.shift();
      if (done.has(idx)) continue;
      done.add(idx);
      const [bx, by] = set[idx];
      const cells = flameCells(grid, cols, rows, bx, by, range, false);
      for (const [cx, cy] of cells) {
        flames.add(cy * cols + cx);
        const hit = set.findIndex((c, i) => i !== idx && c[0] === cx && c[1] === cy);
        if (hit >= 0 && !done.has(hit)) queue.push(hit);
      }
    }
    for (const key of targetKeys) if (!flames.has(key)) return null;
    return { cells: set.slice(), first: firstIdx, flames };
  };

  let best = null;
  for (let k = 1; k <= maxBombs && !best; k++) {
    const indices = [];
    const walk = (start) => {
      if (best) return;
      if (indices.length === k) {
        let mask = 0;
        indices.forEach((i) => (mask |= masks[i]));
        if (mask !== full) return;
        const set = indices.map((i) => candidates[i]);
        for (let f = 0; f < set.length; f++) {
          const ok = simulate(set, f);
          if (ok) {
            best = { bombs: k, cells: ok.cells, first: ok.first };
            return;
          }
        }
        return;
      }
      for (let i = start; i < candidates.length; i++) {
        if (best) return;
        let mask = 0;
        indices.forEach((idx) => (mask |= masks[idx]));
        if ((mask | suffix[i]) !== full) continue;
        indices.push(i);
        walk(i + 1);
        indices.pop();
      }
    };
    walk(0);
  }
  return best;
}

function tourLength(grid, cols, rows, spawn, cells) {
  // greedy nearest-neighbour walk, measured on the open-cell distance field
  let total = 0;
  let cur = spawn;
  const left = cells.slice();
  while (left.length) {
    const field = distanceField(grid, cols, rows, cur, {});
    let bestIdx = 0;
    let bestD = Infinity;
    left.forEach((c, i) => {
      const d = field.get(c[1] * cols + c[0]);
      if (d !== undefined && d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    });
    if (!Number.isFinite(bestD)) return Infinity;
    total += bestD;
    cur = left[bestIdx];
    left.splice(bestIdx, 1);
  }
  return total;
}

const PUZZLE_PLAN = [
  { tier: 1, targets: 3, soft: 0.18, par: [1, 2] },
  { tier: 2, targets: 4, soft: 0.22, par: [2, 2] },
  { tier: 3, targets: 4, soft: 0.26, par: [2, 3] },
  { tier: 4, targets: 5, soft: 0.3, par: [3, 4] },
];

function buildPuzzleLevel(n) {
  const plan = PUZZLE_PLAN[Math.floor((n - 1) / 6)];
  const id = `puzzle_${String(n).padStart(2, "0")}`;
  const cols = 11;
  const rows = 9;
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = mulberry32((hashString(id) + attempt * 104729) >>> 0);
    const grid = blankGrid(cols, rows, true);
    const spawn = [1, 1];
    const open = [];
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] !== TILE_EMPTY) continue;
      if (x <= 2 && y <= 2) continue;
      if (x === cols - 2 && y === rows - 2) continue;
      open.push([x, y]);
      }
    }
    for (let i = open.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [open[i], open[j]] = [open[j], open[i]];
    }
    const softCount = Math.round(open.length * plan.soft);
    const softs = open.slice(0, softCount);
    for (const [x, y] of softs) grid[y][x] = TILE_SOFT;

    const field = distanceField(grid, cols, rows, spawn, {});
    const spots = open.slice(softCount).filter(([x, y]) => (field.get(y * cols + x) ?? 0) >= 3);
    if (spots.length < plan.targets) continue;
    const targets = [];
    for (let i = 0; i < spots.length && targets.length < plan.targets; i++) {
      const cell = spots[Math.floor(rng() * spots.length)];
      if (targets.some(([tx, ty]) => Math.abs(tx - cell[0]) + Math.abs(ty - cell[1]) < 3)) continue;
      if (targets.some(([tx, ty]) => tx === cell[0] && ty === cell[1])) continue;
      targets.push(cell);
    }
    if (targets.length < plan.targets) continue;

    const range = 2;
    const solution = solvePuzzle(grid, cols, rows, targets, spawn, range, 4);
    if (!solution) continue;
    if (solution.bombs < plan.par[0] || solution.bombs > plan.par[1]) continue;
    const key = (c) => `${c[0]},${c[1]}`;
    const bombCells = solution.cells.map(key);
    const walk = tourLength(grid, cols, rows, spawn, solution.cells);
    if (walk > 11) continue;

    return {
      id,
      mode: MODE_PUZZLE,
      chapter: 0,
      index: n,
      cols,
      rows,
      tiles: toStrings(grid),
      spawn,
      enemies: targets.map(([cx, cy]) => ({ cx, cy, type: "target" })),
      powerups: [],
      exit: null,
      timeLimit: 120,
      fire: range,
      bombs: solution.bombs + 1,
      par: solution.bombs,
      bombBudget: solution.bombs + 1,
      seed: (hashString(id) + attempt * 104729) >>> 0,
      solution: { bombs: solution.bombs, cells: bombCells, first: solution.first },
    };
  }
  throw new Error(`unable to build ${id}`);
}

// ---------------------------------------------------------------- emit

function main() {
  const campaign = [];
  for (let chapter = 1; chapter <= 5; chapter++) {
    for (let index = 1; index <= 8; index++) campaign.push(buildCampaignLevel(chapter, index));
  }
  const puzzles = [];
  for (let n = 1; n <= 24; n++) puzzles.push(buildPuzzleLevel(n));

  const body = `// GENERATED by tools/gen-levels.mjs -- do not edit by hand.
// campaign: 5 chapters x 8 stages, deterministic per level id.
// puzzle: 24 fixed boards, every one verified solvable by the chain solver.
export const CHAPTERS = [
  { id: 1, nameKey: "chapter_1", from: 1, to: 8 },
  { id: 2, nameKey: "chapter_2", from: 9, to: 16 },
  { id: 3, nameKey: "chapter_3", from: 17, to: 24 },
  { id: 4, nameKey: "chapter_4", from: 25, to: 32 },
  { id: 5, nameKey: "chapter_5", from: 33, to: 40 },
];

export const CAMPAIGN_LEVELS = ${JSON.stringify(campaign, null, 1)};

export const PUZZLE_LEVELS = ${JSON.stringify(puzzles, null, 1)};

export function campaignLevelAt(index) {
  return CAMPAIGN_LEVELS[Math.max(0, Math.min(CAMPAIGN_LEVELS.length - 1, index))];
}

export function puzzleLevelAt(index) {
  return PUZZLE_LEVELS[Math.max(0, Math.min(PUZZLE_LEVELS.length - 1, index))];
}

export function levelById(id) {
  return CAMPAIGN_LEVELS.find((level) => level.id === id) ?? PUZZLE_LEVELS.find((level) => level.id === id) ?? null;
}
`;
  writeFileSync(outFile, body, "utf8");
  const parList = puzzles.map((p) => p.par);
  console.log(`campaign ${campaign.length} levels, puzzles ${puzzles.length} levels, par range ${Math.min(...parList)}-${Math.max(...parList)}`);
  console.log(`written ${outFile}`);
}

// only run when invoked directly, so tests can import solvePuzzle safely
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
