/**
 * Picross Custom Board / Workshop
 * Allows player to draw pixel art, verifies unique solvability, and builds custom puzzle.
 */

import { deriveGridClues, solveGrid } from "./engine.mjs";
import { saveCustomLevel } from "./storage.mjs";
import { t } from "./i18n.mjs";

export class CustomWorkshop {
  constructor(game, ui, audio) {
    this.game = game;
    this.ui = ui;
    this.audio = audio;
    this.size = 5; // 5, 8, 10
    this.grid = Array.from({ length: 5 }, () => new Array(5).fill(0));
    this.isDrawing = false;
    this.drawVal = 1;

    this.gridEl = document.getElementById("custom-grid");
    this.msgEl = document.getElementById("custom-status-msg");
    this.btnVerify = document.getElementById("custom-verify-btn");
    this.btnClear = document.getElementById("custom-clear-btn");
    this.sizeSelect = document.getElementById("custom-size-select");

    this.bindEvents();
  }

  init() {
    this.setSize(5);
  }

  setSize(newSize) {
    this.size = newSize;
    this.grid = Array.from({ length: this.size }, () => new Array(this.size).fill(0));
    this.renderGrid();
    if (this.msgEl) this.msgEl.textContent = "";
  }

  renderGrid() {
    if (!this.gridEl) return;
    this.gridEl.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    this.gridEl.style.gridTemplateRows = `repeat(${this.size}, 1fr)`;
    this.gridEl.innerHTML = "";

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "custom-cell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        if (this.grid[r][c] === 1) cell.classList.add("custom-filled");

        cell.addEventListener("mousedown", (e) => {
          e.preventDefault();
          this.isDrawing = true;
          this.drawVal = this.grid[r][c] === 1 ? 0 : 1;
          this.setCell(r, c, this.drawVal);
        });

        cell.addEventListener("mouseenter", () => {
          if (this.isDrawing) {
            this.setCell(r, c, this.drawVal);
          }
        });

        this.gridEl.appendChild(cell);
      }
    }
  }

  setCell(r, c, val) {
    this.grid[r][c] = val;
    const idx = r * this.size + c;
    const cellEl = this.gridEl ? this.gridEl.children[idx] : null;
    if (cellEl) {
      cellEl.classList.toggle("custom-filled", val === 1);
    }
  }

  bindEvents() {
    window.addEventListener("mouseup", () => {
      this.isDrawing = false;
    });

    if (this.sizeSelect) {
      this.sizeSelect.addEventListener("change", (e) => {
        const val = parseInt(e.target.value, 10);
        this.setSize(val || 5);
        this.audio.playClick();
      });
    }

    if (this.btnClear) {
      this.btnClear.addEventListener("click", () => {
        this.setSize(this.size);
        this.audio.playClick();
      });
    }

    if (this.btnVerify) {
      this.btnVerify.addEventListener("click", () => {
        this.verifyAndBuild();
      });
    }
  }

  verifyAndBuild() {
    let filledCount = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 1) filledCount++;
      }
    }

    if (filledCount === 0) {
      if (this.msgEl) {
        this.msgEl.textContent = t("custom_err_no_pixels");
        this.msgEl.className = "custom-msg error";
      }
      this.audio.playError();
      return;
    }

    const { rowClues, colClues } = deriveGridClues(this.grid);
    const result = solveGrid(rowClues, colClues, this.size, this.size, 2);

    if (result.count === 0) {
      if (this.msgEl) {
        this.msgEl.textContent = t("custom_err_contradiction");
        this.msgEl.className = "custom-msg error";
      }
      this.audio.playError();
      return;
    }

    if (result.count > 1) {
      if (this.msgEl) {
        this.msgEl.textContent = t("custom_err_multiple");
        this.msgEl.className = "custom-msg error";
      }
      this.audio.playError();
      return;
    }

    // Unique solution verified!
    const customLevel = {
      id: `custom_${Date.now()}`,
      chapterKey: "chapter_custom",
      titleKey: "chapter_custom",
      rows: this.size,
      cols: this.size,
      target: this.grid.map((r) => [...r]),
      rowClues,
      colClues,
      stampColor: "#38BDF8",
      isCustom: true,
    };

    saveCustomLevel(customLevel);
    this.audio.playLineComplete();

    if (this.msgEl) {
      this.msgEl.textContent = t("custom_success");
      this.msgEl.className = "custom-msg success";
    }

    setTimeout(() => {
      this.ui.closeModal(this.ui.modalCustom);
      this.game.loadLevel(customLevel);
    }, 600);
  }
}
