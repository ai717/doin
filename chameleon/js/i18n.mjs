// i18n.mjs —— 中英双语表，语言偏好统一读写全站共享 key localStorage["doin.lang"]

export const LANG_KEY = "doin.lang";
export const LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "zh";

const DICT = {
  zh: {
    appTitle: "变色躲猫猫",
    appKicker: "变色伪装 · 回合博弈",
    back: "返回门户",
    sound: "音效",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",
    levels: "猎手战役",

    modeLabel: "选择模式",
    modeDuel: "同屏双人",
    modeDuelDesc: "6+6 回合角色轮换，总比分定胜负。",
    modeHunt: "单人猎手",
    modeHuntDesc: "5 档 AI 变色龙，抓得越快星级越高。",
    modePractice: "练习观察台",
    modePracticeDesc: "自己藏、自己找，细看融合度与波纹。",
    modeStart: "开局",

    roleChameleon: "变色龙",
    roleHunter: "猎手",
    roleSwap: "角色轮换",

    phaseReveal: "揭幕观察",
    phaseLight: "光相位轮转",
    phaseCamo: "伪装阶段",
    phaseObserve: "观察阶段",
    phaseSettle: "回合结算",
    curtainClose: "侦察员请闭眼",
    curtainGo: "变色龙行动",

    hudBlend: "融合度",
    hudHeat: "异常热度",
    hudProbe: "侦察点",
    hudRound: "回合",
    hudScore: "比分",
    hudPhase: "阶段",
    hudRipple: "波纹",
    hudCaught: "抓获",
    hudSurvival: "存活分",
    hudP1: "玩家 1",
    hudP2: "玩家 2",
    hudSudden: "突然死亡",

    actScan: "扫探",
    actAccuse: "指认",
    actPass: "放弃",
    actMove: "移动",
    actRecolor: "换色",
    actRefine: "精调",
    actColor: "变色盘",

    toastScan: "热度 {n}",
    toastCaught: "指认命中！变色龙落网。",
    toastWrong: "指错了——变色龙 +1。",
    toastPass: "你放弃了本回合。",
    toastNoProbe: "侦察点用完了",
    toastOutOfProbes: "侦察点已用完，点「放弃」结束本回合",
    toastCamo: "幕布阶段，输入已锁定",
    heatHot: "可疑",
    heatCold: "平常",

    readyTitle: "变色躲猫猫",
    readyKicker: "萤火丛林侦察手账",
    readyDesc: "变色龙混进萤光集会，向邻域颜色收敛伪装；猎手闭眼后扫探、圈记、指认。谁先看穿谁？",
    readyHint: "移动会留波纹破绽，精调能提融合度；藏得越深，动得越少。",

    resultTitle: "对局结算",
    resultWin: "胜者",
    resultP1: "玩家 1 获胜",
    resultP2: "玩家 2 获胜",
    resultTie: "平局",
    resultHuntCaught: "变色龙落网",
    resultHuntEscaped: "让它溜了",
    resultStars: "猎手评级",
    resultRounds: "抓获回合",
    resultWrong: "误指次数",
    resultTotal: "总比分",
    btnAgain: "再来一局",
    btnNextLevel: "下一关",
    btnLevels: "猎手战役",
    btnReadyModes: "换模式",

    newBest: "新纪录",
    levelShort: "第 {id} 关 · {ai}",
    lockedNote: "通关上一关解锁",
    levelsTitle: "猎人战役",
    levelsNote: "五档 AI × 两盘棋盘，共十关；抓得越快星级越高。",
    statCleared: "已通 {n} / {m}",
    statStars: "总星 {n}",

    ai_1: "侦察新手",
    ai_2: "林间搜寻者",
    ai_3: "老练伏击者",
    ai_4: "暗影潜伏者",
    ai_5: "伪装大师",

    rankThree: "伪装猎神",
    rankTwo: "资深警探",
    rankOne: "见习观察员",
    rankNone: "空手而归",

    helpTitle: "玩法说明",
    help1: "1. 每回合分三段：揭幕观察 → 光相位轮转 → 伪装阶段（幕布落下，变色龙行动）。",
    help2: "2. 变色龙：点击相邻格移动（限 1 步，起落点留波纹破绽），点变色盘换色，点自己精调（+融合度）。",
    help3: "3. 猎手：睁眼后消耗侦察点扫探任意格，会得到带噪声的异常热度；融合度越低热度越高。",
    help4: "4. 指认消耗 1 侦察点：命中 = 抓获（猎手 +3），指错 = 变色龙 +1 且失去剩余侦察点；也可放弃。",
    help5: "5. 移动留下的波纹在观察阶段会渐隐显影，是猎手的第一线索——藏与活永远二选一。",
    help6: "6. 双人模式：6 回合后互换角色再战 6 回合，总比分高者胜；平局进入突然死亡回合。",
    help7: "7. 键盘：↑↓←→ / WASD 移动，1-5 直接选色，空格精调，Enter 指认，Esc 放弃。",
    help8: "8. 练习观察台：无指认压力，自己藏、自己找，静看融合度、波纹与光相位三者如何咬合。",
    help9: "9. 观察阶段变色龙会周期性「呼吸」——轮廓微胀微缩；融合度越低越明显，这是肉眼可捕捉的第二条线索。",
    helpClose: "我知道了",
  },
  en: {
    appTitle: "Chameleon Hide",
    appKicker: "CAMOUFLAGE DUEL",
    back: "Back to portal",
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to play",
    levels: "Hunt the Impostor",

    modeLabel: "Choose a mode",
    modeDuel: "Chameleon Duel",
    modeDuelDesc: "6+6 rounds with a role swap; highest total wins.",
    modeHunt: "Hunt the Impostor",
    modeHuntDesc: "Five AI chameleons; catch them fast for more stars.",
    modePractice: "Practice Blind",
    modePracticeDesc: "Hide and find yourself; study blend, ripple and light phase.",
    modeStart: "Start",

    roleChameleon: "Chameleon",
    roleHunter: "Hunter",
    roleSwap: "Role swap",

    phaseReveal: "Reveal",
    phaseLight: "Light phase",
    phaseCamo: "Camouflage",
    phaseObserve: "Observe",
    phaseSettle: "Settle",
    curtainClose: "Hunter, close your eyes",
    curtainGo: "Chameleon, move",

    hudBlend: "Blend",
    hudHeat: "Heat",
    hudProbe: "Probes",
    hudRound: "Round",
    hudScore: "Score",
    hudPhase: "Phase",
    hudRipple: "Ripple",
    hudCaught: "Caught",
    hudSurvival: "Survival",
    hudP1: "Player 1",
    hudP2: "Player 2",
    hudSudden: "Sudden death",

    actScan: "Scan",
    actAccuse: "Accuse",
    actPass: "Pass",
    actMove: "Move",
    actRecolor: "Recolor",
    actRefine: "Refine",
    actColor: "Color pad",

    toastScan: "Heat {n}",
    toastCaught: "Accused right! The chameleon is caught.",
    toastWrong: "Wrong guess — chameleon +1.",
    toastPass: "You passed this round.",
    toastNoProbe: "No probes left",
    toastOutOfProbes: "No probes left — tap Pass to end the round",
    toastCamo: "Curtain phase, input locked",
    heatHot: "Suspicious",
    heatCold: "Calm",

    readyTitle: "Chameleon Hide",
    readyKicker: "Firefly Field Journal",
    readyDesc: "A chameleon blends into a firefly gathering, converging its hue toward the neighbors. The hunter closes their eyes, scans, circles and accuses — who sees through whom first?",
    readyHint: "Moving leaves a ripple tell; refining raises blend. The deeper you hide, the less you move.",

    resultTitle: "Round settled",
    resultWin: "Winner",
    resultP1: "Player 1 wins",
    resultP2: "Player 2 wins",
    resultTie: "Draw",
    resultHuntCaught: "Chameleon caught",
    resultHuntEscaped: "It slipped away",
    resultStars: "Hunter grade",
    resultRounds: "Rounds to catch",
    resultWrong: "Wrong accuses",
    resultTotal: "Total score",
    btnAgain: "Play again",
    btnNextLevel: "Next level",
    btnLevels: "Hunt campaign",
    btnReadyModes: "Change mode",

    newBest: "New record",
    levelShort: "Table {id} · {ai}",
    lockedNote: "Clear the previous level",
    levelsTitle: "Hunt Campaign",
    levelsNote: "Five AI tiers across two boards, ten levels; catch fast for more stars.",
    statCleared: "Cleared {n} / {m}",
    statStars: "{n} stars total",

    ai_1: "Scout",
    ai_2: "Searcher",
    ai_3: "Ambusher",
    ai_4: "Shade",
    ai_5: "Master",

    rankThree: "Impostor Hunter",
    rankTwo: "Seasoned Detective",
    rankOne: "Trainee Watcher",
    rankNone: "Empty net",

    helpTitle: "How to play",
    help1: "1. Each round has three beats: reveal, light-phase shift, then camouflage (the curtain falls and the chameleon acts).",
    help2: "2. Chameleon: click an adjacent cell to move (once, leaving a ripple on both ends), tap the color pad to recolor, or click yourself to refine (+blend).",
    help3: "3. Hunter: spend probes to scan any cell and read a noisy anomaly heat; lower blend reads hotter.",
    help4: "4. Accusing costs one probe: correct = caught (hunter +3), wrong = chameleon +1 and you lose your remaining probes. You can also pass.",
    help5: "5. Ripples left by movement fade in during observe — the hunter's first clue. Hiding and moving always trade off.",
    help6: "6. Duel: after 6 rounds you swap roles for 6 more; highest total wins. A tie triggers a sudden-death round.",
    help7: "7. Keys: arrows / WASD to move, 1-5 to pick a color, Space to refine, Enter to accuse, Esc to pass.",
    help8: "8. Practice: no accusation pressure — hide and find yourself while blend, ripple and light phase interlock.",
    help9: "9. During observe the chameleon 'breathes' — its outline pulses subtly, more visible the lower its blend; a second tell your eye can catch.",
    helpClose: "Got it",
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