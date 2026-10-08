// 推币机 · 玻璃观察窗物理舞台（唯一 Canvas 绘制层）
// 斜俯视 2.5D：引擎仍是俯视 2D（物理与坐标完全不变），渲染层只做「倾斜投影 + 圆柱厚度 + 画家算法遮挡」，
// 让金币堆有体积、推板是实体金属块、两侧是玻璃壁、前方有出币唇口与落币托盘。
// 纯几何换算（computeViewport / worldToScreen / screenToWorld / depthScale）不碰 DOM，可在 Node 直接单测。

import {
  FIELD_W, FIELD_H, PUSHER_EXTEND, TIP_ZONE, CARD_W, CARD_H, LAUNCHER_R, MAGNET_R,
  GUTTER, CHUTE_X, CHUTE_Y0, COIN_R, PEG_Y0, PEG_ROW_GAP
} from "./engine.mjs";

/* ============================================================ 投影参数 */

// 俯角 ≈ 38°：地面纵深压缩 = sin(俯角)，立面竖直压缩 = cos(俯角)
export const TILT = 0.62;
export const VERT = Math.sqrt(1 - TILT * TILT);
// 近大远小强度（0 = 纯斜投影，越大透视越强）
export const PERSP = 0.24;

// 各类物体的可见厚度（厚度 / 直径）。真实街机代币 t/d ≈ 0.06，
// 取 0.13 是「像真代币」与「堆叠时看得出体积」之间的折中。
export const COIN_THICK = 0.13;
export const TOWER_THICK = 0.44;
export const CARD_THICK = 0.24;
export const CARD_LIFT = 0.18;   // 奖励卡搭在币面上，略微抬高（纯观感）

// 立面高度（世界单位）
export const BACK_H = 2.35;   // 后墙
export const WALL_H = 2.05;   // 侧壁玻璃
export const PLATE_H = 1.45;  // 推板前立面
export const PLATE_DEPTH = 0.9; // 推板自身厚度（板后是后撤的机械舱）
export const LIP_H = 0.62;    // 出币唇口立面
export const DROP_H = 2.30;   // 唇口之下的落币竖井：币在这里竖直坠落到托盘
export const TRAY_H = 1.00;   // 托盘立面
export const STACK_MAX = 0.30; // 叠币视觉抬升上限（世界单位，纯观感，不进物理）
export const CHUTE_LIFT = 2.10; // 机顶投币口离台面的高度（纯视觉，决定飞行币的抬升曲线）
export const RAIL_H = 0.30;     // 两侧低挡边高度（沟槽内沿）
export const HEAD_H = 1.15;     // 机头面板立面高度（投币口开在这块板上，真机台的投币口在机顶面板）
export const PIN_LEN = 0.55;    // 遮挡杆「横梁 → 杆心」的长度：短杆 + 抛光球头，不是长吊线

// 通道内币「离台面高度」比例：由世界 y 反推，与物理无关，纯观感。
// 挡杆阵也按同一条曲线抬升——币与杆共用一条高度曲线，杆才真的"挡在币的必经之路上"。
// t=0 在投币口（最高），t=1 已落到台面。
export function dropHeightRatio(y) {
  const span = PUSHER_EXTEND + COIN_R - CHUTE_Y0;
  if (!(span > 0)) return 0;
  const t = (y - CHUTE_Y0) / span;
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return (1 - c) * (1 - c);
}

// 世界视窗：y0 之上留给后墙与机顶投币结构，FIELD_H 之下留给唇口 / 落币竖井 / 托盘。
// 竖向刻意留得比横向更宽裕（投影后 ≈ 1.13 的横向比例），画面才不显得扁趴。
export const VIEW = { x0: 0, y0: -4.6, x1: FIELD_W, y1: FIELD_H + 5.2 };
export const VIEW_W = VIEW.x1 - VIEW.x0;
export const VIEW_H = VIEW.y1 - VIEW.y0;

const TABLE_BACK = 0;          // 台面后缘（世界 y）
const CENTER_X = FIELD_W / 2;

// 近大远小：y 越大（越靠近观众）越大
export function depthScale(y) {
  const t = (y - VIEW.y0) / VIEW_H;
  return 1 + PERSP * (t - 0.5);
}

// 投影后的包围盒（用于等比适配）
export function projectedBounds() {
  return { w: VIEW_W * depthScale(VIEW.y1), h: VIEW_H * TILT };
}

// 等比适配并居中：返回 CSS 像素下的缩放与留白
export function computeViewport(cssW, cssH) {
  const bounds = projectedBounds();
  const w = Number.isFinite(cssW) && cssW > 0 ? cssW : bounds.w;
  const h = Number.isFinite(cssH) && cssH > 0 ? cssH : bounds.h;
  const scale = Math.min(w / bounds.w, h / bounds.h);
  return {
    scale,
    ox: (w - bounds.w * scale) / 2,
    oy: (h - bounds.h * scale) / 2,
    width: w,
    height: h,
    boundsW: bounds.w,
    boundsH: bounds.h
  };
}

// 世界（俯视 2D）→ 屏幕（斜俯视）
export function worldToScreen(view, x, y) {
  const k = depthScale(y);
  return {
    x: view.width / 2 + (x - CENTER_X) * view.scale * k,
    y: view.oy + (y - VIEW.y0) * view.scale * TILT,
    k
  };
}

// 屏幕 → 世界（worldToScreen 的精确逆）
export function screenToWorld(view, px, py) {
  const y = (py - view.oy) / (view.scale * TILT) + VIEW.y0;
  const k = depthScale(y);
  return { x: (px - view.width / 2) / (view.scale * k) + CENTER_X, y };
}

// 屏幕纵横比（CSS 侧 aspect-ratio 应与之一致）
export function viewAspect() {
  const b = projectedBounds();
  return b.w / b.h;
}

/* ============================================================ 精灵 */

// 真实街机代币（メダル）的视觉特征：黄铜/抛光金属盘面，一圈凸起的边圈，
// 边圈内侧一圈「点珠」（bead ring），中央一个浮雕凸台，侧壁是细密滚花齿边，
// 整枚币上有两道斜向镜面扫光 —— 金属感来自「高光带 + 台阶明暗」，不是来自饱和度。
const SKINS = {
  // 普通币：拉丝黄铜代币，无字，靠造型区分
  norm: {
    hi: "#fff6d6", mid: "#d8b25a", lo: "#8d6820", rim: "#3f2a06",
    rimTop: "#c9a24c", edge: "#eccd86", ring: "#f6e2ae", ink: "#5a3c07",
    glyph: "", beads: true, sweep: 0.42
  },
  // 黄金币：抛光黄铜 + 五角星浮雕
  gold: {
    hi: "#fffdf2", mid: "#f3ca4e", lo: "#a87a09", rim: "#573a02",
    rimTop: "#e8b93c", edge: "#ffe9a0", ring: "#fff5cd", ink: "#6a4503",
    glyph: "★", beads: true, sweep: 0.5
  },
  // 宝石币：蓝钢镀层代币 + 菱形浮雕
  gem: {
    hi: "#f3feff", mid: "#7ed6ef", lo: "#1a6ea6", rim: "#07324f",
    rimTop: "#5cbde0", edge: "#c6f2ff", ring: "#dcf8ff", ink: "#0b4d7d",
    glyph: "◆", beads: true, sweep: 0.46
  }
};

function sprite(w, h, paint) {
  const el = document.createElement("canvas");
  el.width = Math.max(2, Math.round(w));
  el.height = Math.max(2, Math.round(h));
  paint(el.getContext("2d"), el.width, el.height);
  return el;
}

// 圆柱侧面路径：顶面椭圆下半弧 → 下移 th → 底面椭圆下半弧回程
function cylinderWall(g, cx, topY, botY, rx, ry) {
  g.beginPath();
  g.ellipse(cx, topY, rx, ry, 0, 0, Math.PI);
  g.lineTo(cx - rx, botY);
  g.ellipse(cx, botY, rx, ry, 0, Math.PI, 0, true);
  g.closePath();
}

// 圆角矩形路径（不依赖 ctx.roundRect，保证任何浏览器都能画）
function roundRectPath(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

// 圆盘状精灵（金币 / 金塔通用）。返回的精灵里，底面椭圆圆心位于 (W/2, H - ry)。
// 画法严格按真实代币的层次来：滚花齿边 → 凸起边圈 → 凹下去的中心场（拉丝）→
// 台阶明暗 → 点珠圈 → 中央浮雕 → 斜向镜面扫光 → 主高光。
function discSprite(skin, thick, options = {}) {
  const rx = 128;
  const ry = rx * TILT;
  const th = 2 * rx * thick * VERT;
  const W = rx * 2;
  const H = ry * 2 + th;
  return sprite(W, H, (g) => {
    const cx = rx;
    const topY = ry;
    const botY = ry + th;

    // ---- 圆柱壁：滚花齿边 ----
    cylinderWall(g, cx, topY, botY, rx, ry);
    const wall = g.createLinearGradient(0, topY, 0, botY + ry);
    wall.addColorStop(0, skin.edge);
    wall.addColorStop(0.26, skin.mid);
    wall.addColorStop(0.62, skin.lo);
    wall.addColorStop(0.9, skin.rim);
    wall.addColorStop(1, "#1b1102");
    g.fillStyle = wall;
    g.fill();

    g.save();
    g.clip();
    // 细密竖齿：每三齿一道亮齿，读成滚花而不是光滑圆环
    const pitch = rx * 0.062;
    for (let i = -rx; i <= rx; i += pitch) {
      const bright = Math.abs(Math.round(i / pitch)) % 3 === 0;
      g.strokeStyle = bright ? "rgba(255,246,214,0.3)" : "rgba(38,22,2,0.26)";
      g.lineWidth = Math.max(1, rx * (bright ? 0.014 : 0.01));
      g.beginPath();
      g.moveTo(cx + i, topY);
      g.lineTo(cx + i, botY + ry);
      g.stroke();
    }
    // 柱面纵向明暗（上受光、下沉入影）——金属圆柱的体积感
    const sheen = g.createLinearGradient(0, topY, 0, botY);
    sheen.addColorStop(0, "rgba(255,255,255,0.26)");
    sheen.addColorStop(0.36, "rgba(255,255,255,0)");
    sheen.addColorStop(1, "rgba(0,0,0,0.36)");
    g.fillStyle = sheen;
    g.fillRect(0, topY, W, botY - topY + ry);
    g.restore();

    // 底面暗边
    g.beginPath();
    g.ellipse(cx, botY, rx * 0.99, ry, 0, 0, Math.PI);
    g.strokeStyle = "rgba(20,10,0,0.55)";
    g.lineWidth = Math.max(1, rx * 0.03);
    g.stroke();

    // ---- 顶面（在压扁坐标系里画圆）----
    g.save();
    g.translate(cx, topY);
    g.scale(1, TILT);

    // 外圈凸起边圈：整圆先铺边圈金属，再用「凹下去的中心场」盖掉中间
    const rimGrad = g.createLinearGradient(-rx * 0.7, -rx * 0.7, rx * 0.7, rx * 0.7);
    rimGrad.addColorStop(0, "#fff4cf");
    rimGrad.addColorStop(0.42, skin.rimTop);
    rimGrad.addColorStop(1, "#5a3d0c");
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fillStyle = rimGrad;
    g.fill();

    // 中心场（比边圈略低一台阶）
    const field = g.createRadialGradient(-rx * 0.34, -rx * 0.38, rx * 0.05, 0, 0, rx * 0.82);
    field.addColorStop(0, skin.hi);
    field.addColorStop(0.48, skin.mid);
    field.addColorStop(1, skin.lo);
    g.beginPath();
    g.arc(0, 0, rx * 0.8, 0, Math.PI * 2);
    g.fillStyle = field;
    g.fill();

    // 拉丝纹：细密放射状明暗，金属面不是一块死色
    g.save();
    g.beginPath();
    g.arc(0, 0, rx * 0.8, 0, Math.PI * 2);
    g.clip();
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      g.strokeStyle = i % 2 === 0 ? "rgba(255,250,228,0.055)" : "rgba(60,38,4,0.055)";
      g.lineWidth = rx * 0.012;
      g.beginPath();
      g.moveTo(Math.cos(a) * rx * 0.16, Math.sin(a) * rx * 0.16);
      g.lineTo(Math.cos(a) * rx * 0.8, Math.sin(a) * rx * 0.8);
      g.stroke();
    }
    g.restore();

    // 台阶明暗：光从左上来 → 内侧右下方落影、内侧左上方受光
    g.beginPath();
    g.arc(rx * 0.018, rx * 0.022, rx * 0.8, 0, Math.PI * 2);
    g.strokeStyle = "rgba(46,28,2,0.42)";
    g.lineWidth = rx * 0.05;
    g.stroke();
    g.beginPath();
    g.arc(-rx * 0.012, -rx * 0.016, rx * 0.8, 0, Math.PI * 2);
    g.strokeStyle = "rgba(255,250,226,0.34)";
    g.lineWidth = rx * 0.022;
    g.stroke();

    // 边圈外缘：暗边 + 左上受光弧
    g.beginPath();
    g.arc(0, 0, rx * 0.99, 0, Math.PI * 2);
    g.strokeStyle = skin.rim;
    g.lineWidth = rx * 0.03;
    g.stroke();
    g.beginPath();
    g.arc(0, 0, rx * 0.985, Math.PI * 0.72, Math.PI * 1.78);
    g.strokeStyle = "rgba(255,252,238,0.6)";
    g.lineWidth = rx * 0.03;
    g.stroke();

    // 点珠圈：街机代币的招牌，一圈小圆珠
    if (skin.beads) {
      const N = 34;
      const br = rx * 0.052;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const bx = Math.cos(a) * rx * 0.62;
        const by = Math.sin(a) * rx * 0.62;
        g.beginPath();
        g.arc(bx, by, br, 0, Math.PI * 2);
        g.fillStyle = "rgba(60,38,4,0.5)";
        g.fill();
        g.beginPath();
        g.arc(bx - br * 0.28, by - br * 0.3, br * 0.66, 0, Math.PI * 2);
        g.fillStyle = "rgba(255,248,220,0.8)";
        g.fill();
      }
    }

    // 中央浮雕凸台
    const boss = g.createRadialGradient(-rx * 0.1, -rx * 0.12, rx * 0.02, 0, 0, rx * 0.3);
    boss.addColorStop(0, skin.hi);
    boss.addColorStop(0.55, skin.rimTop);
    boss.addColorStop(1, skin.lo);
    g.beginPath();
    g.arc(0, 0, rx * 0.3, 0, Math.PI * 2);
    g.fillStyle = boss;
    g.fill();
    g.strokeStyle = "rgba(48,30,2,0.5)";
    g.lineWidth = rx * 0.024;
    g.stroke();
    g.beginPath();
    g.arc(-rx * 0.008, -rx * 0.01, rx * 0.3, Math.PI * 0.8, Math.PI * 1.9);
    g.strokeStyle = "rgba(255,250,228,0.5)";
    g.lineWidth = rx * 0.016;
    g.stroke();

    // 环形凸起（金塔用）
    if (options.rings) {
      for (const k of [0.74, 0.5]) {
        g.beginPath();
        g.arc(0, 0, rx * k, 0, Math.PI * 2);
        g.lineWidth = rx * 0.034;
        g.strokeStyle = "rgba(120,74,4,0.62)";
        g.stroke();
        g.beginPath();
        g.arc(-rx * 0.04, -rx * 0.045, rx * k * 0.94, 0, Math.PI * 2);
        g.lineWidth = rx * 0.015;
        g.strokeStyle = "rgba(255,246,200,0.7)";
        g.stroke();
      }
    }

    if (skin.glyph) {
      g.fillStyle = skin.ink;
      g.font = `800 ${Math.round(rx * 0.34)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(skin.glyph, 0, rx * 0.012);
    }

    // 斜向镜面扫光：两道平行亮带。金属之所以像金属，靠的就是这一条条反射光带。
    g.save();
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.clip();
    const sweep = g.createLinearGradient(-rx, -rx, rx, rx);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.28, "rgba(255,255,255,0)");
    sweep.addColorStop(0.4, `rgba(255,255,255,${skin.sweep * 0.36})`);
    sweep.addColorStop(0.5, "rgba(255,255,255,0)");
    sweep.addColorStop(0.6, "rgba(255,255,255,0)");
    sweep.addColorStop(0.66, `rgba(255,255,255,${skin.sweep * 0.72})`);
    sweep.addColorStop(0.72, "rgba(255,255,255,0)");
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sweep;
    g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();

    // 左上主高光
    g.beginPath();
    g.ellipse(-rx * 0.34, -rx * 0.4, rx * 0.32, rx * 0.17, -0.62, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.44)";
    g.fill();
    g.restore();
  });
}

// 薄板精灵（奖励卡）：顶面圆角矩形 + 可见厚度
function cardSprite(effect) {
  const palette = effect === "double"
    ? ["#ffe08a", "#e0a018", "#8a5a04"]
    : effect === "speed"
      ? ["#a6f6dc", "#18a37c", "#0a5a44"]
      : ["#b6dcff", "#2b7fd4", "#123f78"];
  const HW = 116;
  const HD = HW * (CARD_H / CARD_W) * TILT;
  const th = 2 * HW * CARD_THICK * VERT;
  const W = HW * 2;
  const H = HD * 2 + th;
  return sprite(W, H, (g) => {
    const cx = HW;
    const topY = HD;
    const botY = HD + th;
    const r = Math.min(HD, HW) * 0.7;
    const round = (yy) => {
      g.beginPath();
      g.moveTo(cx - HW + r, yy - HD);
      g.lineTo(cx + HW - r, yy - HD);
      g.quadraticCurveTo(cx + HW, yy - HD, cx + HW, yy - HD + r);
      g.lineTo(cx + HW, yy + HD - r);
      g.quadraticCurveTo(cx + HW, yy + HD, cx + HW - r, yy + HD);
      g.lineTo(cx - HW + r, yy + HD);
      g.quadraticCurveTo(cx - HW, yy + HD, cx - HW, yy + HD - r);
      g.lineTo(cx - HW, yy - HD + r);
      g.quadraticCurveTo(cx - HW, yy - HD, cx - HW + r, yy - HD);
      g.closePath();
    };
    // 侧面（先画底面，顶面盖住上半，只露下半条厚度）
    round(botY);
    g.fillStyle = palette[2];
    g.fill();
    // 顶面
    round(topY);
    const grad = g.createLinearGradient(cx - HW, topY - HD, cx + HW, topY + HD);
    grad.addColorStop(0, palette[0]);
    grad.addColorStop(1, palette[1]);
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = Math.max(1.5, HW * 0.035);
    g.strokeStyle = "rgba(255,255,255,0.72)";
    g.stroke();
    // 卡面标记
    g.save();
    g.translate(cx, topY);
    g.scale(1, TILT);
    g.fillStyle = palette[2];
    g.font = `800 ${Math.round(HW * 0.42)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(effect === "double" ? "×2" : effect === "speed" ? "»" : "◎", 0, 0);
    g.restore();
  });
}

/* ============================================================ 渲染器 */

const MAX_PARTICLES = 240;

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  let dpr = 1;
  let view = computeViewport(0, 0);
  let reduced = false;
  let clock = 0;
  let shake = 0;
  let flash = 0;
  let flashColor = "255,225,150";
  let railGlow = 0;
  let sprites = null;
  const particles = [];
  const falling = [];
  const splashes = [];   // 币磕进托盘那一下的飞溅（屏幕空间，不属于台面世界）
  let pegCount = 0;
  let trayFloorPx = 0;   // 托盘盘底在屏幕上的 y（只读诊断出口用）

  function ensureSprites() {
    if (sprites) return sprites;
    sprites = {
      norm: discSprite(SKINS.norm, COIN_THICK),
      gold: discSprite(SKINS.gold, COIN_THICK),
      gem: discSprite(SKINS.gem, COIN_THICK),
      tower: discSprite(SKINS.gold, TOWER_THICK, { rings: true }),
      cardDouble: cardSprite("double"),
      cardSpeed: cardSprite("speed"),
      cardMagnet: cardSprite("magnet")
    };
    return sprites;
  }

  function resize() {
    const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
    const cssW = Math.max(180, Math.round(rect && rect.width ? rect.width : canvas.clientWidth || 640));
    const cssH = Math.max(180, Math.round(rect && rect.height ? rect.height : canvas.clientHeight || 640));
    dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    view = computeViewport(cssW, cssH);
    return view;
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(view, clientX - rect.left, clientY - rect.top);
  }

  // 世界 → 画布 CSS 像素（供只读诊断出口使用，与真实绘制共用同一套投影）
  function toScreen(x, y) {
    const p = worldToScreen(view, x, y);
    return { x: p.x, y: p.y, k: p.k };
  }

  function addParticles(x, y, count, color, speed = 2.6) {
    // reduced 下碎片减量（动效降级），但绝不取消：取消会让落币毫无反馈。
    const n = reduced ? Math.max(1, Math.ceil(count * 0.4)) : count;
    for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const v = speed * (0.45 + Math.random() * 0.85);
      particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 1.1,
        life: 0, max: 0.5 + Math.random() * 0.6,
        size: 0.09 + Math.random() * 0.14,
        color
      });
    }
  }

  // ---- 引擎事件 → 视觉反馈 ----
  // 注意：得分数字一律不进画布（用户要求「不要堆积在画面上」），
  // 掉落分数由 ui.mjs 落到侧栏「掉落记录」，画布只负责物理与光影。
  function noteEvent(ev) {
    if (!ev) return;
    if (ev.type === "drop") {
      const kind = ev.kind || "norm";
      const color = kind === "gem" ? "150,225,255" : kind === "gold" ? "255,216,120" : "255,236,170";
      falling.push({
        x: ev.x ?? FIELD_W / 2,
        drop: 0,
        vy: 1.1,
        life: 0,
        spin: ((ev.x ?? 0) * 7.31 + (ev.mult || 1) * 0.37) % (Math.PI * 2),
        kind
      });
      addParticles(ev.x ?? FIELD_W / 2, FIELD_H - 0.2, Math.min(16, 3 + ev.cascade), color, 2.2);
      shake = Math.min(1, shake + (ev.mult > 32 ? 0.6 : 0.16));
    } else if (ev.type === "lost_coin") {
      addParticles(ev.x ?? 0, FIELD_H - 0.3, 5, "150,160,190", 1.6);
    } else if (ev.type === "jackpot") {
      shake = 1;
      flash = 1;
      flashColor = "255,214,110";
      for (let i = 0; i < 4; i++) addParticles(FIELD_W * (0.2 + i * 0.2), FIELD_H - 0.4, 22, "255,206,90", 4.4);
    } else if (ev.type === "tower_down") {
      shake = 1;
      flash = 0.85;
      flashColor = "255,238,170";
      addParticles(FIELD_W / 2, FIELD_H / 2, 60, "255,214,120", 5.2);
    } else if (ev.type === "card") {
      addParticles(ev.x ?? FIELD_W / 2, ev.y ?? FIELD_H - 1, 14, "190,240,255", 2.4);
      shake = Math.min(1, shake + 0.22);
    } else if (ev.type === "launch") {
      addParticles(ev.coinX ?? ev.x ?? FIELD_W / 2, ev.coinY ?? FIELD_H / 2, 18, "255,236,190", 3.6);
    } else if (ev.type === "token_spawn") {
      addParticles(ev.x ?? FIELD_W / 2, ev.y ?? FIELD_H / 2, 12, "255,226,170", 2.4);
    } else if (ev.type === "cascade_end") {
      railGlow = 1;
    } else if (ev.type === "won") {
      flash = 0.7;
      flashColor = "180,255,210";
    }
  }

  function setReduced(value) {
    reduced = Boolean(value);
    return reduced;
  }

  function updateEffects(dt) {
    // 计时一律走真实 dt。这里曾经写成 `const d = reduced ? 0 : dt`，把「计时」和「位移」一起冻住，
    // 在 prefers-reduced-motion: reduce 的机器上炸出三个可见缺陷：
    //   ① flash 停在 1 永不衰减 → 整屏永久蒙一层 rgba(255,214,110,0.35) 暖色，画面全被冲淡；
    //   ② 粒子寿命停在 0 且不再位移 → 每次落币在台面前缘撒出的黄色圆点永不消失（「边缘黄色圆形残留」）；
    //   ③ falling 被整段清空 → 玩家看不到任何掉落反馈（「金币掉下去没有看见掉落效果」）。
    // 正确口径：计时永远推进，只降级「大幅位移」（屏幕抖动、横向摆动、飞溅）。
    clock += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 2.2);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
    if (railGlow > 0) railGlow = Math.max(0, railGlow - dt * 0.8);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 6.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt;
    }

    // 坠落是核心反馈（「币真的掉下去了」），reduced 下也必须在画面里看得见——
    // 只去掉落盘飞溅，保留竖直坠落本身。
    for (let i = falling.length - 1; i >= 0; i--) {
      const c = falling[i];
      c.life += dt;
      c.drop += c.vy * dt;
      c.vy += 11 * dt;
      c.spin += dt * 9;
      // 币磕进托盘的那一刻：起一圈飞溅（只在真的落到盘上时触发一次）
      if (!c.landed && c.drop >= DROP_H + TRAY_H * 0.5) {
        c.landed = true;
        if (!reduced) splashes.push({ x: c.x, t: 0, kind: c.kind });
        shake = Math.min(1, shake + 0.07);
      }
      if (c.drop > DROP_H + TRAY_H + 0.5 || c.life > 3) falling.splice(i, 1);
    }
    for (let i = splashes.length - 1; i >= 0; i--) {
      splashes[i].t += dt;
      if (splashes[i].t > 0.62) splashes.splice(i, 1);
    }
  }

  /* ---------------------------------------------------- 投影辅助 */

  const P = (x, y) => worldToScreen(view, x, y);
  // 立面：同一 (x, y) 上抬 h 个世界单位
  const lift = (h) => h * VERT * view.scale;

  /* ---------------------------------------------------- 机箱内壁 */

  function drawCabinet() {
    const left = P(VIEW.x0, 0).x;
    const right = P(VIEW.x1, 0).x;
    const backTop = P(0, TABLE_BACK).y - lift(BACK_H);
    const lipY = P(0, FIELD_H).y;
    const bottomY = lipY + lift(LIP_H + DROP_H + TRAY_H);

    // 机箱内腔底
    const box = ctx.createLinearGradient(0, backTop, 0, bottomY);
    box.addColorStop(0, "#0b1020");
    box.addColorStop(0.5, "#131a2e");
    box.addColorStop(1, "#080c17");
    ctx.fillStyle = box;
    ctx.fillRect(0, 0, view.width, view.height);

    /* ---- 后墙（竖直面板）---- */
    const wallL = P(VIEW.x0, TABLE_BACK).x;
    const wallR = P(VIEW.x1, TABLE_BACK).x;
    const wallBase = P(0, TABLE_BACK).y;
    const wall = ctx.createLinearGradient(0, backTop, 0, wallBase);
    wall.addColorStop(0, "#1b2338");
    wall.addColorStop(0.55, "#273049");
    wall.addColorStop(1, "#3a4666");
    ctx.fillStyle = wall;
    ctx.fillRect(wallL, backTop, wallR - wallL, wallBase - backTop);
    // 后墙竖向压纹
    ctx.save();
    ctx.beginPath();
    ctx.rect(wallL, backTop, wallR - wallL, wallBase - backTop);
    ctx.clip();
    for (let x = 0; x <= FIELD_W; x += 1) {
      const px = P(x, TABLE_BACK).x;
      ctx.strokeStyle = "rgba(150,180,240,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, backTop);
      ctx.lineTo(px, wallBase);
      ctx.stroke();
    }
    ctx.restore();
    // 后墙顶沿霓虹
    const glow = 0.55 + 0.25 * Math.sin(clock * 3) + railGlow * 0.4;
    ctx.shadowColor = "rgba(255,190,90,0.9)";
    ctx.shadowBlur = 18 * glow;
    ctx.strokeStyle = `rgba(255,206,120,${Math.min(1, 0.62 + railGlow * 0.35)})`;
    ctx.lineWidth = Math.max(2, view.scale * 0.055);
    ctx.beginPath();
    ctx.moveTo(wallL, backTop);
    ctx.lineTo(wallR, backTop);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 后墙下沿金属压条（墙脚）
    const foot = ctx.createLinearGradient(0, wallBase - lift(0.28), 0, wallBase);
    foot.addColorStop(0, "#5a6b90");
    foot.addColorStop(1, "#1a2134");
    ctx.fillStyle = foot;
    ctx.fillRect(wallL, wallBase - lift(0.28), wallR - wallL, lift(0.28));

    /* ---- 台面（地面）---- */
    const floorTop = wallBase;
    const floorBottom = lipY;
    const fTL = P(VIEW.x0, TABLE_BACK).x;
    const fTR = P(VIEW.x1, TABLE_BACK).x;
    const fBL = P(VIEW.x0, FIELD_H).x;
    const fBR = P(VIEW.x1, FIELD_H).x;
    const floor = ctx.createLinearGradient(0, floorTop, 0, floorBottom);
    floor.addColorStop(0, "#070b15");
    floor.addColorStop(0.3, "#0d1425");
    floor.addColorStop(1, "#17223d");
    ctx.beginPath();
    ctx.moveTo(fTL, floorTop);
    ctx.lineTo(fTR, floorTop);
    ctx.lineTo(fBR, floorBottom);
    ctx.lineTo(fBL, floorBottom);
    ctx.closePath();
    ctx.fillStyle = floor;
    ctx.fill();
    // 后墙与台面的接缝暗线（把墙和地分开）
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = Math.max(2, view.scale * 0.07);
    ctx.beginPath();
    ctx.moveTo(fTL, floorTop);
    ctx.lineTo(fTR, floorTop);
    ctx.stroke();
    // 台面纵向导轨（透视收敛）
    ctx.save();
    ctx.clip();
    for (let x = 0.5; x < FIELD_W; x += 1) {
      const a = P(x, TABLE_BACK);
      const b = P(x, FIELD_H);
      ctx.strokeStyle = "rgba(130,175,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // 台面横向暗纹
    for (let y = 1; y <= FIELD_H; y += 1) {
      const a = P(VIEW.x0, y);
      const b = P(VIEW.x1, y);
      ctx.strokeStyle = "rgba(130,175,255,0.028)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // 悬垂预警带
    const tA = P(VIEW.x0, FIELD_H - TIP_ZONE);
    const tB = P(VIEW.x1, FIELD_H);
    const tip = ctx.createLinearGradient(0, tA.y, 0, tB.y);
    tip.addColorStop(0, "rgba(255,170,80,0)");
    tip.addColorStop(1, "rgba(255,150,60,0.24)");
    ctx.beginPath();
    ctx.moveTo(tA.x, tA.y);
    ctx.lineTo(P(VIEW.x1, FIELD_H - TIP_ZONE).x, tA.y);
    ctx.lineTo(tB.x, tB.y);
    ctx.lineTo(tA.x, tB.y);
    ctx.closePath();
    ctx.fillStyle = tip;
    ctx.fill();
    ctx.restore();

    /* ---- 两侧丢币沟槽（内沿低挡边 + 外侧下沉侧仓）---- */
    // 真实机台的「输」几乎全部发生在这里：币被推板挤过挡边，落进侧仓就没了。
    for (const side of [-1, 1]) {
      const railX = side < 0 ? GUTTER : FIELD_W - GUTTER;
      const outX = side < 0 ? VIEW.x0 : VIEW.x1;
      const gA = P(railX, TABLE_BACK);
      const gB = P(railX, FIELD_H);
      const oA = P(outX, TABLE_BACK);
      const oB = P(outX, FIELD_H);
      ctx.beginPath();
      ctx.moveTo(gA.x, gA.y);
      ctx.lineTo(oA.x, oA.y);
      ctx.lineTo(oB.x, oB.y);
      ctx.lineTo(gB.x, gB.y);
      ctx.closePath();
      const gut = ctx.createLinearGradient(gA.x, 0, oA.x, 0);
      gut.addColorStop(0, "#0a0f1c");
      gut.addColorStop(1, "#010307");
      ctx.fillStyle = gut;
      ctx.fill();

      const railTop = gA.y - lift(RAIL_H);
      const railTopB = gB.y - lift(RAIL_H);
      ctx.beginPath();
      ctx.moveTo(gA.x, railTop);
      ctx.lineTo(gB.x, railTopB);
      ctx.lineTo(gB.x, gB.y);
      ctx.lineTo(gA.x, gA.y);
      ctx.closePath();
      const railGrad = ctx.createLinearGradient(0, railTop, 0, gB.y);
      railGrad.addColorStop(0, "#93a6ca");
      railGrad.addColorStop(0.35, "#4a5878");
      railGrad.addColorStop(1, "#1b2236");
      ctx.fillStyle = railGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(226,238,255,0.5)";
      ctx.lineWidth = Math.max(1, view.scale * 0.032);
      ctx.beginPath();
      ctx.moveTo(gA.x, railTop);
      ctx.lineTo(gB.x, railTopB);
      ctx.stroke();
    }

    /* ---- 两侧玻璃壁 ---- */
    for (const side of [-1, 1]) {
      const wx = side < 0 ? VIEW.x0 : VIEW.x1;
      const baseA = P(wx, TABLE_BACK);
      const baseB = P(wx, FIELD_H);
      const topA = baseA.y - lift(WALL_H);
      const topB = baseB.y - lift(WALL_H);
      ctx.beginPath();
      ctx.moveTo(baseA.x, topA);
      ctx.lineTo(baseB.x, topB);
      ctx.lineTo(baseB.x, baseB.y);
      ctx.lineTo(baseA.x, baseA.y);
      ctx.closePath();
      const glass = ctx.createLinearGradient(baseA.x, topA, baseA.x + side * view.scale * 0.9, baseB.y);
      glass.addColorStop(0, "rgba(190,225,255,0.30)");
      glass.addColorStop(0.45, "rgba(140,190,255,0.10)");
      glass.addColorStop(1, "rgba(90,140,220,0.22)");
      ctx.fillStyle = glass;
      ctx.fill();
      ctx.strokeStyle = "rgba(215,238,255,0.5)";
      ctx.lineWidth = Math.max(1.4, view.scale * 0.05);
      ctx.beginPath();
      ctx.moveTo(baseA.x, topA);
      ctx.lineTo(baseB.x, topB);
      ctx.stroke();
    }

    /* ---- 前唇口 + 落币竖井 + 托盘 ---- */
    const lipFrontTop = P(VIEW.x0, FIELD_H);
    const lipRight = P(VIEW.x1, FIELD_H).x;
    const lipWidth = lipRight - lipFrontTop.x;
    const lipBot = lipY + lift(LIP_H);
    // 唇口立面
    const lipGrad = ctx.createLinearGradient(0, lipY, 0, lipBot);
    lipGrad.addColorStop(0, "#f2d79a");
    lipGrad.addColorStop(0.18, "#c79a45");
    lipGrad.addColorStop(0.7, "#5c4320");
    lipGrad.addColorStop(1, "#2a1d0c");
    ctx.beginPath();
    ctx.moveTo(lipFrontTop.x, lipY);
    ctx.lineTo(lipRight, lipY);
    ctx.lineTo(lipRight, lipBot);
    ctx.lineTo(lipFrontTop.x, lipBot);
    ctx.closePath();
    ctx.fillStyle = lipGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,236,180,0.85)";
    ctx.lineWidth = Math.max(1.5, view.scale * 0.045);
    ctx.beginPath();
    ctx.moveTo(lipFrontTop.x, lipY);
    ctx.lineTo(lipRight, lipY);
    ctx.stroke();

    /* ---- 落币竖井：币越过唇口后在这块前脸上竖直坠落（真机台的「回币窗」） ---- */
    const dropTop = lipBot;
    const dropBot = dropTop + lift(DROP_H);
    // 窗框：一圈倒角金属，上亮下暗 —— 读成"凹进去的窗"而不是一块黑板
    ctx.fillStyle = "#46516b";
    ctx.fillRect(lipFrontTop.x, dropTop, lipWidth, dropBot - dropTop);
    const frameBevel = ctx.createLinearGradient(0, dropTop, 0, dropBot);
    frameBevel.addColorStop(0, "rgba(232,242,255,0.46)");
    frameBevel.addColorStop(0.07, "rgba(232,242,255,0.06)");
    frameBevel.addColorStop(0.88, "rgba(0,0,0,0.34)");
    frameBevel.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = frameBevel;
    ctx.fillRect(lipFrontTop.x, dropTop, lipWidth, dropBot - dropTop);

    // 玻璃内嵌：井内比窗框再缩一圈，形成纵深
    const inset = Math.max(2, view.scale * 0.07);
    const gx = lipFrontTop.x + inset;
    const gw = Math.max(4, lipWidth - inset * 2);
    const gy0 = dropTop + inset * 0.7;
    const gy1 = dropBot - inset * 0.7;
    const shaft = ctx.createLinearGradient(0, gy0, 0, gy1);
    shaft.addColorStop(0, "#0b1426");
    shaft.addColorStop(0.32, "#060b16");
    shaft.addColorStop(0.78, "#0a1120");
    shaft.addColorStop(1, "#141e33");
    ctx.fillStyle = shaft;
    ctx.fillRect(gx, gy0, gw, gy1 - gy0);
    // 井口亮线（唇口下沿的反光）
    ctx.fillStyle = "rgba(255,226,170,0.55)";
    ctx.fillRect(gx, gy0, gw, Math.max(1, view.scale * 0.03));
    // 井口暖光：币从这里掉下去
    const wellGlow = ctx.createLinearGradient(0, gy0, 0, gy0 + lift(DROP_H * 0.6));
    wellGlow.addColorStop(0, "rgba(255,186,96,0.26)");
    wellGlow.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = wellGlow;
    ctx.fillRect(gx, gy0, gw, lift(DROP_H * 0.6));
    // 井壁竖向导槽（把"这是一条竖井"讲清楚）
    for (let x = 1.0; x < FIELD_W; x += 1.6) {
      const px = P(x, FIELD_H).x;
      const rail = ctx.createLinearGradient(0, gy0, 0, gy1);
      rail.addColorStop(0, "rgba(150,190,255,0.11)");
      rail.addColorStop(1, "rgba(150,190,255,0.02)");
      ctx.fillStyle = rail;
      ctx.fillRect(px - Math.max(1, view.scale * 0.02), gy0, Math.max(2, view.scale * 0.04), gy1 - gy0);
    }
    // 玻璃斜向反光（两块平行亮带，读成玻璃而不是空洞）
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, gy0, gw, gy1 - gy0);
    ctx.clip();
    for (const [sx, sw, a] of [[0.24, 0.09, 0.07], [0.62, 0.05, 0.05]]) {
      const sg = ctx.createLinearGradient(gx + gw * sx, gy0, gx + gw * (sx + sw), gy1);
      sg.addColorStop(0, `rgba(190,220,255,0)`);
      sg.addColorStop(0.5, `rgba(190,220,255,${a})`);
      sg.addColorStop(1, `rgba(190,220,255,0)`);
      ctx.fillStyle = sg;
      ctx.fillRect(gx, gy0, gw, gy1 - gy0);
    }
    ctx.restore();
    // 井底暗影（把竖井和托盘分开）
    const wellShade = ctx.createLinearGradient(0, gy1 - lift(0.45), 0, gy1);
    wellShade.addColorStop(0, "rgba(0,0,0,0)");
    wellShade.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = wellShade;
    ctx.fillRect(gx, gy1 - lift(0.45), gw, lift(0.45));

    /* ---- 托盘（前方收集盘，前宽后窄）---- */
    const trayTop = dropBot;
    const trayBot = trayTop + lift(TRAY_H);
    const cx = view.width / 2;
    const halfTop = lipWidth / 2;
    const halfBot = halfTop * 1.18;
    // 盘口金属框
    ctx.beginPath();
    ctx.moveTo(cx - halfTop, trayTop);
    ctx.lineTo(cx + halfTop, trayTop);
    ctx.lineTo(cx + halfBot, trayBot);
    ctx.lineTo(cx - halfBot, trayBot);
    ctx.closePath();
    const tray = ctx.createLinearGradient(0, trayTop, 0, trayBot);
    tray.addColorStop(0, "#6d7a99");
    tray.addColorStop(0.1, "#39445f");
    tray.addColorStop(0.55, "#232d47");
    tray.addColorStop(1, "#5b688a");
    ctx.fillStyle = tray;
    ctx.fill();
    // 盘内凹槽（比盘口再缩一圈，读成"有深度的盘子"）
    const insetT = Math.max(1.5, view.scale * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - halfTop + insetT, trayTop + insetT * 1.4);
    ctx.lineTo(cx + halfTop - insetT, trayTop + insetT * 1.4);
    ctx.lineTo(cx + halfBot - insetT * 1.6, trayBot - insetT);
    ctx.lineTo(cx - halfBot + insetT * 1.6, trayBot - insetT);
    ctx.closePath();
    const trayWell = ctx.createLinearGradient(0, trayTop, 0, trayBot);
    trayWell.addColorStop(0, "#0d1526");
    trayWell.addColorStop(0.5, "#151f36");
    trayWell.addColorStop(1, "#2b3a5c");
    ctx.fillStyle = trayWell;
    ctx.fill();
    ctx.strokeStyle = "rgba(190,215,255,0.3)";
    ctx.lineWidth = Math.max(1, view.scale * 0.025);
    ctx.stroke();
    // 盘底暖光（币掉进来的落点）
    const trayBed = ctx.createLinearGradient(0, trayBot - lift(0.42), 0, trayBot);
    trayBed.addColorStop(0, "rgba(255,196,110,0)");
    trayBed.addColorStop(1, "rgba(255,184,96,0.3)");
    ctx.fillStyle = trayBed;
    ctx.fillRect(cx - halfBot, trayBot - lift(0.42), halfBot * 2, lift(0.42));
    // 前沿金色压边（与唇口呼应，托盘才收得住）
    ctx.beginPath();
    ctx.moveTo(cx - halfBot, trayBot);
    ctx.lineTo(cx + halfBot, trayBot);
    ctx.strokeStyle = "rgba(255,214,140,0.5)";
    ctx.lineWidth = Math.max(1.5, view.scale * 0.045);
    ctx.stroke();

    /* ---- 玻璃反光 + 暗角 ---- */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, backTop, view.width, bottomY - backTop);
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, backTop, view.width * 0.65, bottomY);
    sheen.addColorStop(0, "rgba(255,255,255,0.075)");
    sheen.addColorStop(0.3, "rgba(255,255,255,0.012)");
    sheen.addColorStop(0.52, "rgba(255,255,255,0.05)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, backTop, view.width, bottomY - backTop);
    const vig = ctx.createRadialGradient(view.width / 2, (backTop + bottomY) / 2, Math.min(view.width, bottomY - backTop) * 0.2,
      view.width / 2, (backTop + bottomY) / 2, Math.max(view.width, bottomY - backTop) * 0.7);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, backTop, view.width, bottomY - backTop);
    ctx.restore();
  }

  /* ---------------------------------------------------- 推板（实体金属板 + 后撤机械舱） */

  // 板后机械舱：一块位于推板之后的暗腔背景板。
  // 它必须画在所有台面物件之前 —— 否则会把悬在机顶的遮挡杆整排盖掉（杆头在 y 0.8~3.0，
  // 正落在这块板的屏幕范围内）。
  function drawPusherChamber(state) {
    const front = state.plateFront;
    const back = Math.max(0.35, front - PLATE_DEPTH);
    const rTop = P(0, TABLE_BACK).y;
    const rBot = P(0, back).y;
    const rL = P(VIEW.x0, TABLE_BACK).x;
    const rR = P(VIEW.x1, TABLE_BACK).x;
    const rBL = P(VIEW.x0, back).x;
    const rBR = P(VIEW.x1, back).x;

    // ---- 板后机械舱（后撤的暗腔，活塞导轨）----
    ctx.beginPath();
    ctx.moveTo(rL, rTop);
    ctx.lineTo(rR, rTop);
    ctx.lineTo(rBR, rBot);
    ctx.lineTo(rBL, rBot);
    ctx.closePath();
    const cave = ctx.createLinearGradient(0, rTop, 0, rBot);
    cave.addColorStop(0, "#000000");
    cave.addColorStop(0.55, "#05080f");
    cave.addColorStop(1, "#0d1422");
    ctx.fillStyle = cave;
    ctx.fill();
    // 舱口顶部的深阴影（推板后撤露出的暗腔）
    const caveTop = ctx.createLinearGradient(0, rTop, 0, rTop + lift(0.7));
    caveTop.addColorStop(0, "rgba(0,0,0,0.95)");
    caveTop.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = caveTop;
    ctx.fillRect(rL, rTop, rR - rL, lift(0.7));
    ctx.save();
    ctx.clip();
    // 活塞导轨
    for (const t of [0.22, 0.5, 0.78]) {
      const a = P(VIEW.x0 + VIEW_W * t, TABLE_BACK);
      const b = P(VIEW.x0 + VIEW_W * t, back);
      ctx.strokeStyle = "rgba(150,175,220,0.16)";
      ctx.lineWidth = Math.max(2, view.scale * 0.12);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = Math.max(1, view.scale * 0.03);
      ctx.beginPath();
      ctx.moveTo(a.x - view.scale * 0.07, a.y);
      ctx.lineTo(b.x - view.scale * 0.07, b.y);
      ctx.stroke();
    }
    ctx.restore();
    // 舱口下沿的暗影（机械舱深处）
    const caveShade = ctx.createLinearGradient(0, rBot - lift(0.5), 0, rBot);
    caveShade.addColorStop(0, "rgba(0,0,0,0)");
    caveShade.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = caveShade;
    ctx.fillRect(rBL, rBot - lift(0.5), rBR - rBL, lift(0.5));
  }

  function drawPusher(state) {
    const front = state.plateFront;
    const back = Math.max(0.35, front - PLATE_DEPTH);
    const rBot = P(0, back).y;

    // ---- 推板本体 ----
    const frontY = P(0, front).y;
    const tl = P(VIEW.x0, back).x;
    const tr = P(VIEW.x1, back).x;
    const bl = P(VIEW.x0, front).x;
    const br = P(VIEW.x1, front).x;
    const drop = lift(PLATE_H);

    // 推板投在台面上的阴影（前缘外扩）
    const shadow = ctx.createLinearGradient(0, frontY, 0, frontY + lift(0.9));
    shadow.addColorStop(0, "rgba(0,0,0,0.5)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.fillRect(bl, frontY, br - bl, lift(0.9));

    // 顶面（窄条，拉丝金属）
    ctx.beginPath();
    ctx.moveTo(tl, rBot);
    ctx.lineTo(tr, rBot);
    ctx.lineTo(br, frontY);
    ctx.lineTo(bl, frontY);
    ctx.closePath();
    const top = ctx.createLinearGradient(0, rBot, 0, frontY);
    top.addColorStop(0, "#2b3550");
    top.addColorStop(0.55, "#54648a");
    top.addColorStop(1, "#8698bd");
    ctx.fillStyle = top;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let x = 0.4; x < FIELD_W; x += 0.8) {
      const a = P(x, back);
      const b = P(x, front);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    // 顶面后沿高光（推板顶部棱线）
    ctx.strokeStyle = "rgba(232,242,255,0.9)";
    ctx.lineWidth = Math.max(1.6, view.scale * 0.05);
    ctx.beginPath();
    ctx.moveTo(tl, rBot);
    ctx.lineTo(tr, rBot);
    ctx.stroke();

    // 前立面（整块金属，最亮的一条）
    ctx.beginPath();
    ctx.moveTo(bl, frontY);
    ctx.lineTo(br, frontY);
    ctx.lineTo(br, frontY + drop);
    ctx.lineTo(bl, frontY + drop);
    ctx.closePath();
    const face = ctx.createLinearGradient(0, frontY, 0, frontY + drop);
    face.addColorStop(0, "#f2f6ff");
    face.addColorStop(0.12, "#b6c7e6");
    face.addColorStop(0.58, "#5b6d94");
    face.addColorStop(1, "#232c44");
    ctx.fillStyle = face;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let x = 0.6; x < FIELD_W; x += 1.2) {
      const a = P(x, front);
      ctx.strokeStyle = "rgba(16,22,38,0.42)";
      ctx.lineWidth = Math.max(1, view.scale * 0.04);
      ctx.beginPath();
      ctx.moveTo(a.x, frontY + drop * 0.16);
      ctx.lineTo(a.x, frontY + drop * 0.94);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.26)";
      ctx.beginPath();
      ctx.moveTo(a.x + Math.max(1, view.scale * 0.04), frontY + drop * 0.16);
      ctx.lineTo(a.x + Math.max(1, view.scale * 0.04), frontY + drop * 0.94);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(bl, frontY, br - bl, Math.max(1.5, view.scale * 0.05));
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(bl, frontY + drop - Math.max(1, view.scale * 0.03), br - bl, Math.max(1, view.scale * 0.03));
  }

  /* ---------------------------------------------------- 金币 / 金塔 */

  // 单枚金币（画家算法里逐个调用）
  // 单枚币被画到屏幕上的矩形 —— 全片唯一的"币画在哪"口径。
  // 绘制层与只读诊断出口共用它，验收脚本才能读真值，而不是自己复刻一遍高度曲线。
  function coinDrawBox(coin) {
    const inChute = coin.chute > 0;
    const air = inChute || coin.air > 0;
    // 投币通道里的币：高度由世界 y 反推（投币口最高，落到推板前缘即贴台面）。
    // 弹射器抛起的币不在通道内，退回按剩余飞行时间抬升。
    const dropH = inChute ? dropHeightRatio(coin.y) : 0;
    const airT = coin.air > 0 ? Math.min(1, coin.air / 0.6) : 0;
    const liftRatio = Math.min(1, Math.max(dropH, airT));
    const p = P(coin.x, coin.y);
    const rx = coin.r * view.scale * p.k;
    const ry = rx * TILT;
    // 叠币观感：约 1/3 的币按 id 确定性抬升，读起来像"压在上面一层"（纯渲染，不进物理）
    const jitter = ((coin.id * 2654435761) >>> 0) % 1024 / 1024;
    const stack = !air && jitter > 0.66 ? ((jitter - 0.66) / 0.34) * STACK_MAX : 0;
    // 竖直抬升一律走 lift()（= 立面竖直压缩 VERT），与遮挡杆共用同一条高度曲线。
    // 通道币的抬升必须严格等于 chuteLift，否则币会从杆的旁边"穿过去"。
    const hop = inChute ? lift(chuteLift(coin.y)) + lift(stack) : lift(airT * 0.5 + stack);
    const thick = coin.kind === "tower" ? TOWER_THICK : COIN_THICK;
    const th = 2 * rx * thick * VERT;
    return {
      p, rx, ry, th, hop, stack, liftRatio, air, inChute,
      x: p.x - rx, y: p.y - ry - th - hop, w: rx * 2, h: ry * 2 + th
    };
  }

  function drawOneCoin(coin) {
    const sp = ensureSprites();
    const b = coinDrawBox(coin);
    const { p, rx, ry, th, hop, stack, liftRatio, air, inChute } = b;

    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * (0.98 - liftRatio * 0.22 - stack * 0.5), ry * (0.92 - liftRatio * 0.24 - stack * 0.5), 0, 0, Math.PI * 2);
    ctx.fillStyle = air ? "rgba(0,0,0,0.14)" : stack > 0 ? "rgba(0,0,0,0.24)" : "rgba(0,0,0,0.34)";
    ctx.fill();

    // 状态一律用「径向柔光渐隐」表示，不给主体描边圈（描边圈被邻币遮一半会变成一道怪弧）。
    //  - 腾空/通道中的币：暖色（通道）或冷色（弹起）柔光；
    //  - 压到前缘、随时会掉下去的币：暖橙脉动柔光。
    let glowRGB = null;
    let glowPulse = 0;
    if (air) {
      glowRGB = inChute ? "255,214,140" : "190,230,255";
      glowPulse = 0.32;
    } else if (coin.y > FIELD_H - TIP_ZONE) {
      glowRGB = "255,170,80";
      glowPulse = 0.2 + 0.16 * Math.sin(clock * 9 + coin.id);
    }
    if (glowRGB && glowPulse > 0) {
      const gr = rx * (air ? 1.8 : 1.95);
      const g = ctx.createRadialGradient(p.x, p.y - hop, rx * 0.7, p.x, p.y - hop, gr);
      g.addColorStop(0, `rgba(${glowRGB},${glowPulse})`);
      g.addColorStop(0.5, `rgba(${glowRGB},${glowPulse * 0.32})`);
      g.addColorStop(1, `rgba(${glowRGB},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - hop, gr, gr * TILT, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const img = coin.kind === "tower" ? sp.tower : sp[coin.kind] || sp.norm;
    ctx.globalAlpha = air ? 0.94 : 1;
    ctx.drawImage(img, b.x, b.y, b.w, b.h);
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------- 机关 */

  // 单个机关（画家算法里逐个调用）
  function drawToken(token) {
    const sp = ensureSprites();
    const p = P(token.x, token.y);
    const pulse = token.pulse > 0 ? 1 + token.pulse * 0.35 : 1;
    const k = p.k;

    if (token.type === "card") {
      const img = token.effect === "double" ? sp.cardDouble : token.effect === "speed" ? sp.cardSpeed : sp.cardMagnet;
      const rx = (CARD_W / 2) * view.scale * k * pulse;
      const ry = (CARD_H / 2) * view.scale * k * TILT * pulse;
      const th = 2 * rx * CARD_THICK * VERT;
      const liftPx = lift(CARD_LIFT);
      ctx.beginPath();
      ctx.ellipse(p.x + liftPx * 0.35, p.y + liftPx * 0.5, rx * 0.92, ry * 0.86, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.36)";
      ctx.fill();
      ctx.drawImage(img, p.x - rx, p.y - ry - th - liftPx, rx * 2, ry * 2 + th);
    } else if (token.type === "launcher") {
      const rx = LAUNCHER_R * view.scale * k;
      const ry = rx * TILT;
      const ready = token.cooldown <= 0;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + ry * 0.5, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      // 弹射井的金属圈：用「外盘 − 内井」画出一圈实体边（不是描边圈）
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 1.12, ry * 1.12, 0, 0, Math.PI * 2);
      const rim = ctx.createLinearGradient(0, p.y - ry * 1.12, 0, p.y + ry * 1.12);
      rim.addColorStop(0, "#8d9aba");
      rim.addColorStop(0.42, "#3c4661");
      rim.addColorStop(1, "#7d8aa9");
      ctx.fillStyle = rim;
      ctx.fill();
      // 下沉的井
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      const well = ctx.createLinearGradient(0, p.y - ry, 0, p.y + ry);
      well.addColorStop(0, "#070c16");
      well.addColorStop(0.7, "#111a2c");
      well.addColorStop(1, "#1e2941");
      ctx.fillStyle = well;
      ctx.fill();
      // 井内柔光：就绪时暖色、冷却时冷色 —— 用径向柔光渐隐，不用描边圈
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rx);
      halo.addColorStop(0, ready ? "rgba(255,172,102,0.46)" : "rgba(140,165,205,0.16)");
      halo.addColorStop(0.6, ready ? "rgba(255,160,90,0.16)" : "rgba(140,165,205,0.05)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // 弹簧圈：同心纹理（读成"这是个弹射井"），低对比、非状态标识
      for (let i = 0; i < 3; i++) {
        const rr = 0.34 + i * 0.22;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx * rr, ry * rr, 0, 0, Math.PI * 2);
        ctx.strokeStyle = ready ? `rgba(255,200,148,${0.26 - i * 0.06})` : `rgba(150,175,215,${0.18 - i * 0.04})`;
        ctx.lineWidth = Math.max(1, view.scale * 0.03);
        ctx.stroke();
      }
      // 圈顶金属高光（材质反光，与状态无关）
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 1.12, ry * 1.12, 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.strokeStyle = "rgba(238,246,255,0.45)";
      ctx.lineWidth = Math.max(1, view.scale * 0.035);
      ctx.stroke();
    } else if (token.type === "magnet") {
      const rx = MAGNET_R * view.scale * k;
      const ry = rx * TILT;
      // 磁力柔光（在盘体之下，读成"这块地方有磁力"）
      const field = ctx.createRadialGradient(p.x, p.y, rx * 0.7, p.x, p.y, rx * 1.9);
      field.addColorStop(0, `rgba(140,190,255,${0.24 + 0.1 * Math.sin(clock * 2.4)})`);
      field.addColorStop(0.55, `rgba(120,170,255,${0.09 + 0.04 * Math.sin(clock * 2.4)})`);
      field.addColorStop(1, "rgba(120,170,255,0)");
      ctx.fillStyle = field;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 1.9, ry * 1.9, 0, 0, Math.PI * 2);
      ctx.fill();
      // 磁块本体：金属圈 + 深色盘心
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 1.1, ry * 1.1, 0, 0, Math.PI * 2);
      const mrim = ctx.createLinearGradient(0, p.y - ry * 1.1, 0, p.y + ry * 1.1);
      mrim.addColorStop(0, "#a8c2e8");
      mrim.addColorStop(0.45, "#42536f");
      mrim.addColorStop(1, "#8fa6c8");
      ctx.fillStyle = mrim;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      const mcore = ctx.createLinearGradient(0, p.y - ry, 0, p.y + ry);
      mcore.addColorStop(0, "#131b2d");
      mcore.addColorStop(1, "#26334f");
      ctx.fillStyle = mcore;
      ctx.fill();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, TILT);
      ctx.fillStyle = "rgba(196,224,255,0.95)";
      ctx.font = `700 ${Math.round(rx * 0.9)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("U", 0, 0);
      ctx.restore();
    }
  }

  /* ---------------------------------------------------- 落入托盘的币 */

  // 落袋的币：越过唇口后沿机台前脸竖直坠落，磕进托盘再淡出。
  // 全部在屏幕竖直方向上做（走 lift()），不做任何 y 钳制 —— 钳制会让它看起来"停在边缘堆着"。
  function drawFalling() {
    const sp = ensureSprites();
    const lipBaseY = P(0, FIELD_H).y;
    // 币掉进托盘的那一刻（之后开始淡出）
    const landAt = DROP_H + TRAY_H * 0.5;
    const trayFloorY = lipBaseY + lift(LIP_H + DROP_H + TRAY_H * 0.5);
    trayFloorPx = trayFloorY;

    // 先画托盘上的落点飞溅（在币之下，币落地才盖住它）
    for (const s of splashes) {
      const k = 1 - s.t / 0.62;             // 1 → 0
      if (k <= 0) continue;
      const p = P(s.x, FIELD_H);
      const rx = (0.22 + (1 - k) * 1.15) * view.scale * p.k;
      const ry = rx * TILT;
      const warm = s.kind === "gem" ? "150,225,255" : "255,206,120";
      ctx.save();
      // 落点柔光（币磕在盘底那一下的光斑）
      const spot = ctx.createRadialGradient(p.x, trayFloorY, 0, p.x, trayFloorY, rx * 1.5);
      spot.addColorStop(0, `rgba(${warm},${0.5 * k})`);
      spot.addColorStop(0.5, `rgba(${warm},${0.18 * k})`);
      spot.addColorStop(1, `rgba(${warm},0)`);
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.ellipse(p.x, trayFloorY, rx * 1.5, rx * 1.5 * TILT, 0, 0, Math.PI * 2);
      ctx.fill();
      // 扩散的涟漪
      ctx.globalAlpha = k * 0.9;
      ctx.strokeStyle = `rgba(${warm},0.95)`;
      ctx.lineWidth = Math.max(1.2, view.scale * 0.055 * k);
      ctx.beginPath();
      ctx.ellipse(p.x, trayFloorY, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 溅起的小火星
      ctx.globalAlpha = k;
      ctx.fillStyle = `rgba(${warm},0.95)`;
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI * 0.15 - (i / 4) * Math.PI * 0.7;
        const d = (1 - k) * 0.9;
        const sx = p.x + Math.cos(a) * d * view.scale * 0.6;
        const sy = trayFloorY + Math.sin(a) * d * view.scale * 0.6 * TILT;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.8, view.scale * 0.05 * k), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const c of falling) {
      const fade = c.drop <= landAt ? 1 : Math.max(0, 1 - (c.drop - landAt) / 0.55);
      // 淡出到 0 之后就不画了；诊断出口必须同步清空，否则会对外汇报一个"过期坐标"。
      if (fade <= 0) {
        c.box = null;
        continue;
      }
      const sway = reduced ? 0 : Math.sin(c.spin) * 0.15 * Math.min(1, c.drop * 1.6);
      const p = P(c.x + sway, FIELD_H);
      const y = lipBaseY + lift(LIP_H * 0.5 + c.drop);
      // 翻滚：横向按 |cos| 压扁，读起来像币边转边掉
      const tumble = 0.32 + 0.68 * Math.abs(Math.cos(c.spin));
      const rx = 0.5 * view.scale * p.k;
      const ry = rx * TILT;
      const th = 2 * rx * COIN_THICK * VERT;
      const img = sp[c.kind] || sp.norm;
      // 拖影：币在下坠中拉出的残影
      ctx.globalAlpha = fade * 0.2;
      ctx.drawImage(img, p.x - rx * tumble, y - ry - th - lift(0.34), rx * 2 * tumble, ry * 2 + th);
      ctx.globalAlpha = fade;
      ctx.drawImage(img, p.x - rx * tumble, y - ry - th, rx * 2 * tumble, ry * 2 + th);
      ctx.globalAlpha = 1;
      // 只读诊断出口：把这一帧真正画在屏幕上的位置记下来，验收脚本读它，
      // 而不是自己复刻 lift()/坠落公式（复刻 = 恒真，缺陷注入后照样全绿）。
      c.box = { x: p.x, y: y - th / 2, w: rx * 2 * tumble, h: ry * 2 + th, fade, drop: c.drop };
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const sp = worldToScreen(view, p.x, p.y);
      const k = 1 - p.life / p.max;
      const r = Math.max(1, p.size * view.scale * k * (0.7 + sp.k * 0.3));
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${0.85 * k})`;
      ctx.fill();
    }
  }

  /* ---------------------------------------------------- 投币口 + 挡杆阵（随机落点） */

  // 通道高度曲线：世界 y → 离台面高度（世界单位）。挡杆与币共用同一条曲线，
  // 所以杆永远精确地"挡在币的必经之路上"，不会出现币从杆旁边穿过去却看着像撞上。
  const chuteLift = (y) => CHUTE_LIFT * dropHeightRatio(y);

  // 遮挡杆按「排」分组：同一排共用一根横梁，杆从梁上垂下、球头正好落在币的高度曲线上。
  // 三排横梁沿下落曲线逐级下沉（后排高、前排低），两端用立柱串成一副梯架挂在机头下沿——
  // 于是每根杆都短、都等长，读起来是一副机械梯架，而不是从天上垂下来的一堆乱线。
  function pegTiers(pegs) {
    const rows = [];
    let minX = Infinity;
    let maxX = -Infinity;
    for (const peg of pegs) {
      const r = peg.row || 0;
      if (!rows[r]) rows[r] = [];
      rows[r].push(peg);
      if (peg.x < minX) minX = peg.x;
      if (peg.x > maxX) maxX = peg.x;
    }
    // 三排共用同一条跨度：立柱才是直的、整副梯架才读成一个整体（各排各跨度会变成错位线框）。
    const x0 = Math.max(0.14, minX - 0.62);
    const x1 = Math.min(FIELD_W - 0.14, maxX + 0.62);
    const out = [];
    for (let r = 0; r < rows.length; r++) {
      const list = rows[r];
      if (!list || !list.length) continue;
      let maxH = 0;
      for (const peg of list) {
        const h = chuteLift(peg.y);
        if (h > maxH) maxH = h;
      }
      out.push({
        r,
        y: PEG_Y0 + r * PEG_ROW_GAP,
        pegs: list,
        // 梁高取「本排最高杆心 + 杆长」：保证每根杆都够得着自己的杆心，杆长差又被压到最小
        railH: maxH + PIN_LEN,
        x0,
        x1
      });
    }
    for (let i = 0; i < out.length; i++) out[i].prev = i > 0 ? out[i - 1] : null;
    return out;
  }

  // 通道内元素（币 / 杆头）在世界 (x, y) 处真实被画到屏幕的哪个位置
  function chuteTip(x, y) {
    const p = P(x, y);
    return { x: p.x, y: p.y - lift(chuteLift(y)), k: p.k };
  }

  // 机头 + 投币口 + 出币口。
  // 真机台的结构：投币口开在机顶面板上（玩家面对的那块金属板），币塞进去后沿内部滑道
  // 落到台面后方的出币口，再从那里飞出来穿过遮挡杆阵。这里照这个结构画：
  //   机头面板（后墙上沿立起的金属板）→ 面板中央的镀铬投币口 → 面板下沿的灯带
  //   → 短滑道 → 出币口圆孔（币真正出现在画面里的地方）。
  function drawChuteRig(state) {
    const wallL = P(VIEW.x0, 0).x;
    const wallR = P(VIEW.x1, 0).x;
    const wallTop = P(0, 0).y - lift(BACK_H);
    // 机头面板从后墙上沿立起来，一直顶到画布上沿（真机台的机头本来就高出取景框，
    // 被画框切掉是正常的）。这样任何画布尺寸下机头都填满、不会被裁出半截。
    const headTop = Math.max(0, wallTop - lift(HEAD_H));
    const w = wallR - wallL;
    const k0 = depthScale(0);

    /* ---- 机头面板 ---- */
    const face = ctx.createLinearGradient(0, headTop, 0, wallTop);
    face.addColorStop(0, "#141b2c");
    face.addColorStop(0.3, "#2a344e");
    face.addColorStop(0.76, "#1a2234");
    face.addColorStop(1, "#0b101d");
    ctx.fillStyle = face;
    ctx.fillRect(wallL, headTop, w, wallTop - headTop);
    // 竖向拉丝
    ctx.save();
    ctx.beginPath();
    ctx.rect(wallL, headTop, w, wallTop - headTop);
    ctx.clip();
    for (let x = 0.3; x < FIELD_W; x += 0.5) {
      const px = P(x, 0).x;
      ctx.strokeStyle = "rgba(150,180,240,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, headTop);
      ctx.lineTo(px, wallTop);
      ctx.stroke();
    }
    ctx.restore();
    // 机头上沿金属压条
    ctx.fillStyle = "rgba(198,216,246,0.42)";
    ctx.fillRect(wallL, headTop, w, Math.max(1.5, view.scale * 0.04));
    // 机头下沿灯带（机头与玻璃箱的分界）
    const strip = ctx.createLinearGradient(0, wallTop - lift(0.4), 0, wallTop);
    strip.addColorStop(0, "rgba(255,214,140,0)");
    strip.addColorStop(0.62, `rgba(255,206,128,${0.28 + railGlow * 0.24})`);
    strip.addColorStop(1, "rgba(255,196,110,0)");
    ctx.fillStyle = strip;
    ctx.fillRect(wallL, wallTop - lift(0.4), w, lift(0.4));
    ctx.fillStyle = "rgba(255,222,158,0.7)";
    ctx.fillRect(wallL, wallTop - Math.max(1.2, view.scale * 0.028), w, Math.max(1.5, view.scale * 0.036));
    // 一排小灯珠（沿机头下沿，随连锁微微呼吸）
    for (let x = 0.5; x < FIELD_W; x += 1.2) {
      const px = P(x, 0).x;
      const blink = 0.45 + 0.55 * Math.abs(Math.sin(clock * 1.6 + x * 0.9));
      ctx.beginPath();
      ctx.arc(px, wallTop - lift(0.66), Math.max(1.5, view.scale * 0.045), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,214,140,${0.3 + blink * 0.5})`;
      ctx.fill();
    }

    /* ---- 投币口：面板中央的镀铬口 + 一道横槽 + 一盏指示灯 ---- */
    const slotX = P(CHUTE_X, 0).x;
    const slotY = headTop + (wallTop - headTop) * 0.56;
    const pw = 1.0 * view.scale * k0;
    const ph = Math.max(9, lift(0.34));
    roundRectPath(ctx, slotX - pw, slotY - ph, pw * 2, ph * 2, Math.min(ph * 0.5, pw * 0.28));
    const plate = ctx.createLinearGradient(0, slotY - ph, 0, slotY + ph);
    plate.addColorStop(0, "#e8f0fe");
    plate.addColorStop(0.22, "#9aa8c6");
    plate.addColorStop(0.6, "#4a5670");
    plate.addColorStop(1, "#1a2132");
    ctx.fillStyle = plate;
    ctx.fill();
    ctx.strokeStyle = "rgba(236,244,255,0.5)";
    ctx.lineWidth = Math.max(1, view.scale * 0.026);
    ctx.stroke();
    // 投币槽：横槽，币竖着塞进去
    const sw = pw * 0.56;
    const sh = Math.max(2.2, ph * 0.22);
    roundRectPath(ctx, slotX - sw, slotY - sh, sw * 2, sh * 2, sh);
    ctx.fillStyle = "#03050a";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,206,128,0.5)";
    ctx.lineWidth = Math.max(1, view.scale * 0.02);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,226,170,0.3)";
    ctx.fillRect(slotX - sw, slotY - sh, sw * 2, Math.max(1, sh * 0.3));
    // 指示灯：有币可投时暖亮、没币时冷暗（亮度与光晕半径同时变，不是只靠颜色）
    const canInsert = !state || state.status === "ready" || (state.credits > 0 && state.status === "playing");
    const lampY = slotY - ph * 1.7;
    const lampR = Math.max(2, view.scale * 0.058);
    const lampGlow = ctx.createRadialGradient(slotX, lampY, 0, slotX, lampY, lampR * 3.4);
    lampGlow.addColorStop(0, canInsert ? "rgba(255,196,96,0.5)" : "rgba(120,150,200,0.18)");
    lampGlow.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(slotX, lampY, lampR * 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(slotX, lampY, lampR, 0, Math.PI * 2);
    ctx.fillStyle = canInsert ? "#ffd88a" : "#4a5a78";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(slotX - lampR * 0.3, lampY - lampR * 0.34, Math.max(0.8, lampR * 0.36), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fill();

    /* ---- 短滑道：机头下沿 → 出币口 ---- */
    const tip = chuteTip(CHUTE_X, CHUTE_Y0);
    const tubeW = Math.max(4.5, 0.5 * view.scale * tip.k);
    const tubeH = Math.max(2, tip.y - wallTop + tubeW * 0.5);
    const tg = ctx.createLinearGradient(slotX - tubeW, 0, slotX + tubeW, 0);
    tg.addColorStop(0, "#151b2b");
    tg.addColorStop(0.28, "#8b98b6");
    tg.addColorStop(0.44, "#eaf2ff");
    tg.addColorStop(0.72, "#4a5672");
    tg.addColorStop(1, "#131928");
    ctx.fillStyle = tg;
    ctx.fillRect(slotX - tubeW, wallTop, tubeW * 2, tubeH);
    ctx.fillStyle = "rgba(2,4,9,0.78)";
    ctx.fillRect(slotX - tubeW * 0.44, wallTop + 1, tubeW * 0.88, Math.max(0, tubeH - 1));

    /* ---- 出币口：币真正出现在画面里的地方 ---- */
    const capR = Math.max(5, 0.46 * view.scale * tip.k);
    const glow = ctx.createRadialGradient(tip.x, tip.y, 1, tip.x, tip.y, capR * 3.0);
    glow.addColorStop(0, "rgba(255,214,140,0.5)");
    glow.addColorStop(0.42, "rgba(255,190,110,0.16)");
    glow.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(tip.x, tip.y, capR * 3.0, capR * 3.0 * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(tip.x, tip.y, capR, capR * 0.88, 0, 0, Math.PI * 2);
    const ring = ctx.createLinearGradient(0, tip.y - capR, 0, tip.y + capR);
    ring.addColorStop(0, "#e2ebfb");
    ring.addColorStop(0.42, "#6c7a99");
    ring.addColorStop(1, "#1e2638");
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(tip.x, tip.y, capR * 0.64, capR * 0.54, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#03050a";
    ctx.fill();
  }

  // 一排遮挡杆 = 一根横梁 + 若干短杆（杆心正落在币的高度曲线上）。
  // 三排横梁沿下落曲线逐级下沉，两端用立柱串成一副梯架挂在机头下沿——
  // 于是每根杆都短、长度都接近，读起来是一副机械梯架，而不是从天上垂下来的一堆乱线。
  function drawTier(tier) {
    const railY = P(0, tier.y).y - lift(tier.railH);
    const xL = P(tier.x0, tier.y).x;
    const xR = P(tier.x1, tier.y).x;
    const railR = Math.max(2.6, view.scale * 0.062);

    // 梁端墙座：横梁就夹在两侧玻璃壁上。
    // 刻意不做「通高立柱」——三排梁 + 两根通高立柱会立刻读成一个笼子，
    // 而一副挂在玻璃箱里的杆架只需要梁和墙座。
    for (const wx of [tier.x0, tier.x1]) {
      const mx = P(wx, tier.y).x;
      const bw = railR * 3.0;
      const bh = railR * 3.4;
      ctx.fillStyle = "#39445e";
      ctx.fillRect(mx - bw / 2, railY - bh / 2, bw, bh);
      ctx.fillStyle = "rgba(232,242,255,0.32)";
      ctx.fillRect(mx - bw / 2, railY - bh / 2, bw, Math.max(1, railR * 0.5));
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(mx - bw / 2, railY + bh / 2 - Math.max(1, railR * 0.4), bw, Math.max(1, railR * 0.4));
      ctx.fillStyle = "#7d8aa8";
      ctx.beginPath();
      ctx.arc(mx, railY, Math.max(1, railR * 0.42), 0, Math.PI * 2);
      ctx.fill();
    }

    // 杆：从梁垂到杆心，抛光球头正好堵在币的必经之路上。
    // 球头半径贴近物理半径 PEG_R —— 币「看起来撞上」的位置才与物理弹开的位置一致。
    for (const peg of tier.pegs) {
      const p = P(peg.x, peg.y);
      const tipY = p.y - lift(chuteLift(peg.y));
      const capR = Math.max(2.6, peg.r * view.scale * p.k * 1.45);
      const rodR = Math.max(1.8, capR * 0.62);
      const rodBot = Math.max(railY + 1, tipY - capR * 0.22);
      const rodH = rodBot - railY;
      // 台面接触投影
      ctx.beginPath();
      ctx.ellipse(p.x + rodR * 0.5, p.y + rodR * 0.5, capR * 1.15, capR * 0.44, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      // 杆身：镀铬圆柱
      const body = ctx.createLinearGradient(p.x - rodR, 0, p.x + rodR, 0);
      body.addColorStop(0, "#0e1422");
      body.addColorStop(0.18, "#5c6a8e");
      body.addColorStop(0.36, "#f2f7ff");
      body.addColorStop(0.58, "#a9b6d2");
      body.addColorStop(0.8, "#4f5b78");
      body.addColorStop(1, "#111726");
      ctx.fillStyle = body;
      ctx.fillRect(p.x - rodR, railY, rodR * 2, rodH);
      // 下段环境遮蔽
      const ao = ctx.createLinearGradient(0, railY, 0, rodBot);
      ao.addColorStop(0, "rgba(0,0,0,0.05)");
      ao.addColorStop(1, "rgba(0,0,0,0.32)");
      ctx.fillStyle = ao;
      ctx.fillRect(p.x - rodR, railY, rodR * 2, rodH);
      // 左缘镜面亮线（镀铬的签名特征）
      ctx.fillStyle = "rgba(255,255,255,0.46)";
      ctx.fillRect(p.x - rodR * 0.4, railY, Math.max(0.8, rodR * 0.15), rodH);
      // 梁下的锁紧螺母：把杆夹在梁上（梁随后才画，螺母留在梁的下沿之外）
      ctx.fillStyle = "#4d5a78";
      ctx.fillRect(p.x - rodR * 1.9, railY + railR * 0.92, rodR * 3.8, Math.max(1.6, railR * 0.95));
      ctx.fillStyle = "rgba(232,242,255,0.34)";
      ctx.fillRect(p.x - rodR * 1.9, railY + railR * 0.92, rodR * 3.8, Math.max(1, railR * 0.36));
      // 抛光球头
      ctx.beginPath();
      ctx.arc(p.x, tipY, capR, 0, Math.PI * 2);
      const cap = ctx.createRadialGradient(p.x - capR * 0.36, tipY - capR * 0.42, capR * 0.06, p.x, tipY, capR * 1.05);
      cap.addColorStop(0, "#ffffff");
      cap.addColorStop(0.3, "#e4ecfd");
      cap.addColorStop(0.62, "#94a3c4");
      cap.addColorStop(0.86, "#39455f");
      cap.addColorStop(1, "#9aa8c6");
      ctx.fillStyle = cap;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x - capR * 0.32, tipY - capR * 0.38, Math.max(1, capR * 0.22), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
    }

    // 横梁：最后画，压在杆顶之上，读成「杆挂在梁上」
    const beam = ctx.createLinearGradient(0, railY - railR, 0, railY + railR);
    beam.addColorStop(0, "#0d1220");
    beam.addColorStop(0.18, "#6a7694");
    beam.addColorStop(0.4, "#bccae4");
    beam.addColorStop(0.66, "#4d5875");
    beam.addColorStop(1, "#0d1220");
    ctx.fillStyle = beam;
    ctx.fillRect(xL, railY - railR, xR - xL, railR * 2);
    // 梁的上下暗边（金属管的轮廓，没有它梁会读成一根细线）
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(xL, railY - railR, xR - xL, Math.max(1, railR * 0.22));
    ctx.fillRect(xL, railY + railR - Math.max(1, railR * 0.22), xR - xL, Math.max(1, railR * 0.22));
    // 梁端墙座（把梁夹在两侧立柱上）在下面单独画，这里不再重复夹块
    // 梁上铆钉
    ctx.fillStyle = "rgba(255,240,205,0.32)";
    for (let x = tier.x0 + 0.55; x < tier.x1 - 0.25; x += 1.1) {
      const px = P(x, tier.y).x;
      ctx.beginPath();
      ctx.arc(px, railY, Math.max(1, railR * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------------------------------------------- 主绘制（画家算法） */

  function draw(state, options = {}) {
    const dt = options.dt ?? 0;
    if (!ctx) return;
    updateEffects(dt);
    ensureSprites();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);

    ctx.save();
    if (shake > 0 && !reduced) {
      const mag = shake * view.scale * 0.16;
      ctx.translate(Math.sin(clock * 47) * mag, Math.cos(clock * 39) * mag);
    }

    drawCabinet();
    // 台面物件一律裁剪在「出币唇口」之上：唇口在整台机器的最前面，
    // 台面上最前沿的币/粒子不该"浮"到前脸（落币竖井 / 托盘）外面去。
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, view.width, P(0, FIELD_H).y + 1);
    ctx.clip();
    if (state) {
      drawPusherChamber(state);
      drawChuteRig(state);
      // 由远及近排序：台面上的金币 / 机关 / 遮挡杆梯架 / 推板前缘，谁 y 大谁后画（遮住远处）。
      // 飞行中的币不参与排序——它在空中，必须始终画在最上层，否则会被推板挡住。
      const items = [];
      const flying = [];
      for (const coin of state.coins) {
        if (coin.chute > 0 || coin.air > 0) flying.push(coin);
        else items.push({ y: coin.y, draw: () => drawOneCoin(coin) });
      }
      for (const token of state.tokens) items.push({ y: token.y, draw: () => drawToken(token) });
      const pegs = state.pegs || [];
      pegCount = pegs.length;
      // 遮挡杆按排成组：一排 = 一根横梁 + 若干短杆，整排作为一个画家项参与遮挡排序
      for (const tier of pegTiers(pegs)) items.push({ y: tier.y, draw: () => drawTier(tier) });
      items.push({ y: state.plateFront - 1e-4, draw: () => drawPusher(state) });
      items.sort((a, b) => a.y - b.y);
      for (const item of items) item.draw();
      for (const coin of flying) drawOneCoin(coin);
    }
    drawParticles();
    ctx.restore();
    if (state) drawFalling();
    ctx.restore();

    if (flash > 0) {
      // 全屏色闪是「大幅动效」，reduced 下压到很淡（但不能为 0 —— 大奖要有反馈）。
      ctx.fillStyle = `rgba(${flashColor},${flash * (reduced ? 0.1 : 0.35)})`;
      ctx.fillRect(0, 0, view.width, view.height);
    }
  }

  function getView() {
    const b = projectedBounds();
    return {
      view: { ...VIEW },
      scale: view.scale,
      ox: view.ox,
      oy: view.oy,
      dpr,
      width: view.width,
      height: view.height,
      tilt: TILT,
      vert: VERT,
      persp: PERSP,
      boundsW: b.w,
      boundsH: b.h,
      reduced,
      particles: particles.length,
      falling: falling.length,
      // 只读诊断出口：三个「衰减型」效果计时器的当前值。
      // 验收脚本用它证明 reduced 下计时器仍在衰减（曾经被冻在 1 → 整屏永久暖色覆盖）。
      flash,
      shake,
      railGlow,
      // 只读诊断出口：每个正在坠落的币，这一帧真正被画在屏幕上的位置。
      // 验收脚本读这里判断"是不是竖直往下掉"，绝不自己复刻坠落公式。
      fallingBoxes: falling.map((c) => (c.box ? { ...c.box } : null)).filter(Boolean),
      trayFloorY: trayFloorPx,
      splashes: splashes.length,
      pegs: pegCount
    };
  }

  function reset() {
    particles.length = 0;
    falling.length = 0;
    splashes.length = 0;
    shake = 0;
    flash = 0;
    railGlow = 0;
  }

  resize();

  return {
    resize,
    draw,
    reset,
    getView,
    toWorld,
    toScreen,
    // 只读诊断出口：通道内元素（飞行中的币 / 遮挡杆杆头）真实被画在哪儿。
    // 验收脚本一律读这里，绝不自己复刻 lift / dropHeightRatio —— 否则缺陷注入后仍会全绿。
    chuteTip,
    coinDrawBox,
    setReduced,
    noteEvent,
    get reduced() { return reduced; }
  };
}
