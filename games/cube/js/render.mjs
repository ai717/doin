// 唯一绘制层：Canvas 2D 纯代码三维投影渲染魔方，零外部模型与纹理。
// 采用面法线透视投影 + 画家算法，倒角贴纸由圆角多边形程序化绘制。

import { COLOR_HEX, LOCAL_DIRS, applyMat } from "./engine.mjs";

const CAM_DIST = 8.2;
const FOV = 1.7;
const LIGHT = normalize([-0.35, 0.72, 0.62]);
const BODY_COLOR = [24, 27, 33];
const STICKER_INSET = 0.83;
const CUBIE_GAP = 0.46;

const FACE_CORNERS = [
  [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
  [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
  [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]],
  [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]],
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [[-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1]],
];

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function floatRotation(axis, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

function shade(rgb, brightness) {
  const r = clamp(Math.round(rgb[0] * brightness), 0, 255);
  const g = clamp(Math.round(rgb[1] * brightness), 0, 255);
  const b = clamp(Math.round(rgb[2] * brightness), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

const STICKER_RGB = COLOR_HEX.map(hexToRgb);

function roundedPolygon(context, points, radius) {
  const count = points.length;
  context.beginPath();
  for (let i = 0; i < count; i += 1) {
    const prev = points[(i + count - 1) % count];
    const current = points[i];
    const next = points[(i + 1) % count];
    const prevLength = Math.hypot(prev.x - current.x, prev.y - current.y) || 1;
    const nextLength = Math.hypot(next.x - current.x, next.y - current.y) || 1;
    const limit = Math.min(radius, prevLength / 2.2, nextLength / 2.2);
    const start = {
      x: current.x + ((prev.x - current.x) / prevLength) * limit,
      y: current.y + ((prev.y - current.y) / prevLength) * limit,
    };
    const end = {
      x: current.x + ((next.x - current.x) / nextLength) * limit,
      y: current.y + ((next.y - current.y) / nextLength) * limit,
    };
    if (i === 0) context.moveTo(start.x, start.y);
    else context.lineTo(start.x, start.y);
    context.quadraticCurveTo(current.x, current.y, end.x, end.y);
  }
  context.closePath();
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const pi = points[i];
    const pj = points[j];
    const intersect = pi.y > y !== pj.y > y
      && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export class CubeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.yaw = -0.62;
    this.pitch = 0.5;
    this.width = 600;
    this.height = 600;
    this.dpr = 1;
    this.pickFaces = [];
    this.stickerFaces = [];
    this.dust = [];
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(260, Math.round(rect.width || 600));
    const cssHeight = Math.max(260, Math.round(rect.height || 600));
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.width = cssWidth;
    this.height = cssHeight;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dust = this.buildDust();
  }

  buildDust() {
    const random = mulberry(0x9e3779b9);
    const list = [];
    const count = this.width < 480 ? 22 : 38;
    for (let i = 0; i < count; i += 1) {
      list.push({
        x: random() * this.width,
        y: random() * this.height * 0.86,
        r: 0.6 + random() * 1.8,
        a: 0.08 + random() * 0.2,
      });
    }
    return list;
  }

  orbit(dx, dy) {
    this.yaw += dx * 0.009;
    this.pitch = clamp(this.pitch + dy * 0.009, -1.15, 1.15);
  }

  center() {
    return { x: this.width / 2, y: this.height * 0.515 };
  }

  scale() {
    return Math.min(this.width, this.height) * FOV;
  }

  project(point) {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const x1 = point[0] * cy + point[2] * sy;
    const z1 = -point[0] * sy + point[2] * cy;
    const y1 = point[1] * cp - z1 * sp;
    const z2 = point[1] * sp + z1 * cp;
    const depth = CAM_DIST - z2;
    const focal = this.scale();
    const center = this.center();
    const safe = Math.max(depth, 0.2);
    return {
      x: center.x + (x1 * focal) / safe,
      y: center.y - (y1 * focal) / safe,
      depth,
    };
  }

  rotateNormal(normal) {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const x1 = normal[0] * cy + normal[2] * sy;
    const z1 = -normal[0] * sy + normal[2] * cy;
    const y1 = normal[1] * cp - z1 * sp;
    const z2 = normal[1] * sp + z1 * cp;
    return [x1, y1, z2];
  }

  draw(cube, options = {}) {
    const context = this.context;
    const layerTurn = options.layerTurn ?? null;
    const hint = options.hint ?? null;
    const solved = Boolean(options.solved);
    this.pickFaces = [];
    this.stickerFaces = [];

    context.clearRect(0, 0, this.width, this.height);
    this.drawBackdrop(context, solved);

    const size = cube.size;
    this.lastSize = size;
    const mid = (size - 1) / 2;
    const animatedMatrix = layerTurn ? floatRotation(layerTurn.axis, layerTurn.angle) : null;

    const items = [];
    const coreItems = [];
    const coreHalf = size * 0.44;
    this.pushBox(coreItems, [0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1], coreHalf, [14, 16, 20]);
    coreItems.sort((a, b) => b.depth - a.depth);
    this.drawItems(context, coreItems);

    for (const cubie of cube.cubies) {
      const inLayer = layerTurn && cubie.p[layerTurn.axis] === layerTurn.layer;
      const matrix = inLayer ? mul(animatedMatrix, cubie.m) : cubie.m;
      const localCenter = [cubie.p[0] - mid, cubie.p[1] - mid, cubie.p[2] - mid];
      const centerPoint = inLayer ? applyMat(animatedMatrix, localCenter) : localCenter;

      for (let face = 0; face < 6; face += 1) {
        const localDir = LOCAL_DIRS[face];
        const normal = applyMat(matrix, localDir);
        const viewNormal = this.rotateNormal(normal);
        if (viewNormal[2] <= 0.02) continue;

        const corners = FACE_CORNERS[face].map((sign) => {
          const local = [sign[0] * CUBIE_GAP, sign[1] * CUBIE_GAP, sign[2] * CUBIE_GAP];
          const world = applyMat(matrix, local);
          return [
            world[0] + centerPoint[0],
            world[1] + centerPoint[1],
            world[2] + centerPoint[2],
          ];
        });
        const projected = corners.map((corner) => this.project(corner));
        const depth = projected.reduce((sum, point) => sum + point.depth, 0) / 4;
        const litNormal = normalize(viewNormal);
        const brightness = 0.42 + 0.58 * Math.max(0, litNormal[0] * LIGHT[0] + litNormal[1] * LIGHT[1] + litNormal[2] * LIGHT[2]);

        const bodyColor = shade(BODY_COLOR, 0.7 + brightness * 0.55);
        const color = cubie.c[face];
        if (color >= 0) {
          const faceCenter = [
            normal[0] * CUBIE_GAP + centerPoint[0],
            normal[1] * CUBIE_GAP + centerPoint[1],
            normal[2] * CUBIE_GAP + centerPoint[2],
          ];
          const stickerPoints = corners
            .map((corner) => {
              const dx = corner[0] - faceCenter[0];
              const dy = corner[1] - faceCenter[1];
              const dz = corner[2] - faceCenter[2];
              return [
                faceCenter[0] + dx * STICKER_INSET,
                faceCenter[1] + dy * STICKER_INSET,
                faceCenter[2] + dz * STICKER_INSET,
              ];
            })
            .map((corner) => this.project(corner));
          const hintLayer = Boolean(hint) && cubie.p[hint.axis] === hint.layer;
          items.push({
            kind: "sticker",
            points: stickerPoints,
            bodyPoints: projected,
            depth,
            color: shade(STICKER_RGB[color], 0.62 + brightness * 0.52),
            bodyColor,
            radius: Math.max(2.5, this.scale() * 0.008),
            highlighted: hintLayer,
          });
        } else {
          items.push({ kind: "body", points: projected, depth, color: bodyColor, radius: 2.2 });
        }

        this.pickFaces.push({
          points: projected,
          depth,
          normal,
          cubie: { p: cubie.p.slice() },
        });
      }
    }

    items.sort((a, b) => b.depth - a.depth);
    this.drawItems(context, items);
    this.pickFaces.sort((a, b) => a.depth - b.depth);
    this.drawFrontGlow(context, solved);
  }

  pushBox(items, center, matrix, half, color) {
    for (let face = 0; face < 6; face += 1) {
      const normal = applyMat(matrix, LOCAL_DIRS[face]);
      const viewNormal = this.rotateNormal(normal);
      if (viewNormal[2] <= 0.02) continue;
      const corners = FACE_CORNERS[face].map((sign) => {
        const local = [sign[0] * half, sign[1] * half, sign[2] * half];
        const world = applyMat(matrix, local);
        return [world[0] + center[0], world[1] + center[1], world[2] + center[2]];
      });
      const projected = corners.map((corner) => this.project(corner));
      const depth = projected.reduce((sum, point) => sum + point.depth, 0) / 4;
      items.push({ kind: "body", points: projected, depth, color: `rgb(${color.join(",")})`, radius: 2 });
    }
  }

  drawItems(context, items) {
    for (const item of items) {
      if (item.kind === "sticker" && item.bodyPoints) {
        roundedPolygon(context, item.bodyPoints, 2.2);
        context.fillStyle = item.bodyColor;
        context.fill();
      }
      roundedPolygon(context, item.points, item.radius);
      context.fillStyle = item.color;
      context.fill();
      if (item.kind === "sticker") {
        context.lineWidth = 1;
        context.strokeStyle = "rgba(255,255,255,0.14)";
        context.stroke();
        if (item.highlighted) {
          context.save();
          context.shadowColor = "rgba(255, 186, 78, 0.9)";
          context.shadowBlur = 12;
          context.strokeStyle = "rgba(255, 200, 96, 0.95)";
          context.lineWidth = 2;
          context.stroke();
          context.restore();
        }
      }
    }
  }

  drawBackdrop(context, solved) {
    const gradient = context.createRadialGradient(
      this.width * 0.5,
      this.height * 0.38,
      this.width * 0.08,
      this.width * 0.5,
      this.height * 0.62,
      this.width * 0.78,
    );
    gradient.addColorStop(0, solved ? "#243026" : "#1a2029");
    gradient.addColorStop(0.55, "#10141b");
    gradient.addColorStop(1, "#080a0e");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.width, this.height);

    const glow = context.createRadialGradient(
      this.width * 0.5,
      this.height * 0.5,
      0,
      this.width * 0.5,
      this.height * 0.5,
      this.width * 0.42,
    );
    glow.addColorStop(0, solved ? "rgba(255, 203, 96, 0.20)" : "rgba(91, 156, 255, 0.11)");
    glow.addColorStop(1, "rgba(8, 10, 14, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, this.width, this.height);

    for (const speck of this.dust) {
      context.beginPath();
      context.arc(speck.x, speck.y, speck.r, 0, Math.PI * 2);
      context.fillStyle = `rgba(196, 224, 255, ${speck.a})`;
      context.fill();
    }

    const center = this.center();
    const shadow = context.createRadialGradient(
      center.x,
      center.y + this.height * 0.24,
      4,
      center.x,
      center.y + this.height * 0.24,
      this.width * 0.30,
    );
    shadow.addColorStop(0, "rgba(0, 0, 0, 0.55)");
    shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = shadow;
    context.beginPath();
    context.ellipse(center.x, center.y + this.height * 0.24, this.width * 0.3, this.height * 0.09, 0, 0, Math.PI * 2);
    context.fill();
  }

  drawFrontGlow(context, solved) {
    if (!solved) return;
    const center = this.center();
    const pulse = context.createRadialGradient(
      center.x,
      center.y,
      this.width * 0.1,
      center.x,
      center.y,
      this.width * 0.46,
    );
    pulse.addColorStop(0, "rgba(255, 205, 110, 0)");
    pulse.addColorStop(0.78, "rgba(255, 205, 110, 0.10)");
    pulse.addColorStop(1, "rgba(255, 205, 110, 0)");
    context.fillStyle = pulse;
    context.fillRect(0, 0, this.width, this.height);
  }

  pick(x, y) {
    for (const face of this.pickFaces) {
      if (pointInPolygon(x, y, face.points)) {
        return { cubie: face.cubie, normal: face.normal };
      }
    }
    return null;
  }

  // 屏幕位移投影到世界轴：用于把拖动方向换算成旋转轴
  screenAxis(cubie, axis) {
    const size = this.lastSize ?? 3;
    const mid = (size - 1) / 2;
    const origin = [
      cubie.p[0] - mid,
      cubie.p[1] - mid,
      cubie.p[2] - mid,
    ];
    const tip = origin.slice();
    tip[axis] += 0.45;
    const a = this.project(origin);
    const b = this.project(tip);
    return { x: b.x - a.x, y: b.y - a.y };
  }
}

// 拖动意图换算（纯函数，便于单测）：屏幕位移 -> 绕世界轴旋转的层转。
// dirs[axis] = 该世界轴在屏幕上的投影向量（长度会随透视变化，此处自行归一化，否则角度会被放大数十倍而瞬间饱和）。
// 返回 null 表示拖动太短或无法判定方向；否则给出旋转轴、层、屏幕方向与转向，
// 调用方据此在拖动过程中连续重算角度：angle = (drag · (ux, uy) / pxPerQuarter) * π/2 * sign。
export function resolveDragTurn({ normal, dirs, point, dx, dy, pxPerQuarter }) {
  const normalAxis = normal.findIndex((value) => Math.abs(value) > 0.5);
  let best = null;
  for (const axis of [0, 1, 2]) {
    if (axis === normalAxis) continue;
    const raw = dirs[axis];
    if (!raw) continue;
    const length = Math.hypot(raw.x, raw.y);
    if (length < 1e-4) continue;
    const ux = raw.x / length;
    const uy = raw.y / length;
    const projection = dx * ux + dy * uy;
    if (!best || Math.abs(projection) > Math.abs(best.projection)) best = { axis, ux, uy, projection };
  }
  if (!best || Math.abs(best.projection) < 2) return null;

  // 真实拖动方向 = 该世界轴方向 × 投影符号；旋转轴 = 面法线 × 拖动方向（右手定则）
  const dirSign = best.projection >= 0 ? 1 : -1;
  const direction = [0, 0, 0];
  direction[best.axis] = dirSign;
  const cross = [
    normal[1] * direction[2] - normal[2] * direction[1],
    normal[2] * direction[0] - normal[0] * direction[2],
    normal[0] * direction[1] - normal[1] * direction[0],
  ];
  const axis = cross.findIndex((value) => Math.abs(value) > 0.5);
  if (axis < 0) return null;

  return {
    axis,
    layer: point[axis],
    // ux/uy 为「实际拖动方向」在屏幕上的单位向量：反向拖动时角度自然翻符号
    ux: best.ux * dirSign,
    uy: best.uy * dirSign,
    sign: cross[axis] > 0 ? 1 : -1,
    pxPerQuarter: Math.max(24, pxPerQuarter),
  };
}

// 拖动中的实时角度：沿判定轴的有向位移 -> 弧度，满 pxPerQuarter 像素 = 90°，超过 180° 截断。
export function dragAngle(turn, dx, dy) {
  const projection = dx * turn.ux + dy * turn.uy;
  const raw = (projection / turn.pxPerQuarter) * (Math.PI / 2) * turn.sign;
  return Math.max(-Math.PI, Math.min(Math.PI, raw));
}

function mul(matrixA, matrixB) {
  if (!matrixA) return matrixB;
  const out = new Array(9);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row * 3 + col] =
        matrixA[row * 3] * matrixB[col]
        + matrixA[row * 3 + 1] * matrixB[3 + col]
        + matrixA[row * 3 + 2] * matrixB[6 + col];
    }
  }
  return out;
}

function mulberry(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
