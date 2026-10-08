// main.mjs —— 装配入口：绑定事件、驱动主循环、协调 game/ui/store/i18n/audio。
// 语言切换走原地热更新，严禁 location.reload()。
import { createGame } from "./game.mjs";
import { createUi } from "./ui.mjs";
import * as store from "./storage.mjs";
import * as i18n from "./i18n.mjs";
import * as audio from "./audio.mjs";
import { LEVEL_COUNT } from "./levels.mjs";

const game = createGame();
let save = store.load();
let locale = i18n.loadLocale();
let currentMode = null;
let currentLevelId = null;

function str() { return i18n.strings(locale); }

const ui = createUi({
  onMode: (mode) => {
    if (mode === "survival") startSurvival();
    else if (mode === "duel") startDuel();
  },
  onLevelPick: (id) => startCampaign(id),
  onPlace: (q, r) => handlePlace(q, r),
  onRotate: (dir) => { game.rotate(dir); audio.playUi(); },
  onReset: () => restart(),
  onSound: () => toggleSound(),
  onLang: () => toggleLang(),
  onAgain: () => restart(),
  onNext: () => {
    if (currentMode === "campaign" && currentLevelId < LEVEL_COUNT) startCampaign(currentLevelId + 1);
  },
});

function startSurvival() {
  currentMode = "survival";
  currentLevelId = null;
  game.startSurvival();
  ui.hideAllOverlays();
  audio.unlock();
}

function startDuel() {
  currentMode = "duel";
  currentLevelId = null;
  game.startDuel();
  ui.hideAllOverlays();
  audio.unlock();
}

function startCampaign(id) {
  currentMode = "campaign";
  currentLevelId = id;
  game.startCampaign(id);
  save = store.setLast(save, id);
  ui.hideAllOverlays();
  audio.unlock();
}

function restart() {
  if (currentMode === "survival") startSurvival();
  else if (currentMode === "duel") startDuel();
  else if (currentMode === "campaign") startCampaign(currentLevelId ?? save.last ?? 1);
}

function handlePlace(q, r) {
  const view = game.view();
  if (!view || view.gameOver) return;
  audio.unlock();
  const res = game.place(q, r);
  if (!res.ok) {
    audio.playReject();
    ui.toast(str().toastNoPlace);
    return;
  }
  audio.playPlace();
  if (res.rowsCleared > 0) {
    audio.playClear(res.rowsCleared);
    audio.playPop(res.rowsCleared);
    if (res.rushTriggered) {
      audio.playRush();
      ui.toast(str().toastRush);
    }
    if (res.scoreGain >= 100 * 2 ** 18 * res.rowsCleared) {
      audio.playRoyal();
      ui.toast(str().toastRoyal);
    }
  }
}

// ------------------------------------------------------------ 声音 / 语言

function toggleSound() {
  const muted = !save.muted;
  save = store.setMuted(save, muted);
  audio.setMuted(muted);
  ui.setSoundIcon(muted);
  if (!muted) audio.playUi();
}

function toggleLang() {
  locale = locale === "zh" ? "en" : "zh";
  i18n.saveLocale(locale);
  ui.applyStrings(locale, i18n.strings(locale), { docLang: i18n.htmlLang(locale) });
  audio.playUi();
  renderNow();
}

// ------------------------------------------------------------ 主循环

let lastTime = 0;
function renderNow() { ui.render(game.view()); }

function frame(now) {
  const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0.016);
  lastTime = now;
  game.tick(dt);
  ui.render(game.view());
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ 事件订阅

game.on((type, payload) => {
  if (type === "end") {
    const result = payload.result ?? game.result();
    if (result.mode === "campaign" && result.goalMet) {
      const rec = store.recordLevel(save, result.levelId, { stars: result.stars, cleared: true });
      save = rec.data;
      audio.playWin();
    } else if (result.mode === "survival") {
      store.recordSurvival(save, result.score);
      audio.playLose();
    } else {
      audio.playWin();
    }
    setTimeout(() => ui.showResult(result), 400);
  } else if (type === "clear") {
    if (payload.rushTriggered) {
      // rush 音效已在 handlePlace 播放
    }
  }
});

// ------------------------------------------------------------ 键盘

window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key;
  if (key === "r" || key === "R") { game.rotate(1); audio.playUi(); e.preventDefault(); return; }
  if (key === "Escape") { ui.hideAllOverlays(); e.preventDefault(); return; }
});

// ------------------------------------------------------------ 启动

function boot() {
  ui.syncSize();
  ui.applyStrings(locale, str(), { docLang: i18n.htmlLang(locale) });
  audio.setMuted(save.muted);
  ui.setSoundIcon(save.muted);
  ui.showReady();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => ui.syncSize());
boot();

window.__hexfit = {
  view: () => game.view(),
  diagnose: () => game.diagnose(),
  startCampaign: (id, seed) => game.startCampaign(id, seed),
  startSurvival: (seed) => game.startSurvival(seed),
  startDuel: (seed) => game.startDuel(seed),
  place: (q, r) => game.place(q, r),
  rotate: (d) => game.rotate(d),
  tick: (dt) => game.tick(dt),
  save: () => store.load(),
};
