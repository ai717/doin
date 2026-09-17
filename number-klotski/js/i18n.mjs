/**
 * 数字华容道双语国际化与全站偏好共享
 * 统一读写 localStorage["doin.lang"]
 */

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

export const STRINGS = {
  zh: {
    appTitle: "数字华容道 · DOIN 在线小游戏",
    title: "数字华容道",
    subtitle: "经典数字推盘 · 移空归位",
    backHome: "← 门户",
    soundLabel: "音效",
    langLabel: "语言",
    helpLabel: "玩法说明",

    modeLadder: "段位修行",
    modeSpeedrun: "闪电竞速",
    modeDaily: "每日棋谱",

    size3: "3×3 启蒙",
    size4: "4×4 标杆",
    size5: "5×5 大师",

    moves: "步数",
    time: "耗时",
    bestTime: "最快",
    bestMoves: "最少步",
    tps: "推速 (TPS)",
    stageLabel: "第 {n} 关",

    btnUndo: "撤销 (Z)",
    btnReset: "重摆 (R)",
    btnNew: "打乱开局",
    btnSettings: "设置",
    btnPause: "暂停",
    btnResume: "继续",

    winTitle: "棋谱告捷！",
    winDesc: "数字悉数按序归位！用时 {time}，共推移 {moves} 步，推速达 {tps} TPS。",
    winRank: "评价等级：",
    btnPlayAgain: "再来一局",
    btnNextStage: "下一关",

    rankGodly: "神级",
    rankMaster: "大师",
    rankAdept: "悍将",
    rankRookie: "新秀",

    helpTitle: "数字华容道 · 规则与指引",
    helpRule1: "【连推手感】点击或划动与空格处于同一行或同一列的任意方块，整段方块将一推齐动，大幅提高解题速度。",
    helpRule2: "【全通键盘】支持方向键与 WASD 控制邻块滑入空格；按 Z 键随时撤销，按 R 键重置本局局面。",
    helpRule3: "【胜利目标】将数字按 1 ~ N²-1 由左至右、由上至下依序排列整齐，留右下角为空格即获胜。",
    helpRule4: "【解题诀窍】逐层归位——先完成第 1 行与第 2 行，攻克最后两行时将边缘角块倒车入库组合就位。",

    keyModeTitle: "键盘操控直觉：",
    keyModePush: "推动邻块（按↓上方方块落入空格）",
    keyModeBlank: "移动空格（按↓空格自身向下移动）",
    dailyDone: "今日棋谱已达成！",
    dailyPrompt: "全服每日统一打乱挑战",
  },
  en: {
    appTitle: "Number Klotski · DOIN Online Game",
    title: "Number Klotski",
    subtitle: "Classic 15-Puzzle & Sliding Numbers",
    backHome: "← Portal",
    soundLabel: "Sound",
    langLabel: "Language",
    helpLabel: "How to Play",

    modeLadder: "Ladder",
    modeSpeedrun: "Speedrun",
    modeDaily: "Daily Puzzle",

    size3: "3×3 Novice",
    size4: "4×4 Standard",
    size5: "5×5 Master",

    moves: "Moves",
    time: "Time",
    bestTime: "Best Time",
    bestMoves: "Fewest Moves",
    tps: "Speed (TPS)",
    stageLabel: "Stage {n}",

    btnUndo: "Undo (Z)",
    btnReset: "Reset (R)",
    btnNew: "New Shuffle",
    btnSettings: "Settings",
    btnPause: "Pause",
    btnResume: "Resume",

    winTitle: "Puzzle Solved!",
    winDesc: "All tiles perfectly ordered! Time: {time}, Moves: {moves}, Speed: {tps} TPS.",
    winRank: "Rank: ",
    btnPlayAgain: "Play Again",
    btnNextStage: "Next Stage",

    rankGodly: "Godly",
    rankMaster: "Master",
    rankAdept: "Adept",
    rankRookie: "Novice",

    helpTitle: "Number Klotski · Rules & Tips",
    helpRule1: "[Multi-Tile Slide] Click or drag any tile in the same row or column as the blank space to slide the entire line together.",
    helpRule2: "[Keyboard Controls] Use Arrow keys or WASD to slide tiles into the space. Press Z to undo, R to reset.",
    helpRule3: "[Goal] Arrange numbers from 1 to N²-1 in sequential order from top-left to bottom-right, leaving the space at the end.",
    helpRule4: "[Strategy] Solve row by row. Complete the top rows first, then pair and dock corner tiles in the bottom rows.",

    keyModeTitle: "Keyboard Style:",
    keyModePush: "Push neighbor tile (↓ pushes upper tile down)",
    keyModeBlank: "Move space (↓ moves space itself down)",
    dailyDone: "Daily Puzzle Completed!",
    dailyPrompt: "Daily unified challenge for all players",
  },
};

export function detectLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === "en" || stored === "zh") return stored;
    }
  } catch {
    // 降级使用 navigator
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  }
  return DEFAULT_LOCALE;
}

export function saveLocale(locale) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, locale === "en" ? "en" : "zh");
    }
  } catch {
    // 静默降级
  }
}

export function t(key, locale = detectLocale(), params = {}) {
  const dict = STRINGS[locale] || STRINGS.zh;
  let text = dict[key] || STRINGS.zh[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return text;
}
