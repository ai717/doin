/**
 * @file games/pin/js/i18n.mjs
 * 中英双语中心，统一读写全站共享偏好 localStorage["doin.lang"]。
 * 严格红线：strings.en 绝无汉字，切语言毫秒级原地热更新，严禁页面重载刷新。
 */

export const SHARED_LANG_KEY = 'doin.lang';

export const DICTIONARIES = {
  zh: {
    langName: '中文',
    title: '见缝插针',
    tagline: '找准旋转齿轮的狭窄空隙，单键射出针头扎入圆盘，严防针头互撞！',
    backHome: '首页',
    pause: '暂停',
    resume: '继续挑战',
    restart: '瞬时重开',
    levels: '关卡',
    modeLevel: '工坊关卡',
    modeEndless: '无尽轮盘',
    soundOn: '音效: 开',
    soundOff: '音效: 关',
    howToPlay: '玩法说明',
    howToPlayDesc: '【点击屏幕 / 空格键】射出底部针头扎入旋转齿轮；避开既有针头，缝隙狭窄时预判转速节奏；清空待射弹夹即过关，针尖互撞立即失败！',

    // 章节主题
    act_apprentice: '第一章 · 钟表学徒',
    act_pendulum: '第二章 · 逆向摆钟',
    act_steam: '第三章 · 蒸汽齿轮',
    act_tempest: '第四章 · 电磁风暴',
    act_celestial: '第五章 · 精密天文仪',

    // HUD 面板
    chapterBadge: '工坊章节',
    levelBadge: '关卡',
    remainPins: '待射发条针',
    comboFlame: '连击爆发',
    tachometer: '转速声纳',
    speedLabel: '角速度',
    cwLabel: '顺时针',
    ccwLabel: '逆时针',
    endlessScore: '当前得分',
    highScoreLabel: '历史最高',
    launchTip: '点击 / 空格键 击发针头',
    instantRetryTip: '按 R 键秒速重开',

    // 结算与提示
    levelWonTitle: '齿轮合璧 · 完美通关',
    levelFailedTitle: '针尖碰撞 · 遗憾失误',
    clearTime: '通关用时',
    maxCombo: '最高连击',
    starsEarned: '收获星级',
    nextLevel: '下一关',
    retryLevel: '再来一次',
    allLevelsCleared: '大宗师！您已攻克钟表工坊全部 23 项精密机械挑战！',
    closeBtn: '关闭',
  },

  en: {
    langName: 'English',
    title: 'Pin Circle',
    tagline: 'Shoot pins into narrow gaps of spinning gears without colliding!',
    backHome: 'Home',
    pause: 'Pause',
    resume: 'Resume',
    restart: 'Instant Retry',
    levels: 'Levels',
    modeLevel: 'Ladder',
    modeEndless: 'Endless',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    howToPlay: 'How to Play',
    howToPlayDesc: '[Tap / Space] to launch needles into the rotating gear; avoid existing pins by anticipating rotation rhythm; empty your magazine to win!',

    // Themes
    act_apprentice: 'Act 1 · Apprentice Horologist',
    act_pendulum: 'Act 2 · Pendulum Reverse',
    act_steam: 'Act 3 · Steam Piston',
    act_tempest: 'Act 4 · Magnetic Tempest',
    act_celestial: 'Act 5 · Celestial Chronometer',

    // HUD
    chapterBadge: 'Workshop Act',
    levelBadge: 'Level',
    remainPins: 'Pending Pins',
    comboFlame: 'Combo Burst',
    tachometer: 'Tachometer',
    speedLabel: 'Velocity',
    cwLabel: 'CW',
    ccwLabel: 'CCW',
    endlessScore: 'Score',
    highScoreLabel: 'Best Score',
    launchTip: 'Tap / Space to launch pin',
    instantRetryTip: 'Press R to retry instantly',

    // Modals
    levelWonTitle: 'Clockwork Cleared!',
    levelFailedTitle: 'Needle Clashed!',
    clearTime: 'Time',
    maxCombo: 'Max Combo',
    starsEarned: 'Stars',
    nextLevel: 'Next Stage',
    retryLevel: 'Try Again',
    allLevelsCleared: 'Grandmaster! You have conquered all 23 clockwork challenges!',
    closeBtn: 'Close',
  },
};

export function getCurrentLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(SHARED_LANG_KEY);
      if (stored === 'zh' || stored === 'en') {
        return stored;
      }
    }
  } catch (err) {}

  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
  return 'zh';
}

export function setLanguage(lang) {
  const target = lang === 'en' ? 'en' : 'zh';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SHARED_LANG_KEY, target);
    }
  } catch (err) {}
  return target;
}

export function t(key, lang = null) {
  const current = lang || getCurrentLanguage();
  const dict = DICTIONARIES[current] || DICTIONARIES.zh;
  return dict[key] || DICTIONARIES.zh[key] || key;
}
