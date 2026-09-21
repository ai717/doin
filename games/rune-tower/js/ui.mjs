// UI 界面管理器（唯一直接操作 DOM 的层，支持完整实时双语刷新、章节选关与暂停机制）

import { t, getLanguage, setLanguage } from "./i18n.mjs";
import { RUNES, TIER_MULTIPLIERS, PEDESTALS, getWaveComposition } from "./engine.mjs";
import * as Storage from "./storage.mjs";
import { sound } from "./audio.mjs";

export class RuneTowerUI {
  constructor({ game, onAction }) {
    this.game = game;
    this.onAction = onAction;

    this.elements = {
      labelBackHome: document.getElementById("label-back-home"),
      gameMainTitle: document.getElementById("game-main-title"),
      gameSubTitle: document.getElementById("game-sub-title"),
      labelWave: document.getElementById("label-wave"),
      labelMana: document.getElementById("label-mana"),
      labelScore: document.getElementById("label-score"),
      crystalLabel: document.getElementById("ui-crystal-label"),
      waveText: document.getElementById("ui-wave"),
      crystalBar: document.getElementById("ui-crystal-bar"),
      crystalText: document.getElementById("ui-crystal-text"),
      manaText: document.getElementById("ui-mana"),
      scoreText: document.getElementById("ui-score"),
      speedBtn: document.getElementById("btn-speed"),
      startWaveBtn: document.getElementById("btn-start-wave"),
      rushWaveBtn: document.getElementById("btn-rush-wave"),
      pauseTopBtn: document.getElementById("btn-pause-top"),
      pauseInlineBtn: document.getElementById("btn-pause-inline"),
      chapterMenuBtn: document.getElementById("btn-chapter-menu"),
      chaptersBtn: document.getElementById("btn-chapters"),
      langBtn: document.getElementById("btn-lang"),
      audioBtn: document.getElementById("btn-audio"),
      scoutTitle: document.getElementById("ui-scout-title"),
      scoutList: document.getElementById("ui-scout-list"),
      activeRelicsTitle: document.getElementById("ui-active-relics-title"),
      relicsShelf: document.getElementById("ui-relics-shelf"),
      pedestalPanel: document.getElementById("ui-pedestal-panel"),
      pedestalTitle: document.getElementById("pedestal-title"),
      pedestalBody: document.getElementById("pedestal-body"),
      btnClosePedestal: document.getElementById("btn-close-pedestal"),
      hotkeyTip: document.getElementById("ui-hotkey-tip"),

      // 暂停弹窗
      pauseModal: document.getElementById("modal-pause"),
      pauseTitle: document.getElementById("pause-modal-title"),
      pauseSubtitle: document.getElementById("pause-modal-subtitle"),
      resumeBtn: document.getElementById("btn-resume"),
      pauseChaptersBtn: document.getElementById("btn-pause-chapters"),
      pauseRestartBtn: document.getElementById("btn-pause-restart"),
      pauseHomeBtn: document.getElementById("btn-pause-home"),

      // 章节选关弹窗
      chaptersModal: document.getElementById("modal-chapters"),
      chaptersTitle: document.getElementById("chapters-modal-title"),
      chaptersSubtitle: document.getElementById("chapters-modal-subtitle"),
      chaptersContainer: document.getElementById("chapters-container"),
      btnCloseChapters: document.getElementById("btn-close-chapters"),

      // 神龛与终局
      relicModal: document.getElementById("modal-relic-draft"),
      draftModalTitle: document.getElementById("draft-modal-title"),
      draftModalSubtitle: document.getElementById("draft-modal-subtitle"),
      relicOptions: document.getElementById("relic-options-container"),
      relicRerollBtn: document.getElementById("btn-relic-reroll"),
      endModal: document.getElementById("modal-endgame"),
      endTitle: document.getElementById("end-title"),
      endSubtitle: document.getElementById("end-subtitle"),
      endStats: document.getElementById("end-stats"),
      restartBtn: document.getElementById("btn-restart"),
    };

    this.selectedPedestalId = null;
    this.initEvents();
    this.updateAllTexts();
  }

  initEvents() {
    this.elements.speedBtn.addEventListener("click", () => {
      const spd = this.game.toggleSpeed();
      this.elements.speedBtn.textContent = t("speedToggle", undefined, { spd });
    });

    this.elements.startWaveBtn.addEventListener("click", () => {
      this.game.startWave();
    });

    this.elements.rushWaveBtn.addEventListener("click", () => {
      this.game.rushWave();
    });

    // 暂停相关
    const handlePauseClick = () => {
      this.game.togglePause();
      this.syncPauseModal();
    };
    if (this.elements.pauseTopBtn) this.elements.pauseTopBtn.addEventListener("click", handlePauseClick);
    if (this.elements.pauseInlineBtn) this.elements.pauseInlineBtn.addEventListener("click", handlePauseClick);
    if (this.elements.resumeBtn) {
      this.elements.resumeBtn.addEventListener("click", () => {
        this.game.setPaused(false);
        this.syncPauseModal();
      });
    }
    if (this.elements.pauseRestartBtn) {
      this.elements.pauseRestartBtn.addEventListener("click", () => {
        this.game.setPaused(false);
        this.elements.pauseModal.classList.add("hidden");
        this.game.restart();
      });
    }

    // 章节选关相关
    const handleOpenChapters = () => {
      this.game.setPaused(true);
      this.syncPauseModal();
      this.openChaptersModal();
    };
    if (this.elements.chapterMenuBtn) this.elements.chapterMenuBtn.addEventListener("click", handleOpenChapters);
    if (this.elements.chaptersBtn) this.elements.chaptersBtn.addEventListener("click", handleOpenChapters);
    if (this.elements.pauseChaptersBtn) {
      this.elements.pauseChaptersBtn.addEventListener("click", () => {
        this.elements.pauseModal.classList.add("hidden");
        this.openChaptersModal();
      });
    }
    if (this.elements.btnCloseChapters) {
      this.elements.btnCloseChapters.addEventListener("click", () => {
        this.closeChaptersModal();
      });
    }

    this.elements.langBtn.addEventListener("click", () => {
      const current = getLanguage();
      const next = current === "zh" ? "en" : "zh";
      setLanguage(next);
      document.documentElement.lang = next;
      this.updateAllTexts();
      this.update(this.game.getState());
      if (this.selectedPedestalId) {
        this.renderPedestalPanel(this.selectedPedestalId);
      }
      if (!this.elements.chaptersModal.classList.contains("hidden")) {
        this.renderChaptersGrid();
      }
    });

    if (this.elements.btnClosePedestal) {
      this.elements.btnClosePedestal.addEventListener("click", () => {
        this.closePedestalPanel();
      });
    }

    this.elements.relicRerollBtn.addEventListener("click", () => {
      this.game.rerollRelics();
    });

    this.elements.restartBtn.addEventListener("click", () => {
      this.elements.endModal.classList.add("hidden");
      this.game.restart();
    });
  }

  syncPauseModal() {
    if (this.game.isPaused) {
      this.elements.pauseModal.classList.remove("hidden");
    } else {
      this.elements.pauseModal.classList.add("hidden");
    }
  }

  openChaptersModal() {
    this.renderChaptersGrid();
    this.elements.chaptersModal.classList.remove("hidden");
  }

  closeChaptersModal() {
    this.elements.chaptersModal.classList.add("hidden");
  }

  renderChaptersGrid() {
    const saveData = Storage.loadSaveData();
    const maxUnlocked = saveData.maxChapterUnlocked || 1;
    let html = "";

    // 若存在未完成的局内进度，置顶展示【继续当前进度】卡片
    if (saveData.savedRun && saveData.savedRun.wave > 1) {
      const run = saveData.savedRun;
      html += `
        <div class="chapter-card resume-card" id="card-resume-run">
          <div class="chapter-badge resume">${t("resumeSavedRun")}</div>
          <h3>${t("savedRunInfo", undefined, { w: run.wave, m: run.mana, r: run.activeRelics.length })}</h3>
          <p>核心生命: ${run.crystalHp} / 20 · 击杀数: ${run.kills}</p>
          <button class="btn-select-chapter resume-btn" id="btn-do-resume">${t("resume")}</button>
        </div>
      `;
    }

    // 四大章节列表
    const chapters = [
      { id: 1, nameKey: "chapter1Name", descKey: "chapter1Desc", bonus: "初始法力: 220" },
      { id: 2, nameKey: "chapter2Name", descKey: "chapter2Desc", bonus: "初始法力: 550 · 随机遗物 ×2" },
      { id: 3, nameKey: "chapter3Name", descKey: "chapter3Desc", bonus: "初始法力: 950 · 随机遗物 ×4" },
      { id: 4, nameKey: "chapter4Name", descKey: "chapter4Desc", bonus: "初始法力: 1500 · 随机遗物 ×6" },
    ];

    for (const c of chapters) {
      const isUnlocked = c.id <= maxUnlocked;
      const isCompleted = saveData.bestWave >= c.id * 5;
      const statusLabel = isCompleted ? t("statusCompleted") : isUnlocked ? t("statusUnlocked") : t("statusLocked");
      const badgeClass = isCompleted ? "completed" : isUnlocked ? "unlocked" : "locked";

      html += `
        <div class="chapter-card ${badgeClass}">
          <div class="chapter-header-row">
            <span class="chapter-badge ${badgeClass}">${statusLabel}</span>
            <span class="chapter-bonus">${c.bonus}</span>
          </div>
          <h3>${t(c.nameKey)}</h3>
          <p>${t(c.descKey)}</p>
          ${
            isUnlocked
              ? `<button class="btn-select-chapter" data-chapter="${c.id}">${t("startChapterBtn")}</button>`
              : `<button class="btn-select-chapter disabled" disabled>${t("statusLocked")}</button>`
          }
        </div>
      `;
    }

    this.elements.chaptersContainer.innerHTML = html;

    // 绑定恢复存档
    const resumeBtn = document.getElementById("btn-do-resume");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => {
        this.game.resumeSavedRun();
        this.closeChaptersModal();
      });
    }

    // 绑定选章出征
    this.elements.chaptersContainer.querySelectorAll(".btn-select-chapter[data-chapter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ch = Number(btn.dataset.chapter);
        this.game.startChapter(ch);
        this.closeChaptersModal();
      });
    });
  }

  updateAllTexts() {
    const lang = getLanguage();
    document.title = `${t("gameTitle", lang)} - DOIN`;

    if (this.elements.labelBackHome) this.elements.labelBackHome.textContent = t("backHome", lang);
    if (this.elements.gameMainTitle) this.elements.gameMainTitle.textContent = t("gameTitle", lang);
    if (this.elements.gameSubTitle) this.elements.gameSubTitle.textContent = t("gameSubtitle", lang);
    if (this.elements.labelWave) this.elements.labelWave.textContent = t("waveLabel", lang);
    if (this.elements.labelMana) this.elements.labelMana.textContent = t("mana", lang);
    if (this.elements.labelScore) this.elements.labelScore.textContent = t("score", lang);
    if (this.elements.crystalLabel) this.elements.crystalLabel.textContent = t("crystalHp", lang);
    if (this.elements.scoutTitle) this.elements.scoutTitle.textContent = t("scoutTitle", lang);
    if (this.elements.activeRelicsTitle) this.elements.activeRelicsTitle.textContent = t("activeRelics", lang);
    if (this.elements.startWaveBtn) this.elements.startWaveBtn.textContent = t("startWave", lang);
    if (this.elements.rushWaveBtn) this.elements.rushWaveBtn.textContent = t("rushWave", lang);
    if (this.elements.speedBtn) this.elements.speedBtn.textContent = t("speedToggle", lang, { spd: this.game.speedMultiplier });
    if (this.elements.pauseTopBtn) this.elements.pauseTopBtn.textContent = t("pause", lang);
    if (this.elements.pauseInlineBtn) this.elements.pauseInlineBtn.textContent = `⏸ ${t("pause", lang)}`;
    if (this.elements.chapterMenuBtn) this.elements.chapterMenuBtn.textContent = t("chapterSelect", lang);
    if (this.elements.chaptersBtn) this.elements.chaptersBtn.textContent = `📜 ${t("chapterSelect", lang)}`;
    if (this.elements.hotkeyTip) this.elements.hotkeyTip.textContent = t("hotkeyTip", lang);
    if (this.elements.langBtn) this.elements.langBtn.textContent = t("toggleLang", lang);
    if (this.elements.audioBtn) this.elements.audioBtn.textContent = sound.enabled ? t("soundOn", lang) : t("soundOff", lang);

    // 暂停弹窗文本
    if (this.elements.pauseTitle) this.elements.pauseTitle.textContent = t("pauseTitle", lang);
    if (this.elements.pauseSubtitle) this.elements.pauseSubtitle.textContent = t("pauseSubtitle", lang);
    if (this.elements.resumeBtn) this.elements.resumeBtn.textContent = t("resume", lang);
    if (this.elements.pauseChaptersBtn) this.elements.pauseChaptersBtn.textContent = t("chapterSelect", lang);
    if (this.elements.pauseRestartBtn) this.elements.pauseRestartBtn.textContent = t("restartGame", lang);
    if (this.elements.pauseHomeBtn) this.elements.pauseHomeBtn.textContent = t("backHome", lang);

    // 选关弹窗文本
    if (this.elements.chaptersTitle) this.elements.chaptersTitle.textContent = t("chaptersTitle", lang);
    if (this.elements.chaptersSubtitle) this.elements.chaptersSubtitle.textContent = t("chaptersSubtitle", lang);

    if (this.elements.draftModalTitle) this.elements.draftModalTitle.textContent = t("altarTitle", lang);
    if (this.elements.draftModalSubtitle) this.elements.draftModalSubtitle.textContent = t("altarSubtitle", lang);
    if (this.elements.restartBtn) this.elements.restartBtn.textContent = t("restartGame", lang);
    if (this.elements.btnClosePedestal) this.elements.btnClosePedestal.setAttribute("aria-label", t("close", lang));
    if (this.elements.btnCloseChapters) this.elements.btnCloseChapters.setAttribute("aria-label", t("close", lang));
  }

  openPedestalPanel(pedestalId) {
    this.selectedPedestalId = pedestalId;
    this.renderPedestalPanel(pedestalId);
    this.elements.pedestalPanel.classList.remove("hidden");
  }

  closePedestalPanel() {
    this.selectedPedestalId = null;
    this.elements.pedestalPanel.classList.add("hidden");
  }

  renderPedestalPanel(pedestalId) {
    const state = this.game.getState();
    const tower = state.towers[pedestalId];
    const pedestal = PEDESTALS.find((p) => p.id === pedestalId);
    if (!pedestal) return;

    if (!tower) {
      // 空置基座：提供四系符文唤醒按钮
      this.elements.pedestalTitle.textContent = `${t("emptyPedestal")} (${pedestal.id})`;
      this.elements.pedestalBody.innerHTML = `
        <div class="rune-build-grid">
          <button class="btn-build-rune arcane" data-type="arcane">
            <div class="rune-icon-box arcane">✦</div>
            <div class="rune-info">
              <strong>${t("runeArcane")}</strong>
              <span class="rune-cost">${t("costToBuild", undefined, { cost: RUNES.arcane.cost })}</span>
            </div>
            <p>${t("runeArcaneDesc")}</p>
          </button>
          <button class="btn-build-rune flame" data-type="flame">
            <div class="rune-icon-box flame">🔥</div>
            <div class="rune-info">
              <strong>${t("runeFlame")}</strong>
              <span class="rune-cost">${t("costToBuild", undefined, { cost: RUNES.flame.cost })}</span>
            </div>
            <p>${t("runeFlameDesc")}</p>
          </button>
          <button class="btn-build-rune frost" data-type="frost">
            <div class="rune-icon-box frost">❄</div>
            <div class="rune-info">
              <strong>${t("runeFrost")}</strong>
              <span class="rune-cost">${t("costToBuild", undefined, { cost: RUNES.frost.cost })}</span>
            </div>
            <p>${t("runeFrostDesc")}</p>
          </button>
          <button class="btn-build-rune storm" data-type="storm">
            <div class="rune-icon-box storm">⚡</div>
            <div class="rune-info">
              <strong>${t("runeStorm")}</strong>
              <span class="rune-cost">${t("costToBuild", undefined, { cost: RUNES.storm.cost })}</span>
            </div>
            <p>${t("runeStormDesc")}</p>
          </button>
        </div>
      `;

      this.elements.pedestalBody.querySelectorAll(".btn-build-rune").forEach((btn) => {
        btn.addEventListener("click", () => {
          const type = btn.dataset.type;
          const res = this.game.buildTower(pedestalId, type);
          if (res.ok) {
            this.renderPedestalPanel(pedestalId);
          }
        });
      });
    } else {
      // 已建塔：显示属性、升级与分解
      const rune = RUNES[tower.type];
      const mult = TIER_MULTIPLIERS[tower.tier];
      const dmg = Math.round(rune.damage * mult.dmgMult);
      const rate = (rune.fireRate * mult.rateMult).toFixed(1);
      const range = Math.round(rune.range * mult.rangeMult);

      const nextTier = tower.tier + 1;
      const canUpgrade = nextTier <= 3;
      const upgradeCost = canUpgrade ? Math.round(rune.cost * TIER_MULTIPLIERS[nextTier].costMult * 0.9) : 0;
      const refund = Math.round(tower.totalInvested * 0.75);

      const typeKey = `rune${tower.type.charAt(0).toUpperCase() + tower.type.slice(1)}`;
      this.elements.pedestalTitle.textContent = `${t(typeKey)} (${t("tierLabel", undefined, { tier: tower.tier })})`;

      this.elements.pedestalBody.innerHTML = `
        <div class="tower-stats-box">
          <p>${t("towerStats", undefined, { dmg, rate, range })}</p>
          <p>${t("totalKills", undefined, { k: tower.kills })}</p>
        </div>
        <div class="pedestal-actions">
          ${
            canUpgrade
              ? `<button class="btn-action upgrade" id="btn-upgrade-tower">${t("upgradeCost", undefined, { cost: upgradeCost })}</button>`
              : `<button class="btn-action upgrade disabled" disabled>${t("maxTier")}</button>`
          }
          <button class="btn-action salvage" id="btn-salvage-tower">${t("salvageRefund", undefined, { refund })}</button>
        </div>
      `;

      const upBtn = document.getElementById("btn-upgrade-tower");
      if (upBtn) {
        upBtn.addEventListener("click", () => {
          const res = this.game.upgradeTower(pedestalId);
          if (res.ok) this.renderPedestalPanel(pedestalId);
        });
      }

      const salvBtn = document.getElementById("btn-salvage-tower");
      if (salvBtn) {
        salvBtn.addEventListener("click", () => {
          this.game.salvageTower(pedestalId);
          this.renderPedestalPanel(pedestalId);
        });
      }
    }
  }

  update(state) {
    // 顶部数值更新（不含前置标签）
    this.elements.waveText.textContent = `${state.wave} / ${state.maxWaves}`;
    this.elements.manaText.textContent = `${state.mana} ⬡`;
    this.elements.scoreText.textContent = String(state.score);

    // 水晶耐久百分比条
    const hpRatio = Math.max(0, state.crystalHp / state.maxCrystalHp);
    this.elements.crystalBar.style.width = `${Math.round(hpRatio * 100)}%`;
    this.elements.crystalText.textContent = `${state.crystalHp} / ${state.maxCrystalHp}`;
    if (hpRatio <= 0.3) {
      this.elements.crystalBar.className = "progress-fill danger";
    } else if (hpRatio <= 0.6) {
      this.elements.crystalBar.className = "progress-fill warning";
    } else {
      this.elements.crystalBar.className = "progress-fill healthy";
    }

    // 波次控制按钮状态
    if (state.status === "PREPARING") {
      this.elements.startWaveBtn.classList.remove("hidden");
      this.elements.rushWaveBtn.classList.add("hidden");
    } else if (state.status === "COMBAT") {
      this.elements.startWaveBtn.classList.add("hidden");
      this.elements.rushWaveBtn.classList.remove("hidden");
    } else {
      this.elements.startWaveBtn.classList.add("hidden");
      this.elements.rushWaveBtn.classList.add("hidden");
    }

    // 下波斥候怪群列表
    this.renderScoutForecast(state.wave);

    // 已获得流派遗物一览
    this.renderActiveRelics(state.activeRelics);

    // 神龛三选一弹窗
    if (state.status === "RELIC_DRAFT") {
      this.showRelicDraftModal(state);
    } else {
      this.elements.relicModal.classList.add("hidden");
    }

    // 终局弹窗
    if (state.status === "VICTORY" || state.status === "GAMEOVER") {
      this.showEndgameModal(state);
    }
  }

  renderScoutForecast(wave) {
    const comp = getWaveComposition(wave);
    let html = "";
    for (const group of comp) {
      let nameKey = `monster${group.type.charAt(0).toUpperCase() + group.type.slice(1)}`;
      let traitKey = "traitSwarm";
      let traitColor = "#38b000";

      if (group.type === "golem") {
        traitKey = "traitHeavy";
        traitColor = "#6c757d";
      } else if (group.type === "banshee") {
        traitKey = "traitFlyer";
        traitColor = "#c77dff";
      } else if (group.type === "beetle") {
        traitKey = "traitBoom";
        traitColor = "#ff7b00";
      } else if (group.type.startsWith("boss_wave_")) {
        nameKey = group.type === "boss_wave_5" ? "monsterBoss1" : group.type === "boss_wave_10" ? "monsterBoss2" : group.type === "boss_wave_15" ? "monsterBoss3" : "monsterBoss4";
        traitKey = "traitBoss";
        traitColor = "#ff0054";
      }

      html += `
        <div class="scout-item">
          <span class="scout-count">×${group.count}</span>
          <span class="scout-name">${t(nameKey)}</span>
          <span class="scout-trait-badge" style="background: ${traitColor}22; color: ${traitColor}; border: 1px solid ${traitColor}55;">${t(traitKey)}</span>
        </div>
      `;
    }
    this.elements.scoutList.innerHTML = html;
  }

  renderActiveRelics(activeRelics) {
    if (!activeRelics || activeRelics.length === 0) {
      this.elements.relicsShelf.innerHTML = `<div class="empty-hint">${t("noRelicsYet")}</div>`;
      return;
    }
    let html = "";
    for (const relicId of activeRelics) {
      const nameKey = `${relicId}_name`;
      const descKey = `${relicId}_desc`;
      html += `
        <div class="relic-badge" title="${t(descKey)}">
          <span class="badge-gem">◆</span>
          <span class="badge-name">${t(nameKey)}</span>
        </div>
      `;
    }
    this.elements.relicsShelf.innerHTML = html;
  }

  showRelicDraftModal(state) {
    this.elements.relicModal.classList.remove("hidden");
    this.elements.relicRerollBtn.textContent = t("rerollsLeft", undefined, { n: state.rerollsLeft });
    this.elements.relicRerollBtn.disabled = state.rerollsLeft <= 0;

    let html = "";
    for (const relicId of state.draftOptions) {
      const nameKey = `${relicId}_name`;
      const descKey = `${relicId}_desc`;
      html += `
        <div class="relic-card" data-id="${relicId}">
          <div class="relic-card-glow"></div>
          <div class="relic-gem-icon">⬡</div>
          <h3>${t(nameKey)}</h3>
          <p>${t(descKey)}</p>
          <button class="btn-pick-relic">${t("confirmChoice")}</button>
        </div>
      `;
    }
    this.elements.relicOptions.innerHTML = html;

    this.elements.relicOptions.querySelectorAll(".relic-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        this.game.draftRelic(id);
      });
    });
  }

  showEndgameModal(state) {
    this.elements.endModal.classList.remove("hidden");
    const won = state.status === "VICTORY";
    this.elements.endTitle.textContent = won ? t("victoryTitle") : t("defeatTitle");
    this.elements.endSubtitle.textContent = won ? t("victorySubtitle") : t("defeatSubtitle");

    const timeMin = Math.floor(state.elapsedSeconds / 60);
    const timeSec = Math.floor(state.elapsedSeconds % 60);
    const timeStr = `${timeMin}m ${timeSec}s`;

    this.elements.endStats.innerHTML = `
      <div class="stat-row"><span>${t("waveLabel")}</span><strong>${state.wave} / 20</strong></div>
      <div class="stat-row"><span>${t("score")}</span><strong>${state.score}</strong></div>
      <div class="stat-row"><span>${t("totalKills", undefined, { k: state.kills })}</span></div>
      <div class="stat-row"><span>${t("relicsCount")}</span><strong>${state.activeRelics.length}</strong></div>
      <div class="stat-row"><span>${t("playTime", undefined, { t: timeStr })}</span></div>
    `;
  }
}
