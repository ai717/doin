export const LANG_KEY = 'doin.lang';
export const DEFAULT_LOCALE = 'zh';
export const LOCALES = ['zh', 'en'];

export const strings = {
  zh: {
    appTitle: '一笔画完',
    level: '关卡',
    progress: '连线进度',
    time: '时间',
    undo: '撤回',
    reset: '重置',
    levels: '选关',
    switchLang: 'EN',
    deadEnd: '已无路可走，请点击撤回或重置！',
    hintBlocked: '你已偏离推荐路线，先撤回再点提示。',
    victoryTitle: '顺利通关！',
    vicTime: '本次耗时',
    vicExtra: '多余步数',
    vicHint: '提示次数',
    replay: '再玩一次',
    nextLevel: '下一关',
    allCleared: '太棒了！你已通关全部关卡！',
    howToPlayTitle: '游戏玩法',
    howToPlay1: '1. 从金色发光的起点方块出发，滑动或点击连线。',
    howToPlay2: '2. 只能上下左右正交行走，每个格子只能经过一次。',
    howToPlay3: '3. 守护小动物是禁区，绕过它们把所有空格一笔连完！',
    howToPlay4: '4. 走进死胡同点“撤回”或“重置”；卡住了点“提示”逐步揭示接下来的路线。',
    gotIt: '我知道了',
    selectLevel: '选择关卡',
    locked: '未解锁',
    endless: '无尽模式',
    endlessBest: '最高 {n} 关',
    endlessStart: '从第一关开始'
  },
  en: {
    appTitle: 'One Line',
    level: 'Level',
    progress: 'Path Progress',
    time: 'Time',
    undo: 'Undo',
    reset: 'Reset',
    levels: 'Levels',
    switchLang: '中文',
    deadEnd: 'Dead end! Tap Undo or Reset to continue.',
    hintBlocked: 'Your line has left the suggested route. Undo first, then tap Hint.',
    victoryTitle: 'Level Complete!',
    vicTime: 'Time Used',
    vicExtra: 'Extra Steps',
    vicHint: 'Hints Used',
    replay: 'Replay',
    nextLevel: 'Next Level',
    allCleared: 'Awesome! You have cleared all levels!',
    howToPlayTitle: 'How to Play',
    howToPlay1: '1. Start from the glowing golden tile, drag or tap to draw.',
    howToPlay2: '2. Move orthogonally only, and visit every tile exactly once.',
    howToPlay3: '3. Guardian animals are off-limits — route around them and fill every tile!',
    howToPlay4: '4. Stuck? Tap Undo or Reset. Tap Hint to reveal a few steps at a time.',
    gotIt: 'Got It',
    selectLevel: 'Select Level',
    locked: 'Locked',
    endless: 'Endless',
    endlessBest: 'Best {n}',
    endlessStart: 'Start from Level 1'
  }
};

export function isLocale(locale) {
  return typeof locale === 'string' && LOCALES.includes(locale);
}

export function detectLocale() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch {
    // 降级容错
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const lang = navigator.language.toLowerCase();
      if (lang.startsWith('zh')) return 'zh';
    }
  } catch {
    // 降级容错
  }

  return DEFAULT_LOCALE;
}

export function loadLocale() {
  return detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LANG_KEY, locale);
    }
  } catch {
    // 忽略私有模式异常
  }
}

export function htmlLang(locale) {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function format(str, params) {
  if (!str || !params) return str || '';
  return str.replace(/\{(\w+)\}/g, (_, key) => (key in params ? String(params[key]) : `{${key}}`));
}
