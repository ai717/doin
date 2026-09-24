// main.mjs — 装配入口：绑定事件、启动主循环、驱动 HUD 与浮层。
// 唯一碰 DOM 的层；规则全部交给 engine，控制器只转发意图。

import { MowGame } from "./game.mjs";
import { MowRenderer } from "./render.mjs";
import * as audio from "./audio.mjs";
import * as i18n from "./i18n.mjs";
import * as storage from "./storage.mjs";
import { CHARACTERS, WEAPONS, PASSIVES, EVOLUTIONS, CHARACTER_IDS, PHASES, BOSS_TIME } from "./engine.mjs";

const T = i18n.strings(i18n.loadLocale());
const game = new MowGame();
const canvas = document.getElementById("stage-canvas");
const renderer = new MowRenderer(canvas);

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------ i18n 应用 */

const TEXT_MAP = {
  "back-text": "back",
  "app-title-main": "appTitle",
  "app-subtitle": "appSubtitle",
  "wing-left-title": "wingWorkshop",
  "wing-right-title": "wingStatus",
  "label-weapons": "labelWeapons",
  "label-passives": "labelPassives",
  "label-recipe": "labelRecipe",
  "btn-launch": "btnLaunch",
  "btn-codex": "btnCodex",
  "key-hint": "keyHint",
  "label-timer": "labelTimer",
  "label-hp": "labelHp",
  "label-mow": "labelMow",
  "mow-tag": "mowReadyTag",
  "label-combo": "labelCombo",
  "label-kills": "labelKills",
  "label-level": "labelLevel",
  "label-best": "labelBest",
  "label-best-std": "bestStd",
  "label-best-endless": "bestEndless",
  "label-codex-count": "labelCodex",
  "pad-burst-label": "padBurst",
  "pad-pause-label": "padPause",
  "joystick-label": "joystickLabel",
  "mode-standard": "modeStandard",
  "mode-endless": "modeEndless",
  "start-kicker": "panelStartKicker",
  "start-title": "panelStartTitle",
  "start-desc": "panelStartDesc",
  "mode-desc": "modeStandardDesc",
  "btn-start-run": "btnStart",
  "upgrade-kicker": "upgradeKicker",
  "upgrade-title": "levelUpTitle",
  "pause-title": "panelPauseTitle",
  "pause-desc": "panelPauseDesc",
  "btn-resume": "btnResume",
  "btn-restart": "btnRestart",
  "btn-quit": "btnQuit",
  "result-title": "resultTitleWin",
  "label-res-kills": "labelResKills",
  "label-res-combo": "labelResCombo",
  "label-res-burst": "labelResBurst",
  "label-res-score": "labelResScore",
  "label-res-time": "labelResTime",
  "result-hint": "resultHintWin",
  "btn-again": "btnAgain",
  "btn-to-home": "btnToHome",
  "codex-kicker": "codexKicker",
  "codex-title": "panelCodexTitle",
  "codex-desc": "panelCodexDesc",
  "codex-weapons": "codexWeapons",
  "codex-passives": "codexPassives",
  "codex-evolutions": "codexEvolutions",
  "btn-codex-close": "btnHelpClose",
  "help-title": "panelHelpTitle",
  help1: "help1",
  help2: "help2",
  help3: "help3",
  help4: "help4",
  help5: "help5",
  help6: "help6",
  "btn-help-close": "btnHelpClose",
};

function applyTexts() {
  for (const [id, key] of Object.entries(TEXT_MAP)) {
    const el = $(id);
    if (el && T[key]) el.textContent = T[key];
  }
  document.title = T.docTitle;
  document.documentElement.lang = i18n.htmlLang(i18n.loadLocale());
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", T.metaDesc);
  $("btn-lang").textContent = T.langSwitch;
  $("btn-sound").setAttribute("aria-label", T.sound);
}

function pascal(id) {
  return id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

function nameOf(kind, id) {
  if (kind === "character") return T["char" + pascal(id)] || id;
  if (kind === "weapon") return T["w" + pascal(id)] || WEAPONS[id]?.name || id;
  if (kind === "passive") return T["p" + pascal(id)] || PASSIVES[id]?.name || id;
  return id;
}

/* ------------------------------------------------------------ 音效路由 */

let lastKillSfx = 0;
let lastHudFrame = 0;

game.on((ev) => {
  const now = performance.now();
  switch (ev.type) {
    case "kill":
      if (now - lastKillSfx > 42) {
        lastKillSfx = now;
        audio.play("kill", ev.combo);
      }
      break;
    case "pickup":
      if (ev.kind === "rose") audio.play("rose");
      else if (ev.kind === "clover") audio.play("nectar");
      else if (ev.kind === "chest") audio.play("evolve");
      else audio.play("nectar");
      break;
    case "levelUp":
      audio.play("levelUp");
      showUpgradePanel(ev.choices);
      break;
    case "choose":
      audio.play("choose");
      break;
    case "evolve":
      audio.play("evolve");
      toast(i18n.format(T.toastEvolve, { name: nameOf("weapon", ev.weapon) }));
      break;
    case "burst":
      audio.play("burst");
      break;
    case "emergencyBurst":
      audio.play("emergency");
      toast(T.toastEmergency);
      break;
    case "mowReady":
      audio.play("mowReady");
      toast(T.toastMowReady);
      break;
    case "hit":
      audio.play("hit");
      break;
    case "checkpoint":
      audio.play("checkpoint");
      toast(i18n.format(T.toastCheckpoint, { n: ev.minute }));
      break;
    case "bossSpawn":
      audio.play("bossSpawn");
      toast(T.toastBossSpawn);
      break;
    case "bossCharge":
      audio.play("bossCharge");
      break;
    case "bossSummon":
      audio.play("bossSummon");
      break;
    case "win":
      audio.play("win");
      break;
    case "lose":
      audio.play("lose");
      break;
    case "runEnd":
      showResultPanel(ev);
      break;
    default:
      break;
  }
});

/* ------------------------------------------------------------ 浮层工具 */

function showPanel(id) {
  $(id).classList.add("is-open");
}

function hidePanel(id) {
  $(id).classList.remove("is-open");
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("is-show");
  void el.offsetWidth;
  el.classList.add("is-show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("is-show"), 2600);
}

/* ------------------------------------------------------------ 开局面板 */

let selectedMode = "standard";
let selectedChar = "mower";

function buildCharGrid() {
  const save = game.getSave();
  const grid = $("char-grid");
  grid.innerHTML = "";
  for (const id of CHARACTER_IDS) {
    const meta = CHARACTERS[id];
    const locked = !save.unlocked.includes(id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "char-card" + (id === selectedChar ? " is-selected" : "") + (locked ? " is-locked" : "");
    btn.dataset.char = id;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(id === selectedChar));
    const emoji = { mower: "🚜", sprinkler: "🚿", ladybug: "🐞", rabbit: "🐰" }[id] || "🚜";
    btn.innerHTML = `
      <span class="char-emoji">${locked ? "🔒" : emoji}</span>
      <strong class="char-name">${nameOf("character", id)}</strong>
      <span class="char-desc">${T["charDesc" + pascal(id)] || meta.desc}</span>
    `;
    if (!locked) {
      btn.addEventListener("click", () => {
        selectedChar = id;
        buildCharGrid();
      });
    }
    grid.appendChild(btn);
  }
}

function refreshModeChips() {
  const save = game.getSave();
  const endlessUnlocked = Boolean(save.best.standard && save.best.standard.won);
  const chip = $("mode-endless");
  chip.classList.toggle("is-locked", !endlessUnlocked);
  chip.disabled = !endlessUnlocked;
  $("mode-desc").textContent = endlessUnlocked ? T.modeEndlessDesc : T.btnStartLocked;
}

function bindModeChips() {
  for (const chip of document.querySelectorAll(".mode-chip")) {
    chip.addEventListener("click", () => {
      selectedMode = chip.dataset.mode;
      document.querySelectorAll(".mode-chip").forEach((c) => {
        c.classList.toggle("is-active", c === chip);
        c.setAttribute("aria-selected", String(c === chip));
      });
      refreshModeChips();
    });
  }
}

function openStartPanel() {
  buildCharGrid();
  refreshModeChips();
  showPanel("panel-start");
}

$("btn-start-run").addEventListener("click", () => {
  audio.unlock();
  launchRun(selectedMode, selectedChar);
});

$("btn-launch").addEventListener("click", () => {
  audio.unlock();
  if (game.state && !game.lastResult && game.state.phase !== PHASES.ready) return;
  openStartPanel();
});

$("btn-codex").addEventListener("click", () => {
  audio.unlock();
  renderCodex();
  showPanel("panel-codex");
});

$("btn-codex-close").addEventListener("click", () => hidePanel("panel-codex"));

function launchRun(mode, character) {
  game.newRun(mode, character);
  game.start();
  hidePanel("panel-start");
  hidePanel("panel-result");
  hidePanel("panel-pause");
  hidePanel("panel-upgrade");
  updateBestBlock();
}

/* ------------------------------------------------------------ 升级面板 */

function showUpgradePanel(choices) {
  const grid = $("choice-grid");
  grid.innerHTML = "";
  choices.forEach((choice, idx) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "choice-card";
    const tag =
      choice.kind === "xp"
        ? T.choiceXp
        : choice.kind === "weapon"
          ? (choice.level === 1 ? T.choiceWeapon : T.choiceWeaponUp)
          : choice.kind === "passive"
            ? (choice.level === 1 ? T.choicePassive : T.choicePassiveUp)
            : "";
    const name = choice.kind === "xp" ? T.choiceXp : nameOf(choice.kind, choice.id);
    card.innerHTML = `
      <span class="choice-tag">${tag}</span>
      <strong class="choice-name">${name}</strong>
      <span class="choice-level">${choice.level ? `Lv.${choice.level}` : `+${choice.value} XP`}</span>
      <kbd class="choice-key">${idx + 1}</kbd>
    `;
    card.addEventListener("click", () => {
      audio.unlock();
      game.choose(idx);
      hidePanel("panel-upgrade");
    });
    grid.appendChild(card);
  });
  showPanel("panel-upgrade");
}

/* ------------------------------------------------------------ 暂停 / 结算 */

$("btn-resume").addEventListener("click", () => {
  game.togglePause();
  hidePanel("panel-pause");
});

$("btn-restart").addEventListener("click", () => {
  hidePanel("panel-pause");
  launchRun(game.getMode(), game.getCharacter());
});

$("btn-quit").addEventListener("click", () => {
  if (!window.confirm(T.toastQuitConfirm)) return;
  hidePanel("panel-pause");
  game.state = null;
  game.lastResult = null;
  resetHud();
  openStartPanel();
});

$("btn-again").addEventListener("click", () => {
  const mode = game.lastResult && game.lastResult.result ? game.lastResult.result.mode : game.getMode();
  const char = game.lastResult && game.lastResult.result ? game.lastResult.result.character : game.getCharacter();
  launchRun(mode, char);
});

$("btn-to-home").addEventListener("click", () => {
  hidePanel("panel-result");
  game.state = null;
  game.lastResult = null;
  resetHud();
  openStartPanel();
});

function showResultPanel(payload) {
  const r = payload.result;
  const title = r.won ? T.resultTitleWin : T.resultTitleLose;
  $("result-title").textContent = title;
  const stars = $("result-stars").children;
  for (let i = 0; i < stars.length; i += 1) stars[i].classList.toggle("is-lit", i < r.stars);
  $("res-kills").textContent = r.kills;
  $("res-combo").textContent = r.maxCombo;
  $("res-burst").textContent = r.burstCount;
  $("res-score").textContent = r.score;
  $("res-time").textContent = `${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, "0")}`;
  $("result-hint").textContent = r.won ? T.resultHintWin : T.resultHintLose;
  const badges = [];
  if (payload.improved) badges.push(`✨ ${T.labelResNewBest}`);
  if (payload.newUnlock) badges.push(`🐰 ${T.labelResUnlock}`);
  $("result-badge").textContent = badges.join("  ");
  showPanel("panel-result");
}

/* ------------------------------------------------------------ 图鉴 */

function renderCodex() {
  const save = game.getSave();
  const fill = (id, list, total, kind) => {
    const el = $(id);
    el.innerHTML = "";
    for (const itemId of Object.keys(list)) {
      const owned = save.codex[kind].includes(itemId);
      const chip = document.createElement("span");
      chip.className = "codex-chip" + (owned ? " is-owned" : "");
      chip.textContent = owned ? nameOf(kind === "evolutions" ? "weapon" : kind, itemId) : "?";
      el.appendChild(chip);
    }
  };
  fill("codex-weapons-list", WEAPONS, 8, "weapons");
  fill("codex-passives-list", PASSIVES, 8, "passives");
  fill("codex-evolutions-list", EVOLUTIONS, 6, "evolutions");
  const total = save.codex.weapons.length + save.codex.passives.length + save.codex.evolutions.length;
  $("val-codex-count").textContent = `${total}/22`;
}

/* ------------------------------------------------------------ HUD */

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function updateHud(now) {
  const snap = game.snapshot();
  if (!snap) return;
  // 倒计时
  if (snap.mode === "standard") {
    if (snap.bossSpawned) {
      $("val-timer").textContent = "BOSS!";
    } else {
      const remain = Math.max(0, BOSS_TIME - snap.time);
      $("val-timer").textContent = fmtTime(remain);
    }
  } else {
    $("val-timer").textContent = fmtTime(snap.time);
  }
  // 血条
  $("hp-bar").style.width = `${Math.max(0, (snap.hp / snap.maxHp) * 100)}%`;
  // 割草槽
  $("bar-mow").style.width = `${(snap.mow / 100) * 100}%`;
  $("mow-tag").classList.toggle("is-ready", snap.mowReady);
  // 升级条
  $("bar-xp").style.width = `${Math.min(100, (snap.xp / snap.xpNext) * 100)}%`;
  if (now - lastHudFrame > 200) {
    lastHudFrame = now;
    $("val-combo").textContent = `×${snap.combo}`;
    $("val-kills").textContent = snap.kills;
    $("val-level").textContent = `Lv.${snap.level}`;
    renderLoadout(snap);
    updateBestBlock();
  }
}

function renderLoadout(snap) {
  const wl = $("list-weapons");
  const pl = $("list-passives");
  wl.innerHTML = "";
  for (const w of snap.weapons) {
    const li = document.createElement("li");
    const evolved = w.evolved ? `<em class="evolved-tag">${T.evolvedTag}</em>` : "";
    li.innerHTML = `<span class="loadout-name">${nameOf("weapon", w.id)}</span><span class="loadout-level">${evolved ? "★" : `Lv.${w.level}`}</span>${evolved}`;
    wl.appendChild(li);
  }
  if (!snap.weapons.length) wl.innerHTML = "<li class='loadout-empty'>—</li>";
  pl.innerHTML = "";
  for (const p of snap.passives) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="loadout-name">${nameOf("passive", p.id)}</span><span class="loadout-level">Lv.${p.level}</span>`;
    pl.appendChild(li);
  }
  if (!snap.passives.length) pl.innerHTML = "<li class='loadout-empty'>—</li>";
  // 进化配方提示
  const hints = [];
  for (const evolvedId of Object.keys(EVOLUTIONS)) {
    const recipe = EVOLUTIONS[evolvedId];
    const weapon = snap.weapons.find((w) => !w.evolved && w.id === recipe.base);
    if (!weapon) continue;
    const passive = snap.passives.find((p) => p.id === recipe.passive);
    const baseName = nameOf("weapon", recipe.base);
    const pName = nameOf("passive", recipe.passive);
    const evName = nameOf("weapon", evolvedId);
    if (weapon.level >= 8 && passive) hints.push(`✓ ${baseName}×${pName} = ${evName}`);
    else if (weapon.level >= 8) hints.push(i18n.format(T.recipeHintMissing, { base: baseName, passive: pName }));
    else if (passive) hints.push(`${baseName} Lv.${weapon.level}/8 · ${pName} ✓`);
  }
  $("recipe-hint").textContent = hints.length ? hints.join(" ｜ ") : T.recipeHintDefault;
}

function updateBestBlock() {
  const save = game.getSave();
  const std = save.best.standard;
  const end = save.best.endless;
  $("val-best-std").textContent = std ? `${"★".repeat(Math.max(1, std.stars))} ${std.score}` : "—";
  $("val-best-endless").textContent = end ? `${fmtTime(end.time)} · ${i18n.format(T.killsSuffix, { n: end.kills })}` : "—";
  $("val-codex-count").textContent = `${save.codex.weapons.length + save.codex.passives.length + save.codex.evolutions.length}/22`;
}

function resetHud() {
  $("val-timer").textContent = "—";
  $("hp-bar").style.width = "0%";
  $("bar-mow").style.width = "0%";
  $("mow-tag").classList.remove("is-ready");
  $("bar-xp").style.width = "0%";
  $("val-combo").textContent = "×1";
  $("val-kills").textContent = "0";
  $("val-level").textContent = "Lv.1";
  $("list-weapons").innerHTML = "<li class='loadout-empty'>—</li>";
  $("list-passives").innerHTML = "<li class='loadout-empty'>—</li>";
  $("recipe-hint").textContent = "—";
  updateBestBlock();
}

/* ------------------------------------------------------------ 输入 */

const keys = { up: false, down: false, left: false, right: false };

function keyVec() {
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (joystick.active) {
    dx = joystick.dx;
    dy = joystick.dy;
  }
  return { dx, dy };
}

window.addEventListener("keydown", (e) => {
  audio.unlock();
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if (k === "arrowup" || k === "w") keys.up = true;
  else if (k === "arrowdown" || k === "s") keys.down = true;
  else if (k === "arrowleft" || k === "a") keys.left = true;
  else if (k === "arrowright" || k === "d") keys.right = true;
  else if (k === " " || k === "shift") game.pressBurst();
  else if (k === "p" || k === "escape") {
    if (!game.state || game.state.phase === PHASES.ready) return;
    if (game.state.phase === PHASES.upgrading) return;
    game.togglePause();
    const open = game.state.phase === PHASES.paused;
    open ? showPanel("panel-pause") : hidePanel("panel-pause");
  } else if (k === "1" || k === "2" || k === "3") {
    const idx = Number(k) - 1;
    if (game.state && game.state.phase === PHASES.upgrading && game.state.choices && game.state.choices[idx]) {
      game.choose(idx);
      hidePanel("panel-upgrade");
    }
  }
});

window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === "arrowup" || k === "w") keys.up = false;
  else if (k === "arrowdown" || k === "s") keys.down = false;
  else if (k === "arrowleft" || k === "a") keys.left = false;
  else if (k === "arrowright" || k === "d") keys.right = false;
});

/* 触控摇杆 */
const joystick = { active: false, dx: 0, dy: 0, pid: null };
const jz = $("joystick-zone");
const jb = $("joystick-base");
const jk = $("joystick-knob");
const JOY_R = 46;

function joyVector(ev) {
  const rect = jz.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = ev.clientX - cx;
  let dy = ev.clientY - cy;
  const len = Math.hypot(dx, dy);
  if (len > JOY_R) {
    dx = (dx / len) * JOY_R;
    dy = (dy / len) * JOY_R;
  }
  return { dx: dx / JOY_R, dy: dy / JOY_R, px: dx, py: dy };
}

jz.addEventListener("pointerdown", (e) => {
  audio.unlock();
  e.preventDefault();
  joystick.active = true;
  joystick.pid = e.pointerId;
  jz.setPointerCapture(e.pointerId);
  const v = joyVector(e);
  joystick.dx = v.dx;
  joystick.dy = v.dy;
  jk.style.transform = `translate(${v.px}px, ${v.py}px)`;
});

jz.addEventListener("pointermove", (e) => {
  if (!joystick.active || e.pointerId !== joystick.pid) return;
  const v = joyVector(e);
  joystick.dx = v.dx;
  joystick.dy = v.dy;
  jk.style.transform = `translate(${v.px}px, ${v.py}px)`;
});

const endJoy = (e) => {
  if (e.pointerId !== joystick.pid) return;
  joystick.active = false;
  joystick.dx = 0;
  joystick.dy = 0;
  joystick.pid = null;
  jk.style.transform = "translate(0px, 0px)";
};
jz.addEventListener("pointerup", endJoy);
jz.addEventListener("pointercancel", endJoy);

$("pad-burst").addEventListener("pointerdown", (e) => {
  audio.unlock();
  e.preventDefault();
  game.pressBurst();
});
$("pad-pause").addEventListener("click", () => {
  audio.unlock();
  if (!game.state || game.state.phase === PHASES.ready || game.state.phase === PHASES.upgrading) return;
  game.togglePause();
  const open = game.state.phase === PHASES.paused;
  open ? showPanel("panel-pause") : hidePanel("panel-pause");
});

/* 顶部控制 */
$("btn-sound").addEventListener("click", () => {
  audio.unlock();
  const next = !audio.isMuted();
  audio.setMuted(next);
  game.save = storage.setMuted(game.save, next);
  $("btn-sound").textContent = next ? "🔇" : "🔊";
  $("btn-sound").setAttribute("aria-pressed", String(!next));
});

$("btn-lang").addEventListener("click", () => {
  const next = i18n.loadLocale() === "zh" ? "en" : "zh";
  i18n.saveLocale(next);
  window.location.reload();
});

$("btn-help").addEventListener("click", () => {
  audio.unlock();
  showPanel("panel-help");
});
$("btn-help-close").addEventListener("click", () => hidePanel("panel-help"));

/* ------------------------------------------------------------ 主循环 */

let last = performance.now();

function loop(now) {
  const dt = Math.min(50, now - last);
  last = now;
  if (game.state) {
    const vec = keyVec();
    game.setMove(vec.dx, vec.dy);
    game.step(dt);
    renderer.feedEvents(game.lastEvents);
    game.lastEvents = [];
  }
  renderer.render(game.snapshot());
  if (game.state) updateHud(now);
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------ 启动 */

window.addEventListener("resize", () => renderer.resize());
window.addEventListener("load", () => {
  applyTexts();
  audio.setMuted(game.getSave().prefs.muted);
  $("btn-sound").textContent = game.getSave().prefs.muted ? "🔇" : "🔊";
  bindModeChips();
  updateBestBlock();
  openStartPanel();
  requestAnimationFrame(loop);
});

// 渲染事件注入：让主循环把事件喂给粒子系统
game.lastEvents = [];
game.on((ev) => {
  if (game.lastEvents) game.lastEvents.push(ev);
});
