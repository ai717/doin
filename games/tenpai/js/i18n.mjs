/**
 * Internationalization module for Tenpai King · Wait Finder (雀神听牌王 · 听牌速判)
 * Fully bilingual (zh / en), zero Chinese characters in strings.en (except langToggle label).
 * Uses global site preference 'doin.lang'.
 */

const STORAGE_LANG_KEY = 'doin.lang';

export const STRINGS = {
  zh: {
    gameTitle: '雀神听牌王 · 听牌速判',
    gameSubtitle: '绿呢雀台 · 算力争锋',
    backHome: '首页',
    levelsBtn: '题库',
    submitBtn: '提交听牌',
    clearBtn: '重选',
    restartBtn: '重开',
    pauseBtn: '暂停',
    resumeBtn: '继续',
    soundOn: '音效: 开',
    soundOff: '音效: 关',
    langToggle: 'English',
    howToPlay: '法则',
    scoreLabel: '本题得分',
    totalScoreLabel: '生涯战力',
    streakLabel: '连胜',
    timeLabel: '倒计时',
    danLabel: '段位',
    handTitle: '当前手牌 (13张 · 已听牌)',
    pickerTitle: '点选全部可胡听牌 (点击选中，再次点击设为主攻最高番)',
    targetBadge: '主攻',
    nextQuestion: '下一题',
    tryAgain: '重练此题',
    correctLabel: '全中！雀神洞悉',
    partialLabel: '合格！部分命中',
    failedLabel: '错漏！检讨复盘',
    waitsFound: '全部听牌',
    maxFanTitle: '最高番数',
    rulesTitle: '雀神听牌法则',
    rule1: '1. 面对一手 13 张已听牌手牌，在 30 秒内点击下方候选牌，找出全部能胡的听牌。',
    rule2: '2. 若有多种听牌，可指定一张为“主攻听牌”；选番数最高的路线可获满分！',
    rule3: '3. 找全得 60 分，最高番得 40 分；漏点错点扣分，连续答对享连胜加成。',
    pausedTitle: '对局已暂停',
    pausedDesc: '随时点击继续或按 P / Esc / 空格恢复倒计时。',
    levelSelectTitle: '雀神试炼题谱',
    closeBtn: '关闭',
    allWaitsTitle: '实际听牌与形状解析',
    yourSelection: '你的选择',
    explanationTitle: '胡牌拆解',
    fanUnit: '番'
  },
  en: {
    gameTitle: 'Tenpai King · Wait Finder',
    gameSubtitle: 'Green Felt Mahjong Wait & Fan Trainer',
    backHome: 'Home',
    levelsBtn: 'Puzzles',
    submitBtn: 'Submit',
    clearBtn: 'Clear',
    restartBtn: 'Restart',
    pauseBtn: 'Pause',
    resumeBtn: 'Resume',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    langToggle: '中文',
    howToPlay: 'Rules',
    scoreLabel: 'Score',
    totalScoreLabel: 'Career',
    streakLabel: 'Streak',
    timeLabel: 'Time Left',
    danLabel: 'Rank',
    handTitle: 'Your Hand (13 Tiles · In Tenpai)',
    pickerTitle: 'Select All Winning Waits (Click to select, tap again to set Target Best-Fan)',
    targetBadge: 'Target',
    nextQuestion: 'Next',
    tryAgain: 'Retry',
    correctLabel: 'Flawless! All Waits Found',
    partialLabel: 'Passed! Partially Matched',
    failedLabel: 'Missed! Review Melds',
    waitsFound: 'All Waits',
    maxFanTitle: 'Max Fan',
    rulesTitle: 'Mahjong Tenpai Rules',
    rule1: '1. Given a 13-tile hand in tenpai, identify and select all winning tiles within 30s.',
    rule2: '2. If multiple waits exist, designate a target wait for maximum Fan value.',
    rule3: '3. Finding all waits grants 60 pts; best fan grants 40 pts. Streaks grant bonuses.',
    pausedTitle: 'Game Paused',
    pausedDesc: 'Click Resume or press P / Esc / Space to continue your timer.',
    levelSelectTitle: 'Level Select',
    closeBtn: 'Close',
    allWaitsTitle: 'Actual Waits & Meld Breakdown',
    yourSelection: 'Your Picks',
    explanationTitle: 'Meld Decomposition',
    fanUnit: 'Fan'
  }
};

let currentLang = 'zh';

export function initLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    if (saved === 'en' || saved === 'zh') {
      currentLang = saved;
    } else {
      const browserLang = navigator.language || '';
      currentLang = browserLang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }
  } catch (err) {
    currentLang = 'zh';
  }
  return currentLang;
}

export function getLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  if (lang !== 'zh' && lang !== 'en') return currentLang;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_LANG_KEY, currentLang);
  } catch (err) {
    // Ignore storage issues
  }
  return currentLang;
}

export function toggleLanguage() {
  const next = currentLang === 'zh' ? 'en' : 'zh';
  return setLanguage(next);
}

export function t(key) {
  const dict = STRINGS[currentLang] || STRINGS.zh;
  return dict[key] ?? STRINGS.zh[key] ?? key;
}
