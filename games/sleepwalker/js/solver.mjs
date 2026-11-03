/**
 * @file games/sleepwalker/js/solver.mjs
 * 纯数学求解与时序验证器，验证所有关卡在给定操作时序下的可解性与稳定性。
 */

import { createInitialState, clickGadget, stepFrame, DT } from './engine.mjs';

/**
 * 运行给定操作序列并验证通关
 * @param {object} levelData
 * @param {Array<{ time: number, gadgetId: string }>} actionSequence
 * @param {number} maxSimTime 最长模拟时间 (秒)
 */
export function simulateSolution(levelData, actionSequence = [], maxSimTime = 25) {
  const state = createInitialState(levelData);
  let actionIdx = 0;
  const actions = [...actionSequence].sort((a, b) => a.time - b.time);

  const totalSteps = Math.ceil(maxSimTime / DT);

  for (let step = 0; step < totalSteps; step++) {
    // 检查是否有待触发操作
    while (actionIdx < actions.length && state.time >= actions[actionIdx].time) {
      clickGadget(state, actions[actionIdx].gadgetId);
      actionIdx++;
    }

    stepFrame(state, DT);

    if (state.status === 'won') {
      const collectedBubbles = state.bubbles.filter((b) => b.collected).length;
      return {
        success: true,
        time: state.time,
        status: state.status,
        bubbles: collectedBubbles,
        scares: state.scareCount,
        clicks: state.clicksCount,
      };
    }

    if (state.status === 'lost') {
      return {
        success: false,
        time: state.time,
        status: state.status,
        reason: state.events.find((e) => e.type === 'scare')?.reason || 'lost',
        bubbles: state.bubbles.filter((b) => b.collected).length,
        scares: state.scareCount,
      };
    }
  }

  return {
    success: false,
    time: state.time,
    status: 'timeout',
    bubbles: state.bubbles.filter((b) => b.collected).length,
    scares: state.scareCount,
  };
}

/**
 * 验证关卡黄金序列
 * @param {object} levelData
 */
export function verifyGoldenSolution(levelData) {
  const golden = levelData.goldenSolution || [];
  return simulateSolution(levelData, golden, (levelData.parTime || 15) + 5);
}
