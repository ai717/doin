// 森林冰火人 · DOM 交互与 UI 渲染协调层（唯一碰 DOM 处）
// 桌面双翼牌匾（火人/冰人）+ 中央神庙舞台；单人 Tab 切换 / 双人双键盘

import { strings, format, htmlLang, loadLocale, saveLocale } from "./i18n.mjs";
import { KINDS } from "./engine.mjs";
import { LEVEL_COUNT, CHAPTERS } from "./levels.mjs";
import { CONTROL_MODES, FireIceGame } from "./game.mjs";
import { load, save, recordClear, recordPlay, chapterUnlocked, chapterStars } from "./storage.mjs";
import { audio } from "./audio.mjs";
import { starsForStats, gemsCollected, formatTime } from "./score.mjs";
import { ForestStageRenderer } from "./render.mjs";

const KEYS = {
  FIRE_LEFT: ["KeyA"],
  FIRE_RIGHT: ["KeyD"],
  FIRE_JUMP: ["KeyW"],
  ICE_LEFT: ["ArrowLeft"],
  ICE_RIGHT: ["ArrowRight"],
  ICE_JUMP: ["ArrowUp"],
  FREEZE: ["KeyK"]
};

export class FireIceUI {
  constructor(game) {
    this.game = game;
    this.locale = loadLocale();
    this.store = load();
    this.canvas = document.getElementById("stage-canvas");
    this.renderer = new ForestStageRenderer(this.canvas);

    audio.setMuted(this.store.prefs.muted);

    this.keysDown = new Set();
    this.lastTime = performance.now();
    this.rafId = null;
    this.pointerMode = null; // 移动端当前方向组

    this.initDOMElements();
    this.bindEvents();
    this.applyI18n();
    this.renderLevelSelect();
    this.updateHUD();
    this.updateFocusBadge();

    this.game.subscribe((ev, state) => this.handleGameEvent(ev, state));
  }

  initDOMElements() {
    this.el = {
      html: document.documentElement,
      backHome: document.getElementById("back-home"),
      soundToggle: document.getElementById("btn-sound"),
      langToggle: document.getElementById("btn-lang"),
      rulesToggle: document.getElementById("btn-rules"),
      rulesModal: document.getElementById("modal-rules"),
      rulesClose: document.getElementById("btn-rules-close"),
      levelsModal: document.getElementById("modal-levels"),
      levelsClose: document.getElementById("btn-levels-close"),
      levelSelect: document.getElementById("level-select"),
      resultModal: document.getElementById("modal-result"),
      resultTitle: document.getElementById("result-title"),
      resultStars: document.getElementById("result-stars"),
      resultTime: document.getElementById("result-time"),
      resultGems: document.getElementById("result-gems"),
      resultDeaths: document.getElementById("result-deaths"),
      resultSync: document.getElementById("result-sync"),
      resultRecord: document.getElementById("result-record"),
      resultNext: document.getElementById("btn-result-next"),
      resultRetry: document.getElementById("btn-result-retry"),
      resultMenu: document.getElementById("btn-result-menu"),

      levelBadge: document.getElementById("level-badge"),
      levelName: document.getElementById("level-name"),
      valTime: document.getElementById("val-time"),
      valDeaths: document.getElementById("val-deaths"),
      valSync: document.getElementById("val-sync"),
      fireGems: document.getElementById("fire-gems"),
      iceGems: document.getElementById("ice-gems"),
      goldGems: document.getElementById("gold-gems"),
      focusBadge: document.getElementById("focus-badge"),
      focusBadgeDup: document.getElementById("focus-badge-dup"),
      modeToggle: document.getElementById("btn-mode"),
      btnLevels: document.getElementById("btn-levels"),
      btnRetry: document.getElementById("btn-retry"),
      btnPause: document.getElementById("btn-pause"),
      btnNext: document.getElementById("btn-next"),
      starTotal: document.getElementById("star-total"),
      statusBanner: document.getElementById("status-banner"),

      btnFireLeft: document.getElementById("btn-fire-left"),
      btnFireRight: document.getElementById("btn-fire-right"),
      btnFireJump: document.getElementById("btn-fire-jump"),
      btnIceLeft: document.getElementById("btn-ice-left"),
      btnIceRight: document.getElementById("btn-ice-right"),
      btnIceJump: document.getElementById("btn-ice-jump")
    };
  }

  bindEvents() {
    this.el.langToggle.addEventListener("click", () => {
      this.locale = this.locale === "zh" ? "en" : "zh";
      saveLocale(this.locale);
      this.applyI18n();
    });

    this.el.soundToggle.addEventListener("click", () => {
      audio.init();
      const nextMuted = !this.store.prefs.muted;
      this.store.prefs.muted = nextMuted;
      audio.setMuted(nextMuted);
      save(this.store);
      this.updateSoundBtn();
    });

    this.el.rulesToggle.addEventListener("click", () => {
      audio.init();
      this.el.rulesModal.classList.remove("hidden");
    });
    this.el.rulesClose.addEventListener("click", () => {
      this.el.rulesModal.classList.add("hidden");
    });

    // 选关弹层
    this.el.btnLevels.addEventListener("click", () => {
      audio.init();
      this.renderLevelSelect();
      this.el.levelsModal.classList.remove("hidden");
    });
    this.el.levelsClose.addEventListener("click", () => {
      this.el.levelsModal.classList.add("hidden");
    });
    this.el.levelsModal.addEventListener("click", (e) => {
      if (e.target === this.el.levelsModal) {
        this.el.levelsModal.classList.add("hidden");
      }
    });

    // 模式切换：双人 / 单人
    this.el.modeToggle.addEventListener("click", () => {
      audio.init();
      const next = this.game.controlMode === CONTROL_MODES.DUAL ? CONTROL_MODES.SOLO : CONTROL_MODES.DUAL;
      this.game.setControlMode(next);
      this.updateModeBtn();
    });

    this.el.btnRetry.addEventListener("click", () => {
      audio.init();
      recordPlay(this.store, this.game.levelIndex);
      save(this.store);
      this.game.restartLevel();
    });

    this.el.btnPause.addEventListener("click", () => {
      audio.init();
      this.game.togglePause();
    });

    this.el.btnNext.addEventListener("click", () => {
      audio.init();
      this.game.goNextLevel();
      this.updateLevelSelectActive();
      this.updateHUD();
    });

    // 结算弹窗
    this.el.resultNext.addEventListener("click", () => {
      this.el.resultModal.classList.add("hidden");
      this.game.goNextLevel();
      this.updateLevelSelectActive();
      this.updateHUD();
    });
    this.el.resultRetry.addEventListener("click", () => {
      this.el.resultModal.classList.add("hidden");
      this.game.restartLevel();
    });
    this.el.resultMenu.addEventListener("click", () => {
      this.el.resultModal.classList.add("hidden");
      this.renderLevelSelect();
      this.el.levelsModal.classList.remove("hidden");
    });

    // 移动端虚拟键
    this.bindVirtualBtn(this.el.btnFireLeft, "fire", "left");
    this.bindVirtualBtn(this.el.btnFireRight, "fire", "right");
    this.bindVirtualBtn(this.el.btnFireJump, "fire", "jump");
    this.bindVirtualBtn(this.el.btnIceLeft, "ice", "left");
    this.bindVirtualBtn(this.el.btnIceRight, "ice", "right");
    this.bindVirtualBtn(this.el.btnIceJump, "ice", "jump");

    // 键盘
    window.addEventListener("keydown", (e) => {
      audio.init();
      if (e.code === "Escape") {
        this.el.levelsModal.classList.add("hidden");
        this.el.rulesModal.classList.add("hidden");
        return;
      }
      if (e.code === "Tab") {
        e.preventDefault();
        if (this.game.controlMode === CONTROL_MODES.SOLO) {
          this.game.toggleFocus();
          this.updateFocusBadge();
        }
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (this.game.controlMode === CONTROL_MODES.SOLO) {
          this.game.setInput(this.game.focused, "jump", true);
        } else {
          this.game.setInput("ice", "jump", true);
        }
      }
      if (KEYS.FREEZE.includes(e.code)) this.game.setFreeze(true);
      this.keysDown.add(e.code);
      this.updateKeyboardInput();
    });

    window.addEventListener("keyup", (e) => {
      this.keysDown.delete(e.code);
      if (KEYS.FREEZE.includes(e.code)) this.game.setFreeze(false);
      if (e.code === "Space" && this.game.controlMode === CONTROL_MODES.SOLO) {
        this.game.setInput(this.game.focused, "jump", false);
      }
      this.updateKeyboardInput();
    });

    window.addEventListener("blur", () => {
      this.keysDown.clear();
      this.game.setFreeze(false);
      this.game.setInput("fire", "jump", false);
      this.game.setInput("ice", "jump", false);
    });
  }

  bindVirtualBtn(btn, kind, name) {
    const set = (v) => {
      audio.init();
      if (name === "jump") {
        this.game.setInput(kind, "jump", v);
      } else {
        this.game.setInput(kind, name, v);
      }
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      set(true);
    });
    btn.addEventListener("pointerup", () => set(false));
    btn.addEventListener("pointerleave", () => set(false));
    btn.addEventListener("pointercancel", () => set(false));
  }

  updateKeyboardInput() {
    const solo = this.game.controlMode === CONTROL_MODES.SOLO;
    const focus = this.game.focused;
    const pressed = (list) => list.some((c) => this.keysDown.has(c));

    if (solo) {
      // 当前焦点角色由 WASD + 方向键共同控制
      const left = pressed(KEYS.FIRE_LEFT) || pressed(KEYS.ICE_LEFT);
      const right = pressed(KEYS.FIRE_RIGHT) || pressed(KEYS.ICE_RIGHT);
      const jump = pressed(KEYS.FIRE_JUMP) || pressed(KEYS.ICE_JUMP) || this.keysDown.has("Space");
      this.game.setInput(focus, "left", left);
      this.game.setInput(focus, "right", right);
      this.game.setInput(focus, "jump", jump);
      const other = focus === "fire" ? "ice" : "fire";
      this.game.setInput(other, "left", false);
      this.game.setInput(other, "right", false);
    } else {
      this.game.setInput("fire", "left", pressed(KEYS.FIRE_LEFT));
      this.game.setInput("fire", "right", pressed(KEYS.FIRE_RIGHT));
      this.game.setInput("fire", "jump", pressed(KEYS.FIRE_JUMP));
      this.game.setInput("ice", "left", pressed(KEYS.ICE_LEFT));
      this.game.setInput("ice", "right", pressed(KEYS.ICE_RIGHT));
      this.game.setInput("ice", "jump", pressed(KEYS.ICE_JUMP) || this.keysDown.has("Space"));
    }
  }

  // ---- 关卡选择 ----
  renderLevelSelect() {
    const t = strings(this.locale);
    const unlocked = this.store.progress.unlocked;
    this.el.levelSelect.innerHTML = "";

    CHAPTERS.forEach((ch, ci) => {
      const open = chapterUnlocked(this.store, ch);
      const wrap = document.createElement("div");
      wrap.className = "chapter-block";

      const head = document.createElement("div");
      head.className = "chapter-head";
      head.innerHTML = `<span class="chapter-name">${format(t.chapterLabel, ci + 1)} · ${t["ch" + (ci + 1)]}</span><span class="chapter-stars">★ ${chapterStars(this.store, ch)}/24</span>`;
      wrap.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "level-grid";
      for (let i = ch.from; i <= ch.to; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        const stars = this.store.progress.stars[i] ?? 0;
        btn.className = "level-cell" + (i < unlocked ? "" : " locked");
        btn.setAttribute("aria-label", `${i + 1}`);
        btn.innerHTML = i < unlocked ? `${i - ch.from + 1}<span class="cell-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>` : "🔒";
        if (i < unlocked) {
          btn.addEventListener("click", () => {
            audio.init();
            recordPlay(this.store, i);
            save(this.store);
            this.game.startLevel(i);
            this.el.levelsModal.classList.add("hidden");
            this.updateLevelSelectActive();
            this.updateHUD();
          });
        }
        grid.appendChild(btn);
      }
      wrap.appendChild(grid);
      this.el.levelSelect.appendChild(wrap);
    });

    this.updateLevelSelectActive();
    this.el.starTotal.textContent = Object.values(this.store.progress.stars).reduce((a, b) => a + b, 0);
  }

  updateLevelSelectActive() {
    this.el.levelSelect.querySelectorAll(".level-cell").forEach((btn) => {
      btn.classList.remove("active");
    });
    const idx = this.game.levelIndex;
    const ch = CHAPTERS.find((c) => idx >= c.from && idx <= c.to);
    if (!ch) return;
    const cells = this.el.levelSelect.querySelectorAll(".chapter-block");
    const cell = cells[ch.id - 1]?.querySelectorAll(".level-cell")[idx - ch.from];
    if (cell) cell.classList.add("active");
  }

  // ---- 事件 ----
  handleGameEvent(ev, state) {
    const t = strings(this.locale);
    if (ev.type === "jump") {
      audio.playJump();
    } else if (ev.type === "gem") {
      const got = (ev.total?.red ?? 0) + (ev.total?.blue ?? 0) + (ev.total?.gold ?? 0);
      audio.playGem(ev.kind, got);
      const gemObj = state.gems.find((g) => g.kind === ev.kind && g.taken);
      const gx = gemObj ? gemObj.x : state.fire.x;
      const gy = gemObj ? gemObj.y : state.fire.y;
      this.renderer.addParticles(
        gx * 32, gy * 32,
        ev.kind === "red" ? "#ff5252" : ev.kind === "blue" ? "#40c4ff" : "#ffd54f",
        10, 1.2
      );
      this.updateHUD();
    } else if (ev.type === "death") {
      audio.playDeath();
      const a = ev.kind === KINDS.FIRE ? state.fire : state.ice;
      this.renderer.addParticles(a.x * 32, a.y * 32, ev.kind === KINDS.FIRE ? "#ff7043" : "#4fc3f7", 16, 1.4);
      this.updateHUD();
    } else if (ev.type === "plate_down") {
      audio.playPlate();
    } else if (ev.type === "door_open") {
      audio.playDoor(true);
    } else if (ev.type === "door_close") {
      audio.playDoor(false);
    } else if (ev.type === "portal") {
      audio.playPortal();
      const a = ev.kind === KINDS.FIRE ? state.fire : state.ice;
      this.renderer.addParticles(a.x * 32, (a.y - 0.5) * 32, "#ce93d8", 12, 1.2);
    } else if (ev.type === "freeze") {
      audio.playFreeze();
      this.renderer.addParticles(ev.x * 32, ev.y * 32, "#b3e5fc", 14, 1.2);
    } else if (ev.type === "win") {
      this.handleWin(ev);
    } else if (ev.type === "level_started") {
      this.updateLevelSelectActive();
      this.updateHUD();
    } else if (ev.type === "pause_toggled") {
      this.el.btnPause.textContent = ev.isPaused ? t.resume : t.pause;
    } else if (ev.type === "mode_changed") {
      this.updateModeBtn();
    } else if (ev.type === "focus_changed") {
      this.updateFocusBadge();
    }
  }

  handleWin(ev) {
    const t = strings(this.locale);
    const store = recordClear(this.store, {
      levelIndex: ev.levelIndex,
      stars: ev.stars,
      elapsed: ev.elapsed
    });
    const isNewBest = !(this.store.progress.bestTime[ev.levelIndex] !== undefined &&
      this.store.progress.bestTime[ev.levelIndex] <= ev.elapsed);
    this.store = store;
    save(this.store);

    audio.playWin();
    if (ev.stars >= 3) audio.playStar();

    this.el.resultTitle.textContent = t.resultTitle;
    this.el.resultStars.textContent = format(t.resultStars, "★".repeat(ev.stars));
    this.el.resultTime.textContent = `${t.resultTime}: ${formatTime(ev.elapsed)}`;
    this.el.resultGems.textContent = `${t.resultGems}: ${gemsCollected(ev.stats)}/${ev.stats.totalGems}`;
    this.el.resultDeaths.textContent = `${t.resultDeaths}: ${ev.stats.deaths}`;
    this.el.resultSync.textContent = `${t.resultSync}: ${ev.stats.syncCount}`;
    this.el.resultRecord.textContent = isNewBest ? t.resultNewRecord : "";
    this.el.resultNext.disabled = ev.levelIndex >= LEVEL_COUNT - 1;
    this.el.resultModal.classList.remove("hidden");

    this.renderLevelSelect();
    this.updateHUD();
    this.updateFocusBadge();
  }

  // ---- HUD ----
  updateHUD() {
    const t = strings(this.locale);
    const state = this.game.state;
    if (!state) return;
    const chIdx = CHAPTERS.findIndex((c) => this.game.levelIndex >= c.from && this.game.levelIndex <= c.to) + 1;
    const inCh = this.game.levelIndex - (chIdx - 1) * 8 + 1;
    this.el.levelBadge.textContent = format(t.levelLabel, this.game.levelIndex + 1);
    this.el.levelName.textContent = `${format(t.levelName, chIdx, inCh)} · ${state.levelName}`;
    this.el.valTime.textContent = formatTime(state.elapsed);
    this.el.valDeaths.textContent = state.stats.deaths;
    this.el.valSync.textContent = state.stats.syncCount;
    this.el.fireGems.textContent = format(t.gemCount, state.stats.gems.red, state.gems.filter((g) => g.kind === "red").length);
    this.el.iceGems.textContent = format(t.gemCount, state.stats.gems.blue, state.gems.filter((g) => g.kind === "blue").length);
    this.el.goldGems.textContent = format(t.gemCount, state.stats.gems.gold, state.gems.filter((g) => g.kind === "gold").length);
  }

  updateFocusBadge() {
    const t = strings(this.locale);
    const text = this.game.focused === "fire" ? t.fireFocus : t.iceFocus;
    const cls = "focus-badge " + (this.game.focused === "fire" ? "focus-fire" : "focus-ice");
    this.el.focusBadge.textContent = text;
    this.el.focusBadge.className = cls;
    if (this.el.focusBadgeDup) {
      this.el.focusBadgeDup.textContent = text;
      this.el.focusBadgeDup.className = cls;
    }
  }

  updateModeBtn() {
    const t = strings(this.locale);
    this.el.modeToggle.textContent = this.game.controlMode === CONTROL_MODES.DUAL ? t.soloTip : t.dualTip;
    this.el.modeToggle.classList.toggle("active", this.game.controlMode === CONTROL_MODES.SOLO);
  }

  // ---- i18n ----
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
    this.updateModeBtn();
    this.updateFocusBadge();
    this.renderLevelSelect();
    this.updateHUD();
  }

  updateSoundBtn() {
    const t = strings(this.locale);
    this.el.soundToggle.textContent = this.store.prefs.muted ? `🔇 ${t.sound}` : `🔊 ${t.sound}`;
  }

  // ---- 主循环 ----
  start() {
    this.updateModeBtn();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;

      this.game.step(dt);
      const state = this.game.state;
      if (state) {
        // 冻结光效（ice 按 K 蓄力）
        state.ice.freezeGlow = this.game.inputs.freeze ? 0.4 + 0.3 * Math.sin(now / 90) : 0;
        this.renderer.render(state, dt, {
          focused: this.game.controlMode === CONTROL_MODES.SOLO ? this.game.focused : null
        });
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
}
