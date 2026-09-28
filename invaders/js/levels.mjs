// Level / wave choreography. Everything here is hand authored and deterministic:
// no random generation is used to build a stage, so every stage is 100% clearable
// and identical on every replay.

const G = "grunt";
const C = "crusher";
const Q = "squid";
const W = "swarm";
const B = "bulwark";
const S = "splitter";
const P = "phantom";

// wave = { mask, rows:[top..bottom], speed, dive, fire, mothership? }
function wave(mask, rows, speed, dive, fire, mothership = null) {
  return { mask, rows, speed, dive, fire, mothership };
}

// Difficulty curve: `fire` is divided by `speed` inside the engine, so the
// effective interval is roughly fire/speed -- it runs from ~3.6s on level 1
// down to ~1.6s on level 12. `dive` is scaled by the surviving ratio.
export const LEVELS = [
  {
    id: 1,
    par: 58,
    waves: [
      wave("wedge", [G, G, G, G, G], 0.8, 8.5, 2.9),
      wave("phalanx", [G, G, C, C, C], 0.85, 7.6, 2.9),
      wave("twin", [G, G, G, C, C], 0.9, 6.8, 2.9),
    ],
  },
  {
    id: 2,
    par: 60,
    waves: [
      wave("twin", [G, G, Q, Q, C], 0.95, 6.6, 3.05, { hp: 8, delay: 10, count: 1 }),
      wave("checker", [G, Q, G, Q, C], 1.0, 6.0, 3.05),
      wave("phalanx", [Q, G, C, C, C], 1.05, 5.4, 3.05),
    ],
  },
  {
    id: 3,
    par: 62,
    waves: [
      wave("crest", [Q, Q, G, C, C], 1.1, 5.2, 3.2, { hp: 8, delay: 8, count: 1 }),
      wave("phalanx", [G, Q, Q, C, C], 1.15, 4.8, 3.2),
      wave("fortress", [Q, G, G, Q, C], 1.2, 4.4, 3.2),
    ],
  },
  {
    id: 4,
    boss: true,
    par: 84,
    waves: [
      wave("checker", [G, Q, G, C, C], 1.2, 4.6, 3.0),
      wave("wedge", [Q, Q, C, C, C], 1.25, 4.1, 3.0),
      wave("phalanx", [G, C, C, C, C], 1.1, 4.9, 2.75, { hp: 20, boss: true, delay: 3, count: 1 }),
    ],
  },
  {
    id: 5,
    par: 64,
    waves: [
      wave("phalanx", [G, Q, B, Q, C], 1.2, 4.6, 2.8, { hp: 10, delay: 9, count: 1 }),
      wave("fortress", [Q, B, G, W, C], 1.25, 4.3, 2.9),
      wave("patrol", [B, G, Q, W, C], 1.3, 4.2, 2.9),
    ],
  },
  {
    id: 6,
    par: 66,
    waves: [
      wave("fortress", [B, Q, G, W, C], 1.3, 4.3, 2.9, { hp: 10, delay: 8, count: 1 }),
      wave("ladder", [Q, W, G, B, C], 1.35, 4.2, 3.0),
      wave("patrol", [W, B, Q, G, C], 1.4, 4.1, 3.0),
    ],
  },
  {
    id: 7,
    par: 68,
    waves: [
      wave("patrol", [B, W, Q, C, C], 1.4, 4.1, 2.95, { hp: 12, delay: 8, count: 1 }),
      wave("checker", [Q, B, W, G, C], 1.45, 4.0, 3.0),
      wave("ladder", [W, Q, B, C, C], 1.5, 3.8, 3.0),
    ],
  },
  {
    id: 8,
    boss: true,
    par: 92,
    waves: [
      wave("checker", [Q, B, W, C, C], 1.4, 4.1, 2.8),
      wave("fortress", [B, W, Q, C, C], 1.45, 4.0, 2.85),
      wave("ladder", [G, G, C, C, C], 1.2, 3.8, 2.4, { hp: 28, boss: true, delay: 3, count: 1 }),
    ],
  },
  {
    id: 9,
    par: 70,
    waves: [
      wave("crest", [S, Q, B, W, C], 1.45, 3.8, 2.75, { hp: 12, delay: 8, count: 1 }),
      wave("ladder", [P, S, Q, B, C], 1.5, 3.7, 2.8),
      wave("phalanx", [S, P, W, C, C], 1.55, 3.5, 2.8),
    ],
  },
  {
    id: 10,
    par: 72,
    waves: [
      wave("phalanx", [P, S, B, W, C], 1.55, 3.7, 2.8, { hp: 14, delay: 7, count: 1 }),
      wave("fortress", [S, B, P, Q, C], 1.6, 3.5, 2.8),
      wave("patrol", [B, P, S, W, C], 1.65, 3.4, 2.8),
    ],
  },
  {
    id: 11,
    par: 74,
    waves: [
      wave("ladder", [P, B, S, W, C], 1.65, 3.5, 2.8, { hp: 14, delay: 7, count: 1 }),
      wave("phalanx", [B, P, S, Q, C], 1.7, 3.4, 2.8),
      wave("checker", [S, W, P, B, C], 1.75, 3.3, 2.8),
    ],
  },
  {
    id: 12,
    boss: true,
    par: 108,
    waves: [
      wave("fortress", [B, P, S, W, C], 1.7, 3.4, 2.7),
      wave("ladder", [P, B, S, Q, C], 1.75, 3.3, 2.7),
      wave("phalanx", [G, G, C, C, C], 1.4, 3.1, 2.25, { hp: 40, boss: true, delay: 3, count: 1 }),
    ],
  },
];

export const TRAINING = [
  {
    id: 101,
    hint: "trainingHint1",
    par: 0,
    training: true,
    waves: [wave("wedge", [G, G, G, G, G], 0.8, 0, 0)],
  },
  {
    id: 102,
    hint: "trainingHint2",
    par: 0,
    training: true,
    waves: [wave("arc", [C, C, C, C, C], 0.9, 2.2, 0)],
  },
  {
    id: 103,
    hint: "trainingHint3",
    par: 0,
    training: true,
    waves: [wave("columns", [B, B, B, B, B], 0.85, 0, 0)],
  },
];

const SURVIVAL_MASKS = ["classic", "checker", "arc", "twin", "fortress", "sparse", "columns"];
const SURVIVAL_ROWS = [
  [G, G, Q, Q, C],
  [Q, B, G, W, C],
  [B, W, Q, C, C],
  [S, P, B, W, C],
  [P, B, S, Q, C],
];

export function survivalWave(index) {
  const step = Math.max(0, index - 1);
  const mask = SURVIVAL_MASKS[step % SURVIVAL_MASKS.length];
  const rows = SURVIVAL_ROWS[Math.min(SURVIVAL_ROWS.length - 1, Math.floor(step / 2))];
  const speed = 1.0 + step * 0.07;
  const dive = Math.max(1.7, 5.0 - step * 0.22);
  const fire = Math.max(1.9, 3.4 - step * 0.1);
  const mothership = index > 0 && index % 5 === 0 ? { hp: 10 + step, delay: 6, count: 1 } : null;
  return wave(mask, rows, speed, dive, fire, mothership);
}

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function trainingById(id) {
  return TRAINING.find((level) => level.id === id) ?? TRAINING[0];
}

export const TOTAL_LEVELS = LEVELS.length;
export const TOTAL_STARS = LEVELS.length * 3;
