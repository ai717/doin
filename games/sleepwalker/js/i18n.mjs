/**
 * @file games/sleepwalker/js/i18n.mjs
 * 中英双语中心，统一读写全站共享偏好 `localStorage["doin.lang"]`。
 * 英文表 strings.en 绝无中文字符。
 */

export const strings = {
  zh: {
    langName: 'English',
    langSwitch: 'EN',
    home: '返回门户',
    title: '梦游先生',
    subtitle: '微缩透视剧场 · 时机解谜',
    aria: {
      lang: '切换语言',
      sound: '音效开关',
      help: '玩法规则',
      levels: '关卡选择',
      restart: '重新开始本关',
      rewind: '倒带 5 秒',
      fast: '1.5倍速快进',
      pause: '暂停或继续',
      resume: '继续游戏',
      stage: '梦境微缩剧场主舞台',
      close: '关闭弹窗',
    },
    hud: {
      chapter: '章节',
      stage: '关卡',
      bpm: '心率',
      bpmNormal: '安详熟睡',
      bpmHigh: '悬崖惊魂',
      bpmPanic: '惊恐尖叫',
      bubbles: '梦境泡泡',
      gadgetsReady: '机关就绪',
      shortcuts: '快捷键',
      keySpace: '长按【空格】1.5x 倍速',
      keyZ: '按【Z】时光倒流 5 秒',
      keyR: '按【R】快速重开',
      keyP: '按【P】暂停 / 继续',
      paused: '已暂停',
      pausedTip: '点击舞台或按【P】继续',
      tutorialTap: '点击井盖铺路！',
      tutorialStart: '点击发光的机关，为梦游先生铺路！',
    },
    btns: {
      rewind: '倒带 5 秒',
      restart: '重开',
      fast: '快进',
      pause: '暂停',
      resume: '继续',
      levels: '选关',
      next: '下一关',
      retry: '重试本关',
      close: '关闭',
      play: '开始游玩',
    },
    win: {
      title: '安然入梦！',
      subtitle: '梦游先生已安全返回温暖软床，香甜打呼噜中...',
      time: '耗时',
      star1: '梦境生还：抵达终点软床',
      star2: '深度睡眠：全程未受惊吓',
      star3: '梦境收藏家：收集全部 3 颗金泡泡',
      allCleared: '恭喜！您已护送梦游先生通关全部 22 关奇妙夜！',
    },
    fail: {
      title: '呀！惊醒了！',
      subtitle: '梦游先生踩空摔了个屁墩，睡帽都飞走了...',
      tip: '小提示：掐准时机点击机关，或者按【Z】键回溯 5 秒重新微调！',
      rewindBtn: '时光倒流 5 秒 (Z)',
    },
    help: {
      title: '玩法说明',
      introTitle: '梦境守护神法则',
      introDesc: '梦游先生正处于深度漫步状态，对万丈深渊与机关毫无察觉。玩家无法直接控制梦游先生，必须通过观察路线，在黄金时机点击环境机关为他铺平道路！',
      rule1Title: '自主漫步与遇阻折返',
      rule1Desc: '小人以恒定速度匀速前行，踏空下落。下落高度在安全范围内可安稳着陆；若过高摔落或跌出屏幕则会惊醒受惊。遇到竖直障碍会挠头转身。',
      rule2Title: '场景机关与因果链',
      rule2Desc: '井盖（限时关闭）、遮阳蓬（弹簧跳板）、引开恶犬的肉骨头、排气扇浮力风。点早了机关会复位，点晚了踩空坠落！',
      rule3Title: '时光倒带与倍速',
      rule3Desc: '失误时随时按【Z】或点击“倒带 5 秒”修正刚才的操作时机；长按【空格键】或点击“快进”可 1.5x 加速。',
    },
    chapters: {
      act1: '第一章：月光屋顶与安详街区',
      act2: '第二章：狂欢游乐场',
      act3: '第三章：惊险建筑工地',
      act4: '第四章：神秘动物园',
      act5: '第五章：未来大都会',
    },
    levelNames: {
      level_1: '静夜漫步',
      level_2: '雨棚跃动',
      level_3: '恶犬骨头',
      level_4: '屋顶多米诺',
      level_5: '小丑弹簧鞋',
      level_6: '旋转摩天轮',
      level_7: '过山车站台',
      level_8: '气球升空',
      level_9: '大马戏惊魂',
      level_10: '高空钢梁',
      level_11: '水泥滑道',
      level_12: '气动升降机',
      level_13: '安全防护网',
      level_14: '摩天楼封顶',
      level_15: '海豹顶球',
      level_16: '长颈鹿滑梯',
      level_17: '大象喷泉',
      level_18: '猴群秋千',
      level_19: '反重力光束',
      level_20: '全息霓虹桥',
      level_21: '磁浮飞驰',
      level_22: '太空睡眠舱',
    },
    badge: {
      master: '织梦大师',
      masterDesc: '已集齐全部 66 颗梦境之星！梦游先生为您穿上了黄金丝绒睡衣！',
    },
  },
  en: {
    langName: '中文',
    langSwitch: 'ZH',
    home: 'Portal',
    title: 'Sleepwalker',
    subtitle: 'Diorama Theater · Timing Puzzle',
    aria: {
      lang: 'Switch Language',
      sound: 'Sound Toggle',
      help: 'How to Play',
      levels: 'Level Select',
      restart: 'Restart Level',
      rewind: 'Rewind 5 Seconds',
      fast: '1.5x Fast Forward',
      pause: 'Pause or Resume',
      resume: 'Resume Game',
      stage: 'Diorama Theater Stage',
      close: 'Close Dialog',
    },
    hud: {
      chapter: 'Act',
      stage: 'Stage',
      bpm: 'Heartbeat',
      bpmNormal: 'Deep Slumber',
      bpmHigh: 'Narrow Escape',
      bpmPanic: 'Startled Panic',
      bubbles: 'Dream Bubbles',
      gadgetsReady: 'Gadgets Ready',
      shortcuts: 'Shortcuts',
      keySpace: 'Hold [Space] 1.5x Fast',
      keyZ: 'Press [Z] Rewind 5s',
      keyR: 'Press [R] Quick Restart',
      keyP: 'Press [P] Pause / Resume',
      paused: 'PAUSED',
      pausedTip: 'Click stage or press [P] to resume',
      tutorialTap: 'Click to close manhole!',
      tutorialStart: 'Click glowing gadgets to pave Sleepwalker\'s way!',
    },
    btns: {
      rewind: 'Rewind 5s',
      restart: 'Restart',
      fast: 'Fast',
      pause: 'Pause',
      resume: 'Resume',
      levels: 'Levels',
      next: 'Next Level',
      retry: 'Retry Stage',
      close: 'Close',
      play: 'Start Playing',
    },
    win: {
      title: 'Sweet Dreams!',
      subtitle: 'Sleepwalker is safely tucked in bed, snoring peacefully...',
      time: 'Time',
      star1: 'Dream Survivor: Reach the cozy bed',
      star2: 'Deep Sleep: Zero panics or scares',
      star3: 'Dream Collector: Collect all 3 golden bubbles',
      allCleared: 'Congratulations! You guided Sleepwalker through all 22 magical nights!',
    },
    fail: {
      title: 'Ouch! Awakened!',
      subtitle: 'Sleepwalker tripped and tumbled, sending his sleepcap flying...',
      tip: 'Tip: Time your gadget clicks carefully, or press [Z] to rewind 5 seconds and try again!',
      rewindBtn: 'Rewind 5 Seconds (Z)',
    },
    help: {
      title: 'How to Play',
      introTitle: 'Guardian of the Dream',
      introDesc: 'Sleepwalker is fast asleep and unaware of dangerous drops and traps. You cannot directly control him: watch his route and click environmental gadgets at the golden moment to pave his way!',
      rule1Title: 'Autonomous Walk & Turnaround',
      rule1Desc: 'He walks at constant pace and steps off ledges. Safe falls let him cushion and continue; high falls startle him. Vertical walls make him scratch his head and turn around.',
      rule2Title: 'Environmental Gadgets',
      rule2Desc: 'Manhole covers (timed close), awnings (bouncy ramps), bones for barking hounds, and exhaust drafts. Click too early and they reset; click too late and he drops!',
      rule3Title: 'Rewind & Fast Forward',
      rule3Desc: 'Made a mistimed click? Press [Z] or click "Rewind 5s" anytime. Hold [Space] to run at 1.5x speed.',
    },
    chapters: {
      act1: 'Act I: City Rooftops',
      act2: 'Act II: Amusement Carnival',
      act3: 'Act III: Construction Site',
      act4: 'Act IV: Midnight Zoo',
      act5: 'Act V: Cosmic Metropolis',
    },
    levelNames: {
      level_1: 'First Steps',
      level_2: 'Awning Bounce',
      level_3: 'Hound & Bone',
      level_4: 'Rooftop Domino',
      level_5: 'Clown Spring Boot',
      level_6: 'Ferris Wheel Ferry',
      level_7: 'Coaster Stop',
      level_8: 'Balloon Lift',
      level_9: 'Grand Big Top',
      level_10: 'Steel Girder Turn',
      level_11: 'Cement Chute Slide',
      level_12: 'Pneumatic Lift',
      level_13: 'Safety Net Trap',
      level_14: 'Skyscraper Pinnacle',
      level_15: 'Seal Ball Ferry',
      level_16: 'Giraffe Neck Slide',
      level_17: 'Elephant Geyser',
      level_18: 'Monkey Swing Bridge',
      level_19: 'Anti-Grav Beam',
      level_20: 'Holo-Neon Bridge',
      level_21: 'Maglev Express Dock',
      level_22: 'Cosmic Capsule Bed',
    },
    badge: {
      master: 'Master Weaver',
      masterDesc: 'All 66 dream stars collected! Sleepwalker wears the golden velvet pajamas in your honor!',
    },
  },
};

/**
 * 获取当前全局语言偏好
 */
export function getLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('doin.lang');
      if (saved === 'en' || saved === 'zh') return saved;
    }
  } catch (err) {
    // 静默
  }
  return 'zh';
}

/**
 * 设置全局语言偏好
 */
export function setLanguage(lang) {
  const chosen = lang === 'en' ? 'en' : 'zh';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('doin.lang', chosen);
    }
  } catch (err) {
    // 静默
  }
  return chosen;
}

/**
 * 获取嵌套翻译键
 */
export function t(keyPath, lang = getLanguage()) {
  const dict = strings[lang] || strings.zh;
  const parts = keyPath.split('.');
  let cur = dict;

  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = cur[part];
    } else {
      // 降级到中文
      let fallback = strings.zh;
      for (const fPart of parts) {
        if (fallback && typeof fallback === 'object' && fPart in fallback) {
          fallback = fallback[fPart];
        } else {
          return keyPath;
        }
      }
      return typeof fallback === 'string' ? fallback : keyPath;
    }
  }

  return typeof cur === 'string' ? cur : keyPath;
}

/**
 * 原地热更新 DOM 文本与属性（热替换，严禁重置游戏状态）
 */
export function applyI18nToDOM(lang = getLanguage()) {
  if (typeof document === 'undefined') return;

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

  // 更新语言按钮文字 (显示对侧语言名称)
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) {
    langBtn.textContent = strings[lang]?.langSwitch || (lang === 'zh' ? 'EN' : 'ZH');
  }

  // 同步 html 根节点 lang 属性
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
}
