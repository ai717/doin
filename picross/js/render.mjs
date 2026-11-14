/**
 * Picross UI & Render Module
 * Handles DOM rendering, grid interactions, visual effects, and modals.
 */

import { CELL_EMPTY, CELL_PAINT, CELL_CROSS } from "./engine.mjs";
import { LEVELS, CHAPTERS, getLevelsByChapter } from "./levels.mjs";
import { getAllCompletedLevels } from "./storage.mjs";
import { t, getLanguage } from "./i18n.mjs";

export class UIRenderer {
  constructor(game, audio) {
    this.game = game;
    this.audio = audio;
    this.isDragging = false;
    this.dragVal = null;
    this.dragStartCell = null;
    this.draggedCells = new Set();
    this.activeModal = null;

    this.cacheDOMElements();
  }

  cacheDOMElements() {
    this.boardContainer = document.getElementById("picross-board");
    this.colCluesEl = document.getElementById("col-clues");
    this.rowCluesEl = document.getElementById("row-clues");
    this.gridCellsEl = document.getElementById("grid-cells");

    this.levelTitleEl = document.getElementById("level-title");
    this.chapterTitleEl = document.getElementById("chapter-title");
    this.mistakesEl = document.getElementById("stat-mistakes");
    this.timerEl = document.getElementById("stat-timer");

    this.btnPaint = document.getElementById("tool-paint");
    this.btnCross = document.getElementById("tool-cross");
    this.btnUndo = document.getElementById("btn-undo");
    this.btnHint = document.getElementById("btn-hint");
    this.btnRestart = document.getElementById("btn-restart");

    this.btnPrev = document.getElementById("btn-prev");
    this.btnNext = document.getElementById("btn-next");

    // Left wing stamp preview
    this.wingStampsEl = document.getElementById("wing-stamps");
    this.wingChapterBadgesEl = document.getElementById("wing-chapter-badges");

    // Modals
    this.modalWin = document.getElementById("modal-win");
    this.modalAlbum = document.getElementById("modal-album");
    this.modalLevels = document.getElementById("modal-levels");
    this.modalCustom = document.getElementById("modal-custom");
    this.modalHelp = document.getElementById("modal-help");
  }

  updateCellSize() {
    if (!this.boardContainer || !this.game.activeLevel) return;
    const { rows, cols } = this.game.activeLevel;
    const maxDim = Math.max(rows, cols);

    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    const isSmallMobile = typeof window !== "undefined" && window.innerWidth <= 480;

    let availableWidth;
    if (isSmallMobile) {
      availableWidth = Math.min(window.innerWidth - 50, 360);
    } else if (isMobile) {
      availableWidth = Math.min(window.innerWidth - 80, 500);
    } else {
      availableWidth = 580;
    }

    const clueMargin = isMobile
      ? Math.min(65, Math.max(34, maxDim * 4.2))
      : Math.min(110, Math.max(54, maxDim * 6.2));
    const netGridWidth = availableWidth - clueMargin;

    let cellSize = Math.floor(netGridWidth / maxDim);

    if (isSmallMobile) {
      cellSize = Math.max(18, Math.min(58, cellSize));
    } else if (isMobile) {
      cellSize = Math.max(20, Math.min(66, cellSize));
    } else {
      cellSize = Math.max(28, Math.min(76, cellSize));
    }

    this.boardContainer.style.setProperty("--cell-size", `${cellSize}px`);
  }

  renderBoard() {
    const level = this.game.activeLevel;
    const state = this.game.state;
    if (!level || !state) return;

    this.updateCellSize();

    const { rows, cols, rowClues, colClues } = level;

    // Update level headers
    if (this.levelTitleEl) {
      const title = t(level.titleKey);
      this.levelTitleEl.textContent = `${title} (${cols}×${rows})`;
    }
    if (this.chapterTitleEl) {
      this.chapterTitleEl.textContent = t(level.chapterKey);
    }

    // Set grid css template
    if (this.colCluesEl) {
      this.colCluesEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      this.colCluesEl.innerHTML = "";
      colClues.forEach((clue, c) => {
        const colEl = document.createElement("div");
        colEl.className = "col-clue";
        if (c % 5 === 4 && c < cols - 1) colEl.classList.add("subgrid-border-col");
        if (clue.length === 0) {
          colEl.innerHTML = `<span class="clue-num clue-zero">0</span>`;
        } else {
          colEl.innerHTML = clue.map((n) => `<span class="clue-num">${n}</span>`).join("");
        }
        this.colCluesEl.appendChild(colEl);
      });
    }

    if (this.rowCluesEl) {
      this.rowCluesEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      this.rowCluesEl.innerHTML = "";
      rowClues.forEach((clue, r) => {
        const rowEl = document.createElement("div");
        rowEl.className = "row-clue";
        if (r % 5 === 4 && r < rows - 1) rowEl.classList.add("subgrid-border-row");
        if (clue.length === 0) {
          rowEl.innerHTML = `<span class="clue-num clue-zero">0</span>`;
        } else {
          rowEl.innerHTML = clue.map((n) => `<span class="clue-num">${n}</span>`).join("");
        }
        this.rowCluesEl.appendChild(rowEl);
      });
    }

    if (this.gridCellsEl) {
      this.gridCellsEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      this.gridCellsEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      this.gridCellsEl.innerHTML = "";

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "picross-cell";
          btn.dataset.row = String(r);
          btn.dataset.col = String(c);
          btn.setAttribute("aria-label", `Cell ${r + 1}, ${c + 1}`);

          if (c % 5 === 4 && c < cols - 1) btn.classList.add("subgrid-border-col");
          if (r % 5 === 4 && r < rows - 1) btn.classList.add("subgrid-border-row");

          this.gridCellsEl.appendChild(btn);
        }
      }
    }

    this.updateGridValues();
    this.updateStats();
    this.updateToolButtons();
    this.updateLineSatisfactions();
    this.updateWingStamps();
  }

  updateGridValues() {
    if (!this.gridCellsEl || !this.game.state) return;
    const { rows, cols, grid } = this.game.state;
    const cells = this.gridCellsEl.children;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const cellEl = cells[idx];
        if (!cellEl) continue;

        const val = grid[r][c];
        cellEl.classList.remove("cell-painted", "cell-crossed", "cell-empty");

        if (val === CELL_PAINT) {
          cellEl.classList.add("cell-painted");
          cellEl.textContent = "";
        } else if (val === CELL_CROSS) {
          cellEl.classList.add("cell-crossed");
          cellEl.textContent = "✕";
        } else {
          cellEl.classList.add("cell-empty");
          cellEl.textContent = "";
        }
      }
    }
  }

  updateStats() {
    if (this.mistakesEl && this.game.state) {
      this.mistakesEl.textContent = String(this.game.state.mistakes);
    }
    if (this.timerEl) {
      const s = Math.floor(this.game.elapsedMs / 1000);
      const m = Math.floor(s / 60);
      const remS = s % 60;
      this.timerEl.textContent = `${String(m).padStart(2, "0")}:${String(remS).padStart(2, "0")}`;
    }
  }

  updateToolButtons() {
    const isPaint = this.game.tool === "paint";
    if (this.btnPaint) {
      this.btnPaint.classList.toggle("tool-active", isPaint);
      this.btnPaint.setAttribute("aria-pressed", isPaint ? "true" : "false");
    }
    if (this.btnCross) {
      this.btnCross.classList.toggle("tool-active", !isPaint);
      this.btnCross.setAttribute("aria-pressed", !isPaint ? "true" : "false");
    }
  }

  updateLineSatisfactions() {
    if (this.rowCluesEl) {
      const rows = this.rowCluesEl.children;
      for (let r = 0; r < rows.length; r++) {
        rows[r].classList.toggle("line-satisfied", this.game.lastSatisfiedRows.has(r));
      }
    }
    if (this.colCluesEl) {
      const cols = this.colCluesEl.children;
      for (let c = 0; c < cols.length; c++) {
        cols[c].classList.toggle("line-satisfied", this.game.lastSatisfiedCols.has(c));
      }
    }
  }

  flashCellError(row, col) {
    if (!this.gridCellsEl || !this.game.state) return;
    const cols = this.game.state.cols;
    const idx = row * cols + col;
    const cellEl = this.gridCellsEl.children[idx];
    if (cellEl) {
      cellEl.classList.add("cell-error");
      setTimeout(() => {
        cellEl.classList.remove("cell-error");
      }, 350);
    }
  }

  flashHintCell(row, col) {
    if (!this.gridCellsEl || !this.game.state) return;
    const cols = this.game.state.cols;
    const idx = row * cols + col;
    const cellEl = this.gridCellsEl.children[idx];
    if (cellEl) {
      cellEl.classList.add("cell-hint-flash");
      setTimeout(() => {
        cellEl.classList.remove("cell-hint-flash");
      }, 600);
    }
  }

  updateWingStamps() {
    if (!this.wingStampsEl) return;
    const completed = getAllCompletedLevels();
    const currentChapter = this.game.activeLevel ? this.game.activeLevel.chapterKey : "chapter_prologue";
    const chapterLevels = getLevelsByChapter(currentChapter);

    this.wingStampsEl.innerHTML = "";
    chapterLevels.forEach((lvl) => {
      const record = completed[lvl.id];
      const stampEl = document.createElement("button");
      stampEl.type = "button";
      stampEl.className = "mini-stamp";
      if (record) {
        stampEl.classList.add("stamp-unlocked");
        stampEl.title = `${t(lvl.titleKey)} (${record.stars}★)`;
        stampEl.innerHTML = `
          <div class="mini-pixel-canvas" data-id="${lvl.id}"></div>
          <span class="mini-stars">${"★".repeat(record.stars)}</span>
        `;
        setTimeout(() => this.drawMiniPixelStamp(stampEl.querySelector(".mini-pixel-canvas"), lvl), 0);
      } else {
        stampEl.classList.add("stamp-locked");
        stampEl.title = t("album_locked");
        stampEl.innerHTML = `<span class="lock-icon">?</span>`;
      }
      stampEl.addEventListener("click", () => {
        this.game.loadLevel(lvl.id);
        this.audio.playClick();
      });
      this.wingStampsEl.appendChild(stampEl);
    });

    if (this.wingChapterBadgesEl) {
      this.wingChapterBadgesEl.innerHTML = "";
      CHAPTERS.forEach((ch) => {
        const lvls = getLevelsByChapter(ch.key);
        const all3Stars = lvls.every((l) => completed[l.id] && completed[l.id].stars === 3);
        const hasCleared = lvls.some((l) => completed[l.id]);

        const badgeEl = document.createElement("div");
        badgeEl.className = "chapter-badge";
        if (all3Stars) badgeEl.classList.add("badge-gold");
        else if (hasCleared) badgeEl.classList.add("badge-silver");
        else badgeEl.classList.add("badge-locked");

        badgeEl.textContent = ch.icon;
        badgeEl.title = `${t(ch.key)} ${all3Stars ? "(3★ Badge)" : ""}`;
        this.wingChapterBadgesEl.appendChild(badgeEl);
      });
    }
  }

  drawMiniPixelStamp(container, level) {
    if (!container) return;
    const canvas = document.createElement("canvas");
    canvas.width = level.cols * 3;
    canvas.height = level.rows * 3;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = level.stampColor || "#38BDF8";
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (level.target[r][c] === 1) {
          ctx.fillRect(c * 3, r * 3, 3, 3);
        }
      }
    }
    container.innerHTML = "";
    container.appendChild(canvas);
  }

  showWinModal(data) {
    if (!this.modalWin) return;
    const { level, stars, timeMs } = data;

    const stampContainer = document.getElementById("win-stamp-container");
    if (stampContainer) {
      stampContainer.innerHTML = "";
      const canvas = document.createElement("canvas");
      const scale = Math.max(12, Math.floor(180 / Math.max(level.rows, level.cols)));
      canvas.width = level.cols * scale;
      canvas.height = level.rows * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = level.stampColor || "#F43F5E";
        for (let r = 0; r < level.rows; r++) {
          for (let c = 0; c < level.cols; c++) {
            if (level.target[r][c] === 1) {
              ctx.fillRect(c * scale, r * scale, scale, scale);
              ctx.strokeStyle = "rgba(255,255,255,0.15)";
              ctx.strokeRect(c * scale, r * scale, scale, scale);
            }
          }
        }
      }
      canvas.className = "win-stamp-canvas stamp-drop-anim";
      stampContainer.appendChild(canvas);
    }

    const titleEl = document.getElementById("win-level-name");
    if (titleEl) titleEl.textContent = t(level.titleKey);

    const starsEl = document.getElementById("win-stars");
    if (starsEl) {
      starsEl.innerHTML = Array.from({ length: 3 })
        .map((_, i) => `<span class="star-icon ${i < stars ? "star-earned" : "star-empty"}">★</span>`)
        .join("");
    }

    const ratingTextEl = document.getElementById("win-rating-text");
    if (ratingTextEl) {
      ratingTextEl.textContent = stars === 3 ? t("stars_perfect") : stars === 2 ? t("stars_good") : t("stars_clear");
    }

    const timeEl = document.getElementById("win-time");
    if (timeEl) {
      const s = Math.floor(timeMs / 1000);
      const m = Math.floor(s / 60);
      const remS = s % 60;
      timeEl.textContent = `${String(m).padStart(2, "0")}:${String(remS).padStart(2, "0")}`;
    }

    const mistakesEl = document.getElementById("win-mistakes");
    if (mistakesEl) {
      mistakesEl.textContent = String(this.game.state.mistakes);
    }

    this.openModal(this.modalWin);
  }

  openModal(modalEl) {
    if (this.activeModal) {
      this.closeModal(this.activeModal);
    }
    if (modalEl) {
      modalEl.classList.add("modal-open");
      modalEl.setAttribute("aria-hidden", "false");
      this.activeModal = modalEl;
    }
  }

  closeModal(modalEl = this.activeModal) {
    if (modalEl) {
      modalEl.classList.remove("modal-open");
      modalEl.setAttribute("aria-hidden", "true");
      if (this.activeModal === modalEl) {
        this.activeModal = null;
      }
    }
  }

  renderAlbum() {
    const listEl = document.getElementById("album-stamp-grid");
    if (!listEl) return;
    listEl.innerHTML = "";

    const completed = getAllCompletedLevels();

    CHAPTERS.forEach((ch) => {
      const chHeader = document.createElement("div");
      chHeader.className = "album-chapter-header";
      chHeader.textContent = `${ch.icon} ${t(ch.key)}`;
      listEl.appendChild(chHeader);

      const chGrid = document.createElement("div");
      chGrid.className = "album-chapter-grid";

      const chapterLvls = getLevelsByChapter(ch.key);
      chapterLvls.forEach((lvl) => {
        const record = completed[lvl.id];
        const item = document.createElement("div");
        item.className = "album-stamp-card";

        if (record) {
          item.classList.add("stamp-unlocked");
          const canvas = document.createElement("canvas");
          const scale = 5;
          canvas.width = lvl.cols * scale;
          canvas.height = lvl.rows * scale;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = lvl.stampColor || "#38BDF8";
            for (let r = 0; r < lvl.rows; r++) {
              for (let c = 0; c < lvl.cols; c++) {
                if (lvl.target[r][c] === 1) ctx.fillRect(c * scale, r * scale, scale, scale);
              }
            }
          }
          item.appendChild(canvas);

          const title = document.createElement("span");
          title.className = "album-card-title";
          title.textContent = t(lvl.titleKey);
          item.appendChild(title);

          const stars = document.createElement("span");
          stars.className = "album-card-stars";
          stars.textContent = "★".repeat(record.stars);
          item.appendChild(stars);

          item.addEventListener("click", () => {
            this.closeModal(this.modalAlbum);
            this.game.loadLevel(lvl.id);
            this.audio.playClick();
          });
        } else {
          item.classList.add("stamp-locked");
          item.innerHTML = `<span class="lock-placeholder">🔒</span><span class="album-card-title">${t("album_locked")}</span>`;
        }

        chGrid.appendChild(item);
      });

      listEl.appendChild(chGrid);
    });
  }

  renderLevelSelect() {
    const listEl = document.getElementById("levels-select-grid");
    if (!listEl) return;
    listEl.innerHTML = "";

    const completed = getAllCompletedLevels();

    CHAPTERS.forEach((ch) => {
      const chHeader = document.createElement("div");
      chHeader.className = "levels-chapter-header";
      chHeader.textContent = `${ch.icon} ${t(ch.key)}`;
      listEl.appendChild(chHeader);

      const chGrid = document.createElement("div");
      chGrid.className = "levels-list-grid";

      const chapterLvls = getLevelsByChapter(ch.key);
      chapterLvls.forEach((lvl, idx) => {
        const record = completed[lvl.id];
        const isCurrent = this.game.activeLevel && this.game.activeLevel.id === lvl.id;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "level-select-btn";
        if (isCurrent) btn.classList.add("level-active");
        if (record) btn.classList.add("level-cleared");

        btn.innerHTML = `
          <span class="lvl-num">${idx + 1}</span>
          <span class="lvl-name">${t(lvl.titleKey)}</span>
          <span class="lvl-stars">${record ? "★".repeat(record.stars) : "···"}</span>
        `;

        btn.addEventListener("click", () => {
          this.closeModal(this.modalLevels);
          this.game.loadLevel(lvl.id);
          this.audio.playClick();
        });

        chGrid.appendChild(btn);
      });

      listEl.appendChild(chGrid);
    });
  }

  refreshAllText() {
    const lang = getLanguage();
    document.documentElement.lang = lang;
    document.title = t("game_title");

    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((el) => {
      const key = el.dataset.i18n;
      if (key) {
        el.textContent = t(key);
      }
    });

    const ariaElements = document.querySelectorAll("[data-i18n-aria]");
    ariaElements.forEach((el) => {
      const key = el.dataset.i18nAria;
      if (key) {
        el.setAttribute("aria-label", t(key));
      }
    });

    const langBtn = document.getElementById("btn-lang");
    if (langBtn) {
      langBtn.textContent = t("langBtn");
    }

    this.renderBoard();
  }
}
