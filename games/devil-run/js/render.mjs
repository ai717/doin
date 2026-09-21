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

  // 关卡尺寸变化时重算缩放，让舞台完整居中且留出桌面广告安全白边
  function layout(cols, rows) {
    // 桌面端主舞台不超过 1100px 已由 CSS 保证；这里只做等比适配
    const padX = 26;
    const padY = 26;
    const availW = Math.max(120, vw - padX * 2);
    const availH = Math.max(120, vh - padY * 2);
    cell = Math.min(availW / cols, availH / rows);
    const stageW = cell * cols;
    const stageH = cell * rows;
    originX = (vw - stageW) / 2;
    originY = (vh - stageH) / 2;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width || canvas.clientWidth || 800));
    const h = Math.max(200, Math.round(rect.height || canvas.clientHeight || 520));
    dpr = Math.min(2, Math.max(1, (globalThis.devicePixelRatio || 1)));
    vw = w;
    vh = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedDust();
  }

  // ---- 背景：动态环境渐变 + 景深光晕 + 浮动粒子（禁止死白/死黑大平铺）----
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, C.bgTop);
    g.addColorStop(0.55, "#141631");
    g.addColorStop(1, C.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // 两团缓慢漂移的景深光晕，给舞台空间感
    const t = reduced ? 0 : time;
    const warmX = vw * (0.24 + Math.sin(t * 0.17) * 0.05);
    const warmY = vh * (0.72 + Math.cos(t * 0.13) * 0.05);
    glow(ctx, warmX, warmY, Math.max(vw, vh) * 0.55, C.glowWarm, 0.10);

    const coolX = vw * (0.78 + Math.cos(t * 0.11) * 0.05);
    const coolY = vh * (0.2 + Math.sin(t * 0.19) * 0.05);
    glow(ctx, coolX, coolY, Math.max(vw, vh) * 0.5, C.glowCool, 0.11);

    // 浮动粒子
    for (const d of dust) {
      const y = reduced ? d.y : (d.y - time * d.sp * 3) % vh;
      const yy = y < 0 ? y + vh : y;
      ctx.globalAlpha = d.a;
      ctx.fillStyle = "#cfd6ff";
      ctx.beginPath();
      ctx.arc(d.x, yy, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 暗角
    const vg = ctx.createRadialGradient(
      vw / 2, vh / 2, Math.min(vw, vh) * 0.35,
      vw / 2, vh / 2, Math.max(vw, vh) * 0.78
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, vw, vh);
  }

  // ---- 地砖：平涂亮面 + 上下倒角（渐变，不用描边）+ 深投影 ----
  function drawSolid(row, col, x, y, s, alpha) {
    const tint = tileTint(col, row);
    const top = C.solid;
    const side = C.solidSide;
    const deep = C.solidDeep;

    ctx.globalAlpha = alpha;

    // 投影（向下偏移，让方块"浮"起来）
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    roundRect(ctx, x + s * 0.05, y + s * 0.14, s * 0.94, s * 0.92, s * 0.2);
    ctx.fill();

    // 主体平涂面
    ctx.fillStyle = top;
    roundRect(ctx, x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.9, s * 0.18);
    ctx.fill();

    // 顶部倒角：竖向渐变由亮到透明，形成柔和明暗晕（无硬边）
    const gTop = ctx.createLinearGradient(0, y + s * 0.04, 0, y + s * 0.34);
    gTop.addColorStop(0, "rgba(255,255,255,0.52)");
    gTop.addColorStop(0.42, "rgba(255,255,255,0.20)");
    gTop.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gTop;
    roundRect(ctx, x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.3, s * 0.18);
    ctx.fill();

    // 底部倒角：暗面渐隐，制造厚度
    const gBot = ctx.createLinearGradient(0, y + s * 0.62, 0, y + s * 0.94);
    gBot.addColorStop(0, "rgba(24,26,54,0)");
    gBot.addColorStop(1, "rgba(24,26,54,0.42)");
    ctx.fillStyle = gBot;
    roundRect(ctx, x + s * 0.04, y + s * 0.62, s * 0.92, s * 0.32, s * 0.18);
    ctx.fill();

    // 极轻的暖色反光，避免大片死白
    ctx.globalAlpha = alpha * (0.05 + tint * 0.05);
    glow(ctx, x + s * 0.5, y + s * 0.5, s * 0.7, C.glowWarm, 0.5);
    ctx.globalAlpha = alpha;
  }

  // ---- 尖刺：三角刺，前兆时先探出一点点 ----
  function drawSpikeCell(x, y, s, progress, kind) {
    const rise = clamp01(progress);            // 0 = 未出，1 = 完全弹出
    const h = s * 0.62 * rise;
    const baseY = y + s * 0.92;
    const isLava = kind === "lava";

    // 前兆光晕（先承诺后翻脸的"承诺"阶段）
    if (rise < 1) {
      const a = 0.18 + 0.3 * (1 - rise);
      glow(ctx, x + s * 0.5, baseY - s * 0.1, s * 0.85, C.glowWarm, a);
    }

    if (isLava) {
      const g = ctx.createLinearGradient(0, baseY - s * 0.5, 0, baseY);
      g.addColorStop(0, "#ff8a3c");
      g.addColorStop(1, "#e02a12");
      ctx.fillStyle = g;
      roundRect(ctx, x + s * 0.06, baseY - s * 0.42, s * 0.88, s * 0.42, s * 0.1);
      ctx.fill();
      glow(ctx, x + s * 0.5, baseY - s * 0.2, s * 0.9, C.glowWarm, 0.4);
      return;
    }

    if (h <= 0.5) return;
    const teeth = 3;
    ctx.fillStyle = C.spike;
    ctx.beginPath();
    for (let i = 0; i < teeth; i += 1) {
      const cx = x + s * (0.18 + i * 0.32);
      const bw = s * 0.15;
      ctx.moveTo(cx - bw, baseY);
      ctx.lineTo(cx, baseY - h);
      ctx.lineTo(cx + bw, baseY);
      ctx.closePath();
    }
    ctx.fill();

    // 刺尖高光（渐变，非描边）
    const sg = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    sg.addColorStop(0, "rgba(255,235,180,0.85)");
    sg.addColorStop(0.5, "rgba(255,160,90,0.25)");
    sg.addColorStop(1, "rgba(255,90,40,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    for (let i = 0; i < teeth; i += 1) {
      const cx = x + s * (0.18 + i * 0.32);
      const bw = s * 0.15;
      ctx.moveTo(cx - bw, baseY);
      ctx.lineTo(cx, baseY - h);
      ctx.lineTo(cx + bw, baseY);
      ctx.closePath();
    }
    ctx.fill();

    glow(ctx, x + s * 0.5, baseY, s * 1.0, C.glowWarm, 0.28);
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

  // ---- 终点门 ----
  function drawGoal(g) {
    const cx = originX + g.x * cell;
    const cy = originY + g.y * cell + cell * 0.5;
    const s = cell;
    const visible = g.visible !== false;

    if (!visible) {
      // 假门消失：只留一圈将熄的余光
      glow(ctx, cx, cy, s * 0.85, C.glowCool, 0.18);
      return;
    }

    const w = s * 0.62;
    const h = s * 1.24;
    // 门口光晕（径向柔光，非描边）
    glow(ctx, cx, cy - h * 0.1, s * 1.05, "rgba(126,232,200,", 0.34);

    // 门框
    ctx.fillStyle = "#2b3158";
    roundRect(ctx, cx - w / 2 - s * 0.06, cy - h, w + s * 0.12, h + s * 0.06, s * 0.1);
    ctx.fill();
    // 门洞
    const dg = ctx.createLinearGradient(0, cy - h, 0, cy);
    dg.addColorStop(0, "#8ff0d4");
    dg.addColorStop(1, "#2f9c86");
    ctx.fillStyle = dg;
    roundRect(ctx, cx - w / 2, cy - h + s * 0.06, w, h - s * 0.06, s * 0.08);
    ctx.fill();
    // 门内顶光
    const tg = ctx.createLinearGradient(0, cy - h + s * 0.06, 0, cy - h * 0.4);
    tg.addColorStop(0, "rgba(255,255,255,0.75)");
    tg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = tg;
    roundRect(ctx, cx - w / 2, cy - h + s * 0.06, w, h * 0.4, s * 0.08);
    ctx.fill();

    if (!reduced) {
      // 缓慢呼吸的柔光，把门"托"出来
      const pulse = 0.16 + Math.sin(time * 2.1) * 0.07;
      glow(ctx, cx, cy - h * 0.4, s * 1.3, "rgba(126,232,200,", pulse);
    }
  }

  // ---- 蜡烛（隐藏收集品）----
  function drawCandle(c, taken) {
    if (taken || !c) return;
    const cx = originX + c.x * cell;
    const cy = originY + c.y * cell;
    const s = cell;
    glow(ctx, cx, cy, s * 1.3, "rgba(255,209,102,", 0.34);

    // 蜡身
    ctx.fillStyle = "#ffe9b0";
    roundRect(ctx, cx - s * 0.07, cy - s * 0.04, s * 0.14, s * 0.34, s * 0.05);
    ctx.fill();
    // 火苗：两段渐变的泪滴
    const flick = reduced ? 0 : Math.sin(time * 9) * s * 0.014;
    const fg = ctx.createRadialGradient(cx + flick, cy - s * 0.2, 0, cx + flick, cy - s * 0.2, s * 0.2);
    fg.addColorStop(0, "rgba(255,255,235,1)");
    fg.addColorStop(0.4, "rgba(255,206,110,0.9)");
    fg.addColorStop(1, "rgba(255,150,50,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(cx + flick, cy - s * 0.2, s * 0.09, s * 0.15, 0, 0, TAU);
    ctx.fill();
  }

  // ---- 玩家：纯白软胶小方块（无描边，靠投影与柔光托起）----
  function drawPlayer(p, phase) {
    const s = cell;
    const w = s * 0.62;
    const h = s * 0.92;
    const cx = originX + p.x * cell;
    const cy = originY + p.y * cell;

    // 死亡中：向内塌缩 + 紫色爆散
    let scale = 1;
    let alpha = 1;
    if (phase === "dying") {
      scale = 0.55;
      alpha = 0.55;
      glow(ctx, cx, cy - h * 0.5, s * 1.5, C.glowDemon, 0.5);
    }

    // 落地柔光
    glow(ctx, cx, cy, s * 0.85, C.glowCool, 0.16);

    ctx.globalAlpha = alpha;
    // 投影
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    roundRect(ctx,
      cx - w * 0.5 * scale + s * 0.04,
      cy - h * scale + s * 0.1,
      w * scale, h * scale, s * 0.18);
    ctx.fill();

    // 主体
    ctx.fillStyle = C.player;
    roundRect(ctx,
      cx - w * 0.5 * scale,
      cy - h * scale,
      w * scale, h * scale, s * 0.18);
    ctx.fill();

    // 顶部倒角（渐变）
    const gTop = ctx.createLinearGradient(0, cy - h * scale, 0, cy - h * scale * 0.55);
    gTop.addColorStop(0, "rgba(255,255,255,0.95)");
    gTop.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gTop;
    roundRect(ctx, cx - w * 0.5 * scale, cy - h * scale, w * scale, h * scale * 0.45, s * 0.18);
    ctx.fill();

    // 底部厚度
    const gBot = ctx.createLinearGradient(0, cy - h * scale * 0.4, 0, cy);
    gBot.addColorStop(0, "rgba(150,160,220,0)");
    gBot.addColorStop(1, "rgba(90,100,170,0.55)");
    ctx.fillStyle = gBot;
    roundRect(ctx, cx - w * 0.5 * scale, cy - h * scale * 0.4, w * scale, h * scale * 0.4, s * 0.18);
    ctx.fill();

    // 眼睛（朝向）
    if (phase !== "dying") {
      const dir = p.facing < 0 ? -1 : 1;
      ctx.fillStyle = "#242a4d";
      ctx.beginPath();
      ctx.arc(cx + dir * w * 0.16, cy - h * 0.62, s * 0.05, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + dir * w * 0.36, cy - h * 0.62, s * 0.05, 0, TAU);
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
