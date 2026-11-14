// Spider Solitaire Internationalization Module
// Strict bilingual dictionaries for zh and en.
// Notice: strings.en is 100% pure English without Chinese characters.

export const LOCALES = ['zh', 'en'];
export const LANG_KEY = 'doin.lang';
export const DEFAULT_LOCALE = 'zh';

export const strings = {
  zh: {
    title: '蜘蛛纸牌 · Spider Solitaire',
    brandName: '蜘蛛纸牌',
    metaDesc: '经典蜘蛛纸牌：在十列牌桌上排成同花顺，收齐八副同花顺通关，体验移形换位的沉思策略与连环清盘的畅快。',
    backHome: '返回首页',
    soundToggle: '静音切换',
    langSwitch: 'English',
    langAria: '切换语言',
    close: '关闭',
    dealTip: '点击向每列发 1 张牌',
    ariaBoard: '游戏台面',
    ariaFoundations: '收牌槽',
    ariaControlDock: '控制操作区',
    dailySubtitle: '双花色 · 每日同题竞技',
    endlessSubtitle: '无限关卡 · 自由博弈',

    // Modes & Tabs
    modeStory: '章节模式',
    modeEndless: '永昼织网',
    modeDaily: '每日同题',

    // Chapters
    chapter1: '第 1 章 · 银线',
    chapter2: '第 2 章 · 赤线',
    chapter3: '第 3 章 · 四色缠丝',
    chapter1Subtitle: '双花色 · 基础递减与空列整组搬运',
    chapter2Subtitle: '三花色 · 花色分离与先拆后组',
    chapter3Subtitle: '四花色 · 同花顺巅峰修行',

    // Difficulty
    diffOneSuit: '单花色',
    diffTwoSuits: '双花色',
    diffThreeSuits: '三花色',
    diffFourSuits: '四花色',

    // Stats and HUD
    runsCleared: '已收同花顺',
    runsCount: '{current}/8',
    moves: '步数',
    par: '参考标杆',
    time: '用时',
    score: '得分',
    stockDealsLeft: '剩余发牌轮次',
    levelLabel: '第 {current} 关',
    streak: '连胜',

    // Actions
    deal: '发牌',
    undo: '撤回',
    hint: '提示',
    restart: '重开本局',
    selectLevel: '选择关卡',
    rules: '秘籍',
    newGame: '新开一局',

    // Dialogs
    rulesTitle: '蜘蛛纸牌玩法秘诀',
    rule1: '目标：将扑克牌按同花色由 K 至 A 递减排成顺子，集齐整副 13 张同花顺自动收牌，收满 8 副通关。',
    rule2: '移动规则：单张或同花色连续递减的牌组可整体搬移。目标列顶牌只需比移动牌大 1 点（支持跨花色暂放）。',
    rule3: '空列机动：空列可放置任意合法单张或同花顺牌组，是腾挪布局的关键资本。',
    rule4: '发牌补充：点击左上方牌堆向十列各发 1 张翻开牌（共 5 轮）。',
    rule5: '操作手势：支持点选移动、双击智能归位、拖拽搬牌；随时无限撤回。',
    rulesClose: '了解，开始织网',

    levelSelectTitle: '章节关卡',
    levelLocked: '尚未解锁',
    levelStars: '{stars}/3 星',
    levelBestMoves: '最优: {moves} 步',

    winTitle: '蛛网织就 · 恭喜通关！',
    winDesc: '你已成功集齐全部 8 副同花顺，完成本局编织！',
    statScore: '本局得分',
    statMoves: '完成步数',
    statTime: '耗费时间',
    statStars: '星级评定',
    nextLevel: '下一关',
    replay: '再玩一次',

    // Prompts & feedback
    noMovesAlert: '盘面暂无可行的移牌步骤，可点击发牌或撤销重试。',
    hintFound: '建议：将第 {from} 列的牌移至第 {to} 列。',
    hintDeal: '建议：点击发牌补充新的机遇。',
    dealEmptyAllowed: '发牌完成！十列已各补充一张牌。'
  },
  en: {
    title: 'Spider Solitaire',
    brandName: 'Spider Solitaire',
    metaDesc: 'Classic Spider Solitaire: Build same-suit descending runs from King to Ace to clear all eight sets and master patient strategy.',
    backHome: 'Back to Home',
    soundToggle: 'Toggle Sound',
    langSwitch: '中文',
    langAria: 'Switch Language',
    close: 'Close',
    dealTip: 'Deal 1 card to each column',
    ariaBoard: 'Tableau Stage',
    ariaFoundations: 'Foundation Piles',
    ariaControlDock: 'Control Dock',
    dailySubtitle: 'Two Suits · Daily Challenge',
    endlessSubtitle: 'Endless Mode · Custom Game',

    // Modes & Tabs
    modeStory: 'Story Mode',
    modeEndless: 'Endless Hunt',
    modeDaily: 'Daily Weave',

    // Chapters
    chapter1: 'Chapter 1: Silver Thread',
    chapter2: 'Chapter 2: Crimson Thread',
    chapter3: 'Chapter 3: Fourfold Web',
    chapter1Subtitle: 'Two Suits · Fundamentals & Column Clearing',
    chapter2Subtitle: 'Three Suits · Mixed Stacks & Unpacking',
    chapter3Subtitle: 'Four Suits · The Ultimate Solitaire Challenge',

    // Difficulty
    diffOneSuit: 'One Suit',
    diffTwoSuits: 'Two Suits',
    diffThreeSuits: 'Three Suits',
    diffFourSuits: 'Four Suits',

    // Stats and HUD
    runsCleared: 'Runs Cleared',
    runsCount: '{current}/8',
    moves: 'Moves',
    par: 'Par',
    time: 'Time',
    score: 'Score',
    stockDealsLeft: 'Deals Left',
    levelLabel: 'Level {current}',
    streak: 'Streak',

    // Actions
    deal: 'Deal',
    undo: 'Undo',
    hint: 'Hint',
    restart: 'Restart',
    selectLevel: 'Select Level',
    rules: 'Rules',
    newGame: 'New Game',

    // Dialogs
    rulesTitle: 'How to Play Spider Solitaire',
    rule1: 'Goal: Assemble complete same-suit sequences from King down to Ace. A full 13-card run is cleared automatically. Clear all 8 runs to win.',
    rule2: 'Moving Cards: Move a single card or a contiguous same-suit descending run. Target card must be 1 rank higher (any suit).',
    rule3: 'Empty Columns: Empty columns accept any valid card or same-suit run, serving as your vital maneuvering space.',
    rule4: 'Dealing Stock: Click the stock pile to deal 1 face-up card to every column (5 deals available).',
    rule5: 'Controls: Click to move, double-click to auto-move, or drag and drop. Unlimited undos available anytime.',
    rulesClose: 'Got it, let’s play',

    levelSelectTitle: 'Select Level',
    levelLocked: 'Locked',
    levelStars: '{stars}/3 Stars',
    levelBestMoves: 'Best: {moves} moves',

    winTitle: 'Web Woven · Victory!',
    winDesc: 'You have cleared all 8 complete runs and conquered the board!',
    statScore: 'Final Score',
    statMoves: 'Total Moves',
    statTime: 'Elapsed Time',
    statStars: 'Star Rating',
    nextLevel: 'Next Level',
    replay: 'Play Again',

    // Prompts & feedback
    noMovesAlert: 'No immediate moves found. Try dealing from the stock or undoing.',
    hintFound: 'Suggested move: Column {from} to Column {to}.',
    hintDeal: 'Suggested move: Deal 10 cards from the stock pile.',
    dealEmptyAllowed: 'Dealt 10 cards across all columns.'
  }
};

export function isLocale(locale) {
  return typeof locale === 'string' && LOCALES.includes(locale);
}

export function detectLocale() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && isLocale(saved)) return saved;
  } catch {
    // Fallback
  }
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    if (navigator.language.toLowerCase().startsWith('zh')) {
      return 'zh';
    }
  }
  return 'en';
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    localStorage.setItem(LANG_KEY, locale);
  } catch {
    // Fallback
  }
}

export function htmlLang(locale) {
  return locale === 'zh' ? 'zh-CN' : 'en-US';
}

export function format(template, params = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match;
  });
}
