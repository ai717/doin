// Canvas 2D presentation layer for Snowball Bros. Nothing here owns rules.

const W = 960;
const H = 540;

const ART = [
  {
    top: "#071428", mid: "#123458", low: "#2c5d88", hill: "#2b5580", hillBack: "#1c3d61",
    snow: "#f4fbff", accent: "#66b8ee", glow: "#9fd8ff",
  },
  {
    top: "#0d0a24", mid: "#1b2450", low: "#273c6a", hill: "#1c2f55", hillBack: "#141f3d",
    snow: "#eafaff", accent: "#79ecff", glow: "#b9f6ff",
  },
  {
    top: "#030a1e", mid: "#0b1d3a", low: "#15325a", hill: "#18365c", hillBack: "#0f2545",
    snow: "#efffff", accent: "#8ef7c4", glow: "#c4ffe8",
  },
];

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

function drawSnowflakes(ctx, time, alpha = 0.7) {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i < 64; i += 1) {
    const speed = 18 + (i % 7) * 7;
    const x = (i * 149 + Math.sin(time * 0.5 + i) * 18 + 960) % 960;
    const y = (i * 83 + time * speed) % 560;
    const r = 0.8 + (i % 3) * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVillage(ctx, art, time) {
  ctx.fillStyle = art.hillBack;
  ctx.beginPath();
  ctx.moveTo(-20, 470);
  ctx.quadraticCurveTo(150, 330, 330, 462);
  ctx.quadraticCurveTo(520, 350, 720, 460);
  ctx.quadraticCurveTo(860, 390, 980, 470);
  ctx.lineTo(980, 560);
  ctx.lineTo(-20, 560);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = art.hill;
  ctx.beginPath();
  ctx.moveTo(-20, 505);
  ctx.quadraticCurveTo(240, 400, 470, 500);
  ctx.quadraticCurveTo(690, 410, 980, 500);
  ctx.lineTo(980, 560);
  ctx.lineTo(-20, 560);
  ctx.closePath();
  ctx.fill();
  for (const [x, y, scale] of [[90, 468, 0.9], [286, 482, 0.7], [700, 474, 0.85], [856, 488, 0.65]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#31435c";
    ctx.fillRect(-26, -30, 52, 34);
    ctx.fillStyle = "#e9f6ff";
    ctx.beginPath();
    ctx.moveTo(-34, -30);
    ctx.lineTo(0, -58);
    ctx.lineTo(34, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd98a";
    ctx.globalAlpha = 0.7 + Math.sin(time * 1.4 + x) * 0.18;
    ctx.fillRect(-13, -22, 10, 10);
    ctx.fillRect(5, -22, 10, 10);
    ctx.restore();
  }
}

function drawCave(ctx, art, time) {
  ctx.fillStyle = art.hillBack;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(960, 0);
  ctx.lineTo(960, 150);
  for (let x = 960; x >= 0; x -= 80) {
    ctx.lineTo(x, 90 + Math.sin(x * 0.07) * 40);
    ctx.lineTo(x - 40, 20 + Math.sin(x * 0.05) * 30);
  }
  ctx.closePath();
  ctx.fill();
  for (const [x, hue] of [[70, "#79ecff"], [140, "#b48cff"], [820, "#79ecff"], [884, "#8ef7c4"]]) {
    ctx.save();
    ctx.translate(x, 520);
    ctx.fillStyle = hue;
    ctx.globalAlpha = 0.35 + Math.sin(time * 1.6 + x) * 0.1;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(0, -92);
    ctx.lineTo(16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -88);
    ctx.lineTo(0, -12);
    ctx.stroke();
    ctx.restore();
  }
}

function drawAurora(ctx, art, time) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 211) % 960;
    const y = 24 + ((i * 71) % 240);
    ctx.globalAlpha = 0.25 + (Math.sin(time + i) + 1) * 0.25;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
  const ribbons = ["#56f2b4", "#7c9dff", "#d58cff"];
  ribbons.forEach((color, index) => {
    ctx.save();
    ctx.globalAlpha = 0.16 + index * 0.03;
    ctx.strokeStyle = color;
    ctx.lineWidth = 26 - index * 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = -40; x <= 1000; x += 20) {
      const y = 110 + index * 46 + Math.sin(x * 0.008 + time * 0.35 + index) * 34;
      if (x === -40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  });
  ctx.fillStyle = art.hill;
  ctx.beginPath();
  ctx.moveTo(0, 540);
  ctx.lineTo(0, 430);
  ctx.lineTo(150, 300);
  ctx.lineTo(300, 420);
  ctx.lineTo(470, 260);
  ctx.lineTo(660, 420);
  ctx.lineTo(820, 320);
  ctx.lineTo(960, 430);
  ctx.lineTo(960, 540);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = art.hillBack;
  ctx.beginPath();
  ctx.moveTo(0, 540);
  ctx.lineTo(0, 480);
  ctx.quadraticCurveTo(240, 400, 480, 480);
  ctx.quadraticCurveTo(720, 410, 960, 480);
  ctx.lineTo(960, 540);
  ctx.closePath();
  ctx.fill();
}

function drawBackground(ctx, chapter, time) {
  const art = ART[Math.max(0, Math.min(2, chapter))] ?? ART[0];
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, art.top);
  sky.addColorStop(0.55, art.mid);
  sky.addColorStop(1, art.low);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (chapter === 1) drawCave(ctx, art, time);
  else if (chapter === 2) drawAurora(ctx, art, time);
  else drawVillage(ctx, art, time);
  drawSnowflakes(ctx, time, chapter === 1 ? 0.45 : 0.65);
  const vignette = ctx.createRadialGradient(W / 2, H / 2, 210, W / 2, H / 2, 620);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(2,8,20,0.5)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawPlatform(ctx, plat, art) {
  if (plat.type === "spring") {
    ctx.fillStyle = "#a63a33";
    roundRect(ctx, plat.x, plat.y + 3, plat.w, plat.h + 2, 3);
    ctx.fill();
    ctx.strokeStyle = "#ffd9a3";
    ctx.lineWidth = 2;
    for (let x = plat.x + 8; x < plat.x + plat.w - 6; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, plat.y + 7);
      ctx.lineTo(x + 6, plat.y + 3);
      ctx.lineTo(x + 12, plat.y + 7);
      ctx.stroke();
    }
    ctx.fillStyle = "#ff8b6a";
    roundRect(ctx, plat.x - 4, plat.y - 3, plat.w + 8, 7, 3);
    ctx.fill();
    return;
  }
  if (plat.type === "ice") {
    ctx.fillStyle = "rgba(126,220,255,0.5)";
    roundRect(ctx, plat.x, plat.y, plat.w, plat.h, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(225,252,255,0.75)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    roundRect(ctx, plat.x, plat.y, plat.w, 5, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(plat.x + 10, plat.y + 6);
    ctx.lineTo(plat.x + 44, plat.y + 6);
    ctx.lineTo(plat.x + 20, plat.y + plat.h);
    ctx.lineTo(plat.x + 4, plat.y + plat.h);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.fillStyle = "rgba(8,20,38,0.35)";
  roundRect(ctx, plat.x + 3, plat.y + 6, plat.w, plat.h, 3);
  ctx.fill();
  const base = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
  base.addColorStop(0, "#51749c");
  base.addColorStop(1, "#2c4566");
  ctx.fillStyle = base;
  roundRect(ctx, plat.x, plat.y, plat.w, plat.h, 3);
  ctx.fill();
  ctx.fillStyle = art.snow;
  roundRect(ctx, plat.x - 1, plat.y - 3, plat.w + 2, 7, 3);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, plat.x + 6, plat.y - 1, Math.max(8, plat.w - 12), 2, 1);
  ctx.fill();
}

function drawBrick(ctx, brick, time) {
  ctx.save();
  ctx.fillStyle = "rgba(146,225,255,0.55)";
  roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(235,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(brick.x + 6, brick.y + 4);
  ctx.lineTo(brick.x + 18, brick.y + 16);
  ctx.lineTo(brick.x + 10, brick.y + 26);
  ctx.stroke();
  if (brick.item) {
    ctx.fillStyle = `rgba(255,236,150,${0.5 + Math.sin(time * 3) * 0.3})`;
    ctx.beginPath();
    ctx.arc(brick.x + brick.w / 2, brick.y + brick.h / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx, enemy, time) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const bob = Math.sin(time * 6 + enemy.id) * 1.5;
  if (enemy.type === "boss") {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, enemy.h / 2 - 2, 44, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(-16, -20, 6, 0, 0, 52);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.65, "#d9f2ff");
    body.addColorStop(1, "#8fc3e6");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, bob, 42, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7fb4dc";
    ctx.beginPath();
    ctx.ellipse(-32, -30 + bob, 12, 14, -0.4, 0, Math.PI * 2);
    ctx.ellipse(32, -30 + bob, 12, 14, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#243b57";
    ctx.beginPath();
    ctx.arc(-14, -8 + bob, 4.5, 0, Math.PI * 2);
    ctx.arc(14, -8 + bob, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8a6a";
    ctx.beginPath();
    ctx.moveTo(0, 2 + bob);
    ctx.lineTo(-7, 14 + bob);
    ctx.lineTo(7, 14 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd76a";
    ctx.beginPath();
    ctx.moveTo(-26, -40 + bob);
    ctx.lineTo(-18, -58 + bob);
    ctx.lineTo(-6, -42 + bob);
    ctx.lineTo(4, -60 + bob);
    ctx.lineTo(14, -42 + bob);
    ctx.lineTo(26, -58 + bob);
    ctx.lineTo(26, -36 + bob);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < enemy.maxHp; i += 1) {
      ctx.fillStyle = i < enemy.hp ? "#ffd76a" : "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(-18 + i * 18, -74 + bob, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (enemy.type === "flyer") {
    const flap = Math.sin(time * 12 + enemy.id) * 8;
    ctx.fillStyle = "#8a6bff";
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.quadraticCurveTo(-30, -20 - flap, -40, 2);
    ctx.quadraticCurveTo(-26, 4, -10, 6);
    ctx.closePath();
    ctx.moveTo(10, -4);
    ctx.quadraticCurveTo(30, -20 - flap, 40, 2);
    ctx.quadraticCurveTo(26, 4, 10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#b79cff";
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#241a44";
    ctx.beginPath();
    ctx.arc(-5, -2, 2.6, 0, Math.PI * 2);
    ctx.arc(5, -2, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const palette = {
      slime: ["#79e3a2", "#43b97a"],
      armored: ["#c8d6ec", "#8397b8"],
      thrower: ["#ff9f7e", "#d96a50"],
    }[enemy.type] ?? ["#79e3a2", "#43b97a"];
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, enemy.h / 2 - 2, enemy.w / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createLinearGradient(0, -enemy.h / 2, 0, enemy.h / 2);
    body.addColorStop(0, palette[0]);
    body.addColorStop(1, palette[1]);
    ctx.fillStyle = body;
    roundRect(ctx, -enemy.w / 2, -enemy.h / 2 + bob, enemy.w, enemy.h, enemy.w * 0.45);
    ctx.fill();
    if (enemy.type === "armored") {
      ctx.fillStyle = "#9fb2d0";
      roundRect(ctx, -enemy.w / 2 - 2, -enemy.h / 2 - 4 + bob, enemy.w + 4, 12, 5);
      ctx.fill();
      ctx.fillStyle = "#657c9e";
      ctx.fillRect(-2, -enemy.h / 2 - 2 + bob, 4, 8);
    }
    ctx.fillStyle = "#20303f";
    const eyeX = enemy.dir >= 0 ? 4 : -4;
    ctx.beginPath();
    ctx.arc(eyeX - 5, -2 + bob, 2.6, 0, Math.PI * 2);
    ctx.arc(eyeX + 5, -2 + bob, 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (enemy.type === "thrower") {
      ctx.fillStyle = "#f4fbff";
      ctx.beginPath();
      ctx.arc(enemy.dir * 16, -2 + bob, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (enemy.freeze > 0.02 && enemy.type !== "boss") {
    ctx.strokeStyle = "rgba(190,240,255,0.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -enemy.h / 2 - 10, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, enemy.freeze));
    ctx.stroke();
  }
  ctx.restore();
}

function drawSnowball(ctx, ball, time) {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  if (ball.rolling) {
    ctx.fillStyle = "rgba(220,245,255,0.35)";
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.arc(-ball.dir * i * ball.r * 0.7, Math.sin(time * 8 + i) * 3, ball.r * (0.7 - i * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const body = ctx.createRadialGradient(-ball.r * 0.35, -ball.r * 0.4, 2, 0, 0, ball.r);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.72, "#e7f7ff");
  body.addColorStop(1, "#a9d4ee");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(150,200,230,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  ctx.rotate(ball.spin);
  ctx.fillStyle = "rgba(150,205,235,0.55)";
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(Math.cos((i / 3) * Math.PI * 2) * ball.r * 0.5, Math.sin((i / 3) * Math.PI * 2) * ball.r * 0.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (!ball.rolling) {
    const ratio = Math.max(0, Math.min(1, ball.escape / 7));
    ctx.strokeStyle = `rgba(120,230,255,${0.45 + Math.sin(time * 6) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, ball.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ctx, player, time) {
  if (player.respawn > 0) return;
  const blink = player.invuln > 0 && Math.sin(time * 22) > 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (blink) ctx.globalAlpha = 0.35;
  const bob = player.onGround && Math.abs(player.vx) > 10 ? Math.sin(player.walk) * 1.5 : 0;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, -1, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f8fdff";
  ctx.beginPath();
  ctx.arc(0, -14 + bob, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -29 + bob, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d8ecfa";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -14 + bob, 13, 0.4, 2.2);
  ctx.stroke();
  ctx.fillStyle = "#e04a4a";
  ctx.beginPath();
  ctx.moveTo(-11, -24 + bob);
  ctx.lineTo(11, -24 + bob);
  ctx.lineTo(9, -19 + bob);
  ctx.lineTo(-9, -19 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(player.facing > 0 ? 8 : -16, -22 + bob, 8, 5);
  ctx.fillStyle = "#2d6fb5";
  roundRect(ctx, -11, -45 + bob, 22, 8, 3);
  ctx.fill();
  roundRect(ctx, -9, -41 + bob, 18, 4, 2);
  ctx.fill();
  ctx.fillStyle = "#20303f";
  const eyeX = player.facing > 0 ? 1 : -1;
  ctx.beginPath();
  ctx.arc(eyeX - 3.5, -31 + bob, 1.7, 0, Math.PI * 2);
  ctx.arc(eyeX + 3.5, -31 + bob, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff9a45";
  ctx.beginPath();
  ctx.moveTo(player.facing * 7, -27 + bob);
  ctx.lineTo(player.facing * 16, -25 + bob);
  ctx.lineTo(player.facing * 7, -23 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#6b4a33";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, -16 + bob);
  ctx.lineTo(-18, -10 + bob);
  ctx.moveTo(11, -16 + bob);
  ctx.lineTo(18, -10 + bob);
  ctx.stroke();
  if (player.spray) {
    const dir = player.facing;
    const mouthX = dir * 16;
    ctx.save();
    ctx.translate(mouthX, -26 + bob);
    ctx.scale(dir, 1);
    const cone = ctx.createLinearGradient(0, 0, 108, 0);
    cone.addColorStop(0, "rgba(255,255,255,0.8)");
    cone.addColorStop(1, "rgba(200,240,255,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(108, -30);
    ctx.lineTo(108, 26);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 6; i += 1) {
      const px = 12 + ((i * 23 + time * 260) % 90);
      const py = Math.sin(time * 12 + i) * (10 + px * 0.18);
      ctx.beginPath();
      ctx.arc(px, py, 1.6 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawItem(ctx, item, time) {
  ctx.save();
  ctx.translate(item.x, item.y + Math.sin(time * 4) * 2);
  if (item.type === "heart") {
    ctx.fillStyle = "#ff8098";
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6);
    ctx.bezierCurveTo(8, -14, 14, -2, 0, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = "#ffd76a";
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? 10 : 4.5;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawProjectile(ctx, shot) {
  ctx.save();
  ctx.fillStyle = "rgba(160,235,255,0.9)";
  ctx.beginPath();
  ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(shot.x - shot.r * 0.3, shot.y - shot.r * 0.3, shot.r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const time = session.elapsed;
    const shake = world.shake;
    ctx.save();
    if (shake > 0.2) {
      ctx.translate(Math.sin(time * 61) * shake * 0.5, Math.cos(time * 47) * shake * 0.4);
    }
    drawBackground(ctx, session.chapter, time);
    const art = ART[Math.max(0, Math.min(2, session.chapter))] ?? ART[0];
    for (const plat of world.platforms) drawPlatform(ctx, plat, art);
    for (const brick of world.bricks) if (brick.alive) drawBrick(ctx, brick, time);
    for (const item of world.items) drawItem(ctx, item, time);
    for (const shot of world.projectiles) drawProjectile(ctx, shot);
    for (const ball of world.snowballs) drawSnowball(ctx, ball, time);
    for (const enemy of world.enemies) if (enemy.alive) drawEnemy(ctx, enemy, time);
    drawPlayer(ctx, world.player, time);
    for (const particle of world.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, particle.life / particle.max));
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const float of world.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, float.life * 1.4));
      ctx.font = "bold 20px 'Trebuchet MS', 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(8,20,38,0.75)";
      ctx.strokeText(float.text, float.x, float.y);
      ctx.fillStyle = float.color;
      ctx.fillText(float.text, float.x, float.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  return { draw, resize };
}

export const STAGE_WIDTH = W;
export const STAGE_HEIGHT = H;
export { ART };
