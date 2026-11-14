/**
 * @file games/bumper/js/i18n.mjs
 * 双语中心模块。
 * 统一读写共享偏好 `localStorage["doin.lang"]`，原地热更新，strings.en 严禁中文字符。
 */

export const STRINGS = {
  zh: {
    langName: 'English',
    langSwitch: 'EN',
    home: '返回门户',
    title: '微型回旋撞车',
    subtitle: '微缩玩具擂台 · 单键自旋与喷射对撞',
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
      stage: '回旋撞车主擂台',
      close: '关闭弹窗',
      thrustRed: '红车冲刺按键 (按住直冲/松开自旋)',
      thrustBlue: '蓝车冲刺按键 (按住直冲/松开自旋)',
    },
    hud: {
      act: '季',
      stage: '关',
      round: '第',
      roundUnit: '局',
      score: '比分',
      target: '抢 5 胜',
      ready: '准备',
      go: '撞！',
      paused: '已暂停',
      pausedTip: '点击擂台或按【P】继续比赛',
      shrinkWarning: '⚠️ 擂台缩圈中！',
      doubleBrake: '急刹顿挫！',
      shortcuts: '快捷键',
      keyW: '红车按【W】或【A】冲刺',
      keyUp: '蓝车按【↑】或【L】冲刺',
      keyP: '按【P】暂停 / 继续',
      keyR: '按【R】重新开始',
      hintMode1p: '当前为单人天梯（蓝车为 AI）。点击顶栏可切换为双人同屏！',
    },
    btns: {
      thrust: '冲！',
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
      titleRed: '红车获胜！',
      titleBlue: '蓝车获胜！',
      titleSingleWin: '擂王诞生！',
      titleSingleFail: '惜败坠崖！',
      subtitleRed: '烈焰红车将对手狠狠撞飞落入深渊！',
      subtitleBlue: '极速蓝车完成绝杀，守擂成功！',
      star1: '撞车胜利：赢得抢 5 分决胜',
      star2: '压倒性完胜：对手得分 ≤ 1',
      star3: '微操大师：触发双击急刹或完成多次强力对撞',
      time: '耗时',
      score: '终局比分',
    },
    help: {
      title: '玩法说明',
      introTitle: '单键回旋撞车法则',
      introDesc: '在悬空的微缩微型擂台上对决！率先将对手顶下悬崖深渊的一方得分，抢先夺得 5 分斩获比赛冠军！',
      rule1Title: '极简单键：松手自旋，按住直冲',
      rule1Desc: '松开按键时，微型小车在原地优雅旋转寻向；按住按键时，尾翼喷火以极高速度向前暴冲！每次松手还会自动反转旋转方向，调头极度灵活。',
      rule2Title: '双击急刹神技',
      rule2Desc: '在全速冲刺中快速连击两下，赛车将瞬间抛锚急刹并微退，让刹不住车的莽撞对手从身旁呼啸而过自行摔落悬崖！',
      rule3Title: '五大特色主题擂台',
      rule3Desc: '包含圆环水泥台、湿滑浮冰台（超低摩擦）、弹球狂欢（弹性保险柱反弹）、悬空齿轮（自转平台）与熔岩核心（绝境缩圈）等 23 关阶梯挑战！',
    },
    chapters: {
      act1: '第一季：基础圆环泥潭擂台',
      act2: '第二季：极地裂纹浮冰台',
      act3: '第三季：弹球狂欢游乐场',
      act4: '第四季：悬空齿轮蒸汽工坊',
      act5: '第五季：熔岩核心缩圈殿堂',
    },
    levelNames: {
      level_1: '新手撞车学员',
      level_2: '转圈小旋风',
      level_3: '蛮力铁头娃',
      level_4: '闪避小陀螺',
      level_5: '初级擂主老爹',
      level_6: '极地滑步冰灵',
      level_7: '狂暴冰原狼',
      level_8: '冰窟巡逻巡防',
      level_9: '裂纹浮冰霸主',
      level_10: '游乐场领路小丑',
      level_11: '弹力三角射手',
      level_12: '中央大弹簧巨人',
      level_13: '四角折射大师',
      level_14: '弹珠狂欢王者',
      level_15: '顺时针齿轮学徒',
      level_16: '逆时针蒸汽暴徒',
      level_17: '高压蒸汽司炉工',
      level_18: '双向咬合传动狂',
      level_19: '蒸汽工坊总装工程师',
      level_20: '熔岩前哨守卫',
      level_21: '火山口死斗士',
      level_22: '微型相扑大宗师',
      level_23: '终极微型回旋撞车之王',
    },
    aiNames: {
      ai_1: '撞车学员',
      ai_2: '小旋风',
      ai_3: '铁头娃',
      ai_4: '小陀螺',
      ai_5: '擂主老爹',
      ai_6: '滑步冰灵',
      ai_7: '冰原狼',
      ai_8: '巡防冰卫',
      ai_9: '浮冰霸主',
      ai_10: '领路小丑',
      ai_11: '三角射手',
      ai_12: '弹簧巨人',
      ai_13: '折射大师',
      ai_14: '弹球王者',
      ai_15: '齿轮学徒',
      ai_16: '蒸汽暴徒',
      ai_17: '蒸汽司炉工',
      ai_18: '传动狂人',
      ai_19: '总装工程师',
      ai_20: '熔岩前哨',
      ai_21: '火山死斗士',
      ai_22: '相扑大宗师',
      ai_23: '终极撞车之神',
    },
  },
  en: {
    langName: '中文',
    langSwitch: 'ZH',
    home: 'Portal',
    title: 'Micro Bumper',
    subtitle: 'Tabletop Bumper Arena · Spin & Slam Duel',
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
      stage: 'Bumper Arena Stage',
      close: 'Close Dialog',
      thrustRed: 'Red Car Thrust Button (Hold to thrust, release to spin)',
      thrustBlue: 'Blue Car Thrust Button (Hold to thrust, release to spin)',
    },
    hud: {
      act: 'Act',
      stage: 'Stage',
      round: 'Round',
      roundUnit: '',
      score: 'Score',
      target: 'First to 5',
      ready: 'READY',
      go: 'SLAM!',
      paused: 'PAUSED',
      pausedTip: 'Click stage or press [P] to resume',
      shrinkWarning: '⚠️ Arena is Shrinking!',
      doubleBrake: 'EMERGENCY BRAKE!',
      shortcuts: 'Shortcuts',
      keyW: 'Red press [W] or [A]',
      keyUp: 'Blue press [↑] or [L]',
      keyP: 'Press [P] Pause / Resume',
      keyR: 'Press [R] Restart Match',
      hintMode1p: 'Currently in 1P Ladder (Blue is AI). Toggle mode in topbar for 2P Versus!',
    },
    btns: {
      thrust: 'SLAM!',
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
      titleSingleWin: 'CHAMPION!',
      titleSingleFail: 'KNOCKED OUT!',
      subtitleRed: 'Red bumper car slammed the opponent straight into the abyss!',
      subtitleBlue: 'Blue bumper car dominated the platform with decisive impact!',
      star1: 'Victory: Win the first to 5 duel',
      star2: 'Clean Sweep: Opponent scored <= 1',
      star3: 'Mastery: Trigger double-tap brake or execute high-impact slams',
      time: 'Time',
      score: 'Final Score',
    },
    help: {
      title: 'How to Play',
      introTitle: 'One-Button Bumper Arena Rules',
      introDesc: 'Clash on an elevated tabletop platform without guard rails! Push your opponent off the edge to score. First to score 5 points wins the crown!',
      rule1Title: 'One-Button Mechanics: Release to Spin, Hold to Thrust',
      rule1Desc: 'Release your key to spin smoothly in place and aim your bumper; hold the key to unleash rocket thrusters straight forward! Releasing alternates spin direction for fast turns.',
      rule2Title: 'Double-Tap Emergency Brake',
      rule2Desc: 'Quickly double-tap while charging forward to drop anchor and brake hard, letting reckless opponents overshoot right past you off the cliff!',
      rule3Title: 'Five Unique Arenas',
      rule3Desc: 'Conquer 23 stages across Circular Arena, Low-friction Glacier, Bouncy Pinball Carnival, Rotating Gear Workshop, and Shrinking Lava Core!',
    },
    chapters: {
      act1: 'Act 1: Circular Arena',
      act2: 'Act 2: Cracked Glacier',
      act3: 'Act 3: Pinball Carnival',
      act4: 'Act 4: Gear Steam Workshop',
      act5: 'Act 5: Lava Core',
    },
    levelNames: {
      level_1: 'Rookie Trainee',
      level_2: 'Spinning Whirlwind',
      level_3: 'Brute Force Charger',
      level_4: 'Evasive Spinner',
      level_5: 'Arena Veteran',
      level_6: 'Glacier Slider',
      level_7: 'Raging Frost Wolf',
      level_8: 'Ice Patrol Guard',
      level_9: 'Floe Overlord',
      level_10: 'Carnival Jester',
      level_11: 'Bouncy Striker',
      level_12: 'Giant Bumper Colossus',
      level_13: 'Bank Shot Master',
      level_14: 'Pinball Monarch',
      level_15: 'Clockwise Apprentice',
      level_16: 'Counter-spin Brawler',
      level_17: 'High-pressure Stoker',
      level_18: 'Interlocking Gearhead',
      level_19: 'Workshop Chief',
      level_20: 'Lava Outpost Guard',
      level_21: 'Crater Glabiat',
      level_22: 'Mini Sumo Grandmaster',
      level_23: 'Supreme King of Bumpers',
    },
    aiNames: {
      ai_1: 'Rookie',
      ai_2: 'Whirlwind',
      ai_3: 'Charger',
      ai_4: 'Spinner',
      ai_5: 'Veteran',
      ai_6: 'Slider',
      ai_7: 'Frost Wolf',
      ai_8: 'Ice Guard',
      ai_9: 'Floe Lord',
      ai_10: 'Jester',
      ai_11: 'Striker',
      ai_12: 'Bumper Colossus',
      ai_13: 'Bank Master',
      ai_14: 'Pinball King',
      ai_15: 'Clockwise Appr.',
      ai_16: 'Gear Brawler',
      ai_17: 'Stoker',
      ai_18: 'Gearhead',
      ai_19: 'Chief Engineer',
      ai_20: 'Lava Guard',
      ai_21: 'Crater Fighter',
      ai_22: 'Sumo Master',
      ai_23: 'God of Bumpers',
    },
  },
};

/**
 * 获取当前语言偏好
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
