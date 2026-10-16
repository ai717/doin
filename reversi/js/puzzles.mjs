// 60 道残局题库（离线产线 tools/gen-puzzles.mjs 生成，请勿手改）。
//
// 每题 bestDiff / winningMoves 都由完美求解器穷举得到；tests/puzzles.test.mjs 会重跑
// 求解器逐题复核，题库因此不可能悄悄写错。
//
// 字段：id / chapter / chapterKey / side / board / empties / legalMoves /
//       bestDiff / winningMoves / bestLine / difficulty。
//   side         行棋方（1 = 黑，2 = 白，engine 的常量口径）
//   board        64 字符三态串，索引 = row * 8 + col（B 黑 / W 白 / . 空）
//   bestDiff     最优终局分差（行棋方视角，正数 = 赢）
//   winningMoves 全部达到最优的首手（本题恒为单元素 = 唯一解）
//   bestLine     双方都走最优的完整线（正解回放用；Pass 不入线）
//
// 数据层铁律：本文件只含数字、英文 key 与 64 字符三态串，
// 严禁任何中文字符串 —— 章节名与题面文案全部由 i18n 按 key 查表。

export const CHAPTERS = Object.freeze([
  {
    "number": 1,
    "key": "cornerstone",
    "count": 10
  },
  {
    "number": 2,
    "key": "edge-trap",
    "count": 10
  },
  {
    "number": 3,
    "key": "starve",
    "count": 10
  },
  {
    "number": 4,
    "key": "cascade",
    "count": 10
  },
  {
    "number": 5,
    "key": "comeback",
    "count": 10
  },
  {
    "number": 6,
    "key": "perfect-endgame",
    "count": 10
  }
]);

export const PUZZLES = Object.freeze([
  {"id":"p0101","chapter":1,"chapterKey":"cornerstone","side":1,"board":"B.W.BB.BBWWWWWWWBBWBWWWWBBBWBWWWBBWBWWWWWWBBBWBW.WWBBBWW.WWWBBB.","empties":6,"legalMoves":6,"bestDiff":54,"winningMoves":[63],"bestLine":[63,1,6,3,48,56],"difficulty":4},
  {"id":"p0102","chapter":1,"chapterKey":"cornerstone","side":1,"board":".WWBBBB.BWWWBBBWBWBWWWWWBBBWBBWBBBBBWWB.BWWWWWWWBWWWWWW.B.WWWWW.","empties":6,"legalMoves":6,"bestDiff":24,"winningMoves":[7],"bestLine":[7,39,0,57,55,63],"difficulty":3.4},
  {"id":"p0103","chapter":1,"chapterKey":"cornerstone","side":1,"board":".WWWWWBBBWWBWWWWWWBWBBWBWWBBBWBB.WBBWBWBWWBWBWWB.WWBWWWB.WBBB.W.","empties":6,"legalMoves":6,"bestDiff":22,"winningMoves":[0],"bestLine":[0,63,56,48,32,61],"difficulty":3.28},
  {"id":"p0104","chapter":1,"chapterKey":"cornerstone","side":1,"board":".W.WWW.WWWWWWBBBWWWWBWBBBBWWWBBBBBWWBBBBBBBWBWBBWWWW.W.B.WWWWWWB","empties":6,"legalMoves":5,"bestDiff":30,"winningMoves":[56],"bestLine":[56,6,0,54,52,2],"difficulty":3.28},
  {"id":"p0105","chapter":1,"chapterKey":"cornerstone","side":1,"board":".WWWWWWBWWWWWWB.BW.WWBBBBBWWWWBBBWBBBBWBBWWWWBBBBWWB.W.BBWWWWWW.","empties":6,"legalMoves":4,"bestDiff":36,"winningMoves":[63],"bestLine":[63,54,52,15,0,18],"difficulty":3.04},
  {"id":"p0106","chapter":1,"chapterKey":"cornerstone","side":1,"board":".BWWW.WBWWWWBWWBWWWBWBBBWBBWWWBWBBBWWBW.BBWBBWWBBBBBBWW..WWWWWW.","empties":6,"legalMoves":4,"bestDiff":24,"winningMoves":[0],"bestLine":[0,39,63,56,55,5],"difficulty":2.86},
  {"id":"p0107","chapter":1,"chapterKey":"cornerstone","side":1,"board":"WBBBWWW..BBBBBWBWWBWBBBBWWBBWWB.WWBWBBWBWWBWBBWWBWWBBBB.BWWWWW..","empties":6,"legalMoves":5,"bestDiff":20,"winningMoves":[7],"bestLine":[7,63,31,62,8,55],"difficulty":2.68},
  {"id":"p0108","chapter":1,"chapterKey":"cornerstone","side":1,"board":".WWWW.B..WWBBBBWWWWBBBBWWWWBWB.WWWBWBBBBBWWWWBWBBWWBBBBB.WWWWBBB","empties":6,"legalMoves":4,"bestDiff":18,"winningMoves":[56],"bestLine":[56,5,7,30,0,8],"difficulty":2.62},
  {"id":"p0109","chapter":1,"chapterKey":"cornerstone","side":1,"board":"WWBBBBB.BWBBWBW.BBWWBWWBBWBWWWW.BWBWWWWBBWBBWWW.BBBBBW.WBBBBBBW.","empties":6,"legalMoves":6,"bestDiff":24,"winningMoves":[7],"bestLine":[7,15,31,54,47,63],"difficulty":2.62},
  {"id":"p0110","chapter":1,"chapterKey":"cornerstone","side":1,"board":".BBBBBBB.WBWWWBB.WWWWBWBBWBWBWBB.WBWWWBBWWWWWBBB.WWWWWBB.WBBBBBB","empties":6,"legalMoves":6,"bestDiff":26,"winningMoves":[0],"bestLine":[0,8,16,32,48,56],"difficulty":2.62},
  {"id":"p0201","chapter":2,"chapterKey":"edge-trap","side":1,"board":"BBB.BB.BBBWWWWWWBBWWWB..B.WWBWWWBBWWBWWWBBBWBWWWBBWBWWW.BWWWBB..","empties":8,"legalMoves":8,"bestDiff":32,"winningMoves":[25],"bestLine":[25,3,6,62,63,55,23,22],"difficulty":4.38},
  {"id":"p0202","chapter":2,"chapterKey":"edge-trap","side":1,"board":"...BBBBB.BWWWWBWWWWWWBWWWWWWWWWWBWWWBWWWBWBWWB.WBBBBWWB.BBBB.W.B","empties":8,"legalMoves":5,"bestDiff":24,"winningMoves":[46],"bestLine":[46,55,60,1,8,0,2,62],"difficulty":4.14},
  {"id":"p0203","chapter":2,"chapterKey":"edge-trap","side":1,"board":"BBBWWWW.BBBBBWW.BBWWWBB.BBWWWBWBBWWWWBBBWWWWWWBB.WWWBBBB...WW.BW","empties":8,"legalMoves":7,"bestDiff":10,"winningMoves":[58],"bestLine":[58,57,56,61,48,23,7,15],"difficulty":4.08},
  {"id":"p0204","chapter":2,"chapterKey":"edge-trap","side":1,"board":"WB.W.BBBWWBWWWBWWWWBWBWWWWBWBWBW.BWBWBBWBWBBBWBWW.WWWBB...WWBBB.","empties":8,"legalMoves":6,"bestDiff":12,"winningMoves":[2],"bestLine":[2,4,56,32,49,57,55,63],"difficulty":4.08},
  {"id":"p0205","chapter":2,"chapterKey":"edge-trap","side":1,"board":"WWWWWWW.WWBBWWWWWBWBBWWBWBBBBWBBWBBBWWBW.B.WWB..B.WWWBBW..WWWBBB","empties":8,"legalMoves":6,"bestDiff":8,"winningMoves":[47],"bestLine":[47,46,42,40,49,57,56,7],"difficulty":4.02},
  {"id":"p0206","chapter":2,"chapterKey":"edge-trap","side":1,"board":"BBB.WWWBBBBBWWW.BBBBWWWBBBWWBBWBBWWBBBBBWBB.BBBBWWW.BWW.B.WWWW..","empties":8,"legalMoves":7,"bestDiff":46,"winningMoves":[3],"bestLine":[3,51,43,15,57,55,62,63],"difficulty":4.02},
  {"id":"p0207","chapter":2,"chapterKey":"edge-trap","side":1,"board":"BBBBBBBB.BBBBB.WWWBBBBWWBBWBBWBBBBWBWWB.BWBWWWWBBWWWWWWWBW..W...","empties":8,"legalMoves":7,"bestDiff":50,"winningMoves":[58],"bestLine":[58,39,8,59,14,63,62,61],"difficulty":3.84},
  {"id":"p0208","chapter":2,"chapterKey":"edge-trap","side":1,"board":".WWWBBBB..WWWBB.WWWWWBBB.WWBWWBBWWWWWBWBWWWWBBWBBBWBBB.BBWW.B.BB","empties":8,"legalMoves":6,"bestDiff":26,"winningMoves":[59],"bestLine":[59,15,0,54,9,8,24,61],"difficulty":3.66},
  {"id":"p0209","chapter":2,"chapterKey":"edge-trap","side":1,"board":".WWWWW...WBWBW.WBBB.BWBWBBWBWWWWBWBBBBW.BBWBWWWWBBBBWBBWBBBBBBB.","empties":8,"legalMoves":6,"bestDiff":26,"winningMoves":[19],"bestLine":[19,14,7,6,0,8,39,63],"difficulty":3.54},
  {"id":"p0210","chapter":2,"chapterKey":"edge-trap","side":1,"board":"WBBBBBWBWWBBBBWBWBBWWBWBWBBWWWWBWWWBWBWBWWWW.WBWW.WWWBWW.WB.BW..","empties":6,"legalMoves":6,"bestDiff":20,"winningMoves":[44],"bestLine":[44,59,63,62,56,49],"difficulty":3.46},
  {"id":"p0301","chapter":3,"chapterKey":"starve","side":1,"board":".WWW..WBBWWWWWW..WWWWBBB.WBWBB.WWWWBBWWWWWBBBBW.WWBBWWWW.BBBB.BB","empties":10,"legalMoves":10,"bestDiff":44,"winningMoves":[47],"bestLine":[47,30,0,16,24,56,15,4,5,61],"difficulty":5.48},
  {"id":"p0302","chapter":3,"chapterKey":"starve","side":1,"board":"BBB.WWWWBBBBWWW.BWBWWW..BWWBBW.WBBBWBWWW.WBBWWBWWWBWWWWWBBB....W","empties":10,"legalMoves":8,"bestDiff":30,"winningMoves":[40],"bestLine":[40,3,59,61,60,62,30,15,23,22],"difficulty":5.12},
  {"id":"p0303","chapter":3,"chapterKey":"starve","side":1,"board":"..B.WWWB.WWWWWBB.WWWBWBBBBBBBWWBBWBBWWBB.WWWWBBB..WWBBBB..WWWBBB","empties":10,"legalMoves":9,"bestDiff":52,"winningMoves":[57],"bestLine":[57,49,0,1,3,8,16,56,48,40],"difficulty":5.12},
  {"id":"p0304","chapter":3,"chapterKey":"starve","side":1,"board":".WBBBBBB.WB.WWWW.WBWBWW.BBBBBBWWBBWWBWW.BWBWBWWBWWWWWWWBB...BB.B","empties":10,"legalMoves":10,"bestDiff":50,"winningMoves":[11],"bestLine":[11,16,23,39,62,59,58,8,0,57],"difficulty":4.7},
  {"id":"p0305","chapter":3,"chapterKey":"starve","side":1,"board":".BBBBBBB.WWBBW.W...BBBWW.W.WWBWWWWWWBBWW.WWBBBWBWWBBWWBB.BBBBBBB","empties":10,"legalMoves":9,"bestDiff":44,"winningMoves":[14],"bestLine":[14,18,24,16,56,40,8,0,17,26],"difficulty":4.64},
  {"id":"p0306","chapter":3,"chapterKey":"starve","side":1,"board":"BBBBBBBWBBBBWBWB.WBWBWB.WWWBBWBW.WWWWWWW.B.WWWWWB..WWWWW..W.BBBB","empties":10,"legalMoves":7,"bestDiff":38,"winningMoves":[23],"bestLine":[23,49,40,32,42,56,16,50,59,57],"difficulty":4.4},
  {"id":"p0307","chapter":3,"chapterKey":"starve","side":1,"board":"BWW..WBWBBWWW.W.BWWBWWWWBWWWWBW.BWWWBW.BWWWWWWBBWBB.WBWB.BBBBBBB","empties":8,"legalMoves":8,"bestDiff":46,"winningMoves":[56],"bestLine":[56,38,13,4,3,15,31,51],"difficulty":4.08},
  {"id":"p0308","chapter":3,"chapterKey":"starve","side":1,"board":"...WWWWW..WWWWBBWWWWBBB.WWWBWBBBWWWBWBBB.WWWWBBBWWWWWBBB.BBBBBBB","empties":8,"legalMoves":6,"bestDiff":12,"winningMoves":[56],"bestLine":[56,23,40,8,9,0,1,2],"difficulty":3.84},
  {"id":"p0309","chapter":3,"chapterKey":"starve","side":1,"board":"..BBBBBBB.WBBBBB.WWBBBBBWWWWBBBB.WWBBWBB.WWWWWB.WBWWWWWWBWWWWW.W","empties":8,"legalMoves":6,"bestDiff":40,"winningMoves":[40],"bestLine":[40,32,1,47,62,16,9,0],"difficulty":3.84},
  {"id":"p0310","chapter":3,"chapterKey":"starve","side":1,"board":"..WWWWWB.W.WWWWB.WWBWWWB.WWWWWWBBBBBBBWBBWWWBWBBBWWWWBBBWWWWBBBB","empties":6,"legalMoves":6,"bestDiff":12,"winningMoves":[24],"bestLine":[24,16,10,1,0,8],"difficulty":3.64},
  {"id":"p0401","chapter":4,"chapterKey":"cascade","side":1,"board":"B.WWWW..BWWWW...WWWWWWWWWWWBBBWBWWWBBWBBW.WWWBBBWWWWWW.B.WWWWWB.","empties":10,"legalMoves":6,"bestDiff":38,"winningMoves":[56],"bestLine":[56,63,54,41,1,6,13,14,7,15],"difficulty":7.04},
  {"id":"p0402","chapter":4,"chapterKey":"cascade","side":1,"board":".BBBBB.W.WWWWWWW..WWWWBBBBWWWWBB.WWWWBBBBWWWBWBB.WWWW.WB.W.WWWWW","empties":10,"legalMoves":6,"bestDiff":22,"winningMoves":[17],"bestLine":[17,0,6,32,56,16,48,53,58,8],"difficulty":5.72},
  {"id":"p0403","chapter":4,"chapterKey":"cascade","side":1,"board":"BBBBBB..W.BWWWW.WWBBWBWBWWWBBWWW.WBBBBWW..BWWBWWWBWWWWWWBWWWWWW.","empties":8,"legalMoves":6,"bestDiff":34,"winningMoves":[63],"bestLine":[63,9,32,40,41,7,15,6],"difficulty":5.1},
  {"id":"p0404","chapter":4,"chapterKey":"cascade","side":1,"board":"WWWWWWBBWWWWWWWBWWBWBWWBWWWWBWWB.WWWWBWBWWWWWWWBWB.WWBWB...WWWW.","empties":6,"legalMoves":4,"bestDiff":6,"winningMoves":[50],"bestLine":[50,56,32,58,57,63],"difficulty":5.02},
  {"id":"p0405","chapter":4,"chapterKey":"cascade","side":1,"board":"BBBBB...WBWWWWWWWWBBWWW..BWWBWWWWBWWWBWW.BBWWBWW.BWWWWWW.BBWWWWB","empties":8,"legalMoves":5,"bestDiff":14,"winningMoves":[23],"bestLine":[23,56,24,48,40,7,6,5],"difficulty":4.98},
  {"id":"p0406","chapter":4,"chapterKey":"cascade","side":1,"board":".WWBBB..W.WW.BBBWWWWWBBBWWBBBWBBWWBBBWBBWWWWWWWBB.WWWWWW.BWWWWW.","empties":8,"legalMoves":5,"bestDiff":30,"winningMoves":[63],"bestLine":[63,56,0,6,49,12,7,9],"difficulty":4.62},
  {"id":"p0407","chapter":4,"chapterKey":"cascade","side":1,"board":"WWWWW.W.BWWWWWW.BBWWWBWWBBBBBWW.WBWBWW.WWWBWWWWB.WWWWWWBBWBBBBBB","empties":6,"legalMoves":6,"bestDiff":38,"winningMoves":[48],"bestLine":[48,38,31,5,15,7],"difficulty":4.42},
  {"id":"p0408","chapter":4,"chapterKey":"cascade","side":1,"board":"BBBBBWWWWWBBWWWWWWBBWWWWWWBWBWWWW.WBWBWW.WWWWWBBWWW.WWWBB..WB.WB","empties":6,"legalMoves":5,"bestDiff":10,"winningMoves":[40],"bestLine":[40,51,33,61,57,58],"difficulty":4.3},
  {"id":"p0409","chapter":4,"chapterKey":"cascade","side":1,"board":"W.WWBB.BBBWWWWWWWWWBBWWBWWBWWWW.WBWWWWWWWBWWBWBWWWBBBBWWWW..BBB.","empties":6,"legalMoves":4,"bestDiff":10,"winningMoves":[31],"bestLine":[31,1,6,58,63,59],"difficulty":4.24},
  {"id":"p0410","chapter":4,"chapterKey":"cascade","side":1,"board":".WWWBBBBWWWWBBB..WBWWWWWWWWBBWWWWWBWWWWWWB.BBBWWBWBWBBWW.WWWBB.B","empties":6,"legalMoves":6,"bestDiff":20,"winningMoves":[15],"bestLine":[15,56,62,42,0,16],"difficulty":4.12},
  {"id":"p0501","chapter":5,"chapterKey":"comeback","side":1,"board":"...WB......WWWWBWWWWWWW.WBWWWWWWW.BWBWBB.WWBWWBBBWBBBBBB.WBW.WWW","empties":14,"legalMoves":11,"bestDiff":40,"winningMoves":[2],"bestLine":[2,60,10,33,7,1,0,6,23,9,8,5,40,56],"difficulty":7.86},
  {"id":"p0502","chapter":5,"chapterKey":"comeback","side":1,"board":".WW.W.W.BWBBBW.BWWWBWWB.WWBWBB..WWWBBBB.WWWWWWBB.WWWWW.BWWWWW...","empties":14,"legalMoves":8,"bestDiff":8,"winningMoves":[0],"bestLine":[0,23,31,39,3,63,30,7,5,14,62,54,61,48],"difficulty":7.8},
  {"id":"p0503","chapter":5,"chapterKey":"comeback","side":1,"board":".WBWWWW...BBWWWB..BWWWWB..WBWWWB.W.BWBWB.WBWWWWW.WWWWWW.BWWWBBB.","empties":14,"legalMoves":9,"bestDiff":20,"winningMoves":[7],"bestLine":[7,17,0,34,25,9,8,32,16,24,40,48,63,55],"difficulty":7.8},
  {"id":"p0504","chapter":5,"chapterKey":"comeback","side":1,"board":"....B.WBBB.WBWW.BBWBBBW.BWWWWWW.BWWBBWW.BWWWWBW.BWWWWWWW.WWWWW..","empties":14,"legalMoves":12,"bestDiff":32,"winningMoves":[3],"bestLine":[3,0,56,10,62,5,31,23,2,1,15,39,63,47],"difficulty":7.8},
  {"id":"p0505","chapter":5,"chapterKey":"comeback","side":1,"board":"W.W..BBWWWWWBBBWWWWWBWBW.WWWWWWW..WBWWBW.WWBBB..WWWBBWW...WB.WB.","empties":14,"legalMoves":10,"bestDiff":8,"winningMoves":[63],"bestLine":[63,60,57,47,46,55,32,40,56,4,24,33,1,3],"difficulty":7.74},
  {"id":"p0506","chapter":5,"chapterKey":"comeback","side":1,"board":".WWWWWB..WWWWBB.BWWWBWBWBBWBWBBWBBWWWWBBB..WWBWW..WWWWWW.W....B.","empties":14,"legalMoves":10,"bestDiff":32,"winningMoves":[0],"bestLine":[0,7,15,8,42,49,41,48,56,58,59,60,61,63],"difficulty":7.74},
  {"id":"p0507","chapter":5,"chapterKey":"comeback","side":1,"board":".BBB.WW.BWWWWWW.BWWWWWWWBWWWWWWWBWBWWW.W.BWWWWWWB..W.WWW..WWWWW.","empties":12,"legalMoves":5,"bestDiff":32,"winningMoves":[38],"bestLine":[38,40,0,4,7,15,63,56,49,50,52,57],"difficulty":7.72},
  {"id":"p0508","chapter":5,"chapterKey":"comeback","side":1,"board":"W..W.BW..W.WBWWWWWWWWWWB.WWWWWWBWWWWBWBB.WWBBBW..WWWBBWWWWWBBB..","empties":12,"legalMoves":11,"bestDiff":28,"winningMoves":[4],"bestLine":[4,62,47,48,40,24,7,2,8,1,10,63],"difficulty":7.66},
  {"id":"p0509","chapter":5,"chapterKey":"comeback","side":1,"board":"B.WBB....BBBBBBBW.BWWWWWWWWBWWWW.WWWBWWWWWWWWB.WWWWWBB....WB.BW.","empties":14,"legalMoves":8,"bestDiff":20,"winningMoves":[46],"bestLine":[46,6,1,7,5,60,32,17,8,54,63,55,57,56],"difficulty":7.62},
  {"id":"p0510","chapter":5,"chapterKey":"comeback","side":1,"board":"WW.BBBW..WWWWWWWBBBWBW.WBBBWWWWWBBBWBBBWBW.WBBBW..WWWWW....W...W","empties":14,"legalMoves":11,"bestDiff":8,"winningMoves":[7],"bestLine":[7,55,22,8,42,48,60,58,2,61,62,49,57,56],"difficulty":7.5},
  {"id":"p0601","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":"..WWWWW..BBBWWWB..BWWWWW.WWBWWWW.WBWBW.WWBWWWWW.BWWWWWW.BBWW.B..","empties":14,"legalMoves":10,"bestDiff":36,"winningMoves":[7],"bestLine":[7,0,1,32,60,17,24,47,8,16,63,55,62,38],"difficulty":8.4},
  {"id":"p0602","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":".BBB....WWWWWB..BBWWWWWW.WWBWBWBWWWWWBW.WWBWWBW.WBWWWWW.B.BW.BW.","empties":14,"legalMoves":10,"bestDiff":42,"winningMoves":[24],"bestLine":[24,4,0,57,63,55,5,6,7,14,60,39,15,47],"difficulty":8.4},
  {"id":"p0603","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":"B..WWBW.BBWWBWWWWWBBW.W.WWWBBBWBBWWWWWW.BBWWWWW..WWWWWWW.W...W..","empties":14,"legalMoves":13,"bestDiff":54,"winningMoves":[21],"bestLine":[21,1,7,48,58,59,23,56,2,39,47,63,62,60],"difficulty":8.4},
  {"id":"p0604","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":"WWWWWWW..WWWWWW..WBWWBW.BWBWBWW.BBBBWBWBBWBWWWW..WWB.BW...BBB.W.","empties":14,"legalMoves":12,"bestDiff":38,"winningMoves":[63],"bestLine":[63,52,61,55,47,15,23,7,56,48,57,16,8,31],"difficulty":8.16},
  {"id":"p0605","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":"BBWWWWWW.WWWB.WBW.BBWWBWWWBBBW..WWBBWWW..BBWWWWW..BBW.W...WWWWB.","empties":14,"legalMoves":11,"bestDiff":24,"winningMoves":[57],"bestLine":[57,13,53,49,63,17,8,55,39,30,31,56,48,40],"difficulty":8.04},
  {"id":"p0606","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":"W.B.WW.B.W.WWWBBBBBBWWWWWWWWWBWWBBBWBWWWBBBW.W...WWBWW...WWWBW..","empties":14,"legalMoves":11,"bestDiff":24,"winningMoves":[6],"bestLine":[6,44,47,10,56,46,3,48,62,8,1,55,54,63],"difficulty":7.98},
  {"id":"p0607","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":".B.W.WWW.WWWWWWWB..BBWWWBBWWWWW..BBWBWB..WBWWWWBWWWWWWWB..BWB..B","empties":14,"legalMoves":11,"bestDiff":12,"winningMoves":[18],"bestLine":[18,40,0,8,32,17,57,56,2,31,4,61,39,62],"difficulty":7.92},
  {"id":"p0608","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":"..WWWW.W.WWWWWWWWWWWBWWWWWBBBBWWWWBWBBW.WWWBBBBWB..WB.BB...W...B","empties":14,"legalMoves":8,"bestDiff":28,"winningMoves":[8],"bestLine":[8,50,0,1,39,62,53,61,6,60,49,56,57,58],"difficulty":7.92},
  {"id":"p0609","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":"BW.WWWW.B.W.BW..BWWBWWW.BWWWWWWWBWWWW.W.BWBWBWW..WWBBBW.BWWWWWWW","empties":12,"legalMoves":9,"bestDiff":38,"winningMoves":[37],"bestLine":[37,11,9,2,7,48,23,15,14,39,47,55],"difficulty":7.84},
  {"id":"p0610","chapter":6,"chapterKey":"perfect-endgame","side":1,"board":"...BBW..B.B.WWWW.BWWWWB..WWWWBWWW.WWBWWWWWWBWWWWWWWBBWWB.WWWWWWW","empties":12,"legalMoves":7,"bestDiff":14,"winningMoves":[23],"bestLine":[23,16,7,0,6,1,24,33,9,2,11,56],"difficulty":7.78},
]);

export const PUZZLE_COUNT = PUZZLES.length;

export function chapterPuzzles(chapter) {
  return PUZZLES.filter((puzzle) => puzzle.chapter === chapter);
}

export function puzzleById(id) {
  return PUZZLES.find((puzzle) => puzzle.id === id) ?? null;
}