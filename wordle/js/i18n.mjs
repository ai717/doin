// i18n.mjs —— 双语中心（zh/en），统一读写全站共享偏好 localStorage["doin.lang"]。
// 语言切换零副作用：仅遍历 [data-i18n*] 热更新文本，绝不刷新页面、绝不触碰游戏状态。

export const STRINGS = {
  zh: {
    docTitle: "每日猜词 Wordle · DOIN 在线小游戏",
    appTitle: "每日猜词",
    appKicker: "铅字排印台 · 每日一词",
    back: "返回门户",
    soundOn: "音效：开",
    soundOff: "音效：关",
    langSwitch: "切换语言",
    helpLabel: "玩法说明",
    statsLabel: "排印工作单",
    modesLabel: "模式与语言轨",
    modesTitle: "选择模式",
    trackTitle: "语言轨",
    modeDaily: "每日一题",
    modeDailyDesc: "全站同题，连胜在手",
    modePractice: "练习场",
    modePracticeDesc: "不限次数，随机词题",
    modeDuel: "双人对抗",
    modeDuelDesc: "同词双板，轮流输入",
    trackEn: "英文单词",
    trackCn: "中文成语",
    trackShortZh: "中",
    trackShortEn: "EN",
    resume: "返回当前局",
    wsIssue: "期",
    wsWinrate: "胜率",
    wsStreak: "连胜",
    wsDist: "分布",
    wsChances: "机会",
    btnHint: "提示",
    hintUsed: "本局提示已用",
    resultHinted: "本局使用了提示",
    toastNotInList: "词不在库",
    toastNotEnough: "字母不足",
    bannerWin: "今日已通关，明日再来",
    bannerLose: "今日未中，答案是「{word}」",
    bannerDuelDone: "对抗已结束",
    playerA: "甲方",
    playerB: "乙方",
    duelTurn: "轮到{name}",
    duelWinA: "甲方抢先猜中！",
    duelWinB: "乙方抢先猜中！",
    duelDraw: "双双未中，平局",
    duelRecord: "战绩 {a} : {b}",
    resultWin: "恭喜猜中！",
    resultLose: "未能猜中",
    resultAnswer: "答案",
    resultTurns: "用了 {n} 行",
    btnShare: "复制战绩",
    shareCopied: "已复制，去粘贴吧",
    shareFallback: "复制失败，请手动选取下方文本",
    statsPlayed: "已玩",
    statsWins: "获胜",
    statsWinrate: "胜率",
    statsStreak: "当前连胜",
    statsMaxStreak: "最高连胜",
    statsDist: "七行分布",
    btnNewWord: "换一题",
    practiceBest: "最少 {n} 行猜中",
    practiceNone: "尚无胜绩",
    helpTitle: "玩法说明",
    help1: "在七行之内猜出隐藏词：英文为五个字母，中文为四字成语。",
    help2: "提交后铅字翻色：绿＝字与位都对；黄＝字对位错；灰＝此字不在词中。",
    help3: "卡住了？点「提示」把答案中一个未命中的字染绿，每局一次；双人对抗没有提示。",
    help4: "「每日一题」全站同日同题，胜率、分布与连胜记在排印工作单上。",
    help5: "「练习场」随机出词不限次数，地址加 ?seed= 可复现同一题。",
    help6: "「双人对抗」同词双板轮流输入，先猜中者胜，同步数先手胜。",
    help7: "中文轨从下方铅字字架选字；按 1 / 2 或点顶栏按钮切换语言轨。",
    help8: "键盘铅字按历史反馈染色，双人对抗时两块板合并染色。",
    shareScore: "每日猜词 第{n}期 · {x}/7",
    shareMiss: "每日猜词 第{n}期 · 未中",
    close: "关闭",
    resultNextDaily: "期待明日新题",
    resultNextPractice: "再来一题",
  },
  en: {
    docTitle: "Wordle · DOIN Online Games",
    appTitle: "Wordle",
    appKicker: "Letterpress · One word a day",
    back: "Back to portal",
    soundOn: "Sound: on",
    soundOff: "Sound: off",
    langSwitch: "Switch language",
    helpLabel: "How to play",
    statsLabel: "Work sheet",
    modesLabel: "Modes & track",
    modesTitle: "Choose mode",
    trackTitle: "Language track",
    modeDaily: "Daily",
    modeDailyDesc: "Same word for everyone",
    modePractice: "Practice",
    modePracticeDesc: "Unlimited random words",
    modeDuel: "2P Duel",
    modeDuelDesc: "Same word, two boards",
    trackEn: "English words",
    trackCn: "Chinese idioms",
    trackShortZh: "\u4E2D",
    trackShortEn: "EN",
    resume: "Back to game",
    wsIssue: "No.",
    wsWinrate: "Win %",
    wsStreak: "Streak",
    wsDist: "Dist.",
    wsChances: "Chances",
    btnHint: "Hint",
    hintUsed: "Hint already used",
    resultHinted: "Solved with a hint",
    toastNotInList: "Not in word list",
    toastNotEnough: "Not enough letters",
    bannerWin: "Solved today — see you tomorrow",
    bannerLose: "Missed today, the word was \"{word}\"",
    bannerDuelDone: "Duel finished",
    playerA: "Player 1",
    playerB: "Player 2",
    duelTurn: "{name}'s turn",
    duelWinA: "Player 1 wins!",
    duelWinB: "Player 2 wins!",
    duelDraw: "Both missed — a draw",
    duelRecord: "Record {a} : {b}",
    resultWin: "Splendid!",
    resultLose: "Out of guesses",
    resultAnswer: "Answer",
    resultTurns: "Solved in {n} rows",
    btnShare: "Copy result",
    shareCopied: "Copied to clipboard",
    shareFallback: "Copy failed — select the text below manually",
    statsPlayed: "Played",
    statsWins: "Wins",
    statsWinrate: "Win rate",
    statsStreak: "Current streak",
    statsMaxStreak: "Max streak",
    statsDist: "Guess distribution",
    btnNewWord: "New word",
    practiceBest: "Best {n} rows",
    practiceNone: "No win yet",
    helpTitle: "How to play",
    help1: "Guess the hidden word within seven rows: five letters in English, a four-character idiom in Chinese.",
    help2: "Tiles flip after submit: green = right letter, right spot; yellow = right letter, wrong spot; gray = not in the word.",
    help3: "Stuck? Tap Hint to tint one unrevealed letter of the answer green — once per game, never in duels.",
    help4: "The daily word is the same for everyone; win rate, distribution and streak live on the work sheet.",
    help5: "Practice deals random words without limit; add ?seed= to the URL to replay a word.",
    help6: "In the duel both players solve the same word on two boards, taking turns; fewer rows wins, ties go to the first hand.",
    help7: "On the Chinese track pick characters from the type case below; press 1 / 2 or use the top bar to switch tracks.",
    help8: "Keyboard sorts are tinted by past feedback; in duels both boards merge into one tint.",
    shareScore: "Wordle No.{n} · {x}/7",
    shareMiss: "Wordle No.{n} · missed",
    close: "Close",
    resultNextDaily: "See you tomorrow",
    resultNextPractice: "One more word",
  },
};

let cachedLang = null;

export function getLang() {
  if (cachedLang) return cachedLang;
  try {
    cachedLang = window.localStorage.getItem("doin.lang") === "en" ? "en" : "zh";
  } catch {
    cachedLang = "zh";
  }
  return cachedLang;
}

export function setLang(lang) {
  const next = lang === "en" ? "en" : "zh";
  cachedLang = next;
  try {
    window.localStorage.setItem("doin.lang", next);
  } catch {
    // 存储不可用时仅本次会话生效
  }
  return next;
}

export function t(key, params) {
  const lang = getLang();
  const dict = STRINGS[lang] ?? STRINGS.zh;
  let text = dict[key] ?? STRINGS.zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

// 热更新：全量覆盖静态标记文本与属性；动态文本由调用方在重渲染时取 t()
export function applyTexts(root = document) {
  const list = root.querySelectorAll("[data-i18n]");
  for (const el of list) el.textContent = t(el.getAttribute("data-i18n"));
  const aria = root.querySelectorAll("[data-i18n-aria]");
  for (const el of aria) el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  const titles = root.querySelectorAll("[data-i18n-title]");
  for (const el of titles) el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  document.documentElement.lang = getLang() === "en" ? "en" : "zh-CN";
  document.title = t("docTitle");
}
