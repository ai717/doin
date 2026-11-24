// Static match configuration for Flick Duel: board variants, AI levels and safe settings.
// Strictly DOM-free data + helpers. All display text lives in i18n.mjs.

export const MODES = Object.freeze(["solo", "duel"]);
export const SIDES = Object.freeze(["south", "north"]);
export const MAX_ROUNDS = 60;
export const PUCKS_PER_SIDE = 5;

export const START = Object.freeze({
  offsets: Object.freeze([-170, -85, 0, 85, 170]),
  baselineInset: 58,
});

// Gate positions are fractions of the table width, measured on the centre seam.
export const BOARDS = Object.freeze([
  Object.freeze({ id: "board_1gate", gates: Object.freeze([0.5]), nameKey: "board1", descKey: "board1Desc" }),
  Object.freeze({ id: "board_2gate", gates: Object.freeze([0.32, 0.68]), nameKey: "board2", descKey: "board2Desc" }),
  Object.freeze({ id: "board_3gate", gates: Object.freeze([0.26, 0.5, 0.74]), nameKey: "board3", descKey: "board3Desc" }),
]);

export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: "ai_novice", nameKey: "diffNovice", aimError: 0.18, powerError: 0.26, thinkMs: 1000 }),
  Object.freeze({ id: "ai_skilled", nameKey: "diffSkilled", aimError: 0.06, powerError: 0.11, thinkMs: 850 }),
  Object.freeze({ id: "ai_master", nameKey: "diffMaster", aimError: 0.015, powerError: 0.035, thinkMs: 700 }),
]);

export const DEFAULT_SETTINGS = Object.freeze({
  mode: "solo",
  difficulty: "ai_novice",
  boardId: "board_1gate",
  humanSide: "south",
});

export function getBoard(id) {
  return BOARDS.find((board) => board.id === id) ?? BOARDS[0];
}

export function getDifficulty(id) {
  return DIFFICULTIES.find((level) => level.id === id) ?? DIFFICULTIES[0];
}

export function otherSide(side) {
  return side === "south" ? "north" : "south";
}

export function normalizeSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    mode: MODES.includes(source.mode) ? source.mode : DEFAULT_SETTINGS.mode,
    difficulty: DIFFICULTIES.some((level) => level.id === source.difficulty)
      ? source.difficulty
      : DEFAULT_SETTINGS.difficulty,
    boardId: BOARDS.some((board) => board.id === source.boardId)
      ? source.boardId
      : DEFAULT_SETTINGS.boardId,
    humanSide: SIDES.includes(source.humanSide) ? source.humanSide : DEFAULT_SETTINGS.humanSide,
  };
}

export function bestKey(settings) {
  const clean = normalizeSettings(settings);
  const difficulty = clean.mode === "duel" ? "duel" : clean.difficulty;
  return `${clean.mode}_${difficulty}_${clean.boardId}_${clean.humanSide}`;
}
