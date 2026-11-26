/**
 * Data definitions for Tenpai King · Wait Finder (雀神听牌王 · 听牌速判)
 * Pure data structures, fully bilingual fields satisfying i18n checks.
 */

export const SUITS = {
  m: { id: 'm', nameZh: '万子', nameEn: 'Characters', color: '#b91c1c' },
  p: { id: 'p', nameZh: '筒子', nameEn: 'Circles', color: '#1d4ed8' },
  s: { id: 's', nameZh: '条子', nameEn: 'Bamboo', color: '#15803d' },
  z: { id: 'z', nameZh: '字牌', nameEn: 'Honors', color: '#7c3aed' }
};

export const TILES = {
  // Characters (Wan / Man)
  '1m': { id: '1m', suit: 'm', value: 1, symbol: '一万', nameZh: '一万', nameEn: '1 Wan', color: '#b91c1c' },
  '2m': { id: '2m', suit: 'm', value: 2, symbol: '二万', nameZh: '二万', nameEn: '2 Wan', color: '#b91c1c' },
  '3m': { id: '3m', suit: 'm', value: 3, symbol: '三万', nameZh: '三万', nameEn: '3 Wan', color: '#b91c1c' },
  '4m': { id: '4m', suit: 'm', value: 4, symbol: '四万', nameZh: '四万', nameEn: '4 Wan', color: '#b91c1c' },
  '5m': { id: '5m', suit: 'm', value: 5, symbol: '五万', nameZh: '五万', nameEn: '5 Wan', color: '#b91c1c' },
  '6m': { id: '6m', suit: 'm', value: 6, symbol: '六万', nameZh: '六万', nameEn: '6 Wan', color: '#b91c1c' },
  '7m': { id: '7m', suit: 'm', value: 7, symbol: '七万', nameZh: '七万', nameEn: '7 Wan', color: '#b91c1c' },
  '8m': { id: '8m', suit: 'm', value: 8, symbol: '八万', nameZh: '八万', nameEn: '8 Wan', color: '#b91c1c' },
  '9m': { id: '9m', suit: 'm', value: 9, symbol: '九万', nameZh: '九万', nameEn: '9 Wan', color: '#b91c1c' },

  // Circles (Pin / Tong)
  '1p': { id: '1p', suit: 'p', value: 1, symbol: '①', nameZh: '一筒', nameEn: '1 Pin', color: '#1d4ed8' },
  '2p': { id: '2p', suit: 'p', value: 2, symbol: '②', nameZh: '二筒', nameEn: '2 Pin', color: '#1d4ed8' },
  '3p': { id: '3p', suit: 'p', value: 3, symbol: '③', nameZh: '三筒', nameEn: '3 Pin', color: '#1d4ed8' },
  '4p': { id: '4p', suit: 'p', value: 4, symbol: '④', nameZh: '四筒', nameEn: '4 Pin', color: '#1d4ed8' },
  '5p': { id: '5p', suit: 'p', value: 5, symbol: '⑤', nameZh: '五筒', nameEn: '5 Pin', color: '#b91c1c' },
  '6p': { id: '6p', suit: 'p', value: 6, symbol: '⑥', nameZh: '六筒', nameEn: '6 Pin', color: '#15803d' },
  '7p': { id: '7p', suit: 'p', value: 7, symbol: '⑦', nameZh: '七筒', nameEn: '7 Pin', color: '#15803d' },
  '8p': { id: '8p', suit: 'p', value: 8, symbol: '⑧', nameZh: '八筒', nameEn: '8 Pin', color: '#1d4ed8' },
  '9p': { id: '9p', suit: 'p', value: 9, symbol: '⑨', nameZh: '九筒', nameEn: '9 Pin', color: '#1d4ed8' },

  // Bamboo (Sou / Tiao)
  '1s': { id: '1s', suit: 's', value: 1, symbol: '🀐', nameZh: '幺鸡', nameEn: '1 Sou', color: '#15803d' },
  '2s': { id: '2s', suit: 's', value: 2, symbol: '二条', nameZh: '二条', nameEn: '2 Sou', color: '#15803d' },
  '3s': { id: '3s', suit: 's', value: 3, symbol: '三条', nameZh: '三条', nameEn: '3 Sou', color: '#15803d' },
  '4s': { id: '4s', suit: 's', value: 4, symbol: '四条', nameZh: '四条', nameEn: '4 Sou', color: '#15803d' },
  '5s': { id: '5s', suit: 's', value: 5, symbol: '五条', nameZh: '五条', nameEn: '5 Sou', color: '#b91c1c' },
  '6s': { id: '6s', suit: 's', value: 6, symbol: '六条', nameZh: '六条', nameEn: '6 Sou', color: '#15803d' },
  '7s': { id: '7s', suit: 's', value: 7, symbol: '七条', nameZh: '七条', nameEn: '7 Sou', color: '#15803d' },
  '8s': { id: '8s', suit: 's', value: 8, symbol: '八条', nameZh: '八条', nameEn: '8 Sou', color: '#15803d' },
  '9s': { id: '9s', suit: 's', value: 9, symbol: '九条', nameZh: '九条', nameEn: '9 Sou', color: '#15803d' },

  // Honors (Ji / Zi)
  '1z': { id: '1z', suit: 'z', value: 1, symbol: '东', nameZh: '东风', nameEn: 'East Wind', color: '#1e293b' },
  '2z': { id: '2z', suit: 'z', value: 2, symbol: '南', nameZh: '南风', nameEn: 'South Wind', color: '#1e293b' },
  '3z': { id: '3z', suit: 'z', value: 3, symbol: '西', nameZh: '西风', nameEn: 'West Wind', color: '#1e293b' },
  '4z': { id: '4z', suit: 'z', value: 4, symbol: '北', nameZh: '北风', nameEn: 'North Wind', color: '#1e293b' },
  '5z': { id: '5z', suit: 'z', value: 5, symbol: '白', nameZh: '白板', nameEn: 'White Dragon', color: '#3b82f6' },
  '6z': { id: '6z', suit: 'z', value: 6, symbol: '发', nameZh: '发财', nameEn: 'Green Dragon', color: '#15803d' },
  '7z': { id: '7z', suit: 'z', value: 7, symbol: '中', nameZh: '红中', nameEn: 'Red Dragon', color: '#dc2626' }
};

export const CHAPTERS = [
  {
    id: 'ch1',
    chapterNum: 1,
    nameZh: '第一章 · 基础听牌',
    nameEn: 'Ch 1 · Fundamental Waits',
    descZh: '两面、嵌张、边张、单钓与双碰等入门骨架。',
    descEn: 'Two-sided, closed, edge, and pair waits.',
    levelRange: [1, 20]
  },
  {
    id: 'ch2',
    chapterNum: 2,
    nameZh: '第二章 · 复合多面听',
    nameEn: 'Ch 2 · Multi-way Waits',
    descZh: '三面听、四面听、带雀头与一色延伸型复合听。',
    descEn: '3-way, 4-way, and complex continuous shapes.',
    levelRange: [21, 40]
  },
  {
    id: 'ch3',
    chapterNum: 3,
    nameZh: '第三章 · 特殊形与大番',
    nameEn: 'Ch 3 · Special Forms & High Fan',
    descZh: '高难清一色多面听、七对子、十三幺与大番抉择。',
    descEn: 'Full flush shapes, seven pairs, and thirteen orphans.',
    levelRange: [41, 60]
  }
];

export const DAN_RANKS = [
  { id: 'novice', minScore: 0, nameZh: '雀士', nameEn: 'Novice', badgeColor: '#64748b' },
  { id: 'adept', minScore: 1200, nameZh: '雀杰', nameEn: 'Adept', badgeColor: '#3b82f6' },
  { id: 'expert', minScore: 2800, nameZh: '雀豪', nameEn: 'Expert', badgeColor: '#a855f7' },
  { id: 'master', minScore: 4800, nameZh: '雀神', nameEn: 'Master', badgeColor: '#f59e0b' }
];

export const FAN_DEFINITIONS = {
  // Standard Chinese / Guobiao common fans
  pinghu: { id: 'pinghu', nameZh: '平胡', nameEn: 'All Chows', fan: 1, descZh: '全部由顺子与一对非字牌组成' },
  tanyao: { id: 'tanyao', nameZh: '断幺九', nameEn: 'All Simples', fan: 1, descZh: '无一、九与字牌' },
  duanyao: { id: 'duanyao', nameZh: '断幺', nameEn: 'All Simples', fan: 1, descZh: '手牌不含一九及字牌' },
  yizhang: { id: 'yizhang', nameZh: '一般高', nameEn: 'Pure Double Chow', fan: 1, descZh: '同色同数的两副顺子' },
  pengpenghu: { id: 'pengpenghu', nameZh: '碰碰胡', nameEn: 'All Pungs', fan: 2, descZh: '由四副刻子与一对组成' },
  hunyise: { id: 'hunyise', nameZh: '混一色', nameEn: 'Half Flush', fan: 3, descZh: '由一种花色与字牌组成' },
  qingyise: { id: 'qingyise', nameZh: '清一色', nameEn: 'Full Flush', fan: 6, descZh: '全手牌均为同一种花色' },
  qidui: { id: 'qidui', nameZh: '七对子', nameEn: 'Seven Pairs', fan: 4, descZh: '由七副不同的对子组成' },
  shisanyao: { id: 'shisanyao', nameZh: '十三幺', nameEn: 'Thirteen Orphans', fan: 13, descZh: '一九万筒条加东南部西白发中' },
  jiulian: { id: 'jiulian', nameZh: '九莲宝灯', nameEn: 'Nine Gates', fan: 13, descZh: '同色1112345678999听全九面' },
  base_fan: { id: 'base_fan', nameZh: '基础胡牌', nameEn: 'Base Win', fan: 1, descZh: '标准和牌基础一番' }
};

export const GAME_CONSTANTS = {
  QUESTION_TIME_LIMIT_SEC: 30,
  MASTER_TIME_LIMIT_SEC: 20,
  TIME_ATTACK_INITIAL_SEC: 60,
  TIME_ATTACK_BONUS_SEC: 5,
  MAX_SCORE_PER_QUESTION: 100,
  FIND_ALL_WEIGHT: 60,
  BEST_FAN_WEIGHT: 40,
  STREAK_BONUS_PERCENT: 5,
  MAX_STREAK_BONUS_PERCENT: 50
};

export const LEVEL_METAS = [
  // Chapter 1: 基础听牌 (1-20)
  { id: 1, nameZh: '单钓将牌', nameEn: 'Single Wait', descZh: '四副完整面子已成，独候一张定将牌。' },
  { id: 2, nameZh: '经典两面听', nameEn: 'Two-Sided Wait', descZh: '二三索连续搭子，两端皆可成顺。' },
  { id: 3, nameZh: '金嵌张听', nameEn: 'Closed Wait', descZh: '一三索夹中卡张，唯有二索可胡。' },
  { id: 4, nameZh: '边张绝境', nameEn: 'Edge Wait', descZh: '八九索偏于一隅，单候七索归位。' },
  { id: 5, nameZh: '双碰抉择', nameEn: 'Dual Pair Wait', descZh: '手握两组对子，来任一张皆成刻。' },
  { id: 6, nameZh: '筒子单钓', nameEn: 'Pin Single Wait', descZh: '筒子四顺齐备，单钓五筒成和。' },
  { id: 7, nameZh: '两面带将', nameEn: 'Two-Sided with Pair', descZh: '六七索候五八索，对子稳坐雀头。' },
  { id: 8, nameZh: '四索嵌心', nameEn: 'Inner Closed Wait', descZh: '三五索夹心中空，单取四索补全。' },
  { id: 9, nameZh: '一二索边听', nameEn: 'Low Edge Wait', descZh: '一二索偏逢三索，进牌即见分晓。' },
  { id: 10, nameZh: '字牌双碰', nameEn: 'Honors Dual Pair', descZh: '西风与北风成对，双碰碰胡大门开。' },
  { id: 11, nameZh: '万子双连顺', nameEn: 'Double Wan Chows', descZh: '万子连绵二三索，一四索两面逢源。' },
  { id: 12, nameZh: '清纯嵌六筒', nameEn: 'Pin Closed Six', descZh: '五七筒夹六筒心，碰碰与平和交织。' },
  { id: 13, nameZh: '五万卡心', nameEn: 'Wan Closed Five', descZh: '四六万严阵以待，单取五万成和。' },
  { id: 14, nameZh: '七万边听', nameEn: 'Wan Edge Seven', descZh: '八九万迎候七万，平胡基础实战。' },
  { id: 15, nameZh: '五八筒两面', nameEn: 'Pin Two-Sided', descZh: '六七筒广开两门，五筒八筒任君选。' },
  { id: 16, nameZh: '六九索破晓', nameEn: 'Sou Two-Sided', descZh: '七八索蓄势待发，六九索进牌即鸣。' },
  { id: 17, nameZh: '七索定边', nameEn: 'Sou Edge Seven', descZh: '纯洁边张听牌，一眼洞悉听口。' },
  { id: 18, nameZh: '五索嵌张', nameEn: 'Sou Closed Five', descZh: '四六索中藏玄机，五索正中靶心。' },
  { id: 19, nameZh: '三六索开局', nameEn: 'Sou Three-Six', descZh: '四五索通吃两头，三六索齐入囊中。' },
  { id: 20, nameZh: '八九索双碰', nameEn: 'High Sou Pairs', descZh: '八索九索两对耸立，双碰番数各异。' },

  // Chapter 2: 复合多面听 (21-40)
  { id: 21, nameZh: '一四万双头延伸', nameEn: 'Extended Two-Sided', descZh: '一至五万连绵，一四万呼之欲出。' },
  { id: 22, nameZh: '三面听初现', nameEn: 'Three-Way Wait', descZh: '二至六万五连形，一四七万三面大听！' },
  { id: 23, nameZh: '二五八万破阵', nameEn: 'Classic Three-Way', descZh: '三至七万五连骨架，二五八万三路通达。' },
  { id: 24, nameZh: '三六九万金桥', nameEn: 'High Three-Way', descZh: '四至八万连环阵，三六九万全面开花。' },
  { id: 25, nameZh: '带刻复合三面', nameEn: 'Pung Triple Combo', descZh: '二万三张搭三四万，一四万加二万单钓！' },
  { id: 26, nameZh: '三万带刻复合', nameEn: 'Three Wan Combo', descZh: '三万暗刻连四五万，二三五万三面聚首。' },
  { id: 27, nameZh: '带对复合双听', nameEn: 'Pair Extension', descZh: '二至五万带五万对，二五万与单钓转换。' },
  { id: 28, nameZh: '六万连对复合', nameEn: 'Six Wan Pair Combo', descZh: '三至六万带六万对，三六万两路通和。' },
  { id: 29, nameZh: '七连形大三面', nameEn: 'Seven Sequence', descZh: '二至八万七张连贯，二五八万三面俱收。' },
  { id: 30, nameZh: '一至七万连环', nameEn: 'Low Seven Sequence', descZh: '一至七万大跨度，一四七万尽收眼底。' },
  { id: 31, nameZh: '连二对单钓', nameEn: 'Double Pair Tanki', descZh: '二二三三四四万连顺，单钓最后灵牌。' },
  { id: 32, nameZh: '三连刻带单', nameEn: 'Triple Pung Combo', descZh: '一一一二三四五万，两面与单钓复合。' },
  { id: 33, nameZh: '四面大听', nameEn: 'Four-Way Mega Wait', descZh: '二三四四五五六万，一四七索四面齐鸣！' },
  { id: 34, nameZh: '筒子七连大阵', nameEn: 'Pin Seven Chain', descZh: '二至八筒七张连璧，二五八筒三面齐鸣。' },
  { id: 35, nameZh: '暗刻夹顺三面', nameEn: 'Embedded Pung Three', descZh: '五万暗刻夹三四六七，二五八万三面贯通。' },
  { id: 36, nameZh: '四面广域听牌', nameEn: 'Four-Way Wide Wait', descZh: '三三三万嵌连顺，一二四五万四面通吃！' },
  { id: 37, nameZh: '中腹暗刻破局', nameEn: 'Center Pung Break', descZh: '四万暗刻引两翼，一四七万尽数入网。' },
  { id: 38, nameZh: '筒子五连暗刻', nameEn: 'Pin Pung Extension', descZh: '五筒暗刻兼具两端，二五八筒大杀四方。' },
  { id: 39, nameZh: '索子七连大阵', nameEn: 'Sou Seven Chain', descZh: '二至八索连绵不断，二五八索三路齐开。' },
  { id: 40, nameZh: '三暗刻单钓将', nameEn: 'Triple Pung Tanki', descZh: '三副纯暗刻坐镇，单钓索子决胜局。' },

  // Chapter 3: 特殊形与大番 (41-60)
  { id: 41, nameZh: '七对子万门单听', nameEn: 'Seven Pairs Wan', descZh: '六对齐备万门独秀，候四筒成七对绝艺。' },
  { id: 42, nameZh: '七对子断幺大成', nameEn: 'Seven Pairs Simples', descZh: '全无一九与字牌，单候五索断幺七对。' },
  { id: 43, nameZh: '七对子字牌留香', nameEn: 'Seven Pairs Honors', descZh: '混一色七对蓄势，单候南风定乾坤。' },
  { id: 44, nameZh: '十三幺全十三面', nameEn: 'Thirteen Orphans 13', descZh: '全幺九字牌各一张，天听全十三面大绝杀！' },
  { id: 45, nameZh: '十三幺单候红中', nameEn: 'Orphans Wait Red', descZh: '十二种幺九已配一万对，独候红中成大满贯！' },
  { id: 46, nameZh: '万子九莲宝灯', nameEn: 'Nine Gates Wan', descZh: '一一一二三四五六七八九九九万，听全九面！' },
  { id: 47, nameZh: '筒子九莲宝灯', nameEn: 'Nine Gates Pin', descZh: '一一一二三四五六七八九九九筒，听全九面！' },
  { id: 48, nameZh: '条子九莲宝灯', nameEn: 'Nine Gates Sou', descZh: '一一一二三四五六七八九九九条，听全九面！' },
  { id: 49, nameZh: '清一色碰碰大番', nameEn: 'Full Flush All Pungs', descZh: '万子四刻独缺单骑，满贯大番一触即发。' },
  { id: 50, nameZh: '清一色连环九张', nameEn: 'Full Flush Sequence', descZh: '纯色九张大骨架，多番路线任君抉择。' },
  { id: 51, nameZh: '清一色多面绞杀', nameEn: 'Complex Full Flush', descZh: '暗刻交叉复合顺，五面以上惊世大听。' },
  { id: 52, nameZh: '清一色全刻单钓', nameEn: 'Full Flush Pung Tanki', descZh: '一三五七九万跳刻，单钓九万满贯清一色。' },
  { id: 53, nameZh: '清一色四面通和', nameEn: 'Full Flush Four-Way', descZh: '纯万子深水区，考验眼力与最高番路线。' },
  { id: 54, nameZh: '清一色七对伪装', nameEn: 'Flush Pairs Hybrid', descZh: '看似六对实含暗刻，双重解构大比拼。' },
  { id: 55, nameZh: '清杯连环五面听', nameEn: 'Flush Five-Way Wait', descZh: '连绵纯万子波浪，五张听牌全数网罗。' },
  { id: 56, nameZh: '清一色多维解构', nameEn: 'Flush Multi-Meld', descZh: '不同听牌番数差千里，最高番精准狙击。' },
  { id: 57, nameZh: '字一色神级双碰', nameEn: 'All Honors Wait', descZh: '东南西北风全在手，北风白板双碰定乾坤。' },
  { id: 58, nameZh: '混老头满贯听牌', nameEn: 'All Terminals', descZh: '一九万一九筒加字牌，超强大番速判。' },
  { id: 59, nameZh: '四暗刻听牌绝响', nameEn: 'Four Concealed Pungs', descZh: '三副暗刻加一对，双碰成四暗刻役满！' },
  { id: 60, nameZh: '雀神终极九霄听', nameEn: 'Zenith Master Wait', descZh: '雀神之巅复合听牌，穷尽算力直达无上极境！' }
];
