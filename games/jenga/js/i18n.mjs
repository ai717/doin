// 叠叠乐 · 全站共享中英双语表（语言偏好统一读写 localStorage["doin.lang"]）
//
// 铁律：strings.en 绝无汉字；源码零裸写中文（语言切换按钮标识走白名单）。
// 语言切换只做 `[data-i18n]` 原地热更新，严禁 location.reload()，严禁重置在对局。

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const LOCALES = {
  zh: {
    langName: "语言",
    langBtn: "EN",
    docTitle: "叠叠乐 · DOIN 在线小游戏",
    appTitle: "叠叠乐",
    back: "← 门户",
    sound: "音效",
    soundOn: "🔊",
    soundOff: "🔇",
    help: "玩法说明",
    canvasLabel: "等轴 2.5D 木塔舞台",
    noscript: "需要启用 JavaScript 才能游玩叠叠乐。",

    boardTitle: "粉笔黑板",
    stat_score: "得分",
    stat_streak: "连击",
    stat_mult: "倍率",
    stat_layers: "层数",
    stat_height: "塔高",
    ui_danger: "判危度",
    bestScore: "最高分",
    bestLayers: "最高层数",
    bestStreak: "最高连击",

    mode_spire: "极限塔",
    mode_duel: "双人对决",
    mode_riddle: "残局解谜",
    levelLabel: "第 {n} 关",
    levelNameSep: "·",
    goalLabel: "目标",
    goalMoves: "连续抽叠 {n} 块",
    goalLayers: "垒到 {n} 层",
    goalStreakAdd: "并打出 ×27 连击",
    goalNone: "自由练习",
    progressLabel: "进度 {a}/{b}",
    unlockedLabel: "已通关 {n}/{t}",

    slot_left: "左槽",
    slot_mid: "中槽",
    slot_right: "右槽",
    act_pull: "抽块",
    act_stack: "落位",
    act_cancel: "取消抽块",
    act_rebuild: "重摆塔",
    act_rotL: "↺ 转视角",
    act_rotR: "转视角 ↻",
    act_zoomIn: "拉近",
    act_zoomOut: "拉远",
    act_levels: "选关",
    keyTip: "←/→ 转视角 · 1/2/3 落位 · 空格确认 · Tab 换候选块 · Esc 取消 · R 重摆",
    touchTip: "单指拖动转视角 · 点端头露出的木块抽出 · 点塔顶三个槽位落位",
    holding: "手上这块：点塔顶槽位落位",
    pickHint: "点端头露出的木块把它抽出来",

    obj_safe: "安全块",
    obj_load: "承重块",
    obj_gust: "阵风机",
    stat_support: "支撑",
    stat_com: "质心",
    stat_lean: "倾角",
    stat_overhang: "悬臂",
    ui_collapse: "塔倒",
    fx_cascade: "塌落",
    hazardNone: "无机关",

    helpTitle: "玩法说明",
    help1: "标准 Jenga：3 块一层、共 18 层，层间 90° 正交交错。只有端头露出来的块能被抽出；某个邻居被抽走后，中间那块也就露出了端头。",
    help2: "抽出一块，就必须把它叠到塔顶。抽块削的是支撑、伤在塔底；落位加的是高度与重心、险在塔顶 —— 这是两条完全不同的风险轴。",
    help3: "四档判倒逐帧审计：①每块底部 4 角失去支撑 ②整塔质心越出塔垫 ③倾角超过 3° 且当帧不回落 ④单块悬空超过自身长度 40% 且上方压重不足 2 块。任何一档命中，塔立刻塌。",
    help4: "连续成功抽叠涨连击，第 n 次成功 ×3^n：第 3 次 ×27，第 18 次触达 ×3¹⁸ = 387,420,489 的封神金标。塔倒或换手立刻清零。",
    help5: "承重块标记：用粉笔圈出的块抽了必倒，必须绕开。阵风机每 5 秒来一阵侧风，塔身会跟着晃 —— 风里抽块要看准间隙。",
    help6: "三种模式：极限塔（4 章 24 关，星级评价）、双人对决（轮流抽叠，谁弄倒谁输，三局两胜）、残局解谜（四选一，挑出唯一抽了不塌的那块）。",
    helpClose: "知道了",

    pauseTitle: "已暂停",
    pauseResume: "继续",
    pauseRestart: "重摆这座塔",
    pauseMenu: "返回选关",

    resultWin: "达标！",
    resultLose: "塔倒了",
    resultLine: "得分 {s} · 最高 {l} 层 · 最高连击 {c}",
    resultStarsLabel: "评级",
    resultNext: "下一关",
    resultRetry: "再来一次",
    resultLevels: "返回选关",
    resultLast: "已是最后一关，回到选关看看别的吧",
    newRecord: "新纪录",

    levelsTitle: "选关",
    levelsLocked: "先通过前一关",
    levelsStars: "★ {n}",
    saveReset: "重置存档",
    saveResetConfirm: "确定清空本地纪录？",
    saveCleared: "存档已重置",

    duelHint: "轮流抽叠，谁把塔弄倒谁输本局",
    duelRoundLabel: "第 {n} 局",
    duelTurn: "轮到 P{n}",
    duelScore: "P1 {a} : P2 {b}",
    duelRoundWin: "P{n} 赢下本局",
    duelSeries: "P{n} 拿下三局两胜！",
    duelAgain: "再来一局系列赛",

    riddleTip: "四块里只有一块抽了不会塌 —— 把它挑出来",
    riddleProgress: "第 {i}/{n} 题",
    riddleCorrect: "抽对了！这块撑得住",
    riddleWrong: "这块一抽就塌",
    riddleDone: "答对 {c}/{n} 题",
    riddleAgain: "再来一组",

    toastIllegal: "这块现在抽不动",
    toastNoSlot: "手上没木块，先抽一块",
    toastLoad: "粉笔圈住的承重块被抽 —— 塔立刻塌",
    toastStreak: "{n} 连 ×{m}",
    toastSpire: "封神 ×3¹⁸！",
    toastGust: "阵风来袭",
    toastBlocked: "这座塔已经倒了",
    toastLocked: "先把前一关过了",

    chapter_1: "入门抽块",
    chapter_2: "重心博弈",
    chapter_3: "结构微操",
    chapter_4: "通天塔",

    level_1: "起手式",
    level_2: "稳三抽",
    level_3: "探塔腰",
    level_4: "听咯吱",
    level_5: "换口气",
    level_6: "十连稳",
    level_7: "选槽开局",
    level_8: "偏心一寸",
    level_9: "压住重心",
    level_10: "再起三层",
    level_11: "半步试探",
    level_12: "拔到廿二",
    level_13: "风起前的静",
    level_14: "承重告警",
    level_15: "绕开白圈",
    level_16: "顶着风抽",
    level_17: "两阵之间",
    level_18: "十三连稳",
    level_19: "风里的廿二",
    level_20: "金标在望",
    level_21: "逆风换手",
    level_22: "廿四层阶梯",
    level_23: "通天前夜",
    level_24: "封神一抽"
  },
  en: {
    langName: "Language",
    langBtn: "中文",
    docTitle: "Jenga Tower · DOIN Arcade",
    appTitle: "Jenga Tower",
    back: "← Portal",
    sound: "Sound",
    soundOn: "🔊",
    soundOff: "🔇",
    help: "How to Play",
    canvasLabel: "Isometric 2.5D tower stage",
    noscript: "JavaScript is required to play Jenga Tower.",

    boardTitle: "Chalkboard",
    stat_score: "Score",
    stat_streak: "Streak",
    stat_mult: "Mult",
    stat_layers: "Layers",
    stat_height: "Height",
    ui_danger: "Danger",
    bestScore: "Best Score",
    bestLayers: "Best Height",
    bestStreak: "Best Streak",

    mode_spire: "Solo Spire",
    mode_duel: "2P Duel",
    mode_riddle: "Safety Riddle",
    levelLabel: "Level {n}",
    levelNameSep: "·",
    goalLabel: "Goal",
    goalMoves: "{n} clean pull-stacks",
    goalLayers: "Reach {n} layers",
    goalStreakAdd: "with a x27 streak",
    goalNone: "Free practice",
    progressLabel: "{a}/{b}",
    unlockedLabel: "Cleared {n}/{t}",

    slot_left: "Left",
    slot_mid: "Mid",
    slot_right: "Right",
    act_pull: "Pull",
    act_stack: "Stack",
    act_cancel: "Cancel Pull",
    act_rebuild: "Reset Tower",
    act_rotL: "↺ Rotate",
    act_rotR: "Rotate ↻",
    act_zoomIn: "Zoom In",
    act_zoomOut: "Zoom Out",
    act_levels: "Levels",
    keyTip: "Arrows rotate · 1/2/3 stack · Space confirm · Tab cycle blocks · Esc cancel · R rebuild",
    touchTip: "Drag to rotate · tap an exposed end block to pull · tap one of the three top slots to stack",
    holding: "Block in hand: pick a top slot",
    pickHint: "Tap an exposed end block to pull it out",

    obj_safe: "Safe Block",
    obj_load: "Load Block",
    obj_gust: "Gust Fan",
    stat_support: "Support",
    stat_com: "Center of Mass",
    stat_lean: "Lean",
    stat_overhang: "Overhang",
    ui_collapse: "Collapse",
    fx_cascade: "Cascade",
    hazardNone: "No hazards",

    helpTitle: "How to Play",
    help1: "Standard Jenga: three blocks per layer, eighteen layers, each layer turned ninety degrees. Only exposed end blocks can be pulled - once a neighbour is gone, the middle block becomes an end block too.",
    help2: "Whatever you pull must be stacked on top. Pulling eats away support and hurts the base; stacking adds height and moves the center of mass and endangers the top. Two very different risk axes.",
    help3: "Four collapse checks run every frame: (1) a block loses every support corner, (2) the tower's center of mass leaves the pad, (3) lean passes three degrees without falling back that frame, (4) a block overhangs forty percent of its length with less than two blocks pressing down. Any one of them topples the tower.",
    help4: "Every clean pull-stack grows the streak: the nth success pays x3^n. Three in a row is x27, and eighteen hits x3^18 = 387,420,489 - the Spire Mark. Collapse or handover resets it to x1.",
    help5: "Load blocks are circled in chalk: pulling one drops the tower on the spot, so route around them. The gust fan fires a side wind every five seconds - read the gap between gusts before you pull.",
    help6: "Three modes: Solo Spire (four chapters, twenty-four levels, star ratings), 2P Duel (take turns; whoever topples the tower loses the round, best of three) and Safety Riddle (pick the one block out of four that survives a pull).",
    helpClose: "Got it",

    pauseTitle: "Paused",
    pauseResume: "Resume",
    pauseRestart: "Reset Tower",
    pauseMenu: "Back to Levels",

    resultWin: "Target Met!",
    resultLose: "The Tower Fell",
    resultLine: "Score {s} · best height {l} layers · best streak {c}",
    resultStarsLabel: "Rating",
    resultNext: "Next Level",
    resultRetry: "Try Again",
    resultLevels: "Back to Levels",
    resultLast: "That was the last level - head back to the level list",
    newRecord: "New record",

    levelsTitle: "Levels",
    levelsLocked: "Clear the level before it",
    levelsStars: "{n} stars",
    saveReset: "Reset Save",
    saveResetConfirm: "Erase local records?",
    saveCleared: "Save cleared",

    duelHint: "Take turns; whoever topples the tower loses the round",
    duelRoundLabel: "Round {n}",
    duelTurn: "P{n}'s turn",
    duelScore: "P1 {a} : P2 {b}",
    duelRoundWin: "P{n} takes the round",
    duelSeries: "P{n} wins the best of three!",
    duelAgain: "New Series",

    riddleTip: "Only one of the four survives a pull - find it",
    riddleProgress: "Question {i}/{n}",
    riddleCorrect: "Right! That one holds",
    riddleWrong: "Pulling that one brings it down",
    riddleDone: "{c}/{n} correct",
    riddleAgain: "Another Set",

    toastIllegal: "That block will not budge",
    toastNoSlot: "Pull a block first",
    toastLoad: "You pulled a chalked load block - the tower goes down",
    toastStreak: "{n} streak x{m}",
    toastSpire: "SPIRE x3^18!",
    toastGust: "Gust incoming",
    toastBlocked: "This tower has already fallen",
    toastLocked: "Clear the level before it",

    chapter_1: "First Pull",
    chapter_2: "Balancing Act",
    chapter_3: "Fine Structure",
    chapter_4: "Skyward Spire",

    level_1: "Opening Grip",
    level_2: "Three Steady Pulls",
    level_3: "Feel the Waist",
    level_4: "Hear It Creak",
    level_5: "Catch Your Breath",
    level_6: "Ten Clean Pulls",
    level_7: "Pick Your Slot",
    level_8: "Off by an Inch",
    level_9: "Hold the Balance",
    level_10: "Three More Layers",
    level_11: "Half-Step Probe",
    level_12: "Reach Twenty-Two",
    level_13: "Calm Before Wind",
    level_14: "Load Warning",
    level_15: "Walk Around Chalk",
    level_16: "Pull Against Wind",
    level_17: "Between Two Gusts",
    level_18: "Thirteen Straight",
    level_19: "Twenty-Two in Wind",
    level_20: "Gold Mark in Sight",
    level_21: "Handover Uphill",
    level_22: "Stair to Twenty-Four",
    level_23: "Eve of the Spire",
    level_24: "One Pull to Glory"
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

// {n} {s} {c} {l} {a} {b} 等任意字母占位符格式化
export function format(locale, key, values = {}) {
  const text = strings(locale)[key] ?? String(key);
  return text.replace(/\{([a-zA-Z]+)\}/g, (_, name) => String(values[name] ?? ""));
}

export { LOCALES };
