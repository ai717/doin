// 深海合珠 bubble-merge · 全站共享语言偏好 doin.lang（zh/en 键值严格对齐、非空）

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "深海合珠 · DOIN 在线小游戏",
    metaDesc: "深海合珠 Bubble Merge：把泡泡丢进深海水缸，同级一碰即合成更大一号，连锁爆分，戳破终极泡泡清场，别堆过安全线。",
    appTitle: "深海合珠",
    back: "返回",
    canvasAria: "深海合珠水缸：泡泡在其中下落、碰撞、合并",
    sound: "音效",
    soundOn: "音效开",
    soundOff: "音效关",
    langSwitch: "EN",
    help: "说明",
    modeEndless: "无尽冲分",
    modeDaily: "每日挑战",
    modeAria: "选择模式",
    codexTitle: "合成图鉴",
    codexAria: "十级泡泡链",
    score: "得分",
    chain: "最长连锁",
    level: "最大级",
    best: "最高分 {n}",
    bestLevel: "最高分 {n} · 最大级 L{lv}",
    previewTitle: "下一颗珍珠",
    previewCurrent: "当前",
    previewNext: "下一个",
    previewHint: "当前 L{c} · 下一个 L{n}",
    start: "开始游戏",
    pause: "暂停",
    resume: "继续",
    restart: "重玩",
    controlHint: "← → 瞄准 · 空格释放 · 点 L10 戳破",
    readyKicker: "BUBBLE MERGE",
    readyTitle: "深海合珠",
    readyDesc: "丢下泡泡，同级相碰即合成更大一号。合出终极泡泡后点它“啪”地戳破爆分清场，别让泡泡堆过安全线。",
    pauseTitle: "已暂停",
    pauseDesc: "点“继续”回到水缸。",
    resultTitle: "本局结算",
    resultScore: "得分",
    resultLevel: "最大合成级",
    resultChain: "最长连锁",
    newBest: "🏆 新高分",
    playAgain: "再来一局",
    resultTipEndless: "无尽冲分 · 试试合到更大的终极泡泡",
    resultTipDaily: "每日挑战 {date} · 全球同题，明天再来刷新纪录",
    helpTitle: "玩法说明",
    help1: "1. 移动鼠标 / 手指拖动瞄准，松手或点击释放当前泡泡；键盘 ← → 微调、空格释放。",
    help2: "2. 两个同级泡泡一碰即合成高一级，可能引发连锁，连锁越多倍率越高（每多一级 ×1.5）。",
    help3: "3. 合成出终极泡泡 L10 后，点它“啪”地戳破：+100 分并清空所占空间。",
    help4: "4. 泡泡堆过顶部安全线会先红色预警，约 2 秒后结算本局；靠连锁与戳破清场自救。",
    help5: "5. 每日挑战当天掉落序列固定，全球同题，比谁合得更大、分更高。",
    helpClose: "我知道了",
    toastBlocked: "落点被挡，换个位置再丢",
    toastNoPop: "只能戳破最大的终极泡泡 L10",
    toastPaused: "已暂停",
    toastCooldown: "稍等一下，泡泡还在掉落",
    toastModeLocked: "对局进行中，结算后再切换模式",
    levelUnit: "L{n}",
    dailyDate: "{date} 每日挑战",
  },
  en: {
    docTitle: "Bubble Merge · DOIN Web Games",
    metaDesc: "Bubble Merge: drop bubbles into a deep-sea tank, same-size bubbles merge into a bigger one, chain them for score, pop the ultimate bubble to clear space — don't stack past the line.",
    appTitle: "Bubble Merge",
    back: "Back",
    canvasAria: "Bubble Merge tank where bubbles fall, collide and merge",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "Help",
    modeEndless: "Endless",
    modeDaily: "Daily",
    modeAria: "Select mode",
    codexTitle: "Merge Codex",
    codexAria: "Ten-level bubble chain",
    score: "Score",
    chain: "Best Chain",
    level: "Max Level",
    best: "Best {n}",
    bestLevel: "Best {n} · Max L{lv}",
    previewTitle: "Next Pearls",
    previewCurrent: "Current",
    previewNext: "Next",
    previewHint: "Current L{c} · Next L{n}",
    start: "Start Game",
    pause: "Pause",
    resume: "Resume",
    restart: "Restart",
    controlHint: "← → aim · Space drop · tap L10 to pop",
    readyKicker: "BUBBLE MERGE",
    readyTitle: "Bubble Merge",
    readyDesc: "Drop bubbles; two of the same size merge into a bigger one. Build the ultimate bubble then tap to pop it for a big score and cleared space — don't stack past the safety line.",
    pauseTitle: "Paused",
    pauseDesc: "Tap Resume to return to the tank.",
    resultTitle: "Round Over",
    resultScore: "Score",
    resultLevel: "Max Level",
    resultChain: "Best Chain",
    newBest: "🏆 New Best",
    playAgain: "Play Again",
    resultTipEndless: "Endless · try to merge an even bigger ultimate bubble",
    resultTipDaily: "Daily {date} · same puzzle worldwide, beat it again tomorrow",
    helpTitle: "How to Play",
    help1: "1. Move the mouse / drag to aim, release or click to drop the current bubble; keyboard ← → nudges, Space drops.",
    help2: "2. Two same-level bubbles merge into the next level on contact and may cascade — longer chains score higher (×1.5 per extra link).",
    help3: "3. Once you merge the ultimate bubble L10, tap it to pop: +100 points and it clears the space it occupied.",
    help4: "4. Stacking past the top safety line flashes a red warning, then ends the round after ~2s; rescue yourself with chains and pops.",
    help5: "5. Daily Challenge uses a fixed drop sequence for the day — same puzzle worldwide, compete on size and score.",
    helpClose: "Got It",
    toastBlocked: "Landing spot blocked — aim elsewhere",
    toastNoPop: "Only the biggest ultimate bubble L10 can be popped",
    toastPaused: "Paused",
    toastCooldown: "Hold on — a bubble is still dropping",
    toastModeLocked: "Round in progress — switch mode after it ends",
    levelUnit: "L{n}",
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
