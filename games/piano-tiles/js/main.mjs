// Piano Tiles — 装配入口
import { Game } from "./game.mjs";
import { Renderer } from "./render.mjs";
import { UI } from "./ui.mjs";
import { loadGameData, saveGameData } from "./storage.mjs";
import { playHit, playMiss, playRankUp, setMuted } from "./audio.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) return;

  // 1. 恢复存档（音效偏好等）
  const storage = loadGameData();
  setMuted(!storage.soundEnabled);

  // 2. 初始化游戏引擎与渲染器
  const game = new Game();
  const renderer = new Renderer(canvas);

  // 3. 订阅音频事件
  game.on("hit", (info) => playHit(info.combo, info.quality));
  game.on("miss", () => playMiss());
  game.on("gameover", (snap) => {
    // 段位晋升音效
    const prevBestRank = storage.bestRank;
    if (snap.rank && snap.rank !== prevBestRank) {
      playRankUp();
    }
  });

  // 4. 初始化 UI
  const ui = new UI({ game, renderer, storage });
  ui.onStorageChange = (updated) => {
    Object.assign(storage, updated);
    saveGameData(storage);
  };

  // 5. 初始 HUD 刷新（显示历史最高等）
  ui.dom.hudBest.textContent = storage.bestScore || 0;
  ui.dom.hudBestCombo.textContent = storage.bestCombo || 0;
  ui._updateHearts();

  // 6. 开场 idle 渲染一次（白轨道背景）
  renderer.render(game.getSnapshot());
  renderer.drawJudgeLine();
});
