// 叠叠乐 · DOM-free 游戏状态机控制器
// 收 UI 意图 → 固定步长累加调度 engine（120Hz 确定性推进）→ 派发事件给监听层。
//
// 三轨模式：
//   spire  —— 章节关卡：达成目标即结算星级（rateRun），塔倒即本关失败；
//   duel   —— 同屏双人对决：轮流「抽 + 叠」，谁弄倒谁输本局，三局两胜；
//   riddle —— 残局解谜：四选一挑出唯一抽了不塌的块，答对/答错即时反馈。
//
// 块数守恒与四档判倒归 engine，计分归 score，本文件只做编排与记账。

import {
  MODE, STATUS, FIXED_DT, PER_LAYER, BLOCK_H, START_LAYERS,
  createInitialState, cloneState, stepFrame, audit, tiltOf,
  canPull, pullBlock, canStack, stackBlock, cancelPull, startCollapse,
  pullableBlocks, layerCount, towerStats, mulberry32
} from "./engine.mjs";
import {
  addScore, blockScore, multiplierFor, rateRun, isSpire, isBrink
} from "./score.mjs";
import {
  LEVELS, DUEL_LEVEL, RIDDLE_LEVEL, findLevel, goalMoves,
  RIDDLE_CANDIDATES, RIDDLE_QUESTIONS, DUEL_WIN_TARGET, GOAL_LAYERS
} from "./levels.mjs";

const CREAK_INTERVAL = 1.15; // 判危咯吱的最小间隔（秒）
const CREAK_THRESHOLD = 0.42;
const RIDDLE_SETTLE_FRAMES = 90; // 判定候选块安全性时向后推进的物理帧数

function tierKey(level) {
  return `${level.id}:${level.seed}`;
}

// 在给定的塔局上，列出所有可抽块，并按「抽了之后有多险」给出模拟结果。
// engine 是纯函数，所以直接用 clone 试探：既不碰真实 state，也天然确定性。
function simulatePull(state, layer, slot) {
  const probe = cloneState(state);
  const res = pullBlock(probe, layer, slot);
  if (!res.ok) return { collapsed: true, danger: 1, ok: false };
  if (res.collapsed) return { collapsed: true, danger: 1, ok: true };
  for (let i = 0; i < RIDDLE_SETTLE_FRAMES; i += 1) {
    if (probe.status === STATUS.LOST) break;
    stepFrame(probe);
  }
  const collapsed = probe.status === STATUS.COLLAPSE || probe.status === STATUS.LOST;
  return { collapsed, danger: probe.danger, ok: true };
}

function simulateStack(state, slot) {
  const probe = cloneState(state);
  if (!canStack(probe, slot)) return null;
  const res = stackBlock(probe, slot);
  if (!res.ok) return null;
  return { collapsed: res.collapsed === true, danger: probe.danger, layers: layerCount(probe) };
}

// 自动落位：按「叠完之后最稳」挑槽位（只用于第 1 章的教学关卡）。
export function safestSlot(state) {
  let best = null;
  for (let slot = 0; slot < PER_LAYER; slot += 1) {
    if (!canStack(state, slot)) continue;
    const probe = simulateStack(state, slot);
    if (!probe) continue;
    const score = probe.collapsed ? Infinity : probe.danger;
    if (!best || score < best.score) best = { slot, score };
  }
  return best ? best.slot : -1;
}

export class JengaGame {
  constructor(options = {}) {
    this.mode = options.mode ?? MODE.SPIRE;
    this.level = options.level ?? findLevel(options.levelIndex ?? 1) ?? LEVELS[0];
    this.listeners = new Set();
    this.accumulator = 0;
    this.paused = false;
    this.marked = new Set();
    this.duel = null;
    this.riddle = null;
    this.state = null;
    this.reset();
  }

  // ------------------------------------------------------------ 事件

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, payload = {}) {
    const event = { type, ...payload };
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        // 监听层异常不得阻断对局逻辑
      }
    }
  }

  // ------------------------------------------------------------ 开局 / 重开

  reset() {
    if (this.mode === MODE.RIDDLE) return this.startRiddle();
    if (this.mode === MODE.DUEL) return this.startDuel();
    return this.startLevel(this.level?.index ?? 1);
  }

  setStateOptions() {
    const level = this.level ?? DUEL_LEVEL;
    return {
      mode: this.mode,
      seed: level.seed,
      gust: (level.gustAmp ?? 0) > 0,
      gustAmp: level.gustAmp ?? 0,
      gustPeriod: level.gustPeriod ?? 5,
      layers: START_LAYERS
    };
  }

  startLevel(index) {
    const level = findLevel(index);
    this.mode = MODE.SPIRE;
    this.level = level ?? LEVELS[0];
    this.state = createInitialState(this.setStateOptions());
    this.finishDuel();
    this.riddle = null;
    this.beginBookkeeping();
    this.applyLoadMarks();
    this.emit("level_loaded", { level: this.level, index: this.level.index });
    return this.level;
  }

  beginBookkeeping() {
    this.score = 0;
    this.cleanMoves = 0;
    this.spire = false;
    this.finished = false;
    this.result = null;
    this.accumulator = 0;
    this.paused = false;
    this.creakTimer = 0;
    this.gustPrev = this.state.gust.t;
    this.maxLayers = layerCount(this.state);
  }

  applyLoadMarks() {
    this.marked = new Set();
    const count = this.level?.loadMarks ?? 0;
    if (count <= 0) return;
    const rand = mulberry32(this.level.seed ^ 0x9e3779b9);
    // 承重块只落在塔身中段：最底两层与最顶三层不画线，否则开局就被堵死。
    const usable = [];
    for (const piece of pullableBlocks(this.state)) {
      if (piece.layer < 3) continue;
      if (piece.layer >= layerCount(this.state) - 3) continue;
      usable.push(piece);
    }
    for (let i = usable.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [usable[i], usable[j]] = [usable[j], usable[i]];
    }
    for (const piece of usable.slice(0, count)) this.marked.add(piece.id);
  }

  restart() {
    if (this.mode === MODE.RIDDLE) return this.startRiddle();
    if (this.mode === MODE.DUEL) return this.startDuel();
    return this.startLevel(this.level?.index ?? 1);
  }

  setMode(mode) {
    if (mode === this.mode) return this.mode;
    this.mode = mode;
    if (mode === MODE.DUEL) this.startDuel();
    else if (mode === MODE.RIDDLE) this.startRiddle();
    else this.startLevel(this.level?.index ?? 1);
    return this.mode;
  }

  // ------------------------------------------------------------ 快照

  snapshot() {
    const stats = towerStats(this.state);
    const goal = this.level?.goal ?? null;
    return {
      status: stats.status,
      mode: this.mode,
      level: this.level,
      score: this.score,
      streak: stats.streak,
      bestStreak: stats.bestStreak,
      mult: multiplierFor(stats.streak),
      layers: stats.layers,
      maxLayers: this.maxLayers ?? stats.layers,
      height: +(stats.layers * BLOCK_H).toFixed(2),
      danger: stats.danger,
      leanDeg: +((tiltOf(this.state) * 180) / Math.PI).toFixed(2),
      held: stats.held,
      marked: [...this.marked],
      progress: this.progress(),
      goal,
      goalText: this.goalText(goal),
      targetMoves: goal ? goalMoves(goal) : 0,
      paused: this.paused,
      duel: this.duel ? { ...this.duel, wins: [...this.duel.wins] } : null,
      riddle: this.riddle ? { ...this.riddle } : null
    };
  }

  progress() {
    const goal = this.level?.goal;
    if (!goal || this.mode !== MODE.SPIRE) return { value: 0, target: 0, type: goal?.type ?? "none" };
    const value = goal.type === GOAL_LAYERS ? layerCount(this.state) : this.state.stackCount;
    return { value, target: goal.target, type: goal.type };
  }

  goalText(goal) {
    if (!goal || !goal.target) return "goalNone";
    return goal.type === GOAL_LAYERS ? "goalLayers" : "goalMoves";
  }

  // ------------------------------------------------------------ 玩家意图

  isPlayable() {
    if (this.paused || this.finished) return false;
    if (this.mode === MODE.RIDDLE) return Boolean(this.riddle && !this.riddle.answered && !this.riddle.done);
    return this.state.status === STATUS.IDLE;
  }

  pull(layer, slot) {
    if (this.mode === MODE.RIDDLE) return this.answerRiddle(layer, slot);
    if (!this.isPlayable()) {
      this.emit("blocked", { reason: this.finished ? "finished" : "paused" });
      return false;
    }
    const entry = this.state.layers[layer];
    const id = entry ? entry.slots[slot] : null;
    if (id != null && this.marked.has(id)) {
      // 承重块：engine 不认识机关，由控制器直接判倒（属于本 IP 的额外规则层）
      this.state.verdict = { gear: 0, reason: "load", block: id };
      startCollapse(this.state);
      this.emit("load_pull", { block: id, layer, slot });
      this.onCollapse(this.actingPlayer());
      return true;
    }
    const res = pullBlock(this.state, layer, slot);
    if (!res.ok) {
      this.emit("blocked", { reason: "illegal", layer, slot });
      return false;
    }
    this.emit("pull", { layer, slot, block: id, intensity: layerCount(this.state) / START_LAYERS });
    if (res.collapsed) {
      this.onCollapse(this.actingPlayer());
      return true;
    }
    if (this.level?.autoStack) this.autoStack();
    return true;
  }

  autoStack() {
    const slot = safestSlot(this.state);
    if (slot < 0) return false;
    return this.stack(slot, true);
  }

  stack(slot, auto = false) {
    if (this.mode === MODE.RIDDLE) return false;
    if (!this.isPlayable() && this.state.status !== STATUS.HOLDING) {
      this.emit("blocked", { reason: "empty" });
      return false;
    }
    if (this.state.status !== STATUS.HOLDING) {
      this.emit("blocked", { reason: "no_block" });
      return false;
    }
    if (!canStack(this.state, slot)) {
      this.emit("blocked", { reason: "slot_taken", slot });
      return false;
    }
    const res = stackBlock(this.state, slot);
    if (!res.ok) {
      this.emit("blocked", { reason: "illegal", slot });
      return false;
    }
    this.emit("stack", { slot, auto });
    if (res.collapsed) {
      this.onCollapse(this.actingPlayer());
      return true;
    }
    this.onSuccessfulMove();
    return true;
  }

  cancelPull() {
    if (this.state.status !== STATUS.HOLDING) return false;
    const res = cancelPull(this.state);
    if (!res.ok) return false;
    this.emit("cancel", { block: res.block });
    return true;
  }

  // 一次完整的「抽 + 叠」成功：结算连击与连击分，检查目标是否达成。
  onSuccessfulMove() {
    const stats = towerStats(this.state);
    this.maxLayers = Math.max(this.maxLayers ?? 0, stats.layers);
    const player = this.actingPlayer();

    if (this.mode === MODE.DUEL && this.duel) {
      // 对决模式：每人各自累计自己的连击（换手清零的是"这一手"的瞬时倍率状态）
      this.duel.streak[player] = stats.streak;
      this.duel.best[player] = Math.max(this.duel.best[player], stats.streak);
      this.state.streak = stats.streak;
      this.score = addScore(this.score, blockScore(stats.streak));
      this.emit("streak", { streak: stats.streak, mult: multiplierFor(stats.streak), player });
      if (isSpire(stats.streak) && !this.spire) {
        this.spire = true;
        this.emit("spire", { player });
      }
      this.handOver();
      return;
    }

    this.score = addScore(this.score, blockScore(stats.streak));
    if (!isBrink(stats.danger)) this.cleanMoves += 1;
    this.emit("streak", { streak: stats.streak, mult: multiplierFor(stats.streak) });
    if (isSpire(stats.streak) && !this.spire) {
      this.spire = true;
      this.emit("spire", {});
    }
    if (this.mode === MODE.SPIRE && this.goalMet()) this.finishLevel(true);
  }

  goalMet() {
    const goal = this.level?.goal;
    if (!goal || this.mode !== MODE.SPIRE) return false;
    const value = goal.type === GOAL_LAYERS ? layerCount(this.state) : this.state.stackCount;
    const hitTarget = value >= goal.target;
    const hitStreak = (goal.streak ?? 0) <= 0 || this.state.bestStreak >= goal.streak;
    return hitTarget && hitStreak;
  }

  actingPlayer() {
    return this.mode === MODE.DUEL && this.duel ? this.duel.active : 0;
  }

  handOver() {
    if (!this.duel) return;
    const next = this.duel.active === 0 ? 1 : 0;
    this.duel.active = next;
    // 换手清连击：倍率归 1，下一位从第 1 次成功重新开始
    this.state.streak = this.duel.streak[next];
    this.emit("handover", { active: next });
  }

  finishLevel(won) {
    if (this.finished) return this.result;
    this.finished = true;
    const stats = towerStats(this.state);
    const stars = won
      ? rateRun({
          goalMet: true,
          cleanMoves: this.cleanMoves,
          par: this.level?.par ?? 0,
          bestStreak: stats.bestStreak,
          spire: this.spire
        })
      : 0;
    this.result = {
      won,
      stars,
      score: this.score,
      layers: stats.layers,
      streak: stats.bestStreak,
      spire: this.spire,
      cleanMoves: this.cleanMoves,
      level: this.level,
      key: tierKey(this.level)
    };
    this.emit("finished", this.result);
    return this.result;
  }

  // ------------------------------------------------------------ 塌落结算

  onCollapse(player = 0) {
    if (this.mode === MODE.DUEL && this.duel) {
      this.emit("collapse", { player, gear: this.state.verdict?.gear ?? 0 });
      const loser = player;
      const winner = loser === 0 ? 1 : 0;
      this.duel.wins[winner] += 1;
      this.duel.round += 1;
      this.emit("round_end", { winner, loser, wins: [...this.duel.wins] });
      if (this.duel.wins[winner] >= DUEL_WIN_TARGET) {
        this.duel.seriesOver = true;
        this.finished = true;
        this.result = { won: true, stars: 0, score: this.score, winner, level: DUEL_LEVEL, key: "duel" };
        this.emit("series_end", { winner, wins: [...this.duel.wins] });
      }
      return;
    }
    this.emit("collapse", { player, gear: this.state.verdict?.gear ?? 0 });
    if (this.mode === MODE.RIDDLE) return;
    this.finishLevel(false);
  }

  finishDuel() {
    this.duel = null;
  }

  // ------------------------------------------------------------ 双人对决

  startDuel() {
    this.mode = MODE.DUEL;
    this.level = DUEL_LEVEL;
    this.duel = { round: 1, wins: [0, 0], streak: [0, 0], best: [0, 0], active: 0, seriesOver: false };
    this.riddle = null;
    this.state = createInitialState(this.setStateOptions());
    this.beginBookkeeping();
    this.marked = new Set();
    this.emit("duel_started", { round: 1 });
    return this.duel;
  }

  nextDuelRound() {
    if (!this.duel || this.duel.seriesOver) return false;
    this.state = createInitialState({ ...this.setStateOptions(), seed: DUEL_LEVEL.seed + this.duel.round * 977 });
    this.score = 0;
    this.accumulator = 0;
    this.paused = false;
    this.creakTimer = 0;
    this.gustPrev = this.state.gust.t;
    this.maxLayers = layerCount(this.state);
    // 每局都由上一局的败者先手——这是 Jenga 派对局的老规矩
    this.duel.active = this.duel.wins[0] > this.duel.wins[1] ? 0 : 1;
    this.emit("duel_round", { round: this.duel.round, wins: [...this.duel.wins] });
    return true;
  }

  // ------------------------------------------------------------ 残局解谜

  startRiddle() {
    this.mode = MODE.RIDDLE;
    this.level = RIDDLE_LEVEL;
    this.duel = null;
    this.marked = new Set();
    this.riddle = {
      index: 0,
      correct: 0,
      wrong: 0,
      answered: false,
      done: false,
      candidates: [],
      safe: null,
      picked: null
    };
    this.score = 0;
    this.spire = false;
    this.finished = false;
    this.result = null;
    this.accumulator = 0;
    this.paused = false;
    this.creakTimer = 0;
    this.buildQuestion();
    this.emit("riddle_started", { total: RIDDLE_QUESTIONS });
    return this.riddle;
  }

  buildQuestion() {
    const seed = RIDDLE_LEVEL.seed + this.riddle.index * 613;
    let attempt = 0;
    let chosen = null;
    // 逐步放宽「安全块」的判定门限，保证任意种子下都能凑出 1 安全 + 3 危险
    while (attempt < 8 && !chosen) {
      const state = createInitialState({ seed: seed + attempt, mode: MODE.RIDDLE, layers: START_LAYERS });
      // 先随机抽叠几手，做出一个真实残局 —— 半腰见过的塔比标准塔更耐读
      const rand = mulberry32(seed + attempt * 31);
      for (let i = 0; i < 5; i += 1) {
        const options = pullableBlocks(state);
        if (!options.length) break;
        const pick = options[Math.floor(rand() * options.length)];
        const res = pullBlock(state, pick.layer, pick.slot);
        if (!res.ok || res.collapsed) break;
        const slots = [0, 1, 2].filter((s) => canStack(state, s));
        if (!slots.length) break;
        if (stackBlock(state, slots[Math.floor(rand() * slots.length)]).collapsed) break;
      }
      const evaluated = pullableBlocks(state).map((piece) => ({
        piece,
        sim: simulatePull(state, piece.layer, piece.slot)
      }));
      const safePool = evaluated
        .filter((e) => e.sim.ok && !e.sim.collapsed && e.sim.danger < 0.35 + attempt * 0.08)
        .sort((a, b) => a.sim.danger - b.sim.danger);
      const riskPool = evaluated
        .filter((e) => e.sim.collapsed || e.sim.danger > Math.max(0.4, (safePool[0]?.sim.danger ?? 0) + 0.12))
        .sort((a, b) => b.sim.danger - a.sim.danger);
      if (safePool.length >= 1 && riskPool.length >= RIDDLE_CANDIDATES - 1) {
        const pickedRisk = riskPool.slice(0, RIDDLE_CANDIDATES - 1);
        chosen = {
          state,
          safe: { layer: safePool[0].piece.layer, slot: safePool[0].piece.slot, id: safePool[0].piece.id },
          candidates: shuffle([safePool[0], ...pickedRisk], rand)
        };
      }
      attempt += 1;
    }
    if (!chosen) {
      // 兜底：任何种子都得有题可做（这里没有"真正的安全块"，取第一项为答案），至少不会卡死
      const state = createInitialState({ seed, mode: MODE.RIDDLE, layers: START_LAYERS });
      const pool = pullableBlocks(state).slice(0, RIDDLE_CANDIDATES);
      const rand = mulberry32(seed);
      this.state = state;
      const shuffled = shuffle(pool, rand);
      this.riddle.candidates = shuffled.map((piece, i) => ({
        layer: piece.layer,
        slot: piece.slot,
        id: piece.id,
        danger: +simulatePull(state, piece.layer, piece.slot).danger.toFixed(3),
        risky: i !== 0
      }));
      this.riddle.safe = {
        layer: shuffled[0].layer,
        slot: shuffled[0].slot,
        id: shuffled[0].id
      };
      this.riddle.answered = false;
      this.riddle.picked = null;
      return this.riddle;
    }
    this.state = chosen.state;
    this.riddle.safe = { layer: chosen.safe.layer, slot: chosen.safe.slot, id: chosen.safe.id };
    this.riddle.candidates = chosen.candidates.map((e) => ({
      layer: e.piece.layer,
      slot: e.piece.slot,
      id: e.piece.id,
      danger: +e.sim.danger.toFixed(3),
      risky: e.piece.id !== chosen.safe.id
    }));
    this.riddle.answered = false;
    this.riddle.picked = null;
    this.gustPrev = this.state.gust.t;
    return this.riddle;
  }

  answerRiddle(layer, slot) {
    const active = this.riddle;
    if (!active || active.done || active.answered) {
      this.emit("blocked", { reason: "answered" });
      return false;
    }
    const hit = active.candidates.find((c) => c.layer === layer && c.slot === slot);
    if (!hit) {
      this.emit("blocked", { reason: "illegal", layer, slot });
      return false;
    }
    const correct = layer === active.safe.layer && slot === active.safe.slot;
    active.answered = true;
    active.picked = { layer, slot, correct };
    if (correct) {
      active.correct += 1;
      this.score = addScore(this.score, blockScore(active.correct));
      this.emit("riddle_answer", { correct: true, index: active.index, correctCount: active.correct });
    } else {
      active.wrong += 1;
      // 答错就把这座塔真抽了：正确答案是"看得见的坍"，不是抽象判断
      startCollapse(this.state);
      this.emit("riddle_answer", { correct: false, index: active.index, safe: { ...active.safe } });
    }
    return correct;
  }

  nextRiddle() {
    const active = this.riddle;
    if (!active || active.done) return false;
    if (active.index + 1 >= RIDDLE_QUESTIONS) {
      active.index = RIDDLE_QUESTIONS;
      active.done = true;
      this.finished = true;
      this.result = {
        won: true,
        stars: 0,
        score: this.score,
        correct: active.correct,
        wrong: active.wrong,
        level: RIDDLE_LEVEL,
        key: "riddle"
      };
      this.emit("riddle_done", { correct: active.correct, wrong: active.wrong });
      return false;
    }
    active.index += 1;
    this.buildQuestion();
    this.emit("riddle_next", { index: active.index });
    return true;
  }

  // ------------------------------------------------------------ 主循环

  step(realDt) {
    if (this.paused) return [];
    const dt = Math.min(Math.max(realDt, 0), 0.1);
    this.accumulator += dt;
    let guard = 0;
    let collapsing = this.state.status === STATUS.COLLAPSE;
    while (this.accumulator >= FIXED_DT && guard < 240) {
      stepFrame(this.state, FIXED_DT);
      this.accumulator -= FIXED_DT;
      guard += 1;
    }

    // 判危咯吱：越过阈值后按固定间隔提醒，越险越密
    if (CREAK_THRESHOLD <= this.state.danger && this.state.status === STATUS.IDLE) {
      this.creakTimer -= dt;
      if (this.creakTimer <= 0) {
        this.creakTimer = CREAK_INTERVAL * (1.2 - Math.min(this.state.danger, 1));
        this.emit("creak", { danger: this.state.danger });
      }
    } else {
      this.creakTimer = 0;
    }

    // 阵风：引擎的风相位一回绕说明新的一阵到了 —— 在这时给玩家一个提示
    if (this.state.gust.enabled) {
      const now = this.state.gust.t % this.state.gust.period;
      if (now < this.gustPrev) this.emit("gust", {});
      this.gustPrev = now;
    }

    if (!collapsing && this.state.status === STATUS.COLLAPSE) {
      // 由物理自己在帧步进里判倒（多为档 3 的倾角失控）
      this.onCollapse(this.actingPlayer());
    }
    return this.state.status;
  }

  togglePause() {
    if (this.finished) return false;
    this.paused = !this.paused;
    this.emit("pause_toggled", { paused: this.paused });
    return this.paused;
  }

  // ------------------------------------------------------------ 查询

  availableSlots() {
    const slots = [];
    for (let slot = 0; slot < PER_LAYER; slot += 1) {
      if (canStack(this.state, slot)) slots.push(slot);
    }
    return slots;
  }

  canPull(layer, slot) {
    return canPull(this.state, layer, slot);
  }

  // 语言/ UI 只需要重绘，不需要重建：这里只做一次纯计算重算，便于保持一致
  refreshAudit() {
    audit(this.state);
    return this.state.danger;
  }
}

function shuffle(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export { MODE, STATUS };
