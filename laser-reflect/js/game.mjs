// game.mjs：DOM-free 状态机控制器，接收 UI 意图调度 engine。
// 维护当前关卡、元件朝向、步数，并提供 rotate / undo / reset / 胜负判定。

import { makeLevel, rotate, isSolved, starRating, verifySolvable } from "./engine.mjs";
import { LEVELS, getLevel } from "./levels.mjs";

export function createGameController({ onChange } = {}) {
  let levelIndex = 0; // 当前关卡下标（0-based）
  let cells = []; // 当前盘面元件数组（含朝向）
  let rows = 0;
  let cols = 0;
  let par = 0;
  let moves = 0; // 已转动次数
  let history = []; // 撤销栈：每次转动的 {r,c,before}
  let solved = false;

  function snapshot() {
    return {
      levelIndex,
      rows,
      cols,
      par,
      cells: cells.map((c) => ({ ...c })),
      moves,
      solved,
    };
  }

  function currentLevel() {
    return getLevel(levelIndex);
  }

  function buildCells(level) {
    return level.cells.map((c) => ({ ...c }));
  }

  function loadLevel(index) {
    const level = getLevel(index);
    if (!level) return;
    levelIndex = index;
    cells = buildCells(level);
    rows = level.rows;
    cols = level.cols;
    par = level.par;
    moves = 0;
    history = [];
    solved = false;
    emit();
  }

  function makeLevelObject() {
    return { rows, cols, par, cells: cells.map((c) => ({ ...c })) };
  }

  // 转动元件（r,c）：只允许可旋转元件；已通关则 no-op。
  function rotateAt(r, c) {
    if (solved) return false;
    const idx = cells.findIndex((cell) => cell.r === r && cell.c === c);
    if (idx < 0) return false;
    const before = { ...cells[idx] };
    const nextCells = rotate(makeLevelObject(), r, c);
    if (nextCells === cells) return false; // 不可旋转或无变化
    const beforeMirror = before.mirror ?? 0;
    cells = nextCells;
    moves += 1;
    history.push({ r, c, mirror: beforeMirror });
    // 检查是否解出
    const solvedNow = isSolved(makeLevelObject());
    if (solvedNow) solved = true;
    emit();
    return true;
  }

  // 撤销上一步（已通关则 no-op，通关瞬间不允许撤销，保持结算）
  function undo() {
    if (solved || history.length === 0) return false;
    const last = history.pop();
    const idx = cells.findIndex((cell) => cell.r === last.r && cell.c === last.c);
    if (idx >= 0) {
      cells = cells.map((c, i) => (i === idx ? { ...c, mirror: last.mirror } : c));
    }
    moves -= 1;
    emit();
    return true;
  }

  // 重置本关（步数清零、朝向回初始、撤销栈清空）
  function reset() {
    const level = currentLevel();
    cells = buildCells(level);
    moves = 0;
    history = [];
    solved = false;
    emit();
  }

  function emit() {
    if (onChange) onChange(snapshot());
  }

  return {
    view: snapshot,
    loadLevel,
    currentLevel,
    rotateAt,
    undo,
    reset,
    stars() {
      return starRating(moves, par);
    },
    isSolved: () => solved,
  };
}
