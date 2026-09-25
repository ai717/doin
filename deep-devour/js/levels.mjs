// levels.mjs — 关卡数据表（纯数据，零依赖）
//
// 主线：5 片海域 × 8 关 = 40 关。每片海域第 1 关是新机制教学关（目标宽松、无敌起手），
// 第 8 关是海域压力峰值关。海域逐章解锁一条新规则（拒绝换皮式重复）：
//   ① 珊瑚浅滩 基础课（游动 / 吞食 / 躲避，无危险物）
//   ② 海藻密林 狂暴连锁 + 毒鱼 + 可穿行的海藻遮蔽
//   ③ 水母迷阵 鱼群同行 + 水母麻痹 + 海胆障碍
//   ④ 沉船海沟 深渊压强换气 + 水雷 / 渔网 / 宝箱
//   ⑤ 深渊王座 精英掠食者咬尾降阶 + 章末 Boss
//
// 难度设计铁律：比玩家大的鱼一律来自本表的 hunters（威胁是被设计出来的，不随机生出来），
// 且阶数最高只比该关起手阶高一阶 —— 危险来自“没看见 / 被逼到边上”，不是数学上跑不掉。
//
// 每关三颗珍珠：① 通关 ② 全程未被吃 ③ 隐藏效率目标（限时关看用时 / 其余看连锁与鱼群）。
// 成长曲线可验证：tools/balance.mjs 用贪心 AI 对每关跑 ≥1000 次，达成率 ≥95% 才准上线。

export const LEVELS_PER_ZONE = 8;

export const ZONES = Object.freeze([
  {
    zone: 1,
    slug: "reef",
    nameZh: "珊瑚浅滩",
    nameEn: "Coral Shallows",
    blurbZh: "基础课：游动跟手、吃小鱼长大、躲开大鱼。没有危险物，放心练手感。",
    blurbEn: "The basics: swim, feed, grow, and stay clear of bigger mouths. No hazards here.",
    taglineZh: "浅滩 / 暖流",
    taglineEn: "Shallows / Warm current",
    water: ["#8ff0dd", "#3fb6c8", "#146b96"],
    sand: "#f2d9a8",
    tint: "#ffd18c",
    mechanics: { frenzy: false, shoal: false, poison: false, pressure: false, elite: false, kelp: false },
    hazards: {},
    powers: { pearl: 3 },
    species: ["guppy", "sardine", "clown", "tang"],
    pearlGate: 0,
  },
  {
    zone: 2,
    slug: "kelp",
    nameZh: "海藻密林",
    nameEn: "Kelp Thicket",
    blurbZh: "新规则：狂暴连锁（1.2 秒内不断链）与毒鱼（吃了左右反向）。海藻丛可穿行，但看不见里面。",
    blurbEn: "New rules: frenzy chains (feed within 1.2s) and venom fish that flip your steering. Kelp is passable but blocks sight.",
    taglineZh: "密林 / 冷流",
    taglineEn: "Thicket / Cold current",
    water: ["#7fdca8", "#2f9c8a", "#0f5a63"],
    sand: "#cbb98a",
    tint: "#9ef0a8",
    mechanics: { frenzy: true, shoal: false, poison: true, pressure: false, elite: false, kelp: true },
    hazards: {},
    powers: { pearl: 3, lightning: 2, frenzy: 1.5 },
    species: ["sardine", "tang", "clown", "poison", "grouper"],
    pearlGate: 12,
  },
  {
    zone: 3,
    slug: "jelly",
    nameZh: "水母迷阵",
    nameEn: "Jelly Maze",
    blurbZh: "新规则：鱼群同行 —— 攒够三条同种小鱼，它们跟你走，替你挡一次掠食者的嘴。小心水母麻痹与海胆尖刺。",
    blurbEn: "New rule: Shoal. Collect three fish of one species and they swim with you, blocking one predator bite. Beware jelly paralysis and urchin spikes.",
    taglineZh: "迷阵 / 微光",
    taglineEn: "Maze / Glimmer",
    water: ["#b6a6f5", "#5f6fd0", "#26307a"],
    sand: "#d8c0f0",
    tint: "#d8b6ff",
    mechanics: { frenzy: true, shoal: true, poison: true, pressure: false, elite: false, kelp: false },
    hazards: { jelly: 3, urchin: 2 },
    powers: { pearl: 3, lightning: 2, shoal: 3, frenzy: 1.5 },
    species: ["sardine", "clown", "tang", "grouper", "shark"],
    pearlGate: 30,
  },
  {
    zone: 4,
    slug: "trench",
    nameZh: "沉船海沟",
    nameEn: "Sunken Trench",
    blurbZh: "新规则：深渊压强。越深的猎物成长值 ×1.5 / ×2，但压强条会涨满 —— 满格就掉成长、变迟钝，必须回浅层换气。",
    blurbEn: "New rule: abyss pressure. Deeper prey feeds 1.5-2x more, but your pressure gauge fills; at full it drains growth and slows you until you surface.",
    taglineZh: "海沟 / 沉船",
    taglineEn: "Trench / Wreck",
    water: ["#6fd0d8", "#1f6f9c", "#0a2f52"],
    sand: "#a98a63",
    tint: "#8fd8ff",
    mechanics: { frenzy: true, shoal: true, poison: true, pressure: true, elite: false, kelp: false },
    hazards: { mine: 1, net: 1, chest: 2, urchin: 1 },
    powers: { pearl: 3, lightning: 2, shoal: 2, frenzy: 1.5, heart: 1 },
    species: ["tang", "clown", "grouper", "shark", "puffer"],
    pearlGate: 54,
  },
  {
    zone: 5,
    slug: "throne",
    nameZh: "深渊王座",
    nameEn: "Abyssal Throne",
    blurbZh: "新规则：咬尾降阶。精英掠食者正面吃你，但突进之后会卸力 —— 绕到它尾巴咬三次，把它咬退一阶。",
    blurbEn: "New rule: tail bites. Elites eat you head-on, but they coast after each rush - circle behind and bite their tail three times to drop them a tier.",
    taglineZh: "王座 / 霸主",
    taglineEn: "Throne / Apex",
    water: ["#8ad8f0", "#3a4fa8", "#120c3a"],
    sand: "#5f4a8a",
    tint: "#ffb3c8",
    mechanics: { frenzy: true, shoal: true, poison: true, pressure: false, elite: true, kelp: false },
    hazards: {},
    powers: { pearl: 3, lightning: 2, shoal: 2, frenzy: 2, heart: 1 },
    species: ["tang", "grouper", "shark", "barracuda", "orca"],
    pearlGate: 78,
  },
]);

const ROWS = [
  // ---------- ① 珊瑚浅滩 ----------
  [
    { zh: "第一口", en: "First Bite", start: 2, goal: { type: "grow", tier: 3 }, time: 90, star3: { type: "parTime", value: 24 } },
    { zh: "谁比我大", en: "Bigger Than Me", start: 2, goal: { type: "grow", tier: 3 }, time: 85, star3: { type: "parTime", value: 24 }, hunters: [{ tier: 3, species: "grouper", count: 1 }] },
    { zh: "多吃一点", en: "Keep Feeding", start: 2, goal: { type: "eat", count: 18 }, time: 75, star3: { type: "parTime", value: 30 }, hunters: [{ tier: 3, species: "grouper", count: 1 }] },
    { zh: "涨潮", en: "Rising Tide", start: 3, goal: { type: "grow", tier: 4 }, time: 90, star3: { type: "parTime", value: 28 }, hunters: [{ tier: 4, species: "grouper", count: 1 }] },
    { zh: "沙丁鱼群", en: "The Shoal", start: 3, goal: { type: "eat", count: 22 }, time: 85, star3: { type: "parTime", value: 38 }, hunters: [{ tier: 4, species: "grouper", count: 2 }] },
    { zh: "珊瑚隧道", en: "Coral Tunnel", start: 3, goal: { type: "grow", tier: 4 }, time: 85, star3: { type: "parTime", value: 30 }, hunters: [{ tier: 4, species: "grouper", count: 2 }] },
    { zh: "逆流", en: "Against the Current", start: 4, goal: { type: "eat", count: 24 }, time: 90, star3: { type: "parTime", value: 42 }, hunters: [{ tier: 5, species: "grouper", count: 2 }] },
    { zh: "浅滩之王", en: "King of the Shallows", start: 4, goal: { type: "grow", tier: 5 }, time: 100, star3: { type: "parTime", value: 36 }, hunters: [{ tier: 5, species: "grouper", count: 2 }] },
  ],
  // ---------- ② 海藻密林 ----------
  [
    { zh: "逆向游动", en: "Swim Backwards", start: 3, goal: { type: "grow", tier: 4 }, time: 90, star3: { type: "frenzy", value: 2 }, hunters: [{ tier: 4, species: "grouper", count: 1 }] },
    { zh: "灯芯草", en: "Reeds", start: 3, goal: { type: "grow", tier: 4 }, time: 85, star3: { type: "parTime", value: 30 }, hunters: [{ tier: 4, species: "grouper", count: 1 }] },
    { zh: "连锁反应", en: "Chain Reaction", start: 3, goal: { type: "eat", count: 22 }, time: 80, star3: { type: "frenzy", value: 2 }, hunters: [{ tier: 4, species: "grouper", count: 2 }] },
    { zh: "毒纹", en: "Venom Stripe", start: 4, goal: { type: "grow", tier: 5 }, time: 90, star3: { type: "parTime", value: 32 }, hunters: [{ tier: 5, species: "grouper", count: 1 }] },
    { zh: "海藻深处", en: "Deep Weeds", start: 4, goal: { type: "eat", count: 26 }, time: 85, star3: { type: "frenzy", value: 2 }, hunters: [{ tier: 5, species: "grouper", count: 2 }] },
    { zh: "顺流而下", en: "With the Flow", start: 4, goal: { type: "grow", tier: 5 }, time: 85, star3: { type: "parTime", value: 30 }, hunters: [{ tier: 5, species: "grouper", count: 1 }] },
    { zh: "密林猎手", en: "Thicket Hunter", start: 5, goal: { type: "eat", count: 28 }, time: 95, star3: { type: "frenzy", value: 2 }, hunters: [{ tier: 6, species: "shark", count: 1 }, { tier: 5, species: "grouper", count: 1 }] },
    { zh: "密林之主", en: "Lord of the Weeds", start: 5, goal: { type: "grow", tier: 6 }, time: 105, star3: { type: "parTime", value: 38 }, hunters: [{ tier: 6, species: "shark", count: 1 }, { tier: 5, species: "grouper", count: 1 }] },
  ],
  // ---------- ③ 水母迷阵 ----------
  [
    { zh: "同行", en: "Together", start: 4, goal: { type: "grow", tier: 5 }, time: 95, star3: { type: "shoal", value: 3 }, hunters: [{ tier: 5, species: "grouper", count: 1 }] },
    { zh: "麻痹触须", en: "Numbing Touch", start: 4, goal: { type: "grow", tier: 5 }, time: 90, star3: { type: "parTime", value: 30 }, hazards: { jelly: 3, urchin: 2 }, hunters: [{ tier: 5, species: "grouper", count: 1 }] },
    { zh: "触手之间", en: "Between Tentacles", start: 4, goal: { type: "eat", count: 24 }, time: 85, star3: { type: "shoal", value: 3 }, hazards: { jelly: 3, urchin: 1 }, hunters: [{ tier: 5, species: "grouper", count: 2 }] },
    { zh: "顽皮鱼群", en: "Playful Shoal", start: 5, goal: { type: "grow", tier: 6 }, time: 95, star3: { type: "shoal", value: 3 }, hunters: [{ tier: 6, species: "shark", count: 1 }] },
    { zh: "迷阵深处", en: "Maze Depths", start: 5, goal: { type: "eat", count: 28 }, time: 95, star3: { type: "parTime", value: 42 }, hazards: { jelly: 3, urchin: 2 }, hunters: [{ tier: 6, species: "shark", count: 1 }] },
    { zh: "海胆阵", en: "Urchin Field", start: 5, goal: { type: "grow", tier: 6 }, time: 95, star3: { type: "parTime", value: 34 }, hazards: { urchin: 3 }, hunters: [{ tier: 6, species: "shark", count: 1 }] },
    { zh: "水母回廊", en: "Jelly Corridor", start: 6, goal: { type: "eat", count: 30 }, time: 105, star3: { type: "shoal", value: 3 }, hazards: { jelly: 3, urchin: 1 }, hunters: [{ tier: 7, species: "orca", count: 1 }] },
    { zh: "迷阵中心", en: "Heart of the Maze", start: 6, goal: { type: "grow", tier: 7 }, time: 115, star3: { type: "parTime", value: 48 }, hazards: { jelly: 2, urchin: 1 }, hunters: [{ tier: 7, species: "orca", count: 1 }] },
  ],
  // ---------- ④ 沉船海沟 ----------
  [
    { zh: "下潜", en: "Dive", start: 5, goal: { type: "grow", tier: 6 }, time: 95, star3: { type: "parTime", value: 36 }, hunters: [{ tier: 6, species: "shark", count: 1 }] },
    { zh: "压强", en: "Pressure", start: 5, goal: { type: "grow", tier: 6 }, time: 90, star3: { type: "parTime", value: 36 }, hunters: [{ tier: 6, species: "shark", count: 1 }] },
    { zh: "换气", en: "Air", start: 5, goal: { type: "eat", count: 26 }, time: 95, star3: { type: "parTime", value: 46 }, hazards: { mine: 1, chest: 2, urchin: 1 }, hunters: [{ tier: 6, species: "shark", count: 1 }] },
    { zh: "残骸", en: "Wreckage", start: 6, goal: { type: "grow", tier: 7 }, time: 100, star3: { type: "parTime", value: 40 }, hunters: [{ tier: 7, species: "orca", count: 1 }] },
    { zh: "渔网", en: "Drift Net", start: 6, goal: { type: "eat", count: 28 }, time: 100, star3: { type: "parTime", value: 50 }, hazards: { net: 2, mine: 1, chest: 2, urchin: 1 }, hunters: [{ tier: 7, species: "orca", count: 1 }, { tier: 6, species: "shark", count: 1 }] },
    { zh: "深沟", en: "The Trench", start: 6, goal: { type: "grow", tier: 7 }, time: 95, star3: { type: "parTime", value: 38 }, hunters: [{ tier: 7, species: "orca", count: 1 }] },
    { zh: "宝箱", en: "Sunken Chests", start: 6, goal: { type: "eat", count: 32 }, time: 105, star3: { type: "parTime", value: 54 }, hazards: { chest: 4, net: 1, mine: 1, urchin: 1 }, hunters: [{ tier: 7, species: "orca", count: 1 }] },
    { zh: "海沟之底", en: "Trench Floor", start: 7, goal: { type: "eat", count: 34 }, time: 120, star3: { type: "parTime", value: 60 }, hazards: { mine: 1, net: 1, chest: 3, urchin: 1 }, hunters: [{ tier: 7, species: "orca", count: 1 }] },
  ],
  // ---------- ⑤ 深渊王座 ----------
  [
    { zh: "咬尾", en: "Tail Bite", start: 6, goal: { type: "tail", count: 1 }, time: 90, star3: { type: "parTime", value: 24 }, hunters: [{ tier: 7, species: "barracuda", count: 1, elite: true }] },
    { zh: "梭鱼", en: "Barracuda", start: 6, goal: { type: "tail", count: 1 }, time: 95, star3: { type: "parTime", value: 40 }, hunters: [{ tier: 7, species: "barracuda", count: 2, elite: true }, { tier: 6, species: "shark", count: 1 }] },
    { zh: "双刃", en: "Twin Blades", start: 6, goal: { type: "tail", count: 2 }, time: 100, star3: { type: "parTime", value: 44 }, hunters: [{ tier: 7, species: "barracuda", count: 2, elite: true }] },
    { zh: "王者对决", en: "Royal Duel", start: 7, goal: { type: "tail", count: 2 }, time: 105, star3: { type: "parTime", value: 38 }, hunters: [{ tier: 7, species: "barracuda", count: 1, elite: true }, { tier: 7, species: "shark", count: 1, elite: true }] },
    { zh: "霸主巡游", en: "Dominance", start: 7, goal: { type: "tail", count: 3 }, time: 110, star3: { type: "parTime", value: 50 }, hunters: [{ tier: 7, species: "barracuda", count: 2, elite: true }, { tier: 7, species: "orca", count: 1, elite: true }] },
    { zh: "深渊猎场", en: "Abyssal Hunt", start: 7, goal: { type: "tail", count: 3 }, time: 115, star3: { type: "parTime", value: 52 }, hunters: [{ tier: 7, species: "barracuda", count: 2, elite: true }, { tier: 7, species: "shark", count: 1, elite: true }] },
    { zh: "王座之前", en: "Before the Throne", start: 7, goal: { type: "tail", count: 4 }, time: 120, star3: { type: "parTime", value: 64 }, hunters: [{ tier: 7, species: "barracuda", count: 3, elite: true }, { tier: 7, species: "orca", count: 1, elite: true }] },
    { zh: "鲨鱼王", en: "The Shark King", start: 7, goal: { type: "tail", count: 1 }, time: 120, star3: { type: "parTime", value: 56 }, hunters: [{ tier: 7, species: "shark", count: 1, elite: true, boss: true }, { tier: 7, species: "barracuda", count: 1, elite: true }] },
  ],
];

// 出场权重：约 3/4 是可食猎物，1/4 是同级（互不相犯，纯粹陪游）。
// 保留重复项就是保留权重（pick 均匀抽样）。比玩家大的鱼一律来自上面显式配置的 hunters。
function tierWindow(start) {
  const edible = Math.max(1, start - 1);
  return [edible, edible, edible, Math.min(7, start)];
}

function buildLevel(zone, row, index) {
  const startTier = row.start ?? 2;
  return {
    id: `${zone.zone}-${index}`,
    zone: zone.zone,
    zoneSlug: zone.slug,
    index,
    nameZh: row.zh,
    nameEn: row.en,
    startTier,
    hearts: 3,
    timeLimit: row.time ?? 90,
    goal: row.goal,
    star3: row.star3 ?? { type: "parTime", value: Math.round((row.time ?? 90) * 0.6) },
    preyTiers: row.preyTiers ?? tierWindow(startTier),
    species: row.species ?? zone.species,
    hazards: { ...zone.hazards, ...(row.hazards ?? {}) },
    powers: row.powers ?? zone.powers,
    mechanics: { ...zone.mechanics, ...(row.mechanics ?? {}) },
    kelp: row.kelp ?? (zone.mechanics.kelp ? 5 : 0),
    initialPrey: row.initialPrey ?? 10,
    spawn: { hunters: row.hunters ?? [] },
    invulnOnStart: index === 1 ? 3 : 2,
  };
}

export const LEVELS = Object.freeze(
  ZONES.flatMap((zone) => ROWS[zone.zone - 1].map((row, i) => buildLevel(zone, row, i + 1))),
);

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function levelIndex(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

export function zoneOf(zone) {
  return ZONES.find((entry) => entry.zone === zone) ?? ZONES[0];
}

export function levelsOfZone(zone) {
  return LEVELS.filter((level) => level.zone === zone);
}

export function nextLevelId(id) {
  const index = levelIndex(id);
  if (index < 0 || index >= LEVELS.length - 1) return null;
  return LEVELS[index + 1].id;
}

export function maxPearlsOfZone(zone) {
  return levelsOfZone(zone).length * 3;
}

export const TOTAL_PEARLS = LEVELS.length * 3;

// 海域解锁：累计珍珠数达标即开下一片（第 1 片永远开放）。
export function zoneUnlocked(zone, pearls) {
  const entry = zoneOf(zone);
  return (pearls ?? 0) >= entry.pearlGate;
}

export function zoneGate(zone) {
  return zoneOf(zone).pearlGate;
}

export function firstLevelOfZone(zone) {
  const list = levelsOfZone(zone);
  return (list[0] ?? LEVELS[0]).id;
}

export function levelIdsOfZone(zone) {
  return levelsOfZone(zone).map((level) => level.id);
}

// 结算面板用的目标摘要，供 i18n 拼装。
export function goalDescriptor(level) {
  const goal = level.goal ?? {};
  if (goal.type === "grow") return { type: "grow", value: goal.tier };
  if (goal.type === "eat") return { type: "eat", value: goal.count };
  if (goal.type === "tail") return { type: "tail", value: goal.count };
  return { type: "endless", value: 0 };
}
