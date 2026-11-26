// DOM-free 控制器：管理双语会话、关卡切换与计时，不直接触碰 DOM 或存储。
import { BOARDS, LEVELS_PER_BOARD, HINTS_PER_LEVEL } from "./boards.mjs";
import { getPuzzle } from "./puzzles.mjs";
import {
  createSession,
  selectCell,
  selectEntry,
  fillCell,
  eraseCell,
  useHint,
  tick,
  drainEvents,
  summarize,
  STATUS,
} from "./engine.mjs";

const DEFAULT_CURSOR = { boardId: BOARDS[0].id, levelIndex: 0 };

function safeCursor(cursor) {
  const boardId = BOARDS.some((board) => board.id === cursor?.boardId) ? cursor.boardId : DEFAULT_CURSOR.boardId;
  const raw = Number(cursor?.levelIndex);
  const levelIndex = Number.isFinite(raw) ? Math.max(0, Math.min(LEVELS_PER_BOARD - 1, Math.round(raw))) : 0;
  return { boardId, levelIndex };
}

export function createGame({ locale = "zh", current = {}, hints = HINTS_PER_LEVEL } = {}) {
  let lang = locale === "en" ? "en" : "zh";
  const cursors = {
    zh: safeCursor(current.zh ?? DEFAULT_CURSOR),
    en: safeCursor(current.en ?? DEFAULT_CURSOR),
  };
  const sessions = { zh: null, en: null };
  let menuOpen = false;

  function loadSession(target) {
    const cursor = cursors[target];
    const puzzle = getPuzzle(target, cursor.boardId, cursor.levelIndex) ?? getPuzzle(target, DEFAULT_CURSOR.boardId, 0);
    sessions[target] = createSession({ puzzle, hintsLeft: hints });
    return sessions[target];
  }

  function ensure() {
    if (!sessions[lang]) loadSession(lang);
    return sessions[lang];
  }

  function snapshot() {
    return {
      lang,
      status: ensure().status,
      boardId: cursors[lang].boardId,
      levelIndex: cursors[lang].levelIndex,
      menuOpen,
    };
  }

  function startLevel(boardId, levelIndex) {
    cursors[lang] = safeCursor({ boardId, levelIndex });
    loadSession(lang);
    return ensure();
  }

  function setLocale(next) {
    const target = next === "en" ? "en" : "zh";
    if (target === lang) return ensure();
    lang = target;
    return ensure();
  }

  function dispatch(intent) {
    const state = ensure();
    if (!intent || typeof intent.type !== "string") return { action: null, events: [] };
    let result = { action: null, events: [] };
    switch (intent.type) {
      case "cell":
        result = selectCell(state, intent.r, intent.c);
        break;
      case "entry":
        result = selectEntry(state, intent.index);
        break;
      case "fill":
        result = fillCell(state, intent.char);
        break;
      case "erase":
        result = eraseCell(state);
        break;
      case "hint":
        result = useHint(state);
        break;
      case "level":
        startLevel(intent.boardId, intent.levelIndex);
        result = { action: "level", events: [] };
        break;
      case "next": {
        const cursor = cursors[lang];
        if (cursor.levelIndex < LEVELS_PER_BOARD - 1) {
          startLevel(cursor.boardId, cursor.levelIndex + 1);
          result = { action: "level", events: [] };
        } else {
          const boardIndex = BOARDS.findIndex((board) => board.id === cursor.boardId);
          const nextBoard = BOARDS[(boardIndex + 1) % BOARDS.length].id;
          startLevel(nextBoard, 0);
          result = { action: "level", events: [] };
        }
        break;
      }
      case "retry":
        startLevel(cursors[lang].boardId, cursors[lang].levelIndex);
        result = { action: "level", events: [] };
        break;
      default:
        break;
    }
    const events = drainEvents(state);
    return { action: result.action, events };
  }

  function setMenuOpen(open) {
    menuOpen = Boolean(open);
  }

  function isMenuOpen() {
    return menuOpen;
  }

  function tickMs(dtMs) {
    if (menuOpen) return;
    tick(ensure(), dtMs);
  }

  function summary() {
    return summarize(ensure());
  }

  function clearedEntryIds() {
    const state = ensure();
    if (state.status !== STATUS.CLEARED) return [];
    return state.entries.map((entry) => entry.entryId);
  }

  function cursor() {
    return { ...cursors[lang] };
  }

  ensure();

  return {
    get lang() {
      return lang;
    },
    state: ensure,
    puzzle: () => ensure().puzzle,
    cursor,
    setLocale,
    startLevel,
    dispatch,
    setMenuOpen,
    isMenuOpen,
    tick: tickMs,
    summary,
    clearedEntryIds,
    snapshot,
  };
}
