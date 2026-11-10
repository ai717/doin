/**
 * @file games/screw/js/levels.mjs
 * 21 关 · 五工坊篇章关卡数据（由 tools/gen-levels.mjs 生成并验证，请勿手改颜色与盒序）。
 * 所有关卡均通过 DAG 拓扑求解器验证，并在备用孔容量约束下存在完整解。
 */

export const CHAPTERS = [
  { id: 1, nameKey: 'chapter_1', subtitleKey: 'chapter_1_sub', material: 'wood', colorCount: 2, levelIds: [1, 2, 3, 4] },
  { id: 2, nameKey: 'chapter_2', subtitleKey: 'chapter_2_sub', material: 'acrylic', colorCount: 3, levelIds: [5, 6, 7, 8, 9] },
  { id: 3, nameKey: 'chapter_3', subtitleKey: 'chapter_3_sub', material: 'metal', colorCount: 3, levelIds: [10, 11, 12, 13] },
  { id: 4, nameKey: 'chapter_4', subtitleKey: 'chapter_4_sub', material: 'neon', colorCount: 4, levelIds: [14, 15, 16, 17, 18] },
  { id: 5, nameKey: 'chapter_5', subtitleKey: 'chapter_5_sub', material: 'sculpture', colorCount: 5, levelIds: [19, 20, 21] },
];

export const LEVELS = [
  {
    id: 1,
    nameKey: 'lvl_1',
    chapter: 1,
    bufferCapacity: 4,
    boxQueue: ['yellow', 'red'],
    plates: [
    { id: 'a', layer: 1, material: 'wood', shape: 'bar', tone: 0, cells: [[1,2],[2,2],[3,2],[4,2]], holes: [[1,2,'yellow'],[4,2,'red']] },
    { id: 'b', layer: 1, material: 'wood', shape: 'bar', tone: 1, cells: [[1,5],[2,5],[3,5],[4,5]], holes: [[1,5,'red'],[4,5,'yellow']] },
    { id: 'c', layer: 1, material: 'wood', shape: 'bar', tone: 2, cells: [[2,7],[3,7],[4,7],[5,7]], holes: [[2,7,'yellow'],[5,7,'red']] },
    ],
  },
  {
    id: 2,
    nameKey: 'lvl_2',
    chapter: 1,
    bufferCapacity: 4,
    boxQueue: ['yellow', 'red', 'yellow'],
    plates: [
    { id: 'a', layer: 3, material: 'wood', shape: 'bar', tone: 0, cells: [[1,2],[2,2],[3,2],[4,2],[5,2]], holes: [[1,2,'red'],[2,2,'yellow'],[5,2,'yellow']] },
    { id: 'b', layer: 2, material: 'wood', shape: 'bar', tone: 1, cells: [[3,1],[3,2],[3,3],[3,4],[3,5]], holes: [[3,1,'red'],[3,2,'yellow'],[3,4,'yellow']] },
    { id: 'c', layer: 1, material: 'wood', shape: 'bar', tone: 2, cells: [[1,5],[2,5],[3,5],[4,5],[5,5]], holes: [[1,5,'red'],[3,5,'yellow'],[5,5,'yellow']] },
    ],
  },
  {
    id: 3,
    nameKey: 'lvl_3',
    chapter: 1,
    bufferCapacity: 4,
    boxQueue: ['yellow', 'red', 'yellow'],
    plates: [
    { id: 'a', layer: 2, material: 'wood', shape: 'bar', tone: 0, cells: [[2,2],[3,2],[4,2],[5,2]], holes: [[2,2,'yellow'],[5,2,'yellow']] },
    { id: 'b', layer: 2, material: 'wood', shape: 'bar', tone: 1, cells: [[2,4],[3,4],[4,4],[5,4]], holes: [[2,4,'yellow'],[5,4,'yellow']] },
    { id: 'c', layer: 1, material: 'wood', shape: 'bar', tone: 2, cells: [[3,1],[3,2],[3,3],[3,4],[3,5],[3,6]], holes: [[3,2,'red'],[3,3,'yellow'],[3,6,'red']] },
    { id: 'd', layer: 1, material: 'wood', shape: 'bar', tone: 3, cells: [[4,7],[5,7],[6,7]], holes: [[4,7,'red'],[6,7,'yellow']] },
    ],
  },
  {
    id: 4,
    nameKey: 'lvl_4',
    chapter: 1,
    bufferCapacity: 4,
    boxQueue: ['red', 'yellow', 'yellow', 'red'],
    plates: [
    { id: 'a', layer: 3, material: 'wood', shape: 'bar', tone: 0, cells: [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1]], holes: [[1,1,'yellow'],[3,1,'red'],[6,1,'red']] },
    { id: 'b', layer: 3, material: 'wood', shape: 'bar', tone: 1, cells: [[7,2],[7,3],[7,4],[7,5],[7,6]], holes: [[7,2,'yellow'],[7,4,'red'],[7,6,'red']] },
    { id: 'c', layer: 2, material: 'wood', shape: 'bar', tone: 2, cells: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4]], holes: [[1,4,'red'],[4,4,'yellow'],[6,4,'red']] },
    { id: 'd', layer: 1, material: 'wood', shape: 'bar', tone: 3, cells: [[2,3],[2,4],[2,5],[2,6],[2,7]], holes: [[2,3,'yellow'],[2,4,'yellow'],[2,7,'yellow']] },
    ],
  },
  {
    id: 5,
    nameKey: 'lvl_5',
    chapter: 2,
    bufferCapacity: 4,
    boxQueue: ['blue', 'yellow', 'red'],
    plates: [
    { id: 'a', layer: 3, material: 'acrylic', shape: 'bar', tone: 0, cells: [[1,2],[2,2],[3,2],[4,2],[5,2]], holes: [[1,2,'blue'],[5,2,'yellow']] },
    { id: 'b', layer: 2, material: 'acrylic', shape: 'bar', tone: 1, cells: [[3,1],[3,2],[3,3],[3,4],[3,5]], holes: [[3,2,'red'],[3,4,'red']] },
    { id: 'c', layer: 1, material: 'acrylic', shape: 'bar', tone: 2, cells: [[1,5],[2,5],[3,5],[4,5],[5,5]], holes: [[3,5,'blue'],[5,5,'yellow']] },
    { id: 'd', layer: 2, material: 'acrylic', shape: 'bar', tone: 3, cells: [[6,1],[6,2],[6,3],[6,4]], holes: [[6,3,'red']] },
    { id: 'e', layer: 1, material: 'acrylic', shape: 'bar', tone: 4, cells: [[2,7],[3,7],[4,7],[5,7]], holes: [[2,7,'blue'],[5,7,'yellow']] },
    ],
  },
  {
    id: 6,
    nameKey: 'lvl_6',
    chapter: 2,
    bufferCapacity: 4,
    boxQueue: ['red', 'yellow', 'blue', 'blue'],
    plates: [
    { id: 'a', layer: 4, material: 'acrylic', shape: 'bar', tone: 0, cells: [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1]], holes: [[2,1,'blue'],[5,1,'red'],[7,1,'yellow']] },
    { id: 'b', layer: 3, material: 'acrylic', shape: 'bar', tone: 1, cells: [[4,1],[4,2],[4,3],[4,4],[4,5],[4,6]], holes: [[4,1,'yellow'],[4,4,'blue'],[4,6,'blue']] },
    { id: 'c', layer: 2, material: 'acrylic', shape: 'bar', tone: 2, cells: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4]], holes: [[1,4,'red'],[3,4,'yellow'],[7,4,'blue']] },
    { id: 'd', layer: 1, material: 'acrylic', shape: 'bar', tone: 3, cells: [[2,4],[2,5],[2,6],[2,7]], holes: [[2,4,'red'],[2,5,'blue'],[2,7,'blue']] },
    ],
  },
  {
    id: 7,
    nameKey: 'lvl_7',
    chapter: 2,
    bufferCapacity: 4,
    boxQueue: ['blue', 'yellow', 'red', 'yellow'],
    plates: [
    { id: 'a', layer: 3, material: 'acrylic', shape: 'bar', tone: 0, cells: [[2,2],[3,2],[4,2],[5,2]], holes: [[2,2,'red'],[5,2,'red']] },
    { id: 'b', layer: 3, material: 'acrylic', shape: 'bar', tone: 1, cells: [[1,5],[2,5],[3,5],[4,5],[5,5],[6,5]], holes: [[1,5,'yellow'],[5,5,'yellow']] },
    { id: 'c', layer: 2, material: 'acrylic', shape: 'bar', tone: 2, cells: [[3,1],[3,2],[3,3],[3,4],[3,5],[3,6]], holes: [[3,2,'yellow'],[3,3,'yellow'],[3,6,'yellow']] },
    { id: 'd', layer: 2, material: 'acrylic', shape: 'bar', tone: 3, cells: [[6,2],[6,3],[6,4],[6,5],[6,6]], holes: [[6,2,'blue'],[6,4,'blue'],[6,5,'red']] },
    { id: 'e', layer: 1, material: 'acrylic', shape: 'bar', tone: 4, cells: [[2,7],[3,7],[4,7],[5,7],[6,7]], holes: [[2,7,'yellow'],[6,7,'blue']] },
    ],
  },
  {
    id: 8,
    nameKey: 'lvl_8',
    chapter: 2,
    bufferCapacity: 4,
    boxQueue: ['yellow', 'blue', 'yellow', 'red', 'yellow'],
    plates: [
    { id: 'a', layer: 4, material: 'acrylic', shape: 'bar', tone: 0, cells: [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1]], holes: [[1,1,'yellow'],[3,1,'yellow'],[6,1,'blue']] },
    { id: 'b', layer: 3, material: 'acrylic', shape: 'bar', tone: 1, cells: [[4,1],[4,2],[4,3],[4,4],[4,5],[4,6]], holes: [[4,1,'yellow'],[4,3,'blue'],[4,5,'yellow']] },
    { id: 'c', layer: 2, material: 'acrylic', shape: 'bar', tone: 2, cells: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4]], holes: [[1,4,'yellow'],[3,4,'red'],[5,4,'yellow']] },
    { id: 'd', layer: 3, material: 'acrylic', shape: 'bar', tone: 3, cells: [[6,1],[6,2],[6,3],[6,4],[6,5],[6,6]], holes: [[6,4,'yellow'],[6,5,'yellow'],[6,6,'red']] },
    { id: 'e', layer: 1, material: 'acrylic', shape: 'bar', tone: 4, cells: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]], holes: [[1,7,'yellow'],[4,7,'red'],[6,7,'blue']] },
    ],
  },
  {
    id: 9,
    nameKey: 'lvl_9',
    chapter: 2,
    bufferCapacity: 4,
    boxQueue: ['blue', 'blue', 'yellow', 'red', 'yellow'],
    plates: [
    { id: 'a', layer: 5, material: 'acrylic', shape: 'bar', tone: 0, cells: [[3,0],[3,1],[3,2],[3,3]], holes: [[3,0,'blue'],[3,2,'red'],[3,3,'yellow']] },
    { id: 'b', layer: 4, material: 'acrylic', shape: 'bar', tone: 1, cells: [[1,3],[2,3],[3,3],[4,3],[5,3],[6,3]], holes: [[1,3,'blue'],[2,3,'red'],[6,3,'blue']] },
    { id: 'c', layer: 3, material: 'acrylic', shape: 'bar', tone: 2, cells: [[5,2],[5,3],[5,4],[5,5],[5,6]], holes: [[5,2,'yellow'],[5,4,'blue'],[5,6,'yellow']] },
    { id: 'd', layer: 2, material: 'acrylic', shape: 'bar', tone: 3, cells: [[1,5],[2,5],[3,5],[4,5],[5,5],[6,5]], holes: [[1,5,'yellow'],[5,5,'red'],[6,5,'yellow']] },
    { id: 'e', layer: 1, material: 'acrylic', shape: 'bar', tone: 4, cells: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]], holes: [[1,7,'blue'],[3,7,'blue'],[6,7,'yellow']] },
    ],
  },
  {
    id: 10,
    nameKey: 'lvl_10',
    chapter: 3,
    bufferCapacity: 3,
    boxQueue: ['red', 'blue', 'yellow'],
    plates: [
    { id: 'a', layer: 4, material: 'metal', shape: 'bar', tone: 0, cells: [[1,2],[2,2],[3,2],[4,2],[5,2],[6,2]], holes: [[1,2,'yellow'],[5,2,'blue']] },
    { id: 'b', layer: 3, material: 'metal', shape: 'bar', tone: 1, cells: [[3,1],[3,2],[3,3],[3,4],[3,5]], holes: [[3,2,'yellow'],[3,4,'yellow']] },
    { id: 'c', layer: 3, material: 'metal', shape: 'bar', tone: 2, cells: [[6,1],[6,2],[6,3],[6,4],[6,5]], holes: [[6,2,'blue'],[6,4,'red']] },
    { id: 'd', layer: 2, material: 'metal', shape: 'bar', tone: 3, cells: [[1,5],[2,5],[3,5],[4,5],[5,5],[6,5]], holes: [[1,5,'red'],[6,5,'red']] },
    { id: 'e', layer: 1, material: 'metal', shape: 'single', tone: 4, cells: [[3,3]], holes: [[3,3,'blue']] },
    ],
  },
  {
    id: 11,
    nameKey: 'lvl_11',
    chapter: 3,
    bufferCapacity: 3,
    boxQueue: ['yellow', 'red', 'blue', 'blue'],
    plates: [
    { id: 'a', layer: 4, material: 'metal', shape: 'bar', tone: 0, cells: [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1]], holes: [[0,1,'blue'],[3,1,'red'],[7,1,'blue']] },
    { id: 'b', layer: 3, material: 'metal', shape: 'bar', tone: 1, cells: [[2,1],[2,2],[2,3],[2,4],[2,5],[2,6]], holes: [[2,1,'yellow'],[2,3,'yellow'],[2,5,'blue']] },
    { id: 'c', layer: 3, material: 'metal', shape: 'bar', tone: 2, cells: [[5,1],[5,2],[5,3],[5,4],[5,5],[5,6]], holes: [[5,1,'blue'],[5,3,'red'],[5,5,'yellow']] },
    { id: 'd', layer: 2, material: 'metal', shape: 'bar', tone: 3, cells: [[1,6],[2,6],[3,6],[4,6],[5,6],[6,6]], holes: [[2,6,'blue'],[4,6,'red'],[6,6,'blue']] },
    ],
  },
  {
    id: 12,
    nameKey: 'lvl_12',
    chapter: 3,
    bufferCapacity: 3,
    boxQueue: ['blue', 'red', 'yellow', 'yellow'],
    plates: [
    { id: 'a', layer: 4, material: 'metal', shape: 'bar', tone: 0, cells: [[1,2],[2,2],[3,2],[4,2],[5,2],[6,2]], holes: [[1,2,'yellow'],[3,2,'yellow'],[6,2,'yellow']] },
    { id: 'b', layer: 3, material: 'metal', shape: 'bar', tone: 1, cells: [[4,1],[4,2],[4,3],[4,4],[4,5],[4,6]], holes: [[4,2,'blue'],[4,3,'blue'],[4,6,'red']] },
    { id: 'c', layer: 2, material: 'metal', shape: 'bar', tone: 2, cells: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4]], holes: [[1,4,'red'],[3,4,'yellow'],[6,4,'yellow']] },
    { id: 'd', layer: 1, material: 'metal', shape: 'bar', tone: 3, cells: [[2,4],[2,5],[2,6],[2,7]], holes: [[2,4,'yellow'],[2,6,'blue'],[2,7,'red']] },
    ],
  },
  {
    id: 13,
    nameKey: 'lvl_13',
    chapter: 3,
    bufferCapacity: 3,
    boxQueue: ['yellow', 'blue', 'yellow', 'red', 'blue'],
    plates: [
    { id: 'a', layer: 4, material: 'metal', shape: 'bar', tone: 0, cells: [[2,1],[2,2],[2,3],[2,4],[2,5],[2,6]], holes: [[2,1,'blue'],[2,3,'red'],[2,5,'red']] },
    { id: 'b', layer: 3, material: 'metal', shape: 'bar', tone: 1, cells: [[5,1],[5,2],[5,3],[5,4],[5,5],[5,6]], holes: [[5,1,'blue'],[5,4,'blue'],[5,6,'yellow']] },
    { id: 'c', layer: 2, material: 'metal', shape: 'bar', tone: 2, cells: [[1,3],[2,3],[3,3],[4,3],[5,3],[6,3]], holes: [[1,3,'blue'],[5,3,'yellow'],[6,3,'yellow']] },
    { id: 'd', layer: 2, material: 'metal', shape: 'bar', tone: 3, cells: [[1,6],[2,6],[3,6],[4,6],[5,6],[6,6]], holes: [[2,6,'blue'],[3,6,'yellow'],[6,6,'red']] },
    { id: 'e', layer: 1, material: 'metal', shape: 'bar', tone: 4, cells: [[4,4],[4,5],[4,6],[4,7]], holes: [[4,4,'yellow'],[4,6,'yellow'],[4,7,'blue']] },
    ],
  },
  {
    id: 14,
    nameKey: 'lvl_14',
    chapter: 4,
    bufferCapacity: 3,
    boxQueue: ['blue', 'red', 'green', 'yellow'],
    plates: [
    { id: 'a', layer: 3, material: 'neon', shape: 'ring', tone: 0, cells: [[3,2],[4,2],[5,2],[3,3],[5,3],[3,4],[4,4],[5,4]], holes: [[3,2,'green'],[5,2,'green'],[3,4,'yellow'],[5,4,'red']] },
    { id: 'b', layer: 2, material: 'neon', shape: 'bar', tone: 1, cells: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4]], holes: [[1,4,'green'],[4,4,'red'],[6,4,'yellow']] },
    { id: 'c', layer: 1, material: 'neon', shape: 'bar', tone: 2, cells: [[2,5],[2,6],[2,7]], holes: [[2,5,'red'],[2,6,'yellow']] },
    { id: 'd', layer: 2, material: 'neon', shape: 'bar', tone: 3, cells: [[2,7],[3,7],[4,7],[5,7],[6,7]], holes: [[2,7,'blue'],[4,7,'blue'],[6,7,'blue']] },
    ],
  },
  {
    id: 15,
    nameKey: 'lvl_15',
    chapter: 4,
    bufferCapacity: 3,
    boxQueue: ['green', 'yellow', 'yellow', 'red', 'blue'],
    plates: [
    { id: 'a', layer: 4, material: 'neon', shape: 'ring', tone: 0, cells: [[2,1],[3,1],[4,1],[2,2],[4,2],[2,3],[3,3],[4,3]], holes: [[2,1,'green'],[4,1,'yellow'],[2,3,'yellow']] },
    { id: 'b', layer: 4, material: 'neon', shape: 'ring', tone: 1, cells: [[5,3],[6,3],[7,3],[5,4],[7,4],[5,5],[6,5],[7,5]], holes: [[5,3,'red'],[5,5,'red'],[7,5,'blue']] },
    { id: 'c', layer: 3, material: 'neon', shape: 'bar', tone: 2, cells: [[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3]], holes: [[1,3,'yellow'],[4,3,'yellow'],[7,3,'blue']] },
    { id: 'd', layer: 2, material: 'neon', shape: 'bar', tone: 3, cells: [[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6]], holes: [[1,6,'yellow'],[4,6,'blue'],[7,6,'red']] },
    { id: 'e', layer: 1, material: 'neon', shape: 'single', tone: 4, cells: [[4,5]], holes: [[4,5,'yellow']] },
    { id: 'f', layer: 1, material: 'neon', shape: 'single', tone: 0, cells: [[1,1]], holes: [[1,1,'green']] },
    { id: 'g', layer: 1, material: 'neon', shape: 'single', tone: 1, cells: [[7,7]], holes: [[7,7,'green']] },
    ],
  },
  {
    id: 16,
    nameKey: 'lvl_16',
    chapter: 4,
    bufferCapacity: 3,
    boxQueue: ['blue', 'green', 'green', 'red', 'yellow'],
    plates: [
    { id: 'a', layer: 4, material: 'neon', shape: 'ring', tone: 0, cells: [[1,1],[2,1],[3,1],[1,2],[3,2],[1,3],[2,3],[3,3]], holes: [[1,1,'yellow'],[3,1,'green'],[1,3,'yellow']] },
    { id: 'b', layer: 4, material: 'neon', shape: 'ring', tone: 1, cells: [[5,1],[6,1],[7,1],[5,2],[7,2],[5,3],[6,3],[7,3]], holes: [[5,1,'green'],[7,1,'red'],[7,3,'green']] },
    { id: 'c', layer: 3, material: 'neon', shape: 'bar', tone: 2, cells: [[4,1],[4,2],[4,3],[4,4],[4,5],[4,6],[4,7]], holes: [[4,2,'green'],[4,5,'blue'],[4,7,'yellow']] },
    { id: 'd', layer: 2, material: 'neon', shape: 'bar', tone: 3, cells: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4]], holes: [[1,4,'red'],[4,4,'blue'],[7,4,'red']] },
    { id: 'e', layer: 1, material: 'neon', shape: 'single', tone: 4, cells: [[4,6]], holes: [[4,6,'blue']] },
    { id: 'f', layer: 1, material: 'neon', shape: 'single', tone: 0, cells: [[1,5]], holes: [[1,5,'green']] },
    { id: 'g', layer: 1, material: 'neon', shape: 'single', tone: 1, cells: [[7,5]], holes: [[7,5,'green']] },
    ],
  },
  {
    id: 17,
    nameKey: 'lvl_17',
    chapter: 4,
    bufferCapacity: 3,
    boxQueue: ['red', 'blue', 'green', 'yellow', 'blue', 'green'],
    plates: [
    { id: 'a', layer: 5, material: 'neon', shape: 'ring', tone: 0, cells: [[1,1],[2,1],[3,1],[1,2],[3,2],[1,3],[2,3],[3,3]], holes: [[1,1,'blue'],[3,1,'yellow'],[1,3,'yellow']] },
    { id: 'b', layer: 5, material: 'neon', shape: 'ring', tone: 1, cells: [[5,1],[6,1],[7,1],[5,2],[7,2],[5,3],[6,3],[7,3]], holes: [[5,1,'red'],[7,1,'green'],[7,3,'yellow']] },
    { id: 'c', layer: 4, material: 'neon', shape: 'ring', tone: 2, cells: [[3,4],[4,4],[5,4],[3,5],[5,5],[3,6],[4,6],[5,6]], holes: [[3,4,'blue'],[5,4,'blue'],[3,6,'red']] },
    { id: 'd', layer: 3, material: 'neon', shape: 'bar', tone: 3, cells: [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1]], holes: [[2,1,'blue'],[4,1,'red'],[6,1,'green']] },
    { id: 'e', layer: 2, material: 'neon', shape: 'bar', tone: 4, cells: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]], holes: [[1,7,'blue'],[4,7,'green'],[7,7,'blue']] },
    { id: 'f', layer: 1, material: 'neon', shape: 'bar', tone: 0, cells: [[4,3],[4,4],[4,5],[4,6],[4,7]], holes: [[4,4,'green'],[4,5,'green'],[4,6,'green']] },
    ],
  },
  {
    id: 18,
    nameKey: 'lvl_18',
    chapter: 4,
    bufferCapacity: 3,
    boxQueue: ['green', 'red', 'blue', 'green', 'blue', 'green', 'yellow'],
    plates: [
    { id: 'a', layer: 6, material: 'neon', shape: 'ring', tone: 0, cells: [[2,1],[3,1],[4,1],[2,2],[4,2],[2,3],[3,3],[4,3]], holes: [[4,1,'blue'],[2,3,'green'],[4,3,'yellow']] },
    { id: 'b', layer: 6, material: 'neon', shape: 'ring', tone: 1, cells: [[5,1],[6,1],[7,1],[5,2],[7,2],[5,3],[6,3],[7,3]], holes: [[5,1,'blue'],[7,1,'green'],[7,3,'blue']] },
    { id: 'c', layer: 5, material: 'neon', shape: 'bar', tone: 2, cells: [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1]], holes: [[2,1,'blue'],[3,1,'blue'],[6,1,'red']] },
    { id: 'd', layer: 4, material: 'neon', shape: 'bar', tone: 3, cells: [[4,1],[4,2],[4,3],[4,4],[4,5],[4,6],[4,7]], holes: [[4,2,'green'],[4,5,'yellow'],[4,6,'green']] },
    { id: 'e', layer: 3, material: 'neon', shape: 'bar', tone: 4, cells: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4]], holes: [[1,4,'blue'],[4,4,'green'],[7,4,'green']] },
    { id: 'f', layer: 2, material: 'neon', shape: 'bar', tone: 0, cells: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]], holes: [[1,7,'green'],[4,7,'green'],[7,7,'green']] },
    { id: 'g', layer: 1, material: 'neon', shape: 'bar', tone: 1, cells: [[2,4],[2,5],[2,6],[2,7]], holes: [[2,5,'red'],[2,6,'red'],[2,7,'yellow']] },
    ],
  },
  {
    id: 19,
    nameKey: 'lvl_19',
    chapter: 5,
    bufferCapacity: 3,
    boxQueue: ['purple', 'green', 'blue', 'yellow', 'green', 'yellow', 'red'],
    plates: [
    { id: 'a', layer: 6, material: 'brass', shape: 'ring', tone: 0, cells: [[1,1],[2,1],[3,1],[1,2],[3,2],[1,3],[2,3],[3,3]], holes: [[2,1,'green'],[1,2,'green'],[2,3,'yellow']] },
    { id: 'b', layer: 6, material: 'neon', shape: 'ring', tone: 1, cells: [[5,1],[6,1],[7,1],[5,2],[7,2],[5,3],[6,3],[7,3]], holes: [[5,1,'green'],[5,3,'yellow'],[7,3,'yellow']] },
    { id: 'c', layer: 5, material: 'acrylic', shape: 'cross', tone: 2, cells: [[4,4],[3,4],[5,4],[4,3],[4,5]], holes: [[4,3,'purple'],[3,4,'yellow'],[5,4,'yellow']] },
    { id: 'd', layer: 4, material: 'metal', shape: 'bar', tone: 3, cells: [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1]], holes: [[1,1,'yellow'],[3,1,'purple'],[6,1,'blue'],[7,1,'red']] },
    { id: 'e', layer: 3, material: 'wood', shape: 'bar', tone: 4, cells: [[4,2],[4,3],[4,4],[4,5],[4,6],[4,7]], holes: [[4,4,'green'],[4,5,'blue'],[4,6,'green']] },
    { id: 'f', layer: 2, material: 'brass', shape: 'bar', tone: 0, cells: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]], holes: [[1,7,'purple'],[4,7,'red'],[7,7,'green']] },
    { id: 'g', layer: 1, material: 'neon', shape: 'bar', tone: 1, cells: [[2,4],[2,5],[2,6],[2,7]], holes: [[2,5,'blue'],[2,7,'red']] },
    ],
  },
  {
    id: 20,
    nameKey: 'lvl_20',
    chapter: 5,
    bufferCapacity: 3,
    boxQueue: ['green', 'purple', 'blue', 'purple', 'green', 'yellow', 'red', 'green'],
    plates: [
    { id: 'a', layer: 7, material: 'brass', shape: 'ring', tone: 0, cells: [[1,1],[2,1],[3,1],[1,2],[3,2],[1,3],[2,3],[3,3]], holes: [[2,1,'yellow'],[1,2,'purple'],[2,3,'purple']] },
    { id: 'b', layer: 7, material: 'neon', shape: 'ring', tone: 1, cells: [[5,1],[6,1],[7,1],[5,2],[7,2],[5,3],[6,3],[7,3]], holes: [[6,1,'red'],[7,2,'purple'],[6,3,'purple']] },
    { id: 'c', layer: 6, material: 'acrylic', shape: 'bar', tone: 2, cells: [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1]], holes: [[1,1,'blue'],[3,1,'purple'],[5,1,'green']] },
    { id: 'd', layer: 5, material: 'metal', shape: 'bar', tone: 3, cells: [[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[2,7]], holes: [[2,2,'green'],[2,4,'green'],[2,6,'yellow']] },
    { id: 'e', layer: 5, material: 'wood', shape: 'bar', tone: 4, cells: [[6,1],[6,2],[6,3],[6,4],[6,5],[6,6],[6,7]], holes: [[6,2,'green'],[6,4,'green'],[6,6,'blue']] },
    { id: 'f', layer: 4, material: 'brass', shape: 'bar', tone: 0, cells: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4]], holes: [[1,4,'blue'],[5,4,'yellow'],[7,4,'red']] },
    { id: 'g', layer: 3, material: 'neon', shape: 'bar', tone: 1, cells: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]], holes: [[2,7,'green'],[5,7,'red'],[7,7,'green']] },
    { id: 'h', layer: 2, material: 'acrylic', shape: 'bar', tone: 2, cells: [[4,2],[4,3],[4,4],[4,5],[4,6],[4,7]], holes: [[4,3,'purple'],[4,5,'green'],[4,7,'green']] },
    ],
  },
  {
    id: 21,
    nameKey: 'lvl_21',
    chapter: 5,
    bufferCapacity: 3,
    boxQueue: ['red', 'purple', 'green', 'yellow', 'purple', 'blue', 'red', 'red'],
    plates: [
    { id: 'a', layer: 8, material: 'brass', shape: 'ring', tone: 0, cells: [[1,1],[2,1],[3,1],[1,2],[3,2],[1,3],[2,3],[3,3]], holes: [[2,1,'red'],[1,2,'green'],[2,3,'purple']] },
    { id: 'b', layer: 8, material: 'neon', shape: 'ring', tone: 1, cells: [[5,1],[6,1],[7,1],[5,2],[7,2],[5,3],[6,3],[7,3]], holes: [[6,1,'yellow'],[7,2,'red'],[6,3,'purple']] },
    { id: 'c', layer: 7, material: 'acrylic', shape: 'bar', tone: 2, cells: [[4,0],[4,1],[4,2],[4,3],[4,4],[4,5],[4,6],[4,7]], holes: [[4,1,'red'],[4,3,'blue'],[4,6,'green']] },
    { id: 'd', layer: 6, material: 'metal', shape: 'bar', tone: 3, cells: [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1]], holes: [[1,1,'purple'],[3,1,'red'],[5,1,'red'],[7,1,'yellow']] },
    { id: 'e', layer: 5, material: 'wood', shape: 'bar', tone: 4, cells: [[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4]], holes: [[1,4,'red'],[4,4,'red'],[7,4,'yellow']] },
    { id: 'f', layer: 4, material: 'brass', shape: 'bar', tone: 0, cells: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]], holes: [[1,7,'red'],[4,7,'purple'],[7,7,'red']] },
    { id: 'g', layer: 3, material: 'neon', shape: 'bar', tone: 1, cells: [[2,4],[2,5],[2,6],[2,7]], holes: [[2,4,'purple'],[2,6,'blue']] },
    { id: 'h', layer: 3, material: 'acrylic', shape: 'bar', tone: 2, cells: [[6,4],[6,5],[6,6],[6,7]], holes: [[6,4,'blue'],[6,6,'purple']] },
    { id: 'i', layer: 2, material: 'metal', shape: 'single', tone: 3, cells: [[4,5]], holes: [[4,5,'green']] },
    ],
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === Number(id)) || null;
}

export function levelsOfChapter(chapterId) {
  return LEVELS.filter((level) => level.chapter === Number(chapterId));
}

export function chapterById(id) {
  return CHAPTERS.find((chapter) => chapter.id === Number(id)) || null;
}

export function nextLevelId(id) {
  const index = LEVELS.findIndex((level) => level.id === Number(id));
  return index >= 0 && index + 1 < LEVELS.length ? LEVELS[index + 1].id : null;
}
