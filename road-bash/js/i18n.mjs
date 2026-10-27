// i18n.mjs — 中英双表 + 全站共享偏好 localStorage["doin.lang"]。键严格对齐非空。

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";
export const LOCALES = ["zh", "en"];

const DICT = {
  zh: {
    docTitle: "暴力摩托 · DOIN 在线小游戏",
    metaDesc:
      "暴力摩托：骑着软胶玩具摩托在落日公路上狂飙，一边超车一边挥拳把对手打下车。地下联赛 20 场换车、公路群殴与亡命冲刺，进度本机保存。",
    appTitle: "暴力摩托",
    appSubtitle: "落日公路街机",
    back: "返回门户",
    sound: "音效开关",
    soundOn: "音效已开",
    soundOff: "音效已关",
    langSwitch: "EN",
    help: "玩法说明",
    stageAria: "落日公路机车街机舞台",
    canvasAria: "伪三维公路：摩托竞速并贴身挥拳",

    modeLeague: "地下联赛",
    modeBrawl: "公路群殴",
    modeGetaway: "亡命冲刺",
    modeAria: "选择玩法模式",

    hudSpeed: "时速",
    hudPlace: "名次",
    hudStamina: "体力",
    hudBike: "车况",
    hudCash: "奖金",
    hudKo: "击倒",
    hudRival: "近身对手",
    hudWeapon: "兵器",
    hudAlert: "警灯",
    hudQuota: "配额",
    hudBust: "贴停",
    hudCruise: "巡航油门",
    keyHint: "W 油门 · S 刹车 · A D 转向 · J/空格 出拳 · K 踢腿 · P 暂停 · R 重开",
    touchHint: "左盘转向加油，右键出拳踢腿",
    weaponFist: "拳头",
    weaponClub: "棍子",
    alertQuiet: "平静",
    alertWatch: "注视",
    alertHot: "追来了",
    rivalNone: "空镜",
    placeValue: "P{n}",
    speedValue: "{n}",
    koValue: "{n}",
    quotaValue: "{n} / {need}",
    cashValue: "${n}",
    staminaValue: "{n}%",
    hpValue: "{n}/{max}",

    garageKicker: "ROAD BASH",
    garageTitle: "车库",
    garageDesc: "先点一辆摩托，再点一场比赛立刻发车。出拳和踢腿是两招：J/空格挥拳，K 侧踢。",
    garageBikes: "车库摩托",
    garageRaces: "公路赛程",
    garageTrophies: "奖杯墙",
    btnStart: "发车",
    btnBuy: "买下",
    btnOwned: "已拥有",
    btnLocked: "未解锁",
    bikeRat: "老鼠车",
    bikeStreet: "街头车",
    bikeSport: "飞车",
    bikeSunset: "落日机",
    bikeCost: "${n}",
    bikeFree: "入门免费",
    statSpeed: "极速 {n}",
    statHandle: "操控 {n}",
    statArmor: "耐打 {n}",
    toastPoor: "奖金不够",
    toastLocked: "先拿下前面的录取",
    toastBought: "新车入手！",

    tierRats: "老鼠帮",
    tierStreet: "街头",
    tierGang: "飞车党",
    tierSunset: "落日王",
    trackCoast: "海岸落日",
    trackDesert: "沙漠直道",
    trackMountain: "盘山弯道",
    trackCity: "霓虹夜城",
    trackCanyon: "峡谷落日",
    raceQualify: "录取 前 {n}",
    raceMustFirst: "必须第一",
    raceQuota: "击倒 {n}",
    raceEscape: "逃过条子",
    starsOf: "{n} / 3 星",
    trophyKo: "生涯击倒 {n}",
    trophyFly: "最远抛飞 {n} 米",
    trophyPerfect: "联赛满星 {n}",

    pauseTitle: "暂停",
    pauseDesc: "公路还在，拳头也还在。",
    btnResume: "继续骑",
    btnRetry: "重开本场",
    btnGarage: "返回车库",

    resultWin: "冲线！",
    resultLose: "坐在路肩上揉头盔",
    resultPlace: "名次",
    resultKo: "击倒",
    resultCash: "奖金",
    resultTime: "用时",
    resultCrashes: "摔车",
    resultFly: "最远抛飞",
    newBikeHint: "去车库看看新车",
    starHintLeague: "★ 录取  ★★ 领奖台  ★★★ 冠军且 3 次击倒",
    starHintBrawl: "★ 打满配额  ★★ 超额或零摔  ★★★ 超额且零摔",
    starHintGetaway: "★ 逃出生天  ★★ 无摔或未被贴停  ★★★ 两项都有",
    btnNext: "下一场",
    btnAgain: "再来一次",
    reasonQualify: "录取通过",
    reasonPlace: "名次不够",
    reasonQuota: "打满配额",
    reasonQuotaFail: "配额没打满",
    reasonEscape: "甩掉条子",
    reasonWrecked: "车子报废",
    reasonBusted: "被条子铐住",

    helpTitle: "玩法说明",
    help1: "1. W / ↑ 加油，S / ↓ 刹车，A D / ← → 转向。贴路肩会掉速，撞护栏或对向车辆会摔下车。",
    help2: "2. 空格或 J 出拳；朝对手反方向出拳是反手（更疼、更好抢棍）；K 踢腿，距离更远，容易把人踢进车流。",
    help3: "3. 对方挥棍时出拳，或用反手抽中持棍对手，就能把棍子抢过来。棍子砸 5 次后甩飞。",
    help4: "4. 体力打空或高速撞障会华丽摔车——跑去捡自己的摩托即可继续，车况扣尽才退赛。",
    help5: "5. 地下联赛：5 条公路 × 4 段位，保名次换奖金买车。公路群殴拼击倒配额。亡命冲刺别被条子贴停。",
    help6: "6. 移动端默认巡航油门，按住加速超车、点刹车入弯。暂停 / 重开随时可用，零惩罚。",
    helpClose: "我知道了",
    noscript: "需要启用 JavaScript 才能游玩暴力摩托。",
    padLeft: "左转",
    padRight: "右转",
    padAccel: "油门",
    padBrake: "刹车",
    padPunch: "出拳",
    padKick: "踢腿",
    btnPause: "暂停",
    countdownGo: "GO",
  },
  en: {
    docTitle: "Road Bash · DOIN Web Games",
    metaDesc:
      "Road Bash: race a clay toy motorcycle down a sunset highway and punch rivals off their bikes. 20-race underground league with bike upgrades, road brawls and cop getaways. Progress saves locally.",
    appTitle: "Road Bash",
    appSubtitle: "Sunset Highway Arcade",
    back: "Portal",
    sound: "Sound toggle",
    soundOn: "Sound on",
    soundOff: "Sound off",
    langSwitch: "中",
    help: "How to play",
    stageAria: "Sunset highway motorcycle arcade",
    canvasAria: "Pseudo-3D highway: race and throw fists at close range",

    modeLeague: "Underground League",
    modeBrawl: "Road Brawl",
    modeGetaway: "Getaway Sprint",
    modeAria: "Choose a mode",

    hudSpeed: "Speed",
    hudPlace: "Place",
    hudStamina: "Stamina",
    hudBike: "Bike",
    hudCash: "Cash",
    hudKo: "Takedowns",
    hudRival: "Nearest rival",
    hudWeapon: "Weapon",
    hudAlert: "Siren",
    hudQuota: "Quota",
    hudBust: "Bust",
    hudCruise: "Auto cruise",
    keyHint: "W throttle · S brake · A D steer · J/Space punch · K kick · P pause · R retry",
    touchHint: "Left pad to steer and throttle, right buttons to punch and kick",
    weaponFist: "Fists",
    weaponClub: "Club",
    alertQuiet: "Quiet",
    alertWatch: "Watched",
    alertHot: "Incoming",
    rivalNone: "Empty mirror",
    placeValue: "P{n}",
    speedValue: "{n}",
    koValue: "{n}",
    quotaValue: "{n} / {need}",
    cashValue: "${n}",
    staminaValue: "{n}%",
    hpValue: "{n}/{max}",

    garageKicker: "ROAD BASH",
    garageTitle: "Garage",
    garageDesc: "Tap a bike, then tap a race to launch immediately. Punch and kick are different moves: J/Space punches, K side-kicks.",
    garageBikes: "Bikes",
    garageRaces: "Races",
    garageTrophies: "Trophy wall",
    btnStart: "Launch",
    btnBuy: "Buy",
    btnOwned: "Owned",
    btnLocked: "Locked",
    bikeRat: "Rat Bike",
    bikeStreet: "Street Bike",
    bikeSport: "Sport Bike",
    bikeSunset: "Sunset Machine",
    bikeCost: "${n}",
    bikeFree: "Free starter",
    statSpeed: "Speed {n}",
    statHandle: "Grip {n}",
    statArmor: "Armor {n}",
    toastPoor: "Not enough cash",
    toastLocked: "Qualify the earlier races first",
    toastBought: "New bike unlocked!",

    tierRats: "Rat Pack",
    tierStreet: "Street",
    tierGang: "Road Gang",
    tierSunset: "Sunset King",
    trackCoast: "Coast Sunset",
    trackDesert: "Desert Straight",
    trackMountain: "Mountain Switchbacks",
    trackCity: "Neon City",
    trackCanyon: "Canyon Dusk",
    raceQualify: "Qualify top {n}",
    raceMustFirst: "Must finish 1st",
    raceQuota: "Takedowns {n}",
    raceEscape: "Lose the cops",
    starsOf: "{n} / 3 stars",
    trophyKo: "Career takedowns {n}",
    trophyFly: "Longest ragdoll {n} m",
    trophyPerfect: "League perfects {n}",

    pauseTitle: "Paused",
    pauseDesc: "The highway can wait.",
    btnResume: "Ride on",
    btnRetry: "Restart race",
    btnGarage: "Back to garage",

    resultWin: "Finish line!",
    resultLose: "Sitting on the shoulder, rubbing a helmet",
    resultPlace: "Place",
    resultKo: "Takedowns",
    resultCash: "Purse",
    resultTime: "Time",
    resultCrashes: "Crashes",
    resultFly: "Longest fly",
    newBikeHint: "Check the garage for a new sled",
    starHintLeague: "★ Qualify  ★★ Podium  ★★★ Win with 3 takedowns",
    starHintBrawl: "★ Hit the quota  ★★ Extra KOs or no crash  ★★★ Both",
    starHintGetaway: "★ Escape  ★★ Clean or never pinned  ★★★ Both",
    btnNext: "Next race",
    btnAgain: "One more",
    reasonQualify: "Qualified",
    reasonPlace: "Place too low",
    reasonQuota: "Quota met",
    reasonQuotaFail: "Quota missed",
    reasonEscape: "Cops lost",
    reasonWrecked: "Bike wrecked",
    reasonBusted: "Busted",

    helpTitle: "How to Play",
    help1: "1. W / ↑ throttle, S / ↓ brake, A D / arrows steer. Shoulders scrub speed; rails, cows and oncoming trucks throw you off.",
    help2: "2. Space or J punches. Punch away from the rival for a backhand (harder, better steal). K kicks farther and can shove someone into traffic.",
    help3: "3. Punch while a rival winds up a club, or backhand a club holder, to steal it. The club lasts 5 solid hits.",
    help4: "4. Empty stamina or a high-speed smash means a comedy crash — run back to your bike. Only a wrecked bike ends the race.",
    help5: "5. League: 5 highways × 4 tiers, qualify for cash and bikes. Brawl is a takedown quota. Getaway is a cop chase — don't get pinned.",
    help6: "6. Touch defaults to auto-cruise. Hold throttle to pass, tap brake for corners. Pause and retry are always free.",
    helpClose: "Got it",
    noscript: "JavaScript is required to play Road Bash.",
    padLeft: "Left",
    padRight: "Right",
    padAccel: "Throttle",
    padBrake: "Brake",
    padPunch: "Punch",
    padKick: "Kick",
    btnPause: "Pause",
    countdownGo: "GO",
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
