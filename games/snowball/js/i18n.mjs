// Shared language preference and UI copy for Snowball Bros.

export const LANG_KEY = "doin.lang";

export const strings = {
  zh: {
    docTitle: "雪人兄弟·滚雪球 · DOIN 在线小游戏",
    appTitle: "雪人兄弟",
    appSub: "滚雪球",
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
    levels: "选关",
    levelsAria: "打开关卡选择",
    mode: "模式",
    modeAria: "切换游戏模式",
    pause: "暂停",
    resume: "继续",
    pauseAria: "暂停或继续游戏",

    chapterVillage: "雪原村庄",
    chapterCrystal: "冰晶洞穴",
    chapterAurora: "极光峰顶",
    modeLevel: "闯关模式",
    modeRush: "雪崩冲刺",
    modeShortLevel: "闯关",
    modeShortRush: "冲刺",
    bossLabel: "章末首领",
    modeLevelDesc: "三十关三章，冻结小怪、推大雪球，一路撞到章末首领。",
    modeRushDesc: "九十秒限时清场，滚动雪球撞出最高的连锁雪崩。",
    modeTitle: "选择模式",
    modeDesc: "随时切换，两种模式各有节奏。",

    levelLabel: "第 {n} 关",
    levelShort: "第 {n} 关",
    levelBanner: "第 {n} 关 · {chapter}",
    bossBanner: "章末首领 · {chapter}",
    score: "得分",
    lives: "生命",
    time: "用时",
    chain: "连锁",
    chainShort: "连锁 {n}",
    best: "最高 {n}",
    stars: "星",
    starCount: "{n} / 3",
    totalStars: "已集 {n} / {total} 星",

    levelSelectTitle: "雪原关卡册",
    levelSelectDesc: "三章三十关，随点随进；章末有首领镇守。",
    levelSelectAria: "关卡选择",
    levelCardAria: "第 {n} 关，{stars} 星",
    levelCurrent: "当前",
    chapterProgress: "{done} / 10",

    helpTitle: "怎么玩",
    help1: "左右移动、跳跃，靠近小怪按住喷雪，把它冻成雪球。",
    help2: "贴着雪球朝它走，就能把雪球推出去滚动。",
    help3: "雪球会越滚越大，碾过小怪、撞碎冰砖，撞墙还会反弹。",
    help4: "连续撞倒三个以上触发连锁雪崩，额外加分并震屏。",
    help5: "被小怪或投掷物碰到会损失一条命；清空全部敌人即可过关。",
    help6: "章末首领只能被滚动的大雪球撞伤，撞满三次就能击败它。",
    controlsTitle: "操作",
    controlsKeyboard: "A / D 或 ← → 移动 · Z 喷雪 · X 跳跃 · P / Esc 暂停",
    controlsTouch: "左侧摇杆移动 · 右侧喷雪与跳跃键",

    pauseTitle: "雪停了",
    pauseDesc: "局面已冻结，随时可以继续。",
    pauseResume: "继续游戏",
    pauseRestart: "重开本关",
    pauseLevels: "打开关卡册",

    resultTitle: "清场成功",
    resultBoss: "首领倒下",
    resultRush: "冲刺结束",
    resultGameOver: "雪人倒下了",
    resultCompleted: "三十关全通，雪原归于宁静。",
    resultStars: "获得星数",
    resultTime: "本关用时",
    resultChain: "最高连锁",
    resultScore: "总得分",
    resultKills: "撞倒数量",
    resultNext: "下一关",
    resultReplay: "重玩本关",
    resultLevels: "返回关卡册",
    resultRetry: "再试一次",
    resultBest: "最佳纪录 {n}",
    nextUp: "接下来玩",
    nextUpDesc: "同样是街机清场，换一种手感。",
    gameBomber: "炸弹人",
    gameBrawler: "操场大乱斗",
    gameShaft: "深渊百层",

    rushTitle: "雪崩冲刺",
    rushClock: "剩余 {n} 秒",
    rushScore: "冲刺得分",
    rushBest: "冲刺最佳 {n}",
    toastRush: "雪崩冲刺开始，九十秒内尽情撞",
    toastLevel: "已切回闯关模式",
    toastPaused: "已暂停",
    toastResumed: "继续",
    newRecord: "刷新纪录",
    levelCleared: "本关清场",
    gameOverToast: "生命耗尽，再试一次",
    lastLevel: "最后一关",

    spray: "喷雪",
    jump: "跳跃",
    moveLeft: "向左移动",
    moveRight: "向右移动",
    stageAria: "滚雪球游戏舞台",
    stickAria: "虚拟摇杆",
    keyHint: "A / D 移动 · Z 喷雪 · X 跳跃 · P 暂停",
    keyHintTouch: "左侧摇杆移动 · 按住喷雪 · 点跳跃",
    hudLevel: "关卡",
    hudLives: "生命",
    hudScore: "得分",
    hudChain: "连锁",
    hudTime: "用时",
    htmlLang: "zh-CN",
  },
  en: {
    docTitle: "Snowball Bros · DOIN Arcade",
    appTitle: "Snowball Bros",
    appSub: "Roll & Rush",
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
    levels: "Levels",
    levelsAria: "Open the level book",
    mode: "Mode",
    modeAria: "Switch game mode",
    pause: "Pause",
    resume: "Resume",
    pauseAria: "Pause or resume",

    chapterVillage: "Snow Village",
    chapterCrystal: "Crystal Cave",
    chapterAurora: "Aurora Peak",
    modeLevel: "Level Mode",
    modeRush: "Avalanche Rush",
    modeShortLevel: "Levels",
    modeShortRush: "Rush",
    bossLabel: "Chapter Boss",
    modeLevelDesc: "Thirty levels across three chapters. Freeze foes, push a giant snowball, and topple each chapter boss.",
    modeRushDesc: "Ninety seconds of pure rolling. Chain the biggest avalanche you can.",
    modeTitle: "Choose a mode",
    modeDesc: "Switch any time; each mode has its own rhythm.",

    levelLabel: "Level {n}",
    levelShort: "L{n}",
    levelBanner: "Level {n} · {chapter}",
    bossBanner: "Chapter Boss · {chapter}",
    score: "Score",
    lives: "Lives",
    time: "Time",
    chain: "Chain",
    chainShort: "Chain {n}",
    best: "Best {n}",
    stars: "Stars",
    starCount: "{n} / 3",
    totalStars: "{n} / {total} stars",

    levelSelectTitle: "Snowfield Level Book",
    levelSelectDesc: "Three chapters, thirty levels. Tap any stage; a boss guards each chapter end.",
    levelSelectAria: "Level select",
    levelCardAria: "Level {n}, {stars} stars",
    levelCurrent: "Now",
    chapterProgress: "{done} / 10",

    helpTitle: "How to Play",
    help1: "Move and jump. Hold the spray near a foe to pack it into a snowball.",
    help2: "Walk into a snowball to shove it into a roll.",
    help3: "The ball grows as it rolls, crushes foes, smashes ice bricks and bounces off walls.",
    help4: "Topple three or more in a row to trigger a Chain Avalanche for bonus points and a screen shake.",
    help5: "Foes and thrown ice cost a life. Clear every foe to finish the level.",
    help6: "Chapter bosses only take damage from a rolling giant snowball. Hit three times to win.",
    controlsTitle: "Controls",
    controlsKeyboard: "A / D or ← → move · Z spray · X jump · P / Esc pause",
    controlsTouch: "Left stick to move · Spray and Jump on the right",

    pauseTitle: "Snowfall Paused",
    pauseDesc: "The field is frozen. Resume whenever you like.",
    pauseResume: "Resume",
    pauseRestart: "Restart level",
    pauseLevels: "Open level book",

    resultTitle: "Field Cleared",
    resultBoss: "Boss Down",
    resultRush: "Rush Over",
    resultGameOver: "The Snowman Fell",
    resultCompleted: "All thirty levels cleared. The snowfield is quiet again.",
    resultStars: "Stars earned",
    resultTime: "Level time",
    resultChain: "Best chain",
    resultScore: "Total score",
    resultKills: "Foes toppled",
    resultNext: "Next level",
    resultReplay: "Replay level",
    resultLevels: "Back to level book",
    resultRetry: "Try again",
    resultBest: "Best {n}",
    nextUp: "Play next",
    nextUpDesc: "More arcade clearing, with a different feel.",
    gameBomber: "Bomber",
    gameBrawler: "Playground Brawl",
    gameShaft: "Abyss 100",

    rushTitle: "Avalanche Rush",
    rushClock: "{n}s left",
    rushScore: "Rush score",
    rushBest: "Rush best {n}",
    toastRush: "Avalanche Rush begins. Roll for ninety seconds.",
    toastLevel: "Back to Level Mode",
    toastPaused: "Paused",
    toastResumed: "Resumed",
    newRecord: "New record",
    levelCleared: "Field cleared",
    gameOverToast: "Out of lives. Try again.",
    lastLevel: "Final level",

    spray: "Spray",
    jump: "Jump",
    moveLeft: "Move left",
    moveRight: "Move right",
    stageAria: "Snowball game stage",
    stickAria: "Virtual stick",
    keyHint: "A / D move · Z spray · X jump · P pause",
    keyHintTouch: "Left stick moves · hold Spray · tap Jump",
    hudLevel: "Level",
    hudLives: "Lives",
    hudScore: "Score",
    hudChain: "Chain",
    hudTime: "Time",
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
