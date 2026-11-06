// 盲盒记忆牌 — 图腾集（数据层，禁止裸写中文）
// 每个图腾持有 id 与 emoji/glyph 形象符号；展示文本由 i18n.mjs 查询。

export const TOTEMS = Object.freeze({
  octo_pop:     { id: "octo_pop",     glyph: "🐙" },
  missy_miao:   { id: "missy_miao",   glyph: "🐱" },
  brick_bro:    { id: "brick_bro",    glyph: "🧱" },
  rice_imp:     { id: "rice_imp",     glyph: "🍙" },
  beaver_kid:   { id: "beaver_kid",   glyph: "🦫" },
  puffer_bun:   { id: "puffer_bun",   glyph: "🐰" },
  cactus_straw: { id: "cactus_straw", glyph: "🌵" },
  cloud_toast:  { id: "cloud_toast",  glyph: "☁️" },
  twin_fox:     { id: "twin_fox",     glyph: "🦊" },
  cherry_golem: { id: "cherry_golem", glyph: "🍒" },
  mail_moth:    { id: "mail_moth",    glyph: "🦋" },
  pilot_pear:   { id: "pilot_pear",   glyph: "🍐" },
  donut_yeti:   { id: "donut_yeti",   glyph: "🍩" },
  gourd_witch:  { id: "gourd_witch",  glyph: "🧙" },
  spring_hog:   { id: "spring_hog",   glyph: "🐷" },
  tape_dino:    { id: "tape_dino",    glyph: "🦕" },
  // mascot 系列用 14 个几何符号（与具名图腾的彩色 emoji 区分）
  mascot_0:    { id: "mascot_0",    glyph: "▲" },
  mascot_1:    { id: "mascot_1",    glyph: "■" },
  mascot_2:    { id: "mascot_2",    glyph: "●" },
  mascot_3:    { id: "mascot_3",    glyph: "◆" },
  mascot_4:    { id: "mascot_4",    glyph: "★" },
  mascot_5:    { id: "mascot_5",    glyph: "♦" },
  mascot_6:    { id: "mascot_6",    glyph: "♣" },
  mascot_7:    { id: "mascot_7",    glyph: "♥" },
  mascot_8:    { id: "mascot_8",    glyph: "♠" },
  mascot_9:    { id: "mascot_9",    glyph: "♪" },
  mascot_10:   { id: "mascot_10",   glyph: "✚" },
  mascot_11:   { id: "mascot_11",   glyph: "✦" },
  mascot_12:   { id: "mascot_12",   glyph: "✧" },
  mascot_13:   { id: "mascot_13",   glyph: "❖" },
});

export const TOTEM_IDS = Object.freeze(Object.keys(TOTEMS));
export const TOTEM_COUNT = TOTEM_IDS.length;  // 30

/** 取图腾的 emoji/glyph 形象符号 */
export function totemGlyph(totemId) {
  if (!totemId) return "";
  return TOTEMS[totemId]?.glyph ?? "";
}

/** 取前 N 种图腾的 id（沙盒可选集子集时用） */
export function pickTotemIds(n) {
  if (!Number.isInteger(n) || n < 1 || n > TOTEM_COUNT) return [];
  return TOTEM_IDS.slice(0, n);
}
