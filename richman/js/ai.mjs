// AI 决策：只读盘面、返回动作对象，绝不改引擎状态。
// 三档风格：novice 随缘买地；skilled 会攒成套、留现金；
// master 会算租金收益、留应急金、针对性用卡坑人。

import {
  HOUSE_COST,
  SHOP_PRICE,
  blockCandidates,
  netWorth,
  opponentsOf,
  priceOf,
  propsOf,
  rentFor,
  setComplete,
  swapMineCandidates,
  swapTheirsCandidates,
  tileInfo,
  currentPlayer,
  playerById,
} from "./engine.mjs";

function pickRandom(rng, list) {
  return list[Math.floor(rng() * list.length) % Math.max(1, list.length)] ?? null;
}

function bestRentTile(state, playerId) {
  let best = null;
  let bestRent = 0;
  for (const tile of propsOf(state, playerId)) {
    const rent = rentFor(state, tile);
    if (rent > bestRent) {
      bestRent = rent;
      best = tile;
    }
  }
  return best;
}

function completesSet(state, playerId, tile) {
  const info = tileInfo(tile);
  if (info.type !== "prop") return false;
  const owned = propsOf(state, playerId).filter((entry) => tileInfo(entry).group === info.group);
  return owned.length === 2;
}

/** 遥控骰子：挑一个对自己最有利的点数（落自家地 / 无主便宜地，躲开高额租金）。 */
function bestDiceValue(state, playerId) {
  const scores = [];
  for (let value = 1; value <= 6; value += 1) {
    const tile = (playerById(state, playerId).pos + value) % 24;
    const info = tileInfo(tile);
    let score = 0;
    if (info.type === "prop") {
      const land = state.lands[tile];
      if (land.owner === playerId) score += 3; // 自家地可盖屋，收益最高
      else if (land.owner === null) score += priceOf(tile) <= 180 ? 2.5 : 1;
      else score -= Math.min(6, rentFor(state, tile) / 25);
    } else if (info.type === "chance" || info.type === "fate" || info.type === "bank") {
      score += 1;
    } else if (info.type === "trap") {
      score -= 2;
    }
    // 确定性微偏置：同分时偏好大点数（多领薪水概率更高），保证可测。
    scores.push({ value, score: score + value * 0.02 });
  }
  scores.sort((a, b) => b.score - a.score || b.value - a.value);
  return scores[0].value;
}

function chooseCard(state, playerId, level, rng) {
  const player = playerById(state, playerId);
  if (!player || state.cardUsed) return null;
  const cards = player.cards;
  if (!cards.length) return null;
  const myWorth = netWorth(state, playerId);
  const opponents = opponentsOf(state, playerId);
  if (!opponents.length) return null;
  const richest = opponents.reduce((best, entry) =>
    netWorth(state, entry.id) > netWorth(state, best.id) ? entry : best,
  );
  const oppWorth = netWorth(state, richest.id);

  if (cards.includes("card_equal")) {
    if (level === "master" && oppWorth - myWorth >= 500) {
      return { type: "useCard", card: "card_equal" };
    }
  }
  if (cards.includes("card_tax")) {
    const threshold = level === "master" ? 1400 : 2200;
    if (oppWorth >= threshold || (level !== "novice" && oppWorth - myWorth >= 700)) {
      return { type: "useCard", card: "card_tax" };
    }
  }
  if (cards.includes("card_roadblock")) {
    const candidates = blockCandidates(state, playerId);
    if (candidates.length && (level === "master" || (level === "skilled" && rng() < 0.6))) {
      return { type: "useCard", card: "card_roadblock" };
    }
  }
  if (cards.includes("card_swap")) {
    const mine = swapMineCandidates(state, playerId);
    const theirs = swapTheirsCandidates(state, playerId);
    if (mine.length && theirs.length) {
      const give = mine.reduce((a, b) => (priceOf(a) <= priceOf(b) ? a : b));
      const take = theirs.reduce((a, b) => (priceOf(a) >= priceOf(b) ? a : b));
      if (level !== "novice" && priceOf(take) - priceOf(give) >= 60) {
        return { type: "useCard", card: "card_swap" };
      }
    }
  }
  if (cards.includes("card_dice")) {
    if (level === "master" || (level === "skilled" && rng() < 0.35)) {
      return { type: "useCard", card: "card_dice", payload: { value: bestDiceValue(state, playerId) } };
    }
    if (level === "novice" && rng() < 0.25) {
      return { type: "useCard", card: "card_dice", payload: { value: 1 + Math.floor(rng() * 6) } };
    }
  }
  return null;
}

function pickBlockTile(state, playerId, level, rng) {
  const candidates = blockCandidates(state, playerId);
  if (!candidates.length) return null;
  if (level === "novice") return pickRandom(rng, candidates);
  // 老练 AI：堵在对手最值钱的地块前。
  return candidates.reduce((best, tile) => {
    const scoreOf = (entry) => {
      const info = tileInfo(entry);
      return info.type === "prop" ? priceOf(entry) : 0;
    };
    return scoreOf(tile) > scoreOf(best) ? tile : best;
  });
}

function pickSwapMine(state, playerId) {
  const candidates = swapMineCandidates(state, playerId);
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (priceOf(a) <= priceOf(b) ? a : b));
}

function pickSwapTheirs(state, playerId) {
  const candidates = swapTheirsCandidates(state, playerId);
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (priceOf(a) >= priceOf(b) ? a : b));
}

function wantBuy(state, playerId, level, rng) {
  const pending = state.pending;
  const player = playerById(state, playerId);
  const price = priceOf(pending.tile);
  if (player.cash < price) return false;
  const set = completesSet(state, playerId, pending.tile);
  if (level === "novice") {
    return player.cash >= price + 150 && rng() < 0.7;
  }
  if (level === "skilled") {
    if (set) return player.cash >= price + 80;
    return player.cash >= price + 250;
  }
  // master：成套优先；否则留足应急金，且会卡对手成套。
  if (set) return player.cash >= price + 60;
  const blocksOpponent = state.players
    .filter((entry) => entry.alive && entry.id !== playerId && !entry.human)
    .some((entry) => completesSet(state, entry.id, pending.tile));
  const reserve = blocksOpponent ? 80 : 220;
  return player.cash >= price + reserve;
}

function wantUpgrade(state, playerId, level, rng) {
  const player = playerById(state, playerId);
  if (player.cash < HOUSE_COST) return false;
  const pending = state.pending;
  const rent = rentFor(state, pending.tile) / 2; // 升一级大约翻一倍，取现值参考
  if (level === "novice") return player.cash >= 350 && rng() < 0.5;
  if (level === "skilled") return player.cash >= rent + 350;
  return player.cash >= rent + 260;
}

function wantRedeem(state, playerId, level) {
  const player = playerById(state, playerId);
  const cost = state.pending.n ?? 0;
  if (player.cash < cost) return false;
  if (level === "novice") return player.cash >= cost + 300;
  return player.cash >= cost + 600;
}

function shopChoice(state, playerId, level, rng) {
  const player = playerById(state, playerId);
  const pending = state.pending;
  const affordable = pending.cards.filter((card) => SHOP_PRICE[card] <= player.cash);
  if (!affordable.length) return { type: "skip" };
  if (level === "novice") {
    if (rng() < 0.5) return { type: "shopBuy", card: pickRandom(rng, affordable) };
    return { type: "skip" };
  }
  const priority =
    level === "master"
      ? ["card_dice", "card_roadblock", "card_tax", "card_rentfree", "card_swap", "card_equal"]
      : ["card_rentfree", "card_dice", "card_roadblock", "card_swap"];
  for (const card of priority) {
    if (affordable.includes(card) && player.cash >= SHOP_PRICE[card] + (level === "master" ? 200 : 320)) {
      return { type: "shopBuy", card };
    }
  }
  return { type: "skip" };
}

/** 当前是否轮到该 AI 决策。 */
export function isAiTurn(state, playerId) {
  const player = currentPlayer(state);
  return Boolean(player && player.id === playerId && player.ai && !player.human);
}

/** 返回一个动作对象（或 null = 无事可做，由控制器兜底跳过）。 */
export function aiDecide(state, playerId, rng = Math.random) {
  const player = playerById(state, playerId);
  if (!player || !player.alive || !player.ai) return null;
  const level = player.ai;
  switch (state.phase) {
    case "pre": {
      if (state.pending) return null;
      const card = chooseCard(state, playerId, level, rng);
      if (card) return card;
      return { type: "roll" };
    }
    case "blockPick": {
      const tile = pickBlockTile(state, playerId, level, rng);
      return tile === null ? { type: "cancelCard" } : { type: "blockPick", tile };
    }
    case "swapMine": {
      const tile = pickSwapMine(state, playerId);
      return tile === null ? { type: "cancelCard" } : { type: "swapPick", tile };
    }
    case "swapTheirs": {
      const tile = pickSwapTheirs(state, playerId);
      return tile === null ? { type: "cancelCard" } : { type: "swapPick", tile };
    }
    case "act": {
      const pending = state.pending;
      if (!pending) return { type: "endTurn" };
      if (pending.kind === "buy") return wantBuy(state, playerId, level, rng) ? { type: "buy" } : { type: "skip" };
      if (pending.kind === "upgrade") {
        return wantUpgrade(state, playerId, level, rng) ? { type: "upgrade" } : { type: "skip" };
      }
      if (pending.kind === "redeem") {
        return wantRedeem(state, playerId, level) ? { type: "redeem" } : { type: "skip" };
      }
      if (pending.kind === "shop") return shopChoice(state, playerId, level, rng);
      return { type: "skip" };
    }
    default:
      return null;
  }
}
