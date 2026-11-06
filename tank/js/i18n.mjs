// Tank Assault - bilingual centre. The English table holds zero CJK characters.
const zh = {
  docTitle: "坦克巷战 · DOIN 在线小游戏",
  docDesc:
    "驾驶俯视坦克在街巷沙盘里拆砖开路，借钢壁跳弹打拐角，守住司令部鹰标并全歼来犯装甲。6 章 24 关战役 + 死守波次 + 8 张残局推演。",
  gameTitle: "坦克巷战",
  backHome: "返回门户",
  btnSound: "音效",
  btnHelp: "作战命令",
  noscript: "需要启用 JavaScript 才能游玩。",

  tagline: "在街巷沙盘里拆砖开路，借钢壁跳弹打拐角，守住司令部鹰标并全歼来犯装甲",
  menuTitle: "选择作战",
  menuHint: "三种作战各自记录进度，随时可以切换",

  modeCampaign: "战役推进",
  modeCampaignSub: "6 章 24 关 · 三星评级 · 战区勋章",
  modeSiege: "死守要地",
  modeSiegeSub: "单盘无尽波次 · 比拼坚守波数与时长",
  modePuzzle: "残局推演",
  modePuzzleSub: "8 张残局 · 限弹限时 · 纯策略解谜",

  chapter_1: "新兵训练场",
  chapter_2: "钢壁街区",
  chapter_3: "密林伏击",
  chapter_4: "冰河渡口",
  chapter_5: "工兵突袭",
  chapter_6: "铁壁要塞",
  chapterLocked: "通关上一章解锁",
  stageLocked: "先通关上一关",
  stage: "第 {n} 关",
  puzzle: "第 {n} 题",
  fortress: "要塞关",

  hudEnemy: "剩余敌军",
  hudLives: "坦克储备",
  hudBase: "司令部",
  hudScore: "战功",
  hudTime: "用时",
  hudLeft: "剩余",
  hudWave: "波次",
  hudAmmo: "弹匣",
  hudCharge: "充能",
  hudOrder: "指令",
  hudStar: "火力",

  o_artillery: "覆盖炮击",
  o_fortify: "紧急筑垒",
  o_jam: "电子干扰",

  p_star: "火力升级",
  p_helmet: "护盾",
  p_grenade: "手雷",
  p_shovel: "铁锹",
  p_extra_life: "增援坦克",
  p_clock: "冻结",

  e_scout: "侦察兵",
  e_standard: "标准型",
  e_rapid: "速射型",
  e_armor: "重甲型",
  e_sapper: "工兵",
  e_sniper: "狙击手",

  helpTitle: "作战命令",
  helpBody:
    "方向键或 WASD 行驶，空格 / J 开炮，K 发动指令。炮弹一次只削掉半格砖墙，开一条通道要两炮。清光本关全部敌坦即通关；司令部耐久归零或坦克打光即失败。",
  helpKeys: "转向即时生效，转弯会自动吸附到网格，绝不会卡墙角；开火按住即可连射。",
  helpRicochet:
    "钢墙是一面镜子：炮弹撞上去会反弹一次，可以打拐角，也会打中你自己。反弹前会画出虚线预示轨迹。升到三星火力后，炮弹改为直接击碎钢墙。",
  helpOrders:
    "每击毁一辆敌坦积攒充能，满格后可发动当前指令：覆盖炮击（前方一片齐射）、紧急筑垒（司令部临时包上钢墙）、电子干扰（全场敌坦冻结）。三个指令轮流出现。",
  helpModes:
    "战役共 6 章 24 关，每关三星分别奖励：司令部零损伤、限时内清场、我方零阵亡。死守记录你撑过的波数；残局给定地形与限定弹匣，考的是读图。",

  keysTitle: "键盘按键",
  keyMove: "行驶",
  keyMoveVal: "方向键 / WASD",
  keyFire: "开炮",
  keyFireVal: "空格 / J（按住连射）",
  keyOrder: "发动指令",
  keyOrderVal: "K / Shift",
  keyPause: "暂停 / 继续",
  keyPauseVal: "P / Esc",
  keyRestart: "重打本关",
  keyRestartVal: "R",

  resultCleared: "战场肃清",
  resultLostBase: "司令部陷落",
  resultLostLives: "装甲打光",
  resultLostTime: "时间耗尽",
  resultLostAmmo: "弹药耗尽",
  resultSiegeEnd: "防线失守",

  statTime: "用时",
  statScore: "战功",
  statBonus: "过关奖励",
  statBricks: "拆砖",
  statRicochet: "跳弹命中",
  statAcc: "命中率",
  statCombo: "最长连杀",
  statWave: "坚守波数",
  statAmmo: "剩余弹匣",
  statHold: "坚守时长",

  starBase: "司令部零损伤",
  starTime: "限时内清场",
  starLoss: "我方零阵亡",

  btnResume: "继续作战",
  btnRestart: "重打本关",
  btnRetry: "再来一次",
  btnNext: "下一关",
  btnMap: "作战地图",
  btnMenu: "返回司令部",
  btnClose: "关闭",

  paused: "暂停",
  newRecord: "新纪录",
  assistLabel: "跳弹预示",
  assistOn: "开",
  assistOff: "关",

  recStars: "累计星章",
  recCleared: "已清关卡",
  recWave: "最高波数",
  recHold: "最长坚守",
  recCombo: "最长连杀",
  recKills: "累计击毁",
  recBricks: "累计拆砖",
  recRicochet: "跳弹命中",
  recAcc: "命中率",

  tapeKill: "击毁{type} +{score}",
  tapeBase: "司令部受创 耐久{hp}",
  tapePick: "拾取{kind}",
  tapeWave: "第{n}波来袭",
  tapeRico: "跳弹命中 +{score}",
  tapeSteel: "击碎钢壁",
  tapeReady: "战斗开始",
  langName: "中文",
};

const en = {
  docTitle: "Tank Assault · DOIN games",
  docDesc:
    "Drive a top-down tank through street-grid sand tray: blow bricks to open lanes, ricochet shells off steel to shoot around corners, defend the HQ eagle and wipe out every hostile. 24 campaign stages, endless Last Stand, 8 breakthrough puzzles.",
  gameTitle: "Tank Assault",
  backHome: "Home",
  btnSound: "Sound",
  btnHelp: "Orders",
  noscript: "JavaScript is required to play.",

  tagline:
    "Blast bricks open across a street sandbox, bank shells off steel walls to hit around corners, hold the eagle HQ and wipe out every hostile tank",
  menuTitle: "Choose Your Operation",
  menuHint: "Each operation keeps its own progress, switch at any time",

  modeCampaign: "Campaign",
  modeCampaignSub: "24 stages over 6 chapters - three stars each, theatre medals",
  modeSiege: "Last Stand",
  modeSiegeSub: "Endless waves on one board - survive as long as you can",
  modePuzzle: "Breakthrough",
  modePuzzleSub: "8 hand-set boards - limited ammo, pure tactics",

  chapter_1: "Boot Camp",
  chapter_2: "Steel Blocks",
  chapter_3: "Forest Ambush",
  chapter_4: "Frozen Crossing",
  chapter_5: "Sapper Raid",
  chapter_6: "Iron Fortress",
  chapterLocked: "Clear the previous chapter",
  stageLocked: "Clear the previous stage",
  stage: "Stage {n}",
  puzzle: "Puzzle {n}",
  fortress: "Fortress",

  hudEnemy: "Hostiles",
  hudLives: "Reserve",
  hudBase: "HQ",
  hudScore: "Merit",
  hudTime: "Time",
  hudLeft: "Left",
  hudWave: "Wave",
  hudAmmo: "Ammo",
  hudCharge: "Charge",
  hudOrder: "Order",
  hudStar: "Firepower",

  o_artillery: "Artillery",
  o_fortify: "Fortify",
  o_jam: "Jamming",

  p_star: "Firepower",
  p_helmet: "Shield",
  p_grenade: "Grenade",
  p_shovel: "Shovel",
  p_extra_life: "Reinforcement",
  p_clock: "Freeze",

  e_scout: "Scout",
  e_standard: "Standard",
  e_rapid: "Rapid",
  e_armor: "Armored",
  e_sapper: "Sapper",
  e_sniper: "Sniper",

  helpTitle: "Field Orders",
  helpBody:
    "Drive with arrows or WASD, fire with Space or J, spend an order with K. A shell strips half a brick tile, so a one-lane corridor takes two shots. Wipe out every hostile tank to clear the stage; you lose when HQ structure hits zero or your reserve runs dry.",
  helpKeys:
    "Turning is instant and snaps to the grid, so corners never trap you. Hold fire for a steady stream - the cannon throttles itself.",
  helpRicochet:
    "Steel walls behave like mirrors: a shell bounces once off them, which lets you shoot around corners and lets you shoot yourself. The bounce path is previewed as a dashed line. At three-star firepower shells break steel outright instead.",
  helpOrders:
    "Every kill charges the order slot. When full you can fire the current order: Artillery (a barrage ahead), Fortify (wrap HQ in temporary steel), or Jamming (freeze every hostile). The three rotate.",
  helpModes:
    "The campaign runs 24 stages over 6 chapters, each granting three stars for: HQ untouched, cleared under par time, and no losses. Last Stand records how many waves you held; Breakthrough hands you a fixed board and a limited magazine.",

  keysTitle: "Keyboard",
  keyMove: "Drive",
  keyMoveVal: "Arrows / WASD",
  keyFire: "Fire",
  keyFireVal: "Space / J (hold to stream)",
  keyOrder: "Use order",
  keyOrderVal: "K / Shift",
  keyPause: "Pause / resume",
  keyPauseVal: "P / Esc",
  keyRestart: "Restart stage",
  keyRestartVal: "R",

  resultCleared: "Field Cleared",
  resultLostBase: "HQ Lost",
  resultLostLives: "Reserve Gone",
  resultLostTime: "Time Up",
  resultLostAmmo: "Out of Ammo",
  resultSiegeEnd: "Line Broken",

  statTime: "Time",
  statScore: "Merit",
  statBonus: "Bonus",
  statBricks: "Bricks",
  statRicochet: "Ricochets",
  statAcc: "Accuracy",
  statCombo: "Best chain",
  statWave: "Waves held",
  statAmmo: "Ammo left",
  statHold: "Hold time",

  starBase: "HQ untouched",
  starTime: "Under par time",
  starLoss: "No losses",

  btnResume: "Resume",
  btnRestart: "Restart",
  btnRetry: "Retry",
  btnNext: "Next stage",
  btnMap: "Map",
  btnMenu: "Headquarters",
  btnClose: "Close",

  paused: "Paused",
  newRecord: "New record",
  assistLabel: "Bounce preview",
  assistOn: "On",
  assistOff: "Off",

  recStars: "Stars",
  recCleared: "Cleared",
  recWave: "Best wave",
  recHold: "Longest hold",
  recCombo: "Best chain",
  recKills: "Kills",
  recBricks: "Bricks",
  recRicochet: "Ricochets",
  recAcc: "Accuracy",

  tapeKill: "{type} destroyed +{score}",
  tapeBase: "HQ hit, structure {hp}",
  tapePick: "Picked up {kind}",
  tapeWave: "Wave {n} incoming",
  tapeRico: "Ricochet hit +{score}",
  tapeSteel: "Steel wall broken",
  tapeReady: "Battle started",
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

export function langLabel(lang) {
  return normalizeLang(lang) === "zh" ? "EN" : "中文";
}
