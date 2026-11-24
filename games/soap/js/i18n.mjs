// Bilingual strings. Shared site-wide preference key: doin.lang.
// Data files use keys only; display text lives here. English table has no Han characters.

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "切肥皂解压 · DOIN 在线小游戏",
    metaDesc: "拖动小刀切削粉彩肥皂，听清脆刮擦 ASMR。硬皂、软皂、果冻皂三套材质音色，造型皂内藏星星花朵，无失败无压力，即开即玩。",
    title: "切肥皂解压",
    lede: "一刀一片 · 听见舒服的声音",
    backHome: "返回门户",
    soapPicker: "选皂",
    tools: "工具",
    progress: "已切",
    coreProgress: "内芯",
    pause: "暂停",
    resume: "继续",
    mute: "音效开",
    muted: "静音",
    langLabel: "Switch to English",
    langShort: "EN",
    restart: "换一块",
    finish: "收尾刮净",
    next: "下一块",
    close: "继续切",
    resultTitle: "切好了",
    resultSub: "已切 {0} · 细腻度 {1}",
    resultStars: "手感评级",
    statusReady: "按住拖动小刀 · 切出薄片",
    statusCutting: "沙沙……",
    statusDone: "这块切完了 · 换一块继续",
    hintDrag: "按住拖动切削 · 1/2/3 换工具 · R 换皂 · P 暂停",
    pauseTitle: "已暂停",
    pauseHint: "碎屑与声音已冻结",
    ariaStage: "切皂台面",
    ariaTools: "切削工具",
    ariaSoapPicker: "肥皂图鉴",
    ariaBar: "游戏控制栏",
    ariaSoapCanvas: "肥皂切削区",
    ariaStatus: "游戏状态",
    familyClassic: "经典方皂",
    familyJelly: "果冻皂",
    familyShape: "造型皂",
    matHard: "硬皂 · 脆",
    matSoft: "软皂 · 绵",
    matJelly: "果冻 · 弹",
    "mat.hard": "硬皂",
    "mat.soft": "软皂",
    "mat.jelly": "果冻皂",
    toolKnife: "小刀",
    toolScraper: "刮刀",
    toolPeeler: "刨子",
    "soap.classic.white": "经典方皂 · 象牙白",
    "soap.classic.pink": "经典方皂 · 樱花粉",
    "soap.classic.blue": "经典方皂 · 晴空蓝",
    "soap.classic.mint": "经典方皂 · 薄荷绿",
    "soap.jelly.berry": "果冻皂 · 莓果紫",
    "soap.jelly.citrus": "果冻皂 · 柑橘黄",
    "soap.jelly.ocean": "果冻皂 · 海盐蓝",
    "soap.jelly.grape": "果冻皂 · 葡萄紫",
    "soap.shape.star": "造型皂 · 星星",
    "soap.shape.flower": "造型皂 · 花朵",
    "soap.shape.heart": "造型皂 · 爱心",
    "soap.shape.paw": "造型皂 · 爪印",
    coreFound: "内芯露出来了！",
    finishHint: "边角碎屑可按「收尾刮净」一次清掉",
    noscript: "需要启用 JavaScript 才能切肥皂。",
  },
  en: {
    docTitle: "Soap Cutting ASMR · DOIN Games",
    metaDesc: "Drag a blade through pastel soap and hear crisp ASMR scrapes. Three material voices - hard, soft and jelly - with hidden figures inside shape soaps. No fail, no pressure, instant play.",
    title: "Soap Cutting ASMR",
    lede: "One stroke, one curl · listen to the calm",
    backHome: "Portal",
    soapPicker: "Soaps",
    tools: "Tools",
    progress: "Cut",
    coreProgress: "Core",
    pause: "Pause",
    resume: "Resume",
    mute: "Sound on",
    muted: "Muted",
    langLabel: "\u5207\u6362\u5230\u4e2d\u6587",
    langShort: "\u4e2d\u6587",
    restart: "New bar",
    finish: "Sweep crumbs",
    next: "Next bar",
    close: "Keep cutting",
    resultTitle: "Nicely cut",
    resultSub: "{0} cut · finesse {1}",
    resultStars: "Feel rating",
    statusReady: "Hold and drag the blade · shave off curls",
    statusCutting: "shhh...",
    statusDone: "This bar is done · pick another",
    hintDrag: "Drag to cut · 1/2/3 tools · R new bar · P pause",
    pauseTitle: "Paused",
    pauseHint: "Crumbs and audio are frozen",
    ariaStage: "Soap cutting bench",
    ariaTools: "Cutting tools",
    ariaSoapPicker: "Soap catalogue",
    ariaBar: "Game controls",
    ariaSoapCanvas: "Soap cutting area",
    ariaStatus: "Game status",
    familyClassic: "Classic bars",
    familyJelly: "Jelly soaps",
    familyShape: "Shape soaps",
    matHard: "Hard · crisp",
    matSoft: "Soft · creamy",
    matJelly: "Jelly · bouncy",
    "mat.hard": "Hard soap",
    "mat.soft": "Soft soap",
    "mat.jelly": "Jelly soap",
    toolKnife: "Knife",
    toolScraper: "Scraper",
    toolPeeler: "Peeler",
    "soap.classic.white": "Classic Bar · Ivory",
    "soap.classic.pink": "Classic Bar · Blossom",
    "soap.classic.blue": "Classic Bar · Sky",
    "soap.classic.mint": "Classic Bar · Mint",
    "soap.jelly.berry": "Jelly Soap · Berry",
    "soap.jelly.citrus": "Jelly Soap · Citrus",
    "soap.jelly.ocean": "Jelly Soap · Ocean",
    "soap.jelly.grape": "Jelly Soap · Grape",
    "soap.shape.star": "Shape Soap · Star",
    "soap.shape.flower": "Shape Soap · Flower",
    "soap.shape.heart": "Shape Soap · Heart",
    "soap.shape.paw": "Shape Soap · Paw",
    coreFound: "The core is showing!",
    finishHint: "Sweep the last crumbs with one tap",
    noscript: "JavaScript is required to cut soap.",
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
  } catch (error) {
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
  } catch (error) {
    return false;
  }
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}
