// ui.mjs —— 唯一碰 DOM 与 Canvas 的层：渲染萤火丛林观察窗、手账页签、幕布与弹层，把用户意图回调给 main。
// 展示文本 100% 走 i18n 字符串；本文件严禁裸写中文。

import { PALETTE, GRID, COLOR_COUNT, rowOf, colOf, worldColor, TURN, RIPPLE_LIFE } from "./engine.mjs";
import { format } from "./i18n.mjs";

const STAR_ON = "★";
const STAR_OFF = "☆";

function byId(id) {
  return document.getElementById(id);
}

const PHASE_KEYS = {
  [TURN.REVEAL]: "phaseReveal",
  [TURN.LIGHT]: "phaseLight",
  [TURN.CAMO]: "phaseCamo",
  [TURN.OBSERVE]: "phaseObserve",
  [TURN.SETTLE]: "phaseSettle",
  [TURN.OVER]: "phaseSettle",
};

export function createUi(handlers = {}) {
  const el = {
    stageTitle: byId("stage-title"),
    stageKicker: byId("stage-kicker"),
    phaseText: byId("phase-text"),
    roundBadge: byId("round-badge"),
    observeCanvas: byId("observe-canvas"),
    heatReadout: byId("heat-readout"),
    duelScore: byId("duel-score"),
    huntScore: byId("hunt-score"),
    scoreP1: byId("score-p1"),
    scoreP2: byId("score-p2"),
    huntStars: byId("hunt-stars"),
    blendValue: byId("blend-value"),
    probesValue: byId("probes-value"),
    hunterTools: byId("hunter-tools"),
    camoTools: byId("camo-tools"),
    colorPad: byId("color-pad"),
    footHint: byId("foot-hint"),
    curtain: byId("curtain"),
    curtainRole: byId("curtain-role"),
    curtainCount: byId("curtain-count"),
    btnSound: byId("btn-sound"),
    btnLang: byId("btn-lang"),
    btnHelp: byId("btn-help"),
    btnLevels: byId("btn-levels"),
    btnScan: byId("btn-scan"),
    btnAccuse: byId("btn-accuse"),
    btnPass: byId("btn-pass"),
    btnRefine: byId("btn-refine"),
    levelsBody: byId("levels-body"),
    panelReady: byId("panel-ready"),
    panelLevels: byId("panel-levels"),
    panelHelp: byId("panel-help"),
    panelResult: byId("panel-result"),
    resultKicker: byId("result-kicker"),
    resultTitle: byId("result-title"),
    resultBody: byId("result-body"),
    btnAgain: byId("btn-again"),
    btnNext: byId("btn-next"),
    btnLevels2: byId("btn-levels2"),
    toast: byId("toast"),
  };

  const ctx = el.observeCanvas.getContext("2d");
  let locale = "zh";
  let strings = {};
  let toastTimer = 0;
  let logical = 560;
  let dpr = 1;

  const TELL_PERIOD = 2400; // 呼吸破绽周期（ms）
  const TELL_AMP = 0.32; //    呼吸半径最大胀缩比例（× tell 强度）
  const reducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  // ---------------------------------------------------------------- 变色盘

  for (let i = 0; i < COLOR_COUNT; i += 1) {
    const swatch = document.createElement("button");
    swatch.className = "swatch";
    swatch.type = "button";
    swatch.style.background = PALETTE[i].css;
    swatch.setAttribute("aria-label", `${i + 1}`);
    swatch.dataset.color = String(i);
    swatch.addEventListener("click", () => handlers.onColorPick?.(i));
    el.colorPad.appendChild(swatch);
  }

  // ---------------------------------------------------------------- 事件绑定

  el.btnSound.addEventListener("click", () => handlers.onSound?.());
  el.btnLang.addEventListener("click", () => handlers.onLang?.());
  el.btnHelp.addEventListener("click", () => showOverlay(el.panelHelp));
  byId("btn-help-close").addEventListener("click", () => hideOverlay(el.panelHelp));
  el.btnLevels.addEventListener("click", () => handlers.onLevels?.());
  byId("btn-levels-close").addEventListener("click", () => handlers.onBack?.());
  byId("btn-mode-duel").addEventListener("click", () => handlers.onMode?.("duel"));
  byId("btn-mode-hunt").addEventListener("click", () => handlers.onMode?.("hunt"));
  byId("btn-mode-practice").addEventListener("click", () => handlers.onMode?.("practice"));
  el.btnScan.addEventListener("click", () => handlers.onScanButton?.());
  el.btnAccuse.addEventListener("click", () => handlers.onAccuseButton?.());
  el.btnPass.addEventListener("click", () => handlers.onPass?.());
  el.btnRefine.addEventListener("click", () => handlers.onRefine?.());
  el.btnAgain.addEventListener("click", () => handlers.onAgain?.());
  el.btnNext.addEventListener("click", () => handlers.onNext?.());
  el.btnLevels2.addEventListener("click", () => handlers.onLevels?.());

  el.observeCanvas.addEventListener("pointerdown", (event) => {
    const cell = cellFromEvent(event);
    if (cell !== null) handlers.onCell?.(cell);
  });

  // ---------------------------------------------------------------- 尺寸

  function syncSize() {
    const rect = el.observeCanvas.getBoundingClientRect();
    logical = Math.max(200, Math.round(rect.width));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    el.observeCanvas.width = Math.round(logical * dpr);
    el.observeCanvas.height = Math.round(logical * dpr);
  }

  function cellFromEvent(event) {
    const rect = el.observeCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const col = Math.floor((x / rect.width) * GRID);
    const row = Math.floor((y / rect.height) * GRID);
    if (row < 0 || row >= GRID || col < 0 || col >= GRID) return null;
    return row * GRID + col;
  }

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
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 1600);
  }

  // ---------------------------------------------------------------- 文案

  function applyStrings(nextLocale, nextStrings, { docLang } = {}) {
    locale = nextLocale;
    strings = nextStrings;
    const root = document;
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
    for (const sw of el.colorPad.querySelectorAll(".swatch")) {
      const idx = Number(sw.dataset.color);
      sw.setAttribute("aria-label", `${strings.actColor} ${idx + 1}`);
    }
    if (docLang) document.documentElement.lang = docLang;
    void locale;
  }

  function setSoundIcon(muted) {
    el.btnSound.textContent = muted ? "🔇" : "🔊";
    const label = muted ? strings.soundOff : strings.soundOn;
    el.btnSound.title = label;
    el.btnSound.setAttribute("aria-label", label);
  }

  // ---------------------------------------------------------------- 画布渲染

  function heatColor(heat) {
    const h = Math.max(0, Math.min(100, heat));
    if (h >= 55) return "rgba(207, 74, 60, 0.95)";
    if (h >= 30) return "rgba(217, 164, 65, 0.9)";
    return "rgba(120, 200, 160, 0.6)";
  }

  function drawCreature(cx, cy, r, color, glow) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(0.7, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow || g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function render(view, opts = {}) {
    if (!ctx || !view) return;
    const size = logical;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cell = size / GRID;
    const selected = opts.selectedCell ?? -1;

    // 网格与萤光居民
    for (let i = 0; i < GRID * GRID; i += 1) {
      const cx = colOf(i) * cell + cell / 2;
      const cy = rowOf(i) * cell + cell / 2;
      const colorIdx = worldColor(view.residents, i, view.phase);
      const base = PALETTE[colorIdx].css;

      // 底座淡光
      drawCreature(cx, cy, cell * 0.42, base, `rgba(255,255,255,0.06)`);

      if (i !== view.chameleonCell) {
        // 居民主体：柔和发光圆
        const r = cell * 0.24;
        const core = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        core.addColorStop(0, "rgba(255,255,255,0.85)");
        core.addColorStop(0.35, base);
        core.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 波纹显影（移动破绽：起落点渐隐环）
    for (const rip of view.ripples) {
      if (!(rip.t > 0)) continue;
      const cx = colOf(rip.cell) * cell + cell / 2;
      const cy = rowOf(rip.cell) * cell + cell / 2;
      const life = Math.max(0, Math.min(1, rip.t / RIPPLE_LIFE));
      const r = cell * (0.3 + (1 - life) * 0.75);
      ctx.strokeStyle = `rgba(234, 255, 208, ${(0.35 + life * 0.4).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 变色龙（可见时渲染于真实格位；行动期明显高亮，观察期与居民同形，靠波纹/热度破绽）
    if (view.chameleonCell >= 0) {
      const cx = colOf(view.chameleonCell) * cell + cell / 2;
      const cy = rowOf(view.chameleonCell) * cell + cell / 2;
      const cc = PALETTE[view.chameleonColor]?.css ?? "#ffffff";
      const acting = view.canChameleonAct;

      if (acting) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.34, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 呼吸破绽：观察期与居民同形，但轮廓周期性微胀微缩——融合度越低幅度越大，越易盯出。
      // 这是「不可伪造」的第二线索：只有变色龙会呼吸，居民恒静；行动期不呼吸（否则自曝）。
      const observing = view.turn === TURN.OBSERVE || view.turn === TURN.SETTLE;
      const tell = typeof view.tell === "number" && view.tell > 0 ? view.tell : 0;
      let breathe = 0;
      if (tell > 0 && observing && !acting) {
        breathe = reducedMotion
          ? 1 // 降级：静态最大轮廓，仍略大于居民、一眼可辨
          : Math.sin(((performance.now() % TELL_PERIOD) / TELL_PERIOD) * Math.PI * 2);
      }
      const r = cell * 0.27 * (1 + tell * TELL_AMP * breathe);

      const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      body.addColorStop(0, "rgba(255,255,255,0.9)");
      body.addColorStop(0.4, cc);
      body.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // 眼睛（仅行动期标识自身；观察期与居民同形、不画眼睛，把辨识留给呼吸破绽）
      if (acting) {
        const eye = r * 0.28;
        ctx.fillStyle = "#12281f";
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.15, eye, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.3, cy - r * 0.15, eye, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 扫探标记（热度色圈）
    for (const s of view.scans) {
      const cx = colOf(s.cell) * cell + cell / 2;
      const cy = rowOf(s.cell) * cell + cell / 2;
      ctx.strokeStyle = heatColor(s.heat);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 选中格
    if (selected >= 0 && selected < GRID * GRID) {
      const cx = colOf(selected) * cell + cell / 2;
      const cy = rowOf(selected) * cell + cell / 2;
      ctx.strokeStyle = "rgba(234, 255, 208, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // ---- DOM 读数 ----
    renderReadouts(view);
  }

  function renderReadouts(view) {
    // 阶段 + 角色
    const role = roleLabel(view);
    const phase = strings[PHASE_KEYS[view.turn]] ?? "";
    el.phaseText.textContent = role ? `${role} · ${phase}` : phase;

    // 回合徽章
    if (view.mode === "duel") {
      el.roundBadge.textContent = `${strings.hudRound} ${view.round}${view.suddenDeath ? " · " + strings.hudSudden : ""}`;
    } else if (view.mode === "hunt") {
      el.roundBadge.textContent = `${strings.hudRound} ${view.roundsUsed ? view.roundsUsed : view.round}`;
    } else {
      el.roundBadge.textContent = `${strings.hudRound} ${view.round}`;
    }

    // 比分 / 评级
    const isHunt = view.mode === "hunt";
    el.duelScore.classList.toggle("hidden", isHunt);
    el.huntScore.classList.toggle("hidden", !isHunt);
    if (isHunt) {
      el.huntStars.textContent = STAR_OFF.repeat(3);
    } else {
      el.scoreP1.textContent = String(view.p1Score);
      el.scoreP2.textContent = String(view.p2Score);
    }

    // 融合度 / 侦察点
    el.blendValue.textContent = String(Math.round(view.blend));
    el.probesValue.textContent = view.turn === TURN.OBSERVE ? String(view.probes) : "–";

    // 工具区显隐
    el.hunterTools.classList.toggle("hidden", !view.canHunterAct);
    el.camoTools.classList.toggle("hidden", !view.canChameleonAct);
    el.btnScan.disabled = !view.canHunterAct;
    el.btnAccuse.disabled = !view.canHunterAct;
    el.btnPass.disabled = !view.canHunterAct;

    // 变色盘选中态
    for (const sw of el.colorPad.querySelectorAll(".swatch")) {
      sw.classList.toggle("selected", Number(sw.dataset.color) === view.chameleonColor && view.canChameleonAct);
    }

    // 幕布
    renderCurtain(view);

    // 页脚提示
    el.footHint.textContent = footHint(view);
  }

  function roleLabel(view) {
    if (view.mode === "hunt") return strings.roleHunter;
    if (view.mode === "practice") return strings.roleChameleon;
    const chameleonIsP1 = view.half === 1;
    if (view.turn === TURN.CAMO) return chameleonIsP1 ? strings.hudP1 : strings.hudP2;
    if (view.turn === TURN.OBSERVE || view.turn === TURN.SETTLE) return chameleonIsP1 ? strings.hudP2 : strings.hudP1;
    return null;
  }

  function renderCurtain(view) {
    const inCamo = view.turn === TURN.CAMO && !view.over;
    el.curtain.classList.toggle("hidden", !inCamo);
    if (!inCamo) return;
    const count = Math.max(1, Math.ceil(view.turnTimer ?? 0));
    const peek = view.mode !== "hunt";
    el.curtain.classList.toggle("peek", peek);
    el.curtainRole.textContent = peek ? strings.curtainGo : strings.curtainClose;
    el.curtainCount.textContent = String(count);
  }

  function footHint(view) {
    if (view.mode === "duel" && view.turn === TURN.CAMO) return strings.curtainGo;
    if (view.turn === TURN.OBSERVE) return strings.hudHeat;
    return strings.curtainClose;
  }

  // ---------------------------------------------------------------- 弹层内容

  function buildLevels(save, unlockedFn) {
    el.levelsBody.innerHTML = "";
    const cleared = Object.keys(save.levels ?? {}).filter((id) => save.levels[id]?.cleared).length;
    const total = 10;
    const stat = document.createElement("div");
    stat.className = "read-row";
    stat.innerHTML = `<span>${format(strings.statCleared, { n: cleared, m: total })}</span><span>${format(strings.statStars, { n: save.records?.stars ?? 0 })}</span>`;
    el.levelsBody.appendChild(stat);

    for (let id = 1; id <= total; id += 1) {
      const rec = save.levels?.[id] ?? { stars: 0, cleared: false };
      const open = unlockedFn(id);
      const btn = document.createElement("button");
      btn.className = `level-card${open ? "" : " locked"}`;
      const aiLabel = strings[`ai_${Math.floor((id - 1) / 2) + 1}`] ?? "";
      btn.innerHTML =
        `<span class="lc-num">${id}</span>` +
        `<span class="lc-ai">${aiLabel}</span>` +
        `<span class="lc-stars">${STAR_ON.repeat(rec.stars || 0)}${STAR_OFF.repeat(Math.max(0, 3 - (rec.stars || 0)))}</span>`;
      if (open) btn.addEventListener("click", () => handlers.onLevelPick?.(id));
      else btn.title = strings.lockedNote;
      el.levelsBody.appendChild(btn);
    }
  }

  function showReady() {
    showOverlay(el.panelReady);
  }

  function showResult(result, view) {
    el.resultKicker.textContent = strings.resultTitle;
    el.resultBody.innerHTML = "";
    if (result.mode === "hunt") {
      el.resultTitle.textContent = result.caught ? strings.resultHuntCaught : strings.resultHuntEscaped;
      el.resultTitle.textContent = result.caught
        ? `${strings.resultHuntCaught} · ${strings["ai_" + (result.ai + 1)] ?? ""}`
        : strings.resultHuntEscaped;
      addRow(strings.resultStars, `${STAR_ON.repeat(result.stars)}${STAR_OFF.repeat(3 - result.stars)}`);
      if (result.caught) addRow(strings.resultRounds, String(result.roundsUsed));
      addRow(strings.resultWrong, String(result.wrongAccuses));
      el.btnNext.classList.toggle("hidden", !(result.caught && result.levelId < 10));
    } else {
      el.resultTitle.textContent =
        result.winner === 0 ? strings.resultTie : result.winner === 1 ? strings.resultP1 : strings.resultP2;
      addRow(strings.hudP1, String(result.p1Score));
      addRow(strings.hudP2, String(result.p2Score));
      if (result.suddenDeath) addRow(strings.hudSudden, "—");
      el.btnNext.classList.add("hidden");
    }
    void view;
    showOverlay(el.panelResult);
  }

  function addRow(label, value) {
    const row = document.createElement("div");
    row.className = "rr";
    row.innerHTML = `<span>${label}</span><b>${value}</b>`;
    el.resultBody.appendChild(row);
  }

  return {
    el,
    applyStrings,
    setSoundIcon,
    render,
    syncSize,
    toast,
    buildLevels,
    showReady,
    showResult,
    showLevels: () => showOverlay(el.panelLevels),
    hideLevels: () => hideOverlay(el.panelLevels),
    hideAllOverlays,
  };
}

export const UI_IDS = [
  "stage-title", "stage-kicker", "phase-text", "round-badge", "observe-canvas", "heat-readout",
  "duel-score", "hunt-score", "score-p1", "score-p2", "hunt-stars", "blend-value", "probes-value",
  "hunter-tools", "camo-tools", "color-pad", "foot-hint", "curtain", "curtain-role", "curtain-count",
  "btn-sound", "btn-lang", "btn-help", "btn-levels", "btn-scan", "btn-accuse", "btn-pass", "btn-refine",
  "levels-body", "panel-ready", "panel-levels", "panel-help", "panel-result", "result-kicker",
  "result-title", "result-body", "btn-again", "btn-next", "btn-levels2", "toast", "back-home",
];