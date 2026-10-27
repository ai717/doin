export const LOCALES = ["zh", "en"];
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

export const isLocale = (val) => LOCALES.includes(val);

export const strings = {
  zh: {
    // 通用
    backHome: "首页",
    gameTitle: "别踩白块儿",
    noscript: "需要启用 JavaScript 才能游玩。",
    // HUD
    combo: "连击",
    rank: "段位",
    bestCombo: "最长连击",
    score: "得分",
    misses: "剩余机会",
    bestScore: "最高分",
    // 模式
    modeClassic: "经典模式",
    // 弹窗
    welcomeTitle: "准备好了吗？",
    welcomeDesc: "只点黑色琴键，别踩白色。手速越快，音乐越美！",
    btnStart: "开始游戏",
    btnPause: "暂停",
    btnResume: "继续",
    btnRestart: "重新开始",
    btnReplay: "再来一局",
    btnClose: "返回",
    pauseTitle: "游戏暂停",
    pauseDesc: "按 P 或回车键继续",
    gameoverTitle: "游戏结束",
    finalScore: "本局得分",
    finalCombo: "本局最长连击",
    rankLabel: "段位",
    // 规则
    rulesTitle: "玩法说明",
    ruleControlHeader: "操作方式",
    ruleTap: "点击/触摸屏幕上的黑块",
    ruleKeys: "键盘：1 / 2 / 3 / 4 或 D / F / J / K 对应四列",
    rulePause: "P 键或回车键暂停/继续",
    ruleScoreHeader: "得分与段位",
    ruleHit: "命中黑块得分，连击越多倍率越高",
    ruleMiss: "3 次失误即结算（点白或漏黑）",
    ruleRank: "最长连击决定段位：新秀 10 / 快手 25 / 手速大师 50 / 指尖传说 100",
  },
  en: {
    backHome: "Home",
    gameTitle: "Piano Tiles",
    noscript: "JavaScript is required to play.",
    combo: "Combo",
    rank: "Rank",
    bestCombo: "Best Combo",
    score: "Score",
    misses: "Lives",
    bestScore: "Best",
    modeClassic: "Classic",
    welcomeTitle: "Ready?",
    welcomeDesc: "Tap only black tiles, avoid white ones. Faster fingers, sweeter music!",
    btnStart: "Start",
    btnPause: "Pause",
    btnResume: "Resume",
    btnRestart: "Restart",
    btnReplay: "Play Again",
    btnClose: "Back",
    pauseTitle: "Paused",
    pauseDesc: "Press P or Enter to resume",
    gameoverTitle: "Game Over",
    finalScore: "Final Score",
    finalCombo: "Best Combo",
    rankLabel: "Rank",
    rulesTitle: "How to Play",
    ruleControlHeader: "Controls",
    ruleTap: "Tap / touch black tiles on screen",
    ruleKeys: "Keys: 1 / 2 / 3 / 4 or D / F / J / K for four columns",
    rulePause: "Press P or Enter to pause/resume",
    ruleScoreHeader: "Scoring & Ranks",
    ruleHit: "Hit black tiles for score; longer combo = higher multiplier",
    ruleMiss: "3 misses and it's over (tapping white or missing black)",
    ruleRank: "Rank by max combo: Rookie 10 / Swift 25 / Master 50 / Legend 100",
  },
};

export function format(template, params = {}) {
  if (typeof template !== "string") return "";
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

export function detectLocale() {
  const saved = loadLocale();
  if (saved && isLocale(saved)) return saved;
  if (typeof navigator !== "undefined" && navigator.language) {
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith("zh")) return "zh";
  }
  return "en";
}

export function loadLocale() {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_LOCALE;
    const item = localStorage.getItem(LANG_KEY);
    return isLocale(item) ? item : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, locale);
    }
  } catch {
    // 静默降级
  }
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}

export function t(key, locale) {
  const table = strings[locale] || strings[DEFAULT_LOCALE];
  return table[key] ?? strings[DEFAULT_LOCALE][key] ?? key;
}
