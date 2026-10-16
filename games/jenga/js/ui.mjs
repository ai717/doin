// 叠叠乐 · DOM 交互层（唯一碰 DOM 的层，计分与规则一律外包给 score / engine）
//
// 语言切换走 [data-i18n] 原地热更新：不刷新页面、不重置对局，
// 只有纯展示文本被改写，配合缓存的 lastPayload 重算依赖语言的动态串。

import { strings, format } from "./i18n.mjs";
import { CHAPTERS, LEVELS, RIDDLE_QUESTIONS, DUEL_WIN_TARGET } from "./levels.mjs";

const FREEZE = new Set(["help", "pause"]);

export function createUI(handlers = {}) {
  const root = document;
  const $ = (id) => root.getElementById(id);
  const nodeList = (selector) => Array.from(root.querySelectorAll(selector));

  const el = {
    levelTag: $("level-tag"),
    levelName: $("level-name"),
    goalTag: $("goal-tag"),
    modeLine: $("mode-line"),
    hint: $("stage-hint"),
    score: $("hud-score"),
    streak: $("hud-streak"),
    mult: $("hud-mult"),
    layers: $("hud-layers"),
    danger: $("hud-danger"),
    best: $("hud-best"),
    hazard: $("hazard-tag"),
    canvas: $("tower"),
    toast: $("toast"),
    tray: $("tray"),
    slots: [$("btn-slot-0"), $("btn-slot-1"), $("btn-slot-2")],
    cancel: $("btn-cancel"),
    rebuild: $("btn-rebuild"),
    levels: $("levels-list"),
    levelsProgress: $("levels-progress"),
    overlays: {
      help: $("ov-help"),
      pause: $("ov-pause"),
      result: $("ov-result"),
      levels: $("ov-levels")
    },
    resultTitle: $("result-title"),
    resultLine: $("result-line"),
    resultStars: $("result-stars"),
    resultNext: $("btn-result-next"),
    modeButtons: {
      spire: $("btn-mode-spire"),
      duel: $("btn-mode-duel"),
      riddle: $("btn-mode-riddle")
    }
  };

  let lang = "zh";
  let overlay = "none";
  let lastPayload = null;
  let toastTimer = 0;
  let locked;
  let pendingKey = null;

  function tr(key, values) {
    return format(lang, key, values ?? {});
  }

  function applyLocale(next) {
    lang = next;
    for (const node of nodeList("[data-i18n]")) {
      const key = node.getAttribute("data-i18n");
      if (key) node.textContent = tr(key);
    }
    for (const node of nodeList("[data-i18n-aria]")) {
      const key = node.getAttribute("data-i18n-aria");
      if (key) node.setAttribute("aria-label", tr(key));
    }
    if (root.body) root.body.classList.toggle("lang-en", lang === "en");
    const title = strings(lang).docTitle;
    if (title && root.title !== undefined) root.title = title;
    const html = root.documentElement;
    if (html) html.setAttribute("lang", lang === "en" ? "en" : "zh-CN");
    if (lastPayload) renderHud(lastPayload, true);
    refreshLevels();
    return lang;
  }

  function setOverlay(name) {
    if (overlay === name) return overlay;
    overlay = name;
    for (const [key, node] of Object.entries(el.overlays)) {
      if (!node) continue;
      const on = key === name;
      // 目标态：命中的面板去掉 hidden，其余一律加上。原来这里写的是 ===，
      // 变成"状态已经正确才动 DOM"——结果没有任何面板能被显示出来
      // （结算/帮助/暂停/关卡全线失效，且单测 DOM-free 抓不到）。
      if (node.hasAttribute("hidden") !== !on) node.toggleAttribute("hidden", !on);
    }
    handlers.onOverlayChange?.(name, FREEZE.has(name));
    return overlay;
  }

  function currentOverlay() {
    return overlay;
  }

  // ---------------------------------------------------------------- HUD

  function renderHud(payload, force = false) {
    lastPayload = payload;
    const t = strings(lang);
    if (el.score) el.score.textContent = String(payload.score ?? 0);
    if (el.streak) el.streak.textContent = String(payload.streak ?? 0);
    if (el.mult) el.mult.textContent = `×${payload.mult ?? 1}`;
    if (el.layers) el.layers.textContent = `${payload.layers ?? 0}`;
    if (el.danger) el.danger.textContent = `${Math.round((payload.danger ?? 0) * 100)}%`;
    if (el.best) el.best.textContent = String(payload.bestLayers ?? 18);
    if (el.danger) {
      const d = Math.min(1, Math.max(0, payload.danger ?? 0));
      el.danger.parentElement?.style.setProperty("--danger-level", d.toFixed(3));
      el.danger.parentElement?.classList.toggle("hot", d >= 0.55);
    }

    // 关卡抬头 + 目标串
    const level = payload.level;
    if (el.levelTag) {
      el.levelTag.textContent = level && level.index > 0 ? format(lang, "levelLabel", { n: level.index }) : "";
    }
    if (el.levelName) {
      el.levelName.textContent = level && level.id && t[level.id] ? t[level.id] : "";
    }
    if (el.goalTag && payload.goal) {
      const goal = payload.goal;
      let text = "";
      if (goal.target > 0) {
        text = format(lang, payload.goalText ?? "goalNone", { n: goal.target });
        if ((goal.streak ?? 0) > 0) text = `${text} ${t.goalStreakAdd}`;
        const unit = goal.type === "layers" ? payload.layers : payload.progress?.value ?? 0;
        text = `${text} · ${format(lang, "progressLabel", { a: unit, b: goal.target })}`;
      }
      el.goalTag.textContent = text;
    }
    if (el.modeLine) {
      if (payload.mode === "duel" && payload.duel) {
        el.modeLine.textContent = `${format(lang, "duelRoundLabel", { n: payload.duel.round })} · ${format(lang, "duelScore", { a: payload.duel.wins[0], b: payload.duel.wins[1] })}`;
      } else if (payload.mode === "riddle" && payload.riddle) {
        el.modeLine.textContent = format(lang, "riddleProgress", { i: Math.min(payload.riddle.index + 1, RIDDLE_QUESTIONS), n: RIDDLE_QUESTIONS });
      } else {
        el.modeLine.textContent = "";
      }
    }
    if (el.hint) {
      let hint = "";
      if (payload.mode === "riddle" && payload.riddle) {
        hint = tr(payload.riddle.answered ? "riddleWrong" : "riddleTip");
        if (payload.riddle.answered && payload.riddle.picked?.correct) hint = tr("riddleCorrect");
      } else if (payload.mode === "duel" && payload.duel) {
        hint = format(lang, "duelTurn", { n: payload.duel.active + 1 });
      } else if (payload.held != null) {
        hint = tr("holding");
      } else if (payload.status === "collapse" || payload.status === "lost") {
        hint = tr("ui_collapse");
      } else {
        hint = tr("pickHint");
      }
      el.hint.textContent = hint;
    }

    // 机关系列
    if (el.hazard) {
      const list = level?.hazards ?? [];
      if (!list.length) el.hazard.textContent = tr("hazardNone");
      else el.hazard.textContent = list.map((h) => (h === "gust" ? t.obj_gust : t.obj_load)).join(" · ");
    }

    // 工具槽：手上没块时三个槽位按钮禁用
    const holding = payload.held != null;
    const slots = new Set(payload.slots ?? []);
    el.slots.forEach((btn, i) => {
      if (!btn) return;
      btn.disabled = !holding || !slots.has(i);
      btn.classList.toggle("armed", holding && slots.has(i));
    });
    if (el.cancel) el.cancel.disabled = !holding;
    for (const key of Object.keys(el.modeButtons)) {
      el.modeButtons[key]?.classList.toggle("active", payload.mode === key);
    }
    if (el.resultNext) el.resultNext.toggleAttribute("hidden", !payload.hasNext);
    void force;
  }

  // ---------------------------------------------------------------- toast

  function toast(key, values = {}, warn = false) {
    if (!el.toast) return;
    el.toast.textContent = tr(key, values);
    el.toast.classList.toggle("warn", Boolean(warn));
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1800);
  }

  // ---------------------------------------------------------------- 选关抽屉

  function refreshLevels() {
    if (!el.levels) return;
    const save = handlers.getSave?.() ?? null;
    const t = strings(lang);
    const cleared = save ? Object.keys(save.stars ?? {}).length : 0;
    if (el.levelsProgress) {
      el.levelsProgress.textContent = format(lang, "unlockedLabel", { n: cleared, t: LEVELS.length });
    }
    el.levels.innerHTML = "";
    for (const chapter of CHAPTERS) {
      const group = document.createElement("section");
      group.className = "chapter-group";
      const heading = document.createElement("h3");
      heading.className = "chapter-name";
      heading.textContent = t[chapter.id] ?? chapter.id;
      group.appendChild(heading);
      const grid = document.createElement("div");
      grid.className = "level-grid";
      for (const id of chapter.levels) {
        const level = LEVELS.find((lv) => lv.id === id);
        const unlocked = !save || level.index <= save.unlocked;
        const stars = save?.stars?.[id] ?? 0;
        const item = document.createElement("button");
        item.className = "level-chip";
        item.type = "button";
        item.dataset.levelIndex = String(level.index);
        if (!unlocked) {
          item.classList.add("locked");
          item.disabled = true;
          item.setAttribute("aria-disabled", "true");
          item.title = t.levelsLocked;
        } else {
          item.title = t[level.id] ?? level.id;
        }
        item.innerHTML = "";
        const idx = document.createElement("span");
        idx.className = "chip-index";
        idx.textContent = String(level.index);
        const name = document.createElement("span");
        name.className = "chip-name";
        name.textContent = t[level.id] ?? level.id;
        const starRow = document.createElement("span");
        starRow.className = "chip-stars";
        starRow.textContent = stars > 0 ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : "☆☆☆";
        item.append(idx, name, starRow);
        item.addEventListener("click", () => handlers.onPickLevel?.(level.index));
        grid.appendChild(item);
      }
      group.appendChild(grid);
      el.levels.appendChild(group);
    }
  }

  // ---------------------------------------------------------------- 结算

  function showResult(result) {
    if (!el.overlays.result) return null;
    const t = strings(lang);
    el.resultTitle.textContent = result.won ? t.resultWin : t.resultLose;
    el.resultLine.textContent = format(lang, "resultLine", {
      s: result.score ?? 0,
      l: result.layers ?? 18,
      c: result.streak ?? 0
    });
    if (result.correct !== undefined) {
      el.resultLine.textContent = format(lang, "riddleDone", { c: result.correct, n: RIDDLE_QUESTIONS });
    }
    if (result.level?.index > 0 && el.resultStars) {
      const stars = result.stars ?? 0;
      el.resultStars.textContent = `${t.resultStarsLabel} ${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;
      el.resultStars.toggleAttribute("hidden", false);
    } else if (el.resultStars) {
      el.resultStars.toggleAttribute("hidden", true);
    }
    setOverlay("result");
    return result;
  }

  function setSound(on) {
    const btn = $("btn-sound");
    if (!btn) return;
    btn.textContent = on ? strings(lang).soundOn : strings(lang).soundOff;
    btn.setAttribute("aria-pressed", String(Boolean(on)));
  }

  // ---------------------------------------------------------------- 事件绑定

  const bind = (node, fn) => node?.addEventListener("click", fn);

  bind($("btn-help"), () => handlers.onOpenHelp?.());
  bind($("btn-help-close"), () => handlers.onCloseHelp?.());
  bind($("btn-levels"), () => handlers.onOpenLevels?.());
  bind($("btn-levels-close"), () => handlers.onCloseLevels?.());
  bind($("btn-sound"), () => handlers.onToggleSound?.());
  bind($("btn-lang"), () => handlers.onToggleLang?.());
  bind($("btn-pause"), () => handlers.onPause?.());
  bind($("btn-resume"), () => handlers.onResume?.());
  bind($("btn-pause-restart"), () => handlers.onRestart?.());
  bind($("btn-pause-levels"), () => handlers.onOpenLevels?.());
  bind($("btn-rebuild"), () => handlers.onRestart?.());
  bind($("btn-cancel"), () => handlers.onCancel?.());
  bind($("btn-rot-l"), () => handlers.onRotate?.(-1));
  bind($("btn-rot-r"), () => handlers.onRotate?.(1));
  bind($("btn-zoom-in"), () => handlers.onZoom?.(1));
  bind($("btn-zoom-out"), () => handlers.onZoom?.(-1));
  bind($("btn-result-next"), () => handlers.onNextLevel?.());
  bind($("btn-result-retry"), () => handlers.onRestart?.());
  bind($("btn-result-levels"), () => handlers.onOpenLevels?.());
  bind($("btn-reset-save"), () => handlers.onResetSave?.());
  el.slots.forEach((btn, i) => bind(btn, () => handlers.onStack?.(i)));
  for (const [key, node] of Object.entries(el.modeButtons)) {
    bind(node, () => handlers.onMode?.(key));
  }

  return {
    el,
    get lang() {
      return lang;
    },
    applyLocale,
    setSound,
    renderHud,
    toast,
    setOverlay,
    currentOverlay,
    refreshLevels,
    showResult,
    getLocked: () => locked,
    setPendingReset(key) {
      pendingKey = key;
    },
    getPendingReset: () => pendingKey,
    isFreezing: (name) => FREEZE.has(name)
  };
  void DUEL_WIN_TARGET;
}
