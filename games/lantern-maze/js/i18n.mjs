// i18n.mjs —— 中英双语表，语言偏好统一读 localStorage["doin.lang"]（zh/en）

export const LANG_KEY = "doin.lang";
export const LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "zh";

/** 影魅名按颜色取（色盲友好：名牌与巷中剪影都用同一称呼） */
export const GHOST_NAMES = {
  zh: { red: "赤影", pink: "桃影", cyan: "青影", orange: "橘影", violet: "直影", lime: "巡影", gray: "哑影" },
  en: { red: "Crimson", pink: "Blossom", cyan: "Azure", orange: "Amber", violet: "Dart", lime: "Ranger", gray: "Hush" },
};

/** 影魅状态键 ← engine.ghostStateKey() */
const GHOST_ST = {
  zh: { house: "匣中", exiting: "出匣", eyes: "归巢", fright: "惊惶", scatter: "巡游", chase: "猎杀" },
  en: { house: "Caged", exiting: "Leaving", eyes: "Homing", fright: "Frightened", scatter: "Rounds", chase: "Hunting" },
};

const DICT = {
  zh: {
    appTitle: "灯笼巷",
    appKicker: "LANTERN LANE",
    back: "返回门户",
    sound: "音效",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",

    modeCampaign: "一夜五更",
    modeTimed: "破晓冲刺",
    modeSurvival: "百鬼夜巷",
    modeWorkshop: "扎巷坊",
    modeIntroCampaign: "手作三十更，逐更解锁新规矩：跟手、绕鬼、影列收编、夜雾与双影匣，打完五更便天亮。",
    modeIntroTimed: "120 秒连清长街：清一更续 40 秒，吞一影续 2 秒，熄灯扣 15 秒。计时归零即结算。",
    modeIntroSurvival: "一张环形大巷撑到天亮：每 60 秒追加一只影魅（最多 8 只），光尘撒满重吃。",
    modeIntroWorkshop: "自己剪一条巷子：七道笔刷扎巷，五道硬验收把关，扎好了用巷码发给朋友比成绩。",

    hudWatch: "更次",
    hudLevel: "第 {n} 更",
    hudLevelShort: "第 {n} 关",
    hudScore: "灯分",
    hudBest: "最高分",
    hudDots: "光尘",
    hudTime: "更漏",
    hudRound: "第 {n} 轮",
    hudChain: "连清 {n} 巷",
    hudLives: "余灯",
    hudWick: "灯芯",
    hudTally: "更签",
    hudTallyMax: "{n} / 90 枚",
    hudGhosts: "影谱",
    hudDaylight: "天亮",
    hudPhaseChase: "猎杀",
    hudPhaseScatter: "巡游",
    hudFright: "惊惶",
    hudTrain: "影列",
    hudLocked: "通关五更解锁",
    hudLockedTimed: "通关三更解锁",

    tallyClear: "清巷",
    tallyNoDeath: "零熄灯",
    tallyFast: "效率项",
    tallyHint: "每更三枚更签：清空光尘、一盏灯不熄、效率项达标（用时不超标准线／一珠吞三影／影列 ≥3）",

    readyKicker: "一夜五更",
    readyTitle: "灯笼巷",
    readyDesc: "纸巷深处，一盏灯、四道影。吃光巷子里的每一粒光尘，躲开会算你下一步的影魅；吞下日曜珠，这条街就换你追它们。",
    btnStart: "上灯开局",
    btnContinue: "继续更次",
    btnModes: "选择玩法",
    btnLevels: "选择更次",
    btnNextWatch: "下一更",
    btnRetry: "再走一遍",
    btnBackStage: "返回灯棚",
    btnBackBench: "回扎巷坊",
    btnRehearse: "影子试跑",
    btnDash: "提灯",
    btnPause: "暂停",
    btnResume: "继续",

    statusPaused: "帘落 · 暂停",
    resultCleared: "此更清透",
    resultLost: "灯尽天明前",
    resultWon: "天亮 · 一夜走通",
    resultTimedOver: "计时归零",
    resultSurvivalOver: "被影围杀",
    resultStars: "更签",
    resultScore: "本更灯分",
    resultTime: "用时",
    resultDeaths: "熄灯",
    resultGhosts: "吞影",
    resultDots: "光尘",
    resultChain: "最长影列",
    resultFruits: "流明灯",
    resultPar: "标准线",
    newBest: "新纪录",
    resultNoteCleared: "更鼓三响，纸窗逐亮。",
    resultNoteLost: "光尘还亮着，影魅仍在巷里。",

    lostExtinguished: "灯灭了",
    lostTimeUp: "更漏滴尽",

    helpTitle: "玩法说明",
    help1: "1. 方向键 / WASD 或触屏四向滑动：提灯人只在巷子里走直线，到口才可转弯。",
    help2: "2. 贴角提前转弯：到路口前一格就能预输入方向，落地即转，绝不「按了左却撞墙」。原地反向等同「退回来源格」，随时可掉头。",
    help3: "3. 吃满整巷光尘即过更。被影魅碰到熄一盏灯（一夜三盏），在原地重生，光尘与影魅状态不清场。",
    help4: "4. 四只影魅各有脾性：赤影直取、桃影抄你前面四格、青影绕你两侧、橘影呆久了就跑。它们会读你的位置，不会读心，但会算路。",
    help5: "5. 吞下日曜珠，整条街轰然天亮：影魅转蓝缩成剪影，撞上去即吞（同珠内 200→400→800→1600 翻倍）。惊惶快结束时白闪两次，那之后它们就恢复原味了。",
    help6: "6. 空格（或右翼提灯钮）＝提灯：0.4 秒爆亮，把半径内的影魅逼退半步并驱散夜雾，冷却 6 秒、消耗灯芯。灯芯也是夜雾里的视野资源。",
    help7: "7. P / Esc 暂停，R 重开本更，Enter 开局或进下一更。",
    helpClose: "我知道了",

    levelsTitle: "选择更次",
    levelsNote: "更签逐关累计，五更六关；未解锁的更次需先走完上一更。",
    watchProgress: "第{w}更 · {n} / 18 签",

    workshopTitle: "扎巷坊",
    workshopDesc: "纸巷裁铺：先挑一张纸样起手，笔刷沿台面排开。右下角巷码可粘贴载入；五道验收全绿才可保存分享。",
    brushWall: "裁墙",
    brushPath: "铺路",
    brushDot: "撒光尘",
    brushPearl: "埋日曜珠",
    brushHouse: "放影匣",
    brushSpawn: "定出生点",
    brushFruit: "流明灯",
    brushNoUp: "禁上转",
    brushDoor: "匣门",
    toolMirror: "一键镜像",
    toolGrid: "网格辅助线",
    toolUndo: "撤回",
    toolRedo: "重做",
    toolClear: "清空纸样",
    toolTemplate: "纸样",
    toolValidate: "五道验收",
    toolSave: "保存入巷",
    toolShare: "复制巷码",
    toolPaste: "粘贴巷码",
    toolPlay: "进这条巷子",
    toolRename: "巷子题名",
    toolDeleteSaved: "删除",
    tplRing: "双环宽巷",
    tplLanes: "多岔窄巷",
    tplSquare: "回字窄巷",
    tplBlank: "白纸一张",

    vOK: "五道验收全绿：此巷可玩",
    vWarn: "验收通过，但影子试跑偏吃力：巷子略逼仄",
    vBad: "验收未过：改完再扎",
    rule1: "① 连通：每粒光尘与影匣门都须从出生点可达",
    rule2: "② 环路 ≥3：纯树状死巷没有退路",
    rule3: "③ 巡逻 ≤46 步可达全巷；日曜珠 ≥2 颗且两两距 ≥8",
    rule4: "④ 出生点距匣门 ≥6 步；日曜珠不得在死角",
    rule5: "⑤ 影子试跑：注入种子自动跑图，吃净率须 ≥55%（<75% 只提示）",
    ruleShape: "纸样须为整幅等长行",
    problemNoSpawn: "缺出生点",
    problemNoHouse: "缺影匣或匣门",
    problemIsland: "孤岛光尘（不可达）",
    problemTrap: "环路不足（无退路）",
    problemPatrol: "影匣走不到这些格子",
    problemPearl: "日曜珠分布不合规",
    problemSpawn: "出生点紧贴匣门",
    problemThin: "光尘太少",
    savedOK: "已存入擂台簿",
    savedFail: "验收未过，暂不保存",
    codeCopied: "巷码已复制",
    codeCopyFail: "复制失败，请长按选中",
    codeBad: "巷码无效",
    codeLoaded: "巷码已载入",
    codeLoadFail: "此巷码未过验收",
    arenaTitle: "擂台簿",
    arenaDesc: "本机记录你在自家巷码上的成绩：不做上传、不做排行榜。",
    arenaEmpty: "擂台簿还是空的",
    arenaBest: "最佳 {score} 分",

    handHint: "四向滑动走巷 · 巷中贴角可提前转弯",
    swipePad: "竹笛摇杆",
    fogHint: "夜雾收束视野，灯芯越亮看得越远",
    dashCool: "冷却 {n}s",
    dashReady: "可提灯",

    tourHead: "老更夫的三句话",
    tour1: "别贪近路：影魅算的就是你想走的那条。",
    tour2: "珠留到被包夹时再吞，天亮是你唯一的解围。",
    tour3: "绕着鬼打转比直线逃跑多三秒——三秒够吃二十粒光尘。",
  },
  en: {
    appTitle: "Lantern Lane",
    appKicker: "LANTERN LANE",
    back: "Back to portal",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to play",

    modeCampaign: "Five Watches",
    modeTimed: "Daybreak Sprint",
    modeSurvival: "Hundred Ghosts",
    modeWorkshop: "Lane Workshop",
    modeIntroCampaign: "Thirty hand-cut watches. Each watch unlocks a new rule: reading your turns, ghost trains, night fog, twin ghost-boxes. Finish watch V and the sun comes up.",
    modeIntroTimed: "120 seconds of continuous lanes: clear a lane +40s, swallow a ghost +2s, lose a lamp −15s. When the water clock hits zero the run settles.",
    modeIntroSurvival: "One ring lane until dawn: a new ghost joins every 60s (up to 8) and the dust refills itself.",
    modeIntroWorkshop: "Cut your own lane: seven brushes, five hard acceptance checks, then share it as a lane code so friends can beat your score.",

    hudWatch: "Watch",
    hudLevel: "Watch {n}",
    hudLevelShort: "Level {n}",
    hudScore: "Lantern score",
    hudBest: "Best",
    hudDots: "Dust",
    hudTime: "Water clock",
    hudRound: "Round {n}",
    hudChain: "{n} lanes in a row",
    hudLives: "Lamps",
    hudWick: "Wick",
    hudTally: "Tally sticks",
    hudTallyMax: "{n} / 90 sticks",
    hudGhosts: "Ghost roster",
    hudDaylight: "Daylight",
    hudPhaseChase: "Hunting",
    hudPhaseScatter: "Rounds",
    hudFright: "Fright",
    hudTrain: "Ghost train",
    hudLocked: "Clear all five watches",
    hudLockedTimed: "Clear watch III",

    tallyClear: "Lane cleared",
    tallyNoDeath: "No lamp lost",
    tallyFast: "Efficiency",
    tallyHint: "Three tally sticks per watch: clear every mote, lose no lamp, and meet the efficiency bar (under par time / three ghosts on one pearl / ghost train ≥3)",

    readyKicker: "Five night watches",
    readyTitle: "Lantern Lane",
    readyDesc: "Deep in the paper alleys: one lamp, four shadows. Eat every mote of dust, out-think ghosts that read your next turn, and swallow a sun-pearl to make the street chase them instead.",
    btnStart: "Light the lamp",
    btnContinue: "Continue watch",
    btnModes: "Choose mode",
    btnLevels: "Choose watch",
    btnNextWatch: "Next watch",
    btnRetry: "Walk it again",
    btnBackStage: "Back to the lantern shed",
    btnBackBench: "Back to the workshop",
    btnRehearse: "Shadow run",
    btnDash: "Lantern",
    btnPause: "Pause",
    btnResume: "Resume",

    statusPaused: "Curtain down · paused",
    resultCleared: "This watch is clean",
    resultLost: "The lamps ran dry",
    resultWon: "Daybreak · the whole night walked",
    resultTimedOver: "Clock empty",
    resultSurvivalOver: "Ran out of lane",
    resultStars: "Tally sticks",
    resultScore: "Watch score",
    resultTime: "Time",
    resultDeaths: "Lamps lost",
    resultGhosts: "Ghosts eaten",
    resultDots: "Dust eaten",
    resultChain: "Longest train",
    resultFruits: "Drifting lights",
    resultPar: "Par",
    newBest: "New record",
    resultNoteCleared: "Three drums; the paper windows light up one by one.",
    resultNoteLost: "The dust is still glowing, and so are they.",

    lostExtinguished: "The lamp went out",
    lostTimeUp: "The water clock ran dry",

    helpTitle: "How to play",
    help1: "1. Arrow keys / WASD, or swipe four ways on touch: the lamplighter only moves along lanes and may only turn at a junction.",
    help2: "2. Corner buffering: you may queue a turn one tile early and it snaps in on arrival. Reversing means sliding back onto the tile you came from — always available.",
    help3: "3. Sweep all dust to clear the watch. A ghost touch snuffs one lamp (three per night); you respawn on the spot with dust and ghosts left as they were.",
    help4: "4. Four temperaments: Crimson takes you head-on, Blossom cuts four tiles ahead, Azure fans to your flanks, Amber wanders off when it gets bored. They read your position, not your mind.",
    help5: "5. Swallow a sun-pearl and the street flips to dawn gold: ghosts turn blue and shrink — touch them to eat them (200→400→800→1600 within one pearl). Two white flashes warn they are about to recover.",
    help6: "6. Space (or the lantern knob on the right wing) = Lantern flash: 0.4s burst that shoves nearby ghosts half a step back and burns off the fog. 6s cooldown, costs wick — which is also your sight radius at night.",
    help7: "7. P / Esc pauses, R restarts the watch, Enter starts or advances.",
    helpClose: "Got it",

    levelsTitle: "Choose a watch",
    levelsNote: "Tally sticks accrue per level; six levels a watch, and the next one opens once you clear the current.",
    watchProgress: "Watch {w} · {n} / 18 sticks",

    workshopTitle: "Lane Workshop",
    workshopDesc: "A paper-alley cutting bench: start from a template, brushes laid out on the console edge. Paste a lane code at the right. Save and share only once all five checks are green.",
    brushWall: "Cut wall",
    brushPath: "Lay path",
    brushDot: "Sow dust",
    brushPearl: "Bury pearl",
    brushHouse: "Set box",
    brushSpawn: "Set spawn",
    brushFruit: "Drift light",
    brushNoUp: "No up-turn",
    brushDoor: "Box door",
    toolMirror: "Mirror",
    toolGrid: "Guide lines",
    toolUndo: "Undo",
    toolRedo: "Redo",
    toolClear: "Clear sheet",
    toolTemplate: "Template",
    toolValidate: "Run checks",
    toolSave: "Save lane",
    toolShare: "Copy code",
    toolPaste: "Paste code",
    toolPlay: "Walk this lane",
    toolRename: "Name this lane",
    toolDeleteSaved: "Delete",
    tplRing: "Twin rings",
    tplLanes: "Many forks",
    tplSquare: "Concentric",
    tplBlank: "Blank sheet",

    vOK: "All five checks green: this lane is playable",
    vWarn: "Checks pass but the shadow run struggled: the lane is a touch cramped",
    vBad: "Checks failed: re-cut before saving",
    rule1: "① Reachability: every mote, pearl and box door must be reachable from spawn",
    rule2: "② Cycles ≥ 3: a pure tree lane has no way out",
    rule3: "③ Patrol: every tile within 46 steps of a box; ≥2 pearls, ≥8 apart",
    rule4: "④ Safety: spawn ≥6 steps from the box door; pearls never in a corner",
    rule5: "⑤ Shadow run: seeded autoplay must eat ≥55% of the lane (<75% only warns)",
    ruleShape: "Rows must all be the same width",
    problemNoSpawn: "No spawn",
    problemNoHouse: "No ghost-box or door",
    problemIsland: "Orphaned dust (unreachable)",
    problemTrap: "Too few loops (nowhere to run)",
    problemPatrol: "Box cannot reach these tiles",
    problemPearl: "Pearl placement illegal",
    problemSpawn: "Spawn hugging the box door",
    problemThin: "Too little dust",
    savedOK: "Saved to the ledger",
    savedFail: "Checks failed — not saved",
    codeCopied: "Lane code copied",
    codeCopyFail: "Copy failed — select it by hand",
    codeBad: "Invalid lane code",
    codeLoaded: "Lane code loaded",
    codeLoadFail: "This code failed the checks",
    arenaTitle: "Arena ledger",
    arenaDesc: "Your scores on your own lanes, stored locally: no upload, no leaderboard.",
    arenaEmpty: "The ledger is still blank",
    arenaBest: "Best {score}",

    handHint: "Swipe four ways · queue turns one tile early",
    swipePad: "Bamboo flute pad",
    fogHint: "Night fog narrows your sight; a brighter wick sees further",
    dashCool: "Cooldown {n}s",
    dashReady: "Lantern ready",

    tourHead: "Three words from the old night watchman",
    tour1: "Don't take the shortcut: that's the line they compute.",
    tour2: "Save a pearl until you're flanked — dawn is your only escape.",
    tour3: "Kiting a ghost buys three seconds more than running straight. Three seconds is twenty motes.",
  },
};

export const GHOST_STATE = GHOST_ST;

export function isLocale(locale) {
  return typeof locale === "string" && LOCALES.includes(locale);
}

export function strings(locale) {
  return DICT[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function ghostName(locale, color, fallback = "") {
  const table = GHOST_NAMES[isLocale(locale) ? locale : DEFAULT_LOCALE];
  return table[color] ?? fallback;
}

export function ghostStateName(locale, key) {
  const table = GHOST_ST[isLocale(locale) ? locale : DEFAULT_LOCALE];
  return table[key] ?? key;
}

export function detectLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch {
    // 存储不可用则走浏览器语言
  }
  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    }
  } catch {
    // 降级
  }
  return DEFAULT_LOCALE;
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return DEFAULT_LOCALE;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, locale);
    }
  } catch {
    // 写入异常静默
  }
  return locale;
}

export function htmlLang(locale) {
  return isLocale(locale) && locale === "en" ? "en" : "zh-CN";
}

export function format(str, params) {
  if (typeof str !== "string") return "";
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

/** 把 data-i18n / data-i18n-title / data-i18n-aria 一次性刷进 DOM */
export function applyLocale(root, locale) {
  const s = strings(locale);
  if (!root || typeof root.querySelectorAll !== "function") return s;
  for (const el of root.querySelectorAll("[data-i18n]")) {
    const v = s[el.dataset.i18n];
    if (typeof v === "string" && v) el.textContent = v;
  }
  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    const v = s[el.dataset.i18nTitle];
    if (typeof v === "string" && v) el.setAttribute("title", v);
  }
  for (const el of root.querySelectorAll("[data-i18n-aria]")) {
    const v = s[el.dataset.i18nAria];
    if (typeof v === "string" && v) el.setAttribute("aria-label", v);
  }
  return s;
}
