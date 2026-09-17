// i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。
// 默认显示语言规则：doin.lang 有合法值 → 用它；否则浏览器语言 zh* → 中文，其余 → 英文。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "井字棋 · DOIN 在线小游戏",
    metaDesc: "井字棋在线对弈：3×3 与 4×4 两种棋盘，轻松 / 普通 / 大师三档 AI，支持连胜爬塔、本地双人对战与深色模式，无需下载即点即玩。",
    title: "井字棋",
    lede: "三子连一线。3×3 入门，4×4 见真章。",
    backHome: "返回首页",
    modeLabel: "模式",
    modePve: "人机",
    modePvp: "双人",
    boardSizeLabel: "棋盘",
    diffLabel: "难度",
    diffEasy: "轻松",
    diffNormal: "普通",
    diffMaster: "大师",
    hudYou: "你",
    hudAi: "AI",
    hudDraw: "平局",
    hudStreak: "连胜 · 最高",
    streakUnit: "连",
    markX: "红 X",
    markO: "蓝 O",
    markEmpty: "空",
    cellAria: "第 {0} 行第 {1} 列，{2}",
    statusWonPvp: "{0} 获胜",
    statusWonYou: "你赢了！",
    statusWonAi: "AI 赢了",
    statusDraw: "平局，势均力敌",
    statusThinking: "AI 正在思考",
    statusTurnPvp: "轮到{0}",
    statusTurnYou: "轮到你 · 你是红 X",
    scoreLinePvp: "双人同屏不计入战绩与连胜",
    scoreLine: "难度 {0} · 总积分 {1}",
    undo: "悔棋",
    restart: "新的一局",
    sound: "音效",
    theme: "深色模式",
    footnoteHtml:
      "键盘：<kbd>1</kbd>–<kbd>9</kbd> 直接落子，方向键移动后按 <kbd>Enter</kbd>，<kbd>Z</kbd> 悔棋，<kbd>R</kbd> 新局。",
    saved: "进度与战绩保存在本机浏览器，可离线游玩。",
    resultPvpBadge: "双人对战",
    resultPvpWinX: "红 X 获胜",
    resultPvpWinO: "蓝 O 获胜",
    resultPvpSub: "本局不计入战绩与连胜",
    resultScoreBadge: "本局得分 +{0}",
    resultEndBadge: "本局结束",
    resultTitleWin: "你赢了",
    resultTitleDraw: "平局",
    resultTitleLose: "AI 赢了",
    resultSubWin: "当前连胜 {0} · 难度加成 ×{1}",
    resultSubDraw: "连胜 {0} 保持不变",
    resultSubLose: "连胜已清零，再来一次",
    resultAgain: "再来一局",
    resultClose: "看看棋盘",
    breakdownAria: "得分明细",
    rowBase: "基础分",
    rowEfficiency: "效率奖励",
    rowStreak: "连胜奖励",
    rowTotal: "合计得分",
    noscript: "需要启用 JavaScript 才能游玩井字棋。",
    boardAria: "井字棋棋盘",
    ariaControls: "对局设置",
    ariaModeGroup: "对战模式",
    ariaSizeGroup: "棋盘规格",
    ariaDiffGroup: "AI 难度",
    ariaHud: "战绩面板",
    ariaToolbar: "对局工具",
    langLabel: "Switch to English",
    langShort: "EN",
    ariaLang: "切换语言",
  },
  en: {
    docTitle: "Tic-Tac-Toe · DOIN games",
    metaDesc: "Play Tic-Tac-Toe online: 3×3 and 4×4 boards, Easy / Normal / Master AI, streak climbing, local two-player and dark mode. No download, instant play.",
    title: "Tic-Tac-Toe",
    lede: "Three in a row. Start on 3×3, prove it on 4×4.",
    backHome: "Home",
    modeLabel: "Mode",
    modePve: "vs AI",
    modePvp: "2P",
    boardSizeLabel: "Board",
    diffLabel: "Difficulty",
    diffEasy: "Easy",
    diffNormal: "Normal",
    diffMaster: "Master",
    hudYou: "You",
    hudAi: "AI",
    hudDraw: "Draws",
    hudStreak: "Streak · Best",
    streakUnit: "",
    markX: "Red X",
    markO: "Blue O",
    markEmpty: "empty",
    cellAria: "Row {0}, column {1}: {2}",
    statusWonPvp: "{0} wins",
    statusWonYou: "You win!",
    statusWonAi: "AI wins",
    statusDraw: "A draw — evenly matched",
    statusThinking: "AI is thinking",
    statusTurnPvp: "{0}'s turn",
    statusTurnYou: "Your turn · you are Red X",
    scoreLinePvp: "Local 2P doesn't count toward stats or streaks",
    scoreLine: "Difficulty {0} · Total {1}",
    undo: "Undo",
    restart: "New game",
    sound: "Sound",
    theme: "Dark mode",
    footnoteHtml:
      "Keyboard: <kbd>1</kbd>–<kbd>9</kbd> to place, arrows then <kbd>Enter</kbd> to move, <kbd>Z</kbd> undo, <kbd>R</kbd> new game.",
    saved: "Progress and stats are saved in your browser. Works offline.",
    resultPvpBadge: "2P duel",
    resultPvpWinX: "Red X wins",
    resultPvpWinO: "Blue O wins",
    resultPvpSub: "This game doesn't count toward stats or streaks",
    resultScoreBadge: "Score +{0}",
    resultEndBadge: "Game over",
    resultTitleWin: "You win",
    resultTitleDraw: "Draw",
    resultTitleLose: "AI wins",
    resultSubWin: "Streak {0} · difficulty bonus ×{1}",
    resultSubDraw: "Streak {0} unchanged",
    resultSubLose: "Streak reset — try again",
    resultAgain: "Play again",
    resultClose: "View board",
    breakdownAria: "Score breakdown",
    rowBase: "Base",
    rowEfficiency: "Efficiency",
    rowStreak: "Streak bonus",
    rowTotal: "Total",
    noscript: "JavaScript is required to play Tic-Tac-Toe.",
    boardAria: "Tic-tac-toe board",
    ariaControls: "Game settings",
    ariaModeGroup: "Game mode",
    ariaSizeGroup: "Board size",
    ariaDiffGroup: "AI difficulty",
    ariaHud: "Stats panel",
    ariaToolbar: "Game tools",
    langLabel: "切换到中文",
    langShort: "中文",
    ariaLang: "Switch language",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

// 简单插值："第 {0} 行" + fmt(1) → "第 1 行"
export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

// 浏览器语言 → locale：任何 zh 开头 → 中文，否则英文。
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

// 统一规则第一步：全站共享偏好优先。
export function loadLocale() {
  const store = readStore();
  const saved = store?.getItem(LANG_KEY);
  if (isLocale(saved)) return saved;
  return detectLocale();
}

// 统一规则第二步：切换即写入全站共享偏好。
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
