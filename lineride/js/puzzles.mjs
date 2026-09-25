// puzzles：50关拼图模式关卡数据。五章 × 10关，逐章解锁新机制。
// 每关定义：id, chapter, track(已有轨道线段), start, finish, stars, inkLimit

const CHAPTER_NAMES = {
  zh: ["新手坡道", "山间小径", "冰峰雪岭", "峡谷飞跃", "极光之巅"],
  en: ["Beginner Slope", "Mountain Trail", "Icy Peak", "Canyon Leap", "Aurora Summit"],
};

// 工具：等距折线
function polyline(sx, sy, points, type = "normal") {
  const result = [];
  let px = sx, py = sy;
  for (const [dx, dy] of points) {
    const nx = px + dx, ny = py + dy;
    result.push({ x1: px, y1: py, x2: nx, y2: ny, type });
    px = nx; py = ny;
  }
  return result;
}

// —— 第1章：新手坡道（1-10关）单一缺口 ——

function ch1_l1() {
  const track = polyline(50, 500, [
    [240, -200], [120, 0], [80, 30], [80, 0], [120, -20],  // 下坡
    // 缺口：60px
    [80, 0], [80, 30], [120, 50], [200, 30],  // 接续
  ]);
  return {
    id: 1, chapter: 1,
    track,
    start: { x: 50, y: 500 },
    finish: { x: 1050, y: 420 },
    stars: [],
    inkLimit: 200,
  };
}

function ch1_l2() {
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 300, y2: 300, type: "normal" });
  // 缺口
  track.push({ x1: 400, y1: 300, x2: 650, y2: 350, type: "normal" });
  track.push({ x1: 650, y1: 350, x2: 900, y2: 280, type: "normal" });
  track.push({ x1: 900, y1: 280, x2: 1050, y2: 300, type: "normal" });
  return {
    id: 2, chapter: 1,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1050, y: 300 },
    stars: [{ x: 350, y: 280 }],
    inkLimit: 150,
  };
}

function ch1_l3() {
  const track = [];
  track.push({ x1: 50, y1: 300, x2: 150, y2: 200, type: "normal" });
  track.push({ x1: 150, y1: 200, x2: 250, y2: 250, type: "normal" });
  // 缺口：下坡 + 上坡
  track.push({ x1: 400, y1: 400, x2: 550, y2: 300, type: "normal" });
  track.push({ x1: 550, y1: 300, x2: 700, y2: 200, type: "normal" });
  track.push({ x1: 700, y1: 200, x2: 900, y2: 250, type: "normal" });
  track.push({ x1: 900, y1: 250, x2: 1050, y2: 200, type: "normal" });
  return {
    id: 3, chapter: 1,
    track,
    start: { x: 50, y: 300 },
    finish: { x: 1050, y: 200 },
    stars: [],
    inkLimit: 200,
  };
}

function ch1_l4() {
  const track = polyline(50, 350, [
    [150, -100], [100, 50], [100, -20],
    // 缺口
    [80, 0], [100, 50], [200, 30], [200, -30],
  ]);
  return {
    id: 4, chapter: 1,
    track,
    start: { x: 50, y: 350 },
    finish: { x: 980, y: 340 },
    stars: [{ x: 500, y: 260 }],
    inkLimit: 180,
  };
}

function ch1_l5() {
  const track = [];
  track.push({ x1: 50, y1: 450, x2: 200, y2: 350, type: "normal" });
  track.push({ x1: 200, y1: 350, x2: 350, y2: 400, type: "normal" });
  // 缺口
  track.push({ x1: 450, y1: 380, x2: 600, y2: 300, type: "normal" });
  track.push({ x1: 600, y1: 300, x2: 750, y2: 250, type: "normal" });
  track.push({ x1: 750, y1: 250, x2: 950, y2: 300, type: "normal" });
  track.push({ x1: 950, y1: 300, x2: 1050, y2: 280, type: "normal" });
  return {
    id: 5, chapter: 1,
    track,
    start: { x: 50, y: 450 },
    finish: { x: 1050, y: 280 },
    stars: [{ x: 400, y: 370 }],
    inkLimit: 160,
  };
}

function ch1_l6() {
  const track = polyline(50, 400, [
    [100, -80], [120, 40], [80, -10],
    // 缺口 (短)
    [60, 0], [120, 60], [200, 20], [150, -30], [100, 0],
  ]);
  return {
    id: 6, chapter: 1,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1060, y: 400 },
    stars: [],
    inkLimit: 130,
  };
}

function ch1_l7() {
  const track = polyline(50, 350, [
    [200, -150], [100, 80], [80, -60], [100, 0],
    // 缺口
    [60, 0], [120, 80], [80, 20], [150, -20],
  ]);
  return {
    id: 7, chapter: 1,
    track,
    start: { x: 50, y: 350 },
    finish: { x: 890, y: 300 },
    stars: [{ x: 450, y: 200 }],
    inkLimit: 150,
  };
}

function ch1_l8() {
  const track = polyline(50, 420, [
    [150, -100], [80, 30], [100, 20],
    // 缺口
    [60, 0], [120, 50], [200, 0], [120, -30],
  ]);
  return {
    id: 8, chapter: 1,
    track,
    start: { x: 50, y: 420 },
    finish: { x: 880, y: 390 },
    stars: [],
    inkLimit: 140,
  };
}

function ch1_l9() {
  const track = [];
  track.push({ x1: 50, y1: 380, x2: 250, y2: 300, type: "normal" });
  // 缺口
  track.push({ x1: 350, y1: 300, x2: 500, y2: 350, type: "normal" });
  track.push({ x1: 500, y1: 350, x2: 650, y2: 250, type: "normal" });
  track.push({ x1: 650, y1: 250, x2: 850, y2: 300, type: "normal" });
  track.push({ x1: 850, y1: 300, x2: 1050, y2: 250, type: "normal" });
  return {
    id: 9, chapter: 1,
    track,
    start: { x: 50, y: 380 },
    finish: { x: 1050, y: 250 },
    stars: [{ x: 300, y: 350 }],
    inkLimit: 170,
  };
}

function ch1_l10() {
  const track = polyline(50, 400, [
    [150, -120], [100, 80], [80, -40],
    // 缺口
    [50, 10], [100, 100], [90, -60], [80, 20], [100, -10],
  ]);
  return {
    id: 10, chapter: 1,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 800, y: 380 },
    stars: [{ x: 400, y: 350 }],
    inkLimit: 150,
  };
}

// —— 第2章：山间小径（11-20关）多缺口 ——

function ch2_l11() {
  const track = polyline(50, 450, [
    [100, -100], [80, 50],
    // 缺口1
    [60, 0], [80, 80],
    // 缺口2
    [100, -20], [120, 60], [200, -40],
  ]);
  return {
    id: 11, chapter: 2,
    track,
    start: { x: 50, y: 450 },
    finish: { x: 790, y: 500 },
    stars: [],
    inkLimit: 250,
  };
}

function ch2_l12() {
  const track = polyline(50, 400, [
    [150, -120], [80, 80],
    // 缺口1
    [50, 0], [60, 60],
    // 缺口2
    [100, -40], [120, 0],
    // 缺口3
    [80, 70], [100, -20],
  ]);
  return {
    id: 12, chapter: 2,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 800, y: 400 },
    stars: [{ x: 280, y: 380 }, { x: 580, y: 390 }],
    inkLimit: 280,
  };
}

function ch2_l13() {
  const track = [];
  track.push({ x1: 50, y1: 350, x2: 200, y2: 300, type: "normal" });
  // 缺口1
  track.push({ x1: 300, y1: 320, x2: 400, y2: 380, type: "normal" });
  track.push({ x1: 400, y1: 380, x2: 480, y2: 330, type: "normal" });
  // 缺口2
  track.push({ x1: 600, y1: 300, x2: 750, y2: 250, type: "normal" });
  track.push({ x1: 750, y1: 250, x2: 900, y2: 300, type: "normal" });
  track.push({ x1: 900, y1: 300, x2: 1050, y2: 280, type: "normal" });
  return {
    id: 13, chapter: 2,
    track,
    start: { x: 50, y: 350 },
    finish: { x: 1050, y: 280 },
    stars: [{ x: 500, y: 370 }],
    inkLimit: 250,
  };
}

function ch2_l14() {
  const track = polyline(50, 500, [
    [80, -80], [100, 40],
    // 缺口1
    [60, -10], [60, 60],
    // 缺口2
    [80, -20], [80, 80],
    // 缺口3
    [120, -50], [100, 30],
  ]);
  return {
    id: 14, chapter: 2,
    track,
    start: { x: 50, y: 500 },
    finish: { x: 740, y: 550 },
    stars: [{ x: 350, y: 470 }],
    inkLimit: 280,
  };
}

function ch2_l15() {
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 180, y2: 300, type: "normal" });
  // 缺口1
  track.push({ x1: 280, y1: 320, x2: 400, y2: 400, type: "normal" });
  // 缺口2
  track.push({ x1: 520, y1: 350, x2: 650, y2: 280, type: "normal" });
  track.push({ x1: 650, y1: 280, x2: 800, y2: 320, type: "normal" });
  track.push({ x1: 800, y1: 320, x2: 1050, y2: 250, type: "normal" });
  return {
    id: 15, chapter: 2,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1050, y: 250 },
    stars: [{ x: 220, y: 370 }, { x: 700, y: 350 }],
    inkLimit: 260,
  };
}

function ch2_l16() {
  // 蛇形轨道带缺口
  const track = polyline(50, 350, [
    [100, -50], [80, 80], [100, -120],
    // 缺口
    [60, 10], [80, 90], [90, -100], [80, 60],
  ]);
  return {
    id: 16, chapter: 2,
    track,
    start: { x: 50, y: 350 },
    finish: { x: 640, y: 300 },
    stars: [{ x: 300, y: 380 }],
    inkLimit: 220,
  };
}

function ch2_l17() {
  const track = polyline(50, 380, [
    [120, -80], [100, 30], [60, 40],
    // 缺口1
    [50, 0], [80, 70],
    // 缺口2
    [90, -30], [100, 60], [80, -10],
  ]);
  return {
    id: 17, chapter: 2,
    track,
    start: { x: 50, y: 380 },
    finish: { x: 730, y: 450 },
    stars: [],
    inkLimit: 240,
  };
}

function ch2_l18() {
  // 山谷地形
  const track = polyline(50, 300, [
    [200, 100], [80, 60], [100, -80],
    // 缺口
    [60, 0], [100, 150], [80, -100], [100, -20],
  ]);
  return {
    id: 18, chapter: 2,
    track,
    start: { x: 50, y: 300 },
    finish: { x: 720, y: 410 },
    stars: [{ x: 400, y: 500 }],
    inkLimit: 250,
  };
}

function ch2_l19() {
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 200, y2: 350, type: "normal" });
  track.push({ x1: 200, y1: 350, x2: 330, y2: 280, type: "normal" });
  // 缺口1
  track.push({ x1: 430, y1: 300, x2: 550, y2: 380, type: "normal" });
  track.push({ x1: 550, y1: 380, x2: 680, y2: 320, type: "normal" });
  // 缺口2
  track.push({ x1: 800, y1: 280, x2: 950, y2: 250, type: "normal" });
  track.push({ x1: 950, y1: 250, x2: 1050, y2: 220, type: "normal" });
  return {
    id: 19, chapter: 2,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1050, y: 220 },
    stars: [{ x: 360, y: 330 }, { x: 750, y: 310 }],
    inkLimit: 260,
  };
}

function ch2_l20() {
  const track = polyline(50, 480, [
    [80, -100], [120, 60],
    // 缺口1
    [40, 0], [60, 70],
    // 缺口2
    [80, -30], [100, 80],
    // 缺口3
    [90, -50], [80, 20],
  ]);
  return {
    id: 20, chapter: 2,
    track,
    start: { x: 50, y: 480 },
    finish: { x: 720, y: 540 },
    stars: [{ x: 350, y: 460 }],
    inkLimit: 280,
  };
}

// —— 第3章：冰峰雪岭（21-30关）线型限制 ——

function ch3_l21() {
  return {
    id: 21, chapter: 3,
    track: polyline(50, 400, [
      [200, -150], [100, 80],
    ]),
    start: { x: 50, y: 400 },
    finish: { x: 350, y: 330 },
    stars: [],
    inkLimit: 200,
    allowedLineTypes: ["normal"], // 只允许普通线
  };
}

function ch3_l22() {
  // 需要加速线上坡
  const track = polyline(50, 450, [
    [200, -50], [80, 50],
  ]);
  track.push({ x1: 600, y1: 500, x2: 800, y2: 300, type: "normal" });
  return {
    id: 22, chapter: 3,
    track,
    start: { x: 50, y: 450 },
    finish: { x: 800, y: 300 },
    stars: [],
    inkLimit: 220,
    allowedLineTypes: ["boost"], // 只允许加速线
  };
}

function ch3_l23() {
  return {
    id: 23, chapter: 3,
    track: polyline(50, 400, [
      [200, -150], [80, 30],
    ]),
    start: { x: 50, y: 400 },
    finish: { x: 330, y: 280 },
    stars: [],
    inkLimit: 180,
    allowedLineTypes: ["slow"], // 需要减速线防摔
  };
}

function ch3_l24() {
  const track = polyline(50, 400, [
    [200, -120], [80, 60],
    // 缺口
    [100, -40], [120, 80], [200, -60],
  ]);
  return {
    id: 24, chapter: 3,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 750, y: 360 },
    stars: [],
    inkLimit: 250,
    allowedLineTypes: ["normal", "slow"],
  };
}

function ch3_l25() {
  // 急下坡 + 急上坡，需要减速线
  const track = polyline(50, 300, [
    [300, 200], [100, -100],
  ]);
  return {
    id: 25, chapter: 3,
    track,
    start: { x: 50, y: 300 },
    finish: { x: 450, y: 400 },
    stars: [],
    inkLimit: 200,
    allowedLineTypes: ["slow"],
  };
}

function ch3_l26() {
  const track = polyline(50, 450, [
    [80, -80], [60, 60],
    // 缺口
    [50, 0], [80, 80],
    // 缺口
    [100, -30], [80, 40], [60, 20],
  ]);
  return {
    id: 26, chapter: 3,
    track,
    start: { x: 50, y: 450 },
    finish: { x: 520, y: 540 },
    stars: [{ x: 250, y: 460 }],
    inkLimit: 250,
    allowedLineTypes: ["normal", "boost"],
  };
}

function ch3_l27() {
  const track = polyline(50, 380, [
    [150, -100], [100, 50], [80, 30],
  ]);
  return {
    id: 27, chapter: 3,
    track,
    start: { x: 50, y: 380 },
    finish: { x: 380, y: 360 },
    stars: [],
    inkLimit: 160,
    allowedLineTypes: ["boost"],
  };
}

function ch3_l28() {
  const track = polyline(50, 420, [
    [100, -80], [80, 80], [100, -50],
    // 缺口
    [80, 10], [100, 100],
  ]);
  return {
    id: 28, chapter: 3,
    track,
    start: { x: 50, y: 420 },
    finish: { x: 510, y: 480 },
    stars: [{ x: 340, y: 390 }],
    inkLimit: 240,
    allowedLineTypes: ["normal", "boost", "slow"],
  };
}

function ch3_l29() {
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 200, y2: 350, type: "slow" });
  track.push({ x1: 200, y1: 350, x2: 350, y2: 380, type: "slow" });
  // 缺口 - 需要正常线连接
  track.push({ x1: 500, y1: 320, x2: 700, y2: 280, type: "normal" });
  track.push({ x1: 700, y1: 280, x2: 900, y2: 320, type: "normal" });
  return {
    id: 29, chapter: 3,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 900, y: 320 },
    stars: [],
    inkLimit: 220,
    allowedLineTypes: ["normal"],
  };
}

function ch3_l30() {
  const track = polyline(50, 450, [
    [100, -50], [60, 40], [80, 30],
    // 缺口
    [60, -10], [80, 60], [60, 20],
  ]);
  return {
    id: 30, chapter: 3,
    track,
    start: { x: 50, y: 450 },
    finish: { x: 490, y: 540 },
    stars: [{ x: 300, y: 480 }],
    inkLimit: 200,
    allowedLineTypes: ["normal", "slow"],
  };
}

// —— 第4章：峡谷飞跃（31-40关）空中抛物线 ——

function ch4_l31() {
  // 简单飞跃：上一个坡→缺口（空中）→在另一侧落地
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 250, y2: 250, type: "boost" });
  // 缺口：飞跃区
  track.push({ x1: 550, y1: 400, x2: 800, y2: 300, type: "slow" });
  track.push({ x1: 800, y1: 300, x2: 1000, y2: 320, type: "normal" });
  return {
    id: 31, chapter: 4,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1000, y: 320 },
    stars: [],
    inkLimit: 150,
  };
}

function ch4_l32() {
  const track = [];
  track.push({ x1: 50, y1: 450, x2: 200, y2: 300, type: "normal" });
  track.push({ x1: 200, y1: 300, x2: 300, y2: 200, type: "boost" });
  // 飞跃缺口
  track.push({ x1: 600, y1: 350, x2: 800, y2: 280, type: "normal" });
  track.push({ x1: 800, y1: 280, x2: 1000, y2: 300, type: "normal" });
  return {
    id: 32, chapter: 4,
    track,
    start: { x: 50, y: 450 },
    finish: { x: 1000, y: 300 },
    stars: [],
    inkLimit: 180,
  };
}

function ch4_l33() {
  // 需要飞跃 + 上坡足够高才能飞过去
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 200, y2: 350, type: "boost" });
  track.push({ x1: 200, y1: 350, x2: 300, y2: 200, type: "boost" });
  // 飞跃缺口（需要较高初速）
  track.push({ x1: 600, y1: 400, x2: 850, y2: 280, type: "normal" });
  track.push({ x1: 850, y1: 280, x2: 1050, y2: 300, type: "normal" });
  return {
    id: 33, chapter: 4,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1050, y: 300 },
    stars: [],
    inkLimit: 160,
  };
}

function ch4_l34() {
  // 多段飞跃
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 200, y2: 300, type: "boost" });
  // 飞跃1
  track.push({ x1: 400, y1: 380, x2: 500, y2: 280, type: "normal" });
  track.push({ x1: 500, y1: 280, x2: 600, y2: 220, type: "boost" });
  // 飞跃2
  track.push({ x1: 800, y1: 400, x2: 1000, y2: 300, type: "normal" });
  return {
    id: 34, chapter: 4,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1000, y: 300 },
    stars: [{ x: 480, y: 310 }],
    inkLimit: 200,
  };
}

function ch4_l35() {
  const track = [];
  track.push({ x1: 50, y1: 450, x2: 180, y2: 300, type: "normal" });
  track.push({ x1: 180, y1: 300, x2: 300, y2: 180, type: "boost" });
  // 大飞跃
  track.push({ x1: 700, y1: 400, x2: 1000, y2: 280, type: "slow" });
  return {
    id: 35, chapter: 4,
    track,
    start: { x: 50, y: 450 },
    finish: { x: 1000, y: 280 },
    stars: [],
    inkLimit: 170,
  };
}

function ch4_l36() {
  // 高地→峡谷→高地
  const track = [];
  track.push({ x1: 50, y1: 350, x2: 250, y2: 200, type: "boost" });
  // 飞跃峡谷
  track.push({ x1: 550, y1: 350, x2: 750, y2: 250, type: "normal" });
  track.push({ x1: 750, y1: 250, x2: 1000, y2: 300, type: "normal" });
  return {
    id: 36, chapter: 4,
    track,
    start: { x: 50, y: 350 },
    finish: { x: 1000, y: 300 },
    stars: [{ x: 420, y: 230 }], // 星标在空中飞跃路径上
    inkLimit: 180,
  };
}

function ch4_l37() {
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 200, y2: 350, type: "normal" });
  track.push({ x1: 200, y1: 350, x2: 350, y2: 180, type: "boost" });
  // 超长飞跃
  track.push({ x1: 800, y1: 380, x2: 1050, y2: 280, type: "slow" });
  return {
    id: 37, chapter: 4,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1050, y: 280 },
    stars: [],
    inkLimit: 180,
  };
}

function ch4_l38() {
  const track = [];
  track.push({ x1: 50, y1: 380, x2: 200, y2: 320, type: "boost" });
  track.push({ x1: 200, y1: 320, x2: 320, y2: 200, type: "boost" });
  // 飞跃
  track.push({ x1: 550, y1: 400, x2: 700, y2: 300, type: "normal" });
  track.push({ x1: 700, y1: 300, x2: 850, y2: 240, type: "boost" });
  // 飞跃2
  track.push({ x1: 1000, y1: 380, x2: 1100, y2: 320, type: "slow" });
  return {
    id: 38, chapter: 4,
    track,
    start: { x: 50, y: 380 },
    finish: { x: 1100, y: 320 },
    stars: [],
    inkLimit: 220,
  };
}

function ch4_l39() {
  // 下坡加速→借势飞跃
  const track = [];
  track.push({ x1: 50, y1: 250, x2: 200, y2: 350, type: "normal" });
  track.push({ x1: 200, y1: 350, x2: 320, y2: 200, type: "boost" });
  // 飞跃
  track.push({ x1: 650, y1: 380, x2: 900, y2: 280, type: "normal" });
  return {
    id: 39, chapter: 4,
    track,
    start: { x: 50, y: 250 },
    finish: { x: 900, y: 280 },
    stars: [],
    inkLimit: 190,
  };
}

function ch4_l40() {
  // 大下坡→大飞跃→精准着陆
  const track = [];
  track.push({ x1: 50, y1: 200, x2: 250, y2: 400, type: "normal" });
  track.push({ x1: 250, y1: 400, x2: 380, y2: 180, type: "boost" });
  // 大飞跃+星标在空中
  track.push({ x1: 800, y1: 400, x2: 1050, y2: 280, type: "slow" });
  return {
    id: 40, chapter: 4,
    track,
    start: { x: 50, y: 200 },
    finish: { x: 1050, y: 280 },
    stars: [{ x: 600, y: 220 }],
    inkLimit: 200,
  };
}
// —— 第5章：极光之巅（41-50关）大师级综合 ——

function ch5_l41() {
  // 回环 + 飞跃
  const track = polyline(50, 400, [
    [150, -150], [80, 50], [60, -120],
    [60, 20], [80, -100],
  ]);
  return {
    id: 41, chapter: 5,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 480, y: 100 },
    stars: [],
    inkLimit: 250,
  };
}

function ch5_l42() {
  // 精确速度控制回环
  const track = polyline(50, 450, [
    [200, -200], [100, 100], [80, -80],
    [60, 60], [100, -50], [80, 30],
  ]);
  return {
    id: 42, chapter: 5,
    track,
    start: { x: 50, y: 450 },
    finish: { x: 670, y: 310 },
    stars: [{ x: 400, y: 500 }],
    inkLimit: 300,
  };
}

function ch5_l43() {
  // 线型组合 + 大飞跃
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 200, y2: 350, type: "slow" });
  track.push({ x1: 200, y1: 350, x2: 350, y2: 180, type: "boost" });
  // 飞跃（需要 boost 加速）
  track.push({ x1: 700, y1: 380, x2: 900, y2: 250, type: "normal" });
  track.push({ x1: 900, y1: 250, x2: 1050, y2: 300, type: "slow" });
  return {
    id: 43, chapter: 5,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1050, y: 300 },
    stars: [],
    inkLimit: 250,
  };
}

function ch5_l44() {
  // 多段操作+奖励星标
  const track = polyline(50, 380, [
    [100, -50], [60, 40], [80, -120], [60, 60],
    [100, -30], [80, 0], [60, 40],
  ]);
  return {
    id: 44, chapter: 5,
    track,
    start: { x: 50, y: 380 },
    finish: { x: 590, y: 320 },
    stars: [{ x: 300, y: 280 }],
    inkLimit: 280,
  };
}

function ch5_l45() {
  // 回环 + 多飞跃
  const track = [];
  track.push({ x1: 50, y1: 350, x2: 250, y2: 450, type: "normal" });
  track.push({ x1: 250, y1: 450, x2: 350, y2: 200, type: "boost" });
  // 飞跃1
  track.push({ x1: 550, y1: 380, x2: 650, y2: 250, type: "normal" });
  track.push({ x1: 650, y1: 250, x2: 750, y2: 180, type: "boost" });
  // 飞跃2
  track.push({ x1: 1000, y1: 400, x2: 1100, y2: 280, type: "slow" });
  return {
    id: 45, chapter: 5,
    track,
    start: { x: 50, y: 350 },
    finish: { x: 1100, y: 280 },
    stars: [{ x: 480, y: 300 }],
    inkLimit: 300,
  };
}

function ch5_l46() {
  // 精准着陆挑战
  const track = [];
  track.push({ x1: 50, y1: 300, x2: 250, y2: 400, type: "normal" });
  track.push({ x1: 250, y1: 400, x2: 380, y2: 160, type: "boost" });
  // 飞跃到窄平台
  track.push({ x1: 750, y1: 380, x2: 850, y2: 380, type: "normal" });
  track.push({ x1: 850, y1: 380, x2: 950, y2: 250, type: "boost" });
  // 飞跃
  track.push({ x1: 1150, y1: 350, x2: 1250, y2: 320, type: "normal" });
  return {
    id: 46, chapter: 5,
    track,
    start: { x: 50, y: 300 },
    finish: { x: 1250, y: 320 },
    stars: [],
    inkLimit: 300,
  };
}

function ch5_l47() {
  // 复杂峡谷
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 200, y2: 320, type: "boost" });
  // 飞跃1
  track.push({ x1: 450, y1: 400, x2: 580, y2: 280, type: "normal" });
  track.push({ x1: 580, y1: 280, x2: 680, y2: 200, type: "boost" });
  // 飞跃2
  track.push({ x1: 900, y1: 380, x2: 1050, y2: 260, type: "slow" });
  return {
    id: 47, chapter: 5,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1050, y: 260 },
    stars: [],
    inkLimit: 270,
  };
}

function ch5_l48() {
  // 全机制综合
  const track = [];
  track.push({ x1: 50, y1: 420, x2: 180, y2: 360, type: "slow" });
  track.push({ x1: 180, y1: 360, x2: 280, y2: 220, type: "boost" });
  // 飞跃1
  track.push({ x1: 500, y1: 380, x2: 650, y2: 300, type: "normal" });
  track.push({ x1: 650, y1: 300, x2: 750, y2: 180, type: "boost" });
  // 飞跃2
  track.push({ x1: 1000, y1: 400, x2: 1150, y2: 280, type: "slow" });
  return {
    id: 48, chapter: 5,
    track,
    start: { x: 50, y: 420 },
    finish: { x: 1150, y: 280 },
    stars: [{ x: 400, y: 340 }, { x: 850, y: 240 }],
    inkLimit: 350,
  };
}

function ch5_l49() {
  // 多星标+大飞跃+线型组合
  const track = [];
  track.push({ x1: 50, y1: 380, x2: 200, y2: 300, type: "boost" });
  track.push({ x1: 200, y1: 300, x2: 330, y2: 180, type: "boost" });
  // 飞跃1
  track.push({ x1: 550, y1: 380, x2: 700, y2: 280, type: "normal" });
  track.push({ x1: 700, y1: 280, x2: 820, y2: 200, type: "boost" });
  // 飞跃2
  track.push({ x1: 1050, y1: 400, x2: 1200, y2: 280, type: "slow" });
  return {
    id: 49, chapter: 5,
    track,
    start: { x: 50, y: 380 },
    finish: { x: 1200, y: 280 },
    stars: [{ x: 430, y: 240 }, { x: 900, y: 240 }],
    inkLimit: 320,
  };
}

function ch5_l50() {
  // 最终关：超长综合赛道
  const track = [];
  track.push({ x1: 50, y1: 400, x2: 150, y2: 350, type: "slow" });
  track.push({ x1: 150, y1: 350, x2: 280, y2: 200, type: "boost" });
  // 飞跃1
  track.push({ x1: 480, y1: 380, x2: 600, y2: 300, type: "normal" });
  track.push({ x1: 600, y1: 300, x2: 720, y2: 180, type: "boost" });
  // 飞跃2
  track.push({ x1: 950, y1: 390, x2: 1100, y2: 260, type: "slow" });
  track.push({ x1: 1100, y1: 260, x2: 1250, y2: 300, type: "normal" });
  return {
    id: 50, chapter: 5,
    track,
    start: { x: 50, y: 400 },
    finish: { x: 1250, y: 300 },
    stars: [{ x: 380, y: 220 }, { x: 850, y: 240 }, { x: 1050, y: 370 }],
    inkLimit: 380,
  };
}

// 汇总
const ALL_PUZZLES = [
  ch1_l1, ch1_l2, ch1_l3, ch1_l4, ch1_l5, ch1_l6, ch1_l7, ch1_l8, ch1_l9, ch1_l10,
  ch2_l11, ch2_l12, ch2_l13, ch2_l14, ch2_l15, ch2_l16, ch2_l17, ch2_l18, ch2_l19, ch2_l20,
  ch3_l21, ch3_l22, ch3_l23, ch3_l24, ch3_l25, ch3_l26, ch3_l27, ch3_l28, ch3_l29, ch3_l30,
  ch4_l31, ch4_l32, ch4_l33, ch4_l34, ch4_l35, ch4_l36, ch4_l37, ch4_l38, ch4_l39, ch4_l40,
  ch5_l41, ch5_l42, ch5_l43, ch5_l44, ch5_l45, ch5_l46, ch5_l47, ch5_l48, ch5_l49, ch5_l50,
];

// 惰性求值（每个关卡首次访问时才调用工厂函数生成数据）
const cache = new Map();

export function getPuzzle(id) {
  if (cache.has(id)) return cache.get(id);
  const factory = ALL_PUZZLES[id - 1];
  if (!factory) throw new Error(`Puzzle ${id} not found`);
  const data = factory();
  cache.set(id, data);
  return data;
}

export function getPuzzleCount() {
  return ALL_PUZZLES.length;
}

export function getChapterInfo(chapter, locale = "zh") {
  const names = CHAPTER_NAMES[locale] || CHAPTER_NAMES.zh;
  return {
    number: chapter,
    name: names[chapter - 1] || `Chapter ${chapter}`,
    startId: (chapter - 1) * 10 + 1,
    endId: chapter * 10,
  };
}

export function getChapterForPuzzle(puzzleId) {
  return Math.ceil(puzzleId / 10);
}