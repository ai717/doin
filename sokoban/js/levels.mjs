// filepath: games/sokoban/js/levels.mjs
// 关卡库：5 章 × 10 关 = 50 关渐进推箱子。
// parPushes / parMoves 由 x/sokoban/solve-levels.mjs 用 BFS 最优求解器实算后写回，
// 数学上保证每关可解、目标值真实可达（推数优先、步数次级）。
// 地图字符：'#' 墙 | ' ' 地面 | '.' 目标 | '$' 箱子 | '@' 玩家。

export const CHAPTERS = [
  { id: "c1", nameZh: "木屋初识", nameEn: "Cabin Basics", lo: 1, hi: 10, mottoZh: "认识箱子与目标", mottoEn: "Boxes & goals 101" },
  { id: "c2", nameZh: "庭院通路", nameEn: "Courtyard Passages", lo: 11, hi: 20, mottoZh: "走廊直推与绕行", mottoEn: "Corridors & detours" },
  { id: "c3", nameZh: "石巷迴廊", nameEn: "Stone Alleys", lo: 21, hi: 30, mottoZh: "多箱并行与让路", mottoEn: "Traffic & yielding" },
  { id: "c4", nameZh: "古堡密库", nameEn: "Castle Vaults", lo: 31, hi: 40, mottoZh: "隔断回廊与暂存", mottoEn: "Partitions & staging" },
  { id: "c5", nameZh: "大师残局", nameEn: "Master Endgames", lo: 41, hi: 50, mottoZh: "紧凑残局与死角诱惑", mottoEn: "Compact traps" },
];

export const LEVELS = [
  {
    "id": "s1",
    "chapter": 1,
    "nameZh": "初试身手",
    "nameEn": "First Push",
    "parPushes": 2,
    "map": [
      "#####",
      "#.  #",
      "# $@#",
      "#   #",
      "#####"
    ]
  },
  {
    "id": "s2",
    "chapter": 1,
    "nameZh": "绕到左侧",
    "nameEn": "Walk Around",
    "parPushes": 2,
    "map": [
      "######",
      "#    #",
      "#@$ .#",
      "#    #",
      "######"
    ]
  },
  {
    "id": "s3",
    "chapter": 1,
    "nameZh": "L 形走廊",
    "nameEn": "L-Shape",
    "parPushes": 4,
    "map": [
      "######",
      "#.$ .#",
      "#    #",
      "#  $@#",
      "#    #",
      "######"
    ]
  },
  {
    "id": "s4",
    "chapter": 1,
    "nameZh": "左右开工",
    "nameEn": "Two Errands",
    "parPushes": 5,
    "map": [
      "#######",
      "#.  . #",
      "# $   #",
      "#  $  #",
      "#  @  #",
      "#######"
    ]
  },
  {
    "id": "s5",
    "chapter": 1,
    "nameZh": "前后接力",
    "nameEn": "Relay",
    "parPushes": 4,
    "map": [
      "#######",
      "#.  . #",
      "# $$  #",
      "# @   #",
      "#######"
    ]
  },
  {
    "id": "s6",
    "chapter": 1,
    "nameZh": "斜向归位",
    "nameEn": "Corner Job",
    "parPushes": 4,
    "map": [
      "#######",
      "#.   .#",
      "#@$ $ #",
      "#     #",
      "#######"
    ]
  },
  {
    "id": "s7",
    "chapter": 1,
    "nameZh": "长线推进",
    "nameEn": "Long Haul",
    "parPushes": 4,
    "map": [
      "########",
      "#.    .#",
      "# $  $@#",
      "#      #",
      "########"
    ]
  },
  {
    "id": "s8",
    "chapter": 1,
    "nameZh": "三箱初聚",
    "nameEn": "Trio",
    "parPushes": 4,
    "map": [
      "#########",
      "#.   .$.#",
      "#$    $@#",
      "#       #",
      "#       #",
      "#########"
    ]
  },
  {
    "id": "s9",
    "chapter": 1,
    "nameZh": "右路长途",
    "nameEn": "Right Run",
    "parPushes": 4,
    "map": [
      "#########",
      "#.   + .#",
      "#$   $$ #",
      "#       #",
      "#       #",
      "#########"
    ]
  },
  {
    "id": "s10",
    "chapter": 1,
    "nameZh": "让路先行",
    "nameEn": "Yield First",
    "parPushes": 5,
    "map": [
      "##########",
      "#. $@. ..#",
      "#    $ $$#",
      "#        #",
      "##########"
    ]
  },
  {
    "id": "s11",
    "chapter": 2,
    "nameZh": "三人成行",
    "nameEn": "Three in a Row",
    "parPushes": 5,
    "map": [
      "##########",
      "# .  .  .#",
      "# $@$  $ #",
      "#        #",
      "##########"
    ]
  },
  {
    "id": "s12",
    "chapter": 2,
    "nameZh": "折角走廊",
    "nameEn": "Kink",
    "parPushes": 6,
    "map": [
      "#########",
      "#. $ .. #",
      "#     $ #",
      "#@$     #",
      "#       #",
      "#########"
    ]
  },
  {
    "id": "s13",
    "chapter": 2,
    "nameZh": "同列双星",
    "nameEn": "Twin Columns",
    "parPushes": 6,
    "map": [
      "########",
      "#. $ ..#",
      "#     $#",
      "#@$    #",
      "#      #",
      "########"
    ]
  },
  {
    "id": "s14",
    "chapter": 2,
    "nameZh": "各回各家",
    "nameEn": "Go Home",
    "parPushes": 6,
    "map": [
      "##########",
      "#. $. .  #",
      "#        #",
      "# $  @$  #",
      "#        #",
      "##########"
    ]
  },
  {
    "id": "s15",
    "chapter": 2,
    "nameZh": "四角呼应",
    "nameEn": "Four Corners",
    "parPushes": 6,
    "map": [
      "##########",
      "#.  .$..##",
      "#@$    $##",
      "#     $ ##",
      "#       ##",
      "##########"
    ]
  },
  {
    "id": "s16",
    "chapter": 2,
    "nameZh": "斜线客串",
    "nameEn": "Diagonals",
    "parPushes": 6,
    "map": [
      "##########",
      "#.$  . ..#",
      "#     $@$#",
      "#    $   #",
      "#        #",
      "##########"
    ]
  },
  {
    "id": "s17",
    "chapter": 2,
    "nameZh": "错位入位",
    "nameEn": "Off-Goal",
    "parPushes": 7,
    "map": [
      "##########",
      "#..$ .  .#",
      "#$    $  #",
      "#   @$   #",
      "#        #",
      "##########"
    ]
  },
  {
    "id": "s18",
    "chapter": 2,
    "nameZh": "四箱分工",
    "nameEn": "Quartet",
    "parPushes": 7,
    "map": [
      "#########",
      "#.@$. ..#",
      "# $  $$##",
      "#       #",
      "#       #",
      "#########"
    ]
  },
  {
    "id": "s19",
    "chapter": 2,
    "nameZh": "品字三箱",
    "nameEn": "Triangle",
    "parPushes": 7,
    "map": [
      "#########",
      "#+$.  ..#",
      "#$  $ $ #",
      "#       #",
      "#########"
    ]
  },
  {
    "id": "s20",
    "chapter": 2,
    "nameZh": "十字路口",
    "nameEn": "Crossroads",
    "parPushes": 8,
    "map": [
      "###########",
      "#.  . . . #",
      "#     $$ ##",
      "# $ $    ##",
      "#   @    ##",
      "###########"
    ]
  },
  {
    "id": "s21",
    "chapter": 3,
    "nameZh": "四角巡礼",
    "nameEn": "Perimeter",
    "parPushes": 9,
    "map": [
      "###########",
      "#.  $+$ ..#",
      "#### $   $#",
      "#  ####   #",
      "#         #",
      "###########"
    ]
  },
  {
    "id": "s22",
    "chapter": 3,
    "nameZh": "五箱开场",
    "nameEn": "Quintet",
    "parPushes": 6,
    "map": [
      "############",
      "#. $@. ... #",
      "#### $ $$$##",
      "#         ##",
      "#         ##",
      "############"
    ]
  },
  {
    "id": "s23",
    "chapter": 3,
    "nameZh": "回廊内推",
    "nameEn": "Inner Loop",
    "parPushes": 9,
    "map": [
      "###########",
      "#. $.# ..##",
      "#### # $  #",
      "#  $@# $  #",
      "#         #",
      "###########"
    ]
  },
  {
    "id": "s24",
    "chapter": 3,
    "nameZh": "双排归位",
    "nameEn": "Two Ranks",
    "parPushes": 8,
    "map": [
      "###########",
      "#.$.  . ..#",
      "####  $ $$#",
      "#    $@   #",
      "#         #",
      "###########"
    ]
  },
  {
    "id": "s25",
    "chapter": 3,
    "nameZh": "岔路分流",
    "nameEn": "Fork",
    "parPushes": 6,
    "map": [
      "##########",
      "#.$ .$ ..#",
      "####     #",
      "#  ####$$#",
      "#       @#",
      "##########"
    ]
  },
  {
    "id": "s26",
    "chapter": 3,
    "nameZh": "之字走廊",
    "nameEn": "Zigzag",
    "parPushes": 7,
    "map": [
      "##########",
      "# .$ . ..#",
      "#### $$  #",
      "#      $ #",
      "#      @ #",
      "##########"
    ]
  },
  {
    "id": "s27",
    "chapter": 3,
    "nameZh": "中央仓库",
    "nameEn": "Storehouse",
    "parPushes": 11,
    "map": [
      "###########",
      "#. $.#..+##",
      "#### #$$$ #",
      "# $  #    #",
      "#         #",
      "###########"
    ]
  },
  {
    "id": "s28",
    "chapter": 3,
    "nameZh": "六箱交错",
    "nameEn": "Six Shuffle",
    "parPushes": 16,
    "map": [
      "############",
      "#. $.. .. .#",
      "####@$  $ $#",
      "#    #$ $  #",
      "# ## #     #",
      "############"
    ]
  },
  {
    "id": "s29",
    "chapter": 3,
    "nameZh": "环线绕行",
    "nameEn": "Ring Road",
    "parPushes": 14,
    "map": [
      "#############",
      "#. $ . ....##",
      "#### #$ $ $ #",
      "#    #@$    #",
      "#    ## $   #",
      "#    ##     #",
      "#############"
    ]
  },
  {
    "id": "s30",
    "chapter": 3,
    "nameZh": "长廊竞速",
    "nameEn": "Long Hall",
    "parPushes": 12,
    "map": [
      "###########",
      "#.   .  ..#",
      "# $ $  $  #",
      "#    $#   #",
      "# ###@#   #",
      "###########"
    ]
  },
  {
    "id": "s31",
    "chapter": 4,
    "nameZh": "密库首钥",
    "nameEn": "Vault Key",
    "parPushes": 13,
    "map": [
      "###########",
      "#.   .$...#",
      "#    $@$  #",
      "#     #$$ #",
      "# ### #   #",
      "###########"
    ]
  },
  {
    "id": "s32",
    "chapter": 4,
    "nameZh": "双重让路",
    "nameEn": "Double Yield",
    "parPushes": 14,
    "map": [
      "############",
      "#..  . ... #",
      "#$ $ $   $ #",
      "#   ###$   #",
      "#       $  #",
      "# ####  @  #",
      "############"
    ]
  },
  {
    "id": "s33",
    "chapter": 4,
    "nameZh": "隔墙有耳",
    "nameEn": "Through Wall",
    "parPushes": 12,
    "map": [
      "###########",
      "#.  $. .. #",
      "#  $@#    #",
      "#     #$$ #",
      "# ### #   #",
      "###########"
    ]
  },
  {
    "id": "s34",
    "chapter": 4,
    "nameZh": "暂存中转",
    "nameEn": "Staging",
    "parPushes": 11,
    "map": [
      "###########",
      "#. . ... .#",
      "#$ $$     #",
      "#    $#$ $#",
      "# ###@#   #",
      "###########"
    ]
  },
  {
    "id": "s35",
    "chapter": 4,
    "nameZh": "三列长廊",
    "nameEn": "Three Lanes",
    "parPushes": 12,
    "map": [
      "###########",
      "#.  . .$..#",
      "# $       #",
      "#    $#$$ #",
      "# ###@#   #",
      "###########"
    ]
  },
  {
    "id": "s36",
    "chapter": 4,
    "nameZh": "六箱议会",
    "nameEn": "Council",
    "parPushes": 10,
    "map": [
      "#############",
      "#.. ..# ... #",
      "# $ $$# $ $##",
      "#$    # $  ##",
      "#@###      ##",
      "#############"
    ]
  },
  {
    "id": "s37",
    "chapter": 4,
    "nameZh": "回形针",
    "nameEn": "Paperclip",
    "parPushes": 11,
    "map": [
      "############",
      "#. . $.. ..#",
      "# $$  $@ $ #",
      "#      #  $#",
      "# ###  #   #",
      "############"
    ]
  },
  {
    "id": "s38",
    "chapter": 4,
    "nameZh": "双库对开",
    "nameEn": "Twin Vaults",
    "parPushes": 12,
    "map": [
      "###########",
      "#.. . ... #",
      "# $   $$$ #",
      "#$    # $ #",
      "#@### #   #",
      "###########"
    ]
  },
  {
    "id": "s39",
    "chapter": 4,
    "nameZh": "螺旋楼梯",
    "nameEn": "Spiral",
    "parPushes": 13,
    "map": [
      "###########",
      "#. . .. ..#",
      "#  $$ $ $ #",
      "#$    #$  #",
      "#@### #   #",
      "###########"
    ]
  },
  {
    "id": "s40",
    "chapter": 4,
    "nameZh": "密库大门",
    "nameEn": "Vault Gate",
    "parPushes": 12,
    "map": [
      "###########",
      "#. ...$.$.#",
      "#     $ ###",
      "#$$$###   #",
      "# @       #",
      "###########"
    ]
  },
  {
    "id": "s41",
    "chapter": 5,
    "nameZh": "残局初试",
    "nameEn": "First Endgame",
    "parPushes": 13,
    "map": [
      "##############",
      "#. $.  . ..$@#",
      "#    $     ###",
      "#  $  ###$ ###",
      "#          ###",
      "##############"
    ]
  },
  {
    "id": "s42",
    "chapter": 5,
    "nameZh": "七箱阵列",
    "nameEn": "Sevens",
    "parPushes": 18,
    "map": [
      "###########",
      "#. .  ..$+#",
      "#   $   ###",
      "# $$### $ #",
      "#         #",
      "###########"
    ]
  },
  {
    "id": "s43",
    "chapter": 5,
    "nameZh": "双环互锁",
    "nameEn": "Interlock",
    "parPushes": 15,
    "map": [
      "############",
      "#.  .@$. ..#",
      "# $    $ ###",
      "# $  ### $ #",
      "#          #",
      "############"
    ]
  },
  {
    "id": "s44",
    "chapter": 5,
    "nameZh": "死角诱惑",
    "nameEn": "Dead End Bait",
    "parPushes": 15,
    "map": [
      "###########",
      "#. .$..$ .#",
      "#  $@$  ###",
      "# $ ###   #",
      "#         #",
      "###########"
    ]
  },
  {
    "id": "s45",
    "chapter": 5,
    "nameZh": "十字回廊",
    "nameEn": "Cross Halls",
    "parPushes": 16,
    "map": [
      "###########",
      "#.$. . .$+#",
      "# $     ###",
      "# $ ### $ #",
      "#         #",
      "###########"
    ]
  },
  {
    "id": "s46",
    "chapter": 5,
    "nameZh": "八箱方阵",
    "nameEn": "Octet",
    "parPushes": 14,
    "map": [
      "##############",
      "#.  . $+$.. ##",
      "#  $        ##",
      "# $  $########",
      "#            #",
      "##############"
    ]
  },
  {
    "id": "s47",
    "chapter": 5,
    "nameZh": "迷宫中心",
    "nameEn": "Maze Heart",
    "parPushes": 14,
    "map": [
      "##############",
      "#. . .  .#. ##",
      "# $ $ $@ #  ##",
      "#   $ ####$ ##",
      "#           ##",
      "##############"
    ]
  },
  {
    "id": "s48",
    "chapter": 5,
    "nameZh": "环形剧场",
    "nameEn": "Ring Stage",
    "parPushes": 17,
    "map": [
      "############",
      "#. $.  . ..#",
      "#  $     ###",
      "# $  ###$$ #",
      "#       @  #",
      "############"
    ]
  },
  {
    "id": "s49",
    "chapter": 5,
    "nameZh": "回文残局",
    "nameEn": "Palindrome",
    "parPushes": 16,
    "map": [
      "##############",
      "#.. . $.$.. ##",
      "# $  $@    ###",
      "# $ $ ########",
      "#            #",
      "##############"
    ]
  },
  {
    "id": "s50",
    "chapter": 5,
    "nameZh": "终局大师",
    "nameEn": "Grand Finale",
    "parPushes": 17,
    "map": [
      "##############",
      "#.$@$.  . . ##",
      "#  $      $ ##",
      "# $.#  .$#####",
      "#   #       ##",
      "##############"
    ]
  }
];

