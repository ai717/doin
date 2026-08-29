import type { Locale } from "../i18n/locale.ts";
import { LOCALES } from "../i18n/locale.ts";

export type SeoPage = "home" | "daily" | "howTo" | "stats" | "settings";
export const APP_BASE_PATH = "/sudoku";

export const SEO_PATH: Record<SeoPage, string> = {
  home: "/",
  daily: "/daily",
  howTo: "/how-to",
  stats: "/stats",
  settings: "/settings",
};

const COPY: Record<
  SeoPage,
  Record<Locale, { title: string; description: string; h1: string }>
> = {
  home: {
    "zh-Hans": {
      title: "数独游戏 - 免费在线数独",
      description:
        "打开就能玩的免费在线数独。入门到专家、每日挑战，提示会讲为什么。纸感界面，无需注册。",
      h1: "免费在线数独",
    },
    "zh-Hant": {
      title: "數獨遊戲 - 免費線上數獨",
      description:
        "打開就能玩的免費線上數獨。入門到專家、每日挑戰，提示會講為什麼。紙感介面，無需註冊。",
      h1: "免費線上數獨",
    },
    en: {
      title: "Sudoku — Free Online Sudoku",
      description:
        "Play free online Sudoku as soon as you open it. Beginner to Expert, a daily challenge, and hints that explain why. No sign-up.",
      h1: "Free online Sudoku",
    },
  },
  daily: {
    "zh-Hans": {
      title: "今日数独挑战 - 数独游戏",
      description: "每天一题数独，所有人同一道题。记录连胜与用时，免费在线挑战。",
      h1: "今日数独挑战",
    },
    "zh-Hant": {
      title: "今日數獨挑戰 - 數獨遊戲",
      description: "每天一題數獨，所有人同一道題。記錄連勝與用時，免費線上挑戰。",
      h1: "今日數獨挑戰",
    },
    en: {
      title: "Daily Sudoku Challenge — Sudoku",
      description: "One Sudoku a day, the same puzzle for everyone. Track your streak and time. Free to play.",
      h1: "Daily Sudoku challenge",
    },
  },
  howTo: {
    "zh-Hans": {
      title: "数独规则与技巧 - 数独游戏",
      description:
        "数独怎么玩：行列宫规则、笔记、三步提示，以及显性唯一、隐性唯一、X-Wing、Swordfish 等技巧图鉴。",
      h1: "数独玩法与技巧",
    },
    "zh-Hant": {
      title: "數獨規則與技巧 - 數獨遊戲",
      description:
        "數獨怎麼玩：行列宮規則、筆記、三步提示，以及顯性唯一、隱性唯一、X-Wing、Swordfish 等技巧圖鑑。",
      h1: "數獨玩法與技巧",
    },
    en: {
      title: "How to Play Sudoku — Rules and Techniques",
      description:
        "Sudoku rules for rows, columns, and boxes, note-taking, three-step hints, plus an atlas of naked singles, hidden singles, X-Wing, and Swordfish.",
      h1: "How to play Sudoku",
    },
  },
  stats: {
    "zh-Hans": {
      title: "数独成就统计 - 数独游戏",
      description: "查看总积分、最高分、连胜、完成局数与成就印章。免费在线数独的成绩墙。",
      h1: "数独成就统计",
    },
    "zh-Hant": {
      title: "數獨成就統計 - 數獨遊戲",
      description: "查看總積分、最高分、連勝、完成局數與成就印章。免費線上數獨的成績牆。",
      h1: "數獨成就統計",
    },
    en: {
      title: "Sudoku Stats and Achievements",
      description: "Total score, best game, streaks, finished puzzles, and stamps. Your free online Sudoku record.",
      h1: "Sudoku stats",
    },
  },
  settings: {
    "zh-Hans": {
      title: "设置 - 数独游戏",
      description: "语言、外观、音效与输入方式。支持简体、繁體与 English。",
      h1: "设置",
    },
    "zh-Hant": {
      title: "設定 - 數獨遊戲",
      description: "語言、外觀、音效與輸入方式。支援简体、繁體與 English。",
      h1: "設定",
    },
    en: {
      title: "Settings — Sudoku",
      description: "Language, appearance, sound, and input. Simplified Chinese, Traditional Chinese, and English.",
      h1: "Settings",
    },
  },
};

export function parseHl(s: Record<string, unknown>): Locale | undefined {
  const hl = s.hl;
  if (hl === "zh-Hans" || hl === "zh-Hant" || hl === "en") return hl;
  return undefined;
}

export function seoCopy(page: SeoPage, locale: Locale) {
  return COPY[page][locale];
}

export function pageFromPath(pathname: string): SeoPage {
  if (pathname.startsWith("/daily")) return "daily";
  if (pathname.startsWith("/how-to")) return "howTo";
  if (pathname.startsWith("/stats")) return "stats";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}

export function seoTitle(pathname: string, locale: Locale): string {
  return seoCopy(pageFromPath(pathname), locale).title;
}

function hreflangLinks(path: string) {
  return [
    { rel: "alternate" as const, hrefLang: "zh-Hans", href: localeHref(path, "zh-Hans") },
    { rel: "alternate" as const, hrefLang: "zh-CN", href: localeHref(path, "zh-Hans") },
    { rel: "alternate" as const, hrefLang: "zh-Hant", href: localeHref(path, "zh-Hant") },
    { rel: "alternate" as const, hrefLang: "zh-TW", href: localeHref(path, "zh-Hant") },
    { rel: "alternate" as const, hrefLang: "zh-HK", href: localeHref(path, "zh-Hant") },
    { rel: "alternate" as const, hrefLang: "en", href: localeHref(path, "en") },
    { rel: "alternate" as const, hrefLang: "x-default", href: publicPath(path) },
  ];
}

function publicPath(path: string) {
  return APP_BASE_PATH + (path === "/" ? "/" : path);
}

export function localeHref(path: string, locale: Locale) {
  const q = `hl=${locale}`;
  return `${publicPath(path)}?${q}`;
}

export function routeHead(page: SeoPage, hl?: Locale) {
  const locale: Locale = hl ?? "zh-Hans";
  const copy = seoCopy(page, locale);
  const path = SEO_PATH[page];
  const canonical = hl ? localeHref(path, hl) : publicPath(path);
  return {
    meta: [
      { title: copy.title },
      { name: "description", content: copy.description },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:title", content: copy.title },
      { property: "og:description", content: copy.description },
      { property: "og:locale", content: locale === "zh-Hant" ? "zh_TW" : locale === "en" ? "en_US" : "zh_CN" },
      { name: "twitter:title", content: copy.title },
      { name: "twitter:description", content: copy.description },
    ],
    links: [{ rel: "canonical", href: canonical }, ...hreflangLinks(path)],
  };
}

export const SITEMAP_PATHS = Object.values(SEO_PATH);

export function sitemapXml(origin: string): string {
  const base = origin.replace(/\/$/, "");
  const urls = SITEMAP_PATHS.map((path) => {
    const loc = new URL(publicPath(path), `${base}/`).href;
    const alts = [
      ...LOCALES.map(
        (locale) =>
          `    <xhtml:link rel="alternate" hreflang="${locale}" href="${base}${localeHref(path, locale)}" />`,
      ),
      `    <xhtml:link rel="alternate" hreflang="zh-CN" href="${base}${localeHref(path, "zh-Hans")}" />`,
      `    <xhtml:link rel="alternate" hreflang="zh-TW" href="${base}${localeHref(path, "zh-Hant")}" />`,
      `    <xhtml:link rel="alternate" hreflang="zh-HK" href="${base}${localeHref(path, "zh-Hant")}" />`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />`,
    ].join("\n");
    return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${path === "/daily" ? "daily" : "weekly"}</changefreq>\n    <priority>${path === "/" ? "1.0" : path === "/how-to" || path === "/daily" ? "0.8" : "0.5"}</priority>\n${alts}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
}

export function appJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "数独游戏",
    alternateName: ["Sudoku", "數獨遊戲", "免费在线数独", "免費線上數獨"],
    description:
      "免费在线数独。入门到专家、每日挑战，提示会讲为什么。Free online Sudoku with step-by-step hints.",
    applicationCategory: "GameApplication",
    url: "https://doin.win/sudoku/",
    genre: "Sudoku",
    operatingSystem: "Any",
    inLanguage: ["zh-Hans", "zh-Hant", "en"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
  };
}

export function howToJsonLd(locale: Locale) {
  const copy = seoCopy("howTo", locale);
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: copy.h1,
    description: copy.description,
    inLanguage: locale,
    step: [
      {
        "@type": "HowToStep",
        name: locale === "en" ? "Rows, columns, boxes" : locale === "zh-Hant" ? "行、列、宮" : "行、列、宫",
        text:
          locale === "en"
            ? "Fill 1–9 in every row, column, and 3×3 box with no repeats."
            : locale === "zh-Hant"
              ? "每一行、每一列、每一宮都要出現 1 到 9，且不能重複。"
              : "每一行、每一列、每一宫都要出现 1 到 9，且不能重复。",
      },
      {
        "@type": "HowToStep",
        name: locale === "en" ? "Notes" : locale === "zh-Hant" ? "筆記" : "笔记",
        text:
          locale === "en"
            ? "Mark candidates, then enter a digit when you are sure."
            : locale === "zh-Hant"
              ? "先記候選，確定後再填入數字。"
              : "先记候选，确定后再填入数字。",
      },
      {
        "@type": "HowToStep",
        name: locale === "en" ? "Hints" : "提示",
        text:
          locale === "en"
            ? "Hints name the technique and explain why, then can fill the cell."
            : locale === "zh-Hant"
              ? "提示會講出技巧名稱和理由，最後才幫你填上。"
              : "提示会讲出技巧名称和理由，最后才帮你填上。",
      },
    ],
  };
}
