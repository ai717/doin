// 推币机 · 无尽机台数据（纯数据层：只允许字符串 key 与数值，严禁裸写中文）
//
// 本作不设章节与关卡目标：一台机一直玩，账户币数归零才收工。
// 这里只保留「初始台面铺币参数」与「机关随机投放权重表」两类数据。
//
// 坐标：台面 13 × 11，推板前缘 2.8~3.65，边缘线 y=11，六方首行 y=4.15。

export const START_Y = 4.15;

// 奖励卡三种增益
export const CARD_EFFECTS = ["double", "speed", "magnet"];

// 初始台面（无尽机台的唯一布局）
export const ENDLESS_LAYOUT = {
  seed: 20261008,
  rows: 9,
  startY: START_Y,
  goldRatio: 0.08,
  gemRatio: 0.03
};

// 机关随机投放权重（累计概率，最后一项必须为 1）
export const TOKEN_TABLE = [
  { t: "card", upto: 0.42 },
  { t: "launcher", upto: 0.68 },
  { t: "magnet", upto: 0.90 },
  { t: "tower", upto: 1 }
];

// 机关投放的可用区域（避开推板行程与最前沿的悬垂带）
export const TOKEN_AREA = { x0: 1.7, x1: 11.3, y0: 7.0, y1: 9.9 };
