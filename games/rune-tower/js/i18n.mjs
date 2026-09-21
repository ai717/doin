// 全站统一语言管理（严格遵循 doin.lang）

export const STORAGE_KEY = "doin.lang";

export const DICTIONARY = {
  zh: {
    // 游戏元信息
    gameTitle: "符文塔防",
    gameSubtitle: "极简轻肉鸽 · 策略防守",
    backHome: "DOIN 首页",
    toggleAudio: "切换音效",
    toggleLang: "English",

    // 顶部状态与资源
    waveLabel: "波次",
    crystalHp: "圣所水晶耐久",
    mana: "符文法力",
    score: "防守功勋",
    relicsCount: "遗物",

    // 操作台按钮与控制
    startWave: "唤醒魔潮",
    rushWave: "提前引潮 (+法力)",
    speedToggle: "倍速: {spd}x",
    pause: "暂停",
    resume: "继续防守",
    pauseTitle: "防线暂歇",
    pauseSubtitle: "符文流转已静止，可检视战场与战术",
    chapterSelect: "章节选关",
    chaptersTitle: "深渊远征章节",
    chaptersSubtitle: "选择已解锁的章节展开防守（附带初始法力与初始遗物配给）：",
    resumeSavedRun: "继续当前进度",
    savedRunInfo: "第 {w} 波 · 法力 {m} · 遗物 {r} 件",
    startChapterBtn: "以此章出征",
    statusLocked: "未解锁 (需通关前章)",
    statusUnlocked: "可挑战",
    statusCompleted: "已通关",

    // 章节描述
    chapter1Name: "第一章 · 远古林地",
    chapter1Desc: "波次 1-5 · 击退影行者与晶岩傀儡，直面巨石领主泰坦努斯。",
    chapter2Name: "第二章 · 熔岩裂隙",
    chapter2Desc: "波次 6-10 · 灼热熔岩回廊，迎战自爆熔甲虫与霜火双子。",
    chapter3Name: "第三章 · 极寒冻土",
    chapter3Desc: "波次 11-15 · 极度严寒降临，抵御虚空女妖与虚空织行者。",
    chapter4Name: "第四章 · 虚空王座",
    chapter4Desc: "波次 16-20 · 深渊终极浩劫，向湮灭始祖奥布里温发起决战！",

    selectTarget: "点击魔物优先集火",
    clearTarget: "取消集火",
    reroll: "重抽遗物",
    rerollsLeft: "重抽 ({n})",
    freeReroll: "重抽",
    confirmChoice: "融合遗物",

    // 符文四系
    runeArcane: "奥术符文",
    runeFlame: "烈焰符文",
    runeFrost: "冰霜符文",
    runeStorm: "雷霆符文",
    runeArcaneDesc: "高频速射单体穿透光弹，射程远、破单体。",
    runeFlameDesc: "抛射爆裂熔火，造成范围爆炸并附加持续灼烧。",
    runeFrostDesc: "释放极寒减速力场，使范围内魔物大幅迟缓。",
    runeStormDesc: "召唤连环雷弧跳跃，对密集重甲怪群造成连锁打击。",

    // 符文基座操作
    emptyPedestal: "空置符文基座",
    costToBuild: "消耗: {cost} ⬡",
    tierLabel: "{tier} 阶",
    upgrade: "升阶突破",
    upgradeCost: "升阶 ({cost} ⬡)",
    salvage: "分解拆卸",
    salvageRefund: "分解 (+{refund} ⬡)",
    towerStats: "伤害: {dmg} | 射速: {rate}/s | 射程: {range}",
    maxTier: "已达终极形态",
    insufficientMana: "法力储备不足",
    close: "关闭",

    // 斥候预警与魔物
    scoutTitle: "下波斥候预警",
    traitSwarm: "群聚",
    traitHeavy: "重甲",
    traitFlyer: "浮空",
    traitBoom: "自爆",
    traitBoss: "领主",
    monsterCrawler: "暗夜影行者",
    monsterCrawlerDesc: "移速极快、群聚出没，惧怕减速与范围爆破。",
    monsterGolem: "晶岩巨傀",
    monsterGolemDesc: "超重甲厚血，大幅减免物理伤害，雷霆电弧可破防。",
    monsterBanshee: "虚空女妖",
    monsterBansheeDesc: "法抗飘移体，免疫迟缓，需奥术高频点杀。",
    monsterBeetle: "自爆熔甲虫",
    monsterBeetleDesc: "阵亡时引爆并加速周围魔物，务必在入口远程狙杀。",
    monsterBoss1: "巨石领主 · 泰坦努斯",
    monsterBoss1Desc: "第 5 波章节首领，护盾坚厚，周期性召唤岩石卫士。",
    monsterBoss2: "霜火双子 · 幻灵",
    monsterBoss2Desc: "第 10 波章节首领，轮流免疫冰霜与烈焰伤害。",
    monsterBoss3: "虚空织行者",
    monsterBoss3Desc: "第 15 波章节首领，喷吐虚空迷雾干扰锁定。",
    monsterBoss4: "湮灭始祖 · 奥布里温",
    monsterBoss4Desc: "第 20 波终结领主，三段狂暴形态，回廊终极浩劫！",

    // 三选一神龛
    altarTitle: "远古神龛的赐福",
    altarSubtitle: "击退深渊魔潮！选取一枚远古符文遗物注入你的防守矩阵：",
    activeRelics: "已激活流派遗物",
    noRelicsYet: "暂无遗物，击退波次后于神龛获取",

    // 遗物列表
    relic_split_arrow_name: "多重裂变",
    relic_split_arrow_desc: "奥术飞弹在命中时分裂为 2 枚追踪碎屑，造成 50% 伤害。",
    relic_frostbite_name: "极寒碎裂",
    relic_frostbite_desc: "被减速超过 40% 的敌人受到的所有伤害提升 35%。",
    relic_combustion_name: "余烬扩散",
    relic_combustion_desc: "带有灼烧状态的敌人阵亡时产生殉爆，点燃周围目标。",
    relic_superconduct_name: "超导电弧",
    relic_superconduct_desc: "雷霆电弧命中处于灼烧或迟缓的敌人时，额外跳跃 2 次。",
    relic_mana_harvest_name: "法力汲取",
    relic_mana_harvest_desc: "每击败 10 只魔物，立即返还 15 点额外符文法力。",
    relic_piercing_beam_name: "贯穿虚空",
    relic_piercing_beam_desc: "奥术符文获得穿透能力，可直线穿透最多 3 个目标。",
    relic_blazing_core_name: "烈阳核心",
    relic_blazing_core_desc: "烈焰爆炸范围增加 40%，灼烧伤害每秒增加 50%。",
    relic_blizzard_field_name: "绝对零度",
    relic_blizzard_field_desc: "冰霜符文有 20% 概率将敌人彻底冻结 1.2 秒。",
    relic_thunder_burst_name: "雷暴过载",
    relic_thunder_burst_desc: "雷霆符文暴击率提高 25%，暴击时击退敌人一小段距离。",
    relic_crystal_shield_name: "圣所共鸣",
    relic_crystal_shield_desc: "核心水晶恢复 3 点耐久，且每次受到伤害时有 30% 几率格挡。",
    relic_rush_bounty_name: "赏金猎手",
    relic_rush_bounty_desc: "提前唤醒下一波时，获得的早发奖励法力翻倍。",
    relic_focus_lens_name: "聚焦透镜",
    relic_focus_lens_desc: "所有符文塔攻击集火标记的目标时，伤害提升 45%。",
    relic_chain_melt_name: "融甲热浪",
    relic_chain_melt_desc: "烈焰命中被冰冻目标触发碎冰融甲，瞬间造成 200% 破甲伤害。",
    relic_arcane_tempo_name: "奥术节拍",
    relic_arcane_tempo_desc: "全场奥术符文攻速提升 30%。",
    relic_heavy_impact_name: "地脉震荡",
    relic_heavy_impact_desc: "烈焰攻击有 15% 几率短暂晕眩魔物 0.6 秒。",
    relic_static_field_name: "静电磁场",
    relic_static_field_desc: "回廊入口自动附带静电场，进入的所有魔物移速降低 15%。",
    relic_alchemical_rush_name: "炼金充能",
    relic_alchemical_rush_desc: "建造和升阶符文的法力消耗降低 15%。",
    relic_executioner_name: "终结印记",
    relic_executioner_desc: "魔物生命值低于 20% 时直接被奥术斩杀。",
    relic_hyper_charge_name: "神圣超频",
    relic_hyper_charge_desc: "场上所有符文塔攻击力提升 20%，射程增加 15%。",
    relic_stagger_shock_name: "破盾反冲",
    relic_stagger_shock_desc: "首领护盾破裂时触发全屏震荡波，清空普通杂兵并昏迷 3 秒。",

    // 终局与统计
    victoryTitle: "远古防线大捷！",
    victorySubtitle: "你成功击退了全部 20 波深渊魔潮，获封【符文大贤者】",
    defeatTitle: "核心水晶破碎",
    defeatSubtitle: "魔潮突破了防御，深渊吞噬了圣所",
    finalWave: "防守波次: {w} / 20",
    totalKills: "击杀魔物: {k}",
    relicsCollected: "融合遗物: {r}",
    playTime: "防守用时: {t}",
    bestRecord: "最佳纪录: {b} 波",
    restartGame: "重开新局",
    shareBuild: "流派已复制",

    // 快捷键提示
    hotkeyTip: "快捷键: [1-4] 选塔 | [U] 升阶 | [X] 分解 | [Space] 变速 | [P/Esc] 暂停 | [R] 引潮",
    soundOn: "音效: 开",
    soundOff: "音效: 关",
  },
  en: {
    // Game Meta
    gameTitle: "Rune Tower",
    gameSubtitle: "Minimal Roguelite Tower Defense",
    backHome: "DOIN Home",
    toggleAudio: "Toggle Audio",
    toggleLang: "中文",

    // Top Bar & Stats
    waveLabel: "Wave",
    crystalHp: "Sanctum Crystal HP",
    mana: "Mana",
    score: "Score",
    relicsCount: "Relics",

    // Control Buttons
    startWave: "Summon Wave",
    rushWave: "Rush Wave (+Mana)",
    speedToggle: "Speed: {spd}x",
    pause: "Pause",
    resume: "Resume Battle",
    pauseTitle: "Sanctum Paused",
    pauseSubtitle: "Time is frozen. Review your matrix and tactical layout.",
    chapterSelect: "Select Chapter",
    chaptersTitle: "Expedition Chapters",
    chaptersSubtitle: "Choose an unlocked chapter to deploy (with starting mana & relics):",
    resumeSavedRun: "Resume In-Progress Run",
    savedRunInfo: "Wave {w} · Mana {m} · {r} Relics",
    startChapterBtn: "Deploy Chapter",
    statusLocked: "Locked (Clear prev chapter)",
    statusUnlocked: "Ready to Deploy",
    statusCompleted: "Conquered",

    // Chapter Descriptions
    chapter1Name: "Chapter 1 · Ancient Grove",
    chapter1Desc: "Waves 1-5 · Repel Night Crawlers & Golems; face Titanus the Stone Lord.",
    chapter2Name: "Chapter 2 · Magma Chasm",
    chapter2Desc: "Waves 6-10 · Scorching path; face Boom Beetles & Frost-Flame Twin Phantoms.",
    chapter3Name: "Chapter 3 · Frozen Expanse",
    chapter3Desc: "Waves 11-15 · Sub-zero realm; withstand Void Banshees & Void Weaver.",
    chapter4Name: "Chapter 4 · Void Throne",
    chapter4Desc: "Waves 16-20 · Abyssal cataclysm; final showdown with Oblivion Prime!",

    selectTarget: "Click monster to Focus Fire",
    clearTarget: "Cancel Focus",
    reroll: "Reroll Relics",
    rerollsLeft: "Reroll ({n})",
    freeReroll: "Reroll",
    confirmChoice: "Attune Relic",

    // Four Rune Types
    runeArcane: "Arcane Rune",
    runeFlame: "Flame Rune",
    runeFrost: "Frost Rune",
    runeStorm: "Storm Rune",
    runeArcaneDesc: "Rapid-fire piercing bolts. Long range, deadly single-target DPS.",
    runeFlameDesc: "Lobs explosive fireballs. Massive AoE blast with burning DOT.",
    runeFrostDesc: "Generates a frigid aura. Deeply slows down enemy movement.",
    runeStormDesc: "Summons chaining electric arcs, shredding armored swarms.",

    // Pedestal Actions
    emptyPedestal: "Empty Runic Pedestal",
    costToBuild: "Cost: {cost} ⬡",
    tierLabel: "Tier {tier}",
    upgrade: "Ascend Tier",
    upgradeCost: "Ascend ({cost} ⬡)",
    salvage: "Salvage",
    salvageRefund: "Salvage (+{refund} ⬡)",
    towerStats: "DMG: {dmg} | Rate: {rate}/s | Range: {range}",
    maxTier: "Max Tier Reached",
    insufficientMana: "Insufficient Mana",
    close: "Close",

    // Scout & Monsters
    scoutTitle: "Wave Scout Intel",
    traitSwarm: "Swarm",
    traitHeavy: "Armored",
    traitFlyer: "Flying",
    traitBoom: "Volatile",
    traitBoss: "Boss",
    monsterCrawler: "Night Crawler",
    monsterCrawlerDesc: "Extremely fast swarmers. Vulnerable to slow and AoE blast.",
    monsterGolem: "Crystal Golem",
    monsterGolemDesc: "Heavy armor and massive HP. Resists physical; weak to Storm arcs.",
    monsterBanshee: "Void Banshee",
    monsterBansheeDesc: "Ethereal flyer. Immune to slows; requires rapid Arcane fire.",
    monsterBeetle: "Boom Beetle",
    monsterBeetleDesc: "Detonates upon death haste-buffing nearby monsters. Snipe early!",
    monsterBoss1: "Titanus the Stone Lord",
    monsterBoss1Desc: "Wave 5 Boss. Heavily shielded, summons stone sentinels.",
    monsterBoss2: "Frost-Flame Twin Phantoms",
    monsterBoss2Desc: "Wave 10 Boss. Alternates between Frost and Flame immunities.",
    monsterBoss3: "Void Weaver",
    monsterBoss3Desc: "Wave 15 Boss. Emits dark shroud obscuring targeting.",
    monsterBoss4: "Oblivion Prime",
    monsterBoss4Desc: "Wave 20 Supreme Overlord. 3 furious phases, the ultimate test!",

    // Relic Draft
    altarTitle: "Blessing of the Ancient Altar",
    altarSubtitle: "Abyssal wave repelled! Choose a runic relic to weave into your matrix:",
    activeRelics: "Active Synergy Relics",
    noRelicsYet: "No relics yet. Repel waves to attune relics.",

    // Relic List
    relic_split_arrow_name: "Fission Bolts",
    relic_split_arrow_desc: "Arcane bolts split into 2 homing shards on hit for 50% damage.",
    relic_frostbite_name: "Frost Shatter",
    relic_frostbite_desc: "Monsters slowed by >40% take +35% damage from all sources.",
    relic_combustion_name: "Spreading Embers",
    relic_combustion_desc: "Burning monsters explode on death, igniting nearby foes.",
    relic_superconduct_name: "Superconduct Arcs",
    relic_superconduct_desc: "Storm lightning jumps 2 extra times on burning or chilled targets.",
    relic_mana_harvest_name: "Mana Harvest",
    relic_mana_harvest_desc: "Every 10 defeated monsters immediately grants 15 bonus mana.",
    relic_piercing_beam_name: "Void Piercer",
    relic_piercing_beam_desc: "Arcane bolts pierce up to 3 monsters in a straight line.",
    relic_blazing_core_name: "Solar Core",
    relic_blazing_core_desc: "Flame blast radius +40%; burning DOT damage +50%/s.",
    relic_blizzard_field_name: "Absolute Zero",
    relic_blizzard_field_desc: "Frost towers have 20% chance to completely freeze foes for 1.2s.",
    relic_thunder_burst_name: "Thunder Overload",
    relic_thunder_burst_desc: "Storm crit rate +25%. Crits knock monsters slightly backwards.",
    relic_crystal_shield_name: "Sanctum Ward",
    relic_crystal_shield_desc: "Restores 3 Crystal HP; 30% chance to block incoming damage.",
    relic_rush_bounty_name: "Bounty Hunter",
    relic_rush_bounty_desc: "Doubles the bonus mana gained when rushing waves early.",
    relic_focus_lens_name: "Focus Lens",
    relic_focus_lens_desc: "All towers deal +45% damage to the marked focus target.",
    relic_chain_melt_name: "Molten Fracture",
    relic_chain_melt_desc: "Flame on chilled foes causes Meltdown, dealing 200% burst damage.",
    relic_arcane_tempo_name: "Arcane Tempo",
    relic_arcane_tempo_desc: "All Arcane towers gain +30% attack speed.",
    relic_heavy_impact_name: "Seismic Quake",
    relic_heavy_impact_desc: "Flame impacts have a 15% chance to stun monsters for 0.6s.",
    relic_static_field_name: "Static Perimeter",
    relic_static_field_desc: "Corridor entrance is electrified; all monsters move 15% slower.",
    relic_alchemical_rush_name: "Alchemical Rush",
    relic_alchemical_rush_desc: "Mana cost to summon and ascend towers reduced by 15%.",
    relic_executioner_name: "Culling Strike",
    relic_executioner_desc: "Monsters under 20% HP are instantly executed by Arcane bolts.",
    relic_hyper_charge_name: "Divine Overclock",
    relic_hyper_charge_desc: "All towers deal +20% damage with +15% increased range.",
    relic_stagger_shock_name: "Shield Backlash",
    relic_stagger_shock_desc: "Breaking a Boss shield triggers a shockwave wiping swarm minions.",

    // Endgame & Stats
    victoryTitle: "Sanctum Victorious!",
    victorySubtitle: "You repelled all 20 Abyssal waves and earned the title of [Rune Archon]!",
    defeatTitle: "Sanctum Shattered",
    defeatSubtitle: "The abyssal swarm breached your defenses. The sanctum has fallen.",
    finalWave: "Wave Defended: {w} / 20",
    totalKills: "Monsters Slain: {k}",
    relicsCollected: "Relics Weaved: {r}",
    playTime: "Time Defended: {t}",
    bestRecord: "Best Record: Wave {b}",
    restartGame: "Play Again",
    shareBuild: "Build Copied!",

    // Hotkey Info
    hotkeyTip: "Hotkeys: [1-4] Tower | [U] Ascend | [X] Salvage | [Space] Speed | [P/Esc] Pause | [R] Rush",
    soundOn: "Audio: ON",
    soundOff: "Audio: OFF",
  },
};

export function getLanguage() {
  try {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // 静默降级
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  }
  return "zh";
}

export function setLanguage(lang) {
  const valid = lang === "en" ? "en" : "zh";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, valid);
    }
  } catch {
    // 静默降级
  }
  return valid;
}

export function t(key, lang = getLanguage(), vars = {}) {
  const dict = DICTIONARY[lang] || DICTIONARY.zh;
  let text = dict[key] || DICTIONARY.zh[key] || key;
  for (const [k, val] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(val));
  }
  return text;
}
