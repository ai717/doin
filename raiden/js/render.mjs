// Canvas 2D presentation layer for Raiden Lite. Rules stay in the engine.

const W = 540;
const H = 900;

const THEMES = {
  cloud: { top: "#061a33", mid: "#0c2a4e", low: "#1b4774", accent: "#7fe6ff", glow: "#bff4ff", haze: "#2a639c", rock: "#133356" },
  canyon: { top: "#1a0c22", mid: "#33162f", low: "#5c2a3c", accent: "#ffb37a", glow: "#ffd6a8", haze: "#7a3a4e", rock: "#3a1a2c" },
  city: { top: "#050d20", mid: "#0a1c3a", low: "#132c55", accent: "#9b8bff", glow: "#c9c1ff", haze: "#223a6a", rock: "#0d1e38" },
  station: { top: "#04161c", mid: "#092a34", low: "#114350", accent: "#65e0d0", glow: "#b6fff2", haze: "#1a5560", rock: "#0a2a33" },
  aurora: { top: "#041224", mid: "#082436", low: "#0f3a46", accent: "#8ef7c4", glow: "#c9ffe6", haze: "#1d5a5c", rock: "#0b2836" },
  mothership: { top: "#170610", mid: "#2f0a1b", low: "#571426", accent: "#ff7a6a", glow: "#ffb9a6", haze: "#6e2030", rock: "#300c18" },
};

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
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

function drawStars(ctx, theme, time, speed) {
  for (let i = 0; i < 90; i += 1) {
    const depth = (i % 5) + 1;
    const x = (i * 137.5 + Math.sin(time * 0.2 + i) * 8) % W;
    const y = (i * 211.7 + time * speed * depth * 0.32) % (H + 40) - 20;
    const radius = 0.5 + depth * 0.32;
    ctx.globalAlpha = 0.18 + depth * 0.1;
    ctx.fillStyle = i % 9 === 0 ? theme.glow : "#dff6ff";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCloud(ctx, theme, time) {
  ctx.save();
  for (let i = 0; i < 6; i += 1) {
    const x = ((i * 173 + time * (12 + i * 3)) % (W + 260)) - 130;
    const y = 120 + ((i * 149 + time * 8) % (H - 260));
    const radius = 110 + i * 26;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `${theme.haze}55`);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCanyon(ctx, theme, time) {
  ctx.save();
  ctx.fillStyle = theme.rock;
  for (const side of [0, 1]) {
    ctx.beginPath();
    const dir = side === 0 ? 1 : -1;
    const origin = side === 0 ? 0 : W;
    ctx.moveTo(origin, H);
    for (let i = 0; i <= 6; i += 1) {
      const y = H - i * 150 - ((time * 26) % 150);
      const inset = 54 + Math.sin(i * 1.3 + time * 0.2) * 26;
      ctx.lineTo(origin + dir * inset, y);
    }
    ctx.lineTo(origin, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = `${theme.accent}33`;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i += 1) {
    const y = ((time * 40 + i * 210) % (H + 120)) - 60;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(W / 2, y - 40, W, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCity(ctx, theme, time) {
  ctx.save();
  const offset = (time * 34) % 140;
  ctx.fillStyle = `${theme.rock}cc`;
  for (let i = 0; i < 8; i += 1) {
    const x = i * 74 - 20;
    const height = 90 + (i % 4) * 46;
    const y = H - 120 - height + offset * 0.4;
    ctx.fillRect(x, y, 52, height);
    ctx.fillStyle = `${theme.accent}44`;
    for (let r = 0; r < 3; r += 1) ctx.fillRect(x + 10, y + 16 + r * 22, 32, 3);
    ctx.fillStyle = `${theme.rock}cc`;
  }
  ctx.strokeStyle = `${theme.accent}30`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i += 1) {
    const y = ((time * 52 + i * 96) % (H + 96)) - 48;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i += 1) {
    const x = 54 + i * 108;
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStation(ctx, theme, time) {
  ctx.save();
  ctx.strokeStyle = `${theme.accent}26`;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 8; i += 1) {
    const y = ((time * 30 + i * 124) % (H + 124)) - 62;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i += 1) {
    const x = 30 + i * 96;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.fillStyle = `${theme.glow}22`;
  for (let i = 0; i < 14; i += 1) {
    const x = (i * 83 + time * 10) % W;
    const y = (i * 149 + time * 18) % H;
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAurora(ctx, theme, time) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let band = 0; band < 4; band += 1) {
    const gradient = ctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.45, band % 2 ? `${theme.accent}30` : "#8a7bff30");
    gradient.addColorStop(1, "transparent");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 34 + band * 12;
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 24) {
      const y = 180 + band * 54 + Math.sin(x * 0.011 + time * 0.4 + band) * 46;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawMothership(ctx, theme, time) {
  ctx.save();
  ctx.strokeStyle = `${theme.accent}2e`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const y = 120 + i * 168 + Math.sin(time * 0.4 + i) * 10;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(90, y + 18);
    ctx.lineTo(W - 90, y + 18);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i += 1) {
    const x = i * 72 + 18;
    const y = 200 + ((i * 131 + time * 24) % (H - 360));
    ctx.fillStyle = `${theme.glow}22`;
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBackground(ctx, theme, time, training) {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, theme.top);
  gradient.addColorStop(0.55, theme.mid);
  gradient.addColorStop(1, theme.low);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  drawStars(ctx, theme, time, training ? 1.1 : 0.8);
  if (training) {
    ctx.strokeStyle = `${theme.accent}22`;
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, (H / 6) * i);
      ctx.lineTo(W, (H / 6) * i);
      ctx.stroke();
    }
    return;
  }
  if (theme === THEMES.cloud) drawCloud(ctx, theme, time);
  else if (theme === THEMES.canyon) drawCanyon(ctx, theme, time);
  else if (theme === THEMES.city) drawCity(ctx, theme, time);
  else if (theme === THEMES.station) drawStation(ctx, theme, time);
  else if (theme === THEMES.aurora) drawAurora(ctx, theme, time);
  else drawMothership(ctx, theme, time);
}

function drawPlayer(ctx, player, time, theme) {
  const blink = player.invuln > 0 && Math.floor(time * 16) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.globalAlpha = blink ? 0.4 : 1;

  const flame = 12 + Math.sin(time * 32) * 4;
  const flameGradient = ctx.createLinearGradient(0, 12, 0, 12 + flame);
  flameGradient.addColorStop(0, `${theme.accent}dd`);
  flameGradient.addColorStop(1, "transparent");
  ctx.fillStyle = flameGradient;
  ctx.beginPath();
  ctx.moveTo(-5, 12);
  ctx.lineTo(0, 12 + flame);
  ctx.lineTo(5, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#eafcff";
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(10, 10);
  ctx.lineTo(3, 7);
  ctx.lineTo(0, 14);
  ctx.lineTo(-3, 7);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0a2236";
  ctx.beginPath();
  ctx.arc(0, -2, 3.4, 0, Math.PI * 2);
  ctx.fill();

  if (player.invuln > 0) {
    ctx.strokeStyle = `${theme.glow}88`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(time * 8) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, enemy, time) {
  const colors = {
    drone: { fill: "#ffb066", edge: "#ffd8a8" },
    zigzag: { fill: "#ff7ab8", edge: "#ffc4e0" },
    gunner: { fill: "#ffd06a", edge: "#fff0bf" },
    heavy: { fill: "#ff6a6a", edge: "#ffb0a8" },
  };
  const color = colors[enemy.type] ?? colors.drone;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = color.fill;
  ctx.strokeStyle = color.edge;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = color.fill;
  ctx.shadowBlur = 10;

  if (enemy.type === "drone") {
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(13, -12);
    ctx.lineTo(0, -5);
    ctx.lineTo(-13, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (enemy.type === "zigzag") {
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeRect(-9, -9, 18, 18);
  } else if (enemy.type === "gunner") {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * 16;
      const y = Math.sin(angle) * 16;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2a1220";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + time * 0.4;
      const x = Math.cos(angle) * 25;
      const y = Math.sin(angle) * 25;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3a0c14";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd0c4";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoss(ctx, boss, time) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const pulse = 1 + Math.sin(time * 3) * 0.03;
  ctx.scale(pulse, pulse);
  const gradient = ctx.createRadialGradient(0, 0, 8, 0, 0, 66);
  gradient.addColorStop(0, "#ffd9b0");
  gradient.addColorStop(0.45, "#ff8a6a");
  gradient.addColorStop(1, "#661420");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "#ffd0a0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + time * 0.25;
    const x = Math.cos(angle) * 58;
    const y = Math.sin(angle) * 58;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#ffdfb8";
  ctx.lineWidth = 2;
  for (let arm = 0; arm < 3; arm += 1) {
    const angle = time * 0.9 + (arm / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
    ctx.lineTo(Math.cos(angle) * 66, Math.sin(angle) * 66);
    ctx.stroke();
  }
  ctx.fillStyle = "#fff6e8";
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBullets(ctx, session, theme) {
  const world = session.world;
  for (const shot of world.bullets) {
    ctx.save();
    ctx.fillStyle = "#dffcff";
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 9;
    roundRect(ctx, shot.x - 2.4, shot.y - 8, 4.8, 16, 2.4);
    ctx.fill();
    ctx.restore();
  }
  for (const shot of world.enemyBullets) {
    ctx.save();
    ctx.shadowColor = session.stageIndex >= 4 ? "#ff7a6a" : "#ffb066";
    ctx.shadowBlur = 11;
    ctx.fillStyle = "#fff2df";
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = session.stageIndex >= 4 ? "#ff8a72" : "#ffc47a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBeam(ctx, beam, theme) {
  if (!beam) return;
  const alpha = Math.max(0, Math.min(1, beam.life / beam.max));
  ctx.save();
  ctx.globalAlpha = alpha;
  const gradient = ctx.createLinearGradient(beam.x - beam.w / 2, 0, beam.x + beam.w / 2, 0);
  gradient.addColorStop(0, `${theme.accent}00`);
  gradient.addColorStop(0.3, theme.accent);
  gradient.addColorStop(0.5, "#ffffff");
  gradient.addColorStop(0.7, theme.accent);
  gradient.addColorStop(1, `${theme.accent}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(beam.x - beam.w / 2, 0, beam.w, H);
  ctx.restore();
}

function drawItems(ctx, session) {
  for (const item of session.world.items) {
    ctx.save();
    ctx.translate(item.x, item.y);
    if (item.type === "power") {
      ctx.fillStyle = "#9ff4ff";
      ctx.shadowColor = "#9ff4ff";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2;
        const x = Math.cos(angle) * 11;
        const y = Math.sin(angle) * 11;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = "#ffb38a";
      ctx.shadowColor = "#ffb38a";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffb38a";
      ctx.beginPath();
      ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawEffects(ctx, session) {
  const world = session.world;
  for (const particle of world.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, particle.life / particle.max));
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = "700 15px 'Trebuchet MS', system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const float of world.floats) {
    ctx.globalAlpha = Math.max(0, Math.min(1, float.life / 0.85));
    ctx.fillStyle = float.color;
    ctx.fillText(float.text, float.x, float.y);
  }
  ctx.globalAlpha = 1;
  if (world.flash > 0.01) {
    ctx.fillStyle = `rgba(220,247,255,${Math.min(0.55, world.flash)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function createRenderer({ canvas }) {
  if (!canvas) throw new Error("canvas required");
  const ctx = canvas.getContext("2d");
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    const width = Math.round(W * dpr);
    const height = Math.round(H * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function draw(session) {
    resize();
    const world = session?.world;
    if (!world) return;
    const theme = THEMES[session.stage?.theme] ?? THEMES.cloud;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const time = session.time;
    const shake = world.shake;
    ctx.save();
    if (shake > 0.2) {
      ctx.translate(Math.sin(time * 71) * shake * 0.45, Math.cos(time * 53) * shake * 0.35);
    }
    drawBackground(ctx, theme, time, session.mode === "training");
    drawBeam(ctx, world.beam, theme);
    drawItems(ctx, session);
    for (const enemy of world.enemies) drawEnemy(ctx, enemy, time);
    if (session.boss) drawBoss(ctx, session.boss, time);
    drawPlayer(ctx, world.player, time, theme);
    drawBullets(ctx, session, theme);
    drawEffects(ctx, session);
    ctx.restore();
  }

  return { draw, resize };
}
