// unravel i18n — bilingual center. Shared language preference: doin.lang (zh/en).

const STORE_KEY = "doin.lang";

export const strings = {
  zh: {
    docTitle: "拆毛线解压 · DOIN 在线小游戏",
    appTitle: "拆毛线解压",
    backHome: "← 门户",
    btnLevels: "选关",
    btnRelax: "自由拆",
    btnLevel: "闯关",
    btnUndo: "撤销",
    btnHint: "提示",
    btnRestart: "重开",
    btnNext: "下一关",
    btnReplay: "再来一次",
    btnClose: "关闭",
    btnStart: "开拆",
    btnSoundOn: "音效开关",
    btnHelp: "玩法说明",
    modeLevel: "闯关模式",
    modeRelax: "解压自由拆",
    hudLevel: "第 {n} 关",
    hudRelax: "自由拆",
    hudTime: "用时 {t}",
    hudUndos: "撤销 {n}",
    hudSlots: "槽位 {n}/{c}",
    slotLabel: "收线槽",
    levelsTitle: "选择关卡",
    chapter1: "第一章 · 毛线团",
    chapter2: "第二章 · 毛衣围巾",
    chapter3: "第三章 · 毛线玩偶",
    chapter4: "第四章 · 毛线花园",
    levelNum: "第 {n} 关",
    levelLocked: "未解锁",
    winTitle: "解开啦！",
    winRelaxTitle: "拆得干干净净",
    loseTitle: "槽位满了",
    loseBody: "没有空槽位可以继续收线了，撤销几步或重新开始吧。",
    statTime: "用时",
    statUndos: "撤销",
    statPeak: "槽位峰值",
    helpTitle: "玩法说明",
    helpRule1: "点击下方线盘或直接点织物上的毛线收走同色线，上层线压住下层线，被压住的线要等上面的先收走；悬停可互相对照线盘与线头。",
    helpRule2: "收进槽位的毛线凑满 3 个同色自动合成毛线球并腾出格子；槽位全满则失败。",
    helpRule3: "带结扣的线要先点一下解开结扣才能收；双色线会占两个槽位。",
    helpRule4: "快捷键：数字键选可收线盘、U 撤销、H 提示、L 选关、R 重开。",
    toastNoFree: "暂时没有可收的线头",
    toastNoUndo: "没有可以撤销的步骤",
    toastHint: "试试高亮的线盘",
    color_red: "绯红",
    color_amber: "琥珀",
    color_teal: "青瓷",
    color_indigo: "靛蓝",
    color_rose: "蔷薇",
    color_moss: "苔绿",
    spoolFree: "可收",
    spoolBlocked: "被压住",
    spoolKnot: "带结扣",
    spoolAria: "{color}线盘 · {state}",
    starsAria: "{n} 颗星",
    bestLabel: "最佳",
  },
  en: {
    docTitle: "Unravel Yarn · DOIN Web Games",
    appTitle: "Unravel Yarn",
    backHome: "← Portal",
    btnLevels: "Levels",
    btnRelax: "Relax",
    btnLevel: "Levels",
    btnUndo: "Undo",
    btnHint: "Hint",
    btnRestart: "Restart",
    btnNext: "Next",
    btnReplay: "Replay",
    btnClose: "Close",
    btnStart: "Unravel",
    btnSoundOn: "Toggle sound",
    btnHelp: "How to play",
    modeLevel: "Level Mode",
    modeRelax: "Relax Mode",
    hudLevel: "Level {n}",
    hudRelax: "Relax",
    hudTime: "Time {t}",
    hudUndos: "Undos {n}",
    hudSlots: "Slots {n}/{c}",
    slotLabel: "Slots",
    levelsTitle: "Choose a Level",
    chapter1: "Chapter 1 · Yarn Balls",
    chapter2: "Chapter 2 · Sweater",
    chapter3: "Chapter 3 · Yarn Doll",
    chapter4: "Chapter 4 · Yarn Garden",
    levelNum: "Level {n}",
    levelLocked: "Locked",
    winTitle: "Unraveled!",
    winRelaxTitle: "All clean",
    loseTitle: "Slots Full",
    loseBody: "No free slot left to pull a strand. Undo a few steps or restart.",
    statTime: "Time",
    statUndos: "Undos",
    statPeak: "Peak slots",
    helpTitle: "How to Play",
    helpRule1: "Tap a spool — or the yarn itself on the tangle — to pull it. Upper strands press on lower ones; free the ones above first. Hover pairs a spool with its strand.",
    helpRule2: "Three chips of one color merge into a yarn ball and free their slots; a full rack ends the run.",
    helpRule3: "Knotted strands must be untied first; two-tone strands take two slots.",
    helpRule4: "Keys: number keys pick a free spool, U undo, H hint, L levels, R restart.",
    toastNoFree: "No pullable strand right now",
    toastNoUndo: "Nothing to undo",
    toastHint: "Try the glowing spool",
    color_red: "Crimson",
    color_amber: "Amber",
    color_teal: "Teal",
    color_indigo: "Indigo",
    color_rose: "Rose",
    color_moss: "Moss",
    spoolFree: "free",
    spoolBlocked: "pressed",
    spoolKnot: "knotted",
    spoolAria: "{color} spool · {state}",
    starsAria: "{n} stars",
    bestLabel: "Best",
  },
};

let currentLang = null;

function detectLang() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return "zh";
}

export function getLang() {
  if (!currentLang) currentLang = detectLang();
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang === "en" ? "en" : "zh";
  try {
    localStorage.setItem(STORE_KEY, currentLang);
  } catch {
    /* silent */
  }
  return currentLang;
}

export function htmlLang(lang) {
  return lang === "en" ? "en" : "zh-CN";
}

export function translate(key, vars) {
  const lang = getLang();
  const dict = strings[lang] || strings.zh;
  let text = dict[key] !== undefined ? dict[key] : strings.zh[key];
  if (text === undefined) return key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      text = text.split(`{${k}}`).join(String(vars[k]));
    }
  }
  return text;
}
