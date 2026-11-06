/**
 * @file games/airpuck/js/i18n.mjs
 * 中英双语中心，统一读写全站共享偏好 localStorage["doin.lang"]。
 * 严格红线：strings.en 绝无汉字，切语言毫秒级原地热更新，严禁页面重载刷新。
 */

export const SHARED_LANG_KEY = 'doin.lang';

export const DICTIONARIES = {
  zh: {
    langName: '中文',
    title: '双人霓虹气垫球',
    tagline: '极速气垫冰面刚体碰撞，同屏双人对决或大战 22 关电脑球王！',
    backHome: '首页',
    pause: '暂停',
    resume: '继续对决',
    restart: '瞬时重开',
    levels: '关卡',
    modeAi: '单人天梯',
    mode2p: '双人同屏',
    soundOn: '音效: 开',
    soundOff: '音效: 关',
    howToPlay: '玩法说明',
    howToPlayDesc: '【红方P1】WASD 移动，空格突进扣杀；【蓝方P2/AI】方向键移动，Shift/Enter 突进扣杀。在己方半场截击小球轰入对方球门，抢先斩获 5 分获胜！',

    // 章节主题
    act_classic: '第一季 · 经典电玩街机厅',
    act_ice: '第二季 · 极地冰晶赛场',
    act_neon: '第三季 · 赛博霓虹狂欢',
    act_magnetic: '第四季 · 磁暴重力工坊',
    act_void: '第五季 · 虚空巅峰争霸赛',

    // 22 关 AI 对手称号
    rival_apprentice: '电玩学徒 · 凯文',
    rival_bouncer: '反弹达人 · 强尼',
    rival_striker: '突击锋线 · 莱奥',
    rival_sweeper: '门线扫荡者 · 托马斯',
    rival_arcade_boss: '街机霸主 · 洛克',

    rival_glacier: '冰川哨卫 · 诺亚',
    rival_blizzard: '暴雪截击手 · 艾登',
    rival_frostbite: '霜冻之牙 · 维克多',
    rival_ice_king: '极地冰冠王 · 亚瑟',

    rival_neon_glow: '霓虹狂澜 · 菲利克斯',
    rival_pulse_driver: '脉冲引擎 · 扎克',
    rival_laser_blade: '激光刀锋 · 凯特',
    rival_cyber_queen: '赛博女爵 · 薇薇安',

    rival_magneto: '磁力掌控者 · 马修',
    rival_vortex: '引力漩涡 · 达蒙',
    rival_singularity: '重力奇点 · 塞缪尔',
    rival_storm_bringer: '风暴编织者 · 艾琳',
    rival_overlord_flux: '磁暴领主 · 弗拉克斯',

    rival_phantom: '虚空幻影 · 泽罗',
    rival_chronos: '时空先锋 · 克罗诺斯',
    rival_abyss_master: '深渊宰制者 · 涅墨西斯',
    rival_void_god: '终极虚空神皇 · 泰坦',

    // HUD 面板
    p1Name: '红方 P1 (WASD)',
    p2Name: '蓝方 P2 (方向键)',
    aiName: '赛博 AI',
    scoreLabel: '比分',
    speedometer: '球速',
    dashReady: '扣杀就绪',
    dashCooldown: '充能中',
    targetScoreBadge: '抢 5 分制',
    p1DashTip: '空格: 突进重扣',
    p2DashTip: 'Shift: 突进重扣',
    chapterBadge: '联赛篇章',
    levelBadge: '关卡',

    // 结算与胜利
    wonTitle: '金杯夺冠 · 巅峰加冕',
    p1WinTitle: '红方胜利 · 统治全场',
    p2WinTitle: '蓝方胜利 · 统治全场',
    failedTitle: '遗憾惜败 · 棋差一着',
    matchScore: '最终比分',
    matchTime: '比赛用时',
    maxSpeedStat: '最快球速',
    starsEarned: '收获星级',
    nextLevel: '下一关',
    retryMatch: '再战一局',
    allLevelsCleared: '传奇诞生！您已征服全部 22 关单人天梯球王联赛！',
    closeBtn: '关闭',
  },

  en: {
    langName: 'English',
    title: 'Neon Air Hockey',
    tagline: 'Ultra-fast air hockey physics! 2-player local party or 22 single-player ladder stages!',
    backHome: 'Home',
    pause: 'Pause',
    resume: 'Resume Match',
    restart: 'Instant Retry',
    levels: 'Stages',
    modeAi: 'Solo Ladder',
    mode2p: '2-Player Local',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    howToPlay: 'How to Play',
    howToPlayDesc: '[P1 Red] WASD to move, Space to dash smash; [P2 Blue/AI] Arrow keys to move, Shift/Enter to dash smash. Defend your goal and blast the puck to score 5 points first!',

    // Themes
    act_classic: 'Act 1 · Classic Cyber Arcade',
    act_ice: 'Act 2 · Polar Glacial Arena',
    act_neon: 'Act 3 · Cyber Neon Carnival',
    act_magnetic: 'Act 4 · Magnetic Gravity Forge',
    act_void: 'Act 5 · Void Apex Championship',

    // 22 Rival Names
    rival_apprentice: 'Arcade Novice Kevin',
    rival_bouncer: 'Rebounder Johnny',
    rival_striker: 'Striker Leo',
    rival_sweeper: 'Goal Sweeper Thomas',
    rival_arcade_boss: 'Arcade Overlord Rock',

    rival_glacier: 'Glacier Sentinel Noah',
    rival_blizzard: 'Blizzard Interceptor Aiden',
    rival_frostbite: 'Frostbite Victor',
    rival_ice_king: 'Polar Ice King Arthur',

    rival_neon_glow: 'Neon Surge Felix',
    rival_pulse_driver: 'Pulse Driver Zack',
    rival_laser_blade: 'Laser Blade Kate',
    rival_cyber_queen: 'Cyber Empress Vivian',

    rival_magneto: 'Magneto Matthew',
    rival_vortex: 'Vortex Damon',
    rival_singularity: 'Gravity Singularity Samuel',
    rival_storm_bringer: 'Storm Weaver Irene',
    rival_overlord_flux: 'Magnetic Overlord Flux',

    rival_phantom: 'Void Phantom Zero',
    rival_chronos: 'Chronos Pioneer',
    rival_abyss_master: 'Abyss Master Nemesis',
    rival_void_god: 'Supreme Void Titan',

    // HUD
    p1Name: 'Red P1 (WASD)',
    p2Name: 'Blue P2 (Arrows)',
    aiName: 'Cyber AI',
    scoreLabel: 'Score',
    speedometer: 'Speed',
    dashReady: 'Dash Ready',
    dashCooldown: 'Charging',
    targetScoreBadge: 'First to 5',
    p1DashTip: 'Space: Dash Smash',
    p2DashTip: 'Shift: Dash Smash',
    chapterBadge: 'League Act',
    levelBadge: 'Stage',

    // Modals
    wonTitle: 'Victory Champion!',
    p1WinTitle: 'Red P1 Victory!',
    p2WinTitle: 'Blue P2 Victory!',
    failedTitle: 'Defeat! Try Again',
    matchScore: 'Final Score',
    matchTime: 'Match Time',
    maxSpeedStat: 'Max Speed',
    starsEarned: 'Stars',
    nextLevel: 'Next Stage',
    retryMatch: 'Rematch',
    allLevelsCleared: 'Grand Champion! You conquered all 22 solo ladder stages!',
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
