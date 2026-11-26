/**
 * 中华客栈 · 跑堂点菜 (Inn Master)
 * 江南客栈大堂 Canvas 2D 物理高保真渲染器 (60fps 高清微雕, 实体桌椅与蒸汽粒子)
 */

import { STATIONS, DISHES } from "./engine.mjs";
import { t } from "./i18n.mjs";

export function createTavernRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let animTime = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 540;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render(state, dt = 0.016) {
    animTime += dt;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 540;

    const scaleX = width / 800;
    const scaleY = height / 540;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    // 1. 背景青砖铺地与环境光晕
    drawFloor();

    // 2. 顶部三大工位 (茶台、后厨、柜台)
    drawStations();

    // 3. 入口木门与迎客地毯
    drawEntrance();

    // 4. 大堂方桌与客官就座
    drawTables(state.tables);

    // 5. 帮工小二 (若激活)
    if (state.assistant && state.assistant.active) {
      drawAssistant(state.assistant);
    }

    // 6. 主角跑堂小二
    drawWaiter(state.waiter);

    ctx.restore();
  }

  function drawFloor() {
    // 青砖冷灰底
    ctx.fillStyle = "#1b2124";
    ctx.fillRect(0, 0, 800, 540);

    // 青砖缝隙纹理
    ctx.strokeStyle = "rgba(45, 58, 64, 0.4)";
    ctx.lineWidth = 1;
    const tileSize = 40;
    for (let x = 0; x <= 800; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    for (let y = 0; y <= 540; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // 两侧大红灯笼暖黄环境漫反射
    const leftGlow = ctx.createRadialGradient(80, 100, 10, 80, 100, 260);
    leftGlow.addColorStop(0, "rgba(255, 175, 75, 0.16)");
    leftGlow.addColorStop(1, "rgba(255, 175, 75, 0)");
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 0, 400, 400);

    const rightGlow = ctx.createRadialGradient(720, 100, 10, 720, 100, 260);
    rightGlow.addColorStop(0, "rgba(255, 175, 75, 0.16)");
    rightGlow.addColorStop(1, "rgba(255, 175, 75, 0)");
    ctx.fillStyle = rightGlow;
    ctx.fillRect(400, 0, 400, 400);
  }

  function drawStations() {
    // 顶部横梁与工位背景
    ctx.fillStyle = "#2c2018";
    ctx.fillRect(40, 15, 720, 110);
    ctx.strokeStyle = "#4a3525";
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 15, 720, 110);

    // 1. 茶台 (x: 190, y: 80)
    ctx.save();
    ctx.translate(STATIONS.tea.x, STATIONS.tea.y);
    // 茶桌
    ctx.fillStyle = "#3d291a";
    ctx.fillRect(-65, -35, 130, 70);
    ctx.strokeStyle = "#614127";
    ctx.lineWidth = 2;
    ctx.strokeRect(-65, -35, 130, 70);
    // 茶壶 (紫砂色)
    ctx.fillStyle = "#7a3721";
    ctx.beginPath();
    ctx.arc(-15, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 壶嘴与提梁
    ctx.beginPath();
    ctx.arc(-15, -12, 10, Math.PI, 0);
    ctx.stroke();
    // 茶杯
    ctx.fillStyle = "#d4ece6";
    ctx.beginPath();
    ctx.arc(20, -5, 7, 0, Math.PI * 2);
    ctx.arc(25, 12, 7, 0, Math.PI * 2);
    ctx.fill();
    // 茶台热气螺旋
    drawSteam(-15, -20);
    // 标识
    ctx.fillStyle = "#ffdd99";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("station_tea_sign"), 0, -42);
    ctx.restore();

    // 2. 后厨窗口 (x: 400, y: 80)
    ctx.save();
    ctx.translate(STATIONS.kitchen.x, STATIONS.kitchen.y);
    // 灶台红砖
    ctx.fillStyle = "#4a2118";
    ctx.fillRect(-70, -35, 140, 70);
    ctx.strokeStyle = "#7c3527";
    ctx.lineWidth = 2;
    ctx.strokeRect(-70, -35, 140, 70);
    // 铁锅与菜品
    ctx.fillStyle = "#1e1e1e";
    ctx.beginPath();
    ctx.arc(-25, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d15b22";
    ctx.beginPath();
    ctx.arc(-25, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    // 出菜托盘
    ctx.fillStyle = "#e0cca7";
    ctx.fillRect(15, -15, 36, 30);
    ctx.strokeRect(15, -15, 36, 30);
    // 后厨热气
    drawSteam(-25, -24);
    drawSteam(32, -18);
    // 标识
    ctx.fillStyle = "#ffdd99";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("station_kitchen_sign"), 0, -42);
    ctx.restore();

    // 3. 柜台算盘 (x: 620, y: 80)
    ctx.save();
    ctx.translate(STATIONS.counter.x, STATIONS.counter.y);
    // 红木高柜台
    ctx.fillStyle = "#3a2215";
    ctx.fillRect(-65, -35, 130, 70);
    ctx.strokeStyle = "#5a341e";
    ctx.lineWidth = 2;
    ctx.strokeRect(-65, -35, 130, 70);
    // 黑色微型算盘
    ctx.fillStyle = "#1c140e";
    ctx.fillRect(-45, -15, 50, 30);
    ctx.strokeStyle = "#aa8250";
    ctx.strokeRect(-45, -15, 50, 30);
    // 算盘内珠条
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1;
    for (let bx = -40; bx <= -5; bx += 8) {
      ctx.beginPath();
      ctx.moveTo(bx, -15);
      ctx.lineTo(bx, 15);
      ctx.stroke();
    }
    // 账册与铜钱罐
    ctx.fillStyle = "#e8dcbe";
    ctx.fillRect(18, -12, 28, 24);
    // 标识
    ctx.fillStyle = "#ffdd99";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("station_counter_sign"), 0, -42);
    ctx.restore();
  }

  function drawSteam(x, y) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const wobble1 = Math.sin(animTime * 3) * 4;
    const wobble2 = Math.cos(animTime * 2.5) * 4;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + wobble1, y - 10, x - wobble2, y - 20, x + wobble1, y - 30);
    ctx.stroke();
    ctx.restore();
  }

  function drawEntrance() {
    // 右下角客栈入口迎宾地毯
    ctx.save();
    ctx.translate(STATIONS.entrance.x, STATIONS.entrance.y);
    ctx.fillStyle = "#8b251e";
    ctx.fillRect(-35, -20, 70, 40);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 2;
    ctx.strokeRect(-35, -20, 70, 40);

    ctx.fillStyle = "#ffdd99";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("station_door_sign"), 0, 5);
    ctx.restore();
  }

  function drawTables(tables) {
    for (const table of tables) {
      ctx.save();
      ctx.translate(table.x, table.y);

      // 地面阴影
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(0, 5, 52, 38, 0, 0, Math.PI * 2);
      ctx.fill();

      // 四把木椅
      ctx.fillStyle = "#4a3321";
      ctx.fillRect(-48, -10, 10, 20); // 左椅
      ctx.fillRect(38, -10, 10, 20);  // 右椅
      ctx.fillRect(-10, -44, 20, 10); // 上椅
      ctx.fillRect(-10, 34, 20, 10);  // 下椅

      // 八仙方木桌
      ctx.fillStyle = table.status === "dirty" ? "#38291f" : "#5a3a24";
      ctx.fillRect(-36, -30, 72, 60);
      ctx.strokeStyle = table.status === "dirty" ? "#5c4030" : "#805232";
      ctx.lineWidth = 3;
      ctx.strokeRect(-36, -30, 72, 60);

      // 桌号标牌
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${table.id + 1}`, 0, 4);

      // 桌子状态绘制
      if (table.status === "dirty") {
        // 残局碗筷与污迹
        ctx.fillStyle = "#e0d3be";
        ctx.beginPath();
        ctx.arc(-8, -6, 8, 0, Math.PI * 2);
        ctx.arc(10, 4, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8a6642";
        ctx.fillRect(-14, 12, 28, 4);
      } else if (table.guest) {
        drawGuest(table.guest);
      }

      ctx.restore();
    }
  }

  function drawGuest(guest) {
    // 客官入座形象 (不同类型不同帽子发髻)
    ctx.save();
    ctx.translate(0, -5);

    // 头部
    ctx.fillStyle = "#f3cb9e";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // 角色特色服饰/帽子
    if (guest.typeKey === "guest_scholar") {
      // 书生方巾 (青蓝)
      ctx.fillStyle = "#2e6f7a";
      ctx.fillRect(-9, -15, 18, 10);
      ctx.fillRect(-12, -8, 24, 4);
    } else if (guest.typeKey === "guest_merchant") {
      // 商贾红缎金边瓜皮帽
      ctx.fillStyle = "#8d1e1e";
      ctx.beginPath();
      ctx.arc(0, -7, 11, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(-4, -13, 8, 4);
    } else if (guest.typeKey === "guest_escort") {
      // 镖师硬朗红发带
      ctx.fillStyle = "#ba331c";
      ctx.fillRect(-11, -8, 22, 5);
    } else {
      // 游侠斗笠 (竹黄色)
      ctx.fillStyle = "#a88548";
      ctx.beginPath();
      ctx.arc(0, -6, 17, Math.PI, 0);
      ctx.fill();
    }

    // 悬浮订单气泡或耐心条
    drawGuestBubble(guest);

    ctx.restore();
  }

  function drawGuestBubble(guest) {
    ctx.save();
    ctx.translate(0, -42);

    if (guest.state === "ordering") {
      // 正在点单气泡
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.beginPath();
      ctx.roundRect(-24, -14, 48, 24, 6);
      ctx.fill();
      ctx.fillStyle = "#ffdd99";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t("bubble_ordering"), 0, 2);
    } else if (guest.state === "waiting") {
      // 等待服务：显示所需菜品图标 + 耐心条
      const dishCount = guest.dishes.length;
      const bubbleW = Math.max(56, dishCount * 28 + 14);

      // 气泡底板
      ctx.fillStyle = "rgba(18, 25, 28, 0.92)";
      ctx.strokeStyle = "#a3824b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-bubbleW / 2, -22, bubbleW, 36, 8);
      ctx.fill();
      ctx.stroke();

      // 所需菜品清单
      const startX = -(dishCount - 1) * 14;
      guest.dishes.forEach((dishId, idx) => {
        const dx = startX + idx * 28;
        const isServed = guest.servedDishes.includes(dishId);
        drawMiniDishIcon(dishId, dx, -8, isServed);
      });

      // 耐心条 (绿 -> 黄 -> 红)
      const barW = bubbleW - 12;
      const pct = Math.max(0, guest.patience / 100);
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(-barW / 2, 7, barW, 4);

      ctx.fillStyle = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#ff9800" : "#f44336";
      ctx.fillRect(-barW / 2, 7, barW * pct, 4);
    } else if (guest.state === "eating") {
      // 正在用餐
      ctx.fillStyle = "rgba(22, 38, 26, 0.92)";
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-28, -14, 56, 24, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#a8f5b4";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t("bubble_eating"), 0, 2);
    } else if (guest.state === "paying") {
      // 等待结账 (金黄闪烁气泡)
      const pulse = Math.sin(animTime * 6) * 2;
      ctx.fillStyle = "rgba(65, 48, 12, 0.95)";
      ctx.strokeStyle = "#ffc107";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-30 - pulse / 2, -16 - pulse / 2, 60 + pulse, 28 + pulse, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffe082";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t("bubble_pay", { n: guest.bill }), 0, 2);
    }

    ctx.restore();
  }

  function drawMiniDishIcon(dishId, x, y, isServed) {
    ctx.save();
    ctx.translate(x, y);
    if (isServed) {
      ctx.globalAlpha = 0.35;
    }

    if (dishId === "dish_tea") {
      // 绿茶杯
      ctx.fillStyle = "#8bc34a";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (dishId === "dish_noodles") {
      // 阳春面条
      ctx.fillStyle = "#ffb74d";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-4, -1, 8, 2);
    } else if (dishId === "dish_pork") {
      // 东坡肉
      ctx.fillStyle = "#c2185b";
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 1;
      ctx.strokeRect(-6, -6, 12, 12);
    } else {
      // 桂花糕
      ctx.fillStyle = "#fff59d";
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isServed) {
      // 打勾标记
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-1, 3);
      ctx.lineTo(4, -3);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawWaiter(waiter) {
    ctx.save();
    ctx.translate(waiter.x, waiter.y);

    // 行走颠簸动效
    const isMoving = Math.hypot(waiter.targetX - waiter.x, waiter.targetY - waiter.y) > 4;
    const bob = isMoving ? Math.abs(Math.sin(animTime * 12)) * 3 : 0;

    // 阴影
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 8, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // 躯干 (麻布短衫)
    ctx.fillStyle = "#335577";
    ctx.fillRect(-10, -18 - bob, 20, 24);

    // 腰带
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(-10, -7 - bob, 20, 3);

    // 头部 (包巾小帽)
    ctx.fillStyle = "#f3cb9e";
    ctx.beginPath();
    ctx.arc(0, -26 - bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-9, -34 - bob, 18, 7);

    // 肩头白毛巾
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(4, -22 - bob, 6, 14);

    // 头顶托盘与所盛物品
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(-18, -42 - bob, 36, 6);
    ctx.strokeStyle = "#8d6e63";
    ctx.lineWidth = 1;
    ctx.strokeRect(-18, -42 - bob, 36, 6);

    // 托盘盛放的菜品图标
    if (waiter.tray && waiter.tray.length > 0) {
      const startX = -(waiter.tray.length - 1) * 9;
      waiter.tray.forEach((dishId, idx) => {
        drawMiniDishIcon(dishId, startX + idx * 18, -50 - bob, false);
      });
    }

    ctx.restore();
  }

  function drawAssistant(assistant) {
    ctx.save();
    ctx.translate(assistant.x, assistant.y);

    const isMoving = Math.hypot(assistant.targetX - assistant.x, assistant.targetY - assistant.y) > 4;
    const bob = isMoving ? Math.abs(Math.sin(animTime * 14)) * 2.5 : 0;

    // 阴影
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 帮工蓝布衣
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(-8, -14 - bob, 16, 18);

    // 头部
    ctx.fillStyle = "#f3cb9e";
    ctx.beginPath();
    ctx.arc(0, -20 - bob, 8, 0, Math.PI * 2);
    ctx.fill();

    // 手中抹布
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(7, -8 - bob, 6, 8);

    ctx.restore();
  }

  return {
    resize,
    render,
  };
}
