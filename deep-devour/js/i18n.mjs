// i18n：中英双语字符串表 + 统一语言检测。
// 全站共享偏好 key：localStorage["doin.lang"]（首页与所有子游戏读写同一个）。
// 默认显示语言规则：doin.lang 有合法值 → 用它；否则浏览器语言 zh* → 中文，其余 → 英文。

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "深海吞噬 · DOIN 在线小游戏",
    metaDesc:
      "深海吞噬在线玩：吃掉比你小的、躲开比你大的，一口一口长成海里的霸主。5 片海域 40 关逐章解锁新规则，狂暴连锁、鱼群同行、深渊压强、咬尾降阶，另有无尽下潜模式。",
    appTitle: "深海吞噬",
    kicker: "DEEP DEVOUR",
    back: "返回门户",
    sound: "音效",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法",
    pause: "暂停",
    resume: "继续",
    restart: "重开",
    resetBtn: "清空存档",
    resetConfirm: "确认清空全部珍珠与最高纪录并重新开始吗？",
    resetConfirmBtn: "再点一次确认清空",
    hudZone: "海域",
    hudLevel: "关号",
    hudGrow: "成长",
    hudFrenzy: "狂暴",
    hudShoal: "鱼群",
    hudPressure: "压强",
    hudDepth: "深度",
    hudHearts: "心数",
    tierValue: "第 {0} 阶",
    tierGrow: "{0} / {1}",
    tierNames: ["浮游小鱼", "幼鳞鱼", "银纹鱼", "礁斑鱼", "珊瑚鲷", "巨口鱼", "深海霸主"],
    frenzyNone: "静默",
    frenzyLevel1: "狂暴 ×2",
    frenzyLevel2: "双重狂暴 ×3",
    comboValue: "{0} 连",
    goalGrow: "成长到第 {0} 阶",
    goalEat: "吃够 {0} 条",
    goalTail: "咬退 {0} 名精英掠食者",
    goalEndless: "一直往下潜",
    starPass: "通关",
    starNoHit: "全程未被吃",
    starParTime: "{0} 秒内通关",
    starFrenzy: "打出双重狂暴",
    starShoal: "满编三尾鱼群",
    starEatCount: "吃够 {0} 条",
    readyTitle: "深海吞噬",
    readyDesc:
      "吃掉比你小的，躲开比你大的。攒够三条同种小鱼，它们就跟你走，替你挡一次掠食者的嘴。",
    btnStart: "开始吞噬",
    btnResume: "继续上次进度",
    btnLevels: "海域与关卡",
    btnAbyss: "深渊无尽",
    levelsTitle: "海域与关卡",
    levelsZonePearls: "本海域 {0} / 24 珍珠",
    levelsTotalPearls: "珍珠总计 {0} / 120",
    levelsLocked: "需 {0} 颗珍珠解锁",
    levelsAbyssLocked: "通关「海藻密林」后解锁",
    levelsAbyssOpen: "深渊无尽 · 最深 {0} 米 · 最高分 {1}",
    btnClose: "返回",
    resultWin: "海域通关！",
    resultLoseHearts: "被吃完了…",
    resultLoseTime: "时间到…",
    resultPearls: "本关珍珠",
    resultTier: "最终体型",
    resultEaten: "吞食数",
    resultTime: "用时",
    resultHits: "被吃次数",
    resultScore: "得分",
    btnNext: "下一关",
    btnRetry: "再试一次",
    btnHome: "回到关卡表",
    newBestBadge: "新纪录！",
    helpTitle: "玩法说明",
    helpItems: [
      "鼠标移动或手指拖动，鱼就朝那个方向游；WASD / 方向键是八向直接操控。",
      "空格或鼠标左键冲刺，消耗气泡能量；能量会自动回充，闪电泡泡能让你 5 秒内无限冲刺。",
      "食物链只看体型：比你可食目标描暖绿微光，比你大的描珊瑚红警示纹，同级互不相犯。",
      "1.2 秒内连续吞食可以续上连击；5 连点燃狂暴（×2），12 连升级双重狂暴（×3）。",
      "攒够三条同种小鱼就有一尾随行鱼，最多三尾；它们会帮你吞小猎物，并替你挡一次掠食者的嘴。",
      "被吃掉不会重开整关：扣 1 心、体型退一阶，还有一段无敌时间让你翻身。",
      "海藻丛可以穿行，但看不清里面有什么。水母会让你麻痹 1.5 秒，海胆会扎掉一颗心。",
      "水雷和渔网都能用冲刺破解：撞爆水雷会震晕周围的鱼，撞破渔网则既不掉血也不被缠住。",
      "沉船海沟越深的猎物成长值越高（×1.5 / ×2），但压强条会涨满，必须回浅层换气。",
      "深渊王座的精英掠食者正面会吃你，但突进后会卸力——绕到它尾巴咬三次，把它咬退一阶。",
      "P 暂停，R 重开本关。每关三颗珍珠：通关、全程未被吃、隐藏效率目标。",
    ],
    toastGrow: "体型升级！第 {0} 阶",
    toastFrenzy: "狂暴点燃！得分 ×2",
    toastFrenzy2: "双重狂暴！得分 ×3",
    toastCombo: "{0} 连",
    toastShoal: "鱼群 +1（{0} / 3）",
    toastSaved: "随行鱼替你挡了一口",
    toastBitten: "被吃掉了！体型退一阶",
    toastPoison: "中毒：左右反向 2 秒",
    toastJelly: "被水母麻痹了",
    toastSpike: "海胆尖刺！",
    toastBoom: "水雷爆炸！",
    toastDefuse: "冲刺撞爆了水雷！",
    toastNet: "被渔网缠住，冲刺挣脱",
    toastNetBroke: "挣脱了渔网",
    toastPressureFull: "压强满格！回浅层换气",
    toastPressureSafe: "压强降低",
    toastPearl: "珍珠：成长一大段",
    toastLightning: "闪电泡泡：5 秒冲刺无冷却",
    toastFrenzyPower: "狂暴泡泡：立即点燃",
    toastShoalPower: "鱼群泡泡：三尾入列",
    toastHeart: "心 +1",
    toastChest: "宝箱开出增益！",
    toastChestTrap: "空箱！被一团烂渔网缠住了",
    toastTail: "咬中尾巴！({0} / {1})",
    toastSubdue: "制服了一头精英掠食者！",
    toastSubdueBoss: "鲨鱼王被咬退了！",
    toastLocked: "该海域尚未解锁",
    toastTimeout: "时间耗尽",
    toastHurry: "最后 10 秒！",
    abyssTitle: "深渊无尽",
    abyssDesc:
      "一直往下潜：越深鱼越大越多、成长值越肥、屏幕越暗，最后只剩自己的一束探照光。记两项成绩——最深米数 与 最高分。",
    abyssDepthValue: "{0} 米",
    abyssBest: "最深 {0} 米 · 最高 {1} 分",
    abyssEnd: "下潜结束",
    abyssEndDesc: "本次下潜 {0} 米，得分 {1}。",
    btnAbyssRetry: "再下一次",
    btnAbyssExit: "离开深渊",
    pausedTitle: "已暂停",
    pausedDesc: "按 P 或点下方按钮继续",
    resultLoseDesc: "还剩 {0} 颗心时被吃光了。再来一次，这次绕远点。",
    tipMove: "鼠标 / 手指拖动游动，WASD 也可以",
    tipSprint: "空格 / 左键冲刺",
    tipPause: "P 暂停 · R 重开本关",
    ariaSea: "珊瑚礁海域：操控小鱼吞食更小的猎物，并躲开更大的鱼",
    ariaSound: "切换音效",
    ariaLang: "切换语言",
    ariaHelp: "打开玩法说明",
    ariaPause: "暂停或继续",
    ariaRestart: "重开本关",
    ariaCanvas: "游戏舞台",
    noscript: "需要启用 JavaScript 才能游玩深海吞噬。",
    langLabel: "Switch to English",
  },
  en: {
    docTitle: "Deep Devour · DOIN games",
    metaDesc:
      "Play Deep Devour online: eat what is smaller than you, dodge what is bigger, and grow into the apex of the reef. 40 levels across 5 seas unlock new rules - frenzy chains, shoal companions, abyss pressure, tail bites - plus an endless dive.",
    appTitle: "Deep Devour",
    kicker: "DEEP DEVOUR",
    back: "Portal",
    sound: "Sound",
    soundOn: "Sound ON",
    soundOff: "Sound OFF",
    langSwitch: "中文",
    help: "How to play",
    pause: "Pause",
    resume: "Resume",
    restart: "Restart",
    resetBtn: "Reset save",
    resetConfirm: "Erase every pearl and record and start over?",
    resetConfirmBtn: "Click again to wipe",
    hudZone: "Sea",
    hudLevel: "Stage",
    hudGrow: "Growth",
    hudFrenzy: "Frenzy",
    hudShoal: "Shoal",
    hudPressure: "Pressure",
    hudDepth: "Depth",
    hudHearts: "Lives",
    tierValue: "Tier {0}",
    tierGrow: "{0} / {1}",
    tierNames: ["Fry", "Minnow", "Silverfin", "Reefback", "Coral Snapper", "Bigmouth", "Abyss Apex"],
    frenzyNone: "Calm",
    frenzyLevel1: "Frenzy x2",
    frenzyLevel2: "Double Frenzy x3",
    comboValue: "{0} chain",
    goalGrow: "Grow to tier {0}",
    goalEat: "Swallow {0} fish",
    goalTail: "Subdue {0} elite predators",
    goalEndless: "Keep diving",
    starPass: "Clear the stage",
    starNoHit: "Never get eaten",
    starParTime: "Clear within {0}s",
    starFrenzy: "Reach Double Frenzy",
    starShoal: "Full three-fish shoal",
    starEatCount: "Swallow {0} fish",
    readyTitle: "Deep Devour",
    readyDesc:
      "Eat what is smaller, dodge what is bigger. Gather three fish of one species and they will swim with you, blocking one predator bite.",
    btnStart: "Start feeding",
    btnResume: "Continue",
    btnLevels: "Seas & stages",
    btnAbyss: "Endless dive",
    levelsTitle: "Seas & stages",
    levelsZonePearls: "This sea {0} / 24 pearls",
    levelsTotalPearls: "Pearls {0} / 120",
    levelsLocked: "Needs {0} pearls",
    levelsAbyssLocked: "Clear Kelp Thicket to unlock",
    levelsAbyssOpen: "Endless dive · best {0} m · {1} pts",
    btnClose: "Back",
    resultWin: "Sea cleared!",
    resultLoseHearts: "Eaten alive...",
    resultLoseTime: "Out of time...",
    resultPearls: "Stage pearls",
    resultTier: "Final tier",
    resultEaten: "Swallowed",
    resultTime: "Time",
    resultHits: "Times eaten",
    resultScore: "Score",
    btnNext: "Next stage",
    btnRetry: "Try again",
    btnHome: "Stage list",
    newBestBadge: "New record!",
    helpTitle: "How to play",
    helpItems: [
      "Move the mouse or drag with a finger and the fish swims that way; WASD / arrows also work for direct 8-way control.",
      "Space or left click sprints and drains bubble energy. Energy refills on its own, and a lightning bubble removes the cooldown for 5 seconds.",
      "The food chain is about size only: edible targets glow warm green, bigger ones wear a coral warning, and equals ignore each other.",
      "Swallow again within 1.2s to keep the chain alive. Five in a row ignites Frenzy (x2); twelve upgrades it to Double Frenzy (x3).",
      "Three fish of the same species recruit one shoal follower, up to three. They help you swallow small prey and block one predator bite.",
      "Getting eaten never restarts the stage: lose a life, drop one tier, and get a stretch of invulnerability to turn it around.",
      "Kelp can be swum through, but hides what is inside. Jellyfish paralyse you for 1.5s; urchins cost a life.",
      "Mines and nets both break to a sprint: blowing a mine stuns nearby fish, and tearing a net costs neither health nor speed.",
      "Deeper prey in the Sunken Trench feeds 1.5-2x more growth, but the pressure gauge fills and you must surface to breathe.",
      "Elites in the Abyssal Throne eat you head-on, but they coast after each rush. Circle behind and bite the tail three times to drop them a tier.",
      "P pauses, R restarts the stage. Each stage holds three pearls: clear it, never get eaten, and hit the hidden efficiency goal.",
    ],
    toastGrow: "Tier up! Tier {0}",
    toastFrenzy: "Frenzy ignited! Score x2",
    toastFrenzy2: "Double Frenzy! Score x3",
    toastCombo: "{0} chain",
    toastShoal: "Shoal +1 ({0} / 3)",
    toastSaved: "A follower took the bite",
    toastBitten: "Eaten! One tier lost",
    toastPoison: "Venomed: steering flipped for 2s",
    toastJelly: "Paralysed by a jellyfish",
    toastSpike: "Urchin spike!",
    toastBoom: "Mine exploded!",
    toastDefuse: "Sprinted a mine into pieces!",
    toastNet: "Caught in a net - sprint to break free",
    toastNetBroke: "Broke free of the net",
    toastPressureFull: "Pressure maxed! Surface to breathe",
    toastPressureSafe: "Pressure dropping",
    toastPearl: "Pearl: a big chunk of growth",
    toastLightning: "Lightning bubble: 5s of free sprints",
    toastFrenzyPower: "Frenzy bubble: ignited instantly",
    toastShoalPower: "Shoal bubble: three followers join",
    toastHeart: "Life +1",
    toastChest: "The chest held a boost!",
    toastChestTrap: "An empty chest - snagged on old netting",
    toastTail: "Tail bite! ({0} / {1})",
    toastSubdue: "Elite predator subdued!",
    toastSubdueBoss: "The Shark King has been driven off!",
    toastLocked: "That sea is still locked",
    toastTimeout: "Out of time",
    toastHurry: "Ten seconds left!",
    abyssTitle: "Endless Dive",
    abyssDesc:
      "Keep diving: the deeper you go, the bigger and denser the fish, the richer the growth, and the darker the water - until only your searchlight is left. Two records: deepest metres and highest score.",
    abyssDepthValue: "{0} m",
    abyssBest: "Best {0} m · {1} pts",
    abyssEnd: "Dive over",
    abyssEndDesc: "This dive reached {0} m with {1} points.",
    btnAbyssRetry: "Dive again",
    btnAbyssExit: "Leave the abyss",
    pausedTitle: "Paused",
    pausedDesc: "Press P or tap the button below to resume",
    resultLoseDesc: "The reef finished you off with {0} lives left. Try again and keep your distance.",
    tipMove: "Move the mouse / drag to swim — WASD works too",
    tipSprint: "Space / left click to sprint",
    tipPause: "P pause · R restart stage",
    ariaSea: "Coral reef stage: steer a small fish to swallow smaller prey and avoid bigger hunters",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaHelp: "Open the how-to-play panel",
    ariaPause: "Pause or resume",
    ariaRestart: "Restart this stage",
    ariaCanvas: "Game stage",
    noscript: "JavaScript is required to play Deep Devour.",
    langLabel: "切换到中文",
  },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

// 简单插值："第 {0} 阶" + format(t, 3) → "第 3 阶"
export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

// 浏览器语言 → locale：任何 zh 开头 → 中文，否则英文。
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
  } catch {
    return null;
  }
}

// 统一规则第一步：全站共享偏好优先。
// getItem 必须包在 try 里：Safari 隐私模式 / 沙箱 iframe 下「拿到 localStorage 对象」
// 这一步可能不抛，真正抛的是读写那一瞬间 —— 一旦漏出去就是启动即白屏。
export function loadLocale() {
  try {
    const saved = readStore()?.getItem(LANG_KEY);
    if (isLocale(saved)) return saved;
  } catch (error) {
    // 存储不可读 → 退回浏览器语言判定
  }
  return detectLocale();
}

// 统一规则第二步：切换即写入全站共享偏好。
export function saveLocale(locale) {
  if (!isLocale(locale)) return false;
  try {
    readStore()?.setItem(LANG_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}

// 关卡 / 海域文案是数据（levels.mjs）里的 { zh, en } 双字段，这里统一取值。
export function pickLocalized(entry, locale, fallback = "") {
  if (!entry) return fallback;
  return entry[locale] ?? entry[DEFAULT_LOCALE] ?? fallback;
}
