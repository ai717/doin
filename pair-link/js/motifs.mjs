// 琉璃瓷片母题表（纯数据，零 DOM、零外链）
// 形状是第一识别位：12 个母题轮廓差异显著，肉眼一眼可辨。
// 颜色是第二识别位：4 档琉璃色 × 3 档明度，整体压在暖铜 / 绯红的夜市氛围里。

export const TINTS = {
  "amber-1": { lt: "#f2c98a", mid: "#dcab63", dk: "#a97a33" },
  "amber-2": { lt: "#e2ab5c", mid: "#c4863a", dk: "#8a5a24" },
  "amber-3": { lt: "#c08f45", mid: "#9c6f2c", dk: "#674619" },
  "crimson-1": { lt: "#f0a08e", mid: "#d4705c", dk: "#9e3d2d" },
  "crimson-2": { lt: "#e07f6a", mid: "#bf5541", dk: "#87301f" },
  "crimson-3": { lt: "#b8634f", mid: "#93412f", dk: "#5f2617" },
  "porcelain-1": { lt: "#fbf3e2", mid: "#e6d7ba", dk: "#b6a284" },
  "porcelain-2": { lt: "#eee0c4", mid: "#cfbb98", dk: "#9a8563" },
  "porcelain-3": { lt: "#d4c2a2", mid: "#b09b78", dk: "#7b6746" },
  "celadon-1": { lt: "#b8ddc9", mid: "#7cbba2", dk: "#3f7d69" },
  "celadon-2": { lt: "#93cbb5", mid: "#5aa78d", dk: "#2d6a57" },
  "celadon-3": { lt: "#6ea892", mid: "#3f8270", dk: "#1e5344" }
};

export const MOTIF_COUNT = 12;

export const MOTIFS = [
  {
    id: 1,
    key: "ring",
    zh: "圆环",
    en: "Ring",
    tint: "amber-1",
    // 外圆环 + 内孔（evenodd）
    paths: ["M2.5 16A13.5 13.5 0 1 0 29.5 16A13.5 13.5 0 1 0 2.5 16ZM9.5 16A6.5 6.5 0 1 0 22.5 16A6.5 6.5 0 1 0 9.5 16Z"]
  },
  {
    id: 2,
    key: "rhombus",
    zh: "菱形",
    en: "Rhombus",
    tint: "crimson-2",
    paths: ["M16 2L30 16L16 30L2 16Z"]
  },
  {
    id: 3,
    key: "meander",
    zh: "回纹",
    en: "Meander",
    tint: "porcelain-1",
    paths: ["M3 3H29V29H3ZM10 10H22V22H10Z"]
  },
  {
    id: 4,
    key: "cloud",
    zh: "云纹",
    en: "Cloud",
    tint: "celadon-2",
    paths: [
      "M5 24C2.2 24 0.5 21.7 1.2 19.2C1.8 17 3.8 15.6 6 15.8C6.4 12.2 9.4 9.4 13 9.4C15.6 9.4 17.9 10.8 19.1 12.9C19.9 12.3 21 11.9 22.1 11.9C24.9 11.9 27.2 14.2 27.2 17C27.2 17.6 27.1 18.1 27 18.6C29.3 19.2 31 21.3 31 23.8L31 24Z"
    ]
  },
  {
    id: 5,
    key: "octagram",
    zh: "八角星",
    en: "Octagram",
    tint: "amber-3",
    paths: [
      "M31 16L21.7 18.4L26.6 26.6L18.4 21.7L16 31L13.6 21.7L5.4 26.6L10.3 18.4L1 16L10.3 13.6L5.4 5.4L13.6 10.3L16 1L18.4 10.3L26.6 5.4L21.7 13.6Z"
    ]
  },
  {
    id: 6,
    key: "drop",
    zh: "水滴",
    en: "Drop",
    tint: "crimson-1",
    paths: ["M16 2C22 10 28 15 28 20A12 12 0 0 1 4 20C4 15 10 10 16 2Z"]
  },
  {
    id: 7,
    key: "fangsheng",
    zh: "方胜",
    en: "Knot",
    tint: "porcelain-3",
    paths: ["M11 3L21 13L11 23L1 13ZM21 9L31 19L21 29L11 19Z"]
  },
  {
    id: 8,
    key: "ripple",
    zh: "涟漪",
    en: "Ripple",
    tint: "celadon-1",
    paths: [
      "M2 16A14 14 0 1 0 30 16A14 14 0 1 0 2 16ZM4.5 16A11.5 11.5 0 1 0 27.5 16A11.5 11.5 0 1 0 4.5 16Z",
      "M6.5 16A9.5 9.5 0 1 0 25.5 16A9.5 9.5 0 1 0 6.5 16ZM9 16A7 7 0 1 0 23 16A7 7 0 1 0 9 16Z",
      "M11 16A5 5 0 1 0 21 16A5 5 0 1 0 11 16ZM13.5 16A2.5 2.5 0 1 0 18.5 16A2.5 2.5 0 1 0 13.5 16Z"
    ]
  },
  {
    id: 9,
    key: "hexagon",
    zh: "六棱",
    en: "Hexagon",
    tint: "amber-2",
    paths: ["M16 2L28.1 9L28.1 23L16 30L3.9 23L3.9 9ZM16 8.5L22.5 12.3L22.5 19.7L16 23.5L9.5 19.7L9.5 12.3Z"]
  },
  {
    id: 10,
    key: "crescent",
    zh: "月牙",
    en: "Crescent",
    tint: "crimson-3",
    paths: ["M1 16A13 13 0 1 0 27 16A13 13 0 1 0 1 16ZM9.5 16A10.5 10.5 0 1 0 30.5 16A10.5 10.5 0 1 0 9.5 16Z"]
  },
  {
    id: 11,
    key: "tortoise",
    zh: "龟甲",
    en: "Tortoise",
    tint: "porcelain-2",
    paths: [
      "M16 3.2L21.4 6.3L21.4 12.5L16 15.6L10.6 12.5L10.6 6.3Z",
      "M10.6 12.5L16 15.6L16 21.8L10.6 24.9L5.2 21.8L5.2 15.6Z",
      "M21.4 12.5L26.8 15.6L26.8 21.8L21.4 24.9L16 21.8L16 15.6Z"
    ]
  },
  {
    id: 12,
    key: "wave",
    zh: "水波纹",
    en: "Wave",
    tint: "celadon-3",
    paths: [
      "M2 8C6 4 10 4 16 8C22 12 26 12 30 8L30 11C26 15 22 15 16 11C10 7 6 7 2 11Z",
      "M2 15C6 11 10 11 16 15C22 19 26 19 30 15L30 18C26 22 22 22 16 18C10 14 6 14 2 18Z",
      "M2 22C6 18 10 18 16 22C22 26 26 26 30 22L30 25C26 29 22 29 16 25C10 21 6 21 2 25Z"
    ]
  }
];

const BY_ID = new Map(MOTIFS.map((motif) => [motif.id, motif]));

/** 按图案 id（1..12）取母题；非法 id 回退到第一个母题。 */
export function motifById(id) {
  return BY_ID.get(id) || MOTIFS[0];
}

/** 取某图案的瓷片三段渐变色（浅 / 中 / 深）。 */
export function tileStops(id) {
  const motif = motifById(id);
  return TINTS[motif.tint] || TINTS["amber-2"];
}

/** 该图案的母题标识（用于无障碍文本与测试断言）。 */
export function motifKey(id) {
  return motifById(id).key;
}
