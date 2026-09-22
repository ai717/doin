// 莓园打地鼠 — 唯一碰 DOM 的层：洞位渲染、HUD、动效与弹层

import { t, htmlLang } from "./i18n.mjs";

export function $(id) {
  return document.getElementById(id);
}

const KEY_MAP = [
  ["1", "2", "3", "4"],
  ["q", "w", "e", "r"],
  ["a", "s", "d", "f"],
];

const CHIP_COLORS = {
  hit: ["#ffd166", "#ffe9a8", "#c9a26b"],
  gold: ["#ffe9a0", "#f6c34a", "#fff6d8"],
  helmet: ["#dfe7ee", "#9aa7b4", "#ffd166"],
  bomb: ["#ff7a5c", "#ffb37a", "#6b6470"],
};

export function createUI() {
  const dom = {
    app: $("game-app"),
    garden: $("garden"),
    grid: $("holes-grid"),
    hammer: $("hammer"),
    veil: $("frenzy-veil"),
    toast: $("toast"),
    backHome: $("back-home"),
    btnSound: $("btn-sound"),
    btnLang: $("btn-lang"),
    btnHelp: $("btn-help"),
    diffTabs: $("diff-tabs"),
    diffHint: $("diff-hint"),
    hudBest: $("hud-best"),
    hudBestCombo: $("hud-best-combo"),
    hudAccuracy: $("hud-accuracy"),
    hudScore: $("hud-score"),
    hudCombo: $("hud-combo"),
    hudMult: $("hud-mult"),
    hudTime: $("hud-time"),
    hudMaxCombo: $("hud-max-combo"),
    hourglass: $("hourglass"),
    hourglassSand: $("hourglass-sand"),
    modalWelcome: $("modal-welcome"),
    modalPause: $("modal-pause"),
    modalGameover: $("modal-gameover"),
    modalRules: $("modal-rules"),
    btnStart: $("btn-start"),
    btnDailyWelcome: $("btn-daily-welcome"),
    btnResume: $("btn-resume"),
    btnRestartPause: $("btn-restart-pause"),
    btnReplay: $("btn-replay"),
    btnCloseRules: $("btn-close-rules"),
    btnPrimary: $("btn-primary"),
    btnPause: $("btn-pause"),
    btnDaily: $("btn-daily"),
    settleBadge: $("settle-badge"),
    settleTitle: $("settle-title"),
    settleScore: $("settle-score"),
    settleCombo: $("settle-combo"),
    settleAccuracy: $("settle-accuracy"),
    settleBombs: $("settle-bombs"),
    settleBest: $("settle-best"),
  };

  return {
    dom,
    locale: "zh",
    holes: [],       // { el, phase, species, id }
    rows: 0,
    cols: 0,
    lastValues: {},
  };
}

export function setLocale(ui, locale) {
  ui.locale = locale;
  document.documentElement.lang = htmlLang(locale);
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const key = el.getAttribute("data-i18n");
    const text = t(key, locale);
    if (text) el.textContent = text;
  }
  return ui;
}

/** 依视口构建洞位网格；返回 {rows, cols} */
export function buildGrid(ui, rows, cols) {
  const r = Math.max(1, Math.floor(rows));
  const c = Math.max(1, Math.floor(cols));
  ui.rows = r;
  ui.cols = c;
  ui.grid = ui.dom.grid;
  ui.dom.grid.style.setProperty("--cols", String(c));
  ui.dom.grid.style.setProperty("--rows", String(r));

  const frag = document.createDocumentFragment();
  ui.holes = [];
  for (let i = 0; i < r * c; i += 1) {
    const row = Math.floor(i / c);
    const col = i % c;
    const hole = document.createElement("button");
    hole.type = "button";
    hole.className = "hole";
    hole.dataset.index = String(i);
    hole.dataset.phase = "none";
    hole.dataset.species = "";
    hole.setAttribute("aria-label", `hole ${i + 1}`);

    const pit = document.createElement("span");
    pit.className = "hole-pit";
    const clip = document.createElement("span");
    clip.className = "mole-clip";
    const mole = document.createElement("span");
    mole.className = "mole";
    const body = document.createElement("span");
    body.className = "mole-body";
    const belly = document.createElement("span");
    belly.className = "mole-belly";
    body.append(belly);
    const earL = document.createElement("span");
    earL.className = "mole-ear mole-ear--l";
    const earR = document.createElement("span");
    earR.className = "mole-ear mole-ear--r";
    const pawL = document.createElement("span");
    pawL.className = "mole-paw mole-paw--l";
    const pawR = document.createElement("span");
    pawR.className = "mole-paw mole-paw--r";
    const helmet = document.createElement("span");
    helmet.className = "mole-helmet";
    const fuse = document.createElement("span");
    fuse.className = "mole-fuse";
    const face = document.createElement("span");
    face.className = "mole-face";
    const glintL = document.createElement("span");
    glintL.className = "mole-eye-glint mole-eye-glint--l";
    const glintR = document.createElement("span");
    glintR.className = "mole-eye-glint mole-eye-glint--r";
    const blushL = document.createElement("span");
    blushL.className = "mole-blush mole-blush--l";
    const blushR = document.createElement("span");
    blushR.className = "mole-blush mole-blush--r";
    const snout = document.createElement("span");
    snout.className = "mole-snout";
    // 顺序即层叠：躯干 → 耳朵 → 爪子 → 盔/引信 → 五官 → 腮红
    mole.append(body, earL, earR, pawL, pawR, helmet, fuse, face, glintL, glintR, blushL, blushR, snout);

    const key = document.createElement("span");
    key.className = "hole-key";
    key.textContent = (KEY_MAP[row]?.[col] ?? "").toUpperCase();

    // 层级自下而上：洞口椭圆（z1）→ 地鼠活动区（z2，底边压在地平线上）
    clip.append(mole);
    hole.append(pit, clip, key);
    frag.appendChild(hole);
    ui.holes.push({ el: hole, phase: "none", species: "", id: 0, broken: false });
  }
  ui.dom.grid.replaceChildren(frag);
  return { rows: r, cols: c };
}

/** 把引擎里的洞位状态同步到 DOM（只做增量改动） */
export function syncHoles(ui, run) {
  if (!run) {
    for (const hole of ui.holes) {
      if (hole.phase !== "none") {
        hole.el.dataset.phase = "none";
        hole.el.dataset.species = "";
        hole.phase = "none";
        hole.species = "";
      }
    }
    return;
  }
  for (let i = 0; i < ui.holes.length; i += 1) {
    const view = ui.holes[i];
    const mole = run.holes[i];
    const phase = mole ? mole.phase : "none";
    const species = mole ? mole.species : "";
    const broken = Boolean(mole && mole.species === "helmet" && mole.hp <= 1);

    if (view.id !== (mole?.id ?? 0)) {
      view.id = mole?.id ?? 0;
      view.el.classList.remove("is-hit");
    }
    if (view.species !== species) {
      view.species = species;
      view.el.dataset.species = species;
    }
    if (view.broken !== broken) {
      view.broken = broken;
      if (broken) view.el.dataset.broken = "1";
      else delete view.el.dataset.broken;
    }
    if (view.phase !== phase) {
      view.phase = phase;
      view.el.dataset.phase = phase;
    }
  }
}

function bump(el, ui, key) {
  if (!el) return;
  if (ui.lastValues[key] !== el.textContent) {
    el.classList.remove("bump");
    // 强制重排以重启动画
    void el.offsetWidth;
    el.classList.add("bump");
  }
}

export function updateHud(ui, run, info = {}) {
  const { best = 0, bestCombo = 0, multiplier = 1, seconds = 60, accuracyText = "—" } = info;
  const d = ui.dom;
  const score = run?.score ?? 0;
  const combo = run?.combo ?? 0;
  const maxCombo = run?.maxCombo ?? 0;

  if (d.hudScore.textContent !== String(score)) {
    d.hudScore.textContent = String(score);
    bump(d.hudScore, ui, "score");
  }
  if (d.hudCombo.textContent !== String(combo)) {
    d.hudCombo.textContent = String(combo);
    bump(d.hudCombo, ui, "combo");
  }
  d.hudMult.textContent = `×${multiplier % 1 === 0 ? multiplier : multiplier.toFixed(1)}`;
  d.hudMaxCombo.textContent = String(maxCombo);
  d.hudTime.textContent = String(seconds);
  d.hudBest.textContent = String(best);
  d.hudBestCombo.textContent = String(bestCombo);
  d.hudAccuracy.textContent = accuracyText;

  const ratio = Math.max(0, Math.min(1, seconds / 60));
  d.hourglassSand.style.transform = `scaleX(${ratio.toFixed(3)})`;
  d.hourglass.style.opacity = seconds <= 10 ? "1" : "0.85";
}

export function setFrenzy(ui, on) {
  ui.dom.garden.classList.toggle("is-frenzy", Boolean(on));
}

export function spawnChips(ui, index, kind = "hit") {
  const view = ui.holes[index];
  if (!view) return;
  const palette = CHIP_COLORS[kind] ?? CHIP_COLORS.hit;
  const count = kind === "gold" ? 10 : 7;
  for (let i = 0; i < count; i += 1) {
    const chip = document.createElement("span");
    chip.className = "chip";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 34 + Math.random() * 34;
    chip.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    chip.style.setProperty("--dy", `${Math.sin(angle) * dist - 12}px`);
    chip.style.setProperty("--chip-color", palette[i % palette.length]);
    view.el.appendChild(chip);
    setTimeout(() => chip.remove(), 520);
  }
}

export function markHit(ui, index) {
  const view = ui.holes[index];
  if (!view) return;
  view.el.classList.remove("is-hit");
  void view.el.offsetWidth;
  view.el.classList.add("is-hit");
}

export function moveHammer(ui, x, y) {
  const rect = ui.dom.garden.getBoundingClientRect();
  ui.dom.hammer.style.left = `${x - rect.left}px`;
  ui.dom.hammer.style.top = `${y - rect.top}px`;
}

export function swingHammer(ui) {
  const el = ui.dom.hammer;
  el.classList.remove("is-swing");
  void el.offsetWidth;
  el.classList.add("is-swing");
}

let toastTimer = 0;
export function toast(ui, text, warn = false) {
  const el = ui.dom.toast;
  el.textContent = text;
  el.classList.toggle("is-warn", warn);
  el.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-show"), 1100);
}

/** 弹层可见性：以 classList 为唯一真相源（不混用 hidden 属性，避免双真相源） */
export function isModalOpen(ui, name) {
  const el = modalEl(ui, name);
  return Boolean(el) && !el.classList.contains("hidden");
}

function modalEl(ui, name) {
  const map = {
    welcome: ui.dom.modalWelcome,
    pause: ui.dom.modalPause,
    gameover: ui.dom.modalGameover,
    rules: ui.dom.modalRules,
  };
  return map[name];
}

export function showModal(ui, name) {
  const el = modalEl(ui, name);
  if (!el) return;
  el.classList.remove("hidden");
  el.setAttribute("aria-hidden", "false");
}

export function hideModal(ui, name) {
  const el = modalEl(ui, name);
  if (!el) return;
  el.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");
}

export function hideAllModals(ui) {
  for (const name of ["welcome", "pause", "gameover", "rules"]) hideModal(ui, name);
}

export function setDifficultyTab(ui, mode) {
  for (const tab of ui.dom.diffTabs.querySelectorAll(".diff-tab")) {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
  }
  const active = ui.dom.diffTabs.querySelector(`.diff-tab[data-mode="${mode}"]`);
  if (active?.dataset.hint) {
    ui.dom.diffHint.textContent = t(active.dataset.hint, ui.locale);
  }
}

export function setSoundButton(ui, enabled) {
  ui.dom.btnSound.textContent = enabled ? "🔊" : "🔇";
}

export function setLangButton(ui, locale) {
  ui.dom.btnLang.textContent = locale === "zh" ? "EN" : "中";
}

export function setPrimaryButton(ui, locale, state) {
  // state: 'start' | 'running'
  ui.dom.btnPrimary.textContent = t(state === "running" ? "btnRestart" : "btnStart", locale);
  ui.dom.btnPause.textContent = t("btnPause", locale);
}

export function showSettle(ui, locale, summary, best, isBest) {
  ui.dom.settleBadge.textContent = isBest ? "🏆" : "🍓";
  ui.dom.settleTitle.textContent = isBest ? t("newBestTitle", locale) : t("gameoverTitle", locale);
  ui.dom.settleScore.textContent = String(summary.score);
  ui.dom.settleCombo.textContent = String(summary.maxCombo);
  ui.dom.settleAccuracy.textContent = `${summary.accuracy}%`;
  ui.dom.settleBombs.textContent = String(summary.bombs);
  ui.dom.settleBest.textContent = String(best);
  showModal(ui, "gameover");
}

/** 桌面 4×3 / 移动 3×3 的网格尺寸决策 */
export function gridForWidth(width) {
  return width <= 768 ? { rows: 3, cols: 3 } : { rows: 3, cols: 4 };
}

/** 当前生效的网格尺寸（优先读已构建状态，退化到视口） */
export function currentGrid(ui, width) {
  if (ui && ui.rows > 0 && ui.cols > 0) return { rows: ui.rows, cols: ui.cols };
  return gridForWidth(width);
}

/** 键盘按键 → 洞位下标（越界返回 -1） */
export function keyToIndex(key, cols) {
  const lower = String(key ?? "").toLowerCase();
  for (let r = 0; r < KEY_MAP.length; r += 1) {
    const c = KEY_MAP[r].indexOf(lower);
    if (c >= 0 && c < cols) return r * cols + c;
  }
  return -1;
}
