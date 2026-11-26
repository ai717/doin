// levels.mjs — 关卡与角色数值表。全部使用字符串 key，展示文案由 i18n 提供，严禁裸写中文。
// 12 关 / 4 章，每关 3 波（3/4/5 人）+ 一个压轴对手；第 3/6/9/12 关为章节 Boss。

export const WORLD_W = 1800;

export const CHAPTERS = Object.freeze([
  { id: "ch_track", nameKey: "chTrack", prop: "track" },
  { id: "ch_court", nameKey: "chCourt", prop: "court" },
  { id: "ch_alley", nameKey: "chAlley", prop: "alley" },
  { id: "ch_roof", nameKey: "chRoof", prop: "roof" },
]);

// 小怪与 Boss 的基础数值。hp 为 1 级基准，实际血量乘以关卡难度系数。
export const ENEMY_TYPES = Object.freeze({
  enemy_scrapper: {
    nameKey: "foeScrapper", hp: 26, speed: 78, dmg: 5, range: 48, depth: 0.2,
    windup: 0.42, active: 0.09, recover: 0.34, cool: [1.15, 1.9], scale: 1,
  },
  enemy_senior: {
    nameKey: "foeSenior", hp: 38, speed: 70, dmg: 7, range: 54, depth: 0.22,
    windup: 0.5, active: 0.1, recover: 0.4, cool: [1.4, 2.2], scale: 1.06,
  },
  enemy_runner: {
    nameKey: "foeRunner", hp: 22, speed: 118, dmg: 5, range: 48, depth: 0.2,
    windup: 0.3, active: 0.08, recover: 0.3, cool: [0.95, 1.6], scale: 0.94,
  },
  enemy_ranger: {
    nameKey: "foeRanger", hp: 26, speed: 64, dmg: 6, range: 52, depth: 0.2,
    windup: 0.55, active: 0.1, recover: 0.5, cool: [1.8, 2.6], ranged: true, keep: 210, scale: 1,
  },
  enemy_guard: {
    nameKey: "foeGuard", hp: 52, speed: 58, dmg: 9, range: 58, depth: 0.24,
    windup: 0.62, active: 0.11, recover: 0.48, cool: [1.7, 2.5], armor: true, scale: 1.16,
  },
  enemy_trickster: {
    nameKey: "foeTrickster", hp: 30, speed: 84, dmg: 7, range: 80, depth: 0.24,
    windup: 0.46, active: 0.12, recover: 0.4, cool: [1.35, 2.1], scale: 1.02,
  },
  boss_pe: {
    nameKey: "bossPE", hp: 200, speed: 84, dmg: 11, range: 68, depth: 0.26,
    windup: 0.55, active: 0.11, recover: 0.55, cool: [1.5, 2.2], boss: true, scale: 1.38,
    patterns: ["swing", "charge", "whistle"],
  },
  boss_captain: {
    nameKey: "bossCaptain", hp: 230, speed: 88, dmg: 12, range: 72, depth: 0.26,
    windup: 0.52, active: 0.11, recover: 0.5, cool: [1.4, 2.1], boss: true, scale: 1.4,
    patterns: ["swing", "ball", "slam"],
  },
  boss_shopkeeper: {
    nameKey: "bossShopkeeper", hp: 260, speed: 76, dmg: 13, range: 74, depth: 0.28,
    windup: 0.56, active: 0.12, recover: 0.54, cool: [1.5, 2.3], boss: true, scale: 1.44,
    patterns: ["can", "sweep", "summon"],
  },
  boss_senior: {
    nameKey: "bossSenior", hp: 300, speed: 112, dmg: 14, range: 70, depth: 0.26,
    windup: 0.42, active: 0.1, recover: 0.4, cool: [1.1, 1.8], boss: true, scale: 1.42,
    patterns: ["combo", "jump", "shock"],
  },
});

const pick = (...kinds) => kinds;

export const LEVELS = Object.freeze([
  {
    id: "level_01", num: 1, chapter: 0, nameKey: "lvl01", par: 55, diff: 0, seed: 3101,
    waves: [
      pick("enemy_scrapper", "enemy_scrapper", "enemy_scrapper"),
      pick("enemy_scrapper", "enemy_scrapper", "enemy_runner", "enemy_runner"),
      pick("enemy_scrapper", "enemy_senior", "enemy_runner", "enemy_senior", "enemy_scrapper"),
    ],
    headliner: { kind: "enemy_senior", boss: false, elite: true, hp: 110, nameKey: "foeBullyLeader" },
    items: [
      { kind: "item_basketball", x: 760, z: 0.44 },
      { kind: "item_milk", x: 1180, z: 0.74 },
    ],
  },
  {
    id: "level_02", num: 2, chapter: 0, nameKey: "lvl02", par: 60, diff: 0.05, seed: 3102,
    waves: [
      pick("enemy_scrapper", "enemy_runner", "enemy_scrapper"),
      pick("enemy_runner", "enemy_runner", "enemy_scrapper", "enemy_scrapper"),
      pick("enemy_senior", "enemy_runner", "enemy_senior", "enemy_runner", "enemy_scrapper"),
    ],
    headliner: { kind: "enemy_senior", boss: false, elite: true, hp: 120, nameKey: "foeBullyLeader" },
    items: [
      { kind: "item_schoolbag", x: 700, z: 0.72 },
      { kind: "item_soda", x: 1080, z: 0.36 },
      { kind: "item_basketball", x: 1420, z: 0.66 },
    ],
  },
  {
    id: "level_03", num: 3, chapter: 0, nameKey: "lvl03", par: 70, diff: 0.1, seed: 3103,
    waves: [
      pick("enemy_scrapper", "enemy_scrapper", "enemy_runner"),
      pick("enemy_senior", "enemy_senior", "enemy_scrapper", "enemy_runner"),
      pick("enemy_senior", "enemy_senior", "enemy_senior", "enemy_runner", "enemy_runner"),
    ],
    headliner: { kind: "boss_pe", boss: true, elite: false, hp: 0, nameKey: "bossPE" },
    items: [
      { kind: "item_milk", x: 820, z: 0.5 },
      { kind: "item_basketball", x: 1260, z: 0.68 },
    ],
  },
  {
    id: "level_04", num: 4, chapter: 1, nameKey: "lvl04", par: 70, diff: 0.15, seed: 3201,
    waves: [
      pick("enemy_senior", "enemy_senior", "enemy_runner"),
      pick("enemy_senior", "enemy_senior", "enemy_runner", "enemy_runner"),
      pick("enemy_guard", "enemy_senior", "enemy_senior", "enemy_runner", "enemy_runner"),
    ],
    headliner: { kind: "enemy_guard", boss: false, elite: true, hp: 150, nameKey: "foeGuardLeader" },
    items: [
      { kind: "item_basketball", x: 740, z: 0.4 },
      { kind: "item_soda", x: 1240, z: 0.72 },
    ],
  },
  {
    id: "level_05", num: 5, chapter: 1, nameKey: "lvl05", par: 75, diff: 0.2, seed: 3202,
    waves: [
      pick("enemy_senior", "enemy_ranger", "enemy_runner"),
      pick("enemy_ranger", "enemy_ranger", "enemy_senior", "enemy_runner"),
      pick("enemy_ranger", "enemy_guard", "enemy_senior", "enemy_senior", "enemy_runner"),
    ],
    headliner: { kind: "enemy_trickster", boss: false, elite: true, hp: 160, nameKey: "foeTricksterLeader" },
    items: [
      { kind: "item_schoolbag", x: 860, z: 0.62 },
      { kind: "item_milk", x: 1320, z: 0.38 },
    ],
  },
  {
    id: "level_06", num: 6, chapter: 1, nameKey: "lvl06", par: 85, diff: 0.25, seed: 3203,
    waves: [
      pick("enemy_senior", "enemy_senior", "enemy_ranger"),
      pick("enemy_guard", "enemy_senior", "enemy_senior", "enemy_ranger"),
      pick("enemy_guard", "enemy_guard", "enemy_senior", "enemy_senior", "enemy_ranger"),
    ],
    headliner: { kind: "boss_captain", boss: true, elite: false, hp: 0, nameKey: "bossCaptain" },
    items: [
      { kind: "item_basketball", x: 780, z: 0.48 },
      { kind: "item_soda", x: 1180, z: 0.7 },
    ],
  },
  {
    id: "level_07", num: 7, chapter: 2, nameKey: "lvl07", par: 80, diff: 0.3, seed: 3301,
    waves: [
      pick("enemy_guard", "enemy_senior", "enemy_ranger"),
      pick("enemy_guard", "enemy_guard", "enemy_trickster", "enemy_ranger"),
      pick("enemy_guard", "enemy_guard", "enemy_trickster", "enemy_trickster", "enemy_ranger"),
    ],
    headliner: { kind: "enemy_guard", boss: false, elite: true, hp: 190, nameKey: "foeGuardLeader" },
    items: [
      { kind: "item_broom", x: 760, z: 0.4 },
      { kind: "item_milk", x: 1200, z: 0.66 },
    ],
  },
  {
    id: "level_08", num: 8, chapter: 2, nameKey: "lvl08", par: 85, diff: 0.36, seed: 3302,
    waves: [
      pick("enemy_trickster", "enemy_trickster", "enemy_ranger"),
      pick("enemy_trickster", "enemy_trickster", "enemy_guard", "enemy_ranger"),
      pick("enemy_trickster", "enemy_trickster", "enemy_guard", "enemy_guard", "enemy_ranger"),
    ],
    headliner: { kind: "enemy_trickster", boss: false, elite: true, hp: 190, nameKey: "foeTricksterLeader" },
    items: [
      { kind: "item_broom", x: 900, z: 0.7 },
      { kind: "item_soda", x: 1300, z: 0.42 },
      { kind: "item_milk", x: 1560, z: 0.62 },
    ],
  },
  {
    id: "level_09", num: 9, chapter: 2, nameKey: "lvl09", par: 95, diff: 0.42, seed: 3303,
    waves: [
      pick("enemy_guard", "enemy_guard", "enemy_trickster"),
      pick("enemy_guard", "enemy_guard", "enemy_trickster", "enemy_trickster"),
      pick("enemy_guard", "enemy_guard", "enemy_trickster", "enemy_trickster", "enemy_ranger"),
    ],
    headliner: { kind: "boss_shopkeeper", boss: true, elite: false, hp: 0, nameKey: "bossShopkeeper" },
    items: [
      { kind: "item_broom", x: 840, z: 0.6 },
      { kind: "item_milk", x: 1240, z: 0.34 },
      { kind: "item_soda", x: 1500, z: 0.74 },
    ],
  },
  {
    id: "level_10", num: 10, chapter: 3, nameKey: "lvl10", par: 90, diff: 0.48, seed: 3401,
    waves: [
      pick("enemy_senior", "enemy_runner", "enemy_ranger"),
      pick("enemy_guard", "enemy_senior", "enemy_senior", "enemy_ranger"),
      pick("enemy_guard", "enemy_guard", "enemy_trickster", "enemy_trickster", "enemy_runner"),
    ],
    headliner: { kind: "enemy_runner", boss: false, elite: true, hp: 200, nameKey: "foeRunnerLeader" },
    items: [
      { kind: "item_basketball", x: 820, z: 0.44 },
      { kind: "item_soda", x: 1280, z: 0.7 },
    ],
  },
  {
    id: "level_11", num: 11, chapter: 3, nameKey: "lvl11", par: 95, diff: 0.56, seed: 3402,
    waves: [
      pick("enemy_guard", "enemy_guard", "enemy_trickster"),
      pick("enemy_guard", "enemy_guard", "enemy_trickster", "enemy_trickster"),
      pick("enemy_guard", "enemy_guard", "enemy_trickster", "enemy_trickster", "enemy_ranger"),
    ],
    headliner: { kind: "enemy_guard", boss: false, elite: true, hp: 230, nameKey: "foeGuardLeader" },
    items: [
      { kind: "item_broom", x: 780, z: 0.66 },
      { kind: "item_milk", x: 1220, z: 0.4 },
      { kind: "item_soda", x: 1520, z: 0.66 },
    ],
  },
  {
    id: "level_12", num: 12, chapter: 3, nameKey: "lvl12", par: 110, diff: 0.64, seed: 3403,
    waves: [
      pick("enemy_guard", "enemy_senior", "enemy_runner"),
      pick("enemy_guard", "enemy_trickster", "enemy_ranger", "enemy_senior"),
      pick("enemy_guard", "enemy_guard", "enemy_trickster", "enemy_trickster", "enemy_ranger"),
    ],
    headliner: { kind: "boss_senior", boss: true, elite: false, hp: 0, nameKey: "bossSenior" },
    items: [
      { kind: "item_basketball", x: 800, z: 0.38 },
      { kind: "item_milk", x: 1200, z: 0.7 },
      { kind: "item_soda", x: 1500, z: 0.5 },
    ],
  },
]);

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((level) => [level.id, level]));

export const ITEM_KINDS = Object.freeze({
  item_basketball: { nameKey: "itemBasketball", throwable: true, dmg: 12, power: "heavy" },
  item_schoolbag: { nameKey: "itemSchoolbag", throwable: true, dmg: 12, power: "heavy" },
  item_broom: { nameKey: "itemBroom", throwable: true, dmg: 12, power: "heavy" },
  item_milk: { nameKey: "itemMilk", throwable: false, heal: 25 },
  item_soda: { nameKey: "itemSoda", throwable: false, heal: 25 },
});

export const ARCADE = Object.freeze({
  duration: 180,
  waveSize: 4,
  enemyKinds: [
    "enemy_scrapper", "enemy_senior", "enemy_runner",
    "enemy_ranger", "enemy_guard", "enemy_trickster",
  ],
  bossKinds: ["boss_pe", "boss_captain", "boss_shopkeeper", "boss_senior"],
  bossEvery: 55,
});

export function firstLevelId() {
  return LEVELS[0].id;
}

export function levelIndex(levelId) {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  return index < 0 ? 0 : index;
}

export function nextLevelId(levelId) {
  const index = levelIndex(levelId);
  return LEVELS[Math.min(LEVELS.length - 1, index + 1)].id;
}

export function chapterOf(level) {
  return CHAPTERS[level?.chapter ?? 0] ?? CHAPTERS[0];
}
