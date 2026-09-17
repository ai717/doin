/**
 * 数字华容道主入口装配模块
 */
import { GameController } from "./game.mjs";
import { GameUI } from "./ui.mjs";
import { loadSavedState, saveState } from "./storage.mjs";
import { detectLocale, saveLocale, t } from "./i18n.mjs";
import {
  setAudioEnabled,
  getAudioEnabled,
  playSlideSound,
  playCascadeSound,
  playTileHomeSound,
  playVictorySound,
} from "./audio.mjs";

function bootstrap() {
  const saved = loadSavedState();
  const locale = detectLocale();

  setAudioEnabled(saved.soundEnabled);

  const controller = new GameController({
    size: 4,
    mode: "speedrun",
    keyMode: saved.keyMode,
    onMoveFeedback: (movedTiles) => {
      if (movedTiles.length > 1) {
        playCascadeSound(movedTiles.length);
      } else {
        playSlideSound();
      }
      // 检查是否有新归位的滑块
      const size = controller.size;
      const anyHome = movedTiles.some((t) => t.toRow * size + t.toCol === t.value - 1);
      if (anyHome) {
        setTimeout(playTileHomeSound, 80);
      }
    },
    onVictory: (details) => {
      playVictorySound();

      // 更新存档记录
      const state = loadSavedState();
      const sz = details.size;

      if (details.mode === "speedrun") {
        if (!state.bestTimes[sz] || details.time < state.bestTimes[sz]) {
          state.bestTimes[sz] = Math.round(details.time * 10) / 10;
        }
        if (!state.bestMoves[sz] || details.moves < state.bestMoves[sz]) {
          state.bestMoves[sz] = details.moves;
        }
      } else if (details.mode === "ladder") {
        state.ladderStars[details.stage] = Math.max(
          state.ladderStars[details.stage] || 0,
          details.stars
        );
        if (details.stage >= state.ladderMaxStage) {
          state.ladderMaxStage = details.stage + 1;
        }
      } else if (details.mode === "daily") {
        state.dailyPlayed = new Date().toISOString().slice(0, 10);
      }

      saveState(state);
      ui.updateBestRecords(state.bestTimes, state.bestMoves);
      ui.showVictoryModal(details);
    },
  });

  const ui = new GameUI(controller, {
    locale,
    soundEnabled: saved.soundEnabled,
  });

  controller.onStateChange = (snapshot) => {
    ui.renderBoard();
    ui.updateMeters(snapshot);
  };

  // 初始界面渲染
  ui.setLocale(locale);
  ui.updateBestRecords(saved.bestTimes, saved.bestMoves);
  updateSoundButtonUI();
  updateLangButtonUI();

  // 启动第一局
  controller.initBoard(true);

  // 绑定模式与规格选项卡
  const modeBtns = [
    { el: document.getElementById("btn-mode-speedrun"), mode: "speedrun" },
    { el: document.getElementById("btn-mode-ladder"), mode: "ladder" },
    { el: document.getElementById("btn-mode-daily"), mode: "daily" },
  ];

  function setMode(mode) {
    modeBtns.forEach((b) => b.el?.classList.toggle("active", b.mode === mode));
    const sizeCard = document.getElementById("card-size-selector");

    if (mode === "speedrun") {
      if (sizeCard) sizeCard.style.display = "block";
      controller.mode = "speedrun";
      controller.initBoard(true);
    } else if (mode === "ladder") {
      if (sizeCard) sizeCard.style.display = "none";
      controller.startLadderStage(saved.ladderMaxStage || 1);
      ui.initBoardDOM();
    } else if (mode === "daily") {
      if (sizeCard) sizeCard.style.display = "none";
      const today = new Date().toISOString().slice(0, 10);
      controller.startDaily(today);
      ui.initBoardDOM();
    }
  }

  modeBtns.forEach(({ el, mode }) => {
    el?.addEventListener("click", () => setMode(mode));
  });

  // 规格切换 (3x3, 4x4, 5x5)
  const sizeBtns = [
    { el: document.getElementById("btn-size-3"), size: 3 },
    { el: document.getElementById("btn-size-4"), size: 4 },
    { el: document.getElementById("btn-size-5"), size: 5 },
  ];

  function setSize(sz) {
    sizeBtns.forEach((b) => b.el?.classList.toggle("active", b.size === sz));
    controller.size = sz;
    ui.initBoardDOM();
    controller.initBoard(true);
    ui.updateBestRecords(saved.bestTimes, saved.bestMoves);
  }

  sizeBtns.forEach(({ el, size }) => {
    el?.addEventListener("click", () => setSize(size));
  });

  // 核心操作按钮
  document.getElementById("btn-undo")?.addEventListener("click", () => {
    controller.undo();
  });

  document.getElementById("btn-reset")?.addEventListener("click", () => {
    controller.resetCurrent();
  });

  document.getElementById("btn-new")?.addEventListener("click", () => {
    controller.initBoard(true);
  });

  // 移动端 D-PAD 辅助按键
  document.getElementById("dpad-up")?.addEventListener("click", () => controller.makeDirectionMove("up"));
  document.getElementById("dpad-down")?.addEventListener("click", () => controller.makeDirectionMove("down"));
  document.getElementById("dpad-left")?.addEventListener("click", () => controller.makeDirectionMove("left"));
  document.getElementById("dpad-right")?.addEventListener("click", () => controller.makeDirectionMove("right"));

  // 键盘快捷键监听
  let lastKeyTime = 0;
  window.addEventListener("keydown", (e) => {
    // 弹窗开启时不响应快捷键
    const winModal = document.getElementById("modal-win");
    const helpModal = document.getElementById("modal-help");
    if (winModal?.open || helpModal?.open) return;

    const now = Date.now();
    if (now - lastKeyTime < 80) return; // 80ms 输入防抖缓冲

    if (e.key === "ArrowUp" || e.key === "KeyW" || e.code === "KeyW") {
      if (controller.makeDirectionMove("up")) {
        e.preventDefault();
        lastKeyTime = now;
      }
    } else if (e.key === "ArrowDown" || e.key === "KeyS" || e.code === "KeyS") {
      if (controller.makeDirectionMove("down")) {
        e.preventDefault();
        lastKeyTime = now;
      }
    } else if (e.key === "ArrowLeft" || e.key === "KeyA" || e.code === "KeyA") {
      if (controller.makeDirectionMove("left")) {
        e.preventDefault();
        lastKeyTime = now;
      }
    } else if (e.key === "ArrowRight" || e.key === "KeyD" || e.code === "KeyD") {
      if (controller.makeDirectionMove("right")) {
        e.preventDefault();
        lastKeyTime = now;
      }
    } else if (e.key === "KeyZ" || e.code === "KeyZ" || e.key === "z" || e.key === "Z") {
      controller.undo();
      e.preventDefault();
    } else if (e.key === "KeyR" || e.code === "KeyR" || e.key === "r" || e.key === "R") {
      controller.resetCurrent();
      e.preventDefault();
    }
  });

  // 音效切换
  function updateSoundButtonUI() {
    const btn = document.getElementById("btn-sound");
    if (btn) {
      btn.textContent = getAudioEnabled() ? "🔊" : "🔇";
    }
  }

  document.getElementById("btn-sound")?.addEventListener("click", () => {
    const next = !getAudioEnabled();
    setAudioEnabled(next);
    updateSoundButtonUI();
    const st = loadSavedState();
    st.soundEnabled = next;
    saveState(st);
  });

  // 语言切换
  function updateLangButtonUI() {
    const btn = document.getElementById("btn-lang");
    if (btn) {
      btn.textContent = ui.locale === "zh" ? "EN" : "中";
    }
  }

  document.getElementById("btn-lang")?.addEventListener("click", () => {
    const next = ui.locale === "zh" ? "en" : "zh";
    saveLocale(next);
    ui.setLocale(next);
    updateLangButtonUI();
  });

  // 帮助弹窗
  const modalHelp = document.getElementById("modal-help");
  document.getElementById("btn-help")?.addEventListener("click", () => {
    modalHelp?.showModal();
  });

  document.getElementById("btn-close-help")?.addEventListener("click", () => {
    modalHelp?.close();
  });

  // 键盘操作风格切换
  const selectKeymode = document.getElementById("select-keymode");
  if (selectKeymode) {
    selectKeymode.value = saved.keyMode || "push-tile";
    selectKeymode.addEventListener("change", (e) => {
      const mode = e.target.value;
      controller.keyMode = mode;
      const st = loadSavedState();
      st.keyMode = mode;
      saveState(st);
    });
  }

  // 结算弹窗按钮
  document.getElementById("btn-play-again")?.addEventListener("click", () => {
    ui.hideVictoryModal();
    controller.initBoard(true);
  });

  document.getElementById("btn-next-stage")?.addEventListener("click", () => {
    ui.hideVictoryModal();
    const nextStage = controller.stage + 1;
    controller.startLadderStage(nextStage);
    ui.initBoardDOM();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
