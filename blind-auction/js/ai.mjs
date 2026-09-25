// 盲盒竞拍 · 8 性格 AI 池（纯函数，DOM-free）
// ------------------------------------------------------------------
// 出价模型：出价 = 私密情报估值 × 行情系数估计 × 性格激进系数 × 资金压力修正 + 种子扰动
// 确定性：AI 决策只用 state.seed 派生的子随机源，同种子 100% 重放一致。
// 难度：
//  - easy：性格池子集（直白可读）、无伪装；
//  - standard：全池、30% 扰动伪装；
//  - hard：全池、标签隐藏，"建立模式再打破"伪装引擎（前 3 回合按模式、后 2 回合反模式设陷阱）。
// ------------------------------------------------------------------

import {
  deriveRng,
  estimateCrate,
  CATEGORIES,
  START_CASH,
  HOARDER_CASH,
  PLAYER_COUNT,
  ROUNDS,
  MIN_COEF,
  MAX_COEF,
} from "./engine.mjs";

export const PERSONA_IDS = [
  "cautious", "gambler", "collector", "scavenger", "shark", "oracle", "rookie", "speculator",
];

// easy 难度默认性格池（直白可读，新手友好）
export const EASY_POOL = ["cautious", "rookie", "scavenger", "speculator"];

export const PERSONAS = {
  cautious: {
    id: "cautious",
    nameZh: "老周", nameEn: "Old Zhou",
    titleZh: "谨慎估价师", titleEn: "Cautious Appraiser",
    icon: "🧐",
    aggression: 0.8, noise: 0.1, intel: 1, targetCat: null, bluff: 0,
    emoWinZh: "稳了稳了，眼光还在。", emoLoseZh: "看走眼了……",
    emoWinEn: "Steady. My eye is still sharp.", emoLoseEn: "I misjudged it…",
  },
  gambler: {
    id: "gambler",
    nameZh: "阿豪", nameEn: "Hao",
    titleZh: "梭哈赌徒", titleEn: "All-in Gambler",
    icon: "🎲",
    aggression: 1.3, noise: 0.15, intel: 1, targetCat: null, bluff: 0,
    emoWinZh: "这把梭对了！", emoLoseZh: "可恶，看走眼了！",
    emoWinEn: "That gamble paid off!", emoLoseEn: "Damn, I misread it!",
  },
  collector: {
    id: "collector",
    nameZh: "富姐", nameEn: "Ms. Fu",
    titleZh: "囤积收藏家", titleEn: "Collector",
    icon: "🖼️",
    aggression: 1.5, noise: 0.12, intel: 1, targetCat: ["antique", "art"], bluff: 0,
    emoWinZh: "志在必得的东西，到手了。", emoLoseZh: "哼，这箱子不值这个价。",
    emoWinEn: "What I wanted, I got.", emoLoseEn: "Hmph, that crate wasn't worth it.",
  },
  scavenger: {
    id: "scavenger",
    nameZh: "小满", nameEn: "Manny",
    titleZh: "捡漏猎手", titleEn: "Deal Hunter",
    icon: "🔍",
    aggression: 0.55, noise: 0.08, intel: 1, targetCat: null, bluff: 0,
    emoWinZh: "捡漏成功，美滋滋。", emoLoseZh: "大意了，这波不该跟。",
    emoWinEn: "Snagged a steal.", emoLoseEn: "Slipped up there.",
  },
  shark: {
    id: "shark",
    nameZh: "虎哥", nameEn: "Tiger",
    titleZh: "抬价大师", titleEn: "Price Shark",
    icon: "🐯",
    aggression: 1.2, noise: 0.1, intel: 1, targetCat: null, bluff: 0,
    emoWinZh: "（眯眼笑）这波是抬轿的艺术。", emoLoseZh: "哼，让给你了，亏不死你。",
    emoWinEn: "(squints) The art of the pump.", emoLoseEn: "Fine, take it. Hope it burns.",
  },
  oracle: {
    id: "oracle",
    nameZh: "V", nameEn: "V",
    titleZh: "情报商人", titleEn: "Info Broker",
    icon: "🕶️",
    aggression: 1.0, noise: 0.05, intel: 2, targetCat: null, bluff: 0,
    emoWinZh: "情报不会骗人。", emoLoseZh: "……情报也有失灵的一天。",
    emoWinEn: "Intel never lies.", emoLoseEn: "…Even intel fails sometimes.",
  },
  rookie: {
    id: "rookie",
    nameZh: "小萌", nameEn: "Momo",
    titleZh: "新手暴发户", titleEn: "Rookie",
    icon: "🌸",
    aggression: 0.6, noise: 0.5, intel: 0, targetCat: null, bluff: 0,
    emoWinZh: "哇！赚到了！", emoLoseZh: "啊……亏了……",
    emoWinEn: "Wow! Jackpot!", emoLoseEn: "Aw… I lost…",
  },
  speculator: {
    id: "speculator",
    nameZh: "老钱", nameEn: "Qian",
    titleZh: "市场投机客", titleEn: "Speculator",
    icon: "📈",
    aggression: 0.9, noise: 0.15, intel: 1, targetCat: null, bluff: 0,
    emoWinZh: "行情站在我这边。", emoLoseZh: "行情就是天，天有不测风云。",
    emoWinEn: "The market is on my side.", emoLoseEn: "Markets swing; so be it.",
  },
};

// hard 难度后 2 回合的"打破模式"伪装修正（加法作用于 aggression）
export const BLUFF_TABLE = {
  cautious: +0.45,  // 突然激进抬价
  gambler: -0.6,    // 突然保守收手
  collector: -0.9,  // 目标品类不再执着
  scavenger: +0.5,  // 突然抢价
  shark: -0.3,      // 突然不那么抬
  oracle: +0.25,    // 故意偏离情报
  rookie: 0,        // 本来就乱，无需伪装
  speculator: -0.3, // 逆行情操作
};

// ---------------------------------------------------------------- 玩家构建

export function createHumanPlayer(character) {
  return {
    kind: "human",
    personaId: null,
    intelLevel: 1,
    cash: character === "hoarder" ? HOARDER_CASH : START_CASH,
    character,
  };
}

// 确定性抽 3 个性格（easy 从子集抽）。
export function pickPersonas(rng, difficulty) {
  const pool = difficulty === "easy" ? EASY_POOL : PERSONA_IDS;
  const ids = [...pool];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, PLAYER_COUNT - 1);
}

export function createAiPlayers(rng, difficulty) {
  const picked = pickPersonas(rng, difficulty);
  return picked.map((personaId) => {
    const persona = PERSONAS[personaId];
    return {
      kind: "ai",
      personaId,
      intelLevel: persona.intel,
      cash: START_CASH,
      character: null,
    };
  });
}

// 残局挑战：按指定性格构建 AI 玩家（不随机抽取）。
export function createAiPlayersFrom(personas) {
  return personas.map((personaId) => {
    const persona = PERSONAS[personaId];
    return {
      kind: "ai",
      personaId,
      intelLevel: persona.intel,
      cash: START_CASH,
      character: null,
    };
  });
}

// ---------------------------------------------------------------- 行情系数估计

function estimateCoef(state, persona, rng, catGuess) {
  const market = state.market;
  // 情报商人：直接用真实系数（intel 2）
  if (persona.id === "oracle") return market.coef[catGuess] || 1.15;
  const report = market.publicReport;
  const inHot = report.hot.find((r) => r.cat === catGuess);
  const inCold = report.cold.find((r) => r.cat === catGuess);
  const inFlat = report.flat.find((r) => r.cat === catGuess);
  if (inHot) return (inHot.lo + inHot.hi) / 2;
  if (inCold) return (inCold.lo + inCold.hi) / 2;
  if (inFlat) return (inFlat.lo + inFlat.hi) / 2;
  // 隐藏品类：估 1.15 中值 ± 噪声（投机客更贴近公告情绪）
  if (persona.id === "speculator") return 1.15 + (rng() * 2 - 1) * 0.2;
  return 1.15 + (rng() * 2 - 1) * 0.3;
}

function baseAggression(state, persona, player, rng) {
  const id = persona.id;
  if (id === "cautious") return 0.8;
  if (id === "gambler") {
    if (state.roundIndex <= 1) return 1.3; // 开局凶
    return player.cash / player.initialCash < 0.3 ? 0.5 : 1.0; // 后期露怯
  }
  if (id === "collector") {
    return persona.targetCat.includes(state.crate.category) ? 1.5 : 0.2;
  }
  if (id === "scavenger") return 0.55;
  if (id === "shark") return 1.2;
  if (id === "oracle") return 1.0;
  if (id === "rookie") return 0.3 + rng() * 0.7;
  if (id === "speculator") return 0.9;
  return 1.0;
}

// 资金压力修正：现金越少出价越收敛（暴发户除外）
function budgetFactor(persona, player) {
  if (persona.id === "rookie") return 1;
  const ratio = player.cash / Math.max(1, player.initialCash);
  return 0.5 + 0.5 * Math.min(1, ratio * 1.6);
}

// ---------------------------------------------------------------- AI 出价

export function computeAiBid(state, playerIndex) {
  const player = state.players[playerIndex];
  if (!player || player.kind !== "ai") return null;
  const persona = PERSONAS[player.personaId];
  if (!persona) return null;
  const rng = deriveRng(state.seed, "ai", playerIndex, state.roundIndex, state.crate.trueValue);

  const hints = [
    ...(state.crate.publicHints || []),
    ...((state.crate.privateHints && state.crate.privateHints[playerIndex]) || []),
  ];
  const est = estimateCrate(state.crate, hints);
  const coefEst = estimateCoef(state, persona, rng, est.catGuess);
  let expected = est.value * coefEst;

  let aggression = baseAggression(state, persona, player, rng);

  // hard 难度伪装引擎：前 3 回合建立模式，后 2 回合打破模式设陷阱
  if (state.difficulty === "hard" && state.roundIndex >= ROUNDS - 2) {
    aggression += BLUFF_TABLE[persona.id] || 0;
  }
  // standard 难度：轻微扰动伪装
  if (state.difficulty === "standard" && rng() < 0.3) {
    aggression += (rng() * 2 - 1) * 0.25;
  }

  let bid = expected * aggression * budgetFactor(persona, player);

  // 抬价大师：虚高出价但真实预算受限（目标是推高第二名，自己不会真买贵）
  if (persona.id === "shark") {
    const cap = player.cash * 0.4;
    bid = Math.max(bid, expected * 1.2);
    bid = Math.min(bid, cap);
  }

  // 噪声（性格决定）
  bid += (rng() * 2 - 1) * persona.noise * expected;

  // clamp
  const amount = Math.max(0, Math.min(player.cash, Math.round(bid)));
  return amount;
}

// 包打听技能的出价区间预测（纯展示派生，不写状态）
export function estimateAiBidRange(state, targetIndex) {
  const player = state.players[targetIndex];
  if (!player || player.kind !== "ai") return null;
  const persona = PERSONAS[player.personaId];
  const rng = deriveRng(state.seed, "gossip", targetIndex, state.roundIndex);
  const hints = [
    ...(state.crate.publicHints || []),
    ...((state.crate.privateHints && state.crate.privateHints[targetIndex]) || []),
  ];
  const est = estimateCrate(state.crate, hints);
  const coefEst = estimateCoef(state, persona, rng, est.catGuess);
  const expected = est.value * coefEst;
  let aggression = baseAggression(state, persona, player, rng);
  if (state.difficulty === "hard" && state.roundIndex >= ROUNDS - 2) {
    aggression += BLUFF_TABLE[persona.id] || 0;
  }
  const center = expected * aggression * budgetFactor(persona, player);
  const cash = Math.max(0, player.cash);
  const lo = Math.max(0, Math.min(cash, Math.round(center * 0.75)));
  const hi = Math.min(cash, Math.round(center * 1.25));
  return { lo, hi, personaId: player.personaId };
}

// ---------------------------------------------------------------- 情绪文本

export function emotionText(personaId, kind, locale) {
  const isEn = locale === "en";
  if (!personaId) {
    // 人类玩家的通用情绪
    return kind === "win"
      ? (isEn ? "What a haul!" : "这波血赚！")
      : (isEn ? "Overpaid…" : "买贵了……");
  }
  const persona = PERSONAS[personaId];
  if (!persona) return "";
  if (kind === "win") return isEn ? persona.emoWinEn : persona.emoWinZh;
  return isEn ? persona.emoLoseEn : persona.emoLoseZh;
}

export function personaLabel(personaId, locale) {
  const persona = PERSONAS[personaId];
  if (!persona) return "";
  return isEn(locale) ? `${persona.titleEn} ${persona.nameEn}` : `${persona.titleZh}「${persona.nameZh}」`;
}

function isEn(locale) {
  return locale === "en";
}
