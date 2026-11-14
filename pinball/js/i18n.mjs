// 霓虹弹珠台 · 全站共享中英双语表（语言偏好统一读写 localStorage["doin.lang"]）

export const LANG_KEY = "doin.lang";
export const DEFAULT_LOCALE = "zh";

const LOCALES = {
  zh: {
    langName: "中文",
    title: "霓虹弹珠台",
    back: "← 门户",
    soundOn: "🔊 音效开",
    soundOff: "🔇 音效关",
    langBtn: "EN",
    help: "玩法说明",
    startTitle: "霓虹弹珠台",
    startSub: "双挡板兜底 · 打砖重塑弹道 · 机关特效全开",
    btnStage: "章节闯关",
    btnSurvival: "街机生存",
    chapter1: "第一章 · 玻璃砖墙",
    chapter2: "第二章 · 钢铁壁垒",
    chapter3: "第三章 · 黄金纪元",
    themeGlass: "玻璃砖墙 · 双挡板入门",
    themeSteel: "钢铁壁垒 · 靶区机关",
    themeGold: "黄金纪元 · 机关全开",
    level: "第 {n} 关",
    locked: "未解锁",
    stageGoal: "清完全部砖块",
    goalTime: "用时目标 {t}s",
    goalCombo: "连击目标 {c}",
    stars: "★",
    score: "得分",
    bestScore: "最高分",
    combo: "连击",
    mult: "×{m}",
    balls: "弹珠",
    time: "用时",
    maxCombo: "最高连击",
    bricksLeft: "剩余砖块",
    effectLamp: "机关",
    lampBumper: "缓冲",
    lampTarget: "翻靶",
    lampSling: "弹射",
    lampSpinner: "转盘",
    lampRollover: "滚道",
    lampRamp: "斜坡",
    stormCombo: "连击 {n} → 砖块风暴",
    frenzy: "缓冲狂潮 ×2",
    allTargets: "全靶奖励 +200",
    multiball: "双球乱舞",
    ballSave: "救球罩",
    flipperBoost: "挡板伸长",
    speedBoost: "速度上限提升",
    clusterReward: "清空砖簇奖励",
    launch: "发射",
    flipL: "左板",
    flipR: "右板",
    nudge: "摇机",
    chargeTip: "按住蓄力 · 松开发射",
    keyTip: "A/D 或 ←/→ 双挡板 · 空格发射 · S 摇机",
    touchTip: "双挡板触控 · 向上滑发射",
    serving: "请发射弹珠",
    playing: "闯关中…",
    cleared: "过关！",
    failed: "弹珠用尽",
    over: "本局结束",
    clearLine1: "用时 {t} 秒 · 最高连击 {c}",
    clearStars: "获得 {n} 星",
    nextLevel: "下一关",
    retry: "再战本关",
    toSelect: "返回选关",
    survivalOver: "街机生存结算",
    survivalLine: "得分 {s} · 最高连击 {c} · 清砖 {b}",
    survivalAgain: "再来一局",
    survivalBack: "返回主菜单",
    helpTitle: "玩法说明",
    helpBody1: "按住发射键蓄力，松手把弹珠弹上砖墙。",
    helpBody2: "左右双挡板接球弹射：连续击中砖块/机关（未碰挡板与侧墙）连击翻倍加分。",
    helpBody3: "5 连击点燃侧弹射器，10 连击触发砖块风暴；滚道感应转出双球乱舞/缓冲狂潮/救球罩。",
    helpBody4: "打碎砖块会打开新的空白区弹道——选砖即雕刻弹珠路线；漏入中央沟或两侧出口即失去一颗弹珠。",
    helpBody5: "章节三星评级：剩余弹珠 ★ · 用时 ★★ · 最高连击 ★★★。",
    helpClose: "知道了",
    pauseTip: "游戏中按 P 暂停",
    saveReset: "重置存档",
    saveResetConfirm: "确定清空本地进度与纪录？",
    saveCleared: "存档已重置",
    starsTotal: "总星数 {n}",
    unlockedNew: "已解锁新关卡"
  },
  en: {
    langName: "English",
    title: "Neon Pinball",
    back: "← Portal",
    soundOn: "🔊 Sound On",
    soundOff: "🔇 Sound Off",
    langBtn: "中",
    help: "How to Play",
    startTitle: "Neon Pinball",
    startSub: "Twin flippers · brick trails reshape the field · all mechanisms blazing",
    btnStage: "Campaign",
    btnSurvival: "Arcade Survival",
    chapter1: "Ch.1 · Glass Wall",
    chapter2: "Ch.2 · Steel Fortress",
    chapter3: "Ch.3 · Golden Era",
    themeGlass: "Glass bricks · learn the flippers",
    themeSteel: "Steel bricks · drop-target zone",
    themeGold: "Golden bricks · all mechanisms on",
    level: "Level {n}",
    locked: "Locked",
    stageGoal: "Break all bricks",
    goalTime: "Time goal {t}s",
    goalCombo: "Combo goal {c}",
    stars: "★",
    score: "Score",
    bestScore: "Best",
    combo: "Combo",
    mult: "×{m}",
    balls: "Balls",
    time: "Time",
    maxCombo: "Max Combo",
    bricksLeft: "Bricks Left",
    effectLamp: "Gears",
    lampBumper: "Bumper",
    lampTarget: "Target",
    lampSling: "Sling",
    lampSpinner: "Spinner",
    lampRollover: "Lane",
    lampRamp: "Ramp",
    stormCombo: "Combo {n} → Brick Storm",
    frenzy: "Bumper Frenzy ×2",
    allTargets: "All targets down +200",
    multiball: "Multi-Ball",
    ballSave: "Ball Save",
    flipperBoost: "Flipper Boost",
    speedBoost: "Speed Cap Up",
    clusterReward: "Cluster Cleared Bonus",
    launch: "Launch",
    flipL: "L-Flip",
    flipR: "R-Flip",
    nudge: "Nudge",
    chargeTip: "Hold to charge · release to launch",
    keyTip: "A/D or ←/→ flippers · Space launch · S nudge",
    touchTip: "Touch flippers · swipe up to launch",
    serving: "Launch the ball",
    playing: "Playing…",
    cleared: "Cleared!",
    failed: "Out of balls",
    over: "Game over",
    clearLine1: "Time {t}s · Max combo {c}",
    clearStars: "{n} star(s)",
    nextLevel: "Next",
    retry: "Retry",
    toSelect: "Level Select",
    survivalOver: "Survival Results",
    survivalLine: "Score {s} · Max combo {c} · {b} bricks",
    survivalAgain: "Play Again",
    survivalBack: "Main Menu",
    helpTitle: "How to Play",
    helpBody1: "Hold launch to charge, release to fire the ball at the brick wall.",
    helpBody2: "Flip with both paddles: keep hitting bricks/gears without touching paddles or walls to stack the combo multiplier.",
    helpBody3: "Combo 5 ignites the sling shots, combo 10 triggers a brick storm; rollover lanes spin multiball / frenzy / ball-save effects.",
    helpBody4: "Breaking bricks opens new empty lanes — choose your bricks to carve the ball's path; the center gap and side outlanes cost you a ball.",
    helpBody5: "Three-star rating: balls left ★ · time ★★ · max combo ★★★.",
    helpClose: "Got it",
    pauseTip: "Press P in-game to pause",
    saveReset: "Reset Save",
    saveResetConfirm: "Erase local progress and records?",
    saveCleared: "Save cleared",
    starsTotal: "Total {n} stars",
    unlockedNew: "New level unlocked"
  }
};

export function isLocale(value) {
  return value === "zh" || value === "en";
}

export function detectLocale() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* 存储不可用时回默认 */
  }
  const navLang = (typeof navigator !== "undefined" && navigator.language) || "";
  return navLang.toLowerCase().startsWith("en") ? "en" : DEFAULT_LOCALE;
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    localStorage.setItem(LANG_KEY, locale);
  } catch {
    /* 存储不可用时静默 */
  }
}

export function htmlLang() {
  return loadLocale() === "en" ? "en" : "zh-CN";
}

export function strings(locale) {
  return LOCALES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

// {n} / {t} / {s} / {c} / {b} / {m} 占位格式化
export function format(locale, key, values = {}) {
  const text = strings(locale)[key] ?? String(key);
  return text.replace(/\{(n|t|s|c|b|m|l)\}/g, (_, name) => String(values[name] ?? ""));
}

export { LOCALES };
