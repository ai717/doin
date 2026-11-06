// filepath: games/ice-slide/js/ui.mjs
// 唯一碰 DOM / Canvas 的层：渲染冰封湖面（冰脊墙/补给箱/灯标/科考员/冰晶轨迹）、
// HUD 同步、弹层、toast。不持有游戏状态；每次 draw 根据传入 map 全量重绘。
// 视窗隐喻（PRD §4.2）：Canvas 2D 冰面棋盘 + DOM/CSS 极地场景框体，HUD 全部留 DOM 层。
// 滑行动画在渲染层补间（engine 是原子回合结算，与此彻底分离）。

import { DIRS } from "./engine.mjs";
import { LEVELS, CHAPTERS } from "./levels.mjs";
import { formatTime, starsFor, twoStarThreshold } from "./score.mjs";
import { t, tList, getLocale } from "./i18n.mjs";

// ---------- 极地配色 ----------
const ICE_A = "#e9f5fb";
const ICE_B = "#d8ecf5";
const ICE_CRACK = "rgba(90, 150, 185, 0.16)";
const WALL_FACE = "#8fc3de";
const WALL_TOP = "#d8f0fa";
const WALL_BOTTOM = "#3d7a9d";
const WALL_EDGE = "rgba(20, 60, 90, 0.35)";
const CRATE_A = "#3d84a3";
const CRATE_B = "#245c78";
const CRATE_TOP = "rgba(255, 255, 255, 0.34)";
const CRATE_STRAP = "#f0b04a";
const BEACON_GLOW = "rgba(96, 240, 214, 0.5)";
const BEACON_CORE = "#7ef0dc";
const BEACON_DARK = "#17384c";
const PLAYER_A = "#ff8540";
const PLAYER_B = "#e85a1f";
const PLAYER_CAP = "#17384c";
const TRAIL = "rgba(150, 225, 250, 0.5)";
const HINT_GLOW = "rgba(126, 240, 220, 0.32)";

function reducedMotion() {
  try {
    return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ---------- 渲染器 ----------

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let cell = 44;
  let cols = 0;
  let rows = 0;
  let anim = null; // { t0, dur, last }
  let shake = 0; // 撞墙震动剩余毫秒
  let sparkles = []; // 冰晶迸溅粒子

  function fit(mapCols, mapRows) {
    cols = mapCols;
    rows = mapRows;
    if (typeof window !== "undefined" && window.devicePixelRatio) dpr = Math.min(2, window.devicePixelRatio || 1);
    const wrap = canvas.parentElement ? canvas.parentElement.clientWidth : 560;
    const pad = 24;
    const avail = Math.max(180, wrap - pad);
    const want = Math.min(58, Math.floor(avail / Math.max(cols, 1)));
    const scale = Math.min(1, want / 48);
    cell = Math.max(24, Math.round(48 * scale));
    canvas.width = Math.max(1, cols * cell) * dpr;
    canvas.height = Math.max(1, rows * cell) * dpr;
    canvas.style.width = `${cols * cell}px`;
    canvas.style.height = `${rows * cell}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 启动一次滑行补间；返回动画总时长 ms（0 = 立即完成） */
  function startAnim(last, opts = {}) {
    const dist = last && last.path ? Math.max(1, last.path.length - 1) : 1;
    if (reducedMotion() || opts.instant) {
      anim = null;
      return 0;
    }
    const dur = Math.min(400, Math.max(130, 110 + dist * 16));
    anim = { t0: performance.now(), dur, last };
    return dur;
  }

  function bump() {
    if (!reducedMotion()) shake = 170;
  }

  function burst(cellIndex) {
    if (reducedMotion()) return;
    const x = (cellIndex % cols) * cell + cell / 2;
    const y = Math.floor(cellIndex / cols) * cell + cell / 2;
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
      sparkles.push({ x, y, vx: Math.cos(a) * (0.4 + Math.random() * 0.8), vy: Math.sin(a) * (0.4 + Math.random() * 0.8), life: 1 });
    }
  }

  /** 逐帧推进动画；返回 true 表示仍在忙（调用方继续 rAF） */
  function frame(now) {
    if (shake > 0) shake = Math.max(0, shake - 16);
    for (const s of sparkles) {
      s.x += s.vx * 2.2;
      s.y += s.vy * 2.2;
      s.life -= 0.05;
    }
    sparkles = sparkles.filter((s) => s.life > 0);
    if (anim && currentMap) {
      const k = Math.min(1, (now - anim.t0) / anim.dur);
      draw(currentMap, { animK: k, last: anim.last });
      if (k >= 1) anim = null;
      return true;
    }
    if (currentMap && (sparkles.length > 0 || shake > 0)) {
      draw(currentMap, { animK: null });
    }
    return sparkles.length > 0 || shake > 0;
  }

  let currentMap = null;
  let hintDir = null;

  function draw(map, opts = {}) {
    if (!map) return;
    currentMap = map;
    hintDir = opts.hintDir ?? null;
    fit(map.cols, map.h);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (shake > 0) {
      const amp = (shake / 170) * 2;
      ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
    }

    const k = opts.animK ?? null;
    const last = opts.last ?? null;

    // 冰面与灯标
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.cols; x++) {
        const i = y * map.cols + x;
        drawFloor(x * cell, y * cell, x, y, i);
        if (map.goal[i]) drawBeacon(x * cell, y * cell, i, map.box[i] === 1);
      }
    }
    // 冰脊墙
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.cols; x++) {
        const i = y * map.cols + x;
        if (map.wall[i]) drawWall(x * cell, y * cell);
      }
    }
    // 冰晶滑行轨迹（动画中与刚结束时渐隐）
    if (last && last.path && last.path.length > 1 && k !== null) drawTrail(last.path, k);
    // 箱子（动画中插值：终局箱位 = boxTo，从 boxFrom 滑来）
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.cols; x++) {
        const i = y * map.cols + x;
        if (!map.box[i]) continue;
        const moving = k !== null && last && last.boxFrom >= 0 && last.boxTo === i;
        if (moving) {
          const from = cellPos(last.boxFrom);
          const to = cellPos(last.boxTo);
          drawCrate(lerp(from.x, to.x, k), lerp(from.y, to.y, k), i, map.goal[i] === 1);
        } else {
          drawCrate(x * cell, y * cell, i, map.goal[i] === 1);
        }
      }
    }
    // 科考员（动画中插值）
    if (map.player >= 0) {
      if (k !== null && last) {
        const from = cellPos(last.playerFrom);
        const to = cellPos(last.playerTo);
        const ex = lerp(from.x, to.x, k);
        const ey = lerp(from.y, to.y, k);
        drawPlayer(ex, ey, map, last.dir);
      } else {
        drawPlayer((map.player % map.cols) * cell, Math.floor(map.player / map.cols) * cell, map, map.last ? map.last.dir : null);
      }
    }
    // 冰晶迸溅粒子
    for (const s of sparkles) {
      ctx.fillStyle = `rgba(220, 248, 255, ${0.8 * s.life})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.6 * s.life + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // 提示柔光箭头
    if (hintDir !== null && map.player >= 0) drawHintArrow(map.player, DIRS[hintDir]);
    ctx.restore();
  }

  function cellPos(i) {
    return { x: (i % cols) * cell, y: Math.floor(i / cols) * cell };
  }
  function lerp(a, b, k) {
    return a + (b - a) * k;
  }

  function drawFloor(px, py, x, y, i) {
    ctx.fillStyle = (x + y) % 2 === 0 ? ICE_A : ICE_B;
    ctx.fillRect(px, py, cell, cell);
    // 冰面微光泽（径向柔光，无硬边）
    const cx = px + cell / 2;
    const cy = py + cell / 2;
    const g = ctx.createRadialGradient(cx, cy - cell * 0.2, 0, cx, cy, cell * 0.75);
    g.addColorStop(0, "rgba(255, 255, 255, 0.34)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(px, py, cell, cell);
    // 确定性冰裂细纹（同盘面每次一致）
    if ((i * 2654435761) % 17 === 0) {
      ctx.strokeStyle = ICE_CRACK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + cell * 0.16, py + cell * 0.7);
      ctx.lineTo(px + cell * 0.45, py + cell * 0.4);
      ctx.lineTo(px + cell * 0.8, py + cell * 0.55);
      ctx.stroke();
    }
  }

  function drawWall(px, py) {
    // 冰脊：平涂面 + 顶部受光倒角 + 底部深影 + 外缘冷色暗边（浮雕感，无渐变壳）
    ctx.fillStyle = WALL_FACE;
    ctx.fillRect(px, py, cell, cell);
    ctx.fillStyle = WALL_TOP;
    ctx.fillRect(px, py, cell, Math.max(2, cell * 0.14));
    ctx.fillStyle = WALL_BOTTOM;
    ctx.fillRect(px, py + cell - Math.max(2, cell * 0.16), cell, Math.max(2, cell * 0.16));
    ctx.fillStyle = WALL_EDGE;
    ctx.fillRect(px, py, 1.5, cell);
    ctx.fillRect(px + cell - 1.5, py, 1.5, cell);
    // 脊顶冰晶尖刺（等距确定性）
    const n = 2 + ((px * 7 + py * 13) % 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    for (let s = 0; s < n; s++) {
      const sx = px + ((s * 97 + py) % Math.max(1, cell - 8)) + 4;
      const sy = py + Math.max(3, cell * 0.14) - 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 2.4, sy + 3.4);
      ctx.lineTo(sx - 2.4, sy + 3.4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBeacon(px, py, i, lit) {
    const cx = px + cell / 2;
    const cy = py + cell / 2;
    // 灯标柔光（径向渐变，禁描边圈）
    const r = cell * (lit ? 0.72 : 0.5);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, lit ? "rgba(126, 240, 220, 0.62)" : BEACON_GLOW);
    g.addColorStop(0.6, lit ? "rgba(126, 240, 220, 0.2)" : "rgba(96, 240, 214, 0.18)");
    g.addColorStop(1, "rgba(96, 240, 214, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // 灯标基座 + 灯芯
    ctx.fillStyle = BEACON_DARK;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BEACON_CORE;
    ctx.beginPath();
    ctx.arc(cx, cy - cell * 0.02, cell * (lit ? 0.1 : 0.07), 0, Math.PI * 2);
    ctx.fill();
    if (lit) {
      // 点亮：四向星芒
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      const s = cell * 0.06;
      ctx.fillRect(cx - s * 0.2, cy - cell * 0.3, s * 0.4, cell * 0.14);
      ctx.fillRect(cx - cell * 0.3, cy - s * 0.2, cell * 0.14, s * 0.4);
    }
  }

  function drawCrate(px, py, i, onGoal) {
    const cx = px + cell / 2;
    const cy = py + cell / 2;
    if (onGoal) {
      const glowR = cell * 0.66;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      g.addColorStop(0, "rgba(126, 240, 220, 0.4)");
      g.addColorStop(0.6, "rgba(126, 240, 220, 0.14)");
      g.addColorStop(1, "rgba(126, 240, 220, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
    }
    const inset = cell * 0.1;
    const r = cell * 0.14;
    // 软胶箱体（平涂 + 顶部受光 + 底部投影）
    ctx.fillStyle = CRATE_B;
    roundRect(ctx, px + inset, py + inset + cell * 0.04, cell - inset * 2, cell - inset * 2, r);
    ctx.fill();
    const g2 = ctx.createLinearGradient(px + inset, py + inset, px + cell - inset, py + cell - inset);
    g2.addColorStop(0, CRATE_A);
    g2.addColorStop(1, CRATE_B);
    ctx.fillStyle = g2;
    roundRect(ctx, px + inset, py + inset, cell - inset * 2, cell - inset * 2, r);
    ctx.fill();
    ctx.fillStyle = CRATE_TOP;
    roundRect(ctx, px + inset + 2, py + inset + 1.5, cell - inset * 2 - 4, cell * 0.15, r * 0.7);
    ctx.fill();
    // 琥珀捆带（冰原上的暖色标识）
    ctx.fillStyle = CRATE_STRAP;
    ctx.fillRect(px + cell / 2 - cell * 0.035, py + inset + 2, cell * 0.07, cell - inset * 2 - 4);
    ctx.fillRect(px + inset + 2, py + cell / 2 - cell * 0.035, cell - inset * 2 - 4, cell * 0.07);
    if (onGoal) {
      // 入标确认：箱顶小灯标星
      ctx.fillStyle = BEACON_CORE;
      starPath(cx, cy - cell * 0.34, cell * 0.09, cell * 0.038);
      ctx.fill();
    }
  }

  function drawPlayer(px, py, map, dirId) {
    const cx = px + cell / 2;
    const cy = py + cell / 2;
    // 脚下冰面反光柔晕
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.52);
    g.addColorStop(0, "rgba(255, 160, 90, 0.34)");
    g.addColorStop(1, "rgba(255, 160, 90, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - cell * 0.52, cy - cell * 0.52, cell * 1.04, cell * 1.04);
    const bodyR = cell * 0.27;
    const g2 = ctx.createRadialGradient(cx - bodyR * 0.3, cy - bodyR * 0.5, bodyR * 0.2, cx, cy, bodyR);
    g2.addColorStop(0, PLAYER_A);
    g2.addColorStop(1, PLAYER_B);
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
    ctx.fill();
    // 科考帽（朝向最后滑行方向偏移）
    const d = dirId === null || dirId === undefined ? null : DIRS[dirId];
    const ox = d ? d.dx * bodyR * 0.3 : 0;
    const oy = d ? d.dy * bodyR * 0.3 : 0;
    ctx.fillStyle = PLAYER_CAP;
    roundRect(ctx, cx - bodyR * 0.78 + ox, cy - bodyR * 0.78 + oy, bodyR * 1.56, bodyR * 0.46, bodyR * 0.22);
    ctx.fill();
    if (map.goal[Math.round(cy / cell) * map.cols + Math.round(cx / cell)]) {
      ctx.fillStyle = BEACON_CORE;
      starPath(cx, cy - bodyR * 1.2, cell * 0.11, cell * 0.048);
      ctx.fill();
    }
  }

  function drawTrail(path, k) {
    // 渐隐冰晶轨迹：沿滑行路径的柔光椭圆串
    const alpha = 0.55 * (1 - k * 0.55);
    for (let s = 0; s < path.length; s++) {
      const { x, y } = cellPos(path[s]);
      const fade = 0.35 + (0.65 * s) / Math.max(1, path.length - 1);
      ctx.fillStyle = `rgba(160, 230, 252, ${alpha * fade})`;
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell / 2, cell * 0.22 * fade, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHintArrow(pos, dir) {
    const x = pos % cols;
    const y = Math.floor(pos / cols);
    const cx = x * cell + cell / 2;
    const cy = y * cell + cell / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.95);
    g.addColorStop(0, HINT_GLOW);
    g.addColorStop(1, "rgba(126, 240, 220, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - cell, cy - cell, cell * 2, cell * 2);
    const aLen = cell * 0.4;
    const aW = cell * 0.24;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(dir.dy, dir.dx));
    ctx.fillStyle = "rgba(126, 240, 220, 0.9)";
    ctx.beginPath();
    ctx.moveTo(aLen * 0.55, 0);
    ctx.lineTo(-aLen * 0.45, aW * 0.5);
    ctx.lineTo(-aLen * 0.2, 0);
    ctx.lineTo(-aLen * 0.45, -aW * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function starPath(cx, cy, outer, inner) {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rad = k % 2 === 0 ? outer : inner;
      const ang = (Math.PI / 4) * k - Math.PI / 2;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.lineTo(x + w - r, y + h);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x + w - r, y + h, r);
    c.lineTo(x, y + h);
    c.arcTo(x, y, x + w - r, y, r);
    c.closePath();
  }

  return { draw, startAnim, frame, bump, burst, fit };
}

// ---------- UI 控制器 ----------

export function createUI(handlers = {}) {
  const els = {};

  function q(id) {
    if (!els[id]) els[id] = document.getElementById(id);
    return els[id];
  }

  function show(id) {
    const node = q(id);
    if (node) node.hidden = false;
  }
  function hide(id) {
    const node = q(id);
    if (node) node.hidden = true;
  }
  function hideAll() {
    for (const id of ["ov-pause", "ov-win", "ov-levels", "ov-help"]) hide(id);
  }
  function anyOpen() {
    return ["ov-pause", "ov-win", "ov-levels", "ov-help"].some((id) => {
      const node = q(id);
      return node && !node.hidden;
    });
  }
  function isOpen(id) {
    const node = q(id);
    return !!node && !node.hidden;
  }

  function bumpStat(id) {
    const node = q(id);
    if (!node) return;
    node.classList.remove("bump");
    void node.offsetWidth;
    node.classList.add("bump");
  }

  /** 同步 HUD（步数/最优/星级预览/灯标进度），不含时间 */
  function syncHud(view) {
    q("hud-moves").textContent = String(view.moves);
    q("hud-par").textContent = view.par > 0 ? String(view.par) : "--";
    const stars = starsFor(view.moves, view.par);
    const two = twoStarThreshold(view.par);
    for (let s = 0; s < 3; s++) {
      const node = q(`star-${s}`);
      if (node) node.classList.toggle("on", s < stars);
    }
    // 接近最优时 par 徽记柔光增强
    const parNode = q("hud-par");
    if (parNode) parNode.classList.toggle("near", view.moves > 0 && view.moves <= two);
    const done = view.boxesOnGoal;
    const total = view.totalBoxes;
    q("progress-fill").style.width = total > 0 ? `${(done / total) * 100}%` : "0%";
    q("progress-label").textContent = `${done}/${total}`;
    q("level-name").textContent = t(view.meta.id);
    q("level-chapter").textContent = t(`chapter_${view.meta.chapter}`);
    const badge = q("daily-badge");
    if (badge) badge.hidden = view.mode !== "daily";
    bumpStat("hud-moves");
  }

  function syncTime(view) {
    q("hud-time").textContent = formatTime(view.timeMs);
  }

  function setSoundState(muted) {
    q("btn-sound").setAttribute("aria-pressed", String(!muted));
    q("icon-sound-on").hidden = muted;
    q("icon-sound-off").hidden = !muted;
  }

  /** 模式 Tab 高亮 */
  function setMode(mode) {
    for (const m of ["campaign", "daily", "practice"]) {
      const node = q(`mode-${m}`);
      if (node) node.setAttribute("aria-pressed", String(m === mode));
    }
  }

  /** 方向盘锁（滑行动画期间禁用，防连点吞指令错位） */
  function setPadLocked(locked) {
    const pad = q("slide-pad");
    if (pad) pad.classList.toggle("locked", locked === true);
  }

  let toastTimer = 0;
  function toast(text, kind) {
    const node = q("toast");
    if (!node) return;
    node.textContent = text;
    node.className = "show" + (kind ? ` ${kind}` : "");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      node.className = "";
    }, 1800);
  }

  function sr(text) {
    const node = q("sr-status");
    if (node) node.textContent = text;
  }

  /** 选关网格：按章分组（章名走 i18n key，关卡格带星级） */
  function renderLevels(view, data) {
    const grid = q("levels-grid");
    if (!grid) return;
    grid.textContent = "";
    const clearedCount = data.levels ? Object.keys(data.levels).filter((k) => data.levels[k]?.cleared).length : 0;
    q("levels-total").textContent = t("levels.totals", { total: LEVELS.length, cleared: clearedCount });

    for (const ch of CHAPTERS) {
      const group = document.createElement("div");
      group.className = "levels-chapter";
      const title = document.createElement("div");
      title.className = "levels-chapter-title";
      title.textContent = t(`chapter_${ch.id.slice(2)}`);
      group.appendChild(title);
      const inner = document.createElement("div");
      inner.className = "levels-chapter-grid";
      for (let i = ch.lo - 1; i < ch.hi && i < LEVELS.length; i++) {
        const lv = LEVELS[i];
        const cellNode = document.createElement("button");
        cellNode.type = "button";
        cellNode.className = "level-cell";
        cellNode.setAttribute("aria-label", t("aria.levelCard", { n: i + 1, name: t(lv.id) }));
        const unlocked = i < data.unlocked;
        if (!unlocked) {
          cellNode.classList.add("locked");
          cellNode.textContent = "🔒";
          cellNode.disabled = true;
        } else {
          const num = document.createElement("span");
          num.className = "level-num";
          num.textContent = String(i + 1);
          cellNode.appendChild(num);
          const rec = data.levels?.[lv.id];
          if (rec?.cleared) {
            cellNode.classList.add("cleared");
            const stars = document.createElement("span");
            stars.className = "level-stars";
            stars.textContent = "★".repeat(rec.stars);
            cellNode.appendChild(stars);
          }
          if (i === view.index) cellNode.classList.add("current");
          cellNode.addEventListener("click", () => handlers.onPickLevel?.(i));
        }
        inner.appendChild(cellNode);
      }
      group.appendChild(inner);
      grid.appendChild(group);
    }
  }

  /** 结算面板 */
  function showWin(view, result) {
    const starsNode = q("win-stars");
    for (let s = 0; s < 3; s++) {
      const star = starsNode.children[s];
      if (star) star.classList.toggle("on", s < result.stars);
    }
    q("win-perfect").hidden = result.stars < 3;
    q("win-newbest").hidden = !result.isNewBest;
    q("win-moves").textContent = String(view.moves);
    q("win-par").textContent = String(view.par);
    q("win-time").textContent = formatTime(view.timeMs);
    q("win-best").textContent = result.bestLine || "";
    const isDaily = view.mode === "daily";
    q("win-daily-done").hidden = !isDaily;
    const nextBtn = q("btn-next");
    if (nextBtn) {
      nextBtn.textContent = t(view.index >= LEVELS.length - 1 || isDaily ? "win.replay" : "win.next");
    }
    show("ov-win");
  }

  return {
    show,
    hide,
    hideAll,
    anyOpen,
    isOpen,
    syncHud,
    syncTime,
    setSoundState,
    setMode,
    setPadLocked,
    toast,
    sr,
    renderLevels,
    showWin,
  };
}
