// Pong Neo 多语言双表与共享偏好管理 (doin.lang)

export const LOCALES = Object.freeze(["zh", "en"]);
export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const STRINGS = {
  zh: {
    docTitle: "街机乒乓 · DOIN 在线小游戏",
    metaDesc: "街机乒乓（Pong Neo）：经典上下挡板对决，丝滑切角切削、球速递增对攻心流、阶梯AI与同屏双人对战，即点即玩！",
    title: "街机乒乓",
    tagline: "上下对决 · 极速对攻 · 经典街机重燃",
    backHome: "返回首页",
    rules: "规则说明",
    sound: "音效",
    langLabel: "English",
    langShort: "EN",
    ariaLang: "切换语言",

    // HUD 标签
    modeLabel: "对战模式",
    modePve: "人机对战",
    modePvp: "同屏双人",
    modeWall: "单人击墙",
    diffLabel: "AI 难度",
    diffEasy: "菜鸟机",
    diffNormal: "俱乐部",
    diffHard: "魔王级",
    targetScoreLabel: "局制",
    targetScorePoints: "{0} 分制",

    // 实时状态
    scoreTitle: "比分看板",
    playerTopPve: "AI 机器人",
    playerTopPvp: "2P 玩家 (上方)",
    playerTopWall: "能量反弹墙",
    playerBottom: "你 (下方 1P)",
    playerBottomPvp: "1P 玩家 (下方)",
    currentRally: "当前连拍",
    maxRally: "最长对轰",
    ballSpeed: "球体时速",
    pveRecord: "人机战绩",
    pveWins: "胜 {0} / 负 {1}",
    bestRallyRecord: "历史最佳连拍",

    // 状态与横幅
    statusServing: "准备发球...",
    statusPlaying: "对攻拉锯中！",
    statusScoredTop: "上方选手得 1 分！",
    statusScoredBottom: "下方选手得 1 分！",
    statusWonYou: "恭喜获胜！干得漂亮！",
    statusWonAi: "AI 机器人获胜！",
    statusWonP1: "下方 1P 夺得全场胜利！",
    statusWonP2: "上方 2P 夺得全场胜利！",

    // 控制台按钮
    btnRestart: "重新发球",
    btnNewMatch: "新比赛",
    btnPause: "暂停",
    btnResume: "继续",

    // 规则弹窗
    ruleTitle: "游戏玩法与操作指南",
    ruleGoal: "【目标】操控底端球板横向拦截弹射球，将球打入对方底线得分。率先达到目标分的一方夺得整场胜利！",
    ruleSpin: "【切角与切削】击中球板中心垂直回弹；击中两翼边缘大角度急折；在击球瞬间横移球板可给球施加【旋球加塞】，走出致命弧线！",
    ruleSpeed: "【球速递增】每一拍回击都会提升球速，连续对轰超 10 拍以上时小球进入超光速状态！",
    ruleControlDesktop: "【桌面操作】鼠标在球台内水平滑动控板；下方 1P 支持键盘 A/D 或 ←/→ 移动；双人模式下上方 2P 使用 J/L 键！",
    ruleControlMobile: "【移动操作】手指在半场区域左右滑动即可自如拉板接球。",
    ruleClose: "我知道了",

    // 结算弹窗
    modalTitleVictory: "胜利时刻",
    modalTitleDefeat: "惜败战局",
    modalScoreReport: "最终比分：{0} - {1}",
    modalMaxRallyReport: "本局最高连拍：{0} 拍",
    modalBtnAgain: "再来一局",

    // 兜底与标记
    noscript: "需要启用 JavaScript 才能游玩街机乒乓。",
    courtAria: "街机乒乓球台"
  },
  en: {
    docTitle: "Pong Neo · DOIN Games",
    metaDesc: "Pong Neo: classic top-down arcade table clash, angle slices, spin cut physics, escalating rally heart-rates, tiered AI and 2P local clash!",
    title: "Pong Neo",
    tagline: "Top-Down Clash · Extreme Rallies · Classic Arcade Reborn",
    backHome: "Home",
    rules: "Rules",
    sound: "Sound",
    langLabel: "中文",
    langShort: "中",
    ariaLang: "Switch language",

    modeLabel: "Game Mode",
    modePve: "vs AI",
    modePvp: "Local 2P",
    modeWall: "Wall Solo",
    diffLabel: "AI Level",
    diffEasy: "Rookie",
    diffNormal: "Pro",
    diffHard: "Master",
    targetScoreLabel: "Match Point",
    targetScorePoints: "First to {0}",

    scoreTitle: "Scoreboard",
    playerTopPve: "Bot AI",
    playerTopPvp: "Player 2 (Top)",
    playerTopWall: "Energy Wall",
    playerBottom: "You (Bottom 1P)",
    playerBottomPvp: "Player 1 (Bottom)",
    currentRally: "Current Rally",
    maxRally: "Longest Rally",
    ballSpeed: "Ball Speed",
    pveRecord: "vs AI Record",
    pveWins: "W: {0} / L: {1}",
    bestRallyRecord: "All-Time Best Rally",

    statusServing: "Serving...",
    statusPlaying: "Rally in progress!",
    statusScoredTop: "Top scores 1 point!",
    statusScoredBottom: "Bottom scores 1 point!",
    statusWonYou: "VICTORY! Brilliant play!",
    statusWonAi: "Bot AI wins the match!",
    statusWonP1: "Player 1 takes the match!",
    statusWonP2: "Player 2 takes the match!",

    btnRestart: "Serve Ball",
    btnNewMatch: "New Match",
    btnPause: "Pause",
    btnResume: "Resume",

    ruleTitle: "How to Play & Controls",
    ruleGoal: "Goal: Control the paddle to deflect the ball past your opponent's baseline. First to reach the target score wins the match!",
    ruleSpin: "Angles & Spin: Hitting the paddle center bounces straight; hitting edges creates sharp deflection angles. Move your paddle during hit to apply lethal spin curvature!",
    ruleSpeed: "Rally Acceleration: Every return accelerates the ball. Survive beyond 10 rallies to experience hyper-speed adrenaline!",
    ruleControlDesktop: "Desktop: Move mouse horizontally over the court. Or use A/D / Arrow Keys for 1P; J/L for 2P in local multiplayer!",
    ruleControlMobile: "Touch: Swipe your finger across your half of the table to slide your paddle.",
    ruleClose: "Got It",

    modalTitleVictory: "Victory!",
    modalTitleDefeat: "Match Finished",
    modalScoreReport: "Final Score: {0} - {1}",
    modalMaxRallyReport: "Peak Rally: {0} hits",
    modalBtnAgain: "Play Again",

    noscript: "JavaScript is required to play Pong Neo.",
    courtAria: "Pong Neo Arcade Court"
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