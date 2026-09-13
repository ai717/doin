// 多语言字典与语言偏好读写。
// 全站共享 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。
// 探测优先级：已保存的 doin.lang → 浏览器 navigator.language → DEFAULT_LOCALE。

export const LOCALES = ["zh", "en"];
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

export const strings = {
  zh: {
    appTitle: "连连看",
    appSubtitle: "琉璃灯市",
    switchLang: "切换语言",
    toggleSound: "音效开关",

    level: "关卡",
    time: "时间",
    combo: "连击",
    score: "得分",
    best: "最高",
    stars: "星级",
    hint: "提示",
    shuffle: "洗牌",
    pause: "暂停",
    resume: "继续",
    restart: "重玩",
    selectLevel: "选择关卡",
    close: "关闭",
    gotIt: "我知道了",

    howToPlayTitle: "游戏玩法",
    help1: "点选两枚图案相同的瓷片，再用一条水平或垂直的折线把它们连起来。",
    help2: "折线最多拐两次弯（0 折直连 / 1 折 / 2 折），不能走斜线。",
    help3: "折线经过的格子必须是空的；棋盘四周留有一圈虚空通道，可以绕出盘外连通。",
    help4: "连通成功即消除并得分；3 秒内连续消除可累积连击。",
    help5: "限时清空整盘过关。若盘面无解会自动洗牌，不消耗你的洗牌次数。",
    help6: "带冰封壳的瓷片点不动：先消掉它周围一圈（含斜向）的瓷片，壳就会被震碎。",
    keyMove: "方向键 / WASD",
    keyMoveDesc: "移动焦点格",
    keyPickDesc: "选中或配对",
    keyCancelDesc: "取消选中",
    keyHintDesc: "提示一对可消",
    keyShuffleDesc: "主动洗牌",
    keyPauseDesc: "暂停 / 继续",

    startTitle: "琉璃灯市 · 连连看",
    startSub: "点两枚相同瓷片，用不超过两折的折线连上，清空整盘过关。",
    unlocked: "已解锁",
    continueGame: "继续游戏",
    endless: "无尽冲分",
    daily: "今日一盘",
    dailySub: "每天一盘，全服同一副盘面",
    dailyBest: "今日最佳",
    dailyToday: "今日",

    paused: "已暂停",
    pauseSub: "倒计时已冻结，随时回来继续。",

    levelClear: "灯市通明",
    loseTimeUp: "灯熄了",
    loseDeadlock: "再无通路",
    totalScore: "总分",
    newRecord: "新纪录",
    nextLevel: "下一关",
    resPairs: "消除对数",
    resComboPeak: "连击峰值",
    resTimeBonus: "剩余时间",
    resItemBonus: "未用道具",
    endlessOver: "本轮结束",
    endlessBoards: "清空盘数",
    endlessBest: "无尽最高分",
    dailyClear: "今日灯市已通明",
    dailyOver: "今日挑战结束",
    resShells: "震碎冰封壳",
    backToLevels: "返回选关",

    boardAria: "连连看棋盘，{rows} 行 {cols} 列",
    cellEmpty: "第 {r} 行第 {c} 列，空格",
    cellTile: "第 {r} 行第 {c} 列，{name}",
    cellFrozen: "第 {r} 行第 {c} 列，{name}，冰封",
    cellVoid: "第 {r} 行第 {c} 列，虚空通道",
    levelLocked: "第 {n} 关，未解锁",
    levelButton: "第 {n} 关",
    selectedTile: "已选中第 {r} 行第 {c} 列",

    toastInvalid: "这两枚瓷片连不上，换个走法试试。",
    toastAutoShuffle: "盘面无解，已自动洗牌。",
    toastShuffle: "洗牌完成。",
    toastHint: "已高亮一对可消的瓷片。",
    toastFrozen: "这块瓷片被冰封住了，先消掉它周围的瓷片。",
    toastMelted: "盘面无解，已震碎全部冰封壳。",
    toastNoHints: "提示次数已用完。",
    toastNoShuffles: "洗牌次数已用完。",
    toastTimeout: "时间到，灯市熄灭了。",
    toastDeadlock: "洗牌也无法产生可消对，本关结束。",
    toastRecord: "新纪录！",
    toastDailyBest: "今日最佳：{n} 分",
    toastBoardCleared: "清空一盘！进入第 {n} 盘。",
    toastLevelUnlocked: "已解锁第 {n} 关。"
  },
  en: {
    appTitle: "Pair Link",
    appSubtitle: "Lantern Market",
    switchLang: "Switch language",
    toggleSound: "Toggle sound",

    level: "Level",
    time: "Time",
    combo: "Combo",
    score: "Score",
    best: "Best",
    stars: "Stars",
    hint: "Hint",
    shuffle: "Shuffle",
    pause: "Pause",
    resume: "Resume",
    restart: "Restart",
    selectLevel: "Select Level",
    close: "Close",
    gotIt: "Got It",

    howToPlayTitle: "How to Play",
    help1: "Pick two tiles showing the same motif, then join them with one horizontal or vertical polyline.",
    help2: "The line may bend at most twice (0 / 1 / 2 folds). Diagonal moves are never allowed.",
    help3: "Every cell the line passes through must be empty. A ring of void channels surrounds the board, so the line may route outside it.",
    help4: "A successful link clears both tiles and scores. Chain another clear within 3 seconds to build a combo.",
    help5: "Clear the whole board before time runs out. If the board becomes unsolvable it auto-shuffles for free.",
    help6: "A frozen tile cannot be picked. Clear the tiles around it (diagonals count) to shatter the ice.",
    keyMove: "Arrow keys / WASD",
    keyMoveDesc: "Move the focus cell",
    keyPickDesc: "Select or link",
    keyCancelDesc: "Clear selection",
    keyHintDesc: "Reveal one pair",
    keyShuffleDesc: "Shuffle manually",
    keyPauseDesc: "Pause / resume",

    startTitle: "Lantern Market · Pair Link",
    startSub: "Link matching glass tiles with lines of at most two bends and clear the whole board.",
    unlocked: "Unlocked",
    continueGame: "Continue",
    endless: "Endless Rush",
    daily: "Daily Puzzle",
    dailySub: "One board a day, the same for everyone",
    dailyBest: "Today's Best",
    dailyToday: "Today",

    paused: "Paused",
    pauseSub: "The countdown is frozen. Come back whenever you like.",

    levelClear: "Market Ablaze",
    loseTimeUp: "Lights Out",
    loseDeadlock: "No Path Left",
    totalScore: "Total",
    newRecord: "New Record",
    nextLevel: "Next Level",
    resPairs: "Pairs Cleared",
    resComboPeak: "Peak Combo",
    resTimeBonus: "Time Bonus",
    resItemBonus: "Unused Tools",
    endlessOver: "Run Over",
    endlessBoards: "Boards Cleared",
    endlessBest: "Endless Best",
    dailyClear: "Today's Market Cleared",
    dailyOver: "Today's Run Over",
    resShells: "Ice Shattered",
    backToLevels: "Back to Levels",

    boardAria: "Pair Link board, {rows} rows by {cols} columns",
    cellEmpty: "Row {r}, column {c}, empty",
    cellTile: "Row {r}, column {c}, {name}",
    cellFrozen: "Row {r}, column {c}, {name}, frozen",
    cellVoid: "Row {r}, column {c}, void channel",
    levelLocked: "Level {n}, locked",
    levelButton: "Level {n}",
    selectedTile: "Selected row {r}, column {c}",

    toastInvalid: "Those two tiles cannot be linked. Try another route.",
    toastAutoShuffle: "No move left on the board — auto-shuffled.",
    toastShuffle: "Board shuffled.",
    toastHint: "One linkable pair is highlighted.",
    toastFrozen: "That tile is frozen — clear the tiles around it first.",
    toastMelted: "No move left — all ice shattered.",
    toastNoHints: "No hints left.",
    toastNoShuffles: "No shuffles left.",
    toastTimeout: "Time is up — the market went dark.",
    toastDeadlock: "Even after shuffling there is no linkable pair. Level over.",
    toastRecord: "New record!",
    toastDailyBest: "Today's best: {n} pts",
    toastBoardCleared: "Board cleared! Starting board {n}.",
    toastLevelUnlocked: "Level {n} unlocked."
  }
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
    // 隐私模式下静默降级
  }

  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      const lang = String(navigator.language).toLowerCase();
      if (lang.startsWith("zh")) return "zh";
      return "en";
    }
  } catch {
    // 忽略
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
  return isLocale(locale) && locale === "zh" ? "zh-CN" : "en";
}

/** 取某语言的键值表；非法语言回退 DEFAULT_LOCALE。 */
export function table(locale) {
  return strings[isLocale(locale) ? locale : DEFAULT_LOCALE] || strings[DEFAULT_LOCALE];
}

/** 取一条文案；键缺失时回退默认语言，再回退键名本身。 */
export function t(locale, key) {
  const primary = table(locale);
  if (primary && typeof primary[key] === "string") return primary[key];
  const fallback = strings[DEFAULT_LOCALE];
  if (fallback && typeof fallback[key] === "string") return fallback[key];
  return key;
}

/** 变量替换：{name} → params.name；缺变量时保留原占位符。 */
export function format(str, params) {
  if (typeof str !== "string" || !str) return "";
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}
