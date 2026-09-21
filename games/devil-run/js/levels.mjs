// =====================================================================
// 50 关数据（10 节点 × 5 关）
// =====================================================================
// 每行严格 20 字符。row 0 与 row 12 是舞台上下边框（整条实心），
// 中间 row 1..11 是玩法区：地砖平台、陷阱主格、悬空蜡烛都放在这一带。
//
// 地面层行模板：col0 = '#'，col1 = 'S'（出生），col18 = 'G'（终点门），col19 = '#'
// 陷阱字符写在中间列上（col2..col17），它们既是舞台装饰也是陷阱主格。
// 空中平台写在 row 5..row 10 的任意列上，用于制造跳跃层次。

const FLOOR = "####################";
const OPEN = "....................";

// 地面行：出生 col1、门 col18
// middle 为 col2..col17 的 16 个字符
function ground(middle) {
  if (middle.length !== 16) {
    throw new Error(`ground() 需要 16 个中间字符，实际 ${middle.length}: "${middle}"`);
  }
  return `#S${middle}G#`;
}

const DEFS = [
  // ═══════════════════════════════════════════════════════════════
  // 节点 1 · 蜜月期（前 3 关零陷阱：先建立信任，第 4 关才翻脸）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 1,
    name: "坦途",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("................")
    ]
  },
  {
    nodeId: 1,
    name: "小跃",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ".....###............",
      OPEN,
      ground("................")
    ]
  },
  {
    nodeId: 1,
    name: "双阶",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "..........####......",
      OPEN,
      "....###.............",
      OPEN,
      ground("................")
    ]
  },
  {
    // 首次翻脸：两块与普通地砖完全同款、却一碰即碎
    nodeId: 1,
    name: "第一块假砖",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("....f.....f.....")
    ]
  },
  {
    nodeId: 1,
    name: "蜜月终了",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "..........####......",
      OPEN,
      "....###.............",
      OPEN,
      ground("...c......c.....")
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 节点 2 · 脚下的谎言（塌陷 / 伪装）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 2,
    name: "一踩就碎",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("...ccc..........")
    ]
  },
  {
    nodeId: 2,
    name: "真假难辨",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("..cfc....cc.....")
    ]
  },
  {
    // 塌陷砖串成断续的桥：踩错一步就没路
    nodeId: 2,
    name: "断桥",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".c.c.c.c.c.c....")
    ]
  },
  {
    nodeId: 2,
    name: "坦途归来",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "......####..........",
      OPEN,
      "....##..............",
      OPEN,
      ground("......##........")
    ]
  },
  {
    nodeId: 2,
    name: "连塌",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".cccc...ffff....")
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 节点 3 · 头顶的恶意（弹出尖刺 / 坠落天花板）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 3,
    name: "地里的刺",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".....x..........")
    ]
  },
  {
    nodeId: 3,
    name: "刺与假砖",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("..f...x....f....")
    ]
  },
  {
    // 天花板挂在必经平台正上方：起跳的那一瞬才脱落
    nodeId: 3,
    name: "落顶",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ".......e............",
      OPEN,
      ground("....###...###...")
    ],
    ceilings: { "7,10": 3 }
  },
  {
    nodeId: 3,
    name: "喘息",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "....####............",
      OPEN,
      "..........###.......",
      ground("......###.......")
    ]
  },
  {
    nodeId: 3,
    name: "刺落之间",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ".......e............",
      OPEN,
      ground("..x..###...x....")
    ],
    ceilings: { "7,10": 3 }
  },

  // ═══════════════════════════════════════════════════════════════
  // 节点 4 · 看得见的骗局（消失平台 / 弹簧过冲）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 4,
    name: "抽板",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("...vvv..........")
    ]
  },
  {
    nodeId: 4,
    name: "抽梯",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "........vvv.........",
      OPEN,
      "....vvv.............",
      ground("................")
    ]
  },
  {
    // 弹簧把你送得比预期远——正好飞进刺里
    nodeId: 4,
    name: "弹簧的善意",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("..s.....x.......")
    ]
  },
  {
    nodeId: 4,
    name: "纯跑",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("................")
    ]
  },
  {
    nodeId: 4,
    name: "抽板之考",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ".......vvv..........",
      OPEN,
      "....vvv.............",
      ground("...vv....s......")
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 节点 5 · 终点的把戏（移动终点 / 假门）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 5,
    name: "滑走的门",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("................")
    ],
    runDoor: "auto"
  },
  {
    nodeId: 5,
    name: "门后有刺",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("......x.........")
    ],
    runDoor: "auto"
  },
  {
    // 门会滑走，而脚下是会塌的砖——追门的时候别停
    nodeId: 5,
    name: "追不上",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("...c....c.......")
    ],
    runDoor: "auto"
  },
  {
    nodeId: 5,
    name: "喘息",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "....####............",
      OPEN,
      ".........###........",
      ground("......###.......")
    ]
  },
  {
    nodeId: 5,
    name: "追门",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".c...x.....c....")
    ],
    runDoor: "auto"
  },

  // ═══════════════════════════════════════════════════════════════
  // 节点 6 · 颠倒世界（重力翻转）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 6,
    name: "上下颠倒",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("...k............")
    ]
  },
  {
    nodeId: 6,
    name: "天花板的路",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "..........####......",
      OPEN,
      "....###.............",
      OPEN,
      ground("..k...k.........")
    ]
  },
  {
    nodeId: 6,
    name: "翻两次",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".k...f...k......")
    ]
  },
  {
    nodeId: 6,
    name: "喘息",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "......####..........",
      OPEN,
      ground("........###.....")
    ]
  },
  {
    nodeId: 6,
    name: "颠倒之考",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".k.c.k...x......")
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 节点 7 · 左右为难（反向操作）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 7,
    name: "手眼打架",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("...p............")
    ]
  },
  {
    nodeId: 7,
    name: "反着的路",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("...p....p.......")
    ]
  },
  {
    nodeId: 7,
    name: "反着踩刺",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("..p...x...p.....")
    ]
  },
  {
    nodeId: 7,
    name: "喘息",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "....####............",
      OPEN,
      ".........##.........",
      ground("........##......")
    ]
  },
  {
    nodeId: 7,
    name: "反向之考",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".p..c..x..p.....")
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 节点 8 · 看不见的刀（隐形尖刺）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 8,
    name: "看不见",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("....i...........")
    ]
  },
  {
    nodeId: 8,
    name: "三枚隐刺",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("..i...i...i.....")
    ]
  },
  {
    nodeId: 8,
    name: "隐刺之间",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".i..f..i..f.....")
    ]
  },
  {
    nodeId: 8,
    name: "喘息",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "......####..........",
      OPEN,
      ground("......###.......")
    ]
  },
  {
    nodeId: 8,
    name: "盲行之考",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".i.c.i.c.i......")
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 节点 9 · 空间错位（传送错位）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 9,
    name: "错位之门",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("...t............")
    ],
    portals: [[{ x: 3.5, y: 12 }, { x: 6.5, y: 12 }]]
  },
  {
    nodeId: 9,
    name: "两门",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("..t....t........")
    ],
    portals: [
      [{ x: 2.5, y: 12 }, { x: 4.5, y: 12 }],
      [{ x: 7.5, y: 12 }, { x: 9.5, y: 12 }]
    ]
  },
  {
    nodeId: 9,
    name: "错位与刺",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground("..t..x..t.......")
    ],
    portals: [
      [{ x: 2.5, y: 12 }, { x: 4.5, y: 12 }],
      [{ x: 8.5, y: 12 }, { x: 11.5, y: 12 }]
    ]
  },
  {
    nodeId: 9,
    name: "喘息",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "....####............",
      OPEN,
      ".........###........",
      ground("................")
    ]
  },
  {
    nodeId: 9,
    name: "错位之考",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".t.c.t.x.t......")
    ],
    portals: [
      [{ x: 1.5, y: 12 }, { x: 5.5, y: 12 }],
      [{ x: 5.5, y: 12 }, { x: 11.5, y: 12 }],
      [{ x: 9.5, y: 12 }, { x: 14.5, y: 12 }]
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 节点 10 · 恶魔的毕业考（全工具箱混编）
  // ═══════════════════════════════════════════════════════════════
  {
    nodeId: 10,
    name: "十课之一",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".c.x.f.v........")
    ]
  },
  {
    nodeId: 10,
    name: "十课之二",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "..........####......",
      OPEN,
      ".....e..............",
      OPEN,
      ground(".g..###...k.....")
    ],
    ceilings: { "5,10": 3 }
  },
  {
    nodeId: 10,
    name: "十课之三",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".m.s.x.m.k......")
    ]
  },
  {
    nodeId: 10,
    name: "十课之四",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      ground(".v.c.p.f.g......")
    ],
    portals: [[{ x: 10.5, y: 12 }, { x: 12.5, y: 12 }]]
  },
  {
    nodeId: 10,
    name: "毕业考",
    rows: [
      FLOOR, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,
      "..........####......",
      OPEN,
      ".....e..............",
      OPEN,
      ground(".c.k.x.s.g.p....")
    ],
    ceilings: { "5,10": 3 },
    portals: [[{ x: 13.5, y: 12 }, { x: 15.5, y: 12 }]],
    runDoor: "auto"
  }
];


// =====================================================================
// 解析层：字符地图 → 引擎可消费的 level 对象
// =====================================================================
import { T } from "./engine.mjs";

export const COLS = 20;
export const ROWS = 13;

// 字符 → 地形
const CHAR_TILE = {
  ".": T.EMPTY,
  "#": T.SOLID,
  S: T.SOLID,   // 出生格必须是实心地板
  G: T.SOLID,   // 门所在的格也是地板
  "^": T.SPIKE,
  "~": T.LAVA
};

// 陷阱字符 → 陷阱种类（名称与 engine.mjs 的 TRAP 常量严格一致）
// c 塌陷地砖  f 伪装地砖  v 消失平台  x 弹出尖刺
// s 弹簧过冲  g 假门      m 移动终点  k 重力翻转
// p 反向操作  i 隐形尖刺  t 传送错位  e 坠落天花板种子
export const TRAP_CHARS = Object.freeze({
  c: "collapse",
  f: "fake",
  v: "vanish",
  x: "spike",
  s: "spring",
  g: "fakedoor",
  m: "rundoor",
  k: "gravity",
  p: "reverse",
  i: "ghostspike",
  t: "portal",
  e: "ceiling"
});

export function charToTile(ch) {
  return CHAR_TILE[ch] ?? T.EMPTY;
}

// 陷阱种类 → 覆盖格形状
const SPAN_TRAPS = new Set(["collapse", "fake", "vanish"]);   // 连续格整块
const CEILING_TRAPS = new Set(["ceiling"]);

// 反向操作持续秒数（引擎 TRAP_TIMING 未导出该值，在此与关卡数据统一定义）
export const REVERSE_SECONDS = 3.2;

// 该陷阱是否让脚下格子变成可站立面（需要补 SOLID 底）
const NEEDS_FLOOR = new Set(["collapse", "fake", "vanish", "ghostspike"]);

function clampCol(c) {
  return Math.max(0, Math.min(COLS - 1, c));
}
function clampRow(r) {
  return Math.max(0, Math.min(ROWS - 1, r));
}

// 找到某行某列的支撑（该列自上而下第一个实心格），用于把悬空蜡烛放在台上
function supportRow(map, col, fromRow) {
  for (let r = Math.max(0, fromRow); r < ROWS; r++) {
    if (map[r][col] === T.SOLID) return r;
  }
  return ROWS - 1;
}

// 从候选里挑一个“够远但不至于撞门”的蜡烛位；确定性，不用随机
function pickCandleSpot(map, goalCol) {
  const cols = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 3, 2, 15, 16];
  for (const c of cols) {
    if (Math.abs(c - goalCol) < 2) continue;
    const r = supportRow(map, c, 1);
    if (r > 1 && r <= ROWS - 2) return { x: c + 0.5, y: r - 0.5 };
  }
  return { x: 9.5, y: 10.5 };
}

// 传送落点必须能站：若下面是空的，补一块 SOLID 支撑
function ensureSupport(map, x, y) {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (col < 0 || col >= COLS) return;
  if (row + 1 >= 0 && row + 1 < ROWS && map[row + 1][col] === T.EMPTY) {
    map[row + 1][col] = T.SOLID;
  }
}

export function parseLevel(def, opts = {}) {
  const rowsIn = def.rows;
  if (!Array.isArray(rowsIn) || rowsIn.length !== ROWS) {
    throw new Error(`关卡 "${def.name}" 需要 ${ROWS} 行，实际 ${rowsIn ? rowsIn.length : 0}`);
  }
  for (let r = 0; r < ROWS; r++) {
    if (typeof rowsIn[r] !== "string" || rowsIn[r].length !== COLS) {
      throw new Error(
        `关卡 "${def.name}" 第 ${r} 行需要 ${COLS} 字符，实际 ${rowsIn[r] ? rowsIn[r].length : 0}: "${rowsIn[r]}"`
      );
    }
  }

  const map = [];
  const trapSeeds = [];
  const ceilingSeeds = [];
  let spawnCol = -1;
  let spawnRow = -1;
  let goalCol = -1;
  let goalRow = -1;
  let candleCol = -1;
  let candleRow = -1;

  // 先扫一遍确定地面行（含 S 或 G 的那一行）——该行默认整条实心，
  // 只有陷阱格例外。这样关卡作者写 ground("..c...c..") 时不需关心
  // 其余格子，天然得到一整条连续地板。
  let floorRow = ROWS - 1;
  for (let r = 0; r < ROWS; r++) {
    if (rowsIn[r].includes("S") || rowsIn[r].includes("G")) { floorRow = r; break; }
  }

  for (let r = 0; r < ROWS; r++) {
    const line = rowsIn[r];
    const isFloor = r === floorRow;
    const row = new Array(COLS).fill(T.EMPTY);
    for (let c = 0; c < COLS; c++) {
      const ch = line[c];
      if (ch === "S") {
        spawnCol = c;
        spawnRow = r;
        row[c] = T.SOLID;
      } else if (ch === "G") {
        goalCol = c;
        goalRow = r;
        row[c] = T.SOLID;
      } else if (ch === "C") {
        candleCol = c;
        candleRow = r;
        row[c] = T.EMPTY;
      } else if (TRAP_CHARS[ch]) {
        const kind = TRAP_CHARS[ch];
        if (kind === "ceiling") ceilingSeeds.push({ col: c, row: r });
        else trapSeeds.push({ kind, col: c, row: r, ch });
        // 地形：可站面陷阱格是实心，其余（尖刺/弹簧/重力/反向…）保持实心地板
        row[c] = T.SOLID;
      } else if (ch === "#") {
        row[c] = T.SOLID;
      } else if (ch === "." || ch === " ") {
        row[c] = isFloor && c > 0 && c < COLS - 1 ? T.SOLID : T.EMPTY;
      } else {
        row[c] = CHAR_TILE[ch] ?? T.EMPTY;
      }
    }
    map.push(row);
  }

  // 地面行的首尾必须实心（舞台边框），防止玩家走出世界
  if (map[floorRow][0] !== T.SOLID) map[floorRow][0] = T.SOLID;
  if (map[floorRow][COLS - 1] !== T.SOLID) map[floorRow][COLS - 1] = T.SOLID;

  // ---- 陷阱展开 ----
  // 每个陷阱种类对字段的要求不同，这里按引擎语义逐个构造：
  //  collapse / fake / vanish  → 连续格整块，玩家踩上或靠近触发
  //  spike                      → 单格，玩家踩上触发，延时弹出
  //  ghostspike                 → 单格，玩家靠近 revealRadius 才显形
  //  gravity                    → 单格，踩上后翻转重力
  //  reverse                    → 单格，踩上后反向操作 span 秒
  //  fakedoor                   → 单格，玩家踏入后隐藏终点
  //  spring                     → 单格，踩上后被弹飞（可带 target 落点）
  //  ceiling                    → 悬空横条，玩家在其下方起跳时脱落
  //  rundoor / portal           → 由 def.runDoor / def.portals 声明
  const traps = [];
  const consumed = new Set();

  for (let i = 0; i < trapSeeds.length; i++) {
    const seed = trapSeeds[i];
    if (consumed.has(i)) continue;
    consumed.add(i);

    // ---- 连续格整块 ----
    if (SPAN_TRAPS.has(seed.kind)) {
      const cells = [{ col: seed.col, row: seed.row }];
      for (let j = i + 1; j < trapSeeds.length; j++) {
        const nx = trapSeeds[j];
        if (consumed.has(j) || nx.kind !== seed.kind || nx.row !== seed.row) continue;
        const last = cells[cells.length - 1];
        if (nx.col === last.col + 1) {
          cells.push({ col: nx.col, row: nx.row });
          consumed.add(j);
        } else break;
      }
      traps.push({
        kind: seed.kind,
        col: cells[0].col,
        row: seed.row,
        cells,
        span: cells.length,
        trigger: null,
        target: null,
        targets: [],
        dir: 0
      });
      continue;
    }

    // ---- 单格：按种类给专属字段 ----
    const base = {
      kind: seed.kind,
      col: seed.col,
      row: seed.row,
      cells: [{ col: seed.col, row: seed.row }],
      span: 1,
      trigger: { col: seed.col, row: seed.row },
      target: null,
      targets: [],
      dir: 0
    };

    if (seed.kind === "reverse") {
      // span 在引擎里是「反向持续秒数」，不是格数
      base.span = REVERSE_SECONDS;
    } else if (seed.kind === "gravity") {
      // dir = 0 表示「翻转当前值」
      base.dir = 0;
    } else if (seed.kind === "spring") {
      // 故意过冲：落点定在右侧 3 格（确定性）
      base.target = { x: clampCol(seed.col + 3) + 0.5, y: seed.row };
    } else if (seed.kind === "ghostspike") {
      base.trigger = null; // 由引擎按 revealRadius 自判
    }

    traps.push(base);
  }

  // 坠落天花板：由 ceilings 声明给出宽度，种子在 def.rows 里用 'e' 标位置
  for (const seed of ceilingSeeds) {
    const span = (def.ceilings && def.ceilings[`${seed.col},${seed.row}`]) || 3;
    const cells = [];
    for (let k = 0; k < span; k++) cells.push({ col: clampCol(seed.col + k), row: seed.row });
    // 从天花板格落到地面层所需的高度
    const floorRow = supportRow(map, seed.col, seed.row + 1);
    traps.push({
      kind: "ceiling",
      col: seed.col,
      row: seed.row,
      cells,
      span,
      trigger: { col: seed.col + Math.floor(span / 2), row: seed.row },
      target: null,
      targets: [],
      dir: 0,
      fallHeight: Math.max(2, floorRow - seed.row)
    });
  }

  // 移动终点：def.runDoor 可为 "auto"（默认朝远离玩家方向）或 { dir, range }
  const runDoor = def.runDoor;
  if (runDoor) {
    const dir = runDoor === "auto" ? 0 : runDoor.dir ?? 0;
    traps.push({
      kind: "rundoor",
      col: goalCol,
      row: goalRow,
      cells: [{ col: goalCol, row: goalRow }],
      span: 1,
      trigger: null,
      target: null,
      targets: [],
      dir
    });
  }

  // 传送错位：def.portals 是「传送门组」数组，每组是候选位数组：
  //   portals: [ [ {x,y}, {x,y}, ... ], ... ]
  // 第一个候选位 = 踩上去的入口，其余 = 落点（按顺序确定性轮换）。
  // 这里做形状归一化，容忍多包一层数组的写法。
  if (Array.isArray(def.portals) && def.portals.length) {
    for (const raw of def.portals) {
      // 逐层剥掉多余包裹，直到拿到「形如 {x,y} 的点数组」
      let node = raw;
      while (
        Array.isArray(node) &&
        node.length === 1 &&
        Array.isArray(node[0]) &&
        !(node[0].length && typeof node[0][0] === "number")
      ) {
        const inner = node[0];
        // 若内层是点数组（元素是 {x,y}）则停止剥
        if (inner.length && inner[0] && typeof inner[0] === "object" && "x" in inner[0]) break;
        node = inner;
      }
      const all = node
        .filter((p) => p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y))
        .map((p) => ({ x: p.x, y: p.y }));
      if (!all.length) continue;
      for (const p of all) ensureSupport(map, p.x, p.y);
      const from = all[0];
      const dests = all.slice(1);
      traps.push({
        kind: "portal",
        col: Math.floor(from.x),
        row: Math.floor(from.y),
        cells: [{ col: Math.floor(from.x), row: Math.floor(from.y) }],
        span: 1,
        trigger: { col: Math.floor(from.x), row: Math.floor(from.y) },
        target: dests[0] ?? null,
        targets: dests,
        dir: 0
      });
    }
  }

  // 蜡烛：地图上有 C 就用，否则自动找位
  let candle;
  if (candleCol >= 0) {
    candle = { x: candleCol + 0.5, y: candleRow - 0.45 };
  } else {
    candle = pickCandleSpot(map, goalCol);
  }

  // 出生脚底 y = 出生行号（站在该行地板上，脚底与行顶对齐）
  const spawnY = spawnRow;
  const goalY = goalRow;

  return {
    index: opts.index ?? 0,
    nodeId: def.nodeId ?? 0,
    name: def.name ?? "",
    w: COLS,
    h: ROWS,
    map,
    spawnX: spawnCol + 0.5,
    spawnY,
    goal: { x: goalCol + 0.5, y: goalY },
    candle,
    traps,
    runDoor: runDoor ?? null,
    ceilings: def.ceilings ?? null,
    portals: def.portals ?? null
  };
}

// =====================================================================
// 导出
// =====================================================================
export const LEVELS = DEFS.map((def, idx) => {
  const level = parseLevel(def, { index: idx });
  level.index = idx;
  return level;
});

export const LEVEL_COUNT = LEVELS.length;

export const NODES = Object.freeze([
  { id: 1, from: 0, to: 4, name: "蜜月期" },
  { id: 2, from: 5, to: 9, name: "脚下的谎言" },
  { id: 3, from: 10, to: 14, name: "头顶的恶意" },
  { id: 4, from: 15, to: 19, name: "看得见的骗局" },
  { id: 5, from: 20, to: 24, name: "终点的把戏" },
  { id: 6, from: 25, to: 29, name: "颠倒世界" },
  { id: 7, from: 30, to: 34, name: "左右为难" },
  { id: 8, from: 35, to: 39, name: "看不见的刀" },
  { id: 9, from: 40, to: 44, name: "空间错位" },
  { id: 10, from: 45, to: 49, name: "恶魔的毕业考" }
]);

export function getLevel(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT) return null;
  return LEVELS[index];
}

export function getNodeOf(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT) return null;
  return NODES.find((n) => index >= n.from && index <= n.to) ?? null;
}

export { DEFS };
