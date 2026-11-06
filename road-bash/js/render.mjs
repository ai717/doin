// render.mjs — Canvas 伪 3D 公路舞台。唯一绘制层。
// 透视：镜头在玩家后方，近处路面贴屏幕底部，远处收束到地平线（OutRun / Road Rash）。

import { hillAt, playerOf, RAIL_X } from "./engine.mjs";

export const VW = 960;
export const VH = 540;
export const HORIZON = Math.round(VH * 0.34);
export const CAM_BACK = 7;
export const FOCAL = 2100;
export const DRAW_DIST = 280;
export const SEG = 5;
export const ROAD_HALF = 1.5;
export const ROAD_NEAR_W = 350;

const PALETTES = {
  coast: { sky0: "#ffb15a", sky1: "#ff6b3d", sky2: "#6b3a6a", fog: "rgba(255,140,80,0.22)", grassA: "#2f7a4a", grassB: "#25633c", rumbleA: "#f2d44a", rumbleB: "#c43d3d", roadA: "#3e4248", roadB: "#33363b" },
  desert: { sky0: "#ffd27a", sky1: "#f08a3a", sky2: "#c45c2a", fog: "rgba(255,180,90,0.22)", grassA: "#c9a46a", grassB: "#b0894f", rumbleA: "#e8c07a", rumbleB: "#8b5a2b", roadA: "#4a4540", roadB: "#3a3632" },
  mountain: { sky0: "#f4c6a0", sky1: "#c56b6b", sky2: "#4a3a62", fog: "rgba(160,90,120,0.22)", grassA: "#3d6b4f", grassB: "#2d523c", rumbleA: "#d9d3c4", rumbleB: "#6b4a3a", roadA: "#3e4248", roadB: "#33363b" },
  city: { sky0: "#5a3d7a", sky1: "#2a2048", sky2: "#120e22", fog: "rgba(80,50,140,0.28)", grassA: "#2a2e38", grassB: "#1c2028", rumbleA: "#ff6b9d", rumbleB: "#4de0ff", roadA: "#2c2f38", roadB: "#23262e" },
  canyon: { sky0: "#ff8a4a", sky1: "#c44a2a", sky2: "#4a2038", fog: "rgba(255,90,40,0.22)", grassA: "#8a5a32", grassB: "#6b4024", rumbleA: "#ffd166", rumbleB: "#e24b32", roadA: "#3e4248", roadB: "#33363b" },
};

function pal(track) {
  return PALETTES[track?.palette] || PALETTES.coast;
}

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * 把引擎坐标 (x 车道, z 米, hill 高度) 投到屏幕。
 * 近处 (dz≈CAM_BACK) 落在屏幕底部且路宽约 ROAD_NEAR_W；远处贴近地平线。
 */
export function projectWorld(cam, x, z, hill = 0) {
  const dz = z - cam.z;
  if (dz < 1.25) return null;
  const scale = FOCAL / dz;
  const w = ROAD_NEAR_W * (CAM_BACK / dz);
  const cx = VW / 2 - (cam.x / ROAD_HALF) * w + (cam.sway || 0) * (CAM_BACK / dz);
  return {
    x: cx + (x / ROAD_HALF) * w,
    y: HORIZON + scale - hill * 1.25,
    w,
    scale,
    dz,
  };
}

export function projectSway(z, track) {
  if (!track) return 0;
  return Math.sin(z * (track.curveFreq || 0.003)) * 90 + Math.sin(z * (track.curveFreq || 0.003) * 0.41 + 1.2) * 40;
}

function polygon(ctx, x1, y1, w1, x2, y2, w2, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x2 - w2, y2);
  ctx.closePath();
  ctx.fill();
}

function drawSky(ctx, p, t, reduced, camZ) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 18);
  g.addColorStop(0, p.sky0);
  g.addColorStop(0.45, p.sky1);
  g.addColorStop(1, p.sky2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, HORIZON + 24);
  const sunX = VW * 0.74 + (reduced ? 0 : Math.sin(t * 0.12) * 8);
  const sunY = HORIZON * 0.38;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI - 0.2;
    ctx.strokeStyle = "rgba(255,220,140,0.08)";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX + Math.cos(a) * 340, sunY + Math.sin(a) * 120);
    ctx.stroke();
  }
  ctx.restore();
  const sg = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 110);
  sg.addColorStop(0, "rgba(255,250,210,1)");
  sg.addColorStop(0.28, "rgba(255,190,90,0.55)");
  sg.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,248,230,0.55)";
  for (let i = 0; i < 5; i += 1) {
    const cx = ((camZ * 18 + i * 210) % (VW + 160)) - 80;
    const cy = 28 + (i % 3) * 22;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 54 + (i % 2) * 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHills(ctx, p, camZ, track) {
  ctx.beginPath();
  ctx.moveTo(0, HORIZON + 8);
  for (let i = 0; i <= 18; i += 1) {
    const x = (i / 18) * VW;
    const h = 26 + Math.sin(i * 0.55 + camZ * 0.01) * 18 + Math.min(34, (track.hillAmp || 10) * 0.4);
    ctx.lineTo(x, HORIZON - h);
  }
  ctx.lineTo(VW, HORIZON + 8);
  ctx.closePath();
  ctx.fillStyle = p.sky2;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, HORIZON + 6);
  for (let i = 0; i <= 18; i += 1) {
    const x = (i / 18) * VW;
    const h = 10 + Math.sin(i * 0.9 + camZ * 0.02 + 1.2) * 10;
    ctx.lineTo(x, HORIZON - h);
  }
  ctx.lineTo(VW, HORIZON + 6);
  ctx.closePath();
  ctx.fillStyle = p.grassB;
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function attackPhase(rider) {
  const atk = rider.attack;
  if (!atk) return { punch: 0, kick: 0, club: 0, back: 0, dir: 1, landed: false };
  const span = atk.wind + atk.active;
  let k;
  if (atk.t <= atk.wind) k = atk.t / Math.max(0.001, atk.wind);
  else if (atk.t <= span) k = 1;
  else k = Math.max(0, 1 - (atk.t - span) / Math.max(0.001, atk.recover));
  const dir = atk.dir >= 0 ? 1 : -1;
  if (atk.move === "kick") return { punch: 0, kick: k, club: 0, back: 0, dir, landed: atk.landed };
  if (atk.move === "club") return { punch: 0, kick: 0, club: k, back: 0, dir, landed: atk.landed };
  if (atk.move === "backhand") return { punch: 0, kick: 0, club: 0, back: k, dir, landed: atk.landed };
  return { punch: k, kick: 0, club: 0, back: 0, dir, landed: atk.landed };
}

function fillEllipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Hang-On / Road Rash 后视轮胎：镜头在车后上方，轮胎是扁宽椭圆，看见胎面顶部。
 */
function drawWheel(ctx, x, y, rx, ry, spin) {
  ctx.save();
  ctx.translate(x, y);
  fillEllipse(ctx, 0, ry * 0.5, rx * 1.05, ry * 0.28, "rgba(0,0,0,0.32)");
  fillEllipse(ctx, 0, 0, rx, ry, "#121212");
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = Math.max(1.2, rx * 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.88, ry * 0.82, 0, 0, Math.PI * 2);
  ctx.stroke();
  fillEllipse(ctx, 0, -ry * 0.08, rx * 0.62, ry * 0.4, "#585860");
  ctx.save();
  ctx.rotate(spin * 0.12);
  ctx.strokeStyle = "rgba(220,220,228,0.38)";
  ctx.lineWidth = Math.max(1, rx * 0.04);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rx * 0.08, Math.sin(a) * ry * 0.06);
    ctx.lineTo(Math.cos(a) * rx * 0.54, Math.sin(a) * ry * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  fillEllipse(ctx, 0, -ry * 0.05, rx * 0.15, ry * 0.1, "#1a1a1a");
  fillEllipse(ctx, 0, -ry * 0.05, rx * 0.06, ry * 0.04, "#c9a24a");
  ctx.restore();
}

/**
 * Road Rash / Super Hang-On 后视：骑士后背是主体，车把当“翅膀”，
 * 后轮扁宽贴地。从这个机位几乎看不见前轮，硬画前轮会变成示意图。
 */
function drawClayBike(ctx, p, rider) {
  const s = clamp(p.w * 0.28, 18, 132);
  const pose = attackPhase(rider);
  const lean = rider.vx ? clamp(rider.vx * 0.16, -0.18, 0.18) : 0;
  const bounce = rider.speed > 10 ? Math.sin((rider.z || 0) * 0.4) * s * 0.01 : 0;
  const spin = (rider.z || 0) * 0.9;
  const paint = rider.color.body;
  const jacket = rider.color.suit;
  const helm = rider.color.helm;
  const skin = "#b5794c";
  const side = pose.dir;
  const kick = pose.kick;

  ctx.save();
  ctx.translate(p.x, p.y + bounce);
  ctx.rotate(lean);

  fillEllipse(ctx, 0, s * 0.08, s * 0.62, s * 0.12, "rgba(10,6,4,0.4)");

  drawWheel(ctx, 0, -s * 0.16, s * 0.52, s * 0.24, spin);

  fillEllipse(ctx, -s * 0.4, -s * 0.04, s * 0.09, s * 0.07, "#9aa0aa");
  fillEllipse(ctx, s * 0.4, -s * 0.04, s * 0.09, s * 0.07, "#9aa0aa");
  fillEllipse(ctx, -s * 0.4, -s * 0.04, s * 0.045, s * 0.035, "#1a1a1a");
  fillEllipse(ctx, s * 0.4, -s * 0.04, s * 0.045, s * 0.035, "#1a1a1a");

  ctx.fillStyle = paint;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.34, s * 0.34, s * 0.12, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1e";
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.38, s * 0.26, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  const drawBoot = (bx, by, dir) => {
    fillEllipse(ctx, bx, by, s * 0.13, s * 0.075, "#241810");
    fillEllipse(ctx, bx + dir * s * 0.06, by + s * 0.01, s * 0.09, s * 0.05, "#3a281c");
  };
  const drawLeg = (dir, kicking) => {
    const bootX = kicking ? dir * s * (0.55 + kick * 0.75) : dir * s * 0.36;
    const bootY = kicking ? -s * 0.18 : -s * 0.02;
    const kneeX = kicking ? dir * s * (0.38 + kick * 0.25) : dir * s * 0.3;
    const kneeY = kicking ? -s * 0.32 : -s * 0.34;
    ctx.strokeStyle = "#16161c";
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(dir * s * 0.1, -s * 0.4);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(bootX, bootY);
    ctx.stroke();
    fillEllipse(ctx, kneeX, kneeY, s * 0.075, s * 0.065, jacket);
    drawBoot(bootX, bootY, dir);
  };
  drawLeg(-1, kick > 0.05 && side < 0);
  drawLeg(1, kick > 0.05 && side > 0);

  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(-s * 0.22, -s * 0.42);
  ctx.quadraticCurveTo(0, -s * 0.34, s * 0.22, -s * 0.42);
  ctx.lineTo(s * 0.4, -s * 0.98);
  ctx.quadraticCurveTo(0, -s * 1.12, -s * 0.4, -s * 0.98);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(-s * 0.03, -s * 0.98, s * 0.06, s * 0.5);
  fillEllipse(ctx, -s * 0.13, -s * 0.78, s * 0.09, s * 0.16, "rgba(255,255,255,0.1)");
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, -s * 0.98);
  ctx.quadraticCurveTo(0, -s * 0.9, s * 0.16, -s * 0.98);
  ctx.lineTo(s * 0.12, -s * 1.08);
  ctx.quadraticCurveTo(0, -s * 1.04, -s * 0.12, -s * 1.08);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#2c2c32";
  ctx.lineWidth = Math.max(3, s * 0.065);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-s * 0.56, -s * 1.02);
  ctx.quadraticCurveTo(0, -s * 1.1, s * 0.56, -s * 1.02);
  ctx.stroke();
  fillEllipse(ctx, -s * 0.56, -s * 1.02, s * 0.075, s * 0.05, "#1a1a1a");
  fillEllipse(ctx, s * 0.56, -s * 1.02, s * 0.075, s * 0.05, "#1a1a1a");

  const armToBar = (dir) => {
    ctx.strokeStyle = jacket;
    ctx.lineWidth = s * 0.085;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(dir * s * 0.26, -s * 0.82);
    ctx.quadraticCurveTo(dir * s * 0.42, -s * 0.9, dir * s * 0.52, -s * 1.0);
    ctx.stroke();
    fillEllipse(ctx, dir * s * 0.53, -s * 1.01, s * 0.065, s * 0.048, "#2a2a2a");
  };

  if (pose.punch > 0.04) {
    armToBar(-side);
    ctx.save();
    ctx.translate(side * s * 0.28, -s * 0.8);
    ctx.rotate(-side * (0.08 - pose.punch * 1.15));
    ctx.strokeStyle = jacket;
    ctx.lineWidth = s * 0.09;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(side * s * (0.12 + pose.punch * 0.68), 0);
    ctx.stroke();
    fillEllipse(ctx, side * s * (0.2 + pose.punch * 0.7), 0, s * 0.075, s * 0.065, skin);
    fillEllipse(ctx, side * s * (0.22 + pose.punch * 0.72), s * 0.01, s * 0.065, s * 0.048, "#2a2a2a");
    if (pose.landed) fillEllipse(ctx, side * s * 1.0, 0, s * 0.14, s * 0.14, "rgba(255,200,90,0.55)");
    ctx.restore();
  } else if (pose.back > 0.04) {
    armToBar(-side);
    ctx.save();
    ctx.translate(0, -s * 0.82);
    ctx.rotate(side * (-0.8 + pose.back * 1.55));
    ctx.strokeStyle = jacket;
    ctx.lineWidth = s * 0.09;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.72, 0);
    ctx.stroke();
    fillEllipse(ctx, s * 0.76, 0, s * 0.075, s * 0.065, skin);
    ctx.restore();
  } else if (pose.club > 0.04) {
    armToBar(-side);
    ctx.save();
    ctx.translate(side * s * 0.2, -s * 0.88);
    ctx.rotate(-side * (1.05 - pose.club * 1.65));
    ctx.strokeStyle = jacket;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.36, 0);
    ctx.stroke();
    ctx.fillStyle = "#5a2e8a";
    roundRect(ctx, s * 0.28, -s * 0.09, s * 0.52, s * 0.14, s * 0.045);
    ctx.fill();
    ctx.restore();
  } else {
    armToBar(-1);
    armToBar(1);
    if (rider.weapon === "club") {
      ctx.save();
      ctx.translate(s * 0.38, -s * 0.92);
      ctx.rotate(-0.45);
      ctx.fillStyle = "#5a2e8a";
      roundRect(ctx, 0, -s * 0.045, s * 0.38, s * 0.1, s * 0.04);
      ctx.fill();
      ctx.restore();
    }
  }

  fillEllipse(ctx, 0, -s * 1.06, s * 0.09, s * 0.07, skin);
  fillEllipse(ctx, 0, -s * 1.2, s * 0.24, s * 0.22, helm);
  fillEllipse(ctx, 0, -s * 1.26, s * 0.18, s * 0.11, helm);
  fillEllipse(ctx, 0, -s * 1.14, s * 0.18, s * 0.1, "rgba(8,8,10,0.32)");
  ctx.fillStyle = "rgba(20,35,60,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, -s * 1.1, s * 0.16, s * 0.055, 0, 0.15, Math.PI - 0.15);
  ctx.fill();
  if (rider.kind === "cop") {
    ctx.fillStyle = "#4de0ff";
    ctx.fillRect(-s * 0.09, -s * 1.4, s * 0.09, s * 0.06);
    ctx.fillStyle = "#ff4d6d";
    ctx.fillRect(0, -s * 1.4, s * 0.09, s * 0.06);
  }

  if (kick > 0.35) {
    ctx.strokeStyle = "rgba(255,230,180,0.32)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -s * 0.12, s * (0.48 + kick * 0.35), -side * 0.12, -side * 0.95, side < 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRagdoll(ctx, p, rider) {
  const s = clamp(p.w * 0.2, 8, 64);
  ctx.save();
  ctx.translate(p.x, p.y - s);
  ctx.rotate((rider.fly?.t || 0) * 7.2);
  ctx.strokeStyle = rider.color.suit;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-s * 0.35, s * 0.35);
  ctx.lineTo(0, 0);
  ctx.lineTo(s * 0.4, s * 0.25);
  ctx.moveTo(-s * 0.3, -s * 0.15);
  ctx.lineTo(s * 0.35, s * 0.05);
  ctx.stroke();
  ctx.fillStyle = rider.color.suit;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.22, s * 0.38, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c48a62";
  ctx.beginPath();
  ctx.arc(s * 0.08, -s * 0.55, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rider.color.helm;
  ctx.beginPath();
  ctx.ellipse(s * 0.1, -s * 0.68, s * 0.2, s * 0.22, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCar(ctx, p, car) {
  const s = clamp(p.w * 0.28, 12, 110);
  const truck = car.kind === "truck";
  const body = truck ? "#c9a227" : car.dir < 0 ? "#e8eef6" : "#4f9ad4";
  ctx.save();
  ctx.translate(p.x, p.y);
  fillEllipse(ctx, 0, s * 0.12, s * 1.05, s * 0.16, "rgba(12,6,4,0.32)");
  fillEllipse(ctx, -s * 0.62, s * 0.02, s * 0.22, s * 0.12, "#1a1a1a");
  fillEllipse(ctx, s * 0.62, s * 0.02, s * 0.22, s * 0.12, "#1a1a1a");
  ctx.fillStyle = body;
  roundRect(ctx, -s * (truck ? 0.95 : 0.78), -s * (truck ? 0.72 : 0.48), s * (truck ? 1.9 : 1.56), s * (truck ? 0.78 : 0.52), s * 0.1);
  ctx.fill();
  ctx.fillStyle = "rgba(30,50,80,0.55)";
  roundRect(ctx, -s * 0.42, -s * (truck ? 0.92 : 0.7), s * 0.84, s * 0.24, s * 0.05);
  ctx.fill();
  ctx.fillStyle = "#c43d3d";
  roundRect(ctx, -s * 0.7, -s * 0.12, s * 0.18, s * 0.08, 3);
  ctx.fill();
  roundRect(ctx, s * 0.52, -s * 0.12, s * 0.18, s * 0.08, 3);
  ctx.fill();
  ctx.fillStyle = "#f4e4b0";
  ctx.fillRect(-s * 0.16, -s * 0.08, s * 0.08, s * 0.05);
  ctx.fillRect(s * 0.08, -s * 0.08, s * 0.08, s * 0.05);
  ctx.restore();
}

function roadsideSprites(camZ, palette) {
  const items = [];
  const start = Math.floor(camZ / 14) * 14 + 14;
  const kinds = palette === "desert" ? ["cactus", "rock", "cactus"] : palette === "city" ? ["lamp", "sign", "palm"] : palette === "canyon" ? ["rock", "rock", "cactus"] : ["palm", "palm", "sign"];
  for (let z = start; z < camZ + DRAW_DIST; z += 14) {
    const side = ((Math.floor(z / 14) % 2) * 2 - 1);
    const kind = kinds[Math.abs(Math.floor(z / 14)) % kinds.length];
    items.push({ kind, x: side * (RAIL_X + 0.32), z, shade: (Math.floor(z / 14) % 3) / 3 });
  }
  const cowEvery = 380;
  const cowZ = Math.round(camZ / cowEvery) * cowEvery + 90;
  if (cowZ > camZ + 12 && cowZ < camZ + DRAW_DIST) {
    items.push({ kind: "cow", x: 1.68, z: cowZ, shade: 0 });
  }
  return items;
}

function drawPalm(ctx, p, shade) {
  const s = clamp(p.w * 0.14, 5, 64);
  ctx.fillStyle = `rgba(90,55,30,${0.7 + shade * 0.2})`;
  ctx.fillRect(p.x - s * 0.08, p.y - s * 2.2, s * 0.16, s * 2.2);
  ctx.fillStyle = `rgba(46,140,78,${0.75 + shade * 0.2})`;
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i - 2) * 0.5;
    ctx.beginPath();
    ctx.ellipse(p.x + Math.cos(a) * s * 0.7, p.y - s * 2.3 + Math.sin(a) * s * 0.2, s * 0.55, s * 0.18, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCactus(ctx, p) {
  const s = clamp(p.w * 0.14, 5, 52);
  ctx.fillStyle = "#2f7a4a";
  ctx.fillRect(p.x - s * 0.1, p.y - s * 2.1, s * 0.2, s * 2.1);
  ctx.fillRect(p.x - s * 0.55, p.y - s * 1.4, s * 0.5, s * 0.16);
  ctx.fillRect(p.x + s * 0.05, p.y - s * 1.7, s * 0.45, s * 0.16);
}

function drawRock(ctx, p) {
  const s = clamp(p.w * 0.16, 6, 40);
  ctx.fillStyle = "#6b5a4a";
  ctx.beginPath();
  ctx.moveTo(p.x - s, p.y);
  ctx.lineTo(p.x - s * 0.3, p.y - s * 0.9);
  ctx.lineTo(p.x + s * 0.6, p.y - s * 0.55);
  ctx.lineTo(p.x + s, p.y);
  ctx.closePath();
  ctx.fill();
}

function drawLamp(ctx, p) {
  const s = clamp(p.w * 0.14, 5, 56);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(p.x - s * 0.05, p.y - s * 2.4, s * 0.1, s * 2.4);
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 2.45, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawSign(ctx, p) {
  const s = clamp(p.w * 0.13, 5, 44);
  ctx.fillStyle = "#4a4a4a";
  ctx.fillRect(p.x - s * 0.05, p.y - s * 1.6, s * 0.1, s * 1.6);
  ctx.fillStyle = "#2f9e6a";
  roundRect(ctx, p.x - s * 0.45, p.y - s * 2.05, s * 0.9, s * 0.5, s * 0.08);
  ctx.fill();
}

function drawProp(ctx, pr, item) {
  if (item.kind === "cow") drawCow(ctx, pr);
  else if (item.kind === "cactus") drawCactus(ctx, pr);
  else if (item.kind === "rock") drawRock(ctx, pr);
  else if (item.kind === "lamp") drawLamp(ctx, pr);
  else if (item.kind === "sign") drawSign(ctx, pr);
  else drawPalm(ctx, pr, item.shade);
}

function drawCow(ctx, p) {
  const s = clamp(p.w * 0.18, 6, 48);
  ctx.fillStyle = "#f4efe6";
  roundRect(ctx, p.x - s * 0.7, p.y - s * 0.7, s * 1.4, s * 0.7, s * 0.25);
  ctx.fill();
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(p.x - s * 0.2, p.y - s * 0.45, s * 0.16, 0, Math.PI * 2);
  ctx.arc(p.x + s * 0.35, p.y - s * 0.35, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4efe6";
  ctx.beginPath();
  ctx.arc(p.x + s * 0.7, p.y - s * 0.85, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function segmentAt(cam, z, track) {
  const hill = hillAt(z, track);
  const sway = projectSway(z, track);
  const pr = projectWorld({ ...cam, sway }, 0, z, hill);
  return pr ? { z, pr, odd: Math.floor(z / SEG) % 2 === 0 } : null;
}

export function createRenderer(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext("2d");
  let idleZ = 12;
  let bits = [];
  let lastT = 0;

  function burst(x, y, n, color, spread = 40) {
    for (let i = 0; i < n; i += 1) {
      bits.push({
        x,
        y,
        vx: (Math.random() - 0.5) * spread,
        vy: -Math.random() * spread * 0.7,
        life: 0.25 + Math.random() * 0.35,
        max: 0.5,
        color,
        size: 2 + Math.random() * 4,
      });
    }
    if (bits.length > 220) bits = bits.slice(bits.length - 220);
  }

  function fit() {
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const cssW = canvas.clientWidth || VW;
    const cssH = canvas.clientHeight || VH;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function draw(race, opts = {}) {
    fit();
    const reduced = opts.reducedMotion ?? reducedMotion;
    const t = opts.time || 0;
    ctx.setTransform(canvas.width / VW, 0, 0, canvas.height / VH, 0, 0);
    const track = race?.spec?.track || { palette: "coast", hillAmp: 16, hillFreq: 0.0026, curveFreq: 0.003 };
    const p = pal(track);
    const player = race ? playerOf(race) : null;
    if (!race) idleZ += reduced ? 0 : 0.42;
    const camZ = player ? player.z - CAM_BACK : idleZ;
    const shake = reduced ? 0 : (race?.fx?.shake || 0) * 6;
    const cam = {
      z: camZ,
      x: (player ? player.x * 0.72 : 0) + (shake ? Math.sin(t * 48) * shake * 0.02 : 0),
    };

    const dtFx = lastT ? Math.min(0.05, t - lastT) : 0.016;
    lastT = t;
    drawSky(ctx, p, t, reduced, cam.z);
    drawHills(ctx, p, cam.z, track);
    ctx.fillStyle = p.grassB;
    ctx.fillRect(0, HORIZON, VW, VH - HORIZON);

    const segments = [];
    const startZ = Math.floor(cam.z / SEG) * SEG + SEG;
    for (let z = startZ; z < cam.z + DRAW_DIST; z += SEG) {
      const seg = segmentAt(cam, z, track);
      if (seg) segments.push(seg);
    }

    for (let i = segments.length - 2; i >= 0; i -= 1) {
      const a = segments[i];
      const b = segments[i + 1];
      if (b.pr.y >= a.pr.y - 0.5) continue;
      if (a.pr.y > VH + 8 && b.pr.y > VH + 8) continue;
      polygon(ctx, VW / 2, a.pr.y, VW, VW / 2, b.pr.y, VW, a.odd ? p.grassA : p.grassB);
      polygon(ctx, a.pr.x, a.pr.y, a.pr.w * 1.16, b.pr.x, b.pr.y, b.pr.w * 1.16, a.odd ? p.rumbleA : p.rumbleB);
      polygon(ctx, a.pr.x, a.pr.y, a.pr.w, b.pr.x, b.pr.y, b.pr.w, a.odd ? p.roadA : p.roadB);
      if (a.odd) polygon(ctx, a.pr.x, a.pr.y, a.pr.w * 0.022, b.pr.x, b.pr.y, b.pr.w * 0.022, "#f4e4b0");
      if (!a.odd) {
        polygon(ctx, a.pr.x - a.pr.w * 0.33, a.pr.y, a.pr.w * 0.018, b.pr.x - b.pr.w * 0.33, b.pr.y, b.pr.w * 0.018, "rgba(244,228,176,0.55)");
        polygon(ctx, a.pr.x + a.pr.w * 0.33, a.pr.y, a.pr.w * 0.018, b.pr.x + b.pr.w * 0.33, b.pr.y, b.pr.w * 0.018, "rgba(244,228,176,0.55)");
      }
    }

    const fog = ctx.createLinearGradient(0, HORIZON - 10, 0, HORIZON + 70);
    fog.addColorStop(0, p.fog);
    fog.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, HORIZON - 12, VW, 80);

    const sprites = [];
    const pushSprite = (z, pr, drawFn) => {
      if (!pr || pr.y < HORIZON - 8 || pr.y > VH + 40) return;
      sprites.push({ z, draw: drawFn });
    };

    for (const item of roadsideSprites(cam.z, track.palette)) {
      const hill = hillAt(item.z, track);
      const pr = projectWorld({ ...cam, sway: projectSway(item.z, track) }, item.x, item.z, hill);
      if (!pr) continue;
      pushSprite(item.z, pr, () => drawProp(ctx, pr, item));
    }

    if (race) {
      const finishZ = race.spec.length;
      if (finishZ > cam.z && finishZ < cam.z + DRAW_DIST) {
        const pr = projectWorld({ ...cam, sway: projectSway(finishZ, track) }, 0, finishZ, hillAt(finishZ, track));
        if (pr) {
          pushSprite(finishZ, pr, () => {
            ctx.fillStyle = "rgba(255, 246, 210, 0.85)";
            ctx.fillRect(pr.x - pr.w, pr.y - 6, pr.w * 2, 8);
            ctx.fillStyle = "#e24b32";
            ctx.fillRect(pr.x - pr.w * 0.2, pr.y - pr.w * 0.5, 5, pr.w * 0.5);
          });
        }
      }
      for (const car of race.cars) {
        const pr = projectWorld({ ...cam, sway: projectSway(car.z, track) }, car.x, car.z, hillAt(car.z, track));
        pushSprite(car.z, pr, () => drawCar(ctx, pr, car));
      }
      for (const rider of race.riders) {
        if (rider.wrecked && !rider.fly) continue;
        const rx = rider.x;
        const rz = rider.z;
        const pr = projectWorld({ ...cam, sway: projectSway(rz, track) }, rx, rz, hillAt(rz, track));
        if (rider.fly) {
          pushSprite(rz, pr, () => drawRagdoll(ctx, pr, rider));
          if (!reduced && pr && rider.fly.t < 0.12) burst(pr.x, pr.y, 6, "#ffb15a", 80);
          continue;
        }
        if (rider.mounted) {
          pushSprite(rz, pr, () => drawClayBike(ctx, pr, rider));
          const pose = attackPhase(rider);
          if (!reduced && pose.landed && pose.punch + pose.kick + pose.club + pose.back > 0.7 && pr) {
            burst(pr.x + pose.dir * 28, pr.y - 36, 7, pose.kick ? "#ffe8a0" : "#ffb15a", pose.kick ? 70 : 50);
          }
          if (!reduced && player && rider.id === 0 && rider.speed > 10 && Math.random() < 0.4) {
            burst(pr.x, pr.y + 6, 1, "rgba(180,150,120,0.5)", 18);
          }
          continue;
        }
        const bikeP = projectWorld({ ...cam, sway: projectSway(rider.bikeZ, track) }, rider.bikeX, rider.bikeZ, hillAt(rider.bikeZ, track));
        pushSprite(rider.bikeZ, bikeP, () => drawClayBike(ctx, bikeP, { ...rider, attack: null, vx: 0 }));
        pushSprite(rz, pr, () => {
          ctx.fillStyle = rider.color.suit;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y - 10, Math.max(5, pr.w * 0.08), 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    sprites.sort((a, b) => b.z - a.z);
    for (const s of sprites) s.draw();

    if (!reduced && player && player.speed > 14) {
      const ratio = Math.min(1, player.speed / player.bike.maxSpeed);
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + ratio * 0.12})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i += 1) {
        const x = ((t * 900 + i * 97) % VW);
        const y0 = HORIZON + 40 + ((i * 53) % (VH - HORIZON - 50));
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 + 18 + ratio * 26);
        ctx.stroke();
      }
    }

    if (!reduced) {
      const next = [];
      for (const b of bits) {
        b.life -= dtFx;
        if (b.life <= 0) continue;
        b.x += b.vx * dtFx;
        b.y += b.vy * dtFx;
        b.vy += 80 * dtFx;
        const a = b.life / (b.max || 0.5);
        ctx.fillStyle = b.color;
        ctx.globalAlpha = Math.max(0, a);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size * a, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        next.push(b);
      }
      bits = next;
    } else {
      bits = [];
    }

    if (race?.fx?.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.35, race.fx.flash)})`;
      ctx.fillRect(0, 0, VW, VH);
    }

    if (race?.status === "countdown") {
      const n = Math.ceil(race.countdown);
      ctx.fillStyle = "rgba(20,8,4,0.28)";
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = "#fff3d6";
      ctx.font = "800 92px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n <= 0 ? "GO" : String(n), VW / 2, VH * 0.46);
    }

    ctx.strokeStyle = "rgba(255,210,160,0.18)";
    ctx.lineWidth = 10;
    roundRect(ctx, 8, 8, VW - 16, VH - 16, 28);
    ctx.stroke();

    if (!reduced) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let y = 0; y < VH; y += 4) ctx.fillRect(0, y, VW, 1);
    }
  }

  return {
    draw,
    setReduced(v) {
      reducedMotion = !!v;
    },
  };
}
