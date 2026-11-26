// Goalkeeper and striker decision policies. Pure functions: all randomness
// arrives as a pre-drawn array from the engine, so every choice is replayable.

const CORNERS = [0, 2, 6, 8];

function weightedZone(weights, value) {
  let total = 0;
  for (const weight of weights) total += weight;
  let cursor = value * total;
  for (let i = 0; i < weights.length; i += 1) {
    cursor -= weights[i];
    if (cursor < 0) return i;
  }
  return weights.length - 1;
}

// Novice reads nothing. Skilled and master keep a per-shooter frequency count
// of earlier zones; master sharpens the bias and favours the corners.
export function chooseDive(state, draws = []) {
  const first = draws[0] ?? 0.5;
  const second = draws[1] ?? 0.5;
  if (!state.difficulty || state.difficulty === "ai_novice") {
    return { zone: Math.min(8, Math.floor(first * 9)) };
  }
  const weights = Array(9).fill(1);
  for (const shot of state.shots) {
    if (shot.shooter !== state.shooter || shot.suddenDeath) continue;
    weights[shot.zone] += state.difficulty === "ai_master" ? 3 : 1.5;
  }
  if (state.difficulty === "ai_master") {
    for (const corner of CORNERS) weights[corner] += 1;
  }
  const noise = state.difficulty === "ai_master" ? 0.12 : 0.3;
  for (let i = 0; i < 9; i += 1) weights[i] = weights[i] * (1 - noise) + noise;
  return { zone: weightedZone(weights, second) };
}

// AI striker: novice spreads evenly and taps, skilled varies angles and pace,
// master hunts corners and mixes all three power levels.
export function chooseShot(state, draws = []) {
  const a = draws[0] ?? 0.5;
  const b = draws[1] ?? 0.5;
  const c = draws[2] ?? 0.5;
  if (!state.difficulty || state.difficulty === "ai_novice") {
    return {
      zone: Math.min(8, Math.floor(a * 9)),
      power: b < 0.7 ? "tap" : "drive",
    };
  }
  if (state.difficulty === "ai_skilled") {
    return {
      zone: b < 0.5 ? CORNERS[Math.min(3, Math.floor(a * 4))] : Math.min(8, Math.floor(a * 9)),
      power: c < 0.6 ? "drive" : c < 0.85 ? "tap" : "blast",
    };
  }
  return {
    zone: CORNERS[Math.min(3, Math.floor(a * 4))],
    power: c < 0.35 ? "blast" : c < 0.8 ? "drive" : "tap",
  };
}
