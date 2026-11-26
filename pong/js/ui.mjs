// Pong Neo DOM 交互与 UI 渲染协调层（唯一碰 DOM 处）

import { strings, format, htmlLang, loadLocale, saveLocale } from "./i18n.mjs";
import { MODES, DIFFICULTIES, TARGET_SCORES, COURT_WIDTH, COURT_HEIGHT } from "./engine.mjs";
import { load, save, updateStats } from "./storage.mjs";
import { audio } from "./audio.mjs";
import { CourtRenderer } from "./render.mjs";

export class PongUI {
  constructor(game) {
    this.game = game;
    this.locale = loadLocale();
    this.store = load();
    this.canvas = document.getElementById("court-canvas");
    this.renderer = new CourtRenderer(this.canvas);

    // 同步偏好到 game
    this.game.setMode(this.store.prefs.mode);
    this.game.setDifficulty(this.store.prefs.difficulty);
    this.game.setTargetScore(this.store.prefs.targetScore);
    audio.setMuted(this.store.prefs.muted);

    this.keysDown = new Set();
    this.lastTime = performance.now();
    this.rafId = null;

    this.initDOMElements();
    this.bindEvents();
    this.applyI18n();
    this.updateStatsDisplay();

    // 监听核心事件
    this.game.subscribe((ev, state) => this.handleGameEvent(ev, state));
  }

  initDOMElements() {
    this.el = {
      docTitle: document.title,
      html: document.documentElement,
      backHome: document.getElementById("back-home"),
      soundToggle: document.getElementById("btn-sound"),
      langToggle: document.getElementById("btn-lang"),
      rulesToggle: document.getElementById("btn-rules"),
      rulesModal: document.getElementById("modal-rules"),
      rulesClose: document.getElementById("btn-rules-close"),
      resultModal: document.getElementById("modal-result"),
      resultTitle: document.getElementById("result-title"),
      resultScore: document.getElementById("result-score"),
      resultRally: document.getElementById("result-rally"),
      resultAgain: document.getElementById("btn-result-again"),

      scoreTopNum: document.getElementById("score-top-num"),
      scoreBottomNum: document.getElementById("score-bottom-num"),
      playerTopLabel: document.getElementById("player-top-label"),
      playerBottomLabel: document.getElementById("player-bottom-label"),
      valRallies: document.getElementById("val-rallies"),
      valMaxRally: document.getElementById("val-max-rally"),
      valBallSpeed: document.getElementById("val-ball-speed"),
      valPveRecord: document.getElementById("val-pve-record"),
      valBestRallyRecord: document.getElementById("val-best-rally-record"),
      statusBanner: document.getElementById("status-banner"),

      btnServe: document.getElementById("btn-serve"),
      btnNewMatch: document.getElementById("btn-new-match"),
      btnPause: document.getElementById("btn-pause"),

      modeBtns: document.querySelectorAll("[data-mode]"),
      diffBtns: document.querySelectorAll("[data-diff]"),
      targetBtns: document.querySelectorAll("[data-target]")
    };
  }

  bindEvents() {
    // 1. 语言与音效切换
    this.el.langToggle.addEventListener("click", () => {
      this.locale = this.locale === "zh" ? "en" : "zh";
      saveLocale(this.locale);
      this.applyI18n();
    });

    this.el.soundToggle.addEventListener("click", () => {
      const nextMuted = !this.store.prefs.muted;
      this.store.prefs.muted = nextMuted;
      audio.setMuted(nextMuted);
      save(this.store);
      this.updateSoundBtn();
    });

    // 2. 规则弹窗
    this.el.rulesToggle.addEventListener("click", () => {
      this.el.rulesModal.classList.remove("hidden");
    });
    this.el.rulesClose.addEventListener("click", () => {
      this.el.rulesModal.classList.add("hidden");
    });

    // 3. 局内控制按钮
    this.el.btnServe.addEventListener("click", () => {
      audio.init();
      this.game.serveBall();
    });
    this.el.btnNewMatch.addEventListener("click", () => {
      audio.init();
      this.game.restartMatch();
    });
    this.el.btnPause.addEventListener("click", () => {
      audio.init();
      this.game.togglePause();
    });

    this.el.resultAgain.addEventListener("click", () => {
      this.el.resultModal.classList.add("hidden");
      this.game.restartMatch();
    });

    // 4. 模式、难度、局制切换按钮
    this.el.modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        this.store.prefs.mode = mode;
        save(this.store);
        this.game.setMode(mode);
        this.updateActiveButtons();
        this.applyI18nLabels();
      });
    });

    this.el.diffBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const diff = btn.getAttribute("data-diff");
        this.store.prefs.difficulty = diff;
        save(this.store);
        this.game.setDifficulty(diff);
        this.updateActiveButtons();
      });
    });

    this.el.targetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = Number(btn.getAttribute("data-target"));
        this.store.prefs.targetScore = target;
        save(this.store);
        this.game.setTargetScore(target);
        this.updateActiveButtons();
      });
    });

    // 5. 鼠标与触控输入
    const handlePointerMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = COURT_WIDTH / rect.width;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const courtX = (clientX - rect.left) * scaleX;
      const relY = clientY - rect.top;

      audio.init();

      if (this.game.state.mode === MODES.PVP) {
        if (relY < rect.height / 2) {
          // 上半场 2P 触控
          this.game.setTopTargetX(courtX);
        } else {
          // 下半场 1P 触控
          this.game.setBottomTargetX(courtX);
        }
      } else {
        // 单人/人机默认全部控制下方挡板
        this.game.setBottomTargetX(courtX);
      }
    };

    this.canvas.addEventListener("mousemove", handlePointerMove);
    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      handlePointerMove(e);
    }, { passive: false });
    this.canvas.addEventListener("touchstart", (e) => {
      audio.init();
      handlePointerMove(e);
    }, { passive: true });

    // 6. 键盘输入监听
    window.addEventListener("keydown", (e) => {
      audio.init();
      this.keysDown.add(e.code);
      this.updateKeyboardInput();

      if (e.code === "Space") {
        e.preventDefault();
        this.game.serveBall();
      } else if (e.code === "KeyP") {
        this.game.togglePause();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keysDown.delete(e.code);
      this.updateKeyboardInput();
    });
  }

  updateKeyboardInput() {
    // 1P 方向: ArrowLeft / ArrowRight / KeyA / KeyD
    let bottomDir = 0;
    if (this.keysDown.has("ArrowLeft") || this.keysDown.has("KeyA")) bottomDir -= 1;
    if (this.keysDown.has("ArrowRight") || this.keysDown.has("KeyD")) bottomDir += 1;
    this.game.setBottomMoveDir(bottomDir);

    // 2P 方向 (双人模式): KeyJ / KeyL
    if (this.game.state.mode === MODES.PVP) {
      let topDir = 0;
      if (this.keysDown.has("KeyJ")) topDir -= 1;
      if (this.keysDown.has("KeyL")) topDir += 1;
      this.game.setTopMoveDir(topDir);
    }
  }

  handleGameEvent(ev, state) {
    if (ev.type === "paddle_hit") {
      audio.playPaddleHit(ev.rallies, ev.isSmash);
      const color = ev.hitter === "bottom" ? "#00f0ff" : "#ff007f";
      this.renderer.addHitParticles(ev.x, ev.y, color, ev.isSmash ? 16 : 9);
      this.updateHUD();
    } else if (ev.type === "wall_hit") {
      audio.playWallHit();
      this.renderer.addHitParticles(ev.x, ev.y, "#94a3b8", 6);
    } else if (ev.type === "score") {
      audio.playScore();
      this.updateHUD();
      const t = strings(this.locale);
      this.el.statusBanner.textContent = ev.scorer === "top" ? t.statusScoredTop : t.statusScoredBottom;
    } else if (ev.type === "game_over") {
      audio.playWin();
      this.store.stats = updateStats(this.store.stats, {
        mode: state.mode,
        winner: ev.winner,
        maxRally: state.maxRally,
        rallies: state.rallies
      });
      save(this.store);
      this.updateStatsDisplay();
      this.showResultModal(ev.winner, state);
    } else if (ev.type === "pause_toggled") {
      const t = strings(this.locale);
      this.el.btnPause.textContent = ev.isPaused ? t.btnResume : t.btnPause;
    }
  }

  showResultModal(winner, state) {
    const t = strings(this.locale);
    const isWin = (state.mode === MODES.PVE && winner === "bottom") || (state.mode === MODES.PVP && winner === "bottom");

    this.el.resultTitle.textContent = isWin ? t.modalTitleVictory : t.modalTitleDefeat;
    this.el.resultScore.textContent = format(t.modalScoreReport, state.scoreBottom, state.scoreTop);
    this.el.resultRally.textContent = format(t.modalMaxRallyReport, state.maxRally);
    this.el.resultModal.classList.remove("hidden");
  }

  applyI18n() {
    const t = strings(this.locale);
    this.el.html.lang = htmlLang(this.locale);
    document.title = t.docTitle;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t[key]) el.textContent = t[key];
    });

    this.el.langToggle.textContent = t.langShort;
    this.el.langToggle.setAttribute("aria-label", t.ariaLang);
    this.updateSoundBtn();
    this.applyI18nLabels();
    this.updateHUD();
    this.updateStatsDisplay();
  }

  applyI18nLabels() {
    const t = strings(this.locale);
    const mode = this.game.state.mode;

    if (mode === MODES.PVP) {
      this.el.playerTopLabel.textContent = t.playerTopPvp;
      this.el.playerBottomLabel.textContent = t.playerBottomPvp;
    } else if (mode === MODES.WALL) {
      this.el.playerTopLabel.textContent = t.playerTopWall;
      this.el.playerBottomLabel.textContent = t.playerBottom;
    } else {
      this.el.playerTopLabel.textContent = t.playerTopPve;
      this.el.playerBottomLabel.textContent = t.playerBottom;
    }
  }

  updateSoundBtn() {
    const t = strings(this.locale);
    this.el.soundToggle.textContent = this.store.prefs.muted ? `🔇 ${t.sound}` : `🔊 ${t.sound}`;
  }

  updateActiveButtons() {
    const state = this.game.state;
    this.el.modeBtns.forEach((b) => b.classList.toggle("active", b.getAttribute("data-mode") === state.mode));
    this.el.diffBtns.forEach((b) => b.classList.toggle("active", b.getAttribute("data-diff") === state.difficulty));
    this.el.targetBtns.forEach((b) => b.classList.toggle("active", Number(b.getAttribute("data-target")) === state.targetScore));
  }

  updateHUD() {
    const state = this.game.state;
    this.el.scoreTopNum.textContent = state.scoreTop;
    this.el.scoreBottomNum.textContent = state.scoreBottom;
    this.el.valRallies.textContent = state.rallies;
    this.el.valMaxRally.textContent = state.maxRally;
    this.el.valBallSpeed.textContent = `${Math.round(state.ball.speed)} px/s`;
  }

  updateStatsDisplay() {
    const t = strings(this.locale);
    const s = this.store.stats;
    this.el.valPveRecord.textContent = format(t.pveWins, s.pveWins, s.pveLosses);
    this.el.valBestRallyRecord.textContent = `${s.maxRally}`;
  }

  start() {
    this.updateActiveButtons();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;

      this.game.step(dt);
      this.renderer.render(this.game.state, dt);

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
}