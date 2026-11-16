// main.mjs —— 装配入口：绑定事件、驱动固定步长主循环、协调 game/ui/store/i18n/audio。
// 语言切换走原地热更新（i18n.saveLocale + applyStrings + 当帧重绘），严禁 location.reload()。

import { createGame } from "./game.mjs";
import { createUi } from "./ui.mjs";
import * as store from "./storage.mjs";
import * as i18n from "./i18n.mjs";
import * as audio from "./audio.mjs";
import { TURN, GRID, rowOf, colOf } from "./engine.mjs";
import { LEVEL_COUNT } from "./levels.mjs";

const game = createGame();
let save = store.load();
let locale = i18n.loadLocale();

let selectedCell = null;
let currentMode = null; // "duel" | "hunt" | "practice"
let currentLevelId = null;
let lastTurn = null;
let lastTime = 0;

function str() {
  return i18n.strings(locale);
}

const ui = createUi({
  onMode: (mode) => {
    if (mode === "duel") startDuel();
    else if (mode === "practice") startPractice();
    else if (mode === "hunt") openLevels();
  },
  onBack: () => {
    ui.hideAllOverlays();
    ui.showReady();
    audio.playUi();
  },
  onSound: () => toggleSound(),
  onLang: () => toggleLang(),
  onLevels: () => openLevels(),
  onLevelPick: (id) => startHunt(id),
  onCell: (cell) => handleCell(cell),
  onColorPick: (target) => setColor(target),
  onRefine: () => refine(),
  onScanButton: () => scanSelected(),
  onAccuseButton: () => accuseSelected(),
  onPass: () => pass(),
  onAgain: () => restart(),
  onNext: () => {
    if (currentMode === "hunt" && currentLevelId < LEVEL_COUNT) startHunt(currentLevelId + 1);
  },
});

function startDuel() {
  currentMode = "duel";
  selectedCell = null;
  game.startDuel();
  ui.hideAllOverlays();
  audio.unlock();
}

function startPractice() {
  currentMode = "practice";
  selectedCell = null;
  game.startPractice();
  ui.hideAllOverlays();
  audio.unlock();
}

function startHunt(id) {
  currentMode = "hunt";
  currentLevelId = id;
  selectedCell = null;
  game.startHunt(id);
  save = store.setLast(save, id);
  ui.hideAllOverlays();
  audio.unlock();
}

function restart() {
  if (currentMode === "duel") startDuel();
  else if (currentMode === "practice") startPractice();
  else if (currentMode === "hunt") startHunt(currentLevelId ?? save.last ?? 1);
}

function openLevels() {
  ui.buildLevels(save, (id) => store.isUnlocked(save, id));
  ui.showLevels();
}

// ---------------------------------------------------------------- 玩家意图

function dirTo(from, to) {
  const fr = rowOf(from);
  const fc = colOf(from);
  const tr = rowOf(to);
  const tc = colOf(to);
  if (tr === fr - 1 && tc === fc) return 0; // up
  if (tc === fc + 1 && tr === fr) return 1; // right
  if (tr === fr + 1 && tc === fc) return 2; // down
  if (tc === fc - 1 && tr === fr) return 3; // left
  return null;
}

function dirToColor(from, to) {
  const diff = (((to - from) % GRID) + GRID) % GRID;
  return diff <= 2 ? 1 : -1;
}

function handleCell(cell) {
  const view = game.view();
  if (!view) return;
  audio.unlock();
  if (view.canChameleonAct) {
    if (cell === view.chameleonCell) {
      refine();
    } else {
      const dir = dirTo(view.chameleonCell, cell);
      if (dir != null) {
        const r = game.move(dir);
        if (r.ok) audio.playMove();
        else audio.playReject();
      }
    }
  } else if (view.canHunterAct) {
    if (selectedCell === cell) {
      accuse(cell);
    } else {
      scan(cell);
    }
  }
}

function setColor(target) {
  const view = game.view();
  if (!view || !view.canChameleonAct) return;
  let cur = view.chameleonColor;
  let guard = 0;
  while (cur !== target && guard < 3) {
    const dir = dirToColor(cur, target);
    game.recolor(dir);
    cur = (((cur + dir) % GRID) + GRID) % GRID;
    guard += 1;
  }
  audio.unlock();
  audio.playRecolor();
}

function refine() {
  const r = game.refine();
  if (r.ok) {
    audio.unlock();
    audio.playRefine();
  } else {
    audio.playReject();
  }
}

function scan(cell) {
  const r = game.scan(cell);
  if (!r) {
    ui.toast(str().toastOutOfProbes);
    audio.playReject();
    return;
  }
  selectedCell = cell;
  audio.playScan(r.heat);
  ui.el.heatReadout.textContent = i18n.format(str().toastScan, { n: Math.round(r.heat) });
  ui.el.heatReadout.classList.remove("hidden");
  renderNow();
}

function accuse(cell) {
  const r = game.accuse(cell);
  if (!r) {
    ui.toast(str().toastOutOfProbes);
    audio.playReject();
    return;
  }
  selectedCell = null;
  if (r.correct) audio.playCaught();
  else {
    audio.playMiss();
    ui.toast(str().toastWrong);
  }
}

function scanSelected() {
  const view = game.view();
  if (!view || !view.canHunterAct) return;
  if (selectedCell == null) selectedCell = 12;
  scan(selectedCell);
}

function accuseSelected() {
  const view = game.view();
  if (!view || !view.canHunterAct) return;
  if (selectedCell == null) {
    ui.toast(str().toastNoProbe);
    audio.playReject();
    return;
  }
  accuse(selectedCell);
}

function pass() {
  const r = game.pass();
  if (r) {
    selectedCell = null;
    audio.unlock();
    audio.playUi();
  }
}

// ---------------------------------------------------------------- 声音 / 语言

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

// ---------------------------------------------------------------- 主循环

function renderNow() {
  ui.render(game.view(), { selectedCell });
  const view = game.view();
  if (view) {
    ui.el.heatReadout.classList.toggle("hidden", view.turn !== TURN.OBSERVE);
  }
}

function frame(now) {
  const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0.016);
  lastTime = now;
  game.tick(dt);

  const view = game.view();
  if (view) {
    if (view.turn === TURN.CAMO && lastTurn !== TURN.CAMO) audio.playCurtain();
    if (view.turn === TURN.OBSERVE && lastTurn === TURN.CAMO) {
      audio.playPulse();
      audio.playRipple();
    }
    if (view.turn !== TURN.OBSERVE) selectedCell = null;
    lastTurn = view.turn;
    ui.render(view, { selectedCell });
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- 事件订阅

game.on((type, payload) => {
  if (type === "end") {
    const result = payload.result ?? game.result();
    if (result?.mode === "hunt" && result.caught) {
      const rec = store.recordLevel(save, result.levelId, { stars: result.stars, caught: true });
      save = rec.data;
    }
    setTimeout(() => ui.showResult(result, game.view()), 560);
  } else if (type === "swap") {
    selectedCell = null;
    ui.toast(str().roleSwap);
  } else if (type === "sudden") {
    selectedCell = null;
    ui.toast(str().hudSudden);
  }
});

// ---------------------------------------------------------------- 键盘

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;
  const view = game.view();
  if (!view) return;

  if (view.canChameleonAct) {
    const dir = key === "ArrowUp" || key === "w" || key === "W" ? 0
      : key === "ArrowRight" || key === "d" || key === "D" ? 1
      : key === "ArrowDown" || key === "s" || key === "S" ? 2
      : key === "ArrowLeft" || key === "a" || key === "A" ? 3
      : null;
    if (dir != null) {
      const r = game.move(dir);
      if (r.ok) audio.playMove();
      event.preventDefault();
      return;
    }
    if (/^[1-5]$/.test(key)) {
      setColor(Number(key) - 1);
      event.preventDefault();
      return;
    }
    if (key === " ") {
      refine();
      event.preventDefault();
      return;
    }
  } else if (view.canHunterAct) {
    if (key === "Escape") {
      pass();
      event.preventDefault();
      return;
    }
    const dir = key === "ArrowUp" ? 0 : key === "ArrowRight" ? 1 : key === "ArrowDown" ? 2 : key === "ArrowLeft" ? 3 : null;
    if (dir != null) {
      moveCursor(dir);
      event.preventDefault();
      return;
    }
    if (key === " ") {
      scanSelected();
      event.preventDefault();
      return;
    }
    if (key === "Enter") {
      accuseSelected();
      event.preventDefault();
      return;
    }
  }

  if (key === "Escape") {
    ui.hideAllOverlays();
    renderNow();
  }
});

function moveCursor(dir) {
  const c = selectedCell == null ? 12 : selectedCell;
  const r = rowOf(c);
  const col = colOf(c);
  let nr = r;
  let nc = col;
  if (dir === 0) nr -= 1;
  else if (dir === 1) nc += 1;
  else if (dir === 2) nr += 1;
  else nc -= 1;
  if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) return;
  selectedCell = nr * GRID + nc;
}

// ---------------------------------------------------------------- 启动

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

// 只读诊断出口：验收脚本读真值用（含隐藏变色龙格与颜色），UI 不展示
window.__chameleon = {
  view: () => game.view(),
  diagnose: () => game.diagnose(),
  startDuel: (seed) => game.startDuel(seed),
  startHunt: (id, seed) => game.startHunt(id, seed),
  move: (dir) => game.move(dir),
  recolor: (dir) => game.recolor(dir),
  refine: () => game.refine(),
  scan: (cell) => game.scan(cell),
  accuse: (cell) => game.accuse(cell),
  pass: () => game.pass(),
  tick: (dt) => game.tick(dt),
  save: () => store.load(),
};