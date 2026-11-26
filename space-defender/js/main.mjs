// main.mjs — 装配入口：绑定事件、驱动固定步长循环、同步 HUD 与面板。
// 唯一碰 DOM 的层；规则来自 engine，存档来自 storage，计分来自 score。

import { createController } from "./game.mjs";
import { createRenderer, FIELD_W } from "./render.mjs";
import * as store from "./storage.mjs";
import { strings, loadLocale, saveLocale, htmlLang, format, LOCALES } from "./i18n.mjs";
import { createAudio } from "./audio.mjs";
import { TOTAL_WAVES, SECTOR_COUNT, sectorOf, waveSpec } from "./levels.mjs";
import { MAX_SHIELD, OVERLOAD_MAX, snapshot } from "./engine.mjs";

const el = (id) => document.getElementById(id);

const TEXT_IDS = [
  ["back-text", "back"],
  ["app-title-main", "appTitle"],
  ["app-subtitle", "appSubtitle"],
  ["label-sector", "labelSector"],
  ["label-wave", "labelWave"],
  ["label-hangar", "labelHangar"],
  ["label-lives", "labelLives"],
  ["btn-launch", "btnLaunch"],
  ["btn-retry", "btnRetry"],
  ["btn-hangar", "btnHangar"],
  ["key-hint", "keyHint"],
  ["label-shield", "labelShield"],
  ["label-overload", "labelOverload"],
  ["label-combo", "labelCombo"],
  ["label-acc", "labelAcc"],
  ["label-graze", "labelGraze"],
  ["label-timer", "labelTimer"],
  ["label-best", "labelBest"],
  ["label-best-score", "labelBestScore"],
  ["label-best-wave", "labelBestWave"],
  ["label-rush-best", "labelRushBest"],
  ["label-autofire", "autoFireLabel"],
  ["pad-left-label", "padLeft"],
  ["pad-right-label", "padRight"],
  ["pad-fire-label", "padFire"],
  ["pad-overload-label", "padOverload"],
  ["pad-pause-label", "padPause"],
  ["hangar-kicker", "hangarKicker"],
  ["hangar-title", "hangarTitle"],
  ["hangar-desc", "hangarDesc"],
  ["btn-hangar-start", "btnLaunch"],
  ["btn-hangar-close", "btnHangarPause"],
  ["pause-title", "pauseTitle"],
  ["pause-desc", "pauseDesc"],
  ["btn-resume", "btnResume"],
  ["btn-retry-pause", "btnRetry"],
  ["btn-hangar-pause", "btnHangar"],
  ["label-res-score", "labelResScore"],
  ["label-res-acc", "labelResAcc"],
  ["label-res-kills", "labelResKills"],
  ["label-res-graze", "labelResGraze"],
  ["label-res-rescue", "labelResRescue"],
  ["label-res-time", "labelResTime"],
  ["label-res-bonus", "labelResBonus"],
  ["btn-next", "btnNext"],
  ["btn-retry-result", "btnRetry"],
  ["btn-hangar-result", "btnHangarResult"],
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
  ["mode-campaign", "modeCampaign"],
  ["mode-rush", "modeRush"],
  ["mode-survival", "modeSurvival"],
];

let locale = loadLocale();
let t = strings(locale);
let save = store.load();
let mode = "campaign";
let selectedWave = 0;
let toastTimer = 0;

const audio = createAudio();
const canvas = el("stage-canvas");
const reducedQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
const renderer = createRenderer(canvas, { reducedMotion: reducedQuery?.matches ?? false });

const controller = createController({ mode, waveIndex: 0 });
const input = { left: false, right: false, fire: false };
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
  el("chk-autofire").checked = save.prefs.autoFire;
}

/* ------------------------------------------------------------ 面板 */

function openPanel(id) {
  el(id).classList.add("is-open");
}

function closePanel(id) {
  el(id).classList.remove("is-open");
}

function closeAllPanels() {
  for (const id of ["panel-hangar", "panel-pause", "panel-result", "panel-help"]) closePanel(id);
}

function toast(text) {
  const node = el("toast");
  node.textContent = text;
  node.classList.add("is-on");
  toastTimer = 2.2;
}

function buildHangar() {
  const grid = el("wave-grid");
  grid.innerHTML = "";
  const stars = save.progress.campaignStars;
  el("total-stars").textContent = format(t.totalStarsValue, { n: stars.reduce((a, b) => a + b, 0) });

  const cells = mode === "campaign" ? TOTAL_WAVES : mode === "rush" ? SECTOR_COUNT : 1;
  const unlocked = save.progress.unlockedWave;
  for (let i = 0; i < cells; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wave-cell";
    const isBoss = mode === "rush" || (mode === "campaign" && waveSpec(i).boss);
    if (isBoss) button.classList.add("is-boss");
    const locked = mode === "campaign" && i > unlocked;
    if (locked) {
      button.classList.add("is-locked");
      button.disabled = true;
      button.title = t.waveLocked;
    }
    const no = document.createElement("span");
    no.className = "wave-no";
    no.textContent = mode === "survival" ? "∞" : String(i + 1);
    const starLine = document.createElement("span");
    starLine.className = "wave-stars";
    starLine.textContent = mode === "campaign" ? (locked ? t.waveLocked : format(t.waveStars, { n: stars[i] })) : isBoss ? t.bossTag : "";
    button.append(no, starLine);
    if (i === selectedWave) button.classList.add("is-selected");
    button.addEventListener("click", () => {
      if (locked) {
        toast(t.toastLocked);
        return;
      }
      selectedWave = i;
      for (const node of grid.children) node.classList.remove("is-selected");
      button.classList.add("is-selected");
      audio.play("ui");
    });
    grid.append(button);
  }
}

function showHangar() {
  buildHangar();
  openPanel("panel-hangar");
}

function sectorLabel(waveIndex) {
  const sector = mode === "campaign" ? sectorOf(waveIndex).id : mode === "rush" ? waveIndex : Math.floor(waveIndex / 6) % SECTOR_COUNT;
  const clamped = Math.max(0, Math.min(SECTOR_COUNT - 1, sector));
  return t[`sector${clamped}`];
}

function launchWave(waveIndex) {
  selectedWave = waveIndex;
  controller.launch(mode, waveIndex);
  renderer.clear();
  closeAllPanels();
  syncHud(true);
  audio.play("ui");
}

function showResult(result) {
  const stars = result?.stars ?? 0;
  el("result-title").textContent = result?.lost ? t.resultTitleLose : t.resultTitleWin;
  const starNodes = el("result-stars").children;
  for (let i = 0; i < starNodes.length; i += 1) {
    const node = starNodes[i];
    node.classList.remove("is-on");
    if (i < stars) {
      node.style.animationDelay = `${0.12 + i * 0.18}s`;
      // 强制重排以重播点亮动画
      void node.offsetWidth;
      node.classList.add("is-on");
    }
  }
  el("res-score").textContent = String(result?.score ?? 0);
  el("res-acc").textContent = format(t.accValue, { n: Math.round((result?.accuracy ?? 0) * 100) });
  el("res-kills").textContent = String(result?.kills ?? 0);
  el("res-graze").textContent = String(result?.graze ?? 0);
  el("res-rescue").textContent = String(result?.rescued ?? 0);
  el("res-time").textContent = format(t.timeValue, { n: (result?.time ?? 0).toFixed(1) });
  el("res-bonus").textContent = String(result?.bonus ?? 0);
  el("result-hint").textContent = result?.lost ? t.toastGameOver : "";
  el("btn-next").style.display = result?.lost || result?.won ? "none" : "";
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

function syncHud(force = false) {
  const state = controller.state;
  const snap = snapshot(state);
  setText("val-sector", sectorLabel(state.waveIndex));
  setText(
    "val-wave",
    mode === "survival" ? String(state.waveIndex + 1) : format(t.waveValue, { n: state.waveIndex + 1, max: mode === "rush" ? SECTOR_COUNT : TOTAL_WAVES }),
  );
  const hangarText = state.player.dual
    ? t.valDual
    : state.player.drones > 0
      ? format(t.droneValue, { n: state.player.drones })
      : t.valSingle;
  setText("val-hangar", hangarText);
  setText("val-lives", String(state.lives));
  setText("val-combo", format(t.comboValue, { n: Math.max(1, snap.combo) }));
  const acc = state.stats.shots > 0 ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
  setText("val-acc", format(t.accValue, { n: acc }));
  setText("val-graze", String(state.stats.graze));
  setText("val-timer", format(t.timeValue, { n: (state.mode === "rush" ? state.rushTime : state.time).toFixed(1) }));
  setText("val-best-score", String(save.progress.bestScore));
  setText("val-best-wave", String(Math.max(1, save.progress.survivalBestWave + 1)));
  setText("val-rush-best", save.progress.rushBestMs > 0 ? `${(save.progress.rushBestMs / 1000).toFixed(1)}s` : "—");

  const cells = el("shield-cells");
  if (cells.children.length !== MAX_SHIELD) {
    cells.innerHTML = "";
    for (let i = 0; i < MAX_SHIELD; i += 1) {
      const cell = document.createElement("i");
      cell.className = "shield-cell";
      cells.append(cell);
    }
  }
  for (let i = 0; i < cells.children.length; i += 1) {
    cells.children[i].classList.toggle("is-on", i < state.player.shields);
  }
  const bar = el("bar-overload");
  const ratio = Math.max(0, Math.min(1, state.overload.charge / OVERLOAD_MAX));
  bar.style.width = `${ratio * 100}%`;
  bar.parentElement.classList.toggle("is-full", ratio >= 1 || state.overload.active > 0);
  if (force) lastHud.valSector = null;
}

/* ------------------------------------------------------------ 输入 */

const keyMap = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "fire",
  KeyJ: "fire",
};

function onKey(event) {
  const held = event.type === "keydown";
  if (held) audio.unlock();
  const action = keyMap[event.code];
  if (action) {
    event.preventDefault();
    input[action] = held;
    return;
  }
  if (!held) return;
  if (event.code === "KeyK") {
    event.preventDefault();
    controller.intent("overload");
  } else if (event.code === "KeyP" || event.code === "Escape") {
    event.preventDefault();
    togglePause();
  } else if (event.code === "KeyR") {
    event.preventDefault();
    launchWave(controller.state.waveIndex);
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
    pointerTarget = controller.state.player.x;
    canvas.dataset.dragX = String(event.clientX);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!canvas.dataset.dragX) return;
    const prev = Number(canvas.dataset.dragX);
    const delta = (event.clientX - prev) * canvasScale();
    canvas.dataset.dragX = String(event.clientX);
    if (pointerTarget === null) pointerTarget = controller.state.player.x;
    pointerTarget = Math.max(32, Math.min(FIELD_W - 32, pointerTarget + delta));
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
      if (action === "fire") input.fire = true;
      else input[action] = true;
    };
    const up = () => {
      button.classList.remove("is-held");
      if (action === "fire") input.fire = false;
      else input[action] = false;
    };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointerleave", up);
    button.addEventListener("pointercancel", up);
  }
}

function togglePause() {
  if (controller.isTerminal()) return;
  if (controller.paused) {
    controller.resume();
    closePanel("panel-pause");
  } else if (controller.pause()) {
    openPanel("panel-pause");
  }
}

/* ------------------------------------------------------------ 事件 */

controller.on((type, payload) => {
  renderer.handleEvent(payload ?? { type });
  switch (type) {
    case "shot":
      audio.play("shot");
      break;
    case "kill":
      audio.play("kill", payload);
      break;
    case "graze":
      audio.play("graze");
      break;
    case "hit":
      audio.play("hit");
      break;
    case "overload":
      audio.play("overload");
      break;
    case "overloadEnd":
      audio.play("overloadEnd");
      break;
    case "capture":
      audio.play("capture");
      toast(t.toastCaptured);
      break;
    case "rescue":
      audio.play("rescue");
      toast(t.toastRescued);
      break;
    case "pickup":
      audio.play("pickup");
      break;
    case "breach":
      audio.play("breach");
      toast(t.toastBreach);
      break;
    case "lifeLost":
      audio.play("lifeLost");
      break;
    case "bossDown":
      audio.play("bossDown");
      break;
    case "waveClear":
      audio.play("waveClear");
      break;
    case "campaignWin":
      audio.play("campaignWin");
      break;
    case "gameOver":
      audio.play("gameOver");
      break;
    default:
      break;
  }
});

function persistResult(result) {
  if (!result) return;
  const applied = store.applyResult(save, {
    mode: result.mode,
    wave: result.wave,
    stars: result.stars ?? 0,
    score: result.score,
    kills: result.kills,
    rescued: result.rescued,
    time: result.time,
    won: Boolean(result.won),
    lost: Boolean(result.lost),
    bestCombo: result.maxCombo,
  });
  save = applied.state;
  syncHud(true);
}

controller.on((type, payload) => {
  if (type !== "terminal") return;
  persistResult(payload.result);
  showResult(payload.result);
});

/* ------------------------------------------------------------ 循环 */

let lastTime = 0;

function loop(now) {
  const dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0;
  lastTime = now;

  if (pointerTarget !== null) {
    const diff = pointerTarget - controller.state.player.x;
    input.left = diff < -3;
    input.right = diff > 3;
  }
  const fire = input.fire || (save.prefs.autoFire && !controller.paused);
  const frameInput = { left: input.left, right: input.right, fire };

  if (!controller.paused && !controller.isTerminal()) {
    controller.frame(dt, frameInput);
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
    const next = locale === "zh" ? "en" : "zh";
    saveLocale(next);
    if (typeof location !== "undefined") location.reload();
  });

  el("btn-help").addEventListener("click", () => openPanel("panel-help"));
  el("btn-help-close").addEventListener("click", () => closePanel("panel-help"));

  for (const [id, key] of MODE_CHIPS) {
    el(id).addEventListener("click", () => {
      mode = el(id).dataset.mode;
      for (const [otherId] of MODE_CHIPS) el(otherId).classList.toggle("is-active", otherId === id);
      for (const [otherId] of MODE_CHIPS) el(otherId).setAttribute("aria-selected", String(otherId === id));
      selectedWave = 0;
      buildHangar();
      openPanel("panel-hangar");
      audio.play("ui");
    });
  }

  el("btn-launch").addEventListener("click", () => {
    if (controller.isTerminal()) {
      showHangar();
      return;
    }
    launchWave(controller.state.waveIndex);
  });
  el("btn-retry").addEventListener("click", () => launchWave(controller.state.waveIndex));
  el("btn-hangar").addEventListener("click", showHangar);
  el("btn-hangar-start").addEventListener("click", () => launchWave(selectedWave));
  el("btn-hangar-close").addEventListener("click", () => {
    if (controller.isTerminal()) {
      showResult(controller.result());
      return;
    }
    closePanel("panel-hangar");
  });
  el("btn-resume").addEventListener("click", togglePause);
  el("btn-retry-pause").addEventListener("click", () => launchWave(controller.state.waveIndex));
  el("btn-hangar-pause").addEventListener("click", showHangar);
  el("btn-next").addEventListener("click", () => {
    const next = controller.nextWave();
    if (next) {
      closeAllPanels();
      renderer.clear();
      syncHud(true);
    } else {
      showHangar();
    }
  });
  el("btn-retry-result").addEventListener("click", () => launchWave(controller.state.waveIndex));
  el("btn-hangar-result").addEventListener("click", showHangar);
  el("pad-pause").addEventListener("click", togglePause);
  el("pad-overload").addEventListener("click", () => controller.intent("overload"));

  el("chk-autofire").addEventListener("change", (event) => {
    save = store.setAutoFire(save, event.target.checked);
  });

  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("resize", () => renderer.resize());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !controller.isTerminal() && !controller.paused) {
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
buildHangar();
syncHud(true);
requestAnimationFrame(loop);

// 只读诊断出口：供自动化验收读取真实状态（不参与玩法逻辑）
window.__spaceDefender = {
  controller,
  snapshot: () => snapshot(controller.state),
  locale: () => locale,
  locales: () => LOCALES.slice(),
  particles: () => renderer.particleCount(),
};
