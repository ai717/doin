export const LOCALES = Object.freeze(["zh", "en"]);
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "2048 · DOIN 在线小游戏",
    eyebrow: "数字合并",
    lede: "滑动方块，同数相撞合成两倍，目标是 2048。",
    score: "分数",
    best: "最高",
    hintKeys: "方向键或 WASD 移动",
    hintTouch: "滑动棋盘，或用下方方向键",
    undo: "撤销一步",
    mute: "关闭音效",
    unmute: "开启音效",
    newGame: "新游戏",
    winTitle: "达成 2048",
    winBody: "已经合出 2048。继续玩能冲更大的数字，也可以重开一局。",
    loseTitle: "无路可走",
    loseBody: "棋盘已满，且没有相邻的同数方块。再来一局吧。",
    keepGoing: "继续玩",
    retry: "再来一局",
    confirmTitle: "放弃这局？",
    confirmBody: "当前棋盘会清空，最高分和统计都会保留。",
    confirmOk: "重开一局",
    confirmCancel: "继续这局",
    statsGames: "局数",
    statsWins: "通关",
    statsTop: "最大方块",
    savedNote: "进度自动存在本机",
    howToTitle: "怎么玩",
    howToBody:
      "每次操作，所有方块朝同一方向滑到底。两个相同的数字撞在一起就合成它们的和，每次有效移动后棋盘随机出现一个新方块。合出 2048 即达成目标，之后仍可继续。",
    howToOk: "开始玩",
    themeToDark: "切换到深色",
    themeToLight: "切换到浅色",
    langLabel: "切换语言",
    langOther: "EN",
    dirUp: "向上",
    dirDown: "向下",
    dirLeft: "向左",
    dirRight: "向右",
    boardLabel: "2048 棋盘",
    offlineNote: "无需联网，关闭页面后进度仍会保留。",
    backHome: "返回 DOIN 游戏列表",
    announceWin: "已合出 2048，可以选择继续玩或重开一局。",
    announceLose: "没有可移动的方块了，本局结束。",
    announceNew: "已开始新的一局。",
  },
  en: {
    docTitle: "2048 · DOIN games",
    eyebrow: "Number merge",
    lede: "Slide the tiles. Equal numbers collide into double. Reach 2048.",
    score: "Score",
    best: "Best",
    hintKeys: "Arrow keys or WASD to move",
    hintTouch: "Swipe the board or use the pad below",
    undo: "Undo a move",
    mute: "Mute sound",
    unmute: "Turn sound on",
    newGame: "New game",
    winTitle: "2048 reached",
    winBody: "You made 2048. Keep going for a bigger tile, or start a fresh board.",
    loseTitle: "No moves left",
    loseBody: "The board is full and nothing matches. Give it another run.",
    keepGoing: "Keep going",
    retry: "Try again",
    confirmTitle: "Give up this run?",
    confirmBody: "This board will be cleared. Your best score and stats stay.",
    confirmOk: "Start over",
    confirmCancel: "Keep playing",
    statsGames: "Games",
    statsWins: "Wins",
    statsTop: "Best tile",
    savedNote: "Progress saved on this device",
    howToTitle: "How to play",
    howToBody:
      "Every move slides all tiles as far as they can go in one direction. Two tiles with the same number merge into their sum, and a new tile appears after every move that changes the board. Reach 2048 to win — you can keep playing after that.",
    howToOk: "Got it",
    themeToDark: "Switch to dark",
    themeToLight: "Switch to light",
    langLabel: "Switch language",
    langOther: "中",
    dirUp: "Move up",
    dirDown: "Move down",
    dirLeft: "Move left",
    dirRight: "Move right",
    boardLabel: "2048 board",
    offlineNote: "Works offline. Progress stays after you close the page.",
    backHome: "Back to DOIN games",
    announceWin: "You reached 2048. Keep going or start a new board.",
    announceLose: "No moves left. This run is over.",
    announceNew: "Started a new board.",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

export function detectLocale() {
  const languages = globalThis.navigator?.languages ?? [];
  const single = globalThis.navigator?.language ?? "";
  for (const tag of [...languages, single]) {
    if (typeof tag === "string" && tag.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}
