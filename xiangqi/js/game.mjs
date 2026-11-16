// 状态机控制器：接收 UI 意图，调度 engine 与 ai。DOM-free（不碰 DOM / storage / 计时器）。
//
// 权威单一数据源：一切状态读取直接访问 game.state，更新走引擎返回的新引用。
// 模式：campaign（残局闯关，黑方 = 防守引擎）/ ai（阶梯对战）/ 2p（同屏双人）。
// 确定性契约：AI 失误注入只消费注入的种子 rng；同种子 + 同操作序列必然同局面。
// aiDriver：默认 async（think 分块让步），测试可注入 sync（chooseMove 立即返回）。

import * as engine from "./engine.mjs";
import { chooseMove, think, TIER_DEFENDER } from "./ai.mjs";
import { mulberry32 } from "./rng.mjs";
import { campaignStars, MAX_UNDO_PER_DUEL, MODE_CAMPAIGN, MODE_AI, MODE_2P } from "./score.mjs";
import { PUZZLES } from "./puzzles.mjs";

export { MODE_CAMPAIGN, MODE_AI, MODE_2P };

export const RED = engine.RED;
export const BLACK = engine.BLACK;

export class XiangqiGame {
  constructor(options = {}) {
    this.onChange = options.onChange ?? (() => {});
    this.onEvent = options.onEvent ?? (() => {});
    this.onOver = options.onOver ?? (() => {});
    this.aiDriver = options.aiDriver === "sync" ? "sync" : "async";
    this.mode = options.mode ?? MODE_CAMPAIGN;
    this.aiTier = options.aiTier ?? "ai_1";
    this.hintEnabled = options.hintEnabled ?? false;
    this.seed = options.seed ?? 1;
    this.rng = null;
    this.undoLeft = 0;
    this.undoUsed = false;
    this.selected = -1;
    this.aiThinking = false;
    this.state = null;
    this.levelKey = null;
    this.newGame(this.mode, options);
  }

  // ─── 开局 ───────────────────────────────────────────────────────
  newGame(mode, options = {}) {
    this.mode = mode;
    if (options.aiTier) this.aiTier = options.aiTier;
    if (typeof options.hintEnabled === "boolean") this.hintEnabled = options.hintEnabled;
    this.selected = -1;
    this.aiThinking = false;
    this.undoUsed = false;

    if (mode === MODE_CAMPAIGN) {
      const levelKey = options.levelKey ?? "level_1";
      // UI 只传 levelKey 时从题库装载；测试可显式注入 puzzle（此时不保留关卡归属）。
      const injected = options.puzzle ?? null;
      const puzzle = injected ?? PUZZLES[levelKey] ?? null;
      const board = puzzle ? engine.parseBoard(puzzle.board) : null;
      this.levelKey = injected ? null : levelKey;
      this.seed = options.seed ?? 1;
      this.rng = mulberry32(this.seed);
      this.undoLeft = 0;
      this.state = engine.createState({
        board: board ?? undefined,
        turn: engine.RED,
        meta: { mode, levelKey: this.levelKey, par: puzzle?.par ?? 0 },
      });
      if (puzzle) this.puzzleOverride = puzzle;
    } else {
      this.levelKey = null;
      this.puzzleOverride = null;
      this.seed = options.seed ?? (1 + Math.floor(Math.random() * 0x7fffffff));
      this.rng = mulberry32(this.seed);
      this.undoLeft = MAX_UNDO_PER_DUEL;
      this.state = engine.createState({ meta: { mode, seed: this.seed, aiTier: this.aiTier } });
    }
    this.onChange("new-game");
    this.maybeAiMove();
  }

  restart() {
    this.newGame(this.mode, { levelKey: this.levelKey ?? undefined, seed: this.seed });
  }

  setAiTier(tierKey) {
    this.aiTier = tierKey;
    this.state = { ...this.state, meta: { ...this.state.meta, aiTier: tierKey } };
    this.onChange("tier");
  }

  setHintEnabled(value) {
    this.hintEnabled = Boolean(value);
    this.onChange("hint");
  }

  // ─── 查询 ───────────────────────────────────────────────────────
  isHumanTurn() {
    if (!this.state || this.state.status !== engine.STATUS_PLAYING) return false;
    if (this.aiThinking) return false;
    if (this.mode === MODE_2P) return true;
    return this.state.turn === engine.RED; // campaign / ai 模式红方是人类
  }

  isCampaign() {
    return this.mode === MODE_CAMPAIGN;
  }

  par() {
    if (this.puzzleOverride?.par) return this.puzzleOverride.par;
    if (!this.levelKey) return 0;
    return this.puzzleOverride?.par ?? 0;
  }

  hintMove() {
    if (!this.hintEnabled) return null;
    if (!this.isCampaign()) return null;
    const puzzle = this.puzzleOverride ?? null;
    if (puzzle?.first) return { from: puzzle.first[0], to: puzzle.first[1] };
    return null;
  }

  movesUsed() {
    // 红方已用步数（红黑各走一手为一回合）
    return Math.ceil((this.state?.moveCount ?? 0) / 2);
  }

  undoAvailable() {
    if (this.state.status !== engine.STATUS_PLAYING) return false;
    if (this.isCampaign()) return false; // 残局禁用悔棋（星级公平）
    if (this.state.history.length === 0) return false;
    if (this.mode === MODE_2P) return true;
    return this.undoLeft > 0;
  }

  // ─── 意图：点选 / 落子 ──────────────────────────────────────────
  tapSquare(index) {
    if (!this.isHumanTurn()) return null;
    const board = this.state.board;
    const piece = board[index];
    const side = this.state.turn;

    if (this.selected >= 0 && this.selected !== index) {
      // 尝试走子（点选第二跳）
      const moved = this.tryMove(this.selected, index);
      if (moved) return moved;
      // 落点非法：若点的是己方另一子则换选，否则轻震反馈
      if (piece !== 0 && engine.sideOf(piece) === side) {
        this.selected = index;
        this.onEvent("select", { index });
        this.onChange("select");
        return { action: "select", index };
      }
      this.onEvent("denied", { index });
      return { action: "denied", index };
    }

    if (this.selected === index) {
      this.selected = -1;
      this.onChange("deselect");
      return { action: "deselect", index };
    }
    if (piece !== 0 && engine.sideOf(piece) === side) {
      this.selected = index;
      this.onEvent("select", { index });
      this.onChange("select");
      return { action: "select", index };
    }
    return { action: "none", index };
  }

  dragMove(from, to) {
    if (!this.isHumanTurn()) return null;
    if (from === to) return null;
    const moved = this.tryMove(from, to);
    if (!moved) {
      this.onEvent("denied", { index: to });
      return { action: "denied", index: to };
    }
    return moved;
  }

  cancelSelection() {
    if (this.selected >= 0) {
      this.selected = -1;
      this.onChange("deselect");
    }
  }

  legalTargets() {
    if (this.selected < 0) return [];
    return engine
      .legalMoves(this.state.board, this.state.turn)
      .filter((move) => move.from === this.selected)
      .map((move) => move.to);
  }

  // ─── 悔棋 ───────────────────────────────────────────────────────
  undo() {
    if (!this.undoAvailable()) {
      this.onEvent("denied", { index: -1 });
      return false;
    }
    if (this.mode === MODE_2P) {
      this.state = engine.undoMove(this.state);
    } else {
      // 对战模式：撤回 AI 一手 + 己方一手
      this.state = engine.undoMove(engine.undoMove(this.state));
      this.undoLeft -= 1;
    }
    this.undoUsed = true;
    this.selected = -1;
    this.onChange("undo");
    this.maybeAiMove();
    return true;
  }

  // ─── 帧步进（渲染循环调用）──────────────────────────────────────
  stepFrame(dt) {
    const next = engine.stepFrame(this.state, dt);
    if (next !== this.state) this.state = next;
  }

  // ─── 内部：走子与 AI 调度 ───────────────────────────────────────
  tryMove(from, to) {
    const before = this.state;
    const next = engine.applyMove(before, { from, to });
    if (next === before) return null; // 非法：静默忽略
    const captured = before.board[to] !== 0;
    this.selected = -1;
    this.state = next;
    this.onEvent(captured ? "capture" : "move", { from, to });
    if (next.status === engine.STATUS_PLAYING && engine.inCheck(next.board, next.turn)) {
      this.onEvent("check", { index: engine.generalIndex(next.board, next.turn) });
    }
    if (next.status === engine.STATUS_OVER) {
      this.finishGame();
    } else {
      this.onChange("move");
      this.maybeAiMove();
    }
    return { action: "move", from, to };
  }

  finishGame() {
    const result = this.state.result;
    const mover = engine.other(this.state.turn); // 收尾行棋方 = 胜者或长将方
    const redWon = result?.winner === engine.RED;
    const draw = result?.winner === null;
    let stars = 0;
    if (this.isCampaign() && redWon) {
      stars = campaignStars(this.movesUsed(), this.par(), this.undoUsed);
    }
    this.onEvent("over", { kind: result?.kind ?? null });
    this.onChange("over");
    this.onOver({
      mode: this.mode,
      kind: result?.kind ?? null,
      winner: result?.winner ?? null,
      draw,
      redWon,
      stars,
      movesUsed: this.movesUsed(),
      par: this.par(),
      levelKey: this.levelKey,
      aiTier: this.aiTier,
      mover,
    });
  }

  async maybeAiMove() {
    if (this.state.status !== engine.STATUS_PLAYING) return;
    if (this.mode === MODE_2P) return;
    if (this.state.turn === engine.RED) return; // 红方始终是人类
    if (this.aiThinking) return;
    this.aiThinking = true;
    this.onChange("ai-start");

    const tierKey = this.isCampaign() ? TIER_DEFENDER.key : this.aiTier;
    const board = this.state.board.slice();
    const side = this.state.turn;

    let outcome;
    if (this.aiDriver === "sync") {
      outcome = chooseMove(board, side, tierKey, { rng: this.rng });
    } else {
      outcome = await think(board, side, tierKey, { rng: this.rng });
    }

    this.aiThinking = false;
    if (this.state.status !== engine.STATUS_PLAYING || this.state.turn !== side) {
      this.onChange("ai-cancel");
      return; // 局面已被悔棋/重开改变，弃用本次计算
    }
    if (outcome.move < 0) {
      this.onChange("ai-pass");
      return;
    }
    const from = outcome.move.from;
    const to = outcome.move.to;
    const before = this.state;
    const next = engine.applyMove(before, { from, to });
    if (next === before) {
      this.onChange("ai-invalid");
      return;
    }
    const captured = before.board[to] !== 0;
    this.state = next;
    this.onEvent(captured ? "capture" : "move", { from, to });
    if (next.status === engine.STATUS_PLAYING && engine.inCheck(next.board, next.turn)) {
      this.onEvent("check", { index: engine.generalIndex(next.board, next.turn) });
    }
    if (next.status === engine.STATUS_OVER) {
      this.finishGame();
    } else {
      this.onChange("move");
    }
  }

  // 随机游走测试入口：当前行棋方随机走一手合法着法（测试注入 rng）。
  randomLegalMove(rng) {
    const moves = engine.legalMoves(this.state.board, this.state.turn);
    if (moves.length === 0) return null;
    return moves[Math.floor(rng() * moves.length)];
  }
}
