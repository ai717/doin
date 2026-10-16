// 森林冰火人 · 多语言双表与共享偏好管理 (doin.lang)
// 全站共享 key：localStorage["doin.lang"]（zh/en），禁止私有语言 key

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "森林冰火人 · DOIN 在线小游戏",
    metaDesc: "森林冰火人（Ember & Tide）：同屏双人协作解谜，火人冰人分控双键盘，穿越元素相克与联动机关，双出口同步抵达通关，即点即玩！",
    title: "森林冰火人",
    tagline: "双人协作 · 元素相克 · 双出口同步抵达",
    backHome: "返回首页",
    rules: "规则说明",
    sound: "音效",
    langShort: "EN",
    ariaLang: "切换语言",

    // 牌匾
    fireBadge: "火人 · Ember",
    iceBadge: "冰人 · Tide",
    fireDesc: "免疫岩浆 · 可点燃藤桥",
    iceDesc: "免疫寒水 · 可冻结水面岩浆",
    fireKeys: "W 跳 / A D 左右",
    iceKeys: "↑ 跳 / ← → 左右",
    freezeKey: "K 冻结（冰人）",
    focusKey: "Tab 切换控制角色（单人）",
    soloTip: "单人模式：Tab 切换当前角色",
    dualTip: "双人模式：WASD 控火人 · 方向键控冰人",
    chapterProgress: "章节进度",
    chapterStarTotal: "总星数",
    gemsRed: "红宝石",
    gemsBlue: "蓝宝石",
    gemsGold: "中立宝石",
    gemCount: "{0} / {1}",

    // HUD
    levelLabel: "关卡",
    levelName: "{0}-{1}",
    timeLabel: "用时",
    deathsLabel: "死亡",
    syncLabel: "同步踩板",
    focusLabel: "当前控制",
    fireFocus: "火人",
    iceFocus: "冰人",
    retry: "重玩本关",
    nextLevel: "下一关",
    pause: "暂停",
    resume: "继续",
    selectLevel: "选关",
    levelsTitle: "选择关卡",
    close: "关闭",

    // 章节
    ch1: "森林神庙",
    ch2: "寒冰回廊",
    ch3: "熔岩之心",
    ch4: "水晶幽谷",
    ch5: "双子王座",
    chapterLabel: "第 {0} 章",

    // 状态
    statusPlaying: "双人协作闯关中！",
    statusWaiting: "等待你的搭档…",

    // 规则弹窗
    ruleTitle: "游戏玩法与操作指南",
    ruleGoal: "【目标】同时操控火人（Ember）与冰人（Tide），两人必须同时站到各自颜色的出口门前才能通关。",
    ruleElement: "【元素相克】火人免疫岩浆、遇水即亡；冰人免疫寒水、遇岩浆即亡；墨绿毒液对两人均致命。",
    ruleMechanic: "【机关联动】站上压力板开门；双色门只放行对应角色；同步压力板需两人同时踩下；传送门成对互传；冰人可在冻结点按 K 冻结水面/岩浆 3 秒，火人可点燃藤墙开路。",
    ruleControlsDual: "【双人操作】火人：W 跳 / A D 左右；冰人：↑ 跳 / ← → 左右。",
    ruleControlsSolo: "【单人操作】Tab 切换当前控制角色（被切换角色原地待命）；方向键移动 + ↑/空格 跳跃 + K 冻结。",
    ruleTolerant: "【宽容容错】任何角色死亡会原地回到本关起点重生，已收集宝石保留，只影响三星评价。",
    ruleStars: "【星级评价】每关 5 颗宝石（2 红 + 2 蓝 + 1 中立）：全收集且零死亡 = 三星；全收集 = 二星；通关 = 一星。",
    ruleClose: "我知道了",

    // 结算
    resultTitle: "通关成功！",
    resultStars: "{0} 颗星",
    resultTime: "用时",
    resultGems: "宝石收集",
    resultDeaths: "死亡次数",
    resultSync: "同步踩板",
    resultNewRecord: "新纪录！",
    resultNext: "下一关",
    resultRetry: "重玩本关",
    resultMenu: "选关",

    // 兜底
    noscript: "需要启用 JavaScript 才能游玩森林冰火人。",
    canvasAria: "森林冰火人双人协作关卡舞台"
  },
  en: {
    docTitle: "Ember & Tide · DOIN Games",
    metaDesc: "Ember & Tide: local co-op puzzle platformer. Control the fire and ice twins with two keyboards, cross elemental hazards and linked mechanisms, reach both exits simultaneously!",
    title: "Ember & Tide",
    tagline: "Local Co-op · Elemental Twin · Twin-Exit Sync",
    backHome: "Home",
    rules: "Rules",
    sound: "Sound",
    langShort: "中",
    ariaLang: "Switch language",

    fireBadge: "Ember (Fire)",
    iceBadge: "Tide (Ice)",
    fireDesc: "Immune to magma · ignites vines",
    iceDesc: "Immune to water · freezes lava/water",
    fireKeys: "W Jump / A D Move",
    iceKeys: "↑ Jump / ← → Move",
    freezeKey: "K Freeze (Ice)",
    focusKey: "Tab Switch Focus (Solo)",
    soloTip: "Solo: press Tab to switch the active twin",
    dualTip: "Co-op: WASD controls Fire · Arrows control Ice",
    chapterProgress: "Chapter Progress",
    chapterStarTotal: "Total Stars",
    gemsRed: "Red Gems",
    gemsBlue: "Blue Gems",
    gemsGold: "Gold Gems",
    gemCount: "{0} / {1}",

    levelLabel: "Level",
    levelName: "{0}-{1}",
    timeLabel: "Time",
    deathsLabel: "Deaths",
    syncLabel: "Sync Plates",
    focusLabel: "Active",
    fireFocus: "Fire",
    iceFocus: "Ice",
    retry: "Retry",
    nextLevel: "Next Level",
    pause: "Pause",
    resume: "Resume",
    selectLevel: "Levels",
    levelsTitle: "Select Level",
    close: "Close",

    ch1: "Forest Temple",
    ch2: "Frozen Corridor",
    ch3: "Heart of Lava",
    ch4: "Crystal Vale",
    ch5: "Twin Throne",
    chapterLabel: "Chapter {0}",

    statusPlaying: "Co-op puzzle in progress!",
    statusWaiting: "Waiting for your partner…",

    ruleTitle: "How to Play & Controls",
    ruleGoal: "Goal: Control both twins and bring them to their own colored exits at the same time to clear the level.",
    ruleElement: "Elements: Fire is immune to magma but dies in water; Ice is immune to water but dies in magma; toxic goo kills both.",
    ruleMechanic: "Mechanics: Stand on pressure plates to open doors; colored doors only pass the matching twin; twin plates need both standing at once; portals teleport in pairs; Ice can freeze water/lava for 3s at a freeze spot (K); Fire can ignite vine walls to open new paths.",
    ruleControlsDual: "Co-op: Fire uses W / A D; Ice uses Arrow keys.",
    ruleControlsSolo: "Solo: press Tab to switch the active twin (the other waits); arrows + ↑/Space jump + K freeze.",
    ruleTolerant: "Tolerant: a fallen twin respawns at the level start; collected gems are kept; deaths only affect your star rating.",
    ruleStars: "Stars: each level holds 5 gems (2 red + 2 blue + 1 gold). All gems with zero deaths = 3 stars; all gems = 2 stars; clear = 1 star.",
    ruleClose: "Got It",

    resultTitle: "Level Cleared!",
    resultStars: "{0} stars",
    resultTime: "Time",
    resultGems: "Gems",
    resultDeaths: "Deaths",
    resultSync: "Sync Plates",
    resultNewRecord: "New Record!",
    resultNext: "Next Level",
    resultRetry: "Retry",
    resultMenu: "Levels",

    noscript: "JavaScript is required to play Ember & Tide.",
    canvasAria: "Ember & Tide co-op puzzle stage"
  }
};

export function isLocale(val) {
  return LOCALES.includes(val);
}

export function strings(locale) {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}

export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (match, idx) => {
    const v = args[Number(idx)];
    return v === undefined ? match : String(v);
  });
}

export function detectLocale() {
  const langs = globalThis.navigator?.languages ?? [];
  const single = globalThis.navigator?.language ?? "";
  for (const tag of [...langs, single]) {
    if (typeof tag === "string" && tag.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

export function loadLocale() {
  try {
    const saved = globalThis.localStorage?.getItem(LANG_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // ignore
  }
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return false;
  try {
    globalThis.localStorage?.setItem(LANG_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function htmlLang(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}
