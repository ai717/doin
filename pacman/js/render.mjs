// render.mjs —— Canvas 2D 霓虹招牌渲染：弯制玻璃灯管、暖白灯泡、四团幽灵光云、柠檬黄张合嘴
//
// 三层画法是本作的招牌质感来源（DOM/CSS 做不出这种层叠发光）：
//   ① 光晕层：大 shadowBlur + 低 alpha     ② 管壁层：饱和管色     ③ 亮芯层：近白细线 + 顶部反光条
// 立体感不靠 3D 引擎：管壁上下明暗 + 内侧投影 + 背板内阴影凹陷即可。

import { CELL, FEATURE, DIR, DIR_VEC, entityPos, ghostTarget, snapOffset } from "./engine.mjs";

/** 逻辑格数：28×31（经典尺寸），逻辑像素 8px/格 */
export const TILE = 8;
export const VIEW_W = 28 * TILE;
export const VIEW_H = 31 * TILE;

const TUBE = "#2f8fb8";
const TUBE_HI = "#cdf3ff";
const GHOST_COLORS = {
  blinky: { body: "#ff4d5e", glow: "#ff8090" },
  pinky: { body: "#ff9ecb", glow: "#ffc4de" },
  inky: { body: "#4ff0e0", glow: "#a6fbf1" },
  clyde: { body: "#ffab52", glow: "#ffd39b" },
};
const FRIGHT_BODY = "#4a6cff";
const FRIGHT_GLOW = "#9fb4ff";
const PLAYER_BODY = "#ffd94a";
const PLAYER_GLOW = "#fff0b0";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createRenderer(canvas) {
  let ctx = null;
  let scale = 1;
  let assist = true;
  let motion = true;
  let t = 0;
  const particles = [];

  function ensure() {
    if (ctx) return ctx;
    if (!canvas || typeof canvas.getContext !== "function") return null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    return ctx;
  }

  /** 按 CSS 尺寸 × dpr 重建画布，并把逻辑坐标系归一化到 28×31 */
  function resize() {
    const c = ensure();
    if (!c) return { w: VIEW_W, h: VIEW_H };
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2.5);
    const cssW = canvas.clientWidth || VIEW_W;
    const cssH = canvas.clientHeight || VIEW_H;
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pxW) canvas.width = pxW;
    if (canvas.height !== pxH) canvas.height = pxH;
    // 逻辑视窗按较短边等比铺满，避免招牌框比例变化时迷宫被拉扁
    scale = Math.min(pxW / VIEW_W, pxH / VIEW_H);
    return { w: pxW, h: pxH };
  }

  /** 逻辑坐标 → 画布像素（含居中偏移） */
  function lx(x) {
    return x * scale + ((canvas.width - VIEW_W * scale) / 2 || 0);
  }
  function ly(y) {
    return y * scale + ((canvas.height - VIEW_H * scale) / 2 || 0);
  }

  function isWall(g, x, y) {
    if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return true;
    return g.cell[y * g.cols + x] === CELL.WALL;
  }

  function isDoor(g, x, y) {
    const i = y * g.cols + x;
    return g.cell[i] === CELL.DOOR;
  }

  // ---------------------------------------------------------------- 灯管墙

  function wallSegments(g) {
    const segs = [];
    for (let y = 0; y < g.rows; y += 1) {
      for (let x = 0; x < g.cols; x += 1) {
        if (!isWall(g, x, y)) continue;
        const cx = (x + 0.5) * TILE;
        const cy = (y + 0.5) * TILE;
        // 与右、下两个邻居连线即可覆盖全部相邻关系（避免重复画）
        if (isWall(g, x + 1, y)) segs.push([cx, cy, cx + TILE, cy]);
        if (isWall(g, x, y + 1)) segs.push([cx, cy, cx, cy + TILE]);
        // 孤立墙块（四邻皆空）也要留一个点，否则会缺一块
        if (!isWall(g, x + 1, y) && !isWall(g, x - 1, y) && !isWall(g, x, y + 1) && !isWall(g, x, y - 1)) {
          segs.push([cx, cy, cx + 0.01, cy]);
        }
      }
    }
    return segs;
  }

  function drawWalls(g, dim) {
    const segs = wallSegments(g);
    const c = ctx;
    c.lineCap = "round";
    c.lineJoin = "round";

    // 墙块底色：先铺一层比背板略亮的墨青，让"墙"是实体、灯管只是它的边
    c.save();
    c.globalAlpha = 0.55 * dim;
    c.fillStyle = "#0a1e28";
    for (let y = 0; y < g.rows; y += 1) {
      for (let x = 0; x < g.cols; x += 1) {
        if (isWall(g, x, y)) c.fillRect(lx(x * TILE), ly(y * TILE), TILE * scale + 0.5, TILE * scale + 0.5);
      }
    }
    c.restore();

    // ① 光晕：管宽必须明显小于格宽，否则相邻墙格会糊成一整块实心发光体
    c.save();
    c.globalAlpha = 0.42 * dim;
    c.strokeStyle = TUBE;
    c.lineWidth = TILE * 0.86;
    c.shadowColor = TUBE;
    c.shadowBlur = 13 * scale;
    strokeSegs(segs);
    c.restore();

    // ② 管壁
    c.save();
    c.globalAlpha = 0.98 * dim;
    c.strokeStyle = TUBE;
    c.lineWidth = TILE * 0.46;
    strokeSegs(segs);
    c.restore();

    // ③ 亮芯 + 顶部反光条：让玻璃管有厚度
    c.save();
    c.globalAlpha = 0.95 * dim;
    c.strokeStyle = TUBE_HI;
    c.lineWidth = Math.max(0.6, TILE * 0.14);
    c.shadowColor = TUBE_HI;
    c.shadowBlur = 4 * scale;
    strokeSegs(segs, -TILE * 0.12);
    c.restore();
  }

  function strokeSegs(segs, dy = 0) {
    const c = ctx;
    c.beginPath();
    for (const [x1, y1, x2, y2] of segs) {
      c.moveTo(lx(x1), ly(y1 + dy));
      c.lineTo(lx(x2), ly(y2 + dy));
    }
    c.stroke();
  }

  function drawDoor(g, dim) {
    const c = ctx;
    for (let y = 0; y < g.rows; y += 1) {
      for (let x = 0; x < g.cols; x += 1) {
        if (!isDoor(g, x, y)) continue;
        const cx = lx((x + 0.5) * TILE);
        const cy = ly((y + 0.5) * TILE);
        c.save();
        c.globalAlpha = 0.75 * dim;
        c.strokeStyle = "#ffd98a";
        c.lineWidth = Math.max(1, TILE * 0.3);
        c.shadowColor = "#ffbe4d";
        c.shadowBlur = 8 * scale;
        c.beginPath();
        c.moveTo(lx(x * TILE), cy);
        c.lineTo(lx((x + 1) * TILE), cy);
        c.stroke();
        c.restore();
        void cx;
      }
    }
  }

  // ---------------------------------------------------------------- 机关格

  function drawFeatures(g, state, dim) {
    const c = ctx;
    const open = state ? state.gatesOpen : true;
    const warn = state ? state.gateWarning : false;
    for (let i = 0; i < g.feature.length; i += 1) {
      const f = g.feature[i];
      if (f === FEATURE.NONE) continue;
      const x = i % g.cols;
      const y = Math.floor(i / g.cols);
      const cx = lx((x + 0.5) * TILE);
      const cy = ly((y + 0.5) * TILE);
      const r = TILE * 0.46 * scale;
      c.save();

      if (f === FEATURE.SYRUP) {
        c.globalAlpha = 0.4 * dim;
        c.fillStyle = "#ffb765";
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fill();
      } else if (f === FEATURE.ICE) {
        c.globalAlpha = 0.45 * dim;
        c.fillStyle = "#bfe9ff";
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 0.8 * dim;
        c.strokeStyle = "#ffffff";
        c.lineWidth = Math.max(0.5, scale);
        c.beginPath();
        c.moveTo(cx - r, cy + r * 0.4);
        c.lineTo(cx + r * 0.7, cy - r * 0.5);
        c.stroke();
      } else if (f === FEATURE.GATE) {
        const pulse = motion && warn ? 0.45 + 0.35 * Math.sin(t * 16) : 0.7;
        c.globalAlpha = (open ? 0.18 : pulse) * dim;
        c.fillStyle = open ? "#7ff0d8" : "#ff6b7d";
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 0.85 * dim;
        c.strokeStyle = open ? "#7ff0d8" : "#ff9aa6";
        c.lineWidth = Math.max(0.6, scale);
        c.stroke();
      }
      c.restore();
    }

    // 单向风道箭头
    for (let i = 0; i < g.oneway.length; i += 1) {
      const d = g.oneway[i];
      if (d < 0) continue;
      const x = i % g.cols;
      const y = Math.floor(i / g.cols);
      const cx = lx((x + 0.5) * TILE);
      const cy = ly((y + 0.5) * TILE);
      const v = DIR_VEC[d];
      c.save();
      c.globalAlpha = 0.6 * dim;
      c.strokeStyle = TUBE_HI;
      c.lineWidth = Math.max(0.6, scale);
      const s = TILE * 0.28 * scale;
      c.beginPath();
      c.moveTo(cx - v.x * s - v.y * s, cy - v.y * s - v.x * s);
      c.lineTo(cx + v.x * s, cy + v.y * s);
      c.lineTo(cx - v.x * s + v.y * s, cy - v.y * s + v.x * s);
      c.stroke();
      c.restore();
    }
  }

  // ---------------------------------------------------------------- 豆

  function drawPellets(g, state, dim) {
    const c = ctx;
    for (let i = 0; i < g.pellets.length; i += 1) {
      const kind = g.pellets[i];
      if (!kind) continue;
      const x = i % g.cols;
      const y = Math.floor(i / g.cols);
      const cx = lx((x + 0.5) * TILE);
      const cy = ly((y + 0.5) * TILE);
      if (kind === 2) {
        // 大功率闪灯：脉动呼吸 + 大光晕
        const pulse = motion ? 0.55 + 0.45 * Math.sin(t * 6) : 0.8;
        c.save();
        c.globalAlpha = dim * pulse;
        c.fillStyle = "#ffe9a8";
        c.shadowColor = "#ffb03a";
        c.shadowBlur = 14 * scale;
        c.beginPath();
        c.arc(cx, cy, TILE * 0.36 * scale * (0.9 + 0.1 * pulse), 0, Math.PI * 2);
        c.fill();
        c.restore();
      } else {
        c.save();
        c.globalAlpha = 0.92 * dim;
        c.fillStyle = "#fff6dc";
        c.shadowColor = "rgba(255, 232, 180, 0.85)";
        c.shadowBlur = 4 * scale;
        c.beginPath();
        c.arc(cx, cy, TILE * 0.13 * scale, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }
    void state;
  }

  // ---------------------------------------------------------------- 玩家

  function drawPlayer(state, dim) {
    const c = ctx;
    const p = state.player;
    const pos = entityPos(p);
    // 迟到转向把主角逻辑上拉回了格心，这里把那段回撤摊成 70ms 的滑移，
    // 否则画面上会看到一次硬生生倒退的跳帧（逻辑对，看着像掉帧）。
    const back = snapOffset(p) * (motion ? 1 : 0);
    const bv = DIR_VEC[p.snapDir] ?? DIR_VEC[DIR.LEFT];
    const cx = lx((pos.x + bv.x * back) * TILE);
    const cy = ly((pos.y + bv.y * back) * TILE);
    const r = TILE * 0.52 * scale;
    const v = DIR_VEC[p.dir] ?? DIR_VEC[DIR.LEFT];
    const ang = Math.atan2(v.y, v.x);
    // 张合嘴：用格内进度做相位，走一步开合一次
    const phase = motion ? Math.abs(Math.sin((p.p + (p.nx === null ? 0 : 0)) * Math.PI * 2)) : 0.6;
    const mouth = (0.12 + 0.5 * phase) * Math.PI;

    c.save();
    c.translate(cx, cy);
    c.rotate(ang);

    c.globalAlpha = dim;
    c.fillStyle = PLAYER_BODY;
    c.shadowColor = PLAYER_GLOW;
    c.shadowBlur = 14 * scale;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
    c.closePath();
    c.fill();

    // 亮芯：让灯管有玻璃厚度
    c.shadowBlur = 0;
    c.globalAlpha = dim * 0.55;
    c.fillStyle = "#fffbe8";
    c.beginPath();
    c.arc(-r * 0.18, -r * 0.2, r * 0.28, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // 预输入方向的小箭头（贴角提前转弯的视觉线索）
    if (assist && p.desired !== p.dir) {
      const dv = DIR_VEC[p.desired];
      c.save();
      c.globalAlpha = dim * 0.75;
      c.strokeStyle = PLAYER_GLOW;
      c.lineWidth = Math.max(0.8, scale);
      c.beginPath();
      c.moveTo(cx + dv.x * r * 1.1, cy + dv.y * r * 1.1);
      c.lineTo(cx + dv.x * r * 1.9, cy + dv.y * r * 1.9);
      c.stroke();
      c.restore();
    }
  }

  // ---------------------------------------------------------------- 幽灵

  function drawGhost(state, gh, dim) {
    const c = ctx;
    const pos = entityPos(gh);
    const cx = lx(pos.x * TILE);
    const cy = ly(pos.y * TILE);
    const r = TILE * 0.5 * scale;
    const eaten = gh.mode === "eaten";
    const fright = gh.mode === "frightened";
    // 接触不良的闪烁：fright 尾段
    const flicker = fright && motion ? 0.55 + 0.45 * Math.sin(t * 18) : 1;
    const col = GHOST_COLORS[gh.id] ?? GHOST_COLORS.blinky;
    const body = fright ? FRIGHT_BODY : col.body;
    const glow = fright ? FRIGHT_GLOW : col.glow;

    if (assist && !eaten) {
      // AI 可读化：脚下的意图柔光环（径向柔光，绝不描硬边圈）
      const grd = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.1);
      grd.addColorStop(0, glow);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      c.save();
      c.globalAlpha = dim * 0.3 * flicker;
      c.fillStyle = grd;
      c.beginPath();
      c.arc(cx, cy, r * 2.1, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    if (eaten) {
      // 只剩两枚眼睛飞回巢
      drawEyes(state, gh, cx, cy, r, dim, "#e8f6ff");
      return;
    }

    c.save();
    c.globalAlpha = dim * flicker;
    c.fillStyle = body;
    c.shadowColor = glow;
    c.shadowBlur = 12 * scale;
    // 光云本体：上圆下裙
    c.beginPath();
    c.arc(cx, cy - r * 0.1, r, Math.PI, 0);
    const feet = 3;
    const stepY = cy + r * 0.85;
    c.lineTo(cx + r, stepY);
    for (let i = 0; i < feet; i += 1) {
      const x0 = cx + r - ((i * 2 + 1) * r) / feet;
      const x1 = cx + r - ((i * 2 + 2) * r) / feet;
      c.quadraticCurveTo(x1, stepY - r * 0.5, x1 - r / feet, stepY);
      void x0;
    }
    c.closePath();
    c.fill();
    c.restore();

    drawEyes(state, gh, cx, cy - r * 0.1, r, dim * flicker, "#ffffff");
  }

  /** 眼睛恒指向真实 target —— 这是"AI 可读化"最有信息量的一笔 */
  function drawEyes(state, gh, cx, cy, r, alpha, color) {
    const c = ctx;
    const tgt = ghostTarget(state, gh);
    const pos = entityPos(gh);
    let dx;
    let dy;
    if (tgt) {
      dx = tgt.x + 0.5 - pos.x;
      dy = tgt.y + 0.5 - pos.y;
    } else {
      // 惊惶中的幽灵没有 target（引擎语义：随机游走），眼睛就顺着当前朝向看
      const v = DIR_VEC[gh.dir] ?? DIR_VEC[DIR.DOWN];
      dx = v.x;
      dy = v.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const eyeR = r * 0.26;
    const off = r * 0.3;
    c.save();
    c.globalAlpha = alpha;
    for (const side of [-1, 1]) {
      const ex = cx + side * off;
      const ey = cy - r * 0.05;
      c.fillStyle = color;
      c.beginPath();
      c.arc(ex, ey, eyeR, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#12304a";
      c.beginPath();
      c.arc(ex + dx * eyeR * 0.45, ey + dy * eyeR * 0.45, eyeR * 0.45, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  // ---------------------------------------------------------------- 巢内充能

  function drawNests(state, dim) {
    if (!assist || !state) return;
    const c = ctx;
    for (const gh of state.ghosts) {
      if (gh.mode !== "caging") continue;
      const cx = lx((gh.tx + 0.5) * TILE);
      const cy = ly((gh.ty + 0.5) * TILE);
      const r = TILE * 0.42 * scale;
      const total = gh.releaseTimer + gh.suppressSeconds || 1;
      const left = clamp(gh.releaseTimer / Math.max(0.001, total), 0, 1);
      c.save();
      c.globalAlpha = dim * 0.9;
      c.strokeStyle = "rgba(255, 217, 74, 0.35)";
      c.lineWidth = Math.max(1, r * 0.3);
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = "#ffd94a";
      c.beginPath();
      c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (1 - left) * Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  // ---------------------------------------------------------------- 粒子

  function pop(x, y, color, count = 8) {
    if (!motion) return;
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      particles.push({
        x: x * TILE,
        y: y * TILE,
        vx: Math.cos(a) * 22,
        vy: Math.sin(a) * 22,
        life: 0.42,
        age: 0,
        color,
      });
    }
    if (particles.length > 240) particles.splice(0, particles.length - 240);
  }

  function drawParticles(dim) {
    const c = ctx;
    for (const p of particles) {
      const k = 1 - p.age / p.life;
      c.save();
      c.globalAlpha = dim * k * 0.9;
      c.fillStyle = p.color;
      c.shadowColor = p.color;
      c.shadowBlur = 6 * scale;
      c.beginPath();
      c.arc(lx(p.x), ly(p.y), TILE * 0.12 * scale * k, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    }
  }

  // ---------------------------------------------------------------- 主绘制

  function draw(state, dt) {
    const c = ensure();
    if (!c || !state) return;
    resize();
    t += dt;
    stepParticles(dt);

    c.clearRect(0, 0, canvas.width, canvas.height);
    const g = state.grid;
    // frightened 时全盘灯管压暗一档（视觉与世界观一致：不是蓝色滤镜，是电压被拉低）
    const dim = state.frightTimer > 0 ? 0.62 : 1;

    // 背板内阴影凹陷：让招牌有实体厚度
    c.save();
    const grd = c.createRadialGradient(
      lx(VIEW_W / 2),
      ly(VIEW_H * 0.35),
      TILE,
      lx(VIEW_W / 2),
      ly(VIEW_H * 0.5),
      VIEW_W * 0.75,
    );
    grd.addColorStop(0, "rgba(30, 96, 124, 0.28)");
    grd.addColorStop(1, "rgba(2, 12, 18, 0.55)");
    c.fillStyle = grd;
    c.fillRect(lx(0), ly(0), VIEW_W * scale, VIEW_H * scale);
    c.restore();

    drawWalls(g, dim);
    drawDoor(g, dim);
    drawFeatures(g, state, dim);
    drawPellets(g, state, dim);
    drawNests(state, dim);
    for (const gh of state.ghosts) drawGhost(state, gh, dim);
    if (state.status !== "lost") drawPlayer(state, dim);
    drawParticles(dim);
  }

  return {
    resize,
    draw,
    pop,
    setAssist(v) {
      assist = v === true;
    },
    setMotion(v) {
      motion = v === true;
      if (!motion) particles.length = 0;
    },
    clearParticles() {
      particles.length = 0;
    },
    get assist() {
      return assist;
    },
    viewSize() {
      return { w: VIEW_W, h: VIEW_H };
    },
  };
}
