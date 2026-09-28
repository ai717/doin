// Piano Tiles — Canvas 渲染 + DOM 交互
// 纯函数渲染 Canvas + DOM 事件绑定

import { CONFIG } from "./engine.mjs";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.colWidth = this.width / CONFIG.TRACKS;

    // 命中动画队列
    this._hitFx = []; // { tileId, col, y, quality, age }
    // PERFECT 跳字
    this._perfectText = []; // { col, y, age }
  }

  // 添加命中特效
  pushHitFx(tileId, col, y, quality) {
    this._hitFx.push({ tileId, col, y, quality, age: 0 });
    if (quality === "perfect") {
      this._perfectText.push({ col, y, age: 0 });
    }
  }

  /** 渲染一帧 */
  render(snapshot, dt = 0) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. 轨道背景（白格/黑格交替底色 —— 仿琴键）
    for (let c = 0; c < CONFIG.TRACKS; c++) {
      const x = c * this.colWidth;
      ctx.fillStyle = c % 2 === 0 ? "#F4F2ED" : "#E8E5DE";
      ctx.fillRect(x, 0, this.colWidth, this.height);
      // 列分隔线
      ctx.strokeStyle = "rgba(30,30,30,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    // 最右边线
    ctx.beginPath();
    ctx.moveTo(this.width - 1, 0);
    ctx.lineTo(this.width - 1, this.height);
    ctx.stroke();

    // 2. 黑块
    for (const tile of snapshot.tiles) {
      if (tile.status === "hit") continue; // 已命中不画
      this._drawTile(ctx, tile);
    }

    // 3. 命中特效（下沉 + 碎裂粒子）
    for (let i = this._hitFx.length - 1; i >= 0; i--) {
      const fx = this._hitFx[i];
      fx.age += dt;
      this._drawHitFx(ctx, fx);
      if (fx.age > 0.4) this._hitFx.splice(i, 1);
    }

    // 4. PERFECT 跳字
    for (let i = this._perfectText.length - 1; i >= 0; i--) {
      const t = this._perfectText[i];
      t.age += dt;
      this._drawPerfect(ctx, t);
      if (t.age > 0.7) this._perfectText.splice(i, 1);
    }
  }

  _drawTile(ctx, tile) {
    const x = tile.col * this.colWidth;
    const y = tile.y;
    const w = this.colWidth;
    const h = tile.height;

    // 黑块主体
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "#2A2D36");
    grad.addColorStop(0.5, "#1B1D22");
    grad.addColorStop(1, "#0F1014");
    ctx.fillStyle = grad;
    ctx.fillRect(x + 2, y, w - 4, h);

    // 顶部微高光
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x + 2, y, w - 4, 4);

    // 底部微阴影
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + 2, y + h - 3, w - 4, 3);

    // 边框
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y, w - 4, h);
  }

  _drawHitFx(ctx, fx) {
    const x = fx.col * this.colWidth;
    const progress = fx.age / 0.4; // 0 → 1
    const sinkY = progress * 30; // 下沉距离

    // 碎裂粒子（8 片向外飞散）
    const cx = x + this.colWidth / 2;
    const cy = fx.y + fx.age * 200 + sinkY;
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const dist = progress * 50;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      const size = (1 - progress) * 5 + 1;
      ctx.fillStyle = fx.quality === "perfect" ? "#FFD76A" : "#1B1D22";
      ctx.globalAlpha = 1 - progress;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  _drawPerfect(ctx, t) {
    const x = t.col * this.colWidth + this.colWidth / 2;
    const y = t.y - t.age * 60; // 向上飘
    const alpha = 1 - t.age / 0.7;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#FFD76A";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PERFECT", x, y);
    ctx.globalAlpha = 1;
  }

  /** 判定线单独绘制（外框 UI 层管位置，此处只画发光线） */
  drawJudgeLine() {
    const ctx = this.ctx;
    const y = CONFIG.JUDGE_LINE_Y;

    // 光晕
    const glow = ctx.createLinearGradient(0, y - 20, 0, y + 20);
    glow.addColorStop(0, "rgba(127,216,255,0)");
    glow.addColorStop(0.5, "rgba(127,216,255,0.25)");
    glow.addColorStop(1, "rgba(127,216,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, y - 20, this.width, 40);

    // 主线
    ctx.strokeStyle = "rgba(127,216,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.width, y);
    ctx.stroke();
  }

  /** 把画布坐标 y 映射到最近判定线位置（用于 PERFECT 判定） */
  getColFromX(clientX) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const col = Math.floor((canvasX / rect.width) * CONFIG.TRACKS);
    return Math.max(0, Math.min(CONFIG.TRACKS - 1, col));
  }

  /** 重置（重开游戏时） */
  reset() {
    this._hitFx = [];
    this._perfectText = [];
  }
}
