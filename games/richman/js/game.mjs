// 状态控制器：DOM-free。接收 UI 意图调度 engine 纯函数，自己只管
// 可暂停的计时队列（骰子动画 / AI 思考 / 行进节奏）与终局战报。
// tick(dt) 是唯一时间入口：暂停时 dt 不累计，一切动画与 AI 自动冻结。

import { mulberry32, applyAction, createMatch, currentPlayer, housesOf, netWorth, propsOf, setCount } from "./engine.mjs";
import { aiDecide } from "./ai.mjs";

const DEFAULT_TIMING = {
  thinkBaseMs: 620,
  thinkJitterMs: 240,
  walkStartDelayMs: 1150,
  hopMs: 260,
  hopSettleMs: 340,
  resolveDelayMs: 480,
  endTurnDelayMs: 620,
};

export function buildPlayers(mode, aiLevel) {
  if (mode === "2p") {
    return [
      { id: "p1", human: true, ai: null },
      { id: "p2", human: true, ai: null },
    ];
  }
  if (mode === "duo") {
    return [
      { id: "p1", human: true, ai: null },
      { id: "p2", human: false, ai: aiLevel },
      { id: "p3", human: false, ai: aiLevel },
    ];
  }
  return [
    { id: "p1", human: true, ai: null },
    { id: "p2", human: false, ai: aiLevel },
  ];
}

export function createGame(options = {}) {
  const {
    onEvent = () => {},
    onOver = () => {},
    onChange = () => {},
    timing: customTiming = {},
  } = options;
  const timing = { ...DEFAULT_TIMING, ...customTiming };

  let state = null;
  let config = null;
  let gen = 0;
  let clock = 0;
  let queue = [];
  let paused = false;
  let aiRng = mulberry32(1);

  function schedule(delay, fn) {
    queue.push({ at: clock + delay, gen, fn });
  }

  function runDue() {
    if (!queue.length) return;
    const due = [];
    queue = queue.filter((item) => {
      if (item.gen === gen && item.at <= clock) {
        due.push(item);
        return false;
      }
      return true;
    });
    for (const item of due) item.fn();
  }

  function tick(dtMs) {
    if (!state || state.over || paused) return;
    clock += Math.max(0, Math.min(400, Number(dtMs) || 0));
    runDue();
  }

  function dispatch(action) {
    if (!state || state.over) return;
    const result = applyAction(state, action);
    if (result.state === state) return; // 非法意图静默忽略
    state = result.state;
    for (const event of result.events) onEvent(event, state);
    afterDispatch();
    onChange(state);
  }

  function afterDispatch() {
    if (state.over) {
      finishMatch();
      return;
    }
    const player = currentPlayer(state);
    if (!player) return;
    switch (state.phase) {
      case "moving": {
        const path = state.move?.path ?? [];
        path.forEach((tile, index) => {
          schedule(timing.walkStartDelayMs + timing.hopMs * index, () => onEvent({ type: "hop", player: player.id, tile }, state));
        });
        schedule(timing.walkStartDelayMs + timing.hopMs * path.length + timing.hopSettleMs, () => dispatch({ type: "arrive" }));
        break;
      }
      case "act": {
        if (state.pending) {
          if (player.human) onEvent({ type: "prompt" }, state);
          else schedule(timing.thinkBaseMs + Math.floor(aiRng() * timing.thinkJitterMs), aiStep);
        } else {
          schedule(timing.endTurnDelayMs, () => dispatch({ type: "endTurn" }));
        }
        break;
      }
      case "pre": {
        if (player.human) onEvent({ type: "prompt" }, state);
        else schedule(timing.thinkBaseMs + Math.floor(aiRng() * timing.thinkJitterMs), aiStep);
        break;
      }
      case "blockPick":
      case "swapMine":
      case "swapTheirs": {
        if (player.human) onEvent({ type: "prompt" }, state);
        else schedule(timing.thinkBaseMs + 160, aiStep);
        break;
      }
      default:
        break;
    }
  }

  function aiStep() {
    if (!state || state.over) return;
    const player = currentPlayer(state);
    if (!player || player.human) return;
    const action = aiDecide(state, player.id, aiRng);
    if (!action) {
      if (state.phase === "act" && !state.pending) dispatch({ type: "endTurn" });
      else if (state.phase === "pre") dispatch({ type: "roll" });
      else dispatch({ type: "cancelCard" });
      return;
    }
    dispatch(action);
  }

  function buildResult() {
    const humans = state.players.filter((entry) => entry.human);
    const flipped = state.overReason === "human_out" || (state.winner && humans.length === 1 && state.winner !== humans[0].id);
    return {
      mode: state.mode,
      winner: state.winner,
      reason: state.overReason,
      rounds: state.round,
      seed: state.seed,
      flipRound: flipped && humans.length === 1 ? flipPoint(humans[0].id) : null,
      players: state.players.map((entry) => ({
        id: entry.id,
        human: entry.human,
        ai: entry.ai,
        alive: entry.alive,
        cash: entry.cash,
        worth: netWorth(state, entry.id),
        props: propsOf(state, entry.id).length,
        houses: housesOf(state, entry.id),
        sets: setCount(state, entry.id),
        rentIn: entry.stats.rentIn,
        rentOut: entry.stats.rentOut,
        maxRent: entry.stats.maxRent,
      })),
    };
  }

  function flipPoint(playerId) {
    let aheadRound = null;
    for (const entry of state.history) {
      const others = Object.entries(entry.worth).filter(([id]) => id !== playerId);
      const best = others.length ? Math.max(...others.map(([, v]) => v)) : 0;
      if ((entry.worth[playerId] ?? 0) >= best) aheadRound = entry.round;
    }
    for (const entry of state.history) {
      if (aheadRound !== null && entry.round <= aheadRound) continue;
      const others = Object.entries(entry.worth).filter(([id]) => id !== playerId);
      const best = others.length ? Math.max(...others.map(([, v]) => v)) : 0;
      if ((entry.worth[playerId] ?? 0) < best) return entry.round;
    }
    return null;
  }

  function finishMatch() {
    queue = [];
    const result = buildResult();
    onEvent({ type: "over", winner: state.winner, reason: state.overReason }, state);
    onOver(result);
  }

  function newMatch(nextConfig = {}) {
    const seed = (nextConfig.seed ?? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0)) >>> 0;
    const mode = nextConfig.mode ?? "quick";
    const aiLevel = nextConfig.ai ?? "novice";
    config = { seed, mode, ai: aiLevel };
    const players = buildPlayers(mode, aiLevel);
    const allNovice = players
      .filter((entry) => entry.ai)
      .every((entry) => entry.ai === "novice");
    gen += 1;
    queue = [];
    clock = 0;
    paused = false;
    aiRng = mulberry32((seed ^ 0x5f3759df) >>> 0);
    state = createMatch({ seed, mode, players, nastyCards: !allNovice });
    afterDispatch();
    onChange(state);
    return snapshot();
  }

  /** UI（人类玩家）入口：只在轮到人类时放行。 */
  function playerAction(action) {
    if (!state || state.over || paused) return;
    const player = currentPlayer(state);
    if (!player || !player.human) return;
    dispatch(action);
  }

  function pause() {
    if (paused || !state || state.over) return;
    paused = true;
  }

  function resume() {
    if (!paused) return;
    paused = false;
  }

  function togglePause() {
    if (paused) resume();
    else pause();
  }

  function snapshot() {
    return {
      state,
      config,
      paused,
      myTurn: Boolean(state && !state.over && currentPlayer(state)?.human),
    };
  }

  return {
    newMatch,
    playerAction,
    dispatch, // AI 与控制器内部使用；UI 一律走 playerAction
    tick,
    pause,
    resume,
    togglePause,
    snapshot,
    get state() {
      return state;
    },
    get paused() {
      return paused;
    },
    get config() {
      return config;
    },
    get over() {
      return Boolean(state?.over);
    },
  };
}
