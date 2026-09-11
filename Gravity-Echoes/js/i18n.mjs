const LANG_STORAGE_KEY = 'doin.lang';

export const TRANSLATIONS = {
  zh: {
    gameTitle: '重力回响',
    scoreLabel: '分数',
    sectorLabel: '星环层级',
    resonanceLabel: '共振蓄力',
    livesLabel: '探机装甲',
    relicsTitle: '已同调切片:',
    noRelics: '虚空未同调',
    introBadge: '引力物理 · 节拍共振 · 肉鸽构筑',
    gameQuote: '“我们被困在因果的闭环里，直到有一颗球偏离了轨道。”',
    guideGravity: '核心微型奇点扭曲弹道，打破直觉反射角。',
    guideResonance: '用底板中心迎击积攒共振，达到阈值触发音爆贯穿。',
    guideRoguelike: '每破一层星环可获 1 次装甲维修并提取量子被动特质。',
    btnStart: '开启共振',
    highScoreLabel: '历史最高分:',
    draftBadge: '现实坍缩 · 记忆提取',
    draftTitle: '同调记忆切片',
    draftSubtitle: '星环已瓦解并修复 1 点装甲，选择一项量子特质重构法则：',
    pauseTitle: '时空凝固',
    pauseSubtitle: '引力潮汐暂时止息',
    btnResume: '继续航行',
    btnRestart: '重构本局',
    gameOverTitle: '星尘坍陷',
    gameOverDesc: '弹珠滑入无尽事件视界，回声化为叹息。',
    victoryTitle: '奇点超脱',
    victoryDesc: '所有星环皆归于平静，你的回声已永驻宇宙。',
    finalScore: '本局积分',
    sectorsCleared: '击破星环',
    highScore: '历史记录',
    btnPlayAgain: '再启回响',
    touchHint: '滑动移动底板 · 点击任意位置发射',

    // 侧翼仪表标签
    tagSectorMatrix: '星图矩阵',
    panelNavigation: '实时引力雷达',
    labelTide: '引力曲率',
    labelDensity: '核心扰动',
    densityNormal: '稳定',
    densityHigh: '奇点扰动',
    tagTactics: '战术指引',
    tipSweetSpot: '🎯 中心迎击累积 2.5× 音爆共振',
    tipWarp: '🌀 越贴近奇点，引力弹道弯曲越剧烈',
    tipHeal: '🛡️ 每攻破一层星环自动修复 1 点装甲',

    tagResonanceReactor: '能量核心',
    panelOverdrive: '等离子共振堆',
    labelChargeRate: '超频出力',
    labelStatus: '反应堆状态',
    statusStandby: '待机蓄能',
    statusOverdrive: '超载音爆中',
    labelLastHit: '击球精度',
    hitCenter: '完美核心 (Sweet Spot)',
    hitNormal: '普通偏转',
    tagAttunedMatrix: '量子矩阵',
    panelRelicDeck: '已同调切片构筑',

    // 遗物卡片
    relic_quantum_twin_name: '量子双生',
    relic_quantum_twin_desc: '常驻生成一颗纠缠副球，分摊探索压力。',
    relic_singularity_whip_name: '奇点斥力鞭',
    relic_singularity_whip_desc: '底板反弹附带微型冲击波，直接震伤临近砖块。',
    relic_event_horizon_name: '事件视界透镜',
    relic_event_horizon_desc: '音爆超载所需共振值降低 30%，贯穿更频繁。',
    relic_chronos_buffer_name: '时空阻尼带',
    relic_chronos_buffer_desc: '底板宽度提升 22%，容错率显著增强。',
    relic_pulsar_spark_name: '脉冲星火花',
    relic_pulsar_spark_desc: '掠过奇点边缘时自动释放追踪星尘飞弹。',
    relic_graviton_overdrive_name: '引子超频',
    relic_graviton_overdrive_desc: '小球破坏力翻倍，但底板宽度缩减 15%。'
  },
  en: {
    gameTitle: 'Gravity Echoes',
    scoreLabel: 'SCORE',
    sectorLabel: 'SECTOR',
    resonanceLabel: 'RESONANCE',
    livesLabel: 'PROBE INTEGRITY',
    relicsTitle: 'Attuned Relics:',
    noRelics: 'Void (None)',
    introBadge: 'GRAVITATIONAL PHYSICS · RHYTHM · ROGUELIKE',
    gameQuote: '"Trapped in causality, until a single photon strayed from its orbit."',
    guideGravity: 'Core micro-singularities bend trajectories, defying flat angles.',
    guideResonance: 'Hit the paddle sweet-spot to build resonance and pierce through with overdrive.',
    guideRoguelike: 'Clearing each ring repairs 1 armor and unlocks a quantum memory perk.',
    btnStart: 'ENGAGE HARMONY',
    highScoreLabel: 'High Score:',
    draftBadge: 'COLLAPSE · FRAGMENT EXTRACTION',
    draftTitle: 'Attune Memory Slice',
    draftSubtitle: 'The orbital ring is shattered. Hull repaired by 1. Choose a quantum reality trait:',
    pauseTitle: 'CHRONO STASIS',
    pauseSubtitle: 'Gravitational tides temporarily frozen',
    btnResume: 'RESUME',
    btnRestart: 'RECONSTRUCT',
    gameOverTitle: 'STELLAR COLLAPSE',
    gameOverDesc: 'The sphere sinks into the event horizon. Echoes fade away.',
    victoryTitle: 'SINGULARITY TRANSCENDED',
    victoryDesc: 'All planetary rings silenced. Your echoes resonate forever.',
    finalScore: 'Final Score',
    sectorsCleared: 'Cleared Rings',
    highScore: 'Best Record',
    btnPlayAgain: 'ECHO AGAIN',
    touchHint: 'Drag paddle · Tap to launch core',

    tagSectorMatrix: 'SECTOR MATRIX',
    panelNavigation: 'Realtime Gravity Radar',
    labelTide: 'Curvature',
    labelDensity: 'Fluctuation',
    densityNormal: 'STABLE',
    densityHigh: 'WARPING',
    tagTactics: 'TACTICAL CODES',
    tipSweetSpot: '🎯 Center hit grants 2.5× resonance bonus',
    tipWarp: '🌀 Proximity to singularities curves path heavily',
    tipHeal: '🛡️ Clearing each sector repairs 1 armor',

    tagResonanceReactor: 'ENERGY CORE',
    panelOverdrive: 'Plasma Resonator',
    labelChargeRate: 'Output',
    labelStatus: 'Core Status',
    statusStandby: 'STANDBY',
    statusOverdrive: 'OVERDRIVE',
    labelLastHit: 'Last Precision',
    hitCenter: 'SWEET SPOT',
    hitNormal: 'GLANCING',
    tagAttunedMatrix: 'QUANTUM MATRIX',
    panelRelicDeck: 'Attuned Slices Deck',

    relic_quantum_twin_name: 'Quantum Twin',
    relic_quantum_twin_desc: 'Spawns an entangled auxiliary orb permanent support.',
    relic_singularity_whip_name: 'Repulsor Whip',
    relic_singularity_whip_desc: 'Rebounds release shockwaves damaging nearby bricks.',
    relic_event_horizon_name: 'Horizon Lens',
    relic_event_horizon_desc: 'Lowers sonic overdrive threshold by 30%.',
    relic_chronos_buffer_name: 'Chrono Damper',
    relic_chronos_buffer_desc: 'Widens paddle by 22% for superior containment.',
    relic_pulsar_spark_name: 'Pulsar Spark',
    relic_pulsar_spark_desc: 'Slingshotting through singularities fires homing star darts.',
    relic_graviton_overdrive_name: 'Graviton Overdrive',
    relic_graviton_overdrive_desc: 'Doubles ball damage, but shrinks paddle width by 15%.'
  }
};

let currentLang = 'zh';

export function initLanguage() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') {
      currentLang = saved;
    } else {
      const browserLang = (navigator.language || '').toLowerCase();
      currentLang = browserLang.startsWith('zh') ? 'zh' : 'en';
    }
  } catch {
    currentLang = 'zh';
  }
  return currentLang;
}

export function getCurrentLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  if (lang !== 'zh' && lang !== 'en') return currentLang;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // 降级
  }
  return currentLang;
}

export function toggleLanguage() {
  const next = currentLang === 'zh' ? 'en' : 'zh';
  return setLanguage(next);
}

export function t(key) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.zh;
  return dict[key] || TRANSLATIONS.zh[key] || key;
}
