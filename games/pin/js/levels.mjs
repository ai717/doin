/**
 * @file games/pin/js/levels.mjs
 * 23 关五大钟表章节数据（5/4/4/5/5 梯度结构）。
 * 遵循严格契约：零硬编码中文，全语言键化；数学上保证预留 >= 25% 安全空隙。
 */

export const ACT_THEMES = [
  { id: 1, key: 'act_apprentice', baseSpeed: 1.4 },
  { id: 2, key: 'act_pendulum', baseSpeed: 1.8 },
  { id: 3, key: 'act_steam', baseSpeed: 2.0 },
  { id: 4, key: 'act_tempest', baseSpeed: 2.4 },
  { id: 5, key: 'act_celestial', baseSpeed: 2.8 },
];

export const LEVELS = [
  // ==========================================
  // ACT 1: 钟表学徒 (Apprentice Horologist - 5 Levels)
  // 平稳匀速自转，缝隙宽绰，熟悉击发手感
  // ==========================================
  {
    id: 1,
    act: 1,
    key: 'level_1',
    initialPins: [0, Math.PI], // 2 根初始对称针
    pendingCount: 6,
    rotationType: 'constant',
    baseSpeed: 1.3,
    safeAngleDeg: 10.0,
    targetSeconds: 25,
  },
  {
    id: 2,
    act: 1,
    key: 'level_2',
    initialPins: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3], // 3 根正三角针
    pendingCount: 7,
    rotationType: 'constant',
    baseSpeed: -1.4, // 逆时针自转
    safeAngleDeg: 9.8,
    targetSeconds: 25,
  },
  {
    id: 3,
    act: 1,
    key: 'level_3',
    initialPins: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2], // 4 根十字针
    pendingCount: 8,
    rotationType: 'constant',
    baseSpeed: 1.5,
    safeAngleDeg: 9.5,
    targetSeconds: 30,
  },
  {
    id: 4,
    act: 1,
    key: 'level_4',
    initialPins: [0.3, 1.2, 2.5, 3.8, 5.0], // 5 根微非对称针
    pendingCount: 9,
    rotationType: 'constant',
    baseSpeed: -1.6,
    safeAngleDeg: 9.2,
    targetSeconds: 30,
  },
  {
    id: 5,
    act: 1,
    key: 'level_5',
    initialPins: [0, 0.9, 1.8, 3.1, 4.2, 5.2], // 6 根紧凑针
    pendingCount: 10,
    rotationType: 'constant',
    baseSpeed: 1.7,
    safeAngleDeg: 9.0,
    targetSeconds: 35,
  },

  // ==========================================
  // ACT 2: 逆向摆钟 (Pendulum Reverse - 4 Levels)
  // 顺时针旋转后平滑减速并反向自转，变向预判
  // ==========================================
  {
    id: 6,
    act: 2,
    key: 'level_6',
    initialPins: [0, Math.PI * 0.7, Math.PI * 1.4],
    pendingCount: 9,
    rotationType: 'pendulum',
    baseSpeed: 1.8,
    speedFreq: 0.8, // 摆动周期频率
    safeAngleDeg: 9.2,
    targetSeconds: 35,
  },
  {
    id: 7,
    act: 2,
    key: 'level_7',
    initialPins: [0.4, 1.6, 2.8, 4.1, 5.3],
    pendingCount: 10,
    rotationType: 'pendulum',
    baseSpeed: -2.0,
    speedFreq: 0.9,
    safeAngleDeg: 9.0,
    targetSeconds: 35,
  },
  {
    id: 8,
    act: 2,
    key: 'level_8',
    initialPins: [0, 1.1, 2.2, 3.5, 4.6],
    pendingCount: 11,
    rotationType: 'pendulum',
    baseSpeed: 2.2,
    speedFreq: 1.1,
    safeAngleDeg: 8.8,
    targetSeconds: 40,
  },
  {
    id: 9,
    act: 2,
    key: 'level_9',
    initialPins: [0.2, 1.3, 2.4, 3.6, 4.7, 5.7],
    pendingCount: 12,
    rotationType: 'pendulum',
    baseSpeed: -2.3,
    speedFreq: 1.2,
    safeAngleDeg: 8.6,
    targetSeconds: 40,
  },

  // ==========================================
  // ACT 3: 蒸汽齿轮 (Steam Piston - 4 Levels)
  // 脉冲式周期变速（慢速巡航 -> 突发半圈加速 -> 恢复慢速）
  // ==========================================
  {
    id: 10,
    act: 3,
    key: 'level_10',
    initialPins: [0, 1.2, 2.4, 3.8, 5.1],
    pendingCount: 11,
    rotationType: 'pulse',
    baseSpeed: 1.5,
    speedAmp: 1.4,
    speedFreq: 1.0,
    safeAngleDeg: 8.8,
    targetSeconds: 40,
  },
  {
    id: 11,
    act: 3,
    key: 'level_11',
    initialPins: [0.3, 1.5, 2.7, 4.0, 5.2],
    pendingCount: 12,
    rotationType: 'pulse',
    baseSpeed: -1.7,
    speedAmp: 1.6,
    speedFreq: 1.2,
    safeAngleDeg: 8.6,
    targetSeconds: 40,
  },
  {
    id: 12,
    act: 3,
    key: 'level_12',
    initialPins: [0, 1.0, 2.1, 3.2, 4.3, 5.4],
    pendingCount: 13,
    rotationType: 'pulse',
    baseSpeed: 1.9,
    speedAmp: 1.8,
    speedFreq: 1.3,
    safeAngleDeg: 8.5,
    targetSeconds: 45,
  },
  {
    id: 13,
    act: 3,
    key: 'level_13',
    initialPins: [0.2, 1.1, 2.0, 3.1, 4.2, 5.3],
    pendingCount: 14,
    rotationType: 'pulse',
    baseSpeed: -2.1,
    speedAmp: 2.0,
    speedFreq: 1.4,
    safeAngleDeg: 8.4,
    targetSeconds: 45,
  },

  // ==========================================
  // ACT 4: 电磁风暴 (Magnetic Tempest - 5 Levels)
  // 假动作急停顿挫（转速骤降顿挫随后瞬间爆发）
  // ==========================================
  {
    id: 14,
    act: 4,
    key: 'level_14',
    initialPins: [0, 1.3, 2.6, 3.9, 5.2],
    pendingCount: 13,
    rotationType: 'stutter',
    baseSpeed: 2.2,
    stutterInterval: 2.8,
    safeAngleDeg: 8.5,
    targetSeconds: 45,
  },
  {
    id: 15,
    act: 4,
    key: 'level_15',
    initialPins: [0.4, 1.6, 2.9, 4.2, 5.4],
    pendingCount: 14,
    rotationType: 'stutter',
    baseSpeed: -2.4,
    stutterInterval: 2.6,
    safeAngleDeg: 8.4,
    targetSeconds: 45,
  },
  {
    id: 16,
    act: 4,
    key: 'level_16',
    initialPins: [0, 1.1, 2.2, 3.3, 4.4, 5.5],
    pendingCount: 15,
    rotationType: 'stutter',
    baseSpeed: 2.5,
    stutterInterval: 2.4,
    safeAngleDeg: 8.2,
    targetSeconds: 50,
  },
  {
    id: 17,
    act: 4,
    key: 'level_17',
    initialPins: [0.3, 1.3, 2.3, 3.5, 4.6, 5.6],
    pendingCount: 16,
    rotationType: 'stutter',
    baseSpeed: -2.6,
    stutterInterval: 2.2,
    safeAngleDeg: 8.0,
    targetSeconds: 50,
  },
  {
    id: 18,
    act: 4,
    key: 'level_18',
    initialPins: [0, 1.0, 2.0, 3.1, 4.1, 5.2],
    pendingCount: 16,
    rotationType: 'stutter',
    baseSpeed: 2.7,
    stutterInterval: 2.0,
    safeAngleDeg: 8.0,
    targetSeconds: 50,
  },

  // ==========================================
  // ACT 5: 精密天文仪 (Celestial Chronometer - 5 Levels)
  // 非对称变速曲线、极限窄缝穿透，针尖芭蕾
  // ==========================================
  {
    id: 19,
    act: 5,
    key: 'level_19',
    initialPins: [0, 1.2, 2.3, 3.4, 4.5, 5.6],
    pendingCount: 16,
    rotationType: 'celestial',
    baseSpeed: 2.5,
    speedAmp: 1.5,
    speedFreq: 1.2,
    safeAngleDeg: 7.8,
    targetSeconds: 50,
  },
  {
    id: 20,
    act: 5,
    key: 'level_20',
    initialPins: [0.2, 1.2, 2.2, 3.3, 4.4, 5.4],
    pendingCount: 17,
    rotationType: 'celestial',
    baseSpeed: -2.6,
    speedAmp: 1.7,
    speedFreq: 1.3,
    safeAngleDeg: 7.6,
    targetSeconds: 55,
  },
  {
    id: 21,
    act: 5,
    key: 'level_21',
    initialPins: [0, 1.0, 2.0, 3.0, 4.1, 5.1],
    pendingCount: 18,
    rotationType: 'celestial',
    baseSpeed: 2.7,
    speedAmp: 1.8,
    speedFreq: 1.4,
    safeAngleDeg: 7.5,
    targetSeconds: 55,
  },
  {
    id: 22,
    act: 5,
    key: 'level_22',
    initialPins: [0.3, 1.2, 2.1, 3.1, 4.2, 5.2],
    pendingCount: 18,
    rotationType: 'celestial',
    baseSpeed: -2.8,
    speedAmp: 2.0,
    speedFreq: 1.5,
    safeAngleDeg: 7.4,
    targetSeconds: 55,
  },
  {
    id: 23,
    act: 5,
    key: 'level_23',
    initialPins: [0, 0.9, 1.8, 2.8, 3.8, 4.8, 5.7],
    pendingCount: 19,
    rotationType: 'celestial',
    baseSpeed: 3.0,
    speedAmp: 2.2,
    speedFreq: 1.6,
    safeAngleDeg: 7.2,
    targetSeconds: 60,
  },
];

/**
 * 获取指定 ID 关卡（若越界安全回退到第 1 关）
 */
export function getLevelById(id) {
  const num = Number(id);
  const found = LEVELS.find((lvl) => lvl.id === num);
  return found || LEVELS[0];
}
