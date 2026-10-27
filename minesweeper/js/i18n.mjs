// i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。
// 默认显示语言规则：doin.lang 有合法值 → 用它；否则浏览器语言 zh* → 中文，其余 → 英文。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "扫雷 · DOIN 在线小游戏",
    metaDesc: "扫雷在线玩：经典 9×9 / 16×16 / 30×16 三档难度，首击必安全、全程可推理不靠猜，支持速开 chord、长按插旗与波纹展开动画，即点即玩。",
    title: "扫雷",
    lede: "排开雷区 · 首击必安全，全程不靠猜",
    backHome: "返回首页",
    difficulty: "难度",
    diffBeginner: "初级",
    diffIntermediate: "中级",
    diffExpert: "高级",
    hudMines: "剩余雷数",
    hudTime: "用时",
    hudProgress: "进度",
    statusReady: "点击任意格开始 · 首击永远安全",
    statusPlaying: "进行中 · 右键或长按插旗，点数字速开",
    statusWon: "雷区清空！",
    statusLost: "踩雷了 · 亮红的是标错的旗",
    boardLabel: "扫雷棋盘",
    flagMode: "旗帜模式",
    sound: "音效",
    muted: "静音",
    newGame: "新的一局",
    footnote: "左键翻开 · 右键 / 长按插旗 · 点已揭开的数字快速展开周围 · 标错旗会炸。",
    resultWon: "雷区清空",
    resultLost: "踩雷了",
    resultSub: "用时 {0} · 操作 {1} 次 · 难度 {2}",
    rowScore: "本局得分",
    rowBase: "基础分",
    rowTime: "时间分",
    rowBestScore: "最佳得分",
    rowBestTime: "最佳用时",
    rowNewRecord: "新纪录",
    again: "再来一局",
    viewBoard: "看看雷区",
    noscript: "需要启用 JavaScript 才能游玩扫雷。",
    chordFail: "旗数和数字不符，没法速开",
    peek: "逻辑已穷尽 · 免费透视 +1",
    langLabel: "Switch to English",
    langShort: "EN",
    ariaControls: "难度设置",
    ariaHud: "对局面板",
    ariaBoardStage: "雷区",
    ariaToolbar: "对局工具",
    ariaLang: "切换语言",
  },
  en: {
    docTitle: "Minesweeper · DOIN games",
    metaDesc: "Play Minesweeper online: classic 9×9 / 16×16 / 30×16 boards, guaranteed-safe first click, solvable without guessing, chord fast-open, long-press flagging and ripple reveal animations.",
    title: "Minesweeper",
    lede: "Clear the field · first click always safe, zero guessing",
    backHome: "Home",
    difficulty: "Difficulty",
    diffBeginner: "Beginner",
    diffIntermediate: "Intermediate",
    diffExpert: "Expert",
    hudMines: "Mines left",
    hudTime: "Time",
    hudProgress: "Progress",
    statusReady: "Click any cell to start · first click is always safe",
    statusPlaying: "Right-click or long-press to flag, click a number to chord",
    statusWon: "Field cleared!",
    statusLost: "Boom · red cells are wrong flags",
    boardLabel: "Minesweeper board",
    flagMode: "Flag mode",
    sound: "Sound",
    muted: "Muted",
    newGame: "New game",
    footnote: "Click to reveal · right-click / long-press to flag · click a revealed number to chord · wrong flags explode.",
    resultWon: "Field cleared",
    resultLost: "Boom",
    resultSub: "Time {0} · {1} moves · {2}",
    rowScore: "Score",
    rowBase: "Base",
    rowTime: "Time bonus",
    rowBestScore: "Best score",
    rowBestTime: "Best time",
    rowNewRecord: "New best",
    again: "Play again",
    viewBoard: "View board",
    noscript: "JavaScript is required to play Minesweeper.",
    chordFail: "Flag count doesn't match the number — can't chord",
    peek: "Logic exhausted · free peek +1",
    langLabel: "切换到中文",
    langShort: "中文",
    ariaControls: "Difficulty settings",
    ariaHud: "Game panel",
    ariaBoardStage: "Minefield",
    ariaToolbar: "Game tools",
    ariaLang: "Switch language",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

// 简单插值："用时 {0}" + fmt("1:23") → "用时 1:23"
export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
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
