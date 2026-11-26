// main.mjs —— 装配入口：绑定事件、驱动主循环、协调 game/ui/storage/i18n/audio。
// 语言切换走原地热更新，严禁 location.reload()，严禁重置对局状态。
import { createGame } from "./game.mjs";
import { createUi } from "./ui.mjs";
import * as store from "./storage.mjs";
import * as i18n from "./i18n.mjs";
import * as audio from "./audio.mjs";
import { DEFAULT_DIFFICULTY } from "./difficulty.mjs";

const game = createGame();
let save = store.load();
let locale = i18n.loadLocale();
let currentDifficulty = save.prefs.difficulty ?? DEFAULT_DIFFICULTY;

function str() {
  return i18n.strings(locale);
}

function bestsMap() {
  const out = {};
  for (const [id, rec] of Object.entries(save.best ?? {})) out[id] = rec.bestScore;
  return out;
}

function syncBest() {
  ui.syncBest({ bests: bestsMap(), difficulty: currentDifficulty });
}

const ui = createUi({
  audio,
  strings: str(),
  onPlace: (slot, rotation, row, col) => handlePlace(slot, rotation, row, col),
  onReset: () => restart(),
  onStartDifficulty: (id) => startDifficulty(id),
  onRequestDifficulty: () => ui.showDifficulties(),
  onSound: () => toggleSound(),
  onLang: () => toggleLang(),
});

// ------------------------------------------------------------ 开局 / 重开

function startDifficulty(id) {
  currentDifficulty = id;
  game.startDifficulty(id);
  save = store.setDifficulty(save, id);
  store.save(save);
  syncBest();
  ui.hideOverlays();
  audio.unlock();
}

function restart() {
  game.startDifficulty(currentDifficulty);
  ui.hideOverlays();
  audio.unlock();
}

// ------------------------------------------------------------ 放置反馈

function handlePlace(slot, rotation, row, col) {
  audio.unlock();
  const res = game.place(slot, rotation, row, col);
  if (!res.ok) {
    audio.playReject();
    ui.toast("toastNoPlace");
    return;
  }
  audio.playSnap();
  const view = game.view();
  if (res.rowsCleared > 0) {
    audio.playClear(res.rowsCleared);
    if (res.cross) {
      audio.playCross();
      ui.toast("toastCross");
    }
    if (view.combo >= 2) audio.playCombo(view.combo);
    if (view.combo >= 3) ui.toast("toastCombo", { n: view.combo });
    audio.setAmbientIntensity(view.combo);
  }
  if (res.over) settleEnd();
}

// ------------------------------------------------------------ 终局结算

function settleEnd() {
  const result = game.result();
  if (!result) return;
  const rec = store.recordDifficulty(save, currentDifficulty, {
    score: result.score,
    rows: result.rowsCleared,
    combo: result.maxCombo,
  });
  save = rec.state;
  store.save(save);
  syncBest();
  const isRecord = rec.isBestScore && result.score > 0;
  audio.playOver();
  if (isRecord) audio.playRecord();
  setTimeout(() => ui.showResult(result, { isRecord }), 450);
}

// ------------------------------------------------------------ 声音 / 语言

function toggleSound() {
  const muted = !save.prefs.muted;
  save = store.setMuted(save, muted);
  store.save(save);
  audio.setMuted(muted);
  ui.setSoundIcon(muted);
  if (!muted) audio.playUi();
}

function toggleLang() {
  locale = locale === "zh" ? "en" : "zh";
  i18n.saveLocale(locale);
  applyStaticStrings();
  ui.applyStrings(str());
  renderNow();
  audio.playUi();
}

function applyStaticStrings() {
  const s = str();
  document.documentElement.lang = i18n.htmlLang(locale);
  document.title = s.docTitle;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", s.metaDesc);
  i18n.applyLocale(document, locale);
}

// ------------------------------------------------------------ 主循环

let lastTime = 0;
function renderNow() {
  ui.render(game.view());
}

function frame(now) {
  const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0.016);
  lastTime = now;
  game.tick(dt);
  ui.render(game.view(), dt);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ 事件订阅

game.on((type, payload) => {
  if (type === "end" && !payload?.result) settleEnd();
});

// ------------------------------------------------------------ 首次手势解锁音频

let gestureBound = false;
function bindGestureUnlock() {
  if (gestureBound) return;
  gestureBound = true;
  audio.unlock();
  audio.startAmbient();
}
window.addEventListener("pointerdown", bindGestureUnlock, { once: true });
window.addEventListener("keydown", bindGestureUnlock, { once: true });

// ------------------------------------------------------------ 启动

function boot() {
  ui.syncSize();
  applyStaticStrings();
  audio.setMuted(save.prefs.muted);
  ui.setSoundIcon(save.prefs.muted);
  // 即开即玩（站点铁律）：直接载入存档记忆的难度，无任何前置遮罩
  startDifficulty(currentDifficulty);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => ui.syncSize());
boot();

// 调试句柄（项目硬约定）：game 走 getter，永远拿得到最新控制器
window.__blockblast = {
  get game() {
    return game;
  },
  view: () => game.view(),
  diagnose: () => game.diagnose(),
  result: () => game.result(),
  startDifficulty: (id, seed) => game.startDifficulty(id, seed),
  place: (slot, rotation, row, col) => game.place(slot, rotation, row, col),
  tick: (dt) => game.tick(dt),
  restart: () => restart(),
  save: () => store.load(),
  ui: () => ui.previewState(),
  toast: (key, params) => ui.toast(key, params),
};
