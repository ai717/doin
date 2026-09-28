// main.mjs — 装配入口：把 engine / game / render / ui / score / storage / i18n / audio 串起来。
// 这里只做“接线”，不含任何规则、计分或绘制逻辑。

import { STATUS, summarise } from "./engine.mjs";
import {
  ZONES,
  LEVELS,
  levelById,
  levelsOfZone,
  levelIdsOfZone,
  nextLevelId,
  zoneUnlocked,
} from "./levels.mjs";
import { advanceFrame, begin, createGame, dispatch, setViewport } from "./game.mjs";
import { totalPearls, pearlsOfZone } from "./score.mjs";
import * as store from "./storage.mjs";
import { createAudio } from "./audio.mjs";
import { createRenderer, WORLD_WIDTH } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { LOCALES, format, loadLocale, saveLocale, strings } from "./i18n.mjs";

const FIXED_STEP = 1 / 60;
const MAX_STEPS = 5;
const HUD_INTERVAL = 1000 / 24;
const ABYSS_GATE_ZONE = 2;

function boot() {
  const doc = globalThis.document;
  const canvas = doc.getElementById("sea");
  const viewport = doc.getElementById("viewport");
  if (!canvas || !viewport) return;

  const reduceQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reduced = Boolean(reduceQuery?.matches);

  let saved = store.load();
  let locale = loadLocale();
  let muted = saved.prefs.muted;

  const audio = createAudio({ muted });
  const renderer = createRenderer(canvas, { reducedMotion: reduced });
  const game = createGame({ levelId: saved.progress.lastLevel });

  const ui = createUI({
    document: doc,
    onIntent: (intent) => handleIntent(intent),
  });

  let running = false;
  let rafId = 0;
  let lastFrame = 0;
  let accumulator = 0;
  let finishedHandled = false;
  let lastHud = 0;
  let hudSnapshot = null;

  // ---------- 视口 ----------
  function syncViewport() {
    const rect = viewport.getBoundingClientRect();
    const layout = renderer.resize(rect.width, rect.height, globalThis.devicePixelRatio || 1);
    setViewport(game, layout.worldHeight);
  }

  function resizeCanvasOnly() {
    const rect = viewport.getBoundingClientRect();
    renderer.resize(rect.width, rect.height, globalThis.devicePixelRatio || 1);
  }

  function pointerToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const height = game.state.world.height;
    return {
      x: ((clientX - rect.left) / rect.width) * WORLD_WIDTH,
      y: ((clientY - rect.top) / rect.height) * height,
    };
  }

  // ---------- 意图 ----------
  // 装载关卡（含深渊）后引擎一定会停在 STATUS.ready —— 这是给"开始"按钮留的台阶。
  // 所以凡是从重开/重试/下一关/选关/深渊直接进局的路径，都必须显式 begin() 才会跑帧；
  // 漏掉的症状是"画面静止、没有任何报错"，非常难排查，因此收敛成唯一入口。
  function launchRun() {
    begin(game);
    ui.hidePanels();
    ui.clearToasts();
    finishedHandled = false;
    renderer.clearEffects();
    startLoop();
  }

  function handleIntent(intent) {
    switch (intent?.type) {
      case "click":
        audio.unlock();
        audio.click();
        break;
      case "begin":
        audio.unlock();
        if (begin(game).action) {
          ui.hidePanels();
          ui.clearToasts();
          finishedHandled = false;
          setHintFor(levelById(game.levelId));
          startLoop();
        }
        break;
      case "toggleSound": {
        muted = !muted;
        audio.setMuted(muted);
        saved = store.setMuted(saved, muted);
        store.save(saved);
        ui.update(game.state, summarise(game.state), { muted });
        if (!muted) audio.click();
        break;
      }
      case "toggleLang": {
        const index = LOCALES.indexOf(locale);
        locale = LOCALES[(index + 1) % LOCALES.length];
        saveLocale(locale);
        refreshTexts();
        break;
      }
      case "togglePause": {
        if (game.state.status === STATUS.playing) {
          dispatch(game, { type: "pause" });
          ui.showPanel("paused");
        } else if (game.state.status === STATUS.paused) {
          dispatch(game, { type: "resume" });
          ui.hidePanels();
        }
        break;
      }
      case "resume":
        dispatch(game, { type: "resume" });
        ui.hidePanels();
        break;
      case "restart": {
        if (game.mode === "abyss") dispatch(game, { type: "startAbyss" });
        else dispatch(game, { type: "restart" });
        launchRun();
        break;
      }
      case "nextLevel": {
        const next = nextLevelId(game.levelId);
        if (!next) {
          openLevels();
          break;
        }
        dispatch(game, { type: "selectLevel", levelId: next });
        saved = store.setLastLevel(saved, next);
        store.save(saved);
        launchRun();
        break;
      }
      case "retry": {
        if (game.mode === "abyss") dispatch(game, { type: "startAbyss" });
        else dispatch(game, { type: "restart" });
        launchRun();
        break;
      }
      case "selectLevel": {
        if (!dispatch(game, { type: "selectLevel", levelId: intent.levelId }).action) break;
        saved = store.setLastLevel(saved, intent.levelId);
        store.save(saved);
        launchRun();
        break;
      }
      case "startAbyss": {
        audio.unlock();
        dispatch(game, { type: "startAbyss" });
        launchRun();
        break;
      }
      case "refreshLevels":
        openLevels();
        break;
      case "closedPanel":
        if (game.state.status === STATUS.ready) ui.showPanel("ready");
        else ui.hidePanels();
        break;
      case "resetSave": {
        if (!armResetConfirm()) break;
        saved = store.resetAll();
        game.attempt = 0;
        dispatch(game, { type: "selectLevel", levelId: LEVELS[0].id });
        openLevels();
        break;
      }
      default:
        break;
    }
  }

  // 清空存档是不可逆的破坏性操作，但原生 confirm() 会蹦出一个系统对话框，
  // 把舷窗机台砸成网页 —— 改成二次点击确认：第一下把按钮变红并改成“再点一次确认清空”，
  // 3.2 秒内不点就自己解除。用户永远知道自己正在按下什么。
  let resetTimer = 0;
  function disarmReset() {
    globalThis.clearTimeout(resetTimer);
    resetTimer = 0;
    const btn = ui.getRef("reset-save");
    if (!btn) return;
    delete btn.dataset.armed;
    btn.classList.remove("is-armed");
    btn.removeAttribute("aria-label");
    btn.textContent = strings(locale).resetBtn;
  }

  function armResetConfirm() {
    const btn = ui.getRef("reset-save");
    if (!btn) return true;
    if (btn.dataset.armed) {
      disarmReset();
      return true;
    }
    const t = strings(locale);
    btn.dataset.armed = "1";
    btn.classList.add("is-armed");
    btn.textContent = t.resetConfirmBtn;
    btn.setAttribute("aria-label", t.resetConfirm);
    resetTimer = globalThis.setTimeout(disarmReset, 3200);
    return false;
  }

  // 按本关当前生效的机制给出一句上下文提示（教学关引导）
  function setHintFor(level) {
    const t = strings(locale);
    const mechanics = level?.mechanics ?? {};
    let extra = "";
    if (mechanics.elite) extra = locale === "zh" ? "咬尾 3 次可降阶" : "3 tail bites drop a tier";
    else if (mechanics.pressure) extra = locale === "zh" ? "深水成长 ×1.5 / ×2，压强满要回浅层" : "Deep water feeds 1.5-2x; surface when pressure maxes";
    else if (mechanics.shoal) extra = locale === "zh" ? "三条同种小鱼 = 一尾随行鱼" : "Three of a species = one follower";
    else if (mechanics.frenzy) extra = locale === "zh" ? "1.2 秒内续吃可点燃狂暴" : "Chain within 1.2s to ignite Frenzy";
    ui.setHint(extra ? `${t.tipMove} · ${extra}` : `${t.tipMove} · ${t.tipSprint}`);
  }

  function refreshTexts() {
    disarmReset();
    ui.applyStrings(locale);
    ui.update(game.state, hudSnapshot ?? summarise(game.state), { muted });
    setHintFor(game.mode === "abyss" ? null : levelById(game.levelId));
    if (ui.currentPanelName() === "levels") openLevels();
  }

  function openLevels() {
    const t = strings(locale);
    const stars = saved.progress.stars;
    const total = totalPearls(stars);
    const zones = ZONES.map((zone) => ({
      zone: zone.zone,
      name: locale === "zh" ? zone.nameZh : zone.nameEn,
      blurb: locale === "zh" ? zone.blurbZh : zone.blurbEn,
      pearls: pearlsOfZone(stars, levelIdsOfZone(zone.zone)),
      gate: zone.pearlGate,
      unlocked: zoneUnlocked(zone.zone, total),
      levels: levelsOfZone(zone.zone).map((level) => ({
        id: level.id,
        name: locale === "zh" ? level.nameZh : level.nameEn,
        pearls: stars[level.id] ?? 0,
        current: level.id === game.levelId && game.mode === "level",
      })),
    }));
    ui.buildLevels({
      zones,
      totalPearls: total,
      abyssUnlocked: zoneUnlocked(ABYSS_GATE_ZONE, total),
      abyss: saved.progress.abyss,
    });
    ui.showPanel("levels");
  }

  // ---------- 事件 → 音效 / 浮字 ----------
  function playEvents(events) {
    const t = strings(locale);
    for (const event of events) {
      switch (event.type) {
        case "eat":
          audio.eat(game.state.combo);
          break;
        case "grow":
          audio.grow();
          toast(t.toastGrow, event.tier);
          break;
        case "frenzy":
          audio.frenzy(event.level);
          toast(event.level >= 2 ? t.toastFrenzy2 : t.toastFrenzy);
          break;
        case "shoalJoin":
          audio.power("shoal");
          toast(t.toastShoal, event.count);
          break;
        case "saved":
          audio.snap();
          toast(t.toastSaved);
          break;
        case "bitten":
          audio.bite();
          toast(t.toastBitten);
          break;
        case "poisoned":
          audio.hurt();
          toast(t.toastPoison);
          break;
        case "jelly":
          audio.zap();
          toast(t.toastJelly);
          break;
        case "spike":
          audio.hurt();
          toast(t.toastSpike);
          break;
        case "boom":
          audio.boom();
          toast(t.toastBoom);
          break;
        case "defuse":
          audio.zap();
          toast(t.toastDefuse);
          break;
        case "snared":
          audio.net();
          toast(t.toastNet);
          break;
        case "netBroke":
          audio.click();
          toast(t.toastNetBroke);
          break;
        case "chest":
          if (event.good) {
            audio.power(event.power);
            toast(t.toastChest);
          } else {
            audio.net();
            toast(t.toastChestTrap);
          }
          break;
        case "power":
          audio.power(event.power);
          toast(powerToast(event.power));
          break;
        case "tail":
          audio.snap();
          toast(t.toastTail, event.hits, event.need);
          break;
        case "subdue":
          audio.subdue();
          toast(event.boss ? t.toastSubdueBoss : t.toastSubdue);
          break;
        case "pressureFull":
          audio.hurt();
          toast(t.toastPressureFull);
          break;
        case "pressureSafe":
          toast(t.toastPressureSafe);
          break;
        case "hurry":
          audio.hurry();
          toast(t.toastHurry);
          break;
        case "won":
          audio.win();
          break;
        case "timeout":
          toast(t.toastTimeout);
          break;
        case "lost":
          audio.lose();
          break;
        default:
          break;
      }
    }
  }

  function powerToast(kind) {
    const t = strings(locale);
    if (kind === "pearl") return t.toastPearl;
    if (kind === "lightning") return t.toastLightning;
    if (kind === "frenzy") return t.toastFrenzyPower;
    if (kind === "shoal") return t.toastShoalPower;
    return t.toastHeart;
  }

  function toast(template, ...args) {
    ui.toast(format(template, ...args));
  }

  // ---------- 结算 → 存档 ----------
  function handleFinished() {
    if (finishedHandled) return;
    finishedHandled = true;
    const result = game.finished;
    if (!result) return;
    if (game.mode === "abyss") {
      const recorded = store.recordAbyss(saved, { meters: result.meters, score: result.score });
      saved = recorded.state;
      store.save(saved);
      ui.showAbyssEnd({ result, best: saved.progress.abyss, isRecord: recorded.isRecord });
      ui.showPanel("abyss");
      return;
    }
    const recorded = store.recordLevel(saved, { levelId: game.levelId, pearls: result.pearls });
    saved = recorded.state;
    store.save(saved);
    ui.showResult({
      result,
      isRecord: recorded.improved && result.pearls > 0,
      isAbyss: false,
      hasNext: Boolean(nextLevelId(game.levelId)),
    });
    ui.showPanel("result");
  }

  // ---------- 主循环 ----------
  function frame(now) {
    rafId = globalThis.requestAnimationFrame(frame);
    const last = lastFrame || now;
    let delta = (now - last) / 1000;
    lastFrame = now;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    // 切到后台再回来时不要一次补上几百帧
    delta = Math.min(0.25, delta);

    const state = game.state;
    let events = [];
    if (state.status === STATUS.playing) {
      accumulator += delta;
      let steps = 0;
      while (accumulator >= FIXED_STEP && steps < MAX_STEPS) {
        events = events.concat(advanceFrame(game, FIXED_STEP));
        accumulator -= FIXED_STEP;
        steps += 1;
        if (state.status !== STATUS.playing) break;
      }
      if (steps >= MAX_STEPS) accumulator = 0;
    } else {
      accumulator = 0;
    }

    playEvents(events);
    renderer.draw(state, { time: state.time, dt: delta, events });
    // HUD 按 24Hz 刷新即可：canvas 是 60fps 的鱼，仪表不需要跟着每帧重排 DOM。
    if (events.length || now - lastHud >= HUD_INTERVAL) {
      lastHud = now;
      hudSnapshot = summarise(state);
      ui.update(state, hudSnapshot, { muted });
    }

    if (state.status !== STATUS.playing && state.status !== STATUS.ready && state.status !== STATUS.paused) {
      handleFinished();
    }
  }

  function startLoop() {
    if (running) return;
    running = true;
    lastFrame = 0;
    accumulator = 0;
    rafId = globalThis.requestAnimationFrame(frame);
  }

  // ---------- 输入 ----------
  function bindInput() {
    let pointerHeld = false;

    const moveTo = (clientX, clientY) => {
      const point = pointerToWorld(clientX, clientY);
      if (!point) return;
      dispatch(game, { type: "pointer", x: point.x, y: point.y });
    };

    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch" && !pointerHeld) return;
      audio.unlock();
      moveTo(event.clientX, event.clientY);
    });
    canvas.addEventListener("pointerdown", (event) => {
      pointerHeld = true;
      audio.unlock();
      moveTo(event.clientX, event.clientY);
      dispatch(game, { type: "sprint", on: true });
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    const release = () => {
      pointerHeld = false;
      dispatch(game, { type: "sprint", on: false });
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", () => {
      if (pointerHeld) release();
      dispatch(game, { type: "clearPointer" });
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    const keys = new Set();
    const KEY_DIRS = {
      arrowup: [0, -1], w: [0, -1],
      arrowdown: [0, 1], s: [0, 1],
      arrowleft: [-1, 0], a: [-1, 0],
      arrowright: [1, 0], d: [1, 0],
    };
    function applyKeys() {
      let x = 0;
      let y = 0;
      for (const key of keys) {
        const dir = KEY_DIRS[key];
        if (!dir) continue;
        x += dir[0];
        y += dir[1];
      }
      dispatch(game, { type: "keys", x: Math.sign(x), y: Math.sign(y) });
    }

    doc.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === " " || key === "spacebar") {
        audio.unlock();
        dispatch(game, { type: "sprint", on: true });
        event.preventDefault();
        return;
      }
      if (key === "p") {
        handleIntent({ type: "togglePause" });
        return;
      }
      if (key === "r") {
        handleIntent({ type: "restart" });
        return;
      }
      if (key === "escape") {
        if (ui.currentPanelName()) handleIntent({ type: "closedPanel" });
        else handleIntent({ type: "togglePause" });
        return;
      }
      if (key === "enter" && game.state.status === STATUS.ready) {
        handleIntent({ type: "begin" });
        return;
      }
      if (KEY_DIRS[key]) {
        audio.unlock();
        keys.add(key);
        applyKeys();
        event.preventDefault();
      }
    });
    doc.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key === " " || key === "spacebar") {
        dispatch(game, { type: "sprint", on: false });
        return;
      }
      if (KEY_DIRS[key]) {
        keys.delete(key);
        applyKeys();
      }
    });
    globalThis.addEventListener?.("blur", () => {
      keys.clear();
      applyKeys();
      dispatch(game, { type: "sprint", on: false });
    });

    if (reduceQuery?.addEventListener) {
      reduceQuery.addEventListener("change", () => {
        reduced = Boolean(reduceQuery.matches);
        renderer.setReducedMotion(reduced);
      });
    }

    const resizeObserver = globalThis.ResizeObserver ? new ResizeObserver(resizeCanvasOnly) : null;
    resizeObserver?.observe(viewport);
    globalThis.addEventListener("resize", resizeCanvasOnly);
    globalThis.addEventListener("orientationchange", () => {
      globalThis.setTimeout(syncViewport, 220);
    });
  }

  // ---------- 启动 ----------
  ui.applyStrings(locale);
  ui.bind();
  syncViewport();
  ui.update(game.state, summarise(game.state), { muted });
  setHintFor(levelById(game.levelId));
  ui.showPanel("ready");
  bindInput();
  // 首帧先把海域画出来（开场面板背后就是真实的海）
  renderer.draw(game.state, { time: 0, dt: 0, events: [] });
  // 循环常驻：即使停在开场 / 暂停，水色与光柱也在动
  startLoop();
}

if (globalThis.document?.readyState === "loading") {
  globalThis.document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
