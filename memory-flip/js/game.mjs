// 盲盒记忆牌 — 状态控制器（DOM-free）
// 接收 UI 意图调度 engine；维护当前对局与计时器；触发 audio 与回调

import { createLevel, createSandbox, flip, cancelFlip, hasUnmatched, foundTotems, STATUS, ACTION, MECH } from "./engine.mjs";
import { LEVELS, levelById } from "./levels.mjs";
import { gradeStars } from "./score.mjs";
import { todayKey } from "./engine.mjs";

/**
 * 控制器状态：
 * - mode: "campaign" | "daily" | "sandbox"
 * - level: 当前关卡配置（levels.mjs 的一项）
 * - state: engine 对局状态
 * - startedAt: 起始时间戳（毫秒）
 * - endedAt: 终局时间戳（毫秒）
 * - callbacks: { onState, onFlip, onMatch, onMismatch, onWin, onLose, onRotate }
 */
export function createController(callbacks = {}) {
  return {
    mode: null,
    level: null,
    state: null,
    startedAt: 0,
    endedAt: 0,
    callbacks,
  };
}

function notify(controller, event) {
  const cb = controller.callbacks;
  if (cb.onState) cb.onState(controller);
  if (event && cb.onFlip) cb.onFlip(event, controller);
}

/** 开始一关（闯关模式或沙盒模式） */
export function startCampaignLevel(controller, levelId, seedOverride) {
  const lv = levelById(levelId);
  if (!lv) return false;
  const seed = Number.isInteger(seedOverride) ? seedOverride : hashSeed(levelId);
  const state = createLevel({
    levelId: lv.id,
    rows: lv.rows, cols: lv.cols, totemCount: lv.totemCount,
    seed, mech: lv.mech, missBudget: lv.missBudget,
  });
  controller.mode = "campaign";
  controller.level = lv;
  controller.state = state;
  controller.startedAt = Date.now();
  controller.endedAt = 0;
  notify(controller, null);
  return true;
}

/** 开始每日盲盒（用日期作为种子） */
export function startDaily(controller, dateKey) {
  const dk = dateKey ?? todayKey();
  const seed = hashSeed(dk);
  // 每日盲盒用第 5 章风格的残局：4x6 / ring8 / missBudget=4
  const state = createLevel({
    levelId: `daily_${dk}`,
    rows: 4, cols: 6, totemCount: 12,
    seed, mech: "ring8", missBudget: 4,
  });
  controller.mode = "daily";
  controller.level = { id: `daily_${dk}`, chapter: 5, rows: 4, cols: 6, totemCount: 12, mech: "ring8", missBudget: 4, parMisses: 2, parSeconds: 180, parCombo: 3 };
  controller.state = state;
  controller.startedAt = Date.now();
  controller.endedAt = 0;
  notify(controller, null);
  return true;
}

/** 开始沙盒对局 */
export function startSandbox(controller, opts) {
  const state = createSandbox(opts);
  controller.mode = "sandbox";
  controller.level = { id: "sandbox", chapter: 0, rows: state.rows, cols: state.cols, totemCount: state.totemCount, mech: state.mech, missBudget: null, parMisses: 0, parSeconds: 0, parCombo: 0 };
  controller.state = state;
  controller.startedAt = Date.now();
  controller.endedAt = 0;
  notify(controller, null);
  return true;
}

/** 翻牌主操作 */
export function flipAt(controller, idx) {
  if (!controller.state) return null;
  const before = controller.state;
  const result = flip(before, idx);
  if (result.action === ACTION.NONE) return result;

  if (result.action === ACTION.FLIP_ONE) {
    notify(controller, result.event);
    return result;
  }

  if (result.action === ACTION.MATCH || result.action === ACTION.MATCH_WIN) {
    if (controller.callbacks.onMatch) controller.callbacks.onMatch(result.event, controller);
    if (result.action === ACTION.MATCH_WIN) {
      controller.endedAt = Date.now();
      if (controller.callbacks.onWin) controller.callbacks.onWin(result.event, controller);
    }
    notify(controller, result.event);
    return result;
  }

  if (result.action === ACTION.MISMATCH || result.action === ACTION.MISMATCH_LOSE) {
    if (controller.callbacks.onMismatch) controller.callbacks.onMismatch(result.event, controller);
    if (result.event?.rotations?.length && controller.callbacks.onRotate) {
      controller.callbacks.onRotate(result.event, controller);
    }
    if (result.action === ACTION.MISMATCH_LOSE) {
      controller.endedAt = Date.now();
      if (controller.callbacks.onLose) controller.callbacks.onLose(result.event, controller);
    }
    notify(controller, result.event);
    return result;
  }

  return result;
}

/** 取消第一张已翻开牌（容错） */
export function cancelFlipFirst(controller) {
  if (!controller.state) return null;
  const r = cancelFlip(controller.state);
  if (r.action !== ACTION.NONE) notify(controller, r.event);
  return r;
}

/** 已用毫秒数 */
export function elapsedMs(controller) {
  if (!controller.startedAt) return 0;
  const end = controller.endedAt || Date.now();
  return end - controller.startedAt;
}

/** 关卡结算（仅当 status 为 won/lost 时调用） */
export function settleResult(controller) {
  if (!controller.state || controller.state.status === STATUS.PLAYING) return null;
  if (!controller.level) return null;
  const ms = elapsedMs(controller);
  const grade = gradeStars(controller.state, controller.level.id, ms);
  return {
    mode: controller.mode,
    levelId: controller.level.id,
    status: controller.state.status,
    misses: controller.state.misses,
    maxCombo: controller.state.maxCombo,
    timeMs: ms,
    stars: grade.stars,
    flawless: grade.flawless,
  };
}

/** 闯关模式：根据已完成关卡推断当前解锁的最高关卡 */
export function unlockedLevelId(storage) {
  if (!storage?.levelStars) return LEVELS[0].id;
  for (const lv of LEVELS) {
    const r = storage.levelStars[lv.id];
    if (!r || r.stars === 0) return lv.id;
  }
  return LEVELS[LEVELS.length - 1].id;
}

/** 解锁状态：某关是否可玩 */
export function isLevelUnlocked(storage, levelId) {
  const idx = LEVELS.findIndex((lv) => lv.id === levelId);
  if (idx <= 0) return true;
  const prev = LEVELS[idx - 1];
  const r = storage?.levelStars?.[prev.id];
  return Boolean(r && r.stars > 0);
}

/** 简易字符串哈希 → 32 位种子（确定性） */
function hashSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export { STATUS, ACTION, MECH, hasUnmatched, foundTotems };