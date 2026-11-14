/**
 * @file games/tidy/js/levels.mjs
 * 24 关五大生活流主题篇章数据（5/5/4/5/5 梯度结构）。
 * 严格遵循 DOM-Free 与零硬编码中文字符串契约（全语言由 i18n 键化）。
 */

export const ACT_THEMES = [
  { id: 1, key: 'act_stationery', boxTheme: 'wood', targetSeconds: 45 },
  { id: 2, key: 'act_cosmetic', boxTheme: 'cosmetic', targetSeconds: 50 },
  { id: 3, key: 'act_luggage', boxTheme: 'luggage', targetSeconds: 65 },
  { id: 4, key: 'act_geek', boxTheme: 'tech', targetSeconds: 55 },
  { id: 5, key: 'act_bento', boxTheme: 'bento', targetSeconds: 50 },
];

export const LEVELS = [
  // ==========================================
  // ACT 1: 午后文具袋 (Stationery Pouch - 5 Levels)
  // ==========================================
  {
    id: 1,
    act: 1,
    key: 'level_1',
    boxTheme: 'wood',
    targetSeconds: 30,
    slots: [
      { id: 's1', itemId: 'pencil', x: 80, y: 160, width: 26, height: 220, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'brass_ruler', x: 150, y: 160, width: 34, height: 220, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's3', itemId: 'white_eraser', x: 230, y: 160, width: 60, height: 90, rotation: 0, shape: 'rect', symmetry: 2 },
    ],
    items: [
      { id: 'pencil', slotId: 's1', nameKey: 'item_pencil', material: 'wood', shape: 'pill', width: 26, height: 220, color: '#f5b041', accentColor: '#34495e', symmetry: 1, initialRotation: 90, iconType: 'pencil' },
      { id: 'brass_ruler', slotId: 's2', nameKey: 'item_brass_ruler', material: 'metal', shape: 'rect', width: 34, height: 220, color: '#d4ac0d', accentColor: '#7d6608', symmetry: 2, initialRotation: 180, iconType: 'ruler' },
      { id: 'white_eraser', slotId: 's3', nameKey: 'item_white_eraser', material: 'wood', shape: 'rect', width: 60, height: 90, color: '#fdfefe', accentColor: '#5dade2', symmetry: 2, initialRotation: 90, iconType: 'eraser' },
    ],
  },
  {
    id: 2,
    act: 1,
    key: 'level_2',
    boxTheme: 'wood',
    targetSeconds: 40,
    slots: [
      { id: 's1', itemId: 'pencil', x: 70, y: 160, width: 24, height: 220, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'fountain_pen', x: 130, y: 160, width: 30, height: 200, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's3', itemId: 'sharpener', x: 210, y: 110, width: 60, height: 70, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's4', itemId: 'paper_clips', x: 210, y: 220, width: 64, height: 80, rotation: 0, shape: 'rect', symmetry: 2 },
    ],
    items: [
      { id: 'pencil', slotId: 's1', nameKey: 'item_pencil', material: 'wood', shape: 'pill', width: 24, height: 220, color: '#eb984e', accentColor: '#2c3e50', symmetry: 1, initialRotation: 270, iconType: 'pencil' },
      { id: 'fountain_pen', slotId: 's2', nameKey: 'item_fountain_pen', material: 'metal', shape: 'pill', width: 30, height: 200, color: '#1f618d', accentColor: '#f4d03f', symmetry: 1, initialRotation: 90, iconType: 'pen' },
      { id: 'sharpener', slotId: 's3', nameKey: 'item_sharpener', material: 'metal', shape: 'rect', width: 60, height: 70, color: '#d35400', accentColor: '#bdc3c7', symmetry: 1, initialRotation: 180, iconType: 'sharpener' },
      { id: 'paper_clips', slotId: 's4', nameKey: 'item_paper_clips', material: 'metal', shape: 'rect', width: 64, height: 80, color: '#52be80', accentColor: '#1e8449', symmetry: 2, initialRotation: 90, iconType: 'clip_box' },
    ],
  },
  {
    id: 3,
    act: 1,
    key: 'level_3',
    boxTheme: 'wood',
    targetSeconds: 45,
    slots: [
      { id: 's1', itemId: 'triangle_ruler', x: 100, y: 120, width: 140, height: 110, rotation: 0, shape: 'triangle', symmetry: 1 },
      { id: 's2', itemId: 'protractor', x: 230, y: 120, width: 110, height: 90, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's3', itemId: 'highlighter_yellow', x: 80, y: 240, width: 36, height: 120, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's4', itemId: 'highlighter_green', x: 140, y: 240, width: 36, height: 120, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's5', itemId: 'sticky_note', x: 230, y: 240, width: 80, height: 80, rotation: 0, shape: 'rect', symmetry: 4 },
    ],
    items: [
      { id: 'triangle_ruler', slotId: 's1', nameKey: 'item_triangle_ruler', material: 'plastic', shape: 'triangle', width: 140, height: 110, color: '#85c1e9', accentColor: '#2874a6', symmetry: 1, initialRotation: 90, iconType: 'triangle' },
      { id: 'protractor', slotId: 's2', nameKey: 'item_protractor', material: 'plastic', shape: 'pill', width: 110, height: 90, color: '#a3e4d7', accentColor: '#16a085', symmetry: 1, initialRotation: 180, iconType: 'protractor' },
      { id: 'highlighter_yellow', slotId: 's3', nameKey: 'item_highlighter_yellow', material: 'plastic', shape: 'rect', width: 36, height: 120, color: '#f7dc6f', accentColor: '#f39c12', symmetry: 1, initialRotation: 270, iconType: 'highlighter' },
      { id: 'highlighter_green', slotId: 's4', nameKey: 'item_highlighter_green', material: 'plastic', shape: 'rect', width: 36, height: 120, color: '#82e0aa', accentColor: '#27ae60', symmetry: 1, initialRotation: 90, iconType: 'highlighter' },
      { id: 'sticky_note', slotId: 's5', nameKey: 'item_sticky_note', material: 'wood', shape: 'rect', width: 80, height: 80, color: '#f9e79f', accentColor: '#f1c40f', symmetry: 4, initialRotation: 0, iconType: 'sticky' },
    ],
  },
  {
    id: 4,
    act: 1,
    key: 'level_4',
    boxTheme: 'wood',
    targetSeconds: 50,
    slots: [
      { id: 's1', itemId: 'mini_stapler', x: 80, y: 100, width: 60, height: 120, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's2', itemId: 'glue_stick', x: 160, y: 100, width: 34, height: 110, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's3', itemId: 'craft_knife', x: 230, y: 100, width: 30, height: 120, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's4', itemId: 'tape_dispenser', x: 90, y: 230, width: 90, height: 90, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's5', itemId: 'binder_clips', x: 200, y: 230, width: 80, height: 70, rotation: 0, shape: 'rect', symmetry: 2 },
    ],
    items: [
      { id: 'mini_stapler', slotId: 's1', nameKey: 'item_mini_stapler', material: 'metal', shape: 'rect', width: 60, height: 120, color: '#e74c3c', accentColor: '#922b21', symmetry: 1, initialRotation: 90, iconType: 'stapler' },
      { id: 'glue_stick', slotId: 's2', nameKey: 'item_glue_stick', material: 'plastic', shape: 'pill', width: 34, height: 110, color: '#3498db', accentColor: '#1b4f72', symmetry: 1, initialRotation: 180, iconType: 'glue' },
      { id: 'craft_knife', slotId: 's3', nameKey: 'item_craft_knife', material: 'metal', shape: 'rect', width: 30, height: 120, color: '#f39c12', accentColor: '#7f8c8d', symmetry: 1, initialRotation: 270, iconType: 'knife' },
      { id: 'tape_dispenser', slotId: 's4', nameKey: 'item_tape_dispenser', material: 'plastic', shape: 'rect', width: 90, height: 90, color: '#48c9b0', accentColor: '#117864', symmetry: 1, initialRotation: 90, iconType: 'tape' },
      { id: 'binder_clips', slotId: 's5', nameKey: 'item_binder_clips', material: 'metal', shape: 'rect', width: 80, height: 70, color: '#2c3e50', accentColor: '#f1c40f', symmetry: 2, initialRotation: 180, iconType: 'clip_box' },
    ],
  },
  {
    id: 5,
    act: 1,
    key: 'level_5',
    boxTheme: 'wood',
    targetSeconds: 55,
    slots: [
      { id: 's1', itemId: 'compass', x: 80, y: 100, width: 60, height: 140, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'color_pen_red', x: 150, y: 100, width: 22, height: 130, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's3', itemId: 'color_pen_blue', x: 180, y: 100, width: 22, height: 130, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's4', itemId: 'color_pen_green', x: 210, y: 100, width: 22, height: 130, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's5', itemId: 'wooden_sharpener', x: 80, y: 225, width: 64, height: 64, rotation: 0, shape: 'rect', symmetry: 4 },
      { id: 's6', itemId: 'post_it_flags', x: 180, y: 225, width: 100, height: 60, rotation: 0, shape: 'rect', symmetry: 2 },
    ],
    items: [
      { id: 'compass', slotId: 's1', nameKey: 'item_compass', material: 'metal', shape: 'pill', width: 60, height: 140, color: '#95a5a6', accentColor: '#e74c3c', symmetry: 1, initialRotation: 90, iconType: 'compass' },
      { id: 'color_pen_red', slotId: 's2', nameKey: 'item_color_pen_red', material: 'plastic', shape: 'pill', width: 22, height: 130, color: '#e74c3c', accentColor: '#c0392b', symmetry: 1, initialRotation: 180, iconType: 'pen' },
      { id: 'color_pen_blue', slotId: 's3', nameKey: 'item_color_pen_blue', material: 'plastic', shape: 'pill', width: 22, height: 130, color: '#3498db', accentColor: '#2980b9', symmetry: 1, initialRotation: 270, iconType: 'pen' },
      { id: 'color_pen_green', slotId: 's4', nameKey: 'item_color_pen_green', material: 'plastic', shape: 'pill', width: 22, height: 130, color: '#2ecc71', accentColor: '#27ae60', symmetry: 1, initialRotation: 90, iconType: 'pen' },
      { id: 'wooden_sharpener', slotId: 's5', nameKey: 'item_wooden_sharpener', material: 'wood', shape: 'rect', width: 64, height: 64, color: '#d35400', accentColor: '#ba4a00', symmetry: 4, initialRotation: 0, iconType: 'sharpener' },
      { id: 'post_it_flags', slotId: 's6', nameKey: 'item_post_it_flags', material: 'plastic', shape: 'rect', width: 100, height: 60, color: '#f39c12', accentColor: '#9b59b6', symmetry: 2, initialRotation: 90, iconType: 'flags' },
    ],
  },

  // ==========================================
  // ACT 2: 复古化妆匣 (Cosmetic Casket - 5 Levels)
  // ==========================================
  {
    id: 6,
    act: 2,
    key: 'level_6',
    boxTheme: 'cosmetic',
    targetSeconds: 40,
    slots: [
      { id: 's1', itemId: 'magnetic_lipstick', x: 80, y: 150, width: 34, height: 110, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'compact_mirror', x: 170, y: 150, width: 90, height: 90, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's3', itemId: 'mascara_tube', x: 250, y: 150, width: 28, height: 150, rotation: 0, shape: 'pill', symmetry: 1 },
    ],
    items: [
      { id: 'magnetic_lipstick', slotId: 's1', nameKey: 'item_magnetic_lipstick', material: 'plastic', shape: 'pill', width: 34, height: 110, color: '#c0392b', accentColor: '#f1c40f', symmetry: 1, initialRotation: 90, iconType: 'lipstick' },
      { id: 'compact_mirror', slotId: 's2', nameKey: 'item_compact_mirror', material: 'plastic', shape: 'circle', width: 90, height: 90, color: '#f5cba7', accentColor: '#fdfefe', symmetry: 4, initialRotation: 0, iconType: 'mirror' },
      { id: 'mascara_tube', slotId: 's3', nameKey: 'item_mascara_tube', material: 'plastic', shape: 'pill', width: 28, height: 150, color: '#2c3e50', accentColor: '#d4ac0d', symmetry: 1, initialRotation: 180, iconType: 'mascara' },
    ],
  },
  {
    id: 7,
    act: 2,
    key: 'level_7',
    boxTheme: 'cosmetic',
    targetSeconds: 45,
    slots: [
      { id: 's1', itemId: 'perfume_bottle', x: 80, y: 120, width: 70, height: 100, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's2', itemId: 'lip_gloss_pink', x: 160, y: 120, width: 26, height: 120, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's3', itemId: 'lip_gloss_coral', x: 200, y: 120, width: 26, height: 120, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's4', itemId: 'eyeshadow_duo', x: 140, y: 230, width: 110, height: 60, rotation: 0, shape: 'rect', symmetry: 2 },
    ],
    items: [
      { id: 'perfume_bottle', slotId: 's1', nameKey: 'item_perfume_bottle', material: 'plastic', shape: 'rect', width: 70, height: 100, color: '#bb8fce', accentColor: '#f4d03f', symmetry: 1, initialRotation: 270, iconType: 'perfume' },
      { id: 'lip_gloss_pink', slotId: 's2', nameKey: 'item_lip_gloss_pink', material: 'plastic', shape: 'pill', width: 26, height: 120, color: '#f1948a', accentColor: '#fadbd8', symmetry: 1, initialRotation: 90, iconType: 'lipgloss' },
      { id: 'lip_gloss_coral', slotId: 's3', nameKey: 'item_lip_gloss_coral', material: 'plastic', shape: 'pill', width: 26, height: 120, color: '#e59866', accentColor: '#fdebd0', symmetry: 1, initialRotation: 180, iconType: 'lipgloss' },
      { id: 'eyeshadow_duo', slotId: 's4', nameKey: 'item_eyeshadow_duo', material: 'plastic', shape: 'rect', width: 110, height: 60, color: '#a569bd', accentColor: '#d2b4de', symmetry: 2, initialRotation: 90, iconType: 'eyeshadow' },
    ],
  },
  {
    id: 8,
    act: 2,
    key: 'level_8',
    boxTheme: 'cosmetic',
    targetSeconds: 50,
    slots: [
      { id: 's1', itemId: 'blush_brush', x: 70, y: 160, width: 34, height: 180, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'eyebrow_pencil', x: 120, y: 160, width: 22, height: 190, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's3', itemId: 'loose_powder', x: 210, y: 110, width: 90, height: 90, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's4', itemId: 'eyelash_curler', x: 210, y: 230, width: 80, height: 90, rotation: 0, shape: 'rect', symmetry: 1 },
    ],
    items: [
      { id: 'blush_brush', slotId: 's1', nameKey: 'item_blush_brush', material: 'wood', shape: 'pill', width: 34, height: 180, color: '#f5b7b1', accentColor: '#784212', symmetry: 1, initialRotation: 180, iconType: 'brush' },
      { id: 'eyebrow_pencil', slotId: 's2', nameKey: 'item_eyebrow_pencil', material: 'wood', shape: 'pill', width: 22, height: 190, color: '#5d6d7e', accentColor: '#2e4053', symmetry: 1, initialRotation: 90, iconType: 'pencil' },
      { id: 'loose_powder', slotId: 's3', nameKey: 'item_loose_powder', material: 'plastic', shape: 'circle', width: 90, height: 90, color: '#f9e79f', accentColor: '#f5cba7', symmetry: 4, initialRotation: 0, iconType: 'powder' },
      { id: 'eyelash_curler', slotId: 's4', nameKey: 'item_eyelash_curler', material: 'metal', shape: 'rect', width: 80, height: 90, color: '#bdc3c7', accentColor: '#e74c3c', symmetry: 1, initialRotation: 90, iconType: 'curler' },
    ],
  },
  {
    id: 9,
    act: 2,
    key: 'level_9',
    boxTheme: 'cosmetic',
    targetSeconds: 50,
    slots: [
      { id: 's1', itemId: 'dropper_serum', x: 70, y: 110, width: 44, height: 100, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'eye_cream_jar', x: 140, y: 110, width: 64, height: 64, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's3', itemId: 'cotton_pad_box', x: 230, y: 110, width: 80, height: 80, rotation: 0, shape: 'rect', symmetry: 4 },
      { id: 's4', itemId: 'gold_hair_clip', x: 90, y: 220, width: 80, height: 32, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's5', itemId: 'concealer_stick', x: 190, y: 220, width: 28, height: 120, rotation: 0, shape: 'pill', symmetry: 1 },
    ],
    items: [
      { id: 'dropper_serum', slotId: 's1', nameKey: 'item_dropper_serum', material: 'plastic', shape: 'pill', width: 44, height: 100, color: '#76d7c4', accentColor: '#117864', symmetry: 1, initialRotation: 90, iconType: 'dropper' },
      { id: 'eye_cream_jar', slotId: 's2', nameKey: 'item_eye_cream_jar', material: 'plastic', shape: 'circle', width: 64, height: 64, color: '#f5cba7', accentColor: '#d4ac0d', symmetry: 4, initialRotation: 0, iconType: 'jar' },
      { id: 'cotton_pad_box', slotId: 's3', nameKey: 'item_cotton_pad_box', material: 'fabric', shape: 'rect', width: 80, height: 80, color: '#fdfefe', accentColor: '#aed6f1', symmetry: 4, initialRotation: 0, iconType: 'box' },
      { id: 'gold_hair_clip', slotId: 's4', nameKey: 'item_gold_hair_clip', material: 'metal', shape: 'rect', width: 80, height: 32, color: '#f4d03f', accentColor: '#b7950b', symmetry: 2, initialRotation: 90, iconType: 'clip' },
      { id: 'concealer_stick', slotId: 's5', nameKey: 'item_concealer_stick', material: 'plastic', shape: 'pill', width: 28, height: 120, color: '#f5b041', accentColor: '#dc7633', symmetry: 1, initialRotation: 180, iconType: 'lipstick' },
    ],
  },
  {
    id: 10,
    act: 2,
    key: 'level_10',
    boxTheme: 'cosmetic',
    targetSeconds: 60,
    slots: [
      { id: 's1', itemId: 'eyeshadow_nine', x: 100, y: 100, width: 120, height: 100, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's2', itemId: 'highlighter_pan', x: 210, y: 100, width: 70, height: 70, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's3', itemId: 'powder_puff', x: 210, y: 180, width: 70, height: 50, rotation: 0, shape: 'pill', symmetry: 2 },
      { id: 's4', itemId: 'matte_lipstick_a', x: 70, y: 220, width: 26, height: 100, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's5', itemId: 'matte_lipstick_b', x: 110, y: 220, width: 26, height: 100, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's6', itemId: 'brow_tweezers', x: 160, y: 220, width: 22, height: 90, rotation: 0, shape: 'pill', symmetry: 1 },
    ],
    items: [
      { id: 'eyeshadow_nine', slotId: 's1', nameKey: 'item_eyeshadow_nine', material: 'plastic', shape: 'rect', width: 120, height: 100, color: '#af7ac5', accentColor: '#6c3483', symmetry: 2, initialRotation: 90, iconType: 'eyeshadow' },
      { id: 'highlighter_pan', slotId: 's2', nameKey: 'item_highlighter_pan', material: 'plastic', shape: 'circle', width: 70, height: 70, color: '#f9e79f', accentColor: '#f39c12', symmetry: 4, initialRotation: 0, iconType: 'powder' },
      { id: 'powder_puff', slotId: 's3', nameKey: 'item_powder_puff', material: 'fabric', shape: 'pill', width: 70, height: 50, color: '#fadbd8', accentColor: '#f1948a', symmetry: 2, initialRotation: 90, iconType: 'puff' },
      { id: 'matte_lipstick_a', slotId: 's4', nameKey: 'item_matte_lipstick_a', material: 'plastic', shape: 'pill', width: 26, height: 100, color: '#922b21', accentColor: '#f4d03f', symmetry: 1, initialRotation: 180, iconType: 'lipstick' },
      { id: 'matte_lipstick_b', slotId: 's5', nameKey: 'item_matte_lipstick_b', material: 'plastic', shape: 'pill', width: 26, height: 100, color: '#b03a2e', accentColor: '#f4d03f', symmetry: 1, initialRotation: 270, iconType: 'lipstick' },
      { id: 'brow_tweezers', slotId: 's6', nameKey: 'item_brow_tweezers', material: 'metal', shape: 'pill', width: 22, height: 90, color: '#d5dbdb', accentColor: '#7f8c8d', symmetry: 1, initialRotation: 90, iconType: 'tweezers' },
    ],
  },

  // ==========================================
  // ACT 3: 轻装旅行箱 (Travel Luggage - 4 Levels - Z-Layer Occlusion)
  // ==========================================
  {
    id: 11,
    act: 3,
    key: 'level_11',
    boxTheme: 'luggage',
    targetSeconds: 50,
    slots: [
      // 底层：羊毛大衣 (Base Layer 0)
      { id: 's1', itemId: 'wool_coat', x: 150, y: 150, width: 240, height: 220, rotation: 0, shape: 'rect', symmetry: 2, layer: 0 },
      // 顶层：相机与护照夹 (Top Layer 1, 依赖 s1 已放入)
      { id: 's2', itemId: 'vintage_camera', x: 100, y: 140, width: 110, height: 90, rotation: 0, shape: 'rect', symmetry: 1, layer: 1, requires: ['s1'] },
      { id: 's3', itemId: 'leather_passport', x: 210, y: 140, width: 80, height: 110, rotation: 0, shape: 'rect', symmetry: 1, layer: 1, requires: ['s1'] },
    ],
    items: [
      { id: 'wool_coat', slotId: 's1', nameKey: 'item_wool_coat', material: 'fabric', shape: 'rect', width: 240, height: 220, color: '#a0856c', accentColor: '#6e5642', symmetry: 2, initialRotation: 90, iconType: 'coat' },
      { id: 'vintage_camera', slotId: 's2', nameKey: 'item_vintage_camera', material: 'metal', shape: 'rect', width: 110, height: 90, color: '#34495e', accentColor: '#bdc3c7', symmetry: 1, initialRotation: 180, iconType: 'camera' },
      { id: 'leather_passport', slotId: 's3', nameKey: 'item_leather_passport', material: 'fabric', shape: 'rect', width: 80, height: 110, color: '#641e16', accentColor: '#f1c40f', symmetry: 1, initialRotation: 270, iconType: 'passport' },
    ],
  },
  {
    id: 12,
    act: 3,
    key: 'level_12',
    boxTheme: 'luggage',
    targetSeconds: 55,
    slots: [
      { id: 's1', itemId: 'knit_blanket', x: 150, y: 150, width: 250, height: 230, rotation: 0, shape: 'rect', symmetry: 2, layer: 0 },
      { id: 's2', itemId: 'toiletry_bag', x: 90, y: 110, width: 110, height: 80, rotation: 0, shape: 'rect', symmetry: 1, layer: 1, requires: ['s1'] },
      { id: 's3', itemId: 'sunglasses_case', x: 205, y: 110, width: 90, height: 60, rotation: 0, shape: 'pill', symmetry: 2, layer: 1, requires: ['s1'] },
      { id: 's4', itemId: 'sun_hat', x: 150, y: 205, width: 120, height: 80, rotation: 0, shape: 'pill', symmetry: 1, layer: 1, requires: ['s1'] },
    ],
    items: [
      { id: 'knit_blanket', slotId: 's1', nameKey: 'item_knit_blanket', material: 'fabric', shape: 'rect', width: 250, height: 230, color: '#7fb3d5', accentColor: '#2471a3', symmetry: 2, initialRotation: 90, iconType: 'blanket' },
      { id: 'toiletry_bag', slotId: 's2', nameKey: 'item_toiletry_bag', material: 'fabric', shape: 'rect', width: 110, height: 80, color: '#16a085', accentColor: '#a3e4d7', symmetry: 1, initialRotation: 180, iconType: 'toiletry' },
      { id: 'sunglasses_case', slotId: 's3', nameKey: 'item_sunglasses_case', material: 'plastic', shape: 'pill', width: 90, height: 60, color: '#2c3e50', accentColor: '#e74c3c', symmetry: 2, initialRotation: 90, iconType: 'glasses' },
      { id: 'sun_hat', slotId: 's4', nameKey: 'item_sun_hat', material: 'fabric', shape: 'pill', width: 120, height: 80, color: '#f9e79f', accentColor: '#b7950b', symmetry: 1, initialRotation: 270, iconType: 'hat' },
    ],
  },
  {
    id: 13,
    act: 3,
    key: 'level_13',
    boxTheme: 'luggage',
    targetSeconds: 65,
    slots: [
      { id: 's1', itemId: 'folded_shirt', x: 90, y: 150, width: 120, height: 220, rotation: 0, shape: 'rect', symmetry: 2, layer: 0 },
      { id: 's2', itemId: 'denim_jeans', x: 210, y: 150, width: 100, height: 220, rotation: 0, shape: 'rect', symmetry: 2, layer: 0 },
      { id: 's3', itemId: 'headphone_case', x: 90, y: 100, width: 90, height: 90, rotation: 0, shape: 'circle', symmetry: 4, layer: 1, requires: ['s1'] },
      { id: 's4', itemId: 'travel_journal', x: 90, y: 200, width: 80, height: 80, rotation: 0, shape: 'rect', symmetry: 4, layer: 1, requires: ['s1'] },
      { id: 's5', itemId: 'power_bank', x: 210, y: 150, width: 70, height: 120, rotation: 0, shape: 'rect', symmetry: 2, layer: 1, requires: ['s2'] },
    ],
    items: [
      { id: 'folded_shirt', slotId: 's1', nameKey: 'item_folded_shirt', material: 'fabric', shape: 'rect', width: 120, height: 220, color: '#fdfefe', accentColor: '#85c1e9', symmetry: 2, initialRotation: 90, iconType: 'shirt' },
      { id: 'denim_jeans', slotId: 's2', nameKey: 'item_denim_jeans', material: 'fabric', shape: 'rect', width: 100, height: 220, color: '#2e4053', accentColor: '#1b2631', symmetry: 2, initialRotation: 180, iconType: 'jeans' },
      { id: 'headphone_case', slotId: 's3', nameKey: 'item_headphone_case', material: 'plastic', shape: 'circle', width: 90, height: 90, color: '#17202a', accentColor: '#e74c3c', symmetry: 4, initialRotation: 0, iconType: 'headphones' },
      { id: 'travel_journal', slotId: 's4', nameKey: 'item_travel_journal', material: 'wood', shape: 'rect', width: 80, height: 80, color: '#b9770e', accentColor: '#784212', symmetry: 4, initialRotation: 0, iconType: 'journal' },
      { id: 'power_bank', slotId: 's5', nameKey: 'item_power_bank', material: 'metal', shape: 'rect', width: 70, height: 120, color: '#7f8c8d', accentColor: '#27ae60', symmetry: 2, initialRotation: 90, iconType: 'powerbank' },
    ],
  },
  {
    id: 14,
    act: 3,
    key: 'level_14',
    boxTheme: 'luggage',
    targetSeconds: 70,
    slots: [
      { id: 's1', itemId: 'sleeping_pad', x: 80, y: 150, width: 110, height: 240, rotation: 0, shape: 'rect', symmetry: 2, layer: 0 },
      { id: 's2', itemId: 'parka_jacket', x: 200, y: 150, width: 120, height: 240, rotation: 0, shape: 'rect', symmetry: 2, layer: 0 },
      { id: 's3', itemId: 'thermos_flask', x: 75, y: 95, width: 44, height: 110, rotation: 0, shape: 'pill', symmetry: 1, layer: 1, requires: ['s1'] },
      { id: 's4', itemId: 'swiss_knife', x: 85, y: 200, width: 40, height: 80, rotation: 0, shape: 'pill', symmetry: 1, layer: 1, requires: ['s1'] },
      { id: 's5', itemId: 'polaroid_cam', x: 195, y: 95, width: 90, height: 90, rotation: 0, shape: 'rect', symmetry: 1, layer: 1, requires: ['s2'] },
      { id: 's6', itemId: 'hike_goggles', x: 195, y: 200, width: 90, height: 60, rotation: 0, shape: 'pill', symmetry: 2, layer: 1, requires: ['s2'] },
    ],
    items: [
      { id: 'sleeping_pad', slotId: 's1', nameKey: 'item_sleeping_pad', material: 'fabric', shape: 'rect', width: 110, height: 240, color: '#196f3d', accentColor: '#114b29', symmetry: 2, initialRotation: 90, iconType: 'sleeping_pad' },
      { id: 'parka_jacket', slotId: 's2', nameKey: 'item_parka_jacket', material: 'fabric', shape: 'rect', width: 120, height: 240, color: '#e67e22', accentColor: '#b9770e', symmetry: 2, initialRotation: 180, iconType: 'parka' },
      { id: 'thermos_flask', slotId: 's3', nameKey: 'item_thermos_flask', material: 'metal', shape: 'pill', width: 44, height: 110, color: '#95a5a6', accentColor: '#c0392b', symmetry: 1, initialRotation: 270, iconType: 'flask' },
      { id: 'swiss_knife', slotId: 's4', nameKey: 'item_swiss_knife', material: 'metal', shape: 'pill', width: 40, height: 80, color: '#c0392b', accentColor: '#ecf0f1', symmetry: 1, initialRotation: 90, iconType: 'knife' },
      { id: 'polaroid_cam', slotId: 's5', nameKey: 'item_polaroid_cam', material: 'plastic', shape: 'rect', width: 90, height: 90, color: '#fdfefe', accentColor: '#e74c3c', symmetry: 1, initialRotation: 180, iconType: 'camera' },
      { id: 'hike_goggles', slotId: 's6', nameKey: 'item_hike_goggles', material: 'plastic', shape: 'pill', width: 90, height: 60, color: '#f39c12', accentColor: '#2c3e50', symmetry: 2, initialRotation: 90, iconType: 'glasses' },
    ],
  },

  // ==========================================
  // ACT 4: 极客工作台 (Geek Workbench - 5 Levels)
  // ==========================================
  {
    id: 15,
    act: 4,
    key: 'level_15',
    boxTheme: 'tech',
    targetSeconds: 45,
    slots: [
      { id: 's1', itemId: 'driver_handle', x: 70, y: 150, width: 34, height: 200, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'bits_ph', x: 140, y: 150, width: 28, height: 160, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's3', itemId: 'bits_torx', x: 190, y: 150, width: 28, height: 160, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's4', itemId: 'bits_hex', x: 240, y: 150, width: 28, height: 160, rotation: 0, shape: 'rect', symmetry: 2 },
    ],
    items: [
      { id: 'driver_handle', slotId: 's1', nameKey: 'item_driver_handle', material: 'metal', shape: 'pill', width: 34, height: 200, color: '#2c3e50', accentColor: '#3498db', symmetry: 1, initialRotation: 180, iconType: 'driver' },
      { id: 'bits_ph', slotId: 's2', nameKey: 'item_bits_ph', material: 'metal', shape: 'rect', width: 28, height: 160, color: '#95a5a6', accentColor: '#7f8c8d', symmetry: 2, initialRotation: 90, iconType: 'bits' },
      { id: 'bits_torx', slotId: 's3', nameKey: 'item_bits_torx', material: 'metal', shape: 'rect', width: 28, height: 160, color: '#bdc3c7', accentColor: '#7f8c8d', symmetry: 2, initialRotation: 270, iconType: 'bits' },
      { id: 'bits_hex', slotId: 's4', nameKey: 'item_bits_hex', material: 'metal', shape: 'rect', width: 28, height: 160, color: '#7f8c8d', accentColor: '#34495e', symmetry: 2, initialRotation: 90, iconType: 'bits' },
    ],
  },
  {
    id: 16,
    act: 4,
    key: 'level_16',
    boxTheme: 'tech',
    targetSeconds: 45,
    slots: [
      { id: 's1', itemId: 'switch_puller', x: 70, y: 140, width: 32, height: 130, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'keycap_puller', x: 120, y: 140, width: 36, height: 150, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's3', itemId: 'artisan_keycaps', x: 210, y: 100, width: 80, height: 80, rotation: 0, shape: 'rect', symmetry: 4 },
      { id: 's4', itemId: 'lube_brush_pen', x: 210, y: 210, width: 24, height: 120, rotation: 0, shape: 'pill', symmetry: 1 },
    ],
    items: [
      { id: 'switch_puller', slotId: 's1', nameKey: 'item_switch_puller', material: 'metal', shape: 'pill', width: 32, height: 130, color: '#e74c3c', accentColor: '#c0392b', symmetry: 1, initialRotation: 90, iconType: 'puller' },
      { id: 'keycap_puller', slotId: 's2', nameKey: 'item_keycap_puller', material: 'metal', shape: 'pill', width: 36, height: 150, color: '#f39c12', accentColor: '#d35400', symmetry: 1, initialRotation: 180, iconType: 'puller' },
      { id: 'artisan_keycaps', slotId: 's3', nameKey: 'item_artisan_keycaps', material: 'plastic', shape: 'rect', width: 80, height: 80, color: '#9b59b6', accentColor: '#8e44ad', symmetry: 4, initialRotation: 0, iconType: 'keycaps' },
      { id: 'lube_brush_pen', slotId: 's4', nameKey: 'item_lube_brush_pen', material: 'plastic', shape: 'pill', width: 24, height: 120, color: '#1abc9c', accentColor: '#16a085', symmetry: 1, initialRotation: 270, iconType: 'pen' },
    ],
  },
  {
    id: 17,
    act: 4,
    key: 'level_17',
    boxTheme: 'tech',
    targetSeconds: 50,
    slots: [
      { id: 's1', itemId: 'soldering_iron', x: 80, y: 150, width: 36, height: 210, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'solder_wire_spool', x: 160, y: 100, width: 70, height: 70, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's3', itemId: 'esd_tweezers', x: 230, y: 140, width: 24, height: 160, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's4', itemId: 'multimeter_probe', x: 160, y: 210, width: 44, height: 110, rotation: 0, shape: 'pill', symmetry: 1 },
    ],
    items: [
      { id: 'soldering_iron', slotId: 's1', nameKey: 'item_soldering_iron', material: 'metal', shape: 'pill', width: 36, height: 210, color: '#34495e', accentColor: '#e74c3c', symmetry: 1, initialRotation: 90, iconType: 'iron' },
      { id: 'solder_wire_spool', slotId: 's2', nameKey: 'item_solder_wire_spool', material: 'metal', shape: 'circle', width: 70, height: 70, color: '#95a5a6', accentColor: '#f1c40f', symmetry: 4, initialRotation: 0, iconType: 'spool' },
      { id: 'esd_tweezers', slotId: 's3', nameKey: 'item_esd_tweezers', material: 'metal', shape: 'pill', width: 24, height: 160, color: '#17202a', accentColor: '#2c3e50', symmetry: 1, initialRotation: 180, iconType: 'tweezers' },
      { id: 'multimeter_probe', slotId: 's4', nameKey: 'item_multimeter_probe', material: 'plastic', shape: 'pill', width: 44, height: 110, color: '#e74c3c', accentColor: '#2c3e50', symmetry: 1, initialRotation: 270, iconType: 'probe' },
    ],
  },
  {
    id: 18,
    act: 4,
    key: 'level_18',
    boxTheme: 'tech',
    targetSeconds: 55,
    slots: [
      { id: 's1', itemId: 'usbc_hub', x: 90, y: 110, width: 64, height: 130, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's2', itemId: 'portable_nvme', x: 175, y: 100, width: 50, height: 100, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's3', itemId: 'card_reader', x: 240, y: 100, width: 44, height: 70, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's4', itemId: 'braided_cable_a', x: 140, y: 220, width: 110, height: 50, rotation: 0, shape: 'pill', symmetry: 2 },
      { id: 's5', itemId: 'braided_cable_b', x: 230, y: 210, width: 50, height: 90, rotation: 0, shape: 'pill', symmetry: 2 },
    ],
    items: [
      { id: 'usbc_hub', slotId: 's1', nameKey: 'item_usbc_hub', material: 'metal', shape: 'rect', width: 64, height: 130, color: '#7f8c8d', accentColor: '#34495e', symmetry: 1, initialRotation: 180, iconType: 'hub' },
      { id: 'portable_nvme', slotId: 's2', nameKey: 'item_portable_nvme', material: 'metal', shape: 'rect', width: 50, height: 100, color: '#2c3e50', accentColor: '#e67e22', symmetry: 2, initialRotation: 90, iconType: 'ssd' },
      { id: 'card_reader', slotId: 's3', nameKey: 'item_card_reader', material: 'plastic', shape: 'rect', width: 44, height: 70, color: '#3498db', accentColor: '#2980b9', symmetry: 1, initialRotation: 270, iconType: 'reader' },
      { id: 'braided_cable_a', slotId: 's4', nameKey: 'item_braided_cable_a', material: 'fabric', shape: 'pill', width: 110, height: 50, color: '#e74c3c', accentColor: '#922b21', symmetry: 2, initialRotation: 90, iconType: 'cable' },
      { id: 'braided_cable_b', slotId: 's5', nameKey: 'item_braided_cable_b', material: 'fabric', shape: 'pill', width: 50, height: 90, color: '#2ecc71', accentColor: '#27ae60', symmetry: 2, initialRotation: 90, iconType: 'cable' },
    ],
  },
  {
    id: 19,
    act: 4,
    key: 'level_19',
    boxTheme: 'tech',
    targetSeconds: 60,
    slots: [
      { id: 's1', itemId: 'multi_pliers', x: 80, y: 120, width: 70, height: 140, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's2', itemId: 'mini_caliper', x: 155, y: 150, width: 40, height: 190, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's3', itemId: 'magnetic_tray', x: 230, y: 90, width: 70, height: 70, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's4', itemId: 'air_blower', x: 230, y: 180, width: 60, height: 90, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's5', itemId: 'precision_tweezers', x: 80, y: 235, width: 24, height: 80, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's6', itemId: 'thermal_paste_tube', x: 120, y: 245, width: 26, height: 60, rotation: 0, shape: 'pill', symmetry: 1 },
    ],
    items: [
      { id: 'multi_pliers', slotId: 's1', nameKey: 'item_multi_pliers', material: 'metal', shape: 'pill', width: 70, height: 140, color: '#95a5a6', accentColor: '#e74c3c', symmetry: 1, initialRotation: 90, iconType: 'pliers' },
      { id: 'mini_caliper', slotId: 's2', nameKey: 'item_mini_caliper', material: 'metal', shape: 'rect', width: 40, height: 190, color: '#7f8c8d', accentColor: '#d4ac0d', symmetry: 1, initialRotation: 180, iconType: 'caliper' },
      { id: 'magnetic_tray', slotId: 's3', nameKey: 'item_magnetic_tray', material: 'metal', shape: 'circle', width: 70, height: 70, color: '#34495e', accentColor: '#2980b9', symmetry: 4, initialRotation: 0, iconType: 'tray' },
      { id: 'air_blower', slotId: 's4', nameKey: 'item_air_blower', material: 'plastic', shape: 'pill', width: 60, height: 90, color: '#16a085', accentColor: '#1abc9c', symmetry: 1, initialRotation: 270, iconType: 'blower' },
      { id: 'precision_tweezers', slotId: 's5', nameKey: 'item_precision_tweezers', material: 'metal', shape: 'pill', width: 24, height: 80, color: '#bdc3c7', accentColor: '#7f8c8d', symmetry: 1, initialRotation: 90, iconType: 'tweezers' },
      { id: 'thermal_paste_tube', slotId: 's6', nameKey: 'item_thermal_paste_tube', material: 'plastic', shape: 'pill', width: 26, height: 60, color: '#9b59b6', accentColor: '#8e44ad', symmetry: 1, initialRotation: 180, iconType: 'tube' },
    ],
  },

  // ==========================================
  // ACT 5: 暖心日式便当 (Cozy Bento - 5 Levels)
  // ==========================================
  {
    id: 20,
    act: 5,
    key: 'level_20',
    boxTheme: 'bento',
    targetSeconds: 40,
    slots: [
      { id: 's1', itemId: 'onigiri_triangle', x: 100, y: 120, width: 100, height: 90, rotation: 0, shape: 'triangle', symmetry: 1 },
      { id: 's2', itemId: 'tamagoyaki_a', x: 200, y: 90, width: 60, height: 50, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's3', itemId: 'tamagoyaki_b', x: 200, y: 150, width: 60, height: 50, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's4', itemId: 'octopus_sausage', x: 140, y: 220, width: 80, height: 50, rotation: 0, shape: 'pill', symmetry: 1 },
    ],
    items: [
      { id: 'onigiri_triangle', slotId: 's1', nameKey: 'item_onigiri_triangle', material: 'food', shape: 'triangle', width: 100, height: 90, color: '#fdfefe', accentColor: '#17202a', symmetry: 1, initialRotation: 90, iconType: 'onigiri' },
      { id: 'tamagoyaki_a', slotId: 's2', nameKey: 'item_tamagoyaki_a', material: 'food', shape: 'rect', width: 60, height: 50, color: '#f4d03f', accentColor: '#d4ac0d', symmetry: 2, initialRotation: 180, iconType: 'tamagoyaki' },
      { id: 'tamagoyaki_b', slotId: 's3', nameKey: 'item_tamagoyaki_b', material: 'food', shape: 'rect', width: 60, height: 50, color: '#f5b041', accentColor: '#d68910', symmetry: 2, initialRotation: 90, iconType: 'tamagoyaki' },
      { id: 'octopus_sausage', slotId: 's4', nameKey: 'item_octopus_sausage', material: 'food', shape: 'pill', width: 80, height: 50, color: '#e74c3c', accentColor: '#c0392b', symmetry: 1, initialRotation: 270, iconType: 'sausage' },
    ],
  },
  {
    id: 21,
    act: 5,
    key: 'level_21',
    boxTheme: 'bento',
    targetSeconds: 45,
    slots: [
      { id: 's1', itemId: 'salmon_sushi_a', x: 80, y: 100, width: 80, height: 50, rotation: 0, shape: 'pill', symmetry: 2 },
      { id: 's2', itemId: 'salmon_sushi_b', x: 80, y: 165, width: 80, height: 50, rotation: 0, shape: 'pill', symmetry: 2 },
      { id: 's3', itemId: 'tempura_prawn', x: 190, y: 120, width: 70, height: 130, rotation: 0, shape: 'pill', symmetry: 1 },
      { id: 's4', itemId: 'broccoli_floret', x: 80, y: 235, width: 60, height: 60, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's5', itemId: 'tamagoyaki_piece', x: 180, y: 235, width: 70, height: 50, rotation: 0, shape: 'rect', symmetry: 2 },
    ],
    items: [
      { id: 'salmon_sushi_a', slotId: 's1', nameKey: 'item_salmon_sushi_a', material: 'food', shape: 'pill', width: 80, height: 50, color: '#e59866', accentColor: '#fdfefe', symmetry: 2, initialRotation: 90, iconType: 'sushi' },
      { id: 'salmon_sushi_b', slotId: 's2', nameKey: 'item_salmon_sushi_b', material: 'food', shape: 'pill', width: 80, height: 50, color: '#e67e22', accentColor: '#fdfefe', symmetry: 2, initialRotation: 180, iconType: 'sushi' },
      { id: 'tempura_prawn', slotId: 's3', nameKey: 'item_tempura_prawn', material: 'food', shape: 'pill', width: 70, height: 130, color: '#f39c12', accentColor: '#d35400', symmetry: 1, initialRotation: 270, iconType: 'tempura' },
      { id: 'broccoli_floret', slotId: 's4', nameKey: 'item_broccoli_floret', material: 'food', shape: 'circle', width: 60, height: 60, color: '#27ae60', accentColor: '#1e8449', symmetry: 4, initialRotation: 0, iconType: 'broccoli' },
      { id: 'tamagoyaki_piece', slotId: 's5', nameKey: 'item_tamagoyaki_piece', material: 'food', shape: 'rect', width: 70, height: 50, color: '#f4d03f', accentColor: '#b7950b', symmetry: 2, initialRotation: 90, iconType: 'tamagoyaki' },
    ],
  },
  {
    id: 22,
    act: 5,
    key: 'level_22',
    boxTheme: 'bento',
    targetSeconds: 50,
    slots: [
      { id: 's1', itemId: 'karaage_chicken_a', x: 80, y: 100, width: 70, height: 70, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's2', itemId: 'karaage_chicken_b', x: 80, y: 185, width: 70, height: 70, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's3', itemId: 'cherry_tomatoes', x: 80, y: 255, width: 60, height: 40, rotation: 0, shape: 'pill', symmetry: 2 },
      { id: 's4', itemId: 'flower_carrot', x: 190, y: 90, width: 60, height: 60, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's5', itemId: 'nori_rice_ball', x: 190, y: 190, width: 90, height: 110, rotation: 0, shape: 'rect', symmetry: 2 },
    ],
    items: [
      { id: 'karaage_chicken_a', slotId: 's1', nameKey: 'item_karaage_chicken_a', material: 'food', shape: 'circle', width: 70, height: 70, color: '#b9770e', accentColor: '#784212', symmetry: 4, initialRotation: 0, iconType: 'chicken' },
      { id: 'karaage_chicken_b', slotId: 's2', nameKey: 'item_karaage_chicken_b', material: 'food', shape: 'circle', width: 70, height: 70, color: '#a04000', accentColor: '#6e2c00', symmetry: 4, initialRotation: 0, iconType: 'chicken' },
      { id: 'cherry_tomatoes', slotId: 's3', nameKey: 'item_cherry_tomatoes', material: 'food', shape: 'pill', width: 60, height: 40, color: '#e74c3c', accentColor: '#27ae60', symmetry: 2, initialRotation: 90, iconType: 'tomato' },
      { id: 'flower_carrot', slotId: 's4', nameKey: 'item_flower_carrot', material: 'food', shape: 'circle', width: 60, height: 60, color: '#e67e22', accentColor: '#d35400', symmetry: 4, initialRotation: 0, iconType: 'carrot' },
      { id: 'nori_rice_ball', slotId: 's5', nameKey: 'item_nori_rice_ball', material: 'food', shape: 'rect', width: 90, height: 110, color: '#fdfefe', accentColor: '#17202a', symmetry: 2, initialRotation: 90, iconType: 'onigiri' },
    ],
  },
  {
    id: 23,
    act: 5,
    key: 'level_23',
    boxTheme: 'bento',
    targetSeconds: 55,
    slots: [
      { id: 's1', itemId: 'unagi_eel', x: 100, y: 140, width: 90, height: 180, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's2', itemId: 'steamed_rice_base', x: 210, y: 100, width: 90, height: 90, rotation: 0, shape: 'rect', symmetry: 4 },
      { id: 's3', itemId: 'yellow_takuan', x: 210, y: 170, width: 80, height: 36, rotation: 0, shape: 'pill', symmetry: 2 },
      { id: 's4', itemId: 'rolled_omelet', x: 100, y: 250, width: 80, height: 44, rotation: 0, shape: 'pill', symmetry: 2 },
      { id: 's5', itemId: 'snow_peas', x: 200, y: 240, width: 70, height: 60, rotation: 0, shape: 'pill', symmetry: 1 },
    ],
    items: [
      { id: 'unagi_eel', slotId: 's1', nameKey: 'item_unagi_eel', material: 'food', shape: 'rect', width: 90, height: 180, color: '#5b2c6f', accentColor: '#d4ac0d', symmetry: 2, initialRotation: 90, iconType: 'unagi' },
      { id: 'steamed_rice_base', slotId: 's2', nameKey: 'item_steamed_rice_base', material: 'food', shape: 'rect', width: 90, height: 90, color: '#fdfefe', accentColor: '#eaeded', symmetry: 4, initialRotation: 0, iconType: 'rice' },
      { id: 'yellow_takuan', slotId: 's3', nameKey: 'item_yellow_takuan', material: 'food', shape: 'pill', width: 80, height: 36, color: '#f4d03f', accentColor: '#b7950b', symmetry: 2, initialRotation: 90, iconType: 'radish' },
      { id: 'rolled_omelet', slotId: 's4', nameKey: 'item_rolled_omelet', material: 'food', shape: 'pill', width: 80, height: 44, color: '#f5b041', accentColor: '#e59866', symmetry: 2, initialRotation: 90, iconType: 'tamagoyaki' },
      { id: 'snow_peas', slotId: 's5', nameKey: 'item_snow_peas', material: 'food', shape: 'pill', width: 70, height: 60, color: '#2ecc71', accentColor: '#27ae60', symmetry: 1, initialRotation: 180, iconType: 'peas' },
    ],
  },
  {
    id: 24,
    act: 5,
    key: 'level_24',
    boxTheme: 'bento',
    targetSeconds: 75,
    slots: [
      // 豪华九宫格 Bento Masterpiece
      { id: 's1', itemId: 'unagi_cut', x: 60, y: 65, width: 70, height: 70, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's2', itemId: 'tamago_cubes', x: 150, y: 65, width: 70, height: 70, rotation: 0, shape: 'rect', symmetry: 4 },
      { id: 's3', itemId: 'ebi_fried_prawn', x: 240, y: 65, width: 70, height: 70, rotation: 0, shape: 'rect', symmetry: 1 },
      { id: 's4', itemId: 'plum_onigiri', x: 60, y: 155, width: 70, height: 70, rotation: 0, shape: 'triangle', symmetry: 1 },
      { id: 's5', itemId: 'octopus_wieners', x: 150, y: 155, width: 70, height: 70, rotation: 0, shape: 'rect', symmetry: 2 },
      { id: 's6', itemId: 'salmon_maki', x: 240, y: 155, width: 70, height: 70, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's7', itemId: 'edamame_beans', x: 60, y: 245, width: 70, height: 70, rotation: 0, shape: 'pill', symmetry: 2 },
      { id: 's8', itemId: 'matcha_mochi', x: 150, y: 245, width: 70, height: 70, rotation: 0, shape: 'circle', symmetry: 4 },
      { id: 's9', itemId: 'sweet_tamago', x: 240, y: 245, width: 70, height: 70, rotation: 0, shape: 'rect', symmetry: 2 },
    ],
    items: [
      { id: 'unagi_cut', slotId: 's1', nameKey: 'item_unagi_cut', material: 'food', shape: 'rect', width: 70, height: 70, color: '#5b2c6f', accentColor: '#d4ac0d', symmetry: 2, initialRotation: 90, iconType: 'unagi' },
      { id: 'tamago_cubes', slotId: 's2', nameKey: 'item_tamago_cubes', material: 'food', shape: 'rect', width: 70, height: 70, color: '#f4d03f', accentColor: '#f39c12', symmetry: 4, initialRotation: 0, iconType: 'tamagoyaki' },
      { id: 'ebi_fried_prawn', slotId: 's3', nameKey: 'item_ebi_fried_prawn', material: 'food', shape: 'rect', width: 70, height: 70, color: '#e67e22', accentColor: '#d35400', symmetry: 1, initialRotation: 180, iconType: 'tempura' },
      { id: 'plum_onigiri', slotId: 's4', nameKey: 'item_plum_onigiri', material: 'food', shape: 'triangle', width: 70, height: 70, color: '#fdfefe', accentColor: '#c0392b', symmetry: 1, initialRotation: 270, iconType: 'onigiri' },
      { id: 'octopus_wieners', slotId: 's5', nameKey: 'item_octopus_wieners', material: 'food', shape: 'rect', width: 70, height: 70, color: '#e74c3c', accentColor: '#c0392b', symmetry: 2, initialRotation: 90, iconType: 'sausage' },
      { id: 'salmon_maki', slotId: 's6', nameKey: 'item_salmon_maki', material: 'food', shape: 'circle', width: 70, height: 70, color: '#17202a', accentColor: '#e59866', symmetry: 4, initialRotation: 0, iconType: 'sushi' },
      { id: 'edamame_beans', slotId: 's7', nameKey: 'item_edamame_beans', material: 'food', shape: 'pill', width: 70, height: 70, color: '#2ecc71', accentColor: '#27ae60', symmetry: 2, initialRotation: 90, iconType: 'peas' },
      { id: 'matcha_mochi', slotId: 's8', nameKey: 'item_matcha_mochi', material: 'food', shape: 'circle', width: 70, height: 70, color: '#58d68d', accentColor: '#1e8449', symmetry: 4, initialRotation: 0, iconType: 'mochi' },
      { id: 'sweet_tamago', slotId: 's9', nameKey: 'item_sweet_tamago', material: 'food', shape: 'rect', width: 70, height: 70, color: '#f9e79f', accentColor: '#f1c40f', symmetry: 2, initialRotation: 180, iconType: 'tamagoyaki' },
    ],
  },
];

/**
 * 获取指定 ID 关卡（若越界安全回退到第 1 关）
 */
export function getLevelById(id) {
  const num = Number(id);
  const found = LEVELS.find((lvl) => lvl.id === num);
  return found || LEVELS[0];
}
