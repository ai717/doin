// 记忆对决 · 组装入口 (事件绑定、AI 时序调度、多语言切换与生命周期管理)

import {
  loadLocale,
  saveLocale,
  strings,
  t,
  htmlLang,
} from "./i18n.mjs";
import {
  loadSaveData,
  saveSaveData,
} from "./storage.mjs";
import {
  playSound,
  setMuted,
} from "./audio.mjs";
import { MemoryDuelController } from "./game.mjs";
import { MemoryDuelRenderer } from "./render.mjs";
import { PUZZLES } from "./puzzles.mjs";

let currentLocale = loadLocale();
let saveData = loadSaveData();
let controller = null;
let renderer = null;
let aiTimer = null;
let exposureTimer = null;

// 全量更新页面静态文本（包含 title 与顶栏）
function refreshPageText() {
  document.documentElement.lang = htmlLang(currentLocale);
  document.title = t("docTitle", currentLocale);

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", t("metaDesc", currentLocale));

  const backHome = document.getElementById("back-home");
  if (backHome) backHome.textContent = t("backHome", currentLocale);

  const stageTitle = document.getElementById("stage-title");
  if (stageTitle) stageTitle.textContent = t("gameTitle", currentLocale);

  const btnSound = document.getElementById("btn-sound");
  if (btnSound) {
    btnSound.setAttribute("aria-label", t("btnSound", currentLocale));
    btnSound.textContent = saveData.sound ? "🔊" : "🔇";
  }

  const btnLang = document.getElementById("btn-lang");
  if (btnLang) {
    btnLang.setAttribute("aria-label", t("btnLang", currentLocale));
    btnLang.textContent = t("btnLang", currentLocale);
  }

  const btnHelp = document.getElementById("btn-help");
  if (btnHelp) {
    btnHelp.setAttribute("aria-label", t("btnHelp", currentLocale));
  }

  const btnRestart = document.getElementById("btn-restart");
  if (btnRestart) {
    btnRestart.setAttribute("aria-label", t("btnRestart", currentLocale));
    btnRestart.textContent = "🔄";
  }
}

// 调度 AI 步进循环
function scheduleAiTurn() {
  if (aiTimer) clearTimeout(aiTimer);
  const snapshot = controller.getStateSnapshot();
  if (snapshot.isGameOver || snapshot.isPlayerTurn) return;

  // 拟真思考延迟 (500ms - 800ms)
  aiTimer = setTimeout(() => {
    const decision = controller.getAiNextAction();
    if (!decision) return;

    controller.executeAiAction(decision);

    // 如果仍在 AI 回合且未终局，继续排期下一步（如翻第二张或连击）
    const nextSnapshot = controller.getStateSnapshot();
    if (!nextSnapshot.isGameOver && !nextSnapshot.isPlayerTurn && nextSnapshot.engine.turnPhase !== "exposure_window") {
      scheduleAiTurn();
    }
  }, 650);
}

// 状态变更监听器
function handleStateChange(snapshot) {
  renderer.renderBoard(snapshot.engine.board, snapshot.isScoutingMode, snapshot.engine.activePlayer);
  renderer.updateHud(snapshot);
  renderer.updateAiPersona(snapshot.tierKey);

  // 终局处理
  if (snapshot.isGameOver) {
    if (snapshot.engine.winner === "player") {
      playSound("victory");
      // 记录进度与存档
      saveData.stats.wins++;
      saveData.stats.totalMatches++;

      if (snapshot.mode === "challenge") {
        const tier = snapshot.tierKey;
        saveData.challenge.wins[tier] = (saveData.challenge.wins[tier] || 0) + 1;
        saveData.challenge.stars[tier] = Math.max(saveData.challenge.stars[tier] || 0, snapshot.stars);
        // 胜满 3 局解锁下一阶段
        if (saveData.challenge.wins.novice >= 3 && saveData.challenge.unlockedTier < 1) {
          saveData.challenge.unlockedTier = 1;
        }
        if (saveData.challenge.wins.veteran >= 3 && saveData.challenge.unlockedTier < 2) {
          saveData.challenge.unlockedTier = 2;
        }
      } else if (snapshot.mode === "endgame") {
        const pzIdx = snapshot.puzzleIndex;
        saveData.puzzles.stars[pzIdx] = Math.max(saveData.puzzles.stars[pzIdx] || 0, snapshot.stars);
        if (pzIdx + 1 > saveData.puzzles.unlockedLevel && pzIdx + 1 < PUZZLES.length) {
          saveData.puzzles.unlockedLevel = pzIdx + 1;
        }
      }
      saveSaveData(saveData);
    } else {
      playSound("defeat");
      saveData.stats.totalMatches++;
      saveSaveData(saveData);
    }

    setTimeout(() => {
      renderer.showGameOver(snapshot);
    }, 500);
  } else if (!snapshot.isPlayerTurn && snapshot.engine.turnPhase !== "exposure_window") {
    // 轮到 AI 行动
    scheduleAiTurn();
  }
}

// 游戏事件分发
function handleGameEvent(eventName, payload) {
  if (eventName === "flip_first" || eventName === "ai_flip_first") {
    playSound("flip");
    if (eventName === "flip_first") {
      renderer.logMessage(t("eventFlipFirst", currentLocale, { index: payload.cardIndex + 1 }));
    }
  } else if (eventName === "flip_cancel") {
    playSound("flip");
    renderer.logMessage(t("eventFlipCancel", currentLocale));
  } else if (eventName === "match_success" || eventName === "ai_match_success") {
    playSound("match");
    saveData.stats.totalPairsMatched++;
    saveSaveData(saveData);
    renderer.logMessage(t("eventMatchSuccess", currentLocale));
  } else if (eventName === "match_fail" || eventName === "ai_match_fail") {
    playSound("mismatch");
    renderer.logMessage(t("eventMatchFail", currentLocale));
    // 暴露窗口停留 900ms 自动盖回换手
    if (exposureTimer) clearTimeout(exposureTimer);
    exposureTimer = setTimeout(() => {
      controller.endExposure();
    }, 900);
  } else if (eventName === "scout") {
    playSound("scout");
    renderer.logMessage(t("eventScoutPlayer", currentLocale));
  } else if (eventName === "ai_scout") {
    playSound("scout");
    renderer.logMessage(t("eventScoutOpponent", currentLocale));
  } else if (eventName === "steal") {
    playSound("steal");
    saveData.stats.totalSteals++;
    saveSaveData(saveData);
    renderer.logMessage(t("eventStealPlayer", currentLocale));
  } else if (eventName === "ai_steal") {
    playSound("steal");
    renderer.logMessage(t("eventStealOpponent", currentLocale));
  } else if (eventName === "lock") {
    playSound("lock");
    saveData.stats.totalLocks++;
    saveSaveData(saveData);
    renderer.logMessage(t("eventLockPlayer", currentLocale));
  } else if (eventName === "ai_lock") {
    playSound("lock");
    renderer.logMessage(t("eventLockOpponent", currentLocale));
  } else if (eventName === "end_exposure") {
    renderer.logMessage(t("eventEndExposure", currentLocale));
  }
}

// 初始化装配
export function initApp() {
  const stageCore = document.getElementById("stage-core");
  if (!stageCore) return;

  setMuted(!saveData.sound);
  refreshPageText();

  renderer = new MemoryDuelRenderer(stageCore, currentLocale);
  renderer.buildStageSkeleton();

  controller = new MemoryDuelController({
    mode: "challenge",
    tierKey: "novice",
    onStateChange: handleStateChange,
    onEvent: handleGameEvent,
  });

  // 顶栏通用按钮绑定
  const btnSound = document.getElementById("btn-sound");
  if (btnSound) {
    btnSound.addEventListener("click", () => {
      saveData.sound = !saveData.sound;
      setMuted(!saveData.sound);
      saveSaveData(saveData);
      btnSound.textContent = saveData.sound ? "🔊" : "🔇";
      if (saveData.sound) playSound("flip");
    });
  }

  const btnLang = document.getElementById("btn-lang");
  if (btnLang) {
    btnLang.addEventListener("click", () => {
      currentLocale = currentLocale === "zh" ? "en" : "zh";
      saveLocale(currentLocale);
      renderer.setLocale(currentLocale);
      refreshPageText();
      renderer.buildStageSkeleton();
      bindStageEvents();
      controller.notifyState();
    });
  }

  const btnHelp = document.getElementById("btn-help");
  if (btnHelp) {
    btnHelp.addEventListener("click", () => {
      const modal = document.getElementById("modal-rules");
      if (modal) modal.showModal();
    });
  }

  const btnRestart = document.getElementById("btn-restart");
  if (btnRestart) {
    btnRestart.addEventListener("click", () => {
      playSound("flip");
      controller.restart();
    });
  }

  bindStageEvents();
}

// 绑定动态舞台事件
function bindStageEvents() {
  const arena = document.getElementById("duel-arena");
  if (!arena) return;

  // 卡牌点击
  const cardsGrid = document.getElementById("cards-grid");
  if (cardsGrid) {
    cardsGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".duel-card");
      if (!card || card.disabled) return;
      const idx = parseInt(card.dataset.index, 10);
      if (!isNaN(idx)) {
        controller.handleCardClick(idx);
      }
    });
  }

  // 行动按钮组 (Flip, Scout, Steal, Lock)
  const leftPanel = document.getElementById("left-vault-panel");
  if (leftPanel) {
    leftPanel.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "flip") {
        controller.cancelScout();
      } else if (action === "scout" || action === "steal" || action === "lock") {
        controller.triggerPlayerAction(action);
      } else if (action === "cancel_scout") {
        controller.cancelScout();
      }
    });
  }

  // 模式选择与弹窗关闭
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "open_modes") {
      const modal = document.getElementById("modal-modes");
      if (modal) {
        renderer.renderPuzzleGrid(saveData.puzzles, controller.puzzleIndex);
        modal.showModal();
      }
    } else if (action === "close_modes") {
      const modal = document.getElementById("modal-modes");
      if (modal && modal.open) modal.close();
    } else if (action === "close_rules") {
      const modal = document.getElementById("modal-rules");
      if (modal && modal.open) modal.close();
    } else if (action === "tab_challenge") {
      document.getElementById("tab-challenge")?.classList.add("active");
      document.getElementById("tab-endgame")?.classList.remove("active");
      document.getElementById("panel-challenge-select")?.classList.remove("hidden");
      document.getElementById("panel-endgame-select")?.classList.add("hidden");
    } else if (action === "tab_endgame") {
      document.getElementById("tab-endgame")?.classList.add("active");
      document.getElementById("tab-challenge")?.classList.remove("active");
      document.getElementById("panel-endgame-select")?.classList.remove("hidden");
      document.getElementById("panel-challenge-select")?.classList.add("hidden");
      renderer.renderPuzzleGrid(saveData.puzzles, controller.puzzleIndex);
    } else if (action === "start_tier") {
      const tier = btn.dataset.tier;
      controller.setMode("challenge", tier);
      document.getElementById("modal-modes")?.close();
    } else if (action === "start_puzzle") {
      const pzIdx = parseInt(btn.dataset.index, 10);
      controller.setMode("endgame", pzIdx);
      document.getElementById("modal-modes")?.close();
    } else if (action === "modal_retry") {
      renderer.closeGameOver();
      controller.restart();
    } else if (action === "modal_next") {
      renderer.closeGameOver();
      if (controller.mode === "challenge") {
        const nextTier = controller.tierKey === "novice" ? "veteran" : "master";
        controller.setMode("challenge", nextTier);
      } else {
        const nextIdx = Math.min(PUZZLES.length - 1, controller.puzzleIndex + 1);
        controller.setMode("endgame", nextIdx);
      }
    }
  });

  // 键盘快捷键 (S: Scout, L: Lock, T: Steal, Escape: 取消/退出)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.getElementById("modal-gameover")?.open) renderer.closeGameOver();
      if (document.getElementById("modal-modes")?.open) document.getElementById("modal-modes").close();
      if (document.getElementById("modal-rules")?.open) document.getElementById("modal-rules").close();
      if (controller.isScoutingMode) controller.cancelScout();
    } else if (e.key === "s" || e.key === "S") {
      controller.triggerPlayerAction("scout");
    } else if (e.key === "l" || e.key === "L") {
      controller.triggerPlayerAction("lock");
    } else if (e.key === "t" || e.key === "T") {
      controller.triggerPlayerAction("steal");
    }
  });
}

// 自动启动
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
}
