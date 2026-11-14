// Bomber - pure rules layer. No DOM, no storage, no timers.
// Fixed-step simulation: one tick = 1/60 s.

export const TICK_MS = 1000 / 60;

export const TILE_EMPTY = 0;
export const TILE_HARD = 1;
export const TILE_SOFT = 2;
export const TILE_CRACK = 3;
export const CHAR_TO_TILE = { ".": TILE_EMPTY, "#": TILE_HARD, o: TILE_SOFT, "=": TILE_CRACK };
export const TILE_TO_CHAR = [".", "#", "o", "="];

export const MODE_CAMPAIGN = "campaign";
export const MODE_PUZZLE = "puzzle";

export const STATUS_PLAYING = "playing";
export const STATUS_WON = "won";
export const STATUS_LOST = "lost";

export const FUSE_TICKS = 144; // 2.4s
export const FUSE_TICKS_PUZZLE = 240; // 4.0s
export const FLAME_TICKS = 30; // 0.5s
export const REMOTE_HOLD_TICKS = 420; // 7s cap for held remote bombs
export const INVULN_TICKS = 90; // 1.5s spawn protection
export const CHAIN_WINDOW = 180; // 3s combo window
export const CURSE_TICKS = 600; // 10s

export const BASE_SPEED = 3.3; // cells per second
export const SPEED_STEP = 0.55;
export const MAX_FIRE = 8;
export const MAX_BOMBS = 8;
export const MAX_SPEED_LEVEL = 3;

export const POWER_KINDS = ["fire", "bomb", "speed", "kick", "remote", "pierce", "shield", "curse"];
export const CURSE_KINDS = ["slow", "reverse", "weak", "fever"];

export const ENEMY_TYPES = ["balloon", "chaser", "evader", "ghost", "armored", "boss", "target"];
export const ENEMY_SPEED = { balloon: 1.5, chaser: 2.4, evader: 2.1, ghost: 1.7, armored: 1.3, boss: 1.6, target: 0 };
export const ENEMY_HP = { balloon: 1, chaser: 1, evader: 1, ghost: 1, armored: 2, boss: 3, target: 1 };

export const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const DEFAULT_LEVEL = {
  id: "level_1_1",
  mode: MODE_CAMPAIGN,
  cols: 13,
  rows: 11,
  tiles: [],
  spawn: [1, 1],
  enemies: [],
  powerups: [],
  exit: null,
  timeLimit: 200,
  fire: 1,
  bombs: 1,
  par: 0,
  seed: 1,
};

// ---------------------------------------------------------------- utilities

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function parseTiles(rows) {
  return rows.map((line) => {
    const out = [];
    for (let x = 0; x < line.length; x++) out.push(CHAR_TO_TILE[line[x]] ?? TILE_EMPTY);
    return out;
  });
}

export function serializeTiles(tiles) {
  return tiles.map((row) => row.map((t) => TILE_TO_CHAR[t] ?? ".").join(""));
}

export function inBounds(state, cx, cy) {
  return cx >= 0 && cy >= 0 && cx < state.cols && cy < state.rows;
}

export function tileAt(state, cx, cy) {
  if (!inBounds(state, cx, cy)) return TILE_HARD;
  return state.tiles[cy][cx];
}

export function bombAt(state, cx, cy) {
  for (const bomb of state.bombs) if (bomb.cx === cx && bomb.cy === cy) return bomb;
  return null;
}

export function solidTile(state, cx, cy, ghost = false) {
  const tile = tileAt(state, cx, cy);
  if (tile === TILE_HARD) return true;
  if (tile === TILE_SOFT || tile === TILE_CRACK) return !ghost;
  return false;
}

export function passable(state, cx, cy, opts = {}) {
  if (!inBounds(state, cx, cy)) return false;
  if (solidTile(state, cx, cy, opts.ghost)) return false;
  if (!opts.ignoreBombs) {
    const bomb = bombAt(state, cx, cy);
    // A freshly dropped bomb is ghostly for the bomber until he steps off it.
    if (bomb && !(bomb.soft && opts.player)) return false;
  }
  return true;
}

export function cellOf(x, y) {
  return [Math.floor(x), Math.floor(y)];
}

// True while the entity body still overlaps the cell. Used to decide when a
// ghost bomb turns solid: only after the player has fully cleared the cell,
// otherwise he would be frozen mid-stride and cooked by his own bomb.
export function overlapsCell(ent, cx, cy, r = 0.34) {
  return (
    Math.floor(ent.x - r) <= cx &&
    cx <= Math.floor(ent.x + r) &&
    Math.floor(ent.y - r) <= cy &&
    cy <= Math.floor(ent.y + r)
  );
}

// Pure flame geometry: centre + four arms. Soft / crack tiles stop the arm
// (and are consumed by the caller), hard tiles stop it outright.
export function flameCells(grid, cols, rows, cx, cy, range, pierce = false) {
  const cells = [[cx, cy]];
  for (const [dx, dy] of DIRS) {
    for (let step = 1; step <= range; step++) {
      const nx = cx + dx * step;
      const ny = cy + dy * step;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) break;
      const tile = grid[ny][nx];
      if (tile === TILE_HARD) break;
      cells.push([nx, ny]);
      if (tile === TILE_SOFT || tile === TILE_CRACK) {
        if (!pierce) break;
      }
    }
  }
  return cells;
}

export function bfs(state, start, goalFn, opts = {}) {
  const key = (x, y) => y * state.cols + x;
  const queue = [[start[0], start[1]]];
  const parent = new Map();
  parent.set(key(start[0], start[1]), null);
  let head = 0;
  const limit = opts.limit ?? 600;
  while (head < queue.length && head < limit) {
    const [x, y] = queue[head++];
    if (goalFn(x, y) && !(x === start[0] && y === start[1])) {
      const path = [];
      let cur = key(x, y);
      while (cur !== null && cur !== undefined) {
        path.push([cur % state.cols, Math.floor(cur / state.cols)]);
        cur = parent.get(cur);
      }
      return path.reverse();
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (parent.has(k)) continue;
      if (!passable(state, nx, ny, opts)) continue;
      parent.set(k, key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

// ---------------------------------------------------------------- creation

export function createState(level, opts = {}) {
  const cfg = { ...DEFAULT_LEVEL, ...level };
  const tiles = Array.isArray(cfg.tiles) && typeof cfg.tiles[0] === "string" ? parseTiles(cfg.tiles) : cfg.tiles;
  const grid = tiles.map((row) => row.slice());
  const hp = grid.map((row) => row.map((t) => (t === TILE_CRACK ? 2 : 0)));
  const cols = cfg.cols;
  const rows = cfg.rows;

  let bricks = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === TILE_SOFT || grid[y][x] === TILE_CRACK) bricks++;
    }
  }

  const unlocks = opts.unlocks ?? {};
  const puzzle = cfg.mode === MODE_PUZZLE;
  const player = {
    x: cfg.spawn[0] + 0.5,
    y: cfg.spawn[1] + 0.5,
    facing: [0, 1],
    alive: true,
    immune: puzzle,
    invuln: INVULN_TICKS,
    fire: Math.min(MAX_FIRE, cfg.fire + (unlocks.fire ? 1 : 0)),
    bombMax: Math.min(MAX_BOMBS, cfg.bombs + (unlocks.bomb ? 1 : 0)),
    bombsOut: 0,
    speedLevel: 0,
    kick: false,
    remote: false,
    pierce: false,
    shield: unlocks.shield ? 1 : 0,
    curse: null,
    curseTicks: 0,
    feverTicks: 0,
  };

  const enemies = (cfg.enemies ?? []).map((raw, index) => {
    const type = raw.type ?? "balloon";
    return {
      id: index + 1,
      type,
      cx: raw.cx,
      cy: raw.cy,
      tx: raw.cx,
      ty: raw.cy,
      x: raw.cx + 0.5,
      y: raw.cy + 0.5,
      hp: ENEMY_HP[type] ?? 1,
      maxHp: ENEMY_HP[type] ?? 1,
      speed: ENEMY_SPEED[type] ?? 1.5,
      think: index * 7,
      alive: true,
      dir: [0, 0],
    };
  });

  const powerups = (cfg.powerups ?? []).map((raw, index) => ({
    id: index + 1,
    cx: raw.cx,
    cy: raw.cy,
    kind: raw.kind,
    hidden: Boolean(raw.hidden),
  }));

  const state = {
    mode: cfg.mode,
    levelId: cfg.id,
    chapter: cfg.chapter ?? 1,
    index: cfg.index ?? 1,
    cols,
    rows,
    tiles: grid,
    tileHp: hp,
    player,
    bombs: [],
    flames: [],
    powerups,
    enemies,
    exit: cfg.exit ? { cx: cfg.exit.cx, cy: cfg.exit.cy, revealed: !cfg.exit.hidden } : null,
    spawn: { cx: cfg.spawn[0], cy: cfg.spawn[1] },
    timeLimit: Math.round((cfg.timeLimit ?? 200) * (1000 / TICK_MS)),
    timeLeft: Math.round((cfg.timeLimit ?? 200) * (1000 / TICK_MS)),
    par: cfg.par ?? 0,
    bombBudget: cfg.bombBudget ?? 0,
    seed: cfg.seed ?? 1,
    rng: mulberry32((cfg.seed ?? 1) >>> 0),
    tick: 0,
    acc: 0,
    status: STATUS_PLAYING,
    input: { dx: 0, dy: 0 },
    path: null,
    events: [],
    chain: 0,
    chainTimer: 0,
    cascadeTick: -1,
    cascades: 0,
    clearedInOneChain: false,
    stats: {
      kills: 0,
      enemiesTotal: enemies.length,
      bricksTotal: bricks,
      bricksBroken: 0,
      bombsUsed: 0,
      maxChain: 0,
      powerups: 0,
    },
  };
  if (state.exit && !state.exit.revealed) {
    // exit stays dormant until the arena is cleared
  }
  return state;
}

// ---------------------------------------------------------------- intents

export function setInput(state, dx, dy) {
  const nx = Math.abs(dx) > 0 ? Math.sign(dx) : 0;
  const ny = Math.abs(dy) > 0 ? Math.sign(dy) : 0;
  if (nx !== 0 && ny !== 0) {
    // single axis at a time keeps grid movement crisp
    state.input.dx = nx;
    state.input.dy = 0;
  } else {
    state.input.dx = nx;
    state.input.dy = ny;
  }
  if (nx !== 0 || ny !== 0) state.path = null;
}

export function setPath(state, cells) {
  state.path = cells && cells.length ? cells.map(([cx, cy]) => ({ cx, cy })) : null;
}

export function clearPath(state) {
  state.path = null;
}

export function placeBomb(state) {
  if (state.status !== STATUS_PLAYING || !state.player.alive) return false;
  const p = state.player;
  if (p.bombsOut >= p.bombMax) return false;
  if (state.mode === MODE_PUZZLE && state.bombBudget > 0 && state.stats.bombsUsed >= state.bombBudget) return false;
  const [cx, cy] = cellOf(p.x, p.y);
  if (tileAt(state, cx, cy) !== TILE_EMPTY) return false;
  if (bombAt(state, cx, cy)) return false;
  const puzzle = state.mode === MODE_PUZZLE;
  state.bombs.push({
    id: state.tick * 100 + state.bombs.length + 1,
    cx,
    cy,
    fuse: puzzle ? FUSE_TICKS_PUZZLE : FUSE_TICKS,
    range: Math.max(1, p.curse === "weak" ? p.fire - 1 : p.fire),
    pierce: p.pierce,
    remote: p.remote,
    waiting: false,
    waitTicks: 0,
    soft: true,
  });
  p.bombsOut += 1;
  state.stats.bombsUsed += 1;
  state.events.push({ type: "place", cx, cy });
  return true;
}

export function detonateRemote(state) {
  if (state.status !== STATUS_PLAYING) return false;
  const ready = state.bombs.filter((b) => b.remote && b.waiting);
  if (!ready.length) return false;
  for (const bomb of ready) detonate(state, bomb);
  return true;
}

// ---------------------------------------------------------------- kick

export function kickBomb(state, bomb, dx, dy) {
  if (!state.player.kick) return false;
  bomb.slide = [dx, dy];
  bomb.slideTick = 0;
  state.events.push({ type: "kick", cx: bomb.cx, cy: bomb.cy });
  return true;
}

function updateSlides(state) {
  for (const bomb of state.bombs) {
    if (!bomb.slide) continue;
    bomb.slideTick += 1;
    if (bomb.slideTick < 7) continue;
    bomb.slideTick = 0;
    const nx = bomb.cx + bomb.slide[0];
    const ny = bomb.cy + bomb.slide[1];
    const frozen = state.tiles[ny]?.[nx];
    if (frozen === undefined || frozen !== TILE_EMPTY || bombAt(state, nx, ny)) {
      bomb.slide = null;
      continue;
    }
    bomb.cx = nx;
    bomb.cy = ny;
  }
}

// ---------------------------------------------------------------- movement

function canStand(state, x, y, opts) {
  const r = 0.34;
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r);
  const y1 = Math.floor(y + r);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!passable(state, cx, cy, opts)) return false;
    }
  }
  return true;
}

function moveAxis(state, ent, dx, dy, dist, opts) {
  if (dx !== 0) {
    const lane = Math.floor(ent.y) + 0.5;
    const assist = Math.max(-dist, Math.min(dist, (lane - ent.y) * Math.min(1, dist * 4)));
    const nx = ent.x + dx * dist;
    if (canStand(state, nx, ent.y + assist, opts)) {
      ent.x = nx;
      ent.y += assist;
      return true;
    }
    if (canStand(state, nx, ent.y, opts)) {
      ent.x = nx;
      return true;
    }
  }
  if (dy !== 0) {
    const lane = Math.floor(ent.x) + 0.5;
    const assist = Math.max(-dist, Math.min(dist, (lane - ent.x) * Math.min(1, dist * 4)));
    const ny = ent.y + dy * dist;
    if (canStand(state, ent.x + assist, ny, opts)) {
      ent.y = ny;
      ent.x += assist;
      return true;
    }
    if (canStand(state, ent.x, ny, opts)) {
      ent.y = ny;
      return true;
    }
  }
  return false;
}

function playerSpeed(state) {
  const p = state.player;
  let speed = BASE_SPEED + p.speedLevel * SPEED_STEP;
  if (p.curse === "slow") speed *= 0.62;
  return speed;
}

function pathDirection(state) {
  const p = state.player;
  if (!state.path || !state.path.length) return null;
  const wp = state.path[0];
  const tx = wp.cx + 0.5;
  const ty = wp.cy + 0.5;
  const dx = tx - p.x;
  const dy = ty - p.y;
  if (Math.abs(dx) < 0.06 && Math.abs(dy) < 0.06) {
    state.path.shift();
    if (!state.path.length) state.path = null;
    return null;
  }
  if (Math.abs(dx) > Math.abs(dy)) return [Math.sign(dx), 0];
  return [0, Math.sign(dy)];
}

function updatePlayer(state, dt) {
  const p = state.player;
  if (!p.alive) return;
  if (p.invuln > 0) p.invuln -= 1;
  if (p.curseTicks > 0) {
    p.curseTicks -= 1;
    if (p.curseTicks === 0) {
      p.curse = null;
      state.events.push({ type: "curse_end" });
    }
  }
  if (p.curse === "fever") {
    p.feverTicks -= 1;
    if (p.feverTicks <= 0) {
      p.feverTicks = 45;
      placeBomb(state);
    }
  }

  let dx = state.input.dx;
  let dy = state.input.dy;
  const fromPath = pathDirection(state);
  if (fromPath) {
    dx = fromPath[0];
    dy = fromPath[1];
  }
  if (dx === 0 && dy === 0) return;
  if (p.curse === "reverse") {
    dx = -dx;
    dy = -dy;
  }
  p.facing = [dx, dy];
  const dist = playerSpeed(state) * dt;
  const [ccx, ccy] = cellOf(p.x, p.y);
  const ahead = bombAt(state, ccx + dx, ccy + dy);
  if (ahead && !ahead.soft) kickBomb(state, ahead, dx, dy);
  moveAxis(state, p, dx, dy, dist, { player: true });
  hardenBombs(state);
}

// Ghost bombs turn solid the moment the bomber's body fully leaves their cell.
function hardenBombs(state) {
  for (const bomb of state.bombs) {
    if (!bomb.soft) continue;
    if (!overlapsCell(state.player, bomb.cx, bomb.cy)) bomb.soft = false;
  }
}

// ---------------------------------------------------------------- enemies

function dangerSet(state) {
  const set = new Set();
  for (const bomb of state.bombs) {
    for (const [cx, cy] of flameCells(state.tiles, state.cols, state.rows, bomb.cx, bomb.cy, bomb.range, bomb.pierce)) {
      set.add(cy * state.cols + cx);
    }
  }
  return set;
}

function enemyOptions(state, e) {
  const opts = [];
  for (const [dx, dy] of DIRS) {
    const nx = e.cx + dx;
    const ny = e.cy + dy;
    if (passable(state, nx, ny, { ghost: e.type === "ghost" })) opts.push([nx, ny, dx, dy]);
  }
  return opts;
}

function chooseNext(state, e) {
  if (e.type === "target") {
    e.dir = [0, 0];
    return;
  }
  const options = enemyOptions(state, e);
  if (!options.length) {
    e.dir = [0, 0];
    return;
  }
  const forward = options.find((o) => o[2] === e.dir[0] && o[3] === e.dir[1]);

  if (e.type === "chaser" || e.type === "boss") {
    const [px, py] = cellOf(state.player.x, state.player.y);
    const path = bfs(state, [e.cx, e.cy], (x, y) => x === px && y === py, { ghost: e.type === "ghost", limit: 300 });
    if (path && path.length > 1) {
      e.tx = path[1][0];
      e.ty = path[1][1];
      e.dir = [e.tx - e.cx, e.ty - e.cy];
      return;
    }
  }

  if (e.type === "evader") {
    const danger = dangerSet(state);
    if (danger.has(e.cy * state.cols + e.cx)) {
      const path = bfs(state, [e.cx, e.cy], (x, y) => !danger.has(y * state.cols + x), { ghost: false, limit: 300 });
      if (path && path.length > 1) {
        e.tx = path[1][0];
        e.ty = path[1][1];
        e.dir = [e.tx - e.cx, e.ty - e.cy];
        return;
      }
    }
  }

  const straight = forward && state.rng() < 0.72 ? forward : null;
  const pick = straight ?? options[Math.floor(state.rng() * options.length)];
  e.tx = pick[0];
  e.ty = pick[1];
  e.dir = [pick[2], pick[3]];
}

function updateEnemies(state, dt) {
  for (const e of state.enemies) {
    if (!e.alive || e.type === "target") continue;
    const dist = e.speed * dt;
    const tx = e.tx + 0.5;
    const ty = e.ty + 0.5;
    const dx = tx - e.x;
    const dy = ty - e.y;
    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
      e.x = tx;
      e.y = ty;
      e.cx = e.tx;
      e.cy = e.ty;
      chooseNext(state, e);
      if (e.tx === e.cx && e.ty === e.cy) continue;
    } else {
      const step = Math.min(dist, Math.hypot(dx, dy));
      e.x += (dx / Math.hypot(dx, dy)) * step;
      e.y += (dy / Math.hypot(dx, dy)) * step;
    }
  }
}

function enemyTouchCheck(state) {
  if (!state.player.alive || state.player.immune || state.player.invuln > 0) return;
  const p = state.player;
  for (const e of state.enemies) {
    if (!e.alive || e.type === "target") continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) < 0.72) {
      damagePlayer(state);
      return;
    }
  }
}

// ---------------------------------------------------------------- damage

export function damagePlayer(state) {
  const p = state.player;
  if (!p.alive || p.immune || p.invuln > 0) return false;
  if (p.shield > 0) {
    p.shield -= 1;
    p.invuln = 72;
    state.events.push({ type: "shield_break" });
    return false;
  }
  p.alive = false;
  state.status = STATUS_LOST;
  state.events.push({ type: "death" });
  return true;
}

// ---------------------------------------------------------------- detonation

export function detonate(state, bomb) {
  const index = state.bombs.indexOf(bomb);
  if (index < 0) return;
  state.bombs.splice(index, 1);
  state.player.bombsOut = Math.max(0, state.player.bombsOut - 1);
  if (state.cascadeTick !== state.tick) {
    state.cascadeTick = state.tick;
    state.cascades += 1;
  }
  runBlast(state, bomb);
}

function runBlast(state, bomb) {
  const cells = flameCells(state.tiles, state.cols, state.rows, bomb.cx, bomb.cy, bomb.range, bomb.pierce);
  const covered = new Set(cells.map(([x, y]) => y * state.cols + x));
  const chained = [];
  let kills = 0;

  for (const [cx, cy] of cells) {
    const tile = state.tiles[cy][cx];
    if (tile === TILE_SOFT) {
      state.tiles[cy][cx] = TILE_EMPTY;
      state.stats.bricksBroken += 1;
      state.events.push({ type: "brick", cx, cy });
      revealAt(state, cx, cy);
    } else if (tile === TILE_CRACK) {
      state.tileHp[cy][cx] -= 1;
      if (state.tileHp[cy][cx] <= 0) {
        state.tiles[cy][cx] = TILE_EMPTY;
        state.stats.bricksBroken += 1;
        state.events.push({ type: "brick", cx, cy });
        revealAt(state, cx, cy);
      } else {
        state.events.push({ type: "crack", cx, cy });
      }
    }

    const other = bombAt(state, cx, cy);
    if (other && other !== bomb && !chained.includes(other)) chained.push(other);

    for (const item of state.powerups) {
      if (!item.hidden && item.cx === cx && item.cy === cy) {
        item.hidden = true;
        item.burned = true;
        state.events.push({ type: "burn", cx, cy, kind: item.kind });
      }
    }

    state.flames.push({ cx, cy, ttl: FLAME_TICKS, age: 0 });
  }

  for (const e of state.enemies) {
    if (!e.alive) continue;
    const [ecx, ecy] = cellOf(e.x, e.y);
    if (!covered.has(ecy * state.cols + ecx)) continue;
    e.hp -= 1;
    if (e.hp <= 0) {
      e.alive = false;
      state.stats.kills += 1;
      kills += 1;
      state.events.push({ type: "kill", cx: ecx, cy: ecy, enemy: e.type });
    } else {
      state.events.push({ type: "hit", cx: ecx, cy: ecy, enemy: e.type });
    }
  }

  const [pcx, pcy] = cellOf(state.player.x, state.player.y);
  if (covered.has(pcy * state.cols + pcx)) damagePlayer(state);

  state.events.push({ type: "explode", cx: bomb.cx, cy: bomb.cy, cells: cells.length });

  for (const next of chained) detonate(state, next);

  if (kills > 0) {
    state.chain += kills;
    state.chainTimer = CHAIN_WINDOW;
    state.stats.maxChain = Math.max(state.stats.maxChain, state.chain);
    state.events.push({ type: "chain", count: state.chain, gained: kills });
  }

  if (state.mode === MODE_PUZZLE && state.stats.kills === state.stats.enemiesTotal) {
    state.clearedInOneChain = state.cascades === 1;
  }
}

function revealAt(state, cx, cy) {
  for (const item of state.powerups) {
    if (item.hidden && item.cx === cx && item.cy === cy) {
      item.hidden = false;
      state.events.push({ type: "reveal", cx, cy, kind: item.kind });
    }
  }
  if (state.exit && !state.exit.revealed && state.exit.cx === cx && state.exit.cy === cy) {
    state.exit.revealed = true;
    state.events.push({ type: "reveal_exit", cx, cy });
  }
}

// ---------------------------------------------------------------- powerups

export function applyPowerup(state, kind) {
  const p = state.player;
  switch (kind) {
    case "fire":
      p.fire = Math.min(MAX_FIRE, p.fire + 1);
      break;
    case "bomb":
      p.bombMax = Math.min(MAX_BOMBS, p.bombMax + 1);
      break;
    case "speed":
      p.speedLevel = Math.min(MAX_SPEED_LEVEL, p.speedLevel + 1);
      break;
    case "kick":
      p.kick = true;
      break;
    case "remote":
      p.remote = true;
      break;
    case "pierce":
      p.pierce = true;
      break;
    case "shield":
      p.shield = Math.min(2, p.shield + 1);
      break;
    case "curse":
      p.curse = CURSE_KINDS[Math.floor(state.rng() * CURSE_KINDS.length)];
      p.curseTicks = CURSE_TICKS;
      p.feverTicks = 45;
      break;
    default:
      return false;
  }
  state.stats.powerups += 1;
  state.events.push({ type: "pickup", kind });
  return true;
}

function pickupCheck(state) {
  const p = state.player;
  if (!p.alive) return;
  const [cx, cy] = cellOf(p.x, p.y);
  for (const item of state.powerups) {
    if (item.hidden || item.burned || item.taken) continue;
    if (item.cx !== cx || item.cy !== cy) continue;
    item.taken = true;
    item.hidden = true;
    applyPowerup(state, item.kind);
  }
}

// ---------------------------------------------------------------- main tick

export function stepFrame(state) {
  if (state.status !== STATUS_PLAYING) return state;
  const dt = 1 / 60;
  state.tick += 1;

  if (state.chainTimer > 0) {
    state.chainTimer -= 1;
    if (state.chainTimer === 0) state.chain = 0;
  }

  updatePlayer(state, dt);
  updateSlides(state);

  for (const bomb of state.bombs.slice()) {
    if (bomb.waiting) {
      bomb.waitTicks += 1;
      if (bomb.waitTicks > REMOTE_HOLD_TICKS) detonate(state, bomb);
      continue;
    }
    bomb.fuse -= 1;
    if (bomb.fuse > 0) continue;
    if (bomb.remote && state.player.remote) {
      bomb.waiting = true;
      continue;
    }
    detonate(state, bomb);
  }

  for (const flame of state.flames) {
    flame.ttl -= 1;
    flame.age += 1;
  }
  state.flames = state.flames.filter((f) => f.ttl > 0);

  updateEnemies(state, dt);
  enemyTouchCheck(state);
  pickupCheck(state);

  if (state.timeLeft > 0) state.timeLeft -= 1;

  evaluateOutcome(state);
  return state;
}

function evaluateOutcome(state) {
  if (state.status !== STATUS_PLAYING) return;
  if (!state.player.alive) {
    state.status = STATUS_LOST;
    return;
  }
  const cleared = state.stats.kills >= state.stats.enemiesTotal;
  if (state.mode === MODE_PUZZLE) {
    if (cleared) finish(state, STATUS_WON);
    else if (state.timeLeft <= 0) finish(state, STATUS_LOST);
    return;
  }
  if (state.exit) {
    if (!state.exit.revealed && cleared) {
      state.exit.revealed = true;
      state.events.push({ type: "exit_open", cx: state.exit.cx, cy: state.exit.cy });
    }
    if (cleared && state.exit.revealed) {
      const [pcx, pcy] = cellOf(state.player.x, state.player.y);
      if (pcx === state.exit.cx && pcy === state.exit.cy) finish(state, STATUS_WON);
    }
  } else if (cleared && state.stats.enemiesTotal > 0) {
    finish(state, STATUS_WON);
  }
  if (state.status === STATUS_PLAYING && state.timeLeft <= 0) finish(state, STATUS_LOST);
}

function finish(state, status) {
  state.status = status;
  state.events.push({ type: status === STATUS_WON ? "win" : "timeout" });
}

export function advance(state, ms) {
  state.acc += ms;
  let guard = 0;
  while (state.acc >= TICK_MS && guard < 8) {
    state.acc -= TICK_MS;
    stepFrame(state);
    guard += 1;
  }
  if (guard >= 8) state.acc = 0;
  return state;
}

export function drainEvents(state) {
  const out = state.events;
  state.events = [];
  return out;
}

// ---------------------------------------------------------------- readouts

export function demolitionRate(state) {
  if (!state.stats.bricksTotal) return 1;
  return state.stats.bricksBroken / state.stats.bricksTotal;
}

export function remainingEnemies(state) {
  return state.stats.enemiesTotal - state.stats.kills;
}

export function timeLeftSeconds(state) {
  return Math.max(0, state.timeLeft) / (1000 / TICK_MS);
}

export function rating(state) {
  if (state.status !== STATUS_WON) return { stars: 0, timeOk: false, demoOk: false, oneChain: false, bombsUsed: state.stats.bombsUsed };
  const rate = demolitionRate(state);
  const timeOk = state.timeLeft / state.timeLimit >= 0.4;
  const demoOk = rate >= 0.9;
  if (state.mode === MODE_PUZZLE) {
    const inPar = state.stats.bombsUsed <= Math.max(1, state.par);
    const oneChain = state.clearedInOneChain && inPar;
    const stars = 1 + (inPar ? 1 : 0) + (oneChain ? 1 : 0);
    return { stars, timeOk: true, demoOk: inPar, oneChain, bombsUsed: state.stats.bombsUsed, par: state.par };
  }
  const stars = 1 + (timeOk ? 1 : 0) + (demoOk && timeOk ? 1 : 0);
  return { stars, timeOk, demoOk, oneChain: false, bombsUsed: state.stats.bombsUsed, rate };
}
