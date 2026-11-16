/**
 * Internationalization module for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * Fully bilingual (zh / en), zero Chinese characters in strings.en (except langToggle label).
 * Uses global site preference 'doin.lang'.
 */

const STORAGE_LANG_KEY = 'doin.lang';

export const STRINGS = {
  zh: {
    gameTitle: '巧解鲁班锁 · 榫卯拆解',
    gameSubtitle: '木匠案头 · 千年榫卯',
    backHome: '首页',
    levelsBtn: '锁谱',
    hintBtn: '提示',
    undoBtn: '悔棋',
    restartBtn: '复原',
    rotateBtn: '转视角',
    soundOn: '音效: 开',
    soundOff: '音效: 关',
    langToggle: 'English',
    howToPlay: '法则',
    remainingBlocksLabel: '待拆木块',
    extractedBlocksLabel: '已出托盘',
    stepsLabel: '抽拉步数',
    levelTitle: '锁型',
    chapterTitle: '章节',
    winTitle: '巧夺天工 · 锁体尽解！',
    winDesc: '整具榫卯结构已按玄妙次序悉数拆散。',
    nextLevel: '下一锁',
    replayLevel: '重玩此锁',
    levelSelectTitle: '千载鲁班锁谱',
    closeBtn: '关闭',
    rulesTitle: '榫卯拆解法则',
    rule1: '1. 观察三维等轴测木锁，寻找当前未被任何榫槽阻挡的自由木块。',
    rule2: '2. 点击木块将其沿长轴顺滑抽出，解脱后将飞入侧边木工托盘。',
    rule3: '3. 若木块被卡住，将轻晃并标出阻挡它的木块；按 R 键旋转等轴测视角。',
    ruleKey: '金丝楠木块为核心“锁钥”，往往是解脱整座锁体的首要生门！',
    triviaTitle: '榫卯小知识',
    tenonRatingLabel: '榫位评定',
    optimalSteps: '最优基线',
    blockedAlert: '此木块被阻挡：'
  },
  en: {
    gameTitle: 'Luban Lock · Mortise Puzzle',
    gameSubtitle: 'Ancient Chinese Interlocking Joinery',
    backHome: 'Home',
    levelsBtn: 'Locks',
    hintBtn: 'Hint',
    undoBtn: 'Undo',
    restartBtn: 'Reset',
    rotateBtn: 'Rotate',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    langToggle: '中文',
    howToPlay: 'Rules',
    remainingBlocksLabel: 'Remaining Blocks',
    extractedBlocksLabel: 'Extracted Tray',
    stepsLabel: 'Moves',
    levelTitle: 'Lock',
    chapterTitle: 'Chapter',
    winTitle: 'Master Craft! Lock Fully Disassembled!',
    winDesc: 'All mortise-and-tenon joints have been gracefully unlocked.',
    nextLevel: 'Next Lock',
    replayLevel: 'Replay',
    levelSelectTitle: 'Luban Lock Gallery',
    closeBtn: 'Close',
    rulesTitle: 'Disassembly Rules',
    rule1: '1. Observe the 3D isometric wooden lock to find free unblocked blocks.',
    rule2: '2. Click a free block to slide it out along its axis into the carpenter tray.',
    rule3: '3. If a block is blocked, it wiggles and highlights obstructions. Press R to rotate.',
    ruleKey: 'The golden block is the master Key that unlocks the entire core.',
    triviaTitle: 'Mortise & Tenon Wisdom',
    tenonRatingLabel: 'Tenon Rating',
    optimalSteps: 'Optimal Moves',
    blockedAlert: 'Blocked by:'
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
