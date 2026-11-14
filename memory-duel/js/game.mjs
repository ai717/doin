// 记忆对决 · 游戏主控制器 (DOM-free, Storage-free)
// 协调纯规则引擎 engine、AI 决策系统、残局系统与评分系统

import {
  createGame,
  applyFlipCard,
  applyEndExposure,
  applyScout,
  applySteal,
  applyLock,
  checkWinCondition,
} from "./engine.mjs";
import {
  createAiMemory,
  updateAiMemory,
  decideAiAction,
} from "./ai.mjs";
import {
  loadPuzzleGame,
  PUZZLES,
} from "./puzzles.mjs";
import {
  calculateDuelStars,
  calculatePuzzleStars,
  calculateSummary,
} from "./score.mjs";

export class MemoryDuelController {
  constructor(options = {}) {
    this.mode = options.mode || "challenge"; // "challenge" | "endgame"
    this.tierKey = options.tierKey || "novice"; // "novice" | "veteran" | "master"
    this.puzzleIndex = options.puzzleIndex || 0;
    this.rng = options.rng || Math.random;
    this.onStateChange = options.onStateChange || (() => {});
    this.onEvent = options.onEvent || (() => {});

    this.engineState = null;
    this.aiMemory = createAiMemory();
    this.isScoutingMode = false;
    this.timeStep = 0;

    this.initGame();
  }

  initGame() {
    this.timeStep = 0;
    this.isScoutingMode = false;
    this.aiMemory = createAiMemory();

    if (this.mode === "endgame") {
      this.engineState = loadPuzzleGame(this.puzzleIndex);
    } else {
      // 挑战模式根据阶梯分配棋盘规格
      let pairCount = 10;
      let targetPairs = 5;
      if (this.tierKey === "veteran") {
        pairCount = 12;
        targetPairs = 6;
      } else if (this.tierKey === "master") {
        pairCount = 15;
        targetPairs = 7;
      }

      this.engineState = createGame({
        pairCount,
        targetPairs,
        startingSp: 5,
        seed: this.rng,
        firstPlayer: "player",
      });
    }

    this.notifyState();
  }

  notifyState() {
    this.onStateChange(this.getStateSnapshot());
  }

  emitEvent(eventName, payload) {
    this.onEvent(eventName, payload);
  }

  getStateSnapshot() {
    return {
      mode: this.mode,
      tierKey: this.tierKey,
      puzzleIndex: this.puzzleIndex,
      isScoutingMode: this.isScoutingMode,
      engine: this.engineState,
      isPlayerTurn: this.engineState.activePlayer === "player",
      isGameOver: Boolean(this.engineState.winner),
      summary: this.engineState.winner ? calculateSummary(this.engineState) : null,
      stars: this.engineState.winner ? (
        this.mode === "endgame"
          ? calculatePuzzleStars(this.engineState, PUZZLES[this.puzzleIndex]?.stars)
          : calculateDuelStars(this.engineState)
      ) : 0,
    };
  }

  setMode(mode, subIndexOrTier) {
    this.mode = mode;
    if (mode === "challenge") {
      this.tierKey = subIndexOrTier || "novice";
    } else {
      this.puzzleIndex = typeof subIndexOrTier === "number" ? subIndexOrTier : 0;
    }
    this.initGame();
  }

  restart() {
    this.initGame();
  }

  // 玩家发起主行动意图
  triggerPlayerAction(actionType) {
    if (this.engineState.winner || this.engineState.activePlayer !== "player") return false;
    if (this.engineState.turnPhase !== "action_select") return false;

    if (actionType === "scout") {
      if (this.engineState.players.player.sp < 1) return false;
      this.isScoutingMode = !this.isScoutingMode;
      this.notifyState();
      return true;
    }

    if (actionType === "steal") {
      this.isScoutingMode = false;
      const { state, action } = applySteal(this.engineState);
      if (action) {
        this.engineState = state;
        this.timeStep++;
        this.emitEvent("steal", action);
        this.notifyState();
        return true;
      }
      return false;
    }

    if (actionType === "lock") {
      this.isScoutingMode = false;
      const { state, action } = applyLock(this.engineState);
      if (action) {
        this.engineState = state;
        this.timeStep++;
        this.emitEvent("lock", action);
        this.notifyState();
        return true;
      }
      return false;
    }

    return false;
  }

  cancelScout() {
    this.isScoutingMode = false;
    this.notifyState();
  }

  // 玩家点击牌桌上的卡牌
  handleCardClick(cardIndex) {
    if (this.engineState.winner || this.engineState.activePlayer !== "player") return false;

    // 处于侦察模式中
    if (this.isScoutingMode) {
      const card = this.engineState.board[cardIndex];
      if (!card || card.state !== "hidden") return false;

      const { state, action } = applyScout(this.engineState, cardIndex);
      if (action) {
        this.engineState = state;
        this.isScoutingMode = false;
        this.timeStep++;
        this.emitEvent("scout", action);
        this.notifyState();
        return true;
      }
      return false;
    }

    // 处于正常翻查行动中
    const { state, action } = applyFlipCard(this.engineState, cardIndex);
    if (!action) return false;

    this.engineState = state;
    this.timeStep++;

    // 同步 AI 记忆（AI 观察玩家翻开的明牌）
    this.aiMemory = updateAiMemory(this.aiMemory, this.engineState, this.tierKey, this.timeStep);

    if (action.type === "match_success") {
      this.emitEvent("match_success", action);
    } else if (action.type === "match_fail") {
      this.emitEvent("match_fail", action);
    } else if (action.type === "flip_first") {
      this.emitEvent("flip_first", action);
    } else if (action.type === "flip_cancel") {
      this.emitEvent("flip_cancel", action);
    }

    this.notifyState();
    return true;
  }

  // 结束翻错暴露窗口
  endExposure() {
    if (this.engineState.turnPhase !== "exposure_window") return false;
    const { state, action } = applyEndExposure(this.engineState);
    if (action) {
      this.engineState = state;
      this.timeStep++;
      this.emitEvent("end_exposure", action);
      this.notifyState();
      return true;
    }
    return false;
  }

  // 获取 AI 下一步思考行动计划
  getAiNextAction() {
    if (this.engineState.winner || this.engineState.activePlayer !== "opponent") return null;
    return decideAiAction(this.engineState, this.aiMemory, this.tierKey, this.rng);
  }

  // 执行 AI 决定的具体行动
  executeAiAction(decision) {
    if (!decision || this.engineState.winner || this.engineState.activePlayer !== "opponent") return false;

    if (decision.type === "end_exposure") {
      return this.endExposure();
    }

    if (decision.type === "scout") {
      const { state, action } = applyScout(this.engineState, decision.targetIndex);
      if (action) {
        this.engineState = state;
        this.timeStep++;
        this.aiMemory.totalScoutsUsed++;
        this.aiMemory = updateAiMemory(this.aiMemory, this.engineState, this.tierKey, this.timeStep);
        this.emitEvent("ai_scout", action);
        this.notifyState();
        return true;
      }
      return false;
    }

    if (decision.type === "steal") {
      const { state, action } = applySteal(this.engineState);
      if (action) {
        this.engineState = state;
        this.timeStep++;
        this.aiMemory.totalStealsUsed++;
        this.emitEvent("ai_steal", action);
        this.notifyState();
        return true;
      }
      return false;
    }

    if (decision.type === "lock") {
      const { state, action } = applyLock(this.engineState);
      if (action) {
        this.engineState = state;
        this.timeStep++;
        this.aiMemory.totalLocksUsed++;
        this.emitEvent("ai_lock", action);
        this.notifyState();
        return true;
      }
      return false;
    }

    if (decision.type === "flip") {
      const { state, action } = applyFlipCard(this.engineState, decision.targetIndex);
      if (action) {
        this.engineState = state;
        this.timeStep++;
        this.aiMemory = updateAiMemory(this.aiMemory, this.engineState, this.tierKey, this.timeStep);
        if (action.type === "match_success") {
          this.emitEvent("ai_match_success", action);
        } else if (action.type === "match_fail") {
          this.emitEvent("ai_match_fail", action);
        } else if (action.type === "flip_first") {
          this.emitEvent("ai_flip_first", action);
        }
        this.notifyState();
        return true;
      }
      return false;
    }

    return false;
  }
}
