/**
 * Picross Main Assembly Entry Point
 * Binds DOM events, coordinates controller, renderer, audio, and i18n.
 */

import { GameController } from "./game.mjs";
import { UIRenderer } from "./render.mjs";
import { CustomWorkshop } from "./custom.mjs";
import * as audio from "./audio.mjs";
import { getLanguage, setLanguage } from "./i18n.mjs";
import { isSoundEnabled, setSoundEnabled } from "./storage.mjs";
import { CELL_PAINT, CELL_CROSS, CELL_EMPTY } from "./engine.mjs";

window.addEventListener("DOMContentLoaded", () => {
  const game = new GameController();
  const ui = new UIRenderer(game, audio);
  const custom = new CustomWorkshop(game, ui, audio);

  // Initialize language & UI
  ui.refreshAllText();

  window.addEventListener("resize", () => {
    ui.updateCellSize();
  });

  // Listen to game controller events
  game.on("level_loaded", () => {
    ui.renderBoard();
  });

  game.on("change", () => {
    ui.updateGridValues();
    ui.updateStats();
    ui.updateLineSatisfactions();
  });

  game.on("tick", () => {
    ui.updateStats();
  });

  game.on("mistake", (data) => {
    audio.playError();
    if (typeof data.row === "number" && typeof data.col === "number") {
      ui.flashCellError(data.row, data.col);
    }
  });

  game.on("line_satisfied", () => {
    audio.playLineComplete();
    ui.updateLineSatisfactions();
  });

  game.on("cell_changed", (data) => {
    if (!data.wasMistake) {
      if (data.val === CELL_PAINT) audio.playPaint();
      else if (data.val === CELL_CROSS) audio.playCross();
    }
  });

  game.on("undo", () => {
    audio.playClick();
  });

  game.on("hint_used", () => {
    audio.playHint();
  });

  game.on("restart", () => {
    audio.playClick();
  });

  game.on("win", (data) => {
    audio.playWin();
    setTimeout(() => {
      ui.showWinModal(data);
      ui.updateWingStamps();
    }, 450);
  });

  // Cell Interaction: Mouse Click & Drag
  let isPointerDown = false;
  let dragVal = null;
  let lastHoveredRow = -1;
  let lastHoveredCol = -1;

  function handlePointerDown(e) {
    const target = e.target.closest(".picross-cell");
    if (!target) return;
    const r = parseInt(target.dataset.row, 10);
    const c = parseInt(target.dataset.col, 10);
    if (isNaN(r) || isNaN(c)) return;

    isPointerDown = true;
    lastHoveredRow = r;
    lastHoveredCol = c;

    // Right click forces cross tool
    const isRightClick = e.button === 2;
    const effectiveTool = isRightClick ? "cross" : game.tool;
    const currentVal = game.state.grid[r][c];

    if (effectiveTool === "paint") {
      dragVal = currentVal === CELL_PAINT ? CELL_EMPTY : CELL_PAINT;
    } else {
      dragVal = currentVal === CELL_CROSS ? CELL_EMPTY : CELL_CROSS;
    }

    game.cellClick(r, c, dragVal);
  }

  function handlePointerMove(e) {
    if (!isPointerDown || dragVal === null) return;
    let target = null;

    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      target = elem ? elem.closest(".picross-cell") : null;
    } else {
      target = e.target.closest(".picross-cell");
    }

    if (!target) return;
    const r = parseInt(target.dataset.row, 10);
    const c = parseInt(target.dataset.col, 10);
    if (isNaN(r) || isNaN(c)) return;

    if (r !== lastHoveredRow || c !== lastHoveredCol) {
      lastHoveredRow = r;
      lastHoveredCol = c;
      if (game.state.grid[r][c] !== dragVal) {
        game.cellClick(r, c, dragVal);
      }
    }
  }

  function handlePointerUp() {
    isPointerDown = false;
    dragVal = null;
    lastHoveredRow = -1;
    lastHoveredCol = -1;
  }

  const gridEl = document.getElementById("grid-cells");
  if (gridEl) {
    gridEl.addEventListener("mousedown", (e) => {
      if (e.button === 0 || e.button === 2) {
        e.preventDefault();
        handlePointerDown(e);
      }
    });

    gridEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    gridEl.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        handlePointerDown(e);
      }
    }, { passive: true });

    window.addEventListener("touchmove", handlePointerMove, { passive: true });
    window.addEventListener("touchend", handlePointerUp);
    window.addEventListener("touchcancel", handlePointerUp);
  }

  // Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    // If a modal is open, Escape closes it
    if (e.key === "Escape" && ui.activeModal) {
      ui.closeModal(ui.activeModal);
      audio.playClick();
      return;
    }

    if (ui.activeModal) return;

    if (e.key === "z" || e.key === "Z" || (e.ctrlKey && e.key === "z")) {
      e.preventDefault();
      game.undo();
    } else if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      game.hint();
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      game.restart();
    } else if (e.key === "1" || e.key === " ") {
      game.setTool("paint");
      ui.updateToolButtons();
      audio.playClick();
    } else if (e.key === "2" || e.key === "x" || e.key === "X") {
      game.setTool("cross");
      ui.updateToolButtons();
      audio.playClick();
    }
  });

  // Tools & Control Buttons
  if (ui.btnPaint) {
    ui.btnPaint.addEventListener("click", () => {
      game.setTool("paint");
      ui.updateToolButtons();
      audio.playClick();
    });
  }

  if (ui.btnCross) {
    ui.btnCross.addEventListener("click", () => {
      game.setTool("cross");
      ui.updateToolButtons();
      audio.playClick();
    });
  }

  if (ui.btnUndo) {
    ui.btnUndo.addEventListener("click", () => {
      game.undo();
    });
  }

  if (ui.btnHint) {
    ui.btnHint.addEventListener("click", () => {
      game.hint();
    });
  }

  if (ui.btnRestart) {
    ui.btnRestart.addEventListener("click", () => {
      game.restart();
    });
  }

  if (ui.btnPrev) {
    ui.btnPrev.addEventListener("click", () => {
      game.prevLevel();
      audio.playClick();
    });
  }

  if (ui.btnNext) {
    ui.btnNext.addEventListener("click", () => {
      game.nextLevel();
      audio.playClick();
    });
  }

  // Header buttons
  const btnSound = document.getElementById("btn-sound");
  if (btnSound) {
    const updateSoundLabel = () => {
      const enabled = isSoundEnabled();
      btnSound.setAttribute("aria-pressed", enabled ? "true" : "false");
      btnSound.classList.toggle("sound-muted", !enabled);
    };
    updateSoundLabel();

    btnSound.addEventListener("click", () => {
      const next = !isSoundEnabled();
      setSoundEnabled(next);
      updateSoundLabel();
      if (next) audio.playClick();
    });
  }

  const btnLang = document.getElementById("btn-lang");
  if (btnLang) {
    btnLang.addEventListener("click", () => {
      const current = getLanguage();
      const next = current === "zh" ? "en" : "zh";
      setLanguage(next);
      ui.refreshAllText();
      audio.playClick();
    });
  }

  const btnHelp = document.getElementById("btn-help");
  if (btnHelp) {
    btnHelp.addEventListener("click", () => {
      ui.openModal(ui.modalHelp);
      audio.playClick();
    });
  }

  const btnAlbum = document.getElementById("btn-album");
  if (btnAlbum) {
    btnAlbum.addEventListener("click", () => {
      ui.renderAlbum();
      ui.openModal(ui.modalAlbum);
      audio.playClick();
    });
  }

  const btnLevels = document.getElementById("btn-levels");
  if (btnLevels) {
    btnLevels.addEventListener("click", () => {
      ui.renderLevelSelect();
      ui.openModal(ui.modalLevels);
      audio.playClick();
    });
  }

  const btnCustom = document.getElementById("btn-custom");
  if (btnCustom) {
    btnCustom.addEventListener("click", () => {
      custom.init();
      ui.openModal(ui.modalCustom);
      audio.playClick();
    });
  }

  // Modal Closers
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal-overlay");
      if (modal) {
        ui.closeModal(modal);
        audio.playClick();
      }
    });
  });

  // Win Modal Actions
  const btnWinNext = document.getElementById("btn-win-next");
  if (btnWinNext) {
    btnWinNext.addEventListener("click", () => {
      ui.closeModal(ui.modalWin);
      game.nextLevel();
      audio.playClick();
    });
  }

  const btnWinReplay = document.getElementById("btn-win-replay");
  if (btnWinReplay) {
    btnWinReplay.addEventListener("click", () => {
      ui.closeModal(ui.modalWin);
      game.restart();
      audio.playClick();
    });
  }

  const btnWinAlbum = document.getElementById("btn-win-album");
  if (btnWinAlbum) {
    btnWinAlbum.addEventListener("click", () => {
      ui.closeModal(ui.modalWin);
      ui.renderAlbum();
      ui.openModal(ui.modalAlbum);
      audio.playClick();
    });
  }
});
