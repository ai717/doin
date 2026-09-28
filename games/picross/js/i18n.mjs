/**
 * Picross Internationalization Module
 * Reads/writes shared portal language preference `localStorage["doin.lang"]`.
 * Strict invariant: `en` table contains ZERO Chinese characters.
 */

const LANG_KEY = "doin.lang";

export const strings = {
  zh: {
    game_title: "数织 · 像素画谜",
    game_desc: "看行列数字提示，推理涂黑标叉，一幅隐藏像素画跃然眼前。",
    back_home: "返回首页",
    how_to_play: "玩法说明",
    sound_on: "音效：开",
    sound_off: "音效：关",
    langBtn: "EN",
    lang_label: "切换语言",

    // HUD & Controls
    hud_level: "关卡",
    hud_mistakes: "失误",
    hud_time: "用时",
    btn_paint: "涂黑笔",
    btn_cross: "打叉笔",
    btn_hint: "智能提示",
    btn_undo: "撤销",
    btn_restart: "重开",
    btn_album: "印章画册",
    btn_custom: "创作画板",
    btn_prev: "上一关",
    btn_next: "下一关",
    btn_select_level: "关卡列表",

    // Tooltips
    tip_paint: "涂黑格 (左键 / 空格)",
    tip_cross: "打叉格 (右键 / X)",
    tip_hint: "揭示一个当前逻辑可确定的格 (H)",
    tip_undo: "撤销上一步操作 (Z / Ctrl+Z)",
    tip_restart: "重置当前盘面 (R)",

    // Rating & Badges
    stars_perfect: "完美！零失误三星通关",
    stars_good: "干得漂亮！顺利通关",
    stars_clear: "成功揭晓像素画！",
    badge_chapter_unlocked: "章节徽章已点亮！",

    // Modals
    modal_win_title: "印章揭晓！",
    modal_win_btn_next: "下一关",
    modal_win_btn_replay: "再玩一次",
    modal_win_btn_album: "查看印章画册",
    modal_close: "关闭",

    // Stamp Album
    album_title: "像素印章画册",
    album_subtitle: "每解开一关即可盖上一枚专属像素印章",
    album_collected: "已收集印章",
    album_chapter_stars: "本章星级",
    album_locked: "未解锁",
    album_time_record: "最佳用时",

    // Custom Board (Easter Egg)
    custom_title: "自定义像素创作",
    custom_desc: "在网格上自由画出你的像素图案，系统将校验是否有唯一解并生成挑战题！",
    custom_size: "画板尺寸",
    custom_btn_verify: "校验唯一解并出题",
    custom_btn_clear: "清空画板",
    custom_err_no_pixels: "请先画一些像素！",
    custom_err_multiple: "当前图案存在多种可能解，请增添或调整细节以保证逻辑唯一！",
    custom_err_contradiction: "当前图案逻辑有冲突，请微调！",
    custom_success: "校验通过！已生成唯一解谜题，立即开玩！",
    custom_play_now: "立即挑战",

    // Help Dialog
    help_title: "数织玩法教学",
    help_rule1_title: "1. 读懂行列数字",
    help_rule1_text: "每行左侧与每列上方的数字串表示该行/列拥有的连续涂黑块长度。例如「3 1」表示先有一段3格连黑，至少隔1格空格，再有一段1格黑。",
    help_rule2_title: "2. 逻辑涂黑与标叉",
    help_rule2_text: "确定必黑的格子涂黑（左键/空格），确定不能涂黑的格子打叉（右键/X）。行列达标后数字会自动划线折叠。",
    help_rule3_title: "3. 巧妙运用重叠法",
    help_rule3_text: "5格长度要求涂4格时，不管从左排还是从右排，中间3格必然涂黑！这就是逻辑确定的落笔点，永不靠猜。",
    help_rule4_title: "4. 印章画册与三星",
    help_rule4_text: "零失误通关可获专属3星。收集每章所有三星将点亮章节荣耀徽章，并收入印章画册！",
    guide_drag: "拖动：按住拖拽连续涂格",
    rule_star3: "⭐⭐⭐ 0 失误",
    rule_star2: "⭐⭐ ≤3 失误",
    rule_star1: "⭐ 通关即可",

    // Chapters
    chapter_prologue: "序章・入门教学",
    chapter_fruit: "第一章・水果田园",
    chapter_pet: "第二章・萌宠星球",
    chapter_myth: "第三章・神话传说",
    chapter_star: "第四章・星际遨游",
    chapter_custom: "玩家工坊・自制关卡",

    // Levels (All 40)
    level_heart: "爱心印记",
    level_smile: "快乐笑脸",
    level_arrow: "指引箭头",
    level_cup: "热咖啡杯",
    level_apple: "红苹果",
    level_cherry: "双生樱桃",
    level_watermelon: "甜西瓜",
    level_banana: "黄香蕉",
    level_grape: "水晶葡萄",
    level_pear: "多汁雪梨",
    level_strawberry: "红草莓",
    level_pineapple: "金菠萝",
    level_cat: "小花猫",
    level_dog: "忠犬小柴",
    level_rabbit: "萌萌白兔",
    level_penguin: "南极企鹅",
    level_bear: "森林棕熊",
    level_panda: "国宝熊猫",
    level_koala: "桉树考拉",
    level_fox: "机敏赤狐",
    level_frog: "池塘青蛙",
    level_fish: "七彩热带鱼",
    level_moon_rabbit: "月宫仙兔",
    level_wizard_hat: "魔法尖帽",
    level_magic_wand: "星光魔杖",
    level_crystal_ball: "占卜水晶球",
    level_unicorn: "梦幻独角兽",
    level_genie_lamp: "奇迹神灯",
    level_mermaid: "深海人鱼",
    level_phoenix: "不灭火凤",
    level_pegasus: "展翼飞马",
    level_dragon: "东方神龙",
    level_rocket: "探索者火箭",
    level_saturn: "环带土星",
    level_astronaut: "星际宇航员",
    level_alien: "外星小客",
    level_satellite: "巡天卫星",
    level_ufo: "神秘飞碟",
    level_telescope: "天文望远镜",
    level_shooting_star: "闪耀流星",
  },
  en: {
    game_title: "Picross · Pixel Art",
    game_desc: "Deduce rows and columns to paint and mark. Watch the pixel art unveil!",
    back_home: "Back to Home",
    how_to_play: "How to Play",
    sound_on: "Sound: On",
    sound_off: "Sound: Off",
    langBtn: "中",
    lang_label: "Switch language",

    // HUD & Controls
    hud_level: "Level",
    hud_mistakes: "Mistakes",
    hud_time: "Time",
    btn_paint: "Paint Tool",
    btn_cross: "Mark X",
    btn_hint: "Smart Hint",
    btn_undo: "Undo",
    btn_restart: "Restart",
    btn_album: "Stamp Album",
    btn_custom: "Create Pixel",
    btn_prev: "Previous",
    btn_next: "Next",
    btn_select_level: "Level Select",

    // Tooltips
    tip_paint: "Paint block (Left Click / Space)",
    tip_cross: "Mark X (Right Click / X)",
    tip_hint: "Reveal a logically proven cell (H)",
    tip_undo: "Undo previous move (Z / Ctrl+Z)",
    tip_restart: "Restart current puzzle (R)",

    // Rating & Badges
    stars_perfect: "Flawless! Zero mistake 3 Stars",
    stars_good: "Well Done! Cleared puzzle",
    stars_clear: "Pixel art revealed!",
    badge_chapter_unlocked: "Chapter Badge Awarded!",

    // Modals
    modal_win_title: "Stamp Unlocked!",
    modal_win_btn_next: "Next Level",
    modal_win_btn_replay: "Replay",
    modal_win_btn_album: "Open Stamp Album",
    modal_close: "Close",

    // Stamp Album
    album_title: "Pixel Stamp Album",
    album_subtitle: "Solve each puzzle to collect its exclusive pixel stamp",
    album_collected: "Stamps Collected",
    album_chapter_stars: "Chapter Stars",
    album_locked: "Locked",
    album_time_record: "Best Time",

    // Custom Board (Easter Egg)
    custom_title: "Custom Pixel Workshop",
    custom_desc: "Draw your pixel art. The solver validates unique solvability and builds a playable puzzle!",
    custom_size: "Grid Size",
    custom_btn_verify: "Verify & Build Puzzle",
    custom_btn_clear: "Clear Canvas",
    custom_err_no_pixels: "Draw some pixels first!",
    custom_err_multiple: "Multiple solutions exist! Add or adjust pixels to make it logically unique.",
    custom_err_contradiction: "Logical contradiction detected. Adjust your drawing.",
    custom_success: "Verified! Unique solution puzzle created. Play now!",
    custom_play_now: "Play Puzzle",

    // Help Dialog
    help_title: "How to Play Picross",
    help_rule1_title: "1. Clue Numbers",
    help_rule1_text: "Numbers on the top and left indicate consecutive runs of painted squares. '3 1' means a group of 3 painted squares, followed by at least one blank square, and then 1 square.",
    help_rule2_title: "2. Paint and Mark X",
    help_rule2_text: "Paint squares that must be filled. Mark X on squares that must stay blank. Satisfied clues will dim and cross out automatically.",
    help_rule3_title: "3. Overlap Logic",
    help_rule3_text: "If a line of 5 squares requires a block of 4, whether placed left or right, the middle 3 squares overlap! These squares are logically guaranteed.",
    help_rule4_title: "4. Stamp Collection & 3 Stars",
    help_rule4_text: "Finish without mistakes to earn 3 Stars. Clear chapters with 3 stars to unlock golden Chapter Badges and fill your Stamp Album!",
    guide_drag: "Drag: Click and drag to fill continuous cells",
    rule_star3: "⭐⭐⭐ 0 Mistakes",
    rule_star2: "⭐⭐ ≤3 Mistakes",
    rule_star1: "⭐ Clear to Pass",

    // Chapters
    chapter_prologue: "Prologue: First Steps",
    chapter_fruit: "Chapter 1: Fruit Garden",
    chapter_pet: "Chapter 2: Pet Planet",
    chapter_myth: "Chapter 3: Myth & Legend",
    chapter_star: "Chapter 4: Star Odyssey",
    chapter_custom: "Workshop: Custom Puzzles",

    // Levels (All 40)
    level_heart: "Heart Emblem",
    level_smile: "Happy Smile",
    level_arrow: "Arrow Marker",
    level_cup: "Coffee Mug",
    level_apple: "Red Apple",
    level_cherry: "Twin Cherries",
    level_watermelon: "Sweet Melon",
    level_banana: "Yellow Banana",
    level_grape: "Grape Cluster",
    level_pear: "Juicy Pear",
    level_strawberry: "Strawberry",
    level_pineapple: "Pineapple",
    level_cat: "Tabby Cat",
    level_dog: "Shiba Pup",
    level_rabbit: "White Bunny",
    level_penguin: "Baby Penguin",
    level_bear: "Brown Bear",
    level_panda: "Giant Panda",
    level_koala: "Eucalyptus Koala",
    level_fox: "Red Fox",
    level_frog: "Pond Frog",
    level_fish: "Tropical Fish",
    level_moon_rabbit: "Moon Bunny",
    level_wizard_hat: "Wizard Hat",
    level_magic_wand: "Star Wand",
    level_crystal_ball: "Crystal Ball",
    level_unicorn: "Dream Unicorn",
    level_genie_lamp: "Genie Lamp",
    level_mermaid: "Deep Mermaid",
    level_phoenix: "Blazing Phoenix",
    level_pegasus: "Winged Pegasus",
    level_dragon: "Ancient Dragon",
    level_rocket: "Cosmic Rocket",
    level_saturn: "Ringed Saturn",
    level_astronaut: "Star Astronaut",
    level_alien: "Alien Buddy",
    level_satellite: "Orbital Satellite",
    level_ufo: "Mystery UFO",
    level_telescope: "Space Telescope",
    level_shooting_star: "Shooting Star",
  },
};

export function getLanguage() {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === "zh" || stored === "en") return stored;
    }
  } catch {
    // fallback
  }
  return "zh";
}

export function setLanguage(lang) {
  const chosen = lang === "en" ? "en" : "zh";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, chosen);
    }
  } catch {
    // fallback
  }
  return chosen;
}

export function t(key, lang = getLanguage()) {
  const table = strings[lang] || strings.zh;
  return table[key] || strings.zh[key] || key;
}
