// Bilingual strings and in-place locale switching. Shared key: doin.lang.
// The English table has no Han characters except the language-switch marker.

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "双人点球大战 · DOIN 在线小游戏",
    metaDesc: "五轮点球对决，射手选九宫格落点与力度，门将预判扑救。单人对 AI 三档难度或同屏双人保密对决，突然死亡定胜负，即开即玩。",
    title: "双人点球大战",
    lede: "九宫格落点 · 五轮定胜负",
    backHome: "返回门户",
    stageBar: "游戏控制栏",
    modes: "模式",
    modeSolo: "单人对 AI",
    modeDuo: "同屏双人",
    difficulty: "难度",
    aiNovice: "新手",
    aiSkilled: "进阶",
    aiMaster: "大师",
    first: "先手",
    goFirst: "我先射",
    goSecond: "我先守",
    sideA: "玩家一",
    sideB: "玩家二",
    you: "你",
    cpu: "电脑",
    pause: "暂停",
    resume: "继续",
    sound: "音效",
    mute: "音效开",
    muted: "静音",
    langLabel: "Switch to English",
    langShort: "EN",
    targetZone: "落点区",
    zoneTL: "左上",
    zoneTC: "中上",
    zoneTR: "右上",
    zoneML: "左中",
    zoneMC: "中中",
    zoneMR: "右中",
    zoneBL: "左下",
    zoneBC: "中下",
    zoneBR: "右下",
    power: "力度",
    tap: "轻推",
    drive: "抽射",
    blast: "爆射",
    dive: "扑救方向",
    odds: "力度规则",
    oddsTap: "轻推：扑对必被扑出 · 不会打偏",
    oddsDrive: "抽射：扑对五成扑出 · 不会打偏",
    oddsBlast: "爆射：扑对两成扑出 · 两成五打偏",
    shooterTurn: "轮到射手 · 选落点与力度",
    keeperTurn: "轮到门将 · 选扑救方向",
    aiThinking: "门将正在判断……",
    locked: "已锁定 · 等待揭晓",
    handoffTitle: "交给门将",
    handoffHint: "射手选择已遮蔽 · 请把设备交给守门员",
    handoffBtn: "我是门将",
    handoffBack: "改选落点",
    round: "第 {0} 轮",
    suddenDeath: "突然死亡",
    score: "比分",
    resultGoal: "进球",
    resultSave: "扑出",
    resultWide: "打偏",
    byGoal: "{0} 破门！",
    bySave: "{0} 扑出了这一球",
    byWide: "{0} 打偏了",
    statusReady: "选一个落点区，再定力度",
    shootNow: "射门！",
    continueNext: "继续下一球",
    keeperPrompt: "选扑救方向",
    revealing: "揭晓中……",
    aiPreparing: "对手准备中……",
    chooseZonePower: "先选落点与力度",
    statusReveal: "射门揭晓中……",
    statusDone: "全场结束",
    pauseTitle: "已暂停",
    pauseHint: "射门动画已定格 · 回来后从当前帧继续",
    restart: "重新开局",
    resultTitle: "终场哨响",
    resultWin: "{0} 获胜",
    resultDraw: "平局",
    resultSub: "五轮点球 · {0} 粒进球 · {1} 次扑救",
    stars: "本场评级",
    nextPong: "去玩街机乒乓",
    replay: "再来一局",
    close: "关闭",
    keyHelp: "数字 1-9 选落点 · Q/W/E 选力度 · 方向键选扑救 · P/Esc 暂停",
    ariaGoal: "球门九宫格",
    ariaPower: "力度选择",
    ariaDive: "扑救方向选择",
    ariaBoard: "计分托盘",
    ariaDrawer: "模式抽屉",
    ariaStatus: "对局状态",
    ariaZone: "第 {0} 号落点区",
    noscript: "需要启用 JavaScript 才能玩点球大战。",
  },
  en: {
    docTitle: "Penalty Shootout · DOIN Games",
    metaDesc: "A five-round penalty duel. Pick a zone and power, then guess the dive. Solo against three AI levels or a secret same-screen two-player match. Sudden death settles a tie. Instant play.",
    title: "Penalty Shootout",
    lede: "Nine zones · five rounds to decide",
    backHome: "Portal",
    stageBar: "Game controls",
    modes: "Modes",
    modeSolo: "Solo vs AI",
    modeDuo: "Two Players",
    difficulty: "Level",
    aiNovice: "Novice",
    aiSkilled: "Skilled",
    aiMaster: "Master",
    first: "First",
    goFirst: "Shoot first",
    goSecond: "Keep first",
    sideA: "Player One",
    sideB: "Player Two",
    you: "You",
    cpu: "CPU",
    pause: "Pause",
    resume: "Resume",
    sound: "Sound",
    mute: "Sound on",
    muted: "Muted",
    langLabel: "\u5207\u6362\u5230\u4e2d\u6587",
    langShort: "\u4e2d\u6587",
    targetZone: "Target zone",
    zoneTL: "Top left",
    zoneTC: "Top centre",
    zoneTR: "Top right",
    zoneML: "Mid left",
    zoneMC: "Mid centre",
    zoneMR: "Mid right",
    zoneBL: "Bottom left",
    zoneBC: "Bottom centre",
    zoneBR: "Bottom right",
    power: "Power",
    tap: "Tap",
    drive: "Drive",
    blast: "Blast",
    dive: "Dive direction",
    odds: "Power rules",
    oddsTap: "Tap: always saved when read · never wide",
    oddsDrive: "Drive: 50% saved when read · never wide",
    oddsBlast: "Blast: 20% saved when read · 25% wide",
    shooterTurn: "Shooter's turn · pick a zone and power",
    keeperTurn: "Keeper's turn · pick a dive",
    aiThinking: "Keeper is reading the play...",
    locked: "Locked · awaiting the reveal",
    handoffTitle: "Pass to the keeper",
    handoffHint: "The shot is hidden · hand the device to the goalkeeper",
    handoffBtn: "I am the keeper",
    handoffBack: "Change target",
    round: "Round {0}",
    suddenDeath: "Sudden death",
    score: "Score",
    resultGoal: "Goal",
    resultSave: "Save",
    resultWide: "Wide",
    byGoal: "{0} scores!",
    bySave: "{0} makes the save",
    byWide: "{0} sends it wide",
    statusReady: "Pick a target zone, then set the power",
    shootNow: "Shoot!",
    continueNext: "Next kick",
    keeperPrompt: "Pick a dive",
    revealing: "Revealing...",
    aiPreparing: "Opponent is readying...",
    chooseZonePower: "Choose a zone and power first",
    statusReveal: "Revealing the shot...",
    statusDone: "Full time",
    pauseTitle: "Paused",
    pauseHint: "The shot is frozen · it resumes from this frame",
    restart: "Restart",
    resultTitle: "Full time",
    resultWin: "{0} wins",
    resultDraw: "A draw",
    resultSub: "Five rounds · {0} goals · {1} saves",
    stars: "Match rating",
    nextPong: "Play Arcade Pong",
    replay: "Play again",
    close: "Close",
    keyHelp: "Keys 1-9 pick zone · Q/W/E set power · arrows dive · P/Esc pause",
    ariaGoal: "Goal mouth nine zones",
    ariaPower: "Power choice",
    ariaDive: "Dive direction choice",
    ariaBoard: "Scoreboard tray",
    ariaDrawer: "Mode drawer",
    ariaStatus: "Match status",
    ariaZone: "Target zone {0}",
    noscript: "JavaScript is required to play Penalty Shootout.",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

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
  } catch (error) {
    return null;
  }
}

export function loadLocale() {
  const saved = readStore()?.getItem(LANG_KEY);
  return isLocale(saved) ? saved : detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return false;
  try {
    readStore()?.setItem(LANG_KEY, locale);
    return true;
  } catch (error) {
    return false;
  }
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}

// In-place DOM update: never reloads and never touches the match controller.
// A render callback may repaint the current frame, but state stays identical.
export function applyLocale(locale, renderCurrentFrame) {
  const chosen = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = strings(chosen);
  saveLocale(chosen);
  if (typeof document !== "undefined") {
    document.documentElement.lang = htmlLang(chosen);
    document.title = t.docTitle;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t[key] !== undefined) el.textContent = t[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (t[key] !== undefined) el.setAttribute("aria-label", t[key]);
    });
    const langBtn = document.getElementById("btn-lang");
    if (langBtn) langBtn.textContent = t.langShort;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", t.metaDesc);
  }
  if (typeof renderCurrentFrame === "function") renderCurrentFrame();
  return chosen;
}
