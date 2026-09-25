// main：装配入口。把引擎、计分、存档、音效、渲染、UI 接到一起；规则一律不在这里判断。
// 物理用固定步长累加器（帧率无关、可复现）；指针 / 键盘 / 按钮三通；事件 → 音效 / 特效 / HUD。

import {
  AIM_STEP,
  FIXED_DT,
  MAX_LEVEL,
  STATUS,
  dailySeed,
  isRunning,
  mulberry32,
  popTargetAt,
} from "./engine.mjs?v=79c518024932";
import { advanceFrame, createGame, dispatch, snapshot } from "./game.mjs?v=79c518024932";
import { createRenderer } from "./render.mjs?v=79c518024932";
import { createAudio } from "./audio.mjs?v=79c518024932";
import { mountUI } from "./ui.mjs?v=79c518024932";
import * as storage from "./storage.mjs?v=79c518024932";
import { format, htmlLang, loadLocale, saveLocale, strings } from "./i18n.mjs?v=79c518024932";

// —— i18n：全站共享 doin.lang ——
const locale = loadLocale();
const t = strings(locale);
document.documentElement.lang = htmlLang(locale);
document.title = t.docTitle;
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute("content", t.metaDesc);

// —— 存档 / 音效 / 渲染 / UI ——
let persist = storage.load();
const audio = createAudio({ muted: !persist.sound });
const canvas = document.getElementById("game-canvas");
const renderer = createRenderer(canvas);
const ui = mountUI(t);

const reduceQuery =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const prefersReduced = () => !!(reduceQuery && reduceQuery.matches);

let mode = "endless";
let game = null;

function todayKey() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function seedForMode(m) {
  if (m === "daily") return dailySeed(todayKey());
  return (Math.random() * 0xffffffff) >>> 0;
}

function bestFor(m) {
  if (m === "daily") {
    return persist.daily.date === todayKey()
      ? { best: persist.daily.best, bestLevel: persist.daily.maxLevel }
      : { best: 0, bestLevel: 0 };
  }
  return { best: persist.endless.best, bestLevel: persist.endless.maxLevel };
}

function syncHud() {
  const info = bestFor(mode);
  ui.renderHud(game.state, info);
}

// 开新一局：按模式定种子（每日固定、无尽随机），重置特效与 HUD。autostart 决定是否直接进入对局。
function beginRound(m, autostart) {
  mode = m === "daily" ? "daily" : "endless";
  const seed = seedForMode(mode);
  game = createGame({}, { rng: mulberry32(seed), mode, seed });
  renderer.clearFx();
  ui.setDanger(false);
  ui.setModeTabs(mode, false);
  ui.hideModals();
  syncHud();
  ui.renderCodex(game.state);
  ui.renderPreview(game.state);
  if (autostart) {
    send({ type: "start" });
  } else {
    ui.showReady(true);
  }
}

function send(intent) {
  const result = dispatch(game, intent);
  handleEvents(result.events);
  return result;
}

function persistRound(info) {
  const res = storage.recordResult(persist, {
    kind: info.mode === "daily" ? "daily" : "endless",
    score: info.score,
    maxLevel: info.maxLevel,
    maxChain: info.maxChain,
    date: todayKey(),
  });
  persist = res.data;
  storage.save(persist);
  return res.isNewBest;
}

function handleEvents(events) {
  for (const event of events) {
    switch (event.type) {
      case "start":
        ui.hideModals();
        ui.setModeTabs(mode, true);
        ui.setPauseLabel(false);
        syncHud();
        break;
      case "paused":
        ui.showPause(true);
        ui.setPauseLabel(true);
        break;
      case "resumed":
        ui.showPause(false);
        ui.setPauseLabel(false);
        break;
      case "drop":
        audio.drop();
        renderer.ripple(event.x, event.y, event.level);
        ui.renderPreview(game.state);
        break;
      case "merge": {
        audio.merge(event.level);
        renderer.ripple(event.x, event.y, event.level);
        renderer.setShake(Math.min(9, 2 + event.level * 0.7));
        if (event.chainIndex > 0) {
          audio.chain(event.chainIndex);
          renderer.splash(event.x, event.y, event.level);
        }
        ui.vibrate(12 + event.level);
        syncHud();
        ui.renderCodex(game.state);
        break;
      }
      case "pop":
        audio.pop();
        renderer.burst(event.x, event.y, MAX_LEVEL);
        renderer.setShake(13);
        ui.vibrate([18, 40, 18]);
        syncHud();
        ui.renderCodex(game.state);
        break;
      case "dangerStart":
        audio.warn();
        ui.setDanger(true);
        break;
      case "dangerEnd":
        ui.setDanger(false);
        break;
      case "roundEnd": {
        audio.over();
        ui.setDanger(false);
        ui.setModeTabs(mode, false);
        const isNewBest = persistRound(event);
        const info = bestFor(event.mode);
        const tip =
          event.mode === "daily"
            ? format(t.resultTipDaily, { date: todayKey() })
            : t.resultTipEndless;
        ui.showResult(game.state, { best: info.best, isNewBest, tip });
        break;
      }
      case "deny":
        if (event.reason === "blocked" || event.reason === "full") ui.toast(t.toastBlocked);
        else if (event.reason === "noPop") ui.toast(t.toastNoPop);
        else if (event.reason === "cooldown") ui.toast(t.toastCooldown);
        break;
      default:
        break;
    }
  }
}

// —— 指针：移动瞄准，松手时命中 L10 则戳破，否则在落点丢弃 ——
let aiming = false;

function aimFromEvent(e) {
  const p = renderer.toWorld(e.clientX, e.clientY);
  send({ type: "aim", x: p.x });
}

canvas.addEventListener("pointerdown", (e) => {
  audio.unlock();
  if (!isRunning(game.state)) return;
  aiming = true;
  canvas.setPointerCapture?.(e.pointerId);
  aimFromEvent(e);
});

canvas.addEventListener("pointermove", (e) => {
  if (!isRunning(game.state)) return;
  if (aiming || e.pointerType === "mouse") aimFromEvent(e);
});

canvas.addEventListener("pointerup", (e) => {
  if (!isRunning(game.state)) {
    aiming = false;
    return;
  }
  const p = renderer.toWorld(e.clientX, e.clientY);
  aiming = false;
  if (popTargetAt(game.state, p.x, p.y)) {
    send({ type: "pop", x: p.x, y: p.y });
  } else {
    send({ type: "aim", x: p.x });
    send({ type: "drop", x: p.x });
  }
});

canvas.addEventListener("pointercancel", () => {
  aiming = false;
});

// —— 键盘：← → / A D 微调落点，空格 / ↓ / Enter 释放，P 暂停，R 重玩 ——
window.addEventListener("keydown", (e) => {
  const code = e.code;
  if (code === "ArrowLeft" || code === "KeyA") {
    e.preventDefault();
    if (isRunning(game.state)) send({ type: "aim", x: game.state.aimX - AIM_STEP });
    return;
  }
  if (code === "ArrowRight" || code === "KeyD") {
    e.preventDefault();
    if (isRunning(game.state)) send({ type: "aim", x: game.state.aimX + AIM_STEP });
    return;
  }
  if (code === "Space" || code === "ArrowDown" || code === "Enter") {
    e.preventDefault();
    audio.unlock();
    if (game.state.status === STATUS.ready) startGame();
    else if (isRunning(game.state)) send({ type: "drop" });
    return;
  }
  if (code === "KeyP") {
    e.preventDefault();
    if (game.state.status === STATUS.playing) send({ type: "togglePause" });
    return;
  }
  if (code === "KeyR") {
    e.preventDefault();
    beginRound(mode, true);
    return;
  }
  if (code === "Escape") {
    if (!ui.refs.helpModal.hidden) ui.showHelp(false);
    else if (game.state.status === STATUS.playing) send({ type: "togglePause" });
  }
});

// —— 按钮绑定 ——
function startGame() {
  audio.unlock();
  send({ type: "start" });
}

ui.refs.readyStartBtn.addEventListener("click", startGame);
ui.refs.startBtn.addEventListener("click", () => {
  audio.unlock();
  if (game.state.status === STATUS.ready) startGame();
  else beginRound(mode, true);
});
ui.refs.pauseBtn.addEventListener("click", () => {
  if (game.state.status === STATUS.playing) send({ type: "togglePause" });
});
ui.refs.resumeBtn.addEventListener("click", () => send({ type: "resume" }));
ui.refs.restartBtn.addEventListener("click", () => beginRound(mode, true));
ui.refs.resultRestartBtn.addEventListener("click", () => beginRound(mode, true));

ui.refs.modeEndless.addEventListener("click", () => chooseMode("endless"));
ui.refs.modeDaily.addEventListener("click", () => chooseMode("daily"));

function chooseMode(m) {
  audio.unlock();
  if (game.state.status === STATUS.playing) {
    ui.toast(t.toastModeLocked);
    return;
  }
  if (m === mode && game.state.status === STATUS.ready) {
    ui.showReady(true);
    return;
  }
  beginRound(m, false);
}

ui.refs.soundBtn.addEventListener("click", () => {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  persist = storage.setSound(!muted);
  ui.setSoundLabel(muted);
  if (!muted) audio.click();
});

document.getElementById("help-btn").addEventListener("click", () => {
  audio.click();
  ui.showHelp(true);
});
ui.refs.helpCloseBtn.addEventListener("click", () => ui.showHelp(false));

document.getElementById("lang-btn").addEventListener("click", () => {
  saveLocale(locale === "zh" ? "en" : "zh");
  window.location.reload();
});

// —— 主循环：固定步长累加器，渲染每帧一次 ——
let last = typeof performance !== "undefined" ? performance.now() : Date.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (isRunning(game.state)) {
    acc += dt;
    let steps = 0;
    const collected = [];
    while (acc >= FIXED_DT && steps < 10) {
      const r = advanceFrame(game);
      if (r.events.length) collected.push(...r.events);
      acc -= FIXED_DT;
      steps += 1;
    }
    if (steps >= 10) acc = 0; // 追帧保险：极端卡顿时丢弃积压，避免死亡螺旋
    if (collected.length) handleEvents(collected);
  } else {
    acc = 0;
  }

  renderer.draw(game.state, { dt, reduced: prefersReduced() });
  requestAnimationFrame(frame);
}

// —— 启动 ——
beginRound("endless", false);
ui.applyTexts(game.state, { muted: audio.isMuted() });
syncHud();
requestAnimationFrame(frame);

// 端到端测试钩子：仅当 URL 带 ?e2e 时暴露，生产路径不受影响。
if (typeof location !== "undefined" && new URLSearchParams(location.search).has("e2e")) {
  window.__bm = {
    state: () => game.state,
    intent: (intent) => send(intent),
    snapshot: () => snapshot(game),
    begin: (m, auto = true) => beginRound(m, auto),
    step: (n = 1) => {
      for (let i = 0; i < n; i += 1) handleEvents(advanceFrame(game).events);
    },
  };
}
