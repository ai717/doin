// render：唯一的 Canvas 2D 绘制层。只读 engine state，绝不改规则数据。
// 自持：DPR / ResizeObserver / contain 缩放、粒子、涟漪、跳字、摘瓜光束、shake、指针反算。
// 水果、果园木框、瞄准线、安全线、特效都画在这里；HUD / 按钮 / 文本留在 DOM 层。
// 可摘 2048 大西瓜用径向柔光呼吸标记（无描边圈），遵守“可读性标记禁用描边圈”红线。

import {
  DROP_Y,
  FRUIT_STYLE,
  LEVEL_VALUES,
  MAX_LEVEL,
  SAFETY_Y,
  WALL,
  WORLD,
  levelRadius,
} from "./engine.mjs?v=79c518024932";

const TAU = Math.PI * 2;

function hexToRgba(hex, alpha) {
  const h = String(hex).replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  if (!Number.isFinite(num)) return `rgba(255,255,255,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const view = { scale: 1, dpr: 1 };

  const particles = [];
  const ripples = [];
  const pops = []; // 数字翻倍跳字
  const ghosts = []; // 摘瓜升起的大西瓜残影
  let shake = 0;
  let clock = 0;

  function resize() {
    const parent = canvas.parentElement;
    const wrapW = parent ? parent.clientWidth : canvas.clientWidth;
    const wrapH = parent ? parent.clientHeight : canvas.clientHeight;
    if (!wrapW || !wrapH) return;
    const fit = Math.min(wrapW / WORLD.width, wrapH / WORLD.height);
    const cssW = Math.max(1, Math.floor(WORLD.width * fit));
    const cssH = Math.max(1, Math.floor(WORLD.height * fit));
    const dpr = Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    view.scale = canvas.width / WORLD.width;
    view.dpr = dpr;
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: WORLD.width / 2, y: DROP_Y };
    return {
      x: ((clientX - rect.left) / rect.width) * WORLD.width,
      y: ((clientY - rect.top) / rect.height) * WORLD.height,
    };
  }

  // —— 背景：夏日果园天空 + 暖阳光晕 + 细噪点叶影 ——
  function drawBackground(reduced) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    g.addColorStop(0, "#7ec8e3");
    g.addColorStop(0.55, "#a8e6cf");
    g.addColorStop(1, "#c4efc8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // 暖阳光晕（缓慢漂移，reduced-motion 时定格）。
    const t = reduced ? 0 : clock;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const blobs = [
      { x: 0.78 + Math.cos(t * 0.13) * 0.04, y: 0.14 + Math.sin(t * 0.1) * 0.03, r: 0.52, c: "rgba(255,241,168,0.32)" },
      { x: 0.22 + Math.sin(t * 0.11) * 0.05, y: 0.3 + Math.cos(t * 0.09) * 0.04, r: 0.4, c: "rgba(255,255,255,0.2)" },
      { x: 0.5 + Math.sin(t * 0.08 + 1.2) * 0.08, y: 0.72 + Math.cos(t * 0.1) * 0.04, r: 0.6, c: "rgba(126,200,227,0.16)" },
    ];
    for (const b of blobs) {
      const cx = b.x * WORLD.width;
      const cy = b.y * WORLD.height;
      const rr = b.r * WORLD.width;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    ctx.restore();

    // 细噪点叶影
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#3d7a4f";
    for (let i = 0; i < 90; i += 1) {
      const px = ((i * 53) % WORLD.width) + Math.sin(i) * 6;
      const py = ((i * 97) % WORLD.height) * 0.72;
      ctx.beginPath();
      ctx.arc(px, py, 1 + (i % 3), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // 顶部天光渐隐到容器上沿
    const top = ctx.createLinearGradient(0, 0, 0, 56);
    top.addColorStop(0, "rgba(255,255,255,0.14)");
    top.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, WORLD.width, 56);
  }

  // —— 果园木框（左 / 右 / 底，暖木 + 纹理 + 内沿高光）——
  function drawFrame() {
    ctx.save();
    const wood = (x, y, w, h, vertical) => {
      const grad = vertical
        ? ctx.createLinearGradient(x, 0, x + w, 0)
        : ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, "#8a5a33");
      grad.addColorStop(0.45, "#75482a");
      grad.addColorStop(1, "#5f3a20");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      // 木纹
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = "#3e2412";
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k += 1) {
        ctx.beginPath();
        if (vertical) {
          const lx = x + 2 + k * (w - 4) / 3;
          ctx.moveTo(lx, y + 2);
          ctx.bezierCurveTo(lx + 2, y + h * 0.3, lx - 2, y + h * 0.65, lx + 1, y + h - 2);
        } else {
          const ly = y + 2 + k * (h - 4) / 3;
          ctx.moveTo(x + 2, ly);
          ctx.bezierCurveTo(x + w * 0.3, ly + 2, x + w * 0.65, ly - 2, x + w - 2, ly + 1);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 内沿高光
      ctx.fillStyle = "rgba(255,235,200,0.28)";
      if (vertical) ctx.fillRect(x + 1, y, 2, h);
      else ctx.fillRect(x, y, w, 2);
    };
    wood(0, 0, WALL, WORLD.height, true);
    wood(WORLD.width - WALL, 0, WALL, WORLD.height, true);
    wood(0, WORLD.height - WALL, WORLD.width, WALL, false);
    ctx.restore();
  }

  function drawSafetyLine(state, reduced) {
    const danger = state.dangerTime > 0;
    const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(clock * (danger ? 14 : 3));
    ctx.save();
    ctx.lineWidth = danger ? 3 : 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = danger ? `rgba(255,90,90,${0.55 + pulse * 0.45})` : "rgba(255,248,220,0.5)";
    ctx.beginPath();
    ctx.moveTo(WALL, SAFETY_Y);
    ctx.lineTo(WORLD.width - WALL, SAFETY_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (danger) {
      const glow = ctx.createLinearGradient(0, SAFETY_Y - 46, 0, SAFETY_Y);
      glow.addColorStop(0, "rgba(255,80,80,0)");
      glow.addColorStop(1, `rgba(255,80,80,${0.16 + pulse * 0.16})`);
      ctx.fillStyle = glow;
      ctx.fillRect(WALL, SAFETY_Y - 46, WORLD.width - WALL * 2, 46);
    }
    ctx.restore();
  }

  function landingY(state, aimX, r) {
    let best = WORLD.height - WALL - r;
    for (const f of state.fruits) {
      const dx = f.x - aimX;
      const reach = f.r + r;
      if (Math.abs(dx) >= reach) continue;
      const dy = Math.sqrt(Math.max(0, reach * reach - dx * dx));
      const contactY = f.y - dy;
      if (contactY < best) best = contactY;
    }
    return best;
  }

  function drawAim(state, reduced) {
    const r = levelRadius(state.current);
    const aimX = state.aimX;
    const landY = landingY(state, aimX, r);
    const breathe = reduced ? 1 : 1 + Math.sin(clock * 4) * 0.08;
    ctx.save();
    // 虚线轨迹
    ctx.setLineDash([6, 9]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(255,250,225,0.45)";
    ctx.beginPath();
    ctx.moveTo(aimX, DROP_Y);
    ctx.lineTo(aimX, landY);
    ctx.stroke();
    ctx.setLineDash([]);
    // 落点光圈（软光呼吸，不描实体轮廓）
    const ringGlow = ctx.createRadialGradient(aimX, landY, 0, aimX, landY, r * 1.5);
    ringGlow.addColorStop(0, `rgba(255,236,170,${0.28 * breathe})`);
    ringGlow.addColorStop(0.62, `rgba(255,236,170,${0.14 * breathe})`);
    ringGlow.addColorStop(1, "rgba(255,236,170,0)");
    ctx.fillStyle = ringGlow;
    ctx.beginPath();
    ctx.arc(aimX, landY, r * 1.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,244,200,0.75)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(aimX, landY, r * 0.92 * breathe, 0, TAU);
    ctx.stroke();
    // 待丢水果（悬挂在顶部，带数字铭牌）
    drawFruit({ level: state.current, x: aimX, y: DROP_Y, r, squash: 0 }, reduced, 0.94);
    ctx.restore();
  }

  // —— 数字铭牌：奶油底 + 深褐数字（左上角双重编码）——
  function drawBadge(x, y, r, value, alpha) {
    const len = String(value).length;
    const bw = Math.max(15, Math.min(38, r * 1.0));
    const bh = Math.max(10.5, Math.min(24, r * 0.62));
    const font = Math.min(bh * 0.7, bw / (len * 0.6));
    ctx.save();
    ctx.globalAlpha = alpha;
    // 圆角小牌（奶油色 + 深褐描边感：用同色系加深的叠影）
    ctx.fillStyle = "rgba(255,250,235,0.96)";
    ctx.beginPath();
    const rr = bh * 0.34;
    ctx.roundRect?.(x - bw / 2, y - bh / 2, bw, bh, rr) ?? ctx.rect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.fill();
    ctx.fillStyle = "rgba(92,58,33,0.14)";
    ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh * 0.42);
    ctx.fillStyle = "#5c3a21";
    ctx.font = `800 ${font}px -apple-system, "Segoe UI", Arial, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), x, y + 0.6);
    ctx.restore();
  }

  // —— Q 版多汁水果主体（按级数画不同形状）——
  function fruitBody(level, r) {
    const st = FRUIT_STYLE[level - 1] || FRUIT_STYLE[0];
    ctx.save();
    // 主体径向渐变（左上受光）
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.34, r * 0.08, 0, 0, r);
    g.addColorStop(0, "rgba(255,255,255,0.92)");
    g.addColorStop(0.4, st.glow);
    g.addColorStop(0.78, st.color);
    g.addColorStop(1, hexToRgba(st.color, 0.92));

    switch (level) {
      case 1: { // 樱桃
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        // 果梗 + 小叶
        ctx.strokeStyle = "#4a7a3a";
        ctx.lineWidth = Math.max(1.4, r * 0.11);
        ctx.beginPath();
        ctx.moveTo(r * 0.1, -r * 0.85);
        ctx.quadraticCurveTo(r * 0.4, -r * 1.15, r * 0.12, -r * 1.32);
        ctx.stroke();
        ctx.fillStyle = "#6fae54";
        ctx.beginPath();
        ctx.ellipse(r * 0.34, -r * 1.12, r * 0.24, r * 0.12, 0.5, 0, TAU);
        ctx.fill();
        break;
      }
      case 2: { // 草莓
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.94);
        ctx.bezierCurveTo(r * 0.94, -r * 0.6, r * 0.86, r * 0.72, 0, r * 0.98);
        ctx.bezierCurveTo(-r * 0.86, r * 0.72, -r * 0.94, -r * 0.6, 0, -r * 0.94);
        ctx.fill();
        // 籽
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        for (const [sx, sy] of [[-0.34, 0.12], [0.34, 0.12], [0, 0.5], [-0.2, -0.28], [0.2, -0.28]]) {
          ctx.beginPath();
          ctx.ellipse(sx * r, sy * r, r * 0.07, r * 0.1, 0.4, 0, TAU);
          ctx.fill();
        }
        // 绿叶冠
        ctx.fillStyle = "#5fae4a";
        for (let k = 0; k < 5; k += 1) {
          const a = -Math.PI / 2 + (k - 2) * 0.55;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * r * 0.3, -r * 0.86 + Math.sin(a) * r * 0.22, r * 0.2, r * 0.1, a, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 3: { // 葡萄串
        ctx.fillStyle = g;
        const offs = [
          [0, -0.32], [-0.42, 0.12], [0.42, 0.12],
          [-0.28, 0.52], [0.28, 0.52], [0, 0.8],
        ];
        for (const [ox, oy] of offs) {
          ctx.beginPath();
          ctx.arc(ox * r * 0.92, oy * r * 0.92, r * 0.46, 0, TAU);
          ctx.fill();
        }
        ctx.strokeStyle = "#5a3a20";
        ctx.lineWidth = Math.max(1.4, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.86);
        ctx.quadraticCurveTo(-r * 0.2, -r * 1.1, 0, -r * 1.3);
        ctx.stroke();
        break;
      }
      case 4: { // 柠檬
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.06, r * 0.86, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = hexToRgba(st.color, 0.55);
        ctx.beginPath();
        ctx.arc(-r * 0.98, 0, r * 0.14, 0, TAU);
        ctx.arc(r * 0.98, 0, r * 0.14, 0, TAU);
        ctx.fill();
        break;
      }
      case 5: { // 橙子
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        // 果皮细点
        ctx.fillStyle = "rgba(255,255,255,0.34)";
        for (const [dx, dy] of [[-0.42, 0.3], [0.4, 0.28], [0.16, -0.44]]) {
          ctx.beginPath();
          ctx.arc(dx * r, dy * r, r * 0.07, 0, TAU);
          ctx.fill();
        }
        ctx.strokeStyle = "#4a7a3a";
        ctx.lineWidth = Math.max(1.4, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.9);
        ctx.lineTo(0, -r * 1.14);
        ctx.stroke();
        ctx.fillStyle = "#6fae54";
        ctx.beginPath();
        ctx.ellipse(-r * 0.18, -r * 1.02, r * 0.3, r * 0.14, -0.4, 0, TAU);
        ctx.fill();
        break;
      }
      case 6: { // 苹果
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.97, 0, TAU);
        ctx.fill();
        // 顶部小凹陷
        ctx.fillStyle = "rgba(120,40,30,0.22)";
        ctx.beginPath();
        ctx.arc(0, -r * 0.86, r * 0.2, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#5a3a20";
        ctx.lineWidth = Math.max(1.3, r * 0.09);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.86);
        ctx.quadraticCurveTo(r * 0.14, -r * 1.08, -r * 0.06, -r * 1.26);
        ctx.stroke();
        ctx.fillStyle = "#6fae54";
        ctx.beginPath();
        ctx.ellipse(r * 0.2, -r * 1.06, r * 0.28, r * 0.14, -0.5, 0, TAU);
        ctx.fill();
        break;
      }
      case 7: { // 蜜桃
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.96, 0, TAU);
        ctx.fill();
        // 中线沟
        ctx.strokeStyle = "rgba(200,90,60,0.35)";
        ctx.lineWidth = Math.max(1.2, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.9);
        ctx.quadraticCurveTo(r * 0.18, 0, 0, r * 0.92);
        ctx.stroke();
        ctx.fillStyle = "#6fae54";
        ctx.beginPath();
        ctx.ellipse(r * 0.3, -r * 0.94, r * 0.22, r * 0.12, 0.5, 0, TAU);
        ctx.fill();
        break;
      }
      case 8: { // 菠萝
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.06, r * 0.92, r * 0.86, 0, 0, TAU);
        ctx.fill();
        // 菱形网格
        ctx.strokeStyle = "rgba(170,110,20,0.5)";
        ctx.lineWidth = Math.max(1, r * 0.05);
        for (let k = -2; k <= 2; k += 1) {
          ctx.beginPath();
          ctx.moveTo(k * r * 0.34, -r * 0.68);
          ctx.lineTo(k * r * 0.34, r * 0.78);
          ctx.stroke();
        }
        for (let k = -2; k <= 2; k += 1) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.72, k * r * 0.34);
          ctx.lineTo(r * 0.72, k * r * 0.34);
          ctx.stroke();
        }
        // 叶冠
        ctx.fillStyle = "#5fae4a";
        for (let k = 0; k < 4; k += 1) {
          const a = -Math.PI / 2 + (k - 1.5) * 0.5;
          ctx.save();
          ctx.translate(Math.cos(a) * r * 0.2, -r * 0.8 + Math.sin(a) * r * 0.1);
          ctx.rotate(a * 0.6);
          ctx.beginPath();
          ctx.ellipse(0, -r * 0.3, r * 0.11, r * 0.32, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 9: { // 甜瓜
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        // 网纹
        ctx.strokeStyle = "rgba(60,140,80,0.4)";
        ctx.lineWidth = Math.max(1, r * 0.05);
        for (let k = 0; k < 5; k += 1) {
          const a = (k / 5) * Math.PI + 0.4;
          ctx.beginPath();
          ctx.arc(r * 0.6, 0, r * 0.72, a, a + 1.1);
          ctx.stroke();
        }
        for (let k = 0; k < 5; k += 1) {
          const a = (k / 5) * Math.PI + 2.1;
          ctx.beginPath();
          ctx.arc(-r * 0.5, r * 0.3, r * 0.68, a, a + 1.1);
          ctx.stroke();
        }
        break;
      }
      case 10: { // 半个大西瓜
        // 绿皮外沿
        ctx.fillStyle = hexToRgba("#2e8b4f", 0.95);
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        // 红瓤
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.86, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        // 浅绿皮带
        ctx.fillStyle = "#b8e08a";
        ctx.fillRect(-r * 0.86, -r * 0.86, r * 1.72, r * 0.2);
        // 籽
        ctx.fillStyle = "#2c2016";
        for (const [sx, sy] of [[-0.4, -0.28], [0.4, -0.28], [0, -0.62], [-0.22, 0.16], [0.22, 0.16]]) {
          ctx.save();
          ctx.translate(sx * r * 0.82, sy * r * 0.82);
          ctx.rotate(0.3);
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.09, r * 0.05, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      default: { // 2048 大西瓜
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        // 深绿条纹（z 形）
        ctx.strokeStyle = "rgba(20,90,45,0.55)";
        ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.beginPath();
        for (let k = 0; k < 5; k += 1) {
          const a = (k / 5) * TAU;
          ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
          ctx.lineTo(Math.cos(a + 0.28) * r * 0.9, Math.sin(a + 0.28) * r * 0.9);
          ctx.lineTo(Math.cos(a + 0.34) * r * 0.4, Math.sin(a + 0.34) * r * 0.4);
          ctx.lineTo(Math.cos(a + 0.62) * r * 0.85, Math.sin(a + 0.62) * r * 0.85);
        }
        ctx.stroke();
        // 小瓜蒂
        ctx.strokeStyle = "#4a7a3a";
        ctx.lineWidth = Math.max(1.5, r * 0.07);
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, -r * 0.9);
        ctx.quadraticCurveTo(-r * 0.1, -r * 1.06, -r * 0.26, -r * 1.12);
        ctx.stroke();
        break;
      }
    }

    // 顶部高光 + 底部反光（通用）
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.24, r * 0.15, -0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.ellipse(r * 0.18, r * 0.44, r * 0.3, r * 0.14, 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 可摘 2048：径向柔光呼吸标记（无描边圈）。
  function drawHarvestGlow(x, y, r, reduced) {
    const breathe = reduced ? 1 : 1 + Math.sin(clock * 3.2) * 0.12;
    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.7);
    glow.addColorStop(0, `rgba(255,214,107,${0.4 * breathe})`);
    glow.addColorStop(0.5, `rgba(255,236,170,${0.16 * breathe})`);
    glow.addColorStop(1, "rgba(255,236,170,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.7, 0, TAU);
    ctx.fill();
  }

  function drawFruit(f, reduced, alphaScale = 1) {
    const r = f.r;
    ctx.save();
    ctx.translate(f.x, f.y);
    const sq = reduced ? 0 : f.squash || 0;
    if (sq > 0.002) ctx.scale(1 + sq * 0.16, 1 - sq * 0.16);
    ctx.globalAlpha = alphaScale;

    if (f.level === MAX_LEVEL) drawHarvestGlow(0, 0, r, reduced);
    fruitBody(f.level, r);
    drawBadge(-r * 0.58, -r * 0.58, r, LEVEL_VALUES[f.level - 1], alphaScale);
    ctx.restore();
  }

  // —— 特效 ——
  function emitBurst(x, y, level) {
    const st = FRUIT_STYLE[(level || 1) - 1] || FRUIT_STYLE[0];
    const colors = [st.color, st.glow, st.juice, "#ffffff"];
    const count = level >= MAX_LEVEL ? 46 : 16;
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * TAU;
      const sp = (level >= MAX_LEVEL ? 120 : 62) * (0.4 + Math.random());
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 24,
        r: 1.4 + Math.random() * (level >= MAX_LEVEL ? 4 : 2.4),
        color: colors[(Math.random() * colors.length) | 0],
        life: 0,
        maxLife: 0.45 + Math.random() * 0.45,
        grav: 200,
      });
    }
    ripples.push({ x, y, r: levelRadius(level) * 0.5, maxR: levelRadius(level) * 2.2, life: 0, maxLife: 0.45, color: st.glow });
  }

  function emitRipple(x, y, level) {
    const st = FRUIT_STYLE[(level || 1) - 1] || FRUIT_STYLE[0];
    ripples.push({ x, y, r: levelRadius(level) * 0.4, maxR: levelRadius(level) * 1.9, life: 0, maxLife: 0.4, color: st.glow });
  }

  // 数字翻倍跳字（如 8→16，越级越大越闪）。
  function popText(x, y, text, chainIndex = 0) {
    pops.push({
      x, y,
      text: String(text),
      size: 13 + Math.min(10, chainIndex * 2.2),
      life: 0,
      maxLife: 0.9,
      chain: chainIndex,
    });
  }

  // 摘瓜：西瓜升起残影 + 藤蔓星光 + 金色爆闪粒子。
  function harvestFx(x, y, level) {
    ghosts.push({ x, y, r: levelRadius(level), life: 0, maxLife: 0.85 });
    ripples.push({ x, y, r: levelRadius(level) * 0.6, maxR: levelRadius(level) * 4.2, life: 0, maxLife: 0.7, color: "#ffd66b", wide: true });
    for (let i = 0; i < 30; i += 1) {
      const a = Math.random() * TAU;
      const sp = 70 + Math.random() * 200;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        r: 1.2 + Math.random() * 2.4, color: "#ffe6a3",
        life: 0, maxLife: 0.55 + Math.random() * 0.55, grav: 60, spark: true,
      });
    }
    // 藤蔓星光：自瓜位向上攀升的绿色光点
    for (let i = 0; i < 16; i += 1) {
      particles.push({
        x: x + (Math.random() - 0.5) * levelRadius(level),
        y, vx: (Math.random() - 0.5) * 40, vy: -90 - Math.random() * 120,
        r: 1 + Math.random() * 1.8, color: "#9fe8b0",
        life: 0, maxLife: 0.7 + Math.random() * 0.4, grav: -40, spark: true,
      });
    }
  }

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const r = ripples[i];
      r.life += dt;
      if (r.life >= r.maxLife) ripples.splice(i, 1);
    }
    for (let i = pops.length - 1; i >= 0; i -= 1) {
      const p = pops[i];
      p.life += dt;
      if (p.life >= p.maxLife) pops.splice(i, 1);
    }
    for (let i = ghosts.length - 1; i >= 0; i -= 1) {
      const gh = ghosts[i];
      gh.life += dt;
      if (gh.life >= gh.maxLife) ghosts.splice(i, 1);
    }
  }

  function drawFx() {
    ctx.save();
    for (const r of ripples) {
      const k = r.life / r.maxLife;
      const rad = r.r + (r.maxR - r.r) * (1 - Math.pow(1 - k, 2));
      ctx.globalAlpha = (1 - k) * 0.55;
      ctx.strokeStyle = hexToRgba(r.color, 1);
      ctx.lineWidth = (r.wide ? 5 : 2.6) * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }
    for (const p of particles) {
      const k = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = p.color;
      if (p.spark) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, TAU);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - k * 0.4), 0, TAU);
        ctx.fill();
      }
    }
    // 数字翻倍跳字：上浮 + 弹性放大 + 金色
    for (const p of pops) {
      const k = p.life / p.maxLife;
      const popScale = k < 0.22 ? 0.6 + (k / 0.22) * 0.55 : 1.15 - (k - 0.22) * 0.18;
      ctx.globalAlpha = Math.max(0, 1 - k * 0.9);
      ctx.font = `900 ${p.size * popScale}px -apple-system, "Segoe UI", Arial, "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = p.chain > 0 ? "#ffb300" : "#ffffff";
      ctx.shadowColor = "rgba(255,190,60,0.85)";
      ctx.shadowBlur = 10;
      ctx.fillText(p.text, p.x, p.y - k * 46);
      ctx.shadowBlur = 0;
    }
    // 摘瓜升起的大西瓜残影
    for (const gh of ghosts) {
      const k = gh.life / gh.maxLife;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.save();
      ctx.translate(gh.x, gh.y - k * 150);
      ctx.scale(1 - k * 0.25, 1 - k * 0.25);
      ctx.globalAlpha = Math.max(0, 0.85 - k);
      fruitBody(MAX_LEVEL, gh.r);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function clearFx() {
    particles.length = 0;
    ripples.length = 0;
    pops.length = 0;
    ghosts.length = 0;
    shake = 0;
  }

  function draw(state, fx = {}) {
    const dt = Math.min(0.05, Number(fx.dt) || 0.016);
    const reduced = !!fx.reduced;
    if (!reduced) clock += dt;
    // 降级模式不推进特效寿命；若仍保留粒子/涟漪，它们会停在初始半径永不消失、
    // 随每次 drop/merge 越积越多成残影。故降级时直接清空且不绘制。
    if (reduced) {
      particles.length = 0;
      ripples.length = 0;
      pops.length = 0;
      ghosts.length = 0;
      shake = 0;
    } else {
      updateFx(dt);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let ox = 0;
    let oy = 0;
    if (!reduced && shake > 0.05) {
      ox = (Math.random() - 0.5) * shake;
      oy = (Math.random() - 0.5) * shake;
      shake *= 0.86;
    } else {
      shake = 0;
    }
    const s = view.scale;
    ctx.setTransform(s, 0, 0, s, ox * s, oy * s);

    drawBackground(reduced);
    drawFrame();
    drawSafetyLine(state, reduced);

    for (const f of state.fruits) drawFruit(f, reduced, 1);

    if (state.status === "playing" && !state.paused) drawAim(state, reduced);

    if (!reduced) drawFx();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => resize());
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    else ro.observe(canvas);
  }
  resize();

  return {
    resize,
    toWorld,
    draw,
    burst: emitBurst,
    ripple: emitRipple,
    popText,
    harvestFx,
    setShake(mag) {
      shake = Math.max(shake, Math.min(14, Number(mag) || 0));
    },
    clearFx,
  };
}
