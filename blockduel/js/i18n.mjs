// 全站共享双语中心：偏好统一读写 localStorage["doin.lang"]。
// 语言切换只做原地文本热更新，绝不 reload、绝不重置对局。

const LANG_KEY = "doin.lang";

export const STRINGS = {
  zh: {
    docTitle: "方块对轰 · Block Duel | DOIN",
    brand: "方块对轰",
    tagline: "7-Bag 俄罗斯方块对轰 · 22 位 AI 擂主",
    backHome: "← 门户",
    modeSolo: "天梯",
    modeVersus: "双人",
    levels: "选关",
    pause: "暂停",
    resume: "继续",
    soundOn: "音效开",
    soundOff: "音效关",
    help: "玩法",
    langBtn: "EN",
    player1: "红方",
    player2: "蓝方",
    player2Tag: "玩家二",
    you: "你",
    aiLabel: "AI 对手",
    score: "得分",
    lines: "消行",
    combo: "连击",
    garbage: "垃圾",
    hold: "暂存",
    next: "预览",
    stageLabel: "第 {n} 关",
    stageNameLabel: "{name}",
    roundLabel: "第 {n} 回合",
    seriesLabel: "比分",
    winTarget: "抢 {n}",
    stageOf: "第 {n} / 22 关",
    levelProgress: "天梯进度 {done} / {total}",
    clearedTag: "已通关",
    lockedTag: "未解锁",
    resetSave: "重置天梯进度",
    resetSaveConfirm: "清空 22 关天梯进度？该操作不可撤销。",
    resetSaveDone: "天梯进度已重置",
    tierBronze: "青铜",
    tierSilver: "白银",
    tierGold: "黄金",
    tierPlatinum: "铂金",
    tierDiamond: "钻石",
    stage1: "锈铁学徒",
    stage2: "石砖新兵",
    stage3: "慢手木匠",
    stage4: "铁皮哨兵",
    stage5: "青铜守门人",
    stage6: "白银游侠",
    stage7: "银翼技师",
    stage8: "白钢裁决",
    stage9: "镜面操盘手",
    stage10: "黄金蓄能者",
    stage11: "金砂连击师",
    stage12: "掌灯控场官",
    stage13: "黄铜唤雷者",
    stage14: "铂金猎手",
    stage15: "铂金快枪",
    stage16: "霜刃旋师",
    stage17: "磁暴压制者",
    stage18: "铂金终审",
    stage19: "钻石流星",
    stage20: "钻石千手",
    stage21: "极光宗师",
    stage22: "方块擂王",
    legendSolo: "单人：击破 AI 一次即过关，逐关解锁 22 位擂主。",
    legendVersus: "双人：左红右蓝同屏对轰，BO3 抢二 / BO5 抢三。",
    footerHint: "P / Esc 暂停 · 切后台自动冻结",
    pauseTitle: "已暂停",
    pauseHint: "计时、重力与 AI 已全部冻结。",
    resumeGame: "继续游戏",
    restartMatch: "重开本局",
    pauseToLevels: "返回选关",
    helpTitle: "玩法说明",
    helpGoal: "把对手顶穿即 KO。消 2 行开始反轰垃圾，消 4 行重炮 4 格。",
    helpSolo: "天梯 22 关：每关击破 AI 一次即过关，并解锁下一位擂主。",
    helpVersus: "双人同屏：左红右蓝，BO3 抢二、BO5 抢三。",
    helpGarbage: "受到的垃圾先进入缓冲槽，1.5 秒后或你锁定下一块时升起；期间任何消行都能 1:1 抵消，多余火力反打对手。",
    helpScoring: "攻击表：双行 1 / 三行 2 / Tetris 4；T-Spin 双 4、三 6；Back-to-Back 与连击再追加。单行不产生垃圾。",
    helpKeysP1: "红方：A / D 横移，S 软降，W 顺转，Q 逆转，空格硬降，C 暂存。",
    helpKeysP2: "蓝方：← / → 横移，↓ 软降，↑ 顺转，0 逆转，Enter 硬降，Shift 暂存。",
    helpPause: "P / Esc 随时暂停；切标签页或窗口失焦会自动冻结；单人模式方向键也可操作红方。",
    helpClose: "知道了",
    btnNextStage: "下一关",
    btnRetryStage: "重试本关",
    btnRematch: "再战一局",
    btnToLevels: "返回选关",
    btnClose: "关闭",
    resultStageClear: "擂主击破",
    resultStageFail: "挑战失败",
    resultSoloWin: "你赢了",
    resultSoloLose: "你输了",
    resultRedWins: "红方获胜",
    resultBlueWins: "蓝方获胜",
    resultDetailStage: "第 {n} 关 · {name}",
    resultDetailSeries: "比分 {a} : {b} · {mode}",
    resultDetailFail: "第 {n} 关 · {name} · 再来一次",
    bestOfShort: "BO{n}",
    modeTagSolo: "天梯",
    modeTagVersus: "双人",
    toastLocked: "先通关前一关才能解锁这位擂主",
    toastModeSolo: "已切换到单人天梯",
    toastModeVersus: "已切换到双人同屏",
    toastBestOf: "赛制已切换为 BO{n}",
    toastAutoPause: "切到后台，已自动暂停",
    toastNewStage: "新擂主已解锁：第 {n} 关",
    bannerKo: "KO!",
    bannerTetris: "TETRIS!",
    bannerTSpin: "T-SPIN!",
    bannerCombo: "连击 ×{n}",
    bannerB2B: "BACK-TO-BACK",
    bannerCounter: "抵消 {n}",
    bannerAttack: "垃圾 +{n}",
    bannerWin: "WIN",
    bannerLose: "LOSE",
    ariaArena: "方块对轰对局区域",
    ariaCanvas: "双人俄罗斯方块对轰棋盘",
    ariaSound: "音效开关",
    ariaLang: "切换语言",
    ariaPause: "暂停或继续",
    ariaLevels: "打开选关面板",
    ariaHelp: "查看玩法说明",
    ariaClose: "关闭面板",
    touchHold: "暂存",
    touchRotate: "旋转",
    touchHard: "硬降",
    touchSoft: "软降",
    touchLeft: "左移",
    touchRight: "右移",
    touchRotateCCW: "逆转",
    gameOver: "对局结束",
    roundCount: "第 {n} 回合",
    stageUnlocked: "已解锁",
    statAttack: "攻击 {n}",
    pauseKeyHint: "P / Esc",
    soundUnavailable: "当前浏览器不支持 WebAudio，已静默降级",
  },
  en: {
    docTitle: "Block Duel · DOIN",
    brand: "BLOCK DUEL",
    tagline: "7-Bag versus Tetris · 22 AI champions",
    backHome: "← Portal",
    modeSolo: "Ladder",
    modeVersus: "Versus",
    levels: "Stages",
    pause: "Pause",
    resume: "Resume",
    soundOn: "Sound On",
    soundOff: "Sound Off",
    help: "How",
    langBtn: "中文",
    player1: "RED",
    player2: "BLUE",
    player2Tag: "P2",
    you: "YOU",
    aiLabel: "AI RIVAL",
    score: "SCORE",
    lines: "LINES",
    combo: "COMBO",
    garbage: "GARBAGE",
    hold: "HOLD",
    next: "NEXT",
    stageLabel: "STAGE {n}",
    stageNameLabel: "{name}",
    roundLabel: "ROUND {n}",
    seriesLabel: "SERIES",
    winTarget: "First to {n}",
    stageOf: "Stage {n} / 22",
    levelProgress: "Ladder {done} / {total}",
    clearedTag: "CLEARED",
    lockedTag: "LOCKED",
    resetSave: "Reset ladder",
    resetSaveConfirm: "Clear all 22 stage records? This cannot be undone.",
    resetSaveDone: "Ladder progress reset",
    tierBronze: "Bronze",
    tierSilver: "Silver",
    tierGold: "Gold",
    tierPlatinum: "Platinum",
    tierDiamond: "Diamond",
    stage1: "Rusty Apprentice",
    stage2: "Brick Recruit",
    stage3: "Slow Carpenter",
    stage4: "Tin Sentinel",
    stage5: "Bronze Warden",
    stage6: "Silver Ranger",
    stage7: "Silver Technician",
    stage8: "Steel Verdict",
    stage9: "Mirror Broker",
    stage10: "Golden Charger",
    stage11: "Gold Comboist",
    stage12: "Lamp Controller",
    stage13: "Brass Stormer",
    stage14: "Platinum Hunter",
    stage15: "Platinum Quickdraw",
    stage16: "Frost Spinner",
    stage17: "Magnetic Press",
    stage18: "Platinum Final",
    stage19: "Diamond Meteor",
    stage20: "Diamond Thousand-Hands",
    stage21: "Aurora Grandmaster",
    stage22: "Block Champion",
    legendSolo: "Solo: one KO clears a stage and unlocks the next AI champion.",
    legendVersus: "Versus: RED left, BLUE right. BO3 first to two, BO5 first to three.",
    footerHint: "P / Esc to pause · auto-freeze when tab loses focus",
    pauseTitle: "PAUSED",
    pauseHint: "Timers, gravity and AI are frozen.",
    resumeGame: "Resume",
    restartMatch: "Restart match",
    pauseToLevels: "Stage select",
    helpTitle: "How to play",
    helpGoal: "Top out your rival to score a KO. Doubles start sending garbage; a Tetris sends four rows.",
    helpSolo: "Ladder: 22 stages, one KO per stage unlocks the next champion.",
    helpVersus: "Local versus: RED left, BLUE right. BO3 first to two, BO5 first to three.",
    helpGarbage: "Incoming garbage waits in the buffer. It rises after 1.5s or when you lock your next piece. Any clear cancels it 1:1 and the surplus fires back.",
    helpScoring: "Attack: double 1 / triple 2 / Tetris 4; T-Spin double 4, triple 6; Back-to-Back and combos add more. A single sends nothing.",
    helpKeysP1: "RED: A / D move, S soft drop, W rotate CW, Q rotate CCW, Space hard drop, C hold.",
    helpKeysP2: "BLUE: ← / → move, ↓ soft drop, ↑ rotate CW, 0 rotate CCW, Enter hard drop, Shift hold.",
    helpPause: "P / Esc pauses anytime. Switching tabs or losing focus freezes the duel. In solo, arrow keys also control RED.",
    helpClose: "Got it",
    btnNextStage: "Next stage",
    btnRetryStage: "Retry stage",
    btnRematch: "Rematch",
    btnToLevels: "Stage select",
    btnClose: "Close",
    resultStageClear: "CHAMPION DOWN",
    resultStageFail: "STAGE FAILED",
    resultSoloWin: "YOU WIN",
    resultSoloLose: "YOU LOSE",
    resultRedWins: "RED WINS",
    resultBlueWins: "BLUE WINS",
    resultDetailStage: "Stage {n} · {name}",
    resultDetailSeries: "{a} : {b} · {mode}",
    resultDetailFail: "Stage {n} · {name} · try again",
    bestOfShort: "BO{n}",
    modeTagSolo: "LADDER",
    modeTagVersus: "VERSUS",
    toastLocked: "Clear the previous stage to unlock this champion",
    toastModeSolo: "Switched to solo ladder",
    toastModeVersus: "Switched to local versus",
    toastBestOf: "Format switched to BO{n}",
    toastAutoPause: "Tab lost focus — auto paused",
    toastNewStage: "New champion unlocked: stage {n}",
    bannerKo: "KO!",
    bannerTetris: "TETRIS!",
    bannerTSpin: "T-SPIN!",
    bannerCombo: "COMBO ×{n}",
    bannerB2B: "BACK-TO-BACK",
    bannerCounter: "CANCEL {n}",
    bannerAttack: "GARBAGE +{n}",
    bannerWin: "WIN",
    bannerLose: "LOSE",
    ariaArena: "Block Duel arena",
    ariaCanvas: "Two-player Tetris duel boards",
    ariaSound: "Toggle sound",
    ariaLang: "Switch language",
    ariaPause: "Pause or resume",
    ariaLevels: "Open stage select",
    ariaHelp: "Open how-to-play",
    ariaClose: "Close panel",
    touchHold: "Hold",
    touchRotate: "Rotate",
    touchHard: "Drop",
    touchSoft: "Soft",
    touchLeft: "Left",
    touchRight: "Right",
    touchRotateCCW: "CCW",
    gameOver: "Match over",
    roundCount: "Round {n}",
    stageUnlocked: "Unlocked",
    statAttack: "ATK {n}",
    pauseKeyHint: "P / Esc",
    soundUnavailable: "WebAudio unavailable — running silently",
  },
};

let current = null;

function readStoredLang() {
  try {
    const value = localStorage.getItem(LANG_KEY);
    if (value === "zh" || value === "en") return value;
  } catch {
    /* 存档不可用时回退系统语言 */
  }
  try {
    const nav = typeof navigator !== "undefined" ? navigator.language : "";
    if (typeof nav === "string" && nav.toLowerCase().startsWith("zh")) return "zh";
  } catch {
    /* 忽略 */
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
    /* 静默降级 */
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

export function stageName(index, lang = getLang()) {
  return t(`stage${Math.max(1, Math.min(22, index + 1))}`, lang);
}

export function formatStage(index, lang = getLang()) {
  const number = Math.max(1, Math.min(22, index + 1));
  return `${t("stageLabel", lang, { n: number })} · ${stageName(index, lang)}`;
}
