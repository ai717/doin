// 首页 i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。
// 默认显示语言规则：doin.lang 有合法值 → 用它；否则浏览器语言 zh* → 中文，其余 → 英文。
// SEO 兜底：index.html 静态内容保留中文，JS 启动后按 locale 覆盖。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "DOIN · Free Mini Games",
    metaDesc: "DOIN 精选免费在线益智小游戏，无需下载，手机电脑即点即玩。",
    ogLocale: "zh_CN",
    chip: "打开即玩",
    gridAria: "游戏列表",
    coverAlt: "封面",
    comingSoon: "敬请期待",
    loadError: "无法加载游戏列表 · 请通过本地服务器访问",
    noscript: "需要启用 JavaScript 才能加载游戏列表。",
    structuredName: "DOIN 小游戏合集",
    langLabel: "Switch to English",
    langShort: "EN",
    langAria: "切换语言",
  },
  en: {
    docTitle: "DOIN · Free Mini Games",
    metaDesc: "Free online mini games by DOIN — no downloads, play instantly in your browser on mobile or desktop.",
    ogLocale: "en_US",
    chip: "Play instantly",
    gridAria: "Game list",
    coverAlt: "cover",
    comingSoon: "Coming soon",
    loadError: "Failed to load the game list · serve this site over HTTP",
    noscript: "JavaScript is required to load the game list.",
    structuredName: "DOIN mini games",
    langLabel: "切换到中文",
    langShort: "中文",
    langAria: "Switch language",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

// 浏览器语言 → locale：任何 zh 开头 → 中文，否则英文。
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

// 统一规则第一步：全站共享偏好优先。
export function loadLocale() {
  const store = readStore();
  const saved = store?.getItem(LANG_KEY);
  if (isLocale(saved)) return saved;
  return detectLocale();
}

// 统一规则第二步：切换即写入全站共享偏好。
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

// 游戏条目英文名：games.json 的 en.title，缺省回落中文 title。
export function gameTitle(game, locale) {
  if (locale === "en" && game?.en?.title) return game.en.title;
  return game?.title ?? "";
}
