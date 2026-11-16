// 盲盒记忆牌 — UI 层（事件绑定 + 视图模式切换；唯一调用 DOM API 的层）
// 与 render.mjs 共同构成"唯一碰 DOM"的层；game.mjs 永远 DOM-free。

import { renderRoot, renderSandboxConfig, updateSoundIcon } from "./render.mjs";
import { applyLocale, loadLocale, strings } from "./i18n.mjs";
import { loadGameData, saveGameData, updateWithRunResult, updateDailyResult, rollDailyIfNeeded } from "./storage.mjs";
import {
  createController, startCampaignLevel, startDaily, startSandbox,
  flipAt, cancelFlipFirst, settleResult, unlockedLevelId, isLevelUnlocked,
} from "./game.mjs";
import { LEVELS, levelById, SANDBOX_LIMITS } from "./levels.mjs";
import { todayKey } from "./engine.mjs";
import {
  setMuted, isMuted, unlock as unlockAudio,
  sfxFlip, sfxMatch, sfxMismatch, sfxRotate, sfxGear, sfxWin, sfxFlawless, sfxLose,
} from "./audio.mjs";

/**
 * 完整 UI 控制器：维护当前 mode（视图状态）与 controller（对局状态）
 */
export function createUI(root) {
  const ui = {
    root,
    locale: loadLocale(),
    mode: "menu", // menu | campaign | daily | sandbox | sandbox-config | rules | settle
    controller: createController({
      onFlip: () => ui.refresh(),
      onMatch: (evt) => {
        sfxMatch(ui.controller.state.combo);
        ui.refresh();
      },
      onMismatch: (evt) => {
        sfxMismatch();
        ui.refresh();
      },
      onRotate: (evt) => {
        const mech = ui.controller.state.mech;
        if (mech === "gear") sfxGear();
        else sfxRotate(evt?.rotations?.[0]?.positions?.length ?? 4);
      },
      onWin: () => {
        const flawless = ui.controller.state.misses === 0;
        if (flawless) sfxFlawless();
        else sfxWin();
        ui.persistSettlement();
        ui.mode = "settle";
        ui.refresh();
      },
      onLose: () => {
        sfxLose();
        ui.persistSettlement();
        ui.mode = "settle";
        ui.refresh();
      },
    }),
    storage: loadGameData(),
  };

  // 初始化音频静音状态
  setMuted(!ui.storage.soundEnabled);

  ui.refresh = function refresh() {
    renderRoot(ui.root, ui.locale, ui.mode, ui.controller, ui.storage);
    updateSoundIcon(ui.storage);
    bindEvents(ui);
  };

  ui.persistSettlement = function persistSettlement() {
    const result = settleResult(ui.controller);
    if (!result) return;
    if (result.mode === "daily") {
      const today = todayKey();
      ui.storage = rollDailyIfNeeded(ui.storage, today);
      ui.storage = updateDailyResult(ui.storage, today, result.misses, result.timeMs);
    } else if (result.mode === "campaign") {
      ui.storage = updateWithRunResult(ui.storage, result);
    }
    saveGameData(ui.storage);
  };

  ui.setMode = function setMode(mode) {
    ui.mode = mode;
    ui.refresh();
  };

  ui.setLocale = function setLocale(locale) {
    ui.locale = locale;
    applyLocale(locale);
    ui.refresh();
  };

  ui.startCampaign = function startCampaign(levelId) {
    unlockAudio();
    if (startCampaignLevel(ui.controller, levelId)) {
      ui.mode = "campaign";
      ui.refresh();
    }
  };

  ui.startDailyRun = function startDailyRun() {
    unlockAudio();
    if (startDaily(ui.controller)) {
      ui.mode = "daily";
      ui.refresh();
    }
  };

  ui.startSandboxRun = function startSandboxRun(opts) {
    unlockAudio();
    if (startSandbox(ui.controller, opts)) {
      ui.mode = "sandbox";
      ui.refresh();
    }
  };

  ui.refresh();
  bindTopbarOnce(ui);
  return ui;
}

/** 顶栏静态按钮一次性绑定（refresh 不重建顶栏，重复绑会指数爆炸） */
function bindTopbarOnce(ui) {
  if (ui._topbarBound) return;
  ui._topbarBound = true;
  const topbarBtn = (id, handler) => {
    const el = (typeof document !== "undefined") ? document.getElementById(id) : null;
    if (el) el.addEventListener("click", handler);
  };
  topbarBtn("btn-lang", () => ui.setLocale(ui.locale === "en" ? "zh" : "en"));
  topbarBtn("btn-sound", () => {
    const next = !isMuted();
    setMuted(next);
    ui.storage = { ...ui.storage, soundEnabled: !next };
    saveGameData(ui.storage);
    ui.refresh();
  });
  topbarBtn("btn-help", () => ui.setMode("rules"));
}

function bindEvents(ui) {
  const root = ui.root;
  if (!root) return;

  // 菜单：模式按钮
  root.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", (e) => handleModeClick(ui, btn.dataset.mode, e));
  });

  // 关卡卡片
  root.querySelectorAll("[data-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lvId = btn.dataset.level;
      if (isLevelUnlocked(ui.storage, lvId)) ui.startCampaign(lvId);
    });
  });

  // 盘面盒子
  root.querySelectorAll("[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const result = flipAt(ui.controller, idx);
      if (result?.action === "flip-one") sfxFlip();
      if (result?.action === "cancel") sfxFlip();
    });
  });

  // 键盘
  if (!ui._keysBound) {
    document.addEventListener("keydown", (e) => handleKey(ui, e));
    ui._keysBound = true;
  }
}

function handleModeClick(ui, mode, evt) {
  switch (mode) {
    case "menu": ui.setMode("menu"); break;
    case "campaign-first": {
      const next = unlockedLevelId(ui.storage);
      ui.startCampaign(next);
      break;
    }
    case "daily": ui.startDailyRun(); break;
    case "sandbox-config":
      ui.mode = "sandbox-config";
      ui.refresh();
      break;
    case "sandbox-start": {
      const sizeSel = ui.root.querySelector("#sandbox-size");
      const mechSel = ui.root.querySelector("#sandbox-mech");
      const seedInp = ui.root.querySelector("#sandbox-seed");
      const [r, c] = (sizeSel?.value || "4x4").split("x").map(Number);
      const mech = mechSel?.value || "none";
      const seed = parseInt(seedInp?.value || "1", 10);
      ui.startSandboxRun({ rows: r, cols: c, mech, seed });
      break;
    }
    case "next": {
      if (!ui.controller.level) return;
      const idx = LEVELS.findIndex((lv) => lv.id === ui.controller.level.id);
      const next = LEVELS[idx + 1];
      if (next) ui.startCampaign(next.id);
      else ui.setMode("menu");
      break;
    }
    case "replay": {
      if (!ui.controller.level) return;
      if (ui.controller.mode === "daily") ui.startDailyRun();
      else if (ui.controller.mode === "sandbox") ui.startSandboxRun({
        rows: ui.controller.state.rows,
        cols: ui.controller.state.cols,
        mech: ui.controller.state.mech,
        seed: ui.controller.state.seed,
      });
      else ui.startCampaign(ui.controller.level.id);
      break;
    }
    default:
      // unknown mode
      break;
  }
}

function handleKey(ui, e) {
  if (ui.mode === "campaign" || ui.mode === "daily" || ui.mode === "sandbox") {
    if (e.key === "p" || e.key === "P" || e.key === "Enter") {
      // 简单暂停切换：当前不做暂停弹层，回菜单视为暂停
      return;
    }
    // 方向键移动光标 + 回车翻开：此处简化为数字键 1-6 直接翻第 N 列第一行未翻开位
    if (/^[1-6]$/.test(e.key)) {
      const col = parseInt(e.key, 10) - 1;
      const s = ui.controller.state;
      if (!s) return;
      // 找该列第一个未翻开位
      for (let r = 0; r < s.rows; r += 1) {
        const idx = r * s.cols + col;
        if (s.grid[idx] !== null && !s.faceUp[idx] && s.flipped.length < 2) {
          flipAt(ui.controller, idx);
          sfxFlip();
          return;
        }
      }
    }
    if (e.key === "Escape" && ui.controller.state?.flipped.length === 1) {
      cancelFlipFirst(ui.controller);
      sfxFlip();
    }
  }
}

function bind(root, sel, event, handler) {
  const el = root.querySelector(sel);
  if (el) el.addEventListener(event, handler);
}