// Canvas 2D stage renderer: everything inside the porthole glass lives here.
// HUD, frame, gauges and overlays stay in the DOM layer.
import {
  VIEW_W,
  VIEW_H,
  COL_W,
  ROW_H,
  TURRET_Y,
  TURRET_W,
  TURRET_H,
  RED_LINE_Y,
  BARRICADE_CELL,
  BARRICADE_COLS,
  BARRICADE_ROWS,
  RAIL_HALF_W,
  DIVE_ARC_TIME,
} from "./data.mjs";

const HUE = {
  grunt: 312,
  crusher: 16,
  squid: 172,
  swarm: 48,
  bulwark: 205,
  splitter: 276,
  phantom: 188,
  spawn: 336,
  mothership: 266,
};

const MOD_COLOR = {
  mod_spread: "#ffb545",
  mod_shield: "#6fe8ff",
  mod_slowfield: "#a58bff",
  mod_magrail: "#8dff9f",
};

function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

function makeStars(seed = 20240928) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const stars = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: rand() * VIEW_W,
      y: rand() * (VIEW_H * 0.86),
      r: 0.5 + rand() * 1.5,
      a: 0.25 + rand() * 0.6,
      drift: 6 + rand() * 18,
    });
  }
  return stars;
}

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const stars = makeStars();
  let scale = 1;
  let dpr = 1;
  let reduced = false;
  let shake = 0;
  let flash = 0;
  const particles = [];

  if (typeof matchMedia === "function") {
    try {
      reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width || VIEW_W);
    const cssH = Math.max(1, rect.height || VIEW_H);
    dpr = Math.min(2, typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = Math.min(cssW / VIEW_W, cssH / VIEW_H);
  }

  function spawnBurst(x, y, hue, count, power = 1) {
    if (reduced) count = Math.min(count, 3);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (60 + Math.random() * 200) * power;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.35 + Math.random() * 0.4,
        age: 0,
        size: 2 + Math.random() * 4,
        hue,
      });
    }
  }

  function spawnRing(x, y, hue, radius = 8, color = null) {
    particles.push({ x, y, vx: 0, vy: 0, life: 0.35, age: 0, ring: true, radius, hue, color });
  }

  function spawnSteam(x, y) {
    for (let i = 0; i < 6; i += 1) {
      particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y,
        vx: (Math.random() - 0.5) * 90,
        vy: -30 - Math.random() * 60,
        life: 0.6 + Math.random() * 0.4,
        age: 0,
        size: 8 + Math.random() * 10,
        hue: 200,
        steam: true,
      });
    }
  }

  function consume(events) {
    for (const event of events) {
      switch (event.type) {
        case "kill": {
          spawnBurst(event.x, event.y, HUE[event.alien] ?? 300, event.headon ? 14 : 8, event.headon ? 1.5 : 1);
          spawnRing(event.x, event.y, HUE[event.alien] ?? 300, event.headon ? 16 : 9);
          if (event.headon) {
            spawnRing(event.x, event.y, 0, 26, "rgba(255,255,255,0.9)");
            shake = Math.max(shake, 7);
            flash = Math.max(flash, 0.35);
          }
          break;
        }
        case "hit":
          spawnBurst(event.x, event.y, HUE[event.alien] ?? 300, 3, 0.6);
          break;
        case "deflect":
          spawnRing(event.x, event.y, 200, 12, "rgba(150,220,255,0.8)");
          break;
        case "chip":
          spawnBurst(event.x, event.y, 190, 3, 0.5);
          break;
        case "crash":
          spawnBurst(event.x, event.y, 20, 10, 1.2);
          shake = Math.max(shake, 5);
          break;
        case "hull":
          spawnBurst(event.x, event.y, 355, 12, 1.2);
          shake = Math.max(shake, 9);
          flash = Math.max(flash, 0.28);
          break;
        case "overheat":
          spawnSteam(event.x, event.y - 20);
          break;
        case "rail":
          flash = Math.max(flash, 0.3);
          shake = Math.max(shake, 4);
          break;
        case "mshipDown":
          spawnBurst(event.x, event.y, 266, 26, 1.6);
          spawnRing(event.x, event.y, 266, 60);
          shake = Math.max(shake, 12);
          flash = Math.max(flash, 0.5);
          break;
        case "mod":
          spawnRing(event.x, event.y, 60, 22, MOD_COLOR[event.key] ?? "#ffd479");
          break;
        default:
          break;
      }
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.age += dt;
      if (!p.ring) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.steam ? -60 : 420) * dt;
        p.vx *= 0.98;
      }
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].age >= particles[i].life) particles.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 26);
    flash = Math.max(0, flash - dt * 1.8);
  }

  function drawBackground(state) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "#050a1c");
    g.addColorStop(0.55, "#0a1330");
    g.addColorStop(1, "#131a3d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const nebula = ctx.createRadialGradient(VIEW_W * 0.24, VIEW_H * 0.2, 20, VIEW_W * 0.24, VIEW_H * 0.2, 420);
    nebula.addColorStop(0, "rgba(96,74,190,0.35)");
    nebula.addColorStop(1, "rgba(96,74,190,0)");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const nebula2 = ctx.createRadialGradient(VIEW_W * 0.82, VIEW_H * 0.62, 20, VIEW_W * 0.82, VIEW_H * 0.62, 380);
    nebula2.addColorStop(0, "rgba(24,140,150,0.28)");
    nebula2.addColorStop(1, "rgba(24,140,150,0)");
    ctx.fillStyle = nebula2;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    for (const star of stars) {
      const y = (star.y + state.time * star.drift * 0.12) % (VIEW_H * 0.9);
      ctx.globalAlpha = star.a;
      ctx.fillStyle = "#dff1ff";
      ctx.fillRect(star.x, y, star.r, star.r);
    }
    ctx.globalAlpha = 1;

    // planet limb along the lower edge, seen through the porthole
    const limb = ctx.createLinearGradient(0, VIEW_H - 120, 0, VIEW_H);
    limb.addColorStop(0, "rgba(58,124,168,0.0)");
    limb.addColorStop(0.55, "rgba(58,124,168,0.35)");
    limb.addColorStop(1, "rgba(120,190,230,0.6)");
    ctx.fillStyle = limb;
    ctx.beginPath();
    ctx.moveTo(-40, VIEW_H + 30);
    ctx.quadraticCurveTo(VIEW_W / 2, VIEW_H - 150, VIEW_W + 40, VIEW_H + 30);
    ctx.closePath();
    ctx.fill();
  }

  function drawRedLine(state) {
    const bottom = state.formation.y + 5 * ROW_H;
    const danger = Math.max(0, Math.min(1, (bottom - (RED_LINE_Y - 180)) / 180));
    ctx.save();
    ctx.setLineDash([16, 12]);
    ctx.lineWidth = 2 + danger * 2;
    ctx.strokeStyle = `rgba(255,${120 - danger * 70},${110 - danger * 60},${0.28 + danger * 0.6})`;
    ctx.shadowColor = "rgba(255,80,80,0.8)";
    ctx.shadowBlur = 8 + danger * 20;
    ctx.beginPath();
    ctx.moveTo(0, RED_LINE_Y);
    ctx.lineTo(VIEW_W, RED_LINE_Y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBarricade(barricade) {
    for (let row = 0; row < BARRICADE_ROWS; row += 1) {
      for (let col = 0; col < BARRICADE_COLS; col += 1) {
        if (barricade.cells[row * BARRICADE_COLS + col] !== 1) continue;
        const x = barricade.x + col * BARRICADE_CELL;
        const y = barricade.y + row * BARRICADE_CELL;
        const t = row / BARRICADE_ROWS;
        ctx.fillStyle = hsl(186 + t * 14, 60, 30 + t * 22);
        roundRect(ctx, x + 0.5, y + 0.5, BARRICADE_CELL - 1, BARRICADE_CELL - 1, 2);
        ctx.fill();
        ctx.fillStyle = "rgba(190,255,255,0.22)";
        ctx.fillRect(x + 1, y + 1, BARRICADE_CELL - 2, 1.6);
      }
    }
    ctx.save();
    ctx.shadowColor = "rgba(90,220,255,0.5)";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(140,240,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barricade.x, barricade.y, barricade.w, barricade.h);
    ctx.restore();
  }

  function drawAlien(state, alien) {
    const def = { size: 34 };
    const size = def.size;
    const hue = HUE[alien.type] ?? 300;
    const wobble = Math.floor(state.time * 3 + alien.col) % 2 === 0 ? 0 : 1;
    const x = alien.x;
    const y = alien.y;
    const w = (alien.type === "spawn" ? 24 : size) * (alien.type === "bulwark" ? 1.12 : 1);
    const h = w * 0.74;
    ctx.save();
    ctx.translate(x, y);
    if (alien.mode === "dive") {
      const tilt = alien.phase === "dash" ? 0.22 : 0.12;
      ctx.rotate(tilt * (alien.targetX > x ? 1 : -1));
    }
    if (alien.type === "phantom" && alien.cloaked) ctx.globalAlpha = 0.3;

    // soft gel body
    const grad = ctx.createRadialGradient(-w * 0.22, -h * 0.3, 2, 0, 0, w * 0.8);
    grad.addColorStop(0, hsl(hue, 90, 74));
    grad.addColorStop(0.55, hsl(hue, 78, 52));
    grad.addColorStop(1, hsl(hue, 70, 32));
    ctx.fillStyle = grad;
    roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.34);
    ctx.fill();

    ctx.strokeStyle = hsl(hue, 80, 82, 0.5);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // legs
    ctx.strokeStyle = hsl(hue, 70, 62);
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i += 2) {
      const lift = wobble ? 3 : -1;
      ctx.beginPath();
      ctx.moveTo(i * w * 0.3, h * 0.36);
      ctx.lineTo(i * w * 0.46, h * 0.36 + 8 + lift);
      ctx.stroke();
    }

    // eyes
    ctx.fillStyle = "rgba(12,10,26,0.92)";
    ctx.beginPath();
    ctx.ellipse(-w * 0.18, -h * 0.08, w * 0.11, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.18, -h * 0.08, w * 0.11, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-w * 0.22, -h * 0.16, 2.4, 2.4);
    ctx.fillRect(w * 0.14, -h * 0.16, 2.4, 2.4);

    // per type accents
    if (alien.type === "crusher") {
      ctx.strokeStyle = hsl(hue, 90, 78);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-w * 0.52, 0, 6, -0.6, 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w * 0.52, 0, 6, 1.5, 3.7);
      ctx.stroke();
    } else if (alien.type === "squid") {
      ctx.strokeStyle = hsl(hue, 80, 70);
      ctx.lineWidth = 2.4;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * w * 0.22, h * 0.4);
        ctx.quadraticCurveTo(i * w * 0.3 + (wobble ? 6 : -6), h * 0.62, i * w * 0.2, h * 0.78);
        ctx.stroke();
      }
    } else if (alien.type === "swarm") {
      ctx.fillStyle = hsl(hue, 90, 72, 0.5);
      ctx.beginPath();
      ctx.ellipse(-w * 0.6, -2, w * 0.2, h * 0.24, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.6, -2, w * 0.2, h * 0.24, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (alien.type === "splitter") {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.36);
      ctx.lineTo(0, h * 0.36);
      ctx.stroke();
    } else if (alien.type === "bulwark") {
      if (!alien.shieldOpen) {
        ctx.strokeStyle = "rgba(150,225,255,0.95)";
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(120,210,255,0.9)";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.72, -1.05, 1.05);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = "rgba(150,225,255,0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.72, -0.6, 0.6);
        ctx.stroke();
      }
    }

    if (alien.mode === "dive" && alien.phase === "dash") {
      ctx.strokeStyle = "rgba(255,120,120,0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(0, h * 0.5 + 26 + Math.sin(state.time * 40) * 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMothership(state) {
    const ms = state.mothership;
    if (!ms) return;
    const w = ms.size;
    const h = w * 0.34;
    ctx.save();
    ctx.translate(ms.x, ms.y);
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, hsl(266, 70, 62));
    grad.addColorStop(1, hsl(266, 60, 26));
    ctx.fillStyle = grad;
    roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.45);
    ctx.fill();
    ctx.strokeStyle = "rgba(210,180,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = -3; i <= 3; i += 1) {
      const on = Math.floor(state.time * 4 + i) % 4 !== 0;
      ctx.fillStyle = on ? "rgba(255,225,140,0.95)" : "rgba(255,225,140,0.25)";
      ctx.beginPath();
      ctx.arc(i * (w / 8), h * 0.12, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(180,220,255,0.5)";
    ctx.fillRect(-w * 0.32, -h * 0.1, w * 0.64, 4);
    // hull bar
    const ratio = Math.max(0, ms.hp / ms.maxHp);
    ctx.fillStyle = "rgba(255,90,110,0.85)";
    ctx.fillRect(-w * 0.4, -h * 0.62, w * 0.8 * ratio, 7);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.strokeRect(-w * 0.4, -h * 0.62, w * 0.8, 7);
    ctx.restore();
  }

  function drawTurret(state) {
    const t = state.turret;
    const x = t.x;
    const y = TURRET_Y;
    ctx.save();
    // rail
    ctx.fillStyle = "rgba(120,150,190,0.28)";
    ctx.fillRect(0, y + TURRET_H * 0.4, VIEW_W, 8);

    // charge ring
    if (t.charging && t.charge > 0.05) {
      const p = Math.min(1, t.charge / 0.6);
      ctx.strokeStyle = p >= 1 ? "rgba(255,240,160,0.95)" : "rgba(150,220,255,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y - 6, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.stroke();
    }

    const heatGlow = t.overheated ? 1 : t.heat;
    if (t.invuln > 0 && Math.floor(state.time * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    const body = ctx.createLinearGradient(0, y - TURRET_H / 2, 0, y + TURRET_H / 2);
    body.addColorStop(0, "#d9e9ff");
    body.addColorStop(0.5, "#8fa8cf");
    body.addColorStop(1, "#3d5378");
    ctx.fillStyle = body;
    roundRect(ctx, x - TURRET_W / 2, y - TURRET_H / 2, TURRET_W, TURRET_H, 8);
    ctx.fill();
    ctx.fillStyle = `rgba(255,${170 - heatGlow * 110},${90 - heatGlow * 60},${0.35 + heatGlow * 0.5})`;
    ctx.fillRect(x - TURRET_W / 2 + 6, y + 4, TURRET_W - 12, 5);

    // barrel
    ctx.fillStyle = "#c9dcf5";
    roundRect(ctx, x - 7, y - TURRET_H / 2 - 16, 14, 20, 4);
    ctx.fill();
    ctx.fillStyle = heatGlow > 0.05 ? `rgba(255,140,80,${0.4 + heatGlow * 0.5})` : "rgba(150,225,255,0.85)";
    ctx.fillRect(x - 3, y - TURRET_H / 2 - 20, 6, 8);

    if (state.mod.key === "mod_shield" && state.mod.blocks > 0) {
      ctx.strokeStyle = "rgba(120,235,255,0.85)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(120,235,255,0.9)";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(x, y, TURRET_W * 0.62, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawBeams(state) {
    for (const beam of state.beams) {
      const p = 1 - beam.age / beam.life;
      const g = ctx.createLinearGradient(beam.x - RAIL_HALF_W, 0, beam.x + RAIL_HALF_W, 0);
      g.addColorStop(0, "rgba(160,240,255,0)");
      g.addColorStop(0.5, `rgba(230,255,255,${0.85 * p})`);
      g.addColorStop(1, "rgba(160,240,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(beam.x - RAIL_HALF_W, 0, RAIL_HALF_W * 2, beam.y);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * p})`;
      ctx.fillRect(beam.x - 3, 0, 6, beam.y);
    }
  }

  function drawSweep(state) {
    const sweep = state.sweep;
    if (!sweep) return;
    if (!sweep.fired) {
      ctx.fillStyle = `rgba(255,90,110,${0.16 + 0.2 * Math.sin(sweep.t * 30)})`;
      ctx.fillRect(sweep.x - 46, 0, 92, VIEW_H);
    } else {
      ctx.fillStyle = "rgba(255,210,220,0.55)";
      ctx.fillRect(sweep.x - 22, 0, 44, VIEW_H);
    }
  }

  function drawBullets(state) {
    for (const bullet of state.bullets) {
      ctx.save();
      ctx.shadowColor = "rgba(140,235,255,0.9)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#eaffff";
      roundRect(ctx, bullet.x - 2.5, bullet.y - 12, 5, 16, 2.5);
      ctx.fill();
      ctx.restore();
    }
    for (const bullet of state.enemyBullets) {
      ctx.save();
      ctx.shadowColor = "rgba(255,120,180,0.9)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffd3e6";
      ctx.beginPath();
      ctx.ellipse(bullet.x, bullet.y, 3.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const pickup of state.pickups) {
      const color = MOD_COLOR[pickup.key] ?? "#ffd479";
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(state.time * 2);
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * 13;
        const py = Math.sin(a) * 13;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const life = 1 - p.age / p.life;
      if (p.ring) {
        ctx.save();
        ctx.globalAlpha = life;
        ctx.strokeStyle = p.color ?? hsl(p.hue, 90, 70);
        ctx.lineWidth = 3 * life + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (1 + (1 - life) * 2.2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.steam) {
        ctx.save();
        ctx.globalAlpha = life * 0.4;
        ctx.fillStyle = "#dff1ff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - life) * 1.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = life;
        ctx.fillStyle = hsl(p.hue, 90, 66);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }
  }

  // A diving alien commits to one lane the moment it breaks formation. Painting
  // that lane on the deck turns the dive from an unavoidable hit into a read.
  // It is revealed only for the back half of the arc - shown from the start it
  // turned the whole deck into a ruler and players read it as static UI rather
  // than as a threat - and it ends in an impact chevron so it can never be
  // mistaken for a boundary line.
  function drawDiveLanes(state) {
    const deck = TURRET_Y - TURRET_H / 2;
    for (const alien of state.aliens) {
      if (!alien.alive || alien.mode !== "dive") continue;
      const dashing = alien.phase === "dash";
      // The marker has to survive the dash itself: glancing away for a moment
      // must not cost the read, so a committed diver keeps painting its lane.
      if (!dashing && alien.phase !== "arc") continue;
      const progress = Math.min(1, alien.diveT / DIVE_ARC_TIME);
      const reveal = dashing ? 1 : Math.min(1, Math.max(0, (progress - 0.4) / 0.45));
      if (reveal <= 0.01) continue;
      const top = alien.y + 18;
      if (top >= deck) continue;
      const lane = dashing ? alien.x : alien.targetX;
      const drift = lane + (alien.x - lane) * (1 - progress);
      ctx.save();
      ctx.globalAlpha = reveal;
      ctx.setLineDash([7, 9]);
      ctx.lineDashOffset = -state.time * 60;
      ctx.lineWidth = 2 + progress * 2.5;
      ctx.strokeStyle = `rgba(255,130,130,${0.22 + progress * 0.45})`;
      ctx.beginPath();
      ctx.moveTo(drift, top);
      ctx.lineTo(lane, deck - 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,150,150,${0.4 + progress * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(lane - 10, deck - 30);
      ctx.lineTo(lane + 10, deck - 30);
      ctx.lineTo(lane, deck - 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(state, dt, events = []) {
    consume(events);
    updateParticles(dt);
    const canvasW = canvas.width;
    const canvasH = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = "#04060f";
    ctx.fillRect(0, 0, canvasW, canvasH);
    const offsetX = (canvasW - VIEW_W * scale * dpr) / 2;
    const offsetY = (canvasH - VIEW_H * scale * dpr) / 2;
    const jitterX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const jitterY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX + jitterX * dpr, offsetY + jitterY * dpr);

    drawBackground(state);
    drawRedLine(state);
    drawDiveLanes(state);
    drawMothership(state);
    for (const barricade of state.barricades) drawBarricade(barricade);
    for (const alien of state.aliens) {
      if (!alien.alive) continue;
      drawAlien(state, alien);
    }
    drawSweep(state);
    drawBeams(state);
    drawBullets(state);
    drawTurret(state);
    drawParticles();

    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const s = Math.min(rect.width / VIEW_W, rect.height / VIEW_H) || 1;
    const ox = (rect.width - VIEW_W * s) / 2;
    const oy = (rect.height - VIEW_H * s) / 2;
    return { x: (clientX - rect.left - ox) / s, y: (clientY - rect.top - oy) / s };
  }

  resize();
  return { resize, draw, spawnBurst, particles, toLogical };
}

export { VIEW_W, VIEW_H, COL_W, ROW_H, TURRET_Y, DIVE_ARC_TIME };
