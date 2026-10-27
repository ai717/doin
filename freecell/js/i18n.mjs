export const LOCALES = ['zh', 'en'];
export const LANG_KEY = 'doin.lang';
export const DEFAULT_LOCALE = 'zh';

export const strings = {
  zh: {
    title: '纸牌：经典空当接龙',
    deal: '牌局',
    score: '得分',
    time: '时间',
    moves: '步数',
    newGame: '新游戏',
    restart: '重玩',
    undo: '撤回',
    hint: '提示',
    pause: '暂停',
    resume: '继续游戏',
    pausedTitle: '游戏已暂停',
    pausedDesc: '牌局已封存，点击继续即可恢复游戏。',
    rulesTitle: '空当接龙玩法说明',
    rule1: '目标：将全部 52 张牌按同花色由 A 至 K 顺序移动到右上角 4 个本位槽（Foundation）。',
    rule2: '中转空当（左上 4 格）：每个单元可暂时存放任意 1 张纸牌。',
    rule3: '下方牌叠（8 列）：纸牌按红黑交替、点数递减（K 到 A）的规则级联接龙。',
    rule4: '多张移动：若有足够的中转单元与空列，系统将自动允许整组有序序列一并移动。',
    rule5: '技巧：双击纸牌或空白处可触发安全自动归位。',
    rulesClose: '知道了',
    winTitle: '恭喜获胜！',
    settleScore: '最终得分',
    settleTime: '通关时间',
    settleMoves: '总步数',
    playAgain: '开始新牌局',
    noHint: '暂无可行的接龙移动',
    portalHome: '返回门户首页',
    soundToggle: '静音切换',
    langToggle: '切换语言'
  },
  en: {
    title: 'Solitaire: Classic FreeCell',
    deal: 'Deal',
    score: 'Score',
    time: 'Time',
    moves: 'Moves',
    newGame: 'New Game',
    restart: 'Restart',
    undo: 'Undo',
    hint: 'Hint',
    pause: 'Pause',
    resume: 'Resume',
    pausedTitle: 'Game Paused',
    pausedDesc: 'Game state frozen. Click resume to continue playing.',
    rulesTitle: 'How to Play FreeCell',
    rule1: 'Goal: Move all 52 cards to the 4 foundation piles sorted by suit from Ace to King.',
    rule2: 'Free Cells (top-left 4 spots): Temporarily hold up to 1 card each.',
    rule3: 'Tableau Columns (bottom 8 stacks): Build down in alternating colors (e.g. Red 8 on Black 9).',
    rule4: 'Multi-card Moves: Move sequences if enough empty cells and cascades are available.',
    rule5: 'Tip: Double-click a card or tableau to auto-move safe cards to foundations.',
    rulesClose: 'Got it',
    winTitle: 'Victory!',
    settleScore: 'Final Score',
    settleTime: 'Clear Time',
    settleMoves: 'Total Moves',
    playAgain: 'Play Again',
    noHint: 'No legal moves available',
    portalHome: 'Return to Portal Home',
    soundToggle: 'Toggle Mute',
    langToggle: 'Switch Language'
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
    // 降级使用探测逻辑
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
    // 忽略异常
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
