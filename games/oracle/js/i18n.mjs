// Shared language preference and all interface copy for Oracle Glyph Match.

export const LANG_KEY = "doin.lang";

export const strings = {
  zh: {
    docTitle: "甲骨文溯源连线 · DOIN 在线小游戏",
    appTitle: "甲骨文溯源连线",
    appSub: "认甲骨 · 猜本字",
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
    levelsAria: "打开字族章节选择",

    chapterNature: "山川日月",
    chapterBeasts: "鸟兽虫鱼",
    chapterHuman: "人身百态",
    chapterTools: "器物农耕",
    chapterLabel: "第 {n} 章",
    chapterHeading: "第 {n} 章 · {name}",
    chapterProgress: "{n} / {total} 星",
    chapterDone: "字族已攒齐",

    selectTitle: "字族章节",
    selectDesc: "四章二十四关，每关一组甲骨与本字。点任意一关即刻开始。",
    selectHint: "进度、星级与最佳用时都会自动保存。",
    selectTotal: "已集 {n} / {total} 星",
    levelLabel: "第 {n} 关",
    levelChipAria: "第 {n} 关，{stars} 星",

    hudChapter: "章节",
    hudLevel: "关卡",
    hudPairs: "配对",
    hudErrors: "误配",
    hudTime: "用时",
    hudStars: "总星",
    pairsRatio: "{n} / {total}",
    starsRatio: "{n} / {total}",

    oracleSide: "甲骨字形",
    charSide: "本字与释义",
    tracingMark: "溯源",
    boardAria: "甲骨拓片配对盘面",
    oracleCardAria: "甲骨字形卡 {n}",
    charCardAria: "本字 {char}，释义 {meaning}",

    keyHint: "点甲骨卡再点本字卡 · 方向键移动 · Enter 选择 · Esc 取消 · R 重开",
    keyHintTouch: "先点甲骨卡，再点本字卡完成溯源",

    helpTitle: "怎么玩",
    help1: "看甲骨字形像什么，猜出它对应的今天汉字。",
    help2: "先点一张甲骨卡，再点一张本字卡；顺序反过来也可以。",
    help3: "配对正确会拉出朱砂溯源线，并播放这个字三千年的字形演变。",
    help4: "配错只会轻轻抖一下，不扣分、不重来，可以继续尝试。",
    help5: "整关全部配对即通关；误配 0 次三星，1 至 2 次二星，其余一星。",
    help6: "用时只作记录，没有倒计时；呼出选关或切到后台时会自动冻结计时。",
    help7: "方向键在卡片间移动焦点，Enter 选择，Esc 取消，R 重开本关。",
    controlsTitle: "操作",
    controlsKeyboard: "点选两张卡片连线 · 方向键移动 · Enter 选择 · Esc 取消 · R 重开",
    controlsTouch: "点甲骨卡，再点本字卡；再点同一张可取消",

    resultTitle: "本关溯源完成",
    resultChapter: "字族已攒齐",
    resultAll: "二十四关全通，甲骨卷轴已合。",
    resultStars: "获得星数",
    resultTime: "本关用时",
    resultErrors: "误配次数",
    resultPairs: "配对字数",
    resultNext: "下一关",
    resultReplay: "重玩本关",
    resultSelect: "返回字族章节",
    resultBest: "最佳用时 {time}",
    newRecord: "刷新纪录",
    nextUp: "接下来玩",
    nextUpDesc: "同为汉字文化线，换一种玩法继续认字。",
    gameHanzi: "字灵拆拆乐",
    gameIdiom: "成语纵横榜",
    gameWordle: "每日猜词",

    toastWrong: "不对，再看看字形",
    toastMatched: "溯源成功",
    toastChapter: "字族已攒齐",
    toastAll: "二十四关全通",

    evolutionTitle: "字形演变",
    evoOracle: "甲骨",
    evoBronze: "金文",
    evoSeal: "小篆",
    evoRegular: "楷书",
    htmlLang: "zh-CN",
  },
  en: {
    docTitle: "Oracle Glyph Match · DOIN Arcade",
    appTitle: "Oracle Glyph Match",
    appSub: "Read the bone, name the character",
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
    levelsAria: "Open character family select",

    chapterNature: "Sun & Moon",
    chapterBeasts: "Birds & Beasts",
    chapterHuman: "The Human Form",
    chapterTools: "Tools & Fields",
    chapterLabel: "Chapter {n}",
    chapterHeading: "Chapter {n} · {name}",
    chapterProgress: "{n} / {total} stars",
    chapterDone: "Family complete",

    selectTitle: "Character Families",
    selectDesc: "Four chapters and twenty-four levels, each pairing a set of oracle glyphs with modern characters. Tap any level to begin.",
    selectHint: "Progress, stars and best times save automatically.",
    selectTotal: "{n} / {total} stars",
    levelLabel: "Level {n}",
    levelChipAria: "Level {n}, {stars} stars",

    hudChapter: "Chapter",
    hudLevel: "Level",
    hudPairs: "Pairs",
    hudErrors: "Misses",
    hudTime: "Time",
    hudStars: "Stars",
    pairsRatio: "{n} / {total}",
    starsRatio: "{n} / {total}",

    oracleSide: "Oracle Glyphs",
    charSide: "Modern Characters",
    tracingMark: "Trace",
    boardAria: "Oracle rubbing matching board",
    oracleCardAria: "Oracle glyph card {n}",
    charCardAria: "Character {char}, meaning {meaning}",

    keyHint: "Pick a glyph then a character · arrows move · Enter selects · Esc cancels · R restarts",
    keyHintTouch: "Tap an oracle glyph, then a modern character",

    helpTitle: "How to Play",
    help1: "Look at the oracle glyph and guess which modern character it became.",
    help2: "Pick an oracle card first, then a character card. The reverse order also works.",
    help3: "A correct pair draws a vermilion tracing line and replays the glyph's three-thousand-year evolution.",
    help4: "A wrong pair only gives a gentle shake. No penalty, no restart, keep trying.",
    help5: "Match every pair to clear the level. Zero misses earns three stars, one or two misses earn two, anything else earns one.",
    help6: "Time is recorded, never counted down. Opening the level select or leaving the tab freezes the clock.",
    help7: "Arrow keys move focus, Enter selects, Esc cancels and R restarts the level.",
    controlsTitle: "Controls",
    controlsKeyboard: "Pick two cards to link · arrows move · Enter selects · Esc cancels · R restarts",
    controlsTouch: "Tap an oracle card, then a character card; tap the same card again to cancel",

    resultTitle: "Level Traced",
    resultChapter: "Family Complete",
    resultAll: "All twenty-four levels traced. The oracle scroll is complete.",
    resultStars: "Stars earned",
    resultTime: "Level time",
    resultErrors: "Misses",
    resultPairs: "Pairs matched",
    resultNext: "Next level",
    resultReplay: "Replay level",
    resultSelect: "Back to families",
    resultBest: "Best time {time}",
    newRecord: "New record",
    nextUp: "Play next",
    nextUpDesc: "Stay on the character-culture line with a different puzzle.",
    gameHanzi: "Hanzi Split",
    gameIdiom: "Idiom Grid",
    gameWordle: "Daily Wordle",

    toastWrong: "Not quite. Look at the shape again.",
    toastMatched: "Tracing complete",
    toastChapter: "Character family complete",
    toastAll: "All twenty-four levels cleared",

    evolutionTitle: "Glyph Evolution",
    evoOracle: "Oracle",
    evoBronze: "Bronze",
    evoSeal: "Seal",
    evoRegular: "Regular",
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
