/**
 * @file games/tug/js/i18n.mjs
 * 双语中心模块。
 * 统一读写共享偏好 `localStorage["doin.lang"]`，原地热更新，strings.en 严禁中文字符。
 */

export const STRINGS = {
  zh: {
    langName: 'English',
    langSwitch: 'EN',
    home: '返回门户',
    title: '指尖拔河',
    subtitle: '微缩红蓝机台 · 手速与节拍对决',
    modes: {
      single: '单人天梯',
      versus: '双人同屏',
    },
    aria: {
      lang: '切换语言',
      sound: '音效开关',
      help: '玩法规则',
      levels: '关卡选择',
      restart: '重开本局',
      pause: '暂停或继续',
      resume: '继续游戏',
      modeToggle: '切换单双人模式',
      stage: '拔河擂台主舞台',
      close: '关闭弹窗',
      pullRed: '红方拉力按键 (键盘 A)',
      pullBlue: '蓝方拉力按键 (键盘 L)',
    },
    hud: {
      act: '季',
      stage: '第',
      round: '第',
      roundUnit: '局',
      score: '比分',
      target: 'BO3',
      ready: '准备',
      go: '拉！',
      paused: '已暂停',
      pausedTip: '点击擂台或按【P】继续比赛',
      cps: '手速',
      cpsUnit: '次/秒',
      perfect: '完美暴击!',
      steamBoost: '蒸汽爆发! 1.4x',
      shortcuts: '快捷键',
      keyA: '红方狂按【A】',
      keyL: '蓝方狂按【L】',
      keyP: '按【P】暂停 / 继续',
      keyR: '按【R】重新开始',
      keySpace: '按【空格】准备开局',
      hintMode1p: '当前为单人天梯（蓝方为 AI）。点击顶栏可切换为双人同屏！',
    },
    btns: {
      pull: '拉！',
      restart: '重开',
      pause: '暂停',
      resume: '继续',
      levels: '选关',
      next: '下一关',
      retry: '再来一局',
      close: '关闭',
      singleMode: '1P 天梯',
      versusMode: '2P 对决',
    },
    win: {
      titleRed: '红方胜出！',
      titleBlue: '蓝方胜出！',
      titleSingleWin: '恭喜通关！',
      titleSingleFail: '差一点就赢了！',
      subtitleRed: '红方大力士以惊人手速赢得了本场拔河！',
      subtitleBlue: '蓝方大力士将对手猛拽进了泥潭！',
      star1: '拔河胜利：赢得本场 BO3 对决',
      star2: '完胜零封：2-0 未失一小局',
      star3: '手速大师：打出 ≥5 次完美节拍暴击',
      time: '耗时',
      peakCps: '最高手速',
    },
    help: {
      title: '玩法说明',
      introTitle: '热血指尖拔河',
      introDesc: '同屏双人狂按对抗，或在单人模式中挑战 22 位身怀绝技的拔河大师！率先将绳索中心红巾拉过己方胜负线即赢下一小局，BO3 三局两胜制。',
      rule1Title: '狂点与按键分配',
      rule1Desc: '红方（P1）狂按键盘【A】键或屏幕红色【拉！】大按钮；蓝方（P2）狂按键盘【L】键或屏幕蓝色【拉！】按钮。手速越快，瞬间冲量越大！',
      rule2Title: '节奏光环与暴击',
      rule2Desc: '角色脚底有随着节奏收缩的金色光环。在光环收缩至脚下的瞬间敲击，可触发【PERFECT!】暴击，带来 1.8x 强力拉扯并喷溅火花！',
      rule3Title: '五大主题擂台',
      rule3Desc: '单人天梯包含校园运动会、湿滑泥潭（摩擦力降低）、海盗摇摆甲板（左右倾斜）、蒸汽工坊（爆发加速）与巅峰引力场等 22 关阶梯挑战！',
    },
    chapters: {
      act1: '第一季：校园操场运动会',
      act2: '第二季：泥泞狂欢擂台',
      act3: '第三季：海盗摇摆甲板',
      act4: '第四季：蒸汽狂暴工坊',
      act5: '第五季：巅峰引力擂台',
    },
    levelNames: {
      level_1: '慢半拍小明',
      level_2: '班长领操',
      level_3: '拔河课代表',
      level_4: '体育委员',
      level_5: '拔河队队长',
      level_6: '泥地滑步王',
      level_7: '暴躁泥巴人',
      level_8: '泥潭吸附怪',
      level_9: '泥地泥头车',
      level_10: '见习海盗水手',
      level_11: '独眼炮手',
      level_12: '摇摆水手长大副',
      level_13: '黑胡子船长',
      level_14: '齿轮司炉工',
      level_15: '高压阀门守卫',
      level_16: '液压动力学徒',
      level_17: '狂暴蒸汽机甲',
      level_18: '工坊总工程师',
      level_19: '磁浮挑战者',
      level_20: '引力奇点拳手',
      level_21: '外星八爪怪',
      level_22: '终极手速之神',
    },
    aiNames: {
      ai_1: '慢半拍小明',
      ai_2: '班长领操',
      ai_3: '拔河课代表',
      ai_4: '体育委员',
      ai_5: '拔河队队长',
      ai_6: '泥地滑步王',
      ai_7: '暴躁泥巴人',
      ai_8: '泥潭吸附怪',
      ai_9: '泥地泥头车',
      ai_10: '见习海盗水手',
      ai_11: '独眼炮手',
      ai_12: '摇摆水手长大副',
      ai_13: '黑胡子船长',
      ai_14: '齿轮司炉工',
      ai_15: '高压阀门守卫',
      ai_16: '液压动力学徒',
      ai_17: '狂暴蒸汽机甲',
      ai_18: '工坊总工程师',
      ai_19: '磁浮挑战者',
      ai_20: '引力奇点拳手',
      ai_21: '外星八爪怪',
      ai_22: '终极手速之神',
    },
  },
  en: {
    langName: '中文',
    langSwitch: 'ZH',
    home: 'Portal',
    title: 'Tug of War',
    subtitle: 'Diorama Versus Console · Speed & Rhythm Clash',
    modes: {
      single: '1P Ladder',
      versus: '2P Versus',
    },
    aria: {
      lang: 'Switch Language',
      sound: 'Sound Toggle',
      help: 'How to Play',
      levels: 'Level Select',
      restart: 'Restart Match',
      pause: 'Pause or Resume',
      resume: 'Resume Game',
      modeToggle: 'Toggle 1P/2P Mode',
      stage: 'Tug Arena Stage',
      close: 'Close Dialog',
      pullRed: 'Red Pull Button (Key A)',
      pullBlue: 'Blue Pull Button (Key L)',
    },
    hud: {
      act: 'Act',
      stage: 'Stage',
      round: 'Round',
      roundUnit: '',
      score: 'Score',
      target: 'BO3',
      ready: 'READY',
      go: 'PULL!',
      paused: 'PAUSED',
      pausedTip: 'Click stage or press [P] to resume',
      cps: 'Speed',
      cpsUnit: 'CPS',
      perfect: 'PERFECT!',
      steamBoost: 'STEAM BOOST! 1.4x',
      shortcuts: 'Shortcuts',
      keyA: 'Red mash [A]',
      keyL: 'Blue mash [L]',
      keyP: 'Press [P] Pause / Resume',
      keyR: 'Press [R] Restart Match',
      keySpace: 'Press [Space] Start Round',
      hintMode1p: 'Currently in 1P Ladder (Blue is AI). Toggle mode in topbar for 2P Versus!',
    },
    btns: {
      pull: 'PULL!',
      restart: 'Restart',
      pause: 'Pause',
      resume: 'Resume',
      levels: 'Levels',
      next: 'Next Level',
      retry: 'Play Again',
      close: 'Close',
      singleMode: '1P Ladder',
      versusMode: '2P Versus',
    },
    win: {
      titleRed: 'RED WINS!',
      titleBlue: 'BLUE WINS!',
      titleSingleWin: 'STAGE CLEARED!',
      titleSingleFail: 'SO CLOSE!',
      subtitleRed: 'Red wrestler pulled the opponent into the mud with blazing speed!',
      subtitleBlue: 'Blue wrestler dominated the arena with relentless force!',
      star1: 'Match Victory: Win the BO3 duel',
      star2: 'Clean Sweep: 2-0 without losing a round',
      star3: 'Rhythm Master: Trigger >= 5 Perfect Bursts',
      time: 'Time',
      peakCps: 'Peak CPS',
    },
    help: {
      title: 'How to Play',
      introTitle: 'High-Voltage Finger Tug of War',
      introDesc: 'Clash in local 2-player mode or conquer 22 distinctive AI masters in the 1-player ladder! First to pull the center ribbon over the goal line wins a round (BO3 format).',
      rule1Title: 'Mashing & Controls',
      rule1Desc: 'Red (P1) mashes key [A] or clicks the red [PULL!] button. Blue (P2) mashes key [L] or clicks the blue [PULL!] button. Faster tapping produces greater instantaneous impulse!',
      rule2Title: 'Beat Rings & Perfect Bursts',
      rule2Desc: 'A golden ring contracts beneath characters in sync with the beat. Tapping right as it aligns triggers a PERFECT! burst, delivering 1.8x pull power with flying sparks!',
      rule3Title: 'Five Unique Arenas',
      rule3Desc: 'Single player features 22 stages across School Grounds, Mud Arena (low friction), Pirate Tilting Deck, Steam Workshop, and Cosmic Gravity Ring!',
    },
    chapters: {
      act1: 'Act 1: School Athletic Meet',
      act2: 'Act 2: Muddy Arena',
      act3: 'Act 3: Pirate Tilting Deck',
      act4: 'Act 4: Steam Workshop',
      act5: 'Act 5: Cosmic Gravity Arena',
    },
    levelNames: {
      level_1: 'Slow Xiao Ming',
      level_2: 'Class Monitor',
      level_3: 'Tug Specialist',
      level_4: 'Sports Captain',
      level_5: 'Team Leader',
      level_6: 'Mud Slider',
      level_7: 'Mud Grumbler',
      level_8: 'Mud Monster',
      level_9: 'Mud Bulldozer',
      level_10: 'Apprentice Sailor',
      level_11: 'One-Eyed Gunner',
      level_12: 'Swinging First Mate',
      level_13: 'Captain Blackbeard',
      level_14: 'Stoker Bot',
      level_15: 'Pressure Guard',
      level_16: 'Hydraulic Apprentice',
      level_17: 'Steam Automaton',
      level_18: 'Chief Engineer',
      level_19: 'Magnetic Challenger',
      level_20: 'Gravity Fighter',
      level_21: 'Octopus Champion',
      level_22: 'God of Speed',
    },
    aiNames: {
      ai_1: 'Slow Xiao Ming',
      ai_2: 'Class Monitor',
      ai_3: 'Tug Specialist',
      ai_4: 'Sports Captain',
      ai_5: 'Team Leader',
      ai_6: 'Mud Slider',
      ai_7: 'Mud Grumbler',
      ai_8: 'Mud Monster',
      ai_9: 'Mud Bulldozer',
      ai_10: 'Apprentice Sailor',
      ai_11: 'One-Eyed Gunner',
      ai_12: 'Swinging First Mate',
      ai_13: 'Captain Blackbeard',
      ai_14: 'Stoker Bot',
      ai_15: 'Pressure Guard',
      ai_16: 'Hydraulic Apprentice',
      ai_17: 'Steam Automaton',
      ai_18: 'Chief Engineer',
      ai_19: 'Magnetic Challenger',
      ai_20: 'Gravity Fighter',
      ai_21: 'Octopus Champion',
      ai_22: 'God of Speed',
    },
  },
};

/**
 * 获取当前全局语言偏好
 */
export function getLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('doin.lang');
      if (stored === 'en' || stored === 'zh') return stored;
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.startsWith('zh') ? 'zh' : 'en';
    }
  } catch {
    // 降级
  }
  return 'zh';
}

/**
 * 设置当前全局语言偏好
 */
export function setLanguage(lang) {
  const safeLang = (lang === 'en') ? 'en' : 'zh';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('doin.lang', safeLang);
    }
  } catch {
    // 降级
  }
  return safeLang;
}

/**
 * 查词辅助
 */
export function t(path, lang = getLanguage()) {
  const dict = STRINGS[lang] || STRINGS.zh;
  const parts = path.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      // 找不到回退中文
      let fallback = STRINGS.zh;
      for (const fp of parts) {
        if (fallback && typeof fallback === 'object' && fp in fallback) {
          fallback = fallback[fp];
        } else {
          return path;
        }
      }
      return fallback;
    }
  }
  return cur;
}

/**
 * 原地热更新 DOM 文本，不刷新页面，不重置游戏状态
 */
export function applyI18nToDOM(lang = getLanguage()) {
  if (typeof document === 'undefined') return;

  document.documentElement.lang = (lang === 'zh') ? 'zh-CN' : 'en';

  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key, lang);
    }
  });

  const ariaElements = document.querySelectorAll('[data-i18n-aria]');
  ariaElements.forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) {
      el.setAttribute('aria-label', t(key, lang));
    }
  });

  const langBtn = document.getElementById('btn-lang');
  if (langBtn) {
    langBtn.textContent = (lang === 'zh') ? 'EN' : '中';
  }
}
