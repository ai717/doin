// i18n.mjs —— 中英双语表，语言偏好统一读写全站共享 key localStorage["doin.lang"]。
// 英文表绝无汉字（langSwitch 白名单除外）；数据层只用字符串 key，展示文本 100% 走本表。

export const LANG_KEY = "doin.lang";
export const LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "zh";

const DICT = {
  zh: {
    appTitle: "积木爆破",
    appSub: "8×8 拖放拼块 · 满行列爆破",
    docTitle: "积木爆破 · DOIN 在线小游戏",
    metaDesc: "把糖果霓虹拼块拖进 8×8 网格，填满任意整行整列就玻璃爆破——行与列可同爆触发十字共鸣，连击音阶上行，无计时无道具，即开即玩。",
    back: "返回门户",
    sound: "音效",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法",

    hudScore: "总分",
    hudBest: "最高分",
    hudCombo: "连击",
    hudMaxCombo: "最高连击",
    hudRows: "消除",
    hudCross: "十字",
    hudDifficulty: "当前难度",

    actRotate: "旋转",
    actReset: "重开",
    actDifficulty: "难度",
    actPlace: "放置",
    actPick: "取块",

    difficultyTitle: "选择难度",
    difficultyNote: "三档难度无尽冲分，最高分按难度分别记录。",
    diffEasy: "休闲",
    diffNormal: "标准",
    diffHard: "大师",
    diffEasyDesc: "空盘起步，块序温和，适合熟悉规则。",
    diffNormalDesc: "6 格起手障碍，块序均衡。",
    diffHardDesc: "12 格起手障碍，大块频出，冲分极限。",
    statBest: "最高分 {n}",

    resultTitle: "本局结算",
    resultScore: "总分",
    resultRows: "消除行数",
    resultCross: "十字共鸣",
    resultMaxCombo: "最高连击",
    resultDifficulty: "难度",
    btnAgain: "再来一局",
    btnDifficulty: "换难度",
    btnClose: "看看盘面",

    overStuck: "放不下了",
    toastNoPlace: "这里放不下",
    toastCross: "十字共鸣！",
    toastCombo: "{n} 连击！",
    toastRecord: "新纪录！",
    toastRotOnTray: "拖入网格后朝向已锁定，Esc 取出后可旋转",

    helpTitle: "玩法说明",
    help1: "1. 点击或拖动展示柜托盘里的拼块，放到 8×8 网格空位；旋转请在托盘区进行（右键 / 滚轮悬停托盘 / R 键），拖入网格后朝向锁定。",
    help2: "2. 任意整行或整列填满即玻璃爆破——行与列可同时命中，触发十字共鸣（额外 +25）。",
    help3: "3. 计分：每放 1 格 +1，每消 1 行/列 +10，纯爆款原味口径。",
    help4: "4. 连续「放置即消」累计连击，放置未消则清零；连击越高彩纸越密、音阶越高。",
    help5: "5. 三块队列自由选择放置顺序；三块都放不下时，本局结束。",
    help6: "6. 键盘：1/2/3 取块，方向键移动预览，R 旋转，空格放置，Esc 取消。",
    help7: "7. 三档难度无尽冲分：休闲空盘起步、标准带起手障碍、大师大块频出；最高分按难度分别记录。",
    helpClose: "开始游戏",

    boardLabel: "8×8 拼块板",
    queueLabel: "三块队列",
    stageLabel: "霓虹积木工坊",
  },
  en: {
    appTitle: "Block Blast",
    appSub: "8x8 Drop & Blast",
    docTitle: "Block Blast · DOIN Online Mini Games",
    metaDesc: "Drag candy-neon pieces into the 8x8 grid and blast any full row or column into glass shards and confetti. Rows and columns can pop together for Cross Resonance, combos climb the scale, and there is no timer and no power-ups.",
    back: "Back to portal",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to play",

    hudScore: "Score",
    hudBest: "Best",
    hudCombo: "Combo",
    hudMaxCombo: "Best combo",
    hudRows: "Cleared",
    hudCross: "Cross",
    hudDifficulty: "Difficulty",

    actRotate: "Rotate",
    actReset: "Restart",
    actDifficulty: "Difficulty",
    actPlace: "Place",
    actPick: "Pick",

    difficultyTitle: "Choose difficulty",
    difficultyNote: "Three difficulties, endless run; best score is tracked per difficulty.",
    diffEasy: "Relaxed",
    diffNormal: "Standard",
    diffHard: "Master",
    diffEasyDesc: "Empty board, gentle piece order; learn the rules.",
    diffNormalDesc: "6 starting blockers, balanced piece order.",
    diffHardDesc: "12 starting blockers, big pieces galore; the score chase.",
    statBest: "Best {n}",

    resultTitle: "Round settled",
    resultScore: "Score",
    resultRows: "Rows cleared",
    resultCross: "Cross resonance",
    resultMaxCombo: "Best combo",
    resultDifficulty: "Difficulty",
    btnAgain: "Play again",
    btnDifficulty: "Change difficulty",
    btnClose: "View board",

    overStuck: "Nothing fits",
    toastNoPlace: "Does not fit here",
    toastCross: "Cross resonance!",
    toastCombo: "{n} combo!",
    toastRecord: "New record!",
    toastRotOnTray: "Orientation locks once dragged onto the grid; press Esc to take it back and rotate",

    helpTitle: "How to play",
    help1: "1. Click or drag a piece from the cabinet tray onto an empty cell; rotate over the tray only (right-click, scroll over the tray, or press R). The orientation locks once you drag onto the grid.",
    help2: "2. Fill any full row or column and it blasts into glass shards - a row and a column can pop together for Cross Resonance (+25).",
    help3: "3. Scoring: +1 per cell placed, +10 per cleared row or column - the classic flavor.",
    help4: "4. Consecutive clearing placements build a combo; a dry placement resets it. Higher combos mean denser confetti and a rising scale.",
    help5: "5. The triple queue is free-order; the round ends when none of the three pieces fits anywhere.",
    help6: "6. Keyboard: 1/2/3 pick, arrows move the preview, R rotates, Space places, Esc cancels.",
    help7: "7. Three difficulties, endless run: Relaxed starts empty, Standard adds starting blockers, Master floods big pieces. Best score is tracked per difficulty.",
    helpClose: "Start playing",

    boardLabel: "8x8 piece board",
    queueLabel: "Triple queue",
    stageLabel: "Neon Block Workshop",
  },
};

export function isLocale(locale) {
  return typeof locale === "string" && LOCALES.includes(locale);
}

export function strings(locale) {
  return DICT[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function format(str, params) {
  if (typeof str !== "string") return "";
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

export function detectLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    }
  } catch {
    /* ignore */
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
    /* ignore */
  }
  return locale;
}

export function htmlLang(locale) {
  return isLocale(locale) && locale === "en" ? "en" : "zh-CN";
}

/** 原地热更新：遍历 [data-i18n] / [data-i18n-title] / [data-i18n-aria]，绝不刷新页面 */
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
