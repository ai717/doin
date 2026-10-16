// 记忆对决 · 纯规则引擎 (DOM-free, Storage-free)
// 包含棋盘生成、洗牌 (Derangement)、四项核心行动 (Flip/Scout/Steal/Lock)、连击与胜负判定。

export const TOTEMS = [
  "rune_star",
  "rune_eye",
  "rune_fire",
  "rune_crystal",
  "rune_ring",
  "rune_feather",
  "rune_sun",
  "rune_tear",
  "rune_hourglass",
  "rune_tome",
  "rune_compass",
  "rune_chalice",
  "rune_spark",
  "rune_lotus",
  "rune_scale",
];

// 简易确定性随机发生器 Mulberry32
export function createRng(seed = 123456789) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 无不动点打乱 (Derangement 洗牌)：保证没有任何一张牌停留在初始索引
export function derangementShuffle(array, rng = Math.random) {
  const n = array.length;
  if (n <= 1) return [...array];
  let result = [...array];
  let tries = 0;
  while (tries < 100) {
    tries++;
    // Fisher-Yates
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    // 检查是否全不动点都不在原位
    let hasFixedPoint = false;
    for (let i = 0; i < n; i++) {
      if (result[i].originalIndex === i) {
        hasFixedPoint = true;
        break;
      }
    }
    if (!hasFixedPoint) {
      return result;
    }
  }
  // 兜底循环移位避免不动点
  return result.map((_, i) => result[(i + 1) % n]);
}

// 创建新对局状态
export function createGame(options = {}) {
  const {
    pairCount = 10, // 10 pairs (20 cards) / 12 / 15
    targetPairs = 5, // 5 / 6 / 7
    startingSp = 5,
    seed = Date.now(),
    firstPlayer = "player",
  } = options;

  const rng = typeof seed === "function" ? seed : createRng(typeof seed === "number" ? seed : 12345);
  const selectedTotems = TOTEMS.slice(0, pairCount);
  
  // 生成初始配对序列
  const initialCards = [];
  let cardId = 0;
  for (let p = 0; p < pairCount; p++) {
    const totem = selectedTotems[p];
    for (let c = 0; c < 2; c++) {
      initialCards.push({
        id: cardId,
        originalIndex: cardId,
        totem,
        pairId: p,
      });
      cardId++;
    }
  }

  // 打乱牌面
  const shuffled = derangementShuffle(initialCards, rng);

  const board = shuffled.map((c, index) => ({
    id: c.id,
    index,
    totem: c.totem,
    pairId: c.pairId,
    state: "hidden", // hidden | revealed | removed
    scoutedBy: {
      player: false,
      opponent: false,
    },
  }));

  return {
    board,
    pairCount,
    targetPairs,
    activePlayer: firstPlayer, // "player" | "opponent"
    startingPlayer: firstPlayer,
    turnPhase: "action_select", // "action_select" | "first_flipped" | "exposure_window"
    selectedFirstIndex: null,
    selectedSecondIndex: null,
    comboCount: 0,
    turnCount: 1,
    winner: null, // "player" | "opponent" | "tie"
    winReason: null, // "target_reached" | "board_cleared"
    players: {
      player: {
        sp: startingSp,
        pairs: 0,
        lockedPairs: 0,
        looseCards: 0,
        mistakes: 0,
      },
      opponent: {
        sp: startingSp,
        pairs: 0,
        lockedPairs: 0,
        looseCards: 0,
        mistakes: 0,
      },
    },
    lastAction: null,
  };
}

// 检查是否有人获胜或终局
export function checkWinCondition(state) {
  const { player, opponent } = state.players;
  const target = state.targetPairs;

  // 1. 率先凑满目标完整对
  if (player.pairs >= target && opponent.pairs >= target) {
    if (player.pairs > opponent.pairs) {
      return { winner: "player", reason: "target_reached" };
    } else if (opponent.pairs > player.pairs) {
      return { winner: "opponent", reason: "target_reached" };
    }
  } else if (player.pairs >= target) {
    return { winner: "player", reason: "target_reached" };
  } else if (opponent.pairs >= target) {
    return { winner: "opponent", reason: "target_reached" };
  }

  // 2. 检查桌面是否还有未移除的卡牌
  const remainingCards = state.board.filter((c) => c.state !== "removed");
  if (remainingCards.length < 2) {
    // 桌面牌清算
    if (player.pairs > opponent.pairs) {
      return { winner: "player", reason: "board_cleared" };
    } else if (opponent.pairs > player.pairs) {
      return { winner: "opponent", reason: "board_cleared" };
    }
    // 完整对相同，比散牌
    if (player.looseCards > opponent.looseCards) {
      return { winner: "player", reason: "board_cleared" };
    } else if (opponent.looseCards > player.looseCards) {
      return { winner: "opponent", reason: "board_cleared" };
    }
    // 依然平局，后手方胜
    const tieWinner = state.startingPlayer === "player" ? "opponent" : "player";
    return { winner: tieWinner, reason: "board_cleared" };
  }

  return { winner: null, reason: null };
}

// 深度克隆状态保证纯函数
export function cloneState(state) {
  return {
    ...state,
    board: state.board.map((c) => ({
      ...c,
      scoutedBy: { ...c.scoutedBy },
    })),
    players: {
      player: { ...state.players.player },
      opponent: { ...state.players.opponent },
    },
    lastAction: state.lastAction ? { ...state.lastAction } : null,
  };
}

// 翻牌操作 (翻第一张或翻第二张)
export function applyFlipCard(prevState, cardIndex) {
  if (prevState.winner) return { state: prevState, action: null };
  const card = prevState.board[cardIndex];
  if (!card || card.state === "removed") return { state: prevState, action: null };

  const state = cloneState(prevState);
  const currentActor = state.activePlayer;

  // 阶段 1：首张翻牌
  if (state.turnPhase === "action_select") {
    if (card.state !== "hidden") return { state: prevState, action: null };

    state.board[cardIndex].state = "revealed";
    state.selectedFirstIndex = cardIndex;
    state.turnPhase = "first_flipped";

    const action = {
      type: "flip_first",
      actor: currentActor,
      cardIndex,
      totem: card.totem,
    };
    state.lastAction = action;
    return { state, action };
  }

  // 阶段 2：已翻一张
  if (state.turnPhase === "first_flipped") {
    // 容错：点回同一张牌 = 取消翻开，盖回
    if (state.selectedFirstIndex === cardIndex) {
      state.board[cardIndex].state = "hidden";
      state.selectedFirstIndex = null;
      state.turnPhase = "action_select";
      const action = {
        type: "flip_cancel",
        actor: currentActor,
        cardIndex,
      };
      state.lastAction = action;
      return { state, action };
    }

    if (card.state !== "hidden") return { state: prevState, action: null };

    const firstIndex = state.selectedFirstIndex;
    const firstCard = state.board[firstIndex];
    state.board[cardIndex].state = "revealed";
    state.selectedSecondIndex = cardIndex;

    // 判定是否配对
    if (firstCard.totem === card.totem) {
      // 配对成功！
      state.board[firstIndex].state = "removed";
      state.board[cardIndex].state = "removed";
      state.players[currentActor].pairs += 1;
      state.comboCount += 1;
      state.selectedFirstIndex = null;
      state.selectedSecondIndex = null;
      state.turnPhase = "action_select"; // 保留连击权，可继续选择主行动

      const action = {
        type: "match_success",
        actor: currentActor,
        firstIndex,
        secondIndex: cardIndex,
        totem: card.totem,
        pairs: state.players[currentActor].pairs,
        combo: state.comboCount,
      };
      state.lastAction = action;

      // 获胜检查
      const win = checkWinCondition(state);
      if (win.winner) {
        state.winner = win.winner;
        state.winReason = win.reason;
      }

      return { state, action };
    } else {
      // 配对失败，进入暴露窗口
      state.players[currentActor].mistakes += 1;
      state.turnPhase = "exposure_window";

      const action = {
        type: "match_fail",
        actor: currentActor,
        firstIndex,
        secondIndex: cardIndex,
        firstTotem: firstCard.totem,
        secondTotem: card.totem,
      };
      state.lastAction = action;
      return { state, action };
    }
  }

  return { state: prevState, action: null };
}

// 结束暴露窗口，将翻错的牌盖回，换手
export function applyEndExposure(prevState) {
  if (prevState.winner || prevState.turnPhase !== "exposure_window") {
    return { state: prevState, action: null };
  }

  const state = cloneState(prevState);
  const firstIndex = state.selectedFirstIndex;
  const secondIndex = state.selectedSecondIndex;

  if (firstIndex !== null && state.board[firstIndex].state === "revealed") {
    state.board[firstIndex].state = "hidden";
  }
  if (secondIndex !== null && state.board[secondIndex].state === "revealed") {
    state.board[secondIndex].state = "hidden";
  }

  state.selectedFirstIndex = null;
  state.selectedSecondIndex = null;
  state.comboCount = 0;
  state.turnCount += 1;
  state.activePlayer = state.activePlayer === "player" ? "opponent" : "player";
  state.turnPhase = "action_select";

  const action = {
    type: "end_exposure",
    nextActor: state.activePlayer,
  };
  state.lastAction = action;

  // 终局检查
  const win = checkWinCondition(state);
  if (win.winner) {
    state.winner = win.winner;
    state.winReason = win.reason;
  }

  return { state, action };
}

// 侦察行动 (Scout): 消耗 1 SP，偷看 1 张暗牌
export function applyScout(prevState, cardIndex) {
  if (prevState.winner || prevState.turnPhase !== "action_select") {
    return { state: prevState, action: null };
  }

  const actor = prevState.activePlayer;
  const playerState = prevState.players[actor];
  if (playerState.sp < 1) return { state: prevState, action: null };

  const targetCard = prevState.board[cardIndex];
  if (!targetCard || targetCard.state !== "hidden") {
    return { state: prevState, action: null };
  }

  const state = cloneState(prevState);
  state.players[actor].sp -= 1;
  state.board[cardIndex].scoutedBy[actor] = true;
  state.comboCount = 0;
  state.turnCount += 1;
  state.activePlayer = actor === "player" ? "opponent" : "player";
  state.turnPhase = "action_select";

  const action = {
    type: "scout",
    actor,
    cardIndex,
    totem: targetCard.totem,
    nextActor: state.activePlayer,
  };
  state.lastAction = action;

  return { state, action };
}

// 偷牌行动 (Steal): 消耗 2 SP，从对方未上锁完整对中偷走 1 张
export function applySteal(prevState) {
  if (prevState.winner || prevState.turnPhase !== "action_select") {
    return { state: prevState, action: null };
  }

  const actor = prevState.activePlayer;
  const victim = actor === "player" ? "opponent" : "player";

  const actorState = prevState.players[actor];
  const victimState = prevState.players[victim];

  if (actorState.sp < 2) return { state: prevState, action: null };
  const unlockedPairs = victimState.pairs - victimState.lockedPairs;
  if (unlockedPairs <= 0) return { state: prevState, action: null };

  const state = cloneState(prevState);
  state.players[actor].sp -= 2;
  state.players[victim].pairs -= 1;
  state.players[actor].looseCards += 1;
  state.comboCount = 0;
  state.turnCount += 1;
  state.activePlayer = victim;
  state.turnPhase = "action_select";

  const action = {
    type: "steal",
    actor,
    victim,
    actorLoose: state.players[actor].looseCards,
    victimPairs: state.players[victim].pairs,
    nextActor: state.activePlayer,
  };
  state.lastAction = action;

  // 终局检查
  const win = checkWinCondition(state);
  if (win.winner) {
    state.winner = win.winner;
    state.winReason = win.reason;
  }

  return { state, action };
}

// 上锁行动 (Lock): 消耗 1 SP，给己方 1 个未上锁完整对加锁
export function applyLock(prevState) {
  if (prevState.winner || prevState.turnPhase !== "action_select") {
    return { state: prevState, action: null };
  }

  const actor = prevState.activePlayer;
  const actorState = prevState.players[actor];
  if (actorState.sp < 1) return { state: prevState, action: null };

  const unlockedPairs = actorState.pairs - actorState.lockedPairs;
  if (unlockedPairs <= 0) return { state: prevState, action: null };

  const state = cloneState(prevState);
  state.players[actor].sp -= 1;
  state.players[actor].lockedPairs += 1;
  state.comboCount = 0;
  state.turnCount += 1;
  state.activePlayer = actor === "player" ? "opponent" : "player";
  state.turnPhase = "action_select";

  const action = {
    type: "lock",
    actor,
    lockedPairs: state.players[actor].lockedPairs,
    nextActor: state.activePlayer,
  };
  state.lastAction = action;

  return { state, action };
}
