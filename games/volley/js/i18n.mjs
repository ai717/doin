// Volley Bombard — bilingual center. Shared site preference localStorage["doin.lang"].
// Language switch is in-place text hot-update only: never reload, never reset a match.

const LANG_KEY = "doin.lang";

export const STRINGS = {
  zh: {
    docTitle: "隔山打牛 · Volley | DOIN",
    brand: "隔山打牛",
    tagline: "双人抛物轰炸 · 积木堡垒攻防",    backHome: "← 门户",
    mode2p: "双人",
    modeAi: "单人",
    terrain: "山体",
    pause: "暂停",
    resume: "继续",
    soundOn: "音效开",
    soundOff: "音效关",
    help: "玩法",
    langBtn: "EN",
    player1: "红方",
    player2: "蓝方",
    aiLabel: "AI 对手",
    you: "你",
    roundLabel: "第 {n} 回合",
    windLabel: "风力",
    windNone: "无风",
    windLeft: "← {n}",
    windRight: "{n} →",
    angleLabel: "仰角",
    powerLabel: "蓄力",
    weaponLabel: "弹药",
    fire: "开炮",
    hitRate: "命中率",
    bestShot: "单发最高",
    blocksLeft: "剩余积木",
    terrainHill: "矮丘",
    terrainPeak: "高峰",
    terrainTwin: "双峰",
    aiRookie: "新手",
    aiVeteran: "进阶",
    aiMaster: "大师",
    weaponStone: "石弹",
    weaponBlast: "爆裂",
    weaponSplit: "分裂",
    weaponSticky: "粘性",
    weaponDrill: "钻地",
    weaponBalloon: "气球",
    weaponStoneDesc: "直击单点伤害高",
    weaponBlastDesc: "范围爆破震塌支点",
    weaponSplitDesc: "顶点三分覆盖多头",
    weaponStickyDesc: "落地粘附延迟引爆",
    weaponDrillDesc: "穿透首块内部起爆",
    weaponBalloonDesc: "慢速飘飞强受风力",
    loadoutTitle: "选弹药",
    settingsTitle: "模式与山体",
    modeSegment: "模式",
    aiLevelSegment: "AI 难度",
    terrainSegment: "山体",
    applySettings: "开始新对局",
    toastMode2p: "双人同屏 · 红方先行",
    toastModeAi: "单人挑战 AI（你执红方）",
    toastTerrain: "山体已切换 · 新对局生效",
    toastAiLevel: "AI 难度已切换",
    toastAutoPause: "切到后台，已自动暂停",
    helpTitle: "玩法说明",
    helpGoal: "调仰角、拉蓄力，看山顶风旗修正弹道；把对手堡垒轰到旗帜倒塌即胜。十回合未倒旗，按剩余积木判胜。",
    helpWeapons: "六种弹药各有性格：石弹直击、爆裂震塌、分裂覆盖、粘弹延迟、钻弹穿心、气球随风。自伤同样计入，小心炸到自家堡垒。",
    helpKeys: "红方：A / D 调角，W / S 蓄力，数字 1-6 或 Q / E 换弹，空格开炮。蓝方：← / → 调角，↑ / ↓ 蓄力，回车开炮。",
    helpPause: "P / Esc / 空格 暂停或继续；切后台自动冻结。AI 回合自动开炮，可随时暂停。",
    mode: "模式",
    wind: "风",
    angle: "仰角",
    power: "蓄力",
    blocks: "积木",
    shots: "发数",
    hitRate: "命中",
    bestSingle: "最高单发",
    angleUp: "增大仰角",
    angleDown: "减小仰角",
    ariaMode: "打开模式面板",
    ariaWeapons: "选择弹药",
    dragHint: "拖拽沙盘或 ← → 调角 · 长按蓄力",
    keyHint: "P / Esc 暂停",
    legendGoal: "轰塌对方堡垒令旗帜倒下即胜；十回合后按剩余积木判定。",
    modeTitle: "模式沙盘",
    groupOpponent: "对手",
    ariaOpponent: "选择对手",
    ariaAiLevel: "选择 AI 难度",
    groupTerrain: "山体",
    ariaTerrain: "选择山体",
    statMatches: "总局",
    statP1: "西军胜",
    statP2: "东军胜",
    statHit: "最佳命中",
    statSingle: "最佳单发",
    applyRestart: "应用并重开",
    pauseToMode: "切换模式",
    btnToMode: "切换模式",
    helpWind: "山顶风旗指示风向与风力（±5 档），炮弹飞行中会被风横向推动——远距离尤其要预留提前量。",
    helpTerrain: "沙盘三种山体：矮丘、高峰、双峰。模式面板可随时切换并重开一局。",
    helpClose: "知道了",
    pauseTitle: "已暂停",
    pauseHint: "炮弹、风与 AI 已全部冻结。",
    resumeGame: "继续游戏",
    restartMatch: "重开本局",
    resultTitle: "堡垒倒塌",
    resultWinP1: "红方获胜",
    resultWinP2: "蓝方获胜",
    resultWinYou: "你赢了",
    resultWinAi: "AI 获胜",
    resultDraw: "平局",
    resultFlagFall: "旗帜倒塌 · 直接轰塌",
    resultByBlocks: "十回合终局 · 积木多者胜",
    resultBlocks: "剩余积木 {a} : {b}",
    statHits: "命中 {h} / {s}",
    btnRematch: "再战一局",
    btnChangeMode: "模式与山体",
    btnClose: "关闭",
    suggestTitle: "再来一局？",
    bannerTurn: "{name} 的回合",
    bannerFlagDown: "旗倒 · 堡垒塌",
    bannerWindShift: "风向改变",
    toastNoShot: "未命中",
    statShots: "炮击 {n}",
    legendWind: "山顶风旗 · 风随回合变换",
    ariaArena: "隔山打牛对局区域",
    ariaCanvas: "炮弹弹道画布",
    ariaSound: "音效开关",
    ariaLang: "切换语言",
    ariaPause: "暂停或继续",
    ariaHelp: "查看玩法说明",
    ariaSettings: "打开模式设置",
    ariaClose: "关闭面板",
    footerHint: "P / Esc 暂停 · 切后台自动冻结",
    soundUnavailable: "当前浏览器不支持 WebAudio，已静默降级",
  },
  en: {
    docTitle: "Volley Bombard · DOIN",
    brand: "VOLLEY BOMBARD",
    tagline: "Two-player parabolic siege · block fortress duel",
    backHome: "← Portal",
    mode2p: "2P",
    modeAi: "Solo",
    terrain: "Hill",
    pause: "Pause",
    resume: "Resume",
    soundOn: "Sound On",
    soundOff: "Sound Off",
    help: "How",
    langBtn: "中文",
    player1: "RED",
    player2: "BLUE",
    aiLabel: "AI RIVAL",
    you: "YOU",
    roundLabel: "ROUND {n}",
    windLabel: "WIND",
    windNone: "CALM",
    windLeft: "← {n}",
    windRight: "{n} →",
    angleLabel: "ANGLE",
    powerLabel: "POWER",
    weaponLabel: "AMMO",
    fire: "FIRE",
    hitRate: "ACCURACY",
    bestShot: "BEST SHOT",
    blocksLeft: "BLOCKS LEFT",
    terrainHill: "Low Hill",
    terrainPeak: "High Peak",
    terrainTwin: "Twin Peaks",
    aiRookie: "Rookie",
    aiVeteran: "Veteran",
    aiMaster: "Master",
    weaponStone: "Stone",
    weaponBlast: "Blast",
    weaponSplit: "Split",
    weaponSticky: "Sticky",
    weaponDrill: "Drill",
    weaponBalloon: "Balloon",
    weaponStoneDesc: "Direct hit, heavy single-point damage",
    weaponBlastDesc: "Wide blast, shatters support blocks",
    weaponSplitDesc: "Splits in three at the apex",
    weaponStickyDesc: "Lands, sticks, then detonates",
    weaponDrillDesc: "Pierces the first block, bursts inside",
    weaponBalloonDesc: "Slow float, strongly wind-driven",
    loadoutTitle: "AMMO",
    settingsTitle: "Mode & Hill",
    modeSegment: "MODE",
    aiLevelSegment: "AI LEVEL",
    terrainSegment: "TERRAIN",
    applySettings: "START NEW MATCH",
    toastMode2p: "Local versus · RED fires first",
    toastModeAi: "Solo vs AI (you are RED)",
    toastTerrain: "Terrain switched · applies to new match",
    toastAiLevel: "AI level switched",
    toastAutoPause: "Tab lost focus — auto paused",
    helpTitle: "How to play",
    helpGoal: "Set the angle, charge the shot, read the wind flag on the hilltop. Topple the rival flag by collapsing its fortress to win. After ten rounds the most standing blocks wins.",
    helpWeapons: "Six shells with distinct tempers: stone pierces, blast shakes, split covers, sticky lingers, drill burrows, balloon rides the wind. Self-damage counts — mind your own fort.",
    helpKeys: "RED: A / D angle, W / S power, 1-6 or Q / E ammo, Space fire. BLUE: ← / → angle, ↑ / ↓ power, Enter fire.",
    helpPause: "P / Esc / Space pauses anytime; switching tabs auto-freezes. The AI fires on its own turn — pause is always available.",
    mode: "MODE",
    wind: "WIND",
    angle: "ANGLE",
    power: "POWER",
    blocks: "BLOCKS",
    shots: "SHOTS",
    hitRate: "HITS",
    bestSingle: "BEST",
    angleUp: "Increase angle",
    angleDown: "Decrease angle",
    ariaMode: "Open mode panel",
    ariaWeapons: "Choose ammo",
    dragHint: "Drag board or ← → to aim · hold to charge",
    keyHint: "P / Esc to pause",
    legendGoal: "Topple the rival flag by collapsing its fortress; after ten rounds most blocks wins.",
    modeTitle: "MODE TABLE",
    groupOpponent: "OPPONENT",
    ariaOpponent: "Choose opponent",
    ariaAiLevel: "Choose AI level",
    groupTerrain: "TERRAIN",
    ariaTerrain: "Choose terrain",
    statMatches: "MATCHES",
    statP1: "WEST WINS",
    statP2: "EAST WINS",
    statHit: "BEST ACC",
    statSingle: "BEST SHOT",
    applyRestart: "APPLY & RESTART",
    pauseToMode: "Switch mode",
    btnToMode: "Switch mode",
    helpWind: "The hilltop flag shows wind direction and force (±5). Shells drift mid-flight — allow for lead at long range.",
    helpTerrain: "Three table terrains: Low Hill, High Peak, Twin Peaks. Switch anytime from the mode panel.",
    helpClose: "Got it",
    pauseTitle: "PAUSED",
    pauseHint: "Shells, wind and AI are frozen.",
    resumeGame: "Resume",
    restartMatch: "Restart match",
    resultTitle: "FORTRESS DOWN",
    resultWinP1: "RED WINS",
    resultWinP2: "BLUE WINS",
    resultWinYou: "YOU WIN",
    resultWinAi: "AI WINS",
    resultDraw: "DRAW",
    resultFlagFall: "Flag toppled · fortress collapsed",
    resultByBlocks: "Ten rounds · most blocks standing wins",
    resultBlocks: "Blocks standing {a} : {b}",
    statHits: "Hits {h} / {s}",
    btnRematch: "Rematch",
    btnChangeMode: "Mode & Hill",
    btnClose: "Close",
    suggestTitle: "One more?",
    bannerTurn: "{name}'s turn",
    bannerFlagDown: "FLAG DOWN",
    bannerWindShift: "Wind shifted",
    toastNoShot: "Missed",
    statShots: "Shots {n}",
    legendWind: "Hilltop wind flag · shifts every round",
    ariaArena: "Volley Bombard arena",
    ariaCanvas: "Shell trajectory canvas",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaPause: "Pause or resume",
    ariaHelp: "Open how-to-play",
    ariaSettings: "Open mode settings",
    ariaClose: "Close panel",
    footerHint: "P / Esc to pause · auto-freeze on tab blur",
    soundUnavailable: "WebAudio unavailable — running silently",
  },
};

let current = null;

function readStoredLang() {
  try {
    const value = localStorage.getItem(LANG_KEY);
    if (value === "zh" || value === "en") return value;
  } catch {
    /* storage unavailable: fall through to navigator */
  }
  try {
    const nav = typeof navigator !== "undefined" ? navigator.language : "";
    if (typeof nav === "string" && nav.toLowerCase().startsWith("zh")) return "zh";
  } catch {
    /* ignore */
  }
  return "zh";
}

export function getLang() {
  if (!current) current = readStoredLang();
  return current;
}

export function setLang(lang) {
  current = lang === "en" ? "en" : "zh";
  try {
    localStorage.setItem(LANG_KEY, current);
  } catch {
    /* silent fallback */
  }
  return current;
}

export function toggleLang() {
  return setLang(getLang() === "zh" ? "en" : "zh");
}

export function t(key, lang = getLang(), vars = {}) {
  const table = STRINGS[lang] ?? STRINGS.zh;
  let value = table[key];
  if (value === undefined) value = STRINGS.zh[key];
  if (value === undefined) return key;
  if (vars && typeof value === "string") {
    return value.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
  }
  return value;
}

export function applyI18n(root, lang = getLang()) {
  if (!root) return;
  const table = STRINGS[lang] ?? STRINGS.zh;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = table[key] ?? STRINGS.zh[key];
    if (value !== undefined) el.textContent = value;
  });
  root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const spec = el.getAttribute("data-i18n-attr") ?? "";
    const [attr, key] = spec.split(":");
    if (!attr || !key) return;
    const value = table[key] ?? STRINGS.zh[key];
    if (value !== undefined) el.setAttribute(attr, value);
  });
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.title = t("docTitle", lang);
  }
}
