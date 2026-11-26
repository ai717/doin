/**
 * Data definitions and cultural lore for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * Pure data structures, fully bilingual fields satisfying i18n checks.
 */

export const CHAPTERS = [
  {
    id: 'ch1',
    chapterNum: 1,
    nameZh: '第一章 · 十字天元',
    nameEn: 'Ch 1 · Cross Locks',
    descZh: '三轴交错初窥门径，领略最质朴的榫卯咬合。',
    descEn: 'Three-axis orthogonal interlocking foundations.',
    levelRange: [1, 6]
  },
  {
    id: 'ch2',
    chapterNum: 2,
    nameZh: '第二章 · 六合同春',
    nameEn: 'Ch 2 · Liuhe Interlocks',
    descZh: '传世六子连环古锁，阴阳槽位互为锁钥。',
    descEn: 'Traditional six-piece classic interlocking puzzle.',
    levelRange: [7, 12]
  },
  {
    id: 'ch3',
    chapterNum: 3,
    nameZh: '第三章 · 八卦乾坤',
    nameEn: 'Ch 3 · Bagua Locks',
    descZh: '斜切契榫，双重锁钥环环相扣。',
    descEn: 'Eight-direction mortises with twin locking keys.',
    levelRange: [13, 18]
  },
  {
    id: 'ch4',
    chapterNum: 4,
    nameZh: '第四章 · 孔明深机',
    nameEn: 'Ch 4 · Kongming Locks',
    descZh: '层层套迭暗藏巧簧，考量极细腻的拆解次序。',
    descEn: 'Deep-layered sequential displacement locks.',
    levelRange: [19, 24]
  },
  {
    id: 'ch5',
    chapterNum: 5,
    nameZh: '第五章 · 鲁班天球',
    nameEn: 'Ch 5 · Luban Star Spheres',
    descZh: '多柱放射星芒锁体，错综交织的空间想象。',
    descEn: 'Polyhedral starburst and spherical mortise nodes.',
    levelRange: [25, 30]
  },
  {
    id: 'ch6',
    chapterNum: 6,
    nameZh: '第六章 · 秘阁机关',
    nameEn: 'Ch 6 · Secret Mechanism Box',
    descZh: '榫卯机关百宝重楼，登峰造极的木作秘术。',
    descEn: 'Intricate hidden puzzle casket and mechanical bolts.',
    levelRange: [31, 36]
  }
];

export const WOOD_STAINS = {
  cedar: { id: 'cedar', nameZh: '香杉', nameEn: 'Cedar', colorTop: '#d99457', colorLeft: '#a86532', colorRight: '#82461c' },
  walnut: { id: 'walnut', nameZh: '胡桃', nameEn: 'Walnut', colorTop: '#ba794c', colorLeft: '#8e522d', colorRight: '#6c3a1b' },
  rosewood: { id: 'rosewood', nameZh: '花梨', nameEn: 'Rosewood', colorTop: '#c7593c', colorLeft: '#9b3922', colorRight: '#772412' },
  sandalwood: { id: 'sandalwood', nameZh: '紫檀', nameEn: 'Sandalwood', colorTop: '#8c526d', colorLeft: '#65334c', colorRight: '#4a2035' },
  bamboo: { id: 'bamboo', nameZh: '青竹', nameEn: 'Bamboo', colorTop: '#a5ba72', colorLeft: '#768c48', colorRight: '#576c31' },
  goldkey: { id: 'goldkey', nameZh: '金丝楠 (锁钥)', nameEn: 'Golden Key', colorTop: '#f5c558', colorLeft: '#c7952a', colorRight: '#9e7116', isKey: true }
};

export const RATINGS = {
  gold: { id: 'gold', nameZh: '金榫', nameEn: 'Gold Tenon', icon: '🏆', descZh: '完美零提示通关' },
  silver: { id: 'silver', nameZh: '银榫', nameEn: 'Silver Tenon', icon: '🥈', descZh: '少量试探解开' },
  bronze: { id: 'bronze', nameZh: '铜榫', nameEn: 'Bronze Tenon', icon: '🥉', descZh: '悉心拆解功成' }
};

export const LUBAN_TRIVIA = [
  // 1-6
  { zh: '“不着一钉一胶，却能天衣无缝。”这便是榫卯穿越千年的东方木作精髓。', en: 'No nails, no glue, yet seamlessly interlocked across millennia.' },
  { zh: '鲁班锁相传由春秋鲁班所发明，民间又尊称孔明锁，暗合易经阴阳之道。', en: 'Invented by Lu Ban, the master carpenter, embodying Yin-Yang balance.' },
  { zh: '榫卯结构中，凸出者为“榫”（阳），凹入者为“卯”（阴），阴阳契合方成大器。', en: 'The protrusion is Tenon (Yang); the socket is Mortise (Yin).' },
  { zh: '紫禁城太和殿历经多次大地震安然无恙，正是得益于柔性榫卯的抗震消能。', en: 'The Forbidden City withstood major earthquakes thanks to mortise elasticity.' },
  { zh: '传统六柱鲁班锁仅凭一根完全实心、无槽位的“锁钥”锁死全局，抽之即解。', en: 'A solid key block locks all six bars; drawing it unleashes the lock.' },
  { zh: '“巧拙互藏，大巧若拙。”看似粗朴的木块内部，蕴藏着严谨的三维解析几何。', en: 'Behind rustic wooden bars lies precise three-dimensional geometry.' },

  // 7-12
  { zh: '宋代李诫所著《营造法式》，详尽总结了唐宋时期中国古代木构建筑的营造法度。', en: 'Yingzao Fashi codifies the architectural mortise standards of the Song Dynasty.' },
  { zh: '经典的“燕尾榫”如飞燕展尾，受力越拉越紧，常用在明清桌案与抽屉交角处。', en: 'The Dovetail Joint tightens under tension, classic in Ming Dynasty furniture.' },
  { zh: '六合锁的“六合”，意指天地四方（东、西、南、北、天、地），含包罗万象之意。', en: 'Liuhe represents the six cardinal directions of the universe.' },
  { zh: '明代硬木家具因不开裂、不变形闻名世界，归功于随温度干湿呼吸的伸缩缝设计。', en: 'Ming hardwood furniture breathes with climate shifts via expansion joints.' },
  { zh: '抱头梁与檐柱交接处的“斗拱”，如同层叠的弹簧，是中式建筑屋檐起翘的秘密。', en: 'Dougong bracket sets act as shock absorbers beneath sweeping palace eaves.' },
  { zh: '木性温润，木匠择料讲究“向阳取坚，背阴取柔”，因材施榫方得长久。', en: 'Carpenters select sunward wood for firmness and shaded wood for flexibility.' },

  // 13-18
  { zh: '八卦锁讲究对称与错位并存，木块间的微小斜角往往暗藏着滑动契机。', en: 'Bagua locks marry symmetry with offset, hiding sliding clearance in angles.' },
  { zh: '“棕角榫”又称三碰肩，三根木条在立方体角点三向相扣，表面浑然一体不见接缝。', en: 'The Corner Tenon unites three bars at one corner with invisible seams.' },
  { zh: '木作行话常道：“一榫抵万金，分毫见精神。”制作榫槽公差往往需严控于半丝之内。', en: 'Master carpenters tune joint tolerances within a fraction of a millimeter.' },
  { zh: '中国古典木锁不仅用于日常门窗防盗，更曾用于兵部战车、粮仓与机密木匣。', en: 'Mortise locks guarded doors, grain depots, and military supply caskets.' },
  { zh: '“挂榫”利用自重与下落位移形成阻挡，轻微上提方能水平滑出。', en: 'Gravity-hung tenons lock under their own weight, requiring an upward nudge to slide.' },
  { zh: '金丝楠木耐腐避虫，纹理在日光下如金丝游弋，是古代御用巧锁的尊贵选材。', en: 'Golden Phoebe Nanmu wood glows with silk-like grain, favored for imperial chests.' },

  // 19-24
  { zh: '孔明锁因诸葛亮而得名，相传三军征战之余，常用来考较将领的空间阵型与心性。', en: 'Kongming Locks trained generals in spatial layout and strategic patience.' },
  { zh: '多层互锁的关键在于“阻断依赖拓扑”，顺藤摸瓜找到第一个自由度即是破局点。', en: 'Disassembly relies on finding the root node with an unobstructed degree of freedom.' },
  { zh: '“暗销”隐藏于榫卯内部，从外观完全看不到任何孔隙，需特定旋转方可解脱。', en: 'Hidden dowels lock internally, revealed only by precise axial displacement.' },
  { zh: '应县木塔高 67.31 米，全塔纯木构榫卯咬合，屹立近千年历经大地震与炮火无损。', en: 'The 67m Yingxian Pagoda stands firm after 1,000 years with pure wooden joints.' },
  { zh: '“夹头榫”将腿足上端嵌夹进案面下牙条，使长桌承受千斤重压而不摇晃。', en: 'Bridle joints slot into aprons, allowing heavy tables to bear massive loads.' },
  { zh: '解锁切忌蛮力，木纤维富有韧性，寻得隙缝自然顺滑如游鱼穿水。', en: 'Never force a joint; alignment lets wood glide effortlessly like fish through water.' },

  // 25-30
  { zh: '鲁班球将原本正交平行的榫卯引申向三维球体经纬，形成璀璨夺目的立体星体。', en: 'Luban Spheres project orthogonal joints into spherical latitude and longitude.' },
  { zh: '十二柱鲁班星的拆解次序往往高度非线性，抽出一根将彻底改写其余十一根的受力。', en: 'Extracting one star bar fundamentally shifts the friction balance of the rest.' },
  { zh: '古代木匠出师必做三把锁：考眼力、考心力、考手力。三锁皆通方能自立门户。', en: 'Apprentices crafted three locks to prove vision, patience, and manual precision.' },
  { zh: '榫卯无需金属连接件，天然避免了生锈膨胀对木纤维造成的不可逆破坏。', en: 'No metal pins means no rust, preserving delicate wood grain across centuries.' },
  { zh: '“插销榫”可自锁自弹，拆解时若不一次性推到底，反向弹簧将重新扣死。', en: 'Spring-loaded pins reset unless pushed fully through their travel axis.' },
  { zh: '圆柱形榫卯在接触面上弧形贴合，要求木匠对圆弧与直角具备双重把握。', en: 'Cylindrical tenons demand mastery over both planar cuts and radial curvatures.' },

  // 31-36
  { zh: '机关盒又名百宝遁甲匣，古代文人常将珍贵印章地契锁入其中，密码即为拆解次序。', en: 'Secret puzzle boxes safeguarded seals and deeds behind physical multi-step codes.' },
  { zh: '机关盒的多级暗簧要求先滑动顶板，方能解除侧板滑轨的机械互锁。', en: 'Puzzle caskets require sliding top plates before side rails unlock.' },
  { zh: '“万榫之冠”：顶级鲁班锁在组装完毕后浑圆如一体，完全看不出拼接痕迹。', en: 'Masterpiece locks appear as seamless solid forms with imperceptible joins.' },
  { zh: '榫卯体现了人与自然相处的“相让相成”哲学——每块木头退让出空槽，才成全了大锁。', en: 'Tenons embody mutual concession: wood yields notches to form a greater whole.' },
  { zh: '拆锁容易拼锁难，倒推记忆抽拉路径，是锻炼脑空间建模的绝佳法门。', en: 'Dismantling is easy; remembering the reverse sequence builds true spatial mastery.' },
  { zh: '三十六重锁关皆破，鲁班榫卯之道尽在胸中。恭喜大宗师登峰造极！', en: '36 locks mastered! The wisdom of Lu Ban is yours. Grand Carpenter Zenith attained!' }
];

export const LEVEL_METAS = [
  // Ch 1 (1-6)
  { id: 1, nameZh: '三轴初试', nameEn: 'Trial of Three Axes', descZh: '四根实木十字相嵌，单抽顶端锁钥。' },
  { id: 2, nameZh: '十字双锁', nameEn: 'Twin Cross Keys', descZh: '立柱稳如磐石，左右互为倚仗。' },
  { id: 3, nameZh: '金丝初现', nameEn: 'Golden Key Dawn', descZh: '金丝楠木显真身，寻得唯一抽拉方向。' },
  { id: 4, nameZh: '五木横空', nameEn: 'Five Pillars Traverse', descZh: '五块木方错落穿插，步步抽丝剥茧。' },
  { id: 5, nameZh: '天元十字', nameEn: 'Tian Yuan Cross', descZh: '六根正交经典，榫槽交错如棋局。' },
  { id: 6, nameZh: '破空解离', nameEn: 'Severance of Space', descZh: '首章巅峰考验，一石激起千层浪。' },

  // Ch 2 (7-12)
  { id: 7, nameZh: '六合同心', nameEn: 'Sixfold Harmony', descZh: '传统六子古锁，阴阳槽位互为锁钥。' },
  { id: 8, nameZh: '回纹榫槽', nameEn: 'Meander Mortise', descZh: '内部藏有回环卡槽，先退方能前行。' },
  { id: 9, nameZh: '错峰抱梁', nameEn: 'Interlocking Beam', descZh: '双梁并驾齐驱，立柱夹隙藏巧。' },
  { id: 10, nameZh: '紫檀六合', nameEn: 'Sandalwood Hex', descZh: '紫檀沉稳厚重，槽隙紧致分毫不差。' },
  { id: 11, nameZh: '移步换景', nameEn: 'Perspective Shift', descZh: '转动等轴测视窗，从背面发现生门。' },
  { id: 12, nameZh: '六合归一', nameEn: 'Hex Convergence', descZh: '六根齐解轰然散落，成就感油然而生。' },

  // Ch 3 (13-18)
  { id: 13, nameZh: '八卦初阵', nameEn: 'Bagua Prelude', descZh: '八方来风，斜向榫位初显威芒。' },
  { id: 14, nameZh: '阴阳双钥', nameEn: 'Dual Yin-Yang Keys', descZh: '双重锁钥先后就位，顺序不可颠倒。' },
  { id: 15, nameZh: '乾坤交错', nameEn: 'Heaven and Earth', descZh: '上下呼应，天地合德方破此关。' },
  { id: 16, nameZh: '四象环生', nameEn: 'Four Symbols Matrix', descZh: '四根立柱成环，环环相扣层层制约。' },
  { id: 17, nameZh: '迷津破局', nameEn: 'Labyrinth Dissolve', descZh: '看似动弹不得，实则暗藏寸步空间。' },
  { id: 18, nameZh: '八面玲珑', nameEn: 'Octagonal Splendor', descZh: '八卦锁终局考验，八木拆解如行云流水。' },

  // Ch 4 (19-24)
  { id: 19, nameZh: '孔明拜相', nameEn: 'Kongming Prime', descZh: '名震千古之锁，九木严丝合缝。' },
  { id: 20, nameZh: '草船借箭', nameEn: 'Straw Boat Ploy', descZh: '借力打力，抽出一块解放两翼。' },
  { id: 21, nameZh: '东风破浪', nameEn: 'Eastern Gale Surge', descZh: '顺水推舟，锁钥滑出如脱兔。' },
  { id: 22, nameZh: '连环奇局', nameEn: 'Chained Stratagem', descZh: '九根木方连续递推，极考验前瞻预判。' },
  { id: 23, nameZh: '八阵图锁', nameEn: 'Eight Formations', descZh: '阵门深邃，进退有据方见天日。' },
  { id: 24, nameZh: '空城妙算', nameEn: 'Empty City Wonder', descZh: '看似无路可走，转角忽逢生机。' },

  // Ch 5 (25-30)
  { id: 25, nameZh: '鲁班星芒', nameEn: 'Luban Starburst', descZh: '放射状榫卯体系，立体星辰初破晓。' },
  { id: 26, nameZh: '金芒交辉', nameEn: 'Golden Radiance', descZh: '金丝楠与紫檀交错，十木凌空争辉。' },
  { id: 27, nameZh: '天穹落子', nameEn: 'Celestial Placement', descZh: '多柱经纬交织，空间想象力大考验。' },
  { id: 28, nameZh: '浑天仪轨', nameEn: 'Armillary Sphere', descZh: '如天球旋转，处处咬合处处机变。' },
  { id: 29, nameZh: '万星朝宗', nameEn: 'Starlight Homage', descZh: '星球解构只在弹指一瞬间。' },
  { id: 30, nameZh: '天球大成', nameEn: 'Zenith Star Sphere', descZh: '鲁班星完全解构，木作奇迹再现人间。' },

  // Ch 6 (31-36)
  { id: 31, nameZh: '秘匣初启', nameEn: 'Casket Unveiling', descZh: '机关木匣外层滑板，试探首发锁簧。' },
  { id: 32, nameZh: '暗阁重门', nameEn: 'Hidden Portals', descZh: '重楼锁密，层层暗板滑动如飞。' },
  { id: 33, nameZh: '九霄藏珠', nameEn: 'Nine Cloud Pearl', descZh: '核心宝珠深藏，需先卸去八方挡板。' },
  { id: 34, nameZh: '遁甲奇门', nameEn: 'Dunjia Mechanism', descZh: '十二块精密木件，错综复杂之极限。' },
  { id: 35, nameZh: '木牛流马', nameEn: 'Wooden Ox Legacy', descZh: '千古神机之绝响，机械榫卯之化境。' },
  { id: 36, nameZh: '万榫归宗', nameEn: 'Grand Tenon Zenith', descZh: '三十六重终局圆满，鲁班宗师天下扬名！' }
];

export const GAME_CONSTANTS = {
  ISOMETRIC_ANGLES: [0, 90, 180, 270],
  MAX_HINTS_PER_LEVEL: 3,
  GOLD_TENON_HINTS: 0,
  SILVER_TENON_HINTS: 1
};
