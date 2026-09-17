// filepath: games/bubble-bloom/js/palette.mjs

// 十阶彩泡配色：低阶半透明糖果色，高阶出现珠光与极光色带。
// 供 render 绘制与 ui 图鉴共用，engine 不依赖本模块。

export const TIER_COLORS = [
  { base: "#F4836B", lite: "#FFC3A8", deep: "#B2452F" },
  { base: "#F2A65C", lite: "#FFD79E", deep: "#B06A28" },
  { base: "#F0D465", lite: "#FFF0B4", deep: "#AE9025" },
  { base: "#A8D96A", lite: "#DBF5A8", deep: "#5F9130" },
  { base: "#5FD6C4", lite: "#B6F5EA", deep: "#248C7C" },
  { base: "#58B4EE", lite: "#B6E4FF", deep: "#20689C" },
  { base: "#6C8CF0", lite: "#BCCBFF", deep: "#2F49A6" },
  { base: "#A87BF0", lite: "#DCC4FF", deep: "#5C35A8" },
  { base: "#F072C8", lite: "#FFBEEC", deep: "#9A2C7C" },
  { base: "#EAF2FF", lite: "#FFFFFF", deep: "#7FA6D8" }
];

export function tierColor(tier) {
  const index = Math.min(Math.max(Math.round(tier), 1), TIER_COLORS.length) - 1;
  return TIER_COLORS[index];
}
