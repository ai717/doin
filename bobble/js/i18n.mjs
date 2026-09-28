// 泡泡射手 · 全站共享中英双语表（语言偏好统一读写 localStorage["doin.lang"]）

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const LOCALES = {
  zh: {
    langName: "中文",
    title: "泡泡射手",
    siteName: "DOIN 在线小游戏",
    back: "← 门户",
    soundOn: "🔊 音效开",
    soundOff: "🔇 音效关",
    langBtn: "EN",
    help: "玩法说明",
    pause: "暂停",
    resume: "继续",
    pauseTitle: "已暂停",
    pauseHint: "冰窟已冻结 · 随时继续",
    startTitle: "泡泡射手 · 极光冰窟",
    startSub: "打支撑柱 · 墙面反弹 · 冰层下压 · 雪崩连锁",
    modeStage: "冰层攀登",
    modePuzzle: "断柱残局",
    modeEndless: "无尽寒潮",
    modeDaily: "每日残局",
    chapter1: "第一章 · 浅冰层",
    chapter2: "第二章 · 深蓝渊",
    chapter3: "第三章 · 极光核",
    level: "第 {n} 关",
    locked: "未解锁",
    targetShots: "目标发数",
    shots: "用弹数",
    shotsLeft: "剩余发数",
    bubblesLeft: "剩余冰泡",
    chain: "连锁",
    maxChain: "最大连锁",
    pressIn: "冰压下压",
    pressNow: "下压！",
    icePick: "冰镐弹",
    prism: "棱镜泡",
    swap: "换弹",
    restart: "重开本关",
    aim: "瞄准档位",
    aimClassic: "经典",
    aimExtended: "完整",
    aimPro: "硬核",
    assist: "色盲符号",
    goalClear: "清空全盘",
    goalCrystal: "让冰晶坠落",
    statusAim: "瞄准中",
    statusFlying: "发射中",
    statusWin: "通关！",
    statusOver: "触及冰封线",
    rescue: "绝境补给 · 棱镜泡",
    avalanche: "雪崩 ×{n}",
    keyTip: "←/→ 微调角度 · Shift 精调 · 空格发射 · S 换弹 · K 冰镐弹",
    touchTip: "拖拽瞄准 · 松手发射",
    cleared: "通关！",
    clearStats: "用弹 {s} · 目标 {t} · 最大连锁 {c}",
    starsLine: "获得 {n} 星",
    nextLevel: "下一关",
    retry: "再战本关",
    toSelect: "返回选关",
    over: "本局结束",
    overStats: "生存 {s} 发 · 最大连锁 {c} · 得分 {p}",
    again: "再来一局",
    backMenu: "返回主菜单",
    bestEndless: "生存最佳",
    dailyBest: "今日最佳",
    puzzleTitle: "残局 {n}",
    puzzleProgress: "已解 {n} / 24",
    puzzleWin: "冰晶坠落！",
    puzzleFail: "冰晶未坠落",
    hintNoPick: "冰镐弹已用尽",
    hintSwap: "已换弹",
    hintPress: "冰盖即将下压",
    helpTitle: "玩法说明",
    helpBody1: "转动底部棱镜炮台发射彩泡，三颗及以上同色相连即爆开。",
    helpBody2: "真正的杀招是打支撑柱：切断与冰盖的连接，整片冰塔会雪崩坠落，坠落分远高于直接消除。",
    helpBody3: "侧墙可以镜面反弹，直线打不到的凹角，靠反弹绕进去。",
    helpBody4: "每累计若干发，冰盖下压一行；任一颗泡触及底部冰封线即失败。场上颜色越少，下压越快。",
    helpBody5: "冰镐弹可穿透三格凿出通道（不计分）；棱镜泡是万能色，绝境时会自动补给。",
    helpBody6: "过关按用弹数评星：不超过目标发数即三星。",
    helpClose: "知道了",
    saveReset: "重置存档",
    saveResetConfirm: "确定清空本作全部进度与记录？",
    saveCleared: "存档已清空",
    starsTotal: "总星数 {n}",
    unlockedNew: "解锁新关卡"
  },
  en: {
    langName: "English",
    title: "Bubble Shooter",
    siteName: "DOIN Online Games",
    back: "← Portal",
    soundOn: "🔊 Sound on",
    soundOff: "🔇 Sound off",
    langBtn: "中文",
    help: "How to Play",
    pause: "Pause",
    resume: "Resume",
    pauseTitle: "Paused",
    pauseHint: "The cavern is frozen · resume anytime",
    startTitle: "Bubble Shooter · Aurora Ice",
    startSub: "Cut the stem · Bank off walls · Creeping freeze · Avalanche chains",
    modeStage: "Ice Ascent",
    modePuzzle: "One-Shot Puzzle",
    modeEndless: "Deep Freeze",
    modeDaily: "Daily Board",
    chapter1: "Chapter I · Shallow Ice",
    chapter2: "Chapter II · Deep Blue",
    chapter3: "Chapter III · Aurora Core",
    level: "Level {n}",
    locked: "Locked",
    targetShots: "Target shots",
    shots: "Shots",
    shotsLeft: "Shots left",
    bubblesLeft: "Bubbles left",
    chain: "Chain",
    maxChain: "Max chain",
    pressIn: "Ice press",
    pressNow: "PRESS!",
    icePick: "Ice pick",
    prism: "Prism",
    swap: "Swap",
    restart: "Restart",
    aim: "Aim assist",
    aimClassic: "Classic",
    aimExtended: "Full",
    aimPro: "Pro",
    assist: "Colour aid",
    goalClear: "Clear the board",
    goalCrystal: "Drop the crystal",
    statusAim: "Aiming",
    statusFlying: "Firing",
    statusWin: "Cleared!",
    statusOver: "Freeze line reached",
    rescue: "Emergency prism supply",
    avalanche: "AVALANCHE ×{n}",
    keyTip: "←/→ aim · Shift fine tune · Space fire · S swap · K ice pick",
    touchTip: "Drag to aim · release to fire",
    cleared: "Cleared!",
    clearStats: "Shots {s} · Target {t} · Max chain {c}",
    starsLine: "{n} stars earned",
    nextLevel: "Next level",
    retry: "Retry",
    toSelect: "Level select",
    over: "Run over",
    overStats: "Survived {s} shots · Max chain {c} · Score {p}",
    again: "Play again",
    backMenu: "Main menu",
    bestEndless: "Endless best",
    dailyBest: "Today best",
    puzzleTitle: "Puzzle {n}",
    puzzleProgress: "Solved {n} / 24",
    puzzleWin: "Crystal dropped!",
    puzzleFail: "Crystal still hanging",
    hintNoPick: "Ice pick depleted",
    hintSwap: "Bubble swapped",
    hintPress: "Ice sheet about to press",
    helpTitle: "How to Play",
    helpBody1: "Rotate the prism cannon at the bottom and fire: three or more touching bubbles of one colour burst.",
    helpBody2: "The real kill move is cutting the stem: sever the link to the ice sheet and the whole tower avalanches. Falling bubbles score far more than popped ones.",
    helpBody3: "Side walls reflect like a mirror. Pockets you cannot reach directly open up with a bank shot.",
    helpBody4: "Every few shots the ice sheet presses down one row; any bubble touching the freeze line ends the run. Fewer colours on the board means faster presses.",
    helpBody5: "The ice pick drills through three cells to open a lane (no score); the prism bubble is a wildcard and is supplied automatically in emergencies.",
    helpBody6: "Stars are rated by shots used: at or under target earns three stars.",
    helpClose: "Got it",
    saveReset: "Reset save",
    saveResetConfirm: "Erase all local progress and records?",
    saveCleared: "Save cleared",
    starsTotal: "Total {n} stars",
    unlockedNew: "New level unlocked"
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

export function format(locale, key, values = {}) {
  const text = strings(locale)[key] ?? String(key);
  return text.replace(/\{(n|t|s|c|b|m|l|p)\}/g, (_, name) => String(values[name] ?? ""));
}

export { LOCALES };
