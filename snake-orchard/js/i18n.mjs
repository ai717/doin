export const LOCALES = ['zh', 'en'];
export const LANG_KEY = 'doin.lang';
export const DEFAULT_LOCALE = 'zh';

export const isLocale = (val) => LOCALES.includes(val);

export const strings = {
  zh: {
    backHome: '首页',
    gameTitle: '果园贪吃蛇',
    score: '当前得分',
    bestScore: '历史最高',
    snakeLength: '当前长度',
    comboLabel: '连击加成',
    difficultyLabel: '游戏难度',
    diffEasy: '休闲 (慢速)',
    diffNormal: '经典 (标准)',
    diffHard: '极速 (刺激)',
    welcomeTitle: '欢迎来到果园',
    welcomeDesc: '控制贪吃蛇吃下多汁水果，避开障碍物与自身，选择适合你的挑战速度！',
    btnStart: '开始游戏',
    btnHelp: '玩法说明',
    pauseTitle: '游戏暂停',
    pauseDesc: '喝口水休息一下，美味的水果还在枝头等你。',
    btnResume: '继续游戏',
    btnRestart: '重新开始',
    btnSidePause: '暂停游戏',
    btnSideResume: '继续游戏',
    gameoverTitle: '游戏结束',
    finalScore: '本局得分',
    applesEaten: '收获果实',
    btnReplay: '再来一局',
    rulesTitle: '玩法说明',
    ruleControlHeader: '操作方式',
    ruleKeys: '键盘方向键 或 W/A/S/D 控制转向',
    ruleTouch: '手机端滑动手势 或 屏幕下方控制键',
    rulePause: 'P 键 或 空格键 快捷暂停/恢复',
    ruleScoreHeader: '果实机制与难度',
    ruleItem1: '红苹果：+10分，身体增长1节',
    ruleItem2: '黄金星果：限时刷新，+50分及连击加成',
    ruleItem3: '休闲/经典/极速模式提供完全不同的行进速度体验',
    btnClose: '返回',
    footerNotice: '纯原生态 JavaScript 驱动 · 无外链自包含'
  },
  en: {
    backHome: 'Home',
    gameTitle: 'Snake Orchard',
    score: 'Score',
    bestScore: 'Best',
    snakeLength: 'Length',
    comboLabel: 'Combo',
    difficultyLabel: 'Difficulty',
    diffEasy: 'Relaxed (Slow)',
    diffNormal: 'Classic (Normal)',
    diffHard: 'Sprint (Fast)',
    welcomeTitle: 'Welcome to Orchard',
    welcomeDesc: 'Steer the snake, devour juicy fruits, avoid collisions, and pick your favorite pace!',
    btnStart: 'Start Game',
    btnHelp: 'How to Play',
    pauseTitle: 'Game Paused',
    pauseDesc: 'Take a breath, sweet fruits await your return.',
    btnResume: 'Resume',
    btnRestart: 'Restart',
    btnSidePause: 'Pause Game',
    btnSideResume: 'Resume Game',
    gameoverTitle: 'Game Over',
    finalScore: 'Final Score',
    applesEaten: 'Fruits Picked',
    btnReplay: 'Play Again',
    rulesTitle: 'How to Play',
    ruleControlHeader: 'Controls',
    ruleKeys: 'Arrow keys or W/A/S/D to turn',
    ruleTouch: 'Swipe screen or tap on-screen D-pad',
    rulePause: 'Press P or Space to pause/resume',
    ruleScoreHeader: 'Fruits & Difficulty',
    ruleItem1: 'Red Apple: +10 pts, grows snake length by 1',
    ruleItem2: 'Golden Star Fruit: Timed spawn, +50 pts & combo',
    ruleItem3: 'Relaxed/Classic/Sprint modes provide distinct speeds',
    btnClose: 'Back',
    footerNotice: 'Pure Vanilla JS Engine · Zero External Links'
  }
};

export function format(template, params = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

export function detectLocale() {
  const saved = loadLocale();
  if (saved && isLocale(saved)) return saved;

  if (typeof navigator !== 'undefined' && navigator.language) {
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith('zh')) return 'zh';
  }
  return 'en';
}

export function loadLocale() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_LOCALE;
    const item = localStorage.getItem(LANG_KEY);
    return isLocale(item) ? item : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANG_KEY, locale);
    }
  } catch {
    // 静默降级
  }
}

export function htmlLang(locale) {
  return locale === 'zh' ? 'zh-CN' : 'en';
}
