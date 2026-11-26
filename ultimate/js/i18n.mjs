// 中英双语表 + 全站共享语言偏好（localStorage["doin.lang"]）。
// 语言切换只能做原地热更新：这里不碰 DOM，也不允许 location.reload()。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "终极井字棋 · DOIN 在线小游戏",
    metaDesc: "九宫格里再套九宫格：你落子的小格位置，决定对手下一步只能去哪个大格战场。四档 AI、同屏双人、21 关残局解穴，玄铁暗金分形棋台即点即玩。",
    title: "终极井字棋",
    subtitle: "分形战棋 · 玄铁机台",
    backHome: "返回门户",
    soundOn: "音效开",
    soundOff: "音效关",
    ariaSound: "音效开关",
    ariaLang: "切换语言",
    ariaHelp: "玩法说明",
    turnLabel: "行动方",
    turnX: "红方 X · 先攻",
    turnO: "蓝方 O · 应战",
    thinking: "天网推演中…",
    wildcardOn: "自由落子",
    movesLabel: "手数",
    boardsLabel: "大格",
    statsLabel: "战绩",
    radarTitle: "大九宫态势",
    radarCaption: "缩略雷达同步显示九个战场的归属与当前聚光灯位置。",
    legendX: "红 X 已占领",
    legendO: "蓝 O 已占领",
    legendLocked: "灰格已封盘",
    legendPar: "金格为当前活跃战场",
    modeDuel: "巅峰对弈",
    modeCampaign: "残局解穴",
    undo: "悔棋",
    hint: "提示",
    levels: "选关",
    restart: "重开",
    settings: "设置",
    tierLabel: "AI 档位",
    tier_novice: "试剑童子",
    tier_duelist: "棋馆门生",
    tier_master: "战术宗师",
    tier_infallible: "终极天网",
    pvpLabel: "同屏双人",
    pvpHint: "同一设备交替执子，不计战绩",
    clearRecords: "清空战绩与残局星数",
    recordLabel: "累计战绩",
    close: "关闭",
    confirmClear: "确定清空全部战绩与残局进度？",
    confirm: "确定",
    cancel: "取消",
    helpTitle: "玩法说明",
    helpBody:
      "棋盘是「大九宫格套小九宫格」，共 81 个落子位。\n\n1. 先手可在任意小格落子。\n2. 你落在某个大格里的小格位置，决定对手下一步只能去哪个大格落子。\n3. 若被指向的大格已被占领或填满，对手获得一次「自由落子」，可以在任意未封盘大格落子。\n4. 先在任意小九宫格内连成三子，就占领该大格。\n5. 率先在大九宫格连成三格一线者获胜；全盘填满仍无三连时，占领大格更多的一方获胜。\n\n残局模式：21 道经过求解器验证的必杀题，在限定步数内完成绝杀可拿三星。",
    helpKeys: "快捷键：Z 悔棋 · H 提示 · R 重开 · Esc 关闭弹层",
    helpWildcard: "聚光灯扫向哪一格，就代表下一手只能在那里落子。",
    levelsTitle: "残局选穴",
    levelsTotal: "已得 {0} / {1} 星",
    chapter_ch1: "第一章 · 引蛇出洞",
    chapter_ch2: "第二章 · 围魏救赵",
    chapter_ch3: "第三章 · 连环烽火",
    chapter_ch4: "第四章 · 大江截流",
    chapter_ch5: "第五章 · 天元绝杀",
    levelName: "残局 {0}",
    parLabel: "{0} 步绝杀",
    starsAria: "{0} 星",
    resultWin: "终局大胜",
    resultLose: "棋差一着",
    resultDraw: "势均力敌",
    resultWinX: "红方 X 获胜",
    resultWinO: "蓝方 O 获胜",
    resultPvpNote: "同屏对战不计入战绩与连胜",
    resultCampaignWin: "绝杀达成",
    resultCampaignFail: "残局失守",
    resultBadge: "本局评分",
    resultStars: "星评",
    resultUsed: "用步",
    resultPar: "限步",
    resultNext: "下一关",
    resultAgain: "再来一局",
    resultClose: "看看棋盘",
    rowBase: "基础分",
    rowBigs: "大格占领",
    rowEfficiency: "效率奖励",
    rowStreak: "连胜奖励",
    rowTotal: "合计",
    statusTurn: "轮到{0} · 请在大格 {1} 落子",
    statusPvpTurn: "同屏对战 · 轮到{0}",
    statusThinking: "对手正在推演整盘棋…",
    statusWildcard: "自由落子 · 全盘未封盘的大格皆可下子",
    statusCampaign: "残局 {0} · 已用 {1} / {2} 步",
    statusWon: "红方 X 完成大九宫三连",
    statusLost: "蓝方 O 完成大九宫三连",
    statusDraw: "全盘填满 · 和局",
    toastHint: "已为你点亮一手推荐落点",
    toastNoHint: "当前没有可用的提示",
    toastWildcard: "目标大格已封盘 · 获得自由落子权",
    toastCampaignFail: "残局失守，按重开再试一次",
    toastSaved: "进度已保存在本机",
    saved: "进度与星评保存在本机浏览器，可离线游玩。",
    noscript: "需要启用 JavaScript 才能游玩终极井字棋。",
    boardAria: "终极井字棋棋盘，共 81 个落子位",
    ariaTurnPanel: "对局状态",
    ariaRadar: "大九宫缩略雷达",
    ariaToolbar: "对局工具",
    ariaLevels: "残局选关",
    ariaSettings: "设置",
    ariaResults: "结算",
    cellAria: "第 {0} 大格第 {1} 位，{2}",
    sectorAria: "第 {0} 大格",
    markEmpty: "空位",
    markX: "红 X",
    markO: "蓝 O",
    langLabel: "切换到英文",
    langShort: "EN",
  },
  en: {
    docTitle: "Ultimate Tic-Tac-Toe · DOIN games",
    metaDesc: "A nine-grid inside every nine-grid: the cell you take decides which sector your opponent must play next. Four AI tiers, same-screen duels and 21 solver-verified endgame puzzles on an iron-and-brass fractal board.",
    title: "Ultimate Tic-Tac-Toe",
    subtitle: "Fractal arena · Iron cabinet",
    backHome: "Home",
    soundOn: "Sound on",
    soundOff: "Sound off",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaHelp: "How to play",
    turnLabel: "To move",
    turnX: "Red X · first",
    turnO: "Blue O · reply",
    thinking: "The machine is calculating…",
    wildcardOn: "Wildcard",
    movesLabel: "Moves",
    boardsLabel: "Sectors",
    statsLabel: "Record",
    radarTitle: "Grand board",
    radarCaption: "The mini radar mirrors all nine sectors and the current spotlight.",
    legendX: "Red X captured",
    legendO: "Blue O captured",
    legendLocked: "Locked sector",
    legendPar: "Gold cell is the live sector",
    modeDuel: "Duel",
    modeCampaign: "Puzzles",
    undo: "Undo",
    hint: "Hint",
    levels: "Levels",
    restart: "Restart",
    settings: "Settings",
    tierLabel: "AI tier",
    tier_novice: "Apprentice",
    tier_duelist: "Adept",
    tier_master: "Tactician",
    tier_infallible: "Infallible",
    pvpLabel: "Local two-player",
    pvpHint: "Alternate turns on one device; no records",
    clearRecords: "Clear records and puzzle stars",
    recordLabel: "Record",
    close: "Close",
    confirmClear: "Clear all records and puzzle progress?",
    confirm: "Confirm",
    cancel: "Cancel",
    helpTitle: "How to play",
    helpBody:
      "The board is a nine-grid of nine-grids: 81 cells in total.\n\n1. The first player may take any cell.\n2. The small cell you take decides which sector your opponent must play in next.\n3. If that sector is already captured or full, your opponent gets a wildcard: any open sector.\n4. Win a small three-in-a-row to capture its sector.\n5. Win three sectors in a row to take the game. If the board fills with no line, the player holding more sectors wins.\n\nPuzzle mode: 21 solver-verified forced wins. Finish within par to earn three stars.",
    helpKeys: "Keys: Z undo · H hint · R restart · Esc close",
    helpWildcard: "Wherever the spotlight lands is the only sector you may play next.",
    levelsTitle: "Endgame vault",
    levelsTotal: "{0} / {1} stars earned",
    chapter_ch1: "Chapter 1 · Lure Out",
    chapter_ch2: "Chapter 2 · Rescue by Diversion",
    chapter_ch3: "Chapter 3 · Chain of Beacons",
    chapter_ch4: "Chapter 4 · River Cut",
    chapter_ch5: "Chapter 5 · Final Strike",
    levelName: "Puzzle {0}",
    parLabel: "Win in {0}",
    starsAria: "{0} stars",
    resultWin: "Grand victory",
    resultLose: "One move short",
    resultDraw: "Dead even",
    resultWinX: "Red X wins",
    resultWinO: "Blue O wins",
    resultPvpNote: "Local duels don't count toward records or streaks",
    resultCampaignWin: "Forced win delivered",
    resultCampaignFail: "Puzzle lost",
    resultBadge: "Game score",
    resultStars: "Stars",
    resultUsed: "Moves used",
    resultPar: "Par",
    resultNext: "Next puzzle",
    resultAgain: "Play again",
    resultClose: "View board",
    rowBase: "Base",
    rowBigs: "Sectors",
    rowEfficiency: "Efficiency",
    rowStreak: "Streak",
    rowTotal: "Total",
    statusTurn: "{0} to move · play in sector {1}",
    statusPvpTurn: "Local duel · {0} to move",
    statusThinking: "Opponent is reading the whole board…",
    statusWildcard: "Wildcard · any open sector is legal",
    statusCampaign: "Puzzle {0} · {1} / {2} moves",
    statusWon: "Red X completes a sector line",
    statusLost: "Blue O completes a sector line",
    statusDraw: "Board full · draw",
    toastHint: "A recommended move is now lit",
    toastNoHint: "No hint available right now",
    toastWildcard: "Target sector is closed · wildcard granted",
    toastCampaignFail: "Puzzle lost — restart and try again",
    toastSaved: "Progress saved on this device",
    saved: "Progress and stars are saved in your browser. Works offline.",
    noscript: "JavaScript is required to play Ultimate Tic-Tac-Toe.",
    boardAria: "Ultimate tic-tac-toe board with 81 cells",
    ariaTurnPanel: "Match status",
    ariaRadar: "Grand board radar",
    ariaToolbar: "Match tools",
    ariaLevels: "Puzzle selection",
    ariaSettings: "Settings",
    ariaResults: "Result",
    cellAria: "Sector {0}, cell {1}: {2}",
    sectorAria: "Sector {0}",
    markEmpty: "empty",
    markX: "Red X",
    markO: "Blue O",
    langLabel: "切换到中文",
    langShort: "中文",
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
