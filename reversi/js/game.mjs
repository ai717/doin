// 状态控制器：DOM-free。
// 职责边界：接收 UI 意图 → 调度 engine（规则）/ ai（对手与提示）/ solver（终局预报与残局校验）/
// score（计分）→ 产出「快照」与「事件」两样东西。
//   · snapshot() 只读，UI 拿它渲染；UI 绝不写它、绝不自己造 action。
//   · drainEvents() 把"该播什么"交给 UI（翻转波次 / 得角 / 踩陷阱 / 让位 / 终局），取走即清空。
//   · 本层不许出现 document / window / localStorage；时间靠 tick(dt) 由外部推进，
//     AI 计算统一走 think() 的分块异步路径（每段 ≤12ms 让出主线程），绝不长时间阻塞。
//
// 唯一的写入口是 advance()：placement() 只是登记意图，真正的落子/判定/对手应手
// 全部发生在 advance() 里。这样"输入缓冲""残局判定""AI 应手"不会各有一套流程。

import {
  BLACK, WHITE, EMPTY, CELL_COUNT,
  STATUS_PLAYING, STATUS_OVER, RULES_WOF, RULES_CLASSIC,
  other, legalMoves, applyMove, createState, countDiscs, squareKind,
  flipLines, finalScore, winnerOf, CORNER_INDICES,
} from "./engine.mjs";
import { TIER_KEYS, TIER_DUELIST, TIER_INFALLIBLE, think } from "./ai.mjs";
import { canSolvePerfectly, solveExact, diffAfterMove } from "./solver.mjs";
import { mulberry32, shuffle } from "./rng.mjs";
import { MODES } from "./storage.mjs";
import { puzzleById } from "./puzzles.mjs";
import {
  discGraph, gameReport, maxFlipOf, biggestSwingOf, recordHighlights,
  puzzleStars, RUSH_DURATION_MS, RUSH_TURN_MS,
  rushStart, rushAdvance, rushMultiplier, rushWinBonus,
} from "./score.mjs";

export const UNDO_LIMIT = 3;
export const HINT_LIMIT = 3;
export const BLITZ_TURN_MS = 10_000;

export const OPENING_KEYS = Object.freeze(["standard", "diagonal", "perpendicular", "parallel", "random"]);

// 开局的两手脚本（棋盘索引，行主序；坐标换算见 engine.indexOf）。
//
// ★ 实测结论（用引擎穷举得到，别再凭棋理常识猜）：
//   标准开局下黑的合法首手只有 4 个：d3(19) / c4(26) / f5(37) / e6(44)；
//   白的合法应手只可能是 {c3(18), e3(20), c5(34)}（黑走 d3/c4）或 {f4(29), d6(43), f6(45)}（黑走 f5/e6）。
//   这 12 个组合里**不存在任何一对"两步成 45° 对角"的落点**（Δ 只有 (0,±1)、(±1,0)、(±2,∓1)、(±1,±2)），
//   所以文献上的"对角开局"无法逐字复现。标签沿用 PRD §3.5（对外文案与 i18n key 已冻结），
//   每一手的几何关系以本表注释为准，并由 tests/game.test.mjs 用引擎复核"两手都必须合法"。
export const OPENING_SCRIPTS = Object.freeze({
  standard: Object.freeze([]), // 官方固定开局：四子就位、黑先，不预落任何子
  diagonal: Object.freeze([19, 34]), // 对角：两手连成四个合法应手里最斜的一条（Δ(2,−1)）
  perpendicular: Object.freeze([26, 18]), // 垂直：黑取黑块左侧、白取黑块上方，两条进攻轴互相垂直
  parallel: Object.freeze([37, 45]), // 平行：两手都贴黑块右侧、上下相邻，同向推进
  random: null, // 随机前二：由注入的种子 PRNG 抽前两手
});

export const RUSH_START_MOVES = 30; // 起手盘面推进 30 手 → 余 30 个空位
export const RUSH_MIN_REPLIES = 6; // 双方合法落点下限
export const RUSH_MAX_IMBALANCE = 2; // 双方子数差上限

export function createGame(options = {}) {
  const deps = {
    think: options.think ?? think,
    yielder: options.yielder ?? (() => new Promise((resolve) => setTimeout(resolve, 0))),
    seed: Number.isFinite(options.seed) ? options.seed : 20260928,
  };

  let rng = mulberry32(deps.seed);

  // 配置
  let mode = MODES.PLAY;
  let rules = RULES_WOF;
  let tier = TIER_DUELIST;
  let human = BLACK;
  let opening = "standard";
  let pvp = false;
  let blitz = false;

  // 对局
  let startConfig = { rules: RULES_WOF, moves: [] };
  let floorCount = 0; // 悔棋下限：开局脚本本身不算"可悔的着手"，不得退到它之前
  let state = createState();
  let spend = { undo: UNDO_LIMIT, hint: HINT_LIMIT };
  let thinking = false;
  let busy = false; // UI 的落子动画是否在播：只影响人类输入的缓冲，绝不影响规则
  let pending = null; // 缓冲里最多一手
  let report = null;
  let forecast = null;
  let hintIndex = -1;
  let blitzLeft = BLITZ_TURN_MS;
  let events = [];

  // 残局 / 街机
  let puzzle = null;
  let rush = null;

  // 求解结果缓存：残局判定 / 终局预报 / 提示共用同一份精确解。
  // 空位 14 时一次精确求解约 0.4s，若不共享，一手棋要连算三次，主线程会明显卡顿。
  const solveCache = new Map();

  function cachedSolve(board, player) {
    const key = `${board.join("")}|${player}`;
    const hit = solveCache.get(key);
    if (hit) return hit;
    const result = solveExact(board, player);
    if (solveCache.size > 4096) solveCache.clear();
    solveCache.set(key, result);
    return result;
  }

  const emit = (event) => events.push(event);

  // ★ 残局模式必须走 state.current === human 这一条，不能恒真。
  // 恒真会让 drive() 的对手循环永不进入 —— 于是 opponentTier / opponentBudget 里的
  // PUZZLE 分支沦为死代码，且玩家被迫替对手走棋（"残局破题"变成"自己走完整条最优线"）。
  // 正常路径是：玩家走最优手 → 无谬档对手走精确最优应手 → 再轮回玩家。
  function isHumanTurn() {
    if (report || state.status !== STATUS_PLAYING) return false;
    if (pvp) return true;
    return state.current === human;
  }

  // ── 落子与事件 ────────────────────────────────────────────────────
  function doMove(index) {
    const player = state.current;
    const lines = flipLines(state.board, index, player);
    if (lines.length === 0) return false;
    const before = state.board;
    const next = applyMove(state, index);
    if (next === state) return false;
    state = next;
    emitMove(player, index, lines, before);

    if (mode === MODES.RUSH && rush) {
      const flips = lines.flat().length;
      const comboBefore = rush.combo;
      const turned = rushAdvance(rush, flips);
      rush = { ...rush, ...turned };
      emit({
        type: "rush",
        phase: comboBefore > 0 && turned.combo === 0 ? "broken" : "scored",
        flips,
        ...turned,
      });
    }
    return true;
  }

  function emitMove(player, index, lines, before) {
    const flips = lines.flat();
    // 得角：这一手让某只角第一次归本方所有（落子或被翻入都算）
    const corners = CORNER_INDICES.filter((i) => state.board[i] === player && before[i] !== player);
    // 踩陷阱：落点本身是 X 位或 C 位（角旁的诱惑，PRD §3.6）
    const trap = squareKind(index) === "x" || squareKind(index) === "c";
    // moved 事件同时带汇总字段（corners / trap 在此就绪，不再是恒空占位）
    // 与逐条子事件，UI 既可一次性读结果、也可按子事件排队播放。
    emit({ type: "moved", index, player, lines, flips, corners, trap });
    for (const corner of corners) emit({ type: "corner", index: corner });
    if (trap) emit({ type: "trap", index });
    if (state.passedPlayer !== EMPTY) emit({ type: "pass", player: state.passedPlayer });
  }

  function refreshForecast() {
    // 经典口径（空位不计）下不预报：铜牌读数取自 WOF 竞技口径，
    // 混用会给出"精确但不对"的数字 —— 宁可整块不出现（定案 2A 的硬约束）。
    if (rules !== RULES_WOF || state.status !== STATUS_PLAYING || !canSolvePerfectly(state.board)) {
      forecast = null;
      return;
    }
    const solved = cachedSolve(state.board, state.current);
    const diff = solved.score;
    forecast = {
      diff,
      lead: Math.abs(diff),
      side: diff > 0 ? state.current : diff < 0 ? other(state.current) : EMPTY,
      best: solved.moves.slice(),
    };
    emit({ type: "forecast", forecast });
  }

  function settleRound() {
    if (state.status !== STATUS_OVER || report) return;
    report = gameReport(state);
    emit({ type: "settle", report });
    if (mode === MODES.PUZZLE && puzzle && puzzle.status === "playing") {
      finishPuzzle("solved");
    }
    if (mode === MODES.RUSH && rush && !rush.over) {
      const won = report.winner === human;
      const bonus = rushWinBonus(won, report.diff);
      rush = { ...rush, over: true, bonus, score: rush.score + bonus };
      emit({ type: "rush", phase: "over", bonus, won });
    }
  }

  // ── 残局：逐手精确校验 ───────────────────────────────────────────
  // 走错的手**不落盘**（PRD §3.5「错着反馈：走错立即提示'此手终局 −Y 子'，并允许无限次重选」），
  // 因此残局永远只会沿着最优线推进，终局子差必然等于题面目标。
  function judgePuzzle(index) {
    const player = state.current;
    const best = cachedSolve(state.board, player);
    const after = diffAfterMove(state.board, player, index);
    const optimal = after !== null && after === best.score;
    const judgement = { optimal, loss: best.score - (after ?? best.score - 99), value: best.score, after };
    const ply = puzzle.plies.length;
    puzzle = {
      ...puzzle,
      plies: puzzle.plies.concat({ index, optimal, loss: judgement.loss }),
      firstMoveOptimal: ply === 0 ? optimal : puzzle.firstMoveOptimal,
      wrongRetry: puzzle.wrongRetry || !optimal,
    };
    if (!optimal) {
      emit({ type: "puzzle", phase: "wrong", loss: judgement.loss, value: best.score, after: judgement.after });
      return false;
    }
    return doMove(index);
  }

  function finishPuzzle(status) {
    const stars = puzzleStars({
      solved: status === "solved",
      firstMoveOptimal: puzzle.firstMoveOptimal,
      hadWrongRetry: puzzle.wrongRetry,
    });
    puzzle = { ...puzzle, status, stars };
    emit({ type: "puzzle", phase: status, stars, id: puzzle.id, target: puzzle.target });
  }

  // ── 对手行动 ──────────────────────────────────────────────────────
  function opponentTier() {
    if (mode === MODES.PUZZLE) return TIER_INFALLIBLE; // 残局对手只走最优（空位 ≤14 → 精确解）
    if (mode === MODES.RUSH) return TIER_DUELIST; // 街机用"反应型"3 层 AI
    return tier;
  }

  function opponentBudget() {
    // 残局必须精确：显式给足预算（think 仍会每 12ms 让出主线程，界面不卡）。
    if (mode === MODES.PUZZLE) return { totalMs: Infinity, hardMs: Infinity };
    // 街机要节奏不要棋力：给一个很短的预算，宁可走得不完美也不许卡顿。
    if (mode === MODES.RUSH) return { totalMs: 220, hardMs: 60 };
    // 对弈交给档位自己的默认值（完美区间由 think 内部自动放行到精确求解）。
    return {};
  }

  async function playOpponent() {
    if (state.status !== STATUS_PLAYING) return;
    const player = state.current;
    thinking = true;
    emit({ type: "thinking", on: true, player });
    await deps.yielder();

    const result = await deps.think(state.board, player, opponentTier(), {
      rng,
      yielder: deps.yielder,
      ...opponentBudget(),
    });

    thinking = false;
    emit({ type: "thinking", on: false, player });

    // 引擎会自动处理 Pass，所以"无子可下"永远轮不到这里；防御性收尾。
    if (!result || result.passed || !Number.isInteger(result.move) || result.move < 0) return;
    if (flipLines(state.board, result.move, player).length === 0) return;
    doMove(result.move);
  }

  // ── 主推进：把"登记的那一手 → 对手应手"一路推到该人类决策为止 ──────
  async function drive() {
    if (pending !== null) {
      const index = pending;
      pending = null;
      if (mode === MODES.PUZZLE) judgePuzzle(index);
      else doMove(index);
    }
    let guard = 0;
    while (state.status === STATUS_PLAYING && !isHumanTurn() && guard < 6) {
      guard += 1;
      await playOpponent();
    }
    refreshForecast();
    settleRound();
    return api.snapshot();
  }

  const api = {
    // 开新局。config: { mode, tier, side, opening, pvp, blitz, rules, puzzleId, seed }
    //
    // ★ start() 是同步的，只把盘面摆好。若开局后轮到对手（执白起手 / 开局脚本落在黑方），
    // 调用方必须紧接着 await advance()（语义等同 release）—— 由它把对手的第一步走出去。
    // 这不是冗余：把 AI 的第一步塞进 start 就必须把 start 变成异步，
    // 反而让"摆盘"和"推进"两件事的时序更难推理。
    start(config = {}) {
      mode = [MODES.PLAY, MODES.PUZZLE, MODES.RUSH].includes(config.mode) ? config.mode : MODES.PLAY;
      tier = TIER_KEYS.includes(config.tier) ? config.tier : TIER_DUELIST;
      human = config.side === WHITE ? WHITE : BLACK;
      opening = OPENING_KEYS.includes(config.opening) ? config.opening : "standard";
      pvp = Boolean(config.pvp);
      blitz = Boolean(config.blitz);
      rules = config.rules === RULES_CLASSIC ? RULES_CLASSIC : RULES_WOF;
      if (Number.isFinite(config.seed)) deps.seed = config.seed;
      rng = mulberry32(deps.seed);

      pending = null;
      busy = false;
      thinking = false;
      report = null;
      forecast = null;
      hintIndex = -1;
      blitzLeft = BLITZ_TURN_MS;
      events = [];
      solveCache.clear();
      puzzle = null;
      rush = null;
      spend = { undo: UNDO_LIMIT, hint: HINT_LIMIT };

      const script = openingScript(opening, rng);
      startConfig = { rules, moves: script };
      // 脚本长度即悔棋下限：state.moves 的前 script.length 项是"摆盘"，不是着手。
      floorCount = script.length;
      state = createState(startConfig);

      if (mode === MODES.PUZZLE) {
        const entry = puzzleById(config.puzzleId);
        if (entry) {
          puzzle = {
            id: entry.id,
            chapter: entry.chapter,
            chapterKey: entry.chapterKey,
            side: entry.side,
            target: entry.bestDiff,
            bestLine: entry.bestLine.slice(),
            difficulty: entry.difficulty,
            plies: [],
            wrongRetry: false,
            firstMoveOptimal: true,
            status: "playing",
            stars: 0,
          };
          human = entry.side;
          rules = RULES_WOF;
          startConfig = { rules, board: entry.board, current: entry.side, moves: [] };
          floorCount = 0;
          state = createState(startConfig);
          spend = { undo: 0, hint: null }; // 残局禁悔棋；提示不限次且不影响星级
        } else {
          mode = MODES.PLAY;
        }
      }

      if (mode === MODES.RUSH) {
        const start = rushBoard(rng);
        human = start.current; // 谁先手，谁就是玩家
        startConfig = { rules, board: start.board, current: start.current, moves: [] };
        floorCount = 0;
        state = createState(startConfig);
        spend = { undo: 0, hint: 0 };
        rush = { ...rushStart(), timeLeftMs: RUSH_DURATION_MS, turnLeftMs: RUSH_TURN_MS, over: false };
      }

      refreshForecast();
      return api.snapshot();
    },

    // UI 的落子意图。这里只做"合法性 + 缓冲"两件事，不落子。
    //   返回 "ignored" —— 非法 / 终局 / 不是人类回合：静默忽略（严禁弹窗）
    //   返回 "queued"  —— 动画期间，已排进缓冲（最多一手）
    //   返回 "ready"   —— 已登记，UI 随后调 advance() 落子
    placement(index) {
      if (report || state.status !== STATUS_PLAYING || !isHumanTurn()) return "ignored";
      if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) return "ignored";
      if (flipLines(state.board, index, state.current).length === 0) return "ignored";
      if (busy) {
        pending = index;
        return "queued";
      }
      pending = index;
      return "ready";
    },

    // UI 通知"落子动画播完了"（只在动画开始时置 true，动画结束置 false 后调 release()）。
    setVisualBusy(value) {
      busy = Boolean(value);
    },

    async advance() {
      return drive();
    },

    // 动画结束后释放缓冲：语义与 advance 一致，命名区分只为让调用点自解释。
    async release() {
      return drive();
    },

    // 悔棋：对 AI 一路退到"重新轮到你决策"为止 —— 因为 Pass 会让一手回落到对手身上，
    // 只退两手可能仍停在对手回合，所以按 current 探测着连续退（最多 4 手，防病态局面）。
    // 本地双人一次撤一手。限 3 次/局，下限是开局脚本之后的第一个局面。
    undo() {
      if (mode !== MODES.PLAY || report || spend.undo <= 0) return false;
      if (state.moves.length <= floorCount) return false; // 只剩开局脚本，没有可悔的着手
      let target = state.moves.length - 1;
      let probe = replay(target);
      let guard = 0;
      while (pvp === false && guard < 4 && target > floorCount && probe.current !== human) {
        target -= 1;
        probe = replay(target);
        guard += 1;
      }
      spend = { ...spend, undo: spend.undo - 1 };
      state = probe;
      report = null;
      pending = null;
      hintIndex = -1;
      refreshForecast();
      emit({ type: "undo", reverted: state.moves.length });
      return true;
    },

    // 提示：对弈模式给"当前档位 AI 的判断"（不是上帝视角，与终局预报严格区分，PRD §3.3）；
    // 残局模式给精确最优首手。限 3 次/局（残局不限次且不影响星级）。
    async hint() {
      if (state.status !== STATUS_PLAYING || report) return false;
      if (spend.hint !== null && spend.hint <= 0) return false;
      const player = state.current;

      let move = -1;
      if (mode === MODES.PUZZLE) {
        const best = cachedSolve(state.board, player);
        if (best.moves.length > 0) move = best.moves[0];
      } else {
        // 一律走带预算的分块搜索：无谬档同步搜索要十几秒，提示绝不能把界面冻住。
        const result = await deps.think(state.board, player, tier, {
          rng,
          yielder: deps.yielder,
          totalMs: 700,
          hardMs: 140,
        });
        if (result && Number.isInteger(result.move) && result.move >= 0) move = result.move;
      }
      if (move < 0) return false;
      if (spend.hint !== null) spend = { ...spend, hint: spend.hint - 1 };
      hintIndex = move;
      emit({ type: "hint", index: move });
      return true;
    },

    // 认输：直接判负。绝不伪造一个"64:0"的盘面（那会把档案卡骗成"完美局"），
    // 而是保留真实子数、把胜者改成对手，并带上 resigned 标记。
    resign() {
      if (report || state.status !== STATUS_PLAYING || mode !== MODES.PLAY) return false;
      const counts = countDiscs(state.board);
      const winner = other(human);
      pending = null;
      state = { ...state, status: STATUS_OVER, current: EMPTY, winner, finalScore: { black: counts.black, white: counts.white } };
      report = { ...gameReport(state), winner, perfect: false, resigned: true, diff: Math.abs(counts.black - counts.white) };
      emit({ type: "settle", report });
      return true;
    },

    // 计时推进（由 UI 的帧循环或秒表调用）。
    // 返回触发了什么，UI 据此决定要不要接一个 autoMove()：
    //   "rush-over"   —— 90 秒到
    //   "rush-timeout"—— 玩家这一手 6 秒软倒计时到
    //   "blitz-timeout"—— 闪电战 10 秒到
    tick(dtMs) {
      const dt = Math.max(0, Number(dtMs) || 0);
      if (report || state.status !== STATUS_PLAYING) return null;

      if (mode === MODES.RUSH && rush) {
        rush = {
          ...rush,
          timeLeftMs: Math.max(0, rush.timeLeftMs - dt),
          turnLeftMs: isHumanTurn() ? Math.max(0, rush.turnLeftMs - dt) : RUSH_TURN_MS,
        };
        if (rush.timeLeftMs <= 0) {
          // ★ 时间到必须真正结束对局。只置 report 而不动 state.status，会留下一个"仍在进行"的
          // 状态机：drive() 的推进循环照跑，时间到了棋盘还在变（UI 会看到终局后继续落子）。
          // 结算口径与引擎 settle() 一致：WOF 把余空判给子多的一方。
          state = {
            ...state,
            status: STATUS_OVER,
            current: EMPTY,
            winner: winnerOf(state.board, state.rules),
            finalScore: finalScore(state.board, state.rules),
          };
          report = gameReport(state);
          const won = report.winner === human;
          const bonus = rushWinBonus(won, report.diff);
          rush = { ...rush, over: true, bonus, score: rush.score + bonus };
          emit({ type: "rush", phase: "over", bonus, won, timeout: true });
          emit({ type: "settle", report });
          return "rush-over";
        }
        if (rush.turnLeftMs <= 0 && isHumanTurn()) return "rush-timeout";
        return null;
      }

      if (!blitz || mode !== MODES.PLAY) return null;
      if (!isHumanTurn()) {
        blitzLeft = BLITZ_TURN_MS;
        return null;
      }
      blitzLeft -= dt;
      if (blitzLeft > 0) return null;
      blitzLeft = BLITZ_TURN_MS;
      return "blitz-timeout";
    },

    // 超时自动落一手（街机的 6 秒软倒计时 / 闪电战的 10 秒）。连击归零，不判负。
    async autoMove() {
      if (report || state.status !== STATUS_PLAYING) return -1;
      const player = state.current;
      const result = await deps.think(state.board, player, mode === MODES.RUSH ? TIER_DUELIST : tier, {
        rng,
        yielder: deps.yielder,
        totalMs: 400,
        hardMs: 90,
      });
      if (!result || result.passed || !Number.isInteger(result.move) || result.move < 0) return -1;
      const index = result.move;
      const flips = flipLines(state.board, index, player).flat().length;
      doMove(index);
      if (mode === MODES.RUSH && rush) {
        // 超时只是"断连击"，不判负。★ 这里绝不能再调一次 rushAdvance：
        // doMove 内部已经用当时的倍率把这一手结算过了，再走一遍会把翻转数与步数重复计入
        // （rushAdvance 的 gained = flips × multiplier 会二次加分）。
        // 正解是只重置连击状态，让它从下一手重新起算。
        rush = { ...rush, combo: 0, multiplier: rushMultiplier(0), turnLeftMs: RUSH_TURN_MS };
        emit({ type: "rush", phase: "timeout-move", flips, combo: 0 });
      }
      emit({ type: "auto", index });
      await drive();
      return index;
    },

    // 只读快照。UI 严禁写它。
    snapshot() {
      const playing = state.status === STATUS_PLAYING;
      return {
        mode,
        rules,
        tier,
        human,
        pvp,
        blitz,
        opening,
        status: state.status,
        board: state.board,
        current: state.current,
        lastMove: state.lastMove,
        lastLines: state.lastLines,
        moveCount: state.moves.length,
        legal: playing ? legalMoves(state.board, state.current) : [],
        threat: playing ? legalMoves(state.board, other(state.current)) : [],
        hint: hintIndex,
        spend: { ...spend, undoLimit: UNDO_LIMIT, hintLimit: HINT_LIMIT },
        thinking,
        busy,
        pending,
        over: Boolean(report),
        report,
        forecast,
        graph: discGraph(state),
        blitzLeft,
        puzzle: puzzle
          ? {
            id: puzzle.id,
            chapter: puzzle.chapter,
            chapterKey: puzzle.chapterKey,
            side: puzzle.side,
            target: puzzle.target,
            plies: puzzle.plies.length,
            wrongRetry: puzzle.wrongRetry,
            firstMoveOptimal: puzzle.firstMoveOptimal,
            status: puzzle.status,
            stars: puzzle.stars,
          }
          : null,
        rush: rush ? { ...rush } : null,
      };
    },

    drainEvents() {
      const out = events;
      events = [];
      return out;
    },

    // 只读派生值（给 UI 的档案卡 / 存档用），不暴露可变状态。
    highlights: (previous) => recordHighlights(previous, report ?? gameReport(state)),
    maxFlip: () => maxFlipOf(state),
    biggestSwing: () => biggestSwingOf(state),
    rushMultiplier: () => (rush ? rushMultiplier(rush.combo) : 1),
    puzzleRecord: () => (puzzle
      ? { stars: puzzle.stars, wrongRetry: puzzle.wrongRetry, firstMoveOptimal: puzzle.firstMoveOptimal, status: puzzle.status }
      : null),
    rushResult: () => (rush ? { score: rush.score, combo: rush.combo } : null),
  };

  function replay(count) {
    return createState({ ...startConfig, moves: state.moves.slice(0, count).map((move) => move.index) });
  }

  return api;
}

// 开局脚本：随机前二由注入的种子 PRNG 从"合法首手"与"合法应手"里各抽一手，
// 抽法固定（shuffle 的顺序由 rng 决定），同一 seed 必得同一开局。
export function openingScript(key, rng) {
  const script = OPENING_SCRIPTS[key];
  if (script) return script.slice();
  if (key !== "random" || typeof rng !== "function") return [];
  const first = legalMoves(createState().board, BLACK);
  if (first.length === 0) return [];
  const black = shuffle(rng, first)[0];
  const afterFirst = createState({ moves: [black] });
  const replies = legalMoves(afterFirst.board, afterFirst.current);
  if (replies.length === 0) return [black];
  return [black, shuffle(rng, replies)[0]];
}

// 街机起手盘面：必须是"公平"的中局（双方子数差 ≤2、双方合法落点 ≥6）。
// 由种子 PRNG 反复随机游走筛出来 —— 同 seed 同盘面，且被 tests/game.test.mjs 批量验证公平率。
export function rushBoard(rng) {
  let fallback = null;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    let probe = createState();
    let guard = 0;
    while (probe.status === STATUS_PLAYING && probe.moves.length < RUSH_START_MOVES && guard < 400) {
      guard += 1;
      const moves = legalMoves(probe.board, probe.current);
      if (moves.length === 0) break;
      probe = applyMove(probe, moves[Math.floor(rng() * moves.length)]);
    }
    if (probe.moves.length !== RUSH_START_MOVES) continue;
    const board = probe.board.slice();
    const current = probe.current;
    const counts = countDiscs(board);
    const fair = Math.abs(counts.black - counts.white) <= RUSH_MAX_IMBALANCE
      && legalMoves(board, current).length >= RUSH_MIN_REPLIES
      && legalMoves(board, other(current)).length >= RUSH_MIN_REPLIES;
    if (fair) return { board, current };
    if (!fallback) fallback = { board, current };
  }
  return fallback ?? { board: createState().board, current: BLACK };
}
