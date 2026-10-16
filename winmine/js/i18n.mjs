// i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "经典扫雷 · DOIN 在线小游戏",
    metaDesc: "复刻 Windows 原版扫雷：灰底浮雕、红色 LED 计数、俏皮笑脸，初级/中级/高级/自定义四档，右键插旗问号循环，随时冲最快纪录。",
    windowTitle: "扫雷",
    menuGame: "游戏(G)",
    menuHelp: "帮助(H)",
    newGame: "新游戏",
    beginner: "初级",
    intermediate: "中级",
    expert: "高级",
    custom: "自定义...",
    bestTimes: "最快成绩...",
    rulesTitle: "规则说明",
    rulesBody: "目标是翻开所有不含地雷的格子。\n\n· 左键：翻开格子。翻到数字表示周围 8 格里地雷的个数。\n· 右键：插旗 / 问号 / 清除循环。\n· 同时左右键（或点已翻开的数字）：数字与旗数一致时快速展开周围。\n· 踩雷即败；翻开所有安全格即胜。\n· F2 新游戏。",
    aboutTitle: "关于",
    aboutBody: "经典扫雷 · WinMine 复刻\n\nDOIN 游戏门户 (doin.win)\n向 1992 年那台灰色的计算机课致敬。",
    bestTimesTitle: "最快成绩",
    bestTimesSub: "{0} · 前 {1} 名",
    rankName: "名字",
    rankTime: "用时",
    rankEmpty: "还没有纪录，快来创造第一条吧！",
    recordTitle: "新纪录！",
    recordBody: "你打破了{0}纪录，用时 {1} 秒。",
    recordNameLabel: "请输入你的名字",
    recordNamePlaceholder: "无名英雄",
    recordSave: "确定",
    recordSkip: "跳过",
    difficultyLabel: "难度",
    minesLeftLabel: "剩余雷数",
    timeLabel: "用时",
    statusReady: "左键翻开 · 右键插旗 · 点数字速开",
    statusWon: "雷区清空！",
    statusLost: "踩雷了 · 红格是你踩中的那颗",
    backHome: "返回门户",
    soundLabel: "音效",
    mutedLabel: "已静音",
    ariaBoard: "扫雷棋盘",
    ariaSmiley: "新游戏",
    ariaDifficulty: "难度菜单",
    ariaMines: "剩余雷数",
    ariaTime: "用时",
    fmtTime: "{0} 秒",
    customWidth: "宽 (9-30)",
    customHeight: "高 (9-24)",
    customMines: "雷数",
    customOk: "确定",
    customCancel: "取消",
    customInvalid: "参数无效：宽 9-30、高 9-24、雷 10-(宽-1)×(高-1)。",
    noscript: "需要启用 JavaScript 才能游玩经典扫雷。",
    stageTitle: "经典扫雷 · WinMine",
    helpBtn: "规则",
    langSwitch: "EN",
    diffBeginner: "初级 · 9×9 / 10",
    diffIntermediate: "中级 · 16×16 / 40",
    diffExpert: "高级 · 30×16 / 99",
    customTitle: "自定义雷区",
    ok: "确定",
    cancel: "取消",
    sec: "秒",
  },
  en: {
    docTitle: "Classic Minesweeper · DOIN games",
    metaDesc: "A faithful Windows Minesweeper replica: gray bevel board, red LED counters and the iconic smiley, with beginner/intermediate/expert/custom boards and best-time records.",
    windowTitle: "Minesweeper",
    menuGame: "Game(G)",
    menuHelp: "Help(H)",
    newGame: "New Game",
    beginner: "Beginner",
    intermediate: "Intermediate",
    expert: "Expert",
    custom: "Custom...",
    bestTimes: "Best Times...",
    rulesTitle: "How to Play",
    rulesBody: "Uncover every square that does not hide a mine.\n\n· Left-click: reveal a square. A number shows how many mines touch it.\n· Right-click: cycle flag / question / clear.\n· Click a revealed number (or press both buttons): reveals neighbors when flags match the number.\n· Hit a mine and you lose; reveal all safe squares to win.\n· F2 for a new game.",
    aboutTitle: "About",
    aboutBody: "Classic Minesweeper · WinMine replica\n\nDOIN game portal (doin.win)\nA tribute to that gray computer lab in 1992.",
    bestTimesTitle: "Best Times",
    bestTimesSub: "{0} · top {1}",
    rankName: "Name",
    rankTime: "Time",
    rankEmpty: "No records yet — set the first one!",
    recordTitle: "New Record!",
    recordBody: "You beat the {0} record in {1} seconds.",
    recordNameLabel: "Enter your name",
    recordNamePlaceholder: "Anonymous",
    recordSave: "OK",
    recordSkip: "Skip",
    difficultyLabel: "Difficulty",
    minesLeftLabel: "Mines left",
    timeLabel: "Time",
    statusReady: "Left-click reveal · right-click flag · click a number to chord",
    statusWon: "Field cleared!",
    statusLost: "Boom · the red square is the mine you hit",
    backHome: "Portal",
    soundLabel: "Sound",
    mutedLabel: "Muted",
    ariaBoard: "Minesweeper board",
    ariaSmiley: "New game",
    ariaDifficulty: "Difficulty menu",
    ariaMines: "Mines left",
    ariaTime: "Time",
    fmtTime: "{0} sec",
    customWidth: "Width (9-30)",
    customHeight: "Height (9-24)",
    customMines: "Mines",
    customOk: "OK",
    customCancel: "Cancel",
    customInvalid: "Invalid: width 9-30, height 9-24, mines 10-(w-1)×(h-1).",
    noscript: "JavaScript is required to play Classic Minesweeper.",
    stageTitle: "Classic Minesweeper · WinMine",
    helpBtn: "Help",
    langSwitch: "中文",
    diffBeginner: "Beginner · 9×9 / 10",
    diffIntermediate: "Intermediate · 16×16 / 40",
    diffExpert: "Expert · 30×16 / 99",
    customTitle: "Custom Board",
    ok: "OK",
    cancel: "Cancel",
    sec: "sec",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

export function detectLocale() {
  const languages = globalThis.navigator?.languages ?? [];
  const single = globalThis.navigator?.language ?? "";
  for (const tag of [...languages, single]) {
    if (typeof tag === "string" && tag.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

function readStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadLocale() {
  const store = readStore();
  const saved = store?.getItem(LANG_KEY);
  if (isLocale(saved)) return saved;
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return false;
  try {
    readStore()?.setItem(LANG_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}