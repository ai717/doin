// ui.mjs —— 唯一碰 DOM 的层：HUD 刷新、控制台、弹层编排、选关网格、语言热更新
//
// 弹层双真相源铁律：可见性一律以 classList 为唯一真相源（hidden 属性与 class 混用会读串）。
// 借屏浮层（玩法说明）必须记住"从哪来回哪去"，否则关掉说明会误回落选关（玩家体感＝又重新开始了）。

import {
  applyLocale,
  strings,
  format,
  mazeName,
  tipName,
  tipDesc,
  htmlLang,
} from "./i18n.mjs";
import { MODE_SCHEDULE } from "./engine.mjs";
import { MAZES, SETPIECES } from "./mazes.mjs";
import { formatScore, formatClock } from "./score.mjs";
import { isLevelUnlocked, levelRecord, setpieceRecord } from "./storage.mjs";

const OVERLAYS = ["ready", "pause", "result", "levels", "setpieces", "help", "settings"];

export function createUI(root) {
  const el = (id) => root.querySelector(`#${id}`);
  const nodes = {
    stage: el("stage"),
    score: el("score-val"),
    best: el("best-val"),
    level: el("level-val"),
    beat: el("beat"),
    beatName: el("beat-name"),
    beatFill: el("beat-fill"),
    beatLeft: el("beat-left"),
    credits: el("credit-lamps"),
    readPhase: el("read-phase"),
    readChain: el("read-chain"),
    modeRow: el("mode-row"),
    levelGrid: el("level-grid"),
    setpieceGrid: el("setpiece-grid"),
    starRow: el("star-row"),
    resultKicker: el("result-kicker"),
    resultTitle: el("result-title"),
    resScore: el("res-score"),
    resTime: el("res-time"),
    resDots: el("res-dots"),
    resGhosts: el("res-ghosts"),
    resChain: el("res-chain"),
    resDeaths: el("res-deaths"),
    resBest: el("res-best"),
    btnNext: el("btn-next"),
    btnPause: el("btn-pause"),
    btnSound: el("btn-sound"),
    btnLang: el("btn-lang"),
    optAiRead: el("opt-ai-read"),
    optAiNote: el("opt-ai-note"),
    optSound: el("opt-sound"),
    optSpeed: el("opt-speed"),
  };
  const overlays = new Map(OVERLAYS.map((n) => [n, el(`ov-${n}`)]));

  let locale = "zh";
  let current = "ready";
  /** 借屏浮层（玩法说明）返回的目标；null 表示不是借屏 */
  let helpReturn = null;
  let handler = {};
  let lastCredits = -1;

  function s() {
    return strings(locale);
  }

  // ---------------------------------------------------------------- 弹层

  function showOverlay(name) {
    // ★ 借屏浮层：从哪来回哪去。说明可以在对局中打开，关掉时不能把人丢回选关。
    if (name === "help" && current !== "help") helpReturn = current === "none" ? null : current;
    current = name;
    for (const [key, node] of overlays) {
      if (!node) continue;
      const on = key === name;
      node.classList.toggle("hidden", !on);
      if (node.hidden !== undefined) node.hidden = !on;
    }
    if (name === "help") return;
    if (name === null || name === "none") helpReturn = null;
  }

  function closeHelp() {
    const back = helpReturn ?? "none";
    helpReturn = null;
    showOverlay(back === "none" ? "none" : back);
  }

  // ---------------------------------------------------------------- HUD

  function syncHud(state, best) {
    if (!state) return;
    const t = s();
    nodes.score.textContent = formatScore(state.score);
    nodes.best.textContent = formatScore(Math.max(best ?? 0, state.score));
    nodes.level.textContent = String(state.level ?? 1).padStart(2, "0");

    const hunting = state.globalMode === "chase";
    nodes.beat.dataset.phase = hunting ? "chase" : "scatter";
    nodes.beatName.textContent = hunting ? t.hudPhaseChase : t.hudPhaseScatter;
    const total = MODE_SCHEDULE[state.modeIndex]?.sec ?? 7;
    const left = state.modeTimer;
    nodes.beatFill.style.width = `${Math.max(0, Math.min(100, (left / total) * 100)).toFixed(1)}%`;
    nodes.beatLeft.textContent = Number.isFinite(left) ? `${left.toFixed(1)}s` : "∞";
    // 换拍前 3 秒起心跳脉动（径向柔光，绝不描硬边圈）
    nodes.beat.dataset.warn = Number.isFinite(left) && left <= 3 && left > 0 ? "true" : "false";

    if (state.frightTimer > 0) {
      nodes.readPhase.textContent = format(t.frightHint, { n: state.frightTimer.toFixed(1) });
    } else {
      nodes.readPhase.textContent = hunting ? t.beatHintChase : t.beatHintScatter;
    }
    nodes.readChain.textContent =
      state.chainLevel > 0
        ? format(t.chainHint, { n: (state.chainLevel + 1).toFixed(0), m: state.chainTimer.toFixed(1) })
        : t.hudChainOff;

    if (state.lives !== lastCredits) {
      lastCredits = state.lives;
      nodes.credits.innerHTML = "";
      for (let i = 0; i < Math.max(0, state.lives); i += 1) {
        const lamp = root.createElement("i");
        lamp.className = "lamp";
        nodes.credits.appendChild(lamp);
      }
    }
  }

  // ---------------------------------------------------------------- 选关网格

  function buildLevelGrid(save, onPick, activeLevel) {
    nodes.levelGrid.innerHTML = "";
    MAZES.forEach((maze, i) => {
      const id = i + 1;
      const unlocked = isLevelUnlocked(save, id);
      const rec = levelRecord(save, id);
      const btn = root.createElement("button");
      btn.type = "button";
      btn.className = "pick-card";
      btn.disabled = !unlocked;
      btn.setAttribute("aria-current", id === activeLevel ? "true" : "false");

      const no = root.createElement("span");
      no.className = "pick-no";
      no.textContent = `MAZE ${String(id).padStart(2, "0")}`;
      const name = root.createElement("span");
      name.className = "pick-name";
      name.textContent = mazeName(locale, maze.meta.key, maze.id);
      const tips = root.createElement("span");
      tips.className = "pick-tips";
      for (const tip of maze.meta.tips ?? []) {
        const chip = root.createElement("i");
        chip.className = "pick-tip";
        chip.textContent = tipName(locale, tip, tip);
        tips.appendChild(chip);
      }
      if (maze.nests.length > 1) {
        const chip = root.createElement("i");
        chip.className = "pick-tip";
        chip.textContent = tipName(locale, "secondNest", "secondNest");
        tips.appendChild(chip);
      }
      if (maze.meta.key === "master") {
        const chip = root.createElement("i");
        chip.className = "pick-tip";
        chip.textContent = tipName(locale, "neverScatter", "neverScatter");
        tips.appendChild(chip);
      }
      const stars = root.createElement("span");
      stars.className = "pick-stars";
      stars.textContent = unlocked ? "★".repeat(rec.stars) + "☆".repeat(3 - rec.stars) : s().levelsLocked;

      btn.append(no, name, tips, stars);
      btn.title = (maze.meta.tips ?? []).map((k) => tipDesc(locale, k, "")).join(" ");
      if (unlocked) btn.addEventListener("click", () => onPick(id));
      nodes.levelGrid.appendChild(btn);
    });
  }

  function buildSetpieceGrid(save, onPick, activeId) {
    nodes.setpieceGrid.innerHTML = "";
    SETPIECES.forEach((sp) => {
      const rec = setpieceRecord(save, sp.id);
      const btn = root.createElement("button");
      btn.type = "button";
      btn.className = "pick-card";
      btn.setAttribute("aria-current", sp.id === activeId ? "true" : "false");

      const no = root.createElement("span");
      no.className = "pick-no";
      no.textContent = sp.id.replace("sp_", "").toUpperCase().replace("_", " ");
      const name = root.createElement("span");
      name.className = "pick-name";
      const key = `goal${sp.goal[0].toUpperCase()}${sp.goal.slice(1)}`;
      name.textContent = s()[key] ?? sp.goal;
      const tips = root.createElement("span");
      tips.className = "pick-tips";
      const chip = root.createElement("i");
      chip.className = "pick-tip";
      chip.textContent = mazeName(locale, MAZES.find((m) => m.id === sp.mazeId)?.meta.key ?? "", sp.mazeId);
      tips.appendChild(chip);
      const stars = root.createElement("span");
      stars.className = "pick-stars";
      stars.textContent = rec.cleared ? `★ ${rec.best}` : `${sp.limitTime}s`;

      btn.append(no, name, tips, stars);
      const hintKey = `goalHint${sp.goal[0].toUpperCase()}${sp.goal.slice(1)}`;
      btn.title = s()[hintKey] ?? "";
      btn.addEventListener("click", () => onPick(sp.id));
      nodes.setpieceGrid.appendChild(btn);
    });
  }

  // ---------------------------------------------------------------- 结算

  function showResult(res, isNewBest) {
    const t = s();
    // ★ 落败标题必须区分死因：超时/步数用尽不是"被灯撞灭"（掉命 0 却写撞灭会误导玩家）
    const lostKey = res.lostReason === "time" ? "lostTimeUp" : res.lostReason === "steps" ? "lostSteps" : "lostExtinguished";
    nodes.resultKicker.textContent = res.cleared ? t.resultCleared : t.resultLost;
    nodes.resultTitle.textContent = res.cleared ? t.resultCleared : t[lostKey] ?? t.lostExtinguished;
    for (const node of nodes.starRow.querySelectorAll(".star")) {
      const key = node.dataset.star;
      node.dataset.on = res.detail && res.detail[key] ? "true" : "false";
    }
    nodes.resScore.textContent = formatScore(res.score);
    nodes.resTime.textContent = formatClock(res.timeMs / 1000);
    nodes.resDots.textContent = `${res.dots}/${res.dotsTotal}`;
    nodes.resGhosts.textContent = String(res.ghosts);
    nodes.resChain.textContent = String(res.bestChain);
    nodes.resDeaths.textContent = String(res.deaths);
    nodes.resBest.hidden = !isNewBest;
    // 残局与街机没有"下一关"以外的推进语义：战役通关后隐藏下一关按钮
    nodes.btnNext.hidden = !(res.cleared && res.mode !== "setpiece");
    showOverlay("result");
  }

  // ---------------------------------------------------------------- 语言热更新

  function setLocale(next) {
    locale = next;
    applyLocale(root, locale);
    if (root.ownerDocument) root.ownerDocument.documentElement.lang = htmlLang(locale);
    const t = s();
    nodes.btnLang.textContent = t.langSwitch;
    documentTitle();
    return t;
  }

  function documentTitle() {
    const t = s();
    const doc = root.ownerDocument;
    if (doc) doc.title = `${t.appTitle} · ${t.appKicker}`;
  }

  function syncSound(muted) {
    const t = s();
    nodes.btnSound.setAttribute("aria-pressed", muted ? "false" : "true");
    nodes.btnSound.dataset.i18nTitle = muted ? "soundOff" : "soundOn";
    const text = nodes.btnSound.querySelector(".tool-text");
    if (text) text.textContent = muted ? t.soundOff : t.soundOn;
    nodes.btnSound.title = muted ? t.soundOff : t.soundOn;
    if (nodes.optSound) nodes.optSound.checked = !muted;
  }

  function syncAssist(on) {
    const t = s();
    if (nodes.optAiRead) nodes.optAiRead.checked = on === true;
    if (nodes.optAiNote) nodes.optAiNote.textContent = on ? t.settingsAiReadOn : t.settingsAiReadOff;
  }

  function syncSpeedTier(tier) {
    for (const key of nodes.optSpeed?.querySelectorAll(".seg-key") ?? []) {
      const on = key.dataset.speed === tier;
      key.classList.toggle("is-on", on);
      key.setAttribute("aria-checked", on ? "true" : "false");
      key.tabIndex = on ? 0 : -1;
    }
  }

  // ---------------------------------------------------------------- 事件绑定

  function bind(handlers) {
    handler = handlers ?? {};
    const on = (id, ev, fn) => {
      const node = el(id);
      if (node) node.addEventListener(ev, fn);
    };

    on("btn-start", "click", () => handler.onStart?.());
    on("btn-start-2", "click", () => handler.onStart?.());
    on("btn-pick-level", "click", () => handler.onPickLevel?.());
    on("btn-resume", "click", () => handler.onResume?.());
    on("btn-restart", "click", () => handler.onRestart?.());
    on("btn-stage", "click", () => handler.onStage?.());
    on("btn-next", "click", () => handler.onNext?.());
    on("btn-again", "click", () => handler.onRestart?.());
    on("btn-result-stage", "click", () => handler.onStage?.());
    on("btn-levels-close", "click", () => handler.onStage?.());
    on("btn-setpieces-close", "click", () => handler.onStage?.());
    on("btn-help-close", "click", () => closeHelp());
    on("btn-settings-close", "click", () => handler.onCloseSettings?.());
    on("btn-pause", "click", () => handler.onTogglePause?.());
    on("btn-sound", "click", () => handler.onToggleSound?.());
    on("btn-lang", "click", () => handler.onToggleLang?.());
    on("btn-help", "click", () => showOverlay("help"));
    on("btn-reset", "click", () => handler.onReset?.());
    if (nodes.optAiRead) nodes.optAiRead.addEventListener("change", () => handler.onAssist?.(nodes.optAiRead.checked));
    if (nodes.optSound) nodes.optSound.addEventListener("change", () => handler.onSound?.(!nodes.optSound.checked));

    for (const key of nodes.optSpeed?.querySelectorAll(".seg-key") ?? []) {
      key.addEventListener("click", () => handler.onSpeedTier?.(key.dataset.speed));
    }

    for (const card of nodes.modeRow?.querySelectorAll(".mode-card") ?? []) {
      card.addEventListener("click", () => handler.onMode?.(card.dataset.mode));
    }

    bindPad();
  }

  /**
   * 拨盘按「摇杆」做，不当四个孤立按钮：
   *   ① pointerdown 立刻出方向（不等 click，触屏上省掉 ~300ms 的点击判定）
   *   ② 按住后可以在四向之间推着走，不用抬手再按 —— 连续拐弯全靠这个
   *   ③ 按下时点亮 is-down，触屏没有 hover，必须给「这一下被吃进去了」的反馈
   */
  function bindPad() {
    const pad = root.querySelector?.("#pad");
    if (!pad) return;
    const keys = [...pad.querySelectorAll(".pad-key")];
    if (!keys.length) return;

    const light = (key) => {
      for (const k of keys) k.classList.toggle("is-down", k === key);
    };
    const keyAt = (x, y) => {
      for (const k of keys) {
        const r = k.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return k;
      }
      return null;
    };
    const fire = (key) => {
      if (!key) return;
      handler.onDir?.(Number(key.dataset.dir));
    };

    let active = false;
    let lastKey = null;

    pad.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      active = true;
      // 捕获指针：手指滑出拨盘范围也能继续收到 move/up，不会卡在按下态。
      // ★ 必须 try：pointerId 失效时 setPointerCapture 会抛 NotFoundError，
      //   不兜住的话后面的「点亮 + 出方向」全都不会执行，拨盘直接哑掉。
      try {
        pad.setPointerCapture?.(e.pointerId);
      } catch {
        /* 捕获不了也要继续响应，只是滑出边界收不到 up 而已 */
      }
      lastKey = keyAt(e.clientX, e.clientY);
      light(lastKey);
      fire(lastKey);
    });
    pad.addEventListener("pointermove", (e) => {
      if (!active) return;
      const key = keyAt(e.clientX, e.clientY);
      if (key === lastKey) return;
      lastKey = key;
      light(key);
      fire(key);
    });
    const release = () => {
      active = false;
      lastKey = null;
      light(null);
    };
    pad.addEventListener("pointerup", release);
    pad.addEventListener("pointercancel", release);
    pad.addEventListener("lostpointercapture", release);
  }

  function setModePressed(mode) {
    for (const card of nodes.modeRow?.querySelectorAll(".mode-card") ?? []) {
      card.setAttribute("aria-pressed", card.dataset.mode === mode ? "true" : "false");
    }
  }

  function setPauseLabel(paused) {
    const t = s();
    nodes.btnPause.textContent = paused ? t.btnResume : t.btnPause;
  }

  return {
    nodes,
    bind,
    showOverlay,
    closeHelp,
    syncHud,
    showResult,
    buildLevelGrid,
    buildSetpieceGrid,
    setLocale,
    syncSound,
    syncAssist,
    syncSpeedTier,
    setModePressed,
    setPauseLabel,
    get locale() {
      return locale;
    },
    get current() {
      return current;
    },
  };
}
