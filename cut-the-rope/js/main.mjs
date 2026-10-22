// 割绳子主装配入口：绑定输入手势、启动 60FPS 物理与渲染循环
import { STAGE_WIDTH, STAGE_HEIGHT } from "./engine.mjs";
import { GameController } from "./game.mjs";
import { StageRenderer } from "./render.mjs";
import { UIController } from "./ui.mjs";
import { sound } from "./audio.mjs";
import { recordLevelClear, loadSaveData } from "./storage.mjs";

function bootstrap() {
  const canvas = document.getElementById("stage-canvas");
  if (!canvas) return;

  const save = loadSaveData();
  sound.setEnabled(save.soundEnabled);

  const initialLevel = save.currentLevel || 1;
  const game = new GameController(initialLevel);
  const renderer = new StageRenderer(canvas);
  const ui = new UIController(game);

  renderer.resize();
  window.addEventListener("resize", () => renderer.resize());

  ui.init();

  // 刀光拖尾点集
  const bladeTrail = [];
  let isDragging = false;
  let startPos = null;
  let lastPos = null;
  let dragDist = 0;
  let strokeCounter = 0;
  let activeStrokeId = null;
  let autoResetTimer = null;

  function clearFailTimer() {
    if (autoResetTimer) {
      clearTimeout(autoResetTimer);
      autoResetTimer = null;
    }
  }

  function toStageCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const x = ((clientX - rect.left) / rect.width) * STAGE_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * STAGE_HEIGHT;
    return { x, y };
  }

  function handlePointerDown(e) {
    sound.init();
    sound.resume();

    // 失败状态下，轻点画布任意处即可立刻秒速重置本关
    if (game.state && game.state.status === "failed") {
      clearFailTimer();
      ui.hideFail();
      game.resetLevel();
      return;
    }

    const p = toStageCoords(e);
    isDragging = true;
    activeStrokeId = ++strokeCounter;
    startPos = p;
    lastPos = p;
    dragDist = 0;
    bladeTrail.length = 0;
    bladeTrail.push({ x: p.x, y: p.y, life: 1.0 });
  }

  function handlePointerMove(e) {
    if (!isDragging || !lastPos) return;
    const curr = toStageCoords(e);
    const dist = Math.hypot(curr.x - lastPos.x, curr.y - lastPos.y);
    dragDist += dist;

    // 划线割绳判定（传递 activeStrokeId，保证单次划击连续贯穿切断多根绳索）
    const res = game.handleCut(lastPos, curr, activeStrokeId);
    if (res.cutCount > 0) {
      sound.playCut();
      for (const cut of res.cuts) {
        renderer.addSpark(cut.cutPoint.x, cut.cutPoint.y, 14);
      }
      ui.updateHUD(game.state);
    }

    bladeTrail.push({ x: curr.x, y: curr.y, life: 1.0 });
    lastPos = curr;
  }

  function handlePointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    activeStrokeId = null;

    // 点击判定（轻点气泡或皮囊）
    if (dragDist < 14 && startPos) {
      game.handleTap(startPos.x, startPos.y);
    }
  }

  // 指针与触控统一事件绑定
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    handlePointerDown(e);
  });

  canvas.addEventListener("pointermove", (e) => {
    e.preventDefault();
    handlePointerMove(e);
  });

  canvas.addEventListener("pointerup", (e) => {
    e.preventDefault();
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
    handlePointerUp(e);
  });

  canvas.addEventListener("pointercancel", handlePointerUp);

  // 游戏事件响应
  game.on("star", ({ index }) => {
    sound.playStar(index);
    renderer.addSpark(game.state.candy.x, game.state.candy.y, 16);
    ui.updateHUD(game.state);
  });

  game.on("pop", (data) => {
    sound.playBubblePop();
    renderer.addSpark(data.x, data.y, 18);
    ui.updateHUD(game.state);
  });

  game.on("puff", () => {
    sound.playBellows();
    ui.updateHUD(game.state);
  });

  game.on("win", ({ levelId, stars, time }) => {
    sound.playChew();
    setTimeout(() => sound.playWin(), 280);
    recordLevelClear(levelId, stars, time);
    setTimeout(() => {
      ui.showWinModal(levelId, stars, time);
    }, 450);
  });

  game.on("fail", ({ reason }) => {
    sound.playFail();
    ui.showFail(reason);

    // 割完失败后，让玩家看清失败反馈（950ms）后自动立刻重置本关
    clearFailTimer();
    autoResetTimer = setTimeout(() => {
      if (game.state && game.state.status === "failed") {
        ui.hideFail();
        game.resetLevel();
      }
    }, 950);
  });

  game.on("reset", () => {
    clearFailTimer();
    ui.hideFail();
    bladeTrail.length = 0;
    ui.updateHUD(game.state);
  });

  // RAF 物理步进与渲染主循环
  let lastTime = performance.now();
  const FIXED_DT = 1 / 60;
  let accumulator = 0;

  function loop(now) {
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    accumulator += delta;
    while (accumulator >= FIXED_DT) {
      game.step(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    // 衰减刀光轨迹寿命
    for (let i = bladeTrail.length - 1; i >= 0; i--) {
      bladeTrail[i].life -= delta * 4.2;
      if (bladeTrail[i].life <= 0) {
        bladeTrail.splice(i, 1);
      }
    }

    renderer.render(game.state, bladeTrail, delta);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
