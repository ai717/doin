// 计分唯一口径：UI 不自算分。这里定义事件分值、星级，供 game 层累计与展示。
import { EV_HOME, EV_FLY } from "./engine.mjs";

export const SCORE = Object.freeze({
  HOP: 10,     // 朝向河对岸前进一格
  HOME: 50,    // 归巢
  FLY: 200,    // 命中飞虫槽（额外续命）
});

// 事件 → 附加分（前进 hop 的分值由 game 层按方向判定，这里只对归巢事件加分）。
export function eventScore(event) {
  if (event === EV_HOME) return SCORE.HOME;
  if (event === EV_FLY) return SCORE.FLY;
  return 0;
}

// 星级：基于损命次数（闯关的自然指标），保底 1 星，0 损命为 3 星。
export function starRating(totalLostLives) {
  if (totalLostLives <= 0) return 3;
  if (totalLostLives === 1) return 2;
  return 1;
}

export function perfectScore(totalLostLives) {
  return totalLostLives <= 0;
}