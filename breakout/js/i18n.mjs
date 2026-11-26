// i18n.mjs — 中英双表 + 全站共享偏好 localStorage["doin.lang"]。键严格对齐非空。

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "弹球肉鸽防线 · DOIN 在线小游戏",
    metaDesc:
      "弹球肉鸽防线：操控魔法底板弹射能量球击碎符文砖阵，每清空一层从三枚神秘核心中择一升级，构筑独属于你的弹球毁灭流派，一路轰穿至远古守护者。",
    appTitle: "弹球肉鸽防线",
    appSubtitle: "Breakout Relic",
    back: "返回门户",
    sound: "音效开关",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",
    canvasAria: "弹球肉鸽防线：魔法底板弹射能量球击碎符文砖阵",

    modeRogue: "肉鸽征程",
    modeEndless: "无尽深渊",
    modeDaily: "每日遗迹",
    modeAria: "选择玩法模式",

    labelLayer: "层数",
    labelLives: "生命",
    labelCombo: "连击",
    labelBalls: "球数",
    btnLaunch: "发球",
    btnRetry: "重开本局",
    keyHint: "← → / A D 移动 · 空格发球 · P 暂停 · R 重开",
    touchHint: "拖动舞台横移底板，点击发球",

    labelRelics: "本局核心",
    labelScore: "得分",
    labelBest: "历史最佳",
    labelBestScore: "最高分",
    labelBestLayer: "最远层数",
    relicCount: "{n} 枚",

    padLeft: "左移",
    padRight: "右移",
    padLaunch: "发球",
    padPause: "暂停",

    relicKicker: "LAYER CLEAR",
    relicTitle: "选择一枚核心",
    relicDesc: "三枚神秘核心浮现，择一永久强化本局构筑。",

    pauseTitle: "暂停",
    pauseDesc: "符文阵静悬，能量球静待。",
    btnResume: "继续",

    resultTitleWin: "征程通关！",
    resultTitleLose: "能量耗尽",
    labelResScore: "得分",
    labelResLayer: "到达层数",
    labelResRelics: "核心数",
    labelResTime: "用时",
    btnRetryResult: "再来一局",
    resultHintWin: "守护者已被击碎，你的构筑名垂青史。",
    resultHintLose: "生命耗尽，重整旗鼓再来一局。",

    helpTitle: "玩法说明",
    help1: "左右移动底板接住能量球，球撞碎砖块得分；清空当前层所有砖块即可进入核心选择。",
    help2: "每清空一层，三枚核心随机浮现，择一永久强化本局——多球、火球贯穿、磁吸底板等构筑流派任你组合。",
    help3: "球击中底板的位置决定反弹角度：击中边缘大角度飞出，击中中央近垂直弹回。",
    help4: "球落到底部失去 1 条生命，3 条生命耗尽则本局结束；能量护盾核心可自动接住漏球。",
    help5: "第 5、10、15 层为守护者 Boss 战，Boss 会移动并召唤护盾砖，击破即通关。",
    help6: "核心之间存在协同：如火球贯穿 + 磁吸底板可让穿透飞出的球被拉回重置连击。",
    btnHelpClose: "我知道了",

    toastReady: "点击或按空格发球",
    toastShield: "护盾接住了漏球",
    toastBoss: "守护者出现！",

    relicFireballName: "火球贯穿",
    relicFireballDesc: "球撞击砖块时穿透 1 块砖继续飞行，不反弹。",
    relicLightningName: "闪电链",
    relicLightningDesc: "球击中砖块时，电弧跳跃到 2 块相邻砖块各造成 1 伤害。",
    relicExplosiveName: "爆裂弹",
    relicExplosiveDesc: "球撞击砖块时产生小范围爆炸，对周围 3×3 砖块造成 1 伤害。",
    relicSniperName: "精准狙击",
    relicSniperDesc: "球对 3 血以上砖块造成双倍伤害。",
    relicMultiballName: "多球分裂",
    relicMultiballDesc: "球每击碎 8 块砖分裂出 1 颗新球（上限 6 颗）。",
    relicMagnetName: "磁吸底板",
    relicMagnetDesc: "球落到底板时吸附，可重新瞄准发射。",
    relicWidePaddleName: "宽体底板",
    relicWidePaddleDesc: "底板宽度 +35%。",
    relicLaserName: "激光炮",
    relicLaserDesc: "底板每隔 0.8 秒向上发射一道激光，造成 1 伤害。",
    relicShieldName: "能量护盾",
    relicShieldDesc: "底板边缘产生护罩，每枚核心可自动接住 1 次漏球。",
    relicComboFeverName: "连击狂热",
    relicComboFeverDesc: "球连续撞砖不落地时，每 10 连击伤害 ×1.1（上限 ×3）。",
    relicSlowMoName: "慢动作",
    relicSlowMoDesc: "球速 -25%，更容易接球。",
    relicGoldRushName: "金币磁铁",
    relicGoldRushDesc: "砖块分值 ×2。",
  },
  en: {
    docTitle: "Breakout Relic · DOIN Online Mini Games",
    metaDesc:
      "Breakout Relic: pilot a magic paddle to launch energy orbs and shatter rune brick arrays. Pick one of three relics after each cleared layer to forge your own orb-destruction build and blast through to the Ancient Guardian.",
    appTitle: "Breakout Relic",
    appSubtitle: "Rogue Breakout",
    back: "Portal",
    sound: "Sound toggle",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中文",
    help: "How to play",
    canvasAria: "Breakout Relic: magic paddle launching energy orbs to shatter rune bricks",

    modeRogue: "Rogue Run",
    modeEndless: "Endless Abyss",
    modeDaily: "Daily Relic",
    modeAria: "Select game mode",

    labelLayer: "Layer",
    labelLives: "Lives",
    labelCombo: "Combo",
    labelBalls: "Orbs",
    btnLaunch: "Launch",
    btnRetry: "Restart Run",
    keyHint: "← → or A D move · Space launch · P pause · R restart",
    touchHint: "Drag the stage to move the paddle, tap to launch",

    labelRelics: "Relics",
    labelScore: "Score",
    labelBest: "Best Records",
    labelBestScore: "Best Score",
    labelBestLayer: "Farthest Layer",
    relicCount: "{n}",

    padLeft: "Left",
    padRight: "Right",
    padLaunch: "Launch",
    padPause: "Pause",

    relicKicker: "LAYER CLEAR",
    relicTitle: "Choose a Relic",
    relicDesc: "Three mystic relics appear. Pick one to permanently empower your build.",

    pauseTitle: "Paused",
    pauseDesc: "The rune array hangs still. The orb awaits.",
    btnResume: "Resume",

    resultTitleWin: "Run Cleared!",
    resultTitleLose: "Energy Depleted",
    labelResScore: "Score",
    labelResLayer: "Layer Reached",
    labelResRelics: "Relics",
    labelResTime: "Time",
    btnRetryResult: "Run Again",
    resultHintWin: "The Guardian is shattered. Your build is legendary.",
    resultHintLose: "Out of lives. Regroup and try again.",

    helpTitle: "How to Play",
    help1: "Move the paddle left and right to catch the energy orb. Shatter bricks to score; clear all breakable bricks to pick a relic.",
    help2: "After each cleared layer, three relics appear. Pick one to permanently empower your run — multiball, fireball pierce, magnet paddle and more.",
    help3: "Where the orb hits the paddle decides the bounce angle: edge hits fly wide, center hits bounce nearly straight.",
    help4: "An orb falling past the paddle costs 1 life. Run out of 3 lives and the run ends. The Energy Shield relic auto-catches misses.",
    help5: "Layers 5, 10 and 15 are Guardian boss fights. The boss moves and summons shield bricks; defeat it to clear the layer.",
    help6: "Relics synergize: Fireball Pierce plus Magnet Paddle lets pierced orbs be pulled back to reset combos.",
    btnHelpClose: "Got it",

    toastReady: "Click or press Space to launch",
    toastShield: "Shield caught the orb",
    toastBoss: "Guardian appears!",

    relicFireballName: "Fireball Pierce",
    relicFireballDesc: "The orb pierces 1 brick on impact and continues without bouncing.",
    relicLightningName: "Chain Lightning",
    relicLightningDesc: "On hit, arcs strike 2 adjacent bricks for 1 damage each.",
    relicExplosiveName: "Explosive Orb",
    relicExplosiveDesc: "Orb impact explodes, dealing 1 damage to bricks in a 3x3 area.",
    relicSniperName: "Precision Sniper",
    relicSniperDesc: "Orb deals double damage to bricks with 3+ HP.",
    relicMultiballName: "Multiball Split",
    relicMultiballDesc: "Orb spawns 1 new orb every 8 bricks destroyed (max 6).",
    relicMagnetName: "Magnet Paddle",
    relicMagnetDesc: "Orbs stick to the paddle on contact; aim and relaunch.",
    relicWidePaddleName: "Wide Paddle",
    relicWidePaddleDesc: "Paddle width +35%.",
    relicLaserName: "Laser Cannon",
    relicLaserDesc: "Paddle fires a laser upward every 0.8s for 1 damage.",
    relicShieldName: "Energy Shield",
    relicShieldDesc: "Each copy auto-catches 1 missed orb at the bottom edge.",
    relicComboFeverName: "Combo Fever",
    relicComboFeverDesc: "Every 10 brick-hit combo boosts damage x1.1 (max x3).",
    relicSlowMoName: "Slow Motion",
    relicSlowMoDesc: "Orb speed -25%, easier to catch.",
    relicGoldRushName: "Gold Rush",
    relicGoldRushDesc: "Brick score x2.",
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
