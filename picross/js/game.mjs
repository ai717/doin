/**
 * Picross Game Controller
 * Manages active level, timers, tool selection, undo history, and event dispatch.
 * 100% DOM-free.
 */

import {
  createGame,
  applyAction,
  CELL_EMPTY,
  CELL_PAINT,
  CELL_CROSS,
  calculateStars,
  isLineSatisfied,
} from "./engine.mjs";
import { LEVELS, getLevelById } from "./levels.mjs";
import {
  recordLevelCompletion,
  setCurrentLevelId,
  getCurrentLevelId,
  loadGameData,
} from "./storage.mjs";

export class GameController {
  constructor() {
    this.listeners = new Map();
    this.activeLevel = null;
    this.state = null;
    this.tool = "paint"; // 'paint' | 'cross'
    this.timerInterval = null;
    this.startTime = null;
    this.elapsedMs = 0;
    this.lastSatisfiedRows = new Set();
    this.lastSatisfiedCols = new Set();

    const savedData = loadGameData();
    const initialId = savedData.currentLevelId || "p1";
    this.loadLevel(initialId);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event).filter((cb) => cb !== callback);
    this.listeners.set(event, list);
  }

  emit(event, data) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => {
        try {
          cb(data);
        } catch {
          // Keep other listeners alive
        }
      });
    }
  }

  startTimer() {
    if (this.timerInterval) return;
    this.startTime = Date.now() - this.elapsedMs;
    this.timerInterval = setInterval(() => {
      if (this.state && this.state.status === "playing") {
        this.elapsedMs = Date.now() - this.startTime;
        this.emit("tick", { elapsedMs: this.elapsedMs });
      }
    }, 500);
    if (this.timerInterval && typeof this.timerInterval.unref === "function") {
      this.timerInterval.unref();
    }
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  loadLevel(levelOrId) {
    this.stopTimer();
    this.elapsedMs = 0;
    this.startTime = null;

    const level = typeof levelOrId === "string" ? getLevelById(levelOrId) : levelOrId;
    this.activeLevel = level;
    this.state = createGame(level);
    this.lastSatisfiedRows.clear();
    this.lastSatisfiedCols.clear();

    if (level.id && !level.isCustom) {
      setCurrentLevelId(level.id);
    }

    this.checkSatisfiedLines(false);
    this.emit("level_loaded", { level: this.activeLevel, state: this.state });
    this.emit("change", { state: this.state });
  }

  setTool(tool) {
    if (tool === "paint" || tool === "cross") {
      this.tool = tool;
      this.emit("tool_change", { tool: this.tool });
    }
  }

  toggleTool() {
    this.setTool(this.tool === "paint" ? "cross" : "paint");
  }

  cellClick(row, col, explicitVal = null) {
    if (!this.state || this.state.status === "won") return;

    if (!this.timerInterval) {
      this.startTimer();
    }

    const currentVal = this.state.grid[row][col];
    let nextVal = explicitVal;

    if (nextVal === null) {
      if (this.tool === "paint") {
        nextVal = currentVal === CELL_PAINT ? CELL_EMPTY : CELL_PAINT;
      } else {
        nextVal = currentVal === CELL_CROSS ? CELL_EMPTY : CELL_CROSS;
      }
    }

    const prevMistakes = this.state.mistakes;
    const nextState = applyAction(this.state, {
      type: "SET_CELL",
      row,
      col,
      val: nextVal,
    });

    if (nextState !== this.state) {
      const mistakeHappened = nextState.mistakes > prevMistakes;
      this.state = nextState;

      if (mistakeHappened) {
        this.emit("mistake", { row, col, mistakes: this.state.mistakes });
      }

      this.checkSatisfiedLines(true);
      this.emit("cell_changed", { row, col, val: nextVal, wasMistake: mistakeHappened });
      this.emit("change", { state: this.state });

      if (this.state.status === "won") {
        this.handleWin();
      }
    }
  }

  batchSet(changes) {
    if (!this.state || this.state.status === "won" || !changes.length) return;

    if (!this.timerInterval) {
      this.startTimer();
    }

    const prevMistakes = this.state.mistakes;
    const nextState = applyAction(this.state, {
      type: "BATCH_SET",
      changes,
    });

    if (nextState !== this.state) {
      const mistakeHappened = nextState.mistakes > prevMistakes;
      this.state = nextState;

      if (mistakeHappened) {
        this.emit("mistake", { mistakes: this.state.mistakes });
      }

      this.checkSatisfiedLines(true);
      this.emit("change", { state: this.state });

      if (this.state.status === "won") {
        this.handleWin();
      }
    }
  }

  undo() {
    if (!this.state || this.state.status === "won") return;
    const nextState = applyAction(this.state, { type: "UNDO" });
    if (nextState !== this.state) {
      this.state = nextState;
      this.checkSatisfiedLines(false);
      this.emit("change", { state: this.state });
      this.emit("undo", {});
    }
  }

  hint() {
    if (!this.state || this.state.status === "won") return;
    if (!this.timerInterval) {
      this.startTimer();
    }
    const nextState = applyAction(this.state, { type: "HINT" });
    if (nextState !== this.state) {
      this.state = nextState;
      this.checkSatisfiedLines(true);
      this.emit("change", { state: this.state });
      this.emit("hint_used", { hintsUsed: this.state.hintsUsed });
      if (this.state.status === "won") {
        this.handleWin();
      }
    }
  }

  restart() {
    if (!this.state) return;
    this.stopTimer();
    this.elapsedMs = 0;
    this.state = applyAction(this.state, { type: "RESTART" });
    this.lastSatisfiedRows.clear();
    this.lastSatisfiedCols.clear();
    this.emit("change", { state: this.state });
    this.emit("restart", {});
  }

  checkSatisfiedLines(notify = true) {
    if (!this.state) return;
    const rows = this.state.rows;
    const cols = this.state.cols;
    let newlySatisfied = false;

    // Check rows
    for (let r = 0; r < rows; r++) {
      const isSat = isLineSatisfied(this.state.grid[r], this.state.rowClues[r]);
      const wasSat = this.lastSatisfiedRows.has(r);
      if (isSat && !wasSat) {
        this.lastSatisfiedRows.add(r);
        newlySatisfied = true;
      } else if (!isSat && wasSat) {
        this.lastSatisfiedRows.delete(r);
      }
    }

    // Check cols
    for (let c = 0; c < cols; c++) {
      const colLine = [];
      for (let r = 0; r < rows; r++) colLine.push(this.state.grid[r][c]);
      const isSat = isLineSatisfied(colLine, this.state.colClues[c]);
      const wasSat = this.lastSatisfiedCols.has(c);
      if (isSat && !wasSat) {
        this.lastSatisfiedCols.add(c);
        newlySatisfied = true;
      } else if (!isSat && wasSat) {
        this.lastSatisfiedCols.delete(c);
      }
    }

    if (newlySatisfied && notify) {
      this.emit("line_satisfied", {
        satisfiedRows: new Set(this.lastSatisfiedRows),
        satisfiedCols: new Set(this.lastSatisfiedCols),
      });
    }
  }

  handleWin() {
    this.stopTimer();
    const stars = calculateStars(this.state.mistakes);
    const timeMs = this.elapsedMs;

    if (!this.activeLevel.isCustom) {
      recordLevelCompletion(this.activeLevel.id, stars, timeMs);
    }

    this.emit("win", {
      level: this.activeLevel,
      mistakes: this.state.mistakes,
      stars,
      timeMs,
    });
  }

  nextLevel() {
    if (!this.activeLevel) return;
    const currentIndex = LEVELS.findIndex((lvl) => lvl.id === this.activeLevel.id);
    if (currentIndex >= 0 && currentIndex < LEVELS.length - 1) {
      this.loadLevel(LEVELS[currentIndex + 1].id);
    }
  }

  prevLevel() {
    if (!this.activeLevel) return;
    const currentIndex = LEVELS.findIndex((lvl) => lvl.id === this.activeLevel.id);
    if (currentIndex > 0) {
      this.loadLevel(LEVELS[currentIndex - 1].id);
    }
  }
}
