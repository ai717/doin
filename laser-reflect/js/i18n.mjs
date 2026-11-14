// i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "光束折射镜 · DOIN 在线小游戏",
    metaDesc: "光学折射解谜：在实验台上转动平面镜与分光棱镜，把一束白光折射、分光成多路彩色光，点亮所有感光核。40 关纯确定性关卡，零手速纯脑力。",
    appTitle: "光束折射镜",
    lede: "转动镜面，让光找到它该去的地方。",
    backHome: "返回首页",
    chapter: "章节",
    level: "第 {0} 关",
    moves: "步数",
    par: "目标",
    stars: "星级",
    chapter1: "单束之光",
    chapter2: "一分为二",
    chapter3: "滤色甄别",
    chapter4: "彩虹矩阵",
    undo: "撤销",
    reset: "重置",
    sound: "音效",
    soundOn: "关闭音效",
    soundOff: "开启音效",
    help: "玩法说明",
    helpTitle: "怎么玩",
    helpBody:
      "转动盘面上的平面镜与分光棱镜（点击即可 90° 旋转），让白光折射、分光，点亮所有感光核。感光核只被与自己颜色相同的光点亮。",
    helpClose: "开始",
    winTitle: "全部点亮！",
    winSub: "步数 {0} · 目标 {1}",
    star1: "三星",
    star2: "二星",
    star3: "一星",
    nextLevel: "下一关",
    replay: "再来一次",
    levelSelect: "选关",
    chapterComplete: "章节完成！",
    completed: "已完成",
    locked: "未解锁",
    solved: "已通关",
    noscript: "需要启用 JavaScript 才能游玩光束折射镜。",
    boardAria: "光学实验台",
    emitter: "激光发射器",
    mirror: "平面镜",
    splitter: "分光棱镜",
    filter: "滤色片",
    spectro: "分色棱镜",
    target: "感光核",
    wall: "遮光墙",
    red: "红光",
    green: "绿光",
    blue: "蓝光",
    white: "白光",
    langLabel: "Switch to English",
    langShort: "EN",
    ariaLang: "切换语言",
    ariaMoves: "当前步数",
    ariaPar: "目标步数",
    progress: "进度",
  },
  en: {
    docTitle: "Laser Reflect · DOIN games",
    metaDesc: "Optical reflection puzzle: rotate mirrors and beam splitters to bend a white beam into colored light and light every sensor core. 40 deterministic levels, pure logic, no time pressure.",
    appTitle: "Laser Reflect",
    lede: "Turn the mirrors. Guide the light where it belongs.",
    backHome: "Home",
    chapter: "Chapter",
    level: "Level {0}",
    moves: "Moves",
    par: "Par",
    stars: "Stars",
    chapter1: "Single Beam",
    chapter2: "Split Light",
    chapter3: "Filter & Color",
    chapter4: "Rainbow Matrix",
    undo: "Undo",
    reset: "Reset",
    sound: "Sound",
    soundOn: "Mute",
    soundOff: "Unmute",
    help: "How to play",
    helpTitle: "How to play",
    helpBody:
      "Rotate mirrors and beam splitters (click to turn 90°) to bend and split the white beam, lighting every sensor core. Each core only lights when hit by its matching color.",
    helpClose: "Start",
    winTitle: "All lit!",
    winSub: "Moves {0} · Par {1}",
    star1: "3 stars",
    star2: "2 stars",
    star3: "1 star",
    nextLevel: "Next level",
    replay: "Replay",
    levelSelect: "Levels",
    chapterComplete: "Chapter complete!",
    completed: "Done",
    locked: "Locked",
    solved: "Solved",
    noscript: "JavaScript is required to play Laser Reflect.",
    boardAria: "Optical bench",
    emitter: "Laser emitter",
    mirror: "Mirror",
    splitter: "Beam splitter",
    filter: "Color filter",
    spectro: "Prism",
    target: "Sensor core",
    wall: "Wall",
    red: "Red light",
    green: "Green light",
    blue: "Blue light",
    white: "White light",
    langLabel: "切换到中文",
    langShort: "中文",
    ariaLang: "Switch language",
    ariaMoves: "Current moves",
    ariaPar: "Par moves",
    progress: "Progress",
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
