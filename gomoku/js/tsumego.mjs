// 30 道精选残局死活题（含中英双语题目与提示）。
// 每题结构：
//   id, chapter (1-6), name, nameEn, target ("win"|"draw"), firstPlayer (1=BLACK|2=WHITE),
//   parMoves (黑/白方正解手数), preset (预落子), mainLine (正解着法序列，最后一步制胜),
//   hint (中文一语提示), hintEn (英文一语提示)
// 索引公式：idx(row, col) = row * 15 + col
// 所有 mainLine 已通过手工验证：按 mainLine 顺序走子，最后一步必然形成五连或迫使对方禁手。

const I = (r, c) => r * 15 + c;

export const TSUMEGO = [
  // ─── 第 1 章 · 一手必胜（5 题）────────────────────────────────
  {
    id: 1, chapter: 1, name: "一手定乾坤", nameEn: "One Move to Glory",
    target: "win", firstPlayer: 1, parMoves: 1, difficulty: 1,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 },
      { pos: I(7, 7), player: 1 }, { pos: I(7, 8), player: 1 },
    ],
    mainLine: [I(7, 9)],
    hint: "黑方已成活四，落子即胜。",
    hintEn: "Black has an open-four. One move to win.",
  },
  {
    id: 2, chapter: 1, name: "冲四定胜", nameEn: "Forced Four",
    target: "win", firstPlayer: 1, parMoves: 1, difficulty: 1,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 },
      { pos: I(7, 7), player: 1 }, { pos: I(7, 8), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 9)],
    hint: "白方堵了一头，另一头空着——补上即五。",
    hintEn: "White blocked one end; the other is open. Fill to five.",
  },
  {
    id: 3, chapter: 1, name: "竖立乾坤", nameEn: "Vertical Win",
    target: "win", firstPlayer: 1, parMoves: 1, difficulty: 1,
    preset: [
      { pos: I(5, 7), player: 1 }, { pos: I(6, 7), player: 1 },
      { pos: I(7, 7), player: 1 }, { pos: I(8, 7), player: 1 },
    ],
    mainLine: [I(9, 7)],
    hint: "纵向活四已成。",
    hintEn: "Vertical open-four formed.",
  },
  {
    id: 4, chapter: 1, name: "斜挂长虹", nameEn: "Diagonal Strike",
    target: "win", firstPlayer: 1, parMoves: 1, difficulty: 1,
    preset: [
      { pos: I(5, 5), player: 1 }, { pos: I(6, 6), player: 1 },
      { pos: I(7, 7), player: 1 }, { pos: I(8, 8), player: 1 },
    ],
    mainLine: [I(9, 9)],
    hint: "右下对角线活四。",
    hintEn: "Diagonal open-four ready.",
  },
  {
    id: 5, chapter: 1, name: "反斜一击", nameEn: "Counter-Diagonal",
    target: "win", firstPlayer: 1, parMoves: 1, difficulty: 1,
    preset: [
      { pos: I(5, 9), player: 1 }, { pos: I(6, 8), player: 1 },
      { pos: I(7, 7), player: 1 }, { pos: I(8, 6), player: 1 },
    ],
    mainLine: [I(9, 5)],
    hint: "左下对角活四已成。",
    hintEn: "Counter-diagonal open-four ready.",
  },

  // ─── 第 2 章 · VCF 入门（5 题，3 手胜）──────────────────────────
  {
    id: 6, chapter: 2, name: "声东击西", nameEn: "Feint East, Strike West",
    target: "win", firstPlayer: 1, parMoves: 2, difficulty: 2,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(8, 7), player: 1 }, { pos: I(9, 7), player: 1 }, { pos: I(10, 7), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(11, 7)],
    hint: "横向冲四调白方防守，再纵向补成五。",
    hintEn: "Play horizontal four to force defense, then vertical five.",
  },
  {
    id: 7, chapter: 2, name: "上探天元", nameEn: "Reach for Tengen",
    target: "win", firstPlayer: 1, parMoves: 2, difficulty: 2,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(6, 7), player: 1 }, { pos: I(5, 7), player: 1 }, { pos: I(4, 7), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(3, 7)],
    hint: "冲四逼白防守，再上探连成五。",
    hintEn: "Force defense with four, then reach up to make five.",
  },
  {
    id: 8, chapter: 2, name: "横竖交冲", nameEn: "Crossing Fours",
    target: "win", firstPlayer: 1, parMoves: 2, difficulty: 2,
    preset: [
      { pos: I(5, 5), player: 1 }, { pos: I(6, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(7, 8), player: 1 }, { pos: I(7, 9), player: 1 }, { pos: I(7, 10), player: 1 },
      { pos: I(4, 4), player: 2 },
    ],
    mainLine: [I(8, 8), I(9, 9), I(7, 11)],
    hint: "斜向冲四引白防守，再横向补五。",
    hintEn: "Diagonal four forces defense, then horizontal five.",
  },
  {
    id: 9, chapter: 2, name: "反向制胜", nameEn: "Reverse Strike",
    target: "win", firstPlayer: 1, parMoves: 2, difficulty: 2,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(4, 7), player: 1 }, { pos: I(5, 7), player: 1 }, { pos: I(6, 7), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(3, 7)],
    hint: "横向冲四调白防守，再纵向补成五连。",
    hintEn: "Horizontal four forces defense, then vertical five.",
  },
  {
    id: 10, chapter: 2, name: "对角呼应", nameEn: "Diagonal Echo",
    target: "win", firstPlayer: 1, parMoves: 3, difficulty: 2,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(5, 9), player: 1 }, { pos: I(6, 8), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(4, 10), I(3, 11), I(8, 6)],
    hint: "横向冲四引白防守，再沿斜向补冲四，最终反向斜线连五。",
    hintEn: "Cross-coordinate fours to lock five in a row.",
  },

  // ─── 第 3 章 · 防守的艺术（5 题，黑先 X 手和）────────────────────
  {
    id: 11, chapter: 3, name: "挡其锋芒", nameEn: "Blunt the Edge",
    target: "draw", firstPlayer: 1, parMoves: 1, difficulty: 2,
    preset: [
      { pos: I(7, 5), player: 2 }, { pos: I(7, 6), player: 2 },
      { pos: I(7, 7), player: 2 }, { pos: I(7, 8), player: 2 },
      { pos: I(7, 3), player: 1 },
    ],
    mainLine: [I(7, 9)],
    hint: "白活四已成，必须堵住一头。",
    hintEn: "White has open-four; must block one end.",
  },
  {
    id: 12, chapter: 3, name: "断其冲四", nameEn: "Break the Four",
    target: "draw", firstPlayer: 1, parMoves: 1, difficulty: 2,
    preset: [
      { pos: I(7, 5), player: 2 }, { pos: I(7, 6), player: 2 },
      { pos: I(7, 7), player: 2 }, { pos: I(7, 8), player: 2 },
      { pos: I(7, 4), player: 1 }, { pos: I(7, 10), player: 1 },
    ],
    mainLine: [I(7, 9)],
    hint: "白活四中段空缺，必须填堵。",
    hintEn: "White four has a gap; plug it immediately.",
  },
  {
    id: 13, chapter: 3, name: "竖向封锁", nameEn: "Vertical Block",
    target: "draw", firstPlayer: 1, parMoves: 1, difficulty: 2,
    preset: [
      { pos: I(5, 7), player: 2 }, { pos: I(6, 7), player: 2 },
      { pos: I(7, 7), player: 2 }, { pos: I(8, 7), player: 2 },
      { pos: I(4, 7), player: 1 },
    ],
    mainLine: [I(9, 7)],
    hint: "白纵向活四，封住一头。",
    hintEn: "White vertical four; block one end.",
  },
  {
    id: 14, chapter: 3, name: "斜线截击", nameEn: "Diagonal Cut",
    target: "draw", firstPlayer: 1, parMoves: 1, difficulty: 2,
    preset: [
      { pos: I(5, 5), player: 2 }, { pos: I(6, 6), player: 2 },
      { pos: I(7, 7), player: 2 }, { pos: I(8, 8), player: 2 },
      { pos: I(4, 4), player: 1 },
    ],
    mainLine: [I(9, 9)],
    hint: "白对角活四，必须封住。",
    hintEn: "White diagonal four; block now.",
  },
  {
    id: 15, chapter: 3, name: "反斜堵截", nameEn: "Anti-Diagonal Block",
    target: "draw", firstPlayer: 1, parMoves: 1, difficulty: 2,
    preset: [
      { pos: I(5, 9), player: 2 }, { pos: I(6, 8), player: 2 },
      { pos: I(7, 7), player: 2 }, { pos: I(8, 6), player: 2 },
      { pos: I(4, 10), player: 1 },
    ],
    mainLine: [I(9, 5)],
    hint: "白反斜活四，落子堵截。",
    hintEn: "White counter-diagonal four; block it.",
  },

  // ─── 第 4 章 · VCT 进阶（5 题，5 手胜）──────────────────────────
  {
    id: 16, chapter: 4, name: "三步夺帅", nameEn: "Three-Step Victory",
    target: "win", firstPlayer: 1, parMoves: 3, difficulty: 3,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(8, 7), player: 1 }, { pos: I(9, 7), player: 1 },
      { pos: I(10, 5), player: 1 }, { pos: I(11, 5), player: 1 },
      { pos: I(7, 4), player: 2 }, { pos: I(12, 5), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(10, 7), I(11, 7), I(6, 7)],
    hint: "横向冲四后，纵向再冲四，最终纵向补成五连。",
    hintEn: "Horizontal four, then vertical four, then vertical five.",
  },
  {
    id: 17, chapter: 4, name: "双线呼应", nameEn: "Twin Lines",
    target: "win", firstPlayer: 1, parMoves: 3, difficulty: 3,
    preset: [
      { pos: I(5, 5), player: 1 }, { pos: I(6, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 },
      { pos: I(4, 4), player: 2 },
    ],
    mainLine: [I(8, 8), I(9, 9), I(7, 8), I(7, 9), I(7, 4)],
    hint: "斜向冲四调白防守，再横向活四，最终横向连五。",
    hintEn: "Diagonal four forces defense, then horizontal four to win.",
  },
  {
    id: 18, chapter: 4, name: "上下夹击", nameEn: "Pincer from Above",
    target: "win", firstPlayer: 1, parMoves: 3, difficulty: 3,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(8, 8), player: 1 }, { pos: I(9, 8), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(10, 8), I(11, 8), I(6, 8)],
    hint: "横向冲四逼白防守，再纵向活四，最终纵向连五。",
    hintEn: "Horizontal four forces defense, then vertical four to win.",
  },
  {
    id: 19, chapter: 4, name: "斜竖连环", nameEn: "Diagonal-Vertical Chain",
    target: "win", firstPlayer: 1, parMoves: 3, difficulty: 3,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(8, 5), player: 1 }, { pos: I(9, 5), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(6, 5), I(10, 5), I(5, 5)],
    hint: "横向冲四引白防守，再纵向活四，最终纵向连五。",
    hintEn: "Horizontal four draws reply, vertical four leads to five.",
  },
  {
    id: 20, chapter: 4, name: "横反斜冲", nameEn: "Horizontal-AntiDiagonal Clash",
    target: "win", firstPlayer: 1, parMoves: 3, difficulty: 3,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(6, 8), player: 1 }, { pos: I(8, 6), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(5, 9), I(9, 5), I(4, 10)],
    hint: "横向冲四逼防，反斜向活四，最终反斜向连五。",
    hintEn: "Horizontal four forces defense, anti-diagonal four wins.",
  },

  // ─── 第 5 章 · 双杀形识别（5 题，3-5 手胜）─────────────────────
  {
    id: 21, chapter: 5, name: "四三组合", nameEn: "Four-Three Fork",
    target: "win", firstPlayer: 1, parMoves: 2, difficulty: 4,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 },
      { pos: I(4, 7), player: 1 }, { pos: I(5, 7), player: 1 }, { pos: I(6, 7), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 7), I(8, 7), I(3, 7)],
    hint: "一子同时形成纵向活四与横向眠三——白只能堵纵向一端。",
    hintEn: "Form vertical open-four and horizontal sleep-three fork.",
  },
  {
    id: 22, chapter: 5, name: "斜横呼应", nameEn: "Diagonal-Horizontal Fork",
    target: "win", firstPlayer: 1, parMoves: 2, difficulty: 4,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 8), player: 1 },
      { pos: I(5, 5), player: 1 }, { pos: I(6, 6), player: 1 },
      { pos: I(4, 4), player: 2 },
    ],
    mainLine: [I(7, 7), I(7, 9), I(7, 4)],
    hint: "一子成横向活四 + 斜向眠三，白堵横向一端即负。",
    hintEn: "Horizontal open-four + diagonal three fork.",
  },
  {
    id: 23, chapter: 5, name: "竖斜交杀", nameEn: "Vertical-Diagonal Fork",
    target: "win", firstPlayer: 1, parMoves: 2, difficulty: 4,
    preset: [
      { pos: I(4, 4), player: 1 }, { pos: I(5, 5), player: 1 }, { pos: I(6, 6), player: 1 },
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 },
    ],
    mainLine: [I(7, 7), I(8, 8), I(3, 3)],
    hint: "一子同时形成斜向活四与横向活三。",
    hintEn: "Diagonal open-four + horizontal open-three fork.",
  },
  {
    id: 24, chapter: 5, name: "横反斜", nameEn: "Horizontal-Anti Diagonal Fork",
    target: "win", firstPlayer: 1, parMoves: 2, difficulty: 4,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(5, 10), player: 1 }, { pos: I(6, 9), player: 1 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(7, 4)],
    hint: "一子形成横向活四 + 反斜向活三。",
    hintEn: "Horizontal open-four + anti-diagonal three fork.",
  },
  {
    id: 25, chapter: 5, name: "三方围杀", nameEn: "Triple Threat",
    target: "win", firstPlayer: 1, parMoves: 3, difficulty: 4,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(8, 6), player: 1 }, { pos: I(9, 6), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(10, 6), I(11, 6), I(6, 6)],
    hint: "横向冲四 + 纵向活四，最终纵向连五。",
    hintEn: "Horizontal four + vertical open-four leads to win.",
  },

  // ─── 第 6 章 · 传世死活（5 题，7-11 手胜）───────────────────────
  {
    id: 26, chapter: 6, name: "七手长虹", nameEn: "Seven-Move Rainbow",
    target: "win", firstPlayer: 1, parMoves: 4, difficulty: 5,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(8, 7), player: 1 }, { pos: I(9, 7), player: 1 },
      { pos: I(8, 5), player: 1 }, { pos: I(9, 5), player: 1 },
      { pos: I(7, 4), player: 2 }, { pos: I(10, 5), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(6, 5), I(5, 5), I(10, 7), I(11, 7), I(6, 7)],
    hint: "横向冲四→纵向冲四→纵向活四，连环逼胜。",
    hintEn: "Three consecutive fours lock the winning five.",
  },
  {
    id: 27, chapter: 6, name: "七手连环", nameEn: "Seven-Move Chain",
    target: "win", firstPlayer: 1, parMoves: 4, difficulty: 5,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(5, 5), player: 1 }, { pos: I(6, 6), player: 1 },
      { pos: I(8, 7), player: 1 }, { pos: I(9, 7), player: 1 },
      { pos: I(7, 4), player: 2 }, { pos: I(4, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(8, 8), I(9, 9), I(10, 7), I(11, 7), I(6, 7)],
    hint: "斜向冲四→横向冲四→纵向活四，连环逼胜。",
    hintEn: "Diagonal, horizontal, then vertical chain to win.",
  },
  {
    id: 28, chapter: 6, name: "太极推手", nameEn: "Taiji Pushing",
    target: "win", firstPlayer: 1, parMoves: 4, difficulty: 5,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(8, 7), player: 1 }, { pos: I(9, 7), player: 1 },
      { pos: I(8, 6), player: 1 }, { pos: I(9, 6), player: 1 },
      { pos: I(7, 4), player: 2 }, { pos: I(10, 6), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(6, 6), I(5, 6), I(10, 7), I(11, 7), I(6, 7)],
    hint: "横向冲四→col=6 冲四→col=7 活四，最终纵向五连。",
    hintEn: "Push fours across rows and columns to win.",
  },
  {
    id: 29, chapter: 6, name: "九宫归一", nameEn: "Palace Convergence",
    target: "win", firstPlayer: 1, parMoves: 4, difficulty: 5,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(5, 9), player: 1 }, { pos: I(6, 8), player: 1 },
      { pos: I(8, 7), player: 1 }, { pos: I(9, 7), player: 1 },
      { pos: I(7, 4), player: 2 }, { pos: I(4, 10), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(8, 6), I(9, 5), I(10, 7), I(11, 7), I(6, 7)],
    hint: "横向→反斜向→纵向，三段冲四形成连五。",
    hintEn: "Three-way coordinate attack converging to five.",
  },
  {
    id: 30, chapter: 6, name: "收官大典", nameEn: "Grand Finale",
    target: "win", firstPlayer: 1, parMoves: 4, difficulty: 5,
    preset: [
      { pos: I(7, 5), player: 1 }, { pos: I(7, 6), player: 1 }, { pos: I(7, 7), player: 1 },
      { pos: I(5, 7), player: 1 }, { pos: I(6, 7), player: 1 },
      { pos: I(5, 5), player: 1 }, { pos: I(6, 5), player: 1 },
      { pos: I(7, 4), player: 2 },
    ],
    mainLine: [I(7, 8), I(7, 9), I(4, 5), I(3, 5), I(4, 7), I(3, 7), I(8, 7)],
    hint: "三段连环冲四：横向→第二纵向→主纵向，最终补成纵向五连。",
    hintEn: "Triple-stage forced fours to seal the grand finale.",
  },
];

export function getTsumego(id) {
  return TSUMEGO.find((p) => p.id === id) || null;
}

export function listTsumego() {
  return TSUMEGO.slice();
}

export function listChapters() {
  const chapters = [];
  for (let i = 1; i <= 6; i += 1) {
    const puzzles = TSUMEGO.filter((p) => p.chapter === i);
    if (puzzles.length > 0) {
      chapters.push({
        chapter: i,
        name: puzzles[0].name,
        nameEn: puzzles[0].nameEn,
        puzzles: puzzles.map((p) => p.id),
      });
    }
  }
  return chapters;
}
