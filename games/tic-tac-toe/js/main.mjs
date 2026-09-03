// 装配层：把存档、音效、控制器和 DOM 接到一起。
// 规则一律不在这里判断 —— 这里只做"读取偏好 -> 驱动控制器 -> 落库"。

import { PLAYER_O, STATUS_PLAYING, replay } from "./engine.mjs";
import { chooseMove } from "./ai.mjs";
import { createAudio } from "./audio.mjs";
import { createGameController } from "./game.mjs";
import { MODES, applyOutcome, load, save } from "./storage.mjs";
import { OUTCOME_DRAW, OUTCOME_WIN, breakdown } from "./score.mjs";
import { mountUI } from "./ui.mjs";

const byId = (id) => document.getElementById(id);

const refs = {
  board: byId("board"),
  winLine: byId("win-line"),
  status: byId("status"),
  scoreLine: byId("score-line"),
  hudLeft: byId("hud-left"),
  hudDraw: byId("hud-draw"),
  hudRight: byId("hud-right"),
  hudStreak: byId("hud-streak"),
  hudBest: byId("hud-best"),
  hudLeftTag: byId("hud-left-tag"),
  hudRightTag: byId("hud-right-tag"),
  modeGroup: byId("mode-group"),
  sizeGroup: byId("size-group"),
  difficultyGroup: byId("difficulty-group"),
  difficultyWrap: byId("difficulty-group-wrap"),
  undoButton: byId("undo"),
  restartButton: byId("restart"),
  soundButton: byId("sound"),
  themeButton: byId("theme"),
};

const resultRefs = {
  layer: byId("result-layer"),
  badge: byId("result-badge"),
  title: byId("result-title"),
  sub: byId("result-sub"),
  breakdown: byId("result-breakdown"),
  again: byId("result-again"),
  close: byId("result-close"),
};

const data = load();
const audio = createAudio({ muted: data.prefs.muted });
let settledState = null;

function applyTheme() {
  document.documentElement.dataset.theme = data.prefs.theme;
}

function persist(view) {
  const state = view.state;
  data.session =
    state.status === STATUS_PLAYING && state.moves.length
      ? {
          size: state.size,
          winLength: state.winLength,
          mode: view.config.mode,
          difficulty: view.config.difficulty,
          aiMark: view.config.aiMark,
          firstPlayer: view.config.firstPlayer,
          moves: state.moves,
        }
      : null;
  save(data);
}

function fillBreakdown(rows) {
  resultRefs.breakdown.textContent = "";
  for (const row of rows) {
    const line = document.createElement("div");
    line.className = "rb-row" + (row.key === "total" ? " rb-total" : "");
    const name = document.createElement("span");
    name.textContent = row.label;
    const value = document.createElement("span");
    value.textContent = (row.key === "total" ? "" : "+") + row.value;
    line.append(name, value);
    resultRefs.breakdown.appendChild(line);
  }
}

function showResult(view, outcome, score, rows) {
  const pvp = view.config.mode === MODES.PVP;
  const winnerIsX = view.state.winner === 1;

  if (pvp) {
    resultRefs.badge.textContent = "双人对战";
    resultRefs.title.textContent = winnerIsX ? "红 X 获胜" : "蓝 O 获胜";
    resultRefs.sub.textContent = "本局不计入战绩与连胜";
    resultRefs.breakdown.textContent = "";
  } else {
    resultRefs.badge.textContent = outcome === OUTCOME_WIN ? "本局得分 +" + score.total : "本局结束";
    resultRefs.title.textContent = outcome === OUTCOME_WIN ? "你赢了" : outcome === OUTCOME_DRAW ? "平局" : "AI 赢了";
    resultRefs.sub.textContent =
      outcome === OUTCOME_WIN
        ? "当前连胜 " + data.stats.streak + " · 难度加成 ×" + score.factor
        : outcome === OUTCOME_DRAW
          ? "连胜 " + data.stats.streak + " 保持不变"
          : "连胜已清零，再来一次";
    fillBreakdown(rows);
  }
  resultRefs.again.textContent = "再来一局";
  resultRefs.layer.hidden = false;
  resultRefs.again.focus();
}

// 每局只结算一次：用 state 的对象引用做幂等标记（状态不可变，每次落子都是新对象）
function settle(view) {
  settledState = view.state;
  const pvp = view.config.mode === MODES.PVP;
  const streakBefore = data.stats.streak;
  const result = game.result(streakBefore);

  if (pvp || !result) {
    audio.draw();
    showResult(view, null, null, []);
    return;
  }

  data.stats = applyOutcome(data.stats, result.outcome, result.score.total);
  const rows = breakdown({
    outcome: result.outcome,
    empty: view.finished.empty,
    streakBefore,
    difficulty: view.config.difficulty,
  });
  if (result.outcome === OUTCOME_WIN) audio.win();
  else if (result.outcome === OUTCOME_DRAW) audio.draw();
  else audio.lose();

  showResult(view, result.outcome, result.score, rows);
  save(data);
}

function render(view) {
  if (view.finished && settledState !== view.state) settle(view);
  if (view.state.status === STATUS_PLAYING) settledState = null;
  ui.render(view, { stats: data.stats, prefs: data.prefs });
  persist(view);
}

const ui = mountUI(refs, {
  onPlay(index) {
    audio.unlock();
    const player = game.view().state.current;
    if (game.play(index)) audio.place(player);
  },
  onUndo() {
    if (game.undo()) audio.undo();
  },
  onRestart() {
    resultRefs.layer.hidden = true;
    game.start();
  },
  onMode(mode) {
    data.prefs.mode = mode;
    save(data);
    resultRefs.layer.hidden = true;
    game.start({ mode });
  },
  onSize(size) {
    data.prefs.boardSize = size;
    save(data);
    resultRefs.layer.hidden = true;
    game.start({ size });
  },
  onDifficulty(difficulty) {
    data.prefs.difficulty = difficulty;
    save(data);
    resultRefs.layer.hidden = true;
    game.start({ difficulty });
  },
  onSound() {
    data.prefs.muted = !data.prefs.muted;
    audio.setMuted(data.prefs.muted);
    if (!data.prefs.muted) {
      audio.unlock();
      audio.click();
    }
    save(data);
    render(game.view());
  },
  onTheme() {
    data.prefs.theme = data.prefs.theme === "dark" ? "light" : "dark";
    applyTheme();
    save(data);
    render(game.view());
  },
});

resultRefs.again.addEventListener("click", () => {
  resultRefs.layer.hidden = true;
  game.start();
});
resultRefs.close.addEventListener("click", () => {
  resultRefs.layer.hidden = true;
  refs.restartButton.focus();
});

const game = createGameController({ onChange: render, ai: chooseMove });

applyTheme();

// 只恢复"还没下完"的对局：已终局的存档在上一次结算时就记过账了，
// 直接重放会导致战绩重复累加。
const session = data.session;
const probe = session
  ? replay(
      {
        size: session.size,
        winLength: session.winLength ?? session.size,
        firstPlayer: session.firstPlayer,
      },
      session.moves ?? [],
    )
  : null;

if (probe && probe.status === STATUS_PLAYING && probe.moves.length) {
  game.restore(session);
} else {
  data.session = null;
  game.start({
    size: data.prefs.boardSize,
    mode: data.prefs.mode,
    difficulty: data.prefs.difficulty,
  });
}
