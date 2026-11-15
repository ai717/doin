// 测试共享驱动器：模拟控制器的自动流转（moving→arrive、act→endTurn），
// 以及带策略的整局对局（买地 / 放弃、用卡随机），供随机游走与终结性测试复用。

import { applyAction, createMatch, legalActions, checkInvariants } from "../js/engine.mjs";
import { mulberry32 } from "../js/engine.mjs";

export function makePlayers(mode = "quick", ai = "skilled") {
  if (mode === "2p") {
    return [
      { id: "p1", human: true, ai: null },
      { id: "p2", human: true, ai: null },
    ];
  }
  if (mode === "duo") {
    return [
      { id: "p1", human: true, ai: null },
      { id: "p2", human: false, ai },
      { id: "p3", human: false, ai },
    ];
  }
  return [
    { id: "p1", human: true, ai: null },
    { id: "p2", human: false, ai },
  ];
}

/** 单步推进：moving 自动 arrive，其余从 legalActions 里挑一个。 */
export function stepOnce(state, pick) {
  if (state.over) return { state, action: null, changed: false };
  if (state.phase === "moving") {
    const result = applyAction(state, { type: "arrive" });
    return { ...result, action: { type: "arrive" }, changed: result.state !== state };
  }
  const actions = legalActions(state);
  if (!actions.length) return { state, action: null, changed: false };
  const action = pick ? pick(actions, state) : actions[0];
  const result = applyAction(state, action);
  return { ...result, action, changed: result.state !== state };
}

/**
 * 随机游走一整局：每步断言不变式，返回 { state, steps, problems }。
 * limit 内必须终局（30 回合上限兜底 = 无死局证明）。
 */
export function walkMatch(seed, mode = "quick", ai = "skilled", limit = 800) {
  const rng = mulberry32(seed);
  let state = createMatch({ seed: seed * 2654435761 >>> 0, mode, players: makePlayers(mode, ai) });
  const problems = [];
  let steps = 0;
  while (!state.over && steps < limit) {
    const pick = (actions) => actions[Math.floor(rng() * actions.length)];
    const before = state;
    const next = stepOnce(state, pick);
    state = next.state;
    steps += 1;
    if (state === before && !next.changed) {
      // 空转：legalActions 有但 applyAction 拒绝 = 规则漏洞。
      problems.push(`action rejected: ${JSON.stringify(next.action)} @phase=${before.phase}`);
      break;
    }
    problems.push(...checkInvariants(state));
    if (problems.length) break;
  }
  if (!state.over && steps >= limit) problems.push("match did not terminate within limit");
  return { state, steps, problems };
}

/** 把一局完整跑完的便捷封装（带固定策略：能买就买、能盖就盖）。 */
export function playFullMatch(seed, mode = "quick", ai = "master", nasty = true) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  let state = createMatch({ seed, mode, players: makePlayers(mode, ai), nastyCards: nasty });
  let steps = 0;
  while (!state.over && steps < 800) {
    const next = stepOnce(state, (actions, current) => {
      // 策略：优先买地 / 盖屋 / 赎回，其次掷骰，卡牌偶尔用。
      const priority = ["buy", "upgrade", "redeem", "endTurn", "roll"];
      for (const type of priority) {
        const found = actions.find((action) => action.type === type);
        if (found) return found;
      }
      const shopBuys = actions.filter((action) => action.type === "shopBuy");
      if (shopBuys.length && rng() < 0.6) return shopBuys[Math.floor(rng() * shopBuys.length)];
      const cards = actions.filter((action) => action.type === "useCard");
      if (cards.length && rng() < 0.3) return cards[Math.floor(rng() * cards.length)];
      return actions[actions.length - 1];
    });
    state = next.state;
    steps += 1;
  }
  return { state, steps };
}
