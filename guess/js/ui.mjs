// ui.mjs —— 唯一碰 DOM 的层：渲染声呐舞台、机台与舷窗，把用户意图回调给 main

import { DIR, TEMP } from "./engine.mjs";
import { CHAPTERS, LEVELS, LEVEL_COUNT, MAIN_COUNT, levelById } from "./levels.mjs";
import { STAR_MAX, starThresholds } from "./score.mjs";
import { format } from "./i18n.mjs";

const STAR_ON = "★";
const STAR_OFF = "☆";

function byId(id) {
  return document.getElementById(id);
}

export function bandIntervalPercent(lo, hi, min, max) {
  // Each integer is a sonar cell. Use inclusive cell count for both the
  // offset and width so the first/last values align exactly with band edges.
  const cells = Math.max(1, max - min + 1);
  return {
    left: ((lo - min) / cells) * 100,
    width: Math.max(1.2, ((hi - lo + 1) / cells) * 100),
  };
}
export function createUi(handlers = {}) {
  const el = {
    app: byId("game-app"),
    title: byId("stage-title"),
    kicker: byId("stage-kicker"),
    plaqueChapter: byId("plaque-chapter"),
    plaqueLevel: byId("plaque-level"),
    plaqueRange: byId("plaque-range"),
    plaqueMech: byId("plaque-mech"),
    band: byId("sonar-band"),
    bandFog: byId("band-fog"),
    bandLive: byId("band-live"),
    bandBuoys: byId("band-buoys"),
    bandNote: byId("band-note"),
    scaleMin: byId("scale-min"),
    scaleMid: byId("scale-mid"),
    scaleMax: byId("scale-max"),
    dialValue: byId("dial-value"),
    dialHint: byId("dial-hint"),
    tubeSlots: byId("tube-slots"),
    tubeCount: byId("tube-count"),
    statUsed: byId("stat-used"),
    statPar: byId("stat-par"),
    statBest: byId("stat-best"),
    echoLog: byId("echo-log"),
    toast: byId("toast"),
    gearProbe: byId("btn-probe"),
    gearScan: byId("btn-scan"),
    gearRecall: byId("btn-recall"),
    btnFire: byId("btn-fire"),
    btnDel: byId("btn-del"),
    btnSound: byId("btn-sound"),
    btnLang: byId("btn-lang"),
    btnHelp: byId("btn-help"),
    btnLevels: byId("btn-levels"),
    levelsBody: byId("levels-body"),
    panelReady: byId("panel-ready"),
    panelLevels: byId("panel-levels"),
    panelHelp: byId("panel-help"),
    panelResult: byId("panel-result"),
    readyStats: byId("ready-stats"),
    resultKicker: byId("result-kicker"),
    resultTitle: byId("result-title"),
    resultTarget: byId("result-target"),
    resultStars: byId("result-stars"),
    resultRows: byId("result-rows"),
    resultNote: byId("result-note"),
    btnNext: byId("btn-next"),
    btnRetry: byId("btn-retry"),
  };

  let locale = "zh";
  let strings = {};
  let toastTimer = 0;

  // ---------------------------------------------------------------- 事件绑定

  for (const key of document.querySelectorAll("#keypad .key[data-digit]")) {
    key.addEventListener("click", () => handlers.onDigit?.(key.dataset.digit));
  }
  el.btnDel.addEventListener("click", () => handlers.onDel?.());
  el.btnFire.addEventListener("click", () => handlers.onFire?.());
  el.gearProbe.addEventListener("click", () => handlers.onGear?.("probe"));
  el.gearScan.addEventListener("click", () => handlers.onGear?.("scan"));
  el.gearRecall.addEventListener("click", () => handlers.onGear?.("recall"));
  el.btnSound.addEventListener("click", () => handlers.onSound?.());
  el.btnLang.addEventListener("click", () => handlers.onLang?.());
  el.btnHelp.addEventListener("click", () => showOverlay(el.panelHelp));
  byId("btn-help-close").addEventListener("click", () => hideOverlay(el.panelHelp));
  el.btnLevels.addEventListener("click", () => handlers.onLevels?.());
  byId("btn-levels-close").addEventListener("click", () => hideOverlay(el.panelLevels));
  byId("btn-dive").addEventListener("click", () => handlers.onDive?.());
  byId("btn-ready-levels").addEventListener("click", () => handlers.onLevels?.());
  el.btnNext.addEventListener("click", () => handlers.onNext?.());
  el.btnRetry.addEventListener("click", () => handlers.onRetry?.());
  byId("btn-result-levels").addEventListener("click", () => handlers.onLevels?.());

  // ---------------------------------------------------------------- 浮层

  function showOverlay(node) {
    node?.classList.remove("hidden");
  }
  function hideOverlay(node) {
    node?.classList.add("hidden");
  }
  function hideAllOverlays() {
    [el.panelReady, el.panelLevels, el.panelHelp, el.panelResult].forEach(hideOverlay);
  }

  // ---------------------------------------------------------------- toast

  function toast(message) {
    if (!el.toast || !message) return;
    el.toast.textContent = message;
    el.toast.classList.remove("hidden");
    el.toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
      el.toast.classList.add("hidden");
    }, 1600);
  }

  // ---------------------------------------------------------------- 舞台

  function pct(value, min, range) {
    return ((value - min) / Math.max(1, range)) * 100;
  }


  function mechLine(view) {
    const tags = [];
    if (view.drift > 0) tags.push(format(strings.mechDrift, { n: view.driftTurns, k: view.drift }));
    if (view.liars > 0) tags.push(strings.mechLiar);
    if (view.fog.length) tags.push(format(strings.mechFog, { n: view.fog.length }));
    if (view.blind) tags.push(strings.mechBlind);
    if (!tags.length) tags.push(strings.mechCalm);
    return tags.join(" · ");
  }

  function renderBand(view) {
    const { min, range } = { min: view.min, range: view.range - 1 };
    const span = Math.max(1, view.range - 1);
    el.scaleMin.textContent = String(view.min);
    el.scaleMax.textContent = String(view.max);
    el.scaleMid.textContent = String(Math.round((view.min + view.max) / 2));

    el.bandFog.innerHTML = "";
    for (const seg of view.fog) {
      const node = document.createElement("div");
      node.className = "fog-seg";
      node.style.left = `${pct(seg.lo, min, span)}%`;
      node.style.width = `${((seg.hi - seg.lo + 1) / span) * 100}%`;
      el.bandFog.appendChild(node);
    }

    const b = view.belief;
    const interval = bandIntervalPercent(b.lo, b.hi, view.min, view.max);
    el.bandLive.style.left = `${interval.left}%`;
    el.bandLive.style.width = `${interval.width}%`;
    el.bandLive.className = `band-live${b.conflict ? " is-conflict" : ""}`;
    el.band.classList.toggle("is-pressure", view.remaining > 0 && view.remaining <= 3);

    const last = view.log.filter((e) => e.kind === "guess").slice(-1)[0];
    const temp = last && !last.hit ? last.temp : null;
    el.band.dataset.temp = temp ?? "";
    el.band.dataset.tight = String(b.width <= Math.max(2, Math.round(view.range * 0.04)));

    el.bandBuoys.innerHTML = "";
    for (const entry of view.log) {
      if (entry.kind !== "guess") continue;
      const node = document.createElement("div");
      const side = entry.hit ? "hit" : entry.dir === DIR.HIGHER ? "higher" : entry.dir === DIR.LOWER ? "lower" : "silent";
      node.className = `buoy buoy-${side}${entry.liar ? " is-liar" : ""}`;
      node.style.left = `${pct(entry.value, min, span)}%`;
      node.title = `${entry.value}`;
      const dot = document.createElement("i");
      const tag = document.createElement("b");
      tag.textContent = String(entry.value);
      node.appendChild(dot);
      node.appendChild(tag);
      el.bandBuoys.appendChild(node);
    }
  }

  function renderNote(view) {
    const b = view.belief;
    let note = "";
    if (b.conflict) note = strings.conflict;
    else if (b.width <= 1) note = strings.cornered;
    else if (view.remaining > 0 && view.remaining <= 3) note = format(strings.pressure, { n: view.remaining });
    el.bandNote.textContent = note;
    el.bandNote.classList.toggle("is-warn", Boolean(note));
  }

  function renderTube(view) {
    const total = view.budget;
    if (el.tubeSlots.childElementCount !== total) {
      el.tubeSlots.innerHTML = "";
      for (let i = 0; i < total; i += 1) {
        const slot = document.createElement("i");
        el.tubeSlots.appendChild(slot);
      }
    }
    const slots = el.tubeSlots.children;
    for (let i = 0; i < total; i += 1) {
      slots[i].className = i < view.remaining ? "tube-on" : "tube-off";
    }
    el.tubeCount.textContent = `${view.remaining} / ${total}`;
  }

  function renderLog(view) {
    el.echoLog.innerHTML = "";
    for (const entry of [...view.log].reverse()) {
      const li = document.createElement("li");
      if (entry.kind === "guess") {
        const arrow = entry.hit ? "◎" : entry.dir === DIR.HIGHER ? "▶" : entry.dir === DIR.LOWER ? "◀" : "≈";
        li.className = `echo echo-${entry.hit ? "hit" : entry.silent ? "silent" : entry.dir ?? "silent"}`;
        const tempChip = entry.temp
          ? `<em class="chip chip-${entry.temp}">${entry.temp === TEMP.HOT ? strings.tempHot : entry.temp === TEMP.WARM ? strings.tempWarm : strings.tempCold}</em>`
          : `<em class="chip chip-off">${strings.tempOff}</em>`;
        li.innerHTML =
          `<span class="echo-turn">${entry.turn}</span>` +
          `<span class="echo-arrow">${arrow}</span>` +
          `<span class="echo-value">${entry.value}</span>` +
          tempChip +
          (entry.hit ? `<em class="chip chip-hit">${strings.echoHit}</em>` : "") +
          (entry.silent ? `<em class="chip chip-silent">${strings.silent}</em>` : "");
      } else if (entry.kind === "probe") {
        li.className = "echo echo-tool";
        li.innerHTML =
          `<span class="echo-turn">${entry.turn}</span>` +
          `<span class="echo-arrow">◎</span>` +
          `<span class="echo-value">${entry.parity === "odd" ? strings.probeOdd : strings.probeEven}</span>` +
          `<em class="chip chip-tool">${strings.btnProbe}</em>`;
      } else {
        li.className = "echo echo-tool";
        li.innerHTML =
          `<span class="echo-turn">${entry.turn}</span>` +
          `<span class="echo-arrow">⇅</span>` +
          `<span class="echo-value">${entry.half === "lower" ? strings.scanLower : strings.scanUpper}</span>` +
          `<em class="chip chip-tool">${strings.btnScan}</em>`;
      }
      el.echoLog.appendChild(li);
    }
  }

  function renderGear(view) {
    const map = [
      [el.gearProbe, view.tools.probe, 1],
      [el.gearScan, view.tools.scan, 2],
      [el.gearRecall, view.tools.recall, 0],
    ];
    for (const [node, left] of map) {
      node.classList.toggle("is-spent", left <= 0 || view.status !== "playing");
      const cost = node.querySelector(".gear-cost");
      if (cost) cost.textContent = `×${left}`;
    }
  }

  function renderAll(view, extra = {}) {
    if (!view) return;
    const chapter = CHAPTERS.find((c) => c.id === view.level.ch);
    el.plaqueChapter.textContent = format(strings.hudChapter, { n: view.level.ch });
    el.plaqueLevel.textContent = `${chapter ? strings[chapter.nameKey] : ""} · ${format(strings.hudLevel, { n: view.level.id })}`;
    el.plaqueRange.textContent = `${strings.hudRange} ${view.min} – ${view.max}`;
    el.plaqueMech.textContent = mechLine(view);
    el.dialHint.textContent = `${view.min} – ${view.max}`;
    renderBand(view);
    renderNote(view);
    renderTube(view);
    renderLog(view);
    renderGear(view);
    el.statUsed.textContent = `${view.used} / ${view.budget}`;
    const th = starThresholds(view.level);
    el.statPar.textContent = `${th.par}`;
    el.statBest.textContent = extra.best ? `${extra.best}` : "–";
    el.btnFire.classList.toggle("is-hot", String(el.dialValue.textContent ?? "").length > 0);
  }

  // ---------------------------------------------------------------- 文案与浮层内容

  function applyStrings(nextLocale, nextStrings, { html = document, docLang } = {}) {
    locale = nextLocale;
    strings = nextStrings;
    const root = html;
    for (const node of root.querySelectorAll("[data-i18n]")) {
      const v = strings[node.dataset.i18n];
      if (typeof v === "string" && v) node.textContent = v;
    }
    for (const node of root.querySelectorAll("[data-i18n-title]")) {
      const v = strings[node.dataset.i18nTitle];
      if (typeof v === "string" && v) node.setAttribute("title", v);
    }
    for (const node of root.querySelectorAll("[data-i18n-aria]")) {
      const v = strings[node.dataset.i18nAria];
      if (typeof v === "string" && v) node.setAttribute("aria-label", v);
    }
    el.btnLang.textContent = strings.langSwitch;
    el.gearProbe.title = strings.toolProbeTip;
    el.gearScan.title = strings.toolScanTip;
    el.gearRecall.title = strings.toolRecallTip;
    if (docLang) document.documentElement.lang = docLang;
    void locale;
  }

  function setSoundIcon(muted) {
    el.btnSound.textContent = muted ? "🔇" : "🔊";
    el.btnSound.title = muted ? strings.soundOff : strings.soundOn;
    el.btnSound.setAttribute("aria-label", muted ? strings.soundOff : strings.soundOn);
  }

  function setDial(text) {
    el.dialValue.textContent = text || "–";
  }

  function buildLevels(save, unlockedFn) {
    el.levelsBody.innerHTML = "";
    for (const chapter of CHAPTERS) {
      const block = document.createElement("section");
      block.className = "chapter-block";
      const head = document.createElement("h3");
      head.innerHTML = `<span>${format(strings.hudChapter, { n: chapter.id })} · ${strings[chapter.nameKey]}</span>`;
      const stars = document.createElement("em");
      stars.textContent = `${"★".repeat(Math.min(STAR_MAX, chapterStars(save, chapter.id) ? Math.min(STAR_MAX, Math.round(chapterStars(save, chapter.id) / 6)) : 0))}`;
      head.appendChild(stars);
      block.appendChild(head);
      const row = document.createElement("div");
      row.className = "level-row";
      for (const lvl of LEVELS.filter((l) => l.ch === chapter.id)) {
        const rec = save.levels[lvl.id] ?? { stars: 0, cleared: false };
        const open = unlockedFn(lvl.id);
        const btn = document.createElement("button");
        btn.className = `level-btn${open ? "" : " is-locked"}${rec.cleared ? " is-cleared" : ""}`;
        btn.innerHTML =
          `<b>${lvl.id}</b><span class="lv-range">${lvl.min}–${lvl.max}</span>` +
          `<span class="lv-stars">${STAR_ON.repeat(rec.stars) || ""}${STAR_OFF.repeat(Math.max(0, STAR_MAX - rec.stars))}</span>`;
        btn.title = open ? `${lvl.min} – ${lvl.max}` : lvl.id > MAIN_COUNT ? strings.blindNote : strings.lockedNote;
        if (open) btn.addEventListener("click", () => handlers.onLevelPick?.(lvl.id));
        row.appendChild(btn);
      }
      block.appendChild(row);
      el.levelsBody.appendChild(block);
    }
  }

  function chapterStars(save, ch) {
    let sum = 0;
    for (const lvl of LEVELS) if (lvl.ch === ch) sum += save.levels[lvl.id]?.stars ?? 0;
    return sum;
  }

  function showReady(save) {
    const cleared = LEVELS.filter((l) => save.levels[l.id]?.cleared).length;
    const aces = LEVELS.filter((l) => (save.levels[l.id]?.stars ?? 0) >= STAR_MAX).length;
    el.readyStats.innerHTML =
      `<span>${format(strings.statCleared, { n: cleared, m: LEVEL_COUNT })}</span>` +
      `<span>${format(strings.statAces, { n: aces })}</span>` +
      (save.records?.fewest ? `<span>${format(strings.statFewest, { n: save.records.fewest })}</span>` : "");
    showOverlay(el.panelReady);
  }

  function showResult(result, view) {
    el.resultKicker.textContent = result.won ? strings.resultWin : strings.resultLose;
    el.resultTitle.textContent = strings[result.rankKey] ?? "";
    el.resultTarget.textContent = format(strings.resultTarget, { n: result.target });
    el.resultStars.innerHTML = "";
    for (let i = 0; i < STAR_MAX; i += 1) {
      const star = document.createElement("span");
      star.className = `star${i < result.stars ? " is-on" : ""}`;
      star.textContent = i < result.stars ? STAR_ON : STAR_OFF;
      star.style.animationDelay = `${i * 140}ms`;
      el.resultStars.appendChild(star);
    }
    const th = result.thresholds;
    el.resultRows.innerHTML =
      `<div><span>${strings.resultUsed}</span><b>${result.used}</b></div>` +
      `<div><span>${strings.resultPar}</span><b>${th.par}</b></div>` +
      `<div><span>${strings.hudEff}</span><b>${result.efficiency}%</b></div>`;
    let note = result.won ? strings.resultNoteWin : strings.resultNoteLose;
    if (result.lieShown) note += ` ${format(strings.resultReveal, { n: result.lieTurn })}`;
    el.resultNote.textContent = note;
    el.btnNext.classList.toggle("hidden", !result.won || result.levelId >= LEVEL_COUNT);
    showOverlay(el.panelResult);
    void view;
  }

  function flashBand(kind) {
    if (!el.band) return;
    el.band.classList.remove("flash-hit", "flash-echo");
    void el.band.offsetWidth;
    el.band.classList.add(kind === "hit" ? "flash-hit" : "flash-echo");
  }

  return {
    el,
    applyStrings,
    renderAll,
    setDial,
    setSoundIcon,
    toast,
    showReady,
    showResult,
    showLevels: () => showOverlay(el.panelLevels),
    hideLevels: () => hideOverlay(el.panelLevels),
    hideReady: () => hideOverlay(el.panelReady),
    hideResult: () => hideOverlay(el.panelResult),
    hideAllOverlays,
    buildLevels,
    flashBand,
    levelById,
  };
}

export const UI_IDS = [
  "game-app", "stage-title", "stage-kicker", "plaque-chapter", "plaque-level", "plaque-range", "plaque-mech",
  "sonar-band", "band-fog", "band-live", "band-buoys", "band-note", "scale-min", "scale-mid", "scale-max",
  "dial-value", "dial-hint", "tube-slots", "tube-count", "stat-used", "stat-par", "stat-best", "echo-log",
  "toast", "btn-probe", "btn-scan", "btn-recall", "btn-fire", "btn-del", "btn-sound", "btn-lang", "btn-help",
  "btn-levels", "levels-body", "panel-ready", "panel-levels", "panel-help", "panel-result", "ready-stats",
  "result-kicker", "result-title", "result-target", "result-stars", "result-rows", "result-note",
  "btn-next", "btn-retry", "back-home", "btn-dive", "btn-ready-levels", "btn-levels-close", "btn-help-close",
  "btn-result-levels",
];
