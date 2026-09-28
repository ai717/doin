// 泡泡射手 · DOM 交互层（唯一碰 DOM 的层：机台 HUD、浮层、输入绑定）

import { MODE, AIM, PRISM } from "./engine.mjs";
import { STAGE_LEVELS, PUZZLES, chapterOf } from "./levels.mjs";
import { loadLocale, saveLocale, format } from "./i18n.mjs";
import { totalStars } from "./storage.mjs";
import { starsFor } from "./score.mjs";

const $ = (id) => document.getElementById(id);

export class BobbleUI {
  constructor(game, save, hooks = {}) {
    this.game = game;
    this.save = save;
    this.hooks = hooks;
    this.locale = loadLocale();
    this.gridKind = "stage";
    this.toastTimer = 0;
    this.currentOverlay = "start";   // 浮层可见性唯一真相源：start | help | clear | over | none
    this.bind();
    this.applyLocale();
    this.buildLevelGrid("stage");
  }

  t(key, values) {
    return format(this.locale, key, values);
  }

  // ---------- 绑定 ----------
  bind() {
    const h = this.hooks;
    const on = (id, fn) => {
      const el = $(id);
      if (el) el.addEventListener("click", fn);
    };
    on("btn-sound", () => h.onToggleSound?.());
    on("btn-lang", () => this.toggleLocale());
    on("btn-help", () => this.showOverlay("help"));
    on("btn-help-close", () => this.closeHelp());
    on("btn-pause", () => this.togglePause());
    on("btn-resume", () => this.togglePause());
    on("btn-pause-restart", () => h.onRetry?.());
    on("btn-pause-help", () => this.showOverlay("help"));
    on("btn-pause-select", () => h.onToSelect?.());
    on("btn-reset-save", () => h.onResetSave?.());
    on("btn-mode-stage", () => { this.buildLevelGrid("stage"); this.showOverlay("start"); });
    on("btn-mode-puzzle", () => { this.buildLevelGrid("puzzle"); this.showOverlay("start"); });
    on("btn-mode-endless", () => h.onStartEndless?.());
    on("btn-mode-daily", () => h.onStartDaily?.());
    on("btn-restart", () => h.onRetry?.());
    on("btn-retry", () => h.onRetry?.());
    on("btn-next-level", () => h.onNextLevel?.());
    on("btn-to-select", () => h.onToSelect?.());
    on("btn-again", () => h.onRetry?.());
    on("btn-over-back", () => h.onToSelect?.());
    on("btn-swap", () => this.game.swap());
    on("btn-pick", () => this.game.togglePick());
    on("btn-fire", () => this.game.fire());
    on("btn-aim-classic", () => h.onAim?.(AIM.CLASSIC));
    on("btn-aim-extended", () => h.onAim?.(AIM.EXTENDED));
    on("btn-aim-pro", () => h.onAim?.(AIM.PRO));
    on("btn-assist", () => h.onAssist?.());
  }

  toggleLocale() {
    this.locale = this.locale === "zh" ? "en" : "zh";
    saveLocale(this.locale);
    document.documentElement.lang = this.locale === "en" ? "en" : "zh-CN";
    this.applyLocale();
    this.buildLevelGrid(this.gridKind);
    this.hooks.onLocale?.();
  }

  // ---------- 文案 ----------
  applyLocale() {
    for (const el of document.querySelectorAll("[data-i18n]")) {
      const key = el.getAttribute("data-i18n");
      el.textContent = this.t(key);
    }
    for (const el of document.querySelectorAll("[data-i18n-aria]")) {
      const key = el.getAttribute("data-i18n-aria");
      el.setAttribute("aria-label", this.t(key));
    }
    document.title = `${this.t("title")} · ${this.t("siteName")}`;
    for (let i = 1; i <= 6; i += 1) {
      const el = $(`help-body-${i}`);
      if (el) el.textContent = this.t(`helpBody${i}`);
    }
    const sound = $("btn-sound");
    if (sound) {
      sound.textContent = this.save.sound ? this.t("soundOn") : this.t("soundOff");
      sound.setAttribute("data-i18n", this.save.sound ? "soundOn" : "soundOff");
      sound.classList.toggle("is-off", !this.save.sound);
    }
    const langBtn = $("btn-lang");
    if (langBtn) {
      langBtn.textContent = this.t("langBtn");
      langBtn.setAttribute("data-i18n", "langBtn");
    }
    const stars = $("stars-total");
    if (stars) {
      stars.textContent = this.t("starsTotal", { n: totalStars(this.save) });
      stars.setAttribute("data-i18n", "starsTotal");
    }
    this.applyAimChips();
    this.applyAssistChip();
    this.applyPauseButton();
    this.update(this.game.state);
  }

  applyAimChips() {
    const map = { [AIM.CLASSIC]: "btn-aim-classic", [AIM.EXTENDED]: "btn-aim-extended", [AIM.PRO]: "btn-aim-pro" };
    const cur = this.game.state?.aimTier ?? AIM.EXTENDED;
    for (const [tier, id] of Object.entries(map)) {
      const el = $(id);
      if (el) el.classList.toggle("is-on", tier === cur);
    }
  }

  applyAssistChip() {
    const el = $("btn-assist");
    if (el) el.classList.toggle("is-on", Boolean(this.save.assist));
  }

  // ---------- 选关 / 选题 ----------
  buildLevelGrid(kind) {
    this.gridKind = kind;
    const grid = $("level-grid");
    if (!grid) return;
    grid.innerHTML = "";
    if (kind === "stage") {
      const unlocked = this.save.stageUnlocked ?? 1;
      for (const lv of STAGE_LEVELS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        const locked = lv.id > unlocked;
        if (locked) btn.classList.add("locked");
        const stars = this.save.stars?.[lv.id] ?? 0;
        btn.innerHTML = `<b>${lv.id}</b><i>${locked ? "" : "★".repeat(stars) || "·"}</i>`;
        btn.title = locked ? this.t("locked") : this.t("level", { n: lv.id });
        if (!locked) btn.addEventListener("click", () => this.hooks.onSelectLevel?.(lv.id));
        grid.appendChild(btn);
      }
    } else {
      const solved = new Set(this.save.puzzleSolved ?? []);
      const label = $("level-progress");
      if (label) label.textContent = this.t("puzzleProgress", { n: solved.size });
      for (const pz of PUZZLES) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        if (solved.has(pz.id)) btn.classList.add("done");
        btn.innerHTML = `<b>${pz.id}</b><i>${solved.has(pz.id) ? "✓" : `${pz.shots}`}</i>`;
        btn.title = this.t("puzzleTitle", { n: pz.id });
        btn.addEventListener("click", () => this.hooks.onSelectPuzzle?.(pz.id));
        grid.appendChild(btn);
      }
    }
  }

  // ---------- HUD ----------
  update(state) {
    if (!state) return;
    const set = (id, value) => {
      const el = $(id);
      if (el) el.textContent = String(value);
    };
    set("shots-val", state.shots);
    set("mh-shots", state.shots);
    set("chain-val", state.lastChain ?? 0);
    set("mh-chain", state.lastChain ?? 0);
    set("max-chain-val", state.maxChain ?? 0);
    const left = this.game.bubblesLeft();
    set("left-val", left);
    set("mh-left", left);
    set("press-val", Math.max(0, state.pressIn));
    set("mh-press", Math.max(0, state.pressIn));
    set("pick-val", state.picks ?? 0);
    const prism = $( "prism-val" );
    if (prism) prism.textContent = state.loaded === PRISM || state.next === PRISM ? "★" : "-";
    set("target-val", state.target || "-");

    const chapter = chapterOf(state.levelId ?? 1);
    const chLabel = $("chapter-label");
    if (chLabel && state.mode === MODE.STAGE) {
      chLabel.textContent = this.t(chapter.key);
      chLabel.setAttribute("data-i18n", chapter.key);
    } else if (chLabel) {
      const key = state.mode === MODE.PUZZLE ? "modePuzzle" : state.mode === MODE.ENDLESS ? "modeEndless" : "modeDaily";
      chLabel.textContent = this.t(key);
      chLabel.setAttribute("data-i18n", key);
    }
    const progress = $("level-progress");
    if (progress) {
      progress.textContent =
        state.mode === MODE.STAGE
          ? `${state.levelId} / 30`
          : state.mode === MODE.PUZZLE
            ? this.t("puzzleTitle", { n: state.puzzleId })
            : state.mode === MODE.ENDLESS
              ? this.t("bestEndless")
              : this.t("dailyBest");
    }
    const goal = $("goal-line");
    if (goal) {
      if (state.mode === MODE.PUZZLE) {
        goal.textContent = `${this.t("goalCrystal")} · ${this.t("shotsLeft")} ${Math.max(0, (state.queue?.length ?? 0) - state.shots)}`;
      } else if (state.target) {
        goal.textContent = `${this.t("goalClear")} · ${this.t("targetShots")} ${state.target}`;
      } else {
        goal.textContent = this.t("goalClear");
      }
    }
    const status = $("status-label");
    if (status) {
      const key = state.status === "flying" ? "statusFlying" : state.status === "win" ? "statusWin" : state.status === "over" ? "statusOver" : "statusAim";
      status.textContent = this.t(key);
    }
    const best = $("best-line");
    if (best) {
      best.textContent = this.save.endlessShots
        ? `${this.save.endlessShots} ${this.t("shots")} · ${this.save.endlessChain} ${this.t("maxChain")}`
        : "-";
    }
    const daily = $("daily-line");
    if (daily) {
      daily.textContent = this.save.dailyShots ? `${this.save.dailyShots} ${this.t("shots")} · ${this.save.dailyChain} ${this.t("maxChain")}` : "-";
    }
  }

  // ---------- 事件反馈 ----------
  onEvent(event, state) {
    if (event.type === "avalanche") {
      this.toast(this.t("avalanche", { n: event.chain }), 1.1, true);
    } else if (event.type === "rescue") {
      this.toast(this.t("rescue"), 1.6);
    } else if (event.type === "press") {
      this.toast(this.t("pressNow"), 0.8);
    } else if (event.type === "swap") {
      this.toast(this.t("hintSwap"), 0.6);
    } else if (event.type === "pick_empty") {
      this.toast(this.t("hintNoPick"), 0.9);
    } else if (event.type === "win") {
      this.showClear(state);
    } else if (event.type === "lose") {
      this.showOver(state);
    }
  }

  showClear(state) {
    const title = $("clear-title");
    if (title) {
      const key = state.mode === MODE.PUZZLE ? "puzzleWin" : "cleared";
      title.textContent = this.t(key);
      title.setAttribute("data-i18n", key);
    }
    const line = $("clear-line");
    if (line) line.textContent = this.t("clearStats", { s: state.shots, t: state.target || 0, c: state.maxChain });
    const stars = $("clear-stars");
    if (stars) {
      if (state.mode === MODE.PUZZLE) {
        stars.textContent = this.t("puzzleWin");
      } else {
        const n = starsFor(state.shots, state.target || 1);
        stars.textContent = `${"★".repeat(n)}${"☆".repeat(3 - n)} · ${this.t("starsLine", { n })}`;
      }
    }
    const next = $("btn-next-level");
    if (next) next.classList.toggle("hidden", state.mode !== MODE.STAGE || state.levelId >= 30);
    this.showOverlay("clear");
  }

  showOver(state) {
    const title = $("over-title");
    if (title) {
      const key = state.mode === MODE.PUZZLE ? "puzzleFail" : "over";
      title.textContent = this.t(key);
      title.setAttribute("data-i18n", key);
    }
    const line = $("over-line");
    if (line) {
      line.textContent =
        state.mode === MODE.PUZZLE
          ? this.t("puzzleFail")
          : this.t("overStats", { s: state.shots, c: state.maxChain, p: state.score });
    }
    this.showOverlay("over");
  }

  // name: start | help | pause | clear | over | none（none = 全部隐藏，回到对局）
  // 冻结类浮层（help / pause）显示期间对局冻结，离开时解冻；从 pause 借屏看 help 再回来仍保持冻结
  showOverlay(name) {
    const FREEZE = new Set(["help", "pause"]);
    // 说明屏打开期间若对局分出胜负，先记下来，关闭说明后再回到结算屏
    if (this.currentOverlay === "help" && (name === "clear" || name === "over")) {
      this.helpReturn = name;
      return;
    }
    const ids = ["screen-start", "screen-help", "screen-clear", "screen-over", "screen-pause"];
    // 说明浮层是"临时借屏"，必须从哪来回哪去（对局中打开就回对局，从暂停菜单打开就回暂停）
    if (name === "help") {
      this.helpReturn = this.currentOverlay === "help" ? (this.helpReturn ?? "none") : (this.currentOverlay ?? "none");
    }
    const wasFrozen = FREEZE.has(this.currentOverlay);
    const nowFrozen = FREEZE.has(name);
    for (const id of ids) {
      const el = $(id);
      if (!el) continue;
      el.classList.toggle("hidden", id !== `screen-${name}`);
    }
    if (name === "start") this.buildLevelGrid(this.gridKind);
    if (nowFrozen && !wasFrozen) this.game?.pause?.();     // 进入冻结类浮层
    else if (!nowFrozen && wasFrozen) this.game?.resume?.(); // 离开冻结类浮层
    this.currentOverlay = name;
    this.applyPauseButton();
  }

  // 关闭说明屏：回到进入说明前的浮层（对局 / 暂停菜单）
  closeHelp() {
    this.showOverlay(this.helpReturn ?? "none");
  }

  // 机顶暂停键：对局中可暂停，暂停菜单中可继续；其它浮层下不响应
  togglePause() {
    if (this.currentOverlay === "pause") this.showOverlay("none");
    else if (this.currentOverlay === "none") this.showOverlay("pause");
  }

  // 暂停键文案随状态切换（暂停态显示"继续"）
  applyPauseButton() {
    const el = $("btn-pause");
    if (!el) return;
    const paused = this.currentOverlay === "pause";
    const label = paused ? this.t("resume") : this.t("pause");
    el.textContent = label;
    el.setAttribute("aria-label", label);
    el.setAttribute("data-i18n", paused ? "resume" : "pause");
  }

  toast(text, seconds = 1, big = false) {
    const el = $("toast");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("big", big);
    el.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove("show"), seconds * 1000);
  }
}
