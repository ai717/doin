/**
 * @file games/tidy/js/i18n.mjs
 * 中英双语中心，统一读写全站共享偏好 localStorage["doin.lang"]。
 * 严格红线：strings.en 绝无汉字，切语言毫秒级原地热更新，严禁页面重载刷新。
 */

export const SHARED_LANG_KEY = 'doin.lang';

export const DICTIONARIES = {
  zh: {
    langName: '中文',
    title: '沉浸收纳达人',
    tagline: '严丝合缝嵌入几何凹槽，治愈强迫症',
    backHome: '首页',
    pause: '暂停',
    resume: '继续整理',
    restart: '重置此盒',
    levels: '关卡',
    soundOn: '音效: 开',
    soundOff: '音效: 关',
    howToPlay: '玩法说明',
    howToPlayDesc: '【拖拽】拾起生活好物放入收纳盒对应凹槽；【点击/R键/滚轮】旋转物件角度；【透视】微光透视槽位位置。全量归位合盖即通关！',
    
    // 章节主题
    act_stationery: '第一章 · 午后文具袋',
    act_cosmetic: '第二章 · 复古化妆匣',
    act_luggage: '第三章 · 轻装旅行箱',
    act_geek: '第四章 · 极客工作台',
    act_bento: '第五章 · 暖心日式便当',

    // HUD
    chapterBadge: '章节',
    levelBadge: '关卡',
    remainingItems: '待收纳',
    movesCount: '步数',
    timeElapsed: '用时',
    hintBtn: '透视',
    hintTip: '槽位轮廓微光闪烁 3 秒',
    rotateTip: '点击 / 滚轮 / R 键旋转',
    dragTip: '拖拽精准卡入几何凹槽',
    layerLocked: '需先放入底层收纳物！',

    // 拍立得卡片与结算
    levelClearTitle: '整理完成',
    perfectTidy: '✨ PERFECT TIDY',
    polaroidDate: '治愈手作定格',
    clearTime: '通关耗时',
    clearMoves: '操作步数',
    starsEarned: '收获星级',
    nextLevel: '下一盒',
    retryLevel: '再整一次',
    allLevelsCleared: '恭喜！您已完美通关全部 24 个精巧收纳盒！',
    albumTitle: '强迫症治愈相册',
    albumProgress: '收集进度',
    closeBtn: '关闭',

    // 物件名称
    item_pencil: '原木铅笔',
    item_brass_ruler: '黄铜尺',
    item_white_eraser: '白橡皮',
    item_fountain_pen: '墨水钢笔',
    item_sharpener: '削笔器',
    item_paper_clips: '回形针盒',
    item_triangle_ruler: '三角板',
    item_protractor: '半圆量角器',
    item_highlighter_yellow: '黄色荧光笔',
    item_highlighter_green: '绿色荧光笔',
    item_sticky_note: '便签本',
    item_mini_stapler: '迷你订书机',
    item_glue_stick: '固体胶棒',
    item_craft_knife: '美工刀',
    item_tape_dispenser: '胶带座',
    item_binder_clips: '长尾夹组',
    item_compass: '绘图圆规',
    item_color_pen_red: '红色水彩笔',
    item_color_pen_blue: '蓝色水彩笔',
    item_color_pen_green: '绿色水彩笔',
    item_wooden_sharpener: '原木转笔刀',
    item_post_it_flags: '彩色索引贴',

    item_magnetic_lipstick: '磁吸口红',
    item_compact_mirror: '随身圆镜',
    item_mascara_tube: '纤长睫毛膏',
    item_perfume_bottle: '香水方瓶',
    item_lip_gloss_pink: '粉漾唇釉',
    item_lip_gloss_coral: '珊瑚唇釉',
    item_eyeshadow_duo: '双色眼影盘',
    item_blush_brush: '柔焦腮红刷',
    item_eyebrow_pencil: '双头眉笔',
    item_loose_powder: '轻纱散粉盒',
    item_eyelash_curler: '金属睫毛夹',
    item_dropper_serum: '滴管精华瓶',
    item_eye_cream_jar: '保湿眼霜罐',
    item_cotton_pad_box: '化妆棉绒盒',
    item_gold_hair_clip: '复古金发夹',
    item_concealer_stick: '遮瑕膏棒',
    item_eyeshadow_nine: '九色眼影盘',
    item_highlighter_pan: '烘焙高光粉',
    item_powder_puff: '丝绒粉扑',
    item_matte_lipstick_a: '哑光唇膏·红',
    item_matte_lipstick_b: '哑光唇膏·橘',
    item_brow_tweezers: '精细修眉镊',

    item_wool_coat: '羊毛大衣',
    item_vintage_camera: '胶片相机',
    item_leather_passport: '皮革护照夹',
    item_knit_blanket: '针织毛毯',
    item_toiletry_bag: '旅行洗漱包',
    item_sunglasses_case: '太阳镜硬盒',
    item_sun_hat: '宽檐遮阳帽',
    item_folded_shirt: '整洁白衬衫',
    item_denim_jeans: '折叠牛仔裤',
    item_headphone_case: '降噪耳机包',
    item_travel_journal: '牛皮旅行手账',
    item_power_bank: '便携充电宝',
    item_sleeping_pad: '折叠睡垫',
    item_parka_jacket: '防风冲锋衣',
    item_thermos_flask: '保温水壶',
    item_swiss_knife: '多功能军刀',
    item_polaroid_cam: '即影即得拍立得',
    item_hike_goggles: '户外护目镜',

    item_driver_handle: '精密螺丝刀柄',
    item_bits_ph: '十字批头组',
    item_bits_torx: '梅花批头组',
    item_bits_hex: '内六角批头组',
    item_switch_puller: '机械轴拔轴器',
    item_keycap_puller: '钢丝拔键器',
    item_artisan_keycaps: '客制化键帽盒',
    item_lube_brush_pen: '机械轴润滑笔',
    item_soldering_iron: '恒温电烙铁',
    item_solder_wire_spool: '无铅焊锡丝',
    item_esd_tweezers: '防静电弯镊',
    item_multimeter_probe: '万用表测试笔',
    item_usbc_hub: 'Type-C 扩展坞',
    item_portable_nvme: '移动固态硬盘',
    item_card_reader: '多合一读卡器',
    item_braided_cable_a: '红色编织快充线',
    item_braided_cable_b: '绿色编织数据线',
    item_multi_pliers: '折叠多功能钳',
    item_mini_caliper: '微型游标卡尺',
    item_magnetic_tray: '零件磁吸盘',
    item_air_blower: '精密除尘吹气球',
    item_precision_tweezers: '高精密尖头镊',
    item_thermal_paste_tube: '导热硅脂针管',

    item_onigiri_triangle: '三角梅干饭团',
    item_tamagoyaki_a: '厚蛋烧玉子·左',
    item_tamagoyaki_b: '厚蛋烧玉子·右',
    item_octopus_sausage: '章鱼小香肠',
    item_salmon_sushi_a: '三文鱼手握·上',
    item_salmon_sushi_b: '三文鱼手握·下',
    item_tempura_prawn: '黄金天妇罗炸虾',
    item_broccoli_floret: '清脆西兰花',
    item_tamagoyaki_piece: '日式玉子烧',
    item_karaage_chicken_a: '香脆唐扬炸鸡·金',
    item_karaage_chicken_b: '日式唐扬炸鸡·褐',
    item_cherry_tomatoes: '多汁小番茄',
    item_flower_carrot: '胡萝卜雕花',
    item_nori_rice_ball: '海苔包裹饭团',
    item_unagi_eel: '蒲烧鳗鱼排',
    item_steamed_rice_base: '越光白米饭底',
    item_yellow_takuan: '渍黄萝卜条',
    item_rolled_omelet: '金黄蛋卷块',
    item_snow_peas: '翠绿荷兰豆',
    item_unagi_cut: '炙烤鳗鱼块',
    item_tamago_cubes: '玉子烧方块',
    item_ebi_fried_prawn: '脆皮炸大虾',
    item_plum_onigiri: '纪州梅饭团',
    item_octopus_wieners: '双色章鱼肠',
    item_salmon_maki: '三文鱼细卷',
    item_edamame_beans: '盐煮毛豆荚',
    item_matcha_mochi: '宇治抹茶大福',
    item_sweet_tamago: '甜心玉子方',
  },

  en: {
    langName: 'English',
    title: 'Tidy Master',
    tagline: 'Snap life items into snug organizer slots to satisfy your inner perfectionist',
    backHome: 'Home',
    pause: 'Pause',
    resume: 'Resume Tidy',
    restart: 'Reset Box',
    levels: 'Levels',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    howToPlay: 'How to Play',
    howToPlayDesc: '[Drag] items from the tray into matching geometric slots; [Click / R / Wheel] to rotate; [Hint] illuminates slot silhouettes. Pack every item flush to close the lid!',

    // Themes
    act_stationery: 'Act 1 · Stationery Pouch',
    act_cosmetic: 'Act 2 · Cosmetic Casket',
    act_luggage: 'Act 3 · Travel Luggage',
    act_geek: 'Act 4 · Geek Workbench',
    act_bento: 'Act 5 · Cozy Bento',

    // HUD
    chapterBadge: 'Act',
    levelBadge: 'Level',
    remainingItems: 'Remaining',
    movesCount: 'Moves',
    timeElapsed: 'Time',
    hintBtn: 'Hint',
    hintTip: 'Glows matching slot silhouette for 3s',
    rotateTip: 'Click / Wheel / R to rotate',
    dragTip: 'Drag to snap flush into slot',
    layerLocked: 'Must place bottom layer item first!',

    // Polaroid Modal
    levelClearTitle: 'All Tidy!',
    perfectTidy: 'PERFECT TIDY',
    polaroidDate: 'Therapeutic Snapshot',
    clearTime: 'Clear Time',
    clearMoves: 'Total Moves',
    starsEarned: 'Stars',
    nextLevel: 'Next Box',
    retryLevel: 'Tidy Again',
    allLevelsCleared: 'Congratulations! You have perfected all 24 delightful organizer boxes!',
    albumTitle: 'Tidy Polaroid Album',
    albumProgress: 'Collection',
    closeBtn: 'Close',

    // Items
    item_pencil: 'Wooden Pencil',
    item_brass_ruler: 'Brass Ruler',
    item_white_eraser: 'White Eraser',
    item_fountain_pen: 'Fountain Pen',
    item_sharpener: 'Sharpener',
    item_paper_clips: 'Paper Clips Box',
    item_triangle_ruler: 'Set Square',
    item_protractor: 'Protractor',
    item_highlighter_yellow: 'Yellow Highlighter',
    item_highlighter_green: 'Green Highlighter',
    item_sticky_note: 'Sticky Pad',
    item_mini_stapler: 'Mini Stapler',
    item_glue_stick: 'Glue Stick',
    item_craft_knife: 'Craft Knife',
    item_tape_dispenser: 'Tape Dispenser',
    item_binder_clips: 'Binder Clips',
    item_compass: 'Drawing Compass',
    item_color_pen_red: 'Red Color Pen',
    item_color_pen_blue: 'Blue Color Pen',
    item_color_pen_green: 'Green Color Pen',
    item_wooden_sharpener: 'Wood Sharpener',
    item_post_it_flags: 'Index Flags',

    item_magnetic_lipstick: 'Magnetic Lipstick',
    item_compact_mirror: 'Compact Mirror',
    item_mascara_tube: 'Mascara Tube',
    item_perfume_bottle: 'Perfume Bottle',
    item_lip_gloss_pink: 'Pink Lip Gloss',
    item_lip_gloss_coral: 'Coral Lip Gloss',
    item_eyeshadow_duo: 'Eyeshadow Duo',
    item_blush_brush: 'Blush Brush',
    item_eyebrow_pencil: 'Eyebrow Pencil',
    item_loose_powder: 'Loose Powder',
    item_eyelash_curler: 'Eyelash Curler',
    item_dropper_serum: 'Serum Dropper',
    item_eye_cream_jar: 'Eye Cream Jar',
    item_cotton_pad_box: 'Cotton Pad Box',
    item_gold_hair_clip: 'Gold Hair Clip',
    item_concealer_stick: 'Concealer Stick',
    item_eyeshadow_nine: 'Eyeshadow Palette',
    item_highlighter_pan: 'Highlighter Pan',
    item_powder_puff: 'Powder Puff',
    item_matte_lipstick_a: 'Matte Crimson',
    item_matte_lipstick_b: 'Matte Coral',
    item_brow_tweezers: 'Slanted Tweezers',

    item_wool_coat: 'Wool Coat',
    item_vintage_camera: 'Vintage Camera',
    item_leather_passport: 'Leather Passport',
    item_knit_blanket: 'Knit Blanket',
    item_toiletry_bag: 'Toiletry Pouch',
    item_sunglasses_case: 'Hard Shades Case',
    item_sun_hat: 'Wide Sun Hat',
    item_folded_shirt: 'Crisp White Shirt',
    item_denim_jeans: 'Folded Jeans',
    item_headphone_case: 'Headphone Case',
    item_travel_journal: 'Leather Journal',
    item_power_bank: 'Slim Power Bank',
    item_sleeping_pad: 'Folded Mat',
    item_parka_jacket: 'Wind Parka',
    item_thermos_flask: 'Thermos Flask',
    item_swiss_knife: 'Multi-Tool Knife',
    item_polaroid_cam: 'Instant Camera',
    item_hike_goggles: 'Alpine Goggles',

    item_driver_handle: 'Precision Driver',
    item_bits_ph: 'Phillips Bit Set',
    item_bits_torx: 'Torx Bit Set',
    item_bits_hex: 'Hex Bit Set',
    item_switch_puller: 'Switch Puller',
    item_keycap_puller: 'Wire Keycap Puller',
    item_artisan_keycaps: 'Artisan Caps Case',
    item_lube_brush_pen: 'Stem Lube Pen',
    item_soldering_iron: 'Soldering Iron',
    item_solder_wire_spool: 'Lead-Free Solder',
    item_esd_tweezers: 'ESD Curved Tweezers',
    item_multimeter_probe: 'Multimeter Probes',
    item_usbc_hub: 'USB-C Hub',
    item_portable_nvme: 'Portable NVMe SSD',
    item_card_reader: 'Memory Card Reader',
    item_braided_cable_a: 'Red Braided Cable',
    item_braided_cable_b: 'Green Braided Cable',
    item_multi_pliers: 'Folding Multi-Pliers',
    item_mini_caliper: 'Vernier Caliper',
    item_magnetic_tray: 'Magnetic Parts Dish',
    item_air_blower: 'Rubber Dust Blower',
    item_precision_tweezers: 'Micro Tweezers',
    item_thermal_paste_tube: 'Thermal Compound',

    item_onigiri_triangle: 'Umeboshi Onigiri',
    item_tamagoyaki_a: 'Tamagoyaki Slice A',
    item_tamagoyaki_b: 'Tamagoyaki Slice B',
    item_octopus_sausage: 'Octopus Sausage',
    item_salmon_sushi_a: 'Salmon Nigiri Top',
    item_salmon_sushi_b: 'Salmon Nigiri Bottom',
    item_tempura_prawn: 'Crispy Fried Prawn',
    item_broccoli_floret: 'Broccoli Floret',
    item_tamagoyaki_piece: 'Sweet Tamago Cut',
    item_karaage_chicken_a: 'Golden Karaage',
    item_karaage_chicken_b: 'Crispy Karaage',
    item_cherry_tomatoes: 'Cherry Tomatoes',
    item_flower_carrot: 'Carrot Blossom',
    item_nori_rice_ball: 'Nori Rice Ball',
    item_unagi_eel: 'Glazed Unagi Fillet',
    item_steamed_rice_base: 'Steamed Rice Base',
    item_yellow_takuan: 'Pickled Takuan',
    item_rolled_omelet: 'Golden Omelet Cut',
    item_snow_peas: 'Crisp Snow Peas',
    item_unagi_cut: 'Grilled Eel Chunk',
    item_tamago_cubes: 'Egg Omelet Cubes',
    item_ebi_fried_prawn: 'Golden Ebi Fry',
    item_plum_onigiri: 'Pickled Plum Rice',
    item_octopus_wieners: 'Twin Octopus Wieners',
    item_salmon_maki: 'Salmon Maki Roll',
    item_edamame_beans: 'Salted Edamame',
    item_matcha_mochi: 'Matcha Daifuku',
    item_sweet_tamago: 'Custard Tamago Cube',
  },
};

/**
 * 获取当前全局语言（zh/en）
 */
export function getCurrentLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(SHARED_LANG_KEY);
      if (stored === 'zh' || stored === 'en') {
        return stored;
      }
    }
  } catch (err) {
    // 降级系统探测
  }

  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
  return 'zh';
}

/**
 * 设置全局语言并持久化
 */
export function setLanguage(lang) {
  const target = lang === 'en' ? 'en' : 'zh';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SHARED_LANG_KEY, target);
    }
  } catch (err) {
    // 静默降级
  }
  return target;
}

/**
 * 翻译给定键名
 */
export function t(key, lang = null) {
  const current = lang || getCurrentLanguage();
  const dict = DICTIONARIES[current] || DICTIONARIES.zh;
  return dict[key] || DICTIONARIES.zh[key] || key;
}
