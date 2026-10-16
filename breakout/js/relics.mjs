// relics.mjs — 12 枚核心（Relic）定义。纯数据，DOM-free，不含展示文本（文本在 i18n）。

export const RELIC_IDS = Object.freeze([
  "fireball",
  "lightning",
  "explosive",
  "sniper",
  "multiball",
  "magnet",
  "widePaddle",
  "laser",
  "shield",
  "comboFever",
  "slowMo",
  "goldRush",
]);

// 分类仅用于展示与三选一时的均衡抽取
export const RELIC_CATEGORY = Object.freeze({
  fireball: "attack",
  lightning: "attack",
  explosive: "attack",
  sniper: "attack",
  multiball: "attack",
  magnet: "paddle",
  widePaddle: "paddle",
  laser: "paddle",
  shield: "paddle",
  comboFever: "rhythm",
  slowMo: "rhythm",
  goldRush: "rhythm",
});

export const RELICS = Object.freeze({
  fireball: { id: "fireball", glyph: "🔥", color: "#ff6a2a" },
  lightning: { id: "lightning", glyph: "⚡", color: "#5ec8ff" },
  explosive: { id: "explosive", glyph: "💥", color: "#ff5a5a" },
  sniper: { id: "sniper", glyph: "🎯", color: "#b084ff" },
  multiball: { id: "multiball", glyph: "🌊", color: "#4dd0e1" },
  magnet: { id: "magnet", glyph: "🧲", color: "#ff9d5c" },
  widePaddle: { id: "widePaddle", glyph: "📏", color: "#8ad66a" },
  laser: { id: "laser", glyph: "🔫", color: "#ff3d7f" },
  shield: { id: "shield", glyph: "🛡️", color: "#6fb8ff" },
  comboFever: { id: "comboFever", glyph: "🔥", color: "#ffcc33" },
  slowMo: { id: "slowMo", glyph: "⏱️", color: "#9affd6" },
  goldRush: { id: "goldRush", glyph: "💰", color: "#ffd24a" },
});

// 从池中随机抽取 3 枚不重复核心，尽量覆盖不同类别（展示更丰富）。
export function rollRelicChoices(rng, owned, count = 3) {
  const ownedSet = new Set(owned);
  const pool = RELIC_IDS.filter((id) => !ownedSet.has(id));
  // 允许重复拥有的核心（如 shield 可叠加），但优先展示未拥有的
  const candidates = pool.length >= count ? pool : RELIC_IDS.slice();
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
