// levels.mjs — data layer for Tank Assault: terrain codes, entity tables, level parsing.
// Hard rule: this file is the data layer, so it must never contain Chinese literals.
// All display text is resolved by the UI through i18n keys.

export const GRID = 26; // the field is 26 x 26 half tiles (13 x 13 classic cells)
export const TANK_SIZE = 2; // a tank occupies 2 x 2 half tiles

export const CELL = Object.freeze({
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  TREE: 3,
  WATER: 4,
  ICE: 5,
});

// Terrain characters used by level definitions. "E" marks the top-left half tile of the base.
export const CHARS = Object.freeze({
  ".": CELL.EMPTY,
  B: CELL.BRICK,
  S: CELL.STEEL,
  T: CELL.TREE,
  W: CELL.WATER,
  I: CELL.ICE,
  E: CELL.EMPTY,
});

export const DIR = Object.freeze({ UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 });
export const DX = Object.freeze([0, 1, 0, -1]);
export const DY = Object.freeze([-1, 0, 1, 0]);
export const OPPOSITE = Object.freeze([2, 3, 0, 1]);
export const DIR_NAMES = Object.freeze(["up", "right", "down", "left"]);

// Cells a tank may drive through.
export const TANK_PASSABLE = Object.freeze([CELL.EMPTY, CELL.TREE, CELL.ICE]);
// Cells a shell may fly through (bushes and water do not stop shells).
export const SHELL_PASSABLE = Object.freeze([CELL.EMPTY, CELL.TREE, CELL.WATER, CELL.ICE]);

export const ENEMY_TYPES = Object.freeze({
  scout: {
    id: "scout",
    hp: 1,
    speed: 6.4,
    shellSpeed: 14,
    fireMin: 1.2,
    fireMax: 2.4,
    score: 100,
    aggro: 0.35,
  },
  standard: {
    id: "standard",
    hp: 1,
    speed: 4.0,
    shellSpeed: 14,
    fireMin: 0.9,
    fireMax: 2.0,
    score: 100,
    aggro: 0.45,
  },
  rapid: {
    id: "rapid",
    hp: 1,
    speed: 4.0,
    shellSpeed: 26,
    fireMin: 0.5,
    fireMax: 1.2,
    score: 200,
    aggro: 0.55,
  },
  armor: {
    id: "armor",
    hp: 4,
    speed: 3.5,
    shellSpeed: 18,
    fireMin: 0.8,
    fireMax: 1.6,
    score: 400,
    aggro: 0.6,
  },
  sapper: {
    id: "sapper",
    hp: 2,
    speed: 3.4,
    shellSpeed: 14,
    fireMin: 0.5,
    fireMax: 0.9,
    score: 300,
    aggro: 0.7,
    digger: true,
  },
  sniper: {
    id: "sniper",
    hp: 1,
    speed: 3.6,
    shellSpeed: 30,
    fireMin: 1.4,
    fireMax: 2.6,
    score: 300,
    aggro: 0.5,
    sniper: true,
  },
});

export const ENEMY_IDS = Object.freeze(Object.keys(ENEMY_TYPES));

export const POWERUPS = Object.freeze([
  "star",
  "helmet",
  "grenade",
  "shovel",
  "extra_life",
  "clock",
]);

export const ORDERS = Object.freeze(["artillery", "fortify", "jam"]);

export const MODES = Object.freeze(["campaign", "last_stand", "breakthrough"]);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  const s = String(text ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function blankTerrain() {
  return Array.from({ length: GRID }, () => ".".repeat(GRID));
}

/* ------------------------------------------------------------------ anchors */

export const BASE_SPOT = Object.freeze({ hx: 12, hy: 24 });
export const PLAYER_SPOT = Object.freeze({ hx: 8, hy: 24 });
export const ENEMY_SPOTS = Object.freeze([
  { hx: 0, hy: 0 },
  { hx: 12, hy: 0 },
  { hx: 24, hy: 0 },
]);

function key(c, r) {
  return `${c},${r}`;
}

// The ring of half tiles hugging the 2x2 base. Kept solid so the first shell never
// reaches the eagle for free.
export function baseRingCells(base = BASE_SPOT) {
  const cells = [];
  for (let r = base.hy - 1; r <= base.hy + TANK_SIZE; r += 1) {
    for (let c = base.hx - 1; c <= base.hx + TANK_SIZE; c += 1) {
      if (c >= base.hx && c < base.hx + TANK_SIZE && r >= base.hy && r < base.hy + TANK_SIZE) continue;
      if (c < 0 || c >= GRID || r < 0 || r >= GRID) continue;
      cells.push({ c, r });
    }
  }
  return cells;
}

// Half tiles that must stay open: the base pocket, its ring, and a manoeuvring pad
// around every spawn so nothing ever materialises inside a wall.
export function protectedCells() {
  const prot = new Set();
  for (const { c, r } of baseRingCells()) prot.add(key(c, r));
  for (let r = BASE_SPOT.hy; r < BASE_SPOT.hy + TANK_SIZE; r += 1) {
    for (let c = BASE_SPOT.hx; c < BASE_SPOT.hx + TANK_SIZE; c += 1) prot.add(key(c, r));
  }
  const pads = [
    { hx: PLAYER_SPOT.hx - 1, hy: PLAYER_SPOT.hy - 2, w: 4, h: 4 },
    ...ENEMY_SPOTS.map((s) => ({ hx: s.hx - 1, hy: s.hy, w: 4, h: 4 })),
  ];
  for (const pad of pads) {
    for (let r = pad.hy; r < pad.hy + pad.h; r += 1) {
      for (let c = pad.hx; c < pad.hx + pad.w; c += 1) {
        if (c < 0 || c >= GRID || r < 0 || r >= GRID) continue;
        prot.add(key(c, r));
      }
    }
  }
  return prot;
}

/* --------------------------------------------------------- terrain architect */

function blankRows() {
  return blankTerrain().map((row) => row.split(""));
}

function paint(rows, c, r, w, h, ch) {
  for (let rr = r; rr < r + h; rr += 1) {
    if (rr < 0 || rr >= GRID) continue;
    for (let cc = c; cc < c + w; cc += 1) {
      if (cc < 0 || cc >= GRID) continue;
      rows[rr][cc] = ch;
    }
  }
}

function rectOk(rows, prot, c, r, w, h, requireEmpty, symmetric) {
  const check = (c0) => {
    if (c0 < 1 || c0 + w > GRID - 1 || r < 3 || r + h > GRID - 4) return false;
    for (let rr = r; rr < r + h; rr += 1) {
      for (let cc = c0; cc < c0 + w; cc += 1) {
        if (prot.has(key(cc, rr))) return false;
        if (requireEmpty && rows[rr][cc] !== ".") return false;
      }
    }
    return true;
  };
  if (!check(c)) return false;
  if (symmetric && !check(GRID - c - w)) return false;
  return true;
}

// Stamp mirrored blocks, the way every original stage was authored. Sizes and anchors
// are snapped to the 13 x 13 classic cell lattice so brick courses line up; placement
// retries until the whole rectangle fits, so no shape is ever left half drawn.
function stamp(rng, rows, prot, spec) {
  const {
    ch,
    wMin,
    wMax,
    hMin,
    hMax,
    count = 1,
    requireEmpty = false,
    symmetric = true,
    density = 1,
  } = spec;
  for (let i = 0; i < count; i += 1) {
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const wc = wMin + Math.floor(rng() * (wMax - wMin + 1)); // width in classic cells
      const hc = hMin + Math.floor(rng() * (hMax - hMin + 1)); // height in classic cells
      const w = wc * 2;
      const h = hc * 2;
      const maxCol = symmetric ? 7 - wc : 13 - wc;
      if (maxCol < 0) continue;
      const col = Math.floor(rng() * (maxCol + 1));
      const maxRow = 11 - hc;
      if (maxRow < 2) continue;
      const rowCell = 2 + Math.floor(rng() * (maxRow - 2 + 1));
      const c = col * 2;
      const r = rowCell * 2;
      if (!rectOk(rows, prot, c, r, w, h, requireEmpty, symmetric)) continue;
      const put = (c0) => {
        for (let rr = r; rr < r + h; rr += 1) {
          for (let cc = c0; cc < c0 + w; cc += 1) {
            if (density < 1 && rng() > density) continue;
            rows[rr][cc] = ch;
          }
        }
      };
      put(c);
      if (symmetric) put(GRID - c - w);
      break;
    }
  }
}

function carveBase(rows, fortress) {
  const b = BASE_SPOT;
  paint(rows, b.hx, b.hy, TANK_SIZE, TANK_SIZE, "E");
  for (const { c, r } of baseRingCells()) rows[r][c] = "B";
  if (fortress) {
    rows[b.hy - 1][b.hx - 1] = "S";
    rows[b.hy - 1][b.hx + TANK_SIZE] = "S";
  }
}

// Deterministic stage builder. Same seed, same field, forever.
export function generateTerrain(seed, spec = {}) {
  const rng = mulberry32(seed >>> 0);
  const rows = blankRows();
  const prot = protectedCells();
  const {
    brick = 8,
    steel = 0,
    water = 0,
    tree = 0,
    ice = 0,
    fortress = false,
    symmetric = true,
  } = spec;
  carveBase(rows, fortress);
  if (water > 0) {
    stamp(rng, rows, prot, {
      ch: "W",
      wMin: 2,
      wMax: 4,
      hMin: 2,
      hMax: 3,
      count: water,
      requireEmpty: true,
      symmetric,
    });
  }
  if (ice > 0) {
    stamp(rng, rows, prot, {
      ch: "I",
      wMin: 3,
      wMax: 5,
      hMin: 2,
      hMax: 3,
      count: ice,
      requireEmpty: true,
      symmetric,
    });
  }
  if (tree > 0) {
    stamp(rng, rows, prot, {
      ch: "T",
      wMin: 2,
      wMax: 4,
      hMin: 2,
      hMax: 4,
      count: tree,
      requireEmpty: true,
      symmetric,
      density: 0.7,
    });
  }
  // Brick last among the solids so a steel block is never swallowed by a later course,
  // and steel after brick so the hard geometry always survives to be shot at.
  if (brick > 0) {
    stamp(rng, rows, prot, {
      ch: "B",
      wMin: 2,
      wMax: 5,
      hMin: 1,
      hMax: 4,
      count: brick,
      requireEmpty: true,
      symmetric,
    });
  }
  if (steel > 0) {
    stamp(rng, rows, prot, {
      ch: "S",
      wMin: 1,
      wMax: 3,
      hMin: 1,
      hMax: 2,
      count: steel,
      requireEmpty: true,
      symmetric,
    });
  }
  for (const k of prot) {
    const [c, r] = k.split(",").map(Number);
    rows[r][c] = ".";
  }
  carveBase(rows, fortress);
  return rows.map((row) => row.join(""));
}

/* ------------------------------------------------------- reachability audit */

function charValue(rows, c, r) {
  if (c < 0 || c >= GRID || r < 0 || r >= GRID) return CELL.STEEL;
  const ch = rows[r][c];
  if (ch === "E") return CELL.STEEL; // the eagle blocks tanks like a wall
  const v = CHARS[ch];
  return v === undefined ? CELL.EMPTY : v;
}

function tankFits(rows, c, r, canDig) {
  if (c < 0 || r < 0 || c + TANK_SIZE > GRID || r + TANK_SIZE > GRID) return false;
  for (let rr = r; rr < r + TANK_SIZE; rr += 1) {
    for (let cc = c; cc < c + TANK_SIZE; cc += 1) {
      const v = charValue(rows, cc, rr);
      if (v === CELL.STEEL || v === CELL.WATER) return false;
      if (v === CELL.BRICK && !canDig) return false;
    }
  }
  return true;
}

// 2x2 grid BFS: a tank is 2 x 2 half tiles, so half tile flood fill would lie.
export function tankReach(rows, start, canDig) {
  const seen = new Set();
  if (!tankFits(rows, start.hx, start.hy, canDig)) return seen;
  const queue = [start];
  seen.add(key(start.hx, start.hy));
  while (queue.length > 0) {
    const cur = queue.shift();
    for (let d = 0; d < 4; d += 1) {
      const n = { hx: cur.hx + DX[d], hy: cur.hy + DY[d] };
      const k = key(n.hx, n.hy);
      if (seen.has(k)) continue;
      if (!tankFits(rows, n.hx, n.hy, canDig)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return seen;
}

function halfTileReach(rows, start) {
  const seen = new Set();
  const k0 = key(start.hx, start.hy);
  if (charValue(rows, start.hx, start.hy) === CELL.STEEL) return seen;
  if (charValue(rows, start.hx, start.hy) === CELL.WATER) return seen;
  seen.add(k0);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (let d = 0; d < 4; d += 1) {
      const n = { hx: cur.hx + DX[d], hy: cur.hy + DY[d] };
      const k = key(n.hx, n.hy);
      if (seen.has(k)) continue;
      const v = charValue(rows, n.hx, n.hy);
      if (v === CELL.STEEL || v === CELL.WATER) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return seen;
}

// Static audit for a terrain matrix. Returns problem codes plus the numbers worth
// asserting on. canDig = true treats brick as breakable, which is the player view.
export function inspectTerrain(terrain, opts = {}) {
  const rows = Array.isArray(terrain) ? terrain.map((r) => String(r ?? "")) : [];
  const problems = [];
  if (rows.length !== GRID) {
    problems.push("bad_row_count");
    return { problems, reach: 0, islands: 0, pockets: [] };
  }
  rows.forEach((row, i) => {
    if (row.length !== GRID) problems.push(`bad_row_${i}`);
  });
  if (problems.length > 0) return { problems, reach: 0, islands: 0, pockets: [] };

  let baseCells = 0;
  rows.forEach((row) => {
    for (const ch of row) if (ch === "E") baseCells += 1;
  });
  if (baseCells !== 4) problems.push("base_not_2x2");
  const ringOpen = baseRingCells().filter(({ c, r }) => rows[r][c] === ".");
  if (ringOpen.length > 0) problems.push("base_ring_open");

  const spawns = opts.spawns ?? ENEMY_SPOTS;
  const start = opts.playerSpawn ?? PLAYER_SPOT;
  if (!tankFits(rows, start.hx, start.hy, false)) problems.push("player_spawn_blocked");

  const reach = tankReach(rows, start, true);
  if (reach.size === 0) problems.push("player_pocketed");
  spawns.forEach((s, i) => {
    if (!tankFits(rows, s.hx, s.hy, false)) problems.push(`enemy_spawn_blocked_${i}`);
    else if (!reach.has(key(s.hx, s.hy))) problems.push(`enemy_spawn_unreachable_${i}`);
  });

  // Every enemy must have room to roll without chewing through brick first.
  const pockets = spawns.map((s) => tankReach(rows, s, false).size);
  pockets.forEach((n, i) => {
    if (n < 20) problems.push(`enemy_pocket_tight_${i}`);
  });

  // No orphan pockets: water or steel must never seal off a patch of field.
  const open = halfTileReach(rows, { hx: start.hx, hy: start.hy });
  let islands = 0;
  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      const v = charValue(rows, c, r);
      if (v === CELL.STEEL || v === CELL.WATER) continue;
      if (rows[r][c] === "E") continue;
      if (!open.has(key(c, r))) islands += 1;
    }
  }
  if (islands > 0) problems.push("orphan_pocket");

  return { problems, reach: reach.size, islands, pockets };
}

// Search for a seed whose field passes the audit. Run offline; the winning seed is
// written into the level table so runtime never searches.
export function findTerrainSeed(spec, opts = {}, from = 1, tries = 4000) {
  for (let i = 0; i < tries; i += 1) {
    const seed = (from + i) >>> 0;
    const terrain = generateTerrain(seed, spec);
    const audit = inspectTerrain(terrain, opts);
    if (audit.problems.length === 0) return { seed, terrain, audit };
  }
  return null;
}

/* ------------------------------------------------------------- preset fields */

// Breakthrough stages place their tanks up front instead of trickling them in.
// Spots come from the undug reach, so a preset tank never materialises inside brick.
function pickPresetSpots(rows, rng, count) {
  const reach = [...tankReach(rows, PLAYER_SPOT, false)].map((k) => {
    const [c, r] = k.split(",").map(Number);
    return { hx: c, hy: r };
  });
  const pool = reach.filter((s) => {
    const d = Math.abs(s.hx - PLAYER_SPOT.hx) + Math.abs(s.hy - PLAYER_SPOT.hy);
    if (d < 12) return false;
    if (s.hy >= 20 && s.hx >= 8 && s.hx <= 16) return false; // never on top of the home pocket
    if (s.hy <= 3) return false; // never stacked on the enemy spawn row
    return true;
  });
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  const chosen = [];
  for (const s of pool) {
    if (chosen.length >= count) break;
    const tooClose = chosen.some(
      (o) => Math.abs(o.hx - s.hx) < 5 && Math.abs(o.hy - s.hy) < 5
    );
    if (tooClose) continue;
    chosen.push(s);
  }
  return chosen;
}

function buildEndgame(def) {
  const terrain = generateTerrain(def.seed, def.terrain);
  const rng = mulberry32((def.seed ^ 0x9e3779b9) >>> 0);
  const spots = pickPresetSpots(terrain, rng, def.preset.length);
  const preset = def.preset.map((type, i) => ({
    type,
    hx: spots[i]?.hx ?? ENEMY_SPOTS[i % ENEMY_SPOTS.length].hx,
    hy: spots[i]?.hy ?? ENEMY_SPOTS[i % ENEMY_SPOTS.length].hy,
  }));
  const hp = preset.reduce((n, p) => n + (ENEMY_TYPES[p.type]?.hp ?? 1), 0);
  return Object.freeze({
    id: def.id,
    chapter: 0,
    index: def.index,
    mode: "breakthrough",
    terrain: Object.freeze(terrain),
    playerSpawn: PLAYER_SPOT,
    enemySpawns: ENEMY_SPOTS,
    preset: Object.freeze(preset),
    total: preset.length,
    concurrent: preset.length,
    ammo: def.ammo ?? hp + 8,
    timeLimit: def.timeLimit ?? 0,
    parTime: def.parTime ?? 60,
    aggro: 0.5,
    hp,
  });
}

/* --------------------------------------------------------------- last stand */

// The endless siege runs on one fixed tray; only the garrison escalates.
export const LAST_STAND_SEED = 30011;

export const LAST_STAND_TERRAIN_SPEC = Object.freeze({
  brick: 10,
  steel: 4,
  water: 1,
  tree: 1,
  ice: 1,
  symmetric: true,
});

export const LAST_STAND = Object.freeze({
  id: "last_stand",
  chapter: 0,
  index: 0,
  mode: "last_stand",
  seed: LAST_STAND_SEED,
  terrain: Object.freeze(generateTerrain(LAST_STAND_SEED, LAST_STAND_TERRAIN_SPEC)),
  playerSpawn: PLAYER_SPOT,
  enemySpawns: ENEMY_SPOTS,
  total: 0,
  concurrent: 3,
  spawnInterval: 2.4,
  aggro: 0.35,
  types: Object.freeze(["standard"]),
  parTime: 0,
  ammo: 0,
  timeLimit: 0,
});

// Wave ladder for the endless siege. Every wave is bigger, faster and meaner; the
// count caps out so the mode stays about survival, not about arithmetic.
export function waveComposition(wave) {
  const w = Math.max(1, Math.floor(wave));
  const n = w - 1;
  const roster = ["standard", "scout"];
  if (w >= 3) roster.push("rapid");
  if (w >= 5) roster.push("armor");
  if (w >= 7) roster.push("sniper");
  if (w >= 9) roster.push("sapper");
  return Object.freeze({
    wave: w,
    count: 6 + Math.min(14, n),
    concurrent: Math.min(6, 3 + Math.floor(n / 2)),
    spawnInterval: Math.max(1.2, 2.4 - n * 0.08),
    aggro: Math.min(0.85, 0.35 + n * 0.03),
    types: Object.freeze(roster),
  });
}

/* ------------------------------------------------------------ campaign table */

const CAMPAIGN_TYPES = Object.freeze([
  ["standard", "scout"],
  ["standard", "rapid", "scout"],
  ["standard", "scout", "sniper"],
  ["rapid", "standard", "armor"],
  ["standard", "sapper", "armor", "scout"],
  ["armor", "standard", "rapid", "sniper", "sapper"],
]);

// Exported so the offline seed solver and the tests read the very same numbers the
// level table is built from. Never duplicate this table anywhere.
export function campaignTerrainSpec(chapter, index) {
  const t = index - 1;
  const spec = { symmetric: chapter <= 4 };
  switch (chapter) {
    case 1:
      return { ...spec, brick: 7 + t, steel: 0, water: 0, tree: index >= 3 ? 1 : 0, ice: 0 };
    case 2:
      return { ...spec, brick: 9 + t, steel: 2 + Math.floor(t / 2), water: 0, tree: 1, ice: 0 };
    case 3:
      return { ...spec, brick: 10 + t, steel: 3, water: 0, tree: 2 + Math.floor(t / 2), ice: 0 };
    case 4:
      return { ...spec, brick: 10 + t, steel: 3, water: 1 + Math.floor(t / 2), tree: 1, ice: 1 + Math.floor(t / 2) };
    case 5:
      return { ...spec, brick: 11 + t, steel: 4, water: 1, tree: 1, ice: 1 };
    default:
      return {
        ...spec,
        brick: 11 + t,
        steel: 5 + t,
        water: 1,
        tree: 1,
        ice: index >= 3 ? 1 : 0,
        fortress: index === 4,
      };
  }
}

function campaignLevel(chapter, index, seed) {
  const last = index === 4;
  const total = chapter === 6 && last ? 24 : last ? 22 : 20;
  const types = chapter === 6 && last ? ["armor", "standard", "armor", "rapid"] : CAMPAIGN_TYPES[chapter - 1];
  // Difficulty is driven by the global stage number, not by (chapter, index), so the
  // curve never resets when a new chapter opens.
  const n = (chapter - 1) * 4 + index - 1;
  return Object.freeze({
    id: `level_${chapter}_${index}`,
    chapter,
    index,
    mode: "campaign",
    seed,
    terrain: Object.freeze(generateTerrain(seed, campaignTerrainSpec(chapter, index))),
    playerSpawn: PLAYER_SPOT,
    enemySpawns: ENEMY_SPOTS,
    total,
    concurrent: last ? 5 : 4,
    spawnInterval: Math.max(1.6, 2.6 - n * 0.045),
    aggro: Math.min(0.8, 0.32 + n * 0.018),
    types: Object.freeze(types),
    parTime: Math.round(150 - n * 2.5),
    fortress: chapter === 6 && last,
    ammo: 0,
    timeLimit: 0,
  });
}

// Seeds below were solved offline by findTerrainSeed(): every one of these fields
// passes inspectTerrain with zero problems. Changing the architect invalidates them,
// and tests/levels.test.mjs will go red until they are re-solved.
export const CAMPAIGN_SEEDS = Object.freeze({
  level_1_1: 1110,
  level_1_2: 1120,
  level_1_3: 1130,
  level_1_4: 1140,
  level_2_1: 1210,
  level_2_2: 1220,
  level_2_3: 1230,
  level_2_4: 1240,
  level_3_1: 1310,
  level_3_2: 1320,
  level_3_3: 1330,
  level_3_4: 1340,
  level_4_1: 1410,
  level_4_2: 1420,
  level_4_3: 1430,
  level_4_4: 1440,
  level_5_1: 1510,
  level_5_2: 1520,
  level_5_3: 1530,
  level_5_4: 1540,
  level_6_1: 1610,
  level_6_2: 1620,
  level_6_3: 1630,
  level_6_4: 1640,
});

export const LEVELS = Object.freeze(
  Array.from({ length: 6 }, (_, c) =>
    Array.from({ length: 4 }, (__, i) => campaignLevel(c + 1, i + 1, CAMPAIGN_SEEDS[`level_${c + 1}_${i + 1}`]))
  ).flat()
);

export const ENDGAME_DEFS = Object.freeze([
  { id: "endgame_1", index: 1, seed: 20011, terrain: { brick: 6, steel: 4, water: 0, tree: 0, ice: 0, symmetric: true }, preset: ["standard", "scout"], parTime: 45 },
  { id: "endgame_2", index: 2, seed: 20021, terrain: { brick: 7, steel: 5, water: 0, tree: 0, ice: 0, symmetric: true }, preset: ["rapid", "rapid"], parTime: 45 },
  { id: "endgame_3", index: 3, seed: 20033, terrain: { brick: 6, steel: 3, water: 1, tree: 0, ice: 0, symmetric: true }, preset: ["standard", "standard", "scout"], parTime: 60 },
  { id: "endgame_4", index: 4, seed: 20047, terrain: { brick: 7, steel: 4, water: 0, tree: 0, ice: 1, symmetric: true }, preset: ["sniper", "standard"], parTime: 50 },
  { id: "endgame_5", index: 5, seed: 20051, terrain: { brick: 8, steel: 5, water: 0, tree: 2, ice: 0, symmetric: true }, preset: ["armor", "standard"], parTime: 55 },
  { id: "endgame_6", index: 6, seed: 20063, terrain: { brick: 7, steel: 4, water: 1, tree: 0, ice: 1, symmetric: true }, preset: ["armor", "rapid", "scout"], parTime: 70 },
  { id: "endgame_7", index: 7, seed: 20071, terrain: { brick: 9, steel: 6, water: 0, tree: 1, ice: 0, symmetric: false }, preset: ["sapper", "standard", "standard"], parTime: 70 },
  { id: "endgame_8", index: 8, seed: 20089, terrain: { brick: 9, steel: 6, water: 1, tree: 1, ice: 1, symmetric: false, fortress: true }, preset: ["armor", "armor", "sniper"], parTime: 80 },
]);

export const ENDGAMES = Object.freeze(ENDGAME_DEFS.map(buildEndgame));

// Convenience alias: the opener, which every smoke test drives.
export const LEVEL_1_1 = LEVELS[0];

export const LEVEL_COUNT = LEVELS.length;
export const ENDGAME_COUNT = ENDGAMES.length;

export function levelById(id) {
  return LEVELS.find((lv) => lv.id === id) ?? ENDGAMES.find((lv) => lv.id === id) ?? null;
}

export function endgameByIndex(index) {
  return ENDGAMES.find((lv) => lv.index === index) ?? null;
}

export function campaignByChapter(chapter) {
  return LEVELS.filter((lv) => lv.chapter === chapter);
}

/* ------------------------------------------------------------------- parsing */

// Turn a level definition into the runtime shape the engine consumes.
export function parseLevel(def) {
  const grid = new Int8Array(GRID * GRID);
  let base = null;
  const terrain = Array.isArray(def?.terrain) ? def.terrain : [];
  for (let r = 0; r < GRID; r += 1) {
    const row = typeof terrain[r] === "string" ? terrain[r] : "";
    for (let c = 0; c < GRID; c += 1) {
      const ch = row[c] ?? ".";
      if (ch === "E") {
        if (!base) base = { hx: c, hy: r };
        continue;
      }
      const value = CHARS[ch];
      grid[r * GRID + c] = value === undefined ? CELL.EMPTY : value;
    }
  }
  const preset = Array.isArray(def?.preset) ? def.preset.map((p) => ({ ...p })) : [];
  const ammo = Number.isFinite(def?.ammo) && def.ammo > 0 ? def.ammo : 0;
  const timeLimit = Number.isFinite(def?.timeLimit) && def.timeLimit > 0 ? def.timeLimit : 0;
  return {
    id: String(def?.id ?? "level"),
    mode: def?.mode ?? "campaign",
    grid,
    base: base ?? { hx: BASE_SPOT.hx, hy: BASE_SPOT.hy },
    playerSpawn: def?.playerSpawn ?? { hx: PLAYER_SPOT.hx, hy: PLAYER_SPOT.hy },
    enemySpawns:
      Array.isArray(def?.enemySpawns) && def.enemySpawns.length > 0
        ? def.enemySpawns.slice()
        : ENEMY_SPOTS.slice(),
    preset,
    total: Number.isFinite(def?.total) ? def.total : 20,
    concurrent: Number.isFinite(def?.concurrent) ? def.concurrent : 4,
    spawnInterval: Number.isFinite(def?.spawnInterval) ? def.spawnInterval : 2.6,
    aggro: Number.isFinite(def?.aggro) ? def.aggro : 0.4,
    types: Array.isArray(def?.types) ? def.types.slice() : ["standard"],
    parTime: Number.isFinite(def?.parTime) ? def.parTime : 150,
    chapter: Number.isFinite(def?.chapter) ? def.chapter : 1,
    fortress: !!def?.fortress,
    ammo,
    timeLimit,
  };
}

// Static sanity checks for a level definition. Returns a list of problem codes.
export function validateLevel(def) {
  const problems = [];
  const terrain = Array.isArray(def?.terrain) ? def.terrain : null;
  if (!terrain) {
    problems.push("no_terrain");
    return problems;
  }
  if (terrain.length !== GRID) problems.push("bad_row_count");
  terrain.forEach((row, i) => {
    if (typeof row !== "string" || row.length !== GRID) problems.push(`bad_row_${i}`);
  });
  let baseCells = 0;
  terrain.forEach((row) => {
    for (const ch of String(row)) if (ch === "E") baseCells += 1;
  });
  if (baseCells !== 4) problems.push("base_not_2x2");
  const spawns = Array.isArray(def?.enemySpawns) ? def.enemySpawns : [];
  if (spawns.length === 0) problems.push("no_enemy_spawns");
  spawns.forEach((s, i) => {
    if (!Number.isFinite(s?.hx) || !Number.isFinite(s?.hy)) problems.push(`bad_spawn_${i}`);
  });
  if (!Number.isFinite(def?.playerSpawn?.hx)) problems.push("bad_player_spawn");
  if (!Number.isFinite(def?.total) || def.total < 1) problems.push("bad_total");
  return problems;
}
