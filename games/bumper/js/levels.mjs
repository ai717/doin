/**
 * @file games/bumper/js/levels.mjs
 * 23 levels across 5 acts for single player bumper ladder.
 * Zero hardcoded Chinese strings in source code (keys only).
 */

export const LEVELS = [
  // ==========================================
  // ACT 1: Circular Arena (5 levels) - Standard Ground
  // ==========================================
  {
    id: 1,
    act: 1,
    key: 'level_1',
    aiNameKey: 'ai_1',
    aiStrategy: 'steady',
    aiAimTolerance: 0.42,
    aiReactionTime: 0.22,
    friction: 2.4,
    shrinkDelay: 16.0,
    pegs: [],
    platformSpin: 0,
  },
  {
    id: 2,
    act: 1,
    key: 'level_2',
    aiNameKey: 'ai_2',
    aiStrategy: 'steady',
    aiAimTolerance: 0.38,
    aiReactionTime: 0.19,
    friction: 2.4,
    shrinkDelay: 16.0,
    pegs: [],
    platformSpin: 0,
  },
  {
    id: 3,
    act: 1,
    key: 'level_3',
    aiNameKey: 'ai_3',
    aiStrategy: 'aggressive',
    aiAimTolerance: 0.45,
    aiReactionTime: 0.17,
    friction: 2.4,
    shrinkDelay: 15.0,
    pegs: [],
    platformSpin: 0,
  },
  {
    id: 4,
    act: 1,
    key: 'level_4',
    aiNameKey: 'ai_4',
    aiStrategy: 'tactical',
    aiAimTolerance: 0.32,
    aiReactionTime: 0.16,
    friction: 2.4,
    shrinkDelay: 15.0,
    pegs: [],
    platformSpin: 0,
  },
  {
    id: 5,
    act: 1,
    key: 'level_5',
    aiNameKey: 'ai_5',
    aiStrategy: 'aggressive',
    aiAimTolerance: 0.36,
    aiReactionTime: 0.15,
    friction: 2.4,
    shrinkDelay: 14.0,
    pegs: [],
    platformSpin: 0,
  },

  // ==========================================
  // ACT 2: Cracked Glacier (4 levels) - Low Friction Ice
  // ==========================================
  {
    id: 6,
    act: 2,
    key: 'level_6',
    aiNameKey: 'ai_6',
    aiStrategy: 'steady',
    aiAimTolerance: 0.36,
    aiReactionTime: 0.16,
    friction: 0.85, // Slippery ice
    shrinkDelay: 15.0,
    pegs: [],
    platformSpin: 0,
  },
  {
    id: 7,
    act: 2,
    key: 'level_7',
    aiNameKey: 'ai_7',
    aiStrategy: 'aggressive',
    aiAimTolerance: 0.40,
    aiReactionTime: 0.15,
    friction: 0.85,
    shrinkDelay: 14.0,
    pegs: [],
    platformSpin: 0,
  },
  {
    id: 8,
    act: 2,
    key: 'level_8',
    aiNameKey: 'ai_8',
    aiStrategy: 'tactical',
    aiAimTolerance: 0.30,
    aiReactionTime: 0.14,
    friction: 0.8,
    shrinkDelay: 14.0,
    pegs: [],
    platformSpin: 0,
  },
  {
    id: 9,
    act: 2,
    key: 'level_9',
    aiNameKey: 'ai_9',
    aiStrategy: 'aggressive',
    aiAimTolerance: 0.34,
    aiReactionTime: 0.13,
    friction: 0.8,
    shrinkDelay: 13.0,
    pegs: [],
    platformSpin: 0,
  },

  // ==========================================
  // ACT 3: Pinball Carnival (5 levels) - Bouncy Bumpers
  // ==========================================
  {
    id: 10,
    act: 3,
    key: 'level_10',
    aiNameKey: 'ai_10',
    aiStrategy: 'steady',
    aiAimTolerance: 0.34,
    aiReactionTime: 0.15,
    friction: 2.2,
    shrinkDelay: 15.0,
    pegs: [
      { x: 400, y: 150, r: 18 },
      { x: 400, y: 330, r: 18 },
    ],
    platformSpin: 0,
  },
  {
    id: 11,
    act: 3,
    key: 'level_11',
    aiNameKey: 'ai_11',
    aiStrategy: 'aggressive',
    aiAimTolerance: 0.38,
    aiReactionTime: 0.14,
    friction: 2.2,
    shrinkDelay: 15.0,
    pegs: [
      { x: 400, y: 175, r: 18 },
      { x: 400, y: 305, r: 18 },
    ],
    platformSpin: 0,
  },
  {
    id: 12,
    act: 3,
    key: 'level_12',
    aiNameKey: 'ai_12',
    aiStrategy: 'tactical',
    aiAimTolerance: 0.28,
    aiReactionTime: 0.13,
    friction: 2.2,
    shrinkDelay: 14.0,
    pegs: [
      { x: 400, y: 240, r: 24 }, // Center giant bumper
    ],
    platformSpin: 0,
  },
  {
    id: 13,
    act: 3,
    key: 'level_13',
    aiNameKey: 'ai_13',
    aiStrategy: 'aggressive',
    aiAimTolerance: 0.32,
    aiReactionTime: 0.13,
    friction: 2.2,
    shrinkDelay: 14.0,
    pegs: [
      { x: 330, y: 170, r: 16 },
      { x: 470, y: 170, r: 16 },
      { x: 330, y: 310, r: 16 },
      { x: 470, y: 310, r: 16 },
    ],
    platformSpin: 0,
  },
  {
    id: 14,
    act: 3,
    key: 'level_14',
    aiNameKey: 'ai_14',
    aiStrategy: 'tactical',
    aiAimTolerance: 0.26,
    aiReactionTime: 0.12,
    friction: 2.0,
    shrinkDelay: 13.0,
    pegs: [
      { x: 400, y: 170, r: 18 },
      { x: 400, y: 310, r: 18 },
      { x: 355, y: 240, r: 16 },
      { x: 445, y: 240, r: 16 },
    ],
    platformSpin: 0,
  },

  // ==========================================
  // ACT 4: Gear Steam Workshop (5 levels) - Rotating Platforms
  // ==========================================
  {
    id: 15,
    act: 4,
    key: 'level_15',
    aiNameKey: 'ai_15',
    aiStrategy: 'steady',
    aiAimTolerance: 0.32,
    aiReactionTime: 0.14,
    friction: 2.2,
    shrinkDelay: 14.0,
    pegs: [],
    platformSpin: 0.25, // Gentle clockwise rotation drift
  },
  {
    id: 16,
    act: 4,
    key: 'level_16',
    aiNameKey: 'ai_16',
    aiStrategy: 'aggressive',
    aiAimTolerance: 0.35,
    aiReactionTime: 0.13,
    friction: 2.2,
    shrinkDelay: 14.0,
    pegs: [],
    platformSpin: -0.3, // Counter-clockwise
  },
  {
    id: 17,
    act: 4,
    key: 'level_17',
    aiNameKey: 'ai_17',
    aiStrategy: 'tactical',
    aiAimTolerance: 0.26,
    aiReactionTime: 0.12,
    friction: 2.0,
    shrinkDelay: 13.0,
    pegs: [
      { x: 400, y: 240, r: 20 },
    ],
    platformSpin: 0.35,
  },
  {
    id: 18,
    act: 4,
    key: 'level_18',
    aiNameKey: 'ai_18',
    aiStrategy: 'aggressive',
    aiAimTolerance: 0.30,
    aiReactionTime: 0.12,
    friction: 2.0,
    shrinkDelay: 12.0,
    pegs: [
      { x: 340, y: 240, r: 18 },
      { x: 460, y: 240, r: 18 },
    ],
    platformSpin: -0.4,
  },
  {
    id: 19,
    act: 4,
    key: 'level_19',
    aiNameKey: 'ai_19',
    aiStrategy: 'tactical',
    aiAimTolerance: 0.24,
    aiReactionTime: 0.11,
    friction: 2.0,
    shrinkDelay: 12.0,
    pegs: [
      { x: 400, y: 160, r: 18 },
      { x: 400, y: 320, r: 18 },
    ],
    platformSpin: 0.45,
  },

  // ==========================================
  // ACT 5: Lava Core (4 levels) - Fast Shrinking Arena
  // ==========================================
  {
    id: 20,
    act: 5,
    key: 'level_20',
    aiNameKey: 'ai_20',
    aiStrategy: 'steady',
    aiAimTolerance: 0.28,
    aiReactionTime: 0.12,
    friction: 2.2,
    shrinkDelay: 9.0, // Fast shrink
    pegs: [],
    platformSpin: 0,
  },
  {
    id: 21,
    act: 5,
    key: 'level_21',
    aiNameKey: 'ai_21',
    aiStrategy: 'aggressive',
    aiAimTolerance: 0.28,
    aiReactionTime: 0.11,
    friction: 2.0,
    shrinkDelay: 8.0,
    pegs: [
      { x: 400, y: 240, r: 20 },
    ],
    platformSpin: 0.2,
  },
  {
    id: 22,
    act: 5,
    key: 'level_22',
    aiNameKey: 'ai_22',
    aiStrategy: 'tactical',
    aiAimTolerance: 0.22,
    aiReactionTime: 0.10,
    friction: 1.8,
    shrinkDelay: 7.5,
    pegs: [
      { x: 350, y: 240, r: 16 },
      { x: 450, y: 240, r: 16 },
    ],
    platformSpin: -0.3,
  },
  {
    id: 23,
    act: 5,
    key: 'level_23',
    aiNameKey: 'ai_23',
    aiStrategy: 'tactical',
    aiAimTolerance: 0.20,
    aiReactionTime: 0.09,
    friction: 1.6,
    shrinkDelay: 6.5,
    pegs: [
      { x: 400, y: 240, r: 22 },
    ],
    platformSpin: 0.35,
  },
];

/**
 * 按 ID 获取关卡配置
 */
export function getLevelById(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}
