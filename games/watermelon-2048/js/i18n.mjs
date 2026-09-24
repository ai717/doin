// 数字合成大西瓜 watermelon-2048 · 全站共享语言偏好 doin.lang（zh/en 键值严格对齐、非空）

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "数字合成大西瓜 · DOIN 在线小游戏",
    metaDesc: "数字合成大西瓜 Watermelon 2048：把带数字的水果丢进果园，相同数字一碰翻倍合并，一路合成到 2048 大西瓜，点它「摘瓜」爆分清场，别堆过安全线。无尽冲分与每日挑战双模式。",
    appTitle: "数字合成大西瓜",
    back: "返回",
    canvasAria: "数字合成大西瓜果园：带数字的水果在其中掉落、碰撞、合并，2048 大西瓜可摘瓜",
    sound: "音效",
    soundOn: "音效开",
    soundOff: "音效关",
    langSwitch: "EN",
    help: "说明",
    modeEndless: "无尽冲分",
    modeDaily: "每日挑战",
    modeAria: "选择模式",
    codexTitle: "数字合成链图鉴",
    codexAria: "十一级数字水果链",
    codexRemain: "距大西瓜还差 {n} 级",
    codexDone: "已合出 2048 🍉 点它摘瓜！",
    score: "得分",
    chain: "最长连锁",
    harvested: "已摘西瓜",
    best: "最高分 {n}",
    bestTime: "最快 2048 {t} 秒",
    previewTitle: "果园传送带",
    previewCurrent: "当前",
    previewNext: "下一个",
    previewHint: "当前 {c} · 下一个 {n}",
    start: "开始游戏",
    pause: "暂停",
    resume: "继续",
    restart: "重玩",
    controlHint: "← → 瞄准 · 空格释放 · 点 2048 摘瓜",
    readyKicker: "WATERMELON 2048",
    readyTitle: "数字合成大西瓜",
    readyDesc: "把带数字的水果丢进果园，相同数字一碰就翻倍合并（2+2=4 … 1024+1024=2048）。合出 2048 大西瓜点它「摘瓜」爆分清场，还能继续合下一个——别让水果堆过安全线！",
    pauseTitle: "已暂停",
    pauseDesc: "点「继续」回到果园。",
    resultTitle: "本局结算",
    resultScore: "得分",
    resultMax: "最大合成数字",
    resultChain: "最长连锁",
    resultHarvested: "已摘西瓜",
    newBest: "🏆 新高分",
    medal2048: "🍉 合成大西瓜成就",
    playAgain: "再来一局",
    resultTipEndless: "无尽冲分 · 试试合出第二个 2048 大西瓜",
    resultTipDaily: "每日挑战 {date} · 全球同题，明天再来刷新纪录",
    helpTitle: "玩法说明",
    help1: "1. 移动鼠标 / 手指拖动瞄准，松手或点击释放当前水果；键盘 ← → 微调、空格释放。",
    help2: "2. 两个相同数字的水果一碰即合成翻倍的大水果（2+2=4、512+512=1024），连锁合并倍率逐级提高。",
    help3: "3. 合出 2048 大西瓜后点它「摘瓜」：再得 2048 分并清空占位，继续合第二个大西瓜。",
    help4: "4. 水果堆过顶部安全线会红色预警，约 2 秒后结算本局；靠连锁与摘瓜清场自救。",
    help5: "5. 每日挑战当天掉落序列固定，全球同题，比谁先合出 2048、分更高。",
    helpClose: "我知道了",
    toastBlocked: "落点被挡，换个位置再丢",
    toastNoHarvest: "只能摘最大的 2048 大西瓜",
    toastCooldown: "稍等一下，水果还在掉落",
    toastModeLocked: "对局进行中，结算后再切换模式",
    dailyDate: "{date} 每日挑战",
  },
  en: {
    docTitle: "Watermelon 2048 · DOIN Web Games",
    metaDesc: "Watermelon 2048: drop numbered fruits into the orchard, matching numbers merge and double (2+2=4 … 1024+1024=2048). Harvest the 2048 watermelon for bonus points and cleared space — don't stack past the safety line. Endless and daily modes.",
    appTitle: "Watermelon 2048",
    back: "Back",
    canvasAria: "Watermelon 2048 orchard where numbered fruits fall, collide and merge; the 2048 watermelon can be harvested",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "Help",
    modeEndless: "Endless",
    modeDaily: "Daily",
    modeAria: "Select mode",
    codexTitle: "Merge Chain",
    codexAria: "Eleven-level fruit chain",
    codexRemain: "{n} levels to the big melon",
    codexDone: "2048 built 🍉 tap it to harvest!",
    score: "Score",
    chain: "Best Chain",
    harvested: "Harvested",
    best: "Best {n}",
    bestTime: "Fastest 2048 {t}s",
    previewTitle: "Orchard Belt",
    previewCurrent: "Now",
    previewNext: "Next",
    previewHint: "Now {c} · Next {n}",
    start: "Start Game",
    pause: "Pause",
    resume: "Resume",
    restart: "Restart",
    controlHint: "← → aim · Space drop · tap 2048 to harvest",
    readyKicker: "WATERMELON 2048",
    readyTitle: "Watermelon 2048",
    readyDesc: "Drop numbered fruits into the orchard; matching numbers merge and double (2+2=4 … 1024+1024=2048). Build the 2048 watermelon and tap it to harvest for bonus score and cleared space — keep building the next one, but don't stack past the safety line!",
    pauseTitle: "Paused",
    pauseDesc: "Tap Resume to return to the orchard.",
    resultTitle: "Round Over",
    resultScore: "Score",
    resultMax: "Max Value",
    resultChain: "Best Chain",
    resultHarvested: "Harvested",
    newBest: "🏆 New Best",
    medal2048: "🍉 2048 Achievement",
    playAgain: "Play Again",
    resultTipEndless: "Endless · try to build a second 2048 watermelon",
    resultTipDaily: "Daily {date} · same puzzle worldwide, beat it again tomorrow",
    helpTitle: "How to Play",
    help1: "1. Move the mouse / drag to aim, release or click to drop the current fruit; keyboard ← → nudges, Space drops.",
    help2: "2. Two fruits with the same number merge into the doubled fruit on contact (2+2=4, 512+512=1024); chains score higher multipliers.",
    help3: "3. Once you build the 2048 watermelon, tap it to harvest: +2048 points and the space it occupied is cleared — then build the next one.",
    help4: "4. Stacking past the top safety line flashes a red warning, then ends the round after ~2s; rescue yourself with chains and harvests.",
    help5: "5. Daily Challenge uses a fixed drop sequence for the day — same puzzle worldwide, compete on fastest 2048 and score.",
    helpClose: "Got It",
    toastBlocked: "Landing spot blocked — aim elsewhere",
    toastNoHarvest: "Only the biggest 2048 watermelon can be harvested",
    toastCooldown: "Hold on — a fruit is still dropping",
    toastModeLocked: "Round in progress — switch mode after it ends",
    dailyDate: "Daily {date}",
  },
};

export function isLocale(locale) {
  return typeof locale === "string" && LOCALES.includes(locale);
}

// 返回指定语言的字典；非法语言回退默认。键值在 zh/en 间严格对齐。
export function strings(locale) {
  return DICT[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function detectLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch {
    // 隐私模式或存储被禁用：降级
  }
  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      if (navigator.language.toLowerCase().startsWith("zh")) return "zh";
      return "en";
    }
  } catch {
    // 降级
  }
  return DEFAULT_LOCALE;
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, locale);
  } catch {
    // 忽略写入异常
  }
}

export function htmlLang(locale) {
  if (isLocale(locale)) return locale === "zh" ? "zh-CN" : "en";
  return DEFAULT_LOCALE === "zh" ? "zh-CN" : "en";
}

export function format(str, params) {
  if (typeof str !== "string") return "";
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  );
}
