// 记忆对决 · AI 决策系统 (DOM-free, Storage-free)
// 包含三档阶梯 AI：新秀 (Novice)、老手 (Veteran)、大师 (Master)

export const AI_TIERS = {
  novice: {
    id: "ai_novice",
    nameKey: "aiNoviceName",
    titleKey: "aiNoviceTitle",
    memoryLimit: 4,
    mistakeRate: 0.2,
    maxSpUse: 2,
  },
  veteran: {
    id: "ai_veteran",
    nameKey: "aiVeteranName",
    titleKey: "aiVeteranTitle",
    memoryLimit: 30,
    mistakeRate: 0.05,
    maxSpUse: 4,
  },
  master: {
    id: "ai_master",
    nameKey: "aiMasterName",
    titleKey: "aiMasterTitle",
    memoryLimit: 60,
    mistakeRate: 0.0,
    maxSpUse: 5,
  },
};

// AI 记忆条目：存储 AI 所掌握的卡牌位置与图腾
export function createAiMemory() {
  return {
    knownCards: new Map(), // cardIndex => { totem, timestamp }
    totalScoutsUsed: 0,
    totalStealsUsed: 0,
    totalLocksUsed: 0,
  };
}

// 更新 AI 记忆（当有牌被翻开、侦察、或移除时）
export function updateAiMemory(memory, state, aiTierKey = "veteran", timeStep = 1) {
  const tier = AI_TIERS[aiTierKey] || AI_TIERS.veteran;
  const newMemory = {
    knownCards: new Map(memory.knownCards),
    totalScoutsUsed: memory.totalScoutsUsed,
    totalStealsUsed: memory.totalStealsUsed,
    totalLocksUsed: memory.totalLocksUsed,
  };

  // 1. 清除已被移除或不再存在的牌
  for (const [idx] of newMemory.knownCards.entries()) {
    const card = state.board[idx];
    if (!card || card.state === "removed") {
      newMemory.knownCards.delete(idx);
    }
  }

  // 2. 观察当前桌面上处于 revealed 状态的牌以及 AI 自己 scout 过的牌
  state.board.forEach((card, idx) => {
    if (card.state === "removed") return;
    const isAiScouted = card.scoutedBy && card.scoutedBy.opponent;
    if (card.state === "revealed" || isAiScouted) {
      newMemory.knownCards.set(idx, {
        totem: card.totem,
        time: timeStep,
      });
    }
  });

  // 3. 如果超过记忆容量限制，淘汰最久未见的一张
  if (tier.memoryLimit && newMemory.knownCards.size > tier.memoryLimit) {
    const entries = [...newMemory.knownCards.entries()].sort((a, b) => a[1].time - b[1].time);
    while (entries.length > tier.memoryLimit) {
      const oldest = entries.shift();
      newMemory.knownCards.delete(oldest[0]);
    }
  }

  return newMemory;
}

// 检查记忆中是否存在已知且未被移除的完整对
export function findKnownPair(memory, state) {
  const totemToIndices = new Map();
  for (const [idx, data] of memory.knownCards.entries()) {
    const card = state.board[idx];
    if (card && card.state === "hidden") {
      if (!totemToIndices.has(data.totem)) {
        totemToIndices.set(data.totem, []);
      }
      totemToIndices.get(data.totem).push(idx);
    }
  }

  for (const [, indices] of totemToIndices.entries()) {
    if (indices.length >= 2) {
      return [indices[0], indices[1]];
    }
  }
  return null;
}

// 获取未知的暗牌索引列表
export function getUnknownHiddenIndices(memory, state) {
  const list = [];
  state.board.forEach((card, idx) => {
    if (card.state === "hidden" && !memory.knownCards.has(idx)) {
      list.push(idx);
    }
  });
  return list;
}

// 获取所有暗牌索引列表
export function getAllHiddenIndices(state) {
  const list = [];
  state.board.forEach((card, idx) => {
    if (card.state === "hidden") {
      list.push(idx);
    }
  });
  return list;
}

// AI 决策入口：返回下一步行动
export function decideAiAction(state, memory, aiTierKey = "veteran", rng = Math.random) {
  if (state.winner || state.activePlayer !== "opponent") return null;
  const tier = AI_TIERS[aiTierKey] || AI_TIERS.veteran;
  const aiState = state.players.opponent;
  const playerState = state.players.player;

  // 处于 exposure_window 时，AI 不应有其他动作，只需通知结束暴露
  if (state.turnPhase === "exposure_window") {
    return { type: "end_exposure" };
  }

  // 阶段 1：首张行动决策
  if (state.turnPhase === "action_select") {
    const unlockedAiPairs = aiState.pairs - aiState.lockedPairs;
    const unlockedPlayerPairs = playerState.pairs - playerState.lockedPairs;
    const canUseSp = (memory.totalScoutsUsed + memory.totalStealsUsed * 2 + memory.totalLocksUsed) < tier.maxSpUse;

    // 策略 A: 防守上锁 (Lock)
    // 条件：AI 有未上锁完整对，玩家有 >= 2 SP 且 AI SP >= 1，且未超预算
    if (canUseSp && aiState.sp >= 1 && unlockedAiPairs > 0 && playerState.sp >= 2) {
      const shouldLock = aiTierKey === "master" || (aiTierKey === "veteran" && rng() > 0.3);
      if (shouldLock) {
        return { type: "lock" };
      }
    }

    // 策略 B: 进攻偷牌 (Steal)
    // 条件：玩家有未上锁对，AI SP >= 2，且未超预算
    if (canUseSp && aiState.sp >= 2 && unlockedPlayerPairs > 0) {
      // 大师：如果玩家快达到目标，或者 AI 没有已知对，果断偷！
      // 老手：60% 概率偷
      // 新秀：不怎么偷或仅在玩家只差 1 对达标时偷
      let shouldSteal = false;
      if (aiTierKey === "master") {
        shouldSteal = (playerState.pairs >= state.targetPairs - 1) || !findKnownPair(memory, state);
      } else if (aiTierKey === "veteran") {
        shouldSteal = rng() > 0.4;
      } else if (aiTierKey === "novice" && playerState.pairs >= state.targetPairs - 1 && canUseSp) {
        shouldSteal = rng() > 0.5;
      }
      if (shouldSteal) {
        return { type: "steal" };
      }
    }

    // 策略 C: 侦察情报 (Scout)
    // 条件：AI 记忆中没有成对的牌，且有未知暗牌，AI SP >= 1
    const knownPair = findKnownPair(memory, state);
    const unknownCards = getUnknownHiddenIndices(memory, state);
    if (!knownPair && canUseSp && aiState.sp >= 1 && unknownCards.length > 0) {
      let shouldScout = false;
      if (aiTierKey === "master" && rng() > 0.2) {
        shouldScout = true;
      } else if (aiTierKey === "veteran" && rng() > 0.6) {
        shouldScout = true;
      }
      if (shouldScout) {
        const targetIdx = unknownCards[Math.floor(rng() * unknownCards.length)];
        return { type: "scout", targetIndex: targetIdx };
      }
    }

    // 策略 D: 免费翻查 (Flip)
    // 如果已知配对，优先翻配对首张
    if (knownPair) {
      // 模拟失误率
      if (rng() >= tier.mistakeRate) {
        return { type: "flip", targetIndex: knownPair[0] };
      }
    }

    // 没有已知对，或发生失误：翻开一张暗牌
    const allHidden = getAllHiddenIndices(state);
    if (allHidden.length === 0) return null;

    // 尽量翻未知暗牌
    const pickList = unknownCards.length > 0 ? unknownCards : allHidden;
    const chosen = pickList[Math.floor(rng() * pickList.length)];
    return { type: "flip", targetIndex: chosen };
  }

  // 阶段 2：第二张翻牌决策 (first_flipped)
  if (state.turnPhase === "first_flipped") {
    const firstIdx = state.selectedFirstIndex;
    const firstCard = state.board[firstIdx];
    const firstTotem = firstCard.totem;

    // 在记忆中寻找是否存在与 firstTotem 匹配的已知其他牌
    let matchingIdx = null;
    for (const [idx, data] of memory.knownCards.entries()) {
      if (idx !== firstIdx && data.totem === firstTotem) {
        const c = state.board[idx];
        if (c && c.state === "hidden") {
          matchingIdx = idx;
          break;
        }
      }
    }

    // 如果记忆中有匹配，且未发生失误，则翻匹配张
    if (matchingIdx !== null && rng() >= tier.mistakeRate) {
      return { type: "flip", targetIndex: matchingIdx };
    }

    // 否则翻一张其他未知的暗牌
    const availableHidden = getAllHiddenIndices(state).filter((i) => i !== firstIdx);
    if (availableHidden.length === 0) return null;

    const unknownAvailable = getUnknownHiddenIndices(memory, state).filter((i) => i !== firstIdx);
    const pool = unknownAvailable.length > 0 ? unknownAvailable : availableHidden;
    const chosen = pool[Math.floor(rng() * pool.length)];
    return { type: "flip", targetIndex: chosen };
  }

  return null;
}
