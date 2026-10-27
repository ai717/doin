// ui.mjs — 唯一碰 DOM 的层（除 main.mjs 的装配绑定外）。
// 职责：把 state 翻译成舷窗上的仪表与面板，把用户的点击翻译成 intent 回调。
// 绝不自己算分、绝不改 state —— 分数口径在 score.mjs，规则在 engine.mjs。

import { FRENZY_MULT, MAX_TIER, growthNeeded } from "./engine.mjs";
import { zoneOf } from "./levels.mjs";
import { format, strings as stringsOf } from "./i18n.mjs";
import { formatNumber, formatTime } from "./score.mjs";

const PANELS = ["ready", "levels", "result", "help", "paused", "abyss"];

function el(id, root) {
  return root.getElementById(id);
}

export function createUI(options = {}) {
  const doc = options.document ?? globalThis.document;
  const onIntent = options.onIntent ?? (() => {});
  const refs = {};
  const ids = [
    "porthole", "viewport", "sea", "back-home",
    "hud-zone", "hud-level-no", "hud-level-name",
    "help-btn", "sound-btn", "sound-glyph", "lang-btn", "lang-glyph",
    "pause-btn", "pause-glyph", "restart-btn",
    "dial", "dial-needle", "dial-stage", "dial-zone",
    "hearts", "pressure", "pressure-label", "pressure-fill",
    "compass", "compass-mult", "compass-combo",
    "tube-tier", "tube-quota", "tube-fill",
    "frenzy-banner", "toasts", "hint",
    "overlay",
    "panel-ready", "ready-kicker", "ready-title", "ready-desc", "ready-hint",
    "btn-start", "btn-levels", "btn-abyss",
    "panel-levels", "levels-title", "levels-total", "zones", "levels-close", "reset-save",
    "panel-result", "result-badge", "result-title", "result-sub", "pearl-tray", "tally",
    "result-next", "result-retry", "result-home",
    "panel-help", "help-title", "help-list", "help-close",
    "panel-paused", "paused-title", "paused-desc", "paused-resume", "paused-restart", "paused-home",
    "panel-abyss", "abyss-badge", "abyss-end-title", "abyss-end-desc", "abyss-best",
    "abyss-retry", "abyss-exit",
  ];
  for (const id of ids) refs[id] = el(id, doc);

  let locale = "zh";
  let t = stringsOf("zh");
  let lastCombo = 0;
  let lastFrenzy = 0;
  let toastTimers = [];

  // ---------- 文案 ----------
  function applyStrings(nextLocale) {
    locale = nextLocale;
    t = stringsOf(locale);
    const html = doc.documentElement;
    html.lang = locale === "zh" ? "zh-CN" : "en";
    doc.title = t.docTitle;
    const meta = doc.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t.metaDesc);

    refs["back-home"].textContent = t.back;
    refs["help-btn"].setAttribute("aria-label", t.ariaHelp);
    refs["help-btn"].setAttribute("title", t.help);
    refs["sound-btn"].setAttribute("aria-label", t.ariaSound);
    refs["sound-btn"].setAttribute("title", t.sound);
    refs["lang-btn"].setAttribute("aria-label", t.ariaLang);
    refs["lang-btn"].setAttribute("title", t.langLabel);
    refs["lang-glyph"].textContent = t.langSwitch;
    refs["pause-btn"].setAttribute("aria-label", t.ariaPause);
    refs["pause-btn"].setAttribute("title", t.pause);
    refs["restart-btn"].setAttribute("aria-label", t.ariaRestart);
    refs["restart-btn"].setAttribute("title", t.restart);
    refs.sea.setAttribute("aria-label", t.ariaSea);
    refs["pressure-label"].textContent = t.hudPressure;
    refs["ready-kicker"].textContent = t.kicker;
    refs["ready-title"].textContent = t.readyTitle;
    refs["ready-desc"].textContent = t.readyDesc;
    refs["ready-hint"].textContent = `${t.tipMove} · ${t.tipSprint} · ${t.tipPause}`;
    refs["btn-start"].textContent = t.btnStart;
    refs["btn-levels"].textContent = t.btnLevels;
    refs["btn-abyss"].textContent = t.btnAbyss;
    refs["levels-title"].textContent = t.levelsTitle;
    refs["levels-close"].textContent = t.btnClose;
    refs["reset-save"].textContent = t.resetBtn;
    refs["help-title"].textContent = t.helpTitle;
    refs["help-close"].textContent = t.btnClose;
    refs["paused-title"].textContent = t.pausedTitle;
    refs["paused-desc"].textContent = t.pausedDesc;
    refs["paused-resume"].textContent = t.resume;
    refs["paused-restart"].textContent = t.restart;
    refs["paused-home"].textContent = t.btnHome;
    refs["abyss-end-title"].textContent = t.abyssEnd;
    refs["abyss-retry"].textContent = t.btnAbyssRetry;
    refs["abyss-exit"].textContent = t.btnAbyssExit;
    setHint(t.tipMove);
    renderHelp();
  }

  function renderHelp() {
    refs["help-list"].replaceChildren();
    for (const line of t.helpItems) {
      const li = doc.createElement("li");
      li.textContent = line;
      refs["help-list"].append(li);
    }
  }

  // 评级标签是 score.mjs 给的机器可读串（"pass" / "noHit" / "parTime:24" …），这里翻译成中文。
  function starCaption(label) {
    if (!label) return "";
    const [kind, raw] = String(label).split(":");
    if (kind === "pass") return t.starPass;
    if (kind === "noHit") return t.starNoHit;
    if (kind === "parTime") return format(t.starParTime, raw);
    if (kind === "frenzy") return t.starFrenzy;
    if (kind === "shoal") return t.starShoal;
    if (kind === "eatCount") return format(t.starEatCount, raw);
    return "";
  }

  function tierName(tier) {
    const index = Math.max(0, Math.min(t.tierNames.length - 1, Math.round(tier) - 1));
    return t.tierNames[index];
  }

  // ---------- 面板 ----------
  let currentPanel = null;

  function showPanel(name) {
    currentPanel = name;
    refs.overlay.hidden = name === null;
    for (const key of PANELS) {
      const node = refs[`panel-${key}`];
      if (node) node.hidden = key !== name;
    }
  }

  function hidePanels() {
    showPanel(null);
  }

  function buildLevels(model) {
    refs["levels-total"].textContent = format(t.levelsTotalPearls, model.totalPearls);
    const box = refs.zones;
    box.replaceChildren();
    for (const zone of model.zones) {
      const card = doc.createElement("section");
      card.className = `zone-card${zone.unlocked ? "" : " is-locked"}`;

      const head = doc.createElement("div");
      head.className = "zone-head";
      const name = doc.createElement("span");
      name.className = "zone-name";
      name.textContent = `${zone.zone} · ${zone.name}`;
      const pearls = doc.createElement("span");
      pearls.className = "zone-pearls";
      pearls.textContent = format(t.levelsZonePearls, zone.pearls);
      head.append(name, pearls);

      const blurb = doc.createElement("p");
      blurb.className = "zone-blurb";
      blurb.textContent = zone.blurb;
      card.append(head, blurb);

      if (zone.unlocked) {
        const grid = doc.createElement("div");
        grid.className = "level-grid";
        for (const level of zone.levels) {
          const cell = doc.createElement("button");
          cell.type = "button";
          cell.className = `level-cell${level.current ? " is-current" : ""}`;
          cell.dataset.levelId = level.id;
          cell.setAttribute("aria-label", `${level.id} ${level.name}`);
          const idLine = doc.createElement("span");
          idLine.className = "cell-id";
          idLine.textContent = level.id;
          const nameLine = doc.createElement("span");
          nameLine.className = "cell-name";
          nameLine.textContent = level.name;
          const pips = doc.createElement("span");
          pips.className = "cell-pearls";
          for (let i = 0; i < 3; i += 1) {
            const pip = doc.createElement("i");
            pip.className = `pip${i < level.pearls ? " is-on" : ""}`;
            pips.append(pip);
          }
          cell.append(idLine, nameLine, pips);
          grid.append(cell);
        }
        card.append(grid);
      } else {
        const lock = doc.createElement("p");
        lock.className = "zone-lock";
        lock.textContent = format(t.levelsLocked, zone.gate);
        card.append(lock);
      }
      box.append(card);
    }

    const abyssBtn = refs["btn-abyss"];
    abyssBtn.disabled = !model.abyssUnlocked;
    abyssBtn.title = model.abyssUnlocked
      ? format(t.levelsAbyssOpen, model.abyss.meters, formatNumber(model.abyss.score))
      : t.levelsAbyssLocked;
  }

  function showResult(model) {
    const { result, isAbyss } = model;
    const won = Boolean(result.won);
    refs["result-badge"].textContent = model.isRecord ? t.newBestBadge : won ? t.kicker : "";
    refs["result-title"].textContent = won ? t.resultWin : result.timedOut ? t.resultLoseTime : t.resultLoseHearts;
    refs["result-sub"].textContent = won ? "" : format(t.resultLoseDesc, result.hearts ?? 0);
    refs["result-sub"].hidden = won;

    const tray = refs["pearl-tray"];
    tray.replaceChildren();
    if (!isAbyss) {
      for (let i = 0; i < 3; i += 1) {
        const slot = doc.createElement("div");
        slot.className = `pearl-slot${result.stars?.[i] ? " is-on" : ""}`;
        const orbit = doc.createElement("div");
        orbit.className = "pearl-orbit";
        const core = doc.createElement("i");
        core.className = "pearl-core";
        orbit.append(core);
        const cap = doc.createElement("p");
        cap.className = "pearl-caption";
        cap.textContent = starCaption(result.labels?.[i]);
        slot.append(orbit, cap);
        tray.append(slot);
      }
    }

    const rows = [];
    if (isAbyss) {
      rows.push([t.hudDepth, format(t.abyssDepthValue, result.meters)]);
      rows.push([t.resultScore, formatNumber(result.score)]);
    } else {
      rows.push([t.resultTier, format(t.tierValue, result.tier)]);
      rows.push([t.resultEaten, String(result.eaten)]);
      rows.push([t.resultTime, formatTime(result.time)]);
      rows.push([t.resultHits, String(result.hits)]);
      rows.push([t.resultScore, formatNumber(result.score)]);
    }
    const tally = refs.tally;
    tally.replaceChildren();
    for (const [label, value] of rows) {
      const cell = doc.createElement("div");
      cell.className = "tally-cell";
      const dt = doc.createElement("dt");
      dt.textContent = label;
      const dd = doc.createElement("dd");
      dd.textContent = value;
      cell.append(dt, dd);
      tally.append(cell);
    }

    const nextBtn = refs["result-next"];
    nextBtn.hidden = isAbyss;
    nextBtn.disabled = !model.hasNext;
    refs["result-retry"].textContent = isAbyss ? t.btnAbyssRetry : t.btnRetry;
  }

  function showAbyssEnd(model) {
    refs["abyss-badge"].textContent = model.isRecord ? t.newBestBadge : "";
    refs["abyss-end-desc"].textContent = format(t.abyssEndDesc, model.result.meters, formatNumber(model.result.score));
    refs["abyss-best"].textContent = format(t.abyssBest, model.best.meters, formatNumber(model.best.score));
  }

  // ---------- HUD ----------
  function setHint(text) {
    refs.hint.textContent = text;
  }

  function toast(text) {
    if (!text) return;
    const node = doc.createElement("p");
    node.className = "toast";
    node.textContent = text;
    refs.toasts.append(node);
    while (refs.toasts.childElementCount > 3) refs.toasts.firstElementChild.remove();
    const timer = globalThis.setTimeout(() => {
      node.classList.add("is-out");
      const drop = globalThis.setTimeout(() => node.remove(), 320);
      toastTimers.push(drop);
    }, 1500);
    toastTimers.push(timer);
  }

  function clearToasts() {
    for (const timer of toastTimers) globalThis.clearTimeout(timer);
    toastTimers = [];
    refs.toasts.replaceChildren();
  }

  function setFrenzyBanner(level) {
    const on = level >= 2;
    refs["frenzy-banner"].classList.toggle("is-on", on);
    refs["frenzy-banner"].textContent = on ? t.frenzyLevel2 : "";
    refs["frenzy-banner"].setAttribute("aria-hidden", on ? "false" : "true");
  }

  function update(state, summary, extra = {}) {
    const player = state.player;
    const level = state.level;
    const isAbyss = state.mode === "abyss";
    const zone = isAbyss ? null : zoneOf(level.zone);

    refs["hud-zone"].textContent = isAbyss ? t.abyssTitle : (locale === "zh" ? zone.nameZh : zone.nameEn);
    refs["hud-level-no"].textContent = isAbyss ? "∞" : level.id;
    refs["hud-level-name"].textContent = isAbyss ? t.hudDepth : (locale === "zh" ? level.nameZh : level.nameEn);

    // 深度计：指针扫过本海域 8 关的角度区间
    const stageIndex = isAbyss ? 8 : level.index ?? 1;
    const needle = -90 + ((stageIndex - 1) / 7) * 180;
    refs["dial-needle"].style.transform = `rotate(${needle}deg)`;
    refs["dial-stage"].textContent = isAbyss ? format(t.abyssDepthValue, summary.depth) : `${stageIndex} / 8`;
    refs["dial-zone"].textContent = isAbyss ? t.abyssTitle : (locale === "zh" ? zone.taglineZh : zone.taglineEn);

    // 心数
    const shells = refs.hearts.children;
    for (let i = 0; i < shells.length; i += 1) {
      shells[i].classList.toggle("is-full", i < player.hearts);
    }

    // 压强管：只在启用深渊压强的海域出现
    const pressured = Boolean(level.mechanics?.pressure);
    refs.pressure.hidden = !pressured;
    if (pressured) {
      refs["pressure-fill"].style.height = `${Math.round(state.pressure * 100)}%`;
      refs.pressure.classList.toggle("is-full", state.pressure >= 1);
    }

    // 狂暴罗盘
    const frenzy = state.frenzy ?? 0;
    refs.compass.dataset.level = String(frenzy);
    refs["compass-mult"].textContent = `×${FRENZY_MULT[frenzy] ?? 1}`;
    refs["compass-combo"].textContent = state.combo > 1 ? format(t.comboValue, state.combo) : frenzy > 0 ? t.frenzyLevel1 : t.frenzyNone;
    if (frenzy !== lastFrenzy) {
      refs.compass.classList.remove("is-hit");
      void refs.compass.offsetWidth;
      refs.compass.classList.add("is-hit");
      lastFrenzy = frenzy;
    }
    if (state.combo > lastCombo + 1) {
      refs.compass.classList.remove("is-hit");
      void refs.compass.offsetWidth;
      refs.compass.classList.add("is-hit");
    }
    lastCombo = state.combo;
    setFrenzyBanner(frenzy);

    // 成长玻璃管
    const tier = player.tier;
    const need = growthNeeded(tier);
    const ratio = tier >= MAX_TIER ? 1 : need > 0 ? Math.min(1, player.growth / need) : 0;
    refs["tube-fill"].style.width = `${Math.round(ratio * 100)}%`;
    refs["tube-tier"].textContent = `${format(t.tierValue, tier)} · ${tierName(tier)}`;
    refs["tube-quota"].textContent = isAbyss
      ? format(t.abyssDepthValue, summary.depth)
      : format(t.tierGrow, Math.floor(player.growth), need || "MAX");

    refs["pause-glyph"].textContent = state.status === "paused" ? "▶" : "❙❙";
    if (extra.muted !== undefined) {
      refs["sound-btn"].setAttribute("aria-pressed", extra.muted ? "false" : "true");
      refs["sound-glyph"].textContent = extra.muted ? "✕" : "♪";
    }
  }

  // ---------- 意图绑定 ----------
  function bind() {
    refs["back-home"].addEventListener("click", () => onIntent({ type: "click" }));

    refs["help-btn"].addEventListener("click", () => {
      onIntent({ type: "click" });
      showPanel("help");
    });
    refs["help-close"].addEventListener("click", () => {
      onIntent({ type: "click" });
      hidePanels();
      onIntent({ type: "closedPanel" });
    });
    refs["sound-btn"].addEventListener("click", () => onIntent({ type: "toggleSound" }));
    refs["lang-btn"].addEventListener("click", () => onIntent({ type: "toggleLang" }));
    refs["pause-btn"].addEventListener("click", () => onIntent({ type: "togglePause" }));
    refs["restart-btn"].addEventListener("click", () => onIntent({ type: "restart" }));

    refs["btn-start"].addEventListener("click", () => onIntent({ type: "begin" }));
    refs["btn-levels"].addEventListener("click", () => {
      onIntent({ type: "click" });
      // 必须走 refreshLevels 先 buildLevels 再开面板：只 showPanel 会开出空壳关卡表。
      onIntent({ type: "refreshLevels" });
    });
    refs["btn-abyss"].addEventListener("click", () => {
      onIntent({ type: "click" });
      onIntent({ type: "startAbyss" });
    });
    refs["levels-close"].addEventListener("click", () => {
      onIntent({ type: "click" });
      hidePanels();
      onIntent({ type: "closedPanel" });
    });
    refs.zones.addEventListener("click", (event) => {
      const cell = event.target.closest?.(".level-cell");
      if (!cell?.dataset?.levelId) return;
      onIntent({ type: "click" });
      onIntent({ type: "selectLevel", levelId: cell.dataset.levelId });
    });
    refs["reset-save"].addEventListener("click", () => onIntent({ type: "resetSave" }));

    refs["result-next"].addEventListener("click", () => {
      onIntent({ type: "click" });
      onIntent({ type: "nextLevel" });
    });
    refs["result-retry"].addEventListener("click", () => {
      onIntent({ type: "click" });
      onIntent({ type: "retry" });
    });
    refs["result-home"].addEventListener("click", () => {
      onIntent({ type: "click" });
      showPanel("levels");
      onIntent({ type: "refreshLevels" });
    });

    refs["paused-resume"].addEventListener("click", () => onIntent({ type: "resume" }));
    refs["paused-restart"].addEventListener("click", () => {
      onIntent({ type: "click" });
      onIntent({ type: "restart" });
    });
    refs["paused-home"].addEventListener("click", () => {
      onIntent({ type: "click" });
      showPanel("levels");
      onIntent({ type: "refreshLevels" });
    });

    refs["abyss-retry"].addEventListener("click", () => {
      onIntent({ type: "click" });
      onIntent({ type: "startAbyss" });
    });
    refs["abyss-exit"].addEventListener("click", () => {
      onIntent({ type: "click" });
      showPanel("levels");
      onIntent({ type: "refreshLevels" });
    });
  }

  function getRef(id) {
    return refs[id];
  }

  function currentPanelName() {
    return currentPanel;
  }

  return {
    applyStrings,
    bind,
    update,
    buildLevels,
    showPanel,
    hidePanels,
    showResult,
    showAbyssEnd,
    toast,
    clearToasts,
    getRef,
    currentPanelName,
    setHint,
  };
}
