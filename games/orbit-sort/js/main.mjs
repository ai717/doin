import { canExtract } from "../engine.mjs?v=dev";
import { createAudio } from "./audio.mjs?v=dev";
import { createDailyLevel, todayKey } from "./daily.mjs?v=dev";
import { LEVELS, levelById } from "../levels.mjs?v=dev";
import { createGame } from "./game.mjs?v=dev";
import { createBoardRenderer } from "./renderer.mjs?v=dev";
import { isValidStoredState, loadProgress, recordCompletion, recordDailyCompletion, saveCurrentGame, saveSoundPreference } from "./storage.mjs?v=dev";

export function bootstrap() {
let level = null;
let initialState = null;
let state = null;
let game = null;
let progress = loadProgress();
let resultShown = false;
let hint = null;
let hintRequestId = 0;
let advisoryRequestId = 0;
let latestCompletedLevel = null;
let lastDialogTrigger = null;
const hintWorker = new Worker("./solver-worker.mjs?v=dev", { type: "module" });

const board = document.querySelector("#game-board");
const moveLabel = document.querySelector("#move-label");
const parLabel = document.querySelector("#par-label");
const constellationLabel = document.querySelector("#constellation-label");
const statusMessage = document.querySelector("#status-message");
const undoButton = document.querySelector("#undo-button");
const resetButton = document.querySelector("#reset-button");
const hintButton = document.querySelector("#hint-button");
const soundButton = document.querySelector("#sound-button");
const selectScreen = document.querySelector("#select-screen");
const playScreen = document.querySelector(".game-shell");
const levelGrid = document.querySelector("#level-grid");
const resultLayer = document.querySelector("#result-layer");
const resetLayer = document.querySelector("#reset-layer");
const resultScore = document.querySelector("#result-score");
const nextButton = document.querySelector("#next-button");
const againButton = document.querySelector("#again-button");
const continueButton = document.querySelector("#continue-button");
const dailyButton = document.querySelector("#daily-button");
const continueDailyButton = document.querySelector("#continue-daily-button");
const resetConfirmButton = document.querySelector("#reset-confirm-button");
const resetCancelButton = document.querySelector("#reset-cancel-button");
const audio = createAudio({ soundOn: progress.settings.soundOn });
const CHAPTERS = [
  { id: 1, title: "初启航路", description: "掌握星核与中转槽 · 六关稳定版" },
];

function renderSoundButton(soundOn = audio.isOn()) {
  soundButton.setAttribute("aria-pressed", String(soundOn));
  soundButton.setAttribute("aria-label", soundOn ? "关闭声音" : "开启声音");
  soundButton.title = soundOn ? "关闭声音" : "开启声音";
  soundButton.textContent = soundOn ? "♫" : "×";
}

function message(text) {
  statusMessage.textContent = text;
}

function openDialog(layer, trigger, focusTarget) {
  lastDialogTrigger = trigger;
  layer.hidden = false;
  requestAnimationFrame(() => focusTarget.focus());
}

function closeDialog(layer) {
  layer.hidden = true;
  lastDialogTrigger?.focus();
}

function render() {
  renderer.render(state);
  moveLabel.textContent = `调度 ${state.moves}`;
  parLabel.textContent = `目标 ${level.par}`;
  constellationLabel.textContent = `已充能 ${state.tracks.filter((track) => track.completed).length} / ${state.tracks.length - 1}`;
  undoButton.disabled = state.history.length === 0;
  resetButton.disabled = state.moves === 0;
  if (state.status === "won") message("星轨已稳定");
  if (state.status === "stuck") message("当前无后续调度；刚才的移动符合规则，可撤销重规划");
  if (state.status === "playing") message(state.selectedDockId === null ? "选择轨道入口，将星体调入星核" : "选择高亮轨道，落下星体");
}

function clearHint() {
  hint = null;
  hintRequestId += 1;
  advisoryRequestId += 1;
  hintButton.disabled = false;
  renderer.clearHint();
}

function requestSolvabilityCheck(nextState) {
  if (!nextState || nextState.status !== "playing") return;
  const requestId = ++advisoryRequestId;
  hintWorker.postMessage({ kind: "solvability", requestId, state: nextState });
}

function renderSelect() {
  continueButton.hidden = !isValidSavedGame(progress.currentGame);
  continueDailyButton.hidden = !isValidDailyGame(progress.daily, createDailyLevel(todayKey()));
  levelGrid.replaceChildren(...CHAPTERS.map((chapter) => {
    const levels = LEVELS.filter((item) => item.chapter === chapter.id);
    const completed = levels.filter((item) => progress.bestByLevel[item.id]);
    const section = document.createElement("section");
    section.className = "chapter-map";
    section.setAttribute("aria-labelledby", `chapter-title-${chapter.id}`);
    const heading = document.createElement("h2");
    heading.id = `chapter-title-${chapter.id}`;
    heading.textContent = `第 ${chapter.id} 章 ${chapter.title}`;
    const summary = document.createElement("p");
    summary.textContent = `${chapter.description} · 已稳定 ${completed.length} / ${levels.length}`;
    const path = document.createElement("div");
    path.className = "chapter-path";
    path.setAttribute("aria-label", `第 ${chapter.id} 章关卡`);
    levels.forEach((item, index) => {
    const button = document.createElement("button");
    const best = progress.bestByLevel[item.id];
    button.className = "level-node";
    button.type = "button";
    button.disabled = item.id > progress.unlockedLevel;
    button.dataset.rowStart = String(index % 5 === 0);
    button.dataset.completed = String(Boolean(best));
    button.dataset.current = String(item.id === progress.unlockedLevel && !best);
    if (item.id === latestCompletedLevel) button.classList.add("is-new");
    button.setAttribute("aria-label", `第 ${item.id} 关，${best ? `${best.stars} 星` : button.disabled ? "未解锁" : "可开始"}`);
    const number = document.createElement("span");
    number.textContent = String(item.id);
    button.append(number);
    if (best) {
      const stars = document.createElement("small");
      stars.textContent = "★".repeat(best.stars);
      stars.setAttribute("aria-hidden", "true");
      button.append(stars);
    }
    button.addEventListener("click", () => startLevel(item.id));
    path.append(button);
    });
    section.append(heading, summary, path);
    return section;
  }));
  latestCompletedLevel = null;
}

function isValidSavedGame(saved) {
  const savedLevel = saved && levelById(saved.levelId);
  const game = saved?.state;
  return Boolean(savedLevel && isValidStoredState(game, savedLevel));
}

function isValidDailyGame(saved, dailyLevel) {
  const game = saved?.currentGame;
  return Boolean(saved?.dateKey === dailyLevel.dateKey && game?.levelId === "daily" && game.dateKey === dailyLevel.dateKey && isValidStoredState(game, dailyLevel));
}

function startLevel(levelId, restoredState = null) {
  startGame(levelById(levelId), restoredState);
}

function startDaily(restoredState = null) {
  startGame(createDailyLevel(todayKey()), restoredState);
}

function startGame(nextLevel, restoredState = null) {
  clearHint();
  level = nextLevel;
  game = createGame(level, restoredState);
  initialState = game.initialState;
  state = game.state;
  resultShown = false;
  resultLayer.hidden = true;
  resetLayer.hidden = true;
  selectScreen.hidden = true;
  playScreen.classList.add("is-active");
  document.querySelector("#level-label").textContent = level.id === "daily" ? "今日星轨" : `第 ${level.id} 关`;
  render();
  message("选择轨道入口，将星体调入星核");
  if (!restoredState && level.id === 1) {
    const firstTrack = state.tracks.find((track) => canExtract(state, track.id));
    renderer.showGuide(firstTrack?.id);
  }
}

function showResult() {
  if (resultShown) return;
  resultShown = true;
  const completion = level.id === "daily"
    ? recordDailyCompletion(progress, level.dateKey, state.moves)
    : recordCompletion(progress, level, state.moves);
  progress = completion.progress;
  latestCompletedLevel = level.id === "daily" ? null : level.id;
  resultScore.textContent = level.id === "daily"
    ? `今日星轨已稳定 · 调度 ${state.moves} / ${level.par}`
    : `${"★".repeat(completion.stars)}  调度 ${state.moves} / ${level.par}${completion.isNewBest ? " · 新纪录" : ""}`;
  nextButton.hidden = level.id === "daily" || level.id >= LEVELS.at(-1).id;
  openDialog(resultLayer, againButton, nextButton.hidden ? againButton : nextButton);
}

function transition(next, sound, transfer) {
  const completedTrackIds = next.tracks
    .filter((track, index) => track.completed && !state.tracks[index].completed)
    .map((track) => track.id);
  const thawedTrackIds = next.tracks
    .filter((track, index) => state.tracks[index].mode === "frozen" && track.mode === "normal")
    .map((track) => track.id);
  state = next;
  clearHint();
  renderer.clearGuide();
  render();
  if (transfer) renderer.showTransfer(transfer);
  for (const trackId of completedTrackIds) renderer.showCompletion(trackId);
  for (const trackId of thawedTrackIds) renderer.showUnfreeze(trackId);
  if (sound) audio.play(completedTrackIds.length > 0 ? "complete" : sound);
  if (thawedTrackIds.length > 0) audio.play("unfreeze");
  if (next.status === "won") showResult();
  // Deadlock is a post-move state, not an illegal action. Keep the board and
  // controls available so the player can inspect, undo, or reset without a modal
  // overlay masking the authoritative rule result.
  if (next.status === "stuck") {
    message("当前无后续调度；刚才的移动符合规则，可撤销或重置");
  }
  if (next.status === "playing") progress = saveCurrentGame(progress, state);
  requestSolvabilityCheck(next);
}

hintWorker.addEventListener("message", ({ data }) => {
  if (data.kind === "solvability") {
    if (data.requestId !== advisoryRequestId) return;
    if (data.status === "exhausted") {
      message("当前局面无法通关，建议撤销最近一步重新规划");
    }
    return;
  }
  if (data.requestId !== hintRequestId) return;
  hintButton.disabled = false;
  const action = data.actions?.[0];
  if (data.status !== "solved" || !action) return message("先撤销最近一步试试");
  if (action.type === "insert") {
    renderer.highlightTrack(action.trackId);
    state = game.useHint();
    progress = saveCurrentGame(progress, state);
    return message("已标出推荐目标轨道");
  }
  const target = data.actions[1];
  hint = { targetTrackId: target?.type === "insert" ? target.trackId : null, expiresAt: performance.now() + 3_000 };
  renderer.highlightTrack(action.trackId);
  message("已标出推荐调入轨道");
});

hintWorker.addEventListener("error", () => {
  hintButton.disabled = false;
  message("提示暂时不可用，请先自行尝试");
});

function requestHint() {
  if (!state || state.status !== "playing") return;
  if (hint && hint.targetTrackId !== null && performance.now() < hint.expiresAt) {
    renderer.highlightTrack(hint.targetTrackId);
    state = game.useHint();
    progress = saveCurrentGame(progress, state);
    hint = null;
    return message("已标出推荐目标轨道");
  }
  clearHint();
  hintButton.disabled = true;
  hintRequestId += 1;
  hintWorker.postMessage({ requestId: hintRequestId, state });
  message("正在推演可行调度");
}

function chooseTrack(trackId) {
  audio.activate();
  const result = game.dispatch({ target: "track", id: trackId });
  if (!result.valid) {
    renderer.flashTrack(trackId);
    audio.play("invalid");
    message(result.message);
    return;
  }
  const next = result.state;
  const wasExtracting = state.selectedDockId === null;
  const dockId = wasExtracting ? next.selectedDockId : state.selectedDockId;
  transition(
    next,
    wasExtracting ? "extract" : "insert",
    wasExtracting ? { fromTrackId: trackId, toDockId: dockId } : { fromDockId: dockId, toTrackId: trackId },
  );
}

function chooseDock(dockId) {
  audio.activate();
  const result = game.dispatch({ target: "dock", id: dockId });
  if (result.action.type === "clear-selection" && result.valid) {
    state = game.state;
    render();
    message("已切换为取出模式，可继续调入另一颗星体");
    return;
  }
  if (!result.valid) {
    renderer.flashDock(dockId);
    audio.play("invalid");
    message(result.message);
    return;
  }
  transition(result.state);
}

const renderer = createBoardRenderer(board, { onTrack: chooseTrack, onDock: chooseDock });
renderSoundButton();

undoButton.addEventListener("click", () => {
  audio.activate();
  const previous = state;
  const next = game.undo();
  if (next !== previous) {
    clearHint();
    renderer.clearGuide();
    state = next;
    render();
    progress = saveCurrentGame(progress, state);
    message("已撤销一次调度");
  }
});

resetButton.addEventListener("click", () => {
  audio.activate();
  openDialog(resetLayer, resetButton, resetCancelButton);
});

function confirmReset() {
  clearHint();
  renderer.clearGuide();
  state = game.reset();
  render();
  progress = saveCurrentGame(progress, state);
  resetLayer.hidden = true;
  if (level.id === 1) {
    const firstTrack = state.tracks.find((track) => canExtract(state, track.id));
    renderer.showGuide(firstTrack?.id);
  }
  message("已重置本关");
}

resetConfirmButton.addEventListener("click", confirmReset);
resetCancelButton.addEventListener("click", () => closeDialog(resetLayer));
hintButton.addEventListener("click", requestHint);

soundButton.addEventListener("click", () => {
  audio.activate();
  const soundOn = audio.toggle();
  progress = saveSoundPreference(progress, soundOn);
  renderSoundButton(soundOn);
  if (soundOn) audio.play("insert");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!resetLayer.hidden) return closeDialog(resetLayer);
    if (!resultLayer.hidden) {
      resultLayer.hidden = true;
      playScreen.classList.remove("is-active");
      selectScreen.hidden = false;
      renderSelect();
      return dailyButton.focus();
    }
  }
  if (!state || !playScreen.classList.contains("is-active")) return;
  if (event.defaultPrevented || event.altKey || event.metaKey) return;
  if (event.key >= "1" && event.key <= "8") {
    const track = state.tracks[Number(event.key) - 1];
    if (track) chooseTrack(track.id);
  } else if (event.key === "[") {
    const occupied = state.docks.filter((dock) => dock.orb);
    if (occupied.length > 0) chooseDock(occupied.at(-1).id);
  } else if (event.key === "]") {
    const occupied = state.docks.filter((dock) => dock.orb);
    if (occupied.length > 0) chooseDock(occupied[0].id);
  } else if (event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoButton.click();
  } else if (event.key.toLowerCase() === "r") {
    resetButton.click();
  } else if (event.key.toLowerCase() === "h") {
    hintButton.click();
  }
});

document.querySelector("#play-back-button").addEventListener("click", (event) => {
  event.preventDefault();
  playScreen.classList.remove("is-active");
  selectScreen.hidden = false;
  renderSelect();
});
nextButton.addEventListener("click", () => startLevel(level.id + 1));
againButton.addEventListener("click", () => level.id === "daily" ? startDaily() : startLevel(level.id));
continueButton.addEventListener("click", () => startLevel(progress.currentGame.levelId, progress.currentGame.state));
dailyButton.addEventListener("click", () => startDaily());
continueDailyButton.addEventListener("click", () => startDaily(progress.daily.currentGame));
renderSelect();
if (isValidSavedGame(progress.currentGame)) startLevel(progress.currentGame.levelId, progress.currentGame.state);
}
