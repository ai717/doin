// render.mjs — 唯一碰 Canvas 的层：糖果花园软胶风绘制。
// 严禁描边圈：高亮/预警/可选目标一律用径向柔光 + 呼吸脉动，绝不给主体描"救生圈"。
// 背景静态缓存 + 预渲染辉光精灵，保证 220 敌同屏下 60fps。

import { ARENA_W, ARENA_H, PLAYER_R, CHARACTERS, WEAPONS, ENEMIES } from "./engine.mjs";
import * as i18n from "./i18n.mjs";

const GLOW_COLORS = {
  gold: [255, 214, 90],
  yellow: [255, 225, 120],
  green: [140, 230, 120],
  pink: [255, 150, 170],
  red: [255, 110, 110],
  blue: [130, 190, 255],
  teal: [110, 235, 210],
  white: [255, 255, 255],
  orange: [255, 170, 90],
  purple: [200, 140, 255],
  cream: [255, 246, 224],
};

function makeGlowSprite(rgb) {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.85)`);
  grad.addColorStop(0.45, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.32)`);
  grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvas;
}

function makeFlowerSprite(petal, core) {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  g.translate(size / 2, size / 2);
  g.fillStyle = petal;
  for (let i = 0; i < 6; i += 1) {
    g.save();
    g.rotate((i / 6) * Math.PI * 2);
    g.beginPath();
    g.ellipse(0, -7, 4.4, 6.4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.beginPath();
  g.arc(0, 0, 4.6, 0, Math.PI * 2);
  g.fillStyle = core;
  g.fill();
  return canvas;
}

const FLOWER_PALETTE = [
  ["#ffd9e3", "#ff8f5a"],
  ["#fff3c4", "#ffcf5a"],
  ["#e3d9ff", "#b78aff"],
  ["#d9fff0", "#6fd9a8"],
  ["#ffdede", "#ff7f8a"],
];

export class MowRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.glow = {};
    for (const [key, rgb] of Object.entries(GLOW_COLORS)) this.glow[key] = makeGlowSprite(rgb);
    this.flowers = FLOWER_PALETTE.map(([p, c]) => makeFlowerSprite(p, c));
    this.bg = null;
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.reduceMotion = false;
    try {
      this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      // 降级
    }
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.round(rect.width * dpr));
    const h = Math.max(180, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.scale = w / ARENA_W;
    this.offX = 0;
    this.offY = 0;
    this.buildBackground();
  }

  buildBackground() {
    const c = document.createElement("canvas");
    c.width = ARENA_W;
    c.height = ARENA_H;
    const g = c.getContext("2d");
    // 奶油草地基底
    const base = g.createLinearGradient(0, 0, 0, ARENA_H);
    base.addColorStop(0, "#cdeab0");
    base.addColorStop(0.55, "#e4f2c8");
    base.addColorStop(1, "#f7f3d6");
    g.fillStyle = base;
    g.fillRect(0, 0, ARENA_W, ARENA_H);
    // 柔和光斑
    const blobs = [[240, 180, 200, "rgba(255,255,255,0.35)"], [1020, 130, 260, "rgba(255,240,190,0.4)"], [640, 620, 320, "rgba(255,255,255,0.3)"], [1180, 560, 200, "rgba(210,255,200,0.4)"]];
    for (const [bx, by, br, color] of blobs) {
      const grad = g.createRadialGradient(bx, by, 8, bx, by, br);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    // 草丛纹理短线
    g.strokeStyle = "rgba(90,150,80,0.18)";
    g.lineWidth = 2;
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 220; i += 1) {
      const x = rand() * ARENA_W;
      const y = rand() * ARENA_H;
      const hgt = 5 + rand() * 9;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 6, y - hgt);
      g.stroke();
    }
    // 散布小花
    for (let i = 0; i < 40; i += 1) {
      const x = rand() * ARENA_W;
      const y = rand() * ARENA_H;
      const size = 22 + rand() * 26;
      const sprite = this.flowers[i % this.flowers.length];
      g.globalAlpha = 0.5 + rand() * 0.4;
      g.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
    g.globalAlpha = 1;
    // 四周花篱软胶边界
    const hedge = g.createLinearGradient(0, 0, 0, ARENA_H);
    hedge.addColorStop(0, "#5da04a");
    hedge.addColorStop(1, "#3d7a38");
    g.fillStyle = hedge;
    g.fillRect(0, 0, ARENA_W, 22);
    g.fillRect(0, ARENA_H - 22, ARENA_W, 22);
    g.fillRect(0, 0, 22, ARENA_H);
    g.fillRect(ARENA_W - 22, 0, 22, ARENA_H);
    g.fillStyle = "rgba(255,255,255,0.16)";
    g.fillRect(0, 0, ARENA_W, 5);
    // 暗角
    const vig = g.createRadialGradient(ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.35, ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.85);
    vig.addColorStop(0, "rgba(40,80,40,0)");
    vig.addColorStop(1, "rgba(30,70,35,0.16)");
    g.fillStyle = vig;
    g.fillRect(0, 0, ARENA_W, ARENA_H);
    this.bg = c;
  }

  glowSprite(name) {
    return this.glow[name] || this.glow.white;
  }

  /** 渲染事件进粒子系统（kill/chip/burst/hit/evolve/...） */
  feedEvents(events) {
    if (!Array.isArray(events)) return;
    for (const ev of events) {
      if (ev.type === "kill") this.burstParticles(ev.x, ev.y, "green", 8, 140);
      else if (ev.type === "chip") this.burstParticles(ev.x, ev.y, "yellow", 3, 90);
      else if (ev.type === "hit") {
        this.burstParticles(ev.x, ev.y, "red", 10, 180);
        this.shake = Math.min(12, this.shake + 6);
      } else if (ev.type === "burst") {
        this.ring(ev.x, ev.y, ev.radius, "yellow");
        this.burstParticles(ev.x, ev.y, "gold", 40, 300);
        this.shake = Math.min(14, this.shake + 8);
      } else if (ev.type === "emergencyBurst") {
        this.ring(ev.x, ev.y, 330, "teal");
        this.burstParticles(ev.x, ev.y, "teal", 24, 240);
      } else if (ev.type === "pickup") {
        const color = ev.kind === "rose" ? "pink" : ev.kind === "clover" ? "green" : "gold";
        this.burstParticles(ev.x ?? this.lastPx ?? 640, ev.y ?? this.lastPy ?? 360, color, 4, 80);
      } else if (ev.type === "evolve") {
        this.ring(640, 360, 200, "gold");
        this.burstParticles(640, 360, "gold", 30, 260);
        this.floaters.push({ x: 640, y: 320, vy: -46, life: 1.4, maxLife: 1.4, text: i18n.strings(i18n.loadLocale()).evolveFloater, color: "#ffd34d", size: 30 });
      } else if (ev.type === "strike" || ev.type === "bomb") {
        this.ring(ev.x, ev.y, ev.r, "orange");
        this.burstParticles(ev.x, ev.y, "orange", 16, 220);
        this.shake = Math.min(10, this.shake + 5);
      } else if (ev.type === "explode") {
        this.ring(ev.x, ev.y, ev.r, "purple");
        this.burstParticles(ev.x, ev.y, "purple", 12, 200);
      } else if (ev.type === "bossSpawn") {
        this.ring(ev.x, ev.y, 360, "red");
        this.shake = Math.min(16, this.shake + 10);
      } else if (ev.type === "bossCharge") {
        this.ring(ev.x, ev.y, 220, "red");
      } else if (ev.type === "mowReady") {
        this.ring(this.lastPx ?? 640, this.lastPy ?? 360, 90, "gold");
      }
      if (ev.type === "kill" && ev.x !== undefined) {
        this.lastPx = ev.x;
        this.lastPy = ev.y;
      }
    }
  }

  burstParticles(x, y, color, count, speed) {
    if (this.reduceMotion) count = Math.max(2, Math.floor(count / 3));
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 3 + Math.random() * 5,
        color,
        kind: "dot",
      });
    }
  }

  ring(x, y, radius, color) {
    if (this.reduceMotion) return;
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.45, maxLife: 0.45, size: radius, color, kind: "ring" });
  }

  drawGlow(name, x, y, size, alpha = 1) {
    const c = this.canvas;
    const s = this.scale;
    const g = this.ctx;
    g.globalAlpha = alpha;
    g.drawImage(this.glowSprite(name), (x - size / 2) * s, (y - size / 2) * s, size * s, size * s);
    g.globalAlpha = 1;
  }

  render(snap) {
    const g = this.ctx;
    const s = this.scale;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // 震动
    if (this.shake > 0) {
      const sx = (Math.random() - 0.5) * this.shake;
      const sy = (Math.random() - 0.5) * this.shake;
      g.translate(sx * s, sy * s);
      this.shake = Math.max(0, this.shake - 0.6);
    }
    g.scale(s, s);
    // 背景
    if (this.bg) g.drawImage(this.bg, 0, 0);
    if (!snap) {
      g.restore();
      return;
    }
    this.drawVines(snap);
    this.drawDrops(snap);
    this.drawEnemies(snap);
    this.drawBoss(snap);
    this.drawProjectiles(snap);
    this.drawPlayer(snap);
    this.drawParticles();
    g.restore();
  }

  drawVines(snap) {
    const g = this.ctx;
    for (const v of snap.vines) {
      const k = v.t / v.maxT;
      const pulse = 0.75 + Math.sin(v.t * 6) * 0.12;
      this.drawGlow(v.from === "maneater" ? "purple" : "green", v.x, v.y, v.r * 2 * pulse, 0.5);
      g.fillStyle = v.from === "maneater" ? "rgba(150,80,180,0.5)" : "rgba(80,170,80,0.45)";
      g.beginPath();
      g.arc(v.x, v.y, v.r * k, 0, Math.PI * 2);
      g.fill();
    }
  }

  drawDrops(snap) {
    const g = this.ctx;
    const t = performance.now() / 1000;
    for (const d of snap.drops) {
      const pulse = 1 + Math.sin(t * 5 + d.x) * 0.12;
      if (d.kind === "nectar") {
        this.drawGlow("gold", d.x, d.y, 20 * pulse, 0.9);
        g.fillStyle = "#ffd34d";
        g.beginPath();
        g.arc(d.x, d.y, 4.4, 0, Math.PI * 2);
        g.fill();
      } else if (d.kind === "rose") {
        this.drawGlow("pink", d.x, d.y, 26 * pulse, 0.9);
        g.fillStyle = "#ff7f8a";
        g.beginPath();
        g.arc(d.x, d.y, 5.4, 0, Math.PI * 2);
        g.fill();
      } else if (d.kind === "clover") {
        this.drawGlow("green", d.x, d.y, 24 * pulse, 0.9);
        g.fillStyle = "#5fc46a";
        g.beginPath();
        for (let i = 0; i < 3; i += 1) {
          g.arc(d.x + Math.cos((i / 3) * Math.PI * 2) * 4, d.y + Math.sin((i / 3) * Math.PI * 2) * 4, 3, 0, Math.PI * 2);
        }
        g.fill();
      } else if (d.kind === "chest") {
        this.drawGlow("gold", d.x, d.y, 44 * pulse, 1);
        g.fillStyle = "#f2a93b";
        g.fillRect(d.x - 8, d.y - 7, 16, 14);
        g.fillStyle = "#b97a24";
        g.fillRect(d.x - 1.6, d.y - 7, 3.2, 14);
        g.fillRect(d.x - 8, d.y - 2, 16, 3.2);
      }
    }
  }

  drawEnemies(snap) {
    const g = this.ctx;
    const t = performance.now() / 1000;
    for (const e of snap.enemies) {
      const fade = e.spawnT > 0 ? 1 - e.spawnT / 0.4 : 1;
      const flash = e.hitFlash > 0 ? 0.75 : 0;
      g.globalAlpha = Math.max(0.15, Math.min(1, fade));
      const r = e.r;
      if (e.type === "caterpillar") {
        // 毛毛虫：分段软体
        g.fillStyle = "#8fd46a";
        for (let i = 0; i < 4; i += 1) {
          const seg = r * 0.55;
          const a = e.angle + i * 0.55;
          g.beginPath();
          g.arc(e.x - Math.cos(a) * i * seg * 0.8, e.y - Math.sin(a) * i * seg * 0.8, seg, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "#3d7a38";
        g.beginPath();
        g.arc(e.x + Math.cos(e.angle) * r * 0.4, e.y + Math.sin(e.angle) * r * 0.4, 2, 0, Math.PI * 2);
        g.fill();
      } else if (e.type === "beetle") {
        g.fillStyle = e.elite ? "#2e6e46" : "#4a8a52";
        g.beginPath();
        g.ellipse(e.x, e.y, r, r * 0.82, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = e.elite ? "#3aa06a" : "#5fae6a";
        g.beginPath();
        g.ellipse(e.x - r * 0.2, e.y - r * 0.25, r * 0.5, r * 0.4, -0.4, 0, Math.PI * 2);
        g.fill();
      } else if (e.type === "wasp") {
        g.fillStyle = "#ffb84d";
        g.beginPath();
        g.ellipse(e.x, e.y, r, r * 0.7, e.angle, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.6)";
        g.beginPath();
        g.ellipse(e.x - r * 0.8, e.y - r * 0.4, r * 0.7, r * 0.35, e.angle - 0.5, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(e.x - r * 0.8, e.y + r * 0.4, r * 0.7, r * 0.35, e.angle + 0.5, 0, Math.PI * 2);
        g.fill();
      } else if (e.type === "toadstool") {
        g.fillStyle = "#e8ddd0";
        g.fillRect(e.x - r * 0.45, e.y - r * 0.1, r * 0.9, r * 0.9);
        g.fillStyle = "#b06ad0";
        g.beginPath();
        g.arc(e.x, e.y - r * 0.2, r, Math.PI, 0);
        g.fill();
        g.fillStyle = "#f6f0ff";
        for (const [px, py] of [[-0.4, -0.55], [0.15, -0.7], [0.55, -0.4]]) {
          g.beginPath();
          g.arc(e.x + px * r, e.y + py * r, 2.4, 0, Math.PI * 2);
          g.fill();
        }
      } else if (e.type === "thornball") {
        this.drawGlow("purple", e.x, e.y, r * 2.6, 0.55);
        g.fillStyle = "#8a5ac0";
        g.beginPath();
        g.arc(e.x, e.y, r * 0.8, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#8a5ac0";
        g.lineWidth = 2.4;
        for (let i = 0; i < 8; i += 1) {
          const a = e.angle + (i / 8) * Math.PI * 2;
          g.beginPath();
          g.moveTo(e.x + Math.cos(a) * r * 0.5, e.y + Math.sin(a) * r * 0.5);
          g.lineTo(e.x + Math.cos(a) * r * 1.15, e.y + Math.sin(a) * r * 1.15);
          g.stroke();
        }
      }
      // 精英柔光（无描边）+ 血条
      if (e.elite) {
        this.drawGlow("red", e.x, e.y, r * 3.2, 0.5 + Math.sin(t * 4) * 0.15);
        g.fillStyle = "rgba(20,40,25,0.6)";
        g.fillRect(e.x - r, e.y - r - 12, r * 2, 5);
        g.fillStyle = "#ff6a6a";
        g.fillRect(e.x - r, e.y - r - 12, r * 2 * Math.max(0, e.hp / e.maxHp), 5);
      }
      if (flash > 0) {
        g.fillStyle = `rgba(255,255,255,${flash})`;
        g.beginPath();
        g.arc(e.x, e.y, r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  drawBoss(snap) {
    const boss = snap.boss;
    if (!boss) return;
    const g = this.ctx;
    const t = performance.now() / 1000;
    const r = 64;
    const phaseColor = ["#7ab84a", "#d98a3a", "#c94f4f"][boss.phase];
    this.drawGlow(boss.phase === 2 ? "red" : "orange", boss.x, boss.y, r * 3.4, 0.7 + Math.sin(t * 3) * 0.12);
    // 冲锋预警锥（径向柔光，非描边）
    if (boss.chargeT > 0 && boss.chargeDir !== 0) {
      const pulse = 0.6 + Math.sin(t * 14) * 0.3;
      this.drawGlow("red", boss.x + boss.chargeDir * 180, boss.y, 320 * pulse, 0.5);
      g.fillStyle = `rgba(255,80,80,${0.18 + pulse * 0.2})`;
      g.beginPath();
      g.moveTo(boss.x, boss.y);
      g.arc(boss.x, boss.y, 300, Math.atan2(0, boss.chargeDir) - 0.28, Math.atan2(0, boss.chargeDir) + 0.28);
      g.fill();
    }
    // 园丁巨人：软胶洒水壶身体 + 帽子
    g.fillStyle = phaseColor;
    g.beginPath();
    g.ellipse(boss.x, boss.y, r, r * 1.05, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffe9c9";
    g.beginPath();
    g.arc(boss.x - r * 0.35, boss.y - r * 0.5, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(boss.x + r * 0.1, boss.y - r * 0.55, r * 0.24, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#5a3a24";
    g.beginPath();
    g.arc(boss.x + r * 0.45, boss.y - r * 0.78, r * 0.34, 0, Math.PI * 2);
    g.fill();
    // 洒水壶嘴
    g.strokeStyle = "#5a3a24";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(boss.x + r * 0.85, boss.y + r * 0.2);
    g.lineTo(boss.x + r * 1.5, boss.y + r * 0.55);
    g.stroke();
    // 血条
    g.fillStyle = "rgba(20,40,25,0.6)";
    g.fillRect(boss.x - 70, boss.y - r - 26, 140, 9);
    g.fillStyle = phaseColor;
    g.fillRect(boss.x - 70, boss.y - r - 26, 140 * Math.max(0, boss.hp / boss.maxHp), 9);
    if (boss.hitFlash > 0) {
      g.fillStyle = `rgba(255,255,255,${boss.hitFlash / 0.1 * 0.7})`;
      g.beginPath();
      g.arc(boss.x, boss.y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  drawProjectiles(snap) {
    const g = this.ctx;
    for (const p of snap.projectiles) {
      if (p.kind === "water") {
        this.drawGlow("blue", p.x, p.y, 18, 0.8);
        g.fillStyle = "#6ec4ff";
        g.beginPath();
        g.arc(p.x, p.y, 5, 0, Math.PI * 2);
        g.fill();
      } else if (p.kind === "pollen") {
        this.drawGlow("yellow", p.x, p.y, 20, 0.7);
        g.fillStyle = "#ffe173";
        g.beginPath();
        g.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
        g.fill();
      } else if (p.kind === "mist") {
        this.drawGlow("green", p.x, p.y, 34, 0.75);
        g.fillStyle = "rgba(110,220,120,0.6)";
        g.beginPath();
        g.arc(p.x, p.y, 8, 0, Math.PI * 2);
        g.fill();
      } else if (p.kind === "pod") {
        this.drawGlow("green", p.x, p.y, 24, 0.7);
        g.fillStyle = "#67c95f";
        g.beginPath();
        g.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        g.fill();
      } else if (p.kind === "podrain") {
        this.drawGlow("green", p.x, p.y, 26, 0.6);
        g.fillStyle = "#7dd977";
        g.beginPath();
        g.arc(p.x, p.y, 4.6, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  drawPlayer(snap) {
    const g = this.ctx;
    const t = performance.now() / 1000;
    const p = snap.player;
    const x = p.x;
    const y = p.y;
    const blink = p.invuln > 0 && Math.sin(t * 26) > 0;
    // 花蜜磁吸范围提示（柔和）
    const magnet = snap.passives.find((pp) => pp.id === "magnet");
    if (magnet) this.drawGlow("cream", x, y, 190 + magnet.level * 40, 0.12);
    // 移动方向微光
    this.drawGlow("cream", x, y, 90, 0.5);
    // 花粉喷射朝向光锥
    if (snap.weapons.some((w) => w.id === "pollen-spray" || w.id === "toxic-mist")) {
      const a = Math.atan2(p.aimY, p.aimX);
      g.fillStyle = "rgba(255,225,120,0.14)";
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, 120, a - 0.4, a + 0.4);
      g.fill();
    }
    // 割草槽满时机身边缘呼吸金光
    if (snap.mowReady) {
      this.drawGlow("gold", x, y, 110 + Math.sin(t * 5) * 14, 0.65);
    }
    g.globalAlpha = blink ? 0.35 : 1;
    // 机身（奶白软胶）
    g.fillStyle = "#fff3dc";
    g.beginPath();
    g.ellipse(x, y, 20, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffe4b3";
    g.beginPath();
    g.ellipse(x - 4, y - 2, 14, 10, -0.2, 0, Math.PI * 2);
    g.fill();
    // 刀盘（橙）
    const ring = snap.weapons.find((w) => w.id === "blade-ring" || w.id === "gold-disk");
    const ang = ring ? ring.angle : t * 3;
    g.save();
    g.translate(x, y - 3);
    g.rotate(ang);
    g.fillStyle = "#ff9d3b";
    for (let i = 0; i < 3; i += 1) {
      g.save();
      g.rotate((i / 3) * Math.PI * 2);
      g.beginPath();
      g.ellipse(0, -6, 4, 8.4, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.fillStyle = "#ffc46b";
    g.beginPath();
    g.arc(0, 0, 6, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // 眼睛
    g.fillStyle = "#3a2a20";
    g.beginPath();
    g.arc(x - 6, y - 6, 2.6, 0, Math.PI * 2);
    g.arc(x + 6, y - 6, 2.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(x - 5.2, y - 6.8, 0.9, 0, Math.PI * 2);
    g.arc(x + 6.8, y - 6.8, 0.9, 0, Math.PI * 2);
    g.fill();
    // 受击判定核心（柔光点，非描边）
    this.drawGlow("white", x, y, 14, 0.35);
    g.globalAlpha = 1;
    // 旋转刀片 / 黄金割草盘
    for (const w of snap.weapons) {
      if (w.id === "blade-ring" || w.id === "gold-disk") this.drawBlades(w, x, y);
      if (w.id === "bee-swarm") this.drawBees(w, x, y);
    }
  }

  drawBlades(w, x, y) {
    const g = this.ctx;
    const evolved = w.id === "gold-disk";
    const count = evolved ? 6 : 1 + Math.floor(w.level / 2);
    const radius = evolved ? 148 : 76 + w.level * 5;
    const color = evolved ? "#ffd34d" : "#ff9d3b";
    this.drawGlow(evolved ? "gold" : "orange", x, y, radius * 2.1, evolved ? 0.28 : 0.18);
    for (let i = 0; i < count; i += 1) {
      const a = w.angle + (i / count) * Math.PI * 2;
      const bx = x + Math.cos(a) * radius;
      const by = y + Math.sin(a) * radius;
      g.save();
      g.translate(bx, by);
      g.rotate(a + Math.PI / 2);
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(0, 0, 5, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  drawBees(w, x, y) {
    const g = this.ctx;
    const count = 3 + Math.floor(w.level / 2);
    const radius = 34;
    for (let i = 0; i < count; i += 1) {
      const a = w.angle + (i / count) * Math.PI * 2;
      const bx = x + Math.cos(a) * radius;
      const by = y + Math.sin(a) * radius;
      g.fillStyle = "#ffb84d";
      g.beginPath();
      g.arc(bx, by, 3.6, 0, Math.PI * 2);
      g.fill();
    }
  }

  drawParticles() {
    const g = this.ctx;
    const dt = 1 / 60;
    const alive = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind === "ring") {
        const k = 1 - p.life / p.maxLife;
        const r = p.size * (0.2 + k * 1.1);
        g.globalAlpha = (1 - k) * 0.5;
        this.drawGlow(p.color, p.x, p.y, r * 2, 0.7);
        g.globalAlpha = (1 - k) * 0.7;
        g.strokeStyle = p.color;
        g.lineWidth = 5 * (1 - k);
        g.beginPath();
        g.arc(p.x, p.y, r, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        alive.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 140 * dt;
      const k = Math.max(0, p.life / p.maxLife);
      this.drawGlow(p.color, p.x, p.y, p.size * 3, k * 0.8);
      g.globalAlpha = k;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      alive.push(p);
    }
    this.particles = alive;
    // 飘字
    const floaters = [];
    for (const f of this.floaters) {
      f.life -= dt;
      if (f.life <= 0) continue;
      f.y += f.vy * dt;
      f.vy *= 0.96;
      const k = Math.max(0, f.life / f.maxLife);
      g.globalAlpha = k;
      g.font = `700 ${f.size}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
      g.globalAlpha = 1;
      floaters.push(f);
    }
    this.floaters = floaters;
  }

  addFloater(x, y, text, color = "#ffd34d", size = 20) {
    this.floaters.push({ x, y, vy: -50, life: 1.1, maxLife: 1.1, text, color, size });
  }
}
