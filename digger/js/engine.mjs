// 《挖掘者》核心规则引擎：网格挖掘、气泵充气爆破、怪物生态与落石重力。
// 严格 DOM-free 且完全确定性：同一初始状态 + 同一操作/步长序列，必然复现同一结果。
// 所有剧情/文案均不在此层，展示文本统一由 UI 查 i18n。

export const WIDTH = 840;
export const HEIGHT = 560;

export const CELL = 36;
export const COLS = 16;
export const ROWS = 14;
export const FIELD_X = 132;
export const FIELD_Y = 44;
export const FIELD_W = COLS * CELL;
export const FIELD_H = ROWS * CELL;

export const SKY_ROW = -1;

export const CELL_DIRT = 0;
export const CELL_OPEN = 1;

export const STATUS_PLAYING = "playing";
export const STATUS_WON = "won";
export const STATUS_LOST = "lost";

export const PLAYER_LIVES = 3;
export const PLAYER_MOVE_TIME = 0.085;
export const INVULN_TIME = 1.6;

export const PUMP_RANGE = 3;
export const PUMP_SCORE = 200;
export const FOSSIL_SCORE = 300;
export const ROCK_SCORE_MULT = 3;
export const ROCK_SPEED = 400;
export const ROCK_SHAKE_TIME = 1;
export const ROCK_STEP_TIME = CELL / ROCK_SPEED;

export const GHOST_DURATION = 2.5;
export const LEAK_GRACE = 0.45;
export const FLAME_CHARGE = 0.55;
export const FLAME_TIME = 0.45;
export const FLAME_RANGE = 3;

export const DIRS = Object.freeze({
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
});

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
const DIRECTIONS = ["up", "down", "left", "right"];
const MONSTER_SPEED = { pooka: 0.24, fygar: 0.3, panic: 0.19 };

export function isInside(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

export function isOpenAt(state, col, row) {
  if (row === SKY_ROW) return col >= 0 && col < COLS;
  return isInside(col, row) && state.grid[row][col] === CELL_OPEN;
}

export function monsterAt(state, col, row) {
  return state.monsters.find((monster) => monster.alive && monster.col === col && monster.row === row) ?? null;
}

export function rockAt(state, col, row) {
  return state.rocks.find((rock) => !rock.shattered && rock.col === col && rock.row === row) ?? null;
}

export function fossilAt(state, col, row) {
  return state.fossils.find((fossil) => !fossil.got && fossil.col === col && fossil.row === row) ?? null;
}

function stepRandom(state) {
  let a = (state.rng + 0x6d2b79f5) >>> 0;
  state.rng = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function cloneState(state) {
  return {
    ...state,
    grid: state.grid.map((row) => row.slice()),
    player: { ...state.player },
    monsters: state.monsters.map((monster) => ({ ...monster })),
    rocks: state.rocks.map((rock) => ({ ...rock })),
    fossils: state.fossils.map((fossil) => ({ ...fossil })),
    hook: state.hook ? { ...state.hook } : null,
    events: [],
  };
}

export function createState(level, options = {}) {
  if (!level || !Array.isArray(level.monsters)) return null;

  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(CELL_DIRT));
  for (const cell of level.tunnels ?? []) {
    if (isInside(cell.col, cell.row)) grid[cell.row][cell.col] = CELL_OPEN;
  }

  const spawnCol = Number.isInteger(level.spawnCol) ? level.spawnCol : Math.floor(COLS / 2);
  const playerCol = Number.isInteger(options.playerCol) ? options.playerCol : spawnCol;
  const playerRow = Number.isInteger(options.playerRow) ? options.playerRow : SKY_ROW;

  const state = {
    levelId: level.id,
    chapter: level.chapter ?? 1,
    grid,
    player: {
      col: playerCol,
      row: playerRow,
      dir: "down",
      inputDir: null,
      moveTimer: 0,
      invuln: 0,
      lives: Math.max(1, Math.trunc(options.lives ?? PLAYER_LIVES)),
      spawnCol,
    },
    monsters: [],
    rocks: [],
    fossils: [],
    hook: null,
    status: STATUS_PLAYING,
    score: 0,
    fossilsGot: 0,
    monsterTotal: (level.monsters ?? []).length,
    pendingDeath: false,
    tick: 0,
    rng: (options.seed ?? level.seed ?? 1) >>> 0,
    ghostInterval: Math.max(2, Number(level.ghostInterval) || 8),
    speedScale: Math.max(0.6, Number(level.speedScale) || 1),
    events: [],
  };

  state.monsters = (level.monsters ?? []).map((monster, index) => {
    const type = monster.type === "fygar" ? "fygar" : "pooka";
    const face = DIRECTIONS[Math.floor(stepRandom(state) * DIRECTIONS.length)];
    return {
      id: `m${index}`,
      type,
      col: monster.col,
      row: monster.row,
      spawnCol: monster.col,
      spawnRow: monster.row,
      dir: face,
      alive: true,
      escaped: false,
      panic: false,
      panicTimer: 0,
      moveTimer: stepRandom(state) * 0.2,
      speed: (MONSTER_SPEED[type] ?? 0.26) * state.speedScale,
      ghostTimer: state.ghostInterval * (0.55 + stepRandom(state) * 0.45),
      ghostLeft: 0,
      ghosting: false,
      hooked: false,
      inflation: 0,
      leakTimer: 0,
      flameTimer: 4 + stepRandom(state) * 2,
      flameDir: "left",
      charge: 0,
      flameLeft: 0,
      hitFlash: 0,
    };
  });

  state.rocks = (level.rocks ?? []).map((rock, index) => ({
    id: `r${index}`,
    col: rock.col,
    row: rock.row,
    shake: 0,
    falling: false,
    fallTimer: 0,
    shattered: false,
  }));

  state.fossils = (level.fossils ?? []).map((fossil, index) => ({
    id: `f${index}`,
    col: fossil.col,
    row: fossil.row,
    got: false,
  }));

  return state;
}

export function setDirection(state, dir) {
  if (!state || state.status !== STATUS_PLAYING || !DIRS[dir]) return state;
  if (state.player.inputDir === dir && state.player.dir === dir) return state;
  const next = cloneState(state);
  next.player.inputDir = dir;
  next.player.dir = dir;
  return next;
}

export function clearDirection(state, dir) {
  if (!state || state.player.inputDir === null) return state;
  if (dir && state.player.inputDir !== dir) return state;
  const next = cloneState(state);
  next.player.inputDir = null;
  return next;
}

function digCell(state, col, row) {
  if (!isInside(col, row) || state.grid[row][col] !== CELL_DIRT) return;
  state.grid[row][col] = CELL_OPEN;
  state.events.push({ type: "dig", col, row });
  const fossil = fossilAt(state, col, row);
  if (fossil) {
    fossil.got = true;
    state.fossilsGot += 1;
    state.score += FOSSIL_SCORE;
    state.events.push({ type: "fossil", col, row, index: state.fossilsGot });
  }
}

function tryMovePlayer(state, dir) {
  const delta = DIRS[dir];
  if (!delta) return false;
  const col = state.player.col + delta.dc;
  const row = state.player.row + delta.dr;
  if (col < 0 || col >= COLS) return false;
  if (row < SKY_ROW || row >= ROWS) return false;
  if (rockAt(state, col, row)) return false;

  if (row >= 0) digCell(state, col, row);
  state.player.col = col;
  state.player.row = row;
  state.player.dir = dir;
  state.hook = null;
  return true;
}

function rayToward(state) {
  const delta = DIRS[state.player.dir] ?? DIRS.down;
  const cells = [];
  let col = state.player.col;
  let row = state.player.row;
  for (let step = 1; step <= PUMP_RANGE; step += 1) {
    col += delta.dc;
    row += delta.dr;
    if (col < 0 || col >= COLS || row < SKY_ROW || row >= ROWS) break;
    cells.push({ col, row });
    if (row >= 0 && state.grid[row][col] === CELL_DIRT) break;
    const monster = monsterAt(state, col, row);
    if (monster) return { monster, cells, distance: step };
  }
  return { monster: null, cells, distance: cells.length };
}

export function pump(state) {
  if (!state || state.status !== STATUS_PLAYING) return state;
  const next = cloneState(state);
  const ray = rayToward(next);

  if (!ray.monster) {
    next.hook = { dir: next.player.dir, target: null, timer: 0.14, length: Math.max(1, ray.distance) };
    next.events.push({ type: "pump-miss", dir: next.player.dir });
    return next;
  }

  const target = next.monsters.find((monster) => monster.id === ray.monster.id);
  target.inflation = Math.min(3, target.inflation + 1);
  target.hooked = true;
  target.leakTimer = LEAK_GRACE;
  target.hitFlash = 0.18;
  next.hook = { dir: next.player.dir, target: target.id, timer: 0.2, length: ray.distance };
  next.events.push({
    type: "pump-hit",
    id: target.id,
    monsterType: target.type,
    col: target.col,
    row: target.row,
    inflation: target.inflation,
  });

  if (target.inflation >= 3) {
    target.alive = false;
    target.hooked = false;
    next.score += PUMP_SCORE;
    next.events.push({
      type: "burst",
      id: target.id,
      monsterType: target.type,
      col: target.col,
      row: target.row,
    });
  }

  updateOutcome(next);
  return next;
}

function canMonsterEnter(state, monster, col, row) {
  if (col < 0 || col >= COLS || row < SKY_ROW || row >= ROWS) return false;
  const canDrill = monster.panic && monster.panicTimer <= 0;
  if (row >= 0 && state.grid[row][col] === CELL_DIRT && !monster.ghosting && !canDrill) return false;
  if (rockAt(state, col, row)) return false;
  for (const other of state.monsters) {
    if (other === monster || !other.alive) continue;
    if (other.col === col && other.row === row) return false;
  }
  return true;
}

function chooseMonsterDir(state, monster) {
  let best = null;
  let bestScore = -Infinity;
  const reverse = OPPOSITE[monster.dir];
  for (const dir of DIRECTIONS) {
    const delta = DIRS[dir];
    const col = monster.col + delta.dc;
    const row = monster.row + delta.dr;
    if (!canMonsterEnter(state, monster, col, row)) continue;
    let score = -(Math.abs(state.player.col - col) + Math.abs(state.player.row - row));
    if (dir === reverse) score -= 2.4;
    if (monster.panic && dir === "up") score += 6;
    score += stepRandom(state) * 0.7;
    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best;
}

function moveMonster(state, monster) {
  const dir = chooseMonsterDir(state, monster);
  if (!dir) {
    monster.moveTimer = 0.16;
    return;
  }
  const delta = DIRS[dir];
  monster.dir = dir;
  const col = monster.col + delta.dc;
  const row = monster.row + delta.dr;
  if (monster.panic && monster.panicTimer <= 0 && row >= 0 && state.grid[row][col] === CELL_DIRT) {
    state.grid[row][col] = CELL_OPEN;
    state.events.push({ type: "monster-dig", id: monster.id, col, row });
  }
  monster.col = col;
  monster.row = row;
  if (monster.row < 0 && monster.panic && monster.panicTimer <= 0) {
    monster.alive = false;
    monster.escaped = true;
    state.events.push({ type: "escape", id: monster.id, col: monster.col, row: monster.row });
  }
}

function flamePathClear(state, monster, dir) {
  const delta = DIRS[dir];
  for (let step = 1; step <= FLAME_RANGE; step += 1) {
    const col = monster.col + delta.dc * step;
    const row = monster.row + delta.dr * step;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (state.grid[row][col] === CELL_DIRT) return false;
  }
  return true;
}

function updateFygar(state, monster, dt) {
  if (monster.flameLeft > 0) {
    monster.flameLeft -= dt;
    return true;
  }
  if (monster.charge > 0) {
    monster.charge -= dt;
    if (monster.charge <= 0) {
      monster.flameLeft = FLAME_TIME;
      state.events.push({
        type: "flame",
        id: monster.id,
        col: monster.col,
        row: monster.row,
        dir: monster.flameDir,
      });
    }
    return true;
  }
  monster.flameTimer -= dt;
  if (monster.flameTimer > 0) return false;
  if (monster.inflation > 0) return false;
  monster.flameTimer = 5;
  const dir = state.player.col >= monster.col ? "right" : "left";
  const distance = Math.abs(state.player.col - monster.col);
  if (
    state.player.row === monster.row
    && distance >= 1
    && distance <= FLAME_RANGE
    && flamePathClear(state, monster, dir)
  ) {
    monster.flameDir = dir;
    monster.dir = dir;
    monster.charge = FLAME_CHARGE;
    monster.moveTimer = 0.12;
    state.events.push({ type: "charge", id: monster.id, col: monster.col, row: monster.row, dir });
    return true;
  }
  return false;
}

function updateMonsters(state, dt) {
  const alive = state.monsters.filter((monster) => monster.alive);
  if (alive.length === 1 && state.monsterTotal > 1) {
    const last = alive[0];
    if (!last.panic) {
      last.panic = true;
      last.panicTimer = 6;
      state.events.push({ type: "panic", id: last.id, col: last.col, row: last.row });
    } else {
      last.panicTimer = Math.max(0, last.panicTimer - dt);
    }
  }

  for (const monster of state.monsters) {
    if (!monster.alive) continue;
    monster.hitFlash = Math.max(0, monster.hitFlash - dt);

    if (monster.type === "pooka" && !monster.panic) {
      if (monster.ghosting) {
        monster.ghostLeft -= dt;
        if (monster.ghostLeft <= 0) {
          if (monster.row >= 0 && state.grid[monster.row][monster.col] === CELL_DIRT) {
            monster.ghostLeft = 0.3;
          } else {
            monster.ghosting = false;
            monster.ghostTimer = state.ghostInterval;
          }
        }
      } else {
        monster.ghostTimer -= dt;
        if (monster.ghostTimer <= 0) {
          monster.ghosting = true;
          monster.ghostLeft = GHOST_DURATION;
          state.events.push({ type: "ghost", id: monster.id, col: monster.col, row: monster.row });
        }
      }
    }

    if (monster.inflation > 0) {
      if (monster.hooked) {
        monster.leakTimer -= dt;
        if (monster.leakTimer <= 0) {
          monster.hooked = false;
          monster.leakTimer = 1;
        }
        continue;
      }
      monster.leakTimer -= dt;
      if (monster.leakTimer <= 0) {
        monster.inflation = Math.max(0, monster.inflation - 1);
        monster.leakTimer = 1;
      }
    }
    if (monster.hooked) continue;

    if (monster.type === "fygar" && updateFygar(state, monster, dt)) continue;

    monster.moveTimer -= dt;
    if (monster.moveTimer > 0) continue;
    const slow = monster.inflation > 0 ? 1.55 : 1;
    const base = monster.panic ? MONSTER_SPEED.panic * state.speedScale : monster.speed;
    monster.moveTimer = base * slow;
    moveMonster(state, monster);
  }
}

function crushCell(state, col, row) {
  for (const monster of state.monsters) {
    if (!monster.alive || monster.col !== col || monster.row !== row) continue;
    monster.alive = false;
    monster.hooked = false;
    state.score += PUMP_SCORE * ROCK_SCORE_MULT;
    state.events.push({
      type: "rock-kill",
      id: monster.id,
      monsterType: monster.type,
      col,
      row,
    });
  }
  if (state.player.col === col && state.player.row === row) state.pendingDeath = true;
}

function shatterRock(state, rock) {
  rock.shattered = true;
  rock.falling = false;
  rock.shake = 0;
  if (isInside(rock.col, rock.row)) state.grid[rock.row][rock.col] = CELL_OPEN;
  state.events.push({ type: "rock-shatter", col: rock.col, row: rock.row });
}

function updateRocks(state, dt) {
  for (const rock of state.rocks) {
    if (rock.shattered) continue;
    if (rock.falling) {
      rock.fallTimer += dt;
      let guard = 0;
      while (rock.fallTimer >= ROCK_STEP_TIME && guard < 16) {
        rock.fallTimer -= ROCK_STEP_TIME;
        guard += 1;
        const row = rock.row + 1;
        if (row >= ROWS || state.grid[row][rock.col] === CELL_DIRT) {
          shatterRock(state, rock);
          break;
        }
        rock.row = row;
        state.events.push({ type: "rock-move", col: rock.col, row: rock.row });
        crushCell(state, rock.col, rock.row);
        if (rock.shattered) break;
      }
    } else {
      const below = rock.row + 1;
      const supported = below >= ROWS || state.grid[below][rock.col] === CELL_DIRT;
      if (!supported) {
        rock.shake += dt;
        if (rock.shake >= ROCK_SHAKE_TIME) {
          rock.shake = 0;
          rock.falling = true;
          rock.fallTimer = 0;
          state.events.push({ type: "rock-fall", col: rock.col, row: rock.row });
        }
      } else {
        rock.shake = 0;
      }
    }
  }
}

function killPlayer(state) {
  if (state.status !== STATUS_PLAYING || state.player.invuln > 0) return;
  state.player.lives -= 1;
  state.player.invuln = INVULN_TIME;
  state.hook = null;
  state.events.push({
    type: "death",
    col: state.player.col,
    row: state.player.row,
    lives: state.player.lives,
  });
  if (state.player.lives <= 0) {
    state.status = STATUS_LOST;
    state.events.push({ type: "lost" });
    return;
  }
  state.player.col = state.player.spawnCol;
  state.player.row = SKY_ROW;
  state.player.dir = "down";
  state.player.inputDir = null;
  state.player.moveTimer = 0;
  for (const monster of state.monsters) {
    if (!monster.alive) continue;
    monster.col = monster.spawnCol;
    monster.row = monster.spawnRow;
    monster.dir = "down";
    monster.hooked = false;
    monster.inflation = 0;
    monster.leakTimer = 0;
    monster.ghosting = false;
    monster.ghostLeft = 0;
    monster.ghostTimer = state.ghostInterval * (0.5 + stepRandom(state) * 0.5);
    monster.charge = 0;
    monster.flameLeft = 0;
    monster.flameTimer = 4 + stepRandom(state) * 2;
    monster.moveTimer = 0.3;
    monster.panic = false;
    monster.panicTimer = 0;
  }
}

export function flameCells(state, monster) {
  if (!monster || monster.type !== "fygar" || monster.flameLeft <= 0) return [];
  const delta = DIRS[monster.flameDir] ?? DIRS.left;
  const cells = [];
  for (let step = 1; step <= FLAME_RANGE; step += 1) {
    const col = monster.col + delta.dc * step;
    const row = monster.row + delta.dr * step;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) break;
    if (state.grid[row][col] === CELL_DIRT) break;
    cells.push({ col, row });
  }
  return cells;
}

function resolveCollisions(state) {
  if (state.pendingDeath) {
    state.pendingDeath = false;
    killPlayer(state);
    if (state.status !== STATUS_PLAYING) return;
  }
  for (const monster of state.monsters) {
    if (!monster.alive) continue;
    if (monster.col === state.player.col && monster.row === state.player.row) {
      killPlayer(state);
      if (state.status !== STATUS_PLAYING) return;
      continue;
    }
    if (monster.type !== "fygar") continue;
    for (const cell of flameCells(state, monster)) {
      if (cell.col === state.player.col && cell.row === state.player.row) {
        killPlayer(state);
        if (state.status !== STATUS_PLAYING) return;
        break;
      }
    }
  }
}

function updateOutcome(state) {
  if (state.status !== STATUS_PLAYING) return;
  const remaining = state.monsters.filter((monster) => monster.alive).length;
  if (remaining === 0) {
    state.status = STATUS_WON;
    state.events.push({ type: "won" });
    return;
  }
  if (state.player.lives <= 0) {
    state.status = STATUS_LOST;
    state.events.push({ type: "lost" });
  }
}

// 固定步长推进。dt 建议 1/120s；events 只包含本帧新产生的事件。
export function stepFrame(state, dt) {
  if (!state || !Number.isFinite(dt) || dt <= 0) return state;
  if (state.status !== STATUS_PLAYING) return state;

  const next = cloneState(state);
  next.tick += 1;
  next.player.invuln = Math.max(0, next.player.invuln - dt);
  next.player.moveTimer = Math.max(0, next.player.moveTimer - dt);
  if (next.hook) {
    next.hook.timer -= dt;
    if (next.hook.timer <= 0) next.hook = null;
  }

  if (next.player.inputDir && next.player.moveTimer <= 0) {
    const moved = tryMovePlayer(next, next.player.inputDir);
    next.player.moveTimer = moved ? PLAYER_MOVE_TIME : Math.min(PLAYER_MOVE_TIME, 0.03);
  }

  updateMonsters(next, dt);
  updateRocks(next, dt);
  resolveCollisions(next);
  updateOutcome(next);
  return next;
}
