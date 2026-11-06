/**
 * @file games/mtower/js/ui.mjs
 * 纯 Canvas 2D / DOM 混合地牢机台渲染器。
 * 驱动 11x11 黑曜石石砖厅堂、像素魔物与神圣法宝、临界值悬停算盘与战损浮动数字。
 */

import { GRID, CH, ITEMS, MONSTERS } from './data.mjs';
import { calculateBattle, calculateThresholds } from './engine.mjs';
import { t } from './i18n.mjs';

export const TILE_SIZE = 48;
export const CANVAS_SIZE = GRID * TILE_SIZE; // 528 x 528

export class MTowerRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.floatTexts = [];
    this.hoverCell = null; // { x, y }
    this.animTime = 0;
  }

  setHoverCell(cell) {
    this.hoverCell = cell;
  }

  addFloatingText(x, y, text, color = '#ffd54f') {
    this.floatTexts.push({
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
      text,
      color,
      life: 0.8,
      maxLife: 0.8,
    });
  }

  update(dt) {
    this.animTime += dt;
    for (const ft of this.floatTexts) {
      ft.y -= 25 * dt;
      ft.life -= dt;
    }
    this.floatTexts = this.floatTexts.filter((f) => f.life > 0);
  }

  render(state) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const curFIdx = state.currentFloor - 1;
    const floorObj = state.floors[curFIdx];
    if (!floorObj) return;

    // 1. 绘制底层石砖地表与四壁
    this.renderFloorTiles(ctx, floorObj);

    // 2. 绘制地块物件（门、钥匙、药水、神装、魔物）
    this.renderMapObjects(ctx, floorObj, state);

    // 3. 绘制勇者本尊
    this.renderHero(ctx, state.hero);

    // 4. 浮动数字（伤害、强化加点）
    this.renderFloatingTexts(ctx);

    // 5. 悬停临界值算盘预览光环
    if (this.hoverCell) {
      this.renderHoverHighlight(ctx, this.hoverCell, floorObj, state);
    }
  }

  renderFloorTiles(ctx, floorObj) {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const cell = floorObj.map[y][x];

        if (cell === '#') {
          // 坚固黑曜石墙砖 (3D Beveled Stone Block)
          ctx.fillStyle = '#1c2331';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

          ctx.fillStyle = '#2d384e';
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

          ctx.fillStyle = '#131924';
          ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

          // 石砖石纹细线
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else {
          // 地牢暗青石砖地坪
          ctx.fillStyle = (x + y) % 2 === 0 ? '#0d131f' : '#0a0e18';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

          // 地砖边缘接缝
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  renderMapObjects(ctx, floorObj, state) {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const cell = floorObj.map[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const cx = px + TILE_SIZE / 2;
        const cy = py + TILE_SIZE / 2;

        if (cell === '.') continue;

        // 1. 楼梯 (Stairs)
        if (cell === '^' || cell === 'v') {
          this.renderStairs(ctx, cx, cy, cell === '^');
          continue;
        }

        // 2. 门 (Doors: Yellow / Blue / Red / Iron)
        if (cell === 'Y' || cell === 'B' || cell === 'R' || cell === 'M') {
          this.renderDoor(ctx, px, py, cell);
          continue;
        }

        // 3. 暗墙 (Crack Wall)
        if (cell === 'X') {
          ctx.fillStyle = '#2c3547';
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeStyle = '#e74c3c';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px + 10, py + 10);
          ctx.lineTo(px + TILE_SIZE - 10, py + TILE_SIZE - 10);
          ctx.stroke();
          continue;
        }

        // 4. 道具与神装 (Items)
        const item = ITEMS[cell];
        if (item) {
          this.renderItem(ctx, cx, cy, item);
          continue;
        }

        // 5. 怪物魔物 (Monsters)
        const monId = floorObj.monsters[cell];
        if (monId) {
          const monster = MONSTERS[monId];
          this.renderMonster(ctx, cx, cy, monster, state);
          continue;
        }
      }
    }
  }

  renderStairs(ctx, cx, cy, isUp) {
    ctx.save();
    ctx.fillStyle = isUp ? '#ffd54f' : '#34495e';
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;

    // 梯级折线
    for (let i = -14; i <= 14; i += 7) {
      ctx.beginPath();
      ctx.rect(cx - 14, cy + i - 2, 28, 4);
      ctx.fill();
      if (isUp) ctx.stroke();
    }

    // 箭头指示
    ctx.fillStyle = isUp ? '#ffffff' : '#95a5a6';
    ctx.beginPath();
    if (isUp) {
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx - 5, cy - 10);
      ctx.lineTo(cx + 5, cy - 10);
    } else {
      ctx.moveTo(cx, cy + 18);
      ctx.lineTo(cx - 5, cy + 10);
      ctx.lineTo(cx + 5, cy + 10);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  renderDoor(ctx, px, py, doorChar) {
    ctx.save();
    let frameColor = '#f39c12';
    let centerColor = '#f1c40f';

    if (doorChar === 'B') {
      frameColor = '#2980b9';
      centerColor = '#3498db';
    } else if (doorChar === 'R') {
      frameColor = '#c0392b';
      centerColor = '#e74c3c';
    } else if (doorChar === 'M') {
      frameColor = '#7f8c8d';
      centerColor = '#bdc3c7';
    }

    // 门框底衬
    ctx.fillStyle = '#080c14';
    ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

    // 双开门板
    ctx.fillStyle = frameColor;
    ctx.fillRect(px + 6, py + 6, TILE_SIZE / 2 - 7, TILE_SIZE - 12);
    ctx.fillRect(px + TILE_SIZE / 2 + 1, py + 6, TILE_SIZE / 2 - 7, TILE_SIZE - 12);

    // 门板金边与锁孔
    ctx.fillStyle = centerColor;
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderItem(ctx, cx, cy, item) {
    ctx.save();
    const type = item.type;

    if (type === 'key') {
      // 复古黄铜/翡翠/赤红钥匙
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0e17';
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 4, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = item.color;
      ctx.fillRect(cx - 2, cy - 3, 10, 3);
      ctx.fillRect(cx + 5, cy - 1, 3, 4);
      ctx.fillRect(cx + 1, cy - 1, 2, 3);
    } else if (type === 'gem') {
      // 菱形耀眼能量宝石
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + 9, cy);
      ctx.lineTo(cx, cy + 10);
      ctx.lineTo(cx - 9, cy);
      ctx.closePath();
      ctx.fill();

      // 高光切面
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 6);
      ctx.lineTo(cx, cy - 9);
      ctx.lineTo(cx + 4, cy - 6);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'potion') {
      // 炼金红药水瓶
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(cx - 3, cy - 10, 6, 6);
      ctx.fillStyle = '#d35400';
      ctx.fillRect(cx - 4, cy - 12, 8, 3);
    } else if (type === 'equip') {
      // 剑与盾
      ctx.fillStyle = item.color;
      if (item.stat === 'atk') {
        // 宝剑
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + 3, cy + 4);
        ctx.lineTo(cx, cy + 6);
        ctx.lineTo(cx - 3, cy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(cx - 6, cy + 3, 12, 2.5);
        ctx.fillRect(cx - 1.5, cy + 5, 3, 5);
      } else {
        // 重盾
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 8);
        ctx.lineTo(cx + 8, cy - 8);
        ctx.lineTo(cx + 8, cy + 2);
        ctx.lineTo(cx, cy + 10);
        ctx.lineTo(cx - 8, cy + 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else if (type === 'relic') {
      // 圣水、十字架、飞行羽毛
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  renderMonster(ctx, cx, cy, monster, state) {
    ctx.save();
    const bob = Math.sin(this.animTime * 4 + cx) * 1.5;

    // 怪物主色与轮廓
    ctx.fillStyle = monster.color;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, 12, 0, Math.PI * 2);
    ctx.fill();

    // 邪魅双目
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2 + bob, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy - 2 + bob, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2 + bob, 1.2, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy - 2 + bob, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 脚下战损实时微型角标
    const battle = calculateBattle(state.hero, monster);
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';

    if (!battle.canWin) {
      ctx.fillStyle = '#ff4757';
      ctx.fillText('???', cx, cy + 18);
    } else if (battle.damage === 0) {
      ctx.fillStyle = '#2ed573';
      ctx.fillText('0', cx, cy + 18);
    } else {
      ctx.fillStyle = '#ffa502';
      ctx.fillText(battle.damage > 9999 ? '9999+' : battle.damage.toString(), cx, cy + 18);
    }

    ctx.restore();
  }

  renderHero(ctx, hero) {
    const cx = hero.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = hero.y * TILE_SIZE + TILE_SIZE / 2;

    ctx.save();
    // 红色披风
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy);
    ctx.lineTo(cx + 7, cy);
    ctx.lineTo(cx + 9, cy + 14);
    ctx.lineTo(cx - 9, cy + 14);
    ctx.closePath();
    ctx.fill();

    // 黄金头盔与圣骑士铠甲
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f39c12';
    ctx.fillRect(cx - 6, cy + 3, 12, 9);

    // 剑与盾手持
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(cx + 7, cy - 5, 2, 12);
    ctx.fillStyle = '#2980b9';
    ctx.fillRect(cx - 9, cy, 3, 8);

    ctx.restore();
  }

  renderHoverHighlight(ctx, cell, floorObj, state) {
    const px = cell.x * TILE_SIZE;
    const py = cell.y * TILE_SIZE;
    const ch = floorObj.map[cell.y]?.[cell.x];
    const monId = floorObj.monsters?.[ch];

    ctx.save();
    ctx.strokeStyle = monId ? '#ffd54f' : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    ctx.restore();
  }

  renderFloatingTexts(ctx) {
    for (const ft of this.floatTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
