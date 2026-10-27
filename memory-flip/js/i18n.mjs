// 盲盒记忆牌 — 中英双语中心
// 全站共享偏好 localStorage["doin.lang"]（zh / en）

export const LOCALES = ["zh", "en"];
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

export const isLocale = (val) => LOCALES.includes(val);

export function loadLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(LANG_KEY);
      if (isLocale(v)) return v;
    }
  } catch { /* 隐私模式静默降级 */ }
  return DEFAULT_LOCALE;
}

export function saveLocale(locale) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, isLocale(locale) ? locale : DEFAULT_LOCALE);
    }
  } catch { /* 静默降级 */ }
}

export function htmlLang(locale) {
  return locale === "en" ? "en" : "zh-CN";
}

export const strings = {
  zh: {
    // 通用
    backHome: "门户",
    gameTitle: "盲盒记忆牌",
    noscript: "需要启用 JavaScript 才能游玩。",
    // 模式
    modeCampaign: "盲盒闯关",
    modeDaily: "每日盲盒",
    modeSandbox: "沙盒",
    // 章节
    ch_1: "第 1 章 · 初识盲盒",
    ch_2: "第 2 章 · 咯哒咯哒",
    ch_3: "第 3 章 · 大转盘",
    ch_4: "第 4 章 · 盘面齿轮",
    ch_5: "第 5 章 · 大师残局",
    // HUD
    misses: "错配",
    combo: "连击",
    maxCombo: "最长连击",
    turn: "回合",
    missBudget: "翻错预算",
    pairs: "已配对",
    pairsRemain: "剩余对数",
    timeUsed: "用时",
    // 按钮
    btnStart: "开始",
    btnRestart: "重开",
    btnPause: "暂停",
    btnResume: "继续",
    btnNext: "下一关",
    btnReplay: "再来一关",
    btnBack: "返回菜单",
    btnHelp: "玩法",
    btnLang: "EN",
    btnSound: "音效",
    btnSandboxStart: "进入沙盒",
    // 弹窗
    welcomeTitle: "翻开盲盒找配对",
    welcomeDesc: "翻开两张盲盒找配对，配不中时四周相邻的盒子会咯哒一声顺时针轮转一格——记死位置在这里行不通。",
    pauseTitle: "已暂停",
    pauseDesc: "按 P 或回车继续",
    winTitle: "通关！",
    loseTitle: "翻错用尽",
    finalMisses: "错配次数",
    finalCombo: "最长连击",
    finalTime: "用时",
    flawlessBadge: "工坊大师印章 · 零错通关",
    // 关卡列表
    levelLockHint: "通关前一章解锁",
    starShort: "星",
    // 沙盒
    sandboxTitle: "工坊沙盒",
    sandboxSize: "盘面尺寸",
    sandboxMech: "位移强度",
    sandboxSeed: "种子",
    sandboxStart: "开局",
    sandboxTip: "起始即开放，先练手再闯关",
    // 玩法
    rulesTitle: "玩法说明",
    ruleFlip: "点击盒子翻开盒盖，每次最多翻 2 张",
    ruleMatch: "配对成功收入集藏册，连击可继续翻",
    ruleMiss: "错配盖回，触发咯哒轮转：两张错配牌位的邻位盖牌顺时针前进 1 格",
    ruleMech: "第 2 章 4 邻 / 第 3 章 8 邻 / 第 4 章象限整体旋转 / 第 5 章限定翻错次数",
    ruleKeys: "方向键移动光标 + 回车翻开；翻第 1 张后再点同一张 = 取消",
    rulePause: "P 键暂停 / 继续",
    ruleDaily: "每日固定种子生成一关，比谁最少错",
    ruleSandbox: "沙盒模式起始即开放，自选盘面尺寸、位移强度与图腾集子集",
    // 图腾名（部分样本；其余走 placeholder）
    totem_octo_pop: "章鱼博士",
    totem_missy_miao: "辣妹猫",
    totem_brick_bro: "积木哥",
    totem_rice_imp: "啃饭团的小恶魔",
    totem_beaver_kid: "河狸弟",
    totem_puffer_bun: "气鼓兔",
    totem_cactus_straw: "仙人掌吸管",
    totem_cloud_toast: "云朵吐司",
    totem_twin_fox: "双胞胎狐狸",
    totem_cherry_golem: "樱桃魔像",
    totem_mail_moth: "邮差蛾",
    totem_pilot_pear: "梨子飞行员",
    totem_donut_yeti: "甜甜圈雪人",
    totem_gourd_witch: "葫芦女巫",
    totem_spring_hog: "弹簧猪",
    totem_tape_dino: "磁带恐龙",
    totem_mascot_0: "团子 1 号",
    totem_mascot_1: "团子 2 号",
    totem_mascot_2: "团子 3 号",
    totem_mascot_3: "团子 4 号",
    totem_mascot_4: "团子 5 号",
    totem_mascot_5: "团子 6 号",
    totem_mascot_6: "团子 7 号",
    totem_mascot_7: "团子 8 号",
    totem_mascot_8: "团子 9 号",
    totem_mascot_9: "团子 10 号",
    totem_mascot_10: "团子 11 号",
    totem_mascot_11: "团子 12 号",
    totem_mascot_12: "团子 13 号",
    totem_mascot_13: "团子 14 号",
    // 章节描述
    chDesc_1: "纯经典翻牌，无位移——熟悉底盘与图腾集",
    chDesc_2: "翻错触发 4 邻顺时针轮转 1 格——位置在变",
    chDesc_3: "邻域扩为 8 邻（含四角），失败代价更高",
    chDesc_4: "盘面分为 2×2 象限，错配让目标象限整体旋转 90°",
    chDesc_5: "预置残局 + 限定翻错次数，每关一道独立谜题",
  },
  en: {
    backHome: "Home",
    gameTitle: "Memory Flip",
    noscript: "JavaScript is required to play.",
    modeCampaign: "Campaign",
    modeDaily: "Daily Pop",
    modeSandbox: "Sandbox",
    ch_1: "Chapter 1 · First Pop",
    ch_2: "Chapter 2 · Tick-Tock",
    ch_3: "Chapter 3 · Carousel",
    ch_4: "Chapter 4 · Gearbox",
    ch_5: "Chapter 5 · Mastermind",
    misses: "Misses",
    combo: "Combo",
    maxCombo: "Best Combo",
    turn: "Turn",
    missBudget: "Miss Budget",
    pairs: "Pairs",
    pairsRemain: "Pairs Left",
    timeUsed: "Time",
    btnStart: "Start",
    btnRestart: "Restart",
    btnPause: "Pause",
    btnResume: "Resume",
    btnNext: "Next Level",
    btnReplay: "Retry",
    btnBack: "Main Menu",
    btnHelp: "Rules",
    btnLang: "中文",
    btnSound: "Sound",
    btnSandboxStart: "Enter Sandbox",
    welcomeTitle: "Flip the Blind Boxes",
    welcomeDesc: "Flip two boxes to find a pair. On a mismatch the neighboring boxes tick clockwise by one slot — dead-reckoning positions won't work here.",
    pauseTitle: "Paused",
    pauseDesc: "Press P or Enter to resume",
    winTitle: "Cleared!",
    loseTitle: "Out of Misses",
    finalMisses: "Misses",
    finalCombo: "Best Combo",
    finalTime: "Time",
    flawlessBadge: "Workshop Master Seal · Flawless Clear",
    levelLockHint: "Clear previous chapter to unlock",
    starShort: "star",
    sandboxTitle: "Workshop Sandbox",
    sandboxSize: "Board Size",
    sandboxMech: "Rotation Strength",
    sandboxSeed: "Seed",
    sandboxStart: "Start",
    sandboxTip: "Open from the start — practice before the campaign",
    rulesTitle: "How to Play",
    ruleFlip: "Click a box to flip its lid; flip up to 2 boxes per turn",
    ruleMatch: "Match finds the pair into your Codex; combo lets you keep flipping",
    ruleMiss: "Mismatch flips back and triggers Tick-Rotation: the neighboring lids advance one slot clockwise",
    ruleMech: "Ch.2 4-neighbor / Ch.3 8-neighbor / Ch.4 quadrant 90° tilt / Ch.5 limited miss budget",
    ruleKeys: "Arrow keys move cursor + Enter flips; clicking the first flipped box again cancels",
    rulePause: "Press P to pause / resume",
    ruleDaily: "Daily Pop uses a date-based seed — compete for fewest misses",
    ruleSandbox: "Sandbox is open from the start; pick board size, rotation strength and totem subset",
    totem_octo_pop: "Dr. Octo-Pop",
    totem_missy_miao: "Missy Miao",
    totem_brick_bro: "Brick Bro",
    totem_rice_imp: "Rice Imp",
    totem_beaver_kid: "Beaver Kid",
    totem_puffer_bun: "Puffer Bun",
    totem_cactus_straw: "Cactus Straw",
    totem_cloud_toast: "Cloud Toast",
    totem_twin_fox: "Twin Fox",
    totem_cherry_golem: "Cherry Golem",
    totem_mail_moth: "Mail Moth",
    totem_pilot_pear: "Pilot Pear",
    totem_donut_yeti: "Donut Yeti",
    totem_gourd_witch: "Gourd Witch",
    totem_spring_hog: "Spring Hog",
    totem_tape_dino: "Tape Dino",
    totem_mascot_0: "Mascot No.1",
    totem_mascot_1: "Mascot No.2",
    totem_mascot_2: "Mascot No.3",
    totem_mascot_3: "Mascot No.4",
    totem_mascot_4: "Mascot No.5",
    totem_mascot_5: "Mascot No.6",
    totem_mascot_6: "Mascot No.7",
    totem_mascot_7: "Mascot No.8",
    totem_mascot_8: "Mascot No.9",
    totem_mascot_9: "Mascot No.10",
    totem_mascot_10: "Mascot No.11",
    totem_mascot_11: "Mascot No.12",
    totem_mascot_12: "Mascot No.13",
    totem_mascot_13: "Mascot No.14",
    chDesc_1: "Classic flip, no rotation — learn the bases",
    chDesc_2: "Mismatch rotates 4 neighbors clockwise by one slot",
    chDesc_3: "Rotation expands to 8 neighbors including corners",
    chDesc_4: "Board splits into 2x2 quadrants, mismatch tilts the target quadrant 90°",
    chDesc_5: "Endgame puzzles with a tight miss budget",
  },
};

/** 取图腾展示名 */
export function totemName(locale, totemId) {
  const t = strings[locale] ?? strings.zh;
  return t[`totem_${totemId}`] ?? totemId;
}

/** 取章节展示名 */
export function chapterName(locale, chapterOrder) {
  const t = strings[locale] ?? strings.zh;
  return t[`ch_${chapterOrder}`] ?? `Chapter ${chapterOrder}`;
}

export function chapterDesc(locale, chapterOrder) {
  const t = strings[locale] ?? strings.zh;
  return t[`chDesc_${chapterOrder}`] ?? "";
}

/** 热更新：遍历 [data-i18n] 与 [data-i18n-aria] 替换文本与属性 */
export function applyLocale(locale) {
  saveLocale(locale);
  const t = strings[locale] ?? strings.zh;
  if (typeof document === "undefined") return t;
  document.documentElement.lang = htmlLang(locale);
  document.title = `${t.gameTitle} · DOIN`;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (t[key] !== undefined) el.setAttribute("aria-label", t[key]);
  });
  const langBtn = document.getElementById("btn-lang");
  if (langBtn) langBtn.textContent = locale === "en" ? "中文" : "EN";
  return t;
}