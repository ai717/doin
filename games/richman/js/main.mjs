// 装配入口：把引擎、控制器、UI、存档、音效接起来。
// 即开即玩：载入直接开一局快速对战（新手 AI），无任何前置遮罩；
// P / Esc 暂停、空格掷骰、1~3 用卡、切后台与失焦自动暂停。

import { createGame } from "./game.mjs";
import { createUI } from "./ui.mjs";
import * as storage from "./storage.mjs";
import * as audio from "./audio.mjs";
import { REC_TAGS } from "./i18n.mjs";

const META_KEY = "doin.meta.v1";

let locale = storage.loadLocale();
let soundOn = storage.loadSound();
let progress = storage.loadProgress();
let autoPaused = false;
let selected = { mode: progress.lastMode ?? "quick", ai: progress.lastAi ?? "novice" };

function play(fn, ...args) {
  try {
    if (typeof fn === "function") fn(...args);
  } catch {
    // 音效永远不许打断对局。
  }
}

const game = createGame({
  onEvent: (event) => {
    playEventAudio(event);
    ui?.onGameEvent(event);
  },
  onChange: () => {
    ui?.sync();
  },
  onOver: (result) => {
    finishMatch(result);
  },
});

const ui = createUI({
  game,
  locale,
  actions: {
    roll: () => {
      play(audio.click);
      game.playerAction({ type: "roll" });
    },
    decide: (kind) => {
      play(kind === "skip" ? audio.click : audio.stamp);
      game.playerAction({ type: kind });
    },
    shopBuy: (card) => {
      play(audio.coins);
      game.playerAction({ type: "shopBuy", card });
    },
    useCard: (card) => {
      play(audio.cardSwish);
      game.playerAction({ type: "useCard", card });
    },
    useCardWithValue: (card, value) => {
      play(audio.cardSwish);
      game.playerAction({ type: "useCard", card, payload: { value } });
    },
    pickTile: (tile) => {
      const phase = game.state?.phase;
      if (phase === "blockPick") {
        play(audio.stamp);
        game.playerAction({ type: "blockPick", tile });
      } else if (phase === "swapMine" || phase === "swapTheirs") {
        play(audio.cardSwish);
        game.playerAction({ type: "swapPick", tile });
      }
    },
    cancelCard: () => {
      play(audio.click);
      game.playerAction({ type: "cancelCard" });
    },
    resume: () => {
      autoPaused = false;
      game.resume();
      ui.closePause();
      ui.sync();
    },
    restart: () => {
      startMatch(selected.mode, selected.ai);
    },
    clickSound: () => play(audio.click),
    getProgress: () => progress,
    getSelected: () => selected,
    selectMode: (mode) => {
      selected = { ...selected, mode };
      progress = { ...progress, lastMode: mode };
      storage.saveProgress(progress);
    },
    selectAi: (level) => {
      selected = { ...selected, ai: level };
      progress = { ...progress, lastAi: level };
      storage.saveProgress(progress);
    },
    aiUnlocked: (level) => storage.aiUnlocked(progress, level),
    startMatch: () => {
      startMatch(selected.mode, selected.ai);
    },
    loadRecommendations: async (holder) => {
      const entries = await fetchRecommendations();
      if (!holder) return;
      for (const entry of entries) {
        const link = document.createElement("a");
        link.className = "rec-item";
        link.href = entry.url;
        const icon = document.createElement("span");
        icon.className = "rec-icon";
        icon.textContent = entry.icon || "🎮";
        const label = document.createElement("span");
        label.textContent = locale === "en" ? entry.en?.title || entry.title : entry.title;
        link.appendChild(icon);
        link.appendChild(label);
        holder.appendChild(link);
      }
    },
  },
});

function playEventAudio(event) {
  switch (event.type) {
    case "dice":
      play(audio.diceRoll);
      setTimeout(() => play(audio.diceSettle), 560);
      break;
    case "hop":
      play(audio.hop);
      break;
    case "stamp":
      play(audio.stamp);
      break;
    case "build":
      play(audio.stamp);
      break;
    case "rent":
      play(audio.coins);
      break;
    case "gain":
      if (event.reason === "salary" || event.reason === "bank" || event.reason === "event") {
        play(audio.coins, 0.9);
      }
      break;
    case "pay":
      if (!event.to) play(audio.payOut);
      break;
    case "block":
      play(audio.click);
      break;
    case "blockHit":
    case "trap":
      play(audio.spring);
      break;
    case "cardUsed":
      play(audio.cardSwish);
      break;
    case "cardGain":
      play(audio.cardSwish);
      break;
    case "skipTurn":
      play(audio.payOut);
      break;
    case "bankrupt":
      play(audio.bankruptAlarm);
      break;
    case "swap":
      play(audio.cardSwish);
      break;
    default:
      break;
  }
}

function startMatch(mode, aiLevel) {
  selected = { mode, ai: aiLevel };
  const snap = game.newMatch({ mode, ai: aiLevel });
  progress = { ...progress, lastMode: mode, lastAi: aiLevel };
  storage.saveProgress(progress);
  ui.buildHud();
  ui.ensureTokens();
  ui.ensureCanvas();
  ui.hideResult();
  ui.closePause();
  ui.sync();
  ui.showToast(ui.t("toastNewMatch"));
  return snap;
}

function finishMatch(result) {
  const winner = result.winner;
  const humans = result.players.filter((entry) => entry.human);
  const humanWon = Boolean(winner) && humans.some((entry) => entry.id === winner);
  if (result.reason !== "draw") {
    progress = storage.recordMatchResult(progress, humanWon);
    storage.saveProgress(progress);
  }
  if (humanWon) play(audio.victory);
  else if (result.reason === "draw") play(audio.click);
  else play(audio.defeat);
  reportSession(result, humanWon);
  ui.showResult(result);
  ui.sync();
}

function reportSession(result, won) {
  const human = result.players.find((entry) => entry.human);
  const payload = {
    slug: "richman",
    outcome: won ? "WON" : result.reason === "draw" ? "DRAW" : "LOST",
    score: human?.worth ?? 0,
    stars: 0,
    timestamp: Date.now(),
    mode: result.mode,
  };
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    meta.recentlyPlayed = [payload.slug, ...(meta.recentlyPlayed || []).filter((slug) => slug !== payload.slug)].slice(0, 8);
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // 存储受限时静默跳过。
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload }, "*");
    }
  } catch {
    // 跨域父级不可达时忽略。
  }
}

let recCache = null;

async function fetchRecommendations() {
  if (recCache) return recCache;
  for (const url of ["../games.json", "../../games.json"]) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      const pool = (data.games ?? []).filter(
        (entry) => entry.slug !== "richman" && (entry.tags ?? []).some((tag) => REC_TAGS.includes(tag)),
      );
      recCache = pool.slice(0, 3);
      if (recCache.length) return recCache;
    } catch {
      // 开发目录结构或离线时静默降级：不给推荐位即可。
    }
  }
  recCache = [];
  return recCache;
}

// ---------------------------------------------------------------- 全局事件

function bindGlobal() {
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
    if (typing) return;
    const key = event.key;
    if (key === " " || key === "Spacebar") {
      event.preventDefault();
      if (game.paused) {
        autoPaused = false;
        game.resume();
        ui.closePause();
        ui.sync();
        return;
      }
      const state = game.state;
      if (state && !state.over && state.phase === "pre" && !state.pending) {
        const player = state.players[state.turn];
        if (player?.human) actionsRoll();
      }
      return;
    }
    if (key === "p" || key === "P" || key === "Escape") {
      if (key === "Escape" && ui.overlayOpen) {
        // Esc 只负责收起轻量弹层，不打断对局。
        return;
      }
      if (ui.resultOpen) return;
      event.preventDefault();
      togglePause();
      return;
    }
    if (key >= "1" && key <= "3") {
      const state = game.state;
      if (!state || state.over || game.paused) return;
      const player = state.players[state.turn];
      if (!player?.human || state.phase !== "pre" || state.cardUsed) return;
      const card = player.cards[Number(key) - 1];
      if (card) ui.confirmCard(card);
    }
  });

  function actionsRoll() {
    play(audio.click);
    game.playerAction({ type: "roll" });
  }

  document.getElementById("btn-lang")?.addEventListener("click", () => {
    locale = locale === "en" ? "zh" : "en";
    storage.saveLocale(locale);
    ui.setLocale(locale);
    ui.sync();
  });

  document.getElementById("btn-sound")?.addEventListener("click", () => {
    soundOn = !soundOn;
    storage.saveSound(soundOn);
    try {
      audio.setEnabled(soundOn);
    } catch {
      // 音效不可用时保持静默。
    }
    ui.setSound(soundOn);
    if (soundOn) play(audio.click);
  });

  document.getElementById("btn-pause")?.addEventListener("click", () => {
    togglePause();
  });

  document.addEventListener(
    "pointerdown",
    () => {
      play(audio.unlock);
      if (autoPaused && !document.hidden && !game.over) {
        autoPaused = false;
        game.resume();
        ui.closePause();
        ui.sync();
      }
    },
    { capture: true },
  );

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (!game.paused && !game.over) {
        autoPaused = true;
        game.pause();
        ui.openPause();
        ui.sync();
      }
    } else {
      // 回到前台：等待玩家点按继续，避免内嵌环境误恢复。
    }
  });

  window.addEventListener("blur", () => {
    if (!game.paused && !game.over) {
      autoPaused = true;
      game.pause();
      ui.openPause();
      ui.sync();
    }
  });
}

function togglePause() {
  if (game.over) return;
  game.togglePause();
  if (game.paused) ui.openPause();
  else ui.closePause();
  play(audio.click);
  ui.sync();
}

// ---------------------------------------------------------------- 主循环

let lastFrame = 0;

function frame(now) {
  const dt = lastFrame ? now - lastFrame : 16;
  lastFrame = now;
  game.tick(dt);
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- 启动

try {
  audio.setEnabled(soundOn);
} catch {
  // 忽略。
}
ui.setSound(soundOn);
ui.setLocale(locale);
startMatch(selected.mode, selected.ai);
bindGlobal();
if (typeof requestAnimationFrame === "function") requestAnimationFrame(frame);

window.__richman = {
  get game() {
    return game;
  },
  get ui() {
    return ui;
  },
  get locale() {
    return locale;
  },
  setLocale: (next) => {
    locale = next;
    storage.saveLocale(next);
    ui.setLocale(next);
    ui.sync();
  },
  storage,
};
