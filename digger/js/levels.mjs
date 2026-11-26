// 20 关地层数据：5 章 × 4 关，确定性程序化布局（固定种子），每关 3 枚化石。
// 关卡坐标全部为数字与英文枚举，展示文本由 i18n 查表。

import { CELL_DIRT, CELL_OPEN, COLS, ROWS } from "./engine.mjs";

export const CHAPTERS = Object.freeze([
  { key: "chapter_ch1", eraKey: "era_ch1", accent: "#d8b483" },
  { key: "chapter_ch2", eraKey: "era_ch2", accent: "#cf7a52" },
  { key: "chapter_ch3", eraKey: "era_ch3", accent: "#8f6042" },
  { key: "chapter_ch4", eraKey: "era_ch4", accent: "#5f7d74" },
  { key: "chapter_ch5", eraKey: "era_ch5", accent: "#7a6aa8" },
]);

const BLUEPRINTS = [
  { pooka: 1, fygar: 0, rocks: 1, tunnels: 2, ghost: 10 },
  { pooka: 2, fygar: 0, rocks: 1, tunnels: 2, ghost: 9 },
  { pooka: 2, fygar: 0, rocks: 2, tunnels: 3, ghost: 8.5 },
  { pooka: 3, fygar: 0, rocks: 2, tunnels: 3, ghost: 8 },
  { pooka: 2, fygar: 1, rocks: 2, tunnels: 3, ghost: 8 },
  { pooka: 2, fygar: 1, rocks: 2, tunnels: 3, ghost: 8 },
  { pooka: 3, fygar: 1, rocks: 3, tunnels: 3, ghost: 8 },
  { pooka: 3, fygar: 2, rocks: 3, tunnels: 4, ghost: 8 },
  { pooka: 3, fygar: 1, rocks: 3, tunnels: 4, ghost: 8 },
  { pooka: 3, fygar: 2, rocks: 4, tunnels: 4, ghost: 7.5 },
  { pooka: 4, fygar: 2, rocks: 4, tunnels: 4, ghost: 7.5 },
  { pooka: 4, fygar: 2, rocks: 5, tunnels: 4, ghost: 7 },
  { pooka: 3, fygar: 2, rocks: 4, tunnels: 4, ghost: 6.5 },
  { pooka: 4, fygar: 2, rocks: 4, tunnels: 4, ghost: 6.5 },
  { pooka: 4, fygar: 3, rocks: 5, tunnels: 5, ghost: 6 },
  { pooka: 4, fygar: 3, rocks: 5, tunnels: 5, ghost: 5.8 },
  { pooka: 4, fygar: 2, rocks: 5, tunnels: 4, ghost: 5.5 },
  { pooka: 4, fygar: 3, rocks: 5, tunnels: 5, ghost: 5.2 },
  { pooka: 5, fygar: 3, rocks: 6, tunnels: 5, ghost: 5 },
  { pooka: 5, fygar: 4, rocks: 6, tunnels: 5, ghost: 4.8 },
];

export const LEVEL_COUNT = BLUEPRINTS.length;

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildLevel(index, bp) {
  const chapter = Math.floor(index / 4) + 1;
  const rng = makeRng(0xd1660000 + index * 7919 + chapter * 131);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(CELL_DIRT));
  const tunnels = [];

  const dig = (col, row) => {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    if (grid[row][col] === CELL_OPEN) return;
    grid[row][col] = CELL_OPEN;
    tunnels.push({ col, row });
  };

  // 玩家出生竖井：地表小平台，保证首屏即可向下开凿。
  for (const [col, row] of [[8, 0], [8, 1], [7, 1], [9, 1]]) dig(col, row);

  for (let tunnel = 0; tunnel < bp.tunnels; tunnel += 1) {
    const row = 2 + Math.floor(rng() * (ROWS - 4));
    const length = 4 + Math.floor(rng() * 5);
    const start = 1 + Math.floor(rng() * (COLS - length - 1));
    for (let offset = 0; offset < length; offset += 1) dig(start + offset, row);
    const branchCol = start + 1 + Math.floor(rng() * Math.max(1, length - 2));
    const branchLength = 2 + Math.floor(rng() * 3);
    for (let step = 1; step <= branchLength; step += 1) dig(branchCol, row + step);
  }

  const openCells = [];
  for (let row = 2; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (grid[row][col] === CELL_OPEN) openCells.push({ col, row });
    }
  }

  const nearSpawn = (cell) => Math.abs(cell.col - 8) + Math.abs(cell.row - 1) < 4;
  const monsterCells = [];
  const pickMonsterCell = () => {
    const free = openCells.filter((cell) => {
      if (nearSpawn(cell)) return false;
      return !monsterCells.some((other) => Math.abs(other.col - cell.col) + Math.abs(other.row - cell.row) < 2);
    });
    if (!free.length) {
      const fallback = openCells.filter((cell) => !monsterCells.some((other) => other.col === cell.col && other.row === cell.row));
      return fallback.length ? fallback[Math.floor(rng() * fallback.length)] : null;
    }
    return free[Math.floor(rng() * free.length)];
  };

  const monsters = [];
  for (let count = 0; count < bp.pooka; count += 1) {
    const cell = pickMonsterCell();
    if (!cell) break;
    monsterCells.push(cell);
    monsters.push({ type: "pooka", col: cell.col, row: cell.row });
  }
  for (let count = 0; count < bp.fygar; count += 1) {
    const cell = pickMonsterCell();
    if (!cell) break;
    monsterCells.push(cell);
    monsters.push({ type: "fygar", col: cell.col, row: cell.row });
  }

  const rocks = [];
  const rockExistsNear = (col, row) => rocks.some((rock) => rock.col === col && Math.abs(rock.row - row) <= 1);
  const rockCellFree = (col, row) =>
    grid[row][col] === CELL_DIRT
    && grid[row + 1][col] === CELL_DIRT
    && !monsters.some((monster) => monster.col === col && (monster.row === row || monster.row === row + 1))
    && !rockExistsNear(col, row);

  for (let attempt = 0; attempt < 240 && rocks.length < bp.rocks; attempt += 1) {
    const col = 1 + Math.floor(rng() * (COLS - 2));
    const row = 2 + Math.floor(rng() * (ROWS - 4));
    if (!rockCellFree(col, row)) continue;
    rocks.push({ col, row });
  }
  if (rocks.length < bp.rocks) {
    for (let row = 2; row <= ROWS - 2 && rocks.length < bp.rocks; row += 1) {
      for (let col = 1; col < COLS - 1 && rocks.length < bp.rocks; col += 1) {
        if (rockCellFree(col, row)) rocks.push({ col, row });
      }
    }
  }

  const fossils = [];
  const fossilFree = (cell) => {
    if (cell.row < 0 || cell.col < 0 || cell.col >= COLS || cell.row >= ROWS) return false;
    if (grid[cell.row][cell.col] !== CELL_DIRT) return false;
    if (monsters.some((monster) => monster.col === cell.col && monster.row === cell.row)) return false;
    if (rocks.some((rock) => (rock.col === cell.col && (rock.row === cell.row || rock.row === cell.row - 1)))) return false;
    if (nearSpawn(cell)) return false;
    return !fossils.some((other) => Math.abs(other.col - cell.col) + Math.abs(other.row - cell.row) < 2);
  };
  for (let attempt = 0; attempt < 240 && fossils.length < 3; attempt += 1) {
    const cell = { col: Math.floor(rng() * COLS), row: 2 + Math.floor(rng() * (ROWS - 2)) };
    if (!fossilFree(cell)) continue;
    fossils.push(cell);
  }
  if (fossils.length < 3) {
    for (let row = ROWS - 1; row >= 2 && fossils.length < 3; row -= 1) {
      for (let col = 0; col < COLS && fossils.length < 3; col += 1) {
        const cell = { col, row };
        if (fossilFree(cell)) fossils.push(cell);
      }
    }
  }

  return {
    id: `d${String(index + 1).padStart(2, "0")}`,
    index,
    chapter,
    seed: (0x51ed + index * 2654435761) >>> 0,
    spawnCol: 8,
    ghostInterval: bp.ghost,
    speedScale: 1 + (chapter - 1) * 0.04,
    monsters,
    rocks,
    fossils,
    tunnels,
  };
}

export const LEVELS = Object.freeze(BLUEPRINTS.map((bp, index) => Object.freeze(buildLevel(index, bp))));

export const LEVEL_BY_ID = Object.freeze(
  Object.fromEntries(LEVELS.map((level) => [level.id, level])),
);

export function getLevel(id) {
  return LEVEL_BY_ID[id] ?? null;
}

export function nextLevel(id) {
  const level = LEVEL_BY_ID[id];
  if (!level) return null;
  return LEVELS[level.index + 1] ?? null;
}
