// 割绳子 UI 控制器（唯一操作 DOM 的层，管理 HUD 翼栏、抽屉与结算模态框）
import { CHAPTERS, LEVELS, getLevelById, getChapterByLevelId } from "./levels.mjs";
import { getTotalStars, getChapterStats, isLevelUnlocked } from "./score.mjs";
import { loadSaveData } from "./storage.mjs";
import { getLang, setLang, t } from "./i18n.mjs";
import { sound } from "./audio.mjs";

export class UIController {
  constructor(game) {
    this.game = game;
    this.saveData = loadSaveData();
    this.lang = getLang();
    this.activeChapterId = 1;

    this.dom = {
      appTitle: document.getElementById("app-title-main"),
      appSubtitle: document.getElementById("app-subtitle"),
      backHome: document.getElementById("back-home"),
      backText: document.getElementById("back-text"),
      btnSound: document.getElementById("btn-sound"),
      btnLang: document.getElementById("btn-lang"),
      btnHelp: document.getElementById("btn-help"),
      btnRestart: document.getElementById("btn-restart"),
      btnLevels: document.getElementById("btn-levels"),
      tabOdyssey: document.getElementById("tab-odyssey"),
      tabMaster: document.getElementById("tab-master"),
      valChapter: document.getElementById("val-chapter"),
      valLevel: document.getElementById("val-level"),
      valStars: document.getElementById("val-stars"),
      valTotalStars: document.getElementById("val-total-stars"),
      valCuts: document.getElementById("val-cuts"),
      labelCuts: document.getElementById("label-cuts"),
      valHint: document.getElementById("val-hint"),
      modalLevels: document.getElementById("modal-levels"),
      levelsGrid: document.getElementById("levels-grid"),
      chapterNav: document.getElementById("chapter-nav"),
      btnCloseLevels: document.getElementById("btn-close-levels"),
      modalWin: document.getElementById("modal-win"),
      winTitle: document.getElementById("win-title"),
      winSub: document.getElementById("win-sub"),
      winStars: document.getElementById("win-stars"),
      btnWinNext: document.getElementById("btn-win-next"),
      btnWinReplay: document.getElementById("btn-win-replay"),
      modalHelp: document.getElementById("modal-help"),
      btnCloseHelp: document.getElementById("btn-close-help"),
      toast: document.getElementById("toast"),
      failOverlay: document.getElementById("fail-overlay"),
      failTitle: document.getElementById("fail-title"),
      failMsg: document.getElementById("fail-msg"),
      btnFailRetry: document.getElementById("btn-fail-retry"),
      failHint: document.getElementById("fail-hint"),
      labelChapter: document.getElementById("label-chapter"),
      labelLevel: document.getElementById("label-level"),
      labelStars: document.getElementById("label-stars"),
      labelTotalStars: document.getElementById("label-total-stars"),
      labelHint: document.getElementById("label-hint"),
      labelShortcuts: document.getElementById("label-shortcuts"),
      valShortcuts: document.getElementById("val-shortcuts"),
      modalLevelsTitle: document.getElementById("modal-levels-title"),
      arena: document.getElementById("arena"),
      canvas: document.getElementById("stage-canvas")
    };
  }

  init() {
    this.bindEvents();
    this.applyI18n();
    this.updateSoundBtn();
    this.updateHUD(this.game.state);
  }

  bindEvents() {
    // 声音开关
    this.dom.btnSound.addEventListener("click", () => {
      this.saveData.soundEnabled = !this.saveData.soundEnabled;
      sound.setEnabled(this.saveData.soundEnabled);
      this.updateSoundBtn();
    });

    // 语言切换
    this.dom.btnLang.addEventListener("click", () => {
      this.lang = setLang(this.lang === "zh" ? "en" : "zh");
      this.applyI18n();
      this.updateHUD(this.game.state);
      this.renderLevelSelectGrid();
    });

    // 帮助说明弹窗
    this.dom.btnHelp.addEventListener("click", () => this.openHelp());
    this.dom.btnCloseHelp.addEventListener("click", () => this.closeHelp());

    // 选关抽屉
    this.dom.btnLevels.addEventListener("click", () => this.openLevels());
    this.dom.btnCloseLevels.addEventListener("click", () => this.closeLevels());

    // 重玩当前关
    this.dom.btnRestart.addEventListener("click", () => {
      this.game.resetLevel();
    });

    // 模式选择
    this.dom.tabOdyssey.addEventListener("click", () => {
      this.dom.tabOdyssey.classList.add("is-active");
      this.dom.tabMaster.classList.remove("is-active");
      this.activeChapterId = 1;
      this.game.initLevel(1);
    });

    this.dom.tabMaster.addEventListener("click", () => {
      this.dom.tabMaster.classList.add("is-active");
      this.dom.tabOdyssey.classList.remove("is-active");
      this.activeChapterId = 5;
      this.game.initLevel(33);
    });

    // 胜利结算按钮
    this.dom.btnWinReplay.addEventListener("click", () => {
      this.closeWinModal();
      this.game.resetLevel();
    });

    this.dom.btnWinNext.addEventListener("click", () => {
      this.closeWinModal();
      const nextId = this.game.currentLevelId + 1;
      if (nextId <= 40) {
        this.game.initLevel(nextId);
      } else {
        this.openLevels();
      }
    });

    // 失败重试按钮与失败浮层点击立即重玩
    if (this.dom.btnFailRetry) {
      this.dom.btnFailRetry.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideFail();
        this.game.resetLevel();
      });
    }

    if (this.dom.failOverlay) {
      this.dom.failOverlay.addEventListener("click", () => {
        this.hideFail();
        this.game.resetLevel();
      });
    }

    // 键盘快捷键
    window.addEventListener("keydown", (e) => {
      if (e.key === "r" || e.key === "R") {
        this.game.resetLevel();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (this.dom.modalLevels.classList.contains("is-open")) {
          this.closeLevels();
        } else if (!this.dom.modalWin.classList.contains("is-open")) {
          this.openLevels();
        }
      } else if (e.key === "Escape") {
        this.closeHelp();
        this.closeLevels();
        this.closeWinModal();
      }
    });
  }

  applyI18n() {
    document.documentElement.lang = this.lang === "zh" ? "zh-CN" : "en";
    const l = this.lang;

    document.title = t("docTitle", l);
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", t("metaDesc", l));

    this.dom.appTitle.textContent = t("gameTitle", l);
    this.dom.appSubtitle.textContent = t("subtitle", l);
    this.dom.backHome.title = t("backHome", l);
    this.dom.backText.textContent = t("backHome", l);
    this.dom.btnSound.title = t("soundTitle", l);
    this.dom.btnLang.title = t("langTitle", l);
    this.dom.btnLang.textContent = t("langSwitch", l);
    this.dom.btnLevels.title = t("levelsTitle", l);
    this.dom.btnRestart.title = t("restartTitle", l);
    this.dom.btnHelp.title = t("helpModalTitle", l);

    this.dom.tabOdyssey.textContent = t("modeOdyssey", l);
    this.dom.tabMaster.textContent = t("modeMaster", l);

    // 翼栏各板块标题
    if (this.dom.labelChapter) this.dom.labelChapter.textContent = t("labelChapter", l);
    if (this.dom.labelLevel) this.dom.labelLevel.textContent = t("labelLevel", l);
    if (this.dom.labelStars) this.dom.labelStars.textContent = t("labelStars", l);
    if (this.dom.labelTotalStars) this.dom.labelTotalStars.textContent = t("labelTotalStars", l);
    if (this.dom.labelCuts) this.dom.labelCuts.textContent = t("labelCuts", l);
    if (this.dom.labelHint) this.dom.labelHint.textContent = t("labelHint", l);
    if (this.dom.labelShortcuts) this.dom.labelShortcuts.textContent = t("labelShortcuts", l);
    if (this.dom.valShortcuts) this.dom.valShortcuts.innerHTML = t("valShortcuts", l);

    // 舞台 aria
    if (this.dom.arena) this.dom.arena.setAttribute("aria-label", t("arenaAria", l));
    if (this.dom.canvas) this.dom.canvas.setAttribute("aria-label", t("canvasAria", l));

    // 选关抽屉
    if (this.dom.modalLevelsTitle) this.dom.modalLevelsTitle.textContent = t("modalLevelsTitle", l);
    if (this.dom.btnCloseLevels) this.dom.btnCloseLevels.textContent = t("closeLevels", l);

    // 动态规则说明文案
    const ruleTitle = document.getElementById("rule-title");
    if (ruleTitle) ruleTitle.textContent = t("rulesTitle", l);
    const r1 = document.getElementById("rule-1");
    if (r1) r1.textContent = t("rule1", l);
    const r2 = document.getElementById("rule-2");
    if (r2) r2.textContent = t("rule2", l);
    const r3 = document.getElementById("rule-3");
    if (r3) r3.textContent = t("rule3", l);
    const r4 = document.getElementById("rule-4");
    if (r4) r4.textContent = t("rule4", l);
    const r5 = document.getElementById("rule-5");
    if (r5) r5.textContent = t("rule5", l);
    const rShortcuts = document.getElementById("rule-shortcuts");
    if (rShortcuts) rShortcuts.textContent = t("ruleShortcut", l);
    if (this.dom.btnCloseHelp) this.dom.btnCloseHelp.textContent = t("close", l);

    // 胜利弹窗文案
    if (this.dom.winTitle) this.dom.winTitle.textContent = t("victoryTitle", l);
    if (this.dom.winSub) this.dom.winSub.textContent = t("victorySub", l);
    if (this.dom.btnWinNext) this.dom.btnWinNext.textContent = t("nextLevel", l);
    if (this.dom.btnWinReplay) this.dom.btnWinReplay.textContent = t("replay", l);

    // 失败浮层文案
    if (this.dom.failTitle) this.dom.failTitle.textContent = t("failTitle", l);
    if (this.dom.btnFailRetry) this.dom.btnFailRetry.textContent = t("failRetry", l);
    if (this.dom.failHint) this.dom.failHint.textContent = t("failHint", l);
  }

  updateSoundBtn() {
    const on = this.saveData.soundEnabled;
    this.dom.btnSound.setAttribute("aria-pressed", on ? "true" : "false");
    this.dom.btnSound.querySelector(".bar-glyph").textContent = on ? "🔊" : "🔇";
  }

  updateHUD(state) {
    if (!state) return;
    this.saveData = loadSaveData();
    const l = this.lang;
    const levelDef = getLevelById(state.levelId);
    const chapter = getChapterByLevelId(state.levelId);

    // 章节与关卡
    const chName = l === "zh" ? chapter.name : chapter.nameEn;
    this.dom.valChapter.textContent = chName;
    const lvlName = l === "zh" ? levelDef.name : levelDef.nameEn;
    this.dom.valLevel.textContent = `#${state.levelId} ${lvlName}`;

    // 关卡内 3 颗星显示
    let starsHtml = "";
    for (let i = 0; i < 3; i++) {
      const active = i < state.starsCollected;
      starsHtml += `<span class="star-icon ${active ? "is-collected" : "is-empty"}" aria-hidden="true">★</span>`;
    }
    this.dom.valStars.innerHTML = starsHtml;

    // 总星数
    const totalStars = getTotalStars(this.saveData.levels);
    this.dom.valTotalStars.textContent = `★ ${totalStars}/120`;

    // 提示
    this.dom.valHint.textContent = l === "zh" ? levelDef.hintZh : levelDef.hintEn;

    // 刀数限制
    if (state.cutsAllowed !== null) {
      this.dom.labelCuts.textContent = t("cutsRemaining", l);
      this.dom.valCuts.textContent = `${state.cutsRemaining} / ${state.cutsAllowed}`;
      this.dom.valCuts.className = state.cutsRemaining > 0 ? "plaque-value text-amber" : "plaque-value text-red";
    } else {
      this.dom.labelCuts.textContent = t("cutsRemaining", l);
      this.dom.valCuts.textContent = "∞";
      this.dom.valCuts.className = "plaque-value";
    }

    // 模式按钮状态
    if (state.levelId >= 33) {
      this.dom.tabMaster.classList.add("is-active");
      this.dom.tabOdyssey.classList.remove("is-active");
    } else {
      this.dom.tabOdyssey.classList.add("is-active");
      this.dom.tabMaster.classList.remove("is-active");
    }
  }

  openHelp() {
    this.dom.modalHelp.classList.add("is-open");
    this.dom.btnCloseHelp.focus();
  }

  closeHelp() {
    this.dom.modalHelp.classList.remove("is-open");
  }

  openLevels() {
    this.renderLevelSelectGrid();
    this.dom.modalLevels.classList.add("is-open");
  }

  closeLevels() {
    this.dom.modalLevels.classList.remove("is-open");
  }

  renderLevelSelectGrid() {
    this.saveData = loadSaveData();
    const l = this.lang;

    // 章节选择标签
    let chNavHtml = "";
    for (const ch of CHAPTERS) {
      const active = ch.id === this.activeChapterId ? "is-active" : "";
      const name = l === "zh" ? ch.name : ch.nameEn;
      chNavHtml += `<button class="ch-chip ${active}" data-ch="${ch.id}">${name}</button>`;
    }
    this.dom.chapterNav.innerHTML = chNavHtml;

    this.dom.chapterNav.querySelectorAll(".ch-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.activeChapterId = parseInt(btn.getAttribute("data-ch"), 10);
        this.renderLevelSelectGrid();
      });
    });

    // 渲染当前章节所有关卡卡片
    const currentChapter = CHAPTERS.find((ch) => ch.id === this.activeChapterId) || CHAPTERS[0];
    const [start, end] = currentChapter.range;

    let gridHtml = "";
    for (let id = start; id <= end; id++) {
      const def = getLevelById(id);
      const unlocked = isLevelUnlocked(id, this.saveData.levels);
      const data = this.saveData.levels[id] || { stars: 0 };
      const current = id === this.game.currentLevelId ? "is-current" : "";
      const statusClass = unlocked ? "is-unlocked" : "is-locked";

      let starsBar = "";
      for (let s = 1; s <= 3; s++) {
        const fill = s <= data.stars ? "is-lit" : "";
        starsBar += `<span class="card-star ${fill}">★</span>`;
      }

      const name = l === "zh" ? def.name : def.nameEn;

      gridHtml += `
        <button class="level-card ${statusClass} ${current}" data-id="${id}" ${unlocked ? "" : "disabled"}>
          <div class="card-num">${id}</div>
          <div class="card-name">${name}</div>
          <div class="card-stars">${starsBar}</div>
        </button>
      `;
    }
    this.dom.levelsGrid.innerHTML = gridHtml;

    this.dom.levelsGrid.querySelectorAll(".level-card.is-unlocked").forEach((card) => {
      card.addEventListener("click", () => {
        const id = parseInt(card.getAttribute("data-id"), 10);
        this.closeLevels();
        this.game.initLevel(id);
      });
    });
  }

  showWinModal(levelId, stars) {
    this.saveData = loadSaveData();
    let starsHtml = "";
    for (let i = 1; i <= 3; i++) {
      const earned = i <= stars;
      starsHtml += `<span class="win-star ${earned ? "is-earned" : "is-missed"}">★</span>`;
    }
    this.dom.winStars.innerHTML = starsHtml;

    this.dom.modalWin.classList.add("is-open");
    this.dom.btnWinNext.focus();
    this.updateHUD(this.game.state);
  }

  closeWinModal() {
    this.dom.modalWin.classList.remove("is-open");
  }

  showFail(reason) {
    const l = this.lang;
    let msg = t("failGeneric", l);
    if (reason === "spiked") {
      msg = t("failSpike", l);
    } else if (reason === "out_of_bounds") {
      msg = t("failOutOfBounds", l);
    } else if (reason === "timeout") {
      msg = t("failTimeout", l);
    }

    if (this.dom.failTitle) this.dom.failTitle.textContent = t("failTitle", l);
    if (this.dom.failMsg) this.dom.failMsg.textContent = msg;
    if (this.dom.btnFailRetry) this.dom.btnFailRetry.textContent = t("failRetry", l);
    if (this.dom.failHint) this.dom.failHint.textContent = t("failHint", l);

    if (this.dom.failOverlay) {
      this.dom.failOverlay.classList.add("is-open");
      this.dom.failOverlay.setAttribute("aria-hidden", "false");
    }

    // 同时弹出简明 toast
    if (this.dom.toast) {
      this.dom.toast.textContent = msg;
      this.dom.toast.classList.add("is-show");
      setTimeout(() => {
        if (this.dom.toast) this.dom.toast.classList.remove("is-show");
      }, 1800);
    }
  }

  hideFail() {
    if (this.dom.failOverlay) {
      this.dom.failOverlay.classList.remove("is-open");
      this.dom.failOverlay.setAttribute("aria-hidden", "true");
    }
    if (this.dom.toast) {
      this.dom.toast.classList.remove("is-show");
    }
  }
}
