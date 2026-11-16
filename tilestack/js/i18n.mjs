/**
 * Internationalization module for TileStack (千层瓦片 · 叠叠消)
 * Fully bilingual (zh / en), zero Chinese characters in strings.en (except langToggle label).
 * Uses global site preference 'doin.lang'.
 */

const STORAGE_LANG_KEY = 'doin.lang';

export const STRINGS = {
  zh: {
    gameTitle: '千层瓦片 · 叠叠消',
    gameSubtitle: '茶桌叠瓦 · 巧解千层',
    backHome: '首页',
    levelsBtn: '关卡',
    hintBtn: '提示',
    undoBtn: '悔棋',
    restartBtn: '重开',
    pauseBtn: '暂停',
    resumeBtn: '继续',
    soundOn: '音效: 开',
    soundOff: '音效: 关',
    langToggle: 'English',
    howToPlay: '玩法',
    scoreLabel: '得分',
    stepsLabel: '步数',
    remainingTiles: '剩余瓦片',
    remainingLayers: '塔高层级',
    timeLabel: '倒计时',
    trayTitle: '七格木托槽',
    levelTitle: '关卡',
    chapterTitle: '章节',
    winTitle: '扫尽千层 · 雀鸣瓦落！',
    winDesc: '整座瓦片塔已被悉数巧解。',
    lossTitle: '托槽已满',
    lossDesc: '七格木托已被占满且无三消组合，可悔棋一步或重开本局。',
    nextLevel: '下一关',
    tryAgain: '重新挑战',
    undoLast: '悔棋一步',
    levelSelectTitle: '千层关卡谱',
    closeBtn: '关闭',
    howToTitle: '茶桌叠瓦法则',
    rule1: '1. 点击上方无任何压盖的自由瓦片，瓦片将飞入下方七格木托。',
    rule2: '2. 木托中凑齐 3 张相同瓦片立即“叮”声消除，腾出宝贵槽位。',
    rule3: '3. 槽满 7 张且无法达成三消则本局失败；合理规划取牌顺序是破局关键。',
    ruleSpecial: '特殊瓦片：玉匙解锁秘宝，冰晶瓦需双击破冰，七彩灵瓦可替代任意牌凑三。',
    warningTray: '托槽将满！请慎重取牌',
    pausedTitle: '已暂停',
    pausedDesc: '随时点击继续或按 P / Esc 恢复游戏。',
    starSummary: '星级评定',
    timeBonus: '极速时间奖励',
    hintBonus: '未用提示奖励',
    finalScore: '最终总分'
  },
  en: {
    gameTitle: 'TileStack · Layered Tile Match',
    gameSubtitle: 'Tea-Table Pagoda Match-3',
    backHome: 'Home',
    levelsBtn: 'Levels',
    hintBtn: 'Hint',
    undoBtn: 'Undo',
    restartBtn: 'Restart',
    pauseBtn: 'Pause',
    resumeBtn: 'Resume',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    langToggle: '中文',
    howToPlay: 'Rules',
    scoreLabel: 'Score',
    stepsLabel: 'Steps',
    remainingTiles: 'Tiles Left',
    remainingLayers: 'Tower Tier',
    timeLabel: 'Time',
    trayTitle: 'Wooden 7-Slot Tray',
    levelTitle: 'Level',
    chapterTitle: 'Chapter',
    winTitle: 'Tower Cleared!',
    winDesc: 'All layered tiles have been gracefully dismantled.',
    lossTitle: 'Tray Is Full!',
    lossDesc: 'The 7-slot tray is full with no 3-match available. Undo or restart to try again.',
    nextLevel: 'Next Level',
    tryAgain: 'Try Again',
    undoLast: 'Undo Move',
    levelSelectTitle: 'Level Select',
    closeBtn: 'Close',
    howToTitle: 'Tea-Table Rules',
    rule1: '1. Tap any free tile unblocked by higher layers to place it in the tray.',
    rule2: '2. Match 3 identical tiles in the tray to eliminate them and free up slots.',
    rule3: '3. If the tray fills with 7 tiles and no match is possible, the game is lost.',
    ruleSpecial: 'Special Tiles: Keys unlock chests, frosted tiles need 2 hits, and rainbow tiles match anything.',
    warningTray: 'Tray Almost Full! Plan Carefully',
    pausedTitle: 'Game Paused',
    pausedDesc: 'Click Resume or press P / Esc to continue your game.',
    starSummary: 'Star Rating',
    timeBonus: 'Time Bonus',
    hintBonus: 'Unused Hint Bonus',
    finalScore: 'Final Score'
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
