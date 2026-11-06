/**
 * Immortal Box (摸鱼开箱修仙传) - Bilingual Translation Center
 * Strictly zero Chinese in strings.en (except langToggle label)
 * Shared preference key: doin.lang
 * In-place live update without page reload.
 */

const STORAGE_LANG_KEY = 'doin.lang';
let memoryLang = null;

export const STRINGS = {
  zh: {
    game_title: '摸鱼开箱修仙传',
    game_subtitle: '无限开鼎爆神装，暗黑词条克制，渡九重天劫飞升！',
    langToggle: 'English',
    back_home: '首页',
    rules_btn: '修真指南',
    tribulation_btn: '渡劫引雷',
    abyss_btn: '试炼天梯',
    cauldron_btn: '鼎炉进阶',
    auto_btn: '智能开鼎',
    auto_stop_btn: '停止开鼎',
    sound_on: '音效: 开',
    sound_off: '音效: 关',
    pause_btn: '静修暂停',
    resume_btn: '继续修仙',

    // HUD / Resources
    spirit_stones: '灵石',
    cauldron_stones: '鼎石',
    combat_power: '战力',
    realm_label: '境界',
    exp_label: '修为',
    cauldron_level: '鼎炉阶位',
    open_box_btn: '叩击开鼎 (消耗1鼎石)',

    // Equipment Actions
    equip_btn: '穿戴替换',
    smelt_btn: '炼化熔铸',
    current_equipped: '当前穿戴',
    new_drop: '新获法宝',
    no_gear_equipped: '暂无装备',
    gear_stats_diff: '属性变动',

    // Slots
    slot_sword: '飞剑',
    slot_robe: '法袍',
    slot_hat: '道冠',
    slot_boots: '法履',
    slot_pendant: '灵佩',
    slot_whisk: '拂尘',
    slot_bag: '乾坤袋',
    slot_mirror: '八卦镜',

    // Stats & Affixes
    stat_hp: '气血',
    stat_atk: '攻击',
    stat_def: '防御',
    stat_spd: '身法',
    affix_crit: '暴击',
    affix_dodge: '闪避',
    affix_counter: '反击',
    affix_combo: '连击',
    affix_stun: '眩晕',
    affix_lifesteal: '吸血',

    // Qualities
    quality_common: '凡品',
    quality_fine: '灵品',
    quality_rare: '宝品',
    quality_epic: '仙品',
    quality_legendary: '神品',
    quality_mythic: '先天至宝',

    // Titles
    title_novice: '炼气期散修',
    title_master: '筑基期真人',
    title_paragon: '金丹期大修士',
    title_patriarch: '元婴期老祖',
    title_sovereign: '化神合体道尊',
    title_immortal: '太虚九天真仙',

    // Tribulation Dialog
    tribulation_title: '九重天劫 · 破境登仙',
    tribulation_desc: '引动九霄玄雷，大战守劫神魔！胜则晋升大境界，败则稳固根基卷土重来。',
    challenge_boss_btn: '引动雷劫',
    combat_victory: '天劫功成！成功破境升仙！',
    combat_defeat: '根基尚浅，未能抗下天雷，请继续开鼎积攒战力！',
    close_modal_btn: '退回洞府',

    // Abyss Trial Dialog
    abyss_title: '无尽试炼天梯',
    abyss_desc: '挑战万古镇压的域外妖仙，验证极致流派构筑！',
    abyss_floor_label: '当前层数',
    abyss_challenge_btn: '挑战守关妖仙',

    // Cauldron Dialog
    cauldron_upgrade_title: '神鼎进阶',
    cauldron_upgrade_cost: '升级所需灵石',
    cauldron_upgrade_action: '淬炼进阶',
    cauldron_max_level: '已达最高先天极品鼎炉',
    cauldron_rate_preview: '极品出世概率预览',

    // Offline Modal
    offline_title: '闭关洞府归来',
    offline_reward_desc: '离线挂机静修，聚灵阵持续运转，收获丰厚灵力！',
    claim_offline_btn: '出关纳宝',

    // Auto Settings Dialog
    auto_modal_title: '智能开鼎设置',
    auto_min_quality_label: '停于品质以上',
    auto_stop_upgrade_label: '遇到更高战力装备自动暂停',
    auto_start_confirm_btn: '开始托管开鼎',

    // Rules Dialog
    rule_cauldron_title: '叩鼎得宝 · 暗黑神装',
    rule_cauldron_desc: '轻点青铜古鼎即可炼化天地灵气，随机爆出飞剑、法袍、道冠等八大法宝，品质横跨凡品、仙品至先天至宝。',
    rule_synergy_title: '六维流派 · 相生相克',
    rule_synergy_desc: '暴击爆发流、御剑极限闪避流、金钟反伤流、雷法连击追击流、定身击晕控制流、幽冥吸血续航流。六大流派相克循环，针对性换装逆袭强敌。',
    rule_tribulation_title: '九重天劫 · 破境飞升',
    rule_tribulation_desc: '修为圆满后引动天劫雷坛，击败守劫神魔突破 21 阶境界，从炼气筑基直抵大乘飞升。',
    offline_spirit_lbl: '灵石',
    offline_cauldron_lbl: '鼎石',

    // Affix Descriptions
    affix_crit_desc: '暴击触发时造成200%巨额伤害。',
    affix_dodge_desc: '完全回避敌方本次攻击伤害。',
    affix_counter_desc: '受击时反弹本次伤害的45%。',
    affix_combo_desc: '攻击时有几率额外追击一次。',
    affix_stun_desc: '命中时令敌方陷入定身昏迷1回合。',
    affix_lifesteal_desc: '造成伤害时回复自身生命值。'
  },
  en: {
    game_title: 'Immortal Box',
    game_subtitle: 'Infinite Cauldron Looting, Hex-Synergy Builds, and Heavenly Ascension!',
    langToggle: '中文',
    back_home: 'Home',
    rules_btn: 'Guide',
    tribulation_btn: 'Tribulation',
    abyss_btn: 'Abyss Trial',
    cauldron_btn: 'Cauldron',
    auto_btn: 'Auto Forge',
    auto_stop_btn: 'Stop Auto',
    sound_on: 'Sound: ON',
    sound_off: 'Sound: OFF',
    pause_btn: 'Meditate',
    resume_btn: 'Resume',

    // HUD / Resources
    spirit_stones: 'Spirit Stones',
    cauldron_stones: 'Cauldron Stones',
    combat_power: 'Combat Power',
    realm_label: 'Realm',
    exp_label: 'EXP',
    cauldron_level: 'Cauldron Tier',
    open_box_btn: 'Tap Cauldron (Cost 1 Stone)',

    // Equipment Actions
    equip_btn: 'Equip Item',
    smelt_btn: 'Smelt for EXP',
    current_equipped: 'Equipped',
    new_drop: 'New Loot',
    no_gear_equipped: 'Empty Slot',
    gear_stats_diff: 'Stat Changes',

    // Slots
    slot_sword: 'Sword',
    slot_robe: 'Robe',
    slot_hat: 'Crown',
    slot_boots: 'Boots',
    slot_pendant: 'Pendant',
    slot_whisk: 'Whisk',
    slot_bag: 'Bag',
    slot_mirror: 'Mirror',

    // Stats & Affixes
    stat_hp: 'Health',
    stat_atk: 'Attack',
    stat_def: 'Defense',
    stat_spd: 'Speed',
    affix_crit: 'Critical',
    affix_dodge: 'Dodge',
    affix_counter: 'Counter',
    affix_combo: 'Combo',
    affix_stun: 'Stun',
    affix_lifesteal: 'Lifesteal',

    // Qualities
    quality_common: 'Common',
    quality_fine: 'Fine',
    quality_rare: 'Rare',
    quality_epic: 'Epic',
    quality_legendary: 'Legendary',
    quality_mythic: 'Mythic',

    // Titles
    title_novice: 'Qi Novice',
    title_master: 'Foundation Master',
    title_paragon: 'Golden Core Paragon',
    title_patriarch: 'Nascent Patriarch',
    title_sovereign: 'Ascendant Sovereign',
    title_immortal: 'Immortal of Heavenly Dao',

    // Tribulation Dialog
    tribulation_title: 'Heavenly Tribulation',
    tribulation_desc: 'Summon nine celestial lightning strikes to face the guardian demon! Victory ascends your realm.',
    challenge_boss_btn: 'Begin Tribulation',
    combat_victory: 'Tribulation passed! Ascended to next realm!',
    combat_defeat: 'Defeated by lightning. Forge better gear and try again!',
    close_modal_btn: 'Return to Sanctuary',

    // Abyss Trial Dialog
    abyss_title: 'Endless Abyss Trial',
    abyss_desc: 'Challenge ancient celestial demons to test extreme build synergies!',
    abyss_floor_label: 'Current Floor',
    abyss_challenge_btn: 'Challenge Demon',

    // Cauldron Dialog
    cauldron_upgrade_title: 'Cauldron Upgrade',
    cauldron_upgrade_cost: 'Required Spirit Stones',
    cauldron_upgrade_action: 'Refine Cauldron',
    cauldron_max_level: 'Max Tier Achieved',
    cauldron_rate_preview: 'Loot Quality Chances',

    // Offline Modal
    offline_title: 'Welcome Back, Cultivator',
    offline_reward_desc: 'Your spirit array gathered spiritual essence during your absence!',
    claim_offline_btn: 'Claim Rewards',

    // Auto Settings Dialog
    auto_modal_title: 'Auto Forge Settings',
    auto_min_quality_label: 'Pause at Quality',
    auto_stop_upgrade_label: 'Pause on Higher Combat Power',
    auto_start_confirm_btn: 'Start Auto Forge',

    // Rules Dialog
    rule_cauldron_title: 'Forge Treasures · Diablo Gear',
    rule_cauldron_desc: 'Tap the bronze cauldron to forge gear across 8 slots and 6 quality tiers.',
    rule_synergy_title: 'Hex-Synergy · Build Counters',
    rule_synergy_desc: 'Critical, Dodge, Counter, Combo, Stun, and Lifesteal form a strategic counter cycle.',
    rule_tribulation_title: 'Nine Tribulations · Ascension',
    rule_tribulation_desc: 'Summon heavenly lightning and defeat guardian demons to break through 21 realms.',
    offline_spirit_lbl: 'Spirit Stones',
    offline_cauldron_lbl: 'Cauldron Stones',

    // Affix Descriptions
    affix_crit_desc: 'Deals 200% critical damage when triggered.',
    affix_dodge_desc: 'Completely avoids incoming attack damage.',
    affix_counter_desc: 'Reflects 45% damage back to attacker.',
    affix_combo_desc: 'Grants chance to launch an extra attack.',
    affix_stun_desc: 'Stuns the target, skipping their next turn.',
    affix_lifesteal_desc: 'Heals caster for a percentage of damage dealt.'
  }
};

export function getCurrentLang() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_LANG_KEY);
      if (saved === 'en' || saved === 'zh') return saved;
    }
  } catch (_e) {}
  if (memoryLang) return memoryLang;
  if (typeof navigator !== 'undefined') {
    const nav = (navigator.language || '').toLowerCase();
    return nav.startsWith('zh') ? 'zh' : 'en';
  }
  return 'zh';
}

export function setCurrentLang(lang) {
  const safeLang = lang === 'en' ? 'en' : 'zh';
  memoryLang = safeLang;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_LANG_KEY, safeLang);
    }
  } catch (_e) {}
  return safeLang;
}

export function t(key, lang = getCurrentLang()) {
  const dict = STRINGS[lang] || STRINGS.zh;
  return dict[key] || STRINGS.zh[key] || key;
}
