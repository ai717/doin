// game.mjs —— DOM-free 状态控制器：接收 UI 意图，调度 engine，处理角色轮换 / AI / 计分，派发事件。绝不碰 document / localStorage。

import {
  createState,
  stepFrame,
  chameleonMove,
  chameleonRecolor,
  chameleonFineTune,
  hunterScan,
  hunterAccuse,
  hunterPass,
  neighborsOf,
  neighborhoodOf,
  worldColor,
  dominantColor,
  colorDistance,
  blendTarget,
  clampBlend,
  heatFor,
  tellStrength,
  TURN,
  OUTCOME,
  ROUNDS_PER_HALF,
  PROBES_PER_ROUND,
} from "./engine.mjs";
import { mulberry32, randomSeed } from "./rng.mjs";
import { levelById, aiTier } from "./levels.mjs";
import { starsFor } from "./score.mjs";

export const MODE = { DUEL: "duel", HUNT: "hunt", PRACTICE: "practice" };
export const FIXED_DT = 1 / 120;
const MAX_STEPS = 240; // 一帧最多推进 2 秒，防螺旋
const REVEAL_TIME = 1.5;

export function createGame() {
  let state = null;
  let mode = MODE.DUEL;
  let level = null;
  const listeners = new Set();

  const match = {
    p1Score: 0,
    p2Score: 0,
    caught: false,
    roundsUsed: 0,
    wrongAccuses: 0,
    suddenDeath: false,
    over: false,
    winner: null,
  };

  function emit(type, payload = {}) {
    for (const fn of listeners) {
      try {
        fn(type, payload);
      } catch {
        // 单个监听者出错不影响其它
      }
    }
  }

  function resetMatch() {
    match.p1Score = 0;
    match.p2Score = 0;
    match.caught = false;
    match.roundsUsed = 0;
    match.wrongAccuses = 0;
    match.suddenDeath = false;
    match.over = false;
    match.winner = null;
  }

  function currentChameleonIsHuman() {
    return mode !== MODE.HUNT;
  }
  function currentHunterIsHuman() {
    // 三个模式猎手皆由玩家操作：同屏双人轮换 / 猎手战役打 AI / 练习观察台自己藏自己找。
    return true;
  }
  function canChameleonAct() {
    return state !== null && state.turn === TURN.CAMO && state.outcome === OUTCOME.RUNNING && currentChameleonIsHuman();
  }
  function canHunterAct() {
    return state !== null && state.turn === TURN.OBSERVE && state.outcome === OUTCOME.RUNNING && currentHunterIsHuman();
  }

  function numSeed(seedInput) {
    return Number.isFinite(seedInput) ? seedInput >>> 0 : randomSeed();
  }

  function startDuel(seedInput) {
    mode = MODE.DUEL;
    level = null;
    state = createState(numSeed(seedInput));
    state.mode = mode;
    state.half = 1;
    resetMatch();
    emit("start", { mode, view: view() });
    return view();
  }

  function startHunt(levelId, seedInput) {
    const lvl = levelById(levelId);
    if (!lvl) return null;
    mode = MODE.HUNT;
    level = lvl;
    state = createState(numSeed(seedInput ?? lvl.seed));
    state.mode = mode;
    state.half = 1;
    resetMatch();
    emit("start", { mode, view: view() });
    return view();
  }

  function startPractice(seedInput) {
    mode = MODE.PRACTICE;
    level = null;
    state = createState(numSeed(seedInput));
    state.mode = mode;
    state.half = 1;
    resetMatch();
    emit("start", { mode, view: view() });
    return view();
  }

  // ------------------------------------------------------------ 固定步长推进

  let acc = 0;
  function tick(dt) {
    if (!state || match.over) return;
    const d = Number(dt);
    if (!Number.isFinite(d) || d <= 0) return;
    acc += d;
    let steps = 0;
    while (acc >= FIXED_DT && steps < MAX_STEPS) {
      const beforeTurn = state.turn;
      stepFrame(state, FIXED_DT);
      // 结算计时结束后 engine 自增 round 并回到 REVEAL：此刻结算上一回合
      if (beforeTurn === TURN.SETTLE && state.turn !== TURN.SETTLE) {
        onRoundCompleted();
        if (match.over) break;
      }
      // 猎手模式：AI 变色龙在进入伪装阶段当帧决策
      if (mode === MODE.HUNT && beforeTurn !== state.turn && state.turn === TURN.CAMO) {
        aiDecide();
      }
      steps += 1;
    }
    acc -= Math.floor(acc / FIXED_DT) * FIXED_DT;
  }

  function onRoundCompleted() {
    const outcome = state.lastOutcome;
    if (mode === MODE.HUNT) match.roundsUsed += 1;

    if (mode === MODE.DUEL) {
      // half 为该半局归属；半局 1：P1 变色龙 / P2 猎手；半局 2 反之
      if (outcome === OUTCOME.CAUGHT) {
        if (state.half === 1) match.p2Score += 3;
        else match.p1Score += 3;
      } else if (outcome === OUTCOME.SURVIVED) {
        if (state.half === 1) match.p1Score += 1;
        else match.p2Score += 1;
      }

      if (state.round > ROUNDS_PER_HALF) {
        if (state.half === 1) {
          state.half = 2;
          state.round = 1;
          state.turn = TURN.REVEAL;
          state.turnTimer = REVEAL_TIME;
          emit("swap", { view: view() });
        } else if (match.suddenDeath) {
          settleDuel();
        } else if (match.p1Score !== match.p2Score) {
          match.winner = match.p1Score > match.p2Score ? 1 : 2;
          finish();
        } else {
          // 平局 → 突然死亡：变色龙限 1 步、猎手仅 1 侦察点
          match.suddenDeath = true;
          state.round = ROUNDS_PER_HALF + 1;
          state.turn = TURN.REVEAL;
          state.turnTimer = REVEAL_TIME;
          state.probes = 1;
          emit("sudden", { view: view() });
        }
      }
    } else if (mode === MODE.HUNT) {
      if (state.lastOutcome === OUTCOME.CAUGHT) {
        match.caught = true;
        finish();
      } else if (state.round > ROUNDS_PER_HALF) {
        match.caught = false;
        finish();
      }
    } else if (mode === MODE.PRACTICE) {
      // 练习：无限循环，回合只作计量
      if (state.round > ROUNDS_PER_HALF) {
        state.round = 1;
        state.turn = TURN.REVEAL;
        state.turnTimer = REVEAL_TIME;
        emit("lap", { view: view() });
      }
    }
  }

  function settleDuel() {
    // 突然死亡回合结束：仍平分才算真的平局（P1 先手算客胜，这里记 0 / 平局）
    if (match.p1Score === match.p2Score) match.winner = 0;
    else match.winner = match.p1Score > match.p2Score ? 1 : 2;
    finish();
  }

  function finish() {
    match.over = true;
    state.turn = TURN.OVER;
    state.turnTimer = 0;
    emit("end", { mode, result: result() });
  }

  // ------------------------------------------------------------ 玩家行动

  function move(dir) {
    if (!canChameleonAct()) return { ok: false };
    const res = chameleonMove(state, dir);
    if (res.ok) emit("chameleon", { view: view() });
    return res;
  }
  function recolor(dir) {
    if (!canChameleonAct()) return { ok: false };
    const res = chameleonRecolor(state, dir);
    if (res.ok) emit("chameleon", { view: view() });
    return res;
  }
  function refine() {
    if (!canChameleonAct()) return { ok: false };
    const res = chameleonFineTune(state);
    if (res.ok) emit("chameleon", { view: view() });
    return res;
  }
  function scan(cell) {
    if (!canHunterAct()) return null;
    const res = hunterScan(state, cell);
    if (res) emit("scan", { cell, view: view() });
    return res;
  }
  function accuse(cell) {
    if (!canHunterAct()) return null;
    const res = hunterAccuse(state, cell);
    if (res) {
      if (mode === MODE.HUNT && !res.correct) match.wrongAccuses += 1;
      emit("accuse", { res, view: view() });
    }
    return res;
  }
  function pass() {
    if (!canHunterAct()) return null;
    const res = hunterPass(state);
    if (res) emit("pass", { view: view() });
    return res;
  }

  // ------------------------------------------------------------ AI（猎手模式）

  function aiDecide() {
    const tier = aiTier(level.ai);
    const rng = mulberry32((level.seed ^ (state.round * 0x9e3779b9) ^ (state.half * 0x85ebca6b)) >>> 0);
    const roll = rng();
    const world = (cell) => worldColor(state.residents, cell, state.phase);
    const modeOf = (cell) => {
      const colors = neighborhoodOf(cell).filter((c) => c !== cell).map(world);
      return dominantColor(colors);
    };
    const dom = modeOf(state.chameleonCell);

    if (roll < tier.moveChance) {
      const candidates = neighborsOf(state.chameleonCell).filter((n) => modeOf(n.cell) === state.chameleonColor);
      if (candidates.length) {
        const pick = candidates[Math.floor(rng() * candidates.length) % candidates.length];
        chameleonMove(state, pick.dir);
      } else {
        chameleonFineTune(state);
      }
    } else if (roll < tier.moveChance + tier.refineChance) {
      chameleonFineTune(state);
    } else if (colorDistance(state.chameleonColor, dom) !== 0) {
      const d = colorDistance(state.chameleonColor, dom);
      const ccw = ((state.chameleonColor - 1) % 5 + 5) % 5;
      const cw = (state.chameleonColor + 1) % 5;
      const toward = colorDistance(ccw, dom) < colorDistance(cw, dom) ? -1 : 1;
      chameleonRecolor(state, toward);
    } else {
      chameleonFineTune(state);
    }
    // 强度上限：伪装大师也不会 100% 隐身，每回合必留可测破绽
    state.blend = clampBlend(Math.min(state.blend, tier.blendCeiling));
  }

  // ------------------------------------------------------------ 只读视图

  function chameleonVisible() {
    if (!state) return false;
    if (mode === MODE.PRACTICE) return true;
    // 同屏双人：变色龙全程渲染于真实格位；"藏匿"由社交闭眼 + 融合度/波纹体现，不能把变色龙从棋盘上抹掉（否则变色龙玩家无从行动）
    if (mode === MODE.DUEL) return true;
    if (mode === MODE.HUNT) return match.over && match.caught;
    return false;
  }

  function view() {
    if (!state) return null;
    return {
      mode,
      level: level ? { id: level.id, ai: level.ai, aiKey: level.aiKey, seed: level.seed } : null,
      half: state.half,
      round: state.round,
      turn: state.turn,
      turnTimer: state.turnTimer,
      phase: state.phase,
      blend: state.blend,
      tell: chameleonVisible() ? tellStrength(state) : 0,
      blendTarget: blendTarget(state),
      probes: state.probes,
      scans: state.scans.map((s) => ({ ...s })),
      accuse: state.accuse,
      outcome: state.outcome,
      lastOutcome: state.lastOutcome,
      residents: [...state.residents],
      chameleonCell: chameleonVisible() ? state.chameleonCell : -1,
      chameleonColor: chameleonVisible() ? state.chameleonColor : -1,
      chameleonVisible: chameleonVisible(),
      ripples: state.ripples.map((r) => ({ ...r })),
      p1Score: match.p1Score,
      p2Score: match.p2Score,
      suddenDeath: match.suddenDeath,
      caught: match.caught,
      roundsUsed: match.roundsUsed,
      wrongAccuses: match.wrongAccuses,
      over: match.over,
      winner: match.winner,
      canChameleonAct: canChameleonAct(),
      canHunterAct: canHunterAct(),
    };
  }

  function result() {
    if (!state) return null;
    if (mode === MODE.HUNT) {
      return {
        mode,
        levelId: level?.id,
        ai: level?.ai,
        caught: match.caught,
        roundsUsed: match.roundsUsed,
        wrongAccuses: match.wrongAccuses,
        stars: starsFor({ caught: match.caught, roundsUsed: match.roundsUsed, wrongAccuses: match.wrongAccuses }),
      };
    }
    return {
      mode,
      p1Score: match.p1Score,
      p2Score: match.p2Score,
      winner: match.winner,
      suddenDeath: match.suddenDeath,
    };
  }

  /** 只读诊断出口：验收脚本读真值用（含隐藏变色龙格与颜色），UI 不得展示 */
  function diagnose() {
    if (!state) return null;
    return {
      mode,
      seed: state.seed,
      chameleonCell: state.chameleonCell,
      chameleonColor: state.chameleonColor,
      blend: state.blend,
      round: state.round,
      half: state.half,
      turn: state.turn,
      outcome: state.outcome,
      residents: [...state.residents],
    };
  }

  return {
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    startDuel,
    startHunt,
    startPractice,
    tick,
    move,
    recolor,
    refine,
    scan,
    accuse,
    pass,
    view,
    result,
    diagnose,
    heatAt: (cell) => (state ? heatFor(state, cell) : null),
    isActive: () => state !== null && !match.over,
  };
}