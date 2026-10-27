// 残局题库：由 tools/gen-puzzles.mjs 产线生成，勿手改。
// 每关均通过求解器校验：mateIn ∈ [2,5]、唯一首着、起始无将军。tests 重跑复核。

export const PUZZLE_CHAPTERS = [
  { key: "ch_chariots", levels: ["level_1", "level_2", "level_3", "level_4", "level_5", "level_6"] },
  { key: "ch_cannon_horse", levels: ["level_7", "level_8", "level_9", "level_10", "level_11", "level_12"] },
  { key: "ch_chariot_horse", levels: ["level_13", "level_14", "level_15", "level_16", "level_17", "level_18"] },
  { key: "ch_classic", levels: ["level_19", "level_20", "level_21", "level_22", "level_23", "level_24"] },
];

export const PUZZLES = {
  "level_1": { chapter: "ch_chariots", board: "...R......P..a..R......k........c.....b...b...........................................K...", par: 2, first: [16, 13] },
  "level_2": { chapter: "ch_chariots", board: "..b..kb..............a.aR...P............c...........R................................K...", par: 2, first: [24, 6] },
  "level_3": { chapter: "ch_chariots", board: "......b......kp......a.a..................bCR..R....................K..................A..", par: 2, first: [43, 16] },
  "level_4": { chapter: "ch_chariots", board: "..ba.k.......a................................RR......C...............A.....K.............", par: 2, first: [47, 50] },
  "level_5": { chapter: "ch_chariots", board: "...aR....R...........a.k.....c...............P....................K.......................", par: 3, first: [4, 3] },
  "level_6": { chapter: "ch_chariots", board: "...aka.........R................p.........b..................R.............K..............", par: 3, first: [61, 58] },
  "level_7": { chapter: "ch_cannon_horse", board: "...akab......p........b..R....................C...........A..........................K....", par: 2, first: [46, 49] },
  "level_8": { chapter: "ch_cannon_horse", board: "..bk.abC.............a............p........................R.......K........A.............", par: 2, first: [59, 5] },
  "level_9": { chapter: "ch_cannon_horse", board: "...a.................a.k.C...........R....b.......................K.......................", par: 2, first: [66, 67] },
  "level_10": { chapter: "ch_cannon_horse", board: "..C...b..............ak.........R....p.....................................K..............", par: 3, first: [32, 31] },
  "level_11": { chapter: "ch_cannon_horse", board: "..b..a................ka.p................R.C................................K............", par: 3, first: [42, 40] },
  "level_12": { chapter: "ch_cannon_horse", board: ".............a.......k.a...............CP..............................A..............K...", par: 4, first: [40, 31] },
  "level_13": { chapter: "ch_chariot_horse", board: "..ba.ab................k......c...........R...........A.....................K.............", par: 2, first: [42, 41] },
  "level_14": { chapter: "ch_chariot_horse", board: "..bk.................aP.....................R.....................K.......................", par: 2, first: [44, 8] },
  "level_15": { chapter: "ch_chariot_horse", board: ".....ab..............a.k..........Rc..b...........................K.....................A.", par: 2, first: [66, 67] },
  "level_16": { chapter: "ch_chariot_horse", board: "...a.a................k.........RP....b......................................K...........A", par: 3, first: [32, 31] },
  "level_17": { chapter: "ch_chariot_horse", board: ".....a...............ak..........R....b...b................P...............K..............", par: 3, first: [33, 31] },
  "level_18": { chapter: "ch_chariot_horse", board: "..b..........a.R......bk....................................................K..A..........", par: 4, first: [15, 13] },
  "level_19": { chapter: "ch_classic", board: ".....a.......a.........k.....c..........R....C.........P...........K......................", par: 2, first: [40, 41] },
  "level_20": { chapter: "ch_classic", board: "..b......C...a.......a.k......R...............P...................K.......................", par: 2, first: [66, 67] },
  "level_21": { chapter: "ch_classic", board: "...a..b................k....P.........bC.......R....................................K.....", par: 2, first: [84, 85] },
  "level_22": { chapter: "ch_classic", board: "...a.a........k....C.R......P...............p......................K......A...............", par: 3, first: [19, 10] },
  "level_23": { chapter: "ch_classic", board: "..ba.a........k...........R...p.......b......C..............................K.............", par: 3, first: [26, 17] },
  "level_24": { chapter: "ch_classic", board: "..ba..b......a.......k......p...P......................R...C.................K.A..........", par: 3, first: [55, 57] },
};
