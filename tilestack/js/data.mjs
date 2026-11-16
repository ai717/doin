/**
 * Data definitions for TileStack (千层瓦片 · 叠叠消)
 * Pure data structures, fully bilingual fields to satisfy i18n checks.
 */

export const CHAPTERS = [
  {
    id: 'ch1',
    theme: 'porcelain',
    nameZh: '第一章 · 青花瓷坊',
    nameEn: 'Ch 1 · Blue Porcelain',
    descZh: '清雅钴蓝，经典三消初涉层叠之境。',
    descEn: 'Classic match-3 on tiered cobalt porcelain tiles.',
    levelRange: [1, 8],
    skinId: 'porcelain',
    tileTypes: ['teapot', 'bowl', 'vase', 'fan', 'lotus', 'carp', 'bamboo', 'orchid']
  },
  {
    id: 'ch2',
    theme: 'pastry',
    nameZh: '第二章 · 暖香点心铺',
    nameEn: 'Ch 2 · Warm Tea Pastry',
    descZh: '江南茶点，引入锁牌与玉匙机制。',
    descEn: 'Tea snacks introducing key and locked tiles.',
    levelRange: [9, 16],
    skinId: 'pastry',
    tileTypes: ['cake', 'dumpling', 'mooncake', 'osmanthus', 'teacup', 'snack', 'peach', 'plum']
  },
  {
    id: 'ch3',
    theme: 'mahjong',
    nameZh: '第三章 · 雀台翠竹',
    nameEn: 'Ch 3 · Jade Mahjong',
    descZh: '温润青玉，霜雪冰冻牌需双重消除。',
    descEn: 'Glazed jade tiles with frosty double-match tiles.',
    levelRange: [17, 24],
    skinId: 'mahjong',
    tileTypes: ['zhong', 'fa', 'bai', 'dong', 'nan', 'xi', 'bei', 'tiao']
  },
  {
    id: 'ch4',
    theme: 'botany',
    nameZh: '第四章 · 百草锦萃',
    nameEn: 'Ch 4 · Herbal Botanicals',
    descZh: '四时花木，七彩万能瓦片逢对即消。',
    descEn: 'Four seasons flora with wild rainbow tiles.',
    levelRange: [25, 32],
    skinId: 'botany',
    tileTypes: ['pine', 'blossom', 'chrysanthemum', 'maple', 'herbal', 'reed', 'leaf', 'petal']
  },
  {
    id: 'ch5',
    theme: 'trial',
    nameZh: '第五章 · 千层试炼',
    nameEn: 'Ch 5 · Master Pagoda',
    descZh: '九霄高塔，限时极速考验槽位智慧。',
    descEn: 'High-speed timed challenge testing tray strategy.',
    levelRange: [33, 40],
    skinId: 'trial',
    tileTypes: ['dragon', 'phoenix', 'cloud', 'sun', 'moon', 'flame', 'water', 'pagoda']
  }
];

export const TILE_DEFINITIONS = {
  // Porcelain
  teapot: { id: 'teapot', icon: '🫖', nameZh: '提梁壶', nameEn: 'Teapot', color: '#1a5ba0' },
  bowl: { id: 'bowl', icon: '🥣', nameZh: '青瓷碗', nameEn: 'Porcelain Bowl', color: '#1d63b2' },
  vase: { id: 'vase', icon: '🏺', nameZh: '梅瓶', nameEn: 'Meiping Vase', color: '#164c88' },
  fan: { id: 'fan', icon: '🪭', nameZh: '折扇', nameEn: 'Folding Fan', color: '#276fb8' },
  lotus: { id: 'lotus', icon: '🪷', nameZh: '青莲', nameEn: 'Lotus', color: '#2b84cf' },
  carp: { id: 'carp', icon: '🐟', nameZh: '锦鲤', nameEn: 'Koi Fish', color: '#1e528b' },
  bamboo: { id: 'bamboo', icon: '🎋', nameZh: '修竹', nameEn: 'Bamboo', color: '#246b7a' },
  orchid: { id: 'orchid', icon: '🌿', nameZh: '幽兰', nameEn: 'Orchid', color: '#1b6379' },

  // Pastry
  cake: { id: 'cake', icon: '🥮', nameZh: '桂花糕', nameEn: 'Flower Cake', color: '#b56d2e' },
  dumpling: { id: 'dumpling', icon: '🥟', nameZh: '青团', nameEn: 'Sweet Dumpling', color: '#688c3a' },
  mooncake: { id: 'mooncake', icon: '🍘', nameZh: '月饼', nameEn: 'Mooncake', color: '#b86623' },
  osmanthus: { id: 'osmanthus', icon: '🌼', nameZh: '金桂', nameEn: 'Osmanthus', color: '#cb9225' },
  teacup: { id: 'teacup', icon: '🍵', nameZh: '茶盅', nameEn: 'Tea Cup', color: '#4a7d48' },
  snack: { id: 'snack', icon: '🍥', nameZh: '素酥', nameEn: 'Crisp Pastry', color: '#af6836' },
  peach: { id: 'peach', icon: '🍑', nameZh: '寿桃', nameEn: 'Peach Bun', color: '#c95454' },
  plum: { id: 'plum', icon: '🌸', nameZh: '梅点', nameEn: 'Plum Pastry', color: '#b54e7a' },

  // Mahjong
  zhong: { id: 'zhong', icon: '🀄', nameZh: '红中', nameEn: 'Red Dragon', color: '#b52b2b' },
  fa: { id: 'fa', icon: '🀅', nameZh: '发财', nameEn: 'Green Dragon', color: '#2d8448' },
  bai: { id: 'bai', icon: '🀆', nameZh: '白板', nameEn: 'White Board', color: '#406080' },
  dong: { id: 'dong', icon: '🀀', nameZh: '东风', nameEn: 'East Wind', color: '#244e80' },
  nan: { id: 'nan', icon: '🀁', nameZh: '南风', nameEn: 'South Wind', color: '#9a3c20' },
  xi: { id: 'xi', icon: '🀂', nameZh: '西风', nameEn: 'West Wind', color: '#6b3687' },
  bei: { id: 'bei', icon: '🀃', nameZh: '北风', nameEn: 'North Wind', color: '#246b7a' },
  tiao: { id: 'tiao', icon: '🀐', nameZh: '幺鸡', nameEn: 'Bird Tile', color: '#2e7a46' },

  // Botany
  pine: { id: 'pine', icon: '🌲', nameZh: '苍松', nameEn: 'Green Pine', color: '#2b6f48' },
  blossom: { id: 'blossom', icon: '🌺', nameZh: '朱槿', nameEn: 'Hibiscus', color: '#b03458' },
  chrysanthemum: { id: 'chrysanthemum', icon: '🌻', nameZh: '秋菊', nameEn: 'Chrysanthemum', color: '#b88924' },
  maple: { id: 'maple', icon: '🍁', nameZh: '丹枫', nameEn: 'Autumn Maple', color: '#bd4b27' },
  herbal: { id: 'herbal', icon: '🌱', nameZh: '灵芝', nameEn: 'Lingzhi Herb', color: '#577c38' },
  reed: { id: 'reed', icon: '🌾', nameZh: '芦苇', nameEn: 'River Reed', color: '#8f7a37' },
  leaf: { id: 'leaf', icon: '🍃', nameZh: '青叶', nameEn: 'Jade Leaf', color: '#3d8654' },
  petal: { id: 'petal', icon: '🌷', nameZh: '牡丹', nameEn: 'Peony', color: '#a83c66' },

  // Trial / Mythic
  dragon: { id: 'dragon', icon: '🐉', nameZh: '游龙', nameEn: 'Azure Dragon', color: '#2768aa' },
  phoenix: { id: 'phoenix', icon: '🦚', nameZh: '青鸾', nameEn: 'Phoenix', color: '#1e807a' },
  cloud: { id: 'cloud', icon: '☁️', nameZh: '祥云', nameEn: 'Auspicious Cloud', color: '#4b75a6' },
  sun: { id: 'sun', icon: '☀️', nameZh: '日耀', nameEn: 'Golden Sun', color: '#b87c24' },
  moon: { id: 'moon', icon: '🌙', nameZh: '皓月', nameEn: 'Crescent Moon', color: '#3f5d96' },
  flame: { id: 'flame', icon: '🔥', nameZh: '离火', nameEn: 'Mystic Flame', color: '#b24128' },
  water: { id: 'water', icon: '💧', nameZh: '清泉', nameEn: 'Pure Spring', color: '#2b84b8' },
  pagoda: { id: 'pagoda', icon: '🏯', nameZh: '宝塔', nameEn: 'Sky Pagoda', color: '#5c4587' },

  // Special Mechanic Tiles
  key: { id: 'key', icon: '🗝️', nameZh: '玉匙', nameEn: 'Jade Key', color: '#d4a237', isKey: true },
  lock: { id: 'lock', icon: '🔒', nameZh: '秘锁', nameEn: 'Locked Box', color: '#685942', isLock: true },
  wild: { id: 'wild', icon: '🌈', nameZh: '七彩灵瓦', nameEn: 'Rainbow Wild', color: '#a246b0', isWild: true }
};

export const GAME_CONSTANTS = {
  TRAY_CAPACITY: 7,
  MATCH_COUNT: 3,
  TILE_WIDTH: 56,
  TILE_HEIGHT: 68,
  LAYER_DEPTH_Z: 14,
  MAX_HINTS: 3,
  MATCH_SCORE: 100,
  COMBO_BONUS_FACTOR: 0.5,
  COMBO_WINDOW_MS: 3200,
  CHALLENGE_TIME_LIMIT_SEC: 90
};

export const LEVEL_NAMES = [
  // Ch1 Porcelain
  { zh: '青花初现', en: 'Porcelain Dawn' },
  { zh: '钴蓝窑火', en: 'Cobalt Flame' },
  { zh: '折扇清风', en: 'Gentle Fan' },
  { zh: '荷塘游鲤', en: 'Lotus Pond' },
  { zh: '修竹映月', en: 'Bamboo Moon' },
  { zh: '梅瓶古韵', en: 'Meiping Grace' },
  { zh: '千峰翠色', en: 'Verdant Peak' },
  { zh: '青花试炼', en: 'Porcelain Trial' },

  // Ch2 Pastry
  { zh: '金桂留香', en: 'Sweet Osmanthus' },
  { zh: '碧螺春色', en: 'Spring Tea' },
  { zh: '玉匙秘锁', en: 'Key and Lock' },
  { zh: '江南茶社', en: 'Riverside Teahouse' },
  { zh: '酥饼暖炉', en: 'Hearth Pastry' },
  { zh: '团圆月影', en: 'Mooncake Night' },
  { zh: '重楼锁翠', en: 'Lockwork Tower' },
  { zh: '点心试炼', en: 'Pastry Rush' },

  // Ch3 Mahjong
  { zh: '青玉雀台', en: 'Jade Mahjong' },
  { zh: '寒霜初凝', en: 'Frost Onset' },
  { zh: '双重冰晶', en: 'Twin Ice Tiles' },
  { zh: '东西合璧', en: 'East and West' },
  { zh: '中发白影', en: 'Dragon Trio' },
  { zh: '破冰碎玉', en: 'Shattered Frost' },
  { zh: '九莲宝灯', en: 'Lotus Lantern' },
  { zh: '雀台试炼', en: 'Mahjong Trial' },

  // Ch4 Botany
  { zh: '四时芳华', en: 'Seasonal Bloom' },
  { zh: '七彩灵草', en: 'Rainbow Sprout' },
  { zh: '丹枫醉染', en: 'Autumn Maple' },
  { zh: '空谷幽兰', en: 'Valley Orchid' },
  { zh: '万能合一', en: 'Wild Synthesis' },
  { zh: '松鹤长青', en: 'Evergreen Pine' },
  { zh: '百草锦绣', en: 'Botanical Crest' },
  { zh: '芳华试炼', en: 'Flora Trial' },

  // Ch5 Master Trial
  { zh: '九霄天阁', en: 'Celestial Gate' },
  { zh: '神龙吐珠', en: 'Dragon Pearl' },
  { zh: '青鸾展翼', en: 'Phoenix Wing' },
  { zh: '日月同辉', en: 'Sun and Moon' },
  { zh: '星罗万象', en: 'Astral Matrix' },
  { zh: '玄天宝塔', en: 'Pagoda Summit' },
  { zh: '千重破阵', en: 'Thousand Layers' },
  { zh: '千层极境', en: 'Zenith Master' }
];
