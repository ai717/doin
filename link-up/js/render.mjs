// 连连看 link-up · Canvas 2D 特效层：金色流光路径 / 消除粒子 / 通关灯笼
// 只读 engine 状态，绝不修改规则；棋盘本体由 DOM 渲染，本层只管视觉

let canvas = null;
let ctx = null;
let cols = 0;
let rows = 0;
let cellW = 0;
let cellH = 0;
let dpr = 1;
let reduced = false;

let pathAnim = null;
let particles = [];
let rings = [];
let lantern = null;
let rafId = 0;

function extToPx(ext) {
  return { x: (ext.c - 0.5) * cellW, y: (ext.r - 0.5) * cellH };
}
function boardToPx(b) {
  return { x: (b.c + 0.5) * cellW, y: (b.r + 0.5) * cellH };
}

function computeCell() {
  if (!canvas || !cols || !rows) return;
  cellW = canvas.clientWidth / cols;
  cellH = canvas.clientHeight / rows;
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(2, (window.devicePixelRatio || 1) || 1);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  computeCell();
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function init(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext("2d");
  reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  resize();
  if (typeof ResizeObserver !== "undefined" && canvas && canvas.parentElement) {
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement);
  }
  window.addEventListener("resize", resize);
}

export function setGrid(r, c) {
  rows = r;
  cols = c;
  computeCell();
  clear();
}

export function clear() {
  pathAnim = null;
  particles = [];
  rings = [];
  lantern = null;
  if (reducedClearTimer) {
    clearTimeout(reducedClearTimer);
    reducedClearTimer = 0;
  }
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function stopIfIdle() {
  if (!pathAnim && particles.length === 0 && rings.length === 0 && !lantern) {
    rafId = 0;
  }
}

function loop() {
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (pathAnim) drawPathFrame();
  drawRings();
  drawParticles();
  if (lantern) drawLanternFrame();

  if (pathAnim || particles.length > 0 || rings.length > 0 || lantern) {
    rafId = requestAnimationFrame(loop);
  } else {
    rafId = 0;
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function ensureLoop() {
  if (!rafId) rafId = requestAnimationFrame(loop);
}

// ---------- 金色流光路径 ----------
let reducedClearTimer = 0;
export function drawPath(path, done) {
  if (!ctx) {
    if (done) done();
    return;
  }
  if (reduced) {
    // 减少动效：瞬时画金线，短暂显示后显式清空（避免残留）
    if (reducedClearTimer) {
      clearTimeout(reducedClearTimer);
      reducedClearTimer = 0;
    }
    const pts = path.map(extToPx);
    ctx.save();
    ctx.strokeStyle = "#E8B64C";
    ctx.lineWidth = Math.max(2, Math.min(cellW, cellH) * 0.16);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
    if (done) done();
    reducedClearTimer = setTimeout(() => {
      reducedClearTimer = 0;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 320);
    return;
  }
  pathAnim = { pts: path.map(extToPx), t: 0, dur: 0.42, done, sparks: [] };
  ensureLoop();
}

function drawPathFrame() {
  const anim = pathAnim;
  anim.t += 1 / 60 / anim.dur;
  const t = Math.min(1, anim.t);
  const pts = anim.pts;
  const totalLen = polyLength(pts);
  const target = totalLen * easeInOut(t);
  const head = pointAlong(pts, target);

  // 先铺一层暗金轨迹，再用渐变高光扫过，避免“单根硬线”的廉价感。
  drawRoute(pts, target, {
    strokeStyle: "rgba(255, 198, 67, .22)",
    lineWidth: Math.max(8, Math.min(cellW, cellH) * .34),
    shadowColor: "rgba(255, 144, 42, .8)",
    shadowBlur: 22,
  });
  const gradient = ctx.createLinearGradient(pts[0].x, pts[0].y, head.x, head.y);
  gradient.addColorStop(0, "#fff1a8");
  gradient.addColorStop(.45, "#f5d97a");
  gradient.addColorStop(1, "#e8a52f");
  drawRoute(pts, target, {
    strokeStyle: gradient,
    lineWidth: Math.max(3, Math.min(cellW, cellH) * .16),
    shadowColor: "rgba(255, 235, 155, .95)",
    shadowBlur: 12,
  });

  // 移动能量珠 + 两端脉冲环，让连线具备“正在传递”的方向感。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const orb = Math.max(4, Math.min(cellW, cellH) * .11);
  const orbGlow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, orb * 3);
  orbGlow.addColorStop(0, "rgba(255,255,226,.98)");
  orbGlow.addColorStop(.3, "rgba(255,220,102,.72)");
  orbGlow.addColorStop(1, "rgba(255,170,42,0)");
  ctx.fillStyle = orbGlow;
  ctx.beginPath(); ctx.arc(head.x, head.y, orb * 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fffbe1";
  ctx.beginPath(); ctx.arc(head.x, head.y, orb * .42, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  drawEndpoint(pts[0], .7 + .3 * t, false);
  drawEndpoint(pts[pts.length - 1], .7 + .3 * t, true);
  if (Math.random() < .75) particles.push(spark(head.x, head.y));

  if (t >= 1) {
    const cb = anim.done;
    pathAnim = null;
    rings.push({ x: pts[0].x, y: pts[0].y, t: 0, max: .42 });
    rings.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, t: 0, max: .42 });
    for (let i = 0; i < 8; i++) particles.push(spark(pts[pts.length - 1].x, pts[pts.length - 1].y));
    if (cb) cb();
  }
}

function drawRoute(pts, target, style) {
  if (!pts.length) return;
  let acc = 0;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = style.strokeStyle;
  ctx.lineWidth = style.lineWidth;
  ctx.shadowColor = style.shadowColor;
  ctx.shadowBlur = style.shadowBlur;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]; const b = pts[i + 1]; const len = dist(a, b);
    if (acc + len <= target) {
      ctx.lineTo(b.x, b.y);
      acc += len;
      continue;
    }
    const f = len ? Math.max(0, Math.min(1, (target - acc) / len)) : 0;
    ctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
    break;
  }
  ctx.stroke();
  ctx.restore();
}

function drawEndpoint(p, alpha, filled) {
  const radius = Math.max(5, Math.min(cellW, cellH) * .18);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = filled ? "#fff1a1" : "#f5d97a";
  ctx.lineWidth = Math.max(2, radius * .16);
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha *= .45;
  ctx.beginPath(); ctx.arc(p.x, p.y, radius * 1.65, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawRings() {
  const dt = 1 / 60;
  rings = rings.filter((ring) => ring.t < ring.max);
  for (const ring of rings) {
    ring.t += dt;
    const k = 1 - ring.t / ring.max;
    ctx.save();
    ctx.globalAlpha = Math.max(0, k);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "#f5d97a";
    ctx.lineWidth = Math.max(1.5, Math.min(cellW, cellH) * .05);
    ctx.beginPath(); ctx.arc(ring.x, ring.y, Math.min(cellW, cellH) * (.14 + .38 * (1 - k)), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

// ---------- 粒子 ----------
function spark(x, y) {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 60,
    vy: -20 - Math.random() * 50,
    life: 0,
    max: 0.5 + Math.random() * 0.4,
    size: 1 + Math.random() * 2,
    color: Math.random() < 0.5 ? "#F5D97A" : "#E8B64C",
  };
}

export function burstCell(cell) {
  if (!ctx) return;
  if (reduced) return; // 减少动效：跳过粒子
  const p = boardToPx(cell);
  const colors = ["#F5D97A", "#E8B64C", "#D94F4F", "#FFFFFF"];
  for (let i = 0; i < 16; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 130;
    particles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 40,
      life: 0,
      max: 0.5 + Math.random() * 0.55,
      size: 1.2 + Math.random() * 2.4,
      color: colors[i % colors.length],
    });
  }
  ensureLoop();
}

function drawParticles() {
  const dt = 1 / 60;
  particles = particles.filter((p) => p.life < p.max);
  for (const p of particles) {
    p.life += dt;
    p.vy += 260 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const k = 1 - p.life / p.max;
    ctx.save();
    ctx.globalAlpha = Math.max(0, k);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- 通关：红灯笼升起 ----------
export function winEffect() {
  if (!ctx) return;
  if (reduced) return;
  lantern = { x: null, y: null, t: 0, dur: 1.8 };
  ensureLoop();
}

function drawLanternFrame() {
  const lan = lantern;
  lan.t += 1 / 60 / lan.dur;
  const t = Math.min(1, lan.t);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (lan.x === null) {
    lan.x = w / 2;
    lan.y = h + 40;
  }
  const y = h + 40 - (h + 80) * easeOutBack(t);
  const r = Math.min(26, Math.min(w, h) * 0.06);

  ctx.save();
  ctx.shadowColor = "rgba(217, 79, 79, 0.9)";
  ctx.shadowBlur = 26;
  const g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, "#F26B6B");
  g.addColorStop(0.5, "#D94F4F");
  g.addColorStop(1, "#8E241F");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(lan.x, y, r, r * 1.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // 灯笼上下金箍
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#E8B64C";
  ctx.fillRect(lan.x - r * 0.7, y - r * 1.18 - 4, r * 1.4, 4);
  ctx.fillRect(lan.x - r * 0.7, y + r * 1.18, r * 1.4, 4);
  // 提线
  ctx.strokeStyle = "#E8B64C";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lan.x, y - r * 1.18 - 4);
  ctx.lineTo(lan.x, y - r * 1.18 - 24);
  ctx.stroke();
  ctx.restore();

  // 随灯笼撒金星
  if (Math.random() < 0.5) {
    particles.push({
      x: lan.x + (Math.random() - 0.5) * 40,
      y: y - r * 0.5,
      vx: (Math.random() - 0.5) * 30,
      vy: -30 - Math.random() * 40,
      life: 0,
      max: 0.8,
      size: 1.5,
      color: Math.random() < 0.6 ? "#F5D97A" : "#D94F4F",
    });
  }

  if (t >= 1) {
    lantern = null;
    // 灯笼升顶后播一阵光雨
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * w,
        y: -10,
        vx: (Math.random() - 0.5) * 20,
        vy: 60 + Math.random() * 120,
        life: 0,
        max: 1.6 + Math.random() * 0.8,
        size: 1 + Math.random() * 2,
        color: ["#F5D97A", "#E8B64C", "#D94F4F"][i % 3],
      });
    }
  }
}

// ---------- 几何工具 ----------
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function polyLength(pts) {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += dist(pts[i], pts[i + 1]);
  return len;
}
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function pointAlong(pts, target) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = dist(pts[i], pts[i + 1]);
    if (acc + seg >= target) {
      const f = seg > 0 ? (target - acc) / seg : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    }
    acc += seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}
