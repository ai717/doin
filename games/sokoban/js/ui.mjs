// filepath: games/sokoban/js/ui.mjs
// 唯一碰 DOM / Canvas 的层：渲染货场（墙/目标/箱/人 + 柔光提示）、HUD 同步、弹层、toast。
// 不持有游戏状态；每次 draw 根据传入 map 全量重绘。

import { DIRS } from "./engine.mjs";
import { LEVELS, CHAPTERS } from "./levels.mjs";
import { formatTime } from "./score.mjs";
import { t, tList, getLocale } from "./i18n.mjs";

const FLOOR_LIGHT = "#8a6a42";
const FLOOR_DARK = "#6f5233";
const WALL_A = "#5a3a1e";
const WALL_B = "#3c2713";
const CRATE_A = "#a96f33";
const CRATE_B = "#6d3f18";
const GOAL_A = "#f2d38c";
const GOAL_B = "#c98f3c";
const GLOW = "rgba(242, 211, 140, 0.55)";
const PLAYER_A = "#e8c080";
const PLAYER_B = "#b98a4e";
const PLAYER_CAP = "#2b1a0c";

// ---------- 渲染器 ----------

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let cell = 48;
  let cols = 0;
  let rows = 0;
  let hintDir = null; // engine.DIRS 下标或 null

  function metrics() {
    return { cell, cols, rows, w: canvas.width, h: canvas.height };
  }

  /** 依据地图尺寸与容器宽度设定画布像素尺寸 */
  function fit(levelCols, levelRows) {
    cols = levelCols;
    rows = levelRows;
    if (typeof window !== "undefined" && window.devicePixelRatio) dpr = Math.min(2, window.devicePixelRatio || 1);
    const wrap = canvas.parentElement ? canvas.parentElement.clientWidth : 560;
    const pad = 20;
    const avail = Math.max(180, wrap - pad);
    const want = Math.min(56, Math.floor(avail / Math.max(cols, 1)));
    const scale = Math.min(1, want / 48);
    cell = Math.max(24, Math.round(48 * scale));
    canvas.width = Math.max(1, cols * cell) * dpr;
    canvas.height = Math.max(1, rows * cell) * dpr;
    canvas.style.width = `${cols * cell}px`;
    canvas.style.height = `${rows * cell}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(map, opts = {}) {
    if (!map) return;
    hintDir = opts.hintDir ?? null;
    fit(map.cols, map.h);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 地板与目标垫
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.cols; x++) {
        const i = y * map.cols + x;
        const px = x * cell, py = y * cell;
        drawFloor(px, py, x, y);
        if (map.goal[i]) drawGoal(px, py, i);
      }
    }
    // 墙（后画覆盖地板边缘）
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.cols; x++) {
        const i = y * map.cols + x;
        if (map.wall[i]) drawWall(x * cell, y * cell);
      }
    }
    // 箱子
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.cols; x++) {
        const i = y * map.cols + x;
        if (map.box[i]) drawCrate(x * cell, y * cell, i, map.goal[i], i === opts.justPushed);
      }
    }
    // 玩家
    if (map.player >= 0) drawPlayer(map.player, map);

    // 提示：玩家旁的柔光箭头
    if (hintDir !== null && map.player >= 0) {
      const d = DIRS[hintDir];
      drawHintArrow(map.player, d);
    }
  }

  function drawFloor(px, py, x, y) {
    ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR_LIGHT : FLOOR_DARK;
    ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
    // 细木纹
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + cell * 0.18, py + cell * 0.3);
    ctx.lineTo(px + cell * 0.78, py + cell * 0.42);
    ctx.stroke();
  }

  function drawWall(px, py) {
    const g = ctx.createLinearGradient(px, py, px, py + cell);
    g.addColorStop(0, WALL_A);
    g.addColorStop(1, WALL_B);
    ctx.fillStyle = g;
    ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
    // 顶缘高光（浮雕感）
    ctx.fillStyle = "rgba(242, 211, 140, 0.14)";
    ctx.fillRect(px + 1, py + 1, cell - 2, 2);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(px + 1, py + cell - 3, cell - 2, 2);
  }

  function drawGoal(px, py, i) {
    const cx = px + cell / 2, cy = py + cell / 2;
    // 无边界径向柔光（核心：径向渐变，不画 stroke）
    const r = cell * 0.42;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(242, 211, 140, 0.5)");
    g.addColorStop(0.55, "rgba(201, 143, 60, 0.22)");
    g.addColorStop(1, "rgba(201, 143, 60, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // 四角星垫（柔和的菱形，非描边圈）
    ctx.fillStyle = GOAL_A;
    const s = cell * 0.17;
    starPath(cx, cy, s, s * 0.42);
    ctx.fill();
    ctx.fillStyle = GOAL_B;
    starPath(cx, cy, s * 0.5, s * 0.22);
    ctx.fill();
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

  function drawCrate(px, py, i, onGoal, justPushed) {
    const cx = px + cell / 2, cy = py + cell / 2;
    const inset = cell * 0.09;
    const r = cell * 0.12;
    if (onGoal) {
      // 暖金光晕（径向渐变柔光，非描边）
      const glowR = cell * 0.62;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      g.addColorStop(0, "rgba(242, 211, 140, 0.45)");
      g.addColorStop(0.6, "rgba(227, 179, 106, 0.16)");
      g.addColorStop(1, "rgba(227, 179, 106, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
    }
    // 软胶圆角木箱
    const g2 = ctx.createLinearGradient(px + inset, py + inset, px + cell - inset, py + cell - inset);
    g2.addColorStop(0, justPushed ? "#c98a44" : CRATE_A);
    g2.addColorStop(1, CRATE_B);
    roundRect(ctx, px + inset, py + inset, cell - inset * 2, cell - inset * 2, r);
    ctx.fillStyle = g2;
    ctx.fill();
    // 顶缘高光 + 底部投影（实体感，不用描边）
    ctx.fillStyle = "rgba(255, 235, 200, 0.22)";
    roundRect(ctx, px + inset + 2, py + inset + 1.5, cell - inset * 2 - 4, cell * 0.16, r * 0.8);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    roundRect(ctx, px + inset, py + cell - inset - 3, cell - inset * 2, 3, 2);
    ctx.fill();
    // 十字捆带（木箱特征）
    ctx.fillStyle = "rgba(43, 26, 12, 0.55)";
    ctx.fillRect(px + cell / 2 - cell * 0.03, py + inset + 2, cell * 0.06, cell - inset * 2 - 4);
    ctx.fillRect(px + inset + 2, py + cell / 2 - cell * 0.03, cell - inset * 2 - 4, cell * 0.06);
  }

  function drawPlayer(pos, map) {
    const x = pos % map.cols, y = Math.floor(pos / map.cols);
    const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
    const onGoal = map.goal[pos] === 1;
    // 脚下柔光
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.5);
    g.addColorStop(0, "rgba(232, 192, 128, 0.4)");
    g.addColorStop(1, "rgba(232, 192, 128, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - cell * 0.5, cy - cell * 0.5, cell, cell);
    // 圆头小人（无描边）
    const bodyR = cell * 0.28;
    const g2 = ctx.createRadialGradient(cx - bodyR * 0.3, cy - bodyR * 0.5, bodyR * 0.2, cx, cy, bodyR);
    g2.addColorStop(0, PLAYER_A);
    g2.addColorStop(1, PLAYER_B);
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
    ctx.fill();
    // 帽檐
    ctx.fillStyle = PLAYER_CAP;
    roundRect(ctx, cx - bodyR * 0.75, cy - bodyR * 0.75, bodyR * 1.5, bodyR * 0.42, bodyR * 0.2);
    ctx.fill();
    if (onGoal) {
      ctx.fillStyle = GOAL_A;
      starPath(cx, cy - bodyR * 1.15, cell * 0.12, cell * 0.05);
      ctx.fill();
    }
  }

  function drawHintArrow(pos, dir) {
    const x = pos % cols, y = Math.floor(pos / cols);
    const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.95);
    g.addColorStop(0, "rgba(242, 211, 140, 0.34)");
    g.addColorStop(1, "rgba(242, 211, 140, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - cell, cy - cell, cell * 2, cell * 2);
    const aLen = cell * 0.4;
    const aW = cell * 0.24;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(dir.dy, dir.dx));
    ctx.fillStyle = GLOW;
    ctx.beginPath();
    ctx.moveTo(aLen * 0.55, 0);
    ctx.lineTo(-aLen * 0.45, aW * 0.5);
    ctx.lineTo(-aLen * 0.2, 0);
    ctx.lineTo(-aLen * 0.45, -aW * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  return { draw, metrics, fit };
}

// ---------- UI 控制器 ----------

export function createUI(handlers = {}) {
  const root = document.getElementById("app");
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
    const ids = ["ov-start", "ov-pause", "ov-win", "ov-levels", "ov-help"];
    for (const id of ids) hide(id);
  }
  function anyOpen() {
    return ["ov-start", "ov-pause", "ov-win", "ov-levels", "ov-help"].some((id) => {
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

  /** 同步 HUD 与进度条（不含时间） */
  function syncHud(view) {
    q("hud-level").textContent = String(view.index + 1);
    q("hud-moves").textContent = String(view.moves);
    q("hud-par").textContent = view.par > 0 ? String(view.par) : "--";
    q("level-name").textContent = view.meta ? view.meta.nameZh : "—";
    q("level-diff").textContent = `${view.meta.chapter} · ${String(view.meta.id).toUpperCase()}`;
    const done = view.boxesOnGoal;
    const total = view.totalBoxes;
    q("progress-fill").style.width = total > 0 ? `${(done / total) * 100}%` : "0%";
    q("progress-label").textContent = `${done}/${total}`;
  }

  function syncTime(view) {
    q("hud-time").textContent = formatTime(view.timeMs);
  }

  function setSoundState(muted) {
    q("btn-sound").setAttribute("aria-pressed", String(!muted));
    q("icon-sound-on").hidden = muted;
    q("icon-sound-off").hidden = !muted;
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
    }, 1600);
  }

  function sr(text) {
    const node = q("sr-status");
    if (node) node.textContent = text;
  }

  /** 渲染选关网格（按章节分组标题 + 关卡格） */
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
      title.textContent = `${ch.lo}–${ch.hi} · ${getLocale() === "zh" ? ch.nameZh : ch.nameEn} · ${getLocale() === "zh" ? ch.mottoZh : ch.mottoEn}`;
      group.appendChild(title);
      const inner = document.createElement("div");
      inner.className = "levels-chapter-grid";
      for (let i = ch.lo - 1; i < ch.hi && i < LEVELS.length; i++) {
        const lv = LEVELS[i];
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "level-cell";
        cell.setAttribute("aria-label", t("aria.levelCard", { n: i + 1, name: lv.nameZh }));
        const unlocked = i < data.unlocked;
        if (!unlocked) {
          cell.classList.add("locked");
          cell.textContent = t("levels.locked");
          cell.disabled = true;
        } else {
          cell.textContent = String(i + 1);
          if (i === view.index) cell.classList.add("current");
          if (data.levels?.[lv.id]?.cleared) cell.classList.add("cleared");
          cell.addEventListener("click", () => handlers.onPickLevel?.(i));
        }
        inner.appendChild(cell);
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
    q("win-newbest").hidden = !result.isNewBest;
    q("win-pushes").textContent = String(view.pushes);
    q("win-par").textContent = String(view.par);
    q("win-time").textContent = formatTime(view.timeMs);
    q("win-score").textContent = String(result.score);
    const best = result.bestLine;
    q("win-best").textContent = best;
    q("btn-next").textContent = t(view.index >= LEVELS.length - 1 ? "win.replay" : "win.next");
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
    toast,
    sr,
    renderLevels,
    showWin,
  };
}
