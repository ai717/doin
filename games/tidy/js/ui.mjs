/**
 * @file games/tidy/js/ui.mjs
 * 纯 Canvas 2D 温暖木桌微缩收纳台渲染器。
 * 驱动原木收纳盒、内阴影卡槽、ASMR 材质好物微雕、悬浮软阴影与通关拍立得定格。
 */

import { isAngleMatch } from './engine.mjs';

export const CANVAS_WIDTH = 840;
export const CANVAS_HEIGHT = 500;

export class TidyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.glassLidProgress = 0; // 0 (敞开) -> 1 (合盖)
  }

  triggerParticles(x, y, color = '#f9e79f') {
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.4;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        size: 3 + Math.random() * 4,
        color,
      });
    }
  }

  update(dt) {
    // 粒子物理更新
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(state) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. 温暖实木书桌背景微纹理与午后斜阳光斑
    this.renderDeskBackground(ctx);

    // 2. 左侧：收纳盒外框与内部几何卡槽 (Organizer Box)
    this.renderOrganizerBox(ctx, state);

    // 3. 右侧：毛毡杂物置物托盘 (Messy Items Tray)
    this.renderMessyTray(ctx);

    // 4. 绘制所有已吸附和未吸附的物件 (未被抓取的优先绘制)
    const heldId = state.heldItemId;
    state.items.forEach((item) => {
      if (item.id !== heldId) {
        this.renderItem(ctx, item, state);
      }
    });

    // 5. 绘制当前正在拖拽的物品 (置顶渲染 + 放大 + 悬空软阴影)
    if (heldId) {
      const heldItem = state.items.find((it) => it.id === heldId);
      if (heldItem) {
        this.renderItem(ctx, heldItem, state, true);
      }
    }

    // 6. 金色吸附微光与漂浮微粒
    this.renderParticles(ctx);

    // 7. 通关合盖仪式动画 (Glass Lid Close)
    if (state.status === 'won') {
      this.glassLidProgress = Math.min(1.0, this.glassLidProgress + 0.03);
      this.renderGlassLid(ctx, state);
    } else {
      this.glassLidProgress = 0;
    }
  }

  renderDeskBackground(ctx) {
    // 温暖燕麦色渐变底板
    const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#ebdcc9');
    bgGrad.addColorStop(0.5, '#dfceb8');
    bgGrad.addColorStop(1, '#cfbea6');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 午后百叶窗柔和暖光斑 (Warm Sunlight Beams)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 250, 240, 0.16)';
    ctx.beginPath();
    ctx.moveTo(120, 0);
    ctx.lineTo(260, 0);
    ctx.lineTo(440, CANVAS_HEIGHT);
    ctx.lineTo(280, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(340, 0);
    ctx.lineTo(480, 0);
    ctx.lineTo(680, CANVAS_HEIGHT);
    ctx.lineTo(520, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  renderOrganizerBox(ctx, state) {
    const boxX = 35;
    const boxY = 30;
    const boxW = 330;
    const boxH = 440;
    const theme = state.level.boxTheme || 'wood';

    ctx.save();

    // 盒身大号软阴影
    ctx.shadowColor = 'rgba(78, 56, 38, 0.22)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;

    // 材质外框
    let outerFill = '#c49a6c';
    let innerFill = '#9a7046';
    let trimColor = '#e0bd96';

    if (theme === 'cosmetic') {
      outerFill = '#f5efe6';
      innerFill = '#d6c8b8';
      trimColor = '#f39c12';
    } else if (theme === 'luggage') {
      outerFill = '#784212';
      innerFill = '#4d2a0b';
      trimColor = '#b7950b';
    } else if (theme === 'tech') {
      outerFill = '#34495e';
      innerFill = '#1a252f';
      trimColor = '#3498db';
    } else if (theme === 'bento') {
      outerFill = '#1c1c1c';
      innerFill = '#922b21';
      trimColor = '#f4d03f';
    }

    // 外框矩形
    ctx.fillStyle = outerFill;
    this.roundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.fill();
    ctx.restore();

    // 外边缘微浮雕高光条
    ctx.save();
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 2.5;
    this.roundRect(ctx, boxX + 4, boxY + 4, boxW - 8, boxH - 8, 16);
    ctx.stroke();

    // 内腔凹槽垫底
    ctx.fillStyle = innerFill;
    this.roundRect(ctx, boxX + 14, boxY + 14, boxW - 28, boxH - 28, 14);
    ctx.fill();

    // 内凹阴影
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 3;
    this.roundRect(ctx, boxX + 15, boxY + 15, boxW - 30, boxH - 30, 13);
    ctx.stroke();
    ctx.restore();

    // 绘制所有卡槽 (Slots)
    state.slots.forEach((slot) => {
      this.renderSlot(ctx, slot, state, boxX + 14, boxY + 14);
    });
  }

  renderSlot(ctx, slot, state, offsetX, offsetY) {
    const isHinted = state.hintSlotId === slot.id;
    const sx = offsetX + slot.x;
    const sy = offsetY + slot.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((slot.rotation * Math.PI) / 180);

    const hw = slot.width / 2;
    const hh = slot.height / 2;

    // 凹槽内阴影底色 (深凹陷质感)
    ctx.fillStyle = 'rgba(25, 18, 12, 0.45)';
    this.drawShape(ctx, slot.shape, -hw, -hh, slot.width, slot.height);
    ctx.fill();

    // 凹槽刻线边缘
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    this.drawShape(ctx, slot.shape, -hw, -hh, slot.width, slot.height);
    ctx.stroke();

    // 透视提示微光脉冲
    if (isHinted && !slot.isOccupied) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
      ctx.shadowColor = '#f39c12';
      ctx.shadowBlur = 16 * pulse;
      ctx.strokeStyle = `rgba(243, 156, 18, ${0.4 + 0.6 * pulse})`;
      ctx.lineWidth = 3;
      this.drawShape(ctx, slot.shape, -hw - 2, -hh - 2, slot.width + 4, slot.height + 4);
      ctx.stroke();
    }

    // 拖拽靠近卡槽时的动态磁吸提示与对齐引导
    const heldId = state.heldItemId;
    if (heldId && slot.itemId === heldId && !slot.isOccupied) {
      const heldItem = state.items.find((it) => it.id === heldId);
      if (heldItem) {
        const slotWorldX = slot.worldX ?? sx;
        const slotWorldY = slot.worldY ?? sy;
        const d = Math.hypot(heldItem.x - slotWorldX, heldItem.y - slotWorldY);
        if (d <= 90) {
          const isAngleOk = isAngleMatch(heldItem.rotation, slot.rotation, heldItem.symmetry || 1);
          ctx.save();
          if (isAngleOk) {
            // 角度契合：金色磁吸高光环绕，提示松手即吸入
            ctx.shadowColor = '#ffd54f';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = 'rgba(255, 213, 79, 0.9)';
            ctx.lineWidth = 2.8;
            this.drawShape(ctx, slot.shape, -hw - 3, -hh - 3, slot.width + 6, slot.height + 6);
            ctx.stroke();
          } else {
            // 角度未对齐：暖橙色虚线提示需要点击或按 R 旋转
            ctx.shadowColor = '#e67e22';
            ctx.shadowBlur = 12;
            ctx.strokeStyle = 'rgba(230, 126, 34, 0.75)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            this.drawShape(ctx, slot.shape, -hw - 2, -hh - 2, slot.width + 4, slot.height + 4);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  renderMessyTray(ctx) {
    const trayX = 390;
    const trayY = 30;
    const trayW = 415;
    const trayH = 440;

    ctx.save();
    // 毛毡底盘柔和阴影
    ctx.shadowColor = 'rgba(78, 56, 38, 0.16)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;

    // 浅原木边框
    ctx.fillStyle = '#d8be9f';
    this.roundRect(ctx, trayX, trayY, trayW, trayH, 20);
    ctx.fill();
    ctx.restore();

    // 托盘毛毡垫 (Soft Linen Mat)
    ctx.save();
    ctx.fillStyle = '#e8d8c3';
    this.roundRect(ctx, trayX + 10, trayY + 10, trayW - 20, trayH - 20, 14);
    ctx.fill();

    // 细微毛毡缝线虚线
    ctx.strokeStyle = 'rgba(164, 134, 107, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    this.roundRect(ctx, trayX + 16, trayY + 16, trayW - 32, trayH - 32, 10);
    ctx.stroke();
    ctx.restore();
  }

  renderItem(ctx, item, state, isDragged = false) {
    // 若已卡入槽位，坐标取槽位绝对坐标；否则在桌面/托盘
    let x = item.x;
    let y = item.y;

    if (item.isSnapped) {
      const slot = state.slots.find((sl) => sl.id === item.snappedSlotId);
      if (slot) {
        x = 35 + 14 + slot.x;
        y = 30 + 14 + slot.y;
      }
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((item.rotation * Math.PI) / 180);

    const scale = isDragged ? 1.08 : 1.0;
    ctx.scale(scale, scale);

    const hw = item.width / 2;
    const hh = item.height / 2;

    // 悬空软阴影
    if (isDragged) {
      ctx.shadowColor = 'rgba(40, 25, 15, 0.38)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 16;
      ctx.shadowOffsetX = 8;
    } else if (!item.isSnapped) {
      ctx.shadowColor = 'rgba(60, 40, 25, 0.2)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
    }

    // 物件主体底色
    ctx.fillStyle = item.color;
    this.drawShape(ctx, item.shape, -hw, -hh, item.width, item.height);
    ctx.fill();

    // 物件细部图案与材质纹理微雕
    this.renderItemDetails(ctx, item, hw, hh);

    // 悬浮或高光边缘
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    this.drawShape(ctx, item.shape, -hw, -hh, item.width, item.height);
    ctx.stroke();

    ctx.restore();
  }

  renderItemDetails(ctx, item, hw, hh) {
    const icon = item.iconType || '';
    ctx.save();

    if (icon === 'pencil') {
      // 铅笔削尖木纹与笔尖铅芯
      ctx.fillStyle = '#fbeee6';
      ctx.beginPath();
      ctx.moveTo(-hw, -hh);
      ctx.lineTo(hw, -hh);
      ctx.lineTo(0, -hh - 18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#2c3e50';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.4, -hh - 8);
      ctx.lineTo(hw * 0.4, -hh - 8);
      ctx.lineTo(0, -hh - 18);
      ctx.closePath();
      ctx.fill();

      // 笔尾橡皮圈
      ctx.fillStyle = item.accentColor || '#34495e';
      ctx.fillRect(-hw, hh - 18, item.width, 18);
    } else if (icon === 'lipstick') {
      // 唇膏斜切切面
      ctx.fillStyle = item.accentColor || '#f1c40f';
      ctx.fillRect(-hw, -hh + item.height * 0.35, item.width, 10);
      ctx.fillStyle = '#78281f';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.7, -hh + 6);
      ctx.lineTo(hw * 0.7, -hh + 18);
      ctx.lineTo(hw * 0.7, -hh + item.height * 0.35);
      ctx.lineTo(-hw * 0.7, -hh + item.height * 0.35);
      ctx.closePath();
      ctx.fill();
    } else if (icon === 'ruler') {
      // 尺子刻度线
      ctx.strokeStyle = item.accentColor || '#7d6608';
      ctx.lineWidth = 1.2;
      for (let y = -hh + 12; y <= hh - 12; y += 12) {
        ctx.beginPath();
        ctx.moveTo(hw - 8, y);
        ctx.lineTo(hw, y);
        ctx.stroke();
      }
    } else if (icon === 'camera') {
      // 胶片相机镜头圆环
      ctx.fillStyle = '#17202a';
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(hw, hh) * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5dade2';
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(hw, hh) * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (icon === 'onigiri') {
      // 三角饭团海苔腰封
      ctx.fillStyle = '#17202a';
      ctx.fillRect(-hw * 0.45, hh - 24, item.width * 0.45, 24);
      // 中间小红梅
      ctx.fillStyle = item.accentColor || '#c0392b';
      ctx.beginPath();
      ctx.arc(0, -hh * 0.1, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (icon === 'sushi') {
      // 手握寿司海苔带
      ctx.fillStyle = '#17202a';
      ctx.fillRect(-8, -hh, 16, item.height);
    } else {
      // 通用高光条
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(-hw + 4, -hh + 4, item.width - 8, Math.max(6, item.height * 0.2));
    }

    ctx.restore();
  }

  drawShape(ctx, shape, x, y, w, h) {
    if (shape === 'circle') {
      const r = Math.min(w, h) / 2;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      ctx.closePath();
    } else if (shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    } else if (shape === 'pill') {
      const r = Math.min(w, h) / 2;
      this.roundRect(ctx, x, y, w, h, r);
    } else {
      // 默认圆角矩形
      this.roundRect(ctx, x, y, w, h, 8);
    }
  }

  roundRect(ctx, x, y, w, h, r) {
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

  renderParticles(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderGlassLid(ctx, state) {
    const boxX = 35;
    const boxY = 30;
    const boxW = 330;
    const boxH = 440;

    ctx.save();
    // 晶莹亚克力防尘盖徐徐滑入闭合 (从上方滑动盖上)
    const currentH = boxH * this.glassLidProgress;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    this.roundRect(ctx, boxX + 10, boxY + 10, boxW - 20, currentH - 20, 14);
    ctx.fill();

    // 玻璃高光反光斜线
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * this.glassLidProgress})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(boxX + 40, boxY + 10);
    ctx.lineTo(boxX + 160, boxY + currentH - 20);
    ctx.stroke();

    ctx.restore();
  }
}
