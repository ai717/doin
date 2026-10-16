// i18n.mjs —— 中英双语表，语言偏好统一读写全站共享 key localStorage["doin.lang"]

export const LANG_KEY = "doin.lang";
export const LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "zh";

const DICT = {
  zh: {
    appTitle: "六边蜜筑",
    appKicker: "蜂巢满行消除 · 三轴连击",
    docTitle: "六边蜜筑 · DOIN 在线小游戏",
    metaDesc: "把蜜蜡块填进蜂巢棋盘，凑满任意一条蜂房行就蜜流消除——消 4 行触发蜜流狂潮，连击倍率连乘，极限 2^18 蜂王浆金标。",
    back: "返回门户",
    sound: "音效",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",

    modeCampaign: "单人章节",
    modeSurvival: "经典生存",
    modeDuel: "同屏双人",
    modeCampaignDesc: "4 章 × 6 关，目标成长。",
    modeSurvivalDesc: "无限块队列，放不下即结束。",
    modeDuelDesc: "共享棋盘轮流放置。",
    modeStart: "开局",

    hudScore: "蜜罐",
    hudRows: "消除",
    hudMult: "倍率",
    hudCombo: "连击",
    hudRush: "蜜流狂潮",
    hudPieces: "剩余块",
    hudGoal: "目标",
    hudPlayer: "玩家",

    stat_queue: "块队列",
    actPick: "取块",
    actRotate: "旋转",
    actLevels: "选关",
    btnResume: "继续游戏",
    actPlace: "放置",
    actReset: "重开",

    toastNoPlace: "这里放不下",
    toastRush: "蜜流狂潮！",
    toastRoyal: "蜂王浆金标！",
    toastWin: "目标达成",
    toastLose: "块用完了",
    toastStuck: "棋盘满了",

    readyTitle: "六边蜜筑",
    readyKicker: "蜂房酿蜜工坊",
    readyDesc: "把随机蜜蜡块填进 61 格蜂巢棋盘，凑满 0°/60°/120° 任意一条蜂房行就蜜流消除。消 4 行触发蜜流狂潮，连击倍率连乘，极限 2^18 = 262144 倍蜂王浆金标！",
    readyHint: "三轴空间读盘：每格有 6 个邻居，满行沿三条轴任意方向成立。",

    resultTitle: "本局结算",
    resultScore: "蜜罐总分",
    resultRows: "消除行数",
    resultMaxMult: "最高倍率",
    resultWin: "达成目标",
    resultLose: "未达成",
    resultP1: "玩家 1 胜",
    resultP2: "玩家 2 胜",
    resultTie: "平局",
    btnAgain: "再来一局",
    btnNextLevel: "下一关",
    btnLevels: "章节选择",
    btnModes: "换模式",

    levelsTitle: "蜜房章节",
    levelsNote: "4 章 × 6 关，消得越利落星级越高。",
    statCleared: "已通 {n} / {m}",
    statStars: "总星 {n}",
    lockedNote: "通关上一关解锁",
    ch1_title: "第 1 章 · 蜜房入门",
    ch2_title: "第 2 章 · 三轴共鸣",
    ch3_title: "第 3 章 · 蜜流狂潮",
    ch4_title: "第 4 章 · 蜂王金标",
    lv1_desc: "累计消除 {n} 行",
    lv2_desc: "学三轴读盘，累计消 {n} 行",
    lv3_desc: "触发蜜流狂潮，累计消 {n} 行",
    lv4_desc: "冲击蜂王金标，累计消 {n} 行",

    tierSingle: "单行",
    tierDouble: "双行 ×2",
    tierTriple: "三行 ×4",
    tierRush: "狂潮 ×16",
    tierGold: "金蜜 ×256",
    tierRoyal: "蜂王浆 ×2^18",

    helpTitle: "玩法说明",
    help1: "1. 从顶部块队列取一块蜜蜡，拖到蜂巢棋盘空位放置；滚轮或右键旋转 60°。",
    help2: "2. 每次放置后，沿 0°/60°/120° 三轴扫描——任意一条蜂房行满格即蜜流消除。",
    help3: "3. 一次消 N 行，倍率 = 2^(N-1)：1 行 ×1、2 行 ×2、3 行 ×4、4 行 ×8。",
    help4: "4. 消 ≥4 行触发「蜜流狂潮」：此后每次放置即消，倍率再 ×2 连乘，中断则狂潮结束。",
    help5: "5. 倍率封顶 2^18 = 262144 倍，触发蜂王浆金标演出。",
    help6: "6. 消除后上方块沿纵轴下落填补，可触发级联连消。",
    help7: "7. 章节模式：给定块序达成目标行数即过关；生存模式：块队列无限，放不下即结束。",
    help8: "8. 双人蜂战：共享棋盘轮流放置，你占的格就是对手缺的空位。",
    helpClose: "我知道了",

    mult18: "2^18",
    scoreCap: "262144",
  },
  en: {
    appTitle: "Hexfit",
    appKicker: "Honeycomb Tri-Axis Clear",
    docTitle: "Hexfit · DOIN Online Mini Games",
    metaDesc: "Drop wax pieces into a honeycomb board; fill any full row along the 0/60/120 axes and it melts away. Clear 4 rows to trigger Honey Rush — combo multipliers stack, capping at 2^18 Royal Jelly.",
    back: "Back to portal",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to play",

    modeCampaign: "Hex Campaign",
    modeSurvival: "Survival",
    modeDuel: "Shared-Hive Duel",
    modeCampaignDesc: "4 chapters x 6 levels; grow toward goals.",
    modeSurvivalDesc: "Endless queue; ends when nothing fits.",
    modeDuelDesc: "Share one board; alternate placement.",
    modeStart: "Start",

    hudScore: "Honey Jar",
    hudRows: "Rows",
    hudMult: "Multiplier",
    hudCombo: "Combo",
    hudRush: "Honey Rush",
    hudPieces: "Pieces left",
    hudGoal: "Goal",
    hudPlayer: "Player",

    stat_queue: "Queue",
    actPick: "Pick",
    actRotate: "Rotate",
    actLevels: "Levels",
    btnResume: "Resume",
    actPlace: "Place",
    actReset: "Reset",

    toastNoPlace: "Does not fit here",
    toastRush: "Honey Rush!",
    toastRoyal: "Royal Jelly!",
    toastWin: "Goal reached",
    toastLose: "Out of pieces",
    toastStuck: "Board is full",

    readyTitle: "Hexfit",
    readyKicker: "Honeycomb Craft",
    readyDesc: "Drop random wax pieces into a 61-cell honeycomb. Fill any full row along the 0/60/120 degree axes and honey flows away. Clear 4 rows to trigger Honey Rush — combo multipliers stack, capping at 2^18 = 262144x Royal Jelly!",
    readyHint: "Tri-axis space: every cell has 6 neighbors; rows clear in three directions.",

    resultTitle: "Round settled",
    resultScore: "Honey total",
    resultRows: "Rows cleared",
    resultMaxMult: "Best multiplier",
    resultWin: "Goal reached",
    resultLose: "Goal missed",
    resultP1: "Player 1 wins",
    resultP2: "Player 2 wins",
    resultTie: "Draw",
    btnAgain: "Play again",
    btnNextLevel: "Next level",
    btnLevels: "Chapters",
    btnModes: "Change mode",

    levelsTitle: "Honey Chapters",
    levelsNote: "4 chapters x 6 levels; the cleaner you clear, the more stars.",
    statCleared: "Cleared {n} / {m}",
    statStars: "{n} stars total",
    lockedNote: "Clear the previous level",
    ch1_title: "Chapter 1: First Comb",
    ch2_title: "Chapter 2: Tri-Axis Resonance",
    ch3_title: "Chapter 3: Honey Rush",
    ch4_title: "Chapter 4: Royal Jelly",
    lv1_desc: "Clear {n} rows total",
    lv2_desc: "Read three axes; clear {n} rows",
    lv3_desc: "Trigger Honey Rush; clear {n} rows",
    lv4_desc: "Chase Royal Jelly; clear {n} rows",

    tierSingle: "Single x1",
    tierDouble: "Double x2",
    tierTriple: "Triple x4",
    tierRush: "Rush x16",
    tierGold: "Gold x256",
    tierRoyal: "Royal x2^18",

    helpTitle: "How to play",
    help1: "1. Pick a wax piece from the queue, drag it to an empty spot on the board; scroll or right-click to rotate 60 degrees.",
    help2: "2. After placing, scan along the 0/60/120 degree axes — any fully filled row melts away.",
    help3: "3. Clear N rows at once for multiplier 2^(N-1): 1 row x1, 2 rows x2, 3 rows x4, 4 rows x8.",
    help4: "4. Clearing 4+ rows triggers Honey Rush: every subsequent clear stacks another x2. A non-clearing placement ends the rush.",
    help5: "5. Multiplier caps at 2^18 = 262144x, triggering the Royal Jelly finale.",
    help6: "6. After a clear, blocks above fall down the vertical axis, which can chain into cascade clears.",
    help7: "7. Campaign: a fixed piece sequence; reach the row goal to pass. Survival: endless queue; game ends when nothing fits.",
    help8: "8. Duel: share one board and alternate — the cells you take are the ones your opponent lacks.",
    helpClose: "Got it",

    mult18: "2^18",
    scoreCap: "262144",
  },
};

export function isLocale(locale) {
  return typeof locale === "string" && LOCALES.includes(locale);
}

export function strings(locale) {
  return DICT[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function detectLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch { /* ignore */ }
  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    }
  } catch { /* ignore */ }
  return DEFAULT_LOCALE;
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return DEFAULT_LOCALE;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, locale);
  } catch { /* ignore */ }
  return locale;
}

export function htmlLang(locale) {
  return isLocale(locale) && locale === "en" ? "en" : "zh-CN";
}

export function format(str, params) {
  if (typeof str !== "string") return "";
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

export function applyLocale(root, locale) {
  const s = strings(locale);
  if (!root || typeof root.querySelectorAll !== "function") return s;
  for (const el of root.querySelectorAll("[data-i18n]")) {
    const v = s[el.dataset.i18n];
    if (typeof v === "string" && v) el.textContent = v;
  }
  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    const v = s[el.dataset.i18nTitle];
    if (typeof v === "string" && v) el.setAttribute("title", v);
  }
  for (const el of root.querySelectorAll("[data-i18n-aria]")) {
    const v = s[el.dataset.i18nAria];
    if (typeof v === "string" && v) el.setAttribute("aria-label", v);
  }
  return s;
}
