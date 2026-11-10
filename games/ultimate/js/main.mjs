// 装配入口：存档 / 音效 / 控制器 / 渲染接到一起，并负责「开局即玩」与结算入档。
// 规则不在这一层判断；这里只做意图转发、偏好落库与语言热更新。

import { EMPTY, MARK_X, STATUS_PLAYING } from "./engine.mjs";
import { PUZZLES } from "./puzzles.mjs";
import { createAudio } from "./audio.mjs";
import { createGameController } from "./game.mjs";
import {
  MODES, applyCampaignResult, applyOutcome, load, save,
} from "./storage.mjs";
import {
  OUTCOME_DRAW, OUTCOME_WIN, breakdown, countBigs, scoreCampaign, scoreDuel,
} from "./score.mjs";
import { createUI } from "./ui.mjs";
import { loadLocale, saveLocale } from "./i18n.mjs";

let store = load();
let locale = loadLocale();
let settledState = null;
let previousState = null;
let game = null;

const audio = createAudio({ muted: store.prefs.muted });
const ui = createUI({
  locale,
  muted: store.prefs.muted,
  handlers: {
    onCell: handleCell,
    onMode: handleMode,
    onTier: handleTier,
    onPvp: handlePvp,
    onUndo: handleUndo,
    onHint: handleHint,
    onRestart: () => startRound({}),
    onLevels: () => ui.openLevels(),
    onPickPuzzle: (id) => {
      store.prefs.mode = MODES.CAMPAIGN;
      store.prefs.lastPuzzle = id;
      save(store);
      startRound({ mode: MODES.CAMPAIGN, puzzleId: id });
    },
    onNext: handleNextPuzzle,
    onSound: handleSound,
    onLang: handleLang,
    onClearRecords: handleClearRecords,
    onResultClose: () => {},
    onSettingsClose: () => {
      ui.updateCtx(context());
    },
  },
});

game = createGameController({ onChange: render });

function context() {
  return { stats: store.stats, campaign: store.campaign, prefs: store.prefs };
}

function render(view) {
  if (!view) return;
  if (view.finished && settledState !== view.state) settle(view);
  if (view.state.status === STATUS_PLAYING) settledState = null;

  if (previousState && previousState !== view.state) {
    const captured = view.state.bigs.some((value, big) => value !== EMPTY && previousState.bigs[big] === EMPTY);
    if (captured) audio.capture();
    else if (view.state.active !== previousState.active) audio.shift();
  }
  previousState = view.state;

  ui.render(view, context());
  persist(view);
}

function persist(view) {
  store.session = view.state.status === STATUS_PLAYING && view.state.moves.length
    ? {
        mode: view.config.mode,
        tier: view.config.tier,
        pvp: view.config.pvp,
        puzzleId: view.config.puzzleId,
        moves: view.state.moves,
      }
    : null;
  save(store);
}

function startRound(config = {}) {
  const mode = config.mode ?? store.prefs.mode;
  const puzzleId = mode === MODES.CAMPAIGN
    ? config.puzzleId ?? store.prefs.lastPuzzle
    : null;
  store.prefs.mode = mode;
  if (mode === MODES.CAMPAIGN && puzzleId) store.prefs.lastPuzzle = puzzleId;
  save(store);

  ui.hideResult();
  ui.clearHover();
  settledState = null;
  previousState = null;
  ui.updateCtx(context());
  game.start({
    mode,
    tier: store.prefs.tier,
    pvp: store.prefs.pvp,
    puzzleId,
  });
}

function handleCell(index) {
  audio.unlock();
  const before = game.view();
  if (!before.humanTurn || before.thinking) return;
  if (!game.play(index)) return;
  audio.place(before.state.current);
}

function handleUndo() {
  if (game.undo()) {
    audio.undo();
    ui.hideResult();
  }
}

function handleHint() {
  if (store.prefs.mode === MODES.CAMPAIGN) audio.unlock();
  const move = game.hint();
  if (move >= 0) {
    audio.click();
    ui.pulse(move);
    ui.toast(ui.t().toastHint);
  } else {
    ui.toast(ui.t().toastNoHint);
  }
}

function handleMode(mode) {
  if (mode === store.prefs.mode && store.prefs.mode === MODES.DUEL) {
    // 重复点击同一模式也重开一局，保持按钮手感
    startRound({ mode });
    return;
  }
  store.prefs.mode = mode;
  save(store);
  startRound({ mode });
}

function handleTier(tier) {
  const previous = store.prefs.tier;
  store.prefs.tier = tier;
  save(store);
  ui.updateCtx(context());
  if (previous !== tier && store.prefs.mode === MODES.DUEL && !store.prefs.pvp) {
    startRound({ mode: MODES.DUEL });
  } else {
    render(game.view());
  }
}

function handlePvp(enabled) {
  store.prefs.pvp = Boolean(enabled);
  save(store);
  if (store.prefs.mode === MODES.DUEL) {
    startRound({ mode: MODES.DUEL });
  } else {
    render(game.view());
  }
}

function handleNextPuzzle() {
  const current = game.view().puzzle;
  const next = current ? PUZZLES[current.index + 1] : null;
  if (!next) {
    ui.openLevels();
    return;
  }
  store.prefs.lastPuzzle = next.id;
  save(store);
  startRound({ mode: MODES.CAMPAIGN, puzzleId: next.id });
}

function handleSound() {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  store.prefs.muted = muted;
  save(store);
  ui.setMuted(muted);
  if (!muted) {
    audio.unlock();
    audio.click();
  }
  render(game.view());
}

// 语言切换：只换文本，绝不重置盘面、步数与残局进度。
function handleLang() {
  locale = locale === "zh" ? "en" : "zh";
  saveLocale(locale);
  ui.setLocale(locale);
  ui.updateCtx(context());
  render(game.view());
}

function handleClearRecords() {
  store = {
    ...store,
    stats: { wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, totalScore: 0 },
    campaign: {},
  };
  save(store);
  settledState = null;
  ui.updateCtx(context());
  render(game.view());
  ui.toast(ui.t().toastSaved);
}

function settle(view) {
  settledState = view.state;
  const t = ui.t();

  if (view.config.pvp) {
    audio.draw();
    ui.showResult({
      kind: "duel",
      outcome: null,
      winner: view.state.winner,
      rows: [],
      canNext: false,
    });
    return;
  }

  if (view.config.mode === MODES.CAMPAIGN) {
    const stars = view.finished.stars;
    const gained = scoreCampaign({
      stars,
      used: view.finished.used,
      par: view.finished.par,
    });
    store.campaign = applyCampaignResult(store.campaign, view.puzzle.id, {
      stars,
      used: view.finished.used,
    });
    save(store);
    ui.updateCtx(context());
    if (stars > 0) audio.win();
    else {
      audio.lose();
      ui.toast(t.toastCampaignFail);
    }
    const next = PUZZLES[view.puzzle.index + 1] ?? null;
    ui.showResult({
      kind: "campaign",
      stars: gained.stars,
      used: view.finished.used,
      par: view.finished.par,
      winner: view.state.winner,
      canNext: Boolean(next),
    });
    reportSession({ won: stars > 0, score: gained.total, stars });
    return;
  }

  const outcome = view.finished.outcome;
  const score = scoreDuel({
    outcome,
    moves: view.state.moves.length,
    ownBigs: countBigs(view.state, MARK_X),
    tier: view.config.tier,
    streakBefore: store.stats.streak,
  });
  store.stats = applyOutcome(store.stats, outcome, score.total);
  save(store);
  ui.updateCtx(context());

  if (outcome === OUTCOME_WIN) audio.win();
  else if (outcome === OUTCOME_DRAW) audio.draw();
  else audio.lose();

  ui.showResult({
    kind: "duel",
    outcome,
    winner: view.state.winner,
    rows: breakdown(score),
    canNext: false,
  });
  if (outcome === OUTCOME_WIN) {
    reportSession({ won: true, score: score.total, stars: 0 });
  }
}

// 只做轻量门户广播：本机偏好 + 父级 postMessage，失败一律静默。
function reportSession(result) {
  const payload = {
    slug: "ultimate",
    outcome: result.won ? "WON" : "LOST",
    score: result.score ?? 0,
    stars: result.stars ?? 0,
    timestamp: Date.now(),
  };
  try {
    const meta = JSON.parse(localStorage.getItem("doin.meta.v1") || "{}");
    meta.recentlyPlayed = [payload.slug, ...(meta.recentlyPlayed || []).filter((slug) => slug !== payload.slug)].slice(0, 8);
    meta.totalStars = (meta.totalStars || 0) + (payload.stars || 0);
    localStorage.setItem("doin.meta.v1", JSON.stringify(meta));
  } catch (error) {
    // 存储不可用时静默
  }
  if (typeof window !== "undefined" && window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload }, "*");
  }
}

function bootstrap() {
  ui.updateCtx(context());
  const session = store.session;
  const restored = session ? game.restore(session) : null;
  if (restored && restored.state.status === STATUS_PLAYING) {
    render(restored);
    return;
  }
  store.session = null;
  startRound({ mode: store.prefs.mode, puzzleId: store.prefs.lastPuzzle });
}

bootstrap();
