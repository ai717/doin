// 恶魔迷途 · 多语言双表与共享偏好管理 (doin.lang)
// 全站共享 key：localStorage["doin.lang"]（zh/en），禁止私有语言 key

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "恶魔迷途 · DOIN 在线小游戏",
    metaDesc:
      "恶魔迷途（Devil Run）：控制小方块跑跳冲向终点门，可脚下的砖、头顶的板、甚至重力都会反逻辑耍赖。50 个微关卡、零惩罚重生、固定可复现的坑爹陷阱，即点即玩！",
    title: "恶魔迷途",
    tagline: "每一步都可能是谎言 · 50 个微关卡",
    backHome: "返回首页",
    rules: "规则说明",
    sound: "音效",
    langShort: "EN",
    ariaLang: "切换语言",

    // 机台顶栏
    nodeLabel: "章节",
    levelLabel: "关卡",
    levelName: "{0}-{1}",
    timeLabel: "用时",
    bestLabel: "最佳",
    deathLabel: "死亡",
    candleLabel: "蜡烛",
    sealLabel: "印章",

    // 左翼印章台
    sealsTitle: "恶魔印章",
    sealClear: "通关印",
    sealCandle: "蜡烛印",
    sealFlawless: "无伤印",
    sealLocked: "未点亮",
    sealLit: "已点亮",
    nodeProgress: "{0} / {1}",

    // 操作台
    retry: "重玩",
    nextLevel: "下一关",
    selectLevel: "选关",
    close: "关闭",
    restartHint: "R 重玩",

    // 选关
    levelsTitle: "恶魔的五十课",
    nodeTitle: "第 {0} 章 · {1}",
    locked: "未解锁",
    cleared: "已通关",

    // 结算
    resultTitle: "逃出去了！",
    resultTitleFlawless: "毫发无伤！",
    resultTime: "用时",
    resultBest: "最佳",
    resultDeaths: "死亡次数",
    resultNewRecord: "新纪录！",
    resultCandle: "抢到了蜡烛",
    resultNoCandle: "蜡烛没拿到",
    resultSeal: "点亮的印章",
    resultNext: "下一关",
    resultRetry: "再来一次",
    resultMenu: "选关",
    resultFinal: "五十课全部通关！",

    // 规则
    ruleTitle: "规则",
    ruleGoal: "目标：把小方块带到终点门。门有时会跑，有时会是假的。",
    ruleControl: "操作：← → 移动，空格 / ↑ / W 跳跃。R 重玩本关。触屏用屏幕下方的方向键。",
    ruleFair: "公平性：所有陷阱的位置与时序都是固定的，绝不会同一步两次死法不同——记住它们就能过。",
    ruleTolerant: "宽容度：死亡不扣任何东西，0.4 秒内立刻在起点复活，印章永久保留。",
    ruleSeal: "印章：通关点亮通关印；拿到蜡烛通关点亮蜡烛印；零死亡通关点亮无伤印。",
    ruleCandle: "蜡烛：每关藏着一根蜡烛，通常在最危险的地方。",
    ruleClose: "知道了",

    // 提示
    tipStart: "第一步：先试着走过去。",
    tipNearGoal: "门就在前面了。",
    tipDeath: "再来一次，这次记住它。",
    tipManyDeaths: "它好像在笑你。",
    tipCandleNear: "蜡烛就在附近。",
    tipWon: "好，下一课。",

    fps: "帧率",

    noscript: "需要开启 JavaScript 才能游玩《恶魔迷途》。",
    canvasAria: "恶魔迷途平台跳跃舞台"
  },
  en: {
    docTitle: "Devil Run · DOIN Play Free Games",
    metaDesc:
      "Devil Run: dash and jump a little square toward the exit door — but the floor, the ceiling, even gravity will cheat on you. 50 micro levels, zero-penalty respawn, fully deterministic traps. Play instantly!",
    title: "Devil Run",
    tagline: "Every step might be a lie · 50 micro levels",
    backHome: "Home",
    rules: "How to Play",
    sound: "Sound",
    langShort: "中",
    ariaLang: "Switch language",

    // Arcade top bar
    nodeLabel: "Node",
    levelLabel: "Level",
    levelName: "{0}-{1}",
    timeLabel: "Time",
    bestLabel: "Best",
    deathLabel: "Deaths",
    candleLabel: "Candle",
    sealLabel: "Seals",

    // Left plaque
    sealsTitle: "Devil Seals",
    sealClear: "Cleared",
    sealCandle: "Candle",
    sealFlawless: "Flawless",
    sealLocked: "Not lit",
    sealLit: "Lit",
    nodeProgress: "{0} / {1}",

    // Control deck
    retry: "Retry",
    nextLevel: "Next",
    selectLevel: "Levels",
    close: "Close",
    restartHint: "R to retry",

    // Level select
    levelsTitle: "Fifty Lessons of the Devil",
    nodeTitle: "Node {0} · {1}",
    locked: "Locked",
    cleared: "Cleared",

    // Result
    resultTitle: "You Escaped!",
    resultTitleFlawless: "Untouched!",
    resultTime: "Time",
    resultBest: "Best",
    resultDeaths: "Deaths",
    resultNewRecord: "New Record!",
    resultCandle: "Candle grabbed",
    resultNoCandle: "Candle missed",
    resultSeal: "Seals lit",
    resultNext: "Next",
    resultRetry: "Retry",
    resultMenu: "Levels",
    resultFinal: "All fifty lessons cleared!",

    // Rules
    ruleTitle: "How to Play",
    ruleGoal: "Goal: bring the little square to the exit door. Sometimes it runs. Sometimes it lies.",
    ruleControl: "Controls: ← → to move, Space / ↑ / W to jump. R restarts the level. On touch, use the pad below.",
    ruleFair: "Fairness: every trap sits at a fixed spot and fires on a fixed timing. The same move never kills you two different ways — memorize and beat it.",
    ruleTolerant: "Mercy: dying costs nothing. You respawn at the start within 0.4s and keep every seal you earned.",
    ruleSeal: "Seals: clear the level to light the Clear seal; clear it with the candle for the Candle seal; clear with zero deaths for the Flawless seal.",
    ruleCandle: "Candles: each level hides one candle, usually right where it hurts most.",
    ruleClose: "Got It",

    // Tips
    tipStart: "First step: just try walking across.",
    tipNearGoal: "The door is right there.",
    tipDeath: "Again — and remember it this time.",
    tipManyDeaths: "It's laughing at you, isn't it.",
    tipCandleNear: "The candle is close.",
    tipWon: "Good. Next lesson.",

    fps: "FPS",

    noscript: "JavaScript is required to play Devil Run.",
    canvasAria: "Devil Run platforming stage"
  }
};

export function isLocale(val) {
  return LOCALES.includes(val);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, idx) => {
    const v = args[Number(idx)];
    return v === undefined ? match : String(v);
  });
}

export function detectLocale() {
  const langs = globalThis.navigator?.languages ?? [];
  const single = globalThis.navigator?.language ?? "";
  for (const tag of [...langs, single]) {
    if (typeof tag === "string" && tag.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

export function loadLocale() {
  try {
    const saved = globalThis.localStorage?.getItem(LANG_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // ignore
  }
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return false;
  try {
    globalThis.localStorage?.setItem(LANG_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}
