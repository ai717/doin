// i18n.mjs — 中英双表 + 全站共享偏好 localStorage["doin.lang"]。键严格对齐非空。

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "割草！ · DOIN 在线小游戏",
    metaDesc:
      "割草！Mow!：操控软胶小割草机在花田里自动旋转刀片收割虫潮——走位躲怪、升级三选一构筑流派，8 分钟迎战园丁巨人。",
    appTitle: "割草！",
    appSubtitle: "花田幸存割草",
    back: "返回门户",
    sound: "音效开关",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",
    stageAria: "花田割草机台舞台",
    canvasAria: "割草！：自动收割虫潮的 8 分钟生存肉鸽",

    wingWorkshop: "园艺工坊",
    wingStatus: "战况牌匾",
    labelChar: "机台",
    labelLoadout: "构筑",
    labelWeapons: "武器",
    labelPassives: "被动",
    labelRecipe: "进化配方",
    labelCodex: "图鉴",
    recipeHintDefault: "武器满级 + 对应被动 → 捡宝箱进化",
    recipeHintMissing: "{base} 满级 · 缺 {passive}",
    killsSuffix: "{n} 杀",
    btnLaunch: "出击",
    btnCodex: "图鉴",
    labelTimer: "倒计时",
    labelHp: "生命",
    labelMow: "割草槽",
    mowReadyTag: "满槽 · 空格引爆",
    labelCombo: "连击",
    labelKills: "击杀",
    labelLevel: "等级",
    labelBest: "历史最佳",
    bestStd: "标准一局最佳",
    bestEndless: "无尽深渊最佳",
    labelXp: "经验",
    labelStars: "星级",
    keyHint: "WASD / 方向键移动 · 空格或 Shift 花粉爆发 · P 暂停 · 1/2/3 选升级",
    touchHint: "左下摇杆走位，右下花粉键引爆",
    padBurst: "花粉",
    padPause: "暂停",
    joystickLabel: "走位",
    modeStandard: "标准一局",
    modeEndless: "无尽深渊",

    charMower: "割草机",
    charSprinkler: "花洒",
    charLadybug: "瓢虫",
    charRabbit: "圆锯兔",
    charLocked: "未解锁",
    charDescMower: "均衡可靠，初始旋转刀片",
    charDescSprinkler: "高射速低伤，初始花粉喷射",
    charDescLadybug: "高移速低血，初始弹跳豆荚",
    charDescRabbit: "近战爆发，初始地刺藤蔓",

    wBladeRing: "旋转刀片",
    wPollenSpray: "花粉喷射",
    wBouncyPod: "弹跳豆荚",
    wThornVine: "地刺藤蔓",
    wSunbeam: "向日葵光束",
    wLadybugStrike: "瓢虫空袭",
    wBeeSwarm: "蜂群使魔",
    wDandelionBomb: "蒲公英炮弹",
    wGoldDisk: "黄金割草盘",
    wToxicMist: "毒雾花洒",
    wHarvestRain: "丰收豆荚雨",
    wRainbowBloom: "彩虹花光炮",
    wManeater: "食人花丛",
    wLadybugQueen: "瓢虫女王",

    pMagnet: "花蜜磁铁",
    pHerbicide: "除草剂",
    pWindbell: "风铃花",
    pFlowerpot: "陶瓷花盆",
    pCompost: "绿肥",
    pSteelDisk: "钢制刀盘",
    pClover: "幸运草",
    pThorn: "玫瑰刺",

    upgradeCard: "升级",
    choiceXp: "经验补给",
    choiceWeapon: "新武器",
    choiceWeaponUp: "武器升级",
    choicePassive: "新被动",
    choicePassiveUp: "被动升级",
    levelUpTitle: "升级！三选一",
    evolvedTag: "超武",

    panelStartKicker: "MOW!",
    panelStartTitle: "花田待割",
    panelStartDesc: "选一台机台上场：自动收割虫潮、走位躲怪、升级三选一，撑到 7:30 迎战园丁巨人。",
    modeStandard: "标准一局",
    modeStandardDesc: "8 分钟完整弧线 + 园丁巨人 Boss",
    modeEndless: "无尽深渊",
    modeEndlessDesc: "通关后解锁 · 无终点的极限生存",
    btnStart: "开工！",
    btnStartLocked: "先通关标准一局",

    panelPauseTitle: "暂停",
    panelPauseDesc: "花田还在，虫潮也还在。",
    btnResume: "继续割草",
    btnRestart: "重开一局",
    btnQuit: "返回花田",

    resultTitleWin: "园丁巨人倒下了！",
    resultTitleLose: "割草机报废",
    resultStars: "{n} 星",
    labelResKills: "总击杀",
    labelResCombo: "连击峰值",
    labelResBurst: "花粉爆发",
    labelResScore: "得分",
    labelResTime: "存活",
    labelResNewBest: "新纪录！",
    labelResUnlock: "解锁角色：圆锯兔！",
    resultHintWin: "三星：击杀 ≥ 600 且连击峰值 ≥ 40。",
    resultHintLose: "存活 5 分钟以上可获得 1 星。",
    btnAgain: "再来一局",
    btnToHome: "返回花田",

    panelCodexTitle: "花园图鉴",
    panelCodexDesc: "只扩池、不增强——解锁新角色与新武器池。",
    codexWeapons: "武器图鉴",
    codexPassives: "被动图鉴",
    codexEvolutions: "进化图鉴",
    codexEmpty: "尚未解锁",
    codexCount: "{n} 件",

    panelHelpTitle: "玩法说明",
    upgradeKicker: "LEVEL UP",
    codexKicker: "GARDENER'S CODEX",
    help1: "武器全自动攻击，你只需要走位：绕圈聚怪、贴边风筝，把虫潮割得越密越好。",
    help2: "击杀掉落花蜜，磁铁会自动吸过来；经验条满了会暂停弹出三选一，选武器、被动或升级。",
    help3: "连续击杀攒割草槽，满槽按空格引爆全屏花粉爆发，获得短暂得分翻倍。",
    help4: "武器升满 8 级 + 拿到对应被动，再捡精英掉落的宝箱即可进化成超武。",
    help5: "被包围到走投无路时会自动触发一次免费花粉脱困——死亡永远是你自己的失误。",
    help6: "7:30 清场回血，迎战园丁巨人；击破即三星结算。通关解锁无尽深渊与圆锯兔。",
    btnHelpClose: "我知道了",

    toastMowReady: "割草槽满 · 空格引爆花粉爆发",
    toastCheckpoint: "第 {n} 分钟 · 节奏检查点",
    toastBossSpawn: "园丁巨人登场！",
    toastBossPhase2: "巨人暴怒 · 召唤虫群",
    toastBossPhase3: "巨人践踏 · 小心冲锋",
    toastEvolve: "进化！{name}",
    toastEmergency: "花粉应急爆发 · 脱困！",
    toastUnlock: "解锁圆锯兔！",
    toastQuitConfirm: "确定返回花田？本局进度将丢失。",

    noscript: "需要启用 JavaScript 才能游玩割草！。",
  },
  en: {
    docTitle: "Mow! · DOIN Online Mini Games",
    metaDesc:
      "Mow!: drive a soft clay lawn mower and auto-scythe hordes of garden pests — dodge, draft upgrades from three choices, and face the Gardener after 8 minutes.",
    appTitle: "Mow!",
    appSubtitle: "Meadow Survivor",
    back: "Portal",
    sound: "Sound toggle",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to play",
    stageAria: "Meadow mower cabinet stage",
    canvasAria: "Mow!: an 8-minute bullet-heaven survival roguelite",

    wingWorkshop: "Garden Workshop",
    wingStatus: "Run Status",
    labelChar: "Mowers",
    labelLoadout: "Loadout",
    labelWeapons: "Weapons",
    labelPassives: "Passives",
    labelRecipe: "Evolutions",
    labelCodex: "Codex",
    recipeHintDefault: "Max a weapon + matching passive → grab an elite chest",
    recipeHintMissing: "{base} maxed · need {passive}",
    killsSuffix: "{n} kills",
    btnLaunch: "Launch",
    btnCodex: "Codex",
    labelTimer: "Timer",
    labelHp: "HP",
    labelMow: "Mow Meter",
    mowReadyTag: "Full · Space to burst",
    labelCombo: "Combo",
    labelKills: "Kills",
    labelLevel: "Level",
    labelBest: "Best Records",
    bestStd: "Best Standard",
    bestEndless: "Best Endless",
    labelXp: "XP",
    labelStars: "Stars",
    keyHint: "WASD / arrows to move · Space or Shift to burst · P pause · 1/2/3 to pick",
    touchHint: "Left stick to move, right bloom button to burst",
    padBurst: "Bloom",
    padPause: "Pause",
    joystickLabel: "Move",
    modeStandard: "Standard Run",
    modeEndless: "Endless Pit",

    charMower: "Mower",
    charSprinkler: "Sprinkler",
    charLadybug: "Ladybug",
    charRabbit: "Saw Rabbit",
    charLocked: "Locked",
    charDescMower: "Balanced; starts with spinning blades",
    charDescSprinkler: "Fast-firing; starts with pollen spray",
    charDescLadybug: "Fast & fragile; starts with bouncy pods",
    charDescRabbit: "Melee burst; starts with thorn vines",

    wBladeRing: "Blade Ring",
    wPollenSpray: "Pollen Spray",
    wBouncyPod: "Bouncy Pod",
    wThornVine: "Thorn Vine",
    wSunbeam: "Sunbeam",
    wLadybugStrike: "Ladybug Strike",
    wBeeSwarm: "Bee Swarm",
    wDandelionBomb: "Dandelion Bomb",
    wGoldDisk: "Golden Disk",
    wToxicMist: "Toxic Mist",
    wHarvestRain: "Harvest Rain",
    wRainbowBloom: "Rainbow Bloom",
    wManeater: "Maneater",
    wLadybugQueen: "Ladybug Queen",

    pMagnet: "Nectar Magnet",
    pHerbicide: "Herbicide",
    pWindbell: "Windbell",
    pFlowerpot: "Flower Pot",
    pCompost: "Compost",
    pSteelDisk: "Steel Disk",
    pClover: "Clover",
    pThorn: "Thorn Rose",

    upgradeCard: "Upgrade",
    choiceXp: "XP Boost",
    choiceWeapon: "New Weapon",
    choiceWeaponUp: "Weapon Upgrade",
    choicePassive: "New Passive",
    choicePassiveUp: "Passive Upgrade",
    levelUpTitle: "Level Up! Pick 1 of 3",
    evolvedTag: "Evolved",

    panelStartKicker: "MOW!",
    panelStartTitle: "Meadow Ready",
    panelStartDesc: "Pick a mower: weapons fire automatically, you dodge and draft. Survive until 7:30 and face the Gardener.",
    modeStandard: "Standard Run",
    modeStandardDesc: "8-minute arc + Gardener boss",
    modeEndless: "Endless Pit",
    modeEndlessDesc: "Unlock after a standard win · endless survival",
    btnStart: "Mow!",
    btnStartLocked: "Clear Standard first",

    panelPauseTitle: "Paused",
    panelPauseDesc: "The meadow is still there. So is the swarm.",
    btnResume: "Resume",
    btnRestart: "Restart",
    btnQuit: "Quit to Meadow",

    resultTitleWin: "The Gardener Falls!",
    resultTitleLose: "Mower Wrecked",
    resultStars: "{n} stars",
    labelResKills: "Kills",
    labelResCombo: "Max Combo",
    labelResBurst: "Bursts",
    labelResScore: "Score",
    labelResTime: "Survived",
    labelResNewBest: "New Record!",
    labelResUnlock: "Character unlocked: Saw Rabbit!",
    resultHintWin: "3 stars: 600+ kills and a 40+ combo peak.",
    resultHintLose: "Survive 5+ minutes for 1 star.",
    btnAgain: "Run Again",
    btnToHome: "Back to Meadow",

    panelCodexTitle: "Gardener's Codex",
    panelCodexDesc: "Expands pools only — no permanent stat boosts.",
    codexWeapons: "Weapons",
    codexPassives: "Passives",
    codexEvolutions: "Evolutions",
    codexEmpty: "Not discovered",
    codexCount: "{n} found",

    panelHelpTitle: "How to Play",
    upgradeKicker: "LEVEL UP",
    codexKicker: "GARDENER'S CODEX",
    help1: "Weapons fire automatically — your only job is movement: herd enemies into clumps and mow them denser.",
    help2: "Kills drop nectar that magnets home. When the XP bar fills, the game pauses and you pick 1 of 3 upgrades.",
    help3: "Chained kills fill the Mow Meter. At full, press Space for a screen-clearing pollen burst plus a short score bonus.",
    help4: "Max a weapon to level 8, hold its matching passive, then grab an elite chest to evolve it into a super weapon.",
    help5: "If you get surrounded with no way out, a free emergency burst triggers automatically — death is always your own mistake.",
    help6: "At 7:30 the field clears and heals you for the Gardener boss. Defeat it to win; beating the game unlocks Endless and Saw Rabbit.",
    btnHelpClose: "Got it",

    toastMowReady: "Mow Meter full · Space to burst",
    toastCheckpoint: "Minute {n} · pace checkpoint",
    toastBossSpawn: "The Gardener has arrived!",
    toastBossPhase2: "Gardener enraged · summoning swarm",
    toastBossPhase3: "Gardener stomping · watch the charge",
    toastEvolve: "Evolved! {name}",
    toastEmergency: "Emergency pollen burst · free!",
    toastUnlock: "Saw Rabbit unlocked!",
    toastQuitConfirm: "Quit to meadow? This run will be lost.",

    noscript: "JavaScript is required to play Mow!.",
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
