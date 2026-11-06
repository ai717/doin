// 恶魔迷途 · 装配入口
// 唯一职责：把 engine/levels（规则）、game（控制器）、render（画布）、ui（机台控件）
// 与 audio（音效）接起来，然后驱动主循环。
//
// 主循环用 requestAnimationFrame + 固定步长累积器（累积器在 game.mjs 里），
// 渲染帧率与物理步长解耦：120Hz 高刷与 30fps 老设备的物理结果完全一致。

import { DevilRunGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import audio from "./audio.mjs";
import * as storage from "./storage.mjs";

const CANVAS_ID = "stage";

function detectReducedMotion() {
  try {
    return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

function boot() {
  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas) return null;

  const reduced = detectReducedMotion();

  // 起始关卡：存档里已解锁的最后一关（老玩家回来时不会从头再刷）
  const store = storage.load();
  const resumeAt = Math.max(0, Math.min(storage.LEVEL_COUNT - 1, store.progress.unlocked - 1));

  const game = new DevilRunGame({ levelIndex: resumeAt });
  const renderer = createRenderer(canvas, { reducedMotion: reduced });
  audio.setMuted(Boolean(store.prefs.muted));

  const ui = createUI({ game, renderer, audio });
  const controller = ui.init();

  // ---- 事件：用户手势解锁音频（浏览器自动播放策略）----
  const unlock = () => audio.init();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });

  // ---- 响应式：画布尺寸与设备像素比 ----
  const onResize = () => renderer.resize();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // ---- 动效降级：系统偏好变化时实时切换 ----
  let mq = null;
  try {
    mq = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  } catch {
    mq = null;
  }
  const onMotionChange = (ev) => renderer.setReducedMotion(Boolean(ev.matches));
  if (mq) {
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onMotionChange);
    else if (typeof mq.addListener === "function") mq.addListener(onMotionChange);
  }

  // ---- 切到后台时清空输入并暂停（避免回来时补帧暴走）----
  const onVisibility = () => {
    if (document.hidden) {
      game.clearInputs();
      if (!game.isPaused) game.setPaused(true);
    } else if (game.isPaused && !document.querySelector(".layer:not([hidden])")) {
      game.setPaused(false);
      last = 0; // 重置时间基准，不补帧
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // ---- 主循环 ----
  let last = 0;
  let raf = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);

    // 首帧 / 从后台回来：只记录基准时间，不推进物理
    if (!last) {
      last = now;
      renderer.draw(game.getSummary(), 0);
      return;
    }

    let dt = (now - last) / 1000;
    last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    // 单帧上限交给 game 内部再兜一层，这里先削掉明显的异常跳变
    if (dt > 0.25) dt = 0.25;

    const events = game.tick(dt);
    const summary = game.getSummary();

    controller.onFrame(events, summary);
    renderer.draw(summary, dt);
  }

  renderer.resize();
  raf = requestAnimationFrame(frame);

  // 供排障用（不参与业务）
  return {
    game,
    renderer,
    ui,
    stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (mq) {
        if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onMotionChange);
        else if (typeof mq.removeListener === "function") mq.removeListener(onMotionChange);
      }
      controller.destroy?.();
    }
  };
}

// DOM 未就绪时等待，就绪后启动。脚本用 type="module" 引入，
// 现代浏览器里 module 默认 defer，通常已经在 DOMContentLoaded 之后。
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

export { boot };
