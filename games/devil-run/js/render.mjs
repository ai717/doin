// 恶魔迷途 · 渲染层（Canvas 2D，唯一碰画面的层）
//
// 视觉语言：黑白几何剪纸舞台 + 渗出的橙红光晕 + 恶魔紫雾。
// 硬性红线遵守：
//   - 主体可读性一律用 createRadialGradient 径向柔光（由内渐隐到 rgba(...,0)），
//     绝不用 stroke 描边圈 —— 描边不论多柔都会被读成"救生圈"，视觉立刻廉价化。
//   - 陷阱前兆（telegraph）必须可见：这是"有前兆的幽默"设计（拍板项 1A）的落地点，
//     也是本作从"恶意"变成"机关喜剧"的关键。
//   - 动效在 reducedMotion 下全部瞬移降级。
//
// 本层只读 game.getSummary()，绝不回写规则状态。

import { T } from "./engine.mjs";
import { getLevel } from "./levels.mjs";

const TAU = Math.PI * 2;

// ---- 调色板：靛蓝夜舞台 + 橙红机关光 ----
const C = {
  bgTop: "#0d1024",
  bgBot: "#1b1030",
  glowWarm: "rgba(255,96,48,",     // 陷阱/机关的橙红
  glowCool: "rgba(120,140,255,",   // 环境冷光
  glowDemon: "rgba(168,64,192,",   // 恶魔紫
  solid: "#f2f4ff",                // 可站立地砖的亮面
  solidSide: "#8c93c4",
  solidDeep: "#3b3f6b",
  spike: "#ff5a3c",
  lava: "#ff4d2e",
  candle: "#ffd166",
  goal: "#7ee8c8",
  goalGone: "#5a5f86",
  player: "#ffffff",
  mark: "rgba(168,64,192,0.55)",
};

// 地砖配色按行轻微变化，制造剪纸层次而不喧宾夺主
function tileTint(col, row) {
  const h = ((col * 7 + row * 13) % 5) / 5;
  return h;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// 圆角矩形路径
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

// 径向柔光：唯一被允许的主体标记手法（替代描边圈）
function glow(ctx, cx, cy, radius, rgbPrefix, alpha, inner = 0) {
  const g = ctx.createRadialGradient(cx, cy, Math.max(0.01, radius * inner), cx, cy, radius);
  g.addColorStop(0, `${rgbPrefix}${alpha})`);
  g.addColorStop(0.45, `${rgbPrefix}${alpha * 0.42})`);
  g.addColorStop(1, `${rgbPrefix}0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
}

export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext("2d", { alpha: false });
  let dpr = 1;
  let vw = 800;
  let vh = 520;
  let cell = 32;
  let originX = 0;
  let originY = 0;
  let time = 0;
  let reduced = !!options.reducedMotion;

  // 粒子与浮尘（纯表现层，与规则无关）
  let dust = [];
  const sparks = [];
  const ripples = [];

  function seedDust() {
    dust = [];
    const count = reduced ? 0 : 42;
    for (let i = 0; i < count; i += 1) {
      dust.push({
        x: Math.random() * vw,
        y: Math.random() * vh,
        r: 0.5 + Math.random() * 1.7,
        sp: 4 + Math.random() * 11,
        ph: Math.random() * TAU,
        a: 0.05 + Math.random() * 0.14
      });
    }
  }

  // 关卡尺寸变化时重算缩放，整数对齐确保绝对锐利不发虚
  function layout(cols, rows) {
    const padX = 24;
    const padY = 24;
    const availW = Math.max(120, vw - padX * 2);
    const availH = Math.max(120, vh - padY * 2);
    // 强制整数像素格长，杜绝浮点数子像素插值模糊
    cell = Math.max(16, Math.floor(Math.min(availW / cols, availH / rows)));
    const stageW = cell * cols;
    const stageH = cell * rows;
    originX = Math.round((vw - stageW) / 2);
    originY = Math.round((vh - stageH) / 2);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width || canvas.clientWidth || 800));
    const h = Math.max(200, Math.round(rect.height || canvas.clientHeight || 520));
    dpr = Math.min(3, Math.max(1, (globalThis.devicePixelRatio || 1)));
    vw = w;
    vh = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false; // 锐利几何微立体，杜绝模糊插值
    seedDust();
  }

  // ---- 背景：深邃纯净的赛博午夜舞台 ----
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, "#090b1c");
    g.addColorStop(0.6, "#11142e");
    g.addColorStop(1, "#181a38");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // 舞台中央清澈微聚光
    const stageCx = originX + (cell * 10);
    const stageCy = originY + (cell * 6.5);
    glow(ctx, stageCx, stageCy, Math.max(vw, vh) * 0.45, "rgba(80,105,210,", 0.09);

    // 纯白清晰微小尘埃
    for (const d of dust) {
      const y = reduced ? d.y : (d.y - time * d.sp * 3) % vh;
      const yy = y < 0 ? y + vh : y;
      ctx.globalAlpha = d.a * 0.8;
      ctx.fillStyle = "#c8d4ff";
      ctx.beginPath();
      ctx.arc(d.x, yy, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- 地砖：极高对比度、绝对锐利硬朗的街机微立体方块 ----
  function drawSolid(row, col, x, y, s, alpha) {
    ctx.globalAlpha = alpha;
    const rx = Math.round(x);
    const ry = Math.round(y);
    const sz = Math.round(s);

    // 砖块间 1px 黑色微缝（在暗背景下清晰切分每块地砖）
    const bx = rx + 1;
    const by = ry + 1;
    const bw = sz - 2;
    const bh = sz - 2;
    const th = Math.max(3, Math.round(sz * 0.16)); // 立体侧面厚度

    // 1) 深邃立体阴影底座（#1b2238）
    ctx.fillStyle = "#1b2238";
    ctx.fillRect(bx, by, bw, bh);

    // 2) 纯净亮白微蓝高对比切面（#f0f4ff，无论多远都极度清晰可见！）
    ctx.fillStyle = "#f0f4ff";
    ctx.fillRect(bx, by, bw, bh - th);

    // 3) 顶面 1px 纯白极锐高光（#ffffff）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bx, by, bw, 2);

    // 4) 亮面与暗面交界细线（#a8b8d8）
    ctx.fillStyle = "#a8b8d8";
    ctx.fillRect(bx, by + bh - th - 1, bw, 1);

    ctx.globalAlpha = 1;
  }

  // ---- 尖刺：刀锋般锐利血红尖刺，绝对像素对齐，高对比度 ----
  function drawSpikeCell(x, y, s, progress, kind) {
    const rise = clamp01(progress);
    if (rise <= 0.04) return;

    const rx = Math.round(x);
    const ry = Math.round(y);
    const sz = Math.round(s);
    const h = Math.round(sz * 0.65 * rise);
    const baseY = ry + sz - 1;
    const isLava = kind === "lava";

    if (isLava) {
      ctx.fillStyle = "#ff3b1e";
      ctx.fillRect(rx + 1, baseY - Math.round(sz * 0.35), sz - 2, Math.round(sz * 0.35));
      ctx.fillStyle = "#ffe24a";
      ctx.fillRect(rx + 2, baseY - Math.round(sz * 0.35), sz - 4, 2);
      return;
    }

    // 3 个极其锋利的几何三角刺
    const teeth = 3;
    const tw = sz / teeth;

    // 1) 鲜红刺身（#ff284d）
    ctx.fillStyle = "#ff284d";
    ctx.beginPath();
    for (let i = 0; i < teeth; i += 1) {
      const tx = rx + i * tw;
      ctx.moveTo(tx + 1, baseY);
      ctx.lineTo(tx + tw * 0.5, baseY - h);
      ctx.lineTo(tx + tw - 1, baseY);
    }
    ctx.closePath();
    ctx.fill();

    // 2) 锋刃高光棱线（#ffe6ea，1px 纯净亮白刃）
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    for (let i = 0; i < teeth; i += 1) {
      const tx = rx + i * tw;
      ctx.moveTo(tx + tw * 0.5 - 0.5, baseY);
      ctx.lineTo(tx + tw * 0.5, baseY - h);
      ctx.lineTo(tx + tw * 0.5 + 0.5, baseY);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ---- 陷阱按种类绘制专属视觉 ----
  function drawTrap(tr) {
    const x = originX + tr.col * cell;
    const y = originY + tr.row * cell;
    const s = cell;
    const st = tr.state;
    const span = Math.max(1, tr.span || 1);
    const w = s * span;

    switch (tr.kind) {
      case "collapse":
      case "fake":
      case "vanish": {
        // 塌陷/伪装/消失：地砖本身在"摇晃"或"淡出"
        let alpha = 1;
        let shake = 0;
        if (tr.kind === "fake") {
          // 伪装砖：看上去完好，触发瞬间裂开
          alpha = st === "gone" || st === "spent" ? 0 : 1;
          if (st === "active" && !reduced) shake = Math.sin(time * 60) * s * 0.06;
        } else if (tr.kind === "collapse") {
          if (st === "armed") { alpha = 1; if (!reduced) shake = Math.sin(time * 26) * s * 0.035; }
          else if (st === "active") alpha = 0.5;
          else if (st === "gone" || st === "spent") alpha = 0;
        } else {
          if (st === "gone" || st === "spent") alpha = 0;
          else if (st === "active") alpha = 0.6;
        }
        if (alpha <= 0) return;
        // 前兆：地砖下方渗出红光
        if (st === "armed") {
          glow(ctx, x + w / 2, y + s * 0.8, w * 0.95, C.glowWarm, 0.3);
        }
        drawSolid(tr.row, tr.col, x + shake, y, s, alpha);
        if (span > 1) {
          for (let i = 1; i < span; i += 1) {
            drawSolid(tr.row, tr.col + i, x + i * s + shake, y, s, alpha);
          }
        }
        break;
      }
      case "spike":
      case "ghostspike": {
        // 隐形尖刺：前兆极弱，露出时才惊到玩家（但绝不无预警致死）
        const prog = st === "active" || st === "spent" ? 1 : st === "armed" ? 0.35 : 0;
        drawSolid(tr.row, tr.col, x, y, s, 1);
        if (tr.kind === "ghostspike" && prog < 1) {
          // 只给一点点微光提示，不显形
          glow(ctx, x + s * 0.5, y + s * 0.85, s * 0.7, C.glowWarm, 0.14);
          break;
        }
        drawSpikeCell(x, y, s, prog, "spike");
        break;
      }
      case "ceiling": {
        // 天花板：先抖，再整块砸下
        drawSolid(tr.row, tr.col, x, y, s, 1);
        const prog = st === "active" || st === "spent" ? 1 : st === "armed" ? 0.15 : 0;
        if (prog > 0) {
          const blockH = s * 0.9;
          const fall = prog * s * 1.6;
          glow(ctx, x + s * 0.5, y + fall + blockH * 0.5, s * 1.1, C.glowWarm, 0.3);
          ctx.fillStyle = "#e8ebff";
          roundRect(ctx, x + s * 0.06, y + fall - blockH * 0.1, s * 0.88, blockH, s * 0.16);
          ctx.fill();
          const gg = ctx.createLinearGradient(0, y + fall - blockH * 0.1, 0, y + fall + blockH * 0.9);
          gg.addColorStop(0, "rgba(255,255,255,0.5)");
          gg.addColorStop(1, "rgba(60,64,110,0.5)");
          ctx.fillStyle = gg;
          roundRect(ctx, x + s * 0.06, y + fall - blockH * 0.1, s * 0.88, blockH, s * 0.16);
          ctx.fill();
        }
        break;
      }
      case "spring": {
        drawSolid(tr.row, tr.col, x, y, s, 1);
        const compressed = st === "active" || st === "spent";
        const springH = compressed ? s * 0.2 : s * 0.42;
        const baseY = y + s * 0.12;
        // 弹簧线圈
        ctx.strokeStyle = "#9fe8ff";
        ctx.lineWidth = Math.max(1.6, s * 0.07);
        ctx.beginPath();
        for (let i = 0; i <= 12; i += 1) {
          const p = i / 12;
          const yy = baseY - p * springH;
          const xx = x + s * 0.5 + Math.sin(p * Math.PI * 4) * s * 0.16;
          if (i === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
        // 顶板
        ctx.fillStyle = "#62d6c6";
        roundRect(ctx, x + s * 0.16, baseY - springH - s * 0.1, s * 0.68, s * 0.14, s * 0.06);
        ctx.fill();
        glow(ctx, x + s * 0.5, baseY - springH, s * 0.8, "rgba(120,230,220,", 0.3);
        break;
      }
      case "reverse": {
        // 反向操作：飘浮的倒置箭头，读起来就是"反了"
        const cx = x + s * 0.5;
        const cy = y + s * 0.5;
        glow(ctx, cx, cy, s * 1.1, C.glowDemon, st === "active" ? 0.42 : 0.2);
        ctx.save();
        ctx.translate(cx, cy);
        if (!reduced) ctx.rotate(Math.sin(time * 2.4) * 0.3);
        ctx.fillStyle = "#e0a6ff";
        const q = s * 0.24;
        ctx.beginPath();
        ctx.moveTo(-q, -q * 0.5);
        ctx.lineTo(0, q * 0.7);
        ctx.lineTo(q, -q * 0.5);
        ctx.lineTo(q * 0.4, -q * 0.5);
        ctx.lineTo(q * 0.4, -q * 1.2);
        ctx.lineTo(-q * 0.4, -q * 1.2);
        ctx.lineTo(-q * 0.4, -q * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case "gravity": {
        // 重力翻转：一片旋转的漩涡
        const cx = x + s * 0.5;
        const cy = y + s * 0.5;
        glow(ctx, cx, cy, s * 1.25, C.glowDemon, 0.3);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(reduced ? 0 : time * 2.2);
        ctx.strokeStyle = "rgba(214,150,255,0.85)";
        ctx.lineWidth = Math.max(1.6, s * 0.07);
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          ctx.arc(0, 0, s * (0.16 + i * 0.09), i * 1.6, i * 1.6 + 2.2);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case "portal": {
        const cx = x + s * 0.5;
        const cy = y + s * 0.5;
        glow(ctx, cx, cy, s * 1.1, "rgba(140,200,255,", 0.35);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(reduced ? 0 : -time * 1.8);
        ctx.strokeStyle = "rgba(170,220,255,0.8)";
        ctx.lineWidth = Math.max(1.4, s * 0.06);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.26, s * 0.13, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "rundoor":
      case "fakedoor": {
        // 门类陷阱由 goal 绘制负责（rundoor 会移动），这里只画脚下地砖
        drawSolid(tr.row, tr.col, x, y, s, 1);
        break;
      }
      default: {
        drawSolid(tr.row, tr.col, x, y, s, 1);
      }
    }
  }

  // ---- 终点门：极高对比度的赛博翡翠传送门 ----
  function drawGoal(g) {
    if (!g) return;
    const cx = Math.round(originX + g.x * cell + cell * 0.5);
    const cy = Math.round(originY + g.y * cell + cell * 0.5);
    const s = cell;
    const visible = g.visible !== false;

    if (!visible) {
      glow(ctx, cx, cy, s * 0.5, "rgba(0,255,170,", 0.12);
      return;
    }

    const w = Math.round(s * 0.72);
    const h = Math.round(s * 1.28);
    const gx = Math.round(cx - w / 2);
    const gy = Math.round(cy - h);

    // 1) 黑色微外框
    ctx.fillStyle = "#091016";
    ctx.fillRect(gx - 2, gy - 2, w + 4, h + 4);

    // 2) 鲜亮翠绿门框（#00ff9d 极高对比度）
    ctx.fillStyle = "#00ff9d";
    ctx.fillRect(gx, gy, w, h);

    // 3) 内部深邃通道
    ctx.fillStyle = "#041a12";
    ctx.fillRect(gx + 3, gy + 3, w - 6, h - 3);

    // 4) 门内通关指示信标（纯白核心 + 翡翠呼吸光）
    const pulse = reduced ? 0.8 : 0.65 + Math.sin(time * 3.6) * 0.25;
    ctx.fillStyle = `rgba(0, 255, 170, ${pulse})`;
    ctx.beginPath();
    ctx.arc(cx, gy + Math.round(h * 0.46), Math.round(s * 0.12), 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, gy + Math.round(h * 0.46), Math.round(s * 0.05), 0, TAU);
    ctx.fill();
  }

  // ---- 蜡烛：晶莹黄铜小蜡烛（纯净明亮，无大范围发虚散光）----
  function drawCandle(c, taken) {
    if (taken || !c) return;
    const cx = Math.round(originX + c.x * cell + cell * 0.5);
    const cy = Math.round(originY + c.y * cell + cell * 0.85);
    const s = cell;

    // 1) 底部微型黄铜烛盘
    ctx.fillStyle = "#e0a020";
    ctx.fillRect(cx - Math.round(s * 0.18), cy - Math.round(s * 0.08), Math.round(s * 0.36), Math.round(s * 0.08));

    // 2) 洁白烛身
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - Math.round(s * 0.1), cy - Math.round(s * 0.36), Math.round(s * 0.2), Math.round(s * 0.28));

    // 3) 细黑烛芯
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(cx - 1, cy - Math.round(s * 0.42), 2, Math.round(s * 0.08));

    // 4) 鲜活跳动明亮火苗
    const flick = reduced ? 0 : Math.sin(time * 12) * (s * 0.02);
    const fx = cx + flick;
    const fy = cy - Math.round(s * 0.52);

    ctx.fillStyle = "#ffaa1a";
    ctx.beginPath();
    ctx.ellipse(fx, fy, Math.round(s * 0.1), Math.round(s * 0.15), 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(fx, fy + 2, Math.round(s * 0.05), Math.round(s * 0.08), 0, 0, TAU);
    ctx.fill();
  }

  // ---- 玩家：纯净白玉小恶魔方块（鲜红恶魔双角 + 灵动大眼睛 + 锐利立体边缘）----
  function drawPlayer(p, phase) {
    const s = cell;
    const w = Math.round(s * 0.68);
    const h = Math.round(s * 0.92);
    const cx = Math.round(originX + p.x * cell);
    const cy = Math.round(originY + p.y * cell);

    let scale = 1;
    let alpha = 1;
    if (phase === "dying") {
      scale = 0.55;
      alpha = 0.5;
      glow(ctx, cx, cy - h * 0.5, s * 1.2, C.glowDemon, 0.45);
    }

    ctx.globalAlpha = alpha;

    const pw = Math.round(w * scale);
    const ph = Math.round(h * scale);
    const px = Math.round(cx - pw * 0.5);
    const py = Math.round(cy - ph);

    // 1) 鲜红恶魔双角（恶魔标志！）
    if (phase !== "dying") {
      ctx.fillStyle = "#ff2a55";
      // 左角
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 2);
      ctx.lineTo(px - 3, py - 6);
      ctx.lineTo(px + 8, py);
      ctx.closePath();
      ctx.fill();
      // 右角
      ctx.beginPath();
      ctx.moveTo(px + pw - 4, py + 2);
      ctx.lineTo(px + pw + 3, py - 6);
      ctx.lineTo(px + pw - 8, py);
      ctx.closePath();
      ctx.fill();
    }

    // 2) 底部深邃微投影
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(px + 1, cy - 2, pw - 2, 4);

    // 3) 小方块立体下层边缘（暗靛灰 #64748b）
    ctx.fillStyle = "#64748b";
    roundRect(ctx, px, py, pw, ph, 3);
    ctx.fill();

    // 4) 纯白立体主体面（#ffffff，极高对比度）
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, px, py, pw, ph - 3, 3);
    ctx.fill();

    // 5) 灵动大眼睛（眼神追随运动方向）
    if (phase !== "dying") {
      const dir = p.facing < 0 ? -1 : 1;
      const eyeY = py + Math.round(ph * 0.4);
      const eyeR = Math.max(2.5, Math.round(s * 0.08));

      // 双眼位置
      const eye1X = px + Math.round(pw * 0.3) + dir * 2;
      const eye2X = px + Math.round(pw * 0.7) + dir * 2;

      // 眼眶与黑瞳
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(eye1X, eyeY, eyeR, 0, TAU);
      ctx.arc(eye2X, eyeY, eyeR, 0, TAU);
      ctx.fill();

      // 晶亮反光高光点
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(eye1X + (dir >= 0 ? 1 : -1), eyeY - 1, Math.max(1, eyeR * 0.4), 0, TAU);
      ctx.arc(eye2X + (dir >= 0 ? 1 : -1), eyeY - 1, Math.max(1, eyeR * 0.4), 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  // ---- 恶魔脚印：死亡纪念碑（重生不清，永久留在关卡里）----
  function drawMarks(marks) {
    for (const m of marks) {
      const cx = originX + m.x * cell;
      const cy = originY + (m.y || 0) * cell + cell * 0.5;
      glow(ctx, cx, cy, cell * 0.62, C.glowDemon, 0.3);
      // 小小的叉，表示"你在这里死过"
      const q = cell * 0.11;
      ctx.strokeStyle = "rgba(214,150,255,0.7)";
      ctx.lineWidth = Math.max(1.4, cell * 0.055);
      ctx.beginPath();
      ctx.moveTo(cx - q, cy - q);
      ctx.lineTo(cx + q, cy + q);
      ctx.moveTo(cx + q, cy - q);
      ctx.lineTo(cx - q, cy + q);
      ctx.stroke();
    }
  }

  // ---- 关卡地图 ----
  function drawMap(map) {
    for (let r = 0; r < map.length; r += 1) {
      const row = map[r];
      for (let c = 0; c < row.length; c += 1) {
        const t = row[c];
        if (t === T.SOLID) {
          drawSolid(r, c, originX + c * cell, originY + r * cell, cell, 1);
        } else if (t === T.SPIKE) {
          drawSpikeCell(originX + c * cell, originY + r * cell, cell, 1, "spike");
        } else if (t === T.LAVA) {
          drawSpikeCell(originX + c * cell, originY + r * cell, cell, 1, "lava");
        }
      }
    }
  }

  // ---- 特效：火花与涟漪（由事件驱动，表现层闭环）----
  function spawnSpark(x, y, rgb) {
    if (reduced) return;
    for (let i = 0; i < 10; i += 1) {
      const a = Math.random() * TAU;
      const sp = 40 + Math.random() * 150;
      sparks.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.4 + Math.random() * 0.4,
        age: 0,
        r: 1 + Math.random() * 2.4,
        rgb
      });
    }
  }

  function spawnRipple(x, y, rgb) {
    if (reduced) return;
    ripples.push({ x, y, r: cell * 0.2, max: cell * 1.5, age: 0, life: 0.5, rgb });
  }

  function updateFx(dt) {
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
    }
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const r = ripples[i];
      r.age += dt;
      if (r.age >= r.life) ripples.splice(i, 1);
    }
  }

  function drawFx() {
    for (const r of ripples) {
      const t = r.age / r.life;
      const rad = lerp(r.r, r.max, t);
      const a = (1 - t) * 0.5;
      glow(ctx, r.x, r.y, rad, r.rgb, a, 0.35);
    }
    for (const p of sparks) {
      const t = p.age / p.life;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.fillStyle = `${p.rgb}1)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 - t * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 把世界坐标换算成画布坐标（供 UI 层生成特效位置）
  function worldToCanvas(x, y) {
    return { x: originX + x * cell, y: originY + y * cell };
  }

  // ---- 主绘制 ----
  // summary 为 game.getSummary() 的只读快照；地图是静态关卡数据，
  // 直接从 levels.mjs 取，免得把整张网格塞进每帧快照里。
  let lastLevelIndex = -1;
  let currentMap = null;

  function draw(summary, dt) {
    // 自动自愈尺寸与高刷屏 DPR（避免异步 reflow 导致画布被拉伸模糊）
    const rect = canvas.getBoundingClientRect();
    const curW = Math.max(240, Math.round(rect.width || canvas.clientWidth || 800));
    const curH = Math.max(200, Math.round(rect.height || canvas.clientHeight || 520));
    const curDpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
    if (curW > 0 && curH > 0 && (curW !== vw || curH !== vh || curDpr !== dpr)) {
      resize();
    }

    const step = Number.isFinite(dt) ? dt : 1 / 60;
    if (!reduced) time += step;
    updateFx(step);
    drawBackground();

    if (!summary) return;

    const level = summary;

    if (level.levelIndex !== lastLevelIndex) {
      const staticLevel = getLevel(level.levelIndex);
      currentMap = staticLevel ? staticLevel.map : null;
      lastLevelIndex = level.levelIndex;
    }
    const map = currentMap;
    if (!map) return;

    const cols = map[0].length;
    const rows = map.length;
    layout(cols, rows);

    drawMap(map);

    // 陷阱
    for (const tr of level.traps) drawTrap(tr);

    // 终点门
    drawGoal(level.goal);

    // 蜡烛
    drawCandle(level.candle, level.gotCandle);

    // 恶魔脚印
    drawMarks(level.marks);

    // 玩家
    drawPlayer(level.player, level.phase);

    drawFx();
  }

  resize();

  return {
    resize,
    draw,
    worldToCanvas,
    spawnSpark,
    spawnRipple,
    setReducedMotion(value) { reduced = !!value; seedDust(); },
    get reducedMotion() { return reduced; },
    get cell() { return cell; },
    destroy() { /* 无需清理，画布由外部持有 */ }
  };
}

export default createRenderer;
