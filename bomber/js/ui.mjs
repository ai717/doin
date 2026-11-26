// Bomber - DOM layer. Builds every view, mirrors engine state into the HUD,
// and keeps language switching purely textual (never touches the running state).
import { MODE_PUZZLE } from "./engine.mjs";
import { CAMPAIGN_LEVELS, PUZZLE_LEVELS } from "./levels.mjs";
import { t, format } from "./i18n.mjs";
import { formatClock, formatPercent } from "./score.mjs";

const POWER_SLOTS = ["bomb", "fire", "speed", "kick", "remote", "pierce", "shield"];

export class UI {
  constructor({ root, game, renderer, audio }) {
    this.root = root;
    this.game = game;
    this.renderer = renderer;
    this.audio = audio;
    this.lang = "zh";
    this.view = "menu";
    this.overlay = null;
    this.hud = {};
    this.onLangToggle = null;
    this.onSoundToggle = null;
    this.onHelp = null;
    this.refreshStaticTexts();
  }

  setLang(lang) {
    this.lang = lang;
    this.refreshStaticTexts();
    this.render();
  }

  refreshStaticTexts() {
    for (const node of document.querySelectorAll("[data-i18n]")) {
      const key = node.getAttribute("data-i18n");
      const value = t(key, this.lang);
      if (node.hasAttribute("data-i18n-attr")) node.setAttribute(node.getAttribute("data-i18n-attr"), value);
      else node.textContent = value;
    }
    const langBtn = document.getElementById("btn-lang");
    if (langBtn) langBtn.textContent = this.lang === "zh" ? "EN" : t("langName", this.lang);
  }

  // ---------------------------------------------------------------- views

  render() {
    if (this.view === "campaign") this.renderCampaign();
    else if (this.view === "puzzle") this.renderPuzzle();
    else if (this.view === "play") this.renderPlay();
    else this.renderMenu();
    this.renderOverlay();
  }

  showMenu() {
    this.view = "menu";
    this.render();
  }

  showCampaign() {
    this.view = "campaign";
    this.render();
  }

  showPuzzle() {
    this.view = "puzzle";
    this.render();
  }

  showPlay() {
    this.view = "play";
    this.render();
  }

  renderMenu() {
    const lang = this.lang;
    const data = this.game.data;
    this.root.innerHTML = `
      <section class="view menu-view">
        <p class="tagline" data-i18n="tagline">${t("tagline", lang)}</p>
        <div class="mode-grid">
          <button class="mode-card" type="button" data-action="campaign">
            <span class="mode-icon">💣</span>
            <span class="mode-name">${t("modeCampaign", lang)}</span>
            <span class="mode-sub">${t("modeCampaignSub", lang)}</span>
          </button>
          <button class="mode-card" type="button" data-action="puzzle">
            <span class="mode-icon">🧩</span>
            <span class="mode-name">${t("modePuzzle", lang)}</span>
            <span class="mode-sub">${t("modePuzzleSub", lang)}</span>
          </button>
        </div>
        <div class="menu-foot">
          <button class="wood-btn" type="button" data-action="workshop">${t("btnWorkshop", lang)}</button>
          <span class="parts-chip">${t("hudParts", lang)} ${data.parts}</span>
        </div>
      </section>
    `;
  }

  renderCampaign() {
    const lang = this.lang;
    const data = this.game.data;
    const chapters = [1, 2, 3, 4, 5]
      .map((chapter) => {
        const from = (chapter - 1) * 8;
        const cards = CAMPAIGN_LEVELS.slice(from, from + 8)
          .map((level, i) => {
            const index = from + i;
            const unlocked = index + 1 <= data.campaignUnlocked;
            const entry = data.campaign[level.id];
            const stars = entry?.stars ?? 0;
            return `<button class="stage-card${unlocked ? "" : " is-locked"}" type="button" data-stage="${index}" ${unlocked ? "" : "disabled"}>
              <span class="stage-num">${index + 1}</span>
              <span class="stage-stars">${unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) : "🔒"}</span>
            </button>`;
          })
          .join("");
        return `<div class="chapter">
            <h3 class="chapter-name">${t(`chapter_${chapter}`, lang)}</h3>
            <div class="stage-grid">${cards}</div>
          </div>`;
      })
      .join("");
    this.root.innerHTML = `
      <section class="view map-view">
        <header class="map-head">
          <button class="wood-btn" type="button" data-action="menu">← ${t("btnMap", lang)}</button>
          <h2>${t("modeCampaign", lang)}</h2>
          <span class="parts-chip">★ ${this.game.totalStars()} / ${(CAMPAIGN_LEVELS.length + PUZZLE_LEVELS.length) * 3}</span>
        </header>
        ${chapters}
      </section>
    `;
  }

  renderPuzzle() {
    const lang = this.lang;
    const data = this.game.data;
    const cards = PUZZLE_LEVELS.map((level, index) => {
      const unlocked = index + 1 <= data.puzzleUnlocked;
      const entry = data.puzzles[level.id];
      const stars = entry?.stars ?? 0;
      return `<button class="stage-card${unlocked ? "" : " is-locked"}" type="button" data-puzzle="${index}" ${unlocked ? "" : "disabled"}>
        <span class="stage-num">${index + 1}</span>
        <span class="stage-stars">${unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) : "🔒"}</span>
        <span class="stage-par">${level.par}</span>
      </button>`;
    }).join("");
    this.root.innerHTML = `
      <section class="view map-view">
        <header class="map-head">
          <button class="wood-btn" type="button" data-action="menu">← ${t("btnMap", lang)}</button>
          <h2>${t("modePuzzle", lang)}</h2>
          <span class="parts-chip">${t("hudParts", lang)} ${data.parts}</span>
        </header>
        <div class="stage-grid wide">${cards}</div>
        <p class="map-hint">${t("helpPuzzle", lang)}</p>
      </section>
    `;
  }

  renderPlay() {
    const lang = this.lang;
    const state = this.game.state;
    const puzzle = state?.mode === MODE_PUZZLE;
    this.root.innerHTML = `
      <section class="view play-view">
        <div class="signboard">
          <span class="sign-chip"><b data-i18n="hudLevel">${t("hudLevel", lang)}</b><i id="hud-level">-</i></span>
          <span class="sign-chip"><b data-i18n="${puzzle ? "hudTargets" : "hudEnemies"}">${t(puzzle ? "hudTargets" : "hudEnemies", lang)}</b><i id="hud-enemies">-</i></span>
          <span class="sign-chip"><b data-i18n="hudTime">${t("hudTime", lang)}</b><i id="hud-time">-</i></span>
          <span class="sign-chip"><b data-i18n="hudDemo">${t("hudDemo", lang)}</b><i id="hud-demo">-</i></span>
          <span class="sign-chip chain"><b data-i18n="hudChain">${t("hudChain", lang)}</b><i id="hud-chain">0</i></span>
          <button class="sign-toggle" type="button" data-action="assist">${t("assistLabel", lang)}: <i id="hud-assist">${this.game.data.assist ? t("assistOn", lang) : t("assistOff", lang)}</i></button>
        </div>

        <div class="sandbox">
          <div class="sandbox-frame">
            <canvas id="stage-canvas" aria-label="stage"></canvas>
          </div>
        </div>

        <div class="drawer">
          <div class="part-slots" id="part-slots"></div>
          <div class="drawer-actions">
            <button class="wood-btn" type="button" data-action="pause">${t("paused", lang)}</button>
            <button class="wood-btn" type="button" data-action="restart">${t("btnRestart", lang)}</button>
            <button class="wood-btn" type="button" data-action="map">${t("btnMap", lang)}</button>
          </div>
        </div>

        <div class="touch-pad">
          <div class="stick" id="stick"><span class="stick-nub" id="stick-nub"></span></div>
          <div class="touch-buttons">
            <button class="touch-btn bomb" type="button" data-action="bomb">💣</button>
            <button class="touch-btn remote" type="button" data-action="remote">⚡</button>
          </div>
        </div>
      </section>
    `;
    this.hud = {
      level: document.getElementById("hud-level"),
      enemies: document.getElementById("hud-enemies"),
      time: document.getElementById("hud-time"),
      demo: document.getElementById("hud-demo"),
      chain: document.getElementById("hud-chain"),
      assist: document.getElementById("hud-assist"),
      slots: document.getElementById("part-slots"),
    };
    // every re-render swaps the canvas element, so rebind it right away
    this.mountCanvas();
    this.updateHud(true);
    this.bindTouch();
  }

  mountCanvas() {
    const canvas = document.getElementById("stage-canvas");
    if (!canvas) return;
    this.renderer.canvas = canvas;
    this.renderer.ctx = canvas.getContext ? canvas.getContext("2d") : null;
    this.renderer.assist = this.game.data.assist;
    if (this.game.state) this.renderer.attach(this.game.state);
    canvas.addEventListener("pointerdown", (event) => {
      const cell = this.renderer.screenToCell(event.clientX, event.clientY);
      if (cell) this.game.tapCell(cell[0], cell[1]);
    });
  }

  bindTouch() {
    const stick = document.getElementById("stick");
    const nub = document.getElementById("stick-nub");
    if (!stick) return;
    let active = false;
    const setDir = (dx, dy) => {
      this.game.move(dx, dy);
      if (nub) {
        nub.style.transform = `translate(${dx * 22}px, ${dy * 22}px)`;
      }
    };
    const fromEvent = (event) => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const threshold = rect.width * 0.16;
      if (Math.hypot(dx, dy) < threshold) {
        setDir(0, 0);
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) setDir(Math.sign(dx), 0);
      else setDir(0, Math.sign(dy));
    };
    stick.addEventListener("pointerdown", (event) => {
      active = true;
      stick.setPointerCapture?.(event.pointerId);
      fromEvent(event);
    });
    stick.addEventListener("pointermove", (event) => {
      if (active) fromEvent(event);
    });
    const stop = () => {
      active = false;
      setDir(0, 0);
    };
    stick.addEventListener("pointerup", stop);
    stick.addEventListener("pointercancel", stop);
    stick.addEventListener("pointerleave", stop);
  }

  // ---------------------------------------------------------------- hud

  updateHud(force = false) {
    const state = this.game.state;
    if (!state || this.view !== "play" || !this.hud.level) return;
    const lang = this.lang;
    const puzzle = state.mode === MODE_PUZZLE;
    this.hud.level.textContent = puzzle
      ? format("puzzleTitle", lang, { n: this.game.index + 1 })
      : format("stage", lang, { n: this.game.index + 1 });
    const left = state.stats.enemiesTotal - state.stats.kills;
    this.hud.enemies.textContent = `${state.stats.kills}/${state.stats.enemiesTotal}`;
    this.hud.time.textContent = formatClock(state.timeLeft / 60);
    this.hud.demo.textContent = formatPercent(state.stats.bricksTotal ? state.stats.bricksBroken / state.stats.bricksTotal : 1);
    this.hud.chain.textContent = String(state.chain);
    if (force) this.renderSlots();
  }

  renderSlots() {
    const state = this.game.state;
    if (!this.hud.slots || !state) return;
    const p = state.player;
    const values = {
      bomb: p.bombMax - p.bombsOut,
      fire: p.fire,
      speed: p.speedLevel + 1,
      kick: p.kick ? 1 : 0,
      remote: p.remote ? 1 : 0,
      pierce: p.pierce ? 1 : 0,
      shield: p.shield,
    };
    this.hud.slots.innerHTML = POWER_SLOTS.map((kind) => {
      const value = values[kind];
      const on = value > 0;
      return `<span class="slot${on ? " is-on" : ""}" data-kind="${kind}">
        <em>${t(`p_${kind}`, this.lang)}</em>
        <b>${on ? (kind === "kick" || kind === "remote" || kind === "pierce" ? "✓" : `+${value}`) : "-"}</b>
      </span>`;
    }).join("");
  }

  // ---------------------------------------------------------------- overlays

  closeOverlay() {
    this.overlay = null;
    const node = document.getElementById("overlay-layer");
    if (node) node.remove();
  }

  openOverlay(name, html) {
    this.overlay = name;
    let node = document.getElementById("overlay-layer");
    if (!node) {
      node = document.createElement("div");
      node.id = "overlay-layer";
      document.body.appendChild(node);
    }
    node.innerHTML = `<div class="overlay-backdrop"></div><div class="overlay-card">${html}</div>`;
    return node;
  }

  renderOverlay() {
    if (!this.overlay) return;
    if (this.overlay === "help") this.showHelp();
    else if (this.overlay === "pause") this.showPause();
    else if (this.overlay === "workshop") this.showWorkshop();
    else if (this.overlay === "result") this.showResult(this.resultInfo);
  }

  showHelp() {
    const lang = this.lang;
    const node = this.openOverlay(
      "help",
      `<h2>${t("helpTitle", lang)}</h2>
       <p>${t("helpBody", lang)}</p>
       <p class="dim">${t("helpPuzzle", lang)}</p>
       <button class="wood-btn" type="button" data-action="close">${t("btnClose", lang)}</button>`
    );
    node.querySelector('[data-action="close"]')?.addEventListener("click", () => this.closeOverlay());
  }

  showPause() {
    const lang = this.lang;
    const node = this.openOverlay(
      "pause",
      `<h2>${t("paused", lang)}</h2>
       <div class="overlay-actions">
         <button class="wood-btn primary" type="button" data-action="resume">${t("btnResume", lang)}</button>
         <button class="wood-btn" type="button" data-action="restart">${t("btnRestart", lang)}</button>
         <button class="wood-btn" type="button" data-action="map">${t("btnMap", lang)}</button>
       </div>`
    );
    node.querySelector('[data-action="resume"]')?.addEventListener("click", () => {
      this.closeOverlay();
      this.game.setPaused(false);
    });
  }

  showWorkshop() {
    const lang = this.lang;
    const data = this.game.data;
    const rows = [
      ["bomb", "u_bomb", "u_bombDesc"],
      ["fire", "u_fire", "u_fireDesc"],
      ["shield", "u_shield", "u_shieldDesc"],
    ]
      .map(([key, nameKey, descKey]) => {
        const cost = this.game.unlockCost(key);
        const owned = data.unlocks[key];
        const afford = data.parts >= cost;
        return `<div class="ws-row">
          <div class="ws-text"><b>${t(nameKey, lang)}</b><span>${t(descKey, lang)}</span></div>
          <button class="wood-btn${owned ? " is-owned" : afford ? " primary" : ""}" type="button" data-unlock="${key}" ${owned || !afford ? "disabled" : ""}>
            ${owned ? t("unlocked", lang) : `${t("btnUnlock", lang)} · ${cost}`}
          </button>
        </div>`;
      })
      .join("");
    const node = this.openOverlay(
      "workshop",
      `<h2>${t("wsTitle", lang)}</h2>
       <p class="ws-parts">${t("wsParts", lang)}: <b>${data.parts}</b></p>
       <p class="dim">${t("wsHint", lang)}</p>
       <div class="ws-list">${rows}</div>
       <div class="ws-records">
         <span>${t("recChain", lang)}: <b>${data.records.maxChain}</b></span>
         <span>${t("recDemo", lang)}: <b>${formatPercent(data.records.bestDemo)}</b></span>
         <span>${t("recStars", lang)}: <b>${this.game.totalStars()}</b></span>
       </div>
       <button class="wood-btn" type="button" data-action="close">${t("btnClose", lang)}</button>`
    );
    for (const btn of node.querySelectorAll("[data-unlock]")) {
      btn.addEventListener("click", () => {
        if (this.game.unlock(btn.getAttribute("data-unlock"))) {
          this.audio?.play("pickup", "shield");
          this.showWorkshop();
        }
      });
    }
    node.querySelector('[data-action="close"]')?.addEventListener("click", () => this.closeOverlay());
  }

  showResult(info) {
    if (!info) return;
    this.resultInfo = info;
    const lang = this.lang;
    const title = info.won ? (info.par ? t("resultSolved", lang) : t("resultWin", lang)) : t("resultLose", lang);
    const stars = "★".repeat(info.stars) + "☆".repeat(3 - info.stars);
    const rows = [
      `<span>${t("statTime", lang)}: <b>${formatClock(info.elapsedSeconds)}</b></span>`,
      `<span>${t("statDemo", lang)}: <b>${formatPercent(info.demo)}</b></span>`,
      `<span>${t("statChain", lang)}: <b>${info.maxChain}</b></span>`,
      `<span>${t("statBombs", lang)}: <b>${info.bombsUsed}</b>${info.par ? ` / ${t("statPar", lang)} ${info.par}` : ""}</span>`,
    ].join("");
    const canNext = info.won && this.game.index + 1 < this.game.levelCount();
    const node = this.openOverlay(
      "result",
      `<h2>${title}</h2>
       <div class="result-stars">${stars}</div>
       <div class="result-rows">${rows}</div>
       ${info.oneChain ? `<p class="result-badge">${t("oneChain", lang)}</p>` : ""}
       ${info.gainedParts ? `<p class="result-parts">+${info.gainedParts} ${t("wsParts", lang)}</p>` : ""}
       <div class="overlay-actions">
         ${canNext ? `<button class="wood-btn primary" type="button" data-action="next">${t("btnNext", lang)}</button>` : ""}
         <button class="wood-btn" type="button" data-action="retry">${t("btnRetry", lang)}</button>
         <button class="wood-btn" type="button" data-action="map">${t("btnMap", lang)}</button>
       </div>`
    );
    node.querySelector('[data-action="next"]')?.addEventListener("click", () => {
      this.closeOverlay();
      this.game.nextLevel();
    });
    node.querySelector('[data-action="retry"]')?.addEventListener("click", () => {
      this.closeOverlay();
      this.game.restart();
    });
    node.querySelector('[data-action="map"]')?.addEventListener("click", () => {
      this.closeOverlay();
      this.showCampaign();
    });
  }
}
