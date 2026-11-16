/**
 * Glyph Craft (字灵拆拆乐) - Bilingual Translation Center
 * Strictly zero Chinese in strings.en (except language toggle label)
 * Shared preference key: doin.lang
 * In-place live update without page refresh.
 */

const STORAGE_LANG_KEY = 'doin.lang';
let memoryLang = null;

export const STRINGS = {
  zh: {
    game_title: '字灵拆拆乐',
    game_subtitle: '东方文字解构与五行物化解谜',
    langToggle: 'English',
    back_home: '首页',
    rules_btn: '玩法',
    levels_btn: '卷轴',
    codex_btn: '字灵秘典',
    sound_on: '音效: 开',
    sound_off: '音效: 关',
    undo_btn: '时光印 (Z)',
    reset_btn: '重置',
    pause_btn: '暂停',
    resume_btn: '继续',
    seal_pass: '通',
    codex_hint_locked: '在关卡中探索合成即可解锁',

    // Status bar & Tray
    chapter_label: '卷目',
    level_label: '关卡',
    steps_label: '运笔步数',
    tray_title: '字灵案台 (拖叠合字 / 双击拆解)',
    slice_hint: '长按划线可切开场景或案台复合字',

    // Chapters
    chap_1_title: '卷一 · 草木初萌',
    chap_2_title: '卷二 · 江河汇流',
    chap_3_title: '卷三 · 日月同辉',
    chap_4_title: '卷四 · 移山辟地',
    chap_5_title: '卷五 · 五行天人',

    // Levels
    lvl_1_name: '枯木挡道',
    lvl_2_name: '双木成林',
    lvl_3_name: '密林深锁',
    lvl_4_name: '薪火相传',
    lvl_5_name: '孤舟待发',
    lvl_6_name: '汇流成淼',
    lvl_7_name: '踏浪成冰',
    lvl_8_name: '雷雨交加',
    lvl_9_name: '焚薪引渠',
    lvl_10_name: '破暗生辉',
    lvl_11_name: '拆月融霜',
    lvl_12_name: '潮起潮落',
    lvl_13_name: '晨曦破雾',
    lvl_14_name: '日月交辉',
    lvl_15_name: '双山险关',
    lvl_16_name: '三石填壑',
    lvl_17_name: '岩开石裂',
    lvl_18_name: '劈山引水',
    lvl_19_name: '金水相生',
    lvl_20_name: '水火既济',
    lvl_21_name: '乾坤挪移',
    lvl_22_name: '天人合一',

    // Obstacles
    obs_wood_barrier: '拦路枯木',
    obs_forest_block: '巨森遮径',
    obs_dry_canal: '干涸水渠',
    obs_deep_ravine: '深谷断路',
    obs_rushing_river: '湍急水流',
    obs_dark_cavern: '幽暗密室',
    obs_thick_frost: '坚冰寒霜',
    obs_mountain_pass: '险峻双峰',
    obs_abyss_pit: '万丈深坑',
    obs_raging_fire: '熊熊烈火',
    obs_iron_gate: '机关铁锁',
    obs_mud_swamp: '泥泞沼泽',

    // Reactions
    react_wood_burned: '烈火生温，枯木焚尽化作青烟消散！',
    react_forest_cleared: '深林尽化，开辟平川坦途！',
    react_canal_flooded: '清泉涌入，小纸舟徐徐浮起渡河！',
    react_bridge_built: '双木成林搭作浮桥，坦途得渡！',
    react_river_frozen: '寒霜凝结急流，化作冰镜如履平地！',
    react_cavern_lit: '日月同辉，驱散幽谷迷雾显露通路！',
    react_frost_melted: '暖阳普照，坚冰消融化作涓涓春水！',
    react_mountains_parted: '双山各退，峡谷自成通幽绝径！',
    react_pit_filled: '千岩落堑，万丈深坑平整如砥！',
    react_fire_extinguished: '甘霖沛降，山火顿息化作细润春泥！',
    react_gate_blasted: '九天雷霆劈落，机关锁崩碎四散！',
    react_field_paved: '阡陌纵横，泥泞沼泽化作平沃良田！',

    // Poems
    poem_1: '薪火初燃，通幽辟径。',
    poem_2: '独木难支，双木成桥。',
    poem_3: '森罗万象，一剖为三。',
    poem_4: '两火相交，其焰熊熊。',
    poem_5: '水到渠成，顺流乘风。',
    poem_6: '百川归海，巨浪翻波。',
    poem_7: '凝水为坚，踏浪如履。',
    poem_8: '风雷激荡，沛雨涤尘。',
    poem_9: '薪尽火传，水木相生。',
    poem_10: '日居月诸，大放光明。',
    poem_11: '曦光初现，积雪消融。',
    poem_12: '潮涨潮落，暗影尽褪。',
    poem_13: '晨星未落，朝霞破晓。',
    poem_14: '乾坤合德，日月争辉。',
    poem_15: '崇山叠嶂，推山开道。',
    poem_16: '众石聚磊，填平断壑。',
    poem_17: '山岩耸峙，分石辟道。',
    poem_18: '移岳决水，万象流通。',
    poem_19: '金润生水，雷破重关。',
    poem_20: '水火相济，五行中和。',
    poem_21: '阴阳挪移，万化归一。',
    poem_22: '大道至简，天人同幽。',

    // Victory Dialog
    won_title: '墨韵通关',
    won_next_btn: '下一卷轴',
    won_restart_btn: '重玩本关',
    won_select_btn: '关卡名录',
    stars_earned: '墨韵星级',
    star_clear: '达意通关',
    star_frugal: '惜字如金 (最优步数)',
    star_egg: '造字通幽 (彩蛋文字)',

    // Codex Dialog
    codex_title: '字灵秘典 (象形源流)',
    codex_empty: '尚未解锁任何生动字灵，通关合成即可收录！',
    close_btn: '合上秘卷',

    // Rules Dialog
    rules_title: '字灵拆拆乐 · 玩赏指南',
    rule_alchemy_title: '东方字灵炼金术',
    rule_alchemy_desc: '将汉字偏旁部首做成实体法宝。拖入场景触发真实物理反应（火烧木、水汇流、明驱暗、出移山）。',
    rule_synth_title: '案台拖叠合字',
    rule_synth_desc: '在下方案台上将两枚相生偏旁拖拽叠合，即可感应熔铸出新汉字（如 木+木=林，日+月=明）。',
    rule_split_title: '双击一划拆字',
    rule_split_desc: '双击复合字，或用鼠标/手指轻划一刀，即可瞬间拆解回原始偏旁，随意自由拼装！',
    rule_undo_title: '时光印全时悔棋',
    rule_undo_desc: '随时按【Z】或点击时光印回溯上一步，无限自由试错。',

    // Rank titles
    rank_apprentice: '墨客学徒',
    rank_scholar: '解字书生',
    rank_master: '象形宗匠',
    rank_sage: '五行天师',
    rank_cangjie: '仓颉真传',

    // Codex Descriptions
    glyph_wood_desc: '象形树木枝桠之姿，遇火可燃，双木成桥。',
    glyph_fire_desc: '象形火焰升腾之态，可燃枯木，暖化冰霜。',
    glyph_water_desc: '象形清泉波纹之态，引水入渠，可浮轻舟。',
    glyph_sun_desc: '象形太阳浑圆核心，散发普照暖芒，消融霜雪。',
    glyph_moon_desc: '象形残月悬空之影，引动潮汐，驱散迷雾。',
    glyph_mountain_desc: '象形三峰连绵之形，厚重如峦，双叠为出。',
    glyph_stone_desc: '象形山石滑落之坚，三石成磊，填塞断坑。',
    glyph_field_desc: '象形阡陌纵横之畴，铺平沼泽，化作通途。',
    glyph_rain_desc: '象形天穹垂雨滴落，倾盆甘霖，涤荡山火。',
    glyph_frost_desc: '象形水气凝结之冰棱，点水成冰。',
    glyph_blade_desc: '象形刀刃锋芒之锐，断木削石。',
    glyph_soil_desc: '象形土堆厚载之基，筑堤垒基。',
    glyph_metal_desc: '象形地底矿金之贵，坚不可摧。',
    glyph_lin_desc: '双木并立成林，化作坚实木桥跨越深堑。',
    glyph_sen_desc: '三木为森，林木参天，可剖分为三木。',
    glyph_yan_desc: '双火叠起烈焰，烈火燎原，除尽荆棘。',
    glyph_miao_desc: '三水汇聚巨浪，漫溢深谷，托起大舟。',
    glyph_ming_desc: '日月相遇大放光明，朗朗乾坤破除幽暗。',
    glyph_chu_desc: '双山叠出开通狭谷，推开万重险隘。',
    glyph_lei_stone_desc: '三石聚积成磊，坚实无方，填平万丈壑谷。',
    glyph_lei_thunder_desc: '雨落田中雷霆迸发，金石锁钥应声而断。',
    glyph_fen_desc: '木遇烈火焦木自焚，瞬息清场。',
    glyph_yan_rock_desc: '山中有石屹立为岩，稳重如磐。',
    glyph_bing_desc: '极寒之冰坚逾铁石，凝流成镜任人通行。'
  },
  en: {
    game_title: 'Glyph Craft',
    game_subtitle: 'Ideogram Alchemy & Five-Element Puzzle',
    langToggle: '中文',
    back_home: 'Home',
    rules_btn: 'Guide',
    levels_btn: 'Scrolls',
    codex_btn: 'Codex',
    sound_on: 'Sound: ON',
    sound_off: 'Sound: OFF',
    undo_btn: 'Undo (Z)',
    reset_btn: 'Reset',
    pause_btn: 'Pause',
    resume_btn: 'Resume',
    seal_pass: 'PASS',
    codex_hint_locked: 'Craft in levels to reveal',

    // Status bar & Tray
    chapter_label: 'Scroll',
    level_label: 'Level',
    steps_label: 'Strokes',
    tray_title: 'Glyph Altar (Drag to craft / Double-click to split)',
    slice_hint: 'Swipe across compounds to split them into basic radicals',

    // Chapters
    chap_1_title: 'Scroll I · Wood & Flame',
    chap_2_title: 'Scroll II · Water & Flow',
    chap_3_title: 'Scroll III · Sun & Moon',
    chap_4_title: 'Scroll IV · Mountain & Stone',
    chap_5_title: 'Scroll V · Five Elements',

    // Levels
    lvl_1_name: 'Withered Wood',
    lvl_2_name: 'Twin Woods',
    lvl_3_name: 'Dense Thicket',
    lvl_4_name: 'Passing Flame',
    lvl_5_name: 'Stranded Boat',
    lvl_6_name: 'Grand Torrent',
    lvl_7_name: 'Frozen Stream',
    lvl_8_name: 'Thunderstorm',
    lvl_9_name: 'Ash & Canal',
    lvl_10_name: 'Dawn of Radiance',
    lvl_11_name: 'Sun Melting Frost',
    lvl_12_name: 'Tidal Rhythm',
    lvl_13_name: 'Morning Light',
    lvl_14_name: 'Solar Eclipse',
    lvl_15_name: 'Twin Peaks Pass',
    lvl_16_name: 'Boulders in Pit',
    lvl_17_name: 'Crags & Cleave',
    lvl_18_name: 'Mountain Canal',
    lvl_19_name: 'Metal to Water',
    lvl_20_name: 'Water & Fire Balance',
    lvl_21_name: 'Cosmic Shifting',
    lvl_22_name: 'Grand Harmony',

    // Obstacles
    obs_wood_barrier: 'Withered Timber',
    obs_forest_block: 'Massive Forest',
    obs_dry_canal: 'Dry Canal',
    obs_deep_ravine: 'Deep Ravine',
    obs_rushing_river: 'Rushing Rapids',
    obs_dark_cavern: 'Dark Cavern',
    obs_thick_frost: 'Thick Frost',
    obs_mountain_pass: 'Mountain Pass',
    obs_abyss_pit: 'Abyssal Pit',
    obs_raging_fire: 'Raging Fire',
    obs_iron_gate: 'Iron Gate Lock',
    obs_mud_swamp: 'Muddy Swamp',

    // Reactions
    react_wood_burned: 'Flame flares up, burning the timber into smoke!',
    react_forest_cleared: 'Dense forest dissolves into clear land!',
    react_canal_flooded: 'Spring waters fill the canal, lifting the boat!',
    react_bridge_built: 'Twin woods form a bridge across the ravine!',
    react_river_frozen: 'Frost freezes the torrent into solid mirror ice!',
    react_cavern_lit: 'Radiance illuminates the cavern and dispels mist!',
    react_frost_melted: 'Warm sunlight melts the frost into clear water!',
    react_mountains_parted: 'Twin peaks part, opening a clear passage!',
    react_pit_filled: 'Boulders tumble in, filling the pit flat!',
    react_fire_extinguished: 'Gentle rain falls, extinguishing the blaze!',
    react_gate_blasted: 'Lightning strikes from above, blasting the gate!',
    react_field_paved: 'Fertile soil transforms the swamp into a path!',

    // Poems
    poem_1: 'A spark of flame clears the path ahead.',
    poem_2: 'Twin timbers unite into an arching bridge.',
    poem_3: 'Dense woods disassembled into pure wood.',
    poem_4: 'Twin flames blaze with fierce radiance.',
    poem_5: 'Waters arrive and the vessel drifts free.',
    poem_6: 'Rivers converge into a boundless sea.',
    poem_7: 'Torrent turns to crystal ice underfoot.',
    poem_8: 'Thunder rumbles as fresh rain washes dust.',
    poem_9: 'Timber burns away while waters nourish earth.',
    poem_10: 'Sun meets moon to bathe the world in light.',
    poem_11: 'Morning rays melt the winter snow.',
    poem_12: 'Tides rise and fall as shadows retreat.',
    poem_13: 'The morning star fades into golden dawn.',
    poem_14: 'Heaven and Earth align in celestial glory.',
    poem_15: 'Towering peaks yield and open the valley.',
    poem_16: 'Triple stones assemble to mend the abyss.',
    poem_17: 'Crags split open to carve a passage.',
    poem_18: 'Mountains parted as rivers guide the way.',
    poem_19: 'Metal yields water; thunder shatters locks.',
    poem_20: 'Fire and water achieve perfect harmony.',
    poem_21: 'Yin and yang cycle back to oneness.',
    poem_22: 'Ultimate simplicity unites heaven and man.',

    // Victory Dialog
    won_title: 'Scroll Completed',
    won_next_btn: 'Next Scroll',
    won_restart_btn: 'Retry Level',
    won_select_btn: 'Scroll Index',
    stars_earned: 'Scroll Rating',
    star_clear: 'Clear Level',
    star_frugal: 'Frugal Strokes (Optimal steps)',
    star_egg: 'Glyph Mastery (Easter Egg unlocked)',

    // Codex Dialog
    codex_title: 'Glyph Codex (Ideogram Origins)',
    codex_empty: 'No glyphs discovered yet. Craft them during levels!',
    close_btn: 'Close Scroll',

    // Rules Dialog
    rules_title: 'Glyph Craft · Player Guide',
    rule_alchemy_title: 'Eastern Glyph Alchemy',
    rule_alchemy_desc: 'Radicals are elemental artifacts. Drag into the stage to trigger physical reactions (burn timber, flood canals, light caves, move mountains).',
    rule_synth_title: 'Craft in Altar',
    rule_synth_desc: 'Drag and stack two compatible radicals on the tray below to forge a new ideogram (e.g. Wood + Wood = Grove, Sun + Moon = Bright).',
    rule_split_title: 'Split & Slice',
    rule_split_desc: 'Double-click any compound glyph, or swipe across it, to crack it back into its basic radicals instantly!',
    rule_undo_title: 'Infinite Undo',
    rule_undo_desc: 'Press [Z] or tap Undo anytime to step backward without penalty.',

    // Rank titles
    rank_apprentice: 'Ink Apprentice',
    rank_scholar: 'Glyph Scholar',
    rank_master: 'Pictogram Master',
    rank_sage: 'Five-Element Sage',
    rank_cangjie: 'Cangjie Reborn',

    // Codex Descriptions
    glyph_wood_desc: 'Pictograph of a growing tree. Flammable and builds bridges.',
    glyph_fire_desc: 'Pictograph of rising flames. Incinerates wood and melts frost.',
    glyph_water_desc: 'Pictograph of flowing ripples. Floods canals and floats boats.',
    glyph_sun_desc: 'Pictograph of the glowing sun. Radiates warmth and dispels ice.',
    glyph_moon_desc: 'Pictograph of the crescent moon. Commands tides and illuminates.',
    glyph_mountain_desc: 'Pictograph of mountain peaks. Heavy earth that opens passes.',
    glyph_stone_desc: 'Pictograph of solid rock. Fills abyssal pits.',
    glyph_field_desc: 'Pictograph of partitioned farmland. Paves muddy ground.',
    glyph_rain_desc: 'Pictograph of raindrops falling from sky. Extinguishes wildfire.',
    glyph_frost_desc: 'Pictograph of freezing ice needles. Freezes water.',
    glyph_blade_desc: 'Pictograph of a sharp knife edge. Cleaves obstacles.',
    glyph_soil_desc: 'Pictograph of fertile mound earth. Foundations.',
    glyph_metal_desc: 'Pictograph of buried precious ore. Resilient and enduring.',
    glyph_lin_desc: 'Twin trees forming a grove. Spans deep ravines.',
    glyph_sen_desc: 'Triple trees of a deep forest. Can be sliced into three woods.',
    glyph_yan_desc: 'Twin flames blazing fiercely. Clears thick brambles.',
    glyph_miao_desc: 'Triple waters forming a great deluge. Floats large vessels.',
    glyph_ming_desc: 'Sun meets moon to create brilliant light.',
    glyph_chu_desc: 'Stacked mountains that step aside to reveal an exit.',
    glyph_lei_stone_desc: 'Triple stones forming massive boulders. Fills deep pits.',
    glyph_lei_thunder_desc: 'Rain falling on fields ignites thunder. Blasts iron locks.',
    glyph_fen_desc: 'Wood engulfed in flame. Rapidly incinerates barriers.',
    glyph_yan_rock_desc: 'Stones resting on mountains form crags. Solid ballast.',
    glyph_bing_desc: 'Glacial ice forming a reflective mirror bridge.'
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
