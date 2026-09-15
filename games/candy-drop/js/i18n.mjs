// i18n.mjs: 割绳子全站共享语言偏好 doin.lang（zh/en 键值严格对齐、非空）

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "割绳子 · DOIN 在线小游戏",
    metaDesc:
      "割绳子：划断绳子，借重力与摆动把糖送进小怪兽糯糯嘴里，顺路捞起三颗星。普通绳、弹性绳、气泡、气垫、尖刺、自动绳与滑动锚轨轮番登场，5 盒共 40 关物理解谜，每关三星可解、绝无死局。",
    appTitle: "割绳子",
    appSubtitle: "糖锡铁盒街机",
    back: "返回门户",
    sound: "音效开关",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",
    stageAria: "糖锡铁盒街机舞台",
    canvasAria: "铁盒内部：糖果吊在绳上，小怪兽糯糯在下方的绒布上张嘴等待",

    hudBox: "第 {n} 盒",
    hudLevel: "第 {n} 关",
    hudStars: "本关星",
    hudBoxStars: "本盒星",
    hudScore: "总分",
    hudCuts: "已切绳",
    hudLevelValue: "第 {n} 关",
    hudStarCount: "{n} / 3 星",
    hudBoxProgress: "本盒 {n} / 24 星",

    tipTitle: "过关提示",
    handTitle: "操作台",
    handHint: "在绳上按住划一道，即可割断",
    btnPuff: "吹气",
    btnPop: "戳破",
    btnReset: "重来",
    btnHint: "提示",

    levelsTitle: "选择关卡",
    levelsAria: "关卡选择",
    levelsLocked: "通关前一关解锁",
    boxLabel: "第 {n} 盒",
    levelLabel: "第 {n} 关",
    boxLocked: "上一盒集齐 {n} 星解锁",
    boxLockedShort: "需 {n} 星",
    starCount: "{n} / 3 星",

    readyKicker: "CANDY DROP",
    readyTitle: "割绳子",
    readyDesc:
      "糖吊在绳上，糯糯在下面张着嘴。在绳子上划一刀，让糖借重力与摆动荡过去 —— 顺路把三颗星都吃掉，再稳稳落进嘴里。切得早一点、晚一点，弧线完全不同。",
    btnStart: "开始投喂",
    btnResume: "继续本关",
    btnLevels: "选择关卡",

    resultWinTitle: "糯糯吃到啦！",
    resultLoseTitle: "这次没接住…",
    resultScore: "本关得分",
    resultTotal: "累计总分",
    resultStars: "本关星级",
    resultTime: "用时",
    resultCuts: "切绳次数",
    newBest: "🏆 新高分！",
    starHint1: "★ 送进嘴里",
    starHint2: "★★ 路上吃 2 颗星",
    starHint3: "★★★ 三颗星全收",
    btnRetry: "再试一次",
    btnNext: "下一关",
    btnBackLevels: "返回关卡",

    loseSpike: "糖撞在尖刺上了",
    loseOut: "糖掉出了铁盒",
    loseSettled: "糖停住了，够不着嘴",

    boxCleared: "本盒通关！",
    gameCleared: "五盒全部通关，糯糯吃饱了！",

    helpTitle: "玩法说明",
    help1: "1. 用鼠标或手指在绳子上划一刀，绳断糖落。划到的绳子会立刻断开，可以同时划断多根。",
    help2: "2. 糖只会受重力与绳的牵引：切得早，糖带着摆速飞出去；切得晚，糖几乎是垂直落下。时机决定弧线。",
    help3: "3. 三颗星挂在路上，被糖碰到即收下。三星全收再进嘴才算完美通关。",
    help4: "4. 弹性绳被拉长后割断会把糖弹射出去；气泡会把糖托着往上浮，点「戳破」随时放掉。",
    help5: "5. 气垫（风箱）点「吹气」会喷出一股风把糖推开，有冷却时间；尖刺碰到即失败。",
    help6: "6. 后面几盒会出现自动绳（到点自动接上并回收）与滑动锚轨（拖动改变悬挂点）。糖长时间不动会被判定停住，本关失败。",
    helpClose: "我知道了",
  },
  en: {
    docTitle: "Candy Drop · DOIN Web Games",
    metaDesc:
      "Candy Drop: slice ropes and let gravity and swing carry the candy into Nuo-Nuo's mouth, grabbing three stars on the way. Plain ropes, elastic ropes, bubbles, bellows, spikes, auto ropes and sliding rails across 5 boxes and 40 physics puzzles — every stage is three-star solvable, never a dead end.",
    appTitle: "Candy Drop",
    appSubtitle: "Candy Tin Arcade",
    back: "Portal",
    sound: "Sound toggle",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to Play",
    stageAria: "Candy tin arcade stage",
    canvasAria: "Inside the tin: candy hangs from ropes while Nuo-Nuo waits on the velvet below with jaws open",

    hudBox: "Box {n}",
    hudLevel: "Stage {n}",
    hudStars: "Stars",
    hudBoxStars: "Box Stars",
    hudScore: "Score",
    hudCuts: "Ropes Cut",
    hudLevelValue: "Stage {n}",
    hudStarCount: "{n} / 3 stars",
    hudBoxProgress: "{n} / 24 in this box",

    tipTitle: "Stage Hint",
    handTitle: "Control Deck",
    handHint: "Drag across a rope to slice it",
    btnPuff: "Puff",
    btnPop: "Pop",
    btnReset: "Reset",
    btnHint: "Hint",

    levelsTitle: "Select Stage",
    levelsAria: "Stage select",
    levelsLocked: "Clear the previous stage to unlock",
    boxLabel: "Box {n}",
    levelLabel: "Stage {n}",
    boxLocked: "Collect {n} stars in the previous box to unlock",
    boxLockedShort: "Needs {n} stars",
    starCount: "{n} / 3 stars",

    readyKicker: "CANDY DROP",
    readyTitle: "Candy Drop",
    readyDesc:
      "The candy hangs by ropes and Nuo-Nuo waits below with jaws open. Slice a rope and let gravity and swing carry the candy across — sweep up all three stars on the way and drop it cleanly into the mouth. Cut a moment earlier or later and the arc changes completely.",
    btnStart: "Start Feeding",
    btnResume: "Resume",
    btnLevels: "Select Stage",

    resultWinTitle: "Nuo-Nuo Got It!",
    resultLoseTitle: "Missed This Time…",
    resultScore: "Stage Score",
    resultTotal: "Total Score",
    resultStars: "Stars Earned",
    resultTime: "Time",
    resultCuts: "Ropes Cut",
    newBest: "🏆 New Best!",
    starHint1: "★ Reach the mouth",
    starHint2: "★★ Eat 2 stars on the way",
    starHint3: "★★★ Sweep all three",
    btnRetry: "Try Again",
    btnNext: "Next Stage",
    btnBackLevels: "Back to Stages",

    loseSpike: "The candy hit a spike",
    loseOut: "The candy fell out of the tin",
    loseSettled: "The candy came to rest out of reach",

    boxCleared: "Box cleared!",
    gameCleared: "All five boxes cleared — Nuo-Nuo is full!",

    helpTitle: "How to Play",
    help1: "1. Drag across a rope with mouse or finger to slice it. Anything you swipe through snaps at once, and you can cut several ropes in one stroke.",
    help2: "2. The candy only obeys gravity and rope pull: cut early and it flies off with its swing speed, cut late and it drops almost straight down. Timing decides the arc.",
    help3: "3. Three stars hang along the route and are collected on contact. Sweep all three and still reach the mouth for a perfect clear.",
    help4: "4. An elastic rope launches the candy when cut while stretched; bubbles carry it upward — tap Pop to release it any time.",
    help5: "5. Bellows (Puff) blast a gust that pushes the candy away and have a cooldown; touching a spike fails the stage.",
    help6: "6. Later boxes add auto ropes (they attach on a timer and reel in) and sliding rails (drag to move the anchor). If the candy sits still too long it counts as settled and the stage is lost.",
    helpClose: "Got It",
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
  return isLocale(locale) && locale === "en" ? "en" : "zh-CN";
}

export function format(str, params) {
  if (typeof str !== "string") return "";
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}
