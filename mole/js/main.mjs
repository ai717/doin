// 莓园打地鼠 — 装配入口：绑定事件、驱动主循环、协调各层

import * as E from "./engine.mjs";
import * as G from "./game.mjs";
import * as S from "./storage.mjs";
import * as A from "./audio.mjs";
import * as U from "./ui.mjs";
import { accuracyPercent } from "./score.mjs";
import { detectLocale, saveLocale, t } from "./i18n.mjs";

const ui = U.createUI();
const game = G.createController();

let locale = detectLocale();
let data = S.rollDailyIfNeeded(S.loadGameData(), E.todayKey());
let soundOn = data.soundEnabled !== false;
let rafId = 0;
let lastTs = 0;
let resizeTimer = 0;

/* ---------------- 渲染 ---------------- */

function renderHud() {
  const run = game.run;
  const mode = G.storageMode(game);
  const total = (run?.hits ?? 0) + (run?.misses ?? 0);
  U.updateHud(ui, run, {
    best: S.bestOf(data, mode),
    bestCombo: data.bestCombo?.[mode] ?? 0,
    multiplier: E.currentMultiplier(run),
    seconds: run ? E.secondsLeft(run) : 60,
    accuracyText: total > 0 ? `${accuracyPercent(run.hits, run.misses)}%` : "—",
  });
}

function render() {
  U.syncHoles(ui, game.run);
  renderHud();
}

/* ---------------- 事件反馈 ---------------- */

function feedbackFor(result) {
  if (!result?.ok) return;
  // 砸中必有微震 —— 这是"砸下去了"最主要的体感来源，比锤子自身的旋转更好读
  U.shakeGarden(ui, result.kind === "bomb");

  // ★ 铁盔鼠被弹开（helmetBlock）是**非致命**的：engine 不会让它退场。
  //   这里必须走 markBlock 播"原地一晃"，绝不能走 markHit ——
  //   那套动画的末帧是沉到地平线以下，会让活着的地鼠先从画面消失再弹回来。
  if (result.kind === "helmetBlock") {
    U.markBlock(ui, result.index, E.BLOCKED_MS);
    U.spawnChips(ui, result.index, "helmet");
    A.playClank();
    return;
  }

  // 其余（普鼠 / 金鼠 / 铁盔致命击 / 炸弹）地鼠都会退场，
  // 播放时长以 engine 为准（受击下沉时长），UI 不得自定 ——
  // 否则动画时长与"地鼠还留在场上"的时间会对不上
  U.markHit(ui, result.index, E.WHACKED_MS);
  if (result.kind === "bomb") {
    U.spawnChips(ui, result.index, "bomb");
    A.playBomb();
    U.toast(ui, t("bombToast", locale), true);
    return;
  }
  if (result.kind === "gold") {
    U.spawnChips(ui, result.index, "gold");
    A.playGold();
  } else {
    U.spawnChips(ui, result.index, "hit");
    A.playWhack(result.combo ?? 0);
  }
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === "miss") {
      A.playMiss();
    } else if (ev.type === "frenzyStart") {
      U.setFrenzy(ui, true);
      U.toast(ui, t("frenzyToast", locale));
      A.playFrenzy();
    } else if (ev.type === "frenzyEnd") {
      U.setFrenzy(ui, false);
    } else if (ev.type === "over") {
      settle();
    }
  }
}

/* ---------------- 生命周期 ---------------- */

function startRun(mode) {
  U.hideAllModals(ui);
  U.setFrenzy(ui, false);
  A.unlockAudio();
  A.setMuted(!soundOn);
  if (mode === "daily") {
    const date = E.todayKey();
    G.start(game, { mode: "daily", seed: E.dailySeed(date), date });
  } else {
    const fallback = game.mode === "daily" ? "normal" : game.mode;
    const next = G.MODES.includes(mode) && mode !== "daily" ? mode : fallback;
    G.start(game, { mode: next, seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0 });
  }
  U.setDifficultyTab(ui, game.mode === "daily" ? "normal" : game.mode);
  U.setPrimaryButton(ui, locale, "running");
  A.playStart();
  render();
}

function settle() {
  const sum = G.summary(game);
  const mode = G.storageMode(game);
  const prevBest = S.bestOf(data, mode);
  const isBest = sum.score > prevBest;
  data = S.updateWithRunResult(data, {
    mode,
    score: sum.score,
    maxCombo: sum.maxCombo,
    date: sum.date || E.todayKey(),
  });
  S.saveGameData(data);
  U.setFrenzy(ui, false);
  U.showSettle(ui, locale, sum, S.bestOf(data, mode), isBest);
  U.setPrimaryButton(ui, locale, "start");
  A.playOver();
  renderHud();
}

function doPause() {
  if (!G.isRunning(game)) return;
  if (G.pause(game)) U.showModal(ui, "pause");
}

function doResume() {
  if (!game.run || game.run.status !== "running") return;
  if (G.resume(game)) U.hideModal(ui, "pause");
}

function togglePause() {
  if (game.paused) doResume();
  else doPause();
}

/* ---------------- 主循环 ---------------- */

function frame(ts) {
  const dt = lastTs ? Math.min(100, ts - lastTs) : 16;
  lastTs = ts;
  if (G.isRunning(game)) {
    handleEvents(G.tick(game, dt));
    render();
  }
  rafId = requestAnimationFrame(frame);
}

/* ---------------- 输入 ---------------- */

function hitIndex(index) {
  if (!G.isRunning(game)) return;
  const result = G.hit(game, index);
  feedbackFor(result);
  renderHud();
}

function bindInput() {
  const grid = ui.dom.grid;

  grid.addEventListener("pointerdown", (ev) => {
    const hole = ev.target.closest?.(".hole");
    if (!hole) return;
    ev.preventDefault();
    A.unlockAudio();
    A.setMuted(!soundOn);
    // 键盘命中也要有反馈，但锤子不该瞬移到别处 —— 只有指针来源才跟着点落下槌
    if (ev.pointerType !== "touch") {
      ui.dom.hammer.classList.add("is-armed");
      U.moveHammer(ui, ev.clientX, ev.clientY);
      U.swingHammer(ui);
    }
    hitIndex(Number(hole.dataset.index));
  });

  // 木槌只在指针真正悬停于花园内时浮出（见 style.css 的 .hammer.is-armed）。
  // pointerenter/leave 与 pointermove 分开绑定：enter 负责"立刻显形"，
  // 不依赖用户先动一下鼠标 —— 曾经只有 pointermove，导致停着不动时看不到锤子。
  const armHammer = () => ui.dom.hammer.classList.add("is-armed");
  const disarmHammer = () => ui.dom.hammer.classList.remove("is-armed");
  ui.dom.garden.addEventListener("pointerenter", armHammer);
  ui.dom.garden.addEventListener("pointerleave", disarmHammer);
  // 兜底：指针已在花园内、且从未触发 enter（如页面加载完成时鼠标就停在那儿，
  // 或某些浏览器在触屏模拟下不发 enter），首次移动必须能把它叫出来
  ui.dom.garden.addEventListener("pointerover", armHammer);

  ui.dom.garden.addEventListener("pointermove", (ev) => {
    // 混合输入设备（触屏笔记本）兜底：真看到触摸就收走木槌，避免"既没锤子也没光标"
    if (ev.pointerType === "touch") {
      ui.dom.garden.classList.add("is-touch");
      disarmHammer();
      return;
    }
    ui.dom.garden.classList.remove("is-touch");
    armHammer();
    U.moveHammer(ui, ev.clientX, ev.clientY);
  });

  window.addEventListener("keydown", (ev) => {
    const key = ev.key;
    if (key === "p" || key === "P") {
      ev.preventDefault();
      togglePause();
      return;
    }
    if (key === "Enter") {
      ev.preventDefault();
      if (!game.run || game.run.status === "over") startRun(game.mode);
      else togglePause();
      return;
    }
    const index = U.keyToIndex(key, ui.cols);
    if (index >= 0) {
      ev.preventDefault();
      hitIndex(index);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) doPause();
  });

  let resizeRaf = 0;
  const applyGrid = () => {
    const { rows, cols } = U.gridForWidth(window.innerWidth);
    if (rows === ui.rows && cols === ui.cols) return;
    // 网格变化必须同时重建 DOM 与引擎洞位，否则两者长度不一致
    if (G.isRunning(game)) doPause();
    U.buildGrid(ui, rows, cols);
    G.setGrid(game, rows, cols);
    if (game.run) {
      // 洞位数变化后旧对局不再自洽，直接重置为未开局状态
      game.run = null;
      game.paused = false;
      U.hideAllModals(ui);
      U.showModal(ui, "welcome");
      U.setPrimaryButton(ui, locale, "start");
      U.setFrenzy(ui, false);
    }
    render();
  };

  window.addEventListener("resize", () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(applyGrid);
  });
  window.addEventListener("orientationchange", () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(applyGrid);
  });
}

function bindButtons() {
  ui.dom.btnStart.addEventListener("click", () => startRun(game.mode));
  ui.dom.btnDailyWelcome.addEventListener("click", () => startRun("daily"));
  ui.dom.btnDaily.addEventListener("click", () => startRun("daily"));
  ui.dom.btnPrimary.addEventListener("click", () => {
    if (G.isRunning(game)) {
      startRun(game.mode);
    } else {
      startRun(game.mode === "daily" ? "normal" : game.mode);
    }
  });
  ui.dom.btnPause.addEventListener("click", togglePause);
  ui.dom.btnResume.addEventListener("click", doResume);
  ui.dom.btnRestartPause.addEventListener("click", () => startRun(game.mode));
  ui.dom.btnReplay.addEventListener("click", () => startRun(game.mode));
  ui.dom.btnHelp.addEventListener("click", () => U.showModal(ui, "rules"));
  ui.dom.btnCloseRules.addEventListener("click", () => U.hideModal(ui, "rules"));
  ui.dom.modalRules.addEventListener("click", (ev) => {
    if (ev.target === ui.dom.modalRules) U.hideModal(ui, "rules");
  });

  ui.dom.btnSound.addEventListener("click", () => {
    soundOn = !soundOn;
    A.setMuted(!soundOn);
    U.setSoundButton(ui, soundOn);
    data = S.saveGameData({ ...data, soundEnabled: soundOn });
  });

  ui.dom.btnLang.addEventListener("click", () => {
    const next = locale === "zh" ? "en" : "zh";
    saveLocale(next);
    location.reload();
  });

  ui.dom.diffTabs.addEventListener("click", (ev) => {
    const tab = ev.target.closest?.(".diff-tab");
    if (!tab?.dataset.mode) return;
    A.unlockAudio();
    startRun(tab.dataset.mode);
  });

  // 弹层遮罩点击：开始弹窗不关（必须选难度/开始），其余可关
  ui.dom.modalPause.addEventListener("click", (ev) => {
    if (ev.target === ui.dom.modalPause) doResume();
  });
}

/* ---------------- 启动 ---------------- */

function boot() {
  const { rows, cols } = U.gridForWidth(window.innerWidth);
  U.buildGrid(ui, rows, cols);
  G.setGrid(game, rows, cols);
  ui.dom.garden.tabIndex = 0; // 供触屏获得键盘焦点，复用键盘映射
  U.setLocale(ui, locale);
  U.setSoundButton(ui, soundOn);
  U.setLangButton(ui, locale);
  U.setDifficultyTab(ui, "normal");
  U.setPrimaryButton(ui, locale, "start");
  game.mode = data.difficulty && data.difficulty !== "daily" ? data.difficulty : "normal";
  U.setDifficultyTab(ui, game.mode);
  bindInput();
  bindButtons();
  render();
  U.showModal(ui, "welcome");
  rafId = requestAnimationFrame(frame);
}

boot();

// 供无浏览器冒烟测试使用（生产环境无副作用）
if (typeof window !== "undefined") {
  window.__mole = { ui, game, startRun, hitIndex, render, E, G, S };
}
