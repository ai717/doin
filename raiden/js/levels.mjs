// Hand-authored stage data for Raiden Lite. Pure data, no presentation strings.
// All coordinates live in the fixed 540 x 900 portrait stage.

export const STAGE_W = 540;
export const STAGE_H = 900;
export const STAGE_COUNT = 6;

export const ENEMIES = {
  drone: { hp: 2, r: 15, speed: 125, score: 100 },
  zigzag: { hp: 3, r: 15, speed: 100, score: 150 },
  gunner: { hp: 6, r: 19, speed: 135, holdY: 230, hold: 5.2, fireEvery: 1.5, score: 250 },
  heavy: { hp: 14, r: 26, speed: 72, holdY: 190, hold: 7.5, fireEvery: 2.2, score: 400 },
};

function wave(t, type, count, form, x = 270, gap = 84, delay = 0.18) {
  return { t, type, count, form, x, gap, delay };
}

export const STAGES = [
  {
    id: "stage_1",
    theme: "cloud",
    nameKey: "stageCloud",
    boss: { hp: 90, patterns: ["fan"] },
    waves: [
      wave(0.8, "drone", 5, "line", 270, 82),
      wave(3.0, "drone", 4, "v", 270, 92),
      wave(5.4, "zigzag", 4, "line", 270, 104),
      wave(7.8, "drone", 6, "sides", 0, 120),
      wave(10.4, "gunner", 2, "sides", 0, 0),
      wave(13.2, "zigzag", 6, "line", 270, 76),
      wave(16.2, "drone", 5, "column", 270, 0, 0.22),
      wave(19.4, "gunner", 3, "line", 270, 140),
      wave(22.8, "heavy", 1, "line", 270, 0),
    ],
  },
  {
    id: "stage_2",
    theme: "canyon",
    nameKey: "stageCanyon",
    boss: { hp: 115, patterns: ["ring", "fan"] },
    waves: [
      wave(0.8, "zigzag", 5, "line", 270, 88),
      wave(3.2, "drone", 6, "sides", 0, 118),
      wave(5.8, "gunner", 2, "sides", 0, 0),
      wave(8.6, "zigzag", 6, "line", 270, 78),
      wave(11.4, "drone", 5, "v", 270, 94),
      wave(14.2, "gunner", 3, "line", 270, 136),
      wave(17.0, "heavy", 1, "line", 270, 0),
      wave(20.0, "zigzag", 8, "sides", 0, 96),
      wave(23.4, "gunner", 2, "sides", 0, 0),
      wave(26.2, "drone", 6, "column", 270, 0, 0.2),
    ],
  },
  {
    id: "stage_3",
    theme: "city",
    nameKey: "stageCity",
    boss: { hp: 140, patterns: ["ring", "spiral"] },
    waves: [
      wave(0.8, "drone", 6, "line", 270, 78),
      wave(3.0, "gunner", 3, "line", 270, 134),
      wave(5.8, "heavy", 1, "line", 270, 0),
      wave(8.4, "zigzag", 6, "sides", 0, 96),
      wave(11.2, "gunner", 2, "sides", 0, 0),
      wave(14.0, "drone", 8, "sides", 0, 112),
      wave(16.8, "heavy", 2, "sides", 0, 0),
      wave(19.8, "zigzag", 8, "line", 270, 72),
      wave(22.8, "gunner", 3, "line", 270, 140),
      wave(25.8, "drone", 6, "column", 270, 0, 0.18),
    ],
  },
  {
    id: "stage_4",
    theme: "station",
    nameKey: "stageStation",
    boss: { hp: 165, patterns: ["fan", "spiral"] },
    waves: [
      wave(0.8, "gunner", 3, "line", 270, 140),
      wave(3.4, "zigzag", 6, "line", 270, 80),
      wave(6.0, "heavy", 1, "line", 270, 0),
      wave(8.6, "drone", 8, "sides", 0, 110),
      wave(11.4, "gunner", 2, "sides", 0, 0),
      wave(14.2, "zigzag", 8, "line", 270, 68),
      wave(17.0, "heavy", 2, "sides", 0, 0),
      wave(20.0, "drone", 6, "v", 270, 88),
      wave(22.8, "gunner", 3, "line", 270, 132),
      wave(25.6, "zigzag", 8, "sides", 0, 94),
      wave(28.4, "drone", 6, "column", 270, 0, 0.16),
    ],
  },
  {
    id: "stage_5",
    theme: "aurora",
    nameKey: "stageAurora",
    boss: { hp: 190, patterns: ["ring", "spiral", "fan"] },
    waves: [
      wave(0.8, "zigzag", 6, "line", 270, 76),
      wave(3.2, "heavy", 1, "line", 270, 0),
      wave(5.8, "drone", 8, "sides", 0, 108),
      wave(8.6, "gunner", 3, "line", 270, 128),
      wave(11.4, "zigzag", 8, "sides", 0, 92),
      wave(14.2, "heavy", 2, "sides", 0, 0),
      wave(17.2, "drone", 6, "v", 270, 82),
      wave(20.0, "gunner", 3, "line", 270, 136),
      wave(22.8, "zigzag", 8, "line", 270, 66),
      wave(25.6, "heavy", 2, "line", 270, 150),
      wave(28.4, "drone", 6, "column", 270, 0, 0.15),
    ],
  },
  {
    id: "stage_6",
    theme: "mothership",
    nameKey: "stageMothership",
    boss: { hp: 220, patterns: ["spiral", "ring", "cross"] },
    waves: [
      wave(0.8, "gunner", 4, "line", 270, 118),
      wave(3.4, "zigzag", 8, "sides", 0, 92),
      wave(6.2, "heavy", 2, "sides", 0, 0),
      wave(9.0, "drone", 8, "sides", 0, 104),
      wave(11.8, "gunner", 3, "line", 270, 132),
      wave(14.6, "zigzag", 8, "line", 270, 64),
      wave(17.4, "heavy", 2, "line", 270, 148),
      wave(20.2, "drone", 8, "v", 270, 78),
      wave(23.0, "gunner", 4, "sides", 0, 0),
      wave(25.8, "zigzag", 8, "sides", 0, 88),
      wave(28.6, "heavy", 3, "line", 270, 140),
      wave(31.4, "drone", 8, "column", 270, 0, 0.14),
    ],
  },
];

export const TRAINING = {
  id: "training",
  nameKey: "modeTraining",
  duration: 60,
  interval: 1.5,
  patterns: ["ring", "fan", "spiral", "cross"],
  grazeTwo: 60,
  grazeThree: 120,
};

export function getStage(index) {
  const safe = Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(Number(index) || 0)));
  return STAGES[safe];
}

export function stageId(index) {
  return getStage(index).id;
}

export function stageIndexOf(id) {
  const index = STAGES.findIndex((stage) => stage.id === id);
  return index < 0 ? 0 : index;
}

// Wave layout resolves to spawn slots without depending on rendering.
export function waveSlots(spec) {
  const { count, form, x, gap, delay } = spec;
  const slots = [];
  for (let i = 0; i < count; i += 1) {
    const centered = i - (count - 1) / 2;
    let sx = x;
    let delayScale = 1;
    if (form === "line") sx = x + centered * gap;
    else if (form === "v") {
      sx = x + centered * gap;
      delayScale = 1 + Math.abs(centered) * 0.35;
    } else if (form === "column") {
      sx = x;
      delayScale = i + 1;
    } else if (form === "sides") {
      sx = i % 2 === 0 ? 82 + (i >> 1) * (gap || 36) : STAGE_W - 82 - (i >> 1) * (gap || 36);
      delayScale = Math.floor(i / 2) + 1;
    }
    slots.push({ x: Math.max(28, Math.min(STAGE_W - 28, sx)), at: i * delay * delayScale });
  }
  return slots;
}
