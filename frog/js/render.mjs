// Canvas 渲染层：唯一绘制棋盘的地方。软胶玩具桌面戏剧台美学。
// 车辆/浮木用连续相位 time*speed 做平滑子格插值；判定在 engine 用离散跳格。
// 本层还负责所有一次性/连续性特效：跳动、落水涟漪、撞击火花、归巢彩带、环境光点。
// 特效通过「观察状态变化」自动触发（hop/home/death），不依赖 engine 额外事件字段。
import {
  COLS, ROWS, HOME_ROW, MEDIAN_ROW, START_ROW, RIVER_ROWS, ROAD_ROWS,
  mulberry32,
} from "./engine.mjs";

// 把 0/1 pattern 拆成连续「1 段」列表，供渲染逐段绘制。
export function segments(pattern) {
  const out = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === 1) {
      const start = i;
      while (i < pattern.length && pattern[i] === 1) i += 1;
      out.push({ start, len: i - start });
    } else {
      i += 1;
    }
  }
  return out;
}

function posmod(a, n) {
  return ((a % n) + n) % n;
}

const COLORS = {
  grassA: "#9dd489",
  grassB: "#8ecb76",
  grassC: "#7cc469",
  median: "#6fca5f",
  road: "#3a3c45",
  roadLane: "#e8e2cf",
  roadEdge: "#2d2f37",
  waterA: "#3f9bdd",
  waterB: "#6fc6f5",
  waterHi: "rgba(255,255,255,0.25)",
  homeBase: "#4e7036",
  logA: "#a9713c",
  logB: "#c98d52",
  logRing: "#5f3b1c",
  lily: "#48b351",
  lilyDark: "#2f8a3c",
};

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function ellipse(ctx, cx, cy, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
}

export function isWaterRow(row) {
  return RIVER_ROWS.includes(row);
}

export function isRoadRowRender(row) {
  return ROAD_ROWS.includes(row);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let cell = 1;
  let dpr = 1;

  // 一次性粒子（火花/水花/彩带）与扩散涟漪环
  const parts = [];
  const rings = [];

  // 状态变化跟踪：用于自动触发跳跃/归巢/死亡特效
  let prevFrog = null;
  let prevHomes = 0;
  let prevLives = null;
  let lastHopTime = -1;

  // 环境漂浮光点：种子固定，确定性
  const motes = [];
  {
    const rng = mulberry32(987654321);
    for (let i = 0; i < 26; i += 1) {
      motes.push({
        fx: rng(),
        fy: rng() * 0.5,           // 只飘在上半场（天空/水面感）
        r: 1 + rng() * 2.2,
        sp: 0.4 + rng() * 0.9,
        ph: rng() * Math.PI * 2,
      });
    }
  }

  function resize(containerW, containerH) {
    dpr = Math.max(1, Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
    cell = Math.max(6, Math.floor(Math.min(containerW / COLS, containerH / ROWS)));
    const w = COLS * cell;
    const h = ROWS * cell;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  // 重置特效跟踪（新开一关时调用，避免上一关残影）
  function reset() {
    parts.length = 0;
    rings.length = 0;
    prevFrog = null;
    prevHomes = 0;
    prevLives = null;
    lastHopTime = -1;
  }

  function burst(type, row, col) {
    const x = (col + 0.5) * cell;
    const y = (row + 0.5) * cell;
    const sets = {
      hit: { colors: ["#ffb03a", "#ffd166", "#fff5c2", "#ffffff"], n: 14, up: -1.2, sp: 3.2 },
      drown: { colors: ["#7fc4f2", "#cdeeff", "#ffffff", "#54a7e4"], n: 12, up: -0.6, sp: 1.8 },
      home: { colors: ["#ffe066", "#7bd86b", "#6fc6f5", "#ff9f43", "#c88bff"], n: 18, up: -2.2, sp: 3.6 },
      hop: { colors: ["#e9e2cf", "#ffffff", "#cde3b8"], n: 6, up: -0.6, sp: 1.2 },
      fly: { colors: ["#fff3b0", "#ffe066", "#ffffff"], n: 8, up: -1.4, sp: 2.2 },
    };
    const s = sets[type] || sets.hop;
    for (let i = 0; i < s.n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = s.sp * (0.4 + Math.random() * 0.8);
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + s.up,
        life: 1,
        r: 1.4 + Math.random() * 2.4,
        color: s.colors[i % s.colors.length],
      });
    }
  }

  function ripple(row, col) {
    rings.push({ x: (col + 0.5) * cell, y: (row + 0.5) * cell, age: 0 });
  }

  function emit(type, row, col) {
    burst(type, row, col);
    if (type === "drown" || type === "hop") ripple(row, col);
  }

  function drawBackground(time) {
    const w = COLS * cell;
    for (let row = 0; row < ROWS; row += 1) {
      const y = row * cell;
      if (row === HOME_ROW) {
        ctx.fillStyle = COLORS.homeBase;
        ctx.fillRect(0, y, w, cell);
      } else if (row === MEDIAN_ROW) {
        ctx.fillStyle = COLORS.median;
        ctx.fillRect(0, y, w, cell);
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        for (let c = 0; c < COLS; c += 2) ctx.fillRect(c * cell + 5, y + 5, cell - 10, cell - 10);
      } else if (row === START_ROW) {
        const g = ctx.createLinearGradient(0, y, 0, y + cell);
        g.addColorStop(0, COLORS.grassA);
        g.addColorStop(1, COLORS.grassB);
        ctx.fillStyle = g;
        ctx.fillRect(0, y, w, cell);
      } else if (isRoadRowRender(row)) {
        ctx.fillStyle = COLORS.road;
        ctx.fillRect(0, y, w, cell);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, y, w, 2);
        ctx.fillStyle = COLORS.roadLane;
        for (let c = 0; c < COLS; c += 2) {
          ctx.fillRect(c * cell + cell * 0.18, y + cell / 2 - 1, cell * 0.64, 2);
        }
      } else if (isWaterRow(row)) {
        const g = ctx.createLinearGradient(0, y, 0, y + cell);
        g.addColorStop(0, COLORS.waterA);
        g.addColorStop(1, COLORS.waterB);
        ctx.fillStyle = g;
        ctx.fillRect(0, y, w, cell);
        // 缓缓移动的波光
        ctx.fillStyle = COLORS.waterHi;
        for (let c = 0; c < COLS; c += 1) {
          const phase = Math.sin(time * 1.6 + row * 1.1 + c * 0.9);
          ctx.globalAlpha = 0.12 + 0.12 * phase;
          ctx.fillRect(c * cell + cell * 0.15, y + cell * (0.4 + 0.15 * phase), cell * 0.7, 1.5);
        }
        ctx.globalAlpha = 1;
      }
    }
    // 网格细线
    ctx.strokeStyle = "rgba(0,0,0,0.04)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c += 1) {
      ctx.beginPath();
      ctx.moveTo(c * cell, 0);
      ctx.lineTo(c * cell, ROWS * cell);
      ctx.stroke();
    }
  }

  function drawLogs(state) {
    for (const river of state.rivers) {
      const phase = state.time * river.speed * river.dir;
      const y = river.row * cell;
      const bob = Math.sin(state.time * 2 + river.row) * 1;
      for (const seg of segments(river.pattern)) {
        const sx = posmod(seg.start + phase, COLS);
        const ex = sx + seg.len;
        if (ex <= COLS) {
          drawLogAt(sx * cell, y + bob, seg.len * cell);
        } else {
          drawLogAt(sx * cell, y + bob, (COLS - sx) * cell);
          drawLogAt(0, y + bob, (ex - COLS) * cell);
        }
      }
    }
  }

  function drawLogAt(x, y, w) {
    const pad = 2;
    // 边缘换行可能切出亚像素碎片，宽度不足时跳过，避免 roundedRect 负半径抛错。
    if (w <= pad * 2 + 1) return;
    const h = cell - pad * 2;
    const lx = x + pad;
    const ly = y + pad;
    const g = ctx.createLinearGradient(lx, ly, lx, ly + h);
    g.addColorStop(0, COLORS.logB);
    g.addColorStop(0.5, COLORS.logA);
    g.addColorStop(1, "#8b5a2c");
    ctx.fillStyle = g;
    roundedRect(ctx, lx, ly, w - pad * 2, h, 5);
    ctx.fill();
    // 木纹纵向纹理
    ctx.strokeStyle = "rgba(60,30,10,0.28)";
    ctx.lineWidth = 1;
    for (let i = cell * 0.4; i < w - pad * 2; i += cell * 0.9) {
      ctx.beginPath();
      ctx.moveTo(lx + i, ly + 3);
      ctx.lineTo(lx + i, ly + h - 3);
      ctx.stroke();
    }
    // 两端年轮
    ctx.fillStyle = COLORS.logRing;
    ctx.beginPath();
    ctx.arc(lx + h / 2, ly + h / 2, h * 0.42, 0, Math.PI * 2);
    ctx.arc(lx + w - pad * 2 - h / 2, ly + h / 2, h * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(lx + h / 2, ly + h / 2, h * 0.18, 0, Math.PI * 2);
    ctx.arc(lx + w - pad * 2 - h / 2, ly + h / 2, h * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLilies(state) {
    for (const river of state.rivers) {
      if (!river.still) continue;
      const y = river.row * cell;
      for (const col of river.still) {
        const cx = (col + 0.5) * cell;
        const cy = y + cell / 2;
        const r = cell * 0.44;
        // 叶片带缺口的莲叶
        const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
        g.addColorStop(0, COLORS.lily);
        g.addColorStop(1, COLORS.lilyDark);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI * 0.25, Math.PI * 1.85);
        ctx.quadraticCurveTo(cx, cy, cx + r * 0.9, cy + r * 0.3);
        ctx.closePath();
        ctx.fill();
        // 叶脉
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k += 1) {
          const a = Math.PI * (0.2 + k * 0.25);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75);
          ctx.stroke();
        }
      }
    }
  }

  function drawVehicles(state) {
    for (const lane of state.lanes) {
      const phase = state.time * lane.speed * lane.dir;
      const y = lane.row * cell;
      for (const seg of segments(lane.pattern)) {
        const sx = posmod(seg.start + phase, COLS);
        const ex = sx + seg.len;
        if (ex <= COLS) {
          drawVehicle(sx * cell, y, seg.len * cell, lane.dir);
        } else {
          drawVehicle(sx * cell, y, (COLS - sx) * cell, lane.dir);
          drawVehicle(0, y, (ex - COLS) * cell, lane.dir);
        }
      }
    }
  }

  function drawVehicle(x, y, w, dir) {
    const pad = 3;
    // 边缘换行可能切出亚像素碎片，宽度不足时跳过，避免 ellipse 负半径抛错。
    if (w <= pad * 2 + 1) return;
    const h = cell - pad * 2 - 3;
    const lx = x + pad;
    const ly = y + pad + 1;
    // 车底阴影
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ellipse(ctx, lx + w / 2 - pad, y + cell - 3, w / 2 - pad, 2.5);

    const truck = w > cell * 1.5;
    const body = truck ? "#ff9f43" : "#ff6b6b";
    const g = ctx.createLinearGradient(lx, ly, lx, ly + h);
    g.addColorStop(0, body);
    g.addColorStop(1, truck ? "#e07b22" : "#d84b4b");
    ctx.fillStyle = g;
    roundedRect(ctx, lx, ly, w - pad * 2, h, 4);
    ctx.fill();

    if (truck) {
      // 卡车：货厢 + 驾驶室 + 车窗
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundedRect(ctx, lx + 2, ly + 2, (w - pad * 2) * 0.55, h - 4, 2);
      ctx.fill();
      const cabX = dir > 0 ? x + w - pad - (w * 0.32) : lx;
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      roundedRect(ctx, cabX, ly, w * 0.32, h, 3);
      ctx.fill();
      ctx.fillStyle = "#e8f0ff";
      roundedRect(ctx, cabX + (dir > 0 ? w * 0.16 : 2), ly + 2, w * 0.12, h - 4, 2);
      ctx.fill();
    } else {
      // 轿车：车顶弧线 + 前后车窗
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      roundedRect(ctx, lx + w * 0.18, ly - 3, w * 0.64, h + 3, 4);
      ctx.fill();
      ctx.fillStyle = "#e8f0ff";
      const winW = w * 0.24;
      roundedRect(ctx, lx + w * 0.24, ly - 1, winW, h * 0.55, 2);
      ctx.fill();
      roundedRect(ctx, lx + w * 0.52, ly - 1, winW, h * 0.55, 2);
      ctx.fill();
    }

    // 车灯：方向决定车头
    ctx.fillStyle = dir > 0 ? "#fff1b8" : "#ff6b5e";
    const lx2 = dir > 0 ? x + w - pad - 2 : lx;
    roundedRect(ctx, lx2, ly + h * 0.3, 2, h * 0.4, 1);
    ctx.fill();

    // 车轮（带轮毂）
    ctx.fillStyle = "#1d1f26";
    const wy = y + cell - pad - 2;
    ctx.beginPath();
    ctx.arc(lx + 5, wy, 2.8, 0, Math.PI * 2);
    ctx.arc(x + w - pad - 5, wy, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(lx + 5, wy, 1.1, 0, Math.PI * 2);
    ctx.arc(x + w - pad - 5, wy, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHomes(state, time) {
    const y = HOME_ROW * cell;
    for (let i = 0; i < state.homeCols.length; i += 1) {
      const col = state.homeCols[i];
      const x = col * cell;
      const filled = state.homes[i];
      const g = ctx.createLinearGradient(x, y, x, y + cell);
      g.addColorStop(0, filled ? "#4a8030" : "#586f3c");
      g.addColorStop(1, filled ? "#35611f" : "#42532c");
      ctx.fillStyle = g;
      roundedRect(ctx, x + 3, y + 4, cell - 6, cell - 5, 5);
      ctx.fill();
      if (filled) {
        // 已归巢的小青蛙剪影 + 柔光
        const cx = x + cell / 2;
        const cy = y + cell / 2 + 1;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.5);
        glow.addColorStop(0, "rgba(207,232,154,0.9)");
        glow.addColorStop(1, "rgba(207,232,154,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b5d982";
        ellipse(ctx, cx, cy, cell * 0.24, cell * 0.2);
        ctx.fill();
        ctx.fillStyle = "#f4ffe0";
        ctx.beginPath();
        ctx.arc(cx - cell * 0.09, cy - cell * 0.1, cell * 0.05, 0, Math.PI * 2);
        ctx.arc(cx + cell * 0.09, cy - cell * 0.1, cell * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawFly(state, time) {
    if (state.flyHome < 0 || state.flyHome >= state.homeCols.length) return;
    if (state.homes[state.flyHome]) return;
    const col = state.homeCols[state.flyHome];
    const blip = 0.5 + 0.5 * Math.sin(time * 6);
    const x = (col + 0.5) * cell + Math.sin(time * 3) * 3;
    const y = HOME_ROW * cell + cell / 2 - 4 + Math.cos(time * 4) * 2;
    const r = 3 + blip * 2;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    g.addColorStop(0, "rgba(255,240,140,0.95)");
    g.addColorStop(1, "rgba(255,220,80,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    // 翅膀
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const wing = 2 + blip * 1.6;
    ellipse(ctx, x - 5, y - 1, wing, wing * 0.5, -0.5);
    ellipse(ctx, x + 5, y - 1, wing, wing * 0.5, 0.5);
    ctx.fill();
    // 尾迹光点
    ctx.fillStyle = "rgba(255,230,120,0.7)";
    for (let k = 1; k <= 3; k += 1) {
      const tx = x - Math.sin(time * 6) * k * 5;
      const ty = y + Math.cos(time * 6) * k * 2;
      ctx.globalAlpha = 0.5 / k;
      ctx.beginPath();
      ctx.arc(tx, ty, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFrog(state, time) {
    const f = state.frog;
    const x = (f.col + 0.5) * cell;
    const y = (f.row + 0.5) * cell;
    const r = cell * 0.38;

    // 落地挤压（跳跃后短时间内压扁）
    const sinceHop = lastHopTime < 0 ? 1 : time - lastHopTime;
    const squash = Math.max(0, 1 - sinceHop / 0.16) * 0.2;
    const breathe = Math.sin(time * 3.1) * 0.04;

    // 软阴影
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ellipse(ctx, x, y + cell * 0.34, r * 1.05 + squash * 6, r * 0.34 - squash * 2);
    ctx.fill();

    const bodyRx = r * (1 + squash);
    const bodyRy = r * 0.84 * (1 - squash + breathe);

    // 后腿（蹲姿，身体两侧）
    ctx.fillStyle = "#3f9c3a";
    ellipse(ctx, x - r * 0.95, y + r * 0.15, r * 0.34, r * 0.5, -0.7);
    ellipse(ctx, x + r * 0.95, y + r * 0.15, r * 0.34, r * 0.5, 0.7);
    ctx.fill();

    // 前脚掌
    ctx.fillStyle = "#3f9c3a";
    ellipse(ctx, x - r * 0.85, y + r * 0.55, r * 0.22, r * 0.16, 0);
    ellipse(ctx, x + r * 0.85, y + r * 0.55, r * 0.22, r * 0.16, 0);
    ctx.fill();

    // 身体（球形渐变）
    const bg = ctx.createRadialGradient(x - r * 0.25, y - r * 0.45, r * 0.1, x, y, r * 1.15);
    bg.addColorStop(0, "#8be27c");
    bg.addColorStop(0.55, "#58c24f");
    bg.addColorStop(1, "#3f9c3a");
    ctx.fillStyle = bg;
    ellipse(ctx, x, y, bodyRx, bodyRy * 1.05);
    ctx.fill();

    // 肚皮
    ctx.fillStyle = "rgba(230,255,210,0.85)";
    ellipse(ctx, x, y + r * 0.35, r * 0.5 * (1 + squash), r * 0.4 * (1 - squash));
    ctx.fill();

    // 眼睛凸起
    const eyeY = y - r * 0.62;
    ctx.fillStyle = "#58c24f";
    ellipse(ctx, x - r * 0.46, eyeY, r * 0.3, r * 0.26);
    ellipse(ctx, x + r * 0.46, eyeY, r * 0.3, r * 0.26);
    ctx.fill();
    // 眼白
    ctx.fillStyle = "#ffffff";
    ellipse(ctx, x - r * 0.46, eyeY - r * 0.02, r * 0.26, r * 0.24);
    ellipse(ctx, x + r * 0.46, eyeY - r * 0.02, r * 0.26, r * 0.24);
    ctx.fill();
    // 瞳孔
    ctx.fillStyle = "#151719";
    ctx.beginPath();
    ctx.arc(x - r * 0.46, eyeY, r * 0.14, 0, Math.PI * 2);
    ctx.arc(x + r * 0.46, eyeY, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(x - r * 0.52, eyeY - r * 0.07, r * 0.05, 0, Math.PI * 2);
    ctx.arc(x + r * 0.4, eyeY - r * 0.07, r * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 嘴
    ctx.strokeStyle = "rgba(20,60,20,0.55)";
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.12, r * 0.34, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  function drawMotes(time) {
    for (const m of motes) {
      const x = (m.fx + 0.03 * Math.sin(time * m.sp + m.ph)) * COLS * cell;
      const y = ((m.fy * ROWS + time * 0.06 * m.sp) % (ROWS * 0.6)) * cell;
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * m.sp * 2 + m.ph));
      ctx.globalAlpha = 0.12 * tw + 0.04;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawParts() {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.055;
      p.life -= 0.028;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + p.life * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    ctx.lineWidth = 2;
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      r.age += 0.05;
      if (r.age >= 1) {
        rings.splice(i, 1);
        continue;
      }
      const rad = cell * (0.2 + r.age * 0.7);
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - r.age)})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function trackTransitions(state) {
    const f = state.frog;
    if (prevFrog) {
      const moved = f.row !== prevFrog.row || f.col !== prevFrog.col;
      if (state.homesFilled > prevHomes) {
        burst("home", HOME_ROW, prevFrog.col);
        ripple(HOME_ROW, prevFrog.col);
        lastHopTime = -1;
      } else if (state.lives < prevLives) {
        const pr = prevFrog.row;
        const pc = prevFrog.col;
        if (isRoadRowRender(pr)) {
          burst("hit", pr, pc);
        } else if (isWaterRow(pr)) {
          burst("drown", pr, pc);
          ripple(pr, pc);
        } else {
          burst("hop", pr, pc);
        }
        lastHopTime = -1;
      } else if (moved) {
        const d = Math.abs(f.row - prevFrog.row) + Math.abs(f.col - prevFrog.col);
        if (d === 1) {
          lastHopTime = state.time;
          burst("hop", f.row, f.col);
          if (isWaterRow(f.row)) ripple(f.row, f.col);
        }
      }
    }
    prevFrog = { row: f.row, col: f.col };
    prevHomes = state.homesFilled;
    prevLives = state.lives;
  }

  function draw(state) {
    const w = COLS * cell;
    const h = ROWS * cell;
    ctx.clearRect(0, 0, w, h);
    drawBackground(state.time);
    trackTransitions(state);
    drawMotes(state.time);
    drawLogs(state);
    drawLilies(state);
    drawHomes(state, state.time);
    drawFly(state, state.time);
    drawVehicles(state);
    drawFrog(state, state.time);
    drawParts();
    drawRings();
  }

  return { resize, draw, emit, reset, particleCount: () => parts.length };
}