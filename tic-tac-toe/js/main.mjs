// 装配层：把存档、音效、控制器和 DOM 接到一起。
// 规则一律不在这里判断 —— 这里只做"读取偏好 -> 驱动控制器 -> 落库"。

import { PLAYER_O, STATUS_PLAYING, replay } from "./engine.mjs";
import { chooseMove } from "./ai.mjs";
import { createAudio } from "./audio.mjs";
import { createGameController } from "./game.mjs";
import { MODES, applyOutcome, load, save } from "./storage.mjs";
import { OUTCOME_DRAW, OUTCOME_WIN, breakdown } from "./score.mjs";
import { mountUI } from "./ui.mjs";
import { format, htmlLang, loadLocale, saveLocale, strings } from "./i18n.mjs";

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
  langButton: byId("lang"),
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

// —— i18n：统一语言规则（全站共享 doin.lang > 浏览器语言）——
const locale = loadLocale();
const t = strings(locale);
document.documentElement.lang = htmlLang(locale);
document.title = t.docTitle;
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute("content", t.metaDesc);

const BREAKDOWN_LABEL_KEYS = {
  base: "rowBase",
  efficiency: "rowEfficiency",
  streak: "rowStreak",
  total: "rowTotal",
};

const DIFF_TEXT_KEYS = { easy: "diffEasy", normal: "diffNormal", master: "diffMaster" };

function diffText(id) {
  return t[DIFF_TEXT_KEYS[id]] ?? id;
}

// 把 HTML 里的静态文案按当前语言统一刷一遍（HTML 保留中文默认值做 SEO 兜底）。
function applyStaticTexts() {
  const set = (id, text) => {
    const el = byId(id);
    if (el) el.textContent = text;
  };
  const q = (selector) => document.querySelector(selector);

  q(".title").textContent = t.title;
  q(".lede").textContent = t.lede;
  q(".back a").textContent = t.backHome;
  q(".controls").setAttribute("aria-label", t.ariaControls);
  q(".hud").setAttribute("aria-label", t.ariaHud);
  q(".toolbar").setAttribute("aria-label", t.ariaToolbar);
  q(".board").setAttribute("aria-label", t.boardAria);
  q("#result-breakdown").setAttribute("aria-label", t.breakdownAria);
  const controlLabels = document.querySelectorAll(".control-label");
  if (controlLabels.length === 3) {
    controlLabels[0].textContent = t.modeLabel;
    controlLabels[1].textContent = t.boardSizeLabel;
    controlLabels[2].textContent = t.diffLabel;
  }
  q("#mode-group").setAttribute("aria-label", t.ariaModeGroup);
  q("#size-group").setAttribute("aria-label", t.ariaSizeGroup);
  q("#difficulty-group").setAttribute("aria-label", t.ariaDiffGroup);
  const segs = (group) => Array.from(document.querySelectorAll(group + " .seg"));
  const [modeSegs, sizeSegs, diffSegs] = [segs("#mode-group"), segs("#size-group"), segs("#difficulty-group")];
  if (modeSegs.length === 2) {
    modeSegs[0].textContent = t.modePve;
    modeSegs[1].textContent = t.modePvp;
  }
  if (diffSegs.length === 3) {
    diffSegs[0].textContent = t.diffEasy;
    diffSegs[1].textContent = t.diffNormal;
    diffSegs[2].textContent = t.diffMaster;
  }
  const drawTag = q(".hud-card:nth-child(2) .hud-tag");
  if (drawTag) drawTag.textContent = t.hudDraw;
  const streakTag = q(".hud-streak .hud-tag");
  if (streakTag && streakTag.firstChild) streakTag.firstChild.textContent = t.hudStreak + " ";
  const streakUnit = q(".hud-unit");
  if (streakUnit) streakUnit.textContent = t.streakUnit;
  set("status", t.statusTurnYou);
  set("undo", t.undo);
  set("restart", t.restart);
  set("sound", "♪");
  refs.soundButton.setAttribute("aria-label", t.sound);
  refs.soundButton.setAttribute("title", t.sound);
  refs.themeButton.setAttribute("aria-label", t.theme);
  refs.themeButton.setAttribute("title", t.theme);
  refs.langButton.setAttribute("aria-label", t.ariaLang);
  refs.langButton.setAttribute("title", t.ariaLang);
  set("result-again", t.resultAgain);
  set("result-close", t.resultClose);
  const footnote = q(".footnote p");
  if (footnote) footnote.innerHTML = t.footnoteHtml;
  const saved = q(".footnote .saved");
  if (saved) saved.textContent = t.saved;
  const noscript = q("noscript");
  if (noscript) noscript.textContent = t.noscript;
}

// 语言按钮显示"可切换到的语言"，与当前语言相反。
function syncLangButton() {
  refs.langButton.textContent = t.langShort;
}

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
    name.textContent = t[BREAKDOWN_LABEL_KEYS[row.key]] ?? row.key;
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
    resultRefs.badge.textContent = t.resultPvpBadge;
    resultRefs.title.textContent = winnerIsX ? t.resultPvpWinX : t.resultPvpWinO;
    resultRefs.sub.textContent = t.resultPvpSub;
    resultRefs.breakdown.textContent = "";
  } else {
    resultRefs.badge.textContent =
      outcome === OUTCOME_WIN ? format(t.resultScoreBadge, String(score.total)) : t.resultEndBadge;
    resultRefs.title.textContent =
      outcome === OUTCOME_WIN ? t.resultTitleWin : outcome === OUTCOME_DRAW ? t.resultTitleDraw : t.resultTitleLose;
    resultRefs.sub.textContent =
      outcome === OUTCOME_WIN
        ? format(t.resultSubWin, String(data.stats.streak), String(score.factor))
        : outcome === OUTCOME_DRAW
          ? format(t.resultSubDraw, String(data.stats.streak))
          : t.resultSubLose;
    fillBreakdown(rows);
  }
  resultRefs.again.textContent = t.resultAgain;
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
  },  onUndo() {
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
}, t);

resultRefs.again.addEventListener("click", () => {
  resultRefs.layer.hidden = true;
  game.start();
});
resultRefs.close.addEventListener("click", () => {
  resultRefs.layer.hidden = true;
  refs.restartButton.focus();
});

// 语言切换：写入全站共享偏好后刷新，保持所有模块状态一致。
refs.langButton.addEventListener("click", () => {
  saveLocale(locale === "zh" ? "en" : "zh");
  window.location.reload();
});

const game = createGameController({ onChange: render, ai: chooseMove });

applyTheme();
applyStaticTexts();
syncLangButton();

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
