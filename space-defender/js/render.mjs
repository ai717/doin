// render.mjs — 唯一碰 Canvas 的层：深空霓虹舷窗、几何弹幕、粒子与演出。
// 只读 engine 状态，绝不改规则；粒子与光效纯视觉，可被 reduced-motion 降级。

import { mulberry32 } from "./engine.mjs";
import { ENEMY_TYPES } from "./levels.mjs";

export const FIELD_W = 540;
export const FIELD_H = 720;
const BREACH_Y = 582;

const PALETTE = {
  wasp: { body: "#ffb347", edge: "#ff8a3d" },
  falcon: { body: "#ff5d8f", edge: "#ff2e63" },
  crab: { body: "#b48cff", edge: "#8a5cff" },
  queen: { body: "#ffd166", edge: "#ffb703" },
};

function starfield(seed) {
  const rng = mulberry32(seed);
  const layers = [];
  for (let layer = 0; layer < 3; layer += 1) {
    const count = [46, 34, 22][layer];
    const stars = [];
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rng() * FIELD_W,
        y: rng() * FIELD_H,
        r: 0.6 + rng() * (0.7 + layer * 0.5),
        a: 0.25 + rng() * 0.6,
      });
    }
    layers.push({ stars, speed: 12 + layer * 16, phase: rng() * 6 });
  }
  return layers;
}

export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  let reduced = Boolean(options.reducedMotion);
  let dpr = 1;
  const stars = starfield(20260921);
  const nebula = [
    { x: 120, y: 180, r: 220, color: "rgba(120, 84, 220, 0.30)", drift: 26 },
    { x: 430, y: 420, r: 260, color: "rgba(64, 132, 220, 0.24)", drift: 34 },
    { x: 250, y: 660, r: 200, color: "rgba(220, 84, 160, 0.18)", drift: 22 },
  ];
  let particles = [];
  let shake = 0;
  let flash = 0;
  let clock = 0;
  let slowMo = 0;

  function resize() {
    dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    canvas.width = Math.round(FIELD_W * dpr);
    canvas.height = Math.round(FIELD_H * dpr);
  }

  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function noGlow() {
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  function spawnBurst(x, y, color, count, power) {
    if (reduced) count = Math.min(count, 5);
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.3 + Math.random()) * power;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 1.4 + Math.random() * 2.6,
        life: 0.36 + Math.random() * 0.5,
        age: 0,
        color,
      });
    }
    if (particles.length > 420) particles.splice(0, particles.length - 420);
  }

  function handleEvent(event) {
    switch (event.type) {
      case "kill":
        spawnBurst(event.x, event.y, PALETTE[event.enemy]?.body ?? "#ffd166", 16, 150);
        spawnBurst(event.x, event.y, "#fff3d0", 8, 90);
        shake = Math.max(shake, 3.2);
        break;
      case "chip":
        spawnBurst(event.x, event.y, "#fff1c9", 4, 70);
        break;
      case "bossDown":
        spawnBurst(event.x, event.y, "#ffb703", 46, 260);
        spawnBurst(event.x, event.y, "#fff3d0", 30, 180);
        shake = 9;
        flash = 0.5;
        slowMo = 0.8;
        break;
      case "hit":
        spawnBurst(event.x, event.y, "#4de2ff", 22, 190);
        shake = 7;
        break;
      case "graze":
        spawnBurst(event.x, event.y, "#8fd8ff", 5, 80);
        break;
      case "pickup":
        spawnBurst(event.x, event.y - 10, event.kind === "drone" ? "#ffb703" : "#d8e6ff", 14, 120);
        break;
      case "rescue":
        spawnBurst(event.x, event.y, "#7ef9ff", 30, 200);
        flash = 0.35;
        break;
      case "overload":
        flash = 0.3;
        shake = 4;
        break;
      case "lifeLost":
        spawnBurst(event.x, event.y, "#ff5d8f", 40, 240);
        shake = 9;
        flash = 0.4;
        break;
      case "barrierChip":
        spawnBurst(event.x, event.y + 8, "#7ef9ff", 3, 60);
        break;
      case "breach":
        flash = Math.max(flash, 0.18);
        break;
      default:
        break;
    }
  }

  function drawBackground(dt) {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    grad.addColorStop(0, "#080d28");
    grad.addColorStop(0.45, "#141640");
    grad.addColorStop(1, "#2a1b52");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);

    for (const blob of nebula) {
      const dx = reduced ? 0 : Math.sin(clock * 0.18 + blob.drift) * 18;
      const dy = reduced ? 0 : Math.cos(clock * 0.13 + blob.drift) * 12;
      const g = ctx.createRadialGradient(blob.x + dx, blob.y + dy, 0, blob.x + dx, blob.y + dy, blob.r);
      g.addColorStop(0, blob.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    }

    for (const layer of stars) {
      const drift = reduced ? 0 : (clock * layer.speed) % FIELD_H;
      for (const star of layer.stars) {
        let y = star.y + drift;
        if (y > FIELD_H) y -= FIELD_H;
        ctx.fillStyle = `rgba(226, 236, 255, ${star.a})`;
        ctx.beginPath();
        ctx.arc(star.x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBarriers(state) {
    for (const barrier of state.barriers) {
      if (barrier.hp <= 0) continue;
      const ratio = barrier.hp / barrier.maxHp;
      const w = barrier.w;
      const h = barrier.h * (0.55 + ratio * 0.45);
      const y = barrier.y + (barrier.h - h);
      const g = ctx.createLinearGradient(barrier.cx - w / 2, y, barrier.cx + w / 2, y + h);
      g.addColorStop(0, "rgba(126, 249, 255, 0.85)");
      g.addColorStop(1, "rgba(78, 160, 255, 0.65)");
      ctx.fillStyle = g;
      glow("rgba(126, 249, 255, 0.55)", 14);
      ctx.beginPath();
      ctx.roundRect(barrier.cx - w / 2, y, w, h, 8);
      ctx.fill();
      noGlow();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(barrier.cx - w / 2 + 4, y + 3, w - 8, 3);
    }
  }

  function drawEnemy(state, enemy) {
    const type = ENEMY_TYPES[enemy.type];
    const color = PALETTE[enemy.type] ?? PALETTE.wasp;
    const r = type.radius;
    const wobble = reduced ? 0 : Math.sin(clock * 3 + enemy.id) * 1.6;
    ctx.save();
    ctx.translate(enemy.x, enemy.y + wobble);
    glow(color.edge, 16);
    ctx.fillStyle = color.body;
    ctx.beginPath();
    if (enemy.type === "wasp") {
      ctx.moveTo(0, r * 0.9);
      ctx.lineTo(-r, -r * 0.4);
      ctx.lineTo(-r * 0.4, -r);
      ctx.lineTo(r * 0.4, -r);
      ctx.lineTo(r, -r * 0.4);
      ctx.closePath();
    } else if (enemy.type === "falcon") {
      ctx.moveTo(0, r);
      ctx.lineTo(-r * 0.95, -r * 0.2);
      ctx.lineTo(0, -r * 0.9);
      ctx.lineTo(r * 0.95, -r * 0.2);
      ctx.closePath();
    } else if (enemy.type === "crab") {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.82;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(0, r);
      ctx.lineTo(-r * 0.7, r * 0.4);
      ctx.lineTo(-r, -r * 0.7);
      ctx.lineTo(-r * 0.45, -r * 0.2);
      ctx.lineTo(0, -r);
      ctx.lineTo(r * 0.45, -r * 0.2);
      ctx.lineTo(r, -r * 0.7);
      ctx.lineTo(r * 0.7, r * 0.4);
      ctx.closePath();
    }
    ctx.fill();
    noGlow();
    ctx.fillStyle = "rgba(10, 12, 30, 0.85)";
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.1, r * 0.16, 0, Math.PI * 2);
    ctx.arc(r * 0.28, -r * 0.1, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    if (enemy.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, enemy.hitFlash * 5)})`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
    if (enemy.hp < enemy.maxHp) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(-r, r + 4, r * 2, 2);
      ctx.fillStyle = "#7ef9ff";
      ctx.fillRect(-r, r + 4, (r * 2 * enemy.hp) / enemy.maxHp, 2);
    }
    ctx.restore();
  }

  function drawBeam(state) {
    for (const enemy of state.enemies) {
      if (!enemy.alive || enemy.state !== "beam") continue;
      const k = Math.min(1, enemy.beamT / 0.6);
      const width = 6 + k * 16;
      const g = ctx.createLinearGradient(0, enemy.y, 0, FIELD_H);
      g.addColorStop(0, "rgba(255, 209, 102, 0.75)");
      g.addColorStop(1, "rgba(255, 94, 143, 0.05)");
      ctx.fillStyle = g;
      glow("rgba(255, 209, 102, 0.6)", 20);
      ctx.beginPath();
      ctx.moveTo(enemy.x - width / 2, enemy.y);
      ctx.lineTo(enemy.x + width / 2, enemy.y);
      ctx.lineTo(enemy.x + width * 0.9, FIELD_H);
      ctx.lineTo(enemy.x - width * 0.9, FIELD_H);
      ctx.closePath();
      ctx.fill();
      noGlow();
    }
  }

  function drawBoss(state) {
    const boss = state.boss;
    if (!boss || boss.hp <= 0) return;
    const r = boss.radius;
    const tint = ["#ff6b6b", "#ff9f45", "#ff4fa3"][boss.phase];
    ctx.save();
    ctx.translate(boss.x, boss.y);
    glow(tint, 26);
    ctx.fillStyle = "#2b1f4d";
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tint;
    ctx.lineWidth = 3;
    ctx.stroke();
    noGlow();
    // 双侧炮塔
    ctx.fillStyle = "#3b2a63";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(side * r * 0.62 - 9, r * 0.16, 18, 22, 6);
      ctx.fill();
    }
    // 能量核心
    const pulse = reduced ? 0.8 : 0.6 + Math.sin(clock * 4) * 0.2;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
    core.addColorStop(0, `rgba(255, 235, 180, ${pulse})`);
    core.addColorStop(1, "rgba(255, 120, 90, 0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe3a3";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    if (boss.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, boss.hitFlash * 6)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // 血条
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(60, 44, FIELD_W - 120, 6);
    ctx.fillStyle = tint;
    ctx.fillRect(60, 44, (FIELD_W - 120) * ratio, 6);
  }

  function drawPlayer(state) {
    const p = state.player;
    if (state.captured) {
      ctx.strokeStyle = "rgba(255, 209, 102, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - 40);
      ctx.stroke();
    }
    const flicker = p.invuln > 0 && !reduced ? Math.sin(clock * 40) > 0 : true;
    const ships = p.dual ? [-11, 11] : [0];
    for (const dx of ships) {
      ctx.save();
      ctx.translate(p.x + dx, p.y);
      if (flicker) {
        glow("#4de2ff", 22);
        ctx.fillStyle = "#e8fbff";
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(15, 16);
        ctx.lineTo(6, 10);
        ctx.lineTo(-6, 10);
        ctx.lineTo(-15, 16);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#4de2ff";
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(9, 12);
        ctx.lineTo(-9, 12);
        ctx.closePath();
        ctx.fill();
        noGlow();
        // 引擎尾焰
        const flame = reduced ? 8 : 8 + Math.sin(clock * 22) * 3;
        ctx.fillStyle = "rgba(255, 179, 71, 0.9)";
        ctx.beginPath();
        ctx.moveTo(-5, 12);
        ctx.lineTo(5, 12);
        ctx.lineTo(0, 12 + flame);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // 核心判定点（弹幕游戏惯例：判定点远小于外形）
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(p.x, p.y + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // 擦弹环（无描边，径向柔光）
    const ring = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, 23);
    ring.addColorStop(0, "rgba(126, 249, 255, 0.16)");
    ring.addColorStop(1, "rgba(126, 249, 255, 0)");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 23, 0, Math.PI * 2);
    ctx.fill();
    // 浮游炮
    for (let i = 0; i < p.drones; i += 1) {
      const dx = i === 0 ? -32 : 32;
      const px = p.x + dx;
      ctx.save();
      ctx.translate(px, p.y - 4);
      glow("#ffb703", 14);
      ctx.fillStyle = "#ffb703";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff3d0";
      ctx.beginPath();
      ctx.arc(0, -1, 3.4, 0, Math.PI * 2);
      ctx.fill();
      noGlow();
      ctx.restore();
    }
  }

  function drawBullets(state) {
    const slow = state.overload.active > 0;
    for (const bullet of state.playerBullets) {
      ctx.fillStyle = "#7ef9ff";
      glow("#7ef9ff", 12);
      ctx.beginPath();
      ctx.roundRect(bullet.x - 2, bullet.y - 11, 4, 15, 2);
      ctx.fill();
      noGlow();
    }
    for (const bullet of state.enemyBullets) {
      const color = slow ? "#6fc7ff" : "#ff8a3d";
      ctx.fillStyle = color;
      glow(color, 14);
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      noGlow();
    }
    for (const drop of state.drops) {
      const color = drop.kind === "drone" ? "#ffb703" : "#d8e6ff";
      ctx.fillStyle = color;
      glow(color, 14);
      ctx.beginPath();
      ctx.roundRect(drop.x - 8, drop.y - 8, 16, 16, 5);
      ctx.fill();
      noGlow();
    }
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 42 * dt;
      p.vx *= 0.985;
    }
    particles = particles.filter((p) => p.age < p.life);
    for (const p of particles) {
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWarningLine(state) {
    const lowest = state.formation?.lowest ?? 0;
    if (!state.spec || state.spec.boss) return;
    const danger = lowest > BREACH_Y - 40;
    ctx.strokeStyle = danger ? "rgba(255, 94, 143, 0.7)" : "rgba(255, 209, 102, 0.22)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(14, BREACH_Y);
    ctx.lineTo(FIELD_W - 14, BREACH_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawOverloadAura(state) {
    if (state.overload.active <= 0) return;
    const k = state.overload.active / 2.6;
    const grad = ctx.createRadialGradient(FIELD_W / 2, FIELD_H * 0.7, 40, FIELD_W / 2, FIELD_H * 0.7, FIELD_W);
    grad.addColorStop(0, `rgba(126, 249, 255, ${0.05 + k * 0.1})`);
    grad.addColorStop(1, "rgba(126, 249, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }

  function draw(state, dt = 1 / 60) {
    const scale = slowMo > 0 ? 0.35 : 1;
    const step = dt * scale;
    clock += step;
    if (slowMo > 0) slowMo = Math.max(0, slowMo - dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shake > 0.2) {
      const sx = (Math.random() - 0.5) * shake;
      const sy = (Math.random() - 0.5) * shake;
      ctx.translate(sx, sy);
      shake *= 0.82;
    } else {
      shake = 0;
    }
    drawBackground(step);
    drawWarningLine(state);
    drawBarriers(state);
    drawBeam(state);
    for (const enemy of state.enemies) if (enemy.alive) drawEnemy(state, enemy);
    drawBoss(state);
    drawBullets(state);
    drawPlayer(state);
    drawParticles(step);
    drawOverloadAura(state);
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255, 246, 224, ${Math.min(0.5, flash)})`;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      flash *= 0.86;
    }
    // 舷窗暗角
    const vignette = ctx.createRadialGradient(FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.32, FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.78);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }

  resize();
  return {
    resize,
    draw,
    handleEvent,
    setReducedMotion(value) {
      reduced = Boolean(value);
      if (reduced) particles = [];
    },
    clear() {
      particles = [];
      shake = 0;
      flash = 0;
    },
    particleCount() {
      return particles.length;
    },
  };
}
