/**
 * @file games/airpuck/js/levels.mjs
 * 22 关单人天梯街机联赛配置（5/4/4/5/4 阶梯结构）。
 * 严格遵循 DOM-Free 与零硬编码中文字符串契约（全语言由 i18n 键化）。
 */

export const ACT_CONFIGS = [
  { id: 1, key: 'act_classic', stageCount: 5, bgTheme: 'classic' },
  { id: 2, key: 'act_ice', stageCount: 4, bgTheme: 'ice' },
  { id: 3, key: 'act_neon', stageCount: 4, bgTheme: 'neon' },
  { id: 4, key: 'act_magnetic', stageCount: 5, bgTheme: 'magnetic' },
  { id: 5, key: 'act_void', stageCount: 4, bgTheme: 'void' },
];

export const LEVELS = [
  // ==========================================
  // ACT 1: 经典电玩街机厅 (5 关: Level 1 ~ 5)
  // 标准球台，熟悉全向移动、接球推击与死角切球
  // ==========================================
  {
    id: 1,
    act: 1,
    key: 'level_1',
    nameKey: 'rival_apprentice',
    targetScore: 5,
    targetSeconds: 75,
    ai: {
      speed: 260,
      reactionDelay: 0.18,
      defenseBias: 0.85,
      aggression: 0.35,
      dashEnabled: false,
    },
    table: {
      friction: 0.998,
      wallRestitution: 0.96,
      boosters: [],
      bumpers: [],
    },
  },
  {
    id: 2,
    act: 1,
    key: 'level_2',
    nameKey: 'rival_bouncer',
    targetScore: 5,
    targetSeconds: 70,
    ai: {
      speed: 300,
      reactionDelay: 0.15,
      defenseBias: 0.75,
      aggression: 0.5,
      dashEnabled: false,
    },
    table: {
      friction: 0.998,
      wallRestitution: 0.96,
      boosters: [],
      bumpers: [],
    },
  },
  {
    id: 3,
    act: 1,
    key: 'level_3',
    nameKey: 'rival_striker',
    targetScore: 5,
    targetSeconds: 65,
    ai: {
      speed: 340,
      reactionDelay: 0.12,
      defenseBias: 0.65,
      aggression: 0.65,
      dashEnabled: true,
    },
    table: {
      friction: 0.998,
      wallRestitution: 0.96,
      boosters: [],
      bumpers: [],
    },
  },
  {
    id: 4,
    act: 1,
    key: 'level_4',
    nameKey: 'rival_sweeper',
    targetScore: 5,
    targetSeconds: 60,
    ai: {
      speed: 370,
      reactionDelay: 0.1,
      defenseBias: 0.8,
      aggression: 0.6,
      dashEnabled: true,
    },
    table: {
      friction: 0.998,
      wallRestitution: 0.96,
      boosters: [],
      bumpers: [],
    },
  },
  {
    id: 5,
    act: 1,
    key: 'level_5',
    nameKey: 'rival_arcade_boss',
    targetScore: 5,
    targetSeconds: 55,
    ai: {
      speed: 400,
      reactionDelay: 0.08,
      defenseBias: 0.6,
      aggression: 0.8,
      dashEnabled: true,
    },
    table: {
      friction: 0.998,
      wallRestitution: 0.98,
      boosters: [],
      bumpers: [],
    },
  },

  // ==========================================
  // ACT 2: 极地冰晶赛场 (4 关: Level 6 ~ 9)
  // 冰面超低阻尼摩擦，边框强弹性反弹
  // ==========================================
  {
    id: 6,
    act: 2,
    key: 'level_6',
    nameKey: 'rival_glacier',
    targetScore: 5,
    targetSeconds: 65,
    ai: {
      speed: 360,
      reactionDelay: 0.12,
      defenseBias: 0.7,
      aggression: 0.6,
      dashEnabled: true,
    },
    table: {
      friction: 0.9995,
      wallRestitution: 1.04,
      boosters: [],
      bumpers: [],
    },
  },
  {
    id: 7,
    act: 2,
    key: 'level_7',
    nameKey: 'rival_blizzard',
    targetScore: 5,
    targetSeconds: 60,
    ai: {
      speed: 390,
      reactionDelay: 0.1,
      defenseBias: 0.6,
      aggression: 0.75,
      dashEnabled: true,
    },
    table: {
      friction: 0.9995,
      wallRestitution: 1.05,
      boosters: [],
      bumpers: [],
    },
  },
  {
    id: 8,
    act: 2,
    key: 'level_8',
    nameKey: 'rival_frostbite',
    targetScore: 5,
    targetSeconds: 55,
    ai: {
      speed: 410,
      reactionDelay: 0.08,
      defenseBias: 0.65,
      aggression: 0.8,
      dashEnabled: true,
    },
    table: {
      friction: 0.9998,
      wallRestitution: 1.06,
      boosters: [],
      bumpers: [],
    },
  },
  {
    id: 9,
    act: 2,
    key: 'level_9',
    nameKey: 'rival_ice_king',
    targetScore: 5,
    targetSeconds: 50,
    ai: {
      speed: 430,
      reactionDelay: 0.06,
      defenseBias: 0.55,
      aggression: 0.9,
      dashEnabled: true,
    },
    table: {
      friction: 0.9998,
      wallRestitution: 1.06,
      boosters: [],
      bumpers: [],
    },
  },

  // ==========================================
  // ACT 3: 赛博霓虹狂欢 (4 关: Level 10 ~ 13)
  // 中场配置电磁加速环，小球穿过爆发出 1.4x 动能
  // ==========================================
  {
    id: 10,
    act: 3,
    key: 'level_10',
    nameKey: 'rival_neon_glow',
    targetScore: 5,
    targetSeconds: 60,
    ai: {
      speed: 390,
      reactionDelay: 0.1,
      defenseBias: 0.65,
      aggression: 0.75,
      dashEnabled: true,
    },
    table: {
      friction: 0.9985,
      wallRestitution: 0.98,
      boosters: [{ x: 420, y: 240, radius: 46, multiplier: 1.35 }],
      bumpers: [],
    },
  },
  {
    id: 11,
    act: 3,
    key: 'level_11',
    nameKey: 'rival_pulse_driver',
    targetScore: 5,
    targetSeconds: 55,
    ai: {
      speed: 420,
      reactionDelay: 0.08,
      defenseBias: 0.6,
      aggression: 0.85,
      dashEnabled: true,
    },
    table: {
      friction: 0.9985,
      wallRestitution: 0.98,
      boosters: [{ x: 420, y: 240, radius: 48, multiplier: 1.4 }],
      bumpers: [],
    },
  },
  {
    id: 12,
    act: 3,
    key: 'level_12',
    nameKey: 'rival_laser_blade',
    targetScore: 5,
    targetSeconds: 50,
    ai: {
      speed: 440,
      reactionDelay: 0.06,
      defenseBias: 0.5,
      aggression: 0.9,
      dashEnabled: true,
    },
    table: {
      friction: 0.9988,
      wallRestitution: 1.0,
      boosters: [
        { x: 420, y: 150, radius: 36, multiplier: 1.35 },
        { x: 420, y: 330, radius: 36, multiplier: 1.35 },
      ],
      bumpers: [],
    },
  },
  {
    id: 13,
    act: 3,
    key: 'level_13',
    nameKey: 'rival_cyber_queen',
    targetScore: 5,
    targetSeconds: 48,
    ai: {
      speed: 460,
      reactionDelay: 0.05,
      defenseBias: 0.5,
      aggression: 0.95,
      dashEnabled: true,
    },
    table: {
      friction: 0.9988,
      wallRestitution: 1.0,
      boosters: [{ x: 420, y: 240, radius: 52, multiplier: 1.45 }],
      bumpers: [],
    },
  },

  // ==========================================
  // ACT 4: 磁暴重力工坊 (5 关: Level 14 ~ 18)
  // 球台中央分布发光反弹阻抗柱 (Bumper)，变向折射
  // ==========================================
  {
    id: 14,
    act: 4,
    key: 'level_14',
    nameKey: 'rival_magneto',
    targetScore: 5,
    targetSeconds: 65,
    ai: {
      speed: 410,
      reactionDelay: 0.08,
      defenseBias: 0.7,
      aggression: 0.75,
      dashEnabled: true,
    },
    table: {
      friction: 0.998,
      wallRestitution: 0.98,
      boosters: [],
      bumpers: [{ x: 420, y: 240, radius: 32, restitution: 1.15 }],
    },
  },
  {
    id: 15,
    act: 4,
    key: 'level_15',
    nameKey: 'rival_vortex',
    targetScore: 5,
    targetSeconds: 60,
    ai: {
      speed: 430,
      reactionDelay: 0.07,
      defenseBias: 0.65,
      aggression: 0.8,
      dashEnabled: true,
    },
    table: {
      friction: 0.998,
      wallRestitution: 0.98,
      boosters: [],
      bumpers: [
        { x: 350, y: 170, radius: 26, restitution: 1.12 },
        { x: 490, y: 310, radius: 26, restitution: 1.12 },
      ],
    },
  },
  {
    id: 16,
    act: 4,
    key: 'level_16',
    nameKey: 'rival_singularity',
    targetScore: 5,
    targetSeconds: 55,
    ai: {
      speed: 440,
      reactionDelay: 0.06,
      defenseBias: 0.6,
      aggression: 0.85,
      dashEnabled: true,
    },
    table: {
      friction: 0.9985,
      wallRestitution: 1.0,
      boosters: [{ x: 420, y: 240, radius: 40, multiplier: 1.3 }],
      bumpers: [
        { x: 420, y: 130, radius: 24, restitution: 1.15 },
        { x: 420, y: 350, radius: 24, restitution: 1.15 },
      ],
    },
  },
  {
    id: 17,
    act: 4,
    key: 'level_17',
    nameKey: 'rival_storm_bringer',
    targetScore: 5,
    targetSeconds: 50,
    ai: {
      speed: 460,
      reactionDelay: 0.05,
      defenseBias: 0.55,
      aggression: 0.9,
      dashEnabled: true,
    },
    table: {
      friction: 0.9985,
      wallRestitution: 1.02,
      boosters: [{ x: 420, y: 240, radius: 45, multiplier: 1.35 }],
      bumpers: [
        { x: 320, y: 240, radius: 26, restitution: 1.18 },
        { x: 520, y: 240, radius: 26, restitution: 1.18 },
      ],
    },
  },
  {
    id: 18,
    act: 4,
    key: 'level_18',
    nameKey: 'rival_overlord_flux',
    targetScore: 5,
    targetSeconds: 48,
    ai: {
      speed: 470,
      reactionDelay: 0.04,
      defenseBias: 0.5,
      aggression: 0.95,
      dashEnabled: true,
    },
    table: {
      friction: 0.9988,
      wallRestitution: 1.02,
      boosters: [{ x: 420, y: 240, radius: 48, multiplier: 1.4 }],
      bumpers: [
        { x: 340, y: 160, radius: 24, restitution: 1.2 },
        { x: 500, y: 320, radius: 24, restitution: 1.2 },
      ],
    },
  },

  // ==========================================
  // ACT 5: 虚空巅峰争霸赛 (4 关: Level 19 ~ 22)
  // 终极电竞巅峰 AI，轨迹预判极快，近乎无死角
  // ==========================================
  {
    id: 19,
    act: 5,
    key: 'level_19',
    nameKey: 'rival_phantom',
    targetScore: 5,
    targetSeconds: 50,
    ai: {
      speed: 460,
      reactionDelay: 0.04,
      defenseBias: 0.6,
      aggression: 0.9,
      dashEnabled: true,
    },
    table: {
      friction: 0.999,
      wallRestitution: 1.02,
      boosters: [{ x: 420, y: 240, radius: 44, multiplier: 1.35 }],
      bumpers: [],
    },
  },
  {
    id: 20,
    act: 5,
    key: 'level_20',
    nameKey: 'rival_chronos',
    targetScore: 5,
    targetSeconds: 46,
    ai: {
      speed: 475,
      reactionDelay: 0.03,
      defenseBias: 0.55,
      aggression: 0.95,
      dashEnabled: true,
    },
    table: {
      friction: 0.999,
      wallRestitution: 1.03,
      boosters: [{ x: 420, y: 240, radius: 48, multiplier: 1.4 }],
      bumpers: [
        { x: 420, y: 140, radius: 22, restitution: 1.15 },
        { x: 420, y: 340, radius: 22, restitution: 1.15 },
      ],
    },
  },
  {
    id: 21,
    act: 5,
    key: 'level_21',
    nameKey: 'rival_abyss_master',
    targetScore: 5,
    targetSeconds: 44,
    ai: {
      speed: 485,
      reactionDelay: 0.02,
      defenseBias: 0.5,
      aggression: 0.98,
      dashEnabled: true,
    },
    table: {
      friction: 0.9992,
      wallRestitution: 1.04,
      boosters: [
        { x: 420, y: 160, radius: 38, multiplier: 1.4 },
        { x: 420, y: 320, radius: 38, multiplier: 1.4 },
      ],
      bumpers: [{ x: 420, y: 240, radius: 28, restitution: 1.2 }],
    },
  },
  {
    id: 22,
    act: 5,
    key: 'level_22',
    nameKey: 'rival_void_god',
    targetScore: 5,
    targetSeconds: 40,
    ai: {
      speed: 500,
      reactionDelay: 0.015,
      defenseBias: 0.5,
      aggression: 1.0,
      dashEnabled: true,
    },
    table: {
      friction: 0.9995,
      wallRestitution: 1.05,
      boosters: [{ x: 420, y: 240, radius: 52, multiplier: 1.45 }],
      bumpers: [
        { x: 330, y: 180, radius: 25, restitution: 1.22 },
        { x: 510, y: 300, radius: 25, restitution: 1.22 },
      ],
    },
  },
];

export function getLevelById(id) {
  const numericId = typeof id === 'number' ? id : parseInt(id, 10);
  return LEVELS.find((l) => l.id === numericId) || LEVELS[0];
}
