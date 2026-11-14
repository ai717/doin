export const LOCALES = ["zh", "en"];
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

export const isLocale = (val) => LOCALES.includes(val);

export const strings = {
  zh: {
    // 通用
    backHome: "首页",
    gameTitle: "莓园打地鼠",
    noscript: "需要启用 JavaScript 才能游玩。",
    // 模式 / 难度
    modeLabel: "难度",
    diffEasy: "轻松",
    diffNormal: "普通",
    diffCrazy: "疯狂",
    diffDaily: "每日莓园",
    diffEasyHint: "露头久、只有普通鼠与金鼠",
    diffNormalHint: "加入铁盔鼠与炸弹鼠",
    diffCrazyHint: "露头最短、四只同屏、炸弹最多",
    dailyHint: "每日固定题面，全球同题",
    // HUD
    score: "得分",
    combo: "连击",
    maxCombo: "最长连击",
    timeLeft: "剩余时间",
    best: "最高分",
    accuracy: "命中率",
    multiplier: "倍率",
    // 按钮
    btnStart: "开始",
    btnPause: "暂停",
    btnResume: "继续",
    btnRestart: "重开",
    btnReplay: "再来一局",
    btnClose: "返回",
    btnHelp: "玩法",
    btnDaily: "每日莓园",
    // 弹窗
    welcomeTitle: "抡起木槌！",
    welcomeDesc: "地鼠从土洞探头，一槌敲回去。连击攒满触发莓雨狂热，别碰炸弹鼠。",
    pauseTitle: "已暂停",
    pauseDesc: "按 P 或回车继续",
    gameoverTitle: "时间到",
    finalScore: "本局得分",
    finalCombo: "最长连击",
    finalAccuracy: "命中率",
    finalBombs: "误击炸弹",
    newBestTitle: "新纪录！",
    newBestDesc: "刷新了本难度的最高分",
    // 提示
    frenzyToast: "莓雨狂热！",
    bombToast: "别打炸弹鼠！",
    // 鼠种
    spNormal: "普通地鼠",
    spGold: "金鼠",
    spHelmet: "铁盔鼠",
    spBomb: "炸弹鼠",
    // 规则
    rulesTitle: "玩法说明",
    ruleControlHeader: "操作方式",
    ruleTap: "鼠标点击 / 手指触摸地鼠，即点即中",
    ruleKeys: "键盘：1 2 3 4 / Q W E R / A S D F 对应十二个洞位",
    rulePause: "P 键或回车暂停/继续",
    ruleScoreHeader: "得分与连击",
    ruleHit: "普通鼠 1 分、金鼠 5 分、铁盔鼠需敲两下（掀盔 1 分、命中 3 分）",
    ruleBomb: "炸弹鼠禁止击打：误击扣 3 分并清空连击，等它自己缩回去",
    ruleCombo: "连击 8 起 ×1.5、16 起 ×2、24 起 ×3",
    ruleFrenzy: "连击每满 20 触发 4 秒莓雨狂热：地鼠变慢、得分翻倍",
    ruleDaily: "每日莓园用当天日期做种子，所有人同一套题面",
  },
  en: {
    backHome: "Home",
    gameTitle: "Berry Bash",
    noscript: "JavaScript is required to play.",
    modeLabel: "Difficulty",
    diffEasy: "Easy",
    diffNormal: "Normal",
    diffCrazy: "Crazy",
    diffDaily: "Daily",
    diffEasyHint: "Slow moles, no helmets or bombs",
    diffNormalHint: "Adds helmeted moles and bombs",
    diffCrazyHint: "Fastest moles, four at once, most bombs",
    dailyHint: "Same seeded garden for everyone today",
    score: "Score",
    combo: "Combo",
    maxCombo: "Best Combo",
    timeLeft: "Time",
    best: "Best",
    accuracy: "Accuracy",
    multiplier: "Mult",
    btnStart: "Start",
    btnPause: "Pause",
    btnResume: "Resume",
    btnRestart: "Restart",
    btnReplay: "Play Again",
    btnClose: "Back",
    btnHelp: "Help",
    btnDaily: "Daily",
    welcomeTitle: "Grab the mallet!",
    welcomeDesc: "Moles pop out of the soil — whack them back down. Chain combos for Berry Frenzy, and never hit a bomb.",
    pauseTitle: "Paused",
    pauseDesc: "Press P or Enter to resume",
    gameoverTitle: "Time's Up",
    finalScore: "Score",
    finalCombo: "Best Combo",
    finalAccuracy: "Accuracy",
    finalBombs: "Bombs Hit",
    newBestTitle: "New Record!",
    newBestDesc: "You beat your best score on this difficulty",
    frenzyToast: "Berry Frenzy!",
    bombToast: "Don't hit bombs!",
    spNormal: "Mole",
    spGold: "Golden Mole",
    spHelmet: "Helmeted Mole",
    spBomb: "Bomb Mole",
    rulesTitle: "How to Play",
    ruleControlHeader: "Controls",
    ruleTap: "Click or tap a mole — hits register the instant you press",
    ruleKeys: "Keys: 1 2 3 4 / Q W E R / A S D F map to the twelve holes",
    rulePause: "Press P or Enter to pause/resume",
    ruleScoreHeader: "Scoring & Combos",
    ruleHit: "Mole 1 pt, Golden 5 pts, Helmeted needs two hits (block 1 pt, hit 3 pts)",
    ruleBomb: "Never hit bomb moles: -3 pts and combo reset. Just let them duck back in",
    ruleCombo: "Combo 8 → ×1.5, 16 → ×2, 24 → ×3",
    ruleFrenzy: "Every 20 combo triggers 4s Berry Frenzy: slower moles, double points",
    ruleDaily: "Daily Garden is seeded by today's date — everyone gets the same board",
  },
};

export function format(template, params = {}) {
  if (typeof template !== "string") return "";
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
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

export function detectLocale() {
  const saved = loadLocale();
  if (saved && isLocale(saved)) return saved;
  if (typeof navigator !== "undefined" && navigator.language) {
    if (navigator.language.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}

export function t(key, locale) {
  const table = strings[locale] || strings[DEFAULT_LOCALE];
  return table[key] ?? strings[DEFAULT_LOCALE][key] ?? key;
}
