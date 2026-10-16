// i18n.mjs: 云朵合成全站共享语言偏好 doin.lang（zh/en 键值严格对齐、非空）

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "云朵合成 · DOIN 在线小游戏",
    metaDesc: "云朵合成 Cloud Merge：把云朵丢进天空，同级相碰合体长大，合出雷暴云自动降雨清场，收集终极彩虹云放晴爆分！",
    appTitle: "云朵合成",
    back: "返回",
    canvasAria: "天空容器：云朵在其中轻飘下落、碰撞、合并成高阶云朵",
    sound: "音效",
    soundOn: "音效开",
    soundOff: "音效关",
    langSwitch: "EN",
    help: "说明",
    modeEndless: "无尽冲分",
    modeDaily: "每日挑战",
    modeAria: "选择模式",
    codexTitle: "云层图鉴",
    codexAria: "十级云朵升阶链",
    score: "得分",
    chain: "最长连锁",
    level: "最大云级",
    rainbows: "彩虹数",
    best: "最高分 {n}",
    bestLevel: "最高分 {n} · 最大 L{lv}",
    previewTitle: "气象发射台",
    previewCurrent: "待丢云朵",
    previewNext: "下一朵",
    previewHint: "当前 L{c} · 下一朵 L{n}",
    start: "开始游戏",
    pause: "暂停",
    resume: "继续",
    restart: "重玩",
    controlHint: "← → 移动 · 空格释放 · 点击 L10 彩虹云收集",
    readyKicker: "CLOUD MERGE",
    readyTitle: "云朵合成",
    readyDesc: "把轻飘飘的云朵丢进天空，相同云朵一碰合体长大；合出雷暴云自动下雨清场，合出彩虹云点它收集放晴爆分！",
    pauseTitle: "已暂停",
    pauseDesc: "点击“继续”回到天空。",
    resultTitle: "天空放晴 · 本局结算",
    resultScore: "最终得分",
    resultLevel: "最高云级",
    resultChain: "最长连锁",
    resultRainbows: "收集彩虹数",
    newBest: "🏆 新纪录！",
    playAgain: "再来一局",
    resultTipEndless: "无尽冲分 · 继续培育更多彩虹云让天空常晴",
    resultTipDaily: "每日挑战 {date} · 全球同题，明天再来挑战新纪录",
    helpTitle: "天气小剧场玩法说明",
    help1: "1. 移动鼠标或手指拖动瞄准，松手释放当前云朵；键盘方向键微调，空格键释放。",
    help2: "2. 两朵同级云碰撞即合体升阶，连续合体触发连锁倍率加成（每次递增 50%）。",
    help3: "3. 【核心机制 · 降雨清场】：合成出 L8 雷暴云时，会自动降下暴雨，清开正下方的拥挤云朵，化作水汽消散并奖励积分！",
    help4: "4. 【终极仪式 · 收集彩虹】：合成出 L10 彩虹云后，点击它即可收集！放晴金光满天，奖励 100 分并清空空间，可继续培育下一道彩虹。",
    help5: "5. 云朵堆叠超过顶部安全虚线会触发变暗预警，持续超线约 2 秒本局结算。",
    helpClose: "我知道了",
    toastBlocked: "落点受阻，请挪动位置释放",
    toastNoPop: "只能点击收集第 10 级彩虹云",
    toastPaused: "游戏已暂停",
    toastCooldown: "云朵下落中，请稍候...",
    toastModeLocked: "对局进行中，结算后方可切换模式",
    rainToast: "🌧️ 雷暴云降雨清场！+{points} 分",
    rainbowToast: "🌈 彩虹升空放晴！+{points} 分",
    levelUnit: "L{n}",
    dailyDate: "{date} 每日天气",
  },
  en: {
    docTitle: "Cloud Merge · DOIN Web Games",
    metaDesc: "Cloud Merge: Drop fluffy clouds into the sky to merge them into bigger ones. Thunderstorms auto-rain to clear space, and collect ultimate rainbow clouds for celebration scores!",
    appTitle: "Cloud Merge",
    back: "Back",
    canvasAria: "Sky container where fluffy clouds fall, collide, and merge into higher tiers",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "Help",
    modeEndless: "Endless",
    modeDaily: "Daily",
    modeAria: "Select mode",
    codexTitle: "Cloud Codex",
    codexAria: "Ten-level cloud chain",
    score: "Score",
    chain: "Max Chain",
    level: "Max Cloud",
    rainbows: "Rainbows",
    best: "Best {n}",
    bestLevel: "Best {n} · Max L{lv}",
    previewTitle: "Weather Pod",
    previewCurrent: "Current",
    previewNext: "Next",
    previewHint: "Current L{c} · Next L{n}",
    start: "Start Game",
    pause: "Pause",
    resume: "Resume",
    restart: "Restart",
    controlHint: "← → aim · Space drop · Click L10 Rainbow to collect",
    readyKicker: "CLOUD MERGE",
    readyTitle: "Cloud Merge",
    readyDesc: "Drop fluffy clouds into the sky; matching clouds merge into bigger ones. Form thunderstorms to auto-rain and clear space, and collect rainbow clouds to clear skies!",
    pauseTitle: "Paused",
    pauseDesc: "Click Resume to return to the sky.",
    resultTitle: "Clear Sky · Round Summary",
    resultScore: "Final Score",
    resultLevel: "Max Cloud Tier",
    resultChain: "Max Chain",
    resultRainbows: "Rainbows Collected",
    newBest: "🏆 New Best!",
    playAgain: "Play Again",
    resultTipEndless: "Endless · keep crafting more rainbows to brighten the sky",
    resultTipDaily: "Daily {date} · same clouds worldwide, come back tomorrow",
    helpTitle: "How to Play",
    help1: "1. Move mouse or drag finger to aim, release to drop cloud. Use arrow keys to nudge and Space to drop.",
    help2: "2. Two matching clouds merge into the next tier. Rapid chain merges boost your score combo multipliers!",
    help3: "3. [Rain Clearing]: Merging an L8 Thunderstorm Cloud unleashes a rain shower below, dissolving crowded clouds into vapor and granting bonus points!",
    help4: "4. [Rainbow Collection]: Click the ultimate L10 Rainbow Cloud to collect it! Enjoy golden sunshine, +100 bonus points, and freed up room for more clouds.",
    help5: "5. Stacking past the top safety line darkens the sky; keeping it flooded for ~2s ends the round.",
    helpClose: "Got It",
    toastBlocked: "Aim position blocked — move to open space",
    toastNoPop: "Only the ultimate L10 Rainbow Cloud can be collected",
    toastPaused: "Game paused",
    toastCooldown: "Hold on — cloud is still dropping...",
    toastModeLocked: "Round in progress — switch mode after round ends",
    rainToast: "🌧️ Thunderstorm rain cleared clouds! +{points} pts",
    rainbowToast: "🌈 Rainbow cleared the sky! +{points} pts",
    levelUnit: "L{n}",
    dailyDate: "Daily {date}",
  },
};

export function isLocale(locale) {
  return typeof locale === "string" && LOCALES.includes(locale);
}

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
    // 降级
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
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, locale);
    }
  } catch {
    // 写入异常静默
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
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}
