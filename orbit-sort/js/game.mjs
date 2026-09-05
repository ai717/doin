import { applyIntent, legalActions, reset, undo } from "../engine.mjs?v=48f76844757c";
import { createLevelState } from "../levels.mjs?v=48f76844757c";

function reconcile(state) {
  if (state.status === "stuck" && legalActions({ ...state, status: "playing" }).length > 0) {
    return { ...state, status: "playing" };
  }
  return state;
}

export function createGame(level, restoredState = null) {
  const initialState = createLevelState(level);
  let state = reconcile(restoredState ?? initialState);

  return {
    get state() {
      return state;
    },
    get initialState() {
      return initialState;
    },
    dispatch(intent) {
      const result = applyIntent(state, intent);
      if (!result.valid) return { ...result, state };
      state = result.state;
      return { ...result, state };
    },
    undo() {
      state = undo(state);
      return state;
    },
    reset() {
      state = reset(state, initialState);
      return state;
    },
    setState(nextState) {
      state = reconcile(nextState);
      return state;
    },
    useHint() {
      state = reconcile({ ...state, hintsUsed: state.hintsUsed + 1 });
      return state;
    },
  };
}
