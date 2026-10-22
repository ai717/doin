// 中英双语中心。全站共享语言偏好 localStorage["doin.lang"]（zh/en）。
// 英文表零汉字（语言切换按钮的标识由 main.mjs 以白名单字面量写入）。
// 展示文本一律经 t(key) 或 t(key, params) 获取，数据层严禁裸写中文。

const LANG_KEY = "doin.lang";

export const strings = {
  zh: {
    docTitle: "象棋残局 · DOIN 在线小游戏",
    appTitle: "象棋残局",
    appSubtitle: "木桌对弈 · 残局解题",
    backHome: "← 门户",

    modeCampaign: "残局闯关",
    modeAi: "阶梯 AI 对战",
    mode2p: "同屏双人",
    modeLabel: "模式",

    btnLevels: "选关",
    btnUndo: "悔棋",
    btnRestart: "重摆",
    btnHelp: "玩法",
    btnSound: "音效",
    soundOn: "音效：开",
    soundOff: "音效：关",
    btnHint: "提示",
    hintOn: "杀法提示：开",
    hintOff: "杀法提示：关",
    btnClose: "关闭",

    scorebookTitle: "记分簿",
    endgameCardTitle: "棋谱卡",
    aiPanelTitle: "阶梯 AI",

    ch_chariots: "双车错",
    ch_cannon_horse: "马后炮",
    ch_chariot_horse: "车马冷着",
    ch_classic: "经典名局",

    levelTitle: "第{ch}章 · {chapter} · 第{n}关",
    levelShort: "第{n}关",
    goalText: "红先 {par} 步内杀棋",
    statPar: "限定 {par} 步",
    statMoves: "已用 {n} 步",
    duelRecord: "对战：胜 {w} / 负 {l} / 和 {d}",
    streakText: "连胜 {n}",
    badgeTitle: "实力徽章",
    badgeLocked: "未解锁",

    sideRed: "红方",
    sideBlack: "黑方",
    uiCheck: "将军！",
    uiMate: "绝杀！",
    uiStalemate: "困毙",
    uiDraw: "和棋",
    uiPerpetual: "长将判负",

    winTitle: "杀棋成功",
    loseTitle: "解局失败",
    drawTitle: "双方议和",
    winDetail: "用 {n} 步完成杀棋（par {par}）",
    loseDetail: "超步或被守住，可重试本关",
    duelWinTitle: "执红获胜",
    duelLoseTitle: "本局落败",
    duelDrawTitle: "握手言和",
    badgeEarned: "解锁徽章：{tier}",

    btnNextLevel: "下一关",
    btnRetry: "重试本关",
    btnAgain: "再来一局",

    redTurn: "红方行棋",
    blackTurn: "黑方行棋",
    thinking: "对手思考中…",
    undoCount: "悔棋（余 {n} 次）",
    selectPiece: "点选红子，落点柔光提示",
    hintFirst: "提示：第一着 {move}",

    ai_1: "新手",
    ai_2: "入门",
    ai_3: "进阶",
    ai_4: "高手",
    ai_5: "大师",
    aiTierLabel: "对手档位",
    statBlunder: "失误率 {pct}%",
    statDepth: "搜索深度 {n}",
    tierBadgeHint: "击败当前档位即可解锁木刻徽章",

    levelLocked: "先通关前一关",
    campaignCleared: "全部 24 关通关！",

    helpTitle: "玩法说明",
    helpBody:
      "· 残局闯关：红先，限定步数（par）内完成杀棋；黑方由引擎最佳防守。\n" +
      "· 走子：点选己方棋子（柔光显示合法落点），再点落点；也可直接拖放。\n" +
      "· 将军须应将；无子可动判负；三次重复局面判和，长将判负。\n" +
      "· 阶梯 AI 对战：五档强度，击败当前档位解锁木刻徽章；每局限悔棋 3 次。\n" +
      "· 同屏双人：轮流走子，完整规则。\n" +
      "· 键盘：方向键选子、空格确认、U 悔棋、Esc 取消、1-5 切换 AI 档位。",

    riverChu: "楚 河",
    riverHan: "汉 界",

    piece_red_1: "帅",
    piece_red_2: "仕",
    piece_red_3: "相",
    piece_red_4: "马",
    piece_red_5: "车",
    piece_red_6: "炮",
    piece_red_7: "兵",
    piece_black_1: "将",
    piece_black_2: "士",
    piece_black_3: "象",
    piece_black_4: "马",
    piece_black_5: "车",
    piece_black_6: "炮",
    piece_black_7: "卒",
  },

  en: {
    docTitle: "Xiangqi Endgames · DOIN Online Games",
    appTitle: "Xiangqi",
    appSubtitle: "Wooden Table · Endgame Puzzles",
    backHome: "← Portal",

    modeCampaign: "Endgame Campaign",
    modeAi: "Duel vs AI",
    mode2p: "2P Local",
    modeLabel: "Mode",

    btnLevels: "Levels",
    btnUndo: "Undo",
    btnRestart: "Restart",
    btnHelp: "How to Play",
    btnSound: "Sound",
    soundOn: "Sound: On",
    soundOff: "Sound: Off",
    btnHint: "Hint",
    hintOn: "Hint: On",
    hintOff: "Hint: Off",
    btnClose: "Close",

    scorebookTitle: "Scorebook",
    endgameCardTitle: "Endgame Card",
    aiPanelTitle: "Tiered AI",

    ch_chariots: "Twin Chariots",
    ch_cannon_horse: "Cannon-Horse Mate",
    ch_chariot_horse: "Chariot & Horse",
    ch_classic: "Classic Endgames",

    levelTitle: "Ch.{ch} {chapter} · No.{n}",
    levelShort: "No.{n}",
    goalText: "Red to move, mate within {par}",
    statPar: "Par {par} moves",
    statMoves: "{n} moves played",
    duelRecord: "Duel: W {w} / L {l} / D {d}",
    streakText: "Streak {n}",
    badgeTitle: "Tier Badges",
    badgeLocked: "Locked",

    sideRed: "Red",
    sideBlack: "Black",
    uiCheck: "Check!",
    uiMate: "Checkmate!",
    uiStalemate: "Stalemate",
    uiDraw: "Draw",
    uiPerpetual: "Perpetual check loses",

    winTitle: "Mated!",
    loseTitle: "Puzzle Failed",
    drawTitle: "Draw Agreed",
    winDetail: "Mated in {n} moves (par {par})",
    loseDetail: "Out of moves or held — try again",
    duelWinTitle: "Victory as Red",
    duelLoseTitle: "Defeat",
    duelDrawTitle: "A Draw",
    badgeEarned: "Badge unlocked: {tier}",

    btnNextLevel: "Next Level",
    btnRetry: "Retry",
    btnAgain: "Play Again",

    redTurn: "Red to move",
    blackTurn: "Black to move",
    thinking: "Opponent thinking…",
    undoCount: "Undo ({n} left)",
    selectPiece: "Pick a red piece; legal targets glow",
    hintFirst: "Hint: first move {move}",

    ai_1: "Novice",
    ai_2: "Apprentice",
    ai_3: "Adept",
    ai_4: "Expert",
    ai_5: "Master",
    aiTierLabel: "Opponent Tier",
    statBlunder: "Blunder {pct}%",
    statDepth: "Depth {n}",
    tierBadgeHint: "Beat this tier to carve its badge",

    levelLocked: "Clear the previous level first",
    campaignCleared: "All 24 levels cleared!",

    helpTitle: "How to Play",
    helpBody:
      "· Campaign: Red to move, mate within par; Black defends at engine strength.\n" +
      "· Moving: tap your piece (legal targets glow), then tap a target — or drag & drop.\n" +
      "· Check must be answered; no legal move loses; 3-fold repetition draws, perpetual check loses.\n" +
      "· Duel vs AI: five tiers; beat a tier to carve its badge; 3 undos per game.\n" +
      "· 2P Local: pass and play with full rules.\n" +
      "· Keys: arrows to pick, Space to confirm, U undo, Esc cancel, 1-5 AI tier.",

    riverChu: "CHU RIVER",
    riverHan: "HAN BORDER",

    piece_red_1: "K",
    piece_red_2: "A",
    piece_red_3: "B",
    piece_red_4: "H",
    piece_red_5: "R",
    piece_red_6: "C",
    piece_red_7: "P",
    piece_black_1: "k",
    piece_black_2: "a",
    piece_black_3: "b",
    piece_black_4: "h",
    piece_black_5: "r",
    piece_black_6: "c",
    piece_black_7: "p",
  },
};

export function readGlobalLang() {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return value === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export function writeGlobalLang(locale) {
  try {
    localStorage.setItem(LANG_KEY, locale === "en" ? "en" : "zh");
  } catch {
    // 存储不可用时静默忽略
  }
}

let currentLocale = "zh";

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  currentLocale = locale === "en" ? "en" : "zh";
  return currentLocale;
}

export function htmlLang(locale) {
  return locale === "en" ? "en" : "zh-CN";
}

// t(key, params)：params 以 {name} 形式替换。缺 key 回退 zh 表。
export function t(key, params) {
  const table = strings[currentLocale] ?? strings.zh;
  let text = table[key] ?? strings.zh[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
