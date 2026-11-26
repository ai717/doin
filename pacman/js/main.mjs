// main.mjs —— 入口装配：把 engine / game / render / ui / audio / storage 接在一起
//
// 铁律：
//   · 语言切换严禁 location.reload()，也严禁重置在进行的对局（关卡、分数、命数毫秒不差原样保持）
//   · 存档失败静默降级，绝不白屏；音频不可用静默
//   · 主循环按真实时间步进，切后台回来不许一次性把 dt 灌爆

import { DIR, GHOST_IDS } from "./engine.mjs";
import { createGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import { loadLocale, saveLocale, htmlLang } from "./i18n.mjs";
import * as store from "./storage.mjs";

const KEY_DIR = {
  ArrowUp: DIR.UP,
  ArrowDown: DIR.DOWN,
  ArrowLeft: DIR.LEFT,
  ArrowRight: DIR.RIGHT,
  w: DIR.UP,
  s: DIR.DOWN,
  a: DIR.LEFT,
  d: DIR.RIGHT,
  W: DIR.UP,
  S: DIR.DOWN,
  A: DIR.LEFT,
  D: DIR.RIGHT,
};

const GHOST_PARTICLE = {
  blinky: "#ff8090",
  pinky: "#ffc4de",
  inky: "#a6fbf1",
  clyde: "#ffd39b",
};

export function boot(doc = globalThis.document) {
  const canvas = doc?.querySelector?.("#stage") ?? null;
  let save = store.load();
  let locale = loadLocale();
  const audio = createAudio({ muted: save.muted });
  const renderer = createRenderer(canvas);
  const ui = createUI(doc);
  let game = createGame({
    mode: save.last.mode,
    level: save.last.level,
    setpieceId: save.last.setpiece,
    speedTier: save.prefs.speedTier,
  });
  let mode = save.last.mode;
  let best = save.records.highScore;
  let lastBeat = -10;
  let settled = false;

  renderer.setAssist(save.assist.aiRead);
  renderer.setMotion(!matchReduced());

  // ---------------------------------------------------------------- 结算

  function settle() {
    if (settled || !game.finished()) return;
    settled = true;
    const r = game.result();
    if (!r) return;
    const before = save.records.highScore;
    if (r.mode === "campaign" && r.cleared) {
      save = store.recordLevel(save, r.level, {
        stars: r.stars,
        score: r.score,
        timeMs: r.timeMs,
        cleared: true,
        noDeath: r.deaths === 0,
      });
    } else if (r.mode === "arcade") {
      save = store.recordArcade(save, { score: r.score, level: r.level, dots: r.dots, ghosts: r.ghosts });
    } else if (r.mode === "setpiece") {
      save = store.recordSetpiece(save, r.setpieceId, {
        cleared: r.cleared,
        score: r.score,
        timeMs: r.timeMs,
      });
    }
    save = store.recordRunStats(save, { chain: r.bestChain, ghostsEaten: r.ghosts });
    save = store.setLast(save, { mode, level: game.level, setpiece: game.setpieceId });
    best = save.records.highScore;
    ui.showResult(r, r.score > before && r.score > 0);
    if (r.cleared) audio.cleared();
    else audio.lost();
  }

  // ---------------------------------------------------------------- 开局

  function startRun(options = {}) {
    // ★ speedTier 必须显式带过去：createGame 每次都重建实例，
    //   不带的话「看情况调慢 → 重开一局」就悄悄掉回标准档。
    game = createGame({
      mode,
      level: options.level ?? game.level,
      setpieceId: options.setpieceId ?? game.setpieceId,
      speedTier: game.speedTier(),
    });
    game.start();
    settled = false;
    renderer.clearParticles();
    ui.showOverlay("none");
    ui.setPauseLabel(false);
    audio.release();
  }

  function goStage() {
    ui.showOverlay("ready");
    ui.setModePressed(mode);
    game.setPaused(true);
  }

  // ---------------------------------------------------------------- 事件 → 声音 / 粒子

  function handleEvents(events) {
    const st = game.state;
    for (const ev of events) {
      switch (ev.type) {
        case "pellet":
          audio.pellet(st?.chainLevel ?? 0);
          renderer.pop(ev.x, ev.y, "#fff0c8", 5);
          break;
        case "powerUp":
          audio.power();
          renderer.pop(st.player.tx, st.player.ty, "#ffd94a", 14);
          break;
        case "eatGhost":
          audio.eatGhost(ev.combo - 1);
          renderer.pop(st.player.tx, st.player.ty, GHOST_PARTICLE[ev.id] ?? "#ffffff", 16);
          break;
        case "death":
          audio.death();
          break;
        case "gameOver":
          audio.lost();
          break;
        case "modeSwitch":
          audio.beatSwitch(ev.mode);
          break;
        case "ghostRelease":
          audio.release();
          break;
        case "ghostRecaged":
          audio.recharge();
          break;
        case "chainBreak":
          audio.chainBreak();
          break;
        case "suppress":
          audio.suppress();
          break;
        case "gateToggle":
          audio.gate(ev.open);
          break;
        case "fruitEat":
          audio.fruit();
          break;
        case "extraLife":
          audio.extraLife();
          break;
        case "frightEnd":
          audio.frightEnd();
          break;
        case "levelClear":
        case "setpieceClear":
          break;
        default:
          break;
      }
    }
  }

  /** 换拍前 3 秒的心跳：约每 0.7 秒一次，逼近时不必再加速（已有视觉脉动） */
  function heartbeat(st) {
    if (!st || !Number.isFinite(st.modeTimer)) return;
    if (st.modeTimer > 3 || st.modeTimer <= 0) return;
    if (st.elapsed - lastBeat < 0.7) return;
    lastBeat = st.elapsed;
    audio.heartbeat();
  }

  // ---------------------------------------------------------------- 主循环

  let last = 0;
  function frame(now) {
    const t = now ?? 0;
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 1 / 60;
    last = t;
    if (game.state && game.status === "playing" && !game.paused) {
      handleEvents(game.tick(dt));
      heartbeat(game.state);
    }
    renderer.draw(game.state, dt);
    if (game.state) ui.syncHud(game.state, best);
    if (game.finished()) settle();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- 交互

  function onDir(dir) {
    if (!game.state) return;
    if (game.status !== "playing") return;
    game.input(dir);
  }

  function togglePause() {
    if (!game.state || game.status !== "playing") return;
    const paused = game.togglePause();
    ui.setPauseLabel(paused);
    if (paused) ui.showOverlay("pause");
    else ui.showOverlay("none");
    audio.click();
  }

  function applyLocale(next) {
    locale = next;
    saveLocale(locale);
    ui.setLocale(locale);
    if (doc?.documentElement) doc.documentElement.lang = htmlLang(locale);
    // ★ 热更新：只刷文本，绝不重建对局。选关网格里的迷宫名/机关名要跟着换
    ui.buildLevelGrid(save, pickLevel, game.level);
    ui.buildSetpieceGrid(save, pickSetpiece, game.setpieceId);
    ui.syncSound(save.muted);
    ui.syncAssist(save.assist.aiRead);
    ui.syncSpeedTier(save.prefs.speedTier);
    ui.setModePressed(mode);
    ui.setPauseLabel(game.paused);
  }

  function pickLevel(id) {
    mode = "campaign";
    save = store.setLast(save, { mode, level: id });
    startRun({ level: id });
    audio.click();
  }

  function pickSetpiece(id) {
    mode = "setpiece";
    save = store.setLast(save, { mode, setpiece: id });
    startRun({ setpieceId: id });
    audio.click();
  }

  ui.bind({
    onStart: () => {
      audio.click();
      if (mode === "setpiece") startRun({ setpieceId: game.setpieceId });
      else if (mode === "arcade") startRun({ level: game.level });
      else startRun({ level: game.level });
    },
    onPickLevel: () => {
      audio.click();
      ui.buildLevelGrid(save, pickLevel, game.level);
      ui.showOverlay("levels");
    },
    onResume: () => togglePause(),
    onRestart: () => {
      audio.click();
      game.restart();
      settled = false;
      renderer.clearParticles();
      ui.showOverlay("none");
      ui.setPauseLabel(false);
    },
    onStage: () => {
      audio.curtain();
      goStage();
    },
    onNext: () => {
      audio.click();
      const kind = game.advance();
      if (kind === "allClear") {
        goStage();
        return;
      }
      settled = false;
      renderer.clearParticles();
      ui.showOverlay("none");
      ui.setPauseLabel(false);
    },
    onTogglePause: togglePause,
    onSpeedTier: (tier) => {
      const next = game.setSpeedTier(tier);
      save = store.setSpeedTier(save, next);
      ui.syncSpeedTier(next);
      audio.click();
    },
    onToggleSound: () => {
      save = store.setMuted(save, !save.muted);
      audio.setMuted(save.muted);
      if (!save.muted) audio.click();
      ui.syncSound(save.muted);
    },
    onSound: (muted) => {
      save = store.setMuted(save, muted);
      audio.setMuted(muted);
      ui.syncSound(muted);
    },
    onToggleLang: () => {
      applyLocale(locale === "zh" ? "en" : "zh");
      audio.click();
    },
    onAssist: (on) => {
      save = store.setAssist(save, { aiRead: on });
      renderer.setAssist(on);
      ui.syncAssist(on);
    },
    onReset: () => {
      save = store.clear();
      best = 0;
      audio.deny();
      applyLocale(locale);
      goStage();
    },
    onMode: (next) => {
      if (!["campaign", "arcade", "setpiece"].includes(next)) return;
      mode = next;
      save = store.setLast(save, { mode });
      ui.setModePressed(mode);
      audio.click();
      if (mode === "setpiece") {
        ui.buildSetpieceGrid(save, pickSetpiece, game.setpieceId);
        ui.showOverlay("setpieces");
      }
    },
    onDir,
    onCloseSettings: () => ui.closeHelp(),
  });

  // 键盘
  doc?.addEventListener?.("keydown", (e) => {
    const dir = KEY_DIR[e.key];
    if (dir !== undefined) {
      e.preventDefault();
      onDir(dir);
      return;
    }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") togglePause();
    else if (e.key === "r" || e.key === "R") {
      if (game.state) {
        game.restart();
        settled = false;
        ui.showOverlay("none");
      }
    } else if (e.key === "Enter") {
      if (game.finished()) {
        const kind = game.advance();
        settled = false;
        if (kind === "allClear") goStage();
        else ui.showOverlay("none");
      } else if (game.status === "playing" && game.paused) togglePause();
      else startRun({ level: game.level, setpieceId: game.setpieceId });
    }
  });

  // 触屏滑动：在招牌上四向划一下即转向。
  // ★ 划出一次后不收手 —— 重新以当前落点为原点继续跟踪，
  //   否则「右转完马上上转」必须抬手再划一次，这是最不跟手的地方。
  const SWIPE_PX = 16;
  if (canvas) {
    let sx = 0;
    let sy = 0;
    let tracking = false;
    canvas.addEventListener("pointerdown", (e) => {
      tracking = true;
      sx = e.clientX;
      sy = e.clientY;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!tracking) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) onDir(dx > 0 ? DIR.RIGHT : DIR.LEFT);
      else onDir(dy > 0 ? DIR.DOWN : DIR.UP);
      sx = e.clientX;
      sy = e.clientY;
    });
    canvas.addEventListener("pointerup", () => {
      tracking = false;
    });
    canvas.addEventListener("pointercancel", () => {
      tracking = false;
    });
  }

  globalThis.addEventListener?.("resize", () => renderer.resize());
  globalThis.addEventListener?.("orientationchange", () => renderer.resize());

  // ---------------------------------------------------------------- 起步

  applyLocale(locale);
  ui.buildLevelGrid(save, pickLevel, game.level);
  ui.buildSetpieceGrid(save, pickSetpiece, game.setpieceId);
  ui.syncSound(save.muted);
  ui.syncAssist(save.assist.aiRead);
  ui.syncSpeedTier(save.prefs.speedTier);
  ui.setModePressed(mode);
  goStage();
  renderer.resize();
  requestAnimationFrame(frame);

  return {
    // ★ 必须用 getter：startRun 会把 game 整个换成新实例，
    //   快照式暴露会让调试句柄永远指向开局前那个空壳（state 恒为 null）。
    get game() {
      return game;
    },
    ui,
    renderer,
    audio,
    startRun,
    reload: () => store.load(),
  };
}

function matchReduced() {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
}

/** requestAnimationFrame 在测试桩里由外部驱动；浏览器里直连 rAF */
function requestAnimationFrame(cb) {
  const raf = globalThis.requestAnimationFrame;
  if (typeof raf === "function") raf(cb);
}

if (typeof globalThis.document !== "undefined" && globalThis.document.querySelector("#stage")) {
  // 调试句柄（与 __mole / __siege / __ms 同惯例）：没有它，真机冒烟只能读 DOM，
  // 够不到控制器层的口径（如 result().lostReason、setpieceLeft 这种只有引擎知道的值）。
  globalThis.__pacman = boot(globalThis.document);
}
