// 魔塔：勇者登顶 · 渲染与交互层（唯一碰 DOM / Canvas 的模块）
//
// 视窗隐喻：黑曜石地牢机台。中央 11×11 石厅由 Canvas 绘制（火把环境光 / 石砖磨损 / 像素魔物），
// 左右翼用语义化 DOM 承载羊皮纸属性轴与魔物雷达，二者都支持原地热更新。

import {
  CH,
  battlePreview,
  cellAt,
  currentFloor,
  floorMonsters,
  index,
  isMonsterChar,
  monsterIdOf,
  shopOptions,
  threatOf,
} from "./engine.mjs";
import { GRID, ITEMS, MONSTERS } from "./data.mjs";
import { monsterName, zoneName } from "./i18n.mjs";
import { formatNumber, summarize } from "./score.mjs";

const CELL = 64;
const BOARD = CELL * GRID;

// 怪物原型 + 主色（按题材手绘形状，不依赖任何图片资源）
const ARCHETYPE = {
  mossSlime: ["slime", "#79c05a"],
  boneScout: ["skeleton", "#d8d3c4"],
  caveBat: ["bat", "#8b7bd6"],
  boneCaptain: ["skeleton", "#e8c98a"],
  graveBat: ["bat", "#9c7de0"],
  hexAcolyte: ["mage", "#8f7fd8"],
  graveKnight: ["skeleton", "#cfd6e4"],
  crimsonHerald: ["mage", "#e2605c"],
  orcGuard: ["warrior", "#7fae52"],
  hexWarlock: ["mage", "#a06be0"],
  goldKnight: ["warrior", "#e0b64a"],
  ironWarden: ["warrior", "#9aa6b8"],
  wraithMage: ["mage", "#7fd0d8"],
  zweihander: ["warrior", "#c96f4a"],
  crimsonArchmage: ["mage", "#ff6b5e"],
  falseDemon: ["demon", "#c96be0"],
  darkRider: ["warrior", "#6f7fa8"],
  abyssDrake: ["demon", "#5f9be0"],
  demonKnight: ["demon", "#d05f6e"],
  trueDemon: ["demon", "#ff4d63"],
};

const ITEM_STYLE = {
  A: { kind: "gem", color: "#ff4757", glow: "rgba(255,71,87,0.55)" },
  F: { kind: "gem", color: "#2ed573", glow: "rgba(46,213,115,0.5)" },
  p: { kind: "potion", color: "#ff6b8b", scale: 0.72 },
  P: { kind: "potion", color: "#ff3d6a", scale: 1 },
  g: { kind: "coins", color: "#ffc34d", scale: 0.72 },
  G: { kind: "chest", color: "#c89b52" },
  W: { kind: "sword", color: "#dfe9ff" },
  S: { kind: "shield", color: "#9fc4ff" },
  C: { kind: "cross", color: "#fff2b8" },
  i: { kind: "compass", color: "#ffd76a" },
  T: { kind: "thief", color: "#9c8fa8" },
  M: { kind: "shop", color: "#ffcf6b" },
  Z: { kind: "princess", color: "#ffd1e6" },
};

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// ── 静态底图（墙体 + 石砖），按楼层缓存，避免每帧重绘 121 格 ──────────────
function paintStatic(cells, floorId, thief) {
  const cv = document.createElement("canvas");
  cv.width = BOARD;
  cv.height = BOARD;
  const ctx = cv.getContext("2d");
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const i = index(x, y);
      const ch = cells[i] === CH.SEALED && thief ? CH.FLOOR : cells[i];
      const px = x * CELL;
      const py = y * CELL;
      const n = hash2(x + floorId * 7, y + floorId * 13);
      if (ch === CH.WALL || ch === CH.SEALED) {
        // 石壁：上亮下暗的砌块 + 边缘高光
        const grad = ctx.createLinearGradient(px, py, px, py + CELL);
        grad.addColorStop(0, ch === CH.SEALED ? "#37303a" : "#333a47");
        grad.addColorStop(1, ch === CH.SEALED ? "#1b1720" : "#181d25");
        ctx.fillStyle = grad;
        ctx.fillRect(px, py, CELL, CELL);
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = `rgba(255,255,255,${0.02 + n * 0.03})`;
        ctx.fillRect(px + 4, py + 4, CELL - 8, 3);
        // 砌缝
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py + CELL * 0.5);
        ctx.lineTo(px + CELL, py + CELL * 0.5);
        ctx.moveTo(px + CELL * (0.3 + n * 0.4), py);
        ctx.lineTo(px + CELL * (0.3 + n * 0.4), py + CELL * 0.5);
        ctx.moveTo(px + CELL * (0.2 + n * 0.5), py + CELL * 0.5);
        ctx.lineTo(px + CELL * (0.2 + n * 0.5), py + CELL);
        ctx.stroke();
        if (ch === CH.SEALED) {
          // 暗墙：符文裂隙
          ctx.strokeStyle = "rgba(180,120,255,0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + CELL * 0.35, py + CELL * 0.2);
          ctx.lineTo(px + CELL * 0.5, py + CELL * 0.45);
          ctx.lineTo(px + CELL * 0.4, py + CELL * 0.62);
          ctx.lineTo(px + CELL * 0.58, py + CELL * 0.82);
          ctx.stroke();
        }
      } else {
        // 石板地面：磨损 + 青苔
        const base = 0.5 + n * 0.5;
        const grad = ctx.createLinearGradient(px, py, px, py + CELL);
        grad.addColorStop(0, `rgb(${Math.round(46 + base * 8)},${Math.round(52 + base * 9)},${Math.round(64 + base * 10)})`);
        grad.addColorStop(1, `rgb(${Math.round(34 + base * 6)},${Math.round(39 + base * 7)},${Math.round(49 + base * 8)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(px, py, CELL, CELL);
        ctx.strokeStyle = "rgba(0,0,0,0.28)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
        if (n > 0.72) {
          ctx.fillStyle = `rgba(90,130,80,${0.14 + (n - 0.72) * 0.8})`;
          ctx.beginPath();
          ctx.arc(px + CELL * (0.2 + n * 0.6), py + CELL * (0.25 + n * 0.5), 4 + n * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (n < 0.14) {
          ctx.strokeStyle = "rgba(0,0,0,0.28)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px + CELL * 0.2, py + CELL * 0.7);
          ctx.lineTo(px + CELL * 0.45, py + CELL * 0.55);
          ctx.lineTo(px + CELL * 0.7, py + CELL * 0.66);
          ctx.stroke();
        }
      }
    }
  }
  return cv;
}

// ── 单格元素绘制 ─────────────────────────────────────────────
function drawDoor(ctx, x, y, ch) {
  const colors = { Y: ["#c99a2e", "#f0c96a"], B: ["#2f6ea8", "#79c5ff"], R: ["#a32b3c", "#ff7b86"] };
  const [dark, light] = colors[ch] || colors.Y;
  const px = x * CELL;
  const py = y * CELL;
  const inset = CELL * 0.1;
  const w = CELL - inset * 2;
  const h = CELL - inset * 2;
  const grad = ctx.createLinearGradient(px, py, px, py + CELL);
  grad.addColorStop(0, light);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  roundRect(ctx, px + inset, py + inset, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 门板凹槽
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  roundRect(ctx, px + inset + 6, py + inset + 6, w - 12, h - 12, 4);
  ctx.fill();
  // 锁孔
  ctx.fillStyle = "rgba(10,10,14,0.85)";
  ctx.beginPath();
  ctx.arc(px + CELL / 2, py + CELL * 0.46, CELL * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(px + CELL / 2 - 1.5, py + CELL * 0.46, 3, CELL * 0.14);
  // 铆钉
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const [rx, ry] of [[0.24, 0.24], [0.76, 0.24], [0.24, 0.78], [0.76, 0.78]]) {
    ctx.beginPath();
    ctx.arc(px + CELL * rx, py + CELL * ry, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStairs(ctx, x, y, up, t) {
  const px = x * CELL;
  const py = y * CELL;
  ctx.fillStyle = "rgba(8,10,14,0.85)";
  roundRect(ctx, px + 6, py + 6, CELL - 12, CELL - 12, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(185,139,74,0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const pulse = 0.55 + Math.sin(t / 520) * 0.25;
  ctx.strokeStyle = `rgba(255,196,110,${pulse})`;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  const cx = px + CELL / 2;
  const cy = py + CELL / 2;
  ctx.beginPath();
  if (up) {
    ctx.moveTo(cx - 11, cy + 4);
    ctx.lineTo(cx, cy - 8);
    ctx.lineTo(cx + 11, cy + 4);
  } else {
    ctx.moveTo(cx - 11, cy - 4);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx + 11, cy - 4);
  }
  ctx.stroke();
  // 阶梯刻线
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 14 + i * 3.2);
    ctx.lineTo(cx + 14, cy + 14 + i * 3.2);
    ctx.stroke();
  }
}

function drawKey(ctx, x, y, ch) {
  const colors = { y: "#ffc23c", b: "#56b7ff", r: "#ff5f6d" };
  const c = colors[ch] || "#ffc23c";
  const px = x * CELL + CELL / 2;
  const py = y * CELL + CELL / 2;
  ctx.save();
  ctx.shadowColor = c;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = c;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(px - 6, py - 7, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px - 1, py - 2);
  ctx.lineTo(px + 8, py + 9);
  ctx.moveTo(px + 8, py + 9);
  ctx.lineTo(px + 13, py + 5);
  ctx.moveTo(px + 4, py + 5);
  ctx.lineTo(px + 8, py + 1);
  ctx.stroke();
  ctx.restore();
}

function drawItem(ctx, x, y, ch, t) {
  const style = ITEM_STYLE[ch];
  if (!style) return;
  const cx = x * CELL + CELL / 2;
  const cy = y * CELL + CELL / 2;
  const bob = Math.sin(t / 620 + x + y) * 2;
  ctx.save();
  ctx.translate(cx, cy + bob);
  if (style.glow) {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, CELL * 0.55);
    g.addColorStop(0, style.glow);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, CELL * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  const scale = style.scale || 1;
  ctx.scale(scale, scale);
  switch (style.kind) {
    case "gem": {
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(5, -2);
      ctx.lineTo(0, 2);
      ctx.lineTo(-5, -2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "potion": {
      ctx.fillStyle = "rgba(240,240,255,0.22)";
      roundRect(ctx, -7, -14, 14, 8, 3);
      ctx.fill();
      ctx.fillStyle = style.color;
      roundRect(ctx, -10, -6, 20, 20, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      roundRect(ctx, -6, -3, 4, 10, 2);
      ctx.fill();
      break;
    }
    case "coins": {
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = i === 2 ? "#ffe08a" : style.color;
        ctx.beginPath();
        ctx.ellipse(0, 8 - i * 6, 12 - i, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "chest": {
      ctx.fillStyle = "#6b4a24";
      roundRect(ctx, -14, -6, 28, 20, 4);
      ctx.fill();
      ctx.fillStyle = style.color;
      roundRect(ctx, -14, -13, 28, 12, 5);
      ctx.fill();
      ctx.fillStyle = "#3a2712";
      ctx.fillRect(-2, -8, 4, 10);
      break;
    }
    case "sword": {
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-8, 10);
      ctx.lineTo(9, -11);
      ctx.stroke();
      ctx.strokeStyle = "#b98b4a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-11, 5);
      ctx.lineTo(-1, 13);
      ctx.stroke();
      break;
    }
    case "shield": {
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(12, -8);
      ctx.lineTo(9, 8);
      ctx.lineTo(0, 15);
      ctx.lineTo(-9, 8);
      ctx.lineTo(-12, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "cross": {
      ctx.shadowColor = "#fff3bd";
      ctx.shadowBlur = 14;
      ctx.fillStyle = style.color;
      ctx.fillRect(-3.5, -15, 7, 30);
      ctx.fillRect(-12, -6, 24, 7);
      break;
    }
    case "compass": {
      ctx.fillStyle = "rgba(20,24,32,0.9)";
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "#ff5f6d";
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(3, 0);
      ctx.lineTo(0, 2);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e8eefc";
      ctx.beginPath();
      ctx.moveTo(0, 9);
      ctx.lineTo(3, 0);
      ctx.lineTo(0, -2);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "thief": {
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(11, 4);
      ctx.lineTo(6, 14);
      ctx.lineTo(-6, 14);
      ctx.lineTo(-11, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1a1d24";
      ctx.beginPath();
      ctx.arc(0, -1, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd76a";
      ctx.fillRect(-4, -2, 2.5, 2);
      ctx.fillRect(2, -2, 2.5, 2);
      break;
    }
    case "shop": {
      ctx.fillStyle = "rgba(20,24,32,0.85)";
      roundRect(ctx, -15, -10, 30, 25, 4);
      ctx.fill();
      const stripes = ["#c0392b", "#f3e6cf"];
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = stripes[i % 2];
        ctx.beginPath();
        ctx.moveTo(-15 + i * 5, -10);
        ctx.lineTo(-10 + i * 5, -10);
        ctx.lineTo(-12 + i * 5, -19);
        ctx.lineTo(-17 + i * 5, -19);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#ffcf6b";
      ctx.beginPath();
      ctx.arc(0, 3, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "princess": {
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(11, 15);
      ctx.lineTo(-11, 15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffe3f1";
      ctx.beginPath();
      ctx.arc(0, -9, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffcf6b";
      ctx.beginPath();
      ctx.moveTo(-9, -13);
      ctx.lineTo(-5, -20);
      ctx.lineTo(0, -14);
      ctx.lineTo(5, -20);
      ctx.lineTo(9, -13);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function drawMonster(ctx, x, y, id, t) {
  const [arch, color] = ARCHETYPE[id] || ["slime", "#b06fd0"];
  const mon = MONSTERS[id];
  const px = x * CELL + CELL / 2;
  const py = y * CELL + CELL / 2;
  const boss = Boolean(mon?.boss);
  const breathe = Math.sin(t / 480 + x * 1.7 + y) * 1.6;
  ctx.save();
  ctx.translate(px, py + breathe);
  const s = boss ? 1.24 : 1;
  ctx.scale(s, s);
  ctx.shadowColor = color;
  ctx.shadowBlur = boss ? 18 : 9;
  ctx.fillStyle = color;

  if (arch === "slime") {
    ctx.beginPath();
    ctx.moveTo(-16, 12);
    ctx.quadraticCurveTo(-18, -8, 0, -12);
    ctx.quadraticCurveTo(18, -8, 16, 12);
    ctx.quadraticCurveTo(0, 18, -16, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0b0d12";
    ctx.beginPath();
    ctx.arc(-6, -1, 3, 0, Math.PI * 2);
    ctx.arc(6, -1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(-7, -8, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (arch === "bat") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-20, -14, -22, 4);
    ctx.quadraticCurveTo(-12, 2, -4, 8);
    ctx.quadraticCurveTo(4, 8, 12, 2);
    ctx.quadraticCurveTo(20, 0, 22, 4);
    ctx.quadraticCurveTo(18, -14, 0, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(-3.4, 3, 2, 0, Math.PI * 2);
    ctx.arc(3.4, 3, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (arch === "skeleton") {
    ctx.beginPath();
    ctx.arc(0, -6, 9, 0, Math.PI * 2);
    ctx.fill();
    roundRect(ctx, -8, 2, 16, 12, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#12141a";
    ctx.beginPath();
    ctx.arc(-3.6, -7, 2.6, 0, Math.PI * 2);
    ctx.arc(3.6, -7, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let i = 0; i < 3; i += 1) ctx.fillRect(-6, 5 + i * 3.4, 12, 1.6);
    if (boss) {
      ctx.fillStyle = "#ffcf6b";
      ctx.beginPath();
      ctx.moveTo(-10, -13);
      ctx.lineTo(-6, -20);
      ctx.lineTo(0, -14);
      ctx.lineTo(6, -20);
      ctx.lineTo(10, -13);
      ctx.closePath();
      ctx.fill();
    }
  } else if (arch === "warrior") {
    ctx.beginPath();
    ctx.moveTo(-11, 14);
    ctx.lineTo(-9, -6);
    ctx.quadraticCurveTo(0, -16, 9, -6);
    ctx.lineTo(11, 14);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(10,12,18,0.85)";
    roundRect(ctx, -7, -12, 14, 6, 2);
    ctx.fill();
    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(-4.5, -10, 3, 2);
    ctx.fillRect(1.5, -10, 3, 2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    roundRect(ctx, -12, 0, 5, 16, 2.5);
    ctx.fill();
    if (boss) {
      ctx.fillStyle = "#ffcf6b";
      ctx.beginPath();
      ctx.moveTo(-9, -14);
      ctx.lineTo(-5, -21);
      ctx.lineTo(0, -15);
      ctx.lineTo(5, -21);
      ctx.lineTo(9, -14);
      ctx.closePath();
      ctx.fill();
    }
  } else if (arch === "mage") {
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.quadraticCurveTo(14, -2, 12, 15);
    ctx.lineTo(-12, 15);
    ctx.quadraticCurveTo(-14, -2, 0, -16);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0b0d12";
    ctx.beginPath();
    ctx.ellipse(0, -3, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9be7ff";
    ctx.beginPath();
    ctx.arc(-2.4, -4, 1.8, 0, Math.PI * 2);
    ctx.arc(2.4, -4, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(13, -14);
    ctx.lineTo(13, 14);
    ctx.stroke();
    ctx.fillStyle = "#b6f2ff";
    ctx.beginPath();
    ctx.arc(13, -16, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // demon
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(12, -6);
    ctx.lineTo(10, 14);
    ctx.lineTo(-10, 14);
    ctx.lineTo(-12, -6);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffb347";
    ctx.beginPath();
    ctx.moveTo(-9, -12);
    ctx.lineTo(-13, -21);
    ctx.lineTo(-4, -15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -12);
    ctx.lineTo(13, -21);
    ctx.lineTo(4, -15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1b0d12";
    ctx.beginPath();
    ctx.ellipse(0, -2, 6.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath();
    ctx.arc(-2.6, -3, 1.9, 0, Math.PI * 2);
    ctx.arc(2.6, -3, 1.9, 0, Math.PI * 2);
    ctx.fill();
    if (boss) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "rgba(255,220,150,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -2, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHero(ctx, x, y, t, walking) {
  const px = x * CELL + CELL / 2;
  const py = y * CELL + CELL / 2 + (walking ? Math.sin(t / 90) * 2 : Math.sin(t / 700) * 1.2);
  ctx.save();
  ctx.translate(px, py);
  // 地面投影
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 17, 13, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 披风
  ctx.fillStyle = "#2f5fbf";
  ctx.beginPath();
  ctx.moveTo(-11, -4);
  ctx.quadraticCurveTo(-16, 12, -8, 16);
  ctx.lineTo(8, 16);
  ctx.quadraticCurveTo(16, 12, 11, -4);
  ctx.closePath();
  ctx.fill();
  // 身体
  ctx.fillStyle = "#4d7fe0";
  roundRect(ctx, -7, -6, 14, 18, 5);
  ctx.fill();
  // 头盔
  ctx.fillStyle = "#d9e2ee";
  ctx.beginPath();
  ctx.arc(0, -10, 8, Math.PI, 0);
  ctx.lineTo(8, -4);
  ctx.lineTo(-8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(-6, -7, 12, 3);
  // 剑
  ctx.strokeStyle = "#e8f0ff";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(9, 2);
  ctx.lineTo(15, -12);
  ctx.stroke();
  ctx.restore();
}

function drawThreat(ctx, x, y, preview, text) {
  const px = x * CELL + CELL;
  const py = y * CELL + 6;
  const threat = threatOf(preview);
  const color = threat === "clear" ? "#6fdc8c" : threat === "hurt" ? "#ffab4a" : "#ff5d6c";
  const label = threat === "fatal" ? text : threat === "clear" ? "0" : `-${preview.damage}`;
  ctx.save();
  ctx.font = "700 13px system-ui, sans-serif";
  const w = ctx.measureText(label).width + 10;
  ctx.fillStyle = "rgba(8,10,14,0.82)";
  roundRect(ctx, px - w - 4, py, w, 17, 8);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, px - w / 2 - 4, py + 9);
  ctx.restore();
}

// ── 视图主体 ────────────────────────────────────────────────
export function createUi({ doc, game, translate, onSfx, onPersist, onRestart, onLang, onSoundToggle }) {
  const $ = (id) => doc.getElementById(id);
  const canvas = $("board");
  const ctx = canvas.getContext("2d");
  const fx = $("fx-layer");

  const els = {
    floor: $("floor-value"),
    zone: $("zone-name"),
    hp: $("hp-value"),
    hpFill: $("hp-fill"),
    atk: $("atk-value"),
    def: $("def-value"),
    gold: $("gold-value"),
    keyY: $("key-y"),
    keyB: $("key-b"),
    keyR: $("key-r"),
    radar: $("radar"),
    bestDamage: $("best-damage"),
    bestSteps: $("best-steps"),
    undo: $("btn-undo"),
    undo2: $("btn-undo-2"),
    snap: $("btn-snap"),
    shopPanel: $("shop-panel"),
    shopList: $("shop-list"),
    compassPanel: $("compass-panel"),
    compassList: $("compass-list"),
    codexPanel: $("codex-panel"),
    codexList: $("codex-list"),
    helpPanel: $("help-panel"),
    resultPanel: $("result-panel"),
    resultTitle: $("result-title"),
    resultEnding: $("result-ending"),
    resultStats: $("result-stats"),
    resultRank: $("result-rank"),
    resultAgain: $("result-again"),
    sound: $("btn-sound"),
    lang: $("btn-lang"),
    toast: null,
  };

  let locale = "zh";
  let staticLayer = null;
  let staticFloor = -1;
  let torches = [];
  let heroWalkUntil = 0;
  let lastFloor = 1;

  // 简易提示条（挂在舞台下方）
  const toastEl = doc.createElement("p");
  toastEl.id = "toast";
  toastEl.setAttribute("aria-live", "polite");
  $("board-frame").insertAdjacentElement("afterend", toastEl);
  els.toast = toastEl;
  let toastTimer = 0;

  function t(key, vars) {
    return translate(locale, key, vars);
  }

  function setupCanvas() {
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    canvas.width = Math.round(BOARD * dpr);
    canvas.height = Math.round(BOARD * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rebuildStatic(state) {
    const floor = currentFloor(state);
    staticLayer = paintStatic(floor.cells, floor.id, state.flags.thief);
    staticFloor = floor.id;
    // 火把位置：贴墙且靠内的固定格，按楼层确定性挑选
    torches = [];
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const ch = floor.cells[index(x, y)];
        if (ch !== CH.WALL) continue;
        const nearFloor = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) return false;
          const c = floor.cells[index(nx, ny)];
          return c !== CH.WALL;
        });
        if (!nearFloor) continue;
        if (hash2(x + floor.id, y * 3) > 0.9) torches.push({ x, y });
      }
    }
    torches = torches.slice(0, 6);
  }

  function drawTorches(time) {
    for (const torch of torches) {
      const cx = torch.x * CELL + CELL / 2;
      const cy = torch.y * CELL + CELL / 2;
      const pulse = 0.75 + Math.sin(time / 420 + torch.x * 1.3 + torch.y) * 0.25;
      const radius = CELL * (1.9 + pulse * 0.35);
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
      grad.addColorStop(0, `rgba(255,168,86,${0.34 * pulse})`);
      grad.addColorStop(0.45, `rgba(255,120,50,${0.13 * pulse})`);
      grad.addColorStop(1, "rgba(255,90,40,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      // 火苗
      ctx.fillStyle = `rgba(255,205,120,${0.85 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 3, 3.4, 6.5 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(state, time) {
    const floor = currentFloor(state);
    if (floor.id !== staticFloor) rebuildStatic(state);
    ctx.clearRect(0, 0, BOARD, BOARD);
    if (staticLayer) ctx.drawImage(staticLayer, 0, 0, BOARD, BOARD, 0, 0, BOARD, BOARD);

    // 迷雾/暗角
    const vign = ctx.createRadialGradient(BOARD / 2, BOARD / 2, BOARD * 0.2, BOARD / 2, BOARD / 2, BOARD * 0.78);
    vign.addColorStop(0, "rgba(0,0,0,0)");
    vign.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, BOARD, BOARD);

    drawTorches(time);

    const walking = time < heroWalkUntil;

    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const i = index(x, y);
        const ch = floor.cells[i];
        if (ch === CH.WALL || ch === CH.SEALED) continue;
        if (ch === CH.DOOR_Y || ch === CH.DOOR_B || ch === CH.DOOR_R) drawDoor(ctx, x, y, ch);
        else if (ch === CH.UP) drawStairs(ctx, x, y, true, time);
        else if (ch === CH.DOWN) drawStairs(ctx, x, y, false, time);
        else if (ch === "y" || ch === "b" || ch === "r") drawKey(ctx, x, y, ch);
        else if (ITEM_STYLE[ch]) drawItem(ctx, x, y, ch, time);
      }
    }

    // 勇者脚下高亮
    const hx = state.x * CELL;
    const hy = state.y * CELL;
    ctx.save();
    ctx.strokeStyle = "rgba(140,200,255,0.5)";
    ctx.lineWidth = 2;
    roundRect(ctx, hx + 3, hy + 3, CELL - 6, CELL - 6, 7);
    ctx.stroke();
    ctx.restore();

    // 魔物 + 战损标注
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const i = index(x, y);
        const ch = floor.cells[i];
        if (!isMonsterChar(floor, ch)) continue;
        const id = monsterIdOf(floor, ch);
        drawMonster(ctx, x, y, id, time);
        const preview = battlePreview(state, MONSTERS[id]);
        drawThreat(ctx, x, y, preview, t("threatFatal"));
      }
    }

    drawHero(ctx, state.x, state.y, time, walking);
  }

  // ── HUD ────────────────────────────────────────────────
  function renderHud(state) {
    const floor = currentFloor(state);
    els.floor.textContent = String(state.floor);
    els.zone.textContent = zoneName(locale, floor.zone);
    els.hp.textContent = `${formatNumber(state.hp)}/${formatNumber(state.hpMax)}`;
    const pct = Math.max(0, Math.min(100, (state.hp / Math.max(1, state.hpMax)) * 100));
    els.hpFill.style.width = `${pct}%`;
    els.atk.textContent = String(state.atk);
    els.def.textContent = String(state.def);
    els.gold.textContent = formatNumber(state.gold);
    els.keyY.textContent = String(state.keys.y);
    els.keyB.textContent = String(state.keys.b);
    els.keyR.textContent = String(state.keys.r);
    els.undo.disabled = !game.canUndo();
    els.undo2.disabled = !game.canUndo();
  }

  function renderRadar(state) {
    const list = floorMonsters(state);
    els.radar.innerHTML = "";
    if (!list.length) {
      const li = doc.createElement("li");
      li.className = "empty";
      li.textContent = t("radarEmpty");
      els.radar.appendChild(li);
      return;
    }
    for (const entry of list) {
      const li = doc.createElement("li");
      li.className = `radar-item threat-${entry.threat}`;
      const icon = doc.createElement("span");
      icon.className = "radar-icon";
      icon.textContent = entry.mon.boss ? "☠" : entry.count > 1 ? "⚔" : "•";
      const body = doc.createElement("div");
      body.className = "radar-body";
      const name = doc.createElement("span");
      name.className = "radar-name";
      name.textContent = `${monsterName(locale, entry.id)} ×${entry.count}`;
      const stats = doc.createElement("span");
      stats.className = "radar-stats";
      stats.textContent = `HP ${entry.mon.hp} · ATK ${entry.mon.atk} · DEF ${entry.mon.def}`;
      body.append(name, stats);
      const dmg = doc.createElement("span");
      dmg.className = "radar-damage";
      dmg.textContent = entry.threat === "fatal" ? t("threatFatal") : entry.threat === "clear" ? "0" : `-${entry.preview.damage}`;
      li.append(icon, body, dmg);
      els.radar.appendChild(li);
    }
  }

  function renderRecords(meta) {
    if (!meta) return;
    els.bestDamage.textContent = meta.best.damage === null ? t("noRecord") : formatNumber(meta.best.damage);
    els.bestSteps.textContent = meta.best.steps === null ? t("noRecord") : formatNumber(meta.best.steps);
  }

  function render(state) {
    if (state.floor !== lastFloor) {
      lastFloor = state.floor;
      }
    renderHud(state);
    renderRadar(state);
  }

  function loop(time) {
    const state = game.getState();
    draw(state, time);
    if (typeof window !== "undefined") window.requestAnimationFrame(loop);
  }

  // ── 弹层 ───────────────────────────────────────────────
  function open(panel) {
    panel.hidden = false;
  }

  function close(panel) {
    panel.hidden = true;
  }

  function renderShop(state) {
    const options = shopOptions(state);
    els.shopList.innerHTML = "";
    for (const option of options) {
      const li = doc.createElement("li");
      li.className = "shop-item";
      const name = doc.createElement("span");
      name.className = "shop-name";
      const key = option.kind === "hp" ? "shopHp" : option.kind === "atk" ? "shopAtk" : "shopDef";
      name.textContent = t(key, { n: option.amount });
      const sub = doc.createElement("span");
      sub.className = "shop-sub";
      sub.textContent = t("boughtTimes", { n: option.bought });
      name.appendChild(sub);
      const price = doc.createElement("span");
      price.className = "shop-price";
      price.textContent = `${option.price} ${t("gold")}`;
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "shop-buy";
      btn.textContent = option.affordable ? t("buy") : t("poor");
      btn.disabled = !option.affordable;
      btn.addEventListener("click", () => {
        const result = game.buy(option.kind);
        if (result.action) onSfx("buy");
        else onSfx("blocked");
        renderShop(game.getState());
        render(game.getState());
        onPersist();
      });
      li.append(name, price, btn);
      els.shopList.appendChild(li);
    }
  }

  function renderCompass(state) {
    els.compassList.innerHTML = "";
    if (!state.flags.compass) {
      const li = doc.createElement("li");
      li.className = "empty";
      li.textContent = t("compassLocked");
      els.compassList.appendChild(li);
      return;
    }
    for (const floorNo of game.visitedFloors()) {
      const li = doc.createElement("li");
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = `floor-btn${floorNo === state.floor ? " current" : ""}`;
      btn.textContent = `${floorNo}${t("floorSuffix")}`;
      btn.disabled = floorNo === state.floor;
      btn.addEventListener("click", () => {
        const result = game.travel(floorNo);
        if (result.action) {
          onSfx("stairs");
          close(els.compassPanel);
          onPersist();
        }
      });
      li.appendChild(btn);
      els.compassList.appendChild(li);
    }
  }

  function renderCodex(state) {
    els.codexList.innerHTML = "";
    const seen = new Set();
    for (let i = 1; i <= state.floors.length; i += 1) {
      const floor = state.floors[i - 1];
      if (!floor.visited) continue;
      for (const ch of floor.cells) {
        if (!isMonsterChar(floor, ch)) continue;
        seen.add(monsterIdOf(floor, ch));
      }
    }
    if (!seen.size) {
      const li = doc.createElement("li");
      li.className = "empty";
      li.textContent = t("radarEmpty");
      els.codexList.appendChild(li);
      return;
    }
    const entries = [...seen].map((id) => ({ id, mon: MONSTERS[id] })).sort((a, b) => a.mon.tier - b.mon.tier || a.mon.hp - b.mon.hp);
    for (const entry of entries) {
      const preview = battlePreview(state, entry.mon);
      const threat = threatOf(preview);
      const li = doc.createElement("li");
      li.className = `radar-item threat-${threat}`;
      const icon = doc.createElement("span");
      icon.className = "radar-icon";
      icon.textContent = entry.mon.boss ? "☠" : "•";
      const body = doc.createElement("div");
      body.className = "radar-body";
      const name = doc.createElement("span");
      name.className = "radar-name";
      name.textContent = monsterName(locale, entry.id);
      const stats = doc.createElement("span");
      stats.className = "radar-stats";
      stats.textContent = `HP ${entry.mon.hp} · ATK ${entry.mon.atk} · DEF ${entry.mon.def} · ${entry.mon.gold} ${t("gold")}`;
      body.append(name, stats);
      const dmg = doc.createElement("span");
      dmg.className = "radar-damage";
      dmg.textContent = threat === "fatal" ? t("threatFatal") : threat === "clear" ? "0" : `-${preview.damage}`;
      li.append(icon, body, dmg);
      els.codexList.appendChild(li);
    }
  }

  function showResult(state, best) {
    const summary = summarize(state);
    els.resultTitle.textContent = summary.won ? t("victoryTitle") : t("defeatTitle");
    els.resultEnding.textContent = summary.ending === "normal" ? t("endingNormal") : t("endingTrue");
    els.resultStats.innerHTML = "";
    const rows = [
      ["statSteps", formatNumber(summary.steps)],
      ["statDamage", formatNumber(summary.damage)],
      ["statSlain", formatNumber(summary.slain)],
      ["statHpLeft", `${formatNumber(summary.hpLeft)} / ${formatNumber(summary.hpMax)}`],
    ];
    for (const [key, value] of rows) {
      const dt = doc.createElement("dt");
      dt.textContent = t(key);
      const dd = doc.createElement("dd");
      dd.textContent = value;
      els.resultStats.append(dt, dd);
    }
    const rankKey = `rank${summary.rank.charAt(0).toUpperCase()}${summary.rank.slice(1)}`;
    const better = best && (best.improved ? ` · ${t("newBest")}` : "");
    els.resultRank.textContent = `${t("rankLabel")}：${t(rankKey)}${better}`;
    open(els.resultPanel);
  }

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove("show");
    }, 1600);
  }

  function flashAt(x, y, text, variant) {
    const rect = canvas.getBoundingClientRect();
    const layerRect = fx.getBoundingClientRect();
    const scale = rect.width / BOARD;
    const el = doc.createElement("span");
    el.className = `float-text${variant ? ` is-${variant}` : ""}`;
    el.textContent = text;
    el.style.left = `${(x * CELL + CELL / 2) * scale + (rect.left - layerRect.left)}px`;
    el.style.top = `${(y * CELL + CELL / 2) * scale + (rect.top - layerRect.top)}px`;
    fx.appendChild(el);
    setTimeout(() => el.remove(), 780);
  }

  function shock() {
    const el = doc.createElement("div");
    el.className = "flash";
    fx.appendChild(el);
    setTimeout(() => el.remove(), 340);
  }

  // ── 事件反馈（由 main 在动作后调用） ────────────────────
  function afterAction(result) {
    const state = game.getState();
    for (const event of result.events || []) {
      switch (event.type) {
        case "battle":
          onSfx("battle");
          shock();
          flashAt(state.x, state.y, `-${event.damage}`, "bad");
          break;
        case "door":
          onSfx("door");
          break;
        case "pickup":
          if (event.kind === "gold") {
            onSfx("coin");
            flashAt(state.x, state.y, `+${event.amount}`, "good");
          } else if (event.kind === "hp") {
            onSfx("potion");
            flashAt(state.x, state.y, `+${event.amount}`, "good");
          } else if (event.kind === "atk") {
            onSfx("atkGem");
            flashAt(state.x, state.y, `ATK +${event.amount}`, "good");
          } else if (event.kind === "def") {
            onSfx("defGem");
            flashAt(state.x, state.y, `DEF +${event.amount}`, "good");
          } else if (event.kind === "key") {
            onSfx("coin");
            toast(t("gainKey"));
          }
          break;
        case "flag":
          if (event.flag === "cross") toast(t("crossFound"));
          if (event.flag === "compass") toast(t("compassFound"));
          if (event.flag === "thief") toast(t("thiefFreed"));
          break;
        case "stairs":
          onSfx("stairs");
          heroWalkUntil = 0;
          break;
        case "blocked":
          onSfx("blocked");
          break;
        case "victory":
          onSfx("win");
          break;
        case "undo":
          onSfx("undo");
          break;
        default:
          break;
      }
    }
    if (result.action && (result.action.type === "walk" || result.action.type === "battle")) {
      heroWalkUntil = (typeof performance !== "undefined" ? performance.now() : Date.now()) + 140;
    }
    if (state.floor !== lastFloor) {
      }
    render(state);
  }

  function applyLocale(nextLocale) {
    locale = nextLocale;
    doc.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    const dict = (key) => translate(locale, key);
    doc.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = dict(key);
    });
    doc.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key) el.setAttribute("aria-label", dict(key));
    });
    doc.title = dict("docTitle");
    els.lang.textContent = dict("langBtn");
    const state = game.getState();
    render(state);
    if (!els.shopPanel.hidden) renderShop(state);
    if (!els.compassPanel.hidden) renderCompass(state);
    if (!els.codexPanel.hidden) renderCodex(state);
  }

  function syncSound(on) {
    els.sound.textContent = on ? "🔊" : "🔇";
    els.sound.setAttribute("aria-pressed", on ? "false" : "true");
  }

  // 盘面点击 → 自动寻路
  function onCanvasClick(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * GRID);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * GRID);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    const state = game.getState();
    if (state.status !== "playing") return;
    if (x === state.x && y === state.y) {
      // 点自己：站在楼梯上等于再次上下楼
      const here = cellAt(state, x, y);
      if (here === CH.UP || here === CH.DOWN) {
        const result = game.use();
        afterAction(result);
        if (result.action) onPersist();
      }
      return;
    }
    const result = game.pathTo(x, y);
    if (!result.action) {
      onSfx("blocked");
      toast(t("autoPathBlocked"));
      return;
    }
    afterAction(result);
    onPersist();
  }

  function bind() {
    canvas.addEventListener("click", onCanvasClick);
    doc.querySelectorAll("[data-dir]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const result = game.moveKey(btn.getAttribute("data-dir"));
        afterAction(result);
        if (result.action) onPersist();
      });
    });
    els.undo.addEventListener("click", () => {
      const before = game.getState().floor;
      const result = game.undo();
      if (!result.action) return;
      afterAction(result);
      onPersist();
    });
    els.undo2.addEventListener("click", () => els.undo.click());
    els.snap.addEventListener("click", () => {
      const result = game.restoreFloor();
      if (!result.action) return;
      afterAction(result);
      onPersist();
    });
    $("btn-compass").addEventListener("click", () => {
      renderCompass(game.getState());
      open(els.compassPanel);
    });
    $("compass-close").addEventListener("click", () => close(els.compassPanel));
    $("btn-codex").addEventListener("click", () => {
      renderCodex(game.getState());
      open(els.codexPanel);
    });
    $("codex-close").addEventListener("click", () => close(els.codexPanel));
    $("btn-help").addEventListener("click", () => open(els.helpPanel));
    $("help-close").addEventListener("click", () => close(els.helpPanel));
    $("shop-close").addEventListener("click", () => close(els.shopPanel));
    els.resultAgain.addEventListener("click", () => {
      close(els.resultPanel);
      onRestart();
    });
    els.sound.addEventListener("click", () => onSoundToggle());
    els.lang.addEventListener("click", () => onLang());
    doc.querySelectorAll(".overlay").forEach((panel) => {
      panel.addEventListener("click", (ev) => {
        if (ev.target === panel) close(panel);
      });
    });
    doc.addEventListener("keydown", (ev) => {
      const tag = (ev.target && ev.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const map = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
        W: "up",
        S: "down",
        A: "left",
        D: "right",
      };
      if (map[ev.key]) {
        ev.preventDefault();
        const result = game.moveKey(map[ev.key]);
        afterAction(result);
        if (result.action) onPersist();
        return;
      }
      if (ev.key === "z" || ev.key === "Z") {
        ev.preventDefault();
        els.undo.click();
      }
      if (ev.key === "Escape") {
        doc.querySelectorAll(".overlay:not([hidden])").forEach((panel) => close(panel));
      }
    });
  }

  setupCanvas();
  bind();

  return {
    render,
    renderRecords,
    afterAction,
    applyLocale,
    syncSound,
    toast,
    showResult,
    openShop() {
      renderShop(game.getState());
      open(els.shopPanel);
    },
    closeShop() {
      close(els.shopPanel);
    },
    start() {
      const state = game.getState();
      rebuildStatic(state);
      render(state);
      if (typeof window !== "undefined") window.requestAnimationFrame(loop);
    },
  };
}
