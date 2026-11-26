// i18n.mjs — 中英双语中心，统一读写全站共享偏好 localStorage["doin.lang"]。
// 键值严格对齐、非空；英文表零汉字（语言切换按钮标识除外）。

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "是男人就下一百层 · DOIN 在线小游戏",
    metaDesc:
      "是男人就下一百层：头顶尖刺天花板步步紧压，脚下深渊不断上涌，在岩板、弹簧、尖刺、传送带与碎裂板之间疾速下潜。23 关地质深渊、经典百层长跑与无尽深渊三模式，120Hz 固定步长物理。",
    appTitle: "深渊百层",
    appSubtitle: "微缩矿坑竖井",
    back: "返回门户",
    sound: "音效开关",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",
    levelsBtn: "选关",
    restart: "重来",
    pause: "暂停",
    pauseTitle: "已暂停",
    pauseKicker: "竖井冻结",
    pauseDesc: "下潜已冻结，喘口气再继续。当前深度、生命与机关全部原样保留。",
    btnResume: "继续下潜",
    btnPauseRestart: "重来本局",
    stageAria: "深渊百层竖井机台",
    canvasAria: "矿坑竖井中，探险者在下落跳板之间左右腾挪下潜",

    modeCampaign: "深渊关卡",
    modeClassic: "经典百层",
    modeEndless: "无尽深渊",
    modeAria: "选择玩法模式",

    hudDepth: "下潜深度",
    hudDepthUnit: "层",
    hudFloor: "当前层",
    hudLife: "生命",
    hudHpValue: "{hp} / {max}",
    hudGoal: "目标深度",
    hudGoalValue: "{n} / {total}",
    hudBest: "最佳纪录",
    hudStars: "累计星星",
    hudBestDepth: "最深纪录",
    hudSpeed: "下坠速度",
    hudSpeedUnit: "px/s",
    hudRadar: "地质声纳",
    hudClassicGoal: "百层长跑",

    radarClear: "下方暂无机关",
    radarNone: "视野已到井底",
    radarNormal: "普通岩板",
    radarSpring: "弹簧跳板",
    radarSpike: "尖刺陷阱",
    radarCrumble: "碎裂晶板",
    radarConveyor: "传送带",
    radarGoal: "金盾升降机",
    radarDistance: "约 {n}px",

    keyHint: "【A/D 或 ←/→】左右移动　【S / ↓】俯冲加速",
    touchLeft: "向左移动",
    touchRight: "向右移动",
    touchDive: "快速俯冲",

    levelsTitle: "深渊关卡",
    levelsAria: "关卡选择",
    levelLocked: "通关前一关后解锁",
    chapter1: "地表废矿",
    chapter2: "地热岩洞",
    chapter3: "蒸汽工坊",
    chapter4: "幽光晶洞",
    chapter5: "地心核炉",
    chapterLabel: "第 {n} 章",
    levelLabel: "第 {n} 关",
    starCount: "{n} / 3 ★",
    levelsProgress: "{n} / {total} ★",
    btnClose: "返回",

    resultWinTitle: "踩上金盾升降机！",
    resultLostHpTitle: "生命耗尽…",
    resultLostVoidTitle: "跌入万丈深渊…",
    resultClassicTitle: "百层长跑结算",
    resultEndlessTitle: "无尽深渊结算",
    resultDepth: "下潜深度",
    resultHp: "剩余生命",
    resultTime: "用时",
    resultScore: "最终得分",
    resultStars: "本关星级",
    resultTimeValue: "{n} 秒",
    resultDepthValue: "{n} 层",
    resultBest: "新纪录！",
    btnRetry: "再下一次",
    btnNext: "下一关",
    btnAgain: "再来一局",
    btnLevelsResult: "选择关卡",
    starHint1: "★ 抵达金盾升降机",
    starHint2: "★★ 剩余生命 ≥ 50%",
    starHint3: "★★★ 剩余生命 ≥ 67% 且用时 ≤ {n} 秒",

    helpTitle: "玩法说明",
    help1: "1. 头顶的液压尖刺会持续下压，脚下深渊不断上涌：只有不停向下踩板才能活命。",
    help2: "2. 方向键【←/→】或【A/D】左右移动，空中同样可以变向；按住【S/↓】俯冲加速下坠。",
    help3: "3. 踩中普通岩板回复 1 点生命（每块板只回一次）；生命上限 12 点，被顶刺挤压每秒扣 10 点。",
    help4: "4. 踩中尖刺板扣 5 点生命，但在无处落脚时它是唯一的救命缓冲。",
    help5: "5. 弹簧板会把您高抛向天花板，落地前务必左右闪避；传送带会持续把您往一个方向推。",
    help6: "6. 碎裂晶板只能支撑 0.25 秒，一触即走；停步太久会跟随碎板一起坠入深渊。",
    help7: "7. 踩上发光的金盾升降机即通关。落点与用时决定三星，触底虚空则直接失败。",
    helpClose: "我知道了",

    toastLand: "稳稳落板",
    toastHeal: "生命 +1",
    toastSpike: "尖刺扎脚 −5",
    toastSpring: "弹簧高抛！",
    toastCrumble: "晶板碎裂！",
    toastCeiling: "顶刺挤压 −HP",
    toastGoal: "金盾升降机！",
    toastVoid: "坠入虚空…",
    toastFloor: "深度 {n} 层",
    toastRestart: "本局已重开",
    toastHeat: "地心红温！",
    toastBest: "刷新纪录！",
  },
  en: {
    docTitle: "Down 100 · DOIN Web Games",
    metaDesc:
      "Down 100: a spiked ceiling presses down while the abyss rises from below. Drop through rock ledges, springs, spikes, conveyor belts and crumbling crystal boards. 23 geological stages, the classic 100-floor run and an endless abyss, all on 120Hz fixed-step physics.",
    appTitle: "Down 100",
    appSubtitle: "Miniature Mine Shaft",
    back: "Portal",
    sound: "Sound toggle",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to Play",
    levelsBtn: "Stages",
    restart: "Restart",
    pause: "Pause",
    pauseTitle: "Paused",
    pauseKicker: "SHAFT FROZEN",
    pauseDesc: "The descent is frozen. Take a breath — your depth, life and every platform stay exactly as they are.",
    btnResume: "Resume",
    btnPauseRestart: "Restart Run",
    stageAria: "Down 100 mine shaft cabinet",
    canvasAria: "An explorer descends a mine shaft by hopping between falling platforms",

    modeCampaign: "Abyss Stages",
    modeClassic: "Classic 100",
    modeEndless: "Endless Abyss",
    modeAria: "Select game mode",

    hudDepth: "Depth",
    hudDepthUnit: "floors",
    hudFloor: "Floor",
    hudLife: "Life",
    hudHpValue: "{hp} / {max}",
    hudGoal: "Target depth",
    hudGoalValue: "{n} / {total}",
    hudBest: "Best",
    hudStars: "Stars",
    hudBestDepth: "Deepest",
    hudSpeed: "Fall speed",
    hudSpeedUnit: "px/s",
    hudRadar: "Geo Sonar",
    hudClassicGoal: "Hundred-floor run",

    radarClear: "No traps below",
    radarNone: "Shaft floor in sight",
    radarNormal: "Rock ledge",
    radarSpring: "Spring board",
    radarSpike: "Spike trap",
    radarCrumble: "Crystal board",
    radarConveyor: "Conveyor belt",
    radarGoal: "Golden lift",
    radarDistance: "about {n}px",

    keyHint: "[A/D or ←/→] move　[S / ↓] dive faster",
    touchLeft: "Move left",
    touchRight: "Move right",
    touchDive: "Fast dive",

    levelsTitle: "Abyss Stages",
    levelsAria: "Stage select",
    levelLocked: "Clear the previous stage to unlock",
    chapter1: "Rusted Surface",
    chapter2: "Geothermal Hollow",
    chapter3: "Steam Works",
    chapter4: "Glow Crystal",
    chapter5: "Core Furnace",
    chapterLabel: "Chapter {n}",
    levelLabel: "Stage {n}",
    starCount: "{n} / 3 ★",
    levelsProgress: "{n} / {total} ★",
    btnClose: "Back",

    resultWinTitle: "Golden Lift Reached!",
    resultLostHpTitle: "Out of Life…",
    resultLostVoidTitle: "Swallowed by the Abyss…",
    resultClassicTitle: "Hundred-Floor Run",
    resultEndlessTitle: "Endless Abyss Run",
    resultDepth: "Depth",
    resultHp: "Life left",
    resultTime: "Time",
    resultScore: "Final Score",
    resultStars: "Stage Stars",
    resultTimeValue: "{n}s",
    resultDepthValue: "{n} floors",
    resultBest: "New record!",
    btnRetry: "Descend Again",
    btnNext: "Next Stage",
    btnAgain: "Play Again",
    btnLevelsResult: "Select Stage",
    starHint1: "★ Reach the golden lift",
    starHint2: "★★ Life left ≥ 50%",
    starHint3: "★★★ Life left ≥ 67% and time ≤ {n}s",

    helpTitle: "How to Play",
    help1: "1. The hydraulic spikes overhead keep pressing down and the abyss keeps rising: only steady descent keeps you alive.",
    help2: "2. Move with [←/→] or [A/D], even in mid-air. Hold [S/↓] to dive faster.",
    help3: "3. A normal rock ledge restores 1 life, once per board. Max life is 12; ceiling spikes drain 10 per second.",
    help4: "4. A spike board costs 5 life, yet it may be the only footing when nothing else is near.",
    help5: "5. Spring boards hurl you toward the ceiling, so dodge sideways before landing. Conveyor belts push you steadily one way.",
    help6: "6. Crystal boards hold for only 0.25s: touch and go. Linger too long and you fall with the shards.",
    help7: "7. Step onto the glowing golden lift to clear the stage. Landing and time decide the stars; the void below ends the run.",
    helpClose: "Got It",

    toastLand: "Solid landing",
    toastHeal: "Life +1",
    toastSpike: "Spikes −5 life",
    toastSpring: "Spring launch!",
    toastCrumble: "Crystal shattered!",
    toastCeiling: "Ceiling crush −HP",
    toastGoal: "Golden lift!",
    toastVoid: "Into the void…",
    toastFloor: "Depth {n}",
    toastRestart: "Run restarted",
    toastHeat: "Core overheat!",
    toastBest: "New record!",
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
    // 降级默认
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
