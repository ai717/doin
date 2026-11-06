// i18n.mjs — 全站共享语言偏好
// 唯一口径：localStorage['doin.lang']，值为 'zh' 或 'en'

const KEY = 'doin.lang';

export const ZH = {
  backHome: '返回门户',
  stageTitle: '24 点 · 灵光一闪',
  helpBtn: '规则',
  langSwitch: 'EN',
  soundOn: '🔊',
  soundOff: '🔇',

  // 主舞台
  hintBtn: '提示',
  undoBtn: '撤回',
  resetBtn: '重开',
  stepsLabel: '步数',
  hintsLabel: '提示',

  // 章节
  chapter: '第 {n} 章',
  classicMode: '🏆 经典难题馆',
  chapterMode: '📖 章节闯关',
  selectLevel: '选择关卡',

  // 操作
  selectTwo: '点两张牌 · 选运算符',
  needTwo: '请先选两张牌',
  divisionByZero: '不能除以 0',

  // 胜负
  winTitle: '🎉 算出 24 了！',
  loseTitle: '❌ 没算到 24',
  winStars: '评价',
  winSteps: '用了 {n} 步',
  winNext: '下一关',
  winRetry: '再来一次',
  winBackToMap: '返回关卡',
  loseRetry: '再试一次',
  loseBackToMap: '返回关卡',

  // Hint
  hintOne: '💡 试试先凑出 {a} 和 {b}（用 {op}）',
  hintEmpty: '没有更多提示了，你可以的！',

  // 规则
  rulesTitle: '规则说明',
  rulesBody: '从四张牌里选两张，用加减乘除合成新牌，再继续合成，直到只剩一张——等于 24 就赢了！\n\n· 每张牌必须用一次、且只用一次\n· 选中顺序决定减法/除法的方向（先点的是被减数/被除数）\n· 允许中间出现分数（如 5-1÷5=4.8）\n· 随时可以撤回，没有次数限制\n· 用了任何提示 → 降 1 星；超过 5 步 → 降 1 星',
  ok: '确定',

  // 难度标签
  solvable: '可解',

  // 全部通关
  allCleared: '🎉 全部通关！',

  // 无限随机
  infiniteMode: '🎲 无限随机',
  infiniteHint: '可解保证 · 永不死局',
  nextRandom: '🎲 再来一道',
};

export const EN = {
  backHome: 'Home',
  stageTitle: 'Calc 24 · Flash of Insight',
  helpBtn: 'Rules',
  langSwitch: '中',
  soundOn: '🔊',
  soundOff: '🔇',

  hintBtn: 'Hint',
  undoBtn: 'Undo',
  resetBtn: 'Reset',
  stepsLabel: 'Steps',
  hintsLabel: 'Hints',

  chapter: 'Ch. {n}',
  classicMode: '🏆 Classic Hard',
  chapterMode: '📖 Chapters',
  selectLevel: 'Select Level',

  selectTwo: 'Pick two cards · choose operator',
  needTwo: 'Pick two cards first',
  divisionByZero: 'Cannot divide by 0',

  winTitle: '🎉 You made 24!',
  loseTitle: '❌ Not quite 24',
  winStars: 'Rating',
  winSteps: '{n} steps',
  winNext: 'Next',
  winRetry: 'Retry',
  winBackToMap: 'Levels',
  loseRetry: 'Try Again',
  loseBackToMap: 'Levels',

  hintOne: '💡 Try combining {a} and {b} first (with {op})',
  hintEmpty: 'No more hints — you got this!',

  rulesTitle: 'Rules',
  rulesBody: 'Pick two cards from the four, combine with + − × ÷ into a new card, keep going until only one remains — equal 24 to win!\n\n· Each card must be used exactly once\n· Selection order matters for − and ÷ (first pick is minuend/dividend)\n· Intermediate fractions are allowed (e.g. 5-1÷5=4.8)\n· Unlimited undos\n· Using hints → −1 star; over 5 steps → −1 star',
  ok: 'OK',

  solvable: 'Solvable',

  allCleared: '🎉 All Cleared!',

  infiniteMode: '🎲 Infinite',
  infiniteHint: 'Guaranteed Solvable',
  nextRandom: '🎲 Next One',
};

export function getLang() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'zh') return v;
  } catch (e) {}
  return 'zh';
}

export function setLang(lang) {
  try { localStorage.setItem(KEY, lang); } catch (e) {}
}

export function t(key, vars = {}) {
  const dict = getLang() === 'en' ? EN : ZH;
  let s = dict[key] ?? ZH[key] ?? EN[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(`{${k}}`, String(v));
  }
  return s;
}

export function applyToDOM(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (ZH[key] || EN[key]) el.textContent = t(key);
  });
}
