// i18n.mjs — 中英双表 + 全站共享偏好 localStorage["doin.lang"]。键严格对齐非空。

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "太空防御者 · DOIN 在线小游戏",
    metaDesc:
      "太空防御者：驾驶复古战机在几何弹幕里横向穿梭，擦弹充能引爆过载，夺回被俘僚机双机合体，五个星区三十波反打至敌方母舰。",
    appTitle: "太空防御者",
    appSubtitle: "深空霓虹街机",
    back: "返回门户",
    sound: "音效开关",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",
    stageAria: "深空霓虹街机舞台",
    canvasAria: "太空防御者：战机横移射击与敌阵俯冲",

    modeCampaign: "星区战役",
    modeRush: "母舰突袭",
    modeSurvival: "生存狂潮",
    modeAria: "选择玩法模式",

    wingCommand: "作战指令",
    labelSector: "星区",
    labelWave: "波次",
    labelHangar: "机库状态",
    valSingle: "单机",
    valDual: "双机合体",
    droneValue: "浮游炮 ×{n}",
    btnLaunch: "出击",
    btnRetry: "重打本波",
    btnHangar: "返回机库",

    wingStatus: "战况牌匾",
    labelShield: "护盾",
    labelOverload: "OVERLOAD",
    labelCombo: "连击链",
    labelAcc: "命中率",
    labelGraze: "擦弹",
    labelTimer: "本波用时",
    labelBest: "历史最佳",
    labelBestScore: "最高分",
    labelBestWave: "最远波次",
    labelRushBest: "突袭最快",
    labelLives: "残机",
    comboValue: "×{n}",
    accValue: "{n}%",
    timeValue: "{n}s",
    scoreValue: "{n}",
    waveValue: "{n} / {max}",
    bossTag: "母舰",
    keyHint: "← → / A D 横移 · 空格或 J 开火 · K 引爆过载 · P 暂停 · R 重开",
    touchHint: "拖动舷窗横移，右下角发射键按住连射",
    autoFireLabel: "自动开火",

    padLeft: "左移",
    padRight: "右移",
    padFire: "发射",
    padOverload: "过载",
    padPause: "暂停",

    sector0: "新兵星区",
    sector1: "隼群星区",
    sector2: "蟹甲星区",
    sector3: "皇蜂星区",
    sector4: "母舰星区",

    hangarKicker: "SPACE DEFENDER",
    hangarTitle: "出击准备",
    hangarDesc: "选一波立刻起飞：擦过敌弹可充能 OVERLOAD，被皇蜂牵引时反手击落它就能夺回僚机双机合体。",
    hangarSectors: "星区战役",
    hangarRush: "母舰突袭",
    hangarSurvival: "生存狂潮",
    waveLocked: "未解锁",
    waveStars: "{n}/3",
    totalStarsValue: "总星数 {n}/90",

    pauseTitle: "暂停",
    pauseDesc: "深空还在，弹幕也还在。",
    btnResume: "继续战斗",

    resultTitleWin: "星区肃清！",
    resultTitleLose: "战机失联",
    labelResScore: "得分",
    labelResAcc: "命中率",
    labelResKills: "击落",
    labelResGraze: "擦弹",
    labelResRescue: "夺回僚机",
    labelResTime: "用时",
    labelResBonus: "通关奖励",
    resultHint: "三条判据各得一星：命中率 70%、全程未被击中、限时内清空。",
    btnNext: "下一波",
    btnHangarResult: "返回机库",

    helpTitle: "玩法说明",
    help1: "左右横移躲开弹幕，按住发射键清空敌阵；自动开火默认开启，可随时关掉。",
    help2: "敌弹擦过机身外圈的擦弹环会充能 OVERLOAD，满了按 K 引爆：射速翻倍、敌弹变慢、得分翻倍。",
    help3: "皇蜂会发射牵引光束俘获本机——此时反手击落那艘皇蜂，即可夺回僚机，双机合体火力翻倍。",
    help4: "击落带能量核心的敌机会掉落橙色胶囊（浮游炮，最多两枚）或银色护盾芯片。",
    help5: "敌阵压到警戒线会持续削护盾，护盾耗尽才损失一架残机；复活有短暂无敌并清空弹幕。",
    help6: "每波按命中率、无伤、限时三条独立判据授予金星，战役共 30 波 90 星。",
    btnHelpClose: "我知道了",

    toastOverloadReady: "OVERLOAD 就绪 · 按 K 引爆",
    toastCaptured: "被牵引了！击落那艘皇蜂夺回僚机",
    toastRescued: "僚机归队 · 双机合体",
    toastLocked: "先通过前面的波次",
    toastBreach: "防线失守 · 护盾流失",
    toastGameOver: "残机耗尽 · 返回机库重整",
  },
  en: {
    docTitle: "Space Defender · DOIN Online Mini Games",
    metaDesc:
      "Space Defender: pilot a retro fighter through geometric bullet patterns, graze bullets to charge OVERLOAD, rescue your captured wingman for a dual-fighter fusion, and fight back to the mothership across 5 sectors and 30 waves.",
    appTitle: "Space Defender",
    appSubtitle: "Deep Space Neon Arcade",
    back: "Portal",
    sound: "Sound toggle",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to play",
    stageAria: "Deep space neon arcade stage",
    canvasAria: "Space Defender: strafing fighter versus diving alien swarm",

    modeCampaign: "Sector Campaign",
    modeRush: "Mothership Rush",
    modeSurvival: "Survival Onslaught",
    modeAria: "Select game mode",

    wingCommand: "Command Plaque",
    labelSector: "Sector",
    labelWave: "Wave",
    labelHangar: "Hangar",
    valSingle: "Single",
    valDual: "Dual Fighter",
    droneValue: "Drones ×{n}",
    btnLaunch: "Launch",
    btnRetry: "Retry Wave",
    btnHangar: "Back to Hangar",

    wingStatus: "Status Plaque",
    labelShield: "Shields",
    labelOverload: "OVERLOAD",
    labelCombo: "Combo",
    labelAcc: "Accuracy",
    labelGraze: "Graze",
    labelTimer: "Wave Time",
    labelBest: "Best Records",
    labelBestScore: "Best Score",
    labelBestWave: "Farthest Wave",
    labelRushBest: "Best Rush",
    labelLives: "Ships",
    comboValue: "×{n}",
    accValue: "{n}%",
    timeValue: "{n}s",
    scoreValue: "{n}",
    waveValue: "{n} / {max}",
    bossTag: "BOSS",
    keyHint: "← → or A D strafe · Space / J fire · K overload · P pause · R restart",
    touchHint: "Drag the viewport to strafe, hold the fire key to keep shooting",
    autoFireLabel: "Auto fire",

    padLeft: "Left",
    padRight: "Right",
    padFire: "Fire",
    padOverload: "Overload",
    padPause: "Pause",

    sector0: "Recruit Belt",
    sector1: "Falcon Swarm",
    sector2: "Carapace Field",
    sector3: "Queen Nest",
    sector4: "Mothership Gate",

    hangarKicker: "SPACE DEFENDER",
    hangarTitle: "Ready for Launch",
    hangarDesc:
      "Pick a wave and launch: grazing bullets charges OVERLOAD, and if a Queen beams you up, shoot her down to rescue your wingman and fuse into a dual fighter.",
    hangarSectors: "Sector Campaign",
    hangarRush: "Mothership Rush",
    hangarSurvival: "Survival Onslaught",
    waveLocked: "Locked",
    waveStars: "{n}/3",
    totalStarsValue: "Stars {n}/90",

    pauseTitle: "Paused",
    pauseDesc: "Deep space is still there. So is the barrage.",
    btnResume: "Resume",

    resultTitleWin: "Sector Cleared!",
    resultTitleLose: "Ship Lost",
    labelResScore: "Score",
    labelResAcc: "Accuracy",
    labelResKills: "Kills",
    labelResGraze: "Graze",
    labelResRescue: "Rescued",
    labelResTime: "Time",
    labelResBonus: "Clear Bonus",
    resultHint: "One star each: 70% accuracy, no hits taken, and clearing within par time.",
    btnNext: "Next Wave",
    btnHangarResult: "Back to Hangar",

    helpTitle: "How to Play",
    help1: "Strafe left and right to dodge, hold fire to wipe out the swarm. Auto fire is on by default and can be turned off.",
    help2: "Let enemy bullets graze the outer ring to charge OVERLOAD. Press K at full charge: double fire rate, slowed bullets, double score.",
    help3: "Queens fire a tractor beam to capture you — shoot that Queen down while captured to rescue your wingman and fuse into a dual fighter.",
    help4: "Enemies with energy cores drop orange capsules (drones, max two) or silver shield chips.",
    help5: "If the swarm reaches the warning line your shields drain; only a broken shield costs a ship. Respawns grant brief invulnerability and clear the screen.",
    help6: "Each wave grants a star for accuracy, for taking no hits, and for clearing in par time — 30 waves, 90 stars total.",
    btnHelpClose: "Got it",

    toastOverloadReady: "OVERLOAD ready · press K",
    toastCaptured: "Tractor beam! Shoot that Queen down to rescue your wingman",
    toastRescued: "Wingman recovered · dual fighter online",
    toastLocked: "Clear earlier waves first",
    toastBreach: "Line breached · shields draining",
    toastGameOver: "No ships left · regroup at the hangar",
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
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  );
}
