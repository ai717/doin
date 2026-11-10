// 中英双语表 + 全站共享语言偏好 doin.lang。切换只做原地热更新。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "弹珠落钉 · DOIN 在线小游戏",
    metaDesc: "旋转黄铜加农炮，一发弹珠在发光钉阵间长链反弹，点亮全部橙色目标钉触发极限狂喜时刻。21 关维多利亚铜管弹珠工坊，四色钉、移动接球斗与免费弹珠，固定步长物理即点即玩。",
    title: "弹珠落钉",
    subtitle: "维多利亚铜管弹珠工坊",
    backHome: "返回门户",
    soundOn: "音效开",
    soundOff: "音效关",
    ariaSound: "音效开关",
    ariaLang: "切换语言",
    ariaHelp: "玩法说明",
    langLabel: "切换到英文",
    langShort: "EN",
    ballsLabel: "弹珠",
    orangeLabel: "橙钉",
    comboLabel: "连击",
    powerLabel: "异能",
    powerNone: "待激活",
    powerSplit: "双球分裂已就绪",
    powerGuide: "超级导轨已就绪",
    powerSpent: "异能已耗尽",
    scoreLabel: "得分",
    bestLabel: "最高",
    fireButton: "发射",
    fastForward: "快进",
    pause: "暂停",
    resume: "继续",
    restart: "重开",
    levels: "选关",
    close: "关闭",
    next: "下一关",
    again: "再来一次",
    aimHint: "拖动瞄准 · 松手发射",
    fireReady: "按空格或点击发射",
    flightHint: "按住屏幕 / 空格 2 倍速快进",
    keyboardHint: "方向键 / A D 微调 0.5° · 空格发射 · P 暂停",
    levelsTitle: "钉板工坊",
    levelsTotal: "已得 {0} / {1} 星",
    chapter_ch1: "第一卷 · 青铜学徒靶场",
    chapter_ch2: "第二卷 · 彩虹几何回廊",
    chapter_ch3: "第三卷 · 旋转风车工坊",
    chapter_ch4: "第四卷 · 星云引力深渊",
    chapter_ch5: "第五卷 · 万神殿终极狂欢",
    levelName: "第 {0} 关",
    levelStars: "{0} 星",
    resultClear: "钉阵清空",
    resultFail: "弹珠耗尽",
    resultScore: "本关得分",
    resultStars: "星评",
    resultBalls: "剩余弹珠",
    resultBest: "历史最高",
    resultNewBest: "新纪录",
    resultNext: "下一关",
    resultAgain: "再挑战一次",
    resultClose: "查看钉板",
    pauseTitle: "已暂停",
    pausedHint: "弹珠与接球斗已冻结，随时回来继续。",
    continueLabel: "继续游戏",
    pauseRestart: "重新开始",
    pauseLevels: "返回选关",
    helpTitle: "玩法说明",
    helpBody:
      "1. 拖动鼠标或手指旋转顶部黄铜加农炮，松手发射弹珠。\n2. 弹珠会在钉阵间反弹，设定的角度决定它穿过哪片钉群。\n3. 点亮全部橙色目标钉即可清空钉板，触发极限狂喜时刻。\n4. 蓝钉给基础分，绿钉激活异能（第一颗双球分裂，第二颗超级导轨），紫钉给 10 倍分。\n5. 底部铜斗会左右律动，接住弹珠返还 1 颗免费弹珠。\n6. 弹珠耗尽且橙钉未清空即告失败；随时可重开或选关。",
    helpKeys: "快捷键：← / → 或 A / D 微调 0.5° · 空格发射 / 长按快进 · P / Esc 暂停",
    helpPegs: "四色钉：蓝 100 分 · 橙 500 分（目标）· 绿 800 分（异能）· 紫 1000 分（10 倍）",
    helpFever: "极限狂喜：最后一颗橙钉被点亮时进入 5 倍慢动作，全场礼花与十万分终局奖赏。",
    helpBucket: "接球斗：精准落入移动铜斗可立即返还 1 颗免费弹珠。",
    freeBall: "免费弹珠 +1",
    feverToast: "极限狂喜！",
    powerSplitToast: "双球分裂！",
    powerGuideToast: "超级导轨已就绪",
    lostToast: "弹珠耗尽，橙钉未清空",
    clearToast: "钉板清空！",
    feverText: "极限狂喜",
    freeBallText: "免费弹珠 +1",
    saved: "进度与最高分保存在本机浏览器，可离线游玩。",
    noscript: "需要启用 JavaScript 才能游玩弹珠落钉。",
    boardAria: "弹珠落钉钉板",
    ariaHud: "对局仪表",
    ariaCanvas: "弹珠落钉游戏画面，拖动瞄准，松手发射",
    ariaLevels: "钉板选关",
    ariaPause: "暂停菜单",
    ariaResult: "结算",
    clearRecords: "清空进度",
    confirmClear: "确定清空全部关卡星评与最高分？",
    confirm: "确定",
    cancel: "取消",
  },
  en: {
    docTitle: "Peg Fall · DOIN games",
    metaDesc: "Swing the brass cannon, fire a silver ball into a long chain of glowing pegs, and light every orange target to trigger Extreme Fever. 21 Victorian brass-arcade stages, four peg colours, a moving free-ball bucket and fixed-step physics.",
    title: "Peg Fall",
    subtitle: "Victorian brass pegboard",
    backHome: "Home",
    soundOn: "Sound on",
    soundOff: "Sound off",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaHelp: "How to play",
    langLabel: "切换到中文",
    langShort: "中文",
    ballsLabel: "Balls",
    orangeLabel: "Orange",
    comboLabel: "Combo",
    powerLabel: "Power",
    powerNone: "Idle",
    powerSplit: "Split ball ready",
    powerGuide: "Super guide ready",
    powerSpent: "Power spent",
    scoreLabel: "Score",
    bestLabel: "Best",
    fireButton: "Fire",
    fastForward: "Fast",
    pause: "Pause",
    resume: "Resume",
    restart: "Restart",
    levels: "Levels",
    close: "Close",
    next: "Next stage",
    again: "Try again",
    aimHint: "Drag to aim · release to fire",
    fireReady: "Press Space or click to fire",
    flightHint: "Hold screen / Space for 2× speed",
    keyboardHint: "Arrows / A D fine-tune 0.5° · Space fires · P pauses",
    levelsTitle: "Pegboard workshop",
    levelsTotal: "{0} / {1} stars earned",
    chapter_ch1: "Volume 1 · Apprentice Range",
    chapter_ch2: "Volume 2 · Prism Gallery",
    chapter_ch3: "Volume 3 · Windmill Works",
    chapter_ch4: "Volume 4 · Nebula Well",
    chapter_ch5: "Volume 5 · Final Pantheon",
    levelName: "Stage {0}",
    levelStars: "{0} stars",
    resultClear: "Board cleared",
    resultFail: "Out of balls",
    resultScore: "Stage score",
    resultStars: "Stars",
    resultBalls: "Balls left",
    resultBest: "Personal best",
    resultNewBest: "New record",
    resultNext: "Next stage",
    resultAgain: "Retry stage",
    resultClose: "View board",
    pauseTitle: "Paused",
    pausedHint: "The ball and bucket are frozen. Come back whenever you like.",
    continueLabel: "Resume",
    pauseRestart: "Restart",
    pauseLevels: "Back to levels",
    helpTitle: "How to play",
    helpBody:
      "1. Drag the brass cannon at the top, then release to fire.\n2. The ball ricochets through the pegs; your angle decides which cluster it crosses.\n3. Light every orange target peg to clear the board and trigger Extreme Fever.\n4. Blue pegs score, green pegs grant powers (first splits the ball, second arms a super guide), purple pegs pay 10×.\n5. The brass bucket slides along the bottom; catch the ball for a free ball.\n6. Run out of balls with orange pegs left and the stage fails. Retry or pick another stage anytime.",
    helpKeys: "Keys: ← / → or A / D fine-tune 0.5° · Space fires or holds for speed · P / Esc pauses",
    helpPegs: "Peg values: blue 100 · orange 500 (target) · green 800 (power) · purple 1000 (10×)",
    helpFever: "Extreme Fever: light the last orange peg for 5× slow motion, rainbow fireworks and a 100,000-point finale.",
    helpBucket: "Bucket: land in the moving brass cup to get one free ball instantly.",
    freeBall: "Free ball +1",
    feverToast: "Extreme Fever!",
    powerSplitToast: "Split ball!",
    powerGuideToast: "Super guide armed",
    lostToast: "Out of balls with orange pegs left",
    clearToast: "Board cleared!",
    feverText: "EXTREME FEVER",
    freeBallText: "FREE BALL +1",
    saved: "Progress and best scores are saved in your browser. Works offline.",
    noscript: "JavaScript is required to play Peg Fall.",
    boardAria: "Peg Fall board",
    ariaHud: "Match dashboard",
    ariaCanvas: "Peg Fall game view: drag to aim, release to fire",
    ariaLevels: "Stage selection",
    ariaPause: "Pause menu",
    ariaResult: "Result",
    clearRecords: "Clear progress",
    confirmClear: "Clear all stage stars and best scores?",
    confirm: "Confirm",
    cancel: "Cancel",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

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

export function loadLocale() {
  const store = readStore();
  const saved = store?.getItem(LANG_KEY);
  if (isLocale(saved)) return saved;
  return detectLocale();
}

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
