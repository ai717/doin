// 魔塔：勇者登顶 · 中英双语表
//
// 铁律：语言偏好统一读写全站共享 key localStorage["doin.lang"]；
// strings.en 绝无汉字（白名单仅 langBtn 的语言标识）。

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const zh = {
  langBtn: "EN",
  docTitle: "魔塔：勇者登顶 · DOIN 在线小游戏",
  appTitle: "魔塔：勇者登顶",
  back: "← 门户",
  undo: "撤销",
  undoTitle: "撤销上一步（Z）",
  manual: "图鉴",
  manualTitle: "怪物手册",
  sound: "音效",
  help: "玩法说明",
  langName: "语言",

  floorLabel: "楼层",
  floorSuffix: "层",
  hp: "生命",
  atk: "攻击",
  def: "防御",
  gold: "金币",
  exp: "经验",
  keysTitle: "钥匙",
  keyY: "黄",
  keyB: "蓝",
  keyR: "红",

  radarTitle: "本层魔物",
  radarEmpty: "本层已无活物",
  threatClear: "零战损",
  threatHurt: "可击杀",
  threatFatal: "不可敌",
  radarHint: "战损按当前攻防实时推算",
  kills: "剩余 {n}",

  shopTitle: "地牢商人",
  shopDesc: "金币换实力，每种货品越买越贵。",
  shopHp: "生命 +{n}",
  shopAtk: "攻击 +{n}",
  shopDef: "防御 +{n}",
  buy: "购买",
  poor: "金币不足",
  shopLeave: "离开",
  boughtTimes: "已购 {n}",

  compassTitle: "楼层罗盘",
  compassDesc: "传送至已探索楼层的楼梯口。",
  compassLocked: "需先拾得楼层罗盘",
  close: "关闭",

  hintWall: "石墙挡路",
  hintLocked: "缺少对应钥匙",
  hintSealed: "暗墙封死，先救出小偷",
  hintArmor: "无法破防",
  hintMortal: "强攻必死，先提升实力",
  hintNeedKey: "需要钥匙",

  victoryTitle: "登顶封魔",
  defeatTitle: "勇者陨落",
  endingTrue: "真结局：看破伪魔王幻影，击碎魔塔核心，救出公主。",
  endingNormal: "普通结局：击败伪魔王后力竭退兵，魔塔阴影未散。",
  statSteps: "总步数",
  statDamage: "累计战损",
  statSlain: "斩杀魔物",
  statHpLeft: "剩余生命",
  rankLabel: "勇者段位",
  newBest: "新纪录",
  playAgain: "重新攀登",
  continueClimb: "继续攀登",
  snapBack: "重返本层",
  restart: "重开本局",
  restartConfirm: "确定放弃当前进度，从第 1 层重来？",
  restartDone: "已重置",

  rankSwordsaint: "封魔剑圣",
  rankPaladin: "圣殿骑士",
  rankKnight: "白银骑士",
  rankGuard: "城卫队长",
  rankSquire: "见习侍从",

  bestTitle: "本机纪录",
  bestDamage: "最少战损",
  bestSteps: "最少步数",
  noRecord: "暂无",
  clearTag: "已通关",

  helpTitle: "玩法说明",
  helpMove: "方向键 / WASD 移动，Z 撤销；点击任意空地自动寻路。",
  helpBattle: "撞击怪物即结算：勇者先攻，回合数 = ⌈怪物血量 ÷ 单次伤害⌉，战损 =（回合数 − 1）× 怪物每击伤害。",
  helpDoor: "撞门消耗 1 把同色钥匙；无法破防或战损会致死时，勇者停在原地不会自杀。",
  helpShop: "踩上商店可与商人交易；同层同种货品价格逐次递增。",
  helpUndo: "撤销保留最近 30 步；踏入新楼层会自动留下快照，可随时回到该层初入状态。",
  helpSave: "进度自动保存在本机浏览器，换设备不会同步。",

  autoPathBlocked: "那里过不去",
  floorCleared: "本层已肃清",
  stairsUp: "登上 {n} 层",
  stairsDown: "回到 {n} 层",
  crossFound: "神圣十字架已入手",
  compassFound: "楼层罗盘已入手",
  thiefFreed: "小偷获救，暗墙已开",
  gainKey: "钥匙 +1",

  soundOn: "🔊",
  soundOff: "🔇",

  mon: {
    mossSlime: "苔藓黏液",
    boneScout: "枯骨斥候",
    caveBat: "洞窟蝠",
    graveBat: "坟场蝠",
    hexAcolyte: "咒术侍僧",
    graveKnight: "坟场骑士",
    boneCaptain: "骨甲队长",
    crimsonHerald: "绯衣先遣",
    orcGuard: "兽人卫兵",
    hexWarlock: "咒术术士",
    goldKnight: "金甲骑士",
    ironWarden: "铁壁守望",
    wraithMage: "幽影法师",
    zweihander: "双手剑士",
    crimsonArchmage: "绯衣大法师",
    falseDemon: "伪魔王",
    darkRider: "暗黑骑手",
    abyssDrake: "深渊亚龙",
    demonKnight: "魔将",
    trueDemon: "真·魔王",
  },

  zone: {
    1: "苔痕石厅",
    2: "幽回廊",
    3: "磐石壁垒",
    4: "熔岩深渊",
    5: "魔塔之巅",
  },
};

const en = {
  langBtn: "中文",
  docTitle: "Magic Tower: Summit · DOIN Online Games",
  appTitle: "Magic Tower",
  back: "← Portal",
  undo: "Undo",
  undoTitle: "Undo last step (Z)",
  manual: "Codex",
  manualTitle: "Monster codex",
  sound: "Sound",
  help: "How to play",
  langName: "Language",

  floorLabel: "Floor",
  floorSuffix: "F",
  hp: "HP",
  atk: "ATK",
  def: "DEF",
  gold: "Gold",
  exp: "EXP",
  keysTitle: "Keys",
  keyY: "Yellow",
  keyB: "Blue",
  keyR: "Red",

  radarTitle: "Floor monsters",
  radarEmpty: "This floor is clear",
  threatClear: "No loss",
  threatHurt: "Beatable",
  threatFatal: "Deadly",
  radarHint: "Loss is computed from your current stats",
  kills: "Left {n}",

  shopTitle: "Dungeon peddler",
  shopDesc: "Trade gold for power. Every purchase of the same ware costs more.",
  shopHp: "HP +{n}",
  shopAtk: "ATK +{n}",
  shopDef: "DEF +{n}",
  buy: "Buy",
  poor: "Not enough gold",
  shopLeave: "Leave",
  boughtTimes: "Bought {n}",

  compassTitle: "Floor compass",
  compassDesc: "Warp to the stairs of any explored floor.",
  compassLocked: "Find the floor compass first",
  close: "Close",

  hintWall: "Solid stone",
  hintLocked: "You have no key of that colour",
  hintSealed: "Sealed wall — free the thief first",
  hintArmor: "Cannot pierce its armour",
  hintMortal: "Certain death — grow stronger first",
  hintNeedKey: "Key required",

  victoryTitle: "Summit Sealed",
  defeatTitle: "The Hero Falls",
  endingTrue: "True ending: the false demon's veil is torn, the tower's core shattered, the princess freed.",
  endingNormal: "Normal ending: the false demon falls, but the tower's shadow lingers — you withdraw.",
  statSteps: "Steps",
  statDamage: "Damage taken",
  statSlain: "Monsters slain",
  statHpLeft: "HP left",
  rankLabel: "Rank",
  newBest: "New record",
  playAgain: "Climb again",
  continueClimb: "Keep climbing",
  snapBack: "Rewind floor",
  restart: "Restart run",
  restartConfirm: "Abandon this run and start again from floor 1?",
  restartDone: "Run reset",

  rankSwordsaint: "Demon-Sealing Sword Saint",
  rankPaladin: "Temple Paladin",
  rankKnight: "Silver Knight",
  rankGuard: "City Watch Captain",
  rankSquire: "Apprentice Squire",

  bestTitle: "Local records",
  bestDamage: "Lowest damage",
  bestSteps: "Fewest steps",
  noRecord: "None yet",
  clearTag: "Cleared",

  helpTitle: "How to play",
  helpMove: "Arrow keys / WASD to move, Z to undo. Click any open tile to auto-path there.",
  helpBattle: "Walking into a monster resolves instantly: the hero strikes first. Turns = ⌈monster HP ÷ your damage⌉, loss = (turns − 1) × its damage per hit.",
  helpDoor: "A door consumes one key of its colour. If you cannot pierce armour or the fight would kill you, the hero stays put instead of suiciding.",
  helpShop: "Step on a shop tile to trade. Each purchase of the same ware on that floor costs more.",
  helpUndo: "Undo keeps the last 30 steps. Entering a new floor leaves a snapshot you can return to at any time.",
  helpSave: "Progress is saved in this browser only — it does not sync across devices.",

  autoPathBlocked: "No way through",
  floorCleared: "Floor cleared",
  stairsUp: "Ascend to floor {n}",
  stairsDown: "Return to floor {n}",
  crossFound: "Holy cross acquired",
  compassFound: "Floor compass acquired",
  thiefFreed: "Thief freed — the sealed wall opens",
  gainKey: "Key +1",

  soundOn: "🔊",
  soundOff: "🔇",

  mon: {
    mossSlime: "Moss Slime",
    boneScout: "Bone Scout",
    caveBat: "Cave Bat",
    graveBat: "Grave Bat",
    hexAcolyte: "Hex Acolyte",
    graveKnight: "Grave Knight",
    boneCaptain: "Bone Captain",
    crimsonHerald: "Crimson Herald",
    orcGuard: "Orc Guard",
    hexWarlock: "Hex Warlock",
    goldKnight: "Gilt Knight",
    ironWarden: "Iron Warden",
    wraithMage: "Wraith Mage",
    zweihander: "Zweihander",
    crimsonArchmage: "Crimson Archmage",
    falseDemon: "False Demon",
    darkRider: "Dark Rider",
    abyssDrake: "Abyss Drake",
    demonKnight: "Demon Knight",
    trueDemon: "True Demon",
  },

  zone: {
    1: "Mossy Halls",
    2: "Hollow Cloister",
    3: "Bastion of Stone",
    4: "Molten Abyss",
    5: "Tower Summit",
  },
};

export const strings = { zh, en };
export const LOCALES = ["zh", "en"];

export function normalizeLocale(value) {
  return value === "en" ? "en" : "zh";
}

export function htmlLang(locale) {
  return locale === "en" ? "en" : "zh-CN";
}

export function translate(locale, key, vars) {
  const table = strings[normalizeLocale(locale)] || zh;
  let text = table[key];
  if (text === undefined) text = zh[key];
  if (text === undefined) return key;
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
}

export function monsterName(locale, id) {
  const table = strings[normalizeLocale(locale)] || zh;
  return table.mon[id] || zh.mon[id] || id;
}

export function zoneName(locale, zone) {
  const table = strings[normalizeLocale(locale)] || zh;
  return table.zone[zone] || zh.zone[zone] || String(zone);
}
