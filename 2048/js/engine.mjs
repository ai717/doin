export const SIZE = 4;
export const WIN_VALUE = 2048;
export const START_TILES = 2;

export const DIRS = Object.freeze(["up", "down", "left", "right"]);

const HORIZONTAL = new Set(["left", "right"]);
const FORWARD = new Set(["left", "up"]);

export function createState(best = 0) {
  return {
    tiles: [],
    score: 0,
    best,
    won: false,
    keepPlaying: false,
    over: false,
    nextId: 1,
  };
}

export function toGrid(tiles) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (const tile of tiles) grid[tile.row][tile.col] = tile.value;
  return grid;
}

export function settle(tiles) {
  return tiles.map((tile) => (tile.kind === "idle" ? tile : { ...tile, kind: "idle" }));
}

export function emptyCells(tiles) {
  const taken = new Set(tiles.map((tile) => tile.row * SIZE + tile.col));
  const cells = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (!taken.has(row * SIZE + col)) cells.push({ row, col });
    }
  }
  return cells;
}

export function highestTile(tiles) {
  let max = 0;
  for (const tile of tiles) if (tile.value > max) max = tile.value;
  return max;
}

function hasPair(tiles) {
  const grid = toGrid(tiles);
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = grid[row][col];
      if (value === 0) continue;
      if (col + 1 < SIZE && grid[row][col + 1] === value) return true;
      if (row + 1 < SIZE && grid[row + 1][col] === value) return true;
    }
  }
  return false;
}

export function isOver(tiles) {
  return emptyCells(tiles).length === 0 && !hasPair(tiles);
}

export function addRandomTile(state, rng = Math.random) {
  const cells = emptyCells(state.tiles);
  if (cells.length === 0) return state;
  const cell = cells[Math.floor(rng() * cells.length)];
  const tile = {
    id: state.nextId,
    value: rng() < 0.9 ? 2 : 4,
    row: cell.row,
    col: cell.col,
    kind: "new",
  };
  return { ...state, tiles: [...state.tiles, tile], nextId: state.nextId + 1 };
}

export function startGame(best = 0, rng = Math.random) {
  let state = createState(best);
  for (let i = 0; i < START_TILES; i++) state = addRandomTile(state, rng);
  return state;
}

function lineOf(tiles, dir, index) {
  const horizontal = HORIZONTAL.has(dir);
  const forward = FORWARD.has(dir);
  const line = tiles.filter((tile) => (horizontal ? tile.row : tile.col) === index);
  line.sort((a, b) => {
    const pa = horizontal ? a.col : a.row;
    const pb = horizontal ? b.col : b.row;
    return forward ? pa - pb : pb - pa;
  });
  return line;
}

function cellOf(dir, index, slot) {
  const forward = FORWARD.has(dir);
  const offset = forward ? slot : SIZE - 1 - slot;
  return HORIZONTAL.has(dir) ? { row: index, col: offset } : { row: offset, col: index };
}

const NO_MOVE = (state) => ({
  state,
  moved: false,
  gained: 0,
  topMerge: 0,
  absorbed: [],
});

export function applyMove(state, dir, rng = Math.random, options = {}) {
  const spawn = options.spawn !== false;
  if (state.over) return NO_MOVE(state);
  if (state.won && !state.keepPlaying) return NO_MOVE(state);
  if (!DIRS.includes(dir)) return NO_MOVE(state);

  const kept = [];
  const absorbed = [];
  let nextId = state.nextId;
  let gained = 0;
  let topMerge = 0;

  for (let index = 0; index < SIZE; index++) {
    const line = lineOf(state.tiles, dir, index);
    let slot = 0;
    let i = 0;
    while (i < line.length) {
      const head = line[i];
      const tail = line[i + 1];
      const cell = cellOf(dir, index, slot);
      if (tail && head.value === tail.value) {
        const value = head.value * 2;
        kept.push({ id: nextId++, value, row: cell.row, col: cell.col, kind: "merged" });
        absorbed.push({ id: head.id, value: head.value, row: cell.row, col: cell.col });
        absorbed.push({ id: tail.id, value: tail.value, row: cell.row, col: cell.col });
        gained += value;
        if (value > topMerge) topMerge = value;
        i += 2;
      } else {
        kept.push({ ...head, row: cell.row, col: cell.col, kind: "idle" });
        i += 1;
      }
      slot++;
    }
  }

  const moved = String(toGrid(kept)) !== String(toGrid(state.tiles));
  if (!moved) return NO_MOVE(state);

  let next = {
    ...state,
    tiles: kept,
    score: state.score + gained,
    nextId,
  };
  next.best = Math.max(next.best, next.score);
  if (spawn) next = addRandomTile(next, rng);

  if (!next.won && next.tiles.some((tile) => tile.value >= WIN_VALUE)) {
    next = { ...next, won: true };
  }
  if (isOver(next.tiles)) next = { ...next, over: true };

  return { state: next, moved: true, gained, topMerge, absorbed };
}

export function continueGame(state) {
  if (!state.won || state.over) return state;
  return { ...state, keepPlaying: true };
}

export function hasProgress(state) {
  return (
    state.score > 0 ||
    state.tiles.length > START_TILES ||
    state.tiles.some((tile) => tile.value > 4)
  );
}
