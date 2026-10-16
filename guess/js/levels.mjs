// levels.mjs —— 猎场表：5 章 × 6 关主线（30 关） + 通关解锁的 6 关盲猎
// 难度轴遵循策划案：每章只加一种噪声，循序渐进。

export const LEVELS_PER_CHAPTER = 6;
export const MAIN_COUNT = 30;
export const BLIND_COUNT = 6;
export const LEVEL_COUNT = MAIN_COUNT + BLIND_COUNT;

export const CHAPTERS = [
  { id: 1, key: "calm", nameKey: "ch1", mech: "none" },
  { id: 2, key: "drift", nameKey: "ch2", mech: "drift" },
  { id: 3, key: "liar", nameKey: "ch3", mech: "liar" },
  { id: 4, key: "fog", nameKey: "ch4", mech: "fog" },
  { id: 5, key: "king", nameKey: "ch5", mech: "combo" },
  { id: 6, key: "blind", nameKey: "ch6", mech: "blind" },
];

/** 信息论最优步数：二分查找的理论下限 */
export function parOf(range) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, range))));
}

/** 让噪声永远只占少数：雾区单段不超过全长的 8%，且总遮蔽不超过 20% */
export const FOG_PCT = 0.06;
export const FOG_MIN_WIDTH = 6;

function level(id, ch, max, cfg = {}) {
  const min = 1;
  const range = max - min + 1;
  return {
    id,
    ch,
    min,
    max,
    range,
    par: parOf(range),
    drift: cfg.drift ?? 0,
    driftTurns: cfg.driftTurns ?? 0,
    liars: cfg.liars ?? 0,
    fogSegs: cfg.fogSegs ?? 0,
    fogPct: cfg.fogPct ?? FOG_PCT,
    blind: cfg.blind === true,
    temperaturePrecision: cfg.temperaturePrecision ?? 1,
    budget: cfg.budget ?? parOf(range) + 3,
    tools: {
      probe: cfg.probe ?? 0,
      scan: cfg.scan ?? 0,
      recall: cfg.recall ?? 1,
    },
  };
}

function build() {
  const out = [];
  // 第一章 静水试航：纯方向 + 温度，教学
  [40, 60, 80, 100, 100, 120].forEach((max, i) => {
    out.push(level(out.length + 1, 1, max, { budget: parOf(max) + 3, temperaturePrecision: 0.6 }));
  });
  // 第二章 暗流涌动：目标在前几投后会漂移
  const driftSpec = [
    { max: 150, drift: 2, driftTurns: 3 },
    { max: 180, drift: 2, driftTurns: 3 },
    { max: 200, drift: 2, driftTurns: 3 },
    { max: 200, drift: 2, driftTurns: 4 },
    { max: 220, drift: 3, driftTurns: 4 },
    { max: 250, drift: 3, driftTurns: 4 },
  ];
  driftSpec.forEach((s) => {
    out.push(level(out.length + 1, 2, s.max, { ...s, budget: parOf(s.max) + 4, probe: 1 }));
  });
  // 第三章 谎灯回波：整局恰有一次方向回波被倒置
  [120, 150, 150, 180, 180, 200].forEach((max) => {
    out.push(level(out.length + 1, 3, max, { liars: 1, budget: parOf(max) + 5, probe: 1, scan: 1 }));
  });
  // 第四章 浊流深潜：雾区内回波静默（位置开局明示）
  const fogSpec = [
    { max: 200, fogSegs: 1 },
    { max: 250, fogSegs: 1 },
    { max: 300, fogSegs: 2 },
    { max: 300, fogSegs: 2 },
    { max: 350, fogSegs: 2 },
    { max: 400, fogSegs: 2 },
  ];
  fogSpec.forEach((s) => {
    out.push(level(out.length + 1, 4, s.max, { ...s, budget: parOf(s.max) + 6, probe: 2, scan: 1 }));
  });
  // 第五章 猎王之境：随机组合两种噪声
  const combos = [
    { drift: 2, driftTurns: 3, liars: 1 },
    { drift: 2, driftTurns: 3, fogSegs: 1 },
    { liars: 1, fogSegs: 1 },
    { drift: 3, driftTurns: 4, liars: 1 },
    { drift: 3, driftTurns: 4, fogSegs: 2 },
    { liars: 1, fogSegs: 2 },
  ];
  [300, 350, 400, 450, 500, 500].forEach((max, i) => {
    out.push(level(out.length + 1, 5, max, { ...combos[i], budget: parOf(max) + 8, probe: 2, scan: 1 }));
  });
  // 第六章 盲猎：关闭温度提示（通关主线解锁）
  const blindSpec = [
    { max: 120 },
    { max: 150, drift: 2, driftTurns: 3 },
    { max: 200, liars: 1 },
    { max: 250 },
    { max: 300, drift: 3, driftTurns: 4 },
    { max: 350, liars: 1 },
  ];
  blindSpec.forEach((s) => {
    out.push(
      level(out.length + 1, 6, s.max, {
        ...s,
        blind: true,
        budget: parOf(s.max) + 5,
        probe: 1,
        scan: s.liars ? 1 : 0,
      })
    );
  });
  return out;
}

export const LEVELS = build();

export function levelById(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1 || n > LEVEL_COUNT) return null;
  return LEVELS[n - 1] ?? null;
}

export function chapterById(id) {
  return CHAPTERS.find((c) => c.id === id) ?? null;
}

export function chapterOfLevel(id) {
  const lvl = levelById(id);
  return lvl ? chapterById(lvl.ch) : null;
}

export function isBlind(id) {
  return levelById(id)?.blind === true;
}

/** 机制标签：给关卡简报用（zh/en 文案由 i18n 组装） */
export function mechTags(level) {
  if (!level) return [];
  const tags = [];
  if (level.drift > 0) tags.push({ key: "drift", drift: level.drift, turns: level.driftTurns });
  if (level.liars > 0) tags.push({ key: "liar", count: level.liars });
  if (level.fogSegs > 0) tags.push({ key: "fog", count: level.fogSegs });
  if (level.blind) tags.push({ key: "blind" });
  if (!tags.length) tags.push({ key: "calm" });
  return tags;
}
