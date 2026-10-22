// i18n.mjs —— 中英双语表，语言偏好统一读 localStorage["doin.lang"]（zh/en）

export const LANG_KEY = "doin.lang";
export const LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "zh";

/** 四只幽灵的名字按 id 取（与渲染层的灯管配色一一对应） */
export const GHOST_NAMES = {
  zh: { blinky: "赤灯", pinky: "粉灯", inky: "青灯", clyde: "橘灯" },
  en: { blinky: "Crimson", pinky: "Rose", inky: "Teal", clyde: "Amber" },
};

/** 幽灵状态键 ← engine 的 gh.mode */
const GHOST_ST = {
  zh: { scatter: "巡游", chase: "猎杀", frightened: "惊惶", eaten: "归巢", caging: "充能", exiting: "出巢" },
  en: { scatter: "Scatter", chase: "Hunt", frightened: "Fright", eaten: "Homing", caging: "Charging", exiting: "Leaving" },
};

/** 迷宫主题键 ← mazes.mjs 的 meta.key */
const MAZE_NAMES = {
  zh: {
    classic: "招牌初亮",
    duct: "风道回环",
    gate: "潮汐闸口",
    syrup: "糖浆暗区",
    frost: "结霜管廊",
    twin: "双灯巢",
    master: "总招牌",
  },
  en: {
    classic: "First Sign",
    duct: "Draft Loop",
    gate: "Tide Gate",
    syrup: "Syrup Pocket",
    frost: "Frost Gallery",
    twin: "Twin Nest",
    master: "Master Sign",
  },
};

/** 机关说明键 ← mazes.mjs 的 meta.tips */
const TIP_NAMES = {
  zh: {
    oneway: "单向风道",
    gate: "潮汐闸门",
    syrup: "糖浆区",
    ice: "结霜管",
    secondNest: "第二座灯巢",
    neverScatter: "永不巡游",
  },
  en: {
    oneway: "One-way duct",
    gate: "Tide gate",
    syrup: "Syrup zone",
    ice: "Frost tube",
    secondNest: "Second nest",
    neverScatter: "Never scatters",
  },
};

/** 机关玩法说明（关卡卡片与说明弹层共用） */
const TIP_HELP = {
  zh: {
    oneway: "顺着箭头走；逆着撞上去会顿 0.15 秒，等于把命交给追上来的灯。",
    gate: "闸门每 6 秒开合一次，闭合前 1 秒开始闪；被关在里面时它就是你唯一的掩体，也是你的棺材。",
    syrup: "你在糖浆里被拖慢 25%，幽灵照常；里面的豆是双倍分——用速度换分，或者绕开。",
    ice: "踏上结霜格后一路滑到撞墙，中途改不了方向；进冰之前就把路选好。",
    secondNest: "青灯与橘灯从第二座巢出发，包夹从两个方向同时成型。",
    neverScatter: "这张迷宫没有巡游节拍，四盏灯从头到尾都在猎杀——只有能量豆能喘口气。",
  },
  en: {
    oneway: "Follow the arrow; pushing against it stuns you for 0.15s — long enough to be caught.",
    gate: "The gate opens and shuts every 6s, flashing 1s before it closes. Inside is cover and coffin at once.",
    syrup: "You slow by 25% inside; ghosts don't. Pellets here score double — trade speed for points, or walk around.",
    ice: "Step on frost and you slide until you hit a wall, unable to turn mid-slide. Pick the line before you step on.",
    secondNest: "Teal and Amber leave from a second nest, so the pincer forms from two directions at once.",
    neverScatter: "No scatter beat in this maze — all four hunt from start to finish. Power pellets are your only air.",
  },
};

const DICT = {
  zh: {
    appTitle: "霓虹吃豆",
    appKicker: "NEON CHOMP",
    back: "返回门户",
    noscriptText: "这台霓虹招牌需要 JavaScript 才能点亮，请在浏览器里启用后重试。",
    sound: "音效",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",

    modeCampaign: "招牌战役",
    modeArcade: "街机无尽",
    modeSetpiece: "残局十张",
    modeIntroCampaign: "七张主题迷宫逐张点亮，每张引入一种新机关：风道、闸门、糖浆、结霜、双巢，最后一张永不巡游。",
    modeIntroArcade: "同一张迷宫无限续关：关数越高灯越快、能量豆的惊惶时间越短，撑到灯管烧断为止。",
    modeIntroSetpiece: "十张一命残局：清空指定豆、杀出重围、或在一颗能量豆里吞掉四盏灯。",

    hudScore: "分数",
    hudBest: "最高分",
    hudDots: "豆",
    hudLives: "命",
    hudLevel: "第 {n} 关",
    hudMaze: "迷宫",
    hudPhase: "节拍",
    hudPhaseScatter: "巡游",
    hudPhaseChase: "猎杀",
    hudFright: "惊惶",
    hudChain: "豆链 ×{n}",
    hudChainOff: "豆链断了",
    hudCombo: "连吞 {n}",
    hudBeats: "节拍轨",
    hudNextBeat: "{n}s 后换拍",
    hudCage: "充能 {n}s",
    hudStars: "灯管",
    hudStarsMax: "{n} / 21 支",
    hudTime: "用时",
    hudPar: "标准线",
    hudLeft: "剩余",
    hudGoal: "目标",
    hudSuppressed: "压制 {n}s",
    hudDotsLeft: "剩 {n} 颗",

    tallyClear: "清盘",
    tallyTime: "限时",
    tallyNoDeath: "零死亡",
    tallyHint: "每关三支灯管：清空全部豆、用时不超过标准线、一条命不掉。",

    readyKicker: "暗室 · 霓虹招牌",
    readyTitle: "霓虹吃豆",
    readyDesc: "暗室里一整墙弯制灯管。你吞豆，四盏灯算你的下一步；吞下能量豆，这条街就换你追它们——节拍一换，全体掉头。",
    btnStart: "合闸开局",
    btnContinue: "继续招牌",
    btnModes: "选择玩法",
    btnLevels: "选择迷宫",
    btnNext: "下一关",
    btnRetry: "再点一次",
    btnBackStage: "回到控制台",
    btnPause: "暂停",
    btnResume: "继续",
    btnReset: "重置进度",

    statusPaused: "镇流器断电 · 暂停",
    statusReady: "待合闸",
    resultCleared: "招牌全亮",
    resultLost: "灯管烧断",
    resultWon: "全部点亮",
    resultOver: "这一轮结束",
    resultStars: "灯管",
    resultScore: "本关分数",
    resultTime: "用时",
    resultDeaths: "掉命",
    resultGhosts: "吞灯",
    resultDots: "豆",
    resultChain: "最长豆链",
    resultBestChain: "最长连吞",
    resultLevel: "到达关数",
    resultPar: "标准线",
    newBest: "新纪录",
    resultNoteCleared: "一整墙灯管亮起，暗室里没有影子。",
    resultNoteLost: "灯灭了，豆还亮着。",

    lostExtinguished: "被灯撞灭",
    lostTimeUp: "时间到",
    lostSteps: "步数用尽",

    helpTitle: "玩法说明",
    help1: "方向键 / WASD 或触屏四向滑动：只在路口转弯。提前按键会排队入弯，最多提前约 2 格——更早的按键会作废，所以一次误按不会带你跑很远再自作主张拐出去；刚冲过路口一点点也还能回拉抓住它。原地反向随时可掉头。",
    help2: "四盏灯各有算法：赤灯直取你所在的格子；粉灯抄你前方 4 格；青灯以赤灯为轴做 2 倍反射，专打包夹；橘灯离你超过 8 格时直取，近了就缩回自己的角落。",
    help3: "节拍在巡游与猎杀之间切换（7 秒 / 20 秒 / 7 秒……），切换瞬间所有在场幽灵会立刻掉头。底部节拍轨与切换前 3 秒的心跳，就是给你数拍子用的。",
    help4: "吞下能量豆：四盏灯转蓝逃散，撞上去即吞，同一颗豆内 200 → 400 → 800 → 1600 翻倍。惊惶快结束时白闪，闪完它们就恢复原味。",
    help5: "被吞的灯回巢充能 2 秒才再出来；你每吃满 10 颗豆，就把巢里下一只多压 0.5 秒（单只最多 3 秒）——吃豆本身就是防守。",
    help6: "豆链：不停嘴每 10 颗升一档 ×1 / ×1.5 / ×2 / ×3；被幽灵逼近到 4 格内时，不断链的窗口从 1.2 秒收紧到 0.6 秒。",
    help7: "战役七张迷宫各带一种新机关；街机无尽随关数加速且惊惶越来越短；残局十张只有一条命。",
    help8: "P / Esc 暂停，R 重开本迷宫，Enter 开局或进下一关。",
    helpClose: "我知道了",

    levelsTitle: "选择迷宫",
    levelsNote: "七张主题迷宫逐张解锁，通关上一张才点亮下一张。",
    levelsLocked: "通关上一张解锁",
    levelsProgress: "第 {n} 张 · {s} 支灯管",

    setpieceTitle: "残局十张",
    setpieceNote: "十张一命残局，任意挑选，不计解锁。",
    goalClear: "清空高亮豆",
    goalEscape: "杀到出口",
    goalChain: "一颗豆吞四盏灯",
    goalHintClear: "把高亮的豆吃干净，别管别的。",
    goalHintEscape: "从出口那头杀出去，一路别被撞到。",
    goalHintChain: "先吃能量豆，再在惊惶结束前把四盏灯全吞掉。",

    settingsTitle: "控制台",
    settingsAiRead: "AI 可读化",
    settingsAiReadOn: "开：意图环 · 眼睛指向 · 节拍轨 · 充能倒计时",
    settingsAiReadOff: "关：硬核模式，全凭自己数拍子",
    settingsSound: "音效",
    settingsSpeed: "速度档",
    settingsSpeedNote: "你与四盏灯同倍变速，谁甩得开谁不变",
    speedCalm: "悠闲",
    speedStandard: "标准",
    speedSurge: "极速",
    settingsReset: "清空本机进度",
    settingsResetAsk: "确定清空？本机星级与纪录都会抹掉。",

    ghostRoster: "灯谱",
    ghostBlinky: "赤灯 · 直取",
    ghostPinky: "粉灯 · 抄前 4 格",
    ghostInky: "青灯 · 夹击反射",
    ghostClyde: "橘灯 · 怯场",

    handHint: "四向滑动走位 · 到路口前可提前转向",
    beatHintScatter: "正在巡游：四盏灯各回各的角落",
    beatHintChase: "正在猎杀：四盏灯一起算你的下一步",
    beatHintSwitch: "{n} 秒后换拍 · 全员掉头",
    frightHint: "惊惶 {n}s",
    cageHint: "巢内充能",
    chainHint: "豆链 ×{n} · {m}s 内不断",

    tourHead: "老师傅的三句话",
    tour1: "数拍子比躲灯重要：换拍那一下，所有灯都会掉头。",
    tour2: "能量豆留到被包夹时再吞，那颗豆是解围不是加分。",
    tour3: "绕着灯打转比直线逃跑多三秒——三秒够吃二十颗豆。",
  },
  en: {
    appTitle: "Neon Chomp",
    appKicker: "NEON CHOMP",
    back: "Back to portal",
    noscriptText: "This neon sign needs JavaScript to light up. Enable it in your browser and reload.",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to play",

    modeCampaign: "Sign Campaign",
    modeArcade: "Endless Arcade",
    modeSetpiece: "Ten Endgames",
    modeIntroCampaign: "Seven themed mazes light up one by one, each adding a new fitting: ducts, tide gates, syrup, frost, a second nest — and a finale that never scatters.",
    modeIntroArcade: "One maze, endless rounds: each round the lamps get faster and the fright window gets shorter. Last until the tube burns out.",
    modeIntroSetpiece: "Ten one-life endgames: clear the marked pellets, break out to the exit, or swallow all four lamps on a single power pellet.",

    hudScore: "Score",
    hudBest: "Best",
    hudDots: "Pellets",
    hudLives: "Lives",
    hudLevel: "Round {n}",
    hudMaze: "Maze",
    hudPhase: "Beat",
    hudPhaseScatter: "Scatter",
    hudPhaseChase: "Hunt",
    hudFright: "Fright",
    hudChain: "Chain ×{n}",
    hudChainOff: "Chain broken",
    hudCombo: "{n} in a row",
    hudBeats: "Beat track",
    hudNextBeat: "Switch in {n}s",
    hudCage: "Charging {n}s",
    hudStars: "Tubes",
    hudStarsMax: "{n} / 21 tubes",
    hudTime: "Time",
    hudPar: "Par",
    hudLeft: "Left",
    hudGoal: "Goal",
    hudSuppressed: "Held {n}s",
    hudDotsLeft: "{n} left",

    tallyClear: "Cleared",
    tallyTime: "Under par",
    tallyNoDeath: "No death",
    tallyHint: "Three tubes per maze: clear every pellet, beat par time, and lose no life.",

    readyKicker: "Dark room · neon sign",
    readyTitle: "Neon Chomp",
    readyDesc: "A whole wall of bent glass tube in a dark room. You eat pellets; four lamps compute your next step. Swallow a power pellet and the street turns on them — and when the beat flips, every lamp reverses on the spot.",
    btnStart: "Throw the switch",
    btnContinue: "Continue",
    btnModes: "Choose mode",
    btnLevels: "Choose maze",
    btnNext: "Next maze",
    btnRetry: "Light it again",
    btnBackStage: "Back to console",
    btnPause: "Pause",
    btnResume: "Resume",
    btnReset: "Reset progress",

    statusPaused: "Ballast off · paused",
    statusReady: "Ready",
    resultCleared: "The whole sign is lit",
    resultLost: "The tube burned out",
    resultWon: "Every sign lit",
    resultOver: "Run over",
    resultStars: "Tubes",
    resultScore: "Round score",
    resultTime: "Time",
    resultDeaths: "Lives lost",
    resultGhosts: "Lamps eaten",
    resultDots: "Pellets",
    resultChain: "Longest chain",
    resultBestChain: "Best combo",
    resultLevel: "Round reached",
    resultPar: "Par",
    newBest: "New record",
    resultNoteCleared: "The whole wall comes up, and the dark room has no shadows left.",
    resultNoteLost: "The lamp is out. The pellets are still glowing.",

    lostExtinguished: "Caught by a lamp",
    lostTimeUp: "Out of time",
    lostSteps: "Out of moves",

    helpTitle: "How to play",
    help1: "Arrow keys / WASD, or swipe four ways on touch: turns only happen at junctions. Press early and the turn queues — up to about 2 tiles ahead; anything earlier is dropped, so a stray tap can't carry you far and dive into a junction on its own. Overshoot a junction slightly and the turn still snaps back to catch it. Reversing on the spot is always allowed.",
    help2: "Four algorithms: Crimson walks straight at your tile; Rose aims four tiles ahead of you; Teal reflects a 2× vector around Crimson to pincer you; Amber charges when it's more than 8 tiles away and retreats to its corner when it closes in.",
    help3: "The beat flips between scatter and hunt (7s / 20s / 7s …). At the flip, every lamp on the board reverses instantly. The beat track at the bottom and the heartbeat 3s before are there so you can count it.",
    help4: "Swallow a power pellet and all four turn blue and flee — touch them to eat them: 200 → 400 → 800 → 1600 within one pellet. They flash white as fright runs out; after the flash they're themselves again.",
    help5: "An eaten lamp recharges in the nest for 2s before it comes back out. Every 10 pellets you eat holds the next one in for another 0.5s (3s cap per lamp) — eating is itself defense.",
    help6: "Pellet chain: keep eating and every 10 pellets steps the multiplier ×1 / ×1.5 / ×2 / ×3. With a lamp within 4 tiles, the window to keep it alive tightens from 1.2s to 0.6s.",
    help7: "Seven campaign mazes each add a new fitting; endless arcade speeds up and shortens fright each round; all ten endgames give you exactly one life.",
    help8: "P / Esc pauses, R restarts the maze, Enter starts or advances.",
    helpClose: "Got it",

    levelsTitle: "Choose a maze",
    levelsNote: "Seven themed mazes unlock in order — clear one to light the next.",
    levelsLocked: "Clear the previous maze",
    levelsProgress: "Maze {n} · {s} tubes",

    setpieceTitle: "Ten Endgames",
    setpieceNote: "Ten one-life endgames, free to pick, no unlock order.",
    goalClear: "Clear the lit pellets",
    goalEscape: "Fight your way to the exit",
    goalChain: "Eat four lamps on one pellet",
    goalHintClear: "Eat every lit pellet and ignore the rest.",
    goalHintEscape: "Break out through the exit without being caught.",
    goalHintChain: "Take the power pellet, then swallow all four before fright ends.",

    settingsTitle: "Console",
    settingsAiRead: "Readable AI",
    settingsAiReadOn: "On: intent rings · eyes on target · beat track · nest charge",
    settingsAiReadOff: "Off: hardcore — count the beat yourself",
    settingsSound: "Sound",
    settingsSpeed: "Speed tier",
    settingsSpeedNote: "You and the four lamps scale together — the chase gap stays intact",
    speedCalm: "Calm",
    speedStandard: "Standard",
    speedSurge: "Surge",
    settingsReset: "Clear local progress",
    settingsResetAsk: "Clear it? Stars and records on this device will be wiped.",

    ghostRoster: "Lamp roster",
    ghostBlinky: "Crimson · head-on",
    ghostPinky: "Rose · four ahead",
    ghostInky: "Teal · pincer",
    ghostClyde: "Amber · shy",

    handHint: "Swipe four ways · queue turns before the junction",
    beatHintScatter: "Scatter: each lamp heads for its own corner",
    beatHintChase: "Hunt: all four compute your next step",
    beatHintSwitch: "Beat flips in {n}s · all lamps reverse",
    frightHint: "Fright {n}s",
    cageHint: "Charging in nest",
    chainHint: "Chain ×{n} · {m}s to keep it",

    tourHead: "Three words from the old sign-maker",
    tour1: "Counting the beat beats dodging: at the flip, every lamp turns around.",
    tour2: "Save the power pellet until you're pincered — it's an escape, not a bonus.",
    tour3: "Circling a lamp buys three seconds more than running straight. Three seconds is twenty pellets.",
  },
};

export const GHOST_STATE = GHOST_ST;
export const MAZE_NAME = MAZE_NAMES;
export const TIP_NAME = TIP_NAMES;
export const TIP_DESC = TIP_HELP;

export function isLocale(locale) {
  return typeof locale === "string" && LOCALES.includes(locale);
}

export function strings(locale) {
  return DICT[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function ghostName(locale, id, fallback = "") {
  const table = GHOST_NAMES[isLocale(locale) ? locale : DEFAULT_LOCALE];
  return table[id] ?? fallback;
}

export function ghostStateName(locale, key) {
  const table = GHOST_ST[isLocale(locale) ? locale : DEFAULT_LOCALE];
  return table[key] ?? key;
}

/** 迷宫主题名（mazes.mjs 的 meta.key → 展示名） */
export function mazeName(locale, key, fallback = "") {
  const table = MAZE_NAMES[isLocale(locale) ? locale : DEFAULT_LOCALE];
  return table[key] ?? fallback;
}

/** 机关名（meta.tips 里的键 → 展示名） */
export function tipName(locale, key, fallback = "") {
  const table = TIP_NAMES[isLocale(locale) ? locale : DEFAULT_LOCALE];
  return table[key] ?? fallback;
}

/** 机关玩法说明 */
export function tipDesc(locale, key, fallback = "") {
  const table = TIP_HELP[isLocale(locale) ? locale : DEFAULT_LOCALE];
  return table[key] ?? fallback;
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
    if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, locale);
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

/** 把 data-i18n / data-i18n-title / data-i18n-aria 一次性刷进 DOM（原地热更新，不重建节点） */
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
