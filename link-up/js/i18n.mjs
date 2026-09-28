// 连连看 link-up · 全站共享语言偏好 doin.lang（zh/en 键值严格对齐）

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

export const strings = {
  zh: {
    appTitle: "喜福连连看",
    chapterLabel: "第{ch}章 · {name}",
    levelProgress: "第 {level} / {total} 关",
    score: "得分",
    steps: "步数",
    combo: "连击",
    time: "时间",
    hint: "提示",
    shuffle: "洗牌",
    restart: "重玩",
    pause: "暂停",
    resume: "继续",
    soundOn: "音效开",
    soundOff: "音效关",
    soundToggle: "音效开关",
    languageToggle: "切换语言",
    help: "玩法说明",
    close: "关闭",
    switchLang: "EN",
    howToPlayTitle: "玩法说明",
    selectLevel: "选择关卡",
    locked: "未解锁",
    daily: "每日挑战",
    dailyBest: "最高分 {score}",
    winTitle: "清盘成功！",
    winSubtitle: "这一局，连得漂亮。",
    victoryKicker: "LUCKY CLEAR",
    victoryAward: "福运已点亮 · 下一局继续加成",
    winTime: "用时",
    timeoutTitle: "时间到！",
    timeoutSubtitle: "别急，整理阵形再来一局。",
    newBest: "🎉 新高分！",
    winScore: "得分",
    winSteps: "步数",
    winCombo: "最长连击",
    replay: "重玩本关",
    next: "下一关",
    backToLevels: "返回选关",
    gotIt: "我知道了",
    noMove: "当前没有可消除对，试试洗牌",
    noHint: "没有可消除的对",
    shuffleDone: "已重新洗牌",
    pausedToast: "已暂停",
    paused: "已暂停",
    pauseHint: "点击“继续”恢复游戏",
    home: "返回门户首页",
    boardAria: "连连看棋盘",
    help1: "1. 点击选中一个图案，再点击另一个相同图案发起连线。",
    help2: "2. 通路最多拐两个弯，途中格子必须为空，允许从棋盘外绕行。",
    help3: "3. 连线成功即消除一对；清空整盘即过关，绝不失败、只赢不输。",
    help4: "4. 卡壳时点“提示”点亮一对，点“洗牌”重新铺盘；连续消除攒连击加分。",
    chapterName_1: "初识",
    chapterName_2: "绕行",
    chapterName_3: "地形",
    chapterName_4: "四连",
    chapterName_5: "大师",
    cellLabel: "{s}牌",
    tileNames: ["灯笼", "如意", "锦鱼", "祥云", "元宝", "莲花", "喜鼓", "团扇", "蜜桃", "玉佩", "星芒", "竹叶", "玉石", "铜铃", "绳结", "福轮"],
    clearedAll: "全部 50 关已通关！",
  },
  en: {
    appTitle: "Fortune Link",
    chapterLabel: "Ch. {ch} · {name}",
    levelProgress: "Level {level} / {total}",
    score: "Score",
    steps: "Steps",
    combo: "Combo",
    time: "Time",
    hint: "Hint",
    shuffle: "Shuffle",
    restart: "Restart",
    pause: "Pause",
    resume: "Resume",
    soundOn: "Sound On",
    soundOff: "Sound Off",
    soundToggle: "Toggle sound",
    languageToggle: "Switch language",
    help: "How to play",
    close: "Close",
    switchLang: "中文",
    howToPlayTitle: "How to Play",
    selectLevel: "Select Level",
    locked: "Locked",
    daily: "Daily Challenge",
    dailyBest: "Best {score}",
    winTitle: "Cleared!",
    winSubtitle: "A beautiful chain, perfectly linked.",
    victoryKicker: "LUCKY CLEAR",
    victoryAward: "Fortune lit · Keep the streak alive",
    winTime: "Time",
    timeoutTitle: "Time Up!",
    timeoutSubtitle: "Reset the pattern and try again.",
    newBest: "🎉 New Best!",
    winScore: "Score",
    winSteps: "Steps",
    winCombo: "Longest Combo",
    replay: "Replay",
    next: "Next Level",
    backToLevels: "Levels",
    gotIt: "Got It",
    noMove: "No pairs available — try Shuffle",
    noHint: "No matching pair found",
    shuffleDone: "Shuffled",
    pausedToast: "Paused",
    paused: "Paused",
    pauseHint: "Click Resume to continue",
    home: "Back to home",
    boardAria: "Link Link board",
    help1: "1. Tap a tile to select it, then tap another identical tile to link them.",
    help2: "2. The path can turn at most twice and must cross empty cells; going around the outer edge is allowed.",
    help3: "3. A successful link clears the pair; clear the whole board to win — you can never lose.",
    help4: "4. Stuck? Tap Hint to spotlight a pair or Shuffle to redeal; chain clears for combos.",
    chapterName_1: "Rookie",
    chapterName_2: "Detour",
    chapterName_3: "Terrain",
    chapterName_4: "Quads",
    chapterName_5: "Master",
    cellLabel: "{s} tile",
    tileNames: ["Lantern", "Ruyi", "Lucky Fish", "Cloud", "Ingot", "Lotus", "Drum", "Fan", "Peach", "Jade", "Star", "Leaf", "Gem", "Bell", "Knot", "Fortune Wheel"],
    clearedAll: "All 50 levels cleared!",
  },
};

export function isLocale(locale) {
  return typeof locale === "string" && LOCALES.includes(locale);
}

export function detectLocale() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch {
    // 降级容错
  }
  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      if (navigator.language.toLowerCase().startsWith("zh")) return "zh";
    }
  } catch {
    // 降级容错
  }
  return DEFAULT_LOCALE;
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LANG_KEY, locale);
    }
  } catch {
    // 忽略私有模式异常
  }
}

export function htmlLang(locale) {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function format(str, params) {
  if (!str || !params) return str || "";
  return str.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key]) : `{${key}}`
  );
}
