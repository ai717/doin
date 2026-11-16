// Bilingual dictionary. Every visible string in the game resolves through here;
// the data layer never stores display text.
export const LANG_KEY = "doin.lang";
export const LANGS = ["zh", "en"];

const zh = {
  appTitle: "舷窗防线",
  backHome: "返回首页",
  langBtn: "EN",
  soundOn: "♪",
  soundOff: "♪̸",

  modeCampaign: "战役 · 星港围城",
  modeSurvival: "生存演习",
  modeTraining: "战术训练场",
  modeCampaignDesc: "12 关逐关解锁，敌种层层登场，第 4 / 8 / 12 关为母舰战。",
  modeSurvivalDesc: "波次无限递增，刷新你的最远波次与最高连击。",
  modeTrainingDesc: "无死亡教学场，专练迎击、轨道炮与屏障利用。",

  radarWave: "波次",
  radarAlive: "残敌",
  radarAlert: "母舰接近",
  radarCalm: "空域平静",
  radarRedline: "临界警报",

  heat: "过热",
  hull: "船体",
  combo: "连击",
  score: "得分",
  best: "最佳",
  level: "关卡",
  wave: "波次",
  stars: "星级",
  totalStars: "总星",

  btnStart: "开始战斗",
  btnRetry: "重新出击",
  btnNext: "下一关",
  btnMenu: "返回舱门",
  btnPause: "暂停",
  btnResume: "继续",
  btnContinue: "继续当前出击",
  btnStartSurvival: "开始生存演习",
  btnHelp: "玩法",
  btnClose: "关闭",
  btnSound: "音效",

  statusReady: "准备",
  statusPaused: "暂停",
  statusWave: "波次清空",

  winTitle: "防线守住",
  loseTitle: "防线失守",
  loseHull: "炮台被击穿",
  loseBreach: "阵列压过临界线",
  reportTitle: "战报",
  statAccuracy: "命中率",
  statCombo: "最高连击",
  statHeadon: "迎击次数",
  statHull: "船体残余",
  statTime: "用时",
  statScore: "本关得分",
  newRecord: "新纪录",
  levelLocked: "未解锁",
  levelCleared: "已通关",
  survivalBest: "最远波次",
  survivalCombo: "最高连击",

  helpTitle: "怎么玩",
  helpBody:
    "左右移动炮台，在舷窗后迎击外星阵列。阵列每被清空一行就整体下压一格，残敌越少行进越快——压过那条红色虚线（临界线）即防线失守。按住开火即持续射击（同屏最多 2 发，连射会积热锁定）；按住 0.6 秒后松手，改为释放贯穿整列的轨道炮。敌机俯冲会先走一段弧线，后半段甲板上会画出它的进攻航道并在落点亮起倒三角——看见就让开；在冲刺直段正面命中即为迎击，双倍分数。拾取护盾后炮台外会罩上半圆光罩，可替你挡下一次伤害。",
  helpKeys: "键盘：← → / A D 移动，空格开火（按住连射，按住 0.6 秒后松手放轨道炮），P 暂停，R 重开，Esc 暂停 / 返回上一界面。鼠标与触屏：按住并拖动来移动，松手停火。",

  trainingHint1: "训练：点射击落阵列。注意过热槽，连射会锁定炮管。",
  trainingHint2: "训练：蟹钳兵会频繁俯冲。等它进入冲刺直段，正面迎击拿双倍分。",
  trainingHint3: "训练：护盾兵正面免疫。长按蓄力轨道炮，护盾无效——一发贯穿整列。",

  heatWarning: "炮管过热",
  coolDown: "散热中",
  modSpread: "散射",
  modShield: "折射护盾",
  modSlowfield: "缓速力场",
  modMagrail: "磁轨吸附",

  enemyGrunt: "甲虫兵",
  enemyCrusher: "蟹钳兵",
  enemySquid: "乌贼兵",
  enemySwarm: "蜂群无人机",
  enemyBulwark: "护盾兵",
  enemySplitter: "分裂母体",
  enemyPhantom: "幽灵兵",
  enemySpawn: "分裂体",
  enemyMothership: "母舰",
};

const en = {
  appTitle: "Starport Siege",
  backHome: "Home",
  langBtn: "中文",
  soundOn: "♪",
  soundOff: "♪̸",

  modeCampaign: "Campaign: Starport Siege",
  modeSurvival: "Survival Drill",
  modeTraining: "Training Range",
  modeCampaignDesc: "12 hand-built stages, new hostiles each chapter, mothership battles on 4 / 8 / 12.",
  modeSurvivalDesc: "Endless waves. Push your furthest wave and best combo.",
  modeTrainingDesc: "Death-free drills for head-on kills, the railgun and barricade play.",

  radarWave: "WAVE",
  radarAlive: "HOSTILES",
  radarAlert: "MOTHERSHIP INBOUND",
  radarCalm: "SKIES CLEAR",
  radarRedline: "CRITICAL LINE",

  heat: "HEAT",
  hull: "HULL",
  combo: "COMBO",
  score: "SCORE",
  best: "BEST",
  level: "LEVEL",
  wave: "WAVE",
  stars: "STARS",
  totalStars: "STARS",

  btnStart: "Launch",
  btnRetry: "Retry",
  btnNext: "Next Level",
  btnMenu: "Hangar",
  btnPause: "Pause",
  btnResume: "Resume",
  btnContinue: "Resume Sortie",
  btnStartSurvival: "Start Survival",
  btnHelp: "How to play",
  btnClose: "Close",
  btnSound: "Sound",

  statusReady: "READY",
  statusPaused: "PAUSED",
  statusWave: "WAVE CLEAR",

  winTitle: "Line Held",
  loseTitle: "Line Breached",
  loseHull: "Turret destroyed",
  loseBreach: "Formation crossed the red line",
  reportTitle: "After-Action Report",
  statAccuracy: "Accuracy",
  statCombo: "Best Combo",
  statHeadon: "Head-On Kills",
  statHull: "Hull Left",
  statTime: "Time",
  statScore: "Score",
  newRecord: "New record",
  levelLocked: "Locked",
  levelCleared: "Cleared",
  survivalBest: "Best Wave",
  survivalCombo: "Best Combo",

  helpTitle: "How to play",
  helpBody:
    "Slide the turret behind the porthole and break the alien formation. Every cleared row drops the whole block one step closer, and the fewer hostiles remain the faster they march - cross the red dashed line and the station falls. Hold to keep firing (max 2 shots airborne; sustained fire overheats the barrel). Hold for 0.6s and release to fire a railgun beam that pierces an entire column instead. Divers arc out of formation first, then paint their strike lane on the deck with a chevron at the impact point - step aside when you see it, and hit them head-on during the straight dash for double score. A shield pickup raises a cyan dome over the turret that absorbs the next hit.",
  helpKeys: "Keys: Left/Right or A/D to move, Space to fire (hold for sustained fire, release after 0.6s for the railgun), P pause, R restart, Esc to pause or step back. Mouse and touch: hold and drag to move, release to stop firing.",

  trainingHint1: "Drill: tap-fire the formation. Watch the heat gauge, sustained fire locks the barrel.",
  trainingHint2: "Drill: Crushers dive often. Wait for the straight dash, then meet them head-on for double score.",
  trainingHint3: "Drill: Bulwarks shrug off frontal fire. Hold to charge the railgun - it pierces shields and a whole column.",

  heatWarning: "BARREL OVERHEAT",
  coolDown: "VENTING",
  modSpread: "Spread Shot",
  modShield: "Refractor",
  modSlowfield: "Slow Field",
  modMagrail: "Mag Rail",

  enemyGrunt: "Grunt",
  enemyCrusher: "Crusher",
  enemySquid: "Squid",
  enemySwarm: "Swarm",
  enemyBulwark: "Bulwark",
  enemySplitter: "Splitter",
  enemyPhantom: "Phantom",
  enemySpawn: "Spawn",
  enemyMothership: "Mothership",
};

const DICT = { zh, en };

export function normalizeLang(value) {
  return value === "en" ? "en" : "zh";
}

export function getStoredLang() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      return normalizeLang(localStorage.getItem(LANG_KEY));
    }
  } catch {
    // storage unavailable: fall back to the default locale
  }
  return "zh";
}

export function setStoredLang(lang) {
  const next = normalizeLang(lang);
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      localStorage.setItem(LANG_KEY, next);
    }
  } catch {
    // ignore quota / disabled storage
  }
  return next;
}

export function t(key, lang = "zh") {
  const table = DICT[normalizeLang(lang)] ?? zh;
  return table[key] ?? zh[key] ?? key;
}

export function dict(lang = "zh") {
  return DICT[normalizeLang(lang)] ?? zh;
}

export function applyStaticTexts(root, lang) {
  const nodes = root.querySelectorAll("[data-i18n]");
  for (const node of nodes) {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(key, lang);
  }
  const ariaNodes = root.querySelectorAll("[data-i18n-aria]");
  for (const node of ariaNodes) {
    node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria"), lang));
  }
}
