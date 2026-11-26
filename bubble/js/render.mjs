/**
 * 极简泡泡堂 · 水泡大作战 (Bubble Arena Lite)
 * 水上乐园网格 Canvas 2D 高清微雕渲染器 (水泡果冻质感、十字水浪与困敌气泡)
 */

import { COLS, ROWS, TILE } from "./engine.mjs";
import { t } from "./i18n.mjs";

export const CELL_SIZE = 48;
export const CANVAS_WIDTH = COLS * CELL_SIZE; // 624
export const CANVAS_HEIGHT = ROWS * CELL_SIZE; // 528

export function createArenaRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let animTime = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || CANVAS_WIDTH;
    const height = rect.height || CANVAS_HEIGHT;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render(state, dt = 0.016) {
    animTime += dt;
    const width = canvas.clientWidth || CANVAS_WIDTH;
    const height = canvas.clientHeight || CANVAS_HEIGHT;

    const scaleX = width / CANVAS_WIDTH;
    const scaleY = height / CANVAS_HEIGHT;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    // 1. 绘制泳池瓷砖底板
    drawPoolFloor();

    // 2. 绘制硬墙与软箱障碍
    drawObstacles(state.grid);

    // 3. 绘制散落道具
    drawItems(state.droppedItems);

    // 4. 绘制水泡
    drawBubbles(state.bubbles);

    // 5. 绘制角色 (含困在水泡中的特效)
    drawPlayers(state.players);

    // 6. 绘制水柱爆炸浪花
    drawSplashes(state.splashes);

    ctx.restore();
  }

  function drawPoolFloor() {
    // 碧蓝清澈泳池水纹背景
    ctx.fillStyle = "#0c2b3d";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 瓷砖格纹与环境光
    ctx.strokeStyle = "rgba(40, 130, 175, 0.25)";
    ctx.lineWidth = 1;

    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(CANVAS_WIDTH, r * CELL_SIZE);
      ctx.stroke();
    }

    // 水面柔和焦散光斑 (Caustics)
    const wave = Math.sin(animTime * 1.5) * 8;
    ctx.fillStyle = "rgba(100, 220, 255, 0.05)";
    ctx.beginPath();
    ctx.ellipse(CANVAS_WIDTH / 2 + wave, CANVAS_HEIGHT / 2 - wave, 220, 140, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawObstacles(grid) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = grid[r][c];
        const x = c * CELL_SIZE;
        const y = r * CELL_SIZE;

        if (type === TILE.HARD) {
          // 坚硬石质防滑池壁 (立体微浮雕)
          ctx.fillStyle = "#164459";
          ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);

          ctx.fillStyle = "#276885";
          ctx.fillRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);

          // 顶部高光倒角
          ctx.fillStyle = "#489bbd";
          ctx.fillRect(x + 4, y + 4, CELL_SIZE - 8, 4);

          ctx.strokeStyle = "#0d2b38";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        } else if (type === TILE.SOFT) {
          // 漂浮软木箱 / 救生浮木
          ctx.fillStyle = "#a86835";
          ctx.fillRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);

          ctx.fillStyle = "#c7834a";
          ctx.fillRect(x + 6, y + 6, CELL_SIZE - 12, CELL_SIZE - 12);

          // 浮木横向柳钉带
          ctx.fillStyle = "#5c3314";
          ctx.fillRect(x + 6, y + CELL_SIZE / 2 - 2, CELL_SIZE - 12, 4);

          ctx.strokeStyle = "#42220b";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
        }
      }
    }
  }

  function drawItems(items) {
    for (const it of items) {
      const cx = (it.col + 0.5) * CELL_SIZE;
      const cy = (it.row + 0.5) * CELL_SIZE + Math.sin(animTime * 4 + it.col) * 3;

      // 道具微光底盘
      ctx.fillStyle = "rgba(255, 230, 100, 0.35)";
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();

      // 道具图标
      ctx.fillStyle = "#ffd54f";
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#1a237e";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let symbol = "+1";
      if (it.type === "item_bubble") symbol = t("item_bubble_sym");
      else if (it.type === "item_splash") symbol = t("item_splash_sym");
      else if (it.type === "item_boots") symbol = t("item_boots_sym");
      else if (it.type === "item_kick") symbol = t("item_kick_sym");
      else if (it.type === "item_needle") symbol = t("item_needle_sym");
      else if (it.type === "item_shield") symbol = t("item_shield_sym");

      ctx.fillText(symbol, cx, cy);
    }
  }

  function drawBubbles(bubbles) {
    for (const b of bubbles) {
      const cx = (b.col + 0.5) * CELL_SIZE;
      const cy = (b.row + 0.5) * CELL_SIZE;

      // 临爆前膨胀与高频闪烁
      const isUrgent = b.fuse < 0.6;
      const pulse = isUrgent ? Math.sin(animTime * 24) * 3 : Math.sin(animTime * 6) * 1.5;
      const radius = 17 + pulse;

      // 水泡阴影
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, radius * 0.8, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // 果冻渐变水泡球体
      const grad = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        2,
        cx,
        cy,
        radius
      );
      grad.addColorStop(0, "rgba(220, 255, 255, 0.95)");
      grad.addColorStop(0.4, isUrgent ? "rgba(255, 120, 100, 0.75)" : "rgba(64, 215, 255, 0.75)");
      grad.addColorStop(0.85, isUrgent ? "rgba(220, 50, 40, 0.6)" : "rgba(10, 140, 220, 0.6)");
      grad.addColorStop(1, "rgba(5, 80, 160, 0.85)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // 顶部高光弧线
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.beginPath();
      ctx.ellipse(cx - radius * 0.35, cy - radius * 0.35, radius * 0.3, radius * 0.18, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayers(players) {
    for (const p of players) {
      if (!p.alive) continue;
      const px = p.x * CELL_SIZE;
      const py = p.y * CELL_SIZE;

      if (p.trapped) {
        // 核心机制展示：困在大透明水泡中！
        const trapRadius = 22 + Math.sin(animTime * 8) * 2;

        // 困泡球体
        const trapGrad = ctx.createRadialGradient(
          px - trapRadius * 0.3,
          py - trapRadius * 0.3,
          3,
          px,
          py,
          trapRadius
        );
        trapGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        trapGrad.addColorStop(0.5, "rgba(120, 230, 255, 0.65)");
        trapGrad.addColorStop(1, "rgba(20, 120, 200, 0.85)");

        ctx.fillStyle = trapGrad;
        ctx.beginPath();
        ctx.arc(px, py, trapRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // 内部眩晕挥手的小角色
        ctx.fillStyle = p.id === 0 ? "#1e88e5" : "#e53935";
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();

        // 眩晕晕圈
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = 1.5;
        const starAngle = animTime * 6;
        ctx.beginPath();
        ctx.arc(px, py - 14, 6, starAngle, starAngle + Math.PI);
        ctx.stroke();
        continue;
      }

      // 正常角色形象 (软胶小潜水员)
      // 阴影
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(px, py + 12, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 潜水员主体 (P1 蓝 / P2 红)
      const isP1 = p.id === 0;
      ctx.fillStyle = isP1 ? "#1976d2" : "#d32f2f";
      ctx.beginPath();
      ctx.arc(px, py - 2, 14, 0, Math.PI * 2);
      ctx.fill();

      // 护目镜面罩
      ctx.fillStyle = "#81d4fa";
      ctx.beginPath();
      ctx.ellipse(px, py - 2, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 潜水呼吸管
      ctx.strokeStyle = "#ffd54f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + 8, py - 6, 6, 0, Math.PI);
      ctx.stroke();

      // 护盾光环
      if (p.hasShield) {
        ctx.strokeStyle = "rgba(255, 215, 0, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py - 2, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawSplashes(splashes) {
    for (const sp of splashes) {
      const cx = (sp.col + 0.5) * CELL_SIZE;
      const cy = (sp.row + 0.5) * CELL_SIZE;
      const alpha = Math.max(0, sp.timer / sp.maxTimer);

      ctx.fillStyle = `rgba(100, 225, 255, ${alpha * 0.75})`;
      ctx.fillRect(sp.col * CELL_SIZE + 2, sp.row * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      // 中心爆炸白浪冲击波
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    resize,
    render,
  };
}
