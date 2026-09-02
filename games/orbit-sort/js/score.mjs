// orbit-sort 积分计算模块（纯函数，与 UI 无关）
// 算法:
//   score = baseScore + moveScore + timeScore (各部分独立，全部 ≥ 0)
//
// 9. 今日挑战（原"今日星轨"改名）：每日一题，为所有玩家难度 D5~D7 的高难度题
//    - 基础分 todayBonus = +200（比主线关卡的基础分多一倍奖励）
//    - 步数分/时间分满分上限放宽为 150（今日挑战每维最高 150 而非 100，最低 40）
//    - 目的："高分爽感" 与 "高难度风险" 匹配，鼓励玩家每日冲榜
//
// 1) 基础分 baseScore (随难度递增，只要完成就能拿)
//    difficultyLevel = 难度级别 D1..D∞
//    baseScore = 80 + difficultyLevel * 40
//    D1=120, D2=160, D3=200, D4=240, D5=280, D6=320, D7=360
//    今日挑战 额外 +200 基础分奖励（每日通关第一题）
//
// 2) 步数分 moveScore
//    主线：满分起点 = par (官方最优步数)，Mmax = ceil(par * 1.5)，
//          moveScore = max( 20, 100 - max(0, moves - Mmax) )
//    今日挑战：满分上限 150，最低 40
//
// 3) 时间分 timeScore
//    主线：≤Tmax 100，每超 10s 扣 1，顶 20 （Tmax = 45 + (D-1)*18 s）
//    今日挑战：满分上限 150，最低 40
//
// 4) 撤回 / 重置 / 步数定义
//    movesPlayed = 成功位移的 extract/insert 次数，撤回不减少
//
// 5) 总积分 (用户维度)
//    bestScore[levelId] = max(历史单局最高)
//    bestScore["daily:" + dateKey] = 当日挑战最高分
//    totalScore = Σ 所有关卡 bestScore 之和
//
// 6) 三星评价
//    stars: moves ≤ par → 3★；moves ≤ par + 3 → 2★；其它 → 1★

import { paramsForDifficulty } from "../difficulty.mjs?v=dev";

export const MOVE_SCORE_MIN = 20;
export const TIME_SCORE_MIN = 20;
export const SCORE_MAX_PER_DIM = 100;

// 今日挑战：奖励翻倍
export const DAILY_MOVE_SCORE_MIN = 40;
export const DAILY_TIME_SCORE_MIN = 40;
export const DAILY_SCORE_MAX_PER_DIM = 150;

export function dailyBonusScore() { return 200; } // 今日挑战基础分附加奖励

export function baseScoreFor(difficultyLevel, isDaily = false) {
  const D = Math.max(1, Number.isFinite(difficultyLevel) ? difficultyLevel : 1);
  const base = 80 + Math.trunc(D) * 40;
  return isDaily ? base + dailyBonusScore() : base;
}

export function moveMax(par) { return Math.max(1, Math.ceil(par * 1.5)); }

export function moveScore(par, moves, isDaily = false) {
  const p = Math.max(1, par | 0);
  const m = Math.max(0, moves | 0);
  const mmax = moveMax(p);
  const MAX = isDaily ? DAILY_SCORE_MAX_PER_DIM : SCORE_MAX_PER_DIM;
  const MIN = isDaily ? DAILY_MOVE_SCORE_MIN : MOVE_SCORE_MIN;
  if (m <= p) return MAX; // ≤ par 直接满分
  const penalty = Math.max(0, m - mmax);
  return Math.max(MIN, MAX - penalty);
}

export function timeMax(difficultyLevel, isDaily = false) {
  const D = Math.max(1, difficultyLevel | 0);
  const base = 45 + (D - 1) * 18; // seconds
  // 今日挑战: 时长放宽 30%（D5~D7 题大，给更多时间）
  return isDaily ? Math.round(base * 1.3) : base;
}

export function timeScore(difficultyLevel, elapsedMs, isDaily = false) {
  const sec = Math.max(0, Math.floor(elapsedMs / 1000));
  const tmax = timeMax(difficultyLevel, isDaily);
  const MAX = isDaily ? DAILY_SCORE_MAX_PER_DIM : SCORE_MAX_PER_DIM;
  const MIN = isDaily ? DAILY_TIME_SCORE_MIN : TIME_SCORE_MIN;
  if (sec <= tmax) return MAX;
  const over10 = Math.floor((sec - tmax) / 10);
  return Math.max(MIN, MAX - over10);
}

// level.today / id === "daily" 视为今日挑战关卡
export function isDailyLevel(level) {
  return !!level && (level.today === true || level.id === "daily" || /^daily:/i.test(String(level.id ?? "")));
}

// 根据 level 参数反查最小匹配的 difficulty level (在主线关卡里用)
export function difficultyForLevel(level) {
  if (!level) return 1;
  // 1) level.difficulty 直接带了就用
  if (Number.isInteger(level.difficulty) && level.difficulty >= 1) return level.difficulty;
  // 2) 从 1..30 反查 paramsForDifficulty 完全匹配
  const target = {
    capacity: level.capacity,
    colorCount: level.colorCount ?? (Array.isArray(level.tracks) ? level.tracks.length - 1 : 3),
    dockCount: level.dockCount ?? 1,
  };
  for (let D = 1; D <= 40; D += 1) {
    const p = paramsForDifficulty(D);
    if (p.capacity === target.capacity && p.colorCount === target.colorCount && p.dockCount === target.dockCount) return D;
  }
  // 3) 兜底线性近似: D ≈ (capacity-3)*4 + (colorCount-3)*3 + (dock===1 ? 2 : 0) + 1
  const d = Math.max(1,
    (target.capacity - 3) * 4 +
    (target.colorCount - 3) * 3 +
    (target.dockCount === 1 ? 2 : 0) +
    1);
  return d;
}

export function starsFor(par, moves) {
  const m = Math.max(0, moves | 0);
  const p = Math.max(1, par | 0);
  if (m <= p) return 3;
  if (m <= p + 3) return 2;
  return 1;
}

export function computeScore({ level, isDaily: isDailyOverride, movesPlayed, elapsedMs }) {
  const daily = Boolean(isDailyOverride ?? isDailyLevel(level));
  const D = difficultyForLevel(level);
  const base = baseScoreFor(D, daily);
  const par = Number.isInteger(level?.par) ? level.par : Math.max(1, Math.trunc((base - (daily ? dailyBonusScore() : 0) - 80) / 40 * 4 + 3));
  const move = moveScore(par, movesPlayed, daily);
  const time = timeScore(D, elapsedMs, daily);
  const total = base + move + time;
  const stars = starsFor(par, movesPlayed);
  return { total, base, move, time, stars, difficulty: D, par, elapsedMs, daily };
}
