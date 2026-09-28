// main.mjs — 装配入口：绑定事件、驱动固定步长循环、同步 HUD 与面板。

import { createController } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import * as store from "./storage.mjs";
import { strings, loadLocale, saveLocale, htmlLang, format, LOCALES } from "./i18n.mjs";
import { createAudio } from "./audio.mjs";
import { RELICS } from "./relics.mjs";
import { TOTAL_LAYERS, isBossLayer } from "./levels.mjs";
import { PHASES, snapshot, FIELD_W } from "./engine.mjs";

function relicNameKey(id) {
  return `relic${id.charAt(0).toUpperCase() + id.slice(1)}Name`;
}
function relicDescKey(id) {
  return `relic${id.charAt(0).toUpperCase() + id.slice(1)}Desc`;
}

const el = (id) => document.getElementById(id);

const TEXT_IDS = [
  ["back-text", "back"],
  ["app-title-main", "appTitle"],
  ["app-subtitle", "appSubtitle"],
  ["label-layer", "labelLayer"],
  ["label-lives", "labelLives"],
  ["label-combo", "labelCombo"],
  ["label-balls", "labelBalls"],
  ["btn-launch", "btnLaunch"],
  ["btn-retry", "btnRetry"],
  ["key-hint", "keyHint"],
  ["label-relics", "labelRelics"],
  ["label-score", "labelScore"],
  ["label-best", "labelBest"],
  ["label-best-score", "labelBestScore"],
  ["label-best-layer", "labelBestLayer"],
  ["pad-left-label", "padLeft"],
  ["pad-right-label", "padRight"],
  ["pad-launch-label", "padLaunch"],
  ["pad-pause-label", "padPause"],
  ["relic-kicker", "relicKicker"],
  ["relic-title", "relicTitle"],
  ["relic-desc", "relicDesc"],
  ["pause-title", "pauseTitle"],
  ["pause-desc", "pauseDesc"],
  ["btn-resume", "btnResume"],
  ["btn-retry-pause", "btnRetry"],
  ["label-res-score", "labelResScore"],
  ["label-res-layer", "labelResLayer"],
  ["label-res-relics", "labelResRelics"],
  ["label-res-time", "labelResTime"],
  ["btn-retry-result", "btnRetryResult"],
  ["help-title", "helpTitle"],
  ["help1", "help1"],
  ["help2", "help2"],
  ["help3", "help3"],
  ["help4", "help4"],
  ["help5", "help5"],
  ["help6", "help6"],
  ["btn-help-close", "btnHelpClose"],
];

const MODE_CHIPS = [
  ["mode-rogue", "modeRogue"],
  ["mode-endless", "modeEndless"],
  ["mode-daily", "modeDaily"],
];

let locale = loadLocale();
let t = strings(locale);
let save = store.load();
let mode = "rogue";
let toastTimer = 0;

const audio = createAudio();
const canvas = el("stage-canvas");
const reducedQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
const renderer = createRenderer(canvas, { reducedMotion: reducedQuery?.matches ?? false });

const controller = createController({ mode });
const input = { left: false, right: false };
let pointerTarget = null;

/* ------------------------------------------------------------ 文案 */

function applyText() {
  t = strings(locale);
  for (const [id, key] of TEXT_IDS) {
    const node = el(id);
    if (node) node.textContent = t[key];
  }
  for (const [id, key] of MODE_CHIPS) {
    const node = el(id);
    if (node) node.textContent = t[key];
  }
  document.title = t.docTitle;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", t.metaDesc);
  document.documentElement.lang = htmlLang(locale);
  el("btn-lang").textContent = t.langSwitch;
  el("btn-sound").setAttribute("aria-label", save.prefs.muted ? t.soundOff : t.soundOn);
  el("btn-help").setAttribute("aria-label", t.help);
  el("stage-canvas").setAttribute("aria-label", t.canvasAria);
  el("btn-sound").querySelector(".bar-glyph").textContent = save.prefs.muted ? "🔇" : "🔊";
  // 核心图鉴刷新
  syncRelicGrid();
}

/* ------------------------------------------------------------ 面板 */

function openPanel(id) {
  el(id).classList.add("is-open");
}

function closePanel(id) {
  el(id).classList.remove("is-open");
}

function closeAllPanels() {
  for (const id of ["panel-relic", "panel-pause", "panel-result", "panel-help"]) closePanel(id);
}

function toast(text) {
  const node = el("toast");
  node.textContent = text;
  node.classList.add("is-on");
  toastTimer = 2.0;
}

function showRelicChoices() {
  const container = el("relic-choices");
  container.innerHTML = "";
  const choices = controller.state.relicChoices || [];
  for (const id of choices) {
    const relic = RELICS[id];
    if (!relic) continue;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "relic-card";
    card.style.setProperty("--relic-color", relic.color);
    card.innerHTML = `
      <span class="relic-glyph">${relic.glyph}</span>
      <span class="relic-name">${t[relicNameKey(id)] || id}</span>
      <span class="relic-desc">${t[relicDescKey(id)] || ""}</span>
    `;
    card.addEventListener("click", () => {
      controller.pickRelic(id);
    });
    container.append(card);
  }
  openPanel("panel-relic");
}

function showResult(result) {
  el("result-title").textContent = result?.won ? t.resultTitleWin : t.resultTitleLose;
  el("res-score").textContent = String(result?.score ?? 0);
  el("res-layer").textContent = String(result?.layer ?? 1);
  el("res-relics").textContent = String(result?.relics ?? 0);
  el("res-time").textContent = format(t.timeValue, { n: (result?.time ?? 0).toFixed(1) });
  el("result-hint").textContent = result?.won ? t.resultHintWin : t.resultHintLose;
  openPanel("panel-result");
}

/* ------------------------------------------------------------ HUD */

const lastHud = {};

function setText(id, value) {
  if (lastHud[id] === value) return;
  lastHud[id] = value;
  const node = el(id);
  if (node) node.textContent = value;
}

function syncRelicGrid() {
  const grid = el("relic-grid");
  grid.innerHTML = "";
  for (const id of controller.state.relics) {
    const relic = RELICS[id];
    if (!relic) continue;
    const cell = document.createElement("span");
    cell.className = "relic-chip";
    cell.style.setProperty("--relic-color", relic.color);
    cell.textContent = relic.glyph;
    cell.title = t[relicNameKey(id)] || id;
    grid.append(cell);
  }
}

function syncHud() {
  const state = controller.state;
  setText("val-layer", format(t.layerValue || "{n} / {max}", { n: state.layer, max: TOTAL_LAYERS }));
  setText("val-combo", `×${Math.max(1, Math.floor(state.combo / 10) + 1)}`);
  setText("val-balls", String(state.balls.length));
  setText("val-score", String(state.score));
  setText("val-best-score", String(save.progress.bestScore));
  setText("val-best-layer", String(save.progress.bestLayer));

  // 生命格
  const cells = el("life-cells");
  if (cells.children.length !== 3) {
    cells.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const cell = document.createElement("i");
      cell.className = "life-cell";
      cells.append(cell);
    }
  }
  for (let i = 0; i < cells.children.length; i += 1) {
    cells.children[i].classList.toggle("is-on", i < state.lives);
  }
}

/* ------------------------------------------------------------ 输入 */

const keyMap = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

function onKey(event) {
  const held = event.type === "keydown";
  if (held) audio.unlock();
  const action = keyMap[event.code];
  if (action) {
    event.preventDefault();
    input[action] = held;
    if (held) pointerTarget = null; // 键盘接管，清除指针目标
    return;
  }
  if (!held) return;
  if (event.code === "Space") {
    event.preventDefault();
    if (controller.phase() === PHASES.ready) controller.launch();
  } else if (event.code === "KeyP" || event.code === "Escape") {
    event.preventDefault();
    togglePause();
  } else if (event.code === "KeyR") {
    event.preventDefault();
    restartRun();
  }
}

function canvasScale() {
  const rect = canvas.getBoundingClientRect();
  return rect.width > 0 ? FIELD_W / rect.width : 1;
}

function bindPointer() {
  canvas.addEventListener("pointerdown", (event) => {
    audio.unlock();
    canvas.setPointerCapture(event.pointerId);
    pointerTarget = controller.state.paddle.x;
    canvas.dataset.dragX = String(event.clientX);
    // 点击发球
    if (controller.phase() === PHASES.ready) {
      controller.launch();
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!canvas.dataset.dragX) return;
    const prev = Number(canvas.dataset.dragX);
    const delta = (event.clientX - prev) * canvasScale();
    canvas.dataset.dragX = String(event.clientX);
    if (pointerTarget === null) pointerTarget = controller.state.paddle.x;
    pointerTarget = Math.max(6, Math.min(FIELD_W - 6, pointerTarget + delta));
  });
  const end = () => {
    delete canvas.dataset.dragX;
    pointerTarget = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);
}

function bindPad() {
  for (const button of document.querySelectorAll("[data-hold]")) {
    const action = button.dataset.hold;
    const down = (event) => {
      event.preventDefault();
      audio.unlock();
      button.classList.add("is-held");
      input[action] = true;
    };
    const up = () => {
      button.classList.remove("is-held");
      input[action] = false;
    };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointerleave", up);
    button.addEventListener("pointercancel", up);
  }
  el("pad-launch").addEventListener("click", () => {
    if (controller.phase() === PHASES.ready) controller.launch();
  });
}

function togglePause() {
  if (controller.isTerminal()) return;
  if (controller.phase() === PHASES.relic) return;
  if (controller.paused) {
    controller.resume();
    closePanel("panel-pause");
  } else if (controller.pause()) {
    openPanel("panel-pause");
  }
}

function restartRun() {
  controller.restart(mode);
  renderer.clear();
  closeAllPanels();
  syncHud();
  syncRelicGrid();
  audio.play("ui");
}

/* ------------------------------------------------------------ 事件 */

controller.on((type, payload) => {
  renderer.handleEvent(payload ?? { type });
  switch (type) {
    case "wallHit":
      audio.play("wallHit");
      break;
    case "paddleHit":
      audio.play("paddleHit");
      break;
    case "paddleCatch":
      audio.play("paddleCatch");
      break;
    case "brickHit":
      audio.play("brickHit", payload);
      break;
    case "brickBreak":
      audio.play("brickBreak", payload);
      break;
    case "steelHit":
      audio.play("steelHit");
      break;
    case "explosion":
      audio.play("explosion");
      break;
    case "multiball":
      audio.play("multiball");
      break;
    case "bossHit":
      audio.play("bossHit");
      break;
    case "bossDown":
      audio.play("bossDown");
      break;
    case "shieldSave":
      audio.play("shieldSave");
      toast(t.toastShield);
      break;
    case "lifeLost":
      audio.play("lifeLost");
      break;
    case "layerClear":
      audio.play("layerClear");
      break;
    case "relicPicked":
      audio.play("relicPicked");
      syncRelicGrid();
      closePanel("panel-relic");
      break;
    case "gameWin":
      audio.play("gameWin");
      break;
    case "gameOver":
      audio.play("gameOver");
      break;
    case "layerStart":
      if (payload?.boss) toast(t.toastBoss);
      break;
    default:
      break;
  }
});

controller.on((type, payload) => {
  if (type !== "terminal") return;
  const applied = store.applyResult(save, payload.result);
  save = applied.state;
  syncHud();
  showResult(payload.result);
});

// 核心选择面板由 relic phase 触发
controller.on((type) => {
  if (type === "layerClear") {
    showRelicChoices();
  }
});

/* ------------------------------------------------------------ 循环 */

let lastTime = 0;

function loop(now) {
  const dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0;
  lastTime = now;

  if (pointerTarget !== null) {
    const diff = pointerTarget - controller.state.paddle.x;
    input.left = diff < -3;
    input.right = diff > 3;
  }

  if (!controller.paused && !controller.isTerminal()) {
    controller.frame(dt, input);
  }
  renderer.draw(controller.state, dt);

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) el("toast").classList.remove("is-on");
  }
  syncHud();
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------ 装配 */

function bindUi() {
  el("btn-sound").addEventListener("click", () => {
    save = store.setMuted(save, !save.prefs.muted);
    audio.setMuted(save.prefs.muted);
    applyText();
    audio.play("ui");
  });

  el("btn-lang").addEventListener("click", () => {
    locale = locale === "zh" ? "en" : "zh";
    saveLocale(locale);
    applyText();
    syncHud();
    audio.play("ui");
  });

  el("btn-help").addEventListener("click", () => openPanel("panel-help"));
  el("btn-help-close").addEventListener("click", () => closePanel("panel-help"));

  for (const [id] of MODE_CHIPS) {
    el(id).addEventListener("click", () => {
      mode = el(id).dataset.mode;
      for (const [otherId] of MODE_CHIPS) {
        el(otherId).classList.toggle("is-active", otherId === id);
        el(otherId).setAttribute("aria-selected", String(otherId === id));
      }
      restartRun();
      audio.play("ui");
    });
  }

  el("btn-launch").addEventListener("click", () => {
    if (controller.phase() === PHASES.ready) controller.launch();
  });
  el("btn-retry").addEventListener("click", restartRun);
  el("btn-resume").addEventListener("click", togglePause);
  el("btn-retry-pause").addEventListener("click", restartRun);
  el("btn-retry-result").addEventListener("click", restartRun);
  el("pad-pause").addEventListener("click", togglePause);

  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("resize", () => renderer.resize());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !controller.isTerminal() && !controller.paused && controller.phase() !== PHASES.relic) {
      controller.pause();
      openPanel("panel-pause");
    }
  });
  if (reducedQuery?.addEventListener) {
    reducedQuery.addEventListener("change", (event) => renderer.setReducedMotion(event.matches));
  }
}

applyText();
bindUi();
bindPointer();
bindPad();
audio.setMuted(save.prefs.muted);
syncHud();
syncRelicGrid();
requestAnimationFrame(loop);

window.__breakout = {
  controller,
  snapshot: () => snapshot(controller.state),
  locale: () => locale,
  locales: () => LOCALES.slice(),
  particles: () => renderer.particleCount(),
};
