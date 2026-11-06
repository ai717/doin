// engine.mjs — 24 点核心规则引擎（DOM-free · 纯函数）
// 唯一权威：卡牌值、当前手牌、合并操作、胜负判定、求解器
// 严禁碰 DOM / localStorage / window

import { LEVELS } from './levels.mjs';
import { CLASSIC_HARDS } from './classics.mjs';

// ========== 常量 ==========
export const OPERATORS = ['+', '-', '*', '/'];
export const TARGET = 24;
export const EPSILON = 1e-6;

// ========== 牌面工具 ==========
export function cardLabel(value) { return String(value); }

export function formatResult(n) {
  if (Math.abs(n - Math.round(n)) < EPSILON) return String(Math.round(n));
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, '');
}

// ========== 状态创建 ==========
export function createState({ cards, mode = 'chapter' }) {
  const initial = cards.map((value, i) => ({
    id: `c0-${i}`,
    value,
    label: cardLabel(value),
    isResult: false,
  }));
  return {
    mode,
    cards: initial,
    selectedIds: [],
    history: [],
    steps: 0,
    status: 'playing',
    hintsUsed: 0,
  };
}

export function createFromLevel(chapterIdx, levelIdx) {
  const lv = LEVELS.chapters[chapterIdx].levels[levelIdx];
  return createState({ cards: lv.cards, mode: 'chapter' });
}

export function createFromClassic(classicIdx) {
  return createState({ cards: CLASSIC_HARDS[classicIdx], mode: 'classic' });
}

// ========== 选中 ==========
export function toggleSelect(state, cardId) {
  if (state.status !== 'playing') return state;
  const idx = state.selectedIds.indexOf(cardId);
  let newSel;
  if (idx >= 0) {
    newSel = state.selectedIds.filter(id => id !== cardId);
  } else {
    if (state.selectedIds.length >= 2) newSel = [state.selectedIds[1], cardId];
    else newSel = [...state.selectedIds, cardId];
  }
  return { ...state, selectedIds: newSel };
}

export function clearSelect(state) {
  return { ...state, selectedIds: [] };
}

// ========== 核心：合并 ==========
export function applyOperator(state, op) {
  if (state.status !== 'playing') return { state, action: 'invalid' };
  if (state.selectedIds.length !== 2) return { state, action: 'invalid' };

  const [idA, idB] = state.selectedIds;
  const cardA = state.cards.find(c => c.id === idA);
  const cardB = state.cards.find(c => c.id === idB);
  if (!cardA || !cardB) return { state, action: 'invalid' };

  let result;
  switch (op) {
    case '+': result = cardA.value + cardB.value; break;
    case '-': result = cardA.value - cardB.value; break;
    case '*': result = cardA.value * cardB.value; break;
    case '/':
      if (Math.abs(cardB.value) < EPSILON) return { state, action: 'invalid' };
      result = cardA.value / cardB.value; break;
    default: return { state, action: 'invalid' };
  }
  if (!isFinite(result)) return { state, action: 'invalid' };

  const newId = `r${state.steps + 1}-${Date.now().toString(36)}`;
  const newCard = {
    id: newId,
    value: result,
    label: formatResult(result),
    isResult: true,
    expr: `${cardA.label} ${op} ${cardB.label}`,
  };

  // history entry 存 resultCard 以便 undo 精确还原
  const historyEntry = {
    removedCards: [cardA, cardB],
    removedIds: [idA, idB],
    resultCard: newCard,
    op,
  };

  const remaining = state.cards.filter(c => c.id !== idA && c.id !== idB);
  const newCards = [...remaining, newCard];

  const newState = {
    ...state,
    cards: newCards,
    selectedIds: [],
    history: [...state.history, historyEntry],
    steps: state.steps + 1,
  };

  if (newCards.length === 1) {
    if (Math.abs(newCards[0].value - TARGET) < EPSILON) {
      return { state: { ...newState, status: 'won' }, action: 'won', result };
    } else {
      return { state: { ...newState, status: 'lost' }, action: 'lost', result };
    }
  }
  return { state: newState, action: 'ok', result };
}

// ========== 撤销 ==========
export function undo(state) {
  if (state.history.length === 0) return { state, undone: false };
  const last = state.history[state.history.length - 1];
  // 移除 resultCard，恢复原始两张
  const cards = state.cards
    .filter(c => c.id !== last.resultCard.id)
    .concat(last.removedCards);
  return {
    state: {
      ...state,
      cards,
      selectedIds: [],
      history: state.history.slice(0, -1),
      steps: state.steps - 1,
      status: 'playing',
    },
    undone: true,
  };
}

// ========== 求解器 ==========
export function solve(nums) {
  const ops = ['+', '-', '*', '/'];
  function dfs(values, exprs) {
    if (values.length === 1) {
      if (Math.abs(values[0] - TARGET) < EPSILON) return exprs[0];
      return null;
    }
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < values.length; j++) {
        if (i === j) continue;
        const restV = [], restE = [];
        for (let k = 0; k < values.length; k++) {
          if (k !== i && k !== j) { restV.push(values[k]); restE.push(exprs[k]); }
        }
        for (const op of ops) {
          let r;
          switch (op) {
            case '+': r = values[i] + values[j]; break;
            case '-': r = values[i] - values[j]; break;
            case '*': r = values[i] * values[j]; break;
            case '/':
              if (Math.abs(values[j]) < EPSILON) continue;
              r = values[i] / values[j]; break;
          }
          if (!isFinite(r)) continue;
          const sub = dfs([...restV, r], [...restE, `(${exprs[i]}${op}${exprs[j]})`]);
          if (sub) return sub;
        }
      }
    }
    return null;
  }
  return dfs(nums, nums.map(n => String(n)));
}

// ========== Hint ==========
export function generateHint(nums) {
  const ops = ['+', '-', '*', '/'];
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      for (const op of ops) {
        let r;
        switch (op) {
          case '+': r = nums[i] + nums[j]; break;
          case '-': r = nums[i] - nums[j]; break;
          case '*': r = nums[i] * nums[j]; break;
          case '/':
            if (Math.abs(nums[j]) < EPSILON) continue;
            r = nums[i] / nums[j]; break;
        }
        if (!isFinite(r)) continue;
        if (solve([...rest, r])) return { cardA: nums[i], cardB: nums[j], op };
      }
    }
  }
  return null;
}

// ========== 星级 ==========
export function calcStars({ steps, hintsUsed }) {
  let stars = 3;
  if (hintsUsed > 0) stars -= 1;
  if (steps > 5) stars -= 1;
  if (steps > 7) stars -= 1;
  return Math.max(0, stars);
}

// ========== 元数据 ==========
export function getTotalChapters() { return LEVELS.chapters.length; }
export function getLevelsPerChapter() { return LEVELS.chapters[0].levels.length; }
export function getClassicCount() { return CLASSIC_HARDS.length; }
export function minStepsFor() { return 3; }

// ========== 无限随机模式生成器 ==========
// 一直抽 4 张牌（默认 1-13）直到 solve() 找到解法，失败超过上限则重试保底
// 4 张 1-13 可解率约 74.8%，500 次重试 ≈ 1 - 0.252^500 ≈ 100% 不会失败
export function generateSolvable(maxAttempts = 1000, min = 1, max = 9) {
  for (let i = 0; i < maxAttempts; i++) {
    const nums = Array.from({ length: 4 }, () => min + Math.floor(Math.random() * (max - min + 1)));
    if (solve(nums)) return nums;
  }
  // 极端情况下（理论上不可能）硬编码保底
  return [3, 3, 8, 8];
}

export function createFromRandom() {
  const nums = generateSolvable();
  return createState({ cards: nums, mode: 'infinite' });
}
