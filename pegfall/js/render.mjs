// Canvas 2D 渲染：深红天鹅绒、黄铜机框、琉璃钉、银珠拖尾、狂喜彩虹。
// 只读引擎状态，不修改任何规则数据；粒子与飘字属于纯视觉层。

import {
  BUCKET_HEIGHT, BUCKET_WIDTH, BUCKET_Y, CANNON_X, CANNON_Y, HEIGHT,
  POCKET_VALUES, STATUS_FEVER, STATUS_WON, WIDTH,
} from "./engine.mjs";
import { strings } from "./i18n.mjs";

const PEARL = {
  blue: ["#9ffcfc", "#12b7c9", "#064a5a"],
  orange: ["#ffd2a1", "#ff7a45", "#8c2312"],
  green: ["#c5ffe8", "#35d9a4", "#0a5c44"],
  purple: ["#e5e1ff", "#9a8cff", "#3b2d8f"],
};

const CHAPTER_THEMES = [
  { top: "#3c0f18", bottom: "#140406", glow: "rgba(212, 175, 55, 0.18)" },
  { top: "#37112c", bottom: "#120410", glow: "rgba(255, 118, 117, 0.16)" },
  { top: "#2c1322", bottom: "#0f0509", glow: "rgba(210, 160, 80, 0.16)" },
  { top: "#171234", bottom: "#06040f", glow: "rgba(120, 140, 255, 0.18)" },
  { top: "#371b09", bottom: "#0f0703", glow: "rgba(255, 180, 80, 0.2)" },
];

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function brass(ctx, y0, y1) {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1);
  gradient.addColorStop(0, "#f2ddb0");
  gradient.addColorStop(0.35, "#d4af37");
  gradient.addColorStop(0.7, "#9a741c");
  gradient.addColorStop(1, "#5e450f");
  return gradient;
}

export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  let locale = options.locale ?? "zh";
  let t = strings(locale);
  let scale = 1;
  let cssWidth = WIDTH;
  let particles = [];
  let toasts = [];
  let pegCache = new Map();
  let lastLevel = null;
  let shake = 0;
  let feverFlash = 0;
  let time = 0;
  let reducedMotion = false;

  try {
    reducedMotion = Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    reducedMotion = false;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || WIDTH;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    cssWidth = width;
    const height = width * (HEIGHT / WIDTH);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    scale = (width / WIDTH) * dpr;
  }

  function setLocale(next) {
    locale = next;
    t = strings(locale);
  }

  function spawn(x, y, color, count = 6, speed = 140, size = 3, life = 0.7) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const magnitude = speed * (0.35 + Math.random() * 0.9);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * magnitude,
        vy: Math.sin(angle) * magnitude - 30,
        life: life * (0.6 + Math.random() * 0.6),
        maxLife: life,
        color,
        size: size * (0.6 + Math.random() * 0.9),
        gravity: 260,
        shape: Math.random() < 0.25 ? "square" : "circle",
      });
    }
  }

  function pushToast(text, x, y, color = "#ffe7a8") {
    toasts.push({ text, x, y, life: 1.8, maxLife: 1.8, color });
  }

  function addEvents(events) {
    for (const event of events ?? []) {
      if (event.type === "peg") {
        const paint = PEARL[event.pegType] ?? PEARL.blue;
        spawn(event.x, event.y, event.pegType === "orange" ? "#ffb057" : paint[0], 5, 150, 3.2, 0.55);
      } else if (event.type === "split") {
        spawn(event.x, event.y, "#7dffe0", 18, 220, 3.6, 0.9);
        pushToast(t.powerSplitToast, event.x, event.y - 18, "#b9ffdf");
      } else if (event.type === "guide") {
        spawn(event.x, event.y, "#d9d4ff", 16, 200, 3.4, 0.9);
        pushToast(t.powerGuideToast, event.x, event.y - 18, "#ded9ff");
      } else if (event.type === "bucket") {
        spawn(event.x, BUCKET_Y, "#ffe28a", 22, 220, 4, 1);
        pushToast(t.freeBallText, event.x, BUCKET_Y - 26, "#ffe8a3");
        shake = Math.max(shake, reducedMotion ? 0 : 5);
      } else if (event.type === "pocket") {
        spawn(event.x, HEIGHT - 20, "#ffd479", 12, 180, 3.4, 0.8);
        pushToast(`+${event.value}`, event.x, HEIGHT - 46, "#ffe2a0");
      } else if (event.type === "fire") {
        shake = Math.max(shake, reducedMotion ? 0 : 7);
        spawn(CANNON_X, CANNON_Y + 30, "#ffd28a", 14, 200, 3, 0.5);
      } else if (event.type === "fever") {
        feverFlash = 3.2;
        shake = Math.max(shake, reducedMotion ? 0 : 10);
        spawn(event.x ?? WIDTH / 2, event.y ?? HEIGHT / 2, "#ffd479", 60, 360, 4.6, 1.6);
        for (const peg of currentPegs) {
          if (!peg.active) continue;
          spawn(peg.x, peg.y, "#ffcf7a", 2, 120, 3, 1.4);
        }
      } else if (event.type === "fever-end") {
        feverFlash = 2;
        for (let i = 0; i < 40; i += 1) {
          spawn(WIDTH / 2 + (Math.random() - 0.5) * 500, 120 + Math.random() * 200, "#ffd479", 2, 300, 4, 1.8);
        }
      }
    }
  }

  let currentPegs = [];

  function trackPegs(pegs) {
    for (const peg of pegs) {
      const previous = pegCache.get(peg.id);
      if (previous) {
        if (!previous.hit && peg.hit) {
          spawn(peg.x, peg.y, peg.type === "orange" ? "#ffb057" : PEARL[peg.type][0], 8, 180, 3.4, 0.7);
        }
        if (previous.active && !peg.active) {
          spawn(peg.x, peg.y, PEARL[peg.type][1], 10, 160, 3.6, 0.9);
        }
      }
      pegCache.set(peg.id, { hit: peg.hit, active: peg.active });
    }
  }

  function update(dt) {
    time += dt;
    shake = Math.max(0, shake - dt * 28);
    feverFlash = Math.max(0, feverFlash - dt);
    for (const particle of particles) {
      particle.life -= dt;
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    particles = particles.filter((particle) => particle.life > 0);
    for (const toast of toasts) {
      toast.life -= dt;
      toast.y -= dt * 26;
    }
    toasts = toasts.filter((toast) => toast.life > 0);
  }

  function drawBackground(state) {
    const theme = CHAPTER_THEMES[Math.max(0, Math.min(4, (state?.chapter ?? 1) - 1))];
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, theme.top);
    gradient.addColorStop(1, theme.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const light = ctx.createRadialGradient(CANNON_X, 150, 20, CANNON_X, 280, 520);
    light.addColorStop(0, theme.glow);
    light.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 天鹅绒细纹
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 40, HEIGHT);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFrame() {
    ctx.save();
    roundRect(ctx, 8, 8, WIDTH - 16, HEIGHT - 16, 18);
    ctx.strokeStyle = brass(ctx, 8, HEIGHT - 8);
    ctx.lineWidth = 3;
    ctx.stroke();
    roundRect(ctx, 15, 15, WIDTH - 30, HEIGHT - 30, 14);
    ctx.strokeStyle = "rgba(212, 175, 55, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const corner of [[22, 22], [WIDTH - 22, 22], [22, HEIGHT - 22], [WIDTH - 22, HEIGHT - 22]]) {
      ctx.beginPath();
      ctx.arc(corner[0], corner[1], 4.5, 0, Math.PI * 2);
      ctx.fillStyle = brass(ctx, corner[1] - 4, corner[1] + 4);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPockets(state) {
    const slotWidth = WIDTH / POCKET_VALUES.length;
    for (let i = 0; i < POCKET_VALUES.length; i += 1) {
      const x = i * slotWidth;
      const isFever = state.status === STATUS_FEVER || state.status === STATUS_WON;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + 16, HEIGHT - 44);
      ctx.lineTo(x + slotWidth - 16, HEIGHT - 44);
      ctx.lineTo(x + slotWidth - 34, HEIGHT - 12);
      ctx.lineTo(x + 34, HEIGHT - 12);
      ctx.closePath();
      ctx.fillStyle = "rgba(20, 6, 8, 0.72)";
      ctx.fill();
      ctx.strokeStyle = "rgba(212, 175, 55, 0.46)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = isFever ? "#ffe07a" : "rgba(232, 205, 140, 0.7)";
      ctx.font = "600 13px 'Segoe UI', 'PingFang SC', sans-serif";
      ctx.textAlign = "center";
      const value = isFever ? POCKET_VALUES[i] * 10 : POCKET_VALUES[i];
      ctx.fillText(String(value), x + slotWidth / 2, HEIGHT - 22);
      ctx.restore();
    }
  }

  function drawWell(state) {
    for (const well of state.wells) {
      ctx.save();
      ctx.translate(well.x, well.y);
      ctx.globalAlpha = 0.22;
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, well.radius * (0.35 + ring * 0.2), time * 0.4 + ring * 0.6, time * 0.4 + ring * 0.6 + Math.PI * 1.25);
        ctx.strokeStyle = ring % 2 === 0 ? "#8d7bff" : "#43e0d0";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, well.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(140, 120, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawRotor(rotor) {
    ctx.save();
    ctx.translate(rotor.x, rotor.y);
    ctx.rotate((rotor.angle * Math.PI) / 180);
    roundRect(ctx, -rotor.length / 2, -(rotor.width ?? 14) / 2, rotor.length, rotor.width ?? 14, (rotor.width ?? 14) / 2);
    ctx.fillStyle = brass(ctx, -(rotor.width ?? 14), rotor.width ?? 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 40, 8, 0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#2b1c07";
    ctx.fill();
    ctx.strokeStyle = "#e6c86e";
    ctx.stroke();
    ctx.restore();
  }

  function drawPeg(peg) {
    if (!peg.active) return;
    const paint = PEARL[peg.type] ?? PEARL.blue;
    const isPurple = peg.id === currentPurpleId;
    const colors = isPurple ? PEARL.purple : paint;
    const radius = peg.shape === "pill" ? (peg.thickness ?? 20) / 2 : peg.radius;

    ctx.save();
    ctx.translate(peg.x, peg.y);
    if (peg.shape === "pill") ctx.rotate((peg.angle * Math.PI) / 180);
    if (peg.hit) {
      ctx.shadowColor = colors[0];
      ctx.shadowBlur = 18;
    }
    ctx.beginPath();
    if (peg.shape === "pill") {
      roundRect(ctx, -peg.length / 2, -radius, peg.length, radius * 2, radius);
    } else {
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    }
    const gradient = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, radius * 0.15, 0, 0, radius * 1.5);
    gradient.addColorStop(0, peg.hit ? "#ffffff" : colors[0]);
    gradient.addColorStop(0.55, colors[1]);
    gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = peg.hit ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.45)";
    ctx.lineWidth = peg.hit ? 1.8 : 1;
    ctx.stroke();
    if (peg.hit) {
      ctx.beginPath();
      ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  let currentPurpleId = null;

  function drawCannon(aim) {
    ctx.save();
    ctx.translate(CANNON_X, CANNON_Y);

    // 炮座：黄铜底板 + 铆钉
    roundRect(ctx, -46, -6, 92, 40, 9);
    ctx.fillStyle = brass(ctx, -6, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(50, 32, 6, 0.65)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-36, 14, 3, 0, Math.PI * 2);
    ctx.arc(36, 14, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#3a2708";
    ctx.fill();

    // 炮身
    ctx.rotate((-aim * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(-13, -2);
    ctx.lineTo(-9, 52);
    ctx.lineTo(9, 52);
    ctx.lineTo(13, -2);
    ctx.closePath();
    ctx.fillStyle = brass(ctx, -2, 52);
    ctx.fill();
    ctx.strokeStyle = "rgba(50, 32, 6, 0.6)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    for (const band of [10, 30, 46]) {
      ctx.beginPath();
      ctx.moveTo(-12, band);
      ctx.lineTo(12, band);
      ctx.strokeStyle = "rgba(60, 40, 8, 0.55)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12, band - 2);
      ctx.lineTo(12, band - 2);
      ctx.strokeStyle = "rgba(255, 240, 190, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 炮口
    ctx.beginPath();
    ctx.ellipse(0, 52, 11, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#221607";
    ctx.fill();
    ctx.strokeStyle = "#ffe1a0";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 回转轴
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fillStyle = brass(ctx, -19, 19);
    ctx.fill();
    ctx.strokeStyle = "rgba(50, 32, 6, 0.6)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#2b1c07";
    ctx.fill();
    ctx.restore();
  }

  function drawGuide(guide) {
    if (!guide || !guide.points || guide.points.length < 2) return;
    const points = guide.points;
    const first = guide.firstBounce < 0 ? points.length - 1 : guide.firstBounce;
    ctx.save();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "rgba(255, 235, 170, 0.78)";
    ctx.shadowColor = "rgba(255, 210, 120, 0.7)";
    ctx.shadowBlur = 8;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i <= first; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    if (first < points.length - 1) {
      ctx.beginPath();
      ctx.setLineDash([6, 7]);
      ctx.strokeStyle = "rgba(255, 200, 120, 0.32)";
      ctx.moveTo(points[first].x, points[first].y);
      for (let i = first + 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 224, 150, 0.8)";
    for (let i = 4; i < first; i += 8) {
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBall(ball) {
    if (!ball.alive) return;
    const speed = Math.hypot(ball.vx, ball.vy) || 1;
    const tailX = ball.x - (ball.vx / speed) * 18;
    const tailY = ball.y - (ball.vy / speed) * 18;
    const trail = ctx.createLinearGradient(tailX, tailY, ball.x, ball.y);
    trail.addColorStop(0, "rgba(255, 245, 210, 0)");
    trail.addColorStop(1, "rgba(255, 245, 210, 0.6)");
    ctx.save();
    ctx.strokeStyle = trail;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(ball.x, ball.y);
    ctx.stroke();

    const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.radius + 3);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.5, "#d8e6f2");
    gradient.addColorStop(1, "#8493a6");
    ctx.shadowColor = "rgba(255, 244, 200, 0.9)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }

  function drawBucket(state) {
    const x = state.bucket.x;
    ctx.save();
    const gradient = ctx.createLinearGradient(x, BUCKET_Y, x + BUCKET_WIDTH, BUCKET_Y + BUCKET_HEIGHT);
    gradient.addColorStop(0, "#f6e0a6");
    gradient.addColorStop(0.4, "#d4af37");
    gradient.addColorStop(1, "#7a5a13");
    ctx.beginPath();
    ctx.moveTo(x, BUCKET_Y);
    ctx.lineTo(x + BUCKET_WIDTH, BUCKET_Y);
    ctx.lineTo(x + BUCKET_WIDTH - 16, BUCKET_Y + BUCKET_HEIGHT);
    ctx.lineTo(x + 16, BUCKET_Y + BUCKET_HEIGHT);
    ctx.closePath();
    ctx.fillStyle = "rgba(18, 8, 6, 0.85)";
    ctx.fill();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc((x + BUCKET_WIDTH) / 2, BUCKET_Y, BUCKET_WIDTH / 2, Math.PI, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 224, 140, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawFever(state) {
    if (state.status !== STATUS_FEVER && state.status !== STATUS_WON) return;
    if (reducedMotion) {
      ctx.fillStyle = "rgba(255, 210, 110, 0.08)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      ctx.save();
      ctx.translate(WIDTH / 2, HEIGHT * 0.52);
      ctx.globalCompositeOperation = "lighter";
      const count = 18;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + time * 0.35;
        const hue = (i / count) * 360;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * 900, Math.sin(angle) * 900);
        ctx.strokeStyle = `hsla(${hue}, 90%, 65%, 0.07)`;
        ctx.lineWidth = 26;
        ctx.stroke();
      }
      ctx.restore();
    }

    const pulse = 1 + Math.sin(time * 8) * 0.03;
    ctx.save();
    ctx.translate(WIDTH / 2, 118);
    ctx.scale(pulse, pulse);
    ctx.font = "900 46px 'Segoe UI', 'PingFang SC', sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(70, 20, 0, 0.8)";
    ctx.strokeText(t.feverText, 0, 0);
    const gradient = ctx.createLinearGradient(-200, -30, 200, 30);
    gradient.addColorStop(0, "#ffe9a3");
    gradient.addColorStop(0.5, "#ff9d3c");
    gradient.addColorStop(1, "#ff5f6d");
    ctx.fillStyle = gradient;
    ctx.shadowColor = "rgba(255, 180, 60, 0.8)";
    ctx.shadowBlur = 24;
    ctx.fillText(t.feverText, 0, 0);
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      if (particle.shape === "square") {
        ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawToasts() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 17px 'Segoe UI', 'PingFang SC', sans-serif";
    for (const toast of toasts) {
      ctx.globalAlpha = Math.min(1, toast.life / (toast.maxLife * 0.6));
      ctx.fillStyle = toast.color;
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 6;
      ctx.fillText(toast.text, toast.x, toast.y);
    }
    ctx.restore();
  }

  function draw(view, extras = {}) {
    if (!canvas || !view?.state) return;
    if (!canvas.width) resize();
    const state = view.state;
    if (lastLevel !== state.levelId) {
      pegCache = new Map();
      lastLevel = state.levelId;
      particles = [];
      toasts = [];
      feverFlash = 0;
    }
    const dt = Math.min(0.05, Math.max(0, extras.dt ?? 1 / 60));
    update(dt);
    trackPegs(state.pegs);
    currentPegs = state.pegs;
    currentPurpleId = state.purpleId;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground(state);
    drawPockets(state);
    drawWell(state);
    for (const rotor of state.rotors) drawRotor(rotor);
    for (const peg of state.pegs) drawPeg(peg);
    if (state.status === "aim") drawGuide(extras.guide);
    drawBucket(state);
    drawCannon(state.aim);
    for (const ball of state.balls) drawBall(ball);
    drawParticles();
    drawFever(state);
    drawToasts();
    if (feverFlash > 0) {
      ctx.fillStyle = `rgba(255, 210, 120, ${Math.min(0.18, feverFlash * 0.05)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    drawFrame();

    ctx.restore();
    void cssWidth;
  }

  resize();

  return {
    resize,
    draw,
    addEvents,
    setLocale,
    reset() {
      pegCache = new Map();
      particles = [];
      toasts = [];
      shake = 0;
      feverFlash = 0;
    },
    getReducedMotion: () => reducedMotion,
  };
}
