// Shared language preference and all interface copy for Flick Duel.

export const LANG_KEY = "doin.lang";

export const strings = {
  zh: {
    docTitle: "双人指弹飞棋 · DOIN 在线小游戏",
    appTitle: "双人指弹飞棋",
    appSub: "拉弓弹子 · 穿孔过线",
    backHome: "← 门户",
    backHomeAria: "返回 DOIN 门户",
    langToggle: "切换语言",
    langShort: "EN",
    soundOn: "开启音效",
    soundOff: "关闭音效",
    help: "玩法",
    helpAria: "玩法说明",
    close: "关闭",
    closeAria: "关闭面板",

    modeBtn: "模式",
    modeAria: "打开模式与盘面设置",
    pause: "暂停",
    resume: "继续",
    pauseAria: "暂停或继续对局",

    hudTurn: "回合",
    hudRound: "已弹",
    hudTime: "用时",
    roundRatio: "{n} / {max}",
    seatSouth: "下方",
    seatNorth: "上方",
    seatYou: "你",
    seatAi: "对手",
    seatP1: "玩家 1",
    seatP2: "玩家 2",
    turnYou: "轮到你弹射",
    turnAi: "对手正在弹射",
    turnP1: "轮到玩家 1（下方）",
    turnP2: "轮到玩家 2（上方）",
    boardAria: "实木指弹桌面，拖拽棋子蓄力弹射",

    selectTitle: "对局设置",
    selectDesc: "单人对 AI 或同屏双人共用同一张桌面。调整后点开始对局即刻生效。",
    modeLabel: "模式",
    modeSolo: "单人对 AI",
    modeDuel: "同屏双人",
    diffLabel: "AI 难度",
    diffNovice: "新手",
    diffSkilled: "进阶",
    diffMaster: "大师",
    boardLabel: "盘面",
    board1: "单孔盘",
    board2: "双孔盘",
    board3: "三孔盘",
    board1Desc: "中线一枚铜环孔门，瞄准最纯粹。",
    board2Desc: "两枚孔门分列左右，斜线更从容。",
    board3Desc: "三枚孔门齐开，节奏最快、火力最密。",
    sideLabel: "开球方",
    sideBottom: "下方先手",
    sideTop: "上方先手",
    startMatch: "开始对局",
    selectHint: "设置会自动记住；对局中可随时呼出本面板。",

    pausedTitle: "已暂停",
    pausedHint: "棋子已定格，切回来后可以继续。",
    resumeBtn: "继续对局",
    restartBtn: "重新开局",
    pausedNote: "暂停期间物理与计时全部冻结。",

    keyHint: "按住棋子拖拽蓄力，松手弹射 · 方向键瞄准 · 空格蓄力 · Tab 换子 · P/Esc 暂停",
    keyHintTouch: "按住自己的棋子向后拉，松手弹射；孔门亮起即过线",

    helpTitle: "怎么玩",
    help1: "轮到你时，按住本方半场的棋子向反方向拉，松手把它弹出去。",
    help2: "拖得越远力度越大；力度条满格时棋子会轻微抖动。",
    help3: "中线是一道桌缝，只有铜环孔门能穿过，精准瞄孔才能过线。",
    help4: "棋子过线后留在对方半场，成为对方要清走的负担。",
    help5: "先把本方半场的棋子全部清空的一方获胜。",
    help6: "撞开对方棋子、借力打力都可能改变局势，但别把对方的子撞回自己半场。",
    help7: "六十回合仍未分出胜负时，本方半场剩余棋子更少的一方获胜，相同则平局。",
    help8: "P 或 Esc 随时暂停；切到后台会自动冻结，回来继续。",
    controlsTitle: "操作",
    controlsKeyboard: "方向键瞄准 · 空格蓄力松开发射 · Tab 换子 · P/Esc 暂停 · R 重开",
    controlsTouch: "按住棋子向后拉蓄力，松手弹射；拖回原点取消",

    resultTitle: "对局结束",
    winSolo: "你赢了",
    loseSolo: "对手赢了",
    duelWinSouth: "下方玩家获胜",
    duelWinNorth: "上方玩家获胜",
    drawTitle: "平局",
    resultRounds: "弹射回合",
    resultTime: "本局用时",
    resultReason: "胜负判定",
    resultStats: "单人战绩",
    resultStatsValue: "{wins} 胜 · {losses} 负 · {draws} 平",
    reasonCleared: "清空半场",
    reasonLimit: "回合上限",
    resultNote: "刷新最佳纪录",
    resultBest: "最佳 {rounds} 回合 · {time}",
    resultReplay: "再来一局",
    resultMode: "换模式再战",
    nextUp: "接下来玩",
    gameAirpuck: "双人霓虹气垫球",
    gameBumper: "微型回旋撞车",
    gameBilliards: "绿呢桌球",

    toastGate: "穿孔过线",
    toastTurn: "换人了",
    toastReady: "拖拽棋子开始弹射",

    htmlLang: "zh-CN",
  },
  en: {
    docTitle: "Flick Duel · DOIN Arcade",
    appTitle: "Flick Duel",
    appSub: "Pull · Charge · Flick",
    backHome: "← Portal",
    backHomeAria: "Back to the DOIN portal",
    langToggle: "Switch language",
    langShort: "中文",
    soundOn: "Sound on",
    soundOff: "Sound off",
    help: "How to play",
    helpAria: "How to play",
    close: "Close",
    closeAria: "Close panel",

    modeBtn: "Modes",
    modeAria: "Open mode and board settings",
    pause: "Pause",
    resume: "Resume",
    pauseAria: "Pause or resume the match",

    hudTurn: "Turn",
    hudRound: "Shots",
    hudTime: "Time",
    roundRatio: "{n} / {max}",
    seatSouth: "Bottom",
    seatNorth: "Top",
    seatYou: "You",
    seatAi: "Rival",
    seatP1: "Player 1",
    seatP2: "Player 2",
    turnYou: "Your flick",
    turnAi: "Rival is flicking",
    turnP1: "Player 1 flicking (bottom)",
    turnP2: "Player 2 flicking (top)",
    boardAria: "Solid wood flick table, drag a puck to charge a shot",

    selectTitle: "Match Setup",
    selectDesc: "Solo against the AI or two players on one screen share the same table. Pick and start right away.",
    modeLabel: "Mode",
    modeSolo: "Solo vs AI",
    modeDuel: "Two Players",
    diffLabel: "AI level",
    diffNovice: "Novice",
    diffSkilled: "Skilled",
    diffMaster: "Master",
    boardLabel: "Board",
    board1: "One Gate",
    board2: "Two Gates",
    board3: "Three Gates",
    board1Desc: "A single copper gate on the seam. Purest aiming.",
    board2Desc: "Two gates split left and right for angled shots.",
    board3Desc: "Three gates wide open. Fastest, busiest pace.",
    sideLabel: "First flick",
    sideBottom: "Bottom first",
    sideTop: "Top first",
    startMatch: "Start match",
    selectHint: "Settings are remembered; open this panel anytime during a match.",

    pausedTitle: "Paused",
    pausedHint: "Every puck is frozen. Continue whenever you are back.",
    resumeBtn: "Resume match",
    restartBtn: "Restart",
    pausedNote: "Physics and the clock are fully frozen while paused.",

    keyHint: "Hold a puck and pull back, release to flick · arrows aim · Space charges · Tab switches · P/Esc pauses",
    keyHintTouch: "Hold your puck, pull back, release to flick; a lit gate means a clean crossing",

    helpTitle: "How to Play",
    help1: "On your turn, hold one of your pucks and pull backwards, then release to send it sliding.",
    help2: "The farther you pull, the harder the flick. At full charge the puck shivers slightly.",
    help3: "The center seam is a wooden rail: only the copper ring gates let a puck through.",
    help4: "A puck that crosses stays in the rival half and becomes their burden to clear.",
    help5: "The first side to empty its own half wins.",
    help6: "Knocking rival pucks can swing the table, but do not knock them back into your own half.",
    help7: "After sixty shots, the side with fewer pucks in its half wins; a tie is a draw.",
    help8: "Press P or Esc to pause; leaving the tab freezes the table automatically.",
    controlsTitle: "Controls",
    controlsKeyboard: "Arrows aim · hold Space to charge, release to fire · Tab switches puck · P/Esc pauses · R restarts",
    controlsTouch: "Hold a puck and pull back to charge; drag back to the start to cancel",

    resultTitle: "Match Over",
    winSolo: "You win",
    loseSolo: "Rival wins",
    duelWinSouth: "Bottom player wins",
    duelWinNorth: "Top player wins",
    drawTitle: "Draw",
    resultRounds: "Shots taken",
    resultTime: "Match time",
    resultReason: "Decided by",
    resultStats: "Solo record",
    resultStatsValue: "{wins} wins · {losses} losses · {draws} draws",
    reasonCleared: "Half cleared",
    reasonLimit: "Shot limit",
    resultNote: "New best record",
    resultBest: "Best {rounds} shots · {time}",
    resultReplay: "Rematch",
    resultMode: "Change mode",
    nextUp: "Play next",
    gameAirpuck: "Neon Air Hockey",
    gameBumper: "Micro Bumper Cars",
    gameBilliards: "Green Felt Billiards",

    toastGate: "Clean crossing",
    toastTurn: "Turn passes",
    toastReady: "Drag a puck to flick",

    htmlLang: "en",
  },
};

export function t(locale, key, vars = {}) {
  const table = strings[locale] ?? strings.zh;
  const raw = table[key] ?? strings.zh[key] ?? key;
  return String(raw).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function hasKey(locale, key) {
  return Boolean(strings[locale] && Object.prototype.hasOwnProperty.call(strings[locale], key));
}

export function detectLocale() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // ignore restricted storage
  }
  try {
    const nav = (globalThis.navigator?.language || "zh").toLowerCase();
    return nav.startsWith("en") ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  try {
    localStorage.setItem(LANG_KEY, locale === "en" ? "en" : "zh");
  } catch {
    // ignore
  }
}

export function otherLocale(locale) {
  return locale === "en" ? "zh" : "en";
}

export function htmlLang(locale) {
  return t(locale, "htmlLang");
}
