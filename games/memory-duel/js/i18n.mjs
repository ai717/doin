// 记忆对决 · 国际化多语言管理 (全站共享 doin.lang，中英双表严格对齐，纯净英文)

export const LANG_KEY = "doin.lang";
export const LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "zh";

export function isLocale(v) {
  return v === "zh" || v === "en";
}

export function detectLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch {
    // 降级
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.startsWith("zh") ? "zh" : "en";
  }
  return DEFAULT_LOCALE;
}

export function loadLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch {
    // 降级
  }
  return DEFAULT_LOCALE;
}

export function saveLocale(loc) {
  if (!isLocale(loc)) return;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, loc);
    }
  } catch {
    // 降级
  }
}

export function htmlLang(loc) {
  return loc === "zh" ? "zh-CN" : "en";
}

export function format(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    return key in params ? String(params[key]) : match;
  });
}

const zh = {
  // 文档级与头部
  docTitle: "记忆对决 · DOIN 在线小游戏",
  metaDesc: "与 AI 抢配对打记忆翻牌战——看穿牌背、抢先配对、偷走对手的牌，融合记忆、情报与攻防的博弈对决。",
  backHome: "← 门户",
  btnSound: "音效",
  btnLang: "EN",
  btnHelp: "玩法说明",
  btnRestart: "重开",

  // 标题
  gameTitle: "记忆对决",
  gameSubtitle: "午夜魔法赌档 · 秘牌对决",

  // 模式
  modeChallenge: "挑战模式",
  modeEndgame: "博弈残局",
  modeLabel: "模式",
  tabChallenge: "挑战对手",
  tabEndgame: "残局推演",

  // 角色 / 对手
  aiNoviceName: "占卜学徒 · 诺维",
  aiNoviceTitle: "新秀",
  aiNoviceDesc: "记忆微弱（仅记近 4 张），20% 失误率，2 点 SP 预算。",
  aiVeteranName: "秘牌术士 · 维特",
  aiVeteranTitle: "老手",
  aiVeteranDesc: "全局精准记忆，5% 失误率，擅长防守锁牌与伺机偷袭。",
  aiMasterName: "盲眼先知 · 玛斯特",
  aiMasterTitle: "大师",
  aiMasterDesc: "完美记忆与算力预判，零失误，擅长钓鱼翻牌与精准攻防破局。",

  // 图腾
  totem_rune_star: "星钥",
  totem_rune_eye: "月瞳",
  totem_rune_fire: "火羽",
  totem_rune_crystal: "水晶",
  totem_rune_ring: "蛇戒",
  totem_rune_feather: "鸦羽",
  totem_rune_sun: "日冕",
  totem_rune_tear: "泪滴",
  totem_rune_hourglass: "砂漏",
  totem_rune_tome: "秘典",
  totem_rune_compass: "罗盘",
  totem_rune_chalice: "圣杯",
  totem_rune_spark: "电芒",
  totem_rune_lotus: "幽莲",
  totem_rune_scale: "天平",

  // 行动按钮
  actionFlip: "翻查",
  actionScout: "侦察 (1 SP)",
  actionSteal: "偷牌 (2 SP)",
  actionLock: "上锁 (1 SP)",
  actionFlipDesc: "翻开 2 张牌。若配对成功则收为完整对并获连击权；翻错则进入短暂暴露窗口后换手。",
  actionScoutDesc: "消耗 1 SP，偷看牌桌上任意 1 张暗牌，仅自己知晓情报。对手无法得知你看的是哪张。",
  actionStealDesc: "消耗 2 SP，从对手战利品堆偷走 1 个未上锁完整对中的 1 张，拆散该对并获 1 张散牌。",
  actionLockDesc: "消耗 1 SP，为己方 1 个完整对盖上锁印，使其永久免疫被对手偷牌。",

  // HUD
  playerVault: "你的战利品宝箱",
  opponentVault: "对手宝箱",
  spLabel: "策略点 (SP)",
  pairsLabel: "完整对",
  lockedLabel: "已锁",
  looseLabel: "散牌",
  targetGoal: "目标",
  roundTurn: "回合 {n}",
  turnPlayer: "▶ 轮到你的回合",
  turnOpponent: "⏳ 对手思考中…",
  comboBonus: "{n} 连击！",
  aiHiddenSp: "已消耗 {used}/5 SP",
  scoutClickHint: "请在牌桌上点击一张暗牌进行侦察",
  cancelScout: "取消侦察",
  needSelectSecond: "请再点击一张暗牌进行配对",
  clickSameToCancel: "（点击同一张可盖回取消）",

  // 事件日志
  eventFlipFirst: "你翻开了第 {index} 位卡牌",
  eventFlipCancel: "取消了翻开",
  eventMatchSuccess: "✨ 配对成功！获得 1 完整对，连击继续！",
  eventMatchFail: "配对失败，牌面暴露中…",
  eventScoutPlayer: "👁️ 你侦察了 1 张暗牌，掌握了秘密情报！",
  eventScoutOpponent: "👁️ 对手消耗 1 SP 使用了秘密侦察！",
  eventStealPlayer: "🗡️ 你偷走了对手的一张牌！拆散了对方的完整对！",
  eventStealOpponent: "⚠️ 对手发动黑手偷袭！你的一对秘牌被拆散了！",
  eventLockPlayer: "🛡️ 你为 1 个完整对加盖了鎏金锁印！坚不可摧！",
  eventLockOpponent: "🛡️ 对手锁定了一对完整秘牌！",
  eventEndExposure: "暴露结束，换手行动。",

  // 终局弹窗
  victoryTitle: "👑 胜利！赢下对决",
  defeatTitle: "💔 惜败！被先知击败",
  tieTitle: "🤝 棋逢对手 · 平局",
  winTargetReached: "率先凑齐了目标完整对！",
  winBoardCleared: "牌桌全部结算完毕，比分胜出！",
  defeatTargetReached: "对手抢先一步凑齐了目标对数！",
  defeatBoardCleared: "牌桌清空结算，对手对数占优！",
  starsTitle: "通关评级",
  statNetPairs: "净胜对数差",
  statRemainingSp: "剩余 SP 资源",
  statMistakes: "翻查失误次数",
  statTurns: "消耗回合数",
  btnNextStage: "下一位对手",
  btnNextPuzzle: "下一残局",
  btnRetryDuel: "重新挑战",
  btnBackToPuzzles: "残局列表",

  // 玩法规则弹窗
  rulesTitle: "《记忆对决》玩法与攻防博弈",
  rulesSection1Title: "1. 经典翻查与连击",
  rulesSection1Body: "轮到你的回合，可免费翻开 2 张牌。如果图案配对成功，直接收进战利品宝箱，并获得【连击权】（可在本回合继续行动）；翻错则牌面会在短暂停留后自动盖回并换手。",
  rulesSection2Title: "2. 策略点 (SP) 与三大行动",
  rulesSection2Body: "每局开局每方持有 5 点不可补充的策略点：\n• 侦察 (1 SP)：偷看任意一张暗牌，只有你看得到，不完全信息博弈！\n• 偷牌 (2 SP)：从对手战利品堆偷走 1 张未上锁的牌，拆散其完整对，自己得 1 张散牌！\n• 上锁 (1 SP)：给己方完整对盖上鎏金锁印，永久免疫被偷！",
  rulesSection3Title: "3. 胜负判定与无死局保证",
  rulesSection3Body: "率先凑满指定数量（5/6/7）完整对立即获胜！若桌面牌翻空，则依次比较完整对数、散牌数。即使最大偷牌也不会导致死局，100% 终局。",
  rulesClose: "我知道了，开战！",

  // 残局关卡标题与描述
  puzzleListTitle: "博弈残局推演",
  puzzleSelect: "第 {n} 关",
  puzzleGoal: "目标：{target} 对 | 步数限制：{steps} 步",
  puzzle1Title: "残局 1 · 绝杀直配",
  puzzle1Desc: "对手已有 2 对，而你已有 2 对。桌面上星钥位置已被侦察，只需精准配对即可立刻绝杀！",
  puzzle1Hint: "直接翻开 1 号和 4 号星钥完成绝杀。",
  puzzle2Title: "残局 2 · 围魏救赵",
  puzzle2Desc: "对手只差 1 对即将获胜，且掌握了桌面情报。你拥有 2 SP，必须立刻偷袭对手打破其关键对！",
  puzzle2Hint: "使用偷牌拆散对手唯一的未锁完整对。",
  puzzle3Title: "残局 3 · 锁印先机",
  puzzle3Desc: "你手握关键对但尚未锁定，对手拥有 2 SP 下回合必发动偷袭。先行上锁封死对手！",
  puzzle3Hint: "消耗 1 SP 给完整对上锁，确保防线不失。",
  puzzle4Title: "残局 4 · 迷雾侦察",
  puzzle4Desc: "关键秘典只知其一，另一张藏在未知暗牌中。使用 1 SP 侦察暗牌锁定位置，随后连击收割！",
  puzzle4Hint: "使用侦察确认位置后再翻牌。",
  puzzle5Title: "残局 5 · 斩杀抉择",
  puzzle5Desc: "双方对局来到赛点，剩余电芒已明牌，直接翻查即可直取胜利，无需浪费 SP！",
  puzzle5Hint: "零 SP 翻查已知电芒即可胜利。",
  puzzle6Title: "残局 6 · 天平倾斜",
  puzzle6Desc: "对手步步紧逼，先配对天平，随后根据局势决定防守还是反攻！",
  puzzle6Hint: "配对天平后评估对手 SP 威胁。",
  puzzle7Title: "残局 7 · 日冕之光",
  puzzle7Desc: "双方仅差最后 1 对，残局星钥在手，一锤定音。",
  puzzle7Hint: "翻开星钥完成绝杀。",
  puzzle8Title: "残局 8 · 双管齐下",
  puzzle8Desc: "对手蓄势待发，先偷取其完整对拉开差距，再翻查月瞳终结比赛！",
  puzzle8Hint: "利用 4 SP 展开偷袭并翻出月瞳。",
  puzzle9Title: "残局 9 · 蛇戒之誓",
  puzzle9Desc: "面对强敌的大师级残局，蛇戒位置已锁，完成翻查登顶！",
  puzzle9Hint: "直接翻出蛇戒完成绝杀。",
  puzzle10Title: "残局 10 · 幽莲破晓",
  puzzle10Desc: "散牌争夺战，幽莲已知，配对后在终盘胜出。",
  puzzle10Hint: "翻查幽莲锁定胜局。",
  puzzle11Title: "残局 11 · 攻守逆转",
  puzzle11Desc: "对手拥有高 SP 威胁，先偷牌打乱节奏，再配对火羽逆风翻盘。",
  puzzle11Hint: "精准偷牌后完成配对。",
  puzzle12Title: "残局 12 · 闪电收官",
  puzzle12Desc: "双方均达 4 对，只剩最后一击，翻开闪电赢下尊严之战。",
  puzzle12Hint: "配对闪电赢得最终胜利。",
  puzzle13Title: "残局 13 · 罗盘定位",
  puzzle13Desc: "神圣对决，罗盘之秘已解，稳扎稳打锁定胜局。",
  puzzle13Hint: "翻查罗盘。",
  puzzle14Title: "残局 14 · 秘典终章",
  puzzle14Desc: "对手仅差 1 步，先偷牌破坏其关键胜利点，再寻机配对翻盘。",
  puzzle14Hint: "必须先发动偷牌抢回局势。",
  puzzle15Title: "残局 15 · 最终博弈",
  puzzle15Desc: "最高殿堂博弈：天平与星钥的终极交响，计算每 1 点 SP，走向唯一胜利线！",
  puzzle15Hint: "配对天平并确保防守完成绝杀。",
};

const en = {
  // Document and Header
  docTitle: "Memory Duel · DOIN Web Games",
  metaDesc: "Clash against AI in a tactical memory showdown: peek behind cards, snatch pairs, and steal your rival's loot in this battle of memory, intel, and combat.",
  backHome: "← Portal",
  btnSound: "Audio",
  btnLang: "中",
  btnHelp: "How to Play",
  btnRestart: "Restart",

  // Titles
  gameTitle: "Memory Duel",
  gameSubtitle: "Midnight Arcane Parlor · Secret Card Clash",

  // Modes
  modeChallenge: "Challenge",
  modeEndgame: "Endgame Puzzle",
  modeLabel: "Mode",
  tabChallenge: "Challenge AI",
  tabEndgame: "Endgame Puzzles",

  // Personas
  aiNoviceName: "Divination Apprentice Novice",
  aiNoviceTitle: "Novice",
  aiNoviceDesc: "Weak memory (recalls last 4 cards), 20% mistake rate, 2 SP budget.",
  aiVeteranName: "Arcane Mystic Veteran",
  aiVeteranTitle: "Veteran",
  aiVeteranDesc: "Full memory retention, 5% mistake rate, adept at locking pairs and opportunistic steals.",
  aiMasterName: "Blind Prophet Master",
  aiMasterTitle: "Master",
  aiMasterDesc: "Flawless memory and strategic foresight, zero mistakes, baits with fishing flips and executes optimal steals.",

  // Totems
  totem_rune_star: "Star Key",
  totem_rune_eye: "Moon Eye",
  totem_rune_fire: "Fire Feather",
  totem_rune_crystal: "Crystal",
  totem_rune_ring: "Snake Ring",
  totem_rune_feather: "Raven Feather",
  totem_rune_sun: "Solar Corona",
  totem_rune_tear: "Tear Drop",
  totem_rune_hourglass: "Hourglass",
  totem_rune_tome: "Arcane Tome",
  totem_rune_compass: "Compass",
  totem_rune_chalice: "Chalice",
  totem_rune_spark: "Lightning Spark",
  totem_rune_lotus: "Lotus",
  totem_rune_scale: "Balance Scale",

  // Actions
  actionFlip: "Flip",
  actionScout: "Scout (1 SP)",
  actionSteal: "Steal (2 SP)",
  actionLock: "Lock (1 SP)",
  actionFlipDesc: "Flip 2 cards. A match claims the pair and grants combo privilege; a mismatch reveals cards briefly before ending turn.",
  actionScoutDesc: "Spend 1 SP to peek at any hidden card on the table. Only you see the secret intel. Opponent is kept in the dark.",
  actionStealDesc: "Spend 2 SP to snatch 1 card from an unlocked pair in the opponent's vault, breaking the pair and granting you 1 loose card.",
  actionLockDesc: "Spend 1 SP to imprint a gilded seal onto one of your complete pairs, rendering it permanently immune to steals.",

  // HUD
  playerVault: "Your Trophy Vault",
  opponentVault: "Opponent Vault",
  spLabel: "Strategy Points (SP)",
  pairsLabel: "Pairs",
  lockedLabel: "Locked",
  looseLabel: "Loose",
  targetGoal: "Goal",
  roundTurn: "Turn {n}",
  turnPlayer: "▶ Your Turn",
  turnOpponent: "⏳ Opponent Thinking…",
  comboBonus: "{n} COMBO!",
  aiHiddenSp: "Used {used}/5 SP",
  scoutClickHint: "Click a hidden card on the table to scout it",
  cancelScout: "Cancel Scout",
  needSelectSecond: "Click another hidden card to complete pair",
  clickSameToCancel: "(Click the same card to unflip)",

  // Event Log
  eventFlipFirst: "You flipped card at slot #{index}",
  eventFlipCancel: "Flip cancelled",
  eventMatchSuccess: "✨ Match! Claimed 1 complete pair, combo continues!",
  eventMatchFail: "Mismatch. Cards exposed briefly…",
  eventScoutPlayer: "👁️ You scouted a hidden card and gained secret intel!",
  eventScoutOpponent: "👁️ Opponent spent 1 SP on secret reconnaissance!",
  eventStealPlayer: "🗡️ You snatched a card from your rival, breaking their pair!",
  eventStealOpponent: "⚠️ Opponent raided your vault! One of your pairs was broken!",
  eventLockPlayer: "🛡️ You placed a golden lock seal on a complete pair! Impenetrable!",
  eventLockOpponent: "🛡️ Opponent sealed a complete pair!",
  eventEndExposure: "Exposure window ended. Turn passed.",

  // Endgame Dialog
  victoryTitle: "👑 VICTORY! Duel Won",
  defeatTitle: "💔 DEFEAT! Outsmarted",
  tieTitle: "🤝 DRAW! Worthy Rival",
  winTargetReached: "First to reach the target complete pairs!",
  winBoardCleared: "Board cleared, victory secured by point count!",
  defeatTargetReached: "Opponent claimed target pairs first!",
  defeatBoardCleared: "Board cleared, opponent leads on points!",
  starsTitle: "Duel Rating",
  statNetPairs: "Net Pairs Difference",
  statRemainingSp: "Remaining SP Resource",
  statMistakes: "Flip Mistakes",
  statTurns: "Turns Taken",
  btnNextStage: "Next Opponent",
  btnNextPuzzle: "Next Puzzle",
  btnRetryDuel: "Try Again",
  btnBackToPuzzles: "Puzzle Select",

  // Rules Dialog
  rulesTitle: "Memory Duel · Rules & Strategy",
  rulesSection1Title: "1. Classic Flip & Combos",
  rulesSection1Body: "On your turn, flip 2 cards for free. If totems match, claim the pair into your vault and gain Combo Privilege to act again; mismatching cards stay exposed briefly before flipping back and ending your turn.",
  rulesSection2Title: "2. Strategy Points (SP) & Tactical Actions",
  rulesSection2Body: "Each duelist starts with 5 non-replenishable Strategy Points:\n• Scout (1 SP): Peek at any hidden card. Only you learn what it is—asymmetric information!\n• Steal (2 SP): Snatch 1 card from rival's unlocked pair, breaking their pair and granting you 1 loose card!\n• Lock (1 SP): Stamp a gilded lock seal onto your pair to prevent it from being stolen!",
  rulesSection3Title: "3. Victory & Mathematical Fairness",
  rulesSection3Body: "First to gather target complete pairs (5/6/7) wins immediately! If the board is cleared, victory is decided by pair count, then loose cards. Even maximal steals cannot deadlock the game, guaranteeing a 100% decisive finish.",
  rulesClose: "Understood, Let's Duel!",

  // Puzzle Titles & Descriptions
  puzzleListTitle: "Endgame Puzzles",
  puzzleSelect: "Puzzle {n}",
  puzzleGoal: "Goal: {target} Pairs | Limit: {steps} Steps",
  puzzle1Title: "Puzzle 1 · Decisive Match",
  puzzle1Desc: "Rival holds 2 pairs, and you have 2 pairs. Star Key positions are known. Flip them now for an instant win!",
  puzzle1Hint: "Directly flip the Star Keys at slots 0 and 3.",
  puzzle2Title: "Puzzle 2 · Preemptive Strike",
  puzzle2Desc: "Rival is one pair away from victory. You have 2 SP. Steal their unlocked pair immediately to disrupt their win condition!",
  puzzle2Hint: "Use Steal to break opponent's only unlocked pair.",
  puzzle3Title: "Puzzle 3 · Gilded Ward",
  puzzle3Desc: "You hold a critical pair. Rival has 2 SP ready to strike. Lock down your pair to seal their doom!",
  puzzle3Hint: "Spend 1 SP on Lock to secure your pair.",
  puzzle4Title: "Puzzle 4 · Mist Recon",
  puzzle4Desc: "One Tome is known, the other is hidden in the dark. Spend 1 SP to scout the unknown card and initiate combo!",
  puzzle4Hint: "Scout to locate the matching pair before flipping.",
  puzzle5Title: "Puzzle 5 · Zero-Cost Finisher",
  puzzle5Desc: "Match point showdown! Both Spark cards are known. Flip them directly without wasting precious SP!",
  puzzle5Hint: "Flip the known Spark cards for 0 SP.",
  puzzle6Title: "Puzzle 6 · Tipped Scales",
  puzzle6Desc: "Opponent is closing in. Pair the Balance Scale first, then evaluate whether to fortify or attack!",
  puzzle6Hint: "Pair the Scale and counter rival's SP threat.",
  puzzle7Title: "Puzzle 7 · Solar Ray",
  puzzle7Desc: "Only one pair remains between you and victory. Star Key is in sight—strike with precision!",
  puzzle7Hint: "Flip the Star Keys to claim victory.",
  puzzle8Title: "Puzzle 8 · Double Gambit",
  puzzle8Desc: "Opponent has momentum. Steal their pair with 2 SP, then match the Moon Eye to turn the tide!",
  puzzle8Hint: "Raid rival's pair then match Moon Eye.",
  puzzle9Title: "Puzzle 9 · Serpent's Oath",
  puzzle9Desc: "A master-level puzzle. Snake Ring positions are memorized. Execute the final flip to triumph!",
  puzzle9Hint: "Flip the Snake Rings to seal victory.",
  puzzle10Title: "Puzzle 10 · Lotus Dawn",
  puzzle10Desc: "A fight for loose cards. Lotus is identified—match it to edge out the competition.",
  puzzle10Hint: "Match the Lotus to clinch victory.",
  puzzle11Title: "Puzzle 11 · Iron Reversal",
  puzzle11Desc: "Opponent threatens with high SP. Steal first to shatter their strategy, then collect Fire Feather.",
  puzzle11Hint: "Execute a tactical steal then flip Fire Feather.",
  puzzle12Title: "Puzzle 12 · Lightning Strike",
  puzzle12Desc: "Both players at 4 pairs. One match settles the war. Strike Lightning for the ultimate glory!",
  puzzle12Hint: "Match Lightning Spark to claim victory.",
  puzzle13Title: "Puzzle 13 · Arcane Compass",
  puzzle13Desc: "A sacred confrontation. The compass secret is unlocked—steady your hand and finish it.",
  puzzle13Hint: "Flip the Compass cards.",
  puzzle14Title: "Puzzle 14 · Final Chapter",
  puzzle14Desc: "Rival is one turn from winning. Steal their pair to derail their strategy, then turn the board.",
  puzzle14Hint: "Steal immediately to break rival's momentum.",
  puzzle15Title: "Puzzle 15 · Grandmaster Climax",
  puzzle15Desc: "The pinnacle of duels: Balance Scale and Star Key converge. Calculate every single SP to find the only path!",
  puzzle15Hint: "Pair the Scale and defend your lead to finish.",
};

export function strings(loc = "zh") {
  return loc === "en" ? en : zh;
}

export function t(key, loc = "zh", params = {}) {
  const dict = strings(loc);
  const tmpl = dict[key] || zh[key] || key;
  return format(tmpl, params);
}
