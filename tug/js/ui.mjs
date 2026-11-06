/**
 * @file games/tug/js/ui.mjs
 * 微缩对称竞技机台 Canvas 2D 渲染器。
 * 呈现软胶大力士、动态麻绳张力形变、中心泥潭飞扑、节奏暴击火花与摩擦烟尘。
 */

import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  WIN_DISTANCE,
} from './engine.mjs';
import { t } from './i18n.mjs';

export class ArenaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lang = 'zh';

    // 微粒系统
    this.particles = []; // 暴击火花与胜利礼花
    this.smokeParticles = []; // 脚底摩擦白烟
    this.mudParticles = []; // 泥潭飞溅泥滴

    this.animTime = 0;
    this.setupResolution();
  }

  setLanguage(lang) {
    this.lang = lang;
  }

  setupResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || ARENA_WIDTH;
    const h = rect.height || ARENA_HEIGHT;

    this.canvas.width = ARENA_WIDTH * dpr;
    this.canvas.height = ARENA_HEIGHT * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  /**
   * 触发暴击火花
   */
  spawnSparks(x, y, isRed = true) {
    const color = isRed ? '#ff4757' : '#1e90ff';
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        r: 3 + Math.random() * 3,
        color: Math.random() < 0.5 ? color : '#f5ba31',
        life: 0.45,
        maxLife: 0.45,
      });
    }
  }

  /**
   * 触发泥潭飞溅
   */
  spawnMudSplash(x, y) {
    for (let i = 0; i < 24; i++) {
      const angle = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
      const speed = 120 + Math.random() * 220;
      this.mudParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 4 + Math.random() * 5,
        color: Math.random() < 0.6 ? '#4a3525' : '#332215',
        life: 0.8,
        maxLife: 0.8,
      });
    }
  }

  /**
   * 触发脚底滑步摩擦烟尘
   */
  spawnSmoke(x, y) {
    if (Math.random() < 0.35) {
      this.smokeParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + 2,
        vx: (Math.random() - 0.5) * 30,
        vy: -15 - Math.random() * 25,
        r: 5 + Math.random() * 6,
        alpha: 0.55,
        life: 0.35,
        maxLife: 0.35,
      });
    }
  }

  /**
   * 主渲染入口
   */
  render(state, dt) {
    this.animTime += dt;
    const ctx = this.ctx;

    ctx.save();

    // 海盗甲板全景倾斜 (Act 3)
    if (state.env.tiltAngle !== 0) {
      ctx.translate(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
      ctx.rotate(state.env.tiltAngle * 0.4);
      ctx.translate(-ARENA_WIDTH / 2, -ARENA_HEIGHT / 2);
    }

    // 1. 绘制擂台地面与木纹边框
    this.drawArenaBase(ctx, state);

    // 2. 绘制胜负警戒白线与中央泥潭
    this.drawMudPitAndLines(ctx, state);

    // 3. 绘制角色脚底节奏节拍收缩光环
    this.drawBeatRings(ctx, state);

    // 4. 绘制两端软胶大力士角色
    this.drawCharacters(ctx, state, dt);

    // 5. 绘制紧绷粗麻绳与中央红三角巾
    this.drawRope(ctx, state);

    // 6. 绘制所有粒子 (火花、白烟、泥滴)
    this.updateAndDrawParticles(ctx, dt);

    // 7. 蒸汽狂暴特效 (Act 4)
    if (state.env.steamActive) {
      this.drawSteamOverlay(ctx);
    }

    ctx.restore();

    // 8. 倒计时与胜负定格 HUD 浮层
    this.drawStatusOverlay(ctx, state);
  }

  /**
   * 擂台基底与木质包边
   */
  drawArenaBase(ctx, state) {
    // 外部微暗环境
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // 擂台主沙地 (暖黄微浮雕沙地)
    const pad = 20;
    const arenaW = ARENA_WIDTH - pad * 2;
    const arenaH = ARENA_HEIGHT - pad * 2;

    // 外圈木纹浮雕框
    ctx.fillStyle = '#2b1d14';
    ctx.beginPath();
    ctx.roundRect(pad - 8, pad - 8, arenaW + 16, arenaH + 16, 16);
    ctx.fill();

    // 沙土场地渐变
    const sandGrad = ctx.createLinearGradient(0, pad, 0, pad + arenaH);
    if (state.levelConfig.act === 2) {
      // 泥泞狂欢
      sandGrad.addColorStop(0, '#5c4331');
      sandGrad.addColorStop(1, '#443022');
    } else if (state.levelConfig.act === 3) {
      // 海盗甲板
      sandGrad.addColorStop(0, '#705139');
      sandGrad.addColorStop(1, '#533a27');
    } else if (state.levelConfig.act === 5) {
      // 巅峰引力
      sandGrad.addColorStop(0, '#1c2438');
      sandGrad.addColorStop(1, '#0e1422');
    } else {
      // 默认阳光操场
      sandGrad.addColorStop(0, '#e8be74');
      sandGrad.addColorStop(1, '#cda057');
    }

    ctx.fillStyle = sandGrad;
    ctx.beginPath();
    ctx.roundRect(pad, pad, arenaW, arenaH, 12);
    ctx.fill();

    // 场地细微横木纹线条
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    for (let y = pad + 25; y < pad + arenaH; y += 32) {
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + arenaW, y);
      ctx.stroke();
    }
  }

  /**
   * 泥潭与胜负白线
   */
  drawMudPitAndLines(ctx, state) {
    const cx = ARENA_WIDTH / 2;
    const groundY = 320;

    // 中央泥潭 (巧克力深色泥浆浅坑)
    ctx.save();
    ctx.fillStyle = '#3a2718';
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 12, 110, 36, 0, 0, Math.PI * 2);
    ctx.fill();

    // 泥浆内层柔光微高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.ellipse(cx - 15, groundY + 8, 70, 20, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 两侧胜负白虚线 (x = -WIN_DISTANCE 与 +WIN_DISTANCE)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);

    // 红方胜负白线
    ctx.beginPath();
    ctx.moveTo(cx - WIN_DISTANCE, 100);
    ctx.lineTo(cx - WIN_DISTANCE, 390);
    ctx.stroke();

    // 蓝方胜负白线
    ctx.beginPath();
    ctx.moveTo(cx + WIN_DISTANCE, 100);
    ctx.lineTo(cx + WIN_DISTANCE, 390);
    ctx.stroke();

    // 中心警戒黄线 (x = 0)
    ctx.strokeStyle = 'rgba(245, 186, 49, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, 120);
    ctx.lineTo(cx, 370);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 角色脚底节拍收缩光环
   */
  drawBeatRings(ctx, state) {
    const groundY = 320;
    const ropeCenter = ARENA_WIDTH / 2 + state.ropeX;
    const redX = ropeCenter - 180;
    const blueX = ropeCenter + 180;

    const phase = state.beat.phase; // 0.0 -> 1.0
    const ringRadius = 42 * (1 - phase) + 16;
    const isNear = state.beat.isNearBeat;

    // 红方节拍环
    ctx.save();
    ctx.lineWidth = isNear ? 3.5 : 2;
    ctx.strokeStyle = isNear ? '#ffeaa7' : 'rgba(255, 71, 87, 0.45)';
    if (isNear) {
      ctx.shadowColor = '#ffeaa7';
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.ellipse(redX, groundY + 18, ringRadius, ringRadius * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 蓝方节拍环
    ctx.save();
    ctx.lineWidth = isNear ? 3.5 : 2;
    ctx.strokeStyle = isNear ? '#ffeaa7' : 'rgba(30, 144, 255, 0.45)';
    if (isNear) {
      ctx.shadowColor = '#ffeaa7';
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.ellipse(blueX, groundY + 18, ringRadius, ringRadius * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 软胶大力士角色
   */
  drawCharacters(ctx, state, dt) {
    const groundY = 300;
    const ropeCenter = ARENA_WIDTH / 2 + state.ropeX;

    const redX = ropeCenter - 180;
    const blueX = ropeCenter + 180;

    const isPulling = state.status === 'pulling';
    const isRedLoser = (state.status === 'round_end' && state.roundWinner === 'blue');
    const isBlueLoser = (state.status === 'round_end' && state.roundWinner === 'red');

    // 红方滑移白烟产生
    if (isPulling && state.ropeV > 35) {
      this.spawnSmoke(redX, groundY + 20);
    }
    // 蓝方滑移白烟产生
    if (isPulling && state.ropeV < -35) {
      this.spawnSmoke(blueX, groundY + 20);
    }

    // 绘制红方大力士 (左边，向后倾斜拉扯)
    this.drawWrestler(ctx, {
      x: redX,
      y: groundY,
      facing: 1, // 面向右方拔绳
      primaryColor: '#ff4757',
      headbandColor: '#ffffff',
      isLoser: isRedLoser,
      isWinner: state.status === 'round_end' && state.roundWinner === 'red',
      tension: state.tension,
      time: this.animTime,
    });

    // 绘制蓝方大力士 (右边，向后倾斜拉扯)
    this.drawWrestler(ctx, {
      x: blueX,
      y: groundY,
      facing: -1, // 面向左方拔绳
      primaryColor: '#1e90ff',
      headbandColor: '#ffd32a',
      isLoser: isBlueLoser,
      isWinner: state.status === 'round_end' && state.roundWinner === 'blue',
      tension: state.tension,
      time: this.animTime,
    });
  }

  /**
   * 单体软胶大力士微雕绘制
   */
  drawWrestler(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.isLoser) {
      // 败者扑倒栽入泥潭滑稽动画
      ctx.rotate(p.facing * 1.25);
      ctx.translate(p.facing * 35, 15);
    } else {
      // 拔河发力身体倾角 (拔得越使劲身体越往后靠)
      const leanAngle = -p.facing * (0.28 + p.tension * 0.16);
      ctx.rotate(leanAngle);
    }

    // 1. 双腿与大头胶靴
    ctx.fillStyle = '#1e272e';
    // 前后脚
    ctx.beginPath();
    ctx.roundRect(-p.facing * 14, 18, 16, 14, 6);
    ctx.roundRect(p.facing * 8, 16, 16, 14, 6);
    ctx.fill();

    // 2. 软胶圆滚身躯 (背心肌肉形态)
    ctx.fillStyle = p.primaryColor;
    ctx.beginPath();
    ctx.roundRect(-24, -28, 48, 50, 18);
    ctx.fill();

    // 躯干立体软胶阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.roundRect(-20, 2, 40, 16, 8);
    ctx.fill();

    // 3. 大力士圆脸庞与发力神情
    ctx.fillStyle = '#ffdfba'; // 暖肤色
    ctx.beginPath();
    ctx.arc(0, -42, 22, 0, Math.PI * 2);
    ctx.fill();

    // 憋气发力红润腮红
    ctx.fillStyle = 'rgba(255, 71, 87, 0.6)';
    ctx.beginPath();
    ctx.arc(-10, -36, 6, 0, Math.PI * 2);
    ctx.arc(10, -36, 6, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛 (奋力闭眼咬牙发力)
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (p.isLoser) {
      // 蚊香眼 / 叉号
      ctx.moveTo(-10, -46); ctx.lineTo(-4, -40);
      ctx.moveTo(-4, -46); ctx.lineTo(-10, -40);
      ctx.moveTo(4, -46); ctx.lineTo(10, -40);
      ctx.moveTo(10, -46); ctx.lineTo(4, -40);
      ctx.stroke();
    } else {
      // 紧绷发力斜线
      ctx.moveTo(-12, -42); ctx.lineTo(-4, -40);
      ctx.moveTo(12, -42); ctx.lineTo(4, -40);
      ctx.stroke();

      // 咬紧牙关大张嘴
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-8, -32, 16, 8, 3);
      ctx.fill();
      ctx.stroke();
    }

    // 4. 热血头带
    ctx.fillStyle = p.headbandColor;
    ctx.fillRect(-22, -54, 44, 8);
    // 头带飘带
    ctx.beginPath();
    ctx.moveTo(-p.facing * 20, -50);
    ctx.lineTo(-p.facing * 34, -44 + Math.sin(p.time * 8) * 4);
    ctx.lineTo(-p.facing * 20, -42);
    ctx.fill();

    // 5. 双手握绳 (伸向中心握拳)
    ctx.fillStyle = '#ffdfba';
    const handX = p.facing * 24;
    ctx.beginPath();
    ctx.arc(handX, -6, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 麻绳与中心红巾
   */
  drawRope(ctx, state) {
    const ropeCenter = ARENA_WIDTH / 2 + state.ropeX;
    const groundY = 294;

    const redHandX = ropeCenter - 180 + 24;
    const blueHandX = ropeCenter + 180 - 24;

    // 麻绳粗下垂弧度 (张力越大越绷成直线)
    const sag = (1.0 - state.tension) * 18;

    ctx.save();

    // 粗麻绳主体
    ctx.strokeStyle = '#c29668';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(redHandX, groundY);
    ctx.quadraticCurveTo(ropeCenter, groundY + sag, blueHandX, groundY);
    ctx.stroke();

    // 麻绳编织螺旋虚线质感
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(redHandX, groundY);
    ctx.quadraticCurveTo(ropeCenter, groundY + sag, blueHandX, groundY);
    ctx.stroke();

    // 绳索中央红色三角标记布巾 (吊在 ropeCenter 处)
    const ribbonY = groundY + sag * 0.5;
    ctx.fillStyle = '#ff3838';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    // 飘带系结
    ctx.beginPath();
    ctx.arc(ropeCenter, ribbonY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 下垂红三角旗
    ctx.beginPath();
    ctx.moveTo(ropeCenter - 7, ribbonY + 4);
    ctx.lineTo(ropeCenter + 7, ribbonY + 4);
    ctx.lineTo(ropeCenter, ribbonY + 28 + Math.sin(this.animTime * 6) * 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 更新并绘制火花、烟雾与泥浆飞溅
   */
  updateAndDrawParticles(ctx, dt) {
    // 1. 摩擦白烟
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.smokeParticles.splice(i, 1);
        continue;
      }
      const alpha = (p.life / p.maxLife) * 0.5;
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. 泥浆飞溅
    for (let i = this.mudParticles.length - 1; i >= 0; i--) {
      const p = this.mudParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 380 * dt; // 重力下坠
      p.life -= dt;
      if (p.life <= 0) {
        this.mudParticles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. 暴击金色火花
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 蒸汽狂暴覆盖烟气 (Act 4)
   */
  drawSteamOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // 居中蒸汽提示
    ctx.fillStyle = '#ff9f43';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ STEAM BURST 1.4x ⚡', ARENA_WIDTH / 2, 70);
    ctx.restore();
  }

  /**
   * 倒计时 3-2-1 READY GO 与胜负定格浮层
   */
  drawStatusOverlay(ctx, state) {
    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2 - 30;

    if (state.status === 'countdown') {
      const sec = Math.ceil(state.countdownTimer);
      const text = sec > 0 ? String(sec) : t('hud.go', this.lang);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 阴影与浮雕
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 12;

      ctx.font = '900 68px sans-serif';
      ctx.fillStyle = sec > 0 ? '#f5ba31' : '#2ed573';
      ctx.fillText(text, cx, cy);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.strokeText(text, cx, cy);

      ctx.restore();
    } else if (state.status === 'round_end') {
      const isRed = state.roundWinner === 'red';
      const winText = isRed ? t('win.titleRed', this.lang) : t('win.titleBlue', this.lang);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 16;

      ctx.font = '900 44px sans-serif';
      ctx.fillStyle = isRed ? '#ff4757' : '#1e90ff';
      ctx.fillText(winText, cx, cy);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeText(winText, cx, cy);

      ctx.restore();
    }
  }

  /**
   * 绘制暂停全屏遮罩
   */
  drawPauseOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 25, 0.72)';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2;

    // 暂停框
    ctx.fillStyle = '#182030';
    ctx.strokeStyle = '#f5ba31';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 140, cy - 60, 280, 120, 16);
    ctx.fill();
    ctx.stroke();

    // 暂停图标
    ctx.fillStyle = '#f5ba31';
    ctx.fillRect(cx - 16, cy - 38, 9, 26);
    ctx.fillRect(cx + 7, cy - 38, 9, 26);

    // 标题与提示
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('hud.paused', this.lang), cx, cy + 10);

    ctx.fillStyle = '#8c9cb8';
    ctx.font = '12px sans-serif';
    ctx.fillText(t('hud.pausedTip', this.lang), cx, cy + 34);

    ctx.restore();
  }
}
