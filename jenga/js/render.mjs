// 叠叠乐 · 等轴 2.5D 木塔舞台（Canvas 2D，唯一碰绘制的层）
//
// 投影：世界 (x, y, z) 绕竖轴转 yaw 得到 (X', Z')，再压成屏幕
//   sx = (X' - Z') * scale
//   sy = (X' + Z') * scale * ISO_Y - y * scale * ISO_UP   （y 为离塔垫面的高度）
// 画家算法：先按 X'+Z' 升序排远近，同深度再按高度升序 —— 上层压下层、近处压远处。
//
// 塌落阶段改用块的物理位姿 px/py/pz + rx/rz 建模，跌落、翻滚与尘屑都在这一层表现。

import {
  BLOCK_W, BLOCK_L, BLOCK_H, PAD_HALF, STATUS, PER_LAYER,
  layerBox, axisOfLayer, layerCount, towerBlocks, slotOffset, tiltOf
} from "./engine.mjs";

const ISO_Y = 0.5;
const ISO_UP = 1;
// 由投影反推的相机视线方向：n ∝ (cos(yaw)+sin(yaw), 2√2, cos(yaw)−sin(yaw))
// 排序深度必须带上 y 权重，否则"高而远"的块会被"低而近"的块错误盖住
const CAM_UP = 2 * Math.SQRT2;
const FIT_R = PAD_HALF; // 塔身（含塔垫）水平半径，用于自适应取景
const FOOT_HW = FIT_R * Math.SQRT2;             // 塔垫椭圆横向半宽（世界单位）
const FOOT_HH = FIT_R * Math.SQRT2 * ISO_Y * 1.04; // 塔垫椭圆竖向半宽

const WOOD = {
  top: [186, 132, 84],
  sideA: [150, 98, 58],
  sideB: [116, 73, 42],
  edge: [78, 48, 28]
};

const COLORS = {
  padDark: [58, 36, 22],
  padLight: [104, 68, 42],
  chalk: [239, 236, 224],
  dust: [214, 178, 128],
  gold: [255, 206, 106],
  glow: [255, 226, 160]
};

function rgb(c, alpha = 1, mul = 1) {
  const r = Math.min(255, Math.round(c[0] * mul));
  const g = Math.min(255, Math.round(c[1] * mul));
  const b = Math.min(255, Math.round(c[2] * mul));
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

// ------------------------------------------------------------ 立方体面片（纯函数）
//
// 8 角顺序（cornersOf 的 local 顺序 [sx,sy,sz]，lx=sx·hx / ly=sy·hy / lz=sz·hz）：
//   p0(-,-,-) p1(+,-,-) p2(+,+,-) p3(-,+,-) p4(-,-,+) p5(+,-,+) p6(+,+,+) p7(-,+,+)
//   ⇒ 0..3 是 y=-hy（底），4..7 是 y=+hy（顶）；x=+hx 是 1/2/5/6；z=+hz 是 4/5/6/7
//
// ⚠ 每个面的 4 个顶点必须按同一绕向排（相邻边首尾相接）。排成"蝴蝶结"序时
//   Canvas 的 nonzero 填充只填两个瓣、留下三角缺口 —— 塔顶看起来"碎掉"就是这个原因。
//   （曾真实发生过：FACE_TOP 写成 [p2,p3,p6,p7]，因 p6 的 x 是 +hx 而非 -hx。）
const FACE_TOP = (p) => [p[2], p[3], p[7], p[6]];
const FACE_BOTTOM = (p) => [p[0], p[1], p[5], p[4]];
const FACE_PX = (p) => [p[1], p[2], p[6], p[5]];
const FACE_NX = (p) => [p[0], p[3], p[7], p[4]];
const FACE_PZ = (p) => [p[4], p[5], p[6], p[7]];
const FACE_NZ = (p) => [p[0], p[1], p[2], p[3]];

// 给定 8 个投影点与"视线在 x/z 轴上的符号"，返回朝向相机的三个面（顶 + 两侧）
export function faceRects(pts, visX, visZ) {
  return {
    top: FACE_TOP(pts),
    sideA: visX >= 0 ? FACE_PX(pts) : FACE_NX(pts),
    sideB: visZ >= 0 ? FACE_PZ(pts) : FACE_NZ(pts)
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  // 默认正视塔的一个棱角（yaw=0）：±x 与 ±z 两个侧面同时朝向相机，棱角视感最立体。
  // 注意 yaw=45° 是退化角——相机正对 x 轴，±z 面屏幕面积为 0，整座塔会退化成
  // "只剩一个侧面 + 顶面"的正立面，看起来像一片平板（历史 bug）。
  const view = { yaw: 0, zoom: 1, scale: 24, cx: 0, cy: 0, w: 0, h: 0 };
  let reduced = false;
  const dust = [];
  let shakePhase = 0;

  function resize() {
    if (!ctx) return view;
    const rect = canvas.getBoundingClientRect?.();
    const cssW = Math.max(320, Math.round(rect?.width || canvas.clientWidth || 720));
    const cssH = Math.max(240, Math.round(rect?.height || canvas.clientHeight || 560));
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    view.w = cssW;
    view.h = cssH;
    view.cx = cssW / 2;
    view.dpr = dpr;
    if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 塔垫锚点贴在舞台下方；具体缩放交给每帧 fitView 按塔高自适应
    view.cy = cssH - cssH * 0.12;
    view.scale = Math.min(cssW * 0.15, cssH * 0.055);
    return view;
  }

  function project(x, y, z) {
    const c = Math.cos(view.yaw);
    const s = Math.sin(view.yaw);
    const rx = x * c - z * s;
    const rz = x * s + z * c;
    return {
      x: view.cx + (rx - rz) * view.scale * view.zoom,
      y: view.cy + ((rx + rz) * ISO_Y - y * ISO_UP) * view.scale * view.zoom
    };
  }

  // 画家算法的深度键：沿相机视线方向投影。少了 y 项就会把"高而远"的块
  // 画到"低而近"的块前面，塔身出现互相穿插的假象。
  function cameraDepth(x, y, z) {
    const c = Math.cos(view.yaw);
    const s = Math.sin(view.yaw);
    return x * (c + s) + y * CAM_UP + z * (c - s);
  }

  function faceNormalsVisible() {
    const c = Math.cos(view.yaw);
    const s = Math.sin(view.yaw);
    return { x: c + s, z: c - s };
  }

  // ------------------------------------------------------------ 块几何

  function blockBox(state, block) {
    if (state.status === STATUS.COLLAPSE || state.status === STATUS.LOST || !block.inTower) {
      // 塌落块按原层级朝向保留占地（一横一竖），否则同层三块全画成横的会互相嵌成一块。
      // yLow/yHigh 跟着 py 走——写死 0.3 会让木纹与粉笔记号画到地面高度去。
      const hy = BLOCK_H / 2;
      const long = axisOfLayer(block.layer ?? 0) === 0;
      const hx = long ? BLOCK_L / 2 : BLOCK_W / 2;
      const hz = long ? BLOCK_W / 2 : BLOCK_L / 2;
      return {
        x0: -hx, x1: hx, z0: -hz, z1: hz,
        yLow: block.py - hy, yHigh: block.py + hy,
        pos: [block.px, block.py, block.pz],
        rot: true,
        long
      };
    }
    const box = layerBox(state, block.layer, block.slot);
    if (!box) return null;
    const long = axisOfLayer(block.layer) === 0;
    return {
      x0: box.x0, x1: box.x1, z0: box.z0, z1: box.z1,
      yLow: box.y, yHigh: box.y + BLOCK_H,
      pos: [(box.x0 + box.x1) / 2, box.y + BLOCK_H / 2, (box.z0 + box.z1) / 2],
      rot: false,
      long
    };
  }

  function cornersOf(box, state) {
    const half = {
      hx: (box.x1 - box.x0) / 2,
      hz: (box.z1 - box.z0) / 2,
      hy: (box.yHigh - box.yLow) / 2
    };
    const centerY = (box.yHigh + box.yLow) / 2;
    const pts = [];
    const local = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
    ];
    let spinX = 0;
    let spinZ = 0;
    if (box.rot) {
      spinX = box.spinX ?? 0;
      spinZ = box.spinZ ?? 0;
    }
    for (const [sx, sy, sz] of local) {
      let lx = sx * half.hx;
      let ly = sy * half.hy;
      let lz = sz * half.hz;
      if (spinZ) {
        const cz = Math.cos(spinZ);
        const sz2 = Math.sin(spinZ);
        const nx = lx * cz - ly * sz2;
        const ny = lx * sz2 + ly * cz;
        lx = nx;
        ly = ny;
      }
      if (spinX) {
        const cx2 = Math.cos(spinX);
        const sx2 = Math.sin(spinX);
        const ny = ly * cx2 - lz * sx2;
        const nz = ly * sx2 + lz * cx2;
        ly = ny;
        lz = nz;
      }
      const wx = box.pos[0] + lx;
      const wy = box.pos[1] + ly;
      const wz = box.pos[2] + lz;
      const world = state && !box.rot ? tilt(state, wx, wy, wz) : [wx, wy, wz];
      pts.push(project(world[0], world[1], world[2]));
    }
    return pts;
    void centerY;
  }

  function tilt(state, x, y, z) {
    return [x + y * Math.tan(state.sway.tx), y, z + y * Math.tan(state.sway.tz)];
  }

  // ------------------------------------------------------------ 绘制

  function drawPolygon(points, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fill();
  }

  function pointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const a = poly[i];
      const b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
    return inside;
  }

  function drawPad(state) {
    const segs = 48;
    const ring = [];
    let min = { x: Infinity, y: Infinity };
    let max = { x: -Infinity, y: -Infinity };
    for (let i = 0; i < segs; i += 1) {
      const a = (i / segs) * Math.PI * 2;
      const p = project(Math.cos(a) * PAD_HALF, BLOCK_H * 0.02, Math.sin(a) * PAD_HALF);
      ring.push(p);
      min = { x: Math.min(min.x, p.x), y: Math.min(min.y, p.y) };
      max = { x: Math.max(max.x, p.x), y: Math.max(max.y, p.y) };
    }
    const grad = ctx.createLinearGradient(min.x, min.y, max.x, max.y);
    grad.addColorStop(0, rgb(COLORS.padLight));
    grad.addColorStop(1, rgb(COLORS.padDark));
    drawPolygon(ring, grad, rgb(WOOD.edge, 0.55));
    // 塔垫上的墨斗十字线：既是装饰，也标出质心基准原点
    ctx.strokeStyle = rgb(COLORS.chalk, 0.24);
    ctx.lineWidth = 1;
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const a = project(-dx * PAD_HALF, BLOCK_H * 0.03, -dz * PAD_HALF);
      const b = project(dx * PAD_HALF, BLOCK_H * 0.03, dz * PAD_HALF);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    void state;
  }

  function drawShadow(state) {
    const blocks = towerBlocks(state);
    if (!blocks.length) return;
    const top = Math.max(...blocks.map((b) => b.py));
    const alpha = 0.22 - Math.min(0.12, top * 0.002);
    const r = PAD_HALF * 1.15 * view.scale * view.zoom;
    const c = project(0, 0, 0);
    const grad = ctx.createRadialGradient(c.x, c.y, r * 0.2, c.x, c.y, r);
    grad.addColorStop(0, `rgba(28,16,8,${alpha.toFixed(3)})`);
    grad.addColorStop(1, "rgba(28,16,8,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * ISO_Y, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 当前 yaw 下真正朝向相机的三个面：顶面 + 两个侧面（由视线方向决定选哪一侧）
  function visibleFaces(pts) {
    const vis = faceNormalsVisible();
    return faceRects(pts, vis.x, vis.z);
  }

  function drawBlock(state, block, opts) {
    const box = blockBox(state, block);
    if (!box) return;
    const marked = opts.marked?.has(block.id);
    const hovered = opts.hoverId === block.id;
    const focused = opts.focusId === block.id;
    const pullable = opts.pullableIds?.has(block.id);
    const tone = 0.9 + ((block.id * 37) % 11) * 0.014;
    const boost = hovered ? 1.22 : focused ? 1.14 : pullable ? 1.06 : 1;
    const pts = cornersOf({ ...box, spinX: block.rx, spinZ: block.rz }, state);
    const half = {
      hx: (box.x1 - box.x0) / 2,
      hz: (box.z1 - box.z0) / 2,
      hy: BLOCK_H / 2
    };

    // 朝向相机的两个侧面（由 yaw 决定选哪两面），先画侧面再盖顶面
    const faces = visibleFaces(pts);

    drawPolygon(faces.sideA, rgb(WOOD.sideA, 1, tone * boost * 0.92), rgb(WOOD.edge, 0.45));
    drawPolygon(faces.sideB, rgb(WOOD.sideB, 1, tone * boost * 0.88), rgb(WOOD.edge, 0.45));
    drawPolygon(faces.top, rgb(WOOD.top, 1, tone * boost), rgb(WOOD.edge, 0.5));

    // 木纹：顶面沿长轴两道细线，成本极低却让"平的电缆面"不再是塑料感
    if (half.hx !== half.hz) {
      const along = half.hx > half.hz;
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = rgb(WOOD.edge, 1);
      ctx.lineWidth = 1;
      for (const frac of [-0.22, 0.24]) {
        const a = along
          ? project(...tilt(state, box.pos[0] + frac * half.hx, box.yHigh + 0.01, box.pos[2] - half.hz * 0.55))
          : project(...tilt(state, box.pos[0] - half.hx * 0.55, box.yHigh + 0.01, box.pos[2] + frac * half.hz));
        const b = along
          ? project(...tilt(state, box.pos[0] + frac * half.hx, box.yHigh + 0.01, box.pos[2] + half.hz * 0.55))
          : project(...tilt(state, box.pos[0] + half.hx * 0.55, box.yHigh + 0.01, box.pos[2] + frac * half.hz));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (marked) drawChalkMark(state, box, pts);
    if (hovered || focused) drawSoftGlow(faces, hovered ? 0.45 : 0.32, focused && !hovered ? COLORS.gold : COLORS.glow);
  }

  function drawChalkMark(state, box, pts) {
    const mid = project(...tilt(state, box.pos[0], box.yHigh + 0.02, box.pos[2]));
    const rx = view.scale * view.zoom * 0.42;
    ctx.save();
    ctx.strokeStyle = rgb(COLORS.chalk, 0.82);
    ctx.lineWidth = Math.max(1.4, view.scale * 0.09);
    ctx.beginPath();
    ctx.ellipse(mid.x, mid.y, rx, rx * ISO_Y, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    void pts;
  }

  // 无边界径向柔光：绝不用硬边描边圈。但必须裁进"这块自己的三个可见面"里——
  // 之前光晕半径给到 1.5×外接圆又不裁剪，会整片糊到相邻木块和塔外背景上：被照到的
  // 邻居起雾发白，整层看着像半透明缺了一块（用户反馈：视觉残缺；鼠标一移这团雾就扫过塔身）。
  // 裁进去后"亮的是这一块"，边缘依旧柔和，却不再污染别人。
  function drawSoftGlow(faces, alpha, color) {
    const quads = [faces.top, faces.sideA, faces.sideB];
    let cx2 = 0;
    let cy2 = 0;
    let r = 0;
    for (const q of quads) {
      for (const p of q) {
        cx2 += p.x;
        cy2 += p.y;
      }
    }
    cx2 /= quads.length * 4;
    cy2 /= quads.length * 4;
    for (const q of quads) {
      for (const p of q) r = Math.max(r, Math.hypot(p.x - cx2, p.y - cy2));
    }
    ctx.save();
    ctx.beginPath();
    for (const q of quads) {
      ctx.moveTo(q[0].x, q[0].y);
      ctx.lineTo(q[1].x, q[1].y);
      ctx.lineTo(q[2].x, q[2].y);
      ctx.lineTo(q[3].x, q[3].y);
      ctx.closePath();
    }
    ctx.clip();
    const grad = ctx.createRadialGradient(cx2, cy2, r * 0.15, cx2, cy2, r * 1.15);
    grad.addColorStop(0, rgb(color, alpha));
    grad.addColorStop(1, rgb(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx2, cy2, r * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTopSlots(state, opts) {
    const top = state.layers[layerCount(state) - 1];
    if (!top) return;
    const show = state.status === STATUS.HOLDING || opts.alwaysSlots;
    if (!show) return;
    const line = topLineBoxes(state, top);
    line.forEach((entry, i) => {
      const active = opts.slotIds?.includes(entry.slot);
      const hovered = opts.hoverSlot === entry.slot;
      const alpha = active ? (hovered ? 0.72 : 0.5) : 0.16;
      const fill = hovered ? COLORS.gold : COLORS.glow;
      drawPolygon(entry.pts, rgb(fill, alpha));
      if (active) {
        const mid = project(...tilt(state, entry.cx, entry.y + 0.01, entry.cz));
        ctx.save();
        ctx.fillStyle = rgb(COLORS.chalk, 0.7);
        ctx.font = `${Math.round(view.scale * 0.5)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(entry.slot + 1), mid.x, mid.y);
        ctx.restore();
      }
      void i;
    });
  }

  // 塔顶落位区的几何（drawTopSlots 与 hitTest 共用，必须与 engine 的 canStack 语义一致）：
  //   顶层未满 → 只列空槽（叠进本层空位，真实 Jenga 规则）；
  //   顶层已满 → canStack 说"三槽全合法（落位自动起新层）"、HUD 按钮与
  //     availableSlots 也都这么说，这里就必须同步给出「新层」的三个虚拟槽位。
  // ⚠ 旧实现顶层满时返回空数组：画布上零个落位点，玩家按 touchTip 提示点塔顶
  //   永远点空（只命中实体块 →「非法」toast），卡在 HOLDING 再抽全被 blocked——
  //   即「抽了一个就不能抽了」。第 2 章起全是手动选位关卡，抽底层端头（顶层仍满）
  //   必踩，实测第 7 关起 18 关全中招。
  // 虚拟槽位高度 = 上一层顶（layerIdx+1），朝向按新层索引 axisOfLayer 算；
  // ox/oz 取顶层偏移做近似（stackBlock 起新层时的随机漂移无法预知，只影响视觉微差）。
  function topLineBoxes(state, top) {
    const layerIdx = layerCount(state) - 1;
    const full = top.slots.every((id) => id != null);
    const layer = full ? layerIdx + 1 : layerIdx;
    const y = layer * BLOCK_H;
    const axisX = axisOfLayer(layer) === 0;
    const out = [];
    for (let slot = 0; slot < PER_LAYER; slot += 1) {
      if (!full && top.slots[slot] != null) continue;
      const off = slotOffset(slot);
      const cx = axisX ? (top.ox || 0) : off + (top.ox || 0);
      const cz = axisX ? off + (top.oz || 0) : (top.oz || 0);
      const hx = axisX ? BLOCK_L / 2 : BLOCK_W / 2;
      const hz = axisX ? BLOCK_W / 2 : BLOCK_L / 2;
      const corners = [
        [-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]
      ].map(([dx, dz]) => project(...tilt(state, cx + dx, y, cz + dz)));
      out.push({ slot, pts: corners, cx, cz, y });
    }
    return out;
  }

  function drawHeld(state, opts) {
    if (state.held == null) return null;
    const block = state.blocks[state.held];
    const topY = layerCount(state) * BLOCK_H + 1.05;
    const long = axisOfLayer(layerCount(state)) === 0;
    const hx = long ? BLOCK_W / 2 : BLOCK_L / 2;
    const hz = long ? BLOCK_L / 2 : BLOCK_W / 2;
    const bob = reduced ? 0 : Math.sin(performance.now?.() / 420 || 0) * 0.06;
    // 手里的块也按立方体画三个面，否则和塔上的块一眼就看得出"一个是片一个是块"
    const box = {
      x0: -hx, x1: hx, z0: -hz, z1: hz,
      yLow: topY + bob, yHigh: topY + bob + BLOCK_H,
      pos: [0, topY + bob + BLOCK_H / 2, 0],
      rot: false
    };
    const pts = cornersOf(box, state);
    const faces = visibleFaces(pts);
    drawPolygon(faces.sideA, rgb(WOOD.sideA, 1, 0.94), rgb(WOOD.edge, 0.5));
    drawPolygon(faces.sideB, rgb(WOOD.sideB, 1, 0.9), rgb(WOOD.edge, 0.5));
    drawPolygon(faces.top, rgb(WOOD.top, 1, 1.08), rgb(WOOD.edge, 0.55));
    drawSoftGlow(faces, 0.3, COLORS.glow);
    void block;
    void opts;
    return pts;
  }

  // ------------------------------------------------------------ 木屑微尘

  function spawnDust(state, danger, dt) {
    if (reduced) return;
    const rate = 2 + danger * 22;
    let budget = rate * dt;
    while (budget > 0) {
      if (Math.random() < Math.min(1, budget)) {
        const blocks = towerBlocks(state);
        const anchor = blocks.length ? blocks[Math.floor(Math.random() * blocks.length)] : null;
        const yBase = anchor ? anchor.py : BLOCK_H;
        dust.push({
          x: (Math.random() - 0.5) * PAD_HALF * 1.6,
          y: yBase * (0.35 + Math.random() * 0.65),
          z: (Math.random() - 0.5) * PAD_HALF * 1.6,
          vy: -0.25 - Math.random() * 0.5,
          drift: (Math.random() - 0.5) * 0.3,
          life: 1.6 + Math.random() * 1.8,
          age: 0,
          size: 1 + Math.random() * 2.2
        });
      }
      budget -= 1;
    }
    for (let i = dust.length - 1; i >= 0; i -= 1) {
      const p = dust[i];
      p.age += dt;
      p.y += p.vy * dt;
      p.x += p.drift * dt;
      if (p.y <= 0 || p.age > p.life) dust.splice(i, 1);
    }
    if (dust.length > 260) dust.splice(0, dust.length - 260);
  }

  function drawDust(state) {
    ctx.save();
    for (const p of dust) {
      const s = project(p.x, Math.max(0.02, p.y), p.z);
      const alpha = 0.5 * (1 - p.age / p.life);
      ctx.fillStyle = rgb(COLORS.dust, alpha.toFixed(3));
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.7, p.size * view.scale * 0.035), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    void state;
  }

  // ------------------------------------------------------------ 排序与绘制入口

  // 当前塔顶世界高度（手持块与塌落碎片不计入，避免取景乱跳）
  function towerHeight(state) {
    let top = layerCount(state) * BLOCK_H;
    for (const b of state.blocks) {
      if (b.inTower && b.py + BLOCK_H / 2 > top) top = b.py + BLOCK_H / 2;
    }
    return top;
  }

  // 自适应取景：塔越长高就缩得越小，18~27 层都不削顶、不出框；缩放平滑过渡。
  // 水平占地按塔垫椭圆算（横向半宽 R√2、竖向半宽 R√2·ISO_Y，与 yaw 无关），
  // 手持块另算 1.75 的顶部余量——否则抽出的块会顶出画布上沿。
  // 塌落/散落阶段改按碎屑包围盒取景：碎屑会铺开到 4 个块长，还按 18 层塔高取景的话
  // 左右直接顶出画布（旧实现 towerHeight 只数 inTower 块，塌落时它们全 false）。
  //
  // ⚠ 两个都踩过的坑：
  // 1) 这里量出来的必须是"相对锚点的偏移"。project() 带 cx/cy 偏移，直接拿它的返回值
  //    当偏移反解 scale，roomY 会算成 25/285 ≈ 0.09——整片碎屑缩成亚像素，画面全空。
  // 2) 碎屑是贴地的一片，屏幕竖直方向向下伸出 0.707R；塔式锚点贴在舞台下方
  //    （cy = h − 0.12h）只剩 38px 余量，按它取景同样把碎屑压成看不见。所以塌落阶段
  //    锚点上移到画面中部，上下都有余量（见 fitView 里的 cy 缓动）。
  function debrisExtent(state) {
    const r = BLOCK_L / 2; // 姿态吸附后最大半幅（躺平 x 向就是它）
    // project() 读的是 view.scale/zoom，先把它们按"单位缩放"量一遍再还原，
    // 否则拿到的极值反解不出目标 scale。锚点偏移当场减掉，与缩放/锚点无关。
    const s0 = view.scale;
    const z0 = view.zoom;
    view.scale = 1;
    view.zoom = 1;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const b of state.blocks) {
      if (b.inTower) continue;
      for (const sx of [-r, r]) {
        for (const sz of [-r, r]) {
          for (const sy of [-r, r]) {
            const p = project(b.px + sx, b.py + sy, b.pz + sz);
            const ox = p.x - view.cx;
            const oy = p.y - view.cy;
            if (ox < minX) minX = ox;
            if (ox > maxX) maxX = ox;
            if (oy < minY) minY = oy;
            if (oy > maxY) maxY = oy;
          }
        }
      }
    }
    view.scale = s0;
    view.zoom = z0;
    if (!Number.isFinite(minX)) return null;
    return { minX, maxX, minY, maxY };
  }

  function fitView(state, dt) {
    if (!ctx) return;
    let target;
    const debris = state.status === STATUS.COLLAPSE || state.status === STATUS.LOST
      ? debrisExtent(state)
      : null;
    // 塌落阶段把锚点从"舞台下方"缓动到"画面中部"：碎屑场是贴着地面的一整片，
    // 需要上下对称的余量；塔则向上生长，锚点必须贴在下方。切回非塌落状态时
    // 锚点再缓动回去（restart 后不会跳变）。
    const anchorWant = debris ? view.h * 0.52 : view.h - view.h * 0.12;
    const kc = reduced ? 1 : Math.min(1, dt * 5);
    view.cy += (anchorWant - view.cy) * kc;
    if (debris) {
      // 单位缩放的极值（相对锚点）⇒ 屏幕坐标 = 锚点 + 偏移·(scale·zoom)，反解 scale 时把 zoom 除掉。
      const z = view.zoom || 1;
      const ay = view.cy;
      const roomX = Math.min(
        (view.cx - view.w * 0.03) / Math.max(1e-6, -debris.minX),
        (view.w * 0.97 - view.cx) / Math.max(1e-6, debris.maxX)
      );
      const roomY = Math.min(
        (ay - view.h * 0.04) / Math.max(1e-6, -debris.minY),
        (view.h * 0.96 - ay) / Math.max(1e-6, debris.maxY)
      );
      target = Math.min(roomX, roomY) / z;
    } else {
      const towerH = towerHeight(state);
      const headroom = state.held != null ? 1.75 : 0.4;
      target = Math.min(
        (view.w * 0.94) / (FOOT_HW * 2 + 0.9),
        (view.cy - view.h * 0.035) / (towerH + FOOT_HH + headroom),
        (view.h - view.cy - view.h * 0.02) / (FOOT_HH + 0.3)
      );
    }
    const k = reduced ? 1 : Math.min(1, dt * 3.2);
    view.scale += (target - view.scale) * k;
    if (Math.abs(target - view.scale) < 0.02) view.scale = target;
  }

  function orderedBlocks(state) {
    const list = state.blocks.map((block) => {
      const box = blockBox(state, block);
      const pos = box ? box.pos : [block.px, block.py, block.pz];
      return { block, depth: cameraDepth(pos[0], pos[1], pos[2]), y: pos[1] };
    });
    // 层序优先，深度只做同层内的次序：相机在斜上方，高层永远更靠近视线、也永远
    // 盖在低层身上；纯深度键会被同层邻块的 x/z 差跨层反转（下层块盖上上层块，
    // 侧面被别块的顶面盖掉），塔身满布"面残缺"。z-buffer 逐像素实测：纯深度
    // 9.99% 错像素，层序优先 0%。塌落块的 py 是真实高度，同样按高度归位。
    list.sort((a, b) => (a.y - b.y) || (a.depth - b.depth));
    return list;
  }

  function draw(state, opts = {}) {
    if (!ctx) return;
    const dt = opts.dt ?? 1 / 60;
    const danger = Math.min(1, Math.max(0, opts.danger ?? state.danger ?? 0));
    ctx.clearRect(0, 0, view.w, view.h);

    // 判危微颤：频率与幅度随 danger 爬升（reduced-motion 下完全静止）
    let shakeX = 0;
    let shakeY = 0;
    if (!reduced && danger > 0.35) {
      shakePhase += dt * (4 + danger * 14);
      const amp = (danger - 0.35) * 3.4;
      shakeX = Math.sin(shakePhase * 2.3) * amp;
      shakeY = Math.cos(shakePhase * 1.7) * amp * 0.6;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    fitView(state, dt);
    drawPad(state);
    drawShadow(state);

    const ordered = orderedBlocks(state);
    for (const entry of ordered) {
      if (entry.block.inTower || state.status === STATUS.COLLAPSE || state.status === STATUS.LOST) {
        drawBlock(state, entry.block, opts);
      }
    }
    drawTopSlots(state, opts);
    drawHeld(state, opts);
    spawnDust(state, danger, dt);
    drawDust(state);
    ctx.restore();

    if (opts.spire && !reduced) drawSpireGlow();
    return { count: ordered.length, dust: dust.length };
  }

  function drawSpireGlow() {
    const grad = ctx.createRadialGradient(view.cx, view.cy - view.h * 0.3, view.w * 0.1, view.cx, view.cy - view.h * 0.2, view.w * 0.62);
    grad.addColorStop(0, rgb(COLORS.gold, 0.28));
    grad.addColorStop(1, rgb(COLORS.gold, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  // ------------------------------------------------------------ 命中测试

  function hitTest(px, py, state, opts = {}) {
    const point = { x: px, y: py };
    // 先看塔顶槽位（落位点在最上层之上，永远优先）
    const top = state.layers[layerCount(state) - 1];
    if (top && (state.status === STATUS.HOLDING || opts.alwaysSlots)) {
      for (const entry of topLineBoxes(state, top)) {
        if (pointInPolygon(point, entry.pts)) return { kind: "slot", slot: entry.slot };
      }
    }
    const ordered = orderedBlocks(state);
    for (let i = ordered.length - 1; i >= 0; i -= 1) {
      const block = ordered[i].block;
      if (!(block.inTower || state.status === STATUS.COLLAPSE || state.status === STATUS.LOST)) continue;
      const box = blockBox(state, block);
      if (!box) continue;
      const pts = cornersOf({ ...box, spinX: block.rx, spinZ: block.rz }, state);
      const faces = visibleFaces(pts);
      const hit = { kind: "block", layer: block.layer, slot: block.slot, id: block.id };
      if (pointInPolygon(point, faces.top)) return hit;
      if (pointInPolygon(point, faces.sideA) || pointInPolygon(point, faces.sideB)) return hit;
    }
    return null;
  }

  return {
    resize,
    setReduced(value) {
      reduced = Boolean(value);
    },
    rotate(delta) {
      view.yaw += delta;
      if (view.yaw > Math.PI * 2) view.yaw -= Math.PI * 2;
      if (view.yaw < 0) view.yaw += Math.PI * 2;
    },
    zoomBy(factor) {
      view.zoom = Math.min(1.9, Math.max(0.62, view.zoom * factor));
    },
    setYaw(value) {
      view.yaw = ((value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    },
    getView: () => ({ yaw: view.yaw, zoom: view.zoom, scale: view.scale, w: view.w, h: view.h }),
    getTiltDeg: (state) => (tiltOf(state) * 180) / Math.PI,
    clearDust: () => {
      dust.length = 0;
    },
    draw,
    hitTest,
    project: (x, y, z) => project(x, y, z)
  };
}
