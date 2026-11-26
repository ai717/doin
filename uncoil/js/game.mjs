// 倒退贪吃蛇 Uncoil · 状态机控制器（DOM-free：接收 UI 意图，调度 engine，广播事件）
//
// 纯回合制：一次方向输入 = 蛇走一格，走完停住。没有实时 tick。
// 撤销栈保存的是完整引擎快照，因此撤销语义完全干净（无限次、可连撤）。

import {
  createState,
  step,
  legalDirs,
  activePellet,
  cloneState,
  STATUS
} from "./engine.mjs";
import {
  LEVELS,
  ENDGAME,
  levelById,
  levelsOfChapter,
  SOLUTION_DIRS,
  CHAPTERS
} from "./levels.mjs";
import { starsFor, shedProgress, pelletsLeft, isRecord } from "./score.mjs";

export const MODE = {
  STAGE: "stage",
  ENDGAME: "endgame",
  DAILY: "daily"
};

// 每日缠局：按日期在残局库里确定性取一关（同一天全世界同一题面）
export function dailyLevelId(dateKey) {
  const n = ENDGAME.length;
  if (!n) return null;
  const k = Math.abs(Math.floor(Number(dateKey) || 0)) % n;
  return ENDGAME[k].id;
}

export function dateKeyOf(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return Number(`${y}${m}${d}`);
}

export function stageLevelAt(index) {
  const list = [];
  for (const ch of CHAPTERS) list.push(...levelsOfChapter(ch));
  return list[Math.max(0, Math.min(list.length - 1, Math.floor(index)))] ?? null;
}

export function stageIndexById(id) {
  const list = [];
  for (const ch of CHAPTERS) list.push(...levelsOfChapter(ch));
  return list.findIndex((l) => l.id === id);
}

export class UncoilGame {
  constructor() {
    this.listeners = [];
    this.state = null;
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  emit(type, payload = {}) {
    const event = { type, ...payload };
    for (const fn of this.listeners) fn(event, this.state);
  }

  // ---------- 装载 ----------
  loadLevel(id, mode = MODE.STAGE) {
    const level = levelById(id);
    if (!level) return null;
    const engine = createState(level);
    this.state = {
      mode,
      levelId: id,
      level,
      index: mode === MODE.STAGE ? stageIndexById(id) : -1,
      initLen: level.snake.length,
      engine,
      history: [],
      steps: 0,
      undos: 0,
      status: engine.status
    };
    this.emit("loaded", { levelId: id, mode });
    if (engine.status === STATUS.ENTOMBED) {
      this.emit("entombed", { steps: 0 });
    }
    return this.state;
  }

  loadStageIndex(index) {
    const lv = stageLevelAt(index);
    return lv ? this.loadLevel(lv.id, MODE.STAGE) : null;
  }

  loadDaily(dateKey = dateKeyOf()) {
    const id = dailyLevelId(dateKey);
    if (!id) return null;
    const s = this.loadLevel(id, MODE.DAILY);
    if (s) s.dateKey = dateKey;
    return s;
  }

  restart() {
    const s = this.state;
    if (!s) return null;
    return this.loadLevel(s.levelId, s.mode);
  }

  // ---------- 操作 ----------
  legalDirs() {
    return this.state ? legalDirs(this.state.engine) : [];
  }

  activePellet() {
    return this.state ? activePellet(this.state.engine) : null;
  }

  canUndo() {
    return !!this.state && this.state.history.length > 0 && this.state.status !== STATUS.WON;
  }

  move(dir) {
    const s = this.state;
    if (!s) return null;
    const { action, state } = step(s.engine, dir);
    if (!action) {
      this.emit("blocked", { dir });
      return null;
    }
    s.history.push(cloneState(s.engine));
    s.engine = state;
    s.steps = state.steps;
    s.status = state.status;
    this.emit("move", { action, prev: s.history[s.history.length - 1] });
    if (action.ate) this.emit("eat", { action });
    if (state.status === STATUS.WON) {
      this.emit("win", {
        steps: state.steps,
        par: s.level.par,
        stars: starsFor(state.steps, s.level.par)
      });
    } else if (state.status === STATUS.ENTOMBED) {
      this.emit("entombed", { steps: state.steps });
    }
    return action;
  }

  undo() {
    const s = this.state;
    if (!this.canUndo()) return false;
    const prev = s.history.pop();
    s.engine = prev;
    s.steps = prev.steps;
    s.status = prev.status;
    s.undos += 1;
    this.emit("undo", { steps: s.steps });
    return true;
  }

  // ---------- 查询（供 UI 展示，禁止 UI 自算） ----------
  length() {
    return this.state ? this.state.engine.snake.length : 0;
  }

  progress() {
    const s = this.state;
    return s ? shedProgress(s.engine.snake.length, s.initLen) : 0;
  }

  pelletsLeft() {
    const s = this.state;
    if (!s) return 0;
    return pelletsLeft(s.engine.pelletIndex, s.engine.pellets.length);
  }

  stars() {
    const s = this.state;
    if (!s || s.status !== STATUS.WON) return 0;
    return starsFor(s.engine.steps, s.level.par);
  }

  isRecordAgainst(bestSteps) {
    const s = this.state;
    if (!s) return false;
    return isRecord(bestSteps, s.engine.steps);
  }

  // 内置参考解的下一步方向（用于「演示解法」；走到头返回 null）
  solveDir() {
    const s = this.state;
    if (!s || s.status !== STATUS.PLAYING) return null;
    const ch = s.level.solution[s.engine.steps];
    return ch ? SOLUTION_DIRS[ch] ?? null : null;
  }

  // 当前关在所在模式列表中的下一关 id（无则 null）
  nextLevelId() {
    const s = this.state;
    if (!s) return null;
    if (s.mode === MODE.STAGE) {
      const next = stageLevelAt(s.index + 1);
      return next && next.id !== s.levelId ? next.id : null;
    }
    if (s.mode === MODE.ENDGAME) {
      const i = ENDGAME.findIndex((l) => l.id === s.levelId);
      return i >= 0 && i + 1 < ENDGAME.length ? ENDGAME[i + 1].id : null;
    }
    return null;
  }
}

export { STATUS, LEVELS };
