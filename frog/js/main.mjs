// 装配入口：绑定各类事件、启动 rAF 主循环，协调 engine/game/render/ui/storage/i18n。
import { createGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import * as storage from "./storage.mjs";
import * as audio from "./audio.mjs";
import { strings, format, loadLocale, saveLocale, htmlLang } from "./i18n.mjs";
import { LEVEL_COUNT } from "./level.mjs";
import { EV_HOME, EV_FLY, EV_HIT, EV_DROWN } from "./engine.mjs";

const locale = loadLocale();
document.documentElement.lang = htmlLang(locale);
const t = (key, ...args) => format(strings(locale)[key], ...args);

let storageState = storage.load();
audio.setMuted(storageState.prefs.muted);

const game = createGame();
const renderer = createRenderer(document.querySelector("#board"));
const boardFrame = document.querySelector("#board-frame");

const ui = createUI({
  t,
  selectLevel,
  restart,
  next,
  prev,
  toggleSound,
  toggleLang,
  dialogPrimary,
  dir,
});

// 当前关 = 最新解锁关（可回退重打关卡刷星/刷时间）。
let currentLevel = storageState.progress.unlocked;
let shownResult = null;

function startLevel(id) {
  currentLevel = Math.max(1, Math.min(LEVEL_COUNT, id));
  shownResult = null;
  game.start(currentLevel);
  renderer.reset();
  ui.hideOverlay();
  refresh();
}

function refresh() {
  const best = storage.bestFor(storageState, currentLevel);
  ui.refreshHUD({
    state: game.state(),
    score: game.score(),
    levelId: currentLevel,
    best,
  });
}

function selectLevel(id) {
  if (id < 1 || id > LEVEL_COUNT || id > storageState.progress.unlocked) return;
  startLevel(id);
}

function restart() {
  startLevel(currentLevel);
}

function next() {
  if (currentLevel < storageState.progress.unlocked && currentLevel < LEVEL_COUNT) {
    startLevel(currentLevel + 1);
  }
}

function prev() {
  if (currentLevel > 1) startLevel(currentLevel - 1);
}

function dir(d) {
  audio.unlock();
  game.intent(d);
  handleResult();
}

function dialogPrimary() {
  const r = game.result();
  if (r && r.won && currentLevel < LEVEL_COUNT) {
    selectLevel(currentLevel + 1);
  } else {
    restart();
  }
}

function toggleSound() {
  const muted = !storageState.prefs.muted;
  storageState = { ...storageState, prefs: { ...storageState.prefs, muted } };
  storage.save(storageState);
  audio.setMuted(muted);
  ui.setSoundIcon(muted);
}

function toggleLang() {
  saveLocale(locale === "zh" ? "en" : "zh");
  location.reload();
}

function handleResult() {
  const r = game.result();
  if (!r || shownResult === r) return;
  shownResult = r;
  let isRecord = false;
  if (r.won) {
    const res = storage.recordResult(storageState, {
      levelId: currentLevel,
      stars: r.stars,
      timeMs: r.timeMs,
    });
    storageState = res.state;
    isRecord = res.isRecord;
    storage.save(storageState);
    ui.buildLevels(storageState.progress);
    audio.sfx.win();
    if (isRecord) audio.sfx.record();
  } else {
    audio.sfx.lose();
  }
  ui.showResult({
    won: r.won,
    stars: r.stars,
    timeMs: r.timeMs,
    score: r.score,
    isRecord,
  });
}

// 游戏事件 → 音效
game.bindEvents((event) => {
  switch (event) {
    case "hop":
      audio.sfx.hop();
      break;
    case EV_HOME:
      audio.sfx.home();
      break;
    case EV_FLY:
      audio.sfx.fly();
      break;
    case EV_HIT:
      audio.sfx.hit();
      break;
    case EV_DROWN:
      audio.sfx.drown();
      break;
    default:
      break;
  }
});

// 键盘
window.addEventListener("keydown", (e) => {
  const k = e.key;
  let d = null;
  if (k === "ArrowUp" || k === "w" || k === "W") d = "up";
  else if (k === "ArrowDown" || k === "s" || k === "S") d = "down";
  else if (k === "ArrowLeft" || k === "a" || k === "A") d = "left";
  else if (k === "ArrowRight" || k === "d" || k === "D") d = "right";
  else if (k === "r" || k === "R") { restart(); return; }
  else if (k === "Escape") { ui.hideOverlay(); return; }
  if (d) {
    e.preventDefault();
    dir(d);
  }
});

// 阻止方向键滚动页面
window.addEventListener("keyup", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
});

// 主循环
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.tick(dt);
  handleResult();
  renderer.draw(game.state());
  refresh();
  requestAnimationFrame(loop);
}

function resize() {
  renderer.resize(boardFrame.clientWidth, boardFrame.clientHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 50));

// 初始装配
ui.buildLevels(storageState.progress);
ui.setSoundIcon(storageState.prefs.muted);
startLevel(storageState.progress.unlocked);
resize();
requestAnimationFrame(loop);