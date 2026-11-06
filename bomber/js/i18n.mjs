// Bomber - bilingual centre. English table holds zero CJK characters.
const zh = {
  gameTitle: "炸弹人",
  backHome: "返回门户",
  btnSound: "音效",
  btnHelp: "玩法",
  noscript: "需要启用 JavaScript 才能游玩。",

  tagline: "在街区沙盘里放定时炸弹，十字爆风炸砖拾道具，把气球怪堵进死胡同",
  modeCampaign: "街区闯关",
  modeCampaignSub: "5 章 40 关 · 道具成长 · 星级拆迁",
  modePuzzle: "连锁爆破",
  modePuzzleSub: "24 道限弹解谜 · 一连锁全清",
  btnPlay: "开始拆迁",
  btnWorkshop: "街区工坊",
  btnClose: "关闭",

  chapter_1: "阳光街区",
  chapter_2: "工地迷阵",
  chapter_3: "旧城暗巷",
  chapter_4: "港口货仓",
  chapter_5: "机械气球王",
  chapterLocked: "通关上一章解锁",
  stageLocked: "先通关上一关",
  stage: "第 {n} 关",
  puzzleTitle: "第 {n} 题",

  hudLevel: "关卡",
  hudEnemies: "敌人",
  hudTargets: "靶球",
  hudTime: "时间",
  hudDemo: "拆迁率",
  hudChain: "连锁",
  hudBombs: "弹量",
  hudFire: "火力",
  hudSpeed: "速度",
  hudParts: "零件",

  p_fire: "火力",
  p_bomb: "弹量",
  p_speed: "速度",
  p_kick: "踢弹",
  p_remote: "遥控",
  p_pierce: "穿透",
  p_shield: "护盾",
  p_curse: "诅咒",

  e_balloon: "气球虫",
  e_chaser: "追击者",
  e_evader: "躲避者",
  e_ghost: "幽灵",
  e_armored: "装甲弹",
  e_boss: "机械气球王",
  e_target: "演练靶",

  curse_slow: "迟钝",
  curse_reverse: "反向",
  curse_weak: "哑弹",
  curse_fever: "手抖",

  helpTitle: "玩法",
  helpBody:
    "方向键或 WASD 移动，空格 / J 放炸弹，K 遥控引爆（拾取遥控后）。炸弹 2.4 秒后炸出十字爆风：炸开软砖、烧掉道具、连锁引爆其它炸弹，也会炸死你自己。清光全部敌人后，出口门从砖下升起，踩上去通关。移动端可用虚拟摇杆，也可以直接点格子自动寻路。",
  helpPuzzle:
    "演练模式下你不会被爆风伤到：在限定弹数内摆好炸弹，让第一颗的爆风连锁点燃其余炸弹，一次清掉全部演练靶。用弹越少星级越高。",

  resultWin: "街区清空",
  resultLose: "被自己炸了",
  resultTimeout: "时间到",
  resultSolved: "爆破方案成立",
  statTime: "用时",
  statDemo: "拆迁率",
  statChain: "最大连锁",
  statBombs: "用弹",
  statPar: "标准",
  oneChain: "单连锁",
  btnRetry: "再拆一次",
  btnNext: "下一关",
  btnMap: "返回街区图",

  wsTitle: "街区工坊",
  wsParts: "零件",
  wsHint: "拆迁率与连锁纪录会换成零件，用来解锁起手加成",
  u_bomb: "备用弹匣",
  u_bombDesc: "开局多带 1 枚炸弹",
  u_fire: "加长引信",
  u_fireDesc: "开局火力 +1",
  u_shield: "护胸软垫",
  u_shieldDesc: "开局带 1 层护盾",
  btnUnlock: "解锁",
  unlocked: "已解锁",
  recChain: "最大连锁",
  recDemo: "最高拆迁率",
  recStars: "累计星级",

  assistLabel: "爆风预警",
  assistOn: "开",
  assistOff: "关",
  paused: "暂停",
  btnResume: "继续",
  btnRestart: "重开本关",
  newRecord: "新纪录",
  langName: "中文",
};

const en = {
  gameTitle: "Bomber",
  backHome: "Home",
  btnSound: "Sound",
  btnHelp: "Help",
  noscript: "JavaScript is required to play.",

  tagline: "Drop timed bombs across a blocky sandbox, blow bricks open and corner the balloons",
  modeCampaign: "Block Raid",
  modeCampaignSub: "40 stages over 5 chapters - power-up growth, star demolition",
  modePuzzle: "Chain Blast",
  modePuzzleSub: "24 bomb-budget puzzles - clear in one chain",
  btnPlay: "Start Demolition",
  btnWorkshop: "Workshop",
  btnClose: "Close",

  chapter_1: "Sunlit Block",
  chapter_2: "Construction Yard",
  chapter_3: "Old Town Alley",
  chapter_4: "Dock Warehouses",
  chapter_5: "Mech Balloon King",
  chapterLocked: "Clear the previous chapter",
  stageLocked: "Clear the previous stage",
  stage: "Stage {n}",
  puzzleTitle: "Puzzle {n}",

  hudLevel: "Stage",
  hudEnemies: "Enemies",
  hudTargets: "Targets",
  hudTime: "Time",
  hudDemo: "Demo",
  hudChain: "Chain",
  hudBombs: "Bombs",
  hudFire: "Fire",
  hudSpeed: "Speed",
  hudParts: "Parts",

  p_fire: "Fire",
  p_bomb: "Bomb",
  p_speed: "Speed",
  p_kick: "Kick",
  p_remote: "Remote",
  p_pierce: "Pierce",
  p_shield: "Shield",
  p_curse: "Curse",

  e_balloon: "Balloon",
  e_chaser: "Chaser",
  e_evader: "Dodger",
  e_ghost: "Ghost",
  e_armored: "Armored",
  e_boss: "Mech King",
  e_target: "Target",

  curse_slow: "Sluggish",
  curse_reverse: "Reversed",
  curse_weak: "Dud",
  curse_fever: "Twitchy",

  helpTitle: "How to Play",
  helpBody:
    "Move with arrows or WASD, drop a bomb with Space or J, trigger it early with K once you own the remote. Bombs blow a cross-shaped blast 2.4 seconds later: bricks break, power-ups burn, other bombs chain - and the blast kills you too. Clear every enemy, then step into the exit door that rises from under a brick. On touch, use the stick or tap a tile to walk there automatically.",
  helpPuzzle:
    "In Chain Blast the blast cannot hurt you: place your limited bombs so the first blast chains into the rest and wipes every target. Fewer bombs means more stars.",

  resultWin: "Block Cleared",
  resultLose: "Self-Destruct",
  resultTimeout: "Time Up",
  resultSolved: "Plan Works",
  statTime: "Time",
  statDemo: "Demo",
  statChain: "Max chain",
  statBombs: "Bombs",
  statPar: "Par",
  oneChain: "One-Chain",
  btnRetry: "Again",
  btnNext: "Next",
  btnMap: "Map",

  wsTitle: "Workshop",
  wsParts: "Parts",
  wsHint: "Demolition rate and chain records turn into parts for starting perks",
  u_bomb: "Spare Magazine",
  u_bombDesc: "Start with 1 extra bomb",
  u_fire: "Longer Fuse",
  u_fireDesc: "Start with +1 fire",
  u_shield: "Foam Vest",
  u_shieldDesc: "Start with 1 shield",
  btnUnlock: "Unlock",
  unlocked: "Owned",
  recChain: "Max chain",
  recDemo: "Best demo",
  recStars: "Stars",

  assistLabel: "Blast Warning",
  assistOn: "On",
  assistOff: "Off",
  paused: "Paused",
  btnResume: "Resume",
  btnRestart: "Restart",
  newRecord: "New record",
  langName: "中文",
};

const DICT = { zh, en };
export const LANGS = ["zh", "en"];
export const LANG_KEY = "doin.lang";

const DEFAULT_LANG = "zh";

export function normalizeLang(value) {
  return value === "en" ? "en" : "zh";
}

export function readLang(storage) {
  try {
    return normalizeLang(storage?.getItem?.(LANG_KEY));
  } catch {
    return DEFAULT_LANG;
  }
}

export function writeLang(storage, lang) {
  try {
    storage?.setItem?.(LANG_KEY, normalizeLang(lang));
  } catch {
    /* storage may be unavailable */
  }
}

export function t(key, lang = DEFAULT_LANG) {
  const table = DICT[normalizeLang(lang)] ?? zh;
  return table[key] ?? zh[key] ?? key;
}

export function format(key, lang = DEFAULT_LANG, vars = {}) {
  return t(key, lang).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

export function dict(lang = DEFAULT_LANG) {
  return DICT[normalizeLang(lang)] ?? zh;
}

export function otherLang(lang) {
  return normalizeLang(lang) === "zh" ? "en" : "zh";
}
