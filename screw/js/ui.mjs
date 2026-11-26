/**
 * @file games/screw/js/ui.mjs
 * Canvas 2D 微缩五金工坊渲染与命中测试层。
 * 板材、螺栓、收纳盒、备用孔全部程序化绘制，零外部图片。
 */

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID,
  CELL,
  BOARD_X,
  BOARD_Y,
  BOARD_SIZE,
  BOX_SLOT_W,
  BOX_SLOT_H,
  BOX_GAP,
  BOX_Y,
  BUFFER_Y,
  SCREW_COLORS,
  SCREW_LIGHT,
  SCREW_DARK,
} from './layout.mjs';
import { swingTargetAngle, createPlateFall, stepPlateFall, createScrewFlight, stepScrewFlight } from './anim.mjs';
import { t } from './i18n.mjs';
import { plateStatus, remainingScrewsOnPlate, isScrewAccessible, activeBox } from './engine.mjs';

export { CANVAS_WIDTH, CANVAS_HEIGHT };

const TAU = Math.PI * 2;

function cellCenter(cell) {
  return {
    x: BOARD_X + (cell.c + 0.5) * CELL,
    y: BOARD_Y + (cell.r + 0.5) * CELL,
  };
}

function cellRect(cell) {
  return {
    x: BOARD_X + cell.c * CELL,
    y: BOARD_Y + cell.r * CELL,
    w: CELL,
    h: CELL,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function edgeKey(ax, ay, bx, by) {
  const a = `${ax},${ay}`;
  const b = `${bx},${by}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** 由正交格子集合生成带孔洞的 Path2D 轮廓 */
function buildOutlinePath(cells, cellPx, originX, originY) {
  const edgeMap = new Map();
  const addEdge = (ax, ay, bx, by) => {
    const key = edgeKey(ax, ay, bx, by);
    if (edgeMap.has(key)) edgeMap.delete(key);
    else edgeMap.set(key, [ax, ay, bx, by]);
  };

  for (const cell of cells) {
    const x = cell.c;
    const y = cell.r;
    addEdge(x, y, x + 1, y);
    addEdge(x + 1, y, x + 1, y + 1);
    addEdge(x + 1, y + 1, x, y + 1);
    addEdge(x, y + 1, x, y);
  }

  const adjacency = new Map();
  for (const [ax, ay, bx, by] of edgeMap.values()) {
    const a = `${ax},${ay}`;
    const b = `${bx},${by}`;
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a).push([bx, by]);
    adjacency.get(b).push([ax, ay]);
  }

  const used = new Set();
  const loops = [];
  for (const [key, [ax, ay, bx, by]] of edgeMap) {
    if (used.has(key)) continue;
    used.add(key);
    const loop = [[ax, ay]];
    let nx = bx;
    let ny = by;
    let guard = 0;
    while (!(nx === ax && ny === ay) && guard < 1000) {
      guard += 1;
      loop.push([nx, ny]);
      const neighbors = adjacency.get(`${nx},${ny}`) || [];
      let picked = null;
      for (const [mx, my] of neighbors) {
        const candidate = edgeKey(nx, ny, mx, my);
        if (!used.has(candidate)) {
          picked = [mx, my, candidate];
          break;
        }
      }
      if (!picked) break;
      used.add(picked[2]);
      nx = picked[0];
      ny = picked[1];
    }
    if (loop.length > 2) loops.push(loop);
  }

  const path = new Path2D();
  for (const loop of loops) {
    loop.forEach(([x, y], index) => {
      const px = originX + x * cellPx;
      const py = originY + y * cellPx;
      if (index === 0) path.moveTo(px, py);
      else path.lineTo(px, py);
    });
    path.closePath();
  }
  return path;
}

function plateBounds(cells) {
  let minC = Infinity;
  let minR = Infinity;
  let maxC = -Infinity;
  let maxR = -Infinity;
  for (const cell of cells) {
    minC = Math.min(minC, cell.c);
    minR = Math.min(minR, cell.r);
    maxC = Math.max(maxC, cell.c + 1);
    maxR = Math.max(maxR, cell.r + 1);
  }
  return {
    x: BOARD_X + minC * CELL,
    y: BOARD_Y + minR * CELL,
    w: (maxC - minC) * CELL,
    h: (maxR - minR) * CELL,
  };
}

function plateCentroid(cells) {
  let c = 0;
  let r = 0;
  for (const cell of cells) {
    c += cell.c + 0.5;
    r += cell.r + 0.5;
  }
  return { c: c / cells.length, r: r / cells.length };
}

const ACRYLIC_TINTS = [
  ['#9ff5dd', '#2fb99a'],
  ['#ffc2dd', '#e85d9e'],
  ['#b6d7ff', '#4d8be8'],
  ['#e0c7ff', '#8e63d8'],
  ['#ffd7b0', '#e08a45'],
];

const NEON_TINTS = ['#36f0c8', '#ff5fd2', '#7ea6ff', '#ffd166', '#b18cff'];

export class ScrewRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.swing = new Map();
    this.falls = [];
    this.flights = [];
    this.particles = [];
    this.confetti = [];
    this.motes = [];
    this.shake = 0;
    this.boxPulse = 0;
    this.winGlow = 0;
    this.magnetArmed = false;
    this.lastLevelId = null;
    this.time = 0;
    this.reducedMotion = Boolean(
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    for (let i = 0; i < 26; i += 1) {
      this.motes.push({
        x: (i * 137.5) % CANVAS_WIDTH,
        y: (i * 241.7) % CANVAS_HEIGHT,
        r: 0.7 + ((i * 7) % 5) * 0.35,
        speed: 2 + ((i * 11) % 9),
        alpha: 0.08 + ((i * 13) % 7) * 0.012,
      });
    }
  }

  setMagnetArmed(armed) {
    this.magnetArmed = Boolean(armed);
  }

  resetForLevel() {
    this.swing.clear();
    this.falls = [];
    this.flights = [];
    this.particles = [];
    this.confetti = [];
    this.shake = 0;
    this.boxPulse = 0;
    this.winGlow = 0;
  }

  triggerDeny(screwId) {
    this.shake = Math.max(this.shake, 4);
    this.spawnParticles(cellCenterFromId(this.lastGame, screwId), '#ff7b7b', 6, 90, 0.4);
  }

  triggerWin() {
    this.winGlow = 1;
    if (this.reducedMotion) return;
    for (let i = 0; i < 90; i += 1) {
      this.confetti.push({
        x: CANVAS_WIDTH * (0.2 + Math.random() * 0.6),
        y: CANVAS_HEIGHT * (0.18 + Math.random() * 0.2),
        vx: (Math.random() - 0.5) * 260,
        vy: -80 - Math.random() * 180,
        size: 5 + Math.random() * 8,
        color: Object.values(SCREW_COLORS)[i % Object.values(SCREW_COLORS).length],
        angle: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 8,
        life: 0,
        maxLife: 2.2 + Math.random(),
      });
    }
  }

  triggerLose() {
    this.shake = Math.max(this.shake, 9);
  }

  handleEvent(event, game) {
    if (!game) return;
    this.lastGame = game;
    const state = game.getState();
    const level = game.getLevel();
    if (!state || !level) return;

    if (event.type === 'plate_swing') {
      const pivot = cellCenter(event.pivot);
      const target = swingTargetAngle(event.centroid, event.pivot);
      this.swing.set(event.plateId, {
        angle: this.reducedMotion ? target : 0,
        target,
        velocity: 0,
        pivotX: pivot.x,
        pivotY: pivot.y,
      });
      this.spawnParticles({ x: pivot.x, y: pivot.y }, '#d9c7a3', 8, 50, 0.5);
    } else if (event.type === 'plate_fall') {
      const swing = this.swing.get(event.plateId);
      const angle = this.reducedMotion ? 0 : (swing ? swing.angle : 0);
      const fall = createPlateFall(event, angle);
      if (this.reducedMotion) fall.angularVelocity = 0;
      this.falls.push(fall);
      this.swing.delete(event.plateId);
      const bounds = plateBounds(event.cells);
      this.spawnParticles({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }, '#c9a06a', 16, 130, 0.8);
    } else if (event.type === 'screw_boxed') {
      const screw = state.screws.find((item) => item.id === event.screwId);
      if (screw) {
        const from = cellCenter(screw.cell);
        const to = this.boxSlotPosition(event.boxIndex, event.slot, state);
        this.sendScrew(from, to, screw.color);
      }
    } else if (event.type === 'screw_buffered') {
      const screw = state.screws.find((item) => item.id === event.screwId);
      if (screw) {
        const from = cellCenter(screw.cell);
        const to = this.bufferSlotPosition(event.bufferIndex, state);
        this.sendScrew(from, to, screw.color);
      }
    } else if (event.type === 'buffer_inflow') {
      const screw = state.screws.find((item) => item.id === event.screwId);
      if (screw) {
        const from = this.bufferSlotPosition(event.bufferIndex || 0, state);
        const to = this.boxSlotPosition(event.boxIndex, event.slot, state);
        this.sendScrew(from, to, screw.color);
      }
    } else if (event.type === 'box_complete') {
      this.boxPulse = 1;
      this.spawnParticles({ x: this.boxSlotRect(event.boxIndex, state).x + BOX_SLOT_W / 2, y: BOX_Y + 40 }, event.color, 14, 110, 0.7);
    } else if (event.type === 'magnet_used') {
      this.shake = Math.max(this.shake, 5);
    }
  }

  boxSlotRect(boxIndex, state) {
    const active = state ? state.activeBox : 0;
    const slot = clamp(boxIndex - active, 0, 2);
    const total = 3 * BOX_SLOT_W + 2 * BOX_GAP;
    const startX = (CANVAS_WIDTH - total) / 2;
    return { x: startX + slot * (BOX_SLOT_W + BOX_GAP), y: BOX_Y, w: BOX_SLOT_W, h: BOX_SLOT_H };
  }

  boxSlotPosition(boxIndex, slot, state) {
    const rect = this.boxSlotRect(boxIndex, state);
    const slotW = rect.w / 4.4;
    const startX = rect.x + rect.w * 0.38;
    return {
      x: startX + clamp(slot || 0, 0, 2) * slotW,
      y: rect.y + rect.h * 0.66,
    };
  }

  sendScrew(from, to, color) {
    if (this.reducedMotion) {
      this.spawnParticles(to, SCREW_COLORS[color] || '#ffffff', 5, 40, 0.28);
      return;
    }
    this.flights.push(createScrewFlight({ from, to, color }));
  }

  bufferSlotPosition(index, state) {
    const capacity = Math.max(3, state ? Math.max(state.bufferCapacity, state.buffer.length) : 3);
    const totalW = capacity * 82;
    const startX = (CANVAS_WIDTH - totalW) / 2 + 41;
    const i = clamp(index, 0, capacity - 1);
    return { x: startX + i * 82, y: BUFFER_Y + 58 };
  }

  spawnParticles(point, color, count, speed, life) {
    if (!point) return;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const velocity = speed * (0.25 + Math.random() * 0.75);
      this.particles.push({
        x: point.x,
        y: point.y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - speed * 0.3,
        size: 2 + Math.random() * 4,
        color,
        life: 0,
        maxLife: life * (0.6 + Math.random() * 0.6),
        gravity: 240,
      });
    }
  }

  update(dt) {
    const step = clamp(dt, 0, 0.05);
    this.time += step;
    this.shake = Math.max(0, this.shake - step * 26);
    this.boxPulse = Math.max(0, this.boxPulse - step * 2.2);
    this.winGlow = Math.max(0, this.winGlow - step * 0.6);

    for (const mote of this.motes) {
      mote.y -= mote.speed * step;
      if (mote.y < -10) mote.y = CANVAS_HEIGHT + 10;
    }

    for (const [plateId, swing] of this.swing) {
      const stiffness = 95;
      const damping = 13;
      swing.velocity += (swing.target - swing.angle) * stiffness * step;
      swing.velocity *= Math.exp(-damping * step);
      swing.angle += swing.velocity * step;
      if (Math.abs(swing.velocity) < 0.002 && Math.abs(swing.target - swing.angle) < 0.002) {
        swing.angle = swing.target;
        swing.velocity = 0;
      }
      this.swing.set(plateId, swing);
    }

    this.falls = this.falls.map((fall) => stepPlateFall(fall, step)).filter((fall) => !fall.done);
    this.flights = this.flights
      .map((flight) => stepScrewFlight(flight, step))
      .filter((flight) => !flight.done);

    this.particles = this.particles
      .map((particle) => {
        const life = particle.life + step;
        return {
          ...particle,
          life,
          x: particle.x + particle.vx * step,
          y: particle.y + particle.vy * step,
          vy: particle.vy + particle.gravity * step,
          vx: particle.vx * (1 - step * 1.6),
        };
      })
      .filter((particle) => particle.life < particle.maxLife);

    this.confetti = this.confetti
      .map((piece) => ({
        ...piece,
        life: piece.life + step,
        x: piece.x + piece.vx * step,
        y: piece.y + piece.vy * step,
        vy: piece.vy + 420 * step,
        angle: piece.angle + piece.spin * step,
      }))
      .filter((piece) => piece.life < piece.maxLife && piece.y < CANVAS_HEIGHT + 60);
  }

  hitTest(clientX, clientY, game) {
    if (!game) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    const state = game.getState();
    if (!state) return null;

    let best = null;
    let bestDistance = Infinity;
    for (const screw of state.screws) {
      if (screw.state !== 'board') continue;
      const pos = cellCenter(screw.cell);
      const distance = Math.hypot(x - pos.x, y - pos.y);
      if (distance <= 28 && distance < bestDistance) {
        bestDistance = distance;
        best = screw;
      }
    }
    if (!best) return null;
    return {
      screw: best,
      x,
      y,
      accessible: isScrewAccessible(state, best.id),
    };
  }

  syncPlateStates(game) {
    const state = game.getState();
    if (!state) return;
    for (const plate of state.plates) {
      const remaining = remainingScrewsOnPlate(state, plate.id);
      if (remaining === 1) {
        if (!this.swing.has(plate.id)) {
          const pivotScrew = state.screws.find((screw) => screw.plateId === plate.id && screw.state === 'board');
          if (pivotScrew) {
            const pivot = cellCenter(pivotScrew.cell);
            const centroid = plateCentroid(plate.cells);
            const target = swingTargetAngle(centroid, pivotScrew.cell);
            this.swing.set(plate.id, {
              angle: target,
              target,
              velocity: 0,
              pivotX: pivot.x,
              pivotY: pivot.y,
            });
          }
        }
      } else if (remaining >= 2 && this.swing.has(plate.id)) {
        this.swing.delete(plate.id);
      }
    }
  }

  render(game) {
    const ctx = this.ctx;
    const state = game.getState();
    const level = game.getLevel();
    if (!state || !level) return;

    this.lastGame = game;
    this.syncPlateStates(game);

    ctx.save();
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.drawBackground(ctx);

    if (this.shake > 0.2) {
      const sx = Math.sin(this.time * 63) * this.shake;
      const sy = Math.cos(this.time * 71) * this.shake;
      ctx.translate(sx, sy);
    }

    this.drawTopBoxes(ctx, state, game);
    this.drawPegboard(ctx);

    const sortedPlates = [...state.plates].sort((a, b) => a.layer - b.layer);
    for (const plate of sortedPlates) {
      const remaining = remainingScrewsOnPlate(state, plate.id);
      if (remaining <= 0) continue;
      this.drawPlate(ctx, plate, state);
    }

    for (const screw of state.screws) {
      if (screw.state !== 'board') continue;
      this.drawBoardScrew(ctx, screw, state);
    }

    for (const fall of this.falls) this.drawFallingPlate(ctx, fall);
    for (const flight of this.flights) this.drawFlight(ctx, flight);

    this.drawBuffer(ctx, state);
    this.drawParticles(ctx);
    this.drawConfetti(ctx);

    if (this.winGlow > 0) {
      const glow = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 60, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 620);
      glow.addColorStop(0, `rgba(255,235,180,${0.26 * this.winGlow})`);
      glow.addColorStop(1, 'rgba(255,235,180,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    this.drawVignette(ctx);
    ctx.restore();
  }

  drawBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#232a31');
    gradient.addColorStop(0.45, '#181d23');
    gradient.addColorStop(1, '#0e1115');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const light = ctx.createRadialGradient(CANVAS_WIDTH / 2, 80, 40, CANVAS_WIDTH / 2, 80, 760);
    light.addColorStop(0, 'rgba(255,214,150,0.16)');
    light.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    for (let i = 0; i < 5; i += 1) {
      ctx.strokeStyle = `rgba(255,255,255,${0.012 + i * 0.004})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const y = 160 + i * 190;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(220, y - 22, 680, y + 26, CANVAS_WIDTH, y - 8);
      ctx.stroke();
    }
    ctx.restore();

    for (const mote of this.motes) {
      ctx.fillStyle = `rgba(255,228,180,${mote.alpha})`;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.r, 0, TAU);
      ctx.fill();
    }
  }

  drawTopBoxes(ctx, state, game) {
    const shelfX = 92;
    const shelfY = 10;
    const shelfW = CANVAS_WIDTH - 184;
    const shelfH = 130;

    ctx.save();
    const shelfGradient = ctx.createLinearGradient(0, shelfY, 0, shelfY + shelfH);
    shelfGradient.addColorStop(0, '#3a2c20');
    shelfGradient.addColorStop(1, '#1d1610');
    ctx.fillStyle = shelfGradient;
    roundedRect(ctx, shelfX, shelfY, shelfW, shelfH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,184,116,0.32)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shelfX + 18, shelfY + shelfH - 14);
    ctx.lineTo(shelfX + shelfW - 18, shelfY + shelfH - 14);
    ctx.stroke();

    for (let i = 0; i < 3; i += 1) {
      const boxIndex = state.activeBox + i;
      const rect = this.boxSlotRect(boxIndex, state);
      const box = state.boxes[boxIndex];
      const isActive = i === 0 && box;
      this.drawBox(ctx, rect, box, isActive, game);
    }

    if (state.activeBox >= state.boxes.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(240,215,170,0.8)';
      ctx.font = '600 20px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(t('queueEmpty'), CANVAS_WIDTH / 2, BOX_Y + 62);
    }

    ctx.restore();
  }

  drawBox(ctx, rect, box, isActive, game) {
    ctx.save();
    const pulse = isActive ? 0.5 + 0.5 * Math.sin(this.time * 3.4) : 0;
    if (isActive) {
      ctx.shadowColor = 'rgba(255,206,120,0.55)';
      ctx.shadowBlur = 20 + pulse * 10;
    }

    const body = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    body.addColorStop(0, isActive ? '#4a3624' : '#2c2219');
    body.addColorStop(1, isActive ? '#2a1d12' : '#1a1410');
    ctx.fillStyle = body;
    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = isActive ? 'rgba(255,206,120,0.72)' : 'rgba(180,142,92,0.28)';
    ctx.lineWidth = isActive ? 2.4 : 1.4;
    ctx.stroke();

    if (!box) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundedRect(ctx, rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,200,170,0.18)';
      ctx.font = '600 13px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('—', rect.x + rect.w / 2, rect.y + rect.h / 2 + 4);
      ctx.restore();
      return;
    }

    const color = SCREW_COLORS[box.color] || '#ffffff';
    const dark = SCREW_DARK[box.color] || '#333333';
    const light = SCREW_LIGHT[box.color] || '#ffffff';

    const band = ctx.createLinearGradient(rect.x, rect.y, rect.x + 34, rect.y + rect.h);
    band.addColorStop(0, light);
    band.addColorStop(0.45, color);
    band.addColorStop(1, dark);
    ctx.fillStyle = band;
    roundedRect(ctx, rect.x + 8, rect.y + 10, 30, rect.h - 20, 8);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = '700 14px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(t(`color_${box.color}`), rect.x + 48, rect.y + 24);

    if (isActive) {
      ctx.fillStyle = 'rgba(255,214,140,0.95)';
      ctx.font = '700 10px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(t('nowBox'), rect.x + rect.w - 42, rect.y + 22);
    }

    const slotW = rect.w / 4.4;
    const startX = rect.x + rect.w * 0.38;
    for (let i = 0; i < 3; i += 1) {
      const x = startX + i * slotW;
      const y = rect.y + rect.h * 0.66;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      if (i < box.collected) {
        this.drawScrewHead(ctx, x, y, box.color, { scale: 0.5, locked: false });
      }
    }

    if (this.boxPulse > 0 && isActive) {
      ctx.strokeStyle = `rgba(255,225,160,${this.boxPulse * 0.8})`;
      ctx.lineWidth = 5;
      roundedRect(ctx, rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, 16);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPegboard(ctx) {
    const frameX = BOARD_X - 22;
    const frameY = BOARD_Y - 22;
    const frameW = BOARD_SIZE + 44;
    const frameH = BOARD_SIZE + 44;

    ctx.save();
    const frameGradient = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
    frameGradient.addColorStop(0, '#6a4a2c');
    frameGradient.addColorStop(0.45, '#3d2a18');
    frameGradient.addColorStop(1, '#24170d');
    ctx.fillStyle = frameGradient;
    roundedRect(ctx, frameX, frameY, frameW, frameH, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(236,190,120,0.24)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const [cx, cy] of [
      [frameX + 18, frameY + 18],
      [frameX + frameW - 18, frameY + 18],
      [frameX + 18, frameY + frameH - 18],
      [frameX + frameW - 18, frameY + frameH - 18],
    ]) {
      const brass = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 9);
      brass.addColorStop(0, '#ffe3a4');
      brass.addColorStop(0.6, '#c9974a');
      brass.addColorStop(1, '#6f4a1c');
      ctx.fillStyle = brass;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, TAU);
      ctx.fill();
    }

    const panel = ctx.createLinearGradient(BOARD_X, BOARD_Y, BOARD_X + BOARD_SIZE, BOARD_Y + BOARD_SIZE);
    panel.addColorStop(0, '#29323a');
    panel.addColorStop(0.55, '#1c232a');
    panel.addColorStop(1, '#11161b');
    ctx.fillStyle = panel;
    roundedRect(ctx, BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE, 14);
    ctx.fill();

    ctx.save();
    roundedRect(ctx, BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE, 14);
    ctx.clip();
    for (let r = 0; r < GRID; r += 1) {
      for (let c = 0; c < GRID; c += 1) {
        const x = BOARD_X + (c + 0.5) * CELL;
        const y = BOARD_Y + (r + 0.5) * CELL;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, TAU);
        ctx.fillStyle = 'rgba(0,0,0,0.36)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - 0.8, y - 0.8, 1.5, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i += 1) {
      const x = BOARD_X + i * CELL;
      const y = BOARD_Y + i * CELL;
      ctx.beginPath();
      ctx.moveTo(x, BOARD_Y);
      ctx.lineTo(x, BOARD_Y + BOARD_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(BOARD_X, y);
      ctx.lineTo(BOARD_X + BOARD_SIZE, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 4;
    roundedRect(ctx, BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE, 14);
    ctx.stroke();

    ctx.restore();
  }

  drawPlate(ctx, plate, state) {
    const swing = this.swing.get(plate.id);
    const offset = state.offset || 0;
    ctx.save();
    if (swing && Math.abs(swing.angle) > 0.001) {
      ctx.translate(swing.pivotX, swing.pivotY + offset);
      ctx.rotate(swing.angle);
      ctx.translate(-swing.pivotX, -swing.pivotY - offset);
    } else if (offset) {
      ctx.translate(0, offset);
    }

    const path = buildOutlinePath(plate.cells, CELL, BOARD_X, BOARD_Y);
    const bounds = plateBounds(plate.cells);
    const material = plate.material || 'wood';
    const acrylic = ACRYLIC_TINTS[plate.tone % ACRYLIC_TINTS.length];
    const neon = NEON_TINTS[plate.tone % NEON_TINTS.length];

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.48)';
    ctx.shadowBlur = 16 + plate.layer * 3;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 10;
    const baseGradient = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h);

    if (material === 'wood') {
      baseGradient.addColorStop(0, '#d29a63');
      baseGradient.addColorStop(0.5, '#b27642');
      baseGradient.addColorStop(1, '#7c4a22');
      ctx.fillStyle = baseGradient;
    } else if (material === 'acrylic') {
      baseGradient.addColorStop(0, acrylic[0]);
      baseGradient.addColorStop(0.55, acrylic[1]);
      baseGradient.addColorStop(1, acrylic[1]);
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = baseGradient;
    } else if (material === 'metal') {
      baseGradient.addColorStop(0, '#eef3f8');
      baseGradient.addColorStop(0.35, '#b9c4cf');
      baseGradient.addColorStop(0.7, '#8d99a6');
      baseGradient.addColorStop(1, '#69737f');
      ctx.fillStyle = baseGradient;
    } else if (material === 'neon') {
      baseGradient.addColorStop(0, '#243042');
      baseGradient.addColorStop(0.5, '#151d2a');
      baseGradient.addColorStop(1, '#0b1018');
      ctx.fillStyle = baseGradient;
    } else if (material === 'brass') {
      baseGradient.addColorStop(0, '#f2d489');
      baseGradient.addColorStop(0.45, '#c89a46');
      baseGradient.addColorStop(1, '#7c531d');
      ctx.fillStyle = baseGradient;
    } else {
      baseGradient.addColorStop(0, '#36404c');
      baseGradient.addColorStop(1, '#171d25');
      ctx.fillStyle = baseGradient;
    }

    ctx.fill(path, 'evenodd');
    ctx.restore();

    ctx.save();
    ctx.clip(path, 'evenodd');
    if (material === 'wood') {
      for (let i = 0; i < 6; i += 1) {
        ctx.strokeStyle = `rgba(83,48,19,${0.16 + i * 0.025})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        const y = bounds.y + 14 + i * (bounds.h / 7);
        ctx.moveTo(bounds.x - 10, y);
        ctx.bezierCurveTo(bounds.x + bounds.w * 0.35, y - 7, bounds.x + bounds.w * 0.7, y + 8, bounds.x + bounds.w + 10, y - 3);
        ctx.stroke();
      }
    } else if (material === 'acrylic') {
      const sheen = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h);
      sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
      sheen.addColorStop(0.35, 'rgba(255,255,255,0.04)');
      sheen.addColorStop(0.65, 'rgba(255,255,255,0.18)');
      sheen.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = sheen;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(bounds.x + bounds.w * (0.15 + i * 0.28), bounds.y);
        ctx.lineTo(bounds.x + bounds.w * (0.05 + i * 0.28), bounds.y + bounds.h);
        ctx.stroke();
      }
    } else if (material === 'metal') {
      for (let i = 0; i < 18; i += 1) {
        const y = bounds.y + 4 + (i / 18) * (bounds.h - 8);
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(40,50,60,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bounds.x, y);
        ctx.lineTo(bounds.x + bounds.w, y + 2);
        ctx.stroke();
      }
    } else if (material === 'neon') {
      ctx.strokeStyle = neon;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const y = bounds.y + bounds.h * (0.22 + i * 0.18);
        ctx.beginPath();
        ctx.moveTo(bounds.x + 6, y);
        ctx.lineTo(bounds.x + bounds.w - 6, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = neon;
      ctx.shadowColor = neon;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.4;
      ctx.stroke(path);
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(255,220,140,0.2)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(bounds.x + 10, bounds.y + i * (bounds.h / 5));
        ctx.lineTo(bounds.x + bounds.w - 10, bounds.y + i * (bounds.h / 5) + 3);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.strokeStyle = material === 'neon' ? neon : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = material === 'neon' ? 2 : 2.4;
    ctx.lineJoin = 'round';
    ctx.stroke(path);

    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke(path);

    ctx.restore();
  }

  drawFallingPlate(ctx, fall) {
    ctx.save();
    ctx.globalAlpha = fall.alpha;
    ctx.translate(0, fall.y);
    const bounds = plateBounds(fall.cells);
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(fall.angle);
    ctx.translate(-cx, -cy);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 18;

    const path = buildOutlinePath(fall.cells, CELL, BOARD_X, BOARD_Y);
    const material = fall.material || 'wood';
    const gradient = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h);
    if (material === 'acrylic') {
      gradient.addColorStop(0, '#9ff5dd');
      gradient.addColorStop(1, '#2fb99a');
      ctx.globalAlpha = fall.alpha * 0.86;
    } else if (material === 'metal') {
      gradient.addColorStop(0, '#dbe3eb');
      gradient.addColorStop(1, '#77828e');
    } else if (material === 'neon') {
      gradient.addColorStop(0, '#253247');
      gradient.addColorStop(1, '#0a0f17');
      ctx.strokeStyle = NEON_TINTS[fall.tone % NEON_TINTS.length];
      ctx.lineWidth = 2;
    } else {
      gradient.addColorStop(0, '#d29a63');
      gradient.addColorStop(1, '#7c4a22');
    }
    ctx.fillStyle = gradient;
    ctx.fill(path, 'evenodd');
    ctx.shadowBlur = 0;
    if (material === 'neon') ctx.stroke(path);
    ctx.restore();
  }

  drawBoardScrew(ctx, screw, state) {
    const pos = cellCenter(screw.cell);
    const accessible = isScrewAccessible(state, screw.id);
    const box = activeBox(state);
    const matching = Boolean(box && box.color === screw.color);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.2 + screw.cell.c * 0.7 + screw.cell.r * 0.9);
    this.drawScrewHead(ctx, pos.x, pos.y, screw.color, {
      locked: !accessible,
      matching: accessible && matching,
      pulse,
      scale: 1,
    });
  }

  drawScrewHead(ctx, x, y, color, options = {}) {
    const { locked = false, matching = false, pulse = 0, scale = 1, angle = 0 } = options;
    const base = SCREW_COLORS[color] || '#c9d1d9';
    const light = SCREW_LIGHT[color] || '#ffffff';
    const dark = SCREW_DARK[color] || '#333a42';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    if (matching && !locked) {
      const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 40 + pulse * 6);
      glow.addColorStop(0, `${base}66`);
      glow.addColorStop(0.55, `${base}2a`);
      glow.addColorStop(1, `${base}00`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    const ring = ctx.createRadialGradient(-5, -5, 2, 0, 0, 24);
    ring.addColorStop(0, '#f4f7fa');
    ring.addColorStop(0.45, '#aeb8c4');
    ring.addColorStop(0.75, '#68727e');
    ring.addColorStop(1, '#3d454f');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.restore();

    const cap = ctx.createRadialGradient(-6, -7, 2, 0, 0, 18);
    cap.addColorStop(0, light);
    cap.addColorStop(0.45, base);
    cap.addColorStop(1, dark);
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.arc(0, 0, 16.5, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 16.5, Math.PI * 1.05, Math.PI * 1.72);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(25,28,34,0.62)';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8.5, 0);
    ctx.lineTo(8.5, 0);
    ctx.moveTo(0, -8.5);
    ctx.lineTo(0, 8.5);
    ctx.stroke();
    ctx.lineCap = 'butt';

    if (locked) {
      ctx.fillStyle = 'rgba(8,12,17,0.52)';
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,196,210,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 2);
      ctx.lineTo(6, -5);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawFlight(ctx, flight) {
    const x = flight.x === undefined ? flight.from.x : flight.x;
    const y = flight.y === undefined ? flight.from.y : flight.y;
    ctx.save();
    ctx.globalAlpha = 0.95;
    this.drawScrewHead(ctx, x, y, flight.color, {
      scale: flight.scale || 1,
      angle: flight.angle || 0,
      locked: false,
      matching: true,
    });
    ctx.restore();
  }

  drawBuffer(ctx, state) {
    const capacity = Math.max(3, state.bufferCapacity, state.buffer.length);
    const trayW = capacity * 82 + 60;
    const trayX = (CANVAS_WIDTH - trayW) / 2;
    const trayY = BUFFER_Y - 18;

    ctx.save();
    const tray = ctx.createLinearGradient(trayX, trayY, trayX, trayY + 116);
    tray.addColorStop(0, '#2b3138');
    tray.addColorStop(1, '#151a1f');
    ctx.fillStyle = tray;
    roundedRect(ctx, trayX, trayY, trayW, 116, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,206,222,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(220,230,240,0.62)';
    ctx.font = '600 14px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${t('bufferLabel')} ${state.buffer.length}/${state.bufferCapacity}`, trayX + 20, trayY + 24);

    const totalW = capacity * 82;
    const startX = (CANVAS_WIDTH - totalW) / 2 + 41;
    for (let i = 0; i < capacity; i += 1) {
      const x = startX + i * 82;
      const y = BUFFER_Y + 58;
      const filled = i < state.buffer.length;
      const screwId = filled ? state.buffer[i] : null;
      const screw = screwId ? state.screws.find((item) => item.id === screwId) : null;

      ctx.beginPath();
      ctx.arc(x, y, 26, 0, TAU);
      ctx.fillStyle = 'rgba(4,7,10,0.55)';
      ctx.fill();
      const rim = ctx.createRadialGradient(x - 6, y - 7, 2, x, y, 28);
      rim.addColorStop(0, 'rgba(220,232,244,0.5)');
      rim.addColorStop(0.55, 'rgba(104,116,130,0.32)');
      rim.addColorStop(1, 'rgba(30,36,44,0.7)');
      ctx.strokeStyle = rim;
      ctx.lineWidth = 4;
      ctx.stroke();

      if (screw) {
        this.drawScrewHead(ctx, x, y, screw.color, { scale: 0.8, locked: false });
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
      }
    }

    if (state.buffer.length > state.bufferCapacity) {
      ctx.strokeStyle = `rgba(255,120,120,${0.4 + 0.2 * Math.sin(this.time * 4)})`;
      ctx.lineWidth = 3;
      roundedRect(ctx, trayX - 2, trayY - 2, trayW + 4, 120, 22);
      ctx.stroke();
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(180,200,218,0.45)';
    ctx.font = '500 12px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    if (state.buffer.length >= state.bufferCapacity) {
      ctx.fillStyle = 'rgba(255,150,120,0.85)';
      ctx.fillText(t('bufferFull'), trayX + trayW - 20, trayY + 24);
    }

    ctx.restore();
  }

  drawParticles(ctx) {
    for (const particle of this.particles) {
      const alpha = Math.max(0, 1 - particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawConfetti(ctx) {
    for (const piece of this.confetti) {
      const alpha = Math.max(0, 1 - piece.life / piece.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.angle);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawVignette(ctx) {
    const vignette = ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_HEIGHT * 0.28,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_HEIGHT * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.46)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}

function cellCenterFromId(game, screwId) {
  if (!game) return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
  const state = game.getState();
  const screw = state ? state.screws.find((item) => item.id === screwId) : null;
  return screw ? cellCenter(screw.cell) : { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
}
