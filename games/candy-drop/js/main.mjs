// main.mjs: 装配入口 —— 绑定事件、驱动帧循环、同步 HUD 与幕布（唯一碰 DOM 的装配层）

import { createGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createAudio } from "./audio.mjs";
import * as i18n from "./i18n.mjs";
import { LEVEL_COUNT, LEVELS_PER_BOX, BOXES, levelById, levelsOfBox } from "./levels.mjs";
import { TOTAL_MAX, BOX_UNLOCK_STARS } from "./score.mjs";
import { isBoxUnlocked, isLevelUnlocked } from "./storage.mjs";
import { ropeAnchor } from "./engine.mjs";

const $ = (id) => document.getElementById(id);
const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const els = {
  board: $("board"),
  boxName: $("box-name"),
  boxProgress: $("box-progress"),
  levelKicker: $("level-kicker"),
  levelName: $("level-name"),
  levelHint: $("level-hint"),
  starRow: $("star-row"),
  starCount: $("star-count"),
  totalScore: $("total-score"),
  totalMax: $("total-max"),
  boxStars: $("box-stars"),
  cutCount: $("cut-count"),
  toolNote: $("tool-note"),
  veilReady: $("veil-ready"),
  veilLevels: $("veil-levels"),
  veilResult: $("veil-result"),
  veilHelp: $("veil-help"),
  boxTabs: $("box-tabs"),
  levelGrid: $("level-grid"),
  levelsNote: $("levels-note"),
  resultTitle: $("result-title"),
  resultBadge: $("result-badge"),
  resultStars: $("result-stars"),
  resultScore: $("result-score"),
  resultTotal: $("result-total"),
  resultCuts: $("result-cuts"),
  resultTime: $("result-time"),
  resultNote: $("result-note"),
  helpList: $("help-list"),
  soundIcon: $("sound-icon"),
};

let locale = i18n.loadLocale();
let S = i18n.strings(locale);

const audio = createAudio({ muted: false });
const renderer = createRenderer({ canvas: els.board, reduceMotion });
const game = createGame({ audio });

let currentBox = 1;
let trail = [];
let drag = null; // { mode: "slice" | "slide", rope, last }
let audioUnlocked = false;

// ---------------- i18n 套用 ----------------
function applyI18n() {
  S = i18n.strings(locale);
  document.documentElement.lang = i18n.htmlLang(locale);
  document.title = S.docTitle;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", S.metaDesc);
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const key = node.getAttribute("data-i18n");
    const value = S[key];
    if (typeof value === "string") node.textContent = value;
  }
  for (const node of document.querySelectorAll("[data-i18n-title]")) {
    const key = node.getAttribute("data-i18n-title");
    const value = S[key];
    if (typeof value === "string") node.setAttribute("title", value);
  }
  els.board.setAttribute("aria-label", S.canvasAria);
  els.totalMax.textContent = `/ ${TOTAL_MAX}`;
  renderHelp();
  syncUI();
  renderLevels();
}

function renderHelp() {
  const items = [S.help1, S.help2, S.help3, S.help4, S.help5, S.help6].filter(Boolean);
  els.helpList.innerHTML = "";
  for (const text of items) {
    const li = document.createElement("li");
    li.textContent = text;
    els.helpList.appendChild(li);
  }
}

// ---------------- HUD ----------------
function bump(el) {
  if (reduceMotion) return;
  el.classList.remove("bump");
  // 强制重排以重启动画
  void el.offsetWidth;
  el.classList.add("bump");
}

function paintStars(container, count) {
  for (const dot of container.querySelectorAll(".star-dot")) {
    const slot = Number(dot.getAttribute("data-slot"));
    dot.classList.toggle("on", slot < count);
  }
}

function syncUI() {
  const snap = game.get();
  const lvl = snap.level ?? levelById(1);
  const box = BOXES[Math.max(0, Math.min(BOXES.length - 1, lvl.box - 1))];

  document.body.dataset.theme = box.theme;
  renderer.setTheme(box.theme);

  els.boxName.textContent = box.name[locale] ?? box.name.zh;
  els.boxProgress.textContent = i18n.format(S.hudBoxProgress, { n: snap.boxStars });
  els.levelKicker.textContent = i18n.format(S.hudLevelValue, { n: lvl.id });
  els.levelName.textContent = lvl.name[locale] ?? lvl.name.zh;
  els.levelHint.textContent = lvl.hint[locale] ?? lvl.hint.zh;
  els.boxStars.textContent = String(snap.boxStars);
  els.totalScore.textContent = String(snap.totalScore);

  const stars = snap.state ? snap.state.starsTaken : 0;
  paintStars(els.starRow, stars);
  els.starCount.textContent = i18n.format(S.hudStarCount, { n: stars });
  els.cutCount.textContent = String(snap.state ? snap.state.cuts : 0);

  const tools = [];
  if (lvl.bubbles?.length) tools.push("🫧");
  if (lvl.cushions?.length) tools.push("💨");
  if (lvl.spikes?.length) tools.push("✳");
  if (lvl.ropes?.some((r) => r.auto)) tools.push("⟳");
  if (lvl.ropes?.some((r) => r.rail)) tools.push("↔");
  if (lvl.ropes?.some((r) => r.elastic)) tools.push("〰");
  els.toolNote.textContent = tools.length ? tools.join(" ") : "—";

  $("btn-puff").disabled = !(snap.state?.cushions?.length && snap.screen === "playing");
  $("btn-pop").disabled = !(game.isPlaying() && game.hasBubble());
  $("btn-resume").hidden = !(snap.save?.last > 1);
}

// ---------------- 幕布 ----------------
function showVeil(which) {
  const map = {
    ready: els.veilReady,
    levels: els.veilLevels,
    result: els.veilResult,
    help: els.veilHelp,
  };
  for (const [key, el] of Object.entries(map)) el.hidden = key !== which;
}

function openLevels() {
  currentBox = Math.max(1, Math.min(BOXES.length, levelById(game.get().levelId)?.box ?? 1));
  renderLevels();
  showVeil("levels");
}

function renderLevels() {
  const save = game.getSave();
  els.boxTabs.innerHTML = "";
  BOXES.forEach((box, i) => {
    const unlocked = isBoxUnlocked(save, box.box);
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "box-tab";
    tab.setAttribute("aria-selected", String(box.box === currentBox));
    tab.disabled = !unlocked;
    const stars = levelsOfBox(box.box).reduce((sum, l) => sum + (save.levels?.[l.id]?.stars ?? 0), 0);
    tab.textContent = `${i18n.format(S.boxLabel, { n: box.box })} · ${box.name[locale] ?? box.name.zh}`;
    tab.title = unlocked
      ? `${stars} / ${LEVELS_PER_BOX * 3}`
      : i18n.format(S.boxLocked, { n: BOX_UNLOCK_STARS });
    tab.addEventListener("click", () => {
      currentBox = box.box;
      renderLevels();
    });
    els.boxTabs.appendChild(tab);
  });

  els.levelGrid.innerHTML = "";
  const curId = game.get().levelId;
  for (const lvl of levelsOfBox(currentBox)) {
    const rec = save.levels?.[lvl.id];
    const unlocked = isLevelUnlocked(save, lvl.id);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "level-cell";
    if (lvl.id === curId) cell.classList.add("is-current");
    if (rec?.cleared) cell.classList.add("is-cleared");
    cell.disabled = !unlocked;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = unlocked ? String(lvl.id) : "🔒";
    const s = document.createElement("span");
    s.className = "s";
    s.textContent = unlocked ? "★".repeat(rec?.stars ?? 0) + "☆".repeat(3 - (rec?.stars ?? 0)) : "";
    cell.append(n, s);
    cell.title = unlocked ? `${lvl.name[locale] ?? lvl.name.zh}` : S.levelsLocked;
    cell.addEventListener("click", () => {
      if (!game.start(lvl.id)) return;
      showVeil(null);
    });
    els.levelGrid.appendChild(cell);
  }

  const stars = levelsOfBox(currentBox).reduce((sum, l) => sum + (save.levels?.[l.id]?.stars ?? 0), 0);
  els.levelsNote.textContent = `${i18n.format(S.boxLabel, { n: currentBox })} · ${stars} / ${
    LEVELS_PER_BOX * 3
  } ★`;
}

function showResult(result) {
  els.resultTitle.textContent = result.won ? S.resultWinTitle : S.resultLoseTitle;
  els.resultBadge.hidden = !result.improved;
  paintStars(els.resultStars, result.stars);
  els.resultScore.textContent = String(result.score);
  els.resultTotal.textContent = String(game.get().totalScore);
  els.resultCuts.textContent = String(result.cuts);
  els.resultTime.textContent = `${result.time.toFixed(1)}s`;
  if (result.won) {
    if (result.isLast) els.resultNote.textContent = S.gameCleared;
    else if (result.boxDone) els.resultNote.textContent = S.boxCleared;
    else els.resultNote.textContent = "";
  } else {
    els.resultNote.textContent =
      result.reason === "spike" ? S.loseSpike : result.reason === "out" ? S.loseOut : S.loseSettled;
  }
  $("btn-next").hidden = !result.won || result.isLast;
  showVeil("result");
}

// ---------------- 输入 ----------------
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audio.unlock();
}

function pointAt(evt) {
  return renderer.toWorld(evt.clientX, evt.clientY);
}

function onDown(evt) {
  unlockAudio();
  if (!game.isPlaying()) return;
  els.board.setPointerCapture?.(evt.pointerId);
  const p = pointAt(evt);
  // 命中滑轨把手 → 拖动模式
  const st = game.get().state;
  if (st) {
    for (const rope of st.ropes) {
      if (!rope.rail || rope.cut) continue;
      const a = ropeAnchor(rope);
      if (Math.hypot(a.x - p.x, a.y - p.y) <= 26) {
        drag = { mode: "slide", rope, last: p };
        return;
      }
    }
  }
  drag = { mode: "slice", last: p, moved: 0, start: p };
  trail = [p];
}

function onMove(evt) {
  if (!drag || !game.isPlaying()) return;
  const p = pointAt(evt);
  if (drag.mode === "slide") {
    const rail = drag.rope.rail;
    const dx = rail.to[0] - rail.from[0];
    const dy = rail.to[1] - rail.from[1];
    const len2 = dx * dx + dy * dy || 1;
    const t = ((p.x - rail.from[0]) * dx + (p.y - rail.from[1]) * dy) / len2;
    game.slide(drag.rope.index, t);
    drag.last = p;
    return;
  }
  drag.moved += Math.hypot(p.x - drag.last.x, p.y - drag.last.y);
  trail.push(p);
  if (trail.length > 24) trail.shift();
  game.slice(drag.last.x, drag.last.y, p.x, p.y);
  drag.last = p;
}

function onUp(evt) {
  if (!drag) return;
  const p = pointAt(evt);
  if (drag.mode === "slice" && drag.moved < 9) {
    // 轻点：命中气泡则戳破
    const st = game.get().state;
    if (st) {
      const bub = st.bubbles[st.attached];
      if (bub && bub.alive && Math.hypot(bub.x - p.x, bub.y - p.y) <= bub.r) game.popBubble();
    }
  }
  drag = null;
  trail = [];
}

els.board.addEventListener("pointerdown", onDown);
els.board.addEventListener("pointermove", onMove);
window.addEventListener("pointerup", onUp);
window.addEventListener("pointercancel", onUp);
els.board.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------------- 按钮 ----------------
$("btn-start").addEventListener("click", () => {
  unlockAudio();
  game.start(1);
  showVeil(null);
});
$("btn-resume").addEventListener("click", () => {
  unlockAudio();
  const save = game.getSave();
  game.start(isLevelUnlocked(save, save.last) ? save.last : 1);
  showVeil(null);
});
$("btn-open-levels").addEventListener("click", openLevels);
$("btn-levels").addEventListener("click", openLevels);
$("btn-close-levels").addEventListener("click", () => {
  showVeil(game.isPlaying() ? null : "ready");
});
$("btn-help").addEventListener("click", () => showVeil("help"));
$("btn-close-help").addEventListener("click", () => {
  showVeil(game.isPlaying() ? null : "ready");
});
$("btn-retry").addEventListener("click", () => {
  unlockAudio();
  game.retry();
  showVeil(null);
});
$("btn-retry-2").addEventListener("click", () => {
  game.retry();
  showVeil(null);
});
$("btn-next").addEventListener("click", () => {
  if (!game.next()) openLevels();
  else showVeil(null);
});
$("btn-to-levels").addEventListener("click", openLevels);
$("btn-puff").addEventListener("click", () => {
  unlockAudio();
  game.puff(0);
});
$("btn-pop").addEventListener("click", () => {
  unlockAudio();
  game.popBubble();
});
$("btn-sound").addEventListener("click", () => {
  const next = !audio.isMuted();
  audio.setMuted(next);
  game.setMuted(next);
  $("btn-sound").setAttribute("aria-pressed", String(next));
  els.soundIcon.textContent = next ? "✕" : "♪";
  const label = document.querySelector('#btn-sound [data-i18n="soundOn"]');
  if (label) {
    label.setAttribute("data-i18n", next ? "soundOff" : "soundOn");
    label.textContent = next ? S.soundOff : S.soundOn;
  }
});
$("btn-lang").addEventListener("click", () => {
  locale = locale === "zh" ? "en" : "zh";
  i18n.saveLocale(locale);
  applyI18n();
});

// 键盘：R 重来 / 空格吹气 / Esc 关闭幕布
window.addEventListener("keydown", (evt) => {
  if (evt.key === "r" || evt.key === "R") {
    if (game.get().screen === "playing") {
      game.retry();
      showVeil(null);
    }
  } else if (evt.key === " ") {
    if (game.isPlaying()) {
      evt.preventDefault();
      game.puff(0);
    }
  } else if (evt.key === "Escape") {
    if (!els.veilHelp.hidden || !els.veilLevels.hidden) showVeil(game.isPlaying() ? null : "ready");
  }
});

// ---------------- 帧循环 ----------------
let last = 0;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;

  // 轨迹淡出
  if (trail.length) trail.shift();

  game.tick(dt);
  const snap = game.get();
  renderer.draw(snap, trail, dt);
  if (snap.screen === "playing") syncUI();
  requestAnimationFrame(frame);
}

// 事件订阅：音效与粒子
game.on((evt) => {
  if (evt.type === "fx") {
    renderer.fx(evt.event, game.get().state);
    if (evt.event.type === "star") bump(els.starCount);
  } else if (evt.type === "start") {
    trail = [];
    renderer.clearFx();
    syncUI();
  } else if (evt.type === "result") {
    showResult(evt.result);
    syncUI();
  } else if (evt.type === "change") {
    syncUI();
  }
});

window.addEventListener("resize", () => renderer.resize());

// ---------------- 启动 ----------------
function boot() {
  const save = game.getSave();
  if (save.muted) {
    audio.setMuted(true);
    $("btn-sound").setAttribute("aria-pressed", "true");
    els.soundIcon.textContent = "✕";
  }
  renderer.resize();
  applyI18n();
  showVeil("ready");
  requestAnimationFrame(frame);
}

boot();
