// levels.mjs — 星区战役编排：5 星区 × 6 波 = 30 波，每区末一场母舰 Boss。
// 全部为确定性配置（无随机），波次参数只由波次序号决定，便于测试与重放。

export const WAVES_PER_SECTOR = 6;
export const SECTOR_COUNT = 5;
export const TOTAL_WAVES = WAVES_PER_SECTOR * SECTOR_COUNT; // 30
export const GRID_COLS = 9;
export const MODES = Object.freeze(["campaign", "rush", "survival"]);

export const ENEMY_TYPES = Object.freeze({
  wasp: {
    id: "wasp",
    hp: 1,
    radius: 15,
    score: 100,
    // 速射蜂：单发直落，弹速慢，给玩家留出横移空间
    volley: "straight",
  },
  falcon: {
    id: "falcon",
    hp: 2,
    radius: 17,
    score: 180,
    // 俯冲隼：脱离编队弧线俯冲，俯冲中投弹
    volley: "aimed",
    diver: true,
  },
  crab: {
    id: "crab",
    hp: 3,
    radius: 19,
    score: 260,
    // 重甲蟹：三向扇形齐射
    volley: "fan",
  },
  queen: {
    id: "queen",
    hp: 4,
    radius: 20,
    score: 420,
    // 皇蜂：牵引光束俘获本机，被俘期间击落它即可夺回僚机双机合体
    volley: "aimed",
    captor: true,
  },
});

export const SECTORS = Object.freeze([
  {
    id: 0,
    key: "recruit",
    // 每排的敌机构成（自前排到后排）
    rows: [["wasp"], ["wasp"], ["wasp"], ["wasp"]],
    dive: false,
    capture: false,
    speed: 26,
    fireRate: 0.5,
  },
  {
    id: 1,
    key: "falcon",
    rows: [["falcon"], ["wasp"], ["wasp"], ["wasp"]],
    dive: true,
    capture: false,
    speed: 32,
    fireRate: 0.62,
  },
  {
    id: 2,
    key: "crab",
    rows: [["crab"], ["falcon"], ["wasp"], ["wasp"], ["wasp"]],
    dive: true,
    capture: false,
    speed: 36,
    fireRate: 0.72,
  },
  {
    id: 3,
    key: "queen",
    rows: [["queen"], ["crab"], ["falcon"], ["wasp"], ["wasp"]],
    dive: true,
    capture: true,
    speed: 40,
    fireRate: 0.8,
  },
  {
    id: 4,
    key: "mothership",
    rows: [["queen"], ["queen"], ["crab"], ["falcon"], ["wasp"]],
    dive: true,
    capture: true,
    speed: 44,
    fireRate: 0.9,
  },
]);

export function sectorOf(waveIndex) {
  const id = Math.floor(waveIndex / WAVES_PER_SECTOR);
  return SECTORS[Math.max(0, Math.min(SECTOR_COUNT - 1, id))];
}

export function slotOf(waveIndex) {
  return waveIndex % WAVES_PER_SECTOR;
}

export function isBossWave(waveIndex) {
  return slotOf(waveIndex) === WAVES_PER_SECTOR - 1;
}

/**
 * 波次规格：完全由序号决定（确定性），随机只出现在战斗过程里。
 * 一区之内难度随 slot 平滑爬升，区末为母舰战。
 */
export function waveSpec(waveIndex) {
  const index = Math.max(0, Math.min(TOTAL_WAVES - 1, Math.floor(waveIndex)));
  const sector = sectorOf(index);
  const slot = slotOf(index);
  const boss = isBossWave(index);
  const ramp = slot / (WAVES_PER_SECTOR - 2 || 1); // 0 → 1
  const rows = boss ? 0 : sector.rows.length;
  return {
    index,
    sector: sector.id,
    sectorKey: sector.key,
    boss,
    rows,
    cols: boss ? 0 : GRID_COLS,
    types: boss ? [] : sector.rows,
    dive: sector.dive && !boss,
    capture: sector.capture && !boss,
    // 编队横移速度：区内递增，剩余数量越少越快（引擎里再乘幸存者系数）
    speed: sector.speed + ramp * 10,
    // 开火频率：每秒每敌开火概率的基准
    fireRate: sector.fireRate + ramp * 0.18,
    // 同屏俯冲上限：始终留有余地，绝不出现全员俯冲
    maxDivers: Math.min(2 + Math.floor(index / 8), 5),
    // 敌弹生成预算（每秒上限）：远低于"糊屏"阈值，保证可读
    bulletBudget: Math.min(6 + Math.floor(index / 6), 13),
    bossHp: boss ? 46 + sector.id * 26 : 0,
    par: boss ? 42 + sector.id * 8 : 20 + index * 0.7,
  };
}

/** 生存狂潮：波次越深越强，用同一套规格生成器外推。 */
export function survivalSpec(waveIndex) {
  const loop = Math.floor(waveIndex / TOTAL_WAVES);
  const base = waveSpec(waveIndex % TOTAL_WAVES);
  return {
    ...base,
    index: waveIndex,
    boss: base.boss && loop % 2 === 0,
    speed: base.speed + loop * 6,
    fireRate: Math.min(1.5, base.fireRate + loop * 0.08),
    bulletBudget: Math.min(15, base.bulletBudget + loop),
    bossHp: base.bossHp + loop * 30,
    par: base.par,
  };
}

/** 母舰突袭：连续 5 场母舰战，一场比一场硬。 */
export function rushSpec(stage) {
  const i = Math.max(0, Math.min(4, Math.floor(stage)));
  return {
    ...waveSpec(i * WAVES_PER_SECTOR + WAVES_PER_SECTOR - 1),
    index: i,
    sector: i,
    sectorKey: SECTORS[i].key,
    boss: true,
    bossHp: 40 + i * 24,
    par: 38 + i * 7,
  };
}

export function waveCountFor(mode) {
  if (mode === "campaign") return TOTAL_WAVES;
  if (mode === "rush") return SECTOR_COUNT;
  return Infinity;
}
