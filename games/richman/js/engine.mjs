// 规则唯一权威：纯函数 + 严格 DOM-free（禁碰 DOM / 存储 / window）。
// 环形 24 格棋盘的大富翁状态机：掷骰走格、买地收租、成套盖屋、道具博弈、
// 自动抵押防死局、30 回合资产兜底。所有随机走 mulberry32 注入式种子，可重放。

export const BOARD_SIZE = 24;
export const ROUND_LIMIT = 30;
export const START_CASH = 1500;
export const PASS_SALARY = 200;
export const START_BONUS = 100;
export const HOUSE_COST = 100;
export const MAX_HOUSE = 3;
export const HAND_LIMIT = 3;
export const RENT_RATE = 0.2;

// ---- 盘面静态数据（全部用字符串 key，展示文本统一查 i18n） ----

export const GROUP_TILES = {
  blue: [1, 2, 4],
  green: [7, 8, 10],
  yellow: [13, 14, 16],
  red: [19, 20, 22],
};

export const GROUP_PRICE = { blue: 100, green: 140, yellow: 180, red: 240 };

export const PROP_TILES = [
  ...GROUP_TILES.blue,
  ...GROUP_TILES.green,
  ...GROUP_TILES.yellow,
  ...GROUP_TILES.red,
];

export const PROP_GROUP = {};
for (const [group, tiles] of Object.entries(GROUP_TILES)) {
  for (const tile of tiles) PROP_GROUP[tile] = group;
}

export const TILES = [
  { tile: 0, type: "start" },
  { tile: 1, type: "prop", group: "blue" },
  { tile: 2, type: "prop", group: "blue" },
  { tile: 3, type: "chance" },
  { tile: 4, type: "prop", group: "blue" },
  { tile: 5, type: "fate" },
  { tile: 6, type: "rest" },
  { tile: 7, type: "prop", group: "green" },
  { tile: 8, type: "prop", group: "green" },
  { tile: 9, type: "trap" },
  { tile: 10, type: "prop", group: "green" },
  { tile: 11, type: "chance" },
  { tile: 12, type: "shop" },
  { tile: 13, type: "prop", group: "yellow" },
  { tile: 14, type: "prop", group: "yellow" },
  { tile: 15, type: "fate" },
  { tile: 16, type: "prop", group: "yellow" },
  { tile: 17, type: "trap" },
  { tile: 18, type: "bank" },
  { tile: 19, type: "prop", group: "red" },
  { tile: 20, type: "prop", group: "red" },
  { tile: 21, type: "chance" },
  { tile: 22, type: "prop", group: "red" },
  { tile: 23, type: "fate" },
];

export function tileInfo(tile) {
  return TILES[((tile % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];
}

// ---- 道具卡 ----

export const CARDS = {
  card_rentfree: "passive",
  card_roadblock: "target",
  card_dice: "value",
  card_swap: "two-step",
  card_tax: "instant",
  card_equal: "instant",
};

export const SHOP_STOCK = [
  "card_rentfree",
  "card_roadblock",
  "card_dice",
  "card_swap",
  "card_tax",
  "card_equal",
];

export const SHOP_PRICE = {
  card_rentfree: 100,
  card_roadblock: 120,
  card_dice: 150,
  card_swap: 180,
  card_tax: 220,
  card_equal: 260,
};

// ---- 确定性 PRNG ----

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextRand(state) {
  const rng = mulberry32(state.rngState);
  const value = rng();
  state.rngState = (state.rngState + 1) >>> 0;
  return value;
}

function randInt(state, min, max) {
  return min + Math.floor(nextRand(state) * (max - min + 1));
}

// ---- 价格与租金 ----

export function priceOf(tile) {
  const group = PROP_GROUP[tile];
  return group ? GROUP_PRICE[group] : 0;
}

export function rentFor(state, tile) {
  const land = state.lands[tile];
  if (!land || land.owner === null || land.mortgaged) return 0;
  const price = priceOf(tile);
  if (!price) return 0;
  const level = land.level;
  const setBonus = setComplete(state, land.owner, PROP_GROUP[tile]) ? 2 : 1;
  return Math.round(price * RENT_RATE * (1 + level) * setBonus);
}

export function mortgageValue(tile, level = 0) {
  const price = priceOf(tile);
  if (!price) return 0;
  return Math.round((price + level * HOUSE_COST) / 2);
}

export function setComplete(state, playerId, group) {
  return GROUP_TILES[group].every((tile) => state.lands[tile].owner === playerId);
}

export function setCount(state, playerId) {
  let count = 0;
  for (const group of Object.keys(GROUP_TILES)) {
    if (setComplete(state, playerId, group)) count += 1;
  }
  return count;
}

export function housesOf(state, playerId) {
  let total = 0;
  for (const tile of PROP_TILES) {
    const land = state.lands[tile];
    if (land && land.owner === playerId) total += land.level;
  }
  return total;
}

export function propsOf(state, playerId) {
  return PROP_TILES.filter((tile) => state.lands[tile]?.owner === playerId);
}

export function netWorth(state, playerId) {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) return 0;
  let worth = player.cash;
  for (const tile of propsOf(state, playerId)) {
    const land = state.lands[tile];
    worth += land.mortgaged ? mortgageValue(tile, land.level) : priceOf(tile) + land.level * HOUSE_COST;
  }
  return worth;
}

// ---- 建局 ----

function makePlayer(config) {
  return {
    id: config.id,
    human: Boolean(config.human),
    ai: config.ai ?? null,
    cash: START_CASH,
    pos: 0,
    alive: true,
    stopTurns: 0,
    cards: [],
    stats: { rentIn: 0, rentOut: 0, bought: 0, maxRent: 0, laps: 0 },
  };
}

function snapshotWorth(state) {
  const worth = {};
  for (const player of state.players) worth[player.id] = netWorth(state, player.id);
  return { round: state.round, worth };
}

export function createMatch(config) {
  const seed = (Number(config.seed) || 1) >>> 0;
  const players = (config.players ?? []).map(makePlayer);
  const lands = {};
  for (const tile of PROP_TILES) lands[tile] = { owner: null, level: 0, mortgaged: false };
  const state = {
    seed,
    rngState: seed,
    mode: config.mode ?? "quick",
    players,
    lands,
    blocks: [],
    round: 1,
    turn: 0,
    firstOfRound: 0,
    turnCount: 0,
    phase: "pre",
    pending: null,
    move: null,
    chain: 0,
    swapFrom: null,
    cardUsed: false,
    dice: { last: null, chosen: null },
    log: [],
    history: [],
    over: false,
    winner: null,
    overReason: null,
    nastyCards: config.nastyCards !== false,
  };
  // 新手局收走最狠的两张卡（策划拍板项二）。
  state.shopStock = SHOP_STOCK.filter(
    (card) => state.nastyCards || (card !== "card_tax" && card !== "card_equal"),
  );
  state.history.push(snapshotWorth(state));
  pushLog(state, "log_start", {});
  return state;
}

export function pushLog(state, key, params = {}) {
  state.log.push({ key, params });
  if (state.log.length > 90) state.log.splice(0, state.log.length - 90);
}

// ---- 查询辅助（UI / AI 共用） ----

export function currentPlayer(state) {
  return state.players[state.turn] ?? null;
}

export function playerById(state, id) {
  return state.players.find((entry) => entry.id === id) ?? null;
}

export function alivePlayers(state) {
  return state.players.filter((entry) => entry.alive);
}

export function opponentsOf(state, playerId) {
  return state.players.filter((entry) => entry.alive && entry.id !== playerId);
}

export function richestOpponent(state, playerId) {
  const list = opponentsOf(state, playerId);
  if (!list.length) return null;
  return list.reduce((best, entry) => (netWorth(state, entry.id) > netWorth(state, best.id) ? entry : best));
}

export function nextAliveIndex(state, from) {
  const count = state.players.length;
  for (let step = 1; step <= count; step += 1) {
    const idx = (from + step) % count;
    if (state.players[idx].alive) return idx;
  }
  return from;
}

export function canRoll(state) {
  return !state.over && state.phase === "pre" && !state.pending && !state.move;
}

export function hasCard(player, card) {
  return player.cards.includes(card);
}

export function cardUsable(state, card) {
  const player = currentPlayer(state);
  if (!player || state.over || state.phase !== "pre" || state.cardUsed) return false;
  if (!hasCard(player, card)) return false;
  return CARDS[card] !== "passive";
}

export function blockCandidates(state, playerId) {
  const candidates = [];
  for (const opponent of opponentsOf(state, playerId)) {
    for (let step = 1; step <= 3; step += 1) {
      const tile = (opponent.pos + step) % BOARD_SIZE;
      if (tile === 0) continue;
      if (state.blocks.some((entry) => entry.tile === tile)) continue;
      if (!candidates.includes(tile)) candidates.push(tile);
    }
  }
  return candidates.sort((a, b) => a - b);
}

export function swapMineCandidates(state, playerId) {
  return propsOf(state, playerId).filter((tile) => {
    const land = state.lands[tile];
    return !land.mortgaged && !setComplete(state, playerId, PROP_GROUP[tile]);
  });
}

export function swapTheirsCandidates(state, playerId) {
  const tiles = [];
  for (const opponent of opponentsOf(state, playerId)) {
    for (const tile of swapMineCandidates(state, opponent.id)) {
      if (!tiles.includes(tile)) tiles.push(tile);
    }
  }
  return tiles.sort((a, b) => a - b);
}

// ---- 现金流与破产 ----

function autoMortgage(state, playerId, need) {
  const player = playerById(state, playerId);
  const owned = propsOf(state, playerId).filter((tile) => !state.lands[tile].mortgaged);
  const rank = (tile) => {
    const inSet = setComplete(state, playerId, PROP_GROUP[tile]);
    return [inSet ? 1 : 0, priceOf(tile)];
  };
  owned.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra[0] !== rb[0]) return ra[0] - rb[0];
    return ra[1] - rb[1];
  });
  for (const tile of owned) {
    if (player.cash >= need) break;
    const land = state.lands[tile];
    land.mortgaged = true;
    const value = mortgageValue(tile, land.level);
    player.cash += value;
    pushLog(state, "log_mortgage", { name: player.id, tile, n: value });
  }
}

function bankrupt(state, playerId, creditorId, events) {
  const player = playerById(state, playerId);
  if (creditorId) {
    const creditor = playerById(state, creditorId);
    if (creditor && player.cash > 0) creditor.cash += player.cash;
  }
  player.cash = 0;
  player.alive = false;
  player.cards = [];
  for (const tile of PROP_TILES) {
    const land = state.lands[tile];
    if (land.owner === playerId) {
      land.owner = null;
      land.level = 0;
      land.mortgaged = false;
    }
  }
  state.blocks = state.blocks.filter((entry) => entry.owner !== playerId);
  pushLog(state, "log_bankrupt", { name: playerId });
  events.push({ type: "bankrupt", player: playerId });
  checkGameOver(state, events);
}

function pay(state, payerId, amount, creditorId, events) {
  if (amount <= 0) return;
  const payer = playerById(state, payerId);
  if (!payer || !payer.alive) return;
  if (payer.cash < amount) autoMortgage(state, payerId, amount);
  if (payer.cash >= amount) {
    payer.cash -= amount;
    if (creditorId) {
      const creditor = playerById(state, creditorId);
      if (creditor) creditor.cash += amount;
    }
    events.push({ type: "pay", from: payerId, to: creditorId ?? null, amount });
  } else {
    bankrupt(state, payerId, creditorId, events);
  }
}

function gain(state, playerId, amount, events, reason = "misc") {
  if (amount <= 0) return;
  const player = playerById(state, playerId);
  if (!player || !player.alive) return;
  player.cash += amount;
  events.push({ type: "gain", who: playerId, amount, reason });
}

// ---- 终局 ----

function finish(state, winner, reason, events) {
  state.over = true;
  state.winner = winner;
  state.overReason = reason;
  state.phase = "over";
  state.pending = null;
  pushLog(state, reason === "draw" ? "log_draw" : "log_win", { name: winner ?? "" });
  events.push({ type: "over", winner, reason });
}

function checkGameOver(state, events) {
  const alive = alivePlayers(state);
  const humansAlive = alive.filter((entry) => entry.human);
  if (alive.length === 1) {
    finish(state, alive[0].id, "last_standing", events);
  } else if (humansAlive.length === 0 && alive.length > 0) {
    finish(state, richestOpponent(state, alive[0].id).id ?? alive[0].id, "human_out", events);
  }
}

function finishByAssets(state, events) {
  const alive = alivePlayers(state);
  if (alive.length === 1) {
    finish(state, alive[0].id, "last_standing", events);
    return;
  }
  let best = null;
  let bestWorth = -1;
  let tie = false;
  for (const player of alive) {
    const worth = netWorth(state, player.id);
    if (worth > bestWorth) {
      bestWorth = worth;
      best = player;
      tie = false;
    } else if (worth === bestWorth) {
      tie = true;
    }
  }
  finish(state, tie ? null : best?.id ?? null, tie ? "draw" : "round_limit", events);
}

/** 失败复盘：找到人类玩家从领先跌到落后的回合（翻盘点）。 */
export function flipRound(state, playerId) {
  let aheadRound = null;
  for (const entry of state.history) {
    const values = Object.entries(entry.worth).filter(([id]) => id !== playerId);
    const bestOpp = values.length ? Math.max(...values.map(([, v]) => v)) : 0;
    const mine = entry.worth[playerId] ?? 0;
    if (mine >= bestOpp) aheadRound = entry.round;
  }
  if (aheadRound === null) return null;
  for (const entry of state.history) {
    if (entry.round <= aheadRound) continue;
    const values = Object.entries(entry.worth).filter(([id]) => id !== playerId);
    const bestOpp = values.length ? Math.max(...values.map(([, v]) => v)) : 0;
    const mine = entry.worth[playerId] ?? 0;
    if (mine < bestOpp) return entry.round;
  }
  return null;
}

// ---- 掷骰与移动 ----

function doRoll(state, action, events) {
  if (!canRoll(state)) return false;
  const player = currentPlayer(state);
  let value = state.dice.chosen;
  if (value === null || value === undefined) value = randInt(state, 1, 6);
  if (!Number.isInteger(value) || value < 1 || value > 6) value = randInt(state, 1, 6);
  state.dice.chosen = null;
  state.dice.last = value;

  const path = [];
  let pos = player.pos;
  let salary = 0;
  let blocked = false;
  for (let step = 1; step <= value; step += 1) {
    pos = (pos + 1) % BOARD_SIZE;
    if (pos === 0) salary += PASS_SALARY;
    path.push(pos);
    const block = state.blocks.find((entry) => entry.tile === pos && entry.owner !== player.id);
    if (block) {
      state.blocks = state.blocks.filter((entry) => entry !== block);
      player.stopTurns += 1;
      blocked = true;
      break;
    }
  }
  if (salary > 0) {
    player.stats.laps += 1;
    player.cash += salary;
    pushLog(state, "log_pass", { name: player.id, n: salary });
    events.push({ type: "gain", who: player.id, amount: salary, reason: "salary" });
  }
  if (blocked) {
    pushLog(state, "log_blocked", { name: player.id, tile: pos });
    events.push({ type: "blockHit", player: player.id, tile: pos });
  }
  player.pos = pos;
  state.move = { path, stopped: blocked };
  state.phase = "moving";
  events.push({ type: "dice", player: player.id, value });
  return true;
}

function doArrive(state, events) {
  if (state.phase !== "moving" || !state.move) return false;
  const player = currentPlayer(state);
  const tile = player.pos;
  state.move = null;
  state.phase = "act";
  state.pending = null;
  resolveTile(state, player, tile, events);
  return true;
}

function resolveTile(state, player, tile, events) {
  if (state.over) return;
  const info = tileInfo(tile);
  switch (info.type) {
    case "prop": {
      const land = state.lands[tile];
      if (land.owner === null) {
        const price = priceOf(tile);
        if (player.cash >= price) {
          state.pending = { kind: "buy", tile };
          pushLog(state, "log_offer_buy", { name: player.id, tile, n: price });
        } else {
          pushLog(state, "log_no_cash", { name: player.id, tile, n: price });
        }
      } else if (land.owner === player.id) {
        if (land.mortgaged) {
          const cost = mortgageValue(tile, land.level);
          if (player.cash >= cost) {
            state.pending = { kind: "redeem", tile, n: cost };
            pushLog(state, "log_offer_redeem", { name: player.id, tile, n: cost });
          } else {
            pushLog(state, "log_redeem_poor", { name: player.id, tile, n: cost });
          }
        } else if (setComplete(state, player.id, PROP_GROUP[tile]) && land.level < MAX_HOUSE) {
          state.pending = { kind: "upgrade", tile };
          pushLog(state, "log_offer_upgrade", { name: player.id, tile });
        } else {
          pushLog(state, "log_own_land", { name: player.id, tile });
        }
      } else {
        const owner = playerById(state, land.owner);
        const rent = rentFor(state, tile);
        if (!rent) {
          pushLog(state, "log_rent_free_land", { name: player.id, tile });
          break;
        }
        const freeCard = player.cards.indexOf("card_rentfree");
        if (freeCard >= 0) {
          player.cards.splice(freeCard, 1);
          pushLog(state, "log_rent_free_card", { name: player.id, tile });
          events.push({ type: "cardUsed", player: player.id, card: "card_rentfree" });
          break;
        }
        owner.stats.rentIn += rent;
        player.stats.rentOut += rent;
        if (rent > owner.stats.maxRent) owner.stats.maxRent = rent;
        pushLog(state, "log_rent", { name: player.id, owner: owner.id, tile, n: rent });
        events.push({ type: "rent", from: player.id, to: owner.id, tile, amount: rent });
        pay(state, player.id, rent, owner.id, events);
      }
      break;
    }
    case "chance": {
      chanceEvent(state, player, tile, events);
      break;
    }
    case "fate": {
      fateEvent(state, player, tile, events);
      break;
    }
    case "shop": {
      const affordable = state.shopStock.filter(
        (card) => SHOP_PRICE[card] <= player.cash && player.cards.length < HAND_LIMIT,
      );
      if (affordable.length) {
        state.pending = { kind: "shop", cards: affordable };
        pushLog(state, "log_offer_shop", { name: player.id });
      } else if (player.cards.length >= HAND_LIMIT) {
        pushLog(state, "log_shop_full", { name: player.id });
      } else {
        pushLog(state, "log_shop_poor", { name: player.id });
      }
      break;
    }
    case "bank": {
      const interest = Math.max(40, Math.min(200, Math.round(player.cash * 0.08)));
      pushLog(state, "log_bank", { name: player.id, n: interest });
      gain(state, player.id, interest, events, "bank");
      break;
    }
    case "rest": {
      pushLog(state, "log_rest", { name: player.id });
      break;
    }
    case "trap": {
      trapEvent(state, player, tile, events);
      break;
    }
    case "start": {
      pushLog(state, "log_start_bonus", { name: player.id, n: START_BONUS });
      gain(state, player.id, START_BONUS, events, "start");
      break;
    }
    default:
      break;
  }
}

function trapEvent(state, player, tile, events) {
  const roll = nextRand(state);
  if (roll < 0.4) {
    pushLog(state, "log_trap_pay", { name: player.id, tile, n: 100 });
    events.push({ type: "trap", tile, effect: "pay" });
    pay(state, player.id, 100, null, events);
  } else if (roll < 0.7) {
    pushLog(state, "log_trap_pay", { name: player.id, tile, n: 160 });
    events.push({ type: "trap", tile, effect: "pay" });
    pay(state, player.id, 160, null, events);
  } else {
    player.stopTurns += 1;
    pushLog(state, "log_trap_stop", { name: player.id, tile });
    events.push({ type: "trap", tile, effect: "stop" });
  }
}

const CHANCE_POOL = ["windfall", "tax", "toStart", "advance", "fine", "gift"];
const FATE_POOL = ["inherit", "repair", "freeCard", "drowsy", "lottery", "rentFree"];

function chanceEvent(state, player, tile, events) {
  let pick = CHANCE_POOL[randInt(state, 0, CHANCE_POOL.length - 1)];
  if (pick === "advance" && state.chain >= 2) pick = "windfall";
  switch (pick) {
    case "windfall": {
      pushLog(state, "log_chance_windfall", { name: player.id, n: 180 });
      gain(state, player.id, 180, events, "event");
      break;
    }
    case "tax": {
      const amount = Math.max(50, Math.min(300, Math.round(player.cash * 0.1)));
      pushLog(state, "log_chance_tax", { name: player.id, n: amount });
      pay(state, player.id, amount, null, events);
      break;
    }
    case "toStart": {
      pushLog(state, "log_chance_start", { name: player.id, n: PASS_SALARY });
      player.pos = 0;
      gain(state, player.id, PASS_SALARY, events, "event");
      events.push({ type: "teleport", player: player.id, tile: 0 });
      break;
    }
    case "advance": {
      state.chain += 1;
      state.move = { path: buildPath(player.pos, 3), stopped: false };
      state.phase = "moving";
      pushLog(state, "log_chance_advance", { name: player.id });
      events.push({ type: "chainMove", player: player.id, tiles: 3 });
      break;
    }
    case "fine": {
      pushLog(state, "log_chance_fine", { name: player.id, n: 120 });
      pay(state, player.id, 120, null, events);
      break;
    }
    case "gift": {
      const others = opponentsOf(state, player.id);
      let total = 0;
      for (const other of others) {
        const gift = Math.min(other.cash, 80);
        if (gift > 0) {
          other.cash -= gift;
          total += gift;
        }
      }
      pushLog(state, "log_chance_gift", { name: player.id, n: total });
      if (total > 0) gain(state, player.id, total, events, "event");
      break;
    }
    default:
      break;
  }
  events.push({ type: "event", tile, kind: "chance" });
}

function fateEvent(state, player, tile, events) {
  const pick = FATE_POOL[randInt(state, 0, FATE_POOL.length - 1)];
  switch (pick) {
    case "inherit": {
      pushLog(state, "log_fate_inherit", { name: player.id, n: 150 });
      gain(state, player.id, 150, events, "event");
      break;
    }
    case "repair": {
      pushLog(state, "log_fate_repair", { name: player.id, n: 140 });
      pay(state, player.id, 140, null, events);
      break;
    }
    case "freeCard": {
      if (player.cards.length < HAND_LIMIT) {
        const stock = state.shopStock;
        const card = stock[randInt(state, 0, stock.length - 1)];
        player.cards.push(card);
        pushLog(state, "log_fate_card", { name: player.id, card });
        events.push({ type: "cardGain", player: player.id, card });
      } else {
        pushLog(state, "log_fate_card_cash", { name: player.id, n: 100 });
        gain(state, player.id, 100, events, "event");
      }
      break;
    }
    case "drowsy": {
      player.stopTurns += 1;
      pushLog(state, "log_fate_drowsy", { name: player.id });
      break;
    }
    case "lottery": {
      if (nextRand(state) < 0.6) {
        pushLog(state, "log_fate_lottery_win", { name: player.id, n: 250 });
        gain(state, player.id, 250, events, "event");
      } else {
        pushLog(state, "log_fate_lottery_lose", { name: player.id, n: 100 });
        pay(state, player.id, 100, null, events);
      }
      break;
    }
    case "rentFree": {
      if (player.cards.length < HAND_LIMIT) {
        player.cards.push("card_rentfree");
        pushLog(state, "log_fate_rentfree", { name: player.id });
        events.push({ type: "cardGain", player: player.id, card: "card_rentfree" });
      } else {
        pushLog(state, "log_fate_card_cash", { name: player.id, n: 100 });
        gain(state, player.id, 100, events, "event");
      }
      break;
    }
    default:
      break;
  }
  events.push({ type: "event", tile, kind: "fate" });
}

function buildPath(from, steps) {
  const path = [];
  let pos = from;
  for (let step = 1; step <= steps; step += 1) {
    pos = (pos + 1) % BOARD_SIZE;
    path.push(pos);
  }
  return path;
}

// ---- 回合推进 ----

/**
 * 回合交棒：把轮次指针推进到下一个「能行动」的玩家。
 * 停驻（路障 / 陷阱 / 打盹）在这里消耗，绕回本轮起点玩家时记为一整轮。
 */
function advanceTurn(state, events) {
  const total = state.players.length;
  let idx = state.turn;
  let lap = false;
  let guard = 0;
  while (guard < total * 4 + 4) {
    guard += 1;
    if (!state.players[state.firstOfRound].alive) {
      state.firstOfRound = nextAliveIndex(state, state.firstOfRound);
    }
    idx = nextAliveIndex(state, idx);
    if (idx === state.firstOfRound) lap = true;
    const player = state.players[idx];
    if (player.stopTurns > 0) {
      player.stopTurns -= 1;
      pushLog(state, "log_skip", { name: player.id });
      events.push({ type: "skipTurn", player: player.id });
      state.turnCount += 1;
      continue;
    }
    state.turnCount += 1;
    return { idx, lap };
  }
  return { idx: state.turn, lap };
}

function doEndTurn(state, events) {
  if (state.over) return false;
  if (state.phase !== "act" || state.pending) return false;
  const { idx, lap } = advanceTurn(state, events);
  state.turn = idx;
  state.phase = "pre";
  state.pending = null;
  state.cardUsed = false;
  state.chain = 0;
  state.swapFrom = null;
  if (lap) {
    state.round += 1;
    state.history.push(snapshotWorth(state));
    if (state.round > ROUND_LIMIT) {
      finishByAssets(state, events);
      return true;
    }
  }
  return true;
}

// ---- 行动结算（合法操作必执行，非法意图返回原状态） ----

function doBuy(state, events) {
  const player = currentPlayer(state);
  const pending = state.pending;
  if (!pending || pending.kind !== "buy") return false;
  const price = priceOf(pending.tile);
  if (player.cash < price) {
    state.pending = null;
    return true;
  }
  player.cash -= price;
  state.lands[pending.tile].owner = player.id;
  player.stats.bought += 1;
  pushLog(state, "log_buy", { name: player.id, tile: pending.tile, n: price });
  events.push({ type: "stamp", tile: pending.tile, owner: player.id });
  state.pending = null;
  return true;
}

function doUpgrade(state, events) {
  const player = currentPlayer(state);
  const pending = state.pending;
  if (!pending || pending.kind !== "upgrade") return false;
  const land = state.lands[pending.tile];
  if (land.owner !== player.id || land.mortgaged || land.level >= MAX_HOUSE) {
    state.pending = null;
    return true;
  }
  if (player.cash < HOUSE_COST) {
    state.pending = null;
    return true;
  }
  player.cash -= HOUSE_COST;
  land.level += 1;
  pushLog(state, "log_upgrade", { name: player.id, tile: pending.tile, n: land.level });
  events.push({ type: "build", tile: pending.tile, owner: player.id, level: land.level });
  state.pending = null;
  return true;
}

function doRedeem(state, events) {
  const player = currentPlayer(state);
  const pending = state.pending;
  if (!pending || pending.kind !== "redeem") return false;
  const land = state.lands[pending.tile];
  const cost = mortgageValue(pending.tile, land.level);
  if (land.owner !== player.id || !land.mortgaged || player.cash < cost) {
    state.pending = null;
    return true;
  }
  player.cash -= cost;
  land.mortgaged = false;
  pushLog(state, "log_redeem", { name: player.id, tile: pending.tile, n: cost });
  events.push({ type: "redeem", tile: pending.tile, owner: player.id });
  state.pending = null;
  return true;
}

function doShopBuy(state, card, events) {
  const player = currentPlayer(state);
  const pending = state.pending;
  if (!pending || pending.kind !== "shop") return false;
  if (!state.shopStock.includes(card)) return false;
  if (player.cards.length >= HAND_LIMIT || player.cash < SHOP_PRICE[card]) {
    state.pending = null;
    return true;
  }
  player.cash -= SHOP_PRICE[card];
  player.cards.push(card);
  pushLog(state, "log_shop_buy", { name: player.id, card, n: SHOP_PRICE[card] });
  events.push({ type: "cardGain", player: player.id, card });
  state.pending = null;
  return true;
}

function doUseCard(state, action, events) {
  const player = currentPlayer(state);
  if (state.phase !== "pre" || state.cardUsed || state.pending) return false;
  const card = action.card;
  const index = player.cards.indexOf(card);
  if (index < 0 || CARDS[card] === "passive") return false;
  switch (card) {
    case "card_dice": {
      let value = Number(action.payload?.value);
      if (!Number.isInteger(value) || value < 1 || value > 6) return false;
      player.cards.splice(index, 1);
      state.cardUsed = true;
      state.dice.chosen = value;
      pushLog(state, "log_card_dice", { name: player.id, n: value });
      events.push({ type: "cardUsed", player: player.id, card });
      return true;
    }
    case "card_tax": {
      const target = richestOpponent(state, player.id);
      if (!target) return false;
      const amount = Math.max(60, Math.round(netWorth(state, target.id) * 0.1));
      player.cards.splice(index, 1);
      state.cardUsed = true;
      pushLog(state, "log_card_tax", { name: player.id, target: target.id, n: amount });
      events.push({ type: "cardUsed", player: player.id, card });
      pay(state, target.id, amount, null, events);
      return true;
    }
    case "card_equal": {
      const alive = alivePlayers(state);
      if (alive.length < 2) return false;
      const total = alive.reduce((sum, entry) => sum + entry.cash, 0);
      const base = Math.floor(total / alive.length);
      let remainder = total - base * alive.length;
      player.cards.splice(index, 1);
      state.cardUsed = true;
      for (const entry of alive) {
        entry.cash = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
      }
      pushLog(state, "log_card_equal", { name: player.id, n: base });
      events.push({ type: "cardUsed", player: player.id, card });
      return true;
    }
    case "card_roadblock": {
      if (!blockCandidates(state, player.id).length) return false;
      state.phase = "blockPick";
      return true;
    }
    case "card_swap": {
      if (!swapMineCandidates(state, player.id).length) return false;
      if (!swapTheirsCandidates(state, player.id).length) return false;
      state.phase = "swapMine";
      return true;
    }
    default:
      return false;
  }
}

function doBlockPick(state, tile, events) {
  const player = currentPlayer(state);
  if (state.phase !== "blockPick") return false;
  const index = player.cards.indexOf("card_roadblock");
  if (index < 0 || !blockCandidates(state, player.id).includes(tile)) return false;
  player.cards.splice(index, 1);
  state.blocks.push({ tile, owner: player.id });
  state.cardUsed = true;
  state.phase = "pre";
  pushLog(state, "log_card_block", { name: player.id, tile });
  events.push({ type: "block", tile, owner: player.id });
  return true;
}

function doSwapPick(state, tile, events) {
  const player = currentPlayer(state);
  if (state.phase === "swapMine") {
    if (!swapMineCandidates(state, player.id).includes(tile)) return false;
    state.swapFrom = tile;
    state.phase = "swapTheirs";
    return true;
  }
  if (state.phase === "swapTheirs") {
    const from = state.swapFrom;
    if (from === null || !swapTheirsCandidates(state, player.id).includes(tile)) return false;
    const mine = state.lands[from];
    const theirs = state.lands[tile];
    const theirOwner = theirs.owner;
    theirs.owner = player.id;
    mine.owner = theirOwner;
    const index = player.cards.indexOf("card_swap");
    if (index >= 0) player.cards.splice(index, 1);
    state.cardUsed = true;
    state.swapFrom = null;
    state.phase = "pre";
    pushLog(state, "log_card_swap", { name: player.id, tile: from, target: tile });
    events.push({ type: "swap", mine: from, theirs: tile });
    return true;
  }
  return false;
}

function doCancelCard(state) {
  if (state.phase === "blockPick" || state.phase === "swapMine" || state.phase === "swapTheirs") {
    state.phase = "pre";
    state.swapFrom = null;
    return true;
  }
  return false;
}

/**
 * 唯一入口：applyAction(state, action) → { state, events }。
 * 纯函数：不修改传入 state；非法 action 原样返回（action: null 语义由 UI 层静默处理）。
 */
export function applyAction(state, action) {
  if (!state || state.over || !action || typeof action.type !== "string") {
    return { state, events: [] };
  }
  const next = structuredClone(state);
  const events = [];
  let handled = false;
  switch (action.type) {
    case "roll":
      handled = doRoll(next, action, events);
      break;
    case "arrive":
      handled = doArrive(next, events);
      break;
    case "endTurn":
      handled = doEndTurn(next, events);
      break;
    case "buy":
      handled = doBuy(next, events);
      break;
    case "skip":
      if (next.pending) {
        next.pending = null;
        handled = true;
      }
      break;
    case "upgrade":
      handled = doUpgrade(next, events);
      break;
    case "redeem":
      handled = doRedeem(next, events);
      break;
    case "shopBuy":
      handled = doShopBuy(next, action.card, events);
      break;
    case "useCard":
      handled = doUseCard(next, action, events);
      break;
    case "blockPick":
      handled = doBlockPick(next, action.tile, events);
      break;
    case "swapPick":
      handled = doSwapPick(next, action.tile, events);
      break;
    case "cancelCard":
      handled = doCancelCard(next);
      break;
    default:
      handled = false;
      break;
  }
  if (!handled) return { state, events: [] };
  return { state: next, events };
}

// ---- 合法动作枚举（随机游走测试 / UI 提示共用） ----

export function legalActions(state) {
  if (!state || state.over) return [];
  const actions = [];
  const player = currentPlayer(state);
  if (!player || !player.alive) return actions;
  if (state.phase === "pre" && !state.pending) {
    actions.push({ type: "roll" });
    if (!state.cardUsed) {
      for (const card of player.cards) {
        if (CARDS[card] === "passive") continue;
        if (card === "card_dice") {
          for (let value = 1; value <= 6; value += 1) {
            actions.push({ type: "useCard", card, payload: { value } });
          }
        } else if (card === "card_roadblock") {
          if (blockCandidates(state, player.id).length) actions.push({ type: "useCard", card });
        } else if (card === "card_swap") {
          if (swapMineCandidates(state, player.id).length && swapTheirsCandidates(state, player.id).length) {
            actions.push({ type: "useCard", card });
          }
        } else if (card === "card_tax") {
          if (opponentsOf(state, player.id).length) actions.push({ type: "useCard", card });
        } else if (card === "card_equal") {
          if (alivePlayers(state).length >= 2) actions.push({ type: "useCard", card });
        } else {
          actions.push({ type: "useCard", card });
        }
      }
    }
  } else if (state.phase === "blockPick") {
    for (const tile of blockCandidates(state, player.id)) {
      actions.push({ type: "blockPick", tile });
    }
    actions.push({ type: "cancelCard" });
  } else if (state.phase === "swapMine") {
    for (const tile of swapMineCandidates(state, player.id)) {
      actions.push({ type: "swapPick", tile });
    }
    actions.push({ type: "cancelCard" });
  } else if (state.phase === "swapTheirs") {
    for (const tile of swapTheirsCandidates(state, player.id)) {
      actions.push({ type: "swapPick", tile });
    }
    actions.push({ type: "cancelCard" });
  } else if (state.phase === "act") {
    if (state.pending) {
      actions.push({ type: "skip" });
      const pending = state.pending;
      if (pending.kind === "buy" && player.cash >= priceOf(pending.tile)) {
        actions.push({ type: "buy" });
      }
      if (pending.kind === "upgrade" && player.cash >= HOUSE_COST) {
        actions.push({ type: "upgrade" });
      }
      if (pending.kind === "redeem" && player.cash >= pending.n) {
        actions.push({ type: "redeem" });
      }
      if (pending.kind === "shop") {
        for (const card of pending.cards) {
          if (player.cash >= SHOP_PRICE[card]) actions.push({ type: "shopBuy", card });
        }
      }
    } else {
      actions.push({ type: "endTurn" });
    }
  }
  return actions;
}

// ---- 状态不变式（随机游走测试断言用） ----

export function checkInvariants(state) {
  const problems = [];
  for (const player of state.players) {
    if (!Number.isFinite(player.cash)) problems.push(`cash NaN for ${player.id}`);
    if (player.cash < 0) problems.push(`negative cash for ${player.id}`);
    if (player.alive && player.cash === 0 && propsOf(state, player.id).length === 0) {
      // 现金归零且无地：下一步任何付款都会破产，这是合法状态，不算违例。
    }
    for (const card of player.cards) {
      if (!CARDS[card]) problems.push(`unknown card ${card}`);
    }
    if (player.cards.length > HAND_LIMIT) problems.push(`hand overflow for ${player.id}`);
  }
  for (const tile of PROP_TILES) {
    const land = state.lands[tile];
    if (!land) problems.push(`missing land ${tile}`);
    else if (land.owner !== null && !state.players.some((entry) => entry.id === land.owner)) {
      problems.push(`owner ghost on ${tile}`);
    } else if (land.owner !== null && !state.players.find((entry) => entry.id === land.owner)?.alive) {
      problems.push(`owner bankrupt on ${tile}`);
    }
    if (land && (land.level < 0 || land.level > MAX_HOUSE)) problems.push(`bad level on ${tile}`);
  }
  for (const block of state.blocks) {
    if (!state.players.some((entry) => entry.id === block.owner && entry.alive)) {
      problems.push(`ghost block on ${block.tile}`);
    }
  }
  if (state.round > ROUND_LIMIT + 1) problems.push("round overflow");
  return problems;
}
