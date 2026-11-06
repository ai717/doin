// 推币机 · 入口装配（唯一允许触碰 DOM 的装配层）
// 固定步长主循环 → engine 推进 → 事件分发（音效 / 渲染 / HUD / 掉落记录）→ 浮层与存档。
//
// 无尽机台：没有选关、没有瞄准滑轨。玩家只决定「带多少币进场」与「什么时候投」。

import { CoinPusherGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { loadSave, saveSave, clearSave } from "./storage.mjs";
import { loadLocale, saveLocale, strings, format } from "./i18n.mjs";
import { initAudio, setAudioEnabled, playEvent } from "./audio.mjs";
import { formatScore } from "./score.mjs";
import { CREDIT_OPTIONS, DEFAULT_CREDITS, STATUS } from "./engine.mjs";

const INSERT_COOLDOWN = 0.15;   // 连投的最小间隔（秒），按住空格/点按都能连投

function boot() {
  const canvas = document.getElementById("table");
  if (!canvas) return null;

  let save = loadSave();
  let lang = loadLocale();
  let selectedCredits = save.lastCredits;
  let resultShown = false;
  let finishTimer = 0;
  let resetPending = 0;
  let prevPhase = 0;
  let insertCd = 0;
  let hudKey = "";
  let audioReady = false;

  const renderer = createRenderer(canvas);
  const reduceMotion = typeof matchMedia === "function"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setReduced(reduceMotion);

  const game = new CoinPusherGame({ credits: selectedCredits });

  function hudPayload() {
    const state = game.state;
    return {
      credits: state.credits,
      score: state.score,
      mult: state.cascadeMult,
      cascade: state.cascadeCount,
      effects: state.effects,
      bestScore: save.bestScore,
      bestCascade: save.bestCascade,
      bestDrops: save.bestDrops,
      runs: save.runs,
      canInsert: game.canFire()
    };
  }

  function runStatsText(state) {
    return format(lang, "runStats", {
      i: state.inserted, d: state.dropped, l: state.lostCoins
    });
  }

  // ---------------------------------------------------------- 事件分发

  function handleEvent(ev) {
    playEvent(ev.type, ev);
    renderer.noteEvent(ev);

    if (ev.type === "drop") {
      // 得分一律落到侧栏「掉落记录」，画布上不再飘字
      ui.pushDrop({ kind: ev.kind || "norm", gained: ev.gained, mult: ev.mult, cascade: ev.cascade });
    } else if (ev.type === "jackpot") ui.toast("toastJackpot");
    else if (ev.type === "tower_down") ui.toast("toastTower");
    else if (ev.type === "card") {
      ui.toast(ev.effect === "double" ? "toastCardDouble" : ev.effect === "speed" ? "toastCardSpeed" : "toastCardMagnet");
    } else if (ev.type === "launch") ui.toast("toastLaunch");
    else if (ev.type === "token_spawn") ui.toast("toastTokenSpawn");
    else if (ev.type === "cascade_end") {
      ui.toast("toastCascade", { n: ev.count, m: formatScore(ev.mult) });
    } else if (ev.type === "lost") {
      finishTimer = 0.9;
    }
  }

  game.subscribe(handleEvent);

  // ---------------------------------------------------------- 结算

  function finishRun() {
    if (resultShown) return;
    resultShown = true;
    const state = game.state;
    const table = strings(lang);

    const line = format(lang, "endLine", {
      s: formatScore(state.score),
      d: state.dropped,
      l: state.lostCoins,
      c: state.bestCascade
    });
    let suffix = "";
    if (state.score > save.bestScore) suffix = ` · ${table.newRecord}`;

    save.bestScore = Math.max(save.bestScore, state.score);
    save.bestCascade = Math.max(save.bestCascade, state.bestCascade);
    save.bestDrops = Math.max(save.bestDrops, state.dropped);
    save.runs += 1;
    save.lastCredits = selectedCredits;
    saveSave(save);

    playEvent("lost");
    ui.showResult({ title: table.endTitle, line: line + suffix });
    syncHud(true);
  }

  // ---------------------------------------------------------- UI 装配

  const ui = createUI({
    onInsert: () => tryInsert(),
    onPickCredits: (value) => {
      selectedCredits = value;
      save.lastCredits = value;
      saveSave(save);
      playEvent("ui_click");
    },
    onStart: () => {
      unlockAudio();
      startRun();
      playEvent("ui_click");
    },
    onRestart: () => {
      unlockAudio();
      startRun();
      playEvent("ui_click");
    },
    onPause: () => {
      game.togglePause();
      ui.setOverlay(game.isPaused ? "pause" : "none");
    },
    onResume: () => {
      game.isPaused = false;
      ui.setOverlay("none");
      playEvent("pause_toggled", { isPaused: false });
    },
    onAgain: () => {
      unlockAudio();
      startRun();
      playEvent("ui_click");
    },
    onBackMenu: () => {
      resultShown = false;
      openMenu();
      playEvent("ui_click");
    },
    onOpenHelp: () => {
      ui.setOverlay("help");
      playEvent("ui_click");
    },
    onCloseHelp: () => {
      ui.setOverlay(resultShown ? "result" : game.state.status === STATUS.READY ? "menu" : "none");
      playEvent("ui_click");
    },
    onToggleSound: () => {
      save.sound = !save.sound;
      setAudioEnabled(save.sound);
      ui.setSound(save.sound);
      saveSave(save);
      if (save.sound) {
        unlockAudio();
        playEvent("ui_click");
      }
    },
    onToggleLang: () => {
      lang = lang === "zh" ? "en" : "zh";
      saveLocale(lang);
      ui.applyLocale(lang);
      ui.setSound(save.sound);
      syncHud(true);
      playEvent("ui_click");
    },
    onResetSave: () => {
      const now = Date.now();
      if (now - resetPending < 3200) {
        resetPending = 0;
        clearSave();
        save = loadSave();
        selectedCredits = save.lastCredits;
        setAudioEnabled(save.sound);
        ui.setSound(save.sound);
        ui.setCreditOptions(CREDIT_OPTIONS, selectedCredits);
        syncHud(true);
        ui.toast("saveCleared");
      } else {
        resetPending = now;
        ui.toast("saveResetConfirm", {}, true);
      }
      playEvent("ui_click");
    }
  });

  function unlockAudio() {
    if (audioReady) return;
    audioReady = initAudio();
  }

  function tryInsert() {
    if (insertCd > 0) return;
    unlockAudio();
    if (!game.canFire()) {
      playEvent("blocked");
      const out = game.state.credits <= 0;
      ui.toast(out ? "toastBlocked" : "toastPaused", {}, true);
      return;
    }
    if (game.fire()) insertCd = INSERT_COOLDOWN;
  }

  function syncHud(force = false) {
    const payload = hudPayload();
    const key = [
      payload.credits, payload.score, payload.mult, payload.cascade,
      payload.effects.double > 0, payload.effects.speed > 0, payload.effects.magnet > 0,
      payload.bestScore, payload.bestCascade, payload.bestDrops, payload.runs,
      payload.canInsert, lang
    ].join("|");
    if (!force && key === hudKey) return;
    hudKey = key;
    ui.renderHud(payload);
  }

  function beginRun() {
    resultShown = false;
    finishTimer = 0;
    insertCd = 0;
    game.isPaused = false;
    renderer.reset();
    ui.clearDrops();
    ui.setOverlay("none");
    prevPhase = game.state.pusherPhase;
    syncHud(true);
  }

  function startRun() {
    game.start(selectedCredits);
    beginRun();
  }

  function openMenu() {
    // 主菜单背后展示一台静置的新机台（READY 不推进物理）
    game.start(selectedCredits);
    game.isPaused = false;
    renderer.reset();
    ui.clearDrops();
    prevPhase = game.state.pusherPhase;
    ui.setCreditOptions(CREDIT_OPTIONS, selectedCredits);
    syncHud(true);
    ui.setOverlay("menu");
  }

  // ---------------------------------------------------------- 键盘

  function onKeyDown(event) {
    switch (event.key) {
      case " ":
        event.preventDefault();
        tryInsert();
        break;
      case "r": case "R":
        event.preventDefault();
        tryInsert();
        break;
      case "Enter":
        if (ui.currentOverlay() === "menu") {
          unlockAudio();
          startRun();
        } else if (ui.currentOverlay() === "result") {
          unlockAudio();
          startRun();
        }
        break;
      case "p": case "P": {
        if (event.repeat) break;
        game.togglePause();
        ui.setOverlay(game.isPaused ? "pause" : "none");
        break;
      }
      default: break;
    }
  }

  globalThis.addEventListener?.("keydown", onKeyDown);

  // 点台面 = 投币（落点仍由挡杆决定，点哪儿都一样）
  canvas.addEventListener("pointerdown", () => {
    if (ui.currentOverlay() === "menu" || ui.currentOverlay() === "help") return;
    tryInsert();
  });

  globalThis.addEventListener?.("resize", () => renderer.resize());
  if (typeof ResizeObserver === "function") new ResizeObserver(() => renderer.resize()).observe(canvas);

  // ---------------------------------------------------------- 主循环

  let last = 0;

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;

    ui.tick(dt);
    if (insertCd > 0) insertCd = Math.max(0, insertCd - dt);

    const state = game.state;
    if (!game.isPaused) {
      // READY 也照常喂给引擎：stepFrame 对非 PLAYING 状态不推进时间与物理，
      // 但它需要这一帧来判断「账户在开局前就被清空」这类死局（否则永远卡在 READY）。
      const wasPlaying = state.status === STATUS.PLAYING;
      const before = state.pusherPhase;
      game.step(dt);
      if (wasPlaying) {
        const after = game.state.pusherPhase;
        if (after >= 0.5 && before < 0.5) playEvent("pusher_back");
        else if (after < 0.5 && before >= 0.5) playEvent("pusher_forward");
      }
    }

    if (finishTimer > 0) {
      finishTimer -= dt;
      if (finishTimer <= 0) finishRun();
    }

    syncHud();
    document.getElementById("goal-line").textContent = runStatsText(game.state);

    renderer.draw(game.state, { dt: game.isPaused ? 0 : dt, paused: game.isPaused });

    requestAnimationFrame(frame);
  }

  ui.applyLocale(lang);
  ui.setSound(save.sound);
  setAudioEnabled(save.sound);
  ui.setCreditOptions(CREDIT_OPTIONS, selectedCredits);
  syncHud(true);
  ui.setOverlay("menu");
  renderer.resize();
  requestAnimationFrame(frame);

  const handle = {
    get game() { return game; },
    get ui() { return ui; },
    renderer,
    getView: () => renderer.getView(),
    getSave: () => save,
    getSelectedCredits: () => selectedCredits,
    pickCredits: (value) => { selectedCredits = value; ui.setSelectedCredits(value); },
    startRun,
    openMenu,
    tryInsert,
    getLang: () => lang,
    setLang: (next) => { lang = next; saveLocale(next); ui.applyLocale(next); syncHud(true); }
  };
  globalThis.__coinPusher = handle;
  return handle;
}

const handle = typeof document !== "undefined" && document.getElementById("table") ? boot() : null;

export { boot };
export default handle;
