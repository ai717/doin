// 霓虹弹珠台 · UI 层（唯一碰 DOM 的层之一：HUD 更新、浮层、输入映射）
// UI 只发意图给控制器；一切规则/计分只在 engine。

import { LEVELS, CHAPTERS } from "./levels.mjs";
import { MODE } from "./engine.mjs";
import { format, strings, loadLocale, saveLocale } from "./i18n.mjs";

export class PinballUI {
  constructor(game, hooks) {
    this.game = game;
    this.hooks = hooks; // { getSave(), setSave(save), onSelectLevel(id), onStartSurvival(), onResetSave() }
    this.locale = loadLocale();
    this.save = hooks.getSave();
    this.$ = (id) => document.getElementById(id);
    this.pointers = { L: new Set(), R: new Set() };
    this.bindStatic();
    this.bindInput();
    this.buildLevelGrid();
    this.applyLocale();
  }

  bindStatic() {
    this.el = {
      title: this.$("stage-title"),
      sound: this.$("btn-sound"),
      lang: this.$("btn-lang"),
      help: this.$("btn-help"),
      status: this.$("status-label"),
      chptLabel: this.$("chpt-label"),
      chptProgress: this.$("chpt-progress"),
      balls: this.$("balls-dots"),
      bricks: this.$("bricks-left"),
      goal: this.$("goal-line"),
      score: this.$("score-lcd"),
      comboCount: this.$("combo-count"),
      comboMult: this.$("combo-mult"),
      comboBar: this.$("combo-meter-bar"),
      timeVal: this.$("time-val"),
      maxComboVal: this.$("max-combo-val"),
      bestScore: this.$("best-score"),
      starsTotal: this.$("stars-total"),
      effectLamp: this.$("effect-lamp"),
      lamps: {
        bumper: this.$("lamp-bumper"),
        target: this.$("lamp-target"),
        sling: this.$("lamp-sling"),
        spinner: this.$("lamp-spinner"),
        rollover: this.$("lamp-rollover"),
        ramp: this.$("lamp-ramp")
      },
      toast: this.$("toast"),
      board: this.$("board"),
      cabinet: this.$("stage-cabinet"),
      overlays: {
        start: this.$("screen-start"),
        help: this.$("screen-help"),
        clear: this.$("screen-clear"),
        over: this.$("screen-over")
      },
      clear: {
        title: this.$("clear-title"),
        line1: this.$("clear-line1"),
        stars: this.$("clear-stars")
      },
      over: {
        title: this.$("over-title"),
        line: this.$("over-line")
      },
      deck: {
        launch: this.$("btn-launch"),
        flipL: this.$("btn-flip-l"),
        flipR: this.$("btn-flip-r"),
        nudge: this.$("btn-nudge")
      },
      mh: {
        score: this.$("mh-score"),
        combo: this.$("mh-combo"),
        balls: this.$("mh-balls"),
        bricks: this.$("mh-bricks")
      },
      levelGrid: this.$("level-grid"),
      btnStageMode: this.$("btn-stage-mode"),
      btnSurvivalMode: this.$("btn-survival-mode")
    };
  }

  bindInput() {
    const { el } = this;

    // ---- 键盘 ----
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k === "a" || k === "arrowleft") { this.game.setFlip("L", true); e.preventDefault(); }
      else if (k === "d" || k === "arrowright") { this.game.setFlip("R", true); e.preventDefault(); }
      else if (k === " " || k === "spacebar") { if (!e.repeat) this.game.startCharge(); e.preventDefault(); }
      else if (k === "s" || k === "arrowdown") { this.game.nudge(); e.preventDefault(); }
      else if (k === "p") { this.game.togglePause(); }
      else if (k === "m") { this.hooks.onToggleSound(); }
      else if (k === "h") { this.toggleHelp(); }
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k === "a" || k === "arrowleft") this.game.setFlip("L", false);
      else if (k === "d" || k === "arrowright") this.game.setFlip("R", false);
      else if (k === " " || k === "spacebar") { this.game.releaseLaunch(); }
      else if (k === "s" || k === "arrowdown") { this.game.clearNudge(); }
    });

    // ---- 画布双半区触控/鼠标 ----
    el.board.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const rect = el.board.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) { this.pointers.L.add(e.pointerId); this.game.setFlip("L", true); }
      else { this.pointers.R.add(e.pointerId); this.game.setFlip("R", true); }
    });
    const releaseSide = (e) => {
      if (this.pointers.L.delete(e.pointerId) && this.pointers.L.size === 0) this.game.setFlip("L", false);
      if (this.pointers.R.delete(e.pointerId) && this.pointers.R.size === 0) this.game.setFlip("R", false);
    };
    el.board.addEventListener("pointerup", releaseSide);
    el.board.addEventListener("pointercancel", releaseSide);
    el.board.addEventListener("pointerleave", (e) => {
      if (e.pointerId !== undefined) releaseSide(e);
    });

    // ---- 机台底座实体键 ----
    const hold = (btn, side) => {
      btn.addEventListener("pointerdown", (e) => { e.preventDefault(); this.game.setFlip(side, true); });
      btn.addEventListener("pointerup", (e) => { e.preventDefault(); this.game.setFlip(side, false); });
      btn.addEventListener("pointercancel", () => this.game.setFlip(side, false));
      btn.addEventListener("pointerleave", () => this.game.setFlip(side, false));
    };
    hold(el.deck.flipL, "L");
    hold(el.deck.flipR, "R");

    el.deck.nudge.addEventListener("pointerdown", (e) => { e.preventDefault(); this.game.nudge(); });
    el.deck.launch.addEventListener("pointerdown", (e) => { e.preventDefault(); this.game.startCharge(); });
    el.deck.launch.addEventListener("pointerup", (e) => { e.preventDefault(); this.game.releaseLaunch(); });
    el.deck.launch.addEventListener("pointercancel", () => this.game.releaseLaunch());
    el.deck.launch.addEventListener("pointerleave", () => this.game.releaseLaunch());

    // ---- 顶栏 ----
    el.sound.addEventListener("click", () => this.hooks.onToggleSound());
    el.lang.addEventListener("click", () => {
      const next = this.locale === "zh" ? "en" : "zh";
      saveLocale(next);
      this.locale = next;
      this.applyLocale();
      this.buildLevelGrid();
    });
    el.help.addEventListener("click", () => this.toggleHelp());
    el.btnStageMode.addEventListener("click", () => { el.overlays.start.classList.remove("start-mode-survival"); this.showOverlay("start"); });
    el.btnSurvivalMode.addEventListener("click", () => {
      this.hideOverlay("start");
      this.hooks.onStartSurvival();
    });
  }

  toggleHelp() {
    const shown = !this.el.overlays.help.classList.contains("hidden");
    if (shown) this.hideOverlay("help");
    else {
      const close = this.$("btn-help-close");
      close.onclick = () => this.hideOverlay("help");
      this.showOverlay("help");
    }
  }

  showOverlay(name) {
    for (const [key, node] of Object.entries(this.el.overlays)) {
      node.classList.toggle("hidden", key !== name);
    }
  }

  hideOverlay(name) {
    this.el.overlays[name].classList.add("hidden");
  }

  // ---- 事件驱动 UI（由 main 在 game 事件回调中调用）----
  onEvent(event, state) {
    switch (event.type) {
      case "launched":
      case "ball_lost":
      case "ball_saved":
      case "ball_restored":
      case "stage_restarted":
      case "stage_loaded":
      case "survival_loaded":
        this.hideOverlay("clear");
        this.hideOverlay("over");
        this.hideOverlay("start");
        break;
      case "effect":
        if (event.effect === "storm") this.toast(format(this.locale, "stormCombo", { n: STORM_LABEL }), 1.6);
        else if (event.effect === "frenzy") this.toast(this.t("frenzy"), 1.4);
        else if (event.effect === "multiball") this.toast(this.t("multiball"), 1.4);
        else if (event.effect === "save") this.toast(this.t("ballSave"), 1.4);
        break;
      case "cluster_reward":
        this.toast(this.t(event.reward === "combo+3" ? "clusterReward" : event.reward === "flipper" ? "flipperBoost" : "speedBoost"), 1.2);
        break;
      case "target_reward":
        this.toast(this.t(event.reward === "combo+2" ? "clusterReward" : event.reward === "flipper" ? "flipperBoost" : "speedBoost"), 1.2);
        break;
      case "all_targets":
        this.toast(this.t("allTargets"), 1.2);
        break;
      case "stage_clear":
        this.showClear(state);
        break;
      case "stage_fail":
        this.showFail();
        break;
      case "game_over":
        this.showSurvivalOver(state);
        break;
      default:
        break;
    }
  }

  t(key) {
    return strings(this.locale)[key] ?? key;
  }

  toast(text, duration = 1.4) {
    const node = this.el.toast;
    node.textContent = text;
    node.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => node.classList.remove("show"), duration * 1000);
  }

  showClear(state) {
    this.el.clear.line1.textContent = format(this.locale, "clearLine1", { t: Math.floor(state.stageTimer), c: state.maxCombo });
    this.el.clear.stars.textContent = format(this.locale, "clearStars", { n: state.stars });
    this.$("btn-next-level").onclick = () => this.hooks.onNextLevel(state.levelId);
    this.$("btn-retry").onclick = () => this.hooks.onRetry(state.levelId);
    this.$("btn-to-select").onclick = () => this.hooks.onToSelect();
    this.showOverlay("clear");
  }

  showFail() {
    this.el.over.title.textContent = this.t("failed");
    const levelId = this.game.state.levelId;
    this.el.over.line.textContent = "";
    this.$("btn-again").onclick = () => this.hooks.onRetry(levelId);
    this.$("btn-over-back").onclick = () => this.hooks.onToSelect();
    this.showOverlay("over");
  }

  showSurvivalOver(state) {
    this.el.over.title.textContent = this.t("over");
    this.el.over.line.textContent = format(this.locale, "survivalLine", { s: state.score, c: state.maxCombo, b: state.bricksCleared });
    this.$("btn-again").onclick = () => this.hooks.onStartSurvival();
    this.$("btn-over-back").onclick = () => this.hooks.onToSelect();
    this.showOverlay("over");
  }

  // ---- HUD 每帧刷新 ----
  update(state) {
    const { el } = this;
    el.score.textContent = String(state.score);
    el.comboCount.textContent = `${state.combo}`;
    el.comboMult.textContent = format(this.locale, "mult", { m: (1 + state.combo * 0.5 > 10 ? 10 : 1 + state.combo * 0.5).toFixed(1).replace(/\.0$/, "") });
    el.comboBar.style.width = `${Math.min(100, (state.combo / 20) * 100)}%`;
    el.timeVal.textContent = state.mode === MODE.STAGE ? `${Math.floor(state.stageTimer / 60)}:${String(Math.floor(state.stageTimer % 60)).padStart(2, "0")}` : "∞";
    el.maxComboVal.textContent = String(state.maxCombo);
    el.bricks.textContent = String(state.bricksRemaining);
    el.balls.textContent = "●".repeat(Math.max(0, state.ballsRemaining)) + "○".repeat(Math.max(0, 3 - state.ballsRemaining));
    el.status.textContent = state.status === "serving" ? this.t("serving") : state.status === "playing" ? this.t("playing") : "";
    // 机关灯
    const lit = {
      sling: state.combo >= 5,
      bumper: state.frenzyTimer > 0,
      target: state.mechs.targets.length > 0 && state.mechs.targets.every((t) => t.down),
      spinner: Boolean(state.mechs.spinner),
      rollover: Boolean(state.mechs.rollovers),
      ramp: Boolean(state.mechs.ramp)
    };
    for (const [key, node] of Object.entries(el.lamps)) {
      node.classList.toggle("lit", Boolean(lit[key]));
    }
    let effectText = "";
    if (state.frenzyTimer > 0) effectText = this.t("frenzy");
    else if (state.ballSave) effectText = this.t("ballSave");
    else if (state.flipperBoostTimer > 0) effectText = this.t("flipperBoost");
    else if (state.speedBoost > 0) effectText = this.t("speedBoost");
    else if (state.stormCount > 0) effectText = format(this.locale, "stormCombo", { n: STORM_LABEL });
    el.effectLamp.textContent = effectText;
    el.effectLamp.classList.toggle("lit", effectText !== "");
    el.bestScore.textContent = String(this.save.bestSurvivalScore);
    // 移动端紧凑 HUD
    if (el.mh.score) el.mh.score.textContent = String(state.score);
    if (el.mh.combo) el.mh.combo.textContent = String(state.combo);
    if (el.mh.balls) el.mh.balls.textContent = "●".repeat(Math.max(0, state.ballsRemaining)) + "○".repeat(Math.max(0, 3 - state.ballsRemaining));
    if (el.mh.bricks) el.mh.bricks.textContent = String(state.bricksRemaining);
  }

  // ---- 章节进度与选关 ----
  buildLevelGrid() {
    const grid = this.el.levelGrid;
    grid.innerHTML = "";
    for (const chapter of CHAPTERS) {
      const head = document.createElement("div");
      head.className = "level-chapter";
      head.textContent = this.t(chapter.nameKey);
      grid.appendChild(head);
      for (let i = 0; i < chapter.levelCount; i++) {
        const level = LEVELS.find((l) => l.chapter === chapter.id && l.id === chapter.id * 10 - 10 + i + 1);
        const cell = document.createElement("button");
        cell.className = "level-cell";
        const locked = level.id > this.save.unlockedLevel;
        if (locked) cell.classList.add("locked");
        const stars = this.save.stars[level.id] ?? 0;
        cell.innerHTML = `
          <span class="level-num">${level.id}</span>
          <span class="level-stars">${"★".repeat(stars)}<i>${"★".repeat(Math.max(0, 3 - stars))}</i></span>
        `;
        if (!locked) {
          cell.addEventListener("click", () => {
            this.hideOverlay("start");
            this.hooks.onSelectLevel(level.id);
          });
        }
        grid.appendChild(cell);
      }
    }
    // 章节主题行
    const themeLine = this.$("chapter-theme");
    if (themeLine) themeLine.textContent = this.t(`theme${["", "Glass", "Steel", "Gold"][this.currentChapter()]}`);
    const totalStars = Object.values(this.save.stars).reduce((a, b) => a + b, 0);
    this.el.starsTotal.textContent = format(this.locale, "starsTotal", { n: totalStars });
  }

  currentChapter() {
    const id = Math.min(this.save.unlockedLevel, 30);
    return id <= 10 ? 1 : id <= 20 ? 2 : 3;
  }

  // ---- 文案装配 ----
  applyLocale() {
    const t = strings(this.locale);
    document.documentElement.lang = this.locale === "en" ? "en" : "zh-CN";
    this.el.title.textContent = t.title;
    this.el.sound.textContent = this.save.sound ? t.soundOn : t.soundOff;
    this.el.lang.textContent = t.langBtn;
    this.el.goal.textContent = this.game.state.level ? format(this.locale, "goalTime", { t: this.game.state.level.targets.time }) : "";
    const descLine = this.$("goal-combo-line");
    if (descLine) descLine.textContent = this.game.state.level ? format(this.locale, "goalCombo", { c: this.game.state.level.targets.combo }) : "";
    const helpTitle = this.$("help-title");
    if (helpTitle) helpTitle.textContent = t.helpTitle;
    for (let i = 1; i <= 5; i++) {
      const node = this.$(`help-body-${i}`);
      if (node) node.textContent = t[`helpBody${i}`];
    }
    const close = this.$("btn-help-close");
    if (close) close.textContent = t.helpClose;
    const startTitle = this.$("start-title");
    if (startTitle) startTitle.textContent = t.startTitle;
    const startSub = this.$("start-sub");
    if (startSub) startSub.textContent = t.startSub;
    const btnStage = this.$("btn-stage-mode");
    if (btnStage) btnStage.textContent = t.btnStage;
    const btnSurvival = this.$("btn-survival-mode");
    if (btnSurvival) btnSurvival.textContent = t.btnSurvival;
    const clearTitle = this.$("clear-title");
    if (clearTitle) clearTitle.textContent = t.cleared;
    const nextBtn = this.$("btn-next-level");
    if (nextBtn) nextBtn.textContent = t.nextLevel;
    const retryBtn = this.$("btn-retry");
    if (retryBtn) retryBtn.textContent = t.retry;
    const toSelectBtn = this.$("btn-to-select");
    if (toSelectBtn) toSelectBtn.textContent = t.toSelect;
    const againBtn = this.$("btn-again");
    if (againBtn) againBtn.textContent = t.survivalAgain;
    const overBackBtn = this.$("btn-over-back");
    if (overBackBtn) overBackBtn.textContent = t.survivalBack;
    const lamp = {
      bumper: this.$("lamp-bumper"),
      target: this.$("lamp-target"),
      sling: this.$("lamp-sling"),
      spinner: this.$("lamp-spinner"),
      rollover: this.$("lamp-rollover"),
      ramp: this.$("lamp-ramp")
    };
    if (lamp.bumper) lamp.bumper.textContent = t.lampBumper;
    if (lamp.target) lamp.target.textContent = t.lampTarget;
    if (lamp.sling) lamp.sling.textContent = t.lampSling;
    if (lamp.spinner) lamp.spinner.textContent = t.lampSpinner;
    if (lamp.rollover) lamp.rollover.textContent = t.lampRollover;
    if (lamp.ramp) lamp.ramp.textContent = t.lampRamp;
    const launchBtn = this.$("btn-launch");
    if (launchBtn) launchBtn.textContent = t.launch;
    const flipL = this.$("btn-flip-l");
    if (flipL) flipL.textContent = t.flipL;
    const flipR = this.$("btn-flip-r");
    if (flipR) flipR.textContent = t.flipR;
    const nudgeBtn = this.$("btn-nudge");
    if (nudgeBtn) nudgeBtn.textContent = t.nudge;
    const keyTip = this.$("key-tip");
    if (keyTip) keyTip.textContent = t.keyTip;
    const touchTip = this.$("touch-tip");
    if (touchTip) touchTip.textContent = t.touchTip;
    const overTitle = this.$("over-title");
    if (overTitle) overTitle.textContent = t.over;
  }
}

const STORM_LABEL = 10;
