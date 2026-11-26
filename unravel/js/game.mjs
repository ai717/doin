// unravel game — DOM-free state controller. Schedules engine intents, keeps the
// undo snapshot stack, and owns the elapsed timer (frozen on demand).

import { createGame, generateBoard, hint as engineHint, tryCollect, tryUntie } from "./engine.mjs";
import { getLevel, levelSeed, RELAX_PARAMS } from "./levels.mjs";

const UNDO_LIMIT = 200;

export function createController() {
  const ctrl = {
    board: null,
    state: null,
    levelId: 1,
    relaxSeed: 0,
    undoStack: [],
    undoCount: 0,
    timer: { running: false, accumulated: 0, startedAt: 0 },
  };

  function pushUndo() {
    ctrl.undoStack.push(JSON.stringify(ctrl.state));
    if (ctrl.undoStack.length > UNDO_LIMIT) ctrl.undoStack.shift();
  }

  function resetTimer() {
    ctrl.timer = { running: true, accumulated: 0, startedAt: Date.now() };
  }

  return {
    ctrl,
    loadLevel(id) {
      const level = getLevel(id);
      ctrl.board = generateBoard(level, levelSeed(level.id), "level");
      ctrl.state = createGame(ctrl.board);
      ctrl.levelId = level.id;
      ctrl.undoStack = [];
      ctrl.undoCount = 0;
      resetTimer();
    },
    startRelax(seed) {
      ctrl.relaxSeed = seed >>> 0;
      ctrl.board = generateBoard(RELAX_PARAMS, ctrl.relaxSeed, "relax");
      ctrl.state = createGame(ctrl.board);
      ctrl.undoStack = [];
      ctrl.undoCount = 0;
      resetTimer();
    },
    restart() {
      if (ctrl.state && ctrl.state.mode === "relax") {
        this.startRelax((ctrl.relaxSeed ^ (Date.now() & 0xffff)) >>> 0);
      } else {
        this.loadLevel(ctrl.levelId);
      }
    },
    collect(id) {
      if (!ctrl.state || ctrl.state.status !== "playing") return null;
      const res = tryCollect(ctrl.board, ctrl.state, id);
      if (!res.event) return null;
      pushUndo();
      ctrl.state = res.state;
      return res.event;
    },
    untie(id) {
      if (!ctrl.state || ctrl.state.status !== "playing") return null;
      const res = tryUntie(ctrl.board, ctrl.state, id);
      if (!res.event) return null;
      pushUndo();
      ctrl.state = res.state;
      return res.event;
    },
    undo() {
      if (!ctrl.undoStack.length) return null;
      ctrl.state = JSON.parse(ctrl.undoStack.pop());
      ctrl.undoCount += 1;
      return { type: "undo" };
    },
    canUndo() {
      return ctrl.undoStack.length > 0;
    },
    hint() {
      return engineHint(ctrl.board, ctrl.state);
    },
    getElapsedMs() {
      const t = ctrl.timer;
      return t.accumulated + (t.running ? Date.now() - t.startedAt : 0);
    },
    pauseTimer() {
      const t = ctrl.timer;
      if (t.running) {
        t.accumulated += Date.now() - t.startedAt;
        t.running = false;
      }
    },
    resumeTimer() {
      const t = ctrl.timer;
      if (!t.running && ctrl.state && ctrl.state.status === "playing") {
        t.startedAt = Date.now();
        t.running = true;
      }
    },
  };
}
