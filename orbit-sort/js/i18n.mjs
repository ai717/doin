// i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。
// 默认显示语言规则：doin.lang 有合法值 → 用它；否则浏览器语言 zh* → 中文，其余 → 英文。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

// engine.mjs 的 rejection 消息是规则层唯一权威，不做改动；这里按原文映射英文译文。
const ENGINE_EN = Object.freeze({
  "无法识别这次调度": "Unrecognized move",
  "已完成轨道不能取出星体": "Completed lanes are locked",
  "这条轨道当前不能取出星体": "This lane can't extract right now",
  "已完成轨道不能继续落入": "Completed lanes are locked",
  "这条轨道当前不能落入星体": "This lane can't take an orb right now",
  "无法识别这次操作": "Unrecognized action",
});

const STRINGS = {
  zh: {
    docTitle: "星轨调度大师",
    title: "星轨调度大师",
    lede: "选择一条星轨继续调度",
    dailyTitle: "今日挑战",
    dailyDesc: "每天一个高难度挑战关卡",
    challengeAria: "每日随机高难度挑战，高分奖励",
    continueDaily: "继续今日挑战",
    continueGame: "继续上次对局",
    levelGridAria: "主线关卡",
    hudAria: "积分面板",
    hudMoves: "步数",
    hudPar: "最少",
    hudStep: "步",
    hudScore: "本关得分",
    hudTotal: "总积分",
    boardStageAria: "星轨棋盘",
    boardAria: "星轨调度棋盘",
    dockLabel: "中转槽 {0} · {1}{2}",
    dockColor: "颜色 {0}",
    dockEmpty: "空，可点击后继续调入",
    dockSelected: "，已选中",
    toolsAria: "对局工具",
    toolLevel: "关卡",
    toolLevelAria: "关卡选择",
    toolInfo: "详情",
    toolInfoAria: "关卡详情",
    toolSound: "声音",
    toolSoundOff: "静音",
    toolSoundAriaOn: "开启声音",
    toolSoundAriaOff: "关闭声音",
    toolHint: "提示",
    toolHintAria: "帮助",
    toolHintTitle: "帮助 (H)",
    toolReset: "重置",
    toolResetAria: "重置",
    toolResetTitle: "重置 (R)",
    toolUndo: "撤销",
    toolUndoAria: "撤销",
    toolUndoTitle: "撤销 (Z)",
    resultTitle: "恭喜，星轨已稳定",
    breakdownAria: "积分明细",
    wbBase: "基础分",
    wbMove: "步数分",
    wbTime: "时间分",
    wbTotal: "合计得分",
    nextLevel: "下一关 →",
    replay: "重玩",
    resetTitle: "重新开始本关？",
    resetDesc: "当前调度将被清除。",
    resetConfirm: "重新开始",
    resetCancel: "继续当前",
    infoTitle: "关卡详情",
    backToGame: "返回对局",
    levelLabel: "第 {0} 关",
    dailyNode: "今日挑战",
    scoreBadgeBest: "得分",
    scoreBadgePerfect: "总分",
    chapterLabel: "第 {0} 章 {1}",
    chapterPathAria: "第 {0} 章关卡",
    chapterStable: "{0} · 已稳定 {1} / {2}",
    ariaLevelDone: "第 {0} 关，已通关，得分 {1}，总分 {2}",
    ariaLevelReady: "第 {0} 关，总分 {1}，可开始",
    ariaLevelLocked: "第 {0} 关，未解锁，总分 {1}",
    ch1Title: "晨星港",
    ch1Desc: "在冰蓝晨光中熟悉星核调度",
    ch2Title: "赤沙航道",
    ch2Desc: "穿越恒星尘暴，控制更紧的缓冲空间",
    ch3Title: "翡翠星云",
    ch3Desc: "在生命星云中识别更复杂的颜色秩序",
    ch4Title: "紫晶裂隙",
    ch4Desc: "跨越高能裂隙，应对更长的调度链",
    ch5Title: "深空王座",
    ch5Desc: "在终局星海中完成最高密度的星轨调度",
    infoDaily: "今日挑战 · {0} · 难度 D{1} · {2} 条轨道 · 容量 {3} · 中转槽 {4} · 目标 {5} 步",
    infoLevel: "第 {0} 关 · 难度 D{1} · {2} 条轨道 · 容量 {3} · 中转槽 {4} · 目标 {5} 步",
    resultDaily: "🏆 今日挑战 · {0} · 得分 {1} / {2} · 步数 {3}",
    resultMain: "得分 {0} / {1} · 步数 {2} / {3}",
    newHighScore: " · 🏆 新高分！",
    newBest: " · 新纪录",
    metaNewHigh: "🏆 新高分 · ",
    totalHint: "累计总积分 {0}",
    moveFull: "步数满分 (≤{0})",
    moveOver: "超满分步数 {0} 步",
    timeFull: "时间满分 (≤{0}s)",
    timeOver: "用时 {0}s (满分≤{1}s)",
    msgWon: "星轨已稳定",
    msgStuckRender: "当前无后续调度；刚才的移动符合规则，可撤销重规划",
    msgStuck: "当前无后续调度；刚才的移动符合规则，可撤销或重置",
    msgStuckReset: "当前无后续调度，建议撤销最近一步或重置本关",
    msgSelectDock: "选择轨道入口，将星体调入星核",
    msgSelectTrack: "选择高亮轨道，落下星体",
    msgInsertMode: "当前是放入模式；若要从这条轨道取出，请先再次点击中转槽取消选中",
    msgBackToExtract: "已切回取出模式；当前局面无后续调度，可撤销或重置",
    msgToExtract: "已切换为取出模式，可继续调入另一颗星体",
    msgAlreadyExtract: "当前已是取出模式，直接点击轨道入口即可调入星体",
    msgUndone: "已撤销一次调度",
    msgResetDone: "已重置本关",
    msgUnsolvable: "当前局面无法通关，建议撤销最近一步重新规划",
    msgHintUndo: "先撤销最近一步试试",
    msgHintInsert: "已标出推荐目标轨道",
    msgHintExtract: "已标出推荐调入轨道",
    msgHintFail: "提示暂时不可用，请先自行尝试",
    msgThinking: "正在推演可行调度",
    langLabel: "Switch to English",
    langShort: "EN",
    langAria: "切换语言",
  },
  en: {
    docTitle: "Orbit Sort · DOIN games",
    title: "Orbit Sort",
    lede: "Pick a star lane and keep sorting",
    dailyTitle: "Daily Challenge",
    dailyDesc: "A fresh high-difficulty level every day",
    challengeAria: "A daily random high-difficulty challenge with bonus scoring",
    continueDaily: "Continue daily",
    continueGame: "Continue last game",
    levelGridAria: "Main levels",
    hudAria: "Score panel",
    hudMoves: "Moves",
    hudPar: "Par",
    hudStep: "",
    hudScore: "Level score",
    hudTotal: "Total",
    boardStageAria: "Orbit board",
    boardAria: "Orbit sorting board",
    dockLabel: "Dock {0} · {1}{2}",
    dockColor: "Color {0}",
    dockEmpty: "Empty — tap to dock an orb",
    dockSelected: ", selected",
    toolsAria: "Game tools",
    toolLevel: "Levels",
    toolLevelAria: "Level select",
    toolInfo: "Info",
    toolInfoAria: "Level details",
    toolSound: "Sound",
    toolSoundOff: "Muted",
    toolSoundAriaOn: "Sound on",
    toolSoundAriaOff: "Sound off",
    toolHint: "Hint",
    toolHintAria: "Hint",
    toolHintTitle: "Hint (H)",
    toolReset: "Reset",
    toolResetAria: "Reset",
    toolResetTitle: "Reset (R)",
    toolUndo: "Undo",
    toolUndoAria: "Undo",
    toolUndoTitle: "Undo (Z)",
    resultTitle: "Orbit stabilized!",
    breakdownAria: "Score breakdown",
    wbBase: "Base",
    wbMove: "Moves bonus",
    wbTime: "Time bonus",
    wbTotal: "Total score",
    nextLevel: "Next level →",
    replay: "Replay",
    resetTitle: "Restart this level?",
    resetDesc: "Current moves will be cleared.",
    resetConfirm: "Restart",
    resetCancel: "Keep playing",
    infoTitle: "Level details",
    backToGame: "Back to game",
    levelLabel: "Level {0}",
    dailyNode: "Daily",
    scoreBadgeBest: "Score",
    scoreBadgePerfect: "Par score",
    chapterLabel: "Chapter {0} · {1}",
    chapterPathAria: "Chapter {0} levels",
    chapterStable: "{0} · {1} / {2} stabilized",
    ariaLevelDone: "Level {0}, cleared, score {1}, par score {2}",
    ariaLevelReady: "Level {0}, par score {1}, ready to play",
    ariaLevelLocked: "Level {0}, locked, par score {1}",
    ch1Title: "Morningstar Harbor",
    ch1Desc: "Learn the star core in icy morning light",
    ch2Title: "Crimson Sands Channel",
    ch2Desc: "Cross the dust storm with tighter docking space",
    ch3Title: "Emerald Nebula",
    ch3Desc: "Read richer color order inside a living nebula",
    ch4Title: "Amethyst Rift",
    ch4Desc: "Cross the high-energy rift with longer sorting chains",
    ch5Title: "Deep Space Throne",
    ch5Desc: "Finish the densest sorting in the final star sea",
    infoDaily: "Daily · {0} · Difficulty D{1} · {2} lanes · capacity {3} · docks {4} · par {5}",
    infoLevel: "Level {0} · Difficulty D{1} · {2} lanes · capacity {3} · docks {4} · par {5}",
    resultDaily: "🏆 Daily · {0} · Score {1} / {2} · Moves {3}",
    resultMain: "Score {0} / {1} · Moves {2} / {3}",
    newHighScore: " · 🏆 New best!",
    newBest: " · New record",
    metaNewHigh: "🏆 New best · ",
    totalHint: "Total score {0}",
    moveFull: "Full moves bonus (≤{0})",
    moveOver: "{0} moves over the cap",
    timeFull: "Full time bonus (≤{0}s)",
    timeOver: "{0}s used (cap {1}s)",
    msgWon: "Orbit stabilized",
    msgStuckRender: "No further moves; the last move was legal — undo or re-plan",
    msgStuck: "No further moves; the last move was legal — undo or reset",
    msgStuckReset: "No further moves — undo the last step or reset",
    msgSelectDock: "Pick a lane entry to send the orb into the star core",
    msgSelectTrack: "Pick a highlighted lane to drop the orb",
    msgInsertMode: "You're placing an orb; to extract from this lane, tap the dock again to cancel the selection",
    msgBackToExtract: "Back to extracting; no further moves — undo or reset",
    msgToExtract: "Switched to extracting; you can dock another orb",
    msgAlreadyExtract: "Already extracting — tap a lane entry to send the orb in",
    msgUndone: "Move undone",
    msgResetDone: "Level reset",
    msgUnsolvable: "This position can't be cleared — undo the last step and re-plan",
    msgHintUndo: "Undo the last step first",
    msgHintInsert: "Highlighted the suggested target lane",
    msgHintExtract: "Highlighted the suggested lane to dock from",
    msgHintFail: "Hint unavailable right now — try it yourself first",
    msgThinking: "Working out a possible sorting…",
    langLabel: "切换到中文",
    langShort: "中文",
    langAria: "Switch language",
  },
};

// engine 消息翻译：zh 原样返回；en 按原文查表，查不到也原样返回（不吞错误）。
export function engineMessage(text) {
  if (typeof text !== "string") return text;
  return ENGINE_EN[text] ?? text;
}

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

// 简单插值："第 {0} 关" + format(3) → "第 3 关"
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
