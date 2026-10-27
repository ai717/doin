// Piano Tiles — DOM 层事件绑定 + HUD 更新 + 弹窗控制
// 不做业务逻辑，只派发事件、更新 UI

import { unlockAudio, setMuted, isMuted } from "./audio.mjs";
import { detectLocale, saveLocale, htmlLang, t } from "./i18n.mjs";

export class UI {
  constructor({ game, renderer, storage }) {
    this.game = game;
    this.renderer = renderer;
    this.storage = storage;
    this.locale = detectLocale();

    this._bindDOM();
    this._applyLocale();
    this._bindGameEvents();
    this._bindInput();
  }

  // ===== DOM 引用 =====
  _bindDOM() {
    const $ = (id) => document.getElementById(id);
    this.dom = {
      canvas: $("game-canvas"),
      hudScore: $("hud-score"),
      hudCombo: $("hud-combo"),
      hudRank: $("hud-rank"),
      hudBestCombo: $("hud-best-combo"),
      hudBest: $("hud-best"),
      hudHearts: $("hud-hearts"),
      // 弹窗
      modalWelcome: $("modal-welcome"),
      modalPause: $("modal-pause"),
      modalGameover: $("modal-gameover"),
      modalRules: $("modal-rules"),
      // Gameover 数据
      settleScore: $("settle-score"),
      settleCombo: $("settle-combo"),
      settleRank: $("settle-rank"),
      settleBest: $("settle-best"),
      settleTitle: $("settle-title"),
      settleRankIcon: $("settle-rank-icon"),
      // 按钮
      btnStart: $("btn-start"),
      btnPause: $("btn-pause"),
      btnResume: $("btn-resume"),
      btnRestart: $("btn-restart"),
      btnRestartPause: $("btn-restart-pause"),
      btnReplay: $("btn-replay"),
      btnModeClassic: $("btn-mode-classic"),
      btnSound: $("btn-sound"),
      btnLang: $("btn-lang"),
      btnHelp: $("btn-help"),
      btnCloseRules: $("btn-close-rules"),
    };
  }

  // ===== 应用语言 =====
  _applyLocale() {
    document.documentElement.lang = htmlLang(this.locale);
    document.title = t("gameTitle", this.locale) + " | DOIN";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key, this.locale);
    });
    this.dom.btnLang.textContent = this.locale === "zh" ? "EN" : "中";
  }

  // ===== 游戏事件订阅 =====
  _bindGameEvents() {
    const g = this.game;

    g.on("start", () => {
      this._hideModal(this.dom.modalWelcome);
      this._hideModal(this.dom.modalGameover);
      this._hideModal(this.dom.modalPause);
      this.renderer.reset();
    });

    g.on("tick", (snap) => {
      this._updateHUD(snap);
      this.renderer.render(snap, 0.016);
      this.renderer.drawJudgeLine();
    });

    g.on("hit", (info) => {
      // 找到命中的 tile y 坐标
      const tile = g.state.tiles.find((t) => t.id === info.tileId);
      if (tile) {
        this.renderer.pushHitFx(tile.id, tile.col, tile.y + tile.height / 2, info.quality);
      }
    });

    g.on("miss", () => {
      this._shakeStage();
      this._updateHearts();
    });

    g.on("pause", () => {
      this._showModal(this.dom.modalPause);
    });

    g.on("resume", () => {
      this._hideModal(this.dom.modalPause);
    });

    g.on("reset", (snap) => {
      this.renderer.reset();
      this._updateHUD(snap);
      this._updateHearts();
      this._showModal(this.dom.modalWelcome);
    });

    g.on("gameover", (snap) => {
      this._showGameover(snap);
      this._persistRun(snap);
    });
  }

  // ===== HUD 更新 =====
  _updateHUD(snap) {
    this.dom.hudScore.textContent = snap.score;
    this.dom.hudCombo.textContent = snap.combo;
    this.dom.hudRank.textContent = snap.rank || "—";
    this.dom.hudBestCombo.textContent = Math.max(snap.maxCombo, this.storage.bestCombo || 0);
    this.dom.hudBest.textContent = this.storage.bestScore || 0;

    // 分数/Combo bump 动画
    this.dom.hudScore.classList.remove("bump");
    void this.dom.hudScore.offsetWidth;
    this.dom.hudScore.classList.add("bump");
  }

  _updateHearts() {
    const max = 3;
    const remaining = max - this.game.state.misses;
    const hearts = this.dom.hudHearts.querySelectorAll(".heart");
    hearts.forEach((h, i) => {
      if (i < remaining) {
        h.classList.add("heart-on");
        h.classList.remove("heart-off");
      } else {
        h.classList.remove("heart-on");
        h.classList.add("heart-off");
      }
    });
  }

  _shakeStage() {
    const core = document.querySelector(".stage-core");
    if (!core) return;
    core.classList.remove("shake");
    void core.offsetWidth;
    core.classList.add("shake");
  }

  // ===== 结算 =====
  _showGameover(snap) {
    this.dom.settleScore.textContent = snap.score;
    this.dom.settleCombo.textContent = snap.maxCombo;
    this.dom.settleRank.textContent = snap.rank || t("rank", this.locale) + " —";
    this.dom.settleBest.textContent = Math.max(snap.score, this.storage.bestScore || 0);

    // 段位图标
    const icons = {
      "新秀": "🌱", "快手": "⚡", "手速大师": "🔥", "指尖传说": "👑",
      "Rookie": "🌱", "Swift": "⚡", "Master": "🔥", "Legend": "👑",
    };
    this.dom.settleRankIcon.textContent = icons[snap.rank] || "🎹";

    this._showModal(this.dom.modalGameover);
  }

  _persistRun(snap) {
    const rankName = this.locale === "zh" ? snap.rank : snap.rankEn;
    const updated = {
      ...this.storage,
      gamesPlayed: (this.storage.gamesPlayed || 0) + 1,
    };
    if (snap.score > (this.storage.bestScore || 0)) updated.bestScore = snap.score;
    if (snap.maxCombo > (this.storage.bestCombo || 0)) {
      updated.bestCombo = snap.maxCombo;
      if (rankName) updated.bestRank = rankName;
    }
    this.storage = updated;
    // 由 main 层负责真正 save
    this._onStorageChange?.(updated);
  }

  set onStorageChange(fn) { this._onStorageChange = fn; }

  // ===== 输入绑定 =====
  _bindInput() {
    const g = this.game;
    const canvas = this.dom.canvas;

    // Canvas 点击/触摸
    const handlePointer = (clientX) => {
      if (!g.state.running || g.state.paused || g.state.gameOver) return;
      const col = this.renderer.getColFromX(clientX);
      const result = g.handleHit(col);
      // 音效由 main 层监听 hit/miss 事件触发
    };

    canvas.addEventListener("pointerdown", (e) => {
      unlockAudio();
      handlePointer(e.clientX);
    });

    // 键盘
    const keyMap = {
      "1": 0, "d": 0, "D": 0,
      "2": 1, "f": 1, "F": 1,
      "3": 2, "j": 2, "J": 2,
      "4": 3, "k": 3, "K": 3,
    };

    window.addEventListener("keydown", (e) => {
      // 暂停/继续
      if (e.key === "p" || e.key === "P" || e.key === "Enter") {
        e.preventDefault();
        if (g.state.gameOver) return;
        if (g.state.paused) g.resume();
        else if (g.state.running) g.pause();
        else if (!g.state.running) {
          // 从 welcome 直接回车 = 开始
          this._startGame();
        }
        return;
      }

      // 列点击
      const col = keyMap[e.key];
      if (col !== undefined) {
        e.preventDefault();
        unlockAudio();
        if (!g.state.running) {
          this._startGame();
        }
        setTimeout(() => g.handleHit(col), 0);
      }
    });

    // 按钮
    this.dom.btnStart.addEventListener("click", () => {
      unlockAudio();
      this._startGame();
    });
    this.dom.btnModeClassic.addEventListener("click", () => {
      unlockAudio();
      this._startGame();
    });
    this.dom.btnPause.addEventListener("click", () => {
      if (g.state.paused) g.resume();
      else g.pause();
    });
    this.dom.btnResume.addEventListener("click", () => g.resume());
    this.dom.btnRestart.addEventListener("click", () => {
      g.restart();
    });
    this.dom.btnRestartPause.addEventListener("click", () => {
      g.restart();
      this._hideModal(this.dom.modalPause);
      this._showModal(this.dom.modalWelcome);
    });
    this.dom.btnReplay.addEventListener("click", () => {
      g.restart();
      this._hideModal(this.dom.modalGameover);
      this._startGame();
    });

    this.dom.btnSound.addEventListener("click", () => {
      const next = !isMuted();
      setMuted(next);
      this.dom.btnSound.textContent = next ? "🔇" : "🔊";
      this.storage.soundEnabled = !next;
      this._onStorageChange?.(this.storage);
    });

    this.dom.btnLang.addEventListener("click", () => {
      this.locale = this.locale === "zh" ? "en" : "zh";
      saveLocale(this.locale);
      this._applyLocale();
    });

    this.dom.btnHelp.addEventListener("click", () => {
      this._showModal(this.dom.modalRules);
    });
    this.dom.btnCloseRules.addEventListener("click", () => {
      this._hideModal(this.dom.modalRules);
    });

    // 初始化音效按钮图标
    this.dom.btnSound.textContent = isMuted() ? "🔇" : "🔊";
  }

  _startGame() {
    const g = this.game;
    if (g.state.gameOver || !g.state.running) {
      // 确保是干净状态
      if (g.state.gameOver) g.restart();
      g.start();
    } else if (g.state.paused) {
      g.resume();
    }
    this._hideModal(this.dom.modalWelcome);
  }

  // ===== 弹窗控制 =====
  _showModal(el) { el?.classList.remove("hidden"); }
  _hideModal(el) { el?.classList.add("hidden"); }
}
