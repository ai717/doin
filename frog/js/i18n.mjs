// i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "青蛙过河 · DOIN 在线小游戏",
    metaDesc: "操控小青蛙逐格蹦跳，穿越车流公路、踩着漂移的浮木渡河，把青蛙一只只安全送进对岸的家。5 章 40 关渐进闯关，吃飞虫续命、冲击每关最快用时。",
    stageTitle: "青蛙过河",
    backHome: "返回门户",
    soundLabel: "音效",
    mutedLabel: "已静音",
    helpLabel: "玩法",
    langSwitch: "EN",
    helpTitle: "玩法说明",
    helpBody: "控制小青蛙四向蹦跳，避开车辆、踩着浮木渡河，把 5 只青蛙送进对岸的家。\n\n· 方向键 / WASD / 滑动 / 点击方向键：四向跳跃。\n· 被车撞、落水、撞屏幕边缘、倒计时归零都会损失一条命。\n· 飞虫会落在某个空家槽：跳进那里可吃中飞虫，额外 +1 命并加分。\n· 填满 5 个家即过关；命用完则本关失败重开（已填的家保留）。",
    lives: "命",
    time: "用时",
    score: "分数",
    level: "关卡",
    chapter: "第 {0} 章",
    chapters: "章节",
    restart: "重开本关",
    next: "下一关",
    prev: "上一关",
    chapter1: "湿地清晨",
    chapter2: "都市环路",
    chapter3: "湍流河谷",
    chapter4: "夜行高速",
    chapter5: "传奇桥梁",
    wonTitle: "过关！",
    lostTitle: "本关失败",
    wonBody: "5 只青蛙安全到家。",
    lostBody: "命用完了，重开本关再试一次吧。",
    newRecord: "新纪录！",
    best: "最快",
    stars: "星级",
    flyHint: "飞虫出现！",
    tapStart: "点击任意方向开始",
    noscript: "需要启用 JavaScript 才能游玩青蛙过河。",
    dirUp: "上",
    dirDown: "下",
    dirLeft: "左",
    dirRight: "右",
    fmtTime: "{0} 秒",
  },
  en: {
    docTitle: "Frogger · DOIN games",
    metaDesc: "Hop a little frog across busy roads and drifting logs. Dodge traffic, ride the river and send five frogs safely home. 5 chapters, 40 levels, fly bonuses and level best times.",
    stageTitle: "Frog Crossing",
    backHome: "Portal",
    soundLabel: "Sound",
    mutedLabel: "Muted",
    helpLabel: "Help",
    langSwitch: "中文",
    helpTitle: "How to Play",
    helpBody: "Hop the frog in four directions: dodge cars, ride logs across the river and send all five frogs home.\n\n· Arrows / WASD / swipe / on-screen pad: hop one tile.\n· Getting hit, falling in water, hitting the edge or running out of time costs a life.\n· A fly lands on an empty home: hop there to grab it for +1 life and bonus points.\n· Fill all 5 homes to clear the level; run out of lives and you restart (filled homes stay).",
    lives: "Lives",
    time: "Time",
    score: "Score",
    level: "Level",
    chapter: "Chapter {0}",
    chapters: "Chapters",
    restart: "Restart",
    next: "Next",
    prev: "Prev",
    chapter1: "Dawn Marsh",
    chapter2: "City Loop",
    chapter3: "Rapid Valley",
    chapter4: "Night Highway",
    chapter5: "Legend Bridge",
    wonTitle: "Cleared!",
    lostTitle: "Level Failed",
    wonBody: "All five frogs are safely home.",
    lostBody: "Out of lives — restart and try again.",
    newRecord: "New Record!",
    best: "Best",
    stars: "Stars",
    flyHint: "A fly appears!",
    tapStart: "Tap a direction to start",
    noscript: "JavaScript is required to play Frog Crossing.",
    dirUp: "Up",
    dirDown: "Down",
    dirLeft: "Left",
    dirRight: "Right",
    fmtTime: "{0} sec",
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