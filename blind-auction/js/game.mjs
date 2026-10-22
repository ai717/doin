// 盲盒竞拍 · DOM-free 状态控制器
// 职责：持有 state，接收 UI 意图（出价 / 技能 / 结算 / 开箱 / 下一回合），
//       调度 engine 纯函数，向监听者派发状态变化。绝不碰 DOM 与 localStorage。

import {
  mulberry32,
  bid as engineBid,
  useSkill as engineUseSkill,
  forceBidZero,
  resolveRound,
  openCrate,
  nextRound,
  createGame,
} from "./engine.mjs";
import { createHumanPlayer, createAiPlayers, createAiPlayersFrom, computeAiBid } from "./ai.mjs";

export function buildGame(seed, opts = {}) {
  const state = createGame(seed, opts, buildPlayers(seed, opts));
  return new Game(state);
}

function buildPlayers(seed, opts) {
  const rng = mulberry32(seed >>> 0);
  const human = createHumanPlayer(opts.character);
  const ais = Array.isArray(opts.personas) && opts.personas.length === 3
    ? createAiPlayersFrom(opts.personas)
    : createAiPlayers(rng, opts.difficulty);
  return [human, ...ais];
}

export class Game {
  constructor(state) {
    this.state = state;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.state);
  }

  /** 人类出价：合法则执行并派发，否则静默忽略（返回 false）。 */
  bid(amount) {
    const next = engineBid(this.state, 0, amount);
    if (next) {
      this.state = next;
      this.emit();
      return true;
    }
    return false;
  }

  /** 人类技能：target 仅对"套话"角色生效（目标 AI 索引）。 */
  useSkill(target) {
    const next = engineUseSkill(this.state, 0, target);
    if (next) {
      this.state = next;
      this.emit();
      return true;
    }
    return false;
  }

  /** 人类超时未出价：视同出价 0。 */
  timeoutBid() {
    const next = forceBidZero(this.state, 0);
    if (next) {
      this.state = next;
      this.emit();
      return true;
    }
    return false;
  }

  /** 结算亮价：先补全 AI 出价（确定性），人类未出价则视同 0。 */
  resolve() {
    let state = this.state;
    for (let i = 1; i < state.players.length; i++) {
      if (state.bids[i] == null) {
        const amount = computeAiBid(state, i) ?? 0;
        const bid = engineBid(state, i, amount);
        state = bid || forceBidZero(state, i) || state;
      }
    }
    if (state.bids[0] == null) {
      state = forceBidZero(state, 0) || state;
    }
    const next = resolveRound(state);
    if (next) {
      this.state = next;
      this.emit();
      return true;
    }
    return false;
  }

  /** 开箱核算。 */
  open() {
    const next = openCrate(this.state);
    if (next) {
      this.state = next;
      this.emit();
      return true;
    }
    return false;
  }

  /** 进入下一回合（或终局）。 */
  next() {
    const next = nextRound(this.state);
    if (next) {
      this.state = next;
      this.emit();
      return true;
    }
    return false;
  }
}
