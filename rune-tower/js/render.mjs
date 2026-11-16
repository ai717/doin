// Canvas 2D 电影级沉浸渲染器（黑曜石魔导台美学，严格遵守无描边圈径向柔光红线）

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PATH_DATA,
  PATH_WAYPOINTS,
  PEDESTALS,
  RUNES,
  TIER_MULTIPLIERS,
} from "./engine.mjs";

const RUNIC_SYMBOLS = ["ᚱ", "ᚦ", "ᛟ", "ᛋ", "ᚨ", "ᛉ", "ᛏ", "ᚹ", "ᛖ", "ᚲ"];

export class RuneTowerRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.selectedPedestalId = null;
    this.hoveredPedestalId = null;
    this.particles = [];
    this.ambientMotes = [];
    this.time = 0;

    // 初始化漂浮魔法星尘
    for (let i = 0; i < 45; i++) {
      this.ambientMotes.push({
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        vx: (Math.random() - 0.5) * 15,
        vy: -10 - Math.random() * 20,
        size: 1 + Math.random() * 2.5,
        alpha: 0.1 + Math.random() * 0.4,
        hue: Math.random() < 0.6 ? 165 : 270, // 翡翠绿或紫电
      });
    }

    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round((rect.width || WORLD_WIDTH) * dpr);
    this.canvas.height = Math.round((rect.height || WORLD_HEIGHT) * dpr);
    this.scaleX = this.canvas.width / WORLD_WIDTH;
    this.scaleY = this.canvas.height / WORLD_HEIGHT;
  }

  setSelectedPedestal(id) {
    this.selectedPedestalId = id;
  }

  setHoveredPedestal(id) {
    this.hoveredPedestalId = id;
  }

  addExplosion(x, y, color = "#ff5400", count = 22, maxSpeed = 180) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * maxSpeed;
      this.particles.push({
        type: "spark",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 4,
        color,
        alpha: 1.0,
        decay: 1.0 + Math.random() * 1.8,
      });
    }
  }

  addShockwave(x, y, color = "rgba(0, 245, 212, 0.4)", maxRadius = 90) {
    this.particles.push({
      type: "shockwave",
      x,
      y,
      radius: 6,
      maxRadius,
      color,
      alpha: 0.85,
      decay: 2.2,
    });
  }

  render(state, dt = 0.016) {
    this.time += dt;
    const ctx = this.ctx;

    ctx.save();
    ctx.scale(this.scaleX, this.scaleY);

    // 1. 绘制黑曜石祭坛地砖与发光地脉暗纹
    this.drawAltarFloor(ctx);

    // 2. 绘制立体浮雕回廊石径与奔涌的符文能量渠
    this.drawCorridorPavement(ctx);

    // 3. 绘制深渊传送漩涡与圣所璀璨核心水晶
    this.drawPortals(ctx, state);

    // 4. 绘制符文石基与悬浮魔导符文塔（含无边界径向柔光范围）
    this.drawPedestalsAndTowers(ctx, state);

    // 5. 绘制深渊魔物（具有立体质感与生动造型）
    this.drawMonsters(ctx, state);

    // 6. 绘制高光飞弹、连环闪电与打击特效
    this.drawProjectilesAndArcs(ctx, state);

    // 7. 更新并绘制环境星尘与战斗爆破粒子
    this.drawParticles(ctx, dt);

    ctx.restore();
  }

  drawAltarFloor(ctx) {
    // 沉浸深邃暗夜黑曜石渐变
    const bgGrad = ctx.createRadialGradient(
      WORLD_WIDTH * 0.5,
      WORLD_HEIGHT * 0.45,
      100,
      WORLD_WIDTH * 0.5,
      WORLD_HEIGHT * 0.5,
      WORLD_WIDTH * 0.75
    );
    bgGrad.addColorStop(0, "#101726");
    bgGrad.addColorStop(0.5, "#0b0f17");
    bgGrad.addColorStop(1, "#04070a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 微弱的古老石砖嵌缝与地脉发光裂纹
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
    ctx.lineWidth = 1;
    const sz = 48;
    for (let x = 0; x <= WORLD_WIDTH; x += sz) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += sz) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }

    // 地基到石座的纤细发光导流槽
    ctx.strokeStyle = "rgba(0, 245, 212, 0.06)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 12]);
    for (const p of PEDESTALS) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 30, p.y + (p.y > 300 ? -25 : 25));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawCorridorPavement(ctx) {
    const points = PATH_DATA.points;
    if (points.length < 2) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. 底层回廊深色阴影（增强立体凹陷感）
    ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
    ctx.lineWidth = 58;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y + 4);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y + 4);
    }
    ctx.stroke();

    // 2. 玄武岩厚实石壁边框（带立体边缘倒角）
    ctx.strokeStyle = "#1b2533";
    ctx.lineWidth = 48;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // 3. 内部古旧青石铺路
    ctx.strokeStyle = "#253346";
    ctx.lineWidth = 36;
    ctx.stroke();

    // 4. 中央符文能量光渠（深色槽）
    ctx.strokeStyle = "#121b27";
    ctx.lineWidth = 18;
    ctx.stroke();

    // 5. 奔涌流动的符文能量流（双层渐变光效）
    const flowPulse = (this.time * 65) % 180;
    ctx.setLineDash([16, 24]);
    ctx.lineDashOffset = -flowPulse;
    ctx.strokeStyle = "rgba(0, 245, 212, 0.4)";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.setLineDash([8, 36]);
    ctx.lineDashOffset = -flowPulse * 1.5;
    ctx.strokeStyle = "rgba(157, 78, 221, 0.45)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();

    // 6. 沿途浮动的远古神秘符文烙印
    ctx.save();
    ctx.font = "bold 13px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let idx = 2; idx < PATH_WAYPOINTS.length - 1; idx += 2) {
      const wp = PATH_WAYPOINTS[idx];
      const runeChar = RUNIC_SYMBOLS[idx % RUNIC_SYMBOLS.length];
      const glow = 0.3 + Math.sin(this.time * 2.5 + idx) * 0.2;
      ctx.fillStyle = `rgba(0, 245, 212, ${glow})`;
      ctx.fillText(runeChar, wp.x, wp.y);
    }
    ctx.restore();
  }

  drawPortals(ctx, state) {
    // 1. 深渊传送漩涡 (Abyssal Portal)
    const start = PATH_WAYPOINTS[0];
    ctx.save();
    ctx.translate(start.x, start.y);

    // 外围旋转吸积盘柔光
    const portalGlow = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
    portalGlow.addColorStop(0, "rgba(157, 78, 221, 0.95)");
    portalGlow.addColorStop(0.45, "rgba(114, 9, 183, 0.55)");
    portalGlow.addColorStop(0.8, "rgba(58, 12, 163, 0.2)");
    portalGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = portalGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();

    // 旋转紫色能量星环
    ctx.rotate(this.time * 1.8);
    ctx.strokeStyle = "#e0aaff";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.rotate((Math.PI * 2) / 4);
      ctx.beginPath();
      ctx.arc(14, 0, 16, 0, Math.PI * 1.2);
      ctx.stroke();
    }

    // 深渊黑洞核心
    ctx.fillStyle = "#0a0014";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 2. 圣所核心水晶 (Sanctum Crystal)
    const end = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    ctx.save();
    ctx.translate(end.x, end.y);

    const crystalRatio = state.crystalHp / state.maxCrystalHp;
    const isCritical = crystalRatio <= 0.3;
    const mainColor = isCritical ? "#ff0054" : crystalRatio <= 0.6 ? "#ffb703" : "#00f5d4";

    // 水晶发光呼吸大气层
    const pulse = 1.0 + Math.sin(this.time * 3.5) * 0.12;
    const crystalAura = ctx.createRadialGradient(0, 0, 6, 0, 0, 58 * pulse);
    crystalAura.addColorStop(0, `${mainColor}aa`);
    crystalAura.addColorStop(0.5, `${mainColor}33`);
    crystalAura.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = crystalAura;
    ctx.beginPath();
    ctx.arc(0, 0, 58 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 倾斜公转的金色神圣符文环
    ctx.save();
    ctx.rotate(this.time * 0.9);
    ctx.scale(1.0, 0.45); // 椭圆透视
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#ffb703";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 悬浮自转的 3D 立体多面晶核
    const floatY = Math.sin(this.time * 2.8) * 4;
    ctx.translate(0, floatY);

    // 晶石阴影面
    ctx.fillStyle = isCritical ? "#9e0031" : "#007f5f";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(15, 0);
    ctx.lineTo(0, 22);
    ctx.closePath();
    ctx.fill();

    // 晶石光照面
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-15, 0);
    ctx.lineTo(0, 22);
    ctx.closePath();
    ctx.fill();

    // 晶石中央明亮镜面高光
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawPedestalsAndTowers(ctx, state) {
    const selectedId = this.selectedPedestalId;

    // 1. 若有选中塔，绘制【无边界径向柔光攻击范围】（硬性红线：绝对不 stroke 圆圈）
    if (selectedId && state.towers[selectedId]) {
      const tower = state.towers[selectedId];
      const rune = RUNES[tower.type];
      const mult = TIER_MULTIPLIERS[tower.tier];
      const range = rune.range * mult.rangeMult * (state.activeRelics.includes("relic_hyper_charge") ? 1.15 : 1.0);

      ctx.save();
      const rgb =
        tower.type === "arcane"
          ? "0, 245, 212"
          : tower.type === "flame"
          ? "255, 84, 0"
          : tower.type === "frost"
          ? "0, 187, 249"
          : "157, 78, 221";

      const rangeGlow = ctx.createRadialGradient(tower.x, tower.y, 0, tower.x, tower.y, range);
      rangeGlow.addColorStop(0, `rgba(${rgb}, 0.28)`);
      rangeGlow.addColorStop(0.65, `rgba(${rgb}, 0.12)`);
      rangeGlow.addColorStop(1, `rgba(${rgb}, 0)`); // 边缘平滑羽化至 0 透明度

      ctx.fillStyle = rangeGlow;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, range, 0, Math.PI * 2);
      ctx.fill(); // 严禁 stroke！
      ctx.restore();
    }

    // 2. 逐一绘制 10 个石基
    for (const p of PEDESTALS) {
      const tower = state.towers[p.id];
      const isSelected = p.id === selectedId;
      const isHovered = p.id === this.hoveredPedestalId;

      ctx.save();

      // 悬停/选中时的基底地脉能量涌动（无边界径向柔光）
      if (isSelected || isHovered) {
        const selectGlow = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 48);
        selectGlow.addColorStop(0, "rgba(0, 245, 212, 0.5)");
        selectGlow.addColorStop(0.7, "rgba(0, 245, 212, 0.15)");
        selectGlow.addColorStop(1, "rgba(0, 245, 212, 0)");
        ctx.fillStyle = selectGlow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 48, 0, Math.PI * 2);
        ctx.fill();
      }

      // 双层阶梯立体六边形基座
      // 下层基底
      this.drawHexagon(ctx, p.x, p.y + 4, 26, "#141c26", "#0b0f14");
      // 上层基台
      this.drawHexagon(ctx, p.x, p.y, 23, "#212d3d", "#364962");

      if (!tower) {
        // 空置石基：中央发光的远古微缩符印
        const pulse = 0.3 + Math.sin(this.time * 2 + p.x) * 0.15;
        ctx.fillStyle = `rgba(0, 245, 212, ${pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(0, 245, 212, ${pulse * 0.8})`;
        ctx.lineWidth = 1.5;
        this.drawHexagon(ctx, p.x, p.y, 14, "transparent", `rgba(0, 245, 212, ${pulse * 0.6})`);
      } else {
        // 已激活符文塔：精美 3D 魔导石柱与悬浮四系法球
        this.drawTowerEntity(ctx, tower);
      }

      ctx.restore();
    }
  }

  drawHexagon(ctx, x, y, radius, fillColor, strokeColor) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const hx = x + radius * Math.cos(angle);
      const hy = y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    if (fillColor && fillColor !== "transparent") {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor && strokeColor !== "transparent") {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  drawTowerEntity(ctx, tower) {
    const rune = RUNES[tower.type];
    const x = tower.x;
    const y = tower.y;

    // 石柱柱身（带左右立体光影）
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x - 11, y - 20, 22, 18);
    // 右侧阴影
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x + 2, y - 20, 9, 18);
    // 左侧高光
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x - 11, y - 20, 4, 18);

    // 柱身雕刻的能量符线
    ctx.strokeStyle = rune.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x, y - 4);
    ctx.stroke();

    // 阶位星石标识（I阶 1 颗、II阶 2 颗、III阶 3 颗黄金灵珠）
    for (let t = 0; t < tower.tier; t++) {
      const offset = (t - (tower.tier - 1) / 2) * 7;
      ctx.fillStyle = "#ffb703";
      ctx.shadowColor = "#ff9e00";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x + offset, y + 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 悬浮自转四系符文核心晶体
    const hoverY = y - 30 + Math.sin(this.time * 3.2 + tower.x) * 3.5;
    ctx.save();
    ctx.translate(x, hoverY);

    // 元素光环（无边界柔光）
    const runeAura = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    runeAura.addColorStop(0, rune.color);
    runeAura.addColorStop(0.5, `${rune.color}55`);
    runeAura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = runeAura;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // 旋转的多面晶体
    ctx.rotate(this.time * 2.2);

    if (tower.type === "arcane") {
      // 奥术八面体
      ctx.fillStyle = "#00f5d4";
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-3, -3, 6, 6);
    } else if (tower.type === "flame") {
      // 烈焰棱形火焰
      ctx.fillStyle = "#ff5400";
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffdd00";
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (tower.type === "frost") {
      // 冰霜六角雪晶
      ctx.fillStyle = "#00bbf9";
      this.drawHexagon(ctx, 0, 0, 8, "#00bbf9", "#ffffff");
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (tower.type === "storm") {
      // 雷霆电浆光球
      ctx.fillStyle = "#9d4edd";
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawMonsters(ctx, state) {
    for (const m of state.monsters) {
      ctx.save();
      const isFocused = state.focusTargetId === m.id;

      // 集火目标提示：金芒脉动光晕（无硬线圆圈）
      if (isFocused) {
        const focusGlow = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, m.radius + 22);
        focusGlow.addColorStop(0, "rgba(255, 214, 10, 0.75)");
        focusGlow.addColorStop(0.6, "rgba(255, 183, 3, 0.3)");
        focusGlow.addColorStop(1, "rgba(255, 183, 3, 0)");
        ctx.fillStyle = focusGlow;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius + 22, 0, Math.PI * 2);
        ctx.fill();
      }

      // 冰冻 / 减速视觉覆盖
      if (m.frozenTimer > 0) {
        ctx.fillStyle = "rgba(0, 187, 249, 0.45)";
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius + 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.slowTimer > 0) {
        ctx.fillStyle = "rgba(72, 202, 228, 0.25)";
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 灼烧烈焰粒子
      if (m.burnTimer > 0) {
        const flamePulse = 0.3 + Math.sin(this.time * 12) * 0.15;
        ctx.fillStyle = `rgba(255, 84, 0, ${flamePulse})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius + 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 细致立体怪物建模
      ctx.translate(m.x, m.y);

      if (m.type === "crawler") {
        // 暗夜影行者（多节硬壳 + 爬行足足腿）
        const legWiggle = Math.sin(this.time * 20 + m.x) * 4;
        ctx.strokeStyle = "#2d6a4f";
        ctx.lineWidth = 2;
        // 左足
        ctx.beginPath();
        ctx.moveTo(-4, -6); ctx.lineTo(-m.radius - 4, -8 + legWiggle);
        ctx.moveTo(-4, 0);  ctx.lineTo(-m.radius - 5, 0 - legWiggle);
        ctx.moveTo(-4, 6);  ctx.lineTo(-m.radius - 4, 8 + legWiggle);
        // 右足
        ctx.moveTo(4, -6);  ctx.lineTo(m.radius + 4, -8 - legWiggle);
        ctx.moveTo(4, 0);   ctx.lineTo(m.radius + 5, 0 + legWiggle);
        ctx.moveTo(4, 6);   ctx.lineTo(m.radius + 4, 8 - legWiggle);
        ctx.stroke();

        // 躯干与头部
        ctx.fillStyle = "#38b000";
        ctx.beginPath();
        ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1b4332";
        ctx.beginPath();
        ctx.arc(0, -3, m.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // 发光复眼
        ctx.fillStyle = "#ffff3f";
        ctx.beginPath();
        ctx.arc(-4, -6, 2, 0, Math.PI * 2);
        ctx.arc(4, -6, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.type === "golem") {
        // 晶岩巨傀（粗粝玄武岩石甲 + 熔岩脉络）
        this.drawHexagon(ctx, 0, 0, m.radius, "#495057", "#212529");
        ctx.strokeStyle = "#ff9e00";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -8); ctx.lineTo(0, 0); ctx.lineTo(8, -6);
        ctx.moveTo(0, 0);   ctx.lineTo(-4, 9);
        ctx.stroke();

        // 独眼岩石核心
        ctx.fillStyle = "#ff5400";
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.type === "banshee") {
        // 虚空女妖（幽浮幻影 + 飘荡尾流）
        const waveY = Math.sin(this.time * 8) * 3;
        ctx.fillStyle = "#c77dff";
        ctx.beginPath();
        ctx.moveTo(0, -m.radius);
        ctx.lineTo(m.radius * 0.8, waveY);
        ctx.lineTo(0, m.radius * 1.5);
        ctx.lineTo(-m.radius * 0.8, waveY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#e0aaff";
        ctx.beginPath();
        ctx.arc(0, -m.radius * 0.4, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.type === "beetle") {
        // 自爆熔甲虫（通体赤红 + 鼓胀的高温熔岩囊）
        ctx.fillStyle = "#d00000";
        ctx.beginPath();
        ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
        ctx.fill();

        // 熔岩囊呼吸高光
        const magmaPulse = 1.0 + Math.sin(this.time * 15) * 0.15;
        ctx.fillStyle = "#ffba08";
        ctx.beginPath();
        ctx.arc(0, 2, m.radius * 0.65 * magmaPulse, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.type === "boss") {
        // 章节领主：巍峨霸气的古代魔尊
        const bossPulse = 1.0 + Math.sin(this.time * 3.5) * 0.08;
        this.drawHexagon(ctx, 0, 0, m.radius * bossPulse, m.color, "#ffffff");

        // 旋转护体法印
        ctx.rotate(this.time * 1.2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-m.radius * 0.65, -m.radius * 0.65, m.radius * 1.3, m.radius * 1.3);

        ctx.fillStyle = "#0a0a0a";
        ctx.beginPath();
        ctx.arc(0, 0, m.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // 绘制怪物生命条与护盾条
      this.drawMonsterHealthBar(ctx, m);
    }
  }

  drawMonsterHealthBar(ctx, m) {
    const barW = Math.max(28, m.radius * 2 + 4);
    const barH = 5;
    const barX = m.x - barW / 2;
    const barY = m.y - m.radius - 12;

    // 底槽
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(barX, barY, barW, barH);

    // 生命渐变条
    const hpRatio = Math.max(0, m.hp / m.maxHp);
    ctx.fillStyle = hpRatio > 0.4 ? "#38b000" : hpRatio > 0.2 ? "#ffb703" : "#d90429";
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    // 护盾覆盖层
    if (m.shield && m.shield > 0) {
      const shieldRatio = Math.max(0, m.shield / m.maxShield);
      ctx.fillStyle = "#00bbf9";
      ctx.fillRect(barX, barY - 3, barW * shieldRatio, 2.5);
    }
  }

  drawProjectilesAndArcs(ctx, state) {
    // 1. 飞行弹道
    for (const p of state.projectiles) {
      ctx.save();
      if (p.type === "arcane") {
        // 奥术光矢（带长尾流光）
        ctx.fillStyle = "#00f5d4";
        ctx.shadowColor = "#00f5d4";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "flame") {
        // 烈焰爆弹（炽热熔球 + 火星尾焰）
        ctx.fillStyle = "#ff5400";
        ctx.shadowColor = "#ff5400";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffdd00";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "frost") {
        // 极寒霜棱（锐利菱形晶簇）
        ctx.fillStyle = "#00bbf9";
        ctx.shadowColor = "#00bbf9";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 5);
        ctx.lineTo(p.x + 4, p.y);
        ctx.lineTo(p.x, p.y + 5);
        ctx.lineTo(p.x - 4, p.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. 战斗事件中的连环电弧与爆破
    for (const ev of state.combatEvents) {
      if (ev.type === "lightning_arc") {
        this.drawLightningBranch(ctx, ev.from.x, ev.from.y, ev.to.x, ev.to.y);
      } else if (ev.type === "lightning_strike") {
        const target = state.monsters.find((m) => m.id === ev.targetId);
        if (target) {
          this.drawLightningBranch(ctx, ev.from.x, ev.from.y, target.x, target.y);
        }
      } else if (ev.type === "flame_explosion") {
        this.addExplosion(ev.x, ev.y, "#ff5400", 18, 140);
        this.addShockwave(ev.x, ev.y, "rgba(255, 84, 0, 0.4)", 60);
      } else if (ev.type === "reaction_meltdown") {
        this.addExplosion(ev.x || 0, ev.y || 0, "#00f5d4", 16, 120);
      }
    }
  }

  drawLightningBranch(ctx, x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = "#c77dff";
    ctx.lineWidth = 3.5;
    ctx.shadowColor = "#9d4edd";
    ctx.shadowBlur = 12;

    const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 26;
    const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 26;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(midX, midY);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // 白色高压电弧中心线
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  drawParticles(ctx, dt) {
    // 1. 绘制环境漂浮魔法星尘
    for (const mote of this.ambientMotes) {
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;
      if (mote.y < 0) {
        mote.y = WORLD_HEIGHT;
        mote.x = Math.random() * WORLD_WIDTH;
      }
      if (mote.x < 0) mote.x = WORLD_WIDTH;
      if (mote.x > WORLD_WIDTH) mote.x = 0;

      ctx.fillStyle = `hsla(${mote.hue}, 85%, 65%, ${mote.alpha})`;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. 绘制战斗爆破粒子与冲击波
    const next = [];
    for (const p of this.particles) {
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) continue;

      if (p.type === "shockwave") {
        p.radius += (p.maxRadius - p.radius) * 7 * dt;
        ctx.save();
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      next.push(p);
    }
    this.particles = next;
  }
}
