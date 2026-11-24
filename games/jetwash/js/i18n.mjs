// Bilingual strings and in-place locale switching. Shared key: doin.lang.
// The English table has no Han characters except the language-switch marker.

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "高压洗车屋·解压清洁 · DOIN 在线小游戏",
    metaDesc: "高压水枪冲掉污渍，把脏车脏家具洗回全新。三层污渍分层剥落，水枪泡沫刷子刮水器分工协作，无失败无压力，即开即玩的解压清洁小游戏。",
    title: "高压洗车屋",
    lede: "冲掉污垢 · 洗回亮色",
    backHome: "返回门户",
    controls: "工位控制",
    levels: "选关",
    pause: "暂停",
    resume: "继续",
    restart: "重洗本关",
    sound: "音效",
    mute: "音效开",
    muted: "静音",
    langLabel: "Switch to English",
    langShort: "EN",
    nozzleWide: "宽扇面",
    nozzleNarrow: "细水柱",
    nozzle: "喷头",
    cleanLabel: "清洁度",
    levelLabel: "工位",
    timeLabel: "用时",
    toolLabel: "工具",
    stainLabel: "污渍",
    hintJet: "水枪冲浮灰最快",
    hintFoam: "泡沫软化油渍顽渍",
    hintBrush: "刷子刮顽渍最给力",
    hintSqueegee: "刮水器带走泡沫污水",
    stainDust: "浮灰",
    stainGrease: "油渍",
    stainStubborn: "顽渍",
    toolJet: "高压水枪",
    toolFoam: "泡沫喷壶",
    toolBrush: "刷子",
    toolSqueegee: "刮水器",
    chapterCar: "洗车屋",
    chapterHome: "家居翻新",
    levelSedan: "第1关 · 小轿车",
    levelSuv: "第2关 · 越野车",
    levelVan: "第3关 · 面包车",
    levelSports: "第4关 · 跑车",
    levelPickup: "第5关 · 皮卡",
    levelBus: "第6关 · 巴士",
    levelSofa: "第7关 · 布艺沙发",
    levelCarpet: "第8关 · 地毯",
    levelStove: "第9关 · 灶台",
    levelBathtub: "第10关 · 浴缸",
    levelTable: "第11关 · 木餐桌",
    levelWindow: "第12关 · 玻璃窗",
    paused: "已暂停",
    pausedHint: "水已停，歇口气",
    resultTitle: "焕然一新！",
    resultStars: "清洁星级",
    resultTime: "本次用时",
    resultBest: "最佳用时",
    nextLevel: "下一件",
    replay: "再洗一遍",
    locked: "未解锁",
    noNext: "全部洗净，辛苦了！",
    tipTitle: "怎么玩",
    tip1: "按住并拖动，对准脏面持续冲刷——停在哪就净在哪，挥得越快不会越快。",
    tip2: "三层污渍依次是浮灰、油渍、顽渍；用错工具只是慢，绝不扣分。",
    tip3: "先喷泡沫软化，再冲再刷，顽渍去得更快。数字键 1–4 换工具，N 切喷头，R 重洗。",
    gotIt: "开始清洗",
    close: "关闭",
  },
  en: {
    docTitle: "Jet Wash House · DOIN Online Games",
    metaDesc: "Blast grime away with a pressure washer and restore dirty cars and furniture. Peel three layers of stains with a jet, foam, brush and squeegee. No failure, no pressure, instant play.",
    title: "Jet Wash House",
    lede: "Blast the grime · Bring back the shine",
    backHome: "Back to Portal",
    controls: "Station Controls",
    levels: "Levels",
    pause: "Pause",
    resume: "Resume",
    restart: "Rewash",
    sound: "Sound",
    mute: "Sound On",
    muted: "Muted",
    langLabel: "Switch to English",
    langShort: "EN",
    nozzleWide: "Wide Fan",
    nozzleNarrow: "Fine Jet",
    nozzle: "Nozzle",
    cleanLabel: "Cleanliness",
    levelLabel: "Station",
    timeLabel: "Time",
    toolLabel: "Tools",
    stainLabel: "Stains",
    hintJet: "Jet clears dust fastest",
    hintFoam: "Foam softens grease and grime",
    hintBrush: "Brush scrubs stubborn grime",
    hintSqueegee: "Squeegee sweeps foam away",
    stainDust: "Dust",
    stainGrease: "Grease",
    stainStubborn: "Stubborn",
    toolJet: "Pressure Jet",
    toolFoam: "Foam Sprayer",
    toolBrush: "Brush",
    toolSqueegee: "Squeegee",
    chapterCar: "Car Bay",
    chapterHome: "Home Refresh",
    levelSedan: "Level 1 · Sedan",
    levelSuv: "Level 2 · SUV",
    levelVan: "Level 3 · Van",
    levelSports: "Level 4 · Sports Car",
    levelPickup: "Level 5 · Pickup",
    levelBus: "Level 6 · Bus",
    levelSofa: "Level 7 · Sofa",
    levelCarpet: "Level 8 · Carpet",
    levelStove: "Level 9 · Stove",
    levelBathtub: "Level 10 · Bathtub",
    levelTable: "Level 11 · Wood Table",
    levelWindow: "Level 12 · Window",
    paused: "Paused",
    pausedHint: "Water's off, take a breath",
    resultTitle: "Good as new!",
    resultStars: "Clean Stars",
    resultTime: "Your Time",
    resultBest: "Best Time",
    nextLevel: "Next Item",
    replay: "Wash Again",
    locked: "Locked",
    noNext: "All clean. Nice work!",
    tipTitle: "How to Play",
    tip1: "Hold and drag to keep washing a spot — staying put cleans faster than waving around.",
    tip2: "Three layers: dust, grease, stubborn. The wrong tool only slows you down, never penalizes.",
    tip3: "Spray foam first to soften, then wash and scrub. Keys 1-4 switch tools, N toggles nozzle, R rewash.",
    gotIt: "Start Washing",
    close: "Close",
  },
};

const LEVEL_KEYS = {
  level_sedan: "levelSedan", level_suv: "levelSuv", level_van: "levelVan",
  level_sports: "levelSports", level_pickup: "levelPickup", level_bus: "levelBus",
  level_sofa: "levelSofa", level_carpet: "levelCarpet", level_stove: "levelStove",
  level_bathtub: "levelBathtub", level_table: "levelTable", level_window: "levelWindow",
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function levelName(locale, levelId) {
  const t = strings(locale);
  const key = LEVEL_KEYS[levelId];
  return key && t[key] !== undefined ? t[key] : levelId;
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
  const saved = readStore()?.getItem(LANG_KEY);
  return isLocale(saved) ? saved : detectLocale();
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

// In-place DOM update: never reloads and never touches the game controller.
export function applyLocale(locale, renderCurrentFrame) {
  const chosen = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = strings(chosen);
  saveLocale(chosen);
  if (typeof document !== "undefined") {
    document.documentElement.lang = htmlLang(chosen);
    document.title = t.docTitle;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t[key] !== undefined) el.textContent = t[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (t[key] !== undefined) el.setAttribute("aria-label", t[key]);
    });
    const langBtn = document.getElementById("btn-lang");
    if (langBtn) langBtn.textContent = t.langShort;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", t.metaDesc);
  }
  if (typeof renderCurrentFrame === "function") renderCurrentFrame();
  return chosen;
}
