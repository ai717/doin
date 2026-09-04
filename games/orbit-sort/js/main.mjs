import { canExtract, canInsert } from "../engine.mjs?v=dev";
import { createAudio } from "./audio.mjs?v=dev";
import { createDailyLevel, todayKey } from "./daily.mjs?v=dev";
import { CHAPTERS, LEVELS, levelById } from "../levels.mjs?v=dev";
import { createGame } from "./game.mjs?v=dev";
import { createBoardRenderer } from "./renderer.mjs?v=dev";
import { isValidStoredState, loadProgress, recordCompletion, recordDailyCompletion, saveCurrentGame, saveSoundPreference } from "./storage.mjs?v=dev";
import { computeScore, difficultyForLevel, baseScoreFor, moveScore, timeScore, moveMax, timeMax, perfectScoreForLevel } from "./score.mjs?v=dev";

// 计算通关/预估得分的辅助：
//   - 计算本局"当前可保证的最低积分"（还没通关就显示这个当预览）
//   - 通关时用同样的算法得到最终总分和明细
function estimateLiveScore({ level, state, isDaily = false, finishedAt = Date.now() }) {
  const startedAt = state?.stats?.startedAt || 0;
  const movesPlayed = state?.stats?.movesPlayed | 0 || 0;
  const elapsed = startedAt > 0 ? Math.max(0, finishedAt - startedAt) : 0;
  const D = difficultyForLevel(level);
  const base = baseScoreFor(D, Boolean(isDaily));
  const par = Number.isInteger(level?.par) ? level.par : Math.max(1, Math.ceil((base - 80) / 40 * 4 + 3));
  const move = moveScore(par, movesPlayed);
  const time = timeScore(D, elapsed);
  const total = base + move + time;
  return {
    total, base, move, time, par,
    difficulty: D,
    movesPlayed,
    elapsedMs: elapsed,
    stars: movesPlayed <= par ? 3 : movesPlayed <= par + 3 ? 2 : 1,
    mmax: moveMax(par),
    tmax: timeMax(D),
  };
}

export function bootstrap() {
  // --- 动态星空底层（Canvas 粒子 + 视差星云） ---
  (function startStarfield() {
    try {
    const canvas = document.getElementById("starfield");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    // 四层星星：远景/中景/近景/超新星
    const LAYERS = [
      { count: 0, size: [0.6, 1.2], speed: 0.008, alpha: [0.28, 0.48], drift: 0.06 }, // 远景
      { count: 0, size: [0.9, 1.8], speed: 0.016, alpha: [0.42, 0.7], drift: 0.12 },   // 中景
      { count: 0, size: [1.4, 2.6], speed: 0.028, alpha: [0.58, 0.95], drift: 0.22 },  // 近景
    ];
    const NEBULAE = [];
    const stars = [];
    // 流星：定期发射的斜向光带
    const shootingStars = [];
    let nextShootAt = performance.now() + 2400 + Math.random() * 3500;
    // 超新星爆发：偶发的瞬时亮点
    const supernovae = [];
    let nextNovaAt = performance.now() + 5200 + Math.random() * 5800;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth || window.innerWidth;
      h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      const area = (w * h) / (1440 * 900);
      LAYERS[0].count = Math.max(60, Math.round(110 * area));
      LAYERS[1].count = Math.max(32, Math.round(54 * area));
      LAYERS[2].count = Math.max(14, Math.round(22 * area));
      stars.length = 0;
      let id = 0;
      const palettes = ["#ffffff", "#cfe6ff", "#a7cfff", "#ffd9aa", "#d9c5ff"];
      for (const layer of LAYERS) {
        for (let i = 0; i < layer.count; i += 1) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: rand(layer.size[0], layer.size[1]),
            color: palettes[id === 2 && Math.random() < 0.15 ? 3 + Math.floor(Math.random() * 2) : Math.floor(Math.random() * 3)],
            baseAlpha: rand(layer.alpha[0], layer.alpha[1]),
            twPhase: Math.random() * Math.PI * 2,
            twSpeed: rand(0.4, 1.4),
            layerIndex: id,
          });
        }
        id += 1;
      }
      // 5 个星云斑（比之前多 1 层紫橙色）
      NEBULAE.length = 0;
      const nebulaColors = [
        "rgba(68, 110, 255, 0.20)",
        "rgba(156, 79, 208, 0.18)",
        "rgba(78, 196, 255, 0.13)",
        "rgba(255, 170, 90, 0.09)",
        "rgba(228, 92, 168, 0.10)",
      ];
      for (let i = 0; i < 5; i += 1) {
        const r = rand(Math.min(w, h) * 0.22, Math.min(w, h) * 0.46);
        NEBULAE.push({
          x: rand(0, w), y: rand(0, h), r,
          color: nebulaColors[i],
          vx: rand(-0.04, 0.04), vy: rand(-0.03, 0.03),
        });
      }
    }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function drawStar(s, time) {
      const flick = 0.62 + 0.38 * Math.sin((time * 0.001) * s.twSpeed + s.twPhase);
      const a = Math.min(1, s.baseAlpha * flick);
      if (s.layerIndex === 2 && s.r > 1.8) {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.2);
        g.addColorStop(0, hexA(s.color, a));
        g.addColorStop(0.35, hexA(s.color, a * 0.22));
        g.addColorStop(1, hexA(s.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.layerIndex >= 1 && s.r > 1.0) {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2);
        g.addColorStop(0, hexA(s.color, a * 0.95));
        g.addColorStop(0.55, hexA(s.color, a * 0.2));
        g.addColorStop(1, hexA(s.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = hexA(s.color, a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    function hexA(color, alpha) {
      if (color.startsWith("rgba")) return color;
      const c = color.replace("#", "");
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    function spawnShootingStar() {
      // 流星从右上 → 左下，沿 30° 方向
      const fromTop = Math.random() < 0.6;
      const sx = fromTop ? rand(w * 0.45, w + 60) : rand(-60, w * 0.35);
      const sy = fromTop ? rand(-40, h * 0.35) : rand(-40, h * 0.25);
      const angle = fromTop ? rand(2.48, 2.78) /* 右下 ~145°±10 */ : rand(0.32, 0.62) /* 左下 ~35°±10 */;
      const speed = rand(7, 11);
      const len = rand(120, 220);
      shootingStars.push({
        x: sx, y: sy, angle, speed, len,
        life: 1, head: rand(1.4, 2.4),
        color: Math.random() < 0.28 ? "rgba(255, 224, 180, " : "rgba(205, 235, 255, ",
      });
    }
    function drawShootingStar(sh) {
      const head = { x: sh.x, y: sh.y };
      const tail = { x: sh.x - Math.cos(sh.angle) * sh.len, y: sh.y - Math.sin(sh.angle) * sh.len };
      // 彗星尾迹渐变
      const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      grad.addColorStop(0, sh.color + "0)");
      grad.addColorStop(0.55, sh.color + (0.28 * sh.life).toFixed(3) + ")");
      grad.addColorStop(1, sh.color + Math.min(1, 0.92 * sh.life).toFixed(3) + ")");
      ctx.strokeStyle = grad;
      ctx.lineCap = "round";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
      // 弹头发光
      const hg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, sh.head * 6);
      hg.addColorStop(0, sh.color + Math.min(1, 1.1 * sh.life).toFixed(3) + ")");
      hg.addColorStop(0.25, sh.color + (0.35 * sh.life).toFixed(3) + ")");
      hg.addColorStop(1, sh.color + "0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(head.x, head.y, sh.head * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = sh.color + Math.min(1, 1.2 * sh.life) + ")";
      ctx.beginPath();
      ctx.arc(head.x, head.y, sh.head, 0, Math.PI * 2);
      ctx.fill();
    }
    function spawnNova() {
      supernovae.push({
        x: rand(40, w - 40),
        y: rand(40, h - 40),
        life: 1,
        r0: rand(2, 4),
        color: ["#fff7e0", "#e4f2ff", "#ffead8", "#e7ddff"][Math.floor(Math.random() * 4)],
      });
    }
    function drawNova(n) {
      const t = 1 - n.life; // 0 → 1 爆炸过程
      const rr = n.r0 + t * 62;
      const a = n.life;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, rr);
      g.addColorStop(0, hexA(n.color, 0.95 * a));
      g.addColorStop(0.4, hexA(n.color, 0.22 * a));
      g.addColorStop(1, hexA(n.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA(n.color, Math.min(1, 1.3 * a));
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r0 * (0.8 + t * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    function step(time) {
      ctx.clearRect(0, 0, w, h);
      // --- 底层：远景银河盘（倾斜椭圆，整体淡淡的乳白色带）---
      ctx.save();
      ctx.translate(w * 0.5, h * 0.56);
      ctx.rotate(-0.18);
      const galaxyR = Math.max(w, h) * 1.15;
      const gGal = ctx.createRadialGradient(0, 0, 0, 0, 0, galaxyR);
      gGal.addColorStop(0, "rgba(188, 216, 255, 0.030)");
      gGal.addColorStop(0.22, "rgba(120, 144, 235, 0.022)");
      gGal.addColorStop(0.55, "rgba(80, 70, 180, 0.012)");
      gGal.addColorStop(1, "rgba(10, 10, 40, 0)");
      ctx.fillStyle = gGal;
      ctx.beginPath();
      ctx.ellipse(0, 0, galaxyR, galaxyR * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      // 银河暗带（中间一条薄薄的深色带）
      const gDust = ctx.createLinearGradient(-galaxyR, -2, galaxyR, 2);
      gDust.addColorStop(0, "rgba(20, 8, 42, 0)");
      gDust.addColorStop(0.5, "rgba(20, 8, 42, 0.065)");
      gDust.addColorStop(1, "rgba(20, 8, 42, 0)");
      ctx.fillStyle = gDust;
      ctx.beginPath();
      ctx.ellipse(0, 0, galaxyR * 0.96, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // 星云团
      for (const n of NEBULAE) {
        if (!reduce) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < -n.r) n.x = w + n.r; if (n.x > w + n.r) n.x = -n.r;
          if (n.y < -n.r) n.y = h + n.r; if (n.y > h + n.r) n.y = -n.r;
        }
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        grad.addColorStop(0, n.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 远景中景近景星星
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        if (!reduce) {
          const layer = LAYERS[s.layerIndex];
          s.x += layer.speed + layer.drift * 0.02;
          s.y -= layer.speed * 0.32;
          if (s.x > w + 4) s.x = -4;
          if (s.y < -4) s.y = h + 4;
        }
        drawStar(s, time);
      }
      // 超新星爆发
      if (!reduce && time > nextNovaAt) {
        spawnNova();
        nextNovaAt = time + 4200 + Math.random() * 6800;
      }
      for (let i = supernovae.length - 1; i >= 0; i -= 1) {
        const n = supernovae[i];
        drawNova(n);
        n.life -= reduce ? 0 : 0.010;
        if (n.life <= 0) supernovae.splice(i, 1);
      }
      // 流星
      if (!reduce && time > nextShootAt) {
        spawnShootingStar();
        if (Math.random() < 0.18) spawnShootingStar(); // 偶发双流星
        nextShootAt = time + 2800 + Math.random() * 5200;
      }
      for (let i = shootingStars.length - 1; i >= 0; i -= 1) {
        const sh = shootingStars[i];
        drawShootingStar(sh);
        if (!reduce) {
          sh.x += Math.cos(sh.angle) * sh.speed;
          sh.y += Math.sin(sh.angle) * sh.speed;
          // 流星飞行路径过程中 life 从 1 渐降到 0 最终消失
          const traveledFrac = Math.min(1, Math.hypot(sh.x - (sh.x - Math.cos(sh.angle)*sh.speed*80), sh.y - (sh.y - Math.sin(sh.angle)*sh.speed*80)) / sh.len);
          sh.life -= 0.018 + (traveledFrac > 0.9 ? 0.05 : 0);
          if (sh.life <= 0 || sh.x < -sh.len - 40 || sh.x > w + sh.len + 40 || sh.y < -sh.len - 40 || sh.y > h + sh.len + 40) {
            shootingStars.splice(i, 1);
          }
        }
      }
      requestAnimationFrame(step);
    }
    window.addEventListener("resize", () => resize());
    resize();
    requestAnimationFrame(step);
  } catch (_err) { /* 星空画布失败不应阻塞主游戏启动 */ }
  })();

let level = null;
let initialState = null;
// The game object is the SINGLE SOURCE OF TRUTH for state. `game.state` is
// always authoritative. There is NO local state mirror — no dual-copy drift.
let game = null;
let progress = loadProgress();
let resultShown = false;
let hint = null;
let hintRequestId = 0;
let advisoryRequestId = 0;
let advisoryTimer = null;
const ADVISORY_DEBOUNCE_MS = 120;
let latestCompletedLevel = null;
let lastDialogTrigger = null;
let lastRenderedMoves = 0;
let lastRenderedCompleted = 0;
const hintWorker = new Worker("./solver-worker.mjs?v=dev", { type: "module" });

const board = document.querySelector("#game-board");
const moveLabel = document.querySelector("#move-label");
const parLabel = document.querySelector("#par-label");
const constellationLabel = document.querySelector("#constellation-label");
const totalScoreLabel = document.querySelector("#total-score-label");
const statusMessage = document.querySelector("#status-message");
const undoButton = document.querySelector("#undo-button");
const resetButton = document.querySelector("#reset-button");
const hintButton = document.querySelector("#hint-button");
const soundButton = document.querySelector("#sound-button");
const selectScreen = document.querySelector("#select-screen");
const playScreen = document.querySelector(".game-shell");
const levelGrid = document.querySelector("#level-grid");
const resultLayer = document.querySelector("#result-layer");
const resetLayer = document.querySelector("#reset-layer");
const resultScore = document.querySelector("#result-score");
const resultStars = document.querySelector("#result-stars");
const resultBreakdown = document.querySelector("#result-breakdown");
const resultMeta = document.querySelector("#result-meta");
const nextButton = document.querySelector("#next-button");
const againButton = document.querySelector("#again-button");
const continueButton = document.querySelector("#continue-button");
const dailyButton = document.querySelector("#daily-button");
const continueDailyButton = document.querySelector("#continue-daily-button");
const levelSelectButton = document.querySelector("#level-select-button");
const levelInfoButton = document.querySelector("#level-info-button");
const levelInfoLayer = document.querySelector("#level-info-layer");
const levelInfoText = document.querySelector("#level-info-text");
const levelInfoCloseButton = document.querySelector("#level-info-close-button");
const resetConfirmButton = document.querySelector("#reset-confirm-button");
const resetCancelButton = document.querySelector("#reset-cancel-button");
const audio = createAudio({ soundOn: progress.settings.soundOn });
function renderSoundButton(soundOn = audio.isOn()) {
  soundButton.setAttribute("aria-pressed", String(soundOn));
  soundButton.setAttribute("aria-label", soundOn ? "关闭声音" : "开启声音");
  soundButton.title = soundOn ? "关闭声音" : "开启声音";
  const icon = soundButton.querySelector(".tool-icon");
  const label = soundButton.querySelector(".tool-label");
  if (icon) icon.textContent = soundOn ? "♫" : "×";
  if (label) label.textContent = soundOn ? "声音" : "静音";
}

let statusTimer = null;
function message(text, tone = "info") {
  if (!text) {
    statusMessage.hidden = true;
    return;
  }
  statusMessage.textContent = text;
  statusMessage.dataset.tone = tone;
  statusMessage.hidden = false;
  statusMessage.classList.remove("is-fresh");
  void statusMessage.getBoundingClientRect();
  statusMessage.classList.add("is-fresh");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusMessage.hidden = true; }, 2400);
}

function haptic(pattern) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

function bump(node) {
  if (!node) return;
  node.classList.remove("is-bump");
  void node.getBoundingClientRect();
  node.classList.add("is-bump");
}

function openDialog(layer, trigger, focusTarget) {
  lastDialogTrigger = trigger;
  layer.hidden = false;
  requestAnimationFrame(() => focusTarget.focus());
}

function closeDialog(layer) {
  layer.hidden = true;
  lastDialogTrigger?.focus();
}

function render() {
  renderer.render(game.state);
  const movesPlayed = game.state?.stats?.movesPlayed | 0 || game.state.moves | 0; // 只增不减的用户步数
  const live = estimateLiveScore({ level, state: game.state, isDaily: level.id === "daily" });
  if (movesPlayed !== lastRenderedMoves) {
    lastRenderedMoves = movesPlayed;
    bump(moveLabel);
  }
  // —— HUD：步数 / 目标步数 / 得分（格式: 当前得分 / 本题满分）
  moveLabel.querySelector(".hud-value").textContent = String(movesPlayed);
  const parNode = parLabel.querySelector(".hud-par-val");
  if (parNode) parNode.textContent = String(level.par);
  const scoreNum = constellationLabel.querySelector(".hud-score-num");
  const scorePerfect = constellationLabel.querySelector(".hud-score-perfect");
  const perfect = perfectScoreForLevel(level, level.id === "daily");
  if (scoreNum) scoreNum.textContent = String(live.total);
  if (scorePerfect) scorePerfect.textContent = String(perfect);
  if (game.state.status !== "won") bump(constellationLabel); // live score 每次刷新跳一下
  // —— HUD：总积分（从 progress.totalScore 取）
  const totalNum = totalScoreLabel?.querySelector(".hud-total-num");
  if (totalNum) totalNum.textContent = String(progress.totalScore | 0);
  undoButton.disabled = game.state.history.length === 0;
  resetButton.disabled = game.state.moves === 0;
  if (game.state.status === "won") message("星轨已稳定", "good");
  if (game.state.status === "stuck") message("当前无后续调度；刚才的移动符合规则，可撤销重规划", "warn");
  if (game.state.status === "playing") message(game.state.selectedDockId === null ? "选择轨道入口，将星体调入星核" : "选择高亮轨道，落下星体");
}

function clearHint() {
  hint = null;
  hintRequestId += 1;
  advisoryRequestId += 1;
  if (advisoryTimer !== null) {
    clearTimeout(advisoryTimer);
    advisoryTimer = null;
  }
  hintButton.disabled = false;
  renderer.clearHint();
}

function requestSolvabilityCheck(nextState) {
  if (!nextState || nextState.status !== "playing") return;
  const requestId = ++advisoryRequestId;
  if (advisoryTimer !== null) clearTimeout(advisoryTimer);
  advisoryTimer = setTimeout(() => {
    advisoryTimer = null;
    if (requestId !== advisoryRequestId) return;
    hintWorker.postMessage({ kind: "solvability", requestId, state: nextState });
  }, ADVISORY_DEBOUNCE_MS);
}

function renderSelect() {
  if (!levelGrid) return;
  continueButton.hidden = !isValidSavedGame(progress.currentGame);
  const completedIds = Object.keys(progress?.bestByLevel ?? {})
    .map(Number)
    .filter(Number.isInteger);
  const completedScoreIds = Object.keys(progress?.bestScoresByLevel ?? {})
    .map(Number)
    .filter(Number.isInteger);
  const inferredUnlockedLevel = Math.max(1, ...completedIds, ...completedScoreIds) + 1;
  const unlockedLevel = Math.min(LEVELS.length, Math.max(progress?.unlockedLevel | 0 || 1, inferredUnlockedLevel));
  // 快速判定（避免每次 renderSelect 都跑 generator+solver 阻塞主线）：
  //   只有 saved.dateKey == todayKey 且 game.levelId=="daily" 才认为是继续今日挑战
  //   game.state 具体合法性在点击 "继续今日挑战" 时 startDaily(restore) 再校验，不阻塞选关渲染
  const tKey = todayKey();
  const dailySaved = progress?.daily;
  const likelyValidDaily = Boolean(
    dailySaved &&
    dailySaved.dateKey === tKey &&
    dailySaved.currentGame?.dateKey === tKey &&
    dailySaved.currentGame?.levelId === "daily" &&
    isValidStoredState(dailySaved.currentGame)
  );
  continueDailyButton.hidden = !likelyValidDaily;
  try {
  levelGrid.replaceChildren(...(CHAPTERS || []).map((chapter) => {
    const levels = (LEVELS || []).filter((item) => item && item.chapter === chapter.id);
    const completed = levels.filter((item) => progress?.bestByLevel?.[item.id]);
    const section = document.createElement("section");
    section.className = "chapter-map";
    section.dataset.theme = chapter.theme;
    section.setAttribute("aria-labelledby", `chapter-title-${chapter.id}`);
    const heading = document.createElement("h2");
    heading.id = `chapter-title-${chapter.id}`;
    heading.textContent = `第 ${chapter.id} 章 ${chapter.title}`;
    const summary = document.createElement("p");
    summary.textContent = `${chapter.description} · 已稳定 ${completed.length} / ${levels.length}`;
    const progressBar = document.createElement("div");
    progressBar.className = "chapter-progress";
    progressBar.setAttribute("aria-hidden", "true");
    const fill = document.createElement("i");
    fill.style.setProperty("--fill", `${levels.length ? Math.round((completed.length / levels.length) * 100) : 0}%`);
    progressBar.append(fill);
    const path = document.createElement("div");
    path.className = "chapter-path";
    path.setAttribute("aria-label", `第 ${chapter.id} 章关卡`);
    levels.forEach((item, index) => {
      const isUnlocked = (item.id ?? 0) <= unlockedLevel;
      const best = progress?.bestByLevel?.[item.id] || null;
      const bestScoreRecord = progress?.bestScoresByLevel?.[item.id] || null;
      const button = document.createElement("button");
      button.className = "level-node";
      button.type = "button";
      button.disabled = !isUnlocked;
      button.dataset.rowStart = String(index % 5 === 0);
      button.dataset.completed = String(Boolean(bestScoreRecord || best));
      button.dataset.current = String(isUnlocked && item.id === unlockedLevel && !best && !bestScoreRecord);
      button.style.animationDelay = `${index * 45}ms`;
      if (item.id === latestCompletedLevel) button.classList.add("is-new");
      // 分数文案：已通关显示“得分 / 总分”，未游玩显示“总分”。
      const perfect = perfectScoreForLevel(item, false);
      const hasScore = Boolean(bestScoreRecord);
      const displayedScore = hasScore ? `${bestScoreRecord.score}/${perfect}` : String(perfect);
      const scoreLabel = hasScore ? "得分" : "总分";
      button.setAttribute(
        "aria-label",
        hasScore
          ? `第 ${item.id} 关，已通关，得分 ${bestScoreRecord.score}，总分 ${perfect}`
          : isUnlocked ? `第 ${item.id} 关，总分 ${perfect}，可开始` : `第 ${item.id} 关，未解锁，总分 ${perfect}`
      );
      // 行星层级：表面大气+纹理球体 + 号码 + 底部分数标签
      const planet = document.createElement("span");
      planet.className = "planet";
      planet.dataset.completed = String(Boolean(bestScoreRecord || best));
      planet.dataset.difficulty = String(item.difficulty ?? difficultyForLevel(item));
      const number = document.createElement("span");
      number.className = "node-number";
      number.textContent = String(item.id);
      planet.append(number);
      const scoreBadge = document.createElement("small");
      scoreBadge.className = "node-score";
      scoreBadge.dataset.kind = hasScore ? "best" : "perfect";
      scoreBadge.setAttribute("aria-label", `${scoreLabel} ${displayedScore}`);
      scoreBadge.innerHTML = `<strong>${displayedScore}</strong>`;
      button.append(planet, scoreBadge);
      button.addEventListener("click", () => startLevel(item.id));
      path.append(button);
    });
    section.append(heading, summary, progressBar, path);
    return section;
  }));
  } catch (err) { /* 章节/关卡网格构建失败静默 */ console.error("[orbit-sort] renderSelect build fail:", err); }
  latestCompletedLevel = null;
}

function isValidSavedGame(saved) {
  const savedLevel = saved && levelById(saved.levelId);
  const game = saved?.state;
  return Boolean(savedLevel && isValidStoredState(game, savedLevel));
}

function isValidDailyGame(saved, dailyLevel) {
  const game = saved?.currentGame;
  return Boolean(saved?.dateKey === dailyLevel.dateKey && game?.levelId === "daily" && game.dateKey === dailyLevel.dateKey && isValidStoredState(game, dailyLevel));
}

function startLevel(levelId, restoredState = null) {
  const selectedLevel = levelById(Number(levelId));
  if (!selectedLevel) return;
  startGame(selectedLevel, restoredState);
}

function startDaily(restoredState = null) {
  startGame(createDailyLevel(todayKey()), restoredState);
}

function startGame(nextLevel, restoredState = null) {
  clearHint();
  level = nextLevel;
  document.body.dataset.orbitTheme = level.theme ?? "aurora";
  renderer.setTheme(level.theme ?? "aurora");
  game = createGame(level, restoredState);
  initialState = game.initialState;
  resultShown = false;
  resultLayer.hidden = true;
  resetLayer.hidden = true;
  lastRenderedMoves = 0;
  lastRenderedCompleted = 0;
  playScreen.classList.add("is-active");
  selectScreen.hidden = true;
  const levelNode = document.querySelector("#level-label");
  if (levelNode) {
    if (level.today === true || level.id === "daily") {
      levelNode.textContent = `今日挑战${level.dateKey ? " · " + level.dateKey : ""}`;
    } else {
      levelNode.textContent = `第 ${level.id} 关`;
    }
  }
  render();
  message("选择轨道入口，将星体调入星核", "info");
  if (!restoredState && level.id === 1) {
    const firstTrack = game.state.tracks.find((track) => canExtract(game.state, track.id));
    renderer.showGuide(firstTrack?.id);
  }
}

function showLevelSelect() {
  if (!game || !selectScreen || !playScreen) return;
  clearHint();
  playScreen.classList.remove("is-active");
  selectScreen.hidden = false;
  renderSelect();
  dailyButton?.focus();
}

function showLevelInfo() {
  if (!level || !levelInfoLayer || !levelInfoText) return;
  const difficulty = difficultyForLevel(level);
  const tracks = level.tracks?.length ?? 0;
  const capacity = level.capacity ?? "-";
  const docks = level.dockCount ?? level.docks?.length ?? "-";
  levelInfoText.textContent = level.id === "daily"
    ? `今日挑战 · ${level.dateKey ?? todayKey()} · 难度 D${difficulty} · ${tracks} 条轨道 · 容量 ${capacity} · 中转槽 ${docks} · 目标 ${level.par} 步`
    : `第 ${level.id} 关 · 难度 D${difficulty} · ${tracks} 条轨道 · 容量 ${capacity} · 中转槽 ${docks} · 目标 ${level.par} 步`;
  openDialog(levelInfoLayer, levelInfoButton, levelInfoCloseButton);
}

function showResult() {
  if (resultShown) return;
  resultShown = true;
  const movesPlayed = game.state?.stats?.movesPlayed | 0 || game.state.moves | 0;
  // 通关那一刻的时间戳为计分终点
  const finalScore = estimateLiveScore({ level, state: game.state, isDaily: level.id === "daily" });
  const detail = {
    scoreDetail: {
      total: finalScore.total,
      base: finalScore.base,
      move: finalScore.move,
      time: finalScore.time,
      par: finalScore.par,
      difficulty: finalScore.difficulty,
      stars: finalScore.stars,
    },
    movesPlayed,
    elapsedMs: finalScore.elapsedMs,
    moves: movesPlayed,
  };
  const isDailyGame = (level.today === true || level.id === "daily");
  const completion = isDailyGame
    ? recordDailyCompletion(progress, level.dateKey ?? todayKey(), detail)
    : recordCompletion(progress, level, detail);
  progress = completion.progress;
  latestCompletedLevel = isDailyGame ? null : level.id;

  const perfect = perfectScoreForLevel(level, isDailyGame);
  const totalFinal = completion.scoreDetail?.score ?? finalScore.total;

  // —— 顶部标题行（去掉 ★★★，改成「得分 / 本题总分」+ 步数）
  const titleText = isDailyGame
    ? `🏆 今日挑战 · ${level.dateKey ?? todayKey()} · 得分 ${totalFinal} / ${perfect} · 步数 ${movesPlayed}`
    : `得分 ${totalFinal} / ${perfect} · 步数 ${movesPlayed} / ${level.par}${completion.isNewHighScore ? " · 🏆 新高分！" : completion.isNewBest ? " · 新纪录" : ""}`;
  resultScore.textContent = titleText;
  // (通关页也不再显示星条：renderStars(null) 隐藏)
  renderStars(null);

  // —— 积分明细(基础/步数/时间/合计)
  if (resultBreakdown) {
    const rows = {
      base: completion.scoreDetail?.base ?? finalScore.base,
      move: completion.scoreDetail?.move ?? finalScore.move,
      time: completion.scoreDetail?.time ?? finalScore.time,
      total: completion.scoreDetail?.score ?? finalScore.total,
    };
    for (const [k, v] of Object.entries(rows)) {
      const el = resultBreakdown.querySelector(`.wb-val[data-k="${k}"]`);
      if (el) el.textContent = String(v);
    }
  }
  // —— 元信息文本（步数说明、时间说明、总积分累计）
  if (resultMeta) {
    const elapsedSec = Math.floor(finalScore.elapsedMs / 1000);
    const tmax = finalScore.tmax;
    const mmax = finalScore.mmax;
    const badge = completion.isNewHighScore ? "🏆 新高分 · " : "";
    const totalHint = `累计总积分 ${progress.totalScore | 0}`;
    const moveNote = movesPlayed <= mmax ? `步数满分 (≤${mmax})` : `超满分步数 ${movesPlayed - mmax} 步`;
    const timeNote = elapsedSec <= tmax ? `时间满分 (≤${tmax}s)` : `用时 ${elapsedSec}s (满分≤${tmax}s)`;
    resultMeta.textContent = `${badge}${moveNote} · ${timeNote} · ${totalHint}`;
  }
  nextButton.hidden = isDailyGame || level.id >= LEVELS.at(-1).id;
  openDialog(resultLayer, againButton, nextButton.hidden ? againButton : nextButton);
}

function renderStars(count) {
  resultStars.replaceChildren();
  if (count === null) return;
  for (let index = 0; index < 3; index += 1) {
    const star = document.createElement("span");
    star.className = "win-star";
    star.dataset.filled = String(index < count);
    star.textContent = "★";
    resultStars.append(star);
  }
}

function transition(next, sound, transfer) {
  const completedTrackIds = next.tracks
    .filter((track, index) => track.completed && !game.state.tracks[index].completed)
    .map((track) => track.id);
  const thawedTrackIds = next.tracks
    .filter((track, index) => game.state.tracks[index].mode === "frozen" && track.mode === "normal")
    .map((track) => track.id);
  // next IS the authoritative game.state after dispatch/undo/reset. Write it
  // through the game setter so even if a reference ever diverged we lock back.
  game.setState(next);
  clearHint();
  renderer.clearGuide();
  render();
  if (transfer) renderer.showTransfer(transfer);
  for (const trackId of completedTrackIds) renderer.showCompletion(trackId);
  for (const trackId of thawedTrackIds) renderer.showUnfreeze(trackId);
  if (completedTrackIds.length > 0) {
    haptic([18, 44, 26]);
    audio.play("complete");
  } else if (sound) {
    haptic(sound === "extract" ? [12] : [10]);
    audio.play(sound);
  }
  if (thawedTrackIds.length > 0) audio.play("unfreeze");
  if (next.status === "won") {
    haptic([24, 50, 24, 50, 64]);
    showResult();
  }
  // Deadlock is a post-move state, not an illegal action. Keep the board and
  // controls available so the player can inspect, undo, or reset without a modal
  // overlay masking the authoritative rule result.
  if (next.status === "stuck") {
    message("当前无后续调度；刚才的移动符合规则，可撤销或重置", "warn");
  }
  if (next.status === "playing") progress = saveCurrentGame(progress, game.state);
  requestSolvabilityCheck(next);
}

hintWorker.addEventListener("message", ({ data }) => {
  if (data.kind === "solvability") {
    if (data.requestId !== advisoryRequestId) return;
    if (data.status === "exhausted") {
      message("当前局面无法通关，建议撤销最近一步重新规划", "bad");
    }
    return;
  }
  if (data.requestId !== hintRequestId) return;
  hintButton.disabled = false;
  const action = data.actions?.[0];
  if (data.status !== "solved" || !action) return message("先撤销最近一步试试", "info");
  if (action.type === "insert") {
    renderer.highlightTrack(action.trackId);
    game.useHint();
    progress = saveCurrentGame(progress, game.state);
    return message("已标出推荐目标轨道", "info");
  }
  const target = data.actions[1];
  hint = { targetTrackId: target?.type === "insert" ? target.trackId : null, expiresAt: performance.now() + 3_000 };
  renderer.highlightTrack(action.trackId);
  message("已标出推荐调入轨道", "info");
});

hintWorker.addEventListener("error", () => {
  hintButton.disabled = false;
  message("提示暂时不可用，请先自行尝试", "warn");
});

function requestHint() {
  if (!game?.state || game.state.status !== "playing") return;
  if (hint && hint.targetTrackId !== null && performance.now() < hint.expiresAt) {
    renderer.highlightTrack(hint.targetTrackId);
    game.useHint();
    progress = saveCurrentGame(progress, game.state);
    hint = null;
    return message("已标出推荐目标轨道", "info");
  }
  clearHint();
  hintButton.disabled = true;
  hintRequestId += 1;
  hintWorker.postMessage({ requestId: hintRequestId, state: game.state });
  message("正在推演可行调度", "info");
}

function dockSignatures(list) {
  return list.map((d, i) => `${i}:${d.unlocked ? "U" : "L"}${d.orb?.color ?? "_"}${d.id}`).join("|");
}

// Click-time safety net: even though there is no longer a separate state
// mirror, confirm the selected dock pointer lines up with the actual dock
// contents before we route the intent. Any mismatch is logged and surfaced
// as info guidance instead of a rule-violation flash.
function ensurePreclickCoherence(caller) {
  if (!game?.state) return;
  const gs = game.state;
  if (gs.selectedDockId === null || gs.selectedDockId === undefined) return;
  const wantId = Number(gs.selectedDockId);
  const target = gs.docks.find((d) => Number(d.id) === wantId);
  if (target && target.orb) return;
  if (typeof console !== "undefined") {
    console.warn(
      `[orbit-sort] ${caller}: selectedDockId mismatch — id=`,
      gs.selectedDockId,
      "target.exists=",
      Boolean(target),
      "target.orb=",
      target?.orb,
      "docks=",
      dockSignatures(gs.docks),
    );
  }
}

function chooseTrack(trackId) {
  audio.activate();
  ensurePreclickCoherence("chooseTrack.pre");
  const result = game.dispatch({ target: "track", id: trackId });
  if (!result.valid) {
    ensurePreclickCoherence("chooseTrack.fail");
    // Stuck board: a failed click is never productive; drop the harsh tone
    // and keep the stuck message visible so the player reaches for undo/reset.
    if (game.state.status === "stuck") {
      message("当前无后续调度，建议撤销最近一步或重置本关", "warn");
      return;
    }
    // Placing mode but the landing target is also a valid extraction: the
    // player likely intended to extract from this track instead of landing.
    // Explain the switch instead of flashing a rule violation.
    if (result.action?.type === "insert" && canExtract(game.state, trackId)) {
      message("当前是放入模式；若要从这条轨道取出，请先再次点击中转槽取消选中", "info");
      return;
    }
    renderer.flashTrack(trackId);
    audio.play("invalid");
    haptic([26]);
    message(result.message, "bad");
    return;
  }
  const next = result.state;
  // applyIntent may fall back between extract and insert. Its resolved action,
  // not the state after dispatch, is the only reliable source for animation.
  const wasExtracting = result.action?.type === "extract";
  const dockId = wasExtracting ? next.selectedDockId : result.action?.dockId;
  transition(
    next,
    wasExtracting ? "extract" : "insert",
    wasExtracting ? { fromTrackId: trackId, toDockId: dockId } : { fromDockId: dockId, toTrackId: trackId },
  );
}

function chooseDock(dockId) {
  audio.activate();
  ensurePreclickCoherence("chooseDock.pre");
  const result = game.dispatch({ target: "dock", id: dockId });
  if (!result.valid) ensurePreclickCoherence("chooseDock.fail");
  if (result.action.type === "clear-selection" && result.valid) {
    render();
    if (game.state.status === "stuck") {
      message("已切回取出模式；当前局面无后续调度，可撤销或重置", "warn");
    } else {
      message("已切换为取出模式，可继续调入另一颗星体", "info");
    }
    return;
  }
  if (!result.valid) {
    if (game.state.status === "stuck") {
      message("当前无后续调度，建议撤销最近一步或重置本关", "warn");
      return;
    }
    if (result.reason === "no-selection") {
      message("当前已是取出模式，直接点击轨道入口即可调入星体", "info");
      return;
    }
    renderer.flashDock(dockId);
    audio.play("invalid");
    haptic([26]);
    message(result.message, "bad");
    return;
  }
  transition(result.state, "insert");
}

const renderer = createBoardRenderer(board, { onTrack: chooseTrack, onDock: chooseDock });
renderSoundButton();

undoButton.addEventListener("click", () => {
  audio.activate();
  const previous = game.state;
  const next = game.undo();
  if (next !== previous) {
    clearHint();
    renderer.clearGuide();
    transition(next, null);
    progress = saveCurrentGame(progress, game.state);
    haptic([14]);
    message("已撤销一次调度", "info");
  }
});

resetButton.addEventListener("click", () => {
  audio.activate();
  openDialog(resetLayer, resetButton, resetCancelButton);
});

function confirmReset() {
  clearHint();
  renderer.clearGuide();
  const fresh = game.reset();
  transition(fresh, null);
  progress = saveCurrentGame(progress, game.state);
  resetLayer.hidden = true;
  haptic([14]);
  if (level.id === 1) {
    const firstTrack = game.state.tracks.find((track) => canExtract(game.state, track.id));
    renderer.showGuide(firstTrack?.id);
  }
  message("已重置本关", "info");
}

resetConfirmButton && resetConfirmButton.addEventListener("click", confirmReset);
resetCancelButton && resetCancelButton.addEventListener("click", () => closeDialog(resetLayer));
hintButton && hintButton.addEventListener("click", requestHint);

soundButton && soundButton.addEventListener("click", () => {
  audio.activate();
  const soundOn = audio.toggle();
  progress = saveSoundPreference(progress, soundOn);
  renderSoundButton(soundOn);
  if (soundOn) audio.play("insert");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (resetLayer && !resetLayer.hidden) return closeDialog(resetLayer);
    if (levelInfoLayer && !levelInfoLayer.hidden) return closeDialog(levelInfoLayer);
    if (resultLayer && !resultLayer.hidden) {
      resultLayer.hidden = true;
      playScreen && playScreen.classList.remove("is-active");
      selectScreen && (selectScreen.hidden = false);
      renderSelect();
      return dailyButton && dailyButton.focus();
    }
  }
  if (!game?.state || !playScreen?.classList.contains("is-active")) return;
  if (event.defaultPrevented || event.altKey || event.metaKey) return;
  if (event.key >= "1" && event.key <= "8") {
    const track = game.state.tracks[Number(event.key) - 1];
    if (track) chooseTrack(track.id);
  } else if (event.key === "[") {
    const occupied = game.state.docks.filter((dock) => dock.orb);
    if (occupied.length > 0) chooseDock(occupied.at(-1).id);
  } else if (event.key === "]") {
    const occupied = game.state.docks.filter((dock) => dock.orb);
    if (occupied.length > 0) chooseDock(occupied[0].id);
  } else if (event.key.toLowerCase() === "z" && undoButton) {
    event.preventDefault();
    undoButton.click();
  } else if (event.key.toLowerCase() === "r" && resetButton) {
    resetButton.click();
  } else if (event.key.toLowerCase() === "h" && hintButton) {
    hintButton.click();
  }
});

nextButton && nextButton.addEventListener("click", () => startLevel(level.id + 1));
againButton && againButton.addEventListener("click", () => {
  const isDaily = level.today === true || level.id === "daily";
  if (isDaily) startDaily(); else startLevel(level.id);
});
continueButton && continueButton.addEventListener("click", () => startLevel(progress.currentGame.levelId, progress.currentGame.state));
dailyButton && dailyButton.addEventListener("click", () => startDaily());
continueDailyButton && continueDailyButton.addEventListener("click", () => startDaily(progress.daily.currentGame));
levelSelectButton && levelSelectButton.addEventListener("click", showLevelSelect);
levelInfoButton && levelInfoButton.addEventListener("click", showLevelInfo);
levelInfoCloseButton && levelInfoCloseButton.addEventListener("click", () => closeDialog(levelInfoLayer));
// 游戏内「今日挑战」按钮（位于工具按钮下方）：点击直接开启当日挑战
const challengeButton = document.querySelector("#challenge-button");
challengeButton && challengeButton.addEventListener("click", () => {
  // 如果已经在玩今日挑战且有保存进度，则继续该局（用户按此按钮可能只想"回到/切换到"今日挑战）
  const saved = progress.daily?.currentGame;
  const tKey = todayKey();
  const matchDate = saved && saved.dateKey && saved.dateKey === tKey;
  if (matchDate && isValidStoredState(saved.state)) {
    startDaily(saved);
  } else {
    startDaily();
  }
});
renderSelect();
if (isValidSavedGame(progress.currentGame)) {
  startLevel(progress.currentGame.levelId, progress.currentGame.state);
} else {
  const nextLevelId = Math.min(Math.max(1, progress.unlockedLevel | 0 || 1), LEVELS.length);
  startLevel(nextLevelId);
}
}
