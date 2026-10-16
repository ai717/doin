// 记忆对决 · 博弈论残局关卡库 (Endgame Puzzles)
// 15 个精心编排的反向构造攻防残局，每关均经过 BFS 确定性验证可解。
// 规则：所有关卡轮到玩家行动，玩家必须运用翻查、侦察、偷牌、上锁的精确组合达成胜利。

export const PUZZLES = [
  {
    id: "puzzle_1",
    pairCount: 4,
    targetPairs: 3,
    titleKey: "puzzle1Title",
    descKey: "puzzle1Desc",
    hintKey: "puzzle1Hint",
    // 桌面 8 张牌，若干已知
    boardCards: [
      { id: 0, totem: "rune_star", state: "hidden", scouted: true },
      { id: 1, totem: "rune_eye", state: "hidden", scouted: false },
      { id: 2, totem: "rune_fire", state: "hidden", scouted: false },
      { id: 3, totem: "rune_star", state: "hidden", scouted: true },
      { id: 4, totem: "rune_crystal", state: "hidden", scouted: false },
      { id: 5, totem: "rune_eye", state: "hidden", scouted: false },
      { id: 6, totem: "rune_fire", state: "hidden", scouted: false },
      { id: 7, totem: "rune_crystal", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 0, pairs: 2, lockedPairs: 2, looseCards: 0 },
      opponent: { sp: 0, pairs: 2, lockedPairs: 2, looseCards: 0 },
    },
    // 获胜只需配对星钥 (0 和 3) 即可达到 3 对
    stars: { maxSteps: 1, minSp: 0 },
  },
  {
    id: "puzzle_2",
    pairCount: 4,
    targetPairs: 3,
    titleKey: "puzzle2Title",
    descKey: "puzzle2Desc",
    hintKey: "puzzle2Hint",
    // 对手已有 2 对且已有一对未锁，对手下回合翻出已知即可达到 3 对获胜！
    // 玩家有 2 SP，且尚未配对成功。玩家必须先使用 Steal 偷走对手未锁的一对，使对手对数降为 1！
    boardCards: [
      { id: 0, totem: "rune_star", state: "hidden", scouted: false },
      { id: 1, totem: "rune_eye", state: "hidden", scouted: false },
      { id: 2, totem: "rune_star", state: "hidden", scouted: false },
      { id: 3, totem: "rune_eye", state: "hidden", scouted: false },
      { id: 4, totem: "rune_sun", state: "hidden", scouted: false },
      { id: 5, totem: "rune_tear", state: "hidden", scouted: false },
      { id: 6, totem: "rune_sun", state: "hidden", scouted: false },
      { id: 7, totem: "rune_tear", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 2, pairs: 1, lockedPairs: 1, looseCards: 0 },
      opponent: { sp: 0, pairs: 2, lockedPairs: 1, looseCards: 0 },
    },
    stars: { maxSteps: 3, minSp: 0 },
  },
  {
    id: "puzzle_3",
    pairCount: 4,
    targetPairs: 3,
    titleKey: "puzzle3Title",
    descKey: "puzzle3Desc",
    hintKey: "puzzle3Hint",
    // 锁印先机：玩家已有 2 对（1 未锁），对手有 2 SP，下回合必偷玩家导致失败。
    // 玩家有 1 SP，必须立即 Lock 锁定自己的对，彻底封死对手的偷袭！
    boardCards: [
      { id: 0, totem: "rune_feather", state: "hidden", scouted: false },
      { id: 1, totem: "rune_feather", state: "hidden", scouted: false },
      { id: 2, totem: "rune_ring", state: "hidden", scouted: false },
      { id: 3, totem: "rune_ring", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 1, pairs: 2, lockedPairs: 1, looseCards: 0 },
      opponent: { sp: 2, pairs: 1, lockedPairs: 1, looseCards: 0 },
    },
    stars: { maxSteps: 2, minSp: 0 },
  },
  {
    id: "puzzle_4",
    pairCount: 5,
    targetPairs: 4,
    titleKey: "puzzle4Title",
    descKey: "puzzle4Desc",
    hintKey: "puzzle4Hint",
    // 侦察破局：关键牌在 1 号位还是 2 号位？玩家剩余 1 SP，侦察 1 号位确认后完成连击
    boardCards: [
      { id: 0, totem: "rune_tome", state: "hidden", scouted: true },
      { id: 1, totem: "rune_tome", state: "hidden", scouted: false },
      { id: 2, totem: "rune_lotus", state: "hidden", scouted: false },
      { id: 3, totem: "rune_lotus", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 1, pairs: 3, lockedPairs: 3, looseCards: 0 },
      opponent: { sp: 0, pairs: 2, lockedPairs: 2, looseCards: 0 },
    },
    stars: { maxSteps: 2, minSp: 0 },
  },
  {
    id: "puzzle_5",
    pairCount: 4,
    targetPairs: 3,
    titleKey: "puzzle5Title",
    descKey: "puzzle5Desc",
    hintKey: "puzzle5Hint",
    // 偷牌破杀与翻查斩杀双重奏
    boardCards: [
      { id: 0, totem: "rune_spark", state: "hidden", scouted: true },
      { id: 1, totem: "rune_spark", state: "hidden", scouted: true },
      { id: 2, totem: "rune_chalice", state: "hidden", scouted: false },
      { id: 3, totem: "rune_chalice", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 2, pairs: 2, lockedPairs: 2, looseCards: 0 },
      opponent: { sp: 0, pairs: 2, lockedPairs: 1, looseCards: 0 },
    },
    stars: { maxSteps: 1, minSp: 2 },
  },
  {
    id: "puzzle_6",
    pairCount: 5,
    targetPairs: 4,
    titleKey: "puzzle6Title",
    descKey: "puzzle6Desc",
    hintKey: "puzzle6Hint",
    boardCards: [
      { id: 0, totem: "rune_scale", state: "hidden", scouted: true },
      { id: 1, totem: "rune_compass", state: "hidden", scouted: false },
      { id: 2, totem: "rune_scale", state: "hidden", scouted: true },
      { id: 3, totem: "rune_compass", state: "hidden", scouted: false },
      { id: 4, totem: "rune_hourglass", state: "hidden", scouted: false },
      { id: 5, totem: "rune_hourglass", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 3, pairs: 3, lockedPairs: 2, looseCards: 0 },
      opponent: { sp: 2, pairs: 2, lockedPairs: 2, looseCards: 0 },
    },
    stars: { maxSteps: 2, minSp: 2 },
  },
  {
    id: "puzzle_7",
    pairCount: 5,
    targetPairs: 4,
    titleKey: "puzzle7Title",
    descKey: "puzzle7Desc",
    hintKey: "puzzle7Hint",
    boardCards: [
      { id: 0, totem: "rune_sun", state: "hidden", scouted: false },
      { id: 1, totem: "rune_sun", state: "hidden", scouted: false },
      { id: 2, totem: "rune_star", state: "hidden", scouted: true },
      { id: 3, totem: "rune_star", state: "hidden", scouted: true },
    ],
    players: {
      player: { sp: 1, pairs: 3, lockedPairs: 3, looseCards: 0 },
      opponent: { sp: 0, pairs: 3, lockedPairs: 2, looseCards: 0 },
    },
    stars: { maxSteps: 1, minSp: 1 },
  },
  {
    id: "puzzle_8",
    pairCount: 6,
    targetPairs: 4,
    titleKey: "puzzle8Title",
    descKey: "puzzle8Desc",
    hintKey: "puzzle8Hint",
    boardCards: [
      { id: 0, totem: "rune_eye", state: "hidden", scouted: true },
      { id: 1, totem: "rune_fire", state: "hidden", scouted: false },
      { id: 2, totem: "rune_eye", state: "hidden", scouted: true },
      { id: 3, totem: "rune_fire", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 4, pairs: 2, lockedPairs: 2, looseCards: 0 },
      opponent: { sp: 0, pairs: 3, lockedPairs: 1, looseCards: 0 },
    },
    stars: { maxSteps: 2, minSp: 2 },
  },
  {
    id: "puzzle_9",
    pairCount: 6,
    targetPairs: 5,
    titleKey: "puzzle9Title",
    descKey: "puzzle9Desc",
    hintKey: "puzzle9Hint",
    boardCards: [
      { id: 0, totem: "rune_ring", state: "hidden", scouted: true },
      { id: 1, totem: "rune_ring", state: "hidden", scouted: true },
      { id: 2, totem: "rune_crystal", state: "hidden", scouted: false },
      { id: 3, totem: "rune_crystal", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 2, pairs: 4, lockedPairs: 4, looseCards: 0 },
      opponent: { sp: 0, pairs: 3, lockedPairs: 3, looseCards: 0 },
    },
    stars: { maxSteps: 1, minSp: 2 },
  },
  {
    id: "puzzle_10",
    pairCount: 6,
    targetPairs: 5,
    titleKey: "puzzle10Title",
    descKey: "puzzle10Desc",
    hintKey: "puzzle10Hint",
    boardCards: [
      { id: 0, totem: "rune_lotus", state: "hidden", scouted: true },
      { id: 1, totem: "rune_scale", state: "hidden", scouted: false },
      { id: 2, totem: "rune_lotus", state: "hidden", scouted: true },
      { id: 3, totem: "rune_scale", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 1, pairs: 4, lockedPairs: 3, looseCards: 1 },
      opponent: { sp: 2, pairs: 3, lockedPairs: 3, looseCards: 0 },
    },
    stars: { maxSteps: 1, minSp: 1 },
  },
  {
    id: "puzzle_11",
    pairCount: 7,
    targetPairs: 5,
    titleKey: "puzzle11Title",
    descKey: "puzzle11Desc",
    hintKey: "puzzle11Hint",
    boardCards: [
      { id: 0, totem: "rune_feather", state: "hidden", scouted: true },
      { id: 1, totem: "rune_sun", state: "hidden", scouted: false },
      { id: 2, totem: "rune_feather", state: "hidden", scouted: true },
      { id: 3, totem: "rune_sun", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 3, pairs: 3, lockedPairs: 2, looseCards: 0 },
      opponent: { sp: 2, pairs: 4, lockedPairs: 2, looseCards: 0 },
    },
    stars: { maxSteps: 3, minSp: 1 },
  },
  {
    id: "puzzle_12",
    pairCount: 7,
    targetPairs: 5,
    titleKey: "puzzle12Title",
    descKey: "puzzle12Desc",
    hintKey: "puzzle12Hint",
    boardCards: [
      { id: 0, totem: "rune_spark", state: "hidden", scouted: true },
      { id: 1, totem: "rune_spark", state: "hidden", scouted: true },
      { id: 2, totem: "rune_tear", state: "hidden", scouted: false },
      { id: 3, totem: "rune_tear", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 2, pairs: 4, lockedPairs: 3, looseCards: 1 },
      opponent: { sp: 0, pairs: 4, lockedPairs: 4, looseCards: 0 },
    },
    stars: { maxSteps: 1, minSp: 2 },
  },
  {
    id: "puzzle_13",
    pairCount: 8,
    targetPairs: 6,
    titleKey: "puzzle13Title",
    descKey: "puzzle13Desc",
    hintKey: "puzzle13Hint",
    boardCards: [
      { id: 0, totem: "rune_compass", state: "hidden", scouted: true },
      { id: 1, totem: "rune_chalice", state: "hidden", scouted: false },
      { id: 2, totem: "rune_compass", state: "hidden", scouted: true },
      { id: 3, totem: "rune_chalice", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 5, pairs: 5, lockedPairs: 4, looseCards: 0 },
      opponent: { sp: 0, pairs: 4, lockedPairs: 4, looseCards: 0 },
    },
    stars: { maxSteps: 1, minSp: 5 },
  },
  {
    id: "puzzle_14",
    pairCount: 8,
    targetPairs: 6,
    titleKey: "puzzle14Title",
    descKey: "puzzle14Desc",
    hintKey: "puzzle14Hint",
    boardCards: [
      { id: 0, totem: "rune_tome", state: "hidden", scouted: true },
      { id: 1, totem: "rune_hourglass", state: "hidden", scouted: false },
      { id: 2, totem: "rune_tome", state: "hidden", scouted: true },
      { id: 3, totem: "rune_hourglass", state: "hidden", scouted: false },
    ],
    players: {
      player: { sp: 2, pairs: 4, lockedPairs: 4, looseCards: 0 },
      opponent: { sp: 0, pairs: 5, lockedPairs: 3, looseCards: 0 },
    },
    stars: { maxSteps: 2, minSp: 0 },
  },
  {
    id: "puzzle_15",
    pairCount: 8,
    targetPairs: 6,
    titleKey: "puzzle15Title",
    descKey: "puzzle15Desc",
    hintKey: "puzzle15Hint",
    boardCards: [
      { id: 0, totem: "rune_scale", state: "hidden", scouted: true },
      { id: 1, totem: "rune_scale", state: "hidden", scouted: true },
      { id: 2, totem: "rune_star", state: "hidden", scouted: true },
      { id: 3, totem: "rune_star", state: "hidden", scouted: true },
    ],
    players: {
      player: { sp: 1, pairs: 4, lockedPairs: 4, looseCards: 0 },
      opponent: { sp: 0, pairs: 5, lockedPairs: 5, looseCards: 0 },
    },
    stars: { maxSteps: 2, minSp: 1 },
  },
];

// 将残局配置加载为游戏状态
export function loadPuzzleGame(puzzleIndex = 0) {
  const puzzle = PUZZLES[puzzleIndex] || PUZZLES[0];
  const board = puzzle.boardCards.map((c, index) => ({
    id: c.id,
    index,
    totem: c.totem,
    pairId: Math.floor(c.id / 2),
    state: c.state || "hidden",
    scoutedBy: {
      player: Boolean(c.scouted),
      opponent: false,
    },
  }));

  return {
    board,
    pairCount: puzzle.pairCount,
    targetPairs: puzzle.targetPairs,
    activePlayer: "player",
    startingPlayer: "player",
    turnPhase: "action_select",
    selectedFirstIndex: null,
    selectedSecondIndex: null,
    comboCount: 0,
    turnCount: 1,
    winner: null,
    winReason: null,
    players: {
      player: {
        sp: puzzle.players.player.sp,
        pairs: puzzle.players.player.pairs,
        lockedPairs: puzzle.players.player.lockedPairs,
        looseCards: puzzle.players.player.looseCards,
        mistakes: 0,
      },
      opponent: {
        sp: puzzle.players.opponent.sp,
        pairs: puzzle.players.opponent.pairs,
        lockedPairs: puzzle.players.opponent.lockedPairs,
        looseCards: puzzle.players.opponent.looseCards,
        mistakes: 0,
      },
    },
    lastAction: null,
    puzzleId: puzzle.id,
    starsCriteria: puzzle.stars,
  };
}
