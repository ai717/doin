// 倒退贪吃蛇 Uncoil · 全站共享中英双语表（语言偏好统一读写 localStorage["doin.lang"]）
// ★ 英文表零汉字是硬性红线，tests/i18n.test.mjs 会自动断言。

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const LOCALES = {
  zh: {
    langName: "中文",
    title: "倒退贪吃蛇",
    siteName: "DOIN 在线小游戏",
    back: "← 门户",
    soundOn: "🔊 音效开",
    soundOff: "🔇 音效关",
    langBtn: "EN",
    help: "玩法说明",
    startTitle: "倒退贪吃蛇 · 糖霜蜕皮",
    startSub: "开局即百节长蛇 · 吃丸缩身 · 别把自己困死",
    modeStage: "蜕皮闯关",
    modeEndgame: "残局比步",
    modeDaily: "每日缠局",
    chapter1: "第一章 · 初蜕",
    chapter2: "第二章 · 岩隙",
    chapter3: "第三章 · 紧咬",
    chapter4: "第四章 · 回环",
    chapter5: "第五章 · 无隙",
    chapterEndgame: "残局 · 比最少步数",
    level: "第 {n} 关",
    locked: "未解锁",
    lenLabel: "蛇身长度",
    pelletsLabel: "蜕身丸",
    stepsLabel: "步数",
    parLabel: "参考步数",
    bestLabel: "最佳步数",
    undosLabel: "撤销次数",
    statusLabel: "状态",
    statusPlaying: "蜕皮中",
    statusWon: "蜕皮完成",
    statusStuck: "困毙",
    progressLabel: "蜕皮进度",
    btnUndo: "撤销",
    btnReset: "重开",
    btnReplay: "演示解法",
    btnMenu: "选关",
    stuckLine: "头四周被自己的身体封死了",
    stuckHint: "撤销一步换条路，或重开本关",
    clearTitle: "蜕皮完成！",
    clearStats: "{s} 步 · 参考 {t} 步",
    starsLine: "获得 {n} 星",
    newRecord: "新纪录",
    nextLevel: "下一关",
    retry: "再战本关",
    toSelect: "返回选关",
    dailyBest: "今日最佳",
    endgameProgress: "已解 {n} / 12",
    starsTotal: "总星数 {n}",
    unlockedNew: "解锁新关卡",
    keyTip: "方向键 / WASD 走一格 · Z 撤销 · R 重开",
    touchTip: "点相邻格或滑动走一格 · 摇杆同样可用",
    helpTitle: "玩法说明",
    helpBody1: "开局你就是一条盘踞全屏的长蛇。每吃一颗蜕身丸，蛇身缩短若干节；长度降到 1 节即完成蜕皮。",
    helpBody2: "盘面永远只有一颗可见的丸。吃掉它，下一颗才会在别处孵化，位置与时机全部写死，不掷骰子。",
    helpBody3: "唯一的死法是「困毙」：头四周被自己的身体、岩层或边界封死。你不是被敌人杀死，是被自己的过去堵死。",
    helpBody4: "尾巴这一格可以走 —— 你迈进去的同时尾巴正好让开。绝大多数开局的第一步全靠它。",
    helpBody5: "撤销无限次，随便试。残局与每日缠局比的是步数：走出不劣于参考步数的解即可拿三星。",
    helpBody6: "回环门成对瞬移，能打破网格的邻接关系；被自己封死的局面常常靠它重新连通。",
    helpClose: "知道了",
    saveReset: "重置存档",
    saveResetConfirm: "确定清空本作全部进度与记录？",
    saveCleared: "存档已清空",
    replayDone: "参考解演示完毕",
    blocked: "那个方向走不了"
  },
  en: {
    langName: "English",
    title: "Uncoil",
    siteName: "DOIN Online Games",
    back: "← Portal",
    soundOn: "🔊 Sound on",
    soundOff: "🔇 Sound off",
    langBtn: "中文",
    help: "How to Play",
    startTitle: "Uncoil · Candy Shed",
    startSub: "Start as a hundred-segment coil · eat to shrink · never wall yourself in",
    modeStage: "Shed Campaign",
    modeEndgame: "Endgame Boards",
    modeDaily: "Daily Coil",
    chapter1: "Chapter I · First Shed",
    chapter2: "Chapter II · Rock Gaps",
    chapter3: "Chapter III · Tight Coil",
    chapter4: "Chapter IV · Loopback",
    chapter5: "Chapter V · No Gaps",
    chapterEndgame: "Endgames · Fewest Steps",
    level: "Level {n}",
    locked: "Locked",
    lenLabel: "Body length",
    pelletsLabel: "Shed pellets",
    stepsLabel: "Steps",
    parLabel: "Reference",
    bestLabel: "Best steps",
    undosLabel: "Undos",
    statusLabel: "Status",
    statusPlaying: "Shedding",
    statusWon: "Shed complete",
    statusStuck: "Entombed",
    progressLabel: "Shed progress",
    btnUndo: "Undo",
    btnReset: "Reset",
    btnReplay: "Show solution",
    btnMenu: "Boards",
    stuckLine: "Your own body has sealed every way out",
    stuckHint: "Undo a step and try another line, or reset the board",
    clearTitle: "Shed complete!",
    clearStats: "{s} steps · reference {t}",
    starsLine: "{n} stars earned",
    newRecord: "New record",
    nextLevel: "Next level",
    retry: "Retry",
    toSelect: "Board select",
    dailyBest: "Today best",
    endgameProgress: "Solved {n} / 12",
    starsTotal: "Total {n} stars",
    unlockedNew: "New level unlocked",
    keyTip: "Arrows / WASD to step · Z undo · R reset",
    touchTip: "Tap an adjacent cell or swipe to step · the d-pad works too",
    helpTitle: "How to Play",
    helpBody1: "You begin as a long snake coiled across the whole board. Every shed pellet you eat shortens the body. Reach a single segment and the shed is complete.",
    helpBody2: "Only one pellet is ever visible. Eat it and the next one hatches elsewhere. Positions and timing are fixed in the level data - nothing is rolled.",
    helpBody3: "The only way to lose is entombment: your head is sealed in by your own body, rock, or the edge. You are not killed by an enemy. You are blocked by your own past.",
    helpBody4: "You may step into the tail cell - it vacates on the very same tick. Most opening moves depend on exactly that.",
    helpBody5: "Undo is unlimited, so experiment freely. Endgames and the daily coil are scored on steps: match or beat the reference for three stars.",
    helpBody6: "Loop gates teleport in pairs and break the grid adjacency. Boards that look sealed often reopen through a gate.",
    helpClose: "Got it",
    saveReset: "Reset save",
    saveResetConfirm: "Erase all local progress and records?",
    saveCleared: "Save cleared",
    replayDone: "Reference solution finished",
    blocked: "That way is blocked"
  }
};

export function isLocale(value) {
  return value === "zh" || value === "en";
}

export function detectLocale() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* 存储不可用时回默认 */
  }
  const navLang = (typeof navigator !== "undefined" && navigator.language) || "";
  return navLang.toLowerCase().startsWith("en") ? "en" : DEFAULT_LOCALE;
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    localStorage.setItem(LANG_KEY, locale);
  } catch {
    /* 存储不可用时静默 */
  }
}

export function htmlLang() {
  return loadLocale() === "en" ? "en" : "zh-CN";
}

export function strings(locale) {
  return LOCALES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function t(locale, key, values = {}) {
  const text = strings(locale)[key] ?? String(key);
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
}

export function format(locale, key, values = {}) {
  return t(locale, key, values);
}

export { LOCALES };
