/**
 * 数字华容道 UI 渲染与交互管理
 * 负责 DOM 节点更新、补间动效与事件绑定
 */
import { formatTime } from "./score.mjs";
import { t } from "./i18n.mjs";

export class GameUI {
  constructor(controller, options = {}) {
    this.controller = controller;
    this.locale = options.locale || "zh";
    this.soundEnabled = options.soundEnabled ?? true;

    // 缓存 DOM 节点
    this.boardEl = document.getElementById("puzzle-board");
    this.valMoves = document.getElementById("val-moves");
    this.valTime = document.getElementById("val-time");
    this.valTps = document.getElementById("val-tps");
    this.mhudMovesVal = document.getElementById("mhud-moves-val");
    this.mhudTimeVal = document.getElementById("mhud-time-val");
    this.mhudTpsVal = document.getElementById("mhud-tps-val");

    this.valBestTime = document.getElementById("val-best-time");
    this.valBestMoves = document.getElementById("val-best-moves");
    this.btnUndo = document.getElementById("btn-undo");

    this.modalWin = document.getElementById("modal-win");
    this.winTitle = document.getElementById("win-title");
    this.winDesc = document.getElementById("win-desc");
    this.winStars = document.getElementById("win-stars");
    this.winRankBadge = document.getElementById("win-rank-badge");

    this.btnSound = document.getElementById("btn-sound");
    this.btnLang = document.getElementById("btn-lang");
    this.btnHelp = document.getElementById("btn-help");
    this.modalHelp = document.getElementById("modal-help");

    // 存储瓦片 DOM 映射: Map<value, HTMLElement>
    this.tileElements = new Map();

    this.initBoardDOM();
    this.bindTouchGestures();
  }

  setLocale(locale) {
    this.locale = locale;
    this.updateStaticTexts();
  }

  updateStaticTexts() {
    document.title = t("appTitle", this.locale);
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = t("subtitle", this.locale);

    const titleEl = document.getElementById("stage-title");
    if (titleEl) titleEl.textContent = t("title", this.locale);

    const backHomeEl = document.getElementById("back-home");
    if (backHomeEl) backHomeEl.textContent = t("backHome", this.locale);

    const btnSoundEl = document.getElementById("btn-sound");
    if (btnSoundEl) btnSoundEl.setAttribute("aria-label", t("soundLabel", this.locale));

    const btnHelpEl = document.getElementById("btn-help");
    if (btnHelpEl) btnHelpEl.setAttribute("aria-label", t("helpLabel", this.locale));

    // 模式与规格
    const labelModes = document.getElementById("label-modes-title");
    if (labelModes) labelModes.textContent = t("modeSpeedrun", this.locale);

    const btnModeSpeedrun = document.getElementById("btn-mode-speedrun");
    if (btnModeSpeedrun) btnModeSpeedrun.textContent = t("modeSpeedrun", this.locale);

    const btnModeLadder = document.getElementById("btn-mode-ladder");
    if (btnModeLadder) btnModeLadder.textContent = t("modeLadder", this.locale);

    const btnModeDaily = document.getElementById("btn-mode-daily");
    if (btnModeDaily) btnModeDaily.textContent = t("modeDaily", this.locale);

    const labelSizes = document.getElementById("label-sizes-title");
    if (labelSizes) labelSizes.textContent = t("size4", this.locale);

    const btnSize3 = document.getElementById("btn-size-3");
    if (btnSize3) btnSize3.textContent = t("size3", this.locale);
    const btnSize4 = document.getElementById("btn-size-4");
    if (btnSize4) btnSize4.textContent = t("size4", this.locale);
    const btnSize5 = document.getElementById("btn-size-5");
    if (btnSize5) btnSize5.textContent = t("size5", this.locale);

    // 仪表
    const lblBestTime = document.getElementById("lbl-best-time");
    if (lblBestTime) lblBestTime.textContent = t("bestTime", this.locale);
    const lblBestMoves = document.getElementById("lbl-best-moves");
    if (lblBestMoves) lblBestMoves.textContent = t("bestMoves", this.locale);

    const meterMoves = document.getElementById("meter-title-moves");
    if (meterMoves) meterMoves.textContent = t("moves", this.locale);
    const meterTime = document.getElementById("meter-title-time");
    if (meterTime) meterTime.textContent = t("time", this.locale);
    const meterTps = document.getElementById("meter-title-tps");
    if (meterTps) meterTps.textContent = t("tps", this.locale);

    const btnUndoEl = document.getElementById("btn-undo");
    if (btnUndoEl) btnUndoEl.textContent = t("btnUndo", this.locale);
    const btnResetEl = document.getElementById("btn-reset");
    if (btnResetEl) btnResetEl.textContent = t("btnReset", this.locale);
    const btnNewEl = document.getElementById("btn-new");
    if (btnNewEl) btnNewEl.textContent = t("btnNew", this.locale);

    // 弹窗
    const helpTitle = document.getElementById("help-title");
    if (helpTitle) helpTitle.textContent = t("helpTitle", this.locale);
    const rule1 = document.getElementById("help-rule-1");
    if (rule1) rule1.textContent = t("helpRule1", this.locale);
    const rule2 = document.getElementById("help-rule-2");
    if (rule2) rule2.textContent = t("helpRule2", this.locale);
    const rule3 = document.getElementById("help-rule-3");
    if (rule3) rule3.textContent = t("helpRule3", this.locale);
    const rule4 = document.getElementById("help-rule-4");
    if (rule4) rule4.textContent = t("helpRule4", this.locale);

    const keymodeLbl = document.getElementById("keymode-label");
    if (keymodeLbl) keymodeLbl.textContent = t("keyModeTitle", this.locale);
    const optPush = document.getElementById("opt-keymode-push");
    if (optPush) optPush.textContent = t("keyModePush", this.locale);
    const optBlank = document.getElementById("opt-keymode-blank");
    if (optBlank) optBlank.textContent = t("keyModeBlank", this.locale);

    const btnCloseHelp = document.getElementById("btn-close-help");
    if (btnCloseHelp) btnCloseHelp.textContent = this.locale === "zh" ? "知道了" : "Got it";

    const btnPlayAgain = document.getElementById("btn-play-again");
    if (btnPlayAgain) btnPlayAgain.textContent = t("btnPlayAgain", this.locale);
    const btnNextStage = document.getElementById("btn-next-stage");
    if (btnNextStage) btnNextStage.textContent = t("btnNextStage", this.locale);
  }

  initBoardDOM() {
    const size = this.controller.size;
    this.boardEl.className = `board-grid size-${size}`;
    this.boardEl.innerHTML = "";
    this.tileElements.clear();

    const total = size * size;
    const gapRatio = 0.02; // 间距
    const tileSizePercent = (1 - gapRatio * (size + 1)) / size;

    for (let val = 1; val < total; val++) {
      const tile = document.createElement("div");
      tile.className = "puzzle-tile";
      tile.textContent = String(val);
      tile.dataset.val = String(val);

      tile.style.width = `${tileSizePercent * 100}%`;
      tile.style.height = `${tileSizePercent * 100}%`;

      tile.addEventListener("click", () => {
        const currentPos = this.getTilePosition(val);
        if (currentPos) {
          this.controller.makeMove(currentPos.row, currentPos.col);
        }
      });

      this.boardEl.appendChild(tile);
      this.tileElements.set(val, tile);
    }

    this.renderBoard();
  }

  getTilePosition(val) {
    const idx = this.controller.board.indexOf(val);
    if (idx === -1) return null;
    const size = this.controller.size;
    return {
      row: Math.floor(idx / size),
      col: idx % size,
      index: idx,
    };
  }

  renderBoard() {
    const size = this.controller.size;
    const board = this.controller.board;
    const gapRatio = 0.02;
    const tileSizePercent = (1 - gapRatio * (size + 1)) / size;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const val = board[r * size + c];
        if (val === 0) continue; // 空格

        const tileEl = this.tileElements.get(val);
        if (!tileEl) continue;

        const leftPercent = (gapRatio + c * (tileSizePercent + gapRatio)) * 100;
        const topPercent = (gapRatio + r * (tileSizePercent + gapRatio)) * 100;

        tileEl.style.left = `${leftPercent}%`;
        tileEl.style.top = `${topPercent}%`;

        // 判定是否归位：若当前行与列位置与其期望目标相符
        const targetIndex = val - 1;
        const isHome = r * size + c === targetIndex;
        tileEl.classList.toggle("is-home", isHome);
      }
    }
  }

  updateMeters(snapshot) {
    const movesStr = String(snapshot.moves);
    const timeStr = formatTime(snapshot.elapsedSeconds);
    const tpsStr = snapshot.tps.toFixed(1);

    if (this.valMoves) this.valMoves.textContent = movesStr;
    if (this.valTime) this.valTime.textContent = timeStr;
    if (this.valTps) this.valTps.textContent = tpsStr;

    if (this.mhudMovesVal) this.mhudMovesVal.textContent = movesStr;
    if (this.mhudTimeVal) this.mhudTimeVal.textContent = timeStr;
    if (this.mhudTpsVal) this.mhudTpsVal.textContent = tpsStr;

    if (this.btnUndo) {
      this.btnUndo.disabled = !snapshot.canUndo;
    }
  }

  updateBestRecords(bestTimes, bestMoves) {
    const size = this.controller.size;
    const bt = bestTimes[size];
    const bm = bestMoves[size];

    if (this.valBestTime) {
      this.valBestTime.textContent = bt ? formatTime(bt) : "--:--.-";
    }
    if (this.valBestMoves) {
      this.valBestMoves.textContent = bm ? String(bm) : "--";
    }
  }

  showVictoryModal(details) {
    if (!this.modalWin) return;

    if (this.winTitle) this.winTitle.textContent = t("winTitle", this.locale);
    if (this.winDesc) {
      this.winDesc.textContent = t("winDesc", this.locale, {
        time: formatTime(details.time),
        moves: details.moves,
        tps: details.tps.toFixed(1),
      });
    }

    if (this.winStars) {
      const s = details.stars || 1;
      this.winStars.textContent = "★".repeat(s) + "☆".repeat(3 - s);
    }

    if (this.winRankBadge) {
      const rankKey = `rank${details.rank.charAt(0).toUpperCase() + details.rank.slice(1)}`;
      this.winRankBadge.textContent = t(rankKey, this.locale);
    }

    const nextBtn = document.getElementById("btn-next-stage");
    if (nextBtn) {
      nextBtn.style.display = details.mode === "ladder" ? "inline-block" : "none";
    }

    if (typeof this.modalWin.showModal === "function") {
      this.modalWin.showModal();
    }
  }

  hideVictoryModal() {
    if (this.modalWin && typeof this.modalWin.close === "function") {
      this.modalWin.close();
    }
  }

  bindTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    const minThreshold = 24;

    this.boardEl.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    this.boardEl.addEventListener(
      "touchend",
      (e) => {
        if (e.changedTouches.length === 1) {
          const deltaX = e.changedTouches[0].clientX - touchStartX;
          const deltaY = e.changedTouches[0].clientY - touchStartY;

          if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minThreshold) {
            this.controller.makeDirectionMove(deltaX > 0 ? "right" : "left");
          } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > minThreshold) {
            this.controller.makeDirectionMove(deltaY > 0 ? "down" : "up");
          }
        }
      },
      { passive: true }
    );
  }
}
