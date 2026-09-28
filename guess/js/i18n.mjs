// i18n.mjs —— 中英双语表，语言偏好统一读写全站共享 key localStorage["doin.lang"]

export const LANG_KEY = "doin.lang";
export const LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "zh";

const DICT = {
  zh: {
    appTitle: "猜数字",
    appKicker: "声呐围猎",
    back: "返回门户",
    sound: "音效",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",
    levels: "猎场图",

    ch1: "静水试航",
    ch2: "暗流涌动",
    ch3: "谎灯回波",
    ch4: "浊流深潜",
    ch5: "猎王之境",
    ch6: "盲猎",

    hudChapter: "第 {n} 章",
    hudLevel: "第 {n} 关",
    hudRange: "猎场",
    hudUsed: "已投",
    hudTorpedo: "鱼雷",
    hudBest: "最少投掷",
    hudPar: "标准",
    hudEff: "效率",
    hudBand: "包围圈",
    hudEcho: "回波日志",
    hudTools: "声呐挂件",

    mechCalm: "静水：回波诚实",
    mechDrift: "暗流：前 {n} 投后目标漂移 ±{k}",
    mechLiar: "谎灯：整局有一次方向回波是反的",
    mechFog: "浊流：{n} 段雾区内回波静默",
    mechBlind: "盲猎：不显示温度",

    echoHigher: "目标更大",
    echoLower: "目标更小",
    echoSilent: "浊流吞没回波",
    echoHit: "命中",
    echoLiar: "谎灯",

    tempHot: "烫",
    tempWarm: "温",
    tempCold: "冷",
    tempOff: "无温度",

    btnFire: "发射",
    btnDel: "退格",
    btnRecall: "回溯",
    btnProbe: "声呐探针",
    btnScan: "扫描线",
    btnRetry: "再猎一次",
    btnNext: "下一关",
    btnMap: "猎场图",
    btnDive: "下潜开局",
    btnResume: "继续",

    toolProbeTip: "消耗 1 投 · 回报目标奇偶",
    toolScanTip: "消耗 2 投 · 点亮包围圈半区",
    toolRecallTip: "撤销上一投（不消耗鱼雷）",

    probeOdd: "目标是奇数",
    probeEven: "目标是偶数",
    scanLower: "目标在下半区",
    scanUpper: "目标在上半区",

    conflict: "回波冲突 · 其中有一次是谎灯",
    cornered: "瓮中捉鳖 · 只剩一个可能",
    pressure: "包围圈收紧 · 只剩 {n} 发鱼雷",
    silent: "无回波",

    readyKicker: "深海声呐围猎",
    readyTitle: "猜数字",
    readyDesc: "水下一个数，你每次投下浮标，声呐只回一句「大了 / 小了」，外加一个温度。看着包围圈一寸寸勒紧，最后一击把它从暗水里捞出来。",
    readyHint: "三十关，每章加一种噪声：暗流让猎物挪窝，谎灯让回波说反话，浊流让探测失声。",

    resultWin: "锁定目标",
    resultLose: "鱼雷耗尽",
    resultUsed: "投掷次数",
    resultStars: "猎手评级",
    resultTarget: "目标 {n}",
    resultPar: "标准 {n} 投",
    newBest: "新纪录",
    resultNoteWin: "回波归位，海面浮起一串气泡。",
    resultNoteLose: "它一直在那儿，只是你没捞着。",
    resultReveal: "谎灯出现在第 {n} 投",

    helpTitle: "玩法说明",
    help1: "1. 拨盘输入范围内的整数，按「发射」投下浮标：目标更大则右舷回波（右侧熄灭），更小则左舷回波（左侧熄灭）。",
    help2: "2. 回波还带温度：烫 ≤ 全长的 2%，温 ≤ 8%，再远就是冷。包围圈的光色会跟着一起变。",
    help3: "3. 键盘：0-9 输入、Backspace 退格、Enter 发射；← → 微调 ±1，↑ ↓ 微调 ±10。",
    help4: "4. 暗流关：前几投之后目标会漂移 ±k，包围圈会同步放宽——别把老边界当真，重新夹一次。猎物只会游向没投过浮标的刻度，不会漂到你已经占住的位置。",
    help5: "5. 谎灯关：整局恰有一次方向回波被倒置，但温度永远是真的。两条回波把区间压成空集时，就是谎灯现形了。",
    help6: "6. 浊流关：雾区（开局明示）内的投掷方向静默，只回温度。绕开雾区夹逼，别把鱼雷扔进浊流。",
    help7: "7. 挂件：声呐探针回报奇偶（1 投）、扫描线点亮包围圈半区（2 投）、回溯撤销上一投（不消耗）。R 重开本关。",
    helpClose: "我知道了",

    levelsTitle: "猎场图",
    levelsNote: "五章三十关，每章只加一种噪声；盲猎需主线全通后解锁。",
    lockedNote: "通关上一关解锁",
    blindNote: "通关三十关解锁",
    levelShort: "{ch} · {n}",

    rankAce: "声呐王牌",
    rankHunter: "老练猎手",
    rankDeckhand: "见习水手",
    rankNone: "空手而归",

    toastOut: "{n} 不在猎场范围内",
    toastRepeat: "{n} 已经投过了",
    toastEmpty: "先在拨盘上拨一个数",
    toastNoTool: "这件挂件用完了",
    toastNoRoom: "鱼雷不够了",
    toastNoRecall: "这一关的回溯已经用过",
    toastFog: "这一投落进浊流，没有回波",

    statCleared: "已通 {n} / {m}",
    statAces: "三星 {n} 关",
    statFewest: "单关最少 {n} 投",
  },
  en: {
    appTitle: "Guess",
    appKicker: "SONAR HUNT",
    back: "Back to portal",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to play",
    levels: "Hunting chart",

    ch1: "Still Water",
    ch2: "Undercurrent",
    ch3: "Lying Echo",
    ch4: "Murky Deep",
    ch5: "Leviathan",
    ch6: "Blind Hunt",

    hudChapter: "Chapter {n}",
    hudLevel: "Level {n}",
    hudRange: "Range",
    hudUsed: "Casts",
    hudTorpedo: "Torpedoes",
    hudBest: "Fewest casts",
    hudPar: "Par",
    hudEff: "Efficiency",
    hudBand: "Net",
    hudEcho: "Echo log",
    hudTools: "Sonar gear",

    mechCalm: "Still water: echoes tell the truth",
    mechDrift: "Undercurrent: target drifts ±{k} after the first {n} casts",
    mechLiar: "Lying echo: exactly one direction echo is inverted",
    mechFog: "Murk: {n} fog banks swallow the direction echo",
    mechBlind: "Blind hunt: no temperature readout",

    echoHigher: "Target is higher",
    echoLower: "Target is lower",
    echoSilent: "Murk swallowed the echo",
    echoHit: "Hit",
    echoLiar: "Lie",

    tempHot: "Hot",
    tempWarm: "Warm",
    tempCold: "Cold",
    tempOff: "No temp",

    btnFire: "Fire",
    btnDel: "Del",
    btnRecall: "Recall",
    btnProbe: "Probe",
    btnScan: "Scanline",
    btnRetry: "Hunt again",
    btnNext: "Next level",
    btnMap: "Chart",
    btnDive: "Dive in",
    btnResume: "Resume",

    toolProbeTip: "Costs 1 cast · reports odd or even",
    toolScanTip: "Costs 2 casts · lights one half of the net",
    toolRecallTip: "Undo the last cast (free)",

    probeOdd: "Target is odd",
    probeEven: "Target is even",
    scanLower: "Target is in the lower half",
    scanUpper: "Target is in the upper half",

    conflict: "Echo conflict · one of them was a lie",
    cornered: "Cornered · only one candidate left",
    pressure: "Net closing · {n} torpedoes left",
    silent: "No echo",

    readyKicker: "Deep-sea sonar hunt",
    readyTitle: "Guess",
    readyDesc: "A number hides below. Drop a buoy and the sonar answers only higher or lower, plus a temperature. Watch the net tighten inch by inch, then haul it out of the dark water.",
    readyHint: "Thirty levels, one new kind of noise per chapter: currents move the prey, a lying echo inverts itself, murk swallows your cast.",

    resultWin: "Target locked",
    resultLose: "Out of torpedoes",
    resultUsed: "Casts used",
    resultStars: "Hunter grade",
    resultTarget: "Target {n}",
    resultPar: "Par {n}",
    newBest: "New record",
    resultNoteWin: "The echo settles; bubbles rise to the surface.",
    resultNoteLose: "It was down there the whole time.",
    resultReveal: "The lie was cast number {n}",

    helpTitle: "How to play",
    help1: "1. Dial an integer in range and hit Fire: higher lights the starboard echo (right side goes dark), lower lights port.",
    help2: "2. Echoes carry temperature: hot ≤ 2% of the range, warm ≤ 8%, anything further is cold. The net glows accordingly.",
    help3: "3. Keyboard: 0-9 to dial, Backspace to delete, Enter to fire; ← → nudge ±1, ↑ ↓ nudge ±10.",
    help4: "4. Undercurrent: the target drifts ±k after the early casts and the net widens with it — re-clamp, don't trust stale edges. The prey only swims to marks you have not yet buoyed.",
    help5: "5. Lying echo: exactly one direction echo is inverted, but temperature is always honest. When two echoes squeeze the net to nothing, you've found the lie.",
    help6: "6. Murk: casts inside a fog bank (shown from the start) give no direction, only temperature. Clamp around the banks instead of firing into them.",
    help7: "7. Gear: Probe reports odd/even (1 cast), Scanline lights half the net (2 casts), Recall undoes the last cast (free). R restarts the level.",
    helpClose: "Got it",

    levelsTitle: "Hunting chart",
    levelsNote: "Five chapters of six; each chapter adds one kind of noise. Blind Hunt opens after the main thirty.",
    lockedNote: "Clear the previous level",
    blindNote: "Clear all thirty levels",
    levelShort: "{ch} · {n}",

    rankAce: "Sonar ace",
    rankHunter: "Seasoned hunter",
    rankDeckhand: "Deckhand",
    rankNone: "Empty net",

    toastOut: "{n} is out of range",
    toastRepeat: "{n} was already cast",
    toastEmpty: "Dial a number first",
    toastNoTool: "That piece of gear is spent",
    toastNoRoom: "Not enough torpedoes",
    toastNoRecall: "Recall already used this level",
    toastFog: "That cast landed in murk — no echo",

    statCleared: "Cleared {n} / {m}",
    statAces: "{n} three-star levels",
    statFewest: "Best single level: {n} casts",
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
    // 存储不可用则走浏览器语言
  }
  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
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
  if (!isLocale(locale)) return DEFAULT_LOCALE;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, locale);
  } catch {
    // 写入异常静默
  }
  return locale;
}

export function htmlLang(locale) {
  return isLocale(locale) && locale === "en" ? "en" : "zh-CN";
}

export function format(str, params) {
  if (typeof str !== "string") return "";
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

/** 把 data-i18n / data-i18n-title / data-i18n-aria 一次性刷进 DOM */
export function applyLocale(root, locale) {
  const s = strings(locale);
  if (!root || typeof root.querySelectorAll !== "function") return s;
  for (const el of root.querySelectorAll("[data-i18n]")) {
    const v = s[el.dataset.i18n];
    if (typeof v === "string" && v) el.textContent = v;
  }
  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    const v = s[el.dataset.i18nTitle];
    if (typeof v === "string" && v) el.setAttribute("title", v);
  }
  for (const el of root.querySelectorAll("[data-i18n-aria]")) {
    const v = s[el.dataset.i18nAria];
    if (typeof v === "string" && v) el.setAttribute("aria-label", v);
  }
  return s;
}
