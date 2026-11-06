export const LOCALES = Object.freeze(['zh', 'en']);
export const LANG_KEY = 'doin.lang';
export const DEFAULT_LOCALE = 'zh';

const TRANSLATIONS = {
  zh: {
    gameTitle: '开心消消乐',
    levelSelect: '关卡',
    score: '当前得分',
    moves: '剩余步数',
    target: '通关目标',
    hint: '寻路提示',
    restart: '重新开始',
    levelTitle: '第 {n} 关',
    levelSelectTitle: '选择关卡',
    victoryTitle: '挑战成功！',
    victoryDesc: '太棒了！所有目标全部达成！',
    defeatTitle: '步数耗尽',
    defeatDesc: '还有未收集齐的目标，再试一次吧！',
    resScoreLabel: '最终得分',
    resMovesLabel: '步数奖励加分',
    resBestLabel: '历史最佳',
    btnReplay: '重新游玩',
    btnNext: '进入下一关',
    comboText: '{n} 连击！',
    shuffling: '重新洗牌中...'
  },
  en: {
    gameTitle: 'Happy Tile Match',
    levelSelect: 'Levels',
    score: 'Score',
    moves: 'Moves Left',
    target: 'Level Goals',
    hint: 'Hint',
    restart: 'Restart',
    levelTitle: 'Level {n}',
    levelSelectTitle: 'Select Level',
    victoryTitle: 'Level Cleared!',
    victoryDesc: 'Amazing! All level goals completed!',
    defeatTitle: 'Out of Moves',
    defeatDesc: 'Goals were not completed in time. Try again!',
    resScoreLabel: 'Final Score',
    resMovesLabel: 'Moves Bonus',
    resBestLabel: 'High Score',
    btnReplay: 'Replay',
    btnNext: 'Next Level',
    comboText: 'Combo x{n}!',
    shuffling: 'Reshuffling...'
  }
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function strings(locale) {
  return TRANSLATIONS[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function format(template, params = {}) {
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template
  );
}

export function detectLocale() {
  const languages = globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? ''];
  return languages.some((value) => typeof value === 'string' && value.toLowerCase().startsWith('zh')) ? 'zh' : 'en';
}

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadLocale() {
  const saved = storage()?.getItem(LANG_KEY);
  return isLocale(saved) ? saved : detectLocale();
}

export function saveLocale(locale) {
  if (!isLocale(locale)) return false;
  try {
    storage()?.setItem(LANG_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function htmlLang(locale) {
  return locale === 'zh' ? 'zh-CN' : 'en';
}

export class I18nManager {
  constructor() {
    this.currentLang = this.loadPreferredLanguage();
  }

  loadPreferredLanguage() {
    return loadLocale();
  }

  setLanguage(lang) {
    if (!isLocale(lang)) return;
    this.currentLang = lang;
    saveLocale(lang);
  }

  toggleLanguage() {
    const next = this.currentLang === 'zh' ? 'en' : 'zh';
    this.setLanguage(next);
    return next;
  }

  t(key, params = {}) {
    return format(strings(this.currentLang)[key] || strings(DEFAULT_LOCALE)[key] || key, params);
  }

  getLanguage() {
    return this.currentLang;
  }
}

export const i18n = new I18nManager();
