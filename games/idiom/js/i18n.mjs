// 双语中心：界面文案集中于此，语言偏好读写全站共享 doin.lang。
export const LANG_KEY = "doin.lang";

export const strings = {
  zh: {
    docTitle: "成语纵横榜 · 典故图鉴 | DOIN",
    appTitle: "成语纵横榜",
    appSub: "典故图鉴",
    backHome: "门户",
    backHomeAria: "返回 DOIN 门户",
    boards: "榜单",
    atlas: "图鉴",
    sound: "音效",
    soundOn: "关闭音效",
    soundOff: "开启音效",
    help: "玩法",
    helpAria: "玩法说明",
    langToggle: "切换语言",
    langShort: "EN",
    langSwitchHint: "切换语言会切换到对应语言的整套题库，各语言进度分别保留。",
    switchedLang: "已切换到英文题库",
    switchedLangBack: "已切换到中文题库",

    boardSelectTitle: "八榜主题",
    boardSelectDesc: "每榜十关，随点随进；集齐典故可翻成册。",
    boardSelectAria: "主题榜单",
    levelLabel: "第 {n} 关",
    levelShort: "第 {n} 关",
    levelsDone: "{done}/10",
    levelGridAria: "{board} 的十关",
    close: "关闭",
    closeAria: "关闭面板",

    atlasTitle: "典故图鉴",
    atlasDesc: "填对一条成语就收进一张典故卡，按榜归档。",
    atlasAria: "典故图鉴",
    atlasProgress: "已集 {done} / {total}",
    atlasEmpty: "这一榜还没有解锁的典故。",
    cardSource: "出处",
    cardStory: "典故",
    cardExample: "例句",
    cardOrigin: "词源",
    cardLocked: "尚未解锁",
    cardClose: "收起",
    cardAria: "典故卡",
    copyCard: "复制此卡",
    copied: "已复制到剪贴板",
    copyFailed: "复制失败，可长按选中文字",

    helpTitle: "怎么玩",
    helpAria: "玩法说明",
    help1: "点格子选中一条成语，再点一次可在横竖之间切换。",
    help2: "点下方字库把字填进空格；桌面端也可直接用键盘输入。",
    help3: "填错的字会轻晃，用 Backspace 或擦除随时改掉。",
    help4: "整条成语填对会泛出金光，全部填对即过关。",
    help5: "每关 3 次提示，用一次提示会少一颗星。",
    help6: "填对的成语会收进「图鉴」，随时可以翻看典故。",

    across: "横",
    down: "竖",
    gridTitle: "纵横格",
    clueEmpty: "点一个字格，从字库里挑字填入。",
    clueTitle: "释义小注",
    clueAria: "成语释义",
    gridAria: "纵横填字网格",
    rackAria: "字库",
    rackHint: "字库",
    hint: "提示",
    hintAria: "揭示一个字",
    hintLeft: "提示 {n}",
    hintsUsed: "已用提示 {n} 次",
    erase: "擦除",
    eraseAria: "擦除当前字",
    timeLabel: "用时",
    starsLabel: "星",
    progressLabel: "已填 {done}/{total}",
    boardStars: "本榜 {n} 星",
    bestTime: "最佳 {time}",

    solvedBanner: "「{word}」归位",
    wrongBanner: "这个字不对，再想想",
    hintBanner: "提示：已揭开一字",
    clearedBanner: "本关集齐，典故入册",
    noHintsLeft: "本关提示已用完",

    resultTitle: "一关又添新典故",
    resultStars: "获得星数",
    resultHints: "使用提示",
    resultTime: "本关用时",
    resultCards: "本次收录",
    resultNext: "下一关",
    resultNextBoard: "下一榜",
    resultReplay: "重玩本关",
    resultBoards: "返回榜单",
    resultAria: "本关结算",
    starUnit: "{n} / 3",

    keyHint: "点格选词 · 点字库填字 · Backspace 擦除",
    keyHintTyping: "可直接用键盘输入 · Backspace 擦除",

    boardHistory: "历史典故",
    boardHistoryDesc: "兴亡智谋，尽在旧事",
    boardNature: "山水田园",
    boardNatureDesc: "一溪云影，半卷青山",
    boardAnimals: "动物成趣",
    boardAnimalsDesc: "狐虎鸡犬，各有脾性",
    boardPeople: "人物风骨",
    boardPeopleDesc: "清节高风，照见人品",
    boardNumbers: "数字成趣",
    boardNumbersDesc: "一二三四，皆成文章",
    boardBody: "身体部位",
    boardBodyDesc: "眉眼手足，都在词里",
    boardColors: "颜色成趣",
    boardColorsDesc: "青红皂白，自有分寸",
    boardObjects: "器物雅玩",
    boardObjectsDesc: "笔墨杯盏，件件有典",

    htmlLang: "zh-CN",
  },
  en: {
    docTitle: "Idiom Cross · Allusion Atlas | DOIN",
    appTitle: "Idiom Cross",
    appSub: "Allusion Atlas",
    backHome: "Portal",
    backHomeAria: "Back to the DOIN portal",
    boards: "Boards",
    atlas: "Atlas",
    sound: "Sound",
    soundOn: "Mute sound",
    soundOff: "Enable sound",
    help: "How to play",
    helpAria: "How to play",
    langToggle: "Switch language",
    langShort: "中文",
    langSwitchHint: "Switching language loads the other word bank. Progress is kept for each language.",
    switchedLang: "Switched to the English word bank",
    switchedLangBack: "Switched to the Chinese idiom bank",

    boardSelectTitle: "Eight Themed Boards",
    boardSelectDesc: "Ten levels each. Tap any level to begin; collect every card to fill the atlas.",
    boardSelectAria: "Themed boards",
    levelLabel: "Level {n}",
    levelShort: "L{n}",
    levelsDone: "{done}/10",
    levelGridAria: "Ten levels of {board}",
    close: "Close",
    closeAria: "Close panel",

    atlasTitle: "Allusion Atlas",
    atlasDesc: "Every solved entry unlocks a card, filed by board.",
    atlasAria: "Allusion atlas",
    atlasProgress: "Collected {done} / {total}",
    atlasEmpty: "No cards unlocked on this board yet.",
    cardSource: "Source",
    cardStory: "Allusion",
    cardExample: "Example",
    cardOrigin: "Origin",
    cardLocked: "Locked",
    cardClose: "Fold away",
    cardAria: "Allusion card",
    copyCard: "Copy this card",
    copied: "Copied to clipboard",
    copyFailed: "Copy failed; select the text manually",

    helpTitle: "How to Play",
    helpAria: "How to play",
    help1: "Tap a square to pick an entry; tap it again to switch between across and down.",
    help2: "Tap a tile in the rack to fill the square. On desktop you can also type directly.",
    help3: "A wrong letter shakes the square; fix it with Backspace or the erase key.",
    help4: "A finished entry glows gold. Fill every entry to clear the level.",
    help5: "Each level allows three hints; every hint costs one star.",
    help6: "Solved entries join the Atlas, where you can reread every story.",

    across: "Across",
    down: "Down",
    gridTitle: "Grid",
    clueEmpty: "Tap a square, then pick a tile from the rack.",
    clueTitle: "Margin Notes",
    clueAria: "Clues",
    gridAria: "Crossword grid",
    rackAria: "Tile rack",
    rackHint: "Tiles",
    hint: "Hint",
    hintAria: "Reveal one letter",
    hintLeft: "Hint {n}",
    hintsUsed: "Hints used: {n}",
    erase: "Erase",
    eraseAria: "Erase the current letter",
    timeLabel: "Time",
    starsLabel: "Stars",
    progressLabel: "Filled {done}/{total}",
    boardStars: "Board stars {n}",
    bestTime: "Best {time}",

    solvedBanner: "\"{word}\" placed",
    wrongBanner: "Not this one; think again",
    hintBanner: "Hint: one letter revealed",
    clearedBanner: "Level complete; the tale is filed",
    noHintsLeft: "No hints left in this level",

    resultTitle: "Another Tale Filed",
    resultStars: "Stars earned",
    resultHints: "Hints used",
    resultTime: "Level time",
    resultCards: "Collected now",
    resultNext: "Next level",
    resultNextBoard: "Next board",
    resultReplay: "Replay level",
    resultBoards: "Back to boards",
    resultAria: "Level summary",
    starUnit: "{n} / 3",

    keyHint: "Tap to select · Tap tiles to fill · Backspace erase",
    keyHintTyping: "Type directly · Backspace erase",

    boardHistory: "Historical Tales",
    boardHistoryDesc: "Rise and fall, cunning and resolve",
    boardNature: "Rivers & Fields",
    boardNatureDesc: "Creeks, clouds and green hills",
    boardAnimals: "Creature Wit",
    boardAnimalsDesc: "Foxes, tigers and opinionated hens",
    boardPeople: "Spirit of Figures",
    boardPeopleDesc: "Character written in clear lines",
    boardNumbers: "Numbers at Play",
    boardNumbersDesc: "One, two, three, all in idiom",
    boardBody: "Body & Self",
    boardBodyDesc: "Hands, eyes and feet in words",
    boardColors: "Colours of Old",
    boardColorsDesc: "Black, white and every shade between",
    boardObjects: "Objects & Craft",
    boardObjectsDesc: "Brushes, cups and heirlooms",

    htmlLang: "en",
  },
};

export function t(locale, key, vars = {}) {
  const table = strings[locale] ?? strings.zh;
  const raw = table[key] ?? strings.zh[key] ?? key;
  return String(raw).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function hasKey(locale, key) {
  return Boolean(strings[locale] && key in strings[locale]);
}

export function detectLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "zh" || saved === "en") return saved;
    }
  } catch {
    // 忽略受限环境。
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "zh";
  return String(nav || "").toLowerCase().startsWith("en") ? "en" : "zh";
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, locale === "en" ? "en" : "zh");
  } catch {
    // 静默降级。
  }
}

export function otherLocale(locale) {
  return locale === "en" ? "zh" : "en";
}

export function htmlLang(locale) {
  return locale === "en" ? "en" : "zh-CN";
}
