/**
 * @file games/screw/js/i18n.mjs
 * 中英双语中心，统一读写全站共享偏好 localStorage["doin.lang"]。
 * 切换语言只做原地热更新，绝不刷新页面或重置盘面。
 */

export const SHARED_LANG_KEY = 'doin.lang';

export const DICTIONARIES = {
  zh: {
    langName: '中文',
    title: '拧螺丝解谜',
    subtitle: '微缩五金工坊',
    tagline: '拧出彩色螺栓，让交错面板在重力下连锁坠落，拆空 21 关微缩机械装置！',
    docTitle: '拧螺丝解谜 · DOIN 在线小游戏',

    backHome: '← 门户',
    levels: '关卡',
    undo: '撤销',
    magnet: '磁吸',
    restart: '重开',
    pause: '暂停',
    resume: '继续',
    soundOn: '音效 开',
    soundOff: '音效 关',
    help: '玩法',
    close: '关闭',
    stageWord: '关卡',
    boardAria: '拧螺丝解谜盘面',

    chapterLabel: '篇章',
    remain: '剩余螺栓',
    platesCleared: '已拆面板',
    movesLabel: '步数',
    timeLabel: '用时',
    undosLabel: '撤销次数',
    hudLedger: '拆解簿',
    hudRadar: '螺孔透视台',
    queueLabel: '收纳盒队列',
    bufferLabel: '备用孔',
    nowBox: '当前',
    queueEmpty: '已全部装箱',
    bufferFull: '备用孔已满',
    jamMagnet: '备用孔已满！用磁吸强行吸走一颗螺栓，或按 Z 撤销。',

    magnetReady: '磁吸 ×1',
    magnetUsed: '磁吸已用',
    magnetArmed: '磁吸就绪：点击一颗螺栓',
    magnetHelp: '每关 1 次，可强行吸走一颗阻路螺栓。',
    magnetEmpty: '本关磁吸机会已用完',
    magnetCancel: '已取消磁吸',
    magnetToast: '磁吸已激活，点击一颗未被遮挡的螺栓',

    hintTap: '点击未被遮挡的螺栓：同色飞入当前收纳盒，异色暂存底部备用孔。',
    hintUndo: 'Z 无限撤销 · P 暂停 · R 重开',
    hintBuffer: '收纳盒每盒收 3 颗同色螺栓；备用孔满且无匹配螺栓就会死锁。',
    hintMagnet: '每关 1 次磁吸，可强行吸走一颗阻路螺栓。',

    pausedTitle: '已暂停',
    pausedDesc: '工坊暂时停工，螺栓与面板都冻结在原位。',
    continueBtn: '继续拆解',
    restartBtn: '重新开始',
    levelsBtn: '选关',

    rulesTitle: '工坊拆解手册',
    ruleGoalTitle: '拆空整个装置',
    ruleGoalDesc: '拧下所有螺栓，填满每一只收纳盒，让失去支撑的板材在重力下连锁坠落，拆空整面装置。',
    ruleTapTitle: '拧出螺栓',
    ruleTapDesc: '点击未被遮挡的螺栓。颜色匹配当前收纳盒时飞入盒中；没有匹配盒时暂存到底部备用孔。',
    ruleBufferTitle: '收纳盒与备用孔',
    ruleBufferDesc: '每只收纳盒需要 3 颗同色螺栓。备用孔已满且没有匹配当前盒的裸露螺栓时会死锁，可按 Z 撤销或重开。',
    ruleSwingTitle: '单钉悬挂',
    ruleSwingDesc: '板材只剩 1 颗螺栓时会以它为铰链摆开，不再遮挡下层；拔出最后一颗后整板坠落。',
    knowRules: '开工',

    levelsTitle: '关卡相册',
    levelsHint: '点击已解锁关卡立即开拆。',
    locked: '未解锁',
    lockedHint: '通关上一关后解锁。',
    bestTime: '最佳用时',
    bestMoves: '最佳步数',
    starsLabel: '星级',
    newRecord: '新纪录',
    noRecord: '暂无记录',
    stageClear: '关卡完成',
    allClear: '全部 21 关拆解完成，荣登拆解大宗师！',
    wonTitle: '装置拆解完成！',
    wonDesc: '所有板材已坠落，整面装置被彻底拆空。',
    lostTitle: '备用孔卡死',
    lostDesc: '备用孔已满，且没有可匹配当前收纳盒的裸露螺栓。撤销一步或重开吧。',
    nextLevel: '下一关',
    replay: '重玩本关',
    undoOne: '撤销一步',

    chapter_1: '第一工坊 · 原木积木',
    chapter_1_sub: '熟悉螺栓、面板与重力',
    chapter_2: '第二工坊 · 彩虹亚克力',
    chapter_2_sub: '半透明交叠与备用孔腾挪',
    chapter_3: '第三工坊 · 机械金属',
    chapter_3_sub: '单钉铰链摆动，露出死角螺孔',
    chapter_4: '第四工坊 · 霓虹齿轮',
    chapter_4_sub: '齿轮轮廓与多重十字联动',
    chapter_5: '第五工坊 · 大师悬挂',
    chapter_5_sub: '拆空终极微缩装置',

    lvl_1: '第一块木板',
    lvl_2: '十字榫卯',
    lvl_3: '双层搁板',
    lvl_4: '木工长台',
    lvl_5: '玻璃叠影',
    lvl_6: '棱镜织网',
    lvl_7: '彩虹接力',
    lvl_8: '万花面板',
    lvl_9: '水晶织机',
    lvl_10: '铰链试炼',
    lvl_11: '摆锤长列',
    lvl_12: '钢铁编织',
    lvl_13: '桁架之桥',
    lvl_14: '初生齿轮',
    lvl_15: '霓虹网罩',
    lvl_16: '齿轮列车',
    lvl_17: '电路绽放',
    lvl_18: '超频装置',
    lvl_19: '宏伟机构',
    lvl_20: '大师之冠',
    lvl_21: '终焉装置',

    color_red: '红',
    color_yellow: '黄',
    color_blue: '蓝',
    color_green: '绿',
    color_purple: '紫',
    color_red_long: '烈焰红',
    color_yellow_long: '活力黄',
    color_blue_long: '极速蓝',
    color_green_long: '翠玉绿',
    color_purple_long: '罗兰紫',
  },

  en: {
    langName: 'English',
    title: 'Screw Jam Workshop',
    subtitle: 'Miniature Hardware Workshop',
    tagline: 'Unscrew colorful bolts, drop layered plates with gravity, and strip 21 miniature machines!',
    docTitle: 'Screw Jam Workshop · DOIN Online Games',

    backHome: '← Portal',
    levels: 'Stages',
    undo: 'Undo',
    magnet: 'Magnet',
    restart: 'Retry',
    pause: 'Pause',
    resume: 'Resume',
    soundOn: 'Sound On',
    soundOff: 'Sound Off',
    help: 'Rules',
    close: 'Close',
    stageWord: 'Stage',
    boardAria: 'Screw puzzle board',

    chapterLabel: 'Chapter',
    remain: 'Screws Left',
    platesCleared: 'Plates Off',
    movesLabel: 'Moves',
    timeLabel: 'Time',
    undosLabel: 'Undos',
    hudLedger: 'Teardown Ledger',
    hudRadar: 'Socket Radar',
    queueLabel: 'Box Queue',
    bufferLabel: 'Buffer',
    nowBox: 'NOW',
    queueEmpty: 'All Packed',
    bufferFull: 'Buffer Full',
    jamMagnet: 'Buffer jammed! Use the magnet to force out a screw, or press Z to undo.',

    magnetReady: 'Magnet ×1',
    magnetUsed: 'Magnet Used',
    magnetArmed: 'Magnet armed: tap a screw',
    magnetHelp: 'Once per stage, force one blocking screw out.',
    magnetEmpty: 'No magnet left in this stage',
    magnetCancel: 'Magnet cancelled',
    magnetToast: 'Magnet armed — tap an exposed screw',

    hintTap: 'Tap an exposed screw: matching colors fly into the active box, others park in the bottom buffer.',
    hintUndo: 'Z undo · P pause · R retry',
    hintBuffer: 'Each box takes 3 matching screws. A full buffer with no match is a deadlock.',
    hintMagnet: 'One magnet per stage can force out a blocking screw.',

    pausedTitle: 'PAUSED',
    pausedDesc: 'The workshop is taking a break. Bolts and plates are frozen in place.',
    continueBtn: 'Resume Work',
    restartBtn: 'Start Over',
    levelsBtn: 'Stages',

    rulesTitle: 'Workshop Teardown Manual',
    ruleGoalTitle: 'Clear the Device',
    ruleGoalDesc: 'Unscrew every bolt, fill every color box, and let gravity strip the whole layered device.',
    ruleTapTitle: 'Unscrew',
    ruleTapDesc: 'Tap an exposed screw. If it matches the active box it flies in; otherwise it parks in the bottom buffer.',
    ruleBufferTitle: 'Boxes & Buffer',
    ruleBufferDesc: 'Each box takes 3 matching screws. A full buffer with no matching exposed screw is a deadlock — undo with Z or retry.',
    ruleSwingTitle: 'One-Screw Hinge',
    ruleSwingDesc: 'A plate down to one screw swings aside on that hinge and stops blocking lower layers. Remove the last screw to drop it.',
    knowRules: 'Start Work',

    levelsTitle: 'Stage Album',
    levelsHint: 'Tap an unlocked stage to start stripping.',
    locked: 'Locked',
    lockedHint: 'Clear the previous stage to unlock.',
    bestTime: 'Best Time',
    bestMoves: 'Best Moves',
    starsLabel: 'Stars',
    newRecord: 'New Record',
    noRecord: 'No record yet',
    stageClear: 'Stage Clear',
    allClear: 'All 21 stages stripped — you are the Teardown Master!',
    wonTitle: 'Device Fully Stripped!',
    wonDesc: 'Every plate has fallen. The whole device is completely stripped.',
    lostTitle: 'Buffer Jammed',
    lostDesc: 'The buffer is full and no exposed screw matches the active box. Undo one step or retry.',
    nextLevel: 'Next Stage',
    replay: 'Replay Stage',
    undoOne: 'Undo One',

    chapter_1: 'Workshop I · Wooden Blocks',
    chapter_1_sub: 'Learn screws, plates, and gravity',
    chapter_2: 'Workshop II · Rainbow Acrylic',
    chapter_2_sub: 'Translucent layers and buffer shuffles',
    chapter_3: 'Workshop III · Metallic Hinges',
    chapter_3_sub: 'Single-screw hinges reveal hidden sockets',
    chapter_4: 'Workshop IV · Neon Gearbox',
    chapter_4_sub: 'Gear outlines and cross-linked layers',
    chapter_5: 'Workshop V · Master Sculpture',
    chapter_5_sub: 'Strip the ultimate miniature device',

    lvl_1: 'First Plank',
    lvl_2: 'Cross Grain',
    lvl_3: 'Twin Shelf',
    lvl_4: 'The Workbench',
    lvl_5: 'Glass Stack',
    lvl_6: 'Prism Weave',
    lvl_7: 'Rainbow Relay',
    lvl_8: 'Kaleido Panels',
    lvl_9: 'Crystal Loom',
    lvl_10: 'Hinge Test',
    lvl_11: 'Pendulum Row',
    lvl_12: 'Iron Weave',
    lvl_13: 'Truss Bridge',
    lvl_14: 'First Gear',
    lvl_15: 'Neon Mesh',
    lvl_16: 'Gear Train',
    lvl_17: 'Circuit Bloom',
    lvl_18: 'Overdrive',
    lvl_19: 'Grand Mechanism',
    lvl_20: 'Master\'s Crown',
    lvl_21: 'The Final Device',

    color_red: 'Red',
    color_yellow: 'Yellow',
    color_blue: 'Blue',
    color_green: 'Green',
    color_purple: 'Purple',
    color_red_long: 'Blaze Red',
    color_yellow_long: 'Vivid Yellow',
    color_blue_long: 'Turbo Blue',
    color_green_long: 'Jade Green',
    color_purple_long: 'Violet Purple',
  },
};

export function getCurrentLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(SHARED_LANG_KEY);
      if (stored === 'zh' || stored === 'en') return stored;
    }
  } catch (err) {
    // 隐私模式下静默回退系统语言
  }
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
  } catch (err) {
    // 静默降级：仅本次会话生效
  }
  return target;
}

export function t(key, lang = null) {
  const current = lang || getCurrentLanguage();
  const dict = DICTIONARIES[current] || DICTIONARIES.zh;
  return dict[key] !== undefined ? dict[key] : (DICTIONARIES.zh[key] !== undefined ? DICTIONARIES.zh[key] : key);
}

export function htmlLang(lang) {
  return lang === 'en' ? 'en' : 'zh-CN';
}

export const COLOR_KEYS = {
  red: 'color_red',
  yellow: 'color_yellow',
  blue: 'color_blue',
  green: 'color_green',
  purple: 'color_purple',
};

export const COLOR_LONG_KEYS = {
  red: 'color_red_long',
  yellow: 'color_yellow_long',
  blue: 'color_blue_long',
  green: 'color_green_long',
  purple: 'color_purple_long',
};
