// 推币机 · DOM 层（唯一碰 DOM 的层之一）
// 契约：全量 i18n 原地热更新（applyLocale 遍历 [data-i18n]），绝不 reload、绝不重置对局。
//
// 无尽机台没有瞄准滑轨与力度条——投币口固定，落点由挡杆阵决定。
// 得分不再在台面上飘字，改为侧栏「掉落记录」逐条落格。

import { strings, format } from "./i18n.mjs";
import { formatScore, formatMult, cascadeTierKey } from "./score.mjs";

const OVERLAYS = { menu: "ov-menu", help: "ov-help", result: "ov-result", pause: "ov-pause" };
const DROP_LOG_MAX = 7;

function byId(id) {
  return document.getElementById(id);
}

export function createUI(handlers) {
  const el = {};
  for (const id of [
    "stage-title", "btn-sound", "btn-lang", "btn-help",
    "lamp-double", "lamp-speed", "lamp-magnet",
    "hud-credits", "hud-score", "hud-mult", "hud-cascade",
    "mode-tag", "goal-line", "table", "toast",
    "ov-menu", "ov-help", "ov-result", "ov-pause",
    "menu-sub", "mode-desc", "credit-grid", "runs-total", "btn-reset-save", "btn-start",
    "result-title", "result-line",
    "btn-again", "btn-back-menu",
    "btn-resume", "btn-pause-restart", "btn-pause-menu", "btn-help-close",
    "btn-insert", "btn-restart", "btn-pause",
    "best-score", "best-cascade", "best-drops",
    "ladder", "drop-log", "drop-log-empty"
  ]) {
    el[id] = byId(id);
  }

  let lang = "zh";
  let overlay = "menu";
  let toastTimer = 0;
  let soundOn = true;
  let creditOptions = [20, 50, 100];
  let selectedCredits = 50;
  const dropLog = [];

  // ---------------------------------------------------------- 语言热更新

  function applyLocale(nextLang) {
    if (nextLang) lang = nextLang;
    const table = strings(lang);
    for (const node of document.querySelectorAll("[data-i18n]")) {
      const key = node.getAttribute("data-i18n");
      if (!key || !(key in table)) continue;
      node.textContent = table[key];
    }
    for (const node of document.querySelectorAll("[data-i18n-aria]")) {
      const key = node.getAttribute("data-i18n-aria");
      if (!key || !(key in table)) continue;
      node.setAttribute("aria-label", table[key]);
    }
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.title = table.docTitle;
    if (el["btn-lang"]) el["btn-lang"].textContent = table.langBtn;
    if (el["btn-sound"]) el["btn-sound"].textContent = soundOn ? table.soundOn : table.soundOff;
    el["mode-desc"].textContent = table.creditDesc;
    renderCredits();
    renderDropLog();
    return lang;
  }

  function t(key, values) {
    return format(lang, key, values);
  }

  // ---------------------------------------------------------- HUD

  function renderHud(payload) {
    el["hud-credits"].textContent = String(payload.credits ?? 0);
    el["hud-score"].textContent = formatScore(payload.score);
    el["hud-mult"].textContent = formatMult(payload.mult);
    el["hud-cascade"].textContent = String(payload.cascade ?? 0);

    el["lamp-double"].classList.toggle("on", payload.effects.double > 0);
    el["lamp-speed"].classList.toggle("on", payload.effects.speed > 0);
    el["lamp-magnet"].classList.toggle("on", payload.effects.magnet > 0);

    const lamps = el["ladder"].children;
    const activeIndex = ["tier1", "tier2", "tier3", "tier4", "tierMad"].indexOf(cascadeTierKey(payload.cascade || 0));
    for (let i = 0; i < lamps.length; i++) lamps[i].classList.toggle("on", payload.cascade > 0 && i === activeIndex);

    el["best-score"].textContent = formatScore(payload.bestScore);
    el["best-cascade"].textContent = String(payload.bestCascade ?? 0);
    el["best-drops"].textContent = String(payload.bestDrops ?? 0);
    el["runs-total"].textContent = t("runs", { n: payload.runs ?? 0 });
    el["btn-insert"].disabled = !payload.canInsert;
  }

  // ---------------------------------------------------------- 掉落记录（得分唯一去处）

  function pushDrop(record) {
    dropLog.unshift(record);
    if (dropLog.length > DROP_LOG_MAX) dropLog.length = DROP_LOG_MAX;
    renderDropLog();
  }

  function clearDrops() {
    dropLog.length = 0;
    renderDropLog();
  }

  function renderDropLog() {
    if (!el["drop-log"]) return;
    const list = el["drop-log"];
    list.textContent = "";
    for (const record of dropLog) {
      const li = document.createElement("li");
      li.className = `drop-row kind-${record.kind}`;
      const chip = document.createElement("span");
      chip.className = `chip coin-${record.kind === "tower" ? "gold" : record.kind}`;
      const gain = document.createElement("b");
      gain.className = "drop-gain";
      gain.textContent = `+${formatScore(record.gained)}`;
      const meta = document.createElement("i");
      meta.className = "drop-meta";
      meta.textContent = record.mult > 1 ? `×${formatScore(record.mult)}` : `#${record.cascade}`;
      li.appendChild(chip);
      li.appendChild(gain);
      li.appendChild(meta);
      list.appendChild(li);
    }
    el["drop-log-empty"].hidden = dropLog.length > 0;
  }

  // ---------------------------------------------------------- 初始币数选择

  function setCreditOptions(options, selected) {
    if (Array.isArray(options) && options.length > 0) creditOptions = options.slice();
    if (Number.isFinite(selected)) selectedCredits = selected;
    renderCredits();
  }

  function setSelectedCredits(value) {
    selectedCredits = value;
    renderCredits();
  }

  function renderCredits() {
    if (!el["credit-grid"]) return;
    const table = strings(lang);
    el["credit-grid"].textContent = "";
    for (const value of creditOptions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "credit-btn";
      btn.dataset.credits = String(value);
      if (value === selectedCredits) btn.classList.add("active");
      btn.textContent = format(lang, "creditsUnit", { n: value }) || String(value);
      btn.setAttribute("aria-pressed", value === selectedCredits ? "true" : "false");
      btn.title = table.creditPick;
      btn.addEventListener("click", () => {
        setSelectedCredits(value);
        handlers.onPickCredits(value);
      });
      el["credit-grid"].appendChild(btn);
    }
  }

  // ---------------------------------------------------------- 浮层

  function setOverlay(name) {
    const next = name in OVERLAYS ? name : "none";
    for (const [key, id] of Object.entries(OVERLAYS)) {
      const node = el[id];
      if (!node) continue;
      if (key === next) node.removeAttribute("hidden");
      else node.setAttribute("hidden", "");
    }
    overlay = next;
    return next;
  }

  function currentOverlay() {
    return overlay;
  }

  function showResult(payload) {
    el["result-title"].textContent = payload.title;
    el["result-line"].textContent = payload.line;
    setOverlay("result");
  }

  // ---------------------------------------------------------- 提示条

  function toast(key, values = {}, warn = false) {
    if (!el["toast"]) return;
    el["toast"].textContent = t(key, values);
    el["toast"].classList.toggle("warn", Boolean(warn));
    el["toast"].classList.add("show");
    toastTimer = 1.7;
  }

  function tick(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) el["toast"].classList.remove("show");
    }
  }

  function setSound(on) {
    soundOn = Boolean(on);
    el["btn-sound"].textContent = soundOn ? strings(lang).soundOn : strings(lang).soundOff;
  }

  // ---------------------------------------------------------- 输入绑定

  el["btn-insert"].addEventListener("click", () => handlers.onInsert());
  el["btn-insert"].addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handlers.onInsert();
    }
  });

  el["btn-start"].addEventListener("click", () => handlers.onStart());
  el["btn-restart"].addEventListener("click", () => handlers.onRestart());
  el["btn-pause"].addEventListener("click", () => handlers.onPause());

  el["btn-sound"].addEventListener("click", () => handlers.onToggleSound());
  el["btn-lang"].addEventListener("click", () => handlers.onToggleLang());
  el["btn-help"].addEventListener("click", () => handlers.onOpenHelp());
  el["btn-help-close"].addEventListener("click", () => handlers.onCloseHelp());

  el["btn-again"].addEventListener("click", () => handlers.onAgain());
  el["btn-back-menu"].addEventListener("click", () => handlers.onBackMenu());
  el["btn-resume"].addEventListener("click", () => handlers.onResume());
  el["btn-pause-restart"].addEventListener("click", () => handlers.onRestart());
  el["btn-pause-menu"].addEventListener("click", () => handlers.onBackMenu());
  el["btn-reset-save"].addEventListener("click", () => handlers.onResetSave());

  return {
    applyLocale,
    renderHud,
    setOverlay,
    currentOverlay,
    showResult,
    setCreditOptions,
    setSelectedCredits,
    pushDrop,
    clearDrops,
    setSound,
    toast,
    tick,
    get lang() { return lang; },
    get selectedCredits() { return selectedCredits; }
  };
}
