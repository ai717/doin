// Bilingual strings for Nine Rings. Shared preference key: doin.lang.
// English table has no Han characters except the language-switch button marker.

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "古代九连环 · DOIN 在线小游戏",
    metaDesc: "按口诀上下环解开九连环，3/5/7/9 环四章递进，解环与装环双模式。步数评级、撤销与可动环提示，即开即玩无需注册。",
    title: "古代九连环",
    lede: "一环一扣 · 解开千年递归",
    backHome: "返回门户",
    stageBar: "游戏控制栏",
    levels: "选关",
    modes: "模式",
    hint: "提示",
    hintOn: "提示已开",
    hintOff: "提示已关",
    undo: "撤销",
    reset: "重置",
    sound: "音效",
    mute: "音效开",
    muted: "静音",
    pause: "暂停",
    resume: "继续",
    langLabel: "Switch to English",
    langShort: "EN",
    unlinkMode: "解环模式",
    linkMode: "装环模式",
    unlinkShort: "解环",
    linkShort: "装环",
    fullLevel: "全解",
    midLevel: "残局",
    chapter3: "三环入门",
    chapter5: "五环进阶",
    chapter7: "七环挑战",
    chapter9: "九环完全体",
    moves: "步数",
    optimal: "最优",
    best: "最佳",
    rings: "环",
    time: "用时",
    undoCount: "撤销",
    ruleTitle: "解环口诀",
    rule1: "第一环随时可上下",
    rule2: "第二环要看第一环在上",
    ruleN: "其余环：前一环在上、前面其余全在下",
    ruleAim: "目标：把环全部下环（解环）或全部上环（装环）",
    statusReady: "点亮的环可操作 · 试着动第一环",
    statusLocked: "这环还不能动 · 看清口诀",
    statusMove: "叮 · 又进了一步",
    statusDone: "九环尽解 · 剑柄抽出",
    hintTip: "高亮的环可以上下 · 按 H 关提示",
    pauseTitle: "已暂停",
    pauseHint: "计时与声音已冻结",
    resultTitle: "解开了",
    resultSub: "用了 {0} 步 · 最优 {1} 步",
    resultStars: "步数评级",
    starsThree: "行云流水",
    starsTwo: "渐入佳境",
    starsOne: "大功告成",
    newRecord: "新纪录",
    nextLevel: "下一关",
    replay: "再玩一次",
    close: "继续解环",
    noscript: "需要启用 JavaScript 才能解九连环。",
    ariaRings: "九连环环位",
    ariaPaper: "宣纸口诀区",
    ariaStatus: "游戏状态",
    ariaLevelDrawer: "选关抽屉",
    ariaRingBtn: "第 {0} 环",
    keyHelp: "数字 1-9 操作对应环 · Z 撤销 · R 重置 · H 提示",
  },
  en: {
    docTitle: "Nine Rings Puzzle · DOIN Games",
    metaDesc: "Learn the chime rules and solve the Nine Rings. Four chapters from 3 to 9 rings, unlink and link modes, move ratings, undo and legal-ring hints. Instant play, no sign-up.",
    title: "Nine Rings Puzzle",
    lede: "One ring, one link · unwind a thousand-year recursion",
    backHome: "Portal",
    stageBar: "Game controls",
    levels: "Levels",
    modes: "Modes",
    hint: "Hint",
    hintOn: "Hint on",
    hintOff: "Hint off",
    undo: "Undo",
    reset: "Reset",
    sound: "Sound",
    mute: "Sound on",
    muted: "Muted",
    pause: "Pause",
    resume: "Resume",
    langLabel: "\u5207\u6362\u5230\u4e2d\u6587",
    langShort: "\u4e2d\u6587",
    unlinkMode: "Unlink Mode",
    linkMode: "Link Mode",
    unlinkShort: "Unlink",
    linkShort: "Link",
    fullLevel: "Full Solve",
    midLevel: "Mid-game",
    chapter3: "Three Rings",
    chapter5: "Five Rings",
    chapter7: "Seven Rings",
    chapter9: "Nine Rings",
    moves: "Moves",
    optimal: "Optimal",
    best: "Best",
    rings: "Rings",
    time: "Time",
    undoCount: "Undos",
    ruleTitle: "The Chime Rules",
    rule1: "Ring 1 may always move up or down",
    rule2: "Ring 2 moves only when ring 1 is on",
    ruleN: "For ring k>2: ring k-1 on, all earlier rings off",
    ruleAim: "Goal: take every ring off (unlink) or put every ring on (link)",
    statusReady: "Lit rings can move · try ring one first",
    statusLocked: "That ring is locked · check the rule",
    statusMove: "Clink · one step closer",
    statusDone: "All nine rings free · the blade slides out",
    hintTip: "Glowing rings can move · press H to toggle hint",
    pauseTitle: "Paused",
    pauseHint: "Timer and audio are frozen",
    resultTitle: "Solved",
    resultSub: "{0} moves · optimal {1}",
    resultStars: "Move rating",
    starsThree: "Flawless flow",
    starsTwo: "Getting warm",
    starsOne: "Well done",
    newRecord: "New record",
    nextLevel: "Next level",
    replay: "Play again",
    close: "Keep solving",
    noscript: "JavaScript is required to solve the Nine Rings.",
    ariaRings: "Nine rings board",
    ariaPaper: "Rule scroll",
    ariaStatus: "Game status",
    ariaLevelDrawer: "Level drawer",
    ariaRingBtn: "Ring {0}",
    keyHelp: "Keys 1-9 move rings · Z undo · R reset · H hint",
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
