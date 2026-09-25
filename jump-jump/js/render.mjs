// render.mjs — 等轴测 2.5D 微缩软胶舞台（Canvas 2D 自绘，唯一碰画面的层）
// 视觉层只做表现：不得读取或改写规则状态，粒子/涟漪等特效全部在此闭环。

import { platformPos, charPos, TAU } from "./engine.mjs";

const ISO_COS = 0.8660254;
const ISO_SIN = 0.5;

const PALETTE = {
  start: { top: "#f6ecdc", side: "#cbbba4", deep: "#9d8b74" },
  plain: [
    { top: "#f6cf85", side: "#d0a457", deep: "#a37c37" }, // 奶酪黄
    { top: "#9fe0bd", side: "#68b491", deep: "#488c6d" }, // 薄荷绿
    { top: "#f6aaa1", side: "#d07f76", deep: "#a55c55" }, // 珊瑚粉
    { top: "#bcd4f2", side: "#8aa9d0", deep: "#6483a8" }, // 雾霭蓝
  ],
  vinyl: { top: "#4a4166", side: "#2f2942", deep: "#1d1a2a" },
  moving: { top: "#8ad7e6", side: "#57a6b8", deep: "#3d7d8d" },
  thin: { top: "#f59aa8", side: "#c96b7c", deep: "#9d4c5c" },
  trampoline: { top: "#62d6c6", side: "#3ba394", deep: "#287a6e" },
  goal: { top: "#ffd166", side: "#d3a03c", deep: "#a37723" },
};

const PAWN = { body: "#ff8c42", light: "#ffc596", dark: "#d9651f", eye: "#3a2416" };

function project(x, y, z) {
  return { x: (x - y) * ISO_COS, y: -(x + y) * ISO_SIN - (z || 0) };
}

function roundedPoly(ctx, pts, r) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1;
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = { x: cur.x + ((prev.x - cur.x) / d1) * rr, y: cur.y + ((prev.y - cur.y) / d1) * rr };
    const b = { x: cur.x + ((next.x - cur.x) / d2) * rr, y: cur.y + ((next.y - cur.y) / d2) * rr };
    if (i === 0) ctx.moveTo(a.x, a.y);
    else ctx.lineTo(a.x, a.y);
    ctx.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
  }
  ctx.closePath();
}

function ellipsePath(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, TAU);
}

export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let cssW = 800;
  let cssH = 520;
  let vw = 800;
  let vh = 520;
  let zoom = 1;
  let cam = null;
  let time = 0;
  let reduced = !!options.reducedMotion;
  let quality = 1;

  const particles = [];
  const ripples = [];
  const rings = [];
  const floaters = [];
  let dust = [];

  function seedDust() {
    dust = [];
    const count = 46;
    for (let i = 0; i < count; i += 1) {
      dust.push({
        x: Math.random() * vw,
        y: Math.random() * vh,
        r: 0.6 + Math.random() * 1.8,
        sp: 3 + Math.random() * 9,
        ph: Math.random() * TAU,
        a: 0.06 + Math.random() * 0.16,
      });
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width || canvas.clientWidth || 800));
    const h = Math.max(200, Math.round(rect.height || canvas.clientHeight || 520));
    dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    cssW = w;
    cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    zoom = Math.max(0.5, Math.min(1.3, Math.min(w / 820, h / 520)));
    vw = w / zoom;
    vh = h / zoom;
    if (!dust.length) seedDust();
  }

  function toScreen(fx, fy, fz) {
    const p = project(fx, fy, fz);
    return { x: (p.x - cam.x) * 1 + vw / 2, y: (p.y - cam.y) * 1 + vh * 0.58 };
  }

  /* 镜头跟随参数
   * - CAM_RATE：指数跟随速率（1 - e^(-rate·dt)），与帧率无关，掉帧不会突然大步追
   * - LEAD：速度前馈提前量，抵消跟随滞后，让镜头在飞行中与棋子基本同速
   * - LOOK/LOOK_RATE：前瞻"下一块平台"的权重与其自身的平滑速率。
   *   平台在落地瞬间会切换（落点 → 再下一块），若直接取用会让镜头目标跳变约半个间距，
   *   表现为落地时画面一顿。对前瞻点单独平滑后，这段过渡变成匀速滑行。
   * - CAM_Z：只跟随部分跳跃高度，避免整屏随棋子上抬下坠
   */
  const CAM_RATE = 12;
  const LEAD = 0.06;
  const VEL_RATE = 7;
  const LOOK = 0.12;
  const LOOK_RATE = 8;
  const CAM_Z = 0.35;
  const SNAP = 900; // 目标跳变过大（切模式 / 重开）直接吸附，避免长距离横移

  let look = null; // 平滑后的前瞻点（世界投影坐标）
  let vsm = null; // 平滑后的棋子速度（世界投影坐标 / 秒）

  function updateCamera(state, dt) {
    const c = charPos(state);
    const cp = project(c.x, c.y, state.char.z * CAM_Z);

    // 棋子当前地面速度 → 投影到屏幕空间（project 对 x/y 是线性的）
    const f = state.flight;
    let vx = 0;
    let vy = 0;
    if (f && f.dur > 0) {
      const sp = f.dist / f.dur;
      vx = f.dirX * sp;
      vy = f.dirY * sp;
    }
    const pv = project(vx, vy, 0);
    const vk = reduced ? 1 : 1 - Math.exp(-VEL_RATE * dt);
    if (!vsm) vsm = { x: pv.x, y: pv.y };
    else {
      vsm.x += (pv.x - vsm.x) * vk;
      vsm.y += (pv.y - vsm.y) * vk;
    }

    // 前瞻点：下一块平台，落点切换时靠自身平滑过渡
    const next = state.platforms[state.index + 1];
    if (next) {
      const np = platformPos(next, state.time);
      const npp = project(np.x, np.y, 0);
      if (!look || Math.hypot(npp.x - look.x, npp.y - look.y) > 900) look = { x: npp.x, y: npp.y };
      else {
        const lk = reduced ? 1 : 1 - Math.exp(-LOOK_RATE * dt);
        look.x += (npp.x - look.x) * lk;
        look.y += (npp.y - look.y) * lk;
      }
    } else if (!look) {
      look = { x: cp.x, y: cp.y };
    }

    // 减弱动效：不做前瞻、直接贴住棋子（前瞻会在落地时造成整屏瞬移）
    const ahead = reduced ? 0 : LEAD;
    const lookW = reduced ? 0 : LOOK;
    const ax = cp.x + vsm.x * ahead;
    const ay = cp.y + vsm.y * ahead;
    const tx = ax + (look.x - ax) * lookW;
    const ty = ay + (look.y - ay) * lookW;

    if (!cam || Math.hypot(tx - cam.x, ty - cam.y) > SNAP) cam = { x: tx, y: ty };
    else if (reduced) {
      cam.x = tx;
      cam.y = ty;
    } else {
      const k = 1 - Math.exp(-CAM_RATE * dt);
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
    }
  }

  /* ---------------- 背景 ---------------- */
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, "#1f2b3d");
    g.addColorStop(0.55, "#18212f");
    g.addColorStop(1, "#111825");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    const drift = reduced ? 0 : time;
    const glows = [
      { x: vw * (0.22 + 0.03 * Math.sin(drift * 0.09)), y: vh * 0.24, r: vw * 0.42, c: "rgba(120, 200, 220, 0.16)" },
      { x: vw * (0.78 + 0.03 * Math.cos(drift * 0.07)), y: vh * 0.68, r: vw * 0.4, c: "rgba(240, 150, 130, 0.13)" },
      { x: vw * 0.5, y: vh * (0.9 + 0.02 * Math.sin(drift * 0.05)), r: vw * 0.55, c: "rgba(90, 120, 190, 0.12)" },
    ];
    for (const gl of glows) {
      const rg = ctx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r);
      rg.addColorStop(0, gl.c);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, vw, vh);
    }

    for (const d of dust) {
      d.y -= d.sp * 0.0035 * (reduced ? 0 : 1);
      if (d.y < -6) {
        d.y = vh + 6;
        d.x = Math.random() * vw;
      }
      const tw = 0.6 + 0.4 * Math.sin(time * 0.8 + d.ph);
      ctx.globalAlpha = d.a * tw;
      ctx.fillStyle = "#cfe6f2";
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.32, vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, vw, vh);
  }

  /* ---------------- 平台 ---------------- */
  function platformPalette(platform) {
    if (platform.type === "plain") return PALETTE.plain[platform.id % PALETTE.plain.length];
    return PALETTE[platform.type] || PALETTE.plain[0];
  }

  function drawShadow(sx, sy, rx, lift) {
    const k = Math.max(0.25, 1 - lift / 460);
    ctx.save();
    ctx.globalAlpha = 0.3 * k;
    const rg = ctx.createRadialGradient(sx, sy + 30, 0, sx, sy + 30, rx * 1.5);
    rg.addColorStop(0, "rgba(0,0,0,0.75)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ellipsePath(ctx, sx, sy + 30, rx * 1.5, rx * 0.75);
    ctx.fill();
    ctx.restore();
  }

  function drawDiscTop(sx, sy, rx, ry, pal) {
    const g = ctx.createLinearGradient(sx - rx, sy - ry, sx + rx, sy + ry);
    g.addColorStop(0, pal.top);
    g.addColorStop(1, pal.side);
    ctx.fillStyle = g;
    ellipsePath(ctx, sx, sy, rx, ry);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 1.4;
    ellipsePath(ctx, sx, sy, rx - 1, ry - 1);
    ctx.stroke();

    // 顶部镜面高光
    ctx.save();
    ctx.globalAlpha = 0.4;
    const hg = ctx.createRadialGradient(sx - rx * 0.34, sy - ry * 0.42, 0, sx - rx * 0.34, sy - ry * 0.42, rx * 0.7);
    hg.addColorStop(0, "rgba(255,255,255,0.9)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hg;
    ellipsePath(ctx, sx, sy, rx, ry);
    ctx.fill();
    ctx.restore();
  }

  function drawDiscBody(sx, sy, rx, ry, h, pal) {
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
    ctx.ellipse(sx, sy + h, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    const g = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);
    g.addColorStop(0, pal.deep);
    g.addColorStop(0.45, pal.side);
    g.addColorStop(1, pal.deep);
    ctx.fillStyle = g;
    ctx.fill();
  }

  function drawBoxTop(sx, sy, rx, ry, pal, round) {
    const pts = [
      { x: sx, y: sy - ry },
      { x: sx + rx, y: sy },
      { x: sx, y: sy + ry },
      { x: sx - rx, y: sy },
    ];
    const g = ctx.createLinearGradient(sx - rx, sy - ry, sx + rx, sy + ry);
    g.addColorStop(0, pal.top);
    g.addColorStop(1, pal.side);
    ctx.fillStyle = g;
    roundedPoly(ctx, pts, round);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.3;
    roundedPoly(ctx, pts, round);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.32;
    const hg = ctx.createRadialGradient(sx - rx * 0.3, sy - ry * 0.35, 0, sx - rx * 0.3, sy - ry * 0.35, rx * 0.8);
    hg.addColorStop(0, "rgba(255,255,255,0.95)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hg;
    roundedPoly(ctx, pts, round);
    ctx.fill();
    ctx.restore();
    return pts;
  }

  function drawBoxBody(sx, sy, rx, ry, h, pal) {
    // 左侧面
    ctx.beginPath();
    ctx.moveTo(sx - rx, sy);
    ctx.lineTo(sx, sy + ry);
    ctx.lineTo(sx, sy + ry + h);
    ctx.lineTo(sx - rx, sy + h);
    ctx.closePath();
    ctx.fillStyle = pal.deep;
    ctx.fill();
    // 右侧面
    ctx.beginPath();
    ctx.moveTo(sx + rx, sy);
    ctx.lineTo(sx, sy + ry);
    ctx.lineTo(sx, sy + ry + h);
    ctx.lineTo(sx + rx, sy + h);
    ctx.closePath();
    ctx.fillStyle = pal.side;
    ctx.fill();
  }

  function drawBullseye(sx, sy, rx, ry, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(255, 226, 150, 0.95)";
    ctx.lineWidth = 1.6;
    ellipsePath(ctx, sx, sy, rx * 0.25, ry * 0.25);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = "rgba(255, 236, 190, 0.8)";
    ctx.lineWidth = 1;
    ellipsePath(ctx, sx, sy, rx * 0.42, ry * 0.42);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.32;
    ellipsePath(ctx, sx, sy, rx * 0.62, ry * 0.62);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlatformDecor(platform, sx, sy, rx, ry, isNext) {
    const t = platform.type;
    if (t === "vinyl") {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "rgba(230, 226, 255, 0.7)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i += 1) {
        ellipsePath(ctx, sx, sy, rx * (0.3 + i * 0.19), ry * (0.3 + i * 0.19));
        ctx.stroke();
      }
      ctx.restore();
      const spin = reduced ? 0 : time * 2.4;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(spin);
      ctx.fillStyle = "#f2b34a";
      ellipsePath(ctx, 0, 0, rx * 0.2, ry * 0.2);
      ctx.fill();
      ctx.fillStyle = "#2b2438";
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, rx * 0.06), 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (t === "trampoline") {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      const squash = reduced ? 1 : 1 - 0.12 * Math.abs(Math.sin(time * 1.6));
      ellipsePath(ctx, sx, sy, rx * 0.72 * squash, ry * 0.72 / squash);
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.2;
      ellipsePath(ctx, sx, sy, rx * 0.48, ry * 0.48);
      ctx.stroke();
      ctx.restore();
    } else if (t === "moving") {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 3);
      ctx.fillStyle = "#ffffff";
      const ax = rx * 0.62;
      const ay = ry * 0.62;
      const dirX = platform.motion ? platform.motion.ax : 1;
      const dirY = platform.motion ? platform.motion.ay : 0;
      const sxDir = (dirX - dirY) * ISO_COS;
      const syDir = -(dirX + dirY) * ISO_SIN;
      const len = Math.hypot(sxDir, syDir) || 1;
      const sign = Math.cos((time / (platform.motion ? platform.motion.period : 3)) * TAU) >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(sx + (sxDir / len) * ax * sign, sy + (syDir / len) * ay * sign);
      ctx.lineTo(sx + (sxDir / len) * ax * sign + (sxDir / len) * 9 * sign, sy + (syDir / len) * ay * sign + (syDir / len) * 9 * sign);
      ctx.lineTo(sx + (sxDir / len) * ax * sign - (syDir / len) * 5, sy + (syDir / len) * ay * sign + (sxDir / len) * 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (t === "goal") {
      ctx.save();
      ctx.strokeStyle = "#8a6a2a";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx, sy - 46);
      ctx.stroke();
      const wave = reduced ? 0 : Math.sin(time * 3) * 2.5;
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.moveTo(sx, sy - 46);
      ctx.lineTo(sx + 26, sy - 40 + wave);
      ctx.lineTo(sx, sy - 32);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff3c9";
      ellipsePath(ctx, sx, sy - 8, rx * 0.26, ry * 0.26);
      ctx.fill();
      ctx.restore();
    }

    if (isNext) {
      const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * 3.4);
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.3 * pulse;
      ctx.strokeStyle = "#ffe9a8";
      ctx.lineWidth = 2.4;
      ellipsePath(ctx, sx, sy, rx + 5, ry + 3);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlatform(platform, state, isNext) {
    const p = platformPos(platform, state.time);
    const s = toScreen(p.x, p.y, 0);
    const r = platform.radius;
    const rx = r * 1.2247;
    const ry = r * 0.7071;
    const h = platform.type === "thin" ? 16 : 26;
    const pal = platformPalette(platform);

    drawShadow(s.x, s.y, rx, 0);
    if (platform.type === "thin" || platform.type === "goal" || platform.type === "trampoline") {
      drawBoxBody(s.x, s.y, rx * 0.86, ry * 0.86, h, pal);
      drawBoxTop(s.x, s.y, rx * 0.86, ry * 0.86, pal, 7);
    } else {
      drawDiscBody(s.x, s.y, rx, ry, h, pal);
      drawDiscTop(s.x, s.y, rx, ry, pal);
    }
    const topRx = platform.type === "thin" ? rx * 0.86 : rx;
    const topRy = platform.type === "thin" ? ry * 0.86 : ry;
    if (platform.type !== "goal") drawBullseye(s.x, s.y, topRx, topRy, isNext ? 0.95 : 0.6);
    drawPlatformDecor(platform, s.x, s.y, topRx, topRy, isNext);
  }

  /* ---------------- 棋子 ---------------- */
  function drawPawn(state) {
    const c = charPos(state);
    const s = toScreen(c.x, c.y, 0);
    const z = state.char.z;
    const lift = Math.max(0.2, 1 - z / 520);
    ctx.save();
    ctx.globalAlpha = 0.34 * lift;
    ctx.fillStyle = "#000";
    ellipsePath(ctx, s.x, s.y, 20 * lift, 9 * lift);
    ctx.fill();
    ctx.restore();

    const p = toScreen(c.x, c.y, z);
    const w = 34;
    const h = 46;
    const sx = state.char.squashX;
    const sy = state.char.squashY;
    const rot = reduced ? 0 : state.char.rot;

    ctx.save();
    ctx.translate(p.x, p.y);
    if (rot) ctx.rotate(rot);
    ctx.scale(sx, sy);

    // 工字棋剪影：底盘 + 细腰 + 顶盘（原点在脚底）
    ctx.fillStyle = PAWN.dark;
    ellipsePath(ctx, 0, -4, w * 0.46, h * 0.11);
    ctx.fill();
    ctx.fillStyle = PAWN.body;
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, -h * 0.16);
    ctx.lineTo(w * 0.26, -h * 0.16);
    ctx.lineTo(w * 0.3, -h * 0.44);
    ctx.lineTo(-w * 0.3, -h * 0.44);
    ctx.closePath();
    ctx.fill();
    ellipsePath(ctx, 0, -h * 0.62, w * 0.44, h * 0.15);
    ctx.fill();

    // 高光与眼睛
    ctx.save();
    ctx.globalAlpha = 0.72;
    const hg = ctx.createLinearGradient(-w * 0.4, -h * 0.8, w * 0.4, -h * 0.1);
    hg.addColorStop(0, "rgba(255,255,255,0.95)");
    hg.addColorStop(0.55, "rgba(255,255,255,0.05)");
    ctx.fillStyle = hg;
    ellipsePath(ctx, 0, -h * 0.62, w * 0.44, h * 0.15);
    ctx.fill();
    ctx.restore();

    if (!rot) {
      const dir = facing(state);
      ctx.fillStyle = PAWN.eye;
      ctx.beginPath();
      ctx.arc(-4 + dir * 2.4, -h * 0.66, 2.1, 0, TAU);
      ctx.arc(4 + dir * 2.4, -h * 0.66, 2.1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // 蓄力：脚底向内收敛的光点
    if (state.phase === "charging") {
      const ratio = Math.min(1, state.charge / 1.8);
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.4 * ratio;
      ctx.strokeStyle = "#ffd98a";
      ctx.lineWidth = 2 + ratio * 2.5;
      ellipsePath(ctx, s.x, s.y, 26 - ratio * 12, 12 - ratio * 5);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU + time * 3;
        const rr = 34 - ratio * 20;
        ctx.fillStyle = "#ffe9b0";
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr * 0.45, 2.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function facing(state) {
    const next = state.platforms[state.index + 1];
    if (!next) return 1;
    const c = charPos(state);
    const np = platformPos(next, state.time);
    const dx = (np.x - c.x - (np.y - c.y)) * ISO_COS;
    return dx >= 0 ? 1 : -1;
  }

  /* ---------------- 特效 ---------------- */
  function spawnBurst(fx, fy, fz, count, color, power) {
    const s = toScreen(fx, fy, fz);
    const n = reduced ? 0 : count;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const sp = power * (0.4 + Math.random() * 0.9);
      particles.push({
        x: s.x,
        y: s.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.55 - power * 0.5,
        g: 420,
        life: 0,
        max: 0.5 + Math.random() * 0.5,
        size: 2 + Math.random() * 3.2,
        color,
      });
    }
  }

  function spawnRipple(fx, fy, maxR) {
    const s = toScreen(fx, fy, 0);
    ripples.push({ x: s.x, y: s.y, r: 6, max: maxR, life: 0, dur: 0.55 });
  }

  function spawnRings(fx, fy, count) {
    const s = toScreen(fx, fy, 0);
    for (let i = 0; i < count; i += 1) {
      rings.push({ x: s.x, y: s.y, r: 8, max: 70 + i * 22, life: -i * 0.09, dur: 0.72, hue: 46 });
    }
  }

  function spawnFloater(fx, fy, text, color) {
    const s = toScreen(fx, fy, 0);
    floaters.push({ x: s.x, y: s.y - 40, text, color, life: 0, dur: 1.05 });
  }

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const r = ripples[i];
      r.life += dt;
      if (r.life >= r.dur) ripples.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      r.life += dt;
      if (r.life >= r.dur) rings.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const f = floaters[i];
      f.life += dt;
      if (f.life >= f.dur) floaters.splice(i, 1);
    }
  }

  function drawFx() {
    for (const r of ripples) {
      const p = r.life / r.dur;
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.4 * (1 - p) + 0.6;
      ellipsePath(ctx, r.x, r.y, r.r + (r.max - r.r) * p, (r.r + (r.max - r.r) * p) * 0.5);
      ctx.stroke();
      ctx.restore();
    }
    for (const r of rings) {
      if (r.life < 0) continue;
      const p = r.life / r.dur;
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.strokeStyle = `hsl(${r.hue}, 95%, 68%)`;
      ctx.lineWidth = 3 * (1 - p) + 1;
      ellipsePath(ctx, r.x, r.y, r.r + (r.max - r.r) * p, (r.r + (r.max - r.r) * p) * 0.5);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of particles) {
      const t = 1 - p.life / p.max;
      ctx.save();
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (const f of floaters) {
      const p = f.life / f.dur;
      ctx.save();
      ctx.globalAlpha = 1 - p * p;
      ctx.font = "700 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(12,18,26,0.8)";
      ctx.strokeText(f.text, f.x, f.y - p * 46);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - p * 46);
      ctx.restore();
    }
  }

  /* ---------------- 主绘制 ---------------- */
  function draw(state, dt) {
    if (!cam) updateCamera(state, 1);
    else updateCamera(state, dt);
    time += dt;

    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    drawBackground();

    const from = Math.max(0, state.index - 2);
    const to = Math.min(state.platforms.length, state.index + 5);
    const visible = [];
    for (let i = from; i < to; i += 1) visible.push(state.platforms[i]);
    visible.sort((a, b) => a.x + a.y - (b.x + b.y));

    for (const platform of visible) {
      drawPlatform(platform, state, platform === state.platforms[state.index + 1]);
    }

    drawFx();
    if (state.phase !== "lost" || (state.fall && state.fall.t < 0.6)) drawPawn(state);

    updateFx(dt);
  }

  return {
    resize,
    draw,
    setReducedMotion(value) {
      reduced = !!value;
      if (reduced) {
        particles.length = 0;
        ripples.length = 0;
        rings.length = 0;
        floaters.length = 0;
      }
    },
    get reducedMotion() {
      return reduced;
    },
    get size() {
      return { w: cssW, h: cssH, zoom };
    },
    // 只读调试探针：供无头验收量化镜头平滑度
    get camera() {
      return cam ? { x: cam.x, y: cam.y } : null;
    },
    onEvent(evt, state) {
      if (!evt) return;
      const c = charPos(state);
      if (evt.type === "landed") {
        const z = 0;
        spawnRipple(c.x, c.y, 58);
        if (evt.kind === "perfect") {
          spawnRings(c.x, c.y, 3);
          spawnBurst(c.x, c.y, z, 26, "#ffd166", 210);
          spawnFloater(c.x, c.y, `+${evt.gain}`, "#ffd166");
        } else if (evt.kind === "trampoline") {
          spawnBurst(c.x, c.y, z, 22, "#7ef0dd", 240);
          spawnFloater(c.x, c.y, `+${evt.gain}`, "#7ef0dd");
        } else {
          spawnBurst(c.x, c.y, z, 10, "#e8f2ff", 110);
          spawnFloater(c.x, c.y, `+${evt.gain}`, "#eaf4ff");
        }
      } else if (evt.type === "vinyl") {
        spawnBurst(c.x, c.y, 0, 20, "#c9b6ff", 150);
        spawnFloater(c.x, c.y, `+${evt.gain}`, "#c9b6ff");
      } else if (evt.type === "launch") {
        spawnRipple(c.x, c.y, 42);
      } else if (evt.type === "recover") {
        // 棋子即将从台面下升起：先在落点画一圈涟漪作为预告
        spawnRipple(c.x, c.y, 52);
      } else if (evt.type === "fall") {
        spawnBurst(c.x, c.y, 0, 16, "#8fa6bd", 130);
      } else if (evt.type === "win") {
        spawnRings(c.x, c.y, 4);
        spawnBurst(c.x, c.y, 0, 40, "#ffd166", 260);
      }
    },
  };
}
