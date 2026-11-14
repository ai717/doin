// Static tuning data for Starport Siege. Data layer is language free:
// every display string lives in i18n.mjs and is looked up by key.

export const VIEW_W = 1000;
export const VIEW_H = 750;

export const COLS = 11;
export const ROWS = 5;
export const COL_W = 62;
export const ROW_H = 48;
export const FORMATION_BASE_X = (VIEW_W - COLS * COL_W) / 2; // 159
export const FORMATION_BASE_Y = 96;
export const FORMATION_MARGIN = 34;

export const STEP_X = 26;
export const STEP_Y = 18;

export const TURRET_Y = 682;
export const TURRET_W = 112;
export const TURRET_H = 30;
export const TURRET_SPEED = 520;

export const RED_LINE_Y = 618;
export const BARRICADE_Y = 516;
export const BARRICADE_W = 128;
export const BARRICADE_H = 72;
export const BARRICADE_CELL = 8;
export const BARRICADE_COLS = BARRICADE_W / BARRICADE_CELL; // 16
export const BARRICADE_ROWS = BARRICADE_H / BARRICADE_CELL; // 9 (rounded down)

export const BULLET_SPEED = 1150;
export const ENEMY_BULLET_SPEED = 300;
export const MAX_PLAYER_BULLETS = 2;
export const MAX_ENEMY_BULLETS = 8;
export const SHOT_COOLDOWN = 0.18;
// Heat is balanced against the bullet cap: two shells in flight at this speed
// caps holding the trigger at ~3.2 shots/s, while the gauge only sinks ~2.2/s.
// So a tapping rhythm never locks the gun, but holding it burns out in ~5s.
export const HEAT_PER_SHOT = 0.2;
export const HEAT_DECAY = 0.45;
export const OVERHEAT_LOCK = 0.9;
export const FIRE_BUFFER = 0.25;
export const RAIL_CHARGE = 0.6;
export const RAIL_HEAT = 0.4;
export const RAIL_HEAT_GATE = 0.6;
export const RAIL_HALF_W = 15;

export const DIVE_ARC_TIME = 1.4;
export const DIVE_ARC_SPEED = 190;
export const DIVE_DASH_SPEED = 700;
export const MAX_DIVERS = 2;
export const DIVE_SAFE_MARGIN = 26;

export const MOD_DURATION = 8;
export const MOD_DROP_CHANCE = 0.14;
export const PICKUP_SPEED = 150;

export const INTRO_TIME = 1.2;
export const CLEAR_TIME = 1.0;
export const INVULN_TIME = 1.1;

export const ENEMY_TYPES = {
  grunt: { hp: 1, score: 10, size: 34, diveWeight: 1, lead: 0.12 },
  crusher: { hp: 1, score: 20, size: 36, diveWeight: 3, lead: 0.12 },
  squid: { hp: 2, score: 30, size: 34, diveWeight: 1.4, lead: 0.34 },
  swarm: { hp: 1, score: 15, size: 34, diveWeight: 1, lead: 0.12, onDeath: "swarm" },
  bulwark: { hp: 2, score: 40, size: 40, diveWeight: 0.4, lead: 0.1, shield: true },
  splitter: { hp: 2, score: 25, size: 38, diveWeight: 0.8, lead: 0.12, onDeath: "split" },
  phantom: { hp: 2, score: 50, size: 34, diveWeight: 1.2, lead: 0.2, cloak: true },
  spawn: { hp: 1, score: 5, size: 24, diveWeight: 1, lead: 0.1 },
  mothership: { hp: 20, score: 1000, size: 132, diveWeight: 0, lead: 0 },
};

export const SHIELD_CYCLE = 2.4;
export const SHIELD_OPEN = 0.9;
export const CLOAK_CYCLE = 3.0;
export const CLOAK_HIDDEN = 1.2;

export const MOD_TYPES = {
  mod_spread: { heat: 1.3 },
  mod_shield: { blocks: 1 },
  mod_slowfield: { factor: 0.6 },
  mod_magrail: { pull: 260 },
};

export const MOD_KEYS = Object.keys(MOD_TYPES);
export const MOD_BOUNTY = [50, 100, 300];

// Formation masks: 5 rows of 11 cells.
export const MASKS = {
  classic: [
    "###########",
    "###########",
    "###########",
    "###########",
    "###########",
  ],
  wedge: [
    "###########",
    ".#########.",
    "..#######..",
    "...#####...",
    "....###....",
  ],
  columns: [
    "#.#.#.#.#.#",
    "#.#.#.#.#.#",
    "#.#.#.#.#.#",
    "#.#.#.#.#.#",
    "#.#.#.#.#.#",
  ],
  checker: [
    "#.#.#.#.#.#",
    ".#.#.#.#.#.",
    "#.#.#.#.#.#",
    ".#.#.#.#.#.",
    "#.#.#.#.#.#",
  ],
  twin: [
    "###.....###",
    "###.....###",
    "###.....###",
    "###.....###",
    "###.....###",
  ],
  arc: [
    "..#######..",
    ".#########.",
    "###########",
    ".#########.",
    "..#######..",
  ],
  fortress: [
    "###########",
    "#.........#",
    "#.#######.#",
    "#.........#",
    "##.......##",
  ],
  sparse: [
    "##.......##",
    "..##...##..",
    "....###....",
    "..##...##..",
    "##.......##",
  ],
  // Compact masks: they leave the outer rows empty, so the block starts higher
  // and the player gets noticeably more room before the fleet reaches the line.
  phalanx: [
    "...........",
    "...#####...",
    "..#######..",
    "...#####...",
    "...........",
  ],
  patrol: [
    "...........",
    ".#########.",
    "..#######..",
    ".#########.",
    "...........",
  ],
  crest: [
    "....###....",
    "..#######..",
    ".#########.",
    "..#######..",
    "....###....",
  ],
  ladder: [
    "#.#.#.#.#.#",
    "...........",
    "#.#.#.#.#.#",
    "...........",
    "#.#.#.#.#.#",
  ],
};

export function maskCells(name) {
  const mask = MASKS[name] ?? MASKS.classic;
  const cells = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (mask[row][col] === "#") cells.push({ row, col });
    }
  }
  return cells;
}
