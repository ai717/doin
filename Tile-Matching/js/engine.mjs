export const BOARD_ROWS = 8;
export const BOARD_COLS = 8;

export const SPECIAL_TYPES = {
  NORMAL: 0,
  ROW_ROCKET: 1,
  COL_ROCKET: 2,
  BOMB: 3,
  RAINBOW: 4
};

let nextTileUid = 1;

export class Match3Engine {
  constructor(colorCount = 5, rng = Math.random) {
    this.colorCount = Math.max(3, Math.min(6, colorCount));
    this.rng = rng;
    this.grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  }

  createTileData(color, special = SPECIAL_TYPES.NORMAL) {
    return {
      uid: nextTileUid++,
      color: special === SPECIAL_TYPES.RAINBOW ? 0 : color,
      special: special
    };
  }

  randomColor() {
    return Math.floor(this.rng() * this.colorCount) + 1;
  }

  initBoard() {
    let attempts = 0;
    do {
      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          let forbidden = new Set();
          if (c >= 2 && this.grid[r][c - 1]?.color === this.grid[r][c - 2]?.color) {
            forbidden.add(this.grid[r][c - 1].color);
          }
          if (r >= 2 && this.grid[r - 1][c]?.color === this.grid[r - 2][c]?.color) {
            forbidden.add(this.grid[r - 1][c].color);
          }

          const available = [];
          for (let col = 1; col <= this.colorCount; col++) {
            if (!forbidden.has(col)) available.push(col);
          }

          const chosenColor = available.length > 0
            ? available[Math.floor(this.rng() * available.length)]
            : this.randomColor();

          this.grid[r][c] = this.createTileData(chosenColor, SPECIAL_TYPES.NORMAL);
        }
      }
      attempts++;
    } while (!this.hasPossibleMoves() && attempts < 50);

    if (!this.hasPossibleMoves()) {
      this.forceSolvablePattern();
    }
  }

  forceSolvablePattern() {
    this.grid[0][0] = this.createTileData(1);
    this.grid[0][1] = this.createTileData(1);
    this.grid[0][2] = this.createTileData(2);
    this.grid[0][3] = this.createTileData(1);
  }

  areAdjacent(p1, p2) {
    const dr = Math.abs(p1.r - p2.r);
    const dc = Math.abs(p1.c - p2.c);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  swap(p1, p2) {
    const tmp = this.grid[p1.r][p1.c];
    this.grid[p1.r][p1.c] = this.grid[p2.r][p2.c];
    this.grid[p2.r][p2.c] = tmp;
  }

  findRawMatches() {
    const horizontalLines = [];
    const verticalLines = [];

    for (let r = 0; r < BOARD_ROWS; r++) {
      let streak = [];
      for (let c = 0; c < BOARD_COLS; c++) {
        const tile = this.grid[r][c];
        if (!tile || tile.color === 0) {
          if (streak.length >= 3) horizontalLines.push([...streak]);
          streak = [];
          continue;
        }

        if (streak.length === 0 || streak[0].color === tile.color) {
          streak.push({ r, c, color: tile.color });
        } else {
          if (streak.length >= 3) horizontalLines.push([...streak]);
          streak = [{ r, c, color: tile.color }];
        }
      }
      if (streak.length >= 3) horizontalLines.push([...streak]);
    }

    for (let c = 0; c < BOARD_COLS; c++) {
      let streak = [];
      for (let r = 0; r < BOARD_ROWS; r++) {
        const tile = this.grid[r][c];
        if (!tile || tile.color === 0) {
          if (streak.length >= 3) verticalLines.push([...streak]);
          streak = [];
          continue;
        }

        if (streak.length === 0 || streak[0].color === tile.color) {
          streak.push({ r, c, color: tile.color });
        } else {
          if (streak.length >= 3) verticalLines.push([...streak]);
          streak = [{ r, c, color: tile.color }];
        }
      }
      if (streak.length >= 3) verticalLines.push([...streak]);
    }

    return { horizontalLines, verticalLines };
  }

  resolveMatchAnalysis(primaryPos = null) {
    const { horizontalLines, verticalLines } = this.findRawMatches();
    if (horizontalLines.length === 0 && verticalLines.length === 0) {
      return { matches: [], creations: [] };
    }

    const matchedMap = new Map();
    const creations = [];
    const key = (r, c) => `${r},${c}`;

    horizontalLines.forEach((line) => {
      line.forEach((p) => {
        const k = key(p.r, p.c);
        if (!matchedMap.has(k)) matchedMap.set(k, { r: p.r, c: p.c, color: p.color, hLen: line.length, vLen: 0 });
        else matchedMap.get(k).hLen = Math.max(matchedMap.get(k).hLen, line.length);
      });
    });

    verticalLines.forEach((line) => {
      line.forEach((p) => {
        const k = key(p.r, p.c);
        if (!matchedMap.has(k)) matchedMap.set(k, { r: p.r, c: p.c, color: p.color, hLen: 0, vLen: line.length });
        else matchedMap.get(k).vLen = Math.max(matchedMap.get(k).vLen, line.length);
      });
    });

    horizontalLines.forEach((line) => {
      if (line.length >= 5) {
        const center = (primaryPos && line.some(p => p.r === primaryPos.r && p.c === primaryPos.c))
          ? primaryPos : line[2];
        creations.push({ r: center.r, c: center.c, special: SPECIAL_TYPES.RAINBOW, color: 0 });
      } else if (line.length === 4) {
        const target = (primaryPos && line.some(p => p.r === primaryPos.r && p.c === primaryPos.c))
          ? primaryPos : line[1];
        creations.push({ r: target.r, c: target.c, special: SPECIAL_TYPES.ROW_ROCKET, color: line[0].color });
      }
    });

    verticalLines.forEach((line) => {
      if (line.length >= 5) {
        if (!creations.some(c => line.some(p => p.r === c.r && p.c === c.c))) {
          const center = (primaryPos && line.some(p => p.r === primaryPos.r && p.c === primaryPos.c))
            ? primaryPos : line[2];
          creations.push({ r: center.r, c: center.c, special: SPECIAL_TYPES.RAINBOW, color: 0 });
        }
      } else if (line.length === 4) {
        if (!creations.some(c => line.some(p => p.r === c.r && p.c === c.c))) {
          const target = (primaryPos && line.some(p => p.r === primaryPos.r && p.c === primaryPos.c))
            ? primaryPos : line[1];
          creations.push({ r: target.r, c: target.c, special: SPECIAL_TYPES.COL_ROCKET, color: line[0].color });
        }
      }
    });

    for (const info of matchedMap.values()) {
      if (info.hLen >= 3 && info.vLen >= 3) {
        if (!creations.some(c => c.r === info.r && c.c === info.c)) {
          creations.push({ r: info.r, c: info.c, special: SPECIAL_TYPES.BOMB, color: info.color });
        }
      }
    }

    const matches = Array.from(matchedMap.values()).map(m => ({ r: m.r, c: m.c }));
    return { matches, creations };
  }

  expandSpecialElimination(initialCoords) {
    const toClear = new Set();
    const queue = [...initialCoords];
    const key = (r, c) => `${r},${c}`;

    queue.forEach(p => toClear.add(key(p.r, p.c)));

    while (queue.length > 0) {
      const { r, c } = queue.shift();
      const tile = this.grid[r][c];
      if (!tile) continue;

      if (tile.special === SPECIAL_TYPES.ROW_ROCKET) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const k = key(r, col);
          if (!toClear.has(k)) {
            toClear.add(k);
            queue.push({ r, c: col });
          }
        }
      } else if (tile.special === SPECIAL_TYPES.COL_ROCKET) {
        for (let row = 0; row < BOARD_ROWS; row++) {
          const k = key(row, c);
          if (!toClear.has(k)) {
            toClear.add(k);
            queue.push({ r: row, c });
          }
        }
      } else if (tile.special === SPECIAL_TYPES.BOMB) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < BOARD_ROWS && nc >= 0 && nc < BOARD_COLS) {
              const k = key(nr, nc);
              if (!toClear.has(k)) {
                toClear.add(k);
                queue.push({ r: nr, c: nc });
              }
            }
          }
        }
      }
    }

    return Array.from(toClear).map(str => {
      const [r, c] = str.split(',').map(Number);
      return { r, c };
    });
  }

  triggerRainbowClear(targetColor) {
    const cleared = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const tile = this.grid[r][c];
        if (tile && (tile.color === targetColor || tile.special === SPECIAL_TYPES.RAINBOW)) {
          cleared.push({ r, c });
        }
      }
    }
    return this.expandSpecialElimination(cleared);
  }

  testSwapHasMatch(p1, p2) {
    const t1 = this.grid[p1.r][p1.c];
    const t2 = this.grid[p2.r][p2.c];
    if (!t1 || !t2) return false;

    if (t1.special === SPECIAL_TYPES.RAINBOW || t2.special === SPECIAL_TYPES.RAINBOW) return true;

    this.swap(p1, p2);
    const { horizontalLines, verticalLines } = this.findRawMatches();
    this.swap(p1, p2);
    return horizontalLines.length > 0 || verticalLines.length > 0;
  }

  getPossibleMove() {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const cur = { r, c };
        if (c < BOARD_COLS - 1) {
          const right = { r, c: c + 1 };
          if (this.testSwapHasMatch(cur, right)) return [cur, right];
        }
        if (r < BOARD_ROWS - 1) {
          const down = { r: r + 1, c };
          if (this.testSwapHasMatch(cur, down)) return [cur, down];
        }
      }
    }
    return null;
  }

  hasPossibleMoves() {
    return this.getPossibleMove() !== null;
  }

  // 严格自底向上坍缩与顶部完整补齐
  dropAndFill() {
    const dropSteps = [];

    for (let c = 0; c < BOARD_COLS; c++) {
      let targetRow = BOARD_ROWS - 1;

      // 1. 已存方块自底向上拉拢
      for (let r = BOARD_ROWS - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (targetRow !== r) {
            this.grid[targetRow][c] = this.grid[r][c];
            this.grid[r][c] = null;
            dropSteps.push({
              uid: this.grid[targetRow][c].uid,
              from: { r, c },
              to: { r: targetRow, c },
              isNew: false
            });
          }
          targetRow--;
        }
      }

      // 2. 空白槽位自顶端全部依序生成新方块
      let spawnOffset = -1;
      while (targetRow >= 0) {
        const newTile = this.createTileData(this.randomColor(), SPECIAL_TYPES.NORMAL);
        this.grid[targetRow][c] = newTile;
        dropSteps.push({
          uid: newTile.uid,
          from: { r: spawnOffset, c },
          to: { r: targetRow, c },
          isNew: true,
          tileData: newTile
        });
        spawnOffset--;
        targetRow--;
      }
    }

    return dropSteps;
  }

  shuffleBoard() {
    let allTiles = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (this.grid[r][c]) allTiles.push(this.grid[r][c]);
      }
    }

    let attempts = 0;
    do {
      for (let i = allTiles.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        const temp = allTiles[i];
        allTiles[i] = allTiles[j];
        allTiles[j] = temp;
      }

      let idx = 0;
      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          this.grid[r][c] = allTiles[idx++];
        }
      }
      attempts++;
    } while ((!this.hasPossibleMoves() || this.findRawMatches().horizontalLines.length > 0) && attempts < 40);
  }
}
