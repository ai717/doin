// 关卡配置定义：32 关纸盒奇遇主线 + 8 关一刀大师残局挑战
// 舞台基准虚拟分辨率：640 × 800
// 所有坐标基于确定性几何数值，杜绝随机死局

export const CHAPTERS = [
  { id: 1, key: "ch1", name: "新手纸箱", nameEn: "Cardboard Box", range: [1, 8], bgTheme: "cardboard" },
  { id: 2, key: "ch2", name: "浮空气泡", nameEn: "Floating Bubble", range: [9, 16], bgTheme: "bubble" },
  { id: 3, key: "ch3", name: "气囊风暴", nameEn: "Air Storm", range: [17, 24], bgTheme: "bellows" },
  { id: 4, key: "ch4", name: "尖刺迷阵", nameEn: "Spike Maze", range: [25, 32], bgTheme: "spikes" },
  { id: 5, key: "ch5", name: "一刀大师", nameEn: "One-Cut Master", range: [33, 40], bgTheme: "master", isChallenge: true }
];

export const LEVELS = [
  // ==========================================
  // 第一章：新手纸箱 (1~8)
  // ==========================================
  {
    id: 1,
    chapter: 1,
    name: "初见萌宠",
    nameEn: "First Encounter",
    hintZh: "滑动切断绳索，让糖果落入小怪兽口中",
    hintEn: "Swipe to cut the rope and drop candy into Nommy's mouth",
    candy: { x: 320, y: 320 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 120 }, length: 200 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 320, y: 400 },
      { id: "s2", x: 320, y: 490 },
      { id: "s3", x: 320, y: 580 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 2,
    chapter: 1,
    name: "向心摇摆",
    nameEn: "Gentle Swing",
    hintZh: "看准摆动到右侧的瞬间切断绳索",
    hintEn: "Cut when the candy swings toward the right",
    candy: { x: 180, y: 300 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 140 }, length: 220 }
    ],
    nommy: { x: 460, y: 680 },
    stars: [
      { id: "s1", x: 260, y: 380 },
      { id: "s2", x: 360, y: 420 },
      { id: "s3", x: 440, y: 520 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 3,
    chapter: 1,
    name: "双绳平衡",
    nameEn: "Tension Balance",
    hintZh: "双绳悬挂！先切左边，再在合适位置切右边",
    hintEn: "Two ropes! Cut the left first, then time the right cut",
    candy: { x: 320, y: 320 },
    ropes: [
      { id: "r1", anchor: { x: 160, y: 180 }, length: 210 },
      { id: "r2", anchor: { x: 480, y: 180 }, length: 210 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 230, y: 400 },
      { id: "s2", x: 320, y: 500 },
      { id: "s3", x: 410, y: 400 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 4,
    chapter: 1,
    name: "交替弧线",
    nameEn: "Alternating Arcs",
    hintZh: "利用钟摆势能吃下两翼的星星",
    hintEn: "Swing through the stars before dropping",
    candy: { x: 200, y: 280 },
    ropes: [
      { id: "r1", anchor: { x: 200, y: 100 }, length: 180 },
      { id: "r2", anchor: { x: 440, y: 160 }, length: 270 }
    ],
    nommy: { x: 440, y: 680 },
    stars: [
      { id: "s1", x: 200, y: 360 },
      { id: "s2", x: 320, y: 440 },
      { id: "s3", x: 440, y: 540 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 5,
    chapter: 1,
    name: "三点悬吊",
    nameEn: "Triple Web",
    hintZh: "三根绳子交织，依次释放形成复合抛物线",
    hintEn: "Three ropes! Cut sequentially to release the candy",
    candy: { x: 320, y: 280 },
    ropes: [
      { id: "r1", anchor: { x: 140, y: 140 }, length: 230 },
      { id: "r2", anchor: { x: 320, y: 80 }, length: 200 },
      { id: "r3", anchor: { x: 500, y: 140 }, length: 230 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 320, y: 380 },
      { id: "s2", x: 320, y: 480 },
      { id: "s3", x: 320, y: 580 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 6,
    chapter: 1,
    name: "高空接力",
    nameEn: "High Relay",
    hintZh: "左绳拉紧释放，荡至最高点切断飞向怪兽",
    hintEn: "Swing high to the right and release at peak",
    candy: { x: 160, y: 260 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 120 }, length: 210 }
    ],
    nommy: { x: 520, y: 520 },
    stars: [
      { id: "s1", x: 240, y: 350 },
      { id: "s2", x: 380, y: 350 },
      { id: "s3", x: 480, y: 420 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 7,
    chapter: 1,
    name: "V型弹射",
    nameEn: "V-Slingshot",
    hintZh: "两侧绳索拉紧，看准中间星星落下",
    hintEn: "Tightly stretched V-ropes, cut both cleanly",
    candy: { x: 320, y: 360 },
    ropes: [
      { id: "r1", anchor: { x: 120, y: 200 }, length: 260 },
      { id: "r2", anchor: { x: 520, y: 200 }, length: 260 }
    ],
    nommy: { x: 320, y: 700 },
    stars: [
      { id: "s1", x: 220, y: 320 },
      { id: "s2", x: 420, y: 320 },
      { id: "s3", x: 320, y: 540 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 8,
    chapter: 1,
    name: "纸箱大丰收",
    nameEn: "Box Bonanza",
    hintZh: "综合考验收割三颗星并精准投喂",
    hintEn: "Master the swing rhythm to gather all stars",
    candy: { x: 180, y: 340 },
    ropes: [
      { id: "r1", anchor: { x: 180, y: 120 }, length: 220 },
      { id: "r2", anchor: { x: 460, y: 120 }, length: 360 }
    ],
    nommy: { x: 460, y: 680 },
    stars: [
      { id: "s1", x: 180, y: 440 },
      { id: "s2", x: 320, y: 480 },
      { id: "s3", x: 460, y: 550 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },

  // ==========================================
  // 第二章：浮空气泡 (9~16)
  // ==========================================
  {
    id: 9,
    chapter: 2,
    name: "轻舞飞扬",
    nameEn: "Floating Dream",
    hintZh: "糖果落入气泡会反重力上升！点击戳破气泡",
    hintEn: "Candy in a bubble floats up! Tap bubble to pop it",
    candy: { x: 320, y: 220 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 80 }, length: 140 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 320, y: 420 },
      { id: "s2", x: 320, y: 200 },
      { id: "s3", x: 320, y: 560 }
    ],
    bubbles: [
      { id: "b1", x: 320, y: 350, r: 34 }
    ],
    bellows: [],
    spikes: []
  },
  {
    id: 10,
    chapter: 2,
    name: "天顶漫步",
    nameEn: "Ceiling Stroll",
    hintZh: "割断左绳，乘气泡沿右绳弧线升空，看准时机戳破气泡！",
    hintEn: "Cut left rope, float along the right arc, then pop bubble!",
    candy: { x: 220, y: 460 },
    ropes: [
      { id: "r1", anchor: { x: 220, y: 240 }, length: 220 },
      { id: "r2", anchor: { x: 480, y: 460 }, length: 260 }
    ],
    nommy: { x: 480, y: 680 },
    stars: [
      { id: "s1", x: 220, y: 350 },
      { id: "s2", x: 360, y: 200 },
      { id: "s3", x: 480, y: 480 }
    ],
    bubbles: [
      { id: "b1", x: 220, y: 520, r: 34 }
    ],
    bellows: [],
    spikes: []
  },
  {
    id: 11,
    chapter: 2,
    name: "绳索与气泡",
    nameEn: "Rope and Bubble",
    hintZh: "气泡拉住绳子形成张力，割绳升空收星，戳破直落怪兽口！",
    hintEn: "The bubble pulls the rope upwards, cut to release and pop at apex!",
    candy: { x: 320, y: 400 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 600 }, length: 200 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 320, y: 300 },
      { id: "s2", x: 320, y: 160 },
      { id: "s3", x: 320, y: 520 }
    ],
    bubbles: [
      { id: "b1", x: 320, y: 400, r: 34, captured: true }
    ],
    bellows: [],
    spikes: []
  },
  {
    id: 12,
    chapter: 2,
    name: "双重气泡接力",
    nameEn: "Double Bubble",
    hintZh: "戳破第一个气泡，下落途中再次进入气泡",
    hintEn: "Pop first bubble to drop into the second",
    candy: { x: 320, y: 160 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 60 }, length: 100 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 320, y: 240 },
      { id: "s2", x: 320, y: 410 },
      { id: "s3", x: 320, y: 590 }
    ],
    bubbles: [
      { id: "b1", x: 320, y: 320, r: 34 },
      { id: "b2", x: 320, y: 500, r: 34 }
    ],
    bellows: [],
    spikes: []
  },
  {
    id: 13,
    chapter: 2,
    name: "倾斜上浮",
    nameEn: "Diagonal Lift",
    hintZh: "摆动中撞进气泡，斜向飘过三颗星",
    hintEn: "Catch the bubble on the swing for diagonal float",
    candy: { x: 160, y: 360 },
    ropes: [
      { id: "r1", anchor: { x: 280, y: 160 }, length: 230 }
    ],
    nommy: { x: 500, y: 680 },
    stars: [
      { id: "s1", x: 280, y: 420 },
      { id: "s2", x: 400, y: 240 },
      { id: "s3", x: 500, y: 400 }
    ],
    bubbles: [
      { id: "b1", x: 320, y: 400, r: 34 }
    ],
    bellows: [],
    spikes: []
  },
  {
    id: 14,
    chapter: 2,
    name: "高台怪兽",
    nameEn: "Perched Monster",
    hintZh: "怪兽在高台上！利用气泡与摆动升上去喂它",
    hintEn: "Nommy is perched up high! Float candy up to it",
    candy: { x: 200, y: 520 },
    ropes: [
      { id: "r1", anchor: { x: 200, y: 340 }, length: 180 },
      { id: "r2", anchor: { x: 460, y: 520 }, length: 260 }
    ],
    nommy: { x: 460, y: 250 },
    stars: [
      { id: "s1", x: 230, y: 400 },
      { id: "s2", x: 330, y: 300 },
      { id: "s3", x: 420, y: 260 }
    ],
    bubbles: [
      { id: "b1", x: 200, y: 520, r: 34, captured: true }
    ],
    bellows: [],
    spikes: []
  },
  {
    id: 15,
    chapter: 2,
    name: "悬空刹车",
    nameEn: "Mid-Air Brake",
    hintZh: "下落速度过快会错过怪兽，在半空进气泡刹车",
    hintEn: "Use bubble to slow down the falling candy",
    candy: { x: 320, y: 160 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 60 }, length: 100 }
    ],
    nommy: { x: 320, y: 690 },
    stars: [
      { id: "s1", x: 320, y: 260 },
      { id: "s2", x: 320, y: 420 },
      { id: "s3", x: 320, y: 560 }
    ],
    bubbles: [
      { id: "b1", x: 320, y: 360, r: 34 }
    ],
    bellows: [],
    spikes: []
  },
  {
    id: 16,
    chapter: 2,
    name: "气泡交响曲",
    nameEn: "Bubble Symphony",
    hintZh: "割断左绳随右绳摆动入泡，待升至怪兽上方戳破气泡割断右绳！",
    hintEn: "Swing into bubble, float above Nommy, then pop and cut!",
    candy: { x: 180, y: 290 },
    ropes: [
      { id: "r1", anchor: { x: 180, y: 120 }, length: 170 },
      { id: "r2", anchor: { x: 280, y: 140 }, length: 180 }
    ],
    nommy: { x: 400, y: 680 },
    stars: [
      { id: "s1", x: 220, y: 310 },
      { id: "s2", x: 360, y: 200 },
      { id: "s3", x: 400, y: 480 }
    ],
    bubbles: [
      { id: "b1", x: 280, y: 320, r: 36 }
    ],
    bellows: [],
    spikes: []
  },

  // ==========================================
  // 第三章：气囊风暴 (17~24)
  // ==========================================
  {
    id: 17,
    chapter: 3,
    name: "微风初起",
    nameEn: "First Breeze",
    hintZh: "点击吹气皮囊，喷射风力改变糖果方向",
    hintEn: "Tap bellows to blow air and push candy",
    candy: { x: 320, y: 320 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 120 }, length: 200 }
    ],
    nommy: { x: 500, y: 680 },
    stars: [
      { id: "s1", x: 400, y: 340 },
      { id: "s2", x: 480, y: 420 },
      { id: "s3", x: 500, y: 560 }
    ],
    bubbles: [],
    bellows: [
      { id: "bel1", x: 160, y: 320, angle: 0, force: 380 }
    ],
    spikes: []
  },
  {
    id: 18,
    chapter: 3,
    name: "双向对吹",
    nameEn: "Cross Winds",
    hintZh: "左右两个皮囊，微调糖果精准落入口中",
    hintEn: "Use left and right bellows to steer the candy",
    candy: { x: 320, y: 220 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 80 }, length: 140 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 220, y: 360 },
      { id: "s2", x: 420, y: 360 },
      { id: "s3", x: 320, y: 520 }
    ],
    bubbles: [],
    bellows: [
      { id: "bel1", x: 120, y: 360, angle: 0, force: 320 },
      { id: "bel2", x: 520, y: 360, angle: Math.PI, force: 320 }
    ],
    spikes: []
  },
  {
    id: 19,
    chapter: 3,
    name: "气囊推气泡",
    nameEn: "Bellows & Bubble",
    hintZh: "气泡中的糖果极轻，轻轻一吹就能飘很远",
    hintEn: "Candy in bubble is light, blows easily",
    candy: { x: 200, y: 440 },
    ropes: [
      { id: "r1", anchor: { x: 200, y: 260 }, length: 180 }
    ],
    nommy: { x: 500, y: 680 },
    stars: [
      { id: "s1", x: 200, y: 320 },
      { id: "s2", x: 360, y: 240 },
      { id: "s3", x: 500, y: 450 }
    ],
    bubbles: [
      { id: "b1", x: 200, y: 440, r: 34, captured: true }
    ],
    bellows: [
      { id: "bel1", x: 100, y: 260, angle: 0, force: 350 }
    ],
    spikes: []
  },
  {
    id: 20,
    chapter: 3,
    name: "高空接力吹",
    nameEn: "Upward Boost",
    hintZh: "向上斜吹皮囊，将糖果推上更高处",
    hintEn: "Blow diagonally upward to reach upper stars",
    candy: { x: 180, y: 320 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 140 }, length: 230 }
    ],
    nommy: { x: 460, y: 680 },
    stars: [
      { id: "s1", x: 280, y: 380 },
      { id: "s2", x: 420, y: 260 },
      { id: "s3", x: 460, y: 500 }
    ],
    bubbles: [],
    bellows: [
      { id: "bel1", x: 140, y: 460, angle: -Math.PI / 4, force: 420 }
    ],
    spikes: []
  },
  {
    id: 21,
    chapter: 3,
    name: "三段阶梯",
    nameEn: "Triple Cascade",
    hintZh: "三个皮囊顺次吹送，完成精彩连击",
    hintEn: "Tap three bellows in sequence for a sweet combo",
    candy: { x: 160, y: 220 },
    ropes: [
      { id: "r1", anchor: { x: 160, y: 80 }, length: 140 }
    ],
    nommy: { x: 500, y: 690 },
    stars: [
      { id: "s1", x: 280, y: 260 },
      { id: "s2", x: 400, y: 380 },
      { id: "s3", x: 500, y: 520 }
    ],
    bubbles: [],
    bellows: [
      { id: "bel1", x: 100, y: 220, angle: 0, force: 340 },
      { id: "bel2", x: 220, y: 340, angle: 0, force: 340 },
      { id: "bel3", x: 340, y: 460, angle: 0, force: 340 }
    ],
    spikes: []
  },
  {
    id: 22,
    chapter: 3,
    name: "气囊大回旋",
    nameEn: "Whirlwind Loop",
    hintZh: "吹风加速钟摆，蓄积巨大角动能",
    hintEn: "Blow to amplify swing momentum",
    candy: { x: 320, y: 360 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 140 }, length: 220 }
    ],
    nommy: { x: 480, y: 680 },
    stars: [
      { id: "s1", x: 180, y: 300 },
      { id: "s2", x: 460, y: 300 },
      { id: "s3", x: 480, y: 520 }
    ],
    bubbles: [],
    bellows: [
      { id: "bel1", x: 140, y: 380, angle: 0, force: 380 }
    ],
    spikes: []
  },
  {
    id: 23,
    chapter: 3,
    name: "气囊气泡接力赛",
    nameEn: "Bellows Relay",
    hintZh: "吹动气泡避开障碍，在最佳位置破泡",
    hintEn: "Blow bubble into position and pop cleanly",
    candy: { x: 180, y: 480 },
    ropes: [
      { id: "r1", anchor: { x: 180, y: 280 }, length: 200 }
    ],
    nommy: { x: 460, y: 680 },
    stars: [
      { id: "s1", x: 180, y: 340 },
      { id: "s2", x: 320, y: 200 },
      { id: "s3", x: 460, y: 420 }
    ],
    bubbles: [
      { id: "b1", x: 180, y: 480, r: 34, captured: true }
    ],
    bellows: [
      { id: "bel1", x: 80, y: 280, angle: 0, force: 380 }
    ],
    spikes: []
  },
  {
    id: 24,
    chapter: 3,
    name: "风暴之巅",
    nameEn: "Storm Peak",
    hintZh: "在暴风吹拂中驾驭糖果飞跃终点",
    hintEn: "Master the gusty winds to reach the goal",
    candy: { x: 180, y: 260 },
    ropes: [
      { id: "r1", anchor: { x: 180, y: 100 }, length: 160 },
      { id: "r2", anchor: { x: 460, y: 120 }, length: 320 }
    ],
    nommy: { x: 480, y: 680 },
    stars: [
      { id: "s1", x: 260, y: 360 },
      { id: "s2", x: 360, y: 280 },
      { id: "s3", x: 480, y: 480 }
    ],
    bubbles: [],
    bellows: [
      { id: "bel1", x: 120, y: 420, angle: -Math.PI / 6, force: 400 }
    ],
    spikes: []
  },

  // ==========================================
  // 第四章：尖刺迷阵 (25~32)
  // ==========================================
  {
    id: 25,
    chapter: 4,
    name: "危险尖刺",
    nameEn: "Hazard Ahead",
    hintZh: "千万不要碰触尖刺！看准摆动空隙切断",
    hintEn: "Avoid the spikes! Cut when path is clear",
    candy: { x: 200, y: 300 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 120 }, length: 220 }
    ],
    nommy: { x: 460, y: 680 },
    stars: [
      { id: "s1", x: 240, y: 400 },
      { id: "s2", x: 360, y: 420 },
      { id: "s3", x: 460, y: 540 }
    ],
    bubbles: [],
    bellows: [],
    spikes: [
      { id: "sp1", x: 320, y: 470, w: 90, h: 26 }
    ]
  },
  {
    id: 26,
    chapter: 4,
    name: "针尖对麦芒",
    nameEn: "Needle's Eye",
    hintZh: "糖果必须精准穿过两侧尖刺狭缝",
    hintEn: "Drop precisely between the spike clusters",
    candy: { x: 320, y: 200 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 80 }, length: 120 }
    ],
    nommy: { x: 320, y: 690 },
    stars: [
      { id: "s1", x: 320, y: 320 },
      { id: "s2", x: 320, y: 440 },
      { id: "s3", x: 320, y: 560 }
    ],
    bubbles: [],
    bellows: [],
    spikes: [
      { id: "sp1", x: 190, y: 380, w: 90, h: 26 },
      { id: "sp2", x: 450, y: 380, w: 90, h: 26 }
    ]
  },
  {
    id: 27,
    chapter: 4,
    name: "尖刺底盘",
    nameEn: "Spike Floor",
    hintZh: "小怪兽在尖刺右侧，必须划出大弧线飞跃",
    hintEn: "Leap over the spike pit with a wide swing",
    candy: { x: 160, y: 340 },
    ropes: [
      { id: "r1", anchor: { x: 260, y: 140 }, length: 220 }
    ],
    nommy: { x: 500, y: 680 },
    stars: [
      { id: "s1", x: 260, y: 400 },
      { id: "s2", x: 380, y: 320 },
      { id: "s3", x: 500, y: 480 }
    ],
    bubbles: [],
    bellows: [
      { id: "bel1", x: 100, y: 420, angle: -Math.PI / 6, force: 440 }
    ],
    spikes: [
      { id: "sp1", x: 320, y: 680, w: 140, h: 30 }
    ]
  },
  {
    id: 28,
    chapter: 4,
    name: "气泡避刺",
    nameEn: "Bubble Dodging",
    hintZh: "气泡触碰尖刺会刺破！利用气囊吹离尖刺",
    hintEn: "Spikes pop bubbles! Blow away from spikes",
    candy: { x: 200, y: 500 },
    ropes: [
      { id: "r1", anchor: { x: 200, y: 300 }, length: 200 }
    ],
    nommy: { x: 480, y: 680 },
    stars: [
      { id: "s1", x: 200, y: 380 },
      { id: "s2", x: 340, y: 220 },
      { id: "s3", x: 480, y: 460 }
    ],
    bubbles: [
      { id: "b1", x: 200, y: 500, r: 34, captured: true }
    ],
    bellows: [
      { id: "bel1", x: 100, y: 320, angle: 0, force: 380 }
    ],
    spikes: [
      { id: "sp1", x: 200, y: 160, w: 100, h: 26 }
    ]
  },
  {
    id: 29,
    chapter: 4,
    name: "两难抉择",
    nameEn: "Dilemma",
    hintZh: "左有悬刺右有悬绳，先荡左收星再向右飞",
    hintEn: "Swing left for the star, then cut right to escape",
    candy: { x: 320, y: 340 },
    ropes: [
      { id: "r1", anchor: { x: 180, y: 160 }, length: 230 },
      { id: "r2", anchor: { x: 460, y: 160 }, length: 230 }
    ],
    nommy: { x: 480, y: 680 },
    stars: [
      { id: "s1", x: 200, y: 420 },
      { id: "s2", x: 320, y: 460 },
      { id: "s3", x: 480, y: 520 }
    ],
    bubbles: [],
    bellows: [],
    spikes: [
      { id: "sp1", x: 320, y: 540, w: 90, h: 26 }
    ]
  },
  {
    id: 30,
    chapter: 4,
    name: "针尖穿行",
    nameEn: "Thread the Needle",
    hintZh: "上浮途中快速戳破气泡，防止撞上顶棚尖刺",
    hintEn: "Pop bubble in time before hitting ceiling spikes",
    candy: { x: 220, y: 460 },
    ropes: [
      { id: "r1", anchor: { x: 220, y: 260 }, length: 200 }
    ],
    nommy: { x: 440, y: 680 },
    stars: [
      { id: "s1", x: 220, y: 340 },
      { id: "s2", x: 330, y: 240 },
      { id: "s3", x: 440, y: 460 }
    ],
    bubbles: [
      { id: "b1", x: 220, y: 460, r: 34, captured: true }
    ],
    bellows: [
      { id: "bel1", x: 110, y: 340, angle: 0, force: 350 }
    ],
    spikes: [
      { id: "sp1", x: 330, y: 140, w: 120, h: 26 }
    ]
  },
  {
    id: 31,
    chapter: 4,
    name: "险象环生",
    nameEn: "Close Call",
    hintZh: "利用尖刺上方的气流，将糖果托送过危险区",
    hintEn: "Rely on the updraft to float safe from spikes",
    candy: { x: 160, y: 280 },
    ropes: [
      { id: "r1", anchor: { x: 160, y: 100 }, length: 180 },
      { id: "r2", anchor: { x: 480, y: 120 }, length: 360 }
    ],
    nommy: { x: 480, y: 690 },
    stars: [
      { id: "s1", x: 240, y: 360 },
      { id: "s2", x: 360, y: 380 },
      { id: "s3", x: 480, y: 520 }
    ],
    bubbles: [],
    bellows: [
      { id: "bel1", x: 280, y: 520, angle: -Math.PI / 2, force: 380 }
    ],
    spikes: [
      { id: "sp1", x: 320, y: 580, w: 110, h: 28 }
    ]
  },
  {
    id: 32,
    chapter: 4,
    name: "纸盒终局",
    nameEn: "Cardboard Finale",
    hintZh: "融会贯通四大机制，给小怪兽奉上最棒的盛宴！",
    hintEn: "Master all mechanics to deliver the ultimate treat!",
    candy: { x: 180, y: 300 },
    ropes: [
      { id: "r1", anchor: { x: 180, y: 120 }, length: 180 },
      { id: "r2", anchor: { x: 340, y: 120 }, length: 245 },
      { id: "r3", anchor: { x: 480, y: 160 }, length: 335 }
    ],
    nommy: { x: 480, y: 690 },
    stars: [
      { id: "s1", x: 180, y: 400 },
      { id: "s2", x: 340, y: 320 },
      { id: "s3", x: 480, y: 480 }
    ],
    bubbles: [
      { id: "b1", x: 260, y: 420, r: 34 }
    ],
    bellows: [
      { id: "bel1", x: 100, y: 360, angle: 0, force: 360 }
    ],
    spikes: [
      { id: "sp1", x: 340, y: 540, w: 100, h: 26 }
    ]
  },

  // ==========================================
  // 第五章：一刀大师挑战 (33~40)
  // 特殊约束：每关只能划切一刀 (cutsAllowed = 1)
  // ==========================================
  {
    id: 33,
    chapter: 5,
    name: "双斩齐落",
    nameEn: "Double Sever",
    hintZh: "一刀同时划断两条绳索！糖果直落下口",
    hintEn: "Slice through both ropes in one single cut!",
    cutsAllowed: 1,
    candy: { x: 320, y: 320 },
    ropes: [
      { id: "r1", anchor: { x: 260, y: 160 }, length: 170 },
      { id: "r2", anchor: { x: 380, y: 160 }, length: 170 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 320, y: 420 },
      { id: "s2", x: 320, y: 510 },
      { id: "s3", x: 320, y: 600 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 34,
    chapter: 5,
    name: "孤刃单摆",
    nameEn: "Lone Pivot",
    hintZh: "切断右绳，左绳带动糖果大摆动划过三星入喉",
    hintEn: "Cut the right rope to let the left rope swing through all stars",
    cutsAllowed: 1,
    candy: { x: 440, y: 340 },
    ropes: [
      { id: "r1", anchor: { x: 200, y: 160 }, length: 300 },
      { id: "r2", anchor: { x: 500, y: 220 }, length: 135 }
    ],
    nommy: { x: 200, y: 460 },
    stars: [
      { id: "s1", x: 380, y: 400 },
      { id: "s2", x: 310, y: 440 },
      { id: "s3", x: 240, y: 460 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 35,
    chapter: 5,
    name: "三线齐断",
    nameEn: "Triple Slash",
    hintZh: "一道横切划过三根绳索！物理重力完成收星",
    hintEn: "One horizontal slash cuts all three ropes at once!",
    cutsAllowed: 1,
    candy: { x: 320, y: 300 },
    ropes: [
      { id: "r1", anchor: { x: 180, y: 140 }, length: 210 },
      { id: "r2", anchor: { x: 320, y: 100 }, length: 200 },
      { id: "r3", anchor: { x: 460, y: 140 }, length: 210 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 320, y: 390 },
      { id: "s2", x: 320, y: 480 },
      { id: "s3", x: 320, y: 570 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 36,
    chapter: 5,
    name: "一刀入泡",
    nameEn: "Drop & Float",
    hintZh: "划断悬索，糖果落入气泡自动上升入怪兽口",
    hintEn: "Cut the rope to drop candy into the bubble, floating into Nommy",
    cutsAllowed: 1,
    candy: { x: 320, y: 240 },
    ropes: [
      { id: "r1", anchor: { x: 320, y: 100 }, length: 140 }
    ],
    nommy: { x: 320, y: 120 },
    stars: [
      { id: "s1", x: 320, y: 320 },
      { id: "s2", x: 320, y: 420 },
      { id: "s3", x: 320, y: 200 }
    ],
    bubbles: [
      { id: "b1", x: 320, y: 420, r: 34 }
    ],
    bellows: [],
    spikes: []
  },
  {
    id: 37,
    chapter: 5,
    name: "逆向反弹",
    nameEn: "Counter Rebound",
    hintZh: "切断左侧张紧绳索，右侧绳索将糖果弹向怪兽",
    hintEn: "Cut left tension rope, slingshotting rightward",
    cutsAllowed: 1,
    candy: { x: 220, y: 320 },
    ropes: [
      { id: "r1", anchor: { x: 120, y: 240 }, length: 130 },
      { id: "r2", anchor: { x: 440, y: 140 }, length: 284 }
    ],
    nommy: { x: 440, y: 424 },
    stars: [
      { id: "s1", x: 280, y: 380 },
      { id: "s2", x: 340, y: 415 },
      { id: "s3", x: 400, y: 424 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 38,
    chapter: 5,
    name: "抛物飞跃",
    nameEn: "Parabolic Flight",
    hintZh: "单切右侧支撑，左侧钟摆将糖果抛向对角怪兽",
    hintEn: "Sever the right support, swinging candy across the arena",
    cutsAllowed: 1,
    candy: { x: 420, y: 300 },
    ropes: [
      { id: "r1", anchor: { x: 180, y: 120 }, length: 300 },
      { id: "r2", anchor: { x: 480, y: 180 }, length: 140 }
    ],
    nommy: { x: 180, y: 420 },
    stars: [
      { id: "s1", x: 360, y: 375 },
      { id: "s2", x: 280, y: 410 },
      { id: "s3", x: 220, y: 420 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 39,
    chapter: 5,
    name: "四弦齐斩",
    nameEn: "Quad Cut",
    hintZh: "一柄利刃斜向划破四根交错的丝弦！",
    hintEn: "Slice all four crossing strings in one diagonal swipe!",
    cutsAllowed: 1,
    candy: { x: 320, y: 300 },
    ropes: [
      { id: "r1", anchor: { x: 160, y: 120 }, length: 240 },
      { id: "r2", anchor: { x: 240, y: 100 }, length: 220 },
      { id: "r3", anchor: { x: 400, y: 100 }, length: 220 },
      { id: "r4", anchor: { x: 480, y: 120 }, length: 240 }
    ],
    nommy: { x: 320, y: 680 },
    stars: [
      { id: "s1", x: 320, y: 380 },
      { id: "s2", x: 320, y: 470 },
      { id: "s3", x: 320, y: 560 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  },
  {
    id: 40,
    chapter: 5,
    name: "大师绝唱",
    nameEn: "Grandmaster",
    hintZh: "唯一一刀！触发完美向心摆动与下落接力，加冕大师",
    hintEn: "The ultimate one-cut! Trigger perfect swing mechanics",
    cutsAllowed: 1,
    candy: { x: 480, y: 300 },
    ropes: [
      { id: "r1", anchor: { x: 240, y: 140 }, length: 290 },
      { id: "r2", anchor: { x: 520, y: 180 }, length: 130 }
    ],
    nommy: { x: 240, y: 430 },
    stars: [
      { id: "s1", x: 410, y: 385 },
      { id: "s2", x: 330, y: 422 },
      { id: "s3", x: 270, y: 430 }
    ],
    bubbles: [],
    bellows: [],
    spikes: []
  }
];

export function getLevelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function getChapterByLevelId(levelId) {
  return CHAPTERS.find((ch) => levelId >= ch.range[0] && levelId <= ch.range[1]) ?? CHAPTERS[0];
}
