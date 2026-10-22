// 倒退贪吃蛇 Uncoil · 计分唯一口径（UI 不得自算分）
//
// 本作**不设分数**：核心乐趣是空间解谜，冲分会把它稀释成又一个贪吃蛇山寨品。
// 这里唯一负责的是「步数 → 星级」与「蜕皮进度」两个展示口径，
// 以及"新纪录"判定 —— 全部纯函数，无 DOM、无随机。

// 三星 = 走出不劣于参考步数（par）的解；宽松一档给 2 星。
export const TWO_STAR_SLACK = 0.25;

export function parSlack(par) {
  const p = Math.max(1, Math.floor(par));
  return Math.ceil(p * TWO_STAR_SLACK);
}

export function starsFor(steps, par) {
  const s = Math.max(0, Math.floor(steps));
  const p = Math.max(1, Math.floor(par));
  if (s <= p) return 3;
  if (s <= p + parSlack(p)) return 2;
  return 1;
}

// 蜕皮进度：0 = 原长，1 = 只剩一节。
export function shedProgress(len, initLen) {
  // 开局就只有一节 = 开局即完成，进度直接给满
  if (Math.floor(initLen) <= 1) return 1;
  const total = Math.max(1, Math.floor(initLen) - 1);
  const done = Math.max(1, Math.floor(initLen)) - Math.max(1, Math.floor(len));
  const r = done / total;
  return Math.min(1, Math.max(0, r));
}

// 剩余丸数（含当前激活的这一颗）
export function pelletsLeft(pelletIndex, total) {
  if (pelletIndex < 0) return 0;
  return Math.max(0, Math.floor(total) - Math.floor(pelletIndex));
}

export function isRecord(prevBest, steps) {
  if (prevBest === undefined || prevBest === null || prevBest <= 0) return true;
  return Math.floor(steps) < Math.floor(prevBest);
}

// 结算星级文字（★ / ☆），UI 只做展示，不参与判定
export function starMarks(stars) {
  const n = Math.min(3, Math.max(0, Math.floor(stars)));
  return "★".repeat(n) + "☆".repeat(3 - n);
}
