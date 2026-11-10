// i18n.mjs - bilingual tables for Chinese Checkers.
// The locale preference is owned by the portal-wide key "doin.lang".
// strings.en must stay free of Chinese characters except the language button.

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const zh = {
  langBtn: "EN",
  docTitle: "中国跳棋 · 琉璃星盘 · DOIN 在线小游戏",
  appTitle: "中国跳棋",
  back: "← 门户",
  undo: "悔棋",
  undoTitle: "撤销上一手（Z）",
  restart: "重开",
  restartConfirm: "确定弃局重开？",
  restartDone: "已重开",
  sound: "音效",
  soundOn: "🔊",
  soundOff: "🔇",
  help: "玩法",
  langName: "语言",
  close: "关闭",

  modeLabel: "对局",
  difficultyLabel: "棋力",
  sideLabel: "选边",
  turnLabel: "执棋",
  thinking: "对手运子中…",
  thinkingSub: "推演连跳路径",

  statPlies: "手数",
  statInCamp: "入营",
  statMaxHops: "最长连跳",
  hopBanner: "惊现 {n} 连绝妙大跳！",
  hintSelect: "点击己方弹珠",
  hintTarget: "点击光圈落点，一键飞跃",
  hintUndo: "Z 键悔棋 · 无限回退",

  logTitle: "棋谱",
  logEmpty: "尚未落子",
  logStep: "单步",
  logJump: "{n} 连跳",

  winTitle: "大捷",
  loseTitle: "惜败",
  pvpWinTitle: "{side} 获胜",
  resultLine: "{side} 率先入营 · 共 {plies} 手",
  newBest: "新纪录",
  playAgain: "再弈一局",
  bestTitle: "本机战绩",
  bestWins: "胜局",
  bestLosses: "负局",
  bestPlies: "最少手数",
  bestHops: "最长连跳",
  noRecord: "暂无",

  helpTitle: "玩法说明",
  helpMove: "点击己方弹珠，再点相邻空孔即可单步挪移。",
  helpJump: "隔着任意一子即可跳跃；落定前还能继续连跳，可在任意节点停步。",
  helpAssist: "选中后所有可达落点会亮起，点击最远光圈一口气完成多段飞跃。",
  helpUndo: "按 Z 无限悔棋；人机对局一次回退玩家与 AI 各一手。",
  helpSave: "进度自动保存在本机浏览器，换设备不会同步。",
  helpRule: "填满目标营中对手未占的孔即胜；入营的子不得再移出，也不得退回己方起始营。",
  helpPuzzle: "残局中蓝子只作桥、永不移动，红方连续行棋；在限步内把任意红弹珠送进金色目标孔即破局。",

  puzzleTitle: "连跳残局 · 二十关",
  puzzleIntro: "蓝子只作桥，红方连续行棋。点选红弹珠，借桥一路飞跃到金色目标孔。",
  puzzleProgress: "已破 {n}/{total} 关 · 共 {stars} 星",
  puzzleLevel: "关卡",
  puzzlePar: "限步",
  puzzleLeft: "余步",
  puzzleHint: "把红弹珠送进金色目标孔",
  puzzleFailed: "步数用尽，悔棋再试",
  puzzleWinTitle: "破局",
  puzzleLoseTitle: "未解",
  puzzleResultLine: "第 {n} 关 · {plies} 手 · {stars} 星",
  nextLevel: "下一关",
  retryLevel: "重解本关",
  levelClose: "收起残局谱",

  diff: {
    beginner: "启蒙童子",
    intermediate: "棋馆门生",
    advanced: "阵法大师",
    master: "棋圣无双",
  },
  mode: {
    pve: "人机对弈",
    pvp: "同屏双人",
    puzzle: "连跳残局",
  },
  side: {
    red: "红玛瑙",
    blue: "青金琉璃",
  },
  chapter: {
    1: "初识飞跃",
    2: "双连妙手",
    3: "九曲盘龙",
    4: "一子定乾坤",
  },
};

const en = {
  langBtn: "中文",
  docTitle: "Chinese Checkers · Glass Star Board · DOIN Online Games",
  appTitle: "Chinese Checkers",
  back: "← Portal",
  undo: "Undo",
  undoTitle: "Undo last move (Z)",
  restart: "Restart",
  restartConfirm: "Abandon this game and restart?",
  restartDone: "Game reset",
  sound: "Sound",
  soundOn: "🔊",
  soundOff: "🔇",
  help: "How to play",
  langName: "Language",
  close: "Close",

  modeLabel: "Mode",
  difficultyLabel: "Skill",
  sideLabel: "Your side",
  turnLabel: "To move",
  thinking: "Opponent thinking…",
  thinkingSub: "Reading chain hops",

  statPlies: "Plies",
  statInCamp: "In camp",
  statMaxHops: "Longest chain",
  hopBanner: "Brilliant {n}-hop chain!",
  hintSelect: "Select one of your marbles",
  hintTarget: "Pick a glowing hole to fly there",
  hintUndo: "Press Z to undo · unlimited",

  logTitle: "Move log",
  logEmpty: "No moves yet",
  logStep: "Step",
  logJump: "{n} hops",

  winTitle: "Victory",
  loseTitle: "Defeat",
  pvpWinTitle: "{side} wins",
  resultLine: "{side} reached camp first in {plies} plies",
  newBest: "New record",
  playAgain: "Play again",
  bestTitle: "Local record",
  bestWins: "Wins",
  bestLosses: "Losses",
  bestPlies: "Fewest plies",
  bestHops: "Longest chain",
  noRecord: "None yet",

  helpTitle: "How to play",
  helpMove: "Select one of your marbles, then click an adjacent empty hole to step.",
  helpJump: "Jump over any adjacent marble; keep hopping and stop at any landing.",
  helpAssist: "All reachable landings light up; click the farthest ring to fly the whole chain at once.",
  helpUndo: "Press Z to undo at any time; against the AI one undo rewinds both moves.",
  helpSave: "Progress is saved in this browser only — it does not sync across devices.",
  helpRule: "Fill every target-camp hole the opponent has not occupied to win. A marble in camp cannot leave, and you cannot land back in your own home.",
  helpPuzzle: "In studies the blue marbles are static bridges and red keeps the turn. Land any red marble on the golden hole within the move limit to solve it.",

  puzzleTitle: "Chain Hop Odyssey - 20 Stages",
  puzzleIntro: "Blue marbles are bridges and never move; red plays every turn. Select a red marble and fly it onto the golden hole.",
  puzzleProgress: "{n}/{total} solved - {stars} stars",
  puzzleLevel: "Stage",
  puzzlePar: "Par",
  puzzleLeft: "Left",
  puzzleHint: "Land a red marble on the golden hole",
  puzzleFailed: "Out of moves - undo and try again",
  puzzleWinTitle: "Solved",
  puzzleLoseTitle: "Unsolved",
  puzzleResultLine: "Stage {n} - {plies} moves - {stars} stars",
  nextLevel: "Next stage",
  retryLevel: "Retry stage",
  levelClose: "Close the stage list",

  diff: {
    beginner: "Novice",
    intermediate: "Apprentice",
    advanced: "Tactician",
    master: "Grandmaster",
  },
  mode: {
    pve: "Vs AI",
    pvp: "Local 2P",
    puzzle: "Studies",
  },
  side: {
    red: "Red Agate",
    blue: "Blue Glass",
  },
  chapter: {
    1: "First Flight",
    2: "Double Bridges",
    3: "Coiling Dragon",
    4: "One Decisive Marble",
  },
};

export const strings = { zh, en };
export const LOCALES = ["zh", "en"];

export function normalizeLocale(value) {
  return value === "en" ? "en" : "zh";
}

export function htmlLang(locale) {
  return normalizeLocale(locale) === "en" ? "en" : "zh-CN";
}

export function translate(locale, key, vars) {
  const table = strings[normalizeLocale(locale)] || zh;
  let text = table[key];
  if (text === undefined) text = zh[key];
  if (text === undefined || typeof text !== "string") return key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
}

// Nested tables (difficulty / mode / side) share one lookup so callers never
// hard-code a label from the wrong locale.
export function lookup(locale, group, id) {
  const table = strings[normalizeLocale(locale)] || zh;
  const groupTable = table[group];
  if (!groupTable || typeof groupTable !== "object") return String(id);
  const value = groupTable[id];
  if (value !== undefined) return value;
  const fallback = zh[group];
  return fallback && fallback[id] !== undefined ? fallback[id] : String(id);
}

export const difficultyName = (locale, id) => lookup(locale, "diff", id);
export const modeName = (locale, id) => lookup(locale, "mode", id);
export const sideName = (locale, id) => lookup(locale, "side", id);
